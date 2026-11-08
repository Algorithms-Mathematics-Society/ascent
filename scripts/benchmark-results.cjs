// Local production benchmark. Starts an isolated server; never targets the live site.
// npm run build && node scripts/benchmark-results.cjs /tmp/results-benchmark.json
require('tsx/cjs');
const { spawn } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { gzipSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');
const { ROUND_ONE_SELECTION_COUNT } = require('../src/lib/results.ts');
const { parseStandings } = require('../src/lib/resultsStandings.ts');
const entries = [...parseStandings(readFileSync('leaderboard/standings-ams-ascent-round-1.csv', 'utf8')).values()];
const base = 'http://127.0.0.1:3111';
const round = value => Math.round(value * 100) / 100;
const percentile = (values, p) => round(values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)]);

async function lookup(index) {
  const expected = entries[index % entries.length];
  const start = performance.now();
  const response = await fetch(`${base}/api/results`, {
    method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
    body: JSON.stringify({ username: expected.username }), signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const body = JSON.parse(text);
  if (response.status !== 200 || body.result?.username !== expected.username || body.result?.rank !== expected.rank || body.result?.selected !== (expected.rank <= ROUND_ONE_SELECTION_COUNT)) {
    throw new Error(`Incorrect result/status at request ${index}`);
  }
  return { latency: performance.now() - start, bytes: Buffer.byteLength(text) };
}

async function batch(requests, concurrency) {
  let next = 0;
  const values = [], failures = [];
  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < requests) {
      const index = next++;
      try { values.push(await lookup(index)); } catch (error) { failures.push(error.message); }
    }
  }));
  const elapsed = performance.now() - start;
  const latencies = values.map(v => v.latency).sort((a, b) => a - b);
  return { requests, concurrency, successful: values.length, errors: failures.length,
    p50Ms: percentile(latencies, .50), p95Ms: percentile(latencies, .95), p99Ms: percentile(latencies, .99),
    maxMs: round(latencies.at(-1)), elapsedMs: round(elapsed), requestsPerSecond: round(values.length / elapsed * 1000),
    meanResponseBytes: round(values.reduce((sum, v) => sum + v.bytes, 0) / values.length), ...(failures.length ? { failures: failures.slice(0, 3) } : {}) };
}

(async () => {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3111'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  try {
    for (let i = 0; !output.includes('Ready in'); i++) {
      if (server.exitCode !== null || i > 200) throw new Error(`Benchmark server did not start: ${output}`);
      await delay(50);
    }
    const coldBurst = process.argv.includes("--cold-burst") ? await batch(500, 500) : undefined;
    const first = coldBurst ? null : await lookup(0);
    const memory = () => Object.fromEntries(readFileSync(`/proc/${server.pid}/status`, 'utf8').split('\n').filter(line => /^(VmRSS|VmHWM):/.test(line)).map(line => { const [key, value] = line.split(':'); return [key, value.trim()]; }));
    const beforeMemory = memory();
    const sustained = await batch(1000, 50);
    const burst = await batch(500, 500);
    const manifest = JSON.parse(readFileSync('.next/app-build-manifest.json', 'utf8')).pages;
    const assets = [...new Set([...manifest['/layout'], ...manifest['/results/page']])].filter(file => file.endsWith('.js'));
    const scriptBytesGzip = assets.reduce((sum, file) => sum + gzipSync(readFileSync(`.next/${file}`)).length, 0);
    const report = { timestamp: new Date().toISOString(), environment: `Local single Next production process, ${process.version}; client and server on the same host. No WAN/TLS/CDN/serverless scaling measured.`, ...(first ? { firstLookupMs: round(first.latency) } : { coldBurst }), beforeMemory, afterMemory: memory(), initialScriptBytesGzip: scriptBytesGzip, sustained, burst };
    if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (coldBurst?.errors || sustained.errors || burst.errors) process.exitCode = 1;
  } finally { server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
