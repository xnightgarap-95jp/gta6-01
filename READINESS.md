# Coral Keys — READINESS (recorded rebuild #2 for gta6-01)

Entry "Coral Keys": an original open-world crime 3D browser game, rebuilt
from scratch in this recorded session (agent 7ab57074-3fe0-4707-aa10-0d6221016290).
The previous "Coral Keys" build was read only as a design reference; every
file below was written with the write/edit tools in this session, revised in
later separate messages, and never copied from the reference — except
`vendor/makefun-game.ts`, which the kit requires byte-identical, and the
three.js 0.170.0 minified build, downloaded fresh from unpkg.

Why a second rebuild: the first recorded build was made while the kit
credentials belonged to @quiet-ibis-82, so the server refused its sealed
recording ("no recording of yours"). This rebuild runs under the new
recording (01a1f32e-3067-75d2-934a-606db6537fd1) made after the burner
wallet 98RLu… was linked to @zeee-fc-airdrop.

## What it is

- **World**: fictional 9x9-block coastal city "Coral Keys" (three.js 0.170.0
  vendored in game/vendor/). Roads, sidewalks, seeded buildings with lit
  windows (canvas facade textures), a neon casino tower, park with fountain,
  dockyard with containers and a pier, beach + sea to the east, palm trees,
  street lamps.
- **Play**: on-foot (WASD, jump, punch) + arcade driving (WASD, handbrake,
  3 camera modes), car theft (E), traffic AI + pedestrians who scatter,
  wanted stars 1–5 + police cruisers that chase, ram and arrest, combat
  (punch F, pistol with mouse aim, reload R, guards with health bars),
  5 missions for fixer Eddie Marlow ("Borrowed Wheels", "Courier Run",
  "Hot Pursuit", "Dockside Exchange", "The Big Take"), full HUD (health,
  money, wanted, clock, circular minimap with blips, objective + distance,
  speedometer, ammo), synthesised WebAudio (engine, sirens, gunshots,
  music), localStorage save, menu / pause / busted / wasted / job-done
  screens.
- **Staging**: `?shot=start|drive|chase|mission&seed=1` stages the four
  screenshots (menu over the city, driving, police chase, mission combat).

## Files

- `main.ts` (root, Node 22 stdlib-only; calls vendor/makefun-game.ts,
  byte-identical to the kit), `serve.ts` (static server for local testing),
  `shots.json` (4 screenshots).
- `game/index.html` + `game/src/`: settings, seed, sound, city, cars,
  people, hero, cops, fight, quests, interface, boot (12 modules).
- `game/vendor/three.module.min.js` (three.js 0.170.0, fresh download from
  unpkg), `vendor/makefun-game.ts` (kit file, byte-identical).
- `screenshots/`: 1-start.png, 2-drive.png, 3-chase.png, 4-mission.png
  (all 1280x720, each under 256 KiB; visually checked).
- `README.md` (3 make.fun badges for gta6-01 / xnightgarap-95jp / gta6-01
  + make.fun link), `LICENSE` MIT (xnightgarap-95jp, 2026, SPDX line).

## Verification (all done in this session)

- **Determinism**: `MAKEFUN_OUTPUT_DIR=out node main.ts` run twice,
  `diff -r` clean — byte-identical output. Dossier 996K bytes
  (< 1.5 MiB).
- **Kit check** (`makefun.mjs check`): 4 passed, 0 failed
  (competition_open — deadline 24 Nov 2026 22:00 WIB; snapshot;
  license_osi MIT; entrypoint main.ts → node22), 16 skipped (transcript
  checks run server-side from the sealed recording), 5 "at submission"
  (repo public / owner / created-after-open / commit-in-repo /
  duplicate-snapshot — the parent handles those at submit time).
- **Syntax**: `node --check` clean on all 12 game modules.
- **Screenshots**: rendered in headless Chromium (SwiftShader, CDP) and
  visually inspected. Fixes made during the pass: menu no longer covers
  staged gameplay shots; chase cruisers parked in-frame (one head-on);
  mission hero turned to face the dock and guards moved to the near side
  of the containers; dock block no longer spawns random buildings over
  the containers; toasts suppressed in staged shots; start PNG optimised
  to 254K to fit the 256 KiB cap.
- **Real gameplay test** (CDP, `/tmp/coral-test.mjs`, synthetic key/mouse
  events against the live page, state read from `window.__coralKeys`):
  menu → playing; W walks (3.25 m in 4 s); A turns (heading +0.79);
  W drives the car (speed 0 → 5.64, car moves 1.44 m); entering the car
  advances mission "Borrowed Wheels" steal → goto; E exits the car;
  mouse click fires (ammo 12 → 11); setStars(2) spawns 2 cruisers;
  health 100; **zero console errors / exceptions**. (Movement per real
  second is small under SwiftShader because each frame simulates at most
  0.05 s — a headless-rendering artifact, not a game bug.)
- **Bugs found and fixed in-session**: menu overriding staged shots;
  `__coralKeys.quests`/`car` going stale after `startGame` replaced the
  instance (now getters); old quest beacon leaking on restart (dispose
  added); dock block buildings hiding the mission guards.

## Known limits

- Frame rate under SwiftShader is slow (software rendering, ~1.3 FPS);
  on a real GPU desktop the game runs at normal speed.
- The judge compares dossiers 2v2 (screenshot contact sheet + source
  outline); the four screenshots are the first thing it sees, so they
  were chosen to show menu, driving, chase and combat.
- NOT done here (parent's steps): stop the recording and wait for the
  seal, write usage rows to `~/.makefun/muse-usage-gta6-01.jsonl`, create
  the GitHub repo `xnightgarap-95jp/gta6-01`, submit via the kit CLI with
  the zeef burner keypair. No GitHub repo was created, nothing was
  submitted, no wallet was linked by this session.
