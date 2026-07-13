// ============================================================================
// globe-scene.js — hero set-piece: scroll-driven 3D wireframe globe
// ----------------------------------------------------------------------------
// A perspective-projected globe rendered with custom 3D math on a 2D context
// (no three.js — bundle stays lean). Geometry is fully precomputed into typed
// arrays at construction; the render loop performs zero per-frame allocations.
//
//   - Graticule: meridians/parallels every 15°, projected polylines
//   - Fibonacci-sphere dot cloud on the surface
//   - 8 city pins at real lat/lon with mono airport-code labels (front only)
//   - Great-circle route arcs with dash-draw cycles + travelling dots
//   - Depth cues: back hemisphere ~25% alpha, front full; arcs glow emerald
//   - Soft radial glow behind the globe, vignette at the edges
//
// Motion: idle yaw ~0.03 rad/s; scroll progress adds a full 2π yaw across the
// hero pin plus a pitch sweep (-0.15 → 0.2 rad) and a ~12% camera dolly-in.
// ============================================================================

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// --- palette (matches CSS custom props; canvas can't read vars cheaply) ---
// Light "above the clouds" theme: the accent glow shifts from emerald to a
// deeper pastel blue that still reads on a bright canvas, labels to slate,
// and travelling plane-dots to warm peach.
const EMERALD = '91, 147, 201'; // deeper pastel sky blue (accent-ink family)
const CREAM = '43, 50, 64';     // soft slate (label ink)
const PEACH = '201, 126, 95';   // warm peach (plane dots)
const CLOUD = '255, 255, 255';  // cloud wisps

