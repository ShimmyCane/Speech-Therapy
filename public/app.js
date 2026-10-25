/* Felix's Sounds — MVP (Speech Therapy)
 * No build step. Supabase (Family project) for lessons, sessions and attempts,
 * with a bundled lessons.json fallback. Every failure goes to the error panel.
 */
'use strict';

const SUPABASE_URL = 'https://twvqvutrcobedvuhnzxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';
const BUCKET = 'speech-therapy';
const TABLES = ['speech_topics', 'speech_lessons', 'speech_words', 'speech_sessions', 'speech_attempts'];
const TRY_COUNT = 5;
const VOICE_RMS = 0.02;          // level that counts as "sound" (tune in M3)
const PROGRESS_KEY = 'speech.progress.v1';
const SETTINGS_KEY = 'speech.settings.v1';
const DIFFICULTY_KEY = 'speech.difficulty.v1';
const RECORDED_EXTS = ['m4a', 'mp3', 'webm', 'ogg', 'wav'];   // formats the Voice Booth uploads
const warnedVoice = new Set();   // warn once per language, not once per word

const state = {
  track: 'en',
  lessons: [],          // lessons shown to Felix (or drafts in preview)
  allLessons: [],       // everything loaded
  source: 'none',       // 'database' | 'bundled'
  sb: null,             // Supabase client, or null when offline
  settings: { speed: 1, drafts: false, errors: true },
  progress: {},         // { 'en-2': 3 }  best average stars per lesson
  current: null,        // lesson being played
  tries: [],            // [{ stars, voicedMs, hiss, peak }]
  rec: null,            // live recording state
  phase: 'idle',        // idle | speaking | countdown | recording | reviewing
  targetIndex: null,    // word the grown-up or Felix tapped for this try (null = next in order)
  timer: null,          // countdown interval
};

/* ---------- Error trapping and visible log ---------- */

const logLines = [];

function logLine(kind, text) {
  const time = new Date().toLocaleTimeString();
  logLines.push({ kind, text: `${time}  ${text}` });
  if (logLines.length > 200) logLines.shift();
  renderErrors();
  updatePill();
}

function hintFor(err) {
  const msg = String((err && (err.message || err.error_description)) || err || '');
  const code = err && err.code;
  if (code === '42P01' || code === 'PGRST205' || /schema cache|does not exist|Could not find the table/i.test(msg)) {
    return 'Table missing. Run 03 Projects/Speech Therapy/supabase/schema.sql in the Family project.';
  }
  if (code === '42501' || /row-level security|permission denied|JWT|not authorized/i.test(msg) || (err && (err.status === 401 || err.status === 403))) {
    return 'Blocked by security (RLS). Sign in as a family member, then try again.';
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) {
    return 'No connection. Lessons come from the bundled copy on this device.';
  }
  return null;
}

function trap(area, err, hint) {
  const msg = (err && (err.message || err.error_description)) || String(err) || 'unknown error';
  logLine('fail', `${area}: ${msg}`);
  const h = hint || hintFor(err);
  if (h) logLine('info', `  → ${h}`);
  showToast(`${area} failed. See the error panel.`, true);
  console.error(area, err);
}

window.addEventListener('error', (e) => trap('script', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => trap('async', e.reason));
window.addEventListener('offline', () => logLine('info', 'Device went offline.'));
window.addEventListener('online', () => logLine('info', 'Device is back online.'));

function renderErrors() {
  const panel = document.getElementById('error-panel');
  panel.classList.toggle('hidden', !state.settings.errors);
  panel.innerHTML = '';
  const shown = logLines.slice(-60);
  if (!shown.length) {
    panel.innerHTML = '<div class="line info">No errors. Everything is quiet.</div>';
    return;
  }
  for (const l of shown) {
    const div = document.createElement('div');
    div.className = `line ${l.kind === 'fail' ? 'fail' : l.kind === 'ok' ? 'ok' : 'info'}`;
    div.textContent = l.text;
    panel.appendChild(div);
  }
  panel.scrollTop = panel.scrollHeight;
}

function updatePill() {
  const pill = document.getElementById('net-pill');
  const fails = logLines.filter((l) => l.kind === 'fail').length;
  const db = state.source === 'database' ? 'database' : 'bundled';
  pill.textContent = `${db} · ${fails} error${fails === 1 ? '' : 's'}`;
  pill.classList.toggle('bad', fails > 0);
}

function showToast(text, bad) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.toggle('bad', !!bad);
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

/* ---------- Storage helpers (private mode can throw) ---------- */

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    trap('saved settings', e, 'This browser blocks saving. Progress lasts only until the tab closes.');
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    trap('saving', e, 'Could not save on this device (storage blocked or full).');
  }
}

