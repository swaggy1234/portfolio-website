/**
 * TIGER OUTLINE SVG
 * Stroke-only big-cat silhouette inspired by editorial textile prints.
 * Edit stroke color via CSS (--color-tiger-stroke) or className.
 */

const TIGER_PATH = [
  'M54 6 C44 8 36 20 38 36 C40 52 48 64 46 80',
  'C34 90 22 106 20 126 C18 150 28 170 40 182',
  'C30 202 24 228 26 254 C28 278 40 296 52 308',
  'C46 326 42 348 48 368 C52 382 56 392 58 398',
  'M52 308 C64 294 74 272 78 248 C82 222 78 196 68 176',
  'C82 158 90 134 90 110 C90 86 80 64 66 50',
  'C70 36 68 20 58 10 C56 8 55 6 54 6 Z',
  'M38 36 C28 44 16 58 14 78',
  'M46 80 C58 74 70 74 82 80',
  'M40 182 C52 176 66 178 76 186',
  'M66 50 C72 40 74 28 68 16',
].join(' ');

export default function TigerOutline({
  className = '',
  flip = 'none',
  strokeWidth = 1,
  ...props
}) {
  const scaleX = flip === 'horizontal' || flip === 'both' ? -1 : 1;
  const scaleY = flip === 'vertical' || flip === 'both' ? -1 : 1;

  return (
    <svg
      className={`tiger-outline ${className}`}
      viewBox="0 0 104 404"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <g
        transform={`translate(${scaleX === -1 ? 104 : 0}, ${scaleY === -1 ? 404 : 0}) scale(${scaleX}, ${scaleY})`}
      >
        <path
          d={TIGER_PATH}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
