import Parser from "rss-parser";

// Constants
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_RESULTS = 40;
const MIN_SUMMARY_LENGTH = 20;
const LAST_MONTH_DAYS = 30;

const parser = new Parser({ timeout: 10000 });

const FEEDS = [
  { name: "Antara", url: "https://www.antaranews.com/rss/terkini" },
  { name: "Tempo Nasional", url: "https://rss.tempo.co/nasional" },
  { name: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/rss" },
  { name: "Republika", url: "https://www.republika.co.id/rss" },
  {
    name: "Google News (Keterbukaan Informasi)",
    url: "https://news.google.com/rss/search?q=keterbukaan%20informasi%20publik&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (Komisi Informasi)",
    url: "https://news.google.com/rss/search?q=komisi%20informasi&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (PPID)",
    url: "https://news.google.com/rss/search?q=ppid&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (Sengketa Informasi)",
    url: "https://news.google.com/rss/search?q=sengketa%20informasi%20publik&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (Transparansi Pemerintah)",
    url: "https://news.google.com/rss/search?q=transparansi%20pemerintah&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (Open Data Indonesia)",
    url: "https://news.google.com/rss/search?q=open%20data%20indonesia&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Google News (Keterbukaan Data)",
    url: "https://news.google.com/rss/search?q=keterbukaan%20data%20pemerintah&hl=id&gl=ID&ceid=ID:id",
    sourceFromTitle: true,
    skipKeywordFilter: true,
  },
  {
    name: "Bing News (Keterbukaan Informasi)",
    url: "https://www.bing.com/news/search?q=keterbukaan%20informasi%20publik&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (Komisi Informasi)",
    url: "https://www.bing.com/news/search?q=komisi%20informasi&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (PPID)",
    url: "https://www.bing.com/news/search?q=ppid&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (Sengketa Informasi)",
    url: "https://www.bing.com/news/search?q=sengketa%20informasi%20publik&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (Transparansi Pemerintah)",
    url: "https://www.bing.com/news/search?q=transparansi%20pemerintah&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (Open Data Indonesia)",
    url: "https://www.bing.com/news/search?q=open%20data%20indonesia&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
  {
    name: "Bing News (Keterbukaan Data)",
    url: "https://www.bing.com/news/search?q=keterbukaan%20data%20pemerintah&format=rss",
    skipKeywordFilter: true,
    isBing: true,
  },
];

const KEYWORDS = [
  "keterbukaan informasi",
  "informasi publik",
  "komisi informasi",
  "kip",
  "ppid",
  "transparansi",
  "keterbukaan data",
  "data terbuka",
  "open data",
  "transparansi anggaran",
  "transparansi pemerintah",
  "akuntabilitas publik",
  "akses informasi",
  "hak akses informasi",
  "uji konsekuensi",
  "permohonan informasi",
  "sengketa informasi",
];

let cache = { items: null, fetchedAt: 0 };

const normalizeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();

const withinLastMonth = (dateValue) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LAST_MONTH_DAYS);

  return date >= cutoff;
};

const matchesKeywords = (title, snippet) => {
  const haystack = `${title || ""} ${snippet || ""}`.toLowerCase();
  return KEYWORDS.some((keyword) => haystack.includes(keyword));
};

const extractSourceFromTitle = (rawTitle, fallbackSource) => {
  if (!rawTitle) return { title: "", source: fallbackSource };

  const parts = String(rawTitle).split(" - ");
  if (parts.length > 1) {
    const source = parts.pop().trim();
    const title = parts.join(" - ").trim();
    return { title, source: source || fallbackSource };
  }

  return { title: String(rawTitle).trim(), source: fallbackSource };
};

