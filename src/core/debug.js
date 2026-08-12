// Debug-Flags (PLAN-STARTMENU Phase 1).
//
// EINE Quelle fuer alle Entwickler-Schalter, gelesen aus den URL-Parametern.
// Bewusst keine data/debug.json: die Flags sollen pro Aufruf (Link) gesetzt
// werden, nicht dauerhaft im Repo stehen -- ohne ?debug=1 ist alles aus
// (PLAN-STARTMENU Phase 14, Testschritt 5).
//
//   ?debug=1            Debug-Modus an (Grundschalter, wie bisher)
//   &skipToRun          Menue ueberspringen, direkt in einen Run
//   &unlockAll          alle Klassen freigeschaltet (Phase 2)
//   &codexRevealAll     alle Codex-Eintraege als gesehen zeigen (Phase 7)
//
// Die einzelnen Flags wirken nur bei gesetztem ?debug=1 -- ein blosses
// ?skipToRun ohne debug tut nichts, damit ein versehentlicher Link in der
// Veroeffentlichung nichts freischaltet.

// Phase 14: der Default liest die URL defensiv. `typeof window !== 'undefined'`
// allein reichte NICHT -- der Test-DOM (tests/domstub.mjs) definiert ein
// window OHNE location, `window.location.search` warf dort also. Aufgefallen,
// als input.js/telemetry.js in Phase 14 auf diese eine Quelle umgestellt
// wurden (telemetry.js hatte vorher einen eigenen try/catch, der genau das
// abfing).
export function readDebugFlags(search = (typeof window !== 'undefined' ? window?.location?.search : '')) {
  const p = new URLSearchParams(search || '');
  const on = p.get('debug') === '1';
  const has = (name) => on && p.has(name);
  return Object.freeze({
    on,
    skipToRun: has('skipToRun'),
    unlockAll: has('unlockAll'),
    codexRevealAll: has('codexRevealAll'),
  });
}

// Zur Laufzeit einmal gelesener, eingefrorener Zustand.
export const DEBUG = readDebugFlags();
