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
  title = 'Project',
  iframeTitle = 'Project preview',
  kind = 'iframe',
  githubUrl = '',
  description = '',
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const isPdf = kind === 'pdf' || projectUrl.toLowerCase().includes('.pdf');
  const aboutParagraphs = Array.isArray(description)
    ? description.filter(Boolean)
    : description
      ? [description]
      : [];

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
    let revoked = '';
    let cancelled = false;

    if (!open || !isPdf || !projectUrl) {
      setPdfUrl('');
      setPdfError('');
      setPdfLoading(false);
      return undefined;
    }

    setPdfLoading(true);
    setPdfError('');
    setPdfUrl('');

    resolvePdfBlobUrl(projectUrl)
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
  }, [open, isPdf, projectUrl]);

  if (!open || !projectUrl) return null;

  const openHref = pdfUrl || projectUrl;

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

        <div className="visprom-popup__frame">
          {isPdf ? (
            pdfLoading ? (
              <p className="visprom-popup__fallback">Loading presentation…</p>
            ) : pdfError ? (
              <p className="visprom-popup__fallback">
                {pdfError}.{' '}
                <a href={projectUrl} target="_blank" rel="noopener noreferrer">
                  Try opening the file
                </a>
              </p>
            ) : (
              <iframe
                key={pdfUrl}
                className="visprom-popup__iframe"
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                title={iframeTitle}
              />
            )
          ) : (
            <iframe
              key={projectUrl}
              className="visprom-popup__iframe"
              src={projectUrl}
              title={iframeTitle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
