import { GROUPS, SOUNDS, SOUND_ORDER, DECKS, WORDS, SURVEY, VIDEOS, VIDEO_TOPICS, REFERENCES, colorOf, groupOf, wordInfo, soundsOf } from './data.js';
import { mouthSVG, anatomySVG, PARTS } from './diagram.js';
import * as store from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TABS = [
  { id: 'survey', icon: '🧭', name: 'Survey' },
  { id: 'videos', icon: '▶️', name: 'Videos' },
  { id: 'diagrams', icon: '🖼️', name: 'Diagrams' },
  { id: 'mouth3d', icon: '🧊', name: '3D Mouth' },
  { id: 'words', icon: '🃏', name: 'Words' },
];
const APP_VERSIONS = [
  { v: '2.0', date: '2026-11-12', text: 'New home with five tabs: Survey, Videos, Diagrams, 3D Mouth, Words. One colour system for how the mouth moves. People profiles with notes, lock-in and a version log. V1 archived.' },
  { v: '1.x', date: 'before 2026-11', text: 'Original lesson app (listen, say, stars) and the Voice Booth. Still runnable from Settings.' },
];

const st = { tab: 'survey', surveyIdx: 0, surveyMode: null, deckId: 'recommended', deckOrder: [], cardIdx: 0, sound: 'S', videoOpen: null,
  three: null, threeWord: 'sun', practiceTick: 0, practiceTimer: null, activeSeg: -1 };

/* ---------- shared pieces ---------- */

function wordHTML(word, activeSound = null) {
  const info = wordInfo(word);
  return info.segs.map((s) => {
    if (!s.p.length) return `<span class="g silent" title="silent">${esc(s.g)}</span>`;
    const c = colorOf(s.p[0]);
    const under = s.p[1] ? `;border-bottom:6px solid ${colorOf(s.p[1])}` : '';
    const dim = activeSound !== null && !s.p.includes(activeSound) ? ' dim' : '';
    return `<span class="g${dim}" data-sound="${s.p[0]}" style="color:${c}${under}" title="${s.p.map((p) => SOUNDS[p]?.label || p).join(' + ')}">${esc(s.g)}</span>`;
  }).join('');
}
function soundChip(pid, extra = '') {
  const s = SOUNDS[pid]; if (!s) return '';
  const g = groupOf(pid);
  return `<button class="schip" data-open-sound="${pid}" style="--c:${g.color};--t:${g.tint}" title="${esc(s.label)}"><b>${esc(s.spell)}</b>${extra}</button>`;
}
function legendHTML() {
  return Object.entries(GROUPS).map(([id, g]) => `<span class="lg" style="--c:${g.color};--t:${g.tint}" title="${esc(g.blurb)}"><i></i>${esc(g.name)}</span>`).join('');
}
function heatGridHTML() {
  const h = store.heat();
  let any = false;
  const rows = Object.entries(GROUPS).map(([gid, g]) => {
    const tiles = SOUND_ORDER.filter((p) => SOUNDS[p].group === gid).map((p) => {
      const d = h[p];
      if (d) any = true;
      const pct = d ? Math.round(d.heat * 100) : 0;
      const lvl = !d ? 'none' : d.heat >= 0.5 ? 'hot' : d.heat > 0 ? 'warm' : 'cool';
      return `<button class="tile ${lvl}" data-open-sound="${p}" style="--c:${g.color};--t:${g.tint};--h:${pct}%" title="${esc(SOUNDS[p].label)}${d ? `: ${pct}% tricky from ${d.n} answers` : ': no answers yet'}">
        <span class="bar"></span><b>${esc(SOUNDS[p].spell)}</b><small>${d ? pct + '%' : '·'}</small></button>`;
    }).join('');
    return `<div class="hrow"><div class="hname" style="color:${g.color}">${esc(g.name)}</div><div class="tiles">${tiles}</div></div>`;
  }).join('');
  return `<div class="heat">${rows}</div>${any ? '' : '<p class="note">No answers yet. Do the survey or play some word cards and this map fills in.</p>'}
    <p class="note">Taller colour = trickier. Tap any sound to see how the mouth makes it.</p>`;
}
function trickySounds(limit = 6) {
  const h = store.heat();
  return Object.entries(h).filter(([, d]) => d.heat > 0).sort((a, b) => b[1].heat - a[1].heat || b[1].n - a[1].n).slice(0, limit).map(([p]) => p);
}

