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
import { createGhost, updateGhosts, killGhost } from './ghost.js';
import { updateEnemy, updateCoverPerception, updateTargeting, resolveTarget, registerThreat } from './ai.js';
import { applyStatus, updateStatus } from './status.js';
import { applyTypeEffects } from './damagetypes.js';
import { stepMirrorBoss, stepPhalanxBoss } from './bossai.js';
import { circlesOverlap } from './collision.js';
import { generateRoom, buildFixedRoom } from './generator.js';
import { resolveCfg, applyUpgrades, applyRoomModifier, applyRoomContext, applyHpScaling, applyScrapDamage, isBossCfg } from './cfg.js';
import { armorBlocks, reflectBullet, reflectFromAim, isLive, flankZone } from './armor.js';

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
};

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
  for (const affix of eliteAffixes.chosen) {
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

export function createState(data, tiles, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades, upgradesData, shieldCharges,
    roomSpec, arenas, transform, equippedSecondary, equippedGadget, waveSplit, waveCfg, eliteAffixes, modifier,
    destructibleWalls, hazardType, roomContext, hpScale, hpSkipBosses,
    starterTank = 'player', starterScrap = 0 } = opts;
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
        applyScrapDamage(
          applyUpgrades(resolveCfg(data, starterTank), playerUpgrades, upgradesData, equippedSecondary, equippedGadget),
          starterScrap,
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
    equippedSecondary: equippedSecondary || 'mine', // Phase 6: fuer respawnPlayer()
    equippedGadget: equippedGadget || null, // P4: zweiter Slot, ebenfalls fuer respawnPlayer()
    starterTank, // Phase 9: gewaehlte Klasse -- respawnPlayer() baut denselben Panzer
    starterScrap, // Phase 9: Schrottstand fuer das Schrottpanzer-Passiv (pro Raum gebacken)
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
    tanks,
    player,
    bullets: [],
    mines: [],
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
      state.walls.push({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'trap', col, row, customDurability: hits });
      grid[row][col] = '#';
      state.sounds.push({ name: 'mine', x: cx });
      return true;
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
      // Schaden ueber Zeit (Phase 5) ueberspringt ALLE Schild-Gatter
      // darunter. Ein Schild, der "den naechsten Treffer abfaengt", darf
      // nicht an einem 4-Punkte-Brandtick verpuffen -- sechs Ticks wuerden
      // sonst drei Ladungen in anderthalb Sekunden verbrauchen. Die
      // Boss-Unverwundbarkeit oben gilt dagegen weiter.
      if (meta?.overTime) {
        // Exekutionsschwelle (Phase 2): der Schaden wird trotzdem abgezogen
        // (hp bleibt eine ehrliche Zahl, auch nach dem Tod) -- garantiert ist
        // nur der TOD selbst, unabhaengig davon, ob der Abzug allein dafuer
        // gereicht haette (ein bereits rauchender Gegner stirbt so auch an
        // einem kleinen Statuseffekt-Tick).
        tank.hp -= amount ?? 1;
        if (tank.hp > 0 && !tank.executing) return;
        state.killTank(tank, cause, meta);
        return;
      }
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
        // trotz Schild toeten).
        if (amount <= 0) return;
        tank.hp -= amount;
        if (tank.hp > 0) return;
        state.killTank(tank, cause, meta);
        return;
      }
      // Kein Gatter hat gegriffen -> der Treffer geht durch. Der Schaden wird
      // immer abgezogen (hp bleibt eine ehrliche Zahl).
      tank.hp -= amount ?? 1;
      // Exekutionsschwelle (Grundsteinumbau Phase 2): war das Ziel VOR
      // diesem Treffer schon im Exekutionszustand (t.executing, s.
      // stepState()-Timer-Schleife), toetet dieser Treffer garantiert --
      // unabhaengig davon, ob der Abzug allein hp<=0 gebracht haette.
      // Absichtlich HIER (nach allen Abwehr-Gattern), nicht ganz oben: ein
      // Schild soll einen Gegner unter der Schwelle weiterhin retten koennen,
      // wenn er den Treffer voll abfaengt -- nur ein Treffer, der wirklich
      // durchkommt, ist garantiert toedlich.
      if (tank.hp > 0 && !tank.executing) return;
      state.killTank(tank, cause, meta);
    },
    // Reine Todeslogik -- ab hier ist der Panzer tot, es gibt keine
    // Abwehr mehr. Bewusst weiterhin direkt aufrufbar (Tests raeumen damit
    // Raeume ab), aber im Spielcode ruft sie nur noch applyDamage().
    killTank(tank, cause, meta) {
      if (!tank.alive) return; // doppelter Tod im selben Frame (Kettenreaktion)
      tank.alive = false;
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
        state.enemyKills++;
        state.killLog.push(tank.type);
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
        // Nekromant: Klassenidentitaet (Upgradepool-v2 Phase 6). Ein Kill
        // durch den SPIELER als Nekromant hat eine Chance, den getoeteten
        // Gegner als Geisterpanzer wiederzubeleben; ein Kill durch einen
        // bereits vorhandenen Geist hat eine kleinere Chance (Werte in
        // data/balance.json: ghost.spawnChance). Ueber den Seed-RNG
        // (state.rng), nie Math.random -- der Run bleibt deterministisch.
        // Limit OHNE Verdraengung: am Deckel passiert einfach nichts (kein
        // Wurf, kein Verbrauch) -- dieselbe Regel wie bei der Geisterbombe
        // (tank.js: useSecondary()). createGhost() baut seit Phase 7 den
        // FESTEN Basistyp (Anhang B S8) -- tank liefert nur noch Position/
        // Ausrichtung des Spawnpunkts, keine cfg mehr.
        const killer = meta?.killer;
        const gcfg = state.data.balance.ghost || {};
        let spawnChance = 0;
        if (killer === state.player && pc.necromancer) spawnChance = gcfg.spawnChance?.necro ?? 0;
        else if (killer?.isGhost) spawnChance = gcfg.spawnChance?.ghost ?? 0;
        // Seelenruf/Geisterlegion/Armee der Toten (Upgradepool-v2 Phase 8):
        // ghostMaxAdd erhoeht das Basislimit additiv -- eine Zahl aus
        // state.player.cfg statt eines zweiten Deckel-Felds.
        const ghostCap = (gcfg.maxActive ?? 3) + (pc.ghostMaxAdd || 0);
        if (spawnChance > 0 && state.ghosts.length < ghostCap && state.rng() < spawnChance) {
          state.ghosts.push(createGhost(state, tank.x, tank.y, tank.heading));
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
  };
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
        applyScrapDamage(
          applyUpgrades(
            resolveCfg(state.data, state.starterTank),
            state.playerUpgrades,
            state.upgradesData,
            state.equippedSecondary,
            state.equippedGadget,
          ),
          state.starterScrap,
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
  for (const t of state.tanks) {
    if (!t.alive) continue;
    t.executing =
      !!exCfg && t !== state.player && !isBossCfg(t.cfg) && t.hp / (t.cfg.maxHp || 1) <= exCfg.thresholdPct;
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
  }

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
    if (fire) {
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
      if (circlesOverlap(b.x, b.y, b.radius, t.x, t.y, t.cfg.radius)) {
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
          if (t.cfg.armor?.reflects) reflectBullet(b, t, state);
          else b.dead = true;
          break;
        }
        b.dead = true;
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
        const critMult = isCrit ? (state.data.balance?.crit?.mult ?? 1) + (oc?.critMultBonus || 0) : 1;
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
        const flankCfg = state.data.balance.flank;
        const flankZoneHit =
          flankCfg && t !== state.player && !isBossCfg(t.cfg) ? flankZone(t, b.x, b.y, flankCfg) : 'front';
        const flankMult =
          flankZoneHit === 'rear' ? flankCfg.rearMult : flankZoneHit === 'side' ? flankCfg.sideMult : 1;
        let schaden = Math.round(basisSchaden * critMult * execMult * shatterMult * flankMult);
        // Kopfschuss (Phase 11): ein Krit toetet einen Nicht-Boss-Gegner sofort.
        if (isCrit && oc?.critExecute && t !== state.player && !isBossCfg(t.cfg)) {
          schaden = Math.max(schaden, t.hp);
        }
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
        state.applyDamage(t, schaden, cause, trefferMeta);
        // Telemetrie (Phase 2): Treffer auf Panzer, nicht Waende.
        if (own) state.playerHits++;
        // Treffer-Rueckmeldung (Phase 2, Ersatz fuer den alten Trickshot-
        // Moment): Seiten-/Heck-Treffer zeigen den Faktor als schwebenden
        // Kurztext am Einschlagpunkt -- der Krit hat seit Phase 7 bereits
        // eigene Rueckmeldung (Ton/Shake/Text am Schuetzen).
        if (flankZoneHit !== 'front') {
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
      if (circlesOverlap(b.x, b.y, b.radius, g.x, g.y, g.cfg.radius)) {
        b.dead = true;
        g.hp -= b.damage ?? 1;
        if (g.hp <= 0) killGhost(state, g);
        break;
      }
    }
  }

  updateMines(state, dt);
  updateTraps(state, dt);
  updateMortars(state, dt); // Grundsteinumbau Phase 3
  updateGhosts(state, dt);
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
  const enemyCap = state.data.balance.enemyBullet?.maxActive;
  if (enemyCap) {
    const enemyBullets = state.bullets.filter((b) => b.owner && b.owner !== state.player);
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
