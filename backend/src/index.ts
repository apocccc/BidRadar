import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import tendersRouter from './routes/tenders';
import alertsRouter from './routes/alerts';
import settingsRouter from './routes/settings';
import { startNotifier, runNotifications } from './services/notifier';

const app = express();
const PORT = process.env.PORT ?? 3003;

app.use(cors());
app.use(express.json());
app.use('/api/tenders', tendersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/settings', settingsRouter);

startNotifier();

app.post('/api/notify/run', async (_req, res) => {
  void runNotifications();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`BidRadar backend running on port ${PORT}`);
});
