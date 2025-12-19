import { useMemo } from 'react';
import { buildServerFileUrl } from '../../utils/serverUrl';

const isImage = (mimetype = '') => String(mimetype).startsWith('image/');

const UjiAksesQuestionCard = ({
  number,
  text,
  options = [],
  value,
  catatan,
  onChangeOption,
  onChangeCatatan,
  disabled = false,
  evidences = [],
  pendingFiles = [],
  onPickFiles,
  onUploadNow
}) => {
  const mergedExisting = Array.isArray(evidences) ? evidences : [];
  const mergedPending = Array.isArray(pendingFiles) ? pendingFiles : [];

  const pickedLabel = useMemo(() => {
    const opt = options.find((o) => o.key === value);
    return opt ? `${opt.label} (skor ${opt.score})` : '-';
  }, [options, value]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Pertanyaan {number}</div>
            <h3 className="text-sm font-semibold text-slate-600 leading-relaxed">{text}</h3>
          </div>
          <div className="text-xs text-slate-500 whitespace-nowrap">Pilihan: {pickedLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map((opt) => (
          <label
            key={opt.key}
            className={`flex items-start gap-3 p-3 rounded-2xl border transition ${
              value === opt.key ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
            } ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              name={`q-${number}`}
              checked={value === opt.key}
              onChange={() => onChangeOption(opt.key)}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
              <div className="text-xs text-slate-500">Skor: {opt.score}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Catatan (opsional)</label>
          <textarea
            value={catatan || ''}
            onChange={(e) => onChangeCatatan(e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            placeholder="Tulis catatan singkat (opsional)"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-slate-700">Bukti dukung (opsional)</label>
            {!disabled && typeof onUploadNow === 'function' && mergedPending.length > 0 && (
              <button
                onClick={onUploadNow}
                className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-soft hover:bg-emerald-700"
                type="button"
              >
                Upload {mergedPending.length} file
              </button>
            )}
          </div>
          {!disabled && (
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => onPickFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
          )}

          <div className="space-y-2">
            {mergedExisting.length === 0 && mergedPending.length === 0 ? (
              <div className="text-xs text-slate-500">Belum ada bukti.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mergedExisting.map((f, idx) => {
                  const url = buildServerFileUrl(f.path);
                  return (
                    <a
                      key={`${f.path || 'file'}-${idx}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 flex gap-2 items-center"
                      title={f.filename}
                    >
                      {isImage(f.mimetype) ? (
                        <img src={url} alt={f.filename} className="h-10 w-10 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          PDF
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{f.filename}</div>
                        <div className="text-[11px] text-slate-500 truncate">{f.mimetype}</div>
                      </div>
                    </a>
                  );
                })}

                {mergedPending.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="p-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex gap-2 items-center"
                    title={f.name}
                  >
                    <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-bold text-amber-700">
                      NEW
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{f.type || 'file'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UjiAksesQuestionCard;
