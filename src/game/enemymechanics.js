// Sondergegner-Tick-Funktionen (Gegner-Umbau G2/G3/G5/G7/G8): reine
// state.tanks-Durchlaeufe ohne jede Closure auf state.js-interne Locals --
// aus state.js ausgelagert (AUFTRAG-FERTIGSTELLUNG Phase A2), damit die
// Datei unter der ~300-Zeilen-Konvention bleibt. Jede Funktion nimmt `state`
// explizit als Parameter, genau wie zuvor.

import { CELL, COLS, ROWS } from '../config.js';
import { explodeAt } from './mine.js';
import { resolveTarget, clearLine } from './ai.js';
import { circlesOverlap } from './collision.js';
import { angleDelta } from './armor.js';

// G2 (t_dud): Blindgaenger-Todeszuender -- tickt state.deathFuses -- reine
// Zeitverzoegerung, danach ein normaler explodeAt()-Aufruf mit spare:null
// (trifft ausdruecklich auch andere Gegner, s. killTank()-Hook in state.js).
// Muster wie updateMines/updateMortars, aber bewusst KEIN eigenes Modul --
// das ganze Feature ist ein Array-Tick von wenigen Zeilen.
export function updateDeathFuses(state, dt) {
  if (!state.deathFuses.length) return;
  for (const f of state.deathFuses) {
    if (f.dead) continue;
    f.age += dt;
    if (f.age >= f.fuseS) {
      f.dead = true;
      explodeAt(state, f.x, f.y, f.radiusPx, null, { code: 'dud_blast', enemyType: 't_dud' }, f.damage);
    }
  }
  state.deathFuses = state.deathFuses.filter((f) => !f.dead);
}

// G7 (t_tether, "Der Kettenhund"): einmalige Bindung beim Raumaufbau (und
// erneut nach einem Wellen-2-Spawn, s. state.js: updateWave()) -- jeder noch
// ungebundene Kettenhund sucht den naechstgelegenen noch ungebundenen
// Verbuendeten, bevorzugt einen anderen Kettenhund (preferSameType). Die
// Bindung ist immer MUTUAL (beide Panzer zeigen aufeinander), rein
// geometrisch/deterministisch (kein RNG-Verbrauch). Nimmt den vollen
// Panzerbestand entgegen (nicht nur die neu gespawnten), damit ein bereits
// ueberlebender, unverbundener Welle-1-Kettenhund sich auch mit einem neu
// erschienenen Welle-2-Kettenhund binden kann.
export function bondTethers(tanks) {
  // Wer BRAUCHT eine Bindung: jeder Kettenhund ohne LEBENDEN Partner.
  // BUGFIX: die Pruefung geht ueber `?.alive` statt ueber die blosse Existenz
  // des Zeigers. updateTethers() raeumt beim Tod nur die LEBENDE Seite auf --
  // ein ueberlebender Partner behielt seinen Zeiger auf den toten Kettenhund
  // und galt damit fuer immer als "schon gebunden", war also fuer jeden
  // spaeter erscheinenden Welle-2-Kettenhund unerreichbar.
  const seekers = tanks.filter((t) => t.alive && t.cfg.tether && !t.tetherPartner?.alive);
  for (const t of seekers) {
    if (t.tetherPartner?.alive) continue; // wurde inzwischen von einem anderen Kandidaten gebunden
    let best = null;
    let bestD = Infinity;
    let bestSame = null;
    let bestSameD = Infinity;
    // Wer als PARTNER infrage kommt: JEDER lebende, noch ungebundene
    // Panzer -- nicht nur andere Kettenhunde. Ein Kettenhund ohne
    // gleichartigen Partner muss sich sonst an gar niemanden binden koennen
    // ("bevorzugt einen anderen Kettenhund" ist eine Praeferenz, kein
    // Zwang -- s. Designdokument Abschnitt 8.5).
    for (const o of tanks) {
      if (o === t || !o.alive || o.tetherPartner?.alive) continue;
      const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
      if (o.type === t.type && d < bestSameD) {
        bestSameD = d;
        bestSame = o;
      }
    }
    const partner = (t.cfg.tether.preferSameType && bestSame) || best;
    if (partner) {
      t.tetherPartner = partner;
      partner.tetherPartner = t;
    }
  }
}

