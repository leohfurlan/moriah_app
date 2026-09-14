# Roteiro de treinamento operacional — Moriah App

**Público:** secretaria, tesouraria e líderes de célula
**Duração da sessão prática:** 1 hora
**Pré-requisito:** cada pessoa já com usuário criado e senha própria

---

## 1. Antes de começar

| Perfil | Onde trabalha | O que acessa |
|---|---|---|
| Secretaria | Painel web (Django Admin) | Membros, famílias, células, eventos |
| Tesouraria | Painel web (Django Admin) | Contribuições e comprovantes |
| Líder de célula | App no celular | Membros da própria célula e reuniões |
| Pastor | Painel web (Django Admin) | Visão geral + trilha de auditoria |

- **Endereço do painel:** `https://<servidor>/admin`
- **Cada pessoa usa o próprio login.** Nunca compartilhe senha: toda alteração de membro ou contribuição fica registrada com o nome de quem fez, e uma senha compartilhada destrói essa rastreabilidade.
- Se o menu aparecer vazio ao entrar, o perfil ainda não foi sincronizado — avise o responsável técnico para rodar `python manage.py sync_role_permissions`.

---

## 2. Tesouraria — validar um comprovante

Este é o fluxo mais importante do sistema: é ele que tira os comprovantes do WhatsApp.

1. No painel, abra **Financeiro → Contribuições**.
2. Use o filtro lateral **Status → Pendente** para ver só o que aguarda validação.
3. Clique na contribuição. Confira:
   - valor informado pelo membro,
   - data,
   - categoria (dízimo, oferta, campanha, missões, evento, outros),
   - o comprovante anexado, no bloco de anexos ao final da página.
4. Bata o comprovante contra o extrato bancário.
5. Altere o campo **Status**:
   - **Aprovada** — confere com o extrato;
   - **Precisa Revisão** — algo não bate (valor divergente, comprovante ilegível);
   - **Rejeitada** — não é uma contribuição válida.
6. Preencha **Revisado por** com o seu usuário e **Revisado em** com a data.
7. Clique em **Salvar**.

O membro passa a ver o novo status no extrato dentro do app, sem ninguém precisar avisar por mensagem.

> **Nunca** apague uma contribuição para "corrigir". Use *Rejeitada* ou *Precisa Revisão* — apagar remove o histórico e o membro fica sem explicação.

---

## 3. Secretaria — cadastrar um membro

1. **Membros → Membros → Adicionar membro**.
2. Campos mínimos: igreja, nome completo, telefone, situação.
3. Vincule à **célula** quando a pessoa já estiver em uma.
4. Para vincular familiares, cadastre primeiro a **Família** e depois use os relacionamentos no cadastro do membro.
5. Situação do membro:
   - **Ativo** — membro efetivo;
   - **Visitante** — ainda não é membro;
   - **Inativo / Transferido / Falecido** — mantêm o histórico sem aparecer nas listas ativas.

Para que a pessoa use o app, ela também precisa de um **usuário** (Contas → Usuários) com o mesmo e-mail, vinculado ao cadastro de membro.

### Cadastrar célula e evento

- **Células → Adicionar**: nome, líder, dia, horário e local.
- **Eventos → Adicionar**: nome, tipo (culto, ensaio, reunião...), data/hora e local. O evento é a base para montar escalas.

---

## 4. Líder de célula — registrar a reunião

O líder **não usa o painel web**: faz tudo pelo app.

1. Entrar no app com e-mail e senha.
2. Acessar a lista de membros da célula.
3. Registrar a reunião: data, presentes, número de visitantes e observações.

O líder vê apenas os membros da própria célula, e **não** tem acesso a nenhum dado financeiro — isso é uma regra do sistema, não uma configuração que possa ser afrouxada caso a caso.

---

## 5. Regras de privacidade que valem para todos

- Valor de contribuição individual é **dado restrito**. Não comente, não repasse em grupo, não imprima lista.
- A secretaria não enxerga contribuições — isso é intencional, não é falta de permissão a corrigir.
- Não existe e não deve existir ranking de dizimistas.
- Toda alteração em membro, contribuição e escala fica registrada na trilha de auditoria com nome e horário.

---

## 6. Roteiro da sessão de 1 hora

| Tempo | Atividade |
|---|---|
| 0–10 min | Por que o sistema existe: sair do WhatsApp e das planilhas |
| 10–20 min | Login de cada pessoa e passeio pelo painel |
| 20–35 min | **Tesouraria:** validar 2 comprovantes de teste do início ao fim |
| 35–50 min | **Secretaria:** cadastrar 1 membro, 1 família e 1 célula |
| 50–60 min | Privacidade, dúvidas e a quem pedir ajuda |

Use dados de teste nesta sessão. Só depois de todo mundo ter feito o fluxo uma vez é que se começa com dados reais.

---

## 7. Dúvidas frequentes

**Errei o status de uma contribuição. E agora?**
Basta alterar de novo e salvar. As duas mudanças ficam registradas na auditoria — nada é perdido.

**O membro diz que enviou o comprovante e ele não aparece.**
Confira o filtro de status: se ele foi enviado hoje, está em *Pendente*. Confira também se você está olhando a igreja certa.

**O membro não consegue entrar no app.**
Verifique em Contas → Usuários se existe usuário com aquele e-mail e se ele está ativo.

**Posso apagar um membro que saiu da igreja?**
Não. Mude a situação para *Transferido* ou *Inativo*. Apagar destrói o histórico de contribuições e de células.
