// ============================================================================
// grain.js — living film-grain overlay
// ----------------------------------------------------------------------------
// Injects a fixed full-viewport overlay whose background is an inline SVG
// feTurbulence noise. A stepped background-position animation gives the grain
// a subtle "living" shimmer. The actual animation is driven by CSS (see
// main.css .grain), this module just injects the element + noise data-URI.
// ============================================================================

const NOISE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`
);

/** Inject the grain overlay into <body>. Idempotent. */
export function initGrain() {
  if (document.querySelector('.grain')) return;
  const el = document.createElement('div');
  el.className = 'grain';
  el.setAttribute('aria-hidden', 'true');
  el.style.backgroundImage = `url("data:image/svg+xml,${NOISE_SVG}")`;
  document.body.appendChild(el);
}
