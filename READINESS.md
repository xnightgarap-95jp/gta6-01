# Coral Keys — READINESS (recorded rebuild #3 for gta6-01)

Entry "Coral Keys": an original open-world crime 3D browser game, rebuilt
from scratch in this recorded session. The previous "Coral Keys" build was
read only as a design reference; every file below was written with the
write/edit tools in this session, revised in later separate messages, and
never copied from the reference — except `vendor/makefun-game.ts`, which
the kit requires byte-identical, and the three.js 0.170.0 minified build,
downloaded fresh from unpkg.

Why a third rebuild: rebuild #2 was submitted and then REJECTED with
status "failed" — 25 checks passed, 1 failed: "Recorded live"
(transcripts_witnessed). The README.md in the submitted snapshot differed
from the one the recording witnessed (4 lines), because the badge URLs
were fixed AFTER the recording was sealed. This rebuild writes the README
with the exact badge lines inside the recorded session, so the snapshot
and the recording agree and no file is edited afterwards.

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
- `README.md` with the exact three make.fun badge lines for
  gta6-01 / xnightgarap-95jp / gta6-01 (written in this session, never
  edited after the seal), `LICENSE` MIT (xnightgarap-95jp, 2026, SPDX line).

## Verification (all done in this session)

- **Determinism**: `main.ts` run twice (MAKEFUN_OUTPUT_DIR=out and out2),
  `diff -r` clean — byte-identical. dossier.json 823,308 bytes (< 1.5 MiB),
  sha256 7fcf9c1cb851e6ad8d5d0cc231dcbac637a38871c5da500e9168f4938405998f.
- **Screenshots**: 4 PNG, all 1280x720 — 1-start.png 180,648 bytes
  (palette-quantised from the 387,866-byte render, visually identical),
  2-drive.png 130,728, 3-chase.png 185,288, 4-mission.png 60,757 — all
  under the 256 KiB cap, all visually checked by the builder.
- **node --check**: clean on all 12 game modules.
- **CDP gameplay test** (`node /tmp/coral-cdp.mjs test`, headless Chromium,
  real synthetic input): menu -> playing on menu-button click; W walks the
  hero (1.26 m in 4 s real time under SwiftShader, direction correct);
  A turns the hero (-1.57 rad); E steals a traffic car (inCar true,
  wanted +1 star, 137 km/h at full throttle); pistol click fires
  (ammo 12 -> 11); setStars(2) spawns 2 cruisers; hero health 100;
  **zero console errors, zero failed requests** in every shot and test run.
- **Bugs found and fixed in-session**: HUD clock double-counted 08:00
  (showed 16:00); staged car stopped after a few seconds (now cruises and
  loops down the avenue); staged mission ended on the WASTED screen because
  the dock guards killed Dana (staged shots now use godMode); staged chase
  showed no cruiser (cruisers are now posed in-frame, one head-on, one
  beside the player); menu minimap stayed black on the cover (now drawn);
  hero input-rotation math, driving camera yaw, and objective element id
  corrected before the first screenshot.
- **Kit check**: `node cli/makefun.mjs check --kit . --repo <folder>` —
  **4 passed, 0 failed, 16 skipped, 5 checked at submission**
  (competition_open, snapshot 25 files / 1,393,990 bytes at commit
  04787e7966c1044ab90726120b850b394d174e6c, license_osi MIT, entrypoint
  main.ts). The 5 "at submission" items (repo_public, repo_owner,
  repo_created_after_open, commit_in_repo, duplicate_snapshot) are
  server-side and resolve when the repo is pushed to GitHub and submitted.
  Note: this kit copy is level 25, the site is at level 27 — the parent
  may want to re-download the kit before submitting.

## Known limits

- Frame rate under SwiftShader is slow (software rendering); on a real
  GPU desktop the game runs at normal speed.
- NOT done here (parent's steps): stop the recording and wait for the
  seal, write usage rows to `~/.makefun/muse-usage-gta6-01.jsonl`, update
  the GitHub repo `xnightgarap-95jp/gta6-01`, submit via the kit CLI with
  the zeef burner keypair. No GitHub repo was created, nothing was
  submitted, no wallet was linked by this session.
