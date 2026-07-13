// ============================================================================
// smooth-scroll.js — Lenis + GSAP ScrollTrigger wiring
// ----------------------------------------------------------------------------
// Sets up buttery inertial scrolling and syncs it with ScrollTrigger. Respects
// prefers-reduced-motion by disabling Lenis and letting the browser scroll
// natively (scrubs are neutralised elsewhere via the reduced flag).
// ============================================================================

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;

/**
 * Initialise smooth scrolling and the GSAP/ScrollTrigger bridge.
 * @returns {Lenis|null} the Lenis instance, or null when reduced motion is on.
 */
export function initSmoothScroll() {
  if (prefersReducedMotion) {
    // No smooth scroll — native scrolling. ScrollTrigger still works off window.
    ScrollTrigger.refresh();
    return null;
  }

  lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 1,
    smoothWheel: true,
    syncTouch: false
  });

  // Drive Lenis from GSAP's ticker for a single unified RAF loop.
  gsap.ticker.add((t) => {
    lenis.raf(t * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // Keep ScrollTrigger in sync with Lenis scroll position.
  lenis.on('scroll', ScrollTrigger.update);

  return lenis;
}

/** Get the active Lenis instance (or null under reduced motion). */
export function getLenis() {
  return lenis;
}

/**
 * Smoothly scroll to a target. Uses Lenis when available, otherwise native.
 * @param {string|HTMLElement} target
 * @param {object} [opts]
 */
export function scrollTo(target, opts = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, duration: 1.4, ...opts });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
}
