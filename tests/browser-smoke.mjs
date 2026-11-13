import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.WWTR_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.WWTR_PLAYWRIGHT_MODULE)).href : 'playwright');
const fileUrl = pathToFileURL(resolve('release/who-writes-the-rules.html')).href;
const startUrl = process.env.WWTR_SMOKE_URL || fileUrl;
const browser = await chromium.launch({ executablePath: process.env.WWTR_BROWSER_PATH || undefined });
const errors = [];
const externalRequests = [];
try {
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
  const button = name => page.getByRole('button', { name, exact: true });
  const heading = name => page.getByRole('heading', { name, exact: true });
  const screenshot = async name => {
    if (process.env.WWTR_SMOKE_SCREENSHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(process.env.WWTR_SMOKE_SCREENSHOTS, name + '.png') });
    }
  };

  await page.goto(startUrl);
  await heading('Who Writes the Rules for AI?').waitFor();
  await page.locator('label').filter({ has: page.locator('input[type="radio"][value="china"]') }).click();
  await button('Take the China seat').click();
  await button('Proceed to the summit').click();
  await page.getByLabel('Name three actors', { exact: false }).fill('Governments, labs, and evaluators balance access and secrecy.');
  await button('Submit and convene').click();
  await heading('Convene the summit').waitFor();
  const invitationGroup = page.getByRole('group', { name: 'Invite delegations' });
  const guest = name => invitationGroup.getByRole('checkbox', { name, exact: true });
  const toggleGuest = name => invitationGroup.locator('label').filter({
    has: page.getByRole('checkbox', { name, exact: true }),
  }).click();
  assert.equal(await guest('China').count(), 0);
  assert.equal(await guest('United States').isChecked(), true);
  await toggleGuest('United States');
  await page.getByRole('img', { name: 'United States: Not invited', exact: true }).waitFor();
  await page.getByText('China–US bilateral', { exact: true }).click();
  assert.equal(await invitationGroup.getByRole('checkbox').count(), 1);
  assert.equal(await guest('United States').isChecked(), true);
  await toggleGuest('United States');
  assert.equal(await button('Convene').isEnabled(), true);
  await page.getByText('UN Global Dialogue session', { exact: true }).click();
  assert.equal(await guest('United States').isChecked(), false);
  await toggleGuest('United States');
  assert.equal(await guest('United States').isChecked(), true);
  await page.getByText('Tests and verification', { exact: true }).click();
  await button('Convene').click();
  await button('Enter the room').click();
  await heading('Negotiating the text').waitFor();
  assert.equal(await button('Request report').isDisabled(), true);

  for (const id of ['jailbreak_rate', 'dangerous_capability_eval', 'compute_threshold', 'verifier',
    'model_access', 'mutual_recognition', 'incident_reporting', 'capacity_building']) {
    await button('Propose clause').click();
    await page.locator(`[data-template="${id}"]`).click();
    await button('Table clause').click();
  }
  await screenshot('negotiation');
  for (const text of ['We propose mutual recognition using a common test protocol.',
    'Structured access in a secure enclave can produce confidence interval reporting.',
    'National institutions run the tests. We can fund evaluator training.']) {
    await page.getByLabel('Your statement').fill(text);
    await button('Send statement').click();
  }
  await page.getByText('3 of 5 rounds complete', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('3 of 5 rounds complete', { exact: true }).waitFor();
  assert.equal(await page.getByText('v1', { exact: true }).count(), 8);
  await button('Request report').click();
  await heading('Report of the rapporteur').waitFor();
  await button('Object to summary').click();
  await page.getByLabel('What did the report misstate?').fill('Our delegation supports verification with structured access.');
  await button('Request revision').click();
  await heading('Objection on the record').waitFor();
  await button('Call vote').click();
  await heading('The text was adopted').waitFor();
  await button('See outcome').click();
  await button('Open debrief').click();
  await heading('Summit debrief').waitFor();
  await button('Continue to follow-up questions').click();
  await page.getByLabel('Name three actors', { exact: false }).fill('Governments, labs and evaluators need compatible evidence.');
  await button('Submit').click();
  await button('New game').waitFor();

  await page.getByRole('link', { name: 'Gallery', exact: true }).click();
  await button('Rate proposal').click();
  const ratingForm = page.getByRole('dialog', { name: 'Rate this text' });
  for (const group of await ratingForm.locator('fieldset').all()) {
    await group.getByText('4', { exact: true }).click();
  }
  await button('Save rating').click();
  await page.getByText('Rating saved.', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('4.00 / 5 · 1 rating', { exact: true }).waitFor();

  await page.getByRole('link', { name: 'Research', exact: true }).click();
  await heading('Research dossiers').waitFor();
  const research = page.getByRole('navigation', { name: 'Research dossiers' });
  assert.equal(await research.getByRole('link').count(), 7);
  for (const delegation of ['us', 'eu', 'frontier_lab', 'global_south', 'evaluator', 'china']) {
    await research.locator('a[href="#/research/' + delegation + '"]').click();
    await page.getByText('config/delegations/' + delegation + '.yaml', { exact: true }).waitFor();
    await heading('Materials to find').waitFor();
    await heading('Claims and sources').waitFor();
    assert.ok(await page.locator('.research-record').count());
  }
  await page.getByLabel('Filter by status').selectOption('todo');
  assert.ok(await page.getByText('To find', { exact: true }).count());
  const need = page.locator('#research-record-R-CN-02');
  assert.equal(await need.count(), 0);
  await page.evaluate(() => { window.location.hash = '#/research/china/R-CN-02'; });
  await page.waitForFunction(() => document.activeElement?.id === 'research-record-R-CN-02');
  assert.equal(await page.getByLabel('Filter by status').inputValue(), 'all');
  await need.getByText('Task owner · Unassigned', { exact: true }).waitFor();
  const permalink = await need.getByRole('link', { name: 'Permalink for R-CN-02' }).getAttribute('href');
  assert.equal(permalink, '#/research/china/R-CN-02');
  await need.getByRole('link', { name: 'C-CN-02', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === 'research-record-C-CN-02');
  assert.equal(new URL(page.url()).hash, '#/research/china/C-CN-02');
  await page.reload();
  await page.waitForFunction(() => document.activeElement?.id === 'research-record-C-CN-02');
  const claimTop = await page.locator('#research-record-C-CN-02').evaluate(node => node.getBoundingClientRect().top);
  assert.ok(claimTop >= 56 && claimTop < 900);
  await screenshot('research');
  const download = page.waitForEvent('download');
  await button('Download claims CSV').click();
  const csv = await download;
  assert.equal(csv.suggestedFilename(), 'claims.csv');
  assert.equal(await csv.failure(), null);

  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await heading('Completed games (1)').waitFor();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await button('Test connection').click();
  await page.getByText('Offline mock mode is ready.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await button('New game').click();
  await page.locator('label').filter({ has: page.locator('input[type="radio"][value="us"]') }).click();
  await button('Take the United States seat').click();
  await button('Proceed to the summit').click();
  await button('Submit and convene').click();
  await page.getByText('Tests and verification', { exact: true }).click();
  await page.getByText('Expert dialogue (Track 2)', { exact: true }).click();
  await button('Convene').click();
  await button('Enter the room').click();
  for (const id of ['jailbreak_rate', 'dangerous_capability_eval', 'compute_threshold', 'verifier', 'model_access']) {
    await button('Propose clause').click();
    await page.locator(`[data-template="${id}"]`).click();
    if (id === 'verifier') await page.getByLabel('Verifier', { exact: true }).selectOption('third_party');
    await button('Table clause').click();
  }
  for (const text of ['Use a common test protocol with mutual recognition.',
    'Structured access and confidence interval reporting support verification.',
    'We can fund evaluator training.']) {
    await page.getByLabel('Your statement').fill(text);
    await button('Send statement').click();
  }
  await button('Request report').click();
  await button('Call vote').click();
  await heading('The text was adopted').waitFor();
  await button('Return to the official summit').click();
  await page.getByText('A technical annex is on file', { exact: true }).waitFor();
  assert.equal(await page.locator('input[type="radio"][value="track1"]').isChecked(), true);
  await button('Convene').click();
  await button('Enter the room').click();
  assert.equal(await page.getByText('From the technical annex', { exact: true }).count(), 5);
  await page.getByRole('link', { name: 'Gallery', exact: true }).click();
  await page.getByRole('heading', { name: /technical annex$/ }).waitFor();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Print cards', exact: true }).click();
  await heading('Print cards').waitFor();
  await page.reload();
  await heading('Print cards').waitFor();
  const packetHeadings = ['Delegation cards', 'Clause cards', 'Facilitator worksheet'];
  for (const title of packetHeadings) await heading(title).waitFor();
  await page.evaluate(() => {
    const originalPrint = window.print;
    window.print = () => {
      document.documentElement.dataset.printRequested = 'true';
      window.print = originalPrint;
    };
  });
  await button('Print or save as PDF').click();
  assert.equal(await page.locator('html').getAttribute('data-print-requested'), 'true');
  await page.emulateMedia({ media: 'print' });
  await page.getByRole('navigation', { name: 'Main', includeHidden: true }).waitFor({ state: 'hidden' });
  await button('Print or save as PDF').waitFor({ state: 'hidden' });
  for (const title of packetHeadings) await heading(title).waitFor();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await heading('Negotiating the text').waitFor();

  await page.evaluate(() => localStorage.setItem('wwtr:v1:game', '{"schema":1,"phase":"negotiate"}'));
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await page.reload();
  await heading('Who Writes the Rules for AI?').waitFor();

  await page.locator('label').filter({ has: page.locator('input[type="radio"][value="china"]') }).click();
  await button('Take the China seat').click();
  await button('Proceed to the summit').click();
  await button('Submit and convene').click();
  await toggleGuest('United States');
  await button('Convene').click();
  await page.getByRole('article', { name: 'Note from United States' }).waitFor();
  const invitations = await page.evaluate(() => {
    const { choices, attendance } = JSON.parse(localStorage.getItem('wwtr:v1:game'));
    return { guests: choices.invited, excluded: attendance.find(result => result.delegation === 'us').status };
  });
  assert.equal(invitations.guests.includes('us'), false);
  assert.equal(invitations.excluded, 'excluded');

  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log('Passed browser smoke:', startUrl);
} finally {
  await browser.close();
}
