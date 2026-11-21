// Shared data for Felix's Sounds V2: colour groups, sounds, words, survey, videos.
// One colour per "way the mouth moves". The same colours are used on every tab.

export const GROUPS = {
  lips:   { name: 'Lips',            color: '#e8336d', tint: '#ffd9e5', blurb: 'Lips press or round' },
  teethlip:{ name: 'Teeth on lip',   color: '#f07b00', tint: '#ffe2c2', blurb: 'Top teeth touch bottom lip' },
  tth:    { name: 'Tongue + teeth',  color: '#b98900', tint: '#fff0b8', blurb: 'Tongue tip peeks out' },
  ridge:  { name: 'Tongue tip up',   color: '#1f6feb', tint: '#d6e6ff', blurb: 'Tongue tip taps the bumpy ridge' },
  hiss:   { name: 'Hissy air',       color: '#00a3a8', tint: '#c9f3f4', blurb: 'Narrow groove of air (S, Z)' },
  palate: { name: 'Tongue up + back',color: '#8a3ffc', tint: '#e7d9ff', blurb: 'Tongue bunches near the roof' },
  back:   { name: 'Back of tongue',  color: '#1f9d55', tint: '#cdf1dc', blurb: 'Back of tongue lifts to the soft roof' },
  throat: { name: 'Throat',          color: '#7b6f66', tint: '#e8e2dc', blurb: 'Just breath from the throat' },
  vowel:  { name: 'Open vowels',     color: '#5b6b82', tint: '#dde4ee', blurb: 'Mouth open, tongue floats' },
};

// Mouth parameters. jaw 0..1 open. back/mid/blade/tipY = tongue height 0 (low) .. 1 (touching roof).
// tipZ: where the tip points (0.66 behind lower teeth ... 1 between teeth). groove 0..1, sides -1..1.
const N = { jaw: .18, round: 0, spread: 0, lipsShut: 0, back: .25, mid: .25, blade: .2, tipY: .15, tipZ: .66,
  groove: 0, sides: 0, voiced: 0, nasal: 0, teethLip: 0, air: 0 };
const P = (o) => ({ ...N, ...o });

