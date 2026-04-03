import 'dotenv/config';
import { runNotifications } from './services/notifier';

console.log('[notify-job] 開始');
runNotifications()
  .then(() => { console.log('[notify-job] 完了'); process.exit(0); })
  .catch(err => { console.error('[notify-job] エラー:', err); process.exit(1); });
