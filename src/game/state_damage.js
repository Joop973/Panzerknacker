// Schadens-/Todeslogik des Spielzustands: aus state.js ausgelagert
// (AUFTRAG-FERTIGSTELLUNG Phase A2), damit die Datei unter der
// ~300-Zeilen-Konvention bleibt (dieses Modul selbst bleibt darueber --
// `killTank()` allein ist ~290 Zeilen; eine weitere Aufteilung ist eine
// spaetere, eigene Phase, kein Teil dieses Refactorings). `createDamageMethods()`
// liefert die Methoden, die createState() in den fertigen `state` mischt
// (Object.assign) -- jede Methode liest ausschliesslich `state.*`, keine
// Closure auf ein createState()-internes Local.

import { RESPAWN_DELAY } from '../config.js';
import { createBullet } from './bullet.js';
import { explodeAt } from './mine.js';
import { createGhost, killGhost, occupiedGhostSlots, recomputeLegionCache, pushGhost } from './ghost.js';
import { getNecroStack, necroResistBonus } from './necro.js';
import { circlesOverlap } from './collision.js';
import { isBossCfg } from './cfg.js';

// Truemmerfarben fuer Partikel (Politur, Phase 10).
const DEBRIS_COLORS = {
  player: '#3d8ef0',
  t_armored: '#7d8794',
  t_brown: '#8a5a33',
  t_grey: '#9aa0a8',
  t_teal: '#3aa8a0',
  t_yellow: '#d4c23a',
  t_pink: '#d47ba6',
  t_green: '#5a9e4a',
  t_purple: '#8a5ad4',
  t_white: '#e8e8e8',
  t_black: '#33333c',
  t_reactor: '#e0a83c',
  t_mirror: '#8fd8ee',
  t_phalanx: '#9aa6b4',
  t_spider: '#8a6ad8',
  t_anvil: '#c9a03c',
};

// Nekromant-V2 Phase 2: Schadensresistenz + Schild-Punktepool als
// eigenstaendige Funktionen -- gebraucht sowohl von applyDamage() (Spieler/
// Gegner in state.tanks) als auch von der GETRENNTEN Geister-Kollisions-
// schleife (Untertanen sind bewusst NICHT in state.tanks, s. Kopfkommentar
// dort). `entityCfg`/`entity` passen auf Panzer UND Geister gleichermassen
// (beide tragen `.cfg.resist` bzw. `.shield`/`.x`/`.y`).
//
// Rechenweg (Auftrag Abschnitt 4a): additiv gesammelte Punkte, NIE eine
// Obergrenze, NIE null -- genommenerSchaden = Schaden / (1 + resistSumme/
// divisor). Ein Math.min(..., 0.6)-Clamp waere genau der versteckte Deckel,
// den der Auftrag ausdruecklich verbietet.
// Exportiert -- state.js: stepState() nutzt sie ebenfalls direkt (die
// "Gegner-Geschosse gegen Geister"-Kollisionsschleife rechnet Resistenz/
// Schildpool fuer Champion-Schadensumleitung/-weiterleitung ausserhalb von
// applyDamage()).
export function applyResistToAmount(entityCfg, resistBalance, amount) {
  if (!entityCfg.resist) return amount ?? 1;
  const divisor = resistBalance?.divisor ?? 100;
  // Math.max(1, ...): die Formel naehert sich 0 nur an, wird aber durch das
  // Runden bei astronomisch hohen Resistenzsummen sonst tatsaechlich 0 --
  // "nie null" (Auftrag Abschnitt 4a) gilt woertlich, ein Treffer bleibt
  // also IMMER mindestens 1 Punkt wert, egal wie hoch resist steigt.
  return Math.max(1, Math.round((amount ?? 1) / (1 + entityCfg.resist / divisor)));
}

// Schild als Punktepool: faengt Schaden VOR hp ab, bis zu 0, Rest faellt
// durch. NICHT zu verwechseln mit state.shieldCharges (Notschild, blockt
// einen GANZEN Treffer) oder tank.shieldHp/shieldReady (der AELTERE,
// nur-Spieler-Absorber der schild-Karte, UMBAUPLAN-LP Phase 8) -- alle drei
// bleiben nebeneinander bestehen und sind im HUD getrennt sichtbar.
// Exportiert -- state.js: stepState() nutzt sie ebenfalls direkt (s.
// applyResistToAmount() oben).
export function absorbWithShieldPool(state, entity, amount) {
  const have = entity.shield || 0;
  if (have <= 0) return amount ?? 1;
  const absorbed = Math.min(have, amount ?? 1);
  entity.shield -= absorbed;
  state.sounds.push({ name: 'shield', x: entity.x });
  state.spawnParticles(entity.x, entity.y, '#7fe6c8', 8, 110);
  return (amount ?? 1) - absorbed;
}

// Spinnenboss (Spinnenboss-Auftrag Abschnitt 11): der Koerper darf VOR der
// letzten Phase nicht vollstaendig sterben. Klemmt hp auf mindestens
// phase3ProtectHpPct * maxHp, SOLANGE noch mindestens ein Bein lebt --
// sobald das letzte Bein faellt, entfaellt die Klammer ersatzlos (Abschnitt
// 10, Punkt 10: "wird wieder geschuetzt, SOFERN NOCH BEINE VORHANDEN SIND").
// Reine Phasen-/Ablauflogik fuer GENAU diesen einen Bosstyp -- keine
// Obergrenze fuer irgendein Spieler-Upgrade (Abschnitt 7: "keine versteckte
// automatische Anpassung ... starke Builds duerfen weiterhin spuerbar
// staerker sein" bleibt unberuehrt, die Klemme wirkt nur auf den BOSS).
function applySpiderFloor(state, tank) {
  if (!tank.cfg.spiderBoss || !(tank.spiderLegsAlive > 0)) return;
  const pct = state.data.balance?.boss?.spider?.phase3ProtectHpPct ?? 0.3;
  const floor = tank.cfg.maxHp * pct;
  if (tank.hp < floor) tank.hp = floor;
}

