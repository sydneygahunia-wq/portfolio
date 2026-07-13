// ============================================================================
// preloader.js — boarding-pass ticket preloader
// ----------------------------------------------------------------------------
// A full-screen ink overlay styled as a minimal boarding pass. Its progress bar
// tracks the hero sequence preload (or a 1.2s minimum in fallback mode). On
// completion the ticket "tears": top half slides up, bottom half slides down,
// then it fades and the hero letters animate in.
// ============================================================================

import { gsap } from 'gsap';
import { prefersReducedMotion } from '../core/smooth-scroll.js';

export class Preloader {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.barFill = root.querySelector('[data-preloader-bar]');
    this.pct = root.querySelector('[data-preloader-pct]');
    this.top = root.querySelector('.ticket__top');
    this.bottom = root.querySelector('.ticket__bottom');
    this._value = 0;
    this._start = performance.now();
    this._minDuration = 1200; // ms floor so the ticket is legible
  }

  /** Update the visible progress (0..1). Never lets the bar jump backwards. */
  setProgress(p) {
    const clamped = Math.max(0, Math.min(1, p));
    if (clamped < this._value) return;
    this._value = clamped;
    const pctInt = Math.round(clamped * 100);
    if (this.barFill) this.barFill.style.transform = `scaleX(${clamped})`;
    if (this.pct) this.pct.textContent = String(pctInt).padStart(3, '0');
  }

  /**
   * Wait until progress is complete AND the minimum duration has elapsed,
   * then play the tear-away exit. Resolves once the hero can animate in.
   * @returns {Promise<void>}
   */
  async finish() {
    // Ensure the bar reaches 100 and the min-duration floor is honoured.
    this.setProgress(1);
    const elapsed = performance.now() - this._start;
    const wait = Math.max(0, this._minDuration - elapsed);
    if (wait > 0) await delay(wait);

    return new Promise((resolve) => {
      if (prefersReducedMotion) {
        this.root.style.display = 'none';
        resolve();
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          this.root.style.display = 'none';
          resolve();
        }
      });

      tl.to(this.root.querySelector('.ticket'), {
        // brief settle before the tear
        duration: 0.25,
        ease: 'power2.out'
      })
        .to(this.top, { yPercent: -120, duration: 0.7, ease: 'power3.inOut' }, 'tear')
        .to(this.bottom, { yPercent: 120, duration: 0.7, ease: 'power3.inOut' }, 'tear')
        .to(this.root, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 'tear+=0.25');
    });
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
