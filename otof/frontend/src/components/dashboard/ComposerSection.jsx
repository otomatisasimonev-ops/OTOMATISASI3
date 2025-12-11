const ComposerSection = ({
  form,
  setForm,
  attachment,
  attachmentInfo,
  attachmentPreview,
  handleFile,
  previewBody,
  selectedCount,
  totalCount,
  statusMessage,
  handleSend,
  sending,
  templates,
  activeTemplate,
  selectedTemplateId,
  onSelectTemplate,
  placeholderKeys,
  manualFields = [],
  customValues = {},
  onChangeCustomValue,
  missingManualFields = []
}) => {
  const formatLabel = (key) =>
    key
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join(' ');

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-primary">Template Permohonan Informasi</p>
          <h2 className="text-xl font-bold text-slate-900">Form Pengirim</h2>
          <p className="text-sm text-slate-500">
            Isi nama pemohon, tujuan, unggah KTP, lalu pilih badan publik di bawah.
          </p>
        </div>
        <div className="px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold">
          Warning: lampirkan KTP sebelum kirim.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3 col-span-2">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-700">Pilih template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => onSelectTemplate(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">{activeTemplate?.description}</p>
              {placeholderKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {placeholderKeys.map((key) => (
                    <span
                      key={key}
                      className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {'{{'}
                      {key}
                      {'}}'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end text-sm text-slate-600">
              <div className="px-4 py-3 rounded-xl border border-dashed border-slate-200 bg-slate-50">
                Edit atau tambah template di menu <span className="font-semibold">Template</span>.
              </div>
            </div>
          </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Nama Pemohon</label>
              <input
                value={form.pemohon}
                onChange={(e) => setForm({ ...form, pemohon: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Tujuan Permintaan</label>
              <input
                value={form.tujuan}
                onChange={(e) => setForm({ ...form, tujuan: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Misal: tugas kuliah, riset, artikel"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Subjek Email</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Permohonan Informasi - {{nama_badan_publik}}"
              />
            </div>
              <div className="text-xs text-slate-500">
                Tanggal otomatis memakai hari ini. Jika perlu ubah, edit template di halaman Template Editor.
              </div>
            </div>
            {manualFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {manualFields.map((field) => {
                  const missing = missingManualFields.includes(field);
                  return (
                    <div key={field}>
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                        {formatLabel(field)}
                        {missing && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            wajib isi
                          </span>
                        )}
                      </label>
                      <input
                        value={customValues[field] || ''}
                        onChange={(e) => onChangeCustomValue(field, e.target.value)}
                        className={`mt-1 w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary ${
                          missing ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                        }`}
                        placeholder={`Isi untuk {{${field}}}`}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Variabel: {'{{'}{field}{'}}'}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Lampiran KTP (wajib)</label>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <label className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                <span className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold">Pilih File</span>
                <span className="text-sm text-slate-700">
                  {attachment?.filename || 'Unggah KTP (jpg/png/pdf, maks 7MB)'}
                </span>
              </label>
              {attachmentInfo && (
                <span className="text-xs px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                  {attachmentInfo}
                </span>
              )}
              <div className="text-[11px] text-slate-500">
                KTP hanya digunakan untuk verifikasi permohonan dan tidak dibagikan ke pihak lain.
              </div>
              {attachmentPreview && attachmentPreview.type?.startsWith('image/') && (
                <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-soft">
                  <img src={attachmentPreview.url} alt="Preview KTP" className="w-full h-full object-cover" />
                </div>
              )}
              {attachmentPreview && attachmentPreview.type?.includes('pdf') && (
                <div className="w-48 h-40 border border-slate-200 rounded-xl overflow-hidden shadow-soft bg-slate-50">
                  <embed src={attachmentPreview.url} type="application/pdf" className="w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">Pratinjau Email</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700">
              {selectedCount || 0} penerima
            </span>
          </div>
          <div className="text-xs leading-5 text-slate-700 bg-white rounded-xl border border-slate-200 p-3 h-90 overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: previewBody }} />
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {statusMessage}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-600">
          Penerima dipilih: <strong>{selectedCount}</strong> / {totalCount}
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="relative bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold shadow-soft hover:bg-slate-800 disabled:opacity-60"
        >
          {sending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Mengirim...
            </span>
          ) : (
            'Kirim Email Massal'
          )}
        </button>
      </div>
    </div>
  );
};

export default ComposerSection;
