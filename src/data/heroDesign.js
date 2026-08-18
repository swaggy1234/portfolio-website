/**
 * HERO DESIGN SWITCHER
 *
 * Change one line to swap the hero look (background + stickers).
 * Text ("I'M A CREATIVE TECHNOLOGIST…"), SA logo, and menu stay the same.
 *
 *   'classic'       → saved blush design (safe backup)
 *   'experimental'  → your new vision (edit heroDesigns/experimental.js)
 */

import { classicHeroDesign } from './heroDesigns/classic';
import { experimentalHeroDesign } from './heroDesigns/experimental';

export const ACTIVE_HERO_DESIGN = 'experimental';

const DESIGNS = {
  classic: classicHeroDesign,
  experimental: experimentalHeroDesign,
};

export function getActiveHeroDesign() {
  return DESIGNS[ACTIVE_HERO_DESIGN] ?? classicHeroDesign;
}

export function listHeroDesigns() {
  return Object.values(DESIGNS);
}
