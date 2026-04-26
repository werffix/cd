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
app.get('/uploads/support/:filename', (req, res, next) => {
  const supportPath = path.join(__dirname, 'uploads', 'support', req.params.filename);
  if (fs.existsSync(supportPath)) {
    return res.sendFile(supportPath);
  }

  const legacyPath = path.join(__dirname, 'uploads', req.params.filename);
  if (fs.existsSync(legacyPath)) {
    return res.sendFile(legacyPath);
  }

  return next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = process.env.JWT_SECRET || 'cdcult_super_secret_2026';
const PORT = process.env.PORT || 3000;
const DMB_BASE_URL = process.env.DMB_BASE_URL || 'https://dmb.sundesiremedia.com';
const DMB_LOGIN = process.env.DMB_LOGIN || 'CDCULT_RECORDS';
const DMB_PASSWORD = process.env.DMB_PASSWORD || 'Durka040!';

['uploads', 'uploads/covers', 'uploads/tracks', 'uploads/support'].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// Настройка Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'cover') cb(null, 'uploads/covers');
    else if (file.fieldname === 'track_audio') cb(null, 'uploads/tracks');
    else if (file.fieldname === 'attachment') cb(null, 'uploads/support');
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

const uploadSupportAttachment = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(png|jpe?g|pdf|doc|docx)$/i.test(file.originalname);
    if (allowedExt || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Допустимы только PNG, JPG, PDF, DOC и DOCX'), false);
  },
}).single('attachment');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Токен не найден' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    const blocked = buildAuthBlockedPayload(user);
    if (blocked) return res.status(blocked.status).json(blocked.payload);
    req.user = { id: user.id, login: user.login, role: user.role };
    next();
  }
  catch { res.status(401).json({ error: 'Невалидный токен' }); }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для админов' });
  next();
};

const staffOnly = (req, res, next) => {
  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Только для сотрудников' });
  }
  next();
};

const buildAuthBlockedPayload = (user) => {
  if (user.account_status === 'pending') {
    return {
      status: 403,
      payload: {
        error: 'Заявка на регистрацию ещё рассматривается',
        code: 'pending_review',
        title: 'Мы рассматриваем вашу заявку',
        reason: 'Проверяем данные аккаунта и доступ к кабинету. Обычно это занимает до 2 дней.',
      },
    };
  }

  if (user.account_status === 'rejected') {
    return {
      status: 403,
      payload: {
        error: 'Заявка на регистрацию отклонена',
        code: 'registration_rejected',
        title: 'Заявка отклонена',
        reason: user.status_reason || 'Модератор отклонил заявку. Проверьте данные и обратитесь в поддержку.',
      },
    };
  }

  if (user.account_status === 'blocked') {
    return {
      status: 403,
      payload: {
        error: 'Аккаунт заблокирован',
        code: 'account_blocked',
        title: 'Аккаунт заблокирован',
        reason: user.status_reason || 'Доступ к аккаунту ограничен. Обратитесь к модератору для уточнения деталей.',
      },
    };
  }

  return null;
};

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 9 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

const decodeUploadedName = (name = '') => {
  if (!/[ÐÑ]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch (error) {
    return name;
  }
};

const serializeUser = (user) => ({
  id: user.id,
  login: user.login,
  name: user.name,
  email: user.email,
  role: user.role,
  telegram: user.telegram || '',
  avatar: user.avatar || '',
  account_status: user.account_status || 'active',
  status_reason: user.status_reason || '',
});

const serializeSupportTicket = (ticket) => ({
  ...ticket,
  attachment_url: ticket.attachment_url || '',
});

const FILE_MANAGER_FOLDERS = {
  covers: {
    label: 'Обложки',
    fsPath: path.join(__dirname, 'uploads', 'covers'),
    urlPrefix: '/uploads/covers',
  },
  tracks: {
    label: 'Файлы треков',
    fsPath: path.join(__dirname, 'uploads', 'tracks'),
    urlPrefix: '/uploads/tracks',
  },
  support: {
    label: 'Вложения поддержки',
    fsPath: path.join(__dirname, 'uploads', 'support'),
    urlPrefix: '/uploads/support',
  },
  misc: {
    label: 'Прочие файлы',
    fsPath: path.join(__dirname, 'uploads'),
    urlPrefix: '/uploads',
  },
};

const getManagedFolderConfig = (folderKey) => FILE_MANAGER_FOLDERS[folderKey] || null;

const listManagedFolderFiles = (folderKey) => {
  const folder = getManagedFolderConfig(folderKey);
  if (!folder || !fs.existsSync(folder.fsPath)) return [];

  return fs.readdirSync(folder.fsPath)
    .filter((name) => {
      const absolutePath = path.join(folder.fsPath, name);
      if (!fs.statSync(absolutePath).isFile()) return false;
      if (folderKey !== 'misc') return true;
      return !['covers', 'tracks', 'support'].includes(name);
    })
    .map((name) => {
      const absolutePath = path.join(folder.fsPath, name);
      const stats = fs.statSync(absolutePath);
      return {
        name,
        size: stats.size,
        modified_at: stats.mtime.toISOString(),
        url: `${folder.urlPrefix}/${encodeURIComponent(name)}`,
      };
    })
    .sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime());
};

