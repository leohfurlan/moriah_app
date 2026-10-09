// Depuracao: por que no desktop a tela de conteudo nao fica "visivel"?
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
for (const [rotulo, viewport, mobile] of [["DESKTOP", { width: 1440, height: 1024 }, false], ["MOBILE", { width: 390, height: 844 }, true]]) {
  const session = await novaSessao(browser, { viewport, mobile });
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
    if (endpoint === "/content/" && route.request().method() === "GET") {
      await new Promise((r) => setTimeout(r, 900));
      return send([{ id: 1, title: "Palavra 1", summary: "Resumo", body: "Mensagem 1", status: "published", author_name: "Equipe Moriah", published_at: "2026-09-01T00:00:00Z", can_manage: true }]);
    }
    if (endpoint === "/content/1/") return send({ id: 1, title: "Palavra 1", summary: "", body: "Mensagem 1", status: "published", author_name: "Equipe Moriah", published_at: "2026-09-01T00:00:00Z", can_manage: true });
    if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
    return send({ detail: "nao esperado" }, 404);
  });

  console.log(`\n===== ${rotulo} =====`);
  await page.goto(`${BASE}/content`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  console.log("  loading visivel?", await page.getByText("Carregando conteúdo...", { exact: true }).isVisible().catch((e) => `erro: ${e.message}`));
  await page.waitForTimeout(2000);
  console.log("  url:", page.url());
  const infos = await page.evaluate(() => {
    const alvos = ["Carregando conteúdo...", "Palavra 1", "Nenhum conteúdo publicado ainda."];
    const out = [];
    for (const t of alvos) {
      for (const el of document.querySelectorAll("*")) {
        if (el.children.length === 0 && (el.textContent || "").trim() === t) {
          let oculto = false; let n = el;
          while (n && n !== document.body) {
            const cs = getComputedStyle(n);
            if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) { oculto = true; break; }
            n = n.parentElement;
          }
          out.push({ texto: t, oculto, tag: el.tagName });
        }
      }
    }
    return out;
  });
  console.log("  elementos:", JSON.stringify(infos));
  await page.screenshot({ path: `output/playwright/debug-${rotulo.toLowerCase()}.png` });
  await context.close();
}
await browser.close();