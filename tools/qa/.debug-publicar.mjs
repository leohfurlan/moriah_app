// Depuracao: replica o fluxo que falha (gestor cria rascunho -> publica).
import { URL as NodeURL } from "node:url";
import { BASE, digitar, novaSessao, VIEWPORT_DESKTOP } from "./lib/harness.mjs";
import { abrirNavegador } from "./lib/pw.mjs";

const browser = await abrirNavegador();
const session = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP, mobile: false });
const { context, page } = session;
page.setDefaultTimeout(6000);
await context.addInitScript(() => {
  localStorage.setItem("moriah_access_token", "qa");
  localStorage.setItem("moriah_refresh_token", "qa");
});
let saveStatus = 200;
let rows = [];
const gestor = true;
const conteudo = (id, status = "published", extra = {}) => ({
  id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`, status, author_name: "Equipe Moriah",
  published_at: status === "published" ? new Date().toISOString() : null, can_manage: gestor, ...extra,
});
rows = [conteudo(1), conteudo(2)];
await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
  const url = new NodeURL(route.request().url());
  const endpoint = url.pathname.replace(/^\/(api|backend|local-api)/, "");
  const metodo = route.request().method();
  const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  console.log("   [mock]", metodo, endpoint);
  if (endpoint === "/me/") return send({ id: 20, email: "qa@x.invalid", first_name: "Maria", last_name: "Silva", role: "pastor", roles: ["pastor"], church: 1, member_id: null, has_member_profile: false, capabilities: ["manage_content"], can_access_management: true });
  if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
  if (endpoint === "/me/notifications/") return send([]);
  if (endpoint === "/content/" && metodo === "POST") {
    if (saveStatus !== 200) return send({ title: ["Este campo é obrigatório."] }, saveStatus);
    const obj = conteudo(rows.length + 1, "draft", { ...route.request().postDataJSON(), summary: "" });
    rows.push(obj);
    console.log("      -> criado id", obj.id, "status", obj.status);
    return send(obj, 201);
  }
  if (endpoint === "/content/") return send(rows);
  const match = endpoint.match(/^\/content\/(\d+)\/(publish\/|unpublish\/)?$/);
  if (match) {
    const obj = rows.find((r) => r.id === Number(match[1]));
    if (!obj) return send({ detail: "Não encontrado" }, 404);
    if (metodo === "GET") return send(obj);
    if (metodo === "PATCH") { Object.assign(obj, route.request().postDataJSON()); return send(obj); }
    if (match[2] === "publish/") { obj.status = "published"; obj.published_at = new Date().toISOString(); return send(obj); }
    if (match[2] === "unpublish/") { obj.status = "draft"; obj.published_at = null; return send(obj); }
  }
  if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
  return send({ detail: "nao esperado" }, 404);
});
page.on("pageerror", (e) => console.log("   [pageerror]", e.message));

const ir = (c) => page.goto(`${BASE}${c}`, { waitUntil: "domcontentloaded" });
const dump = async (rotulo, extra = "") => {
  const botoes = await page.evaluate(() => [...document.querySelectorAll("[role=button],button")].map((b) => (b.textContent || "").trim()).filter(Boolean));
  console.log(`  [${rotulo}] url=${page.url()} ${extra}`);
  console.log(`  [${rotulo}] botoes=${JSON.stringify(botoes)}`);
};

console.log("--- passo 1: lista e abrir editor ---");
await ir("/content");
await page.getByText("Palavra 1", { exact: true }).waitFor();
await page.getByRole("button", { name: "+ Nova palavra", exact: true }).click();
const salvar = page.getByRole("button", { name: "Salvar rascunho", exact: true });
await digitar(page.getByPlaceholder("Título"), "Nova palavra");
await digitar(page.getByPlaceholder("Comece a escrever sua palavra\u2026"), "Texto persistente");
saveStatus = 422;
await salvar.click();
await page.getByRole("alert").waitFor();
await dump("apos 422", `rows=${rows.length}`);
saveStatus = 200;
await salvar.click();
await page.getByText("Texto persistente", { exact: true }).waitFor();
await dump("apos salvar", `rows=${rows.length} status=${rows.at(-1)?.status}`);

console.log("--- passo 2: publicar (o teste falha aqui) ---");
const rascunho = rows.find((r) => r.status === "draft");
console.log("  rascunho id:", rascunho?.id);
await ir(`/content/${rascunho.id}`);
await page.waitForTimeout(2500);
await dump("detalhe do rascunho");
await page.screenshot({ path: "output/playwright/debug-publicar.png", fullPage: true });
await browser.close();