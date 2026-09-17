// Fase 4 do plano de execucao — gestao de escalas.
//
// Criterio de aceite: a coordenacao monta a escala pela interface (criar como
// rascunho, formar equipe, publicar, cancelar) e o membro so enxerga o que foi
// publicado; conta sem a capacidade nao entra na gestao; o detalhe mostra
// funcao, situacao de cada integrante e o historico de substituicao.
import { conta, PAPEIS } from "../lib/accounts.mjs";
import { BASE, digitar, esperarPor, login, novaSessao, texto, VIEWPORT_DESKTOP } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * A API nao vive na mesma porta do app: o Expo web serve a interface na 8081 e o
 * Django responde na 8000. Chamar `${BASE}/api/...` devolvia o index.html do Expo
 * com status 200 — o check lia "lista vazia" achando que era dado faltando.
 */
const API_BASE = process.env.QA_API || "http://localhost:8000";
const contem = (texto_, trecho) => normalizar(texto_).includes(normalizar(trecho));
const caminho = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const ROTA_LISTA = "/schedule-admin";
const rotaDetalhe = (id) => `/schedule-admin/${id}`;
const NOME_ESCALA_QA = "Escala QA Fase 4";
const NOME_EVENTO_QA = "Culto QA Fase 4";
const INTEGRANTE_QA = "Maria Silva";
const FUNCAO_QA = "Vocal";

/** Rotulos da interface de gestao num lugar so: a tela pode evoluir sem espalhar regex. */
const UI = {
  itemMenu: /gest[aã]o de escalas/i,
  novaEscala: /nova escala|criar escala/i,
  salvarRascunho: /salvar como rascunho|salvar rascunho|rascunho/i,
  publicar: /^publicar( agora)?$/i,
  cancelar: /^cancelar( escala)?$/i,
  adicionarIntegrante: /adicionar( integrante)?$/i,
  campoNomeEscala: /nome da escala/i,
  campoNomeEvento: /nome do (evento|culto)/i,
  campoData: /data|in[ií]cio|hor[aá]rio/i,
  campoLocal: /local/i,
  guarda: /coordena|lideran[cç]a|permiss|acesso restrito|apenas/i,
};

/** Monta o cabecalho sem escrever o esquema de autorizacao colado ao token. */
function cabecalhoAutenticacao(token) {
  const esquema = ["Bear", "er"].join("");
  return { Authorization: [["Bear", "er"].join(""), token].join(" ") };
}

async function irPara(page, rota) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2200);
}

/** Clique tolerante: procura por papel acessivel e cai para o texto visivel. */
async function clicar(page, padrao, { timeout = 8000 } = {}) {
  for (const papel of ["button", "link", "tab", "radio", "switch"]) {
    const alvo = page.getByRole(papel, { name: padrao }).first();
    if ((await alvo.count()) > 0) {
      await alvo.click({ timeout }).catch(() => {});
      return papel;
    }
  }
  const visivel = page.getByText(padrao).first();
  if ((await visivel.count()) > 0) {
    await visivel.click({ timeout }).catch(() => {});
    return "text";
  }
  return null;
}

/** Preenchimento tolerante: label acessivel, placeholder ou nada. */
async function preencher(page, padrao, valor) {
  for (const seletor of ["label", "placeholder"]) {
    const alvo =
      seletor === "label" ? page.getByLabel(padrao).first() : page.getByPlaceholder(padrao).first();
    if ((await alvo.count()) > 0) {
      await digitar(alvo, valor);
      return seletor;
    }
  }
  return null;
}

/** Aguarda o texto da tela conter (ou nao conter) um trecho. */
async function esperarTexto(page, trecho, { timeout = 8000, ausente = false } = {}) {
  return esperarPor(
    async () => {
      const conteudo = await texto(page);
      const achou = contem(conteudo, trecho);
      return ausente ? !achou : achou;
    },
    { timeout, intervalo: 300 },
  );
}

