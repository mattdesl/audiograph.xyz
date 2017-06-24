const shuffle = require('array-shuffle');
const indexOfArray = require('index-of-array');
const palettes = require('./color-palettes.json').slice(0, 200);
const randomFloat = require('random-float');
const introPalettes = require('./intro-palettes.json');
const bestPalettes = require('./best-palettes');
const combos = require('array-combos').default;

let curBestPalette = bestPalettes.slice();
let curBestPaletteIndex = 0;
// const swapPalettes = 

// module.exports = function () {
//   const first = shuffle(introPalettes)[0];

//   const ret = shuffle(palettes);
//   const idx = indexOfArray(ret, first);
//   if (idx !== -1) ret.splice(idx, 1);
//   ret.unshift(first);
//   return ret;
// };

const detail = shuffle(palettes.map(p => {
  return combos(p).filter(array => array.length > 2);
}).reduce((a, b) => a.concat(b), []));
let detailIndex = 0;

module.exports.getAllPalettes = function () {
  // const all = shuffle(palettes).map(p => {
  //   const n = Math.floor(randomFloat(3, 6));
  //   return shuffle(p).slice(0, n);
  // });
  // return all;
  return curBestPalette.slice();
};

module.exports.random = function () {
  return bestPalettes[detailIndex++ % bestPalettes.length];
  // const pal = shuffle(palettes[Math.floor(Math.random() * palettes.length)]);
  // const n = Math.floor(randomFloat(3, 6));
  // return pal.slice(0, n);
};

module.exports.getSwapPalette = function () {
  const ret = curBestPalette[curBestPaletteIndex]
  curBestPaletteIndex++;
  if (curBestPaletteIndex > curBestPalette.length - 1) {
    console.log('shuffle best');
    curBestPalette = shuffle(curBestPalette);
    curBestPaletteIndex = 0;
  }
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
