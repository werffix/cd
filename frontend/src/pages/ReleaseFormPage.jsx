import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CircleHelp,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { createReleaseWithCover, uploadTrackToRelease } from '../apiUpload';
import { GENRE_TREE, buildGenreLabel, findGenreNode } from '../data/genres';

const INITIAL_TRACK = {
  track_title: '',
  track_artists: '',
  lyrics_authors: '',
  music_authors: '',
  explicit: false,
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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    release_title: '',
    subtitle: '',
    release_type: 'single',
    artists: '',
    main_genre: '',
    sub_genre: '',
    release_date_type: 'asap',
    release_date: getAutoReleaseDateValue(),
    upc: '',
    tracks: [{ ...INITIAL_TRACK }],
    project_demo_link: '',
    telegram: '',
    spotify_profile: 'create',
    apple_music_profile: 'create',
    comment: '',
    agreement: false,
    cover_image: null,
  });
  const [coverPreview, setCoverPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [stepErrors, setStepErrors] = useState({ 1: false, 2: false, 3: false, 4: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const selectedGenre = useMemo(() => findGenreNode(formData.main_genre), [formData.main_genre]);
  const currentReleaseDate = formData.release_date_type === 'asap' ? getAutoReleaseDateValue() : formData.release_date;

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

  const addTrack = () => setFormData((prev) => ({ ...prev, tracks: [...prev.tracks, { ...INITIAL_TRACK }] }));

  const removeTrack = (index) => {
    const nextTracks = formData.tracks.filter((_, currentIndex) => currentIndex !== index);
    setFormData((prev) => ({ ...prev, tracks: nextTracks.length ? nextTracks : [{ ...INITIAL_TRACK }] }));
  };

  const validateStep = (currentStep) => {
    const nextErrors = {};
    if (currentStep === 1) {
      if (!formData.release_title) nextErrors.release_title = 'Обязательно';
      if (!formData.artists) nextErrors.artists = 'Обязательно';
      if (!formData.main_genre) nextErrors.main_genre = 'Обязательно';
      if (selectedGenre?.subgenres?.length && !formData.sub_genre) nextErrors.sub_genre = 'Обязательно';
      if (!currentReleaseDate) nextErrors.release_date = 'Обязательно';
      if (!formData.cover_image) nextErrors.cover_image = 'Загрузите обложку';
    }

    if (currentStep === 2) {
      formData.tracks.forEach((track, index) => {
        if (!track.track_title) nextErrors[`track_${index}_title`] = 'Название обязательно';
        if (!track.track_artists) nextErrors[`track_${index}_artists`] = 'Артисты обязательны';
        if (!track.audio_file_obj) nextErrors[`track_${index}_audio`] = 'Загрузите WAV или FLAC';
      });
    }

    if (currentStep === 3) {
      if (!formData.project_demo_link) nextErrors.project_demo_link = 'Обязательно';
      if (!formData.telegram) nextErrors.telegram = 'Обязательно';
      if (!formData.spotify_profile) nextErrors.spotify_profile = 'Обязательно';
      if (!formData.apple_music_profile) nextErrors.apple_music_profile = 'Обязательно';
    }

    if (currentStep === 4 && !formData.agreement) {
      nextErrors.agreement = 'Нужно подтверждение';
    }

    setErrors(nextErrors);
    setStepErrors((prev) => ({ ...prev, [currentStep]: Object.keys(nextErrors).length > 0 }));
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((value) => Math.min(value + 1, 4));
  };

  const prevStep = () => setStep((value) => Math.max(value - 1, 1));

  const submitToApi = async () => {
    if (!validateStep(4)) return;
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
      data.append(
        'metadata',
        JSON.stringify({
          tracks: formData.tracks.map((track) => ({
            track_title: track.track_title,
            track_artists: track.track_artists,
            lyrics_authors: track.lyrics_authors,
            music_authors: track.music_authors,
            explicit: track.explicit,
            isrc: track.isrc,
          })),
          telegram: formData.telegram,
          demo: formData.project_demo_link,
          upc: formData.upc,
          comment: formData.comment,
          release_date: currentReleaseDate,
          release_date_type: formData.release_date_type,
          spotify_profile: formData.spotify_profile,
          apple_music_profile: formData.apple_music_profile,
          main_genre: formData.main_genre,
          sub_genre: formData.sub_genre,
        }),
      );

      if (formData.cover_image) data.append('cover', formData.cover_image);

      const res = await createReleaseWithCover(data);
      const releaseId = res.data.id;

      for (let i = 0; i < formData.tracks.length; i += 1) {
        const track = formData.tracks[i];
        const trackData = new FormData();
        trackData.append('track_audio', track.audio_file_obj);
        trackData.append('trackIndex', i);
        trackData.append('trackTitle', track.track_title);
        trackData.append('trackArtists', track.track_artists);
        trackData.append('lyricsAuthors', track.lyrics_authors);
        trackData.append('musicAuthors', track.music_authors);
        trackData.append('explicit', track.explicit);
        trackData.append('isrc', track.isrc);
        await uploadTrackToRelease(releaseId, trackData);
      }

      setSubmitMessage('Релиз успешно отправлен');
      setTimeout(() => nav('/dashboard'), 1200);
    } catch (err) {
      setSubmitMessage(`Не удалось отправить релиз: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell min-h-screen bg-[#0a0a0a] text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div />
          <button type="button" onClick={() => nav('/dashboard')} className="secondary-button px-3 py-3">
            <X size={16} />
          </button>
        </div>

        <div className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Создание релиза</h1>
          <p className="mt-2 text-sm text-zinc-400">Заполните данные о релизе, треках и контактах для отправки на модерацию.</p>
        </div>

        <div className="mt-8 flex w-full items-center justify-center">
          <div className="flex w-full max-w-5xl items-center justify-between gap-6">
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
                <div key={item.title} className="flex flex-1 items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(currentStep)}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold transition ${
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
                      <p className={`text-base font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>{item.title}</p>
                      <p className="text-sm text-zinc-500">{item.subtitle}</p>
                    </div>
                  </button>
                  {currentStep < 4 ? <div className="hidden h-px flex-1 bg-zinc-800/60 md:block" /> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 panel-card p-6">
          {step === 1 && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Название релиза *" name="release_title" value={formData.release_title} onChange={handleChange} error={errors.release_title} />
                <Field label="Подзаголовок" name="subtitle" value={formData.subtitle} onChange={handleChange} />
                <SelectField label="Тип релиза *" name="release_type" value={formData.release_type} onChange={handleChange}>
                  <option value="single">Сингл</option>
                  <option value="ep">EP</option>
                  <option value="album">Альбом</option>
                </SelectField>
                <Field label="Артисты *" name="artists" value={formData.artists} onChange={handleChange} error={errors.artists} />

                <label className="block space-y-2 md:col-span-2">
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
                  <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-white">Поджанр</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedGenre.subgenres.map((sub) => (
                        <label key={sub} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${formData.sub_genre === sub ? 'border-white bg-white text-black' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'}`}>
                          <input
                            type="radio"
                            name="sub_genre"
                            value={sub}
                            checked={formData.sub_genre === sub}
                            onChange={handleChange}
                            className="h-4 w-4"
                          />
                          {sub}
                        </label>
                      ))}
                    </div>
                    {errors.sub_genre ? <span className="mt-2 block text-xs text-red-300">{errors.sub_genre}</span> : null}
                  </div>
                ) : null}

                <Field label="UPC" name="upc" value={formData.upc} onChange={handleChange} />

                <div className="space-y-3">
                  <span className="field-label">Дата релиза *</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, release_date_type: 'asap', release_date: getAutoReleaseDateValue() }))}
                      className={formData.release_date_type === 'asap' ? 'primary-button px-4 py-3' : 'secondary-button px-4 py-3'}
                    >
                      Как можно скорее (автоматически через 3 дня)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, release_date_type: 'exact_date' }))}
                      className={formData.release_date_type === 'exact_date' ? 'primary-button px-4 py-3' : 'secondary-button px-4 py-3'}
                    >
                      Точная дата
                    </button>
                  </div>
                  {formData.release_date_type === 'asap' ? null : (
                    <Field name="release_date" type="date" value={formData.release_date} onChange={handleChange} error={errors.release_date} />
                  )}
                </div>

                <div className="space-y-2">
                  <span className="field-label">Загрузите свою обложку *</span>
                  <div className="rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-6">
                    <div className="mb-3 flex items-center gap-2 text-zinc-300">
                      <Upload size={16} />
                      Загрузите свою обложку
                    </div>
                    <input name="cover_image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black" />
                    {errors.cover_image ? <p className="mt-2 text-xs text-red-300">{errors.cover_image}</p> : null}
                  </div>
                  {coverPreview ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                      <img src={coverPreview} alt="Preview" className="aspect-square w-full rounded-lg object-cover" />
                    </div>
                  ) : null}
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

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Название *" value={track.track_title} onChange={(e) => handleTrackChange(index, 'track_title', e.target.value)} error={errors[`track_${index}_title`]} />
                      <Field label="Артисты *" value={track.track_artists} onChange={(e) => handleTrackChange(index, 'track_artists', e.target.value)} error={errors[`track_${index}_artists`]} />
                      <Field label="Авторы текста" value={track.lyrics_authors} onChange={(e) => handleTrackChange(index, 'lyrics_authors', e.target.value)} />
                      <Field label="Авторы музыки" value={track.music_authors} onChange={(e) => handleTrackChange(index, 'music_authors', e.target.value)} />
                      <Field label="ISRC" value={track.isrc} onChange={(e) => handleTrackChange(index, 'isrc', e.target.value)} />

                      <label className="block space-y-2">
                        <span className="field-label">Аудио WAV / FLAC *</span>
                        <div className="rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-6">
                          <input type="file" accept=".wav,.flac,audio/wav,audio/flac" onChange={(e) => handleTrackChange(index, 'audio_file_obj', e.target.files?.[0] || null)} className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black" />
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
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  labelNode={(
                    <>
                      Ссылка на демо / договор *
                      <span
                        title="Ссылка на видеозапись проекта (с демонстрацией дорожек баса, мелодии и кика) или договор на биты"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-slate-400"
                      >
                        <CircleHelp size={12} />
                      </span>
                    </>
                  )}
                  name="project_demo_link"
                  value={formData.project_demo_link}
                  onChange={handleChange}
                  error={errors.project_demo_link}
                  wrapperClassName="md:col-span-2"
                />
                <Field label="Telegram *" name="telegram" value={formData.telegram} onChange={handleChange} error={errors.telegram} />
                <SelectField label="Карточка/профиль артиста в Spotify *" name="spotify_profile" value={formData.spotify_profile} onChange={handleChange} error={errors.spotify_profile}>
                  <option value="create">Создать</option>
                  <option value="exists">Есть</option>
                  <option value="already_submitted">Указывал ранее</option>
                </SelectField>
                <SelectField label="Карточка/профиль артиста в Apple Music *" name="apple_music_profile" value={formData.apple_music_profile} onChange={handleChange} error={errors.apple_music_profile}>
                  <option value="create">Создать</option>
                  <option value="exists">Есть</option>
                  <option value="already_submitted">Указывал ранее</option>
                </SelectField>
                <label className="block space-y-2 md:col-span-2">
                      <span className="field-label">Комментарий модератору</span>
                      <textarea name="comment" value={formData.comment} onChange={handleChange} rows={5} className="field-textarea" />
                    </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="soft-card p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Сводка релиза</p>
                    <div className="mt-4 space-y-3 text-sm text-zinc-300">
                      <p><span className="text-zinc-500">Релиз:</span> {formData.release_title}</p>
                      <p><span className="text-zinc-500">Артисты:</span> {formData.artists}</p>
                      <p><span className="text-zinc-500">Жанр:</span> {buildGenreLabel(formData.main_genre, formData.sub_genre) || 'Не указан'}</p>
                      <p><span className="text-zinc-500">Тип:</span> {formData.release_type}</p>
                      <p><span className="text-zinc-500">Дата релиза:</span> {currentReleaseDate}</p>
                    </div>
                  </div>
                  <div className="soft-card p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Обложка</p>
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover preview" className="mt-4 aspect-square w-full rounded-lg object-cover" />
                    ) : (
                      <div className="mt-4 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                        Обложка не загружена.
                      </div>
                    )}
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
                        <span className="text-zinc-500">{track.audio_file_obj ? track.audio_file_obj.name : 'Без файла'}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <label className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${errors.agreement ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'}`}>
                  <input type="checkbox" checked={formData.agreement} onChange={handleChange} name="agreement" className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900" />
                  <span>Подтверждаю корректность данных и права на материалы. Готов отправить релиз на модерацию.</span>
                </label>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800/60 pt-5">
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

        {isSubmitting ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] px-8 py-6 text-center">
              <Loader2 className="mx-auto mb-3 animate-spin text-white" size={28} />
              <p className="text-sm text-zinc-300">Загрузка треков, подождите немного</p>
            </div>
          </div>
        ) : null}

        {submitMessage ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-zinc-800/60 bg-[#121212] px-5 py-4 text-sm text-white shadow-2xl">
            {submitMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
