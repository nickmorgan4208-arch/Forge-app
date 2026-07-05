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
  await new Promise(r => server.listen(8937, r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8937', { waitUntil: 'load' });
  // Seed a v3-era single profile (like Carley's device today) with progress and custom PIN
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('forge_profile', JSON.stringify({name:'Carley',ageBand:'8-11',goals:['money'],interests:'Minecraft',style:'hype',psych:{archetype:'natural hustler'},mentorName:'Forge',parentPin:'7777',recoveryWord:'buster',created:'2026-07-01'}));
    localStorage.setItem('forge_progress', JSON.stringify({levels:{money:2},heat:{money:2},streak:4,lastDay:'2026-07-03',history:[{track:'Money & Credit',skill:'Banking Basics',title:'Fees Eat Money',date:'2026-07-03'}]}));
  });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
  const ok = await page.isVisible('text=Your mentor');
  const state = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('forge_users')),
    parent: JSON.parse(localStorage.getItem('forge_parent')),
    session: JSON.parse(localStorage.getItem('forge_session')),
  }));
  const prog = await page.evaluate(() => {
    const sid = JSON.parse(localStorage.getItem('forge_session'));
    return JSON.parse(localStorage.getItem('forge_prog_' + sid));
  });
  console.log('auto signed in:', ok);
  console.log('user:', state.users[0].name, '| pass empty (tap-to-enter):', state.users[0].passHash === '');
  console.log('PIN carried:', state.parent.pin === '7777', '| recovery carried:', state.parent.recoveryWord === 'buster');
  console.log('progress carried: streak', prog.streak, 'level', prog.levels.money, 'history', prog.history.length);
  console.log(errs.length ? 'ERRORS: ' + errs.join('; ') : 'NO ERRORS');
  await browser.close(); server.close();
})();