// id: [ipa, label, group, place+manner words, how-to sentence, example, params]
const RAW = [
  ['P',  'p',  'p as in pig',    'lips', 'Press both lips together, then pop them open with a puff of air.', P({ jaw: .1, lipsShut: 1 })],
  ['B',  'b',  'b as in bed',    'lips', 'Same as P but switch your voice on: lips pop open, throat buzzes.', P({ jaw: .1, lipsShut: 1, voiced: 1 })],
  ['M',  'm',  'm as in mom',    'lips', 'Lips closed, voice on, and the sound hums out of your nose.', P({ jaw: .1, lipsShut: 1, voiced: 1, nasal: 1 })],
  ['W',  'w',  'w as in web',    'lips', 'Round your lips into a small "oo" circle, then open them quickly.', P({ jaw: .25, round: .9, back: .75, mid: .4, voiced: 1 })],
  ['F',  'f',  'f as in fan',    'teethlip', 'Top teeth rest on your bottom lip. Blow a quiet stream of air.', P({ jaw: .2, teethLip: 1, air: 1 })],
  ['V',  'v',  'v as in van',    'teethlip', 'Same as F but turn your voice on. Feel the lip tickle.', P({ jaw: .2, teethLip: 1, voiced: 1, air: 1 })],
  ['TH', 'th', 'th as in thumb', 'tth', 'Tongue tip peeks out between your teeth. Blow air gently over it. No voice.', P({ jaw: .2, tipY: .95, tipZ: 1, blade: .35, mid: .3, air: 1 })],
  ['DH', 'th', 'th as in this',  'tth', 'Same tongue spot as thumb, but switch your voice on.', P({ jaw: .2, tipY: .95, tipZ: 1, blade: .35, mid: .3, voiced: 1, air: 1 })],
  ['T',  't',  't as in top',    'ridge', 'Tongue tip taps the bumpy ridge behind your top teeth. Quick puff, no voice.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3 })],
  ['D',  'd',  'd as in dog',    'ridge', 'Same tap as T, with your voice on.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3, voiced: 1 })],
  ['N',  'n',  'n as in nose',   'ridge', 'Tongue tip on the ridge, voice on, sound goes out through your nose.', P({ jaw: .2, tipY: 1, tipZ: .74, blade: .8, mid: .5, back: .3, voiced: 1, nasal: 1 })],
  ['L',  'l',  'l as in leg',    'ridge', 'Tongue tip up on the ridge. Voice on. The sound slips out over the sides of the tongue.', P({ jaw: .3, tipY: 1, tipZ: .74, blade: .5, mid: .2, back: .4, sides: -1, voiced: 1 })],
  ['S',  's',  's as in sun',    'hiss', 'Teeth almost touching, smile a little. Tongue tip rests just behind. Blow a thin cold stream like a snake.', P({ jaw: .08, spread: .6, tipY: .85, tipZ: .70, blade: .75, mid: .5, back: .3, groove: 1, air: 1 })],
  ['Z',  'z',  'z as in zoo',    'hiss', 'Same mouth as S but with your voice on, like a buzzing bee.', P({ jaw: .08, spread: .6, tipY: .85, tipZ: .70, blade: .75, mid: .5, back: .3, groove: 1, voiced: 1, air: 1 })],
  ['SH', 'sh', 'sh as in ship',  'palate', 'Lips pushed out a little, tongue pulled back and wide. Blow "shhh" like asking for quiet.', P({ jaw: .15, round: .5, tipY: .65, tipZ: .65, blade: .7, mid: .65, back: .35, sides: .6, air: 1 })],
  ['ZH', 'zh', 'si as in vision', 'palate', 'Same as SH with your voice on.', P({ jaw: .15, round: .5, tipY: .65, tipZ: .65, blade: .7, mid: .65, back: .35, sides: .6, voiced: 1, air: 1 })],
  ['CH', 'ch', 'ch as in chair', 'palate', 'Start like T, then slide into SH: a tiny stop and a hiss. No voice.', P({ jaw: .15, round: .5, tipY: .85, tipZ: .68, blade: .8, mid: .65, back: .35, sides: .6, air: 1 })],
  ['JH', 'j',  'j as in jump',   'palate', 'Same as CH with your voice on.', P({ jaw: .15, round: .5, tipY: .85, tipZ: .68, blade: .8, mid: .65, back: .35, sides: .6, voiced: 1, air: 1 })],
  ['R',  'r',  'r as in red',    'palate', 'Pull the tongue back and bunch it up. Sides of the tongue touch the upper back teeth. Tip does not touch anything.', P({ jaw: .25, round: .4, back: .6, mid: .65, blade: .5, tipY: .55, tipZ: .6, sides: 1, voiced: 1 })],
  ['Y',  'y',  'y as in yes',    'palate', 'Middle of the tongue rises toward the roof, smile a little, voice on.', P({ jaw: .2, spread: .5, back: .35, mid: .85, blade: .75, tipY: .3, tipZ: .7, voiced: 1 })],
  ['K',  'k',  'k as in cat',    'back', 'The back of your tongue lifts and touches the soft roof, then lets go with a puff. No voice.', P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .68 })],
  ['G',  'g',  'g as in go',     'back', 'Same as K with your voice on.', P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .68, voiced: 1 })],
  ['NG', 'ng', 'ng as in sing',  'back', 'Back of the tongue up like K, voice on, and the sound hums out of your nose.', P({ jaw: .25, back: 1, mid: .5, blade: .25, tipY: .15, tipZ: .68, voiced: 1, nasal: 1 })],
  ['H',  'h',  'h as in hat',    'throat', 'Open your mouth and breathe out, like fogging a mirror.', P({ jaw: .35, air: 1 })],
  // vowels: lips and jaw shape do the work
  ['IY', 'ee', 'ee as in see',   'vowel', 'Big smile, tongue high and forward.', P({ jaw: .15, spread: .8, back: .5, mid: .95, blade: .85, tipY: .4, tipZ: .72, voiced: 1 })],
  ['IH', 'i',  'i as in sit',    'vowel', 'Relaxed smile, tongue a little lower than "ee".', P({ jaw: .25, spread: .4, mid: .8, blade: .65, tipY: .35, tipZ: .7, voiced: 1 })],
  ['EH', 'e',  'e as in bed',    'vowel', 'Mouth half open, tongue in the middle.', P({ jaw: .4, mid: .6, blade: .5, tipY: .3, tipZ: .7, voiced: 1 })],
  ['AE', 'a',  'a as in cat',    'vowel', 'Mouth wide open, tongue low and forward.', P({ jaw: .6, spread: .3, mid: .4, blade: .3, back: .2, tipY: .2, tipZ: .7, voiced: 1 })],
  ['AH', 'u',  'u as in cup',    'vowel', 'Lazy, relaxed mouth. Tongue rests in the middle.', P({ jaw: .4, mid: .35, tipZ: .66, voiced: 1 })],
  ['AA', 'o',  'o as in hot',    'vowel', 'Open wide like at the doctor, tongue low and back.', P({ jaw: .8, back: .2, mid: .15, blade: .1, tipY: .1, tipZ: .6, voiced: 1 })],
  ['AO', 'aw', 'aw as in dog',   'vowel', 'Open, with lips a little round.', P({ jaw: .6, round: .6, back: .45, mid: .2, blade: .1, tipY: .1, tipZ: .6, voiced: 1 })],
  ['UH', 'oo', 'oo as in book',  'vowel', 'Lips a little round, tongue pulled back.', P({ jaw: .3, round: .6, back: .65, mid: .35, tipY: .15, tipZ: .62, voiced: 1 })],
  ['UW', 'oo', 'oo as in boot',  'vowel', 'Lips in a small tight circle, tongue high at the back.', P({ jaw: .2, round: 1, back: .85, mid: .4, blade: .15, tipY: .1, tipZ: .62, voiced: 1 })],
  ['ER', 'er', 'er as in bird',  'vowel', 'Tongue bunched like R, mouth half open.', P({ jaw: .3, round: .3, back: .55, mid: .6, blade: .45, tipY: .5, tipZ: .6, sides: .8, voiced: 1 })],
  ['EY', 'ay', 'ay as in cake',  'vowel', 'Starts like "e" and glides toward "ee".', P({ jaw: .35, spread: .3, mid: .7, blade: .55, tipY: .3, tipZ: .7, voiced: 1 })],
  ['AY', 'eye','i as in kite',   'vowel', 'Starts wide open like "ah" and glides up toward "ee".', P({ jaw: .7, back: .25, mid: .3, blade: .2, tipY: .15, tipZ: .66, voiced: 1 })],
  ['OW', 'oh', 'o as in boat',   'vowel', 'Lips round into an "o" shape and the tongue pulls back.', P({ jaw: .45, round: .8, back: .6, mid: .3, tipY: .1, tipZ: .6, voiced: 1 })],
  ['AW', 'ow', 'ow as in cow',   'vowel', 'Starts open like "ah", then lips round toward "oo".', P({ jaw: .7, round: .3, back: .3, mid: .2, tipY: .1, tipZ: .62, voiced: 1 })],
  ['OY', 'oy', 'oy as in boy',   'vowel', 'Starts round like "aw", then glides to "ee".', P({ jaw: .55, round: .5, back: .4, mid: .25, tipY: .1, tipZ: .62, voiced: 1 })],
];

