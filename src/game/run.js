// Run-Struktur (Spec Abschnitt 8): 15 generierte Raeume + Finalraum,
// Leben, Gefahrenbudget mit Freischaltkurve, Raum-Neustart bei Tod
// (getoetete Gegner bleiben tot), Raumuebergangs-Einblendung,
// Victory/Game-Over mit Statistik und Seed.
//
// Der genRng-Strom (Seed) wird NUR fuer Raumbau und Gegner-Einkauf
// verbraucht -- in fester Reihenfolge, unabhaengig vom Spielverlauf.
// Damit erzeugt derselbe Seed exakt denselben Run.

import { mulberry32 } from '../core/rng.js';
import { recordRun } from '../core/storage.js';
import { createState, stepState } from './state.js';

const TRANSITION_S = 1.5;

// Kauft Gegner vom Gefahrenbudget (nur freigeschaltete Typen, max. 8).
function buyEnemies(diff, genRng, roomIndex, budget) {
  const unlocked = Object.entries(diff.danger).filter(
    ([, d]) => roomIndex >= d.unlockRoom,
  );
  const types = [];
  let rest = budget;
  while (types.length < diff.maxEnemiesPerRoom) {
    const affordable = unlocked.filter(([, d]) => d.points <= rest);
    if (!affordable.length) break;
    const [type, d] = affordable[Math.floor(genRng() * affordable.length)];
    types.push(type);
    rest -= d.points;
  }
  return types;
}

function totalRooms(diff) {
  return diff.roomsBeforeFinal + 1; // 15 + Finalraum
}

function startRoom(run) {
  const diff = run.difficulty;
  const isFinal = run.roomIndex > diff.roomsBeforeFinal;
  let enemyTypes;
  let fixedRoom = null;
  let weights = null;
  if (isFinal) {
    // Handgebauter Finalraum: 2x t_black plus eingekaufte Unterstuetzung.
    fixedRoom = run.tiles.finalRoom;
    enemyTypes = [
      ...diff.finalRoom.fixed,
      ...buyEnemies(diff, run.genRng, run.roomIndex, diff.finalRoom.supportBudget),
    ].slice(0, run.tiles.finalRoom.enemySpawns.length);
  } else {
    const budget = diff.budget.base + run.roomIndex * diff.budget.perRoom;
    enemyTypes = buyEnemies(diff, run.genRng, run.roomIndex, budget);
    // Raumcharakter: Kachelgewichte alternieren (Spec Abschnitt 7B).
    const chars = diff.roomCharacters;
    if (chars && chars.length) {
      weights = chars[Math.floor(run.genRng() * chars.length)].weights;
    }
  }
  run.state = createState(run.data, run.tiles, {
    genRng: run.genRng,
    enemyTypes,
    aiSeed: (run.seed + run.roomIndex * 7919) >>> 0,
    fixedRoom,
    weights,
    playerUpgrades: run.upgrades,
    upgradesData: run.upgradesData,
  });
  // Vorschau: Gegnerliste + "Weiter"-Button (main.js zeigt das Overlay);
  // erst der Klick startet den 1,5-s-Uebergang.
  run.phase = 'preview';
  run.transitionTimer = TRANSITION_S;
  run.seenRoomKills = 0;
  run.seenRoomDeaths = 0;
}

// Vom "Weiter"-Button der Raumvorschau aufgerufen.
export function enterRoom(run) {
  if (run.phase !== 'preview') return;
  run.phase = 'transition';
  run.transitionTimer = TRANSITION_S;
}

export function createRun(data, tiles, difficulty, upgradesData, seed) {
  const run = {
    data,
    tiles,
    difficulty,
    upgradesData,
    upgrades: {}, // gewaehlte Upgrade-Level {id: stufe}
    upgradeChoices: 0,
    pendingOffers: null,
    seed: seed >>> 0,
    genRng: mulberry32(seed >>> 0),
    roomIndex: 1,
    lives: difficulty.lives,
    kills: 0, // ueber den ganzen Run
    deaths: 0,
    roomsCleared: 0,
    playTime: 0, // s aktive Spielzeit
    phase: 'transition', // 'transition' | 'playing' | 'gameover' | 'victory'
    transitionTimer: TRANSITION_S,
    state: null,
    finalStats: null,
  };
  startRoom(run);
  return run;
}

