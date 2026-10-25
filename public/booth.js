/* Voice Booth — grown-ups record each word, edit the lesson, and publish it once every word is ready.
 * Recordings upload to the family storage automatically when signed in. Only audio is accepted;
 * clips over MAX_SECONDS are flagged and not kept.
 */
'use strict';

const SUPABASE_URL = 'https://twvqvutrcobedvuhnzxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';
const BUCKET = 'speech-therapy';
const MAX_SECONDS = 10;
const CLIP_EXTS = ['m4a', 'mp3', 'webm', 'ogg', 'wav'];
const SETTINGS_KEY = 'speech.booth.settings.v1';
let settings = { trimSeconds: 0.5, errors: true };   // trimSeconds 0 means off
const clips = new Map();        // key -> { blob, url, mime } recorded or added on this device
const flags = new Map();        // key -> message shown on that word's row
const storedKeys = new Set();   // keys whose clip is already in the family storage (what Felix's app plays)
let lessons = [];
let current = null;
let recorder = null;
let recordingKey = null;
let chunks = [];
let startedAt = 0;
let sb = null;
let signedIn = false;           // true once a family member has signed in
let hideSignIn = null;          // timer that hides the sign-in form after sign-in

/* ---------- Error trapping ---------- */

// Stops a network call that never answers from hanging the page. The error panel says which step timed out.
function withTimeout(promise, label, ms = 10000) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not answer after ${ms / 1000} seconds.`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

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
    trap('database connection', e, 'Uploads and editing are off until the device is online.');
    sb = null;
  }
}

/* ---------- Lessons ---------- */

function canEdit() {
  return signedIn && !!sb && !!current && current.id !== null;
}

function lessonKey(l) {
  return `${l.track}-${l.lesson_no}`;
}

// Same key the app uses to find a clip: "en-2-3" is the third word of lesson 2 in English.
function clipKey(lesson, index) {
  return `${lessonKey(lesson)}-${index + 1}`;
}

// Signed in: lesson rows from the database, drafts included. Otherwise: the copy bundled with the app, read-only.
async function loadLessons() {
  if (signedIn && sb) {
    try {
      const { data, error } = await withTimeout(
        sb.from('speech_lessons')
          .select('id,track,lesson_no,title,focus,mouth_text,draft_words,status')
          .order('track', { ascending: true })
          .order('lesson_no', { ascending: true }),
        'Loading lessons from the database',
      );
      if (error) throw error;
      lessons = data.map((r) => ({
        id: r.id,
        track: r.track,
        lesson_no: r.lesson_no,
        title: r.title,
        focus: r.focus || '',
        mouth_text: r.mouth_text || '',
        words: r.draft_words || [],
        status: r.status,
      }));
      logLine('ok', `Loaded ${lessons.length} lessons from the database.`);
      return;
    } catch (e) {
      trap('lessons from database', e, 'Showing the copy bundled with the app. Editing is off until this works.');
    }
  }
  try {
    const res = await fetch('lessons.json', { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`lessons.json returned HTTP ${res.status}`);
    const json = await res.json();
    lessons = (json.lessons || []).map((l) => ({
      ...l,
      id: null,
      focus: l.focus || '',
      mouth_text: l.mouth_text || '',
      words: [...(l.words || [])],
    }));
    logLine('ok', `Loaded ${lessons.length} lessons from the app copy (read-only).`);
  } catch (e) {
    trap('lessons', e, 'Open the booth through its web address, not as a local file.');
  }
}

// Which clips already exist in the family storage. Felix's app plays these; anything else falls back to the device voice.
async function refreshStored() {
  storedKeys.clear();
  if (!signedIn || !sb) return;
  try {
    const { data, error } = await withTimeout(sb.storage.from(BUCKET).list('clips', { limit: 1000 }), 'Checking recordings in the family storage');
    if (error) throw error;
    data.forEach((f) => storedKeys.add(f.name.replace(/\.[^.]+$/, '')));
  } catch (e) {
    trap('recordings check', e, 'Showing only the recordings made on this device.');
  }
}

function fillPicker() {
  const pick = document.getElementById('lesson-pick');
  const keep = current ? lessonKey(current) : null;
  pick.innerHTML = '';
  lessons.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = lessonKey(l);
    opt.textContent = `${l.track === 'en' ? 'EN' : 'ZH'} ${l.lesson_no}. ${l.title}${l.status === 'published' ? '' : ' (draft)'}`;
    pick.appendChild(opt);
  });
  current = lessons.find((l) => lessonKey(l) === keep) || lessons[0] || null;
  if (current) pick.value = lessonKey(current);
}

function wirePicker() {
  document.getElementById('lesson-pick').addEventListener('change', (e) => {
    current = lessons.find((l) => lessonKey(l) === e.target.value) || null;
    fillDetails();
    renderLesson();
  });
}

function fillDetails() {
  if (!current) return;
  document.getElementById('lesson-title-input').value = current.title;
  document.getElementById('lesson-focus-input').value = current.focus;
  document.getElementById('lesson-mouth-input').value = current.mouth_text;
}

// Loads lessons and recordings for the current sign-in state, then redraws the whole booth.
async function reloadAll() {
  await loadLessons();
  await refreshStored();
  fillPicker();
  fillDetails();
  renderLesson();
}

function renderDetails() {
  document.getElementById('lesson-heading').textContent = current ? current.title : 'No lesson selected';
  const editable = canEdit();
  ['lesson-title-input', 'lesson-focus-input', 'lesson-mouth-input', 'save-details', 'toggle-publish', 'new-word', 'add-word'].forEach((id) => {
    document.getElementById(id).disabled = !editable;
  });
  const pill = document.getElementById('status-pill');
  const published = !!current && current.status === 'published';
  pill.textContent = current ? (published ? 'Published' : 'Draft') : '';
  pill.classList.toggle('live', published);
  document.getElementById('toggle-publish').textContent = published ? 'Take back to draft' : 'Publish lesson';
  let note = '';
  if (current && current.id === null) note = 'This copy is read-only. Sign in to edit lessons in the database.';
  else if (current && !signedIn) note = 'Sign in to edit this lesson.';
  document.getElementById('edit-note').textContent = note;
}

async function saveDetails() {
  if (!canEdit()) return;
  const title = document.getElementById('lesson-title-input').value.trim();
  if (!title) {
    trap('lesson', new Error('The lesson needs a title.'));
    return;
  }
  const focus = document.getElementById('lesson-focus-input').value.trim();
  const mouthText = document.getElementById('lesson-mouth-input').value.trim();
  try {
    const { error } = await withTimeout(
      sb.from('speech_lessons').update({ title, focus: focus || null, mouth_text: mouthText || null }).eq('id', current.id),
      'Saving lesson details',
    );
    if (error) throw error;
    Object.assign(current, { title, focus, mouth_text: mouthText });
    logLine('ok', 'Lesson details saved.');
    fillPicker();
  } catch (e) {
    trap('save lesson details', e, 'Check the sign-in and the lesson table permissions.');
  }
  renderLesson();
}

async function saveWords() {
  renderLesson();
  if (!canEdit()) return;
  try {
    const { error } = await withTimeout(
      sb.from('speech_lessons').update({ draft_words: current.words }).eq('id', current.id),
      'Saving words',
    );
    if (error) throw error;
    logLine('ok', 'Words saved.');
  } catch (e) {
    trap('save words', e, 'Check the sign-in and the lesson table permissions.');
  }
}

async function addWord() {
  if (!canEdit()) return;
  const input = document.getElementById('new-word');
  const text = input.value.trim();
  if (!text) return;
  current.words.push(text);
  input.value = '';
  await saveWords();
}

async function renameWord(i, value) {
  const text = value.trim();
  if (!text) {
    trap('word', new Error('A word cannot be empty.'));
    renderLesson();
    return;
  }
  if (text === current.words[i]) return;
  current.words[i] = text;
  logLine('info', `Renamed to "${text}". If the recording is a different word, record it again.`);
  await saveWords();
}

// Removing a word moves the recordings after it up one place, so those clips are deleted and must be recorded again.
async function removeWord(i) {
  const word = current.words[i];
  if (!window.confirm(`Remove "${word}"? The recordings for the words after it are deleted, so those words must be recorded again.`)) return;
  await clearClipsFrom(current, i);
  current.words.splice(i, 1);
  await saveWords();
}

async function clearClipsFrom(lesson, from) {
  const paths = [];
  for (let i = from; i < lesson.words.length; i++) {
    const key = clipKey(lesson, i);
    const old = clips.get(key);
    if (old) URL.revokeObjectURL(old.url);
    clips.delete(key);
    flags.delete(key);
    storedKeys.delete(key);
    if (canEdit()) CLIP_EXTS.forEach((ext) => paths.push(`clips/${key}.${ext}`));
  }
  if (!paths.length) return;
  try {
    const { error } = await withTimeout(sb.storage.from(BUCKET).remove(paths), 'Deleting old recordings');
    if (error) throw error;
    logLine('ok', `Deleted ${paths.length} old recording files.`);
  } catch (e) {
    trap('delete recordings', e, 'Felix may still hear the old sound for these words. Record them again.');
  }
}

// Publishing needs every word recorded and in the family storage, so Felix never hears a gap.
async function togglePublish() {
  if (!canEdit()) return;
  const publish = current.status !== 'published';
  if (publish) {
    const missing = current.words.filter((_, i) => !storedKeys.has(clipKey(current, i)));
    if (!current.words.length || missing.length) {
      trap(
        'publish',
        new Error(current.words.length ? `Still to record: ${missing.join(', ')}` : 'Add at least one word first.'),
        'Every word needs a recording in the family storage before the lesson can be published.',
      );
      renderLesson();
      return;
    }
  }
  const status = publish ? 'published' : 'draft';
  try {
    const { error } = await withTimeout(
      sb.from('speech_lessons').update({ status }).eq('id', current.id),
      publish ? 'Publishing' : 'Taking back to draft',
    );
    if (error) throw error;
    current.status = status;
    logLine('ok', publish ? `"${current.title}" is published. Felix can see it in the app.` : `"${current.title}" is a draft again.`);
    fillPicker();
  } catch (e) {
    trap('publish', e, 'Check the sign-in and the lesson table permissions.');
  }
  renderLesson();
}

function renderLesson() {
  renderDetails();
  MouthGuide.render(document.getElementById('booth-mouth-guide'), current);
  renderWords();
  updateProgress();
}

function renderWords() {
  const list = document.getElementById('word-list');
  list.innerHTML = '';
  if (!current) return;
  const editable = canEdit();

  current.words.forEach((word, i) => {
    const key = clipKey(current, i);
    const row = document.createElement('div');
    row.className = 'word-row';

    const main = document.createElement('div');
    main.className = 'word-main';
    const input = document.createElement('input');
    input.className = 'word-input';
    input.type = 'text';
    input.value = word;
    input.disabled = !editable;
    input.setAttribute('aria-label', `Word ${i + 1}`);
    input.addEventListener('change', () => renameWord(i, input.value));
    main.appendChild(input);

    const status = document.createElement('div');
    status.className = 'note';
    if (flags.has(key)) {
      status.className = 'flag';
      status.textContent = `⚠ ${flags.get(key)}`;
    } else if (storedKeys.has(key)) {
      status.textContent = '✓ in the app';
    } else if (clips.has(key)) {
      status.textContent = signedIn ? 'sending…' : '⚠ not sent yet. Sign in to send it to the app.';
    } else {
      status.textContent = 'not recorded yet';
    }
    row.appendChild(main);
    row.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const rec = document.createElement('button');
    rec.className = 'rec';
    rec.textContent = recordingKey === key ? '⏹ Stop' : '🎤 Record';
    rec.classList.toggle('on', recordingKey === key);
    rec.addEventListener('click', () => toggleRecord(key, word));
    actions.appendChild(rec);

    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = '▶ Play';
    play.disabled = !clips.has(key);
    play.addEventListener('click', () => playClip(key));
    actions.appendChild(play);

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '✕';
    remove.title = 'Remove this word';
    remove.disabled = !editable;
    remove.addEventListener('click', () => removeWord(i));
    actions.appendChild(remove);

    row.appendChild(actions);
    list.appendChild(row);
  });
}

function updateProgress() {
  const progress = document.getElementById('progress-line');
  if (!current) {
    progress.textContent = '';
    return;
  }
  const inApp = current.words.filter((_, i) => storedKeys.has(clipKey(current, i))).length;
  progress.textContent = `${inApp} of ${current.words.length} words are in the app.`;
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

/* Keep a clip only when it is audio and short enough. Then send it to the family storage if signed in. */
async function keepClip(key, word, blob, mime, fallbackSeconds) {
  const seconds = await lengthOf(blob, fallbackSeconds);
  if (seconds === null) {
    flags.set(key, 'Could not read this as audio.');
    trap(`"${word}"`, new Error('Not a readable audio file.'), 'Choose a sound file (MP3, M4A, WAV or a recording).');
    renderWords();
    return false;
  }
  if (seconds > MAX_SECONDS) {
    flags.set(key, `${seconds.toFixed(1)} s. Keep it to ${MAX_SECONDS} s or less.`);
    trap(`"${word}" is too long`, new Error(`${seconds.toFixed(1)} seconds`), `Record it again, shorter than ${MAX_SECONDS} seconds.`);
    renderWords();
    return false;
  }

  flags.delete(key);
  const old = clips.get(key);
  if (old) URL.revokeObjectURL(old.url);
  clips.set(key, { blob, url: URL.createObjectURL(blob), mime });
  logLine('ok', `"${word}" recorded (${seconds.toFixed(1)} s).`);
  if (signedIn) {
    await uploadClip(key, word);
  } else {
    logLine('info', `"${word}" is not sent yet. Sign in to send it to Felix's app.`);
  }
  renderWords();
  return true;
}