/* ---------- navigation ---------- */

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((t) => `<button class="tab${st.tab === t.id ? ' on' : ''}" data-tab="${t.id}" role="tab" aria-selected="${st.tab === t.id}"><span>${t.icon}</span>${t.name}</button>`).join('');
}
function go(tab, opts = {}) {
  if (st.tab === 'words' && tab !== 'words') flushPractice();
  if (st.tab === 'mouth3d' && tab !== 'mouth3d' && st.three) st.three.pause(true);
  st.tab = tab;
  if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab);
  renderTabs(); renderScreen();
  if (tab === 'words') startPractice();
  window.scrollTo({ top: 0 });
  return opts;
}
function renderScreen() {
  const fn = { survey: renderSurvey, videos: renderVideos, diagrams: renderDiagrams, mouth3d: renderMouth3D, words: renderWords }[st.tab];
  $('#screen').innerHTML = '';
  fn($('#screen'));
  $('#who').textContent = store.active().name;
  $('#lock-pill').classList.toggle('hidden', !store.active().locked);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) return go(t.dataset.tab);
  const so = e.target.closest('[data-open-sound]');
  if (so) { st.sound = so.dataset.openSound; return go('diagrams'); }
  const seg = e.target.closest('.g[data-sound]');
  if (seg && !e.target.closest('#drawer')) { st.sound = seg.dataset.sound; return go('diagrams'); }
});

/* ---------- 1. SURVEY ---------- */

function renderSurvey(root) {
  const items = SURVEY.items, ans = store.surveyAnswers();
  const done = store.surveyDone();
  const p = store.active();
  const complete = done >= items.length;
  if (st.surveyMode === null) st.surveyMode = complete || p.locked ? 'results' : 'ask';
  if (st.surveyMode === 'ask' && !complete) {
    // find first unanswered from current idx
    if (ans[items[st.surveyIdx]?.key] && st.surveyIdx < items.length - 1 && !st._revisit) st.surveyIdx = Math.max(0, items.findIndex((i) => !ans[i.key]));
    if (st.surveyIdx < 0) st.surveyIdx = 0;
    const it = items[st.surveyIdx];
    const a = ans[it.key];
    root.innerHTML = `
      <div class="card">
        <div class="row between"><h2>${esc(SURVEY.title)} for ${esc(p.name)}</h2><span class="counter">${st.surveyIdx + 1} / ${items.length}</span></div>
        <div class="progress"><i style="width:${(done / items.length) * 100}%"></i></div>
        <p class="note">${esc(SURVEY.intro)}</p>
        <div class="bigword" id="sv-word">${wordHTML(it.word)}</div>
        <p class="note center">Focus sound: ${it.focus.map((f) => soundChip(f)).join(' ')}</p>
        <p class="center q">Is this easy to say?</p>
        <div class="toggle2" role="group" aria-label="Easy or tricky">
          <button class="btn easy${a && a.v === 0 ? ' on' : ''}" data-ans="0">😀 Easy</button>
          <button class="btn tricky${a && a.v === 1 ? ' on' : ''}" data-ans="1">😬 Tricky</button>
        </div>
        <div class="row between" style="margin-top:14px">
          <button class="btn small" id="sv-back" ${st.surveyIdx === 0 ? 'disabled' : ''}>← Back</button>
          <button class="btn small" id="sv-skip">Skip →</button>
        </div>
      </div>`;
    root.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
      if (!store.answerSurvey(it.key, Number(b.dataset.ans))) return toast('This survey is locked in. Unlock it in Settings to change answers.', true);
      st._revisit = false;
      if (st.surveyIdx < items.length - 1) { st.surveyIdx++; setTimeout(renderScreen, 160); } else { st.surveyMode = 'results'; setTimeout(renderScreen, 160); }
    }));
    $('#sv-back').addEventListener('click', () => { st._revisit = true; st.surveyIdx = Math.max(0, st.surveyIdx - 1); renderScreen(); });
    $('#sv-skip').addEventListener('click', () => { st._revisit = true; if (st.surveyIdx < items.length - 1) st.surveyIdx++; else st.surveyMode = 'results'; renderScreen(); });
    return;
  }
  // results
  const top = trickySounds();
  root.innerHTML = `
    <div class="card">
      <h2>How ${esc(p.name)} sounds today</h2>
      <p class="note">${done} of ${items.length} survey questions answered${p.locked ? ' · 🔒 locked in' : ''}. Everyone has little ways of speaking. This just shows where to practise first.</p>
      ${top.length ? `<p><b>Trickiest so far:</b> ${top.map((t) => soundChip(t)).join(' ')}</p>` : '<p class="note">Nothing marked tricky yet. 🎉</p>'}
      <div class="row">
        ${done < items.length ? '<button class="btn mint" id="sv-continue">Continue survey</button>' : ''}
        <button class="btn sky" id="sv-practice">🃏 Practise these words</button>
        <button class="btn" id="sv-videos">▶️ Matching videos</button>
      </div>
    </div>
    <div class="card"><h2>Heat map of sounds</h2>${heatGridHTML()}</div>
    <div class="card">
      <h2>Answers</h2>
      <p class="note">${p.locked ? 'Locked. Unlock in Settings to edit.' : 'Tap a word to flip it between easy and tricky.'}</p>
      <div class="chips">${items.map((i) => {
        const a = ans[i.key];
        return `<button class="wchip ${a ? (a.v ? 'tricky' : 'easy') : 'blank'}" data-flip="${i.key}">${wordHTML(i.word)}<small>${a ? (a.v ? '😬' : '😀') : '–'}</small></button>`;
      }).join('')}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn small" id="sv-redo" ${p.locked ? 'disabled' : ''}>Start the survey again</button>
      </div>
    </div>`;
  const c = $('#sv-continue'); if (c) c.addEventListener('click', () => { st.surveyMode = 'ask'; st.surveyIdx = items.findIndex((i) => !ans[i.key]); renderScreen(); });
  $('#sv-practice').addEventListener('click', () => { st.deckId = 'recommended'; st.cardIdx = 0; st.deckOrder = []; go('words'); });
  $('#sv-videos').addEventListener('click', () => go('videos'));
  $('#sv-redo').addEventListener('click', () => { if (confirm('Clear this person\'s survey answers and start again? (Flashcard flags are kept.)')) { store.resetSurvey(); st.surveyMode = 'ask'; st.surveyIdx = 0; renderScreen(); } });
  root.querySelectorAll('[data-flip]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.flip; const a = ans[k];
    if (!store.answerSurvey(k, a && a.v ? 0 : 1)) return toast('This survey is locked in.', true);
    renderScreen();
  }));
}

