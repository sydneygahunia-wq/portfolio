// ============================================================================
// manifest.js — fetch + parse /sequences/manifest.json
// ----------------------------------------------------------------------------
// The manifest describes each frame sequence used by the site. If it is missing,
// malformed, or a sequence reports count 0, the caller falls back to the
// SequencePlayer's bulletproof procedural mode. Nothing here ever throws.
// ============================================================================

const DEFAULTS = {
  hero: { count: 0, path: '/sequences/hero', ext: 'webp', pad: 4 },
  builder: { count: 0, path: '/sequences/builder', ext: 'webp', pad: 4 },
  closer: { count: 0, path: '/sequences/closer', ext: 'webp', pad: 4 }
};

/**
 * Load and normalise the sequence manifest.
 * Always resolves — on any error returns the zero-count defaults so the site
 * runs in procedural fallback mode without console errors.
 * @returns {Promise<Record<string, {count:number, path:string, ext:string, pad:number}>>}
 */
export async function loadManifest() {
  try {
    const res = await fetch('/sequences/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return { ...DEFAULTS };

    const raw = await res.json();
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };

    // Merge each known sequence over its default and sanitise fields.
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
      const d = DEFAULTS[key];
      const entry = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
      out[key] = {
        count: Number.isFinite(entry.count) && entry.count > 0 ? Math.floor(entry.count) : 0,
        path: typeof entry.path === 'string' && entry.path ? entry.path : d.path,
        ext: typeof entry.ext === 'string' && entry.ext ? entry.ext : d.ext,
        pad: Number.isFinite(entry.pad) && entry.pad > 0 ? Math.floor(entry.pad) : d.pad
      };
    }
    return out;
  } catch {
    // Network failure, JSON parse error, etc. — stay silent, use fallback.
    return { ...DEFAULTS };
  }
}
