import assert from 'node:assert/strict';
// Runs only against the disposable local F11 UX backend and synthetic fixtures.
import {execFileSync} from 'node:child_process';
import {abrirNavegador} from '../lib/pw.mjs';
const base='http://127.0.0.1:18410';
const fixture=() => execFileSync('docker',['exec','moriah-f11-ux-backend','python','manage.py','shell','-c',"qa_action='reset'; exec(open('/tools/qa/scripts/f11-fixtures.py').read()); from apps.accounts.models import User; User.objects.filter(church=church,email__startswith='ux-team-').delete()"],{stdio:'pipe'});
const browser=await abrirNavegador();
let current;
async function login(page,surface) {
 await page.goto(base);
 await page.getByRole('button',{name:'Entrar com e-mail e senha',exact:true}).click();
 await page.getByPlaceholder('seu@email.com').fill(`f11-admin-${surface}@example.invalid`);
 await page.getByPlaceholder('Sua senha').fill('F11-local-only-2026');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('button',{name:'Começar',exact:true}).waitFor();
}
try {
 for(const [surface,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
  fixture();
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'});
  const page=await context.newPage(); current=page;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page,surface);
  await page.evaluate(() => {
    window.transitionFrames=[];
    const collect=()=>{const layer=Array.from(document.querySelectorAll('[aria-hidden="true"]')).find(node=>getComputedStyle(node).position==='absolute' && node.style.opacity!==''); if(layer) window.transitionFrames.push(layer.style.opacity);};
    window.transitionObserver=new MutationObserver(collect);window.transitionObserver.observe(document.body,{subtree:true,attributes:true,childList:true});
  });
  await page.getByRole('button',{name:'Começar',exact:true}).click();
  const birth=page.getByLabel('Data de nascimento',{exact:true}); await birth.waitFor();
  await birth.pressSequentially('20021995');assert.equal(await birth.inputValue(),'20/02/1995');
  await birth.fill('20/02/1995');assert.equal(await birth.inputValue(),'20/02/1995');
  const nameLabel=await page.getByText('Nome completo',{exact:true}).boundingBox();
  const nameField=await page.getByLabel('Nome completo',{exact:true}).boundingBox();assert(nameLabel.y<nameField.y);
  assert.equal(await page.getByText('Usamos sua data de nascimento',{exact:false}).evaluate(node=>getComputedStyle(node).textAlign),'justify');
  await page.getByRole('button',{name:'Selecionar data de nascimento no calendário',exact:true}).click();
  await page.getByLabel('Ano do calendário').fill('2000');
  await page.getByRole('button',{name:'29/02/2000',exact:true}).waitFor();
  await page.screenshot({path:`output/playwright/f11/ux-${surface}-calendar.png`,fullPage:true});
  await page.getByRole('button',{name:'29/02/2000',exact:true}).click();assert.equal(await birth.inputValue(),'29/02/2000');
  assert((await page.evaluate(()=>window.transitionFrames)).some(value=>Number(value)>0&&Number(value)<1),'Crossfade intermediate frames');
  await page.getByLabel('Ano do calendário').waitFor({state:'hidden'});
  await page.screenshot({path:`output/playwright/f11/ux-${surface}-profile.png`,fullPage:true});
  await page.getByRole('button',{name:'Estou conhecendo a igreja',exact:true}).click();
  await page.getByRole('button',{name:'Concluir perfil',exact:true}).click();
  await page.getByRole('button',{name:'Configurar a igreja',exact:true}).click();
  await page.getByRole('button',{name:'Abrir: Revisar dados da igreja',exact:true}).click();
  await page.getByLabel('Razão social',{exact:true}).fill(`Igreja QA ${surface}`);
  await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();
  await page.getByText('Cadastro salvo com sucesso.',{exact:true}).filter({visible:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/settings/church');
  await page.reload();assert.equal(await page.getByLabel('Razão social',{exact:true}).inputValue(),`Igreja QA ${surface}`);
  await page.screenshot({path:`output/playwright/f11/ux-${surface}-church.png`,fullPage:true});
  for(const [kind,label] of [['team','Conferir equipe e permissões'],['events','Publicar primeiro evento'],['cells','Cadastrar primeira célula'],['ministries','Cadastrar primeiro ministério']]) {
   await page.getByRole('button',{name:'Voltar às configurações',exact:true}).click();
   await page.getByRole('button',{name:`Abrir: ${label}`,exact:true}).click();
   assert.equal(new URL(page.url()).pathname,`/settings/${kind}`);
   await page.getByRole('button',{name:'Adicionar cadastro',exact:true}).click();
   await page.getByRole('textbox',{name:kind==='team'?'Nome completo':'Nome',exact:true}).fill(`QA ${kind} ${surface}`);
   if(kind==='team') {
    await page.getByLabel('E-mail',{exact:true}).fill(`ux-team-${surface}@example.invalid`);
    await page.getByLabel('Senha inicial',{exact:true}).fill('Strong-2026-QA-only!');
    await page.getByRole('button',{name:'Secretaria',exact:true}).first().click();
   }
   if(kind==='events') {
    await page.getByLabel('Data de início',{exact:true}).fill('01112026');
    await page.getByLabel('Horário de início (HH:MM)',{exact:true}).fill('19:30');
   }
   if(kind==='ministries') await page.getByRole('button',{name:`Pessoa admin ${surface}`,exact:true}).click();
   await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();
   await page.getByText('Cadastro salvo com sucesso.',{exact:true}).filter({visible:true}).waitFor();
   await page.getByRole('button',{name:`Editar QA ${kind} ${surface}`,exact:true}).click();
   await page.getByRole('textbox',{name:kind==='team'?'Nome completo':'Nome',exact:true}).fill(`QA ${kind} ${surface} revisado`);
   await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();
   await page.getByText(`QA ${kind} ${surface} revisado`,{exact:true}).waitFor();
  }
  await page.screenshot({path:`output/playwright/f11/ux-${surface}-registrations.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log(`${surface}: crossfade, labels, máscara, calendário bissexto, alinhamento, cinco cadastros e persistência OK`);
  await context.close();
 }
 fixture();
 const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();current=page;
 await login(page,'desktop');await page.getByRole('button',{name:'Começar',exact:true}).click();
 await page.getByLabel('Data de nascimento',{exact:true}).waitFor();
 assert.equal(await page.locator('[aria-hidden="true"][style*="opacity"]').count(),0);
 console.log('Preferência de movimento reduzido respeitada');await context.close();
} catch(e) {if(current) {await current.screenshot({path:'output/playwright/f11/ux-failure.png',fullPage:true}); console.log((await current.locator('body').innerText()).slice(-4500));}throw e;}
finally {await browser.close();}
