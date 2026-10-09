import assert from 'node:assert/strict';
import { abrirNavegador } from '../lib/pw.mjs';
const base = process.env.QA_BASE || 'http://127.0.0.1:8091';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await abrirNavegador();
try {
 for (const width of [360, 390, 430, 1440]) {
  const context = await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(() => localStorage.setItem('moriah_access_token','mock'));
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===new URL(base).origin && !/^\/(api|backend|local-api)\//.test(url.pathname)) return route.continue();
   const endpoint=url.pathname.replace(/^\/(api|backend|local-api)/,'');
   let body=[];
   if(endpoint==='/me/') body={id:10,first_name:'Maria',email:'mock@invalid.test',role:'member',roles:['member'],member_id:10,has_member_profile:true,capabilities:['member'],church:1};
   if(endpoint==='/me/notifications/unread-count/') body={count:0};
   if(endpoint==='/me/events/') body=[{id:1,name:'Evento de teste',start_at:'2026-11-09T19:00:00-03:00',description:'Descricao do evento',location:'Igreja',event_type_display:'Evento especial'}];
   if(endpoint==='/event-announcements/') body=[{id:1,event:1,active:true,title:'Aviso com imagem',event_name:'Evento de teste',event_start_at:'2026-11-09T19:00:00-03:00',event_location:'Igreja',image_url:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="90"%3E%3Crect width="160" height="90" fill="pink"/%3E%3C/svg%3E'}];
   if(endpoint==='/me/agenda/') body=[{id:1,title:'Outro compromisso',starts_at:'2026-11-09T12:00:00-03:00',notes:'Pessoal'}];
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();
  await page.goto(`${base}/home`);
  const carousel=page.getByTestId('notice-carousel');
  await carousel.waitFor();
  await page.getByRole('button',{name:'Ir para aviso 1',exact:true}).click();
  const first=await carousel.boundingBox();
  const media=await page.getByTestId('notice-media').boundingBox();
  const copy=await page.getByTestId('notice-copy').boundingBox();
  assert.ok(media.width>first.width-45,'Banner ocupa largura interna');
  assert.ok(copy.y>=media.y+media.height,'Texto abaixo da imagem');
  await page.getByRole('button',{name:'Ir para aviso 2',exact:true}).click();
  const second=await carousel.boundingBox();
  assert.ok(Math.abs(first.height-second.height)<1,'Altura estável sem imagem');
  assert.ok(Math.abs(first.y-second.y)<1,'Posição estável');
  await page.goto(`${base}/agenda?event=1`);
  const panel=page.getByTestId('agenda-selected-day');
  await panel.getByText('Descricao do evento',{exact:true}).waitFor();
  assert.ok(await panel.getByText('Outro compromisso',{exact:true}).count(),'Todos os compromissos do dia');
  await page.getByRole('button',{name:'Selecionar 2026-11-21',exact:true}).click();
  await panel.getByText('Nenhum compromisso para este dia.',{exact:true}).waitFor();
  assert.equal(await panel.getByText('Evento de teste',{exact:true}).count(),0,'Evento de outro dia não aparece');
  await page.getByRole('button',{name:'Selecionar 2026-11-09',exact:true}).click();
  await panel.getByText('Descricao do evento',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem overflow');
  console.log(`PASS carrossel e agenda ${width}px`);
  await context.close();
 }
} finally {await browser.close();}
