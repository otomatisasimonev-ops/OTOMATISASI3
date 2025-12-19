const QuotaCard = ({ quota, quotaRequests = [], onRequest }) => {
  const percent =
    quota && quota.daily_quota ? Math.min(100, Math.round((quota.used_today / quota.daily_quota) * 100)) : 0;
  const lastRequest = quotaRequests[0];

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Kuota harian</div>
            <div className="text-xs text-slate-600">
              {quota
                ? `${quota.used_today}/${quota.daily_quota} terpakai (sisa ${quota.remaining ?? quota.daily_quota - quota.used_today})`
                : 'Memuat...'}
            </div>
          </div>
          <button
            onClick={onRequest}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Ajukan kuota
          </button>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
          {lastRequest && (
            <span
              className={`text-[11px] px-2 py-1 rounded-full ${
                lastRequest.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : lastRequest.status === 'rejected'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              Permintaan terakhir: {lastRequest.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotaCard;
