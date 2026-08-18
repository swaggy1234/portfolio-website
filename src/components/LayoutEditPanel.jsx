import { useEffect, useState } from 'react';
import './LayoutEditPanel.css';

function getViewportLabel() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  return `${w} × ${h}`;
}

/**
 * Edit-mode controls — drag hero video, copy values into heroDesigns/experimental.js
 */
export default function LayoutEditPanel({
  stickers,
  layouts,
  videoLayout,
  editMode,
  editVideo = false,
  onAddFlower,
}) {
  const [status, setStatus] = useState('');
  const [screenLabel, setScreenLabel] = useState(getViewportLabel);

  useEffect(() => {
    if (!editMode) return undefined;
    const update = () => setScreenLabel(getViewportLabel());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [editMode]);

  if (!editMode) return null;

  const ref = videoLayout?.referenceViewport;
  const refLine = ref ? `  referenceViewport: { width: ${ref.width}, height: ${ref.height} },\n` : '';

  const videoSnippet = videoLayout
    ? `layout: {
  unit: 'viewport',
  xPercent: ${videoLayout.xPercent},
  yPercent: ${videoLayout.yPercent},
  widthPercent: ${videoLayout.widthPercent},
  aspectRatio: ${videoLayout.aspectRatio ?? 9 / 16},
  rotation: ${videoLayout.rotation ?? 0},
${refLine}},`
    : null;

  const copyVideoLayout = async () => {
    if (!videoSnippet) return;
    try {
      await navigator.clipboard.writeText(videoSnippet);
      setStatus('Video layout copied — paste into experimental.js heroVideo.layout');
    } catch {
      setStatus('Copy failed — select the layout block below manually');
    }
  };

  return (
    <aside className="layout-edit-panel">
      {editVideo && videoLayout ? (
        <div className="layout-edit-panel__section">
          <p className="layout-edit-panel__label">
            Koi sticker — drag the dashed box, top circle to rotate, corner to resize.
          </p>
          <p className="layout-edit-panel__screen">
            Use <strong>Safari</strong> at full window size (not Cursor preview).
            <br />
            Screen: <strong>{screenLabel}</strong>
            {ref ? (
              <>
                {' '}
                · saved for <strong>{ref.width} × {ref.height}</strong>
              </>
            ) : null}
          </p>
          <button type="button" className="layout-edit-panel__save" onClick={copyVideoLayout}>
            Copy video layout
          </button>
          <pre className="layout-edit-panel__code">{videoSnippet}</pre>
        </div>
      ) : null}

      {stickers.length > 0 ? (
        <div className="layout-edit-panel__actions">
          <button
            type="button"
            className="layout-edit-panel__add"
            onClick={() => onAddFlower('flower')}
          >
            + Pink flower
          </button>
          <button
            type="button"
            className="layout-edit-panel__add"
            onClick={() => onAddFlower('flower2')}
          >
            + Columbine
          </button>
        </div>
      ) : null}

      {status ? <p className="layout-edit-panel__status">{status}</p> : null}
    </aside>
  );
}
