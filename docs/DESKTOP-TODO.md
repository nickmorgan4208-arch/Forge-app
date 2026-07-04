# Desktop Handoff — "Go here, get to work"

Paste to Claude Code on desktop: **"Read docs/DESKTOP-TODO.md in the Forge-app repo and work the list top to bottom."**

Everything below was diagnosed in the cloud session on 2026-07-04. Companion docs in this folder:
- `FORGE-V2-PLAN.md` — full architecture, code snippets, SQL, launch checklist
- `TIKTOK-IDEAS-BACKLOG.md` — 120 categorized TikTok links + business-idea shortlist

---

## P0 — Unbreak production (do first, ~30 min)

1. **Restore the Supabase project** `ryhhxdobjjgkbtsrlqxf` (dashboard → project is paused). This is why **sign-ins fail for Carley** — the deployed app authenticates against a `users` table in a paused database. Restoring revives logins immediately.
2. **Fix the two critical security advisors** on that project (dashboard → Advisors → Security):
   - Enable RLS / drop public access on the exposed table(s)
   - The `users` table stores **plaintext passwords** publicly readable with the anon key — delete the password column or the whole table once Supabase Auth is in (SQL in FORGE-V2-PLAN.md §2)
3. **Set an Anthropic/AI spend cap** and check no API key is anywhere in frontend code or git history of forge-next. If a key was ever committed, rotate it.

## P1 — Forge-next core fixes

4. **Add the AI proxy route** (`app/api/mentor/route.ts`, code in FORGE-V2-PLAN.md §1), key in Vercel env vars. The old pattern (browser → api.anthropic.com, no key) is why the AI never worked.
5. **Replace hand-rolled login with Supabase Auth** + the RLS schema (plan §2). Parent creates account; kid profiles hang off it (COPPA-friendly: collect nothing beyond first name).
6. **Port Forge v2 from this repo's `index.html`** — it's the working reference implementation, tested 18/18 in a real browser:
   - 5-step optional mentor setup → profile → injected into every AI prompt
   - 3 tracks × 6 levels × 54 built-in challenges (Money & Credit / Business / AI Skills) — app fully works with AI off
   - Mentor chat tab, real streak logic, parent portal with changeable PIN
7. **Vercel Deployment Protection**: turn OFF for production (currently the public gets 403 — nobody can see the app), keep ON for previews.

## P2 — Launch readiness

8. Work the **security / legal / accessibility checklist** in FORGE-V2-PLAN.md §4: COPPA posture, Privacy Policy + ToS pages, no-earnings-claims language (v2 disclaimers already written — port them), WCAG AA pass (contrast/focus/reduced-motion done in v2; do headings, labels, Lighthouse ≥95 in forge-next).
9. **AI provider decision** (plan §4): start Groq or Gemini free tier ($0), or Claude Haiku with caching + $5 cap. Don't self-host Hermes/open models — GPU hosting kills the free budget. The proxy is provider-agnostic either way.
10. **UI: top-notch, alive, not AI slop.** v2 added aurora backdrop, depth/glow, tactile press states — port those, then go further in forge-next (real build step available): Framer Motion micro-interactions, spring physics on cards, animated progress rings, confetti on completion, optional React Three Fiber 3D flourish on the landing page. Keep 60fps on cheap phones; respect reduced-motion.

## P2.5 — Growth & content (Nick's asks, gated on P0-P2)

- **Don't run TikTok/YouTube ads yet.** Ads pointing at an app the public can't open (Vercel 403) burn money, and paid ads targeting kids carry strict COPPA/FTC rules (no behavioral targeting of under-13s). Order of operations: fix P0 → make production public → organic first (TikTok/Shorts showing the app + the mission story, which costs $0 and this niche loves) → ads only after the funnel converts.
- **Character video series (one per age tier):** give each age band a mentor character (8-11, 12-15, 16-18, Adult), script 30-60s lessons straight from the challenge bank (54 ready-made scripts already in `index.html`). Free pipeline: script with free-tier LLM → voice with free TTS tiers → visuals in Canva free / CapCut / Clipchamp → post as Shorts/TikTok. Monetization per character = channel monetization + funneling to Forge. Note: "made for kids" YouTube flags limit ad personalization — factor into revenue expectations.
- **Per-user AI memory (the right way, ~$0):** do NOT pre-generate "a billion scenarios" — generation-on-demand + caching beats pre-generation on cost, freshness, and storage. Per-user memory = one small `mentor_memory` row per user in Supabase: a rolling ~200-word summary the model updates after each chat/quiz ("struggles with percents, loves Minecraft, aced credit L4...") + the structured stats you already have (levels, heat, quiz history). That's pennies at thousands of users and needs no vector DB, no Obsidian on the serving path (keep Obsidian/Titan memory for YOUR knowledge base, not per-user serving). Upgrade path if revenue comes: embeddings + pgvector in the same Supabase.
- **Budget stance for all projects:** start at $0 (Vercel hobby + Supabase free + Groq/Gemini free tier), instrument usage, invest only after revenue. Set hard spend caps everywhere a card exists.

## P3 — Agentic project management (applies to ALL projects)

11. Add `CLAUDE.md` to every active repo (forge-next, Titan, …) modeled on this repo's: context + "prefer action, everything's in git."
12. Wire the loop: after every feature, run `/code-review` and the verify skill; before any launch, run `/security-review`. In cloud sessions, subscribe to PR activity so CI failures get auto-fixed.
13. Set up a recurring cloud Routine (weekly): check Supabase advisors, Vercel deploy state, and open PRs across projects; report by email.
14. **TikTok backlog triage** (15 min on the couch): open the Category 1 links in TIKTOK-IDEAS-BACKLOG.md on your phone, star the 5-10 with real skill repos/MCPs, then tell Code to install the starred ones.

## Done already (cloud session, on branch `claude/gmail-cleanup-projects-9eb4po`)

- Forge v2 prototype rebuilt (this repo's `index.html`) — mentor setup, 3 tracks, offline-first, a11y pass, legal disclaimers, living UI; browser-tested 18/18, zero console errors
- Full diagnosis of v1 (dead AI calls, plaintext passwords = the Supabase security alerts, no persistence)
- TikTok email backlog compiled + categorized (120 links)
- forge-next status: production build READY but 403 to public; old forge-app Vercel project errored/superseded — delete it
