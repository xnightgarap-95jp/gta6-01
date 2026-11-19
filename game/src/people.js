// Coral Keys — pedestrians.
//
// Walkers stroll the sidewalks on seeded routes, cross roads at the
// corners, and scatter when a car comes at them. Each one is a simple
// capsule body with a coloured shirt and a head, kept cheap so dozens
// can wander the city at once.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD } from './settings.js';
import { roadCentres, blockCentre } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xfd79a8];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export class Pedestrians {
  constructor(scene, dice) {
    this.scene = scene;
    this.dice = dice;
    this.walkers = [];
    for (let i = 0; i < 26; i++) this.spawn();
  }

  spawn() {
    const dice = this.dice;
    const shirt = new THREE.MeshStandardMaterial({ color: dice.pick(SHIRTS), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: dice.pick(SKINS), roughness: 0.8 });
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 4, 8), shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    // Legs: two small boxes that swing while walking.
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), legMat);
    legL.position.set(-0.14, 0.3, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), legMat);
    legR.position.set(0.14, 0.3, 0);
    group.add(legL);
    group.add(legR);
    group.name = 'pedestrian';
    this.scene.add(group);
    const walker = {
      mesh: group,
      legL,
      legR,
      // Walk the sidewalk ring of a random block, corner to corner.
      blockI: dice.int(0, WORLD.blocks - 1),
      blockJ: dice.int(0, WORLD.blocks - 1),
      corner: dice.int(0, 3),
      speed: dice.range(1.1, 2.2),
      phase: dice.range(0, Math.PI * 2),
      fleeing: 0,
      target: null,
    };
    walker.target = this.cornerPoint(walker);
    walker.mesh.position.set(walker.target.x, 0, walker.target.z);
    this.walkers.push(walker);
    return walker;
  }

  cornerPoint(walker) {
    const cx = blockCentre(walker.blockI);
    const cz = blockCentre(walker.blockJ);
    const off = WORLD.blockSize / 2 + 1.6;
    const corners = [
      { x: cx - off, z: cz - off },
      { x: cx + off, z: cz - off },
      { x: cx + off, z: cz + off },
      { x: cx - off, z: cz + off },
    ];
    return corners[walker.corner % 4];
  }

  update(dt, threats) {
    for (const w of this.walkers) {
      // Flee from a fast car or a punching player nearby.
      let fleeX = 0;
      let fleeZ = 0;
      for (const t of threats) {
        const dx = w.mesh.position.x - t.x;
        const dz = w.mesh.position.z - t.z;
        const d = Math.hypot(dx, dz);
        if (d < 7 && d > 0.01) {
          fleeX += (dx / d) * (7 - d);
          fleeZ += (dz / d) * (7 - d);
        }
      }
      const pos = w.mesh.position;
      if (fleeX !== 0 || fleeZ !== 0) {
        w.fleeing = 0.9;
        pos.x += fleeX * 3.2 * dt;
        pos.z += fleeZ * 3.2 * dt;
        w.mesh.rotation.y = Math.atan2(fleeX, fleeZ);
        w.phase += dt * 14;
      } else {
        if (w.fleeing > 0) w.fleeing -= dt;
        const target = w.target;
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) {
          w.corner += 1;
          // Sometimes hop to the neighbouring block instead.
          if (this.dice.chance(0.3)) {
            w.blockI = Math.max(0, Math.min(WORLD.blocks - 1, w.blockI + this.dice.pick([-1, 1])));
          }
          w.target = this.cornerPoint(w);
        } else {
          pos.x += (dx / d) * w.speed * dt;
          pos.z += (dz / d) * w.speed * dt;
          w.mesh.rotation.y = Math.atan2(dx, dz);
          w.phase += dt * 8;
        }
      }
      // Leg swing from the walk phase.
      const swing = Math.sin(w.phase) * 0.5;
      w.legL.rotation.x = swing;
      w.legR.rotation.x = -swing;
      // Stay inside the city.
      pos.x = Math.max(-WORLD.half, Math.min(WORLD.half + WORLD.beachWidth - 2, pos.x));
      pos.z = Math.max(-WORLD.half, Math.min(WORLD.half, pos.z));
    }
  }
}
