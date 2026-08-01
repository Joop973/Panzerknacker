// Viewport- und Aufloesungs-Verwaltung (PLAN-INPUT.md P2).
//
// Zwei getrennte Aufgaben, die vorher gar nicht bzw. nur ueber CSS liefen:
//
// 1. AUFLOESUNG (devicePixelRatio). Der Canvas hat als Backing-Store bisher
//    fest 768x512 gehabt und wurde vom Browser auf die CSS-Groesse
//    hochskaliert -- auf einem Handy mit DPR 3 also aus 768 px auf ueber
//    2000 px Breite. Jetzt bekommt der Backing-Store WIDTH*dpr x HEIGHT*dpr
//    und der Kontext eine passende Grundtransformation. Die ZEICHENBEFEHLE
//    bleiben dadurch komplett unveraendert in Arena-Koordinaten (768x512) --
//    renderer.js und debug.js muessen nichts wissen.
//
//    Der DPR wird gedeckelt (options.json: maxPixelRatio). Ungedeckelt
//    waeren es bei DPR 3 die neunfache Pixelmenge; Phase 11b haelt das
//    Frame-Budget bewusst knapp, und Fuellrate ist auf Handys der Engpass.
//
// 2. SICHTBARE HOEHE (visualViewport). `100dvh` rechnet die eingeklappte
//    Adressleiste heraus, kennt aber die eingeblendete Bildschirmtastatur
//    nicht -- genau der Fall beim Seed-Eingabefeld im Startmenue. Deshalb
//    wird die tatsaechlich sichtbare Hoehe als CSS-Variable --vvh
//    bereitgestellt; das Stylesheet benutzt sie mit 100dvh als Rueckfall.

import { WIDTH, HEIGHT } from '../config.js';

// Ohne Deckel wuerde ein DPR-3-Geraet die neunfache Pixelmenge fuellen.
// 2 ist der Punkt, ab dem der Zugewinn an Schaerfe auf Handygroessen kaum
// noch sichtbar ist.
const DEFAULT_MAX_DPR = 2;

export function createViewport(canvas, ctx, opts = {}) {
  const maxDpr = opts.maxPixelRatio ?? DEFAULT_MAX_DPR;
  let applied = 0; // zuletzt gesetzter DPR -- vermeidet unnoetige Resizes

  // Der Backing-Store waechst mit dem DPR, die CSS-Groesse bleibt
  // unberuehrt (die macht weiterhin das Stylesheet ueber max-height/
  // aspect-ratio). Nur so bleibt das Layout exakt wie bisher.
  function applyResolution() {
    const dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
    if (dpr === applied) return false;
    applied = dpr;
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    // Die CSS-Groesse wird hier BEWUSST NICHT gesetzt. Der Browser leitet
    // die intrinsische Groesse eines Canvas aus den width/height-Attributen
    // ab, die jetzt DPR-fach groesser sind -- das Stylesheet deckelt sie
    // deshalb mit `min(..., 768px/512px)` auf die Logikgroesse. Eine feste
    // CSS-Breite UND -Hoehe hier waere der naheliegende, aber falsche Weg:
    // beide Masse definit zu machen setzt `aspect-ratio` ausser Kraft, und
    // sobald max-height im Handy-Querformat greift, wird der Canvas
    // verzerrt (gemessen: 768x390 statt 585x390).
    // Grundtransformation: ab hier zeichnet alles wieder in 768x512.
    // setTransform (nicht scale) -- der Aufruf ist damit idempotent und
    // haengt keine Skalierungen aneinander.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ein Resize des Backing-Stores setzt ALLE Kontextattribute zurueck
    // (imageSmoothing, Filter, Font). Der Renderer setzt Farben und
    // Linienbreiten ohnehin pro Zeichenbefehl; explizit gesetzt wird hier
    // nur, was sonst niemand wieder anfasst.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return true;
  }

  // Sichtbare Hoehe/Breite als CSS-Variablen. Auf Geraeten ohne
  // visualViewport (aeltere Desktops) faellt CSS auf 100dvh zurueck.
  function applyViewportVars() {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    root.style.setProperty('--vvh', vv.height + 'px');
    root.style.setProperty('--vvw', vv.width + 'px');
  }

  function update() {
    applyResolution();
    applyViewportVars();
  }

  update();

  // devicePixelRatio aendert sich nicht nur beim Zoomen, sondern auch beim
  // Verschieben des Fensters zwischen zwei Monitoren -- dafuer gibt es kein
  // eigenes Event. matchMedia auf die aktuelle Aufloesung feuert genau dann.
  let dprQuery = null;
  function watchDpr() {
    dprQuery?.removeEventListener?.('change', onDprChange);
    dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery?.addEventListener?.('change', onDprChange);
  }
  function onDprChange() {
    update();
    watchDpr(); // die Abfrage gilt immer nur fuer den alten Wert
  }
  watchDpr();

  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.visualViewport?.addEventListener('resize', applyViewportVars);
  // Auf iOS scrollt der visuelle Viewport bei offener Tastatur weg, ohne
  // dass sich seine Hoehe erneut aendert.
  window.visualViewport?.addEventListener('scroll', applyViewportVars);

  return {
    update,
    // Aktuell angewandter (gedeckelter) DPR -- fuer die Debug-Anzeige.
    getPixelRatio: () => applied,
    destroy() {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', applyViewportVars);
      window.visualViewport?.removeEventListener('scroll', applyViewportVars);
      dprQuery?.removeEventListener?.('change', onDprChange);
    },
  };
}
