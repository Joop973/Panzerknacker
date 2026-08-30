// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 6: Raeume kommen aus dem Generator (Kachelsystem, data/tiles.json).
// RNG: genRng ist der RAUMBAU-Strom (aus hash(seed, roomIndex, 'rooms'),
// siehe core/rng.js) und aiRng der KI-Strom -- getrennt, damit der
// Spielverlauf den Raumbau nicht verschiebt. Alle Balancing-Werte kommen
// aus data/*.json.

import { CELL, COLS, ROWS, RESPAWN_DELAY } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import {
  createTank,
  moveTank,
  fireBullet,
  layMine,
  useSecondary,
  useGadget,
  dashTank,
  liveBulletsOf,
  magazineOf,
} from './tank.js';
import { updateBullet, createBullet } from './bullet.js';
import { updateMines, explodeAt } from './mine.js';
import { fireMortar, updateMortars } from './mortar.js';
import { updateTraps } from './trap.js';
import { createGhost, updateGhosts, killGhost, occupiedGhostSlots, recomputeLegionCache, pushGhost } from './ghost.js';
import {
  tickNecroTimers,
  buildNecroListeners,
  applyVirtualNecroDeaths,
  necroResistBonus,
  addNecroTimedStack,
  getNecroStack,
} from './necro.js';
import { updateEnemy, updateCoverPerception, updateTargeting, resolveTarget, registerThreat, clearLine } from './ai.js';
import { applyStatus, updateStatus } from './status.js';
import { applyTypeEffects } from './damagetypes.js';
import { stepMirrorBoss, stepPhalanxBoss, stepAnvilBoss, showAnvilHint } from './bossai.js';
import { stepSpiderBoss, updateSpiderLegHits, updateSpiderWebs } from './spider.js';
import { updateSpiderMines } from './spidermine.js';
import { circlesOverlap } from './collision.js';
import { generateRoom, buildFixedRoom } from './generator.js';
import { resolveCfg, applyUpgrades, applyRoomModifier, applyRoomContext, applyHpScaling, applyScrapDamage, applyNecroRunScaling, isBossCfg } from './cfg.js';
import { armorBlocks, reflectBullet, reflectFromAim, isLive, flankZone, angleDelta } from './armor.js';

// Zelltyp -> Wandtyp. 'hole' blockiert Panzer, Geschosse fliegen drueber.
// 'destructible' (Phase 11): physisch wie 'solid', bis sie durch
// destructibleHits Treffer (Kugel ODER Explosion) abgebaut ist.
// 'generator' (Phase 14, Reaktor-Boss): physisch wie 'solid'. Verhielt sich
// vor dem Grundsteinumbau wie eine zerstoerbare Wand, die nur ein bereits
// abgeprallter Schuss beschaedigte -- ohne Bandenschuss (Phase 1) ist das
// gegenstandslos, der Reaktor-Boss ist ohnehin aktuell ein Platzhalter
// (t_black, s. CLAUDE.md). Generatoren stehen bis zum Bossneubau als
// gewoehnliche, unzerstoerbare Waende.
const WALL_TYPES = { '#': 'solid', b: 'breakable', o: 'hole', d: 'destructible', g: 'generator' };

// Truemmerfarben fuer Partikel (Politur, Phase 10).
const DEBRIS_COLORS = {
  player: '#3d8ef0',
  t_armored: '#7d8794',
  t_brown: '#8a5a33',
  t_grey: '#9aa0a8',
  t_teal: '#3aa8a0',
  t_yellow: '#d4c23a',
  t_pink: '#d47ba6',
  t_green: '#5a9e4a',
  t_purple: '#8a5ad4',
  t_white: '#e8e8e8',
  t_black: '#33333c',
  t_reactor: '#e0a83c',
  t_mirror: '#8fd8ee',
  t_phalanx: '#9aa6b4',
  t_spider: '#8a6ad8',
  t_anvil: '#c9a03c',
};

// Nekromant-V2 Phase 2: Schadensresistenz + Schild-Punktepool als
// eigenstaendige Funktionen -- gebraucht sowohl von applyDamage() (Spieler/
// Gegner in state.tanks) als auch von der GETRENNTEN Geister-Kollisions-
// schleife (Untertanen sind bewusst NICHT in state.tanks, s. Kopfkommentar
// dort). `entityCfg`/`entity` passen auf Panzer UND Geister gleichermassen
// (beide tragen `.cfg.resist` bzw. `.shield`/`.x`/`.y`).
//
// Rechenweg (Auftrag Abschnitt 4a): additiv gesammelte Punkte, NIE eine
// Obergrenze, NIE null -- genommenerSchaden = Schaden / (1 + resistSumme/
// divisor). Ein Math.min(..., 0.6)-Clamp waere genau der versteckte Deckel,
// den der Auftrag ausdruecklich verbietet.
function applyResistToAmount(entityCfg, resistBalance, amount) {
  if (!entityCfg.resist) return amount ?? 1;
  const divisor = resistBalance?.divisor ?? 100;
  // Math.max(1, ...): die Formel naehert sich 0 nur an, wird aber durch das
  // Runden bei astronomisch hohen Resistenzsummen sonst tatsaechlich 0 --
  // "nie null" (Auftrag Abschnitt 4a) gilt woertlich, ein Treffer bleibt
  // also IMMER mindestens 1 Punkt wert, egal wie hoch resist steigt.
  return Math.max(1, Math.round((amount ?? 1) / (1 + entityCfg.resist / divisor)));
}

// Schild als Punktepool: faengt Schaden VOR hp ab, bis zu 0, Rest faellt
// durch. NICHT zu verwechseln mit state.shieldCharges (Notschild, blockt
// einen GANZEN Treffer) oder tank.shieldHp/shieldReady (der AELTERE,
// nur-Spieler-Absorber der schild-Karte, UMBAUPLAN-LP Phase 8) -- alle drei
// bleiben nebeneinander bestehen und sind im HUD getrennt sichtbar.
function absorbWithShieldPool(state, entity, amount) {
  const have = entity.shield || 0;
  if (have <= 0) return amount ?? 1;
  const absorbed = Math.min(have, amount ?? 1);
  entity.shield -= absorbed;
  state.sounds.push({ name: 'shield', x: entity.x });
  state.spawnParticles(entity.x, entity.y, '#7fe6c8', 8, 110);
  return (amount ?? 1) - absorbed;
}

// Spinnenboss (Spinnenboss-Auftrag Abschnitt 11): der Koerper darf VOR der
// letzten Phase nicht vollstaendig sterben. Klemmt hp auf mindestens
// phase3ProtectHpPct * maxHp, SOLANGE noch mindestens ein Bein lebt --
// sobald das letzte Bein faellt, entfaellt die Klammer ersatzlos (Abschnitt
// 10, Punkt 10: "wird wieder geschuetzt, SOFERN NOCH BEINE VORHANDEN SIND").
// Reine Phasen-/Ablauflogik fuer GENAU diesen einen Bosstyp -- keine
// Obergrenze fuer irgendein Spieler-Upgrade (Abschnitt 7: "keine versteckte
// automatische Anpassung ... starke Builds duerfen weiterhin spuerbar
// staerker sein" bleibt unberuehrt, die Klemme wirkt nur auf den BOSS).
function applySpiderFloor(state, tank) {
  if (!tank.cfg.spiderBoss || !(tank.spiderLegsAlive > 0)) return;
  const pct = state.data.balance?.boss?.spider?.phase3ProtectHpPct ?? 0.3;
  const floor = tank.cfg.maxHp * pct;
  if (tank.hp < floor) tank.hp = floor;
}

// BUGFIX (Code-Review): der EINE gemeinsame Ausgang fuer jeden Schaden, der
// die hp wirklich erreicht -- vorher hatten der DOT-Zweig, der Spieler-
// Schild-Punktepool-Zweig UND der normale Fallthrough in applyDamage() je
// eine EIGENE Kopie von "hp abziehen, Bodenklammer, ggf. killTank()".
// ghost_025 "Letzte Deckung" (necroLastStand) war dabei nur im Fallthrough
// verdrahtet: ein toedlicher Treffer, der zuerst durch den Schild-Punktepool
// lief (jeder Treffer mit aktivem Spieler-Schild, sobald der Absorber nicht
// mehr reicht) oder ein toedlicher Statuseffekt-Tick riefen killTank() DIREKT
// auf und liessen die Karte nie eine Rettungschance bekommen -- ein Schild
// machte den Nekromanten dadurch VERWUNDBARER als ganz ohne Schild. Jetzt
// gibt es nur noch diese eine Stelle, die ueber Rettung/Tod entscheidet;
// alle drei Aufrufer reichen nur noch den (ggf. schon durch Resistenz/Schild
// reduzierten) Restschaden durch.
function resolveLethalHit(state, tank, amount, cause, meta) {
  if (
    tank === state.player &&
    tank.cfg.necroLastStand &&
    !state.necroLastStandUsed &&
    (amount ?? 1) >= tank.hp &&
    state.ghosts.some((g) => g.alive)
  ) {
    let weakest = null;
    for (const g of state.ghosts) {
      if (g.alive && (!weakest || g.hp < weakest.hp)) weakest = g;
    }
    if (weakest) {
      state.necroLastStandUsed = true;
      weakest.alive = false;
      tank.hp = Math.min(tank.cfg.maxHp, tank.hp + tank.cfg.maxHp * (tank.cfg.necroLastStandHealPct || 0));
      state.sounds.push({ name: 'shield', x: tank.x });
      state.spawnParticles(tank.x, tank.y, '#c9a6ff', 12, 130);
      return;
    }
  }
  tank.hp -= amount ?? 1;
  applySpiderFloor(state, tank);
  // Exekutionsschwelle (Grundsteinumbau Phase 2): war das Ziel VOR diesem
  // Treffer schon im Exekutionszustand (t.executing, s. stepState()-Timer-
  // Schleife), toetet dieser Treffer garantiert -- unabhaengig davon, ob der
  // Abzug allein hp<=0 gebracht haette.
  if (tank.hp > 0 && !tank.executing) return;
  state.killTank(tank, cause, meta);
}

// Nekromant-V2 Phase 3: Wiederbelebungs-Anzahl fuer EINEN Kill, "Rechenweg
// statt Obergrenze" (Auftrag Abschnitt 4a) -- derselbe Ganzzahl-plus-Rest-
// Mechanismus wie bei anderen ueberlauffaehigen Chancen (Krit, Phase 7):
// der ganzzahlige Anteil erzeugt GARANTIERTE Zusatz-Untertanen (bei chance
// 1.4 also sicher einen, plus 40 % Chance auf einen zweiten), der Rest bleibt
// eine reine Wahrscheinlichkeit. Bei chance <= 0 immer 0, bei chance < 1 wie
// bisher ein einzelner Wurf -- keine Verhaltensaenderung im aktuell
// erreichbaren Wertebereich (0,35), nur der Mechanismus selbst kennt keinen
// Deckel.
function rollGhostSpawnCount(chance, rng) {
  if (!(chance > 0)) return 0;
  const guaranteed = Math.floor(chance);
  const remainder = chance - guaranteed;
  return guaranteed + (remainder > 0 && rng() < remainder ? 1 : 0);
}


function buildWalls(grid, destructibleHits, generatorHits) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = WALL_TYPES[grid[row][col]];
      if (type) {
        const wall = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type, col, row };
        // Phase 11: eigene Haltbarkeit statt state.transform.wallDurability --
        // dieselbe destroyWall()-Zaehllogik wie Sperrmauer/Baumeister.
        if (type === 'destructible') wall.destructibleHits = destructibleHits || 1;
        // Phase 14: Reaktor-Generator -- eigene (meist kleinere) Haltbarkeit.
        // Aktuell nie erreichbar (Bandenschuss-Vorbedingung entfallen, Boss
        // ist Platzhalter, s. bullet.js), Feld bleibt fuer den Bossneubau.
        if (type === 'generator') wall.destructibleHits = generatorHits || 1;
        walls.push(wall);
      }
    }
  }
  return walls;
}

// Baut den Zustand fuer EINEN Raum.
// opts: { genRng      -- Seed-RNG-Strom fuer den Raumbau (Pflicht)
//         enemyTypes  -- Typliste der Gegner dieses Raums
//         aiSeed      -- Seed fuer den KI-RNG-Strom
//         fixedRoom   -- optionales festes Layout (Finalraum)
//         weights     -- optionale Kachelgewichte (Raumcharakter)
//         playerUpgrades -- Upgrade-Level {id: stufe}
//         upgradesData -- Inhalt von upgrades.json (Stellwerte) }
// Elite-Affixe (Phase 9) auf einen frisch erzeugten Panzer anwenden --
// nutzt seinen INDEX in der urspruenglichen enemyTypes-Liste, damit
// dieselbe Rezeptur (siehe run.js: rollEliteAffixes) unabhaengig davon
// gilt, ob der Panzer sofort oder erst mit der zweiten Welle entsteht.
function applyAffixByIndex(t, index, eliteAffixes) {
  if (!eliteAffixes) return;
  // t.affixes ist die Anzeige-/Telemetrie-Quelle (Farbpunkte in renderer.js,
  // main.js: teleEnemies) -- nur Affixe eintragen, die dieser Panzer auch
  // TATSAECHLICH bekommt. Regenerierschild trifft nur cheapestIdx/priciestIdx
  // (Bugfix: vorher stand hier pauschal die volle Rezeptur, wodurch jeder
  // andere Gegner im Raum einen Schild-Punkt zeigte, den er gar nicht hatte).
  t.affixes = [];
  // G8 (UMBAUPLAN-GEGNER.md O3): optionale Sperrliste je Gegnertyp
  // (data/tanks.json: affixDeny). Nur ausgewertet, wenn gesetzt -- ohne das
  // Feld bleibt jeder Affix erlaubt wie bisher. Ein gesperrter Affix wird
  // auch NICHT in t.affixes eingetragen, sonst zeigte der Panzer einen
  // Farbpunkt fuer eine Wirkung, die er gar nicht hat (dieselbe Fehlerklasse
  // wie der Regenerierschild-Bugfix, der diesen Block ueberhaupt erst
  // eingefuehrt hat).
  const deny = t.cfg.affixDeny;
  for (const affix of eliteAffixes.chosen) {
    if (deny && deny.includes(affix.id)) continue;
    if (affix.regenerating) {
      if (index === eliteAffixes.cheapestIdx || index === eliteAffixes.priciestIdx) {
        t.shieldReady = true;
        t.regenShieldS = affix.regenS;
        t.affixes.push(affix.id);
      }
      continue;
    }
    t.affixes.push(affix.id);
    if (affix.shield) t.shieldReady = true;
    if (affix.speedMult) t.cfg.speed *= affix.speedMult;
    if (affix.extraMines) t.cfg.mines += affix.extraMines;
    if (affix.twinshot) {
      t.cfg.twinShot = true;
      t.cfg.twinSpreadRad = affix.spreadRad;
      // Sonst waere das Magazin nach der ersten der beiden Kugeln schon
      // voll -- "zwei Kugeln gleichzeitig" braucht Platz fuer 2.
      t.cfg.magazine = Math.max(t.cfg.magazine, 2);
    }
  }
}

// Blindgaenger-Todeszuender (G2, t_dud): tickt state.deathFuses -- reine
// Zeitverzoegerung, danach ein normaler explodeAt()-Aufruf mit spare:null
// (trifft ausdruecklich auch andere Gegner, s. killTank()-Hook oben). Muster
// wie updateMines/updateMortars, aber bewusst KEIN eigenes Modul -- das
// ganze Feature ist ein Array-Tick von wenigen Zeilen.
function updateDeathFuses(state, dt) {
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

// G5 (t_mason): reine BFS ueber das Laufzeit-Grid, dasselbe Solid-Kriterium
// wie isSolid() ('#'/'b'/'d'/'g'). Modul-Ebene statt state-Methode, weil sie
// zweimal (vorher/nachher) mit demselben `grid` aufgerufen wird -- eine
// state-Methode wuerde dieselbe Logik nur duplizieren muessen.
// UMBAUPLAN-GEGNER.md Fund 15: generator.js: reachableCells() arbeitet auf
// dem STATISCHEN Generierungs-Grid, nicht auf diesem Laufzeit-Grid -- der
// Algorithmus ist 1:1 uebertragbar, aber als eigene, kleine Kopie hier.
function bfsReachable(grid, startCol, startRow) {
  const seen = new Set();
  const key = (c, r) => r * 1000 + c;
  if (grid[startRow]?.[startCol] === undefined) return seen;
  const stack = [[startCol, startRow]];
  seen.add(key(startCol, startRow));
  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const k = key(nc, nr);
      if (seen.has(k)) continue;
      const cell = grid[nr][nc];
      if (cell === '#' || cell === 'b' || cell === 'd' || cell === 'g') continue;
      seen.add(k);
      stack.push([nc, nr]);
    }
  }
  return seen;
}

