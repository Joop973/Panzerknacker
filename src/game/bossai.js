// Boss-KI (PLAN.md v2, Phase 14) -- zwei Sonderbewegungen, die sich nicht in
// das normale Rollen-Schema (ai.js/ai_drives.js: guardian/sapper/hunter/
// sieger) pressen lassen, weil ihre Position keine Physik ist, sondern eine
// reine Funktion von Zeit bzw. Spielerposition. state.js ruft hier direkt
// hinein statt ueber updateEnemy()/DRIVES -- Turmzielen/Feuern bleibt aber
// die normale, wiederverwendete roleTurret()-Logik (Muster: nur die
// Fahrfunktion wird ersetzt, alles andere bleibt Standard).
//
// Der Reaktorkern (t_reactor) braucht KEINEN Sondercode: er nutzt die
// bestehende Rolle "guardian" (steht fest) unveraendert -- nur seine
// Unverwundbarkeit ist Boss-Logik (siehe state.js: killTank()). Auch KEINE
// Fixierungs-Sonderregel (Upgradepool-v2 Phase 5) -- laeuft normal ueber
// ai.js: updateTargeting. Aktuell ohnehin ein Platzhalter (t_black statt
// t_reactor, s. CLAUDE.md "Bosse (Platzhalter, Nutzerentscheidung)"); das
// Generator-Raetsel selbst haengt mit dem Bandenschuss (Grundsteinumbau
// Phase 1) und wartet auf einen Bossneubau.

import { WIDTH, HEIGHT } from '../config.js';
import { fireBullet } from './tank.js';
import { roleTurret } from './ai_turrets.js';
import { resolveTarget, pickTarget } from './ai.js';
// Amboss (Akt 2): eigenstaendiger Zustandsautomat, ausgelagert nach
// anvil.js (Dateigroessen-Konvention aus CLAUDE.md, Muster spider.js).
// Reiner Re-Export -- state.js importiert stepAnvilBoss weiterhin von HIER
// (wie den Auftrag es verlangt: "Implementiere stepAnvilBoss() in
// src/game/bossai.js"), die eigentliche Logik lebt aber in anvil.js.
export { stepAnvilBoss, showAnvilHint } from './anvil.js';

// Upgradepool-v2 Phase 5: Bosse wechseln zeitgesteuert (kein RNG) zwischen
// Fixierung auf den Spieler (ignoriert Geister komplett) und freier
// Zielwahl ueber resolveTarget(). state.time laeuft seit Raumstart, der
// Zyklus ist also deterministisch UND lernbar (immer derselbe Rhythmus).
// Gibt { target, fixated } zurueck -- `fixated` ist die reine Zeitfensterlage
// (unabhaengig davon, ob resolveTarget() in der freien Phase zufaellig
// ebenfalls den Spieler waehlt), damit das sichtbare Signal (renderer.js:
// tank.fixatedOnPlayer) wirklich den Rhythmus zeigt statt nur "Ziel=Spieler".
function resolveBossTarget(tank, state) {
  const cfg = state.data.balance.boss?.fixate;
  if (!cfg) return { target: resolveTarget(tank, state), fixated: false };
  const cycle = (cfg.onPlayerS ?? 0) + (cfg.onGhostsS ?? 0);
  const phase = cycle > 0 ? state.time % cycle : 0;
  if (phase < (cfg.onPlayerS ?? 0)) return { target: state.player, fixated: true };
  // Freie Phase: wie ein normaler Gegner ueber die effektive Distanz neu
  // bewerten (ai.js: pickTarget). resolveTarget() allein wuerde hier nur
  // den zuletzt gesetzten Wert zurueckgeben -- da Bosse bewusst von der
  // generischen updateTargeting()-Schleife ausgenommen sind (s. dortiger
  // Kommentar), haette "freie Zielwahl" ohne diesen Aufruf NIE einen Geist
  // entdeckt und waere fuer immer beim Spieler-Fallback haengengeblieben.
  pickTarget(tank, state);
  return { target: resolveTarget(tank, state), fixated: false };
}

// Phalanx-Variante: zusaetzlich zur zeitgesteuerten Fixierung zwingt eine
// RAEUMLICHE Regel mindestens minPlayerShare der fuenf Panzer IMMER auf den
// Spieler (bei 0.4 also zwei von fuenf) -- welche das sind, wandert
// deterministisch ueber phalanxIndex, damit es nicht immer dieselben zwei
// sind. Dieselbe Zeitleiste wie resolveBossTarget treibt auch den
// Rotations-Takt (ein Schritt pro vollem Fixierungs-/Freizyklus).
function resolvePhalanxTarget(tank, state) {
  const cfg = state.data.balance.boss?.fixate;
  if (!cfg) return { target: resolveTarget(tank, state), fixated: false };
  const cycle = (cfg.onPlayerS ?? 0) + (cfg.onGhostsS ?? 0);
  const phase = cycle > 0 ? state.time % cycle : 0;
  if (phase < (cfg.onPlayerS ?? 0)) return { target: state.player, fixated: true }; // globale Fixierung
  const forcedCount = Math.ceil(5 * (cfg.minPlayerShare ?? 0));
  const rotationOffset = cycle > 0 ? Math.floor(state.time / cycle) % 5 : 0;
  const slot = tank.phalanxIndex || 0;
  const forced = (slot - rotationOffset + 5) % 5 < forcedCount;
  if (forced) return { target: state.player, fixated: true };
  // Freie Phase (Rest der Formation): dieselbe frische Neubewertung wie
  // beim Spiegel, s. resolveBossTarget().
  pickTarget(tank, state);
  return { target: resolveTarget(tank, state), fixated: false };
}

