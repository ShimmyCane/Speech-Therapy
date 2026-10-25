/* Voice Booth — grown-ups record each word; files are kept in memory and saved by download.
 * Upload to Supabase Storage (bucket "speech-therapy") is the next step, once sign-in is wired.
 */
'use strict';

const DONE_KEY = 'speech.booth.v1';
const clips = new Map();        // key -> { blob, url, mime }
let lessons = [];
let current = null;
let recorder = null;
let recordingKey = null;
let chunks = [];

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
    const key = `${lessonKey(current)}-${i}`;
    const row = document.createElement('div');
    row.className = 'word-row';

    const text = document.createElement('div');
    text.className = 'text';
    text.innerHTML = `${escapeHtml(word)} ${done[key] ? '<span class="done-mark">✓ recorded</span>' : ''}`;
    row.appendChild(text);

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

    const save = document.createElement('button');
    save.className = 'save';
    save.textContent = '💾 Save';
    save.disabled = !clips.has(key);
    save.addEventListener('click', () => saveClip(key, word, i));
    actions.appendChild(save);

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
    `${count} of ${total} words recorded on this device.`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        trap('recording', new Error(`"${word}" came out empty.`), 'Check the microphone and try again.');
      } else {
        const old = clips.get(key);
        if (old) URL.revokeObjectURL(old.url);
        clips.set(key, { blob, url: URL.createObjectURL(blob), mime: type });
        const done = readDone();
        done[key] = true;
        writeDone(done);
        logLine('ok', `Recorded "${word}" (${Math.round(blob.size / 1024)} KB, ${type}).`);
      }
      recorder = null;
      recordingKey = null;
      renderLesson();
    });
    recorder.start();
    logLine('info', `Recording "${word}". Tap Stop when done.`);
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
    const ext = clip.mime.includes('mp4') ? 'm4a' : clip.mime.includes('ogg') ? 'ogg' : 'webm';
    const name = `${current.track}-${String(current.lesson_no).padStart(2, '0')}-${index + 1}-${word}.${ext}`;
    const a = document.createElement('a');
    a.href = clip.url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    logLine('ok', `Saved ${name}. Put it in audio/model/ or upload it later.`);
  } catch (e) {
    trap('save', e, 'Downloads are blocked here. Try again from Safari or Chrome.');
  }
}

/* ---------- Boot ---------- */

async function boot() {
  if (!window.isSecureContext) {
    logLine('info', 'Not a secure (https) address. Recording will not work here.');
  }
  await loadLessons();
  fillPicker();
  renderLesson();
}

boot();
