/* Voice Booth — grown-ups record or add each word, check it, then keep it on this device (Save)
 * or send it to the family storage (Upload). Felix's app plays uploaded clips.
 * Only audio is accepted, and clips over MAX_SECONDS are flagged and not kept.
 */
'use strict';

const SUPABASE_URL = 'https://twvqvutrcobedvuhnzxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';
const BUCKET = 'speech-therapy';
const MAX_SECONDS = 10;
const TRIM_SECONDS = 0.25;      // cut from the end of each recording when trimming is on
const DONE_KEY = 'speech.booth.v1';
const SETTINGS_KEY = 'speech.booth.settings.v1';
let settings = { trim: true, errors: true };
const clips = new Map();        // key -> { blob, url, mime }
const flags = new Map();        // key -> message shown on that word's row
let lessons = [];
let current = null;
let recorder = null;
let recordingKey = null;
let chunks = [];
let startedAt = 0;
let sb = null;
let signedIn = false;           // true once a family member has signed in (uploads need it)
let hideSignIn = null;          // timer that hides the sign-in form after sign-in

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
    upload.disabled = !signedIn || !clips.has(key);
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
      const kept = await maybeTrim(blob);
      await keepClip(key, word, kept, kept.type, elapsed);
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

/* ---------- Trimming the end of a recording ---------- */

function encodeWav(buf, frames) {
  const channels = buf.numberOfChannels;
  const rate = buf.sampleRate;
  const dataBytes = frames * channels * 2;
  const out = new DataView(new ArrayBuffer(44 + dataBytes));
  const text = (offset, s) => { for (let i = 0; i < s.length; i++) out.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  out.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);                    // PCM
  out.setUint16(22, channels, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * channels * 2, true);
  out.setUint16(32, channels * 2, true);
  out.setUint16(34, 16, true);                   // 16-bit
  text(36, 'data');
  out.setUint32(40, dataBytes, true);

  const channelData = [];
  for (let c = 0; c < channels; c++) channelData.push(buf.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, channelData[c][i]));
      out.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

async function trimEnd(blob, seconds) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const frames = buf.length - Math.round(seconds * buf.sampleRate);
    if (frames <= 0) return blob;   // too short to trim: keep it as recorded
    return encodeWav(buf, frames);
  } finally {
    ctx.close();
  }
}

async function maybeTrim(blob) {
  if (!settings.trim) return blob;
  try {
    return await trimEnd(blob, TRIM_SECONDS);
  } catch (e) {
    trap('trim', e, 'Kept the recording untrimmed.');
    return blob;
  }
}

/* ---------- Booth settings ---------- */

function readSettings() {
  try {
    return { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch (e) {
    trap('booth settings', e, 'Using the default settings for this session.');
    return { ...settings };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    trap('saving booth settings', e, 'Could not save on this device (storage blocked or full).');
  }
}

function applySettings() {
  document.getElementById('opt-trim').checked = settings.trim;
  document.getElementById('opt-errors').checked = settings.errors;
  document.getElementById('error-panel').classList.toggle('hidden', !settings.errors);
}

/* ---------- Sign-in (uploads need a family member's account) ---------- */

// Takes the session as given. Never call sb.auth from inside an auth-change callback (it deadlocks).
function applyAuth(session) {
  const status = document.getElementById('auth-status');
  signedIn = !!session;
  status.textContent = session
    ? `Signed in as ${session.user.email}. Uploads are on.`
    : 'Not signed in. Uploads are off until you sign in.';
  const form = document.getElementById('signin-form');
  clearTimeout(hideSignIn);
  if (signedIn) {
    form.classList.add('fading');
    hideSignIn = setTimeout(() => form.classList.add('hidden'), 1000);
  } else {
    form.classList.remove('fading', 'hidden');
  }
  document.getElementById('sign-out').hidden = !signedIn;
  renderLesson();
}

async function refreshAuth() {
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  applyAuth(session);
}

async function signIn(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!sb) {
    trap('sign-in', new Error('Not connected to the family storage.'), 'Try again when the device is online.');
    return;
  }
  const button = document.getElementById('sign-in');
  button.disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    document.getElementById('password').value = '';
    logLine('ok', 'Signed in. Uploads are on.');
  } catch (e) {
    trap('sign-in', e, 'Check the email and password. A grown-up can reset the password in Supabase.');
  } finally {
    button.disabled = false;
  }
}

function openDrawer(show) {
  document.getElementById('drawer').classList.toggle('hidden', !show);
}

async function signOut() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    logLine('ok', 'Signed out.');
  } catch (e) {
    trap('sign-out', e);
  }
}

function wireControls() {
  document.getElementById('opt-trim').addEventListener('change', (e) => {
    settings.trim = e.target.checked;
    saveSettings();
  });
  document.getElementById('opt-errors').addEventListener('change', (e) => {
    settings.errors = e.target.checked;
    saveSettings();
    applySettings();
  });
  document.getElementById('signin-form').addEventListener('submit', signIn);
  document.getElementById('gear').addEventListener('click', () => openDrawer(document.getElementById('drawer').classList.contains('hidden')));
  document.getElementById('close-drawer').addEventListener('click', () => openDrawer(false));
  document.getElementById('sign-out').addEventListener('click', signOut);
  if (sb) sb.auth.onAuthStateChange((_event, session) => applyAuth(session));
}

/* ---------- Boot ---------- */

async function boot() {
  settings = readSettings();
  applySettings();
  if (!window.isSecureContext) {
    logLine('info', 'Not a secure (https) address. Recording will not work here.');
  }
  initSupabase();
  wireControls();
  await loadLessons();
  fillPicker();
  renderLesson();
  refreshAuth().catch((e) => trap('sign-in status', e));
}

boot();
