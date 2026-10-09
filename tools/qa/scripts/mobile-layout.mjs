// Layout real do Expo Web; API simulada, sem acessar banco ou produção.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { abrirNavegador } from '../lib/pw.mjs';

const base = process.env.QA_BASE || 'http://127.0.0.1:8087';
const output = 'output/playwright/mobile-layout';
await fs.mkdir(output, { recursive: true });
const browser = await abrirNavegador();
try {
  for (const role of ['member', 'admin', 'treasurer']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('moriah_access_token', 'layout-mock'));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin && !/^\/(api|backend|local-api)\//.test(url.pathname)) return route.continue();
      const endpoint = url.pathname.replace(/^\/(api|backend|local-api)/, '');
      let body = [];
      if (endpoint === '/me/') body = {
        id: 10, first_name: role === 'admin' ? 'Admin' : 'Maria', last_name: 'Silva',
        email: 'layout@simulado.invalid', role, roles: [role], church: 1,
        member_id: role === 'member' ? 10 : null, has_member_profile: role === 'member',
        capabilities: role === 'admin' ? ['manage_all', 'manage_content'] : role === 'member' ? ['member'] : ['review_contributions'],
        can_access_management: role !== 'member',
      };
      if (endpoint === '/me/notifications/unread-count/') body = { count: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/home`);
      await page.getByRole('link', { name: 'Início', exact: true }).waitFor();
      if (role !== 'treasurer') {
        const labels = ['Início', 'Agenda', 'Conteúdo', 'Perfil'];
        const boxes = [];
        for (const label of labels) {
          const link = page.getByRole('link', { name: label, exact: true });
          assert.equal(await link.count(), 1, `Aba ${label} deve existir com legenda`);
          boxes.push(await link.boundingBox());
        }
        for (const box of boxes) {
          assert.ok(box.height >= 44, 'Área de toque >= 44 px');
          assert.ok(Math.abs(box.y - boxes[0].y) < 1, 'Abas alinhadas');
          assert.ok(Math.abs(box.width - boxes[0].width) < 1, 'Abas de mesma largura');
        }
        const action = page.getByRole('link', { name: 'Nova contribuição', exact: true });
        const actionBox = await action.boundingBox();
        assert.ok(Math.abs(actionBox.x + actionBox.width / 2 - width / 2) < 1, 'Botão de contribuição centralizado');
        await page.getByRole('link', { name: 'Conteúdo', exact: true }).click();
        await page.waitForURL('**/content');
        const activeBackground = await page.getByRole('link', { name: 'Conteúdo', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
        assert.equal(activeBackground, 'rgb(238, 242, 255)', 'Aba Conteúdo destacada');
        await page.getByRole('link', { name: 'Início', exact: true }).click();
        await page.getByText('Nenhum compromisso próximo', { exact: true }).waitFor();
      } else {
        assert.equal(await page.getByRole('link', { name: 'Conteúdo', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Abrir revisão', exact: true }).waitFor();
      }
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="screen-content"]')).opacity === '1');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem overflow horizontal');
      const nav = await page.getByTestId('bottom-nav').boundingBox();
      assert.ok(nav.y + nav.height <= 844, 'Barra inferior dentro da tela');
      await page.screenshot({ path: `${output}/${role}-${width}.png` });
      if (role !== 'treasurer') {
        const footer = page.getByText('Moriah · layout@simulado.invalid', { exact: true });
        await footer.scrollIntoViewIfNeeded();
        await page.getByTestId('screen-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
        const footerBox = await footer.boundingBox();
        assert.ok(footerBox.y + footerBox.height <= nav.y, 'Último conteúdo acessível acima da barra');
        await page.getByRole('button', { name: 'Contribuir agora', exact: true }).click();
        await page.waitForURL('**/contribution');
        assert.equal(await page.getByRole('link', { name: 'Nova contribuição', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(67, 56, 202)');
      }
      console.log(`PASS ${role} ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto(`${base}/home`);
    await page.getByTestId('sidebar').waitFor();
    await page.screenshot({ path: `${output}/${role}-desktop.png` });
    assert.deepEqual(errors, [], 'Sem exceções no navegador');
    console.log(`PASS ${role} desktop`);
    await context.close();
  }
} finally {
  await browser.close();
}
