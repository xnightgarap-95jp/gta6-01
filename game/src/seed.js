// Coral Keys — deterministic seeded random numbers.
//
// The city, the traffic and the pedestrians are all laid out from one
// seed, so the same seed always builds the same Coral Keys. The game
// reads its seed from `?seed=` (default 1); screenshots always use seed 1.

// mulberry32: a small, fast, well-behaved seeded PRNG.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDice(seed) {
  const next = makeRng(seed);
  return {
    // Float in [0, 1).
    float: () => next(),
    // Float in [min, max).
    range: (min, max) => min + next() * (max - min),
    // Integer in [min, max] inclusive.
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    // One element of an array.
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // True with the given probability.
    chance: (p) => next() < p,
  };
}
