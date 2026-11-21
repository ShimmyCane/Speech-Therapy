// Mandarin Chinese pack: initials, finals and tones, pinyin parsing, words, survey and videos.
// Colours follow the same "how the mouth moves" groups as English, plus:
//   front (j q x: tip down, front of tongue up) and tone (voice pitch).
// Finals ending in -n are coloured "tongue tip up" and finals ending in -ng "back of tongue", so the colour
// itself teaches the an / ang difference.
import { P } from './params.js';

// Tone contours on the 1 (low) to 5 (high) scale.
export const TONES = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 4], 4: [5, 1], 5: [3, 3] };
export const TONE_NAMES = { 1: 'high and flat', 2: 'rising', 3: 'dipping', 4: 'falling', 5: 'light' };
const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
const UNMARK = {};
for (const [v, m] of Object.entries(MARKS)) [...m].forEach((c, i) => { UNMARK[c] = [v, i + 1]; });

// ---------- mouth shapes ----------
// Vowel targets used to build every final.
const V = {
  a: P({ jaw: .75, back: .3, mid: .2, blade: .12, tipY: .1, tipZ: .64, voiced: 1 }),
  o: P({ jaw: .42, round: .75, back: .62, mid: .3, tipY: .1, tipZ: .62, voiced: 1 }),
  e: P({ jaw: .38, back: .58, mid: .35, blade: .2, tipY: .12, tipZ: .62, voiced: 1 }),            // unrounded, from the back
  'ê': P({ jaw: .38, spread: .3, back: .3, mid: .62, blade: .5, tipY: .3, tipZ: .7, voiced: 1 }),
  i: P({ jaw: .12, spread: .8, back: .5, mid: .95, blade: .85, tipY: .4, tipZ: .72, voiced: 1 }),
  u: P({ jaw: .18, round: 1, back: .88, mid: .4, blade: .15, tipY: .1, tipZ: .62, voiced: 1 }),
  'ü': P({ jaw: .12, round: .95, back: .5, mid: .95, blade: .85, tipY: .4, tipZ: .72, voiced: 1 }), // "ee" tongue, "oo" lips
  iz: P({ jaw: .1, spread: .5, back: .3, mid: .5, blade: .72, tipY: .75, tipZ: .74, groove: .3, voiced: 1 }),
  ir: P({ jaw: .14, round: .2, back: .35, mid: .6, blade: .62, tipY: .72, tipZ: .62, sides: .4, voiced: 1 }),
  er: P({ jaw: .32, round: .25, back: .55, mid: .6, blade: .45, tipY: .55, tipZ: .6, sides: .8, voiced: 1 }),
  n: P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3, voiced: 1, nasal: 1 }),
  ng: P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .66, voiced: 1, nasal: 1 }),
};

