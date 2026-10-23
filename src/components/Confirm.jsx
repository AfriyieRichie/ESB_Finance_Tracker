import { useState, useCallback } from 'react';

// Confirmation dialog for destructive actions.
// const [confirm, confirmDialog] = useConfirm();  …  if (await confirm({ title, message })) doIt();
// and render {confirmDialog} somewhere in the component.
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise(resolve => setState({ ...opts, resolve })), []);
  const close = (answer) => { state?.resolve(answer); setState(null); };
  const dialog = state && (
    <div className="modal-overlay" onClick={() => close(false)}>
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{state.title}</h3>
        {state.message && <p className="confirm-msg">{state.message}</p>}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => close(false)} autoFocus>Cancel</button>
          <button type="button" className="btn-primary btn-danger" onClick={() => close(true)}>
            {state.confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
  return [confirm, dialog];
}
