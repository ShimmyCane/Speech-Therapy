/* Mouth position guide: one side-view drawing and a short line for each sound.
 * Drawn in code, no image files. Felix's lesson screen and the Voice Booth both use it.
 * Source: the "Mouth Position Guide" artifact. TH is a best guess, see its note.
 */
'use strict';

const MouthGuide = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#2b2d42';
  const SKIN = '#f7dcc8';
  const TONGUE = '#ff8fa3';
  const TEETH = '#ffffff';
  const LIP = '#d9605f';

  // Which drawings each lesson shows, keyed by "track-lesson_no". Lessons not listed show none.
  const LESSON_SOUNDS = {
    'en-2': ['S', 'S (tip down)'],
    'en-3': ['S'],
    'en-4': ['S'],
    'en-5': ['S'],
    'en-6': ['S', 'SH'],
    'en-7': ['S', 'TH'],
    'en-8': ['TH'],
    'en-9': ['S', 'Z'],
    'en-10': ['R', 'L'],
    'en-11': ['F', 'V'],
    'en-13': ['SH'],
    'en-15': ['S'],
    'zh-3': ['S (tip down)'],
    'zh-4': ['SH'],
    'zh-5': ['S (tip down)', 'SH'],
    'zh-6': ['S (tip down)'],
    'zh-7': ['R'],
    'zh-9': ['S (tip down)'],
    'zh-15': ['S (tip down)'],
  };

  // Tongue, teeth and lips are drawn from these numbers in a 300 x 200 box. Front of the mouth on the left.
  const SOUNDS = {
    'S': { tip: [132, 80], body: 98, lips: 'neutral', voice: false,
      tongueWord: 'Tip up, close to the bumpy ridge. A narrow groove down the middle.',
      teeth: 'Close, with only a small gap.', lipsWord: 'Neutral. Smile slightly, do not round.',
      air: 'Blow a steady stream down the middle of the tongue.',
      say: 'ssssss, like a snake' },
    'S (tip down)': { tip: [118, 118], body: 118, lips: 'neutral', voice: false,
      tongueWord: 'Tip down, resting just behind the bottom front teeth. Some people find this easier.',
      teeth: 'Close, with only a small gap.', lipsWord: 'Neutral.',
      air: 'Same steady stream down the middle.',
      say: 'ssssss, tip behind the bottom teeth' },
    'Z': { tip: [132, 80], body: 98, lips: 'neutral', voice: true,
      tongueWord: 'Same as S, tongue tip close to the ridge.',
      teeth: 'Close, with only a small gap.', lipsWord: 'Neutral.',
      air: 'Same air as S, but turn the voice on: feel the buzz in the throat.',
      say: 'zzzzzz, a buzzing bee' },
    'SH': { tip: [150, 88], body: 96, lips: 'oval', voice: false,
      tongueWord: 'Tip pulled back from the ridge. The middle of the tongue is raised and the sides are up.',
      teeth: 'Close, with a small gap.', lipsWord: 'Oval. Round them and push them a little forward.',
      air: 'Blow over the raised middle, quietly.',
      say: 'shhhhh, quiet like a sign to be still' },
    'TH': { tip: [124, 100], body: 120, lips: 'neutral', voice: false,
      tongueWord: 'Tip between the top and bottom front teeth, just poking out.',
      teeth: 'Open a little, tongue in the gap.', lipsWord: 'Neutral.',
      air: 'Blow gently over the tongue tip.',
      say: 'thhhhh, tongue out a little',
      note: 'Best guess from general speech teaching. A speech therapist should check this one.' },
    'L': { tip: [134, 74], body: 120, lips: 'neutral', voice: true,
      tongueWord: 'Tip touches the bumpy ridge. The back of the tongue stays low.',
      teeth: 'Slightly apart.', lipsWord: 'Neutral.',
      air: 'Voice on. Air passes over the sides of the tongue.',
      say: 'llllll, tip on the bump' },
    'R': { tip: [166, 64], body: 92, lips: 'neutral', voice: true,
      tongueWord: 'Tip curled up and back, past the ridge. The middle of the tongue is firm, not floppy.',
      teeth: 'Slightly apart.', lipsWord: 'Neutral, not rounded.',
      air: 'Voice on, a narrow stream over the middle.',
      say: 'rrrrr, a growl with the tongue curled back' },
    'F': { tip: null, body: null, lips: 'tucked', voice: false,
      tongueWord: 'Tongue low, behind the bottom teeth.',
      teeth: 'Top front teeth rest on the bottom lip.', lipsWord: 'Bottom lip tucked under the top teeth.',
      air: 'Push air out, no voice.',
      say: 'ffffff, like a cat hissing with teeth on the lip' },
    'V': { tip: null, body: null, lips: 'tucked', voice: true,
      tongueWord: 'Tongue low, behind the bottom teeth.',
      teeth: 'Top front teeth rest on the bottom lip.', lipsWord: 'Bottom lip tucked under the top teeth.',
      air: 'Same as F, but turn the voice on: a buzz.',
      say: 'vvvvvv, the buzzy version of f' },
  };

  function el(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text) node.textContent = text;
    return node;
  }

  function drawMouth(name) {
    const s = SOUNDS[name];
    const svg = el('svg', { viewBox: '0 0 300 200', role: 'img', 'aria-label': `Side view for ${name}` });
    // Head and palate
    svg.appendChild(el('path', { d: 'M 40 20 L 300 20 L 300 190 L 90 190 Q 70 150 60 110 Q 44 70 40 20 Z', fill: SKIN, stroke: 'none' }));
    svg.appendChild(el('path', { d: 'M 122 66 Q 200 36 298 56', fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    svg.appendChild(el('ellipse', { cx: 128, cy: 66, rx: 6, ry: 3.5, fill: SKIN, stroke: INK, 'stroke-width': 2 }));
    // Teeth: upper and lower front teeth
    svg.appendChild(el('rect', { x: 104, y: 72, width: 14, height: 24, rx: 3, fill: TEETH, stroke: INK, 'stroke-width': 2 }));
    svg.appendChild(el('rect', { x: 104, y: 104, width: 14, height: 24, rx: 3, fill: TEETH, stroke: INK, 'stroke-width': 2 }));
    // Tongue
    if (s.tip) {
      const [tx, ty] = s.tip;
      svg.appendChild(el('path', {
        d: `M ${tx} ${ty} Q 200 ${s.body} 270 ${s.body + 34} L 270 150 Q 200 156 ${tx + 4} ${ty + 16} Z`,
        fill: TONGUE, stroke: INK, 'stroke-width': 2,
      }));
    } else {
      // F and V: the tongue sits low, the lower lip is tucked
      svg.appendChild(el('path', { d: 'M 124 150 Q 200 124 270 130 L 270 152 Q 200 160 124 152 Z', fill: TONGUE, stroke: INK, 'stroke-width': 2 }));
    }
    // Lips
    const upperLip = s.lips === 'oval' ? 'M 118 58 Q 84 74 90 98 Q 96 106 106 104' : 'M 118 58 Q 96 64 96 84 Q 100 92 106 92';
    const lowerLip = s.lips === 'tucked'
      ? 'M 104 96 Q 88 108 96 118 Q 110 126 124 114'
      : s.lips === 'oval' ? 'M 106 112 Q 84 120 88 132 Q 100 146 122 136' : 'M 106 112 Q 98 120 100 134 Q 110 142 124 132';
    svg.appendChild(el('path', { d: upperLip, fill: LIP, stroke: INK, 'stroke-width': 2 }));
    svg.appendChild(el('path', { d: lowerLip, fill: LIP, stroke: INK, 'stroke-width': 2 }));
    // Voice marker
    if (s.voice) {
      svg.appendChild(el('path', { d: 'M 150 178 q 6 -8 0 -16 q 6 -8 0 -16', fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
      svg.appendChild(el('text', { x: 162, y: 170, fill: INK, 'font-size': 13, 'font-weight': 800 }, 'voice on'));
    }
    return svg;
  }

  function card(name) {
    const s = SOUNDS[name];
    const article = document.createElement('article');
    article.className = 'mouth-card';

    const title = document.createElement('h3');
    title.textContent = name;

    const figure = document.createElement('figure');
    figure.appendChild(drawMouth(name));

    const say = document.createElement('p');
    say.className = 'say';
    say.textContent = `Say: ${s.say}`;

    // The grown-up steps stay folded away, so Felix sees only the picture and the line to say.
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'For grown-ups';
    const list = document.createElement('ul');
    list.className = 'steps';
    [['Tongue', s.tongueWord], ['Teeth', s.teeth], ['Lips', s.lipsWord], ['Air', s.air]].forEach(([label, text]) => {
      const li = document.createElement('li');
      const b = document.createElement('strong');
      b.textContent = `${label}: `;
      li.append(b, document.createTextNode(text));
      list.appendChild(li);
    });
    details.append(summary, list);
    if (s.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = s.note;
      details.appendChild(note);
    }

    article.append(title, figure, say, details);
    return article;
  }

  function soundsFor(lesson) {
    if (!lesson) return [];
    return LESSON_SOUNDS[`${lesson.track}-${lesson.lesson_no}`] || [];
  }

  // Fills host with the drawings for this lesson. Hidden when the lesson has none.
  function render(host, lesson) {
    const names = soundsFor(lesson);
    host.innerHTML = '';
    host.classList.toggle('hidden', !names.length);
    names.forEach((name) => host.appendChild(card(name)));
  }

  return { soundsFor, render };
})();