export function createGlobeScene() {
  // ==========================================================================
  // GEOMETRY PRECOMPUTE (construction-time only)
  // ==========================================================================

  /** @type {Float32Array[]} polylines of xyz triplets on the unit sphere */
  const lines = [];

  // Meridians every 15° — sampled along latitude.
  for (let lon = 0; lon < 360; lon += 15) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 5) pushLatLon(pts, lat, lon);
    lines.push(new Float32Array(pts));
  }
  // Parallels every 15° (poles excluded) — sampled along longitude, closed.
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 7.5) pushLatLon(pts, lat, lon);
    lines.push(new Float32Array(pts));
  }

  // Fibonacci-sphere dot cloud.
  const DOTS = 320;
  const dots = new Float32Array(DOTS * 3);
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < DOTS; i++) {
    const y = 1 - (i / (DOTS - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    dots[i * 3] = Math.cos(th) * r;
    dots[i * 3 + 1] = y;
    dots[i * 3 + 2] = Math.sin(th) * r;
  }

  // Cities: real lat/lon, airport-code labels.
  const CITY_DEFS = [
    { code: 'YYZ', lat: 43.6532, lon: -79.3832 }, // Toronto
    { code: 'JFK', lat: 40.7128, lon: -74.006 },  // New York
    { code: 'SFO', lat: 37.7749, lon: -122.4194 },// San Francisco
    { code: 'LHR', lat: 51.5074, lon: -0.1278 },  // London
    { code: 'HND', lat: 35.6762, lon: 139.6503 }, // Tokyo
    { code: 'SIN', lat: 1.3521, lon: 103.8198 },  // Singapore
    { code: 'SYD', lat: -33.8688, lon: 151.2093 } // Sydney
  ];
  const cities = new Float32Array(CITY_DEFS.length * 3);
  const cityCodes = CITY_DEFS.map((c) => c.code);
  for (let i = 0; i < CITY_DEFS.length; i++) {
    const tmp = [];
    pushLatLon(tmp, CITY_DEFS[i].lat, CITY_DEFS[i].lon);
    cities[i * 3] = tmp[0];
    cities[i * 3 + 1] = tmp[1];
    cities[i * 3 + 2] = tmp[2];
  }

  // Great-circle route arcs between city pairs (slerp + altitude lift).
  const ROUTE_PAIRS = [
    [0, 3], // YYZ → LHR
    [0, 4], // YYZ → HND
    [1, 5], // JFK → SIN
    [2, 6], // SFO → SYD
    [3, 5]  // LHR → SIN
  ];
  const ARC_PTS = 40;
  /** @type {Float32Array[]} */
  const arcs = ROUTE_PAIRS.map(([ai, bi]) => {
    const arr = new Float32Array(ARC_PTS * 3);
    const ax = cities[ai * 3], ay = cities[ai * 3 + 1], az = cities[ai * 3 + 2];
    const bx = cities[bi * 3], by = cities[bi * 3 + 1], bz = cities[bi * 3 + 2];
    let dot = ax * bx + ay * by + az * bz;
    dot = Math.min(1, Math.max(-1, dot));
    const om = Math.acos(dot);
    const so = Math.sin(om);
    for (let j = 0; j < ARC_PTS; j++) {
      const t = j / (ARC_PTS - 1);
      let x, y, z;
      if (so < 1e-5) {
        x = ax; y = ay; z = az;
      } else {
        const k0 = Math.sin((1 - t) * om) / so;
        const k1 = Math.sin(t * om) / so;
        x = ax * k0 + bx * k1;
        y = ay * k0 + by * k1;
        z = az * k0 + bz * k1;
      }
      const lift = 1 + 0.22 * Math.sin(t * Math.PI); // altitude bulge
      arr[j * 3] = x * lift;
      arr[j * 3 + 1] = y * lift;
      arr[j * 3 + 2] = z * lift;
    }
    return arr;
  });

  // --- cloud wisps (light theme atmosphere) ---------------------------------
  // A handful of soft white clouds drift slowly behind the globe. Each cloud is
  // a cluster of 4-6 overlapping blobs; positions/sizes are precomputed in
  // fractional screen space (resolved to px at draw time) so no per-frame
  // allocation occurs. Rebuilt only if the layout needs it (they don't — they
  // scale with w/h). A cached radial gradient per unit blob keeps fills cheap.
  const cloudRnd = mulberry32(19);
  const CLOUD_COUNT = 4;
  /** @type {{x:number,y:number,speed:number,scale:number,alpha:number,blobs:Float32Array}[]} */
  const clouds = [];
  for (let c = 0; c < CLOUD_COUNT; c++) {
    const blobN = 4 + ((cloudRnd() * 3) | 0); // 4-6 blobs
    const blobs = new Float32Array(blobN * 3); // [dx, dy, r] in cloud-local units
    for (let b = 0; b < blobN; b++) {
      blobs[b * 3] = (cloudRnd() - 0.5) * 1.6;     // dx spread
      blobs[b * 3 + 1] = (cloudRnd() - 0.5) * 0.5; // dy spread (flatter)
      blobs[b * 3 + 2] = 0.45 + cloudRnd() * 0.55; // blob radius
    }
    clouds.push({
      x: cloudRnd(),                       // start x (fraction of width)
      y: 0.18 + cloudRnd() * 0.5,          // y band (fraction of height)
      speed: 0.006 + cloudRnd() * 0.01,    // horizontal drift (fraction/sec)
      scale: 0.08 + cloudRnd() * 0.06,     // cloud size (fraction of min(w,h))
      alpha: 0.55 + cloudRnd() * 0.2,      // 0.55-0.75 peak opacity
      blobs
    });
  }
  // Unit-radius white blob gradient, scaled via ctx transform at draw time.
  let cloudGrad = null;
  const CLOUD_R = 100;

  function ensureCloudGrad(ctx) {
    if (cloudGrad) return;
    cloudGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, CLOUD_R);
    cloudGrad.addColorStop(0, `rgba(${CLOUD},1)`);
    cloudGrad.addColorStop(0.55, `rgba(${CLOUD},0.55)`);
    cloudGrad.addColorStop(1, `rgba(${CLOUD},0)`);
  }

  /** Draw the drifting cloud layer (after bg/glow, before the globe). */
  function drawClouds(ctx, w, h, progress, time) {
    ensureCloudGrad(ctx);
    const base = Math.min(w, h);
    for (let c = 0; c < clouds.length; c++) {
      const cl = clouds[c];
      // Horizontal drift wraps across the width (+ a soft margin either side).
      let fx = (cl.x + time * cl.speed) % 1.2;
      if (fx < 0) fx += 1.2;
      const px = (fx - 0.1) * w;
      // Slight vertical parallax with scroll progress (nearer clouds sink more).
      const py = (cl.y + progress * 0.06 * (1 + c * 0.3)) * h;
      const size = cl.scale * base;
      ctx.save();
      ctx.globalAlpha = cl.alpha;
      const blobN = cl.blobs.length / 3;
      for (let b = 0; b < blobN; b++) {
        const bx = px + cl.blobs[b * 3] * size;
        const by = py + cl.blobs[b * 3 + 1] * size;
        const br = (cl.blobs[b * 3 + 2] * size) / CLOUD_R;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(br, br * 0.72); // squash vertically for a flatter cloud
        ctx.fillStyle = cloudGrad;
        ctx.fillRect(-CLOUD_R, -CLOUD_R, CLOUD_R * 2, CLOUD_R * 2);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Scratch buffer for projected polyline points: [sx, sy, zRot] per point.
  const MAX_PTS = 64;
  const proj = new Float32Array(MAX_PTS * 3);

  // --- size-keyed cached gradients (rebuilt only on resize) ---
  let cacheW = 0;
  let cacheH = 0;
  let bgGrad = null;
  let glowGrad = null;
  let vigGrad = null;
  let cachedCx = 0;
  let cachedCy = 0;

  function ensureCaches(ctx, w, h) {
    if (w === cacheW && h === cacheH) return;
    cacheW = w;
    cacheH = h;
    cachedCx = w <= 820 ? w * 0.5 : w * 0.62;
    cachedCy = h * 0.52;
    const R = Math.min(w, h) * 0.35;

    bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#eef2f7');
    bgGrad.addColorStop(1, '#e4ebf3');

    // Soft blue halo behind the globe (reads as diffused daylight).
    glowGrad = ctx.createRadialGradient(cachedCx, cachedCy, 0, cachedCx, cachedCy, R * 2.1);
    glowGrad.addColorStop(0, `rgba(${EMERALD},0.14)`);
    glowGrad.addColorStop(0.45, `rgba(${EMERALD},0.05)`);
    glowGrad.addColorStop(1, `rgba(${EMERALD},0)`);

    // Barely-there slate vignette (the light canvas can't take a dark burn).
    vigGrad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.78
    );
    vigGrad.addColorStop(0, 'rgba(43,50,64,0)');
    vigGrad.addColorStop(1, 'rgba(43,50,64,0.08)');
  }

  // ==========================================================================
  // RENDER (called every frame — no allocations here)
  // ==========================================================================
  function render(ctx, w, h, progress, time) {
    if (!w || !h) return;
    ensureCaches(ctx, w, h);

    const p = progress;
    const cx = cachedCx;
    const cy = cachedCy;
    const R = Math.min(w, h) * 0.35; // ~70vmin diameter

    // Camera: idle yaw + full 2π across the pin; pitch sweep; ~12% dolly-in.
    const yaw = 0.6 + time * 0.03 + p * TAU;
    const pitch = -0.15 + p * 0.35;
    const camDist = 3.2 - p * 0.38;
    const focal = R * Math.sqrt(camDist * camDist - 1);

    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

    // --- background + glow ---
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // --- drifting cloud wisps (behind the globe) ---
    drawClouds(ctx, w, h, p, time);

    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // --- graticule: project each polyline once, stroke back then front ---
    ctx.lineWidth = 1;
    for (let li = 0; li < lines.length; li++) {
      const pts = lines[li];
      const n = pts.length / 3;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
        // yaw (Y axis), then pitch (X axis)
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;
        const s = focal / (camDist - z2);
        proj[i * 3] = cx + x1 * s;
        proj[i * 3 + 1] = cy - y2 * s;
        proj[i * 3 + 2] = z2;
      }
      strokeDepthPass(ctx, proj, n, false); // back hemisphere, ~25% alpha
      strokeDepthPass(ctx, proj, n, true);  // front hemisphere, full alpha
    }

    // --- dot cloud ---
    ctx.fillStyle = `rgba(${EMERALD},0.12)`;
    drawDotPass(ctx, dots, DOTS, cosY, sinY, cosP, sinP, camDist, focal, cx, cy, false);
    ctx.fillStyle = `rgba(${EMERALD},0.5)`;
    drawDotPass(ctx, dots, DOTS, cosY, sinY, cosP, sinP, camDist, focal, cx, cy, true);

    // --- route arcs: dash-draw cycles, emerald glow on the front pass ---
    ctx.lineWidth = 1.2;
    for (let k = 0; k < arcs.length; k++) {
      const arc = arcs[k];
      const n = arc.length / 3;
      for (let i = 0; i < n; i++) {
        const x = arc[i * 3], y = arc[i * 3 + 1], z = arc[i * 3 + 2];
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;
        const s = focal / (camDist - z2);
        proj[i * 3] = cx + x1 * s;
        proj[i * 3 + 1] = cy - y2 * s;
        proj[i * 3 + 2] = z2;
      }

      ctx.setLineDash(ARC_DASH);
      ctx.lineDashOffset = -(time * 26 + p * 240 + k * 47);

      // Back portion: dim, no glow.
      ctx.strokeStyle = `rgba(${EMERALD},0.14)`;
      strokeSegments(ctx, proj, n, false);

      // Front portion: layered-stroke glow instead of ctx.shadowBlur — a
      // shadow-blurred stroke is a large per-frame cost on a full-viewport
      // canvas. A wide, faint under-stroke plus the normal thin stroke on
      // top reads as the same soft glow with no shadow* canvas state.
      ctx.lineWidth = 4.2;
      ctx.strokeStyle = `rgba(${EMERALD},0.18)`;
      strokeSegments(ctx, proj, n, true);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${EMERALD},0.75)`;
      strokeSegments(ctx, proj, n, true);
      ctx.setLineDash(EMPTY_DASH);

      // Travelling dot ("plane") along the arc.
      const t = (time * 0.09 + k * 0.37 + p * 0.25) % 1;
      const fi = t * (n - 1);
      const i0 = fi | 0;
      const i1 = Math.min(n - 1, i0 + 1);
      const ft = fi - i0;
      const px = proj[i0 * 3] + (proj[i1 * 3] - proj[i0 * 3]) * ft;
      const py = proj[i0 * 3 + 1] + (proj[i1 * 3 + 1] - proj[i0 * 3 + 1]) * ft;
      const pz = proj[i0 * 3 + 2] + (proj[i1 * 3 + 2] - proj[i0 * 3 + 2]) * ft;
      if (pz > -0.15) {
        const a = pz > 0 ? 0.9 : 0.3;
        // Travelling "plane" dot rendered warm peach against the blue routes.
        ctx.fillStyle = `rgba(${PEACH},${a})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, TAU);
        ctx.fill();
        // soft halo
        ctx.fillStyle = `rgba(${PEACH},${a * 0.15})`;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, TAU);
        ctx.fill();
      }
    }

    // --- city pins + labels (front hemisphere only) ---
    ctx.font = '9px "Space Mono", monospace';
    for (let i = 0; i < cityCodes.length; i++) {
      const x = cities[i * 3], y = cities[i * 3 + 1], z = cities[i * 3 + 2];
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y2 = y * cosP - z1 * sinP;
      const z2 = y * sinP + z1 * cosP;
      if (z2 <= 0.08) continue; // back hemisphere / limb — skip
      const s = focal / (camDist - z2);
      const sx = cx + x1 * s;
      const sy = cy - y2 * s;
      // fade labels near the limb
      const la = Math.min(1, (z2 - 0.08) / 0.45);

      ctx.fillStyle = `rgba(${EMERALD},${0.95 * la})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(${EMERALD},${0.45 * la})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, 5.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(${CREAM},${0.65 * la})`;
      ctx.fillText(cityCodes[i], sx + 9, sy + 3);
    }

    // --- vignette ---
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }

  return { render };
}

