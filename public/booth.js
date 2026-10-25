/* Voice Booth — grown-ups record or add each word, check it, then keep it on this device (Save)
 * or send it to the family storage (Upload). Felix's app plays uploaded clips.
 * Only audio is accepted, and clips over MAX_SECONDS are flagged and not kept.
 */
'use strict';

const SUPABASE_URL = 'https://twvqvutrcobedvuhnzxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';
const BUCKET = 'speech-therapy';
const MAX_SECONDS = 10;
const DONE_KEY = 'speech.booth.v1';
const clips = new Map();        // key -> { blob, url, mime }
const flags = new Map();        // key -> message shown on that word's row
let lessons = [];
let current = null;
let recorder = null;
let recordingKey = null;
let chunks = [];
let startedAt = 0;
let sb = null;

/* ---------- Error trapping ---------- */

function logLine(kind, text) {
  const panel = document.getElementById('error-panel');
  const div = document.createElement('div');
  div.className = `line ${kind}`;
  div.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  panel.appendChild(div);
  panel.scrollTop = panel.scrollHeight;
}

function trap(area, err, hint) {
  logLine('fail', `${area}: ${(err && err.message) || err || 'unknown error'}`);
  if (hint) logLine('info', `  → ${hint}`);
  console.error(area, err);
}

window.addEventListener('error', (e) => trap('script', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => trap('async', e.reason));

/* ---------- Setup ---------- */

function initSupabase() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library did not load (offline or blocked CDN).');
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    trap('database connection', e, 'Uploads are off until the device is online.');
    sb = null;
  }
}

/* ---------- Saved progress (per device) ---------- */

function readDone() {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
  } catch (e) {
    trap('saved progress', e, 'This browser blocks saving. Progress lasts only until the tab closes.');
    return {};
  }
}

function writeDone(done) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch (e) {
    trap('saving progress', e, 'Could not save on this device (storage blocked or full).');
  }
}

/* ---------- Lessons ---------- */

async function loadLessons() {
  try {
    const res = await fetch('lessons.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`lessons.json returned HTTP ${res.status}`);
    const json = await res.json();
    lessons = json.lessons || [];
    logLine('ok', `Loaded ${lessons.length} lessons.`);
  } catch (e) {
    trap('lessons', e, 'Open the app through its web address, not as a local file.');
  }
}

function lessonKey(l) {
  return `${l.track}-${l.lesson_no}`;
}

// Same key the app uses to find a clip: "en-2-3" is the third word of lesson 2 in English.
function clipKey(lesson, index) {
  return `${lessonKey(lesson)}-${index + 1}`;
}

function fillPicker() {
  const pick = document.getElementById('lesson-pick');
  pick.innerHTML = '';
  lessons.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = lessonKey(l);
    opt.textContent = `${l.track === 'en' ? 'EN' : 'ZH'} ${l.lesson_no}. ${l.title}`;
    pick.appendChild(opt);
  });
  pick.addEventListener('change', () => {
    current = lessons.find((l) => lessonKey(l) === pick.value) || null;
    renderLesson();
  });
  current = lessons[0] || null;
  if (current) pick.value = lessonKey(current);
}

function renderLesson() {
  const list = document.getElementById('word-list');
  list.innerHTML = '';
  if (!current) {
    document.getElementById('lesson-heading').textContent = 'No lesson selected';
    return;
  }
  document.getElementById('lesson-heading').textContent = current.title;

  const done = readDone();
  current.words.forEach((word, i) => {
    const key = clipKey(current, i);
    const row = document.createElement('div');
    row.className = 'word-row';

    const text = document.createElement('div');
    text.className = 'text';
    text.innerHTML = `${escapeHtml(word)} ${done[key] ? '<span class="done-mark">✓ ready</span>' : ''}`;
    if (flags.has(key)) {
      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = `⚠ ${flags.get(key)}`;
      text.appendChild(flag);
    }
    row.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const rec = document.createElement('button');
    rec.className = 'rec';
    rec.textContent = recordingKey === key ? '⏹ Stop' : '🎤 Record';
    rec.classList.toggle('on', recordingKey === key);
    rec.addEventListener('click', () => toggleRecord(key, word, i));
    actions.appendChild(rec);

    const add = document.createElement('button');
    add.className = 'add';
    add.textContent = '📂 Add audio';
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'audio/*';
    picker.addEventListener('change', () => {
      if (picker.files && picker.files[0]) onFilePicked(key, word, i, picker.files[0]);
      picker.value = '';
    });
    add.addEventListener('click', () => picker.click());
    actions.appendChild(add);
    actions.appendChild(picker);

    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = '▶ Play';
    play.disabled = !clips.has(key);
    play.addEventListener('click', () => playClip(key));
    actions.appendChild(play);

    const save = document.createElement('button');
    save.className = 'save';
    save.textContent = '💾 Save';
    save.disabled = !clips.has(key);
    save.addEventListener('click', () => saveClip(key, word, i));
    actions.appendChild(save);

    const upload = document.createElement('button');
    upload.className = 'upload';
    upload.textContent = '☁ Upload';
    upload.disabled = !clips.has(key);
    upload.addEventListener('click', () => uploadClip(key, word, i));
    actions.appendChild(upload);

    row.appendChild(actions);
    list.appendChild(row);
  });
  updateProgress();
}