/* ---------- Setup ---------- */

function initSupabase() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library did not load (offline or blocked CDN).');
    }
    state.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    logLine('ok', 'Supabase client ready.');
  } catch (e) {
    trap('database connection', e);
    state.sb = null;
  }
}

async function loadBundled() {
  try {
    const res = await fetch('public/lessons.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`lessons.json returned HTTP ${res.status}`);
    const json = await res.json();
    return json.lessons || [];
  } catch (e) {
    trap('bundled lessons', e, 'Open the app through its web address, not as a local file.');
    return [];
  }
}

function sFocusFor(bundled, track, no) {
  const hit = bundled.find((b) => b.track === track && b.lesson_no === no);
  return hit ? hit : { s_focus: false, mouth_text: '' };
}

async function loadLessons() {
  const bundled = await loadBundled();
  state.bundled = bundled;

  if (state.sb) {
    try {
      const { data, error } = await state.sb
        .from('speech_lessons')
        .select('id,track,lesson_no,variant,title,focus,draft_words,status')
        .order('lesson_no', { ascending: true });
      if (error) throw error;
      if (data && data.length) {
        state.allLessons = data.map((row) => {
          const extra = sFocusFor(bundled, row.track, row.lesson_no);
          return {
            id: row.id,
            track: row.track,
            lesson_no: row.lesson_no,
            title: row.title,
            focus: row.focus,
            words: row.draft_words || [],
            status: row.status,
            s_focus: extra.s_focus,
            mouth_text: extra.mouth_text,
          };
        });
        state.source = 'database';
        logLine('ok', `Loaded ${data.length} lessons from the database.`);
        return;
      }
      logLine('info', 'Database has no lesson rows yet. Using the bundled copy.');
    } catch (e) {
      trap('lessons from database', e);
    }
  }

  state.allLessons = bundled.map((b) => ({ ...b, id: null, words: b.words || [] }));
  state.source = 'bundled';
}

function visibleLessons() {
  const track = state.allLessons.filter((l) => l.track === state.track);
  const sorted = track.sort((a, b) => a.lesson_no - b.lesson_no);
  return state.settings.drafts ? sorted : sorted.filter((l) => l.status === 'published');
}

function keyOf(l) {
  return `${l.track}-${l.lesson_no}`;
}

function isUnlocked(list, index) {
  if (index === 0) return true;
  return !!state.progress[keyOf(list[index - 1])];
}

/* ---------- Home ---------- */

function renderHome() {
  document.getElementById('track-en').classList.toggle('on', state.track === 'en');
  document.getElementById('track-zh').classList.toggle('on', state.track === 'zh');
  document.getElementById('track-title').textContent =
    state.track === 'en' ? 'English sounds' : 'Chinese sounds (中文)';

  const list = visibleLessons();
  const path = document.getElementById('path');
  path.innerHTML = '';

  if (!list.length) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = state.settings.drafts
      ? 'No lessons loaded for this language.'
      : 'No lessons are published yet. A grown-up can try drafts from ⚙️.';
    path.appendChild(note);
  }

  list.forEach((lesson, i) => {
    const unlocked = isUnlocked(list, i) || state.settings.drafts;
    const done = state.progress[keyOf(lesson)];
    const btn = document.createElement('button');
    btn.className = `step${done ? ' done' : ''}${!unlocked ? ' locked' : ''}${lesson.status === 'draft' ? ' draft' : ''}`;
    btn.disabled = !unlocked;
    btn.innerHTML = `${lesson.lesson_no}${lesson.status === 'draft' ? '<small>draft</small>' : ''}`;
    btn.title = lesson.title;
    btn.addEventListener('click', () => openLesson(lesson));
    path.appendChild(btn);
  });

  const today = todayLesson();
  const line = document.getElementById('today-line');
  const play = document.getElementById('play-today');
  if (today) {
    line.textContent = `Today: ${today.title}`;
    play.disabled = false;
  } else {
    line.textContent = 'All lessons done for now. Play again any time!';
    play.disabled = true;
  }

  const sourceNote = document.getElementById('lesson-source');
  sourceNote.textContent = state.source === 'database'
    ? 'Lessons come from the database.'
    : 'Lessons come from the copy on this device (database not reached).';
}

