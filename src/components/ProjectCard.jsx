import { motion } from 'framer-motion';
import './ProjectCard.css';

export default function ProjectCard({ project, index }) {
  return (
    <motion.article
      className="project-card"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <a
        href={project.link}
        className="project-card__link"
        target={project.link?.startsWith('http') || project.link?.startsWith('/') ? '_blank' : undefined}
        rel={project.link?.startsWith('http') || project.link?.startsWith('/') ? 'noopener noreferrer' : undefined}
      >
        <motion.div
          className={`project-card__image-wrap${project.imageFit === 'contain' ? ' project-card__image-wrap--contain' : ''}`}
          whileHover={{ y: -6 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <img
            src={project.image}
            alt={project.title}
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
          <h3 className="project-card__title">{project.title}</h3>
          <span className="project-card__cta">
            View project
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
        </motion.div>
      </a>
    </motion.article>
  );
}
