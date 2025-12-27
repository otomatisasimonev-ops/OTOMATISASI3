const SenderInfoModal = ({ sender, onClose }) => {
  if (!sender) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Pengirim</h3>
            <p className="text-sm text-slate-500">Detail informasi pengirim</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-xl font-bold"
            aria-label="Tutup"
          >
            x
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <div className="text-xs text-slate-500">Nama</div>
            <div className="font-semibold text-slate-900">{sender.username || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Email</div>
            <div className="font-semibold text-slate-900">{sender.email || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Nomor HP</div>
            <div className="font-semibold text-slate-900">{sender.nomer_hp || '-'}</div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold shadow-soft hover:bg-slate-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default SenderInfoModal;
