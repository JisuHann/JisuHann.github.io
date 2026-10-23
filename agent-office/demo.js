#!/usr/bin/env node
// Demo: writes fake session logs so you can watch the office move without Claude Code.
// Usage: node demo.js   (works without Claude Code; never touches your real logs)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-office-demo-'));
const mk = (name) => { const p = path.join(dir, '-Users-me-' + name); fs.mkdirSync(p, { recursive: true }); return p; };
const projA = mk('skillchaining'), projB = mk('robotics-safety'), projC = mk('legal-ai'), projD = mk('brainstorm'); mk('old-project');
fs.writeFileSync(path.join(dir, '-Users-me-old-project', 'old.jsonl'),
  JSON.stringify({ type: 'user', cwd: '/Users/me/old-project', message: { role: 'user', content: 'An old project' } }) + '\n');
const old = Date.now() / 1000 - 5 * 86400; fs.utimesSync(path.join(dir, '-Users-me-old-project', 'old.jsonl'), old, old);

const sid = 'demo-session-1';
const file = path.join(projA, sid + '.jsonl');
const fileB = path.join(projB, 'demo-b.jsonl');
const cwd = '/Users/me/skillchaining';
let n = 0;
const line = (f, o) => fs.appendFileSync(f, JSON.stringify(Object.assign({ cwd: f === file ? cwd : '/Users/me/robotics-safety', sessionId: sid, timestamp: new Date().toISOString() }, o)) + '\n');
const A = (content) => line(file, { type: 'assistant', message: { role: 'assistant', content } });
const U = (content) => line(file, { type: 'user', message: { role: 'user', content } });
const tool = (name, input) => { const id = 'toolu_' + (++n); A([{ type: 'tool_use', id, name, input }]); return id; };
const result = (id, text, err) => U([{ type: 'tool_result', tool_use_id: id, content: text, is_error: !!err }]);
const sub = (agentName, o) => { const d = path.join(projA, sid, 'subagents'); fs.mkdirSync(d, { recursive: true }); line(path.join(d, agentName + '.jsonl'), Object.assign({ isSidechain: true }, o)); };

line(fileB, { type: 'user', message: { role: 'user', content: 'Summarise the safety-filter ablation results' } });
const quiet = (proj, name, text) => { const f = path.join(proj, name + '.jsonl'); fs.writeFileSync(f, JSON.stringify({ type: 'user', cwd: '/Users/me/' + path.basename(proj).replace('-Users-me-', ''), sessionId: name, timestamp: new Date().toISOString(), message: { role: 'user', content: text } }) + '\n'); const t = Date.now() / 1000 - 3600; fs.utimesSync(f, t, t); };
quiet(projC, 'demo-c', 'Draft the clause comparison table');
quiet(projD, 'demo-d', 'List ideas for the workshop');

