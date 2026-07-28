// Gerichtete Panzerung (PLAN.md v2, Phase 4).
//
// Zwei Bauformen, beide rein datengesteuert ueber data/tanks.json --
// im Code steht keine tunbare Zahl:
//
//   armor: { arc: 120, reflects: true }   Frontpanzerung: Treffer im
//        Frontsektor (gemessen zur Fahrtrichtung der Wanne) prallen ab,
//        Treffer von der Seite oder von hinten toeten.
//   requiresRicochet: true                Prisma: JEDER direkte Schuss
//        wird zurueckgeworfen; nur eine an einer WAND abgeprallte Kugel
//        toetet.
//
// Reflektierte Geschosse folgen E3: der Schuetze bleibt Besitzer, sie
// verlieren alle Abpraller (despawnen also am naechsten Wandkontakt),
// koennen ihn damit nur auf direktem, sichtbarem Weg toeten, und
// wechseln die Farbe.
//
// Explosionen (Minen, Sprengschuss) ignorieren die Panzerung bewusst.
// Sonst waere ein Prisma fuer Builds ohne Abpraller (Durchschlag,
// Streuschuss) gar nicht mehr toetbar -- der Raum waere unloesbar.

const TAU = Math.PI * 2;

// Differenz zweier Winkel, normiert auf [-PI, PI].
function angleDelta(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Hat die Kugel an einer WAND abgeprallt? Eine Reflexion an einem Panzer
// zaehlt bewusst NICHT mit -- sonst koennte man zwei Prismen gegeneinander
// ausspielen, ohne je eine Bande zu benutzen, und der Gegner haette seinen
// Lehrzweck verloren.
export function hasWallBounced(b) {
  return (b.wallBounces || 0) > 0;
}

// Gilt die Kugel als "gefaehrlich fuer den eigenen Schuetzen"? Das ist der
// Fall nach dem ersten Wandabpraller UND nach einer Reflexion (E3).
export function isLive(b) {
  return hasWallBounced(b) || !!b.reflected;
}

// Blockt die Panzerung dieses Panzers den Treffer? true = kein Kill.
export function armorBlocks(tank, b) {
  const cfg = tank.cfg;
  if (cfg.requiresRicochet) return !hasWallBounced(b);
  const arc = cfg.armor?.arc;
  if (!arc) return false;
  if (arc >= 360) return true;
  // Einschlagrichtung relativ zur Ausrichtung der Wanne (= was der
  // Spieler als dicken Balken sieht).
  const toBullet = Math.atan2(b.y - tank.y, b.x - tank.x);
  return Math.abs(angleDelta(toBullet, tank.heading)) <= (arc * Math.PI) / 360;
}

// Wirft die Kugel zurueck (E3). Sie gehoert weiter dem Schuetzen, verliert
// alle Abpraller und bekommt ein kurzes Immunitaetsfenster gegen den
// reflektierenden Panzer, damit sie ihn nicht im selben Frame erneut trifft.
export function reflectBullet(b, tank, state) {
  const rc = state.data.balance.reflect || {};
  const nx = b.x - tank.x;
  const ny = b.y - tank.y;
  const len = Math.hypot(nx, ny) || 1;
  const speed = Math.hypot(b.vx, b.vy) * (rc.speedMult ?? 1);
  b.vx = (nx / len) * speed;
  b.vy = (ny / len) * speed;
  // Aus dem Panzer herausschieben, sonst steckt die Kugel im Kreis fest.
  const push = tank.cfg.radius + b.radius + (rc.pushPx ?? 2);
  b.x = tank.x + (nx / len) * push;
  b.y = tank.y + (ny / len) * push;
  b.prevX = b.x;
  b.prevY = b.y;
  b.ricochetsLeft = rc.ricochetsLeft ?? 0; // stirbt am naechsten Wandkontakt
  b.homing = 0; // ein Zielsucher darf nicht sofort zurueckdrehen
  b.reflected = true;
  b.reflectImmune = tank;
  b.reflectImmuneT = rc.graceS ?? 0.15;
  state.sounds.push('shield');
  state.spawnParticles?.(b.x, b.y, '#b6f0ff', 5, 90);
}

// Sekundärslot "Deflektor" (Phase 6): reflektiert eine eingehende Kugel in
// die Blickrichtung des Spielers -- anders als reflectBullet() (Richtung
// "weg vom reflektierenden Panzer") ist die Quelle hier tank.turret, daher
// eine eigene, bewusst getrennte Funktion. b.owner bleibt unveraendert
// (wie bei E3 bleibt der urspruengliche Schuetze Besitzer); b.wallBounces
// erhoeht sich (nicht b.reflected), damit der Treffer wie ein Wandabpraller
// gegen Prisma-Panzer zaehlt.
export function reflectFromAim(b, tank, state) {
  const rc = state.data.balance.reflect || {};
  const speed = Math.hypot(b.vx, b.vy) * (rc.speedMult ?? 1);
  b.vx = Math.cos(tank.turret) * speed;
  b.vy = Math.sin(tank.turret) * speed;
  const push = tank.cfg.radius + b.radius + (rc.pushPx ?? 2);
  b.x = tank.x + Math.cos(tank.turret) * push;
  b.y = tank.y + Math.sin(tank.turret) * push;
  b.prevX = b.x;
  b.prevY = b.y;
  b.wallBounces++;
  b.homing = 0;
  state.sounds.push('shield');
  state.spawnParticles?.(b.x, b.y, '#ffd23c', 6, 110);
}