// BUGFIX (Code-Review): der EINE gemeinsame Ausgang fuer jeden Schaden, der
// die hp wirklich erreicht -- vorher hatten der DOT-Zweig, der Spieler-
// Schild-Punktepool-Zweig UND der normale Fallthrough in applyDamage() je
// eine EIGENE Kopie von "hp abziehen, Bodenklammer, ggf. killTank()".
// ghost_025 "Letzte Deckung" (necroLastStand) war dabei nur im Fallthrough
// verdrahtet: ein toedlicher Treffer, der zuerst durch den Schild-Punktepool
// lief (jeder Treffer mit aktivem Spieler-Schild, sobald der Absorber nicht
// mehr reicht) oder ein toedlicher Statuseffekt-Tick riefen killTank() DIREKT
// auf und liessen die Karte nie eine Rettungschance bekommen -- ein Schild
// machte den Nekromanten dadurch VERWUNDBARER als ganz ohne Schild. Jetzt
// gibt es nur noch diese eine Stelle, die ueber Rettung/Tod entscheidet;
// alle drei Aufrufer reichen nur noch den (ggf. schon durch Resistenz/Schild
// reduzierten) Restschaden durch.
function resolveLethalHit(state, tank, amount, cause, meta) {
  if (
    tank === state.player &&
    tank.cfg.necroLastStand &&
    !state.necroLastStandUsed &&
    (amount ?? 1) >= tank.hp &&
    state.ghosts.some((g) => g.alive)
  ) {
    let weakest = null;
    for (const g of state.ghosts) {
      if (g.alive && (!weakest || g.hp < weakest.hp)) weakest = g;
    }
    if (weakest) {
      state.necroLastStandUsed = true;
      weakest.alive = false;
      tank.hp = Math.min(tank.cfg.maxHp, tank.hp + tank.cfg.maxHp * (tank.cfg.necroLastStandHealPct || 0));
      state.sounds.push({ name: 'shield', x: tank.x });
      state.spawnParticles(tank.x, tank.y, '#c9a6ff', 12, 130);
      return;
    }
  }
  tank.hp -= amount ?? 1;
  applySpiderFloor(state, tank);
  // Exekutionsschwelle (Grundsteinumbau Phase 2): war das Ziel VOR diesem
  // Treffer schon im Exekutionszustand (t.executing, s. stepState()-Timer-
  // Schleife), toetet dieser Treffer garantiert -- unabhaengig davon, ob der
  // Abzug allein hp<=0 gebracht haette.
  if (tank.hp > 0 && !tank.executing) return;
  state.killTank(tank, cause, meta);
}

// Nekromant-V2 Phase 3: Wiederbelebungs-Anzahl fuer EINEN Kill, "Rechenweg
// statt Obergrenze" (Auftrag Abschnitt 4a) -- derselbe Ganzzahl-plus-Rest-
// Mechanismus wie bei anderen ueberlauffaehigen Chancen (Krit, Phase 7):
// der ganzzahlige Anteil erzeugt GARANTIERTE Zusatz-Untertanen (bei chance
// 1.4 also sicher einen, plus 40 % Chance auf einen zweiten), der Rest bleibt
// eine reine Wahrscheinlichkeit. Bei chance <= 0 immer 0, bei chance < 1 wie
// bisher ein einzelner Wurf -- keine Verhaltensaenderung im aktuell
// erreichbaren Wertebereich (0,35), nur der Mechanismus selbst kennt keinen
// Deckel.
function rollGhostSpawnCount(chance, rng) {
  if (!(chance > 0)) return 0;
  const guaranteed = Math.floor(chance);
  const remainder = chance - guaranteed;
  return guaranteed + (remainder > 0 && rng() < remainder ? 1 : 0);
}

// Feuert count Kugeln gleichmaessig im Kreis (Schrapnell/Konterschild).
// Exportiert -- state.js: stepState() nutzt sie ebenfalls (Schrapnell-Effekt).
export function spawnRadialBullets(state, owner, x, y, count, speed) {
  const sp = speed || owner.cfg.schrapnellSpeed || 150;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    state.bullets.push(
      createBullet(x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, {
        speed: sp,
        radius: state.data.physics.bulletRadius,
        owner,
        kind: 'bullet',
        friendly: true, // Splitter/Kranz treffen den Leger nie
        damage: owner?.cfg?.damage,
        damageType: owner?.cfg?.damageType,
      }),
    );
  }
}

