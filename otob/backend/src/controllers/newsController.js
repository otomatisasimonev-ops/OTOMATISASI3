const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000
});

const FEEDS = [
  { name: 'Antara', url: 'https://www.antaranews.com/rss/terkini' },
  { name: 'Tempo Nasional', url: 'https://rss.tempo.co/nasional' },
  { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/rss' },
  { name: 'Republika', url: 'https://www.republika.co.id/rss' },
  {
    name: 'Google News (Keterbukaan Informasi)',
    url: 'https://news.google.com/rss/search?q=keterbukaan%20informasi%20publik&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (Komisi Informasi)',
    url: 'https://news.google.com/rss/search?q=komisi%20informasi&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (PPID)',
    url: 'https://news.google.com/rss/search?q=ppid&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (Sengketa Informasi)',
    url: 'https://news.google.com/rss/search?q=sengketa%20informasi%20publik&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (Transparansi Pemerintah)',
    url: 'https://news.google.com/rss/search?q=transparansi%20pemerintah&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (Open Data Indonesia)',
    url: 'https://news.google.com/rss/search?q=open%20data%20indonesia&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  },
  {
    name: 'Google News (Keterbukaan Data)',
    url: 'https://news.google.com/rss/search?q=keterbukaan%20data%20pemerintah&hl=id&gl=ID&ceid=ID:id',
    sourceFromTitle: true,
    skipKeywordFilter: true
  }
];

const KEYWORDS = [
  'keterbukaan informasi',
  'informasi publik',
  'komisi informasi',
  'kip',
  'ppid',
  'transparansi',
  'keterbukaan data',
  'data terbuka',
  'open data',
  'transparansi anggaran',
  'transparansi pemerintah',
  'akuntabilitas publik',
  'akses informasi',
  'hak akses informasi',
  'uji konsekuensi',
  'permohonan informasi',
  'sengketa informasi'
];

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = { items: null, fetchedAt: 0 };

const withinLastMonth = (dateValue) => {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return d >= cutoff;
};

const matchesKeywords = (title, snippet) => {
  const haystack = `${title || ''} ${snippet || ''}`.toLowerCase();
  return KEYWORDS.some((k) => haystack.includes(k));
};

const extractSourceFromTitle = (rawTitle, fallbackSource) => {
  if (!rawTitle) return { title: '', source: fallbackSource };
  const parts = String(rawTitle).split(' - ');
  if (parts.length > 1) {
    const source = parts.pop().trim();
    const title = parts.join(' - ').trim();
    return { title, source: source || fallbackSource };
  }
  return { title: String(rawTitle).trim(), source: fallbackSource };
};

const fetchOneFeed = async (feed) => {
  try {
    const res = await parser.parseURL(feed.url);
    const items = (res.items || []).map((it) => {
      const publishedAt = it.isoDate || it.pubDate || it.published || null;
      const { title, source } = feed.sourceFromTitle
        ? extractSourceFromTitle(it.title, feed.name)
        : { title: it.title || '', source: feed.name };
      return {
        title,
        link: it.link || it.guid || '',
        summary:
          it.contentSnippet ||
          (it.content ? String(it.content).replace(/<[^>]+>/g, '').slice(0, 200) : ''),
        publishedAt,
        source,
        forceInclude: Boolean(feed.skipKeywordFilter)
      };
    });
    return items;
  } catch (err) {
    console.error(`Gagal fetch RSS ${feed.name}`, err.message || err);
    return [];
  }
};

const listKipNews = async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh =
      req.query?.refresh === '1' ||
      req.query?.refresh === 'true' ||
      req.query?.force === '1' ||
      req.query?.force === 'true';
    if (!forceRefresh && cache.items && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json(cache.items);
    }

    const all = await Promise.all(FEEDS.map(fetchOneFeed));
    const merged = all.flat();

    const filtered = merged
      .filter((it) => withinLastMonth(it.publishedAt))
      .filter((it) => it.forceInclude || matchesKeywords(it.title, it.summary));

    const seen = new Set();
    const unique = [];
    for (const item of filtered) {
      const key = (item.link || item.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    unique.sort((a, b) => {
      const da = new Date(a.publishedAt || 0).getTime();
      const db = new Date(b.publishedAt || 0).getTime();
      return db - da;
    });

    const result = unique.slice(0, 40);
    cache = { items: result, fetchedAt: now };

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memuat berita KIP' });
  }
};

module.exports = {
  listKipNews
};
