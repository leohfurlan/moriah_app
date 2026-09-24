// Regressões de interface com API inteiramente simulada: nenhum banco é usado.
import assert from "node:assert/strict";
import { BASE } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-5-estabilizacao", { dir });
  v.nota("API simulada; não valida integração real, PostgreSQL ou Android/iOS nativos.");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const exceptions = [];
  page.on("pageerror", (error) => exceptions.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem("moriah_access_token", "qa-simulado");
    localStorage.setItem("moriah_refresh_token", "qa-simulado");
  });
  const created_at = new Date().toISOString();
  let items = [1, 2].map((id) => ({ id, category: "Escalas", title: `Aviso QA ${id}`, body: "Aviso de escala", detail: "Detalhe persistente", action_label: "", action_route: "", created_at, read_at: null, is_read: false }));
  let failRead = false;
  let failList = false;
  let detailStatus = 200;
  let status = "pending";
  let releaseList = null;
  const assignment = () => ({ id: 7, schedule: 9, schedule_status: "published", schedule_name: "Escala QA", event_name: "Culto QA", event_start_at: created_at, event_location: "Igreja", event_type: "service", ministry_name: "Recepção", role_name: "Recepcionista", status, conflict_reason: status === "conflict" ? "Compromisso pessoal sobreposto" : "", justification: "", team: [], repertoire: [], schedule_notes: "" });
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const contribution_date = `${month}-17`;
  const statements = [{ id: 1, amount: "100.00", category: "tithe", status: "approved", contribution_date, notes: "", attachments: [] }];
  await context.route((url) => /^\/(api|backend|local-api)\//.test(url.pathname), async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/(api|backend|local-api)/, "");
    const send = (body, code = 200) => route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(body) });
    if (endpoint === "/me/") return send({ id: 10, email: "qa@simulado.invalid", first_name: "Maria", last_name: "Silva", member_name: "Maria Silva", role: "member", roles: ["member"], church: 1, member_id: 10, has_member_profile: true, capabilities: ["member"], can_access_management: false });
    if (endpoint === "/me/notifications/") {
      if (releaseList) await new Promise((resolve) => { releaseList.resolves.push(resolve); });
      return send(failList ? { detail: "Falha simulada" } : items, failList ? 503 : 200);
    }
    if (endpoint === "/me/notifications/unread-count/") return send({ count: items.filter((item) => !item.is_read).length });
    if (endpoint === "/me/notifications/mark-all-read/") {
      if (failRead) return send({ detail: "Falha simulada" }, 503);
      items = items.map((item) => ({ ...item, is_read: true, read_at: created_at }));
      return send({ updated: items.length });
    }
    if (/^\/me\/notifications\/\d+\/read\/$/.test(endpoint)) {
      if (failRead) return send({ detail: "Falha simulada" }, 503);
      const id = Number(endpoint.split("/")[3]);
      items = items.map((item) => item.id === id ? { ...item, is_read: true, read_at: created_at } : item);
      return send(items.find((item) => item.id === id));
    }
    if (/^\/me\/notifications\/\d+\/$/.test(endpoint)) return send(detailStatus === 200 ? items[0] : { detail: "Falha simulada" }, detailStatus);
    if (endpoint === "/me/statement/") return send(statements);
    if (endpoint === "/me/schedules/7/action/") {
      status = "conflict";
      return send({ ...assignment(), member_name: "Maria Silva", code: "schedule_conflict", detail: "Compromisso pessoal sobreposto" }, 409);
    }
    if (endpoint === "/me/schedules/7/") return send(assignment());
    // Falhar fechado: não permitir que endpoints novos escapem para backend real.
    return send({ detail: `Endpoint não previsto no mock: ${endpoint}` }, 404);
  });
  const go = async (path) => { await page.goto(`${BASE}${path}`); };
  const badge = () => page.getByTestId("notification-badge");
  const check = async (name, action) => {
    try { await action(); v.check(name, true); } catch (error) { v.check(name, false, error.message); }
  };
  try {
    await go("/notifications");
    await check("Lista e sino carregam duas não lidas", async () => {
      await page.getByText("Aviso QA 1", { exact: true }).waitFor();
      assert.equal(await badge().innerText(), "2");
    });
    await check("Falha ao marcar todas mantém não lidas e oferece retry", async () => {
      failRead = true;
      await page.getByRole("button", { name: /Marcar todas como lidas/ }).click();
      await page.getByRole("alert").waitFor();
      assert.equal(await badge().innerText(), "2");
      assert.equal(items.filter((item) => !item.is_read).length, 2);
    });
    await check("Retry em lote atualiza o sino sem reload da página", async () => {
      failRead = false;
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await badge().waitFor({ state: "detached" });
      assert.equal(items.filter((item) => !item.is_read).length, 0);
    });
    await check("Reabrir o sino busca notificações novas", async () => {
      items = [...items, { ...items[0], id: 3, title: "Aviso QA 3", is_read: false, read_at: null }];
      await page.getByRole("button", { name: "Abrir notificações", exact: true }).click();
      await page.getByRole("button", { name: "Abrir notificação: Aviso QA 3", exact: true }).waitFor();
      assert.equal(await badge().innerText(), "1");
      await page.getByRole("button", { name: "Fechar notificações", exact: true }).click();
    });
    await v.screenshot(page, "notificacoes-desktop");
    await check("Detalhe diferencia falha de servidor e recupera com retry", async () => {
      detailStatus = 503;
      await go("/notification/1");
      await page.getByRole("alert").filter({ hasText: "Erro no servidor" }).waitFor();
      detailStatus = 200;
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await page.getByText("Detalhe persistente", { exact: true }).waitFor();
    });
    await check("Falha de leitura individual é visível e retry persiste", async () => {
      items[0] = { ...items[0], is_read: false, read_at: null };
      failRead = true;
      await go("/notification/1");
      await page.getByRole("alert").waitFor();
      await page.getByText("Detalhe persistente", { exact: true }).waitFor();
      assert.equal(items[0].is_read, false);
      failRead = false;
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await page.getByRole("alert").waitFor({ state: "detached" });
      assert.equal(items[0].is_read, true);
    });
    await check("404 tem estado próprio, sem fingir carregamento ou erro de rede", async () => {
      detailStatus = 404;
      await go("/notification/999");
      await page.getByText("Notificação não encontrada ou indisponível para esta conta.", { exact: true }).waitFor();
      assert.equal(await page.getByText("Carregando notificação…", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("alert").count(), 0);
    });
    await check("Lista mostra carregamento e erro com retry, sem falso vazio", async () => {
      releaseList = { resolves: [] };
      await go("/notifications");
      await page.getByText("Carregando notificações…", { exact: true }).waitFor();
      assert.equal(await page.getByText("Nenhuma notificação neste filtro.", { exact: true }).count(), 0);
      failList = true;
      releaseList.resolves.forEach((resolve) => resolve());
      releaseList = null;
      await page.getByRole("alert").waitFor();
      failList = false;
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await page.getByRole("alert").waitFor({ state: "detached" });
    });
    await check("Extrato: mês sem lançamento tem barra zero e data civil correta", async () => {
      await go("/statement");
      await page.getByText(`17/${month.slice(-2)}/${now.getFullYear()}`, { exact: true }).waitFor();
      const current = page.getByTestId(`statement-bar-${month}`);
      assert.equal(await current.evaluate((el) => el.getBoundingClientRect().height), 150);
      const zeros = page.locator('[data-testid^="statement-bar-"]');
      const heights = await zeros.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      assert.equal(heights.filter((height) => height === 0).length, 5);
    });
    await v.screenshot(page, "extrato-desktop");
    await check("Confirmar com 409 mostra motivo e recarrega status de conflito", async () => {
      await go("/schedule/7");
      await page.getByRole("button", { name: "Confirmar", exact: true }).click();
      await page.getByText("Compromisso pessoal sobreposto", { exact: true }).first().waitFor();
      await page.getByText("Conflito de horário", { exact: true }).waitFor();
      assert.equal(status, "conflict");
    });
    await v.screenshot(page, "conflito-desktop");
    await check("Mobile possui três abas e ação central de contribuição, sem Conteúdo", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await go("/notifications");
      await page.getByRole("link", { name: "Perfil", exact: true }).waitFor();
      for (const label of ["Início", "Agenda", "Nova contribuição", "Perfil"]) assert.equal(await page.getByRole("link", { name: label, exact: true }).count(), 1);
      for (const label of ["Conteúdo", "Escalas"]) assert.equal(await page.getByRole("link", { name: label, exact: true }).count(), 0);
    });
    await v.screenshot(page, "notificacoes-mobile");
    v.check("Sem exceções JavaScript não tratadas", exceptions.length === 0, exceptions.join(" | "));
  } finally {
    releaseList?.resolves.forEach((resolve) => resolve());
    await context.close();
  }
  return v;
}
