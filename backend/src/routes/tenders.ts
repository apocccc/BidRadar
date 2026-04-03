import { Router, Request, Response } from 'express';

const router = Router();
const KKJ_API = 'https://www.kkj.go.jp/api/';

function extractBidDate(text: string): string {
  const patterns = [
    /令和(\d+)年(\d+)月(\d+)日[^\n]*?入札/,
    /入札[^\n]*?令和(\d+)年(\d+)月(\d+)日/,
    /(\d+)月(\d+)日[^\n]*?入札/,
    /入札[^\n]*?(\d+)月(\d+)日/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    if (m.length === 4) {
      // 令和Y年M月D日
      const year = 2018 + Number(m[1]);
      return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    } else if (m.length === 3) {
      // M月D日のみ（年は公告日から推測）
      const now = new Date();
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

function docLabel(url: string): string {
  const u = url.toLowerCase();
  if (/shiyousho|仕様書|spec/.test(u)) return '仕様書';
  if (/nyusatsu|入札説明/.test(u)) return '入札説明書';
  if (/keiyaku|契約/.test(u)) return '契約書';
  if (/koukoku|公告/.test(u)) return '公告';
  if (/youkou|要項/.test(u)) return '要項';
  if (/p-portal\.go\.jp/.test(u)) return '調達ポータル';
  const ext = url.split('.').pop()?.toUpperCase();
  return ext && ['PDF','DOC','DOCX','XLS','XLSX'].includes(ext) ? ext : '書類';
}

function parseXmlTenders(xml: string) {
  const results: object[] = [];
  const hits = xml.match(/<SearchHits>(\d+)<\/SearchHits>/)?.[1] ?? '0';

  const items = xml.split('<SearchResult>').slice(1);
  for (const item of items) {
    const get = (tag: string) =>
      item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))?.[1]?.trim() ?? '';
    const getAll = (tag: string) =>
      [...item.matchAll(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'gs'))]
        .map(m => m[1]?.trim() ?? '').filter(Boolean);

    const name = get('ProjectName');
    const description = get('ProjectDescription');
    const bidDate = extractBidDate(name + ' ' + description);
    const allUrls = getAll('ExternalDocumentURI');
    const docs = allUrls.map(url => ({ url, label: docLabel(url) }));

    results.push({
      id: get('Key'),
      name,
      organization: get('OrganizationName'),
      prefecture: get('PrefectureName'),
      city: get('CityName'),
      category: get('Category'),
      publishedAt: get('CftIssueDate'),
      updatedAt: get('Date'),
      url: allUrls[0] ?? '',
      docs,
      description: description.slice(0, 600),
      bidDate,
    });
  }
  return { total: Number(hits), items: results };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const prefecture = typeof req.query.prefecture === 'string' ? req.query.prefecture : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const count = typeof req.query.count === 'string' ? req.query.count : '20';

    const prefCodes = prefecture ? prefecture.split(',').filter(Boolean) : [];

    const fetchForPref = async (code: string): Promise<object[]> => {
      const params = new URLSearchParams();
      params.set('Type', '1');
      params.set('Count', count);
      if (query) params.set('Query', query);
      if (code) params.set('Prefcode', code);
      if (category) params.set('Category', category);

      const apiRes = await fetch(`${KKJ_API}?${params.toString()}`);
      const xml = await apiRes.text();
      return parseXmlTenders(xml).items;
    };

    const prefTargets = prefCodes.length > 0 ? prefCodes : [''];
    const allResults = await Promise.all(prefTargets.map(fetchForPref));

    const seen = new Set<string>();
    const deduped: object[] = [];
    for (const items of allResults) {
      for (const item of items) {
        const id = (item as { id: string }).id;
        if (!seen.has(id)) {
          seen.add(id);
          deduped.push(item);
        }
      }
    }

    const filtered = prefCodes.length > 0
      ? deduped.filter(item => {
          const lgCode = String((item as Record<string, unknown>).lgCode ?? '');
          if (!lgCode) return true;
          return prefCodes.some(code => lgCode.startsWith(code));
        })
      : deduped;

    res.json({ total: filtered.length, items: filtered });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