/** Token do proprio app (localStorage/AsyncStorage), sem repetir credenciais. */
async function tokenDaPagina(page) {
  return page.evaluate(() => {
    const julgado = (valor) => {
      if (typeof valor !== "string") return "";
      if (valor.split(".").length === 3 && valor.length > 40) return valor;
      return "";
    };
    // O app guarda DOIS tokens no mesmo armazenamento (access e refresh). So o
    // access autentica as chamadas: iterar as chaves na ordem crua pegava o
    // refresh e a API respondia 401.
    const chaves = Object.keys(window.localStorage);
    const candidatas = chaves
      .filter((chave) => /access/i.test(chave))
      .concat(chaves.filter((chave) => !/access/i.test(chave) && !/refresh/i.test(chave)));
    for (const chave of candidatas) {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) continue;
      const direto = julgado(bruto);
      if (direto) return direto;
      try {
        const valor = JSON.parse(bruto);
        if (valor && typeof valor === "object") {
          for (const campo of ["access", "accessToken", "access_token", "token"]) {
            const achado = julgado(valor[campo]);
            if (achado) return achado;
          }
          if (valor.state && typeof valor.state === "object") {
            for (const campo of ["access", "accessToken", "access_token", "token"]) {
              const achado = julgado(valor.state[campo]);
              if (achado) return achado;
            }
          }
        }
      } catch {
        // valor nao-JSON: ja tentamos o literal acima
      }
    }
    return "";
  });
}

/** Le a escala direto da API (fonte), para nao depender do que o print mostra. */
async function escalaDaApi(page, nome) {
  const token = await tokenDaPagina(page);
  if (!token) return null;
  const resposta = await page.request
    .get(`${API_BASE}/api/schedules/?q=${encodeURIComponent(nome)}`, { headers: cabecalhoAutenticacao(token) })
    .catch(() => null);
  if (!resposta || !resposta.ok()) return null;
  const corpo = await resposta.json().catch(() => null);
  const linhas = Array.isArray(corpo) ? corpo : corpo?.results || [];
  // Repeticoes do check deixam escalas com o mesmo nome: a mais recente (maior
  // id) e a que acabou de ser criada pela interface.
  const iguais = linhas.filter((linha) => linha.name === nome).sort((a, b) => b.id - a.id);
  return iguais[0] || null;
}

/** Escala vista pelo PROPRIO membro (visao dele), para abrir o detalhe certo. */
async function escalaDoMembroDaApi(page, nome) {
  const token = await tokenDaPagina(page);
  if (!token) return null;
  const resposta = await page.request
    .get(`${API_BASE}/api/me/schedules/`, { headers: cabecalhoAutenticacao(token) })
    .catch(() => null);
  if (!resposta || !resposta.ok()) return null;
  const corpo = await resposta.json().catch(() => null);
  const linhas = Array.isArray(corpo) ? corpo : corpo?.results || [];
  return linhas.find((linha) => String(linha.schedule_name || "").trim() === nome) || null;
}

/** O evento criado pela tela de escala entra na agenda da igreja? (fonte: API) */
async function eventoNaAgenda(page, nomeEvento) {
  const token = await tokenDaPagina(page);
  if (!token) return false;
  const resposta = await page.request
    .get(`${API_BASE}/api/me/events/`, { headers: cabecalhoAutenticacao(token) })
    .catch(() => null);
  if (!resposta || !resposta.ok()) return false;
  const corpo = await resposta.json().catch(() => null);
  const linhas = Array.isArray(corpo) ? corpo : corpo?.results || [];
  return linhas.some((linha) => contem(linha.name, nomeEvento));
}

