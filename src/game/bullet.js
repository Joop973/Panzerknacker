// Geschosse + Abpraller-Physik (Spec Abschnitt 4: Geschosse).
//
// Bewegung geradlinig mit konstanter Geschwindigkeit. Wandkontakt:
// Reflexion an der Normalen der getroffenen Flaeche. Die Bewegung wird
// pro Achse aufgeloest -- trifft ein Geschoss im selben Schritt auf
// beiden Achsen (Eckenfall), wird auf beiden Achsen reflektiert und
// trotzdem nur EIN Abpraller abgezogen.

import { circleOverlapsAABB } from './collision.js';
import { WIDTH, HEIGHT } from '../config.js';

const TRAIL_MAX = 60; // Ticks Bahnhistorie fuers Debug-Overlay

let nextId = 1;

export function createBullet(
  x,
  y,
  angle,
  {
    speed,
    radius,
    ricochets,
    owner,
    kind,
    tungsten,
    explosive,
    detonateOnWall,
    explosionRadius,
    phaseWalls,
    homing,
    friendly,
    burstDistance,
    damage,
    damageType,
  },
) {
  return {
    id: nextId++,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    kind: kind || 'bullet', // 'bullet' | 'rocket' | 'bounce_rocket'
    tungsten: tungsten || false, // Wolframkern-Upgrade (Spec Abschnitt 8)
    explosive: explosive || false, // explodiert beim Tod
    detonateOnWall: detonateOnWall || false, // an der Wand zuenden statt abprallen
    explosionRadius: explosionRadius || 0,
    phaseWalls: phaseWalls || false, // Durchschlag-Upgrade
    homing: homing || 0, // Zielsucher: rad/s Lenkrate (0 = aus)
    friendly: friendly || false, // trifft den eigenen Besitzer NIE (Drohne/Splitter)
    burstDistance: burstDistance || 0, // Flak (Phase 18): zuendet nach kurzer Reichweite in der Luft, unabhaengig von Wand-/Zielkontakt
    // Schaden dieses Geschosses (UMBAUPLAN-LP Phase 1). Wird vom Erzeuger
    // mitgegeben (cfg.damage des Schuetzen), nicht beim Treffer aus dem
    // Besitzer gelesen: ein Geschoss soll den Wert tragen, der beim ABSCHUSS
    // galt -- sonst wuerde eine Kugel, die noch fliegt, waehrend ihr
    // Besitzer stirbt oder ein Upgrade bekommt, rueckwirkend anders treffen.
    damage: damage ?? 1,
    // Schadenstyp (Phase 6) -- wie damage beim Abschuss eingefroren.
    damageType: damageType || 'physical',
    detonated: false,
    // Aasgeier (state.js: killTank): true = zaehlt nicht mehr gegen das
    // Magazin des Schuetzen, fliegt und toetet aber normal weiter.
    magFreed: false,
    ricochetsLeft: ricochets,
    ricochetsStart: ricochets, // fuer "Abpraller-Kill"-Feedback
    owner, // Referenz auf den Schuetzen (fuer den 80-ms-Schutz)
    age: 0, // s seit Abschuss
    distance: 0, // px zurueckgelegter Weg (E4: Wegbudget statt Zeit)
    wallBounces: 0, // Abpraller an WAENDEN (Phase 4: zaehlt fuer Prisma)
    reflected: false, // von einer Panzerung zurueckgeworfen (E3)
    reflectImmune: null, // Panzer, der sie zurueckwarf (kurz unverwundbar)
    reflectImmuneT: 0, // Restzeit dieses Fensters
    dead: false,
    trail: [], // letzte Positionen, nur fuers Debug-Overlay
  };
}

