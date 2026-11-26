import { useEffect, useRef, useState } from 'react';
import './WaterSplash.css';

const droplets = [
  [-23, -16, 4, -43],
  [-13, -26, 3, -28],
  [-2, -33, 4, 5],
  [12, -28, 3, 24],
  [22, -16, 4, 47],
];

export default function WaterSplash() {
  const [splashes, setSplashes] = useState([]);
  const nextId = useRef(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastRipple;

    function addSplash({ clientX: x, clientY: y }, isTrail) {
      const point = { id: nextId.current++, x, y, isTrail, tilt: Math.random() * 50 - 25 };
      setSplashes((current) => [...current, point]);
    }

    function splash(event) {
      if (event.detail === 0 || reducedMotion.matches) return;

      addSplash(event, false);
    }

    function move(event) {
      if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
      if (event.target?.closest?.('.hero')?.querySelector('.hero-water')) return;

      const { timeStamp, clientX, clientY } = event;
      if (lastRipple && (
        timeStamp - lastRipple.timeStamp < 195 ||
        Math.hypot(clientX - lastRipple.clientX, clientY - lastRipple.clientY) < 39
      )) return;

      lastRipple = { timeStamp, clientX, clientY };
      addSplash(event, true);
    }

    const options = { capture: true, passive: true };
    window.addEventListener('click', splash, options);
    window.addEventListener('pointermove', move, options);
    return () => {
      window.removeEventListener('click', splash, true);
      window.removeEventListener('pointermove', move, true);
    };
  }, []);

  return (
    <div className="water-splashes" aria-hidden="true">
      {splashes.map(({ id, x, y, isTrail, tilt }) => (
        <span className="water-splash" key={id} style={{ left: x, top: y, '--tilt': `${tilt}deg` }}>
          {!isTrail && (
            <>
              <span className="water-splash__ring" />
              <span className="water-splash__ring water-splash__ring--middle" />
            </>
          )}
          <span
            className={`water-splash__ring water-splash__ring--${isTrail ? 'trail' : 'inner'}`}
            onAnimationEnd={() => setSplashes((current) => current.filter((point) => point.id !== id))}
          />
          {!isTrail && droplets.map(([dx, dy, size, angle], index) => (
            <span
              className="water-splash__drop"
              key={dx}
              style={{
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                '--size': `${size}px`,
                '--drop-angle': `${angle}deg`,
                '--flight': `${440 + index % 3 * 55}ms`,
                '--lift-delay': `${index % 3 * 16}ms`,
              }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
