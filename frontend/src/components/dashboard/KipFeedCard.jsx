import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const KipFeedCard = ({ intervalMs = 10000, compact = true, cardHeight = 'h-[160px]' }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const fadeTimeoutRef = useRef(null);
  const intervalRef = useRef(null);

  const shuffleArray = (array) => {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/news/kip');
      const data = res.data || [];
      setItems(shuffleArray(data));
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

  const toSummarySnippet = (text) => {
    if (!text) return '';
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    const minLen = 140;
    const maxLen = 190;
    if (cleaned.length <= minLen) return cleaned;

    let snippet = cleaned.slice(0, maxLen);
    if (snippet.length < minLen) snippet = cleaned.slice(0, minLen);

    if (snippet.length < cleaned.length) {
      const lastSpace = snippet.lastIndexOf(' ');
      if (lastSpace > minLen - 20) {
        snippet = snippet.slice(0, lastSpace);
      }
    }

    snippet = snippet.trim();
    if (snippet.length < minLen && cleaned.length >= minLen) {
      snippet = cleaned.slice(0, Math.min(cleaned.length, minLen)).trim();
    }

    if (snippet.length > maxLen) snippet = snippet.slice(0, maxLen).trim();

    const needsEllipsis = snippet.length < cleaned.length;
    return needsEllipsis ? `${snippet}...` : snippet;
  };

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

  const titleClass = compact ? 'text-[13px] font-semibold' : 'text-sm font-semibold';

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-soft lg:col-span-2 p-3 space-y-2 ${cardHeight} overflow-hidden`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Berita KIP</h2>
        {items.length > 1 && (
          <span className="text-[10px] text-slate-500">
            {index + 1}/{items.length}
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">Memuat berita...</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
            {error}
          </div>
        ) : !current ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            Belum ada berita terkait KIP.
          </div>
        ) : (
          <a
            href={current.link}
            target="_blank"
            rel="noreferrer"
            className={`h-full flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/60 transition px-3 py-2 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'
              }`}
            title={current.title}
          >
            <div>
              <div className={`${titleClass} text-slate-900 leading-snug line-clamp-2`}>
                {current.title}
              </div>
              {current.summary && (
                <div className="text-[11px] text-slate-600 mt-1 leading-tight line-clamp-2">
                  {toSummarySnippet(current.summary)}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">{current.source || 'Portal berita'}</span>
              <span>{formatDate(current.publishedAt)}</span>
            </div>
          </a>
        )}
      </div>
    </div>
  );
};

export default KipFeedCard;
