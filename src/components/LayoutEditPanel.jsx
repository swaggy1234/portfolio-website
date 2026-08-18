import { useState } from 'react';
import { STICKER_LAYOUTS, STICKER_TEMPLATES } from '../data/layoutEdit';
import './LayoutEditPanel.css';

/**
 * Edit-mode controls — add flowers, save locks placements into layoutEdit.js
 */
export default function LayoutEditPanel({ stickers, layouts, editMode, onAddFlower }) {
  const [status, setStatus] = useState('');

  if (!editMode) return null;

  const save = async () => {
    setStatus('Saving…');
    try {
      const layoutPayload = {};

      stickers.forEach(({ id, type }) => {
        const template = STICKER_TEMPLATES[type];
        const base = STICKER_LAYOUTS[id] || {
          xPercent: 40,
          yPercent: 40,
          widthPercent: 12,
          rotation: 0,
          flipX: false,
          aspectRatio: template?.aspectRatio ?? 1,
        };
        const live = layouts?.[id] || {};

        layoutPayload[id] = {
          xPercent: live.xPercent ?? base.xPercent,
          yPercent: live.yPercent ?? base.yPercent,
          widthPercent: live.widthPercent ?? base.widthPercent,
          rotation: live.rotation ?? base.rotation ?? 0,
          flipX: live.flipX ?? base.flipX ?? false,
          aspectRatio: live.aspectRatio ?? base.aspectRatio ?? template?.aspectRatio ?? 1,
        };
      });

      const res = await fetch('/__lock-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stickers: stickers.map(({ id, type }) => ({ id, type })),
          layouts: layoutPayload,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Save failed');

      setStatus('Saved. Refresh the page.');
    } catch (error) {
      setStatus('Save failed');
      console.error(error);
    }
  };

  return (
    <aside className="layout-edit-panel">
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
        <button type="button" className="layout-edit-panel__save" onClick={save}>
          Save layout
        </button>
      </div>
      {status ? <p className="layout-edit-panel__status">{status}</p> : null}
    </aside>
  );
}
