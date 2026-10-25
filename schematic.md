# Speech Therapy — Schematic

**Status:** Schematic v0.2. Answers from `01 Plan/convo v8.md` are folded in. No code yet.
**For:** Felix (age 6). Practises English and Mandarin (Chinese) sounds, starting with **S**.
**Used by:** Felix alone on the iPad, about **10 minutes a day**. Grown-ups guide it for the first while.
**Look:** Family Habits style (playful, tactile, bold). See §10.

---

## 1. Purpose

Felix has trouble with **S sounds** in both languages. The app lets him:

1. **Listen** to a clear model, recorded by a grown-up in the family, slowed or pitched differently.
2. **Say** the word himself. The app listens and gives stars.
3. **Look** at a picture of his sound next to the model.
4. **Practise** one short lesson a day, moving through 15 lessons per language.

The goal is fun, steady practice. Stars encourage effort; the app does not show "wrong".

---

## 2. Who Does What

| Role | What they do | Where |
|------|--------------|-------|
| **Felix** | Plays one lesson a day, alone | Main app (`index.html`) |
| **Grown-up (mum, grandpa, others)** | Records each model word and sentence once | **Voice Booth** (`booth.html`), not linked from Felix's home |
| **Parent** | Watches progress, adds or edits lessons, turns features on | Gear panel (⚙️) and the database |

---

## 3. Core Loop (one lesson, about 10 minutes)

```
  ┌────────┐   ┌────────┐   ┌──────────┐   ┌────────────┐   ┌─────────┐
  │1 LISTEN│ → │2 PICTURE│ → │3 SAY IT  │ → │4 STARS     │ → │5 NEXT   │
  │model   │   │ + mouth │   │ 5 tries  │   │ easy score │   │ or REPEAT│
  │slow/hi │   │ card    │   │ recorded │   │            │   │         │
  └────────┘   └────────┘   └──────────┘   └────────────┘   └─────────┘
```

- One lesson per session. Roughly 5 minutes of listening and saying, plus stars.
- Felix may repeat any lesson. Repeats are normal, not failures.
- Lessons come in variations (different word sets), so the same sound can be practised more than once.

---

## 4. Feature Map

| # | Feature | What it does | Notes |
|---|---------|--------------|-------|
| F1 | **Model player** | Plays the grown-up's recorded word or sentence. | Speed 0.5×, 0.75×, 1×. Pitch: same / lower / higher. `playbackRate` with `preservesPitch` for slow playback. |
| F2 | **Recorder** | Felix taps to record, taps to stop. Can listen back and retry. | `getUserMedia` + `MediaRecorder`. Starts only after a tap (iPad rule). |
| F3 | **Automatic check (client side)** | Compares Felix's try with the model and gives 1–3 stars. | All in the browser. Lenient thresholds, see §6. |
| F4 | **Picture card** | Word picture, the word, and a simple mouth drawing. | Playful, one sentence of mouth instructions. |
| F5 | **Lesson player** | Runs the 5-step lesson in §3. | Reads lesson data from the database (see §8). |
| F6 | **Stars & path** | Stars for each lesson, path of 15 steps per language. | Lessons unlock in order; repeats always allowed. |
| F7 | **Voice Booth** | Grown-up page: shows each word/sentence with its picture, records it, saves the clip. | Shows "12 of 80 recorded". Not linked from Felix's home. |
| F8 | **Gear panel (⚙️)** | Lower-right. Default speed/pitch, sound on/off, lesson on/off (for extensions), reset progress. | Errors only behind "Show errors", at the bottom. |
| F9 | **Lesson editor (later)** | Adds or edits lessons and words in the database. | Lessons are data, so new ones need no code. Milestone M7. |

---

## 5. Curriculum (draft, for your approval)

Two tracks, **15 lessons each**. Each lesson has 2–3 variants (different word sets). Repeats are fine. S sounds come early, since they are Felix's main difficulty.

### 5a. English track (General American accent)

| # | Lesson | Focus | Example words |
|---|--------|-------|---------------|
| 1 | Warm-up | Lips, breath, humming | hum, buzz, pop |
| 2 | S alone | /s/ at the start | sun, sock, sit |
| 3 | S words | /s/ at start, longer words | soup, six, sad |
| 4 | S at the end | final -s | cats, bags, bus |
| 5 | S blends | sp, st, sk | spoon, stop, sky |
| 6 | S or SH | /s/ vs /ʃ/ | see / she, sip / ship |
| 7 | S or TH | /s/ vs /θ/ | sink / think |
| 8 | TH sound | /θ/ | think, thumb, three |
| 9 | Z sound | /z/ (buzzy S) | zoo, buzz, is |
| 10 | R or L | /r/ vs /l/ | red / led, rain / lain |
| 11 | V or F | /v/ vs /f/ | very / fairy, van / fan |
| 12 | Short vowels | /æ/ vs /ɛ/ | bat / bet, cat / pet |
| 13 | Ship or sheep | /ɪ/ vs /iː/ | ship / sheep, bit / beat |
| 14 | Ends of words | final -t, -d, -g | cap, bed, dog |
| 15 | Silly sentences | S words together | "Sam sees six snakes." |

