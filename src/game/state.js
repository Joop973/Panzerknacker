// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 6: Raeume kommen aus dem Generator (Kachelsystem, data/tiles.json).
// RNG: genRng ist der RAUMBAU-Strom (aus hash(seed, roomIndex, 'rooms'),
// siehe core/rng.js) und aiRng der KI-Strom -- getrennt, damit der
// Spielverlauf den Raumbau nicht verschiebt. Alle Balancing-Werte kommen
// aus data/*.json.

import { CELL } from '../config.js';
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
import { updateBullet } from './bullet.js';
import { updateMines, explodeAt } from './mine.js';
import { fireMortar, updateMortars } from './mortar.js';
import { updateTraps } from './trap.js';
import { createGhost, updateGhosts, killGhost, occupiedGhostSlots, pushGhost } from './ghost.js';
import { tickNecroTimers, buildNecroListeners, applyVirtualNecroDeaths } from './necro.js';
import { updateEnemy, updateCoverPerception, updateTargeting, resolveTarget, registerThreat, clearLine } from './ai.js';
import { updateStatus } from './status.js';
import { applyTypeEffects } from './damagetypes.js';
import { stepMirrorBoss, stepPhalanxBoss, stepAnvilBoss, showAnvilHint } from './bossai.js';
import { stepSpiderBoss, updateSpiderLegHits, updateSpiderWebs } from './spider.js';
import { updateSpiderMines } from './spidermine.js';
import { circlesOverlap } from './collision.js';
import { generateRoom, buildFixedRoom } from './generator.js';
import { resolveCfg, applyUpgrades, applyRoomModifier, applyRoomContext, applyHpScaling, applyScrapDamage, applyNecroRunScaling, applyMakelNarben, applyCfgFloors, isBossCfg } from './cfg.js';
import { armorBlocks, reflectBullet, reflectFromAim, isLive, flankZone, angleDelta } from './armor.js';
// AUFTRAG-FERTIGSTELLUNG Phase A2: createState()s Objektliteral-Teil ist in
// fuenf Module aufgeteilt (reines Refactoring, kein Verhaltensunterschied --
// s. CLAUDE.md). buildInitialFields() liefert die reinen Datenfelder,
// createWorldMethods()/createDamageMethods()/createFxMethods() die vorher
// inline definierten Methoden (per Object.assign in den fertigen `state`
// gemischt). bondTethers bleibt Teil der oeffentlichen API dieser Datei
// (s. Export unten) -- Tests importieren es weiterhin aus state.js.
import { buildInitialFields } from './state_init.js';
import { createWorldMethods, buildWalls } from './state_world.js';
import { createDamageMethods, spawnRadialBullets, applyResistToAmount, absorbWithShieldPool } from './state_damage.js';
import { createFxMethods } from './state_fx.js';
import {
  bondTethers,
  updateDeathFuses,
  updateTethers,
  updateMedics,
  updateMasons,
  updateMetronomes,
  metronomeHolds,
  updateGrapples,
  updateGrappleRopes,
} from './enemymechanics.js';

export { bondTethers };

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

