const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const NM = path.join(__dirname, 'node_modules');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
html = html
  .replace('https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js', '/vendor/react.js')
  .replace('https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js', '/vendor/react-dom.js')
  .replace('https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js', '/vendor/babel.js')
  .replace(/<link[^>]*fonts[^>]*>/g, '');
const vendor = {
  '/vendor/react.js': fs.readFileSync(path.join(NM, 'react/umd/react.production.min.js')),
  '/vendor/react-dom.js': fs.readFileSync(path.join(NM, 'react-dom/umd/react-dom.production.min.js')),
  '/vendor/babel.js': fs.readFileSync(path.join(NM, '@babel/standalone/babel.min.js')),
};
const server = http.createServer((req, res) => {
  if (vendor[req.url]) { res.setHeader('Content-Type', 'application/javascript'); res.end(vendor[req.url]); return; }
  res.setHeader('Content-Type', 'text/html'); res.end(html);
});

const getProgOf = (pg) => pg.evaluate(() => {
  const sid = JSON.parse(localStorage.getItem('forge_session'));
  const us = JSON.parse(localStorage.getItem('forge_users')) || [];
  const id = sid || (us[0] && us[0].id);
  return JSON.parse(localStorage.getItem('forge_prog_' + id));
});
const seedUser = (pg, name, extraProfile, prog) => pg.evaluate(([n, xp, pr]) => {
  const id = 'u_seed';
  localStorage.setItem('forge_users', JSON.stringify([{id, name: n, passHash: '', profile: Object.assign({name: n, ageBand: 'Adult', goals: ['money'], interests: '', style: 'straight', psych: {}, mentorName: 'Forge', created: '2026-07-04'}, xp)}]));
  localStorage.setItem('forge_session', JSON.stringify(id));
  localStorage.setItem('forge_parent', JSON.stringify({pin: '1234', recoveryWord: ''}));
  if (pr) localStorage.setItem('forge_prog_' + id, JSON.stringify(pr));
}, [name, extraProfile || {}, prog || null]);

