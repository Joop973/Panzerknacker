// Mörser-Waffe (Grundsteinumbau Phase 3): Ersatz für den früheren
// Bandenschuss-Grünen ("Der Grüne wird Mörserschütze"). Keine physische
// Kugel -- eine Granate mit fester Flugzeit, die über alle Wände fliegt,
// mit einer von Abschuss an sichtbaren, wachsenden Einschlagmarkierung
// (Fairness: der Spieler sieht immer, wohin es fällt, und kann
// herauslaufen). Nicht reflektierbar: da keine Kugel in state.bullets
// entsteht, greifen Deflektor/Frontpanzerung (die nur gerade Geschosse
// abfangen) automatisch nicht -- kein Sonderfall nötig.
//
// Magazin (state.mortars statt state.bullets) und Nachladen bleiben wie
// beim früheren Raketenwerfer (t_green: magazine 2, fireRate 2s).

import { explodeAt } from './mine.js';
import { resolveTarget } from './ai.js';

// Wie viele eigene Granaten dieses Schützen sind noch in der Luft?
function liveMortarsOf(state, owner) {
  let n = 0;
  for (const m of state.mortars) {
    if (!m.exploded && m.owner === owner) n++;
  }
  return n;
}

// Abschuss: setzt eine neue Granate auf den Flug. Gibt true zurück, wenn
// wirklich abgefeuert wurde (Cooldown/Magazin wie fireBullet() -- t_green
// selbst ruft nie fireBullet() mehr auf, das Verhalten muss deshalb hier
// eigenständig nachgebildet werden).
export function fireMortar(tank, state) {
  if (tank.cooldown > 1e-9) return false;
  const mag = tank.cfg.magazine ?? Infinity;
  if (liveMortarsOf(state, tank) >= mag) return false;
  const mcfg = state.data.balance.mortar;
  // Ziel = Spielerposition beim Abschuss plus ein konfigurierbarer
  // Vorhalteanteil (leadPct): 0 = zielt exakt auf die Position beim
  // Abschuss, 1 = volle Vorhersage (Position + Geschwindigkeit *
  // Flugzeit). Upgradepool-v2 Phase 5: das aufgelöste Ziel kann auch ein
  // Geist sein, resolveTarget() ist dieselbe Quelle wie roleTurret()s
  // Zielwahl.
  const p = resolveTarget(tank, state);
  const leadT = mcfg.flightTimeS * mcfg.leadPct;
  const tx = p.x + (p.vx || 0) * leadT;
  const ty = p.y + (p.vy || 0) * leadT;
  state.mortars.push({
    x0: tank.x,
    y0: tank.y,
    tx,
    ty,
    age: 0,
    flightTimeS: mcfg.flightTimeS,
    radiusPx: mcfg.radiusPx,
    damage: mcfg.damage,
    owner: tank,
    exploded: false,
  });
  state.sounds.push({ name: 'mortar_launch', x: tank.x });
  tank.cooldown = tank.cfg.fireCooldown;
  return true;
}

// Tickt alle fliegenden Granaten; explodiert sie am Zielpunkt, sobald die
// Flugzeit um ist.
export function updateMortars(state, dt) {
  if (!state.mortars.length) return;
  for (const m of state.mortars) {
    if (m.exploded) continue;
    m.age += dt;
    if (m.age >= m.flightTimeS) {
      m.exploded = true;
      // Explosionen ignorieren die Panzerung (wie überall sonst, armor.js) --
      // der Mörser trifft also auch den Gepanzerten von vorn, passend zur
      // Rolle. Eigenbeschuss der KI-Seite ist erlaubt (spare: null, kein
      // Ausnahmeziel) und lesbar.
      explodeAt(state, m.tx, m.ty, m.radiusPx, null, { killer: m.owner, code: 'enemy_mortar' }, m.damage);
    }
  }
  state.mortars = state.mortars.filter((m) => !m.exploded);
}