function todayLesson() {
  const tracks = [state.track, state.track === 'en' ? 'zh' : 'en'];
  for (const t of tracks) {
    const list = state.allLessons
      .filter((l) => l.track === t && (state.settings.drafts || l.status === 'published'))
      .sort((a, b) => a.lesson_no - b.lesson_no);
    for (let i = 0; i < list.length; i++) {
      if (!state.progress[keyOf(list[i])] && isUnlocked(list, i)) return list[i];
    }
  }
  return null;
}

/* ---------- Speaking (model voice) ---------- */

function langCode(track) {
  return track === 'zh' ? 'zh-CN' : 'en-US';
}

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2).toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
}

function speak(text, lang, rate, pitch, onEnd) {
  if (!('speechSynthesis' in window)) {
    trap('speech', new Error('This browser cannot speak (no speechSynthesis).'));
    onEnd && onEnd();
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    const voice = pickVoice(lang);
    if (voice) {
      u.voice = voice;
    } else if (!warnedVoice.has(lang)) {
      warnedVoice.add(lang);
      logLine('info', `No ${lang} voice found on this device. Using the default voice.`);
    }
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        trap('speech', new Error(`speech error: ${e.error}`));
      }
      onEnd && onEnd();
    };
    u.onend = () => onEnd && onEnd();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    trap('speech', e);
    onEnd && onEnd();
  }
}

/* A grown-up's recording of a word, if one has been uploaded. Keys match the Voice Booth: "en-2-3". */
const clipUrls = new Map();   // key -> object URL, or null when no recording exists

async function recordedUrl(lesson, index) {
  const key = `${keyOf(lesson)}-${index + 1}`;
  if (clipUrls.has(key)) return clipUrls.get(key);
  let url = null;
  if (state.sb) {
    for (const ext of RECORDED_EXTS) {
      try {
        const { data, error } = await state.sb.storage.from(BUCKET).download(`clips/${key}.${ext}`);
        if (!error && data) {
          url = URL.createObjectURL(data);
          break;
        }
      } catch (e) {
        // No file in this format. Try the next one.
      }
    }
  }
  clipUrls.set(key, url);
  return url;
}

function playWord(lesson, index, onEnd) {
  const word = lesson.words[index];
  highlightChip(index);
  document.getElementById('listen-note').textContent = 'Listen closely…';
  const done = () => {
    if (state.phase !== 'speaking') return;   // the lesson was left while the word was playing
    document.getElementById('listen-note').textContent = '';
    highlightChip(-1);
    onEnd();
  };
  recordedUrl(lesson, index).then((url) => {
    if (!url) {
      speak(word, langCode(lesson.track), state.settings.speed, 1, done);
      return;
    }
    const audio = new Audio(url);
    audio.playbackRate = state.settings.speed;
    audio.preservesPitch = true;   // the pitch stays the same; only the pace changes
    audio.onended = done;
    audio.onerror = () => { trap('playback', new Error('Could not play the recording.')); done(); };
    audio.play().catch((e) => { trap('playback', e, 'Check the device volume, then tap the word again.'); done(); });
  });
}

function highlightChip(index) {
  document.querySelectorAll('#word-chips .chip').forEach((c, i) => {
    c.style.background = i === index ? 'var(--mint)' : 'var(--sun)';
  });
}

/* 3, 2, 1 (1.5 seconds), then recording starts on its own. */
function countdownThenRecord() {
  state.phase = 'countdown';
  setControls();
  const el = document.getElementById('countdown');
  let n = 3;
  el.textContent = String(n);
  state.timer = setInterval(async () => {
    n -= 1;
    if (n > 0) {
      el.textContent = String(n);
      return;
    }
    clearInterval(state.timer);
    state.timer = null;
    el.textContent = '';
    await startRecording();
    state.phase = state.rec ? 'recording' : 'idle';
    setControls();
  }, 500);
}

