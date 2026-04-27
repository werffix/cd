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

const appendDmbExportLog = (releaseId, userId, level, message, details = {}) => {
  const normalizedLevel = ['info', 'success', 'error', 'warn'].includes(level) ? level : 'info';
  const detailsText = details && Object.keys(details).length ? JSON.stringify(details) : '';
  db.prepare(`
    INSERT INTO dmb_export_logs (release_id, user_id, level, message, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(releaseId, userId || null, normalizedLevel, message, detailsText);
  const logMethod = normalizedLevel === 'error' ? console.error : console.log;
  logMethod(`[DMB][EXPORT][${releaseId}] ${message}`, details);
};

const createDmbExportLogger = (releaseId, userId) => (level, message, details = {}) =>
  appendDmbExportLog(releaseId, userId, level, message, details);

const extractAllInputs = (html) => {
  const params = new URLSearchParams();
  const inputRegex = /<input\b([^>]*)>/gi;
  let match;
  while ((match = inputRegex.exec(html))) {
    const attrs = match[1];
    const name = attrs.match(/\bname="([^"]+)"/i)?.[1];
    if (!name) continue;
    const type = (attrs.match(/\btype="([^"]+)"/i)?.[1] || 'text').toLowerCase();
    if (['button', 'submit', 'file'].includes(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !/\bchecked\b/i.test(attrs)) continue;
    const value = attrs.match(/\bvalue="([^"]*)"/i)?.[1] || '';
    params.set(name, value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  }
  return params;
};

const dmbOptionValue = (html, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '(?:&|&amp;)');
  const match = html.match(new RegExp(`<a[^>]+value="([^"]+)"[^>]*>\\s*${escaped}\\s*</a>`, 'i'));
  return match?.[1] || '';
};

const detectDmbLanguage = (title = '') => (/[А-Яа-яЁё]/.test(title) ? 'ru' : 'en');
const dmbAlbumTypeValue = (type = '') => ({ album: '90', ep: '89', single: '91' }[String(type).toLowerCase()] || '91');
const randomCatalogNumber = () => Array.from({ length: 9 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
const splitPeople = (value = '') => String(value).split(',').map((item) => item.trim()).filter(Boolean);
const stripHtml = (value = '') => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&copy;/g, '©')
  .replace(/\s+/g, ' ')
  .trim();

const extractDmbIssues = (html = '') => {
  const issues = [];
  const issueRegex = /<li[^>]*class="[^"]*issue[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = issueRegex.exec(html))) {
    const text = stripHtml(match[1]);
    if (text && !issues.includes(text)) issues.push(text);
  }

  const badParams = [];
  const badParamRegex = /<span[^>]*class="bad-param-name"[^>]*>([\s\S]*?)<\/span>/gi;
  while ((match = badParamRegex.exec(html))) {
    const text = stripHtml(match[1]);
    if (text && !badParams.includes(text)) badParams.push(text);
  }

  const albumId = html.match(/\bid="album_id"\s+value="([^"]+)"/i)?.[1] || null;
  const issueIndex = html.search(/issue-text|bad-param-name|has-issues/i);
  const issueSnippet = issueIndex >= 0 ? stripHtml(html.slice(Math.max(0, issueIndex - 600), issueIndex + 1800)).slice(0, 1200) : '';
  return { issues, badParams, albumId, issueSnippet };
};

const findDmbAlbumId = (value) => {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    return /^\d+$/.test(text) && text !== '0' ? text : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDmbAlbumId(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const key of ['id', 'album_id', 'new_id', 'albumId']) {
      const found = findDmbAlbumId(value[key]);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findDmbAlbumId(item);
      if (found) return found;
    }
  }
  return null;
};

