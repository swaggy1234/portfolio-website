import { useRef, useCallback, useMemo } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './InteractiveText.css';

/**
 * INTERACTIVE LETTER EFFECT
 * Colors change ONLY when the cursor hovers over letters,
 * then fade back to the default text color after ~1 second.
 * Edit palette in index.css; adjust radius/timing below.
 */

const COLOR_PALETTE = [
  'var(--color-cobalt)',
  'var(--color-soft-red)',
  'var(--color-pale-pink)',
  'var(--color-lavender)',
  'var(--color-yellow)',
  'var(--color-green)',
];

const DEFAULT_COLOR = 'var(--color-wine)';
const INFLUENCE_RADIUS = 120;
const FADE_MIN = 700;
const FADE_MAX = 1100;

function pickColor(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function randomFadeDuration() {
  return FADE_MIN + Math.random() * (FADE_MAX - FADE_MIN);
}

export default function InteractiveText({ lines }) {
  const letterRefs = useRef([]);
  const fadeTimers = useRef({});
  const rafRef = useRef(null);
  const isHovering = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  const letterLines = useMemo(() => {
    let colorIndex = 0;
    return lines.map((line, lineIndex) => {
      const chars = [];
      const words = line.split(' ');
      words.forEach((word, wordIndex) => {
        [...word].forEach((char, charIndex) => {
          chars.push({
            char,
            key: `${lineIndex}-${wordIndex}-${charIndex}`,
            colorIndex: colorIndex++,
          });
        });
        if (wordIndex < words.length - 1) {
          chars.push({
            char: '\u00A0',
            key: `${lineIndex}-${wordIndex}-space`,
            isSpace: true,
          });
        }
      });
      return { key: `line-${lineIndex}`, chars };
    });
  }, [lines]);

  const scheduleFadeBack = useCallback((index) => {
    const entry = letterRefs.current[index];
    if (!entry?.el) return;

    if (fadeTimers.current[index]) {
      clearTimeout(fadeTimers.current[index]);
    }

    fadeTimers.current[index] = setTimeout(() => {
      entry.el.style.color = DEFAULT_COLOR;
      entry.el.style.opacity = '1';
      delete fadeTimers.current[index];
    }, randomFadeDuration());
  }, []);

  const applyColor = useCallback(
    (index, intensity, colorIndex) => {
      const entry = letterRefs.current[index];
      if (!entry?.el || intensity <= 0.12) return;

      entry.el.style.color = pickColor(colorIndex);
      entry.el.style.opacity = String(0.6 + intensity * 0.4);
      scheduleFadeBack(index);
    },
    [scheduleFadeBack]
  );

  const updateFromPointer = useCallback(
    (clientX, clientY) => {
      if (reducedMotion || clientX == null || clientY == null) return;

      letterRefs.current.forEach((entry, index) => {
        if (!entry?.el) return;

        const rect = entry.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const distance = Math.hypot(clientX - cx, clientY - cy);

        if (distance < INFLUENCE_RADIUS) {
          const intensity = 1 - distance / INFLUENCE_RADIUS;
          applyColor(index, intensity, entry.colorIndex);
        }
      });
    },
    [applyColor, reducedMotion]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion) return;
      isHovering.current = true;

      const x = e.clientX;
      const y = e.clientY;

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (isHovering.current) {
          updateFromPointer(x, y);
        }
      });
    },
    [reducedMotion, updateFromPointer]
  );

  const handleMouseLeave = useCallback(() => {
    isHovering.current = false;

    letterRefs.current.forEach((entry, index) => {
      if (!entry?.el) return;
      if (fadeTimers.current[index]) {
        clearTimeout(fadeTimers.current[index]);
        delete fadeTimers.current[index];
      }
      entry.el.style.color = DEFAULT_COLOR;
      entry.el.style.opacity = '1';
    });
  }, []);

  const handleTouch = useCallback(
    (e) => {
      if (reducedMotion) return;
      const touch = e.touches[0];
      if (!touch) return;
      updateFromPointer(touch.clientX, touch.clientY);
    },
    [reducedMotion, updateFromPointer]
  );

  let letterIndex = 0;

  return (
    <div
      className="interactive-text"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouch}
    >
      <div className="interactive-text__inner">
        {letterLines.map((line) => (
          <p key={line.key} className="interactive-text__line">
            {line.chars.map((item) => {
              if (item.isSpace) {
                return (
                  <span
                    key={item.key}
                    className="interactive-text__letter interactive-text__letter--space"
                    aria-hidden="true"
                  >
                    {item.char}
                  </span>
                );
              }

              const idx = letterIndex;
              letterIndex += 1;

              return (
                <span
                  key={item.key}
                  ref={(el) => {
                    letterRefs.current[idx] = el
                      ? { el, colorIndex: item.colorIndex }
                      : null;
                  }}
                  className="interactive-text__letter"
                >
                  {item.char}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
