const RoleChangeModal = ({ user, loading, onCancel, onConfirm }) => {
  if (!user) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Ubah role</h3>
            <p className="text-sm text-slate-600">
              User <span className="font-semibold text-slate-900">{user.username}</span> sekarang{' '}
              <span className="font-semibold text-slate-900">{user.role}</span>. Ganti?
            </p>
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Peringatan: mengganti role akan mengubah akses halaman dan hak admin. Pastikan Anda memilih user yang benar.
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold"
            aria-label="Tutup"
          >
            x
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-soft hover:bg-rose-700 disabled:opacity-60"
          >
            {loading ? 'Memproses...' : 'Ganti role'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleChangeModal;
