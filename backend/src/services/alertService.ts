import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export type Alert = {
  id: string;
  label: string;
  query: string;
  prefecture: string;
  category: string;
  enabled: boolean;
  createdAt: string;
};

const DATA_FILE = path.join(__dirname, '../../data/alerts.json');

function ensureFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

export function getAlerts(): Alert[] {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Alert[];
}

export function saveAlerts(alerts: Alert[]) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(alerts, null, 2));
  try {
    const repoRoot = path.join(__dirname, '../../../..');
    execSync('git add backend/data/alerts.json', { cwd: repoRoot });
    execSync('git diff --cached --quiet || git commit -m "chore: update alerts [skip ci]"', { cwd: repoRoot, shell: '/bin/sh' });
    execSync('git push', { cwd: repoRoot });
    console.log('[alertService] alerts.json をGitHubにプッシュしました');
  } catch (e) {
    console.warn('[alertService] GitHubへのプッシュに失敗:', e);
  }
}

export function addAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Alert {
  const alerts = getAlerts();
  const newAlert: Alert = { ...alert, id: Date.now().toString(), createdAt: new Date().toISOString() };
  alerts.push(newAlert);
  saveAlerts(alerts);
  return newAlert;
}

export function deleteAlert(id: string) {
  saveAlerts(getAlerts().filter(a => a.id !== id));
}

export function toggleAlert(id: string) {
  const alerts = getAlerts().map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
  saveAlerts(alerts);
}