// G7 (t_tether): Bindungspruefung (bricht DAUERHAFT bei Wandkontakt oder zu
// grossem Abstand -- kein Wiederverbinden) + die immer sichtbare Kette
// (Baustein B, G1). Eigene Funktion nach dem Muster updateMedics()/
// updateMasons() (G5) statt eines weiteren Sonderfalls im gemeinsamen
// G6-Aura-Reset-Durchlauf -- die Bindung ist ein reines Paarkonzept, kein
// Aura-/Ziel-bezogener Wert.
export function updateTethers(state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.tether || !t.tetherPartner) continue;
    const partner = t.tetherPartner;
    if (!partner.alive) {
      t.tetherPartner = null;
      continue;
    }
    const tc = t.cfg.tether;
    const dist = Math.hypot(partner.x - t.x, partner.y - t.y);
    const broken = dist > (tc.breakDistPx ?? 260) || (tc.breakOnWall && !clearLine(state, t.x, t.y, partner.x, partner.y));
    if (broken) {
      t.tetherPartner = null;
      partner.tetherPartner = null;
      continue;
    }
    // Nur EINMAL pro Paar pushen (nicht von beiden Seiten) -- feste
    // id-Ordnung statt eines zweiten "schon gezeichnet"-Sets.
    if (t.id < partner.id) {
      const flashing = state.time < (t.tetherFlashUntil || 0) || state.time < (partner.tetherFlashUntil || 0);
      state.tankLinks.push({
        x0: t.x,
        y0: t.y,
        x1: partner.x,
        y1: partner.y,
        color: flashing ? [230, 140, 70] : [140, 80, 40],
        width: flashing ? 5 : 3,
        baseAlpha: 0.8,
        pulseAlpha: 0.15,
        pulseHz: 1,
        dash: null,
      });
    }
  }
}

// G5 (t_medic, "Der Zehrer"): repariert dauerhaft GENAU EINEN Verbuendeten
// -- den am staerksten beschaedigten in Reichweite mit freier Sichtlinie.
// Bewusst KEIN eigenes Modul (Muster wie updateDeathFuses oben) -- der
// gesamte Mechanismus ist ein einziger Blick auf state.tanks je Tick.
// Telegraph laeuft ueber Baustein B (G1, state.tankLinks) -- kein neuer
// Renderer noetig, drawTankLinks() zeichnet den Heilstrahl generisch mit.
export function updateMedics(state, dt) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.heal) continue;
    const h = t.cfg.heal;
    // "Heilt nur echte Panzer, KEINE Geister" -- state.tanks enthaelt
    // ohnehin nie Geister (eigenes state.ghosts-Array), der Ausschluss
    // ergibt sich also strukturell. Er selbst und der Spieler kommen nicht
    // in Frage ("kann sich NICHT selbst heilen", der Spieler ist keine
    // eigene Fraktion in diesem Team-losen Spiel).
    let target = null;
    let bestDeficit = 0;
    for (const other of state.tanks) {
      if (other === t || other === state.player || !other.alive) continue;
      const deficit = other.cfg.maxHp - other.hp;
      if (deficit <= 0 || deficit <= bestDeficit) continue;
      const d = Math.hypot(other.x - t.x, other.y - t.y);
      if (d > h.rangePx) continue;
      if (h.needsLos && !clearLine(state, t.x, t.y, other.x, other.y)) continue;
      target = other;
      bestDeficit = deficit;
    }
    if (!target) continue;
    target.hp = Math.min(target.cfg.maxHp, target.hp + h.ratePerS * dt);
    state.tankLinks.push({
      x0: t.x, y0: t.y, x1: target.x, y1: target.y,
      color: [90, 214, 120], width: 2.5, baseAlpha: 0.55, pulseAlpha: 0.35, pulseHz: 2.5, dash: null,
    });
  }
}

