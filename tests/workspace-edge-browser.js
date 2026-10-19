async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext();
  const legacy = [{ id: 'legacy-note', title: 'Migrated Arabic note', icon: '📄', content: 'A preserved legacy note.', category: 'work', updatedAt: '2026-10-18' }];
  await context.addInitScript(({ legacy }) => {
    if (!localStorage.getItem('st_pages')) {
      localStorage.setItem('st_pages', JSON.stringify(legacy));
      localStorage.setItem('st_tasks', '[]');
      localStorage.setItem('st_aiconfig', JSON.stringify({ provider: 'ollama', apiKey: 'synthetic-test-key' }));
    }
  }, { legacy });
  try {
    const first = await context.newPage(); await first.goto('http://127.0.0.1:1420');
    await first.getByRole('button', { name: 'Migrated Arabic note', exact: true }).waitFor();
    const preserved = await first.evaluate(() => ({ pages: JSON.parse(localStorage.getItem('st_pages')), apiKey: JSON.parse(localStorage.getItem('st_aiconfig')).apiKey }));
    if (preserved.pages[0].id !== 'legacy-note' || preserved.apiKey) throw new Error('Legacy recovery data or credential handling failed.');
    const second = await context.newPage(); await second.goto('http://127.0.0.1:1420');
    await second.getByRole('button', { name: 'New client', exact: true }).waitFor();
    const create = async (tab, name) => {
      await tab.getByRole('button', { name: 'New client', exact: true }).click();
      await tab.getByRole('textbox', { name: 'Client name', exact: true }).fill(name);
      await tab.getByRole('button', { name: 'Create client', exact: true }).click();
    };
    await create(first, 'Committed client');
    await first.getByRole('status').filter({ hasText: /^Saved locally$/ }).waitFor();
    await create(second, 'Stale client');
    await second.getByRole('alert').filter({ hasText: 'changed in another window' }).waitFor();
    const third = await context.newPage(); await third.goto('http://127.0.0.1:1420');
    await third.getByRole('button', { name: 'New client', exact: true }).waitFor();
    const options = await third.getByRole('combobox', { name: 'Filter by client', exact: true }).textContent();
    if (!options.includes('Committed client') || options.includes('Stale client')) throw new Error('A stale tab overwrote committed data.');
  } finally { await context.close(); }
  const bad = await browser.newContext();
  await bad.addInitScript(() => { localStorage.setItem('st_pages', '{broken'); localStorage.setItem('st_tasks', '[]'); });
  try {
    const tab = await bad.newPage(); await tab.goto('http://127.0.0.1:1420');
    await tab.getByRole('button', { name: 'Retry loading', exact: true }).waitFor();
    if (await tab.getByRole('button', { name: 'New client', exact: true }).count()) throw new Error('Malformed legacy data became a writable empty workspace.');
    if (await tab.evaluate(() => localStorage.getItem('st_pages')) !== '{broken') throw new Error('Damaged source data was overwritten.');
  } finally { await bad.close(); }
  return { passed: ['legacy migration', 'legacy source retained', 'credentials not persisted', 'concurrent-window conflict protection', 'malformed legacy data retained'] };
}