function onChipTap(index) {
  const lesson = state.current;
  if (!lesson || state.phase !== 'idle') return;
  state.phase = 'speaking';
  state.targetIndex = index;
  renderTry();
  setControls();
  playWord(lesson, index, countdownThenRecord);
}

/* Buttons follow the phase: one step at a time. */
function setControls() {
  const left = state.tries.length < TRY_COUNT;
  const phase = state.phase;
  document.querySelectorAll('#word-chips .chip').forEach((c) => {
    c.disabled = !(left && phase === 'idle');
  });
  document.getElementById('record').disabled =
    !left || phase === 'speaking' || phase === 'countdown' || phase === 'reviewing';
  document.getElementById('next-try').disabled = phase !== 'reviewing';
}

function leaveLesson() {
  clearInterval(state.timer);
  state.timer = null;
  window.speechSynthesis && window.speechSynthesis.cancel();
  if (state.rec) stopRecording();
  state.phase = 'idle';
}

/* ---------- Recording and the first-draft check ---------- */

function hissRatio(freqDb, binHz) {
  // Share of energy above 4 kHz (where S and SH hiss lives). First draft; calibrate in M3.
  let total = 0;
  let high = 0;
  const cut = Math.floor(4000 / binHz);
  for (let i = 1; i < freqDb.length; i++) {
    const m = Math.pow(10, freqDb[i] / 20);
    total += m;
    if (i >= cut) high += m;
  }
  return total > 0 ? high / total : 0;
}

async function startRecording() {
  if (state.rec) return;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('No microphone access here. Open the app from its https web address in Safari or Chrome.');
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('This browser has no AudioContext, so the check cannot run.');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);

    const binHz = ctx.sampleRate / analyser.fftSize;
    const timeBuf = new Float32Array(analyser.fftSize);
    const freqBuf = new Float32Array(analyser.frequencyBinCount);
    const frames = [];

    const rec = { ctx, stream, analyser, frames, raf: 0 };
    state.rec = rec;

    const tick = () => {
      analyser.getFloatTimeDomainData(timeBuf);
      let sum = 0;
      for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
      const rms = Math.sqrt(sum / timeBuf.length);
      analyser.getFloatFrequencyData(freqBuf);
      frames.push({ t: performance.now(), rms, hiss: hissRatio(freqBuf, binHz) });
      rec.raf = requestAnimationFrame(tick);
    };
    tick();

    setRecordButton(true);
    logLine('ok', `Microphone on (${Math.round(ctx.sampleRate / 1000)} kHz).`);
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    trap('microphone', e, denied ? 'Allow the microphone for this site in Settings, then try again.' : null);
    state.rec = null;
  }
}

async function stopRecording() {
  const rec = state.rec;
  if (!rec) return null;
  cancelAnimationFrame(rec.raf);
  state.rec = null;
  try {
    rec.stream.getTracks().forEach((t) => t.stop());
    await rec.ctx.close();
  } catch (e) {
    trap('microphone stop', e);
  }
  setRecordButton(false);
  return analyseTake(rec.frames);
}

function analyseTake(frames) {
  const voiced = frames.filter((f) => f.rms > VOICE_RMS);
  if (!voiced.length) return { voicedMs: 0, peak: 0, hiss: 0 };
  const voicedMs = voiced[voiced.length - 1].t - voiced[0].t;
  const peak = Math.max(...frames.map((f) => f.rms));
  const hiss = voiced.reduce((s, f) => s + f.hiss, 0) / voiced.length;
  return { voicedMs, peak, hiss };
}

function starsFor(take, lesson) {
  let stars = 0;
  if (take.voicedMs >= 200) stars = 1;
  const longEnough = take.voicedMs >= 300 && take.voicedMs <= 2000;
  const sOk = !lesson.s_focus || take.hiss >= 0.12;
  if (stars === 1 && longEnough && sOk) stars = 2;
  if (stars === 2 && (lesson.s_focus ? take.hiss >= 0.2 : take.peak >= 0.05)) stars = 3;
  return stars;
}

