// Local real-backend acceptance with synthetic fixtures; no production hosts.
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {abrirNavegador} from "../lib/pw.mjs";
const base = process.env.MORIAH_QA_BASE || "http://127.0.0.1:18410";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local QA only");
const container = "moriah-f11-qa-backend";
const fixture = action => execFileSync("docker", ["exec",container,"python","manage.py","shell","-c",`qa_action='${action}'; exec(open('/tools/qa/scripts/f11-fixtures.py').read())`], {stdio:"pipe"});
fs.mkdirSync("output/playwright/f11", {recursive:true});
const browser = await abrirNavegador();
let currentPage;
async function login(page,email) {
  await page.goto(base);
  await page.getByRole("button",{name:"Entrar com e-mail e senha",exact:true}).click();
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("Sua senha").fill("F11-local-only-2026");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await page.waitForURL(url => url.pathname === "/onboarding");
}
try {
  for (const [surface, viewport] of [["desktop",{width:1440,height:1000}],["mobile",{width:390,height:844}]]) {
    fixture("reset");
    const context = await browser.newContext({viewport}); const page = await context.newPage(); currentPage = page;
    const errors = []; page.on("pageerror",error => errors.push(error.message));
    await login(page,`f11-admin-${surface}@example.invalid`);
    await page.getByRole("button",{name:"Começar",exact:true}).click();
    await page.getByLabel("Data de nascimento",{exact:true}).fill("01/05/2999");
    await page.getByRole("button",{name:"Estou conhecendo a igreja",exact:true}).click();
    await page.getByRole("button",{name:"Concluir perfil",exact:true}).click();
    await page.getByText("A data não pode estar no futuro.",{exact:false}).waitFor();
    await page.getByLabel("Data de nascimento",{exact:true}).fill("01/05/1990");
    await page.getByRole("button",{name:"Salvar e continuar depois",exact:true}).click();
    await page.reload();
    assert.equal(await page.getByLabel("Data de nascimento",{exact:true}).inputValue(),"01/05/1990");
    await page.screenshot({path:`output/playwright/f11/${surface}-profile.png`,fullPage:true});
    await page.goto(base + "/settings");
    await page.waitForURL(url => url.pathname === "/onboarding");
    await page.getByRole("button",{name:"Concluir perfil",exact:true}).click();
    await page.getByText("Seu cadastro inicial está completo",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Configurar a igreja",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar que revisei: Revisar dados da igreja",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar que revisei: Conferir equipe e permissões",exact:true}).click();
    await page.getByText("Configuração da igreja · 33%",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Abrir: Cadastrar horários dos cultos",exact:true}).click();
    await page.getByLabel("Horário do culto",{exact:true}).fill("19:00");
    await page.getByLabel("Local do culto",{exact:true}).fill("Templo QA");
    await page.getByRole("button",{name:"Salvar horário",exact:true}).click();
    await page.getByText("Domingo · 19:00",{exact:true}).waitFor();
    await page.screenshot({path:`output/playwright/f11/${surface}-services.png`,fullPage:true});
    fixture("fill");
    await page.goto(base + "/settings");
    await page.getByText("Configuração da igreja · 100%",{exact:true}).waitFor();
    await page.screenshot({path:`output/playwright/f11/${surface}-setup.png`,fullPage:true});
    await page.getByRole("button",{name:"Dispensar card do painel",exact:true}).click();
    await page.getByRole("button",{name:"Dispensar card do painel",exact:true}).waitFor({state:"hidden"});
    await page.goto(base + "/home");
    await page.getByText("Configuração da igreja · 100%",{exact:true}).waitFor({state:"hidden"});
    fixture("remove-cell");
    await page.reload();
    await page.getByText("Configuração da igreja · 83%",{exact:true}).waitFor();
    await page.screenshot({path:`output/playwright/f11/${surface}-card-returned.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    await context.close();

    const visitorContext = await browser.newContext({viewport}); const visitor = await visitorContext.newPage(); currentPage = visitor;
    await login(visitor,`f11-visitor-${surface}@example.invalid`);
    await visitor.getByRole("button",{name:"Pular apresentação",exact:true}).click();
    await visitor.getByLabel("Data de nascimento",{exact:true}).fill("10/10/2000");
    await visitor.getByRole("button",{name:"Já sou membro",exact:true}).click();
    await visitor.getByRole("button",{name:"Concluir perfil",exact:true}).click();
    await visitor.getByText("Sua solicitação foi enviada. A secretaria vai conferir seu vínculo com a igreja.",{exact:true}).waitFor();
    await visitor.screenshot({path:`output/playwright/f11/${surface}-visitor-pending.png`,fullPage:true});
    await visitor.getByRole("button",{name:"Horários dos cultos",exact:true}).click();
    await visitor.getByText("Domingo · 19:00",{exact:true}).waitFor();
    assert.equal(await visitor.getByRole("button",{name:"Salvar horário",exact:true}).count(),0);
    await visitor.goto(base + "/settings");
    await visitor.waitForURL(url => url.pathname === "/home");
    await visitorContext.close();
    console.log(`PASS ${surface}: profile, resume, guards, weekly services, setup, dismissal/regression, visitor pending`);
  }
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({path:"output/playwright/f11/failure.png",fullPage:true});
    console.error("Failure URL:",currentPage.url());
    console.error((await currentPage.locator("body").innerText()).slice(-5000));
  }
  throw error;
} finally {await browser.close();}
