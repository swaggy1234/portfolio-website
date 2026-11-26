import { motion } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import './Contact.css';

function openInquiryEmail(event) {
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  const subject = `Project inquiry: ${fields.get('project').trim()}`;
  const body = [
    `Name: ${fields.get('name').trim()}`,
    `Email: ${fields.get('email').trim()}`,
    '',
    fields.get('details').trim(),
  ].join('\r\n');

  window.location.href = `${siteConfig.social.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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
          I&apos;m available for creative technology contracts, interactive projects, and collaborations.
        </p>

        <form className="contact__inquiry" onSubmit={openInquiryEmail} aria-labelledby="inquiry-title">
          <h3 id="inquiry-title">Project inquiries</h3>
          <div className="contact__inquiry-fields">
            <label>
              Name
              <input name="name" autoComplete="name" required maxLength={100} />
            </label>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required maxLength={160} />
            </label>
          </div>
          <label>
            Project name or type
            <input name="project" placeholder="e.g. Interactive installation" required maxLength={120} />
          </label>
          <label>
            What are you working on?
            <textarea name="details" rows={5} placeholder="Tell me about the idea, timeline, and budget if you have one." required maxLength={1200} />
          </label>
          <button type="submit">Open email draft</button>
        </form>

        <a href={siteConfig.social.email} className="contact__email">
          {siteConfig.email}
        </a>

        <div className="contact__links">
          <a href={siteConfig.social.resume} target="_blank" rel="noopener noreferrer">
            Resume
          </a>
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
