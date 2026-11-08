// Browser regressions for mismatched responses and failed optional chunks.
// Uses a local production build; blocks failed chunks without external services.
require('tsx/cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { parseStandings } = require('../../src/lib/resultsStandings.ts');
const entries = [...parseStandings(readFileSync('leaderboard/standings-ams-ascent-round-1.csv', 'utf8')).values()];
const manifest = JSON.parse(readFileSync('.next/react-loadable-manifest.json', 'utf8'));
const base = process.env.RESULTS_BASE_URL || 'http://127.0.0.1:3100';
const scenario = process.argv[2];

function chunkFor(suffix) {
  const match = Object.entries(manifest).find(([name]) => name.endsWith(suffix));
  assert.ok(match, `Missing chunk for ${suffix}`);
  return match[1].files[0];
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  async function withPage(run) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    try { await run(page); } finally { await context.close(); }
  }
  async function submit(page, index) {
    await page.goto(`${base}/results`);
    await page.getByLabel('Contest username', { exact: true }).fill(entries[index].username);
    await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
  }
  try {
    if (!scenario || scenario === 'identity') await withPage(async page => {
      await page.route('**/api/results', route => route.fulfill({ json: { result: entries[0], totalParticipants: entries.length, selectionCount: 150 } }));
      // A valid selected result for somebody else must never be shown.
      await submit(page, 150);
      await page.locator('#result-error').waitFor();
      assert.equal(await page.locator('#result-title').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reveal my result', exact: true }).isEnabled(), true);
      await page.unroute('**/api/results');
      await page.getByRole('button', { name: 'Reveal my result', exact: true }).click();
      await page.getByRole('heading', { name: 'Thank you for taking on Ascent.' }).waitFor();
      console.log('PASS: another participant’s valid result is rejected; retry shows the requested result');
    });

    for (const [name, suffix] of [['sharing', '-> ./ResultShare'], ['celebration', '-> ./ResultCelebration']]) {
      if (scenario && scenario !== name) continue;
      await withPage(async page => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let blocked = 0;
        await page.route(`**/${chunkFor(suffix)}`, route => { blocked++; return route.abort('failed'); });
        await submit(page, 0);
        await page.getByRole('heading', { name: 'You’re through.' }).waitFor();
        if (name === 'sharing') await page.getByText('Sharing couldn’t load.', { exact: false }).waitFor();
        else await page.getByRole('button', { name: 'Download share card', exact: true }).waitFor();
        assert.ok(blocked > 0);
        assert.equal(await page.getByRole('heading', { name: 'You’re through.' }).isVisible(), true);
        assert.equal(await page.getByRole('button', { name: 'Print / save result' }).isVisible(), true);
        assert.deepEqual(errors, []);
        await page.getByRole('button', { name: 'Check another username' }).click();
        await page.getByLabel('Contest username', { exact: true }).waitFor();
        console.log(`PASS: failed ${name} chunk preserves the result, printing and another lookup`);
      });
    }

    if (!scenario || scenario === 'download') await withPage(async page => {
      const chunk = `**/${chunkFor('-> @/lib/resultShareCard')}`;
      await page.route(chunk, route => route.abort('failed'));
      await submit(page, 0);
      await page.getByRole('button', { name: 'Download share card', exact: true }).click();
      await page.getByText('We couldn’t create the share card.', { exact: false }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'You’re through.' }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Download share card', exact: true }).isEnabled(), true);
      await page.unroute(chunk);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download share card', exact: true }).click();
      assert.equal((await download).suggestedFilename(), 'ascent-2026-round-2-rank-1.png');
      console.log('PASS: failed image chunk gives a clear message; retry downloads the PNG');
    });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
