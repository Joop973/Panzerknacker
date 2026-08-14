// Gegner-KI, Dispatcher + gemeinsame Helfer (Spec Abschnitt 5).
//
// Phase 8: Gegner-Rollen statt Gegner-Typen. Eine ROLLE (guardian/sapper/
// hunter/sieger, siehe ai_drives.js) bestimmt das Fahrverhalten,
// ai_turrets.js liefert dazu eine einzige, accuracy-parametrisierte
// Turmfunktion -- beides datengetrieben ueber tank.cfg (aus
// data/tanks.json), keine eigene Funktion mehr pro Gegnertyp. Panzerung
// (armor.js) und Minenlegen (miner-Eintrag) bleiben orthogonal dazu.
//
// Aller Zufall laeuft ueber den Seed-RNG (state.rng).

import { range } from '../core/rng.js';
import { roleTurret } from './ai_turrets.js';
import { DRIVES, coverDrive } from './ai_drives.js';

export function angleDiff(a, b) {
  // Kleinste Differenz b - a, gewrappt auf [-PI, PI].
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

// Ray-March: ist die Strecke (x0,y0)->(x1,y1) frei von Waenden?
export function clearLine(state, x0, y0, x1, y1) {
  const step = state.data.ai.raycastStepPx;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 1) return true;
  const dx = ((x1 - x0) / dist) * step;
  const dy = ((y1 - y0) / dist) * step;
  let x = x0;
  let y = y0;
  for (let d = 0; d < dist; d += step) {
    if (state.blocksSight(x, y)) return false;
    x += dx;
    y += dy;
  }
  return true;
}

// Ray-March vom Rohrende entlang der Turmrichtung: trifft der Strahl
// das Ziel, bevor er in einer Wand endet? Upgradepool-v2 Phase 5: nicht
// mehr fest auf state.player -- der Aufrufer uebergibt das aufgeloeste
// Ziel (resolveTarget), damit ein zufaellig schwenkender Turm (accuracy 0)
// auch einen Geist "zufaellig" erwischen kann.
export function targetInSight(tank, state, target) {
  if (!target || !target.alive) return false;
  const { raycastStepPx, raycastMaxPx } = state.data.ai;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  const hitR = target.cfg.radius + tank.cfg.bulletRadius;
  let x = tank.x + cos * (tank.cfg.radius + 8);
  let y = tank.y + sin * (tank.cfg.radius + 8);
  for (let d = 0; d < raycastMaxPx; d += raycastStepPx) {
    if (state.blocksSight(x, y)) return false;
    const dx = x - target.x;
    const dy = y - target.y;
    if (dx * dx + dy * dy < hitR * hitR) return true;
    x += cos * raycastStepPx;
    y += sin * raycastStepPx;
  }
  return false;
}

// Upgradepool-v2 Phase 5: Zielauflösung der Gegner-KI. resolveTarget() ist
// die zentrale, billige Lese-Funktion, die ai_drives.js/ai_turrets.js statt
// eines hart verdrahteten state.player benutzen -- sie liest nur das Feld,
// das updateTargeting() periodisch pflegt (Muster wie tank.ai.threatened aus
// der Deckungswahrnehmung, Phase 16). Faellt auf den Spieler zurueck, wenn
// noch keine Bewertung stattgefunden hat (z. B. direkt nach dem Spawn) oder
// das gewaehlte Ziel inzwischen tot ist.
export function resolveTarget(tank, state) {
  const target = tank.ai?.target;
  return target && target.alive ? target : state.player;
}

// Von der Treffer-Schleife (state.js) aufgerufen, wenn ein GEGNER (nicht der
// Spieler) Schaden nimmt: merkt sich den Verursacher kurzzeitig als
// zusaetzlichen Attraktivitaets-Bonus (s. candidateScore) -- "zugefuegter
// Schaden zieht zusaetzlich an". Bewusst nur der JEWEILS LETZTE Verursacher
// (keine echte Tabelle, klingt einfach wieder ab), s. Kopfkommentar Datei.
export function registerThreat(tank, source, state) {
  if (!tank.ai || tank === state.player || !source) return;
  tank.ai.threatSource = source;
  tank.ai.threatTimer = state.data.balance.aggro?.damageThreatDecayS ?? 0;
}

// Effektive Distanz zu einem Kandidaten -- KLEINER = attraktiver. Geister
// werden ueber ghostThreatMult (<1) kuenstlich "weiter weg" gerechnet, ein
// zuletzt zugefuegter Schaden zieht das Ziel (mit linearem Abklingen)
// naeher heran.
function candidateScore(tank, candidate, cfg) {
  const dx = candidate.x - tank.x;
  const dy = candidate.y - tank.y;
  let dist = Math.hypot(dx, dy);
  if (candidate.isGhost) dist /= cfg.ghostThreatMult ?? 1;


  const ai = tank.ai;
  if (ai.threatSource === candidate && ai.threatTimer > 0) {
    const decayS = cfg.damageThreatDecayS || 1;
    dist -= (cfg.damageThreatPx ?? 0) * Math.min(1, ai.threatTimer / decayS);
  }

  return Math.max(0, dist);
}

