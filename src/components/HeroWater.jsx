import { useEffect, useRef } from 'react';
import './HeroWater.css';

const MAX_POINTER_RIPPLES = 4;
const MAX_RING_AGE = 1.55;
const STILL_WATER = { shiftX: 0, shiftY: 0, bend: 0 };

function findFish(data, width, height) {
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(mask.length);
  const fish = [];

  for (let index = 0; index < mask.length; index++) {
    mask[index] = Number(data[index * 4 + 3] > 100);
  }

  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    let count = 1;
    let xSum = 0;
    let ySum = 0;
    queue[0] = index;
    mask[index] = 0;

    for (let head = 0; head < count; head++) {
      const pixel = queue[head];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      xSum += x;
      ySum += y;

      for (const neighbor of [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1,
      ]) {
        if (!mask[neighbor]) continue;
        mask[neighbor] = 0;
        queue[count++] = neighbor;
      }
    }

    if (count > 9 && count < mask.length * 0.18) {
      fish.push({ x: xSum / count, y: ySum / count, pixels: queue.slice(0, count) });
    }
  }

  return fish.sort((a, b) => b.pixels.length - a.pixels.length).slice(0, 8);
}

function drawRing(context, ring, age, settings) {
  const life = age / MAX_RING_AGE;
  const radius = 4 + age * settings.propagationSpeed * ring.speed;
  context.strokeStyle = ring.fish ? '#778f9d' : '#688da5';
  context.lineWidth = ring.fish ? 0.82 : 1;

  for (let line = 0; line < (ring.fish ? 2 : 1); line++) {
    const size = radius - line * (4 + age * 4);
    if (size <= 0) continue;
    context.globalAlpha = settings.rippleOpacity * (1 - life) ** 1.45 * (line ? 0.48 : 1);
    context.beginPath();
    for (let step = 0; step <= 36; step++) {
      const angle = (step / 36) * Math.PI * 2;
      const wobble = 1 + 0.05 * Math.sin(angle * 3 + ring.seed + age) +
        0.026 * Math.cos(angle * 5 - ring.seed);
      const x = Math.cos(angle) * size * wobble;
      const y = Math.sin(angle) * size * wobble * (ring.fish ? 0.78 : 0.92);
      const px = ring.x + x * ring.cos - y * ring.sin + ring.dx * age;
      const py = ring.y + x * ring.sin + y * ring.cos + ring.dy * age;
      if (step === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.stroke();
  }
}

function drawCaustics(context, width, height, time, intensity) {
  context.strokeStyle = '#91aaba';
  context.lineWidth = 0.85;
  const span = Math.max(135, width / 8);
  const rows = Math.ceil(height / span) + 2;
  const cols = Math.ceil(width / span) + 2;

  function vertex(column, row) {
    const phase = column * 2.21 + row * 1.43;
    return [
      column * span + (row % 2) * span * 0.5 + Math.sin(phase + time * 0.31) * span * 0.19,
      row * span + Math.cos(phase - time * 0.23) * span * 0.26,
    ];
  }

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const [x, y] = vertex(col, row);
      const neighbors = [vertex(col + 1, row), vertex(col, row + 1)];
      context.globalAlpha = intensity * (0.36 + 0.26 * Math.sin(col * 1.9 + row + time * 0.34));
      context.beginPath();
      for (const [endX, endY] of neighbors) {
        context.moveTo(x, y);
        context.quadraticCurveTo(
          (x + endX) / 2 + span * 0.14 * Math.sin(row + time * 0.25),
          (y + endY) / 2 + span * 0.17 * Math.cos(col - time * 0.3),
          endX, endY
        );
      }
      context.stroke();
    }
  }
}