const setDmbMultiField = (params, field, values, roleValue) => {
  params.set(`${field}_values_count`, String(values.length));
  params.set(`${field}_values`, values.map((_, index) => index).join(','));
  values.forEach((value, index) => {
    const name = field === 'contributors' ? `line${index}_${field}` : `line${index}${field}`;
    const rolesName = field === 'contributors' ? `line${index}_${field}_roles` : `line${index}${field}_roles`;
    params.set(name, value);
    if (roleValue) params.set(rolesName, roleValue);
  });
};

const loginToDmb = async (log = () => {}) => {
  let cookie = '';
  const loginPage = await fetchWithCookies(DMB_BASE_URL, { method: 'GET' }, cookie);
  cookie = loginPage.cookie;
  const loginHtml = await loginPage.response.text();
  const loginAction = toAbsoluteUrl(extractFormAction(loginHtml, 'placeholder="Ваш Логин"') || '/');
  const loginField = extractInputNameByPlaceholder(loginHtml, 'Ваш Логин') || 'login';
  const passwordField = extractInputNameByPlaceholder(loginHtml, 'Ваш Пароль') || 'pass';
  log('info', 'Страница входа DMB открыта', { status: loginPage.response.status, loginField, passwordField });

  const loginBody = new URLSearchParams();
  loginBody.set('action', 'login');
  loginBody.set(loginField, DMB_LOGIN);
  loginBody.set(passwordField, DMB_PASSWORD);

  const loginResult = await fetchWithCookies(loginAction, {
    method: 'POST',
    body: loginBody,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }, cookie);
  cookie = loginResult.cookie;
  log('info', 'Вход в DMB выполнен', {
    status: loginResult.response.status,
    location: loginResult.response.headers.get('location') || null,
  });
  return cookie;
};

const findDmbReleaseByArtistAndTitle = async ({ cookie, artist, title, log = () => {} }) => {
  const normalizedArtist = String(artist || '').split(',')[0].trim();
  const normalizedTitle = String(title || '').trim();
  if (!normalizedArtist || !normalizedTitle) return null;

  const listUrl = `${DMB_BASE_URL}/ru/albums/list/`;
  const listPage = await fetchWithCookies(listUrl, { method: 'GET' }, cookie);
  const nextCookie = listPage.cookie;
  const listHtml = await listPage.response.text();
  const titleField = extractInputNameByPlaceholder(listHtml, 'Название') || 'f_album_like';
  const artistField = extractInputNameByPlaceholder(listHtml, 'Артист') || 'f_artist_like';

  const searchUrl = new URL(listUrl);
  searchUrl.searchParams.set(titleField, normalizedTitle);
  searchUrl.searchParams.set(artistField, normalizedArtist);

  const searchResult = await fetchWithCookies(searchUrl.toString(), { method: 'GET' }, nextCookie);
  const finalCookie = searchResult.cookie;
  const searchHtml = await searchResult.response.text();
  const releaseLinkMatch = searchHtml.match(/<a[^>]+title="Open release for view"[^>]+href="([^"]+)"|<a[^>]+href="([^"]+)"[^>]+title="Open release for view"/i);
  const releaseUrl = toAbsoluteUrl(releaseLinkMatch?.[1] || releaseLinkMatch?.[2]);
  const releaseId = releaseUrl?.match(/[?&]id=(\d+)/i)?.[1]
    || searchHtml.match(/\bid="album_id"\s+value="(\d+)"/i)?.[1]
    || null;

  log(releaseUrl ? 'info' : 'warn', releaseUrl ? 'DMB релиз найден через список' : 'DMB релиз не найден через список', {
    status: searchResult.response.status,
    artist: normalizedArtist,
    title: normalizedTitle,
    searchUrl: searchUrl.toString(),
    hasOpenReleaseLink: /Open release for view/i.test(searchHtml),
    releaseUrl,
    releaseId,
    responsePreview: searchHtml.replace(/\s+/g, ' ').slice(0, 320),
  });

  return {
    cookie: finalCookie,
    releaseUrl,
    releaseId,
  };
};

