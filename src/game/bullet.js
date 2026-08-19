// Geschosse (Spec Abschnitt 4: Geschosse).
//
// Grundsteinumbau Phase 1: Bandenschuss vollstaendig entfernt. Ein Geschoss
// bewegt sich geradlinig mit konstanter Geschwindigkeit und stirbt am
// ERSTEN Wandkontakt -- bei niemandem mehr ein Abpraller, egal ob Spieler
// oder Gegner. Die einzige verbleibende Ausnahme ist die Reflexion durch
// Frontpanzerung (E3, armor.js: reflectBullet()): eine zurueckgeworfene
// Kugel fliegt einfach bis zur naechsten Wand und stirbt dort -- das ergibt
// sich jetzt automatisch aus der generischen "jede Wand toetet"-Regel, ohne
// eigenen Sonderfall. Die Bewegung wird weiterhin pro Achse aufgeloest.

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
    crit,
    pierce,
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
    kind: kind || 'bullet', // 'bullet' | 'rocket'
    tungsten: tungsten || false, // Wolframkern-Upgrade (Spec Abschnitt 8)
    explosive: explosive || false, // explodiert beim Tod
    detonateOnWall: detonateOnWall || false, // an der Wand zuenden statt zu sterben
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
    // Kritischer Treffer (UMBAUPLAN-LP Phase 7): beim Abschuss ausgewuerfelt
    // (tank.js), traegt der Aufschlag beim Treffer den balance.crit.mult.
    // Wie damage/damageType am Geschoss eingefroren, nicht beim Treffer neu
    // gewuerfelt -- eine Kugel, die mehrere Ziele streift, bleibt kritisch
    // oder nicht.
    crit: crit || false,
    // Durchschlag (Nekromant-V2 Phase 2): Anzahl zusaetzlicher Ziele, die
    // dieses Geschoss durchschlaegt, OHNE zu sterben -- zaehlt beim Treffer
    // herunter (state.js). NICHT zu verwechseln mit dem aelteren,
    // archivierten phaseWalls-Feld weiter unten (das ignoriert WAENDE, nicht
    // Ziele -- beide heissen im Deutschen "Durchschlag", sind aber getrennte
    // Mechaniken). pierceHits (Set, lazy angelegt in state.js) verhindert,
    // dass dasselbe Ziel zweimal getroffen wird.
    pierce: pierce || 0,
    pierceHits: null,
    detonated: false,
    // Aasgeier (state.js: killTank): true = zaehlt nicht mehr gegen das
    // Magazin des Schuetzen, fliegt und toetet aber normal weiter.
    magFreed: false,
    owner, // Referenz auf den Schuetzen (fuer den Selbst-Immunitaets-Schutz)
    age: 0, // s seit Abschuss
    distance: 0, // px zurueckgelegter Weg (E4: Wegbudget statt Zeit)
    reflected: false, // von einer Panzerung zurueckgeworfen (E3) -- einzige
    // verbleibende Quelle einer fuer den eigenen Schuetzen gefaehrlichen
    // Kugel, siehe armor.js: isLive().
    reflectImmune: null, // Panzer, der sie zurueckwarf (kurz unverwundbar)
    reflectImmuneT: 0, // Restzeit dieses Fensters
    dead: false,
    trail: [], // letzte Positionen, nur fuers Debug-Overlay
  };
}