// G7 (t_tether, "Der Kettenhund"): einmalige Bindung beim Raumaufbau (und
// erneut nach einem Wellen-2-Spawn, s. updateWave()) -- jeder noch
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
function updateTethers(state) {
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
function updateMedics(state, dt) {
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
function updateMasons(state, dt) {
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
function updateMetronomes(state, dt) {
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
function metronomeHolds(state, tank) {
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
function updateGrapples(state, dt) {
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
function updateGrappleRopes(state) {
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

export function createState(data, tiles, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades, upgradesData, shieldCharges,
    roomSpec, arenas, transform, equippedSecondary, equippedGadget, waveSplit, waveCfg, eliteAffixes, modifier,
    destructibleWalls, hazardType, roomContext, hpScale, hpSkipBosses, upgradeLevels, levelBalance,
    starterTank = 'player', starterScrap = 0, actEnemyPool, necroRunStacksBase,
    necroRunDmgBonus = 0, necroRunHpBonus = 0 } = opts;
  // Weiche (Phase 0b): festes Layout aus data/arenas.json vor dem Generator.
  const room = fixedRoom
    ? buildFixedRoom(fixedRoom, enemyTypes.length)
    : generateRoom(tiles, genRng, enemyTypes.length, weights, roomSpec, arenas, destructibleWalls, hazardType);
  const grid = room.grid;
  const walls = buildWalls(grid, destructibleWalls?.hits, data.balance?.boss?.generatorHits);
  // Der Raum-Modifikator "Spiegelsaal" (liess feste Waende Kugeln zurueck-
  // werfen) ist mit dem Bandenschuss ins Archiv gewandert (Grundsteinumbau
  // Phase 1, s. ARCHIV.md) -- data/modifiers.json fuehrt ihn nicht mehr.

  // Raum-Gefahr (Phase 15): genau EIN Element pro Raum (room.hazard kommt
  // aus generator.js: placeRoomHazard()). Bewegliche Wand bleibt eine ganz
  // normale 'solid'-Wand (kein neuer Grid-Char) -- state.tickMovingWalls()
  // haengt sie nur periodisch aus state.walls aus/ein. Oel/Foerderband sind
  // reine Positions-Sets (kein Wandobjekt noetig, blockieren nichts).
  // Laserwaende bewusst NICHT in `walls`: sie sollen Kugeln, aber keine
  // Panzer blockieren -- ein eigenes Array, das nur bullet.js abfragt.
  const hazard = room.hazard || null;
  const movingWalls =
    hazard?.type === 'movingWall'
      ? hazard.cells.map(({ col, row }) => ({
          col,
          row,
          x: col * CELL,
          y: row * CELL,
          solid: true,
          wallRef: walls.find((w) => w.col === col && w.row === row) || null,
        }))
      : [];
  const oilCells =
    hazard?.type === 'oil' ? new Set(hazard.cells.map(({ col, row }) => `${col},${row}`)) : null;
  const conveyor =
    hazard?.type === 'conveyor'
      ? { cells: new Set(hazard.cells.map(({ col, row }) => `${col},${row}`)), dir: hazard.dir, pushPx: hazard.pushPx }
      : null;
  const laserWalls =
    hazard?.type === 'laser'
      ? hazard.cells.map(({ col, row }) => ({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'laser', col, row }))
      : [];

  const player = createTank(
    starterTank,
    applyRoomContext(
      applyRoomModifier(
        // Nekromant-V2 Phase 6 (ghost_029/030): permanente Run-Boni NACH dem
        // Schrottpanzer-Passiv, VOR dem Raum-Modifikator -- gleiche Stelle
        // wie applyScrapDamage(), ein weiterer "einmal pro Raumaufbau
        // gebackener" Multiplikator.
        applyNecroRunScaling(
        applyScrapDamage(
          applyUpgrades(
          resolveCfg(data, starterTank),
          playerUpgrades,
          upgradesData,
          equippedSecondary,
          equippedGadget,
          upgradeLevels,
          levelBalance,
        ),
          starterScrap,
        ),
        necroRunDmgBonus,
        necroRunHpBonus,
        ),
        modifier,
        true,
      ),
      roomContext,
    ),
    room.playerSpawn.x,
    room.playerSpawn.y,
  );
  const tanks = [player];
  // Wellen (Phase 9): grosse Raeume spawnen nur die erste Haelfte sofort
  // (waveSplit-Grenze); der Rest wartet an denselben, vom Generator schon
  // erzeugten Spawnpunkten in state.pendingWave (siehe stepState()).
  const firstWaveCount = waveSplit ?? enemyTypes.length;
  // Sicherheitsnetz (Phase 11b, data/limits.json: enemiesAlive) -- greift im
  // normalen Spiel nie (Budget-Kauf + Wellen bleiben schon unter der Zahl),
  // schuetzt aber vor unbegrenztem Wachstum, falls ein kuenftiges System
  // (z. B. ein neuer Raumtyp) das jemals aushebeln wuerde.
  const enemyCap = data.limits?.enemiesAlive ?? Infinity;
  let phalanxCounter = 0; // Phase 14: Formationsplatz (0..4) je t_phalanx
  enemyTypes.forEach((type, i) => {
    if (i >= firstWaveCount) return;
    if (tanks.length - 1 >= enemyCap) return;
    const s = room.enemySpawns[i];
    const t = createTank(
      type,
      applyHpScaling(applyRoomModifier(resolveCfg(data, type), modifier, false), hpScale, hpSkipBosses),
      s.x,
      s.y,
    );
    t.spawnX = s.x;
    t.spawnY = s.y;
    if (t.cfg.phalanx) t.phalanxIndex = phalanxCounter++;
    applyAffixByIndex(t, i, eliteAffixes);
    tanks.push(t);
  });
  // G7 (t_tether): einmalige Bindung, sobald alle Welle-1-Gegner stehen
  // (braucht den vollen Bestand, um "den naechstgelegenen" zu finden -- kann
  // nicht in der Spawn-Schleife selbst passieren). updateWave() ruft
  // bondTethers() nach dem Wellen-2-Spawn erneut auf.
  bondTethers(tanks);
  const pendingWave =
    waveSplit != null
      ? {
          types: enemyTypes.slice(waveSplit),
          spawns: room.enemySpawns.slice(waveSplit),
          startIdx: waveSplit,
          initialCount: waveSplit,
          fraction: waveCfg.secondWaveAtFraction,
          warningS: waveCfg.warningS,
          spawning: false,
          warningTimer: 0,
        }
      : null;

  const state = {
    data,
    tiles,
    playerUpgrades,
    upgradesData,
    upgradeLevels, // Grundsteinumbau Phase 7: fuer respawnPlayer()
    levelBalance,
    equippedSecondary: equippedSecondary || 'mine', // Phase 6: fuer respawnPlayer()
    equippedGadget: equippedGadget || null, // P4: zweiter Slot, ebenfalls fuer respawnPlayer()
    starterTank, // Phase 9: gewaehlte Klasse -- respawnPlayer() baut denselben Panzer
    starterScrap, // Phase 9: Schrottstand fuer das Schrottpanzer-Passiv (pro Raum gebacken)
    necroRunDmgBonus, // Nekromant-V2 Phase 6: respawnPlayer() baut denselben Bonus nach
    necroRunHpBonus,
    // Nekromant-V2 Phase 3: Gegnertypen, die zum jetzigen Zeitpunkt des Akts
    // freigeschaltet sind -- tank.js: spawnGhostBomb() zieht daraus einen
    // zufaelligen Typ. run.js: buildCombatRoom() liefert die echte Liste;
    // Fallback [] fuer isolierte Test-/Debug-Raeume ohne Akt-Kontext.
    actEnemyPool: actEnemyPool || [],
    // Nekromant-V2 Phase 5 (Ereignis-/Stapelschicht): reine Infrastruktur,
    // aktuell hoert keine Karte zu (necroListeners bleibt leer, Phase 6+
    // fuellt ihn beim Roomaufbau). necroStacks/necroTimedStacks/
    // necroCooldownReadyAt sind raumweit und brauchen keinen expliziten
    // reset() -- state wird bei jedem Raumwechsel ohnehin frisch angelegt.
    // necroRunStackGain ist der raumlokale, monoton wachsende Anteil eines
    // runweiten Stapels -- run.js: stepRun() synchronisiert ihn per Delta
    // (Muster wie bonusScrap/seenBonusScrap) in run.necroStacks;
    // necroRunStacksBase ist der zu Raumbeginn kopierte Stand DIESES
    // Speichers, damit ein Lesezugriff waehrend des Raums den korrekten
    // Gesamtwert sieht (s. necro.js: getNecroStack()).
    necroListeners: [],
    // ghost_025 "Letzte Deckung": einmal pro Raum -- state ist pro Raum
    // frisch, also genuegt ein einfaches false hier (kein reset() noetig).
    necroLastStandUsed: false,
    // Nekromant-V2 Phase 7 (Legion): Cache-Defaults fuer die zaehlerbasierte
    // Skalierung (recomputeLegionCache() in ghost.js) -- gueltig, bis der
    // erste Spawn/Entfernen-Aufruf sie neu setzt (bei 0 Untertanen ohnehin
    // die richtigen Neutralwerte).
    necroActiveGhostCount: 0,
    necroLegionResistBonus: 0,
    necroPackMult: 1,
    necroLegionFireRatePct: 0,
    necroOverwhelmActive: false,
    necroSharedWillActive: false,
    // ghost_059 "Grabfeld": die letzten 3 Sterbeorte VON UNTERTANEN, raumweit
    // (kein reset() noetig, state ist pro Raum frisch).
    necroGraveyardSpots: [],
    // ghost_041 "Geteiltes Ziel": das zuletzt vom SPIELER getroffene Ziel.
    necroLastPlayerHitTarget: null,
    // ghost_054 "Legionskern": bis Raumende aktiver Schadensbonus fuer ALLE
    // Untertanen, sobald eine Wiederbelebungsprobe am vollen Limit gelingt.
    necroLegionKernActive: false,
    necroCoreCooldownUntil: 0,
    // ghost_080 "Kronenerbe" (Nekromant-V2 Phase 8): merkt sich beim Tod des
    // Champions ein Zeitfenster + einen Anteil seiner Fusionsboni fuer den
    // naechsten erscheinenden Untertan (ghost.js: createGhost()). "Einmal pro
    // Raum" -- necroCrownHeirUsed sperrt weitere Erbschaften (state ist pro
    // Raum frisch, kein reset() noetig).
    necroCrownHeir: null,
    necroCrownHeirUsed: false,
    // Nekromant-V2 Phase 9: ghost_089/104 garantieren "die naechste
    // Wiederbelebungsprobe" -- Fenster (089) bzw. Einmal-Flag (104), beide
    // sofort nach Verbrauch zurueckgesetzt (s. killTank()s Revive-Block).
    necroGuaranteedReviveUntil: 0,
    necroCircleGuaranteedRevive: false,
    necroCircleReviveStatPct: 0,
    // ghost_099 "Kroenungszug": raumweiter, dauerhafter Schadensbonus NUR
    // fuer den CHAMPION (ghost.js liest ihn, necro.js: necroDamagePct()
    // wirkt bewusst NICHT darauf -- das ist der Hauptpanzer-Kanal).
    necroCoronationPermDmgPct: 0,
    // ghost_100 "Ersatzkoerper": einmal pro Raum.
    necroSuccessionUsed: false,
    necroStacks: {},
    necroRunStackGain: {},
    necroRunStacksBase: necroRunStacksBase || {},
    necroTimedStacks: {},
    necroCooldownReadyAt: {},
    necroEventLog: [],
    // Nekromant-V2 Phase 10 (Lesbarkeit und Telemetrie): raumweite Rohzaehler
    // fuer main.js/telemetry.js -- werden dort nur ABGELESEN (nie
    // zurueckgeschrieben), wie ghostKills/playerShots weiter unten. Erzeugt
    // in ghost.js: pushGhost() (created)/fuseGhost() (fused)/killGhost()
    // (diedByReason), Wiederbelebungsquote in killTank()s Revive-Block,
    // Championstaerke jeden updateGhosts()-Tick, Bossschuesse in bossai.js.
    necroGhostsCreated: 0,
    necroGhostsFused: 0,
    necroGhostsDiedByReason: { death_damage: 0, death_expire: 0, sacrifice: 0 },
    necroReviveRolls: 0,
    necroReviveHits: 0,
    necroChampionStrengthSum: 0,
    necroChampionStrengthSamples: 0,
    bossShotsAtPlayer: 0,
    bossShotsAtGhost: 0,
    roomContext: roomContext || null, // { elite, boss } -- raumabhaengige Karten
    // LP-Skalierung dieses Raums (Phase 2) -- gemerkt, damit die zweite
    // Welle (updateWave) dieselben Werte bekommt wie die erste.
    // Blitzketten-Bogen (Phase 6): reine Anzeige, altert in stepState().
    lightningArcs: [],
    hpScale: hpScale ?? 1,
    hpSkipBosses: !!hpSkipBosses,
    rng: mulberry32((aiSeed ^ 0x9e3779b9) >>> 0), // KI-Strom, getrennt
    playerSpawn: room.playerSpawn,
    emergencyRoom: room.emergency,
    enemyKills: 0, // in diesem Raum getoetete Gegner
    playerDeaths: 0, // Tode des Spielers in diesem Raum
    playerShots: 0, // Spieler-Abzuege in diesem Raum (Trefferquote)
    // Grundsteinumbau Phase 2: Kampfkern-Telemetrie (Entscheidung I -- erst
    // messen, dann an LP/Balance drehen). playerHits zaehlt Treffer auf
    // Panzer (nicht Waende), magBlockedTime die Sekunden, in denen ein
    // gehaltener Feuerbefehl am vollen Magazin scheiterte (nicht am
    // Nachladen -- das ist normale Kadenz, kein Blockieren).
    playerHits: 0,
    magBlockedTime: 0,
    // Heck-Kill-Zeitlupe (Ersatz fuer den alten Trickshot-Moment, s.
    // stepRun() in run.js): laeuft wie blockedShotTimer unten in stepState()
    // herunter.
    rearKillTimer: 0,
    // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp, den der SPIELER an Gegnern
    // anrichtet -- die neue Telemetrie-Grundlage, die die ausgemusterten
    // USP-Kennzahlen (u. a. die freiwilligen Bankshots) ersetzt.
    damageByType: { physical: 0, explosive: 0, fire: 0, frost: 0, poison: 0, lightning: 0 },
    secondaryUses: 0,
    gadgetUses: 0, // P4: Nutzungen des zweiten Slots (Telemetrie)
    powershotsFired: 0,
    ghostKills: 0, // Phase 7: Kills durch Geister-Kugeln (nicht dem Spieler zugerechnet)
    // Beutejagd-Upgrade (Phase 18): eigener Raum-Zaehler fuer Schrott-Boni
    // ausserhalb des (mit dem Bandenschuss entfallenen) Trickshot-Systems --
    // run.js liest ihn per Sync-Delta wie bisher.
    bonusScrap: 0,
    firstKillGiven: false, // pro Raum einmalig, NICHT bei respawnPlayer() zuruecksetzen
    // Notschild-Ladungen als Liste: jede Ladung altert EINZELN (E2).
    // Eintrag = verbleibende geraeumte Raeume bis zum Verfall.
    shieldCharges: (shieldCharges || []).slice(),
    transform: transform || {}, // Phase 5: freigeschaltete Transformations-Effekte
    smokeClouds: [], // Phase 6: Rauchgranate -- blockiert nur KI-Sichtlinien
    pendingWave, // Phase 9: zurueckgehaltene zweite Welle (oder null)
    eliteAffixes: eliteAffixes || null, // Phase 9: fuer spaeter nachspawnende Welle
    modifier: modifier || null, // Phase 10: Raum-Modifikator (data/modifiers.json)
    // Deckungs-KI (Phase 16): 15-Hz-Takt + Reihum-Cursor fuer
    // updateCoverPerception() -- siehe ai.js.
    coverTimer: 0,
    coverCursor: 0,
    // Sperre fuer die "Magazin voll"-Rueckmeldung (tank.js:
    // signalBlockedShot) -- sonst klickt es bei gehaltenem Abzug dauernd.
    blockedShotTimer: 0,
    // Reaktor-Boss (Phase 14): Anzahl noch stehender Generatoren -- solange
    // > 0, faengt killTank() jeden Treffer auf t.cfg.bossInvincible ab.
    // Aus den Wandobjekten gezaehlt (nicht aus room.markers -- die Generator-
    // Waende sind bereits normale, aus dem Grid gebaute WALL_TYPES-Eintraege).
    bossGeneratorsLeft: walls.filter((w) => w.type === 'generator').length,
    // Raum-Gefahr (Phase 15): hoechstens EINE davon ist je Raum aktiv, der
    // Rest bleibt leer/null. `hazard` selbst nur fuer Vorschau/Rendering.
    hazard,
    movingWalls,
    movingWallTimer: hazard?.type === 'movingWall' ? hazard.intervalS : 0,
    oilCells, // Set<"col,row"> | null -- tank.js: Grip-Physik pro Kachel
    conveyor, // {cells:Set<"col,row">, dir:{x,y}, pushPx} | null
    laserWalls, // NIE in `walls`: blockt nur Geschosse (bullet.js), keine Panzer
    walls,
    // G5 (t_mason): das rohe Grid-Zeichen-Array. War bis dahin komplett
    // Closure-lokal (nur ueber Methoden wie isSolid()/placeTrapWall()
    // erreichbar) -- t_masons Zellenwahl braucht Lesezugriff auf EXAKT das
    // aktuelle Zeichen ('.' = frei), nicht nur ein Boolean. Muster wie
    // `walls` direkt oben: dieselbe Referenz, kein zweites Grid.
    grid,
    tanks,
    player,
    bullets: [],
    mines: [],
    // Spinnenboss-Auftrag: spiderBoss ist eine bequeme direkte Referenz auf
    // die t_spider-Tankinstanz (falls dieser Raum einer ist) -- erspart ein
    // wiederholtes state.tanks.find(...) an mehreren Stellen (Geschossbudget,
    // Rendering, Leg-Hit-Schleife). spiderMines/spiderWebs/spiderFlowField
    // sind eigene, von state.mines GETRENNTE Arrays (s. spidermine.js).
    spiderBoss: tanks.find((t) => t.cfg.spiderBoss) || null,
    spiderMines: [],
    spiderWebs: [],
    spiderFlowField: null,
    spiderPillars: null,
    // Amboss-Auftrag: bequeme direkte Referenz (Muster wie spiderBoss oben)
    // -- src/game/anvil.js, mine.js und die Trefferschleife weiter unten
    // lesen sie, statt jedes Mal state.tanks zu durchsuchen. anvilShockwaves/
    // anvilTrails sind eigene, von state.mines GETRENNTE Arrays fuer die
    // beiden ueberdauernden Angriffs-Gefahrenflaechen (Hammerschlag/
    // Schleifspur, s. src/game/anvil.js).
    anvilBoss: tanks.find((t) => t.cfg.anvilBoss) || null,
    anvilShockwaves: [],
    anvilTrails: [],
    // Gegner-Umbau Baustein B (Verbindungslinien, G1): EIN geteiltes Array
    // fuer alle fuenf Linienarten (Heilstrahl/Lichtfaden/Fahnenlinie/Kette/
    // Leine), von der jeweiligen Gegner-Stepfunktion jeden Tick neu befuellt
    // (Muster wie anvilShockwaves/anvilTrails oben) und von
    // effects.js: drawTankLinks() generisch gezeichnet. Populiert seit G3
    // (t_relay: Lichtfaden) und G5 (t_medic: Heilstrahl).
    tankLinks: [],
    // G8 (t_metronom): die lebenden Taktgeber dieses Ticks, einmal pro Tick
    // von updateMetronomes() gesetzt -- metronomeHolds() liest nur noch sie.
    metronomes: [],
    deathFuses: [], // G2: verzoegerte Todesexplosion (t_dud), s. killTank()/updateDeathFuses()
    // G5 (t_mason): 0,8-s-Geruest-Telegraph pro Bauversuch, eigener kleiner
    // Renderer (effects.js: drawMasonScaffolds) -- kein Baustein C (das ist
    // eine wachsende Kreisflaeche, hier ein statisches Quadrat).
    masonScaffolds: [],
    traps: [],
    mortars: [], // Grundsteinumbau Phase 3: fliegende Moerser-Granaten (t_green)
    ghosts: [], // Phase 7: Geisterpanzer (kein Eintrag in tanks -- s. ghost.js)
    explosions: [],
    flashes: [],
    sounds: [],
    particles: [],
    texts: [], // schwebende Kurztexte { x, y, text, age, life, color }
    killLog: [], // Typen der in diesem Raum getoeteten Gegner (Statistik)
    damageFlash: 0, // roter Bildschirm-Flash nach eigenem Tod (Rendering)
    shake: 0, // Screenshake-Staerke (nur Rendering)
    time: 0,
    respawnTimer: 0,
    // Solid-Test fuer Geschosse/Sichtlinien: 'o' (hole) blockiert NICHT.
    // 'd' (zerstoerbare Wand, Phase 11) ist bis zur Zerstoerung physisch
    // normal, 'g' (Reaktor-Generator, Phase 14) ebenso (aktuell unzerstoerbar,
    // s. WALL_TYPES-Kommentar oben).
    isSolid(px, py) {
      const col = Math.floor(px / CELL);
      const row = Math.floor(py / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
      const cell = grid[row][col];
      return cell === '#' || cell === 'b' || cell === 'd' || cell === 'g';
    },
    // Sicht-Test fuer KI-Raycasts (Phase 6): zusaetzlich zu Waenden
    // blockieren aktive Rauchwolken die Sicht -- Geschossphysik/Bewegung
    // bleiben unberuehrt (isSolid() ist dafuer weiter allein zustaendig).
    blocksSight(px, py) {
      if (state.isSolid(px, py)) return true;
      for (const c of state.smokeClouds) {
        const dx = px - c.x;
        const dy = py - c.y;
        if (dx * dx + dy * dy <= c.radius * c.radius) return true;
      }
      return false;
    },
    // Sekundärslot "Sperrmauer" (Phase 6): platziert eine haltbare Wand auf
    // der Zielzelle, sofern diese begehbar und frei von Panzern ist.
    // Rueckgabe: die neu angelegte Wand (truthy, wie das alte `true`) oder
    // `false` bei Fehlschlag. G5 (t_mason) braucht die Wand-REFERENZ selbst
    // (um sie mit masonExpiresAt zu markieren) -- ein reiner Boolean genuegte
    // bis dahin nur dem Spieler-Gadget (tank.js: placeTrapWall()), das das
    // Ergebnis rein als "used"-Wahrheitswert weiterreicht und mit einem
    // Objekt statt `true` unveraendert funktioniert.
    placeTrapWall(x, y, hits) {
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
      if (grid[row][col] !== '.') return false;
      const cx = col * CELL + CELL / 2;
      const cy = row * CELL + CELL / 2;
      for (const t of state.tanks) {
        if (t.alive && circlesOverlap(cx, cy, CELL / 2, t.x, t.y, t.cfg.radius)) return false;
      }
      const wall = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'trap', col, row, customDurability: hits };
      state.walls.push(wall);
      grid[row][col] = '#';
      state.sounds.push({ name: 'mine', x: cx });
      return wall;
    },
    destroyWall(wall) {
      // Transformation "Baumeister" (Phase 5): Waende halten wallDurability
      // Treffer statt einem -- der erste Treffer beschaedigt sie nur.
      // Sperrmauer (Phase 6), zerstoerbare Waende (Phase 11) und Reaktor-
      // Generatoren (Phase 14) bringen ihre eigene Haltbarkeit mit, die
      // das ueberschreibt.
      let durability = wall.customDurability || wall.destructibleHits || state.transform.wallDurability || 1;
      // Sappeur-Upgrade (Phase 18, Welle 3): rissige Waende (Phase 11)
      // fallen frueher. Bewusst NUR fuer `destructible` -- die eigene
      // Sperrmauer (customDurability) und die Pionier-Verstaerkung sollen
      // nicht gegen den Spieler selbst wirken.
      if (wall.type === 'destructible' && state.player?.cfg?.wallHitsReduction) {
        durability = Math.max(1, durability - state.player.cfg.wallHitsReduction);
      }
      if (durability > 1) {
        wall.hits = (wall.hits || 0) + 1;
        if (wall.hits < durability) {
          state.spawnParticles(
            wall.x + wall.w / 2,
            wall.y + wall.h / 2,
            wall.type === 'generator' ? '#ffd23c' : '#8a7355',
            3,
            60,
          );
          return; // beschaedigt, aber noch da
        }
      }
      const i = state.walls.indexOf(wall);
      if (i >= 0) state.walls.splice(i, 1);
      grid[wall.row][wall.col] = '.';
      // Steinbruch-Upgrade (Phase 18, Welle 3): eingerissene Waende lassen
      // Schrott zurueck. Nur die beiden "Wand geht kaputt"-Typen -- die
      // eigene Sperrmauer waere sonst eine Schrott-Druckmaschine (legen,
      // kaputtschiessen, wiederholen), Boss-Generatoren ein Sonderfall.
      const scrapPerWall = state.player?.cfg?.scrapPerWall || 0;
      if (scrapPerWall && (wall.type === 'destructible' || wall.type === 'breakable')) {
        state.bonusScrap += scrapPerWall;
      }
      // Reaktor-Generator (Phase 14): eigener Zaehler + deutliches Feedback --
      // sobald der letzte faellt, wird der Reaktorkern verwundbar.
      if (wall.type === 'generator') {
        state.bossGeneratorsLeft = Math.max(0, state.bossGeneratorsLeft - 1);
        state.sounds.push({ name: 'trickshot2', x: wall.x + wall.w / 2 });
        state.addShake(5);
        state.spawnParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, '#ffd23c', 16, 200);
        state.texts.push({
          x: wall.x + wall.w / 2,
          y: wall.y + wall.h / 2 - 10,
          text:
            state.bossGeneratorsLeft > 0
              ? `Generator zerstört! (${state.bossGeneratorsLeft} übrig)`
              : 'Reaktor entsichert!',
          age: 0,
          life: 1.2,
          color: '#ffd23c',
        });
        return;
      }
      state.spawnParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, '#8a7355', 6, 90);
    },
    // Spinnenboss (Abschnitt 21/22): generischer Wand-Ein-/Ausschalter, der
    // GRID (isSolid()/KI-Sichtlinien/Renderer lesen alle dasselbe grid) UND
    // state.walls synchron haelt -- dasselbe Grundmuster wie
    // tickMovingWalls() darunter, hier aber von AUSSEN (src/game/spider.js)
    // aufrufbar: einmalig fuer den kompletten Wandabriss beim Uebergang in
    // Phase 3, wiederholt fuer die zwei auf-/abfahrenden Saeulen danach.
    setWallSolid(col, row, solid) {
      const existing = walls.find((w) => w.col === col && w.row === row);
      if (solid) {
        if (existing) return existing;
        const w = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'solid', col, row };
        walls.push(w);
        grid[row][col] = '#';
        return w;
      }
      if (existing) {
        const i = walls.indexOf(existing);
        if (i >= 0) walls.splice(i, 1);
      }
      grid[row][col] = '.';
      return null;
    },
    // G5 (t_mason): "Sicherung gegen Frust" -- true, wenn eine Wand auf
    // (col,row) irgendeine aktuell vom Spieler aus erreichbare Bodenzelle
    // abschneiden wuerde (ausser der Zielzelle selbst). Rein hypothetisch:
    // setzt das Grid-Zeichen kurz auf '#', vergleicht die Erreichbarkeits-
    // menge davor/danach, macht die Aenderung sofort wieder rueckgaengig.
    wouldIsolateArea(col, row) {
      const pCol = Math.floor(state.player.x / CELL);
      const pRow = Math.floor(state.player.y / CELL);
      const before = bfsReachable(grid, pCol, pRow);
      const prevCell = grid[row][col];
      grid[row][col] = '#';
      const after = bfsReachable(grid, pCol, pRow);
      grid[row][col] = prevCell;
      for (const k of before) {
        if (k === row * 1000 + col) continue; // die Zielzelle selbst faellt erwartungsgemaess weg
        if (!after.has(k)) return true;
      }
      return false;
    },
    // Bewegliche Wand (Phase 15): togglet alle `hazard.intervalS` Sekunden
    // zwischen solid und offen -- reiner add/remove eines 'solid'-Wand-
    // objekts, kein neuer Grid-Char noetig (isSolid()/hasLos() kennen '#'
    // und '.' bereits). Reversibel, anders als destroyWall().
    tickMovingWalls(dt) {
      if (!state.movingWalls.length) return;
      state.movingWallTimer -= dt;
      if (state.movingWallTimer > 0) return;
      state.movingWallTimer = state.hazard.intervalS;
      for (const mw of state.movingWalls) {
        if (mw.solid) {
          const i = state.walls.indexOf(mw.wallRef);
          if (i >= 0) state.walls.splice(i, 1);
          grid[mw.row][mw.col] = '.';
          mw.wallRef = null;
          mw.solid = false;
        } else {
          const w = { x: mw.x, y: mw.y, w: CELL, h: CELL, type: 'solid', col: mw.col, row: mw.row };
          state.walls.push(w);
          grid[mw.row][mw.col] = '#';
          mw.wallRef = w;
          mw.solid = true;
        }
      }
      // Dumpfer Ton als Bewegungs-Cue, geortet an der ersten bewegten Wand.
      state.sounds.push({ name: 'mine', x: state.movingWalls[0].x + CELL / 2 });
      state.addShake(2);
    },
    // Schaden zufuegen (UMBAUPLAN-LP Phase 1). Hier sitzt alles, was einen
    // Treffer ABWEHREN kann (Unverwundbarkeit, Schilde) -- danach wird
    // abgezogen und erst bei hp <= 0 die Todeslogik in killTank() gerufen.
    //
    // Warum die Abwehr-Gatter hierher und nicht in killTank() gehoeren:
    // Sie verhindern SCHADEN, nicht den Tod. Solange maxHp und damage
    // ueberall 1 sind, ist das exakt dasselbe Verhalten wie vorher (jeder
    // Treffer ist toedlich, also faengt ein Schild zwangslaeufig einen
    // toedlichen Treffer ab). Mit echten Lebenspunkten ab Phase 2/3 waere
    // die alte Platzierung dagegen falsch: ein Schild, das nur bei
    // toedlichen Treffern greift, waere eine zweite Lebensleiste.
    //
    // killTank() bleibt daneben als eigener, direkt aufrufbarer Trichter
    // fuer den Tod bestehen -- Kettenreaktionen, Statistik, Telemetrie und
    // Geisterpanzer haengen daran und bleiben unangetastet.
    applyDamage(tank, amount, cause, meta) {
      // Reaktorkern (Phase 14): unverwundbar, solange mindestens ein
      // Generator steht -- keine Ladung, kein Verbrauch, verfaellt nie von
      // selbst. Reiner Feedback-Ablehner wie die Schildladungen unten.
      // Gilt AUCH fuer Schaden ueber Zeit (Phase 5): sonst waere das
      // Generator-Raetsel mit einem Brandpfeil umgehbar.
      if (tank.cfg.bossInvincible && state.bossGeneratorsLeft > 0) {
        // Phase 7b: derselbe "Treffer wirkungslos abgewehrt"-Ton wie bei der
        // Panzerung -- nicht der Schildverlust-Ton, hier geht ja nichts verloren.
        state.sounds.push({ name: 'reflect', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#ffd23c', 6, 80);
        return;
      }
      // Spinnenboss (Abschnitt 10/26): der Koerper ist geschuetzt, solange
      // noch mindestens ein Bein lebt UND kein Bein-Verlust-Betaeubungsfenster
      // laeuft (tank.spiderVulnerableTimer) -- EIN Gatter deckt JEDE
      // Schadensquelle ab (Kugel, Explosion, Statuseffekt-Tick), statt es an
      // jeder Aufrufstelle einzeln nachzubauen. meta.code
      // 'spider_spawn_mine' ist die EINE ausdrueckliche Ausnahme (Abschnitt
      // 15: eine frisch am Boss haengende Spinnenmine kann ihn trotzdem
      // treffen). Sobald kein Bein mehr lebt, greift dieses Gatter nicht mehr
      // (Phase 3: dauerhaft verwundbar).
      if (
        tank.cfg.spiderBoss &&
        tank.spiderLegsAlive > 0 &&
        !(tank.spiderVulnerableTimer > 0) &&
        meta?.code !== 'spider_spawn_mine'
      ) {
        state.sounds.push({ name: 'reflect', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8a6ad8', 5, 70);
        return;
      }
      // Kettenhund (G7, t_tether): JEDER Schaden an einem gebundenen Panzer
      // wird 50/50 zwischen ihm und seinem Partner geteilt -- GANZ AM ANFANG,
      // bevor irgendeine der beiden Seiten ihre EIGENE Abwehr (Resistenz/
      // Schild/Exekution) darauf anwendet (jede Seite rechnet unabhaengig,
      // ein Gepanzerter in der Kette blockt seinen Anteil normal). Zwei
      // getrennte, rekursive applyDamage()-Aufrufe statt einer einzigen
      // Ableitung -- meta.tetherSplit verhindert die Ping-Pong-Rekursion
      // (der Partner hat selbst wieder einen tetherPartner, der auf DIESEN
      // Panzer zeigt). "Split, nicht verdoppelt": der GESAMTSCHADEN bleibt
      // gleich, nur auf zwei LP-Pools verteilt (6 Treffer a 10 Schaden = 60
      // gesamt = 30/30 bei maxHp 30 -- beide sterben gleichzeitig, exakt wie
      // im Designdokument vorgerechnet).
      // BUGFIX: die Regel gilt fuer BEIDE Seiten der Kette ("jeder Schaden an
      // einem der beiden", Kartentext). Ein Kettenhund kann sich mangels
      // zweitem Kettenhund auch an einen ganz normalen Verbuendeten binden --
      // der traegt dann selbst kein cfg.tether. Vorher teilte nur ein Treffer
      // AUF den Kettenhund; ein Treffer auf seinen Partner ging voll durch,
      // sodass sich die Kette umgehen liess, indem man einfach die andere
      // Seite erschoss. Die Rezeptur kommt jetzt von der Seite, die sie hat.
      const tetherCfg = tank.cfg.tether || tank.tetherPartner?.cfg?.tether;
      if (tetherCfg && tank.tetherPartner?.alive && !meta?.tetherSplit) {
        const half = (amount ?? 1) * (tetherCfg.splitPct ?? 0.5);
        const partner = tank.tetherPartner;
        tank.tetherFlashUntil = state.time + 0.2;
        partner.tetherFlashUntil = state.time + 0.2;
        state.applyDamage(tank, half, cause, { ...meta, tetherSplit: true });
        if (partner.alive) state.applyDamage(partner, half, cause, { ...meta, tetherSplit: true });
        return;
      }
      // Schadensresistenz (Nekromant-V2 Phase 2): wirkt GENERISCH auf JEDEN
      // Schaden, der diesen Panzer ueberhaupt erreicht -- auch auf Schaden
      // ueber Zeit (ein resistenter Panzer soll auch gegen Brand/Gift zaeher
      // sein), deshalb VOR der DOT-Weiche unten. Rechenweg + Begruendung:
      // s. applyResistToAmount() oben.
      // ghost_022 "Haerte aus Verlust" (Nekromant-V2 Phase 6): zeitlich
      // befristeter Resistenz-Bonus NUR fuer den Spieler, additiv zur
      // festen cfg.resist -- necroResistBonus() summiert den generischen
      // Timed-Stack, kein zweites Resistenzfeld auf cfg noetig.
      const effResistCfg =
        tank === state.player && necroResistBonus(state) > 0
          ? { resist: (tank.cfg.resist || 0) + necroResistBonus(state) }
          : tank.cfg;
      amount = applyResistToAmount(effResistCfg, state.data.balance?.resist, amount);
      // Schaden ueber Zeit (Phase 5) ueberspringt ALLE Schild-Gatter
      // darunter. Ein Schild, der "den naechsten Treffer abfaengt", darf
      // nicht an einem 4-Punkte-Brandtick verpuffen -- sechs Ticks wuerden
      // sonst drei Ladungen in anderthalb Sekunden verbrauchen. Die
      // Boss-Unverwundbarkeit oben gilt dagegen weiter.
      if (meta?.overTime) {
        // BUGFIX: laeuft jetzt ueber denselben resolveLethalHit() wie jeder
        // andere durchkommende Treffer -- ein toedlicher Statuseffekt-Tick
        // (Brand/Gift) kann "Letzte Deckung" damit genauso ausloesen wie ein
        // toedlicher Kugeltreffer (Kartentext nennt keine Einschraenkung auf
        // Geschosse). Exekutionsschwelle/Bodenklammer unveraendert innerhalb
        // von resolveLethalHit().
        resolveLethalHit(state, tank, amount, cause, meta);
        return;
      }
      // Schild als Punktepool (Nekromant-V2 Phase 2): faengt Schaden VOR hp
      // ab -- gilt fuer JEDEN Panzer (Spieler, Gegner; Untertanen ueber die
      // eigene Ghost-Kollisionsschleife unten). Absichtlich VOR den beiden
      // Notschild-Gattern geprueft: fuer Gegner ist dieser Pool aktuell die
      // EINZIGE Schild-Option, ein bereits voll abgefangener Treffer soll
      // keine der spielerexklusiven Ladungen verbrauchen. s. absorbWithShieldPool() oben.
      amount = absorbWithShieldPool(state, tank, amount);
      if (amount <= 0) return;
      // Notschild-Ladung faengt genau einen Treffer ab (raumuebergreifend,
      // keine Regeneration). Kurzer Schutz verhindert Mehrfachverbrauch im
      // selben Explosions-Frame.
      if (tank === state.player && state.shieldCharges.length > 0) {
        state.shieldCharges.shift(); // aelteste Ladung zuerst
        tank.protect = Math.max(tank.protect, 0.6);
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 12, 130);
        return;
      }
      // Elite-Affix "gepanzert"/"Regenerierschild": Gegnerschild faengt
      // genau einen Treffer ab. Mit regenShieldS laedt sich die Ladung
      // danach neu auf, statt fuer den Rest des Raums zu verfallen.
      if (tank !== state.player && tank.shieldReady) {
        tank.shieldReady = false;
        tank.protect = Math.max(tank.protect, 0.3);
        if (tank.regenShieldS) tank.regenShieldTimer = tank.regenShieldS;
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 8, 100);
        return;
      }
      // Spieler-Schild = Schadensabsorber (UMBAUPLAN-LP Phase 8): faengt die
      // naechsten shieldHp Punkte ab, Rest geht durch. Bewusst KEIN
      // protect-Fenster mehr, solange der Absorber noch Punkte hat -- sonst
      // schluckte ein einziger Treffer 0,6 s lang allen weiteren Schaden und
      // der Schild waere wieder eine zweite Lebensleiste statt eines Puffers.
      if (tank === state.player && tank.shieldReady) {
        const absorbed = Math.min(tank.shieldHp || 0, amount ?? 1);
        tank.shieldHp = (tank.shieldHp || 0) - absorbed;
        amount = (amount ?? 1) - absorbed;
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 8, 110);
        if (tank.shieldHp <= 0) {
          // Absorber erschoepft -> Schild bricht.
          tank.shieldReady = false;
          tank.protect = Math.max(tank.protect, 0.6);
          state.spawnParticles(tank.x, tank.y, '#8ecaf0', 12, 130);
          // Konterschild: feuert beim Bruch einen Kugelkranz.
          if (tank.cfg.counterShield) {
            spawnRadialBullets(state, tank, tank.x, tank.y, tank.cfg.counterShieldCount, 150);
          }
          // Nachladeschild-Upgrade (Phase 18): laedt sich nach shieldRegenS
          // von selbst neu -- wiederverwendet denselben regenShieldTimer/
          // shieldReady-Tick, den das Regenerierschild-Elite-Affix (Phase 9)
          // schon fuer Gegner nutzt (Tick-Schleife unten, kein neuer Code).
          if (tank.cfg.shieldRegenS) tank.regenShieldTimer = tank.cfg.shieldRegenS;
        }
        // Vollstaendig abgefangen -> fertig. Sonst faellt der Restschaden
        // unten durch die normale hp-Verrechnung (kann bei grossem Treffer
        // trotz Schild toeten). BUGFIX: lief hier vorher an "Letzte
        // Deckung" (ghost_025) vorbei direkt in killTank() -- ein Treffer,
        // der den Schild-Absorber durchschlug, war dadurch NIE rettbar,
        // ein Treffer OHNE Schild (Fallthrough unten) schon. Ein Schild
        // machte den Nekromanten so verwundbarer statt zaeher. Jetzt
        // derselbe gemeinsame Ausgang wie ueberall sonst.
        if (amount <= 0) return;
        resolveLethalHit(state, tank, amount, cause, meta);
        return;
      }
      // ghost_025 "Letzte Deckung" (Nekromant-V2 Phase 6) wirkt jetzt
      // GENERISCH innerhalb von resolveLethalHit() -- einmal pro Raum
      // opfert ein TOEDLICHER Treffer (Kugel, Explosion, Statuseffekt-Tick,
      // ein den Schild-Absorber durchschlagender Rest) den SCHWAECHSTEN
      // aktiven Untertanen statt den Hauptpanzer, NACH allen obigen Abwehr-
      // Gattern (ein Schild soll weiterhin zuerst greifen), aber VOR dem
      // hp-Abzug. Ohne aktiven Untertanen (state.ghosts leer) wirkungslos,
      // wie im Auftrag gefordert. Der geopferte Untertan wird direkt
      // entfernt (kein killGhost()-Aufruf -- die Karte ist reine Rettung,
      // kein Geistertod im Sinne der Tabelle, loest also keine weiteren
      // Karteneffekte aus).
      //
      // Kein Gatter hat gegriffen -> der Treffer geht durch. Der Schaden wird
      // immer abgezogen (hp bleibt eine ehrliche Zahl).
      resolveLethalHit(state, tank, amount, cause, meta);
    },
    // Verwerter (G7, t_harvester): "stirbt ein Panzer ODER Geist in
    // radiusPx Umkreis, waechst er dauerhaft" -- als state-Methode statt
    // Modulfunktion, damit sowohl killTank() (state.js) als auch killGhost()
    // (ghost.js) sie ueber das bereits vorhandene state-Argument aufrufen
    // koennen (Muster wie damageGhostsInRadius/registerAnvilRage). excludeTank
    // schliesst den gerade sterbenden Panzer selbst aus (relevant, falls ein
    // Verwerter sich selbst als "in Reichweite" faende -- praktisch nie, da
    // er zu diesem Zeitpunkt schon !alive ist, aber ausdruecklich statt
    // implizit ausgeschlossen). Der maxHp-Zuwachs heilt NICHT (healOnStack:
    // false in den Daten) -- er macht nur zaeher fuer KUENFTIGE Treffer.
    applyHarvestGrowth(x, y, excludeTank) {
      for (const h of state.tanks) {
        if (h === excludeTank || !h.alive || !h.cfg.harvest) continue;
        const hc = h.cfg.harvest;
        const d2 = (h.x - x) ** 2 + (h.y - y) ** 2;
        if (d2 > hc.radiusPx * hc.radiusPx) continue;
        h.harvestStacks = (h.harvestStacks || 0) + 1;
        h.cfg.maxHp += hc.hpPerStack;
        h.cfg.damage += hc.damagePerStack;
        if (hc.healOnStack) h.hp += hc.hpPerStack;
        state.spawnParticles?.(x, y, '#ff3030', 5, 80);
        state.sounds.push({ name: 'combo', x: h.x });
      }
    },
    // Spinnenboss (Abschnitt 16): explodeAt() (mine.js) iteriert nur
    // state.tanks -- Geister/Champion leben getrennt in state.ghosts und
    // brauchen denselben Resistenz-/Schildpool-Rechenweg wie die
    // "Gegner-Geschosse gegen Geister"-Schleife weiter unten, nur fuer eine
    // KREISFOERMIGE Quelle statt eines einzelnen Geschosses (spidermine.js:
    // detonateSpiderMine() ruft dies direkt NACH explodeAt() auf). Generisch
    // genug fuer jede kuenftige AOE-Quelle gegen Geister.
    // BUGFIX: EIN einzelnes Untertan-Ziel schaedigen (Resistenz + Schildpool
    // + killGhost, wortgleich zum Koerper von damageGhostsInRadius() unten).
    // Fuer eine Quelle, die eine Reihe BEREITS bekannter Einzelziele nach der
    // Reihe abarbeitet (Amboss: Schockwelle/Schleifspur pruefen Spieler UND
    // jeden Geist EINZELN in einer eigenen Schleife) -- nicht fuer eine
    // echte Flaechenquelle mit einem gemeinsamen Mittelpunkt (dafuer bleibt
    // damageGhostsInRadius() zustaendig). Vorher rief anvil.js
    // damageGhostsInRadius(g.x, g.y, 1, dmg) JE GEIST auf: bei zwei oder mehr
    // Untertanen nahe beieinander (haeufig bei einem Legion-/Champion-Build)
    // traf jeder dieser Aufrufe ALLE ueberlappenden Geister erneut, nicht nur
    // den einen gemeinten -- ein Segment/eine Schockwelle richtete dadurch
    // ein Vielfaches ihres Schadens an, je dichter die Untertanen standen.
    damageGhost(g, dmg) {
      if (!g.alive || g.invulnUntil > state.time) return;
      let amount = applyResistToAmount(g.cfg, state.data.balance?.resist, dmg);
      amount = absorbWithShieldPool(state, g, amount);
      if (amount <= 0) return;
      g.hp -= amount;
      if (g.hp <= 0) killGhost(state, g);
    },
    damageGhostsInRadius(x, y, R, dmg) {
      for (const g of state.ghosts) {
        if (!g.alive || g.invulnUntil > state.time) continue;
        if (!circlesOverlap(x, y, R, g.x, g.y, g.cfg.radius)) continue;
        state.damageGhost(g, dmg);
      }
    },
    // Amboss-Auftrag (Abschnitt 6, Zorn als Angriffspaket): der ZENTRALE
    // Zorn-Zugang -- als state-Methode statt als Modulfunktion, damit
    // mine.js/tank.js/ghost.js/damagetypes.js sie ohne einen weiteren Import
    // (und ohne Zirkelimport-Risiko) einfach ueber das bereits vorhandene
    // `state`-Argument aufrufen koennen (Muster wie state.applyDamage/
    // state.spawnParticles). Kennt NUR `kind` ('direct'/'explosion'/'ghost')
    // + eine STABILE Ereigniskennung -- kein Aufrufer muss die Zornbetraege
    // selbst kennen, die stehen ausschliesslich in data/balance.json.
    //
    // Dedupe: `processedRageEvents` (ein Set aus "kind:eventId"-Schluesseln)
    // verhindert, dass dasselbe Angriffspaket (z. B. mehrere Kugeln eines
    // Doppelrohr-/Streuschuss-Abzugs, die sich EINE rageEventId teilen, oder
    // eine Kugel UND ihre eigene Explosion) zweimal Zorn ausloest. Bewusst
    // KEIN Zorn durch Statuseffekt-Ticks/Blitzketten/Kamikaze/Sabotage:
    // diese Quellen rufen registerAnvilRage() schlicht nie auf (die einzigen
    // drei Aufrufstellen sind die Haupttrefferschleife, der explosive-
    // Geschoss-Detonationsblock unten in dieser Datei und mine.js: explode()).
    //
    // rageLocked (Raserei + Zusammenbruch, Abschnitt 13/14): Zornaufbau UND
    // -abbau sind dort VOLLSTAENDIG gesperrt -- ein frueher return hier
    // deckt das fuer den Aufbau ab, der passive/aktive Abbau in
    // src/game/anvil.js liest dasselbe Feld.
    //
    // Geistersalven-Buendelung (ghostBatchS): mehrere GETRENNTE Salven
    // (verschiedene eventId, aber innerhalb des Zeitfensters) werden zu
    // einem gemeinsamen Zornbetrag zusammengefasst -- die zweite und jede
    // weitere Salve im Fenster dedupt zwar ihre eigene eventId (kein
    // zweites Auftreten derselben Salve moeglich), traegt aber selbst
    // keinen zusaetzlichen Zornbetrag bei (Test 19/20).
    registerAnvilRage(kind, eventId) {
      const boss = state.anvilBoss;
      if (!boss || !boss.alive) return;
      const acfg = state.data.balance?.boss?.anvil;
      if (!acfg) return;
      if (boss.rageLocked) return;
      if (!boss.processedRageEvents) boss.processedRageEvents = new Set();
      const fullKey = kind + ':' + eventId;
      if (boss.processedRageEvents.has(fullKey)) return;
      boss.processedRageEvents.add(fullKey);
      const amount =
        kind === 'direct' ? acfg.directRage ?? 0 : kind === 'explosion' ? acfg.explosionRage ?? 0 : kind === 'ghost' ? acfg.ghostVolleyRage ?? 0 : 0;
      let applied = amount;
      if (kind === 'ghost') {
        const withinBatch = boss.lastGhostRageAt != null && state.time - boss.lastGhostRageAt < (acfg.ghostBatchS ?? 0.25);
        if (withinBatch) applied = 0; // gemeinsamer Beschuss -- schon abgegolten
        else boss.lastGhostRageAt = state.time;
      }
      // Startet die Karenz des passiven Abbaus neu -- gilt fuer JEDES
      // zornrelevante Ereignis, auch ein in ein Buendel eingereihtes
      // (Abschnitt 7: "Ein neuer zornrelevanter Angriff startet die Karenz
      // neu", ohne Einschraenkung auf einzelne, nicht gebuendelte Treffer).
      boss.lastRageEventAt = state.time;
      // Telemetrie (Abschnitt 20): laengste Pause zwischen zwei angenommenen
      // (nicht doppelt gezaehlten) zornrelevanten Ereignissen.
      if (state.anvilLastRageTrackedAt != null) {
        state.anvilTimeWithoutRageHit = Math.max(
          state.anvilTimeWithoutRageHit || 0,
          state.time - state.anvilLastRageTrackedAt
        );
      }
      state.anvilLastRageTrackedAt = state.time;
      if (kind === 'ghost' && applied > 0) {
        state.anvilGhostRageGenerated = (state.anvilGhostRageGenerated || 0) + applied;
      }
      if (applied > 0) {
        boss.rage = Math.min(acfg.rageMax ?? 100, (boss.rage || 0) + applied);
        // Trefferanzeige (Abschnitt 17): hoechstens EINE pro Angriffspaket --
        // ergibt sich automatisch, weil applied>0 nur einmal je Paket erreicht
        // wird (Dedupe oben) bzw. nur einmal je Geistersalven-Buendel.
        state.texts.push({
          x: boss.x,
          y: boss.y - boss.cfg.radius - 20,
          text: `+${applied} Zorn`,
          age: 0,
          life: 0.7,
          color: '#ff9a4a',
        });
      }
    },
    // Reine Todeslogik -- ab hier ist der Panzer tot, es gibt keine
    // Abwehr mehr. Bewusst weiterhin direkt aufrufbar (Tests raeumen damit
    // Raeume ab), aber im Spielcode ruft sie nur noch applyDamage().
    killTank(tank, cause, meta) {
      if (!tank.alive) return; // doppelter Tod im selben Frame (Kettenreaktion)
      tank.alive = false;
      // Amboss-Auftrag (Abschnitt 19, Boss-Tod und Aufraeumen): Raserei/
      // Rammwarnung sind reine Modus-/Timer-Felder auf dem Panzer selbst und
      // verschwinden automatisch (kein weiterer stepAnvilBoss()-Aufruf mehr,
      // da die Gegner-Schleife `!t.alive` bereits ueberspringt UND der
      // Renderer `drawTank()`/die Panzerungs-/Zorn-Overlays bei !t.alive gar
      // nicht erst zeichnet). Schockwellen und Schleifspuren leben dagegen
      // in EIGENEN, vom Panzer getrennten Arrays -- die muessen hier explizit
      // geleert werden, sonst blieben sie als "unsichtbare, aber noch
      // aktive" Gefahrenflaechen stehen bzw. wuerden ohne einen weiteren
      // stepAnvilBoss()-Tick nie mehr aufgeraeumt.
      if (tank.cfg.anvilBoss) {
        state.anvilShockwaves = [];
        state.anvilTrails = [];
        // Telemetrie (Abschnitt 20): Kampfdauer = Zeit seit Raumstart (der
        // Amboss-Raum enthaelt sonst keine weiteren Gegner, state.time
        // laeuft seit `createState()` bei 0 los) + durchschnittlicher Zorn
        // aus der pro Tick gesampelten Summe (anvil.js: stepAnvilBoss()).
        state.anvilFightDuration = state.time;
        state.anvilAverageRage =
          state.anvilRageSampleCount > 0 ? state.anvilRageSampleSum / state.anvilRageSampleCount : 0;
      }
      // Phase 7b (Abnahmekriterium aus PLAN.md): bis hierher spielte JEDER
      // Tod denselben 'death'-Ton -- ein Gegner-Kill klang identisch zum
      // eigenen Tod. Jetzt zwei klar getrennte Sounds; zusammen mit dem
      // bereits eigenen 'shield' sind Leben-, Schild- und Gegnerverlust
      // hoerbar unterscheidbar (Punkt 6 der Phasenliste).
      state.sounds.push({ name: tank === state.player ? 'player_death' : 'kill', x: tank.x });
      state.addShake(4);
      state.spawnParticles(tank.x, tank.y, DEBRIS_COLORS[tank.type] || '#fff', 10, 120);
      // Exekutions-Kill (Phase 2): kraeftigerer Einschlag als Rueckmeldung
      // fuer den garantierten Kill -- tank.executing wurde diesen Tick schon
      // VOR dem toedlichen Treffer gesetzt (applyDamage() ruft killTank() in
      // diesem Fall immer ueber den Exekutions-Zweig, nie ueber die normale
      // hp<=0-Pruefung, s. o.).
      if (tank.executing) {
        state.addShake(5);
        state.spawnParticles(tank.x, tank.y, '#ffd23c', 14, 200);
      }
      if (tank === state.player) {
        // Kamikaze: der Spieler explodiert beim Sterben.
        if (tank.cfg.kamikazeRadius) {
          // Kill-Zuordnung (Phase 6): tank ist an dieser Stelle noch
          // state.player (== der gerade sterbende Spieler).
          explodeAt(state, tank.x, tank.y, tank.cfg.kamikazeRadius, null, { killer: tank });
        }
        state.playerDeaths++;
        state.lastDeathCause = cause || 'Unbekannt';
        // Strukturierte Todesursache fuer die Telemetrie (nur Instrument;
        // die Spiellogik liest diese Felder nie zurueck).
        state.lastDeathCauseCode = meta?.code || null;
        state.lastDeathEnemyType = meta?.enemyType || null;
        state.lastDeathBulletOwner = meta?.bulletOwner || null;
        state.lastDeathBulletDistance = meta?.bulletDistance ?? null;
        state.damageFlash = 0.5;
        state.respawnTimer = RESPAWN_DELAY;
      } else {
        // Blindgaenger (G2, t_dud): jeder Tod -- egal wodurch -- startet
        // eine verzoegerte Explosion an der Sterbeposition statt sofort zu
        // zuenden (updateDeathFuses() zuendet nach fuseS ueber den normalen
        // explodeAt()-Pfad, spare:null trifft dabei ausdruecklich auch
        // andere Gegner). Laeuft VOR dem uebrigen Kill-Bonus-Block, damit
        // ein Blindgaenger, der selbst als Kettenreaktion eines anderen
        // Kills stirbt, seine Zuendung nicht verliert.
        if (tank.cfg.deathBlast) {
          const db = tank.cfg.deathBlast;
          state.deathFuses.push({
            x: tank.x,
            y: tank.y,
            radiusPx: db.radiusPx,
            damage: db.damage,
            age: 0,
            fuseS: db.fuseS,
            dead: false,
          });
          state.sounds.push({ name: 'mine_warn', x: tank.x });
        }
        state.enemyKills++;
        state.killLog.push(tank.type);
        // Verwerter (G7, t_harvester): "meine Gegner sterben" -- der
        // Spieler toetet ein Enemy, das feeded jeden lebenden Verwerter in
        // Reichweite. Bewusst NUR im Nicht-Spieler-Zweig (die Frage, "wo
        // sterben meine Gegner", meint eindeutig Feindtode, nicht den
        // eigenen Tod -- derselbe Zweig-Entscheid wie beim deathBlast-Hook
        // oben, t_dud).
        state.applyHarvestGrowth(tank.x, tank.y, tank);
        const pc = state.player.cfg;
        // Beutejagd-Upgrade (Phase 18): der ERSTE Kill in jedem Raum gibt
        // sofort Bonus-Schrott -- eigener Raum-Zaehler (Muster wie
        // bonusScrap/steinbruch), nicht an killTank()s Aufrufart gebunden
        // (zaehlt also auch bei einem Ghost-/Minen-/Kettenblitz-Kill als
        // erster Kill).
        if (!state.firstKillGiven && pc.firstKillScrap) {
          state.firstKillGiven = true;
          state.bonusScrap += pc.firstKillScrap;
        }
        if (state.player.alive) {
          // Aasgeier: Abschuss gibt das VOLLE Magazin zurueck -- Cooldown weg
          // und alle eigenen, gerade fliegenden Kugeln zaehlen nicht mehr
          // dagegen (tank.js: liveBulletsOf). Sie fliegen weiter und toeten
          // weiter, blockieren aber keinen Magazinplatz mehr.
          if (pc.scavenger) {
            state.player.cooldown = 0;
            for (const b of state.bullets) {
              if (!b.dead && b.owner === state.player) b.magFreed = true;
            }
          }
          // Blutrausch: kurzer Tempo-Schub (bloodlust) + nur ein kurzer
          // Unverwundbarkeits-Moment (bloodlustIframe), damit sich Kills
          // nicht zu dauerhafter Unverwundbarkeit stapeln.
          if (pc.bloodlust) {
            state.player.protect = Math.max(state.player.protect, pc.bloodlustIframe);
            state.player.bloodTimer = pc.bloodlust;
          }
        }
        // Kettenblitz: kleine Explosion am Ort des Kills (verschont den
        // Spieler) -> kann weitere Gegner mitreissen (Kettenkills). Kill-
        // Zuordnung (Phase 6): der Spieler ist der Urheber der Karte.
        if (pc.chainLightning) {
          explodeAt(state, tank.x, tank.y, pc.chainLightning, state.player, { killer: state.player });
        }
        // Nekromant: Klassenidentitaet (Upgradepool-v2 Phase 6), Basiswerte
        // seit Nekromant-V2 Phase 3 grundlegend neu: EIN einheitlicher
        // reviveChance-Wert (egal ob der Kill vom Spieler-als-Nekromant oder
        // von einem bereits vorhandenen Geist kommt -- die alte, zweistufige
        // spawnChance.necro/.ghost ist archiviert, s. archive/ghost-tank-v1
        // .json), UND der wiederbelebte Untertan erbt den TYP des getoeteten
        // Gegners (Rolle/Waffe/Panzerung/Tempo bleiben, nur maxHp/damage
        // werden auf baseStatPct gestutzt -- s. ghost.js: resolveGhostCfg()).
        // Elite-/Boss-Ausnahme (Auftrag Abschnitt 3): ein Gegner mit
        // Elite-Affix (t.affixes, Phase 9) oder ein Boss (isBossCfg) wird nie
        // wiederbelebt -- sonst waere ein wiederbelebter Boss/Elite eine
        // zweite, unbeabsichtigte Kampfarena. Ueber den Seed-RNG (state.rng),
        // nie Math.random -- der Run bleibt deterministisch.
        const killer = meta?.killer;
        const gcfg = state.data.balance.ghost || {};
        const necroKill = pc.necromancer && (killer === state.player || killer?.isGhost);
        const isBoss = isBossCfg(tank.cfg);
        const isElite = !!(tank.affixes && tank.affixes.length > 0);
        // Champion-/Nekromant-Nachschliff Abschnitt 12 (UEBERARBEITET):
        // Elitegegner sind GENERELL wiederbelebbar, nicht mehr nur mit
        // ghost_056 "Elite-Reaktivierung" -- die Karte hebt seither nur noch
        // den Basiswert-Anteil auf 90 % an (s. overrides weiter unten). Bosse
        // bleiben in JEDEM Fall ausgeschlossen (Auftrag: "Bosse bleiben
        // ausgeschlossen").
        const canRevive = necroKill && !isBoss;
        if (canRevive) {
          // Seelenruf/Geisterlegion/Armee der Toten (Upgradepool-v2 Phase 8,
          // ghost_036/060 seit Phase 7): ghostMaxAdd erhoeht das Basislimit
          // additiv, ohne Obergrenze.
          const ghostCap = (gcfg.maxActive ?? 3) + (pc.ghostMaxAdd || 0);
          // "Rechenweg statt Obergrenze" (Auftrag Abschnitt 4a): reviveChance
          // ist additiv OHNE Deckel -- ueber 100 % erzeugt der ganzzahlige
          // Anteil sichere Zusatz-Untertanen. Nekromant-V2 Phase 7
          // (ghost_044/055 "Totenruf"): necroReviveChanceAdd kommt vom
          // Spieler-cfg dazu, ebenfalls ohne Deckel.
          // ghost_101 "Seelenlieferanten" (Nekromant-V2 Phase 9): Abschuesse
          // DURCH Untertanen (killer?.isGhost) bekommen zusaetzlich eine
          // EIGENE, unabhaengige Chance obendrauf -- additiv ohne Deckel wie
          // necroReviveChanceAdd selbst.
          const ghostKillBonus = killer?.isGhost ? pc.necroHybridGhostKillReviveChance || 0 : 0;
          const chance = (gcfg.reviveChance ?? 0) + (pc.necroReviveChanceAdd || 0) + ghostKillBonus;
          // ghost_089 "Wechselopfer" (Gadget) / ghost_104 "Kreislauf der
          // Verdammten" (keystone): beide garantieren "die naechste
          // Wiederbelebungsprobe" -- ein aktives Zeitfenster (089) bzw. ein
          // einmaliges Flag (104) erzwingt hier mindestens 1 Untertan, wird
          // danach sofort verbraucht (kein Nachwirken auf die UEBERNAECHSTE
          // Probe).
          const guaranteed = state.necroGuaranteedReviveUntil > state.time || state.necroCircleGuaranteedRevive;
          const n = guaranteed ? Math.max(1, rollGhostSpawnCount(chance, state.rng)) : rollGhostSpawnCount(chance, state.rng);
          if (guaranteed) {
            state.necroGuaranteedReviveUntil = 0;
            state.necroCircleGuaranteedRevive = false;
          }
          // ghost_054 "Legionskern": die Probe war erfolgreich (n>0), aber
          // KEIN Platz mehr frei -- statt eines wirkungslosen Wurfs heilen
          // und staerken sich die vorhandenen Untertanen bis Raumende.
          // Eigene, kleine interne Abklingzeit (kein necro.js-Umweg noetig,
          // s. state.necroCoreCooldownUntil).
          if (
            n > 0 &&
            occupiedGhostSlots(state) >= ghostCap &&
            pc.necroCoreHealPct &&
            state.time >= state.necroCoreCooldownUntil
          ) {
            for (const g of state.ghosts) {
              if (!g.alive) continue;
              g.hp = Math.min(g.cfg.maxHp, g.hp + g.cfg.maxHp * pc.necroCoreHealPct);
            }
            state.necroLegionKernActive = true;
            state.necroCoreCooldownUntil = state.time + (pc.necroCoreCooldownS || 0);
          }
          // Limit OHNE Verdraengung: am Deckel passiert einfach nichts fuer
          // die restlichen Wuerfe (kein Verbrauch) -- dieselbe Regel wie bei
          // der Geisterbombe (tank.js: spawnGhostBomb()). Der Deckel-
          // Vergleich zaehlt seit Phase 7 belegte PLAETZE (occupiedGhostSlots),
          // nicht die reine Anzahl.
          //
          // BUGFIX (Auftrag Abschnitt 4, "ghost_098 funktioniert im normalen
          // Spielablauf nicht"): ohne ghost_098 bricht die Schleife am vollen
          // Limit weiterhin sofort ab (unveraendertes Verhalten). MIT
          // necroCapFusion (098) wird pushGhost() dagegen IMMER aufgerufen,
          // auch am Deckel -- ihre eigene Verschmelzungslogik (s. ghost.js)
          // entscheidet dann selbst, ob der neue Geist verworfen und
          // stattdessen der schwaechste vorhandene in den Champion
          // verschmolzen wird. Ohne diesen Fix erreichte ein durch einen
          // Abschuss ausgeloester Wiederbelebungsversuch pushGhost() am
          // vollen Limit NIE (fruehes break hier), egal ob der Kill vom
          // Hauptpanzer, dem Champion oder einem gewoehnlichen Geist stammte
          // -- alle drei laufen durch GENAU diese eine Schleife.
          let spawnedAny = false;
          for (let i = 0; i < n; i++) {
            if (occupiedGhostSlots(state) >= ghostCap && !pc.necroCapFusion) break;
            // Jeder Elite-Untertan belegt strukturell 2 Geisterplaetze (er ist
            // per Definition ein staerkerer Gegner) -- UNABHAENGIG von
            // ghost_056. ghost_056 "Elite-Reaktivierung" hebt DARUEBER hinaus
            // nur noch den Basiswert-Anteil von 50 % auf 90 % an (Auftrag
            // Abschnitt 10: "65 % -> 90 %"); ohne die Karte erscheint ein
            // wiederbelebter Elite-Gegner mit dem normalen Anteil wie jeder
            // andere Untertan. ghost_104: die GARANTIERTE Probe (falls sie
            // diese war) spawnt mit einem eigenen, hoeheren Basiswert-Anteil
            // -- nur beim ersten Durchlauf (i===0), die Garantie deckt genau
            // EINEN Untertan.
            const overrides = isElite
              ? { baseStatPctOverride: pc.necroEliteRevive ? pc.necroEliteReviveStatPct : undefined, slotCost: pc.necroEliteReviveSlots || 2 }
              : i === 0 && guaranteed && state.necroCircleReviveStatPct
                ? { baseStatPctOverride: state.necroCircleReviveStatPct }
                : null;
            // Nekromant-V2 Phase 8: pushGhost() statt eines direkten
            // state.ghosts.push() -- EINZIGER Ort, der "Einziger Thron"
            // (necroUniqueThrone, ghost_071) auswertet. An allen sechs
            // Erzeugungsstellen gleich, damit die Verschmelzung nicht
            // fuenffach dupliziert werden muss.
            const revived = createGhost(state, tank.x, tank.y, tank.heading, tank.type, overrides);
            // ghost_088 "Blutige Formation" (Nekromant-V2 Phase 9): der
            // NAECHSTE wiederbelebte Untertan bekommt +X% Schaden JE
            // Geistertod in diesem Raum -- UNBEGRENZT (Auftrag Abschnitt 9:
            // die alte, hier entfernte 80-%-Deckelung war eine kuenstliche
            // Obergrenze) -- VOR pushGhost() angewendet, damit eine evtl.
            // Verschmelzung (necroUniqueThrone) den bereits erhoehten Wert
            // korrekt uebertraegt.
            if (pc.necroHybridReviveDeathBonusPct) {
              const deaths = getNecroStack(state, 'room', '_deaths');
              const bonus = deaths * pc.necroHybridReviveDeathBonusPct;
              revived.cfg.damage = Math.round(revived.cfg.damage * (1 + bonus));
            }
            pushGhost(state, revived);
            spawnedAny = true;
            // ghost_052 "Mehrfachwiederbelebung": zusaetzliche Chance auf eine
            // ZWEITE, schwaechere Kopie.
            if (pc.necroDoubleReviveChance && occupiedGhostSlots(state) < ghostCap && state.rng() < pc.necroDoubleReviveChance) {
              pushGhost(
                state,
                createGhost(state, tank.x, tank.y, tank.heading, tank.type, {
                  baseStatPctOverride: pc.necroDoubleReviveStatPct,
                }),
              );
            }
            // ghost_060 "Armee der Toten": JEDE gelungene Probe erzeugt
            // GARANTIERT eine weitere Kopie (kein Zufallswurf).
            if (pc.necroGuaranteedReviveCopy && occupiedGhostSlots(state) < ghostCap) {
              pushGhost(
                state,
                createGhost(state, tank.x, tank.y, tank.heading, tank.type, {
                  baseStatPctOverride: pc.necroGuaranteedReviveStatPct,
                }),
              );
            }
          }
          if (spawnedAny) recomputeLegionCache(state);
          // Nekromant-V2 Phase 10 (Telemetrie): "Wiederbelebungsquote" heisst
          // -- wie oft fuehrte eine ECHTE Probe (canRevive) auch tatsaechlich
          // zu mindestens einem neuen Untertan (spawnedAny), NICHT nur "der
          // Wurf war < chance" (der kann am vollen Limit trotzdem ins Leere
          // laufen). state.necroReviveHits/necroReviveRolls sind reine
          // Rohzaehler, main.js liest sie unveraendert.
          state.necroReviveRolls++;
          if (spawnedAny) state.necroReviveHits++;
        }
      }
    },
    // Statuseffekt auftragen (Phase 5). In dieser Phase der EINZIGE Weg,
    // einen Status zu erzeugen -- es haengt noch keine Quelle daran
    // (Debug-Tasten 1/2/3 bei ?debug=1, Tests). Phase 6 haengt die
    // Schadenstypen an.
    applyStatus(tank, id, stacks, opts) {
      return applyStatus(state, tank, id, stacks, opts);
    },
    addShake(amount) {
      state.shake = Math.min(10, state.shake + amount);
    },
    spawnParticles(x, y, color, n, speed) {
      // Phase 11b: Deckel aus data/limits.json statt hartcodierter Zahl.
      if (state.particles.length > (state.data.limits?.particles ?? 300)) return;
      for (let i = 0; i < n; i++) {
        const ang = state.rng() * Math.PI * 2;
        const v = speed * (0.4 + state.rng() * 0.8);
        state.particles.push({
          x,
          y,
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v,
          age: 0,
          life: 0.3 + state.rng() * 0.35,
          size: 1.5 + state.rng() * 2,
          color,
        });
      }
    },
    // ghost_090 "Rueckkehr im Zorn" (Nekromant-V2 Phase 9): necro.js kann
    // ghost.js NICHT importieren (Zirkelimport -- ghost.js importiert schon
    // aus necro.js), deshalb reicht state.js diese Methode als Umweg durch
    // (Muster wie applyStatus oben). Erzeugt einen geschwaechten Ersatz an
    // der Sterbeposition, ueber denselben pushGhost()-Hook wie jede andere
    // Erzeugungsstelle (wertet "Einziger Thron" also korrekt mit aus).
    createReplacementGhost(gh, cfg) {
      // ghost_098 "Auslese der Legion": am vollen Limit trotzdem versuchen --
      // pushGhost() verschmilzt dann den schwaechsten Untertan in den
      // Champion, statt den Ersatz stillschweigend zu verweigern.
      if (
        occupiedGhostSlots(state) >= (state.data.balance?.ghost?.maxActive ?? 3) + (state.player?.cfg?.ghostMaxAdd || 0) &&
        !cfg.necroCapFusion
      ) {
        return null;
      }
      const g = createGhost(state, gh.x, gh.y, gh.heading, gh.type, { baseStatPctOverride: cfg.necroHybridReplacementStatPct });
      g.lifetimeMax = cfg.necroHybridReplacementLifetimeS;
      g.lifetime = cfg.necroHybridReplacementLifetimeS;
      pushGhost(state, g);
      return g;
    },
    // ghost_091 "Lawine der Toten": spawnt `count` KOSTENLOSE Untertanen
    // (kein Wiederbelebungswurf) mit einem eigenen Basiswert-Anteil --
    // derselbe Akt-Gegnerpool wie ghost_033/spawnGhostBomb.
    spawnFreeGhosts(count, statPct) {
      const p = state.player;
      if (!p) return;
      const cap = (state.data.balance?.ghost?.maxActive ?? 3) + (p.cfg.ghostMaxAdd || 0);
      const pool = state.actEnemyPool && state.actEnemyPool.length ? state.actEnemyPool : ['t_brown'];
      for (let i = 0; i < count; i++) {
        // ghost_098: am vollen Limit nicht abbrechen, sondern pushGhost()
        // erreichen lassen (verschmilzt dort statt zu verweigern).
        if (occupiedGhostSlots(state) >= cap && !p.cfg.necroCapFusion) break;
        const srcType = pool[Math.floor(state.rng() * pool.length)];
        pushGhost(state, createGhost(state, p.x, p.y, p.turret, srcType, { baseStatPctOverride: statPct }));
      }
    },
  };
  // Nekromant-V2 Phase 6: die Bruecke von Phase 5s reiner Infrastruktur zu
  // echten Karten -- EINMAL pro Raumaufbau, NACH der vollstaendigen
  // state-Konstruktion (die Listener-Closures brauchen den fertigen state).
  buildNecroListeners(state, player.cfg);
  // ghost_033 "Rueckkehr aus Asche": ein zerbrechlicher Untertan erscheint
  // sofort am Spielerstandort. Skaliert die NORMALE (baseStatPct-basierte)
  // Erzeugung nachtraeglich auf den Karten-eigenen Prozentsatz um, statt die
  // resolveGhostCfg()-Rechnung zu duplizieren (mathematisch aequivalent:
  // beide Prozentsaetze wirken auf denselben Basiswert). "Kann nicht erneut
  // wiederbelebt werden" ergibt sich VON SELBST -- er stirbt planmaessig per
  // Lebensdauer-Ablauf ('expire'), und killGhost() ueberspringt die
  // Wiederkehr-Familie bei 'expire' ohnehin (s. ghost.js).
  if (
    player.cfg.necroStartGhostPct &&
    (occupiedGhostSlots(state) < (state.data.balance?.ghost?.maxActive ?? 3) + (player.cfg.ghostMaxAdd || 0) ||
      player.cfg.necroCapFusion)
  ) {
    const pool = actEnemyPool && actEnemyPool.length ? actEnemyPool : ['t_brown'];
    const srcType = pool[Math.floor(state.rng() * pool.length)];
    const g = createGhost(state, player.x, player.y, player.turret, srcType);
    const defaultPct = state.data.balance?.ghost?.baseStatPct ?? 0.5;
    const scale = player.cfg.necroStartGhostPct / defaultPct;
    g.cfg.maxHp = Math.max(1, Math.round(g.cfg.maxHp * scale));
    g.cfg.damage = Math.max(1, Math.round(g.cfg.damage * scale));
    g.hp = g.cfg.maxHp;
    g.baseMaxHp = g.cfg.maxHp;
    g.baseDamage = g.cfg.damage;
    g.lifetimeMax = player.cfg.necroStartGhostLifetimeS;
    g.lifetime = player.cfg.necroStartGhostLifetimeS;
    // ghost_105 "Herrschaft ueber den Tod" (Nekromant-V2 Phase 9): markiert
    // GENAU diesen Raumstart-Untertan als "Urahn" -- nur sein Tod/seine
    // Verschmelzung loest den Buff aus, s. ghost.js: killGhost()/fuseGhost().
    if (player.cfg.necroAncestorBuffOnDeath) g.isAncestor = true;
    // Nekromant-V2 Phase 8: pushGhost() statt eines direkten Push (Muster
    // s. killTank()s Wiederbelebungs-Block) -- hier praktisch immer ein
    // reiner Push (state.ghosts ist zu Raumbeginn leer), aus Konsistenz aber
    // ueber denselben zentralen Hook wie alle anderen Erzeugungsstellen.
    pushGhost(state, g);
  }
  // ghost_035 "Vorbote des Endes": 4 virtuelle Geistertode sofort bei
  // Raumstart, ausschliesslich auf raumweite pureStack-Listener (s. necro.js).
  if (player.cfg.necroVirtualDeathsOnStart) {
    applyVirtualNecroDeaths(state, player.cfg.necroVirtualDeathsOnStart);
  }
  return state;
}

// Feuert count Kugeln gleichmaessig im Kreis (Schrapnell/Konterschild).
function spawnRadialBullets(state, owner, x, y, count, speed) {
  const sp = speed || owner.cfg.schrapnellSpeed || 150;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    state.bullets.push(
      createBullet(x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, {
        speed: sp,
        radius: state.data.physics.bulletRadius,
        owner,
        kind: 'bullet',
        friendly: true, // Splitter/Kranz treffen den Leger nie
        damage: owner?.cfg?.damage,
        damageType: owner?.cfg?.damageType,
      }),
    );
  }
}

// Raum-Neustart nach Spielertod (Spec Abschnitt 8): identisches Layout,
// getoetete Gegner bleiben tot, lebende starten auf ihren urspruenglichen
// Spawns; Geschosse und Minen werden entfernt; zerstoerte Waende bleiben
// zerstoert.
function respawnPlayer(state) {
  const fresh = createTank(
    state.starterTank,
    applyRoomContext(
      applyRoomModifier(
        applyNecroRunScaling(
        applyScrapDamage(
          applyUpgrades(
            resolveCfg(state.data, state.starterTank),
            state.playerUpgrades,
            state.upgradesData,
            state.equippedSecondary,
            state.equippedGadget,
            state.upgradeLevels,
            state.levelBalance,
          ),
          state.starterScrap,
        ),
        state.necroRunDmgBonus,
        state.necroRunHpBonus,
        ),
        state.modifier,
        true,
      ),
      state.roomContext,
    ),
    state.playerSpawn.x,
    state.playerSpawn.y,
  );
  fresh.protect = state.data.physics.respawnProtectS; // kurzer Spawn-Schutz
  state.tanks[0] = fresh;
  state.player = fresh;
  for (const t of state.tanks) {
    if (t === fresh || !t.alive) continue;
    // Spinnenboss (Abschnitt 26, "Ein Spieler-Respawn erhaelt Bossphase,
    // Bossleben und zerstoerte Beine korrekt"): das generische Zuruecksetzen
    // aller anderen Panzer auf ihren URSPRUENGLICHEN Spawnpunkt wuerde den
    // Boss mitten im Kampf (oder aus seiner fest verankerten Phase-3-
    // Position) an seinen Arena-Eingang zurueckreissen -- hp/Phase/Beine
    // bleiben zwar ohnehin unberuehrt (kein Feld hier betrifft sie), aber
    // die Position/Ausrichtung sollen exakt dort bleiben, wo der Kampf
    // gerade steht.
    if (t.cfg.spiderBoss) continue;
    // Amboss-Auftrag: derselbe Grund wie beim Spinnenboss oben -- ein
    // Spieler-Respawn mitten im Rammstoss/Hammerschlag/in der Schleifspur
    // darf den Amboss nicht an seinen Arena-Eingang zurueckreissen (Zorn/
    // Modus/Timer blieben unveraendert, nur die Position wuerde nicht mehr
    // dazu passen -- z. B. ein bereits eingefrorener chargeDir, der auf
    // einmal von einer ganz anderen Stelle aus zeigt).
    if (t.cfg.anvilBoss) continue;
    t.x = t.spawnX;
    t.y = t.spawnY;
    t.prevX = t.spawnX;
    t.prevY = t.spawnY;
    t.vx = 0;
    t.vy = 0;
    t.cooldown = 0;
    t.turret = -Math.PI / 2;
    t.heading = -Math.PI / 2;
    t.ai = {};
  }
  state.bullets = [];
  state.mines = [];
  state.traps = [];
  state.ghosts = [];
  state.explosions = [];
  state.flashes = [];
  state.respawnTimer = 0;
}

// Wellen (Phase 9): loest die zurueckgehaltene zweite Welle aus, sobald
// nur noch fraction der ERSTEN Welle lebt -- danach 1s Vorwarnung an den
// (schon vom Generator erzeugten) Spawnpunkten, bevor die Panzer
// erscheinen. Erledigt sich nach einem Durchlauf selbst (state.pendingWave
// wird null).
function updateWave(state, dt) {
  const w = state.pendingWave;
  if (!w) return;
  if (!w.spawning) {
    const alive = state.tanks.filter((t) => t !== state.player && t.alive).length;
    if (alive <= w.initialCount * w.fraction) {
      w.spawning = true;
      w.warningTimer = w.warningS;
      state.sounds.push('wave');
    }
    return;
  }
  w.warningTimer -= dt;
  if (w.warningTimer > 0) return;
  // Sicherheitsnetz (Phase 11b), siehe createState() -- greift im normalen
  // Spiel nie, schuetzt aber vor unbegrenztem Wachstum.
  const enemyCap = state.data.limits?.enemiesAlive ?? Infinity;
  w.types.forEach((type, i) => {
    if (state.tanks.length - 1 >= enemyCap) return;
    const s = w.spawns[i];
    const t = createTank(
      type,
      applyHpScaling(
        applyRoomModifier(resolveCfg(state.data, type), state.modifier, false),
        state.hpScale,
        state.hpSkipBosses,
      ),
      s.x,
      s.y,
    );
    t.spawnX = s.x;
    t.spawnY = s.y;
    applyAffixByIndex(t, w.startIdx + i, state.eliteAffixes);
    state.tanks.push(t);
  });
  state.pendingWave = null;
  // G7 (t_tether): erneuter Bindungslauf ueber den VOLLEN Bestand (nicht nur
  // die neu gespawnten) -- ein ueberlebender, unverbundener Welle-1-
  // Kettenhund kann sich so noch mit einem neuen Welle-2-Kettenhund binden.
  bondTethers(state.tanks);
}

// Ein fester Physikschritt.
// cmd = { move: {x,y}, aim: {x,y}, fire: bool, mine: bool }.
export function stepState(state, cmd, dt) {
  const p = state.player;
  state.time += dt;
  if (state.blockedShotTimer > 0) state.blockedShotTimer = Math.max(0, state.blockedShotTimer - dt);
  // Heck-Kill-Zeitlupe (Phase 2): dieselbe Technik wie der alte Trickshot --
  // run.js: stepRun() liest den vom VORHERIGEN Tick gesetzten Wert, BEVOR es
  // stepState() aufruft (genau das Muster, das trickshotTimer schon nutzte).
  if (state.rearKillTimer > 0) state.rearKillTimer = Math.max(0, state.rearKillTimer - dt);

  // ghost_015 "Aschenhaut" (Nekromant-V2 Phase 6): der ueber Tode gestapelte
  // Schild-Anteil verfaellt nach necroShieldDurationS wieder -- entfernt nur
  // GENAU den Anteil, den diese Karte selbst gewaehrt hat (nicht den ganzen
  // Schild-Pool, der auch aus anderen Quellen gespeist sein kann).
  if (state.player?.necroShieldStackAmount > 0 && state.time >= (state.player.necroShieldStackExpiresAt || 0)) {
    state.player.shield = Math.max(0, (state.player.shield || 0) - state.player.necroShieldStackAmount);
    state.player.necroShieldStackAmount = 0;
  }

  // Transformation "Saboteur" (Phase 5): betaeubte Gegner explodieren,
  // sobald ihre Betaeubung endet.
  const sabotageR = state.transform.stunExplodeRadiusPx || 0;
  // Exekutionsschwelle (Grundsteinumbau Phase 2): einmal pro Tick VOR der
  // Trefferverarbeitung dieses Ticks festgestellt (t.executing), damit
  // applyDamage() spaeter im selben Tick nur noch das Flag liest -- das
  // erfuellt "bereits im Exekutionszustand" woertlich, der Zustand muss vor
  // diesem Treffer schon bestanden haben, nicht durch ihn erst entstehen.
  // Nur normale GEGNER (Entscheidung C: Bosse ausgenommen, der Spieler ist
  // nie Ziel dieser Mechanik).
  const exCfg = state.data.balance.execute;
  // Gegner-Umbau G3: zwei Pro-Tick-Vorberechnungen, gebraucht von der
  // folgenden Panzer-Schleife (t_anchor) bzw. von ai_turrets.js: roleTurret()
  // (t_relay). state.tankLinks wird HIER zum ersten Mal wirklich geleert --
  // Baustein B (G1) hatte noch keinen Erzeuger und damit auch keinen Bedarf
  // dafuer. state.relaySight ist bewusst EIN globaler Boolean statt einer
  // Pro-Ziel-Tabelle (Designtabelle: "kleine Erweiterung, ein Boolean je
  // Tick"), gelesen an genau einer Stelle in ai_turrets.js: roleTurret().
  state.tankLinks.length = 0;
  state.relaySight = false;
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.sightRelay) continue;
    const relayTarget = resolveTarget(t, state);
    if (!relayTarget.alive) continue;
    const relayD = Math.hypot(relayTarget.x - t.x, relayTarget.y - t.y);
    if (relayD <= t.cfg.sightRelay.rangePx && clearLine(state, t.x, t.y, relayTarget.x, relayTarget.y)) {
      state.relaySight = true;
      // Lichtfaden (Baustein B): IMMER sichtbar, solange der Horcher wirklich
      // sieht -- Designauflage "dünn, gelb, leicht flackernd".
      state.tankLinks.push({
        x0: t.x,
        y0: t.y,
        x1: relayTarget.x,
        y1: relayTarget.y,
        color: [230, 210, 60],
        width: 1.5,
        baseAlpha: 0.5,
        pulseAlpha: 0.3,
        pulseHz: 2.2,
        dash: [4, 4],
      });
    }
  }
  // t_anchor: alle lebenden Suppress-Feld-Quellen vorab sammeln -- wirkt NIE
  // auf Geister (die stehen strukturell nie in state.tanks, kein Ausschluss-
  // Code noetig).
  const suppressors = state.tanks.filter((s) => s.alive && s.cfg.suppressField);
  for (const t of state.tanks) {
    if (!t.alive) continue;
    // Gegner-Umbau Baustein A (Aura-Markierung, G1): EIN Reset pro Tick fuer
    // JEDEN Panzer, nach dem Muster ghost.js: necroAuraWeakened -- generisch
    // statt eines Einzelfelds, damit spaetere Auren-Gegner (t_marshal, G6)
    // nur noch einen SETZER ergaenzen muessen, keinen weiteren Lesepunkt.
    // Seit G3 hat t_anchor den ersten echten Setzer (naechster Block); der
    // dritte Lesepunkt (fireRateMult in tank.js: fireBullet()) bleibt bis G6
    // ein wirkungsloser No-op.
    if (!t.auraFlags) t.auraFlags = { noFlank: false, noExecute: false, fireRateMult: 1 };
    else {
      t.auraFlags.noFlank = false;
      t.auraFlags.noExecute = false;
      t.auraFlags.fireRateMult = 1;
    }
    // G3 (t_relay): Reset des "feuert nur DANK des Horchers"-Markers (Muster
    // wie auraFlags oben) -- gesetzt in ai_turrets.js: roleTurret(), gelesen
    // vom Renderer (drawAuraMarkers()).
    t.relayAssisted = false;
    // G3 (t_anchor): jeder Panzer innerhalb EINES Suppress-Felds (inkl. der
    // Quelle selbst) verliert Flanken-/Exekutionsvorteil. Mehrere Anker OR-en
    // sich zusammen (ein Panzer im Feld irgendeines Ankers ist betroffen).
    for (const src of suppressors) {
      const sf = src.cfg.suppressField;
      if (Math.hypot(t.x - src.x, t.y - src.y) > sf.radiusPx) continue;
      if (sf.noFlank) t.auraFlags.noFlank = true;
      if (sf.noExecute) t.auraFlags.noExecute = true;
    }
    // G6 (t_stalker): Tarnung ausserhalb cloakBeyondPx vom eigenen aufgeloesten
    // Ziel -- AUSSER waehrend eines laufenden Enttarnungsfensters
    // (stalkRevealUntil, ein state.time-Zeitstempel, gesetzt in
    // ai_turrets.js: roleTurret() beim Start des Feuer-Windups). t.stalkCloaked
    // ist reine Vorberechnung (Muster wie relayAssisted) -- der Renderer liest
    // nur noch das Feld, kein zweiter resolveTarget()-Aufruf dort noetig.
    if (t.cfg.stalk) {
      const stalkTarget = resolveTarget(t, state);
      const stalkD = stalkTarget.alive ? Math.hypot(stalkTarget.x - t.x, stalkTarget.y - t.y) : Infinity;
      t.stalkCloaked = stalkD > t.cfg.stalk.cloakBeyondPx && state.time >= (t.stalkRevealUntil || 0);
    } else {
      t.stalkCloaked = false;
    }
    // ghost_026 "Opferstoss" (Nekromant-V2 Phase 6): eine Druckwelle hebt die
    // Exekutionsschwelle fuer GETROFFENE Gegner zeitlich befristet auf einen
    // absoluten Wert an (necroExecThreshold, typisch 0,5 -- deutlich hoeher
    // als der globale Grundwert) statt ihn zu addieren -- "senkt sie ... auf
    // 50 %" ist eine Ersetzung, kein Delta. Nur solange necroExecUntil in
    // der Zukunft liegt.
    const execThreshold =
      t.necroExecUntil > state.time ? Math.max(exCfg?.thresholdPct ?? 0, t.necroExecThreshold || 0) : exCfg?.thresholdPct;
    // t.auraFlags.noExecute (Baustein A): t_anchor hebt die Exekutionsgarantie
    // im Aurafeld auf -- der Schaden wird trotzdem normal abgezogen (s.
    // applyDamage()), nur der garantierte Tod/das Rauchen/die Verlangsamung
    // entfallen.
    t.executing =
      !!exCfg &&
      t !== state.player &&
      !isBossCfg(t.cfg) &&
      !t.auraFlags.noExecute &&
      t.hp / (t.cfg.maxHp || 1) <= execThreshold;
    if (t.executing) {
      // "raucht sichtbar (Partikel im Takt)" -- die Lesbarkeit ist der
      // eigentliche Nutzen der Schwelle (Entscheidung D).
      t.executeSmokeTimer = (t.executeSmokeTimer || 0) - dt;
      if (t.executeSmokeTimer <= 0) {
        t.executeSmokeTimer = exCfg.smokeIntervalS ?? 0.35;
        state.spawnParticles(t.x, t.y, '#5a5a5a', 2, 40);
      }
    }
    t.cooldown = Math.max(0, t.cooldown - dt);
    const wasStunned = t.stunTimer > 0;
    t.stunTimer = Math.max(0, t.stunTimer - dt);
    if (sabotageR && wasStunned && t.stunTimer <= 0 && t !== state.player) {
      // Kill-Zuordnung (Phase 6): die Saboteur-Transformation gehoert dem
      // Spieler, auch wenn sie zeitversetzt von der Betaeubung ausloest.
      explodeAt(state, t.x, t.y, sabotageR, state.player, { killer: state.player });
      continue;
    }
    if (t.protect > 0) t.protect = Math.max(0, t.protect - dt);
    if (t.boostTimer > 0) t.boostTimer = Math.max(0, t.boostTimer - dt);
    if (t.bloodTimer > 0) t.bloodTimer = Math.max(0, t.bloodTimer - dt);
    if (t.dashCd > 0) t.dashCd = Math.max(0, t.dashCd - dt);
    // Phase 6: Sekundärslot-Timer (Turm-Betäubung EMP-Mine, Cooldown der
    // vier neuen Sekundärwaffen, Enterhaken-Zug, Deflektor-Fenster).
    if (t.turretStunTimer > 0) t.turretStunTimer = Math.max(0, t.turretStunTimer - dt);
    if (t.gadgetCooldown > 0) t.gadgetCooldown = Math.max(0, t.gadgetCooldown - dt);
    if (t.ghostBombCooldown > 0) t.ghostBombCooldown = Math.max(0, t.ghostBombCooldown - dt);
    if (t.deflectorTimer > 0) {
      t.deflectorTimer = Math.max(0, t.deflectorTimer - dt);
      if (t.deflectorTimer <= 0) t.deflectorCharges = 0;
    }
    // Elite-Affix "Regenerierschild" (Phase 9): die Ladung verfaellt NICHT,
    // sie laedt sich nach regenShieldS neu auf -- das Gegenstueck zum
    // Schild-Verfall des Spielers (E2).
    if (t.regenShieldTimer > 0) {
      t.regenShieldTimer -= dt;
      if (t.regenShieldTimer <= 0) {
        t.shieldReady = true;
        // Phase 8: der Spieler-Schild ist ein Absorber -- beim Nachladen die
        // Punkte wieder auffuellen. Gegnerschilde ignorieren shieldHp (sie
        // fangen einen Treffer ab, siehe applyDamage).
        if (t === state.player) t.shieldHp = t.cfg.shieldAbsorb || 0;
      }
    }
    // Nekromant-V2 Phase 2: der NEUE Schild-Punktepool regeneriert optional
    // (Auftrag: "ghost_048", noch keine echte Karte -- der Mechanismus
    // arbeitet trotzdem bereits, sonst muesste eine spaetere Regenerations-
    // karte hier noch Code aendern statt nur ihren core.shieldRegenAdd zu
    // setzen). Getrennt vom Regenerierschild-Affix/Nachladeschild oben (die
    // fuellen shieldHp/shieldReady, nicht tank.shield).
    if (t.cfg.shieldRegenPerS && t.shield < t.cfg.shieldMax) {
      t.shield = Math.min(t.cfg.shieldMax, (t.shield || 0) + t.cfg.shieldRegenPerS * dt);
    }
  }

  // G6 (t_marshal): Feuerraten-Aura ueber freie Sichtlinie, KEIN Radius.
  // Eigener Durchlauf NACH dem obigen Reset (statt darin), weil der
  // maxTargets-Deckel PRO FELDWEBEL zaehlt, nicht pro Ziel -- ein zweiter
  // Feldwebel darf denselben Verbuendeten zusaetzlich verstaerken,
  // unabhaengig vom ersten. t.auraFlags ist zu diesem Zeitpunkt fuer JEDEN
  // Panzer bereits initialisiert (voriger Durchlauf). Mehrere Feldwebel auf
  // dasselbe Ziel kombinieren sich ueber Math.min (der staerkste/kleinste
  // Multiplikator gewinnt) -- gelesen in tank.js: fireBullet() (seit G1).
  for (const m of state.tanks) {
    if (!m.alive || !m.cfg.rally) continue;
    let boosted = 0;
    for (const t of state.tanks) {
      if (boosted >= m.cfg.rally.maxTargets) break;
      if (t === m || t === state.player || !t.alive) continue;
      if (m.cfg.rally.needsLos && !clearLine(state, m.x, m.y, t.x, t.y)) continue;
      boosted++;
      t.auraFlags.fireRateMult = Math.min(t.auraFlags.fireRateMult, m.cfg.rally.fireRateMult);
      // Fahnenlinien (Baustein B): kurz, orange, pulsierend -- Designauflage
      // "sichtbare kurze Fahnenlinien zu jedem gerade verstaerkten Gegner".
      state.tankLinks.push({
        x0: m.x,
        y0: m.y,
        x1: t.x,
        y1: t.y,
        color: [255, 150, 40],
        width: 1.5,
        baseAlpha: 0.45,
        pulseAlpha: 0.35,
        pulseHz: 2.5,
        dash: [3, 3],
      });
    }
  }

  // G7 (t_tether): Bindungspruefung (dauerhafter Bruch) + die immer
  // sichtbare Kette.
  updateTethers(state);

  // Statuseffekte ueber Zeit (Phase 5): eigener Durchlauf NACH der
  // Timer-Schleife, weil ein Tick toeten kann und die Schleife oben sonst
  // ueber einen gerade gestorbenen Panzer weiterliefe.
  updateStatus(state, dt);

  // Rauchwolken altern unabhaengig von Panzern (einmal pro Schritt).
  for (const c of state.smokeClouds) c.age += dt;
  // Blitzbogen (Phase 6): kurzlebige Anzeige der Kettensprünge.
  for (const a of state.lightningArcs) a.age += dt;
  state.lightningArcs = state.lightningArcs.filter((a) => a.age < 0.18);
  state.smokeClouds = state.smokeClouds.filter((c) => c.age < c.life);

  // Bewegliche Wand (Phase 15): eigener Bewegungstakt, unabhaengig davon,
  // ob der Spieler gerade lebt/respawnt.
  state.tickMovingWalls(dt);

  if (!p.alive) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) respawnPlayer(state);
  } else {
    // Uebermacht: Magazin waechst mit lebenden Gegnern (dynamisch).
    if (p.cfg.magazinePerEnemy && !p.cfg.magazineFixed) {
      let live = 0;
      for (const t of state.tanks) if (t !== p && t.alive) live++;
      p.magazineBonus = p.cfg.magazinePerEnemy * live;
    }
    if (cmd.dash) dashTank(p, state, cmd.move); // vor der Bewegung
    moveTank(p, cmd.move, state, dt);
    p.turret = Math.atan2(cmd.aim.y - p.y, cmd.aim.x - p.x);
    // Telemetrie (Phase 2, Entscheidung G/I): NUR das volle Magazin zaehlt
    // als "blockiert" -- ein Feuerbefehl waehrend des normalen Nachladens
    // ist keine Blockade, sondern die uebliche Kadenz. p.cooldown <= 0 filtert
    // genau diesen Fall raus, derselbe Ausschluss wie in fireBullet() selbst.
    if (cmd.fire && p.cooldown <= 1e-9 && liveBulletsOf(state, p) >= magazineOf(p)) {
      state.magBlockedTime += dt;
    }
    if (cmd.fire) fireBullet(p, state, cmd.firePressed);
    if (cmd.mine && useSecondary(p, state, cmd.mineThrow)) state.secondaryUses++;
    // P4: zweiter Slot mit eigenem Ausloeser und eigener Zielvorgabe.
    if (cmd.gadget && useGadget(p, state, cmd.gadgetThrow)) state.gadgetUses++;
    // Fernzuender bekommt seit P4 einen ausdruecklichen Knopf, statt sich
    // den Bombenknopf mit dem Legen zu teilen (dort loeste er nur aus, wenn
    // das Minen-Limit ohnehin erreicht war -- praktisch unauffindbar).
    if (cmd.detonate && p.cfg.remoteDetonate) {
      for (const m of state.mines) if (!m.dead && m.owner === p && m.fuse === null) m.fuse = 0.001;
    }
  }

  // Zielauflösung (Upgradepool-v2 Phase 5): throttled (reevaluateHz) VOR der
  // Gegner-Schleife, damit updateEnemy()/roleTurret() bereits mit dem
  // frischen tank.ai.target dieses Ticks entscheiden. Boss-Sonderbewegungen
  // (mirrorBoss/phalanx) ueberschreiben es weiter unten selbst.
  updateTargeting(state, dt);
  // Deckungs-KI (Phase 16): throttled (15 Hz, Reihum-Verfahren) VOR der
  // Gegner-Schleife, damit updateEnemy() bereits mit dem frischen
  // tank.ai.threatened dieses Ticks entscheidet. Bleibt bewusst
  // spielerbezogen (Phase 5 aendert daran nichts).
  updateCoverPerception(state, dt);
  // G8 (t_metronom): tickt VOR der Gegner-Schleife, damit metronomeHolds()
  // dort bereits mit dem frischen Beat-Zustand dieses Ticks entscheidet
  // (Muster wie updateTargeting/updateCoverPerception oben).
  updateMetronomes(state, dt);

  // Gegner: getrennte Turm-/Fahr-KI liefert Bewegung, Schuss- und
  // Minenwunsch. Zwei Boss-Sonderfaelle (Phase 14) haben KEINE physik-
  // basierte Fahrfunktion (reine Funktion von Spielerposition bzw. Zeit) und
  // umgehen deshalb DRIVES/updateEnemy() komplett -- Turm/Feuern bleibt
  // trotzdem die normale roleTurret()-Logik, siehe bossai.js.
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    if (t.cfg.mirrorBoss) {
      stepMirrorBoss(t, state, dt);
      continue;
    }
    if (t.cfg.phalanx) {
      stepPhalanxBoss(t, state, dt);
      continue;
    }
    if (t.cfg.spiderBoss) {
      stepSpiderBoss(t, state, dt);
      continue;
    }
    // Amboss-Auftrag: eigener Zustandsautomat, bypasst DRIVES/updateEnemy()
    // komplett (Muster wie die drei Boss-Sonderbewegungen oben) -- ruft
    // NIEMALS fireBullet()/roleTurret() auf (der Amboss feuert nie).
    if (t.cfg.anvilBoss) {
      stepAnvilBoss(t, state, dt);
      continue;
    }
    const { move, fire, mine } = updateEnemy(t, state, dt);
    // Gefahrensinn-Upgrade (Phase 18, Welle 3): reine Anzeige-Markierung.
    // Nutzt die Feuerfreigabe, die die KI ohnehin schon berechnet hat --
    // kein zweiter Sichtlinien-Raycast im Renderpfad (Phase 11b nennt die
    // Sichtlinien-KI ausdruecklich als Risikopunkt fuer das Frame-Budget).
    // Upgradepool-v2 Phase 5: nur noch true, wenn das aufgeloeste Ziel
    // wirklich der Spieler ist -- sonst warnt der Gefahrensinn vor einem
    // Schuss, der einem Geist gilt.
    t.aimingAtPlayer = fire && resolveTarget(t, state) === state.player;
    moveTank(t, move, state, dt);
    // Moerserschuetze (Grundsteinumbau Phase 3, t_green): eigener Abschuss-
    // pfad statt fireBullet() -- die Granate landet nie in state.bullets,
    // deshalb greifen Deflektor/Frontpanzerung (nur gerade Geschosse)
    // automatisch nicht.
    // G8 (t_metronom): ein gehaltener Feuerwunsch wird UNTERDRUECKT, bis der
    // naechste Schlag ihn freigibt. t.cooldown tickt (Zeile oben, Haupt-
    // Panzer-Tick-Schleife) UNABHAENGIG davon weiter -- ein schnell
    // feuernder Verbuendeter ist beim Schlag also laengst "bereit" und
    // feuert dann sofort, statt einzeln ueber die Haltezeit verteilt zu
    // sein. t.metronomeHeld ist reine Anzeige (Renderer: Pulsieren im Takt).
    t.metronomeHeld = fire && metronomeHolds(state, t);
    if (fire && !t.metronomeHeld) {
      if (t.cfg.weapon === 'mortar') fireMortar(t, state);
      else fireBullet(t, state);
    }
    if (mine) layMine(t, state);
  }

  for (const b of state.bullets) updateBullet(b, state, dt);

  // Geschosse zerstoeren sich gegenseitig bei Kollision. Ausnahme:
  // Doppelrohr-Zwillinge -- Kugeln derselben Salve (gleicher Schuetze,
  // gleiches Alter) starten ueberlappend und ignorieren sich, bis die
  // Spreizung sie getrennt hat.
  const bullets = state.bullets;
  for (let i = 0; i < bullets.length; i++) {
    if (bullets[i].dead) continue;
    for (let j = i + 1; j < bullets.length; j++) {
      if (bullets[j].dead) continue;
      const a = bullets[i];
      const b = bullets[j];
      if (a.owner === b.owner && a.age < 0.3 && Math.abs(a.age - b.age) < 1e-6) continue;
      if (circlesOverlap(a.x, a.y, a.radius, b.x, b.y, b.radius)) {
        a.dead = true;
        b.dead = true;
      }
    }
  }

  // Spinnenboss-Auftrag: Bein-Trefferpruefung MUSS vor der generischen
  // Panzer-Trefferschleife laufen, nicht danach (war der eigentliche Bug:
  // ein Schuss, der nahe genug am Koerper einschlaegt, um zugleich ein Bein-
  // UND das normale Panzer-Kollisionsrund zu ueberlappen, wurde sonst schon
  // dort verbraucht -- 0 Schaden am geschuetzten Koerper, tot, nie bei den
  // Beinen angekommen). Ein Bein-Treffer macht die Kugel hier bereits
  // `dead`, die folgende Schleife ueberspringt sie dann ganz normal.
  updateSpiderLegHits(state);

  // Geschoss gegen Panzer: toedlich fuer JEDEN, auch den Schuetzen -- ausser
  // (a) innerhalb der Selbst-Immunitaet direkt nach dem Abschuss oder (b)
  // solange die eigene Kugel nicht reflektiert wurde (Grundsteinumbau
  // Phase 1: die einzige verbleibende Quelle einer fuer den Schuetzen
  // gefaehrlichen eigenen Kugel ist die Frontpanzerung-Reflexion, E3 --
  // ohne Bandenschuss gibt es keinen "erster Abpraller macht sie scharf"-
  // Uebergang mehr, siehe armor.js: isLive()).
  const grace = state.data.balance.bullet.selfImmunity;
  for (const b of state.bullets) {
    if (b.dead) continue;
    for (const t of state.tanks) {
      if (!t.alive) continue;
      // Geisterpanzer (Phase 7): ihre Kugeln treffen den Spieler nie --
      // `friendly` reicht nicht, das schuetzt nur den Besitzer selbst, und
      // der Besitzer ist der Geist, kein echter Tank.
      if (t === state.player && b.owner?.isGhost) continue;
      if (b.owner === t && (b.age < grace || !isLive(b) || b.friendly)) continue;
      if (t.protect > 0) continue; // Spawn-Schutz
      // Kurzes Fenster nach einer Reflexion: die zurueckgeworfene Kugel
      // darf denselben Panzer nicht sofort wieder treffen.
      if (b.reflectImmune === t && b.reflectImmuneT > 0) continue;
      // Durchschlag (Nekromant-V2 Phase 2): ein Geschoss mit b.pierce > 0
      // durchschlaegt getroffene Ziele, statt zu sterben -- die Trefferliste
      // verhindert, dass ein noch fliegendes Geschoss dasselbe (evtl.
      // stehende) Ziel im naechsten Tick ein zweites Mal trifft.
      if (b.pierceHits?.has(t)) continue;
      if (circlesOverlap(b.x, b.y, b.radius, t.x, t.y, t.cfg.radius)) {
        // Amboss-Auftrag (Abschnitt 6): JEDER Kontakt eines Spieler- oder
        // Geisterschusses mit dem Amboss ist ein zornrelevantes Ereignis --
        // AUCH ein Fronttreffer, der gleich darauf komplett abgeprallt wird
        // (armorBlocks() lauft erst weiter unten). Explosive Geschosse
        // werden hier bewusst uebersprungen: ihr Kontakt UND ihre Explosion
        // zaehlen zusammen als EIN Paket (+11, nicht +7 plus +11) -- die
        // Registrierung passiert dafuer ausschliesslich im explosiven
        // Detonationsblock weiter unten in dieser Funktion.
        if (t.cfg.anvilBoss && !b.explosive) {
          if (b.owner === state.player) {
            state.registerAnvilRage('direct', 'shot:' + (b.rageEventId ?? b.id));
          } else if (b.owner?.isGhost) {
            state.registerAnvilRage('ghost', 'gshot:' + (b.rageEventId ?? b.id));
          }
        }
        // Sekundärslot "Deflektor" (Phase 6): reflektiert den naechsten
        // Treffer in Blickrichtung.
        if (t === state.player && t.deflectorCharges > 0 && b.owner !== t) {
          t.deflectorCharges--;
          reflectFromAim(b, t, state);
          break;
        }
        // Gerichtete Panzerung (Phase 4): Frontsektor faengt den Treffer ab
        // -- reflects wirft die Kugel zurueck (E3).
        if (armorBlocks(t, b)) {
          // Amboss-Auftrag (Abschnitt 18/20): erster geblockter Fronttreffer
          // zeigt den Lernhinweis + zaehlt fuer die Telemetrie -- der
          // eigentliche Zornzuwachs ist oben schon (vor diesem Block)
          // registriert worden, unabhaengig davon, ob er gleich abgeblockt wird.
          if (t.cfg.anvilBoss) {
            state.anvilFrontHits = (state.anvilFrontHits || 0) + 1;
            showAnvilHint(state, 'anvilHintFront', 'Fronttreffer heizen den Amboss auf.');
          }
          if (t.cfg.armor?.reflects) reflectBullet(b, t, state);
          else b.dead = true;
          break;
        }
        // Durchschlag: das Geschoss stirbt nur, wenn keine Ladung mehr da
        // ist. Trefferliste zuerst befuellen (auch wenn pierce noch reicht),
        // sonst koennte dasselbe Ziel im selben Tick kein zweites Mal
        // getroffen werden, aber im naechsten schon.
        if (!b.pierceHits) b.pierceHits = new Set();
        b.pierceHits.add(t);
        if (b.pierce > 0) b.pierce--;
        else b.dead = true;
        // Todesursache fuer den Game-Over-Screen + Telemetrie.
        const WEAPON_LABEL = { bullet: 'Kugel', rocket: 'Rakete' };
        const own = b.owner === state.player;
        const cause = own
          ? 'die eigene Kugel'
          : `${state.data.types[b.owner?.type]?.label || '?'} (${WEAPON_LABEL[b.kind] || b.kind})`;
        // UMBAUPLAN-LP Phase 3: die eigene, zurueckgekommene Kugel tut dem
        // Spieler einen EIGENEN Betrag (15) statt der 10, die sie einem
        // Gegner zufuegt -- sie soll wehtun, aus voller Gesundheit aber nie
        // toeten. Der Wert haengt also am Ziel, nicht am Geschoss, deshalb
        // hier und nicht in b.damage. (Eine eigene Kugel wird ohnehin erst
        // nach einer Reflexion fuer den Schuetzen scharf, siehe isLive().)
        const selbstbeschuss = t === state.player && b.owner === state.player;
        const basisSchaden = selbstbeschuss
          ? state.data.balance?.damage?.ownBullet ?? b.damage ?? 1
          : b.damage ?? 1;
        // UMBAUPLAN-LP Phase 11 (Physisch-Topf): Trefferregeln des Schuetzen.
        // Fangschuss trifft angeschlagene Ziele haerter. Aus b.owner.cfg --
        // nur der Spieler traegt diese physischen Karten. (Kaltschuetze/
        // Splittergeschoss/Abprallkoenig hingen am Bandenschuss und sind mit
        // Grundsteinumbau Phase 1 wirkungslos -- data/upgrades.json bleibt
        // bis Phase 4 unangetastet, s. Auftrag.)
        const oc = b.owner?.cfg;
        const isCrit = b.crit;
        // Kritischer Treffer (UMBAUPLAN-LP Phase 7): der Aufschlag traegt
        // den balance.crit.mult (+ Splittergeschoss-Bonus, falls gesetzt).
        const critMult = isCrit ? (state.data.balance?.crit?.mult ?? 1) + (oc?.critMultBonus || 0) + (b.critMultBonus || 0) : 1;
        const execMult =
          oc?.executeThreshold && t !== state.player && t.hp / (t.cfg.maxHp || 1) < oc.executeThreshold
            ? oc.executeMult || 1
            : 1;
        // Frost-Topf (Phase 14): "Splittern" -- Extra-Schaden gegen ERSTARRTE
        // (betaeubte) Ziele, damit die Frost-CC in Schaden umschlaegt.
        const shatterMult = oc?.shatterMult && t.stunTimer > 0 ? 1 + oc.shatterMult : 1;
        // Flanken-/Heckschaden (Grundsteinumbau Phase 2, der Ersatz-USP fuer
        // den entfernten Bandenschuss): nur gegen normale Gegner + Elites
        // (Entscheidung C -- Bosse behalten ihre eigene Panzerungslogik, der
        // Spieler ist selbst nie Ziel dieser Mechanik). front = 1x.
        // Amboss-Auftrag: `flankable` schaltet den sonst fuer Bosse
        // ausgeschlossenen Flanken-/Heckschaden GEZIELT wieder ein (t_anvil
        // ist der erste und bislang einzige Nutzer). Front bleibt weiterhin
        // die 140-Grad-Frontpanzerung -- nur Treffer AUSSERHALB dieses
        // Sektors erreichen ueberhaupt applyDamage() (armorBlocks() haelt
        // Fronttreffer schon vorher an), flankZone() klassifiziert sie dann
        // wie bei jedem normalen Gegner in Front/Seite/Heck.
        const flankCfg = state.data.balance.flank;
        // Baustein A (Aura-Markierung, G1/G3): t_anchor setzt t.auraFlags.noFlank
        // -- ein Treffer zaehlt dann IMMER als Fronttreffer (kein Seiten-/
        // Heckbonus), unabhaengig von der tatsaechlichen Einschlagsgeometrie.
        // rawFlankZone haelt die ECHTE Geometrie separat fest (G3): nur so
        // laesst sich unten "geankert ×1.0" statt der normalen Seiten-/
        // Heck-Rueckmeldung zeigen -- ohne rawFlankZone wuerde ein
        // unterdrueckter Seitentreffer STUMM bleiben (flankZoneHit ist ja
        // schon 'front').
        const rawFlankZone =
          flankCfg && t !== state.player && (!isBossCfg(t.cfg) || t.cfg.flankable)
            ? flankZone(t, b.x, b.y, flankCfg)
            : 'front';
        const flankZoneHit = t.auraFlags?.noFlank ? 'front' : rawFlankZone;
        const baseFlankMult =
          flankZoneHit === 'rear' ? flankCfg.rearMult : flankZoneHit === 'side' ? flankCfg.sideMult : 1;
        // ghost_010 "Jenseitsziel" (Nekromant-V2 Phase 6): zusaetzlicher
        // Flanken-/Heckschaden-Bonus fuer UNTERTANEN-Treffer -- das Feld
        // liegt auf dem SPIELER-cfg (die Karte wirkt auf "Untertanenpanzer"
        // kollektiv), nicht auf b.owner.cfg (das ist die Ghost-eigene cfg).
        // ghost_058 "Chor der Toten" (Nekromant-V2 Phase 7): Untertanen
        // erhalten zusaetzlich die HAELFTE des globalen Flanken-/Heck-Faktors
        // (baseFlankMult) als eigenen Bonus -- "die Haelfte des Flanken-/
        // Heckbonus des Hauptpanzers" liest sich als "des globalen Wertes",
        // da der Spieler selbst keinen individuellen Flankenbonus-Stat hat.
        const chorusBonus =
          flankZoneHit !== 'front' && b.owner?.isGhost && state.player?.cfg?.necroChorusOfDead
            ? (baseFlankMult - 1) * 0.5
            : 0;
        const ghostFlankBonus =
          flankZoneHit !== 'front' && b.owner?.isGhost
            ? (state.player?.cfg?.ghostFlankDamageBonus || 0) + chorusBonus
            : 0;
        // ghost_041 "Geteiltes Ziel" (Nekromant-V2 Phase 7): +X % Schaden fuer
        // Untertanen-Treffer GENAU auf das zuletzt vom Spieler getroffene Ziel.
        const sharedTargetBonus =
          b.owner?.isGhost && state.player?.cfg?.necroSharedTarget && t === state.necroLastPlayerHitTarget
            ? (state.player.cfg.necroSharedTargetDamageMult || 1) - 1
            : 0;
        // ghost_088 "Blutige Formation" (Nekromant-V2 Phase 9): zusaetzlicher
        // Flanken-/Heckbonus NUR fuer den SPIELER selbst (own), oben drauf
        // auf den globalen Flanken-Multiplikator -- getrennt von
        // ghostFlankBonus, das ausschliesslich Untertanen-Treffer betrifft.
        const hybridPlayerFlankBonus =
          own && flankZoneHit !== 'front' ? state.player?.cfg?.necroHybridFlankBonusPct || 0 : 0;
        const flankMult = baseFlankMult * (1 + ghostFlankBonus) * (1 + sharedTargetBonus) * (1 + hybridPlayerFlankBonus);
        // ghost_070 "Herrscheraura" (Nekromant-V2 Phase 8): Gegner innerhalb
        // des Champion-Radius (b.owner.necroAuraWeakened, in ghost.js:
        // updateGhosts() jeden Tick markiert) verursachen weniger Schaden UND
        // nehmen von UNTERTANEN mehr Schaden -- zwei getrennte Richtungen
        // derselben Aura, beide multiplikativ am Ende.
        const auraTakenReduction =
          t === state.player && !own && b.owner?.necroAuraWeakened
            ? 1 - (state.player?.cfg?.necroCrownAuraDamageTakenReduction || 0)
            : 1;
        const auraGhostBonus =
          b.owner?.isGhost && t !== state.player && t.necroAuraWeakened
            ? 1 + (state.player?.cfg?.necroCrownAuraGhostDamageBonus || 0)
            : 1;
        let schaden = Math.round(basisSchaden * critMult * execMult * shatterMult * flankMult * auraTakenReduction * auraGhostBonus);
        // Kopfschuss (Phase 11): ein Krit toetet einen Nicht-Boss-Gegner sofort.
        if (isCrit && oc?.critExecute && t !== state.player && !isBossCfg(t.cfg)) {
          schaden = Math.max(schaden, t.hp);
        }
        // ghost_041: der SPIELER merkt sich sein zuletzt getroffenes Ziel --
        // nur echte Spielertreffer auf einen Nicht-Spieler zaehlen.
        if (own && t !== state.player) state.necroLastPlayerHitTarget = t;
        const trefferMeta = {
          code: own ? 'own_bullet' : 'enemy_bullet',
          enemyType: own ? null : b.owner?.type || null,
          bulletOwner: own ? 'player' : 'enemy',
          bulletDistance: Math.round(b.distance || 0),
          // Klassen-Passive (Phase 9): der Schuetze bestimmt Blitzziele +
          // Status-Dauer/Verlangsamung. Ueber die Kugel statt global, damit
          // applyTypeEffects()/applyStatus() sie beim Auftragen kennt.
          lightningBonus: b.owner?.cfg?.lightningBonusTargets || 0,
          ownerCfg: b.owner?.cfg || null,
          // Kill-Zuordnung (Upgradepool-v2 Phase 6): der Schuetze -- killTank()
          // liest das fuer die Nekromant-Spawnchance. Ueber applyTypeEffects()s
          // {...meta}-Spread erbt auch eine daraus entstehende Blitzkette
          // (damagetypes.js) denselben killer, ohne dass diese Datei etwas
          // davon wissen muss.
          killer: b.owner,
        };
        // ghost_095 "Seelenband" (Nekromant-V2 Phase 9): ein Anteil des
        // Schadens AM HAUPTPANZER wird auf den Champion umgeleitet -- NUR
        // gegen echte Gegnertreffer (own bedeutet hier "der SPIELER hat
        // geschossen", nicht relevant fuer Schaden AM Spieler; die
        // eigentliche Bedingung ist t===state.player). Der umgeleitete
        // Anteil laeuft durch dieselbe Resistenz-/Schildpool-Kette wie jeder
        // andere Geistertreffer (applyResistToAmount/absorbWithShieldPool,
        // Phase 2), damit der Champion seine eigene Abwehr behaelt.
        // ghost_095 "Seelenband" (Nachschliff Abschnitt 10, UEBERARBEITET):
        // NUR noch die Umleitung selbst -- der zusaetzliche zeitlich
        // befristete Schadensbonus fuer den Hauptpanzer ist ersatzlos
        // entfernt. Ohne lebenden Champion passiert nichts (kein Fehl-
        // umleiten ins Leere, s. Auftrag).
        if (t === state.player && !own && state.player.cfg.necroSoulbondPct) {
          const champion = state.ghosts.find((g) => g.alive && g.isChampion);
          if (champion) {
            const redirect = Math.round(schaden * state.player.cfg.necroSoulbondPct);
            schaden -= redirect;
            let dmg = applyResistToAmount(champion.cfg, state.data.balance?.resist, redirect);
            dmg = absorbWithShieldPool(state, champion, dmg);
            champion.hp -= dmg;
            if (champion.hp <= 0) killGhost(state, champion);
          }
        }
        // Amboss-Auftrag (Abschnitt 20, Telemetrie): Seiten-/Heck-Treffer +
        // Schaden waehrend des Zusammenbruchs. Ein hier gezaehlter 'front'
        // kommt nur waehrend des Zusammenbruchs vor (armorBlocks() haelt
        // Fronttreffer sonst schon vorher an, s. o.) -- flankZoneHit klemmt
        // deshalb bewusst NICHT auf 'front' zurueck, sondern spiegelt genau
        // diesen Fall.
        if (t.cfg.anvilBoss) {
          if (flankZoneHit === 'rear') state.anvilRearHits = (state.anvilRearHits || 0) + 1;
          else if (flankZoneHit === 'side') state.anvilSideHits = (state.anvilSideHits || 0) + 1;
          else state.anvilFrontHits = (state.anvilFrontHits || 0) + 1;
          if (t.mode === 'overheated') state.anvilDamageDuringOverheat = (state.anvilDamageDuringOverheat || 0) + schaden;
        }
        state.applyDamage(t, schaden, cause, trefferMeta);
        // Telemetrie (Phase 2): Treffer auf Panzer, nicht Waende.
        if (own) state.playerHits++;
        // Treffer-Rueckmeldung (Phase 2, Ersatz fuer den alten Trickshot-
        // Moment): Seiten-/Heck-Treffer zeigen den Faktor als schwebenden
        // Kurztext am Einschlagpunkt -- der Krit hat seit Phase 7 bereits
        // eigene Rueckmeldung (Ton/Shake/Text am Schuetzen).
        // G3 (t_anchor): "die Regel wird im Moment ihrer Wirkung erklärt" --
        // ein GEOMETRISCH seitlicher/hinterer Treffer, der nur wegen des
        // Suppress-Felds als Front zaehlt, zeigt "geankert ×1.0" statt gar
        // nichts (rawFlankZone haelt die echte Geometrie fest, s. o.).
        if (rawFlankZone !== 'front' && t.auraFlags?.noFlank) {
          state.texts.push({
            x: t.x,
            y: t.y - 14,
            text: 'geankert ×1.0',
            age: 0,
            life: 0.6,
            color: '#b3a6e6',
          });
        } else if (flankZoneHit !== 'front') {
          state.texts.push({
            x: t.x,
            y: t.y - 14,
            text: `${flankZoneHit === 'rear' ? 'Heck' : 'Seite'} ×${flankMult}`,
            age: 0,
            life: 0.6,
            color: flankZoneHit === 'rear' ? '#ff5a3c' : '#ffb347',
          });
        }
        // Heck-Kill: kurze Zeitlupe (killFeedback.slowMoS/slowMoScale),
        // ausgewertet in run.js: stepRun() -- dieselbe dt-Skalierungstechnik
        // wie der alte Trickshot.
        if (flankZoneHit === 'rear' && !t.alive) {
          state.rearKillTimer = state.data.balance.killFeedback?.slowMoS || 0;
        }
        // Upgradepool-v2 Phase 5: der Verursacher zieht das Ziel-Scoring
        // kurzzeitig an (ai.js: candidateScore) -- nur relevant fuer Gegner
        // (registerThreat() no-opt fuer den Spieler von selbst).
        registerThreat(t, b.owner, state);
        // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp (nur der vom SPIELER an
        // Gegnern angerichtete Aufschlag) -- ersetzt die ausgemusterten
        // USP-Kennzahlen als Telemetrie-Grundlage. Bewusst nur der Trefferwert;
        // DOT-Ticks/Explosionen sind eine bekannte Untererfassung.
        if (own && t !== state.player) {
          const dt = b.damageType || 'physical';
          state.damageByType[dt] = (state.damageByType[dt] || 0) + schaden;
        }
        // Schadenstyp (Phase 6): Statuseffekt auftragen bzw. Blitzkette
        // weiterspringen lassen. NACH dem eigentlichen Treffer, damit die
        // Kette vom bereits geschaedigten Ziel ausgeht.
        applyTypeEffects(state, t, b.damageType, schaden, trefferMeta);
        // ghost_075 "Raubseele" (Nekromant-V2 Phase 8): der CHAMPION heilt den
        // Hauptpanzer um einen Anteil des VERURSACHTEN Schadens (jeder Treffer,
        // nicht nur ein Kill wie das aeltere Seelensog unten). Ueberlauf ueber
        // volles Leben hinaus wird UNBEGRENZT zu Schild (Auftrag Abschnitt 9:
        // die alte, hier entfernte 15-%-Deckelung war eine kuenstliche
        // Obergrenze -- der Schild-Punktepool selbst kennt ohnehin keinen
        // Speicherdeckel, s. absorbWithShieldPool()).
        if (b.owner?.isGhost && b.owner.isChampion && t !== state.player) {
          const stealPct = state.player?.cfg?.necroCrownLifestealToPlayerPct;
          if (stealPct && state.player.alive) {
            let heal = Math.round(schaden * stealPct);
            const room = state.player.cfg.maxHp - state.player.hp;
            const toHp = Math.min(room, heal);
            state.player.hp += toHp;
            heal -= toHp;
            if (heal > 0) state.player.shield = (state.player.shield || 0) + heal;
          }
        }
        // ghost_082 "Kronjaeger" (Nekromant-V2 Phase 8, nur Champion): hebt die
        // Exekutionsschwelle fuer das GETROFFENE Ziel zeitlich befristet an --
        // wiederverwendet 1:1 den ghost_026-Mechanismus (necroExecUntil/
        // necroExecThreshold, s. Exekutions-Timer-Schleife oben in dieser
        // Funktion), refresht sich mit jedem weiteren Champion-Treffer.
        if (b.owner?.isGhost && b.owner.isChampion && t !== state.player) {
          const execPct = state.player?.cfg?.necroChampionExecThreshold;
          if (execPct) {
            t.necroExecUntil = state.time + (state.player.cfg.necroChampionExecDurationS || 0);
            t.necroExecThreshold = execPct;
          }
        }
        // Geisterpanzer: eigener Kill-Zaehler, nicht dem Spieler zugerechnet.
        // Upgradepool-v2 Phase 4: die Timer-Verlaengerung (b.owner.timeLeft +=
        // balance.ghost.killBonus) ist mit dem alten Geistersystem abgebaut --
        // ghostKills bleibt als reine Telemetrie bestehen, der Neubau in
        // Phase 7 dieses Auftrags hat ohnehin keinen Lebensdauer-Timer mehr
        // ("kein Timer, lebt bis Tod oder Raumende").
        if (b.owner?.isGhost && t !== state.player && !t.alive) {
          state.ghostKills++;
          // Seelensog (Upgradepool-v2 Phase 8): heilt den Nekromanten um
          // einen Anteil des Kill-Schadens -- an genau dieser einen Stelle
          // ausgewertet, kein zweites Heilsystem noetig.
          const lifestealPct = state.player?.cfg?.ghostLifestealPct;
          if (lifestealPct && state.player.alive) {
            const heal = Math.round(schaden * lifestealPct);
            if (heal > 0) {
              state.player.hp = Math.min(state.player.cfg.maxHp, state.player.hp + heal);
            }
          }
          // ghost_093 "Tribut des Koenigs" (Nekromant-V2 Phase 9): NUR
          // Abschuesse DES CHAMPIONS zaehlen -- eigener Zaehler auf dem
          // Geist selbst (nicht raumweit, "der Champion" kann wechseln,
          // aber der Zaehler soll ihm persoenlich folgen, nicht der Rolle).
          if (b.owner.isChampion && state.player?.cfg?.necroHybridChampionKillsPerSpawn) {
            b.owner.championKills = (b.owner.championKills || 0) + 1;
            const pcHyb = state.player.cfg;
            if (b.owner.championKills % pcHyb.necroHybridChampionKillsPerSpawn === 0) {
              const g = createGhost(state, b.owner.x, b.owner.y, b.owner.heading, b.owner.type, {
                baseStatPctOverride: pcHyb.necroHybridChampionSpawnStatPct,
              });
              g.lifetimeMax = pcHyb.necroHybridChampionSpawnLifetimeS;
              g.lifetime = pcHyb.necroHybridChampionSpawnLifetimeS;
              // "Mit Einziger Thron verschmilzt er sofort" -- ergibt sich von
              // selbst: pushGhost() wertet necroUniqueThrone bereits generisch
              // aus, kein Sonderfall noetig.
              pushGhost(state, g);
            }
          }
        }
        // Seelenketten (Upgradepool-v2 Phase 8): JEDER Treffer eines
        // Geisterpanzers betaeubt das Ziel kurz (nur die Bewegung -- eigenes
        // Feld, unabhaengig vom Turm-Stun der EMP-Mine).
        if (b.owner?.isGhost && t !== state.player) {
          const stunS = state.player?.cfg?.ghostStunOnHit;
          if (stunS) t.stunTimer = Math.max(t.stunTimer || 0, stunS);
        }
        break;
      }
    }
  }

  // Gegner-Geschosse gegen Geister (Upgradepool-v2 Phase 5): eigene, kleine
  // Schleife statt Geister in die grosse Panzer-Trefferschleife oben zu
  // pressen -- deren Logik (Panzerung, Krit, Kopfschuss-Execute) ist auf
  // echte Panzer in state.tanks zugeschnitten und wuerde fuer
  // Geister falsche Sonderfaelle auswerten. Nur GEGNERISCHE Kugeln sind
  // gefaehrlich (Geister kaempfen auf Spielerseite); eigene/Geister-Kugeln
  // ignorieren einander. killGhost() (Phase 7) ist der einzige Tod-Trichter
  // -- Phase 8 haengt spaetere Todes-Hooks (Letzter Wille, Wiederkehr) dort
  // ein, nicht hier.
  for (const b of state.bullets) {
    if (b.dead || b.owner === state.player || b.owner?.isGhost) continue;
    for (const g of state.ghosts) {
      if (!g.alive) continue;
      // Durchschlag (Nekromant-V2 Phase 2): dieselbe Trefferliste wie bei
      // echten Panzern -- ein Geschoss darf denselben Geist nicht zweimal
      // treffen.
      if (b.pierceHits?.has(g)) continue;
      if (circlesOverlap(b.x, b.y, b.radius, g.x, g.y, g.cfg.radius)) {
        if (!b.pierceHits) b.pierceHits = new Set();
        b.pierceHits.add(g);
        if (b.pierce > 0) b.pierce--;
        else b.dead = true;
        const pc7 = state.player?.cfg;
        // ghost_057 "Gemeinsamer Wille" (Nekromant-V2 Phase 7): ab der
        // Schwelle wird der erlittene Schaden gleichmaessig auf ALLE
        // aktiven Untertanen verteilt (VOR Resistenz/Schild -- jeder
        // Empfaenger rechnet seine eigenen Abwehrwerte).
        const recipients = state.necroSharedWillActive
          ? state.ghosts.filter((x) => x.alive)
          : [g];
        const share = b.damage / recipients.length;
        for (const rg of recipients) {
          // ghost_079/ghost_084 (Nekromant-V2 Phase 8): waehrend eines
          // gewaehrten Unverwundbarkeitsfensters (Unantastbarer/Unsterblicher
          // Koenig, s. u.) nimmt der Champion gar keinen weiteren Schaden.
          if (rg.invulnUntil > state.time) continue;
          // ghost_038/042/057: raumweiter Schwellenwert-Bonus + Naehe-Aura +
          // "Gemeinsamer Wille"-Resistenz, additiv auf die eigene Resistenz.
          const effResist =
            (rg.cfg.resist || 0) +
            (state.necroLegionResistBonus || 0) +
            (rg.legionAuraResist || 0) +
            (rg.anchored ? pc7?.necroCrownAnchorResist || 0 : 0) +
            (state.necroSharedWillActive ? pc7?.necroSharedWillResist || 0 : 0);
          let dmg = applyResistToAmount({ resist: effResist }, state.data.balance?.resist, share);
          // ghost_053 "Verstaerkte Huelle": ignoriert EINMAL je Leben einen
          // Treffer, der mehr als necroHullThresholdPct des maximalen Lebens
          // verursacht -- gemessen am fertig berechneten Schaden (der Wert,
          // der wirklich von hp abginge).
          if (pc7?.necroHullThresholdPct && !rg.hullUsed && dmg > rg.cfg.maxHp * pc7.necroHullThresholdPct) {
            rg.hullUsed = true;
            continue;
          }
          dmg = absorbWithShieldPool(state, rg, dmg);
          if (dmg > 0) rg.lastDamageAt = state.time; // ghost_048: Schildwall-Regen-Sperre
          rg.hp -= dmg;
          if (rg.hp <= 0) {
            // ghost_079 "Unantastbarer" (einmal pro Raum, kein Cooldown) /
            // ghost_084 "Unsterblicher Koenig" (wiederholbar, eigene
            // Abklingzeit) -- beide nur fuer den CHAMPION, beide fangen den
            // toedlichen Treffer VOR killGhost() ab.
            if (rg.isChampion && pc7?.necroCrownUnassailable && !rg.unassailableUsed) {
              rg.unassailableUsed = true;
              rg.hp = 1;
              rg.invulnUntil = state.time + (pc7.necroCrownUnassailableS || 0);
            } else if (rg.isChampion && pc7?.necroCrownImmortalKingHealPct && state.time >= (rg.immortalKingReadyAt || 0)) {
              rg.hp = Math.max(1, Math.round(rg.cfg.maxHp * pc7.necroCrownImmortalKingHealPct));
              rg.invulnUntil = state.time + (pc7.necroCrownImmortalKingInvulnS || 0);
              rg.immortalKingReadyAt = state.time + (pc7.necroCrownImmortalKingCooldownS || 0);
            } else {
              killGhost(state, rg);
            }
          }
        }
        break;
      }
    }
  }

  updateMines(state, dt);
  updateTraps(state, dt);
  updateMortars(state, dt); // Grundsteinumbau Phase 3
  updateDeathFuses(state, dt); // G2 (t_dud)
  updateMedics(state, dt); // G5 (t_medic)
  updateMasons(state, dt); // G5 (t_mason)
  updateGrapples(state, dt); // G8 (t_grabber): Windup/Ausloesung, eigener Cooldown
  updateGrappleRopes(state); // G8: beschiessbare Leine (nach der Bullet-Bewegung oben)
  updateGhosts(state, dt);
  // Spinnenboss-Auftrag: eigene, kleine Tick-Funktionen (Muster wie
  // updateMines/updateMortars oben) statt sie in bestehende Schleifen zu
  // pressen. Die Bein-Trefferpruefung selbst laeuft bereits VOR der
  // generischen Panzer-Trefferschleife weiter oben (s. dortiger Kommentar);
  // hier nur noch Minen/Netze, die eigene Bullet-Erzeugungswege haben und
  // deshalb regulaer in der naechsten Runde geprueft werden.
  updateSpiderMines(state, dt);
  updateSpiderWebs(state, dt);
  tickNecroTimers(state, dt); // Nekromant-V2 Phase 5: zeitlich befristete Stapel
  updateWave(state, dt);

  // Sprengschuss-Upgrade: markierte Geschosse explodieren beim Tod
  // (Wandkontakt, Panzertreffer, Geschoss-gegen-Geschoss, Minenzuendung).
  for (const b of state.bullets) {
    if (b.dead && b.explosive && !b.detonated) {
      b.detonated = true;
      const own = b.owner === state.player;
      // Phase 12 (Sprengstoff-Topf): der Schuetze kann den Explosionsschaden
      // per explosionDamageMult skalieren (sonst der Standardwert aus balance).
      const explDmg =
        (state.data.balance?.damage?.explosion ?? 1) * (b.owner?.cfg?.explosionDamageMult || 1);
      explodeAt(state, b.x, b.y, b.explosionRadius, undefined, {
        code: own ? 'own_bullet' : 'enemy_bullet',
        enemyType: own ? null : b.owner?.type || null,
        killer: b.owner, // Kill-Zuordnung (Phase 6)
      }, explDmg);
      // Amboss-Auftrag (Abschnitt 6): eine explosive Kugel UND ihre
      // Explosion sind EIN Angriffspaket -- 'shot:' + dieselbe rageEventId,
      // die ein evtl. direkter Kontakt oben in der Trefferschleife bewusst
      // NICHT registriert hat (b.explosive schliesst dort aus). Nur, wenn
      // der Amboss ueberhaupt im Explosionsradius liegt, wie bei Mine/
      // Direkttreffer auch.
      if ((own || b.owner?.isGhost) && state.anvilBoss?.alive) {
        const ab = state.anvilBoss;
        if (circlesOverlap(b.x, b.y, b.explosionRadius, ab.x, ab.y, ab.cfg.radius)) {
          state.registerAnvilRage('explosion', 'shot:' + (b.rageEventId ?? b.id));
        }
      }
      // Schrapnell: Splitterkugeln in alle Richtungen.
      const n = b.owner?.cfg?.schrapnell;
      if (n && b.owner.alive) spawnRadialBullets(state, b.owner, b.x, b.y, n);
    }
  }

  // Kurzlebige Render-Effekte altern lassen.
  for (const e of state.explosions) e.age += dt;
  state.explosions = state.explosions.filter((e) => e.age < 0.4);
  for (const f of state.flashes) f.age += dt;
  state.flashes = state.flashes.filter((f) => f.age < 0.08);
  for (const pt of state.particles) {
    pt.age += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
  }
  state.particles = state.particles.filter((pt) => pt.age < pt.life);
  for (const tx of state.texts) tx.age += dt;
  state.texts = state.texts.filter((tx) => tx.age < tx.life);
  state.damageFlash = Math.max(0, state.damageFlash - dt);
  state.shake = Math.max(0, state.shake - state.shake * 4 * dt - 0.5 * dt);

  state.bullets = state.bullets.filter((b) => !b.dead);

  // Gegner-Geschosse deckeln (E4: enemyBullet.maxActive, aelteste zuerst).
  // Beim SPIELER wird bewusst NICHT verdraengt -- dort sperrt das Feuern
  // (sonst raeumen Verlegenheitsschuesse den gelegten Abprallschuss weg).
  // Spinnenboss-Auftrag Abschnitt 24 (Ist-Abgleich-Fund): der alte Filter
  // "owner !== state.player" zaehlte GEISTER-/CHAMPION-Geschosse (Besitzer
  // ist nie state.player, aber auch nicht gegnerisch) faelschlich als
  // gegnerisch mit -- sie waeren dadurch am gleichen Budget verdraengbar
  // gewesen wie echte Bossschuesse. `!b.owner.isGhost` korrigiert das.
  // In der dritten Bossphase (Bullet Hell) gilt zusaetzlich ein eigenes,
  // hoeheres Budget (boss.spider.bulletHellMaxActive) -- state.js nimmt
  // bewusst das GROESSERE der beiden Werte, nicht einen Ersatzwert, damit
  // normale Raeume ihr bisheriges Verhalten unveraendert behalten.
  const spiderHellCap = state.spiderBoss?.spiderPhase === 3 ? state.data.balance?.boss?.spider?.bulletHellMaxActive : null;
  const baseEnemyCap = state.data.balance.enemyBullet?.maxActive;
  const enemyCap = spiderHellCap ? Math.max(baseEnemyCap || 0, spiderHellCap) : baseEnemyCap;
  if (enemyCap) {
    const enemyBullets = state.bullets.filter((b) => b.owner && b.owner !== state.player && !b.owner.isGhost);
    if (enemyBullets.length > enemyCap) {
      const drop = new Set(enemyBullets.slice(0, enemyBullets.length - enemyCap));
      state.bullets = state.bullets.filter((b) => !drop.has(b));
    }
  }

  // Minen-Deckel (Phase 11b, data/limits.json: mines) -- anders als beim
  // Gegner-Geschoss-Deckel EIN gemeinsames Budget fuer ALLE Minen zusammen
  // (PLAN.md fuehrt Minen als eine einzige Zeile, nicht getrennt nach
  // Spieler/Gegner wie bei den Geschossen). Verdraengt wird trotzdem nur
  // von GEGNER-Minen, aeltestes zuerst -- eigene (Spieler-)Minen werden nie
  // entfernt, dieselbe Asymmetrie wie beim Gegner-Geschoss-Deckel.
  const mineCap = state.data.limits?.mines;
  if (mineCap && state.mines.length > mineCap) {
    const excess = state.mines.length - mineCap;
    const enemyMines = state.mines.filter((m) => m.owner !== state.player);
    const drop = new Set(enemyMines.slice(0, Math.min(excess, enemyMines.length)));
    state.mines = state.mines.filter((m) => !drop.has(m));
  }
}