function extFor(mime) {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/* ---------- Recording ---------- */

function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

async function toggleRecord(key, word) {
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
        renderWords();
        return;
      }
      const kept = await maybeTrim(blob);
      await keepClip(key, word, kept, kept.type, elapsed);
    });
    startedAt = Date.now();
    recorder.start();
    logLine('info', `Recording "${word}". Tap Stop when done (${MAX_SECONDS} s at most).`);
    renderWords();
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

async function uploadClip(key, word) {
  const clip = clips.get(key);
  if (!clip || !sb) return;
  const ext = extFor(clip.mime);
  const path = `clips/${key}.${ext}`;
  try {
    const { error } = await withTimeout(
      sb.storage.from(BUCKET).upload(path, clip.blob, { upsert: true, contentType: clip.mime || 'audio/webm' }),
      `Sending "${word}"`,
    );
    if (error) throw error;
    // Remove older files in other formats, so Felix's app cannot play a stale one.
    const stale = CLIP_EXTS.filter((e) => e !== ext).map((e) => `clips/${key}.${e}`);
    await withTimeout(sb.storage.from(BUCKET).remove(stale), 'Clearing older versions').catch(() => {});
    storedKeys.add(key);
    logLine('ok', `"${word}" sent to Felix's app.`);
  } catch (e) {
    trap(`send "${word}"`, e, 'Sending needs a family sign-in. Check the storage permissions if this keeps failing.');
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
  const seconds = Number(settings.trimSeconds) || 0;
  if (!seconds) return blob;
  try {
    const out = await trimEnd(blob, seconds);
    if (out === blob) logLine('info', `Recording is shorter than ${seconds} s, so nothing was trimmed.`);
    else logLine('ok', `Trimmed ${seconds} s from the end.`);
    return out;
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
  document.getElementById('opt-trim').value = String(Number(settings.trimSeconds) || 0);
  document.getElementById('opt-errors').checked = settings.errors;
  document.getElementById('error-panel').classList.toggle('hidden', !settings.errors);
}

/* ---------- Sign-in (editing and uploads need a family member's account) ---------- */

// Takes the session as given. Never call sb.auth from inside an auth-change callback (it deadlocks).
function applyAuth(session) {
  const status = document.getElementById('auth-status');
  signedIn = !!session;
  status.textContent = session
    ? `Signed in as ${session.user.email}. Editing and uploads are on.`
    : 'Not signed in. Editing and uploads are off until you sign in.';
  const form = document.getElementById('signin-form');
  clearTimeout(hideSignIn);
  if (signedIn) {
    form.classList.add('fading');
    hideSignIn = setTimeout(() => form.classList.add('hidden'), 1000);
  } else {
    form.classList.remove('fading', 'hidden');
  }
  document.getElementById('sign-out').hidden = !signedIn;
}

async function refreshAuth() {
  if (!sb) {
    document.getElementById('auth-status').textContent = 'Not connected. Editing and uploads are off.';
    return;
  }
  logLine('info', 'Checking sign-in…');
  const { data, error } = await withTimeout(sb.auth.getSession(), 'Checking sign-in');
  if (error) throw error;
  logLine('ok', 'Sign-in check done.');
  applyAuth(data.session);
}

async function signIn(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!sb) {
    trap('sign-in', new Error('Not connected to the family storage.'), 'Try again when the device is online.');
    return;
  }
  if (!email || !password) {
    trap('sign-in', new Error('Type your email and password first.'));
    return;
  }
  const button = document.getElementById('sign-in');
  button.disabled = true;
  logLine('info', `Signing in as ${email}…`);
  try {
    const { error } = await withTimeout(sb.auth.signInWithPassword({ email, password }), 'Sign-in');
    if (error) throw error;
    document.getElementById('password').value = '';
    logLine('ok', 'Signed in.');
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
    const { error } = await withTimeout(sb.auth.signOut(), 'Sign-out');
    if (error) throw error;
    logLine('ok', 'Signed out.');
  } catch (e) {
    trap('sign-out', e);
  }
}

function wireControls() {
  document.getElementById('opt-trim').addEventListener('change', (e) => {
    settings.trimSeconds = Number(e.target.value);
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
  document.getElementById('save-details').addEventListener('click', saveDetails);
  document.getElementById('toggle-publish').addEventListener('click', togglePublish);
  document.getElementById('add-word').addEventListener('click', addWord);
  document.getElementById('new-word').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  });
  // Reload when the sign-in changes. Deferred, so the database call never runs inside the auth callback.
  if (sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      applyAuth(session);
      setTimeout(() => reloadAll().catch((e) => trap('reload', e)), 0);
    });
  }
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
  wirePicker();
  try {
    await refreshAuth();
  } catch (e) {
    document.getElementById('auth-status').textContent = 'Could not check sign-in. Editing and uploads are off.';
    trap('sign-in check', e, 'Check the connection, then reload the page.');
  }
  await reloadAll();
}

boot();