// Neu bewertet EIN Ziel fuer EINEN Panzer (aufgerufen aus updateTargeting()
// im Reevaluate-Takt, s. u.). Hysterese: ein neues Ziel muss um
// switchHysteresisPct GUENSTIGER sein als das alte, sonst bleibt der Panzer
// beim bisherigen Ziel -- verhindert Zappeln zwischen zwei etwa gleich weit
// entfernten Kandidaten. Sichtlinien-Fallback: findet der Panzer sein
// gewaehltes Ziel laenger als noTargetFallbackS nicht (Wand im Weg), faellt
// er auf den Spieler zurueck, statt einen unerreichbaren Geist zu verfolgen.
// Exportiert (nicht nur intern von updateTargeting() genutzt): bossai.js
// ruft sie in der freien Phase direkt auf, s. dortiger Kommentar.
export function pickTarget(tank, state) {
  const cfg = state.data.balance.aggro || {};
  const ai = tank.ai;
  // Ein Kandidat, den der Panzer gerade erst wegen anhaltend fehlender
  // Sichtlinie aufgegeben hat (s. Fallback unten), bleibt ausgeschlossen,
  // bis er wieder SICHTBAR ist -- die Rohdistanz allein wuerde ihn sonst bei
  // der naechsten Neubewertung sofort erneut als "best" waehlen (er ist ja
  // weiterhin naeher, nur eben unerreichbar) und der Panzer zappelt jeden
  // Takt zwischen Fallback und Wiederaufnahme, statt wirklich aufzugeben
  // (gemessen: genau dieses Muster, kein hypothetischer Grenzfall).
  const candidates = [state.player, ...state.ghosts].filter((c) => {
    if (!c || !c.alive) return false;
    if (c === ai.avoidTarget && !clearLine(state, tank.x, tank.y, c.x, c.y)) return false;
    return true;
  });
  if (!candidates.length) {
    ai.target = null;
    return;
  }
  let best = candidates[0];
  let bestScore = candidateScore(tank, best, cfg);
  for (let i = 1; i < candidates.length; i++) {
    const score = candidateScore(tank, candidates[i], cfg);
    if (score < bestScore) {
      bestScore = score;
      best = candidates[i];
    }
  }
  let chosen = best;
  const current = ai.target;
  if (current && current.alive && current !== best) {
    const currentScore = candidateScore(tank, current, cfg);
    if (bestScore >= currentScore * (1 - (cfg.switchHysteresisPct ?? 0))) {
      chosen = current; // neues Ziel nicht deutlich genug besser -> bleiben
    }
  }

  // Allgemeine Sichtlinie zur ZIEL-POSITION (nicht der enge Turmkegel von
  // targetInSight() -- hier geht es nur um "steht eine Wand dazwischen").
  const reevalS = 1 / (cfg.reevaluateHz ?? 4);
  if (clearLine(state, tank.x, tank.y, chosen.x, chosen.y)) {
    ai.noSightTimer = 0;
  } else {
    ai.noSightTimer = (ai.noSightTimer || 0) + reevalS;
    if (ai.noSightTimer >= (cfg.noTargetFallbackS ?? 3) && chosen !== state.player) {
      ai.avoidTarget = chosen; // bis auf Weiteres ausgeschlossen (s. oben)
      chosen = state.player;
      ai.noSightTimer = 0;
    }
  }
  ai.target = chosen;
}

// Treiber (einmal pro Frame aus state.js, wie updateCoverPerception): jeder
// Gegner bewertet sein Ziel hoechstens reevaluateHz-mal pro Sekunde neu
// (eigener Timer je Panzer, nicht synchron) -- billig genug, um ALLE Gegner
// jeden Reevaluate-Takt zu pruefen (kein Reihum-Verfahren noetig, anders als
// der teure Abpraller-Solver). Boss-Sonderbewegungen (mirrorBoss/phalanx)
// ueberschreiben tank.ai.target danach selbst (bossai.js: Fixierung) --
// werden hier deshalb bewusst ausgelassen, sonst wuerde die generische
// Hysterese/Sichtlinien-Buchhaltung mit der Fixierung kollidieren.
export function updateTargeting(state, dt) {
  for (const t of state.tanks) {
    if (t === state.player || !t.alive || t.cfg.mirrorBoss || t.cfg.phalanx) continue;
    const ai = t.ai;
    if (ai.threatTimer > 0) ai.threatTimer -= dt;
    if (ai.targetTimer === undefined) ai.targetTimer = 0;
    ai.targetTimer -= dt;
    if (ai.targetTimer > 0) continue;
    ai.targetTimer = 1 / (state.data.balance.aggro?.reevaluateHz ?? 4);
    pickTarget(t, state);
  }
}

