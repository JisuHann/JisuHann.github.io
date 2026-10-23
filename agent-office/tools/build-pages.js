#!/usr/bin/env node
// Builds the GitHub Pages demo: index.html = office.html + a fake /events stream (fake data only).
//   node tools/build-pages.js            rebuild index.html from docs/replay.json
//   node tools/build-pages.js --record   first record a fresh replay from `node demo.js` (~95 s)
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), REPLAY = path.join(ROOT, 'docs', 'replay.json'), OUT = path.join(ROOT, 'index.html');
const PORT = 4791, SECONDS = 95;

function record() {
  return new Promise((resolve, reject) => {
    const demo = spawn(process.execPath, [path.join(ROOT, 'demo.js'), '--no-open'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore' });
    const out = []; let buf = '', t0 = 0;
    const done = () => { demo.kill(); clearTimeout(timer); resolve(out); };
    const timer = setTimeout(done, SECONDS * 1000 + 2500);
    setTimeout(() => {
      http.get(`http://127.0.0.1:${PORT}/events`, (res) => {
        t0 = Date.now(); res.setEncoding('utf8');
        res.on('data', (d) => {
          buf += d; let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const blk = buf.slice(0, i); buf = buf.slice(i + 2);
            const ev = /event: (\w+)/.exec(blk), da = /data: (.*)/.exec(blk);
            if (ev && da) out.push({ t: Date.now() - t0, e: ev[1], d: JSON.parse(da[1]) });
          }
        });
      }).on('error', reject);
    }, 2000);
  });
}

// Strip everything machine-specific so only the fake demo content remains.
function scrub(rec) {
  for (const r of rec) if (r.e === 'snap') {
    Object.assign(r.d, { root: '/demo/claude/projects', codex: '/demo/codex/sessions', user: 'You', self: '', building: 'Agent Office' });
  }
  const raw = JSON.stringify(rec);
  for (const bad of [process.env.HOME, require('os').userInfo().username, '/home/']) if (bad && bad.length > 2 && raw.includes(bad)) throw new Error('replay still contains: ' + bad);
  return rec;
}

const MOCK = (replay) => `<script>
// ---- GitHub Pages demo: replays a recorded stream of FAKE events instead of connecting to a server ----
(() => {
  const REPLAY = ${JSON.stringify(replay)};
  const BASE = REPLAY.find((r) => r.e === 'ev').d.at - REPLAY.find((r) => r.e === 'ev').t, LOOP = REPLAY[REPLAY.length - 1].t + 6000;
  const shift = (v, off) => Array.isArray(v) ? v.map((x) => shift(x, off)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x, off)])) : typeof v === 'number' && v > 1.5e12 ? v + off : v;
  class FakeES {
    constructor() { this.l = {}; this.timers = []; setTimeout(() => this.play(), 50); }
    addEventListener(n, f) { (this.l[n] = this.l[n] || []).push(f); }
    play() {
      const off = Date.now() - BASE - REPLAY[0].t; // shift recorded clock to "now"
      for (const r of REPLAY) this.timers.push(setTimeout(() => (this.l[r.e] || []).forEach((f) => f({ data: JSON.stringify(shift(r.d, off)) })), r.t));
      this.timers.push(setTimeout(() => this.play(), LOOP));
    }
  }
  window.EventSource = FakeES;
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => String(u).startsWith('/setup') ? Promise.resolve(new Response(JSON.stringify({ ok: false, msg: 'Demo only: settings are disabled here.' }))) : realFetch(u, o);
})();
</script>`;
const RIBBON = `<div id="demoRibbon" style="position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:99;background:#1d2033;color:#fff;font:600 12px/1.3 'Helvetica Neue',Helvetica,Arial,sans-serif;padding:6px 12px;border-radius:14px;opacity:.92;pointer-events:none;text-align:center;width:max-content;max-width:calc(100vw - 24px)">Demo with fake data · the real app shows your own Claude Code / Codex sessions live · <span style="color:#9ecbff">jisuhann.github.io/agent-office</span></div>`;

(async () => {
  if (process.argv.includes('--record')) { console.log(`recording ${SECONDS}s from demo.js …`); fs.writeFileSync(REPLAY, JSON.stringify(scrub(await record()))); }
  const replay = JSON.parse(fs.readFileSync(REPLAY, 'utf8'));
  let html = fs.readFileSync(path.join(ROOT, 'office.html'), 'utf8');
  if (!html.includes('</head>') || !html.includes('</body>')) throw new Error('office.html layout changed');
  html = html.replace('</head>', () => MOCK(replay) + '\n</head>').replace('</body>', () => RIBBON + '\n</body>');
  fs.writeFileSync(OUT, html);
  console.log('wrote', path.relative(ROOT, OUT), (html.length / 1024).toFixed(0) + ' KB,', replay.length, 'events');
})().catch((e) => { console.error(e.message); process.exit(1); });