// Bewegt das Geschoss auf einer Achse und reflektiert an Waenden.
// Wolframkern (Spec Abschnitt 8): trifft ein Wolfram-Geschoss eine
// zerstoerbare Wand, wird die Wand zerstoert und das Geschoss
// verschwindet; solid-Waende bleiben normale Abpraller.
// Gibt { hit, mirror } zurueck -- mirror markiert einen Treffer auf einer
// Spiegelwand (Phase 5: kostet keinen Abpraller, siehe updateBullet).
function moveAxis(b, state, axis, dt) {
  b[axis] += (axis === 'x' ? b.vx : b.vy) * dt;
  if (b.phaseWalls) return { hit: false, mirror: false }; // Durchschlag: ignoriert alle Waende
  let hit = false;
  let mirror = false;
  // Laserbarriere (Phase 15): blockt NUR Geschosse, nie Panzer -- deshalb
  // ein eigenes Array statt eines Eintrags in state.walls (das wuerde auch
  // die Panzerkollision (tank.js: resolveCircleWalls) treffen).
  for (const wall of [...state.walls, ...(state.laserWalls || [])]) {
    if (wall.type === 'hole') continue; // Geschosse fliegen ueber Loecher
    if (!circleOverlapsAABB(b.x, b.y, b.radius, wall)) continue;
    // Wolframkern: reisst zerstoerbare Waende ein und fliegt WEITER (bis zur
    // Nutzer-Balancerunde verschwand das Geschoss dabei). Kein b.dead und
    // kein Abpraller -- die Zelle ist nach dem Treffer ja offen. `continue`
    // statt `return`, damit im selben Schritt auch eine zweite Wand fallen
    // kann. `destructible` (Phase 11) zaehlt hier mit: beides sind Waende,
    // die eingerissen werden koennen.
    if (b.tungsten && (wall.type === 'breakable' || wall.type === 'destructible')) {
      state.destroyWall?.(wall);
      continue;
    }
    // Sprengmunition/Glaskanone: zuenden am Wandkontakt (statt
    // abzuprallen) -- so toetet die Explosion durch die Wand. Die
    // Sprengschuss-Salve hat detonateOnWall=false und prallt ab.
    if (b.explosive && b.detonateOnWall) {
      b.dead = true;
      return { hit: true, mirror: false };
    }
    // Sekundärslot "Sperrmauer" (Phase 6) und zerstoerbare Waende (Phase 11):
    // nehmen Schaden wie jede andere Wand-Haltbarkeit (destroyWall zaehlt
    // wall.customDurability/destructibleHits runter), prallen aber wie eine
    // normale Wand ab, bis sie zerbrechen -- daher KEIN return hier, faellt
    // in die generische Bounce-Behandlung durch. Optional-Chaining, weil der
    // Ziellinien-Schattenzustand (traceTrajectory) kein destroyWall traegt --
    // die Vorschau prallt dann einfach ab, ohne die Wand zu beschaedigen.
    if (wall.type === 'trap' || wall.type === 'destructible') state.destroyWall?.(wall);
    // Reaktor-Generator (Phase 14): nimmt NUR Schaden, wenn die Kugel schon
    // an einer WAND abgeprallt ist ("Bankshot") -- ein direkter Treffer
    // prallt wirkungslos ab wie an jeder anderen Wand. b.wallBounces zaehlt
    // hier noch den Stand VOR diesem Treffer (wird erst unten in
    // updateBullet() erhoeht), erfasst also genau "schon vorher abgeprallt".
    else if (wall.type === 'generator' && b.wallBounces > 0) state.destroyWall?.(wall);
    hit = true;
    if (wall.type === 'reflect') mirror = true; // Spiegelwand (Phase 5)
    if (axis === 'x') {
      b.x = b.vx > 0 ? wall.x - b.radius : wall.x + wall.w + b.radius;
      b.vx = -b.vx;
    } else {
      b.y = b.vy > 0 ? wall.y - b.radius : wall.y + wall.h + b.radius;
      b.vy = -b.vy;
    }
  }
  return { hit, mirror };
}

