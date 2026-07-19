// home-kit main. Run on TITAN (has a real browser + your logins + residential IP).
//   node scrape.mjs --setup   -> opens Chrome once so you can log into Redfin/Realtor
//   node scrape.mjs           -> pull listings, diff vs last run, write to the store
//
// This is deliberately the SAME shape as apply-kit: a persistent logged-in Chrome
// profile driven by Playwright. Cloud sessions can't do this — that's the whole point.

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { fetchRedfin, confirmBasement } from "./lib/redfin.mjs";
import { makeStore } from "./lib/db.mjs";
import { payment, dealOdds } from "./lib/score.mjs";

const log = (...a) => console.log(...a);
const cfgPath = "./config.json";
if (!existsSync(cfgPath)) {
  console.error("Missing config.json — copy config.example.json to config.json and fill it in.");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const SETUP = process.argv.includes("--setup");

// rough drive-time: straight-line miles from the anchor, x1.3 road factor, /35mph -> minutes
function driveMinutes(lat, lng) {
  if (lat == null || lng == null) return null;
  const { lat: aLat, lng: aLng } = cfg.anchor;
  const dLat = (lat - aLat) * 69;
  const dLng = (lng - aLng) * 53; // ~cos(38.8°)*69
  const miles = Math.sqrt(dLat * dLat + dLng * dLng);
  return Math.round((miles * 1.3) / 35 * 60);
}

async function main() {
  const ctx = await chromium.launchPersistentContext(cfg.chromeProfileDir, {
    headless: !SETUP,
    viewport: { width: 1280, height: 900 },
  });

  if (SETUP) {
    const page = await ctx.newPage();
    await page.goto("https://www.redfin.com/");
    log("\n  A browser window is open. Log into Redfin (and Realtor.com if you use it),");
    log("  then come back here and press Enter to save the session.\n");
    await new Promise((r) => process.stdin.once("data", r));
    await ctx.close();
    log("  Session saved to", cfg.chromeProfileDir, "— you won't need to log in again.");
    return;
  }

  log(`home-kit run @ ${new Date().toISOString()}`);
  let listings = [];
  if (cfg.sources.includes("redfin")) listings = listings.concat(await fetchRedfin(ctx, cfg, log));

  // hard filters that the CSV already gives us
  const c = cfg.criteria;
  listings = listings.filter((l) =>
    (l.beds ?? 0) >= c.minBeds &&
    (l.baths_full ?? 0) >= c.minBaths &&
    (l.price ?? Infinity) <= c.maxPrice
  );

  // drive-time filter
  for (const l of listings) l.drive_minutes = driveMinutes(l.lat, l.lng);
  listings = listings.filter((l) => l.drive_minutes == null || l.drive_minutes <= c.maxDriveMinutes);

  // basement confirm (detail-page pass, only on survivors)
  if (c.basementRequired) {
    for (const l of listings) l.basement = await confirmBasement(ctx, l, log);
    listings = listings.filter((l) => l.basement !== "none"); // keep unknown; drop confirmed-none
  }

  // score
  for (const l of listings) {
    l._budget = cfg.budget;
    l.est_payment = payment(l.price, cfg.budget);
    l.deal_odds = dealOdds(l);
    delete l._budget;
  }

  await commit(listings);
  await ctx.close();
  log(`done — ${listings.length} matching homes this run`);
}

// diff against last run and record events, then upsert
async function commit(current) {
  const store = makeStore(cfg);
  const prior = await store.loadPrior();
  const events = [];
  const now = new Date().toISOString();
  const seen = new Set();

  for (const l of current) {
    seen.add(l.mls_number);
    const was = prior.get(l.mls_number);
    if (!was) {
      events.push(ev(l, "new", null, `$${l.price}`));
      l.first_seen = now;
    } else {
      l.first_seen = was.first_seen || now;
      l.price_history = mergeHistory(was.price_history, was.price, l.price, now);
      if (l.price < (was.price ?? l.price)) events.push(ev(l, "price_cut", `$${was.price}`, `$${l.price}`));
      if (l.price > (was.price ?? l.price)) events.push(ev(l, "price_up", `$${was.price}`, `$${l.price}`));
      if (was.status !== l.status) {
        const map = { pending: "pending", contingent: "contingent", sold: "sold", coming_soon: "coming_soon_live" };
        if (was.status === "pending" && l.status === "active") events.push(ev(l, "back_on_market", was.status, l.status));
        else if (map[l.status]) events.push(ev(l, map[l.status], was.status, l.status));
      }
    }
    l.last_seen = now;
    l.last_changed = events.some((e) => e.mls_number === l.mls_number) ? now : (was?.last_changed || now);
  }

  // things we had before, matching our filters, that vanished from the feed -> likely pending/sold/off-market
  for (const [mls, was] of prior) {
    if (seen.has(mls)) continue;
    if (was.status === "sold" || was.status === "off_feed") continue;
    events.push(ev(was, "off_feed", was.status, "gone (pending/sold/withdrawn — confirm)"));
    was.status = "off_feed";
    was.last_changed = now;
    current.push(was); // carry it forward so the record persists
  }

  await store.upsert(current);
  await store.recordEvents(events);
  log(`  store=${store.kind}  changes=${events.length}`);
}

const ev = (l, type, oldV, newV) => ({
  mls_number: l.mls_number, address: l.address, event_type: type,
  old_value: oldV, new_value: newV, detected_at: new Date().toISOString(), reported: false,
});
function mergeHistory(hist, oldPrice, newPrice, now) {
  const h = Array.isArray(hist) ? [...hist] : [];
  if (!h.length && oldPrice) h.push({ date: null, price: oldPrice });
  if (newPrice !== oldPrice) h.push({ date: now, price: newPrice });
  return h;
}

main().catch((e) => { console.error(e); process.exit(1); });
