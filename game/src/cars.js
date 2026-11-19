// Coral Keys — cars: the models, the player's arcade driving, and traffic.
//
// A car is a small group: a body box, a cabin box, four cylinder wheels
// and two headlights. The player car runs simple arcade physics (speed
// along a heading, steering scaled by speed, grip pulling velocity back
// to the heading). Traffic cars cruise the road grid and turn at
// intersections, seeded so the same seed drives the same streets.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, CAR } from './settings.js';
import { roadCentres } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2471a3, 0xf1c40f, 0x7d3c98, 0xecf0f1, 0x1a1a1a, 0x16a085, 0xe67e22];

export function buildCarMesh(color, isPlayer = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheelPos = [
    [-0.95, 0.36, 1.45],
    [0.95, 0.36, 1.45],
    [-0.95, 0.36, -1.45],
    [0.95, 0.36, -1.45],
  ];
  for (const [x, y, z] of wheelPos) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b0,
    emissive: 0xffe9a8,
    emissiveIntensity: isPlayer ? 1.4 : 0.7,
  });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), lightMat);
    lamp.position.set(x, 0.62, 2.22);
    group.add(lamp);
  }
  return group;
}

export class PlayerCar {
  constructor(scene, color) {
    this.mesh = buildCarMesh(color, true);
    this.mesh.name = 'player-car';
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.speed = 0;
    this.active = false;
    this.color = color;
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.active = true;
    this.sync();
  }

  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = this.active;
  }

  // Arcade step: input {fwd, back, left, right, brake} and dt.
  drive(input, dt) {
    if (!this.active) return;
    if (input.fwd) this.speed += CAR.accel * dt;
    if (input.back) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.reverseAccel * dt;
    }
    if (input.brake) this.speed *= Math.pow(0.25, dt);
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    // Steering bites harder at speed, and reverses when backing up.
    const steerAmount = CAR.steer * dt * Math.min(1, Math.abs(this.speed) / 8) * Math.sign(this.speed || 1);
    if (input.left) this.heading += steerAmount;
    if (input.right) this.heading -= steerAmount;
    // Drag + rolling resistance.
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
  }
}

export class Traffic {
  constructor(scene, dice, city) {
    this.scene = scene;
    this.dice = dice;
    this.city = city;
    this.cars = [];
    this.roads = roadCentres();
    for (let i = 0; i < 14; i++) this.spawn();
  }

  spawn() {
    const dice = this.dice;
    const horizontal = dice.chance(0.5);
    const road = dice.pick(this.roads);
    const along = dice.range(-WORLD.half + 10, WORLD.half - 10);
    const car = {
      mesh: buildCarMesh(dice.pick(CAR_COLORS)),
      horizontal,
      road,
      along,
      dir: dice.chance(0.5) ? 1 : -1,
      speed: dice.range(7, 12),
      stopped: 0,
    };
    car.mesh.name = 'traffic-car';
    this.scene.add(car.mesh);
    this.cars.push(car);
    this.syncCar(car);
    return car;
  }

  syncCar(car) {
    if (car.horizontal) {
      car.mesh.position.set(car.along, 0, car.road);
      car.mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.mesh.position.set(car.road, 0, car.along);
      car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
    }
  }

  // A traffic car is "near an intersection" when its along-coordinate
  // is close to another road centreline.
  nearestRoad(value) {
    let best = this.roads[0];
    let bestD = Infinity;
    for (const r of this.roads) {
      const d = Math.abs(r - value);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return { road: best, dist: bestD };
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      // Stop briefly if the player is right in front of the car.
      const dx = playerPos.x - car.mesh.position.x;
      const dz = playerPos.z - car.mesh.position.z;
      const ahead = car.horizontal ? dx * car.dir : dz * car.dir;
      const side = car.horizontal ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && side < 3) {
        car.stopped = Math.max(car.stopped, 0.8);
      }
      if (car.stopped > 0) {
        car.stopped -= dt;
        continue;
      }
      car.along += car.dir * car.speed * dt;
      // Turn at an intersection: snap onto the crossing road sometimes.
      const near = this.nearestRoad(car.along);
      if (near.dist < 1.2 && this.dice.chance(0.012)) {
        const oldRoad = car.road;
        car.road = near.road;
        car.along = oldRoad;
        car.horizontal = !car.horizontal;
        if (this.dice.chance(0.5)) car.dir *= -1;
      }
      // Wrap around the city edge instead of driving into the sea.
      if (car.along > WORLD.half + 4) car.along = -WORLD.half - 4;
      if (car.along < -WORLD.half - 4) car.along = WORLD.half + 4;
      this.syncCar(car);
    }
  }

  // The closest traffic car within range of a point, for stealing.
  nearestTo(x, z, range) {
    let best = null;
    let bestD = range;
    for (const car of this.cars) {
      const dx = car.mesh.position.x - x;
      const dz = car.mesh.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  remove(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }
}
