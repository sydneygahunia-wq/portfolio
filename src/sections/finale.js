// ============================================================================
// finale.js — arrival / final destination
// ----------------------------------------------------------------------------
// An "ARRIVAL" mono stamp pops in, huge Anton "LET'S BUILD / WHAT'S NEXT"
// letters reveal on enter, and background route arcs draw toward a pulsing
// centre pin. Buttons scroll to work / open mailto with hover polish.
// ============================================================================

import { gsap } from 'gsap';
import { prefersReducedMotion, scrollTo } from '../core/smooth-scroll.js';

export function initFinale(section) {
  if (!section) return;

  const stampLabel = section.querySelector('.finale__stamp');
  const letters = section.querySelectorAll('.finale__letter');
  const arcs = section.querySelectorAll('.finale__arc');
  const pin = section.querySelector('.finale__pin');
  const buttons = section.querySelectorAll('.finale__actions .btn');

  // Wire the primary "VIEW MY WORK" button to smooth-scroll to #work.
  const viewWork = section.querySelector('[data-scroll-to]');
  if (viewWork) {
    viewWork.addEventListener('click', (e) => {
      e.preventDefault();
      scrollTo(viewWork.getAttribute('data-scroll-to') || '#work');
    });
  }

  if (prefersReducedMotion) {
    gsap.set(letters, { yPercent: 0, opacity: 1 });
    gsap.set(stampLabel, { scale: 1, opacity: 1 });
    arcs.forEach((a) => setDash(a, false));
    if (pin) pin.classList.add('is-pulsing');
    return;
  }

  // Prep the arcs for a draw-on.
  arcs.forEach((a) => setDash(a, true));

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 65%',
      once: true
    }
  });

  // Stamp pops in.
  tl.fromTo(
    stampLabel,
    { scale: 1.5, opacity: 0, rotate: -12 },
    { scale: 1, opacity: 1, rotate: -3, duration: 0.5, ease: 'back.out(2.4)' },
    0
  );

  // Converging route arcs draw toward the centre.
  tl.to(
    arcs,
    { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.12 },
    0.1
  );

  // Headline letters reveal.
  tl.fromTo(
    letters,
    { yPercent: 110, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.03 },
    0.35
  );

  // Pin begins pulsing once arcs land.
  tl.add(() => {
    if (pin) pin.classList.add('is-pulsing');
  }, 1.2);

  // Buttons fade up.
  tl.fromTo(
    buttons,
    { y: 24, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.1 },
    1.1
  );
}

function setDash(path, draw) {
  const len = path.getTotalLength ? path.getTotalLength() : 400;
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = draw ? String(len) : '0';
}
