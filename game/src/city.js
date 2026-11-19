// Coral Keys — the city of Coral Keys, built from one seed.
//
// A 9x9 grid of blocks on a beach coast: roads between every block,
// seeded buildings with lit windows, a casino tower at the centre, a
// park with a fountain, a dockyard to the south, and the beach and sea
// along the whole east edge. The module also hands out the things the
// other modules need: building colliders (AABBs), the road centrelines
// traffic drives on, and named landmark positions for missions.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, PALETTE } from './settings.js';

// Road centreline coordinates, one per road strip, both directions.
export function roadCentres() {
  const list = [];
  for (let k = 0; k <= WORLD.blocks; k++) {
    list.push(-WORLD.half + WORLD.roadWidth / 2 + k * WORLD.pitch);
  }
  return list;
}

// Block centre coordinate for block index i (0..8).
export function blockCentre(i) {
  return -WORLD.half + WORLD.roadWidth + WORLD.blockSize / 2 + i * WORLD.pitch;
}

function facadeTexture(dice, baseColor, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  // Slight vertical shading so towers read at a distance.
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const cellW = 128 / cols;
  const cellH = 256 / floors;
  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = dice.chance(0.42);
      g.fillStyle = lit ? '#ffd97a' : '#2c3a4a';
      g.fillRect(c * cellW + 4, r * cellH + 5, cellW - 8, cellH - 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, dice) {
    this.scene = scene;
    this.dice = dice;
    // Building colliders as {x0, z0, x1, z1} for movement + traffic.
    this.colliders = [];
    this.landmarks = {};
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.buildGround();
    this.buildBlocks();
    this.buildCasino();
    this.buildPark();
    this.buildDock();
    this.buildBeach();
    this.buildPalmsAndLamps();
  }

  box(w, h, d, color, x, y, z, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0.05,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (opts.map) mesh.material.map = opts.map;
    mesh.castShadow = opts.shadow ?? false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  buildGround() {
    const H = WORLD.half;
    // Grass base under everything.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 2 + WORLD.beachWidth + WORLD.seaWidth + 80, H * 2 + 80),
      new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((WORLD.beachWidth + WORLD.seaWidth) / 2, -0.05, 0);
    ground.receiveShadow = true;
    this.group.add(ground);
    // Asphalt: one long strip per road, both directions.
    const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
    for (const c of roadCentres()) {
      const alongX = new THREE.Mesh(new THREE.PlaneGeometry(H * 2 + 4, WORLD.roadWidth), roadMat);
      alongX.rotation.x = -Math.PI / 2;
      alongX.position.set(0, 0, c);
      alongX.receiveShadow = true;
      this.group.add(alongX);
      const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, H * 2 + 4), roadMat);
      alongZ.rotation.x = -Math.PI / 2;
      alongZ.position.set(c, 0.001, 0);
      alongZ.receiveShadow = true;
      this.group.add(alongZ);
      // Dashed centre line.
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
      for (let t = -H + 8; t < H - 8; t += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(t, 0.01, c);
        this.group.add(dash);
      }
    }
    // Sidewalk slabs around each block.
    const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
    for (let i = 0; i < WORLD.blocks; i++) {
      for (let j = 0; j < WORLD.blocks; j++) {
        const slab = new THREE.Mesh(
          new THREE.PlaneGeometry(WORLD.blockSize + 3, WORLD.blockSize + 3),
          walkMat,
        );
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(blockCentre(i), 0.005, blockCentre(j));
        slab.receiveShadow = true;
        this.group.add(slab);
      }
    }
  }

  buildBlocks() {
    const dice = this.dice;
    for (let i = 0; i < WORLD.blocks; i++) {
      for (let j = 0; j < WORLD.blocks; j++) {
        // The centre block is the casino, (4,6) is the park, (4,8) the
        // dockyard, (7,8) the garage — those get their own builders.
        if ((i === 4 && j === 4) || (i === 4 && j === 6) || (i === 4 && j === 8) || (i === 7 && j === 8)) continue;
        const cx = blockCentre(i);
        const cz = blockCentre(j);
        const count = dice.int(1, 2);
        for (let b = 0; b < count; b++) {
          const w = dice.range(10, 20);
          const d = dice.range(10, 20);
          const h = dice.range(7, 30) * (dice.chance(0.12) ? 2.2 : 1);
          const ox = count === 1 ? 0 : (b === 0 ? -8 : 8);
          const oz = count === 1 ? 0 : (b === 0 ? -6 : 6);
          const color = dice.pick(PALETTE.building);
          const floors = Math.max(2, Math.round(h / 4));
          const tex = facadeTexture(dice, color, floors, 5);
          const mesh = this.box(w, h, d, color, cx + ox, h / 2, cz + oz, { map: tex });
          mesh.material.map = tex;
          const x0 = cx + ox - w / 2;
          const x1 = cx + ox + w / 2;
          const z0 = cz + oz - d / 2;
          const z1 = cz + oz + d / 2;
          this.colliders.push({ x0, z0, x1, z1 });
        }
      }
    }
  }

  buildCasino() {
    const cx = blockCentre(4);
    const cz = blockCentre(4);
    const tower = this.box(24, 64, 24, 0x7a2e6d, cx, 32, cz, {
      emissive: 0x3a0f33,
      emissiveIntensity: 0.6,
    });
    tower.name = 'casino-tower';
    // Glowing crown ring.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(13, 1.1, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0xffd97a, emissive: 0xffb52e, emissiveIntensity: 1.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, 65, cz);
    this.group.add(ring);
    // Neon sign band.
    this.box(26, 3, 0.6, 0xff2e88, cx, 52, cz + 12.4, { emissive: 0xff2e88, emissiveIntensity: 1.4 });
    this.box(26, 3, 0.6, 0x2ee6ff, cx, 52, cz - 12.4, { emissive: 0x2ee6ff, emissiveIntensity: 1.4 });
    this.colliders.push({ x0: cx - 13, z0: cz - 13, x1: cx + 13, z1: cz + 13 });
    this.landmarks.casino = { x: cx, z: cz };
  }

  buildPark() {
    const cx = blockCentre(4);
    const cz = blockCentre(6);
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.blockSize, WORLD.blockSize),
      new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 1 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.02, cz);
    lawn.receiveShadow = true;
    this.group.add(lawn);
    // Fountain: stone rim + water disc.
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5.4, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 }),
    );
    rim.position.set(cx, 0.5, cz);
    this.group.add(rim);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x3fa8d8, roughness: 0.15, metalness: 0.4 }),
    );
    water.position.set(cx, 0.9, cz);
    this.group.add(water);
    // A few round trees.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const tx = cx + Math.cos(a) * 12;
      const tz = cz + Math.sin(a) * 12;
      this.tree(tx, tz, 1);
    }
    this.landmarks.park = { x: cx, z: cz };
  }

  tree(x, z, scale = 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35 * scale, 0.5 * scale, 3.4 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 }),
    );
    trunk.position.set(x, 1.7 * scale, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(2.2 * scale, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 1 }),
    );
    top.position.set(x, 4.4 * scale, z);
    top.castShadow = true;
    this.group.add(top);
  }

  buildDock() {
    const cx = blockCentre(4);
    const cz = blockCentre(8);
    // Container yard: stacked coloured boxes.
    const colors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
    for (let k = 0; k < 10; k++) {
      const x = cx - 12 + (k % 5) * 6.5;
      const z = cz - 6 + Math.floor(k / 5) * 7;
      const stack = k % 3 === 0 ? 2 : 1;
      for (let s = 0; s < stack; s++) {
        this.box(6, 2.6, 2.6, colors[k % colors.length], x, 1.3 + s * 2.6, z);
      }
      this.colliders.push({ x0: x - 3, z0: z - 1.3, x1: x + 3, z1: z + 1.3 });
    }
    // Pier reaching into the sea from the east edge.
    const pierX = WORLD.half + WORLD.beachWidth + 14;
    this.box(30, 1.2, 8, 0x8a6f4d, pierX, 0.6, cz, { roughness: 1 });
    this.landmarks.dock = { x: cx, z: cz };
    this.landmarks.pier = { x: pierX + 12, z: cz };
  }

  buildBeach() {
    const H = WORLD.half;
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.beachWidth, H * 2 + 40),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(H + WORLD.beachWidth / 2, 0.02, 0);
    sand.receiveShadow = true;
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.seaWidth, H * 2 + 40),
      new THREE.MeshStandardMaterial({
        color: PALETTE.sea,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(H + WORLD.beachWidth + WORLD.seaWidth / 2, 0.01, 0);
    this.group.add(sea);
    this.landmarks.beach = { x: H + 12, z: 0 };
  }

  buildPalmsAndLamps() {
    const dice = this.dice;
    // Palms along the beach edge.
    for (let z = -WORLD.half + 20; z < WORLD.half - 10; z += 34) {
      const x = WORLD.half + 6 + dice.range(-2, 4);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 }),
      );
      trunk.position.set(x, 3.5, z);
      trunk.rotation.z = 0.12;
      this.group.add(trunk);
      const fronds = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 2.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 }),
      );
      fronds.position.set(x + 0.8, 7.4, z);
      this.group.add(fronds);
    }
    // Street lamps at every other intersection.
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd97a, emissiveIntensity: 1.2 });
    for (const cx of roadCentres()) {
      for (const cz of roadCentres()) {
        if ((Math.round(cx) + Math.round(cz)) % 92 !== 0) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
        pole.position.set(cx + 5.4, 3, cz + 5.4);
        this.group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(cx + 5.4, 6.2, cz + 5.4);
        this.group.add(bulb);
      }
    }
  }

  // Push a circle (x, z, radius) out of every building it overlaps.
  resolveCircle(pos, radius) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
      const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          pos.x = c.x1 + radius;
        }
      }
    }
    const limit = WORLD.half + WORLD.beachWidth - 2;
    pos.x = Math.max(-WORLD.half - 2, Math.min(limit, pos.x));
    pos.z = Math.max(-WORLD.half - 2, Math.min(WORLD.half + 2, pos.z));
  }
}
