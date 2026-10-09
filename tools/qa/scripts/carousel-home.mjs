import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import {abrirNavegador} from '../lib/pw.mjs';
const root=path.resolve(process.env.CAROUSEL_BUNDLE || 'tmp/carousel-web');
const server=http.createServer((req,res)=>{const target=path.join(root,new URL(req.url,'http://local').pathname); const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html'); res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(18411,'127.0.0.1',r));
const browser=await abrirNavegador();
const failures=[]; fs.mkdirSync('output/playwright/carousel',{recursive:true});
try {for (const [surface,width] of [['desktop',1440],['mobile',390]]) {
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();
 await page.addInitScript(()=>localStorage.setItem('moriah_access_token','synthetic-local-token'));
 await page.route('**/backend/**',route=>{const url=new URL(route.request().url());let body=[];
  if(url.pathname==='/backend/me/')body={id:1,email:'qa@example.invalid',first_name:'QA',last_name:'Admin',role:'admin',roles:['admin'],church:1,member_id:null,has_member_profile:false,can_access_management:true,onboarding_completed:true,capabilities:['manage_all','manage_events','review_contributions']};
  if(url.pathname==='/backend/church/setup/')body={card_visible:false,percentage:100,completed_count:6,total_count:6,items:[]};
  if(url.pathname==='/backend/me/notifications/unread-count/')body={count:0};
  if(url.pathname==='/backend/event-announcements/')body=[{id:2,event:1,title:'Aviso oculto',image_url:'https://example.invalid/hidden.svg',position:2,active:false},{id:1,event:1,title:'Folder de teste',event_name:'Evento',event_start_at:'2026-12-01T19:00:00Z',event_location:'Templo',image_url:'https://example.invalid/folder.svg',position:1,active:true}];
  return route.fulfill({json:body});
 });
 await page.route('https://example.invalid/folder.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#4f46e5"/></svg>'}));
 await page.goto('http://127.0.0.1:18411/home');await page.getByText('Visão administrativa',{exact:true}).waitFor();
 try {await page.getByRole('button',{name:'Abrir Folder de teste',exact:true}).first().waitFor({timeout:3000});const image=page.locator('img[src="https://example.invalid/folder.svg"]');assert(await image.isVisible());assert(await image.evaluate(node=>node.complete&&node.naturalWidth>0));assert.equal(await page.getByRole('button',{name:'Abrir Aviso oculto',exact:true}).count(),0); const box=await image.boundingBox(); assert(Math.abs(box.width/box.height-16/9)<0.02); if(surface==='mobile')assert(box.width>300); await image.scrollIntoViewIfNeeded(); await page.screenshot({path:'output/playwright/carousel/'+surface+'.png',fullPage:true}); await page.goto('http://127.0.0.1:18411/events'); await page.getByText('Recomendado: 1920 × 1080 pixels',{exact:false}).waitFor();console.log(surface+': imagem renderizada, proporção 16:9, aviso oculto filtrado e orientação no envio OK');}
 catch {console.log(surface+': FAIL — API devolve folder, mas imagem não existe na Home do admin sem Member');failures.push(surface);}
 await context.close();
}assert.deepEqual(failures,[]);}finally {await browser.close();await new Promise(r=>server.close(r));}
