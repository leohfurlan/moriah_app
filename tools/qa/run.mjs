#!/usr/bin/env node
// Runner do verificador QA por fase.
//
//   node tools/qa/run.mjs fase1        # confiabilidade P0 (plano, secao 6)
//   node tools/qa/run.mjs fase2        # navegacao e menu
//   node tools/qa/run.mjs fase4        # gestao de escalas (coordenacao x membro)
//   node tools/qa/run.mjs todas        # todas as fases
//
// Cada fase grava evidencias em docs/qa/evidencias/<fase>-<carimbo>/:
// resultados.json, resumo.md e shots/*.png.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BASE } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";
import { carimbo } from "./lib/report.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, "..", "..");
process.chdir(RAIZ); // o seed e os caminhos relativos contam da raiz do repo

const FASES = {
  fase1: () => import("./checks/fase1.mjs"),
  fase2: () => import("./checks/fase2.mjs"),
  fase3: () => import("./checks/fase3.mjs"),
  fase4: () => import("./checks/fase4.mjs"),
  fase5: () => import("./checks/fase5.mjs"),
  fase6: () => import("./checks/fase6.mjs"),
};

async function servidorResponde(base = BASE) {
  try {
    const resposta = await fetch(base, { signal: AbortSignal.timeout(8000) });
    return resposta.status < 500;
  } catch {
    return false;
  }
}

async function principal() {
  const alvo = (process.argv[2] || "fase1").toLowerCase();
  const pedidas = alvo === "todas" || alvo === "all" ? Object.keys(FASES) : [alvo];
  const invalida = pedidas.find((nome) => !FASES[nome]);
  if (invalida) {
    console.error(`fase desconhecida: ${invalida}. Use: ${Object.keys(FASES).join(", ")}, todas`);
    process.exit(2);
  }
  if (!(await servidorResponde())) {
    console.error(`app nao respondeu em ${BASE}. Suba o Expo web (npm --prefix mobile run web) ou ajuste QA_BASE.`);
    process.exit(3);
  }

  console.log(`Verificador QA | base=${BASE} | fases=${pedidas.join(", ")}\n`);
  const browser = await abrirNavegador();
  const resultados = [];
  try {
    for (const nome of pedidas) {
      const modulo = await FASES[nome]();
      const dir = path.join(RAIZ, nome === "fase5" ? "output/playwright" : "docs/qa/evidencias", `${nome}-${carimbo()}`);
      const verificacao = await modulo.executar({ browser, dir, base: BASE });
      const salvo = verificacao.salvar({ base: BASE, fase: nome, comando: `node tools/qa/run.mjs ${alvo}` });
      resultados.push({ nome, ...salvo, passes: verificacao.passes.length, falhas: verificacao.falhas.length });
      console.log("");
    }
  } finally {
    await browser.close();
  }

  const falhas = resultados.reduce((total, item) => total + item.falhas, 0);
  console.log(`=== ${alvo}: ${falhas === 0 ? "TUDO PASSOU" : `${falhas} FALHA(S)`} ===`);
  for (const item of resultados) {
    console.log(`- ${item.nome}: PASS ${item.passes} | FAIL ${item.falhas} -> ${path.relative(process.cwd(), item.dir).replace(/\\/g, "/")}`);
  }
  process.exit(falhas === 0 ? 0 : 1);
}

principal().catch((erro) => {
  console.error("falha inesperada no verificador:", erro);
  process.exit(1);
});
