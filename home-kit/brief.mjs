// Turns the store's unreported changes + current board into a short text brief.
// Prints to stdout (pipe it wherever: TITAN dashboard, an email, a push). No web page.

import { readFileSync, existsSync } from "node:fs";
import { makeStore } from "./lib/db.mjs";
import { envelope } from "./lib/score.mjs";

const cfg = JSON.parse(readFileSync("./config.json", "utf8"));
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");

const LABEL = {
  new: "🆕 NEW", price_cut: "🔻 PRICE CUT", price_up: "🔺 price up",
  pending: "⛔ PENDING", contingent: "⛔ CONTINGENT", sold: "❌ SOLD",
  back_on_market: "♻️ BACK ON MARKET", coming_soon_live: "🆕 COMING-SOON NOW LIVE",
  off_feed: "❓ DROPPED (likely pending/sold — confirm)",
};

async function main() {
  const store = makeStore(cfg);
  const events = await store.unreportedEvents();
  const board = await store.currentBoard();

  if (!events.length) {
    console.log(""); // nothing changed -> emit nothing, so the nightly job stays quiet
    return;
  }

  const lines = [];
  lines.push(`TONIGHT'S HOME SEARCH — ${new Date().toLocaleString("en-US")}`);
  lines.push(`Envelope: ${money(envelope(cfg.budget))} keeps you under ${money(cfg.budget.targetPayment)}/mo.\n`);

  lines.push(`WHAT CHANGED (${events.length}):`);
  for (const e of events.slice(0, 25)) {
    lines.push(`  ${LABEL[e.event_type] || e.event_type} — ${e.address}` +
      (e.new_value ? `  (${e.old_value ?? "?"} → ${e.new_value})` : ""));
  }

  const top = board
    .filter((l) => l.basement && l.basement !== "none")
    .sort((a, b) => rank(b) - rank(a) || a.price - b.price)
    .slice(0, 3);
  if (top.length) {
    lines.push(`\nCURRENT BEST (confirmed on the feed):`);
    for (const l of top) {
      lines.push(`  ${money(l.price)} · ${l.beds}bd/${l.baths_full}ba · ${l.sqft || "?"} sqft · ${l.basement} basement` +
        ` · ${l.days_on_market ?? "?"} DOM · ~${money(l.est_payment)}/mo · odds:${l.deal_odds}`);
      lines.push(`    ${l.address} — ${l.url}`);
    }
  }

  console.log(lines.join("\n"));
  await store.markReported(events.map((e) => e.id).filter((x) => x != null));
}

const rank = (l) => ({ strong: 3, fair: 2, slim: 1 }[l.deal_odds] || 0);

main().catch((e) => { console.error(e); process.exit(1); });
