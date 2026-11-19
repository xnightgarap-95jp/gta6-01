// Coral Keys — the city itself.
//
// Builds the 9x9-block coastal city from one seed: roads and sidewalks,
// seeded buildings with canvas facades, a neon casino tower, a park with
// a fountain, a dockyard with containers and a pier, a beach and the sea.
// Returns the collision boxes and the named places the missions use.

import * as THREE from 'three';
import { WORLD, PALETTE } from './settings.js';
import { makeRng } from './seed.js';

// One canvas facade per paint colour, shared by every building that
// wears it. Windows are drawn once; some glow warm, most stay dark.
function makeFacadeTexture(base, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so the face is not flat.
  const shade = g.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.18)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.next() < 0.28;
      g.fillStyle = lit ? '#ffd97a' : '#2c3a4a';
      g.fillRect(10 + c * 22, 12 + r * 24, 14, 15);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

// A building with a textured front: one box, facade texture on the
// sides, plain roof. The box is registered as a collision box.
function makeBuilding(rng, facades, cx, cz, w, d, h) {
  const tex = facades[Math.floor(rng.next() * facades.length)];
  const side = new THREE.MeshLambertMaterial({ map: tex });
  const top = new THREE.MeshLambertMaterial({ color: 0x55504a });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [side, side, top, top, side, side],
  );
  mesh.position.set(cx, h / 2, cz);
  return mesh;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const half = WORLD.half;

  const facades = PALETTE.building.map((c) => makeFacadeTexture(hexCss(c), rng));

  // --- ground -----------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + WORLD.beachWidth + WORLD.seaWidth, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((WORLD.beachWidth + WORLD.seaWidth) / 2, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach sand strip on the east edge.
  const beach = box(WORLD.beachWidth, 0.2, half * 2 + 40, PALETTE.sand, half + WORLD.beachWidth / 2, 0.1, 0);
  group.add(beach);
  // The sea beyond the beach.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.seaWidth, half * 2 + 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(half + WORLD.beachWidth + WORLD.seaWidth / 2, 0.05, 0);
  group.add(sea);

  // --- roads and sidewalks ----------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x23262b });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadLines = [];
  for (let k = 0; k <= WORLD.blocks; k++) {
    roadLines.push(-half + WORLD.roadWidth / 2 + k * WORLD.pitch - (k === WORLD.blocks ? WORLD.roadWidth : 0));
  }
  // Inner gap centres plus the two outer roads.
  const lines = [];
  for (let i = 0; i < WORLD.blocks - 1; i++) {
    lines.push((i - 4) * WORLD.pitch + WORLD.blockSize / 2 + WORLD.roadWidth / 2);
  }
  lines.push(-(half - WORLD.roadWidth / 2), half - WORLD.roadWidth / 2);
  for (const l of lines) {
    const ns = new THREE.Mesh(new THREE.BoxGeometry(WORLD.roadWidth, 0.12, half * 2), roadMat);
    ns.position.set(l, 0.06, 0);
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.12, WORLD.roadWidth), roadMat);
    ew.position.set(0, 0.06, l);
    group.add(ew);
    // Sidewalk edging along each road.
    const sw1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.16, half * 2), walkMat);
    sw1.position.set(l - WORLD.roadWidth / 2 - 1, 0.08, 0);
    group.add(sw1);
    const sw2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.16, half * 2), walkMat);
    sw2.position.set(l + WORLD.roadWidth / 2 + 1, 0.08, 0);
    group.add(sw2);
  }

  // --- blocks -----------------------------------------------------------------
  // Special blocks: park at the centre, casino tower north-west,
  // dockyard on the east edge (two blocks), the rest are built up.
  const parkBlock = { i: 4, j: 4 };
  const casinoBlock = { i: 2, j: 2 };
  const dockBlocks = [{ i: 8, j: 3 }, { i: 8, j: 4 }, { i: 8, j: 5 }];
  const isDock = (i, j) => dockBlocks.some((b) => b.i === i && b.j === j);

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x44484e });
  const lampGlow = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9900 });

  function addLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
    pole.position.set(x, 3, z);
    group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampGlow);
    bulb.position.set(x, 6.1, z);
    group.add(bulb);
  }

  function addPalm(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6b46 }),
    );
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x2f8f3a }),
    );
    leaves.position.set(x, 7.6, z);
    group.add(leaves);
  }

  for (let i = 0; i < WORLD.blocks; i++) {
    for (let j = 0; j < WORLD.blocks; j++) {
      const cx = (i - 4) * WORLD.pitch;
      const cz = (j - 4) * WORLD.pitch;
      if (i === parkBlock.i && j === parkBlock.j) {
        // Central park: grass, fountain, trees.
        const grass = box(WORLD.blockSize, 0.24, WORLD.blockSize, PALETTE.grass, cx, 0.12, cz);
        group.add(grass);
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(6, 6.6, 1.2, 16),
          new THREE.MeshLambertMaterial({ color: 0xb9c4c9 }),
        );
        basin.position.set(cx, 0.6, cz);
        group.add(basin);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(5.4, 5.4, 0.4, 16),
          new THREE.MeshLambertMaterial({ color: 0x4db2d8 }),
        );
        water.position.set(cx, 1.1, cz);
        group.add(water);
        for (let t = 0; t < 8; t++) {
          addPalm(cx + rng.range(-14, 14), cz + rng.range(-14, 14));
        }
        continue;
      }
      if (i === casinoBlock.i && j === casinoBlock.j) {
        // Casino tower with a neon sign band.
        const tower = makeBuilding(rng, facades, cx, cz, 26, 26, WORLD.maxTower);
        group.add(tower);
        colliders.push({ minX: cx - 13, maxX: cx + 13, minZ: cz - 13, maxZ: cz + 13 });
        const sign = box(27, 3, 1.2, 0xff4fa3, cx, 58, cz + 13.4);
        const signMat = new THREE.MeshLambertMaterial({ color: 0xff4fa3, emissive: 0xaa2266 });
        sign.material = signMat;
        group.add(sign);
        continue;
      }
      if (isDock(i, j)) {
        // Dockyard: containers and a pier, no random buildings.
        const yard = box(WORLD.blockSize, 0.24, WORLD.blockSize, 0x6a6f75, cx, 0.12, cz);
        group.add(yard);
        const cols = [0x2e6fc2, 0xc23b2e, 0xe8b93a, 0x3aa655];
        for (let c = 0; c < 5; c++) {
          const w = rng.range(6, 10);
          const h = rng.range(2.6, 3.4);
          const px = cx + rng.range(-11, 11);
          const pz = cz + rng.range(-11, 11);
          const cont = box(w, h, 2.6, cols[c % cols.length], px, h / 2 + 0.2, pz);
          cont.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
          group.add(cont);
          const r = cont.rotation.y === 0 ? { minX: px - w / 2, maxX: px + w / 2, minZ: pz - 1.3, maxZ: pz + 1.3 }
            : { minX: px - 1.3, maxX: px + 1.3, minZ: pz - w / 2, maxZ: pz + w / 2 };
          colliders.push(r);
        }
        continue;
      }
      // Ordinary block: one to three buildings.
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const w = rng.range(10, 18);
        const d = rng.range(10, 18);
        const h = rng.range(9, 38);
        const px = cx + rng.range(-8, 8);
        const pz = cz + rng.range(-8, 8);
        const building = makeBuilding(rng, facades, px, pz, w, d, h);
        group.add(building);
        colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
      }
    }
  }

  // Pier reaching into the sea from the dock.
  const pierX = half + WORLD.beachWidth + 14;
  const pier = box(30, 1, 8, 0x8a6b46, pierX, 0.5, 0);
  group.add(pier);
  colliders.push({ minX: pierX - 15, maxX: pierX + 15, minZ: -4, maxZ: 4 });

  // Palms along the beach and lamps along the roads.
  for (let z = -half + 10; z < half; z += 34) {
    addPalm(half + WORLD.beachWidth / 2 + rng.range(-4, 4), z + rng.range(-6, 6));
  }
  for (const l of lines) {
    for (let t = -half + 20; t < half; t += 70) {
      addLamp(l + WORLD.roadWidth / 2 + 2.5, t);
    }
  }

  // Named places the missions and staging use.
  const places = {
    spawn: { x: 0, z: 60 },
    casino: { x: (casinoBlock.i - 4) * WORLD.pitch, z: (casinoBlock.j - 4) * WORLD.pitch },
    park: { x: 0, z: 0 },
    dock: { x: (8 - 4) * WORLD.pitch, z: 0 },
    pierEnd: { x: pierX + 12, z: 0 },
    beach: { x: half + WORLD.beachWidth / 2, z: 40 },
  };

  return { group, colliders, roadLines: lines, places, sea };
}

// Push a circle (hero or car) out of every building box it overlaps.
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
}
