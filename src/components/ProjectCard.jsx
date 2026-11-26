import { motion } from 'framer-motion';
import './ProjectCard.css';

export default function ProjectCard({ project, index, onOpenPopup }) {
  const opensStandalone = Boolean(project.openInNewWindow);
  const usesPopup = Boolean(project.popup) && !opensStandalone;
  const standaloneUrl = project.link || project.popupUrl || '';
  const href = opensStandalone
    ? standaloneUrl
    : usesPopup
      ? '#'
      : project.link || project.github || '#';
  const isExternal = opensStandalone || (!usesPopup && /^https?:\/\//.test(href));
  const ctaLabel = opensStandalone || usesPopup
    ? 'View project'
    : project.github
      ? 'View on GitHub'
      : 'View project';

  const handleClick = (event) => {
    if (opensStandalone && standaloneUrl) {
      event.preventDefault();
      window.open(
        standaloneUrl,
        'visprom',
        'width=1440,height=900,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes'
      );
      return;
    }
    if (!usesPopup) return;
    event.preventDefault();
    onOpenPopup?.(project);
  };

  return (
    <motion.article
      className="project-card"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <a
        href={href}
        className="project-card__link"
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        onClick={handleClick}
      >
        <motion.div
          className={`project-card__image-wrap${project.imageFit === 'contain' ? ' project-card__image-wrap--contain' : ''}`}
          whileHover={{ y: -6 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <img
            src={project.image}
            alt={project.imageAlt || project.title}
            className="project-card__image"
            loading="lazy"
          />
        </motion.div>

        <motion.div className="project-card__info">
          <div className="project-card__meta">
            <span>{project.category}</span>
            <span className="project-card__dot">·</span>
            <span>{project.year}</span>
          </div>
          <div className="project-card__head">
            <h3 className="project-card__title">{project.title}</h3>
            {project.subtitle ? (
              <p className="project-card__subtitle">{project.subtitle}</p>
            ) : null}
            {project.description ? (
              <div className="project-card__description">
                {(Array.isArray(project.description)
                  ? project.description
                  : [project.description]
                ).map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </div>
          <span className="project-card__cta">
            {ctaLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
        </motion.div>
      </a>
    </motion.article>
  );
}