export const SOUNDS = {};
export const SOUND_ORDER = [];
for (const [id, spell, label, group, how, params] of RAW) {
  SOUNDS[id] = { id, spell, label, group, how, params };
  SOUND_ORDER.push(id);
}
export const REST = { ...N };

export function groupOf(pid) { return GROUPS[SOUNDS[pid]?.group] || GROUPS.vowel; }
export function colorOf(pid) { return pid && SOUNDS[pid] ? groupOf(pid).color : '#a9a29b'; }

// ---------- Words (letters -> sounds, hand-segmented) ----------
// "s|S u|AH n|N": each piece is spelling|SOUND(S). "-" = silent letters.
const DECKS_RAW = [
  ['first', 'First words', 'The 27 survey words. A good place to start.', `
mom: m|M o|AA m|M
pig: p|P i|IH g|G
bed: b|B e|EH d|D
web: w|W e|EH b|B
fan: f|F a|AE n|N
van: v|V a|AE n|N
thumb: th|TH u|AH m|M b|-
this: th|DH i|IH s|S
top: t|T o|AA p|P
dog: d|D o|AO g|G
nose: n|N o|OW s|Z e|-
sun: s|S u|AH n|N
zoo: z|Z oo|UW
leg: l|L e|EH g|G
ship: sh|SH i|IH p|P
chair: ch|CH ai|EH r|R
jump: j|JH u|AH m|M p|P
red: r|R e|EH d|D
yes: y|Y e|EH s|S
cat: c|K a|AE t|T
go: g|G o|OW
sing: s|S i|IH ng|NG
hat: h|H a|AE t|T
spoon: s|S p|P oo|UW n|N
tree: t|T r|R ee|IY
plane: p|P l|L a|EY n|N e|-
cats: c|K a|AE t|T s|S`],
  ['sz', 'S and Z (hissy)', 'Snake sounds at the start, middle and end of words.', `
sock: s|S o|AA ck|K
sit: s|S i|IH t|T
soup: s|S ou|UW p|P
six: s|S i|IH x|K S
bus: b|B u|AH s|S
zip: z|Z i|IH p|P
buzz: b|B u|AH zz|Z
rice: r|R i|AY c|S e|-
glass: g|G l|L a|AE ss|S
snake: s|S n|N a|EY k|K e|-
star: s|S t|T ar|AA R
sky: s|S k|K y|AY
smile: s|S m|M i|AY l|L e|-
swim: s|S w|W i|IH m|M
stop: s|S t|T o|AA p|P
rose: r|R o|OW s|Z e|-
house: h|H ou|AW s|S e|-
sink: s|S i|IH n|N k|K
bees: b|B ee|IY s|Z
kiss: k|K i|IH ss|S`],
  ['rl', 'R and L', 'Tongue-back R sounds and tongue-tip L sounds.', `
rain: r|R ai|EY n|N
run: r|R u|AH n|N
rabbit: r|R a|AE bb|B i|IH t|T
ring: r|R i|IH ng|NG
car: c|K ar|AA R
bear: b|B ear|EH R
door: d|D oor|AO R
light: l|L igh|AY t|T
lion: l|L i|AY o|AH n|N
yellow: y|Y e|EH ll|L ow|OW
ball: b|B a|AO ll|L
milk: m|M i|IH l|L k|K
blue: b|B l|L ue|UW
bread: b|B r|R ea|EH d|D
green: g|G r|R ee|IY n|N
frog: f|F r|R o|AO g|G
clown: c|K l|L ow|AW n|N
drum: d|D r|R u|AH m|M
bird: b|B ir|ER d|D
girl: g|G ir|ER l|L`],
  ['th', 'TH sounds', 'Tongue peeks out: voiced (this) and unvoiced (thumb).', `
think: th|TH i|IH n|N k|K
three: th|TH r|R ee|IY
bath: b|B a|AE th|TH
mouth: m|M ou|AW th|TH
that: th|DH a|AE t|T
mother: m|M o|AH th|DH er|ER
brother: b|B r|R o|AH th|DH er|ER
feather: f|F ea|EH th|DH er|ER
the: th|DH e|AH
teeth: t|T ee|IY th|TH
with: w|W i|IH th|TH
thank: th|TH a|AE n|N k|K`],
  ['shchj', 'SH, CH and J', 'Round-lip, tongue-back sounds.', `
shoe: sh|SH oe|UW
fish: f|F i|IH sh|SH
sheep: sh|SH ee|IY p|P
wash: w|W a|AA sh|SH
chin: ch|CH i|IH n|N
cheese: ch|CH ee|IY s|Z e|-
watch: w|W a|AA tch|CH
chicken: ch|CH i|IH ck|K e|AH n|N
jelly: j|JH e|EH ll|L y|IY
juice: j|JH ui|UW c|S e|-
orange: o|AO r|R a|IH n|N g|JH e|-
bridge: b|B r|R i|IH dg|JH e|-`],
  ['fv', 'F and V', 'Top teeth on the bottom lip.', `
leaf: l|L ea|IY f|F
off: o|AO ff|F
five: f|F i|AY v|V e|-
love: l|L o|AH v|V e|-
glove: g|G l|L o|AH v|V e|-
river: r|R i|IH v|V er|ER
very: v|V e|EH r|R y|IY
foot: f|F oo|UH t|T
phone: ph|F o|OW n|N e|-`],
  ['kgtd', 'K, G, T and D', 'Stop sounds, from the front and the back of the mouth.', `
cake: c|K a|EY k|K e|-
duck: d|D u|AH ck|K
goat: g|G oa|OW t|T
tiger: t|T i|AY g|G er|ER
tooth: t|T oo|UW th|TH
kite: k|K i|AY t|T e|-
goose: g|G oo|UW s|S e|-
gift: g|G i|IH f|F t|T
bike: b|B i|AY k|K e|-
table: t|T a|EY b|B l|L e|-`],
  ['blends', 'Blends and endings', 'Sounds squeezed together, and sounds at the end.', `
grass: g|G r|R a|AE ss|S
flag: f|F l|L a|AE g|G
snow: s|S n|N ow|OW
sticks: s|S t|T i|IH ck|K s|S
nest: n|N e|EH s|S t|T
hand: h|H a|AE n|N d|D
jumps: j|JH u|AH m|M p|P s|S
lamp: l|L a|AE m|M p|P
crab: c|K r|R a|AE b|B
spider: s|S p|P i|AY d|D er|ER
train: t|T r|R ai|EY n|N`],
  ['vowels', 'Vowel pairs', 'Short and long vowels: how the lips and jaw change.', `
bit: b|B i|IH t|T
beat: b|B ea|IY t|T
bat: b|B a|AE t|T
bet: b|B e|EH t|T
cup: c|K u|AH p|P
cot: c|K o|AA t|T
book: b|B oo|UH k|K
boot: b|B oo|UW t|T
boy: b|B oy|OY
cow: c|K ow|AW
boat: b|B oa|OW t|T
pen: p|P e|EH n|N`],
];

