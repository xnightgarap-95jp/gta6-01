// Coral Keys — cars: the factory, traffic AI and arcade driving.
//
// A car is a group of boxes: body, cabin, four wheels, headlights. The
// same factory builds traffic cars, parked cars and police cruisers
// (the cruiser just adds a light bar). Traffic cars follow rectangular
// loops around blocks; the player's car uses arcade physics.

import * as THREE from 'three';
import { WORLD, CAR, PALETTE } from './settings.js';
import { resolveCollisions } from './city.js';

// Build one car mesh. `paint` is a hex colour; police cars get a
// black-and-white body and a light bar on the roof.
export function makeCarMesh(paint, police = false) {
  const group = new THREE.Group();
  const bodyColor = police ? 0x111417 : paint;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.62, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? 0xe8e8e8 : 0x1c2733 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  if (police) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.4, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
    );
    door.position.set(0, 0.62, 0.4);
    group.add(door);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2233ff, emissive: 0x1122aa }),
    );
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d0e });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), lampMat);
    lamp.position.set(x, 0.62, 2.22);
    group.add(lamp);
  }
  group.userData.wheels = wheels;
  return group;
}

// One traffic car: a mesh, a rectangular route around one block, a
// target speed and a little wobble so the flow never looks cloned.
export function makeTrafficCar(scene, rng, roadLines) {
  const paint = PALETTE.carPaint[Math.floor(rng.next() * PALETTE.carPaint.length)];
  const mesh = makeCarMesh(paint);
  scene.add(mesh);
  const line = roadLines[Math.floor(rng.next() * roadLines.length)];
  const other = roadLines[Math.floor(rng.next() * roadLines.length)];
  // A loop around the block whose corner sits at (line, other).
  const halfSpan = WORLD.pitch / 2;
  const cx = THREE.MathUtils.clamp(line, -WORLD.half + halfSpan, WORLD.half - halfSpan);
  const cz = THREE.MathUtils.clamp(other, -WORLD.half + halfSpan, WORLD.half - halfSpan);
  const route = [
    { x: cx - halfSpan, z: cz - halfSpan },
    { x: cx + halfSpan, z: cz - halfSpan },
    { x: cx + halfSpan, z: cz + halfSpan },
    { x: cx - halfSpan, z: cz + halfSpan },
  ];
  return {
    mesh,
    route,
    leg: 0,
    speed: rng.range(7, 11),
    heading: 0,
    pos: new THREE.Vector3(route[0].x, 0, route[0].z),
  };
}

export function updateTraffic(car, dt) {
  const target = car.route[(car.leg + 1) % car.route.length];
  const dx = target.x - car.pos.x;
  const dz = target.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.2) {
    car.leg = (car.leg + 1) % car.route.length;
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += THREE.MathUtils.clamp(diff, -1.6 * dt, 1.6 * dt);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.36;
}

// The player's car: arcade physics with steering that tightens as the
// car slows, a handbrake that breaks grip, and building collision.
export function makePlayerCar(scene, paint) {
  const mesh = makeCarMesh(paint);
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(0, 0, 0),
    heading: 0,
    speed: 0,
    active: false,
  };
}

export function drivePlayerCar(car, input, dt, colliders) {
  const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
  if (input.forward) car.speed += CAR.accel * dt;
  if (input.back) {
    car.speed -= car.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
  }
  if (!input.forward && !input.back) {
    car.speed -= Math.sign(car.speed) * 8 * dt;
    if (Math.abs(car.speed) < 0.4) car.speed = 0;
  }
  car.speed = THREE.MathUtils.clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAmount = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steer = steerAmount * CAR.steer * THREE.MathUtils.clamp(Math.abs(car.speed) / 10, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += steer * dt * grip;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  // Stay inside the built area (the sea stops cars at the beach).
  car.pos.x = THREE.MathUtils.clamp(car.pos.x, -WORLD.half, WORLD.half + WORLD.beachWidth - 2);
  car.pos.z = THREE.MathUtils.clamp(car.pos.z, -WORLD.half, WORLD.half);
  resolveCollisions(car.pos, 1.6, colliders);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  if (Math.abs(car.speed) > 0.5 && input.handbrake) {
    car.speed *= 1 - 0.9 * dt;
  }
}

// Nearest traffic or parked car within stealing range of a point.
export function nearestCar(pos, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
