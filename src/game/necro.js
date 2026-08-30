// Nekromant-V2 Phase 5 (Ereignis- und Stapelschicht): das Fundament, auf dem
// alle 105 Karten aus data/upgrades_necro.json stehen (Auftrag: "ohne diese
// Phase werden die Pfade zu Sonderfaellen im Code"). Baut NUR die generische
// Maschinerie -- KEINE Karte hoert bis jetzt zu (Phase 6-9 fuellen
// state.necroListeners), Muster wie UMBAUPLAN-LP Phase 5s Statuseffekt-
// System ("gebaut, bevor es die Elemente gibt").
//
// Vier Auslöser (Tabelle aus dem Auftrag): death_damage/death_expire lösen
// "Todeseffekte" aus, sacrifice zählt ausdrücklich ALS Geistertod, fusion
// NICHT (eine Karte kann trotzdem explizit auf 'fusion' hören -- die
// Ausnahme ist nur die AUTOMATISCHE Buchführung unten, nicht die
// Listener-Zustellung selbst).
//
// Vier Stapelbereiche, hier auf drei Speicher + einen Rechenweg reduziert
// (keine Verhaltensaenderung, nur eine schlankere Umsetzung): raumweit
// (state.necroStacks), runweit (state.necroRunStackGain, per Delta-Sync
// nach run.necroStacks uebernommen -- state.js kennt kein run-Objekt,
// dasselbe Muster wie run.js: bonusScrap/seenBonusScrap), zeitlich
// (state.necroTimedStacks, mit eigener Restlaufzeit je Schluessel) und
// "Zaehler" als reiner Rechenweg (countThresholdCrossings) UEBER einem der
// drei Speicher -- kein vierter Container noetig, dieselbe Praezisions-
// Garantie (JS-Zahlen sind bis 2^53 exakt) haelt beliebig grosse Werte ohne
// Ueberlauf/NaN, ohne einen mitgefuehrten Rest.
//
// "Kein switch ueber Karten-IDs": onGhostRemoved() kennt keine Karten-ID --
// es iteriert state.necroListeners (Eintraege, die eine kuenftige Karte ueber
// ihre eigenen Daten registriert) und ruft nur generische, deklarierte
// Felder ab (reasons/scope/cooldownS/fn).
//
// Nekromant-V2 Phase 6 (Allgemein und Opfer, 35 Karten): buildNecroListeners()
// ganz unten ist die BRUECKE von dieser Phase-5-Infrastruktur zu echten
// Karten -- sie liest die core-Felder aus dem aufgeloesten Spieler-cfg
// (cfg.js: applyUpgrades()) und traegt daraus state.necroListeners ein, exakt
// EINMAL pro Raumaufbau (state.js: createState()). Reservierte, in dieser
// Phase feste Stapel-/Timed-Schluessel (beginnen mit '_', kollidieren nie mit
// einer Karten-id):
//   Raumweit, PLAIN Prozentsaetze (pureStack, s. u.): _pctDamage/_pctFireRate/
//     _pctSpeed (ghost_011-013).
//   Zeitlich befristet, je EIGENER Schluessel (nicht ein gemeinsamer "Prozent-
//     Schaden"-Topf!) -- zwei verschiedene Karten koennten sonst denselben
//     Schluessel ueberschreiben, statt sich zu addieren:
//     _timedFireRateFuel (024), _timedRequiemDmg/_timedRequiemFireRate/
//     _timedRequiemSpeed (034). (021/022 waren hier urspruenglich ebenfalls
//     zeitlich befristet, sind aber seit dem Champion-/Nekromant-Nachschliff
//     v2 permanente, raumweite PLAIN-Stapel -- _roomDmgErbschaft/
//     _roomResistHaerte, s. u. -- dieser Kommentar war seither veraltet.)
//     tank.js/state.js SUMMIEREN am Ort der Verwendung ueber diese feste,
//     bekannte Liste -- kein neuer API-Mechanismus noetig.
//   Runweit, permanent: _runDmgBonus (029), _runHpBonus (030) -- gelesen von
//     run.js: buildCombatRoom() -> cfg.js: applyNecroRunScaling().
//
// pureStack (neu seit dieser Phase): markiert einen Listener, dessen EINZIGE
// Wirkung das Erhoehen eines raumweiten Spielerstapels ist -- keine Heilung,
// keine Explosion, kein Zaehler, keine Abklingzeit. Nur DAS ist die Klasse,
// auf die ghost_035s applyVirtualNecroDeaths() zielen darf (s. dort) und auf
// die ghost_027/028s Multiplikator wirkt (s. onGhostRemoved() oben). Aktuell
// EXAKT ghost_011/012/013 -- alle anderen "Opfer"-Karten haben einen
// Seiteneffekt (Heilung/Explosion/Zaehler/Abklingzeit) und sind bewusst NICHT
// pureStack, selbst wenn sie ebenfalls einen Stapel erhoehen (z. B. 015s
// Schildstapel -- der hat einen Cap-Mechanismus UND einen direkten
// Schild-Seiteneffekt, ist also kein "reiner" Stapel).

import { createBullet } from './bullet.js';
import { explodeAt } from './mine.js';

export const NECRO_REASONS = ['death_damage', 'death_expire', 'fusion', 'sacrifice'];

// "Jeder Geistertod" (ohne weitere Einschraenkung) heisst in JEDER Karten-
// beschreibung dieser Phase: dieselben drei Ausloeser, bei denen
// countsAsGhostDeath() true liefert (Tabelle oben) -- death_damage,
// death_expire, sacrifice, NICHT fusion.
const DEATH_REASONS = ['death_damage', 'death_expire', 'sacrifice'];

// Reservierter Stapel-Schluessel fuer die automatische "wie viele
// Geistertode"-Buchfuehrung -- beginnt mit '_', damit er nie mit einem
// echten Karten-Schluessel (Karten-IDs wie 'ghost_029') kollidiert.
const DEATH_STACK_KEY = '_deaths';

// Tabelle aus dem Auftrag: loest dieser Ausloeser "Todeseffekte" aus (also
// die automatische _deaths-Buchfuehrung)? fusion ausdruecklich NICHT.
export function countsAsGhostDeath(reason) {
  return reason === 'death_damage' || reason === 'death_expire' || reason === 'sacrifice';
}

