// Real backend, disposable local QA accounts only; never seed or approve production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abrirNavegador } from '../lib/pw.mjs';
import { login } from '../lib/harness.mjs';
const base=process.env.QA_BASE || 'http://localhost:18033';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local QA only');
const accounts=JSON.parse(fs.readFileSync('tmp/member-link-qa-accounts.json','utf8'));
const browser=await abrirNavegador();
try {
 for (const account of accounts) {
  const context=await browser.newContext({viewport:account.label==='mobile'?{width:390,height:844}:{width:1440,height:1000}});
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  assert((await login(page,account,{base})).ok);
  await page.goto(base+'/profile');
  await page.getByRole('button',{name:'Solicitar vínculo cadastral',exact:true}).click();
  await page.getByText('Solicitação atual: Pendente',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Revisar solicitações de vínculo',exact:true}).click();
  await page.getByText(account.email,{exact:true}).locator('visible=true').first().click();
  await page.getByText('Situação: Pendente',{exact:true}).waitFor();
  if(account.label==='rejection') {
   await page.getByLabel('Motivo ou observações',{exact:true}).fill('Confira o cadastro com a secretaria.');
   await page.getByRole('button',{name:'Rejeitar solicitação',exact:true}).click();
   await page.getByRole('button',{name:'Confirmar rejeição',exact:true}).click();
   await page.getByText('Situação: Recusado',{exact:true}).waitFor();
   await page.goto(base+'/profile');
   await page.getByText('Solicitação atual: Recusado',{exact:true}).waitFor();
   await page.getByText('Motivo / observações: Confira o cadastro com a secretaria.',{exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'Solicitar vínculo cadastral',exact:true}).isEnabled());
  } else {
   await page.getByLabel('Buscar cadastro de membro',{exact:true}).fill(account.candidate);
   await page.getByRole('button',{name:'Buscar cadastros',exact:true}).click();
   await page.getByText('Selecionar: '+account.candidate,{exact:true}).click();
   await page.getByRole('button',{name:'Aprovar vínculo',exact:true}).click();
   await page.getByText(/Você está revisando sua própria solicitação/).waitFor();
   await page.getByRole('button',{name:'Confirmar aprovação',exact:true}).click();
   await page.getByText('Situação: Aprovado',{exact:true}).waitFor();
   // Navigate within the SPA to prove the cached account refreshes without login.
   await page.getByRole('button',{name:'Abrir menu da conta',exact:true}).click();
   await page.getByRole('button',{name:'Meu Perfil',exact:true}).click();
   await page.getByText(account.candidate,{exact:true}).locator('visible=true').first().waitFor();
   assert.equal(await page.getByRole('button',{name:'Solicitar vínculo cadastral',exact:true}).count(),0);
  }
  await page.goto(base+'/notifications');
  await page.getByText(account.label==='rejection'?'Vínculo cadastral não aprovado':'Vínculo cadastral aprovado',{exact:true}).first().waitFor();
  await page.getByText('Solicitação de vínculo cadastral',{exact:true}).first().click();
  await page.getByRole('button',{name:'Revisar solicitação',exact:true}).click();
  await page.waitForURL(/member-link-requests\/\d+/);
  await page.getByText(account.label==='rejection'?'Situação: Recusado':'Situação: Aprovado',{exact:true}).waitFor();
  await page.screenshot({path:`tmp/member-link-${account.label}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS '+account.label+': request, review, decision, profile, notifications, deep link');
  await context.close();
 }
} finally { await browser.close(); }