// id, spelling, group, how, params, close (px where the mouth shuts, for stops), asp (big puff)
const INITIALS = [
  ['b', 'lips', 'Lips together, then open with only a tiny puff. Voice stays off, so it sounds between English b and p.', P({ jaw: .1, lipsShut: 1 }), 470, 0],
  ['p', 'lips', 'Lips together, then pop open with a BIG puff of air. A tissue in front of the mouth would flutter.', P({ jaw: .1, lipsShut: 1 }), 470, 1],
  ['m', 'lips', 'Lips closed, voice on, the sound hums out of the nose.', P({ jaw: .1, lipsShut: 1, voiced: 1, nasal: 1 }), 0, 0],
  ['f', 'teethlip', 'Top teeth rest on the bottom lip. Blow a quiet stream of air.', P({ jaw: .2, teethLip: 1, air: 1 }), 0, 0],
  ['d', 'ridge', 'Tongue tip taps the bumpy ridge, tiny puff, voice off.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3 }), 436, 0],
  ['t', 'ridge', 'Same tap as d, with a BIG puff of air.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3 }), 436, 1],
  ['n', 'ridge', 'Tongue tip on the ridge, voice on, sound comes out of the nose.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3, voiced: 1, nasal: 1 }), 0, 0],
  ['l', 'ridge', 'Tongue tip up on the ridge, voice on, the sound slips out over the sides.', P({ jaw: .3, tipY: 1, tipZ: .74, blade: .5, mid: .2, back: .4, sides: -1, voiced: 1 }), 0, 0],
  ['g', 'back', 'Back of the tongue touches the soft roof, then lets go with a tiny puff. Voice off.', P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .68 }), 262, 0],
  ['k', 'back', 'Same as g, with a BIG puff of air.', P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .68 }), 262, 1],
  ['h', 'back', 'Back of the tongue comes close to the soft roof and the air scrapes through: rougher than English h.', P({ jaw: .3, back: .86, mid: .45, blade: .2, tipY: .15, tipZ: .66, air: 1 }), 0, 0],
  ['j', 'front', 'Tip down behind the lower teeth, front of the tongue presses on the roof, then lets go with a tiny hiss. Smile.', P({ jaw: .1, spread: .6, back: .45, mid: .9, blade: .95, tipY: .2, tipZ: .68, air: 1 }), 405, 0],
  ['q', 'front', 'Same as j, with a BIG puff of air.', P({ jaw: .1, spread: .6, back: .45, mid: .9, blade: .95, tipY: .2, tipZ: .68, air: 1 }), 405, 1],
  ['x', 'front', 'Same tongue as j but not touching: a soft hiss with a smile, like a gentle "sh".', P({ jaw: .1, spread: .6, back: .45, mid: .84, blade: .88, tipY: .2, tipZ: .68, air: 1 }), 0, 0],
  ['zh', 'palate', 'Curl the tongue tip up behind the ridge, press, then let go with a hiss. Tiny puff.', P({ jaw: .14, round: .3, back: .35, mid: .55, blade: .6, tipY: .95, tipZ: .64, sides: .5, air: 1 }), 425, 0],
  ['ch', 'palate', 'Same as zh, with a BIG puff of air.', P({ jaw: .14, round: .3, back: .35, mid: .55, blade: .6, tipY: .95, tipZ: .64, sides: .5, air: 1 }), 425, 1],
  ['sh', 'palate', 'Tongue tip curled up but not touching. Blow: "shh".', P({ jaw: .14, round: .3, back: .35, mid: .55, blade: .6, tipY: .8, tipZ: .64, sides: .5, air: 1 }), 0, 0],
  ['r', 'palate', 'Tongue curled like sh, voice on, very little hiss: between English r and the s in "measure".', P({ jaw: .16, round: .3, back: .4, mid: .55, blade: .55, tipY: .75, tipZ: .63, sides: .6, voiced: 1 }), 0, 0],
  ['z', 'hiss', 'Flat tongue: tip right behind the upper teeth, press, then let go with a hiss. Tiny puff. Like "ds" in "beds".', P({ jaw: .08, spread: .5, tipY: .95, tipZ: .76, blade: .75, mid: .5, back: .3, groove: 1, air: 1 }), 446, 0],
  ['c', 'hiss', 'Like "ts" in "cats", with a BIG puff of air.', P({ jaw: .08, spread: .5, tipY: .95, tipZ: .76, blade: .75, mid: .5, back: .3, groove: 1, air: 1 }), 446, 1],
  ['s', 'hiss', 'Flat tongue, teeth nearly closed: a thin hiss like English s.', P({ jaw: .08, spread: .5, tipY: .85, tipZ: .74, blade: .75, mid: .5, back: .3, groove: 1, air: 1 }), 0, 0],
];

