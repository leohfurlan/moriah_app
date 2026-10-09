#!/usr/bin/env bash
#
# Verificador dos criterios de aceite de INFRAESTRUTURA da Fase 2.
#
# Dois modos:
#   ./scripts/verificar-vps-piloto.sh --local
#       Roda DENTRO da VPS: firewall, ssh, docker, rotacao de log, swap,
#       usuario de deploy, permissao do .env.pilot, servico systemd.
#
#   ./scripts/verificar-vps-piloto.sh --dominio piloto.exemplo.com [--ip 1.2.3.4]
#       Roda da sua maquina (de fora): DNS, certificado, redirect HTTP->HTTPS,
#       SSH sem root/senha, 5432 e 8000 fechadas de fora, /health/ sem vazar dado.
#
# Sai com codigo != 0 se qualquer criterio falhar. Nao altera nada no alvo.

set -uo pipefail

DOMINIO=""
IP_ESPERADO=""
HOST=""
MODO=""
PORTA_APP="8000"
PORTA_SSH="22"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODO="local" ;;
    --dominio) DOMINIO="${2:-}"; shift ;;
    --ip) IP_ESPERADO="${2:-}"; shift ;;
    --host) HOST="${2:-}"; shift ;;
    --porta-app) PORTA_APP="${2:-}"; shift ;;
    -h | --help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *) echo "Opcao desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

OK=0
FALHAS=0
PULADOS=0

ok() { printf '  [OK ]    %s\n' "$1"; OK=$((OK + 1)); }
falha() { printf '  [FALHA]  %s\n' "$1"; FALHAS=$((FALHAS + 1)); }
pulado() { printf '  [PULADO] %s\n' "$1"; PULADOS=$((PULADOS + 1)); }

