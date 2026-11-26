import { useEffect, useId, useRef } from 'react';
import { measureVideoOverlap } from './InteractiveText';
import { sampleWater } from './HeroWater';
import './KineticText.css';

const gradients = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
];

function gradientAt(x, y, dx, dy) {
  let hash = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  const [gx, gy] = gradients[(hash ^ (hash >>> 13)) & 7];
  return gx * dx + gy * dy;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function perlin(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const dx = x - ix;
  const dy = y - iy;
  const top = mix(gradientAt(ix, iy, dx, dy), gradientAt(ix + 1, iy, dx - 1, dy), fade(dx));
  const bottom = mix(gradientAt(ix, iy + 1, dx, dy - 1), gradientAt(ix + 1, iy + 1, dx - 1, dy - 1), fade(dx));
  return mix(top, bottom, fade(dy));
}

function spring(axis, target, dt) {
  axis.velocity += ((target - axis.position) * 19 - axis.velocity * 7.5) * dt;
  axis.position += axis.velocity * dt;
}

export default function KineticText({
  lines, settings, accentPalette, videoCanvasRef, videoWrapRef, waterRef, waterDistortion = 0,
}) {
  const rootRef = useRef(null);
  const offsetRef = useRef(null);
  const filterId = `letter-current-${useId().replace(/[^\w-]/g, '')}`;
  const { currentStrength, distortion, speed, rotation, mouseStrength, mouseRadius } = settings;

  useEffect(() => {
    const root = rootRef.current;
    const offset = offsetRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const glyphs = Array.from(root.querySelectorAll('.kinetic-text__glyph'), (node, index) => ({
      node,
      index,
      x: { position: 0, velocity: 0 },
      y: { position: 0, velocity: 0 },
      angle: { position: 0, velocity: 0 },
    }));
    let bounds;
    let pointer;
    let wake;
    let visible = false;
    let frame = 0;
    let lastTime = 0;
    let time = 0;
    let lastFilterUpdate = 0;
    let lastColorUpdate = 0;

    function measure() {
      bounds = root.getBoundingClientRect();
      for (const glyph of glyphs) {
        const anchor = glyph.node.parentElement.getBoundingClientRect();
        glyph.anchorX = anchor.left + anchor.width / 2 - bounds.left;
        glyph.anchorY = anchor.top + anchor.height / 2 - bounds.top;
      }
    }

    function animate(now) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.033) : 1 / 60;
      lastTime = now;
      time += dt;
      const flow = time * speed;
      if (wake && time - wake.start > 1.15) wake = undefined;
      const water = waterRef?.current;
      const activeWater = waterDistortion && water?.pointerRipples.length ? water : null;
      const viewport = pointer || wake || activeWater ? root.getBoundingClientRect() : bounds;
      const scale = Math.min(1, bounds.width / 720);

      if (now - lastColorUpdate >= 50) {
        const canvas = videoCanvasRef.current;
        const wrap = videoWrapRef.current;
        const wrapRect = canvas?.width && wrap ? wrap.getBoundingClientRect() : null;
        for (const glyph of glyphs) {
          glyph.overKoi = wrapRect && measureVideoOverlap(glyph.node.getBoundingClientRect(), wrapRect, canvas) > 0.12;
        }
        lastColorUpdate = now;
      }

      for (const glyph of glyphs) {
        const u = glyph.anchorX / 175;
        const v = glyph.anchorY / 130;
        const detail = glyph.index * 0.41;
        const x = perlin(u - flow, v + 0.7);
        const y = perlin(u - flow * 0.81, v + 12);
        const eddy = perlin(detail, flow * 1.3 + 7);
        const spread = Math.max(0, perlin(flow * 0.65, v + 19) - 0.08);
        let pushX = 0;
        let pushY = 0;

        if (pointer) {
          const dx = glyph.anchorX + viewport.left - pointer.x;
          const dy = glyph.anchorY + viewport.top - pointer.y;
          const distance = Math.hypot(dx, dy);
          const influence = Math.max(0, 1 - distance / mouseRadius);
          const force = (mouseStrength * influence * influence) / Math.max(16, distance);
          pushX = dx * force;
          pushY = dy * force;
        }

        if (wake) {
          const dx = glyph.anchorX + viewport.left - wake.x;
          const dy = glyph.anchorY + viewport.top - wake.y;
          const distance = Math.hypot(dx, dy);
          const age = time - wake.start;
          const front = ((distance / mouseRadius) - age * 1.45) / 0.23;
          const force = mouseStrength * 0.24 * Math.exp(-front * front - age * 2.8) / Math.max(16, distance);
          pushX += dx * force;
          pushY += dy * force;
        }

        spring(glyph.x, scale * currentStrength * (x + eddy * 0.55 + spread * (u - 2.4) * 0.65) + pushX, dt);
        spring(glyph.y, scale * currentStrength * (y * 0.7 + eddy * 0.38) + pushY, dt);
        spring(glyph.angle, rotation * (y + eddy * 0.65) + pushX * 0.15, dt);
        const { shiftX, shiftY, bend } = sampleWater(
          activeWater,
          glyph.anchorX + glyph.x.position + viewport.left - (activeWater?.bounds.left ?? 0),
          glyph.anchorY + glyph.y.position + viewport.top - (activeWater?.bounds.top ?? 0),
          now,
          waterDistortion
        );
        const stretch = 1 + eddy * distortion * 0.007 + bend;
        glyph.node.style.transform = `translate(${(glyph.x.position + shiftX).toFixed(2)}px, ${(glyph.y.position + shiftY).toFixed(2)}px) rotate(${glyph.angle.position.toFixed(2)}deg) scale(${stretch.toFixed(4)}, ${(2 - stretch).toFixed(4)}) skewX(${(bend * 50).toFixed(2)}deg)`;
        glyph.node.style.color = glyph.overKoi ? accentPalette?.[glyph.index % accentPalette.length] || '#2563eb' : '';
      }

      if (now - lastFilterUpdate >= 45) {
        offset.setAttribute('dx', (perlin(flow * 0.9, 18.4) * 54).toFixed(2));
        offset.setAttribute('dy', (perlin(flow * 0.65, 32.7) * 32).toFixed(2));
        lastFilterUpdate = now;
      }
      frame = requestAnimationFrame(animate);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (visible && !reducedMotion.matches && !document.hidden) {
        measure();
        frame = requestAnimationFrame(animate);
      } else if (reducedMotion.matches) {
        pointer = undefined;
        wake = undefined;
        for (const glyph of glyphs) {
          glyph.node.style.removeProperty('transform');
          glyph.node.style.removeProperty('color');
        }
      }
    }

    function point(event) {
      if (event.pointerType === 'mouse' && !reducedMotion.matches) {
        pointer = { x: event.clientX, y: event.clientY };
        if (!wake || (time - wake.start > 0.24 && Math.hypot(pointer.x - wake.x, pointer.y - wake.y) > 24)) {
          wake = { ...pointer, start: time };
        }
      }
    }

    function clearPointer() {
      pointer = undefined;
    }

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) clearPointer();
      syncAnimation();
    });
    const resize = new ResizeObserver(measure);
    visibility.observe(root);
    resize.observe(root);
    root.addEventListener('pointermove', point);
    root.addEventListener('pointerleave', clearPointer);
    reducedMotion.addEventListener('change', syncAnimation);
    document.addEventListener('visibilitychange', syncAnimation);

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      resize.disconnect();
      root.removeEventListener('pointermove', point);
      root.removeEventListener('pointerleave', clearPointer);
      reducedMotion.removeEventListener('change', syncAnimation);
      document.removeEventListener('visibilitychange', syncAnimation);
    };
  }, [lines, currentStrength, distortion, speed, rotation, mouseStrength, mouseRadius,
    accentPalette, videoCanvasRef, videoWrapRef, waterRef, waterDistortion]);

  return (
    <div ref={rootRef} className="interactive-text kinetic-text" style={{ '--current-filter': `url("#${filterId}")` }}>
      <svg className="kinetic-text__filter" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-15%" y="-75%" width="130%" height="250%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.034 0.052" numOctaves="2" seed="24" />
            <feOffset ref={offsetRef} dx="0" dy="0" result="current" />
            <feDisplacementMap in="SourceGraphic" in2="current" scale={distortion} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {lines.map((line) => (
        <p key={line} className="interactive-text__line kinetic-text__line">
          <span className="kinetic-text__sr">{line}</span>
          <span aria-hidden="true">
            {line.split(' ').map((word, wordIndex) => (
              <span key={wordIndex}>
                {wordIndex > 0 && ' '}
                <span className="kinetic-text__word">
                  {Array.from(word, (letter, index) => (
                    <span key={index} className="kinetic-text__anchor">
                      <span className="kinetic-text__glyph">{letter}</span>
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </span>
        </p>
      ))}
    </div>
  );
}
