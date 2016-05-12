const font = 'font-family: "NotoSans", "Helvetica", sans-serif;';
// const kbd = `
//   display: inline-block;
//   padding: 2px 4px;
//   font-size: 11px;
//   line-height: 10px;
//   color: #555;
//   vertical-align: middle;
//   background-color: #fcfcfc;
//   border: solid 1px #ccc;
//   border-bottom-color: #bbb;
//   border-radius: 3px;
//   box-shadow: inset 0 -1px 0 #bbb;
// `.trim();

const artist = 'Pilotpriest';

module.exports = function (msg) {
  console.log(`%c${msg}`, font);
};

module.exports.intro = function (msg) {
  console.log([
    '%c🎹 audiograph.xyz',
    '%c\t\tCreated by Matt DesLauriers (%chttp://twitter.com/mattdesl/%c)',
    `%c\t\tAudio by ${artist}`,
    '%c\t\tColor palettes sourced from ColourLovers.com',
    '%c\t\tWith UX help from Melissa Hernandez'
  ].join('\n'), `${font} background: #efefef; padding: 1px 5px;`, font, `${font} color: #3aa3e0;`, font, font, font, font);
};

module.exports.easterEgg = function () {
  // to be decided...
  // console.log('%cHint:%c Hold %cC%c for something cool', `${font} color: #ff6600`, font, kbd, font)
};