export function createState(data, tiles, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades, upgradesData, shieldCharges,
    roomSpec, arenas, transform, equippedSecondary, equippedGadget, waveSplit, waveCfg, eliteAffixes, modifier,
    destructibleWalls, hazardType, roomContext, hpScale, hpSkipBosses, upgradeLevels, levelBalance, makelRemoved,
    makelUmgepolt, makelSchwereOverride, makelNarbenCount = 0,
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

  // Phase M1 (AUFTRAG-UMBAU-V2.md): Basiswerte VOR jeder Karte, fuer die
  // relativen Floors (Tempo/Kugeltempo/Nachladezeit -- applyCfgFloors()
  // klemmt am Ende der Kette). Eigenstaendige Zahlen-Snapshots statt einer
  // zweiten resolveCfg()-Referenz: der Aufloesungspfad mutiert dasselbe
  // Objekt mehrfach in place (applyUpgrades/applyScrapDamage/...), eine
  // geteilte Objektreferenz waere beim Lesen laengst veraendert.
  const playerBaseCfg = resolveCfg(data, starterTank);
  const playerFloorBases = { speed: playerBaseCfg.speed, bulletSpeed: playerBaseCfg.bulletSpeed, fireCooldown: playerBaseCfg.fireCooldown };
  const player = createTank(
    starterTank,
    applyCfgFloors(
      applyRoomContext(
        applyRoomModifier(
          // Nekromant-V2 Phase 6 (ghost_029/030): permanente Run-Boni NACH dem
          // Schrottpanzer-Passiv, VOR dem Raum-Modifikator -- gleiche Stelle
          // wie applyScrapDamage(), ein weiterer "einmal pro Raumaufbau
          // gebackener" Multiplikator.
          applyMakelNarben(
          applyNecroRunScaling(
          applyScrapDamage(
            applyUpgrades(
            playerBaseCfg,
            playerUpgrades,
            upgradesData,
            equippedSecondary,
            equippedGadget,
            upgradeLevels,
            levelBalance,
            data.makel,
            makelRemoved,
            makelUmgepolt,
            makelSchwereOverride,
          ),
            starterScrap,
          ),
          necroRunDmgBonus,
          necroRunHpBonus,
          ),
            makelNarbenCount,
            data.balance,
          ),
          modifier,
          true,
        ),
        roomContext,
      ),
      data.balance?.floors,
      playerFloorBases,
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

  // AUFTRAG-FERTIGSTELLUNG Phase A2: der ehemalige Objektliteral-Teil.
  // buildInitialFields() liefert GENAU dieselben Datenfelder wie vorher (s.
  // state_init.js) -- `state` ist danach ein reines Datenobjekt, noch ohne
  // Methoden. Object.assign() mischt die drei Methoden-Factories DANACH ein
  // (jede Factory bekommt `state` als bereits existierende Referenz, genau
  // wie die Objektliteral-Methoden vorher `state` erst beim spaeteren Aufruf
  // lasen, nie waehrend der Konstruktion selbst) -- Reihenfolge und Ergebnis
  // sind identisch zum vorherigen einzelnen Objektliteral.
  const state = buildInitialFields(
    data,
    tiles,
    room,
    grid,
    walls,
    tanks,
    player,
    pendingWave,
    { hazard, movingWalls, oilCells, conveyor, laserWalls },
    opts,
  );
  Object.assign(state, createWorldMethods(state, grid, walls), createDamageMethods(state), createFxMethods(state));

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

// Raum-Neustart nach Spielertod (Spec Abschnitt 8): identisches Layout,
// getoetete Gegner bleiben tot, lebende starten auf ihren urspruenglichen
// Spawns; Geschosse und Minen werden entfernt; zerstoerte Waende bleiben
// zerstoert.
function respawnPlayer(state) {
  // Phase M1 (AUFTRAG-UMBAU-V2.md): siehe Kommentar bei createState() --
  // dieselbe Basiswert-Erfassung fuer applyCfgFloors().
  const respawnBaseCfg = resolveCfg(state.data, state.starterTank);
  const respawnFloorBases = { speed: respawnBaseCfg.speed, bulletSpeed: respawnBaseCfg.bulletSpeed, fireCooldown: respawnBaseCfg.fireCooldown };
  const fresh = createTank(
    state.starterTank,
    applyCfgFloors(
      applyRoomContext(
        applyRoomModifier(
          applyMakelNarben(
          applyNecroRunScaling(
          applyScrapDamage(
            applyUpgrades(
              respawnBaseCfg,
              state.playerUpgrades,
              state.upgradesData,
              state.equippedSecondary,
              state.equippedGadget,
              state.upgradeLevels,
              state.levelBalance,
              state.data.makel,
              state.makelRemoved,
              state.makelUmgepolt,
              state.makelSchwereOverride,
            ),
            state.starterScrap,
          ),
          state.necroRunDmgBonus,
          state.necroRunHpBonus,
          ),
            state.makelNarbenCount,
            state.data.balance,
          ),
          state.modifier,
          true,
        ),
        state.roomContext,
      ),
      state.data.balance?.floors,
      respawnFloorBases,
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
  const baseGrace = state.data.balance.bullet.selfImmunity;
  for (const b of state.bullets) {
    if (b.dead) continue;
    // Phase M1 (AUFTRAG-UMBAU-V2.md, Makel "Heisser Lauf"): der Schuetze
    // kann seine eigene Selbst-Immunitaet ueber cfg.selfImmunityMult
    // verkuerzt haben (cfg.js: applyUpgrades()/applyCfgFloors()). `?? 1`
    // heisst unveraendert -- der weitaus haeufigste Fall (kein Makel aktiv).
    const grace = baseGrace * (b.owner?.cfg?.selfImmunityMult ?? 1);
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
