const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  const base =
    toast.type === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-700'
      : toast.type === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`px-4 py-3 rounded-2xl border shadow-soft max-w-sm ${base}`}>
        <div className="flex items-start gap-3">
          <div className="text-sm font-semibold flex-1">{toast.message}</div>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onClick}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800"
            aria-label="Tutup"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