### 5b. Chinese track (Beijing standard Mandarin)

| # | Lesson | Focus | Example words |
|---|--------|-------|---------------|
| 1 | Warm-up | Mouth and breath | 啊, 哦, 嗯 |
| 2 | Easy starts | b p m | 爸爸, 妈妈, 包 |
| 3 | S sound | s | 四 (sì), 丝 (sī), 思 (sī) |
| 4 | SH sound | sh | 十 (shí), 书 (shū), 诗 (shī) |
| 5 | S or SH | s vs sh | 四 / 十, 思 / 诗 |
| 6 | Z, C, S | z c s | 资 (zī), 词 (cí), 四 (sì) |
| 7 | ZH, CH, R | curled tongue set | 吃, 日, 知 |
| 8 | J, Q, X | j q x | 七 (qī), 鸡 (jī), 西 (xī) |
| 9 | S or X | s vs x | 思 / 西, 四 / 戏 |
| 10 | Ü sound | ü vs i | 鱼 (yú), 雨 (yǔ), 衣 (yī) |
| 11 | N or NG | -n vs -ng | 人 / 英, 很 / 横 |
| 12 | Tones 1 and 2 | high flat, rising | 妈 (mā), 麻 (má) |
| 13 | Tones 3 and 4 | dip, falling | 马 (mǎ), 骂 (mà) |
| 14 | Neutral tone | soft ending | 吗, 的, 妈妈 |
| 15 | Silly sentence | S sounds together | "我四岁。" (wǒ sì suì) |

> Confirm the Chinese lesson order and word choices with a Mandarin-speaking grown-up before the Booth recording starts.

### 5c. Lesson variants

Each lesson has 2–3 variants (for example, "S alone" A/B/C use different words). The app picks a variant at random, or in order, so Felix does not see the same list every time.

---

## 6. Client-Side Check (how the stars work)

Everything runs in the browser. No server, no AI service.

| What is compared | How | What it tells Felix |
|------------------|-----|---------------------|
| Shape of the word | Mel-frequency features with time alignment (DTW) against the grown-up's clip | "Your word sounds close to the model" |
| Hissy S sounds | High-frequency energy and spectral centre (where the hiss sits) | "Your S is a bit low/high" (for /s/ vs /ʃ/) |
| Tones (Chinese) | Pitch track compared with the model's pitch track | Rising, falling, dip shapes |
| Loudness and length | Simple level and duration | "Good strong voice", "try a little longer" |

**Stars (easy side):**
- ⭐ = tried and it made sound (every try counts)
- ⭐⭐ = close to the model
- ⭐⭐⭐ = very close

Thresholds are set generously and tuned on the grown-up recordings in M3. A miss never shows as red. No "right/wrong" words.

**Limit:** the check compares shapes and sounds. It cannot tell every sound apart with certainty. A grown-up sitting with Felix is still the best judge, and the app is not a medical tool.

---

## 7. Mouth Pictures (F4)

Each lesson has a simple drawing of the mouth: tongue, teeth, lips, and whether the voice buzzes. One short line for Felix, for example "Tongue behind your top teeth. Blow, like a snake: sssss." Drawn in the playful Family Habits style.

---

## 8. Data (Supabase, Family project)

Lessons live in the database, so they can be added or changed without new code. A bundled copy in `data/` is the offline fallback.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `speech_lessons` | One row per lesson variant | `id`, `track` (en/zh), `lesson_no`, `variant`, `title`, `focus`, `mouth_text`, `active` |
| `speech_words` | Words and sentences in a lesson | `id`, `lesson_id`, `text`, `kind` (word/sentence), `pinyin_or_ipa`, `picture`, `clip_url` |
| `speech_sessions` | One row per lesson played | `id`, `member_name` ('Felix'), `lesson_id`, `stars`, `created_at` |
| `speech_attempts` | One row per try | `id`, `session_id`, `word_id`, `stars`, `similarity`, `created_at` |

- All tables use the `speech_` prefix and are registered in `app_table_registry` in the same change (see `04 AI/Supabase Registry/`).
- **Felix's audio is not saved** in the MVP. Scores are saved.
- Model clips (from the Booth) need a home. See the open question in convo v8.1 (Supabase Storage vs files in the repo).

