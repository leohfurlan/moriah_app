// QA da UI financeira com API simulada; as transicoes reais sao testadas em pytest/PostgreSQL.
import { BASE, novaSessao, VIEWPORT_MOBILE, digitar } from '../lib/harness.mjs';
import { Verificacao } from '../lib/report.mjs';

export async function executar({ browser, dir }) {
  const v = new Verificacao('fase-3-financeiro', { dir });
  const session = await novaSessao(browser, { viewport: VIEWPORT_MOBILE, mobile: true });
  const { page, context } = session;
  const me = { id: 1, email: 'qa@example.test', first_name: 'Tesouraria', last_name: '', role: 'treasurer', capabilities: ['review_contributions'], member_id: null, can_access_management: true };
  const item = (id, name) => ({ id, member_name: name, category: 'offering', status: 'pending', amount: '80.00', contribution_date: '2026-09-01', notes: 'Nota do membro', review_notes: '', review_history: [], attachments: [{ id, original_name: 'comprovante.pdf', file_url: BASE + '/qa-comprovante.pdf' }], created_at: '2026-09-01T10:00:00Z' });
  let records = [item(101, 'Maria QA'), item(102, 'Joao QA')];
  let writes = 0;
  let fail = false;
  let hold = false;
  let release;
  let held;
  let markHeld;
  let seenDate = false;
  await context.addInitScript(() => localStorage.setItem('moriah_access_token', 'qa-token'));
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/me/') return json(me);
    if (url.pathname.endsWith('/review/')) {
      writes++;
      const payload = route.request().postDataJSON();
      const id = Number(url.pathname.split('/').at(-3));
      const row = records.find(r => r.id === id);
      row.status = payload.status;
      row.review_notes = payload.review_notes;
      row.reviewed_by_name = 'Tesouraria QA';
      row.review_history = [{ status_before: 'pending', status_after: row.status, reviewed_by_name: row.reviewed_by_name, created_at: '2026-09-16T12:00:00Z' }];
      return json(row);
    }
    if (url.pathname === '/api/contributions/') {
      if (fail) return route.fulfill({ status: 500, contentType: 'text/html', body: '<html>private debug</html>' });
      const status = url.searchParams.get('status');
      const from = url.searchParams.get('date_from');
      const to = url.searchParams.get('date_to');
      if (from === '2026-08-01' && to === '2026-08-31') seenDate = true;
      const data = structuredClone(records.filter(r => (!status || r.status === status) && (!from || r.contribution_date >= from) && (!to || r.contribution_date <= to)));
      if (hold && status === 'pending') { hold = false; markHeld(); await new Promise(resolve => { release = resolve; }); }
      return json(data);
    }
    return json([]);
  });
  try {
    page.setDefaultTimeout(15000);
    await page.goto(BASE + '/home');
    await page.getByRole('link', { name: 'Revisão', exact: true }).click();
    await page.getByText('Maria QA', { exact: true }).waitFor();
    v.check('Tesouraria sem membro acessa revisao pelo mobile', new URL(page.url()).pathname === '/finance-review');
    await page.getByText('Maria QA', { exact: true }).click();
    await page.getByRole('button', { name: 'comprovante.pdf', exact: true }).waitFor();
    v.check('Detalhe mostra comprovante e nota do membro', await page.getByText('Nota do membro', { exact: true }).isVisible());
    const popupEvent = context.waitForEvent('page');
    await page.getByRole('button', { name: 'comprovante.pdf', exact: true }).click();
    const popup = await popupEvent;
    v.check('Comprovante abre em nova janela', !!popup);
    await popup.close();
    await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
    await page.getByText('Motivo obrigatório', { exact: true }).waitFor();
    v.check('Rejeicao sem motivo bloqueada antes da API', writes === 0);
    await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await page.getByText('Maria QA', { exact: true }).waitFor({ state: 'hidden' });
    v.check('Aprovacao remove item do filtro pendente', writes === 1);
    await page.getByText('Joao QA', { exact: true }).click();
    await digitar(page.getByPlaceholder('Obrigatória para rejeitar'), 'Valor divergente');
    await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
    await page.getByText('Nenhuma contribuição encontrada', { exact: true }).waitFor();
    v.check('Rejeicao com motivo atualiza lista vazia', writes === 2);
    await page.getByRole('button', { name: 'Rejeitadas', exact: true }).click();
    await page.getByText('Joao QA', { exact: true }).click();
    await page.getByText('Motivo/observação: Valor divergente', { exact: true }).waitFor();
    v.check('Historico e responsavel preservados', await page.getByText('Revisado por Tesouraria QA', { exact: true }).isVisible() && await page.getByText('Histórico', { exact: true }).isVisible());
    v.check('Item final nao oferece nova decisao', await page.getByRole('button', { name: 'Aprovar', exact: true }).count() === 0);
    hold = true;
    held = new Promise(resolve => { markHeld = resolve; });
    await page.getByRole('button', { name: 'Pendentes', exact: true }).click();
    await held;
    await page.getByRole('button', { name: 'Aprovadas', exact: true }).click();
    await page.getByText('Maria QA', { exact: true }).waitFor();
    release();
    await page.waitForTimeout(500);
    v.check('Resposta antiga nao sobrescreve filtro atual', await page.getByText('Maria QA', { exact: true }).isVisible());
    await digitar(page.getByPlaceholder('AAAA-MM-DD').nth(0), '2026-08-01');
    await digitar(page.getByPlaceholder('AAAA-MM-DD').nth(1), '2026-08-31');
    await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
    await page.getByText('Nenhuma contribuição encontrada', { exact: true }).waitFor();
    v.check('Filtro de periodo enviado e aplicado', seenDate);
    fail = true;
    await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
    await page.getByText('Erro no servidor', { exact: true }).waitFor();
    v.check('Erro de servidor exibido sem HTML privado', !(await page.locator('body').innerText()).includes('private debug'));
    await v.screenshot(page, 'finance-mobile');
    fail = false;
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await page.getByText('Nenhuma contribuição encontrada', { exact: true }).waitFor();
    v.check('Retry recupera apos erro do servidor', await page.getByText('Erro no servidor', { exact: true }).count() === 0);
    v.check('Sem excecoes de JavaScript', session.pageerrors.length === 0, session.pageerrors.join('; '));
    me.capabilities = ['member']; me.member_id = 10;
    await page.reload();
    await page.waitForURL('**/home');
    v.check('Membro sem capacidade bloqueado pela guarda', await page.getByRole('link', { name: 'Revisão', exact: true }).count() === 0);
  } catch (error) { await v.screenshot(page, 'falha'); console.log(await page.locator('body').innerText()); console.log(session.pageerrors); throw error; } finally { if (release) release(); await context.close(); }
  return v;
}
