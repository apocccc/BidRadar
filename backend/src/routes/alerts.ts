import { Router, Request, Response } from 'express';
import { getAlerts, addAlert, deleteAlert, toggleAlert } from '../services/alertService';
import { runNotifications, runTestNotification } from '../services/notifier';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(getAlerts());
});

router.post('/', (req: Request, res: Response) => {
  const { label, query, prefecture, category } = req.body as Record<string, string>;
  if (!label) { res.status(400).json({ error: 'label is required' }); return; }
  const alert = addAlert({ label, query: query ?? '', prefecture: prefecture ?? '', category: category ?? '', enabled: true });
  res.json(alert);
});

router.delete('/:id', (req: Request, res: Response) => {
  deleteAlert(String(req.params.id));
  res.json({ ok: true });
});

router.patch('/:id/toggle', (req: Request, res: Response) => {
  toggleAlert(String(req.params.id));
  res.json({ ok: true });
});

// テスト送信（スナップショット無視で現在の最新件数を送る）
router.post('/test', async (_req: Request, res: Response) => {
  try {
    await runTestNotification();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
