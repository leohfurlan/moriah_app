# Runbook — provisionamento da VPS do piloto (Fase 2)

**Escopo:** Fase 2 do `docs/architecture/plano-arquitetura-oracle-neon-piloto.md`
— VPS acessível por HTTPS e SSH restrito, sem 5432 pública. O que a aplicação
roda em cima dela (imagem, migrate, `.env.pilot`) é a Fase 4
(`docs/runbook-deploy-piloto.md`).

**O que já está pronto no repositório (não precisa decidir nada):**
`deploy/cloud-init.yaml` (provisionamento da instância),
`deploy/moriah-piloto.service` (stack no boot),
`scripts/verificar-vps-piloto.sh` (aceite da Fase 2).

**O que só o dono da conta faz:** criar a instância na OCI (conta + forma de
pagamento do always-free), informar/colar a chave SSH pública e apontar o DNS.
Nada disso é feito por agente.

---

## 0. Antes de começar

```bash
# IP administrativo que vai poder falar SSH (troque no cloud-init antes de colar)
curl -s https://ifconfig.me; echo

# Chave publica que autoriza o acesso
cat ~/.ssh/id_ed25519.pub
```

Decida (e anote): domínio do piloto (ex.: `piloto.moriah.app`) e o subdomínio da
API, se houver (`api-piloto.moriah.app`).

## 1. Criar a instância na Oracle Cloud

1. **Rede:** Networking > Virtual Cloud Networks > *Create VCN* com
   *Create public subnet* marcado.
2. **Regras de entrada** (NSG ou Security List — o plano exige as duas camadas,
   esta é a da nuvem):
   | Origem | Porta | Para que |
   | --- | --- | --- |
   | `<seu IP administrativo>/32` | TCP 22 | SSH |
   | `0.0.0.0/0` | TCP 80 | redirect e desafio do certificado |
   | `0.0.0.0/0` | TCP 443 | aplicação e admin |
   | — | TCP 5432 | **não criar** (banco é no Neon) |
   Saída: liberar tudo (a VPS precisa de HTTPS para repo, EAS, Neon e S3).
3. **Instância:** Compute > Instances > *Create instance*
   - Imagem: **Ubuntu 24.04 LTS** (Canonical);
   - Shape: `VM.Standard.A1.Flex` (Ampere ARM, always-free 4 OCPU/24 GB) — a
     `VM.Standard.E2.1.Micro` também serve, o cloud-init já cria swap;
   - *Add SSH keys*: cole `~/.ssh/id_ed25519.pub`;
   - **Advanced options > Management > Initialization script:** cole o conteúdo
     de `deploy/cloud-init.yaml` **depois de trocar** o placeholder
     `...cole-aqui...` pela sua chave pública e `203.0.113.10` pelo seu IP
     administrativo.
4. **IP público reservado:** em *Networking > Reserved public IPs*, crie um IP e
   associe à instância (sem isso, um reboot troca o endereço e o DNS quebra).

## 2. DNS

No provedor do domínio, crie um registro **A** apontando para o IP reservado
(TTL 300 enquanto estiver testando):

| Nome | Tipo | Valor |
| --- | --- | --- |
| `piloto` | A | `<IP reservado>` |
| `api-piloto` (opcional) | A | `<IP reservado>` |

Confira antes de seguir: `getent hosts piloto.moriah.app`.

## 3. Conferir o provisionamento

```bash
# DENTRO da VPS (via ssh deploy@<IP>, usando a chave)
cd /opt/moriah_app   # depois de copiar o repositório
./scripts/verificar-vps-piloto.sh --local

# DA SUA MAQUINA, de fora
./scripts/verificar-vps-piloto.sh --dominio piloto.moriah.app --ip <IP reservado>
```

O script testa exatamente os critérios de infraestrutura da Fase 2 e sai com
código != 0 enquanto houver falha: DNS, certificado, redirect HTTP→HTTPS, SSH
sem root e sem senha, 22/80/443 abertas, 5432 e 8000 fechadas de fora, `/health/`
respondendo sem vazar detalhe, ufw ativo, rotação de log, fail2ban,
unattended-upgrades, swap, usuário de deploy e serviço no boot.

## 4. O detalhe do firewall da OCI (por que o cloud-init desliga o iptables)

As imagens Ubuntu da OCI trazem regras de iptables que bloqueiam o tráfego de
entrada, e o `netfilter-persistent` as reaplica a cada boot. Sem tratamento, o
clássico acontece: a porta 443 aparece liberada na NSG, o `ufw` diz que permite,
e nada responde.

O `deploy/cloud-init.yaml` resolve na ordem: desabilita `netfilter-persistent`,
limpa as regras, e deixa o **ufw** como dono do firewall (80, 443 e 22 restrito
ao IP administrativo). O verificador confere se sobrou alguma regra `REJECT` da
imagem.

**Portas abertas — documentação exigida pelo plano:**

| Porta | Origem | Motivo | Como conferir |
| --- | --- | --- | --- |
| 22/tcp | IP administrativo | operação e deploy | `ufw status` na VPS |
| 80/tcp | qualquer | redirect para HTTPS | `curl -I http://<dominio>` |
| 443/tcp | qualquer | app, admin e `/health/` | `curl -I https://<dominio>` |
| 5432/tcp | ninguém | banco é gerenciado (Neon) | `./scripts/verificar-vps-piloto.sh --dominio ...` |
| 8000/tcp | ninguém | gunicorn preso em `127.0.0.1`, sai pelo proxy | idem |

## 5. Logs, backup e monitoramento mínimo

- **Logs:** `journald` limitado a 200 MB e containers com `json-file` 10 MB × 5
  (cloud-init + `docker-compose.pilot.yml`). Em caso de incidente:
  `journalctl -u moriah-piloto -n 200` e
  `docker compose -f docker-compose.pilot.yml --env-file .env.pilot logs backend`.
- **Backup:** cron diário do §1 do `docs/runbook-backup-restore.md`, com
  `BACKUP_ALERT_WEBHOOK` apontando para o canal que você realmente olha.
- **Vigia do backup:** alerta quando `ultimo-backup-ok.txt` passar de 26 h
  (receita no mesmo runbook) — o backup que para em silêncio é o pior caso.
- **Monitor externo:** um checador de `https://<dominio>/health/ready/` a cada
  5 min (Uptime Kuma numa máquina separada, ou cron + webhook). `/health/ready/`
  devolve 503 quando o banco cai, então serve de alarme de banco também.
- **Boot:** `systemctl status moriah-piloto` deve estar `enabled`; ele sobe a
  stack sem migrar schema.

## 6. O que não fazer nesta fase

- não abrir 5432 na NSG "para testar" (nem por SSH tunnel persistente);
- não publicar a 8000 — o gunicorn fica em `127.0.0.1` e quem fala com a
  internet é o proxy;
- não operar a aplicação como root: `deploy` + grupo `docker`, com `sudo`
  para administração;
- não versionar `.env.pilot` nem copiá-lo para o notebook;
- não rodar `seed_mvp` no piloto (dados de demonstração não são dados de piloto).

## 7. Alternativa: AWS em vez de Oracle

Você já tem o AWS CLI configurado nesta máquina. O pacote desta fase é
independente de provedor (cloud-init, unit do systemd, verificador); só muda a
criação da VM e as regras de rede: **EC2 Ubuntu 24.04** + *Security Group*
(22 do IP administrativo, 80, 443) + *Elastic IP* associado. O custo, porém, não
é always-free como na Oracle. Se quiser seguir por aí, é trocar o passo 1 — o
resto do runbook continua valendo.
