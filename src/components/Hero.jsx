import { useCallback, useRef, useState } from 'react';
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useScroll,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import {
  HERO_BACKGROUND,
  HERO_BACKGROUND_COLOR,
  HERO_LAYOUT,
  HERO_TEXT_THEME,
  HERO_TEXT_ACCENT_PALETTE,
  HERO_VIDEO,
  LAYOUT_EDIT_MODE,
  LAYOUT_EDIT_STICKERS,
  LAYOUT_EDIT_VIDEO,
  STICKERS,
  STICKER_LAYOUTS,
  STICKER_TEMPLATES,
  STICKER_VIEWPORT_LOCK,
  resolveSticker,
} from '../data/layoutEdit';
import InteractiveText from './InteractiveText';
import EditableSticker from './EditableSticker';
import HeroVideo from './HeroVideo';
import LayoutEditPanel from './LayoutEditPanel';
import './Hero.css';

function mergeLayout(stickerId, stickerType, liveLayouts) {
  const template = STICKER_TEMPLATES[stickerType];
  const base = STICKER_LAYOUTS[stickerId] || {
    xPercent: 40,
    yPercent: 40,
    widthPercent: 12,
    rotation: 0,
    flipX: false,
    aspectRatio: template?.aspectRatio ?? 1,
  };
  const live = liveLayouts[stickerId];
  return live ? { ...base, ...live } : base;
}

