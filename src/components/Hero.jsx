import { useState } from 'react';
import { motion, useTransform, useMotionValueEvent, useScroll } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import InteractiveText from './InteractiveText';
import './Hero.css';

export default function Hero({ stageRef }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(true);

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

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero" id="hero">
      <header className="hero__header">
        <a href="#hero" className="hero__logo" aria-label={siteConfig.name}>
          <span className="monogram monogram--dark">
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
          <span />
          <span />
        </button>

        <nav className={`hero__nav${menuOpen ? ' hero__nav--open' : ''}`}>
          <button onClick={() => scrollTo('work')}>Work</button>
          <button onClick={() => scrollTo('about')}>About</button>
          <button onClick={() => scrollTo('experience')}>Experience</button>
          <button onClick={() => scrollTo('contact')}>Contact</button>
        </nav>
      </header>

      <div className="hero__content">
        <motion.div
          className="hero__content-motion"
          style={{
            y: contentY,
            opacity: contentOpacity,
            scale: contentScale,
          }}
        >
          <InteractiveText lines={siteConfig.heroStatement} />
        </motion.div>
      </div>

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
    </section>
  );
}
