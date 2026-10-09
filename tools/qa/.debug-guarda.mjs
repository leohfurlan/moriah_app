// Depuracao: sub-rota de area de gestao (/content/<id>) passa pela guarda?
// E: o logout por 401 com refresh recusado volta para "/" ?
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: { width: 1440, height: 1024 }, mobile: false });
const { context, page } = session;
let sem401 = false;
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const endpoint = new NodeURL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (endpoint === "/me/") return send({ id: 10, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "member", roles: ["member"], church: 1, member_id: null, has_member_profile: false, capabilities: [], can_access_management: false });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/auth/refresh/") return send({ detail: "Sessão expirada" }, 401);
  if (endpoint === "/content/1/") return send(sem401 ? { detail: "Expirado" } : { id: 1, title: "Palavra 1", summary: "", body: "Mensagem 1", status: "published", author_name: "Equipe", published_at: "2026-09-01T00:00:00Z", can_manage: false }, sem401 ? 401 : 200);
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  return send({ detail: "nao esperado" }, 404);
});
page.on("pageerror", (e) => console.log("   [pageerror]", e.message));

console.log("=== A) /content/1 SEM capacidade (a guarda deveria barrar) ===");
await page.goto(`${BASE}/content/1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("  url final:", page.url());
console.log("  tokens:", await page.evaluate(() => [localStorage.getItem("moriah_access_token"), localStorage.getItem("moriah_refresh_token")]));
console.log("  texto:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 240));

console.log("=== B) 401 no detalhe com refresh recusado (deveria encerrar sessao) ===");
sem401 = true;
await page.goto(`${BASE}/content/1`, { waitUntil: "domcontentloaded" });
for (const espera of [1500, 3000, 5000, 8000]) {
  await page.waitForTimeout(espera === 1500 ? 1500 : 1500);
  console.log(`  +${espera}ms url=${page.url()} tokens=${await page.evaluate(() => localStorage.getItem("moriah_access_token"))}`);
}
console.log("  texto:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 240));
await browser.close();