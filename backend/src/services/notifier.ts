import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { getAlerts } from './alertService';
import { getSlackWebhookUrl } from './settingsService';

const KKJ_API = 'https://www.kkj.go.jp/api/';
const SNAPSHOT_FILE = path.join(__dirname, '../../data/snapshots.json');

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

// 前回通知時のIDスナップショットを読み書き
function loadSnapshots(): Record<string, string[]> {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8')) as Record<string, string[]>; }
  catch { return {}; }
}
function saveSnapshot(alertId: string, ids: string[]) {
  const snapshots = loadSnapshots();
  snapshots[alertId] = ids;
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
}

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
      const year = 2018 + Number(m[1]);
      return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    } else if (m.length === 3) {
      const now = new Date();
      const month = Number(m[1]);
      const day = Number(m[2]);
      const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

type TenderItem = {
  key: string;
  name: string;
  organization: string;
  prefecture: string;
  url: string;
  docUrls: string[];
  caseNumber: string;
  lgCode: string;
  publishedAt: string;
  bidDate: string;
};

async function fetchTendersForPref(query: string, prefCode: string, category: string): Promise<TenderItem[]> {
  const params = new URLSearchParams();
  params.set('Type', '1');
  params.set('Count', '50');
  params.set('Query', query || '入札');
  if (prefCode) params.set('Prefcode', prefCode);
  if (category) params.set('Category', category);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(`${KKJ_API}?${params.toString()}`, { signal: controller.signal });
  clearTimeout(timer);
  const xml = await res.text();

  const items = xml.split('<SearchResult>').slice(1);
  const results: TenderItem[] = [];

  for (const item of items) {
    const get = (tag: string) =>
      item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))?.[1]?.trim() ?? '';
    const getAll = (tag: string) =>
      [...item.matchAll(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'gs'))]
        .map(m => m[1]?.trim() ?? '').filter(Boolean);

    const name = get('ProjectName');
    const description = get('ProjectDescription');
    const key = get('Key') || `${name}__${get('OrganizationName')}`;
    const allUrls = getAll('ExternalDocumentURI');
    const docUrls = allUrls.filter(u => !u.includes('p-portal.go.jp'));
    const url = allUrls[0] ?? '';

    const caseNumber = description.match(/調達案件番号(\d{10,})/)?.[1] ?? '';
    const lgCode = get('LgCode');

    results.push({
      key,
      name,
      organization: get('OrganizationName'),
      prefecture: get('PrefectureName'),
      url,
      docUrls,
      caseNumber,
      lgCode,
      publishedAt: get('CftIssueDate'),
      bidDate: extractBidDate(name + ' ' + description),
    });
  }

  return results;
}