export const WORDS = {};
export const DECKS = [];
// the sound list in "x|K S" is written with a space; allow both "K S" and "K+S"
function parseLine(line) {
  const i = line.indexOf(':');
  const word = line.slice(0, i).trim();
  const body = line.slice(i + 1).trim().replace(/\|([A-Z]+) ([A-Z]+)(?= |$)/g, (m, a, b, off, s) => `|${a}+${b}`);
  const segs = body.split(/\s+/).map((tok) => {
    const [g, p] = tok.split('|');
    return { g, p: p === '-' ? [] : p.split('+') };
  });
  return { word, segs };
}
for (const [id, title, desc, block] of DECKS_RAW) {
  const words = [];
  for (const line of block.trim().split('\n')) {
    const { word, segs } = parseLine(line);
    if (!WORDS[word]) WORDS[word] = { word, segs, custom: false };
    words.push(word);
  }
  DECKS.push({ id, title, desc, words });
}

// Rough spelling-to-sound guess for words typed in by a grown-up. Marked approximate in the UI.
const G2P = [
  ['tch', 'CH'], ['sh', 'SH'], ['ch', 'CH'], ['th', 'TH'], ['ng', 'NG'], ['ck', 'K'], ['ph', 'F'], ['wh', 'W'],
  ['qu', 'K+W'], ['ee', 'IY'], ['ea', 'IY'], ['oo', 'UW'], ['ai', 'EY'], ['ay', 'EY'], ['oa', 'OW'], ['ow', 'OW'],
  ['ou', 'AW'], ['ar', 'AA+R'], ['or', 'AO+R'], ['er', 'ER'], ['ir', 'ER'], ['ur', 'ER'], ['oy', 'OY'], ['ll', 'L'],
  ['ss', 'S'], ['ff', 'F'], ['zz', 'Z'], ['a', 'AE'], ['b', 'B'], ['c', 'K'], ['d', 'D'], ['e', 'EH'], ['f', 'F'],
  ['g', 'G'], ['h', 'H'], ['i', 'IH'], ['j', 'JH'], ['k', 'K'], ['l', 'L'], ['m', 'M'], ['n', 'N'], ['o', 'AA'],
  ['p', 'P'], ['q', 'K'], ['r', 'R'], ['s', 'S'], ['t', 'T'], ['u', 'AH'], ['v', 'V'], ['w', 'W'], ['x', 'K+S'],
  ['y', 'Y'], ['z', 'Z'],
];
export function guessSegments(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const segs = [];
  let i = 0;
  while (i < w.length) {
    let hit = null;
    for (const [g, p] of G2P) if (w.startsWith(g, i)) { hit = [g, p]; break; }
    if (!hit) { i++; continue; }
    const last = i + hit[0].length >= w.length;
    if (hit[0] === 'e' && last && w.length > 3 && segs.length) segs.push({ g: 'e', p: [] });
    else segs.push({ g: hit[0], p: hit[1].split('+') });
    i += hit[0].length;
  }
  return segs;
}
export function wordInfo(word) {
  return WORDS[word] || { word, segs: guessSegments(word), custom: true };
}
export function soundsOf(word) {
  return wordInfo(word).segs.flatMap((s) => s.p);
}

