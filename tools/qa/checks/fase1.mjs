// Fase 1 do plano de execucao — confiabilidade P0 (secao 6).
//
// Cada check corresponde a um criterio de aceite escrito no plano. A ideia e
// nao "confiar que o Alert nao existe mais", e sim provocar a situacao e ler o
// que a tela mostra depois.
import { conta, PAPEIS } from "../lib/accounts.mjs";
import { BASE, digitar, esperarPor, login, novaSessao, texto, VIEWPORT_DESKTOP } from "../lib/harness.mjs";
import { Verificacao } from "../lib/report.mjs";

const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const contem = (texto_, trecho) => normalizar(texto_).includes(normalizar(trecho));
const contemAlgum = (texto_, trechos) => trechos.some((trecho) => contem(texto_, trecho));
const caminho = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const HTML_DJANGO =
  '<!doctype html><html><head><title>Server Error (500)</title></head><body><h1>Server Error (500)</h1><pre>Traceback (most recent call last): django.core.exceptions.SuspiciousOperation</pre></body></html>';

async function irPara(page, rota) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
}

/** Le o texto do aviso flutuante (toast) enquanto ele ainda esta na tela. */
async function textoDoToast(page, { timeout = 6000 } = {}) {
  const seletor = '[data-testid="toast"]';
  const achou = await esperarPor(async () => (await page.locator(seletor).count()) > 0, { timeout, intervalo: 200 });
  if (!achou) return "";
  return page.locator(seletor).first().innerText().catch(() => "");
}

