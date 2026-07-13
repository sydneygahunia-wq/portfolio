// ============================================================================
// route-lines.js — shared SVG helpers: route paths, pins, passport stamps
// ----------------------------------------------------------------------------
// Small factory functions that return SVG element strings / nodes for the
// travel-UI motifs used across sections: animated route lines with
// stroke-dashoffset draw-on, location pins, dotted great-circle arcs, and
// circular passport rubber-stamps that pop in.
// ============================================================================

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Create a horizontal (or arced) dotted route line SVG that draws itself in.
 * The returned <svg> has a <path> with data-route-line for GSAP to animate.
 * @param {{width?:number,height?:number,arc?:number,dashed?:boolean,className?:string}} opts
 */
export function routeLineSVG({ width = 200, height = 24, arc = 0, dashed = false, className = '' } = {}) {
  const y = height / 2;
  const midX = width / 2;
  const d = arc
    ? `M2 ${y} Q ${midX} ${y - arc} ${width - 2} ${y}`
    : `M2 ${y} L ${width - 2} ${y}`;
  const dashAttr = dashed ? 'stroke-dasharray="2 6"' : '';
  return `<svg class="route-line-svg ${className}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" xmlns="${SVGNS}" aria-hidden="true">
    <path class="route-line-path" data-route-line d="${d}" stroke="var(--emerald)" stroke-width="1" ${dashAttr} stroke-linecap="round"/>
    <circle class="route-line-start" cx="2" cy="${y}" r="2.2" fill="var(--emerald)"/>
    <circle class="route-line-end" cx="${width - 2}" cy="${y}" r="2.2" fill="var(--emerald)"/>
  </svg>`;
}

/**
 * A small location-pin glyph.
 * @param {{size?:number,className?:string}} opts
 */
export function pinSVG({ size = 18, className = '' } = {}) {
  return `<svg class="pin-svg ${className}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" xmlns="${SVGNS}" aria-hidden="true">
    <path d="M12 2C7.6 2 4 5.6 4 10c0 5.8 7.3 11.4 7.6 11.6a.7.7 0 0 0 .8 0C12.7 21.4 20 15.8 20 10c0-4.4-3.6-8-8-8Z" stroke="var(--emerald)" stroke-width="1.4" fill="rgba(121,174,222,0.08)"/>
    <circle cx="12" cy="10" r="3" fill="var(--emerald)"/>
  </svg>`;
}

/**
 * A circular passport rubber-stamp. Slightly rough, mono label, faint rotate.
 * Reveal by animating scale 1.4→1 + opacity on the [data-stamp] element.
 * @param {{label?:string,sub?:string,size?:number,rotate?:number,className?:string}} opts
 */
export function stampSVG({ label = 'APPROVED', sub = 'PORTFOLIO', size = 120, rotate = -8, className = '' } = {}) {
  const id = 'stamp-' + Math.random().toString(36).slice(2, 8);
  const r = 54;
  const rInner = 44;
  return `<svg class="stamp-svg ${className}" data-stamp viewBox="0 0 120 120" width="${size}" height="${size}" fill="none" xmlns="${SVGNS}" style="transform:rotate(${rotate}deg)" aria-hidden="true">
    <defs>
      <path id="${id}-top" d="M60 60 m-${r + 6} 0 a ${r + 6} ${r + 6} 0 1 1 ${(r + 6) * 2} 0" />
      <path id="${id}-bot" d="M60 60 m${r + 6} 0 a ${r + 6} ${r + 6} 0 1 1 -${(r + 6) * 2} 0" />
    </defs>
    <circle cx="60" cy="60" r="${r}" stroke="var(--peach)" stroke-width="2.5" opacity="0.9"/>
    <circle cx="60" cy="60" r="${rInner}" stroke="var(--peach)" stroke-width="1" opacity="0.5" stroke-dasharray="3 4"/>
    <text class="stamp-label" x="60" y="58" text-anchor="middle" fill="var(--peach-ink)" font-family="'Space Mono', monospace" font-size="15" letter-spacing="1" font-weight="700">${label}</text>
    <text x="60" y="74" text-anchor="middle" fill="var(--peach-ink)" font-family="'Space Mono', monospace" font-size="7" letter-spacing="2" opacity="0.8">${sub}</text>
    <text font-family="'Space Mono', monospace" font-size="7" letter-spacing="3" fill="var(--peach-ink)" opacity="0.7">
      <textPath href="#${id}-top" startOffset="8%">★ CLEARED FOR DEPARTURE ★</textPath>
    </text>
  </svg>`;
}

/**
 * A boarding-pass style route header row: "SYD ✈ YYZ" with a flight code.
 * @param {{from?:string,to?:string,code?:string}} opts
 */
export function routeHeader({ from = 'DEP', to = 'ARR', code = 'FLT SG-000' } = {}) {
  return `<div class="route-header">
    <span class="route-node">${from}</span>
    <span class="route-track"><span class="route-plane">✈</span></span>
    <span class="route-node">${to}</span>
    <span class="route-code">${code}</span>
  </div>`;
}
