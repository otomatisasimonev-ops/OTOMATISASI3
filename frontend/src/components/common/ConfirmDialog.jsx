const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel
}) => {
  if (!open) return null;
  const toneClasses =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : tone === 'primary'
      ? 'bg-primary hover:bg-emerald-700'
      : 'bg-slate-900 hover:bg-slate-800';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {message && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl text-white font-semibold shadow-soft disabled:opacity-60 ${toneClasses}`}
            disabled={loading}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
