# Forge — Master Prompt (single source of truth)

Paste the block below into any Claude session (desktop, cloud, mobile) working on Forge. It carries the full vision, the decisions already locked, and the guardrails — so every session builds the SAME product instead of drifting.

---

## THE PROMPT (copy from here)

You are working on **Forge**, a skill-building app owned by Nick Morgan. Read `CLAUDE.md` for his operating doctrine (agentic loop, no approval-nagging, $0 budget until revenue) and `docs/DESKTOP-TODO.md` for the current worklist. Follow this spec exactly; if you believe something here is wrong, say so and propose — don't silently build something different.

**Mission:** Teach kids and adults the real-life skills school skips — how money works, credit scores, budgeting, starting a business, and AI skills from first prompt to shipping a website. Built by someone who grew up with addict parents and learned credit the hard way; the app exists so nobody else has to. Never-ending learning, personal to each user.

**The mentor (core differentiator):**
- Built per-person from an indirect, psychology-style intake: scenario questions that never reveal what they measure (money instinct, builder archetype, grit). Setup is optional/skippable with sane defaults.
- Grows with the user: after each challenge, a 3-question check-in. 3/3 → raise difficulty ("heat" 1-3) and advance; 2/3 → advance; 0-1/3 → lower heat, hold the level, encouraging tone — never shame.
- Mentor state (psych read + heat + a rolling ~200-word memory summary per user) feeds every AI prompt. Never tell the user they were assessed.

**Curriculum:** 3 tracks × 6 levels, each level has a built-in challenge bank (3) and check-in quiz (3) so the app is 100% functional with AI off: Money & Credit / Business / AI Skills. Content lives in `index.html` (the tested reference implementation). AI, when connected, generates fresher personalized challenges; the bank is the fallback, quizzes stay curated.

**Accounts (do not drift on this):**
- Global scale = **email-based Supabase Auth**. The sign-in screen never lists users.
- Inside one family account = profile picker (name + password/PIN per profile, eye toggle on every password field), **capped at 6 profiles** — Netflix-profile pattern, so nothing grows unbounded.
- Parent role owns the account, sets/resets profile passwords, has a PIN-gated portal (progress view, admin/test mode, difficulty override). No plaintext passwords anywhere, ever. Kid profiles carry a first name only (COPPA).
- The current `index.html` implements this device-locally (hashed passwords, per-profile progress) as the working reference to port.

**Architecture (locked decisions):**
- Production app: Next.js on Vercel (project `forge-next`), Supabase (Auth + Postgres with RLS on every table), AI through a server-side proxy route — API key in env vars only, provider-agnostic (start Groq/Gemini free tier or Claude Haiku with caching + hard spend cap). Cost target ≈ $0 until revenue.
- Per-user AI memory = small rolling summary row + structured stats in Postgres. No vector DB, no pre-generated scenario dumps.
- `tests/` must pass (`FAILED_STEPS=0`, zero console errors) before any commit touching app code. Add tests for new behavior.

**Launch gates (in order):** restore Supabase project `ryhhxdobjjgkbtsrlqxf` → Supabase Auth + RLS (kills the security advisors) → port the reference app → disable Vercel Deployment Protection on production → Privacy Policy/ToS + COPPA posture + no-earnings-claims disclaimers (already written in the app — keep them) → WCAG AA → organic TikTok/Shorts marketing first, paid ads only after the funnel converts.

**UI bar:** top-notch, alive, not AI slop — dark neon identity (see `index.html`), aurora/depth/glow, micro-interactions (Framer Motion in forge-next), 60fps on cheap phones, respect reduced-motion.

## END PROMPT

---

## Known drift log (what changed vs. the original vision and why)

| Drift | Why | Status |
|---|---|---|
| Device-local accounts instead of cloud auth | Supabase blocked by connector approvals in the cloud session; local version is the tested reference | Temporary — port to Supabase Auth (P1) |
| Profile-picker sign-in listing names | Family-device pattern; wrong for global | Fixed: capped at 6, documented as family-profiles-only; global = email auth |
| Mentor "grows with them" currently = heat + psych only | Rolling memory summary needs the AI proxy + DB | Designed (plan §), build with forge-next port |
| One mentor persona ("Forge") not per-kid characters | Persona generation needs AI connected | Backlog (plan §5) |
