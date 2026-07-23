// Run-Struktur (Spec Abschnitt 8): 15 generierte Raeume + Finalraum,
// Leben, Gefahrenbudget mit Freischaltkurve, Raum-Neustart bei Tod
// (getoetete Gegner bleiben tot), Raumuebergangs-Einblendung,
// Victory/Game-Over mit Statistik und Seed.
//
// Der genRng-Strom (Seed) wird NUR fuer Raumbau und Gegner-Einkauf
// verbraucht -- in fester Reihenfolge, unabhaengig vom Spielverlauf.
// Damit erzeugt derselbe Seed exakt denselben Run.

import { mulberry32 } from '../core/rng.js';
import { recordRun, loadStats } from '../core/storage.js';
import { createState, stepState } from './state.js';
import { rollOffers as rollFromPool, drawOne } from './upgradepool.js';

const TRANSITION_S = 1.5;
const COMBO_WINDOW = 2.5; // s: Zeitfenster fuer die naechste Combo-Kill

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
  // Finalraum genau einmal (Raum 16); im Endlos-Modus danach nie wieder.
  const isFinal = !run.endless && run.roomIndex === diff.roomsBeforeFinal + 1;
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
    const budget =
      (diff.budget.base + run.roomIndex * diff.budget.perRoom) * run.budgetMult;
    enemyTypes = buyEnemies(diff, run.genRng, run.roomIndex, budget);
    // Raumcharakter: Kachelgewichte alternieren (Spec Abschnitt 7B).
    const chars = diff.roomCharacters;
    if (chars && chars.length) {
      const ch = chars[Math.floor(run.genRng() * chars.length)];
      weights = ch.weights;
      run.roomCharacter = ch.name;
    }
  }
  if (isFinal) run.roomCharacter = 'Finale';
  run.state = createState(run.data, run.tiles, {
    genRng: run.genRng,
    enemyTypes,
    aiSeed: (run.seed + run.roomIndex * 7919) >>> 0,
    fixedRoom,
    weights,
    playerUpgrades: run.upgrades,
    upgradesData: run.upgradesData,
    shieldCharges: run.shieldCharges, // raumuebergreifende Notschild-Ladungen
  });
  // Vorschau: Gegnerliste + "Weiter"-Button (main.js zeigt das Overlay);
  // erst der Klick startet den 1,5-s-Uebergang.
  run.phase = 'preview';
  run.transitionTimer = TRANSITION_S;
  run.seenRoomKills = 0;
  run.seenRoomDeaths = 0;
  run.seenKillLog = 0;
  run.seenRoomShots = 0;
  run.combo = 0; // Combo gilt nur innerhalb eines Raums
  run.comboTimer = 0;
}

// Vom "Weiter"-Button der Raumvorschau aufgerufen.
export function enterRoom(run) {
  if (run.phase !== 'preview') return;
  run.phase = 'transition';
  run.transitionTimer = TRANSITION_S;
}

