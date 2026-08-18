/**
 * LAYOUT EDIT MODE
 * Set to true to drag/resize the hero video (or stickers) in the browser.
 * Set to false when you're happy with placement.
 *
 * Hero look comes from heroDesign.js + heroDesigns/*.js
 */

import { getActiveHeroDesign } from './heroDesign';

/** Drag the hero video in the browser, then paste layout from the panel */
export const LAYOUT_EDIT_MODE = false;
export const LAYOUT_EDIT_VIDEO = false;
export const LAYOUT_EDIT_STICKERS = false;

const active = getActiveHeroDesign();

export const HERO_BACKGROUND = active.background;
export const HERO_BACKGROUND_COLOR = active.backgroundColor;
export const HERO_TEXT_THEME = active.textTheme ?? 'light';
export const HERO_LAYOUT = active.layout ?? 'centered';
export const HERO_VIDEO = active.heroVideo ?? null;
export const HERO_TEXT_ACCENT_PALETTE = active.textAccentPalette ?? null;
export const STICKER_TEMPLATES = active.stickerTemplates;
export const STICKERS = active.stickers;
export const STICKER_LAYOUTS = active.stickerLayouts;
export const STICKER_VIEWPORT_LOCK = active.stickerViewportLock ?? false;

/** Resolve a sticker entry into render props */
export function resolveSticker(sticker) {
  const template = STICKER_TEMPLATES[sticker.type];
  if (!template) return null;
  return {
    id: sticker.id,
    type: sticker.type,
    src: template.src,
    className: template.className,
    motionDepth: template.motionDepth,
    layout: STICKER_LAYOUTS[sticker.id] || {
      xPercent: 40,
      yPercent: 40,
      widthPercent: 12,
      rotation: 0,
      flipX: false,
      aspectRatio: template.aspectRatio,
    },
  };
}
