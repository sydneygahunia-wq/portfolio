// ============================================================================
// sequence-player.js — canvas frame-sequence engine (the heart of the site)
// ----------------------------------------------------------------------------
// Drives a scroll-scrubbed image sequence on a <canvas>. When a sequence has
// real frames (count > 0) they are preloaded progressively (every 8th → 4th →
// 2nd → all) so scrubbing works early and refines over time — real frames
// always win. When count is 0, the player runs a PROCEDURAL scene instead:
// a fully-designed cinematic set-piece module (see src/core/scenes/) that
// renders on the same render(progress) input. The scene's rAF loop pauses via
// IntersectionObserver while the canvas is offscreen, and renders one static
// frame under prefers-reduced-motion.
// ============================================================================

export class SequencePlayer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{name:string, count:number, path:string, ext:string, pad:number,
   *          dprCap?:number,
   *          scene?:{render:(ctx:CanvasRenderingContext2D,w:number,h:number,progress:number,time:number)=>void}}} opts
   */
  constructor(canvas, { name, count, path, ext, pad, dprCap, scene } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.name = name || 'sequence';
    this.count = Number.isFinite(count) && count > 0 ? count : 0;
    this.path = path || '';
    this.ext = ext || 'webp';
    this.pad = pad || 4;
    this.dprCap = dprCap || 2;
    this.scene = scene || null;

    // Real-frame state
    this.frames = new Array(this.count).fill(null); // sparse ImageBitmap store
    this.loaded = new Array(this.count).fill(false);
    this.loadedCount = 0;
    this.currentIndex = -1;

    // Procedural scene mode runs when there are no real frames
    this.fallback = this.count === 0;
    this._progress = 0;
    this._rafId = 0;
    this._destroyed = false;

    // Procedural-mode progress easing: render(progress) sets the target; the
    // rAF loop eases a displayed value toward it every tick (frame-rate
    // independent exponential smoothing) so event-quantized scroll input
    // (Lenis/ScrollTrigger ticks) doesn't read as choppy stepping.
    this._targetProgress = 0;
    this._displayProgress = 0;
    this._lastFrameT = 0;

    // Scene-loop time base (seconds, continuous across pause/resume)
    this._fbTime = 0;
    this._fbT0 = 0;
    this._loopWanted = false;
    this._visible = true;

    // Sizing (CSS px)
    this.cssW = 0;
    this.cssH = 0;

    this._onResize = this._onResize.bind(this);

    this._resize();
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(this.canvas);

    // Pause the scene loop while the canvas is offscreen.
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) this._visible = e.isIntersecting;
          if (this.fallback && this._loopWanted) {
            if (this._visible) this._startFallbackLoop();
            else this._stopFallbackLoop();
          }
        },
        { rootMargin: '12%' }
      );
      this._io.observe(this.canvas);
    }
  }

  // --------------------------------------------------------------------------
  // Sizing / cover-fit
  // --------------------------------------------------------------------------
  _dpr() {
    // Fill-rate bound: these canvases run full-viewport, so pixel count
    // (not just devicePixelRatio) drives per-frame cost. Cap independently
    // of the caller-supplied dprCap — 1.75 above the 820px breakpoint (was
    // 2), 1.5 at/below it — to keep the hero globe's repaint cheap.
    const viewportCap = window.innerWidth <= 820 ? 1.5 : 1.75;
    return Math.min(window.devicePixelRatio || 1, this.dprCap, viewportCap);
  }

  _reducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = this._dpr();
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);

    const changed = this.canvas.width !== pxW || this.canvas.height !== pxH;
    this.cssW = cssW;
    this.cssH = cssH;
    if (changed) {
      this.canvas.width = pxW;
      this.canvas.height = pxH;
      // Draw in CSS-pixel space
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return changed;
  }

  _onResize() {
    const changed = this._resize();
    if (changed) {
      // Force a redraw at the current progress
      this.currentIndex = -1;
      if (this.fallback) this._renderFallback(this._displayProgress);
      else this.render(this._progress);
    }
  }

  // --------------------------------------------------------------------------
  // Progressive preloading
  // --------------------------------------------------------------------------
  /**
   * Load frames progressively. Resolves once every frame is loaded (or instantly
   * in fallback mode). onProgress receives a 0..1 value.
   * @param {(p:number)=>void} [onProgress]
   */
  async load(onProgress) {
    if (this.fallback) {
      // No real frames. Under reduced motion render a single static scene
      // frame; otherwise start the living scene loop (paused when offscreen).
      if (this._reducedMotion()) {
        this._renderFallback(this._progress);
      } else {
        this._loopWanted = true;
        if (this._visible) this._startFallbackLoop();
      }
      if (onProgress) onProgress(1);
      return;
    }

    const report = () => {
      if (onProgress) onProgress(this.count ? this.loadedCount / this.count : 1);
    };

    // Build the order of indices to fetch: strides 8, 4, 2, 1 (dedup).
    const order = this._buildLoadOrder();

    // Small concurrency pool so early frames appear fast without saturating.
    const CONCURRENCY = 6;
    let cursor = 0;

    const worker = async () => {
      while (cursor < order.length && !this._destroyed) {
        const idx = order[cursor++];
        if (this.loaded[idx]) continue;
        const bmp = await this._fetchFrame(idx);
        if (this._destroyed) return;
        if (bmp) {
          this.frames[idx] = bmp;
          this.loaded[idx] = true;
          this.loadedCount++;
          // Refine the current view: a nearer frame may now be available.
          this.render(this._progress);
        }
        report();
      }
    };

    report();
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);
    report();
  }

  _buildLoadOrder() {
    const n = this.count;
    const seen = new Set();
    const order = [];
    for (const stride of [8, 4, 2, 1]) {
      for (let i = 0; i < n; i += stride) {
        if (!seen.has(i)) {
          seen.add(i);
          order.push(i);
        }
      }
    }
    // Make sure the very last frame is included.
    if (!seen.has(n - 1) && n > 0) order.push(n - 1);
    return order;
  }

  _frameUrl(idx) {
    const num = String(idx + 1).padStart(this.pad, '0');
    return `${this.path}/frame_${num}.${this.ext}`;
  }

  async _fetchFrame(idx) {
    try {
      const res = await fetch(this._frameUrl(idx), { cache: 'force-cache' });
      if (!res.ok) return null;
      const blob = await res.blob();
      // Async decode off the main thread where supported.
      if ('createImageBitmap' in window) {
        return await createImageBitmap(blob);
      }
      // Fallback decode path
      return await this._decodeViaImage(blob);
    } catch {
      return null;
    }
  }

  _decodeViaImage(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  /**
   * Render the frame nearest to the given scroll progress (0..1).
   * @param {number} progress
   */
  render(progress) {
    const p = clamp01(progress);
    if (this.fallback) {
      // Store the target; the rAF loop eases _displayProgress toward it
      // every tick (see _startFallbackLoop) so scroll's quantized progress
      // events read as a continuous glide instead of discrete jumps.
      this._targetProgress = p;
      // While the scene loop runs it repaints every rAF with the eased
      // progress; only draw immediately (snapped, no easing) when the loop
      // is paused/absent — e.g. the prefers-reduced-motion static frame.
      if (!this._rafId) {
        this._displayProgress = p;
        this._progress = p;
        this._renderFallback(p);
      }
      return;
    }
    this._progress = p;
    if (this.count === 0) return;

    const target = Math.round(this._progress * (this.count - 1));
    const idx = this._nearestLoaded(target);
    if (idx < 0) return; // nothing loaded yet

    if (idx === this.currentIndex) return; // nothing changed
    this.currentIndex = idx;
    this._drawBitmapCover(this.frames[idx]);
  }

  _nearestLoaded(target) {
    if (this.loaded[target]) return target;
    // Search outward for the closest loaded frame.
    for (let d = 1; d < this.count; d++) {
      const lo = target - d;
      const hi = target + d;
      if (lo >= 0 && this.loaded[lo]) return lo;
      if (hi < this.count && this.loaded[hi]) return hi;
    }
    return -1;
  }

  _drawBitmapCover(bmp) {
    const ctx = this.ctx;
    const cw = this.cssW;
    const ch = this.cssH;
    const iw = bmp.width;
    const ih = bmp.height;
    if (!iw || !ih) return;

    // background-size: cover math
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(bmp, dx, dy, dw, dh);
  }

  // --------------------------------------------------------------------------
  // Procedural scene mode — cinematic set-pieces (src/core/scenes/)
  // ----------------------------------------------------------------------------
  // The rAF loop keeps a continuous time base across pause/resume so the scene
  // never visibly "jumps" when scrolled back into view.
  // --------------------------------------------------------------------------
  _startFallbackLoop() {
    if (this._rafId || this._destroyed) return;
    this._fbT0 = performance.now() - this._fbTime * 1000;
    this._lastFrameT = performance.now();
    const loop = (t) => {
      if (this._destroyed || !this._rafId) return;
      this._fbTime = (t - this._fbT0) / 1000;

      // Frame-rate independent exponential smoothing toward the latest
      // scroll-driven target. Scroll input arrives event-quantized (Lenis
      // lerp + ScrollTrigger's onUpdate ticks), so easing the displayed
      // value every rAF tick — rather than snapping straight to the raw
      // target — turns discrete progress jumps into a continuous glide.
      const dt = Math.min(0.05, Math.max(0, (t - this._lastFrameT) / 1000));
      this._lastFrameT = t;
      const gap = this._targetProgress - this._displayProgress;
      if (Math.abs(gap) < 0.0005) {
        // Close enough — snap to avoid endless imperceptible micro-repaints.
        this._displayProgress = this._targetProgress;
      } else {
        this._displayProgress += gap * (1 - Math.exp(-dt * 7));
      }
      this._progress = this._displayProgress;

      this._renderFallback(this._displayProgress);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _stopFallbackLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  _renderFallback(progress) {
    const w = this.cssW;
    const h = this.cssH;
    if (!w || !h) return;
    const p = clamp01(progress);

    if (this.scene && typeof this.scene.render === 'function') {
      this.scene.render(this.ctx, w, h, p, this._fbTime);
      return;
    }
    // Guard: no scene supplied — hold a clean cloud-white wash so nothing looks broken.
    this.ctx.fillStyle = '#eef2f7';
    this.ctx.fillRect(0, 0, w, h);
  }

  // --------------------------------------------------------------------------
  destroy() {
    this._destroyed = true;
    this._loopWanted = false;
    this._stopFallbackLoop();
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    // Release bitmaps
    for (const f of this.frames) {
      if (f && typeof f.close === 'function') {
        try { f.close(); } catch { /* noop */ }
      }
    }
    this.frames = [];
  }
}

// --- helpers ---
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