function feedbackFor(take, stars, lesson) {
  if (stars === 0) return "I couldn't hear that. Try a little louder!";
  if (stars === 1) return 'Nice voice! Make it a little longer.';
  if (lesson.s_focus && take.hiss < 0.12) return 'Keep the snake sound going: ssssss.';
  if (stars === 2) return 'Good try!';
  return 'Super try!';
}

function setRecordButton(on) {
  const btn = document.getElementById('record');
  btn.classList.toggle('recording', on);
  btn.textContent = on ? '⏹ Tap to stop' : '🎤 Tap to start';
}

/* ---------- Lesson flow ---------- */

function showScreen(name) {
  ['home', 'lesson', 'done'].forEach((s) => {
    document.getElementById(`screen-${s}`).classList.toggle('hidden', s !== name);
  });
  window.scrollTo(0, 0);
}

function openLesson(lesson) {
  leaveLesson();
  state.current = lesson;
  state.tries = [];
  state.targetIndex = null;
  document.getElementById('lesson-title').textContent = `${lesson.lesson_no}. ${lesson.title}`;
  document.getElementById('lesson-count').textContent = `${lesson.track === 'en' ? 'English' : '中文'} · ${lesson.status}`;
  document.getElementById('mouth-text').textContent = lesson.mouth_text || lesson.focus || '';
  document.getElementById('listen-note').textContent = '';
  document.getElementById('countdown').textContent = '';

  const chips = document.getElementById('word-chips');
  chips.innerHTML = '';
  lesson.words.forEach((w, i) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.type = 'button';
    c.textContent = w;
    c.addEventListener('click', () => onChipTap(i));
    chips.appendChild(c);
  });

  renderTry();
  setControls();
  showScreen('lesson');
}

function renderTry() {
  const lesson = state.current;
  const n = state.tries.length;
  const index = state.targetIndex !== null ? state.targetIndex : n % lesson.words.length;
  const word = lesson.words[index] || '';
  document.getElementById('try-line').textContent = n < TRY_COUNT
    ? `Try ${n + 1} of ${TRY_COUNT}: say "${word}"`
    : 'All tries done!';
  document.getElementById('try-feedback').textContent = '';
  document.getElementById('try-stars').textContent = '';
  setRecordButton(false);
  document.getElementById('lesson-count').textContent =
    `${lesson.track === 'en' ? 'English' : '中文'} · try ${Math.min(n + 1, TRY_COUNT)}/${TRY_COUNT}`;
}

async function onRecordTap() {
  if (!state.current) return;
  if (!state.rec) {
    await startRecording();
    state.phase = state.rec ? 'recording' : 'idle';
    setControls();
    return;
  }
  const take = await stopRecording();
  if (!take) {
    state.phase = 'idle';
    setControls();
    return;
  }
  const lesson = state.current;
  const stars = starsFor(take, lesson);
  state.tries.push({ stars, voicedMs: take.voicedMs, hiss: take.hiss, peak: take.peak });
  document.getElementById('try-stars').textContent = '⭐'.repeat(stars) || '·';
  document.getElementById('try-feedback').textContent = feedbackFor(take, stars, lesson);
  document.getElementById('next-try').textContent = state.tries.length >= TRY_COUNT ? 'See my stars ▶' : 'Next try ▶';
  state.phase = 'reviewing';
  setControls();
}

async function onNextTry() {
  if (state.tries.length >= TRY_COUNT) {
    await finishLesson();
    return;
  }
  state.phase = 'idle';
  state.targetIndex = null;
  document.getElementById('next-try').textContent = 'Next try ▶';
  renderTry();
  setControls();
}

async function finishLesson() {
  const lesson = state.current;
  const total = state.tries.reduce((s, t) => s + t.stars, 0);
  const avg = Math.round(total / state.tries.length);
  const key = keyOf(lesson);
  state.progress[key] = Math.max(state.progress[key] || 0, avg);
  writeStore(PROGRESS_KEY, state.progress);

  document.getElementById('done-stars').textContent = '⭐'.repeat(avg) || '·';
  document.getElementById('done-line').textContent =
    `${total} stars from ${TRY_COUNT} tries. Lesson ${lesson.lesson_no} is saved on this device.`;
  renderDifficulty(lesson);
  showScreen('done');

  await saveSession(lesson, avg);
}

