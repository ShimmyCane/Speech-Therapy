// Mouth parameters shared by every language pack.
// jaw 0..1 open. back/mid/blade/tipY = tongue height 0 (low) .. 1 (touching the roof).
// tipZ: where the tip points (0.66 behind the lower teeth ... 1 between the teeth). groove 0..1, sides -1..1.
// asp: a big puff of air when a stop or affricate opens (aspiration).
export const N = { jaw: .18, round: 0, spread: 0, lipsShut: 0, back: .25, mid: .25, blade: .2, tipY: .15, tipZ: .66,
  groove: 0, sides: 0, voiced: 0, nasal: 0, teethLip: 0, air: 0, asp: 0 };
export const P = (o) => ({ ...N, ...o });
