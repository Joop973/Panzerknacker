// HUD und Vollbild-Einblendungen (Spec Abschnitte 8/9).
//
// HUD: Raumnummer, Leben, permanenter Gegner-Restzaehler (zwingend
// wegen t_white). Einblendungen: Raumuebergang (1,5 s), Victory- und
// Game-Over-Screen mit Statistik und Seed.

import { WIDTH, HEIGHT } from '../config.js';
import { enemyCount, totalRooms } from '../game/run.js';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function createHud(ctx) {
  function drawBar(run) {
    const { alive, total } = enemyCount(run);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, WIDTH, 22);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e4d8';
    ctx.fillText(`Raum ${run.roomIndex}/${totalRooms(run.difficulty)}`, 8, 16);
    ctx.textAlign = 'center';
    ctx.fillText(`Gegner ${alive}/${total}`, WIDTH / 2, 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6a5e';
    ctx.fillText(`♥ ${run.lives}`, WIDTH - 8, 16);
    ctx.textAlign = 'left';
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(10,10,14,${alpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function center(lines, startY, lineH = 26) {
    ctx.textAlign = 'center';
    lines.forEach(([text, font, color], i) => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, WIDTH / 2, startY + i * lineH);
    });
    ctx.textAlign = 'left';
  }

  function drawTransition(run) {
    dim(0.65);
    center(
      [
        [`Raum ${run.roomIndex}/${totalRooms(run.difficulty)}`, 'bold 32px monospace', '#e8e4d8'],
        [`♥ Leben: ${run.lives}`, 'bold 18px monospace', '#ff6a5e'],
      ],
      HEIGHT / 2 - 10,
      36,
    );
  }

  function drawEnd(run, title, color) {
    dim(0.8);
    const s = run.finalStats || {};
    center(
      [
        [title, 'bold 40px monospace', color],
        [`Zeit ${fmtTime(run.playTime)}   Kills ${run.kills}   Tode ${run.deaths}`, '16px monospace', '#e8e4d8'],
        [`Raeume: ${run.roomsCleared}   Upgrades: ${run.upgradeChoices}`, '16px monospace', '#e8e4d8'],
        [`Seed: ${run.seed}`, 'bold 16px monospace', '#8ecae6'],
        [
          `Best: ${s.mostRooms ?? 0} Raeume | ${s.totalKills ?? 0} Kills gesamt` +
            (s.fastestWinS ? ` | Sieg ${fmtTime(s.fastestWinS)}` : ''),
          '13px monospace',
          '#9aa0a8',
        ],
        ['Enter: neuer Run', '15px monospace', '#c8b24a'],
      ],
      HEIGHT / 2 - 70,
      32,
    );
  }

  // Tutorial-Toast: halbtransparent am oberen Rand (Spec Abschnitt 9).
  function drawToast(text) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(text).width + 40;
    ctx.fillRect((WIDTH - w) / 2, 28, w, 26);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#e8e4d8';
    ctx.textAlign = 'center';
    ctx.fillText(text, WIDTH / 2, 45);
    ctx.textAlign = 'left';
  }

  function drawPause() {
    dim(0.6);
    center(
      [
        ['PAUSE', 'bold 36px monospace', '#e8e4d8'],
        ['Esc/P oder Pause-Button: weiter', '14px monospace', '#9aa0a8'],
      ],
      HEIGHT / 2,
      32,
    );
  }

  return {
    render(run, opts = {}) {
      if (run.phase === 'playing' || run.phase === 'transition') drawBar(run);
      if (opts.toast && run.phase === 'playing') drawToast(opts.toast);
      if (run.phase === 'transition') drawTransition(run);
      else if (run.phase === 'gameover') drawEnd(run, 'GAME OVER', '#ff6a5e');
      else if (run.phase === 'victory') drawEnd(run, 'SIEG!', '#7ade6a');
      if (opts.paused && run.phase === 'playing') drawPause();
    },
  };
}

// Kontextuelle Tutorial-Einblendungen (nur beim allerersten Run auf dem
// Geraet). Raum 1: fahren/zielen, Raum 2: Mine, Raum 3: Abpraller-
// Warnung. Verschwinden nach 4 s oder bei erster Ausfuehrung der Aktion.
export function createTutorial(alreadySeen) {
  const state = { done: alreadySeen, room: 0, timer: 0, acted: false };
  return {
    // Gibt den anzuzeigenden Text zurueck (oder null).
    update(run, cmd, isTouch, dt) {
      if (state.done || run.phase !== 'playing') return null;
      if (run.roomIndex > 3) {
        state.done = true;
        return null;
      }
      if (state.room !== run.roomIndex) {
        state.room = run.roomIndex;
        state.timer = 4;
        state.acted = false;
      }
      // Aktion erkannt -> Toast des Raums sofort weg.
      if (run.roomIndex === 1 && (cmd.fire || cmd.move.x || cmd.move.y)) state.acted = true;
      if (run.roomIndex === 2 && cmd.mine) state.acted = true;
      state.timer -= dt;
      if (state.acted || state.timer <= 0) return null;
      const texts = isTouch
        ? {
            1: 'Linker Stick: fahren · Rechter Stick: zielen & schießen',
            2: 'Button unten rechts oder Doppeltipp links: Mine legen',
            3: 'Deine Kugeln prallen ab — und können dich selbst treffen',
          }
        : {
            1: 'WASD: fahren · Maus: zielen · Klick: schießen',
            2: 'Leertaste: Mine legen',
            3: 'Deine Kugeln prallen ab — und können dich selbst treffen',
          };
      return texts[run.roomIndex] || null;
    },
    isDone: () => state.done,
  };
}
