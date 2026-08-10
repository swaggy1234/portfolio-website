import { useState, useEffect } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './ScrollMonogram.css';

const CENTER = 48;
/**
 * Elegant botanical petal — soft teardrop with a slight lean,
 * so the bloom feels drawn by hand rather than geometric.
 */
const PETAL_OUTER =
  'M48 48 C36 40 31 24 40 10 C44 4 52 4 56 10 C65 24 60 40 48 48';
const PETAL_INNER =
  'M48 48 C40 41 37 26 44 14 C46 10 50 10 52 14 C59 26 56 41 48 48';

/**
 * Full-page bloom. Slightly staggered so petals open like a real flower.
 */
const PETALS = [
  { baseAngle: -8, closedScale: 0.52, openScale: 1, closedTwist: -10, openTwist: 4, start: 0.0, end: 0.97 },
  { baseAngle: 52, closedScale: 0.56, openScale: 1, closedTwist: -7, openTwist: 5, start: 0.05, end: 0.99 },
  { baseAngle: 112, closedScale: 0.5, openScale: 1, closedTwist: -12, openTwist: 3, start: 0.02, end: 0.98 },
  { baseAngle: 172, closedScale: 0.54, openScale: 1, closedTwist: -8, openTwist: 4.5, start: 0.07, end: 1.0 },
  { baseAngle: 232, closedScale: 0.51, openScale: 1, closedTwist: -11, openTwist: 3.5, start: 0.03, end: 0.99 },
  { baseAngle: 292, closedScale: 0.55, openScale: 1, closedTwist: -6, openTwist: 5, start: 0.06, end: 1.0 },
];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function petalProgress(scrollProgress, petal) {
  const span = Math.max(petal.end - petal.start, 0.001);
  return easeOutQuad(clamp01((scrollProgress - petal.start) / span));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function petalTransform(petal, scrollProgress) {
  const t = petalProgress(scrollProgress, petal);
  const scale = lerp(petal.closedScale, petal.openScale, t);
  const twist = lerp(petal.closedTwist, petal.openTwist, t);

  return [
    `rotate(${petal.baseAngle} ${CENTER} ${CENTER})`,
    `translate(${CENTER} ${CENTER})`,
    `rotate(${twist})`,
    `scale(${scale})`,
    `translate(${-CENTER} ${-CENTER})`,
  ].join(' ');
}

/**
 * SCROLL-BLOOM MONOGRAM
 * Soft editorial flower — opens slowly over the full page.
 * SA stays fixed in the center.
 */
export default function ScrollMonogram() {
  const reducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(reducedMotion ? 1 : 0);

  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (reducedMotion) return;
    setProgress(clamp01(value));
  });

  useEffect(() => {
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    setProgress(clamp01(scrollYProgress.get()));
  }, [reducedMotion, scrollYProgress]);

  const bloom = reducedMotion ? 1 : progress;
  const frameRotate = reducedMotion ? 18 : easeOutQuad(progress) * 18;
  const petalOpacity = 0.55 + easeOutQuad(bloom) * 0.35;

  return (
    <div className="scroll-monogram" aria-hidden="true">
      <div
        className="scroll-monogram__frame"
        style={{ transform: `rotate(${frameRotate}deg)` }}
      >
        <svg
          className="scroll-monogram__svg"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="petalFill" cx="50%" cy="55%" r="65%">
              <stop offset="0%" stopColor="var(--color-blush)" stopOpacity="0.95" />
              <stop offset="70%" stopColor="var(--color-rose)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--color-dusty-rose)" stopOpacity="0.35" />
            </radialGradient>
          </defs>

          {PETALS.map((petal) => (
            <g
              key={petal.baseAngle}
              className="scroll-monogram__petal-group"
              transform={petalTransform(petal, bloom)}
              opacity={petalOpacity}
            >
              <path className="scroll-monogram__petal" d={PETAL_OUTER} />
              <path className="scroll-monogram__petal-vein" d={PETAL_INNER} />
            </g>
          ))}

          <circle className="scroll-monogram__center-ring" cx={CENTER} cy={CENTER} r="13.5" />
          <circle className="scroll-monogram__center" cx={CENTER} cy={CENTER} r="11" />
        </svg>
      </div>

      <span className="scroll-monogram__text monogram monogram--dark">
        <span className="monogram__s">S</span>
        <span className="monogram__a">A</span>
      </span>
    </div>
  );
}
