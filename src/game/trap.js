// Krallenfallen (Upgrade-Erweiterung, Nutzer-Entscheidung).
//
// Mit dem Krallenfalle-Upgrade hinterlaesst der Spieler alle X gefahrene
// Pixel eine Falle. Wer nach der Scharfschaltung hineinfaehrt -- auch
// der Spieler selbst --, steht stunS Sekunden still (Turm bleibt
// nutzbar). Eine Falle wird beim Ausloesen verbraucht.
// Stellwerte: data/upgrades.json -> krallenfalle.

import { circlesOverlap } from './collision.js';

let nextTrapId = 1;

export function updateTraps(state, dt) {
  const p = state.player;
  const cfg = p.cfg;

  // Ablegen nach gefahrener Strecke (nur Spieler, nur mit Upgrade).
  if (p.alive && cfg.trapEveryPx) {
    p.trapDist = (p.trapDist || 0) + Math.hypot(p.x - p.prevX, p.y - p.prevY);
    if (p.trapDist >= cfg.trapEveryPx) {
      p.trapDist = 0;
      state.traps.push({
        id: nextTrapId++,
        x: p.x,
        y: p.y,
        radius: cfg.trapRadius,
        stunS: cfg.trapStunS,
        armS: cfg.trapArmS,
        age: 0,
        dead: false,
      });
      state.sounds.push('mine');
      // Obergrenze: aelteste Falle verfaellt (kein Fallen-Teppich).
      const live = state.traps.filter((t) => !t.dead);
      if (live.length > (cfg.trapMaxActive || 3)) live[0].dead = true;
    }
  }

  for (const tr of state.traps) {
    if (tr.dead) continue;
    tr.age += dt;
    if (tr.age < tr.armS) continue; // kurzes Fluchtfenster fuer den Leger
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (circlesOverlap(tr.x, tr.y, tr.radius, t.x, t.y, t.cfg.radius)) {
        t.stunTimer = tr.stunS;
        tr.dead = true;
        state.sounds.push('trap');
        state.spawnParticles?.(tr.x, tr.y, '#c25a4a', 6, 70);
        break;
      }
    }
  }
  state.traps = state.traps.filter((t) => !t.dead);
}