// Constant dash arrays (avoid per-frame array literals).
const ARC_DASH = [3, 7];
const EMPTY_DASH = [];

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
function pushLatLon(out, latDeg, lonDeg) {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  out.push(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
}

/**
 * Stroke the segments of a projected polyline whose endpoints sit on the given
 * hemisphere (front: z>0). Mixed segments render on the front pass so lines
 * meet cleanly at the limb.
 */
function strokeDepthPass(ctx, proj, n, front) {
  ctx.strokeStyle = front ? `rgba(${EMERALD},0.28)` : `rgba(${EMERALD},0.07)`;
  strokeSegments(ctx, proj, n, front);
}

function strokeSegments(ctx, proj, n, front) {
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < n - 1; i++) {
    const zA = proj[i * 3 + 2];
    const zB = proj[i * 3 + 5];
    const isFront = zA > 0 || zB > 0;
    if (isFront === front) {
      if (!pen) {
        ctx.moveTo(proj[i * 3], proj[i * 3 + 1]);
        pen = true;
      }
      ctx.lineTo(proj[i * 3 + 3], proj[i * 3 + 4]);
    } else {
      pen = false;
    }
  }
  ctx.stroke();
}

function drawDotPass(ctx, dots, count, cosY, sinY, cosP, sinP, camDist, focal, cx, cy, front) {
  for (let i = 0; i < count; i++) {
    const x = dots[i * 3], y = dots[i * 3 + 1], z = dots[i * 3 + 2];
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y2 = y * cosP - z1 * sinP;
    const z2 = y * sinP + z1 * cosP;
    if ((z2 > 0) !== front) continue;
    const s = focal / (camDist - z2);
    ctx.fillRect(cx + x1 * s - 0.9, cy - y2 * s - 0.9, 1.8, 1.8);
  }
}

// Deterministic PRNG for the (construction-time) cloud layout — identical on
// every visit, matching the seeded approach used by the other scenes.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
