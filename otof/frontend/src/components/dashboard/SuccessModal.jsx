const SuccessModal = ({ info, onClose }) => {
  if (!info) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Email terkirim!</h3>
        <p className="text-sm text-slate-600 mb-3">
          {info.message} ke {info.total} penerima.
        </p>
        <ul className="text-sm text-slate-600 space-y-1 mb-4">
          <li>- Lampiran KTP: {info.attachment ? 'terikut' : 'tidak ada'}</li>
          <li>- Template otomatis sudah menyesuaikan nama badan publik.</li>
        </ul>
        <button
          onClick={onClose}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;
