'use client';
import { useState, useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Promise-based confirmation using the app's themed ConfirmDialog instead of the
 * native window.confirm(). Usage:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   const onDelete = async () => {
 *     if (!(await confirm('Delete this item?'))) return;
 *     ... // proceed
 *   };
 *   return (<>... {confirmDialog} </>);
 *
 * confirm() accepts a string (used as the message) or { title, message, confirmText, type }.
 */
export default function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts = {}) => {
    const o = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => {
      setState({
        title: o.title || 'Are you sure?',
        message: o.message || '',
        confirmText: o.confirmText || 'Proceed',
        type: o.type || 'danger',
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    setState((s) => { s?.resolve(result); return null; });
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={!!state}
      title={state?.title}
      message={state?.message}
      confirmText={state?.confirmText}
      type={state?.type}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
    />
  );

  return { confirm, confirmDialog };
}
