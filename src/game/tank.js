// Panzer-Entity (Spec Abschnitt 5).
//
// Phase 3: generische Panzer fuer Spieler UND Gegner. Alle Werte kommen
// aus data/tanks.json (als aufgeloestes cfg-Objekt). Bewegung mit
// Sliding an Waenden; Panzer blockieren sich gegenseitig (kein Schieben:
// nur der sich bewegende Panzer wird herausgeschoben, der andere bleibt).

import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';
import { createMine } from './mine.js';
import { createGhost, occupiedGhostSlots, pushGhost, killGhost } from './ghost.js';
import { statusSpeedMult } from './status.js';
import { necroDamagePct, necroFireRatePct, necroSpeedPct, addNecroTimedStack, fireRateFactor } from './necro.js';
import { CELL } from '../config.js';

let nextTankId = 1;

// cfg = { radius, speed, magazine, bulletSpeed, bulletRadius,
//         fireCooldown, turret?, drive? } -- aufgeloest in state.js.
export function createTank(type, cfg, x, y) {
  return {
    id: nextTankId++,
    type,
    cfg,
    x,
    y,
    prevX: x,
    prevY: y,
    heading: -Math.PI / 2, // Rumpf (Fahrtrichtung)
    turret: -Math.PI / 2, // Turm, unabhaengig vom Rumpf
    vx: 0, // tatsaechliche Geschwindigkeit (px/s, nach Kollisionen)
    vy: 0, // -- gebraucht vom Vorhaltezielen (t_black)
    iceVx: 0, // Raum-Modifikator "Glatteis" (Phase 10): nachgleitende Geschwindigkeit
    iceVy: 0,
    cooldown: 0,
    // Lebenspunkte (UMBAUPLAN-LP Phase 1). Frisch bei jeder Erzeugung --
    // createTank() laeuft ohnehin bei jedem Raumwechsel, Respawn und
    // Wellen-Spawn, deshalb braucht die "volle LP je Raum"-Regel aus Phase 3
    // spaeter keinen eigenen Hook. Solange cfg.maxHp ueberall 1 ist, toetet
    // wie bisher jeder Treffer sofort.
    hp: (cfg && cfg.maxHp) || 1,
    protect: 0, // > 0: Spawn-Schutz (unverwundbar, blinkt)
    stunTimer: 0, // > 0: Krallenfalle -- kann nicht fahren
    shots: 0, // Schusszaehler (Sprengschuss-Upgrade)
    trapDist: 0, // gefahrene Strecke seit letzter Falle
    boostTimer: 0, // Nachbrenner-Restzeit
    bloodTimer: 0, // Blutrausch-Restzeit (Tempo + Unverwundbarkeit)
    dashCd: 0, // Dash-Cooldown
    berserkerFire: 1, // dynamischer Feuerraten-Multiplikator (Berserker)
    berserkerSpeed: 1, // dynamischer Tempo-Multiplikator (Berserker)
    magazineBonus: 0, // dynamischer Magazin-Bonus (Uebermacht)
    shieldReady: (cfg && (cfg.shield || cfg.counterShield)) || false, // Schild geladen?
    // Absorber-Punkte des Spieler-Schilds (Phase 8). Bei Gegnern ungenutzt
    // (deren Schild faengt einen Treffer ab, siehe state.js: applyDamage).
    shieldHp: (cfg && (cfg.shield || cfg.counterShield)) ? (cfg.shieldAbsorb || 0) : 0,
    // Nekromant-V2 Phase 2: NEUER, generischer Schild-Punktepool -- gilt fuer
    // JEDEN Panzer (Spieler, Gegner, kuenftig auch Untertanen/Geister ueber
    // ghost.js), unabhaengig von shieldReady. NICHT dasselbe Feld wie
    // shieldHp (das ist der aeltere, nur-Spieler-Absorber der schild-Karte
    // aus UMBAUPLAN-LP Phase 8) -- beide bleiben nebeneinander bestehen und
    // sind im HUD getrennt sichtbar (Auftrag: "Namenskollision beachten").
    // Startet voll (cfg.shieldMax), aktuell ueberall 0, bis eine Karte ihn
    // gewaehrt.
    shield: (cfg && cfg.shieldMax) || 0,
    // Powershot-Ladungen (Phase 5): frisch pro Raum, weil createTank() bei
    // jedem neuen Raum (und Respawn) ohnehin neu aufgerufen wird -- kein
    // eigener "Raum betreten"-Hook noetig.
    powershotCharges: (cfg && cfg.powershotPerRoom) || 0,
    // Sekundärslot (Phase 6): frisch pro Raum, aus demselben Grund.
    gadgetCooldown: 0, // P4: Abklingzeit des Gadgetslots (EMP/Haken/…)
    ghostBombCooldown: 0, // Nekromant: Abklingzeit der Geisterbombe (Nutzerwunsch)
    hookTimer: 0, // > 0: wird gerade zur Wand gezogen (Enterhaken)
    hookTarget: null,
    deflectorTimer: 0, // Restzeit des aktiven Deflektor-Fensters
    deflectorCharges: 0, // > 0: naechster Treffer wird reflektiert
    turretStunTimer: 0, // > 0: EMP-Mine -- Turm dreht sich nicht (stunTimer bleibt fuer Bewegung)
    // G8 (t_grabber): dieser Panzer ist gerade das Ziel eines Enterhakens.
    // Anders als der eigene hookTimer oben (ersetzt die Bewegung komplett)
    // ist das eine ADDITIVE Zug-Nudge -- s. moveTank() unten -- die volle
    // Steuerung senkrecht zur Leine bleibt erhalten (Auftrag Abschnitt 8.8).
    grappledBy: null, // > null: der Panzer, der zieht
    grappleUntil: 0, // state.time-Deadline, bis wann gezogen wird
    grappleRopeHp: 0, // verbleibende Treffer, bis die Leine reisst
    alive: true,
    ai: {}, // Zustandsspeicher der KI-Verhalten (leer beim Spieler)
  };
}

