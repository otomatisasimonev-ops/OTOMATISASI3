import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSmtp } from '../context/SmtpContext';

const Dashboard = () => {
  const { user } = useAuth();
  const { hasConfig } = useSmtp();

  const todayText = useMemo(
    () =>
      new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const [stats, setStats] = useState({
    badanCount: 0,
    sentCount: 0,
    pendingCount: 0,
    logCount: 0
  });
  const [badan, setBadan] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [customSubjectTpl, setCustomSubjectTpl] = useState(null);
  const [customBodyTpl, setCustomBodyTpl] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const [form, setForm] = useState({
    pemohon: '',
    tujuan: '',
    subject: `Permohonan Informasi - {{nama_badan_publik}}`,
    tanggal: todayText
  });

  useEffect(() => {
    const sub = localStorage.getItem('customSubjectTemplate');
    const body = localStorage.getItem('customBodyTemplate');
    if (sub) setCustomSubjectTpl(sub);
    if (body) setCustomBodyTpl(body);
    if (sub) setForm((prev) => ({ ...prev, subject: sub }));
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [badanRes, logRes] = await Promise.all([api.get('/badan-publik'), api.get('/email/logs')]);
        const badanData = badanRes.data || [];
        const logs = logRes.data || [];

        const sentCount = badanData.reduce((acc, item) => acc + (item.sent_count || 0), 0);
        const pendingCount = badanData.filter((item) => item.status === 'pending').length;

        setStats({
          badanCount: badanData.length,
          sentCount,
          pendingCount,
          logCount: logs.length
        });
        setBadan(badanData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedIds.length === badan.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(badan.map((b) => b.id));
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage('Ukuran file maksimal 5MB agar tidak ditolak server.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setAttachment({
        filename: file.name,
        content: base64,
        encoding: 'base64',
        contentType: file.type
      });
      setAttachmentPreview({
        type: file.type,
        url: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const templateBody = useMemo(() => {
    if (customBodyTpl) return customBodyTpl.replaceAll('\n', '<br/>');
    return `
    Kepada<br/>
    Yth. Pejabat Pengelola Data dan Informasi (PPID)<br/>
    {{nama_badan_publik}}<br/><br/>
    Dengan hormat,<br/>
    Saya {{pemohon}} bermaksud mengajukan permohonan informasi berikut ini:<br/>
    <strong>{{pertanyaan}}</strong><br/><br/>
    Informasi tersebut saya butuhkan untuk {{tujuan}}.<br/>
    Bukti identitas berupa kartu tanda penduduk (KTP) saya lampirkan dalam email ini.<br/><br/>
    Demikian permohonan informasi ini saya ajukan, atas perhatian dan kerjasamanya saya ucapkan terima kasih.<br/><br/>
    Yogyakarta, {{tanggal}}<br/>
    Salam hormat,<br/>
    {{pemohon}}<br/><br/>
    <em>NOTE: Pastikan KTP terlampir.</em>
    `;
  }, [customBodyTpl]);

  const previewBody = useMemo(() => {
    const sampleTarget = badan.find((b) => selectedIds.includes(b.id)) || badan[0];
    if (!sampleTarget) return templateBody;
    const pertanyaanFormatted = (sampleTarget.pertanyaan || '').replace(/\n/g, '<br/>');
    return templateBody
      .replaceAll('{{nama_badan_publik}}', sampleTarget.nama_badan_publik || '')
      .replaceAll('{{pertanyaan}}', pertanyaanFormatted)
      .replaceAll('{{pemohon}}', form.pemohon || '[nama pemohon]')
      .replaceAll('{{tujuan}}', form.tujuan || '[tujuan]')
      .replaceAll('{{tanggal}}', form.tanggal || todayText);
  }, [badan, selectedIds, templateBody, form, todayText]);

  const proceedSend = async () => {
    setStatusMessage('');
    if (!hasConfig) {
      setStatusMessage('SMTP belum disetel. Klik indikator merah/hijau di navbar dulu.');
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage('Pilih minimal satu badan publik.');
      return;
    }
    if (!form.pemohon || !form.tujuan || !form.subject) {
      setStatusMessage('Lengkapi nama pemohon, tujuan, dan subjek.');
      return;
    }
    if (!attachment) {
      setStatusMessage('Lampiran KTP wajib diunggah sebelum mengirim.');
      return;
    }
    setConfirmOpen(false);
    setSending(true);
    try {
      const payload = {
        badan_publik_ids: selectedIds,
        subject_template: customSubjectTpl || form.subject,
        body_template: templateBody,
        meta: {
          pemohon: form.pemohon,
          tujuan: form.tujuan,
          tanggal: form.tanggal || todayText
        },
        attachments: attachment ? [attachment] : []
      };
      const res = await api.post('/email/send', payload);
      setSuccessInfo({
        message: res.data?.message || 'Email diproses',
        total: selectedIds.length,
        attachment: Boolean(attachment)
      });
      setSelectedIds([]);
      setAttachment(null);
      setAttachmentPreview(null);
      setStatusMessage('');
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Gagal mengirim email');
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    setStatusMessage('');
    if (!hasConfig) {
      setStatusMessage('SMTP belum disetel. Klik indikator merah/hijau di navbar dulu.');
      return;
    }
    if (selectedIds.length === 0) {
      setStatusMessage('Pilih minimal satu badan publik.');
      return;
    }
    if (!form.pemohon || !form.tujuan || !form.subject) {
      setStatusMessage('Lengkapi nama pemohon, tujuan, dan subjek.');
      return;
    }
    if (!attachment) {
      setStatusMessage('Lampiran KTP wajib diunggah sebelum mengirim.');
      return;
    }
    setConfirmOpen(true);
  };

  const cards = [
    { title: 'Total Badan Publik', value: stats.badanCount, accent: 'emerald', hint: 'Basis target aktif' },
    { title: 'Email Terkirim', value: stats.sentCount, accent: 'sky', hint: 'Total kirim akumulasi' },
    { title: 'Menunggu Kirim', value: stats.pendingCount, accent: 'amber', hint: 'Status pending' },
    { title: 'Log Tercatat', value: stats.logCount, accent: 'slate', hint: 'Riwayat di History' }
  ];

  const accentMap = {
    emerald: { text: 'text-emerald-700', dot: 'bg-emerald-400', chip: 'bg-emerald-50 border-emerald-100' },
    sky: { text: 'text-sky-700', dot: 'bg-sky-400', chip: 'bg-sky-50 border-sky-100' },
    amber: { text: 'text-amber-700', dot: 'bg-amber-400', chip: 'bg-amber-50 border-amber-100' },
    slate: { text: 'text-slate-700', dot: 'bg-slate-400', chip: 'bg-slate-50 border-slate-200' }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Halo, {user?.username}</p>
          <h1 className="text-2xl font-bold text-slate-900">Kirim Email Massal Sekarang</h1>
          <p className="text-sm text-slate-500">Pilih penerima, isi template, lampirkan KTP, lalu kirim.</p>
        </div>
        <span className="px-3 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">
          Peran: {user?.role}
        </span>
      </div>

      {showGuide && (
        <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-white to-secondary/10 shadow-soft p-5">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 text-lg font-bold"
            aria-label="Tutup panduan"
          >
            ×
          </button>
          <div className="flex flex-col md:flex-row md:items-center gap-3 pr-8">
            <div className="px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold w-max">Panduan Cepat</div>
            <ol className="list-decimal pl-4 text-sm text-slate-700 space-y-1">
              <li>Setel SMTP (indikator harus hijau).</li>
              <li>Isi nama pemohon, tujuan, subjek, tanggal.</li>
              <li>Upload KTP (maks 5MB) dan pilih penerima di tabel.</li>
              <li>Preview template, lalu klik Kirim Email Massal.</li>
            </ol>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-200 shadow-soft hover:shadow-lg transition transform hover:-translate-y-1"
          >
            <div className="absolute inset-x-0 -top-6 h-16 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${accentMap[card.accent]?.dot || 'bg-slate-300'} animate-pulse`}
              />
              <div className="text-xs uppercase text-slate-500 font-semibold">{card.title}</div>
            </div>
            <div className="text-4xl font-bold text-slate-900 mt-2">{loading ? '...' : card.value}</div>
            <div
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[12px] border ${accentMap[card.accent]?.chip || 'bg-slate-50 border-slate-200'} mt-2`}
            >
              <span className={accentMap[card.accent]?.text || 'text-slate-700'}>{card.hint}</span>
            </div>
          </div>
        ))}
      </div>

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
              <div>
                <label className="text-sm font-semibold text-slate-700">Tanggal</label>
                <input
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Lampiran KTP (wajib)</label>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                <label className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                  <span className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold">Pilih File</span>
                  <span className="text-sm text-slate-700">
                    {attachment?.filename || 'Unggah KTP (jpg/png/pdf, maks 5MB)'}
                  </span>
                </label>
                {attachmentPreview && attachmentPreview.type?.startsWith('image/') && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-soft">
                    <img src={attachmentPreview.url} alt="Preview KTP" className="w-full h-full object-cover" />
                  </div>
                )}
                {attachmentPreview && attachmentPreview.type?.includes('pdf') && (
                  <div className="w-32 h-24 border border-slate-200 rounded-xl overflow-hidden shadow-soft bg-slate-50">
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
                {selectedIds.length || 0} penerima
              </span>
            </div>
            <div className="text-xs leading-5 text-slate-700 bg-white rounded-xl border border-slate-200 p-3 h-64 overflow-auto">
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
            Penerima dipilih: <strong>{selectedIds.length}</strong> / {badan.length}
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Data Badan Publik</h2>
            <p className="text-sm text-slate-500">Pilih penerima untuk dikirimi permohonan.</p>
          </div>
          <button
            onClick={toggleAll}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
          >
            {selectedIds.length === badan.length ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-white text-slate-600">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === badan.length && badan.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Pertanyaan</th>
                <th className="px-4 py-3 text-left">Sent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Memuat data...
                  </td>
                </tr>
              ) : badan.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Belum ada data badan publik.
                  </td>
                </tr>
              ) : (
                badan.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    } hover:bg-primary/5 transition`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.nama_badan_publik}</td>
                    <td className="px-4 py-3 text-slate-700">{item.kategori}</td>
                    <td className="px-4 py-3 text-slate-700">{item.email}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-3xl whitespace-pre-wrap">{item.pertanyaan}</td>
                    <td className="px-4 py-3 text-slate-700">{item.sent_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {successInfo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Email terkirim!</h3>
            <p className="text-sm text-slate-600 mb-3">
              {successInfo.message} ke {successInfo.total} penerima.
            </p>
            <ul className="text-sm text-slate-600 space-y-1 mb-4">
              <li>• Lampiran KTP: {successInfo.attachment ? 'terikut' : 'tidak ada'}</li>
              <li>• Template otomatis sudah menyesuaikan nama badan publik.</li>
            </ul>
            <button
              onClick={() => setSuccessInfo(null)}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold shadow-soft hover:bg-emerald-700"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Kirim sekarang?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Pastikan data benar dan KTP sudah terlampir. Email akan dikirim ke {selectedIds.length} penerima.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={proceedSend}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold shadow-soft hover:bg-slate-800"
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
