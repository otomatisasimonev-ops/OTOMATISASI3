const accentMap = {
  emerald: { text: 'text-emerald-700', dot: 'bg-emerald-400', chip: 'bg-emerald-50 border-emerald-100' },
  sky: { text: 'text-sky-700', dot: 'bg-sky-400', chip: 'bg-sky-50 border-sky-100' },
  amber: { text: 'text-amber-700', dot: 'bg-amber-400', chip: 'bg-amber-50 border-amber-100' },
  slate: { text: 'text-slate-700', dot: 'bg-slate-400', chip: 'bg-slate-50 border-slate-200' }
};

const StatsGrid = ({ cards, loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-200 shadow-soft hover:shadow-lg transition transform hover:-translate-y-1"
        >
          <div className="absolute inset-x-0 -top-6 h-16 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 text-[11px] px-3 py-1 rounded-full bg-sand-50 text-slate-600 border border-slate-200">
            {card.source || 'API'} · {card.updatedAt || 'real-time'}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${accentMap[card.accent]?.dot || 'bg-slate-300'} animate-pulse`}
            />
            <div className="text-xs uppercase text-slate-500 font-semibold">{card.title}</div>
          </div>
          <div className="text-4xl font-bold text-slate-900 mt-2">{loading ? '...' : card.value}</div>
          <div
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[12px] border ${
              accentMap[card.accent]?.chip || 'bg-slate-50 border-slate-200'
            } mt-2`}
          >
            <span className={accentMap[card.accent]?.text || 'text-slate-700'}>{card.hint}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
