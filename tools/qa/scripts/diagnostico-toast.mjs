// Diagnostico rapido: o toast aparece e por quanto tempo?
//   node tools/qa/scripts/diagnostico-toast.mjs
import { conta, PAPEIS } from "../lib/accounts.mjs";
import { BASE, login, novaSessao } from "../lib/harness.mjs";
import { abrirNavegador } from "../lib/pw.mjs";

const browser = await abrirNavegador();
const sessao = await novaSessao(browser);
const acesso = await login(sessao.page, conta(PAPEIS.membro));
console.log("login:", JSON.stringify(acesso));
await sessao.page.goto(`${BASE}/schedule-create`, { waitUntil: "domcontentloaded" });

for (let passo = 0; passo < 14; passo += 1) {
  const amostra = await sessao.page.evaluate(() => ({
    url: new URL(location.href).pathname,
    testids: [...document.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid")),
    alerts: [...document.querySelectorAll('[role="alert"]')].map((el) => (el.innerText || "").slice(0, 90)),
    temPermissao: /permiss|Acesso restrito/i.test(document.body.innerText || ""),
  }));
  console.log(`t=${(passo * 0.5).toFixed(1)}s`, JSON.stringify(amostra));
  await sessao.page.waitForTimeout(500);
}
console.log("console do app:", JSON.stringify(sessao.console.slice(-8)));
await browser.close();
