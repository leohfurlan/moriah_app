import assert from 'node:assert/strict';
import { abrirNavegador } from '../lib/pw.mjs';
const base='http://127.0.0.1:8091';
const browser=await abrirNavegador();
try {
 for(const width of [360,390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  let unread=true;
  await context.addInitScript(()=>localStorage.setItem('moriah_access_token','mock'));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base&&!/^\/(api|backend|local-api)\//.test(url.pathname)) return route.continue();
   const endpoint=url.pathname.replace(/^\/(api|backend|local-api)/,'');
   if(endpoint==='/me/notifications/mark-all-read/') unread=false;
   let body=[];
   if(endpoint==='/me/') body={id:10,first_name:'Admin',email:'mock@invalid.test',role:'admin',roles:['admin'],capabilities:['manage_all'],church:1};
   if(endpoint==='/me/notifications/unread-count/') body={count:unread?3:0};
   if(endpoint==='/me/notifications/') body=[{id:1,title:'Aviso de teste',body:'Mensagem',category:'Igreja',created_at:new Date().toISOString(),is_read:!unread}];
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();
  await page.goto(base+'/profile');
  const bell=page.getByRole('button',{name:/Notifica.*avisos/}).last();
  await bell.waitFor();
  const badge=bell.getByTestId('notification-badge');
  await badge.waitFor();
  assert.equal(await badge.innerText(),'');
  assert.equal(await bell.locator('svg').count(),1);
  await bell.click();
  await page.waitForURL('**/notifications');
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.waitForURL('**/profile');
  await bell.click();
  await page.waitForURL('**/notifications');
  await page.getByRole('button',{name:'Marcar todas como lidas',exact:true}).click();
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.waitForURL('**/profile');
  await page.getByRole('button',{name:'Notifica\u00e7\u00f5es',exact:true}).last().waitFor();
  assert.equal(await page.getByTestId('notification-badge').count(),0);
  console.log(`PASS ${width}px: sino, ponto sem contador, leitura e voltar`);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>localStorage.setItem('moriah_access_token','mock'));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===base&&!/^\/(api|backend|local-api)\//.test(url.pathname)) return route.continue();
  let body=[];
  if(url.pathname.endsWith('/me/')) body={id:10,first_name:'Admin',capabilities:['manage_all'],role:'admin',church:1};
  if(url.pathname.endsWith('unread-count/')) body={count:0};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();
 await page.goto(base+'/notifications');
 await page.getByRole('button',{name:'Voltar',exact:true}).click();
 await page.waitForURL('**/home');
 console.log('PASS acesso direto retorna ao Inicio');
} finally {await browser.close();}