---

## 9. Privacy & Safety

- Felix's recordings are **not saved** in the MVP. They are used for the check and then dropped.
- Grown-up model clips are shared within the family only.
- No ads, no outside links, no chat, no accounts for Felix. Felix's home has no link to the Booth.
- Microphone is on only while the record button is pressed. A clear red dot shows when recording.
- The app is **not** a medical tool. If speech concerns persist, a speech-language pathologist (SLP) should assess him.

---

## 10. Look & Feel (Family Habits style)

Reuse the Family Habits design tokens so the family's apps feel like one set:

- **Fonts:** Quicksand (body and buttons), Orbitron (titles), Patrick Hand (notes).
- **Colours:** ink `#2b2d42`, paper `#fffdf5`, sun `#ffd23f`, pink `#ff6b9d`, sky `#4cc9f0`, mint `#6bd8a0`, grape `#9b5de5`, coral `#ff7b54`.
- **Shapes:** asymmetric radii (for example `14px 36px 14px 36px`), 2.5–3.5 px ink outlines, offset shadows `4px 4px 0 var(--ink)`, polka-dot background.
- **Touch:** 48–68 px buttons. Errors at the bottom behind "Show errors".
- **Fun:** star bursts on a good try, a playful character, and short cheerful sounds (Web Audio, no files).

---

## 11. Technical Shape

- **Stack:** single-page HTML, CSS, vanilla JavaScript. No build step. Supabase for lessons and progress, with a bundled fallback.
- **Audio:** Web Audio API (`AnalyserNode` for level, spectrum, pitch) and `OfflineAudioContext` where helpful. `MediaRecorder` for capture. `playbackRate` with `preservesPitch` for slow replay.
- **Targets:** iPad Safari first, then desktop.

### Proposed file layout

```
03 Projects/Speech Therapy/
  index.html        # Felix's app
  booth.html        # Voice Booth for grown-ups
  css/style.css
  js/
    app.js          # screens and lesson flow
    recorder.js     # mic, MediaRecorder
    player.js       # model playback, speed and pitch
    check.js        # client-side similarity (DTW, pitch, spectrum), stars
    lessons.js      # loads lessons from Supabase or bundled data
    progress.js     # sessions and attempts, offline queue
    booth.js        # Voice Booth recording and upload
    settings.js     # gear panel
  data/
    lessons_en.json, lessons_zh.json   # bundled fallback
  schematic.md
  index_summary.html   (later)
```

---

## 12. Screens

1. **Home (Felix)** — big "Play today" button, the day's lesson, stars so far, path button.
2. **Lesson** — picture card → listen → say it (5 tries) → stars → done.
3. **Path** — 15 steps per language, unlocked in order, repeats always open.
4. **Gear (⚙️)** — default speed and pitch, sound on/off, reset progress. Grown-up only in practice.
5. **Voice Booth (`booth.html`)** — list of words/sentences, record, play back, save. Shows progress.

---

## 13. Milestones

| Milestone | Outcome | Status |
|-----------|---------|--------|
| M0 | Schematic, convo questions | Done |
| M1 | Voice Booth + lesson tables; grown-ups record first English and Chinese model words | Pending |
| M2 | Lesson player with model playback (0.5× / 0.75× / 1×, pitch options) | Pending |
| M3 | Client-side check, calibrated on the grown-up recordings; stars | Pending |
| M4 | 15 English and 15 Chinese lessons with variants, loaded from the database | Pending |
| M5 | Family Habits look, path map, gear panel, bundled offline fallback | Pending |
| M6 | Sessions and attempts saved to Supabase; registry updated | Pending |
| M7 | Lesson editor for extensions; `index_summary.html` | Pending |

Each milestone is tried on Felix's iPad before moving on.

---

## 14. Decisions Recorded (from convo v8)

- Model voice: **recorded by grown-ups** in the Voice Booth, not text-to-speech.
- Accent: **General American** for English, **Beijing standard** for Chinese (defaults; can change).
- Chinese check: **automatic, client-side**.
- Felix's focus: **S sounds** first, in both languages.
- Both languages in parallel. 15 lessons each, repeats allowed, variants, database-driven.
- Speed and pitch: 0.5× / 0.75× / 1×, plus same / lower / higher. Confirmed.
- Scoring: automatic, easy side, stars only.
- Recordings: Felix's audio not saved in the MVP. Scores saved.
- Felix alone, with guidance for a while. Mainly iPad. About 10 minutes a day.

## 15. Open Items

See `01 Plan/convo v8.1.md` and the AI follow-up in `01 Plan/convo v8.md`.
