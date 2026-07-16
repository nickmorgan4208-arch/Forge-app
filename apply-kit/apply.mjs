#!/usr/bin/env node
/**
 * apply-kit — local job-application copilot.
 *
 * Runs on YOUR machine, driving a real Chrome window with YOUR logins.
 * Fills the application form from profile.json, then STOPS so you can
 * review and click Submit yourself. Pass --submit to let it click the
 * final button on known ATS pages (Greenhouse / Lever).
 *
 * Usage:
 *   node apply.mjs --setup            one-time: opens Chrome so you log in
 *                                     to Indeed / LinkedIn / etc.
 *   node apply.mjs <job-url>          fill the form, pause before submit
 *   node apply.mjs <job-url> --submit fill and submit (known ATS only)
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA = path.join(HERE, 'user-data');
const APPS_DIR = path.join(HERE, 'applications');
const LOG_CSV = path.join(APPS_DIR, 'log.csv');

function loadProfile() {
  const p = path.join(HERE, 'profile.json');
  if (!fs.existsSync(p)) {
    console.error('profile.json not found. Copy profile.example.json to profile.json and fill it in.');
    process.exit(1);
  }
  const profile = JSON.parse(fs.readFileSync(p, 'utf8'));
  const missing = JSON.stringify(profile).match(/FILL-IN[^"]*/g);
  if (missing) {
    console.warn(`WARNING: profile.json still has placeholders: ${missing.join(', ')}`);
  }
  return profile;
}

async function launch() {
  const opts = { headless: false, viewport: null, args: ['--disable-blink-features=AutomationControlled'] };
  try {
    return await chromium.launchPersistentContext(USER_DATA, { ...opts, channel: 'chrome' });
  } catch {
    console.warn('Installed Chrome not found, falling back to bundled Chromium.');
    return await chromium.launchPersistentContext(USER_DATA, opts);
  }
}

async function fillIfPresent(page, selector, value) {
  if (!value) return false;
  const el = page.locator(selector).first();
  try {
    if (await el.isVisible({ timeout: 500 }) && !(await el.inputValue().catch(() => 'x'))) {
      await el.fill(String(value));
      return true;
    }
  } catch { /* field not on this page */ }
  return false;
}

async function attachResume(page, profile) {
  const resume = path.resolve(HERE, profile.resume_path || './resume.pdf');
  if (!fs.existsSync(resume)) {
    console.warn(`Resume not found at ${resume} - skipping upload.`);
    return;
  }
  const inputs = page.locator('input[type="file"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    try {
      await inputs.nth(i).setInputFiles(resume, { timeout: 2000 });
      console.log('Attached resume.');
      return;
    } catch { /* try next file input */ }
  }
}

async function fillGreenhouse(page, p) {
  await fillIfPresent(page, '#first_name', p.first_name);
  await fillIfPresent(page, '#last_name', p.last_name);
  await fillIfPresent(page, '#email', p.email);
  await fillIfPresent(page, '#phone', p.phone);
  await fillIfPresent(page, 'input[name="job_application[location]"]', `${p.city}, ${p.state}`);
  await attachResume(page, p);
}

async function fillLever(page, p) {
  await fillIfPresent(page, 'input[name="name"]', `${p.first_name} ${p.last_name}`);
  await fillIfPresent(page, 'input[name="email"]', p.email);
  await fillIfPresent(page, 'input[name="phone"]', p.phone);
  await fillIfPresent(page, 'input[name="urls[LinkedIn]"]', p.linkedin);
  await attachResume(page, p);
}

/** Map a field's label/placeholder/aria text to a profile value. */
function valueForLabel(text, p) {
  const t = text.toLowerCase();
  const rules = [
    [/first\s*name/, p.first_name],
    [/last\s*name|surname|family\s*name/, p.last_name],
    [/full\s*name|^name$|your\s*name/, `${p.first_name} ${p.last_name}`],
    [/e-?mail/, p.email],
    [/phone|mobile/, p.phone],
    [/street|address\s*line|^address/, p.address],
    [/city|town/, p.city],
    [/state|province/, p.state],
    [/zip|postal/, p.zip],
    [/country/, p.country],
    [/linkedin/, p.linkedin],
    [/website|portfolio/, p.website],
    [/salary|compensation|pay\s*(rate|expectation)/, p.answers?.desired_salary],
    [/how\s*did\s*you\s*hear/, p.answers?.how_did_you_hear],
    [/notice\s*period/, p.answers?.notice_period],
    [/start\s*date|available/, p.answers?.start_date],
  ];
  for (const [re, val] of rules) if (re.test(t) && val && !String(val).startsWith('FILL-IN')) return val;
  return null;
}

