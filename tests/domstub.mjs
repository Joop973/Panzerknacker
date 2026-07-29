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
  // "tag.klasse" und "tag.klasse[data-x=\"wert\"]".
  querySelectorAll(sel) {
    const m = /^([a-zA-Z]*)((?:\.[\w-]+)*)(?:\[data-([\w-]+)="([^"]*)"\])?$/.exec(sel.trim());
    if (!m) return [];
    const [, tag, clsPart, dataKey, dataVal] = m;
    const classes = clsPart ? clsPart.slice(1).split('.') : [];
    return this.descendants().filter((el) => {
      if (tag && el.tagName !== tag.toUpperCase()) return false;
      for (const c of classes) if (!el.classList.contains(c)) return false;
      if (dataKey && String(el.dataset[dataKey]) !== dataVal) return false;
      return true;
    });
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
  doc.createElement = (tag) => new El(tag);
  doc.createElementNS = (_ns, tag) => new El(tag);
  doc.getElementById = (id) => doc.descendants().find((e) => e.id === id) || null;
  doc.addEventListener = () => {};

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  globalThis.document = doc;
  globalThis.window = { document: doc, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  return () => {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  };
}
