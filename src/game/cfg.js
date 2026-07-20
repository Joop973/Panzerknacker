// Panzer-Konfiguration (aus state.js ausgelagert): loest Typnamen aus
// tanks.json in flache cfg-Objekte auf und wendet Upgrade-Level an.

// Loest einen Typnamen aus tanks.json in ein flaches cfg-Objekt auf.
export function resolveCfg(data, type) {
  const t = data.types[type];
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    // Typ-eigene Feuerrate (t_green: 2 s) vor globalem Standard.
    fireCooldown: t.fireCooldownS ?? data.physics.fireCooldownS,
    speed: data.speeds[t.speed],
    magazine: t.magazine,
    ricochets: t.ricochets,
    mines: t.mines,
    weapon: t.weapon,
    bulletSpeed: data.bulletSpeeds[t.weapon],
    turret: t.turret,
    drive: t.drive,
    avoidMines: t.avoidMines || false,
    miner: t.miner,
    trackStampPx: t.trackStampPx || 3,
  };
}

// Upgrade-Level auf das Spieler-cfg anwenden (Spec Abschnitt 8 +
// Erweiterungen). Die Stellwerte der neuen Upgrades kommen aus
// upgrades.json (upsData).
export function applyUpgrades(cfg, ups, upsData) {
  if (!ups) return cfg;
  const l = (k) => ups[k] || 0;
  cfg.magazine += 2 * l('magazin');
  cfg.ricochets += l('abpraller'); // Basis 1, max +1 => harte Grenze 2
  cfg.bulletSpeed *= Math.pow(1.2, l('ladung'));
  cfg.mines += l('kettenglied');
  cfg.mineRadiusMult = Math.pow(1.3, l('sprengkraft'));
  cfg.speed *= Math.pow(1.12, l('kettenantrieb'));
  cfg.tungsten = l('wolframkern') > 0;
  const U = upsData ? upsData.upgrades : {};
  if (l('sprengschuss')) {
    cfg.explosionEveryShots = U.sprengschuss.everyShots; // jeder 12. Schuss
    cfg.shotExplosionRadius = U.sprengschuss.radiusPx;
  }
  // Sprengmunition: jede Kugel explodiert, keine Minen, Magazin auf 1 --
  // skaliert aber mit Magazin-Upgrades weiter (kein harter Deckel).
  if (l('sprengmunition')) {
    cfg.allExplosive = true;
    cfg.shotExplosionRadius = U.sprengmunition.radiusPx;
    cfg.mines = 0;
    cfg.magazine = 1 + 2 * l('magazin');
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
  cfg.radar = l('radar') > 0;
  return cfg;
}