// Schiebt tank aus allen anderen lebenden Panzern heraus. Nur der Mover
// wird verschoben -- so kann kein Panzer einen anderen wegschieben.
function resolveTankBlocking(tank, tanks) {
  for (const other of tanks) {
    if (other === tank || !other.alive) continue;
    const dx = tank.x - other.x;
    const dy = tank.y - other.y;
    const rsum = tank.cfg.radius + other.cfg.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= rsum * rsum) continue;
    if (distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const overlap = rsum - dist;
      tank.x += (dx / dist) * overlap;
      tank.y += (dy / dist) * overlap;
    } else {
      tank.x += rsum; // deckungsgleich: deterministisch nach rechts
    }
  }
}

// Ein Bewegungsschritt. axis = roher Richtungsvektor {x, y}.
export function moveTank(tank, axis, state, dt) {
  tank.prevX = tank.x;
  tank.prevY = tank.y;

  // Sekundärslot "Enterhaken" (Phase 6): waehrend des Zugs ignoriert die
  // Bewegung jede Eingabe komplett und naehert sich stattdessen dem
  // Zielpunkt an der getroffenen Wand.
  if (tank.hookTimer > 0) {
    const scfg = state.data.secondaries?.hook || {};
    const speed = scfg.pullSpeedPx ?? 520;
    const tx = tank.hookTarget.x - tank.x;
    const ty = tank.hookTarget.y - tank.y;
    const dist = Math.hypot(tx, ty);
    const step = speed * dt;
    if (dist <= step || dist < 1) {
      tank.x = tank.hookTarget.x;
      tank.y = tank.hookTarget.y;
      tank.hookTimer = 0;
    } else {
      tank.x += (tx / dist) * step;
      tank.y += (ty / dist) * step;
      tank.heading = Math.atan2(ty, tx);
    }
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    resolveTankBlocking(tank, state.tanks);
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    tank.vx = (tank.x - tank.prevX) / dt;
    tank.vy = (tank.y - tank.prevY) / dt;
    return;
  }

  // Krallenfalle: gefangene Panzer koennen nicht fahren (Turm geht).
  let dx = tank.stunTimer > 0 ? 0 : axis.x;
  let dy = tank.stunTimer > 0 ? 0 : axis.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    // Normalisieren, damit Diagonale nicht schneller ist.
    dx /= len;
    dy /= len;
  }
  // Effektives Tempo: Basis * Berserker * Nachbrenner * Blutrausch * Frost.
  // Frost (Phase 5) reiht sich als weiterer Multiplikator ein, statt cfg.speed
  // anzufassen -- so gilt er automatisch fuer Spieler UND Gegner und ist beim
  // Ablaufen des Effekts von selbst wieder weg.
  const boost = tank.boostTimer > 0 ? tank.cfg.afterburnerMult || 1 : 1;
  const blood = tank.bloodTimer > 0 ? tank.cfg.bloodlustSpeed || 1 : 1;
  // Exekutionsschwelle (Grundsteinumbau Phase 2): ein angeschlagener Gegner
  // fährt langsamer -- das Flag wird in state.js: stepState() einmal pro
  // Tick VOR der Bewegung gesetzt (t.executing), gilt fuer Spieler und Bosse
  // nie (dort bleibt es immer false).
  const execSlow = tank.executing ? state.data.balance.execute?.slowMult ?? 1 : 1;
  // Nekromant-V2 Phase 6 (ghost_013/034): raumweite/zeitliche Tempo-
  // Prozentsaetze -- nur der Spieler (necroSpeedPct() summiert Room-/
  // Timed-Quellen, s. necro.js).
  const necroSpd = tank === state.player ? 1 + necroSpeedPct(state) : 1;
  const spd =
    tank.cfg.speed *
    (tank.berserkerSpeed || 1) *
    boost *
    blood *
    execSlow *
    necroSpd *
    statusSpeedMult(state, tank);
  const mod = state.modifier;
  // Oelpfuetze (Phase 15): dieselbe Grip-Physik wie das raumweite Glatteis
  // (Phase 10), nur ausgeloest durch die aktuelle Kachel statt durch einen
  // Raum-Modifikator -- deshalb hier zusammengefasst statt verdoppelt.
  const onOil = !!state.oilCells?.has(`${Math.floor(tank.x / CELL)},${Math.floor(tank.y / CELL)}`);
  if (mod?.slippery || onOil) {
    // Die tatsaechliche Geschwindigkeit naehert sich der Eingabe nur
    // allmaehlich an (Grip statt Sofort-Stopp/-Start) -- betrifft ALLE
    // Panzer gleich, gilt daher generisch in moveTank() statt in einem der
    // vier KI-Verhalten. Modifikator hat Vorrang, falls (theoretisch)
    // beides gleichzeitig aktiv waere.
    const grip = mod?.gripPerSec ?? state.hazard?.gripPerSec ?? 3;
    const t = Math.min(1, grip * dt);
    tank.iceVx += (dx * spd - tank.iceVx) * t;
    tank.iceVy += (dy * spd - tank.iceVy) * t;
    tank.x += tank.iceVx * dt;
    tank.y += tank.iceVy * dt;
    if (len > 0) tank.heading = Math.atan2(dy, dx);
  } else if (len > 0) {
    tank.x += dx * spd * dt;
    tank.y += dy * spd * dt;
    tank.heading = Math.atan2(dy, dx);
  }

  // Erst Waende, dann andere Panzer, dann nochmal Waende -- das
  // Herausschieben aus einem Panzer darf nicht in einer Wand enden.
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  resolveTankBlocking(tank, state.tanks);
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);

  // Foerderband (Phase 15): schiebt unabhaengig von der Eingabe, solange
  // der Panzer auf einer Foerderband-Kachel steht -- danach noch einmal an
  // Waenden aufloesen, damit der Schub nicht hindurchtraegt.
  if (state.conveyor?.cells.has(`${Math.floor(tank.x / CELL)},${Math.floor(tank.y / CELL)}`)) {
    tank.x += state.conveyor.dir.x * state.conveyor.pushPx * dt;
    tank.y += state.conveyor.dir.y * state.conveyor.pushPx * dt;
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  }

  // G8 (t_grabber): additive Zug-Nudge zum Schuetzen -- GENAU dasselbe Muster
  // wie das Foerderband oben (ADDITIV nach der normalen Bewegung/Kollision,
  // danach nochmal an Waenden aufloesen). Behaelt dadurch die "volle
  // Steuerung senkrecht zur Leine" (Auftrag Abschnitt 8.8) -- anders als der
  // eigene hookTimer weiter oben, der die Eingabe komplett ersetzt.
  if (tank.grappledBy?.alive && state.time < tank.grappleUntil) {
    const gx = tank.grappledBy.x - tank.x;
    const gy = tank.grappledBy.y - tank.y;
    const gd = Math.hypot(gx, gy);
    if (gd > 1) {
      const pull = (tank.grappledBy.cfg.grapple?.pullSpeedPxS ?? 90) * dt;
      tank.x += (gx / gd) * pull;
      tank.y += (gy / gd) * pull;
      resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    }
  }

  // Tatsaechliche Geschwindigkeit nach allen Kollisionen.
  tank.vx = (tank.x - tank.prevX) / dt;
  tank.vy = (tank.y - tank.prevY) / dt;
}

