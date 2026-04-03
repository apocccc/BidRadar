import { useState } from 'react'
import AlertsPage from './AlertsPage'
import PrefectureMultiSelect, { PREFECTURES } from './PrefectureMultiSelect'

type Tender = {
  id: string;
  name: string;
  organization: string;
  prefecture: string;
  city: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
  description: string;
  bidDate: string;
  category: string;
};

function loadFavoriteItems(): Tender[] {
  try { return JSON.parse(localStorage.getItem('bidradar_fav_items') ?? '[]') as Tender[]; }
  catch { return []; }
}
function saveFavoriteItems(items: Tender[]) {
  localStorage.setItem('bidradar_fav_items', JSON.stringify(items));
}

const CATEGORIES = [
  { code: '物品', name: '物品' },
  { code: '工事', name: '工事' },
  { code: '役務', name: '役務' },
];

function passesQualFilter(tender: Tender): boolean {
  const text = tender.name + ' ' + tender.description;
  if (!/全省庁統一資格/.test(text)) return true;
  return /又は[ＤD]|[ＤD](?:の)?等級|[ＤD]等に/.test(text);
}

const CATEGORY_STYLE: Record<string, string> = {
  '工事': 'bg-orange-50 text-orange-600',
  '物品': 'bg-emerald-50 text-emerald-600',
  '役務': 'bg-violet-50 text-violet-600',
};

