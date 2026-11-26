import { useRef, useCallback, useMemo, useEffect } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './InteractiveText.css';

const COLOR_PALETTE = [
  'var(--color-cobalt)',
  'var(--color-soft-red)',
  'var(--color-pale-pink)',
  'var(--color-lavender)',
  'var(--color-yellow)',
  'var(--color-green)',
];

const INFLUENCE_RADIUS = 120;
const FADE_MIN = 700;
const FADE_MAX = 1100;

function pickColor(index, palette) {
  return palette[index % palette.length];
}

function randomFadeDuration() {
  return FADE_MIN + Math.random() * (FADE_MAX - FADE_MIN);
}

function measureVideoOverlap(letterRect, wrapRect, canvas) {
  if (
    letterRect.right < wrapRect.left ||
    letterRect.left > wrapRect.right ||
    letterRect.bottom < wrapRect.top ||
    letterRect.top > wrapRect.bottom
  ) {
    return 0;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return 0;

  let hits = 0;
  let samples = 0;
  const step = Math.max(3, Math.floor(Math.min(letterRect.width, letterRect.height) / 4));

  for (let py = letterRect.top + step / 2; py < letterRect.bottom; py += step) {
    for (let px = letterRect.left + step / 2; px < letterRect.right; px += step) {
      if (
        px < wrapRect.left ||
        px > wrapRect.right ||
        py < wrapRect.top ||
        py > wrapRect.bottom
      ) {
        continue;
      }

      samples += 1;
      const cx = Math.min(
        canvas.width - 1,
        Math.max(0, Math.floor(((px - wrapRect.left) / wrapRect.width) * canvas.width))
      );
      const cy = Math.min(
        canvas.height - 1,
        Math.max(0, Math.floor(((py - wrapRect.top) / wrapRect.height) * canvas.height))
      );

      const alpha = ctx.getImageData(cx, cy, 1, 1).data[3];
      if (alpha > 48) hits += 1;
    }
  }

  return samples > 0 ? hits / samples : 0;
}

export default function InteractiveText({
  lines,
  baseColor = '#ffffff',
  accentPalette = null,
  videoOverlapCanvasRef = null,
  videoOverlapWrapRef = null,
}) {
  const letterRefs = useRef([]);
  const fadeTimers = useRef({});
  const rafRef = useRef(null);
  const isHovering = useRef(false);
  const pointerRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const videoReactive = Boolean(videoOverlapCanvasRef && videoOverlapWrapRef);
  const palette = accentPalette?.length ? accentPalette : COLOR_PALETTE;

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

  const resetLetter = useCallback(
    (entry) => {
      if (!entry?.el) return;
      entry.el.style.color = baseColor;
      entry.el.style.opacity = '1';
    },
    [baseColor]
  );

  const scheduleFadeBack = useCallback(
    (index) => {
      const entry = letterRefs.current[index];
      if (!entry?.el || videoReactive) return;

      if (fadeTimers.current[index]) {
        clearTimeout(fadeTimers.current[index]);
      }

      fadeTimers.current[index] = setTimeout(() => {
        resetLetter(entry);
        delete fadeTimers.current[index];
      }, randomFadeDuration());
    },
    [resetLetter, videoReactive]
  );

  const applyColor = useCallback(
    (index, intensity, colorIndex) => {
      const entry = letterRefs.current[index];
      if (!entry?.el || intensity <= 0.12) return;

      entry.el.style.color = pickColor(colorIndex, palette);
      entry.el.style.opacity = String(0.6 + intensity * 0.4);
      scheduleFadeBack(index);
    },
    [scheduleFadeBack, palette]
  );

  const updateFromPointer = useCallback(
    (clientX, clientY) => {
      if (reducedMotion || videoReactive || clientX == null || clientY == null) return;

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
    [applyColor, reducedMotion, videoReactive]
  );

  useEffect(() => {
    if (!videoReactive || reducedMotion) return undefined;

    let frame = 0;

    const tick = () => {
      const canvas = videoOverlapCanvasRef.current;
      const wrap = videoOverlapWrapRef.current;

      const wrapRect = canvas?.width && wrap ? wrap.getBoundingClientRect() : null;
      const pointer = pointerRef.current;

      if (wrapRect || pointer) {
        letterRefs.current.forEach((entry) => {
          if (!entry?.el) return;
          const letterRect = entry.el.getBoundingClientRect();
          const overlap = wrapRect ? measureVideoOverlap(letterRect, wrapRect, canvas) : 0;
          const pointerIntensity = pointer
            ? 1 - Math.hypot(
                pointer.x - (letterRect.left + letterRect.width / 2),
                pointer.y - (letterRect.top + letterRect.height / 2)
              ) / INFLUENCE_RADIUS
            : 0;
          const intensity = Math.max(overlap, pointerIntensity);

          if (intensity > 0.12) {
            entry.el.style.color = pickColor(entry.colorIndex, palette);
            entry.el.style.opacity = String(0.7 + intensity * 0.3);
          } else {
            resetLetter(entry);
          }
        });
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [videoReactive, reducedMotion, videoOverlapCanvasRef, videoOverlapWrapRef, resetLetter, palette]);

  useEffect(() => {
    letterRefs.current.forEach((entry) => resetLetter(entry));
  }, [baseColor, resetLetter]);

  const handleMouseMove = useCallback(
    (e) => {
      if (reducedMotion) return;
      if (videoReactive) {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
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
    [reducedMotion, updateFromPointer, videoReactive]
  );

  const handleMouseLeave = useCallback(() => {
    pointerRef.current = null;
    isHovering.current = false;

    letterRefs.current.forEach((entry, index) => {
      if (!entry?.el) return;
      if (fadeTimers.current[index]) {
        clearTimeout(fadeTimers.current[index]);
        delete fadeTimers.current[index];
      }
      resetLetter(entry);
    });
  }, [resetLetter, videoReactive]);

  const handleTouch = useCallback(
    (e) => {
      if (reducedMotion || videoReactive) return;
      const touch = e.touches[0];
      if (!touch) return;
      updateFromPointer(touch.clientX, touch.clientY);
    },
    [reducedMotion, updateFromPointer, videoReactive]
  );

  let letterIndex = 0;

  return (
    <div
      className="interactive-text"
      onMouseEnter={handleMouseMove}
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
                  style={{ color: baseColor }}
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