const resolveManagedFilePath = (folderKey, filename) => {
  const folder = getManagedFolderConfig(folderKey);
  if (!folder || !filename || filename.includes('/') || filename.includes('\\')) return null;
  const absolutePath = path.join(folder.fsPath, filename);
  if (!absolutePath.startsWith(folder.fsPath)) return null;
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;
  return absolutePath;
};

const collectCookies = (response, existingCookie = '') => {
  const nextCookies = new Map();
  existingCookie
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [name, ...rest] = pair.split('=');
      if (name && rest.length) nextCookies.set(name, rest.join('='));
    });

  const setCookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  setCookieHeaders.forEach((cookie) => {
    const [pair] = cookie.split(';');
    const [name, ...rest] = pair.split('=');
    if (name && rest.length) nextCookies.set(name.trim(), rest.join('=').trim());
  });

  return Array.from(nextCookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
};

const fetchWithCookies = async (url, options = {}, cookie = '') => {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect || 'manual',
  });
  const nextCookie = collectCookies(response, cookie);
  return { response, cookie: nextCookie };
};

const extractInputNameByPlaceholder = (html, placeholder) => {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<input[^>]*name="([^"]+)"[^>]*placeholder="${escaped}"[^>]*>|<input[^>]*placeholder="${escaped}"[^>]*name="([^"]+)"[^>]*>`, 'i'));
  return match?.[1] || match?.[2] || null;
};

const extractFormAction = (html, marker) => {
  const index = html.indexOf(marker);
  if (index === -1) return null;
  const before = html.lastIndexOf('<form', index);
  const after = html.indexOf('</form>', index);
  if (before === -1 || after === -1) return null;
  const formChunk = html.slice(before, after);
  const actionMatch = formChunk.match(/action="([^"]+)"/i);
  return actionMatch?.[1] || null;
};

const toAbsoluteUrl = (value) => {
  if (!value) return null;
  const normalizedValue = value.replace('/albums/view&', '/albums/view?');
  if (/^https?:\/\//i.test(normalizedValue)) return normalizedValue;
  return new URL(normalizedValue, DMB_BASE_URL).toString();
};

const normalizeDmbUpc = (value) => {
  const raw = (value || '').trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, ' ');
  if (/no\s+upc|not\s+issued|not\s+generated|not\s+available|yet/i.test(compact)) {
    return null;
  }

  const digits = compact.replace(/[^\d]/g, '');
  if (digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }

  return null;
};

const fetchUpcFromDmb = async ({ artist, title }) => {
  const normalizedArtist = (artist || '').split(',')[0].trim();
  const normalizedTitle = (title || '').trim();
  if (!normalizedArtist || !normalizedTitle) return null;

  console.log('[DMB][UPC] start', {
    artist: normalizedArtist,
    title: normalizedTitle,
  });

  let cookie = '';

  const loginPage = await fetchWithCookies(DMB_BASE_URL, { method: 'GET' }, cookie);
  cookie = loginPage.cookie;
  const loginHtml = await loginPage.response.text();
  const loginAction = toAbsoluteUrl(extractFormAction(loginHtml, 'placeholder="Ваш Логин"') || '/');
  const loginField = extractInputNameByPlaceholder(loginHtml, 'Ваш Логин') || 'login';
  const passwordField = extractInputNameByPlaceholder(loginHtml, 'Ваш Пароль') || 'pass';

  console.log('[DMB][UPC] login page parsed', {
    status: loginPage.response.status,
    loginAction,
    loginField,
    passwordField,
    hasLoginPlaceholder: loginHtml.includes('placeholder="Ваш Логин"'),
    hasPasswordPlaceholder: loginHtml.includes('placeholder="Ваш Пароль"'),
  });

  const loginBody = new URLSearchParams();
  loginBody.set('action', 'login');
  loginBody.set(loginField, DMB_LOGIN);
  loginBody.set(passwordField, DMB_PASSWORD);

  const loginResult = await fetchWithCookies(loginAction, {
    method: 'POST',
    body: loginBody,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  }, cookie);
  cookie = loginResult.cookie;

  const loginResultHtml = await loginResult.response.text();
  console.log('[DMB][UPC] login result', {
    status: loginResult.response.status,
    redirected: loginResult.response.status >= 300 && loginResult.response.status < 400,
    location: loginResult.response.headers.get('location') || null,
    hasLogoutMarker: /logout|выйти/i.test(loginResultHtml),
    hasAlbumsListMarker: /albums\/list|Название|Артист/i.test(loginResultHtml),
  });

  const listUrl = `${DMB_BASE_URL}/ru/albums/list/`;
  const listPage = await fetchWithCookies(listUrl, { method: 'GET' }, cookie);
  cookie = listPage.cookie;
  const listHtml = await listPage.response.text();
  const titleField = extractInputNameByPlaceholder(listHtml, 'Название') || 'f_album_like';
  const artistField = extractInputNameByPlaceholder(listHtml, 'Артист') || 'f_artist_like';

  console.log('[DMB][UPC] list page parsed', {
    status: listPage.response.status,
    titleField,
    artistField,
    hasTitlePlaceholder: listHtml.includes('placeholder="Название"'),
    hasArtistPlaceholder: listHtml.includes('placeholder="Артист"'),
  });

  const searchUrl = new URL(listUrl);
  searchUrl.searchParams.set(titleField, normalizedTitle);
  searchUrl.searchParams.set(artistField, normalizedArtist);

  const searchResult = await fetchWithCookies(searchUrl.toString(), {
    method: 'GET',
  }, cookie);
  cookie = searchResult.cookie;
  const searchHtml = await searchResult.response.text();

  console.log('[DMB][UPC] search result', {
    status: searchResult.response.status,
    searchUrl: searchUrl.toString(),
    hasOpenReleaseLink: /Open release for view/i.test(searchHtml),
    hasBarcodeBlock: /barcode-readonly-value/i.test(searchHtml),
    snippet: searchHtml.replace(/\s+/g, ' ').slice(0, 300),
  });

  const releaseLinkMatch = searchHtml.match(/<a[^>]+title="Open release for view"[^>]+href="([^"]+)"|<a[^>]+href="([^"]+)"[^>]+title="Open release for view"/i);
  const releaseUrl = toAbsoluteUrl(releaseLinkMatch?.[1] || releaseLinkMatch?.[2]);
  if (!releaseUrl) {
    console.log('[DMB][UPC] release link not found');
    return null;
  }

  console.log('[DMB][UPC] release link found', { releaseUrl });

  const detailResult = await fetchWithCookies(releaseUrl, { method: 'GET' }, cookie);
  const detailHtml = await detailResult.response.text();
  const upcMatch = detailHtml.match(/readonly-input-value barcode-readonly-value[^>]*>\s*([^<\s][^<]*)\s*</i);
  const upcRaw = upcMatch?.[1]?.trim() || null;
  const upc = normalizeDmbUpc(upcRaw);

  console.log('[DMB][UPC] detail parsed', {
    status: detailResult.response.status,
    hasBarcodeBlock: /barcode-readonly-value/i.test(detailHtml),
    upcFound: Boolean(upc),
    upcRaw,
    upcPreview: upc ? `${upc.slice(0, 4)}...${upc.slice(-4)}` : null,
  });

  return upc;
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { login, email, name, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ error: 'Пароли не совпадают' });
  const hash = await bcrypt.hash(password, 10);
  try {
    db.prepare('INSERT INTO users (login, email, name, password, role, account_status, status_reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(login, email, name, hash, 'artist', 'pending', '');
    res.json({
      success: true,
      title: 'Мы рассмотрим вашу заявку в течение 2 дней',
      description: 'Проверим данные аккаунта, после чего откроем доступ к кабинету артиста. Как только заявка будет одобрена, вы сможете войти под своим логином и паролем.',
    });
  } catch { res.status(409).json({ error: 'Логин или email заняты' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE login = ? OR email = ?').get(login, login);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const blocked = buildAuthBlockedPayload(user);
  if (blocked) return res.status(blocked.status).json(blocked.payload);
  const token = jwt.sign({ id: user.id, login: user.login, role: user.role }, JWT_SECRET);
  res.json({ token, user: serializeUser(user) });
});

app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(serializeUser(user));
});

app.put('/api/profile', auth, async (req, res) => {
  const { name, email, telegram, avatar, oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const nextName = typeof name === 'string' ? name.trim() : user.name;
  const nextEmail = typeof email === 'string' ? email.trim() : user.email;
  const nextTelegram = typeof telegram === 'string' ? telegram.trim() : (user.telegram || '');
  const nextAvatar = typeof avatar === 'string' ? avatar : (user.avatar || '');

  let nextPassword = user.password;
  if (newPassword) {
    if (!oldPassword) return res.status(400).json({ error: 'Укажите текущий пароль' });
    const matches = await bcrypt.compare(oldPassword, user.password);
    if (!matches) return res.status(400).json({ error: 'Текущий пароль неверный' });
    nextPassword = await bcrypt.hash(newPassword, 10);
  }

  try {
    db.prepare('UPDATE users SET name = ?, email = ?, telegram = ?, avatar = ?, password = ? WHERE id = ?')
      .run(nextName, nextEmail, nextTelegram, nextAvatar, nextPassword, req.user.id);
  } catch (error) {
    return res.status(409).json({ error: 'Email уже используется' });
  }

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, user: serializeUser(updatedUser) });
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
    
    const { trackTitle, trackArtists, lyricsAuthors, musicAuthors, explicit, instrumental, isrc, trackIndex } = req.body;
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
      instrumental: instrumental === 'true',
      isrc: isrc,
      audio_file: audioUrl,
      original_filename: req.file ? decodeUploadedName(req.file.originalname) : null,
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
  const releases = db.prepare(`
    SELECT r.id, r.title, r.subtitle, r.artists, r.status, r.cover_url, r.created_at, r.metadata, r.release_type, l.label_name
    FROM releases r
    LEFT JOIN labels l ON l.user_id = r.user_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(releases);
});