export default function Hero({ stageRef }) {
  const heroElRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const videoWrapRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(true);
  const [liveLayouts, setLiveLayouts] = useState({});
  const [liveVideoLayout, setLiveVideoLayout] = useState(null);
  const [editStickers, setEditStickers] = useState(() => [...STICKERS]);

  const rawPointerX = useMotionValue(0);
  const rawPointerY = useMotionValue(0);
  const pointerX = useSpring(rawPointerX, { stiffness: 55, damping: 22, mass: 0.4 });
  const pointerY = useSpring(rawPointerY, { stiffness: 55, damping: 22, mass: 0.4 });

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end start'],
  });

  const contentY = useTransform(scrollYProgress, [0, 0.5, 1], ['0%', '-12%', '-22%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.4, 0.85], [1, 0.75, 0]);
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  const arrowOpacity = useTransform(scrollYProgress, [0, 0.08, 0.2], [1, 1, 0]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    setArrowVisible(value < 0.25);
  });

  const handlePointerMove = useCallback(
    (event) => {
      const el = heroElRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      rawPointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
      rawPointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
    },
    [rawPointerX, rawPointerY]
  );

  const handlePointerLeave = useCallback(() => {
    rawPointerX.set(0);
    rawPointerY.set(0);
  }, [rawPointerX, rawPointerY]);

  const scrollTo = (id) => {
    setMenuOpen(false);
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLayoutChange = (id, box) => {
    setLiveLayouts((prev) => ({ ...prev, [id]: box }));
  };

  const handleAddFlower = (type) => {
    const template = STICKER_TEMPLATES[type];
    if (!template) return;

    const id = `${type}-${Date.now()}`;
    setEditStickers((prev) => [...prev, { id, type }]);
    setLiveLayouts((prev) => ({
      ...prev,
      [id]: {
        xPercent: +(30 + Math.random() * 35).toFixed(2),
        yPercent: +(20 + Math.random() * 45).toFixed(2),
        widthPercent: type === 'flower2' ? 12 : 14,
        rotation: Math.round(Math.random() * 40 - 20),
        flipX: false,
        aspectRatio: template.aspectRatio,
      },
    }));
  };

  const contentMotionStyle = HERO_VIDEO
    ? undefined
    : {
        y: contentY,
        opacity: contentOpacity,
        scale: contentScale,
      };

  const stickerEditMode = LAYOUT_EDIT_MODE && LAYOUT_EDIT_STICKERS;
  const videoEditMode = LAYOUT_EDIT_MODE && LAYOUT_EDIT_VIDEO;
  const stickerList = stickerEditMode ? editStickers : STICKERS;
  const layoutEditActive = videoEditMode || stickerEditMode;

  /** Saved layout from file — don't feed live drag values back in or the video jitters */
  const heroVideoLayout = HERO_VIDEO?.layout;

  const heroClassName = [
    'hero',
    HERO_TEXT_THEME === 'dark' ? 'hero--text-dark' : '',
    HERO_LAYOUT === 'split' ? 'hero--split' : '',
    HERO_LAYOUT === 'centered' ? 'hero--centered' : '',
    HERO_VIDEO ? 'hero--allow-overflow hero--video-hero' : '',
    LAYOUT_EDIT_MODE && layoutEditActive ? 'hero--layout-edit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderSticker = (sticker, editing) => {
    const resolved = resolveSticker(sticker);
    if (!resolved) return null;

    /* During edit, use saved layout only — liveLayouts is for the copy panel */
    const layout = editing
      ? STICKER_LAYOUTS[sticker.id] || resolved.layout
      : mergeLayout(sticker.id, sticker.type, liveLayouts);

    return (
      <EditableSticker
        key={sticker.id}
        id={sticker.id}
        className={resolved.className}
        src={resolved.src}
        layout={layout}
        editMode={editing}
        viewportLock={STICKER_VIEWPORT_LOCK}
        onLayoutChange={handleLayoutChange}
        motionDepth={resolved.motionDepth ?? 1}
        pointerX={editing ? undefined : pointerX}
        pointerY={editing ? undefined : pointerY}
        scrollProgress={editing ? undefined : scrollYProgress}
      />
    );
  };

  return (
    <section
      ref={heroElRef}
      className={heroClassName}
      id="hero"
      style={{
        ...(HERO_BACKGROUND ? { backgroundImage: `url(${HERO_BACKGROUND})` } : {}),
        backgroundColor: HERO_BACKGROUND_COLOR,
      }}
      onPointerMove={LAYOUT_EDIT_MODE ? undefined : handlePointerMove}
      onPointerLeave={LAYOUT_EDIT_MODE ? undefined : handlePointerLeave}
    >
      <header className="hero__header">
        <a href="#hero" className="hero__logo" aria-label={siteConfig.name}>
          <span className="monogram">
            <span className="monogram__s">S</span>
            <span className="monogram__a">A</span>
          </span>
        </a>

        <button
          className={`hero__menu${menuOpen ? ' hero__menu--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <nav className={`hero__nav${menuOpen ? ' hero__nav--open' : ''}`}>
          <button onClick={() => scrollTo('work')}>Work</button>
          <button onClick={() => scrollTo('studio')}>Studio</button>
          <button onClick={() => scrollTo('about')}>About</button>
          <button onClick={() => scrollTo('experience')}>Experience</button>
          <button onClick={() => scrollTo('contact')}>Contact</button>
          <a
            href={siteConfig.social.resume}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            Resume
          </a>
        </nav>
      </header>

      {!videoEditMode && HERO_VIDEO && heroVideoLayout ? (
        <HeroVideo
          src={HERO_VIDEO.src}
          layout={heroVideoLayout}
          className={HERO_VIDEO.className}
          keyWhite={HERO_VIDEO.keyWhite ?? true}
          blendMode={HERO_VIDEO.blendMode}
          editMode={false}
          containerRef={heroElRef}
          playbackRate={HERO_VIDEO.playbackRate ?? 1}
          loop={HERO_VIDEO.loop ?? true}
          overlayCanvasRef={videoCanvasRef}
          overlayWrapRef={videoWrapRef}
          onLayoutChange={setLiveVideoLayout}
        />
      ) : null}

      <div className="hero__content">
        {HERO_VIDEO ? (
          <div className="hero__content-motion">
            <InteractiveText
              lines={siteConfig.heroStatement}
              baseColor="var(--color-wine)"
              accentPalette={HERO_TEXT_ACCENT_PALETTE}
              videoOverlapCanvasRef={videoCanvasRef}
              videoOverlapWrapRef={videoWrapRef}
            />
          </div>
        ) : (
          <motion.div className="hero__content-motion" style={contentMotionStyle}>
            <InteractiveText lines={siteConfig.heroStatement} />
          </motion.div>
        )}
      </div>

      {videoEditMode && HERO_VIDEO && heroVideoLayout ? (
        <HeroVideo
          src={HERO_VIDEO.src}
          layout={heroVideoLayout}
          className={HERO_VIDEO.className}
          keyWhite={HERO_VIDEO.keyWhite ?? true}
          blendMode={HERO_VIDEO.blendMode}
          editMode
          containerRef={heroElRef}
          playbackRate={HERO_VIDEO.playbackRate ?? 1}
          loop={HERO_VIDEO.loop ?? true}
          overlayCanvasRef={videoCanvasRef}
          overlayWrapRef={videoWrapRef}
          onLayoutChange={setLiveVideoLayout}
        />
      ) : null}

      {stickerEditMode ? (
        <div className="hero__stickers hero__stickers--edit">
          {stickerList.map((sticker) => renderSticker(sticker, true))}
        </div>
      ) : STICKERS.length > 0 ? (
        <div className="hero__stickers">
          {stickerList.map((sticker) => renderSticker(sticker, false))}
        </div>
      ) : null}

      <motion.a
        href="#work"
        className="hero__arrow"
        aria-label="Scroll to work"
        style={{ opacity: arrowOpacity }}
        animate={arrowVisible ? { y: [0, 8, 0] } : { y: 0 }}
        transition={
          arrowVisible
            ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
      >
        <svg
          className="hero__arrow-icon"
          width="20"
          height="28"
          viewBox="0 0 20 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 2v20M10 22l-6-6M10 22l6-6"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.a>

      <LayoutEditPanel
        stickers={editStickers}
        layouts={liveLayouts}
        videoLayout={liveVideoLayout ?? HERO_VIDEO?.layout}
        editMode={layoutEditActive}
        editVideo={videoEditMode}
        onAddFlower={handleAddFlower}
      />
    </section>
  );
}
