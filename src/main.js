// ============================================================================
// main.js — app bootstrap
// ----------------------------------------------------------------------------
// Wires the whole experience: smooth scroll, grain, nav, the two sequence
// players (hero / builder), the preloader, and every section's scroll
// choreography. Each player ships with a procedural cinematic scene (globe /
// command-centre panels) that renders whenever its manifest count is 0 —
// real frames win automatically when count > 0. Page order: hero, about,
// work, finale.
// ============================================================================

import './styles/main.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initSmoothScroll } from './core/smooth-scroll.js';
import { loadManifest } from './core/manifest.js';
import { SequencePlayer } from './core/sequence-player.js';
import { createGlobeScene } from './core/scenes/globe-scene.js';
import { createPanelsScene } from './core/scenes/panels-scene.js';

import { initGrain } from './ui/grain.js';
import { initNav, showNav } from './ui/nav.js';

import { Preloader } from './sections/preloader.js';
import { initHero, playHeroIntro } from './sections/hero.js';
import { initAbout } from './sections/about.js';
import { initWork } from './sections/work.js';
import { initFinale } from './sections/finale.js';

gsap.registerPlugin(ScrollTrigger);

// DPR cap is tighter on small screens for performance.
const isSmall = window.matchMedia('(max-width: 820px)').matches;
const DPR_CAP = isSmall ? 1.5 : 2;

// Procedural scene factory per sequence name (used when manifest count is 0).
const SCENE_FACTORIES = {
  hero: createGlobeScene,
  builder: createPanelsScene
};

async function boot() {
  // 1. Ambient chrome
  initGrain();
  initSmoothScroll();

  const navEl = document.querySelector('.nav');
  initNav(navEl);

  // 2. Load the sequence manifest (never throws → fallback-safe).
  const manifest = await loadManifest();

  // 3. Build the two canvas players.
  const heroCanvas = document.getElementById('hero-canvas');
  const builderCanvas = document.getElementById('builder-canvas');

  const heroPlayer = makePlayer(heroCanvas, 'hero', manifest.hero);
  const builderPlayer = makePlayer(builderCanvas, 'builder', manifest.builder);

  // 4. Preloader tracks hero preload progress.
  const preloaderEl = document.querySelector('.preloader');
  const preloader = new Preloader(preloaderEl);

  // Kick off hero load first (its progress feeds the preloader), then the
  // secondary sequence in the background.
  const heroLoad = heroPlayer
    ? heroPlayer.load((p) => preloader.setProgress(p))
    : Promise.resolve();

  // Secondary player loads in the background; it doesn't gate the preloader.
  if (builderPlayer) builderPlayer.load();

  // 5. Wire section scroll choreography (before revealing so first paint is set).
  // Init order mirrors DOM order (hero, about, work, finale) so
  // ScrollTrigger registers each section's triggers top-to-bottom.
  initHero({ section: document.getElementById('hero'), player: heroPlayer });
  initAbout({ section: document.getElementById('about'), player: builderPlayer });
  initWork({
    cardsSection: document.getElementById('work')
  });
  initFinale(document.getElementById('finale'));

  // Recalculate all pinned triggers now that layout + fonts are settled.
  await documentFontsReady();
  ScrollTrigger.refresh();

  // 6. Finish preload → tear the ticket → reveal nav + hero.
  await heroLoad;
  await preloader.finish();
  showNav(navEl);
  playHeroIntro(document.getElementById('hero'));

  // A final refresh after the preloader is removed from the flow.
  ScrollTrigger.refresh();
}

function makePlayer(canvas, name, entry) {
  if (!canvas || !entry) return null;
  // Only build the procedural scene when it will actually run (count 0);
  // real frames always take precedence.
  const sceneFactory = SCENE_FACTORIES[name];
  const scene = entry.count === 0 && sceneFactory ? sceneFactory() : null;
  const player = new SequencePlayer(canvas, {
    name,
    count: entry.count,
    path: entry.path,
    ext: entry.ext,
    pad: entry.pad,
    dprCap: DPR_CAP,
    scene
  });
  // Paint an initial frame immediately (real nearest-loaded or procedural).
  player.render(0);
  return player;
}

function documentFontsReady() {
  if (document.fonts && document.fonts.ready) {
    return document.fonts.ready.catch(() => {});
  }
  return Promise.resolve();
}

// Guard the whole boot so nothing can leave the site stuck on the preloader.
boot().catch((err) => {
  // Last-resort: reveal the site even if something unexpected happened.
  // eslint-disable-next-line no-console
  console.warn('[boot] recovered from error:', err);
  const preloaderEl = document.querySelector('.preloader');
  if (preloaderEl) preloaderEl.style.display = 'none';
  const navEl = document.querySelector('.nav');
  if (navEl) navEl.style.opacity = '1';
  const hero = document.getElementById('hero');
  if (hero) {
    hero.querySelectorAll('.hero__letter').forEach((l) => {
      l.style.transform = 'none';
      l.style.opacity = '1';
    });
  }
});