app.get('/api/releases/:id', auth, (req, res) => {
  const release = db.prepare(`
    SELECT r.*, l.label_name
    FROM releases r
    LEFT JOIN labels l ON l.user_id = r.user_id
    WHERE r.id = ? AND r.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  res.json(release);
});

app.put('/api/releases/:id/status', auth, (req, res) => {
  const { status } = req.body;
  const release = db.prepare('SELECT status FROM releases WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  if (status === 'revoked' && release.status !== 'shipped') {
    return res.status(400).json({ error: 'Отозвать можно только доставленные релизы' });
  }
  db.prepare('UPDATE releases SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/releases/:id', auth, (req, res) => {
  const release = db.prepare('SELECT status FROM releases WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  if (!['draft', 'moderation', 'delivered'].includes(release.status)) {
    return res.status(400).json({ error: 'Удалить можно только черновики, релизы на рассмотрении или ожидающие доставки' });
  }
  db.prepare('DELETE FROM releases WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.get('/api/admin/releases', auth, staffOnly, (req, res) => {
  const releases = db.prepare(`
    SELECT r.*, u.login as artist_login, u.email as artist_email, l.label_name
    FROM releases r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN labels l ON l.user_id = u.id
    WHERE r.status != 'draft'
    ORDER BY r.created_at DESC
  `).all();
  res.json(releases);
});

app.get('/api/admin/my-releases', auth, staffOnly, (req, res) => {
  const releases = db.prepare(`
    SELECT r.id, r.user_id, r.title, r.subtitle, r.artists, r.status, r.cover_url, r.created_at, r.metadata, r.release_type, l.label_name
    FROM releases r
    LEFT JOIN labels l ON l.user_id = r.user_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(releases);
});

app.put('/api/admin/releases/:id', auth, staffOnly, (req, res) => {
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

app.delete('/api/admin/releases/:id', auth, staffOnly, (req, res) => {
  const release = db.prepare('SELECT user_id FROM releases WHERE id = ?').get(req.params.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  if (req.user.role !== 'admin' && Number(release.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  db.prepare('DELETE FROM releases WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id,
      u.login,
      u.email,
      u.name,
      u.role,
      u.telegram,
      u.avatar,
      u.account_status,
      u.status_reason,
      u.created_at,
      COUNT(r.id) AS releases_count
    FROM users u
    LEFT JOIN releases r ON r.user_id = u.id AND r.status != 'draft'
    GROUP BY u.id
    ORDER BY datetime(u.created_at) DESC
  `).all();
  res.json(users.map((item) => ({ ...serializeUser(item), created_at: item.created_at, releases_count: item.releases_count })));
});

app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const releases = db.prepare(`
    SELECT id, title, subtitle, artists, status, cover_url, created_at, metadata, release_type
    FROM releases
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(req.params.id);
  res.json({
    user: serializeUser(user),
    releases,
  });
});

app.post('/api/admin/users/:id/reset-password', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя сбросить пароль самому себе этим действием' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const nextPassword = generatePassword();
  const hash = await bcrypt.hash(nextPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true, password: nextPassword });
});

app.put('/api/admin/users/:id/promote', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  db.prepare('UPDATE users SET role = ?, account_status = ? WHERE id = ?').run('admin', 'active', req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/users/:id/set-role', auth, adminOnly, (req, res) => {
  const nextRole = typeof req.body.role === 'string' ? req.body.role.trim() : '';
  if (!['artist', 'moderator', 'admin'].includes(nextRole)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }
  if (Number(req.params.id) === req.user.id && nextRole !== 'admin') {
    return res.status(400).json({ error: 'Нельзя снять админку самому себе' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  db.prepare('UPDATE users SET role = ?, account_status = ? WHERE id = ?').run(nextRole, 'active', req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/users/:id/block', auth, adminOnly, (req, res) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ error: 'Укажите причину блокировки' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  db.prepare('UPDATE users SET account_status = ?, status_reason = ? WHERE id = ?').run('blocked', reason, req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/users/:id/unblock', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  db.prepare('UPDATE users SET account_status = ?, status_reason = ? WHERE id = ?').run('active', '', req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/registration-requests', auth, adminOnly, (req, res) => {
  const requests = db.prepare(`
    SELECT id, login, email, name, role, telegram, avatar, account_status, status_reason, created_at
    FROM users
    WHERE account_status = 'pending'
    ORDER BY datetime(created_at) DESC
  `).all();
  res.json(requests.map((item) => ({ ...serializeUser(item), created_at: item.created_at })));
});

app.put('/api/admin/registration-requests/:id/approve', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Заявка не найдена' });
  db.prepare('UPDATE users SET account_status = ?, status_reason = ? WHERE id = ?').run('active', '', req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/registration-requests/:id/reject', auth, adminOnly, (req, res) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ error: 'Укажите причину отклонения' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Заявка не найдена' });

  db.prepare('UPDATE users SET account_status = ?, status_reason = ? WHERE id = ?').run('rejected', reason, req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/labels', auth, adminOnly, (req, res) => {
  const labels = db.prepare(`
    SELECT l.*, u.login, u.email, u.name
    FROM labels l
    JOIN users u ON u.id = l.user_id
    ORDER BY datetime(l.updated_at) DESC
  `).all();
  res.json(labels);
});

app.post('/api/admin/labels', auth, adminOnly, (req, res) => {
  const userQuery = typeof req.body.userQuery === 'string' ? req.body.userQuery.trim() : '';
  const labelName = typeof req.body.labelName === 'string' ? req.body.labelName.trim() : '';
  if (!userQuery || !labelName) return res.status(400).json({ error: 'Укажите логин/email и название лейбла' });

  const targetUser = db.prepare('SELECT * FROM users WHERE login = ? OR email = ?').get(userQuery, userQuery);
  if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

  db.prepare(`
    INSERT INTO labels (user_id, label_name, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      label_name = excluded.label_name,
      updated_at = CURRENT_TIMESTAMP
  `).run(targetUser.id, labelName);

  res.json({ success: true });
});

app.get('/api/support/tickets', auth, (req, res) => {
  const tickets = db.prepare(`
    SELECT st.*, COUNT(sm.id) AS messages_count
    FROM support_tickets st
    LEFT JOIN support_messages sm ON sm.ticket_id = st.id
    WHERE st.user_id = ?
    GROUP BY st.id
    ORDER BY
      CASE WHEN st.status = 'open' THEN 0 ELSE 1 END,
      datetime(st.updated_at) DESC
  `).all(req.user.id);
  res.json(tickets.map(serializeSupportTicket));
});

app.post('/api/support/tickets', auth, (req, res) => {
  uploadSupportAttachment(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!category || !subject || !message) return res.status(400).json({ error: 'Заполните раздел, тему и сообщение' });

    const result = db.prepare(`
      INSERT INTO support_tickets (user_id, category, subject, admin_unread, artist_unread)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, category, subject, 1, 0);
    const attachmentUrl = req.file ? `/uploads/support/${req.file.filename}` : '';
    db.prepare(`
      INSERT INTO support_messages (ticket_id, user_id, author_role, message, attachment_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, req.user.id, req.user.role, message, attachmentUrl);
    db.prepare('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(result.lastInsertRowid);

    res.json({ success: true, id: result.lastInsertRowid });
  });
});

app.get('/api/support/tickets/:id', auth, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'Запрос не найден' });
  db.prepare('UPDATE support_tickets SET artist_unread = 0 WHERE id = ?').run(req.params.id);

  const messages = db.prepare(`
    SELECT sm.*, u.name, u.login
    FROM support_messages sm
    LEFT JOIN users u ON u.id = sm.user_id
    WHERE sm.ticket_id = ?
    ORDER BY datetime(sm.created_at) ASC
  `).all(req.params.id);
  res.json({
    ticket: serializeSupportTicket({ ...ticket, artist_unread: 0 }),
    messages: messages.map(serializeSupportTicket),
  });
});

app.post('/api/support/tickets/:id/messages', auth, (req, res) => {
  uploadSupportAttachment(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!ticket) return res.status(404).json({ error: 'Запрос не найден' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Тикет уже закрыт' });

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Введите сообщение' });
    const attachmentUrl = req.file ? `/uploads/support/${req.file.filename}` : '';

    db.prepare(`
      INSERT INTO support_messages (ticket_id, user_id, author_role, message, attachment_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, req.user.role, message, attachmentUrl);
    db.prepare('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP, status = ?, admin_unread = 1, artist_unread = 0 WHERE id = ?').run('open', req.params.id);
    res.json({ success: true });
  });
});

app.put('/api/support/tickets/:id/close', auth, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!ticket) return res.status(404).json({ error: 'Запрос не найден' });
  db.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('closed', req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/support/tickets', auth, staffOnly, (req, res) => {
  const tickets = db.prepare(`
    SELECT st.*, u.login, u.email, u.name, COUNT(sm.id) AS messages_count
    FROM support_tickets st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN support_messages sm ON sm.ticket_id = st.id
    GROUP BY st.id
    ORDER BY
      CASE WHEN st.status = 'open' THEN 0 ELSE 1 END,
      datetime(st.updated_at) DESC
  `).all();
  res.json(tickets);
});

app.get('/api/admin/support/tickets/:id', auth, staffOnly, (req, res) => {
  const ticket = db.prepare(`
    SELECT st.*, u.login, u.email, u.name
    FROM support_tickets st
    JOIN users u ON u.id = st.user_id
    WHERE st.id = ?
  `).get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

  const messages = db.prepare(`
    SELECT sm.*, u.name, u.login
    FROM support_messages sm
    LEFT JOIN users u ON u.id = sm.user_id
    WHERE sm.ticket_id = ?
    ORDER BY datetime(sm.created_at) ASC
  `).all(req.params.id);

  db.prepare('UPDATE support_tickets SET admin_unread = 0 WHERE id = ?').run(req.params.id);
  res.json({ ticket: { ...ticket, admin_unread: 0 }, messages });
});

app.post('/api/admin/support/tickets/:id/messages', auth, staffOnly, (req, res) => {
  uploadSupportAttachment(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Введите сообщение' });
    const attachmentUrl = req.file ? `/uploads/support/${req.file.filename}` : '';

    db.prepare(`
      INSERT INTO support_messages (ticket_id, user_id, author_role, message, attachment_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, req.user.role, message, attachmentUrl);
    db.prepare('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP, status = ?, artist_unread = 1, admin_unread = 0 WHERE id = ?').run('open', req.params.id);
    res.json({ success: true });
  });
});

app.put('/api/admin/support/tickets/:id/close', auth, staffOnly, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
  db.prepare('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('closed', req.params.id);
  res.json({ success: true });
});

app.post('/api/releases/:id/request-upc', auth, (req, res) => {
  const release = db.prepare('SELECT id, user_id, title, artists, metadata FROM releases WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });

  const releaseStatusRow = db.prepare('SELECT status FROM releases WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (releaseStatusRow?.status !== 'shipped') {
    return res.status(400).json({ error: 'Запрос доступен только после доставки релиза на площадки.' });
  }

  let metadata = {};
  try {
    metadata = release.metadata ? JSON.parse(release.metadata) : {};
  } catch (e) {
    metadata = {};
  }

  if (metadata.upc) {
    return res.status(400).json({ error: 'UPC уже указан для этого релиза' });
  }

  fetchUpcFromDmb({
    artist: release.artists || '',
    title: release.title || '',
  })
    .then((upc) => {
      if (!upc) {
        return res.status(404).json({ error: 'Попробуйте позже, UPC еще не готов' });
      }

      const nextMetadata = {
        ...metadata,
        upc,
        upc_requested: false,
      };

      db.prepare('UPDATE releases SET metadata = ? WHERE id = ?').run(JSON.stringify(nextMetadata), release.id);
      return res.json({ success: true, upc });
    })
    .catch((error) => {
      console.error('DMB UPC request failed', error);
      return res.status(502).json({ error: 'Не удалось получить UPC автоматически. Попробуйте позже.' });
    });
});

app.get('/api/admin/upc-requests', auth, adminOnly, (req, res) => {
  const requests = db.prepare(`
    SELECT ur.*, u.login as artist_login, u.email as artist_email
    FROM upc_requests ur
    JOIN users u ON ur.user_id = u.id
    ORDER BY
      CASE WHEN ur.status = 'pending' THEN 0 ELSE 1 END,
      ur.requested_at DESC
  `).all();
  res.json(requests);
});

app.put('/api/admin/upc-requests/:id', auth, adminOnly, (req, res) => {
  const { upc } = req.body;
  const normalizedUpc = typeof upc === 'string' ? upc.trim() : '';
  if (!normalizedUpc) return res.status(400).json({ error: 'Введите UPC код' });

  const request = db.prepare('SELECT * FROM upc_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Запрос не найден' });

  const release = db.prepare('SELECT metadata FROM releases WHERE id = ?').get(request.release_id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });

  let metadata = {};
  try {
    metadata = release.metadata ? JSON.parse(release.metadata) : {};
  } catch (e) {
    metadata = {};
  }
  metadata.upc = normalizedUpc;
  metadata.upc_requested = false;

  db.prepare('UPDATE releases SET metadata = ? WHERE id = ?').run(JSON.stringify(metadata), request.release_id);
  db.prepare('UPDATE upc_requests SET upc_code = ?, status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(normalizedUpc, 'resolved', req.params.id);

  res.json({ success: true });
});

app.get('/api/admin/files', auth, adminOnly, (req, res) => {
  const folders = Object.entries(FILE_MANAGER_FOLDERS).map(([key, config]) => ({
    key,
    label: config.label,
    files: listManagedFolderFiles(key),
  }));
  res.json({ folders });
});

app.delete('/api/admin/files/:folder/:filename', auth, adminOnly, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const absolutePath = resolveManagedFilePath(req.params.folder, filename);
  if (!absolutePath) return res.status(404).json({ error: 'Файл не найден' });

  fs.unlinkSync(absolutePath);
  res.json({ success: true });
});

app.delete('/api/admin/files/:folder', auth, adminOnly, (req, res) => {
  const folder = getManagedFolderConfig(req.params.folder);
  if (!folder) return res.status(404).json({ error: 'Папка не найдена' });

  const files = listManagedFolderFiles(req.params.folder);
  files.forEach((file) => {
    const absolutePath = resolveManagedFilePath(req.params.folder, file.name);
    if (absolutePath) fs.unlinkSync(absolutePath);
  });

  res.json({ success: true, deleted: files.length });
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
