// Panzer-Konfiguration (aus state.js ausgelagert): loest Typnamen aus
// tanks.json in flache cfg-Objekte auf und wendet Upgrade-Level an.

// Loest einen Typnamen aus tanks.json in ein flaches cfg-Objekt auf.
export function resolveCfg(data, type) {
  const t = data.types[type];
  const bbullet = data.balance?.bullet;
  // UMBAUPLAN-LP Phase 9: spielbare Klasse? Frueher haengte die Sonderbehandlung
  // (Magazin/Deckel/Kugeltempo aus balance.json) fest an type === 'player' --
  // die Werte im Panzertyp wurden nie gelesen (der Blocker der Phase). Jetzt
  // markiert das Datenfeld player:true die Klasse, und der Typ DARF die Werte
  // ueberschreiben; fehlen sie, greifen die Player-Defaults aus balance.json.
  const isPlayerClass = t.player === true || type === 'player';
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    // Lebenspunkte + Schadenswert (UMBAUPLAN-LP Phase 1). Beide stehen in
    // tanks.json und sind dort vorerst ueberall 1 -- damit toetet jeder
    // Treffer weiterhin sofort, das Spiel verhaelt sich identisch zum
    // Ein-Treffer-Modell. Erst Phase 2/3 setzen echte Zahlen ein. Die
    // Fallbacks (?? 1) sind bewusst da: ein Typ ohne die Felder (z. B. aus
    // einem alten gespeicherten Run oder einer Testfixture) bleibt spielbar.
    maxHp: t.maxHp ?? 1,
    damage: t.damage ?? 1,
    // Schadenstyp (Phase 6). Standard physisch; Klassen (Phase 9) und
    // Karten (Phasen 11-16) setzen die anderen fuenf.
    damageType: t.damageType ?? 'physical',
    // Kritische-Treffer-Chance (UMBAUPLAN-LP Phase 7). Grundwert aus
    // balance.json; ein Typ darf ihn per tanks.json: crit ueberschreiben
    // (Phase 9 haengt so die klassenspezifischen Krit-Werte ein, ohne
    // Code zu aendern -- gleiches Muster wie maxHp/damage). Karten addieren
    // spaeter einen Bonus (applyUpgrades), gedeckelt an balance.crit.cap.
    // Gerollt wird nur fuer den Spieler (tank.js), daher ist der Wert bei
    // Gegnern vorerst wirkungslos.
    critChance: t.crit ?? (data.balance?.crit?.baseChance ?? 0),
    // Typ-eigene Feuerrate (t_green: 2 s) vor globalem Standard.
    fireCooldown: t.fireRate ?? data.physics.fireCooldownS,
    // Phase 9: Klassen skalieren das Basistempo ('normal') ueber speedMult.
    speed: data.speeds[t.speed] * (t.speedMult ?? 1),
    // Magazin/Deckel/Kugeltempo: fuer spielbare Klassen aus dem Typ, sonst aus
    // den Player-Defaults in balance.json (Blocker-Fix, s. o.). Gegner behalten
    // Typmagazin, unbegrenzten Deckel und die weapon-Geschwindigkeitstabelle.
    magazine: isPlayerClass ? (t.magazine ?? bbullet?.maxActive) : t.magazine,
    magazineCap: isPlayerClass ? (t.magazineCap ?? bbullet?.maxActiveCap ?? Infinity) : Infinity,
    mines: t.mines,
    weapon: t.weapon,
    // Champion-/Nekromant-Nachschliff Abschnitt 14 (t_pink): ein Gegnertyp
    // kann seinen eigenen `bulletSpeed` gegen den geteilten
    // data/tanks.json:bulletSpeeds-Wert ueberschreiben, ohne andere Typen
    // desselben Waffenwerts zu beeinflussen (vorher galt fuer Gegner
    // ausschliesslich der geteilte Wert).
    bulletSpeed: isPlayerClass
      ? (t.bulletSpeed ?? bbullet?.speed ?? data.bulletSpeeds[t.weapon])
      : (t.bulletSpeed ?? data.bulletSpeeds[t.weapon]),
    // Gegner-Rolle statt Gegner-Typ (Phase 8): vier Rollen (guardian/
    // sapper/hunter/sieger), parametrisiert statt pro Typ eigener
    // Turm-/Fahrfunktion. Rolle und Panzerung bleiben frei kombinierbar.
    role: t.role,
    aggression: t.aggression ?? 0.5,
    preferredRange: t.preferredRange ?? 0,
    accuracy: t.accuracy ?? 0.5,
    // Sonderverhalten, orthogonal zur Rolle (wie armor/miner): nur die
    // Typen setzen sie, die sie tatsaechlich nutzen.
    packFlank: t.packFlank || false,
    leadAim: t.leadAim || false,
    phaseToggle: t.phaseToggle || null,
    avoidMines: t.avoidMines || false,
    miner: t.miner,
    trackStampPx: t.trackStampPx || 3,
    // Gerichtete Panzerung (Phase 4) -- reine Datenuebernahme.
    armor: t.armor || null,
    // Grundsteinumbau Phase 1: die INTERPRETATION dieses Feldes (Kill-Block
    // ohne Wandabpraller) ist aus armor.js entfernt -- reiner Boss-Platzhalter-
    // Passthrough (t_mirror, s. CLAUDE.md "Bosse (Platzhalter,
    // Nutzerentscheidung)"), nur noch fuer die Renderer-Optik gebraucht.
    requiresRicochet: t.requiresRicochet || false,
    // Klassen-Passive (UMBAUPLAN-LP Phase 9). Reine Datenuebernahme; jeder
    // Wert wird an genau EINER Stelle ausgewertet (s. Kommentar dort).
    classMineRadiusMult: t.classMineRadiusMult ?? 1, // Sprengpanzer: Bombenradius (mine.js via mineRadiusMult)
    lightningBonusTargets: t.lightningBonusTargets ?? 0, // Teslapanzer: +Blitzziele (damagetypes.js)
    fireDurationMult: t.fireDurationMult ?? 1, // Flammenpanzer: Branddauer (status.js via applyTypeEffects)
    poisonDurationMult: t.poisonDurationMult ?? 1, // Radioaktiv: Giftdauer
    frostSlowBonus: t.frostSlowBonus ?? 0, // Frostpanzer: staerkere Verlangsamung
    scrapDamagePer100: t.scrapDamagePer100 ?? 0, // Schrottpanzer: +Schaden je 100 Schrott (pro Raum gebacken)
    builtHpMult: t.builtHpMult ?? 1, // Ingenieur: Gebautes haelt mehr aus (tank.js: placeTrapWall)
    // Nekromant: Klassenidentitaet (Upgradepool-v2 Phase 6) -- ab
    // Klassenwahl aktiv, kein Upgrade noetig. Ausgewertet an ZWEI Stellen:
    // state.js: killTank() (Spawnchance beim Kill), tank.js: useSecondary()
    // (Geisterbombe ersetzt den Bombenslot komplett).
    necromancer: t.necromancer ?? false,
    // Punkte, die der Spieler-Schild als Absorber auffaengt (Phase 8).
    // Konstante aus balance.json, damit createTank() die shieldHp ohne
    // Balance-Zugriff aus dem cfg fuellen kann.
    shieldAbsorb: data.balance?.shield?.absorb ?? 40,
    // Nekromant-V2 Phase 2: drei neue, generische Engine-Werte -- vorerst
    // ueberall 0 (kein Typ in tanks.json setzt sie, keine Karte gewaehrt sie
    // vor Phase 6+), aber schon vollstaendig ausgewertet (state.js:
    // applyDamage/bullet.js/tank.js), damit spaetere Nekromant-Karten sie nur
    // noch ueber core.resistAdd/pierceAdd/shieldMaxAdd/shieldRegenAdd
    // befuellen muessen (s. applyUpgrades() unten).
    resist: t.resist ?? 0, // Schadensresistenz in PUNKTEN (additiv, kein Prozentsatz) -- Rechenweg in state.js: applyDamage()
    pierce: t.pierce ?? 0, // Durchschlag: zusaetzliche Ziele, die EIN Geschoss durchschlaegt, OHNE zu sterben. Nicht zu verwechseln mit dem aelteren, archivierten phaseWalls-Feld (das ignoriert WAENDE, nicht Ziele).
    shieldMax: t.shieldMax ?? 0, // Obergrenze des NEUEN Schild-Punktepools (tank.shield/g.shield) -- nicht zu verwechseln mit shieldAbsorb/shieldHp (der aeltere, nur-Spieler-Absorber der schild-Karte) oder state.shieldCharges (Notschild-Ladungen, blocken je einen ganzen Treffer)
    shieldRegenPerS: t.shieldRegenPerS ?? 0, // Punkte/Sekunde, mit denen sich der NEUE Schild-Pool bis shieldMax auflaedt (optional, z. B. kuenftig ghost_048)
    // Boss-Sonderfaelle (Phase 14) -- reine Datenuebernahme, ebenso
    // orthogonal wie armor/miner. bossInvincible gated killTank() (Reaktor);
    // mirrorBoss/phalanx schalten in stepState() auf die Boss-Fahrfunktionen
    // aus bossai.js statt der normalen Rolle um.
    bossInvincible: t.bossInvincible || false,
    mirrorBoss: t.mirrorBoss || false,
    phalanx: t.phalanx || false,
  };
}

// Schrottpanzer-Passiv (UMBAUPLAN-LP Phase 9): +scrapDamagePer100 Schaden je
// 100 gehaltenem Schrott. Pro Raum gebacken (wie hpScaling/Modifikatoren) --
// ein mitten im Raum verdienter Schrott wirkt erst im naechsten. Wirkt nur bei
// Klassen mit dem Passiv, sonst ein No-op.
export function applyScrapDamage(cfg, scrap) {
  if (cfg.scrapDamagePer100 && scrap > 0) {
    cfg.damage = Math.round(cfg.damage * (1 + cfg.scrapDamagePer100 * Math.floor(scrap / 100)));
  }
  return cfg;
}

// Nekromant-V2 Phase 6 (ghost_029 "Seelenhunger"/ghost_030 "Unsterbliche
// Maschine"): permanente, fuer den REST DES RUNS geltende Boni, gewaehrt
// nach jeweils N Geistertoden -- dieselbe Stelle wie applyScrapDamage()
// (einmal pro Raumaufbau gebacken, run.js reicht die runweiten
// necro.js-Stapel als reine Zahlen durch, state.js kennt kein run-Objekt).
export function applyNecroRunScaling(cfg, runDmgBonusPct, runHpBonusPct) {
  if (runDmgBonusPct) cfg.damage = Math.round(cfg.damage * (1 + runDmgBonusPct));
  if (runHpBonusPct) cfg.maxHp = Math.round(cfg.maxHp * (1 + runHpBonusPct));
  return cfg;
}

