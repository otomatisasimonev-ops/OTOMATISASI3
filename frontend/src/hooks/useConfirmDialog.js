import { useState } from 'react';

const useConfirmDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Konfirmasi',
    cancelLabel: 'Batal',
    tone: 'default',
    loading: false,
    onConfirm: null
  });

  const openConfirm = (config) => {
    setConfirmDialog({
      open: true,
      title: config.title || 'Konfirmasi',
      message: config.message || '',
      confirmLabel: config.confirmLabel || 'Konfirmasi',
      cancelLabel: config.cancelLabel || 'Batal',
      tone: config.tone || 'default',
      loading: false,
      onConfirm: config.onConfirm || null
    });
  };

  const closeConfirm = () => {
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
      loading: false,
      onConfirm: null
    }));
  };

  const handleConfirm = async () => {
    if (!confirmDialog.onConfirm) {
      closeConfirm();
      return;
    }
    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    try {
      await confirmDialog.onConfirm();
    } finally {
      closeConfirm();
    }
  };

  return {
    confirmDialog,
    openConfirm,
    closeConfirm,
    handleConfirm,
    setConfirmDialog
  };
};

export default useConfirmDialog;
