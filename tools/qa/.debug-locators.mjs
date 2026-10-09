// Depuracao: como excluir os nos ocultos que o react-native-web deixa montados?
// Compara .first() (pega oculto) com filtro por visibilidade real.
import { URL as NodeURL } from "node:url";
import { BASE, novaSessao, VIEWPORT_DESKTOP } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP, mobile: false });
const { context, page } = session;
const conteudo = (id, status = "published") => ({ id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`, status, author_name: "Equipe Moriah", published_at: "2026-09-01T00:00:00Z", can_manage: true });
let rows = [conteudo(1), conteudo(2)];
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const endpoint = new NodeURL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
  const metodo = route.request().method();
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (endpoint === "/me/") return send({ id: 20, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "pastor", roles: ["pastor"], church: 1, member_id: null, has_member_profile: false, capabilities: ["manage_content"], can_access_management: true });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/content/" && metodo === "GET") return send(rows);
  const m = endpoint.match(/^\/content\/(\d+)\/(publish\/|unpublish\/)?$/);
  if (m) {
    const obj = rows.find((r) => r.id === Number(m[1]));
    if (!obj) return send({ detail: "x" }, 404);
    if (metodo === "GET") return send(obj);
    if (m[2] === "publish/") { obj.status = "published"; return send(obj); }
  }
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  return send({ detail: "nao esperado" }, 404);
});

await page.goto(`${BASE}/content`, { waitUntil: "domcontentloaded" });
await page.getByText("Palavra 1", { exact: true }).first().waitFor();
console.log("--- estado da lista ---");
console.log("  total Palavra 1:", await page.getByText("Palavra 1", { exact: true }).count());
console.log("  visible Palavra 1:", await page.getByText("Palavra 1", { exact: true }).locator("visible=true").count());

// Navega para o detalhe por clique
await page.getByText("Palavra 1", { exact: true }).locator("visible=true").first().click();
await page.waitForTimeout(1500);
console.log("--- estado do detalhe (path " + new URL(page.url()).pathname + ") ---");
for (const [rotulo, loc] of [
  ["body 'Mensagem 1' todos", page.getByText("Mensagem 1", { exact: true })],
  ["body 'Mensagem 1' visible", page.getByText("Mensagem 1", { exact: true }).locator("visible=true")],
  ["'Por Equipe Moriah' visible", page.getByText("Por Equipe Moriah", { exact: false }).locator("visible=true")],
  ["'Palavra 1' exact visible", page.getByText("Palavra 1", { exact: true }).locator("visible=true")],
  ["botao Publicar visible", page.getByRole("button", { name: "Publicar conteúdo", exact: true }).locator("visible=true")],
  ["botao Editar visible", page.getByRole("button", { name: "Editar", exact: true }).locator("visible=true")],
]) {
  console.log(`  ${rotulo}: ${await loc.count()}`);
}
await browser.close();