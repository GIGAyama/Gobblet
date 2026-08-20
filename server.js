import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 本番と同じ「ドメイン直下」で配信する。
// 独自ドメイン gobblet.giga-school.com ではアプリがドメイン直下に置かれ、
// manifest の scope / start_url も "./" なので、旧構成の /Gobblet/ の下で
// 動作確認すると本番と違う場所を見ることになる。
app.use('/', express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
