// Coral Keys — the wanted system and the Coral Keys police.
//
// Stars rise when Dana is seen doing crimes (stealing a car, shooting,
// punching a pedestrian) and fall again after hiding out of sight for a
// while. Cruisers spawn at the city edge, chase the player, ram the car,
// and arrest Dana if they sit on her long enough while she is slow.
// The police car is a black-and-white cruiser with a light bar.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, HEAT } from './settings.js';
import { buildCarMesh } from './cars.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.hiddenTime = 0;
    this.decayTimer = 0;
    this.cruisers = [];
    this.arrestProgress = 0;
    this.lastCrime = 0;
  }

  addHeat(amount, now) {
    this.stars = Math.min(HEAT.maxStars, this.stars + amount);
    this.hiddenTime = 0;
    this.decayTimer = 0;
    this.lastCrime = now;
    this.syncCruisers();
  }

  clearHeat() {
    this.stars = 0;
    this.arrestProgress = 0;
    this.syncCruisers();
  }

  // Keep the cruiser count matched to the star level.
  syncCruisers() {
    const want = HEAT.cruisersFor(this.stars);
    while (this.cruisers.length < want) this.spawnCruiser();
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
  }

  spawnCruiser() {
    const mesh = buildCarMesh(0x111111);
    // White doors + light bar make it read as a police car.
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4, metalness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 1.4), doorMat);
    door.position.set(0, 0.62, -0.2);
    mesh.add(door);
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), barMat);
    bar.position.set(0, 1.45, -0.25);
    mesh.add(bar);
    mesh.name = 'police-cruiser';
    this.scene.add(mesh);
    // Spawn at a random city edge.
    const edge = Math.floor(Math.random() * 4);
    const half = WORLD.half - 6;
    const pos = [
      { x: -half, z: (Math.random() - 0.5) * 2 * half },
      { x: half, z: (Math.random() - 0.5) * 2 * half },
      { x: (Math.random() - 0.5) * 2 * half, z: -half },
      { x: (Math.random() - 0.5) * 2 * half, z: half },
    ][edge];
    const cruiser = {
      mesh,
      bar,
      pos: new THREE.Vector3(pos.x, 0, pos.z),
      heading: 0,
      speed: 0,
      flash: Math.random() * 2,
    };
    this.cruisers.push(cruiser);
    return cruiser;
  }

  // dt step. target is the player's position; playerSpeed is their speed
  // (car or foot). Returns 'arrested' when a bust lands, else null.
  update(dt, target, playerSpeed, now) {
    // Heat decays only after hiding for a while.
    if (this.stars > 0) {
      this.hiddenTime += dt;
      if (this.hiddenTime > HEAT.hideDelay) {
        this.decayTimer += dt;
        if (this.decayTimer >= HEAT.hideStep) {
          this.decayTimer = 0;
          this.stars -= 1;
          this.syncCruisers();
        }
      }
    }
    let arrested = false;
    for (const c of this.cruisers) {
      const dx = target.x - c.pos.x;
      const dz = target.z - c.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      // Steer toward the player, faster with more stars.
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const topSpeed = 20 + this.stars * 2.4;
      c.speed = Math.min(topSpeed, c.speed + 14 * dt);
      c.pos.x += Math.sin(c.heading) * c.speed * dt;
      c.pos.z += Math.cos(c.heading) * c.speed * dt;
      this.city.resolveCircle(c.pos, 1.2);
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = c.heading;
      // Flashing light bar.
      c.flash += dt * 6;
      c.bar.material.emissive.setHex(Math.sin(c.flash) > 0 ? 0xff2222 : 0x2244ff);
      // Arrest: close and the player is barely moving.
      if (dist < HEAT.arrestRange && playerSpeed < 3) {
        this.arrestProgress += dt;
        if (this.arrestProgress >= HEAT.arrestTime) arrested = true;
      } else {
        this.arrestProgress = Math.max(0, this.arrestProgress - dt * 0.5);
      }
    }
    return arrested ? 'arrested' : null;
  }
}
