import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.WWTR_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.WWTR_PLAYWRIGHT_MODULE)).href : 'playwright');
const url = process.env.WWTR_SMOKE_URL || pathToFileURL(resolve('release/who-writes-the-rules.html')).href;
const browser = await chromium.launch({ executablePath: process.env.WWTR_BROWSER_PATH || undefined });

try {
  for (const venue of ['UN Global Dialogue session', 'China–US bilateral']) {
    const context = await browser.newContext({
      viewport: { width: Number(process.env.WWTR_SMOKE_WIDTH || 1280), height: Number(process.env.WWTR_SMOKE_HEIGHT || 900) },
      reducedMotion: 'reduce', offline: url.startsWith('file:'),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const button = name => page.getByRole('button', { name, exact: true });
    const heading = name => page.getByRole('heading', { name, exact: true });
    const screenshot = async name => {
      if (process.env.WWTR_SMOKE_SCREENSHOTS) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: join(process.env.WWTR_SMOKE_SCREENSHOTS, name + '.png') });
      }
    };

    await page.goto(url);
    await heading('How to play').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await screenshot('onboarding');
    await button('Start as China').click();
    await button('Proceed to the summit').click();
    await page.getByRole('group', { name: 'Forum', exact: true }).getByText(venue, { exact: true }).click();
    await page.getByText('Tests and verification', { exact: true }).click();
    await button('Convene').click();

    if (venue === 'China–US bilateral') {
      await button('Concede').click();
      await heading('No agreement').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.getByText(/^The official summit ended before a vote was held./).waitFor();
      await page.getByText('Show the round table', { exact: true }).click();
      assert.equal(await page.getByRole('group', { name: 'Round table at the close of the summit' })
        .getByRole('img', { name: /: Not invited$/ }).count(), 4);
      await screenshot('no-official-vote');
    } else {
      await button('Enter the room').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await button('Propose clause').click();
      await page.locator('[data-template="jailbreak_rate"]').click();
      await button('Table clause').click();
      await page.getByRole('group', { name: 'Argument ideas' }).getByRole('button').first().click();
      const statement = page.getByLabel('Your statement');
      assert.match(await statement.inputValue(), /^We (?:would like to .+, which is why we )?ask for .+\.$/);
      const transcript = page.getByRole('list', { name: 'Messages this cycle' });
      const readingArea = await transcript.evaluate(list => ({
        height: list.clientHeight,
        share: list.clientWidth / list.closest('.summit-room').clientWidth,
        viewport: window.innerHeight,
      }));
      assert.ok(readingArea.height >= readingArea.viewport * 0.3);
      assert.ok(readingArea.share > 0.3);
      await statement.fill(('We propose confidence interval reporting so that every delegation can compare results.\n\n').repeat(10));
      await button('Send statement').click();
      await page.getByText('1 of 5 rounds complete', { exact: true }).waitFor();
      assert.ok(await transcript.evaluate(list => list.scrollHeight > list.clientHeight));
      assert.ok(await transcript.locator('.summit-message:not(.summit-message--chair) p').first()
        .evaluate(text => parseFloat(getComputedStyle(text).fontSize)) >= 16);
      await transcript.evaluate(list => { list.scrollTop = 0; });
      await button('Jump to latest').waitFor();
      await statement.fill('We also propose recognising test results across national systems.');
      await button('Send statement').click();
      await page.getByText('2 of 5 rounds complete', { exact: true }).waitFor();
      assert.equal(await transcript.evaluate(list => list.scrollTop), 0);
      await button('Jump to latest').click();
      assert.ok(await transcript.evaluate(list => list.scrollHeight - list.clientHeight - list.scrollTop < 2));
      await screenshot('discussion-long-replies');
    }
    await context.close();
  }
  console.log('Passed onboarding smoke:', url);
} finally {
  await browser.close();
}