async function saveSession(lesson, avg) {
  if (!state.sb) {
    logLine('info', 'Not sent to the database (not connected). Saved on this device only.');
    return;
  }
  try {
    const { data, error } = await state.sb
      .from('speech_sessions')
      .insert({ member_name: 'Felix', lesson_id: lesson.id || null, stars: avg })
      .select('id')
      .single();
    if (error) throw error;

    const rows = state.tries.map((t) => ({ session_id: data.id, word_id: null, stars: t.stars, similarity: null }));
    const { error: attemptError } = await state.sb.from('speech_attempts').insert(rows);
    if (attemptError) throw attemptError;

    logLine('ok', `Session saved (${rows.length} tries).`);
    showToast('Saved ✓');
  } catch (e) {
    trap('save session', e);
  }
}

/* ---------- Difficulty rating (1 to 10, saved on this device) ---------- */

function renderDifficulty(lesson) {
  const box = document.getElementById('difficulty');
  box.innerHTML = '';
  document.getElementById('difficulty-note').textContent = '';
  for (let n = 1; n <= 10; n++) {
    const b = document.createElement('button');
    b.className = 'btn sky';
    b.textContent = String(n);
    b.addEventListener('click', () => rateDifficulty(lesson, n));
    box.appendChild(b);
  }
}

function rateDifficulty(lesson, n) {
  const all = readStore(DIFFICULTY_KEY, {});
  const key = keyOf(lesson);
  all[key] = [...(all[key] || []), { rating: n, at: new Date().toISOString() }];
  writeStore(DIFFICULTY_KEY, all);
  document.querySelectorAll('#difficulty button').forEach((b) => {
    b.classList.toggle('on', Number(b.textContent) === n);
  });
  document.getElementById('difficulty-note').textContent = `Saved: ${n} out of 10.`;
}

/* ---------- New lesson (saved as a draft) ---------- */

function openCreateForm(show) {
  document.getElementById('create-form').classList.toggle('hidden', !show);
  document.getElementById('open-create').classList.toggle('hidden', show);
}

async function createLesson(event) {
  event.preventDefault();
  const track = document.getElementById('new-track').value;
  const lessonNo = Number(document.getElementById('new-no').value);
  const title = document.getElementById('new-title').value.trim();
  const focus = document.getElementById('new-focus').value.trim();
  const mouthText = document.getElementById('new-mouth').value.trim();
  const words = document.getElementById('new-words').value.split(',').map((w) => w.trim()).filter(Boolean);

  if (!Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > 99 || !title || !words.length) {
    trap('new lesson', new Error('Check the lesson number, title and words.'));
    return;
  }
  if (state.allLessons.some((l) => l.track === track && l.lesson_no === lessonNo)) {
    trap('new lesson', new Error(`Lesson ${lessonNo} already exists in this language.`));
    return;
  }
  if (!state.sb) {
    trap('new lesson', new Error('Not connected to the database, so the draft cannot be saved.'), 'Try again when the device is online.');
    return;
  }
  try {
    const { data, error } = await state.sb
      .from('speech_lessons')
      .insert({ track, lesson_no: lessonNo, variant: 'A', title, focus: focus || null, mouth_text: mouthText || null, draft_words: words, status: 'draft' })
      .select('id')
      .single();
    if (error) throw error;
    state.allLessons.push({ id: data.id, track, lesson_no: lessonNo, title, focus, words, status: 'draft', s_focus: false, mouth_text: mouthText });
    logLine('ok', `Draft lesson ${track} ${lessonNo} saved.`);
    showToast('Draft saved ✓');
    document.getElementById('create-form').reset();
    openCreateForm(false);
    renderHome();
  } catch (e) {
    trap('save draft lesson', e);
  }
}

/* ---------- Diagnostics (grown-up) ---------- */