const extractDmbFormIds = (html = '') => {
  const params = extractAllInputs(html);
  return {
    recordId: params.get('id') || html.match(/\bid="id"[^>]*\bvalue="([^"]+)"/i)?.[1] || '',
    albumHiddenId: params.get('album_id') || html.match(/\bid="album_id"[^>]*\bvalue="([^"]+)"/i)?.[1] || '',
    aaRecId: params.get('aa_rec_id') || html.match(/\bid="aa_rec_id"[^>]*\bvalue="([^"]+)"/i)?.[1] || '',
    committedAlbumId: findDmbAlbumId(params.get('album_id'))
      || findDmbAlbumId(params.get('id'))
      || findDmbAlbumId(html.match(/\bid="album_id"[^>]*\bvalue="([^"]+)"/i)?.[1])
      || findDmbAlbumId(html.match(/\bid="id"[^>]*\bvalue="([^"]+)"/i)?.[1])
      || null,
  };
};

const fetchDmbReleasePayload = (releaseId) => {
  const release = db.prepare(`
    SELECT r.*, u.login as artist_login, u.email as artist_email, l.label_name
    FROM releases r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN labels l ON l.user_id = u.id
    WHERE r.id = ?
  `).get(releaseId);
  if (!release) return null;
  let metadata = {};
  try {
    metadata = release.metadata ? JSON.parse(release.metadata) : {};
  } catch (error) {
    metadata = {};
  }
  return { ...release, metadata };
};