// id, shown as, vowel targets in order, group, how
const FINALS = [
  ['a', 'a', ['a'], 'vowel', 'Mouth wide open, tongue low and relaxed.'],
  ['o', 'o', ['o'], 'vowel', 'Lips round. After b, p, m, f it sounds like "wo".'],
  ['e', 'e', ['e'], 'vowel', 'Mouth half open, lips NOT round, tongue pulled back: like "uh" said from the throat.'],
  ['i', 'i', ['i'], 'vowel', 'Big smile, tongue high and forward, like "ee".'],
  ['u', 'u', ['u'], 'vowel', 'Lips in a small tight circle, like "oo".'],
  ['ü', 'ü', ['ü'], 'vowel', 'Say "ee", then round your lips without moving your tongue. After j, q, x and y it is written u.'],
  ['iz', '-i (zi ci si)', ['iz'], 'hiss', 'After z, c, s: keep the tongue where it was and just buzz. It is not "ee"!'],
  ['ir', '-i (zhi chi shi ri)', ['ir'], 'palate', 'After zh, ch, sh, r: keep the tongue curled and buzz. It is not "ee"!'],
  ['er', 'er', ['er'], 'palate', 'Say "e" and curl the tongue tip up and back, like "er".'],
  ['ai', 'ai', ['a', 'i'], 'vowel', 'Open "a" gliding to "i": like "eye".'],
  ['ei', 'ei', ['ê', 'i'], 'vowel', 'Like "ay" in "day".'],
  ['ao', 'ao', ['a', 'u'], 'vowel', 'Open "a" gliding to round lips: like "ow" in "cow".'],
  ['ou', 'ou', ['o', 'u'], 'vowel', 'Like "oh", lips getting rounder.'],
  ['ia', 'ia', ['i', 'a'], 'vowel', 'Quick "i" sliding into "a": "yah".'],
  ['ie', 'ie', ['i', 'ê'], 'vowel', 'Quick "i" into "e" as in "yes".'],
  ['iao', 'iao', ['i', 'a', 'u'], 'vowel', '"i" then "ao": "yow".'],
  ['iu', 'iu', ['i', 'o', 'u'], 'vowel', 'Really "iou": "yo" with round lips at the end.'],
  ['ua', 'ua', ['u', 'a'], 'vowel', 'Round lips opening to "a": "wah".'],
  ['uo', 'uo', ['u', 'o'], 'vowel', '"u" into "o": "waw".'],
  ['uai', 'uai', ['u', 'a', 'i'], 'vowel', '"u", "a", "i" in one sweep: "why".'],
  ['ui', 'ui', ['u', 'ê', 'i'], 'vowel', 'Really "uei": "way".'],
  ['üe', 'üe', ['ü', 'ê'], 'vowel', '"ü" into "e".'],
  ['an', 'an', ['a', 'n'], 'ridge', 'Open "a", then the tongue TIP goes up to the ridge (front nasal).'],
  ['en', 'en', ['e', 'n'], 'ridge', 'Relaxed "e", then the tongue tip goes up to the ridge.'],
  ['in', 'in', ['i', 'n'], 'ridge', 'Smile "i", then the tongue tip goes up.'],
  ['ian', 'ian', ['i', 'ê', 'n'], 'ridge', '"i" then "en", as in "yen". The a sounds like e here.'],
  ['uan', 'uan', ['u', 'a', 'n'], 'ridge', '"wan".'],
  ['un', 'un', ['u', 'e', 'n'], 'ridge', 'Really "uen": "wun".'],
  ['üan', 'üan', ['ü', 'ê', 'n'], 'ridge', '"ü" into "en".'],
  ['ün', 'ün', ['ü', 'n'], 'ridge', '"ü", then the tongue tip goes up.'],
  ['ang', 'ang', ['a', 'ng'], 'back', 'Open "a", then the BACK of the tongue lifts (back nasal), like "ah-ng".'],
  ['eng', 'eng', ['e', 'ng'], 'back', '"e", then the back of the tongue lifts.'],
  ['ing', 'ing', ['i', 'ng'], 'back', 'Smile "i", then the back of the tongue lifts.'],
  ['ong', 'ong', ['u', 'ng'], 'back', 'Round "u", then the back of the tongue lifts.'],
  ['iang', 'iang', ['i', 'a', 'ng'], 'back', '"i" then "ang".'],
  ['iong', 'iong', ['ü', 'ng'], 'back', 'Round "ü" into "ng".'],
  ['uang', 'uang', ['u', 'a', 'ng'], 'back', '"wahng".'],
  ['ueng', 'ueng', ['u', 'e', 'ng'], 'back', '"wung" (written weng).'],
];
const TONE_HOW = {
  1: 'High and flat, like singing a long high note: mā.',
  2: 'Rising, like asking "what?": má.',
  3: 'Dips low, then comes up a little. In a sentence it often just stays low: mǎ.',
  4: 'Falls sharply, like a firm "No!": mà.',
  5: 'Light and short, with no special pitch: ma.',
};

