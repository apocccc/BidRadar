import { Router, Request, Response } from 'express';
import { getSettings, setSlackWebhookUrl, getSlackWebhookUrl } from '../services/settingsService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(getSettings());
});

router.patch('/', (req: Request, res: Response) => {
  const { slackWebhookUrl } = req.body as { slackWebhookUrl?: string };
  if (slackWebhookUrl !== undefined) {
    setSlackWebhookUrl(slackWebhookUrl);
  }
  res.json(getSettings());
});

router.post('/slack-ping', async (_req: Request, res: Response) => {
  const url = getSlackWebhookUrl();
  if (!url) { res.status(400).json({ error: 'Webhook URL未設定' }); return; }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '✅ BidRadar からのテスト送信です' }),
    });
    if (r.ok) {
      res.json({ ok: true });
    } else {
      res.status(500).json({ error: `Slack returned ${r.status}` });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
