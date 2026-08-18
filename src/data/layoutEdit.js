/**
 * LAYOUT EDIT MODE
 * Set LAYOUT_EDIT_MODE to true to drag/resize/rotate stickers in the browser.
 * Set to false to lock final positions (no handles, no panel).
 *
 * Values are PERCENTAGES of the hero size so the layout keeps the same
 * ratio on every screen.
 */

export const LAYOUT_EDIT_MODE = false;

export const HERO_BACKGROUND = '/images/hero-background.png';

/** Sticker type templates — used when adding new flowers in edit mode */
export const STICKER_TEMPLATES = {
  tiger: {
    src: '/images/Firefly.png',
    className: 'hero__sticker hero__sticker--tiger',
    aspectRatio: 736 / 1104,
    motionDepth: 1,
  },
  flower: {
    src: '/images/flower.png',
    className: 'hero__sticker hero__sticker--flower',
    aspectRatio: 426 / 589,
    motionDepth: 0.55,
  },
  flower2: {
    src: '/images/flower-2.png',
    className: 'hero__sticker hero__sticker--flower',
    aspectRatio: 360 / 393,
    motionDepth: 0.5,
  },
};

/**
 * All stickers on the hero (tigers + flowers).
 * type → key in STICKER_TEMPLATES
 */
export const STICKERS = [
  { id: 'tiger', type: 'tiger' },
  { id: 'tiger2', type: 'tiger' },
  { id: 'flower-1', type: 'flower' },
  { id: 'flower-2', type: 'flower2' },
  { id: 'flower-3', type: 'flower' },
  { id: 'flower2-1786547579289', type: 'flower2' },
];

export const STICKER_LAYOUTS = {
  tiger: {
    xPercent: 0.00,
    yPercent: 34.74,
    widthPercent: 25.79,
    rotation: 25,
    flipX: false,
    aspectRatio: 0.666667,
  },
  tiger2: {
    xPercent: 71.43,
    yPercent: -9.41,
    widthPercent: 25.22,
    rotation: 115,
    flipX: true,
    aspectRatio: 0.666667,
  },
  'flower-1': {
    xPercent: 83.98,
    yPercent: 39.32,
    widthPercent: 14.00,
    rotation: -12,
    flipX: false,
    aspectRatio: 0.72326,
  },
  'flower-2': {
    xPercent: 0.00,
    yPercent: 21.33,
    widthPercent: 12.00,
    rotation: 18,
    flipX: false,
    aspectRatio: 0.916031,
  },
  'flower-3': {
    xPercent: 61.07,
    yPercent: -3.26,
    widthPercent: 16.00,
    rotation: 6,
    flipX: true,
    aspectRatio: 0.72326,
  },
  'flower2-1786547579289': {
    xPercent: 16.99,
    yPercent: 77.90,
    widthPercent: 12.00,
    rotation: -20,
    flipX: false,
    aspectRatio: 0.916031,
  },
};

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
