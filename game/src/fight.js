// Coral Keys — combat: fists, the pistol, and armed enemies.
//
// Enemies are guards in dark jackets who stand their ground, shoot at
// Dana when she is in range, and show a small 3D health bar over their
// heads. Dana punches with F (a short-range arc in front of her) and
// fires the pistol with the mouse (a ray from the camera through the
// crosshair). Tracers are thin stretched boxes that fade in a blink.

import * as THREE from '../vendor/three.module.min.js';
import { FIGHT } from './settings.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = FIGHT.pistolRange;
  }

  spawnEnemy(x, z, hp = FIGHT.enemyHealth) {
    const group = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.75, 4, 10), jacket);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
    head.position.y = 1.9;
    group.add(head);
    // A cap so guards read as guards at a glance.
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),
    );
    cap.position.y = 2.1;
    group.add(cap);
    // Health bar: a dark backing plate and a green fill that shrinks.
    const barBack = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.85 }),
    );
    barBack.position.y = 2.45;
    group.add(barBack);
    const barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.04, 0.09),
      new THREE.MeshBasicMaterial({ color: 0x2ecc71 }),
    );
    barFill.position.set(0, 2.45, 0.01);
    group.add(barFill);
    group.position.set(x, 0, z);
    group.name = 'enemy-guard';
    this.scene.add(group);
    const enemy = { mesh: group, barFill, hp, maxHp: hp, shootTimer: 1 + Math.random(), dead: false };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Enemies face Dana and shoot on a timer when close enough.
  // Returns the damage they dealt this frame (0 when none).
  update(dt, heroPos, onShoot) {
    let damage = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = heroPos.x - e.mesh.position.x;
      const dz = heroPos.z - e.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      // Face the bar toward the camera is handled by the bar being a
      // child that we counter-rotate in boot's camera update; here we
      // just keep the bar upright by copying the group's yaw inverse.
      e.barFill.parent.rotation.y = 0;
      e.shootTimer -= dt;
      if (dist < FIGHT.enemyShootRange && e.shootTimer <= 0) {
        e.shootTimer = FIGHT.enemyShootDelay;
        this.spawnTracer(e.mesh.position, heroPos, 0xff5533);
        if (dist < FIGHT.enemyShootRange * 0.75 && Math.random() < 0.55) {
          damage += 8;
          onShoot?.(e);
        }
      }
    }
    // Fade tracers out.
    for (const t of this.tracers) {
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.18);
    }
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });
    return damage;
  }

  spawnTracer(from, to, color) {
    const dir = new THREE.Vector3(to.x - from.x, (to.y ?? 1.2) - (from.y ?? 1.2), to.z - from.z);
    const len = dir.length();
    if (len < 0.1) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    mesh.position.set((from.x + to.x) / 2, ((from.y ?? 1.2) + (to.y ?? 1.2)) / 2, (from.z + to.z) / 2);
    mesh.lookAt(to.x, to.y ?? 1.2, to.z);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.18 });
  }

  // A punch: anything alive within range and in front of the hero.
  punch(origin, heading) {
    const hits = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.mesh.position.x - origin.x;
      const dz = e.mesh.position.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > FIGHT.punchRange) continue;
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - heading);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 1.1) hits.push(e);
    }
    for (const e of hits) this.damageEnemy(e, FIGHT.punchDamage);
    return hits.length;
  }

  // A pistol shot from the camera through the screen centre.
  shoot(camera, hero) {
    if (hero.ammo <= 0) return { fired: false, reason: 'empty' };
    hero.ammo -= 1;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = this.enemies.filter((e) => !e.dead).map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) {
        if (obj.userData.enemy) break;
        obj = obj.parent;
      }
      const enemy = this.enemies.find((e) => e.mesh === obj || e.mesh === obj.parent || this.isDescendant(e.mesh, hits[0].object));
      if (enemy) {
        this.damageEnemy(enemy, FIGHT.pistolDamage);
        const p = hits[0].point;
        this.spawnTracer(camera.position, { x: p.x, y: p.y, z: p.z }, 0xffe9a8);
        return { fired: true, hit: true };
      }
    }
    // Miss: tracer to a point far along the ray.
    const far = this.raycaster.ray.at(FIGHT.pistolRange, new THREE.Vector3());
    this.spawnTracer(camera.position, { x: far.x, y: far.y, z: far.z }, 0xffe9a8);
    return { fired: true, hit: false };
  }

  isDescendant(root, obj) {
    let cur = obj;
    while (cur) {
      if (cur === root) return true;
      cur = cur.parent;
    }
    return false;
  }

  damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.barFill.scale.x = ratio;
    enemy.barFill.position.x = -(1 - ratio) * 0.52;
    enemy.barFill.material.color.setHex(ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      // Fall over and fade: rotate flat, then remove on the next sweep.
      enemy.mesh.rotation.x = -Math.PI / 2;
      enemy.mesh.position.y = 0.3;
      setTimeout(() => {
        this.scene.remove(enemy.mesh);
        this.enemies = this.enemies.filter((e) => e !== enemy);
      }, 2500);
    }
  }

  aliveCount() {
    return this.enemies.filter((e) => !e.dead).length;
  }
}