const script = [
  () => U('Add a skill-graph view that groups chains by category'),
  () => A([{ type: 'thinking', thinking: 'First understand the current structure and decide where the new view goes' }]),
  () => { const id = tool('TodoWrite', { todos: [{ content: 'Understand existing code', status: 'in_progress' }, { content: 'Write the grouping function', status: 'pending' }, { content: 'Add the chart view', status: 'pending' }, { content: 'Run tests', status: 'pending' }] }); result(id, 'ok'); },
  () => { const id = tool('Glob', { pattern: 'src/**/*.tsx' }); result(id, 'src/App.tsx\nsrc/List.tsx'); },
  () => { const id = tool('Read', { file_path: '/Users/me/skillchaining/src/App.tsx' }); result(id, '...'); },
  () => { global.ag = tool('Agent', { subagent_type: 'Explore', description: 'Find chart library usage', prompt: 'Find where the project uses a chart library' }); },
  () => sub('agent-a1', { type: 'user', message: { role: 'user', content: 'Find where the project uses a chart library' } }),
  () => sub('agent-a1', { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x1', name: 'Grep', input: { pattern: 'recharts' } }] } }),
  () => { const id = tool('WebSearch', { query: 'recharts donut chart example' }); result(id, '...'); },
  () => sub('agent-a1', { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x2', name: 'Read', input: { file_path: '/x/Chart.tsx' } }] } }),
  () => result(global.ag, 'Charts are only used in src/Chart.tsx.'),
  () => { global.pl = tool('Agent', { subagent_type: 'Plan', description: 'Design the view', prompt: 'Plan the implementation of the view' }); },
  () => sub('agent-p1', { type: 'user', message: { role: 'user', content: 'Plan the implementation of the view' } }),
  () => sub('agent-p1', { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'y1', name: 'Read', input: { file_path: '/x/stats.ts' } }] } }),
  () => { const id = tool('Edit', { file_path: '/Users/me/skillchaining/src/stats.ts' }); result(id, 'ok'); },
  () => result(global.pl, 'Plan: 1) aggregate 2) chart 3) add a tab'),
  () => { const id = tool('Write', { file_path: '/Users/me/skillchaining/src/StatsScreen.tsx' }); result(id, 'ok'); },
  () => { const id = tool('Bash', { command: 'npm test' }); result(id, 'FAIL src/stats.test.ts — expected 3 but got 2', true); },
  () => A([{ type: 'thinking', thinking: 'The test failed. Let me check the date-boundary handling' }]),
  () => { const id = tool('Edit', { file_path: '/Users/me/skillchaining/src/stats.ts' }); result(id, 'ok'); },
  () => { const id = tool('Bash', { command: 'npm test' }); result(id, 'PASS'); },
  () => { const id = tool('AskUserQuestion', { questions: [{ question: 'Should the chart be a donut or a bar chart?' }] }); result(id, 'Donut'); },
  () => { const id = tool('Bash', { command: 'git commit -m "Add category view"' }); result(id, 'ok'); },
  () => A([{ type: 'text', text: 'Added the category view: a donut chart plus monthly totals.' }]),
];

// ── Codex pretends to work in the same project ──
const cxDir = path.join(dir, 'codex', 'sessions', '2026', '10', '20');
fs.mkdirSync(cxDir, { recursive: true });
const CXID = '01a15a00-0000-7000-8000-00000000c0de', GID = '01a15a00-0000-7000-8000-00000000a11d';
const cxFile = path.join(cxDir, `rollout-2026-10-20T10-00-00-${CXID}.jsonl`);
const gFile = path.join(cxDir, `rollout-2026-10-20T10-00-05-${GID}.jsonl`);
const cx = (f, type, payload) => fs.appendFileSync(f, JSON.stringify({ timestamp: new Date().toISOString(), type, payload }) + '\n');
cx(cxFile, 'session_meta', { id: CXID, cwd, originator: 'Codex Desktop', source: 'vscode' });
cx(gFile, 'session_meta', { id: GID, parent_thread_id: CXID, cwd, thread_source: 'guardian_review', source: { subagent: { other: 'guardian' } } });
const item = (it) => cx(cxFile, 'event_msg', { type: 'item_completed', item: it });
const exec = (cmd) => cx(cxFile, 'response_item', { type: 'custom_tool_call', name: 'exec', input: `const r = await tools.exec_command({cmd:"${cmd}"}); text(r);` });
let cxi = 0;
const cxScript = [
  () => item({ type: 'UserMessage', content: [{ type: 'text', text: 'Add a feature that exports the skill list to CSV' }] }),
  () => item({ type: 'Reasoning', summary_text: ['**Find where to export** A button in the settings screen seems right'] }),
  () => { exec('rg -n export src'); item({ type: 'CommandExecution', parsed_cmd: [{ type: 'search', cmd: 'rg -n export src' }], exit_code: 0 }); },
  () => { exec('sed -n 1,80p src/Settings.tsx'); item({ type: 'CommandExecution', parsed_cmd: [{ type: 'read', path: 'src/Settings.tsx' }], exit_code: 0 }); },
  () => cx(gFile, 'event_msg', { type: 'task_started' }),
  () => item({ type: 'FileChange', changes: { '/Users/me/skillchaining/src/exportCsv.ts': { type: 'add' } } }),
  () => cx(gFile, 'event_msg', { type: 'task_complete' }),
  () => { exec('npm run build'); },
  () => item({ type: 'CommandExecution', parsed_cmd: [{ type: 'unknown', cmd: 'npm run build' }], exit_code: 1, stderr: "TS2345: Argument of type 'string' is not assignable" }),
  () => item({ type: 'Extension', kind: 'web.search', query: 'CSV Excel BOM encoding' }),
  () => item({ type: 'FileChange', changes: { '/Users/me/skillchaining/src/exportCsv.ts': { type: 'update' } } }),
  () => { exec('npm run build'); item({ type: 'CommandExecution', parsed_cmd: [{ type: 'unknown', cmd: 'npm run build' }], exit_code: 0 }); },
  () => item({ type: 'AgentMessage', content: [{ type: 'text', text: 'Added a CSV export button to the settings screen, with a BOM so Excel reads it correctly.' }] }),
];

let i = 0;
const timer = setInterval(() => {
  if (i < script.length) script[i++]();
  else if (i++ > script.length + 12) i = 0; // rest a moment, then repeat
  if (i % 2 === 0) { if (cxi < cxScript.length) cxScript[cxi++](); else if (cxi++ > cxScript.length + 8) cxi = 0; }
}, 1600);

const srv = spawn(process.execPath, [path.join(__dirname, 'server.js'), ...process.argv.slice(2)], { stdio: 'inherit', env: Object.assign({}, process.env, { CLAUDE_PROJECTS_DIR: dir, CODEX_SESSIONS_DIR: path.join(dir, 'codex', 'sessions') }) });
const bye = () => { clearInterval(timer); srv.kill(); process.exit(0); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
console.log('🎬 Demo mode — moving on fake session logs. (temp folder: ' + dir + ')');
