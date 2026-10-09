// Depuracao: o que existe na tela do detalhe /content/1 e por que some?
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: { width: 1440, height: 1024 }, mobile: false });
const { context, page } = session;
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const endpoint = new NodeURL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (endpoint === "/me/") return send({ id: 20, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "pastor", roles: ["pastor"], church: 1, member_id: null, has_member_profile: false, capabilities: ["manage_content"], can_access_management: true });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/content/1/") return send({ id: 1, title: "Palavra 1", summary: "", body: "Mensagem 1", status: "draft", author_name: "Equipe Moriah", published_at: null, can_manage: true });
  if (endpoint === "/content/") return send([{ id: 1, title: "Palavra 1", summary: "Resumo", body: "Mensagem 1", status: "draft", author_name: "Equipe Moriah", published_at: null, can_manage: true }]);
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  return send({ detail: "nao esperado" }, 404);
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

console.log("=== goto /content/1 (gestor, rascunho) ===");
await page.goto(`${BASE}/content/1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("  url:", page.url());
const dump = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = (el.textContent || "").trim();
    if (!t || !/Palavra 1|Mensagem 1|Equipe Moriah|Publicar/.test(t)) continue;
    let oculto = false; let n = el;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") { oculto = true; break; }
      n = n.parentElement;
    }
    out.push({ tag: el.tagName, texto: t.slice(0, 60), oculto, role: el.getAttribute("role") });
  }
  const botoes = [...document.querySelectorAll("[role=button],button")].map((b) => (b.textContent || "").trim()).filter(Boolean);
  return { elementos: out, botoes };
});
console.log("  elementos:", JSON.stringify(dump.elementos, null, 1));
console.log("  botoes:", JSON.stringify(dump.botoes));
await page.screenshot({ path: "output/playwright/debug-detalhe.png", fullPage: true });
await browser.close();