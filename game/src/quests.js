// Coral Keys — missions for fixer Eddie Marlow.
//
// Five jobs, played in order. Each mission is a list of steps; a step
// is done by reaching a marker, stealing a car, delivering something,
// losing the police, or clearing the guards at the docks. A glowing
// beacon marks the current objective in the world, and the HUD shows
// the objective text and the distance to it.

import * as THREE from 'three';
import { playCash, playPickup } from './sound.js';

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return group;
}

const MISSIONS = [
  {
    name: 'Borrowed Wheels',
    briefing: 'Eddie needs a car. Steal any car and bring it to the garage marker.',
    reward: 250,
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', at: { x: -23, z: 92 }, text: 'Drive the car to the garage' },
    ],
  },
  {
    name: 'Courier Run',
    briefing: 'A package for the casino. Pick it up at the park, then deliver it fast.',
    reward: 400,
    steps: [
      { kind: 'goto', at: { x: 0, z: 0 }, text: 'Pick up the package at the park' },
      { kind: 'goto', at: { x: -92, z: -92 }, text: 'Deliver the package to the casino' },
    ],
  },
  {
    name: 'Hot Pursuit',
    briefing: 'Eddie wants heat. Get a 2-star wanted level, then lose the cops.',
    reward: 500,
    steps: [
      { kind: 'wanted', stars: 2, text: 'Raise your wanted level to 2 stars (steal a car or shoot)' },
      { kind: 'lose', text: 'Lose the cops — stay out of sight until the stars fall' },
    ],
  },
  {
    name: 'Dockside Exchange',
    briefing: 'Guards are holding a case on the pier. Clear them out and grab it.',
    reward: 750,
    steps: [
      { kind: 'goto', at: { x: 184, z: 0 }, text: 'Reach the dockyard' },
      { kind: 'clear', text: 'Clear out the dock guards' },
      { kind: 'goto', at: { x: 236, z: 0 }, text: 'Grab the case at the end of the pier' },
    ],
  },
  {
    name: 'The Big Take',
    briefing: 'The beach meet. Grab the money at the beach and bring it home.',
    reward: 1200,
    steps: [
      { kind: 'goto', at: { x: 222, z: 40 }, text: 'Reach the beach meet' },
      { kind: 'goto', at: { x: 0, z: 60 }, text: 'Bring the money back to the hideout' },
    ],
  },
];

export function makeQuests(scene) {
  return {
    missions: MISSIONS,
    index: 0,
    step: 0,
    done: false,
    beacon: makeBeacon(scene),
    stepDoneFlash: 0,
  };
}

export function currentMission(q) {
  return q.missions[q.index];
}

export function currentStep(q) {
  const m = currentMission(q);
  return m ? m.steps[q.step] : null;
}

export function missionObjectiveText(q) {
  if (q.done) return 'All jobs done — Coral Keys is yours.';
  const m = currentMission(q);
  const s = currentStep(q);
  return `${m.name}: ${s.text}`;
}

export function missionTarget(q) {
  const s = currentStep(q);
  if (!s) return null;
  if (s.kind === 'goto') return s.at;
  return null;
}

// Advance the mission state machine. `world` carries the live facts:
// player position, whether the player is in a car, stars, guards left.
// Returns 'mission' when a whole mission completes, 'step' when one
// step completes, otherwise null.
export function updateQuests(q, world, onReward) {
  if (q.done) return null;
  const m = currentMission(q);
  const s = currentStep(q);
  if (!s) return null;
  let advanced = false;
  if (s.kind === 'goto') {
    const d = Math.hypot(world.player.x - s.at.x, world.player.z - s.at.z);
    if (d < 6) {
      advanced = true;
      playPickup();
    }
  } else if (s.kind === 'steal') {
    if (world.inCar) {
      advanced = true;
      playPickup();
    }
  } else if (s.kind === 'wanted') {
    if (world.stars >= s.stars) advanced = true;
  } else if (s.kind === 'lose') {
    if (world.stars === 0) {
      advanced = true;
      playCash();
    }
  } else if (s.kind === 'clear') {
    if (world.guardsLeft === 0) {
      advanced = true;
      playCash();
    }
  }
  if (!advanced) return null;
  q.step++;
  q.stepDoneFlash = 1.2;
  if (q.step >= m.steps.length) {
    // Mission complete: pay out and move to the next job.
    if (onReward) onReward(m.reward);
    q.index++;
    q.step = 0;
    if (q.index >= q.missions.length) {
      q.done = true;
      q.beacon.visible = false;
      return 'mission';
    }
    return 'mission';
  }
  return 'step';
}

// Move the beacon to the current goto target (or hide it).
export function updateBeacon(q, world) {
  const target = missionTarget(q);
  if (target && !q.done) {
    q.beacon.visible = true;
    q.beacon.position.set(target.x, 0, target.z);
    q.beacon.rotation.y += 0.02;
  } else {
    q.beacon.visible = false;
  }
  if (q.stepDoneFlash > 0) q.stepDoneFlash -= 0.016;
}

export function disposeQuests(scene, q) {
  scene.remove(q.beacon);
}
