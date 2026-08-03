import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 本番（GitHub Pages）と同じ /Gobblet/ の下で配信する。
// manifest の scope / start_url は /Gobblet/ の絶対パスなので、
// ルート直下だけで動作確認すると「インストールできない」と誤診してしまう。
app.use('/Gobblet', express.static(__dirname));

app.get('/Gobblet', (req, res) => res.redirect('/Gobblet/'));
app.get('/', (req, res) => res.redirect('/Gobblet/'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/Gobblet/`);
});