const submitReleaseToDmb = async (release, userId) => {
  const log = createDmbExportLogger(release.id, userId);
  const labelName = release.label_name || 'CDCULT RECORDS';
  const metadata = release.metadata || {};
  const tracks = Array.isArray(metadata.tracks) ? metadata.tracks : [];
  const artists = splitPeople(release.artists);
  const contributors = new Map();
  tracks.forEach((track) => {
    splitPeople(track.music_authors || track.musicAuthors).forEach((name) => contributors.set(name, 'Композитор, Продюсер'));
    splitPeople(track.lyrics_authors || track.lyricsAuthors).forEach((name) => contributors.set(name, 'Автор слов'));
  });

  log('info', 'Автоотгруз DMB запущен', { title: release.title, artists: release.artists });
  let cookie = await loginToDmb(log);

  const insertUrl = `${DMB_BASE_URL}/albums/insert/`;
  const insertPage = await fetchWithCookies(insertUrl, { method: 'GET' }, cookie);
  cookie = insertPage.cookie;
  const insertHtml = await insertPage.response.text();
  const formAction = toAbsoluteUrl(extractFormAction(insertHtml, 'name="title"') || '/albums/insert');
  const saveMainPageAction = toAbsoluteUrl('/albums/insert/applypage');
  const params = extractAllInputs(insertHtml);
  const initialIds = extractDmbFormIds(insertHtml);
  const formAlbumId = initialIds.committedAlbumId;
  const formRecordId = initialIds.recordId;
  const formAlbumHiddenId = initialIds.albumHiddenId;
  const formAaRecId = initialIds.aaRecId;
  log('info', 'Форма создания релиза DMB открыта', {
    status: insertPage.response.status,
    formAction,
    saveMainPageAction,
    formRecordId,
    formAlbumHiddenId,
    formAaRecId,
    dmbAlbumId: formAlbumId,
  });
  const language = detectDmbLanguage(release.title);
  const genre = String(release.genre || metadata.main_genre || '').split('/')[0].trim();
  const genreValue = dmbOptionValue(insertHtml, genre);
  const currentYear = String(new Date().getFullYear());

  params.set('subform', 'album-main');
  params.set('title', release.title || '');
  params.set('album_note', release.subtitle || '');
  params.set('language', language);
  params.set('barcode', metadata.upc || '');
  params.set('old_barcode', metadata.upc || '');
  if (!metadata.upc) params.set('barcode_skip', 'on');
  params.set('catalog_number', randomCatalogNumber());
  params.set('phonograph_info_year', currentYear);
  params.set('phonograph_info_name', labelName);
  params.set('copyright_year', currentYear);
  params.set('copyright_name', labelName);
  params.set('album_type', dmbAlbumTypeValue(release.release_type));
  if (genreValue) params.set('genre_common_genre', genreValue);
  params.set('genre_common_subgenre', '');
  setDmbMultiField(params, 'primary_artist', artists.length ? artists : [release.artists || release.artist_login || 'Artist'], 'role-34');
  if (contributors.size) {
    setDmbMultiField(params, 'contributors', Array.from(contributors.keys()), Array.from(contributors.values()).join(', '));
  }
  params.set('publishers_values_count', '1');
  params.set('publishers_values', '0');
  params.set('line0publishers', 'Label Control');
  params.set('ajax', '1');
  params.set('in_apply_mode', 'on');
  params.set('datapage', 'main');

  log('info', 'Данные формы подготовлены', {
    language,
    genre,
    genreValue,
    albumType: release.release_type,
    artistsCount: artists.length,
    contributorsCount: contributors.size,
    upcMode: metadata.upc ? 'manual' : 'SMW',
    sentFields: ['title', 'album_note', 'language', 'barcode', 'barcode_skip', 'catalog_number', 'album_type', 'genre_common_genre', 'primary_artist_values_count', 'contributors_values_count', 'datapage'].reduce((acc, key) => {
      acc[key] = params.get(key);
      return acc;
    }, {}),
  });

  const saveMainResult = await fetchWithCookies(saveMainPageAction, {
    method: 'POST',
    body: params,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
    },
  }, cookie);
  const saveMainText = await saveMainResult.response.text();
  let saveMainJson = null;
  try {
    saveMainJson = JSON.parse(saveMainText);
  } catch (error) {
    saveMainJson = null;
  }
  const saveMainOk = saveMainResult.response.ok && saveMainJson?.status === 'ok';
  let committedAlbumId = findDmbAlbumId(saveMainJson?.new_id)
    || findDmbAlbumId(saveMainJson)
    || findDmbAlbumId(initialIds.albumHiddenId)
    || findDmbAlbumId(initialIds.recordId)
    || formAlbumId;

  log(saveMainOk ? 'success' : 'warn', saveMainOk ? 'Главная страница релиза сохранена в DMB' : 'DMB не сохранил главную страницу релиза', {
    status: saveMainResult.response.status,
    dmbAlbumId: committedAlbumId,
    responseJson: saveMainJson,
    responsePreview: saveMainText.replace(/\s+/g, ' ').slice(0, 500),
  });

  if (!saveMainOk) {
    return { success: false, status: saveMainResult.response.status };
  }

  if (release.cover_url && committedAlbumId) {
    const coverPath = path.join(__dirname, release.cover_url.replace(/^\/+/, ''));
    if (fs.existsSync(coverPath)) {
      const coverForm = new FormData();
      const coverBuffer = fs.readFileSync(coverPath);
      coverForm.set('album_pic', new Blob([coverBuffer]), path.basename(coverPath));
      const coverUpload = await fetchWithCookies(`${DMB_BASE_URL}/albums/insert?usecache=on&editmode=yes&id=${encodeURIComponent(committedAlbumId)}`, {
        method: 'POST',
        body: coverForm,
      }, cookie);
      cookie = coverUpload.cookie;
      const coverText = await coverUpload.response.text();
      log(coverUpload.response.ok ? 'info' : 'warn', 'Попытка загрузки обложки в DMB выполнена', {
        status: coverUpload.response.status,
        responsePreview: coverText.replace(/\s+/g, ' ').slice(0, 220),
      });
    } else {
      log('warn', 'Файл обложки не найден на сервере', { coverPath });
    }
  }

  if (!committedAlbumId) {
    const refreshedInsert = await fetchWithCookies(insertUrl, { method: 'GET' }, cookie);
    cookie = refreshedInsert.cookie;
    const refreshedInsertHtml = await refreshedInsert.response.text();
    const refreshedInsertIds = extractDmbFormIds(refreshedInsertHtml);
    log(refreshedInsertIds.committedAlbumId ? 'info' : 'warn', 'Повторно открыта форма insert после Применить', {
      status: refreshedInsert.response.status,
      formRecordId: refreshedInsertIds.recordId,
      formAlbumHiddenId: refreshedInsertIds.albumHiddenId,
      formAaRecId: refreshedInsertIds.aaRecId,
      dmbAlbumId: refreshedInsertIds.committedAlbumId,
    });
    committedAlbumId = refreshedInsertIds.committedAlbumId || null;
  }
  if (!committedAlbumId) {
    const insertApplyPageBody = new URLSearchParams();
    insertApplyPageBody.set('ajax', '1');
    insertApplyPageBody.set('id', committedAlbumId || saveMainJson?.new_id || params.get('id') || '0');
    insertApplyPageBody.set('datapage_id', 'apply');
    insertApplyPageBody.set('subform', 'album-main');
    insertApplyPageBody.set('editmode', 'yes');
    insertApplyPageBody.set('usecache', 'on');
    insertApplyPageBody.set('album_id', committedAlbumId || saveMainJson?.new_id || params.get('album_id') || '0');
    insertApplyPageBody.set('in_apply_mode', 'on');
    const applyTabResult = await fetchWithCookies(toAbsoluteUrl('/albums/insert/readpage'), {
      method: 'POST',
      body: insertApplyPageBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }, cookie);
    cookie = applyTabResult.cookie;
    const applyTabHtml = await applyTabResult.response.text();
    const applyTabIds = extractDmbFormIds(applyTabHtml);
    log(applyTabIds.committedAlbumId ? 'info' : 'warn', 'Открыта вкладка Применить в режиме insert', {
      status: applyTabResult.response.status,
      formRecordId: applyTabIds.recordId,
      formAlbumHiddenId: applyTabIds.albumHiddenId,
      formAaRecId: applyTabIds.aaRecId,
      dmbAlbumId: applyTabIds.committedAlbumId,
      responsePreview: applyTabHtml.replace(/\s+/g, ' ').slice(0, 400),
    });
    committedAlbumId = applyTabIds.committedAlbumId || null;
  }
  if (!committedAlbumId) {
    const foundRelease = await findDmbReleaseByArtistAndTitle({
      cookie,
      artist: release.artists || release.artist_login,
      title: release.title,
      log,
    });
    cookie = foundRelease?.cookie || cookie;
    committedAlbumId = foundRelease?.releaseId || null;
  }
  if (!committedAlbumId) {
    log('warn', 'DMB принял данные, но не вернул ID релиза и не нашёл его в списке для нажатия ОК', {
      responseJson: saveMainJson,
      title: release.title,
      artists: release.artists,
    });
    return { success: false, status: submitResult.response.status };
  }

  const applyPageBody = new URLSearchParams();
  applyPageBody.set('ajax', '1');
  applyPageBody.set('id', committedAlbumId);
  applyPageBody.set('datapage_id', 'apply');
  applyPageBody.set('subform', 'album-main');
  applyPageBody.set('editmode', 'yes');
  applyPageBody.set('usecache', 'on');
  applyPageBody.set('album_id', committedAlbumId);
  applyPageBody.set('in_apply_mode', 'on');

  const applyPageResult = await fetchWithCookies(toAbsoluteUrl('/albums/update/readpage'), {
    method: 'POST',
    body: applyPageBody,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }, cookie);
  const applyPageHtml = await applyPageResult.response.text();
  const applyIssues = extractDmbIssues(applyPageHtml);
  const applyParams = extractAllInputs(applyPageHtml);
  applyParams.set('id', committedAlbumId);
  applyParams.set('album_id', committedAlbumId);
  applyParams.set('ajax', '1');
  applyParams.set('datapage', 'apply');
  applyParams.set('subform', 'album-apply');
  applyParams.set('editmode', 'yes');
  applyParams.set('usecache', 'on');
  applyParams.set('in_apply_mode', 'on');
  applyParams.set('is_final_submit', 'true');

  log(applyIssues.issues.length ? 'warn' : 'info', 'Вкладка Применить DMB открыта перед кнопкой ОК', {
    status: applyPageResult.response.status,
    dmbAlbumId: committedAlbumId,
    issues: applyIssues.issues,
    badParams: applyIssues.badParams,
  });

  const applySaveResult = await fetchWithCookies(toAbsoluteUrl('/albums/update/applypage'), {
    method: 'POST',
    body: applyParams,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }, cookie);
  const applySaveText = await applySaveResult.response.text();
  let applySaveJson = null;
  try {
    applySaveJson = JSON.parse(applySaveText);
  } catch (error) {
    applySaveJson = null;
  }
  const applySaveOk = applySaveResult.response.ok && (!applySaveJson || applySaveJson.status === 'ok');
  log(applySaveOk ? 'info' : 'warn', 'Вкладка Применить сохранена перед ОК', {
    status: applySaveResult.response.status,
    dmbAlbumId: committedAlbumId,
    response: applySaveJson || applySaveText.replace(/\s+/g, ' ').slice(0, 500),
  });

  const commitResult = await fetchWithCookies(toAbsoluteUrl('/albums/update/commit&ajax=1'), {
    method: 'POST',
    body: applyParams,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }, cookie);
  const commitText = await commitResult.response.text();
  let commitJson = null;
  try {
    commitJson = JSON.parse(commitText);
  } catch (error) {
    commitJson = null;
  }
  const commitOk = commitResult.response.ok && commitJson?.status === 'ok';
  log(commitOk ? 'success' : 'warn', commitOk ? 'Релиз сохранён в DMB финальной кнопкой Применить' : 'Финальное сохранение DMB вернуло предупреждение', {
    status: commitResult.response.status,
    dmbAlbumId: committedAlbumId,
    response: commitJson || commitText.replace(/\s+/g, ' ').slice(0, 500),
  });
  return { success: commitOk, status: commitResult.response.status };
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