// Upgrade-Level auf das Spieler-cfg anwenden (Spec Abschnitt 8 +
// Erweiterungen). Die Stellwerte der neuen Upgrades kommen aus
// upgrades.json (upsData).
//
// Grundsteinumbau Phase 7 (Rastplatz: Werkbank): upgradeLevels ist
// run.upgradeLevels ({id: stufe}, 0..levelBalance.maxLevel), am Rastplatz
// erhoehbar. stufeMultFor(id) liefert 1 + stufe*bonusPct (1, wenn keine
// Stufe/kein levelBalance/upgradable:false) -- scaleCore() wendet das auf
// die *Add/*Bonus/*Mult-Kernschluessel EINER Karte an, bevor der generische
// core-Loop weiter unten sie liest. Additive Schluessel (Add/Bonus) werden
// direkt skaliert; multiplikative (Mult) skalieren nur die Abweichung von 1
// (ein 1.08x-Effekt wird bei Stufe 1 + 50% zu 1.12x, nicht 1.62x) -- so ist
// eine Stufe unabhaengig von der Karten-Semantik gleich stark. Bekannte
// Ausnahme: `shatterMult` (Frost-Topf) endet auf "Mult", wird aber additiv
// verrechnet (`cfg.shatterMult += c.shatterMult*lvl`) -- bewusst von der
// Mult-Erkennung ausgenommen. Schluessel ohne Add/Bonus/Mult-Suffix
// (Schwellen/Maxima/Booleans wie magazineFixed, executeThreshold,
// ghostCommander) bleiben unskaliert -- ein Stufen-Bonus auf einen
// Deckelwert braucht Karten-eigene Semantik, keine generische Regel. Nur
// die Sockelkarten (data/upgrades.json) sind aktuell erreichbar -- sie
// nutzen ausschliesslich hpAdd/speedMult/magAdd/reloadMult, alle vier
// korrekt additiv bzw. multiplikativ erfasst.
export function applyUpgrades(cfg, ups, upsData, equippedSecondary, equippedGadget, upgradeLevels, levelBalance) {
  if (!ups) return cfg;
  const l = (k) => ups[k] || 0;
  const bonusPct = levelBalance?.bonusPct ?? 0;
  const maxLevel = levelBalance?.maxLevel ?? 0;
  function stufeMultFor(id) {
    if (!bonusPct || upsData?.upgrades?.[id]?.upgradable === false) return 1;
    const stufe = Math.min(upgradeLevels?.[id] || 0, maxLevel);
    return 1 + stufe * bonusPct;
  }
  function scaleCore(core, sm) {
    if (sm === 1) return core;
    const out = {};
    for (const k in core) {
      const v = core[k];
      if (typeof v !== 'number') {
        out[k] = v;
      } else if (k.endsWith('Mult') && k !== 'shatterMult') {
        out[k] = 1 + (v - 1) * sm;
      } else if (k.endsWith('Add') || k.endsWith('Bonus')) {
        out[k] = v * sm;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  cfg.magazine += 2 * l('magazin');
  // Grundsteinumbau Phase 1: die Karte 'abpraller' (Bandenschuss) ist ohne
  // Wirkung -- data/upgrades.json bleibt bis Phase 4 unangetastet, ihr
  // Effekt greift bewusst ins Leere statt Einzelausbau (s. Auftrag).
  cfg.bulletSpeed *= Math.pow(1.2, l('ladung'));
  cfg.mines += l('kettenglied');
  cfg.mineRadiusMult =
    Math.pow(upsData?.upgrades?.sprengkraft?.radiusMult ?? 1.25, l('sprengkraft')) *
    (cfg.classMineRadiusMult || 1); // Phase 9: Sprengpanzer-Passiv multipliziert mit
  cfg.speed *= Math.pow(1.12, l('kettenantrieb'));
  cfg.tungsten = l('wolframkern') > 0;
  const U = upsData ? upsData.upgrades : {};
  if (l('sprengschuss')) {
    cfg.explosionEveryShots = U.sprengschuss.everyShots; // jeder 4. Schuss
    cfg.shotExplosionRadius = U.sprengschuss.radiusPx;
  }
  // Sprengmunition: jede Kugel explodiert, keine Minen, Magazin auf 1 --
  // skaliert aber mit Magazin-Upgrades weiter (kein harter Deckel).
  if (l('sprengmunition')) {
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = U.sprengmunition.radiusPx;
    cfg.mines = 0;
    cfg.magazine = 3 + 2 * l('magazin');
  }
  if (l('krallenfalle')) {
    cfg.trapEveryPx = U.krallenfalle.everyPx[l('krallenfalle') - 1];
    cfg.trapStunS = U.krallenfalle.stunS;
    cfg.trapRadius = U.krallenfalle.radiusPx;
    cfg.trapArmS = U.krallenfalle.armDelayS;
    cfg.trapMaxActive = U.krallenfalle.maxActive;
  }
  if (l('doppelrohr')) {
    cfg.twinShot = true;
    cfg.twinSpreadRad = U.doppelrohr.spreadRad;
  }
  // Feuerleitzentrale (Phase 18): erste echte requires-Karte -- verengt den
  // Doppelrohr-Spreizwinkel, wirkt also nur, wenn twinSpreadRad schon gesetzt
  // ist (Reihenfolge nach dem Doppelrohr-Block ist deshalb Absicht).
  if (l('feuerleitzentrale')) {
    cfg.twinSpreadRad *= Math.pow(U.feuerleitzentrale.spreadMult, l('feuerleitzentrale'));
  }
  // Flak (Phase 18): eigene Waffenphysik statt eines weiteren
  // allExplosive-Sonderfalls -- jeder Schuss zuendet nach kurzer Reichweite
  // in der Luft (burstRangePx in bullet.js), nicht nur an Wand/Ziel.
  if (l('flak')) {
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = cfg.shotExplosionRadius || U.flak.radiusPx;
    cfg.burstRangePx = U.flak.burstRangePx;
  }
  cfg.radar = l('radar') > 0;
  // Ballistikrechner (Phase 18): reiner Anzeige-Parameter fuer die
  // Ziellinie (effects.js: drawAimLine), keine echte Physik.
  if (l('ballistikrechner')) cfg.aimPreviewBounces = U.ballistikrechner.previewBounces;
  // Nachtsicht (Phase 18): rein optischer Schalter -- hebt nur die
  // Nebel-/Dunkelheit-Blende auf (renderer.js: drawFog), KI-Sichtlinien
  // bleiben unveraendert.
  cfg.ignoreFog = l('nachtsicht') > 0;
  // Minenspuerer + Gefahrensinn (Phase 18, Welle 3): ebenfalls reine
  // Anzeige-Schalter (effects.js), keine Physik und keine KI-Aenderung.
  cfg.mineSense = l('minenspuerer') > 0;
  cfg.threatSense = l('gefahrensinn') > 0;
  // Sappeur (Phase 18, Welle 3): rissige Waende (Phase 11) fallen frueher.
  // Wirkt NUR auf `destructible` -- nicht auf die eigene Sperrmauer und
  // nicht gegen die Pionier-Transformation (state.js: destroyWall).
  if (l('sappeur')) cfg.wallHitsReduction = U.sappeur.hitsPerLevel * l('sappeur');
  // Steinbruch (Phase 18, Welle 3): Schrott fuer eingerissene Waende --
  // laeuft ueber denselben state.bonusScrap-Zaehler wie Beutejagd (Welle 2).
  if (l('steinbruch')) cfg.scrapPerWall = U.steinbruch.scrapPerLevel * l('steinbruch');
  // Abprallschock (Phase 18, Welle 3): erste control-Karte, die den
  // Wandabpraller selbst zum Kontrollwerkzeug macht (bullet.js).
  if (l('abprallschock')) {
    cfg.bounceStunRadius = U.abprallschock.radiusPxPerLevel * l('abprallschock');
    cfg.bounceStunS = U.abprallschock.stunS;
  }

  // --- Neue Build-Upgrades ---
  if (l('glaskanone')) {
    cfg.bulletSpeed *= U.glaskanone.speedMult;
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = cfg.shotExplosionRadius || U.glaskanone.radiusPx;
  }
  if (l('streuschuss')) {
    cfg.spreadCount = U.streuschuss.count;
    cfg.spreadRad = U.streuschuss.spreadRad;
  }
  if (l('nachbrenner')) {
    cfg.afterburnerMult = 1 + (U.nachbrenner.boostMult - 1) * l('nachbrenner');
    cfg.afterburnerS = U.nachbrenner.boostS;
  }
  cfg.scavenger = l('aasgeier') > 0;
  if (l('kamikaze')) cfg.kamikazeRadius = U.kamikaze.radiusPx;
  cfg.shield = l('schild') > 0;
  // Nachladeschild (Phase 18): laedt das Schild nach shieldRegenS von selbst
  // neu -- wiederverwendet den regenShieldTimer-Tick, den das Regenerier-
  // schild-Elite-Affix (Phase 9) fuer Gegner schon nutzt (state.js).
  if (l('nachladeschild')) cfg.shieldRegenS = U.nachladeschild.regenS;
  if (l('dash')) {
    cfg.dash = { dist: U.dash.distancePx, iframe: U.dash.iframeS, cooldown: U.dash.cooldownS };
  }
  // Erschuetterungsdash (Phase 18, requires dash): stoesst nahe Gegner beim
  // Dash weg und betaeubt sie kurz -- unabhaengig von der Sekundaerwaffe
  // (deshalb eigene Felder statt der Schockwelle-Minen-Karte).
  if (l('erschuetterungsdash')) {
    cfg.dashShockRadius = U.erschuetterungsdash.radiusPx;
    cfg.dashShockPush = U.erschuetterungsdash.pushPx;
    cfg.dashShockStun = U.erschuetterungsdash.stunS;
  }
  if (l('berserker')) {
    cfg.berserker = {
      fire: U.berserker.firePerLife,
      speed: U.berserker.speedPerLife,
      max: U.berserker.maxStacksEffect,
    };
  }
  cfg.remoteDetonate = l('fernzuender') > 0;
  if (l('streumine')) cfg.clusterMine = U.streumine.sub;
  if (l('schockwelle')) {
    cfg.shockwaveRadius = U.schockwelle.radiusPx;
    cfg.shockwavePush = U.schockwelle.pushPx;
    cfg.shockwaveStun = U.schockwelle.stunS;
  }
  if (l('annaeherungsmine')) {
    cfg.mineArmS = U.annaeherungsmine.armS;
    cfg.mineTriggerRadius = U.annaeherungsmine.triggerRadiusPx;
  }
  if (l('kettenblitz')) cfg.chainLightning = U.kettenblitz.radiusPx;
  if (l('blutrausch')) {
    cfg.bloodlust = U.blutrausch.durationS; // Dauer des Tempo-Schubs
    cfg.bloodlustSpeed = U.blutrausch.speedMult;
    cfg.bloodlustIframe = U.blutrausch.iframeS; // kurzes Unverwundbarkeits-Fenster
  }

  // Begleiter (Drohne) und Nahkampf (Rammklinge/Klingenkranz) sind nach
  // PLAN.md v2 E5 verworfen -- automatischer Schaden entwertet das Zielen.
  if (l('schrapnell')) {
    cfg.schrapnell = U.schrapnell.count;
    cfg.schrapnellSpeed = U.schrapnell.bulletSpeed;
  }
  if (l('raketenantrieb')) cfg.recoilPx = U.raketenantrieb.recoilPx;
  if (l('konterschild')) {
    cfg.counterShield = true;
    cfg.counterShieldCount = U.konterschild.count;
    // Nur in Elite-/Verflucht-/Bossraeumen aktiv -- applyRoomContext()
    // schaltet ihn in normalen Kampfraeumen wieder ab.
    cfg.counterShieldEliteOnly = !!U.konterschild.eliteOnly;
  }
  // Ueberladung: verstaerkt alle eigenen Explosionsradien.
  if (l('ueberladung')) {
    const m = U.ueberladung.mult;
    if (cfg.shotExplosionRadius) cfg.shotExplosionRadius *= m;
    if (cfg.kamikazeRadius) cfg.kamikazeRadius *= m;
    if (cfg.chainLightning) cfg.chainLightning *= m;
    cfg.mineRadiusMult = (cfg.mineRadiusMult || 1) * m;
  }

  // --- Neue Combo-Achsen ---
  if (l('turbo')) cfg.speed *= U.turbo.speedMult; // extreme Geschwindigkeit
  if (l('uebermacht')) cfg.magazinePerEnemy = U.uebermacht.perEnemy;
  if (l('klebemine')) {
    cfg.stickyMine = U.klebemine.stickDelayS;
    // Eigener, deutlich groesserer Haft-Radius: der Minenradius (7 px) hat
    // in der Praxis fast nie gegriffen, die Karte war dadurch wirkungslos.
    cfg.stickyRadius = U.klebemine.stickRadiusPx;
  }

  // --- Elite-Karten (Phase 4, nur aus Eliteräumen) ---
  // Kriegsmaschine: mehr Magazin + schnellere Nachladung.
  if (l('kriegsmaschine')) {
    cfg.magazine += U.kriegsmaschine.magazineBonus;
    cfg.fireCooldown *= U.kriegsmaschine.cooldownMult;
  }
  if (l('scharfschuetze')) {
    cfg.bulletSpeed *= U.scharfschuetze.speedMult;
    cfg.fireCooldown *= U.scharfschuetze.cooldownMult;
    // Hartes Magazin-Limit (unten angewandt, schlaegt alle anderen
    // Magazin-Effekte). Frueher fest 1 -- jetzt aus den Kartendaten.
    cfg.magazineFixed = U.scharfschuetze.magazineFixed;
  }
  // Powershot (Phase 5): die ersten powershotPerRoom Schuesse jedes Raums
  // sind automatisch verstaerkt (tank.js verwaltet den Ladungszaehler).
  if (l('powershot')) {
    cfg.powershotPerRoom = l('powershot') * U.powershot.perRoom;
    cfg.powershotSpeedFactor = U.powershot.speedFactor;
  }
  // Doppelschlag (Phase 18, Welle 3): laud eine Powershot-Ladung frueher pro
  // Trickshot-Kill nach -- die Trickshot-Belohnung selbst ist mit dem
  // Bandenschuss entfallen (Grundsteinumbau Phase 1), die Karte bleibt bis
  // zum Kartenabbau in Phase 4 wirkungslos in data/upgrades.json stehen.
  // cfg.powershotSpeedFactor braucht trotzdem einen Fallback, falls
  // tank.powershotCharges je ohne die Powershot-Karte gesetzt wird (sonst
  // NaN in tank.js: fireBullet()).
  if (l('doppelschlag')) {
    cfg.powershotSpeedFactor = cfg.powershotSpeedFactor || U.powershot.speedFactor;
  }

  // Scharfschuetze: hartes Magazin (schlaegt alles, ganz am Ende angewandt).
  if (cfg.magazineFixed) cfg.magazine = cfg.magazineFixed;
  // Pluenderer (Phase 18, erste Tag-resource-Karte): flacher Bonus pro
  // geraeumtem Raum, angewandt in run.js NACH dem Elite-Multiplikator
  // (wie die einmalige Kriegsbeute-Belohnung auch kein Vielfaches ist).
  cfg.scrapBonusPerRoom = (cfg.scrapBonusPerRoom || 0) + (l('pluenderer') ? U.pluenderer.scrapPerLevel * l('pluenderer') : 0);
  // Beutejagd (Phase 18, zweite Tag-resource-Karte): Bonus-Schrott fuer den
  // ERSTEN Kill in jedem Raum (state.js: firstKillGiven-Zaehler).
  if (l('beutejagd')) cfg.firstKillScrap = U.beutejagd.scrapPerLevel * l('beutejagd');
  // Meisterschuetze (Phase 18, Tag synergy): verdoppelte die Trickshot-
  // Belohnung (Phase 5) -- mit dem Bandenschuss entfallen (Grundsteinumbau
  // Phase 1), die Karte bleibt bis Phase 4 wirkungslos in data/upgrades.json.
  // Sekundärslot (Phase 6, seit P4 fest): die Bombe ist immer ausgeruestet
  // und nicht mehr tauschbar. Der Parameter bleibt bestehen, damit ein
  // spaeterer zweiter Sekundaertyp keinen Umbau braucht.
  cfg.secondary = equippedSecondary || 'mine';
  // Gadgetslot (P4): explizit vom Run vorgegeben, kein Level-Scan --
  // mehrere Gadgetkarten koennen gleichzeitig Level > 0 haben (eine alte
  // Karte wird beim Wechsel nicht zurueckgesetzt), nur equippedGadget
  // bestimmt das aktive. null = kein Gadget ausgeruestet (Startzustand).
  cfg.gadget = equippedGadget || null;

  // Kernpool (UMBAUPLAN-LP Phase 10): 30 klassenunabhaengige Stat-Karten mit
  // je einem `core`-Effektobjekt. EINE generische Schleife statt 30 Zweige --
  // eine neue Kernkarte braucht dadurch keine Codezeile mehr, nur ihren
  // core-Eintrag in upgrades.json. Additiv/multiplikativ wie die jeweilige
  // Stat es verlangt. Der Krit-Deckel greift bewusst NICHT hier, sondern am
  // Roll-Ort (tank.js: Math.min(cap, critChance)) -- so klemmt er auch, wenn
  // mehrere Kern-Kritkarten cfg.critChance ueber den Cap treiben (Phase 7).
  let coreDashGrant = false;
  let coreDashCdMult = 1;
  // Multiplikative Effekte werden gesammelt und ERST NACH den additiven
  // angewandt (sonst haengt das Ergebnis von der Kartenreihenfolge ab).
  let dmgMult = 1;
  let spdMult = 1;
  let magFixed = null;
  // UMBAUPLAN-LP Phase 12 (Sprengstoff-Topf): Explosions-Effekte werden
  // gesammelt und nach der Schleife angewandt (Radius/Damage sind
  // multiplikativ, der Explosiv-Schalter setzt ggf. erst den Basisradius).
  let grantExplosive = false;
  let explBaseRadius = 0;
  let explRadMult = 1;
  let explDmgMult = 1;
  let schrapCount = 0;
  // UMBAUPLAN-LP Phase 13 (Feuer-Topf) -- generische Status-Boosts (gelten fuer
  // den Status des Klassen-Elements) + elementspezifische Dauer.
  let sDurMult = 1;
  let sTickMult = 1;
  let fireDurMult = 1;
  // Upgradepool-v2 Phase 8 (Signaturtopf Nekromant): multiplikative
  // Geisterpanzer-Effekte werden wie alle anderen multiplikativen Schluessel
  // gesammelt und erst nach der Schleife angewandt. Die additiven/booleschen
  // ghost*-Felder landen dagegen direkt auf cfg (Muster wie builtHpBonus/
  // scrapDamageBonus) -- ghost.js: resolveGhostCfg() liest sie aus dem
  // aufgeloesten Spieler-cfg, NICHT aus einem zweiten Effektsystem (Anhang A
  // S16/Anhang B S19: "keine Parallelsysteme").
  let ghostSpdMult = 1;
  let ghostFireCdMult = 1;
  let ghostDmgMult = 1;
  let ghostHpMultAcc = 1;
  // Nekromant-V2 Phase 6: zwei weitere gesammelt-multiplikative ghost*-Werte
  // (Geschosstempo/Reichweite der Untertanen), gleiches Muster wie die vier
  // obigen aus Upgradepool-v2 Phase 8.
  let ghostBulletSpdMult = 1;
  let ghostRangeMultAcc = 1;
  for (const id in U) {
    const raw = U[id].core;
    const lvl = l(id);
    if (!raw || !lvl) continue;
    const c = scaleCore(raw, stufeMultFor(id));
    if (c.damageAdd) cfg.damage += c.damageAdd * lvl;
    if (c.reloadMult) cfg.fireCooldown *= Math.pow(c.reloadMult, lvl);
    if (c.speedMult) cfg.speed *= Math.pow(c.speedMult, lvl);
    if (c.hpAdd) cfg.maxHp += c.hpAdd * lvl;
    if (c.magAdd) cfg.magazine += c.magAdd * lvl;
    // Grundsteinumbau Phase 1: c.ricochetAdd (Bandenschuss-Karten) wird
    // bewusst nicht mehr ausgewertet -- data/upgrades.json bleibt bis
    // Phase 4 unangetastet, die Karten greifen ins Leere statt Einzelausbau.
    if (c.critAdd) cfg.critChance += c.critAdd * lvl;
    if (c.scrapAdd) cfg.scrapBonusPerRoom = (cfg.scrapBonusPerRoom || 0) + c.scrapAdd * lvl;
    // UMBAUPLAN-LP Phase 25 (Signaturtopf Schrottpanzer): staerkt die
    // "reicher = staerker"-Skalierung. Addiert zum Klassen-Passiv
    // scrapDamagePer100 -- applyScrapDamage() (nach applyUpgrades in state.js)
    // liest den erhoehten Wert und skaliert den Schaden je 100 Schrott.
    if (c.scrapDamageBonus) cfg.scrapDamagePer100 = (cfg.scrapDamagePer100 || 0) + c.scrapDamageBonus * lvl;
    // UMBAUPLAN-LP Phase 27 (Signaturtopf Ingenieur): staerkere Sperrmauer.
    // Additiv zum Klassen-Passiv builtHpMult -- tank.js: placeTrapWall() liest
    // den erhoehten Faktor und baut eine haltbarere Mauer.
    if (c.builtHpBonus) cfg.builtHpMult = (cfg.builtHpMult || 1) + c.builtHpBonus * lvl;
    if (c.mineAdd) cfg.mines += c.mineAdd * lvl;
    if (c.dashGrant) {
      coreDashGrant = true;
      coreDashCdMult *= Math.pow(c.dashCdMult ?? 1, lvl);
    }
    // UMBAUPLAN-LP Phase 11 (Physisch-Topf): weitere generische Effektschluessel.
    if (c.bulletSpeedMult) spdMult *= Math.pow(c.bulletSpeedMult, lvl);
    if (c.damageMult) dmgMult *= Math.pow(c.damageMult, lvl);
    if (c.magazineFixed) magFixed = c.magazineFixed;
    // Trefferregeln, im Schadensschritt (state.js) ausgewertet:
    if (c.executeThreshold) {
      cfg.executeThreshold = c.executeThreshold;
      cfg.executeMult = (cfg.executeMult || 1) * Math.pow(c.executeMult ?? 1, lvl);
    }
    if (c.critMultBonus) cfg.critMultBonus = (cfg.critMultBonus || 0) + c.critMultBonus * lvl;
    if (c.critExecute) cfg.critExecute = true;
    // Grundsteinumbau Phase 1: c.critOnBounce/c.bounceDamageBonus/
    // c.bounceRampPerBounce (Abprallpanzer-Signaturtopf) werden bewusst nicht
    // mehr ausgewertet -- ihr einziger Leseort (state.js: Trefferschleife)
    // ist mit dem Bandenschuss entfallen. data/upgrades.json bleibt bis
    // Phase 4 unangetastet, die Klasse c_ricochet ist bis zu ihrem Neubau
    // ohne Identitaet (s. AUFTRAG-GRUNDSTEINUMBAU.md, Festgelegte
    // Entscheidungen).
    // Phase 12 (Sprengstoff-Topf):
    if (c.allExplosive) grantExplosive = true;
    if (c.shotExplosionRadius) explBaseRadius = Math.max(explBaseRadius, c.shotExplosionRadius);
    if (c.explosionRadiusMult) explRadMult *= Math.pow(c.explosionRadiusMult, lvl);
    if (c.explosionDamageMult) explDmgMult *= Math.pow(c.explosionDamageMult, lvl);
    if (c.schrapnellCount) schrapCount = Math.max(schrapCount, c.schrapnellCount);
    // Phase 13 (Feuer-Topf):
    if (c.statusDurationMult) sDurMult *= Math.pow(c.statusDurationMult, lvl);
    if (c.statusTickMult) sTickMult *= Math.pow(c.statusTickMult, lvl);
    if (c.statusStackBonus) cfg.statusStackBonus = (cfg.statusStackBonus || 0) + c.statusStackBonus * lvl;
    if (c.statusMaxStacksBonus) cfg.statusMaxStacksBonus = (cfg.statusMaxStacksBonus || 0) + c.statusMaxStacksBonus * lvl;
    if (c.fireDurationMult) fireDurMult *= Math.pow(c.fireDurationMult, lvl);
    if (c.fireSpreadRadius) cfg.fireSpreadRadius = Math.max(cfg.fireSpreadRadius || 0, c.fireSpreadRadius);
    // Phase 14 (Frost-Topf): frostSlowBonus ADDITIV zum Klassen-Passiv;
    // Freeze-Schwelle senken / Freeze-Dauer verlaengern; Schaden gegen
    // erstarrte Ziele.
    if (c.frostSlowBonus) cfg.frostSlowBonus = (cfg.frostSlowBonus || 0) + c.frostSlowBonus * lvl;
    if (c.frostFreezeReduction) cfg.frostFreezeReduction = (cfg.frostFreezeReduction || 0) + c.frostFreezeReduction * lvl;
    if (c.frostFreezeDurationBonus) cfg.frostFreezeDurationBonus = (cfg.frostFreezeDurationBonus || 0) + c.frostFreezeDurationBonus * lvl;
    if (c.shatterMult) cfg.shatterMult = (cfg.shatterMult || 0) + c.shatterMult * lvl;
    // Phase 15 (Gift-Topf): Gift-Ausbreitung (Seuche). Dauer/Tick/Stufen laufen
    // ueber die generischen Status-Boosts (Phase 13).
    if (c.poisonSpreadRadius) cfg.poisonSpreadRadius = Math.max(cfg.poisonSpreadRadius || 0, c.poisonSpreadRadius);
    // Phase 16 (Blitz-Topf): mehr Kettenziele (ADDITIV zum Klassen-Passiv),
    // groessere Sprungreichweite, schwaecherer Abfall, Betaeubung je Sprung.
    if (c.lightningBonusTargets) cfg.lightningBonusTargets = (cfg.lightningBonusTargets || 0) + c.lightningBonusTargets * lvl;
    if (c.lightningRangeBonus) cfg.lightningRangeBonus = (cfg.lightningRangeBonus || 0) + c.lightningRangeBonus * lvl;
    if (c.lightningFalloffBonus) cfg.lightningFalloffBonus = (cfg.lightningFalloffBonus || 0) + c.lightningFalloffBonus * lvl;
    if (c.lightningStun) cfg.lightningStun = Math.max(cfg.lightningStun || 0, c.lightningStun);
    // Upgradepool-v2 Phase 8 (Signaturtopf Nekromant): wirken NICHT auf den
    // Spieler selbst, sondern auf die Geistereinheit -- ghost.js:
    // resolveGhostCfg() liest diese Felder aus state.player.cfg.
    if (c.ghostHpAdd) cfg.ghostHpAdd = (cfg.ghostHpAdd || 0) + c.ghostHpAdd * lvl;
    if (c.ghostDamageAdd) cfg.ghostDamageAdd = (cfg.ghostDamageAdd || 0) + c.ghostDamageAdd * lvl;
    if (c.ghostSpeedMult) ghostSpdMult *= Math.pow(c.ghostSpeedMult, lvl);
    if (c.ghostFireMult) ghostFireCdMult *= Math.pow(c.ghostFireMult, lvl);
    if (c.ghostMaxAdd) cfg.ghostMaxAdd = (cfg.ghostMaxAdd || 0) + c.ghostMaxAdd * lvl;
    // Rudelgeist/Armee der Toten: additiv, mehrere Quellen summieren sich.
    if (c.ghostPackDamagePerAlly) {
      cfg.ghostPackDamagePerAlly = (cfg.ghostPackDamagePerAlly || 0) + c.ghostPackDamagePerAlly * lvl;
    }
    if (c.ghostLifestealPct) cfg.ghostLifestealPct = (cfg.ghostLifestealPct || 0) + c.ghostLifestealPct * lvl;
    if (c.ghostStunOnHit) cfg.ghostStunOnHit = (cfg.ghostStunOnHit || 0) + c.ghostStunOnHit * lvl;
    if (c.ghostDamageMult) ghostDmgMult *= Math.pow(c.ghostDamageMult, lvl);
    if (c.ghostHpMult) ghostHpMultAcc *= Math.pow(c.ghostHpMult, lvl);
    if (c.ghostDeathZoneRadius) {
      cfg.ghostDeathZoneRadius = (cfg.ghostDeathZoneRadius || 0) + c.ghostDeathZoneRadius * lvl;
    }
    if (c.ghostDeathZoneDamage) {
      cfg.ghostDeathZoneDamage = (cfg.ghostDeathZoneDamage || 0) + c.ghostDeathZoneDamage * lvl;
    }
    if (c.ghostReviveChance) cfg.ghostReviveChance = (cfg.ghostReviveChance || 0) + c.ghostReviveChance * lvl;
    if (c.ghostCommander) cfg.ghostCommander = true;
    if (c.ghostCommanderShield) cfg.ghostCommanderShield = true;
    // Unsterbliche Seele/Lich-Panzer: einzelne Karten mit maxStacks 1, ein
    // schlichter Max reicht (kein zweiter Kartenquellen-Fall vorgesehen).
    if (c.ghostReviveMaxUses) cfg.ghostReviveMaxUses = Math.max(cfg.ghostReviveMaxUses || 1, c.ghostReviveMaxUses);
    if (c.ghostCommanderMultBonus) {
      cfg.ghostCommanderMultBonus = (cfg.ghostCommanderMultBonus || 0) + c.ghostCommanderMultBonus * lvl;
    }
    if (c.ghostReviveGrowth) cfg.ghostReviveGrowth = (cfg.ghostReviveGrowth || 0) + c.ghostReviveGrowth * lvl;
    // Nekromant-V2 Phase 2 (Engine-Luecken): alle vier additiv, wie im
    // Auftrag Abschnitt 4a gefordert ("Prozentpunkte addieren, nicht
    // multiplizieren"). Noch keine echte Karte im Pool setzt sie.
    if (c.resistAdd) cfg.resist = (cfg.resist || 0) + c.resistAdd * lvl;
    if (c.pierceAdd) cfg.pierce = (cfg.pierce || 0) + c.pierceAdd * lvl;
    if (c.shieldMaxAdd) cfg.shieldMax = (cfg.shieldMax || 0) + c.shieldMaxAdd * lvl;
    if (c.shieldRegenAdd) cfg.shieldRegenPerS = (cfg.shieldRegenPerS || 0) + c.shieldRegenAdd * lvl;
    // Nekromant-V2 Phase 6 (Allgemein und Opfer, 35 Karten): weitere
    // ghost*-Felder (Untertanen-Eigenstats, ghost_005-010) -- dasselbe
    // Muster wie die bestehenden ghostHpAdd/ghostDamageAdd/... aus
    // Upgradepool-v2 Phase 8, additiv bzw. gesammelt-multiplikativ.
    if (c.ghostLifetimeAdd) cfg.ghostLifetimeAdd = (cfg.ghostLifetimeAdd || 0) + c.ghostLifetimeAdd * lvl;
    if (c.ghostBulletSpeedMult) ghostBulletSpdMult *= Math.pow(c.ghostBulletSpeedMult, lvl);
    if (c.ghostRangeMult) ghostRangeMultAcc *= Math.pow(c.ghostRangeMult, lvl);
    if (c.ghostCritChanceAdd) cfg.ghostCritChanceAdd = (cfg.ghostCritChanceAdd || 0) + c.ghostCritChanceAdd * lvl;
    if (c.ghostCritMultAdd) cfg.ghostCritMultAdd = (cfg.ghostCritMultAdd || 0) + c.ghostCritMultAdd * lvl;
    if (c.ghostShieldOnSpawnPct) cfg.ghostShieldOnSpawnPct = (cfg.ghostShieldOnSpawnPct || 0) + c.ghostShieldOnSpawnPct * lvl;
    if (c.ghostResistAdd) cfg.ghostResistAdd = (cfg.ghostResistAdd || 0) + c.ghostResistAdd * lvl;
    if (c.ghostFlankSeek) cfg.ghostFlankSeek = true;
    if (c.ghostFlankDamageBonus) cfg.ghostFlankDamageBonus = (cfg.ghostFlankDamageBonus || 0) + c.ghostFlankDamageBonus * lvl;
    // Nekromant-V2 Phase 6: Opfer-Karten (ghost_011-030, 032-035), die auf
    // Geistertode REAGIEREN statt nur Untertanen-Werte zu setzen. Reine
    // Datenuebernahme hier (dieselbe generische core-Schleife wie alles
    // andere) -- necro.js: buildNecroListeners() liest diese Felder aus dem
    // fertig aufgeloesten cfg und registriert daraus state.necroListeners.
    // Bewusst KEIN core-Objekt-Nesting/Effekt-DSL: jedes Feld ist ein
    // gewoehnlicher Skalar/Boolean, exakt das Muster der ghost*-Felder oben
    // -- "kein switch ueber Karten-IDs" ist damit erfuellt, ohne ein
    // zweites Parallelsystem zu bauen (Anhang A S16/Anhang B S19).
    if (c.necroDmgPctPerDeath) cfg.necroDmgPctPerDeath = (cfg.necroDmgPctPerDeath || 0) + c.necroDmgPctPerDeath * lvl;
    if (c.necroFireRatePctPerDeath) cfg.necroFireRatePctPerDeath = (cfg.necroFireRatePctPerDeath || 0) + c.necroFireRatePctPerDeath * lvl;
    if (c.necroSpeedPctPerDeath) cfg.necroSpeedPctPerDeath = (cfg.necroSpeedPctPerDeath || 0) + c.necroSpeedPctPerDeath * lvl;
    if (c.necroHealPctPerDeath) {
      cfg.necroHealPctPerDeath = (cfg.necroHealPctPerDeath || 0) + c.necroHealPctPerDeath * lvl;
      cfg.necroHealCooldownS = Math.max(cfg.necroHealCooldownS || 0, c.necroHealCooldownS || 0);
    }
    if (c.necroShieldPctPerDeath) {
      cfg.necroShieldPctPerDeath = (cfg.necroShieldPctPerDeath || 0) + c.necroShieldPctPerDeath * lvl;
      cfg.necroShieldDurationS = Math.max(cfg.necroShieldDurationS || 0, c.necroShieldDurationS || 0);
      // Auftrag Abschnitt 9: kein Deckel mehr -- die Karte stapelt unbegrenzt.
    }
    if (c.necroGadgetCooldownReduceS) {
      cfg.necroGadgetCooldownReduceS = (cfg.necroGadgetCooldownReduceS || 0) + c.necroGadgetCooldownReduceS * lvl;
      cfg.necroGadgetReduceCooldownS = Math.max(cfg.necroGadgetReduceCooldownS || 0, c.necroGadgetReduceCooldownS || 0);
    }
    if (c.necroBurstEveryN) {
      cfg.necroBurstEveryN = c.necroBurstEveryN;
      cfg.necroBurstDamageMult = Math.max(cfg.necroBurstDamageMult || 0, c.necroBurstDamageMult || 0);
      cfg.necroBurstSizeMult = Math.max(cfg.necroBurstSizeMult || 0, c.necroBurstSizeMult || 0);
    }
    if (c.necroAmmoShots) {
      cfg.necroAmmoShots = Math.max(cfg.necroAmmoShots || 0, c.necroAmmoShots);
      cfg.necroAmmoPierceAdd = (cfg.necroAmmoPierceAdd || 0) + (c.necroAmmoPierceAdd || 0) * lvl;
      cfg.necroAmmoSpeedMult = Math.max(cfg.necroAmmoSpeedMult || 0, c.necroAmmoSpeedMult || 0);
    }
    if (c.necroNextHitCritChanceAdd) {
      cfg.necroNextHitCritChanceAdd = (cfg.necroNextHitCritChanceAdd || 0) + c.necroNextHitCritChanceAdd * lvl;
      cfg.necroNextHitCritMultAdd = (cfg.necroNextHitCritMultAdd || 0) + (c.necroNextHitCritMultAdd || 0) * lvl;
    }
    if (c.necroExplosionRadius) {
      cfg.necroExplosionRadius = Math.max(cfg.necroExplosionRadius || 0, c.necroExplosionRadius);
      cfg.necroExplosionDamagePct = Math.max(cfg.necroExplosionDamagePct || 0, c.necroExplosionDamagePct || 0);
    }
    if (c.necroInheritHighPct) {
      cfg.necroInheritHighPct = Math.max(cfg.necroInheritHighPct || 0, c.necroInheritHighPct);
      cfg.necroInheritLowPct = Math.max(cfg.necroInheritLowPct || 0, c.necroInheritLowPct || 0);
      cfg.necroInheritDurationS = Math.max(cfg.necroInheritDurationS || 0, c.necroInheritDurationS || 0);
      cfg.necroInheritThresholdMult = Math.max(cfg.necroInheritThresholdMult || 0, c.necroInheritThresholdMult || 0);
    }
    if (c.necroResistEveryN) {
      cfg.necroResistEveryN = c.necroResistEveryN;
      cfg.necroResistAmount = Math.max(cfg.necroResistAmount || 0, c.necroResistAmount || 0);
      cfg.necroResistDurationS = Math.max(cfg.necroResistDurationS || 0, c.necroResistDurationS || 0);
    }
    // Auftrag Abschnitt 9: ghost_023 wandelt den GESAMTEN Ueberlauf in Schild
    // um (kein Prozentdeckel mehr) -- reines Freischalt-Flag statt Zahl.
    if (c.necroOverflowToShield) cfg.necroOverflowToShield = true;
    if (c.necroFireBurstWindowS) {
      cfg.necroFireBurstWindowS = c.necroFireBurstWindowS;
      cfg.necroFireBurstPct = Math.max(cfg.necroFireBurstPct || 0, c.necroFireBurstPct || 0);
      cfg.necroFireBurstDurationS = Math.max(cfg.necroFireBurstDurationS || 0, c.necroFireBurstDurationS || 0);
    }
    if (c.necroLastStand) {
      cfg.necroLastStand = true;
      cfg.necroLastStandHealPct = Math.max(cfg.necroLastStandHealPct || 0, c.necroLastStandHealPct || 0);
    }
    if (c.necroShockRadius) {
      cfg.necroShockRadius = Math.max(cfg.necroShockRadius || 0, c.necroShockRadius);
      cfg.necroShockDamagePct = Math.max(cfg.necroShockDamagePct || 0, c.necroShockDamagePct || 0);
      cfg.necroShockPushPx = Math.max(cfg.necroShockPushPx || 0, c.necroShockPushPx || 0);
      cfg.necroShockExecMult = Math.max(cfg.necroShockExecMult || 0, c.necroShockExecMult || 0);
      cfg.necroShockExecDurationS = Math.max(cfg.necroShockExecDurationS || 0, c.necroShockExecDurationS || 0);
    }
    if (c.necroDoubleStackChance) cfg.necroDoubleStackChance = Math.max(cfg.necroDoubleStackChance || 0, c.necroDoubleStackChance);
    if (c.necroExpireStackBonus) cfg.necroExpireStackBonus = (cfg.necroExpireStackBonus || 0) + c.necroExpireStackBonus * lvl;
    if (c.necroRunDmgEveryN) {
      cfg.necroRunDmgEveryN = c.necroRunDmgEveryN;
      cfg.necroRunDmgPct = Math.max(cfg.necroRunDmgPct || 0, c.necroRunDmgPct || 0);
    }
    if (c.necroRunHpEveryN) {
      cfg.necroRunHpEveryN = c.necroRunHpEveryN;
      cfg.necroRunHpPct = Math.max(cfg.necroRunHpPct || 0, c.necroRunHpPct || 0);
    }
    if (c.necroHomingEveryN) {
      cfg.necroHomingEveryN = c.necroHomingEveryN;
      cfg.necroHomingDamageMult = Math.max(cfg.necroHomingDamageMult || 0, c.necroHomingDamageMult || 0);
      cfg.necroHomingTurnRate = Math.max(cfg.necroHomingTurnRate || 0, c.necroHomingTurnRate || 0);
    }
    if (c.necroStartGhostPct) {
      cfg.necroStartGhostPct = Math.max(cfg.necroStartGhostPct || 0, c.necroStartGhostPct);
      cfg.necroStartGhostLifetimeS = Math.max(cfg.necroStartGhostLifetimeS || 0, c.necroStartGhostLifetimeS || 0);
    }
    if (c.necroKeystoneCount) {
      cfg.necroKeystoneCount = c.necroKeystoneCount;
      cfg.necroKeystoneWindowS = c.necroKeystoneWindowS || 0;
      cfg.necroKeystoneDamagePct = c.necroKeystoneDamagePct || 0;
      cfg.necroKeystoneFireRatePct = c.necroKeystoneFireRatePct || 0;
      cfg.necroKeystoneSpeedPct = c.necroKeystoneSpeedPct || 0;
      cfg.necroKeystoneDurationS = c.necroKeystoneDurationS || 0;
      cfg.necroKeystoneCooldownS = c.necroKeystoneCooldownS || 0;
    }
    if (c.necroVirtualDeathsOnStart) cfg.necroVirtualDeathsOnStart = Math.max(cfg.necroVirtualDeathsOnStart || 0, c.necroVirtualDeathsOnStart);
    // Nekromant-V2 Phase 7 (Legion, 25 Karten): weitere necro*/ghost*-Felder.
    // ghostMaxAdd/ghostLifetimeAdd/ghostPackDamagePerAlly/ghostDamageMult
    // sind bereits oben generisch behandelt (Wiederverwendung fuer
    // ghost_036/037/039/060 -- keine neue Zeile noetig).
    if (c.necroLegionResistThreshold) {
      cfg.necroLegionResistThreshold = Math.max(cfg.necroLegionResistThreshold || 0, c.necroLegionResistThreshold);
      cfg.necroLegionResistAmount = (cfg.necroLegionResistAmount || 0) + (c.necroLegionResistAmount || 0) * lvl;
    }
    if (c.necroFireRatePerAlly) cfg.necroFireRatePerAlly = (cfg.necroFireRatePerAlly || 0) + c.necroFireRatePerAlly * lvl;
    if (c.necroSharedTarget) {
      cfg.necroSharedTarget = true;
      cfg.necroSharedTargetDamageMult = Math.max(cfg.necroSharedTargetDamageMult || 1, c.necroSharedTargetDamageMult || 1);
    }
    if (c.necroPhalanxRadius) {
      cfg.necroPhalanxRadius = Math.max(cfg.necroPhalanxRadius || 0, c.necroPhalanxRadius);
      cfg.necroPhalanxResist = Math.max(cfg.necroPhalanxResist || 0, c.necroPhalanxResist || 0);
    }
    if (c.necroPackHealOnDeathPct) cfg.necroPackHealOnDeathPct = (cfg.necroPackHealOnDeathPct || 0) + c.necroPackHealOnDeathPct * lvl;
    if (c.necroReviveChanceAdd) cfg.necroReviveChanceAdd = (cfg.necroReviveChanceAdd || 0) + c.necroReviveChanceAdd * lvl;
    if (c.necroOverwhelmThreshold) {
      cfg.necroOverwhelmThreshold = Math.max(cfg.necroOverwhelmThreshold || 0, c.necroOverwhelmThreshold);
      cfg.necroOverwhelmBulletSizeMult = Math.max(cfg.necroOverwhelmBulletSizeMult || 1, c.necroOverwhelmBulletSizeMult || 1);
      cfg.necroOverwhelmBulletSpeedMult = Math.max(cfg.necroOverwhelmBulletSpeedMult || 1, c.necroOverwhelmBulletSpeedMult || 1);
    }
    if (c.necroVeteranAfterS) {
      cfg.necroVeteranAfterS = Math.max(cfg.necroVeteranAfterS || 0, c.necroVeteranAfterS);
      cfg.necroVeteranDamageMult = Math.max(cfg.necroVeteranDamageMult || 1, c.necroVeteranDamageMult || 1);
      cfg.necroVeteranHpMult = Math.max(cfg.necroVeteranHpMult || 1, c.necroVeteranHpMult || 1);
    }
    if (c.necroStormApproachSpeedMult) {
      cfg.necroStormApproachSpeedMult = Math.max(cfg.necroStormApproachSpeedMult || 1, c.necroStormApproachSpeedMult);
      cfg.necroStormApproachDamageMult = Math.max(cfg.necroStormApproachDamageMult || 1, c.necroStormApproachDamageMult || 1);
      cfg.necroStormFlankBonus = Math.max(cfg.necroStormFlankBonus || 0, c.necroStormFlankBonus || 0);
    }
    if (c.necroWallRadius) {
      cfg.necroWallRadius = Math.max(cfg.necroWallRadius || 0, c.necroWallRadius);
      cfg.necroWallShieldPct = Math.max(cfg.necroWallShieldPct || 0, c.necroWallShieldPct || 0);
      cfg.necroWallRegenPerS = Math.max(cfg.necroWallRegenPerS || 0, c.necroWallRegenPerS || 0);
      cfg.necroWallRegenDelayS = Math.max(cfg.necroWallRegenDelayS || 0, c.necroWallRegenDelayS || 0);
    }
    if (c.necroOfficerRadius) {
      cfg.necroOfficerRadius = Math.max(cfg.necroOfficerRadius || 0, c.necroOfficerRadius);
      cfg.necroOfficerDamageMult = Math.max(cfg.necroOfficerDamageMult || 1, c.necroOfficerDamageMult || 1);
      cfg.necroOfficerFireRateBonus = Math.max(cfg.necroOfficerFireRateBonus || 0, c.necroOfficerFireRateBonus || 0);
    }
    // Auftrag Abschnitt 9: kein Deckel mehr -- der Stapel waechst mit jedem
    // Schuss unbegrenzt (ghost.js: updateGhosts() rechnet ihn ueber
    // fireRateFactor() in eine stabile Feuerrate um).
    if (c.necroAmmoExchangePerShot) cfg.necroAmmoExchangePerShot = Math.max(cfg.necroAmmoExchangePerShot || 0, c.necroAmmoExchangePerShot);
    if (c.necroErbmunitionShots) {
      cfg.necroErbmunitionShots = Math.max(cfg.necroErbmunitionShots || 0, c.necroErbmunitionShots);
      cfg.necroErbmunitionDamagePct = Math.max(cfg.necroErbmunitionDamagePct || 0, c.necroErbmunitionDamagePct || 0);
    }
    if (c.necroDoubleReviveChance) {
      cfg.necroDoubleReviveChance = Math.max(cfg.necroDoubleReviveChance || 0, c.necroDoubleReviveChance);
      cfg.necroDoubleReviveStatPct = Math.max(cfg.necroDoubleReviveStatPct || 0, c.necroDoubleReviveStatPct || 0);
    }
    if (c.necroHullThresholdPct) cfg.necroHullThresholdPct = Math.max(cfg.necroHullThresholdPct || 0, c.necroHullThresholdPct);
    if (c.necroCoreHealPct) {
      cfg.necroCoreHealPct = Math.max(cfg.necroCoreHealPct || 0, c.necroCoreHealPct);
      cfg.necroCoreDamageBonus = Math.max(cfg.necroCoreDamageBonus || 0, c.necroCoreDamageBonus || 0);
      cfg.necroCoreCooldownS = Math.max(cfg.necroCoreCooldownS || 0, c.necroCoreCooldownS || 0);
    }
    // ghost_116 "Losgeloeste Ketten" (Abschnitt 9): reines Freischalt-Flag,
    // isUnique -- kein Level-Faktor noetig.
    if (c.necroForceMobileBomb) cfg.necroForceMobileBomb = true;
    if (c.necroEliteRevive) {
      cfg.necroEliteRevive = true;
      cfg.necroEliteReviveStatPct = Math.max(cfg.necroEliteReviveStatPct || 0, c.necroEliteReviveStatPct || 0);
      cfg.necroEliteReviveSlots = Math.max(cfg.necroEliteReviveSlots || 1, c.necroEliteReviveSlots || 1);
    }
    if (c.necroSharedWillThreshold) {
      cfg.necroSharedWillThreshold = Math.max(cfg.necroSharedWillThreshold || 0, c.necroSharedWillThreshold);
      cfg.necroSharedWillResist = Math.max(cfg.necroSharedWillResist || 0, c.necroSharedWillResist || 0);
    }
    if (c.necroChorusOfDead) cfg.necroChorusOfDead = true;
    if (c.necroGraveyardBonus) {
      cfg.necroGraveyardBonus = Math.max(cfg.necroGraveyardBonus || 0, c.necroGraveyardBonus);
      cfg.necroGraveyardCount = Math.max(cfg.necroGraveyardCount || 0, c.necroGraveyardCount || 0);
    }
    if (c.necroGuaranteedReviveCopy) {
      cfg.necroGuaranteedReviveCopy = true;
      cfg.necroGuaranteedReviveStatPct = Math.max(cfg.necroGuaranteedReviveStatPct || 0, c.necroGuaranteedReviveStatPct || 0);
    }
    // Nekromant-V2 Phase 8 (Alpha und Verschmelzung, 25 Karten): weitere
    // necroCrown*/necroFusion*/necroSolo*-Felder. "Kronenboni" (ghost_061-070,
    // 074-084) sind bewusst STATELESS -- sie werden in ghost.js LIVE gegen
    // isChampion ausgewertet (Muster wie die bestehenden Auren aus Phase 7),
    // nicht in cfg gebacken, weil "Champion" sich pro Tick neu bestimmt.
    // "Fusionsboni" (necroFusion*) sind dagegen die einzigen Werte, die
    // ghost_080 "Kronenerbe" tatsaechlich an einen Nachfolger uebertragen
    // muss (s. ghost.js: applyFusionTransfer/state.necroCrownHeir) --
    // Kronenboni braucht der Nachfolger nicht uebertragen zu bekommen, er
    // liest sie automatisch selbst aus demselben Spieler-cfg, sobald ER
    // isChampion wird.
    if (c.necroCrownDamagePct) cfg.necroCrownDamagePct = (cfg.necroCrownDamagePct || 0) + c.necroCrownDamagePct * lvl;
    if (c.necroCrownHpPct) cfg.necroCrownHpPct = (cfg.necroCrownHpPct || 0) + c.necroCrownHpPct * lvl;
    // Nachschliff Abschnitt 8 (fuenf Champion-Lebensdauer-Karten): additiv,
    // unbegrenzt stapelbar -- wirkt NUR auf den Champion (ghost.js:
    // promoteToChampion()), nicht auf gewoehnliche Untertanen (dafuer bleibt
    // ghostLifetimeAdd/ghost_005 zustaendig, das seit Abschnitt 10
    // ZUSAETZLICH auch den Champion mit einschliesst).
    if (c.necroCrownLifetimeAdd) cfg.necroCrownLifetimeAdd = (cfg.necroCrownLifetimeAdd || 0) + c.necroCrownLifetimeAdd * lvl;
    // "Ewiger Thron" (ghost_083, Nachschliff Abschnitt 3.2): einzige Karte,
    // die die Champion-Lebensdauer auf unendlich zurueckstellt.
    if (c.necroCrownEternalLifetime) cfg.necroCrownEternalLifetime = true;
    if (c.necroSoloDamagePct) cfg.necroSoloDamagePct = (cfg.necroSoloDamagePct || 0) + c.necroSoloDamagePct * lvl;
    if (c.necroSoloFireRatePct) cfg.necroSoloFireRatePct = (cfg.necroSoloFireRatePct || 0) + c.necroSoloFireRatePct * lvl;
    if (c.necroCrownResist) cfg.necroCrownResist = (cfg.necroCrownResist || 0) + c.necroCrownResist * lvl;
    if (c.necroCrownEliteBossDamagePct) cfg.necroCrownEliteBossDamagePct = (cfg.necroCrownEliteBossDamagePct || 0) + c.necroCrownEliteBossDamagePct * lvl;
    if (c.necroCrownHealOnAllyDeathPct) cfg.necroCrownHealOnAllyDeathPct = (cfg.necroCrownHealOnAllyDeathPct || 0) + c.necroCrownHealOnAllyDeathPct * lvl;
    if (c.necroCrownTargetStrongest) cfg.necroCrownTargetStrongest = true;
    if (c.necroCrownBulletSpeedPct) cfg.necroCrownBulletSpeedPct = (cfg.necroCrownBulletSpeedPct || 0) + c.necroCrownBulletSpeedPct * lvl;
    if (c.necroCrownRangePct) cfg.necroCrownRangePct = (cfg.necroCrownRangePct || 0) + c.necroCrownRangePct * lvl;
    if (c.necroCrownShieldOnCrownPct) cfg.necroCrownShieldOnCrownPct = Math.max(cfg.necroCrownShieldOnCrownPct || 0, c.necroCrownShieldOnCrownPct);
    // necroCrownLifetimeBonusS (ghost_068 alt) ist ersatzlos entfernt -- der
    // Champion hat seit der Champion-Ueberarbeitung standardmaessig keine
    // Lebensdauer mehr, eine Lebensdauer-Verlaengerung waere wirkungslos.
    // ghost_068 nutzt jetzt necroCrownHpPct (Zeile oben), kein eigenes Feld.
    if (c.necroCrownCritChanceAdd) cfg.necroCrownCritChanceAdd = (cfg.necroCrownCritChanceAdd || 0) + c.necroCrownCritChanceAdd * lvl;
    if (c.necroCrownCritMultAdd) cfg.necroCrownCritMultAdd = (cfg.necroCrownCritMultAdd || 0) + c.necroCrownCritMultAdd * lvl;
    if (c.necroCrownAuraRadius) {
      cfg.necroCrownAuraRadius = Math.max(cfg.necroCrownAuraRadius || 0, c.necroCrownAuraRadius);
      cfg.necroCrownAuraDamageTakenReduction = Math.max(cfg.necroCrownAuraDamageTakenReduction || 0, c.necroCrownAuraDamageTakenReduction || 0);
      cfg.necroCrownAuraGhostDamageBonus = Math.max(cfg.necroCrownAuraGhostDamageBonus || 0, c.necroCrownAuraGhostDamageBonus || 0);
    }
    if (c.necroUniqueThrone) {
      cfg.necroUniqueThrone = true;
      cfg.necroFusionHpPct = Math.max(cfg.necroFusionHpPct || 0, c.necroFusionHpPct || 0);
      cfg.necroFusionDamagePct = Math.max(cfg.necroFusionDamagePct || 0, c.necroFusionDamagePct || 0);
      cfg.necroFusionFireRatePct = Math.max(cfg.necroFusionFireRatePct || 0, c.necroFusionFireRatePct || 0);
      // ghost_071 "Einziger Thron" (Nachschliff Abschnitt 5): +X % je bereits
      // erfolgter Verschmelzung des Champions, OHNE Obergrenze.
      cfg.necroUniqueThronePerFusionPct = Math.max(
        cfg.necroUniqueThronePerFusionPct || 0,
        c.necroUniqueThronePerFusionPct || 0,
      );
      // necroFusionMinLifetimeS (ghost_071 alt) ist ersatzlos entfernt --
      // die Champion-Lebensdauer laeuft seit dem Nachschliff wieder ueber
      // die gemeinsame ghostLifetimeAdd/necroCrownLifetimeAdd-Rechnung.
    }
    if (c.necroFusionHpPctBonus) cfg.necroFusionHpPctBonus = (cfg.necroFusionHpPctBonus || 0) + c.necroFusionHpPctBonus * lvl;
    if (c.necroFusionDamagePctBonus) cfg.necroFusionDamagePctBonus = (cfg.necroFusionDamagePctBonus || 0) + c.necroFusionDamagePctBonus * lvl;
    if (c.necroFusionFireRatePctBonus) cfg.necroFusionFireRatePctBonus = (cfg.necroFusionFireRatePctBonus || 0) + c.necroFusionFireRatePctBonus * lvl;
    // ghost_073 "Endloser Anspruch" (angepasst): Schild statt Lebensdauer-
    // Verlaengerung, s. ghost.js: fuseGhost().
    if (c.necroFusionShieldOnFusionPct) cfg.necroFusionShieldOnFusionPct = Math.max(cfg.necroFusionShieldOnFusionPct || 0, c.necroFusionShieldOnFusionPct);
    if (c.necroCrownBulletSizePct) cfg.necroCrownBulletSizePct = (cfg.necroCrownBulletSizePct || 0) + c.necroCrownBulletSizePct * lvl;
    if (c.necroFusionBulletSizePctPerFusion) cfg.necroFusionBulletSizePctPerFusion = (cfg.necroFusionBulletSizePctPerFusion || 0) + c.necroFusionBulletSizePctPerFusion * lvl;
    // Auftrag Abschnitt 9: kein Schild-Deckel mehr (ghost_075 "Raubseele") --
    // der Ueberlauf-Schild waechst wie der Schild-Punktepool unbegrenzt.
    if (c.necroCrownLifestealToPlayerPct) cfg.necroCrownLifestealToPlayerPct = (cfg.necroCrownLifestealToPlayerPct || 0) + c.necroCrownLifestealToPlayerPct * lvl;
    if (c.necroCrownEveryNShots) {
      cfg.necroCrownEveryNShots = Math.max(cfg.necroCrownEveryNShots || 0, c.necroCrownEveryNShots);
      cfg.necroCrownExtraShotDamagePct = Math.max(cfg.necroCrownExtraShotDamagePct || 0, c.necroCrownExtraShotDamagePct || 0);
    }
    if (c.necroCrownPierceAdd) cfg.necroCrownPierceAdd = (cfg.necroCrownPierceAdd || 0) + c.necroCrownPierceAdd * lvl;
    if (c.necroCrownFusionDamagePer3) cfg.necroCrownFusionDamagePer3 = (cfg.necroCrownFusionDamagePer3 || 0) + c.necroCrownFusionDamagePer3 * lvl;
    if (c.necroCrownAlphaShotEvery) {
      cfg.necroCrownAlphaShotEvery = Math.max(cfg.necroCrownAlphaShotEvery || 0, c.necroCrownAlphaShotEvery);
      cfg.necroCrownAlphaShotDamageMult = Math.max(cfg.necroCrownAlphaShotDamageMult || 1, c.necroCrownAlphaShotDamageMult || 1);
      cfg.necroCrownAlphaShotPierceAdd = Math.max(cfg.necroCrownAlphaShotPierceAdd || 0, c.necroCrownAlphaShotPierceAdd || 0);
    }
    if (c.necroCrownUnassailable) {
      cfg.necroCrownUnassailable = true;
      cfg.necroCrownUnassailableS = Math.max(cfg.necroCrownUnassailableS || 0, c.necroCrownUnassailableS || 0);
    }
    if (c.necroCrownHeirPct) cfg.necroCrownHeirPct = Math.max(cfg.necroCrownHeirPct || 0, c.necroCrownHeirPct);
    if (c.necroCrownAnchorAfterS) {
      cfg.necroCrownAnchorAfterS = Math.max(cfg.necroCrownAnchorAfterS || 0, c.necroCrownAnchorAfterS);
      cfg.necroCrownAnchorDamagePct = (cfg.necroCrownAnchorDamagePct || 0) + (c.necroCrownAnchorDamagePct || 0) * lvl;
      cfg.necroCrownAnchorRangePct = (cfg.necroCrownAnchorRangePct || 0) + (c.necroCrownAnchorRangePct || 0) * lvl;
      cfg.necroCrownAnchorResist = (cfg.necroCrownAnchorResist || 0) + (c.necroCrownAnchorResist || 0) * lvl;
    }
    if (c.necroChampionExecThreshold) {
      cfg.necroChampionExecThreshold = Math.max(cfg.necroChampionExecThreshold || 0, c.necroChampionExecThreshold);
      cfg.necroChampionExecDurationS = Math.max(cfg.necroChampionExecDurationS || 0, c.necroChampionExecDurationS || 0);
    }
    // necroCrownNoLifetimeDecay (ghost_083 alt) ist ersatzlos entfernt --
    // ghost_083 nutzt jetzt necroCrownDamagePct/necroCrownHpPct (s. oben),
    // da der Champion standardmaessig ohnehin keine Lebensdauer mehr hat.
    if (c.necroCrownImmortalKingHealPct) {
      cfg.necroCrownImmortalKingHealPct = Math.max(cfg.necroCrownImmortalKingHealPct || 0, c.necroCrownImmortalKingHealPct);
      cfg.necroCrownImmortalKingInvulnS = Math.max(cfg.necroCrownImmortalKingInvulnS || 0, c.necroCrownImmortalKingInvulnS || 0);
      cfg.necroCrownImmortalKingCooldownS = Math.max(cfg.necroCrownImmortalKingCooldownS || 0, c.necroCrownImmortalKingCooldownS || 0);
    }
    if (c.necroFusionReplace) {
      cfg.necroFusionReplace = true;
      cfg.necroFusionReplaceHpPct = Math.max(cfg.necroFusionReplaceHpPct || 0, c.necroFusionReplaceHpPct || 0);
      cfg.necroFusionReplaceDamagePct = Math.max(cfg.necroFusionReplaceDamagePct || 0, c.necroFusionReplaceDamagePct || 0);
      cfg.necroFusionReplaceFireRatePct = Math.max(cfg.necroFusionReplaceFireRatePct || 0, c.necroFusionReplaceFireRatePct || 0);
    }
    // Nekromant-V2 Phase 9 (Hybride und Aktivkarten, 20 Karten): weitere
    // necroHybrid*/necroKeystone*/necroCrown*/necroActive*/necro*-Felder.
    // Aktivkarten (ghost_031/089/096) tragen zusaetzlich `necroActiveKind`
    // (Text-Kennung, kein Zahlwert) -- tank.js: useGadget() liest sie darueber
    // aus. Nur EINE Aktivkarte kann gleichzeitig ausgeruestet sein
    // (run.equippedGadget), Max statt Summe waere hier irrefuehrend, deshalb
    // reicht ein simples ||=.
    if (c.necroActiveKind) cfg.necroActiveKind = cfg.necroActiveKind || c.necroActiveKind;
    if (c.necroActiveDmgPct) cfg.necroActiveDmgPct = Math.max(cfg.necroActiveDmgPct || 0, c.necroActiveDmgPct);
    if (c.necroActiveFireRatePct) cfg.necroActiveFireRatePct = Math.max(cfg.necroActiveFireRatePct || 0, c.necroActiveFireRatePct);
    if (c.necroActiveDurationS) cfg.necroActiveDurationS = Math.max(cfg.necroActiveDurationS || 0, c.necroActiveDurationS);
    if (c.necroHybridDeathPlayerDmgPct) {
      cfg.necroHybridDeathPlayerDmgPct = Math.max(cfg.necroHybridDeathPlayerDmgPct || 0, c.necroHybridDeathPlayerDmgPct);
      cfg.necroHybridDeathGhostDmgPct = Math.max(cfg.necroHybridDeathGhostDmgPct || 0, c.necroHybridDeathGhostDmgPct || 0);
      cfg.necroHybridDeathBuffDurationS = Math.max(cfg.necroHybridDeathBuffDurationS || 0, c.necroHybridDeathBuffDurationS || 0);
    }
    if (c.necroHybridRandomTransferPct) {
      cfg.necroHybridRandomTransferPct = Math.max(cfg.necroHybridRandomTransferPct || 0, c.necroHybridRandomTransferPct);
      cfg.necroHybridRandomTransferShieldPct = Math.max(cfg.necroHybridRandomTransferShieldPct || 0, c.necroHybridRandomTransferShieldPct || 0);
    }
    if (c.necroHybridPerAllyDmgPct) {
      cfg.necroHybridPerAllyDmgPct = (cfg.necroHybridPerAllyDmgPct || 0) + c.necroHybridPerAllyDmgPct * lvl;
      cfg.necroHybridFlankBonusPct = (cfg.necroHybridFlankBonusPct || 0) + (c.necroHybridFlankBonusPct || 0) * lvl;
      cfg.necroHybridReviveDeathBonusPct = Math.max(cfg.necroHybridReviveDeathBonusPct || 0, c.necroHybridReviveDeathBonusPct || 0);
      // Auftrag Abschnitt 9: kein Deckel mehr (ghost_088 "Blutige Formation").
    }
    if (c.necroSacrificeHealPct) {
      cfg.necroSacrificeHealPct = Math.max(cfg.necroSacrificeHealPct || 0, c.necroSacrificeHealPct);
      cfg.necroSacrificeShieldPct = Math.max(cfg.necroSacrificeShieldPct || 0, c.necroSacrificeShieldPct || 0);
      cfg.necroSacrificeGuaranteeWindowS = Math.max(cfg.necroSacrificeGuaranteeWindowS || 0, c.necroSacrificeGuaranteeWindowS || 0);
    }
    if (c.necroHybridReplacementChance) {
      cfg.necroHybridReplacementChance = Math.max(cfg.necroHybridReplacementChance || 0, c.necroHybridReplacementChance);
      cfg.necroHybridReplacementStatPct = Math.max(cfg.necroHybridReplacementStatPct || 0, c.necroHybridReplacementStatPct || 0);
      cfg.necroHybridReplacementLifetimeS = Math.max(cfg.necroHybridReplacementLifetimeS || 0, c.necroHybridReplacementLifetimeS || 0);
    }
    if (c.necroKeystoneAvalancheWindowS) {
      cfg.necroKeystoneAvalancheWindowS = Math.max(cfg.necroKeystoneAvalancheWindowS || 0, c.necroKeystoneAvalancheWindowS);
      cfg.necroKeystoneAvalancheCount = Math.max(cfg.necroKeystoneAvalancheCount || 0, c.necroKeystoneAvalancheCount || 0);
      cfg.necroKeystoneAvalancheSpawn = Math.max(cfg.necroKeystoneAvalancheSpawn || 0, c.necroKeystoneAvalancheSpawn || 0);
      cfg.necroKeystoneAvalancheStatPct = Math.max(cfg.necroKeystoneAvalancheStatPct || 0, c.necroKeystoneAvalancheStatPct || 0);
      cfg.necroKeystoneAvalancheDmgPct = Math.max(cfg.necroKeystoneAvalancheDmgPct || 0, c.necroKeystoneAvalancheDmgPct || 0);
      cfg.necroKeystoneAvalancheFRPct = Math.max(cfg.necroKeystoneAvalancheFRPct || 0, c.necroKeystoneAvalancheFRPct || 0);
      cfg.necroKeystoneAvalancheDurationS = Math.max(cfg.necroKeystoneAvalancheDurationS || 0, c.necroKeystoneAvalancheDurationS || 0);
      cfg.necroKeystoneAvalancheCooldownS = Math.max(cfg.necroKeystoneAvalancheCooldownS || 0, c.necroKeystoneAvalancheCooldownS || 0);
    }
    if (c.necroFusionHalfDeathForStacks) cfg.necroFusionHalfDeathForStacks = true;
    if (c.necroHybridChampionKillsPerSpawn) {
      cfg.necroHybridChampionKillsPerSpawn = Math.max(cfg.necroHybridChampionKillsPerSpawn || 0, c.necroHybridChampionKillsPerSpawn);
      cfg.necroHybridChampionSpawnStatPct = Math.max(cfg.necroHybridChampionSpawnStatPct || 0, c.necroHybridChampionSpawnStatPct || 0);
      cfg.necroHybridChampionSpawnLifetimeS = Math.max(cfg.necroHybridChampionSpawnLifetimeS || 0, c.necroHybridChampionSpawnLifetimeS || 0);
    }
    if (c.necroCrownDeathDmgTransferPct) {
      cfg.necroCrownDeathDmgTransferPct = Math.max(cfg.necroCrownDeathDmgTransferPct || 0, c.necroCrownDeathDmgTransferPct);
      cfg.necroCrownDeathHpShieldPct = Math.max(cfg.necroCrownDeathHpShieldPct || 0, c.necroCrownDeathHpShieldPct || 0);
    }
    if (c.necroSoulbondPct) {
      cfg.necroSoulbondPct = Math.max(cfg.necroSoulbondPct || 0, c.necroSoulbondPct);
      cfg.necroSoulbondBuffPct = Math.max(cfg.necroSoulbondBuffPct || 0, c.necroSoulbondBuffPct || 0);
      cfg.necroSoulbondBuffDurationS = Math.max(cfg.necroSoulbondBuffDurationS || 0, c.necroSoulbondBuffDurationS || 0);
    }
    // ghost_096 "Koenigliches Opfer" (Nachschliff Abschnitt 10,
    // UEBERARBEITET): ein einzelner Prozentsatz ("40 % der Champion-
    // Basiswerte") statt vier getrennter, zeitlich befristeter Felder.
    if (c.necroSacrificeChampionStatPct) {
      cfg.necroSacrificeChampionStatPct = Math.max(cfg.necroSacrificeChampionStatPct || 0, c.necroSacrificeChampionStatPct);
    }
    if (c.necroKeystoneThroneDmgPct) {
      cfg.necroKeystoneThroneDmgPct = Math.max(cfg.necroKeystoneThroneDmgPct || 0, c.necroKeystoneThroneDmgPct);
      cfg.necroKeystoneThroneShieldPct = Math.max(cfg.necroKeystoneThroneShieldPct || 0, c.necroKeystoneThroneShieldPct || 0);
      // Auftrag Abschnitt 9: kein Schadensdeckel mehr (ghost_097
      // "Thron aus Gebein") -- der versteckte Schild-Deckel in necro.js
      // faellt ebenfalls, s. dort.
    }
    if (c.necroCapFusion) {
      cfg.necroCapFusion = true;
      cfg.necroCapFusionHpPct = Math.max(cfg.necroCapFusionHpPct || 0, c.necroCapFusionHpPct || 0);
      cfg.necroCapFusionDamagePct = Math.max(cfg.necroCapFusionDamagePct || 0, c.necroCapFusionDamagePct || 0);
      cfg.necroCapFusionFireRatePct = Math.max(cfg.necroCapFusionFireRatePct || 0, c.necroCapFusionFireRatePct || 0);
    }
    if (c.necroCrownProcPerAllyPct) {
      cfg.necroCrownProcPerAllyPct = Math.max(cfg.necroCrownProcPerAllyPct || 0, c.necroCrownProcPerAllyPct);
      if (c.necroCrownProcHalfPermanent) cfg.necroCrownProcHalfPermanent = true;
    }
    if (c.necroSuccessionPct) cfg.necroSuccessionPct = Math.max(cfg.necroSuccessionPct || 0, c.necroSuccessionPct);
    if (c.necroHybridGhostKillReviveChance) cfg.necroHybridGhostKillReviveChance = Math.max(cfg.necroHybridGhostKillReviveChance || 0, c.necroHybridGhostKillReviveChance);
    if (c.necroCrownGuardResistPerAlly) {
      cfg.necroCrownGuardResistPerAlly = Math.max(cfg.necroCrownGuardResistPerAlly || 0, c.necroCrownGuardResistPerAlly);
      cfg.necroCrownGuardSoloShieldPct = Math.max(cfg.necroCrownGuardSoloShieldPct || 0, c.necroCrownGuardSoloShieldPct || 0);
      cfg.necroCrownGuardSoloIntervalS = Math.max(cfg.necroCrownGuardSoloIntervalS || 0, c.necroCrownGuardSoloIntervalS || 0);
    }
    if (c.necroCrownMassDmgPerSlot) {
      cfg.necroCrownMassDmgPerSlot = Math.max(cfg.necroCrownMassDmgPerSlot || 0, c.necroCrownMassDmgPerSlot);
      cfg.necroCrownMassHpPerSlot = Math.max(cfg.necroCrownMassHpPerSlot || 0, c.necroCrownMassHpPerSlot || 0);
      cfg.necroCrownMassSlotThreshold = Math.max(cfg.necroCrownMassSlotThreshold || 0, c.necroCrownMassSlotThreshold || 0);
      cfg.necroCrownMassSoloFireRatePct = Math.max(cfg.necroCrownMassSoloFireRatePct || 0, c.necroCrownMassSoloFireRatePct || 0);
    }
    if (c.necroKeystoneCircleThreshold) {
      cfg.necroKeystoneCircleThreshold = Math.max(cfg.necroKeystoneCircleThreshold || 0, c.necroKeystoneCircleThreshold);
      cfg.necroKeystoneCircleReviveStatPct = Math.max(cfg.necroKeystoneCircleReviveStatPct || 0, c.necroKeystoneCircleReviveStatPct || 0);
      cfg.necroKeystoneCircleDmgPct = Math.max(cfg.necroKeystoneCircleDmgPct || 0, c.necroKeystoneCircleDmgPct || 0);
      cfg.necroKeystoneCircleDurationS = Math.max(cfg.necroKeystoneCircleDurationS || 0, c.necroKeystoneCircleDurationS || 0);
    }
    if (c.necroAncestorBuffOnDeath) {
      cfg.necroAncestorBuffOnDeath = true;
      cfg.necroAncestorBuffDmgPct = Math.max(cfg.necroAncestorBuffDmgPct || 0, c.necroAncestorBuffDmgPct || 0);
      cfg.necroAncestorBuffFRPct = Math.max(cfg.necroAncestorBuffFRPct || 0, c.necroAncestorBuffFRPct || 0);
      cfg.necroAncestorBuffDurationS = Math.max(cfg.necroAncestorBuffDurationS || 0, c.necroAncestorBuffDurationS || 0);
    }
  }
  cfg.damage = Math.round(cfg.damage * dmgMult);
  cfg.bulletSpeed *= spdMult;
  if (magFixed != null) cfg.magazine = magFixed; // Railgun: nach magAdd, gewinnt
  // Grundsteinumbau Phase 7: magAdd/mineAdd koennen durch die Stufen-
  // Skalierung (scaleCore) fraktional werden (z. B. magAdd 1 -> 1.5 bei
  // Stufe 1) -- Magazin/Minenzahl sind Stueckzahlen, deshalb hier gerundet.
  cfg.magazine = Math.round(cfg.magazine);
  cfg.mines = Math.round(cfg.mines);
  // Durchschlag ist ebenfalls eine Stueckzahl (Anzahl zusaetzlicher Ziele).
  cfg.pierce = Math.round(cfg.pierce || 0);
  // Sprengstoff-Topf: Schuesse zuenden lassen (Basisradius setzen, falls noch
  // keiner steht), dann Radius/Schaden multiplizieren (gilt fuer Schuss UND
  // Mine -- mineRadiusMult wurde oben schon gesetzt). explosionDamageMult liest
  // explodeAt (state.js/mine.js) beim Zuenden aus b.owner/mine.owner.
  if (grantExplosive) {
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = cfg.shotExplosionRadius || explBaseRadius || 50;
  }
  if (explRadMult !== 1) {
    if (cfg.shotExplosionRadius) cfg.shotExplosionRadius *= explRadMult;
    cfg.mineRadiusMult = (cfg.mineRadiusMult || 1) * explRadMult;
  }
  if (explDmgMult !== 1) cfg.explosionDamageMult = (cfg.explosionDamageMult || 1) * explDmgMult;
  if (schrapCount) cfg.schrapnell = Math.max(cfg.schrapnell || 0, schrapCount);
  // Phase 13: generische Status-Multiplikatoren; fireDurationMult multipliziert
  // das (evtl. schon vom Klassen-Passiv gesetzte) cfg.fireDurationMult.
  if (sDurMult !== 1) cfg.statusDurationMult = (cfg.statusDurationMult || 1) * sDurMult;
  if (sTickMult !== 1) cfg.statusTickMult = (cfg.statusTickMult || 1) * sTickMult;
  if (fireDurMult !== 1) cfg.fireDurationMult = (cfg.fireDurationMult || 1) * fireDurMult;
  // Upgradepool-v2 Phase 8: gesammelte Geisterpanzer-Multiplikatoren.
  if (ghostSpdMult !== 1) cfg.ghostSpeedMult = (cfg.ghostSpeedMult || 1) * ghostSpdMult;
  if (ghostFireCdMult !== 1) cfg.ghostFireMult = (cfg.ghostFireMult || 1) * ghostFireCdMult;
  if (ghostDmgMult !== 1) cfg.ghostDamageMult = (cfg.ghostDamageMult || 1) * ghostDmgMult;
  if (ghostHpMultAcc !== 1) cfg.ghostHpMult = (cfg.ghostHpMult || 1) * ghostHpMultAcc;
  if (ghostBulletSpdMult !== 1) cfg.ghostBulletSpeedMult = (cfg.ghostBulletSpeedMult || 1) * ghostBulletSpdMult;
  if (ghostRangeMultAcc !== 1) cfg.ghostRangeMult = (cfg.ghostRangeMult || 1) * ghostRangeMultAcc;
  // Ausweichen-Kernkarten schalten den Dash frei (unabhaengig von der alten
  // dash-Karte) und verkuerzen die Abklingzeit. Reusen dieselbe dash-Definition.
  if (coreDashGrant) {
    const base = cfg.dash || { dist: U.dash.distancePx, iframe: U.dash.iframeS, cooldown: U.dash.cooldownS };
    cfg.dash = { ...base, cooldown: base.cooldown * coreDashCdMult };
  }
  return cfg;
}

// Raumkontext auf ein aufgeloestes cfg anwenden (Nutzer-Balancerunde):
// manche Karten sollen nur in bestimmten Raumarten wirken. Laeuft nach
// applyUpgrades() an denselben drei Stellen wie applyRoomModifier()
// (createState, respawnPlayer, updateWave).
//   ctx = { elite: bool, boss: bool }
// Ist dieses cfg ein Boss? (UMBAUPLAN-LP Phase 2). Bewusst ueber die drei
// bereits vorhandenen Boss-Schalter statt ueber ein viertes Datenfeld --
// dieselbe Erkennung, die stepState() (mirrorBoss/phalanx) und applyDamage()
// (bossInvincible) ohnehin benutzen, nur an einer Stelle benannt.
export function isBossCfg(cfg) {
  return !!(cfg && (cfg.bossInvincible || cfg.mirrorBoss || cfg.phalanx));
}

// Lebenspunkte pro Raum hochskalieren (UMBAUPLAN-LP Phase 2). Wird VOR
// createTank() angewendet, weil das dort `hp = cfg.maxHp` setzt -- so gibt
// es keine zweite Stelle, die die aktuellen LP nachziehen muesste.
// Nur Gegner: der Spieler wird auf einem eigenen Pfad erzeugt und nie
// durch diese Funktion geschickt. Bosse sind ausgenommen (siehe
// difficulty.json: hpScaling.skipBosses).
export function applyHpScaling(cfg, scale, skipBosses) {
  if (!scale || scale === 1) return cfg;
  if (skipBosses && isBossCfg(cfg)) return cfg;
  cfg.maxHp = Math.max(1, Math.round(cfg.maxHp * scale));
  return cfg;
}

export function applyRoomContext(cfg, ctx) {
  if (!ctx) return cfg;
  // Konterschild: nur in Elite-/Verflucht-/Bossraeumen. In normalen
  // Kampfraeumen faellt der ganze Schild weg (nicht nur der Kugelkranz) --
  // createTank() liest cfg.counterShield fuer shieldReady.
  if (cfg.counterShieldEliteOnly && !ctx.elite && !ctx.boss) {
    cfg.counterShield = false;
    cfg.counterShieldCount = 0;
  }
  return cfg;
}

// Raum-Modifikator (Phase 10, data/modifiers.json) auf ein aufgeloestes cfg
// anwenden -- nach resolveCfg()/applyUpgrades(), fuer Spieler UND Gegner.
// bulletSpeedMult wirkt symmetrisch auf beide Seiten (das ist der Punkt:
// Stoersender veraendert das Gefecht fuer alle gleich). aggressionMult/
// roleOverride betreffen nur Gegner (der Spieler hat kein KI-Verhalten),
// noSecondary nur den Spieler (Gegner setzen nie eine Sekundaerwaffe).
// Grundsteinumbau Phase 1: der Modifikator "Ueberdruck" (ricochetsBonus)
// ist mit dem Bandenschuss ins Archiv gewandert (ARCHIV.md).
export function applyRoomModifier(cfg, modifier, isPlayer) {
  if (!modifier) return cfg;
  if (modifier.bulletSpeedMult) cfg.bulletSpeed *= modifier.bulletSpeedMult;
  if (!isPlayer) {
    if (modifier.aggressionMult) cfg.aggression *= modifier.aggressionMult;
    if (modifier.roleOverride) cfg.role = modifier.roleOverride;
  } else if (modifier.noSecondary) {
    cfg.secondaryDisabled = true;
  }
  return cfg;
}