// G5 (t_mason, "Der Maurer"): baut alle build.everyS Sekunden eine
// zerstoerbare Wand (state.placeTrapWall(), Phase-6-Mechanismus, hier vom
// ersten Mal von der GEGNER-KI statt vom Spieler-Sekundaerslot genutzt) auf
// eine freie Bodenzelle zwischen sich und seinem Ziel. Ein 0,8-s-Geruest
// (state.masonScaffolds, eigener kleiner Renderer in effects.js -- KEIN
// Baustein-C-Wiederverwendung, das ist eine wachsende KREIS-Gefahrenflaeche,
// hier ein statisches Quadrat) zeigt die Zielzelle, bevor sie solide wird.
export function updateMasons(state, dt) {
  for (const s of state.masonScaffolds) s.age += dt; // fuer die Fuellfraktion in effects.js
  for (const t of state.tanks) {
    if (!t.cfg.build) continue;
    const b = t.cfg.build;
    // Verfall (build.decayS): jede eigene Wand verschwindet 20 s nach ihrer
    // Fertigstellung, unabhaengig davon, ob sie schon Treffer genommen hat --
    // eine INSTANTANE Entfernung (kein destroyWall()-Aufruf, das zaehlt
    // Treffer statt sofort zu entfernen).
    // BUGFIX: Verfall und Aufraeumen laufen bewusst AUCH fuer einen bereits
    // TOTEN Maurer (die t.alive-Pruefung sitzt erst weiter unten, vor der
    // Baulogik). Vorher machte sein Tod jede seiner Waende dauerhaft --
    // ausgerechnet die richtige Antwort des Spielers ("toete den Maurer")
    // hat seine Sperren also fuer immer zementiert, statt sie aufzuloesen.
    for (const w of t.masonWalls || []) {
      if (w.masonExpiresAt != null && state.time >= w.masonExpiresAt) {
        const i = state.walls.indexOf(w);
        if (i >= 0) state.walls.splice(i, 1);
        state.grid[w.row][w.col] = '.';
        state.spawnParticles(w.x + w.w / 2, w.y + w.h / 2, '#c9a227', 6, 90);
      }
    }
    // Eigene, bereits gebaute Waende, die inzwischen zerstoert wurden ODER
    // gerade verfallen sind, faellen aus der Liste (Muster: staendig neu
    // gegen state.walls abgleichen statt einen zweiten Entfernungs-Hook zu
    // brauchen).
    t.masonWalls = (t.masonWalls || []).filter((w) => state.walls.includes(w));
    if (!t.alive) {
      // Stirbt der Maurer mitten im Bau, wird die Wand nie fertig -- sein
      // Geruest-Telegraph muss mit ihm verschwinden, sonst zeigt der Raum bis
      // zum Ende eine Warnung vor einer Wand, die nie kommt.
      if (t.masonBuildState) {
        const { col, row } = t.masonBuildState;
        state.masonScaffolds = state.masonScaffolds.filter((s) => s.col !== col || s.row !== row);
        t.masonBuildState = null;
      }
      continue;
    }
    if (t.masonBuildState) {
      if (state.time < t.masonBuildState.until) continue; // steht still, s. ai.js: updateEnemy()
      const { x, y, col, row } = t.masonBuildState;
      const wall = state.placeTrapWall(x, y, b.hits);
      if (wall) {
        wall.masonExpiresAt = state.time + b.decayS;
        t.masonWalls.push(wall);
      }
      state.masonScaffolds = state.masonScaffolds.filter((s) => s.col !== col || s.row !== row);
      t.masonBuildState = null;
      t.masonTimer = b.everyS;
      continue;
    }
    t.masonTimer = (t.masonTimer ?? b.everyS) - dt;
    if (t.masonTimer > 0) continue;
    t.masonTimer = b.everyS; // Takt haelt auch, wenn dieser Versuch scheitert
    if (t.masonWalls.length >= b.maxAlive) continue;
    const target = resolveTarget(t, state);
    if (!target.alive) continue;
    const dx = target.x - t.x;
    const dy = target.y - t.y;
    const dist = Math.hypot(dx, dy) || 1;
    const cx = t.x + (dx / dist) * b.distancePx;
    const cy = t.y + (dy / dist) * b.distancePx;
    const col = Math.floor(cx / CELL);
    const row = Math.floor(cy / CELL);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue;
    if (state.grid[row][col] !== '.') continue; // besetzte Zelle
    const px = state.player.x, py = state.player.y;
    const pCol = Math.floor(px / CELL), pRow = Math.floor(py / CELL);
    if (Math.max(Math.abs(col - pCol), Math.abs(row - pRow)) < b.minPlayerDistCells) continue;
    let tankBlocked = false;
    for (const other of state.tanks) {
      if (other.alive && circlesOverlap(col * CELL + CELL / 2, row * CELL + CELL / 2, CELL / 2, other.x, other.y, other.cfg.radius)) {
        tankBlocked = true;
        break;
      }
    }
    if (tankBlocked || state.wouldIsolateArea(col, row)) continue;
    t.masonBuildState = { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, col, row, until: state.time + b.buildS };
    state.masonScaffolds.push({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, col, row, age: 0, life: b.buildS });
  }
}

