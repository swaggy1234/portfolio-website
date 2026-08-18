import { useRef, useState, useEffect, useCallback } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './ScrollFlowerVideo.css';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function mapScrollProgress(progress, scrollSpan, scrollEase = 1) {
  const span = !scrollSpan || scrollSpan <= 0 ? 1 : scrollSpan;
  const t = clamp01(progress / span);
  if (!scrollEase || scrollEase === 1) return t;
  return Math.pow(t, scrollEase);
}

function parseHexColor(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return { r: 61, g: 15, b: 36 };
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function dilateAlphas(alphas, width, height, radius) {
  if (radius <= 0) return alphas;

  const expanded = new Float32Array(alphas.length);
  const radiusSq = radius * radius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const alpha = alphas[idx];
      if (alpha <= 0) continue;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radiusSq) continue;

          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

          const neighbor = ny * width + nx;
          if (alpha > expanded[neighbor]) expanded[neighbor] = alpha;
        }
      }
    }
  }

  return expanded;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Scroll-scrubbed lotus — one pass through frames (bud → bloom), cream bg removed.
 */
export default function ScrollFlowerVideo() {
  const { scrollFlowerVideo } = siteConfig;
  const canvasRef = useRef(null);
  const framesRef = useRef([]);
  const lastIndexRef = useRef(-1);
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  const { scrollYProgress } = useScroll();
  const scrollSpan = scrollFlowerVideo.scrollSpan ?? 1;
  const scrollEase = scrollFlowerVideo.scrollEase ?? 1.45;
  const frameCount = scrollFlowerVideo.frameCount ?? 30;
  const framesDir = scrollFlowerVideo.framesDir ?? '/videos/flower-frames';
  const lineThreshold = scrollFlowerVideo.lineThreshold ?? 225;
  const lineThickness = scrollFlowerVideo.lineThickness ?? 3;
  const lineColor = parseHexColor(scrollFlowerVideo.lineColor ?? '#3d0f24');

  const paintFrame = useCallback(
    (img) => {
      const canvas = canvasRef.current;
      if (!canvas || !img) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return;

      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const sctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!sctx) return;

      sctx.clearRect(0, 0, w, h);
      sctx.drawImage(img, 0, 0, w, h);

      const imageData = sctx.getImageData(0, 0, w, h);
      const { data } = imageData;
      const alphas = new Float32Array(w * h);

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          const lum = luminance(data[i], data[i + 1], data[i + 2]);
          if (lum >= lineThreshold) continue;

          const strength = 1 - lum / lineThreshold;
          alphas[y * w + x] = Math.min(1, strength * 1.45);
        }
      }

      const thickened = dilateAlphas(alphas, w, h, lineThickness);

      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          const alpha = thickened[y * w + x];

          if (alpha <= 0) {
            data[i + 3] = 0;
            continue;
          }

          data[i] = lineColor.r;
          data[i + 1] = lineColor.g;
          data[i + 2] = lineColor.b;
          data[i + 3] = Math.round(alpha * 255);

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      sctx.putImageData(imageData, 0, 0);

      if (maxX < minX || maxY < minY) {
        canvas.width = 1;
        canvas.height = 1;
        return;
      }

      const pad = 4;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(w - cropX, maxX - minX + 1 + pad * 2);
      const cropH = Math.min(h - cropY, maxY - minY + 1 + pad * 2);

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, cropW, cropH);
      ctx.drawImage(scratch, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      setAspectRatio(cropW / cropH);
    },
    [lineColor.b, lineColor.g, lineColor.r, lineThreshold, lineThickness]
  );

  const scrub = useCallback(
    (progress) => {
      const frames = framesRef.current;
      if (!frames.length) return;

      const mapped = mapScrollProgress(progress, scrollSpan, scrollEase);
      const index = Math.min(
        frames.length - 1,
        Math.max(0, Math.round(mapped * (frames.length - 1)))
      );

      if (index === lastIndexRef.current) return;
      lastIndexRef.current = index;
      paintFrame(frames[index]);
    },
    [scrollSpan, scrollEase, paintFrame]
  );

  useEffect(() => {
    let cancelled = false;

    const paths = Array.from(
      { length: frameCount },
      (_, i) => `${framesDir}/frame-${String(i).padStart(2, '0')}.png`
    );

    Promise.all(paths.map(loadImage))
      .then((frames) => {
        if (cancelled || !frames.length) return;

        framesRef.current = frames;
        setReady(true);
        lastIndexRef.current = -1;
        scrub(reducedMotion ? 1 : 0);
      })
      .catch((err) => {
        console.error('Failed to load flower frames', err);
      });

    return () => {
      cancelled = true;
      framesRef.current = [];
    };
  }, [frameCount, framesDir, reducedMotion, scrub]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (reducedMotion || !ready) return;
    scrub(value);
  });

  useEffect(() => {
    if (!ready) return;
    scrub(reducedMotion ? 1 : scrollYProgress.get());
  }, [ready, reducedMotion, scrub, scrollYProgress]);

  return (
    <div
      className="scroll-flower"
      style={{ aspectRatio: `${aspectRatio}` }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="scroll-flower__canvas" />
    </div>
  );
}
