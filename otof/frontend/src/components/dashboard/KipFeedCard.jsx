import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const KipFeedCard = ({ intervalMs = 10000, compact = true }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const fadeTimeoutRef = useRef(null);
  const intervalRef = useRef(null);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/news/kip');
      const data = res.data || [];
      setItems(data);
      setIndex(0);
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || 'Gagal memuat berita');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);

    if (items.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setFading(true);
      fadeTimeoutRef.current = setTimeout(() => {
        setIndex((prev) => (prev + 1) % items.length);
        setFading(false);
      }, 500);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [items.length, intervalMs]);

  const current = useMemo(() => items[index] || null, [items, index]);

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const titleClass = compact ? 'text-sm font-semibold' : 'text-base font-semibold';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft lg:col-span-2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Berita KIP</h2>
        {items.length > 1 && (
          <span className="text-[10px] text-slate-500">
            {index + 1}/{items.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">Memuat berita...</div>
      ) : error ? (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
          {error}
        </div>
      ) : !current ? (
        <div className="text-xs text-slate-500">Belum ada berita terkait KIP.</div>
      ) : (
        <a
          href={current.link}
          target="_blank"
          rel="noreferrer"
          className={`block rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition px-3 py-2 transition-opacity duration-500 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
          title={current.title}
        >
          <div className={`${titleClass} text-slate-900 leading-snug line-clamp-2`}>
            {current.title}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{current.source || 'Portal berita'}</span>
            <span>{formatDate(current.publishedAt)}</span>
          </div>
          {!compact && current.summary && (
            <div className="text-xs text-slate-600 mt-1 leading-5 line-clamp-2">
              {current.summary}
            </div>
          )}
        </a>
      )}
    </div>
  );
};

export default KipFeedCard;
