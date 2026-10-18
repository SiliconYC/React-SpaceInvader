# ReactMono Art Upgrade Implementation Plan

> **For agentic workers:** This plan is executed inline under the repository's autonomous-development rule. Steps use checkbox syntax for tracking.

**Goal:** Deliver the first complete visual sample from the ReactMono redesign: a more legible player and Scout, clearer lighting and a composed first-contact battle scene, all inside the existing XY combat rules.

**Architecture:** Keep the pure game core and data contracts unchanged. Improve editable Three.js model geometry, presentation materials and scene composition in the existing render modules, then verify the actual full-screen page at desktop and mobile sizes. Preserve generated source and optimized runtime image assets together if a new background is introduced.

**Tech Stack:** React, TypeScript, Three.js, Vite, Playwright.

**Spec:** `docs/ART_REDESIGN_REACTMONO_2026-10-18.md`, with constraints from `docs/ART_DIRECTION_P3.md` and `docs/ARCHITECTURE.md`.

## Global Constraints

- Player and Scout logic pivots remain on the XY plane; model depth is presentation only.
- Three.js remains presentation only; no changes to hitboxes, firing origins, score, game clock or win/loss rules.
- Preserve full viewport canvas, readable projectiles, safe touch zones and same-origin `/React-SpaceInvader/` assets.
- New image assets must include the actual source image and optimized runtime file in Git.
- Keep human aesthetic review (#69) and real-device GPU verification (#70) explicitly separate from automated checks.

## Review Focus

- Desktop full-frame silhouettes at 1920×1080 and 1440×900 remain distinct without a close-up: browser screenshots.
- Portrait/landscape touch layouts keep the full battlefield and action controls unobstructed: existing Playwright mobile coverage.
- Player logical pivot, firing anchor and collision box remain unchanged: model and combat regression tests.
- Background imagery remains same-origin and low interference: build and browser asset-load assertions.
- Reset, pause and reduced-motion lifecycle do not gain new clocks or persistent effects: existing browser lifecycle coverage.

### Task 1: Baseline capture and first-contact model/lighting sample

**Files:**
- Modify: `src/render/ShipModels.ts`
- Modify: `src/render/P3Palette.ts`
- Test: `tests/models.test.ts`, `tests/p3-lighting.test.ts`, `tests/p4-player.browser.spec.ts`, `tests/p4-scout.browser.spec.ts`
- Evidence: `docs/art/evidence/reactmono-redesign/`

**Interfaces:** Preserve `createShipTemplates(resources)` and the existing instanced enemy asset structure. Do not change Three.js layer or engine interfaces.

- [x] Capture pre-change real WebGL baseline at desktop and mobile sizes.
- [x] Add failing model assertions for the updated visible structural parts while pinning player geometry bounds and asset reuse.
- [x] Refine the player body/wing relationship and Scout eye/recess silhouette using shared editable geometry and existing material ownership.
- [x] Keep studio lights unchanged; baseline showed unit highlights remain clear and the primary deficit was background composition.
- [x] Run targeted tests, then the complete logic suite and browser samples.
- [x] Commit the complete sample with before/after browser evidence and a Chinese audit note that leaves human approval pending.

### Task 2: First-contact background composition and responsive review

**Files:**
- Modify: `src/render/GalaxyBackdrop.ts`, `src/render/RingedPlanet.ts`, or `src/levels/visualThemes.ts` only as evidence requires.
- Add: `public/art/backgrounds/*` and source/optimization notes only if a new source-backed image materially improves the battle composition.
- Test: `tests/p4-composition.browser.spec.ts`, theme/asset tests as applicable.

- [x] Compare current first-contact composition at desktop wide/4:3 and mobile portrait/landscape.
- [x] Make the smallest scene adjustment that clarifies a focal hierarchy without adding visual noise or obscuring the battlefield.
- [x] Preserve the original generated PNG plus the optimized WebP and document reproducible conversion.
- [x] Verify same-origin load, desktop/mobile screenshots, no page errors and resource budgets.
- [x] Keep the scene and evidence in the same reviewable branch as Task 1.

### Task 3: Full acceptance and `dev` delivery

**Files:**
- Modify: relevant docs and generated evidence only.

- [x] Run `npm run verify` and required Playwright desktop/mobile/battle tests.
- [x] Review diff against XY, full-viewport and asset-tracking constraints.
- [ ] Push the short-lived branch, open PR targeting `dev`, wait for required CI and merge it.
- [ ] Confirm Pages deploy and inspect the live page; report actual screenshots/links and unverified real-device or human-aesthetic gates.
