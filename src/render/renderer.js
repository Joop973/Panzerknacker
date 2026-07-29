// Renderer (Spec Abschnitt 3: render/renderer.js).
//
// Phase 3: Boden, Reifenspuren-Schicht, Waende, alle Panzer (Spieler +
// Gegner, farbcodiert) und Geschosse. Positionen werden zwischen zwei
// Physikschritten interpoliert (alpha).

import { WIDTH, HEIGHT, CELL } from '../config.js';
import { initSprites, sprite } from './sprites.js';
import {
  drawMines,
  drawTraps,
  drawRadar,
  drawFlashes,
  drawParticles,
  drawExplosions,
  drawTexts,
  drawThreatLines,
  drawMinePreview,
  drawAimLine,
} from './effects.js';
import { traceTrajectory } from '../game/bullet.js';

initSprites(); // Grafiken sofort vorladen (async, Fallback bleibt aktiv)

// Ordnet einer Geschoss-Instanz das passende Sprite zu.
function bulletSpriteKey(b) {
  if (b.tungsten) return 'tungsten';
  if (b.explosive) return 'explosive';
  if (b.kind === 'rocket') return 'rocket';
  if (b.kind === 'bounce_rocket') return 'bounce';
  return 'normal';
}

// Optionen (von main.js gesetzt): reduzierte Bewegung schaltet
// Screenshake ab; Bedrohungslinien sind optional.
// aimLine kommt aus data/options.json (Phase 0a).
export const renderOpts = { reduceMotion: false, threatLines: true, aimLine: true };

const COLORS = {
  floor: '#1b1b22',
  grid: '#22222c',
  wall: '#4a4a5a',
  wallEdge: '#5e5e72',
  breakable: '#6e5a41',
  breakableEdge: '#8a7355',
  bullet: '#e8e4d8',
  bulletOutline: '#8a8578',
  outline: '#1a1408',
  mineBody: '#3c4038',
  mineLight: '#ffd23c',
  mineLightHot: '#ff5030',
  explosion: '#ffb347',
};

// Rumpffarben je Panzertyp (auch von der Raumvorschau genutzt).
export const TANK_COLORS = {
  player: '#3d8ef0', // einzige blaue Wanne -- unverwechselbar

  t_brown: '#8a5a33',
  t_grey: '#9aa0a8',
  t_teal: '#3aa8a0',
  t_yellow: '#d4c23a',
  t_pink: '#d47ba6',
  t_green: '#5a9e4a',
  t_purple: '#8a5ad4',
  t_white: '#e8e8e8',
  t_black: '#33333c',

  t_armored: '#9aa6b4', // Stahl -- der dicke Frontbalken traegt die Lesbarkeit
  t_prism: '#b8ecff', // Prisma -- eigene Silhouette (Rautenkranz)

  t_reactor: '#e0a83c', // Reaktorkern -- warnendes Orange
  t_mirror: '#7fe6ff', // Der Spiegel -- kaltes Cyan, eigener Ton als das Prisma
  t_phalanx: '#c9d0da', // Phalanx-Wache -- helles Stahlgrau
};

// Elite-Affixe (Phase 9): Farbpunkt je Affix-id (drawTank()).
const AFFIX_COLORS = {
  gepanzert: '#8ecaf0',
  rasend: '#ffae42',
  brandstifter: '#ff5030',
  twinshot: '#b28dff',
  regenerating_shield: '#5ad4f0',
};

