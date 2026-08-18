import { motion } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import './Contact.css';

export default function Contact() {
  return (
    <section className="section contact" id="contact">
      <motion.div
        className="section__inner contact__inner"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <p className="section__label">Contact</p>
        <h2 className="section__title contact__title">
          Let&apos;s create
          <br />
          something together
        </h2>
        <p className="contact__text">
          I&apos;m open to collaborations, research opportunities, and creative projects.
          Reach out. I&apos;d love to hear from you.
        </p>

        <a href={siteConfig.social.email} className="contact__email">
          {siteConfig.email}
        </a>

        <div className="contact__links">
          <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href={siteConfig.social.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        </div>
      </motion.div>

      <footer className="contact__footer">
        <span className="monogram monogram--dark contact__monogram">
          <span className="monogram__s">S</span>
          <span className="monogram__a">A</span>
        </span>
        <p>&copy; {new Date().getFullYear()} {siteConfig.name}</p>
      </footer>
    </section>
  );
}
