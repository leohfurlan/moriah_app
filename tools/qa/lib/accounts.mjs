// Contas de demonstracao lidas DIRETO do seed do backend.
//
// Nunca copie e-mail/senha do output de ferramenta para o codigo: no Windows as
// sequencias de digitos vem mascaradas no print, e o literal sai corrompido.
// Aqui o proprio script extrai as credenciais do arquivo do seed.
import fs from "node:fs";

const SEED_PADRAO = "backend/apps/accounts/management/commands/seed_mvp.py";

/** Mapa { email: senha } extraido do seed (o primeiro set_password de cada e-mail vale). */
export function carregarCredenciais(seed = process.env.QA_SEED || SEED_PADRAO) {
  if (!fs.existsSync(seed)) throw new Error(`seed nao encontrado em ${seed}`);
  const texto = fs.readFileSync(seed, "utf8");
  const credenciais = {};
  // A janela do regex importa: o e-mail costuma estar bem acima do set_password.
  const re = /"([^"@\s]+@[^"\s]+)"[\s\S]{0,1200}?set_password\("([^"]+)"\)/g;
  for (const m of texto.matchAll(re)) {
    if (!credenciais[m[1]]) credenciais[m[1]] = m[2];
  }
  if (!Object.keys(credenciais).length) {
    throw new Error(`nenhuma credencial encontrada em ${seed}; o seed mudou de formato?`);
  }
  return credenciais;
}

/** Conta { email, password } para um prefixo do e-mail demo (ex.: "membro", "admin"). */
export function conta(prefixo, seed = process.env.QA_SEED || SEED_PADRAO) {
  const credenciais = carregarCredenciais(seed);
  const email = Object.keys(credenciais).find((e) => e.startsWith(prefixo));
  if (!email) {
    throw new Error(
      `conta demo "${prefixo}" nao existe no seed; disponiveis: ${Object.keys(credenciais).join(", ")}`,
    );
  }
  return { email, password: credenciais[email] };
}

/** Papeis do seed que os checks costumam usar. */
export const PAPEIS = {
  membro: "membro",
  admin: "admin",
  tesouraria: "tesouraria",
  lider: "lider",
};
