import { computeDueInfo } from '../../utils/workdays';

const isValidEmail = (val) => {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
};

const truncateQuestion = (text, max = 64) => {
  if (!text) return '';
  const cleaned = String(text || '').trim();
  if (cleaned.length <= max) return cleaned;
  const sliced = cleaned.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > 0) {
    return `${sliced.slice(0, lastSpace).trim()}...`;
  }
  return `${sliced.trim()}...`;
};

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
  const validIds = badan.filter((b) => isValidEmail(b.email)).map((b) => b.id);
  const allValidSelected = validIds.length > 0 && validIds.every((id) => selectedIds.includes(id));

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
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allValidSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Nama</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Kategori</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Email</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Pertanyaan</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em]">Sent</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.08em]">Tenggat</th>
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
                const emailValid = isValidEmail(item.email);
                const dueInfo = computeDueInfo({
                  startDate,
                  baseDays: 10,
                  extraDays: monitor.extraDays ? 7 : 0,
                  holidays: holidayList
                });

                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-primary/5 transition ${
                      emailValid ? '' : 'opacity-60'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        disabled={!emailValid}
                        title={!emailValid ? 'Email kosong / tidak valid' : undefined}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-[12px] text-slate-900">{item.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">{item.kategori}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">
                      {emailValid ? item.email : <span className="text-slate-400 italic">Tidak ada email</span>}
                    </td>
                    <td
                      className="px-4 py-3 text-[12px] text-slate-700 max-w-[220px] overflow-hidden whitespace-nowrap text-ellipsis"
                      title={item.pertanyaan || '-'}
                    >
                      {truncateQuestion(item.pertanyaan, 64) || '-'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">{item.sent_count}</td>
                    <td className="px-3 py-2 text-[9px] text-slate-700 min-w-[220px]">
                      <div className="leading-snug text-slate-600">
                        <span className="font-semibold text-slate-800">Tanggal kirim</span>:{' '}
                        <span>{startDate || '-'}</span>
                      </div>
                      <div className="leading-snug text-slate-600">
                        <span className="font-semibold text-slate-800">Jatuh tempo</span>:{' '}
                        <span>{dueInfo.dueDateLabel || '-'}</span>{' '}
                        {dueInfo.daysLeft != null && dueInfo.dueDateLabel && (
                          <span className={dueInfo.overdue ? 'text-rose-600' : 'text-slate-600'}>
                            ({dueInfo.daysLeft} hari)
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
