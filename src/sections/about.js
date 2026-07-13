// ============================================================================
// about.js — passenger profile (who I am)
// ----------------------------------------------------------------------------
// A full-width, normal-scroll section (no pin) that sits directly after the
// hero. The holographic panels canvas plays behind the content, scrubbed 0→1
// as the section crosses the viewport. On first entry the content plays a
// one-shot choreography: the label fades in, the two Anton heading lines
// slide up out of a clipped mask with a slight stagger, the body paragraphs
// fade + rise, and the passport data card slides up with a small rotation
// settle (like being laid down on a counter) while its machine-readable-zone
// lines wipe in left-to-right.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../core/smooth-scroll.js';

export function initAbout({ section, player }) {
  if (!section) return;

  const label = section.querySelector('.about__label');
  const lineInners = section.querySelectorAll('.about__line-inner');
  const bodies = section.querySelectorAll('.about__body');
  const passport = section.querySelector('.passport');
  const mrzLines = section.querySelectorAll('.passport__mrz-line');

  if (prefersReducedMotion) {
    // Static resting state, no scrub, one representative frame.
    if (player) player.render(0.5);
    gsap.set(label, { autoAlpha: 1 });
    gsap.set(lineInners, { yPercent: 0, opacity: 1 });
    gsap.set(bodies, { autoAlpha: 1, y: 0 });
    gsap.set(passport, { autoAlpha: 1, y: 0, rotate: 0 });
    gsap.set(mrzLines, { width: '100%' });
    return;
  }

  // --- Background scrub: panels canvas plays as the section crosses the
  // viewport (no pin — the section scrolls normally underneath it). ---
  const scrubTrigger = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
    onUpdate: (self) => {
      if (player) player.render(self.progress);
    }
  });

  // --- Entrance choreography: plays once, the first time the section
  // enters view. ---
  gsap.set(lineInners, { yPercent: 115, opacity: 0 });
  gsap.set(bodies, { autoAlpha: 0, y: 24 });
  gsap.set(passport, { autoAlpha: 0, y: 48, rotate: -2.5 });
  gsap.set(mrzLines, { width: 0 });

  const tl = gsap.timeline({
    defaults: { ease: 'power4.out' },
    scrollTrigger: {
      trigger: section,
      start: 'top 70%',
      once: true
    }
  });

  tl.to(label, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0);
  tl.to(
    lineInners,
    { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.09 },
    0.15
  );
  tl.to(
    bodies,
    { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power2.out' },
    0.4
  );
  tl.to(
    passport,
    { autoAlpha: 1, y: 0, rotate: 0, duration: 0.85, ease: 'back.out(1.4)' },
    0.45
  );
  tl.to(
    mrzLines,
    { width: '100%', duration: 0.7, stagger: 0.15, ease: 'power2.inOut' },
    0.85
  );

  return { scrubTrigger, tl };
}