async function searchTenders(query: string, prefecture: string, category: string): Promise<TenderItem[]> {
  const prefCodes = prefecture ? prefecture.split(',').filter(Boolean) : [];
  const prefTargets = prefCodes.length > 0 ? prefCodes : [''];

  const allResults = await Promise.all(prefTargets.map(code => fetchTendersForPref(query, code, category)));

  const seen = new Set<string>();
  const deduped: TenderItem[] = [];
  for (const items of allResults) {
    for (const item of items) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        deduped.push(item);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return deduped.filter(t => {
    if (prefCodes.length > 0 && t.lgCode && !prefCodes.some(code => t.lgCode.startsWith(code))) return false;
    if (t.bidDate && t.bidDate < today) return false;
    return true;
  });
}

async function sendSlack(text: string) {
  const webhookUrl = getSlackWebhookUrl();
  console.log(`[slack] URL設定: ${webhookUrl ? `あり(${webhookUrl.length}文字)` : 'なし'}`);
  if (!webhookUrl) { console.warn('[notifier] Slack Webhook URL が未設定'); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    console.log(`[slack] レスポンス: ${res.status}`);
  } catch (e) {
    console.error('[slack] 送信エラー:', e);
  } finally {
    clearTimeout(timer);
  }
}

async function runNotifications() {
  const alerts = getAlerts().filter(a => a.enabled);
  if (alerts.length === 0) return;

  console.log(`[notifier] ${alerts.length}件のアラートをチェック中...`);
  const snapshots = loadSnapshots();

  for (const alert of alerts) {
    try {
      const allTenders = await searchTenders(alert.query || alert.label, alert.prefecture, alert.category);
      const currentIds = allTenders.map(t => t.key);
      const prevIds = new Set(snapshots[alert.id] ?? []);

      // 初回は全件をスナップショットに保存するだけ（通知なし）
      if (!snapshots[alert.id]) {
        saveSnapshot(alert.id, currentIds);
        console.log(`[notifier] 「${alert.label}」初回スナップショット保存: ${currentIds.length}件`);
        continue;
      }

      // 前回にはなかった新着案件のみ抽出
      const newTenders = allTenders.filter(t => !prevIds.has(t.key));

      if (newTenders.length === 0) {
        console.log(`[notifier] 「${alert.label}」新着なし`);
        await sendSlack(`✅ *BidRadar 定期チェック完了*\n🔍「${alert.label}」｜新着案件なし`);
        continue;
      }

      const lines = newTenders.map(t => {
        const loc = t.prefecture ? ` / ${t.prefecture}` : '';
        const bid = t.bidDate ? `｜入札日 ${t.bidDate.slice(5, 10).replace('-', '/')}` : '';
        const docs = t.docUrls.map(u => `<${u}|${docLabel(u)}>`);
        if (docs.length === 0 && t.url) docs.push(`<${t.url}|${docLabel(t.url)}>`);
        const docsLine = docs.length > 0 ? `\n  📎 ${docs.join('　')}` : '';
        const caseNumberLine = t.caseNumber ? `\n  \`${t.caseNumber}\`` : '';
        return `• *${t.name}*\n  ${t.organization}${loc}${bid}${caseNumberLine}${docsLine}`;
      }).join('\n\n');

      const message = `📡 *BidRadar 新着案件通知*\n🔍 検索条件：「${alert.label}」\n新着 ${newTenders.length} 件\n\n${lines}`;
      await sendSlack(message);

      // スナップショット更新
      saveSnapshot(alert.id, currentIds);
      console.log(`[notifier] 「${alert.label}」→ 新着${newTenders.length}件をSlackに送信`);
    } catch (e) {
      console.error(`[notifier] 「${alert.label}」エラー:`, e);
    }
  }
}

export function startNotifier() {
  cron.schedule('0 6 * * *', () => {
    console.log('[notifier] 朝6時の通知を実行');
    void runNotifications();
  }, { timezone: 'Asia/Tokyo' });

  cron.schedule('0 18 * * *', () => {
    console.log('[notifier] 18時の通知を実行');
    void runNotifications();
  }, { timezone: 'Asia/Tokyo' });

  console.log('[notifier] 毎日6時・18時(JST)の通知スケジュールを設定しました');
}

export async function runTestNotification() {
  const alerts = getAlerts().filter(a => a.enabled);
  console.log(`[test] ${alerts.length}件のアラートをテスト送信`);
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    const tenders = await searchTenders(alert.query || alert.label, alert.prefecture, alert.category);
    console.log(`[test] 「${alert.label}」→ ${tenders.length}件取得`);
    const preview = tenders.slice(0, 5);

    if (preview.length === 0) {
      await sendSlack(`📡 *BidRadar テスト送信*\n🔍「${alert.label}」\n該当案件が見つかりませんでした。`);
      continue;
    }

    const lines = preview.map(t => {
      const loc = t.prefecture ? ` / ${t.prefecture}` : '';
      const bid = t.bidDate ? `｜入札日 ${t.bidDate.slice(5, 10).replace('-', '/')}` : '';
      const caseNumberLine = t.caseNumber ? `\n  \`${t.caseNumber}\`` : '';
      const docs = t.docUrls.map(u => {
        const ext = u.split('.').pop()?.toUpperCase() ?? 'ファイル';
        const label = /siy(o|ō)usyo|仕様書/i.test(u) ? '仕様書' : ext;
        return `<${u}|${label}>`;
      });
      if (docs.length === 0 && t.url) {
        const label = t.url.includes('p-portal.go.jp') ? '調達ポータルで確認' : '公告を開く';
        docs.push(`<${t.url}|${label}>`);
      }
      const docsLine = docs.length > 0 ? `\n  📎 ${docs.join('　')}` : '';
      return `• *${t.name}*\n  ${t.organization}${loc}${bid}${caseNumberLine}${docsLine}`;
    }).join('\n\n');

    await sendSlack(`📡 *BidRadar テスト送信*\n🔍「${alert.label}」の最新${preview.length}件\n\n${lines}`);
  }
}

export { runNotifications };