/* ---------- 2. VIDEOS ---------- */

function topicScore(t) {
  const h = store.heat();
  const vals = t.sounds.map((s) => (h[s] ? h[s].heat : 0));
  return Math.max(0, ...vals) * 0.7 + (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.3;
}
function renderVideos(root) {
  const topics = VIDEO_TOPICS.map((t, i) => ({ ...t, i, score: topicScore(t) })).sort((a, b) => b.score - a.score || a.i - b.i);
  const hasData = topics.some((t) => t.score > 0);
  const name = store.active().name;
  root.innerHTML = `
    <div class="card">
      <h2>Watch and learn</h2>
      <p class="note">${hasData ? `Ranked for ${esc(name)}: the topics that match the trickiest sounds come first.` : `Do the survey and the videos will re-order themselves for ${esc(name)}.`}
      Videos are from speech therapists, for children and parents, with a few adult learners' guides.</p>
    </div>
    ${topics.map((t, rank) => `
      <div class="card topic" style="--c:${colorOf(t.sounds[0])}">
        <div class="row between"><h2>${rank === 0 && hasData ? '⭐ ' : ''}${esc(t.title)}</h2>
          <span>${t.sounds.map((s) => soundChip(s)).join(' ')}</span></div>
        <div class="progress"><i style="width:${Math.round(t.score * 100)}%"></i></div>
        <p class="note">${hasData ? (t.score > 0 ? `${Math.round(t.score * 100)}% match with tricky sounds` : 'No tricky sounds here yet') : 'No survey answers yet'}</p>
        <div class="vgrid">${VIDEOS.filter((v) => v.topic === t.id).map(videoCard).join('')}</div>
      </div>`).join('')}
    <div class="card"><p class="note">How these are ranked: each video is tagged with the sounds it teaches (from its title and description), and topics are ordered by how tricky those sounds are for this person. Transcripts were not read. Titles and channels come from search listings; please preview a video before sharing it with a child, and treat it as general guidance, not a substitute for a speech-language pathologist.</p></div>`;
  root.querySelectorAll('[data-vid]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.vid;
    b.closest('.vcard').innerHTML = `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
      <a class="small-link" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">Open on YouTube ↗</a>`;
  }));
}
function videoCard(v) {
  return `<div class="vcard"><button class="thumb" data-vid="${v.id}" aria-label="Play ${esc(v.title)}">
      <img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt=""><span class="play">▶</span></button>
    <div class="vt">${esc(v.title)}</div><div class="vby">${esc(v.by)} · <span class="pill">${esc(v.who)}</span></div></div>`;
}

