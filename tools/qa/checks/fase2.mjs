// Fase 2 do plano de execucao — navegacao (menu lateral, abas, avatar, busca).
//
// Criterio de aceite: todo item visivel do menu lateral e das abas leva a uma
// tela coerente com o rotulo, respeita a capacidade da conta e a tela tem
// estado de carregamento/vazio/erro. Alem disso: nada de item decorativo
// apontando para tela existente "para nao ficar rota vazia".
import { conta, PAPEIS } from "../lib/accounts.mjs";
import { BASE, digitar, esperarPor, login, novaSessao, texto, VIEWPORT_DESKTOP, VIEWPORT_MOBILE } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const contem = (texto_, trecho) => normalizar(texto_).includes(normalizar(trecho));
const caminho = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

/** Itens do menu lateral do membro: rotulo -> rota real. */
const MENU_MEMBRO = [
  ["Visão geral", "/home"],
  ["Agenda", "/agenda"],
  ["Conteúdo", "/content"],
  ["Escalas", "/schedules"],
  ["Meu extrato", "/statement"],
];

/** Rotulos decorativos que existiam antes e nao tem tela: nao podem voltar. */
const ROTULOS_DECORATIVOS = [
  "Visitantes",
  "Setlists",
  "Repertório",
  "Bandas",
  "Escola Bíblica",
  "Turmas",
  "Palavras",
  "Relatórios",
  "Configurações",
];

const apiPath = (url, endpoint) => ["api", "backend", "local-api"].some((prefix) => caminho(url) === `/${prefix}${endpoint}`);