// ---------- Survey ----------
// focus = the sounds this question is about. Answer: easy (0) or tricky (1).
export const SURVEY = {
  id: 'quick-1',
  title: 'Quick check',
  intro: 'Say each word out loud. Is it easy to say?',
  items: [
    ['mom', ['M']], ['pig', ['P']], ['bed', ['B']], ['web', ['W']], ['fan', ['F']], ['van', ['V']],
    ['thumb', ['TH']], ['this', ['DH']], ['top', ['T']], ['dog', ['D']], ['nose', ['N']], ['sun', ['S']],
    ['zoo', ['Z']], ['leg', ['L']], ['ship', ['SH']], ['chair', ['CH']], ['jump', ['JH']], ['red', ['R']],
    ['yes', ['Y']], ['cat', ['K']], ['go', ['G']], ['sing', ['NG']], ['hat', ['H']],
    ['spoon', ['S', 'P']], ['tree', ['T', 'R']], ['plane', ['P', 'L']], ['cats', ['S']],
  ].map(([word, focus]) => ({ key: word, word, focus })),
};

// ---------- Videos ----------
// sounds = which sounds the video helps with (used for ranking). who = who it is aimed at.
export const VIDEO_TOPICS = [
  { id: 'sz', title: 'S and Z (lisps)', sounds: ['S', 'Z'] },
  { id: 'r', title: 'R sounds', sounds: ['R', 'ER'] },
  { id: 'th', title: 'TH sounds', sounds: ['TH', 'DH'] },
  { id: 'shch', title: 'SH, CH and J', sounds: ['SH', 'CH', 'JH', 'ZH'] },
  { id: 'zh', title: 'Mandarin and English side by side', sounds: ['S', 'SH', 'Z', 'CH', 'JH', 'R'] },
];
export const VIDEOS = [
  { id: 'NZEeX6yGQkg', topic: 'sz', who: 'parents', title: 'How to say S at home: toddler lisp with hand cues', by: 'Kelli Meyer, SLP' },
  { id: 'snco7-AVznA', topic: 'sz', who: 'kids', title: 'Master the S sound: 3 tricks from a speech therapist', by: 'Speech therapist' },
  { id: 'dCgSSukmeA8', topic: 'sz', who: 'kids', title: 'Easy trick for teaching /s/ (straw cue)', by: 'Speech therapist' },
  { id: 'xDTTKlgVm7A', topic: 'sz', who: 'parents', title: 'What does an interdental lisp look and sound like?', by: 'Speech therapist' },
  { id: '2zEIDksJae8', topic: 'r', who: 'parents', title: 'Tips and techniques to help your child improve their /r/', by: 'Speech therapist' },
  { id: '2Yw0PQDApp4', topic: 'r', who: 'kids', title: 'Tongue placement for R: "Taco Tongue"', by: 'Peachie Speechie' },
  { id: 'HcrVeMYnOS4', topic: 'r', who: 'older kids', title: 'Bunched R vs retroflex R', by: 'Peachie Speechie' },
  { id: 'Rf_GxHYx5Vg', topic: 'r', who: 'kids', title: 'Say the R sound in isolation', by: 'Speech-language therapist' },
  { id: '3zOr5UGV3_0', topic: 'th', who: 'parents', title: '"th" speech therapy made easy', by: 'Speech therapist' },
  { id: 'nSqYa7xRo5Q', topic: 'th', who: 'parents', title: 'Voiced and voiceless TH at home', by: 'Speech Scoop, SLP' },
  { id: 'FO45nm3r0iw', topic: 'th', who: 'kids', title: 'Speech cues in seconds: "soft bite" for TH', by: 'Speech therapist' },
  { id: 'lFXzo7Kh8gs', topic: 'th', who: 'adults', title: 'TH sound practice tip', by: "Rachel's English" },
  { id: 'ZM_eLOVlIA8', topic: 'shch', who: 'kids', title: 'How to say the SH sound', by: 'Peachie Speechie' },
  { id: 'KEi78j_V2RM', topic: 'shch', who: 'kids', title: 'Say the SH sound in isolation', by: 'Speech-language therapist' },
  { id: 'lV3mrQ-dK_w', topic: 'shch', who: 'parents', title: 'How to teach the CH sound', by: 'Flying Cloud Speech Therapy' },
  { id: 'pmdX9R0A820', topic: 'shch', who: 'kids', title: 'How to say CH: lips, tongue and teeth', by: 'Speech therapist' },
  { id: 'AAnEKm45R9M', topic: 'zh', who: 'adults', title: 'Z, C, S, Zh, Ch, Sh, R in Mandarin (beginner guide)', by: 'Mandalion Chinese' },
  { id: 'fMbe4wjhExA', topic: 'zh', who: 'adults', title: 'j/q/x vs z/c/s vs zh/ch/sh/r explained', by: 'Mandarin teacher' },
  { id: '6Bkw1C5oeFM', topic: 'zh', who: 'adults', title: 'Pronouncing X, J, Q, SH, ZH, CH in Mandarin', by: 'Mandarin teacher' },
];

// ---------- Reference list (existing mouth-animation tools) ----------
export const REFERENCES = [
  { title: 'Sounds of Speech (University of Iowa)', url: 'https://soundsofspeech.uiowa.edu/', note: 'Side-view animations and video of English sounds, with example words.' },
  { title: 'Seeing Speech (University of Glasgow)', url: 'https://www.seeingspeech.ac.uk/', note: 'Real ultrasound and MRI video of tongues making each sound, plus an IPA chart.' },
  { title: 'Pink Trombone', url: 'https://dood.al/pinktrombone/', note: 'Play with a moving vocal tract and hear it. Great for curiosity, not for lessons.' },
  { title: 'Three.js examples', url: 'https://threejs.org/examples/', note: 'The 3D library used for our mouth model, if you want to build new views.' },
];