// ---- Raum-/runweite Stapel ------------------------------------------------
// scope 'room': state.necroStacks[key] -- lebt nur fuer diesen Raum (state
// wird bei jedem Raumwechsel ohnehin frisch angelegt, s. state.js:
// createState()) -- kein expliziter reset() noetig.
// scope 'run': state.necroRunStackGain[key] ist ein raumlokaler, monoton
// wachsender Zaehler "wie viel wurde in DIESEM Raum fuer diesen Schluessel
// dazugewonnen" -- run.js: stepRun() liest ihn per Delta (dasselbe Muster
// wie bonusScrap) und traegt den Zuwachs in run.necroStacks (den echten,
// runweiten, persistenten Speicher) ein. Ein Lesezugriff waehrend des
// laufenden Raums muss deshalb Basiswert (Stand bei Raumbeginn,
// state.necroRunStacksBase, aus run.necroStacks kopiert -- s.
// state.js: createState()-Opt) UND den bisher in DIESEM Raum gewonnenen
// Anteil addieren.
export function addNecroStack(state, scope, key, amount) {
  if (!amount) return;
  if (scope === 'run') {
    state.necroRunStackGain[key] = (state.necroRunStackGain[key] || 0) + amount;
  } else {
    state.necroStacks[key] = (state.necroStacks[key] || 0) + amount;
  }
}

export function getNecroStack(state, scope, key) {
  if (scope === 'run') {
    return (state.necroRunStacksBase[key] || 0) + (state.necroRunStackGain[key] || 0);
  }
  return state.necroStacks[key] || 0;
}

// ---- Zeitlich befristete Stapel ------------------------------------------
// Eigene Restlaufzeit JE SCHLUESSEL (nicht ein gemeinsamer Timer fuer alle)
// -- ein erneutes Auftragen erneuert nur die Dauer, addiert den Wert aber
// NICHT ein zweites Mal drauf (Muster wie status.js: applyStatus() fuer
// Statuseffekte -- "erneutes Auftragen erneuert nur die Dauer").
export function addNecroTimedStack(state, key, value, durationS) {
  state.necroTimedStacks[key] = { value, remainingS: durationS };
}

export function getNecroTimedStack(state, key) {
  return state.necroTimedStacks[key]?.value || 0;
}

// Treiber, einmal pro Tick aus state.js (Muster wie updateStatus()/
// updateGhosts()). Entfernt abgelaufene Eintraege vollstaendig -- ein
// ausgelaufener Stapel ist wieder 0, kein Karteileichen-Objekt mit
// remainingS <= 0.
export function tickNecroTimers(state, dt) {
  for (const key of Object.keys(state.necroTimedStacks)) {
    const t = state.necroTimedStacks[key];
    t.remainingS -= dt;
    if (t.remainingS <= 0) delete state.necroTimedStacks[key];
  }
}

// ---- "Zaehler" (Auslösen nach jeweils N) ---------------------------------
// Reiner Rechenweg statt eines vierten Speichers: wie oft wurde die
// Schwelle n zwischen zwei Gesamtwerten ueberschritten? Ganzzahlteilung auf
// dem GESAMTWERT statt eines separat mitgefuehrten Rests -- dadurch von
// Natur aus ueberlauf-/NaN-sicher (Auftrag: "Zaehler und Stapel muessen sehr
// grosse Werte tragen") und robust gegen einen Sprung von mehr als einem
// Schritt auf einmal (liefert dann > 1).
export function countThresholdCrossings(totalBefore, totalAfter, n) {
  if (!(n > 0)) return 0;
  return Math.floor(totalAfter / n) - Math.floor(totalBefore / n);
}

// ---- Interne Abklingzeiten (je Effekt-Schluessel, NICHT global) ---------
// Nutzt die ohnehin laufende state.time-Uhr statt eines eigenen
// Countdown-Feldes: readyAt liegt in der Zukunft, solange der Effekt
// gesperrt ist. Zwei Ausloeser im SELBEN Tick (state.time unveraendert)
// koennen den Effekt deshalb nachweislich nur einmal ausloesen -- die erste
// Zuteilung setzt readyAt bereits auf state.time + cooldownS, das ist bei
// cooldownS > 0 immer > dem unveraenderten state.time des zweiten Aufrufs.
function necroCooldownReady(state, key, cooldownS) {
  if (!cooldownS) return true;
  if ((state.necroCooldownReadyAt[key] || 0) > state.time) return false;
  state.necroCooldownReadyAt[key] = state.time + cooldownS;
  return true;
}

