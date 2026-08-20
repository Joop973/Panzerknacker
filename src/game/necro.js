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

export const NECRO_REASONS = ['death_damage', 'death_expire', 'fusion', 'sacrifice'];

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
// cooldownS?, fn(state, ghost, reason) }. Kein Eintrag existiert bislang --
// Phase 6+ traegt sie beim Roomaufbau aus den core-Feldern besessener Karten
// ein (Anschlusspunkt, noch nicht gebaut). onGhostRemoved() selbst prueft
// NIE eine Karten-ID, nur die deklarierten Felder.
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

  for (const l of state.necroListeners) {
    if (!l.reasons.includes(reason)) continue;
    if (!necroCooldownReady(state, l.key, l.cooldownS)) continue;
    l.fn(state, ghost, reason);
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
// Nur scope:'room'-Listener, die auf 'death_damage' oder 'death_expire'
// hoeren, werden aufgerufen -- run-/timed-scope-Listener (die faellt
// implizit unter "keine Zaehler/Abklingzeiten") bleiben unberuehrt.
export function applyVirtualNecroDeaths(state, count) {
  for (let i = 0; i < count; i++) {
    for (const l of state.necroListeners) {
      if (l.scope !== 'room') continue;
      if (!l.reasons.includes('death_damage') && !l.reasons.includes('death_expire')) continue;
      l.fn(state, null, 'death_damage');
    }
  }
}
