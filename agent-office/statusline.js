#!/usr/bin/env node
// 클로드 오피스 — Claude Code 상태줄
// Claude Code 가 상태줄에 넘겨주는 정보(JSON) 중 사용량(rate_limits)을 usage.json 에 적어 두고,
// 터미널 아래쪽에 짧은 한 줄을 보여줌. 이 폴더 안에만 씀. 토큰 사용 없음.
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'usage.json');
let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch { }
  const rl = d.rate_limits || {};
  const win = (w) => w && typeof w.used_percentage === 'number' ? { used: w.used_percentage, resets_at: w.resets_at || 0 } : null;
  const five = win(rl.five_hour), week = win(rl.seven_day);
  if (five || week) { // 받은 게 있을 때만 갱신 (첫 답장 전엔 비어 있음)
    try {
      const tmp = OUT + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ claude: { five_hour: five, seven_day: week, at: Date.now() } }));
      fs.renameSync(tmp, OUT); // 반쯤 쓴 파일을 서버가 읽지 않게
    } catch { }
  }
  const pct = (w) => w ? Math.round(w.used) + '%' : '-';
  const model = (d.model && d.model.display_name) || 'Claude';
  const parts = [`✳ ${model}`];
  if (five || week) parts.push(`5시간 ${pct(five)} · 주간 ${pct(week)}`);
  if (d.context_window && typeof d.context_window.used_percentage === 'number') parts.push(`대화 ${Math.round(d.context_window.used_percentage)}%`);
  process.stdout.write(parts.join('  |  '));
});
