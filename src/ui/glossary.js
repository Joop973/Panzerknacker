// Zentrales Glossar fuer Spielbegriffe (Champion-/Nekromant-Nachschliff
// Abschnitt 13): Kartentexte/UI-Texte markieren bekannte Begriffe blau. Auf
// dem Desktop zeigt Hover (natives title-Attribut) eine kurze Erklaerung, auf
// Touch-Geraeten erreicht ein Tap dieselbe Erklaerung ueber eine kleine
// Sprechblase (Touch kennt kein Hover). EINE zentrale Definition
// (data/glossary.json) haelt die Erklaerungen ueberall konsistent -- die
// Begriffs-Liste stammt bewusst NICHT von hier, sondern wird von main.js
// geladen und per initGlossary() hereingereicht (dasselbe Muster wie jede
// andere data/*.json-Quelle im Projekt).

let terms = null;
let sortedKeys = null;

export function initGlossary(data) {
  terms = (data && data.terms) || {};
  // Laengste Begriffe zuerst: "Geisterlimit" darf nicht schon als Teilstring
  // eines anderen, kuerzeren Treffers verlorengehen (hier zwar kein echter
  // Ueberlappungsfall, aber robust gegen kuenftige Glossareintraege).
  sortedKeys = Object.keys(terms).sort((a, b) => b.length - a.length);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Ersetzt jedes Vorkommen eines bekannten Begriffs in `text` durch ein
// markiertes <span>, sicher fuer innerHTML (Begriff UND Resttext werden
// escaped). Ohne geladenes Glossar (initGlossary() nie aufgerufen, z. B. in
// einem Test ohne main.js) liefert sie den reinen escapten Text zurueck --
// nie einen Fehler.
export function highlightTerms(text) {
  const raw = text || '';
  if (!sortedKeys || !sortedKeys.length) return escapeHtml(raw);
  const pattern = new RegExp(`(${sortedKeys.map(escapeRegExp).join('|')})`, 'g');
  const parts = raw.split(pattern);
  let out = '';
  for (const part of parts) {
    if (part && Object.prototype.hasOwnProperty.call(terms, part)) {
      out += `<span class="glossary-term" tabindex="0" title="${escapeHtml(terms[part])}" data-term="${escapeHtml(part)}">${escapeHtml(part)}</span>`;
    } else {
      out += escapeHtml(part);
    }
  }
  return out;
}

// EIN einziger, delegierter Listener fuer das ganze Dokument statt einen pro
// Begriff -- deckt dadurch automatisch auch kuenftig neu gerenderte
// .glossary-term-Elemente ab (Kartenscreens rendern bei jeder Aktion neu).
// Klick/Tap TOGGLED eine kleine Sprechblase (mobile Faelle); auf dem Desktop
// zeigt zusaetzlich das native title-Attribut die gleiche Erklaerung beim
// Hover, ganz ohne JS.
let bubble = null;
let installed = false;
export function installGlossaryTooltips(doc = document) {
  if (installed) return;
  installed = true;
  doc.addEventListener('click', (e) => {
    const el = e.target.closest ? e.target.closest('.glossary-term') : null;
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
    if (!el || !terms) return;
    const explanation = terms[el.dataset.term];
    if (!explanation) return;
    e.stopPropagation();
    bubble = doc.createElement('div');
    bubble.className = 'glossary-bubble';
    bubble.textContent = explanation;
    doc.body.appendChild(bubble);
    const r = el.getBoundingClientRect();
    const vw = (doc.defaultView || window).innerWidth || 400;
    bubble.style.left = `${Math.max(4, Math.min(vw - bubble.offsetWidth - 4, r.left))}px`;
    bubble.style.top = `${r.bottom + 4}px`;
  });
}
