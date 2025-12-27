const LogDetailModal = ({ log, onClose, onRetry, retryingId, openGmail, statusBadge, formatDate }) => {
  if (!log) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4 border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Detail Log</h3>
            <p className="text-sm text-slate-500">
              {formatDate(log.sent_at)} - {log.user?.username}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-xl font-bold"
            aria-label="Tutup"
          >
            x
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-600">Pengirim</div>
            <div className="font-semibold text-slate-900">{log.user?.username || '-'}</div>
            <div className="text-sm text-slate-600">Target</div>
            <div className="font-semibold text-slate-900">
              {log.badanPublik?.nama_badan_publik || '-'}
            </div>
            <div className="text-sm text-slate-600">Subjek</div>
            <div className="font-semibold text-slate-900">{log.subject}</div>
            <div className="text-sm text-slate-600">Message ID</div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 break-all">
                {log.message_id || '-'}
              </span>
              {log.message_id && (
                <button
                  onClick={() => openGmail(log.message_id)}
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  Buka di Gmail
                </button>
              )}
            </div>
            {log.retry_of_id && (
              <div className="text-xs text-slate-500">
                Retry dari log #{log.retry_of_id}
              </div>
            )}
            {log.error_message && (
              <div className="text-xs text-rose-500">
                Error: {log.error_message}
              </div>
            )}
            <div className="text-sm text-slate-600">Status</div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(log.status)}`}>
              {log.status}
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">Lampiran</div>
            {Array.isArray(log.attachments_meta) && log.attachments_meta.length > 0 ? (
              <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1">
                {log.attachments_meta.map((att) => (
                  <li key={att.filename}>
                    {att.filename} ({att.readableSize || att.size || 'x'} | {att.contentType || 'unknown'})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada info lampiran</p>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Body Email</div>
          <div className="border border-slate-200 rounded-xl p-3 max-h-72 overflow-auto text-sm leading-6 text-slate-800 bg-slate-50">
            {log.body ? (
              <div dangerouslySetInnerHTML={{ __html: log.body }} />
            ) : (
              'Body kosong'
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {log.status === 'failed' && (
            <button
              onClick={() => onRetry(log)}
              disabled={retryingId === log.id}
              className="px-4 py-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {retryingId === log.id ? 'Retrying...' : 'Retry kirim'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogDetailModal;
