import React, { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { trapFocus } from '@core/input/focusTrap.js';

export const TextWindowModal: React.FC = () => {
  const activeTextModal = useGameStore((state) => state.activeTextModal);
  const setTextModal = useGameStore((state) => state.setTextModal);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const closeTextModal = useCallback(() => {
    if (activeTextModal && activeTextModal.resolver) {
      const res = activeTextModal.resolver;
      setTextModal(null);
      res.respond(0);
    }
  }, [activeTextModal, setTextModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTextModal) return;

      if (e.key === 'Tab') {
        if (modalContentRef.current) {
          trapFocus(modalContentRef.current, e);
          return;
        }
      }

      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        closeTextModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTextModal, closeTextModal]);

  if (!activeTextModal) return null;

  return (
    <div className="modal-backdrop">
      <div ref={modalContentRef} className="modal-content">
        <h3 className="modal-title">{activeTextModal.title || 'Information / Help'}</h3>

        <div className="text-body">
          {activeTextModal.lines.map((line, idx) => (
            <div key={idx} className="text-line">
              {line}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button onClick={closeTextModal} className="btn btn-primary">
            OK (Enter / Space / ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
