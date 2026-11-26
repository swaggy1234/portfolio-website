import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { siteConfig } from '../data/siteContent';
import './Contact.css';

const inquiryEndpoint = 'https://formspree.io/f/mbgobpzz';

export default function Contact() {
  const [status, setStatus] = useState('idle');
  const sending = useRef(false);

  async function sendInquiry(event) {
    event.preventDefault();
    if (sending.current) return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    fields.set('subject', `Project inquiry: ${fields.get('project').trim()}`);
    sending.current = true;
    setStatus('sending');

    try {
      const response = await fetch(inquiryEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fields,
      });
      if (!response.ok) throw new Error('Inquiry submission failed');
      form.reset();
      setStatus('sent');
    } catch {
      setStatus('error');
    } finally {
      sending.current = false;
    }
  }

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

        <form className="contact__inquiry" onSubmit={sendInquiry} aria-labelledby="inquiry-title">
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
            <textarea name="message" rows={5} placeholder="Tell me about the idea, timeline, and budget if you have one." required maxLength={1200} />
          </label>
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send inquiry'}
          </button>
          <p className="contact__inquiry-status" role="status">
            {status === 'sent' && 'Thanks. Your inquiry was sent.'}
            {status === 'error' && 'Your inquiry could not be sent. Please try again.'}
          </p>
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
