// Coral Keys — the five missions for fixer Eddie Marlow.
//
// Dana Cole is new in Coral Keys and owes Eddie a favour. Each mission
// is a short chain of steps: go somewhere, steal a car, lose the cops,
// deliver a package, clear out guards. A 3D beacon marks the current
// objective, the HUD shows the distance, and finishing a mission pays
// cash and saves the game. After the fifth, the job-done screen appears.

import * as THREE from '../vendor/three.module.min.js';
import { blockCentre } from './city.js';
import { WORLD } from './settings.js';

// Mission steps, written against landmarks the city already builds.
// Positions are computed from the block grid so the missions always
// land on real streets.
function missionList(city) {
  const L = city.landmarks;
  const garage = { x: blockCentre(7), z: blockCentre(8) };
  const northRoad = { x: 0, z: blockCentre(0) };
  return [
    {
      name: 'Borrowed Wheels',
      brief: 'Eddie needs wheels. Steal any car and bring it to the garage.',
      pay: 250,
      steps: [
        { type: 'steal', text: 'Steal a car (walk up and press E)', target: northRoad },
        { type: 'goto', text: 'Drive it to Eddie\'s garage', target: garage, radius: 10 },
      ],
    },
    {
      name: 'Courier Run',
      brief: 'A package for the casino. Pick it up at the park, deliver it to the casino — fast.',
      pay: 400,
      steps: [
        { type: 'goto', text: 'Pick up the package at the park', target: L.park, radius: 8 },
        { type: 'goto', text: 'Deliver it to the casino tower', target: L.casino, radius: 12 },
      ],
    },
    {
      name: 'Hot Pursuit',
      brief: 'The cops are onto Eddie\'s crew. Get 2 wanted stars, then lose them.',
      pay: 550,
      steps: [
        { type: 'heat', text: 'Get the cops after you (steal a car or start a fight)', stars: 2 },
        { type: 'hide', text: 'Lose the heat — stay out of trouble until the stars clear', seconds: 6 },
      ],
    },
    {
      name: 'Dockside Exchange',
      brief: 'A deal at the docks went bad. Clear the guards, then grab the case on the pier.',
      pay: 800,
      steps: [
        { type: 'clear', text: 'Clear the guards at the dockyard', target: L.dock, guards: 3 },
        { type: 'goto', text: 'Grab the case on the pier', target: L.pier, radius: 8 },
      ],
    },
    {
      name: 'The Big Take',
      brief: 'One last job: hit the beach meet, grab the money, and get back to the garage.',
      pay: 1500,
      steps: [
        { type: 'goto', text: 'Meet the contact on the beach', target: L.beach, radius: 9 },
        { type: 'clear', text: 'Deal with the ambush guards', target: L.beach, guards: 4 },
        { type: 'goto', text: 'Bring the money back to the garage', target: garage, radius: 10 },
      ],
    },
  ];
}

export class Quests {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.missions = missionList(city);
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.hideTimer = 0;
    this.finished = false;
    this.justPaid = 0;
    // Objective beacon: a glowing cylinder + a light pillar.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 20), beaconMat);
    this.beacon.position.y = 0.3;
    this.beacon.name = 'objective-beacon';
    scene.add(this.beacon);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true), pillarMat);
    this.pillar.position.y = 30;
    this.pillar.name = 'objective-pillar';
    scene.add(this.pillar);
    this.moveBeacon();
  }

  current() {
    return this.missions[this.missionIndex] ?? null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] ?? null : null;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return this.finished ? 'All jobs done — Coral Keys is yours.' : '';
    const s = this.currentStep();
    return `${m.name}: ${s ? s.text : ''}`;
  }

  objectiveTarget() {
    const s = this.currentStep();
    return s?.target ?? null;
  }

  moveBeacon() {
    const t = this.objectiveTarget();
    if (!t) {
      this.beacon.visible = false;
      this.pillar.visible = false;
      return;
    }
    this.beacon.visible = true;
    this.pillar.visible = true;
    this.beacon.position.x = t.x;
    this.beacon.position.z = t.z;
    this.pillar.position.x = t.x;
    this.pillar.position.z = t.z;
  }

  advance() {
    const m = this.current();
    if (!m) return;
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      // Mission complete: pay up and move on.
      this.justPaid = m.pay;
      this.missionIndex += 1;
      this.stepIndex = 0;
      if (this.missionIndex >= this.missions.length) {
        this.finished = true;
        this.beacon.visible = false;
        this.pillar.visible = false;
        return;
      }
    }
    this.hideTimer = 0;
    this.moveBeacon();
  }

  // Called every frame with the live game state. Returns events the
  // boot loop should act on: 'paid' (with amount) or 'all-done'.
  update(ctx) {
    const step = this.currentStep();
    if (!step) return null;
    const heroPos = ctx.heroPos;
    const dist = step.target ? Math.hypot(step.target.x - heroPos.x, step.target.z - heroPos.z) : Infinity;
    if (step.type === 'goto') {
      if (dist < (step.radius ?? 8)) {
        this.advance();
        return this.afterAdvance();
      }
    } else if (step.type === 'steal') {
      if (ctx.inCar) {
        this.advance();
        return this.afterAdvance();
      }
    } else if (step.type === 'heat') {
      if (ctx.stars >= step.stars) {
        this.advance();
        return this.afterAdvance();
      }
    } else if (step.type === 'hide') {
      if (ctx.stars === 0) {
        this.hideTimer += ctx.dt;
        if (this.hideTimer >= step.seconds) {
          this.advance();
          return this.afterAdvance();
        }
      } else {
        this.hideTimer = 0;
      }
    } else if (step.type === 'clear') {
      if (ctx.enemiesAlive === 0 && step.guardsSpawned) {
        this.advance();
        return this.afterAdvance();
      }
    }
    return null;
  }

  afterAdvance() {
    if (this.finished) return { type: 'all-done', pay: this.justPaid };
    if (this.justPaid) {
      const pay = this.justPaid;
      this.justPaid = 0;
      return { type: 'paid', pay };
    }
    return { type: 'step' };
  }

  // Spawn the guards a 'clear' step needs, once, at its target.
  ensureGuards(combat) {
    const step = this.currentStep();
    if (!step || step.type !== 'clear' || step.guardsSpawned) return false;
    step.guardsSpawned = true;
    const t = step.target;
    const n = step.guards ?? 3;
    // Guards hold the near side of the objective, in a loose line so
    // the player meets them before the containers swallow the view.
    for (let i = 0; i < n; i++) {
      const x = t.x + (i - (n - 1) / 2) * 4.5;
      const z = t.z - 7 - (i % 2) * 3;
      combat.spawnEnemy(x, z);
    }
    return true;
  }

  // Serialisable progress for the save file.
  saveState() {
    return { missionIndex: this.missionIndex, stepIndex: this.stepIndex, finished: this.finished };
  }

  // Remove the beacon meshes when a fresh run replaces this instance.
  dispose() {
    this.scene.remove(this.beacon);
    this.scene.remove(this.pillar);
  }

  loadState(s) {
    if (!s) return;
    this.missionIndex = Math.min(s.missionIndex ?? 0, this.missions.length - 1);
    this.stepIndex = s.stepIndex ?? 0;
    this.finished = !!s.finished;
    if (this.finished) {
      this.beacon.visible = false;
      this.pillar.visible = false;
    } else {
      this.moveBeacon();
    }
  }
}