const isSummaryUseful = (title, summary) => {
  const normalizedTitle = normalizeText(title);
  const normalizedSummary = normalizeText(summary);

  if (!normalizedSummary || normalizedSummary.length < MIN_SUMMARY_LENGTH) {
    return false;
  }

  if (!normalizedTitle) return true;

  // Check for multiple short lines
  const lines = String(summary || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    const shortLines = lines.filter((line) => line.length < 140);
    if (shortLines.length >= 2) return false;
  }

  // Check for double spaces
  const doubleSpaceCount = (summary.match(/\u00A0\u00A0/g) || []).length;
  if (doubleSpaceCount >= 2) return false;

  // Check for unique words
  const titleWords = new Set(normalizedTitle.split(" ").filter(Boolean));
  const summaryWords = normalizedSummary.split(" ").filter(Boolean);

  let extraWords = 0;
  for (const word of summaryWords) {
    if (!titleWords.has(word)) {
      extraWords++;
      if (extraWords > 3) break;
    }
  }

  if (extraWords <= 3) return false;

  // Check for containment
  if (
    normalizedSummary.includes(normalizedTitle) &&
    normalizedSummary.length <= normalizedTitle.length + 40
  ) {
    return false;
  }

  if (
    normalizedTitle.includes(normalizedSummary) &&
    normalizedTitle.length <= normalizedSummary.length + 40
  ) {
    return false;
  }

  return true;
};

const resolveBingLink = (rawLink) => {
  try {
    const url = new URL(rawLink);
    const actual = url.searchParams.get("url");
    return actual ? decodeURIComponent(actual) : rawLink;
  } catch {
    return rawLink;
  }
};

const sourceFromUrl = (link, fallback) => {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, "") || fallback;
  } catch {
    return fallback;
  }
};

const fetchOneFeed = async (feed) => {
  try {
    const rss = await parser.parseURL(feed.url);

    const items = (rss.items || []).map((item) => {
      const publishedAt =
        item.isoDate || item.pubDate || item.published || null;
      const rawTitle = item.title || "";

      const { title, source: sourceFromTitleValue } = feed.sourceFromTitle
        ? extractSourceFromTitle(rawTitle, feed.name)
        : { title: rawTitle, source: feed.name };

      const rawLink = item.link || item.guid || "";
      const link = feed.isBing ? resolveBingLink(rawLink) : rawLink;

      const derivedSource = feed.isBing ? sourceFromUrl(link, feed.name) : null;

      const rawSummary =
        item.contentSnippet ||
        (item.content
          ? String(item.content)
              .replace(/<[^>]+>/g, "")
              .slice(0, 200)
          : "");

      const summary = isSummaryUseful(title, rawSummary) ? rawSummary : "";

      return {
        title,
        link,
        summary,
        publishedAt,
        source: derivedSource || sourceFromTitleValue || feed.name,
        forceInclude: Boolean(feed.skipKeywordFilter),
      };
    });

    return items;
  } catch (err) {
    console.error(`Gagal fetch RSS ${feed.name}`, err.message || err);
    return [];
  }
};

const deduplicateItems = (items) => {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = (item.link || item.title).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
};

const sortByPublishedDate = (items) => {
  return items.sort((a, b) => {
    const dateA = new Date(a.publishedAt || 0).getTime();
    const dateB = new Date(b.publishedAt || 0).getTime();
    return dateB - dateA;
  });
};

const listKipNews = async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh =
      ["1", "true"].includes(req.query?.refresh) ||
      ["1", "true"].includes(req.query?.force);

    // Return cached data if available and not expired
    if (!forceRefresh && cache.items && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json(cache.items);
    }

    // Fetch all feeds in parallel
    const allItems = await Promise.all(FEEDS.map(fetchOneFeed));
    const mergedItems = allItems.flat();

    // Filter items
    const filteredItems = mergedItems
      .filter((item) => withinLastMonth(item.publishedAt))
      .filter(
        (item) => item.forceInclude || matchesKeywords(item.title, item.summary)
      )
      .filter((item) => item.summary || !item.forceInclude);

    // Deduplicate and sort
    const uniqueItems = deduplicateItems(filteredItems);
    const sortedItems = sortByPublishedDate(uniqueItems);
    const result = sortedItems.slice(0, MAX_RESULTS);

    // Update cache
    cache = { items: result, fetchedAt: now };

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memuat berita KIP" });
  }
};

export { listKipNews };
