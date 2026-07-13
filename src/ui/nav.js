// ============================================================================
// nav.js — fixed minimal navigation
// ----------------------------------------------------------------------------
// Top-left mono wordmark, top-right anchor links routed through Lenis smooth
// scroll. Gains a blurred backdrop only after scrolling past the hero, and is
// hidden while the preloader is on screen.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollTo } from '../core/smooth-scroll.js';

/**
 * Wire nav link behaviour and the scrolled backdrop toggle.
 * @param {HTMLElement} navEl
 */
export function initNav(navEl) {
  if (!navEl) return;

  // Smooth-scroll anchor links through Lenis.
  navEl.querySelectorAll('a[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = a.getAttribute('href');
      if (target && target.startsWith('#')) {
        e.preventDefault();
        scrollTo(target);
      }
    });
  });

  // Add a blurred backdrop once we've scrolled roughly past the hero.
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'bottom top+=80',
    onEnter: () => navEl.classList.add('nav--scrolled'),
    onLeaveBack: () => navEl.classList.remove('nav--scrolled')
  });
}

/** Reveal the nav (called after the preloader tears away). */
export function showNav(navEl) {
  if (!navEl) return;
  gsap.to(navEl, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
}
