// HUD und Vollbild-Einblendungen (Spec Abschnitte 8/9).
//
// HUD: Raumnummer, Leben, permanenter Gegner-Restzaehler (zwingend
// wegen t_white). Einblendungen: Raumuebergang (1,5 s), Victory- und
// Game-Over-Screen mit Statistik und Seed.

import { WIDTH, HEIGHT } from '../config.js';
import { enemyCount, totalRooms } from '../game/run.js';
import { resolveCfg } from '../game/cfg.js';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function createHud(ctx) {
  function drawBar(run) {
    const { alive, total } = enemyCount(run);
    const st = run.state;
    const p = st.player;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, WIDTH, 22);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e4d8';
    ctx.fillText(
      run.endless ? `Endlos ${run.roomIndex}` : `Raum ${run.roomIndex}/${totalRooms(run.difficulty)}`,
      8,
      16,
    );
    // Munition: verbleibende Kugeln (Magazin) und Minen.
    const liveBullets = st.bullets.filter((b) => b.owner === p && !b.dead).length;
    const liveMines = st.mines.filter((m) => m.owner === p && !m.dead).length;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#9aa0a8';
    let ammoLine = `Kugeln ${p.cfg.magazine - liveBullets}/${p.cfg.magazine}`;
    // Nekromant: der Bombenslot ist keine Mine mehr, sondern die Geisterbombe
    // mit eigener Abklingzeit -- "Minen X/Y" waere hier eine tote Zahl aus
    // tanks.json (cfg.mines wird fuer ihn nie gelesen) und irrefuehrend.
    if (p.cfg.necromancer) {
      const bcd = p.ghostBombCooldown || 0;
      ammoLine += bcd > 0 ? `  Geisterbombe ${bcd.toFixed(1)}s` : '  Geisterbombe ✓';
    } else {
      ammoLine += `  Minen ${p.cfg.mines - liveMines}/${p.cfg.mines}`;
    }
    // Gadgetslot (P4): zweiter Slot mit eigener Abklingzeit. Bereit =
    // Kuerzel hell, sonst die Restsekunden -- ohne das waere der einzige
    // Hinweis auf einen noch kalten Slot, dass der Knopf nichts tut.
    if (p.cfg.gadget) {
      const gl = run.data.secondaries?.[p.cfg.gadget]?.label || 'GADGET';
      const cd = p.gadgetCooldown || 0;
      ammoLine += cd > 0 ? `  ${gl} ${cd.toFixed(1)}s` : `  ${gl} ✓`;
    }
    ctx.fillText(ammoLine, 118, 15);
    // Schrottstand permanent (Phase 3) -- Gold, zwischen Munition und Mitte.
    ctx.fillStyle = '#e0c860';
    ctx.fillText(`⚙ ${run.scrap || 0}`, 296, 15);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    // Letzter Gegner: Zaehler pulsiert (wichtig, wenn er unsichtbar ist).
    ctx.fillStyle = alive === 1
      ? `rgba(255,210,90,${0.55 + 0.45 * Math.sin(run.playTime * 6)})`
      : '#e8e4d8';
    ctx.fillText(`Gegner ${alive}/${total}`, WIDTH / 2, 16);
    ctx.textAlign = 'right';
    // Run-Timer (Speedrun-Motivation, Bestzeit wird gespeichert).
    ctx.font = '11px monospace';
    ctx.fillStyle = '#9aa0a8';
    ctx.fillText(fmtTime(run.playTime), WIDTH - 62, 15);
    ctx.font = 'bold 13px monospace';
    // Letztes Leben: Herz pulsiert als Warnung.
    ctx.fillStyle = run.lives === 1
      ? `rgba(255,80,60,${0.55 + 0.45 * Math.sin(run.playTime * 7)})`
      : '#ff6a5e';
    ctx.fillText(`♥ ${run.lives}`, WIDTH - 8, 16);
    ctx.textAlign = 'left';

    // Aktive Combo gross unter der Leiste.
    if (run.combo >= 3 && run.comboTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = `rgba(255,210,60,${Math.min(1, run.comboTimer)})`;
      ctx.fillText(`COMBO ×${run.combo}`, WIDTH / 2, 44);
      ctx.textAlign = 'left';
    }
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
    // Kills pro Typ (Top 4), Labels aus tanks.json.
    const byType = Object.entries(run.killsByType || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([ty, n]) => `${run.data.types[ty]?.label || ty} ×${n}`)
      .join(' · ');
    center(
      [
        [title, 'bold 40px monospace', color],
        [`Zeit ${fmtTime(run.playTime)}   Kills ${run.kills}   Tode ${run.deaths}`, '16px monospace', '#e8e4d8'],
        [
          `Raeume: ${run.roomsCleared}   Upgrades: ${run.upgradeChoices}   Quote: ${
            run.shotsFired ? Math.round((100 * run.kills) / run.shotsFired) : 0
          } %`,
          '16px monospace',
          '#e8e4d8',
        ],
        [byType || ' ', '13px monospace', '#9aa0a8'],
        [`Beste Combo: ×${run.bestCombo}`, '13px monospace', '#ffd23c'],
        [
          title === 'GAME OVER' && run.lastDeathCause
            ? `Erledigt durch ${run.lastDeathCause}`
            : ' ',
          '13px monospace',
          '#d47ba6',
        ],
        [run.newRecord ? '★ Neuer Rekord! ★' : ' ', 'bold 15px monospace', '#ffd23c'],
        [`Seed: ${run.seed}   Modus: ${run.mode}`, 'bold 16px monospace', '#8ecae6'],
        [
          `Best: ${s.mostRooms ?? 0} Raeume | ${s.totalKills ?? 0} Kills gesamt` +
            (s.fastestWinS ? ` | Sieg ${fmtTime(s.fastestWinS)}` : ''),
          '13px monospace',
          '#9aa0a8',
        ],
        ['Tippen oder Enter: neuer Run', '15px monospace', '#c8b24a'],
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

  function drawPause(run) {
    dim(0.6);
    // Aktive Upgrades auflisten (Namen aus upgrades.json).
    const defs = run.upgradesData?.upgrades || {};
    const active = Object.entries(run.upgrades || {})
      .filter(([, lvl]) => lvl > 0)
      .map(([id, lvl]) => `${defs[id]?.name || id} ${lvl}`)
      .join(' · ');
    center(
      [
        ['PAUSE', 'bold 36px monospace', '#e8e4d8'],
        [active ? `Upgrades: ${active}` : 'Noch keine Upgrades', '13px monospace', '#c8b24a'],
        [`Seed: ${run.seed}   Modus: ${run.mode}`, '13px monospace', '#8ecae6'],
        ['Esc/P: weiter   R: Neustart   M: Hauptmenü', '13px monospace', '#9aa0a8'],
      ],
      HEIGHT / 2 - 16,
      30,
    );
  }

  // P7: Werte des eigenen Panzers, wie sie nach allen Upgrades, Raum-
  // Modifikatoren und Transformationen TATSAECHLICH gelten. Bis hierher
  // zeigte das Spiel nur Kartennamen -- welche Zahl dabei herauskommt, war
  // nirgends ablesbar.
  //
  // Alle Werte werden aus dem aufgeloesten cfg abgeleitet, es gibt KEINE
  // neuen Felder (Ist-Abgleich in PLAN-INPUT.md). Die Basiswerte kommen aus
  // resolveCfg() ohne Upgrades -- daraus die Abweichung, denn interessant ist
  // nicht "Tempo 132", sondern "Tempo 132 (+20 %)".
  function drawStats(run) {
    const st = run.state;
    const p = st.player;
    if (!p) return;
    // Phase 9: Basis der GEWAEHLTEN Klasse -- die Abweichung soll sich auf die
    // eigene Klasse beziehen, nicht auf die Standard-Klasse.
    const base = resolveCfg(run.data, run.starterTank || 'player');
    const bmine = run.data.balance.mine;
  
    // Abweichung in Prozent, nur wenn es eine gibt.
    const pct = (now, was) => {
      if (!was || Math.abs(now - was) < 1e-6) return '';
      const d = Math.round(((now - was) / was) * 100);
      return d === 0 ? '' : ` (${d > 0 ? '+' : ''}${d} %)`;
    };
    const num = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
  
    const liveBullets = st.bullets.filter((b) => b.owner === p && !b.dead).length;
    const rows = [
      ['Tempo', `${num(p.cfg.speed)}${pct(p.cfg.speed, base.speed)}`],
      ['Geschosstempo', `${num(p.cfg.bulletSpeed)}${pct(p.cfg.bulletSpeed, base.bulletSpeed)}`],
      ['Nachladen', `${p.cfg.fireCooldown.toFixed(2)} s${pct(p.cfg.fireCooldown, base.fireCooldown)}`],
      ['Magazin', `${p.cfg.magazine - liveBullets}/${p.cfg.magazine}${pct(p.cfg.magazine, base.magazine)}`],
      ['Bomben', `${p.cfg.mines}${pct(p.cfg.mines, base.mines)}`],
      [
        'Bombenradius',
        `${num(bmine.radius * (p.cfg.mineRadiusMult || 1))}${pct(p.cfg.mineRadiusMult || 1, 1)}`,
      ],
    ];
    if (p.cfg.gadget) {
      const gl = run.data.secondaries?.[p.cfg.gadget]?.label || p.cfg.gadget;
      const cd = p.gadgetCooldown || 0;
      rows.push(['Gadget', cd > 0 ? `${gl} (${cd.toFixed(1)} s)` : `${gl} bereit`]);
    }
    if (p.cfg.dash) rows.push(['Dash', `${p.cfg.dash.cooldown.toFixed(1)} s Abklingzeit`]);
    if (st.shieldCharges?.length) rows.push(['Schild', `${st.shieldCharges.length} Ladung(en)`]);
    // Raum-Modifikator sichtbar machen: er veraendert genau diese Zahlen und
    // ist sonst nur in der Vorschau zu sehen.
    if (st.modifier?.name) rows.push(['Raum', st.modifier.name]);
  
    const w = 208;
    const lineH = 14;
    const h = 22 + rows.length * lineH;
    const x = WIDTH - w - 8;
    const y = 30;
    ctx.fillStyle = 'rgba(10,10,14,0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(200,178,74,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c8b24a';
    ctx.fillText('WERTE', x + 8, y + 15);
    ctx.font = '11px monospace';
    rows.forEach(([k, v], i) => {
      const ry = y + 15 + (i + 1) * lineH;
      ctx.fillStyle = '#9aa0a8';
      ctx.fillText(k, x + 8, ry);
      ctx.fillStyle = '#e8e4d8';
      ctx.textAlign = 'right';
      ctx.fillText(v, x + w - 8, ry);
      ctx.textAlign = 'left';
    });
  }

  return {
    render(run, opts = {}) {
      if (run.phase === 'playing' || run.phase === 'transition') drawBar(run);
      if (opts.toast && run.phase === 'playing') drawToast(opts.toast);
      if (run.phase === 'transition') drawTransition(run);
      else if (run.phase === 'gameover') drawEnd(run, 'GAME OVER', '#ff6a5e');
      else if (run.phase === 'victory') drawEnd(run, 'SIEG!', '#7ade6a');
      if (opts.paused && run.phase === 'playing') drawPause(run);
      // P7: Stats-Anzeige. Sichtbar per Umschalter (Tab) und IMMER waehrend
      // der Pause -- so ist sie auf dem Handy ohne zusaetzlichen Knopf
      // erreichbar (dort gibt es keine Tastatur, aber den Pausenknopf).
      if ((opts.stats || opts.paused) && (run.phase === 'playing' || run.phase === 'transition')) {
        drawStats(run);
      }
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
