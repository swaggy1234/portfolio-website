import { useEffect, useState } from 'react';
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
  paperTitle = 'Visprom ++ Paper',
  title = 'Project',
  iframeTitle = 'Project preview',
  kind = 'iframe',
  githubUrl = '',
  description = '',
  vispromVersion = '',
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [view, setView] = useState('demo');

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
    view === 'paper' ? resolvedPaperUrl : view === 'demo' ? resolvedOnlineUrl : '';

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
    if (!open) return;
    setView(isVisprom ? 'demo' : isPdf ? 'pdf' : 'demo');
  }, [open, isVisprom, isPdf]);

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
            {activeContentUrl ? (
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
              aria-selected={view === 'demo'}
              className={`visprom-popup__tab${view === 'demo' ? ' visprom-popup__tab--active' : ''}`}
              onClick={() => setView('demo')}
            >
              Demo
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

        {isVisprom && vispromVersion ? (
          <p className="visprom-popup__version">
            Latest from GitHub · <code>{vispromVersion}</code>
          </p>
        ) : null}

        {aboutParagraphs.length && !isVisprom ? (
          <div className="visprom-popup__about">
            <p className="visprom-popup__about-label">About this project</p>
            <div className="visprom-popup__about-body">
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="visprom-popup__frame">
          {showPdfFrame ? (
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
          ) : resolvedOnlineUrl ? (
            <iframe
              key={resolvedOnlineUrl}
              className="visprom-popup__iframe"
              src={resolvedOnlineUrl}
              title={iframeTitle}
            />
          ) : (
            <p className="visprom-popup__fallback">Demo unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