// Abprallschock-Upgrade (Phase 18, Welle 3): jeder WANDabpraller betaeubt
// Gegner im Umkreis kurz. Bewusst nur die Bewegung (stunTimer), nicht der
// Turm -- dieselbe Trennung wie bei Krallenfalle/Erschuetterungsdash; das
// Turm-Einfrieren bleibt der EMP-Mine vorbehalten (turretStunTimer).
// Im Ziellinien-Schattenzustand ist `tanks` leer und `owner` null -- die
// Vorschau loest also nie eine Betaeubung aus.
function applyBounceStun(b, state) {
  const R = b.owner?.cfg?.bounceStunRadius;
  if (!R) return;
  const dur = b.owner.cfg.bounceStunS || 0.5;
  let hit = false;
  for (const t of state.tanks || []) {
    if (!t.alive || t === b.owner) continue;
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    if (dx * dx + dy * dy <= R * R) {
      t.stunTimer = Math.max(t.stunTimer, dur);
      hit = true;
    }
  }
  if (hit) state.spawnParticles?.(b.x, b.y, '#8ecaf0', 6, 90);
}

// Lenkt ein Zielsucher-Geschoss weich zum naechsten gegnerischen Panzer.
function applyHoming(b, state, dt) {
  const owner = b.owner;
  let best = null;
  let bestD = Infinity;
  for (const t of state.tanks) {
    if (t === owner || !t.alive) continue;
    const d = (t.x - b.x) ** 2 + (t.y - b.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return;
  const speed = Math.hypot(b.vx, b.vy) || 1;
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  let diff = ((want - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  const step = Math.max(-b.homing * dt, Math.min(b.homing * dt, diff));
  const na = cur + step;
  b.vx = Math.cos(na) * speed;
  b.vy = Math.sin(na) * speed;
}

// Vorausberechnung der Flugbahn fuer die Ziellinie (Phase 0a).
//
// WICHTIG: Es wird bewusst dieselbe updateBullet()-Physik durchlaufen wie
// im Spiel -- keine zweite Berechnung, sonst driften Anzeige und Realitaet
// auseinander. Der Schattenzustand traegt nur Waende und data; ohne
// `sounds` und ohne `destroyWall` bleibt der Aufruf nebenwirkungsfrei
// (Wolframkern ist im Trace-Geschoss aus).
//
// Gibt Wegpunkte zurueck: [{x,y,bounce}] -- bounce=true markiert den
// Punkt, an dem das Geschoss zum ersten Mal abprallt.
export function traceTrajectory(state, x, y, angle, cfg, opts = {}) {
  const maxBounces = opts.maxBounces ?? 1; // erster Abpraller als Vorschau
  const steps = opts.steps ?? 240; // Sicherheitslimit (~4 s bei 60 Hz)
  const dt = opts.dt ?? 1 / 60;
  const b = createBullet(x, y, angle, {
    speed: cfg.bulletSpeed,
    radius: cfg.bulletRadius,
    ricochets: maxBounces,
    owner: null,
    kind: 'bullet',
    phaseWalls: cfg.phaseWalls || false,
    burstDistance: cfg.burstRangePx || 0,
  });
  const shadow = { walls: state.walls, laserWalls: state.laserWalls, data: state.data, tanks: [] };
  const tailSteps = opts.tailSteps ?? 45; // Laenge des Abpraller-Segments
  const pts = [{ x, y, bounce: false }];
  // Ueber wallBounces statt ricochetsLeft erkennen (Phase 5: eine
  // Spiegelwand aendert ricochetsLeft nicht, waere sonst unsichtbar
  // fuer die Vorschau).
  let left = b.wallBounces;
  let sinceBounce = -1; // -1 = noch nicht abgeprallt
  for (let i = 0; i < steps; i++) {
    updateBullet(b, shadow, dt);
    const bounced = b.wallBounces > left;
    left = b.wallBounces;
    pts.push({ x: b.x, y: b.y, bounce: bounced });
    if (b.dead) break;
    if (bounced && sinceBounce < 0) sinceBounce = 0;
    // Nach dem Abpraller nur noch ein kurzes Stueck als Vorschau zeigen.
    else if (sinceBounce >= 0 && ++sinceBounce >= tailSteps) break;
  }
  return pts;
}

export function updateBullet(b, state, dt) {
  if (b.dead) return;
  b.prevX = b.x;
  b.prevY = b.y;
  b.age += dt;
  if (b.reflectImmuneT > 0) b.reflectImmuneT = Math.max(0, b.reflectImmuneT - dt);


  if (b.homing > 0) applyHoming(b, state, dt);

  const sx = b.x;
  const sy = b.y;
  const hitX = moveAxis(b, state, 'x', dt);
  if (b.dead) return;
  const hitY = moveAxis(b, state, 'y', dt);
  if (b.dead) return;
  // Wegbudget (PLAN.md v2 E4): WEG statt Zeit -- ein doppelt so schneller
  // Powershot fliegt dadurch schneller, nicht weiter.
  b.distance += Math.hypot(b.x - sx, b.y - sy);
  // Flak (Phase 18): eigenes Physikverhalten -- zuendet in der Luft nach
  // einer viel kuerzeren Reichweite als das normale Wegbudget, unabhaengig
  // von Wandkontakt oder Treffer. Der Aufruf explodiert ueber das normale
  // "explosive"-Sterbe-Handling in state.js (b.dead + b.explosive).
  if (b.burstDistance && b.distance >= b.burstDistance) {
    b.dead = true;
    return;
  }
  if (b.distance >= state.data.balance.bullet.maxDistance) {
    b.dead = true;
    return;
  }

  // Durchschlag-Geschosse werden von keiner Wand gestoppt -> sonst
  // fliegen sie ewig. Sterben, sobald sie die Arena verlassen.
  if (b.phaseWalls && (b.x < 0 || b.x > WIDTH || b.y < 0 || b.y > HEIGHT)) {
    b.dead = true;
    return;
  }

  if (hitX.hit || hitY.hit) {
    const mirror = hitX.mirror || hitY.mirror;
    // Spiegelwand (Phase 5): reflektiert, ohne einen Abpraller zu
    // verbrauchen -- ABER nur, solange noch einer da ist. Eine Kugel mit
    // ricochetsLeft <= 0 (z. B. eine von Phase 4 reflektierte E3-Kugel)
    // stirbt auch an einer Spiegelwand, sonst wuerde E3s "stirbt beim
    // naechsten Wandkontakt" durch eine Spiegelwand ausgehebelt.
    if (mirror && b.ricochetsLeft > 0) {
      const firstBounce = b.wallBounces === 0;
      state.sounds?.push({ name: firstBounce ? 'tick' : 'bounce', x: b.x });
      b.wallBounces++;
      applyBounceStun(b, state); // Abprallschock (Phase 18) -- auch an Spiegelwaenden
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > TRAIL_MAX) b.trail.shift();
      return;
    }
    // Ein Wandkontakt pro Schritt kostet genau einen Abpraller --
    // auch im Eckenfall (hitX && hitY). Bei 0 verbleibenden
    // Abprallern verschwindet das Geschoss.
    if (b.ricochetsLeft <= 0) {
      state.sounds?.push({ name: 'bounce', x: b.x });
      b.dead = true;
      return;
    }
    // Der erste Abpraller macht die Kugel gefaehrlich (auch fuer den
    // Schuetzen) -> eigener kurzer Tick-Sound zum Telegraphieren.
    const firstBounce = b.ricochetsLeft === b.ricochetsStart;
    state.sounds?.push({ name: firstBounce ? 'tick' : 'bounce', x: b.x });
    b.ricochetsLeft--;
    b.wallBounces++; // nur WAND-Abpraller (Phase 4: toeten das Prisma)
    applyBounceStun(b, state); // Abprallschock (Phase 18)
  }

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > TRAIL_MAX) b.trail.shift();
}
