// Seeded RNG, Mulberry32 (Spec Abschnitt 6: Seed).
//
// Harte Regel der Spec: alle Zufallsentscheidungen laufen ueber den
// Seed-RNG, niemals ueber Math.random(). Deshalb existiert dieses Modul
// schon ab Phase 3 (KI-Zufall); die Seed-Eingabe im UI kommt in Phase 7.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Komfort: Zufallszahl im Intervall [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// --- Abgeleitete Stroeme (Phase 0b) --------------------------------------
//
// Der Run haelt KEINEN fortlaufenden RNG-Zustand mehr. Stattdessen wird
// jeder Strom bei Bedarf frisch aus hash(seed, roomIndex, label) abgeleitet.
// Vorteile:
//  - Ein unterbrochener Run laesst sich fortsetzen, ohne Zaehlerstaende zu
//    speichern (Seed + Raumnummer genuegen).
//  - Geteilte Seeds und Replays werden dadurch ueberhaupt erst moeglich.
//  - Getrennte Labels heissen: eine Aenderung an einem System (z. B. der
//    Upgrade-Auswahl) verschiebt die anderen Stroeme (z. B. Raumlayouts)
//    nicht mehr.

// FNV-1a ueber die Zahlen/Zeichen der Bestandteile -> 32-bit-Seed.
export function hashSeed(...parts) {
  let h = 0x811c9dc5 >>> 0;
  const mix = (byte) => {
    h ^= byte & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (const part of parts) {
    if (typeof part === 'number') {
      const n = part >>> 0;
      mix(n);
      mix(n >>> 8);
      mix(n >>> 16);
      mix(n >>> 24);
    } else {
      const s = String(part);
      for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i));
    }
    mix(0x3a); // Trennzeichen -> ("ab",1) != ("a",21)
  }
  return h >>> 0;
}

// Ein benannter Strom fuer genau einen Raum.
export function rngFor(seed, roomIndex, label) {
  return mulberry32(hashSeed(seed >>> 0, roomIndex >>> 0, label));
}
