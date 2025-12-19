import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toISODate } from '../utils/workdays';
import { fetchHolidays, createHoliday, deleteHoliday } from '../services/holidays';

const startOfMonth = (date) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addMonths = (date, delta) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return startOfMonth(d);
};

const buildCalendarDays = (monthDate) => {
  const first = startOfMonth(monthDate);
  const startDay = first.getDay(); // 0-6
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(first.getFullYear(), first.getMonth(), d);
    days.push({ iso: toISODate(dateObj), label: d, dayOfWeek: dateObj.getDay() });
  }
  return days;
};

const HolidayCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [pendingAdds, setPendingAdds] = useState(() => new Set());
  const [pendingRemoves, setPendingRemoves] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchHolidays();
        setHolidays(res || []);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const sorted = useMemo(
    () =>
      [...holidays].sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? -1 : 1;
      }),
    [holidays]
  );

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const todayIso = toISODate(new Date());
  const holidayByDate = useMemo(() => {
    const map = {};
    holidays.forEach((h) => {
      map[h.date] = h;
    });
    return map;
  }, [holidays]);
  const isHoliday = (iso) => Boolean(holidayByDate[iso]);
  const isPendingAdd = (iso) => pendingAdds.has(iso);
  const isPendingRemove = (iso) => pendingRemoves.has(iso);
  const isEffectiveHoliday = (iso) =>
    (isHoliday(iso) && !isPendingRemove(iso)) || isPendingAdd(iso);
  const monthHolidays = useMemo(() => {
    const inMonth = (iso) => {
      const d = new Date(iso);
      return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
    };
    const baseCount = sorted.filter((h) => inMonth(h.date) && !isPendingRemove(h.date)).length;
    const addedCount = Array.from(pendingAdds).filter((iso) => inMonth(iso)).length;
    return baseCount + addedCount;
  }, [sorted, currentMonth, pendingAdds, pendingRemoves]);
  const totalHolidayCount = sorted.length - pendingRemoves.size + pendingAdds.size;
  const getHolidayName = (iso) => holidays.find((h) => h.date === iso)?.name || 'Libur';

  const toggleHoliday = (iso) => {
    if (!isAdmin) return;
    if (iso < todayIso) return; // tidak boleh masa lalu
    if (isEffectiveHoliday(iso)) {
      if (isPendingAdd(iso)) {
        setPendingAdds((prev) => {
          const next = new Set(prev);
          next.delete(iso);
          return next;
        });
      } else {
        setPendingRemoves((prev) => {
          const next = new Set(prev);
          if (next.has(iso)) {
            next.delete(iso);
          } else {
            next.add(iso);
          }
          return next;
        });
      }
      return;
    }
    if (isPendingRemove(iso)) {
      setPendingRemoves((prev) => {
        const next = new Set(prev);
        next.delete(iso);
        return next;
      });
      return;
    }
    setPendingAdds((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
  };

  const queueRemoveHoliday = (iso) => {
    if (!isAdmin) return;
    if (isPendingAdd(iso)) {
      setPendingAdds((prev) => {
        const next = new Set(prev);
        next.delete(iso);
        return next;
      });
      return;
    }
    setPendingRemoves((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
  };

  const saveChanges = async () => {
    if (!isAdmin) return;
    if (pendingAdds.size === 0 && pendingRemoves.size === 0) return;
    setSaving(true);
    try {
      const created = [];
      for (const iso of pendingAdds) {
        const res = await createHoliday({ date: iso, name: 'Libur Nasional' });
        if (res) created.push(res);
      }
      const removeIds = [];
      for (const iso of pendingRemoves) {
        const target = holidayByDate[iso];
        if (!target) continue;
        await deleteHoliday(target.id);
        removeIds.push(target.id);
      }
      setHolidays((prev) => {
        const filtered = prev.filter((h) => !removeIds.includes(h.id));
        return [...filtered, ...created];
      });
      setPendingAdds(new Set());
      setPendingRemoves(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Kelola daftar hari libur non-akhir pekan</p>
          <h1 className="text-2xl font-bold text-slate-900">Kalender Libur Nasional</h1>
          <p className="text-xs text-slate-500 mt-1">
            Admin dapat menambah/menghapus libur; user hanya dapat melihat.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-soft">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-slate-700">Libur bulan ini: </span>
          <span className="font-semibold text-slate-900">{monthHolidays}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pilih tanggal libur</h2>
              <p className="text-sm text-slate-500">Klik tanggal untuk menambah/menghapus libur.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
              >
                &lt;
              </button>
              <div className="text-sm font-semibold text-slate-800 w-32 text-center">{monthLabel}</div>
              <button
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
              >
                &gt;
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-[11px] text-slate-500 gap-1 transition-all duration-200 ease-out" key={monthLabel}>
            {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d) => (
              <div key={d} className="text-center py-1 font-semibold">
                {d}
              </div>
            ))}
            {days.map((day, idx) =>
              day ? (
                // Disable akhir pekan; hanya hari kerja yang bisa ditandai sebagai libur khusus
                <button
                  key={day.iso}
                  onClick={() => ![0, 6].includes(day.dayOfWeek) && day.iso >= todayIso && toggleHoliday(day.iso)}
                  disabled={!isAdmin || [0, 6].includes(day.dayOfWeek) || day.iso < todayIso}
                  title={isHoliday(day.iso) ? getHolidayName(day.iso) : undefined}
                  className={`relative py-2 text-sm rounded-lg border transition transform duration-150 ${
                    [0, 6].includes(day.dayOfWeek)
                      ? 'bg-rose-50 text-rose-500 border-rose-200 cursor-not-allowed'
                      : day.iso < todayIso
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : isEffectiveHoliday(day.iso)
                      ? isPendingRemove(day.iso)
                        ? 'bg-rose-50 text-rose-600 border-rose-200 hover:-translate-y-0.5 hover:shadow'
                        : 'bg-primary text-white border-primary hover:-translate-y-0.5 hover:shadow'
                      : isPendingAdd(day.iso)
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:-translate-y-0.5 hover:shadow'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow'
                  } ${!isAdmin ? 'cursor-default' : ''}`}
                >
                  <span>{day.label}</span>
                  {isEffectiveHoliday(day.iso) && !isPendingRemove(day.iso) && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white/90" />
                  )}
                </button>
              ) : (
                <div key={`empty-${idx}`} />
              )
            )}
          </div>
        </div>
        {(pendingAdds.size > 0 || pendingRemoves.size > 0) && (
          <div className="flex justify-end">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-soft hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
          </div>
        )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daftar libur</h2>
              <p className="text-sm text-slate-500">Libur akan dikecualikan dari hitung hari kerja.</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
              {totalHolidayCount} hari
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto border border-slate-100 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Tanggal</th>
                  <th className="px-4 py-2 text-left">Keterangan</th>
                  {isAdmin && <th className="px-4 py-2 text-left">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500 text-center" colSpan={isAdmin ? 3 : 2}>
                      Belum ada data libur.
                    </td>
                  </tr>
                ) : (
                  sorted.map((h) => (
                    <tr
                      key={h.id}
                      className={`border-t border-slate-100 ${isPendingRemove(h.date) ? 'bg-rose-50' : ''}`}
                    >
                      <td className="px-4 py-2 text-slate-800 font-semibold">{h.date}</td>
                      <td className="px-4 py-2 text-slate-700">{h.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => queueRemoveHoliday(h.date)}
                            className="text-rose-500 text-sm font-semibold hover:underline"
                          >
                            {isPendingRemove(h.date) ? 'Batal hapus' : 'Hapus'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HolidayCalendar;



