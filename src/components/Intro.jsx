import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import TigerOutline from './TigerOutline';
import './Intro.css';

/**
 * INTRO ANIMATION
 * Change duration via siteConfig.introDuration or --intro-duration in index.css
 */
export default function Intro({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const duration = reducedMotion ? 400 : siteConfig.introDuration;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, reducedMotion ? 200 : 600);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete, reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="intro__tigers" aria-hidden="true">
            <TigerOutline className="intro__tiger intro__tiger--left" strokeWidth={0.85} />
            <TigerOutline className="intro__tiger intro__tiger--right" flip="vertical" strokeWidth={0.85} />
          </div>

          <motion.div
            className="intro__monogram"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: reducedMotion ? 0.2 : 1.2,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <span className="monogram__s">S</span>
            <span className="monogram__a">A</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
