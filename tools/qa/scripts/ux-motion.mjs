import assert from "node:assert/strict";
import fs from "node:fs";
import {resolverPlaywright,resolverChrome} from "../lib/pw.mjs";
import {conta} from "../lib/accounts.mjs";
import {login} from "../lib/harness.mjs";
const base=process.env.QA_BASE || "http://localhost:18031";
const credentials=process.env.QA_CREDENTIAL_FILE ? JSON.parse(fs.readFileSync(process.env.QA_CREDENTIAL_FILE,"utf8")) : conta("admin");
const {chromium}=await import(resolverPlaywright());
const browser=await chromium.launch({headless:true,executablePath:resolverChrome()});
try {
 for(const [name,viewport,reducedMotion] of [["desktop",{width:1440,height:1000},"no-preference"],["mobile",{width:390,height:844},"no-preference"],["reduced",{width:1024,height:900},"reduce"]]) {
  const context=await browser.newContext({viewport,reducedMotion}); const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  assert((await login(page,credentials,{base})).ok,`Login ${name}`);
  assert.equal(await page.getByRole('button',{name:'Sair da conta',exact:true}).count(),0);
  const trigger=page.getByRole('button',{name:'Abrir menu da conta',exact:true});
  await trigger.click();
  await page.getByTestId('account-menu').waitFor();
  assert(await page.getByRole('button',{name:'Meu Perfil',exact:true}).isVisible());
  assert(await page.getByRole('button',{name:'Sair da conta',exact:true}).isVisible());
  await page.waitForTimeout(350); // Capture the settled panel, after its entrance.
  await page.screenshot({path:`tmp/ux-account-${name}.png`,fullPage:true});
  await page.keyboard.press('Escape');
  await page.getByTestId('account-menu').waitFor({state:'hidden'});
  assert(await trigger.evaluate(el=>el===document.activeElement),'Escape restores trigger focus');
  await trigger.click();await page.getByTestId('account-menu').waitFor();await page.mouse.click(12,viewport.height-120);
  await page.getByTestId('account-menu').waitFor({state:'hidden'});
  await trigger.click();await page.getByRole('button',{name:'Meu Perfil',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/profile');
  if(name!=='mobile') {
   const sidebarLocator=page.locator('[data-testid="sidebar"]:visible');
   const sidebar=await sidebarLocator.elementHandle();
   assert(sidebar);
   const duration=await sidebar.evaluate(el=>getComputedStyle(el).transitionDuration);
   assert.equal(duration,name==='reduced'?'0s':'0.24s');
   const link=sidebarLocator.getByRole('link').first();
   const normal=await link.evaluate(el=>getComputedStyle(el).backgroundColor);
   await link.hover();await page.waitForTimeout(200);
   assert.notEqual(await link.evaluate(el=>getComputedStyle(el).backgroundColor),normal,'Sidebar hover feedback');
   await page.getByRole('button',{name:'Recolher menu',exact:true}).click();
   if(name==='desktop') {
    await page.waitForTimeout(60);
    const intermediate=(await sidebar.boundingBox()).width;
    assert(intermediate>0 && intermediate<280,`Sliding sidebar: ${intermediate}`);
   }
   await page.waitForTimeout(300);
   assert.equal(await sidebar.evaluate(el=>parseFloat(getComputedStyle(el).width)),0);
   assert.equal(await sidebar.evaluate(el=>el.querySelectorAll('[tabindex="0"]').length),0,'Hidden sidebar must leave keyboard order');
   await page.getByRole('button',{name:'Expandir menu',exact:true}).click();
   await page.waitForTimeout(300);assert.equal((await sidebar.boundingBox()).width,280);
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow');
  await page.getByRole('button',{name:'Abrir menu da conta',exact:true}).click();
  await page.getByRole('button',{name:'Sair da conta',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(`PASS ${name}: menu, Escape/foco, clique fora, Perfil, logout, hover/slide e movimento reduzido`);
  await context.close();
 }
}finally{await browser.close();}
