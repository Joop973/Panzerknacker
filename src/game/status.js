// Statuseffekte ueber Zeit (UMBAUPLAN-LP Phase 5).
//
// Ein gemeinsames Regelwerk, gebaut BEVOR es die Elemente gibt -- Feuer,
// Gift und Frost teilen sich denselben Takt, dieselbe Stapel-Logik und
// dieselbe Anzeige. Alle Zahlen stehen in data/status.json.
//
// In dieser Phase haengt bewusst KEINE Quelle daran: kein Geschoss, keine
// Mine und keine Karte tragen einen Status auf. Erreichbar ist das System
// nur ueber state.applyStatus() (Debug/Tests). Phase 6 haengt dann die
// Schadenstypen an.
//
// Zwei Festlegungen, die der Plan nicht ausspricht, die aber entschieden
// werden mussten:
//
// 1. Schaden ueber Zeit umgeht die SCHILDE, nicht nur Panzerung und
//    Prisma. Der Plan nennt nur "Panzerung und Prisma-Regeln" -- die
//    ergeben sich hier von selbst, weil armorBlocks() ausschliesslich in
//    der Geschoss-Trefferschleife geprueft wird und ein Tick dort nie
//    vorbeikommt. Die Schilde liegen dagegen in applyDamage() und wuerden
//    sonst greifen: ein 4-Punkte-Brandtick wuerde eine ganze Schildladung
//    verbrauchen, sechs Ticks also drei Ladungen in anderthalb Sekunden.
//    Ein Schild, der "den naechsten Treffer abfaengt", darf nicht an einem
//    Brandtick verpuffen -- deshalb `overTime: true` im meta-Objekt, das
//    applyDamage() die Abwehr-Gatter ueberspringen laesst.
// 2. Die Boss-Unverwundbarkeit (Reaktorkern mit stehenden Generatoren)
//    gilt weiterhin. Sonst waere das ganze Generator-Raetsel mit einem
//    Brandpfeil umgehbar.

// Effekt auf einen Panzer auftragen. stacks = wie viele Stufen auf einmal.
// Gibt die neue Stufenzahl zurueck (0, wenn der Effekt unbekannt ist).
// opts (UMBAUPLAN-LP Phase 9, Klassen-Passive): durationMult skaliert die
// Effektdauer (Flammen-/Radioaktiv-Panzer), speedMultOverride ersetzt die
// Frost-Verlangsamung dieses Eintrags (Frostpanzer). Beide optional -- ohne
// sie verhaelt sich applyStatus wie vor Phase 9.
export function applyStatus(state, tank, id, stacks = 1, opts = {}) {
  const def = state.data.status?.effects?.[id];
  if (!def || !tank || !tank.alive) return 0;
  tank.status ||= {};
  const vorher = tank.status[id]?.stacks || 0;
  // Phase 13 (Feuer-Topf): Karten koennen den Stufen-Deckel anheben
  // (opts.maxStacksBonus) -- z. B. Hoellenglut 3 -> 5.
  const max = (def.maxStacks ?? 1) + (opts.maxStacksBonus || 0);
  const neu = Math.min(max, vorher + stacks);
  const eintrag =
    tank.status[id] || (tank.status[id] = { stacks: 0, timeLeft: 0, tickElapsed: 0, ticksDone: 0 });
  // Frisch aufgetragen (war aus): Takt-Buchhaltung zuruecksetzen.
  if (vorher <= 0) {
    eintrag.tickElapsed = 0;
    eintrag.ticksDone = 0;
  }
  eintrag.stacks = neu;
  // Die Dauer erneuert sich bei jedem Auftragen -- auch dann, wenn die
  // Stufe schon am Deckel steht ("bleibt bei 3 Stufen, Dauer startet neu").
  // Die TAKT-Buchhaltung wird dabei bewusst NICHT zurueckgesetzt: sonst
  // koennte eine schnell feuernde Quelle den Tick endlos hinausschieben
  // und der Effekt wuerde nie Schaden machen.
  eintrag.timeLeft = def.durationS * (opts.durationMult ?? 1);
  // Phase 9: eine staerkere Frost-Verlangsamung wird am Eintrag gemerkt (der
  // def-Wert bleibt unangetastet -- gilt also nur fuer diese Quelle).
  if (opts.speedMultOverride != null) eintrag.speedMult = opts.speedMultOverride;
  // Phase 13: ein Tickschaden-Multiplikator der Quelle (Brandbeschleuniger o.
  // ae.) wird ebenfalls am Eintrag gemerkt und in updateStatus verrechnet.
  if (opts.tickDamageMult != null) eintrag.tickDamageMult = opts.tickDamageMult;

  // Frost-Erstarrung: NUR beim Uebergang unter den Deckel -> auf den
  // Deckel. Wuerde sie bei jedem Auftragen auf voller Stufe erneut
  // ausloesen, waere ein Gegner mit einer Frostquelle dauerhaft
  // handlungsunfaehig (Dauer-Stunlock).
  if (def.freezeAtStacks && vorher < def.freezeAtStacks && neu >= def.freezeAtStacks) {
    tank.stunTimer = Math.max(tank.stunTimer || 0, def.freezeS || 0);
  }
  return neu;
}

