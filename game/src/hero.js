// Coral Keys — Dana Cole on foot.
//
// Third-person walker: WASD moves relative to the camera, Shift runs,
// Space jumps, F punches, E steals the nearest car, 1/2 swap weapons.
// The hero is a capsule body with a jacket, jeans and a head, plus a
// pistol mesh that appears when the pistol is drawn. Gravity and a
// ground plane keep the feet on the street; buildings push the hero out
// through the city's colliders.

import * as THREE from '../vendor/three.module.min.js';
import { HERO, CAR } from './settings.js';

export class Hero {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'dana-cole';
    const jacket = new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.8 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.75, 4, 10), jacket);
    body.position.y = 1.05;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
    head.position.y = 1.9;
    head.castShadow = true;
    this.group.add(head);
    // Hair: a dark cap on the back of the head.
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 1 }),
    );
    hair.position.y = 1.94;
    this.group.add(hair);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), jeans);
    legL.position.set(-0.15, 0.32, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), jeans);
    legR.position.set(0.15, 0.32, 0);
    this.group.add(legL);
    this.group.add(legR);
    this.legL = legL;
    this.legR = legR;
    // Pistol, hidden until the pistol is the active weapon.
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.7 }));
    barrel.position.z = 0.18;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
    grip.position.set(0, -0.1, 0);
    gun.add(barrel);
    gun.add(grip);
    gun.position.set(0.42, 1.15, 0.3);
    gun.visible = false;
    this.group.add(gun);
    this.gun = gun;
    scene.add(this.group);

    this.pos = new THREE.Vector3(0, 0, 0);
    this.velY = 0;
    this.onGround = true;
    this.heading = 0; // facing, radians
    this.health = HERO.maxHealth;
    this.money = 0;
    this.weapon = 'fists'; // 'fists' | 'pistol'
    this.ammo = 12;
    this.reserveAmmo = 48;
    this.inCar = false;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.punchCooldown = 0;
  }

  place(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.sync();
  }

  sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.gun.visible = this.weapon === 'pistol' && !this.inCar;
  }

  // input: {fwd, back, left, right, run, jump, camYaw}, dt, city.
  step(input, dt, city) {
    if (this.inCar) return;
    const speed = input.run ? HERO.runSpeed : HERO.walkSpeed;
    // Movement is relative to the camera yaw.
    const sin = Math.sin(input.camYaw);
    const cos = Math.cos(input.camYaw);
    let mx = 0;
    let mz = 0;
    if (input.fwd) {
      mx += -sin;
      mz += -cos;
    }
    if (input.back) {
      mx += sin;
      mz += cos;
    }
    if (input.left) {
      mx += -cos;
      mz += sin;
    }
    if (input.right) {
      mx += cos;
      mz += -sin;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump + gravity.
    if (input.jump && this.onGround) {
      this.velY = HERO.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.velY -= HERO.gravity * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.velY = 0;
        this.onGround = true;
      }
    }
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    city.resolveCircle(this.pos, HERO.radius);
    this.sync();
  }

  punch() {
    if (this.punchCooldown > 0 || this.inCar) return false;
    this.punchCooldown = 0.45;
    this.punchTimer = 0.3;
    return true;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(HERO.maxHealth, this.health + amount);
  }

  // Find a car close enough to steal, preferring traffic cars.
  trySteal(traffic, playerCar) {
    if (this.inCar) return null;
    const car = traffic.nearestTo(this.pos.x, this.pos.z, CAR.stealRange);
    if (car) {
      traffic.remove(car);
      return { kind: 'traffic', color: car.mesh.children[0].material.color.getHex(), x: car.mesh.position.x, z: car.mesh.position.z, heading: car.mesh.rotation.y };
    }
    // The player's own parked car can be re-entered from nearby.
    if (playerCar.active) {
      const dx = playerCar.pos.x - this.pos.x;
      const dz = playerCar.pos.z - this.pos.z;
      if (Math.hypot(dx, dz) < CAR.stealRange) {
        return { kind: 'own', x: playerCar.pos.x, z: playerCar.pos.z, heading: playerCar.heading };
      }
    }
    return null;
  }
}
