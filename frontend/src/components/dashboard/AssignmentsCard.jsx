const AssignmentsCard = ({ assignments = [], onOpenModal }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-5 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">Akses penugasan</p>
        <h2 className="text-lg font-bold text-slate-900">Anda ditugaskan ke {assignments.length} badan publik</h2>
      </div>
      {assignments.length > 0 && (
        <button
          onClick={onOpenModal}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Lihat semua
        </button>
      )}
    </div>
    {assignments.length === 0 ? (
      <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        Belum ada penugasan. Hubungi admin agar Anda mendapat akses badan publik.
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {assignments.slice(0, 6).map((a) => (
          <div
            key={a.badan_publik_id}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700"
          >
            <div className="font-semibold text-slate-900">{a.badanPublik?.nama_badan_publik}</div>
            <div className="text-xs text-slate-500">{a.badanPublik?.kategori}</div>
          </div>
        ))}
        {assignments.length > 6 && (
          <div className="px-3 py-2 text-sm text-slate-500">+{assignments.length - 6} lainnya</div>
        )}
      </div>
    )}
  </div>
);

export default AssignmentsCard;
