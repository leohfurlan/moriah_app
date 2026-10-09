// Depuracao desktop: (1) /content/<id> por deep link mostra o detalhe?
// (2) o estado de carregamento aparece? (3) o detalhe por clique?
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao, VIEWPORT_DESKTOP } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP, mobile: false });
const { context, page } = session;
page.setDefaultTimeout(8000);
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
let delayLista = 0;
const conteudo = (id, status = "published") => ({ id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`, status, author_name: "Equipe Moriah", published_at: status === "published" ? "2026-09-01T00:00:00Z" : null, can_manage: true });
let rows = [conteudo(1), conteudo(2)];
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const endpoint = new NodeURL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
  const metodo = route.request().method();
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (endpoint === "/me/") return send({ id: 20, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "pastor", roles: ["pastor"], church: 1, member_id: null, has_member_profile: false, capabilities: ["manage_content"], can_access_management: true });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/content/" && metodo === "GET") { if (delayLista) await new Promise((r) => setTimeout(r, delayLista)); return send(rows); }
  const m = endpoint.match(/^\/content\/(\d+)\//);
  if (m) return send(rows.find((r) => r.id === Number(m[1])) || { detail: "x" }, 404);
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  return send({ detail: "nao esperado" }, 404);
});
const resumo = async (rotulo) => {
  const info = await page.evaluate(() => ({
    path: location.pathname,
    headerH1: [...document.querySelectorAll("h1,[role=heading]")].map((h) => (h.textContent || "").trim()).slice(0, 4),
    botoes: [...document.querySelectorAll("[role=button],button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 10),
    temDetalhe: /Por Equipe Moriah/.test(document.body.innerText),
    temLista: (document.body.innerText.match(/Palavra 2/g) || []).length > 0,
    carregando: /Carregando conteúdo/.test(document.body.innerText),
    vazio: /Nenhum conteúdo publicado/.test(document.body.innerText),
  }));
  console.log(`  [${rotulo}]`, JSON.stringify(info));
};

console.log("=== 1) deep link /content/1 ===");
await page.goto(`${BASE}/content/1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await resumo("apos 2.5s");
await page.screenshot({ path: "output/playwright/dbg-desktop-deeplink.png", fullPage: false });

console.log("=== 2) estado de carregamento em /content (delay 1200ms) ===");
delayLista = 1200;
await page.goto(`${BASE}/content`, { waitUntil: "domcontentloaded" });
for (const t of [250, 500, 900, 1600]) { await page.waitForTimeout(t === 250 ? 250 : t - 250 <= 0 ? 0 : 0); }
// amostragem manual em instantes
await page.waitForTimeout(0);
await resumo("logo apos goto");
await page.waitForTimeout(4000);
await resumo("4s depois");
delayLista = 0;

console.log("=== 3) detalhe por clique a partir da lista ===");
await page.goto(`${BASE}/content`, { waitUntil: "domcontentloaded" });
await page.getByText("Palavra 1", { exact: true }).first().click();
await page.waitForTimeout(2000);
await resumo("apos clique");
await page.screenshot({ path: "output/playwright/dbg-desktop-clique.png", fullPage: false });
await browser.close();