// Zaehlt die Geschosse, die gegen das Magazin des Schuetzen zaehlen.
// `magFreed` (Aasgeier-Upgrade, siehe state.js: killTank) nimmt eine bereits
// fliegende Kugel aus dieser Rechnung heraus -- sie fliegt weiter und toetet
// weiter, blockiert aber keinen Magazinplatz mehr.
// Exportiert (Grundsteinumbau Phase 2): state.js braucht dieselbe Pruefung,
// um magBlockedTime zu messen (Sekunden mit Feuerbefehl am vollen Magazin) --
// eine zweite, driftende Kopie der Bedingung waere die Alternative.
export function liveBulletsOf(state, owner) {
  let n = 0;
  for (const b of state.bullets) {
    if (!b.dead && b.owner === owner && !b.magFreed) n++;
  }
  return n;
}

// Effektives Magazin: Basis + dynamischer Bonus (Uebermacht), gedeckelt
// durch den harten Aktiv-Kugel-Cap (balance.bullet.maxActiveCap, nur
// Spieler -- Gegner haben cfg.magazineCap = Infinity).
export function magazineOf(tank) {
  const base = tank.cfg.magazine + (tank.magazineBonus || 0);
  return Math.min(base, tank.cfg.magazineCap ?? Infinity);
}

// Schussversuch: respektiert Cooldown und Magazin-Limit.
// Doppelrohr-Upgrade: zwei Kugeln im Spreizwinkel (jede zaehlt gegen
// das Magazin). Sprengschuss-Upgrade: jeder N-te Abzug traegt eine
// Sprengladung. Gibt true zurueck, wenn tatsaechlich gefeuert wurde.
// Rueckmeldung fuer eine blockierte Aktion (PLAN-INPUT.md P1 / SPEC.md
// Abschnitt 9, Konflikt D): Bei Autofire ist die Sperre unsichtbar und
// richtig so, bei manuellem Ausloesen wirkt ein wirkungsloser Tastendruck wie
// ein Fehler. Deshalb ein kurzes Klicken plus sichtbaren Marker am Rohr --
// hoechstens alle blockedShotCooldownS, sonst rattert es im Dauerfeuer.
// Urspruenglich nur fuer den vollen-Magazin-Fall (daher der Name der
// Konstante), inzwischen auch von der Geisterbombe waehrend ihrer
// Abklingzeit genutzt -- ein Timer statt zwei, sonst koennten beide
// gleichzeitig blockierten Aktionen im selben Frame doppelt Laerm machen.
function signalBlockedAction(tank, state) {
  if (tank !== state.player) return;
  const cd = state.data.input?.feedback?.blockedShotCooldownS ?? 0.35;
  if (state.blockedShotTimer > 0) return;
  state.blockedShotTimer = cd;
  const muzzle = tank.cfg.radius + 8;
  state.sounds.push({ name: 'empty', x: tank.x });
  state.flashes.push({
    x: tank.x + Math.cos(tank.turret) * muzzle,
    y: tank.y + Math.sin(tank.turret) * muzzle,
    age: 0,
    dim: true, // grauer, kleiner Blitz -- klar anders als der Muendungsblitz
  });
}

