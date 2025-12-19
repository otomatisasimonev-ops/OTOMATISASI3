import { useCallback, useEffect, useRef, useState } from 'react';

const pickRandom = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

const QuoteCard = ({ quotes = [], badge = 'Transparansi', title = 'Kutipan keterbukaan informasi' }) => {
  const fallback = 'Transparansi memperkuat akuntabilitas.';
  const [currentQuote, setCurrentQuote] = useState(() => pickRandom(quotes) || {});
  const [typedQuote, setTypedQuote] = useState(() => currentQuote?.text || fallback);
  const typingTimeoutRef = useRef(null);
  const cycleTimeoutRef = useRef(null);

  const clearQuoteTimers = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }
  }, []);

  const shuffleQuote = useCallback(() => {
    if (!quotes?.length) return;
    clearQuoteTimers();
    setCurrentQuote((prev) => {
      if (quotes.length === 1) return quotes[0];
      let next = prev;
      while (next === prev) {
        next = pickRandom(quotes);
      }
      return next;
    });
  }, [clearQuoteTimers, quotes]);

  useEffect(() => {
    if (!quotes?.length) return;
    setCurrentQuote((prev) => {
      const stillExists = quotes.find((q) => q === prev);
      return stillExists || pickRandom(quotes) || {};
    });
  }, [quotes]);

  useEffect(() => {
    const text = currentQuote?.text || fallback;
    clearQuoteTimers();
    setTypedQuote('');
    let index = 0;

    const typeNext = () => {
      setTypedQuote(text.slice(0, index + 1));
      index += 1;
      if (index < text.length) {
        typingTimeoutRef.current = setTimeout(typeNext, 28);
      } else {
        cycleTimeoutRef.current = setTimeout(() => shuffleQuote(), 7000);
      }
    };

    typingTimeoutRef.current = setTimeout(typeNext, 120);

    return () => clearQuoteTimers();
  }, [clearQuoteTimers, currentQuote, shuffleQuote, fallback]);

  return (
    <div className="relative rounded-2xl border border-slate-200 border-l-4 border-primary/20 bg-white shadow-soft p-3 lg:col-span-2 h-[160px] overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 7.5a4.5 4.5 0 1 0-4 7m4-7H7m7 0a4.5 4.5 0 1 0 4 7m-4-7h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-[0.08em]">
              {badge}
            </span>
            <div className="text-xs text-slate-900">{title}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={shuffleQuote}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4h5l-1.5 1.5M20 20h-5l1.5-1.5M20 4l-4 4M4 20l4-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 4v6.5A3.5 3.5 0 0 0 7.5 14H20M20 20v-6.5A3.5 3.5 0 0 0 16.5 10H4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Acak</span>
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 shadow-inner">
        <p className="text-[13px] font-normal text-slate-900 leading-relaxed">
          {typedQuote || fallback}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px] font-normal text-slate-700">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            Sumber
          </span>
          <span>{currentQuote?.source || 'UU KIP'}</span>
        </div>
      </div>
    </div>
  );
};

export default QuoteCard;
