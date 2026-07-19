# home-kit — local home-listing watcher (St. Peters area)

The real fix for the two problems the web-scraping approach never solved:
**being early** and **knowing true status (pending/contingent/coming-soon)**.

Anonymous cloud requests get 403'd and never see status. This runs where those
problems disappear — on your box (TITAN), through a **logged-in Chrome profile**
and your residential IP — exactly the same pattern `apply-kit` uses for jobs.

## How it works

```
TITAN (logged-in Chrome, your IP)
        │  Playwright
        ▼
   scrape.mjs ──▶ Redfin gis-csv (carries STATUS + MLS#)  ──▶ basement check on survivors
        │
        ▼  diff vs last run
   Supabase  (listings + listing_events)      ← real memory: new / price-cut / pending / back-on-market / sold
        │
        ▼
   brief.mjs ──▶ short "Tonight's home search" text  (only when something changed)
```

Because it diffs every run against the stored state, it catches a home going
**pending** (or dropping off the feed) the moment it happens — the exact thing
snippet-scraping is blind to.

## Setup (one time, on the box that has your logins)

1. `cd home-kit && npm install`
2. `cp config.example.json config.json` and fill in the FILL-IN values
   (Supabase URL + service key; the anchor lat/lng if you want to correct them).
   `config.json` is gitignored — secrets never get committed.
3. Tables are already created in the Supabase project (applied via migration).
   If you ever need to recreate them, run `schema.sql` in the Supabase SQL editor.
4. `npm run setup` → a Chrome window opens; log into Redfin (and Realtor if you
   use it), press Enter. The session is saved; you won't log in again.

If you skip Supabase, it falls back to a local `listings.json` and still diffs —
so you can try it before wiring the DB.

## Run

```
npm run scrape     # pull + diff + store
npm run brief      # print the change-only brief
npm run run        # both
```

### Hands-off / TITAN

One entrypoint does everything (scrape → brief → save):
```
node run.mjs
```
It writes the latest summary to `brief.latest.txt` (TITAN can read/surface that)
and appends every run to `brief.log`. Hand TITAN that one command on a 4-hour loop
and you never touch it again.

Schedule it natively instead if you prefer:
- **Windows** (Task Scheduler, every 4h):
  ```
  schtasks /create /tn "home-kit" /tr "%USERPROFILE%\Forge-app\home-kit\run.cmd" /sc hourly /mo 4 /f
  ```
- **macOS/Linux** (cron, every 4h):
  ```
  0 */4 * * *  cd /path/to/home-kit && /usr/bin/node run.mjs
  ```

## Notes / first-run tuning

- Redfin's CSV covers price/beds/baths/sqft/DOM/**status**/MLS#/lat-lng. Basement
  isn't a CSV field, so `confirmBasement()` opens each survivor's detail page and
  reads the description. Selectors/URL params are best-effort; confirm on the first
  run and adjust in `lib/redfin.mjs` if Redfin has shifted anything.
- `criteria`, `budget`, and `zips` all live in `config.json` — change the search
  without touching code.
- Adding Realtor.com or a broker IDX later = one more file in `lib/` returning the
  same listing shape; `scrape.mjs` will diff it the same way.
- This is local tooling (like `apply-kit`); it does **not** deploy anywhere and is
  intended to move to TITAN / the `brain` repo — it's staged here only so the code
  exists in git.
