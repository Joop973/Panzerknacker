// Schadenstypen (UMBAUPLAN-LP Phase 6).
//
// Jedes Geschoss und jede Explosion traegt ein `damageType`. Standard ist
// `physical`; die anderen fuenf setzen spaeter Klassen (Phase 9) und Karten
// (Phasen 11-16). In Phase 6 selbst haengt noch keine Karte daran -- nur die
// Durchreichung und die Debugtaste 4.
//
// Namensentscheidung: der Plan schreibt in seinem Beispiel `"feuer"`, hier
// stehen aber englische ids (`fire`). Grund: die Statuseffekt-ids aus Phase 5
// sind bereits englisch (wie alle ids im Projekt -- `t_brown`, `emp_mine`,
// `hook`), und weil damageType-id und Statuseffekt-id damit IDENTISCH sind,
// braucht es gar keine Zuordnungstabelle: ein Treffer schlaegt seinen
// Statuseffekt direkt unter demselben Schluessel nach.

import { circlesOverlap } from './collision.js';

// Wirkt der Typ ueber Zeit? (Statuseffekt, der aufgetragen wird.)
export function statusOf(state, damageType) {
  const def = state.data.status?.damageTypes?.[damageType || 'physical'];
  return def?.status || null;
}

export function typeColor(state, damageType) {
  return state.data.status?.damageTypes?.[damageType || 'physical']?.color || null;
}

// Alles, was NACH dem eigentlichen Trefferschaden aus dem Schadenstyp folgt:
// Statuseffekt auftragen und (beim Blitz) die Kette weiterspringen lassen.
//
// `basisSchaden` ist der Betrag, der beim ersten Ziel angekommen ist --
// die Kettenglieder rechnen davon ihren Anteil ab.
export function applyTypeEffects(state, ziel, damageType, basisSchaden, meta) {
  const typ = damageType || 'physical';
  const def = state.data.status?.damageTypes?.[typ];
  if (!def) return;

  // 1. Statuseffekt (Feuer/Frost/Gift). Der Wandabprall-Bonus aus Phase 4
  // verdoppelt bewusst NUR den Aufschlag, nicht den Brand: die Stufenzahl
  // haengt am Treffer, nicht am Schadensbetrag.
  // Klassen-Passive (Phase 9): der Schuetze (meta.ownerCfg) kann die Dauer
  // (Flammen-/Radioaktiv-Panzer) bzw. die Frost-Verlangsamung (Frostpanzer)
  // verstaerken -- an genau dieser Stelle in die applyStatus-Optionen gefaltet.
  if (def.status) {
    const eff = state.data.status.effects?.[def.status];
    const oc = meta?.ownerCfg;
    // Dauer: elementspezifisches Klassen-Passiv (Phase 9) MAL generischer
    // Karten-Multiplikator (Phase 13, gilt fuer den Status des eigenen
    // Elements). tickDamageMult/maxStacksBonus/stackBonus kommen ebenfalls aus
    // den Topf-Karten (generisch benannt, weil die Klasse nur EIN Element
    // schiesst -- der Boost trifft also immer den passenden Status).
    let durationMult = oc?.statusDurationMult ?? 1;
    if (def.status === 'fire') durationMult *= oc?.fireDurationMult ?? 1;
    else if (def.status === 'poison') durationMult *= oc?.poisonDurationMult ?? 1;
    const opts = {
      durationMult,
      tickDamageMult: oc?.statusTickMult ?? 1,
      maxStacksBonus: oc?.statusMaxStacksBonus ?? 0,
    };
    if (def.status === 'frost' && oc?.frostSlowBonus) {
      // "Verlangsamung +20 %": die Verlangsamung (1 - speedMult) waechst um den
      // Bonus, nicht der Multiplikator selbst. 0.6 -> 1 - (0.4 * 1.2) = 0.52.
      const base = eff?.speedMult ?? 1;
      opts.speedMultOverride = 1 - (1 - base) * (1 + oc.frostSlowBonus);
    }
    const stacks = (eff?.stacksPerHit ?? 1) + (oc?.statusStackBonus ?? 0);
    state.applyStatus?.(ziel, def.status, stacks, opts);
    // Feuer-Ausbreitung (Phase 13): der Treffer entzuendet nahe Gegner mit
    // einer Grundstufe. Kein applyTypeEffects-Aufruf -> keine Rekursion.
    if (def.status === 'fire' && oc?.fireSpreadRadius) {
      const r2 = oc.fireSpreadRadius * oc.fireSpreadRadius;
      for (const t of state.tanks) {
        if (t === ziel || !t.alive || t === state.player || t.protect > 0) continue;
        if ((t.x - ziel.x) ** 2 + (t.y - ziel.y) ** 2 <= r2) state.applyStatus?.(t, 'fire', 1, opts);
      }
    }
  }

  // 2. Blitz-Kette. Sie springt vom ZULETZT getroffenen Panzer weiter (nicht
  // vom Einschlagpunkt), damit der Blitz eine Kette entlanglaeuft statt einen
  // Kreis um den Aufschlag abzuraeumen. Teslapanzer-Passiv (Phase 9):
  // meta.lightningBonus erhoeht die Zielzahl (3 -> 4).
  const maxTargets = (def.maxTargets || 0) + (meta?.lightningBonus || 0);
  if (maxTargets < 2) return;
  const reichweite = def.jumpRangePx ?? 160;
  const falloff = def.falloff ?? 0.7;
  const getroffen = new Set([ziel]);
  let letzter = ziel;
  let schaden = basisSchaden;
  for (let sprung = 1; sprung < maxTargets; sprung++) {
    let naechster = null;
    let best = Infinity;
    for (const t of state.tanks) {
      if (!t.alive || getroffen.has(t) || t.protect > 0) continue;
      const d2 = (t.x - letzter.x) ** 2 + (t.y - letzter.y) ** 2;
      if (d2 < best && d2 <= reichweite * reichweite) {
        best = d2;
        naechster = t;
      }
    }
    if (!naechster) break;
    schaden = Math.max(1, Math.round(schaden * falloff));
    getroffen.add(naechster);
    state.lightningArcs?.push({ x1: letzter.x, y1: letzter.y, x2: naechster.x, y2: naechster.y, age: 0 });
    // Kettenglieder umgehen die Panzerung -- dasselbe Prinzip wie
    // Explosionen (armor.js: "Explosionen ignorieren die Panzerung"). Ein
    // Ueberspringen hat keine Geschossrichtung, gegen die ein Frontsektor
    // sinnvoll pruefbar waere. Der Statuseffekt gilt auch hier nicht: Blitz
    // hat keinen.
    state.applyDamage(naechster, schaden, 'ein Blitzschlag', { ...meta, code: 'lightning' });
    letzter = naechster;
  }
}

// Nur fuer Tests/Debug: alle Panzer im Radius (Kettenreichweite) zaehlen.
export function chainCandidates(state, von, radius) {
  return state.tanks.filter(
    (t) => t !== von && t.alive && circlesOverlap(von.x, von.y, radius, t.x, t.y, t.cfg.radius),
  );
}