// `pressed` = frischer Abzug (Flanke) statt gehaltenem Dauerfeuer. Nur dann
// meldet ein blockierter Schuss sich zurueck.
export function fireBullet(tank, state, pressed) {
  // Epsilon: der Cooldown ist als Summe von 1/60-Schritten nicht exakt
  // darstellbar; ohne Toleranz feuert man einen Tick zu spaet.
  if (tank.cooldown > 1e-9) return false;
  const mag = magazineOf(tank);
  if (liveBulletsOf(state, tank) >= mag) {
    if (pressed) signalBlockedAction(tank, state);
    return false;
  }

  tank.shots++;
  // Nekromant-V2 Phase 6: raumweite/zeitlich befristete Prozentwerte (nur
  // Spieler -- necro*Pct() liefern 0 fuer jeden Gegner-Aufruf implizit ueber
  // die Bedingung unten) + die Einmal-Ladungen aus player.necroBulletBuffs
  // (ghost_017/018/019, "naechste(r) Schuss/Schuesse"). Alle Ladungen eines
  // Abzugs wirken zusammen (multiplikativ bei Faktoren, additiv bei
  // Bonuspunkten) und werden EINMAL pro Abzug verbraucht, nicht je Kugel
  // eines Streu-/Doppelrohr-Schusses.
  const necroPctDmg = tank === state.player ? necroDamagePct(state) : 0;
  const necroPctFireRate = tank === state.player ? necroFireRatePct(state) : 0;
  let buffDmgMult = 1;
  let buffSizeMult = 1;
  let buffPierceAdd = 0;
  let buffSpeedMult = 1;
  let buffCritChanceAdd = 0;
  let buffCritMultAdd = 0;
  if (tank === state.player && tank.necroBulletBuffs?.length) {
    for (const buff of tank.necroBulletBuffs) {
      if (buff.damageMult) buffDmgMult *= buff.damageMult;
      if (buff.sizeMult) buffSizeMult *= buff.sizeMult;
      if (buff.pierceAdd) buffPierceAdd += buff.pierceAdd;
      if (buff.bulletSpeedMult) buffSpeedMult *= buff.bulletSpeedMult;
      if (buff.critChanceAdd) buffCritChanceAdd += buff.critChanceAdd;
      if (buff.critMultAdd) buffCritMultAdd += buff.critMultAdd;
    }
  }
  // Sprengschuss: jeder N-te Schuss ist eine ABPRALLENDE Sprengkugel.
  const explosiveShot =
    !tank.cfg.allExplosive &&
    tank.cfg.explosionEveryShots > 0 &&
    tank.shots % tank.cfg.explosionEveryShots === 0;

  // Schusswinkel: Streuschuss-Faecher > Doppelrohr > Einzelschuss.
  let angles;
  if (tank.cfg.spreadCount > 1) {
    angles = [];
    const n = tank.cfg.spreadCount;
    for (let i = 0; i < n; i++) {
      angles.push(tank.turret + (i - (n - 1) / 2) * tank.cfg.spreadRad);
    }
  } else if (tank.cfg.twinShot) {
    angles = [tank.turret - tank.cfg.twinSpreadRad, tank.turret + tank.cfg.twinSpreadRad];
  } else {
    angles = [tank.turret];
  }

  // Powershot (Phase 5): solange Ladungen da sind, ist JEDER Abzug ein
  // Powershot (nicht nur der allererste) -- ein Abzug verbraucht genau
  // eine Ladung, unabhaengig davon, wie viele Kugeln er erzeugt (Doppelrohr
  // o. ae. bekommen den Bonus dann auf beide Kugeln).
  const boosted = tank.powershotCharges > 0;

  // Kritischer Treffer (UMBAUPLAN-LP Phase 7): EINMAL pro Abzug ausgewuerfelt
  // (alle Kugeln eines Schusses teilen ihn -- "jeder Schuss", nicht jede
  // Kugel). Vorerst nur spielerseitig; Gegner-Krit ist nicht spezifiziert und
  // wuerde ueber resetsReload zu Doppelfeuer fuehren. Der Zufall laeuft ueber
  // den Seed-RNG (state.rng), damit der Run deterministisch bleibt. Die
  // Chance ist an balance.crit.cap gedeckelt -- so greift der Deckel auch,
  // wenn Karten/Klassen (Phase 9) cfg.critChance ueber den Cap treiben.
  const critCfg = state.data.balance?.crit;
  const isCrit =
    tank === state.player &&
    !!critCfg &&
    // ghost_019 "Totenblick": Einmal-Krit-Chance-Bonus (buffCritChanceAdd)
    // fliesst in DIESEN Wurf mit ein -- der Deckel greift weiterhin am
    // Roll-Ort, unveraendert seit UMBAUPLAN-LP Phase 7.
    state.rng() < Math.min(critCfg.cap ?? 1, (tank.cfg.critChance ?? 0) + buffCritChanceAdd);

  const muzzle = tank.cfg.radius + 8; // Spitze des Rohrs
  // Amboss-Auftrag: EINE Ereigniskennung fuer diesen ganzen Abzug -- alle
  // Kugeln, die die folgende Schleife erzeugt (Doppelrohr, Streuschuss),
  // teilen sie sich, damit ein Zorn-Angriffspaket (state.js:
  // registerAnvilRage) sie als EINEN Treffer zaehlt statt mehrere. Ein reiner
  // Zaehler auf `state` (kein Gameplay-RNG-Verbrauch, keine Determinismus-
  // Auswirkung -- die Kennung selbst beeinflusst kein Spielverhalten, sie
  // dient nur der Dedupe-Logik).
  const rageEventId = 'r' + (state.nextRageEventId = (state.nextRageEventId || 0) + 1);
  let fired = false;
  for (let i = 0; i < angles.length; i++) {
    if (liveBulletsOf(state, tank) >= mag) break;
    const a = angles[i];
    const mx = tank.x + Math.cos(a) * muzzle;
    const my = tank.y + Math.sin(a) * muzzle;
    // Sprengmunition/Glaskanone zuenden hart an der Wand (detonateOnWall);
    // Sprengschuss (nicht detonateOnWall) explodiert seit Grundsteinumbau
    // Phase 1 einfach am ersten Wandkontakt wie jedes andere Geschoss.
    const isExplosive = explosiveShot || tank.cfg.allExplosive;
    state.bullets.push(
      createBullet(mx, my, a, {
        speed:
          (boosted ? tank.cfg.bulletSpeed * tank.cfg.powershotSpeedFactor : tank.cfg.bulletSpeed) * buffSpeedMult,
        radius: tank.cfg.bulletRadius * buffSizeMult,
        owner: tank,
        kind: tank.cfg.weapon,
        tungsten: tank.cfg.tungsten || false,
        explosive: isExplosive,
        detonateOnWall: isExplosive && !explosiveShot,
        explosionRadius: tank.cfg.shotExplosionRadius,
        phaseWalls: tank.cfg.phaseWalls || false,
        homing: tank.cfg.homing || 0,
        burstDistance: tank.cfg.burstRangePx || 0,
        // Nekromant-V2 Phase 6: raumweite/zeitliche Prozentwerte + die
        // Einmal-Ladung (ghost_017) multiplizieren den Schaden BEIM ABSCHUSS
        // ein -- wie jeder andere Schaden-Modifikator traegt die Kugel den
        // Wert, der beim Abschuss galt.
        damage: Math.round(tank.cfg.damage * (1 + necroPctDmg) * buffDmgMult),
        damageType: tank.cfg.damageType,
        crit: isCrit,
        // buffCritMultAdd (ghost_019) ist eine EINMALIGE, per-Schuss-Ladung --
        // anders als tank.cfg.critMultBonus (dauerhafte Kartenwirkung) kann
        // sie nicht auf der cfg liegen (die gilt fuer JEDEN Schuss), deshalb
        // eingefroren auf der Kugel selbst (state.js liest b.critMultBonus
        // beim Treffer zusaetzlich zu oc?.critMultBonus).
        critMultBonus: buffCritMultAdd,
        pierce: (tank.cfg.pierce || 0) + buffPierceAdd, // Nekromant-V2 Phase 2/6: Durchschlag + Einmal-Ladung
        rageEventId,
      }),
    );
    // Muendungsblitz -- bei t_white der einzige immer sichtbare Kanal.
    state.flashes.push({ x: mx, y: my, age: 0 });
    fired = true;
  }
  if (!fired) {
    tank.shots--;
    return false;
  }
  if (boosted) {
    tank.powershotCharges--;
    if (tank === state.player) state.powershotsFired++;
  }
  if (tank === state.player) state.playerShots++;
  if (tank.cfg.afterburnerMult) tank.boostTimer = tank.cfg.afterburnerS; // Nachbrenner
  // Raketenantrieb: Rueckstoss entgegen der Schussrichtung.
  if (tank.cfg.recoilPx) {
    tank.x -= Math.cos(tank.turret) * tank.cfg.recoilPx;
    tank.y -= Math.sin(tank.turret) * tank.cfg.recoilPx;
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  }
  // Phase 7b: Gegnerschuesse klingen tiefer als eigene und werden ueber ihre
  // x-Position im Stereobild geortet -- "wer schiesst woher?" ohne Hinsehen.
  state.sounds.push({ name: tank === state.player ? 'shoot' : 'shoot_enemy', x: tank.x });
  // Nekromant-V2 Phase 6/Nachschliff: raumweite/zeitliche Feuerrate-Prozentsaetze
  // erhoehen die Feuerrate OHNE Obergrenze -- fireRateFactor() rechnet als
  // Kehrwert (1/(1+pct)) statt der alten, bei pct>=0.9 gedeckelten Formel
  // Math.max(0.1, 1-pct). Division durch 0/negative Werte ist dadurch
  // strukturell ausgeschlossen, ohne eine neue Spielobergrenze einzufuehren.
  // Baustein A (Aura-Markierung, Gegner-Umbau G1): t_marshal setzt
  // t.auraFlags.fireRateMult < 1 (z. B. 0.7 -> 30 % schnelleres Nachladen)
  // auf jeden Verbuendeten mit Sichtlinie -- generischer Faktor NEBEN der
  // bestehenden Nekromant-Feuerraten-Formel, wirkt multiplikativ wie
  // berserkerFire/fireRateFactor. Default 1 (Reset in state.js), also ohne
  // Aurenquelle wirkungslos.
  tank.cooldown =
    tank.cfg.fireCooldown *
    (tank.berserkerFire || 1) *
    fireRateFactor(necroPctFireRate) *
    (tank.auraFlags?.fireRateMult ?? 1);
  // Einmal-Ladungen verbrauchen (ghost_017/018/019): EIN Abzug zaehlt fuer
  // JEDE aktive Ladung als ein Schuss, unabhaengig davon, wie viele Kugeln
  // dieser Abzug erzeugt hat (Streuschuss/Doppelrohr).
  if (tank.necroBulletBuffs?.length) {
    for (const buff of tank.necroBulletBuffs) buff.shotsLeft--;
    tank.necroBulletBuffs = tank.necroBulletBuffs.filter((b) => b.shotsLeft > 0);
  }
  // Krit (Phase 7): setzt das Nachladen SOFORT zurueck -- man darf sofort
  // wieder feuern (nur noch vom Magazin/aktiven Kugeln begrenzt). Das ist der
  // spuerbare Ausschlag des Ereignisses; die 2x-Schadensverdopplung selbst
  // liegt am Treffer (state.js). Dazu ein eigener Ton + Bildschirmausschlag +
  // sichtbarer Text -- damit der Krit hoer- UND sichtbar vom Normaltreffer
  // unterscheidbar ist (Testschritt 5).
  if (isCrit) {
    if (critCfg.resetsReload) tank.cooldown = 0;
    state.sounds.push({ name: 'crit', x: tank.x });
    state.addShake?.(6);
    state.texts.push({
      x: tank.x,
      y: tank.y - 22,
      text: 'KRITISCH!',
      age: 0,
      life: 0.7,
      color: '#ff4d4d',
    });
  }
  return true;
}

