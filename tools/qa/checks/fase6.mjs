// Fase 6 — Conteúdo ("Palavras"): regressões de interface com API inteiramente
// simulada (nenhum banco é usado). Portado do branch `codex/moriah-navigation-admin`
// (bf2af12) e reescrito contra o contrato real do HEAD: a tela lista publicados
// para membros, e quem tem `manage_content` cria/edita/publica/retira.
import assert from "node:assert/strict";
import { BASE, digitar, novaSessao, VIEWPORT_MOBILE, VIEWPORT_DESKTOP } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-6-conteudo", { dir });
  v.nota("API simulada; regras de permissão e auditoria reais são verificadas em apps/content/tests.");
  for (const mobile of [true, false]) {
    const session = await novaSessao(browser, { viewport: mobile ? VIEWPORT_MOBILE : VIEWPORT_DESKTOP, mobile });
    const { context, page } = session;
    page.setDefaultTimeout(10000);
    await context.addInitScript(() => {
      localStorage.setItem("moriah_access_token", "qa-content");
      localStorage.setItem("moriah_refresh_token", "qa-content");
    });
    // `gestor` = tem manage_content (admin/pastor). `vinculado` = tem membro.
    let gestor = false;
    let vinculado = true;
    let listStatus = 200;
    let detailStatus = 200;
    let publishStatus = 200;
    let saveStatus = 200;
    let delayLista = 0;
    let rows = [];
    const inesperados = [];
    const depurar = process.env.DEBUG_FASE6 === "1";
    const log = (...args) => { if (depurar) console.log("        [mock]", ...args); };
    const conteudo = (id, status = "published", extra = {}) => ({
      id, title: `Palavra ${id}`, summary: "Resumo", body: `Mensagem ${id}`,
      status, author_name: "Equipe Moriah",
      published_at: status === "published" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      can_manage: gestor, ...extra,
    });
    const capacidades = () => gestor
      ? ["manage_content", "manage_all"]
      : vinculado ? ["member"] : [];

    await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname.replace(/^\/(api|backend|local-api)/, "");
      const metodo = route.request().method();
      const send = (body, statusCode = 200) => route.fulfill({ status: statusCode, contentType: "application/json", body: JSON.stringify(body) });

      if (endpoint === "/me/") return send({
        id: gestor ? 20 : 10, email: "qa@content.invalid", first_name: "Maria", last_name: "Silva",
        role: gestor ? "pastor" : "member", roles: [gestor ? "pastor" : "member"], church: 1,
        member_id: vinculado ? 10 : null, has_member_profile: vinculado,
        capabilities: capacidades(), can_access_management: gestor,
      });
      if (endpoint === "/me/notifications/unread-count/") return send({ count: 0 });
      if (endpoint === "/me/notifications/") return send([]);
      if (endpoint === "/auth/refresh/") return send({ detail: "Sessão expirada" }, 401);

      if (endpoint === "/content/" && metodo === "GET") {
        if (delayLista) await new Promise((resolve) => setTimeout(resolve, delayLista));
        if (listStatus !== 200) return send({ detail: "Falha de conteúdo" }, listStatus);
        // O backend esconde rascunhos de quem não gerencia (ver get_queryset).
        const visiveis = rows.filter((row) => gestor || row.status === "published");
        return send(visiveis);
      }
      if (endpoint === "/content/" && metodo === "POST") {
        if (saveStatus !== 200) return send({ title: ["Este campo é obrigatório."] }, saveStatus);
        const obj = conteudo(rows.length + 1, "draft", { ...route.request().postDataJSON(), summary: "" });
        rows.push(obj);
        return send(obj, 201);
      }
      const match = endpoint.match(/^\/content\/(\d+)\/(publish\/|unpublish\/)?$/);
            if (match) {
              const obj = rows.find((row) => row.id === Number(match[1]));
              log(metodo, endpoint, obj ? `obj#${obj.id} status=${obj.status}` : "OBJ NAO ENCONTRADO", `rows=[${rows.map((r) => r.id)}]`);
              if (!obj) return send({ detail: "Não encontrado" }, 404);
        if (metodo === "GET" && detailStatus !== 200) return send({ detail: "Detalhe indisponível" }, detailStatus);
        // Membro não enxerga rascunho nem pela URL direta.
        if (!gestor && obj.status !== "published") return send({ detail: "Não encontrado" }, 404);
        if (metodo === "GET") return send(obj);
        if (!gestor) return send({ detail: "Sem permissão" }, 403);
        if (metodo === "PATCH") { Object.assign(obj, route.request().postDataJSON(), { can_manage: true }); return send(obj); }
        if (metodo === "DELETE") { rows = rows.filter((row) => row.id !== obj.id); return route.fulfill({ status: 204, body: "" }); }
        if (match[2] === "publish/") {
          if (publishStatus !== 200) return send({ detail: "Publicação indisponível" }, publishStatus);
          obj.status = "published"; obj.published_at = new Date().toISOString(); return send(obj);
        }
        if (match[2] === "unpublish/") { obj.status = "draft"; obj.published_at = null; return send(obj); }
      }

      // Rotas que a guarda usa depois de negar conteúdo (Home).
      if (["/me/schedules/", "/me/statement/", "/me/agenda/", "/me/events/"].includes(endpoint)) return send([]);
      inesperados.push(`${metodo} ${endpoint}`);
      return send({ detail: "Endpoint inesperado" }, 404);
    });

    const ir = (caminho) => page.goto(`${BASE}${caminho}`, { waitUntil: "domcontentloaded" });
    const check = async (nome, callback) => {
      try { await callback(); v.check(`${mobile ? "Mobile" : "Desktop"}: ${nome}`, true); }
      catch (erro) {
        // Diagnostico na falha: URL, botoes na tela e screenshot, para nao
        // precisar reproduzir o cenario fora do runner.
        const pista = await page.evaluate(() => ({
          url: location.pathname,
          botoes: [...document.querySelectorAll("[role=button],button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 12),
          texto: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 700),
        })).catch(() => null);
        await v.screenshot(page, `${mobile ? "mobile" : "desktop"}-falha-${nome}`);
        v.check(`${mobile ? "Mobile" : "Desktop"}: ${nome}`, false, `${erro.message} | ${JSON.stringify(pista)}`);
      }
    };

    try {
      await check("lista carrega e mostra vazio sem erro", async () => {
        rows = [];
        delayLista = 400;
        await ir("/content");
        await page.getByText("Carregando conteúdo…", { exact: true }).locator("visible=true").first().waitFor();
        await page.getByText("Nenhum conteúdo publicado ainda.", { exact: true }).locator("visible=true").first().waitFor();
        delayLista = 0;
        assert.equal(await page.getByRole("button", { name: "+ Nova palavra", exact: true }).locator("visible=true").count(), 0);
      });

      await check("erro de lista não vira vazio e retry recupera", async () => {
        listStatus = 503;
        await ir("/content");
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
        assert.equal(await page.getByText("Nenhum conteúdo publicado ainda.", { exact: true }).locator("visible=true").count(), 0);
        listStatus = 200;
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByText("Nenhum conteúdo publicado ainda.", { exact: true }).locator("visible=true").first().waitFor();
      });

      rows = [conteudo(1), conteudo(2)];
      await check("membro abre detalhe publicado sem ação de escrita", async () => {
        await ir("/content");
        await page.getByText("Palavra 1", { exact: true }).locator("visible=true").first().waitFor();
        await page.getByText("Palavra 1", { exact: true }).locator("visible=true").first().click();
        await page.getByRole("heading", { level: 1 }).filter({ hasText: "Palavras" }).waitFor();
        await page.getByText("Publicado em", { exact: false }).locator("visible=true").first().waitFor();
        assert.equal(new URL(page.url()).pathname, "/content/1");
        // Sem gestão não aparece nenhuma ação de escrita.
        assert.equal(await page.getByRole("button", { name: "Editar", exact: true }).locator("visible=true").count(), 0);
        assert.equal(await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).locator("visible=true").count(), 0);
      });

      await check("404 e 403 de detalhe têm erro e retry", async () => {
        for (const status of [404, 403]) {
          detailStatus = status;
          await ir("/content/1");
          await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
          assert.equal(await page.getByText("Mensagem 1", { exact: true }).locator("visible=true").count(), 0);
        }
        detailStatus = 200;
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByText("Mensagem 1", { exact: true }).locator("visible=true").first().waitFor();
      });

      // Gestor sem vínculo de membro: o painel de gestão existe no backend.
      gestor = true; vinculado = false;
      await check("pastor sem membro cria rascunho e a falha não perde os campos", async () => {
        await ir("/content");
        await page.getByRole("button", { name: "+ Nova palavra", exact: true }).click();
        const salvar = page.getByRole("button", { name: "Salvar rascunho", exact: true });
        assert.equal(await salvar.getAttribute("aria-disabled"), "true");
        await digitar(page.getByPlaceholder("Título"), "Nova palavra");
        await digitar(page.getByPlaceholder("Comece a escrever sua palavra\u2026"), "Texto persistente");
        const antes = rows.length;
        saveStatus = 422;
        await salvar.click();
        await page.getByRole("alert").waitFor();
        assert.equal(rows.length, antes, "422 não deveria criar registro");
        assert.equal(await page.getByPlaceholder("Título").inputValue(), "Nova palavra");
        assert.equal(await page.getByPlaceholder("Comece a escrever sua palavra\u2026").inputValue(), "Texto persistente");
        saveStatus = 200;
        await salvar.click();
        const rascunho = rows.at(-1);
        assert.equal(rascunho.status, "draft");
        // Abre o detalhe pela URL e confirma o rascunho gravado.
        await ir(`/content/${rascunho.id}`);
        await page.getByText("Rascunho", { exact: false }).locator("visible=true").first().waitFor();
      });

      await check("publicar falha sem falso sucesso e retry publica", async () => {
        const rascunho = rows.find((row) => row.status === "draft");
        assert.ok(rascunho, "o rascunho deveria ter sido criado no check anterior");
        await ir(`/content/${rascunho.id}`);
        const publicar = page.getByRole("button", { name: "Publicar conteúdo", exact: true });
        await publicar.waitFor();
        publishStatus = 503;
        await publicar.click();
        await page.getByRole("alert").waitFor();
        assert.equal(rascunho.status, "draft", "503 não deveria publicar");
        publishStatus = 200;
        // O erro substitui o detalhe; recuperar a leitura antes de publicar.
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByRole("button", { name: "Publicar conteúdo", exact: true }).click();
        await page.getByText("Publicado em", { exact: false }).locator("visible=true").first().waitFor();
        assert.equal(rascunho.status, "published");
      });

      await v.screenshot(page, mobile ? "conteudo-mobile" : "conteudo-desktop");

      // De volta a membro: rascunho não vaza por URL nem por lista.
      gestor = false; vinculado = true;
      rows = [conteudo(1), conteudo(2), conteudo(3, "draft", { title: "Só rascunho", body: "Texto restrito" })];
      await check("membro não acessa rascunho por URL nem o vê na lista", async () => {
        await ir("/content/3");
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
        assert.equal(await page.getByText("Texto restrito", { exact: true }).locator("visible=true").count(), 0);
        await ir("/content");
        await page.getByText("Palavra 1", { exact: true }).locator("visible=true").first().waitFor();
        assert.equal(await page.getByText("Só rascunho", { exact: true }).locator("visible=true").count(), 0);
      });

      await check("conta sem capacidade não acessa lista ou deep link", async () => {
        vinculado = false;
        for (const caminho of ["/content", "/content/1"]) {
          await ir(caminho);
          await page.waitForURL(`${BASE}/home`);
          assert.equal(await page.getByText("Palavra 1", { exact: true }).locator("visible=true").count(), 0);
        }
      });

      await check("401 com refresh recusado encerra sessão sem expor conteúdo", async () => {
        vinculado = true; detailStatus = 401;
        await ir("/content/1");
        await page.waitForURL(`${BASE}/`);
        assert.equal(await page.getByText("Mensagem 1", { exact: true }).locator("visible=true").count(), 0);
      });

      v.check(
        `${mobile ? "Mobile" : "Desktop"}: sem exceções JS ou endpoints inesperados`,
        session.pageerrors.length === 0 && inesperados.length === 0,
        [...session.pageerrors, ...inesperados].join(" | "),
      );
    } finally { await context.close(); }
  }
  return v;
}