// Der Spiegel: Position + Fahrtrichtung sind die Punktspiegelung der
// Spielerposition durch die Raummitte -- "kopiert deine Bewegungen
// gespiegelt". Keine Kollisionsaufloesung noetig: die Arena (boss_mirror)
// ist bewusst punktsymmetrisch gebaut (siehe data/arenas.json), jede
// erreichbare Spielerposition spiegelt daher auf eine ebenso begehbare
// Bodenzelle.
export function stepMirrorBoss(tank, state, dt) {
  const p = state.player;
  tank.prevX = tank.x;
  tank.prevY = tank.y;
  if (p.alive) {
    tank.x = WIDTH - p.x;
    tank.y = HEIGHT - p.y;
    tank.heading = p.heading + Math.PI;
  }
  tank.vx = dt > 0 ? (tank.x - tank.prevX) / dt : 0;
  tank.vy = dt > 0 ? (tank.y - tank.prevY) / dt : 0;

  // Fixierung ueberschreibt die generische Zielwahl (ai.js: updateTargeting
  // laesst mirrorBoss/phalanx bewusst aus, s. dort) -- roleTurret() liest
  // ueber resolveTarget() genau dieses Feld.
  const { target, fixated } = resolveBossTarget(tank, state);
  tank.ai.target = target;
  tank.fixatedOnPlayer = fixated; // sichtbares Signal (renderer.js: Turmgluehen)
  // Turm/Feuerentscheidung bleibt die normale, accuracy-gesteuerte Logik
  // (data/tanks.json: t_mirror.accuracy) -- nur die Fahrfunktion ist ersetzt.
  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);
  // Upgradepool-v2 Phase 5: nur noch true, wenn das Ziel wirklich der
  // Spieler ist -- sonst warnt der Gefahrensinn vor Schuessen auf einen Geist.
  tank.aimingAtPlayer = fire && target === state.player;
  if (fire) {
    // Nekromant-V2 Phase 10 (Telemetrie): "Anteil der Bossschuesse auf
    // Spieler gegen Untertanen" -- Rohzaehler, main.js liest sie unveraendert.
    // ECHTER Testfund: roleTurret()==true ist nur die ABSICHT zu feuern
    // (Zielkegel/Sichtlinie erfuellt) -- fireBullet() selbst gated NOCHMAL
    // auf tank.cooldown/Magazin und kann trotzdem `false` liefern (mehrere
    // Ticks in Folge, solange der Cooldown noch laeuft). Der Zaehler muss
    // deshalb den RUECKGABEWERT von fireBullet() lesen, nicht das fire-Flag
    // -- sonst zaehlt er ein Vielfaches der echten Schuesse (Gegenprobe:
    // mit `if (fire) counter++` statt `if (fireBullet(...))` maß der eigene
    // Test 678 statt 46 echte Schuesse in 20 simulierten Sekunden).
    // (Aktuell nur ueber isolierte Tests erreichbar: Bossraeume spawnen laut
    // "Bosse (Platzhalter)"-Entscheidung t_black statt t_mirror/t_phalanx,
    // dieser Codepfad laeuft im echten Spiel derzeit nie -- s. CLAUDE.md.)
    if (fireBullet(tank, state)) {
      if (target === state.player) state.bossShotsAtPlayer++;
      else state.bossShotsAtGhost++;
    }
  }
}

// Die Phalanx: fuenf Panzer rotieren als starre Formation um die Raummitte
// (data/balance.json: boss.phalanx.radiusPx/rotationSpeedRad). tank
// .phalanxIndex (0..4, in state.js beim Erzeugen vergeben) bestimmt den
// Formationsplatz; die Panzerung (data/tanks.json: t_phalanx.armor.arc)
// deckt dabei absichtlich WENIGER als die 72 Grad Abstand zum Nachbarn ab
// -- die Luecke zwischen zwei Panzern wandert dadurch kontinuierlich um
// die Formation und trifft jede Blickrichtung nur fuer Sekundenbruchteile.
export function stepPhalanxBoss(tank, state, dt) {
  const cfg = state.data.balance.boss?.phalanx || { radiusPx: 150, rotationSpeedRad: 1.0 };
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const slot = tank.phalanxIndex || 0;
  const angle = state.time * cfg.rotationSpeedRad + slot * ((Math.PI * 2) / 5);

  tank.prevX = tank.x;
  tank.prevY = tank.y;
  tank.x = cx + Math.cos(angle) * cfg.radiusPx;
  tank.y = cy + Math.sin(angle) * cfg.radiusPx;
  // Panzerung liegt an der Ausrichtung der Wanne (armor.js: heading) --
  // nach aussen zeigend, wie es die Spec fuer den Frontsektor vorsieht.
  tank.heading = angle;
  tank.vx = dt > 0 ? (tank.x - tank.prevX) / dt : 0;
  tank.vy = dt > 0 ? (tank.y - tank.prevY) / dt : 0;

  const { target, fixated } = resolvePhalanxTarget(tank, state);
  tank.ai.target = target;
  tank.fixatedOnPlayer = fixated; // sichtbares Signal (renderer.js: Turmgluehen)
  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);
  tank.aimingAtPlayer = fire && target === state.player;
  if (fire) {
    // Nekromant-V2 Phase 10 (Telemetrie): Zaehler haengt am Rueckgabewert
    // von fireBullet(), nicht am fire-Flag -- s. stepMirrorBoss() oben.
    if (fireBullet(tank, state)) {
      if (target === state.player) state.bossShotsAtPlayer++;
      else state.bossShotsAtGhost++;
    }
  }
}