// Ausweich-Dash: kurzer Sprung in Fahrt- bzw. Blickrichtung mit
// Unverwundbarkeit (Upgrade). Gibt true zurueck, wenn ausgefuehrt.
export function dashTank(tank, state, moveAxis) {
  if (!tank.cfg.dash || tank.dashCd > 0 || !tank.alive) return false;
  let a;
  const len = Math.hypot(moveAxis.x, moveAxis.y);
  if (len > 0) a = Math.atan2(moveAxis.y, moveAxis.x); // in Fahrtrichtung
  else a = tank.turret; // sonst in Zielrichtung
  tank.x += Math.cos(a) * tank.cfg.dash.dist;
  tank.y += Math.sin(a) * tank.cfg.dash.dist;
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  resolveTankBlocking(tank, state.tanks);
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  // Transformation "Kavallerie" (Phase 17, Tag mobility): halbierter
  // Cooldown, dafuer Unverwundbarkeit fuer die GESAMTE (schon halbierte)
  // Cooldown-Dauer statt nur des kurzen Basis-iframe -- der Dash wird
  // dadurch zu einem quasi-durchgehenden Ausweichmanoever.
  const cdMult = state.transform?.dashCooldownMult ?? 1;
  const cooldown = tank.cfg.dash.cooldown * cdMult;
  const iframe = cdMult < 1 ? cooldown : tank.cfg.dash.iframe;
  tank.protect = Math.max(tank.protect, iframe);
  tank.dashCd = cooldown;
  state.sounds.push({ name: 'dash', x: tank.x });
  state.spawnParticles?.(tank.x, tank.y, '#8ecaf0', 8, 90);
  // Erschuetterungsdash-Upgrade (Phase 18): stoesst nahe Gegner weg und
  // betaeubt sie kurz -- unabhaengig von der Sekundaerwaffe, deshalb hier
  // statt an layMine()s Schockwelle gehaengt. Gleiches Muster (Push + Stun),
  // eigene cfg-Felder, damit sich beide Karten nicht gegenseitig ueberschreiben.
  if (tank.cfg.dashShockRadius) {
    const R = tank.cfg.dashShockRadius;
    for (const t of state.tanks) {
      if (t === tank || !t.alive) continue;
      const dx = t.x - tank.x;
      const dy = t.y - tank.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < R) {
        const push = tank.cfg.dashShockPush * (1 - d / R);
        t.x += (dx / d) * push;
        t.y += (dy / d) * push;
        resolveCircleWalls(t, t.cfg.radius, state.walls);
        if (tank.cfg.dashShockStun) t.stunTimer = Math.max(t.stunTimer, tank.cfg.dashShockStun);
      }
    }
  }
  return true;
}

