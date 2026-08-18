import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import { HERO_BACKGROUND } from '../data/layoutEdit';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './Intro.css';

const ease = [0.25, 0.1, 0.25, 1];

/**
 * INTRO — background pattern + monogram, then fade to hero.
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
          style={{ backgroundImage: `url(${HERO_BACKGROUND})` }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="intro__monogram monogram"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: reducedMotion ? 0.2 : 1.2,
              ease,
            }}
            aria-label={siteConfig.name}
          >
            <span className="monogram__s">S</span>
            <span className="monogram__a">A</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
