// Run against a local production server. No database or email calls are made.
// PLAYWRIGHT_MODULE=/path/to/playwright RESULTS_BASE_URL=http://127.0.0.1:3100 node test/browser/results.cjs
require('tsx/cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { readFileSync, mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const { parseStandings } = require('../../src/lib/resultsStandings.ts');
const entries = [...parseStandings(readFileSync('leaderboard/standings-ams-ascent-round-1.csv', 'utf8')).values()];
const base = process.env.RESULTS_BASE_URL || 'http://127.0.0.1:3100';
const artifactDir = '/tmp/ascent-results-qa';

(async () => {
  mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  async function open() {
    await page.goto(`${base}/results`);
    await page.getByLabel('Contest username', { exact: true }).waitFor();
  }
  async function reveal(index, username = entries[index].username) {
    await page.getByLabel('Contest username', { exact: true }).fill(username);
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
    await page.locator('#result-title').waitFor();
    assert.equal(await page.locator('#result-title').textContent(), index < 133 ? 'You’re through.' : 'Thank you for taking on Ascent.');
    assert.equal(await page.locator('#result-title').evaluate(el => el === document.activeElement), true);
    const card = page.getByRole('region', { name: index < 133 ? 'You’re through.' : 'Thank you for taking on Ascent.' });
    assert.match(await card.innerText(), new RegExp(`#${index + 1}\\b`));
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }
  async function reset() {
    await page.getByRole('button', { name: 'Check another username' }).click();
    await page.getByLabel('Contest username', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Contest username', { exact: true }).inputValue(), '');
  }
  try {
    await open();
    assert.equal(await page.locator('body').innerText().then(text => text.includes(entries[0].username)), false);
    await page.screenshot({ path: `${artifactDir}/lookup-desktop.png`, fullPage: true });
    await reveal(0, `  ${entries[0].username.toUpperCase()}  `);
    await page.locator('canvas[data-result-celebration]').waitFor();
    await page.getByRole('button', { name: 'Download share card', exact: true }).waitFor();
    let downloadLookupCalls = 0;
    const countLookups = req => { if (new URL(req.url()).pathname === '/api/results') downloadLookupCalls++; };
    page.on('request', countLookups);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download share card', exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'ascent-2026-round-2-rank-1.png');
    await download.saveAs(`${artifactDir}/share-card-rank-1.png`);
    const png = readFileSync(`${artifactDir}/share-card-rank-1.png`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 627);
    assert.equal(downloadLookupCalls, 0);
    page.off('request', countLookups);

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedResultCaption = text; } } }));
    await page.getByRole('button', { name: 'Copy caption', exact: true }).click();
    assert.match(await page.evaluate(() => window.copiedResultCaption), /#1 out of 1,326/);
    await page.getByText('Edit your caption', { exact: true }).click();
    await page.getByLabel('Your LinkedIn caption').fill('My own words about reaching Round 2.');
    await page.getByRole('button', { name: 'Copy caption', exact: true }).click();
    assert.equal(await page.evaluate(() => window.copiedResultCaption), 'My own words about reaching Round 2.');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
    await page.getByRole('button', { name: 'Copy caption', exact: true }).click();
    await page.getByText('Select and copy the caption below.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Your LinkedIn caption').evaluate(el => el.selectionEnd - el.selectionStart), 'My own words about reaching Round 2.'.length);
    await page.getByText('Edit your caption', { exact: true }).click();

    await page.context().route('https://www.linkedin.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Share dialog stub</p>' }));
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Share on LinkedIn', exact: false }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    const shareUrl = new URL(popup.url());
    assert.equal(shareUrl.origin, 'https://www.linkedin.com');
    assert.equal(shareUrl.searchParams.get('url'), 'https://ascent.amshq.in/results');
    assert.deepEqual([...shareUrl.searchParams.keys()], ['url']);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
    await page.context().unroute('https://www.linkedin.com/**');

    await page.locator('canvas[data-result-celebration]').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Celebrate again' }).click();
    await page.locator('canvas[data-result-celebration]').waitFor();
    await page.locator('canvas[data-result-celebration]').waitFor({ state: 'detached' });
    console.log('PASS: bounded party-popper animation/replay, 1200x627 PNG generated without API calls, editable caption, clipboard fallback and safe LinkedIn popup');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `${artifactDir}/selected-desktop.png`, fullPage: true, animations: 'disabled' });
    await page.evaluate(() => { window.print = () => { window.resultPrintCalled = true; }; });
    await page.getByRole('button', { name: 'Print / save result' }).click();
    assert.equal(await page.evaluate(() => window.resultPrintCalled), true);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('header').isVisible(), false);
    assert.equal(await page.locator('footer').isVisible(), false);
    assert.equal(await page.locator('#result-title').isVisible(), true);
    await page.pdf({ path: `${artifactDir}/result-print.pdf`, format: 'A4' });
    await page.emulateMedia({ media: 'screen' });
    await reset();
    await reveal(132);
    await reset();
    await reveal(133);
    assert.equal(await page.getByText('SELECTED FOR ROUND 2', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Download share card' }).count(), 0);
    assert.equal(await page.locator('canvas[data-result-celebration]').count(), 0);
    await reset();
    await reveal(1325);
    console.log('PASS: rank 1, exact 133/134 boundary, last rank, case/whitespace handling, focus, reset and printable result');

    await reset();
    await page.getByLabel('Contest username', { exact: true }).fill('not-a-real-contest-username');
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
    await page.locator('#result-error').waitFor();
    assert.equal(await page.locator('#result-title').count(), 0);
    await page.route('**/api/results', route => route.abort('failed'));
    await page.getByLabel('Contest username', { exact: true }).fill(entries[0].username);
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
    await page.locator('#result-error').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reveal my result', exact: true }).isEnabled(), true);
    await page.unroute('**/api/results');
    await reveal(0);
    console.log('PASS: unknown username and network failure recover without displaying a stale result');
    await reset();
    await page.route('**/api/results', route => route.fulfill({ json: { result: { rank: 134, selected: true, problems: [] } } }));
    await page.getByLabel('Contest username', { exact: true }).fill(entries[133].username);
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
    await page.locator('#result-error').waitFor();
    assert.equal(await page.locator('#result-title').count(), 0);
    await page.unroute('**/api/results');
    await reveal(0);
    console.log('PASS: malformed or inconsistent responses fail closed and remain retryable');

    await reset();
    let calls = 0, release;
    await page.route('**/api/results', async route => {
      calls++;
      await new Promise(resolve => { release = resolve; });
      await route.continue();
    });
    await page.getByLabel('Contest username', { exact: true }).fill(entries[0].username);
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
    await page.getByRole('button', { name: 'Opening your result…' }).waitFor();
    await page.locator('form').evaluate(form => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(calls, 1);
    release();
    await page.locator('#result-title').waitFor();
    await page.unroute('**/api/results');
    console.log('PASS: repeated submits issue only one request');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await open();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `lookup overflow at ${width}`);
      await reveal(132);
      await page.getByRole('button', { name: 'Celebrate again' }).waitFor();
      await page.locator('canvas[data-result-celebration]').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Celebrate again' }).click();
      await page.locator('canvas[data-result-celebration]').waitFor({ state: 'detached' });
      if (width === 390) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `${artifactDir}/selected-mobile.png`, fullPage: true });
      }
      await reset();
      await reveal(1325);
    }
    console.log('PASS: 320, 390, 768 and 1024px layouts, selected/unselected results and reduced motion');
    assert.deepEqual(errors, []);
    console.log(`Screenshots and print preview: ${artifactDir}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