// Liegt innerhalb von clearPx vor der Muendung eine Wand? (Verhindert
// staendige Punktblank-Selbsttreffer beim Schiessen direkt an der Wand.)
export function muzzleBlocked(tank, state, clearPx) {
  const step = state.data.ai.raycastStepPx;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  let x = tank.x + cos * (tank.cfg.radius + 8);
  let y = tank.y + sin * (tank.cfg.radius + 8);
  for (let d = 0; d < clearPx; d += step) {
    if (state.isSolid(x, y)) return true;
    x += cos * step;
    y += sin * step;
  }
  return false;
}

// Abstossung von liegenden Minen (t_yellow laut Spec; alle Minenleger
// zusaetzlich, damit sie nicht regelmaessig in die eigenen Minen fahren).
function mineRepulsion(tank, state) {
  const R = state.data.ai.mineAvoidRadiusPx;
  let rx = 0;
  let ry = 0;
  let any = false;
  for (const m of state.mines) {
    if (m.dead) continue;
    // Gegner meiden nur ihre EIGENEN Minen (t_yellow-Selbstsperre bleibt).
    // Spieler-Minen werden NICHT gemieden -> sie treffen zuverlaessig.
    if (m.owner !== tank) continue;
    const dx = tank.x - m.x;
    const dy = tank.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d >= R || d < 0.001) continue;
    const w = 1 - d / R;
    rx += (dx / d) * w;
    ry += (dy / d) * w;
    any = true;
  }
  return any ? { x: rx, y: ry } : null;
}

// Gemeinsame Fahr-Basis: weich auf targetAngle zulenken; bei Blockade
// (kaum Fortschritt trotz Fahrbefehl) fuer escapeHoldS von der Wand
// wegpivotieren. Fahrende Panzer bleiben dadurch NIE stehen.
export function steer(tank, state, dt, targetAngle, cfg) {
  const ai = tank.ai;

  // Minen-Ausweichen ueberlagert das Wunschziel aller Fahrverhalten.
  // Stark gewichtet: nahe einer Mine dominiert die Flucht das Ziel.
  if (tank.cfg.avoidMines) {
    const rep = mineRepulsion(tank, state);
    if (rep) {
      targetAngle = Math.atan2(
        Math.sin(targetAngle) + rep.y * 2.5,
        Math.cos(targetAngle) + rep.x * 2.5,
      );
    }
  }
  if (ai.driveAngle === undefined) {
    ai.driveAngle = targetAngle;
    ai.blockedTime = 0;
    ai.overrideTimer = 0;
    ai.overrideAngle = 0;
  }
  const moved = Math.hypot(tank.x - tank.prevX, tank.y - tank.prevY);
  const expected = tank.cfg.speed * dt;
  if (expected > 0 && moved < expected * 0.3) {
    ai.blockedTime += dt;
  } else {
    ai.blockedTime = 0;
  }
  if (ai.blockedTime >= cfg.blockedRetargetS) {
    ai.overrideAngle =
      ai.driveAngle + Math.PI + range(state.rng, -cfg.escapeSpreadRad, cfg.escapeSpreadRad);
    ai.overrideTimer = cfg.escapeHoldS;
    ai.driveAngle = ai.overrideAngle; // Pivot auf der Stelle
    ai.blockedTime = 0;
  }
  if (ai.overrideTimer > 0) {
    ai.overrideTimer -= dt;
    targetAngle = ai.overrideAngle;
  }
  ai.driveAngle = turnToward(ai.driveAngle, targetAngle, cfg.turnSpeed * dt);
  return { x: Math.cos(ai.driveAngle), y: Math.sin(ai.driveAngle) };
}

// Phasenwechsel (t_white): alterniert periodisch zwischen zwei Rollen
// (Muster wie das fruehere white_phase-Fahrverhalten, inkl. Ton-Signal
// beim Wechsel). Gibt die gerade aktive Rolle zurueck.
function activeRole(tank, state, dt) {
  const pt = tank.cfg.phaseToggle;
  if (!pt) return tank.cfg.role;
  const ai = tank.ai;
  if (ai.phaseIdx === undefined) {
    ai.phaseIdx = 0;
    ai.phaseTimer = range(state.rng, pt.switchMinS, pt.switchMaxS);
  }
  ai.phaseTimer -= dt;
  if (ai.phaseTimer <= 0) {
    ai.phaseIdx = 1 - ai.phaseIdx;
    ai.phaseTimer = range(state.rng, pt.switchMinS, pt.switchMaxS);
    state.sounds.push(ai.phaseIdx === 1 ? 'tone_high' : 'tone_low');
  }
  return pt.roles[ai.phaseIdx];
}

