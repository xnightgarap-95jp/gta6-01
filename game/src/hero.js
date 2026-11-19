// Coral Keys — the hero, Dana Cole, on foot.
//
// Third-person movement: WASD moves relative to the camera, Shift runs,
// Space jumps, and the camera orbits with the mouse (drag) or follows
// behind while driving. The hero is a simple box figure with a jacket,
// so she reads clearly at any distance.

import * as THREE from 'three';
import { HERO } from './settings.js';
import { resolveCollisions } from './city.js';

export function makeHeroMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.9, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x7a2e3d }),
  );
  jacket.position.y = 1.05;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.72;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.2, 0.46),
    new THREE.MeshLambertMaterial({ color: 0x241a12 }),
  );
  hair.position.y = 1.95;
  group.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b3440 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), legMat);
  legL.position.set(-0.17, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), legMat);
  legR.position.set(0.17, 0.31, 0);
  group.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x7a2e3d });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), armMat);
  armL.position.set(-0.44, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), armMat);
  armR.position.set(0.44, 1.05, 0);
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armR = armR;
  return group;
}

export function makeHero(scene, spawn) {
  const mesh = makeHeroMesh();
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    heading: Math.PI,
    velY: 0,
    onGround: true,
    health: HERO.maxHealth,
    cash: 0,
    walkPhase: 0,
    moving: false,
  };
}

// Move the hero for one frame. `camYaw` is the camera's heading so W
// walks away from the camera. Returns nothing; the mesh is updated.
export function updateHero(hero, input, camYaw, dt, colliders) {
  const run = input.run ? HERO.runSpeed : HERO.walkSpeed;
  let mx = 0;
  let mz = 0;
  if (input.forward) mz += 1;
  if (input.back) mz -= 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  hero.moving = mx !== 0 || mz !== 0;
  if (hero.moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    // Rotate the input by the camera yaw: W walks away from the camera.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wx = mx * cos + mz * sin;
    const wz = -mx * sin + mz * cos;
    hero.pos.x += wx * run * dt;
    hero.pos.z += wz * run * dt;
    hero.heading = Math.atan2(wx, wz);
    hero.walkPhase += dt * run * 1.6;
  }
  if (input.jump && hero.onGround) {
    hero.velY = HERO.jumpSpeed;
    hero.onGround = false;
  }
  if (!hero.onGround) {
    hero.velY -= HERO.gravity * dt;
    hero.pos.y += hero.velY * dt;
    if (hero.pos.y <= 0) {
      hero.pos.y = 0;
      hero.velY = 0;
      hero.onGround = true;
    }
  }
  hero.pos.x = THREE.MathUtils.clamp(hero.pos.x, -WORLD_HALF, WORLD_HALF_BEACH);
  hero.pos.z = THREE.MathUtils.clamp(hero.pos.z, -WORLD_HALF, WORLD_HALF);
  resolveCollisions(hero.pos, HERO.radius, colliders);
  hero.mesh.position.copy(hero.pos);
  hero.mesh.rotation.y = hero.heading;
  const swing = hero.moving ? Math.sin(hero.walkPhase) * 0.5 : 0;
  hero.mesh.userData.legL.rotation.x = swing;
  hero.mesh.userData.legR.rotation.x = -swing;
  hero.mesh.userData.armR.rotation.x = input.aiming ? -1.2 : -swing * 0.6;
}

// World bounds, set by boot after the city is built.
let WORLD_HALF = 213;
let WORLD_HALF_BEACH = 240;
export function setWorldBounds(half, beachEdge) {
  WORLD_HALF = half;
  WORLD_HALF_BEACH = beachEdge;
}
