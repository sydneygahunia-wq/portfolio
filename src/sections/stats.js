// ============================================================================
// stats.js — travel-log impact strip
// ----------------------------------------------------------------------------
// Four stats in a responsive row. Each Anton number counts up when scrolled
// into view (snap 1, ~1.6s power2.out, optional "+" suffix), and a dotted
// route line draws across the four stats.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../core/smooth-scroll.js';

export function initStats(section) {
  if (!section) return;

  const numbers = section.querySelectorAll('[data-count]');
  const connector = section.querySelector('.stats__connector [data-route-line]');

  if (prefersReducedMotion) {
    // Show final values immediately.
    numbers.forEach((el) => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const suffix = el.dataset.suffix || '';
      el.textContent = target + suffix;
    });
    if (connector) setDash(connector, false);
    return;
  }

  // Draw the connector route line across the row.
  if (connector) {
    setDash(connector, true);
    ScrollTrigger.create({
      trigger: section,
      start: 'top 75%',
      once: true,
      onEnter: () => {
        gsap.to(connector, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' });
      }
    });
  }

  // Count-up for each stat.
  numbers.forEach((el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const counter = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(counter, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          snap: { v: 1 },
          onUpdate: () => {
            el.textContent = Math.round(counter.v) + suffix;
          }
        });
      }
    });
  });
}

function setDash(path, draw) {
  const len = path.getTotalLength ? path.getTotalLength() : 400;
  path.style.strokeDasharray = draw ? String(len) : '2 6';
  path.style.strokeDashoffset = draw ? String(len) : '0';
}
