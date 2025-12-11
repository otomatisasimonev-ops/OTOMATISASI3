import { useEffect, useMemo, useRef, useState } from 'react';
import DEFAULT_TEMPLATES from '../constants/templates';
import { useAuth } from '../context/AuthContext';

const MAX_VERSIONS = 10;
const AUTOSAVE_DELAY = 800;

const TemplateEditor = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin;
  const roleKey = user?.role ? `customTemplates:${user.role}` : 'customTemplates';
  const versionKey = (id) => `templateVersions:${id}:${user?.role || 'anon'}`;
  const draftKey = (id) => `templateDraft:${id}:${user?.role || 'anon'}`;
  const readTemplates = (key) => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
      if (key !== 'customTemplates') {
        const legacy = localStorage.getItem('customTemplates');
        if (legacy) return JSON.parse(legacy);
      }
      return [];
    } catch (err) {
      return [];
    }
  };

  const [customTemplates, setCustomTemplates] = useState(() => readTemplates(roleKey));

  useEffect(() => {
    const data = readTemplates(roleKey);
    setCustomTemplates(data);
    if (roleKey !== 'customTemplates') {
      try {
        localStorage.setItem(roleKey, JSON.stringify(data));
      } catch (err) {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks-exhaustive-deps
  }, [roleKey]);

  const defaultIds = useMemo(() => new Set(DEFAULT_TEMPLATES.map((t) => t.id)), []);

  const templates = useMemo(() => {
    const overrideMap = new Map(customTemplates.map((t) => [t.id, t]));
    const mergedDefaults = DEFAULT_TEMPLATES.map((t) => overrideMap.get(t.id) || t);
    const customOnly = customTemplates.filter((t) => !defaultIds.has(t.id));
    return [...mergedDefaults, ...customOnly];
  }, [customTemplates, defaultIds]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [isNew, setIsNew] = useState(false);
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) || (!isNew ? templates[0] : null);

  const [name, setName] = useState(activeTemplate?.name || '');
  const [description, setDescription] = useState(activeTemplate?.description || '');
  const [subject, setSubject] = useState(activeTemplate?.subject || '');
  const [body, setBody] = useState(activeTemplate?.body || '');
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [confirmingSave, setConfirmingSave] = useState(false);

  const autosaveTimer = useRef(null);

  const saveDraft = (tplId, state) => {
    try {
      localStorage.setItem(draftKey(tplId || 'new'), JSON.stringify(state));
    } catch (err) {
      // ignore
    }
  };

  const loadDraft = (tplId) => {
    try {
      const raw = localStorage.getItem(draftKey(tplId || 'new'));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  const loadVersions = (tplId) => {
    try {
      const raw = localStorage.getItem(versionKey(tplId));
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  };

  const pushVersion = (tplId, state) => {
    if (!tplId) return;
    const versions = loadVersions(tplId);
    const next = [{ ...state, savedAt: new Date().toISOString() }, ...versions].slice(0, MAX_VERSIONS);
    localStorage.setItem(versionKey(tplId), JSON.stringify(next));
  };

  useEffect(() => {
    if (selectedTemplateId === 'new') {
      setIsNew(true);
      const draft = loadDraft('new');
      setName(draft?.name || '');
      setDescription(draft?.description || '');
      setSubject(draft?.subject || '');
      setBody(draft?.body || '');
      setHistory([]);
      setFuture([]);
      return;
    }
    setIsNew(false);
    const tpl = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (!tpl) return;
    const draft = loadDraft(selectedTemplateId);
    setName(draft?.name ?? tpl.name);
    setDescription((draft?.description ?? tpl.description) || '');
    setSubject(draft?.subject ?? tpl.subject);
    setBody(draft?.body ?? tpl.body);
    setHistory([]);
    setFuture([]);
    setConfirmingSave(false);
  }, [selectedTemplateId, templates]);

  const snapshot = () => ({
    name,
    description,
    subject,
    body
  });

  const updateField = (setter) => (value) => {
    if (!canEdit) return;
    pushHistory();
    setter(value);
  };

  const pushHistory = () => {
    if (!canEdit) return;
    setHistory((prev) => [...prev, snapshot()].slice(-50));
    setFuture([]);
  };

  const handleUndo = () => {
    if (!canEdit) return;
    setHistory((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setFuture((f) => [snapshot(), ...f]);
      setName(last.name);
      setDescription(last.description);
      setSubject(last.subject);
      setBody(last.body);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    if (!canEdit) return;
    setFuture((prev) => {
      if (!prev.length) return prev;
      const next = prev[0];
      setHistory((h) => [...h, snapshot()].slice(-50));
      setName(next.name);
      setDescription(next.description);
      setSubject(next.subject);
      setBody(next.body);
      return prev.slice(1);
    });
  };

  const saveTemplate = () => {
    if (!canEdit) return;
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setToast('Nama, subjek, dan body wajib diisi.');
      return;
    }
    const isExistingCustom = customTemplates.some((t) => t.id === selectedTemplateId);
    const isDefaultSelected = defaultIds.has(selectedTemplateId);
    const targetId =
      isNew || selectedTemplateId === 'new' || (!isExistingCustom && !isDefaultSelected)
        ? `custom-${Date.now()}`
        : selectedTemplateId;

    const newTpl = {
      id: targetId,
      name: name.trim(),
      description: description.trim(),
      subject,
      body
    };

    setCustomTemplates((prev) => {
      const filtered = prev.filter((t) => t.id !== targetId);
      const updated = [...filtered, newTpl];
      localStorage.setItem(roleKey, JSON.stringify(updated));
      return updated;
    });
    pushVersion(targetId, newTpl);
    saveDraft(targetId, newTpl);
    setSelectedTemplateId(targetId);
    setIsNew(false);
    setToast(isExistingCustom || isDefaultSelected ? 'Template diperbarui.' : 'Template baru dibuat.');
    setConfirmingSave(false);
  };
  const handleSaveClick = () => {
    if (!canEdit) return;
    setConfirmingSave(true);
  };

  const isDeletable = useMemo(
    () => customTemplates.some((t) => t.id === selectedTemplateId),
    [customTemplates, selectedTemplateId]
  );
  const overwriteWarning =
    !isNew && (defaultIds.has(selectedTemplateId) || customTemplates.some((t) => t.id === selectedTemplateId))
      ? 'Menyimpan akan menimpa template ini.'
      : 'Simpan untuk membuat template baru.';

  const handleDelete = () => {
    if (!canEdit) return;
    if (!isDeletable) {
      setToast('Template bawaan tidak bisa dihapus, hanya dapat diubah atau di-override.');
      return;
    }
    const confirm = window.confirm('Hapus template inix');
    if (!confirm) return;
    setCustomTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== selectedTemplateId);
      localStorage.setItem(roleKey, JSON.stringify(updated));
      localStorage.removeItem(versionKey(selectedTemplateId));
      return updated;
    });
    const fallbackId = defaultIds.has(selectedTemplateId) ? selectedTemplateId : DEFAULT_TEMPLATES[0].id;
    setSelectedTemplateId(fallbackId);
    setIsNew(false);
    setToast('Template dihapus. Template bawaan akan dipakai jika tersedia.');
  };

  const handleReset = () => {
    if (selectedTemplateId === 'new') {
      setName('');
      setDescription('');
      setSubject('');
      setBody('');
      setToast('Draft baru dikosongkan.');
      return;
    }
    const tpl = DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_TEMPLATES[0];
    setName(tpl.name);
    setDescription(tpl.description || '');
    setSubject(tpl.subject);
    setBody(tpl.body);
    setToast('Di-reset ke versi default.');
  };

  const handleRestoreVersion = (ver) => {
    if (!canEdit) return;
    setName(ver.name);
    setDescription(ver.description || '');
    setSubject(ver.subject);
    setBody(ver.body);
    setToast('Versi sebelumnya dipulihkan. Simpan untuk menetapkan.');
  };

  useEffect(() => {
    if (!canEdit) return;
    // autosave debounce
    const state = snapshot();
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      saveDraft(selectedTemplateId, state);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, subject, body, selectedTemplateId]);

  const versions = selectedTemplateId ? loadVersions(selectedTemplateId) : [];

  const preview = useMemo(() => {
    return (body || '')
      .replaceAll('{{nama_badan_publik}}', 'Contoh Badan Publik')
      .replaceAll('{{kategori}}', 'Kategori')
      .replaceAll('{{email}}', 'email@contoh.id')
      .replaceAll('{{pertanyaan}}', 'Contoh permintaan informasi')
      .replaceAll('{{pemohon}}', 'Nama Pemohon')
      .replaceAll('{{tujuan}}', 'Tujuan penggunaan data')
      .replaceAll('{{tanggal}}', new Date().toLocaleDateString('id-ID'))
      .replaceAll('{{asal_kampus}}', 'Universitas Contoh')
      .replaceAll('{{prodi}}', 'Ilmu Komputer')
      .replaceAll('{{nama_media}}', 'Media Contoh')
      .replaceAll('{{deadline}}', '12 Des 2025');
  }, [body]);

  return (
    <>
      <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-primary/10 via-white to-slate-50 p-6 shadow-soft">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_20%_20%,#34d399,transparent_30%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Template Editor</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Kelola & buat ulang template dengan cepat</h1>
            <p className="text-sm text-slate-600 mt-1">
              Pilih template, edit isi dan placeholder, simpan sebagai kustom, atau hapus jika tidak terpakai.
            </p>
            {!canEdit && (
              <p className="text-xs font-semibold text-amber-700 mt-2">
                Mode lihat saja. Hanya admin yang bisa mengedit atau menyimpan template.
              </p>
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => setSelectedTemplateId('new')}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-soft hover:bg-slate-800"
            >
              + Draft baru
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary">Pilih Template</p>
            <h3 className="text-lg font-bold text-slate-900">Library</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">{templates.length} template</span>
            {canEdit && (
              <button
                onClick={() => setSelectedTemplateId('new')}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  selectedTemplateId === 'new'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 text-slate-700 hover:border-primary/50'
                }`}
              >
                + Template Baru
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {templates.map((t) => {
            const isActive = t.id === selectedTemplateId;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`min-w-[240px] text-left rounded-2xl border px-4 py-3 transition ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary shadow-soft'
                    : 'border-slate-200 hover:border-primary/50 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {defaultIds.has(t.id) && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500">Default</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">{t.description || 'Tanpa deskripsi'}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[3fr,2fr] gap-4 items-start">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-primary">Form Template</p>
              <h2 className="text-lg font-bold text-slate-900">
                {isNew || selectedTemplateId === 'new' ? 'Draft baru' : activeTemplate?.name || 'Template'}
              </h2>
              <p className="text-xs text-slate-500">Simpan untuk membuat/overwrite template kustom.</p>
            </div>
              <div className="flex flex-col items-end gap-2 w-full">
              {canEdit && (
                <div className="flex gap-2 flex-wrap items-center justify-end">
                  <button
                    onClick={handleUndo}
                    disabled={!history.length}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${
                      history.length ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Undo
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!future.length}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${
                      future.length ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Redo
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!isDeletable}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${
                      isDeletable
                        ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                        : 'border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Hapus
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-sm hover:bg-slate-50"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSaveClick}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700 text-sm"
                  >
                    Simpan
                  </button>
                </div>
              )}
                <div className="flex items-center gap-2 flex-wrap justify-end min-h-[32px]">
                  {toast && (
                    <span className="text-sm px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                      {toast}
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border ${
                      overwriteWarning.includes('menimpa')
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {canEdit ? overwriteWarning : 'Hanya admin yang bisa menyimpan/ubah template'}
                  </span>
                </div>
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Nama template</label>
              <input
                value={name}
                readOnly={!canEdit}
                onChange={(e) => updateField(setName)(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Deskripsi</label>
              <input
                value={description}
                readOnly={!canEdit}
                onChange={(e) => updateField(setDescription)(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Opsional"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Subjek</label>
            <input
              value={subject}
              readOnly={!canEdit}
              onChange={(e) => updateField(setSubject)(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Body</label>
            <textarea
              value={body}
              readOnly={!canEdit}
              onChange={(e) => updateField(setBody)(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm leading-6"
              rows={14}
            />
            <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-600">
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{nama_badan_publik}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{kategori}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{email}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{pertanyaan}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{pemohon}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{tujuan}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{tanggal}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{asal_kampus}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{prodi}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{nama_media}}'}
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                {'{{deadline}}'}
              </span>
            </div>
          </div>

          {toast && (
            <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              {toast}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-200 shadow-soft p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-primary">Pratinjau</p>
              <h2 className="text-lg font-bold text-slate-900">{subject || 'Pratinjau Subjek'}</h2>
            </div>
            <span className="text-[11px] px-3 py-1 rounded-full bg-slate-200 text-slate-700">Read-only</span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] bg-[length:18px_18px] opacity-50 pointer-events-none" />
            <div className="relative bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-soft">
              <div className="whitespace-pre-line text-sm leading-6 text-slate-800">{preview}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-6 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">Riwayat versi</p>
              <h3 className="text-lg font-bold text-slate-900">Versi sebelumnya</h3>
              <p className="text-xs text-slate-500">Maks {MAX_VERSIONS} versi terakhir tersimpan per template.</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {versions.length} versi
            </span>
          </div>
          {versions.length === 0 ? (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Belum ada versi tersimpan. Simpan perubahan untuk membuat versi.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {versions.map((ver) => (
                <div
                  key={ver.savedAt}
                  className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1"
                >
                  <div className="text-xs text-slate-500">
                    {new Date(ver.savedAt).toLocaleString('id-ID')}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">{ver.name}</div>
                  <div className="text-xs text-slate-600 line-clamp-2">{ver.subject}</div>
                  <button
                    onClick={() => handleRestoreVersion(ver)}
                    disabled={!canEdit}
                    className={`text-xs font-semibold ${
                      canEdit ? 'text-primary hover:underline' : 'text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Pulihkan versi ini
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

      {canEdit && confirmingSave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Simpan template</h3>
                <p className="text-sm text-slate-600">
                  Perubahan akan {overwriteWarning.includes('menimpa') ? 'menimpa template ini.' : 'membuat template baru.'}
                </p>
              </div>
              <button
                onClick={() => setConfirmingSave(false)}
                className="text-slate-500 hover:text-slate-800 text-xl font-bold"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveTemplate}
                className="px-4 py-2 rounded-xl bg-primary text-white font-semibold shadow-soft hover:bg-emerald-700"
              >
                Ya, simpan
              </button>
              <button
                onClick={() => setConfirmingSave(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TemplateEditor;
