# Forge v2 — Enhancement Plan

Goal (Nick's words): basically free to host, intuitive enough to teach kids AND adults real-life skills — money, credit, starting a business, and AI from ground-level prompts to code to images to websites — with an AI mentor tailored to each person (optional to set up, but actually working).

## What was wrong (diagnosis of the v1 "sloppy AI build")

1. **The AI never worked at all.** The app called `api.anthropic.com` directly from the browser with **no API key**. Every request failed, so users always got the single hardcoded fallback challenge. This is why "the AI isn't good" — it was never running. Browser calls also can't ever be the fix: putting a real key in frontend code means anyone can steal it.
2. **The Supabase security alerts came from the login design.** v1 stored **plaintext passwords** in a `users` table readable/writable by anyone with the public URL (RLS disabled). That is exactly the two critical advisors Supabase emailed about (`rls_disabled_in_public`, `sensitive_columns_exposed`).
3. **No mentor personalization.** One hardcoded persona ("Carley, 10, coding") baked into prompt strings. No setup flow existed at all.
4. **Curriculum gap.** Only AI/coding. None of the mission-critical life content: money, credit score, budgeting, business.
5. **Progress didn't persist.** Streak/history lived in React state and reset on every reload.

## What v2 (this repo's `index.html`) now does

- **Mentor setup** — 5-step optional onboarding (name, age band, goals, interests, coaching style) → stored profile → injected into every AI system prompt. Skippable, with sane defaults, exactly as intended.
- **Three tracks × 6 levels × 3-challenge banks (54 built-in challenges):**
  - 💵 **Money & Credit** — how money works → banking → budgeting → **credit score** → debt → compound growth
  - 🚀 **Business** — spot problems → first idea → validate → first sale → price & profit → grow
  - 🧠 **AI Skills** — what is AI → prompting → images → code with AI → build a website → ship something real
- **Works 100% free with zero backend**: challenges rotate daily from the built-in bank; progress, streaks, and profile persist in localStorage. AI is an *enhancement*, not a dependency.
- **Correct AI architecture**: all AI calls go through `AI_ENDPOINT` (a serverless proxy you own). No keys in the browser. Graceful fallback text everywhere when it's not configured.
- **Mentor chat tab** for the learner + parent AI assistant, both driven by the stored mentor profile.
- **Real streak logic** (consecutive-day based, can't be farmed by completing twice a day), parent PIN changeable in the portal (no more hardcoded `1234`-forever).
- **Supabase removed from the client.** No more public plaintext-password table.

## Port plan for forge-next (desktop session)

### 1. AI proxy (the single highest-impact fix) — `app/api/mentor/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { system, messages, max_tokens = 600, model = "claude-haiku-4-5-20251001" } = await req.json();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,   // set in Vercel env vars
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, system, messages, max_tokens }),
  });
  return NextResponse.json(await r.json(), { status: r.status });
}
```

Then in the client set `AI_ENDPOINT = "/api/mentor"`. Add basic rate limiting (e.g. 30 req/day per user) before sharing publicly so a stranger can't run up your bill.

**Cost control for "basically free":** use Haiku for challenges/chat (~$1/M input tokens); cache each day's generated challenge per (user, track, level) in the DB so it's generated once per day, not per page load. Realistic cost for a family: pennies per month.

### 2. Supabase, done right (fixes the security advisors)

- **Auth:** use Supabase Auth (email or username+password handled by Supabase) — never a hand-rolled `users` table with a `password` column.
- **Schema:**

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text, age_band text, goals text[], interests text, style text,
  parent_pin text, created_at timestamptz default now()
);
create table completions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  track text, skill text, title text, completed_on date default current_date
);

alter table profiles enable row level security;
alter table completions enable row level security;

create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "own completions" on completions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- **Immediate cleanup on the existing project** (`ryhhxdobjjgkbtsrlqxf`): restore it in the dashboard, then either drop the old `users` table or at minimum `alter table users enable row level security;` and delete the plaintext password column. That clears both critical advisors.

### 3. UI/UX polish list for forge-next

- Port the v2 information architecture: Home / Today / Mentor / Tracks / Progress.
- Onboarding = the mentor setup flow (skippable, defaults, <60 seconds).
- Landing page that explains the mission (teach the stuff school skips) — this is also your marketing page.
- Turn OFF Vercel Deployment Protection for production if the app is meant to be public (it currently 403s for everyone but you).
- PWA manifest + icons so kids can "install" it from the browser — free, no App Store.

### 4. Later / bigger ideas (from the TikTok backlog themes)

- Mentor "personas" (generated once at setup: name, avatar, backstory matched to the kid's interests).
- Weekly parent email digest (Supabase cron + Resend free tier).
- Real-world verification: photo proof of completed tasks, parent approve button.
- Adult mode: same tracks, deeper content (credit repair, LLC basics, first invoice).
- Community challenge packs — shareable JSON, no backend needed.
