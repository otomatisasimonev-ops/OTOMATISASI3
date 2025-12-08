import { useEffect, useState } from 'react';

const DEFAULT_SUBJECT = 'Permohonan Informasi - {{nama_badan_publik}}';
const DEFAULT_BODY = `Kepada
Yth. Pejabat Pengelola Data dan Informasi (PPID)
{{nama_badan_publik}}

Dengan hormat,
Saya {{pemohon}} bermaksud mengajukan permohonan informasi berikut ini:
{{pertanyaan}}

Informasi tersebut saya butuhkan untuk {{tujuan}}.
Bukti identitas berupa kartu tanda penduduk (KTP) saya lampirkan dalam email ini.

Demikian permohonan informasi ini saya ajukan, atas perhatian dan kerjasamanya saya ucapkan terima kasih.

Yogyakarta, {{tanggal}}
Salam hormat,
{{pemohon}}

NOTE:
Sebelum mengirimkan email, pastikan untuk melampirkan file KTP.`;

const TemplateEditor = () => {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    const storedSubject = localStorage.getItem('customSubjectTemplate');
    const storedBody = localStorage.getItem('customBodyTemplate');
    if (storedSubject) setSubject(storedSubject);
    if (storedBody) setBody(storedBody);
  }, []);

  const ensurePlaceholders = () => {
    const tokens = ['{{nama_badan_publik}}', '{{pertanyaan}}', '{{pemohon}}', '{{tujuan}}', '{{tanggal}}'];
    let nextSubject = subject;
    if (!nextSubject.includes('{{nama_badan_publik}}')) {
      nextSubject = `${nextSubject} {{nama_badan_publik}}`;
    }
    let nextBody = body;
    tokens.forEach((t) => {
      if (!nextBody.includes(t)) {
        nextBody += `\n${t}`;
      }
    });
    return { nextSubject, nextBody };
  };

  const handleSave = () => {
    const { nextSubject, nextBody } = ensurePlaceholders();
    setSubject(nextSubject);
    setBody(nextBody);
    localStorage.setItem('customSubjectTemplate', nextSubject);
    localStorage.setItem('customBodyTemplate', nextBody);
    setLastSaved(new Date().toLocaleString('id-ID'));
  };

  const handleReset = () => {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    localStorage.removeItem('customSubjectTemplate');
    localStorage.removeItem('customBodyTemplate');
    setLastSaved(new Date().toLocaleString('id-ID'));
  };

  const preview = body
    .replaceAll('{{nama_badan_publik}}', 'Contoh Badan Publik')
    .replaceAll('{{pertanyaan}}', 'Informasi pengadaan barang/jasa 2024')
    .replaceAll('{{pemohon}}', 'Nama Pemohon')
    .replaceAll('{{tujuan}}', 'Tugas kuliah')
    .replaceAll('{{tanggal}}', new Date().toLocaleDateString('id-ID'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Rancang template email</p>
          <h1 className="text-2xl font-bold text-slate-900">Edit Template</h1>
        </div>
        {lastSaved && <span className="text-xs text-slate-500">Terakhir disimpan: {lastSaved}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Template</p>
              <h2 className="text-lg font-bold text-slate-900">Subjek & Body</h2>
            </div>
            <button
              onClick={handleSave}
              className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
            >
              Simpan Template
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Subjek</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm leading-6"
                rows={18}
              />
              <p className="text-xs text-slate-500 mt-2">
                Placeholder yang didukung: {'{{nama_badan_publik}}'}, {'{{pertanyaan}}'}, {'{{pemohon}}'},
                {'{{tujuan}}'}, {'{{tanggal}}'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setBody((prev) => `${prev}\n{{nama_badan_publik}}`);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  + nama_badan_publik
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBody((prev) => `${prev}\n{{pertanyaan}}`);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  + pertanyaan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBody((prev) => `${prev}\n{{pemohon}}`);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  + pemohon
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBody((prev) => `${prev}\n{{tujuan}}`);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  + tujuan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBody((prev) => `${prev}\n{{tanggal}}`);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  + tanggal
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="bg-primary text-white px-4 py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
              >
                Simpan Template
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Reset ke Default
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-200 shadow-soft p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-primary">Pratinjau</p>
              <h2 className="text-lg font-bold text-slate-900">Tampilan Kertas</h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-200 text-slate-700">Read-only</span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] bg-[length:18px_18px] opacity-50 pointer-events-none" />
            <div className="relative bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-soft">
              <div className="mb-3">
                <div className="text-xs text-slate-400 uppercase">Subjek</div>
                <div className="text-sm font-semibold text-slate-900">{subject}</div>
              </div>
              <div className="whitespace-pre-line text-sm leading-6 text-slate-800">
                {preview}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
