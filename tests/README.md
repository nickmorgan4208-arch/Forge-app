# Forge smoke tests

End-to-end browser test of the whole app: psych onboarding → adaptive heat →
challenge → mentor check-in quiz (ace = level up + heat up, bomb = heat down +
level held) → admin test mode → PIN change/recovery → persistence.

Run:

```bash
npm install playwright-core react@18.2.0 react-dom@18.2.0 @babel/standalone@7.23.2
CHROMIUM_PATH=/path/to/chrome node tests/smoke.js
```

The test serves `index.html` locally and swaps the CDN script tags for the
npm-installed copies (sandboxes often block CDNs; the real internet doesn't).
Expected output ends with `FAILED_STEPS=0` and `NO CONSOLE/PAGE ERRORS`.

Agents: run this after every change to index.html.