// ---- Zentrales Ereignis ---------------------------------------------------
// state.necroListeners: Array von { reasons: string[], scope, key,
// cooldownS?, pureStack?: boolean, fn(state, ghost, reason, mult) }.
// onGhostRemoved() selbst prueft NIE eine Karten-ID, nur die deklarierten
// Felder. pureStack markiert einen Listener, der AUSSCHLIESSLICH einen
// raumweiten Spielerstapel erhoeht (kein Seiteneffekt wie Heilung/Explosion/
// Abklingzeit) -- genau die Klasse, die applyVirtualNecroDeaths() (ghost_035)
// ansprechen darf, und die einzige, auf die ghost_027/028s Multiplikator
// wirkt (s. u.).
export function onGhostRemoved(state, ghost, reason) {
  // Sichtbares Ereignisprotokoll (Testschritt 1: "unterscheidbar im
  // Debug-Overlay") -- fuer JEDEN Ausloeser, auch fusion/sacrifice, damit
  // spaetere Karten-Debugging nie im Dunkeln tappt.
  state.necroEventLog.push({ reason, type: ghost?.type ?? null, t: state.time });
  if (state.necroEventLog.length > 20) state.necroEventLog.shift();

  // Automatische "Geistertod"-Buchfuehrung -- EIN reservierter Stapel-
  // Schluessel statt eines eigenen Zaehlerfelds je Reason, damit jede
  // kuenftige Karte (z. B. ghost_029/030s "nach jeweils 10 Geistertoden")
  // denselben generischen getNecroStack()/countThresholdCrossings()-Pfad
  // benutzen kann, ohne dass die Engine ihretwegen eine neue Funktion
  // braucht. fusion zaehlt bewusst NICHT mit (Tabelle oben).
  if (countsAsGhostDeath(reason)) {
    addNecroStack(state, 'room', DEATH_STACK_KEY, 1);
    addNecroStack(state, 'run', DEATH_STACK_KEY, 1);
  }

  // Nekromant-V2 Phase 6: zwei Karten modifizieren, WIE STARK ein pureStack-
  // Ereignis einen Stapel erhoeht -- ghost_027 "Kettenopfer" verdoppelt ihn
  // mit einer Zufallschance (state.rng(), NUR raumweite pureStack-Stapel),
  // ghost_028 "Treues Ende" multipliziert ihn bei Ablauf-Toden. Beide lesen
  // ihre Werte direkt aus dem aufgeloesten Spieler-cfg (kein core-Umweg noetig,
  // es gibt nur einen Ort, an dem diese beiden Karten wirken).
  const pc = state.player?.cfg;
  let stackMult = 1;
  if (pc?.necroDoubleStackChance && state.rng() < pc.necroDoubleStackChance) stackMult *= 2;
  if (reason === 'death_expire' && pc?.necroExpireStackBonus) stackMult *= 1 + pc.necroExpireStackBonus;

  for (const l of state.necroListeners) {
    if (!l.reasons.includes(reason)) continue;
    if (!necroCooldownReady(state, l.key, l.cooldownS)) continue;
    l.fn(state, ghost, reason, l.pureStack ? stackMult : 1);
  }

  // ghost_092 "Blutiger Thron" (Nachschliff Abschnitt 10, UEBERARBEITET):
  // "Verschmelzungen zaehlen fuer raumweite Spielerstapel als VOLLER
  // Geistertod." (vorher: halber) -- Heilung/Explosionen/Druckwellen/
  // Abklingzeitreduktion bleiben weiterhin ausgeschlossen, deshalb bewusst
  // NICHT ueber die normale reasons-Filterung oben (die wuerde JEDEN
  // death_damage/death_expire-Listener treffen, auch jene mit einem
  // Seiteneffekt), sondern ein zweiter, auf pureStack:true eingeschraenkter
  // Durchlauf, unabhaengig von l.reasons (011/012/013 deklarieren 'fusion'
  // dort ohnehin nicht). Dasselbe Prinzip wie applyVirtualNecroDeaths(), mit
  // vollem statt (wie zuvor) halbem Gewicht -- explizit auf ausdruecklich auf
  // 'fusion' lauschende Karten wie ghost_065 "Seelenheilung" hat das keinen
  // Einfluss, die feuern ueber ihren eigenen, direkten Aufruf in
  // ghost.js: fuseGhost().
  if (reason === 'fusion' && pc?.necroFusionHalfDeathForStacks) {
    for (const l of state.necroListeners) {
      if (!l.pureStack) continue;
      if (!necroCooldownReady(state, l.key + '_fusion', l.cooldownS)) continue;
      l.fn(state, ghost, reason, 1);
    }
  }
}

// ---- Virtuelle Tode (Pruefstein fuer die saubere Trennung) ---------------
// ghost_035 "Vorbote des Endes" (noch nicht angeschlossen, Phase 6-9 fuellt
// die 105 Karten): "4 virtuelle Geistertode ausschliesslich auf raumweite
// Spielerstapel, keine Heilung, keine Explosionen, keine Abklingzeiten,
// keine Zaehler." Deshalb ein bewusst SEPARATER Pfad statt eines Parameters
// an onGhostRemoved() -- er darf dessen automatische Buchfuehrung
// (_deaths-Stapel, Ereignisprotokoll) UND die interne Abklingzeit-Sperre gar
// nicht erst sehen, sonst waere die Trennung nicht bewiesen, nur behauptet.
// Nur scope:'room'-Listener MIT pureStack:true, die auf 'death_damage' oder
// 'death_expire' hoeren, werden aufgerufen -- run-/timed-scope-Listener und
// jeder Listener mit einem Seiteneffekt (Heilung/Explosion/Abklingzeit,
// Phase 6) bleiben unberuehrt. Der Multiplikator ist immer 1 -- ghost_027/028
// (die den Multiplikator ueberhaupt erst erzeugen) reagieren selbst auf
// echte Geistertode, nicht auf virtuelle.
export function applyVirtualNecroDeaths(state, count) {
  for (let i = 0; i < count; i++) {
    for (const l of state.necroListeners) {
      if (l.scope !== 'room' || !l.pureStack) continue;
      if (!l.reasons.includes('death_damage') && !l.reasons.includes('death_expire')) continue;
      l.fn(state, null, 'death_damage', 1);
    }
  }
}

