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

  const upcoming = useMemo(() => {
    const today = toISODate(new Date());
    return sorted.filter((h) => h.date >= today);
  }, [sorted]);

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const todayIso = toISODate(new Date());
  const monthHolidays = useMemo(
    () =>
      sorted.filter((h) => {
        const d = new Date(h.date);
        return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
      }),
    [sorted, currentMonth]
  );
  const nextUpcoming = upcoming[0];

  const isHoliday = (iso) => holidays.some((h) => h.date === iso);
  const getHolidayName = (iso) => holidays.find((h) => h.date === iso)?.name || 'Libur';

  const toggleHoliday = async (iso) => {
    if (!isAdmin) return;
    if (iso < todayIso) return; // tidak boleh masa lalu
    if (isHoliday(iso)) {
      const target = holidays.find((h) => h.date === iso);
      if (!target) return;
      try {
        await deleteHoliday(target.id);
        setHolidays((prev) => prev.filter((h) => h.id !== target.id));
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const created = await createHoliday({ date: iso, name: 'Libur Nasional' });
        setHolidays((prev) => [...prev, created]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const removeHoliday = async (id) => {
    if (!isAdmin) return;
    try {
      await deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
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
          <span className="font-semibold text-slate-900">{monthHolidays.length}</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-soft">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-slate-700">Libur terdekat: </span>
          <span className="font-semibold text-slate-900">
            {nextUpcoming ? `${nextUpcoming.name} (${nextUpcoming.date})` : '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              ‹
            </button>
            <div className="text-sm font-semibold text-slate-800 w-32 text-center">{monthLabel}</div>
            <button
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              ›
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
                      : isHoliday(day.iso)
                      ? 'bg-primary text-white border-primary hover:-translate-y-0.5 hover:shadow'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow'
                  } ${!isAdmin ? 'cursor-default' : ''}`}
                >
                  <span>{day.label}</span>
                  {isHoliday(day.iso) && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white/90" />
                  )}
                </button>
              ) : (
                <div key={`empty-${idx}`} />
              )
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daftar libur</h2>
              <p className="text-sm text-slate-500">Libur akan dikecualikan dari hitung hari kerja.</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
              {sorted.length} hari
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
                    <tr key={h.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-800 font-semibold">{h.date}</td>
                      <td className="px-4 py-2 text-slate-700">{h.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeHoliday(h.id)}
                            className="text-rose-500 text-sm font-semibold hover:underline"
                          >
                            Hapus
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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Libur mendatang</h2>
              <p className="text-sm text-slate-500">Urut berdasarkan tanggal terdekat.</p>
            </div>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
                Tidak ada libur terjadwal ke depan.
              </div>
            ) : (
              upcoming.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{h.name}</div>
                    <div className="text-xs text-slate-600">{h.date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayCalendar;