async function runDiagnostics() {
  logLine('info', '— Database check started —');
  if (!state.sb) {
    logLine('fail', 'Client not ready: the Supabase library did not load.');
    return;
  }
  for (const table of TABLES) {
    try {
      const { count, error } = await state.sb.from(table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      logLine('ok', `${table}: reachable (${count ?? 0} rows)`);
    } catch (e) {
      trap(`table ${table}`, e);
    }
  }
  try {
    const { error } = await state.sb.storage.from(BUCKET).list('', { limit: 1 });
    if (error) throw error;
    logLine('ok', `storage bucket "${BUCKET}": reachable`);
  } catch (e) {
    trap(`storage bucket "${BUCKET}"`, e, 'Create the bucket by running schema.sql in the Family project.');
  }
  try {
    const { data, error } = await state.sb.auth.getSession();
    if (error) throw error;
    logLine('info', data.session ? 'Signed in as a family user.' : 'Not signed in (anonymous). Writes need sign-in.');
  } catch (e) {
    trap('sign-in check', e);
  }
  logLine('info', '— Database check finished —');
}

/* ---------- Wiring ---------- */

function applySettingsToUI() {
  const s = state.settings;
  document.getElementById('opt-drafts').checked = s.drafts;
  document.getElementById('opt-errors').checked = s.errors;
  ['075', '05', '1'].forEach((k) => {
    const v = k === '075' ? 0.75 : k === '05' ? 0.5 : 1;
    document.getElementById(`speed-${k}`).classList.toggle('on', s.speed === v);
  });
}

function setSpeed(v) {
  state.settings.speed = v;
  writeStore(SETTINGS_KEY, state.settings);
  applySettingsToUI();
}

function wire() {
  document.getElementById('go-home').addEventListener('click', () => { leaveLesson(); showScreen('home'); renderHome(); });
  document.getElementById('back-home').addEventListener('click', () => { leaveLesson(); showScreen('home'); renderHome(); });
  document.getElementById('done-home').addEventListener('click', () => { leaveLesson(); showScreen('home'); renderHome(); });
  document.getElementById('again').addEventListener('click', () => openLesson(state.current));
  document.getElementById('play-today').addEventListener('click', () => {
    const t = todayLesson();
    if (t) openLesson(t);
  });
  document.getElementById('track-en').addEventListener('click', () => { state.track = 'en'; renderHome(); });
  document.getElementById('track-zh').addEventListener('click', () => { state.track = 'zh'; renderHome(); });

  document.getElementById('record').addEventListener('click', onRecordTap);
  document.getElementById('open-create').addEventListener('click', () => openCreateForm(true));
  document.getElementById('cancel-create').addEventListener('click', () => openCreateForm(false));
  document.getElementById('create-form').addEventListener('submit', createLesson);
  document.getElementById('next-try').addEventListener('click', onNextTry);

  document.getElementById('speed-075').addEventListener('click', () => setSpeed(0.75));
  document.getElementById('speed-05').addEventListener('click', () => setSpeed(0.5));
  document.getElementById('speed-1').addEventListener('click', () => setSpeed(1));

  const drawer = document.getElementById('drawer');
  document.getElementById('gear').addEventListener('click', () => drawer.classList.toggle('hidden'));
  document.getElementById('close-drawer').addEventListener('click', () => drawer.classList.add('hidden'));
  document.getElementById('opt-drafts').addEventListener('change', (e) => {
    state.settings.drafts = e.target.checked;
    writeStore(SETTINGS_KEY, state.settings);
    renderHome();
  });
  document.getElementById('opt-errors').addEventListener('change', (e) => {
    state.settings.errors = e.target.checked;
    writeStore(SETTINGS_KEY, state.settings);
    renderErrors();
  });
  document.getElementById('run-diag').addEventListener('click', runDiagnostics);
  document.getElementById('reset-progress').addEventListener('click', () => {
    if (!window.confirm("Reset Felix's stars on this device?")) return;
    state.progress = {};
    writeStore(PROGRESS_KEY, state.progress);
    renderHome();
    showToast('Progress reset on this device.');
  });
}

async function boot() {
  state.settings = { ...state.settings, ...readStore(SETTINGS_KEY, {}) };
  state.progress = readStore(PROGRESS_KEY, {});
  applySettingsToUI();
  wire();

  if (!window.isSecureContext) {
    logLine('info', 'Not a secure (https) address. Microphone will not work here.');
  }
  initSupabase();
  await loadLessons();
  renderHome();
  logLine('info', `Ready. ${state.allLessons.length} lessons loaded.`);
}

boot();
