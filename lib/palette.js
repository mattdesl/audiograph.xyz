const shuffle = require('array-shuffle');
const indexOfArray = require('index-of-array');
const palettes = require('./color-palettes.json').slice(0, 200);
const introPalettes = require('./intro-palettes.json');

module.exports = function () {
  const first = shuffle(introPalettes)[0];

  const ret = shuffle(palettes);
  const idx = indexOfArray(ret, first);
  if (idx !== -1) ret.splice(idx, 1);
  ret.unshift(first);
  return ret;
};

// const offline = require('./offline-palettes');
// const colorDiff = require('color-diff');
// const hexRgb = require('hex-rgb');
// const luminance = require('color-luminance');
// const rgb2hsl = require('float-rgb2hsl');

// const hexRgbFloat = (hex) => hexRgb(hex).map(x => x / 255);

// module.exports = function (cb) {
//   process.nextTick(() => {
//     let parsed = parse(offline);
//     window.parsed = parsed;
//     console.log(parsed);
//     parsed = shuffle(parsed);
//     // parsed.sort(sorter);
    
//     cb(parsed);
//   });
  
//   function sorter (a, b) {
//     const cA = hexRgbFloat(a[0]);
//     const cB = hexRgbFloat(b[0]);
//     // const hslA = rgb2hsl(cA);
//     // const hslB = rgb2hsl(cB);
//     // return hslA[2] - hslB[2];
//     const lA = luminance(cA[0], cA[1], cA[2]);
//     const lB = luminance(cB[0], cB[1], cB[2]);
//     return lA - lB;
//     const cAObj = { R: cA[0], G: cA[1], B: cA[2] };
//     const cBObj = { R: cB[0], G: cB[1], B: cB[2] };
//     const diff = colorDiff.diff(colorDiff.rgb_to_lab(cAObj), colorDiff.rgb_to_lab(cBObj));
//     return diff;
//   }
// };

// function parse (json) {
//   return json.map(result => {
//     return result.colors.slice(0, 15).map(x => `#${x}`);
//   });
// }
