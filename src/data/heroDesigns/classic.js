/**
 * CLASSIC HERO — saved Aug 2026
 * Frozen snapshot of the blush background + tiger/flower stickers.
 * Do not edit — switch back via ACTIVE_HERO_DESIGN in heroDesign.js.
 *
 * Assets live in /public/images/saved/classic/ so new experiments
 * cannot overwrite this version.
 */

export const classicHeroDesign = {
  id: 'classic',
  label: 'Classic (blush + stickers)',

  background: '/images/saved/classic/hero-background.png',
  backgroundColor: 'var(--color-blush)',
  textTheme: 'light',
  layout: 'centered',
  heroVideo: null,

  stickerTemplates: {
    tiger: {
      src: '/images/saved/classic/Firefly.png',
      className: 'hero__sticker hero__sticker--tiger',
      aspectRatio: 736 / 1104,
      motionDepth: 1,
    },
    flower: {
      src: '/images/saved/classic/flower.png',
      className: 'hero__sticker hero__sticker--flower',
      aspectRatio: 426 / 589,
      motionDepth: 0.55,
    },
    flower2: {
      src: '/images/saved/classic/flower-2.png',
      className: 'hero__sticker hero__sticker--flower',
      aspectRatio: 360 / 393,
      motionDepth: 0.5,
    },
  },

  stickers: [
    { id: 'tiger', type: 'tiger' },
    { id: 'tiger2', type: 'tiger' },
    { id: 'flower-1', type: 'flower' },
    { id: 'flower-2', type: 'flower2' },
    { id: 'flower-3', type: 'flower' },
    { id: 'flower2-1786547579289', type: 'flower2' },
  ],

  stickerLayouts: {
    tiger: {
      xPercent: 0.0,
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
      widthPercent: 14.0,
      rotation: -12,
      flipX: false,
      aspectRatio: 0.72326,
    },
    'flower-2': {
      xPercent: 0.0,
      yPercent: 21.33,
      widthPercent: 12.0,
      rotation: 18,
      flipX: false,
      aspectRatio: 0.916031,
    },
    'flower-3': {
      xPercent: 61.07,
      yPercent: -3.26,
      widthPercent: 16.0,
      rotation: 6,
      flipX: true,
      aspectRatio: 0.72326,
    },
    'flower2-1786547579289': {
      xPercent: 16.99,
      yPercent: 77.9,
      widthPercent: 12.0,
      rotation: -20,
      flipX: false,
      aspectRatio: 0.916031,
    },
  },
};
