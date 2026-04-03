import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

type Settings = {
  slackWebhookUrl: string;
};

function load(): Settings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Settings;
  } catch {
    return { slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? '' };
  }
}

function save(settings: Settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function getSlackWebhookUrl(): string {
  return load().slackWebhookUrl || process.env.SLACK_WEBHOOK_URL || '';
}

export function setSlackWebhookUrl(url: string) {
  save({ ...load(), slackWebhookUrl: url });
}

export function getSettings(): Settings {
  return load();
}
