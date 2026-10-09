// Real local backend with a fake transport. Refuses production targets.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolverPlaywright, resolverChrome } from "../lib/pw.mjs";
const base = process.env.MORIAH_QA_BASE || "http://localhost:18030";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local QA only");
const codeFile = process.env.OTP_QA_CODE_FILE;
assert(codeFile, "Set OTP_QA_CODE_FILE to the local fake transport output");
const { chromium } = await import(resolverPlaywright());
const browser = await chromium.launch({headless: true, executablePath: resolverChrome()});
try {
  for (const [name, viewport] of [["desktop", {width:1440,height:1000}], ["mobile", {width:390,height:844}]]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const phone = name === "desktop" ? "119" + Date.now().toString().slice(-8) : "219" + Date.now().toString().slice(-8);
    const email = `whatsapp-qa-${Date.now()}@example.com`;
    await page.goto(base);
    await page.getByLabel("Número do WhatsApp", {exact:true}).fill(phone);
    await page.getByRole("button", {name:"Receber código no WhatsApp",exact:true}).click();
    await page.getByLabel("Código de seis dígitos",{exact:true}).waitFor();
    const code = JSON.parse(fs.readFileSync(codeFile,"utf8")).code;
    await page.getByLabel("Código de seis dígitos",{exact:true}).fill(code === "111111" ? "222222" : "111111");
    await page.getByRole("button",{name:"Validar código",exact:true}).click();
    await page.getByText("Código inválido ou expirado. Solicite outro código.",{exact:true}).waitFor();
    await page.getByLabel("Código de seis dígitos",{exact:true}).fill(code);
    await page.getByRole("button",{name:"Validar código",exact:true}).click();
    await page.getByLabel("Nome completo",{exact:true}).fill(`Visitante ${name}`);
    await page.getByLabel("E-mail do cadastro",{exact:true}).fill(email);
    await page.screenshot({path:`tmp/whatsapp-onboarding-${name}.png`,fullPage:true});
    await page.getByRole("button",{name:"Concluir cadastro",exact:true}).click();
    await page.waitForURL(url => url.pathname === "/home");
    await page.getByRole("button",{name:"Sair da conta",exact:true}).click();
    await page.waitForURL(url => url.pathname === "/");
    // Advance only this QA number's cooldown, without waiting a minute.
    execFileSync("docker",["exec","moriah-whatsapp-qa-backend","python","manage.py","shell","-c",
      `from apps.accounts.whatsapp import digest; from apps.accounts.models import WhatsAppSendLimit; from django.utils import timezone; from datetime import timedelta; WhatsAppSendLimit.objects.filter(key=digest('phone:1:+55${phone}')).update(last_sent=timezone.now()-timedelta(minutes=2))`]);
    await page.getByLabel("Número do WhatsApp",{exact:true}).fill(phone);
    await page.getByRole("button",{name:"Receber código no WhatsApp",exact:true}).click();
    await page.getByLabel("Código de seis dígitos",{exact:true}).waitFor();
    await page.getByLabel("Código de seis dígitos",{exact:true}).fill(JSON.parse(fs.readFileSync(codeFile,"utf8")).code);
    await page.getByRole("button",{name:"Validar código",exact:true}).click();
    await page.waitForURL(url => url.pathname === "/home");
    assert(!await page.getByText("Concluir cadastro",{exact:true}).count());
    await page.goto(base + "/profile");
    const linkedPhone = "319" + Date.now().toString().slice(-8);
    await page.getByLabel("Número do WhatsApp",{exact:true}).fill(linkedPhone);
    await page.getByRole("button",{name:"Receber código no WhatsApp",exact:true}).click();
    await page.getByLabel("Código de seis dígitos",{exact:true}).waitFor();
    await page.getByLabel("Código de seis dígitos",{exact:true}).fill(JSON.parse(fs.readFileSync(codeFile,"utf8")).code);
    await page.getByRole("button",{name:"Confirmar vínculo",exact:true}).click();
    await page.getByText("WhatsApp vinculado",{exact:true}).waitFor();
    console.log(`PASS ${name}: código inválido, cadastro real como visitante, logout, login e vínculo no perfil`);
    await context.close();
  }
} finally {await browser.close();}