// Legt eine Mine am Ort des Panzers, begrenzt durch das Minen-Limit
// (gleichzeitig liegende eigene Minen, aus tanks.json).
export function layMine(tank, state, throwOverride, forceEmp = false) {
  const own = state.mines.filter((m) => !m.dead && m.owner === tank);
  // Fernzuender: sind alle Minen draussen, sprengt die Taste sie alle.
  // Gilt nur fuer den Bombenslot -- eine EMP aus dem Gadgetslot soll nicht
  // versehentlich das ganze Feld zuenden (sie hat mit `detonate` einen
  // eigenen, ausdruecklichen Knopf).
  if (!forceEmp && tank.cfg.remoteDetonate && own.length >= tank.cfg.mines && own.length > 0) {
    for (const m of own) if (m.fuse === null) m.fuse = 0.001;
    return true;
  }
  if (own.length >= tank.cfg.mines) return false;

  // Wurf: Richtung + Weite. Touch-Wurfstick (throwOverride) hat Vorrang,
  // sonst wirft der Spieler in Blickrichtung bis throwPx weit. An einer
  // Wand faellt die Bombe davor zu Boden.
  let angle = tank.turret;
  let maxDist = 0;
  if (throwOverride) {
    angle = throwOverride.angle;
    maxDist = throwOverride.dist;
  } else if (tank.type === 'player') {
    maxDist = state.data.mine.throwPx || 0;
  }
  let lx = tank.x;
  let ly = tank.y;
  if (maxDist > 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let d = 6; d <= maxDist; d += 6) {
      const nx = tank.x + cos * d;
      const ny = tank.y + sin * d;
      if (state.isSolid(nx, ny)) break;
      lx = nx;
      ly = ny;
    }
  }
  // EMP-Mine (P4): kein Zaehlwerk mehr ("jede 4. Bombe"), sondern eine
  // ausdrueckliche Entscheidung des Spielers -- sie kommt aus dem
  // Gadgetslot und wird von useGadget() mit forceEmp aufgerufen.
  state.mines.push(createMine(lx, ly, tank, state.data.mine.radiusPx, forceEmp));
  state.sounds.push({ name: 'mine', x: lx });
  // Schockwelle: nahe Gegner um die gelegte Mine wegstossen.
  if (tank.cfg.shockwaveRadius) {
    const R = tank.cfg.shockwaveRadius;
    for (const t of state.tanks) {
      if (t === tank || !t.alive) continue;
      const dx = t.x - lx;
      const dy = t.y - ly;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < R) {
        const push = tank.cfg.shockwavePush * (1 - d / R);
        t.x += (dx / d) * push;
        t.y += (dy / d) * push;
        resolveCircleWalls(t, t.cfg.radius, state.walls);
        if (tank.cfg.shockwaveStun) t.stunTimer = Math.max(t.stunTimer, tank.cfg.shockwaveStun);
      }
    }
  }
  return true;
}

// Nekromant: Geisterbombe (Upgradepool-v2 Phase 6) -- ersetzt den
// Bombenslot VOLLSTAENDIG, solange cfg.necromancer gesetzt ist. Kein Wurf,
// keine Explosion, kein Fernzuender: ein Tastendruck erzeugt SOFORT einen
// Untertan und zaehlt gegen dasselbe Limit wie kill-ausgeloeste Untertanen
// (data/balance.json: ghost.maxActive, s. state.js: killTank()). Am Limit
// passiert nichts -- kein Verbrauch, keine Verdraengung (Festgelegte
// Entscheidungen: "Geistlimit"). Seit Nekromant-V2 Phase 3 erbt der
// entstehende Untertan einen ZUFAELLIGEN Typ aus dem aktuellen
// Akt-Gegnerpool (state.actEnemyPool, run.js: unlockedEnemyTypes() ueber
// buildCombatRoom() durchgereicht) statt eines festen Basistyps -- "man
// weiss vorher nicht, was man bekommt" (Auftrag). Nutzerwunsch: eigene
// Abklingzeit (ghost.bombCooldownS, Standard 10 s) -- unabhaengig vom
// Geistlimit, das weiterhin ohne Verdraengung UND ohne eigenen Verbrauch
// bleibt (ein Versuch am vollen Limit startet KEINE Abklingzeit, genau wie
// er bisher schon nichts "verbraucht" hat).
function spawnGhostBomb(tank, state) {
  // Epsilon wie bei fireBullet(): der Cooldown ist als Summe von
  // 1/60-Schritten nicht exakt darstellbar, ohne Toleranz bleibt die Bombe
  // einen Tick zu lang gesperrt.
  if (tank.ghostBombCooldown > 1e-9) {
    signalBlockedAction(tank, state); // dieselbe Rueckmeldung wie beim gesperrten Schuss (P1)
    return false;
  }
  // Seelenruf/Geisterlegion/Armee der Toten (Upgradepool-v2 Phase 8):
  // ghostMaxAdd erhoeht das Basislimit additiv -- dieselbe Formel wie beim
  // kill-ausgeloesten Spawnwuerfel in state.js: killTank(). Nekromant-V2
  // Phase 7 (Legion): der Deckel-Vergleich zaehlt jetzt belegte PLAETZE
  // (occupiedGhostSlots), nicht die reine Anzahl -- ein wiederbelebter
  // Elite-Untertan (ghost_056) belegt 2.
  const cap = (state.data.balance.ghost?.maxActive ?? 3) + (tank.cfg.ghostMaxAdd || 0);
  // ghost_098 "Auslese der Legion": am vollen Limit NICHT verweigern, sondern
  // pushGhost() erreichen lassen -- das verschmilzt dort den schwaechsten
  // gewoehnlichen Untertan in den Champion. Ohne die Karte bleibt es bei der
  // alten Verweigerung (kein Wurf, kein Verbrauch, keine Abklingzeit).
  if (occupiedGhostSlots(state) >= cap && !tank.cfg.necroCapFusion) return false;
  // Zufaelliger Typ aus dem Akt-Gegnerpool -- ueber den Seed-RNG
  // (state.rng), nie Math.random. Ein leerer Pool (Testfixtures ohne
  // actEnemyPool) faellt auf 't_brown' zurueck, den fruehesten/einfachsten
  // Gegnertyp, statt den Wurf zu verweigern.
  const rawPool = state.actEnemyPool && state.actEnemyPool.length ? state.actEnemyPool : ['t_brown'];
  // ghost_116 "Losgeloeste Ketten" (Abschnitt 9): garantiert einen
  // BEWEGLICHEN (nicht-stationaeren) Typ -- stationaere Typen (role:
  // 'guardian', Phase 8) werden aus dem Pool gefiltert. Bleibt dabei kein
  // Typ uebrig, faellt der Filter auf den vollen Pool zurueck, statt die
  // Geisterbombe wirkungslos zu machen.
  let pool = rawPool;
  if (tank.cfg.necroForceMobileBomb) {
    const mobile = rawPool.filter((t) => state.data.types?.[t]?.role !== 'guardian');
    if (mobile.length) pool = mobile;
  }
  const sourceType = pool[Math.floor(state.rng() * pool.length) % pool.length];
  const bombGhost = createGhost(state, tank.x, tank.y, tank.turret, sourceType);
  // Nekromant-V2 Phase 8: pushGhost() (Muster s. state.js: killTank()) --
  // wertet "Einziger Thron" (ghost_071) aus, statt die Geisterbombe eine
  // eigene sechste Fusionslogik bauen zu lassen.
  pushGhost(state, bombGhost);
  tank.ghostBombCooldown = state.data.balance.ghost?.bombCooldownS ?? 10;
  state.sounds.push({ name: 'shield', x: tank.x });
  state.spawnParticles?.(tank.x, tank.y, '#8ecaf0', 10, 90);
  return true;
}

