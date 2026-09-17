// Sessao de navegador instrumentada: console, pageerror, HTTP >= 400 e dialogs.
// Todo check usa este harness para que a evidencia saia da mesma fonte.
export const BASE = process.env.QA_BASE || "http://localhost:8081";
export const VIEWPORT_DESKTOP = { width: 1440, height: 1024 };
export const VIEWPORT_MOBILE = { width: 390, height: 844 };

const CONSOLE_IGNORAR = [
  /Download the React DevTools/,
  /Running application "main"/,
  /shadow\*.*deprecated/,
  /React Native Web/,
  /\[expo\]/i,
];

/** Abre contexto+pagina com coletores ligados. */
export async function novaSessao(browser, { viewport = VIEWPORT_DESKTOP, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport,
    locale: "pt-BR",
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const estado = {
    page,
    context,
    console: [],
    pageerrors: [],
    http: [],
    dialogs: [],
    escritas: [],
  };

  page.on("console", (msg) => {
    const tipo = msg.type();
    if (tipo !== "error" && tipo !== "warning") return;
    const texto = msg.text();
    if (CONSOLE_IGNORAR.some((re) => re.test(texto))) return;
    estado.console.push({ tipo, texto });
  });
  page.on("pageerror", (erro) => estado.pageerrors.push(String(erro.message || erro)));
  page.on("dialog", async (dialog) => {
    estado.dialogs.push({ tipo: dialog.type(), msg: dialog.message() });
    await dialog.dismiss().catch(() => {});
  });
  page.on("response", (resposta) => {
    if (resposta.status() >= 400) {
      estado.http.push({
        status: resposta.status(),
        metodo: resposta.request().method(),
        url: resposta.url(),
      });
    }
    // O status da escrita e fechado pela PROPRIA resposta. Antes isso era feito
    // com `req.response()` dentro do handler de request e, por corrida, as vezes
    // resolvia null: a evidencia ficava sem status e o check concluia "o clique
    // nao chegou na API" com a escala ja criada no banco.
    if (resposta.request().method() === "GET") return;
    const escrita = estado.escritas.find((item) => item.status === null && item.url === resposta.url());
    if (escrita) escrita.status = resposta.status();
  });
  // Requisicoes de escrita (evidencia de "o clique chegou na API").
  page.on("request", (req) => {
    if (req.method() === "GET") return;
    estado.escritas.push({
      metodo: req.method(),
      url: req.url(),
      corpo: (req.postData() || "").slice(0, 300),
      status: null,
    });
  });

  estado.limpar = () => {
    estado.console.length = 0;
    estado.pageerrors.length = 0;
    estado.http.length = 0;
    estado.dialogs.length = 0;
    estado.escritas.length = 0;
  };
  return estado;
}

/** Login programatico pela tela (usa os inputs reais, como um usuario). */
export async function login(page, { email, password }, { base = BASE, espera = 3000 } = {}) {
  const resultado = { ok: false, url: "", erro: "" };
  try {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const inputs = page.locator("input");
    if ((await inputs.count()) >= 2) {
      await inputs.nth(0).fill(email);
      await inputs.nth(1).fill(password);
    }
    const botao = page.getByRole("button", { name: /entrar/i }).first();
    await botao.click({ timeout: 10000 });
    await page.waitForTimeout(espera);
    resultado.url = new URL(page.url()).pathname;
    resultado.ok = resultado.url !== "/" && resultado.url !== "";
  } catch (erro) {
    resultado.erro = String(erro.message || erro);
  }
  return resultado;
}

/** Texto renderizado da tela (a evidencia mais estavel). */
export async function texto(page, limite = 6000) {
  return (await page.locator("body").innerText().catch(() => "")).slice(0, limite);
}

/** Preenche digitando de verdade: `fill` NAO atualiza o estado do React no RN Web. */
export async function digitar(locator, valor) {
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(valor, { delay: 20 });
}

/** Espera ate o predicado virar verdadeiro (ou estoura o tempo). */
export async function esperarPor(fn, { timeout = 8000, intervalo = 250 } = {}) {
  const limite = Date.now() + timeout;
  for (;;) {
    const valor = await fn().catch(() => false);
    if (valor) return true;
    if (Date.now() > limite) return false;
    await new Promise((r) => setTimeout(r, intervalo));
  }
}