export function createRun(data, tiles, difficulty, upgradesData, seed, modeKey = 'normal') {
  const mode = (difficulty.modes && difficulty.modes[modeKey]) || {
    label: 'Normal',
    budgetMult: 1,
    lives: difficulty.lives,
  };
  const run = {
    data,
    tiles,
    difficulty,
    upgradesData,
    mode: mode.label,
    budgetMult: mode.budgetMult,
    upgrades: {}, // gewaehlte Upgrade-Level {id: stufe}
    upgradeChoices: 0,
    shieldCharges: 0, // Notschild-Ladungen (raumuebergreifend, keine Regen)
    scrap: 0, // Schrott-Waehrung (Run-State, Phase 3)
    scrapThisRoom: 0, // im aktuellen Raum verdienter Schrott (Telemetrie)
    bannedUpgrades: new Set(), // im Run verbannte Upgrade-ids (nicht persistent)
    pendingOffers: null,
    killsByType: {}, // Statistik fuer die Endscreens
    shotsFired: 0, // Spieler-Abzuege ueber den ganzen Run (Trefferquote)
    combo: 0, // laufende Kill-Combo
    comboTimer: 0, // s bis die Combo verfaellt
    bestCombo: 0, // hoechste Combo im Run
    seed: seed >>> 0,
    genRng: mulberry32(seed >>> 0),
    roomIndex: 1,
    lives: mode.lives,
    maxLives: mode.lives, // Bezug fuer Berserker (fehlende Leben)
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
  // Rekord-Erkennung VOR dem Eintragen (alte Bestwerte vergleichen).
  const prev = loadStats();
  run.newRecord =
    (won && run.playTime < (prev.fastestWinS ?? Infinity)) ||
    run.roomsCleared > (prev.mostRooms || 0);
  run.finalStats = recordRun({
    won,
    rooms: run.roomsCleared,
    kills: run.kills,
    timeS: run.playTime,
    bestCombo: run.bestCombo,
  });
  if (won) run.state.sounds.push('fanfare');
}

export function stepRun(run, cmd, dt) {
  if (run.phase === 'transition') {
    run.transitionTimer -= dt;
    if (run.transitionTimer <= 1e-9) run.phase = 'playing';
    return;
  }
  if (run.phase !== 'playing') return;

  const st = run.state;
  // Berserker: Feuerrate/Tempo steigen mit fehlenden Leben (gedeckelt).
  const bcfg = st.player.cfg.berserker;
  if (bcfg) {
    const stacks = Math.min(bcfg.max, Math.max(0, run.maxLives - run.lives));
    st.player.berserkerFire = Math.pow(bcfg.fire, stacks);
    st.player.berserkerSpeed = Math.pow(bcfg.speed, stacks);
  }
  stepState(st, cmd, dt);
  run.playTime += dt;
  // Notschild-Ladungen aus dem Raumzustand zuruecksynchronisieren, damit
  // verbrauchte Ladungen in den naechsten Raum uebernommen werden.
  run.shieldCharges = st.shieldCharges;

  // Combo: schnell aufeinanderfolgende Kills. Faellt nach COMBO_WINDOW.
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;
  }

  // Kumulative Raumzaehler abgleichen (robust, egal wo Kills passieren).
  if (st.enemyKills > run.seenRoomKills) {
    run.kills += st.enemyKills - run.seenRoomKills;
    run.seenRoomKills = st.enemyKills;
  }
  while (run.seenKillLog < st.killLog.length) {
    const ty = st.killLog[run.seenKillLog++];
    run.killsByType[ty] = (run.killsByType[ty] || 0) + 1;
    run.combo++;
    run.comboTimer = COMBO_WINDOW;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    if (run.combo >= 3) {
      st.texts.push({
        x: st.player.x,
        y: st.player.y - 26,
        text: `COMBO ×${run.combo}`,
        age: 0,
        life: 1,
        color: '#ffd23c',
      });
      st.sounds.push('combo');
    }
  }
  if (st.playerShots > run.seenRoomShots) {
    run.shotsFired += st.playerShots - run.seenRoomShots;
    run.seenRoomShots = st.playerShots;
  }

  // Spielertod: Leben abziehen; bei 0 ist der Run vorbei (der Raum-
  // Neustart passiert sonst automatisch ueber state.respawnTimer).
  if (st.playerDeaths > run.seenRoomDeaths) {
    const d = st.playerDeaths - run.seenRoomDeaths;
    run.seenRoomDeaths = st.playerDeaths;
    run.deaths += d;
    run.lives -= d;
    run.combo = 0; // Tod bricht die Combo
    run.comboTimer = 0;
    run.lastDeathCause = st.lastDeathCause;
    if (run.lives <= 0) {
      finishRun(run, false);
      return;
    }
  }

  // Raum geschafft: alle Gegner tot, Spieler lebt.
  const enemiesLeft = st.tanks.filter((t) => t !== st.player && t.alive).length;
  if (enemiesLeft === 0 && st.player.alive) {
    run.roomsCleared++;
    st.sounds.push('clear');
    // Schrott fuer den geraeumten Raum (deterministisch ueber genRng).
    const sc = run.data.balance.scrap;
    const earned = sc.perRoom[0] + Math.floor(run.genRng() * (sc.perRoom[1] - sc.perRoom[0] + 1));
    run.scrap += earned;
    run.scrapThisRoom += earned;
    st.texts.push({
      x: st.player.x,
      y: st.player.y - 30,
      text: `+${earned} Schrott`,
      age: 0,
      life: 1.2,
      color: '#e0c860',
    });
    // Extraleben alle 5 geschaffte Raeume.
    if (run.roomsCleared % run.difficulty.extraLifeEveryClearedRooms === 0) {
      run.lives++;
    }
    if (!run.endless && run.roomIndex >= totalRooms(run.difficulty)) {
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

// Gemeinsame Pool-Parameter aus dem Run.
function poolOpts(run) {
  return {
    chosen: run.upgrades,
    roomIndex: run.roomIndex,
    rng: run.genRng,
    balance: run.data.balance,
    count: run.upgradesData.offersPerScreen,
    banned: run.bannedUpgrades,
  };
}

// 3 Angebote aus dem neuen Auswahlpool (Seed-RNG -> deterministisch).
// Tag-Eindeutigkeit, Rarity-Gewichte, maxStacks/requires/minRoom siehe
// upgradepool.js. Fehlende Slots fuellt der Pool mit "+1 Leben" auf.
function rollOffers(run) {
  return rollFromPool(run.upgradesData, poolOpts(run));
}

// --- Phase-3-Schrott-Aktionen im Upgrade-Screen ---
// Alle geben true zurueck, wenn tatsaechlich (genug Schrott) ausgefuehrt.

// Neu wuerfeln: frische 3 Karten (Tag-Regel + Verbannungen gelten weiter).
export function rerollOffers(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const cost = run.data.balance.scrap.cost.reroll;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.pendingOffers = rollOffers(run);
  return true;
}

// Verbannen: Karte fuer den Rest des Runs aus dem Pool nehmen und durch
// eine neue ersetzen (deren Tag sich von den anderen Karten unterscheidet).
export function banOffer(run, index) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const offer = run.pendingOffers[index];
  if (!offer || offer.fallback) return false; // Fallback ist nicht verbannbar
  const cost = run.data.balance.scrap.cost.ban;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.bannedUpgrades.add(offer.id);
  const kept = run.pendingOffers.filter((_, i) => i !== index);
  const avoidTags = new Set(kept.filter((o) => !o.fallback).map((o) => o.tag));
  const avoidIds = new Set(kept.filter((o) => !o.fallback).map((o) => o.id));
  run.pendingOffers[index] = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  return true;
}

// Vierte Karte: eine zusaetzliche Karte aufdecken (Tag-Regel gilt weiter).
// Nur von 3 auf 4 -- nicht beliebig stapelbar.
export function buyFourthCard(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  if (run.pendingOffers.length >= 4) return false;
  const cost = run.data.balance.scrap.cost.fourthCard;
  if (run.scrap < cost) return false;
  const avoidTags = new Set(run.pendingOffers.filter((o) => !o.fallback).map((o) => o.tag));
  const avoidIds = new Set(run.pendingOffers.filter((o) => !o.fallback).map((o) => o.id));
  const extra = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  if (extra.fallback) return false; // nichts Sinnvolles mehr -> kein Kauf
  run.scrap -= cost;
  run.pendingOffers.push(extra);
  return true;
}

// Schildladung kaufen: +1 Notschild-Ladung, auch ohne das Schild-Upgrade.
export function buyShieldCharge(run) {
  const cost = run.data.balance.scrap.cost.shieldCharge;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.shieldCharges = (run.shieldCharges || 0) + 1;
  return true;
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
    // Glaskanone: reduziert die Leben dauerhaft auf 1 (starker Trade-off).
    if (offer.id === 'glaskanone') run.lives = 1;
    // Notschild: jede Stufe gibt chargesPerStack Ladungen (raumuebergreifend).
    if (offer.id === 'emergency_shield') {
      const cps = run.upgradesData.upgrades.emergency_shield.chargesPerStack || 3;
      run.shieldCharges = (run.shieldCharges || 0) + cps;
    }
  }
  run.upgradeChoices++;
  run.pendingOffers = null;
  run.roomIndex++;
  startRoom(run);
}

// Nach dem Sieg weiterspielen (Endlos-Modus): Raeume laufen mit weiter
// wachsendem Budget durch, bis der Spieler stirbt. Der Sieg bleibt in
// der Statistik gezaehlt.
export function continueEndless(run) {
  if (run.phase !== 'victory') return;
  run.endless = true;
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
