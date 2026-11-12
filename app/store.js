// Local-first store, with optional sync to the Family Supabase project.
// Everything works offline (localStorage). If a signed-in session exists, changes are pushed to the speech_v2_* tables.
import { SURVEY, SOUNDS, soundsOf } from './data.js';

export const SUPABASE_URL = 'https://twvqvutrcobedvuhnzxq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';
const KEY = 'speech.v2';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2) + Date.now());
const now = () => Date.now();

let data = load();
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function blank() {
  const id = uid();
  return {
    profiles: [{ id, name: 'Felix', notes: '', locked: false, lockedAt: null, created: now(), updated: now() }],
    activeId: id,
    survey: {},      // { [profileId]: { [itemKey]: { v: 0|1, t } } }
    flags: {},       // { [profileId]: { [word]: { v: 0|1|2, t } } }
    versions: {},    // { [profileId]: [ { id, kind, label, note, t, snapshot } ] }
    practice: {},    // { [profileId]: { [isoWeek]: seconds } }
    custom: {},      // { [profileId]: [ words ] }
    ui: { cutaway: true, slow: 1 },
  };
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.profiles && raw.profiles.length) return { ...blank(), ...raw };
  } catch (_) { /* ignore */ }
  return blank();
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* private mode */ }
  listeners.forEach((fn) => fn());
  scheduleSync();
}

export const profiles = () => data.profiles;
export const active = () => data.profiles.find((p) => p.id === data.activeId) || data.profiles[0];
export const ui = () => data.ui;
export function setUi(patch) { Object.assign(data.ui, patch); persist(); }
export function setActive(id) { data.activeId = id; persist(); }
export function addProfile(name) {
  const p = { id: uid(), name: name.trim() || 'New person', notes: '', locked: false, lockedAt: null, created: now(), updated: now() };
  data.profiles.push(p); data.activeId = p.id; persist(); return p;
}
export function renameProfile(id, name) { const p = data.profiles.find((x) => x.id === id); if (p) { p.name = name; p.updated = now(); persist(); } }
export function setNotes(notes) { const p = active(); p.notes = notes; p.updated = now(); persist(); }

// ---- survey ----
export const surveyAnswers = () => (data.survey[active().id] ||= {});
export function answerSurvey(key, v) {
  if (active().locked) return false;
  surveyAnswers()[key] = { v, t: now() }; persist(); return true;
}
export function resetSurvey() { if (active().locked) return false; data.survey[active().id] = {}; persist(); return true; }
export const surveyDone = () => Object.keys(surveyAnswers()).length;

// ---- flashcard flags: 0 easy, 1 tricky, 2 really tricky ----
export const flags = () => (data.flags[active().id] ||= {});
export function flagWord(word, v) { flags()[word] = { v, t: now() }; persist(); }

export const customWords = () => (data.custom[active().id] ||= []);
export function addCustomWords(list) {
  const c = customWords();
  for (const w of list) if (w && !c.includes(w)) c.push(w);
  persist();
}
export function removeCustomWord(w) { const c = customWords(); const i = c.indexOf(w); if (i >= 0) c.splice(i, 1); persist(); }

// ---- practice time (seconds per ISO-ish week) ----
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
export function addPractice(sec) {
  const m = (data.practice[active().id] ||= {});
  const k = weekKey(); m[k] = (m[k] || 0) + sec; persist();
}
export const practiceThisWeek = () => (data.practice[active().id] || {})[weekKey()] || 0;

// ---- heat map: how tricky is each sound for this person? ----
// Survey answers count for the sounds they target. Flashcard flags count for every sound in the word.
export function heat() {
  const acc = {};
  const add = (pid, level) => { const a = (acc[pid] ||= { n: 0, sum: 0 }); a.n++; a.sum += level; };
  for (const it of SURVEY.items) {
    const a = surveyAnswers()[it.key];
    if (a) it.focus.forEach((pid) => add(pid, a.v));
  }
  for (const [w, o] of Object.entries(flags())) soundsOf(w).forEach((pid) => add(pid, o.v / 2));
  const out = {};
  for (const [pid, a] of Object.entries(acc)) if (SOUNDS[pid]) out[pid] = { n: a.n, heat: a.sum / a.n };
  return out;
}

// ---- versions: snapshots of the heat map + notes, per person ----
export const versions = () => (data.versions[active().id] ||= []);
function snap() { return { heat: heat(), notes: active().notes, survey: surveyDone(), flags: Object.keys(flags()).length }; }
export function addVersion(kind, label, note = '') {
  const v = { id: uid(), kind, label, note, t: now(), snapshot: snap() };
  versions().unshift(v); persist(); return v;
}
export function lockIn(label) {
  const p = active(); addVersion('lock', label || 'Locked in survey');
  p.locked = true; p.lockedAt = now(); p.updated = now(); persist();
}
export function unlock() { const p = active(); p.locked = false; p.updated = now(); addVersion('unlock', 'Unlocked survey for editing'); }

// ---- Supabase sync (optional) ----
let sb = null, session = null, syncTimer = null;
export const syncState = { status: 'local only', detail: '', signedIn: false };
function setSync(status, detail = '') { syncState.status = status; syncState.detail = detail; listeners.forEach((fn) => fn()); }