// Bewegt das Geschoss auf einer Achse; jeder Wandkontakt ist toedlich.
// Wolframkern (Spec Abschnitt 8): trifft ein Wolfram-Geschoss eine
// zerstoerbare Wand, wird die Wand zerstoert und das Geschoss fliegt
// unbeschadet weiter (kein Wandkontakt im Sinne dieser Funktion).
// Gibt { hit } zurueck.
function moveAxis(b, state, axis, dt) {
  b[axis] += (axis === 'x' ? b.vx : b.vy) * dt;
  if (b.phaseWalls) return { hit: false }; // Durchschlag: ignoriert alle Waende
  let hit = false;
  // Laserbarriere (Phase 15): blockt NUR Geschosse, nie Panzer -- deshalb
  // ein eigenes Array statt eines Eintrags in state.walls (das wuerde auch
  // die Panzerkollision (tank.js: resolveCircleWalls) treffen).
  for (const wall of [...state.walls, ...(state.laserWalls || [])]) {
    if (wall.type === 'hole') continue; // Geschosse fliegen ueber Loecher
    if (!circleOverlapsAABB(b.x, b.y, b.radius, wall)) continue;
    // Wolframkern: reisst zerstoerbare Waende ein und fliegt WEITER (bis zur
    // Nutzer-Balancerunde verschwand das Geschoss dabei). Kein b.dead --
    // die Zelle ist nach dem Treffer ja offen. `continue` statt `return`,
    // damit im selben Schritt auch eine zweite Wand fallen kann.
    // `destructible` (Phase 11) zaehlt hier mit: beides sind Waende, die
    // eingerissen werden koennen.
    if (b.tungsten && (wall.type === 'breakable' || wall.type === 'destructible')) {
      state.destroyWall?.(wall);
      continue;
    }
    // Sperrmauer (Phase 6) und zerstoerbare Waende (Phase 11): nehmen
    // Schaden wie jede andere Wand-Haltbarkeit (destroyWall zaehlt
    // wall.customDurability/destructibleHits runter). Das Geschoss selbst
    // stirbt trotzdem am Kontakt -- kein Sonderfall mehr noetig.
    if (wall.type === 'trap' || wall.type === 'destructible') state.destroyWall?.(wall);
    // Reaktor-Generator (Grundsteinumbau, Bosse aktuell Platzhalter):
    // die alte "nur ein Bankshot beschaedigt ihn"-Bedingung ist mit dem
    // Wegfall des Bandenschusses gegenstandslos -- ein Generator verhaelt
    // sich bis zum Bossneubau wie eine normale, unzerstoerbare Wand. Siehe
    // CLAUDE.md ("Bosse (Platzhalter, Nutzerentscheidung)") und ARCHIV.md.
    hit = true;
    if (axis === 'x') {
      b.x = b.vx > 0 ? wall.x - b.radius : wall.x + wall.w + b.radius;
      b.vx = -b.vx;
    } else {
      b.y = b.vy > 0 ? wall.y - b.radius : wall.y + wall.h + b.radius;
      b.vy = -b.vy;
    }
  }
  return { hit };
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
// Grundsteinumbau Phase 1: kein Abpraller-Vorgriff mehr -- die Kugel stirbt
// wie im echten Spiel am ersten Wandkontakt, die Vorschau zeigt also nur
// noch die gerade Strecke bis dahin. Gibt Wegpunkte zurueck: [{x,y}].
export function traceTrajectory(state, x, y, angle, cfg, opts = {}) {
  const steps = opts.steps ?? 240; // Sicherheitslimit (~4 s bei 60 Hz)
  const dt = opts.dt ?? 1 / 60;
  const b = createBullet(x, y, angle, {
    speed: cfg.bulletSpeed,
    radius: cfg.bulletRadius,
    owner: null,
    kind: 'bullet',
    phaseWalls: cfg.phaseWalls || false,
    burstDistance: cfg.burstRangePx || 0,
  });
  const shadow = { walls: state.walls, laserWalls: state.laserWalls, data: state.data, tanks: [] };
  const pts = [{ x, y }];
  for (let i = 0; i < steps; i++) {
    updateBullet(b, shadow, dt);
    pts.push({ x: b.x, y: b.y });
    if (b.dead) break;
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

  // Grundsteinumbau Phase 1: kein Bandenschuss mehr -- jeder Wandkontakt
  // toetet das Geschoss sofort, auch eine gerade erst reflektierte (E3)
  // Kugel. Optional-Chaining wie zuvor: der Ziellinien-Schattenzustand
  // (traceTrajectory) traegt kein `sounds`, bleibt also nebenwirkungsfrei.
  if (hitX.hit || hitY.hit) {
    state.sounds?.push({ name: 'bounce', x: b.x });
    b.dead = true;
    return;
  }

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > TRAIL_MAX) b.trail.shift();
}
