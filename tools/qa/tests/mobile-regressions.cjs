const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../../../mobile/node_modules/typescript");

// Executa os módulos reais, sem dependências nativas nem servidor/banco.
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, "../../../mobile/src", relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return load(path.relative(path.resolve(__dirname, "../../../mobile/src"), path.resolve(path.dirname(filename), `${name}.ts`)), mocks);
  };
  vm.runInThisContext(`(function(require, module, exports) {\n${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

const dates = load("services/dates.ts");
const theme = load("theme.ts", { "react-native": {} });
const errors = load("services/errors.ts");
const apiHelpers = load("services/api.ts", {
  "./storage": { clearTokens: async () => {}, getAccessToken: async () => null, getRefreshToken: async () => null, saveAccessToken: async () => {} },
  "./errors": errors,
});
const notice = (id, read = false) => ({ id, is_read: read, read_at: read ? "2026-09-17T12:00:00Z" : null });
function store(api) {
  return load("services/notificationStore.ts", { "./api": { api }, "./errors": errors });
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("data civil permanece no mesmo dia e data inválida não é normalizada", () => {
  assert.equal(theme.formatDate("2026-09-17"), "17/09/2026");
  assert.equal(theme.formatDate("2026-02-30"), "--");
  assert.equal(dates.parseDate("2024-02-29").getDate(), 29);
  assert.equal(dates.parseDate("2026-09-17").getHours(), 0);
});

test("período inclui todo o dia limite e limita fim de mês/ano bissexto", () => {
  const cutoff = dates.statementCutoff("3m", new Date(2026, 8, 17, 20, 45));
  assert.equal(cutoff.getHours(), 0);
  assert.ok(dates.parseDate("2026-06-17") >= cutoff);
  assert.ok(dates.parseDate("2026-06-16") < cutoff);
  assert.equal(dates.statementCutoff("3m", new Date(2026, 4, 31)).getDate(), 28);
  assert.equal(dates.statementCutoff("year", new Date(2024, 1, 29)).getDate(), 28);
  assert.equal(dates.statementCutoff("all"), null);
});

test("gráfico tem zero real e proporção linear", () => {
  assert.equal(dates.statementBarHeight(0, 100), 0);
  assert.equal(dates.statementBarHeight(50, 100), 75);
  assert.equal(dates.statementBarHeight(100, 100), 150);
  assert.equal(dates.statementBarHeight(0, 0), 0);
});

test("resposta paginada e lista legada usam o mesmo adaptador", () => {
  const page = apiHelpers.normalizePage({ count: 51, next: "/api/items/?page=2", previous: null, results: [{ id: 1 }] });
  assert.deepEqual(page.items, [{ id: 1 }]);
  assert.equal(page.count, 51);
  assert.equal(page.hasNext, true);
  const legacy = apiHelpers.normalizePage([{ id: 2 }]);
  assert.deepEqual(legacy.items, [{ id: 2 }]);
  assert.equal(legacy.hasNext, false);
});

test("409 de escala prioriza motivo do conflito, não nome do integrante", () => {
  const result = errors.describeError(new errors.ApiError(409, {
    member_name: "Maria Silva", status: "conflict", detail: "Compromisso pessoal sobreposto", code: "schedule_conflict",
  }));
  assert.equal(result.title, "Conflito de horário");
  assert.equal(result.message, "Compromisso pessoal sobreposto");
  assert.equal(errors.describeError(new errors.ApiError(500, "<html>Traceback</html>")).title, "Erro no servidor");
});

test("leitura individual e em lote notificam assinantes e atualizam contador compartilhado", async () => {
  let items = [notice(1), notice(2)];
  const s = store({
    get: async (url) => url.includes("unread-count") ? { count: items.filter((item) => !item.is_read).length } : [...items],
    post: async (url) => {
      items = items.map((item) => url.includes("mark-all") || url.includes(`/${item.id}/`) ? notice(item.id, true) : item);
      return items[0];
    },
  });
  let changes = 0;
  const unsubscribe = s.subscribeNotifications(() => { changes++; });
  await s.loadNotifications(10);
  assert.equal(s.getNotificationsSnapshot().unreadCount, 2);
  await s.readNotification(10, 1);
  assert.equal(s.getNotificationsSnapshot().unreadCount, 1);
  assert.equal(s.getNotificationsSnapshot().items[0].is_read, true);
  await s.readAllNotifications(10);
  assert.equal(s.getNotificationsSnapshot().unreadCount, 0);
  assert.ok(changes >= 6);
  unsubscribe();
});

test("POST com falha não marca como lida nem zera badge", async () => {
  const s = store({
    get: async (url) => url.includes("unread-count") ? { count: 1 } : [notice(1)],
    post: async () => { throw new errors.NetworkError(); },
  });
  await s.loadNotifications(10);
  await assert.rejects(s.readNotification(10, 1), errors.NetworkError);
  await assert.rejects(s.readAllNotifications(10), errors.NetworkError);
  assert.equal(s.getNotificationsSnapshot().unreadCount, 1);
  assert.equal(s.getNotificationsSnapshot().items[0].is_read, false);
});

test("reload com falha oferece erro e retry recupera inclusive lista vazia", async () => {
  let fail = true;
  const s = store({ get: async (url) => {
    if (fail) throw new errors.ApiError(503, "<html>indisponível</html>");
    return url.includes("unread-count") ? { count: 0 } : [];
  } });
  await assert.rejects(s.loadNotifications(10));
  assert.equal(s.getNotificationsSnapshot().loading, false);
  assert.equal(s.getNotificationsSnapshot().error.title, "Erro no servidor");
  fail = false;
  await s.loadNotifications(10, true);
  assert.equal(s.getNotificationsSnapshot().error, null);
  assert.deepEqual(s.getNotificationsSnapshot().items, []);
});

test("logout ignora resposta antiga e não expõe notificações da conta anterior", async () => {
  const waiting = deferred();
  const s = store({ get: async (url) => { await waiting.promise; return url.includes("unread-count") ? { count: 1 } : [notice(1)]; } });
  const pending = s.loadNotifications(10);
  s.resetNotifications();
  waiting.resolve();
  await pending;
  assert.equal(s.getNotificationsSnapshot().userId, null);
  assert.deepEqual(s.getNotificationsSnapshot().items, []);
});

test("requisição antiga não sobrescreve reload nem conta nova", async () => {
  const waiting = deferred();
  let calls = 0;
  const s = store({ get: async (url) => {
    const old = calls++ < 2;
    if (old) await waiting.promise;
    return url.includes("unread-count") ? { count: old ? 2 : 1 } : [notice(old ? 1 : 2)];
  } });
  const pending = s.loadNotifications(10);
  await s.loadNotifications(20);
  waiting.resolve();
  await pending;
  assert.equal(s.getNotificationsSnapshot().userId, 20);
  assert.equal(s.getNotificationsSnapshot().items[0].id, 2);
  assert.equal(s.getNotificationsSnapshot().unreadCount, 1);
});

test("reload forçado da mesma conta ignora respostas anteriores", async () => {
  const waiting = deferred();
  let calls = 0;
  const s = store({ get: async (url) => {
    const old = calls++ < 2;
    if (old) await waiting.promise;
    return url.includes("unread-count") ? { count: old ? 2 : 0 } : [notice(1, !old)];
  } });
  const pending = s.loadNotifications(10);
  await s.loadNotifications(10, true);
  waiting.resolve();
  await pending;
  assert.equal(s.getNotificationsSnapshot().unreadCount, 0);
  assert.equal(s.getNotificationsSnapshot().items[0].is_read, true);
});
