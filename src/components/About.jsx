import { motion } from 'framer-motion';
import { aboutContent } from '../data/siteContent';
import './About.css';

export default function About() {
  return (
    <section className="section about" id="about">
      <div className="section__inner">
        <motion.p
          className="section__label"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {aboutContent.heading}
        </motion.p>

        <div className="about__grid">
          <motion.h2
            className="section__title about__title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            Crafting thoughtful
            <br />
            experiences with data
          </motion.h2>

          <motion.div
            className="about__text"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            {aboutContent.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
