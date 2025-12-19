export const toISODate = (date) => {
  if (!(date instanceof Date)) return '';
  const off = date.getTimezoneOffset();
  const corrected = new Date(date.getTime() - off * 60000);
  return corrected.toISOString().slice(0, 10);
};

export const addBusinessDays = (startDate, days, holidays = []) => {
  if (!startDate || Number.isNaN(new Date(startDate).getTime())) return null;
  const holidaySet = new Set(holidays.map((h) => h.date));
  let current = new Date(startDate);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    const iso = toISODate(current);
    if (day === 0 || day === 6 || holidaySet.has(iso)) continue;
    added += 1;
  }
  return current;
};

export const computeDueInfo = ({ startDate, baseDays = 10, extraDays = 0, holidays = [] }) => {
  if (!startDate) return { dueDate: null, dueDateLabel: '-', daysLeft: null, overdue: false };
  const due = addBusinessDays(startDate, baseDays + extraDays, holidays);
  if (!due) return { dueDate: null, dueDateLabel: '-', daysLeft: null, overdue: false };
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return {
    dueDate: due,
    dueDateLabel: toISODate(due),
    daysLeft: diffDays,
    overdue: diffDays < 0
  };
};
