import { useEffect, useMemo, useRef, useState } from 'react';
import './HeroVideo.css';

const WHITE_KEY = 232;

function isViewportLayout(layout) {
  return layout.unit === 'viewport';
}

function isFillLayout(layout) {
  return layout.unit === 'fill';
}

function drawImageContain(ctx, video, canvasWidth, canvasHeight) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.min(canvasWidth / vw, canvasHeight / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (canvasWidth - dw) / 2;
  const dy = (canvasHeight - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function drawImageCover(ctx, video, canvasWidth, canvasHeight, rotation = 0) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const rot = ((rotation % 360) + 360) % 360;
  const isSideways = rot === 90 || rot === 270;

  if (isSideways) {
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const scale = Math.max(canvasWidth / vh, canvasHeight / vw);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  const scale = Math.max(canvasWidth / vw, canvasHeight / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (canvasWidth - dw) / 2;
  const dy = (canvasHeight - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function toBox(percents, aspectRatio, parentWidth, parentHeight) {
  const width = (percents.widthPercent / 100) * parentWidth;
  const height = width / aspectRatio;
  return {
    x: (percents.xPercent / 100) * parentWidth,
    y: (percents.yPercent / 100) * parentHeight,
    width,
    height,
  };
}

function toPercent(box, parentWidth, parentHeight) {
  if (!parentWidth || !parentHeight) {
    return { xPercent: 0, yPercent: 0, widthPercent: 0 };
  }
  return {
    xPercent: +((box.x / parentWidth) * 100).toFixed(2),
    yPercent: +((box.y / parentHeight) * 100).toFixed(2),
    widthPercent: +((box.width / parentWidth) * 100).toFixed(2),
  };
}

function normalizeAngle(deg) {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

function clampBox(box) {
  return box;
}

function viewportStyle(percents, rotation, aspectRatio) {
  return {
    left: `${percents.xPercent}vw`,
    top: `${percents.yPercent}vh`,
    width: `${percents.widthPercent}vw`,
    aspectRatio: `${aspectRatio}`,
    transform: `rotate(${rotation}deg)`,
  };
}

/** Turn near-white pixels transparent so the pour floats like a PNG sticker. */
function keyWhiteBackground(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    const spread = Math.max(r, g, b) - min;

    if (min >= WHITE_KEY && spread < 30) {
      data[i + 3] = 0;
      continue;
    }

    if (min >= WHITE_KEY - 18 && spread < 35) {
      const fade = Math.round(((WHITE_KEY - min + 18) / 26) * 255);
      data[i + 3] = Math.min(data[i + 3], fade);
    }
  }
}

function mergeRefs(...refs) {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    });
  };
}

export default function HeroVideo({
  src,
  layout,
  className = 'hero__sticker hero__sticker--pour',
  keyWhite = true,
  blendMode = null,
  editMode = false,
  containerRef,
  onLayoutChange,
  playbackRate = 1,
  loop = true,
  overlayCanvasRef = null,
  overlayWrapRef = null,
}) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const parentRef = useRef(null);
  const rotationRef = useRef(layout.rotation || 0);
  const [nativeAspect, setNativeAspect] = useState(null);
  const aspectRatio = nativeAspect ?? layout.aspectRatio ?? 9 / 16;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;
  const fillLayout = isFillLayout(layout);
  const fillRotation = fillLayout ? (layout.rotation ?? 90) : 0;
  const viewportLayout = isViewportLayout(layout);
  const [parentSize, setParentSize] = useState({ width: 0, height: 0 });
  const [percents, setPercents] = useState({
    xPercent: layout.xPercent,
    yPercent: layout.yPercent,
    widthPercent: layout.widthPercent,
  });
  const [rotation, setRotation] = useState(layout.rotation || 0);
  const [livePercents, setLivePercents] = useState(null);

  rotationRef.current = rotation;

  useEffect(() => {
    if (editMode) return;
    setPercents({
      xPercent: layout.xPercent,
      yPercent: layout.yPercent,
      widthPercent: layout.widthPercent,
    });
    setRotation(layout.rotation || 0);
    rotationRef.current = layout.rotation || 0;
    setLivePercents(null);
  }, [editMode, layout.xPercent, layout.yPercent, layout.widthPercent, layout.rotation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.playbackRate = playbackRate;
    video.loop = loop;
    video.muted = true;
    video.playsInline = true;
    if (loop) video.setAttribute('loop', '');
    else video.removeAttribute('loop');

    const play = () => {
      if (video.paused) video.play().catch(() => {});
    };

    const restart = () => {
      video.currentTime = 0;
      play();
    };

    const onEnded = () => {
      if (loop) restart();
    };

    const syncAspect = () => {
      if (video.videoWidth && video.videoHeight) {
        setNativeAspect(+(video.videoWidth / video.videoHeight).toFixed(4));
      }
    };

    play();
    syncAspect();
    video.addEventListener('loadedmetadata', syncAspect);
    video.addEventListener('loadeddata', play);
    video.addEventListener('canplay', play);
    video.addEventListener('playing', play);
    video.addEventListener('ended', onEnded);

    const onVisible = () => {
      if (document.visibilityState === 'visible') play();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      video.removeEventListener('loadedmetadata', syncAspect);
      video.removeEventListener('loadeddata', play);
      video.removeEventListener('canplay', play);
      video.removeEventListener('playing', play);
      video.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [src, playbackRate, loop]);

  useEffect(() => {
    const parent = containerRef?.current;
    if (!parent || viewportLayout) return undefined;
    parentRef.current = parent;

    const measure = () => {
      setParentSize({ width: parent.clientWidth, height: parent.clientHeight });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, viewportLayout]);

  const [wrapReady, setWrapReady] = useState(false);

  const assignWrapRef = mergeRefs(wrapRef, overlayWrapRef, (node) => {
    setWrapReady(Boolean(node));
  });

  useEffect(() => {
    if (!keyWhite || !wrapReady) return undefined;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!video || !canvas || !wrap) return undefined;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;

    let frame = 0;
    let cancelled = false;

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const draw = () => {
      if (cancelled) return;
      resize();
      if (video.readyState >= 2 && canvas.width > 0 && canvas.height > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (fillLayout) {
          drawImageCover(ctx, video, canvas.width, canvas.height, fillRotation);
        } else {
          drawImageContain(ctx, video, canvas.width, canvas.height);
        }
        try {
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          keyWhiteBackground(image.data);
          ctx.putImageData(image, 0, 0);
        } catch {
          /* ignore */
        }
      }
      frame = requestAnimationFrame(draw);
    };

    if (video.paused) video.play().catch(() => {});
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [keyWhite, src, wrapReady, fillLayout, fillRotation]);

  const showCanvas = keyWhite;

  const activePercents = livePercents ?? percents;

  const box = useMemo(() => {
    if (viewportLayout) return null;
    if (!parentSize.width || !parentSize.height) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return toBox(percents, aspectRatio, parentSize.width, parentSize.height);
  }, [percents, aspectRatio, parentSize, viewportLayout]);

  const publishViewport = (nextPercents, nextRotation = rotationRef.current) => {
    const { width, height } = getViewportSize();
    const ratio = aspectRatioRef.current;
    const payload = {
      ...nextPercents,
      unit: 'viewport',
      aspectRatio: ratio,
      rotation: nextRotation,
      referenceViewport: { width: Math.round(width), height: Math.round(height) },
    };
    setPercents(nextPercents);
    setRotation(nextRotation);
    rotationRef.current = nextRotation;
    setLivePercents(null);
    onLayoutChange?.(payload);
  };

  const publishHeroRelative = (nextBox, nextRotation = rotationRef.current) => {
    if (!parentSize.width || !parentSize.height) return;
    const clamped = clampBox(nextBox);
    const nextPercents = toPercent(clamped, parentSize.width, parentSize.height);
    setPercents(nextPercents);
    setRotation(nextRotation);
    rotationRef.current = nextRotation;
    onLayoutChange?.({
      ...nextPercents,
      aspectRatio: aspectRatioRef.current,
      rotation: nextRotation,
    });
  };

  useEffect(() => {
    if (!editMode || !onLayoutChange) return;
    const { width, height } = getViewportSize();
    onLayoutChange({
      ...percents,
      aspectRatio: aspectRatioRef.current,
      rotation,
      ...(viewportLayout
        ? {
            unit: 'viewport',
            referenceViewport: { width: Math.round(width), height: Math.round(height) },
          }
        : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, viewportLayout]);

  const startViewportDrag = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.hero-video__resize, .hero-video__rotate')) return;
    event.preventDefault();
    event.stopPropagation();

    const start = {
      x: event.clientX,
      y: event.clientY,
      percents: { ...activePercents },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onMove = (ev) => {
      const { width, height } = getViewportSize();
      setLivePercents({
        ...start.percents,
        xPercent: +(start.percents.xPercent + ((ev.clientX - start.x) / width) * 100).toFixed(2),
        yPercent: +(start.percents.yPercent + ((ev.clientY - start.y) / height) * 100).toFixed(2),
      });
    };

    const onUp = (ev) => {
      const { width, height } = getViewportSize();
      publishViewport({
        ...start.percents,
        xPercent: +(start.percents.xPercent + ((ev.clientX - start.x) / width) * 100).toFixed(2),
        yPercent: +(start.percents.yPercent + ((ev.clientY - start.y) / height) * 100).toFixed(2),
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startViewportRotate = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const { width, height } = getViewportSize();
    const p = activePercents;
    const boxWidth = (p.widthPercent / 100) * width;
    const boxHeight = boxWidth / aspectRatio;
    const centerX = (p.xPercent / 100) * width + boxWidth / 2;
    const centerY = (p.yPercent / 100) * height + boxHeight / 2;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onMove = (ev) => {
      const angle = (Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180) / Math.PI;
      const next = normalizeAngle(Math.round(angle + 90));
      rotationRef.current = next;
      setRotation(next);
    };

    const onUp = () => {
      publishViewport(activePercents, rotationRef.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startViewportResize = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const start = {
      x: event.clientX,
      widthPercent: activePercents.widthPercent,
      percents: { ...activePercents },
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onMove = (ev) => {
      const { width } = getViewportSize();
      const nextWidthPercent = Math.max(5, start.widthPercent + ((ev.clientX - start.x) / width) * 100);
      setLivePercents({ ...start.percents, widthPercent: +nextWidthPercent.toFixed(2) });
    };

    const onUp = (ev) => {
      const { width } = getViewportSize();
      const nextWidthPercent = Math.max(5, start.widthPercent + ((ev.clientX - start.x) / width) * 100);
      publishViewport({ ...start.percents, widthPercent: +nextWidthPercent.toFixed(2) });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startHeroDrag = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.hero-video__resize, .hero-video__rotate')) return;
    event.preventDefault();
    event.stopPropagation();

    const activeBox = box ?? { x: 0, y: 0, width: 0, height: 0 };
    const start = { x: event.clientX, y: event.clientY, box: { ...activeBox } };
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const onMove = (ev) => {
      publishHeroRelative({
        ...start.box,
        x: start.box.x + ev.clientX - start.x,
        y: start.box.y + ev.clientY - start.y,
      });
    };

    const onUp = (ev) => {
      publishHeroRelative({
        ...start.box,
        x: start.box.x + ev.clientX - start.x,
        y: start.box.y + ev.clientY - start.y,
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const lockedRotation = layout.rotation || 0;
  const blendStyle =
    !keyWhite && blendMode && blendMode !== 'normal' ? { mixBlendMode: blendMode } : undefined;
  const wrapClass = [
    'hero-video',
    fillLayout ? 'hero-video--fill' : '',
    viewportLayout && !editMode ? 'hero-video--viewport' : '',
    viewportLayout && editMode ? 'hero-video--viewport-edit' : '',
    className,
    editMode && !fillLayout ? 'hero-video--editing' : 'hero-video--locked',
  ]
    .filter(Boolean)
    .join(' ');

  const media = (
    <>
      <video
        ref={videoRef}
        className={showCanvas ? 'hero-video__source' : 'hero-video__el'}
        style={blendStyle}
        src={src}
        muted
        playsInline
        loop={loop}
        autoPlay
        preload="auto"
      />
      {showCanvas ? (
        <canvas ref={mergeRefs(canvasRef, overlayCanvasRef)} className="hero-video__el" aria-hidden="true" />
      ) : null}
    </>
  );

  const lockedPercents = {
    xPercent: layout.xPercent,
    yPercent: layout.yPercent,
    widthPercent: layout.widthPercent,
  };

  if (fillLayout) {
    return (
      <div ref={assignWrapRef} className={wrapClass}>
        {media}
      </div>
    );
  }

  if (!editMode) {
    return (
      <div
        ref={assignWrapRef}
        className={wrapClass}
        style={
          viewportLayout
            ? viewportStyle(lockedPercents, lockedRotation, aspectRatio)
            : {
                left: `${layout.xPercent}%`,
                top: `${layout.yPercent}%`,
                width: `${layout.widthPercent}%`,
                aspectRatio: `${aspectRatio}`,
                transform: `rotate(${lockedRotation}deg)`,
              }
        }
      >
        {media}
      </div>
    );
  }

  if (viewportLayout) {
    return (
      <div
        ref={assignWrapRef}
        className={wrapClass}
        style={viewportStyle(activePercents, rotation, aspectRatio)}
      >
        {media}
        <div
          className="hero-video__hitarea"
          aria-hidden="true"
          onPointerDown={startViewportDrag}
        />
        <button
          type="button"
          className="hero-video__rotate"
          aria-label="Rotate hero video"
          title="Drag to rotate"
          onPointerDown={startViewportRotate}
        />
        <button
          type="button"
          className="hero-video__resize"
          aria-label="Resize hero video"
          title="Drag to resize"
          onPointerDown={startViewportResize}
        />
      </div>
    );
  }

  if (!parentSize.width || !box?.width) return null;

  return (
    <div
      ref={assignWrapRef}
      className={wrapClass}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        transform: `rotate(${rotation}deg)`,
      }}
      onPointerDown={startHeroDrag}
    >
      {media}
    </div>
  );
}
