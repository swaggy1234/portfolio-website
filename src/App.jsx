import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Intro from './components/Intro';
import Hero from './components/Hero';
import ScrollFlowerVideo from './components/ScrollFlowerVideo';
import ProjectCard from './components/ProjectCard';
import Gallery from './components/Gallery';
import VispromPopup from './components/VispromPopup';
import RoboticsHighlights from './components/RoboticsHighlights';
import Resume from './components/Resume';
import About from './components/About';
import Experience from './components/Experience';
import Contact from './components/Contact';
import { projects, recommendations, siteConfig } from './data/siteContent';
import { projectMedia } from './data/projectMedia';
import { vispromSync } from './data/vispromSync';
import { LAYOUT_EDIT_MODE } from './data/layoutEdit';
import './styles/App.css';

function resolveProjectUrl(project) {
  if (!project) return '';
  if (project.popupAsset && projectMedia[project.popupAsset]) {
    return projectMedia[project.popupAsset];
  }
  if (project.popupPaperAsset && projectMedia[project.popupPaperAsset]) {
    return projectMedia[project.popupPaperAsset];
  }
  return project.popupUrl || project.link || '';
}

export default function App() {
  const [showIntro, setShowIntro] = useState(!LAYOUT_EDIT_MODE);
  const [popupProject, setPopupProject] = useState(null);
  const [galleryStage, setGalleryStage] = useState(null);
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

            <ScrollFlowerVideo galleryStage={galleryStage} />
            <Resume />

            <section className="section recommendations" aria-labelledby="recommendations-title">
              <div className="section__inner recommendations__inner">
                <div className="recommendations__header">
                  <h2 id="recommendations-title">Recommendations</h2>
                  <a href={`${siteConfig.social.linkedin}details/recommendations/?detailScreenTabIndex=0`} target="_blank" rel="noopener noreferrer">
                    Read on LinkedIn
                  </a>
                </div>
                <div className="recommendations__quotes">
                  {recommendations.map(({ name, role, profile, excerpt }) => (
                    <figure key={name}>
                      <blockquote cite={siteConfig.social.linkedin}>“{excerpt}”</blockquote>
                      <figcaption>
                        <a href={profile} target="_blank" rel="noopener noreferrer">{name}</a>
                        <span>{role}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>

            <section id="work" aria-labelledby="technical-work-title">
              <div className="section work">
                <div className="section__inner">
                  <p className="section__label">Selected Work</p>
                  <h2 className="section__title" id="technical-work-title">Technical Work</h2>
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
              </div>
              <RoboticsHighlights />
            </section>

            <Gallery stageRef={setGalleryStage} />

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
        onlineUrl={
          popupProject?.popup === 'visprom'
            ? vispromSync.demoUrl
            : popupProject?.popupUrl || popupProject?.link || ''
        }
        paperUrl={
          popupProject?.popupPaperAsset
            ? projectMedia[popupProject.popupPaperAsset] || ''
            : ''
        }
        paperTitle={popupProject?.popupPaperTitle || 'Visprom ++ Paper'}
        title={
          popupProject?.popupTitle ||
          [popupProject?.title, popupProject?.subtitle].filter(Boolean).join('  ·  ') ||
          'Project'
        }
        iframeTitle={popupProject?.title || 'Project preview'}
        kind={popupProject?.popup === 'pdf' ? 'pdf' : popupProject?.popup === 'visprom' ? 'visprom' : 'iframe'}
        githubUrl={popupProject?.github || ''}
        description={popupProject?.description || ''}
        vispromVersion={popupProject?.popup === 'visprom' ? vispromSync.shortSha : ''}
      />
    </>
  );
}
