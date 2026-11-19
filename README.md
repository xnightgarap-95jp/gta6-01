# Coral Keys

![make.fun](https://make.fun/badge/gta6-01.svg)
![make.fun rank](https://make.fun/badge/xnightgarap-95jp/gta6-01/rank.svg)
![make.fun reward](https://make.fun/badge/xnightgarap-95jp/gta6-01/reward.svg)

An original open-world crime game for [make.fun](https://make.fun/) — built for the
[gta6-01 bounty](https://make.fun/bounty/gta6-01): "Make GTA 6".

## What it is

Dana Cole is new in **Coral Keys**, a fictional 9×9-block beach city, and she owes
fixer Eddie Marlow a favour. Five missions, one city, no mercy:

1. **Borrowed Wheels** — steal a car, bring it to the garage.
2. **Courier Run** — a package for the casino, delivered fast.
3. **Hot Pursuit** — get the cops after you, then lose them.
4. **Dockside Exchange** — clear the guards at the docks, grab the case on the pier.
5. **The Big Take** — the beach meet, the ambush, the money, the drive home.

## Systems

- **On foot**: WASD + Shift to run, Space to jump, F to punch, mouse to aim, click to shoot, R to reload, 1/2 to swap fists and pistol.
- **Driving**: arcade handling, 3 camera modes (C), handbrake (Space), car theft (E), reset (T).
- **Traffic + pedestrians**: seeded cars cruise the road grid and turn at intersections; walkers stroll the sidewalks and scatter from danger.
- **Wanted system**: 1–5 stars for stealing, shooting and fighting; police cruisers chase, ram and arrest; hide to cool off.
- **Combat**: armed guards with health bars, pistol tracers, punch knockdowns.
- **HUD + minimap**: health, cash, stars, clock, objective + distance, speedometer, ammo, and a round minimap with police blips.
- **Sound**: fully synthesised WebAudio — engine hum, sirens, gunshots, a bassline.
- **Save**: progress saves to localStorage; continue from the menu.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: the game is static files under `game/` (three.js 0.170.0
vendored in `game/vendor/`). Screenshots are staged with `?shot=start|drive|chase|mission&seed=1`.

## Layout

- `main.ts` — the entry program (Node 22, stdlib only): copies `game/` + `screenshots/` to `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `game/index.html` — the page, HUD and menus.
- `game/src/` — one job per file: `settings`, `seed`, `sound`, `city`, `cars`, `people`, `hero`, `cops`, `fight`, `quests`, `interface`, `boot`.
- `screenshots/` — the four screenshots (menu, driving, police chase, mission combat).

## License

MIT — see `LICENSE`.
