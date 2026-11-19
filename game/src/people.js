// Coral Keys — pedestrians.
//
// Walkers stroll the sidewalks on short straight runs, turn around at
// the ends, and scatter away from a speeding car or a gunshot. Each one
// is a small group of boxes with a random shirt colour, so the streets
// read as lived-in from a distance.

import * as THREE from 'three';
import { WORLD } from './settings.js';

function makeWalkerMesh(shirt) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.95, 0.36),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.75;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b3440 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), legMat);
  legL.position.set(-0.16, 0.3, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), legMat);
  legR.position.set(0.16, 0.3, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

const SHIRTS = [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0xe8e8e8, 0x7a4fb5, 0xe86a2a, 0x3a3f45];

export function makePedestrian(scene, rng, roadLines) {
  const shirt = SHIRTS[Math.floor(rng.next() * SHIRTS.length)];
  const mesh = makeWalkerMesh(shirt);
  scene.add(mesh);
  // Start on a sidewalk beside a random road.
  const line = roadLines[Math.floor(rng.next() * roadLines.length)];
  const along = rng.range(-WORLD.half + 20, WORLD.half - 20);
  const side = rng.chance(0.5) ? 1 : -1;
  const vertical = rng.chance(0.5);
  const pos = vertical
    ? new THREE.Vector3(line + side * (7.5), 0, along)
    : new THREE.Vector3(along, 0, line + side * (7.5));
  return {
    mesh,
    pos,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.1, 1.9),
    walkPhase: rng.range(0, Math.PI * 2),
    scared: 0,
    runLeft: rng.range(6, 18),
  };
}

export function updatePedestrian(p, dt, threats) {
  // A threat (fast car or gunshot) makes the walker run away from it.
  let fleeX = 0;
  let fleeZ = 0;
  for (const t of threats) {
    const dx = p.pos.x - t.x;
    const dz = p.pos.z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < t.radius) {
      fleeX += dx / (d || 1);
      fleeZ += dz / (d || 1);
    }
  }
  if (fleeX !== 0 || fleeZ !== 0) {
    p.scared = 1.6;
    p.heading = Math.atan2(fleeX, fleeZ);
  } else if (p.scared > 0) {
    p.scared -= dt;
  }
  const speed = p.scared > 0 ? p.speed * 2.6 : p.speed;
  p.pos.x += Math.sin(p.heading) * speed * dt;
  p.pos.z += Math.cos(p.heading) * speed * dt;
  p.runLeft -= dt;
  if (p.runLeft <= 0) {
    // Turn around and walk back the other way.
    p.heading += Math.PI + (Math.random() - 0.5) * 0.6;
    p.runLeft = 8 + Math.random() * 14;
  }
  // Keep walkers inside the city.
  p.pos.x = THREE.MathUtils.clamp(p.pos.x, -WORLD.half, WORLD.half + WORLD.beachWidth - 4);
  p.pos.z = THREE.MathUtils.clamp(p.pos.z, -WORLD.half, WORLD.half);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // Little leg swing while walking.
  p.walkPhase += dt * speed * 4;
  const swing = Math.sin(p.walkPhase) * 0.35;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
}