// Faktory statt Objektliteral-Methoden direkt in createState() -- `state`
// ist zum Aufrufzeitpunkt jeder Methode bereits vollstaendig konstruiert.
export function createDamageMethods(state) {
  return {
    // Schaden zufuegen (UMBAUPLAN-LP Phase 1). Hier sitzt alles, was einen
    // Treffer ABWEHREN kann (Unverwundbarkeit, Schilde) -- danach wird
    // abgezogen und erst bei hp <= 0 die Todeslogik in killTank() gerufen.
    //
    // Warum die Abwehr-Gatter hierher und nicht in killTank() gehoeren:
    // Sie verhindern SCHADEN, nicht den Tod. Solange maxHp und damage
    // ueberall 1 sind, ist das exakt dasselbe Verhalten wie vorher (jeder
    // Treffer ist toedlich, also faengt ein Schild zwangslaeufig einen
    // toedlichen Treffer ab). Mit echten Lebenspunkten ab Phase 2/3 waere
    // die alte Platzierung dagegen falsch: ein Schild, das nur bei
    // toedlichen Treffern greift, waere eine zweite Lebensleiste.
    //
    // killTank() bleibt daneben als eigener, direkt aufrufbarer Trichter
    // fuer den Tod bestehen -- Kettenreaktionen, Statistik, Telemetrie und
    // Geisterpanzer haengen daran und bleiben unangetastet.
    applyDamage(tank, amount, cause, meta) {
      // Reaktorkern (Phase 14): unverwundbar, solange mindestens ein
      // Generator steht -- keine Ladung, kein Verbrauch, verfaellt nie von
      // selbst. Reiner Feedback-Ablehner wie die Schildladungen unten.
      // Gilt AUCH fuer Schaden ueber Zeit (Phase 5): sonst waere das
      // Generator-Raetsel mit einem Brandpfeil umgehbar.
      if (tank.cfg.bossInvincible && state.bossGeneratorsLeft > 0) {
        // Phase 7b: derselbe "Treffer wirkungslos abgewehrt"-Ton wie bei der
        // Panzerung -- nicht der Schildverlust-Ton, hier geht ja nichts verloren.
        state.sounds.push({ name: 'reflect', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#ffd23c', 6, 80);
        return;
      }
      // Spinnenboss (Abschnitt 10/26): der Koerper ist geschuetzt, solange
      // noch mindestens ein Bein lebt UND kein Bein-Verlust-Betaeubungsfenster
      // laeuft (tank.spiderVulnerableTimer) -- EIN Gatter deckt JEDE
      // Schadensquelle ab (Kugel, Explosion, Statuseffekt-Tick), statt es an
      // jeder Aufrufstelle einzeln nachzubauen. meta.code
      // 'spider_spawn_mine' ist die EINE ausdrueckliche Ausnahme (Abschnitt
      // 15: eine frisch am Boss haengende Spinnenmine kann ihn trotzdem
      // treffen). Sobald kein Bein mehr lebt, greift dieses Gatter nicht mehr
      // (Phase 3: dauerhaft verwundbar).
      if (
        tank.cfg.spiderBoss &&
        tank.spiderLegsAlive > 0 &&
        !(tank.spiderVulnerableTimer > 0) &&
        meta?.code !== 'spider_spawn_mine'
      ) {
        state.sounds.push({ name: 'reflect', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8a6ad8', 5, 70);
        return;
      }
      // Kettenhund (G7, t_tether): JEDER Schaden an einem gebundenen Panzer
      // wird 50/50 zwischen ihm und seinem Partner geteilt -- GANZ AM ANFANG,
      // bevor irgendeine der beiden Seiten ihre EIGENE Abwehr (Resistenz/
      // Schild/Exekution) darauf anwendet (jede Seite rechnet unabhaengig,
      // ein Gepanzerter in der Kette blockt seinen Anteil normal). Zwei
      // getrennte, rekursive applyDamage()-Aufrufe statt einer einzigen
      // Ableitung -- meta.tetherSplit verhindert die Ping-Pong-Rekursion
      // (der Partner hat selbst wieder einen tetherPartner, der auf DIESEN
      // Panzer zeigt). "Split, nicht verdoppelt": der GESAMTSCHADEN bleibt
      // gleich, nur auf zwei LP-Pools verteilt (6 Treffer a 10 Schaden = 60
      // gesamt = 30/30 bei maxHp 30 -- beide sterben gleichzeitig, exakt wie
      // im Designdokument vorgerechnet).
      // BUGFIX: die Regel gilt fuer BEIDE Seiten der Kette ("jeder Schaden an
      // einem der beiden", Kartentext). Ein Kettenhund kann sich mangels
      // zweitem Kettenhund auch an einen ganz normalen Verbuendeten binden --
      // der traegt dann selbst kein cfg.tether. Vorher teilte nur ein Treffer
      // AUF den Kettenhund; ein Treffer auf seinen Partner ging voll durch,
      // sodass sich die Kette umgehen liess, indem man einfach die andere
      // Seite erschoss. Die Rezeptur kommt jetzt von der Seite, die sie hat.
      const tetherCfg = tank.cfg.tether || tank.tetherPartner?.cfg?.tether;
      if (tetherCfg && tank.tetherPartner?.alive && !meta?.tetherSplit) {
        const half = (amount ?? 1) * (tetherCfg.splitPct ?? 0.5);
        const partner = tank.tetherPartner;
        tank.tetherFlashUntil = state.time + 0.2;
        partner.tetherFlashUntil = state.time + 0.2;
        state.applyDamage(tank, half, cause, { ...meta, tetherSplit: true });
        if (partner.alive) state.applyDamage(partner, half, cause, { ...meta, tetherSplit: true });
        return;
      }
      // Schadensresistenz (Nekromant-V2 Phase 2): wirkt GENERISCH auf JEDEN
      // Schaden, der diesen Panzer ueberhaupt erreicht -- auch auf Schaden
      // ueber Zeit (ein resistenter Panzer soll auch gegen Brand/Gift zaeher
      // sein), deshalb VOR der DOT-Weiche unten. Rechenweg + Begruendung:
      // s. applyResistToAmount() oben.
      // ghost_022 "Haerte aus Verlust" (Nekromant-V2 Phase 6): zeitlich
      // befristeter Resistenz-Bonus NUR fuer den Spieler, additiv zur
      // festen cfg.resist -- necroResistBonus() summiert den generischen
      // Timed-Stack, kein zweites Resistenzfeld auf cfg noetig.
      const effResistCfg =
        tank === state.player && necroResistBonus(state) > 0
          ? { resist: (tank.cfg.resist || 0) + necroResistBonus(state) }
          : tank.cfg;
      amount = applyResistToAmount(effResistCfg, state.data.balance?.resist, amount);
      // Schaden ueber Zeit (Phase 5) ueberspringt ALLE Schild-Gatter
      // darunter. Ein Schild, der "den naechsten Treffer abfaengt", darf
      // nicht an einem 4-Punkte-Brandtick verpuffen -- sechs Ticks wuerden
      // sonst drei Ladungen in anderthalb Sekunden verbrauchen. Die
      // Boss-Unverwundbarkeit oben gilt dagegen weiter.
      if (meta?.overTime) {
        // BUGFIX: laeuft jetzt ueber denselben resolveLethalHit() wie jeder
        // andere durchkommende Treffer -- ein toedlicher Statuseffekt-Tick
        // (Brand/Gift) kann "Letzte Deckung" damit genauso ausloesen wie ein
        // toedlicher Kugeltreffer (Kartentext nennt keine Einschraenkung auf
        // Geschosse). Exekutionsschwelle/Bodenklammer unveraendert innerhalb
        // von resolveLethalHit().
        resolveLethalHit(state, tank, amount, cause, meta);
        return;
      }
      // Schild als Punktepool (Nekromant-V2 Phase 2): faengt Schaden VOR hp
      // ab -- gilt fuer JEDEN Panzer (Spieler, Gegner; Untertanen ueber die
      // eigene Ghost-Kollisionsschleife unten). Absichtlich VOR den beiden
      // Notschild-Gattern geprueft: fuer Gegner ist dieser Pool aktuell die
      // EINZIGE Schild-Option, ein bereits voll abgefangener Treffer soll
      // keine der spielerexklusiven Ladungen verbrauchen. s. absorbWithShieldPool() oben.
      amount = absorbWithShieldPool(state, tank, amount);
      if (amount <= 0) return;
      // Notschild-Ladung faengt genau einen Treffer ab (raumuebergreifend,
      // keine Regeneration). Kurzer Schutz verhindert Mehrfachverbrauch im
      // selben Explosions-Frame.
      if (tank === state.player && state.shieldCharges.length > 0) {
        state.shieldCharges.shift(); // aelteste Ladung zuerst
        tank.protect = Math.max(tank.protect, 0.6);
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 12, 130);
        return;
      }
      // Elite-Affix "gepanzert"/"Regenerierschild": Gegnerschild faengt
      // genau einen Treffer ab. Mit regenShieldS laedt sich die Ladung
      // danach neu auf, statt fuer den Rest des Raums zu verfallen.
      if (tank !== state.player && tank.shieldReady) {
        tank.shieldReady = false;
        tank.protect = Math.max(tank.protect, 0.3);
        if (tank.regenShieldS) tank.regenShieldTimer = tank.regenShieldS;
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 8, 100);
        return;
      }
      // Spieler-Schild = Schadensabsorber (UMBAUPLAN-LP Phase 8): faengt die
      // naechsten shieldHp Punkte ab, Rest geht durch. Bewusst KEIN
      // protect-Fenster mehr, solange der Absorber noch Punkte hat -- sonst
      // schluckte ein einziger Treffer 0,6 s lang allen weiteren Schaden und
      // der Schild waere wieder eine zweite Lebensleiste statt eines Puffers.
      if (tank === state.player && tank.shieldReady) {
        const absorbed = Math.min(tank.shieldHp || 0, amount ?? 1);
        tank.shieldHp = (tank.shieldHp || 0) - absorbed;
        amount = (amount ?? 1) - absorbed;
        state.sounds.push({ name: 'shield', x: tank.x });
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 8, 110);
        if (tank.shieldHp <= 0) {
          // Absorber erschoepft -> Schild bricht.
          tank.shieldReady = false;
          tank.protect = Math.max(tank.protect, 0.6);
          state.spawnParticles(tank.x, tank.y, '#8ecaf0', 12, 130);
          // Konterschild: feuert beim Bruch einen Kugelkranz.
          if (tank.cfg.counterShield) {
            spawnRadialBullets(state, tank, tank.x, tank.y, tank.cfg.counterShieldCount, 150);
          }
          // Nachladeschild-Upgrade (Phase 18): laedt sich nach shieldRegenS
          // von selbst neu -- wiederverwendet denselben regenShieldTimer/
          // shieldReady-Tick, den das Regenerierschild-Elite-Affix (Phase 9)
          // schon fuer Gegner nutzt (Tick-Schleife unten, kein neuer Code).
          if (tank.cfg.shieldRegenS) tank.regenShieldTimer = tank.cfg.shieldRegenS;
        }
        // Vollstaendig abgefangen -> fertig. Sonst faellt der Restschaden
        // unten durch die normale hp-Verrechnung (kann bei grossem Treffer
        // trotz Schild toeten). BUGFIX: lief hier vorher an "Letzte
        // Deckung" (ghost_025) vorbei direkt in killTank() -- ein Treffer,
        // der den Schild-Absorber durchschlug, war dadurch NIE rettbar,
        // ein Treffer OHNE Schild (Fallthrough unten) schon. Ein Schild
        // machte den Nekromanten so verwundbarer statt zaeher. Jetzt
        // derselbe gemeinsame Ausgang wie ueberall sonst.
        if (amount <= 0) return;
        resolveLethalHit(state, tank, amount, cause, meta);
        return;
      }
      // ghost_025 "Letzte Deckung" (Nekromant-V2 Phase 6) wirkt jetzt
      // GENERISCH innerhalb von resolveLethalHit() -- einmal pro Raum
      // opfert ein TOEDLICHER Treffer (Kugel, Explosion, Statuseffekt-Tick,
      // ein den Schild-Absorber durchschlagender Rest) den SCHWAECHSTEN
      // aktiven Untertanen statt den Hauptpanzer, NACH allen obigen Abwehr-
      // Gattern (ein Schild soll weiterhin zuerst greifen), aber VOR dem
      // hp-Abzug. Ohne aktiven Untertanen (state.ghosts leer) wirkungslos,
      // wie im Auftrag gefordert. Der geopferte Untertan wird direkt
      // entfernt (kein killGhost()-Aufruf -- die Karte ist reine Rettung,
      // kein Geistertod im Sinne der Tabelle, loest also keine weiteren
      // Karteneffekte aus).
      //
      // Kein Gatter hat gegriffen -> der Treffer geht durch. Der Schaden wird
      // immer abgezogen (hp bleibt eine ehrliche Zahl).
      resolveLethalHit(state, tank, amount, cause, meta);
    },
    // Verwerter (G7, t_harvester): "stirbt ein Panzer ODER Geist in
    // radiusPx Umkreis, waechst er dauerhaft" -- als state-Methode statt
    // Modulfunktion, damit sowohl killTank() (state.js) als auch killGhost()
    // (ghost.js) sie ueber das bereits vorhandene state-Argument aufrufen
    // koennen (Muster wie damageGhostsInRadius/registerAnvilRage). excludeTank
    // schliesst den gerade sterbenden Panzer selbst aus (relevant, falls ein
    // Verwerter sich selbst als "in Reichweite" faende -- praktisch nie, da
    // er zu diesem Zeitpunkt schon !alive ist, aber ausdruecklich statt
    // implizit ausgeschlossen). Der maxHp-Zuwachs heilt NICHT (healOnStack:
    // false in den Daten) -- er macht nur zaeher fuer KUENFTIGE Treffer.
    applyHarvestGrowth(x, y, excludeTank) {
      for (const h of state.tanks) {
        if (h === excludeTank || !h.alive || !h.cfg.harvest) continue;
        const hc = h.cfg.harvest;
        const d2 = (h.x - x) ** 2 + (h.y - y) ** 2;
        if (d2 > hc.radiusPx * hc.radiusPx) continue;
        h.harvestStacks = (h.harvestStacks || 0) + 1;
        h.cfg.maxHp += hc.hpPerStack;
        h.cfg.damage += hc.damagePerStack;
        if (hc.healOnStack) h.hp += hc.hpPerStack;
        state.spawnParticles?.(x, y, '#ff3030', 5, 80);
        state.sounds.push({ name: 'combo', x: h.x });
      }
    },
    // Spinnenboss (Abschnitt 16): explodeAt() (mine.js) iteriert nur
    // state.tanks -- Geister/Champion leben getrennt in state.ghosts und
    // brauchen denselben Resistenz-/Schildpool-Rechenweg wie die
    // "Gegner-Geschosse gegen Geister"-Schleife weiter unten, nur fuer eine
    // KREISFOERMIGE Quelle statt eines einzelnen Geschosses (spidermine.js:
    // detonateSpiderMine() ruft dies direkt NACH explodeAt() auf). Generisch
    // genug fuer jede kuenftige AOE-Quelle gegen Geister.
    // BUGFIX: EIN einzelnes Untertan-Ziel schaedigen (Resistenz + Schildpool
    // + killGhost, wortgleich zum Koerper von damageGhostsInRadius() unten).
    // Fuer eine Quelle, die eine Reihe BEREITS bekannter Einzelziele nach der
    // Reihe abarbeitet (Amboss: Schockwelle/Schleifspur pruefen Spieler UND
    // jeden Geist EINZELN in einer eigenen Schleife) -- nicht fuer eine
    // echte Flaechenquelle mit einem gemeinsamen Mittelpunkt (dafuer bleibt
    // damageGhostsInRadius() zustaendig). Vorher rief anvil.js
    // damageGhostsInRadius(g.x, g.y, 1, dmg) JE GEIST auf: bei zwei oder mehr
    // Untertanen nahe beieinander (haeufig bei einem Legion-/Champion-Build)
    // traf jeder dieser Aufrufe ALLE ueberlappenden Geister erneut, nicht nur
    // den einen gemeinten -- ein Segment/eine Schockwelle richtete dadurch
    // ein Vielfaches ihres Schadens an, je dichter die Untertanen standen.
    damageGhost(g, dmg) {
      if (!g.alive || g.invulnUntil > state.time) return;
      let amount = applyResistToAmount(g.cfg, state.data.balance?.resist, dmg);
      amount = absorbWithShieldPool(state, g, amount);
      if (amount <= 0) return;
      g.hp -= amount;
      if (g.hp <= 0) killGhost(state, g);
    },
    damageGhostsInRadius(x, y, R, dmg) {
      for (const g of state.ghosts) {
        if (!g.alive || g.invulnUntil > state.time) continue;
        if (!circlesOverlap(x, y, R, g.x, g.y, g.cfg.radius)) continue;
        state.damageGhost(g, dmg);
      }
    },
    // Amboss-Auftrag (Abschnitt 6, Zorn als Angriffspaket): der ZENTRALE
    // Zorn-Zugang -- als state-Methode statt als Modulfunktion, damit
    // mine.js/tank.js/ghost.js/damagetypes.js sie ohne einen weiteren Import
    // (und ohne Zirkelimport-Risiko) einfach ueber das bereits vorhandene
    // `state`-Argument aufrufen koennen (Muster wie state.applyDamage/
    // state.spawnParticles). Kennt NUR `kind` ('direct'/'explosion'/'ghost')
    // + eine STABILE Ereigniskennung -- kein Aufrufer muss die Zornbetraege
    // selbst kennen, die stehen ausschliesslich in data/balance.json.
    //
    // Dedupe: `processedRageEvents` (ein Set aus "kind:eventId"-Schluesseln)
    // verhindert, dass dasselbe Angriffspaket (z. B. mehrere Kugeln eines
    // Doppelrohr-/Streuschuss-Abzugs, die sich EINE rageEventId teilen, oder
    // eine Kugel UND ihre eigene Explosion) zweimal Zorn ausloest. Bewusst
    // KEIN Zorn durch Statuseffekt-Ticks/Blitzketten/Kamikaze/Sabotage:
    // diese Quellen rufen registerAnvilRage() schlicht nie auf (die einzigen
    // drei Aufrufstellen sind die Haupttrefferschleife, der explosive-
    // Geschoss-Detonationsblock unten in dieser Datei und mine.js: explode()).
    //
    // rageLocked (Raserei + Zusammenbruch, Abschnitt 13/14): Zornaufbau UND
    // -abbau sind dort VOLLSTAENDIG gesperrt -- ein frueher return hier
    // deckt das fuer den Aufbau ab, der passive/aktive Abbau in
    // src/game/anvil.js liest dasselbe Feld.
    //
    // Geistersalven-Buendelung (ghostBatchS): mehrere GETRENNTE Salven
    // (verschiedene eventId, aber innerhalb des Zeitfensters) werden zu
    // einem gemeinsamen Zornbetrag zusammengefasst -- die zweite und jede
    // weitere Salve im Fenster dedupt zwar ihre eigene eventId (kein
    // zweites Auftreten derselben Salve moeglich), traegt aber selbst
    // keinen zusaetzlichen Zornbetrag bei (Test 19/20).
    registerAnvilRage(kind, eventId) {
      const boss = state.anvilBoss;
      if (!boss || !boss.alive) return;
      const acfg = state.data.balance?.boss?.anvil;
      if (!acfg) return;
      if (boss.rageLocked) return;
      if (!boss.processedRageEvents) boss.processedRageEvents = new Set();
      const fullKey = kind + ':' + eventId;
      if (boss.processedRageEvents.has(fullKey)) return;
      boss.processedRageEvents.add(fullKey);
      const amount =
        kind === 'direct' ? acfg.directRage ?? 0 : kind === 'explosion' ? acfg.explosionRage ?? 0 : kind === 'ghost' ? acfg.ghostVolleyRage ?? 0 : 0;
      let applied = amount;
      if (kind === 'ghost') {
        const withinBatch = boss.lastGhostRageAt != null && state.time - boss.lastGhostRageAt < (acfg.ghostBatchS ?? 0.25);
        if (withinBatch) applied = 0; // gemeinsamer Beschuss -- schon abgegolten
        else boss.lastGhostRageAt = state.time;
      }
      // Startet die Karenz des passiven Abbaus neu -- gilt fuer JEDES
      // zornrelevante Ereignis, auch ein in ein Buendel eingereihtes
      // (Abschnitt 7: "Ein neuer zornrelevanter Angriff startet die Karenz
      // neu", ohne Einschraenkung auf einzelne, nicht gebuendelte Treffer).
      boss.lastRageEventAt = state.time;
      // Telemetrie (Abschnitt 20): laengste Pause zwischen zwei angenommenen
      // (nicht doppelt gezaehlten) zornrelevanten Ereignissen.
      if (state.anvilLastRageTrackedAt != null) {
        state.anvilTimeWithoutRageHit = Math.max(
          state.anvilTimeWithoutRageHit || 0,
          state.time - state.anvilLastRageTrackedAt
        );
      }
      state.anvilLastRageTrackedAt = state.time;
      if (kind === 'ghost' && applied > 0) {
        state.anvilGhostRageGenerated = (state.anvilGhostRageGenerated || 0) + applied;
      }
      if (applied > 0) {
        boss.rage = Math.min(acfg.rageMax ?? 100, (boss.rage || 0) + applied);
        // Trefferanzeige (Abschnitt 17): hoechstens EINE pro Angriffspaket --
        // ergibt sich automatisch, weil applied>0 nur einmal je Paket erreicht
        // wird (Dedupe oben) bzw. nur einmal je Geistersalven-Buendel.
        state.texts.push({
          x: boss.x,
          y: boss.y - boss.cfg.radius - 20,
          text: `+${applied} Zorn`,
          age: 0,
          life: 0.7,
          color: '#ff9a4a',
        });
      }
    },
    // Reine Todeslogik -- ab hier ist der Panzer tot, es gibt keine
    // Abwehr mehr. Bewusst weiterhin direkt aufrufbar (Tests raeumen damit
    // Raeume ab), aber im Spielcode ruft sie nur noch applyDamage().
    killTank(tank, cause, meta) {
      if (!tank.alive) return; // doppelter Tod im selben Frame (Kettenreaktion)
      tank.alive = false;
      // Amboss-Auftrag (Abschnitt 19, Boss-Tod und Aufraeumen): Raserei/
      // Rammwarnung sind reine Modus-/Timer-Felder auf dem Panzer selbst und
      // verschwinden automatisch (kein weiterer stepAnvilBoss()-Aufruf mehr,
      // da die Gegner-Schleife `!t.alive` bereits ueberspringt UND der
      // Renderer `drawTank()`/die Panzerungs-/Zorn-Overlays bei !t.alive gar
      // nicht erst zeichnet). Schockwellen und Schleifspuren leben dagegen
      // in EIGENEN, vom Panzer getrennten Arrays -- die muessen hier explizit
      // geleert werden, sonst blieben sie als "unsichtbare, aber noch
      // aktive" Gefahrenflaechen stehen bzw. wuerden ohne einen weiteren
      // stepAnvilBoss()-Tick nie mehr aufgeraeumt.
      if (tank.cfg.anvilBoss) {
        state.anvilShockwaves = [];
        state.anvilTrails = [];
        // Telemetrie (Abschnitt 20): Kampfdauer = Zeit seit Raumstart (der
        // Amboss-Raum enthaelt sonst keine weiteren Gegner, state.time
        // laeuft seit `createState()` bei 0 los) + durchschnittlicher Zorn
        // aus der pro Tick gesampelten Summe (anvil.js: stepAnvilBoss()).
        state.anvilFightDuration = state.time;
        state.anvilAverageRage =
          state.anvilRageSampleCount > 0 ? state.anvilRageSampleSum / state.anvilRageSampleCount : 0;
      }
      // Phase 7b (Abnahmekriterium aus PLAN.md): bis hierher spielte JEDER
      // Tod denselben 'death'-Ton -- ein Gegner-Kill klang identisch zum
      // eigenen Tod. Jetzt zwei klar getrennte Sounds; zusammen mit dem
      // bereits eigenen 'shield' sind Leben-, Schild- und Gegnerverlust
      // hoerbar unterscheidbar (Punkt 6 der Phasenliste).
      state.sounds.push({ name: tank === state.player ? 'player_death' : 'kill', x: tank.x });
      state.addShake(4);
      state.spawnParticles(tank.x, tank.y, DEBRIS_COLORS[tank.type] || '#fff', 10, 120);
      // Exekutions-Kill (Phase 2): kraeftigerer Einschlag als Rueckmeldung
      // fuer den garantierten Kill -- tank.executing wurde diesen Tick schon
      // VOR dem toedlichen Treffer gesetzt (applyDamage() ruft killTank() in
      // diesem Fall immer ueber den Exekutions-Zweig, nie ueber die normale
      // hp<=0-Pruefung, s. o.).
      if (tank.executing) {
        state.addShake(5);
        state.spawnParticles(tank.x, tank.y, '#ffd23c', 14, 200);
      }
      if (tank === state.player) {
        // Kamikaze: der Spieler explodiert beim Sterben.
        if (tank.cfg.kamikazeRadius) {
          // Kill-Zuordnung (Phase 6): tank ist an dieser Stelle noch
          // state.player (== der gerade sterbende Spieler).
          explodeAt(state, tank.x, tank.y, tank.cfg.kamikazeRadius, null, { killer: tank });
        }
        state.playerDeaths++;
        state.lastDeathCause = cause || 'Unbekannt';
        // Strukturierte Todesursache fuer die Telemetrie (nur Instrument;
        // die Spiellogik liest diese Felder nie zurueck).
        state.lastDeathCauseCode = meta?.code || null;
        state.lastDeathEnemyType = meta?.enemyType || null;
        state.lastDeathBulletOwner = meta?.bulletOwner || null;
        state.lastDeathBulletDistance = meta?.bulletDistance ?? null;
        state.damageFlash = 0.5;
        state.respawnTimer = RESPAWN_DELAY;
      } else {
        // Blindgaenger (G2, t_dud): jeder Tod -- egal wodurch -- startet
        // eine verzoegerte Explosion an der Sterbeposition statt sofort zu
        // zuenden (updateDeathFuses() zuendet nach fuseS ueber den normalen
        // explodeAt()-Pfad, spare:null trifft dabei ausdruecklich auch
        // andere Gegner). Laeuft VOR dem uebrigen Kill-Bonus-Block, damit
        // ein Blindgaenger, der selbst als Kettenreaktion eines anderen
        // Kills stirbt, seine Zuendung nicht verliert.
        if (tank.cfg.deathBlast) {
          const db = tank.cfg.deathBlast;
          state.deathFuses.push({
            x: tank.x,
            y: tank.y,
            radiusPx: db.radiusPx,
            damage: db.damage,
            age: 0,
            fuseS: db.fuseS,
            dead: false,
          });
          state.sounds.push({ name: 'mine_warn', x: tank.x });
        }
        state.enemyKills++;
        state.killLog.push(tank.type);
        // Verwerter (G7, t_harvester): "meine Gegner sterben" -- der
        // Spieler toetet ein Enemy, das feeded jeden lebenden Verwerter in
        // Reichweite. Bewusst NUR im Nicht-Spieler-Zweig (die Frage, "wo
        // sterben meine Gegner", meint eindeutig Feindtode, nicht den
        // eigenen Tod -- derselbe Zweig-Entscheid wie beim deathBlast-Hook
        // oben, t_dud).
        state.applyHarvestGrowth(tank.x, tank.y, tank);
        const pc = state.player.cfg;
        // Beutejagd-Upgrade (Phase 18): der ERSTE Kill in jedem Raum gibt
        // sofort Bonus-Schrott -- eigener Raum-Zaehler (Muster wie
        // bonusScrap/steinbruch), nicht an killTank()s Aufrufart gebunden
        // (zaehlt also auch bei einem Ghost-/Minen-/Kettenblitz-Kill als
        // erster Kill).
        if (!state.firstKillGiven && pc.firstKillScrap) {
          state.firstKillGiven = true;
          state.bonusScrap += pc.firstKillScrap;
        }
        if (state.player.alive) {
          // Aasgeier: Abschuss gibt das VOLLE Magazin zurueck -- Cooldown weg
          // und alle eigenen, gerade fliegenden Kugeln zaehlen nicht mehr
          // dagegen (tank.js: liveBulletsOf). Sie fliegen weiter und toeten
          // weiter, blockieren aber keinen Magazinplatz mehr.
          if (pc.scavenger) {
            state.player.cooldown = 0;
            for (const b of state.bullets) {
              if (!b.dead && b.owner === state.player) b.magFreed = true;
            }
          }
          // Blutrausch: kurzer Tempo-Schub (bloodlust) + nur ein kurzer
          // Unverwundbarkeits-Moment (bloodlustIframe), damit sich Kills
          // nicht zu dauerhafter Unverwundbarkeit stapeln.
          if (pc.bloodlust) {
            state.player.protect = Math.max(state.player.protect, pc.bloodlustIframe);
            state.player.bloodTimer = pc.bloodlust;
          }
        }
        // Kettenblitz: kleine Explosion am Ort des Kills (verschont den
        // Spieler) -> kann weitere Gegner mitreissen (Kettenkills). Kill-
        // Zuordnung (Phase 6): der Spieler ist der Urheber der Karte.
        if (pc.chainLightning) {
          explodeAt(state, tank.x, tank.y, pc.chainLightning, state.player, { killer: state.player });
        }
        // Nekromant: Klassenidentitaet (Upgradepool-v2 Phase 6), Basiswerte
        // seit Nekromant-V2 Phase 3 grundlegend neu: EIN einheitlicher
        // reviveChance-Wert (egal ob der Kill vom Spieler-als-Nekromant oder
        // von einem bereits vorhandenen Geist kommt -- die alte, zweistufige
        // spawnChance.necro/.ghost ist archiviert, s. archive/ghost-tank-v1
        // .json), UND der wiederbelebte Untertan erbt den TYP des getoeteten
        // Gegners (Rolle/Waffe/Panzerung/Tempo bleiben, nur maxHp/damage
        // werden auf baseStatPct gestutzt -- s. ghost.js: resolveGhostCfg()).
        // Elite-/Boss-Ausnahme (Auftrag Abschnitt 3): ein Gegner mit
        // Elite-Affix (t.affixes, Phase 9) oder ein Boss (isBossCfg) wird nie
        // wiederbelebt -- sonst waere ein wiederbelebter Boss/Elite eine
        // zweite, unbeabsichtigte Kampfarena. Ueber den Seed-RNG (state.rng),
        // nie Math.random -- der Run bleibt deterministisch.
        const killer = meta?.killer;
        const gcfg = state.data.balance.ghost || {};
        const necroKill = pc.necromancer && (killer === state.player || killer?.isGhost);
        const isBoss = isBossCfg(tank.cfg);
        const isElite = !!(tank.affixes && tank.affixes.length > 0);
        // Champion-/Nekromant-Nachschliff Abschnitt 12 (UEBERARBEITET):
        // Elitegegner sind GENERELL wiederbelebbar, nicht mehr nur mit
        // ghost_056 "Elite-Reaktivierung" -- die Karte hebt seither nur noch
        // den Basiswert-Anteil auf 90 % an (s. overrides weiter unten). Bosse
        // bleiben in JEDEM Fall ausgeschlossen (Auftrag: "Bosse bleiben
        // ausgeschlossen").
        const canRevive = necroKill && !isBoss;
        if (canRevive) {
          // Seelenruf/Geisterlegion/Armee der Toten (Upgradepool-v2 Phase 8,
          // ghost_036/060 seit Phase 7): ghostMaxAdd erhoeht das Basislimit
          // additiv, ohne Obergrenze.
          const ghostCap = (gcfg.maxActive ?? 3) + (pc.ghostMaxAdd || 0);
          // "Rechenweg statt Obergrenze" (Auftrag Abschnitt 4a): reviveChance
          // ist additiv OHNE Deckel -- ueber 100 % erzeugt der ganzzahlige
          // Anteil sichere Zusatz-Untertanen. Nekromant-V2 Phase 7
          // (ghost_044/055 "Totenruf"): necroReviveChanceAdd kommt vom
          // Spieler-cfg dazu, ebenfalls ohne Deckel.
          // ghost_101 "Seelenlieferanten" (Nekromant-V2 Phase 9): Abschuesse
          // DURCH Untertanen (killer?.isGhost) bekommen zusaetzlich eine
          // EIGENE, unabhaengige Chance obendrauf -- additiv ohne Deckel wie
          // necroReviveChanceAdd selbst.
          const ghostKillBonus = killer?.isGhost ? pc.necroHybridGhostKillReviveChance || 0 : 0;
          const chance = (gcfg.reviveChance ?? 0) + (pc.necroReviveChanceAdd || 0) + ghostKillBonus;
          // ghost_089 "Wechselopfer" (Gadget) / ghost_104 "Kreislauf der
          // Verdammten" (keystone): beide garantieren "die naechste
          // Wiederbelebungsprobe" -- ein aktives Zeitfenster (089) bzw. ein
          // einmaliges Flag (104) erzwingt hier mindestens 1 Untertan, wird
          // danach sofort verbraucht (kein Nachwirken auf die UEBERNAECHSTE
          // Probe).
          const guaranteed = state.necroGuaranteedReviveUntil > state.time || state.necroCircleGuaranteedRevive;
          const n = guaranteed ? Math.max(1, rollGhostSpawnCount(chance, state.rng)) : rollGhostSpawnCount(chance, state.rng);
          if (guaranteed) {
            state.necroGuaranteedReviveUntil = 0;
            state.necroCircleGuaranteedRevive = false;
          }
          // ghost_054 "Legionskern": die Probe war erfolgreich (n>0), aber
          // KEIN Platz mehr frei -- statt eines wirkungslosen Wurfs heilen
          // und staerken sich die vorhandenen Untertanen bis Raumende.
          // Eigene, kleine interne Abklingzeit (kein necro.js-Umweg noetig,
          // s. state.necroCoreCooldownUntil).
          if (
            n > 0 &&
            occupiedGhostSlots(state) >= ghostCap &&
            pc.necroCoreHealPct &&
            state.time >= state.necroCoreCooldownUntil
          ) {
            for (const g of state.ghosts) {
              if (!g.alive) continue;
              g.hp = Math.min(g.cfg.maxHp, g.hp + g.cfg.maxHp * pc.necroCoreHealPct);
            }
            state.necroLegionKernActive = true;
            state.necroCoreCooldownUntil = state.time + (pc.necroCoreCooldownS || 0);
          }
          // Limit OHNE Verdraengung: am Deckel passiert einfach nichts fuer
          // die restlichen Wuerfe (kein Verbrauch) -- dieselbe Regel wie bei
          // der Geisterbombe (tank.js: spawnGhostBomb()). Der Deckel-
          // Vergleich zaehlt seit Phase 7 belegte PLAETZE (occupiedGhostSlots),
          // nicht die reine Anzahl.
          //
          // BUGFIX (Auftrag Abschnitt 4, "ghost_098 funktioniert im normalen
          // Spielablauf nicht"): ohne ghost_098 bricht die Schleife am vollen
          // Limit weiterhin sofort ab (unveraendertes Verhalten). MIT
          // necroCapFusion (098) wird pushGhost() dagegen IMMER aufgerufen,
          // auch am Deckel -- ihre eigene Verschmelzungslogik (s. ghost.js)
          // entscheidet dann selbst, ob der neue Geist verworfen und
          // stattdessen der schwaechste vorhandene in den Champion
          // verschmolzen wird. Ohne diesen Fix erreichte ein durch einen
          // Abschuss ausgeloester Wiederbelebungsversuch pushGhost() am
          // vollen Limit NIE (fruehes break hier), egal ob der Kill vom
          // Hauptpanzer, dem Champion oder einem gewoehnlichen Geist stammte
          // -- alle drei laufen durch GENAU diese eine Schleife.
          let spawnedAny = false;
          for (let i = 0; i < n; i++) {
            if (occupiedGhostSlots(state) >= ghostCap && !pc.necroCapFusion) break;
            // Jeder Elite-Untertan belegt strukturell 2 Geisterplaetze (er ist
            // per Definition ein staerkerer Gegner) -- UNABHAENGIG von
            // ghost_056. ghost_056 "Elite-Reaktivierung" hebt DARUEBER hinaus
            // nur noch den Basiswert-Anteil von 50 % auf 90 % an (Auftrag
            // Abschnitt 10: "65 % -> 90 %"); ohne die Karte erscheint ein
            // wiederbelebter Elite-Gegner mit dem normalen Anteil wie jeder
            // andere Untertan. ghost_104: die GARANTIERTE Probe (falls sie
            // diese war) spawnt mit einem eigenen, hoeheren Basiswert-Anteil
            // -- nur beim ersten Durchlauf (i===0), die Garantie deckt genau
            // EINEN Untertan.
            const overrides = isElite
              ? { baseStatPctOverride: pc.necroEliteRevive ? pc.necroEliteReviveStatPct : undefined, slotCost: pc.necroEliteReviveSlots || 2 }
              : i === 0 && guaranteed && state.necroCircleReviveStatPct
                ? { baseStatPctOverride: state.necroCircleReviveStatPct }
                : null;
            // Nekromant-V2 Phase 8: pushGhost() statt eines direkten
            // state.ghosts.push() -- EINZIGER Ort, der "Einziger Thron"
            // (necroUniqueThrone, ghost_071) auswertet. An allen sechs
            // Erzeugungsstellen gleich, damit die Verschmelzung nicht
            // fuenffach dupliziert werden muss.
            const revived = createGhost(state, tank.x, tank.y, tank.heading, tank.type, overrides);
            // ghost_088 "Blutige Formation" (Nekromant-V2 Phase 9): der
            // NAECHSTE wiederbelebte Untertan bekommt +X% Schaden JE
            // Geistertod in diesem Raum -- UNBEGRENZT (Auftrag Abschnitt 9:
            // die alte, hier entfernte 80-%-Deckelung war eine kuenstliche
            // Obergrenze) -- VOR pushGhost() angewendet, damit eine evtl.
            // Verschmelzung (necroUniqueThrone) den bereits erhoehten Wert
            // korrekt uebertraegt.
            if (pc.necroHybridReviveDeathBonusPct) {
              const deaths = getNecroStack(state, 'room', '_deaths');
              const bonus = deaths * pc.necroHybridReviveDeathBonusPct;
              revived.cfg.damage = Math.round(revived.cfg.damage * (1 + bonus));
            }
            pushGhost(state, revived);
            spawnedAny = true;
            // ghost_052 "Mehrfachwiederbelebung": zusaetzliche Chance auf eine
            // ZWEITE, schwaechere Kopie.
            if (pc.necroDoubleReviveChance && occupiedGhostSlots(state) < ghostCap && state.rng() < pc.necroDoubleReviveChance) {
              pushGhost(
                state,
                createGhost(state, tank.x, tank.y, tank.heading, tank.type, {
                  baseStatPctOverride: pc.necroDoubleReviveStatPct,
                }),
              );
            }
            // ghost_060 "Armee der Toten": JEDE gelungene Probe erzeugt
            // GARANTIERT eine weitere Kopie (kein Zufallswurf).
            if (pc.necroGuaranteedReviveCopy && occupiedGhostSlots(state) < ghostCap) {
              pushGhost(
                state,
                createGhost(state, tank.x, tank.y, tank.heading, tank.type, {
                  baseStatPctOverride: pc.necroGuaranteedReviveStatPct,
                }),
              );
            }
          }
          if (spawnedAny) recomputeLegionCache(state);
          // Nekromant-V2 Phase 10 (Telemetrie): "Wiederbelebungsquote" heisst
          // -- wie oft fuehrte eine ECHTE Probe (canRevive) auch tatsaechlich
          // zu mindestens einem neuen Untertan (spawnedAny), NICHT nur "der
          // Wurf war < chance" (der kann am vollen Limit trotzdem ins Leere
          // laufen). state.necroReviveHits/necroReviveRolls sind reine
          // Rohzaehler, main.js liest sie unveraendert.
          state.necroReviveRolls++;
          if (spawnedAny) state.necroReviveHits++;
        }
      }
    },
  };
}