export async function executar({ browser, dir }) {
  const v = new Verificacao("fase-1-confiabilidade", { dir });
  v.nota(`fase 1 do plano | base=${BASE}`);
  const membro = conta(PAPEIS.membro);
  const admin = conta(PAPEIS.admin);

  // ---- 1. login invalido mostra erro visivel (e nenhum dialog nativo) ------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await irPara(sessao.page, "/");
    const inputs = sessao.page.locator("input");
    await digitar(inputs.nth(0), membro.email);
    await digitar(inputs.nth(1), "senha-que-nao-existe-qa");
    await sessao.page.getByRole("button", { name: /entrar/i }).first().click();
    const apareceu = await esperarPor(async () => {
      const visivel = contemAlgum(await texto(sessao.page), ["acesso negado", "senha incorretos", "falha no login"]);
      return visivel;
    }, { timeout: 8000 });
    const aviso = sessao.page.getByRole("alert").first();
    const temAlerta = (await aviso.count()) > 0;
    v.check(
      "1. Login inválido mostra erro visível na tela",
      apareceu && temAlerta,
      apareceu ? `mensagem: "${((await texto(sessao.page)).match(/(Acesso negado|E-mail ou senha[^\n]*)/i) || [""])[0]}"` : `nenhuma mensagem; texto: ${(await texto(sessao.page, 300)).replace(/\n/g, " | ")}`,
    );
    v.check("1b. Nenhum dialog nativo (Alert) disparado", sessao.dialogs.length === 0, `${sessao.dialogs.length} dialog(s)`);
    await v.screenshot(sessao.page, "1-login-invalido");
    await sessao.context.close();
  }

  // ---- 2. membro nao cria escala: erro visivel + redirecionamento ----------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/schedule-create");
    const aviso = await textoDoToast(sessao.page, { timeout: 8000 });
    const redirecionou = await esperarPor(async () => caminho(sessao.page.url()) === "/schedules", { timeout: 8000 });
    v.check(
      "2. Membro em /schedule-create recebe erro de permissão visível e volta para as escalas",
      redirecionou && contemAlgum(aviso, ["permissao", "permissão", "acesso restrito"]),
      `url=${caminho(sessao.page.url())} | aviso="${aviso.replace(/\n/g, " ")}"`,
    );
    const posts = sessao.escritas.filter((item) => item.metodo === "POST" && /schedules/.test(item.url));
    v.check("2b. Nenhuma tentativa de gravação de escala partiu da conta de membro", posts.length === 0, `${posts.length} POST(s)`);
    await v.screenshot(sessao.page, "2-membro-sem-permissao");
    await sessao.context.close();
  }

  // ---- 3 e 4. admin cria escala: confirmacao + agenda + sem duplicidade ----
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, admin);
    v.check("preparo: login da conta de gestão", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/schedule-create");
    const marca = Date.now();
    const evento = `QA escala ${marca}`;
    await digitar(sessao.page.getByPlaceholder(/Culto de celebra/i), evento);
    await digitar(sessao.page.getByPlaceholder(/Louvor/), `Escala QA ${marca}`);
    const botao = sessao.page.getByRole("button", { name: /salvar como rascunho/i }).first();
    // Tres cliques no mesmo tick: o defeito antigo criava a escala tres vezes.
    // (Fase 4: o formulario nasce como RASCUNHO — "Salvar como rascunho" — e nao
    // mais publica direto, por isso o botao mudou de nome.)
    // A confirmacao e lida EM PARALELO: os cliques 2 e 3 esperam o botao voltar a
    // ficar habilitado e, quando resolvem, o toast de 6s pode ja ter sumido.
    const confirmacaoPromessa = textoDoToast(sessao.page, { timeout: 12000 });
    await Promise.all([
      botao.click({ timeout: 10000 }).catch(() => {}),
      botao.click({ timeout: 10000 }).catch(() => {}),
      botao.click({ timeout: 10000 }).catch(() => {}),
    ]);
    const confirmação = await confirmacaoPromessa;
    // Destino agora e a gestao da escala criada (o evento entra na agenda da
    // igreja do mesmo jeito — verificado na fase 4).
    const naGestaoDaEscala = await esperarPor(
      async () => /^\/schedule-admin\/\d+$/.test(caminho(sessao.page.url())),
      { timeout: 10000 },
    );
    v.check(
      "3. Gestão cria escala como rascunho, recebe confirmação e cai na gestão da escala",
      naGestaoDaEscala && contemAlgum(confirmação, ["rascunho criado", "escala publicada"]),
      `url=${caminho(sessao.page.url())} | confirmação="${confirmação.replace(/\n/g, " ")}"`,
    );
    const posts = sessao.escritas.filter((item) => item.metodo === "POST" && /\/schedules\/?$/.test(new URL(item.url).pathname));
    v.check(
      "4. Três cliques rápidos não criam duplicidade (1 gravação)",
      posts.length === 1,
      `${posts.length} POST(s) para ${posts.map((item) => new URL(item.url).pathname).join(", ") || "nenhum"}`,
    );
    await v.screenshot(sessao.page, "3-escala-criada");
    await sessao.context.close();
  }

  // ---- 5. contribuicao sem comprovante mostra validacao --------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro (contribuição)", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/contribution");
    const enviar = sessao.page.getByRole("button", { name: /enviar/i }).first();
    if ((await enviar.count()) === 0) {
      v.check("5. Contribuição sem comprovante mostra validação", false, "botão de envio não encontrado na tela");
    } else {
      await enviar.click({ timeout: 10000 }).catch(() => {});
      const avisou = await esperarPor(async () => contemAlgum(await texto(sessao.page), ["comprovante obrigatorio", "comprovante obrigatório", "anexe ao menos"]), { timeout: 6000 });
      v.check("5. Contribuição sem comprovante mostra validação na própria tela", avisou, avisou ? "aviso de comprovante exibido" : "nenhum aviso apareceu");
      const posts = sessao.escritas.filter((item) => item.metodo === "POST" && /contributions/.test(item.url));
      v.check("5b. Nada foi enviado ao servidor sem comprovante", posts.length === 0, `${posts.length} POST(s)`);
    }
    await v.screenshot(sessao.page, "5-contribuicao-sem-comprovante");
    await sessao.context.close();
  }

  // ---- 6. HTML de erro do Django nunca chega na tela -----------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro (erro 500)", acesso.ok, `url=${acesso.url}`);
    await sessao.page.route("**/api/me/statement/**", (rota) =>
      rota.fulfill({ status: 500, contentType: "text/html", body: HTML_DJANGO }),
    );
    await irPara(sessao.page, "/statement");
    const conteudo = await texto(sessao.page);
    const vazouHtml = contemAlgum(conteudo, ["server error", "traceback", "doctype html", "suspiciousoperation", "unexpected token"]);
    const explicou = contemAlgum(conteudo, ["servidor", "tente novamente", "instantes", "sem conexao"]);
    const bateu500 = sessao.http.some((item) => item.status === 500);
    v.check(
      "6. Erro 500 em HTML nunca aparece para o membro (mensagem amigável no lugar)",
      !vazouHtml && explicou,
      `500 visto=${bateu500} | vazou HTML=${vazouHtml} | mensagem=${explicou}`,
    );
    await v.screenshot(sessao.page, "6-erro-500-html");
    await sessao.context.close();
  }

  // ---- 7. rota inexistente abre 404 em portugues ---------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    await irPara(sessao.page, "/rota-que-nao-existe-qa");
    const conteudo = await texto(sessao.page);
    const emPortugues = contemAlgum(conteudo, ["nao encontramos esta pagina", "não encontramos esta página", "pagina nao encontrada", "página não encontrada"]);
    const emIngles = contemAlgum(conteudo, ["unmatched route", "page could not be found", "this screen does not exist"]);
    v.check("7. Rota inexistente abre 404 em português", emPortugues && !emIngles, `portugues=${emPortugues} | padrao do expo=${emIngles}`);
    await v.screenshot(sessao.page, "7-404");
    await sessao.context.close();
  }

  // ---- 8. musica sem escala na URL nao chama API com undefined -------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const requisicoes = [];
    sessao.page.on("request", (req) => requisicoes.push(req.url()));
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro (música)", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/song/1");
    const conteudo = await texto(sessao.page);
    const comUndefined = requisicoes.filter((url) => /undefined/.test(url));
    const explicou = contemAlgum(conteudo, ["sem contexto", "abra a escala", "ver minhas escalas"]);
    v.check(
      "8. Música sem escala na URL não dispara chamada com undefined",
      comUndefined.length === 0 && explicou,
      `chamadas com undefined=${comUndefined.length} | tela orienta=${explicou}`,
    );
    await v.screenshot(sessao.page, "8-musica-sem-contexto");
    await sessao.context.close();
  }

  // ---- 9. painel do membro sem KPI inventado ------------------------------
  {
    const sessao = await novaSessao(browser, { viewport: VIEWPORT_DESKTOP });
    const acesso = await login(sessao.page, membro);
    v.check("preparo: login do membro (painel)", acesso.ok, `url=${acesso.url}`);
    await irPara(sessao.page, "/home");
    const conteudo = await texto(sessao.page);
    const inventados = [
      "membros ativos",
      "87% confirmado",
      "7 de 12 aulas",
      "O Deus que vê",
      "Adicionar membro",
      "Criar culto",
      "Criar turma",
      "Continuar na Escola Bíblica",
    ];
    const achados = inventados.filter((trecho) => contem(conteudo, trecho));
    const reais = ["Contribuições no mês", "Escalas pendentes", "Minhas contribuições"].filter((trecho) => contem(conteudo, trecho));
    v.check(
      "9. Painel do membro não exibe KPI/listas inventadas (só dado real ou ausência explícita)",
      achados.length === 0 && reais.length >= 2,
      `inventados=${achados.length ? achados.join(", ") : "nenhum"} | painéis reais=${reais.join(", ") || "nenhum"}`,
    );
    await v.screenshot(sessao.page, "9-painel-sem-dado-inventado");
    await sessao.context.close();
  }

  return v;
}
