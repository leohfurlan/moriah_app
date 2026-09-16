// Resolve o Playwright e o Chromium que JA existem na maquina (cache do npx e
// ms-playwright), para o verificador rodar sem instalar dependencia no projeto.
//
// Armadilha conhecida: NODE_PATH nao vale para ESM — a importacao precisa ser
// feita por URL absoluta (file:///...).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

function compararVersao(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** Caminho file:/// do pacote playwright instalado no cache do npx (maior versao). */
export function resolverPlaywright(explicito = process.env.PW_ENTRY) {
  if (explicito) return explicito;
  const raiz = path.join(HOME, "AppData", "Local", "npm-cache", "_npx");
  const achados = [];
  if (fs.existsSync(raiz)) {
    for (const hash of fs.readdirSync(raiz)) {
      const pkg = path.join(raiz, hash, "node_modules", "playwright", "package.json");
      if (!fs.existsSync(pkg)) continue;
      let versao = "0.0.0";
      try {
        versao = JSON.parse(fs.readFileSync(pkg, "utf8")).version;
      } catch {
        continue;
      }
      achados.push({
        versao,
        entry: path.join(raiz, hash, "node_modules", "playwright", "index.mjs"),
      });
    }
  }
  if (!achados.length) {
    throw new Error(
      "playwright nao encontrado no cache do npx; rode `npx playwright --version` ou defina PW_ENTRY",
    );
  }
  achados.sort((a, b) => compararVersao(b.versao, a.versao));
  return `file:///${achados[0].entry.replace(/\\/g, "/")}`;
}

/** Executavel do Chrome nos browsers ja baixados (usado so quando PW_CHROME e omitido). */
export function resolverChrome() {
  const raiz = path.join(HOME, "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(raiz)) return undefined;
  const candidatos = [];
  for (const pasta of fs.readdirSync(raiz)) {
    const m = /^chromium-(\d+)$/.exec(pasta);
    if (!m) continue;
    const exe = path.join(raiz, pasta, "chrome-win64", "chrome.exe");
    if (fs.existsSync(exe)) candidatos.push({ rev: Number(m[1]), exe });
  }
  if (!candidatos.length) return undefined;
  candidatos.sort((a, b) => b.rev - a.rev);
  return candidatos[0].exe;
}

/** Carrega o chromium do Playwright disponivel na maquina. */
export async function carregarChromium() {
  const entry = resolverPlaywright();
  const mod = await import(entry);
  return mod.chromium;
}

/** Lanca o chromium (headless por padrao; PW_CHROME permite fixar o executavel). */
export async function abrirNavegador(opcoes = {}) {
  const chromium = await carregarChromium();
  const executablePath = process.env.PW_CHROME || resolverChrome();
  return chromium.launch({ executablePath, headless: true, ...opcoes });
}