// Deckungs-KI (Phase 16): zielt der Spieler gerade auf diesen Panzer?
// Enger Kegel um p.turret + Reichweite + freie Sichtlinie -- absichtlich
// grob (kein exaktes Trefferbild), das reicht als Ausloeser zum Ducken.
function isPlayerAiming(tank, state, cfg) {
  const p = state.player;
  if (!p.alive) return false;
  const dx = tank.x - p.x;
  const dy = tank.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > (cfg.aimRangePx ?? 400)) return false;
  const toTank = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(p.turret, toTank)) > (cfg.aimConeRad ?? 0.25)) return false;
  return clearLine(state, p.x, p.y, tank.x, tank.y);
}

// Deckungswahrnehmung (Phase 16): "zielt der Spieler auf mich?" ist reine
// Optik -- ein Aufblitzen von 1-2 Frames faellt nicht auf. Deshalb bewusst
// mit 15 Hz UND einem Reihum-Verfahren (hoechstens `checksPerTick` Gegner
// pro Aufruf) statt einer vollen Pruefung aller Gegner in jedem Frame.
// Aktualisiert tank.ai.threatened; updateEnemy() liest es nur.
export function updateCoverPerception(state, dt) {
  const cfg = state.data.ai.cover;
  if (!cfg) return;
  state.coverTimer -= dt;
  if (state.coverTimer > 0) return;
  state.coverTimer = 1 / (cfg.checkHz ?? 15);
  const enemies = state.tanks.filter((t) => t !== state.player && t.alive);
  if (!enemies.length) return;
  const n = Math.min(cfg.checksPerTick ?? 4, enemies.length);
  for (let i = 0; i < n; i++) {
    const t = enemies[(state.coverCursor + i) % enemies.length];
    t.ai.threatened = t.cfg.aggression < cfg.aggressionThreshold && isPlayerAiming(t, state, cfg);
  }
  state.coverCursor = (state.coverCursor + n) % enemies.length;
}

// Ein KI-Schritt fuer einen Gegner. Gibt { move, fire, mine } zurueck;
// die Anwendung (Bewegung, Schuss, Minenlegen) macht state.js.
export function updateEnemy(tank, state, dt) {
  const role = activeRole(tank, state, dt);
  const coverCfg = state.data.ai.cover;
  // Deckungssuche (Phase 16): ersetzt fuer diesen Tick die normale
  // Rollen-Fahrfunktion, wenn der Panzer als "im Ziel" erkannt wurde --
  // guardian bleibt aussen vor (verlaesst seine Zone laut Spec nie).
  // findet coverDrive() keinen Punkt, faellt es auf DRIVES[role] zurueck,
  // damit der Panzer nie einfach stehen bleibt.
  const seekCover =
    coverCfg && role !== 'guardian' && tank.cfg.aggression < coverCfg.aggressionThreshold && tank.ai.threatened;
  const move = (seekCover && coverDrive(tank, state, dt)) || DRIVES[role](tank, state, dt);
  // EMP-Mine (Phase 6): betaeubte Gegner drehen den Turm nicht und feuern
  // nicht -- eigenes Feld turretStunTimer, damit die bestehende Krallenfalle
  // (stunTimer allein) den Turm weiter benutzbar laesst (siehe PLAN.md).
  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);

  // Dritte Achse: Minenleger (t_yellow "ohne taktischen Grund" per
  // Zufallstimer -- das beabsichtigte Sich-selbst-Einsperren entsteht
  // von allein; t_purple/t_white/t_black seltener).
  let mine = false;
  if (tank.cfg.miner) {
    const ai = tank.ai;
    if (ai.mineTimer === undefined) {
      ai.mineTimer = range(state.rng, tank.cfg.miner.intervalMinS, tank.cfg.miner.intervalMaxS);
    }
    ai.mineTimer -= dt;
    if (ai.mineTimer <= 0) {
      // Nur bei freier Fahrt legen: ein blockierter Panzer wuerde die
      // Mine unter sich scharf werden lassen und sich selbst sprengen.
      const actualSpeed = Math.hypot(tank.vx, tank.vy);
      if (actualSpeed >= tank.cfg.speed * 0.5) {
        mine = true;
        ai.mineTimer = range(state.rng, tank.cfg.miner.intervalMinS, tank.cfg.miner.intervalMaxS);
      }
      // sonst: Timer bleibt abgelaufen, naechste freie Fahrt legt sofort
    }
  }
  return { move, fire, mine };
}
