import { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import PromptModal from '../components/PromptModal';

const DialogContext = createContext(null);

const defaultConfirm = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
  onConfirm: null,
};

const defaultPrompt = {
  open: false,
  title: '',
  message: '',
  defaultValue: '',
  placeholder: '',
  submitLabel: 'OK',
  cancelLabel: 'Cancel',
  onSubmit: null,
};

export function DialogProvider({ children }) {
  const [confirmState, setConfirmState] = useState(defaultConfirm);
  const [promptState, setPromptState] = useState(defaultPrompt);

  const showConfirm = useCallback((options = {}) => {
    setConfirmState({
      open: true,
      title: options.title ?? '',
      message: options.message ?? 'Are you sure?',
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      destructive: options.destructive ?? false,
      onConfirm: options.onConfirm ?? (() => {}),
    });
  }, []);

  const showPrompt = useCallback((options = {}) => {
    setPromptState({
      open: true,
      title: options.title ?? '',
      message: options.message ?? '',
      defaultValue: options.defaultValue ?? '',
      placeholder: options.placeholder ?? '',
      submitLabel: options.submitLabel ?? 'OK',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      onSubmit: options.onSubmit ?? (() => {}),
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(defaultConfirm);
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState(defaultPrompt);
  }, []);

  const value = {
    showConfirm,
    showPrompt,
    confirmState,
    promptState,
    setConfirmState,
    setPromptState,
    closeConfirm,
    closePrompt,
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        destructive={confirmState.destructive}
        onConfirm={confirmState.onConfirm}
        onClose={closeConfirm}
      />
      <PromptModal
        open={promptState.open}
        title={promptState.title}
        message={promptState.message}
        defaultValue={promptState.defaultValue}
        placeholder={promptState.placeholder}
        submitLabel={promptState.submitLabel}
        cancelLabel={promptState.cancelLabel}
        onSubmit={promptState.onSubmit}
        onClose={closePrompt}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    return {
      showConfirm: () => {},
      showPrompt: () => {},
      confirmState: { open: false },
      promptState: { open: false },
      closeConfirm: () => {},
      closePrompt: () => {},
    };
  }
  return ctx;
}