app.post('/api/admin/releases/:id/dmb-export', auth, staffOnly, async (req, res) => {
  const release = fetchDmbReleasePayload(req.params.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  if (req.user.role !== 'admin' && Number(release.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  try {
    const result = await submitReleaseToDmb(release, req.user.id);
    res.json({
      success: result.success,
      message: result.success ? 'Автоотгруз DMB выполнен' : 'DMB вернул ответ с возможными ошибками, проверьте логи',
    });
  } catch (error) {
    appendDmbExportLog(release.id, req.user.id, 'error', 'Автоотгруз DMB завершился ошибкой', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 4).join('\n'),
    });
    res.status(500).json({ error: error.message || 'Не удалось выполнить автоотгруз DMB' });
  }
});

app.get('/api/admin/releases/:id/dmb-logs', auth, staffOnly, (req, res) => {
  const release = db.prepare('SELECT user_id FROM releases WHERE id = ?').get(req.params.id);
  if (!release) return res.status(404).json({ error: 'Релиз не найден' });
  if (req.user.role !== 'admin' && Number(release.user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  const logs = db.prepare(`
    SELECT l.*, u.login
    FROM dmb_export_logs l
    LEFT JOIN users u ON u.id = l.user_id
    WHERE l.release_id = ?
    ORDER BY datetime(l.created_at) DESC, l.id DESC
    LIMIT 200
  `).all(req.params.id);
  res.json(logs.map((item) => ({
    ...item,
    details: item.details ? (() => {
      try { return JSON.parse(item.details); }
      catch { return { raw: item.details }; }
    })() : null,
  })));
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
