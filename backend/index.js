require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'cdcult_super_secret_2026';
const PORT = process.env.PORT || 3000;

// 🔑 Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не найден' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Невалидный токен' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для админов' });
  next();
};

// 👤 Auth
app.post('/api/auth/register', async (req, res) => {
  const { login, email, name, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ error: 'Пароли не совпадают' });
  if (password.length < 6) return res.status(400).json({ error: 'Минимум 6 символов' });
  
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (login, email, name, password) VALUES (?, ?, ?, ?)')
      .run(login, email, name, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, login, role: 'artist' }, JWT_SECRET);
    res.json({ token, user: { login, email, name, role: 'artist' } });
  } catch { res.status(409).json({ error: 'Логин или email заняты' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE login = ? OR email = ?').get(login, login);
  if (!user || !(await bcrypt.compare(password, user.password))) 
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  
  const token = jwt.sign({ id: user.id, login: user.login, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, login: user.login, name: user.name, role: user.role } });
});

// 📦 Releases (Артист)
app.post('/api/releases', auth, (req, res) => {
  const { title, subtitle, type, artists, genre, status, cover_url, archive_url, metadata } = req.body;
  const stmt = db.prepare('INSERT INTO releases (user_id, title, subtitle, release_type, artists, genre, status, cover_url, archive_url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(req.user.id, title, subtitle, type, artists, genre, status, cover_url, archive_url, JSON.stringify(metadata || {}));
  res.json({ id: result.lastInsertRowid, status });
});

app.get('/api/releases', auth, (req, res) => {
  const releases = db.prepare('SELECT id, title, artists, status, cover_url, created_at FROM releases WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(releases);
});

// 👑 Admin
app.get('/api/admin/releases', auth, adminOnly, (req, res) => {
  const releases = db.prepare(`SELECT r.*, u.login as artist_login, u.email as artist_email FROM releases r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`).all();
  res.json(releases);
});

app.put('/api/admin/releases/:id', auth, adminOnly, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE releases SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// 🌱 Seed админа (удалите после первого запуска!)
(async () => {
  const exists = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
  if (!exists) {
    const hash = await bcrypt.hash('AdminPass123', 10);
    db.prepare('INSERT INTO users (login, email, name, password, role) VALUES (?, ?, ?, ?, ?)')
      .run('admin', 'admin@cdcult.ru', 'Главный Админ', hash, 'admin');
    console.log('✅ Админ создан: admin / AdminPass123');
  }
})();

app.listen(PORT, () => console.log(`🚀 Backend: http://localhost:${PORT}`));
