import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { siteConfig } from '../data/siteContent';
import './Resume.css';

export default function Resume() {
  const [open, setOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const fishRef = useRef(null);
  const titleRef = useRef(null);
  const pdf = siteConfig.social.resume;

  useEffect(() => {
    const track = fishRef.current;
    if (!track || reducedMotion) return;

    const banner = track.parentElement;
    const videos = Array.from(track.children);
    const letters = Array.from(titleRef.current.children);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let timer;

    function tintLetters() {
      const bounds = banner.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const ratio = canvas.width / bounds.width;
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.height !== height) canvas.height = height;
      context.clearRect(0, 0, canvas.width, height);
      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        if (video.readyState < 2 || rect.right <= bounds.left || rect.left >= bounds.right) continue;
        context.drawImage(video, (rect.left - bounds.left) * ratio, 0, rect.width * ratio, height);
      }

      for (const letter of letters) {
        const rect = letter.getBoundingClientRect();
        const x = Math.round((rect.left - bounds.left) * ratio);
        const y = Math.round((rect.top - bounds.top) * ratio);
        const pixels = context.getImageData(x, y, Math.max(1, Math.round(rect.width * ratio)),
          Math.max(1, Math.round(rect.height * ratio))).data;
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] && pixels[i] < 175 && pixels[i + 1] < 175 && pixels[i + 2] < 175) ink++;
        }
        letter.classList.toggle('resume__letter--blue', ink >= 2);
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) {
        videos.forEach((video) => video.play().catch(() => {}));
        if (context) timer = window.setInterval(tintLetters, 85);
      } else {
        videos.forEach((video) => video.pause());
      }
    });
    observer.observe(banner);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      videos.forEach((video) => video.pause());
      letters.forEach((letter) => letter.classList.remove('resume__letter--blue'));
    };
  }, [reducedMotion]);

  return (
    <section className="section resume" aria-label="Résumé" id="resume">
      <div className="section__inner">
        <details className="resume__card" onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary className="resume__toggle">
            {!reducedMotion && (
              <span ref={fishRef} aria-hidden="true">
                <video className="resume__fish" src="/videos/resume-fish.mp4"
                  muted loop playsInline preload="none" />
                <video className="resume__fish resume__fish--following" src="/videos/resume-fish.mp4"
                  muted loop playsInline preload="none" />
              </span>
            )}
            <span className="resume__title" aria-label="Résumé" ref={titleRef}>
              {[...'Résumé'].map((letter, index) => <span key={index} aria-hidden="true">{letter}</span>)}
            </span>
            <span className="resume__action" aria-hidden="true">
              {open ? 'Close PDF' : 'View PDF'}
              <span className="resume__indicator">{open ? '−' : '+'}</span>
            </span>
          </summary>
          <div className="resume__preview">
            {open && (
              <iframe className="resume__pdf" src={pdf} title="Sraghvi Anchaliya’s résumé" />
            )}
            <a className="resume__file" href={pdf} target="_blank" rel="noopener noreferrer">
              Open PDF in a new tab
            </a>
          </div>
        </details>
      </div>
    </section>
  );
}
