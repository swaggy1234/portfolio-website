import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
} from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
  getHeroOrigin,
  isViewportLayout,
  toBox,
  toBoxFromViewport,
  toPercent,
  toViewportFromBox,
} from '../utils/heroLayout';
import './EditableSticker.css';

function normalizeAngle(deg) {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

function clampBox(box, parentWidth, parentHeight, viewportLock) {
  if (viewportLock) return box;
  const minY = -parentHeight * 0.35;
  const maxY = parentHeight - box.height;
  const maxX = parentWidth - box.width;
  return {
    ...box,
    x: Math.min(Math.max(box.x, 0), Math.max(maxX, 0)),
    y: Math.min(Math.max(box.y, minY), Math.max(maxY, minY)),
  };
}

/**
 * Decorative sticker — viewport-locked or hero-relative.
 * Edit mode: drag / resize / rotate. Locked mode: subtle parallax drift.
 */
export default function EditableSticker({
  id,
  src,
  alt = '',
  className = '',
  layout,
  editMode = false,
  viewportLock = false,
  onLayoutChange,
  containerRef,
  motionDepth = 1,
  pointerX,
  pointerY,
  scrollProgress,
}) {
  const aspectRatio = layout.aspectRatio || 1;
  const parentRef = useRef(null);
  const rotationRef = useRef(layout.rotation || 0);
  const editingRef = useRef(false);
  const [parentSize, setParentSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState(false);
  const [lockedBox, setLockedBox] = useState(null);
  const reducedMotion = usePrefersReducedMotion();

  const viewportLayout = viewportLock && isViewportLayout(layout);

  const [percents, setPercents] = useState({
    xPercent: layout.xPercent,
    yPercent: layout.yPercent,
    widthPercent: layout.widthPercent,
  });
  const [rotation, setRotation] = useState(layout.rotation || 0);
  const [liveBox, setLiveBox] = useState(null);

  const flipX = Boolean(layout.flipX);
  const baseRotation = layout.rotation || 0;
  rotationRef.current = rotation;

  /* Only sync from props when not actively editing — prevents drag jitter */
  useEffect(() => {
    if (editMode && editingRef.current) return;
    setPercents({
      xPercent: layout.xPercent,
      yPercent: layout.yPercent,
      widthPercent: layout.widthPercent,
    });
    setRotation(layout.rotation || 0);
    rotationRef.current = layout.rotation || 0;
    setLiveBox(null);
  }, [
    editMode,
    layout.xPercent,
    layout.yPercent,
    layout.widthPercent,
    layout.rotation,
    layout.unit,
  ]);

  const measureParent = () => {
    const parent = containerRef?.current;
    if (!parent) return;
    parentRef.current = parent;
    setParentSize({ width: parent.clientWidth, height: parent.clientHeight });
    if (!editMode && viewportLayout) {
      setLockedBox(toBoxFromViewport(layout, aspectRatio, parent));
    }
  };

  useLayoutEffect(() => {
    measureParent();
  }, [editMode, viewportLayout, layout.xPercent, layout.yPercent, layout.widthPercent, aspectRatio]);

  useEffect(() => {
    const parent = containerRef?.current;
    if (!parent) return undefined;
    parentRef.current = parent;

    const onResize = () => measureParent();
    const observer = new ResizeObserver(onResize);
    observer.observe(parent);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, editMode, viewportLayout]);

  const box = useMemo(() => {
    const parent = parentRef.current;
    if (!parentSize.width || !parentSize.height) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    if (viewportLayout && parent) {
      return toBoxFromViewport(
        { ...percents, unit: 'viewport' },
        aspectRatio,
        parent
      );
    }
    return toBox(percents, aspectRatio, parentSize.width, parentSize.height);
  }, [percents, aspectRatio, parentSize, viewportLayout]);

  const activeBox = liveBox ?? box;

  const publish = (nextBox, nextRotation = rotationRef.current) => {
    const parent = parentRef.current;
    if (!parentSize.width || !parent) return;

    editingRef.current = true;
    const clamped = clampBox(nextBox, parentSize.width, parentSize.height, viewportLock);

    const nextPercents = viewportLock
      ? { ...toViewportFromBox(clamped, parent), unit: 'viewport' }
      : toPercent(clamped, parentSize.width, parentSize.height);

    setPercents(nextPercents);
    setRotation(nextRotation);
    rotationRef.current = nextRotation;
    setLiveBox(null);

    onLayoutChange?.(id, {
      ...nextPercents,
      rotation: nextRotation,
      flipX,
      aspectRatio,
    });
  };

  /* --- subtle life (locked only) --- */
  const driftX = useMotionValue(0);
  const driftY = useMotionValue(0);
  const driftRot = useMotionValue(0);
  const hoverScale = useSpring(1, { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (editMode || reducedMotion) {
      driftX.set(0);
      driftY.set(0);
      driftRot.set(0);
      return undefined;
    }

    let frame = 0;
    const phase = id === 'tiger2' ? 1.7 : 0.4;
    const start = performance.now();

    const tick = (now) => {
      const t = (now - start) / 1000;
      driftX.set(Math.sin(t / 9.5 + phase) * 2.4 * motionDepth);
      driftY.set(Math.cos(t / 12.5 + phase) * 1.8);
      driftRot.set(Math.sin(t / 14 + phase) * 0.35 * motionDepth);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [editMode, reducedMotion, id, motionDepth, driftX, driftY, driftRot]);

  useEffect(() => {
    hoverScale.set(hovered && !reducedMotion && !editMode ? 1.03 : 1);
  }, [hovered, reducedMotion, editMode, hoverScale]);

  const mouseShiftX = useTransform(pointerX ?? driftX, (v) =>
    pointerX ? v * 12 * motionDepth : 0
  );
  const mouseShiftY = useTransform(pointerY ?? driftY, (v) =>
    pointerY ? v * 9 * motionDepth : 0
  );
  const scrollShiftY = useTransform(scrollProgress ?? driftY, (v) =>
    scrollProgress ? v * 28 * motionDepth : 0
  );
  const scrollRotate = useTransform(scrollProgress ?? driftRot, (v) =>
    scrollProgress ? baseRotation + v * 4.5 * motionDepth : baseRotation
  );

  const liveX = useTransform([mouseShiftX, driftX], ([mouse, drift]) => mouse + drift);
  const liveY = useTransform(
    [mouseShiftY, driftY, scrollShiftY],
    ([mouse, drift, scroll]) => mouse + drift + scroll
  );
  const liveRotate = useTransform(
    [scrollRotate, driftRot],
    ([scroll, drift]) => scroll + drift
  );

  const startDrag = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.editable-sticker__rotate, .editable-sticker__resize')) return;
    event.preventDefault();
    event.stopPropagation();

    editingRef.current = true;
    const start = { x: event.clientX, y: event.clientY, box: { ...activeBox } };

    const onMove = (ev) => {
      setLiveBox({
        ...start.box,
        x: start.box.x + ev.clientX - start.x,
        y: start.box.y + ev.clientY - start.y,
      });
    };

    const onUp = (ev) => {
      publish(
        {
          ...start.box,
          x: start.box.x + ev.clientX - start.x,
          y: start.box.y + ev.clientY - start.y,
        },
        rotationRef.current
      );
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startRotate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    editingRef.current = true;

    const parent = parentRef.current;
    if (!parent) return;

    const origin = getHeroOrigin(parent);
    const centerX = origin.left + activeBox.x + activeBox.width / 2;
    const centerY = origin.top + activeBox.y + activeBox.height / 2;

    const onMove = (ev) => {
      const angle = (Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180) / Math.PI;
      const next = normalizeAngle(Math.round(angle + 90));
      rotationRef.current = next;
      setRotation(next);
    };

    const onUp = () => {
      publish(activeBox, rotationRef.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    editingRef.current = true;

    const start = { x: event.clientX, width: activeBox.width };

    const onMove = (ev) => {
      const nextWidth = Math.max(80, start.width + ev.clientX - start.x);
      setLiveBox({
        ...activeBox,
        width: nextWidth,
        height: nextWidth / aspectRatio,
      });
    };

    const onUp = () => {
      const nextWidth = Math.max(80, start.width + ev.clientX - start.x);
      publish(
        {
          ...activeBox,
          width: nextWidth,
          height: nextWidth / aspectRatio,
        },
        rotationRef.current
      );
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!editMode) {
    const lockedStyle = viewportLayout && lockedBox
      ? {
          left: lockedBox.x,
          top: lockedBox.y,
          width: lockedBox.width,
          aspectRatio: `${aspectRatio}`,
          height: 'auto',
          transformOrigin: 'center center',
        }
      : {
          left: `${layout.xPercent}%`,
          top: `${layout.yPercent}%`,
          width: `${layout.widthPercent}%`,
          aspectRatio: `${aspectRatio}`,
          height: 'auto',
          transformOrigin: 'center center',
        };

    if (viewportLayout && !lockedBox) return null;

    const lockedImg = (
      <img
        className={`editable-sticker__img ${className}`.trim()}
        src={src}
        alt={alt}
        draggable={false}
        aria-hidden={alt ? undefined : true}
        style={{ transform: flipX ? 'scaleX(-1)' : undefined }}
      />
    );

    if (reducedMotion) {
      return (
        <div
          className="editable-sticker editable-sticker--locked"
          style={{
            ...lockedStyle,
            transform: `rotate(${baseRotation}deg)`,
          }}
        >
          {lockedImg}
        </div>
      );
    }

    return (
      <motion.div
        className="editable-sticker editable-sticker--locked editable-sticker--alive"
        style={{
          ...lockedStyle,
          x: liveX,
          y: liveY,
          rotate: liveRotate,
          scale: hoverScale,
        }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      >
        {lockedImg}
      </motion.div>
    );
  }

  if (!parentSize.width || !activeBox.width) return null;

  const editTransform = `rotate(${rotation}deg)${flipX ? ' scaleX(-1)' : ''}`;

  return (
    <div
      className="editable-sticker editable-sticker--editing"
      style={{
        left: activeBox.x,
        top: activeBox.y,
        width: activeBox.width,
        height: activeBox.height,
        transform: editTransform,
      }}
      onPointerDown={startDrag}
    >
      <img
        className={`editable-sticker__img ${className}`.trim()}
        src={src}
        alt={alt}
        draggable={false}
        aria-hidden={alt ? undefined : true}
      />
      <button
        type="button"
        className="editable-sticker__rotate"
        aria-label={`Rotate ${id}`}
        title="Drag to rotate"
        onPointerDown={startRotate}
      />
      <button
        type="button"
        className="editable-sticker__resize"
        aria-label={`Resize ${id}`}
        title="Drag to resize"
        onPointerDown={startResize}
      />
    </div>
  );
}