function updateProgress() {
  const done = readDone();
  const total = lessons.reduce((s, l) => s + l.words.length, 0);
  const count = Object.keys(done).length;
  document.getElementById('progress-line').textContent =
    `${count} of ${total} words ready on this device.`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Length and type checks ---------- */

async function durationOf(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf.duration;
  } finally {
    ctx.close();
  }
}

// Returns the clip's length in seconds, or null when it cannot be read as audio.
async function lengthOf(blob, fallbackSeconds) {
  try {
    return await durationOf(blob);
  } catch (e) {
    return fallbackSeconds === undefined ? null : fallbackSeconds;
  }
}

/* Keep a clip only when it is audio and short enough. Otherwise flag the word and keep nothing. */
async function keepClip(key, word, blob, mime, fallbackSeconds) {
  const seconds = await lengthOf(blob, fallbackSeconds);
  if (seconds === null) {
    flags.set(key, 'Could not read this as audio.');
    trap(`"${word}"`, new Error('Not a readable audio file.'), 'Choose a sound file (MP3, M4A, WAV or a recording).');
    renderLesson();
    return false;
  }
  if (seconds > MAX_SECONDS) {
    flags.set(key, `${seconds.toFixed(1)} s. Keep it to ${MAX_SECONDS} s or less.`);
    trap(`"${word}" is too long`, new Error(`${seconds.toFixed(1)} seconds`), `Record it again, shorter than ${MAX_SECONDS} seconds.`);
    renderLesson();
    return false;
  }

  flags.delete(key);
  const old = clips.get(key);
  if (old) URL.revokeObjectURL(old.url);
  clips.set(key, { blob, url: URL.createObjectURL(blob), mime });
  const done = readDone();
  done[key] = true;
  writeDone(done);
  logLine('ok', `"${word}" ready (${seconds.toFixed(1)} s).`);
  renderLesson();
  return true;
}

function extFor(mime) {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

async function onFilePicked(key, word, index, file) {
  if (!file.type.startsWith('audio/')) {
    flags.set(key, `Not an audio file (${file.type || 'unknown type'}).`);
    trap(`"${word}"`, new Error('Only audio files are accepted.'), 'Choose an MP3, M4A, WAV or other sound file.');
    renderLesson();
    return;
  }
  await keepClip(key, word, file, file.type, undefined);
}

/* ---------- Recording ---------- */

function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

async function toggleRecord(key, word, index) {
  if (recorder && recordingKey === key) {
    recorder.stop();
    return;
  }
  if (recorder) {
    trap('recording', new Error('Already recording another word. Stop it first.'));
    return;
  }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('No microphone access here. Open the app from its https web address.');
    }
    if (!window.MediaRecorder) {
      throw new Error('This browser cannot record audio (MediaRecorder missing).');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recordingKey = key;
    chunks = [];
    recorder.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) chunks.push(e.data); });
    recorder.addEventListener('error', (e) => trap('recording', e.error || new Error('recorder error')));
    recorder.addEventListener('stop', async () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      stream.getTracks().forEach((t) => t.stop());
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      recorder = null;
      recordingKey = null;
      if (!blob.size) {
        trap('recording', new Error(`"${word}" came out empty.`), 'Check the microphone and try again.');
        renderLesson();
        return;
      }
      await keepClip(key, word, blob, type, elapsed);
    });
    startedAt = Date.now();
    recorder.start();
    logLine('info', `Recording "${word}". Tap Stop when done (${MAX_SECONDS} s at most).`);
    renderLesson();
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    trap('microphone', e, denied ? 'Allow the microphone for this site in Settings, then try again.' : null);
    recorder = null;
    recordingKey = null;
  }
}

function playClip(key) {
  const clip = clips.get(key);
  if (!clip) return;
  try {
    const audio = new Audio(clip.url);
    audio.play().catch((e) => trap('playback', e, 'Tap the play button again, or check the device volume.'));
  } catch (e) {
    trap('playback', e);
  }
}

function saveClip(key, word, index) {
  const clip = clips.get(key);
  if (!clip) return;
  try {
    const name = `${current.track}-${String(current.lesson_no).padStart(2, '0')}-${index + 1}-${word}.${extFor(clip.mime)}`;
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    logLine('ok', `Saved ${name} to this device.`);
  } catch (e) {
    trap('save', e, 'Downloads are blocked here. Try again from Safari or Chrome.');
  }
}

async function uploadClip(key, word, index) {
  const clip = clips.get(key);
  if (!clip) return;
  if (!sb) {
    trap('upload', new Error('Not connected to the family storage.'), 'Try again when the device is online.');
    return;
  }
  const path = `clips/${key}.${extFor(clip.mime)}`;
  try {
    const { error } = await sb.storage.from(BUCKET).upload(path, clip.blob, {
      upsert: true,
      contentType: clip.mime || 'audio/webm',
    });
    if (error) throw error;
    logLine('ok', `Uploaded "${word}" as ${path}. Felix's app will play it next time it loads.`);
  } catch (e) {
    trap(`upload "${word}"`, e, 'Uploads need a family sign-in if the storage rules ask for one. Save keeps a copy on this device.');
  }
}

/* ---------- Boot ---------- */

async function boot() {
  if (!window.isSecureContext) {
    logLine('info', 'Not a secure (https) address. Recording will not work here.');
  }
  initSupabase();
  await loadLessons();
  fillPicker();
  renderLesson();
}

boot();
