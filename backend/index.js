require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = process.env.JWT_SECRET || 'cdcult_super_secret_2026';
const PORT = process.env.PORT || 3000;

['uploads', 'uploads/covers', 'uploads/tracks'].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// Настройка Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover') cb(null, 'uploads/covers');
    else if (file.fieldname === 'track_audio') cb(null, 'uploads/tracks');
    else cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCover = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения!'), false);
  }
}).single('cover');

const uploadTrack = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('audio') || file.originalname.endsWith('.wav') || file.originalname.endsWith('.flac')) cb(null, true);
    else cb(new Error('Только аудио файлы!'), false);
  }
}).single('track_audio');

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

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { login, email, name, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ error: 'Пароли не совпадают' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (login, email, name, password) VALUES (?, ?, ?, ?)').run(login, email, name, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, login, role: 'artist' }, JWT_SECRET);
    res.json({ token, user: { login, email, name, role: 'artist' } });
  } catch { res.status(409).json({ error: 'Логин или email заняты' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE login = ? OR email = ?').get(login, login);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const token = jwt.sign({ id: user.id, login: user.login, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, login: user.login, name: user.name, email: user.email, role: user.role, telegram: user.telegram || '' } });
});

// Create Release with Cover
app.post('/api/releases', auth, (req, res) => {
  uploadCover(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    
    const { title, subtitle, type, artists, genre, status, archive_url, metadata } = req.body;
    const coverUrl = req.file ? `/uploads/covers/${req.file.filename}` : null;
    
    const stmt = db.prepare('INSERT INTO releases (user_id, title, subtitle, release_type, artists, genre, status, cover_url, archive_url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(req.user.id, title, subtitle, type, artists, genre, status, coverUrl, archive_url, metadata || '{}');
    res.json({ id: result.lastInsertRowid, status, cover_url: coverUrl });
  });
});

app.put('/api/releases/:id', auth, (req, res) => {
  uploadCover(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const releaseId = req.params.id;
    const release = db.prepare('SELECT metadata, cover_url FROM releases WHERE id = ? AND user_id = ?').get(releaseId, req.user.id);
    if (!release) return res.status(404).json({ error: 'Релиз не найден' });

    let existingMeta = {};
    try {
      existingMeta = release.metadata ? JSON.parse(release.metadata) : {};
    } catch (e) {
      existingMeta = {};
    }

    let incomingMeta = {};
    if (req.body.metadata) {
      try {
        incomingMeta = JSON.parse(req.body.metadata);
      } catch (e) {
        incomingMeta = {};
      }
    }

    if (Array.isArray(incomingMeta.tracks)) {
      const existingTracks = Array.isArray(existingMeta.tracks) ? existingMeta.tracks : [];
      incomingMeta.tracks = incomingMeta.tracks.map((track, index) => ({
        ...existingTracks[index],
        ...track,
      }));
      if (existingTracks.length > incomingMeta.tracks.length) {
        incomingMeta.tracks = [...incomingMeta.tracks, ...existingTracks.slice(incomingMeta.tracks.length)];
      }
    }

    const mergedMeta = { ...existingMeta, ...incomingMeta };

    const coverUrl = req.file ? `/uploads/covers/${req.file.filename}` : release.cover_url;
    const { title, subtitle, type, artists, genre, status, archive_url } = req.body;
    db.prepare(
      'UPDATE releases SET title = ?, subtitle = ?, release_type = ?, artists = ?, genre = ?, status = ?, cover_url = ?, archive_url = ?, metadata = ? WHERE id = ? AND user_id = ?',
    ).run(
      title,
      subtitle,
      type,
      artists,
      genre,
      status,
      coverUrl,
      archive_url || '',
      JSON.stringify(mergedMeta),
      releaseId,
      req.user.id,
    );

    res.json({ success: true, cover_url: coverUrl });
  });
});

// Upload Track to Release
app.post('/api/releases/:releaseId/tracks', auth, (req, res) => {
  uploadTrack(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    
    const { trackTitle, trackArtists, lyricsAuthors, musicAuthors, explicit, isrc, trackIndex } = req.body;
    const audioUrl = req.file ? `/uploads/tracks/${req.file.filename}` : null;
    const releaseId = req.params.releaseId;

    const release = db.prepare('SELECT metadata FROM releases WHERE id = ? AND user_id = ?').get(releaseId, req.user.id);
    if (!release) return res.status(404).json({ error: 'Релиз не найден' });

    // БЕЗОПАСНОЕ ИЗВЛЕЧЕНИЕ МЕТАДАННЫХ
    let meta = {};
    try {
      meta = release.metadata ? JSON.parse(release.metadata) : {};
    } catch (e) {
      meta = {};
    }
    
    // Если tracks нет, создаем пустой массив
    if (!Array.isArray(meta.tracks)) {
      meta.tracks = [];
    }

    const normalizedTrack = {
      title: trackTitle,
      track_title: trackTitle,
      artists: trackArtists,
      track_artists: trackArtists,
      lyrics_authors: lyricsAuthors || '',
      music_authors: musicAuthors || '',
      explicit: explicit === 'true',
      isrc: isrc,
      audio_file: audioUrl,
      original_filename: req.file ? req.file.originalname : null,
      mime_type: req.file ? req.file.mimetype : null
    };

    const parsedTrackIndex = Number.parseInt(trackIndex, 10);
    if (Number.isInteger(parsedTrackIndex) && meta.tracks[parsedTrackIndex]) {
      meta.tracks[parsedTrackIndex] = {
        ...meta.tracks[parsedTrackIndex],
        ...normalizedTrack,
      };
    } else {
      meta.tracks.push(normalizedTrack);
    }

    db.prepare('UPDATE releases SET metadata = ? WHERE id = ?').run(JSON.stringify(meta), releaseId);
    res.json({ success: true, audio_file: audioUrl });
  });
});

app.get('/api/releases', auth, (req, res) => {
  const releases = db.prepare('SELECT id, title, artists, status, cover_url, created_at, metadata, release_type FROM releases WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(releases);
});

app.get('/api/admin/releases', auth, adminOnly, (req, res) => {
  const releases = db.prepare(`SELECT r.*, u.login as artist_login, u.email as artist_email FROM releases r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`).all();
  res.json(releases);
});

app.put('/api/admin/releases/:id', auth, adminOnly, (req, res) => {
  const { status, moderator_comment } = req.body;
  const release = db.prepare('SELECT metadata FROM releases WHERE id = ?').get(req.params.id);
  let meta = {};
  try {
    meta = release?.metadata ? JSON.parse(release.metadata) : {};
  } catch (e) {
    meta = {};
  }
  if (typeof moderator_comment === 'string' && moderator_comment.trim()) {
    meta.moderator_comment = moderator_comment.trim();
  }
  db.prepare('UPDATE releases SET status = ?, metadata = ? WHERE id = ?').run(status, JSON.stringify(meta), req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/releases/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM releases WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Seed Admin
(async () => {
  const exists = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
  if (!exists) {
    const hash = await bcrypt.hash('AdminPass123', 10);
    db.prepare('INSERT INTO users (login, email, name, password, role) VALUES (?, ?, ?, ?, ?)').run('admin', 'admin@cdcult.ru', 'Главный Админ', hash, 'admin');
    console.log('✅ Админ создан: admin / AdminPass123');
  }
})();

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
