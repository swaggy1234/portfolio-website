import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Intro from './components/Intro';
import Hero from './components/Hero';
import ScrollMonogram from './components/ScrollMonogram';
import ProjectCard from './components/ProjectCard';
import About from './components/About';
import Experience from './components/Experience';
import Contact from './components/Contact';
import { projects } from './data/siteContent';
import './styles/App.css';

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const heroRef = useRef(null);

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  return (
    <>
      <div className="grain-overlay" aria-hidden="true" />

      {showIntro && <Intro onComplete={handleIntroComplete} />}

      <AnimatePresence>
        {!showIntro && (
          <motion.main
            className="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="hero-stage" ref={heroRef}>
              <Hero stageRef={heroRef} />
            </div>

            <ScrollMonogram />

            <section className="section work" id="work">
              <div className="section__inner">
                <p className="section__label">Selected Work</p>
                <h2 className="section__title">Projects</h2>
                <div className="work__grid">
                  {projects.map((project, index) => (
                    <ProjectCard key={project.id} project={project} index={index} />
                  ))}
                </div>
              </div>
            </section>

            <About />
            <Experience />
            <Contact />
          </motion.main>
        )}
      </AnimatePresence>
    </>
  );
}
