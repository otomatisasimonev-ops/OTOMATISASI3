const StatusCard = ({ label = 'Coming Soon' }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-soft p-5 col-span-1 lg:col-span-1 flex items-center justify-center">
    <span className="text-sm font-semibold text-slate-800 tracking-[0.8em] uppercase">{label}</span>
  </div>
);

export default StatusCard;