function finishRun(run, won) {
  run.phase = won ? 'victory' : 'gameover';
  run.finalStats = recordRun({
    won,
    rooms: run.roomsCleared,
    kills: run.kills,
    timeS: run.playTime,
  });
}

export function stepRun(run, cmd, dt) {
  if (run.phase === 'transition') {
    run.transitionTimer -= dt;
    if (run.transitionTimer <= 1e-9) run.phase = 'playing';
    return;
  }
  if (run.phase !== 'playing') return;

  const st = run.state;
  stepState(st, cmd, dt);
  run.playTime += dt;

  // Kumulative Raumzaehler abgleichen (robust, egal wo Kills passieren).
  if (st.enemyKills > run.seenRoomKills) {
    run.kills += st.enemyKills - run.seenRoomKills;
    run.seenRoomKills = st.enemyKills;
  }

  // Spielertod: Leben abziehen; bei 0 ist der Run vorbei (der Raum-
  // Neustart passiert sonst automatisch ueber state.respawnTimer).
  if (st.playerDeaths > run.seenRoomDeaths) {
    const d = st.playerDeaths - run.seenRoomDeaths;
    run.seenRoomDeaths = st.playerDeaths;
    run.deaths += d;
    run.lives -= d;
    if (run.lives <= 0) {
      finishRun(run, false);
      return;
    }
  }

  // Raum geschafft: alle Gegner tot, Spieler lebt.
  const enemiesLeft = st.tanks.filter((t) => t !== st.player && t.alive).length;
  if (enemiesLeft === 0 && st.player.alive) {
    run.roomsCleared++;
    // Extraleben alle 5 geschaffte Raeume.
    if (run.roomsCleared % run.difficulty.extraLifeEveryClearedRooms === 0) {
      run.lives++;
    }
    if (run.roomIndex >= totalRooms(run.difficulty)) {
      finishRun(run, true);
      return;
    }
    // Nach jedem 3. Raum (3, 6, 9, 12, 15): Upgrade-Screen.
    const u = run.upgradesData;
    if (u && run.roomIndex % u.everyNRooms === 0) {
      run.pendingOffers = rollOffers(run);
      run.phase = 'upgrade';
      return;
    }
    run.roomIndex++;
    startRoom(run);
  }
}

// 3 zufaellige Angebote aus dem Pool (Seed-RNG -> deterministisch).
// Ausgemaxte Upgrades fliegen raus; fehlende Slots fuellt "+1 Leben".
function rollOffers(run) {
  const u = run.upgradesData;
  const avail = Object.entries(u.upgrades)
    .filter(([id, def]) => (run.upgrades[id] || 0) < def.max)
    .map(([id, def]) => ({
      id,
      name: def.name,
      desc: def.desc,
      level: (run.upgrades[id] || 0) + 1,
      max: def.max,
      fallback: false,
    }));
  // Fisher-Yates ueber den genRng-Strom.
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(run.genRng() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  const offers = avail.slice(0, u.offersPerScreen);
  while (offers.length < u.offersPerScreen) {
    offers.push({ id: null, name: u.fallback.name, desc: u.fallback.desc, fallback: true });
  }
  return offers;
}

// Auswahl anwenden und den Run fortsetzen.
export function chooseUpgrade(run, index) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return;
  const offer = run.pendingOffers[index];
  if (!offer) return;
  if (offer.fallback) {
    run.lives++;
  } else {
    run.upgrades[offer.id] = (run.upgrades[offer.id] || 0) + 1;
  }
  run.upgradeChoices++;
  run.pendingOffers = null;
  run.roomIndex++;
  startRoom(run);
}

// Fuer HUD: "4/7"-Restzaehler.
export function enemyCount(run) {
  const st = run.state;
  const total = st.tanks.length - 1;
  const alive = st.tanks.filter((t) => t !== st.player && t.alive).length;
  return { alive, total };
}

export { totalRooms };
