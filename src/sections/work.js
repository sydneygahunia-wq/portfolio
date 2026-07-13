// ============================================================================
// work.js — selected work: boarding-pass cards
// ----------------------------------------------------------------------------
// Three boarding-pass cards enter with stagger + an emerald mini stamp. Cards
// lift and tilt toward the cursor on hover (disabled ≤820px), and their
// route arc animates on hover.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../core/smooth-scroll.js';

export function initWork({ cardsSection }) {
  const cards = cardsSection ? Array.from(cardsSection.querySelectorAll('.pass-card')) : [];

  // --- Card entrances ---
  if (cards.length) {
    if (prefersReducedMotion) {
      gsap.set(cards, { autoAlpha: 1, y: 0 });
      cards.forEach((c) => {
        const stamp = c.querySelector('[data-stamp]');
        if (stamp) gsap.set(stamp, { scale: 1, opacity: 1, rotate: -10 });
      });
    } else {
      cards.forEach((card, i) => {
        const stamp = card.querySelector('[data-stamp]');
        gsap.set(card, { autoAlpha: 0, y: 60 });
        if (stamp) gsap.set(stamp, { scale: 1.5, opacity: 0, rotate: -22 });

        ScrollTrigger.create({
          trigger: card,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(card, {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              ease: 'power3.out',
              delay: (i % 3) * 0.1
            });
            if (stamp) {
              gsap.to(stamp, {
                scale: 1,
                opacity: 1,
                rotate: -10,
                duration: 0.5,
                ease: 'back.out(2.2)',
                delay: 0.25 + (i % 3) * 0.1
              });
            }
          }
        });
      });
    }

    // --- Cursor tilt (desktop only, respects reduced motion) ---
    setupTilt(cards);
  }
}

/**
 * 3D cursor tilt for cards. Disabled ≤820px or under reduced motion; those
 * users still get the CSS hover lift.
 * @param {HTMLElement[]} cards
 */
function setupTilt(cards) {
  const mq = window.matchMedia('(max-width: 820px)');
  const enabled = () => !mq.matches && !prefersReducedMotion;

  cards.forEach((card) => {
    let raf = 0;
    let tx = 0;
    let ty = 0;

    const onMove = (e) => {
      if (!enabled()) return;
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height;
      tx = (py - 0.5) * -10; // rotateX
      ty = (px - 0.5) * 12; // rotateY
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          gsap.to(card, {
            rotateX: tx,
            rotateY: ty,
            y: -6,
            duration: 0.4,
            ease: 'power2.out',
            transformPerspective: 900,
            transformOrigin: 'center'
          });
        });
      }
    };

    const reset = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.6)' });
    };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', reset);
  });
}
