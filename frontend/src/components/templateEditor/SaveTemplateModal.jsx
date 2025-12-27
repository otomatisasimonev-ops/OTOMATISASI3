const SaveTemplateModal = ({ open, overwriteWarning, onConfirm, onCancel }) => {
  if (!open) return null;
  const isOverwrite = overwriteWarning.includes('menimpa');
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Simpan template</h3>
            <p className="text-sm text-slate-600">
              Perubahan akan {isOverwrite ? 'menimpa template ini.' : 'membuat template baru.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-800 text-xl font-bold"
            aria-label="Tutup"
          >
            x
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
          >
            Ya, simpan
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveTemplateModal;
