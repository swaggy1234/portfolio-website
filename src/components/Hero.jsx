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
  LAYOUT_EDIT_MODE,
  STICKERS,
  STICKER_LAYOUTS,
  STICKER_TEMPLATES,
  resolveSticker,
} from '../data/layoutEdit';
import InteractiveText from './InteractiveText';
import EditableSticker from './EditableSticker';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(true);
  const [liveLayouts, setLiveLayouts] = useState({});
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

  const contentMotionStyle = {
    y: contentY,
    opacity: contentOpacity,
    scale: contentScale,
  };

  const stickerList = LAYOUT_EDIT_MODE ? editStickers : STICKERS;

  const renderSticker = (sticker, editMode) => {
    const resolved = resolveSticker(sticker);
    if (!resolved) return null;

    const layout = mergeLayout(sticker.id, sticker.type, liveLayouts);

    return (
      <EditableSticker
        key={sticker.id}
        id={sticker.id}
        className={resolved.className}
        src={resolved.src}
        layout={layout}
        editMode={editMode}
        containerRef={heroElRef}
        onLayoutChange={handleLayoutChange}
        motionDepth={resolved.motionDepth ?? 1}
        pointerX={editMode ? undefined : pointerX}
        pointerY={editMode ? undefined : pointerY}
        scrollProgress={editMode ? undefined : scrollYProgress}
      />
    );
  };

  return (
    <section
      ref={heroElRef}
      className={`hero${LAYOUT_EDIT_MODE ? ' hero--layout-edit' : ''}`}
      id="hero"
      style={{ backgroundImage: `url(${HERO_BACKGROUND})` }}
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

      <div className="hero__content">
        <motion.div className="hero__content-motion" style={contentMotionStyle}>
          <InteractiveText lines={siteConfig.heroStatement} />
        </motion.div>
      </div>

      {LAYOUT_EDIT_MODE ? (
        <div className="hero__stickers hero__stickers--edit">
          {stickerList.map((sticker) => renderSticker(sticker, true))}
        </div>
      ) : (
        <div className="hero__stickers">
          {stickerList.map((sticker) => renderSticker(sticker, false))}
        </div>
      )}

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
        editMode={LAYOUT_EDIT_MODE}
        onAddFlower={handleAddFlower}
      />
    </section>
  );
}