// G8 (t_metronom, "Der Taktgeber"): tickt den eigenen Beat-Zyklus
// (t.metronomeState.elapsed, 0..beatS, zyklisch, dasselbe simple Delta-
// Increment-Muster wie t_masons masonTimer/t_rushers ram.timer -- KEIN
// floor-division-basiertes Tick-Zaehlen wie status.js: die Halte-/Frei-
// Grenze ist ein reiner Anzeige-/Feuer-Gate, kein bilanzkritischer
// Schadenswert). Muss VOR der Gegner-Schleife laufen (metronomeHolds()
// wird dort pro Verbuendetem abgefragt) -- Aufruf zusammen mit
// updateTargeting()/updateCoverPerception(), nicht im spaeteren Tick-Block
// bei updateMasons() & Co.
export function updateMetronomes(state, dt) {
  // Pro Tick EINMAL eingesammelt statt in metronomeHolds() je feuerwilligem
  // Verbuendeten neu ueber alle Panzer zu scannen -- in einem Raum ohne
  // Taktgeber (der Regelfall) ist die Haltepruefung damit ein einziger
  // length-Vergleich.
  state.metronomes = state.tanks.filter((t) => t.alive && t.cfg.metronome);
  for (const t of state.metronomes) {
    const mc = t.cfg.metronome;
    if (!t.metronomeState) t.metronomeState = { elapsed: 0, justBeat: false };
    const ms = t.metronomeState;
    const wasHeld = ms.elapsed < (mc.holdWindowS ?? 0);
    ms.elapsed += dt;
    if (ms.elapsed >= mc.beatS) ms.elapsed -= mc.beatS; // Zyklus-Wrap
    const nowHeld = ms.elapsed < (mc.holdWindowS ?? 0);
    // "auf dem Schlag" (Auftrag Abschnitt 8.7): der Uebergang gehalten -> frei.
    ms.justBeat = wasHeld && !nowHeld;
    if (ms.justBeat) {
      state.sounds.push({ name: 'wave', x: t.x });
      state.flashes.push({ x: t.x, y: t.y, age: 0, dim: false });
    }
  }
}

// G8: haelt `tank` fest, solange mindestens EIN sichtbarer (needsLos)
// Taktgeber sich noch in seiner Halte-Phase befindet. Live pro Aufruf
// geprueft (kein Cache wie state.relaySight) -- Taktgeber sind selten
// (Danger Cost 11), eine zusaetzliche clearLine()-Pruefung je Verbuendetem
// und Tick faellt nicht ins Frame-Budget.
export function metronomeHolds(state, tank) {
  const list = state.metronomes;
  if (!list?.length) return false;
  for (const m of list) {
    if (m === tank || !m.alive) continue;
    const ms = m.metronomeState;
    if (!ms || ms.elapsed >= (m.cfg.metronome.holdWindowS ?? 0)) continue;
    if (m.cfg.metronome.needsLos && !clearLine(state, tank.x, tank.y, m.x, m.y)) continue;
    return true;
  }
  return false;
}

