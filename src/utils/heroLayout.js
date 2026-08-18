/** Shared viewport-locked placement for hero stickers and video */

export function isViewportLayout(layout) {
  return layout?.unit === 'viewport';
}

export function getHeroOrigin(parent) {
  if (!parent) return { left: 0, top: 0 };
  const rect = parent.getBoundingClientRect();
  const style = getComputedStyle(parent);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  return {
    left: rect.left + borderLeft + paddingLeft,
    top: rect.top + borderTop + paddingTop,
  };
}

export function toBoxFromViewport(layout, aspectRatio, parent) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const origin = getHeroOrigin(parent);
  const width = (layout.widthPercent / 100) * vw;
  const height = width / aspectRatio;
  return {
    x: (layout.xPercent / 100) * vw - origin.left,
    y: (layout.yPercent / 100) * vh - origin.top,
    width,
    height,
  };
}

export function toViewportFromBox(box, parent) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const origin = getHeroOrigin(parent);
  return {
    xPercent: +(((origin.left + box.x) / vw) * 100).toFixed(2),
    yPercent: +(((origin.top + box.y) / vh) * 100).toFixed(2),
    widthPercent: +((box.width / vw) * 100).toFixed(2),
  };
}

export function toBox(percents, aspectRatio, parentWidth, parentHeight) {
  const width = (percents.widthPercent / 100) * parentWidth;
  const height = width / aspectRatio;
  return {
    x: (percents.xPercent / 100) * parentWidth,
    y: (percents.yPercent / 100) * parentHeight,
    width,
    height,
  };
}

export function toPercent(box, parentWidth, parentHeight) {
  if (!parentWidth || !parentHeight) {
    return { xPercent: 0, yPercent: 0, widthPercent: 0 };
  }
  return {
    xPercent: +((box.x / parentWidth) * 100).toFixed(2),
    yPercent: +((box.y / parentHeight) * 100).toFixed(2),
    widthPercent: +((box.width / parentWidth) * 100).toFixed(2),
  };
}