// Sekundärslot (Phase 6): generischer Dispatch fuer die aktive
// Sekundärwaffe des Spielers. mine/emp_mine laufen weiter ueber layMine()
// (teilen sich Zuend-/Wurfmechanik); die vier neuen teilen sich stattdessen
// eine Abklingzeit (tank.secondaryCooldown), da sie Aktionen statt Vorraete
// sind. Gibt true zurueck, wenn tatsaechlich etwas ausgeloest wurde.
export function useSecondary(tank, state, throwOverride) {
  // Raum-Modifikator "Ausruestungssperre" (Phase 10): sperrt seit P4 BEIDE
  // Slots (nicht ueber cfg.secondary=null geloest, weil der `|| 'mine'`-
  // Rueckfall die Sperre sonst gleich wieder aufheben wuerde).
  if (tank.cfg.secondaryDisabled) return false;
  // Nekromant (Upgradepool-v2 Phase 6): der Bombenslot ist keine Mine mehr.
  if (tank.cfg.necromancer) return spawnGhostBomb(tank, state);
  return layMine(tank, state, throwOverride);
}

// Gadgetslot (P4): der zweite, tauschbare Slot. Anders als die Bombe sind
// das Aktionen statt eines Vorrats -- sie teilen sich deshalb eine
// Abklingzeit (tank.gadgetCooldown) statt eines Magazins.
// Gibt true zurueck, wenn tatsaechlich etwas ausgeloest wurde.
export function useGadget(tank, state, aimOverride) {
  if (tank.cfg.secondaryDisabled) return false;
  const g = tank.cfg.gadget;
  if (!g) return false; // noch kein Gadget ausgeruestet
  if (tank.gadgetCooldown > 0) return false;
  const scfg = state.data.secondaries?.[g] || {};
  let used = false;
  if (g === 'emp_mine') {
    // P4: eigener Ausloeser statt "jede 4. Bombe ist EMP". Teilt sich die
    // Lege-/Wurfmechanik weiterhin mit der Bombe (layMine), bekommt aber
    // ihren eigenen Knopf und ihre eigene Abklingzeit.
    used = layMine(tank, state, aimOverride, true);
  } else if (g === 'hook') {
    // Zielrichtung: Touch-Wurfstick, sonst Blickrichtung.
    used = fireHook(tank, state, scfg, aimOverride ? aimOverride.angle : tank.turret);
  } else if (g === 'deflector') {
    tank.deflectorTimer = scfg.activeS ?? 1.5;
    tank.deflectorCharges = 1;
    state.sounds.push({ name: 'shield', x: tank.x });
    used = true;
  } else if (g === 'smoke') {
    state.smokeClouds.push({
      x: tank.x,
      y: tank.y,
      radius: scfg.radiusPx ?? 90,
      age: 0,
      life: scfg.durationS ?? 4,
    });
    state.sounds.push({ name: 'mine', x: tank.x });
    state.spawnParticles?.(tank.x, tank.y, '#9aa0a8', 12, 70);
    used = true;
  } else if (g === 'trap_wall') {
    used = placeTrapWall(tank, state, scfg);
  } else if (g === 'ghost_031') {
    // "Maertyrerbefehl": opfert ALLE aktiven Untertanen. Je geopfertem
    // Untertan haelt der Bonus 10s -- die Timed-Stack-API (addNecroTimedStack)
    // erneuert nur die DAUER bei erneutem Aufruf, deshalb wird die gesamte
    // Staerke (Anzahl x Prozentsatz) in EINEM Aufruf gesetzt statt N Aufrufen,
    // die sich sonst gegenseitig ueberschreiben wuerden.
    const victims = state.ghosts.filter((x) => x.alive);
    // Nichts zu opfern -> die Karte tut nichts, verbraucht aber auch keine
    // Abklingzeit (Muster: layMine() gibt ebenfalls false zurueck, wenn
    // nichts ausgeloest werden konnte).
    used = victims.length > 0;
    if (used) {
      for (const v of victims) killGhost(state, v, 'sacrifice');
      addNecroTimedStack(state, '_timedHybridSacrificeDmg', victims.length * (tank.cfg.necroActiveDmgPct || 0), tank.cfg.necroActiveDurationS || 0);
      addNecroTimedStack(state, '_timedHybridSacrificeFR', victims.length * (tank.cfg.necroActiveFireRatePct || 0), tank.cfg.necroActiveDurationS || 0);
    }
  } else if (g === 'ghost_089') {
    // "Wechselopfer": opfert NUR den Untertan mit dem niedrigsten Leben.
    const alive = state.ghosts.filter((x) => x.alive);
    used = alive.length > 0;
    if (used) {
      let lowest = alive[0];
      for (const x of alive) if (x.hp < lowest.hp) lowest = x;
      killGhost(state, lowest, 'sacrifice');
      for (const x of alive) {
        if (x === lowest || !x.alive) continue;
        x.hp = Math.min(x.cfg.maxHp, x.hp + x.cfg.maxHp * (tank.cfg.necroSacrificeHealPct || 0));
      }
      tank.shield = (tank.shield || 0) + tank.cfg.maxHp * (tank.cfg.necroSacrificeShieldPct || 0);
      state.necroGuaranteedReviveUntil = state.time + (tank.cfg.necroSacrificeGuaranteeWindowS || 0);
    }
  } else if (g === 'ghost_096') {
    // "Koenigliches Opfer" (Nachschliff Abschnitt 10, UEBERARBEITET): opfert
    // AUSSCHLIESSLICH den Champion, der Hauptpanzer erhaelt 40 % von dessen
    // BASISWERTEN (HP/Schaden/Feuerrate -- nicht mehr ein fixer Prozentsatz
    // fuer 10 Sekunden) bis Raumende -- direkte, dauerhafte cfg-Anpassung
    // (Muster wie ghost_094 "Erbe des Herrschers"), kein Zeitfenster mehr.
    const champion = state.ghosts.find((x) => x.alive && x.isChampion);
    used = !!champion;
    if (used) {
      const pct = tank.cfg.necroSacrificeChampionStatPct ?? 0.4;
      if (state.player?.alive) {
        const p = state.player;
        const dmgGain = Math.round((champion.baseDamage || 0) * pct);
        const hpGain = Math.round((champion.baseMaxHp || 0) * pct);
        const champRate = champion.baseFireCooldown > 0 ? 1 / champion.baseFireCooldown : 0;
        p.cfg.damage += dmgGain;
        p.cfg.maxHp += hpGain;
        p.hp += hpGain;
        const curRate = p.cfg.fireCooldown > 0 ? 1 / p.cfg.fireCooldown : 0;
        const newRate = curRate + champRate * pct;
        p.cfg.fireCooldown = newRate > 0 ? 1 / newRate : p.cfg.fireCooldown;
      }
      killGhost(state, champion, 'sacrifice');
    }
  }
  if (used) tank.gadgetCooldown = scfg.cooldownS ?? 4;
  return used;
}