porta_aberta() {
  local host="$1" porta="$2"
  timeout 6 bash -c "exec 3<>/dev/tcp/${host}/${porta}" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Modo local (dentro da VPS)
# ---------------------------------------------------------------------------
modo_local() {
  echo "Verificacao LOCAL (dentro da VPS)"

  echo
  echo "1) Firewall"
  if command -v ufw > /dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ok "ufw ativo: $(ufw status | head -1)"
    for porta in 80/tcp 443/tcp; do
      if ufw status | grep -q "^${porta}"; then ok "ufw permite ${porta}"; else falha "ufw nao permite ${porta}"; fi
    done
    if ufw status | grep -qE "^5432"; then
      falha "ufw permite 5432 (o banco nao pode ficar exposto)"
    else
      ok "ufw nao expoe 5432"
    fi
  else
    falha "ufw ausente ou inativo"
  fi
  if [[ "$(iptables -S INPUT 2>/dev/null | grep -c REJECT)" -gt 0 ]]; then
    falha "ainda existem regras REJECT da imagem OCI no iptables (conflita com o ufw)"
  else
    ok "sem regras REJECT da OCI atrapalhando o ufw"
  fi

  echo
  echo "2) SSH"
  if [[ -f /etc/ssh/sshd_config.d/99-moriah-piloto.conf ]]; then
    ok "configuracao de SSH do piloto instalada"
    grep -q "^PermitRootLogin no" /etc/ssh/sshd_config.d/99-moriah-piloto.conf \
      && ok "PermitRootLogin no" || falha "PermitRootLogin nao esta como no"
    grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config.d/99-moriah-piloto.conf \
      && ok "PasswordAuthentication no" || falha "autenticacao por senha nao esta desligada"
  else
    falha "falta /etc/ssh/sshd_config.d/99-moriah-piloto.conf"
  fi
  id deploy > /dev/null 2>&1 && ok "usuario deploy existe" || falha "usuario deploy nao existe"
  if id -nG deploy 2>/dev/null | grep -qw docker; then ok "deploy no grupo docker"; else falha "deploy fora do grupo docker"; fi

  echo
  echo "3) Docker e runtime"
  if command -v docker > /dev/null 2>&1; then
    ok "docker: $(docker --version)"
    docker compose version > /dev/null 2>&1 && ok "compose: $(docker compose version --short 2>/dev/null)" || falha "plugin docker compose ausente"
  else
    falha "docker nao instalado"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "backend"; then
    local uid_container
    uid_container="$(docker inspect --format '{{.Config.User}}' "$(docker ps --format '{{.Names}}' | grep backend | head -1)" 2>/dev/null)"
    if [[ -n "$uid_container" && "$uid_container" != "0" && "$uid_container" != "root" ]]; then
      ok "container da aplicacao roda como usuario sem privilegio ($uid_container)"
    else
      falha "container da aplicacao roda como root (ou sem USER definido)"
    fi
  else
    pulado "nenhum container de backend em execucao (Fase 4 ainda nao aplicada)"
  fi

  echo
  echo "4) Rotacao de logs e atualizacoes"
  [[ -f /etc/docker/daemon.json ]] && grep -q "max-size" /etc/docker/daemon.json \
    && ok "daemon.json com rotacao de log" || falha "sem rotacao de log no daemon.json"
  [[ -f /etc/systemd/journald.conf.d/99-moriah-piloto.conf ]] \
    && ok "journal com limite configurado" || falha "sem limite de journal"
  systemctl is-enabled unattended-upgrades > /dev/null 2>&1 \
    && ok "unattended-upgrades habilitado" || falha "unattended-upgrades nao habilitado"
  systemctl is-active fail2ban > /dev/null 2>&1 \
    && ok "fail2ban ativo" || falha "fail2ban inativo"

  echo
  echo "5) Operacao"
  swapon --show 2>/dev/null | grep -q swap && ok "swap ativo" || pulado "sem swap (ok se a shape tiver RAM suficiente)"
  if [[ -f /opt/moriah_app/.env.pilot ]]; then
    local perm dono
    perm="$(stat -c '%a' /opt/moriah_app/.env.pilot)"
    dono="$(stat -c '%U' /opt/moriah_app/.env.pilot)"
    [[ "$perm" == "600" ]] && ok ".env.pilot com permissao 600" || falha ".env.pilot com permissao $perm (esperado 600)"
    [[ "$dono" == "deploy" ]] && ok ".env.pilot pertence a deploy" || falha ".env.pilot pertence a $dono"
  else
    pulado ".env.pilot ainda nao existe (Fase 4)"
  fi
  systemctl is-enabled moriah-piloto > /dev/null 2>&1 \
    && ok "servico moriah-piloto habilitado no boot" || falha "servico moriah-piloto nao habilitado"
}

# ---------------------------------------------------------------------------
# Modo externo (da sua maquina)
# ---------------------------------------------------------------------------
modo_externo() {
  HOST="${HOST:-$DOMINIO}"
  echo "Verificacao EXTERNA (alvo: $HOST)"

  echo
  echo "1) DNS"
  if [[ -n "$DOMINIO" ]]; then
    local resolvido
    resolvido="$(getent hosts "$DOMINIO" 2>/dev/null | awk '{print $1}' | head -1)"
    if [[ -z "$resolvido" ]]; then
      falha "DNS nao resolve $DOMINIO"
    elif [[ -n "$IP_ESPERADO" && "$resolvido" != "$IP_ESPERADO" ]]; then
      falha "$DOMINIO resolve para $resolvido (esperado $IP_ESPERADO)"
    else
      ok "$DOMINIO -> $resolvido"
    fi
  else
    pulado "sem --dominio: DNS e TLS nao verificados"
  fi

  echo
  echo "2) Portas (de fora)"
  porta_aberta "$HOST" "$PORTA_SSH" && ok "SSH (${PORTA_SSH}) responde" || falha "SSH (${PORTA_SSH}) nao responde"
  porta_aberta "$HOST" 80 && ok "80 aberta (redirect/ACME)" || falha "80 fechada (o certificado e o redirect precisam dela)"
  porta_aberta "$HOST" 443 && ok "443 aberta" || falha "443 fechada"
  if porta_aberta "$HOST" 5432; then
    falha "5432 ABERTA de fora — o banco nao pode estar exposto"
  else
    ok "5432 fechada de fora"
  fi
  if porta_aberta "$HOST" "$PORTA_APP"; then
    falha "${PORTA_APP} ABERTA de fora — a aplicacao deve sair so pelo proxy (127.0.0.1)"
  else
    ok "${PORTA_APP} fechada de fora"
  fi

  echo
  echo "3) SSH: sem root e sem senha"
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=8 \
    -o PreferredAuthentications=password root@"$HOST" true > /dev/null 2>&1; then
    falha "login root por senha funcionou (nao deveria)"
  else
    ok "root sem acesso por senha"
  fi
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=8 \
    -o PreferredAuthentications=password deploy@"$HOST" true > /dev/null 2>&1; then
    falha "login por senha do deploy funcionou (nao deveria)"
  else
    ok "deploy sem acesso por senha (so chave)"
  fi

  if [[ -z "$DOMINIO" ]]; then
    echo
    echo "4) HTTPS e health"
    pulado "sem --dominio: certificado, redirect e /health/ nao verificados"
    return
  fi

  echo
  echo "4) HTTPS e redirect"
  local codigo_http location
  codigo_http="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://${DOMINIO}/health/" 2>/dev/null)"
  location="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 15 "http://${DOMINIO}/health/" 2>/dev/null)"
  if [[ "$codigo_http" =~ ^30[178]$ && "$location" == https://* ]]; then
    ok "HTTP redireciona para HTTPS (${codigo_http} -> ${location})"
  else
    falha "HTTP nao redireciona para HTTPS (codigo ${codigo_http:-sem resposta})"
  fi

  local verifica
  verifica="$(curl -s -o /dev/null -w '%{ssl_verify_result}' --max-time 15 "https://${DOMINIO}/health/" 2>/dev/null)"
  if [[ "$verifica" == "0" ]]; then
    ok "certificado HTTPS valido"
  else
    falha "certificado HTTPS invalido (ssl_verify_result=${verifica:-sem resposta})"
  fi

  echo
  echo "5) /health/ (sem vazar dado)"
  local corpo
  corpo="$(curl -fsS --max-time 15 "https://${DOMINIO}/health/" 2>/dev/null)"
  if [[ -z "$corpo" ]]; then
    falha "/health/ nao respondeu por HTTPS"
  else
    echo "         resposta: $corpo"
    if grep -q '"status"' <<< "$corpo"; then ok "/health/ devolve status"; else falha "/health/ sem campo status"; fi
    if grep -qE '"database"|"secret"|"password"|"key"|"token"|"host"' <<< "$corpo"; then
      falha "/health/ expoe detalhe interno"
    else
      ok "/health/ nao expoe detalhe interno"
    fi
  fi
  if curl -fsS --max-time 15 "https://${DOMINIO}/health/ready/" > /dev/null 2>&1; then
    ok "/health/ready/ responde (banco acessivel pelo app)"
  else
    falha "/health/ready/ sem resposta 2xx (banco fora, TLS ou proxy)"
  fi
}

if [[ "$MODO" == "local" ]]; then
  modo_local
else
  modo_externo
fi

echo
echo "RESULTADO: ${OK} ok, ${FALHAS} falha(s), ${PULADOS} pulado(s)"
if [[ "$FALHAS" -gt 0 ]]; then
  echo "A Fase 2 nao esta fechada enquanto houver falha."
  exit 1
fi
echo "Criterios de infraestrutura da Fase 2 atendidos."