// Alle Effekte eines Panzers entfernen (Raumwechsel/Respawn laufen ueber
// createTank() und bekommen ohnehin ein frisches Objekt -- diese Funktion
// ist fuer Tests und kuenftige "Reinigungs"-Effekte).
export function clearStatus(tank) {
  tank.status = {};
}

// Tempo-Multiplikator aus den aktiven Effekten (aktuell nur Frost).
// Multiplikativ verrechnet, damit spaetere Effekte sich sauber einreihen.
export function statusSpeedMult(state, tank) {
  const eff = tank.status;
  if (!eff) return 1;
  let m = 1;
  for (const id of Object.keys(eff)) {
    if (eff[id].stacks <= 0) continue;
    const def = state.data.status?.effects?.[id];
    // Phase 9: ein am Eintrag gemerkter speedMult (staerkere Frost-Quelle)
    // hat Vorrang vor dem def-Standardwert.
    const sm = eff[id].speedMult ?? def?.speedMult;
    if (sm) m *= sm;
  }
  return m;
}

// Sind ueberhaupt Effekte aktiv? (Renderer/Tests, spart das Objekt-Scannen.)
export function hasStatus(tank) {
  const eff = tank.status;
  if (!eff) return false;
  for (const id of Object.keys(eff)) if (eff[id].stacks > 0) return true;
  return false;
}

// Ein Physikschritt fuer alle Panzer.
export function updateStatus(state, dt) {
  const cfg = state.data.status;
  if (!cfg) return;
  const tickS = cfg.tickS ?? 0.5;
  for (const t of state.tanks) {
    if (!t.alive || !t.status) continue;
    for (const id of Object.keys(t.status)) {
      const e = t.status[id];
      if (e.stacks <= 0) continue;
      const def = cfg.effects[id];
      if (!def) {
        e.stacks = 0;
        continue;
      }
      e.timeLeft -= dt;
      e.tickElapsed += dt;
      // Ticks werden GEZAEHLT, nicht heruntergezaehlt: `ticksDone` gegen
      // floor(tickElapsed / tickS). Zwei unabhaengige Countdowns (Takt und
      // Restdauer) driften bei 1/60-Schritten gegeneinander -- gemessen fiel
      // der erste Tick dadurch einen Frame zu spaet und der letzte hinter das
      // Dauerende. Mit einem Zaehler sind es bei 3 s Dauer und 0,5 s Takt
      // IMMER exakt 6 Ticks, unabhaengig von Bildrate und (Trickshot-)
      // Zeitlupe. Dasselbe Muster nutzt der Minen-Warnpuls (Phase 7b) aus
      // genau diesem Grund.
      const faellig = Math.floor(e.tickElapsed / tickS);
      if (faellig > e.ticksDone) {
        const n = faellig - e.ticksDone;
        e.ticksDone = faellig;
        const dmg = (def.damagePerTick || 0) * e.stacks * n * (e.tickDamageMult ?? 1);
        if (dmg > 0 && t.alive) {
          // overTime: applyDamage ueberspringt die Schild-Gatter (siehe
          // Kopfkommentar), die Boss-Unverwundbarkeit gilt weiter.
          state.applyDamage(t, dmg, `${def.name}schaden`, { code: 'status', status: id, overTime: true });
        }
      }
      if (e.timeLeft <= 0) {
        e.stacks = 0;
        e.timeLeft = 0;
        e.tickElapsed = 0;
        e.ticksDone = 0;
      }
    }
  }
}

// Die anzuzeigenden Effekte in Reihenfolge: nach Stufen absteigend, bei
// Gleichstand in der Reihenfolge aus status.json. Auf maxIcons gekuerzt --
// "bei mehr wird das dominante angezeigt".
export function visibleStatus(state, tank) {
  const cfg = state.data.status;
  if (!cfg || !tank.status) return [];
  const reihenfolge = Object.keys(cfg.effects);
  const aktiv = reihenfolge
    .filter((id) => (tank.status[id]?.stacks || 0) > 0)
    .map((id) => ({ id, stacks: tank.status[id].stacks, def: cfg.effects[id] }));
  aktiv.sort((a, b) => b.stacks - a.stacks || reihenfolge.indexOf(a.id) - reihenfolge.indexOf(b.id));
  return aktiv.slice(0, cfg.maxIcons ?? 3);
}
