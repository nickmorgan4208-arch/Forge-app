#!/usr/bin/env node
/**
 * pipeline — local dashboard for the job hunt.
 *
 * Serves a single-page board over apply-kit's data files:
 *   jobs-queue.csv        the scouted/vetted queue (from /scout)
 *   applications/log.csv  what apply.mjs actually did
 *
 * Usage:  node pipeline.mjs   →  http://localhost:7777
 * Status changes made in the browser are written back to jobs-queue.csv,
 * so the queue is the single source of truth for /apply and TITAN alike.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUEUE = path.join(HERE, 'jobs-queue.csv');
const LOG = path.join(HERE, 'applications', 'log.csv');
const PORT = process.env.PIPELINE_PORT || 7777;
const STATUSES = ['queued', 'applied', 'interviewing', 'active', 'dead'];

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ''));
}

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function readTable(file) {
  if (!fs.existsSync(file)) return { header: [], rows: [] };
  const [header = [], ...rows] = parseCSV(fs.readFileSync(file, 'utf8'));
  return { header, rows: rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

function writeQueue(header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csvField(r[h])).join(','));
  fs.writeFileSync(QUEUE, lines.join('\n') + '\n');
}

function setStatus(url, status) {
  if (!STATUSES.includes(status)) return false;
  const { header, rows } = readTable(QUEUE);
  const row = rows.find((r) => r.url === url);
  if (!row) return false;
  row.status = status;
  writeQueue(header, rows);
  return true;
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pipeline</title><style>
:root{--bg:#080810;--s1:#10101c;--s2:#18182a;--border:#2a2a42;--accent:#e8ff47;--blue:#47c8ff;--red:#ff6b47;--green:#47ffaa;--text:#f0f0ff;--muted:#7070a0}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;padding:24px;max-width:1100px;margin:0 auto}
h1{color:var(--accent);font-size:26px;letter-spacing:-1px;margin-bottom:4px}
.sub{color:var(--muted);font-size:12px;margin-bottom:24px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:26px 0 10px}
.count{color:var(--accent)}
.card{background:var(--s1);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.card a{color:var(--text);text-decoration:none;font-weight:600}
.card a:hover{color:var(--accent)}
.meta{color:var(--muted);font-size:12px;flex:1 1 100%}
.pay{color:var(--green);font-size:13px}
.pill{font-size:10px;padding:2px 8px;border-radius:99px;border:1px solid var(--border);text-transform:uppercase;letter-spacing:.05em}
.pill.green{color:var(--green)} .pill.yellow{color:var(--accent)} .pill.stack{color:var(--blue)}
select{background:var(--s2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:5px 8px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{padding:6px 8px;border-bottom:1px solid var(--border);text-align:left;color:var(--muted)}
th{color:var(--text)}
.empty{color:var(--muted);font-size:13px;padding:8px 0}
</style></head><body>
<h1>Pipeline</h1><div class="sub">jobs-queue.csv is the source of truth — /scout adds to it, /apply works it, this board manages it</div>
<div id="board"></div>
<h2>Application log (from apply.mjs)</h2><div id="log"></div>
<script>
const STATUSES=${JSON.stringify(STATUSES)};
async function load(){
  const d=await (await fetch('/api/data')).json();
  const board=document.getElementById('board');board.innerHTML='';
  for(const s of STATUSES){
    const items=d.queue.filter(j=>(j.status||'queued')===s);
    const h=document.createElement('h2');h.innerHTML=s+' <span class="count">'+items.length+'</span>';board.appendChild(h);
    if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='—';board.appendChild(e);continue}
    for(const j of items){
      const c=document.createElement('div');c.className='card';
      const sel='<select onchange="setStatus(\\''+encodeURIComponent(j.url)+'\\',this.value)">'+STATUSES.map(x=>'<option '+(x===s?'selected':'')+'>'+x+'</option>').join('')+'</select>';
      c.innerHTML='<a href="'+j.url+'" target="_blank">'+j.title+'</a><span class="pay">'+(j.pay||'')+'</span>'
        +'<span class="pill '+j.risk+'">'+j.risk+'</span><span class="pill stack">'+j.mode+'</span><span class="pill">lev '+j.leverage+'</span>'+sel
        +'<div class="meta">'+j.company+' — '+(j.notes||'')+'</div>';
      board.appendChild(c);
    }
  }
  const log=document.getElementById('log');
  if(!d.log.length){log.innerHTML='<div class="empty">No applications logged yet.</div>';return}
  log.innerHTML='<table><tr><th>when</th><th>url</th><th>result</th></tr>'
    +d.log.slice().reverse().map(r=>'<tr><td>'+r.timestamp+'</td><td><a href="'+r.url+'" target="_blank">'+r.url.slice(0,60)+'</a></td><td>'+r.status+'</td></tr>').join('')+'</table>';
}
async function setStatus(url,status){
  await fetch('/api/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:decodeURIComponent(url),status})});
  load();
}
load();setInterval(load,30000);
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
  } else if (req.method === 'GET' && req.url === '/api/data') {
    res.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ queue: readTable(QUEUE).rows, log: readTable(LOG).rows }));
  } else if (req.method === 'POST' && req.url === '/api/status') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const { url, status } = JSON.parse(body);
        res.writeHead(setStatus(url, status) ? 200 : 400).end();
      } catch { res.writeHead(400).end(); }
    });
  } else {
    res.writeHead(404).end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pipeline board: http://localhost:${PORT}`);
});
