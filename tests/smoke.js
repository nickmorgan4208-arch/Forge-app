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

(async () => {
  await new Promise(r => server.listen(8933, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8933', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);

  let failed = 0;
  const step = async (name, fn) => { try { await fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };

  // Answer the current quiz question, choosing correct or wrong deliberately.
  const answerQ = async (correct) => {
    await page.waitForSelector('.quiz-q', { timeout: 6000 });
    const rightText = await page.evaluate(() => {
      // The correct option gets class 'correct' only after picking; instead read from data
      return null;
    });
    // Click first option; check flash class to learn if it was correct; we instead brute-force:
    // find the option that turns green by trying: we can't retry, so use the known quiz data ordering:
    // correct answers for money L1 are indexes [0,1,2] per question order.
    return rightText;
  };

  await step('welcome + full psych onboarding', async () => {
    await page.click('text=Get Started');
    await page.waitForSelector('text=What should your mentor call you?');
    await page.fill('input.field-input', 'Carley'); await page.click('text=Next →');
    await page.waitForSelector('text=How old are you?'); await page.click('text=8-11'); await page.click('text=Next →');
    await page.waitForSelector('text=What do you want to get good at?'); await page.click('text=💵 Understand money'); await page.click('text=Next →');
    await page.waitForSelector('text=$100 lands in your hands'); await page.click('text=I\'d try to flip it into more money');
    await page.waitForSelector('text=bike breaks'); await page.click('text=Offer to buy it cheap, fix it, resell it');
    await page.waitForSelector('text=genuinely hard'); await page.click('text=Lock in. I kind of like hard');
    await page.waitForSelector('text=What are you into?'); await page.fill('input.field-input', 'Minecraft');
    await page.click('text=Build my mentor ⚡');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
  });

  await step('psych sets starting heat (money=2 from flipper answer)', async () => {
    const heat = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_progress')).heat);
    if (heat.money !== 2 || heat.business !== 2 || heat.ai !== 1) throw new Error('heat=' + JSON.stringify(heat));
  });

  await page.waitForTimeout(800); await page.screenshot({ path: 'v3-home.png' });

  await step('challenge shows heat chip', async () => {
    await page.click('.bnav >> text=Today');
    await page.waitForSelector('.task-box', { timeout: 8000 });
    await page.waitForSelector('.heat-chip');
  });
  await page.waitForTimeout(700); await page.screenshot({ path: 'v3-challenge.png' });

  await step('complete → mentor check-in appears', async () => {
    await page.click('text=Done — Check Me ✓');
    await page.waitForSelector('text=Mentor check-in · 1 of 3', { timeout: 6000 });
  });
  await page.waitForTimeout(400); await page.screenshot({ path: 'v3-quiz.png' });

  // Money L1 correct answers are at indexes 0,1,2 for q1,q2,q3
  await step('ace quiz 3/3 → level up + heat turned up', async () => {
    const correctIdx = [0, 1, 2];
    for (let q = 0; q < 3; q++) {
      await page.waitForSelector(`text=Mentor check-in · ${q + 1} of 3`, { timeout: 6000 });
      const opts = await page.$$('.quiz-opt');
      await opts[correctIdx[q]].click();
      await page.waitForTimeout(950);
    }
    await page.waitForSelector('text=Level Up!', { timeout: 6000 });
    await page.waitForSelector('text=Turning up the heat', { timeout: 3000 });
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_progress')));
    if (prog.heat.money !== 3) throw new Error('heat not raised: ' + prog.heat.money);
    if (prog.levels.money !== 1) throw new Error('level not advanced: ' + prog.levels.money);
  });
  await page.screenshot({ path: 'v3-levelup.png' });

  await step('bomb quiz 0/3 → heat down + level held', async () => {
    await page.click('.btn-next'); // next challenge (L2 banking)
    await page.waitForSelector('.task-box', { timeout: 8000 });
    await page.click('text=Done — Check Me ✓');
    // wrong answers for banking L2 (correct are 0,1,2 → click 1,0,0)
    const wrongIdx = [1, 0, 0];
    for (let q = 0; q < 3; q++) {
      await page.waitForSelector(`text=Mentor check-in · ${q + 1} of 3`, { timeout: 6000 });
      const opts = await page.$$('.quiz-opt');
      await opts[wrongIdx[q]].click();
      await page.waitForTimeout(950);
    }
    await page.waitForSelector('text=Locked In', { timeout: 6000 });
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_progress')));
    if (prog.heat.money !== 2) throw new Error('heat not lowered: ' + prog.heat.money);
    if (prog.levels.money !== 1) throw new Error('level should hold at 1: ' + prog.levels.money);
  });

  await step('mentor tab shows psych + heat', async () => {
    await page.click('.bnav >> text=Mentor');
    await page.waitForSelector('text=natural hustler');
  });

  await step('parent portal: admin test mode + heat override + recovery word', async () => {
    await page.click('.bnav >> text=Home');
    await page.click('text=parent');
    await page.waitForSelector('text=Parent Access');
    for (const k of ['1','2','3','4']) await page.click(`.pin-key >> text="${k}"`);
    await page.waitForSelector('text=Admin · Test Mode');
    await page.click('.mini-chip >> text=🚀 Business');
    await page.waitForSelector('text=Spot Problems — today\'s bank challenge');
    await page.click('.mini-chip >> text=🔥 Turned up');
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_progress')));
    if (prog.heat.business !== 3) throw new Error('admin heat override failed');
    await page.fill('input[aria-label="Recovery word"]', 'buster');
    await page.click('.p-card:has-text("Security") >> .btn-send >> nth=1');
    await page.waitForTimeout(400);
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_profile')));
    if (prof.recoveryWord !== 'buster') throw new Error('recovery word not saved: ' + prof.recoveryWord);
  });
  await page.waitForTimeout(500); await page.screenshot({ path: 'v3-admin.png' });

  await step('change PIN, then recover forgotten PIN with recovery word', async () => {
    await page.fill('input[aria-label="New 4-digit PIN"]', '7777');
    await page.click('.p-card:has-text("Security") >> .btn-send >> nth=0');
    await page.waitForTimeout(300);
    await page.click('text=exit');
    await page.click('text=parent');
    await page.waitForSelector('text=Parent Access');
    for (const k of ['1','2','3','4']) await page.click(`.pin-key >> text="${k}"`); // old pin now wrong
    await page.waitForSelector('text=Incorrect PIN');
    await page.click('text=Forgot PIN?');
    await page.fill('input[aria-label="Recovery word"]', 'buster');
    await page.click('.forgot-box button.btn-send');
    await page.waitForSelector('text=Admin · Test Mode', { timeout: 5000 });
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_profile')));
    if (prof.parentPin !== '1234') throw new Error('pin not reset: ' + prof.parentPin);
  });

  await step('persistence across reload', async () => {
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2000);
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
    const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_progress')));
    if (prog.streak !== 1 || prog.history.length !== 2) throw new Error('progress lost: ' + JSON.stringify({s: prog.streak, h: prog.history.length}));
  });

  const realErrors = errors.filter(e => !e.includes('font') && !e.includes('googleapis'));
  console.log('FAILED_STEPS=' + failed);
  console.log(realErrors.length ? 'ERRORS:\n' + realErrors.join('\n') : 'NO CONSOLE/PAGE ERRORS');
  await browser.close(); server.close();
})();
