// Minimales DOM fuer Headless-Tests der UI-Overlays (src/ui/*.js).
//
// Warum selbstgebaut: Das Projekt hat bewusst keinen Build-Schritt und keine
// npm-Abhaengigkeiten (SPEC.md/PLAN.md-Grundregel) -- jsdom ist damit keine
// Option. Dieser Stub deckt genau die DOM-Teilmenge ab, die die
// Overlay-Module benutzen: Elementbaum, classList, dataset, Attribute,
// addEventListener/click sowie die Layout-Felder (offset*/scroll*), die
// mapscreen.js zum Zeichnen der Kanten liest.
//
// Er ersetzt KEINEN Browsertest -- er faengt die Fehlerklasse "Overlay
// schliesst nach der Aktion nicht und blockiert die Eingabe", die vorher
// von keinem Test beruehrt wurde.

class ClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  add(...cs) {
    for (const c of cs) if (c) this.set.add(c);
  }
  remove(...cs) {
    for (const c of cs) this.set.delete(c);
  }
  contains(c) {
    return this.set.has(c);
  }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : !!force;
    if (on) this.set.add(c);
    else this.set.delete(c);
    return on;
  }
  get value() {
    return [...this.set].join(' ');
  }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new ClassList(this);
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.listeners = {};
    this._text = '';
    this.disabled = false;
    // Layout: der Stub hat keine Engine -- feste, plausible Werte, damit
    // Kantenberechnungen (offsetLeft + offsetWidth / 2) rechnen koennen.
    this.offsetLeft = 10;
    this.offsetTop = 10;
    this.offsetWidth = 40;
    this.offsetHeight = 40;
    this.scrollWidth = 400;
    this.scrollHeight = 300;
  }
  set className(v) {
    this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get className() {
    return this.classList.value;
  }
  set textContent(v) {
    this._text = String(v);
    this.children = [];
  }
  get textContent() {
    return this._text || this.children.map((c) => c.textContent).join('');
  }
  set innerHTML(v) {
    this._html = String(v);
    if (v === '') this.children = [];
  }
  get innerHTML() {
    return this._html || '';
  }
  appendChild(c) {
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  append(...cs) {
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    return c;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] ?? null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  // Loest die registrierten Handler aus (echte Events braucht der Stub nicht).
  click() {
    if (this.disabled) return;
    for (const fn of this.listeners.click || []) fn({ target: this, preventDefault() {}, stopPropagation() {} });
  }
  // Generischer Ereignis-Ausloeser fuer alles ausser click (Pointer-/
  // Touch-Ereignisse in ui/touchcontrols.js). Die Felder liefert der Test.
  emit(type, ev = {}) {
    const e = { type, target: this, preventDefault() {}, stopPropagation() {}, ...ev };
    for (const fn of this.listeners[type] || []) fn(e);
    return e;
  }
  // Standardkonformer dispatchEvent -- src/ui/menunav.js (P9) nutzt echte
  // Event-Objekte (new Event('change')), nicht das emit()-Kurzformat, weil
  // dasselbe Modul unveraendert im echten Browser laufen muss. `target`
  // wird bewusst NICHT gesetzt: Node-Events haben dort nur einen Getter
  // (echte Browser fuellen ihn intern beim Dispatch) -- die Listener in
  // main.js lesen ohnehin ihren geschlossenen Elementbezug statt e.target.
  dispatchEvent(e) {
    for (const fn of this.listeners[e.type] || []) fn(e);
    return true;
  }
  // Pointer-Capture: der Stub merkt sich nur, WELCHE Zeiger gefangen sind --
  // das reicht, um zu pruefen, dass ein Abbruch sauber freigibt.
  setPointerCapture(id) {
    (this.captured ||= new Set()).add(id);
  }
  releasePointerCapture(id) {
    this.captured?.delete(id);
  }
  hasPointerCapture(id) {
    return !!this.captured?.has(id);
  }
  getBoundingClientRect() {
    return {
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
      height: this.offsetHeight,
      right: this.offsetLeft + this.offsetWidth,
      bottom: this.offsetTop + this.offsetHeight,
    };
  }
  // touchcontrols.js prueft ueber closest(), ob eine Beruehrung auf einem
  // Bedienelement liegt (Sperrzone).
  closest(sel) {
    const parts = sel.split(',').map((s) => s.trim());
    let node = this;
    while (node) {
      for (const p of parts) {
        if (/^[a-zA-Z]+$/.test(p) && node.tagName === p.toUpperCase()) return node;
        if (p.startsWith('.') && node.classList.contains(p.slice(1))) return node;
      }
      node = node.parentNode;
    }
    return null;
  }
  scrollIntoView() {}
  focus() {}
  // Alle Nachfahren als flache Liste (Reihenfolge = Dokumentordnung).
  descendants() {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  // Unterstuetzt die im Projekt benutzten Selektoren: "tag", ".klasse",
  // "tag.klasse", "tag.klasse[data-x=\"wert\"]" -- und, seit P9,
  // kommagetrennte Listen davon ("button, input"), wie sie main.js fuer
  // die Fokusnavigation benutzt. Ein einziger Durchlauf durch descendants()
  // haelt die Dokumentordnung, statt Teillisten zu vereinigen.
  // Tag-Teil erlaubt seit PLAN-STARTMENU Phase 12 auch Ziffern (h1-h6 sind
  // echte HTML-Tags) -- vorher liess "h1" die ganze Regex durchfallen
  // (unmatchter Rest "1"), querySelector('h1') gab also immer null zurueck.
  querySelectorAll(sel) {
    const matchers = sel
      .split(',')
      .map((part) => {
        const m = /^([a-zA-Z][a-zA-Z0-9]*)?((?:\.[\w-]+)*)(?:\[data-([\w-]+)="([^"]*)"\])?$/.exec(part.trim());
        if (!m) return null;
        const [, tag, clsPart, dataKey, dataVal] = m;
        const classes = clsPart ? clsPart.slice(1).split('.') : [];
        return (el) => {
          if (tag && el.tagName !== tag.toUpperCase()) return false;
          for (const c of classes) if (!el.classList.contains(c)) return false;
          if (dataKey && String(el.dataset[dataKey]) !== dataVal) return false;
          return true;
        };
      })
      .filter(Boolean);
    return this.descendants().filter((el) => matchers.some((match) => match(el)));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
}

// Installiert globalThis.document/window. Gibt eine Aufraeumfunktion zurueck.
export function installDom() {
  const doc = new El('html');
  doc.body = new El('body');
  doc.appendChild(doc.body);
  // Canvas-Stub: renderer.js legt beim Aufbau zwei Offscreen-Canvas an
  // (floorCanvas, fogCanvas) und zeichnet darauf. Der Kontext schluckt jeden
  // Aufruf, protokolliert ihn aber in ctx.calls -- damit laesst sich der
  // Renderpfad zum ersten Mal headless PRUEFEN statt nur "nicht crashen".
  const makeCtx = () => {
    const calls = [];
    const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1 };
    return new Proxy(state, {
      get(t, k) {
        if (k === 'calls') return calls;
        if (k === 'canvas') return t.canvas;
        if (k in t) return t[k];
        if (k === 'createRadialGradient' || k === 'createLinearGradient') {
          return () => ({ addColorStop() {} });
        }
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        return (...args) => {
          calls.push({ fn: String(k), args, fillStyle: t.fillStyle, globalAlpha: t.globalAlpha });
        };
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    });
  };
  doc.createElement = (tag) => {
    const el = new El(tag);
    if (tag === 'canvas') {
      el.width = 768;
      el.height = 512;
      const ctx = makeCtx();
      ctx.canvas = el;
      el.getContext = () => ctx;
    }
    return el;
  };
  doc.createElementNS = (_ns, tag) => new El(tag);
  doc.getElementById = (id) => doc.descendants().find((e) => e.id === id) || null;
  doc.addEventListener = () => {};

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevImg = globalThis.Image;
  // src/render/sprites.js legt beim Laden Image-Objekte an (initSprites()
  // laeuft als Modul-Seiteneffekt). Ohne diesen Stub kann kein Test etwas
  // importieren, das ueber renderer.js laeuft -- z. B. ui/preview.js, das
  // TANK_COLORS von dort bezieht. Das Laden selbst schlaegt fehl (kein
  // Netz), genau dafuer hat sprites.js seinen Fallback auf prozedurale
  // Formen.
  globalThis.Image = class {
    set src(v) {
      this._src = v;
      if (typeof this.onerror === 'function') this.onerror();
    }
    get src() {
      return this._src;
    }
  };
  globalThis.document = doc;
  // window mit echter Listener-Verwaltung: ui/touchcontrols.js haengt die
  // beiden Fahr-/Zielsticks an window-Touchereignisse, ein Test muss sie
  // also ausloesen koennen. innerWidth/innerHeight liefern die Bildschirm-
  // haelften fuer die Stick-Zuordnung (links = fahren, rechts = zielen).
  const winListeners = {};
  globalThis.window = {
    document: doc,
    innerWidth: 800,
    innerHeight: 400,
    addEventListener(type, fn) {
      (winListeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      winListeners[type] = (winListeners[type] || []).filter((f) => f !== fn);
    },
    emit(type, ev = {}) {
      const e = { type, target: doc.body, preventDefault() {}, stopPropagation() {}, ...ev };
      for (const fn of winListeners[type] || []) fn(e);
      return e;
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  return () => {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.Image = prevImg;
  };
}
