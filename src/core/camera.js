// Kamera-Kapselung (AUFTRAG-UMBAU-V2 Phase D2): EINE Stelle fuer die
// Bildschirm<->Welt-Umrechnung. Aktuell IMMER Identitaet (Position =
// Bildmitte, Zoom 1) -- die komplette Arena passt immer ins Bild, exakt
// wie vor der Kamera. D3+ aendert Position/Zoom fuer den Dungeon-Umbau.
import { WIDTH, HEIGHT } from '../config.js';

export const camera = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  zoom: 1,
};

export function resetCamera() {
  camera.x = WIDTH / 2;
  camera.y = HEIGHT / 2;
  camera.zoom = 1;
}

// Wendet die Kamera-Transformation auf den gegebenen Kontext an (zusaetzlich
// zur bestehenden DPR-Grundtransformation aus viewport.js und einem evtl.
// Screenshake-Translate). Muss von renderer.js VOR jedem Weltzeichenbefehl
// aufgerufen und per ctx.save()/restore() wieder aufgehoben werden.
export function applyCameraTransform(ctx) {
  const halfW = WIDTH / 2;
  const halfH = HEIGHT / 2;
  ctx.translate(halfW, halfH);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

// Screen (= Arena-Logikpixel, wie sie z.B. input.js:toCanvas() liefert) -> Welt.
export function screenToWorld(sx, sy) {
  const halfW = WIDTH / 2;
  const halfH = HEIGHT / 2;
  return {
    x: (sx - halfW) / camera.zoom + camera.x,
    y: (sy - halfH) / camera.zoom + camera.y,
  };
}

// Welt -> Screen (Arena-Logikpixel). Bislang ungenutzt, aber die
// symmetrische Umkehrfunktion zu screenToWorld() - fuer D3+ (Minimap,
// HUD-Marker ueber Weltobjekten) vorgesehen.
export function worldToScreen(wx, wy) {
  const halfW = WIDTH / 2;
  const halfH = HEIGHT / 2;
  return {
    x: (wx - camera.x) * camera.zoom + halfW,
    y: (wy - camera.y) * camera.zoom + halfH,
  };
}
