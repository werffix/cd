import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { createReleaseWithCover, updateRelease, uploadTrackToReleaseWithProgress } from '../apiUpload';
import { GENRE_TREE, buildGenreLabel, findGenreNode } from '../data/genres';
import ArtistShell from '../components/ArtistShell';
import { useAuth } from '../AuthContext';

const INITIAL_TRACK = {
  track_title: '',
  track_artists: '',
  lyrics_authors: '',
  music_authors: '',
  explicit: false,
  instrumental: false,
  isrc: '',
  audio_file_obj: null,
};

const getAutoReleaseDateValue = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
};

const convertImageToJpeg3000 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 3000;
        canvas.height = 3000;
        const context = canvas.getContext('2d');
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 3000, 3000);

        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;

        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 3000, 3000);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Не удалось обработать изображение'));
              return;
            }

            resolve(
              new File([blob], `${file.name.replace(/\.[^/.]+$/, '') || 'cover'}-3000.jpg`, {
                type: 'image/jpeg',
              }),
            );
          },
          'image/jpeg',
          0.95,
        );
      };
      image.onerror = () => reject(new Error('Не удалось открыть изображение'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });

const Field = ({ label, name, error, className = '', wrapperClassName = '', labelNode, ...props }) => (
  <label className={`block space-y-2 ${wrapperClassName}`}>
    {(label || labelNode) && <span className="field-label flex items-center gap-2">{labelNode || label}</span>}
    <input name={name} {...props} className={`field-input ${className}`} />
    {error && <span className="text-xs text-red-300">{error}</span>}
  </label>
);

const SelectField = ({ label, name, error, children, className = '', wrapperClassName = '', labelNode, ...props }) => (
  <label className={`block space-y-2 ${wrapperClassName}`}>
    <span className="field-label flex items-center gap-2">{labelNode || label}</span>
    <select name={name} {...props} className={`field-input ${className}`}>
      {children}
    </select>
    {error && <span className="text-xs text-red-300">{error}</span>}
  </label>
);

