import { motion } from 'framer-motion';
import TigerOutline from './TigerOutline';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './TigerDecor.css';

/**
 * HERO TIGER DECORATIONS
 * Large outline tigers flanking the hero — edit size/opacity in TigerDecor.css
 */
export default function TigerDecor() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      className="tiger-decor"
      aria-hidden="true"
      initial={reducedMotion ? {} : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4, delay: 0.4 }}
    >
      <TigerOutline className="tiger-decor__cat tiger-decor__cat--left" flip="none" strokeWidth={0.9} />
      <TigerOutline className="tiger-decor__cat tiger-decor__cat--right" flip="vertical" strokeWidth={0.9} />
    </motion.div>
  );
}
