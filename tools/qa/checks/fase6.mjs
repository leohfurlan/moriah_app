import assert from "node:assert/strict";
import { BASE, digitar, novaSessao, VIEWPORT_MOBILE, VIEWPORT_DESKTOP } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-6-conteudo", { dir });
  v.nota("API simulada; regras e isolamento reais são verificados em apps/content/tests.");
  for (const mobile of [true, false]) {
    const session = await novaSessao(browser, { viewport: mobile ? VIEWPORT_MOBILE : VIEWPORT_DESKTOP, mobile });
    const { context, page } = session;
    page.setDefaultTimeout(10000);
    await context.addInitScript(() => {
      localStorage.setItem("moriah_access_token", "qa-content");
      localStorage.setItem("moriah_refresh_token", "qa-content");
    });
    let publisher = false;
    let linked = true;
    let listStatus = 200;
    let detailStatus = 200;
    let publishStatus = 200;
    let saveStatus = 200;
    let delayList = 0;
    let rows = [];
    const unexpected = [];
    await context.route(url => /^\/(api|backend|local-api)\//.test(url.pathname), async route => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname.replace(/^\/(api|backend|local-api)/, "");
      const method = route.request().method();
      const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (endpoint === "/me/") return send({ id: publisher ? 20 : 10, email: "qa@content.invalid", first_name: "Maria", last_name: "Silva", role: publisher ? "pastor" : "member", roles: [publisher ? "pastor" : "member"], church: 1, member_id: linked ? 10 : null, has_member_profile: linked, capabilities: publisher ? ["read_content", "manage_content", "manage_pastoral"] : linked ? ["member", "read_content"] : [], can_access_management: publisher });
      if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
      if (endpoint === "/me/notifications/") return send([]);
      if (endpoint === "/auth/refresh/") return send({ detail: "Sessão expirada" }, 401);
      if (endpoint === "/content/" && method === "GET") {
        if (delayList) await new Promise(resolve => setTimeout(resolve, delayList));
        if (listStatus !== 200) return send({ detail: "Falha de conteúdo" }, listStatus);
        const visible = rows.filter(row => publisher || row.status === "published");
        const pageNumber = Number(url.searchParams.get("page") || 1);
        return send({ count: visible.length, results: visible.slice(pageNumber - 1, pageNumber), next: pageNumber < visible.length ? "next" : null, previous: pageNumber > 1 ? "prev" : null });
      }
      if (endpoint === "/content/" && method === "POST") {
        if (saveStatus !== 200) return send({ title: ["Título inválido"] }, saveStatus);
        const obj = { ...route.request().postDataJSON(), id: rows.length + 1, status: "draft", published_at: null };
        rows.push(obj); return send(obj, 201);
      }
      const match = endpoint.match(/^\/content\/(\d+)\/(publish\/|unpublish\/)?$/);
      if (match) {
        const obj = rows.find(row => row.id === Number(match[1]));
        if (method === "GET" && detailStatus !== 200) return send({ detail: "Detalhe indisponível" }, detailStatus);
        if (!obj || (!publisher && obj.status !== "published")) return send({ detail: "Não encontrado" }, 404);
        if (method === "GET") return send(obj);
        if (!publisher) return send({ detail: "Sem permissão" }, 403);
        if (method === "PATCH") { Object.assign(obj, route.request().postDataJSON()); return send(obj); }
        if (match[2] === "publish/") {
          if (publishStatus !== 200) return send({ detail: "Publicação indisponível" }, publishStatus);
          obj.status = "published"; obj.published_at = new Date().toISOString(); return send(obj);
        }
        if (match[2] === "unpublish/") { obj.status = "draft"; obj.published_at = null; return send(obj); }
      }
      // Home appears only when the route guard denies content.
      if (["/me/schedules/", "/me/statement/", "/me/events/"].includes(endpoint)) return send([]);
      unexpected.push(`${method} ${endpoint}`);
      return send({ detail: "Endpoint inesperado" }, 404);
    });
    const go = path => page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const check = async (name, callback) => {
      try { await callback(); v.check(`${mobile ? "Mobile" : "Desktop"}: ${name}`, true); }
      catch (error) { v.check(`${mobile ? "Mobile" : "Desktop"}: ${name}`, false, error.message); }
    };
    try {
      await check("carregamento, vazio e aba selecionada", async () => {
        delayList = 350;
        await go("/content");
        await page.getByText("Carregando conteúdo…", { exact: true }).waitFor();
        await page.getByText("Nenhum conteúdo disponível.", { exact: true }).waitFor();
        const link = page.getByRole("link", { name: "Conteúdo", exact: true });
        const activeBackground = await link.evaluate(element => getComputedStyle(element).backgroundColor);
        const labels = mobile ? ["Início", "Agenda", "Conteúdo", "Perfil"] : ["Visão geral", "Agenda", "Conteúdo", "Escalas", "Meu extrato"];
        const highlighted = await page.getByRole("link").evaluateAll((elements, names) => elements.filter(element => names.includes(element.getAttribute("aria-label")) && getComputedStyle(element).backgroundColor !== "rgba(0, 0, 0, 0)").map(element => element.getAttribute("aria-label")), labels);
        assert.deepEqual(highlighted, ["Conteúdo"]);
        assert.equal(await page.getByRole("button", { name: "Novo conteúdo", exact: true }).count(), 0);
        delayList = 0;
        await go("/notifications"); await page.getByRole("link", { name: "Conteúdo", exact: true }).waitFor();
        const inactiveBackground = await page.getByRole("link", { name: "Conteúdo", exact: true }).evaluate(element => getComputedStyle(element).backgroundColor);
        assert.notEqual(activeBackground, inactiveBackground);
      });
      await check("erro de lista não vira vazio e retry recupera", async () => {
        listStatus = 503; await go("/content");
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
        assert.equal(await page.getByText("Nenhum conteúdo disponível.", { exact: true }).count(), 0);
        listStatus = 200; await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByText("Nenhum conteúdo disponível.", { exact: true }).waitFor();
      });
      rows = [1, 2].map(id => ({ id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`, status: "published", published_at: new Date().toISOString() }));
      await check("paginação, detalhe e reload preservam conteúdo", async () => {
        await go("/content"); await page.getByText("Palavra 1", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Próxima página", exact: true }).click();
        await page.getByText("Palavra 2", { exact: true }).click();
        await page.getByText("Mensagem 2", { exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, "/content/2");
        await page.reload(); await page.getByText("Mensagem 2", { exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Retirar do ar", exact: true }).count(), 0);
      });
      await check("404 e 403 de detalhe têm erro e retry", async () => {
        for (const status of [404, 403]) {
          detailStatus = status; await go("/content/2");
          await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
          assert.equal(await page.getByText("Mensagem 2", { exact: true }).count(), 0);
        }
        detailStatus = 200; await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByText("Mensagem 2", { exact: true }).waitFor();
      });
      publisher = true; linked = false;
      await check("pastor sem membro cria e edita rascunho", async () => {
        await go("/content"); await page.getByRole("button", { name: "Novo conteúdo", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Salvar rascunho", exact: true }).getAttribute("aria-disabled"), "true");
        await digitar(page.getByRole("textbox", { name: "Título do conteúdo", exact: true }), "Nova palavra");
        await digitar(page.getByRole("textbox", { name: "Texto do conteúdo", exact: true }), "Texto persistente");
        saveStatus = 422;
        await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(rows.length, 2);
        assert.equal(await page.getByRole("textbox", { name: "Título do conteúdo", exact: true }).inputValue(), "Nova palavra");
        saveStatus = 200;
        await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
        await page.getByRole("button", { name: "Editar rascunho", exact: true }).waitFor();
        assert.equal(rows[2].status, "draft");
        await page.getByRole("button", { name: "Editar rascunho", exact: true }).click();
        await digitar(page.getByRole("textbox", { name: "Resumo do conteúdo", exact: true }), "Resumo editado");
        await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
        await page.getByText("Resumo editado", { exact: true }).waitFor();
      });
      await check("publicação falha sem falso sucesso, retry publica e retirada persiste", async () => {
        publishStatus = 503; await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).click();
        await page.getByRole("alert").waitFor(); assert.equal(rows[2].status, "draft");
        publishStatus = 200; await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).click();
        await page.getByRole("button", { name: "Retirar do ar", exact: true }).waitFor();
        await page.reload(); await page.getByRole("button", { name: "Retirar do ar", exact: true }).click();
        await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).waitFor();
        await page.reload(); await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).waitFor();
        assert.equal(rows[2].status, "draft");
      });
      await v.screenshot(page, mobile ? "conteudo-mobile" : "conteudo-desktop");
      publisher = false; linked = true;
      await check("membro não acessa rascunho por URL", async () => {
        await go("/content/3"); await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
        assert.equal(await page.getByText("Texto persistente", { exact: true }).count(), 0);
      });
      linked = false;
      await check("conta sem capacidade não acessa lista ou deep link", async () => {
        for (const path of ["/content", "/content/1"]) {
          await go(path); await page.waitForURL("**/home");
          assert.equal(await page.getByRole("link", { name: "Conteúdo", exact: true }).count(), 0);
        }
      });
      await check("401 com refresh recusado encerra sessão sem expor conteúdo", async () => {
        linked = true; detailStatus = 401;
        await go("/content/1");
        await page.waitForURL(`${BASE}/`);
        assert.equal(await page.getByText("Mensagem 1", { exact: true }).count(), 0);
      });
      v.check(`${mobile ? "Mobile" : "Desktop"}: sem exceções JS ou endpoints inesperados`, session.pageerrors.length === 0 && unexpected.length === 0, [...session.pageerrors, ...unexpected].join(" | "));
    } finally { await context.close(); }
  }
  return v;
}
