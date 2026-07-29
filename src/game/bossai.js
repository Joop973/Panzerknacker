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
// Unverwundbarkeit ist Boss-Logik (siehe state.js: killTank()).

import { WIDTH, HEIGHT } from '../config.js';
import { fireBullet } from './tank.js';
import { roleTurret } from './ai_turrets.js';

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

  // Turm/Feuerentscheidung bleibt die normale, accuracy-gesteuerte Logik
  // (data/tanks.json: t_mirror.accuracy) -- nur die Fahrfunktion ist ersetzt.
  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);
  tank.aimingAtPlayer = fire; // Gefahrensinn-Anzeige (Phase 18), wie in state.js
  if (fire) fireBullet(tank, state);
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

  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);
  tank.aimingAtPlayer = fire; // Gefahrensinn-Anzeige (Phase 18), wie in state.js
  if (fire) fireBullet(tank, state);
}
