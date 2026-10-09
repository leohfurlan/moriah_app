# 02: Conclusão com conferência automática

**What to build:** encaminhar autodeclarados membros para revisão humana,
incluindo contas associadas a visitantes, sem atribuir permissões.

**Blocked by:** 01 — Acolhida, perfil obrigatório e retomada.

**Status:** implementado localmente; sem deploy.

- [x] Deduplicação, preservação de vínculo confirmado e retry seguro.
- [x] Conclusão/revisão concorrentes testadas em PostgreSQL.
- [x] Atividades preservadas; colisões sem alteração parcial.
- [x] Nascimento oficial sujeito a revisão.
