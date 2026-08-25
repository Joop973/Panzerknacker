// Gerichtete Panzerung (PLAN.md v2, Phase 4).
//
// armor: { arc: 120, reflects: true }   Frontpanzerung: Treffer im
//     Frontsektor (gemessen zur Fahrtrichtung der Wanne) prallen ab,
//     Treffer von der Seite oder von hinten toeten.
//
// Reflektierte Geschosse folgen E3: der Schuetze bleibt Besitzer, sterben
// am naechsten Wandkontakt (Grundsteinumbau Phase 1: das ist seit dem
// Wegfall des Bandenschusses ohnehin JEDER Wandkontakt, kein Sonderfall
// mehr noetig) und wechseln die Farbe.
//
// Explosionen (Minen, Sprengschuss) ignorieren die Panzerung bewusst.
//
// Grundsteinumbau Phase 1, Ist-Abgleich: `cfg.requiresRicochet` blockte
// frueher JEDEN direkten Schuss (Prisma-Mechanik, seit UMBAUPLAN-LP Phase 8
// durch t_prism.bounceDamageTakenMult ersetzt) -- diese Auswertung ist hier
// ENTFALLEN, weil sie ohne Wandabpraller keinen Sinn mehr ergibt (waere ein
// dauerhafter Kill-Block). Das Datenfeld selbst bleibt als reiner
// Boss-Platzhalter in cfg.js/tanks.json stehen (t_mirror, aktuell nicht
// spielbar erreichbar, s. CLAUDE.md "Bosse (Platzhalter, Nutzerentscheidung)")
// -- ein kuenftiger Bossneubau muss sich hier ohnehin eine neue Regel
// ueberlegen, s. ARCHIV.md.

const TAU = Math.PI * 2;

// Differenz zweier Winkel, normiert auf [-PI, PI]. Exportiert (Grundstein-
// umbau Phase 2): der Flanken-/Heckschaden (state.js: flankZone unten)
// braucht dieselbe Winkelmathematik wie armorBlocks() -- eine gemeinsame
// Hilfsfunktion statt einer zweiten Kopie.
export function angleDelta(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Gilt die Kugel als "gefaehrlich fuer den eigenen Schuetzen"? Grundstein-
// umbau Phase 1: nur noch nach einer Reflexion (E3) -- ohne Bandenschuss
// gibt es keinen "erster Abpraller macht sie scharf"-Uebergang mehr, eine
// nicht reflektierte Kugel stirbt ja schon am ersten Wandkontakt.
export function isLive(b) {
  return !!b.reflected;
}

// Blockt die Panzerung dieses Panzers den Treffer? true = kein Kill.
export function armorBlocks(tank, b) {
  // Amboss-Auftrag (Zusammenbruch nach der Raserei): tank.armorDisabled ist
  // ein generischer, zur Laufzeit gesetzter Schalter -- ein Boss deaktiviert
  // damit vorübergehend seine eigene Frontpanzerung (src/game/anvil.js),
  // ohne cfg.armor selbst zu veraendern (das wuerde auch die Renderer-
  // Anzeige treffen, die stattdessen bewusst weiterlaeuft, s. dort). Bei
  // jedem anderen Panzer bleibt das Feld undefined/false und damit wirkungslos.
  if (tank.armorDisabled) return false;
  const arc = tank.cfg.armor?.arc;
  if (!arc) return false;
  if (arc >= 360) return true;
  // Einschlagrichtung relativ zur Ausrichtung der Wanne (= was der
  // Spieler als dicken Balken sieht).
  const toBullet = Math.atan2(b.y - tank.y, b.x - tank.x);
  return Math.abs(angleDelta(toBullet, tank.heading)) <= (arc * Math.PI) / 360;
}

// Flanken-/Heckschaden (Grundsteinumbau Phase 2, der Ersatz fuer den
// entfernten Bandenschuss): Front/Seite/Heck ueber DIESELBE Winkelmathematik
// wie armorBlocks() -- der Einschlagwinkel relativ zur WANNEN-Ausrichtung
// (heading, nicht Turm; Entscheidung B: am Turm gemessen waere das Heck
// praktisch nie treffbar, weil Tuerme das Ziel verfolgen).
//
// rearArcDeg/sideArcDeg sind wie armor.arc TOTALE Bogenbreiten (Halbwinkel =
// arc/2). Heck zaehlt zuerst (Prioritaet bei ueberlappenden Werten), dann je
// eine Seitenkeule links/rechts um die Querachse; alles Uebrige ist Front
// ("Rest des Kreises", so vom Auftrag gefordert) -- bei den Standardwerten
// (rear 70, side 110 je Seite) deckt das den Kreis exakt ohne Luecke oder
// Ueberlappung: Front 70 + Seite 2x110 + Heck 70 = 360.
export function flankZone(tank, bx, by, flank) {
  const toBullet = Math.atan2(by - tank.y, bx - tank.x);
  const rearHalf = (flank.rearArcDeg * Math.PI) / 360;
  if (Math.abs(angleDelta(toBullet, tank.heading + Math.PI)) <= rearHalf) return 'rear';
  const sideHalf = (flank.sideArcDeg * Math.PI) / 360;
  const dRight = Math.abs(angleDelta(toBullet, tank.heading + Math.PI / 2));
  const dLeft = Math.abs(angleDelta(toBullet, tank.heading - Math.PI / 2));
  if (Math.min(dRight, dLeft) <= sideHalf) return 'side';
  return 'front';
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
  // Grundsteinumbau Phase 1: kein "stirbt am naechsten Wandkontakt"-Sonderfall
  // mehr noetig -- das gilt seit dem Wegfall des Bandenschusses fuer JEDES
  // Geschoss, auch dieses reflektierte.
  b.homing = 0; // ein Zielsucher darf nicht sofort zurueckdrehen
  b.reflected = true;
  b.reflectImmune = tank;
  b.reflectImmuneT = rc.graceS ?? 0.15;
  // Phase 7b: eigener 'reflect'-Ton statt des Schild-Tons -- "meine Kugel
  // kam zurueck" und "meine Schildladung ist weg" sind zwei voellig
  // verschiedene Ereignisse und klangen bis hierher identisch.
  state.sounds.push({ name: 'reflect', x: b.x });
  // Sichtbares Gegenstueck zum Ton (PLAN.md: "viele spielen stumm") --
  // wiederverwendet den bestehenden Muendungsblitz-Mechanismus.
  state.flashes?.push({ x: b.x, y: b.y, age: 0 });
  state.spawnParticles?.(b.x, b.y, '#b6f0ff', 5, 90);
}

// Sekundärslot "Deflektor" (Phase 6): reflektiert eine eingehende Kugel in
// die Blickrichtung des Spielers -- anders als reflectBullet() (Richtung
// "weg vom reflektierenden Panzer") ist die Quelle hier tank.turret, daher
// eine eigene, bewusst getrennte Funktion. b.owner bleibt unveraendert (der
// urspruengliche Schuetze bleibt Besitzer).
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
  b.homing = 0;
  state.sounds.push({ name: 'reflect', x: b.x });
  state.flashes?.push({ x: b.x, y: b.y, age: 0 });
  state.spawnParticles?.(b.x, b.y, '#ffd23c', 6, 110);
}
