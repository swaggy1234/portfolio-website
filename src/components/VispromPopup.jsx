import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  getScreenBounds,
  launchVispromMacApp,
} from '../utils/launchVispromApp';
import './VispromPopup.css';

async function resolvePdfBlobUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load presentation (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  if (header !== '%PDF-') {
    throw new Error('File is not a PDF (got the website instead)');
  }

  const blob = new Blob([buffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export default function VispromPopup({
  open,
  onClose,
  projectUrl = '',
  onlineUrl = '',
  paperUrl = '',
  paperTitle = 'Visprom++',
  title = 'Project',
  iframeTitle = 'Project preview',
  kind = 'iframe',
  githubUrl = '',
  description = '',
  vispromLaunchMode = 'app',
}) {
  const frameRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [view, setView] = useState('app');
  const [appLaunching, setAppLaunching] = useState(false);
  const [appLaunched, setAppLaunched] = useState(false);
  const [appLaunchError, setAppLaunchError] = useState('');

  const isVisprom = kind === 'visprom';
  const isPdf = kind === 'pdf' || (!isVisprom && projectUrl.toLowerCase().includes('.pdf'));
  const aboutParagraphs = Array.isArray(description)
    ? description.filter(Boolean)
    : description
      ? [description]
      : [];
  const resolvedOnlineUrl = onlineUrl || projectUrl;
  const resolvedPaperUrl = paperUrl || projectUrl;
  const activeContentUrl =
    view === 'paper' ? resolvedPaperUrl : view === 'online' ? resolvedOnlineUrl : '';

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setAppLaunched(false);
      setAppLaunchError('');
      return;
    }
    setView(isVisprom ? (vispromLaunchMode === 'online' ? 'online' : 'app') : isPdf ? 'pdf' : 'online');
    setAppLaunched(false);
    setAppLaunchError('');
  }, [open, isVisprom, isPdf, vispromLaunchMode]);

  const launchAppAtFrame = async () => {
    setAppLaunching(true);
    setAppLaunchError('');
    const bounds = getScreenBounds(frameRef.current);
    const launched = await launchVispromMacApp(bounds);
    setAppLaunching(false);
    if (launched) {
      setAppLaunched(true);
      return;
    }
    setAppLaunchError('Could not launch VisProm.app. Try Online or GitHub instead.');
  };

  useLayoutEffect(() => {
    if (!open || !isVisprom || view !== 'app') return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) launchAppAtFrame();
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isVisprom, view]);

  useEffect(() => {
    let revoked = '';
    let cancelled = false;

    const shouldLoadPdf =
      open &&
      ((isPdf && projectUrl) || (isVisprom && view === 'paper' && resolvedPaperUrl));

    if (!shouldLoadPdf) {
      setPdfUrl('');
      setPdfError('');
      setPdfLoading(false);
      return undefined;
    }

    const pdfSource = isVisprom ? resolvedPaperUrl : projectUrl;

    setPdfLoading(true);
    setPdfError('');
    setPdfUrl('');

    resolvePdfBlobUrl(pdfSource)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        revoked = blobUrl;
        setPdfUrl(blobUrl);
        setPdfLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setPdfError(error.message || 'Could not load presentation');
        setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, isPdf, isVisprom, projectUrl, resolvedPaperUrl, view]);

  if (!open) return null;
  if (!isVisprom && !projectUrl) return null;

  const openHref = pdfUrl || activeContentUrl || projectUrl;
  const showPdfFrame = (isPdf && !isVisprom) || (isVisprom && view === 'paper');

  return (
    <div className="visprom-popup" role="dialog" aria-modal="true" aria-labelledby="visprom-popup-title">
      <button
        type="button"
        className="visprom-popup__backdrop"
        aria-label="Close and return to portfolio"
        onClick={onClose}
      />

      <div className="visprom-popup__window">
        <div className="visprom-popup__titlebar">
          <span id="visprom-popup-title" className="visprom-popup__title">
            {title}
          </span>
          <div className="visprom-popup__controls">
            {githubUrl ? (
              <a
                className="visprom-popup__control visprom-popup__control--link"
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub repository"
                title="GitHub"
              >
                ⌘
              </a>
            ) : null}
            {activeContentUrl && view !== 'app' ? (
              <a
                className="visprom-popup__control visprom-popup__control--link"
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                title="Open in new tab"
              >
                ↗
              </a>
            ) : null}
            <button
              type="button"
              className="visprom-popup__control visprom-popup__control--close"
              aria-label="Close project"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {isVisprom ? (
          <div className="visprom-popup__tabs" role="tablist" aria-label="VisProm views">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'app'}
              className={`visprom-popup__tab${view === 'app' ? ' visprom-popup__tab--active' : ''}`}
              onClick={() => setView('app')}
            >
              Mac app
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'online'}
              className={`visprom-popup__tab${view === 'online' ? ' visprom-popup__tab--active' : ''}`}
              onClick={() => setView('online')}
            >
              Online
            </button>
            {resolvedPaperUrl ? (
              <button
                type="button"
                role="tab"
                aria-selected={view === 'paper'}
                className={`visprom-popup__tab${view === 'paper' ? ' visprom-popup__tab--active' : ''}`}
                onClick={() => setView('paper')}
              >
                {paperTitle}
              </button>
            ) : null}
          </div>
        ) : null}

        {aboutParagraphs.length ? (
          <div className="visprom-popup__about">
            <p className="visprom-popup__about-label">About this project</p>
            <div className="visprom-popup__about-body">
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}

        {isVisprom && view === 'app' ? (
          <div className="visprom-popup__app-hint">
            {appLaunching
              ? 'Opening VisProm and fitting it to the frame below…'
              : appLaunched
                ? 'VisProm is aligned to the dashed frame (where the online demo would be).'
                : 'The Mac app opens in the dashed frame below.'}
            <button
              type="button"
              className="visprom-popup__inline-link"
              onClick={launchAppAtFrame}
              disabled={appLaunching}
            >
              {appLaunching ? 'Opening…' : 'Re-open app'}
            </button>
            {appLaunchError ? <span className="visprom-popup__app-error"> · {appLaunchError}</span> : null}
          </div>
        ) : null}

        <div
          ref={frameRef}
          className={`visprom-popup__frame${isVisprom && view === 'app' ? ' visprom-popup__frame--app-slot' : ''}`}
        >
          {isVisprom && view === 'app' ? (
            <div className="visprom-popup__app-slot-label" aria-hidden="true">
              VisProm desktop window
            </div>
          ) : showPdfFrame ? (
            pdfLoading ? (
              <p className="visprom-popup__fallback">Loading {paperTitle}…</p>
            ) : pdfError ? (
              <p className="visprom-popup__fallback">
                {pdfError}.{' '}
                <a href={isVisprom ? resolvedPaperUrl : projectUrl} target="_blank" rel="noopener noreferrer">
                  Try opening the file
                </a>
              </p>
            ) : (
              <iframe
                key={pdfUrl}
                className="visprom-popup__iframe"
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                title={isVisprom && view === 'paper' ? paperTitle : iframeTitle}
              />
            )
          ) : (
            <iframe
              key={resolvedOnlineUrl}
              className="visprom-popup__iframe"
              src={resolvedOnlineUrl}
              title={iframeTitle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