export async function initSync() {
  try {
    if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: s } = await sb.auth.getSession();
    session = s.session; syncState.signedIn = !!session;
    setSync(session ? 'signed in' : 'local only', session ? '' : 'Sign in under Settings to sync.');
    if (session) await pull();
  } catch (e) { setSync('local only', 'Database unreachable: ' + (e.message || e)); }
}
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script blocked')); document.head.appendChild(s); });
}
export async function signIn(email, password) {
  if (!sb) await initSync();
  if (!sb) return { error: 'No database connection' };
  const { data: d, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { setSync('local only', error.message); return { error: error.message }; }
  session = d.session; syncState.signedIn = true; setSync('signed in'); await pull(); await push(); return {};
}
export async function signOut() { if (sb) await sb.auth.signOut(); session = null; syncState.signedIn = false; setSync('local only'); }
function scheduleSync() { if (!session) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => push().catch(() => {}), 1500); }

const iso = (t) => new Date(t).toISOString();
export async function push() {
  if (!sb || !session) return;
  setSync('syncing…');
  try {
    const run = async (table, rows, conflict) => {
      if (!rows.length) return;
      const { error } = await sb.from(table).upsert(rows, { onConflict: conflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    };
    await run('speech_v2_profiles', data.profiles.map((p) => ({ id: p.id, name: p.name, notes: p.notes, locked: p.locked, locked_at: p.lockedAt ? iso(p.lockedAt) : null, updated_at: iso(p.updated) })), 'id');
    const answers = [], fl = [], vers = [];
    for (const [pid, m] of Object.entries(data.survey)) for (const [k, a] of Object.entries(m)) answers.push({ profile_id: pid, survey_id: SURVEY.id, item_key: k, tricky: a.v, updated_at: iso(a.t) });
    for (const [pid, m] of Object.entries(data.flags)) for (const [w, a] of Object.entries(m)) fl.push({ profile_id: pid, word: w, level: a.v, updated_at: iso(a.t) });
    for (const [pid, arr] of Object.entries(data.versions)) for (const v of arr) vers.push({ id: v.id, profile_id: pid, kind: v.kind, label: v.label, note: v.note, snapshot: v.snapshot, created_at: iso(v.t) });
    await run('speech_v2_survey_answers', answers, 'profile_id,survey_id,item_key');
    await run('speech_v2_word_flags', fl, 'profile_id,word');
    await run('speech_v2_versions', vers, 'id');
    setSync('synced', new Date().toLocaleTimeString());
  } catch (e) { setSync('sync failed', e.message); }
}
export async function pull() {
  if (!sb || !session) return;
  try {
    const [pr, an, fl, ve] = await Promise.all([
      sb.from('speech_v2_profiles').select('*'), sb.from('speech_v2_survey_answers').select('*'),
      sb.from('speech_v2_word_flags').select('*'), sb.from('speech_v2_versions').select('*'),
    ]);
    for (const r of [pr, an, fl, ve]) if (r.error) throw new Error(r.error.message);
    for (const p of pr.data) {
      const have = data.profiles.find((x) => x.id === p.id);
      const upd = Date.parse(p.updated_at);
      if (!have) data.profiles.push({ id: p.id, name: p.name, notes: p.notes || '', locked: p.locked, lockedAt: p.locked_at ? Date.parse(p.locked_at) : null, created: upd, updated: upd });
      else if (upd > have.updated) Object.assign(have, { name: p.name, notes: p.notes || '', locked: p.locked, lockedAt: p.locked_at ? Date.parse(p.locked_at) : null, updated: upd });
    }
    for (const r of an.data) { const m = (data.survey[r.profile_id] ||= {}); const t = Date.parse(r.updated_at); if (!m[r.item_key] || m[r.item_key].t < t) m[r.item_key] = { v: r.tricky, t }; }
    for (const r of fl.data) { const m = (data.flags[r.profile_id] ||= {}); const t = Date.parse(r.updated_at); if (!m[r.word] || m[r.word].t < t) m[r.word] = { v: r.level, t }; }
    for (const r of ve.data) { const a = (data.versions[r.profile_id] ||= []); if (!a.find((x) => x.id === r.id)) a.push({ id: r.id, kind: r.kind, label: r.label, note: r.note, t: Date.parse(r.created_at), snapshot: r.snapshot }); }
    for (const a of Object.values(data.versions)) a.sort((x, y) => y.t - x.t);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* ignore */ }
    listeners.forEach((fn) => fn());
    setSync('synced', new Date().toLocaleTimeString());
  } catch (e) { setSync('sync failed', e.message); }
}
export async function checkTables() {
  if (!sb || !session) return 'Sign in first.';
  const out = [];
  for (const t of ['speech_v2_profiles', 'speech_v2_survey_answers', 'speech_v2_word_flags', 'speech_v2_versions']) {
    const { error, count } = await sb.from(t).select('*', { count: 'exact', head: true });
    out.push(`${t}: ${error ? 'MISSING or blocked (' + error.message + ')' : count + ' rows'}`);
  }
  return out.join('\n');
}
