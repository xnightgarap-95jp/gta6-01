// Coral Keys — combat.
//
// Fists (F) and the pistol (click to fire, R to reload). Guards are
// simple box figures with a health bar; they shoot back when the player
// is in range and in front of them. Shooting is a raycast from the
// camera through the crosshair, so what you aim at is what you hit.

import * as THREE from 'three';
import { FIGHT } from './settings.js';
import { playGunshot, playPunch } from './sound.js';

function makeGuardMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.95, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2b3a2e }),
  );
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xc99878 }),
  );
  head.position.y = 1.72;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.16, 0.46),
    new THREE.MeshLambertMaterial({ color: 0x1c241d }),
  );
  cap.position.y = 1.96;
  group.add(cap);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x22262b });
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), legMat);
    leg.position.set(x, 0.31, 0);
    group.add(leg);
  }
  // Health bar: a thin green plane that shrinks as the guard is hit.
  const barBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  );
  barBg.position.y = 2.25;
  group.add(barBg);
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x3ddc5a }),
  );
  bar.position.set(0, 2.25, 0.01);
  group.add(bar);
  group.userData.bar = bar;
  group.userData.barBg = barBg;
  return group;
}

export function makeGuard(scene, x, z, heading = 0) {
  const mesh = makeGuardMesh();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    health: FIGHT.guardHealth,
    shootTimer: 1 + Math.random(),
    alive: true,
  };
}

export function removeGuard(scene, guard) {
  scene.remove(guard.mesh);
  guard.alive = false;
}

// Guards stand their ground, face the player, and shoot on a timer
// when the player is close enough. Returns the damage dealt this frame.
export function updateGuards(guards, dt, playerPos, onShot) {
  let damage = 0;
  for (const g of guards) {
    if (!g.alive) continue;
    const dx = playerPos.x - g.pos.x;
    const dz = playerPos.z - g.pos.z;
    const dist = Math.hypot(dx, dz);
    g.heading = Math.atan2(dx, dz);
    g.mesh.rotation.y = g.heading;
    g.mesh.userData.bar.lookAt(playerPos.x, 2.25, playerPos.z);
    g.mesh.userData.barBg.lookAt(playerPos.x, 2.25, playerPos.z);
    if (dist < FIGHT.guardShootRange) {
      g.shootTimer -= dt;
      if (g.shootTimer <= 0) {
        g.shootTimer = FIGHT.guardShootDelay;
        // Guards are bad shots at range: hit chance falls with distance.
        const hitChance = THREE.MathUtils.clamp(1.15 - dist / FIGHT.guardShootRange, 0.15, 0.85);
        if (Math.random() < hitChance) damage += 9;
        if (onShot) onShot(g);
      }
    }
  }
  return damage;
}

export function damageGuard(guard, amount) {
  guard.health -= amount;
  const frac = Math.max(0, guard.health / FIGHT.guardHealth);
  guard.mesh.userData.bar.scale.x = frac;
  guard.mesh.userData.bar.position.x = -(1 - frac) * 0.53;
  if (guard.health <= 0) {
    guard.alive = false;
    return true;
  }
  return false;
}

// Fire the pistol from the camera through the crosshair. Returns the
// guard hit, if any.
export function shootPistol(camera, guards, range = FIGHT.pistolRange) {
  playGunshot();
  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  ray.far = range;
  const meshes = guards.filter((g) => g.alive).map((g) => g.mesh);
  const hits = ray.intersectObjects(meshes, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj.parent && obj.parent !== null) {
    const found = guards.find((g) => g.mesh === obj);
    if (found) return found;
    obj = obj.parent;
  }
  return guards.find((g) => g.mesh === obj) || null;
}

// Punch: the nearest living guard inside range and roughly in front.
export function punch(heroPos, heroHeading, guards) {
  playPunch();
  for (const g of guards) {
    if (!g.alive) continue;
    const dx = g.pos.x - heroPos.x;
    const dz = g.pos.z - heroPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > FIGHT.punchRange) continue;
    const ang = Math.atan2(dx, dz);
    let diff = ang - heroHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) return g;
  }
  return null;
}
