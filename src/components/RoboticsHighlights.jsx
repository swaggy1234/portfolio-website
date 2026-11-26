import { useState } from 'react';
import './RoboticsHighlights.css';

const slides = [
  { name: 'Humanoid demo', src: 'new-demo.mp4', poster: 'new-demo.jpg' },
  { name: 'Buster', src: 'buster.jpg', alt: 'Sraghvi wearing a headset beside Buster in the robotics lab' },
  { name: 'AR / VR', src: 'ar-vr.jpg', alt: 'Two Chewy Robotics teammates trying headsets on the lab floor' },
  { name: 'Gripper test', src: 'gripper.mp4', poster: 'gripper-video.jpg' },
  { name: 'Gripper setup', src: 'grippers.jpg', alt: 'Two robotic arms with grippers mounted over a workbench' },
  { name: 'Chewy lab floor', src: 'demo-1.mp4', poster: 'demo-1.jpg' },
  { name: 'Robotic arms', src: 'demo-2.mp4', poster: 'demo-2.jpg' },
  { name: 'Behind the scenes', src: 'chewy-floor.jpg', alt: 'Two teammates beside the humanoid robot on the Chewy floor' },
  { name: 'Reachy Mini', src: 'reachy-mini.jpg', alt: 'Reachy Mini wearing a red bow tie beside a live face-tracking test' },
];

export default function RoboticsHighlights() {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  function step(direction) {
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="section robotics-highlights" id="robotics" aria-labelledby="robotics-title">
      <div className="section__inner">
        <h3 className="section__title" id="robotics-title">Robotics in Practice</h3>
        <div className="robotics-highlights__viewer">
          <figure key={slide.src} className="robotics-highlights__slide">
            {slide.poster ? (
              <video src={`/robotics/${slide.src}`} poster={`/robotics/${slide.poster}`}
                aria-label={slide.name} controls playsInline preload="none" />
            ) : (
              <img src={`/robotics/${slide.src}`} alt={slide.alt} />
            )}
          </figure>
          <div className="robotics-highlights__controls">
            <button type="button" onClick={() => step(-1)} aria-label="Previous robotics slide">‹</button>
            <p aria-live="polite">{slide.name} <span>{active + 1} / {slides.length}</span></p>
            <button type="button" onClick={() => step(1)} aria-label="Next robotics slide">›</button>
          </div>
          <div className="robotics-highlights__strip" aria-label="Choose a robotics slide" role="group">
            {slides.map(({ name, src, poster }, index) => (
              <button type="button" key={src} onClick={() => setActive(index)} aria-pressed={active === index}>
                <img src={`/robotics/${poster || src}`} alt="" loading="lazy" />
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
