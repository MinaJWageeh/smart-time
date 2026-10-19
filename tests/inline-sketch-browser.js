// Isolated browser profile; uses synthetic notes only.
async (page) => {
  const button = name => page.getByRole('button', { name, exact: true });
  await button('New note').click();
  const title = `Inline sketch ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Untitled Note', exact: true }).fill(title);
  const text = page.getByRole('textbox', { name: 'Note text', exact: true });
  await text.fill('Before\nAfter');
  await text.press('Home');
  await button('Draw / Ink').click();
  await button('Insert into Note').click();
  await page.getByRole('alert').filter({ hasText: 'Draw something' }).waitFor();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 150, { steps: 15 });
  await page.mouse.move(box.x + 150, box.y + 220, { steps: 15 });
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 15 });
  await page.mouse.up();
  await button('Insert into Note').click();
  const image = page.locator('.inline-sketch img');
  await image.waitFor();
  const size = await image.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
  if (!size.width || size.width >= box.width || size.height >= box.height) throw new Error('Sketch was not cropped.');
  if (!(await text.inputValue()).includes('Before')) throw new Error('Text before the sketch lost.');
  const after = page.getByRole('textbox', { name: 'Note text 2', exact: true });
  if (!(await after.inputValue()).includes('After')) throw new Error('Sketch was not inserted at caret.');
  await after.fill('After the drawing — still editable.');
  for (const field of await page.locator('.inline-note-editor textarea').all()) {
    if ((await field.inputValue()).includes('base64')) throw new Error('Raw image encoding is visible.');
  }
  await button('Clients & Projects').click();
  await page.getByRole('status').filter({ hasText: /^Saved locally$/ }).waitFor();
  await page.reload();
  await button(title).click();
  await page.locator('.inline-sketch img').waitFor();
  if (!(await after.inputValue()).includes('still editable')) throw new Error('Text/image did not survive reload.');
  await page.getByTitle('Split View (Editor + Interactive Checklist & Drawings)', { exact: true }).click();
  if ((await text.inputValue()).includes('base64')) throw new Error('Encoding exposed in split view.');
  await page.getByTitle('Interactive Preview', { exact: true }).click();
  await page.getByRole('img', { name: 'Ink Sketch', exact: true }).waitFor();
  await page.getByTitle('Edit mode', { exact: true }).click();
  await button('Switch to Dark Mode').click();
  await page.screenshot({ path: 'output/playwright/inline-sketch.png' });
  await button('Remove sketch 1').click();
  if (await image.count()) throw new Error('Remove sketch failed.');
  if (!(await text.inputValue()).includes('Before') || !(await text.inputValue()).includes('still editable')) throw new Error('Removing image lost surrounding text.');
  return { passed: ['blank sketch rejection', 'drawing insertion at caret', 'cropped image', 'hidden encoding', 'editable surrounding text', 'reload persistence', 'split and preview modes', 'remove preserves text'], size };
}
