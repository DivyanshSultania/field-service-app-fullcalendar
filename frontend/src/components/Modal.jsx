import React from 'react';

export default function Modal({open, title, children, onClose}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{overflowY: 'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
}
