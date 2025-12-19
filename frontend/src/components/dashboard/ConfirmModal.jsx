const ConfirmModal = ({ open, selectedCount, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Kirim sekarang</h3>
        <p className="text-sm text-slate-600 mb-4">
          Pastikan data benar dan KTP sudah terlampir. Email akan dikirim ke {selectedCount} penerima.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold shadow-soft hover:bg-slate-800"
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
