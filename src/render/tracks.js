// Reifenspuren-Bodenschicht (Spec Abschnitt 10).
//
// Spuren sind KEINE Entities: jeder fahrende Panzer stempelt pro Tick
// seine zwei Kettenspuren in ein persistentes Buffer-Canvas in
// Arenagroesse. Das Buffer wird jeden Frame als eine einzige
// Zeichenoperation unter die Panzer gelegt -- so bricht die Framerate
// auch nach Minuten nicht ein. Beim Raumwechsel: clear().
// (Verblassen alter Spuren ist Politur, Phase 10.)

import { WIDTH, HEIGHT } from '../config.js';

const TRACK_COLOR = 'rgba(0, 0, 0, 0.10)';
const STAMP = 3; // Kantenlaenge eines Spur-Stempels in px

export function createTracks() {
  const buffer = document.createElement('canvas');
  buffer.width = WIDTH;
  buffer.height = HEIGHT;
  const bctx = buffer.getContext('2d');

  return {
    // Pro Physik-Tick aufrufen: stempelt die Spur jedes bewegten Panzers.
    stamp(tanks) {
      bctx.fillStyle = TRACK_COLOR;
      for (const t of tanks) {
        if (!t.alive) continue;
        const dx = t.x - t.prevX;
        const dy = t.y - t.prevY;
        if (dx * dx + dy * dy < 0.01) continue; // steht -> keine Spur
        // Zwei Streifen links/rechts der Fahrtrichtung (Kettenabstand).
        // t_white stempelt dicker (Haupt-Tracking-Kanal, Spec Abschnitt 5).
        const size = t.cfg.trackStampPx || STAMP;
        const perp = t.heading + Math.PI / 2;
        const off = t.cfg.radius * 0.6;
        for (const s of [-1, 1]) {
          bctx.fillRect(
            t.x + Math.cos(perp) * off * s - size / 2,
            t.y + Math.sin(perp) * off * s - size / 2,
            size,
            size,
          );
        }
      }
    },
    clear() {
      bctx.clearRect(0, 0, WIDTH, HEIGHT);
    },
    // Als Bodenschicht ins sichtbare Canvas zeichnen (eine Operation).
    draw(ctx) {
      ctx.drawImage(buffer, 0, 0);
    },
  };
}