// Geschossfarben je Waffe.
const BULLET_COLORS = {
  bullet: { fill: '#e8e4d8', edge: '#8a8578' },
  rocket: { fill: '#ff9a4a', edge: '#a05620' },
  bounce_rocket: { fill: '#7ade6a', edge: '#3d8a30' },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Sichtbarkeit von t_white (Spec Abschnitt 5): unsichtbar ab 1,5 s nach
// Rundenstart; alle ~2 s flackert die Silhouette kurz auf (Schimmer).
// Rueckgabe: Alpha fuer das Zeichnen (0 = gar nicht zeichnen).
export function whiteAlpha(state) {
  const w = state.data.ai.white;
  if (state.time < w.invisibleAfterS) return 1;
  const phase = (state.time - w.invisibleAfterS) % w.shimmerIntervalS;
  return phase < w.shimmerDurationS ? 0.3 : 0;
}

export function createRenderer(ctx) {
  // Sprite zentriert an (cx,cy) rotiert zeichnen. `target` ist die
  // Ziel-Pixelgröße: bei byHeight die Höhe (Türme/Geschosse -> Dom bzw.
  // Kaliber normiert), sonst die längere Kante (Rümpfe).
  function drawSpriteRot(img, cx, cy, angle, target, byHeight) {
    const base = byHeight ? img.naturalHeight : Math.max(img.naturalWidth, img.naturalHeight);
    const s = target / base;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Boden einmalig in ein Offscreen-Canvas backen (Politur: dezentes
  // Schachbrett statt reiner Rasterlinien, ohne Frame-Kosten).
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = WIDTH;
  floorCanvas.height = HEIGHT;
  {
    const f = floorCanvas.getContext('2d');
    f.fillStyle = COLORS.floor;
    f.fillRect(0, 0, WIDTH, HEIGHT);
    f.fillStyle = 'rgba(255,255,255,0.02)';
    for (let r = 0; r < HEIGHT / CELL; r++) {
      for (let c = 0; c < WIDTH / CELL; c++) {
        if ((r + c) % 2 === 0) f.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    f.strokeStyle = COLORS.grid;
    f.lineWidth = 1;
    f.beginPath();
    for (let x = CELL; x < WIDTH; x += CELL) {
      f.moveTo(x + 0.5, 0);
      f.lineTo(x + 0.5, HEIGHT);
    }
    for (let y = CELL; y < HEIGHT; y += CELL) {
      f.moveTo(0, y + 0.5);
      f.lineTo(WIDTH, y + 0.5);
    }
    f.stroke();
  }

  // Sobald das Boden-Sprite geladen ist, wird der Offscreen-Boden EINMAL
  // mit der gekachelten Grafik neu gebacken (danach frame-kostenlos).
  let floorBaked = false;
  function bakeFloorSprite() {
    const img = sprite('tile', 'floor');
    if (!img || floorBaked) return;
    const f = floorCanvas.getContext('2d');
    f.imageSmoothingEnabled = false;
    for (let r = 0; r < HEIGHT / CELL; r++) {
      for (let c = 0; c < WIDTH / CELL; c++) {
        f.drawImage(img, c * CELL, r * CELL, CELL, CELL);
      }
    }
    floorBaked = true;
  }

  function drawFloor() {
    bakeFloorSprite();
    ctx.drawImage(floorCanvas, 0, 0);
  }

  function drawWalls(walls, time) {
    for (const wall of walls) {
      // Spiegelwand (Phase 5): IMMER prozedural, auch wenn Sprites geladen
      // sind -- sonst sähe sie identisch zur normalen Wand aus (die
      // generische 'wall'-Sprite-Zuordnung unten wuerde das verdecken),
      // und "optisch klar unterscheidbar" waere nicht mehr erfuellt.
      if (wall.type === 'reflect') {
        ctx.fillStyle = '#1c2b33';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#7fe6ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
        // Verspiegelte Diagonalstreifen.
        ctx.save();
        ctx.beginPath();
        ctx.rect(wall.x, wall.y, wall.w, wall.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(180,240,255,0.55)';
        ctx.lineWidth = 3;
        for (let d = -wall.h; d < wall.w + wall.h; d += 8) {
          ctx.beginPath();
          ctx.moveTo(wall.x + d, wall.y);
          ctx.lineTo(wall.x + d + wall.h, wall.y + wall.h);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      // Sperrmauer (Phase 6, Sekundärslot): IMMER prozedural -- Risse
      // werden mit sinkender Resthaltbarkeit deutlicher sichtbar.
      if (wall.type === 'trap') {
        const rest = Math.max(0, wall.customDurability - (wall.hits || 0));
        const frac = wall.customDurability ? rest / wall.customDurability : 1;
        ctx.fillStyle = '#3a2f28';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = `rgba(226,150,90,${0.4 + (1 - frac) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
        if (frac < 1) {
          ctx.strokeStyle = `rgba(226,150,90,${0.3 + (1 - frac) * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(wall.x + 6, wall.y + 6);
          ctx.lineTo(wall.x + wall.w - 8, wall.y + wall.h - 10);
          if (frac < 0.5) {
            ctx.moveTo(wall.x + wall.w - 6, wall.y + 8);
            ctx.lineTo(wall.x + 8, wall.y + wall.h - 6);
          }
          ctx.stroke();
        }
        continue;
      }
      // Zerstoerbare Wand (Phase 11): sieht aus wie eine normale Wand
      // (Sprite/Farbe uebernommen), aber mit einem orangen Riss, der schon
      // unbeschaedigt schwach sichtbar ist (sonst waere die ganze Mechanik
      // unentdeckbar) und mit sinkender Resthaltbarkeit deutlicher wird.
      if (wall.type === 'destructible') {
        const dur = wall.destructibleHits || 1;
        const rest = Math.max(0, dur - (wall.hits || 0));
        const dmg = dur ? 1 - rest / dur : 0; // 0 = unbeschaedigt, 1 = letzter Treffer
        const img = sprite('tile', 'wall');
        if (img) {
          for (let y = wall.y; y < wall.y + wall.h; y += CELL) {
            for (let x = wall.x; x < wall.x + wall.w; x += CELL) {
              ctx.drawImage(img, x, y, CELL, CELL);
            }
          }
        } else {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        }
        ctx.strokeStyle = `rgba(255,150,60,${(0.25 + dmg * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wall.x + 6, wall.y + 6);
        ctx.lineTo(wall.x + wall.w - 8, wall.y + wall.h - 10);
        if (dmg > 0.33) {
          ctx.moveTo(wall.x + wall.w - 6, wall.y + 8);
          ctx.lineTo(wall.x + 8, wall.y + wall.h - 6);
        }
        if (dmg > 0.66) {
          ctx.moveTo(wall.x + wall.w / 2, wall.y + 4);
          ctx.lineTo(wall.x + wall.w / 2, wall.y + wall.h - 4);
        }
        ctx.stroke();
        continue;
      }
      // Reaktor-Generator (Phase 14): IMMER prozedural -- eigene, klar von
      // der zerstoerbaren Wand unterscheidbare Silhouette (pulsierender
      // Kern), damit "hier zaehlt nur ein Bankshot" sofort lesbar ist.
      if (wall.type === 'generator') {
        const dur = wall.destructibleHits || 1;
        const rest = Math.max(0, dur - (wall.hits || 0));
        const dmg = dur ? 1 - rest / dur : 0;
        const cx = wall.x + wall.w / 2;
        const cy = wall.y + wall.h / 2;
        ctx.fillStyle = '#2a2410';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = `rgba(255,210,60,${(0.5 + dmg * 0.4).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
        const pulse = 0.5 + 0.5 * Math.sin((time ?? 0) * 4);
        ctx.fillStyle = `rgba(255,210,60,${(0.4 + pulse * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 6 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#12161c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * (wall.w / 2 - 3), cy + Math.sin(a) * (wall.h / 2 - 3));
        }
        ctx.stroke();
        continue;
      }
      // Kachel-Sprite (falls geladen) über die ganze Wandfläche legen.
      const key = wall.type === 'hole' ? 'hole' : wall.type === 'breakable' ? 'breakable' : 'wall';
      const img = sprite('tile', key);
      if (img) {
        for (let y = wall.y; y < wall.y + wall.h; y += CELL) {
          for (let x = wall.x; x < wall.x + wall.w; x += CELL) {
            ctx.drawImage(img, x, y, CELL, CELL);
          }
        }
        continue;
      }
      if (wall.type === 'hole') {
        // Loch: dunkle Grube, Panzer blockiert, Geschosse fliegen drueber.
        ctx.fillStyle = '#0c0c10';
        ctx.fillRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x + 3, wall.y + 3, wall.w - 6, wall.h - 6);
        continue;
      }
      const breakable = wall.type === 'breakable';
      ctx.fillStyle = breakable ? COLORS.breakable : COLORS.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = breakable ? COLORS.breakableEdge : COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
      if (breakable) {
        // Riss-Andeutung, bis eigene Pixel-Art kommt (Phase 10).
        ctx.beginPath();
        ctx.moveTo(wall.x + 6, wall.y + 24);
        ctx.lineTo(wall.x + 14, wall.y + 14);
        ctx.lineTo(wall.x + 12, wall.y + 8);
        ctx.moveTo(wall.x + 14, wall.y + 14);
        ctx.lineTo(wall.x + 24, wall.y + 18);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Panzerungsanzeige (Phase 4). Zwei klar verschiedene Sprachen:
  //   Frontpanzerung -> dicker Balken im gepanzerten Sektor, dreht mit der
  //     Wanne. Wo der Balken ist, prallt es ab.
  //   Prisma -> rotierender Rautenkranz (eigene Silhouette, nicht nur eine
  //     andere Farbe) plus geschlossener Ring: rundum dicht.
  function drawArmor(state, t, x, y, r) {
    const armor = t.cfg.armor;
    if (!armor) return;

    if (t.cfg.requiresRicochet) {
      const spin = state.time * 0.8;
      const R = r + 9;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.strokeStyle = '#0d1b22';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const px = Math.cos(a) * R;
        const py = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#7fe6ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(127,230,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const arc = armor.arc;
    if (!arc) return;
    const half = (arc * Math.PI) / 360;
    const R = r + 5;
    ctx.beginPath();
    ctx.arc(x, y, R, t.heading - half, t.heading + half);
    ctx.strokeStyle = '#12161c';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, R, t.heading - half, t.heading + half);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Zwei kurze Stege an den Kanten: markieren, wo die Panzerung endet.
    ctx.strokeStyle = '#12161c';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      const a = t.heading + s * half;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (R - 4), y + Math.sin(a) * (R - 4));
      ctx.lineTo(x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4));
      ctx.stroke();
    }
  }

  function drawTank(state, t, alpha) {
    if (!t.alive) return;

    // t_white: unsichtbar bis auf den Schimmer (Muendungsblitz und
    // dicke Reifenspuren sind die anderen Tracking-Kanaele).
    let bodyAlpha = 1;
    if (t.type === 't_white') {
      bodyAlpha = whiteAlpha(state);
      if (bodyAlpha <= 0) return;
    }

    const x = lerp(t.prevX, t.x, alpha);
    const y = lerp(t.prevY, t.y, alpha);
    const r = t.cfg.radius;

    // Spawn-Schutz: schnelles Blinken (jede zweite Blinkphase unsichtbar).
    if (t.protect > 0 && Math.sin(t.protect * 30) < 0) return;

    // Schild-Ring, solange der Schild geladen ist.
    if (t.shieldReady) {
      const sx = lerp(t.prevX, t.x, alpha);
      const sy = lerp(t.prevY, t.y, alpha);
      ctx.strokeStyle = 'rgba(140,200,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, t.cfg.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Notschild-Ladungen: ein konzentrischer Ring je verbleibender Ladung.
    if (t === state.player && state.shieldCharges.length > 0) {
      const life = state.data.balance.shield?.roomLifetime || 1;
      ctx.lineWidth = 2;
      for (let i = 0; i < state.shieldCharges.length; i++) {
        // E2: Ladung verblasst, je naeher ihr Verfall rueckt.
        const frac = Math.max(0, Math.min(1, state.shieldCharges[i] / life));
        ctx.strokeStyle = `rgba(150,225,255,${(0.25 + 0.6 * frac).toFixed(3)})`;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, t.cfg.radius + 8 + i * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = bodyAlpha;
    const body = TANK_COLORS[t.type] || '#ffffff';
    const isPlayer = t.type === 'player';
    const edge = t.type === 't_black' ? '#8a8a99' : isPlayer ? '#eaf2ff' : COLORS.outline;

    // Spieler: sanfter Glow + pulsierender Ring, damit er in jedem
    // Getuemmel sofort ins Auge springt.
    if (isPlayer) {
      ctx.fillStyle = 'rgba(80,160,255,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,200,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 + 0.25 * Math.sin(state.time * 4);
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = bodyAlpha;
    }

    // Wanne, rotiert in Fahrtrichtung. Sprite (Front zeigt nach oben ->
    // +PI/2) falls geladen, sonst prozedurale Ketten-Wanne (Fallback).
    const bodyImg = sprite('body', t.type);
    if (bodyImg) {
      drawSpriteRot(bodyImg, x, y, t.heading + Math.PI / 2, 2.9 * r, false);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.heading);
      ctx.fillStyle = edge;
      ctx.fillRect(-r + 1, -r + 1, 2 * r - 2, 5); // Kette oben
      ctx.fillRect(-r + 1, r - 6, 2 * r - 2, 5); // Kette unten
      ctx.fillStyle = body;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.fillRect(-r + 2, -r + 5, 2 * r - 4, 2 * r - 10);
      ctx.strokeRect(-r + 2, -r + 5, 2 * r - 4, 2 * r - 10);
      ctx.restore();
    }

    // Ziellinie des Spielers mit EINEM Abpraller-Vorgriff: Ray-March
    // wie ein Geschoss (achsweise Reflexion) -- man sieht die erste
    // Bande. Wichtig fuer Touch/Gamepad ohne Cursor.
    if (t.type === 'player') {
      let dx = Math.cos(t.turret);
      let dy = Math.sin(t.turret);
      let lx = x + dx * (r + 10);
      let ly = y + dy * (r + 10);
      const pts = [[lx, ly]];
      let bounced = false;
      for (let d = 0; d < 320; d += 6) {
        const nx = lx + dx * 6;
        const ny = ly + dy * 6;
        if (state.isSolid(nx, ny)) {
          if (bounced) break;
          const sx = state.isSolid(nx, ly);
          const sy = state.isSolid(lx, ny);
          if (sx) dx = -dx;
          if (sy) dy = -dy;
          if (!sx && !sy) {
            dx = -dx;
            dy = -dy;
          }
          bounced = true;
          pts.push([lx, ly]);
          continue;
        }
        lx = nx;
        ly = ny;
      }
      pts.push([lx, ly]);
      ctx.strokeStyle = 'rgba(140,200,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Turm + Rohr, unabhaengig vom Rumpf rotiert. Sprite: Rohr zeigt nach
    // rechts (= Winkel 0), Dom-Pivot ist zentriert -> direkt t.turret.
    const turImg = sprite('turret', t.type);
    if (turImg) {
      drawSpriteRot(turImg, x, y, t.turret, 2.1 * r, true);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.turret);
      ctx.fillStyle = edge;
      ctx.fillRect(4, -2.5, r + 4, 5); // Rohr
      ctx.fillStyle = body;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // --- Gerichtete Panzerung (Phase 4) ---------------------------------
    // Muss auf einem Handydisplay in einer Sekunde lesbar sein, deshalb
    // bewusst zu deutlich: dicker Balken bzw. eigener Rautenkranz.
    drawArmor(state, t, x, y, r);

    // Reaktorkern (Phase 14): solange Generatoren stehen, ein deutlicher
    // pulsierender Schutzring -- sonst wirkt jeder Treffer wie ein Bug
    // ("warum stirbt er nicht?").
    if (t.cfg.bossInvincible && state.bossGeneratorsLeft > 0) {
      ctx.strokeStyle = `rgba(255,210,60,${(0.35 + 0.25 * Math.sin(state.time * 5)).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Powershot geladen (Phase 5): heller Punkt an der Rohrspitze, solange
    // eine Ladung wartet -- verschwindet mit dem letzten geladenen Schuss.
    if (t === state.player && t.powershotCharges > 0) {
      const mx = x + Math.cos(t.turret) * (r + 10);
      const my = y + Math.sin(t.turret) * (r + 10);
      ctx.fillStyle = '#ffd23c';
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(state.time * 6);
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Krallenfalle: gefangener Panzer bekommt einen pulsierenden Ring.
    if (t.stunTimer > 0) {
      ctx.strokeStyle = '#c25a4a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 5 + Math.sin(t.stunTimer * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // EMP-Mine (Phase 6): Turm-Betaeubung bekommt einen eigenen, elektrisch
    // wirkenden Ring (cyan, schneller Puls), unterscheidbar vom Krallenfalle-Ring.
    if (t.turretStunTimer > 0) {
      ctx.strokeStyle = '#5ad4f0';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r + 9 + Math.sin(t.turretStunTimer * 16) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Deflektor (Phase 6, Sekundärslot): duenner heller Ring, solange das
    // Reflexionsfenster aktiv ist.
    if (t === state.player && t.deflectorTimer > 0) {
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enterhaken (Phase 6, Sekundärslot): kurze Linie zum Zielpunkt,
    // solange der Zug laeuft.
    if (t === state.player && t.hookTimer > 0 && t.hookTarget) {
      ctx.strokeStyle = 'rgba(200,210,220,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(t.hookTarget.x, t.hookTarget.y);
      ctx.stroke();
    }

    // Elite-Affixe (Phase 9): ein kleiner Farbpunkt pro aktivem Affix,
    // im Bogen ueber dem Panzer -- sichtbar auch bei mehreren
    // kombinierten Affixen (ab Raum 14 zwei gleichzeitig).
    if (t.affixes && t.affixes.length) {
      const n = t.affixes.length;
      t.affixes.forEach((id, i) => {
        const spread = 0.5;
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * spread;
        const dotX = x + Math.cos(a) * (r + 12);
        const dotY = y + Math.sin(a) * (r + 12);
        ctx.fillStyle = AFFIX_COLORS[id] || '#e8e4d8';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.globalAlpha = 1;
  }

  let renderState = null;
  function drawBullets(bullets, alpha) {
    const bcfg = renderState?.data?.balance?.bullet;
    for (const b of bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);

      // E4: In den letzten blinkFraction des Wegbudgets blinkt die Kugel --
      // sie verschwindet gleich.
      if (bcfg?.maxDistance) {
        const left = 1 - b.distance / bcfg.maxDistance;
        if (left <= (bcfg.blinkFraction ?? 0.15) && Math.sin(b.distance * 0.35) < 0) continue;
      }

      // Nach dem ersten Abpraller wird die Kugel gefaehrlich (auch fuer
      // den Spieler) -> heller Glow als Warnung. Von einer Panzerung
      // zurueckgeworfene Kugeln (E3) bekommen einen eigenen kalten Glow --
      // sie kommen direkt zurueck und sterben an der naechsten Wand.
      if (b.reflected || b.wallBounces > 0) {
        ctx.save();
        ctx.globalAlpha = b.reflected ? 0.6 : 0.45;
        ctx.fillStyle = b.reflected ? '#7fe6ff' : '#fff2c0';
        ctx.beginPath();
        ctx.arc(x, y, b.radius + (b.reflected ? 5 : 4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sprite (Spitze zeigt nach rechts = Flugrichtung) falls geladen.
      const img = sprite('bullet', bulletSpriteKey(b));
      if (img) {
        const ang = Math.atan2(b.vy, b.vx);
        drawSpriteRot(img, x, y, ang, 3.6 * b.radius, true);
        if (b.explosive) {
          ctx.strokeStyle = '#ff9a4a';
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, b.radius + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        continue;
      }

      // Reflektierte Kugeln wechseln die Farbe (E3), Wolframkern-Kugeln
      // sind kalt-blau (durchschlagen breakable).
      const c = b.reflected
        ? { fill: '#c8f4ff', edge: '#3aa8c8' }
        : b.tungsten
          ? { fill: '#d9e2ff', edge: '#6a7adf' }
          : BULLET_COLORS[b.kind] || BULLET_COLORS.bullet;

      // Raketen bekommen einen kurzen Schweif entgegen der Flugrichtung.
      if (b.kind !== 'bullet') {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (b.vx / sp) * 10, y - (b.vy / sp) * 10);
        ctx.stroke();
      }

      // Sprengschuss: oranger Glimmer um die Kugel.
      if (b.explosive) {
        ctx.strokeStyle = '#ff9a4a';
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, b.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Raum-Gefahren (Phase 15): hoechstens EINE davon ist je Raum aktiv.
  // Oel/Foerderband sind reine Bodendekoration; Laser bewusst KEIN
  // solider Wandblock, sondern ein durchscheinender Strahl (Muster:
  // Spiegelwand-Streifen, aber rot + halbtransparent) -- sonst wirkt
  // "blockt nur Kugeln, keine Panzer" wie ein Rendering-Bug. Bewegliche
  // Wand bekommt eine Schienen-Markierung, die auch geschlossen sichtbar
  // bleibt, sonst ist die Mechanik nie zu erkennen.
  function drawHazards(ctx, state) {
    if (state.oilCells?.size) {
      for (const key of state.oilCells) {
        const [c, r] = key.split(',').map(Number);
        const x = c * CELL + CELL / 2;
        const y = r * CELL + CELL / 2;
        ctx.fillStyle = 'rgba(35,25,50,0.55)';
        ctx.beginPath();
        ctx.ellipse(x, y, CELL * 0.42, CELL * 0.32, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,130,210,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    if (state.conveyor) {
      const { dir, cells } = state.conveyor;
      const angle = Math.atan2(dir.y, dir.x);
      const scroll = (state.time * 70) % CELL;
      for (const key of cells) {
        const [c, r] = key.split(',').map(Number);
        const x = c * CELL;
        const y = r * CELL;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, CELL, CELL);
        ctx.clip();
        ctx.fillStyle = 'rgba(60,68,48,0.5)';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = 'rgba(196,224,120,0.75)';
        ctx.lineWidth = 2;
        for (let d = -CELL; d < CELL * 2; d += 12) {
          const bx = x + CELL / 2 + Math.cos(angle) * (d - scroll);
          const by = y + CELL / 2 + Math.sin(angle) * (d - scroll);
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(angle + 0.6) * 5, by - Math.sin(angle + 0.6) * 5);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx - Math.cos(angle - 0.6) * 5, by - Math.sin(angle - 0.6) * 5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (state.laserWalls?.length) {
      const pulse = 0.5 + 0.35 * Math.sin(state.time * 6);
      for (const w of state.laserWalls) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(w.x, w.y, w.w, w.h);
        ctx.clip();
        ctx.strokeStyle = `rgba(255,70,70,${pulse.toFixed(3)})`;
        ctx.lineWidth = 3;
        for (let d = -w.h; d < w.w + w.h; d += 8) {
          ctx.beginPath();
          ctx.moveTo(w.x + d, w.y);
          ctx.lineTo(w.x + d + w.h, w.y + w.h);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = `rgba(255,70,70,${(pulse * 0.6).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
      }
    }
    if (state.movingWalls?.length) {
      for (const mw of state.movingWalls) {
        ctx.strokeStyle = 'rgba(255,180,60,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mw.x + 3, mw.y + 3, CELL - 6, CELL - 6);
        if (!mw.solid) {
          ctx.fillStyle = 'rgba(255,180,60,0.15)';
          ctx.fillRect(mw.x, mw.y, CELL, CELL);
        }
      }
    }
  }

  // Rauchgranate (Phase 6, Sekundärslot): halbtransparente Wolken, die mit
  // ihrem Alter ausblenden. Blockiert nur die KI-Sicht (state.blocksSight),
  // rein optisch hier ueber allem gezeichnet.
  function drawSmoke(ctx, state) {
    for (const c of state.smokeClouds) {
      const frac = 1 - c.age / c.life;
      ctx.fillStyle = `rgba(150,155,160,${(0.35 * frac).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Geisterpanzer (Phase 7): einfache, durchscheinende Wanne+Rohr-Form in
  // der Farbe des Ursprungstyps -- kein Sprite, keine der tankspezifischen
  // Overlays (Schild/Panzerung/Powershot), nur konstante Transparenz statt
  // Blinken wie bei t_white.
  function drawGhosts(ctx, state, alpha) {
    for (const g of state.ghosts) {
      const x = lerp(g.prevX, g.x, alpha);
      const y = lerp(g.prevY, g.y, alpha);
      const r = g.cfg.radius;
      ctx.globalAlpha = 0.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(g.heading);
      ctx.fillStyle = TANK_COLORS[g.type] || '#ffffff';
      ctx.fillRect(-r + 2, -r + 5, 2 * r - 4, 2 * r - 10);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(g.turret);
      ctx.fillStyle = TANK_COLORS[g.type] || '#ffffff';
      ctx.fillRect(4, -2.5, r + 4, 5); // Rohr
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // Wellen (Phase 9): pulsierender Warnring an den Spawnpunkten der
  // zweiten Welle, 1 s bevor sie erscheint -- kein Ueberraschungs-Kill
  // aus dem Nichts.
  function drawWaveWarning(ctx, state) {
    const w = state.pendingWave;
    if (!w || !w.spawning) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 14);
    for (const s of w.spawns) {
      ctx.strokeStyle = `rgba(255,120,60,${(0.4 + 0.5 * pulse).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 14 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Raum-Modifikator "Nebel"/"Dunkelheit" (Phase 10): rein optische Maske --
  // begrenzt die SICHTBARKEIT des Spielers, nicht die KI-Sichtlinien (die
  // laufen weiter unveraendert ueber state.blocksSight/clearLine). Ein
  // Radialgradient um den Spieler ist transparent im Kern und geht in
  // fogColor ueber; jenseits des aeusseren Gradient-Stopps fuellt Canvas
  // automatisch mit der letzten Farbe weiter -- deckt so auch die Ecken ab.
  function drawFog(ctx, state, alpha) {
    const mod = state.modifier;
    if (!mod || !mod.visionRadiusPx) return;
    const p = state.player;
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    const r = mod.visionRadiusPx;
    const grad = ctx.createRadialGradient(x, y, r * 0.45, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, mod.fogColor || 'rgba(4,5,9,0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  return {
    render(state, alpha, tracks, minePreview) {
      renderState = state;
      ctx.imageSmoothingEnabled = true; // weiche Sprite-Skalierung
      // Screenshake: deterministisches Wackeln aus der Spielzeit.
      const sh = renderOpts.reduceMotion ? 0 : state.shake || 0;
      ctx.save();
      if (sh > 0.1) {
        ctx.translate(Math.sin(state.time * 47) * sh, Math.cos(state.time * 53) * sh * 0.7);
      }
      drawFloor();
      tracks.draw(ctx);
      drawMines(ctx, state);
      drawTraps(ctx, state);
      if (renderOpts.threatLines) drawThreatLines(ctx, state);
      if (renderOpts.aimLine) drawAimLine(ctx, state, traceTrajectory);
      if (minePreview) drawMinePreview(ctx, state, minePreview);
      drawWalls(state.walls, state.time);
      drawHazards(ctx, state);
      drawWaveWarning(ctx, state);
      drawGhosts(ctx, state, alpha);
      for (const t of state.tanks) drawTank(state, t, alpha);
      drawRadar(ctx, state);
      drawBullets(state.bullets, alpha);
      drawFlashes(ctx, state);
      drawParticles(ctx, state);
      drawExplosions(ctx, state);
      drawSmoke(ctx, state);

      drawTexts(ctx, state);
      drawFog(ctx, state, alpha);
      ctx.restore();

      // Roter Flash nach eigenem Tod (ungeschuettelt, ueber allem).
      if (state.damageFlash > 0) {
        const a = state.damageFlash * (renderOpts.reduceMotion ? 0.18 : 0.35);
        ctx.fillStyle = `rgba(255,60,40,${a})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    },
  };
}
