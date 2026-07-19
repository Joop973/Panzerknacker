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

  return {
    render(run) {
      if (run.phase === 'playing' || run.phase === 'transition') drawBar(run);
      if (run.phase === 'transition') drawTransition(run);
      else if (run.phase === 'gameover') drawEnd(run, 'GAME OVER', '#ff6a5e');
      else if (run.phase === 'victory') drawEnd(run, 'SIEG!', '#7ade6a');
    },
  };
}
