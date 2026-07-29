// Panzer-Konfiguration (aus state.js ausgelagert): loest Typnamen aus
// tanks.json in flache cfg-Objekte auf und wendet Upgrade-Level an.

// Loest einen Typnamen aus tanks.json in ein flaches cfg-Objekt auf.
export function resolveCfg(data, type) {
  const t = data.types[type];
  const bbullet = data.balance?.bullet;
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    // Typ-eigene Feuerrate (t_green: 2 s) vor globalem Standard.
    fireCooldown: t.fireRate ?? data.physics.fireCooldownS,
    speed: data.speeds[t.speed],
    // Spieler-Basismagazin (gleichzeitig aktive Kugeln) aus balance.json;
    // harter Deckel selbst mit Magazin-Upgrades (Lesbarkeit).
    magazine: type === 'player' && bbullet ? bbullet.maxActive : t.magazine,
    magazineCap: type === 'player' && bbullet ? bbullet.maxActiveCap : Infinity,
    ricochets: t.ricochets,
    mines: t.mines,
    weapon: t.weapon,
    // Spieler: Geschwindigkeit aus balance.json (v2), Gegner aus tanks.json.
    bulletSpeed:
      type === 'player' && bbullet?.speed ? bbullet.speed : data.bulletSpeeds[t.weapon],
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
    requiresBounceShot: t.requiresBounceShot || false,
    phaseToggle: t.phaseToggle || null,
    avoidMines: t.avoidMines || false,
    miner: t.miner,
    trackStampPx: t.trackStampPx || 3,
    // Gerichtete Panzerung (Phase 4) -- reine Datenuebernahme.
    armor: t.armor || null,
    requiresRicochet: t.requiresRicochet || false,
    // Boss-Sonderfaelle (Phase 14) -- reine Datenuebernahme, ebenso
    // orthogonal wie armor/miner. bossInvincible gated killTank() (Reaktor);
    // mirrorBoss/phalanx schalten in stepState() auf die Boss-Fahrfunktionen
    // aus bossai.js statt der normalen Rolle um.
    bossInvincible: t.bossInvincible || false,
    mirrorBoss: t.mirrorBoss || false,
    phalanx: t.phalanx || false,
  };
}

