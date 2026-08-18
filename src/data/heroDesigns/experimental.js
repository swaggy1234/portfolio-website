/**
 * EXPERIMENTAL HERO — pour video + statement text.
 *
 * Position the video: set LAYOUT_EDIT_MODE = true in layoutEdit.js,
 * drag/resize the video, then copy values from the panel into heroVideo.layout below.
 *
 * Hate it? Set ACTIVE_HERO_DESIGN = 'classic' in heroDesign.js.
 */

export const experimentalHeroDesign = {
  id: 'experimental',
  label: 'Pour video hero',

  background: null,
  backgroundColor: '#ffffff',
  textTheme: 'dark',
  layout: 'centered',

  /** Blues when the pour overlaps the statement text */
  textAccentPalette: [
    '#0f2847',
    '#1e4a7a',
    '#2563eb',
    '#3b82f6',
    '#60a5fa',
    '#0ea5e9',
  ],

  heroVideo: {
    src: '/videos/hero-koi.mp4',
    playbackRate: 1,
    loop: true,
    /** Removes white background frame-by-frame — true sticker transparency */
    keyWhite: true,
    className: 'hero__sticker hero__sticker--pour',
    layout: {
      unit: 'viewport',
      xPercent: 21.05,
      yPercent: -49.86,
      widthPercent: 59.02,
      aspectRatio: 0.5625,
      rotation: 90,
      referenceViewport: { width: 1512, height: 865 },
    },
  },

  stickerTemplates: {
    tiger: {
      src: '/images/experimental/Firefly.png',
      className: 'hero__sticker hero__sticker--tiger',
      aspectRatio: 736 / 1104,
      motionDepth: 1,
    },
    flower: {
      src: '/images/experimental/flower.png',
      className: 'hero__sticker hero__sticker--flower',
      aspectRatio: 426 / 589,
      motionDepth: 0.55,
    },
    flower2: {
      src: '/images/experimental/flower-2.png',
      className: 'hero__sticker hero__sticker--flower',
      aspectRatio: 360 / 393,
      motionDepth: 0.5,
    },
  },

  stickers: [],

  stickerLayouts: {},
};
