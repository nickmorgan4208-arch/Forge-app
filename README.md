# Forge Scan

A 3D scanning app for **orthotics & prosthetics** (and general objects), built for ease of use, subscription pricing, and **free, unlimited STL/OBJ export** — no tokens, no per-export fees.

Positioned against EM3D, HiTek3D, Comb, and similar apps that are expensive, token-metered, or lock exports behind extra purchases.

## What's in this repo

`index.html` is a self-contained web app (no build step) that runs on Android and iOS in the browser over HTTPS, and can be added to the home screen. It implements the full product flow:

1. **Liability waiver** — mandatory, signed by typed name, versioned, stored on device. Covers not-a-medical-device status, practitioner verification, accuracy, consent/privacy (HIPAA/GDPR responsibility), and subscription terms.
2. **Device check** — HTTPS, camera API, rear camera, WebGL, motion sensors.
3. **Subscription paywall** — Pro Monthly ($14.99) / Pro Annual ($119) with 7-day free trial. Checkout is simulated locally in this build (see roadmap).
4. **Guided capture** — rear camera (`facingMode: environment`), a 36-segment orbit ring driven by device orientation that fills in as angles are covered, auto-capture per angle, manual shutter fallback, torch toggle, haptic tick.
5. **O&P presets** — foot/insole, ankle/AFO, transtibial, transradial, spinal/TLSO, free object.
6. **Reconstruction** — demo build generates a preview mesh on-device (see "Real reconstruction" below); captured frames are the input a production backend consumes.
7. **3D viewer** — Three.js, drag-rotate, pinch/wheel zoom, dimensions (L×W×H mm).
8. **Export** — binary **STL** and **OBJ** writers, free and unlimited on every plan.
9. **Scan library** — IndexedDB, patient labels (guidance to avoid full PHI), reopen/re-export/delete.

## Running it

Serve over HTTPS (camera requires a secure context). Easiest: enable **GitHub Pages** on this repo — the app is a single `index.html`. Locally: `npx serve` + a tunnel, or `localhost` (also a secure context).

## Roadmap to production

| Area | Demo build | Production plan |
|---|---|---|
| Reconstruction | Parametric preview mesh | Photogrammetry backend (Meshroom/OpenMVG/RealityCapture API) consuming the captured frame set, or native depth capture (ARKit Object Capture / ARCore Depth) via Capacitor plugin |
| Billing | Local simulated trial | RevenueCat (App Store + Play Store subscriptions) or Stripe for the web build |
| Distribution | Web / PWA | Wrap with **Capacitor** for App Store & Play Store; same codebase |
| Accounts | Device-local | Supabase auth + scan sync |

## Compliance notes

- The app is deliberately positioned as **not a medical device**; the waiver requires practitioner verification of all output before fabrication.
- Scan labels prompt for initials/IDs rather than full patient identifiers; nothing leaves the device in this build.