// Upgrade-Level auf das Spieler-cfg anwenden (Spec Abschnitt 8 +
// Erweiterungen). Die Stellwerte der neuen Upgrades kommen aus
// upgrades.json (upsData).
export function applyUpgrades(cfg, ups, upsData, equippedSecondary) {
  if (!ups) return cfg;
  const l = (k) => ups[k] || 0;
  cfg.magazine += 2 * l('magazin');
  cfg.ricochets += l('abpraller'); // Basis 1, max +1 => harte Grenze 2
  cfg.bulletSpeed *= Math.pow(1.2, l('ladung'));
  cfg.mines += l('kettenglied');
  cfg.mineRadiusMult = Math.pow(upsData?.upgrades?.sprengkraft?.radiusMult ?? 1.25, l('sprengkraft'));
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
  // Durchschlag: Kugeln fliegen durch Waende, dafuer keine Abpraller.
  if (l('durchschlag')) {
    cfg.phaseWalls = true;
    cfg.ricochets = 0;
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

  // --- Neue Build-Upgrades ---
  if (l('glaskanone')) {
    cfg.bulletSpeed *= U.glaskanone.speedMult;
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = cfg.shotExplosionRadius || U.glaskanone.radiusPx;
  }
  if (l('streuschuss')) {
    cfg.spreadCount = U.streuschuss.count;
    cfg.spreadRad = U.streuschuss.spreadRad;
    cfg.ricochets = 0; // Faecher ohne Abpraller (Selbstschutz)
    cfg.magazine += U.streuschuss.magazineBonus;
  }
  if (l('zielsucher')) {
    cfg.homing = U.zielsucher.turnRateRad;
    cfg.bulletSpeed *= U.zielsucher.speedMult;
  }
  if (l('nachbrenner')) {
    cfg.afterburnerMult = 1 + (U.nachbrenner.boostMult - 1) * l('nachbrenner');
    cfg.afterburnerS = U.nachbrenner.boostS;
  }
  cfg.scavenger = l('aasgeier') > 0;
  if (l('kamikaze')) cfg.kamikazeRadius = U.kamikaze.radiusPx;
  cfg.shield = l('schild') > 0;
  if (l('dash')) {
    cfg.dash = { dist: U.dash.distancePx, iframe: U.dash.iframeS, cooldown: U.dash.cooldownS };
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
  if (l('klebemine')) cfg.stickyMine = U.klebemine.stickDelayS;

  // --- Elite-Karten (Phase 4, nur aus Eliteräumen) ---
  // Kriegsmaschine: mehr Magazin + schnellere Nachladung.
  if (l('kriegsmaschine')) {
    cfg.magazine += U.kriegsmaschine.magazineBonus;
    cfg.fireCooldown *= U.kriegsmaschine.cooldownMult;
  }
  if (l('scharfschuetze')) {
    cfg.bulletSpeed *= U.scharfschuetze.speedMult;
    cfg.fireCooldown *= U.scharfschuetze.cooldownMult;
    cfg.ricochets += U.scharfschuetze.ricochetsBonus;
    cfg.singleShot = true; // Magazin 1 (hart, unten angewandt)
  }
  // Powershot (Phase 5): die ersten powershotPerRoom Schuesse jedes Raums
  // sind automatisch verstaerkt (tank.js verwaltet den Ladungszaehler).
  if (l('powershot')) {
    cfg.powershotPerRoom = l('powershot') * U.powershot.perRoom;
    cfg.powershotBonusRicochets = U.powershot.bonusRicochets;
    cfg.powershotSpeedFactor = U.powershot.speedFactor;
  }

  // Zielsucher: hartes Magazin-Limit 3 (ueberschreibt alle anderen
  // Magazin-Effekte -- ganz am Ende angewandt).
  if (l('zielsucher')) cfg.magazine = Math.min(cfg.magazine, 3);
  // Scharfschuetze: hartes Magazin 1 (schlaegt alles).
  if (cfg.singleShot) cfg.magazine = 1;
  // Pluenderer (Phase 18, erste Tag-resource-Karte): flacher Bonus pro
  // geraeumtem Raum, angewandt in run.js NACH dem Elite-Multiplikator
  // (wie die einmalige Kriegsbeute-Belohnung auch kein Vielfaches ist).
  if (l('pluenderer')) cfg.scrapBonusPerRoom = U.pluenderer.scrapPerLevel * l('pluenderer');
  // Sekundärslot (Phase 6): explizit vom Run vorgegeben, kein Level-Scan
  // (mehrere Sekundärkarten koennen gleichzeitig Level > 0 haben, siehe
  // run.js: chooseUpgrade -- nur equippedSecondary bestimmt die aktive).
  cfg.secondary = equippedSecondary || 'mine';
  // Geisterbesatzung (Phase 7): einfacher Ein/Aus-Schalter, kein Stufenwert.
  cfg.ghostCrew = l('ghost_crew') > 0;
  return cfg;
}

// Raum-Modifikator (Phase 10, data/modifiers.json) auf ein aufgeloestes cfg
// anwenden -- nach resolveCfg()/applyUpgrades(), fuer Spieler UND Gegner.
// bulletSpeedMult/ricochetsBonus wirken symmetrisch auf beide Seiten (das
// ist der Punkt: Stoersender/Ueberdruck veraendern das Gefecht fuer alle
// gleich). aggressionMult/roleOverride betreffen nur Gegner (der Spieler
// hat kein KI-Verhalten), noSecondary nur den Spieler (Gegner setzen nie
// eine Sekundaerwaffe).
export function applyRoomModifier(cfg, modifier, isPlayer) {
  if (!modifier) return cfg;
  if (modifier.bulletSpeedMult) cfg.bulletSpeed *= modifier.bulletSpeedMult;
  if (modifier.ricochetsBonus) cfg.ricochets += modifier.ricochetsBonus;
  if (!isPlayer) {
    if (modifier.aggressionMult) cfg.aggression *= modifier.aggressionMult;
    if (modifier.roleOverride) cfg.role = modifier.roleOverride;
  } else if (modifier.noSecondary) {
    cfg.secondaryDisabled = true;
  }
  return cfg;
}

