// Coral Keys — the wanted system and the police.
//
// Stars rise when the player steals a car, shoots, or punches a guard,
// and fall when the player stays out of sight. Cruisers spawn on the
// roads near the player, chase, ram, and arrest: sit on the player long
// enough and it is "busted".

import * as THREE from 'three';
import { HEAT, WORLD } from './settings.js';
import { makeCarMesh } from './cars.js';

export function makeWanted() {
  return {
    stars: 0,
    hiddenTimer: 0,
    arrestTimer: 0,
    cruisers: [],
  };
}

function spawnCruiser(scene, near, roadLines, rng) {
  const mesh = makeCarMesh(0x111417, true);
  scene.add(mesh);
  // Spawn on a road a short drive from the player.
  const line = roadLines[Math.floor(rng() * roadLines.length)];
  const along = THREE.MathUtils.clamp(near.z + (rng() < 0.5 ? -60 : 60), -WORLD.half + 20, WORLD.half - 20);
  const pos = new THREE.Vector3(line, 0, along);
  return { mesh, pos, heading: 0, speed: 0, ramCooldown: 0 };
}

export function setStars(wanted, scene, n, roadLines, rng) {
  wanted.stars = THREE.MathUtils.clamp(n, 0, HEAT.maxStars);
  wanted.hiddenTimer = 0;
  wanted.arrestTimer = 0;
  const want = HEAT.cruisersFor(wanted.stars);
  while (wanted.cruisers.length < want) {
    wanted.cruisers.push(spawnCruiser(scene, { x: 0, z: 0 }, roadLines, rng));
  }
  while (wanted.cruisers.length > want) {
    const c = wanted.cruisers.pop();
    scene.remove(c.mesh);
  }
}

export function addStars(wanted, scene, n, roadLines, rng, playerPos) {
  if (wanted.stars >= HEAT.maxStars) return;
  setStars(wanted, scene, wanted.stars + n, roadLines, rng);
  // New cruisers appear near the player, not at the map edge.
  for (const c of wanted.cruisers) {
    const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
    if (d > 160) {
      const line = roadLines[Math.floor(rng() * roadLines.length)];
      c.pos.set(line, 0, THREE.MathUtils.clamp(playerPos.z + (rng() < 0.5 ? -55 : 55), -WORLD.half + 20, WORLD.half - 20));
    }
  }
}

// One frame of the chase. Returns 'busted' when the arrest completes,
// otherwise null. `target` is the player's position and speed.
export function updateCops(wanted, scene, dt, target, roadLines, rng) {
  const want = HEAT.cruisersFor(wanted.stars);
  while (wanted.cruisers.length < want) {
    wanted.cruisers.push(spawnCruiser(scene, target, roadLines, rng));
  }
  while (wanted.cruisers.length > want) {
    const c = wanted.cruisers.pop();
    scene.remove(c.mesh);
  }
  let nearest = Infinity;
  for (const c of wanted.cruisers) {
    const dx = target.x - c.pos.x;
    const dz = target.z - c.pos.z;
    const dist = Math.hypot(dx, dz);
    nearest = Math.min(nearest, dist);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - c.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.heading += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
    const chaseSpeed = Math.min(30, 14 + wanted.stars * 2.5 + (target.speed || 0) * 0.55);
    c.speed = THREE.MathUtils.clamp(chaseSpeed, 0, 34);
    c.pos.x += Math.sin(c.heading) * c.speed * dt;
    c.pos.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.heading;
    // Flash the light bar.
    if (c.mesh.userData.lightBar) {
      const on = Math.floor(performance.now() / 260) % 2 === 0;
      c.mesh.userData.lightBar.material.color.setHex(on ? 0xff2233 : 0x2233ff);
      c.mesh.userData.lightBar.material.emissive.setHex(on ? 0xaa1122 : 0x1122aa);
    }
    for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed * dt) / 0.36;
    // Arrest: a cruiser sitting on the player fills the arrest timer.
    if (dist < HEAT.arrestRange) {
      wanted.arrestTimer += dt;
      if (wanted.arrestTimer >= HEAT.arrestTime) return 'busted';
    }
  }
  // Stars fall when no cruiser can see the player for a while.
  if (wanted.stars > 0) {
    if (nearest > 70) {
      wanted.hiddenTimer += dt;
      wanted.arrestTimer = Math.max(0, wanted.arrestTimer - dt);
      if (wanted.hiddenTimer > HEAT.hideDelay + HEAT.hideStep) {
        wanted.hiddenTimer = HEAT.hideDelay;
        setStars(wanted, scene, wanted.stars - 1, roadLines, rng);
      }
    } else {
      wanted.hiddenTimer = 0;
      wanted.arrestTimer = Math.max(0, wanted.arrestTimer - dt * 0.5);
    }
  }
  return null;
}
