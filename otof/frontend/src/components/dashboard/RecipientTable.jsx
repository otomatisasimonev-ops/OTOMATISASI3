import { computeDueInfo } from '../../utils/workdays';

const RecipientTable = ({
  badan,
  selectedIds,
  loading,
  toggleAll,
  toggleSelect,
  filterText,
  setFilterText,
  filterKategori,
  setFilterKategori,
  filterStatus,
  setFilterStatus,
  categories = [],
  statuses = [],
  selectFiltered,
  clearSelection,
  holidays = [],
  monitoringMap = {},
  onUpdateMonitoring
}) => {
  const holidayList = holidays || [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Data Badan Publik</h2>
            <p className="text-sm text-slate-500">Pilih penerima untuk dikirimi permohonan.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={selectFiltered}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              Pilih sesuai filter
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              Hapus pilihan
            </button>
            <button
              onClick={toggleAll}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              {selectedIds.length === badan.length && badan.length > 0 ? 'Batal pilih semua' : 'Pilih semua'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Cari nama/kategori/email/pertanyaan"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">Semua status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === badan.length && badan.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Pertanyaan</th>
              <th className="px-4 py-3 text-left">Sent</th>
              <th className="px-4 py-3 text-left">Tenggat</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  Memuat data...
                </td>
              </tr>
            ) : badan.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  Belum ada data badan publik.
                </td>
              </tr>
            ) : (
              badan.map((item, idx) => {
                const monitor = monitoringMap[item.id] || {};
                const startDate = monitor.startDate || '';
                const dueInfo = computeDueInfo({
                  startDate,
                  baseDays: 10,
                  extraDays: monitor.extraDays ? 7 : 0,
                  holidays: holidayList
                });

                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-primary/5 transition`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-slate-700">{item.kategori}</td>
                    <td className="px-4 py-3 text-slate-700">{item.email}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-3xl whitespace-pre-wrap">{item.pertanyaan}</td>
                    <td className="px-4 py-3 text-slate-700">{item.sent_count}</td>
                    <td className="px-4 py-3 text-slate-700 space-y-2 min-w-[220px]">
                      <div className="text-xs text-slate-600">
                        Tanggal kirim:{' '}
                        <span className="font-semibold text-slate-800">{startDate || '-'}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Jatuh tempo:{' '}
                        <span className="font-semibold text-slate-800">{dueInfo.dueDateLabel || '-'}</span>{' '}
                        {dueInfo.daysLeft != null && dueInfo.dueDateLabel && (
                          <span className={dueInfo.overdue ? 'text-rose-600' : 'text-slate-600'}>
                            ({dueInfo.daysLeft} hari lagi)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecipientTable;
