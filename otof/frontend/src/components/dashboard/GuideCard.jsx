const GuideCard = ({ visible, onClose }) => {
  if (!visible) return null;
  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-white to-secondary/10 shadow-soft p-5">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 text-lg font-bold"
        aria-label="Tutup panduan"
      >
        ?
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
  );
};

export default GuideCard;
