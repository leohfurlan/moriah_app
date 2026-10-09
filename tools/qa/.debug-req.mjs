// Depuracao desktop: loga TODA requisicao/resposta do deep link /content/1.
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao, VIEWPORT_DESKTOP } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP, mobile: false });
const { context, page } = session;
const conteudo = (id, status = "published") => ({ id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`, status, author_name: "Equipe Moriah", published_at: status === "published" ? "2026-09-01T00:00:00Z" : null, can_manage: true });
let rows = [conteudo(1), conteudo(2)];
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
const ehApi = (u) => /^\/(api|backend|local-api)\//.test(new NodeURL(u).pathname);
page.on("request", (r) => { if (ehApi(r.url())) console.log("  >REQ", r.method(), new NodeURL(r.url()).pathname); });
page.on("response", (r) => { if (ehApi(r.url())) console.log("  <RES", r.status(), new NodeURL(r.url()).pathname); });
page.on("pageerror", (e) => console.log("  [!] pageerror:", e.message));
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const endpoint = new NodeURL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
  const metodo = route.request().method();
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (endpoint === "/me/") return send({ id: 20, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "pastor", roles: ["pastor"], church: 1, member_id: null, has_member_profile: false, capabilities: ["manage_content"], can_access_management: true });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/content/" && metodo === "GET") return send(rows);
  const m = endpoint.match(/^\/content\/(\d+)\/(publish\/|unpublish\/)?$/);
  if (m) return send(rows.find((r) => r.id === Number(m[1])) || { detail: "x" }, 404);
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  console.log("  [mock] NAO ESPERADO:", metodo, endpoint);
  return send({ detail: "nao esperado" }, 404);
});

console.log("=== deep link /content/1 (desktop) ===");
await page.goto(`${BASE}/content/1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  body: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
}));
console.log("  texto:", info.body);
await browser.close();