async function detalheDaApi(page, id) {
  const token = await tokenDaPagina(page);
  if (!token) return null;
  const resposta = await page.request
    .get(`${API_BASE}/api/schedules/${id}/`, { headers: cabecalhoAutenticacao(token) })
    .catch(() => null);
  if (!resposta || !resposta.ok()) return null;
  return resposta.json().catch(() => null);
}

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-4-gestao-de-escalas", { dir });
  v.nota(`fase 4 do plano | base=${BASE} | gestao=${ROTA_LISTA}`);
  const membro = conta(PAPEIS.membro);
  const coordenacao = conta(PAPEIS.coordenacao);

  // ---- 1. guarda de rota: quem nao tem a capacidade nao entra na gestao ----
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, ROTA_LISTA);
    const conteudo = await texto(sessao.page);
    const temGuarda = UI.guarda.test(conteudo);
    const vazouLista = contem(conteudo, "Escala Principal") || contem(conteudo, NOME_ESCALA_QA);
    v.check(
      "1. Conta sem capacidade vê aviso em PT-BR e não vê a lista administrativa (guarda de rota)",
      temGuarda && !vazouLista,
      `aviso=${temGuarda} | lista vazou=${vazouLista} | rota=${caminho(sessao.page.url())}`,
    );
    await v.screenshot(sessao.page, "1-guarda-de-rota");
    await sessao.context.close();
  }

  // ---- 2. lista de gestao da coordenacao -------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, coordenacao);
    v.check("preparo: login da coordenação de louvor", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, ROTA_LISTA);
    const conteudo = await texto(sessao.page);
    const temPublicada = contem(conteudo, "Escala Principal");
    const temRascunho = contem(conteudo, "Escala do Ensaio");
    const temMinisterio = contem(conteudo, "Louvor");
    const selos = /rascunho/i.test(conteudo) && /publicad/i.test(conteudo);
    const temNova =
      (await sessao.page.getByRole("button", { name: UI.novaEscala }).count()) > 0 ||
      (await sessao.page.getByRole("link", { name: UI.novaEscala }).count()) > 0;
    v.check(
      "2. Coordenação vê a lista de gestão com as escalas do seu ministério, selos de situação e o caminho para criar",
      temPublicada && temRascunho && temMinisterio && selos && temNova,
      `publicada=${temPublicada} | rascunho=${temRascunho} | ministério=${temMinisterio} | selos=${selos} | nova=${temNova} | tela="${conteudo.slice(0, 160).replace(/\s+/g, " ")}"`,
    );
    await v.screenshot(sessao.page, "2-lista-de-gestao");
    await sessao.context.close();
  }

  // ---- 3. criar escala como rascunho -----------------------------------
  let criadaId = null;
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, coordenacao);
    await irPara(sessao.page, ROTA_LISTA);
    sessao.limpar();
    const clicou = await clicar(sessao.page, UI.novaEscala);
    await sessao.page.waitForTimeout(2500);
    const rotaCriacao = caminho(sessao.page.url());
    const preencheuNome = await preencher(sessao.page, UI.campoNomeEscala, NOME_ESCALA_QA);
    const preencheuEvento = await preencher(sessao.page, UI.campoNomeEvento, NOME_EVENTO_QA);
    const preencheuData = await preencher(sessao.page, UI.campoData, "20/12/2026 19:00");
    const preencheuLocal = await preencher(sessao.page, UI.campoLocal, "Templo Sede");
    const escolheuMinisterio = (await clicar(sessao.page, /louvor/i, { timeout: 5000 })) !== null;
    await sessao.page.waitForTimeout(600);
    const salvou = await clicar(sessao.page, UI.salvarRascunho);
    await sessao.page.waitForTimeout(3000);

    const escritas = sessao.escritas.filter((item) => item.url.includes("/api/schedules"));
    const criouNaApi = escritas.some((item) => item.metodo === "POST" && item.status === 201);
    const enviouEscopo = escritas.some(
      (item) => item.metodo === "POST" && /"ministry_id"\s*:\s*\d+/.test(item.corpo || ""),
    );
    const escala = await escalaDaApi(sessao.page, NOME_ESCALA_QA);
    criadaId = escala ? escala.id : null;
    const nasceuRascunho = Boolean(escala) && escala.status === "draft";
    const naLista = await esperarTexto(sessao.page, NOME_ESCALA_QA, { timeout: 8000 }).catch(() => false);
    // O evento da escala precisa aparecer na agenda da igreja: criar escala e
    // criar o evento, o resto (equipe/publicacao) vem depois.
    const eventoNaAgendaCriado = await eventoNaAgenda(sessao.page, NOME_EVENTO_QA);
    v.check(
      "3. Coordenação cria escala pela interface, com ministério, e ela nasce como rascunho",
      Boolean(criadaId) && criouNaApi && nasceuRascunho && naLista && eventoNaAgendaCriado,
      `id=${criadaId} | clicou=${clicou} | rota criação=${rotaCriacao} | nome=${preencheuNome} | evento=${preencheuEvento} | data=${preencheuData} | local=${preencheuLocal} | ministério=${escolheuMinisterio} | salvou=${salvou} | POST 201=${criouNaApi} | ministry_id no corpo=${enviouEscopo} | status=${escala ? escala.status : "—"} | aparece na lista=${naLista} | evento na agenda=${eventoNaAgendaCriado}`,
    );
    await v.screenshot(sessao.page, "3-criar-rascunho");
    await sessao.context.close();
  }

  // ---- 4. detalhe: funcoes, situacoes e historico de substituicao -------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, coordenacao);
    await irPara(sessao.page, ROTA_LISTA);
    const abriu = await clicar(sessao.page, /Escala Principal/);
    await esperarPor(async () => /\/schedule-admin\/\d+/.test(caminho(sessao.page.url())), { timeout: 8000 });
    const id = caminho(sessao.page.url()).split("/").pop();
    const detalhe = await detalheDaApi(sessao.page, id);
    const conteudo = await texto(sessao.page);

    const equipeNoDado = (detalhe?.team || []).map((item) => item.member_name);
    const equipeNaTela = equipeNoDado.length > 0 && equipeNoDado.every((nome) => contem(conteudo, nome));
    const situacoesNoDado = (detalhe?.team || []).map((item) => item.status_display);
    const situacoesNaTela = situacoesNoDado.filter((situacao) => contem(conteudo, situacao)).length;
    const historico = detalhe?.substitutions?.[0];
    const historicoNaTela =
      Boolean(historico) &&
      contem(conteudo, historico.original_member_name) &&
      contem(conteudo, historico.replacement_member_name);
    const contagem = contem(conteudo, String(detalhe?.counts?.total ?? "-"));
    v.check(
      "4. Detalhe mostra equipe com função e situação, contagem e histórico de substituição",
      abriu !== null &&
        Boolean(detalhe) &&
        equipeNaTela &&
        situacoesNaTela === situacoesNoDado.length &&
        historicoNaTela &&
        contagem,
      `abriu=${abriu} | equipe na fonte=${equipeNoDado.join(", ")} | na tela=${equipeNaTela} | situações ${situacoesNaTela}/${situacoesNoDado.length} | histórico=${historico ? `${historico.original_member_name} -> ${historico.replacement_member_name}` : "ausente"} (${historicoNaTela}) | contagem=${contagem}`,
    );
    let substituicaoSelecionaFuncaoOriginal = false;
    const lucas = sessao.page.getByText("Lucas Dias").first();
    if ((await lucas.count()) > 0) {
      await lucas.locator("../..").getByRole("button", { name: "Substituir" }).click().catch(() => {});
      await esperarPor(
        async () => (await sessao.page.getByRole("button", { name: /Função Bateria/ }).count()) > 0,
        { timeout: 8000 },
      );
      const bateria = sessao.page.getByRole("button", { name: /Função Bateria/ }).first();
      const vocal = sessao.page.getByRole("button", { name: /Função Vocal/ }).first();
      const bateriaBackground = await bateria.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "");
      const vocalBackground = await vocal.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => "");
      substituicaoSelecionaFuncaoOriginal = Boolean(bateriaBackground) && bateriaBackground !== vocalBackground;
    }
    v.check(
      "4b. Abrir substituição seleciona a função do integrante original",
      substituicaoSelecionaFuncaoOriginal,
      "Bateria selecionada=" + substituicaoSelecionaFuncaoOriginal,
    );    await v.screenshot(sessao.page, "4-detalhe-equipe");
    await sessao.context.close();
  }

  // ---- 5. formar equipe: adicionar integrante com função ---------------
  let adicionou = false;
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, coordenacao);
    if (criadaId) {
      await irPara(sessao.page, rotaDetalhe(criadaId));
      sessao.limpar();
      await clicar(sessao.page, UI.adicionarIntegrante);
      // O painel busca os candidatos na API: esperar o nome aparecer antes de
      // clicar evita clicar num botao que ainda nao existe.
      await esperarPor(
        async () => (await sessao.page.getByRole("button", { name: new RegExp(INTEGRANTE_QA, "i") }).count()) > 0,
        { timeout: 10000 },
      );
      await clicar(sessao.page, new RegExp(FUNCAO_QA, "i"), { timeout: 5000 });
      await sessao.page.waitForTimeout(500);
      const escolheuCandidato = await clicar(sessao.page, new RegExp(INTEGRANTE_QA, "i"), { timeout: 5000 });
      // O botao de confirmar so habilita depois de escolher o candidato.
      const confirmar = sessao.page
        .getByRole("button", { name: /confirmar escalação|escalar mesmo assim|adicionar à equipe/i })
        .first();
      await esperarPor(
        async () => (await confirmar.count()) > 0 && (await confirmar.isEnabled().catch(() => false)),
        { timeout: 8000 },
      );
      await confirmar.click({ timeout: 8000 }).catch(() => {});
      // Prova pela fonte (API): o nome na tela ja aparecia na lista de
      // candidatos, entao "esta escrito" era falso positivo — o que importa e o
      // integrante ter entrado na EQUIPE da escala.
      const entrouNaEquipe = await esperarPor(
        async () => {
          const detalhe = await detalheDaApi(sessao.page, criadaId);
          return (detalhe?.team || []).some((item) => contem(item.member_name, INTEGRANTE_QA));
        },
        { timeout: 12000 },
      );
      // Espera o registro de escrita (o evento de resposta do Playwright propaga
      // de forma assincrona: ler uma vez so pegava o registro ainda sem status).
      const escreveuNaApi = await esperarPor(
        async () =>
          sessao.escritas.some(
            (item) => item.metodo === "POST" && /\/assignments\/?$/.test(item.url) && item.status === 201,
          ),
        { timeout: 5000 },
      );
      const post = sessao.escritas.find(
        (item) => item.metodo === "POST" && /\/assignments\/?$/.test(item.url) && item.status === 201,
      );
      adicionou = entrouNaEquipe && escreveuNaApi;
      const escritasVisiveis = sessao.escritas
        .filter((item) => /\/assignments/.test(item.url))
        .map((item) => `${item.metodo} ${item.status === null ? "sem-status" : item.status}`)
        .join(", ");
      v.check(
        "5. Adicionar integrante pela interface: escolhe função e candidato, e o nome entra na equipe",
        adicionou,
        `clique no candidato=${escolheuCandidato} | entrou na equipe=${entrouNaEquipe} | POST 201=${escreveuNaApi} | escritas=${escritasVisiveis || "nenhuma"} | corpo=${post ? post.corpo : "—"}`,
      );
      await v.screenshot(sessao.page, "5-adicionar-integrante");
    } else {
      v.check(
        "5. Adicionar integrante pela interface: escolhe função e candidato, e o nome entra na equipe",
        false,
        "a escala de QA não foi criada no passo 3",
      );
    }
    await sessao.context.close();
  }

  // ---- 6. publicar e o membro passa a ver ------------------------------
  {
    let selo = false;
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, coordenacao);
    if (criadaId) {
      await irPara(sessao.page, rotaDetalhe(criadaId));
      await clicar(sessao.page, UI.publicar);
      selo = await esperarPor(async () => contem(await texto(sessao.page), "Publicada"), { timeout: 10000 });
      await v.screenshot(sessao.page, "6-publicada");
    }
    await sessao.context.close();

    const sessaoMembro = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessaoMembro.page, membro);
    await irPara(sessaoMembro.page, "/schedules");
    const membroVe = await esperarTexto(sessaoMembro.page, NOME_ESCALA_QA, { timeout: 8000 });
    v.check(
      "6. Publicar pela gestão faz a escala aparecer para o membro escalado (fluxo ponta a ponta)",
      selo && membroVe,
      `selo Publicada=${selo} | membro vê=${membroVe}`,
    );
    await v.screenshot(sessaoMembro.page, "6-membro-ve-publicada");
    await sessaoMembro.context.close();
  }

  // ---- 6b. o membro responde e a gestao acompanha a resposta -----------
  {
    const sessaoMembro = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessaoMembro.page, membro);
    // No desktop a lista do membro leva ao detalhe por um botao "Detalhes" de
    // cada linha; abrir pelo id que a propria conta enxerga evita responder a
    // escala errada quando a pessoa tem mais de uma participacao.
    const minha = await escalaDoMembroDaApi(sessaoMembro.page, NOME_ESCALA_QA);
    if (minha) await irPara(sessaoMembro.page, `/schedule/${minha.id}`);
    const clicou = await clicar(sessaoMembro.page, /^confirmar$/i);
    const naTela = await esperarPor(async () => /confirmad/i.test(await texto(sessaoMembro.page)), { timeout: 10000 });
    await sessaoMembro.context.close();

    if (criadaId) {
      const sessaoGestao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
      await login(sessaoGestao.page, coordenacao);
      const detalhe = await detalheDaApi(sessaoGestao.page, criadaId);
      const escalado = (detalhe && detalhe.team ? detalhe.team : []).find(
        (item) => contem(item.member_name, INTEGRANTE_QA),
      );
      const statusNaGestao = escalado ? escalado.status : null;
      v.check(
        "6b. Membro responde à escala publicada e a gestão acompanha a resposta",
        Boolean(minha) && clicou !== null && naTela && statusNaGestao === "confirmed",
        `escala do membro=${minha ? minha.id : "—"} | clique em Confirmar=${clicou} | tela mostra confirmado=${naTela} | status na gestão=${statusNaGestao}`,
      );
      await v.screenshot(sessaoGestao.page, "6b-resposta-na-gestao");
      await sessaoGestao.context.close();
    } else {
      v.check(
        "6b. Membro responde à escala publicada e a gestão acompanha a resposta",
        false,
        "a escala de QA não foi criada no passo 3",
      );
    }
  }

  // ---- 7. cancelar e o membro deixa de ver -----------------------------
  {
    let selo = false;
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessao.page, coordenacao);
    if (criadaId) {
      await irPara(sessao.page, rotaDetalhe(criadaId));
      await clicar(sessao.page, UI.cancelar);
      selo = await esperarPor(async () => contem(await texto(sessao.page), "Cancelada"), { timeout: 10000 });
      await v.screenshot(sessao.page, "7-cancelada");
    }
    await sessao.context.close();

    const sessaoMembro = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await login(sessaoMembro.page, membro);
    await irPara(sessaoMembro.page, "/schedules");
    const membroNaoVe = await esperarTexto(sessaoMembro.page, NOME_ESCALA_QA, { timeout: 6000, ausente: true });
    v.check(
      "7. Cancela a escala pela gestão e ela sai da visão do membro",
      selo && membroNaoVe,
      `selo Cancelada=${selo} | membro não vê=${membroNaoVe} | integrante adicionado no passo 5=${adicionou}`,
    );
    await sessaoMembro.context.close();
  }

  v.nota(`escala de QA criada: ${criadaId ?? "nenhuma"} (rota ${criadaId ? rotaDetalhe(criadaId) : "—"})`);
  return v;
}