// ---------- pinyin ----------
const INI = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];
const YW = {
  yi: 'i', yin: 'in', ying: 'ing', yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün', ya: 'ia', ye: 'ie', yao: 'iao', you: 'iu',
  yan: 'ian', yang: 'iang', yong: 'iong', wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'ui', wan: 'uan', wen: 'un',
  wang: 'uang', weng: 'ueng',
};
const FIN_IDS = new Set(FINALS.map((f) => f[0]));

export function parseSyllable(raw) {
  let s = raw.toLowerCase().replace(/u:|v/g, 'ü').replace(/[^a-zü1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, '');
  let tone = 5;
  const m = s.match(/[1-5]$/);
  if (m) { tone = +m[0]; s = s.slice(0, -1); }
  s = [...s].map((c) => { if (UNMARK[c]) { tone = UNMARK[c][1]; return UNMARK[c][0]; } return c; }).join('');
  if (!s) return null;
  const ini = INI.find((i) => s.startsWith(i) && s.length > i.length) || '';
  const spelled = s.slice(ini.length);
  let fin = spelled;
  if (!ini && YW[s]) fin = YW[s];
  else if (['j', 'q', 'x'].includes(ini) && fin.startsWith('u')) fin = 'ü' + fin.slice(1);
  if (fin === 'i' && ['z', 'c', 's'].includes(ini)) fin = 'iz';
  if (fin === 'i' && ['zh', 'ch', 'sh', 'r'].includes(ini)) fin = 'ir';
  if (fin === 'ue') fin = 'üe';
  if (!FIN_IDS.has(fin)) return null;
  return { ini, fin, tone, spelled };
}
// Put the tone mark on the right vowel: a or e first, then the o of "ou", otherwise the last vowel.
export function markTone(spelled, tone) {
  if (tone < 1 || tone > 4) return spelled;
  const s = spelled;
  let at = s.indexOf('a');
  if (at < 0) at = s.indexOf('e');
  if (at < 0 && s.includes('ou')) at = s.indexOf('o');
  if (at < 0) { for (let i = s.length - 1; i >= 0; i--) if ('iouü'.includes(s[i])) { at = i; break; } }
  if (at < 0) return s;
  return s.slice(0, at) + MARKS[s[at]][tone - 1] + s.slice(at + 1);
}
// 3rd tone before a 3rd tone is said as a 2nd tone (你好 is said ní hǎo).
function sandhi(tones) {
  const out = [...tones];
  for (let i = out.length - 2; i >= 0; i--) if (tones[i] === 3 && tones[i + 1] === 3) out[i] = 2;
  return out;
}

// Build full word info from characters + numbered pinyin.
export function makeWord(hanzi, pinyin, gloss = '', custom = false) {
  const parts = pinyin.trim().replace(/([1-5])(?=[a-zü])/gi, '$1 ').split(/[\s']+/).filter(Boolean);
  const syl = parts.map(parseSyllable).filter(Boolean);
  if (!syl.length) return { word: hanzi || pinyin, hanzi, pinyin, gloss, segs: [], syl: [], zh: true, custom };
  const chars = [...(hanzi || '')];
  const spoken = sandhi(syl.map((s) => s.tone));
  const segs = [];
  syl.forEach((s, k) => {
    s.hz = chars.length === syl.length ? chars[k] : '';
    s.spoken = spoken[k];
    s.py = (s.ini || '') + markTone(s.spelled, s.tone);
    if (s.ini) segs.push({ g: s.ini, p: ['zh_' + s.ini], syl: k });
    segs.push({ g: markTone(s.spelled, s.tone), p: ['zh_' + s.fin, 'zh_t' + s.tone], syl: k, tone: s.tone, spoken: s.spoken });
  });
  return { word: hanzi || pinyin, hanzi: hanzi || '', pinyin: syl.map((s) => s.py).join(' '), gloss, segs, syl, zh: true, custom };
}
// Words typed by a grown-up: "书 shu1", "shū", "书 shū", "xiao3 gou3".
export function parseTyped(text) {
  const t = text.trim();
  const hz = (t.match(/[㐀-鿿]/g) || []).join('');
  const py = t.replace(/[㐀-鿿]/g, ' ').trim();
  return makeWord(hz, py, '', true);
}

// ---------- words ----------
const DECKS = [
  ['first', 'First words', 'The survey words: every initial, the tricky finals and the four tones.', [
    ['爸', 'ba4', 'dad'], ['跑', 'pao3', 'run'], ['猫', 'mao1', 'cat'], ['飞', 'fei1', 'fly'], ['大', 'da4', 'big'],
    ['兔', 'tu4', 'rabbit'], ['牛', 'niu2', 'cow'], ['蓝', 'lan2', 'blue'], ['狗', 'gou3', 'dog'], ['哭', 'ku1', 'cry'],
    ['花', 'hua1', 'flower'], ['鸡', 'ji1', 'chicken'], ['七', 'qi1', 'seven'], ['西瓜', 'xi1 gua1', 'watermelon'],
    ['猪', 'zhu1', 'pig'], ['吃', 'chi1', 'eat'], ['书', 'shu1', 'book'], ['热', 're4', 'hot'], ['走', 'zou3', 'walk'],
    ['草', 'cao3', 'grass'], ['四', 'si4', 'four'], ['鱼', 'yu2', 'fish'], ['山', 'shan1', 'mountain'], ['糖', 'tang2', 'candy'],
    ['心', 'xin1', 'heart'], ['星', 'xing1', 'star'], ['二', 'er4', 'two'], ['妈', 'ma1', 'mum'], ['麻', 'ma2', 'numb, tingly'],
    ['马', 'ma3', 'horse'], ['骂', 'ma4', 'scold'],
  ]],
  ['asp', 'Puff or no puff', 'b/p, d/t, g/k: the same mouth, but p, t, k come with a big puff of air.', [
    ['包', 'bao1', 'bun'], ['跑', 'pao3', 'run'], ['爸爸', 'ba4 ba5', 'dad'], ['怕', 'pa4', 'scared'], ['大', 'da4', 'big'],
    ['他', 'ta1', 'he'], ['弟弟', 'di4 di5', 'little brother'], ['踢', 'ti1', 'kick'], ['哥哥', 'ge1 ge5', 'big brother'],
    ['渴', 'ke3', 'thirsty'], ['狗', 'gou3', 'dog'], ['口', 'kou3', 'mouth'], ['鼻子', 'bi2 zi5', 'nose'],
    ['苹果', 'ping2 guo3', 'apple'], ['肚子', 'du4 zi5', 'tummy'], ['桃子', 'tao2 zi5', 'peach'], ['高', 'gao1', 'tall'], ['看', 'kan4', 'look'],
  ]],
  ['flatcurl', 'Flat or curled tongue', 'z, c, s (flat tongue) against zh, ch, sh, r (curled tongue).', [
    ['字', 'zi4', 'character'], ['纸', 'zhi3', 'paper'], ['菜', 'cai4', 'vegetables'], ['茶', 'cha2', 'tea'],
    ['三', 'san1', 'three'], ['山', 'shan1', 'mountain'], ['四', 'si4', 'four'], ['十', 'shi2', 'ten'], ['早', 'zao3', 'early'],
    ['找', 'zhao3', 'look for'], ['草', 'cao3', 'grass'], ['炒', 'chao3', 'stir-fry'], ['日', 'ri4', 'sun, day'],
    ['人', 'ren2', 'person'], ['说', 'shuo1', 'speak'], ['坐', 'zuo4', 'sit'], ['是', 'shi4', 'yes, is'],
  ]],
  ['jqx', 'j, q, x and ü', 'Smiley-tongue sounds, and the round-lipped ü.', [
    ['鸡', 'ji1', 'chicken'], ['七', 'qi1', 'seven'], ['西', 'xi1', 'west'], ['家', 'jia1', 'home'], ['去', 'qu4', 'go'],
    ['学', 'xue2', 'learn'], ['鱼', 'yu2', 'fish'], ['雨', 'yu3', 'rain'], ['女', 'nv3', 'girl'], ['绿', 'lv4', 'green'],
    ['小', 'xiao3', 'small'], ['谢谢', 'xie4 xie5', 'thank you'], ['球', 'qiu2', 'ball'], ['九', 'jiu3', 'nine'],
  ]],
  ['nasal', 'an or ang', 'Front nasals (tongue tip up: an en in) against back nasals (back of tongue: ang eng ing ong).', [
    ['山', 'shan1', 'mountain'], ['上', 'shang4', 'up'], ['门', 'men2', 'door'], ['梦', 'meng4', 'dream'], ['心', 'xin1', 'heart'],
    ['星', 'xing1', 'star'], ['饭', 'fan4', 'rice, meal'], ['房', 'fang2', 'house'], ['云', 'yun2', 'cloud'], ['红', 'hong2', 'red'],
    ['熊', 'xiong2', 'bear'], ['冷', 'leng3', 'cold'], ['糖', 'tang2', 'candy'], ['船', 'chuan2', 'boat'], ['晚安', "wan3 an1", 'good night'],
  ]],
  ['tones', 'Tones', 'Same sounds, different pitch, different meaning. Watch the pitch line.', [
    ['妈', 'ma1', 'mum'], ['麻', 'ma2', 'numb, tingly'], ['马', 'ma3', 'horse'], ['骂', 'ma4', 'scold'], ['吗', 'ma5', '(question word)'],
    ['汤', 'tang1', 'soup'], ['糖', 'tang2', 'candy'], ['躺', 'tang3', 'lie down'], ['烫', 'tang4', 'very hot'],
    ['衣', 'yi1', 'clothes'], ['椅', 'yi3', 'chair'], ['意', 'yi4', 'meaning'],
    ['你好', 'ni3 hao3', 'hello'], ['小狗', 'xiao3 gou3', 'puppy'], ['老虎', 'lao3 hu3', 'tiger'],
  ]],
  ['everyday', 'Everyday words', 'Family, greetings and things to say every day.', [
    ['你好', 'ni3 hao3', 'hello'], ['谢谢', 'xie4 xie5', 'thank you'], ['再见', 'zai4 jian4', 'goodbye'], ['爸爸', 'ba4 ba5', 'dad'],
    ['妈妈', 'ma1 ma5', 'mum'], ['爷爷', 'ye2 ye5', 'grandpa'], ['奶奶', 'nai3 nai5', 'grandma'], ['朋友', 'peng2 you5', 'friend'],
    ['老师', 'lao3 shi1', 'teacher'], ['学校', 'xue2 xiao4', 'school'], ['喝水', 'he1 shui3', 'drink water'], ['我', 'wo3', 'I, me'],
  ]],
];

const SURVEY_ITEMS = [
  ['爸', ['b']], ['跑', ['p']], ['猫', ['m']], ['飞', ['f']], ['大', ['d']], ['兔', ['t']], ['牛', ['n']], ['蓝', ['l']],
  ['狗', ['g']], ['哭', ['k']], ['花', ['h']], ['鸡', ['j']], ['七', ['q']], ['西瓜', ['x']], ['猪', ['zh']], ['吃', ['ch', 'ir']],
  ['书', ['sh']], ['热', ['r']], ['走', ['z']], ['草', ['c']], ['四', ['s', 'iz']], ['鱼', ['ü']], ['山', ['an']], ['糖', ['ang']],
  ['心', ['in']], ['星', ['ing']], ['二', ['er']], ['妈', ['t1']], ['麻', ['t2']], ['马', ['t3']], ['骂', ['t4']],
];

const VIDEO_TOPICS = [
  { id: 'tones', title: 'The four tones', sounds: ['zh_t1', 'zh_t2', 'zh_t3', 'zh_t4'] },
  { id: 'asp', title: 'Puff or no puff (b/p, d/t, g/k)', sounds: ['zh_b', 'zh_p', 'zh_d', 'zh_t', 'zh_g', 'zh_k'] },
  { id: 'flatcurl', title: 'Flat tongue z c s, curled tongue zh ch sh r', sounds: ['zh_z', 'zh_c', 'zh_s', 'zh_zh', 'zh_ch', 'zh_sh', 'zh_r', 'zh_iz', 'zh_ir'] },
  { id: 'jqx', title: 'j, q, x and ü', sounds: ['zh_j', 'zh_q', 'zh_x', 'zh_ü', 'zh_üe', 'zh_ün'] },
  { id: 'nasal', title: 'Nasal finals: an or ang', sounds: ['zh_an', 'zh_ang', 'zh_en', 'zh_eng', 'zh_in', 'zh_ing', 'zh_ong'] },
];
const VIDEOS = [
  { id: 'cZvYEXvXzXw', topic: 'tones', who: 'kids', title: 'How to pronounce the 4 Mandarin tones (with a tone quiz)', by: 'Mandarin teacher' },
  { id: 'g1u4cxUDXgU', topic: 'tones', who: 'beginners', title: 'Learn Chinese tones: 4 tones + neutral tone', by: 'Mandarin teacher' },
  { id: 'wVWGIoVEkHs', topic: 'tones', who: 'kids', title: 'Learn Chinese tones in less than 3 minutes', by: 'Mandarin teacher' },
  { id: 'qgL7NrduGJc', topic: 'tones', who: 'beginners', title: 'The tones in Mandarin Chinese (HSK 1)', by: 'Mandarin teacher' },
  { id: 'TUV7PSxPSOA', topic: 'asp', who: 'beginners', title: 'Chinese pronunciation: aspirated and non-aspirated sounds', by: 'Mandarin teacher' },
  { id: 'DJdQ_Ntl_9Y', topic: 'asp', who: 'adults', title: 'p, t, k and b, d, g at the start of a word', by: 'Pronunciation teacher' },
  { id: 'tvarbv--XLA', topic: 'asp', who: 'beginners', title: 'How to pronounce G and K in Chinese', by: 'Mandarin teacher' },
  { id: 'AAnEKm45R9M', topic: 'flatcurl', who: 'adults', title: 'Z, C, S, Zh, Ch, Sh, R in Mandarin (beginner guide)', by: 'Mandalion Chinese' },
  { id: 'C-S4Hjaqoo8', topic: 'flatcurl', who: 'adults', title: 'Pronunciation training: z, c, s, zh, ch, sh, r', by: 'Mandarin teacher' },
  { id: 'lyMC6afGOUA', topic: 'flatcurl', who: 'beginners', title: 'How to pronounce ZH, CH, J, Q, Z, C (lesson 7)', by: 'Mandarin teacher' },
  { id: 'nSxKrNQ5iC4', topic: 'flatcurl', who: 'beginners', title: 'Flat-tongue sounds z c s, and back nasals', by: 'Mandarin teacher' },
  { id: 'FxIL11PcNXE', topic: 'jqx', who: 'beginners', title: 'Problem initials J, Q, X: how to say them', by: 'Mandarin teacher' },
  { id: 'b5loaUehhps', topic: 'jqx', who: 'beginners', title: 'The hidden ü sound in ju, qu, xu', by: 'Mandarin teacher' },
  { id: '1rfFlwAo1Gs', topic: 'jqx', who: 'kids', title: 'Pinyin lesson: j q x y + ü and tones', by: 'Mandarin teacher' },
  { id: 'fMbe4wjhExA', topic: 'jqx', who: 'adults', title: 'j/q/x vs z/c/s vs zh/ch/sh/r explained', by: 'Mandarin teacher' },
  { id: '_-AN2X789Ys', topic: 'nasal', who: 'beginners', title: 'Nasal finals: an, en, in, un, ün, ang, eng, ing, ong', by: "Vicky's Chinese class" },
  { id: '5CaPF8Sg5W8', topic: 'nasal', who: 'kids', title: 'Pinyin finals: ang, eng, ing, ong', by: 'Pinyin teacher' },
  { id: '5nKs4ZE62YE', topic: 'nasal', who: 'beginners', title: 'in and ing', by: 'Mandarin teacher' },
  { id: '2VQ-AV1mLrA', topic: 'nasal', who: 'beginners', title: 'ai, ao, an and ang', by: 'Mandarin teacher' },
];

// ---------- build the pack ----------
export function buildZh() {
  const sounds = {}, order = [];
  for (const [id, group, how, params, close, asp] of INITIALS) {
    const ex = DECKS[0][3].find(([, py]) => parseSyllable(py.split(' ')[0])?.ini === id);
    sounds['zh_' + id] = { id: 'zh_' + id, spell: id, label: `${id} as in ${ex ? ex[0] + ' ' + makeWord(ex[0], ex[1]).pinyin : id}`, group, how, params: { ...params, asp }, close, kind: 'initial' };
    order.push('zh_' + id);
  }
  for (const [id, shown, targets, group, how] of FINALS) {
    const seq = targets.map((t) => V[t]);
    sounds['zh_' + id] = { id: 'zh_' + id, spell: shown.split(' ')[0], label: `final ${shown}`, group, how, params: seq[0], seq, targets, close: 0, kind: 'final' };
    order.push('zh_' + id);
  }
  for (let t = 1; t <= 5; t++) {
    sounds['zh_t' + t] = { id: 'zh_t' + t, spell: ['', 'ˉ', 'ˊ', 'ˇ', 'ˋ', '·'][t], label: `tone ${t === 5 ? '0 (light)' : t}: ${TONE_NAMES[t]}`, group: 'tone', how: TONE_HOW[t], params: null, close: 0, kind: 'tone', tone: t };
    order.push('zh_t' + t);
  }
  const words = {}, decks = [];
  for (const [id, title, desc, list] of DECKS) {
    const keys = [];
    for (const [hz, py, gloss] of list) { if (!words[hz]) words[hz] = makeWord(hz, py, gloss); keys.push(hz); }
    decks.push({ id, title, desc, words: keys });
  }
  const survey = {
    id: 'quick-zh-1', title: 'Quick check (中文)', intro: 'Say each word out loud. Is it easy to say?',
    items: SURVEY_ITEMS.map(([w, focus]) => ({ key: 'zh:' + w, word: w, focus: focus.map((f) => 'zh_' + f) })),
  };
  return {
    sounds, order, words, decks, survey, videoTopics: VIDEO_TOPICS, videos: VIDEOS,
    refs: [
      { title: 'Seeing Speech (University of Glasgow)', url: 'https://www.seeingspeech.ac.uk/', note: 'Real ultrasound and MRI of tongues making each sound. Useful for zh / z / j tongue shapes.' },
      { title: 'Pink Trombone', url: 'https://dood.al/pinktrombone/', note: 'Play with a moving vocal tract and hear it. Try sliding the pitch for tones.' },
    ],
    info: (w) => parseTyped(w),
  };
}
