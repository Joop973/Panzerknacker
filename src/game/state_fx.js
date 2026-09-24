// Status-/Partikel-/Screenshake-/Geister-Utility-Methoden des Spielzustands:
// aus state.js ausgelagert (AUFTRAG-FERTIGSTELLUNG Phase A2), damit die
// Datei unter der ~300-Zeilen-Konvention bleibt. `createFxMethods()` liefert
// die Methoden, die createState() in den fertigen `state` mischt
// (Object.assign) -- jede Methode liest ausschliesslich `state.*`.

import { applyStatus } from './status.js';
import { createGhost, occupiedGhostSlots, pushGhost } from './ghost.js';

export function createFxMethods(state) {
  return {
    // Statuseffekt auftragen (Phase 5). In dieser Phase der EINZIGE Weg,
    // einen Status zu erzeugen -- es haengt noch keine Quelle daran
    // (Debug-Tasten 1/2/3 bei ?debug=1, Tests). Phase 6 haengt die
    // Schadenstypen an.
    applyStatus(tank, id, stacks, opts) {
      return applyStatus(state, tank, id, stacks, opts);
    },
    addShake(amount) {
      state.shake = Math.min(10, state.shake + amount);
    },
    spawnParticles(x, y, color, n, speed) {
      // Phase 11b: Deckel aus data/limits.json statt hartcodierter Zahl.
      if (state.particles.length > (state.data.limits?.particles ?? 300)) return;
      for (let i = 0; i < n; i++) {
        const ang = state.rng() * Math.PI * 2;
        const v = speed * (0.4 + state.rng() * 0.8);
        state.particles.push({
          x,
          y,
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v,
          age: 0,
          life: 0.3 + state.rng() * 0.35,
          size: 1.5 + state.rng() * 2,
          color,
        });
      }
    },
    // ghost_090 "Rueckkehr im Zorn" (Nekromant-V2 Phase 9): necro.js kann
    // ghost.js NICHT importieren (Zirkelimport -- ghost.js importiert schon
    // aus necro.js), deshalb reicht state.js diese Methode als Umweg durch
    // (Muster wie applyStatus oben). Erzeugt einen geschwaechten Ersatz an
    // der Sterbeposition, ueber denselben pushGhost()-Hook wie jede andere
    // Erzeugungsstelle (wertet "Einziger Thron" also korrekt mit aus).
    createReplacementGhost(gh, cfg) {
      // ghost_098 "Auslese der Legion": am vollen Limit trotzdem versuchen --
      // pushGhost() verschmilzt dann den schwaechsten Untertan in den
      // Champion, statt den Ersatz stillschweigend zu verweigern.
      if (
        occupiedGhostSlots(state) >= (state.data.balance?.ghost?.maxActive ?? 3) + (state.player?.cfg?.ghostMaxAdd || 0) &&
        !cfg.necroCapFusion
      ) {
        return null;
      }
      const g = createGhost(state, gh.x, gh.y, gh.heading, gh.type, { baseStatPctOverride: cfg.necroHybridReplacementStatPct });
      g.lifetimeMax = cfg.necroHybridReplacementLifetimeS;
      g.lifetime = cfg.necroHybridReplacementLifetimeS;
      pushGhost(state, g);
      return g;
    },
    // ghost_091 "Lawine der Toten": spawnt `count` KOSTENLOSE Untertanen
    // (kein Wiederbelebungswurf) mit einem eigenen Basiswert-Anteil --
    // derselbe Akt-Gegnerpool wie ghost_033/spawnGhostBomb.
    spawnFreeGhosts(count, statPct) {
      const p = state.player;
      if (!p) return;
      const cap = (state.data.balance?.ghost?.maxActive ?? 3) + (p.cfg.ghostMaxAdd || 0);
      const pool = state.actEnemyPool && state.actEnemyPool.length ? state.actEnemyPool : ['t_brown'];
      for (let i = 0; i < count; i++) {
        // ghost_098: am vollen Limit nicht abbrechen, sondern pushGhost()
        // erreichen lassen (verschmilzt dort statt zu verweigern).
        if (occupiedGhostSlots(state) >= cap && !p.cfg.necroCapFusion) break;
        const srcType = pool[Math.floor(state.rng() * pool.length)];
        pushGhost(state, createGhost(state, p.x, p.y, p.turret, srcType, { baseStatPctOverride: statPct }));
      }
    },
  };
}