// Enterhaken: Raymarch in Blickrichtung bis maxRangePx. Trifft er eine
// Wand, wird der Panzer ueber mehrere Ticks dorthin gezogen (moveTank()
// uebernimmt den eigentlichen Zug via tank.hookTimer/hookTarget).
// P6: EINE Quelle fuer "wo landet der Haken?" -- Zielvorschau und echter
// Schuss rechnen damit garantiert dasselbe. (Dasselbe Prinzip wie die
// Ziellinie aus Phase 0a, die bewusst die echte updateBullet-Physik nutzt,
// statt sie nachzubauen.)
// Liefert { x, y, hit }: bei hit === false ist { x, y } das Reichweitenende.
export function traceHook(tank, state, scfg, angle) {
  const step = state.data.ai.raycastStepPx;
  const maxRange = scfg.maxRangePx ?? 222;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let x = tank.x;
  let y = tank.y;
  for (let d = 0; d < maxRange; d += step) {
    const nx = x + cos * step;
    const ny = y + sin * step;
    // isSolid deckt ALLE Wandtypen ab, an denen sich ein Haken festmachen
    // kann: feste, durchschiessbare, Spiegel-, zerstoerbare, Generator- und
    // (ueber das Grid) auch die eigene Sperrmauer sowie geschlossene
    // bewegliche Waende. Loecher sind bewusst NICHT dabei -- dort ist
    // nichts zum Festhaken.
    if (state.isSolid(nx, ny)) {
      return { x: nx - cos * tank.cfg.radius, y: ny - sin * tank.cfg.radius, hit: true };
    }
    x = nx;
    y = ny;
  }
  return { x, y, hit: false };
}

// Enterhaken: Raymarch in Zielrichtung bis maxRangePx. Trifft er eine Wand,
// wird der Panzer ueber mehrere Ticks dorthin gezogen (moveTank() uebernimmt
// den eigentlichen Zug via tank.hookTimer/hookTarget).
// `angle` kommt bei Touch aus dem Gadget-Wurfstick, sonst aus der
// Blickrichtung (Maus/Zielstick) -- die Zielphase steuert den Haken also
// genau wie den Bombenwurf.
function fireHook(tank, state, scfg, angle) {
  const t = traceHook(tank, state, scfg, angle);
  if (t.hit) {
    tank.hookTarget = { x: t.x, y: t.y };
    tank.hookTimer = 1;
    state.sounds.push({ name: 'dash', x: tank.x });
  } else {
    // P6: "Cooldown auch ohne Treffer". Ein Fehlschuss ist damit eine echte
    // Fehlentscheidung statt eines folgenlosen Versuchs -- vorher kostete
    // ein Griff ins Leere gar nichts. Hoer- und sichtbar quittiert, sonst
    // wirkt die verbrauchte Abklingzeit wie ein Defekt (dieselbe Auflage
    // wie beim gesperrten Schuss aus P1).
    state.sounds.push({ name: 'empty', x: tank.x });
    state.flashes.push({ x: t.x, y: t.y, age: 0, dim: true });
  }
  return true; // gefeuert ist gefeuert -- Abklingzeit laeuft in jedem Fall
}

// Sperrmauer: entsteht auf der Kachel vor dem Panzer, wenn diese begehbar
// und panzerfrei ist (Details/Haltbarkeit in state.placeTrapWall()).
function placeTrapWall(tank, state, scfg) {
  const dist = scfg.placeDistPx ?? 48;
  const x = tank.x + Math.cos(tank.turret) * dist;
  const y = tank.y + Math.sin(tank.turret) * dist;
  // Ingenieur-Passiv (UMBAUPLAN-LP Phase 9): Gebautes haelt builtHpMult mehr
  // Treffer aus (aufgerundet, mindestens die Grundhaltbarkeit).
  const hits = Math.max(scfg.hits ?? 3, Math.round((scfg.hits ?? 3) * (tank.cfg.builtHpMult || 1)));
  return state.placeTrapWall(x, y, hits);
}