async function fillGeneric(page, p) {
  const fields = page.locator('input:visible, textarea:visible');
  const n = await fields.count();
  let filled = 0;
  const unfilled = [];
  for (let i = 0; i < n; i++) {
    const el = fields.nth(i);
    try {
      const type = (await el.getAttribute('type')) || 'text';
      if (['hidden', 'submit', 'button', 'file', 'checkbox', 'radio', 'password'].includes(type)) continue;
      if (await el.inputValue()) continue;
      const label = await el.evaluate((node) => {
        const bits = [node.getAttribute('aria-label'), node.getAttribute('placeholder'), node.name, node.id];
        if (node.id) bits.push(document.querySelector(`label[for="${node.id}"]`)?.textContent);
        bits.push(node.closest('label')?.textContent);
        return bits.filter(Boolean).join(' ');
      });
      const value = valueForLabel(label || '', p);
      if (value) { await el.fill(String(value)); filled++; }
      else if (await el.evaluate((node) => node.required)) unfilled.push(label?.trim().slice(0, 80) || `(field ${i})`);
    } catch { /* detached or covered element - skip */ }
  }
  await attachResume(page, p);
  console.log(`Filled ${filled} fields.`);
  if (unfilled.length) {
    console.log('Required fields I could not map (answer these in the browser, or teach the skill):');
    for (const u of unfilled) console.log(`  - ${u}`);
  }
}

function logApplication(url, status) {
  fs.mkdirSync(APPS_DIR, { recursive: true });
  if (!fs.existsSync(LOG_CSV)) fs.writeFileSync(LOG_CSV, 'timestamp,url,status\n');
  fs.appendFileSync(LOG_CSV, `${new Date().toISOString()},"${url}",${status}\n`);
}

function waitForEnter(promptText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(promptText, () => { rl.close(); resolve(); }));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--setup')) {
    const ctx = await launch();
    const page = await ctx.newPage();
    await page.goto('https://secure.indeed.com/account/login');
    console.log('Log into Indeed (and LinkedIn or anything else you use) in this window.');
    console.log('Your sessions persist in apply-kit/user-data for future runs.');
    await waitForEnter('Press Enter here when you are done logging in... ');
    await ctx.close();
    return;
  }

  const url = args.find((a) => !a.startsWith('--'));
  if (!url) {
    console.error('Usage: node apply.mjs <job-url> [--submit]   (or --setup for first-time login)');
    process.exit(1);
  }
  const autoSubmit = args.includes('--submit');
  const profile = loadProfile();

  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const host = new URL(page.url()).hostname;
  console.log(`Landed on ${host}`);

  if (host.includes('greenhouse.io')) await fillGreenhouse(page, profile);
  else if (host.includes('lever.co')) await fillLever(page, profile);
  else await fillGeneric(page, profile);

  fs.mkdirSync(APPS_DIR, { recursive: true });
  const shot = path.join(APPS_DIR, `${Date.now()}-${host}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`Screenshot: ${shot}`);

  if (autoSubmit && (host.includes('greenhouse.io') || host.includes('lever.co'))) {
    const btn = page.locator('button:has-text("Submit application"), input[type="submit"][value*="Submit" i], #submit_app').first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: shot.replace('.png', '-submitted.png'), fullPage: true });
      logApplication(url, 'submitted');
      console.log('Submitted.');
      await ctx.close();
      return;
    }
    console.log('Could not find a submit button - leaving it to you.');
  }

  console.log('\nForm is filled as far as I could take it. Review the browser window,');
  console.log('finish any custom questions, and click Submit yourself.');
  await waitForEnter('Press Enter here after you submit (or close) to log the result... ');
  logApplication(url, autoSubmit ? 'submit-attempted' : 'reviewed-by-human');
  await ctx.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