function TenderCard({ tender, isFav, onToggleFav }: { tender: Tender; isFav: boolean; onToggleFav: () => void }) {
  return (
    <div className={`bg-white rounded-xl border p-4 transition hover:shadow-sm ${isFav ? 'border-blue-300' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggleFav}
          className={`mt-0.5 text-xl flex-shrink-0 transition ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}>
          {isFav ? '★' : '☆'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {tender.url ? (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <a href={tender.url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm leading-snug hover:underline">
                    {tender.name || '（案件名なし）'}
                  </a>
                  {tender.url.includes('p-portal.go.jp') && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">調達ポータル</span>
                  )}
                </span>
              ) : (
                <p className="font-semibold text-sm text-gray-900 leading-snug">{tender.name || '（案件名なし）'}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {(tender.prefecture || tender.city) && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    📍 {[tender.prefecture, tender.city].filter(Boolean).join(' ')}
                  </span>
                )}
                {tender.category && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_STYLE[tender.category] ?? 'bg-gray-100 text-gray-500'}`}>
                    {tender.category}
                  </span>
                )}
              </div>
              {tender.description && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{tender.description}</p>
              )}
            </div>
            <div className="flex-shrink-0 flex flex-col gap-1.5">
              {tender.bidDate && (
                <div className="text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2 min-w-[68px]">
                  <p className="text-xs text-red-400 font-medium">入札日</p>
                  <p className="text-base font-black text-red-500 leading-tight">{tender.bidDate.slice(5, 10).replace('-', '/')}</p>
                  <p className="text-xs text-red-300">{tender.bidDate.slice(0, 4)}</p>
                </div>
              )}
              {tender.publishedAt && (
                <div className="text-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-w-[68px]">
                  <p className="text-xs text-gray-400 font-medium">公告日</p>
                  <p className="text-sm font-bold text-gray-600 leading-tight">{tender.publishedAt.slice(5, 10).replace('-', '/')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<'search' | 'favorites' | 'alerts'>('search');
  const [query, setQuery] = useState('');
  const [prefecture, setPrefecture] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [count, setCount] = useState('20');
  const [results, setResults] = useState<Tender[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favItems, setFavItems] = useState<Tender[]>(loadFavoriteItems);
  const [dRankOnly, setDRankOnly] = useState(true);
  const [sortKey, setSortKey] = useState<'publishedAt_desc' | 'publishedAt_asc' | 'bidDate_asc' | 'bidDate_desc'>('publishedAt_desc');

  const favIds = new Set(favItems.map(t => t.id));

  const toggleFavorite = (tender: Tender) => {
    setFavItems(prev => {
      const next = favIds.has(tender.id)
        ? prev.filter(t => t.id !== tender.id)
        : [...prev, tender];
      saveFavoriteItems(next);
      return next;
    });
  };

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (prefecture.length > 0) params.set('prefecture', prefecture.join(','));
      if (category) params.set('category', category);
      params.set('count', count);
      const res = await fetch(`/api/tenders?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { total: number; items: Tender[] };
      setTotal(data.total);
      setResults(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const filtered = (dRankOnly ? results.filter(passesQualFilter) : results).slice().sort((a, b) => {
    if (sortKey === 'publishedAt_desc') return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
    if (sortKey === 'publishedAt_asc')  return (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '');
    if (sortKey === 'bidDate_asc')  return (a.bidDate || 'z').localeCompare(b.bidDate || 'z');
    if (sortKey === 'bidDate_desc') return (b.bidDate || '').localeCompare(a.bidDate || '');
    return 0;
  });

  const selectCls = "border border-gray-200 bg-white text-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition";

  return (
    <div className="relative min-h-screen z-10">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900">📡 BidRadar</h1>
            <p className="text-xs text-gray-400">官公庁入札案件まとめ</p>
          </div>
          <nav className="flex gap-1">
            {([
              { key: 'search', label: '🔍 検索' },
              { key: 'favorites', label: `★ お気に入り${favItems.length > 0 ? ` (${favItems.length})` : ''}` },
              { key: 'alerts', label: '🔔 アラート' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setPage(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                  page === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {page === 'search' && (
          <>
            {/* 検索フォーム */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void search()}
                placeholder="キーワードで検索（例：システム開発、清掃、印刷）"
                className="w-full border border-gray-200 text-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400 transition"
              />
              <div className="flex flex-wrap gap-2 items-center">
                <PrefectureMultiSelect value={prefecture} onChange={setPrefecture} />
                <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
                  <option value="">// 全カテゴリ</option>
                  {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
                <select value={count} onChange={e => setCount(e.target.value)} className={selectCls}>
                  <option value="10">10件</option>
                  <option value="20">20件</option>
                  <option value="50">50件</option>
                </select>
                <button onClick={() => void search()} disabled={loading}
                  className="ml-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm transition">
                  {loading ? '検索中...' : '🔍 検索'}
                </button>
              </div>
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-950/30 rounded-lg px-4 py-3 text-red-400 text-sm font-mono">
                ERROR: {error}
              </div>
            )}

            {total !== null && !loading && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-sm text-gray-500">
                  <span className="text-gray-800 font-semibold">{filtered.length}</span> 件表示 / 全 {total.toLocaleString()} 件
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as typeof sortKey)}
                    className="border border-gray-200 bg-white text-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  >
                    <option value="publishedAt_desc">公告日：新しい順</option>
                    <option value="publishedAt_asc">公告日：古い順</option>
                    <option value="bidDate_asc">入札日：近い順</option>
                    <option value="bidDate_desc">入札日：遠い順</option>
                  </select>
                  <button onClick={() => setDRankOnly(v => !v)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
                      dRankOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>
                    全省庁統一資格：Dランクのみ
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-16 text-slate-400 text-sm animate-pulse">
                検索中...
              </div>
            )}
            {!loading && results.length === 0 && total === null && (
              <div className="text-center py-20 text-slate-500 text-sm">
                <p className="text-3xl mb-3 opacity-20">📡</p>
                キーワードや条件を入力して検索してください
              </div>
            )}
            {!loading && results.length === 0 && total !== null && (
              <div className="text-center py-16 text-slate-500 text-sm">該当する案件が見つかりませんでした</div>
            )}

            <div className="space-y-2">
              {filtered.map(tender => (
                <TenderCard key={tender.id} tender={tender} isFav={favIds.has(tender.id)} onToggleFav={() => toggleFavorite(tender)} />
              ))}
            </div>
          </>
        )}

        {page === 'alerts' && <AlertsPage />}

        {page === 'favorites' && (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-mono font-bold text-cyan-400 tracking-widest">★ SAVED TENDERS</h2>
              <span className="text-xs text-slate-500 font-mono">{favItems.length} ITEMS</span>
            </div>
            {favItems.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-sm font-mono">
                <p className="text-2xl mb-3 opacity-30">☆</p>
                NO SAVED ITEMS<br />
                <button onClick={() => setPage('search')} className="mt-3 text-cyan-500 hover:text-cyan-300 text-xs transition">
                  → SEARCH AND SAVE
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {favItems.map(tender => (
                  <TenderCard key={tender.id} tender={tender} isFav={true} onToggleFav={() => toggleFavorite(tender)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
