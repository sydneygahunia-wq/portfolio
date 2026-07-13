// ============================================================================
// hero.js — pinned 360° orbit hero
// ----------------------------------------------------------------------------
// Full-viewport canvas scrubbed by a ~300vh pin. Giant Anton display letters
// slide up from a clipped baseline on load with a letter-spacing track-in, the
// Space Mono subtitle does a departure-board character flip, and an emerald
// route line draws beneath it. As the pin scrolls: canvas render(progress),
// the title parallaxes up + tracks wider, and the HUD fades.
// ============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../core/smooth-scroll.js';

export function initHero({ section, player, reduced = prefersReducedMotion }) {
  const titleLines = section.querySelectorAll('.hero__line');
  const subChars = section.querySelectorAll('.hero__sub-char');
  const routePath = section.querySelector('.hero__routeline [data-route-line]');
  const hud = section.querySelectorAll('.hud');
  const title = section.querySelector('.hero__title');
  const content = section.querySelector('.hero__content');

  // --- Scroll-driven pin: scrub the sequence + parallax the title ---
  if (reduced) {
    // Static: render a representative mid frame and show everything.
    if (player) player.render(0.15);
    gsap.set(titleLines, { yPercent: 0, opacity: 1 });
    gsap.set(subChars, { rotateX: 0, opacity: 1 });
    if (routePath) prepDash(routePath, false);
    return;
  }

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: (self) => {
      if (player) player.render(self.progress);
    }
  });

  // Parallax the title up and track its letter-spacing wider as we scroll.
  gsap.to(title, {
    yPercent: -18,
    letterSpacing: '0.04em',
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  });

  // Fade the HUD out over the first third of the pin.
  gsap.to(hud, {
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '35% top',
      scrub: true
    }
  });

  // Fade the entire hero overlay (title, subtitle, HUD, scroll cue) to fully
  // transparent over the last ~15% of the pin scrub, so nothing is left
  // visible to collide with the fixed nav at hand-off into stats. Tied to
  // scrub progress (not a one-shot tween) so it always tracks scroll position
  // exactly, including fast scrolls/scrubbing back up.
  if (content) {
    gsap.to(content, {
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: '85% top',
        end: 'bottom bottom',
        scrub: true
      }
    });
  }

  return st;
}

/**
 * Play the hero entrance (called after the preloader exits).
 * Letters slide up from a clipped baseline with stagger + track-in; the
 * subtitle flips in like a departure board; the route line draws.
 */
export function playHeroIntro(section) {
  if (!section) return;
  const letters = section.querySelectorAll('.hero__letter');
  const subChars = section.querySelectorAll('.hero__sub-char');
  const routePath = section.querySelector('.hero__routeline [data-route-line]');
  const hud = section.querySelectorAll('.hud');

  if (prefersReducedMotion) {
    gsap.set(letters, { yPercent: 0, opacity: 1 });
    gsap.set(subChars, { rotateX: 0, opacity: 1 });
    gsap.set(hud, { autoAlpha: 1 });
    if (routePath) prepDash(routePath, false);
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

  // Letters rise from below their clip mask, wide tracking easing to tight.
  tl.fromTo(
    letters,
    { yPercent: 115, opacity: 0, letterSpacing: '0.3em' },
    {
      yPercent: 0,
      opacity: 1,
      letterSpacing: '0em',
      duration: 1.05,
      stagger: 0.045
    },
    0
  );

  // Departure-board flip for the subtitle characters.
  tl.fromTo(
    subChars,
    { rotateX: -90, opacity: 0 },
    { rotateX: 0, opacity: 1, duration: 0.5, stagger: 0.025, ease: 'back.out(1.6)' },
    0.5
  );

  // Draw the emerald route line under the subtitle.
  if (routePath) {
    prepDash(routePath, true);
    tl.to(routePath, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.8);
  }

  // Fade the HUD corners in.
  tl.to(hud, { autoAlpha: 1, duration: 0.8, stagger: 0.06 }, 0.7);

  return tl;
}

// Prepare a path for a stroke-dashoffset draw. If draw=false, leave it shown.
function prepDash(path, draw) {
  const len = path.getTotalLength ? path.getTotalLength() : 300;
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = draw ? String(len) : '0';
}