/* ---------- 3. DIAGRAMS ---------- */

function renderDiagrams(root) {
  const s = SOUNDS[st.sound] || SOUNDS.S;
  const examples = Object.keys(WORDS).filter((w) => soundsOf(w).includes(s.id)).slice(0, 8);
  root.innerHTML = `
    <div class="card">
      <h2>The parts of the mouth that make noise</h2>
      <p class="note">Tap a coloured dot to learn what that part does. Colours match the sounds everywhere in the app.</p>
      <div class="diagram" id="anat">${anatomySVG()}</div>
      <div class="mouth" id="part-text">Tap a dot.</div>
    </div>
    <div class="card">
      <h2>Sound cards</h2>
      <div class="legend">${legendHTML()}</div>
      <div class="chips sounds">${SOUND_ORDER.map((p) => `<button class="schip big${p === s.id ? ' on' : ''}" data-pick="${p}" style="--c:${groupOf(p).color};--t:${groupOf(p).tint}" title="${esc(SOUNDS[p].label)}"><b>${esc(SOUNDS[p].spell)}</b></button>`).join('')}</div>
    </div>
    <div class="card" id="sound-card" style="--c:${groupOf(s.id).color};--t:${groupOf(s.id).tint}">
      <h2>${esc(s.label)}</h2>
      <div class="diagram">${mouthSVG(s.params, { sound: s.id })}</div>
      <div class="mouth">${esc(s.how)}</div>
      <p class="note"><b>${esc(GROUPS[s.group].name)}.</b> ${esc(GROUPS[s.group].blurb)}.</p>
      <div class="chips">${examples.map((w) => `<span class="wchip static">${wordHTML(w, s.id)}</span>`).join('')}</div>
      <div class="row"><button class="btn sky" id="see3d">🧊 See it in 3D</button></div>
    </div>`;
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { st.sound = b.dataset.pick; renderScreen(); $('#sound-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  $('#see3d').addEventListener('click', () => { st.threeSound = s.id; go('mouth3d'); });
  root.querySelectorAll('.part').forEach((el) => {
    const open = () => {
      const part = PARTS.find((p) => p.id === el.dataset.part);
      $('#part-text').innerHTML = `<b style="color:${GROUPS[part.group].color}">${esc(part.name)}.</b> ${esc(part.text)} ${part.sounds.map((x) => soundChip(x)).join(' ')}`;
    };
    el.addEventListener('click', open); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

/* ---------- 4. 3D MOUTH ---------- */

async function renderMouth3D(root) {
  const wordOptions = [...new Set([...SURVEY.items.map((i) => i.word), ...Object.keys(WORDS), ...store.customWords()])];
  root.innerHTML = `
    <div class="card">
      <h2>3D mouth</h2>
      <p class="note">A stylised, child-friendly model of the inside of the mouth. Pick a sound, or pick a word and watch the tongue, lips and jaw move one sound at a time. Drag to turn it.</p>
      <div class="stage" id="stage"><div class="stage-msg" id="stage-msg">Loading 3D…</div></div>
      <div class="bigword" id="word-now">${wordHTML(st.threeWord)}</div>
      <div class="row wrap">
        <select id="w-pick" aria-label="Word">${wordOptions.map((w) => `<option${w === st.threeWord ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>
        <button class="btn mint" id="w-play">▶ Say it slowly</button>
        <button class="btn small" id="w-loop">🔁 Loop: off</button>
        <button class="btn small" id="w-stop">■ Stop</button>
        <button class="btn small sun" id="w-count">🦷 Count the teeth</button>
      </div>
      <p class="note" id="count-note">A child has 20 baby teeth: 10 on top and 10 on the bottom.</p>
      <div class="row wrap" style="margin-top:8px">
        <span class="lbl">Speed</span>
        ${[0.5, 0.75, 1].map((s) => `<button class="btn small spd${(store.ui().slow || 1) === s ? ' on' : ''}" data-spd="${s}">${s}×</button>`).join('')}
        <span class="lbl">View</span>
        ${[['side', 'Side'], ['angle', '3/4'], ['front', 'Front'], ['other', 'Other side']].map(([v, n]) => `<button class="btn small" data-view="${v}">${n}</button>`).join('')}
        <label class="toggle"><input type="checkbox" id="cut" ${store.ui().cutaway ? 'checked' : ''}> Cutaway</label>
      </div>
    </div>
    <div class="card"><h2>Single sounds</h2><div class="legend">${legendHTML()}</div>
      <div class="chips sounds">${SOUND_ORDER.map((p) => `<button class="schip big" data-3d="${p}" style="--c:${groupOf(p).color};--t:${groupOf(p).tint}" title="${esc(SOUNDS[p].label)}"><b>${esc(SOUNDS[p].spell)}</b></button>`).join('')}</div>
      <div class="mouth" id="snd-text">Tap a sound to hold the mouth in that shape.</div></div>
    <div class="card"><h2>Already out there</h2>
      <p class="note">Ready-made tools with real recordings and scans. Worth comparing with our model. (Links could not be opened from the build environment, so please check they still work.)</p>
      <ul class="refs">${REFERENCES.map((r) => `<li><a href="${r.url}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><br><span class="note">${esc(r.note)}</span></li>`).join('')}</ul></div>`;
  const stage = $('#stage');
  try {
    if (st.three) { st.three.destroy(); st.three = null; }
    const { createMouth3D } = await import('./mouth3d.js');
    $('#stage-msg')?.remove();
    st.three = createMouth3D(stage, {
      onCount: (n, where) => { const el = $('#count-note'); if (!el) return; el.innerHTML = where === 'done' ? 'A child has <b>20</b> baby teeth: <b>10</b> on top and <b>10</b> on the bottom.' : `<b style="font-size:26px">${n}</b> (${where})`; },
      onPhoneme: (pid) => { $('#word-now') && ($('#word-now').innerHTML = wordHTML(st.threeWord, pid)); if (pid) $('#snd-text').innerHTML = `<b style="color:${colorOf(pid)}">${esc(SOUNDS[pid].label)}.</b> ${esc(SOUNDS[pid].how)}`; },
    });
    st.three.setCutaway(store.ui().cutaway); st.three.setSpeed(store.ui().slow || 1);
    if (st.threeSound) { st.three.showSound(st.threeSound); $('#snd-text').innerHTML = `<b style="color:${colorOf(st.threeSound)}">${esc(SOUNDS[st.threeSound].label)}.</b> ${esc(SOUNDS[st.threeSound].how)}`; st.threeSound = null; }
  } catch (e) {
    stage.innerHTML = `<div class="stage-msg">3D could not start here (${esc(e.message || e)}). The Diagrams tab shows the same shapes in 2D.</div>`;
    return;
  }
  const play = () => { st.threeWord = $('#w-pick').value; $('#word-now').innerHTML = wordHTML(st.threeWord); st.three.playWord(st.threeWord, { loop: st.loop }); };
  $('#w-play').addEventListener('click', play);
  $('#w-pick').addEventListener('change', play);
  $('#w-count').addEventListener('click', () => st.three.countTeeth());
  $('#w-stop').addEventListener('click', () => { st.three.stop(); st.three.showSound(null); });
  $('#w-loop').addEventListener('click', (e) => { st.loop = !st.loop; e.target.textContent = `🔁 Loop: ${st.loop ? 'on' : 'off'}`; });
  root.querySelectorAll('[data-spd]').forEach((b) => b.addEventListener('click', () => { store.setUi({ slow: Number(b.dataset.spd) }); st.three.setSpeed(Number(b.dataset.spd)); root.querySelectorAll('.spd').forEach((x) => x.classList.toggle('on', x === b)); }));
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => st.three.view(b.dataset.view)));
  $('#cut').addEventListener('change', (e) => { store.setUi({ cutaway: e.target.checked }); st.three.setCutaway(e.target.checked); });
  root.querySelectorAll('[data-3d]').forEach((b) => b.addEventListener('click', () => { const p = b.dataset['3d']; st.three.showSound(p); $('#snd-text').innerHTML = `<b style="color:${colorOf(p)}">${esc(SOUNDS[p].label)}.</b> ${esc(SOUNDS[p].how)}`; }));
  window.__three = st.three;
}

/* ---------- 5. WORDS (flashcards) ---------- */

function deckList() {
  const decks = DECKS.map((d) => ({ id: d.id, title: d.title, desc: d.desc, words: d.words }));
  const custom = store.customWords();
  if (custom.length) decks.push({ id: 'mine', title: 'My words', desc: 'Words added by a grown-up. Sounds are split by a rough guess.', words: custom });
  const fl = store.flags();
  const flagged = Object.keys(fl).filter((w) => fl[w].v > 0);
  decks.unshift({ id: 'flagged', title: 'Flagged words', desc: 'Words marked tricky or really tricky.', words: flagged });
  // recommended: words containing the trickiest sounds
  const top = trickySounds(5);
  const all = [...new Set([...Object.keys(WORDS), ...custom])];
  const rec = top.length ? all.map((w) => ({ w, s: soundsOf(w).reduce((a, p) => a + (top.includes(p) ? 1 + (top.length - top.indexOf(p)) * 0.2 : 0), 0) / Math.max(1, soundsOf(w).length) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 24).map((x) => x.w) : DECKS[0].words;
  decks.unshift({ id: 'recommended', title: top.length ? 'Recommended' : 'Start here', desc: top.length ? `Words rich in ${top.slice(0, 3).map((p) => SOUNDS[p].spell).join(', ')} and other tricky sounds.` : 'No survey yet, so here are the first words.', words: rec });
  return decks;
}
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function renderWords(root) {
  const decks = deckList();
  let deck = decks.find((d) => d.id === st.deckId) || decks[0];
  st.deckId = deck.id;
  if (!st.deckOrder.length || !st.deckOrder.every((w) => deck.words.includes(w)) || st.deckOrderId !== deck.id) { st.deckOrder = shuffle(deck.words); st.cardIdx = 0; st.deckOrderId = deck.id; }
  const fl = store.flags();
  const word = st.deckOrder[st.cardIdx % Math.max(1, st.deckOrder.length)];
  const mins = Math.floor((store.practiceThisWeek() + st.practiceTick) / 60);
  root.innerHTML = `
    <div class="card">
      <div class="row between"><h2>Word cards</h2><span class="status-pill" title="Goal: about 5 minutes a week">⏱ ${mins} / 5 min this week</span></div>
      <div class="chips decks">${decks.map((d) => `<button class="btn small deck${d.id === deck.id ? ' on' : ''}" data-deck="${d.id}">${esc(d.title)} <small>${d.words.length}</small></button>`).join('')}</div>
      <p class="note">${esc(deck.desc)}</p>
    </div>
    ${word ? `<div class="card flash" id="flash">
      <div class="note center">${(st.cardIdx % st.deckOrder.length) + 1} of ${st.deckOrder.length}</div>
      <div class="bigword huge">${wordHTML(word)}</div>
      <div class="chips center">${soundsOf(word).map((p, i) => soundChip(p)).join('')}</div>
      <p class="center q">Say it. How did it feel?</p>
      <div class="flags">
        <button class="btn easy${fl[word]?.v === 0 ? ' on' : ''}" data-flag="0">😀 Easy</button>
        <button class="btn tricky${fl[word]?.v === 1 ? ' on' : ''}" data-flag="1">😬 Tricky</button>
        <button class="btn hard${fl[word]?.v === 2 ? ' on' : ''}" data-flag="2">😖 Really tricky</button>
      </div>
      <div class="row between" style="margin-top:14px">
        <button class="btn small" id="c-prev">← Back</button>
        <button class="btn small sky" id="c-3d">🧊 Watch the mouth</button>
        <button class="btn small mint" id="c-next">Next →</button>
      </div></div>` : `<div class="card"><p>No words in this deck yet. ${deck.id === 'flagged' ? 'Flag some words and they will show up here.' : ''}</p></div>`}
    <div class="card"><h2>Heat map</h2>${heatGridHTML()}</div>
    <div class="card"><h2>This deck</h2>
      <div class="chips">${deck.words.map((w) => `<button class="wchip ${fl[w] ? ['easy', 'tricky', 'hard'][fl[w].v] : 'blank'}" data-jump="${esc(w)}">${wordHTML(w)}</button>`).join('')}</div></div>
    <div class="card"><h2>Add words</h2>
      <p class="note">Type words from a book or a list, separated by commas. We split them into sounds with a rough guess (colours may be a little off for odd spellings).</p>
      <div class="row"><input id="add-words" type="text" placeholder="e.g. fox, thunder, church"><button class="btn small mint" id="add-go">Add</button></div></div>`;
  root.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', () => { st.deckId = b.dataset.deck; st.deckOrder = []; renderScreen(); }));
  root.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => { store.flagWord(word, Number(b.dataset.flag)); st.cardIdx++; renderScreen(); }));
  const nx = $('#c-next'); if (nx) {
    nx.addEventListener('click', () => { st.cardIdx++; renderScreen(); });
    $('#c-prev').addEventListener('click', () => { st.cardIdx = Math.max(0, st.cardIdx - 1); renderScreen(); });
    $('#c-3d').addEventListener('click', () => { st.threeWord = word; go('mouth3d'); setTimeout(() => st.three && st.three.playWord(word), 700); });
  }
  root.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => { const i = st.deckOrder.indexOf(b.dataset.jump); if (i >= 0) { st.cardIdx = i; renderScreen(); window.scrollTo({ top: 0 }); } }));
  $('#add-go').addEventListener('click', () => {
    const list = $('#add-words').value.split(/[,\n]/).map((w) => w.trim().toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean);
    if (!list.length) return;
    store.addCustomWords(list); st.deckId = 'mine'; st.deckOrder = []; toast(`Added ${list.length} word${list.length > 1 ? 's' : ''}.`); renderScreen();
  });
}
function startPractice() {
  clearInterval(st.practiceTimer); st.practiceTick = 0;
  st.practiceTimer = setInterval(() => {
    if (document.hidden || st.tab !== 'words') return;
    st.practiceTick++;
    if (st.practiceTick >= 15) flushPractice(true);
  }, 1000);
}
function flushPractice(keep) { if (st.practiceTick > 0) { store.addPractice(st.practiceTick); st.practiceTick = 0; } if (!keep) clearInterval(st.practiceTimer); }
window.addEventListener('pagehide', () => flushPractice());

/* ---------- SETTINGS ---------- */

function renderDrawer() {
  const p = store.active();
  const vs = store.versions();
  const ss = store.syncState;
  $('#drawer-body').innerHTML = `
    <div class="card"><h2>Person</h2>
      <p class="note">Everything (survey, flags, notes) is saved per person.</p>
      <div class="row wrap"><select id="s-person">${store.profiles().map((x) => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}${x.locked ? ' 🔒' : ''}</option>`).join('')}</select>
      <button class="btn small" id="s-add">➕ New person</button></div>
      <label class="field">Name <input id="s-name" type="text" value="${esc(p.name)}"></label>
    </div>
    <div class="card"><h2>Notes</h2>
      <textarea id="s-notes" rows="4" placeholder="Observations, what the therapist said, what helped…">${esc(p.notes)}</textarea>
    </div>
    <div class="card"><h2>Lock in</h2>
      <p class="note">${p.locked ? `🔒 Survey locked in${p.lockedAt ? ' on ' + new Date(p.lockedAt).toLocaleDateString() : ''}. Flashcards keep updating the heat map.` : 'Lock in saves a snapshot of the heat map to the version log and freezes the survey answers, so later changes are easy to compare.'}</p>
      <div class="row wrap">
        ${p.locked ? '<button class="btn small" id="s-unlock">Unlock</button>' : '<button class="btn small mint" id="s-lock">🔒 Lock in survey</button>'}
        <button class="btn small sky" id="s-snap">📸 Save snapshot</button>
      </div></div>
    <div class="card"><h2>Version log for ${esc(p.name)}</h2>
      ${vs.length ? `<ul class="log">${vs.map((v) => `<li><b>${esc(v.label)}</b> <span class="note">${new Date(v.t).toLocaleString()}</span>
        <div class="mini">${Object.entries(v.snapshot?.heat || {}).filter(([, d]) => d.heat > 0).sort((a, b) => b[1].heat - a[1].heat).slice(0, 8).map(([pid, d]) => soundChip(pid, `<small>${Math.round(d.heat * 100)}%</small>`)).join('') || '<span class="note">No tricky sounds then.</span>'}</div></li>`).join('')}</ul>` : '<p class="note">No versions yet. Lock in the survey or save a snapshot.</p>'}
    </div>
    <div class="card"><h2>3D mouth</h2>
      <label class="toggle"><input type="checkbox" id="s-cut" ${store.ui().cutaway ? 'checked' : ''}> Cutaway view by default</label></div>
    <div class="card"><h2>Database</h2>
      <p class="note">Status: <b>${esc(ss.status)}</b> ${esc(ss.detail || '')}</p>
      ${ss.signedIn ? '<div class="row wrap"><button class="btn small sky" id="s-sync">Sync now</button><button class="btn small" id="s-check">Check tables</button><button class="btn small" id="s-out">Sign out</button></div>'
        : '<div class="field"><input id="s-email" type="email" placeholder="email" autocomplete="username"><input id="s-pass" type="password" placeholder="password" autocomplete="current-password"><button class="btn small mint" id="s-in">Sign in to sync</button></div>'}
      <pre class="note" id="s-out-text"></pre></div>
    <div class="card"><h2>App versions</h2>
      <ul class="log">${APP_VERSIONS.map((v) => `<li><b>v${v.v}</b> <span class="note">${esc(v.date)}</span><div>${esc(v.text)}</div></li>`).join('')}</ul></div>
    <div class="card"><h2>V1 (archived)</h2>
      <p class="note">The original lesson app still runs from here.</p>
      <div class="row wrap"><a class="btn small sun" href="v1/index.html">Open V1 lessons</a><a class="btn small sun" href="v1/public/booth.html">🎙️ Voice Booth</a></div></div>`;
  const rerender = () => { store.setNotes($('#s-notes').value); };
  $('#s-person').addEventListener('change', (e) => { store.setActive(e.target.value); st.surveyMode = null; st.surveyIdx = 0; st.deckOrder = []; renderDrawer(); renderScreen(); });
  $('#s-add').addEventListener('click', () => { const n = prompt('Name of the new person?'); if (n) { store.addProfile(n); st.surveyMode = null; st.surveyIdx = 0; st.deckOrder = []; renderDrawer(); renderScreen(); } });
  $('#s-name').addEventListener('change', (e) => { store.renameProfile(p.id, e.target.value.trim() || p.name); renderDrawer(); renderScreen(); });
  let nt; $('#s-notes').addEventListener('input', () => { clearTimeout(nt); nt = setTimeout(rerender, 500); });
  $('#s-notes').addEventListener('blur', rerender);
  const lk = $('#s-lock'); if (lk) lk.addEventListener('click', () => { const l = prompt('Name for this version?', 'Baseline'); if (l !== null) { store.lockIn(l || 'Baseline'); renderDrawer(); renderScreen(); } });
  const ul = $('#s-unlock'); if (ul) ul.addEventListener('click', () => { store.unlock(); renderDrawer(); renderScreen(); });
  $('#s-snap').addEventListener('click', () => { const l = prompt('Name for this snapshot?', 'Snapshot'); if (l !== null) { store.addVersion('snapshot', l || 'Snapshot'); renderDrawer(); } });
  $('#s-cut').addEventListener('change', (e) => store.setUi({ cutaway: e.target.checked }));
  const si = $('#s-in'); if (si) si.addEventListener('click', async () => { const r = await store.signIn($('#s-email').value, $('#s-pass').value); if (r.error) toast(r.error, true); renderDrawer(); });
  const so = $('#s-out'); if (so) so.addEventListener('click', async () => { await store.signOut(); renderDrawer(); });
  const sy = $('#s-sync'); if (sy) sy.addEventListener('click', async () => { await store.pull(); await store.push(); renderDrawer(); });
  const ck = $('#s-check'); if (ck) ck.addEventListener('click', async () => { $('#s-out-text').textContent = await store.checkTables(); });
}
function openDrawer(open) {
  $('#drawer').classList.toggle('hidden', !open); $('#scrim').classList.toggle('hidden', !open);
  if (open) renderDrawer();
}

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 3200);
}

/* ---------- boot ---------- */

$('#gear').addEventListener('click', () => openDrawer(true));
$('#close-drawer').addEventListener('click', () => openDrawer(false));
$('#scrim').addEventListener('click', () => openDrawer(false));
$('#home').addEventListener('click', () => go('survey'));
$('#legend').innerHTML = legendHTML();
store.onChange(() => {
  const ss = store.syncState;
  $('#net-pill').textContent = ss.status;
  $('#net-pill').classList.toggle('bad', ss.status === 'sync failed');
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.some((t) => t.id === h) && h !== st.tab) go(h); });
const first = location.hash.slice(1);
st.tab = TABS.some((t) => t.id === first) ? first : 'survey';
go(st.tab);
store.initSync().then(() => { $('#net-pill').textContent = store.syncState.status; if (store.syncState.signedIn) renderScreen(); });