// ---- Listener-Baukasten (Phase 6, "Allgemein und Opfer") ------------------
// Wird EINMAL pro Raumaufbau aus dem aufgeloesten Spieler-cfg gebaut
// (state.js: createState(), NACH der Panzererzeugung -- der Aufrufer braucht
// den vollstaendigen `state` fuer die Closures unten). Jede if-Zeile spiegelt
// GENAU eine Karte -- "kein switch ueber Karten-IDs" gilt trotzdem: jede
// Bedingung prueft nur ein core-Feld, nie eine id.
//
// n-vor/n-nach-Zaehlmuster (017/018 nein, 019 nein, 022/029/030/032 ja):
// onGhostRemoved() hat den betroffenen Stapel ('_deaths', room ODER run)
// bereits um GENAU 1 erhoeht, BEVOR es die Listener aufruft (s. oben) -- ein
// einzelnes Ereignis erhoeht ihn nie um mehr als 1, "vorher" ist deshalb
// immer "nachher - 1".
export function buildNecroListeners(state, cfg) {
  const L = state.necroListeners;

  // ghost_011/012/013: reine, raumweite Prozent-Stapel -- die einzigen drei
  // pureStack:true-Listener dieser Phase (s. Kopfkommentar).
  if (cfg.necroDmgPctPerDeath) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro011', pureStack: true,
      fn: (st, gh, reason, mult) => addNecroStack(st, 'room', '_pctDamage', cfg.necroDmgPctPerDeath * mult),
    });
  }
  if (cfg.necroFireRatePctPerDeath) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro012', pureStack: true,
      fn: (st, gh, reason, mult) => addNecroStack(st, 'room', '_pctFireRate', cfg.necroFireRatePctPerDeath * mult),
    });
  }
  if (cfg.necroSpeedPctPerDeath) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro013', pureStack: true,
      fn: (st, gh, reason, mult) => addNecroStack(st, 'room', '_pctSpeed', cfg.necroSpeedPctPerDeath * mult),
    });
  }

  // ghost_014 "Lebensfunke" + ghost_023 "Ueberlaufende Seele" (requires 014):
  // Heilung mit interner Abklingzeit; Ueberlauf (ueber volles Leben hinaus)
  // wird bei aktivem necroOverflowToShield VOLLSTAENDIG in Schild umgewandelt
  // statt verworfen zu werden -- keine eigene Deckelung mehr (Auftrag
  // Abschnitt 9), der Schild-Punktepool selbst ist bereits unbegrenzt
  // (absorbWithShieldPool() in state.js kennt keinen Deckel).
  if (cfg.necroHealPctPerDeath) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro014', cooldownS: cfg.necroHealCooldownS,
      fn: (st) => {
        const p = st.player;
        if (!p || !p.alive) return;
        const heal = p.cfg.maxHp * cfg.necroHealPctPerDeath;
        const overflow = Math.max(0, p.hp + heal - p.cfg.maxHp);
        p.hp = Math.min(p.cfg.maxHp, p.hp + heal);
        if (overflow > 0 && cfg.necroOverflowToShield) {
          p.shield = (p.shield || 0) + overflow;
        }
      },
    });
  }

  // ghost_015 "Aschenhaut": stapelt OHNE Obergrenze, verfaellt nach einer
  // festen Dauer -- ueber tank.necroShieldStackAmount/-ExpiresAt (eigene
  // Felder auf dem Spieler-Panzer, nicht das generische necroTimedStacks:
  // ein Timed-Stack allein kennt seinen Anteil am geteilten Schild-Pool
  // nicht, s. state.js-Tick-Schleife, die den Ablauf abwickelt).
  if (cfg.necroShieldPctPerDeath) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro015',
      fn: (st) => {
        const p = st.player;
        if (!p) return;
        const incAmt = p.cfg.maxHp * cfg.necroShieldPctPerDeath;
        const curAmt = p.necroShieldStackAmount || 0;
        const nextAmt = curAmt + incAmt;
        p.shield = (p.shield || 0) + incAmt;
        p.necroShieldStackAmount = nextAmt;
        p.necroShieldStackExpiresAt = st.time + cfg.necroShieldDurationS;
      },
    });
  }

  // ghost_016 "Fluesternde Kuehlung": Gadget-Abklingzeit reduzieren, eigene
  // interne Abklingzeit gegen Spam.
  if (cfg.necroGadgetCooldownReduceS) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro016', cooldownS: cfg.necroGadgetReduceCooldownS,
      fn: (st) => {
        const p = st.player;
        if (p) p.gadgetCooldown = Math.max(0, (p.gadgetCooldown || 0) - cfg.necroGadgetCooldownReduceS);
      },
    });
  }

  // ghost_017 "Opferladung": nach jeweils N Toden ist der naechste Schuss
  // groesser/staerker -- ueber player.necroBulletBuffs, konsumiert von
  // tank.js: fireBullet().
  if (cfg.necroBurstEveryN) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro017',
      fn: (st) => {
        const after = getNecroStack(st, 'room', DEATH_STACK_KEY);
        const n = countThresholdCrossings(after - 1, after, cfg.necroBurstEveryN);
        if (n <= 0 || !st.player) return;
        st.player.necroBulletBuffs = st.player.necroBulletBuffs || [];
        st.player.necroBulletBuffs.push({
          shotsLeft: 1,
          damageMult: 1 + cfg.necroBurstDamageMult,
          sizeMult: 1 + (cfg.necroBurstSizeMult || 0),
        });
      },
    });
  }

  // ghost_018 "Knochenmunition": JEDER Tod gibt den naechsten 3 Schuessen
  // Durchschlag + Tempo.
  if (cfg.necroAmmoShots) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro018',
      fn: (st) => {
        if (!st.player) return;
        st.player.necroBulletBuffs = st.player.necroBulletBuffs || [];
        st.player.necroBulletBuffs.push({
          shotsLeft: cfg.necroAmmoShots,
          pierceAdd: cfg.necroAmmoPierceAdd || 0,
          bulletSpeedMult: cfg.necroAmmoSpeedMult || 1,
        });
      },
    });
  }

  // ghost_019 "Totenblick": JEDER Tod gibt dem naechsten Schuss (als
  // Vereinfachung von "naechster TREFFER" -- s. Kartentext) Krit-Bonus.
  if (cfg.necroNextHitCritChanceAdd) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro019',
      fn: (st) => {
        if (!st.player) return;
        st.player.necroBulletBuffs = st.player.necroBulletBuffs || [];
        st.player.necroBulletBuffs.push({
          shotsLeft: 1,
          critChanceAdd: cfg.necroNextHitCritChanceAdd,
          critMultAdd: cfg.necroNextHitCritMultAdd || 0,
        });
      },
    });
  }

  // ghost_020 "Sterbeexplosion": Explosion an der Sterbeposition des
  // Untertanen, Schaden relativ zum AKTUELLEN Spielerschaden.
  if (cfg.necroExplosionRadius) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro020',
      fn: (st, gh) => {
        if (!gh || !st.player) return;
        const dmg = Math.round(st.player.cfg.damage * cfg.necroExplosionDamagePct);
        explodeAt(st, gh.x, gh.y, cfg.necroExplosionRadius, st.player, { code: 'necro_death_explosion', killer: st.player }, dmg, 'explosive');
      },
    });
  }

  // ghost_021 "Erbschaft des Starken" (Nachschliff Abschnitt 10,
  // UEBERARBEITET: kein 10-Sekunden-Fenster mehr -- der Bonus bleibt bis
  // Raumende bestehen, jeder qualifizierende Tod haeuft weiter oben drauf,
  // dasselbe additive "bis Raumende"-Muster wie Seelenzorn/Totenrhythmus):
  // staerker gewesene Untertanen (>=120% des unverstaerkten Basisschadens)
  // geben einen groesseren Bonus.
  if (cfg.necroInheritHighPct) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro021',
      fn: (st, gh) => {
        if (!gh) return;
        const base = resolveGhostBaselineDamage(st, gh.type);
        const strong = base > 0 && gh.baseDamage >= base * (cfg.necroInheritThresholdMult || 1.2);
        const pct = strong ? cfg.necroInheritHighPct : cfg.necroInheritLowPct;
        addNecroStack(st, 'room', '_roomDmgErbschaft', pct);
      },
    });
  }

  // ghost_022 "Haerte aus Verlust" (Nachschliff Abschnitt 10, UEBERARBEITET:
  // kein 10-Sekunden-Fenster mehr -- die Resistenz bleibt bis Raumende
  // bestehen, der Ausloeser "alle 3 Tode" ist unveraendert): nach jeweils 3
  // Toden dauerhaft +Resistenzpunkte.
  if (cfg.necroResistEveryN) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro022',
      fn: (st) => {
        const after = getNecroStack(st, 'room', DEATH_STACK_KEY);
        const n = countThresholdCrossings(after - 1, after, cfg.necroResistEveryN);
        if (n > 0) addNecroStack(st, 'room', '_roomResistHaerte', cfg.necroResistAmount * n);
      },
    });
  }

  // ghost_024 "Dunkler Treibstoff": NUR der erste Tod je 3-s-Fenster --
  // exakt die interne Abklingzeit-Sperre (necroCooldownReady), keine eigene
  // Fensterlogik noetig.
  if (cfg.necroFireBurstWindowS) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro024', cooldownS: cfg.necroFireBurstWindowS,
      fn: (st) => addNecroTimedStack(st, '_timedFireRateFuel', cfg.necroFireBurstPct, cfg.necroFireBurstDurationS),
    });
  }

  // ghost_026 "Opferstoss": Druckwelle -- Schaden + Rueckstoss + temporaer
  // gesenkte (angehobene) Exekutionsschwelle fuer getroffene Gegner.
  if (cfg.necroShockRadius) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro026',
      fn: (st, gh) => {
        if (!gh || !st.player) return;
        const dmg = Math.round(st.player.cfg.damage * cfg.necroShockDamagePct);
        explodeAt(st, gh.x, gh.y, cfg.necroShockRadius, st.player, { code: 'necro_shockwave', killer: st.player }, dmg, 'explosive');
        for (const t of st.tanks) {
          if (t === st.player || !t.alive) continue;
          const dx = t.x - gh.x;
          const dy = t.y - gh.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > cfg.necroShockRadius) continue;
          t.x += (dx / d) * (cfg.necroShockPushPx || 0);
          t.y += (dy / d) * (cfg.necroShockPushPx || 0);
          t.necroExecUntil = st.time + (cfg.necroShockExecDurationS || 0);
          t.necroExecThreshold = cfg.necroShockExecMult || 0;
        }
      },
    });
  }

  // ghost_029 "Seelenhunger"/ghost_030 "Unsterbliche Maschine": permanente
  // Run-Boni nach jeweils N GEISTERTODEN IM GANZEN RUN (run-Scope!).
  if (cfg.necroRunDmgEveryN) {
    L.push({
      reasons: DEATH_REASONS, scope: 'run', key: 'necro029',
      fn: (st) => {
        const after = getNecroStack(st, 'run', DEATH_STACK_KEY);
        const n = countThresholdCrossings(after - 1, after, cfg.necroRunDmgEveryN);
        if (n > 0) addNecroStack(st, 'run', '_runDmgBonus', cfg.necroRunDmgPct * n);
      },
    });
  }
  if (cfg.necroRunHpEveryN) {
    L.push({
      reasons: DEATH_REASONS, scope: 'run', key: 'necro030',
      fn: (st) => {
        const after = getNecroStack(st, 'run', DEATH_STACK_KEY);
        const n = countThresholdCrossings(after - 1, after, cfg.necroRunHpEveryN);
        if (n > 0) addNecroStack(st, 'run', '_runHpBonus', cfg.necroRunHpPct * n);
      },
    });
  }

  // ghost_032 "Totenkanone": nach jeweils N Toden ein zielsuchendes
  // Seelengeschoss vom Spieler.
  if (cfg.necroHomingEveryN) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro032',
      fn: (st) => {
        const after = getNecroStack(st, 'room', DEATH_STACK_KEY);
        const n = countThresholdCrossings(after - 1, after, cfg.necroHomingEveryN);
        if (n <= 0 || !st.player?.alive) return;
        const p = st.player;
        const dmg = Math.round(p.cfg.damage * cfg.necroHomingDamageMult);
        const muzzle = p.cfg.radius + 8;
        st.bullets.push(
          createBullet(p.x + Math.cos(p.turret) * muzzle, p.y + Math.sin(p.turret) * muzzle, p.turret, {
            speed: p.cfg.bulletSpeed,
            radius: st.data.physics.bulletRadius,
            owner: p,
            damage: dmg,
            damageType: p.cfg.damageType,
            homing: cfg.necroHomingTurnRate || 3,
          }),
        );
      },
    });
  }

  // ghost_034 "Unheiliger Hoehepunkt": Requiem, ausgeloest von einer
  // ROLLIERENDEN Todeszaehlung (necroKeystoneCount Tode innerhalb von
  // necroKeystoneWindowS) -- eigenes kleines Zeitstempel-Array auf dem
  // state, weil weder ein einfacher Stapel noch die interne Abklingzeit
  // allein ein rollierendes Fenster abbilden koennen.
  if (cfg.necroKeystoneCount) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro034', cooldownS: cfg.necroKeystoneCooldownS,
      fn: (st) => {
        st.necroKeystoneDeathTimes = (st.necroKeystoneDeathTimes || []).filter(
          (t) => st.time - t <= cfg.necroKeystoneWindowS,
        );
        st.necroKeystoneDeathTimes.push(st.time);
        if (st.necroKeystoneDeathTimes.length < cfg.necroKeystoneCount) return;
        st.necroKeystoneDeathTimes = [];
        addNecroTimedStack(st, '_timedRequiemDmg', cfg.necroKeystoneDamagePct, cfg.necroKeystoneDurationS);
        addNecroTimedStack(st, '_timedRequiemFireRate', cfg.necroKeystoneFireRatePct, cfg.necroKeystoneDurationS);
        addNecroTimedStack(st, '_timedRequiemSpeed', cfg.necroKeystoneSpeedPct, cfg.necroKeystoneDurationS);
      },
    });
  }

  // ---- Nekromant-V2 Phase 7 (Legion, 25 Karten) ----------------------------
  // ghost_043 "Reihenwechsel": stirbt ein Untertan, heilen ALLE UEBRIGEN um
  // einen Anteil ihres EIGENEN maximalen Lebens.
  if (cfg.necroPackHealOnDeathPct) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro043',
      fn: (st, gh) => {
        for (const other of st.ghosts) {
          if (!other.alive || other === gh) continue;
          other.hp = Math.min(other.cfg.maxHp, other.hp + other.cfg.maxHp * cfg.necroPackHealOnDeathPct);
        }
      },
    });
  }

  // ghost_051 "Erbmunition": stirbt ein Untertan, bekommen alle UEBERLEBENDEN
  // eine "naechste 5 Schuesse"-Ladung (g.legionBulletBuffs, konsumiert in
  // ghost.js: updateGhosts()).
  if (cfg.necroErbmunitionShots) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro051',
      fn: (st, gh) => {
        for (const other of st.ghosts) {
          if (!other.alive || other === gh) continue;
          other.legionBulletBuffs = other.legionBulletBuffs || [];
          other.legionBulletBuffs.push({
            shotsLeft: cfg.necroErbmunitionShots,
            damageMult: 1 + (cfg.necroErbmunitionDamagePct || 0),
          });
        }
      },
    });
  }

  // ghost_059 "Grabfeld": merkt sich die letzten 3 Sterbeorte VON
  // UNTERTANEN -- FIFO, kein reset() noetig (state ist pro Raum frisch).
  // ghost.js: createGhost() liest state.necroGraveyardSpots beim Spawnen.
  if (cfg.necroGraveyardBonus) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro059',
      fn: (st, gh) => {
        if (!gh) return;
        st.necroGraveyardSpots.push({ x: gh.x, y: gh.y });
        if (st.necroGraveyardSpots.length > (cfg.necroGraveyardCount || 3)) st.necroGraveyardSpots.shift();
      },
    });
  }

  // ---- Nekromant-V2 Phase 9 (Hybride und Aktivkarten, 20 Karten) ----------
  // ghost_086 "Totenmarsch": Geistertod (Schaden/Ablauf -- Auftrag nennt
  // ausdruecklich "Ablauf der Lebenszeit loest aus, Verschmelzung nicht",
  // deshalb DEATH_REASONS statt der volleren countsAsGhostDeath-Liste, die
  // auch 'sacrifice' einschliesst -- 'sacrifice' zaehlt hier bewusst NICHT
  // separat aus, s. u.) gibt dem Hauptpanzer UND allen ueberlebenden
  // Untertanen einen zeitlich befristeten Schadensbonus. Der Spieler-Anteil
  // laeuft ueber einen eigenen Timed-Stack (necroDamagePct() liest ihn unten
  // mit), der Untertanen-Anteil direkt als Feld auf jedem lebenden Geist
  // (KEIN generischer Timed-Stack -- Geister haben keinen eigenen Speicher
  // dafuer, Muster wie legionBulletBuffs).
  if (cfg.necroHybridDeathPlayerDmgPct) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro086',
      fn: (st) => {
        addNecroTimedStack(st, '_timedHybridDeathDmg', cfg.necroHybridDeathPlayerDmgPct, cfg.necroHybridDeathBuffDurationS);
        for (const g of st.ghosts) {
          if (!g.alive) continue;
          g.hybridBuffPct = cfg.necroHybridDeathGhostDmgPct;
          g.hybridBuffUntil = st.time + cfg.necroHybridDeathBuffDurationS;
        }
      },
    });
  }

  // ghost_087 "Erben der Front": ein sterbender Untertan ueberträgt einen
  // Anteil seiner EIGENEN Basiswerte (nicht des Empfaengers!) an einen
  // ZUFAELLIGEN Ueberlebenden -- bewusst als eigener, direkter Zuwachs auf
  // cfg.maxHp/damage statt ueber ghost.js: applyFusionTransfer() (das
  // rechnet den Zuwachs relativ zum EMPFAENGER-Basiswert, hier soll er aber
  // vom STERBENDEN ausgehen -- zwei verschiedene Bezugsgroessen, deshalb
  // eine eigene, kleine Rechnung statt einer geteilten Funktion mit
  // widerspruechlicher Semantik).
  if (cfg.necroHybridRandomTransferPct) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro087',
      fn: (st, gh) => {
        if (!gh) return;
        const survivors = st.ghosts.filter((g) => g.alive);
        if (survivors.length) {
          const target = survivors[Math.floor(st.rng() * survivors.length)];
          target.cfg.maxHp = Math.round(target.cfg.maxHp + gh.baseMaxHp * cfg.necroHybridRandomTransferPct);
          target.cfg.damage = Math.round(target.cfg.damage + gh.baseDamage * cfg.necroHybridRandomTransferPct);
        }
        // Auftrag Abschnitt 9: kein Schild-Deckel (weiterer, im Kartentext nie
        // erwaehnter versteckter Cap, gefunden bei der Durchsicht auf
        // vergleichbare Faelle).
        if (st.player?.alive && cfg.necroHybridRandomTransferShieldPct) {
          st.player.shield = (st.player.shield || 0) + st.player.cfg.maxHp * cfg.necroHybridRandomTransferShieldPct;
        }
      },
    });
  }

  // ghost_090 "Rueckkehr im Zorn": 25% Chance auf einen Ersatzuntertanen mit
  // reduziertem Basiswert-Anteil -- der Ersatz selbst darf den Effekt nicht
  // erneut ausloesen (isReplacement-Flag, in createGhost() nie gesetzt,
  // ausschliesslich hier).
  if (cfg.necroHybridReplacementChance) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro090',
      fn: (st, gh) => {
        if (!gh || gh.isReplacement) return;
        if (st.rng() >= cfg.necroHybridReplacementChance) return;
        const replacement = st.createReplacementGhost?.(gh, cfg);
        if (replacement) replacement.isReplacement = true;
      },
    });
  }

  // ghost_091 "Lawine der Toten" (keystone): 3 Geistertode innerhalb von 5s
  // -- dieselbe rollierende Fensterlogik wie ghost_034 "Requiem", aber ein
  // EIGENES Zeitstempel-Array (necroAvalancheDeathTimes), damit sich beide
  // Karten bei gleichzeitigem Besitz nicht gegenseitig den Zaehler leeren.
  // WICHTIG: die Abklingzeit darf NICHT ueber das generische l.cooldownS
  // laufen -- das wuerde schon die reine Zaehl-Buchfuehrung des ERSTEN Todes
  // sperren (necroCooldownReady() setzt den Cooldown beim ERSTEN erlaubten
  // Aufruf, bevor ueberhaupt 3 Tode gezaehlt werden konnten -- der 2./3. Tod
  // im 5-s-Fenster kaeme nie mehr durch, weil die Abklingzeit 20s > 5s ist).
  // Deshalb eine eigene, manuelle Abklingzeit (necroAvalancheCooldownUntil),
  // erst gesetzt NACHDEM die Lawine wirklich ausgeloest hat -- Muster wie
  // ghost_054s necroCoreCooldownUntil.
  if (cfg.necroKeystoneAvalancheWindowS) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro091',
      fn: (st) => {
        if (st.time < (st.necroAvalancheCooldownUntil || 0)) return;
        st.necroAvalancheDeathTimes = (st.necroAvalancheDeathTimes || []).filter(
          (t) => st.time - t <= cfg.necroKeystoneAvalancheWindowS,
        );
        st.necroAvalancheDeathTimes.push(st.time);
        if (st.necroAvalancheDeathTimes.length < cfg.necroKeystoneAvalancheCount) return;
        st.necroAvalancheDeathTimes = [];
        st.necroAvalancheCooldownUntil = st.time + (cfg.necroKeystoneAvalancheCooldownS || 0);
        addNecroTimedStack(st, '_timedHybridAvalancheDmg', cfg.necroKeystoneAvalancheDmgPct, cfg.necroKeystoneAvalancheDurationS);
        addNecroTimedStack(st, '_timedHybridAvalancheFR', cfg.necroKeystoneAvalancheFRPct, cfg.necroKeystoneAvalancheDurationS);
        st.spawnFreeGhosts?.(cfg.necroKeystoneAvalancheSpawn, cfg.necroKeystoneAvalancheStatPct);
      },
    });
  }

  // ghost_097 "Thron aus Gebein" (keystone): JEDER Geistertod UND JEDE
  // Verschmelzung (Auftrag: "Jeder Geistertod und jede Verschmelzung") --
  // die EINZIGE Karte dieser Phase mit 'fusion' in ihren eigenen reasons,
  // moeglich weil der generische Dispatcher jeden Listener unabhaengig
  // filtert (die automatische _deaths-Buchfuehrung bleibt trotzdem fusion-
  // frei, s. countsAsGhostDeath()). Auftrag Abschnitt 9: WEDER der
  // Schadensstapel NOCH der Schild-Zuwachs sind noch gedeckelt -- der alte
  // Schild-Deckel bei genau 1x maxHp war zudem im Kartentext nie erwaehnt
  // ("versteckte Obergrenze").
  if (cfg.necroKeystoneThroneDmgPct) {
    L.push({
      reasons: [...DEATH_REASONS, 'fusion'], scope: 'room', key: 'necro097',
      fn: (st) => {
        addNecroStack(st, 'room', '_hybridThroneDmg', cfg.necroKeystoneThroneDmgPct);
        if (st.player?.alive) {
          st.player.shield = (st.player.shield || 0) + st.player.cfg.maxHp * cfg.necroKeystoneThroneShieldPct;
        }
      },
    });
  }

  // ghost_099 "Kroenungszug": stirbt ein ANDERER Untertan, wird die HAELFTE
  // des aktuellen Champion-Bonus (5% je zu diesem Zeitpunkt noch lebendem
  // ANDEREN Untertan) dauerhaft (bis Raumende) -- raumweit statt an eine
  // Geist-Instanz gebunden, weil der Bonus die Kroenung ueberdauern soll,
  // auch wenn ein anderer Untertan spaeter Champion wird.
  if (cfg.necroCrownProcPerAllyPct && cfg.necroCrownProcHalfPermanent) {
    L.push({
      reasons: DEATH_REASONS, scope: 'room', key: 'necro099',
      fn: (st) => {
        const aliveOthers = st.ghosts.filter((g) => g.alive).length;
        const currentBonus = cfg.necroCrownProcPerAllyPct * aliveOthers;
        st.necroCoronationPermDmgPct = (st.necroCoronationPermDmgPct || 0) + currentBonus * 0.5;
      },
    });
  }

  // ghost_104 "Kreislauf der Verdammten" (keystone, Dreifach-Hybrid): JEDER
  // Geistertod UND JEDE Verschmelzung zaehlen auf einen eigenen Schwellenwert
  // -- eigener Stapel-Schluessel (necro104), damit er nicht mit dem
  // allgemeinen '_deaths' (das ausdruecklich KEINE Verschmelzungen zaehlt)
  // kollidiert.
  if (cfg.necroKeystoneCircleThreshold) {
    L.push({
      reasons: [...DEATH_REASONS, 'fusion'], scope: 'room', key: 'necro104',
      fn: (st) => {
        const before = getNecroStack(st, 'room', '_circleCount');
        addNecroStack(st, 'room', '_circleCount', 1);
        const after = before + 1;
        const n = countThresholdCrossings(before, after, cfg.necroKeystoneCircleThreshold);
        if (n <= 0) return;
        st.necroCircleGuaranteedRevive = true;
        st.necroCircleReviveStatPct = cfg.necroKeystoneCircleReviveStatPct;
        addNecroTimedStack(st, '_timedHybridCircleDmg', cfg.necroKeystoneCircleDmgPct, cfg.necroKeystoneCircleDurationS);
      },
    });
  }
}