async function irPara(page, rota) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2200);
}

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-2-navegacao", { dir });
  v.nota(`fase 2 do plano | base=${BASE}`);
  const membro = conta(PAPEIS.membro);
  const admin = conta(PAPEIS.admin);

  // ---- 1. menu lateral do membro: item visivel leva a rota do rotulo -------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/home");
    const problemas = [];
    for (const [rotulo, rota] of MENU_MEMBRO) {
      const link = sessao.page.getByRole("link", { name: rotulo, exact: true }).first();
      if ((await link.count()) === 0) {
        problemas.push(`${rotulo}: item ausente no menu`);
        continue;
      }
      await link.click({ timeout: 10000 }).catch(() => {});
      const chegou = await esperarPor(async () => caminho(sessao.page.url()) === rota, { timeout: 8000 });
      if (!chegou) problemas.push(`${rotulo} -> ${caminho(sessao.page.url())} (esperado ${rota})`);
    }
    v.check(
      "1. Menu lateral do membro: cada item visível leva à tela do próprio rótulo",
      problemas.length === 0,
      problemas.length ? problemas.join(" | ") : MENU_MEMBRO.map(([rotulo, rota]) => `${rotulo}=${rota}`).join(", "),
    );
    await v.screenshot(sessao.page, "1-menu-membro");
    await sessao.context.close();
  }

  // ---- 2. capacidade: membro nao ve criar escala, gestao ve ----------------
  {
    const sessaoMembro = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessaoMembro.page, membro);
    await irPara(sessaoMembro.page, "/home");
    const membroVe = (await sessaoMembro.page.getByRole("link", { name: "Criar escala", exact: true }).count()) > 0;
    await sessaoMembro.context.close();

    const sessaoAdmin = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessaoAdmin.page, admin);
    await irPara(sessaoAdmin.page, "/home");
    const linkAdmin = sessaoAdmin.page.getByRole("link", { name: "Criar escala", exact: true }).first();
    const adminVe = (await linkAdmin.count()) > 0;
    let adminNavega = false;
    if (adminVe) {
      await linkAdmin.click({ timeout: 10000 }).catch(() => {});
      adminNavega = await esperarPor(async () => caminho(sessaoAdmin.page.url()) === "/schedule-create", { timeout: 8000 });
    }
    v.check(
      "2. Item de gestão respeita a capacidade da conta (membro não vê, gestão vê e navega)",
      !membroVe && adminVe && adminNavega,
      `membro vê=${membroVe} | gestão vê=${adminVe} | gestão navega=${adminNavega}`,
    );
    await v.screenshot(sessaoAdmin.page, "2-menu-gestao");
    await sessaoAdmin.context.close();
  }

  // ---- 3. nenhum rotulo decorativo no menu --------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, admin);
    await irPara(sessao.page, "/home");
    const conteudo = await sessao.page.getByTestId("sidebar").innerText();
    const achados = ROTULOS_DECORATIVOS.filter((rotulo) => contem(conteudo, rotulo));
    v.check(
      "3. Menu sem itens decorativos (rótulo sem tela não aparece)",
      achados.length === 0,
      achados.length ? `sobraram: ${achados.join(", ")}` : `${ROTULOS_DECORATIVOS.length} rótulos conferidos`,
    );
    await v.screenshot(sessao.page, "3-sem-decorativos");
    await sessao.context.close();
  }

  // ---- 4. abas mobile aprovadas -------------------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_MOBILE, mobile: true });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro (mobile)", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/home");
    const abas = [
      ["Início", "/home"],
      ["Agenda", "/agenda"],
      ["Nova contribuição", "/contribution"],
      ["Conteúdo", "/content"],
      ["Perfil", "/profile"],
    ];
    const problemas = [];
    for (const [rotulo, rota] of abas) {
      const aba = sessao.page.getByRole("link", { name: rotulo, exact: true }).first();
      if ((await aba.count()) === 0) {
        problemas.push(`${rotulo}: aba ausente`);
        continue;
      }
      await aba.click({ timeout: 10000 }).catch(() => {});
      const chegou = await esperarPor(async () => caminho(sessao.page.url()) === rota, { timeout: 8000 });
      if (!chegou) problemas.push(`${rotulo} -> ${caminho(sessao.page.url())} (esperado ${rota})`);
    }
    v.check(
      "4. Navegação mobile leva aos destinos reais (Início, Agenda, Nova contribuição, Conteúdo, Perfil)",
      problemas.length === 0,
      problemas.length ? problemas.join(" | ") : abas.map(([rotulo, rota]) => `${rotulo}=${rota}`).join(", "),
    );
    // Aba ativa: o RN Web nao publica `aria-selected` para role=link, entao a
    // evidencia e o destaque visual — exatamente uma aba com fundo proprio, e
    // ela tem que ser a da rota atual.
    const destacada = await sessao.page.evaluate(() => {
      const rotulos = ["Início", "Agenda", "Conteúdo", "Perfil"];
      return [...document.querySelectorAll('[role="link"]')]
        .map((el) => ({ nome: (el.getAttribute("aria-label") || "").trim(), fundo: getComputedStyle(el).backgroundColor }))
        .filter((item) => rotulos.includes(item.nome) && item.fundo && item.fundo !== "rgba(0, 0, 0, 0)");
    });
    const esperadaNaRota = { "/home": "Início", "/agenda": "Agenda", "/statement": "Contribuições", "/content": "Conteúdo", "/profile": "Perfil" }[caminho(sessao.page.url())];
    v.check(
      "4b. A aba da rota atual é a única destacada",
      destacada.length === 1 && destacada[0].nome === esperadaNaRota,
      `destacadas=${destacada.map((item) => item.nome + ":" + item.fundo).join(", ") || "nenhuma"} | esperado=${esperadaNaRota} (${caminho(sessao.page.url())})`,
    );
    await v.screenshot(sessao.page, "4-abas-mobile");
    await sessao.context.close();
  }

  // ---- 5. avatar e badge do sino vem da conta ------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    let perfil = null;
    let esperadoNotificacoes = null;
    sessao.page.on("response", async (resposta) => {
      if (apiPath(resposta.url(), "/me/")) {
        perfil = await resposta.json().catch(() => null);
      }
      if (apiPath(resposta.url(), "/me/notifications/unread-count/")) {
        esperadoNotificacoes = (await resposta.json().catch(() => null))?.count ?? null;
      }
    });
    await login(sessao.page, membro);
    await irPara(sessao.page, "/home");
    await esperarPor(() => perfil !== null && esperadoNotificacoes !== null, { timeout: 8000 });
    const conteudo = await texto(sessao.page);
    const iniciaisEsperadas = perfil
      ? (`${[perfil.first_name, perfil.last_name].filter(Boolean).join(" ") || perfil.member_name || perfil.email}`.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("")).toUpperCase()
      : "";
    const nomeEsperado = perfil ? ([perfil.first_name, perfil.last_name].filter(Boolean).join(" ") || perfil.member_name || perfil.email).trim() : "";
    const nomeNaTela = Boolean(nomeEsperado) && contem(conteudo, nomeEsperado);
    const semPlaceholder = !/\nAM\n/.test(conteudo);
    const alvo = sessao.page.getByTestId("notification-badge");
    const badge = await alvo.count() ? (await alvo.innerText()).trim() : "";
    v.check(
      "5. Avatar mostra as iniciais e o nome da conta logada (não mais 'AM' fixo)",
      Boolean(perfil) && iniciaisEsperadas.length > 0 && contem(conteudo, iniciaisEsperadas) && nomeNaTela && semPlaceholder,
      `iniciais=${iniciaisEsperadas} | nome na tela=${nomeNaTela} | avatar fixo AM=${!semPlaceholder}`,
    );
    v.check(
      "6. Badge do sino usa a contagem de não lidas devolvida pela API",
      esperadoNotificacoes !== null && badge === (esperadoNotificacoes === 0 ? "" : esperadoNotificacoes > 99 ? "99+" : String(esperadoNotificacoes)),
      `badge na tela="${badge}" | esperado=${esperadoNotificacoes}`,
    );
    await v.screenshot(sessao.page, "5-avatar-e-badge");
    await sessao.context.close();
  }

  // ---- 7. busca do topbar --------------------------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, membro);
    await irPara(sessao.page, "/home");
    const campo = sessao.page.getByLabel("Buscar no Moriah").first();
    if ((await campo.count()) === 0) {
      v.check("7. Busca de navegação funciona", false, "campo de busca ausente no topbar");
    } else {
      await digitar(campo, "escala");
      const resultado = sessao.page.getByRole("button", { name: /Ir para Escalas/i }).first();
      const apareceu = await esperarPor(async () => (await resultado.count()) > 0, { timeout: 5000 });
      let navegou = false;
      if (apareceu) {
        await resultado.click({ timeout: 8000 }).catch(() => {});
        navegou = await esperarPor(async () => caminho(sessao.page.url()) === "/schedules", { timeout: 8000 });
      }
      v.check(
        "7. Busca de navegação encontra o destino e navega (rótulo real, não decorativo)",
        apareceu && navegou,
        `resultado=${apareceu} | navegou=${navegou}`,
      );
      await digitar(campo, "zzzqqq");
      const vazio = await esperarPor(async () => contem(await texto(sessao.page), "nada encontrado"), { timeout: 5000 });
      v.check("7b. Busca sem correspondência avisa o membro", vazio, vazio ? 'mensagem "Nada encontrado nesta conta."' : "nenhuma mensagem");
    }
    await v.screenshot(sessao.page, "7-busca");
    await sessao.context.close();
  }

  // ---- 8. recolher/expandir o menu ----------------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, membro);
    await irPara(sessao.page, "/home");
    const botao = sessao.page.getByRole("button", { name: /recolher menu/i }).first();
    if ((await botao.count()) === 0) {
      v.check("8. Botão de recolher o menu funciona", false, "botão 'Recolher menu' ausente");
    } else {
      await botao.click({ timeout: 8000 }).catch(() => {});
      // Fecha o menu: o rotulo visivel sai da tela (o nome acessivel do link
      // continua existindo de proposito, para leitor de tela).
      const sumiu = await esperarPor(async () => (await sessao.page.getByText("Visão geral", { exact: true }).count()) === 0, { timeout: 5000 });
      const expandir = sessao.page.getByRole("button", { name: /expandir menu/i }).first();
      const virou = (await expandir.count()) > 0;
      let voltou = false;
      if (virou) {
        await expandir.click({ timeout: 8000 }).catch(() => {});
        voltou = await esperarPor(async () => (await sessao.page.getByText("Visão geral", { exact: true }).count()) > 0, { timeout: 5000 });
      }
      v.check(
        "8. Botão de recolher/expandir o menu funciona (não é ícone decorativo)",
        sumiu && virou && voltou,
        `recolheu=${sumiu} | virou 'Expandir'=${virou} | voltou=${voltou}`,
      );
      await v.screenshot(sessao.page, "8-menu-recolhido");
    }
    await sessao.context.close();
  }

  // ---- 9. estado de erro com nova tentativa --------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, membro);
    await sessao.page.route((url) => apiPath(url.href, "/me/statement/"), (rota) => rota.fulfill({ status: 503, contentType: "text/html", body: "<html><body>Service Unavailable</body></html>" }));
    await irPara(sessao.page, "/statement");
    const conteudo = await texto(sessao.page);
    const temAlerta = contem(conteudo, "tentar novamente") || contem(conteudo, "servidor") || contem(conteudo, "instantes");
    const botao = sessao.page.getByRole("button", { name: /tentar novamente/i }).first();
    const podeTentar = (await botao.count()) > 0;
    v.check(
      "9. Tela com falha de API oferece mensagem e nova tentativa (estado de erro tratado)",
      temAlerta && podeTentar,
      `mensagem=${temAlerta} | botão 'Tentar novamente'=${podeTentar}`,
    );
    await v.screenshot(sessao.page, "9-estado-de-erro");
    await sessao.context.close();
  }

  v.nota("Badge validado contra /me/notifications/unread-count/, sem dados estáticos.");
  return v;
}
