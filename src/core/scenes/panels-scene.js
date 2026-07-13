// ============================================================================
// panels-scene.js — builder set-piece: floating holographic command centre
// ----------------------------------------------------------------------------
// Perspective-projected wireframe panels (emerald outlines, faint scanline
// fills, fake code/route glyph lines) drifting in 3D space at varying depths.
// Scroll progress drives a camera push-in — panels grow and slide past — with
// thin connection lines and pulsing nodes between panels. Kept deliberately
// dim so the section's text stays perfectly legible under the section scrim.
//
// All panel geometry is precomputed with a seeded PRNG (deterministic between
// loads); the render loop performs zero per-frame allocations.
// ============================================================================

const TAU = Math.PI * 2;
// Light "above the clouds" theme: panel strokes/nodes shift to deeper pastel
// blue; glyph readouts to slate kept at low alpha so the section's text over
// the fog scrim stays perfectly legible.
const EMERALD = '91, 147, 201'; // deeper pastel sky blue
const CREAM = '43, 50, 64';     // soft slate

const PANEL_COUNT = 16;
const LOOP = 10;   // world-depth loop length (panels recycle)
const NEAR = 0.45; // nearest depth before a panel wraps

export function createPanelsScene() {
  // ==========================================================================
  // PRECOMPUTE (construction only)
  // ==========================================================================
  const rnd = mulberry32(7);

  /** @type {{x:number,y:number,z:number,w:number,h:number,rot:number,phase:number,glyphs:Float32Array,scan:number}[]} */
  const panels = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Glyph lines: [yFrac, xFrac, wFrac] per line — fake code / route readouts.
    const glyphCount = 4 + ((rnd() * 3) | 0);
    const glyphs = new Float32Array(glyphCount * 3);
    for (let g = 0; g < glyphCount; g++) {
      glyphs[g * 3] = 0.18 + (g / glyphCount) * 0.66;   // y within panel
      glyphs[g * 3 + 1] = 0.08 + rnd() * 0.12;           // x start
      glyphs[g * 3 + 2] = 0.18 + rnd() * 0.55;           // width
    }
    panels.push({
      x: side * (0.65 + rnd() * 1.5),
      y: (rnd() - 0.5) * 2.1,
      z: NEAR + (i / PANEL_COUNT) * LOOP + rnd() * 0.45,
      w: 0.72 + rnd() * 0.65,
      h: 0.42 + rnd() * 0.5,
      rot: (rnd() - 0.5) * 0.12,
      phase: rnd() * TAU,
      glyphs,
      scan: 3 + ((rnd() * 3) | 0)
    });
  }

  // Connection pairs (panel index → panel index), chosen at fixed offsets.
  const CONNECTIONS = [
    [0, 3], [2, 5], [4, 7], [6, 9], [8, 11], [10, 13], [12, 15]
  ];

  // Reusable per-frame state (no allocations in render).
  const zEff = new Float32Array(PANEL_COUNT);
  const sxArr = new Float32Array(PANEL_COUNT);
  const syArr = new Float32Array(PANEL_COUNT);
  const alphaArr = new Float32Array(PANEL_COUNT);
  const order = new Uint8Array(PANEL_COUNT);

  // Size-keyed cached gradients.
  let cacheW = 0, cacheH = 0;
  let bgGrad = null, glowGrad = null, vigGrad = null;

  function ensureCaches(ctx, w, h) {
    if (w === cacheW && h === cacheH) return;
    cacheW = w;
    cacheH = h;

    bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#eef2f7');
    bgGrad.addColorStop(1, '#e4ebf3');

    const gx = w * 0.68, gy = h * 0.45;
    glowGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.65);
    glowGrad.addColorStop(0, `rgba(${EMERALD},0.08)`);
    glowGrad.addColorStop(1, `rgba(${EMERALD},0)`);

    // Barely-there slate vignette for the light canvas.
    vigGrad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.32,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(43,50,64,0)');
    vigGrad.addColorStop(1, 'rgba(43,50,64,0.07)');
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  function render(ctx, w, h, progress, time) {
    if (!w || !h) return;
    ensureCaches(ctx, w, h);

    const cx = w * 0.58; // biased right — scrim darkens the left text column
    const cy = h * 0.5;
    const focal = h * 0.85;
    const cam = progress * 6.5 + time * 0.12; // push-in + gentle ambient drift

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // --- compute effective depths + screen positions ---
    for (let i = 0; i < PANEL_COUNT; i++) {
      const pn = panels[i];
      let z = (pn.z - cam) % LOOP;
      if (z < 0) z += LOOP;
      z += NEAR;
      zEff[i] = z;
      const s = focal / z;
      sxArr[i] = cx + pn.x * s * 0.32;
      syArr[i] = cy - pn.y * s * 0.32;
      // Depth alpha: bright when near, dim when far; fade at the wrap edges.
      const fadeIn = Math.min(1, (z - NEAR) / 0.9);
      const fadeFar = Math.max(0, 1 - (z - 2) / (LOOP - 1));
      alphaArr[i] = Math.max(0, Math.min(0.4, 0.5 * fadeIn * fadeFar));
      order[i] = i;
    }

    // Painter's sort, far → near (insertion sort, in place, no allocations).
    for (let i = 1; i < PANEL_COUNT; i++) {
      const oi = order[i];
      const zi = zEff[oi];
      let j = i - 1;
      while (j >= 0 && zEff[order[j]] < zi) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = oi;
    }

    // --- connection lines + pulsing nodes (behind panels) ---
    ctx.lineWidth = 1;
    for (let c = 0; c < CONNECTIONS.length; c++) {
      const a = CONNECTIONS[c][0];
      const b = CONNECTIONS[c][1];
      // Skip cross-loop pairs so lines never teleport across the screen.
      if (Math.abs(zEff[a] - zEff[b]) > 3.5) continue;
      const la = Math.min(alphaArr[a], alphaArr[b]) * 0.5;
      if (la <= 0.01) continue;
      ctx.strokeStyle = `rgba(${EMERALD},${la})`;
      ctx.beginPath();
      ctx.moveTo(sxArr[a], syArr[a]);
      ctx.lineTo(sxArr[b], syArr[b]);
      ctx.stroke();
      // Pulsing node at the midpoint.
      const mx = (sxArr[a] + sxArr[b]) / 2;
      const my = (syArr[a] + syArr[b]) / 2;
      const pulse = 1.4 + Math.sin(time * 2 + c * 1.7) * 0.7;
      ctx.fillStyle = `rgba(${EMERALD},${la * 2.2})`;
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, TAU);
      ctx.fill();
    }

    // --- panels, far to near ---
    for (let oi = 0; oi < PANEL_COUNT; oi++) {
      const i = order[oi];
      const a = alphaArr[i];
      if (a <= 0.01) continue;
      const pn = panels[i];
      const z = zEff[i];
      const s = focal / z;
      const pw = pn.w * s * 0.32;
      const ph = pn.h * s * 0.32;

      ctx.save();
      ctx.translate(sxArr[i], syArr[i]);
      ctx.rotate(pn.rot);

      // Faint holographic fill + wireframe outline.
      ctx.fillStyle = `rgba(${EMERALD},${a * 0.06})`;
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.strokeStyle = `rgba(${EMERALD},${a})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

      // Corner ticks (technical HUD feel).
      const tick = Math.min(8, pw * 0.12);
      ctx.strokeStyle = `rgba(${EMERALD},${Math.min(0.6, a * 1.6)})`;
      ctx.beginPath();
      ctx.moveTo(-pw / 2, -ph / 2 + tick); ctx.lineTo(-pw / 2, -ph / 2); ctx.lineTo(-pw / 2 + tick, -ph / 2);
      ctx.moveTo(pw / 2 - tick, -ph / 2); ctx.lineTo(pw / 2, -ph / 2); ctx.lineTo(pw / 2, -ph / 2 + tick);
      ctx.stroke();

      // Scanlines.
      ctx.strokeStyle = `rgba(${EMERALD},${a * 0.18})`;
      ctx.beginPath();
      for (let sl = 1; sl <= pn.scan; sl++) {
        const yy = -ph / 2 + (ph * sl) / (pn.scan + 1);
        ctx.moveTo(-pw / 2, yy);
        ctx.lineTo(pw / 2, yy);
      }
      ctx.stroke();

      // Glyph lines (fake code / route readouts).
      ctx.fillStyle = `rgba(${CREAM},${a * 0.55})`;
      const gn = pn.glyphs.length / 3;
      for (let g = 0; g < gn; g++) {
        const gy = -ph / 2 + pn.glyphs[g * 3] * ph;
        const gx = -pw / 2 + pn.glyphs[g * 3 + 1] * pw;
        const gw = pn.glyphs[g * 3 + 2] * pw * 0.8;
        ctx.fillRect(gx, gy, gw, 1.2);
      }

      // Status dot, softly blinking per panel.
      const blink = 0.5 + 0.5 * Math.sin(time * 1.6 + pn.phase);
      ctx.fillStyle = `rgba(${EMERALD},${a * (0.8 + blink)})`;
      ctx.beginPath();
      ctx.arc(pw / 2 - 6, -ph / 2 + 6, 1.6, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    // --- vignette ---
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }

  return { render };
}

// ----------------------------------------------------------------------------
// Deterministic PRNG so the layout is identical on every visit.
// ----------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
