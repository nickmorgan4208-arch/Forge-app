// Redfin source. Uses the AUTHENTICATED browser context (context.request) so calls
// carry the logged-in cookies + your residential IP — that's what makes status
// (Active / Pending / Contingent / Coming Soon) visible instead of a 403.
//
// Strategy: Redfin's gis-csv endpoint returns a CSV of a search region including a
// STATUS column and MLS number. We pull that per zip (cheap, structured, honest about
// status), then do a lightweight detail-page pass only on the survivors to confirm a
// basement (not a CSV column).

const UA_HINT = "home-kit"; // context already carries a real UA from the logged-in profile

async function regionForZip(ctx, zip) {
  const res = await ctx.request.get(
    `https://www.redfin.com/stingray/do/location-autocomplete?location=${zip}&v=2`
  );
  const txt = await res.text();
  const json = JSON.parse(txt.replace(/^\{\}\&\&/, "")); // Redfin prefixes payloads with {}&&
  const row = json?.payload?.exactMatch || json?.payload?.sections?.[0]?.rows?.[0];
  if (!row) throw new Error(`no Redfin region for zip ${zip}`);
  // row.id looks like "2_12345" -> type_id
  const [type, id] = String(row.id).split("_");
  return { id, type };
}

function csvToRows(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = splitCsv(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitCsv(l);
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i]));
    return o;
  });
}
function splitCsv(line) {
  const out = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/^"|"$/g, "").trim());
}

const STATUS_MAP = (s = "") => {
  const t = s.toLowerCase();
  if (t.includes("pending")) return "pending";
  if (t.includes("contingent")) return "contingent";
  if (t.includes("coming")) return "coming_soon";
  if (t.includes("sold")) return "sold";
  if (t.includes("active")) return "active";
  return "unknown";
};

export async function fetchRedfin(ctx, cfg, log) {
  const c = cfg.criteria;
  const out = [];
  for (const zip of c.zips) {
    let region;
    try { region = await regionForZip(ctx, zip); }
    catch (e) { log(`  redfin: ${e.message}`); continue; }

    // filters: houses, min beds/baths, max price, include pending so we can SEE status
    const params = new URLSearchParams({
      al: "1",
      "market": "stlouis",
      "min_num_beds": String(c.minBeds),
      "num_baths": String(c.minBaths),
      "max_price": String(c.maxPrice),
      "region_id": region.id,
      "region_type": region.type,
      "status": "9",       // 9 = active + coming soon + pending/contingent (so status is visible)
      "uipt": "1",         // house
      "v": "8",
    });
    const url = `https://www.redfin.com/stingray/api/gis-csv?${params}`;
    const res = await ctx.request.get(url, { headers: { "x-kit": UA_HINT } });
    if (!res.ok()) { log(`  redfin ${zip}: HTTP ${res.status()} (login/session may have expired)`); continue; }
    const rows = csvToRows(await res.text());
    log(`  redfin ${zip}: ${rows.length} rows`);

    for (const r of rows) {
      const price = num(r["PRICE"]);
      if (!price || price > c.maxPrice) continue;
      out.push({
        mls_number: r["MLS#"] || r["MLS #"] || `${zip}-${r["ADDRESS"]}`,
        address: r["ADDRESS"],
        city: r["CITY"],
        zip: r["ZIP OR POSTAL CODE"] || zip,
        price,
        beds: num(r["BEDS"]),
        baths_full: Math.floor(num(r["BATHS"]) || 0),
        sqft: num(r["SQUARE FEET"]),
        lot_sqft: num(r["LOT SIZE"]),
        year_built: num(r["YEAR BUILT"]),
        status: STATUS_MAP(r["STATUS"] || r["SALE TYPE"]),
        days_on_market: num(r["DAYS ON MARKET"]),
        hoa_month: num(r["HOA/MONTH"]),
        url: r["URL"] && r["URL"].startsWith("http") ? r["URL"] : `https://www.redfin.com${r["URL"] || ""}`,
        source: "redfin",
        lat: num(r["LATITUDE"]),
        lng: num(r["LONGITUDE"]),
        basement: "unknown",
      });
    }
  }
  return dedupe(out);
}

// Basement isn't in the CSV — confirm it on the detail page for candidates that
// already pass beds/baths/price. Keeps the expensive pass small.
export async function confirmBasement(ctx, listing, log) {
  try {
    const page = await ctx.newPage();
    await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const body = (await page.content()).toLowerCase();
    await page.close();
    if (/walk-?out basement|walkout/.test(body)) return "walkout";
    if (/finished basement|finished lower level/.test(body)) return "finished";
    if (/unfinished basement/.test(body)) return "unfinished";
    if (/basement/.test(body)) return "finished?"; // present but finish unclear
    if (/\bslab\b|crawl space|no basement/.test(body)) return "none";
    return "unknown";
  } catch (e) {
    log(`  basement check failed for ${listing.address}: ${e.message}`);
    return "unknown";
  }
}

const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/[^0-9.]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
function dedupe(list) {
  const seen = new Map();
  for (const l of list) if (!seen.has(l.mls_number)) seen.set(l.mls_number, l);
  return [...seen.values()];
}
