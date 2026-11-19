// Coral Keys — shared tuning numbers.
//
// Every module reads its numbers from here so the city, the cars, the
// police and the missions all agree on the same world. Nothing in this
// file needs three.js, so it can be read by any tool without a browser.

export const WORLD = {
  blocks: 9, // blocks across and down
  blockSize: 34, // metres of building ground per block
  roadWidth: 12, // metres of asphalt between blocks
  get pitch() {
    return this.blockSize + this.roadWidth;
  },
  // Half the width of the whole built-up area, roads included.
  get half() {
    return (this.blocks * this.pitch + this.roadWidth) / 2;
  },
  // The beach strip starts here (east edge) and the sea beyond it.
  beachWidth: 26,
  seaWidth: 120,
};

export const HERO = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  jumpSpeed: 8,
  gravity: 22,
};

export const CAR = {
  accel: 18,
  brake: 32,
  reverseAccel: 11,
  maxSpeed: 36,
  maxReverse: 11,
  steer: 2.0,
  grip: 0.9,
  handbrakeGrip: 0.62,
  // How close the hero must be to steal a parked or traffic car.
  stealRange: 3.4,
};

export const HEAT = {
  maxStars: 5,
  hideDelay: 14, // seconds unseen before stars start to fall
  hideStep: 6, // seconds per star lost while hidden
  // Cruisers on the road at each star level.
  cruisersFor(stars) {
    return [0, 1, 2, 3, 4, 6][stars] ?? 0;
  },
  arrestRange: 2.6,
  arrestTime: 2.2, // seconds a cruiser must sit on the player to bust them
};

export const FIGHT = {
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 90,
  punchDamage: 12,
  punchRange: 2.4,
  enemyHealth: 70,
  enemyShootRange: 42,
  enemyShootDelay: 1.4,
};

export const CONTROLS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  run: 'ShiftLeft',
  enterCar: 'KeyE',
  punch: 'KeyF',
  reload: 'KeyR',
  handbrake: 'Space',
  camera: 'KeyC',
  weaponFists: 'Digit1',
  weaponPistol: 'Digit2',
  pause: 'KeyP',
  resetCar: 'KeyT',
};

export const SAVE_KEY = 'coral-keys-save-v2';

export const PALETTE = {
  sky: 0x8ec9e8,
  sea: 0x1f7fa8,
  sand: 0xe8d5a3,
  asphalt: 0x33363b,
  sidewalk: 0x9a9a92,
  grass: 0x4f9e4d,
  building: [0xb8a88a, 0x9aa7b8, 0xc49a7a, 0x8fa3a0, 0xd0b49a, 0xa89ac0],
  windowLit: 0xffd97a,
  windowDark: 0x2c3a4a,
};
