const audioPlayer = require('web-audio-player');
const webAudioAnalyser = require('web-audio-analyser');
const analyserAverage = require('analyser-frequency-average');
const frequencyToIndex = require('audio-frequency-to-index');
const beats = require('beats');
const EventEmitter = require('events').EventEmitter;
const newArray = require('new-array');

const Reverb = require('soundbank-reverb');

const playlists = require('fs').readdirSync(__dirname + '/../assets/audio/playlist').filter(f => {
  return /\.mp3$/i.test(f);
}).map(x => `assets/audio/playlist/${x}`);

module.exports = function () {
  const ranges = [ [50, 250], [ 2500, 11000 ] ];
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  // const url = 'assets/audio/05 -Zodiac Shit.wav';
  // const url = 'assets/audio/flylo.mp3';
  // const url = 'assets/audio/mrscruff.mp3';
  const url = playlists[Math.floor(Math.random() * playlists.length)];
  // const url = [ 'assets/audio/bluejean_short.mp3', 'assets/audio/bluejean_short.ogg' ];
  const audio = audioPlayer(url, {
    loop: true,
    buffer: true,
    context: audioContext
  });

  const reverb = Reverb(audioContext);
  let ready = false;
  audio.reverb = reverb;

  let analyser, detect, analyserNode;
  audio.on('decoding', () => {
    console.log('Decoding...')
  });
  audio.on('load', () => {
    console.log('Audio loaded...');

    // start playing audio file
    // audio.play();
    audioReady();
    update(1);
  });

  audio.update = update;
  audio.binCount = ranges.length;
  audio.detection = newArray(ranges.length);
  return audio;

  function update (dt) {
    const freqs = analyser.frequencies();
    audio.detection = detect(freqs, dt);
  }

  function audioReady () {
    analyser = webAudioAnalyser(audio.node, audio.context, {
      stereo: false,
      audible: false
    });
    analyserNode = analyser.analyser;

    window.analyserNode = analyserNode;
    window.audioContext = audioContext;

    analyserNode.connect(reverb);
    reverb.connect(audioContext.destination);
    reverb.time = 4.5; // seconds 
    reverb.wet.value = 0;
    reverb.dry.value = 1;
    reverb.filterType = 'lowpass';
    reverb.cutoff.value = 4000; // Hz 

    const sampleRate = audioContext.sampleRate;
    const freqBinCount = analyserNode.frequencyBinCount;
    const bins = ranges.map(range => {
      return {
        lo: frequencyToIndex(range[0], sampleRate, freqBinCount),
        hi: frequencyToIndex(range[1], sampleRate, freqBinCount),
        threshold: 100,
        decay: 0.001
      };
    });
    detect = beats(bins);
    audio.emit('ready');
  }
};
