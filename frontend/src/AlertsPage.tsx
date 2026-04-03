import { useState, useEffect } from 'react';
import PrefectureMultiSelect, { PREFECTURES } from './PrefectureMultiSelect';

type Alert = {
  id: string;
  label: string;
  query: string;
  prefecture: string;
  category: string;
  enabled: boolean;
  createdAt: string;
};

const CATEGORIES = [
  { code: '物品', name: '物品' },
  { code: '工事', name: '工事' },
  { code: '役務', name: '役務' },
];

// ラベルから都道府県コードとキーワードを自動解析
function parseLabel(text: string): { prefCode: string; keyword: string } {
  for (const p of PREFECTURES) {
    // "京都府" "京都" "東京都" "東京" いずれにもマッチ
    const shortName = p.name.replace(/[都道府県]$/, '');
    const re = new RegExp(`(${p.name}|${shortName})(?:の|の)?`);
    const m = text.match(re);
    if (m) {
      const keyword = text.replace(m[0], '').trim();
      return { prefCode: p.code, keyword };
    }
  }
  return { prefCode: '', keyword: text.trim() };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [prefecture, setPrefecture] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingMsg, setPingMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/alerts');
    if (res.ok) setAlerts(await res.json() as Alert[]);
  };

  const loadSettings = async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const s = await res.json() as { slackWebhookUrl: string };
      setWebhookUrl(s.slackWebhookUrl ?? '');
    }
  };

  useEffect(() => { void load(); void loadSettings(); }, []);

  const saveWebhook = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackWebhookUrl: webhookUrl }),
    });
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 2000);
  };

  const pingSlack = async () => {
    setPinging(true);
    setPingMsg(null);
    try {
      const res = await fetch('/api/settings/slack-ping', { method: 'POST' });
      setPingMsg(res.ok ? '✅ Slackに届きました！' : '❌ 送信失敗（URLを確認してください）');
    } catch {
      setPingMsg('❌ 送信失敗');
    } finally {
      setPinging(false);
    }
  };

  const handleLabelChange = (value: string) => {
    setLabel(value);
    // まだキーワードと都道府県を手動設定していない場合のみ自動解析
    const { prefCode, keyword } = parseLabel(value);
    if (prefCode) setPrefecture([prefCode]);
    if (keyword) setQuery(keyword);
  };

  const add = async () => {
    if (!label.trim()) return;
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, query, prefecture: prefecture.join(','), category }),
    });
    setLabel(''); setQuery(''); setPrefecture([]); setCategory('');
    void load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    void load();
  };

  const toggle = async (id: string) => {
    await fetch(`/api/alerts/${id}/toggle`, { method: 'PATCH' });
    void load();
  };

  const testNow = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      await fetch('/api/alerts/test', { method: 'POST' });
      setTestMsg('Slackに送信しました！');
    } catch {
      setTestMsg('送信に失敗しました');
    } finally {
      setTesting(false);
    }
  };

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-full";
  const selectCls = "border border-gray-200 bg-white text-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 shadow-sm">
        <h2 className="font-bold text-gray-700">Slack 通知設定</h2>
        <p className="text-xs text-gray-400">Incoming Webhook URL を設定してください。<a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-blue-500 underline">Slack Apps</a> でチャンネルごとにURLを発行できます。</p>
        <div className="flex gap-2">
          <input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className={`${inputCls} flex-1 font-mono text-xs`}
          />
          <button onClick={() => void saveWebhook()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition flex-shrink-0">
            {webhookSaved ? '保存済み ✓' : '保存'}
          </button>
          <button onClick={() => void pingSlack()} disabled={pinging || !webhookUrl}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm font-semibold rounded-lg transition flex-shrink-0">
            {pinging ? '送信中...' : '接続テスト'}
          </button>
        </div>
        {pingMsg && <p className="text-sm">{pingMsg}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 shadow-sm">
        <h2 className="font-bold text-gray-700">＋ アラートを追加</h2>
        <input value={label} onChange={e => handleLabelChange(e.target.value)}
          placeholder="アラート名（例：東京のシステム開発）"
          className={inputCls} />
        <p className="text-xs text-gray-400">都道府県名を含めると自動で検索条件を設定します</p>
        <div className="flex flex-wrap gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="検索キーワード（必須）"
            className={`${inputCls} flex-1 min-w-[140px]`} />
          <PrefectureMultiSelect value={prefecture} onChange={setPrefecture} />
          <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
            <option value="">カテゴリ（全て）</option>
            {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={() => void add()} disabled={!label.trim() || !query.trim()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-semibold rounded-lg text-sm transition">
          追加する
        </button>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">アラートがまだありません</div>
        )}
        {alerts.map(alert => (
          <div key={alert.id} className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition ${
            alert.enabled ? 'border-blue-200' : 'border-gray-200 opacity-60'
          }`}>
            <button onClick={() => void toggle(alert.id)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${alert.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${alert.enabled ? 'left-5' : 'left-1'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">{alert.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {[alert.query && `「${alert.query}」`, alert.prefecture && alert.prefecture.split(',').filter(Boolean).map(code => PREFECTURES.find(p => p.code === code)?.name ?? code).join('・'), alert.category].filter(Boolean).join(' / ') || '全件'}
              </p>
            </div>
            <button onClick={() => void remove(alert.id)}
              className="text-gray-300 hover:text-red-400 transition flex-shrink-0 text-lg">✕</button>
          </div>
        ))}
      </div>

      {alerts.some(a => a.enabled) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-700">通知スケジュール：毎日 6:00 / 18:00</p>
            <p className="text-xs text-gray-400 mt-0.5">今すぐSlackにテスト送信できます</p>
          </div>
          <button onClick={() => void testNow()} disabled={testing}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm font-semibold rounded-lg transition">
            {testing ? '送信中...' : '今すぐ送信'}
          </button>
        </div>
      )}
      {testMsg && (
        <p className="text-center text-sm text-green-600">{testMsg}</p>
      )}
    </div>
  );
}