export function sampleWater(surface, x, y, now, strength) {
  if (!surface) return STILL_WATER;
  let shiftX = 0;
  let shiftY = 0;
  let bend = 0;

  for (const wave of surface.pointerRipples) {
    const age = (now - wave.start) / 1000;
    if (age < 0 || age > MAX_RING_AGE) continue;
    const dx = x - wave.x;
    const dy = y - wave.y;
    const distance = Math.hypot(dx, dy);
    const front = (distance - 4 - age * surface.speed * wave.speed) / 17;
    if (Math.abs(front) > 2.4) continue;
    const envelope = Math.exp(-front * front) * (1 - age / MAX_RING_AGE) ** 2;
    const amount = strength * envelope * Math.cos(front * 2.3);
    shiftX += dx * amount / Math.max(distance, 10);
    shiftY += dy * amount / Math.max(distance, 10);
    bend += envelope * Math.sin(front * 2.3) * strength * 0.006;
  }
  return { shiftX, shiftY, bend: Math.max(-0.12, Math.min(0.12, bend)) };
}

export default function HeroWater({ heroRef, videoCanvasRef, videoWrapRef, waterRef, settings }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const maskCanvas = document.createElement('canvas');
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!hero || !context || !maskContext) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const surface = { pointerRipples: [], speed: settings.propagationSpeed, bounds: null };
    let fishRipples = [];
    let bubbles = [];
    let previousFish = [];
    let previousPointer;
    let lastFishSample = 0;
    let lastDraw = 0;
    let visible = false;
    let frame = 0;
    let width = 0;
    let height = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_000_000 / Math.max(1, width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      surface.bounds = canvas.getBoundingClientRect();
      if (motion.matches) draw(nowSeconds());
    }

    function nowSeconds() {
      return performance.now() / 1000;
    }

    function addRing(x, y, time, fish, angle = 0) {
      const ring = {
        x, y, start: time * 1000, fish, seed: Math.random() * Math.PI * 2,
        speed: fish ? 0.52 : 1, cos: Math.cos(angle), sin: Math.sin(angle),
        dx: fish ? -Math.cos(angle) * 8 : 0, dy: fish ? -Math.sin(angle) * 8 : 0,
      };
      if (fish) {
        fishRipples = [...fishRipples.slice(-11), ring];
        if (Math.random() < 0.27) bubbles = [...bubbles.slice(-7), { x, y, start: time, seed: ring.seed }];
      } else {
        surface.pointerRipples = [...surface.pointerRipples.slice(-(MAX_POINTER_RIPPLES - 1)), ring];
      }
    }

    function sampleFish(time) {
      if (settings.rippleFrequency <= 0 || settings.rippleOpacity <= 0) return;
      const source = videoCanvasRef.current;
      const wrap = videoWrapRef.current;
      if (!source?.width || !source.height || !wrap) return;
      const bounds = wrap.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const maskWidth = 112;
      const maskHeight = Math.max(24, Math.min(144, Math.round(maskWidth * bounds.height / bounds.width)));
      if (maskCanvas.width !== maskWidth || maskCanvas.height !== maskHeight) {
        maskCanvas.width = maskWidth;
        maskCanvas.height = maskHeight;
        previousFish = [];
      }

      maskContext.clearRect(0, 0, maskWidth, maskHeight);
      maskContext.drawImage(source, 0, 0, maskWidth, maskHeight);
      const fish = findFish(maskContext.getImageData(0, 0, maskWidth, maskHeight).data, maskWidth, maskHeight);
      const unmatched = new Set(previousFish);
      for (const schoolmate of fish) {
        let match;
        let nearest = 19;
        for (const candidate of unmatched) {
          const distance = Math.hypot(schoolmate.x - candidate.x, schoolmate.y - candidate.y);
          if (distance < nearest) {
            match = candidate;
            nearest = distance;
          }
        }
        if (match) unmatched.delete(match);
        schoolmate.lastRipple = match?.lastRipple ?? time;
        if (!match || nearest < 0.14 || time - schoolmate.lastRipple < 1 / settings.rippleFrequency) continue;

        const dx = (schoolmate.x - match.x) / nearest;
        const dy = (schoolmate.y - match.y) / nearest;
        let tail = Infinity;
        for (const pixel of schoolmate.pixels) {
          const projection = (pixel % maskWidth - schoolmate.x) * dx +
            (Math.floor(pixel / maskWidth) - schoolmate.y) * dy;
          tail = Math.min(tail, projection);
        }

        const x = bounds.left - surface.bounds.left + (schoolmate.x + tail * dx) * bounds.width / maskWidth;
        const y = bounds.top - surface.bounds.top + (schoolmate.y + tail * dy) * bounds.height / maskHeight;
        if (x < 0 || x > width || y < 0 || y > height) continue;
        addRing(x, y, time, true, Math.atan2(dy * bounds.height / maskHeight, dx * bounds.width / maskWidth));
        schoolmate.lastRipple = time;
      }
      previousFish = fish;
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      if (!width || !height) return;
      const still = motion.matches;
      drawCaustics(context, width, height, still ? 0 : time, settings.causticIntensity);

      if (!still) {
        const fresh = (ring) => time - ring.start / 1000 < MAX_RING_AGE;
        fishRipples = fishRipples.filter(fresh);
        surface.pointerRipples = surface.pointerRipples.filter(fresh);
        for (const ring of [...fishRipples, ...surface.pointerRipples]) {
          drawRing(context, ring, Math.max(0, time - ring.start / 1000), settings);
        }

        context.strokeStyle = '#839aa8';
        context.lineWidth = 0.7;
        bubbles = bubbles.filter((bubble) => time - bubble.start < 2.6);
        for (const bubble of bubbles) {
          const age = time - bubble.start;
          context.globalAlpha = 0.2 * (1 - age / 2.6);
          context.beginPath();
          context.ellipse(bubble.x + Math.sin(age + bubble.seed) * 4, bubble.y - 9 * age,
            2.2 + age * 0.5, 2 + age * 0.35, bubble.seed, 0, Math.PI * 2);
          context.stroke();
        }
      }

      context.fillStyle = '#91a2aa';
      for (let i = 0; i < 14; i++) {
        const t = still ? 0 : time;
        const x = ((((i * 0.618033) % 1) * width + t * (1 + i % 3)) % width);
        const y = ((i * 0.414214 + 0.2) % 1) * height + 6 * Math.sin(t * 0.19 + i);
        context.globalAlpha = 0.09 + (i % 3) * 0.018;
        context.beginPath();
        context.ellipse(x, y, 0.65 + (i % 4) * 0.16, 0.65, i, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    function animate(now) {
      if (now - lastDraw >= 30) {
        const time = now / 1000;
        surface.bounds = canvas.getBoundingClientRect();
        if (now - lastFishSample >= 135) {
          sampleFish(time);
          lastFishSample = now;
        }
        draw(time);
        lastDraw = now;
      }
      frame = requestAnimationFrame(animate);
    }

    function sync() {
      cancelAnimationFrame(frame);
      if (visible && !motion.matches && !document.hidden) {
        waterRef.current = surface;
        frame = requestAnimationFrame(animate);
      } else {
        waterRef.current = null;
        surface.pointerRipples = [];
        fishRipples = [];
        bubbles = [];
        previousFish = [];
        previousPointer = undefined;
        draw(nowSeconds());
      }
    }

    function point(event) {
      if (!visible || motion.matches || settings.rippleFrequency <= 0 || event.pointerType === 'touch') return;
      const { clientX, clientY } = event;
      const time = nowSeconds();
      if (previousPointer && (
        time - previousPointer.time < 0.21 ||
        Math.hypot(clientX - previousPointer.x, clientY - previousPointer.y) < 41
      )) return;
      const bounds = canvas.getBoundingClientRect();
      surface.bounds = bounds;
      addRing(clientX - bounds.left, clientY - bounds.top, time, false);
      previousPointer = { x: clientX, y: clientY, time };
    }

    function leave() {
      previousPointer = undefined;
    }

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const dimensions = new ResizeObserver(resize);
    resize();
    draw(nowSeconds());
    visibility.observe(hero);
    dimensions.observe(canvas);
    hero.addEventListener('pointermove', point, { passive: true });
    hero.addEventListener('pointerleave', leave);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      waterRef.current = null;
      cancelAnimationFrame(frame);
      visibility.disconnect();
      dimensions.disconnect();
      hero.removeEventListener('pointermove', point);
      hero.removeEventListener('pointerleave', leave);
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [heroRef, videoCanvasRef, videoWrapRef, waterRef, settings]);

  return <canvas ref={canvasRef} className="hero-water" aria-hidden="true" />;
}