// G8 (t_grabber, "Der Greifer"): eigener, von der normalen Feuerentscheidung
// (roleTurret()) UNABHAENGIGER Zustandsautomat mit eigenem Cooldown --
// der Greifer schiesst parallel dazu ganz normal auch echte Kugeln
// (Muster: t_rusher rammt UND kann normal schiessen, hier umgekehrt: der
// Greifer schiesst normal UND greift zusaetzlich). idle -> windup (Richtung
// EINMALIG eingefroren, Muster ramDrive()) -> Treffer-/Fehlschlagpruefung
// am Ende des Windups (Zielaufloesung erneut, "ausweichen kostet nur
// Bewegung": weicht das Ziel aus dem gefrorenen Korridor, verpufft der
// Griff) -> cooldown.
export function updateGrapples(state, dt) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.grapple) continue;
    const gc = t.cfg.grapple;
    if (!t.grappleState) t.grappleState = { mode: 'idle', timer: 0, dir: 0 };
    const gs = t.grappleState;
    if (gs.mode === 'cooldown') {
      gs.timer -= dt;
      if (gs.timer <= 0) gs.mode = 'idle';
      continue;
    }
    if (gs.mode === 'idle') {
      const target = resolveTarget(t, state);
      if (!target.alive) continue;
      const d = Math.hypot(target.x - t.x, target.y - t.y);
      if (d <= gc.maxRangePx && clearLine(state, t.x, t.y, target.x, target.y)) {
        gs.mode = 'windup';
        gs.timer = gc.windupS;
        gs.dir = Math.atan2(target.y - t.y, target.x - t.x);
        state.sounds.push({ name: 'wave', x: t.x });
      }
      continue;
    }
    // windup
    gs.timer -= dt;
    if (gs.timer > 0) continue;
    const target = resolveTarget(t, state);
    const withinRange = target.alive && Math.hypot(target.x - t.x, target.y - t.y) <= gc.maxRangePx;
    const withinCone =
      withinRange && Math.abs(angleDelta(gs.dir, Math.atan2(target.y - t.y, target.x - t.x))) < (gc.aimToleranceRad ?? 0.35);
    const sighted = withinCone && clearLine(state, t.x, t.y, target.x, target.y);
    if (sighted) {
      target.grappledBy = t;
      target.grappleUntil = state.time + gc.pullS;
      target.grappleRopeHp = gc.ropeHp ?? 1;
      state.sounds.push({ name: 'dash', x: t.x });
    } else {
      // "Dem Korridor ausweichen kostet nur Bewegung" (Auftrag Abschnitt
      // 8.8) -- ein Fehlschlag ist trotzdem hoer-/sichtbar quittiert
      // (Muster: fireHook()s Fehlschuss-Rueckmeldung), sonst wirkt die
      // verbrauchte Abklingzeit wie ein Defekt.
      state.sounds.push({ name: 'empty', x: t.x });
      state.flashes.push({ x: t.x, y: t.y, age: 0, dim: true });
    }
    gs.mode = 'cooldown';
    gs.timer = gc.cooldownS;
  }
}

