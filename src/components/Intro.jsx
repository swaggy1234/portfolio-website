import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './Intro.css';

const INTRO_VIDEO = '/videos/intro-pour.mp4';
const PLAYBACK_RATE = 0.48;
const WHITE_KEY = 235;

const DEFAULT_CUP = { x: 0.5, y: 0.84 };
const MONOGRAM_SCALE = 0.082;

const CUP_SEARCH = { xMin: 0.28, xMax: 0.72, yMin: 0.62, yMax: 0.97 };

function isLiquid(r, g, b) {
  if (r >= WHITE_KEY && g >= WHITE_KEY && b >= WHITE_KEY) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 130;
}

function fitVideoContain(videoWidth, videoHeight, viewWidth, viewHeight) {
  const scale = Math.min(viewWidth / videoWidth, viewHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return {
    // Keep the source's cropped arm flush with the screen's top/right edges.
    x: viewWidth - width,
    y: 0,
    width,
    height,
  };
}

function detectCupCenter(ctx, rect, canvasWidth) {
  const image = ctx.getImageData(0, 0, canvasWidth, ctx.canvas.height);
  const { data } = image;
  const xMin = Math.floor(rect.x + rect.width * CUP_SEARCH.xMin);
  const xMax = Math.floor(rect.x + rect.width * CUP_SEARCH.xMax);
  const yMin = Math.floor(rect.y + rect.height * CUP_SEARCH.yMin);
  const yMax = Math.floor(rect.y + rect.height * CUP_SEARCH.yMax);

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let py = yMin; py < yMax; py += 2) {
    for (let px = xMin; px < xMax; px += 2) {
      const i = (py * canvasWidth + px) * 4;
      if (isLiquid(data[i], data[i + 1], data[i + 2])) {
        sumX += px;
        sumY += py;
        count += 1;
      }
    }
  }

  if (count < 60) return DEFAULT_CUP;

  return {
    x: (sumX / count - rect.x) / rect.width,
    y: (sumY / count - rect.y) / rect.height,
  };
}

function IntroMonogram() {
  return (
    <span className="intro__monogram-mark" aria-hidden="true">
      <span className="intro__monogram-s">S</span>
      <span className="intro__monogram-a">A</span>
    </span>
  );
}

export default function Intro({ onComplete }) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const monogramRef = useRef(null);
  const cupRef = useRef(DEFAULT_CUP);
  const [visible, setVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

  const finishIntro = useCallback(() => {
    setVisible(false);
    setTimeout(onComplete, reducedMotion ? 200 : 600);
  }, [onComplete, reducedMotion]);

  const positionMonogram = useCallback(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    const monogram = monogramRef.current;
    if (!stage || !video || !monogram || !video.videoWidth) return;

    const rect = fitVideoContain(
      video.videoWidth,
      video.videoHeight,
      stage.clientWidth,
      stage.clientHeight
    );

    const cup = cupRef.current;
    const cx = rect.x + rect.width * cup.x;
    const cy = rect.y + rect.height * cup.y;
    const size = rect.width * MONOGRAM_SCALE;

    monogram.style.left = `${cx}px`;
    monogram.style.top = `${cy}px`;
    monogram.style.fontSize = `${size}px`;
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      const timer = setTimeout(finishIntro, 500);
      return () => clearTimeout(timer);
    }

    const video = videoRef.current;
    if (!video) return undefined;

    video.playbackRate = PLAYBACK_RATE;

    const calibrate = async () => {
      if (!video.duration) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || !stageRef.current) return;

      canvas.width = stageRef.current.clientWidth;
      canvas.height = stageRef.current.clientHeight;

      const saved = video.currentTime;
      video.currentTime = Math.max(0, video.duration - 0.06);

      await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
      });

      const rect = fitVideoContain(
        video.videoWidth,
        video.videoHeight,
        canvas.width,
        canvas.height
      );
      ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);
      cupRef.current = detectCupCenter(ctx, rect, canvas.width);

      video.currentTime = 0;
      await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
      });

      if (Math.abs(saved) > 0.01) video.currentTime = saved;
      positionMonogram();
    };

    const start = async () => {
      await document.fonts.ready;
      await calibrate();
      positionMonogram();
      try {
        await video.play();
      } catch {
        finishIntro();
      }
    };

    window.addEventListener('resize', positionMonogram);
    video.addEventListener('loadedmetadata', positionMonogram);
    video.addEventListener('canplay', start, { once: true });
    video.addEventListener('ended', () => setTimeout(finishIntro, 400));

    return () => {
      window.removeEventListener('resize', positionMonogram);
      video.removeEventListener('loadedmetadata', positionMonogram);
      video.removeEventListener('canplay', start);
    };
  }, [finishIntro, positionMonogram, reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {reducedMotion ? (
            <div className="intro__fallback" aria-label={siteConfig.name}>
              <IntroMonogram />
            </div>
          ) : (
            <div ref={stageRef} className="intro__stage">
              <video
                ref={videoRef}
                className="intro__video"
                src={INTRO_VIDEO}
                muted
                playsInline
                preload="auto"
              />
              <div ref={monogramRef} className="intro__monogram" aria-label={siteConfig.name}>
                <IntroMonogram />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
