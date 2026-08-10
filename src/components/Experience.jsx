import { motion } from 'framer-motion';
import { experienceItems } from '../data/siteContent';
import './Experience.css';

export default function Experience() {
  return (
    <section className="section experience" id="experience">
      <motion.div
        className="section__inner"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <p className="section__label">Experience & Skills</p>
        <h2 className="section__title">What I do</h2>

        <motion.div className="experience__grid">
          {experienceItems.map((item, index) => (
            <motion.div
              key={item.title}
              className="experience__item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <span className="experience__number">0{index + 1}</span>
              <h3 className="experience__title">{item.title}</h3>
              <p className="experience__desc">{item.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
