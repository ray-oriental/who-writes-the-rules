// Browser checks for the two things the team relies on most:
//   1. a statement visibly changes the room, and
//   2. a delegation can be edited, added, removed and recovered from the browser.
// Runs offline against the single-file build, like the other smoke scripts.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.WWTR_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.WWTR_PLAYWRIGHT_MODULE)).href : 'playwright');
const startUrl = process.env.WWTR_SMOKE_URL || pathToFileURL(resolve('release/who-writes-the-rules.html')).href;
const at = hash => startUrl.split('#')[0] + hash;
const browser = await chromium.launch({ executablePath: process.env.WWTR_BROWSER_PATH || undefined });
const errors = [];
const externalRequests = [];

async function open() {
  const context = await browser.newContext({
    viewport: { width: Number(process.env.WWTR_SMOKE_WIDTH || 1280), height: 900 }, reducedMotion: 'reduce', offline: startUrl.startsWith('file:'),
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('http') && (startUrl.startsWith('file:') || new URL(url).origin !== new URL(startUrl).origin)) {
      externalRequests.push(url);
    }
  });
  page.setDefaultTimeout(8000);
  return {
    context, page,
    button: name => page.getByRole('button', { name, exact: true }),
    heading: name => page.getByRole('heading', { name, exact: true }),
  };
}

/** From the seat screen to the negotiating room, as China, in the open forum with verification on the agenda. */
async function enterRoom({ page, button, heading }) {
  await heading('Who Writes the Rules for AI?').waitFor();
  await page.locator('label').filter({ has: page.locator('input[type="radio"][value="china"]') }).click();
  await button('Take the China seat').click();
  await button('Proceed to the summit').click();
  await page.getByText('Tests and verification', { exact: true }).click();
  await button('Convene').click();
  await button('Enter the room').click();
  await heading('Negotiating the text').waitFor();
}

try {
  // 1. Statements have an effect. The movement asserted here comes from the shipped delegations and argument tags.
  {
    const session = await open();
    const { context, page, button, heading } = session;
    await page.goto(startUrl);
    await enterRoom(session);
    for (const id of ['jailbreak_rate', 'dangerous_capability_eval', 'compute_threshold', 'verifier',
      'model_access', 'mutual_recognition', 'incident_reporting', 'capacity_building']) {
      await button('Propose clause').click();
      await page.locator(`[data-template="${id}"]`).click();
      await button('Table clause').click();
    }
    const effect = page.locator('.neg__effect');
    const say = async text => {
      await page.getByLabel('Your statement').fill(text);
      await button('Send statement').click();
    };

    await say('Thank you all for coming today.');
    await page.locator('.neg-hit__none').filter({ hasText: 'No delegation changed its position.' }).waitFor();
    await effect.filter({ hasText: 'Your last statement moved nobody.' }).waitFor();
    assert.equal(await page.locator('.neg__lean-row').filter({ hasText: '→' }).count(), 0);

    await say('We propose mutual recognition of national results with structured access, so nobody hands over model weights.');
    await effect.filter({ hasText: /^Your last statement moved \d+ delegations?: / }).waitFor();
    const moved = Number((await effect.textContent()).match(/moved (\d+) /)[1]);
    assert.ok(moved >= 1);
    assert.ok(await page.locator('.neg-msg--you').last().locator('.neg-hit').count() >= 1);
    assert.equal(await page.locator('.neg__lean-row').filter({ hasText: '→' }).count(), moved);

    // The task strip says what to do, and Restart abandons the game without clearing any data.
    await page.locator('.app-task__text').filter({ hasText: 'ask for the report' }).waitFor();
    await button('Restart').click();
    await button('Cancel').click();
    await heading('Negotiating the text').waitFor();
    await button('Restart').click();
    await button('Yes, restart').click();
    await page.locator('input[type="radio"][value="china"]').waitFor();
    assert.equal(await button('Restart').count(), 0);
    await context.close();
  }

  // 2. Delegations can be edited, added, removed and recovered. Edits live in this browser only.
  {
    const session = await open();
    const { context, page, button, heading } = session;
    const cast = page.locator('a[href^="#/delegations/"]');
    await page.goto(at('#/delegations'));
    await heading('Delegations').waitFor();
    const shipped = await cast.count();
    assert.ok(shipped >= 2);

    // Edit one field of a shipped delegation, then put it back.
    await page.goto(at('#/delegations/china'));
    const owner = page.getByLabel('Owner', { exact: true });
    const original = await owner.inputValue();
    await owner.fill('smoke-test');
    await button('Save in this browser').click();
    await page.getByText('Edited in this browser', { exact: true }).waitFor();
    assert.equal(await owner.inputValue(), 'smoke-test');
    await button('Discard my edits').click();
    await page.getByRole('dialog', { name: 'Discard your edits?' })
      .getByRole('button', { name: 'Discard my edits', exact: true }).click();
    await page.getByText('Edited in this browser', { exact: true }).waitFor({ state: 'detached' });
    assert.equal(await owner.inputValue(), original);

    // Add a delegation and sit down with it.
    await page.goto(at('#/delegations/new'));
    await heading('Add a delegation').waitFor();
    await page.getByLabel('Name', { exact: true }).fill('African Union');
    await page.getByLabel('Badge letters (2 to 4)', { exact: true }).fill('AU');
    await button('Start the draft').click();
    await heading('African Union').waitFor();
    await button('Save in this browser').click();
    await page.getByText('Added in this browser', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, '#/delegations/african_union');

    await page.goto(at('#/'));
    await enterRoom(session);
    const table = page.getByRole('group', { name: 'Round table: who is at the negotiation', exact: true });
    await table.getByRole('img', { name: 'African Union: At the table', exact: true }).waitFor();
    assert.equal(await table.getByRole('img').count(), shipped + 1);

    // Remove every local edit; the shipped cast comes back.
    await page.goto(at('#/delegations'));
    await button('Discard all my edits').click();
    await page.getByRole('dialog', { name: 'Discard all your edits?' })
      .getByRole('button', { name: 'Discard all my edits', exact: true }).click();
    await page.locator('a[href="#/delegations/african_union"]').waitFor({ state: 'detached' });
    await heading('Delegations').waitFor();
    assert.equal(await cast.count(), shipped);

    // A broken local edit must not lock anyone out of the game.
    await page.evaluate(() => localStorage.setItem('wwtr.config.v1', JSON.stringify({
      version: 1, files: { 'config/delegations/china.yaml': 'id: china\nname: [broken' },
    })));
    await page.reload();
    await heading('Configuration errors').waitFor();
    await button('Discard my edits and reload').click();
    await heading('Delegations').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('wwtr.config.v1')), null);
    await context.close();
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log('Passed team smoke:', startUrl);
} finally {
  await browser.close();
}
