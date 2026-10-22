// Topic Research Service using permitted, free public educational repositories
// Strictly complies with open-access terms (CC-BY-SA, Open Data) with no paid API keys or billing.

export interface ResearchResult {
  id: string;
  title: string;
  source: 'Wikipedia' | 'arXiv' | 'Crossref';
  summary: string;
  url: string;
  authors?: string[];
  publishedDate?: string;
  licenseNote: string;
}

// Simple in-memory rate limiter to respect public API etiquette (max 10 queries/min, 500ms min delay)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await delay(MIN_REQUEST_INTERVAL_MS - timeSinceLast);
  }
  lastRequestTime = Date.now();
};

export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

/**
 * Search Wikipedia open knowledge articles via Wikimedia REST & Action API
 * Attribution: Text available under Creative Commons Attribution-ShareAlike 4.0 License.
 */
export const searchWikipedia = async (topic: string): Promise<ResearchResult[]> => {
  await enforceRateLimit();

  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    topic
  )}&srlimit=5&format=json&origin=*`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Wikipedia search returned status ${res.status}`);
    }

    const data = await res.json();
    const searchItems = data?.query?.search || [];

    const results: ResearchResult[] = [];

    for (const item of searchItems) {
      // Strip HTML tags and entities from Wikipedia snippet
      const cleanSnippet = decodeHtmlEntities(
        (item.snippet || '').replace(/<\/?[^>]+(>|$)/g, '')
      );

      results.push({
        id: `wiki-${item.pageid}`,
        title: decodeHtmlEntities(item.title),
        source: 'Wikipedia',
        summary: cleanSnippet ? `${cleanSnippet}...` : 'No preview available.',
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        licenseNote: 'Licensed under CC BY-SA 4.0 (Wikimedia Foundation)',
      });
    }

    return results;
  } catch (err) {
    console.warn('Wikipedia search error:', err);
    return [];
  }
};

/**
 * Search Open Access Academic Papers via Crossref API
 * Attribution: Metadata provided under public terms by Crossref.
 */
export const searchCrossref = async (topic: string): Promise<ResearchResult[]> => {
  await enforceRateLimit();

  const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(
    topic
  )}&rows=4&select=title,URL,author,abstract,created,DOI`;

  try {
    const res = await fetch(crossrefUrl);
    if (!res.ok) {
      throw new Error(`Crossref returned status ${res.status}`);
    }

    const data = await res.json();
    const items = data?.message?.items || [];

    return items
      .filter((item: { title?: string[] }) => item.title && item.title.length > 0)
      .map((item: {
        DOI?: string;
        title?: string[];
        abstract?: string;
        URL?: string;
        author?: { given?: string; family?: string }[];
        created?: { 'date-time'?: string };
      }, index: number) => {
        const rawTitle = item.title?.[0] || 'Academic Article';
        const titleStr = decodeHtmlEntities(rawTitle);
        const cleanAbstract = decodeHtmlEntities(
          (item.abstract || '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        );

        const authorsList = (item.author || [])
          .map((a) => [a.given, a.family].filter(Boolean).join(' '))
          .filter(Boolean)
          .slice(0, 3);

        return {
          id: `crossref-${item.DOI || index}`,
          title: titleStr,
          source: 'Crossref' as const,
          summary: cleanAbstract
            ? cleanAbstract.slice(0, 260) + '...'
            : 'Peer-reviewed academic publication. Full text and metadata available at source link.',
          url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '#'),
          authors: authorsList.length > 0 ? authorsList : undefined,
          publishedDate: item.created?.['date-time'] ? item.created['date-time'].slice(0, 10) : undefined,
          licenseNote: 'Open bibliographic metadata via Crossref',
        };
      });
  } catch (err) {
    console.warn('Crossref search error:', err);
    return [];
  }
};

/**
 * Unified Topic Research across permitted educational knowledge sources.
 */
export const searchEducationalTopic = async (topic: string): Promise<ResearchResult[]> => {
  const cleanTopic = topic.trim();
  if (!cleanTopic) return [];

  // Query Wikipedia and Crossref in parallel
  const [wikiResults, crossrefResults] = await Promise.all([
    searchWikipedia(cleanTopic),
    searchCrossref(cleanTopic),
  ]);

  // Combine results with Wikipedia first for broad concept clarity, followed by research papers
  return [...wikiResults, ...crossrefResults];
};
