import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Intro from './components/Intro';
import Hero from './components/Hero';
import ScrollFlowerVideo from './components/ScrollFlowerVideo';
import ProjectCard from './components/ProjectCard';
import Gallery from './components/Gallery';
import VispromPopup from './components/VispromPopup';
import About from './components/About';
import Experience from './components/Experience';
import Contact from './components/Contact';
import { projects } from './data/siteContent';
import { projectMedia } from './data/projectMedia';
import { LAYOUT_EDIT_MODE } from './data/layoutEdit';
import './styles/App.css';

function resolveProjectUrl(project) {
  if (!project) return '';
  if (project.popupAsset && projectMedia[project.popupAsset]) {
    return projectMedia[project.popupAsset];
  }
  return project.popupUrl || project.link || '';
}

export default function App() {
  const [showIntro, setShowIntro] = useState(!LAYOUT_EDIT_MODE);
  const [popupProject, setPopupProject] = useState(null);
  const heroRef = useRef(null);

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handleOpenPopup = useCallback((project) => {
    if (project?.popup) {
      setPopupProject(project);
    }
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

            <ScrollFlowerVideo />

            <section className="section work" id="work">
              <div className="section__inner">
                <p className="section__label">Selected Work</p>
                <h2 className="section__title">Projects</h2>
                <div className="work__grid">
                  {projects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      index={index}
                      onOpenPopup={handleOpenPopup}
                    />
                  ))}
                </div>
              </div>
            </section>

            <Gallery />

            <About />
            <Experience />
            <Contact />
          </motion.main>
        )}
      </AnimatePresence>

      <VispromPopup
        open={Boolean(popupProject)}
        onClose={() => setPopupProject(null)}
        projectUrl={resolveProjectUrl(popupProject)}
        title={
          popupProject?.popupTitle ||
          [popupProject?.title, popupProject?.subtitle].filter(Boolean).join('  ·  ') ||
          'Project'
        }
        iframeTitle={popupProject?.title || 'Project preview'}
        kind={popupProject?.popup === 'pdf' ? 'pdf' : 'iframe'}
        githubUrl={popupProject?.github || ''}
        description={popupProject?.description || ''}
      />
    </>
  );
}