(async () => {
  await new Promise(r => server.listen(8935, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  let failed = 0;
  const step = async (name, fn) => { try { await fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };

  // ── Scenario A: lazy user skips EVERYTHING ──
  const pa = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errA = []; pa.on('pageerror', e => errA.push(e.message));
  await pa.goto('http://localhost:8935', { waitUntil: 'load' }); await pa.waitForTimeout(2200);
  await step('A: signup then skip setup → app works with defaults', async () => {
    await pa.fill('input[aria-label="Your name"]', 'Sky');
    await pa.fill('input[aria-label="New password"]', 'pass1234');
    await pa.click('text=Create Account →');
    await pa.waitForSelector('text=How old are you?');
    await pa.click('text=Skip setup — use defaults');
    await pa.waitForSelector('text=Your mentor', { timeout: 8000 });
    const users = await pa.evaluate(() => JSON.parse(localStorage.getItem('forge_users')));
    if (users[0].profile.name !== 'Sky' || !users[0].profile.goals.length) throw new Error('bad defaults: ' + JSON.stringify(users[0].profile));
  });
  await step('A: challenge + quiz still work with default profile', async () => {
    await pa.click('.bnav >> text=Today');
    await pa.waitForSelector('.task-box', { timeout: 8000 });
    await pa.click('text=Done — Check Me ✓');
    await pa.waitForSelector('text=Mentor check-in · 1 of 3');
  });

  // ── Scenario B: streak farming — completing 3x same day counts once ──
  const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errB = []; pb.on('pageerror', e => errB.push(e.message));
  await pb.goto('http://localhost:8935', { waitUntil: 'load' });
  await seedUser(pb, 'Max');
  await pb.reload({ waitUntil: 'load' }); await pb.waitForTimeout(2200);
  await step('B: 3 completions same day = streak 1, history 3', async () => {
    for (let i = 0; i < 3; i++) {
      await pb.click('.bnav >> text=Today');
      await pb.waitForSelector('.task-box', { timeout: 8000 });
      await pb.click('text=Done — Check Me ✓');
      // answer all 3 correct (money L1 c=[0,1,2]; L2 c=[0,1,2]; L3 c=[0,2,1])
      const cs = [[0,1,2],[0,1,2],[0,2,1]][i];
      for (let q = 0; q < 3; q++) {
        await pb.waitForSelector(`text=Mentor check-in · ${q + 1} of 3`, { timeout: 6000 });
        const opts = await pb.$$('.quiz-opt');
        await opts[cs[q]].click();
        await pb.waitForTimeout(950);
      }
      await pb.waitForSelector('.done-title', { timeout: 6000 });
      if (i < 2) { const btn = await pb.$('.btn-next'); if (btn) await btn.click(); await pb.waitForTimeout(600); }
    }
    const prog = await getProgOf(pb);
    if (prog.streak !== 1) throw new Error('streak farmable! streak=' + prog.streak);
    if (prog.history.length !== 3) throw new Error('history=' + prog.history.length);
    if (prog.levels.money !== 3) throw new Error('should be L4 now: ' + prog.levels.money);
  });
  await step('B: heat capped at 3 despite repeated 3/3', async () => {
    const prog = await getProgOf(pb);
    if (prog.heat.money !== 3) throw new Error('heat=' + prog.heat.money);
  });

  // ── Scenario C: yesterday's streak continues; 2-day gap resets ──
  const pc = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pc.goto('http://localhost:8935', { waitUntil: 'load' });
  await step('C: consecutive-day streak increments, gap resets', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    // seed: completed yesterday, streak 5
    await seedUser(pc, 'T', {}, {levels:{},heat:{},streak:5,lastDay:yesterday,history:[]});
    await pc.reload({ waitUntil: 'load' }); await pc.waitForTimeout(2200);
    await pc.click('.bnav >> text=Today');
    await pc.waitForSelector('.task-box', { timeout: 8000 });
    await pc.click('text=Done — Check Me ✓');
    await pc.waitForSelector('.quiz-q');
    let prog = await getProgOf(pc);
    if (prog.streak !== 6) throw new Error('consecutive day should be 6, got ' + prog.streak);
    // reseed: last completed 3 days ago
    await pc.evaluate(([t]) => {
      localStorage.setItem('forge_prog_u_seed', JSON.stringify({levels:{},heat:{},streak:9,lastDay:t,history:[]}));
    }, [threeDaysAgo]);
    await pc.reload({ waitUntil: 'load' }); await pc.waitForTimeout(2200);
    await pc.click('.bnav >> text=Today');
    await pc.waitForSelector('.task-box', { timeout: 8000 });
    await pc.click('text=Done — Check Me ✓');
    await pc.waitForSelector('.quiz-q');
    prog = await getProgOf(pc);
    if (prog.streak !== 1) throw new Error('gap should reset to 1, got ' + prog.streak);
  });

  // ── Scenario D: corrupted localStorage doesn't crash the app ──
  const pd = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errD = []; pd.on('pageerror', e => errD.push(e.message));
  await pd.goto('http://localhost:8935', { waitUntil: 'load' });
  await step('D: corrupted storage → app falls back to welcome, no crash', async () => {
    await pd.evaluate(() => { localStorage.setItem('forge_users', '{corrupt!!!'); localStorage.setItem('forge_session', 'also broken'); localStorage.setItem('forge_profile', '{nope'); });
    await pd.reload({ waitUntil: 'load' }); await pd.waitForTimeout(2200);
    await pd.waitForSelector('text=Create Account →', { timeout: 8000 });
    if (errD.length) throw new Error('page errors: ' + errD[0]);
  });

  // ── Scenario E: mid-quiz track switch doesn't corrupt state ──
  const pe = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errE = []; pe.on('pageerror', e => errE.push(e.message));
  await pe.goto('http://localhost:8935', { waitUntil: 'load' });
  await step('E: switching tracks mid-quiz resets cleanly', async () => {
    await seedUser(pe, 'Z', {ageBand: '12-15', style: 'fun'});
    await pe.reload({ waitUntil: 'load' }); await pe.waitForTimeout(2200);
    await pe.click('.bnav >> text=Today');
    await pe.waitForSelector('.task-box', { timeout: 8000 });
    await pe.click('text=Done — Check Me ✓');
    await pe.waitForSelector('.quiz-q');
    // bail mid-quiz to home, switch track, return
    await pe.click('.bnav >> text=Home');
    await pe.click('.track-pill >> text=AI Skills');
    await pe.click('.bnav >> text=Today');
    await pe.waitForSelector('.task-box', { timeout: 8000 });
    if (errE.length) throw new Error('page errors: ' + errE[0]);
  });

  console.log('FAILED_STEPS=' + failed);
  const allErrs = [...errA, ...errB];
  console.log(allErrs.length ? 'PAGE ERRORS:\n' + allErrs.join('\n') : 'NO PAGE ERRORS');
  await browser.close(); server.close();
})();