// Kuerzester Abstand eines Punktes zu einer Strecke (fuer den beschiessbaren
// Leinen-Check unten) -- reine Geometrie, kein RNG/State-Zugriff.
function pointSegmentDistSq(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let tt = lenSq > 1e-9 ? ((px - x0) * dx + (py - y0) * dy) / lenSq : 0;
  tt = Math.max(0, Math.min(1, tt));
  const cx = x0 + dx * tt;
  const cy = y0 + dy * tt;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

// G8 (t_grabber): "Ein einziger Treffer auf die gespannte Leine trennt sie
// sofort" -- prueft jede aktive Leine (jeder Panzer/Geist mit gesetztem
// grappledBy) gegen ALLE lebenden Geschosse, unabhaengig vom Besitzer
// (dasselbe teamlose Prinzip wie t_duds Explosion/t_arclights Kette).
// Trifft eine Kugel die Strecke Schuetze<->Ziel (beide LEBEND aktuell
// positioniert, nicht die Position beim Auftreffen), sinkt grappleRopeHp;
// bei 0 loest sich das Ziel -- die Kugel wird dabei verbraucht ("eine Kugel
// fuer die Leine ausgeben", Auftrag Abschnitt 8.8).
export function updateGrappleRopes(state) {
  // Ohne einen einzigen lebenden Greifer im Raum gibt es strukturell keine
  // Leine -- dann auch nicht Tick fuer Tick zwei Arrays zusammenkopieren
  // (der Normalfall: t_grabber erscheint erst in Akt 3 ab Raum 6).
  if (!state.tanks.some((t) => t.alive && t.cfg.grapple)) return;
  const carriers = [...state.tanks, ...state.ghosts];
  for (const target of carriers) {
    if (!target.grappledBy) continue;
    // Abgelaufener oder toter Griff: Zeiger aufraeumen statt ihn als Leiche
    // stehen zu lassen. Alle Leser gaten zwar zusaetzlich auf grappleUntil,
    // ein haengender Verweis auf einen toten Panzer ist aber genau die Art
    // stiller Altlast, die spaeter jemanden in die Irre fuehrt.
    if (!target.grappledBy.alive || state.time >= target.grappleUntil) {
      target.grappledBy = null;
      target.grappleUntil = 0;
      continue;
    }
    if (!target.alive) continue;
    const shooter = target.grappledBy;
    const gc = shooter.cfg.grapple;
    // Baustein B (G1): "die gespannte Leine ist danach dick und deutlich
    // gezeichnet und flackert" (Auftrag Abschnitt 8.8) -- drawTankLinks()
    // zeichnet sie generisch mit, wie Heilstrahl/Lichtfaden/Fahnenlinie/Kette.
    const flick = 0.5 + 0.5 * Math.sin(state.time * 14);
    state.tankLinks.push({
      x0: shooter.x, y0: shooter.y, x1: target.x, y1: target.y,
      color: [220, 190, 40], width: 4 + flick * 2, baseAlpha: 0.75, pulseAlpha: 0, pulseHz: 0, dash: null,
    });
    const rr = (gc?.ropeHitRadiusPx ?? 14) ** 2;
    for (const b of state.bullets) {
      if (b.dead) continue;
      // BUGFIX: die EIGENEN Geschosse des Greifers duerfen seine Leine nicht
      // trennen. Er zielt mit seiner normalen Waffe auf genau dasselbe Ziel,
      // das er zieht -- seine Kugeln fliegen also praktisch ENTLANG der Leine
      // und wurden vorher ausnahmslos im Erzeugungstick von ihr selbst
      // gefressen: ein Greifer konnte ein gegriffenes Ziel nie beschiessen.
      // Gleiche Begruendung wie das b.owner === t der Panzer-Trefferschleife:
      // die Leine ist Teil des Schuetzen, nicht ein fremdes Hindernis.
      // Fremdes Feuer (Spieler, Verbuendete) trennt sie weiterhin -- das ist
      // die im Design gewollte Gegenwehr bzw. dasselbe teamlose Prinzip wie
      // bei t_duds Explosion und t_arclights Kette.
      if (b.owner === shooter) continue;
      if (pointSegmentDistSq(b.x, b.y, shooter.x, shooter.y, target.x, target.y) > rr) continue;
      b.dead = true;
      target.grappleRopeHp = (target.grappleRopeHp ?? 1) - 1;
      state.sounds.push({ name: 'bounce', x: b.x });
      state.spawnParticles?.(b.x, b.y, '#c9a227', 6, 90);
      if (target.grappleRopeHp <= 0) {
        target.grappledBy = null;
        target.grappleUntil = 0;
      }
      break; // eine Kugel pro Tick reicht -- die Leine ist entweder noch da oder schon weg
    }
  }
}
