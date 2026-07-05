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
  await new Promise(r => server.listen(8936, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8936', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);

  let failed = 0;
  const step = async (name, fn) => { try { await fn(); console.log('OK  ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };
  const getProg = () => page.evaluate(() => {
    const sid = JSON.parse(localStorage.getItem('forge_session'));
    return JSON.parse(localStorage.getItem('forge_prog_' + sid));
  });

  await step('signup screen shows for fresh device', () => page.waitForSelector('text=Create Account →', { timeout: 8000 }));

  await step('eye toggle reveals and hides password', async () => {
    await page.fill('input[aria-label="New password"]', 'secret1');
    let type = await page.getAttribute('.pw-wrap input', 'type');
    if (type !== 'password') throw new Error('should start hidden, got ' + type);
    await page.click('.eye-btn');
    type = await page.getAttribute('.pw-wrap input', 'type');
    if (type !== 'text') throw new Error('eye should reveal, got ' + type);
    const visible = await page.inputValue('.pw-wrap input');
    if (visible !== 'secret1') throw new Error('value mismatch');
    await page.click('.eye-btn');
    type = await page.getAttribute('.pw-wrap input', 'type');
    if (type !== 'password') throw new Error('eye should re-hide, got ' + type);
  });

  await step('short password rejected', async () => {
    await page.fill('input[aria-label="Your name"]', 'Carley');
    await page.fill('input[aria-label="New password"]', 'ab');
    await page.click('text=Create Account →');
    await page.waitForSelector('text=at least 4 characters');
  });

  await step('signup → psych onboarding → home', async () => {
    await page.fill('input[aria-label="New password"]', 'secret1');
    await page.click('text=Create Account →');
    await page.waitForSelector('text=How old are you?');
    await page.click('text=8-11'); await page.click('text=Next →');
    await page.waitForSelector('text=What do you want to get good at?'); await page.click('text=💵 Understand money'); await page.click('text=Next →');
    await page.waitForSelector('text=$100 lands in your hands'); await page.click('text=I\'d try to flip it into more money');
    await page.waitForSelector('text=bike breaks'); await page.click('text=Offer to buy it cheap, fix it, resell it');
    await page.waitForSelector('text=genuinely hard'); await page.click('text=Lock in. I kind of like hard');
    await page.waitForSelector('text=What are you into?'); await page.fill('input.field-input', 'Minecraft');
    await page.click('text=Build my mentor ⚡');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
  });

  await step('psych seeds heat + password stored as hash only', async () => {
    const prog = await getProg();
    if (prog.heat.money !== 2 || prog.heat.business !== 2 || prog.heat.ai !== 1) throw new Error('heat=' + JSON.stringify(prog.heat));
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_users')));
    if (!users[0].passHash || users[0].passHash.includes('secret')) throw new Error('password not hashed!');
    const raw = await page.evaluate(() => JSON.stringify(localStorage));
    if (raw.includes('secret1')) throw new Error('plaintext password found in storage!');
  });

  await step('challenge → ace quiz → level up + heat up', async () => {
    await page.click('.bnav >> text=Today');
    await page.waitForSelector('.task-box', { timeout: 8000 });
    await page.waitForSelector('.heat-chip');
    await page.click('text=Done — Check Me ✓');
    for (let q = 0, cs = [0, 1, 2]; q < 3; q++) {
      await page.waitForSelector(`text=Mentor check-in · ${q + 1} of 3`, { timeout: 6000 });
      const opts = await page.$$('.quiz-opt');
      await opts[cs[q]].click();
      await page.waitForTimeout(950);
    }
    await page.waitForSelector('text=Level Up!', { timeout: 6000 });
    const prog = await getProg();
    if (prog.heat.money !== 3 || prog.levels.money !== 1) throw new Error(JSON.stringify({h: prog.heat.money, l: prog.levels.money}));
  });

  await step('bomb quiz → heat down + level held', async () => {
    await page.click('.btn-next');
    await page.waitForSelector('.task-box', { timeout: 8000 });
    await page.click('text=Done — Check Me ✓');
    for (let q = 0, ws = [1, 0, 0]; q < 3; q++) {
      await page.waitForSelector(`text=Mentor check-in · ${q + 1} of 3`, { timeout: 6000 });
      const opts = await page.$$('.quiz-opt');
      await opts[ws[q]].click();
      await page.waitForTimeout(950);
    }
    await page.waitForSelector('text=Locked In', { timeout: 6000 });
    const prog = await getProg();
    if (prog.heat.money !== 2 || prog.levels.money !== 1) throw new Error(JSON.stringify({h: prog.heat.money, l: prog.levels.money}));
  });

  await step('sign out → wrong password rejected → correct signs in with progress intact', async () => {
    await page.click('.bnav >> text=Home');
    await page.click('button[aria-label="Switch user"]');
    await page.waitForSelector('text=Who\'s forging today?', { timeout: 6000 });
    await page.click('.user-item >> text=Carley');
    await page.fill('.pw-wrap input', 'wrongpass');
    await page.click('text=Enter Forge →');
    await page.waitForSelector('text=Wrong password', { timeout: 6000 });
    await page.fill('.pw-wrap input', 'secret1');
    await page.click('text=Enter Forge →');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
    const prog = await getProg();
    if (prog.streak !== 1 || prog.history.length !== 2) throw new Error('progress lost after re-login');
  });

  await step('second account gets independent fresh progress', async () => {
    await page.click('button[aria-label="Switch user"]');
    await page.click('text=+ New account');
    await page.fill('input[aria-label="Your name"]', 'Jess');
    await page.fill('input[aria-label="New password"]', 'jesspass');
    await page.click('text=Create Account →');
    await page.waitForSelector('text=How old are you?');
    await page.click('text=Adult'); await page.click('text=Next →');
    await page.waitForSelector('text=What do you want to get good at?'); await page.click('text=📈 Credit & adulting'); await page.click('text=Next →');
    await page.waitForSelector('text=$100 lands in your hands'); await page.click('text=Most of it goes into savings');
    await page.waitForSelector('text=bike breaks'); await page.click('text=Find a video and follow along');
    await page.waitForSelector('text=genuinely hard'); await page.click('text=I find someone to figure it out with');
    await page.waitForSelector('text=What are you into?');
    await page.click('text=Build my mentor ⚡');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
    const prog = await getProg();
    if (prog.streak !== 0 || prog.history.length !== 0) throw new Error('new user inherited progress!');
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('forge_users')));
    if (users.length !== 2) throw new Error('user count=' + users.length);
  });

  await step('duplicate name blocked at signup', async () => {
    await page.click('button[aria-label="Switch user"]');
    await page.click('text=+ New account');
    await page.fill('input[aria-label="Your name"]', 'carley');
    await page.fill('input[aria-label="New password"]', 'whatever');
    await page.click('text=Create Account →');
    await page.waitForSelector('text=already has an account');
    await page.click('text=← Back to sign in');
  });

  await step('parent portal: password reset makes new password work', async () => {
    await page.click('.user-item >> text=Jess');
    await page.fill('.pw-wrap input', 'jesspass');
    await page.click('text=Enter Forge →');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
    await page.click('text=parent');
    await page.waitForSelector('text=Parent Access');
    for (const k of ['1','2','3','4']) await page.click(`.pin-key >> text="${k}"`);
    await page.waitForSelector('text=Admin · Test Mode');
    await page.click('.p-card:has-text("Security") >> .mini-chip >> text=Carley');
    await page.fill('input[aria-label="New password"]', 'newpass9');
    await page.click('.p-card:has-text("Security") >> .btn-send >> nth=2');
    await page.waitForTimeout(500);
    await page.click('text=exit');
    await page.click('button[aria-label="Switch user"]');
    await page.click('.user-item >> text=Carley');
    await page.fill('.pw-wrap input', 'newpass9');
    await page.click('text=Enter Forge →');
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
  });

  await step('session persists across reload', async () => {
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2200);
    await page.waitForSelector('text=Your mentor', { timeout: 8000 });
    const prog = await getProg();
    if (prog.history.length !== 2) throw new Error('history=' + prog.history.length);
  });

  const realErrors = errors.filter(e => !e.includes('font') && !e.includes('googleapis'));
  console.log('FAILED_STEPS=' + failed);
  console.log(realErrors.length ? 'ERRORS:\n' + realErrors.join('\n') : 'NO CONSOLE/PAGE ERRORS');
  await browser.close(); server.close();
})();
