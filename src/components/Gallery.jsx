import { useEffect, useRef, useState } from 'react';
import { galleryContent } from '../data/siteContent';
import './Gallery.css';

function getWorkPieces(work) {
  if (work.pieces?.length) return work.pieces;
  if (work.src) return [{ id: work.id, type: work.type, src: work.src }];
  return [];
}

function renderMedia(piece, className, title) {
  if (piece.type === 'video') {
    return (
      <video
        className={className}
        src={piece.src}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
      />
    );
  }

  return <img className={className} src={piece.src} alt={piece.label || title || 'Artwork'} />;
}

export default function Gallery() {
  const hallRef = useRef(null);
  const [room, setRoom] = useState(1);
  const works = galleryContent.works;

  useEffect(() => {
    const hall = hallRef.current;
    if (!hall) return undefined;

    const onScroll = () => {
      const i = Math.round(hall.scrollLeft / Math.max(hall.clientWidth, 1)) + 1;
      setRoom(Math.min(works.length, Math.max(1, i)));
    };

    hall.addEventListener('scroll', onScroll, { passive: true });
    return () => hall.removeEventListener('scroll', onScroll);
  }, [works.length]);

  const go = (dir) => {
    const hall = hallRef.current;
    if (!hall) return;
    hall.scrollBy({ left: dir * hall.clientWidth, behavior: 'smooth' });
  };

  return (
    <section className="gallery" id="studio">
      <div className="gallery__intro section__inner">
        <p className="section__label">{galleryContent.label}</p>
        <h2 className="section__title gallery__title">{galleryContent.title}</h2>
        <p className="gallery__lede">{galleryContent.lede}</p>
      </div>

      <div className="gallery__stage">
        <div className="gallery__hud">
          <span>
            {String(room).padStart(2, '0')} / {String(works.length).padStart(2, '0')}
          </span>
          <span>Use the arrows to walk the hall</span>
        </div>

        <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(-1)} aria-label="Previous artwork">
          ←
        </button>
        <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(1)} aria-label="Next artwork">
          →
        </button>

        <div className="gallery__hall" ref={hallRef}>
          {works.map((work) => {
            const pieces = getWorkPieces(work);
            const isGroup = pieces.length > 1;

            return (
              <article
                className={`gallery__room${isGroup ? ' gallery__room--group' : ''}`}
                key={work.id}
              >
                <div className={`gallery__pieces${isGroup ? ' gallery__pieces--duo' : ''}`}>
                  {pieces.map((piece) => (
                    <div className="gallery__piece" key={piece.id}>
                      <div className="gallery__frame">
                        {renderMedia(piece, 'gallery__media', work.title)}
                      </div>
                      {piece.label ? <p className="gallery__piece-label">{piece.label}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="gallery__plaque">
                  <p className="gallery__work-title">{work.title}</p>
                  <p className="gallery__work-meta">{work.medium}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
