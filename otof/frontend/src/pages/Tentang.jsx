const Tentang = () => {
  const title = 'COMING SOON';

  return (
    <div className="min-h-[100vh] flex items-center justify-center bg-white">
      <div className="text-center space-y-6 px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Tentang</div>
        <div
          className="font-black leading-tight text-slate-900"
          style={{
            fontSize: 'min(22vw, 260px)',
            fontFamily: '"Unbounded", "Playfair Display", "Copperplate", serif',
            letterSpacing: '-0.04em'
          }}
        >
          {title}
        </div>
        <p
          className="text-sm text-slate-600 font-medium"
          style={{ fontFamily: '"Didot", "Copperplate", "Fugaz One", serif' }}
        >
          Segera hadir — sesuatu yang lebih besar.
        </p>
      </div>
    </div>
  );
};

export default Tentang;