export default function ReleaseFormPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const editingReleaseId = searchParams.get('edit');
  const { user, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    release_title: '',
    subtitle: '',
    release_type: 'single',
    artists: '',
    main_genre: '',
    sub_genre: '',
    release_date_type: 'exact_date',
    release_date: getAutoReleaseDateValue(),
    upc: '',
    original_release_date: '',
    tracks: [{ ...INITIAL_TRACK }],
    project_demo_link: '',
    telegram: user?.telegram || '',
    spotify_profile: 'create',
    spotify_link: '',
    apple_music_profile: 'create',
    apple_music_link: '',
    comment: '',
    agreement: false,
    cover_image: null,
  });
  const [coverPreview, setCoverPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [stepErrors, setStepErrors] = useState({ 1: false, 2: false, 3: false, 4: false });
  const [draftReleaseId, setDraftReleaseId] = useState(null);
  const [trackUploads, setTrackUploads] = useState([{ progress: 0, status: 'idle', filename: '' }]);
  const [isDraftCreating, setIsDraftCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [coverRequirementsOpen, setCoverRequirementsOpen] = useState(false);

  const selectedGenre = useMemo(() => findGenreNode(formData.main_genre), [formData.main_genre]);
  const currentReleaseDate = formData.release_date;
  const avatarFallback = useMemo(() => user?.name?.slice(0, 1)?.toUpperCase() || '', [user]);

  useEffect(() => {
    if (user?.telegram && !formData.telegram) {
      setFormData((prev) => ({ ...prev, telegram: user.telegram }));
    }
  }, [user, formData.telegram]);

  useEffect(() => {
    if (!editingReleaseId) return;
    const loadRelease = async () => {
      try {
        const res = await api.get(`/releases/${editingReleaseId}`);
        const release = res.data;
        const metadata = release.metadata && typeof release.metadata === 'string' ? JSON.parse(release.metadata) : (release.metadata || {});
        const nextTracks = Array.isArray(metadata.tracks) && metadata.tracks.length
          ? metadata.tracks.map((track) => ({
            ...INITIAL_TRACK,
            track_title: track.track_title || track.title || '',
            track_artists: track.track_artists || track.artists || '',
            lyrics_authors: track.lyrics_authors || '',
            music_authors: track.music_authors || '',
            explicit: Boolean(track.explicit),
            instrumental: Boolean(track.instrumental),
            isrc: track.isrc || '',
            audio_file: track.audio_file || '',
            original_filename: track.original_filename || '',
            audio_file_obj: null,
          }))
          : [{ ...INITIAL_TRACK }];

        setFormData((prev) => ({
          ...prev,
          release_title: release.title || '',
          subtitle: release.subtitle || '',
          release_type: release.release_type || 'single',
          artists: release.artists || '',
          main_genre: metadata.main_genre || '',
          sub_genre: metadata.sub_genre || '',
          release_date: metadata.release_date || getAutoReleaseDateValue(),
          upc: metadata.upc || '',
          original_release_date: metadata.original_release_date || '',
          tracks: nextTracks,
          project_demo_link: metadata.demo || '',
          telegram: metadata.telegram || prev.telegram || '',
          spotify_profile: metadata.spotify_profile || 'create',
          spotify_link: metadata.spotify_link || '',
          apple_music_profile: metadata.apple_music_profile || 'create',
          apple_music_link: metadata.apple_music_link || '',
          comment: metadata.comment || '',
        }));

        if (release.cover_url) {
          const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
          const apiOrigin = /^https?:\/\//.test(apiBaseUrl) ? apiBaseUrl.replace(/\/api\/?$/, '') : '';
          const coverUrl = release.cover_url.startsWith('http') ? release.cover_url : (apiOrigin ? `${apiOrigin}${release.cover_url}` : release.cover_url);
          setCoverPreview(coverUrl);
        }
        setDraftReleaseId(release.id);
        setTrackUploads(nextTracks.map((track) => ({
          progress: track.audio_file ? 100 : 0,
          status: track.audio_file ? 'done' : 'idle',
          filename: track.original_filename || (track.audio_file ? 'Файл загружен' : ''),
        })));
      } catch (e) {
        console.error(e);
      }
    };
    loadRelease();
  }, [editingReleaseId]);

  useEffect(() => {
    setTrackUploads((prev) => {
      if (prev.length === formData.tracks.length) return prev;
      if (prev.length < formData.tracks.length) {
        return [...prev, ...Array.from({ length: formData.tracks.length - prev.length }, () => ({ progress: 0, status: 'idle', filename: '' }))];
      }
      return prev.slice(0, formData.tracks.length);
    });
  }, [formData.tracks.length]);

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;

    if (name === 'cover_image' && files?.[0]) {
      try {
        const convertedFile = await convertImageToJpeg3000(files[0]);
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        const nextPreview = URL.createObjectURL(convertedFile);
        setCoverPreview(nextPreview);
        setFormData((prev) => ({ ...prev, cover_image: convertedFile }));
        if (errors.cover_image) setErrors((prev) => ({ ...prev, cover_image: null }));
      } catch (error) {
        setErrors((prev) => ({ ...prev, cover_image: error.message || 'Не удалось обработать обложку' }));
      }
      return;
    }

    if (name === 'main_genre') {
      setFormData((prev) => ({ ...prev, main_genre: value, sub_genre: '' }));
      return;
    }
    if (name === 'spotify_profile') {
      setFormData((prev) => ({ ...prev, spotify_profile: value, spotify_link: value === 'exists' ? prev.spotify_link : '' }));
      if (errors.spotify_profile) setErrors((prev) => ({ ...prev, spotify_profile: null }));
      return;
    }
    if (name === 'apple_music_profile') {
      setFormData((prev) => ({ ...prev, apple_music_profile: value, apple_music_link: value === 'exists' ? prev.apple_music_link : '' }));
      if (errors.apple_music_profile) setErrors((prev) => ({ ...prev, apple_music_profile: null }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : files ? files[0] : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleTrackChange = (index, field, value) => {
    setFormData((prev) => {
      const nextTracks = [...prev.tracks];
      nextTracks[index] = { ...nextTracks[index], [field]: value };
      return { ...prev, tracks: nextTracks };
    });
  };

  const buildMetadata = () => ({
    tracks: formData.tracks.map((track) => ({
      track_title: track.track_title,
      track_artists: track.track_artists,
      lyrics_authors: track.lyrics_authors,
      music_authors: track.music_authors,
      explicit: track.explicit,
      instrumental: track.instrumental,
      isrc: track.isrc,
    })),
    telegram: formData.telegram,
    demo: formData.project_demo_link,
    upc: formData.upc,
    original_release_date: formData.original_release_date,
    comment: formData.comment,
    release_date: currentReleaseDate,
    release_date_type: formData.release_date_type,
    spotify_profile: formData.spotify_profile,
    spotify_link: formData.spotify_link,
    apple_music_profile: formData.apple_music_profile,
    apple_music_link: formData.apple_music_link,
    main_genre: formData.main_genre,
    sub_genre: formData.sub_genre,
  });

  const ensureDraftRelease = async () => {
    if (draftReleaseId) return draftReleaseId;
    setIsDraftCreating(true);
    try {
      const data = new FormData();
      data.append('title', formData.release_title);
      data.append('subtitle', formData.subtitle);
      data.append('type', formData.release_type);
      data.append('artists', formData.artists);
      data.append('genre', buildGenreLabel(formData.main_genre, formData.sub_genre));
      data.append('status', 'draft');
      data.append('archive_url', '');
      data.append('metadata', JSON.stringify(buildMetadata()));
      if (formData.cover_image) data.append('cover', formData.cover_image);
      const res = await createReleaseWithCover(data);
      setDraftReleaseId(res.data.id);
      return res.data.id;
    } finally {
      setIsDraftCreating(false);
    }
  };

  const handleTrackAudioSelect = async (index, file) => {
    if (file) {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const safe = (value, fallback) => (value || fallback).replace(/[\\/:*?"<>|]/g, '').trim() || fallback;
      const artistPart = safe(formData.tracks[index]?.track_artists, 'Артист');
      const titlePart = safe(formData.tracks[index]?.track_title, 'Трек');
      const baseName = `${index + 1}. ${artistPart} - ${titlePart}`;
      const renamedFile = new File([file], `${baseName}${ext}`, { type: file.type });
      handleTrackChange(index, 'audio_file_obj', renamedFile);
      file = renamedFile;
    } else {
      handleTrackChange(index, 'audio_file_obj', null);
    }
    if (!file) return;

    setTrackUploads((prev) => {
      const next = [...prev];
      next[index] = { progress: 0, status: 'uploading', filename: file.name };
      return next;
    });

    try {
      const releaseId = await ensureDraftRelease();
      const trackData = new FormData();
      trackData.append('track_audio', file);
      trackData.append('trackIndex', index);
      trackData.append('trackTitle', formData.tracks[index]?.track_title || '');
      trackData.append('trackArtists', formData.tracks[index]?.track_artists || '');
      trackData.append('lyricsAuthors', formData.tracks[index]?.lyrics_authors || '');
      trackData.append('musicAuthors', formData.tracks[index]?.music_authors || '');
      trackData.append('explicit', formData.tracks[index]?.explicit || false);
      trackData.append('instrumental', formData.tracks[index]?.instrumental || false);
      trackData.append('isrc', formData.tracks[index]?.isrc || '');

      await uploadTrackToReleaseWithProgress(releaseId, trackData, (event) => {
        if (!event.total) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setTrackUploads((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], progress: percent };
          return next;
        });
      });

      setTrackUploads((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], progress: 100, status: 'done' };
        return next;
      });

      if (errors[`track_${index}_audio`]) {
        setErrors((prev) => ({ ...prev, [`track_${index}_audio`]: null }));
      }
    } catch (error) {
      setTrackUploads((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error' };
        return next;
      });
      setSubmitMessage(`Не удалось загрузить трек: ${error.response?.data?.error || error.message}`);
      setTimeout(() => setSubmitMessage(''), 2000);
    }
  };

  const addTrack = () => setFormData((prev) => ({ ...prev, tracks: [...prev.tracks, { ...INITIAL_TRACK }] }));

  const removeTrack = (index) => {
    const nextTracks = formData.tracks.filter((_, currentIndex) => currentIndex !== index);
    setFormData((prev) => ({ ...prev, tracks: nextTracks.length ? nextTracks : [{ ...INITIAL_TRACK }] }));
  };

  const getStepErrors = (currentStep) => {
    const nextErrors = {};
    if (currentStep === 1) {
      if (!formData.release_title) nextErrors.release_title = 'Обязательно';
      if (!formData.artists) nextErrors.artists = 'Обязательно';
      if (!formData.main_genre) nextErrors.main_genre = 'Обязательно';
      if (!currentReleaseDate) nextErrors.release_date = 'Обязательно';
      if (!formData.cover_image && !coverPreview) nextErrors.cover_image = 'Загрузите обложку';
    }

    if (currentStep === 2) {
      formData.tracks.forEach((track, index) => {
        if (!track.track_title) nextErrors[`track_${index}_title`] = 'Название обязательно';
        if (!track.track_artists) nextErrors[`track_${index}_artists`] = 'Артисты обязательны';
        if (!track.instrumental && !track.lyrics_authors) nextErrors[`track_${index}_lyrics`] = 'Укажите авторов';
        if (!track.music_authors) nextErrors[`track_${index}_music`] = 'Укажите авторов';
        if (!track.audio_file_obj && !track.audio_file) nextErrors[`track_${index}_audio`] = 'Загрузите WAV или FLAC';
      });
    }

    if (currentStep === 3) {
      if (!formData.project_demo_link) nextErrors.project_demo_link = 'Обязательно';
      if (!formData.telegram) nextErrors.telegram = 'Обязательно';
      if (!formData.spotify_profile) nextErrors.spotify_profile = 'Обязательно';
      if (!formData.apple_music_profile) nextErrors.apple_music_profile = 'Обязательно';
      if (formData.spotify_profile === 'exists' && !formData.spotify_link) nextErrors.spotify_link = 'Укажите ссылку';
      if (formData.apple_music_profile === 'exists' && !formData.apple_music_link) nextErrors.apple_music_link = 'Укажите ссылку';
    }

    if (currentStep === 4 && !formData.agreement) {
      nextErrors.agreement = 'Нужно подтверждение';
    }

    return nextErrors;
  };

  const validateStep = (currentStep) => {
    const nextErrors = getStepErrors(currentStep);
    setErrors(nextErrors);
    setStepErrors((prev) => ({ ...prev, [currentStep]: Object.keys(nextErrors).length > 0 }));
    return Object.keys(nextErrors).length === 0;
  };

  const validateAllSteps = () => {
    const allErrors = {};
    const nextStepErrors = {};
    [1, 2, 3, 4].forEach((stepIndex) => {
      const stepErrors = getStepErrors(stepIndex);
      nextStepErrors[stepIndex] = Object.keys(stepErrors).length > 0;
      Object.assign(allErrors, stepErrors);
    });
    setErrors(allErrors);
    setStepErrors((prev) => ({ ...prev, ...nextStepErrors }));
    return Object.keys(allErrors).length === 0;
  };

  const nextStep = async () => {
    if (!validateStep(step)) return;
    if (step === 1 && !draftReleaseId) {
      try {
        await ensureDraftRelease();
      } catch (error) {
        setSubmitMessage(`Не удалось создать черновик: ${error.response?.data?.error || error.message}`);
        setTimeout(() => setSubmitMessage(''), 2000);
        return;
      }
    }
    setStep((value) => Math.min(value + 1, 4));
  };

  const prevStep = () => setStep((value) => Math.max(value - 1, 1));

  const submitToApi = async () => {
    if (!validateAllSteps()) {
      const firstInvalid = [1, 2, 3, 4].find((stepIndex) => Object.keys(getStepErrors(stepIndex)).length > 0);
      if (firstInvalid) setStep(firstInvalid);
      return;
    }
    if (trackUploads.some((item) => item.status === 'uploading')) {
      setSubmitMessage('Дождитесь завершения загрузки треков');
      setTimeout(() => setSubmitMessage(''), 2000);
      return;
    }
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const data = new FormData();
      data.append('title', formData.release_title);
      data.append('subtitle', formData.subtitle);
      data.append('type', formData.release_type);
      data.append('artists', formData.artists);
      data.append('genre', buildGenreLabel(formData.main_genre, formData.sub_genre));
      data.append('status', 'moderation');
      data.append('archive_url', '');
      data.append('metadata', JSON.stringify(buildMetadata()));
      if (formData.cover_image) data.append('cover', formData.cover_image);

      let releaseId = draftReleaseId;
      if (releaseId) {
        await updateRelease(releaseId, data);
      } else {
        const res = await createReleaseWithCover(data);
        releaseId = res.data.id;
        setDraftReleaseId(releaseId);
      }

      for (let i = 0; i < formData.tracks.length; i += 1) {
        const track = formData.tracks[i];
        if (!track.audio_file_obj) continue;
        if (trackUploads[i]?.status === 'done') continue;

        setTrackUploads((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'uploading', progress: 0, filename: track.audio_file_obj.name };
          return next;
        });

        const trackData = new FormData();
        trackData.append('track_audio', track.audio_file_obj);
        trackData.append('trackIndex', i);
        trackData.append('trackTitle', track.track_title);
        trackData.append('trackArtists', track.track_artists);
        trackData.append('lyricsAuthors', track.lyrics_authors);
        trackData.append('musicAuthors', track.music_authors);
        trackData.append('explicit', track.explicit);
        trackData.append('instrumental', track.instrumental);
        trackData.append('isrc', track.isrc);

        await uploadTrackToReleaseWithProgress(releaseId, trackData, (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setTrackUploads((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], progress: percent };
            return next;
          });
        });

        setTrackUploads((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], progress: 100, status: 'done' };
          return next;
        });
      }

      setSubmitMessage('Релиз успешно отправлен');
      setTimeout(() => nav('/dashboard'), 1200);
    } catch (err) {
      setSubmitMessage(`Не удалось отправить релиз: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraft = async () => {
    try {
      const data = new FormData();
      data.append('title', formData.release_title || 'Черновик');
      data.append('subtitle', formData.subtitle);
      data.append('type', formData.release_type);
      data.append('artists', formData.artists);
      data.append('genre', buildGenreLabel(formData.main_genre, formData.sub_genre));
      data.append('status', 'draft');
      data.append('archive_url', '');
      data.append('metadata', JSON.stringify(buildMetadata()));
      if (formData.cover_image) data.append('cover', formData.cover_image);

      if (draftReleaseId) {
        await updateRelease(draftReleaseId, data);
      } else {
        const res = await createReleaseWithCover(data);
        setDraftReleaseId(res.data.id);
      }
      setSubmitMessage('Черновик сохранён');
    } catch (error) {
      setSubmitMessage(`Не удалось сохранить черновик: ${error.response?.data?.error || error.message}`);
    } finally {
      setTimeout(() => setSubmitMessage(''), 1800);
    }
  };

  return (
        <ArtistShell
      user={user}
      avatarPreview={user?.avatar || ''}
      avatarFallback={avatarFallback}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      logout={logout}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-8 sm:px-8">
        <div className="mt-6 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Создание релиза</h1>
          <p className="mt-2 text-sm text-zinc-400">Заполните данные о релизе, треках и контактах для отправки на модерацию.</p>
        </div>

        <div className="mt-8 flex w-full items-center justify-center">
          <div className="flex w-full max-w-4xl items-center justify-center gap-6">
            {[
              { title: 'Данные релиза', subtitle: 'Основная информация' },
              { title: 'Треклист', subtitle: 'Треки и архив' },
              { title: 'Информация', subtitle: 'Контакты и профили' },
              { title: 'Проверка', subtitle: 'Отправка релиза' },
            ].map((item, index) => {
              const currentStep = index + 1;
              const isActive = currentStep === step;
              const isError = stepErrors[currentStep];
              return (
                <div key={item.title} className="flex flex-1 items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(currentStep)}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                        isActive
                          ? 'bg-white text-black'
                          : isError
                            ? 'bg-red-500/20 text-red-200'
                            : 'bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      {currentStep}
                    </div>
                    <div className="mt-3">
                      <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{item.title}</p>
                      <p className="text-sm text-zinc-500">{item.subtitle}</p>
                    </div>
                  </button>
                  {currentStep < 4 ? <div className="hidden h-px flex-1 bg-zinc-800/60 md:block" /> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-6 w-full max-w-4xl panel-card p-6">
          {step === 1 && (
              <div className="space-y-5">
                <Field label="Название релиза *" name="release_title" value={formData.release_title} onChange={handleChange} error={errors.release_title} />
                <Field label="Подзаголовок" name="subtitle" value={formData.subtitle} onChange={handleChange} />
                <SelectField label="Тип релиза *" name="release_type" value={formData.release_type} onChange={handleChange}>
                  <option value="single">Сингл</option>
                  <option value="ep">EP</option>
                  <option value="album">Альбом</option>
                </SelectField>
                <Field label="Основные артисты *" name="artists" value={formData.artists} onChange={handleChange} error={errors.artists} />

                <label className="block space-y-2">
                  <span className="field-label">Основной жанр *</span>
                  <select name="main_genre" value={formData.main_genre} onChange={handleChange} className="field-input">
                    <option value="">Выберите жанр</option>
                    {GENRE_TREE.map((item) => (
                      <option key={item.name} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                  {errors.main_genre ? <span className="text-xs text-red-300">{errors.main_genre}</span> : null}
                </label>

                {selectedGenre?.subgenres?.length ? (
                  <SelectField
                    label="Поджанр"
                    name="sub_genre"
                    value={formData.sub_genre}
                    onChange={handleChange}
                  >
                    <option value="">Не выбирать</option>
                    {selectedGenre.subgenres.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </SelectField>
                ) : null}

                <Field label="UPC (опционально)" name="upc" value={formData.upc} onChange={handleChange} />

                <label className="block space-y-2">
                  <span className="field-label">Дата релиза *</span>
                  <div className="date-shell">
                    <input name="release_date" type="date" value={formData.release_date} onChange={handleChange} className="field-input date-field pr-14" />
                    <CalendarDays size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  </div>
                  {errors.release_date ? <span className="text-xs text-red-300">{errors.release_date}</span> : null}
                </label>

                {formData.upc ? (
                  <label className="block space-y-2">
                    <span className="field-label">Оригинальная дата релиза</span>
                    <div className="date-shell">
                      <input
                        name="original_release_date"
                        type="date"
                        value={formData.original_release_date}
                        onChange={handleChange}
                        className="field-input date-field pr-14"
                      />
                      <CalendarDays size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </label>
                ) : null}

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="field-label">Обложка *</span>
                    <button
                      type="button"
                      onClick={() => setCoverRequirementsOpen(true)}
                      className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
                    >
                      Требования к обложке
                    </button>
                  </div>
                  <div className="flex flex-col gap-6 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 min-h-[180px] flex-col justify-between text-left">
                      <div className="mb-1 flex items-center justify-start gap-2 text-zinc-300">
                        <Upload size={16} />
                        Выберите или перетащите изображение
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-4">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200">
                          Выберите файл
                          <input
                            name="cover_image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleChange}
                            className="sr-only"
                          />
                        </label>
                        <span className="text-sm text-zinc-500">
                          {formData.cover_image?.name || 'Файл не выбран'}
                        </span>
                        {errors.cover_image ? <p className="mt-2 text-xs text-red-300">{errors.cover_image}</p> : null}
                      </div>
                    </div>
                    <div className="flex items-start gap-6">
                      <div className="h-28 w-28 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/60">
                        {coverPreview ? (
                          <img src={coverPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                            Preview
                          </div>
                        )}
                      </div>
                      <div className="max-w-sm text-xs text-zinc-400" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Треклист</h3>
                    <p className="mt-1 text-sm text-zinc-400">Добавьте все треки, авторов и аудиофайлы релиза.</p>
                  </div>
                  <button type="button" onClick={addTrack} className="primary-button">
                    <Plus size={16} />
                    Добавить трек
                  </button>
                </div>

                {formData.tracks.map((track, index) => (
                  <div key={`track-${index}`} className="soft-card space-y-4 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-500">Трек {index + 1}</p>
                      {formData.tracks.length > 1 && (
                        <button type="button" onClick={() => removeTrack(index)} className="secondary-button px-3 py-3">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Field label="Название трека *" value={track.track_title} onChange={(e) => handleTrackChange(index, 'track_title', e.target.value)} error={errors[`track_${index}_title`]} />
                      <Field label="Основные артист(-ы) *" value={track.track_artists} onChange={(e) => handleTrackChange(index, 'track_artists', e.target.value)} error={errors[`track_${index}_artists`]} />
                      {!track.instrumental ? (
                        <Field label="ФИО авторов текста *" value={track.lyrics_authors} onChange={(e) => handleTrackChange(index, 'lyrics_authors', e.target.value)} error={errors[`track_${index}_lyrics`]} />
                      ) : null}
                      <Field label="ФИО авторов музыки *" value={track.music_authors} onChange={(e) => handleTrackChange(index, 'music_authors', e.target.value)} error={errors[`track_${index}_music`]} />
                      <Field label="ISRC (опционально)" value={track.isrc} onChange={(e) => handleTrackChange(index, 'isrc', e.target.value)} />

                      <label className="block space-y-2">
                        <span className="field-label">Аудио WAV / FLAC *</span>
                        <div className="rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-6">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <input
                              type="file"
                              accept=".wav,.flac,audio/wav,audio/flac"
                              onChange={(e) => handleTrackAudioSelect(index, e.target.files?.[0] || null)}
                              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black sm:w-auto"
                            />
                            <div className="w-full max-w-xs flex-1 sm:max-w-[240px]">
                              <div className="flex items-center justify-between text-xs text-zinc-400">
                                <span className="truncate">{trackUploads[index]?.filename || track.original_filename || (track.audio_file ? 'Файл загружен' : 'Файл не выбран')}</span>
                                <span>{trackUploads[index]?.progress || 0}%</span>
                              </div>
                              <div className="mt-2 h-2 w-full rounded-full bg-zinc-800">
                                <div
                                  className={`h-2 rounded-full transition ${trackUploads[index]?.status === 'error' ? 'bg-red-400' : 'bg-white'}`}
                                  style={{ width: `${trackUploads[index]?.progress || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          {errors[`track_${index}_audio`] ? <p className="mt-2 text-xs text-red-300">{errors[`track_${index}_audio`]}</p> : null}
                        </div>
                      </label>
                    </div>

                    <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
                      <span className="font-medium text-white">Ненормативная лексика</span>
                      <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${track.explicit ? 'bg-white' : 'bg-zinc-800'}`}>
                        <input
                          type="checkbox"
                          checked={track.explicit}
                          onChange={(e) => handleTrackChange(index, 'explicit', e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${track.explicit ? 'translate-x-6' : 'translate-x-1'}`} />
                      </span>
                    </label>
                      <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
                        <span className="font-medium text-white">Инструментальная музыка</span>
                        <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${track.instrumental ? 'bg-white' : 'bg-zinc-800'}`}>
                          <input
                            type="checkbox"
                            checked={track.instrumental}
                            onChange={(e) => {
                              const nextValue = e.target.checked;
                              handleTrackChange(index, 'instrumental', nextValue);
                              if (nextValue && !track.lyrics_authors) {
                                handleTrackChange(index, 'lyrics_authors', '-');
                              }
                            }}
                            className="peer sr-only"
                          />
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-black transition ${track.instrumental ? 'translate-x-6' : 'translate-x-1'}`} />
                        </span>
                      </label>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Field
                  labelNode={(
                    <span className="relative inline-flex items-center gap-2">
                      Ссылка на демо / договор *
                      <span className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-slate-400">
                        <CircleHelp size={12} />
                        <span className="pointer-events-none absolute left-1/2 top-8 z-10 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-[#121212] px-3 py-2 text-xs text-zinc-200 opacity-0 shadow-lg transition group-hover:opacity-100">
                          Ссылка на видеозапись проекта (с демонстрацией дорожек баса, мелодии и кика) или договор на биты
                        </span>
                      </span>
                    </span>
                  )}
                  name="project_demo_link"
                  value={formData.project_demo_link}
                  onChange={handleChange}
                  error={errors.project_demo_link}
                />
                <Field label="Telegram *" name="telegram" value={formData.telegram} onChange={handleChange} error={errors.telegram} />
                <SelectField label="Карточка/профиль артиста в Spotify *" name="spotify_profile" value={formData.spotify_profile} onChange={handleChange} error={errors.spotify_profile}>
                  <option value="create">Создать</option>
                  <option value="exists">Есть</option>
                  <option value="already_submitted">Указывал ранее</option>
                </SelectField>
                {formData.spotify_profile === 'exists' ? (
                  <Field label="Ссылка на карточку Spotify *" name="spotify_link" value={formData.spotify_link} onChange={handleChange} error={errors.spotify_link} />
                ) : null}
                <SelectField label="Карточка/профиль артиста в Apple Music *" name="apple_music_profile" value={formData.apple_music_profile} onChange={handleChange} error={errors.apple_music_profile}>
                  <option value="create">Создать</option>
                  <option value="exists">Есть</option>
                  <option value="already_submitted">Указывал ранее</option>
                </SelectField>
                {formData.apple_music_profile === 'exists' ? (
                  <Field label="Ссылка на карточку Apple Music *" name="apple_music_link" value={formData.apple_music_link} onChange={handleChange} error={errors.apple_music_link} />
                ) : null}
                <label className="block space-y-2">
                  <span className="field-label">Комментарий модератору</span>
                  <textarea name="comment" value={formData.comment} onChange={handleChange} rows={5} className="field-textarea" />
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="soft-card p-5">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Сводка релиза</p>
                      <div className="mt-4 space-y-3 text-sm text-zinc-300">
                        <p><span className="text-zinc-500">Релиз:</span> {formData.release_title}</p>
                        <p><span className="text-zinc-500">Артисты:</span> {formData.artists}</p>
                        <p><span className="text-zinc-500">Жанр:</span> {buildGenreLabel(formData.main_genre, formData.sub_genre) || 'Не указан'}</p>
                        <p><span className="text-zinc-500">Тип:</span> {formData.release_type}</p>
                        <p><span className="text-zinc-500">Дата релиза:</span> {currentReleaseDate}</p>
                      </div>
                    </div>
                    <div className="w-full max-w-[180px] shrink-0">
                      {coverPreview ? (
                        <img src={coverPreview} alt="Cover preview" className="mt-4 aspect-square h-[180px] w-[180px] rounded-lg object-cover" />
                      ) : (
                        <div className="mt-4 flex h-[180px] w-[180px] items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 text-center text-sm text-zinc-400">
                          Обложка не загружена.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="panel-card p-5">
                  <div className="mb-4 flex items-center gap-2 text-white">
                    <Plus size={16} />
                    Треклист
                  </div>
                  <ul className="space-y-3 text-sm text-zinc-300">
                    {formData.tracks.map((track, index) => (
                      <li key={`review-${index}`} className="soft-card flex items-center justify-between gap-3 p-4">
                        <span>{index + 1}. {track.track_title || 'Без названия'}</span>
                        <span className="text-zinc-500">{track.audio_file_obj ? track.audio_file_obj.name : (track.original_filename || (track.audio_file ? 'Файл загружен' : 'Без файла'))}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <label className={`flex items-center gap-4 rounded-xl border p-4 text-sm transition ${errors.agreement ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'}`}>
                  <input type="checkbox" checked={formData.agreement} onChange={handleChange} name="agreement" className="sr-only" />
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${formData.agreement ? 'border-white bg-white text-black' : 'border-zinc-700 bg-zinc-950 text-transparent'}`}>
                    <Check size={15} />
                  </span>
                  <span className="font-medium text-white">Подтверждаю корректность данных и права на материалы. Готов отправить релиз на модерацию.</span>
                </label>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-5">
              <button type="button" onClick={saveDraft} className="secondary-button border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20">
                Черновик
              </button>
              {step < 4 ? (
                <button type="button" onClick={nextStep} className="primary-button">
                  Далее
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={submitToApi} className="primary-button">
                  Отправить на модерацию
                  <Send size={16} />
                </button>
              )}
            </div>
        </div>

        {isSubmitting || isDraftCreating ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] px-8 py-6 text-center">
              <Loader2 className="mx-auto mb-3 animate-spin text-white" size={28} />
              <p className="text-sm text-zinc-300">
                {isDraftCreating ? 'Создаем черновик релиза' : 'Загрузка треков, подождите немного'}
              </p>
            </div>
          </div>
        ) : null}

        {submitMessage ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-zinc-800/60 bg-[#121212] px-5 py-4 text-sm text-white shadow-2xl">
            {submitMessage}
          </div>
        ) : null}

        {coverRequirementsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setCoverRequirementsOpen(false)}>
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <h3 className="text-xl font-bold text-white">Требования к обложке</h3>
                <button type="button" onClick={() => setCoverRequirementsOpen(false)} className="secondary-button px-3 py-2">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-2 text-sm leading-6 text-zinc-300">
                <p className="font-semibold text-zinc-100">Формат обложки:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Формат файла: JPG или PNG.</li>
                  <li>Минимальное разрешение: 3000 x 3000 пикселей.</li>
                  <li>Соотношение сторон: 1:1.</li>
                </ul>
                <p className="pt-2 font-semibold text-zinc-100">Требования:</p>
                <p>Оригинальность. Обложка должна быть оригинальной и соответствовать релизу. Нельзя использовать изображения, защищенные авторским правом.</p>
                <p>Точность. Обложка не должна вводить в заблуждение. Нельзя использовать изображение другого артиста, если он не участвует в релизе.</p>
                <p>Обложка не должна содержать никакую текстовую информацию кроме имени исполнителя, названия альбома, наименования лейбла, года релиза или имени правообладателя.</p>
                <p>Текстовая информация должна в точности совпадать с названиями в релизе. Если на обложке указывается версия релиза, она должна совпадать с версией в релизе.</p>
                <p>Качество. Принимается только JPEG и PNG, минимальное разрешение 3000х3000, color mode RGB. Изображения не должны быть размытыми, пикселизированными или растянутыми.</p>
                <p>Культурные особенности. Не допускается пропаганда ненависти по признаку расы, религии, пола, сексуальной ориентации, национального или этнического происхождения.</p>
                <p className="pt-2 font-semibold text-zinc-100">Запрещено размещать:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Ссылки и хэштеги.</li>
                  <li>Логотипы, защищенные авторским правом, или официальные изображения брендов.</li>
                  <li>Материалы порнографического или излишне оскорбительного содержания.</li>
                  <li>Пропаганду наркотиков, оскорбления, расовую или политическую тематику.</li>
                  <li>Лица известных моделей, актеров, артистов, героев мультфильмов, канонизированных лиц и известные картины.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ArtistShell>
  );
}