// Baseline-Schaden EINES Untertanen desselben Quelltyps OHNE jede
// ghost*-Karte -- fuer ghost_021s "120% des Basisschadens"-Vergleich.
// Duplikatiert bewusst nur die kleine baseStatPct-Rechnung aus
// ghost.js: resolveGhostCfg() (kein Reexport noetig, um keinen Zirkelimport
// necro.js<->ghost.js zu riskieren -- ghost.js importiert bereits
// onGhostRemoved aus necro.js).
function resolveGhostBaselineDamage(state, sourceType) {
  const base = state.data.types?.[sourceType || 'player'];
  if (!base) return 0;
  const pct = state.data.balance?.ghost?.baseStatPct ?? 0.5;
  return Math.round((base.damage ?? 1) * pct);
}

// Summe aller "Prozent-Schaden"-Quellen am Ort der Verwendung (tank.js:
// fireBullet()) -- raumweiter reiner Stapel (011) + alle bekannten
// zeitlich befristeten Quellen (021/034). Bewusst eine feste, kleine
// Aufzaehlung statt eines gemeinsamen Schluessels (s. Kopfkommentar Datei:
// verschiedene Karten duerfen sich nicht gegenseitig ueberschreiben).
// Nekromant-V2 Phase 9: fuenf weitere zeitlich befristete Quellen
// (086/091/095/096/104/105 -- Gadget-Buffs UND Hybrid-/Keystone-Karten
// teilen sich dieselbe kleine, feste Aufzaehlung, kein neuer Mechanismus).
//
// Codedurchsicht (Phase B, kleinere Funde): '_timedSoulbondBuff'
// (ghost_095) und '_timedHybridChampSacrificeDmg'/'-FR'/'-Resist'
// (ghost_096) sind seit dem Champion-/Nekromant-Nachschliff v2 tote
// Schluessel -- beide Karten wurden auf einen direkten, dauerhaften
// cfg-Zuschlag umgebaut (cfg.necroSoulbondPct bzw. tank.js: useGadget()s
// ghost_096-Zweig), OHNE dass die alten Getter hier entfernt wurden. Ein
// eigenes Skript hat jeden getNecroTimedStack()/getNecroStack()-Schluessel
// in necro.js gegen jede addNecroTimedStack()/addNecroStack()-Schreibstelle
// im ganzen src/game-Verzeichnis abgeglichen -- diese drei waren die
// einzigen echten Funde (niemand schreibt sie je), jetzt entfernt. Ergaenzend
// die zwei nie gelesenen cfg-Felder necroSoulbondBuffPct/-DurationS in
// cfg.js entfernt. Reine Aufraeumarbeit, keine Verhaltensaenderung -- beide
// Getter lieferten ohnehin immer 0.
export function necroDamagePct(state) {
  return (
    getNecroStack(state, 'room', '_pctDamage') +
    getNecroStack(state, 'room', '_hybridThroneDmg') +
    // ghost_021 "Erbschaft des Starken" (Nachschliff Abschnitt 10): jetzt ein
    // dauerhafter, raumweiter Stapel statt eines 10-Sekunden-Zeitfensters.
    getNecroStack(state, 'room', '_roomDmgErbschaft') +
    getNecroTimedStack(state, '_timedRequiemDmg') +
    getNecroTimedStack(state, '_timedHybridDeathDmg') +
    getNecroTimedStack(state, '_timedHybridAvalancheDmg') +
    getNecroTimedStack(state, '_timedHybridCircleDmg') +
    getNecroTimedStack(state, '_timedHybridSacrificeDmg') +
    getNecroTimedStack(state, '_timedAncestorDmg') +
    // ghost_088 "Blutige Formation": +X% je AKTIVEM Untertan -- LIVE aus dem
    // Legion-Cache (Phase 7, "nicht pro Frame") gelesen statt eines eigenen
    // Timed-Stacks, weil der Wert sich automatisch mit der Anzahl aendert.
    (state.player?.cfg?.necroHybridPerAllyDmgPct || 0) * (state.necroActiveGhostCount || 0)
    // ghost_099s state.necroCoronationPermDmgPct wirkt NICHT hier, sondern
    // ausschliesslich auf den CHAMPION (ghost.js: updateGhosts()) -- der
    // Kartentext sagt "Der Champion erhaelt...", nicht der Hauptpanzer.
  );
}
export function necroFireRatePct(state) {
  return (
    getNecroStack(state, 'room', '_pctFireRate') +
    getNecroTimedStack(state, '_timedFireRateFuel') +
    getNecroTimedStack(state, '_timedRequiemFireRate') +
    getNecroTimedStack(state, '_timedHybridAvalancheFR') +
    getNecroTimedStack(state, '_timedHybridSacrificeFR') +
    getNecroTimedStack(state, '_timedAncestorFR')
  );
}
export function necroSpeedPct(state) {
  return getNecroStack(state, 'room', '_pctSpeed') + getNecroTimedStack(state, '_timedRequiemSpeed');
}
export function necroResistBonus(state) {
  // ghost_022 "Haerte aus Verlust" (Nachschliff Abschnitt 10): jetzt ein
  // dauerhafter, raumweiter Stapel statt eines 10-Sekunden-Zeitfensters.
  return getNecroStack(state, 'room', '_roomResistHaerte');
}

// Wandelt eine (potenziell unbegrenzt grosse) Feuerraten-Prozentbonus-Summe
// in einen Nachladezeit-Faktor um, OHNE eine kuenstliche Obergrenze (Auftrag
// Abschnitt 9: die alte Formel Math.max(0.1, 1 - pct) deckelte die Feuerrate
// auf hoechstens 10x -- verboten). `cooldown = basis / (1 + pct)` naehert
// sich bei wachsendem pct asymptotisch 0 an, wird aber nie negativ oder Null
// (division-by-zero-sicher fuer jedes endliche pct >= 0) -- "mathematisch
// stabil, unbegrenzt skalierend". Ein negativer pct (aktuell nirgends im
// Kartenpool erzeugbar) wird defensiv auf 0 geklemmt, NICHT als weitere
// Obergrenze auf positive Werte gedacht, sondern ausschliesslich um
// (basis/(1+negativ)) nie <= 0 werden zu lassen.
export function fireRateFactor(pct) {
  const p = Math.max(0, pct || 0);
  return 1 / (1 + p);
}
