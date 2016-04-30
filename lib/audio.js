const audioPlayer = require('web-audio-player');
const frequencyToIndex = require('audio-frequency-to-index');
const createAudioContext = require('ios-safe-audio-context');
const beats = require('beats');
const EventEmitter = require('events').EventEmitter;
const newArray = require('new-array');
const Reverb = require('soundbank-reverb');
const path = require('path');
const lerp = require('lerp');
const log = require('./log');

const canPlayDDS = testCanPlayDDPlus();
const filenames = [
  '01 - The Mark (Interlude)',
  '02 - Bad Kingdom',
  '03 - Versions',
  '04 - Let In The Light',
  '05 - Milk',
  '06 - Therapy',
  '07 - Gita',
  '08 - Clouded (Interlude)',
  '09 - Ilona',
  '10 - Damage Done',
  '11 - This Time'
];

const playlists = filenames.map(f => {
  return `assets/audio/moderat/${f}`;
}).map(url => {
  const formats = [ url + '.ogg', url + '.mp3' ];
  if (canPlayDDS) {
    formats.unshift({
      src: url + '_Dolby.mp4'
    });
  }
  return formats;
});

module.exports = function () {
  if (canPlayDDS) log('Dolby Digital Plus supported!');

  const ranges = [ [30, 150], [ 2500, 4500 ] ];
  const audioCache = {};
  let playlistCounter = 0;

  const audioContext = createAudioContext();
  setTimeout(() => resume(), 1000);

  // console.log(audioContext.sampleRate)
  //new (window.AudioContext || window.webkitAudioContext)();
  const analyserNode = audioContext.createAnalyser();
  const freqArray = new Uint8Array(analyserNode.frequencyBinCount);

  // If rate is not 44100, the reverb module bugs out
  const supportReverb = audioContext.sampleRate === 44100;

  const effectNode = createEffectNode(audioContext.destination);
  analyserNode.connect(effectNode);

  const sampleRate = audioContext.sampleRate;
  const freqBinCount = analyserNode.frequencyBinCount;
  const bins = ranges.map(range => {
    return {
      lo: frequencyToIndex(range[0], sampleRate, freqBinCount),
      hi: frequencyToIndex(range[1], sampleRate, freqBinCount),
      threshold: 110,
      decay: 0.001
    };
  });
  const detectBeats = beats(bins);

  let effect = 0;
  const player = new EventEmitter();

  let loadingAudio = false;
  let queueing = false;
  let waitingForNext = false;
  let queuedAudio, playingAudio;
  let dataIsInvalid = false;
  let dataValidationInterval = null;
  let fillWithFakeData = false;
  let lastTrackName;
  const VALIDATION_TIME = 3000;

  Object.defineProperty(player, 'effect', {
    get: function () {
      return effect;
    },
    set: function (val) {
      effect = val;
      effectNode.wet.value = val;
      effectNode.dry.value = 1 - val;
    }
  });

  player.update = update;
  player.binCount = ranges.length;
  player.beats = newArray(ranges.length, 0);

  player.queue = queue;
  player.playQueued = playQueued;
  player.skip = skip;
  return player;

  function skip () {
    playlistCounter++;
  }

  function resume () {
    if (audioContext.state === 'suspended' &&
        typeof audioContext.resume === 'function') {
      audioContext.resume();
    }
  }

  function createEffectNode (output) {
    if (supportReverb) {
      const reverb = Reverb(audioContext);
      reverb.time = 4.5; // seconds
      reverb.wet.value = 0;
      reverb.dry.value = 1;
      reverb.filterType = 'highpass';
      reverb.cutoff.value = 1000; // Hz
      reverb.connect(output);
      return reverb;
    } else {
      const node = audioContext.createGain();
      const dry = audioContext.createGain();
      const wet = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      node.connect(dry);
      node.connect(wet);

      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      dry.connect(output);
      wet.connect(filter);
      filter.connect(output);

      Object.defineProperties(node, {
        wet: { get: () => wet.gain },
        dry: { get: () => dry.gain }
      });
      node.wet.value = 0;
      node.dry.value = 1;
      return node;
    }
  }

  function update (dt) {
    if (!playingAudio) return;
    analyserNode.getByteTimeDomainData(freqArray);
    player.beats = detectBeats(freqArray);

    if (!isDataValid()) {
      dataIsInvalid = true;
    }

    if (fillWithFakeData) fillFakeData();
  }

  // Safari (iOS/Desktop) returns garbage audio
  // frequency data since we are using a media
  // element source, not a fully decoded source.
  // For these browsers we will just "fake" the
  // visualization.
  function isDataValid () {
    var test = freqArray[0];
    for (let i = 0; i < freqArray.length; i++) {
      if (freqArray[i] !== test) return true;
    }
    return false;
  }

  function dataValidation () {
    if (dataIsInvalid) {
      // console.log('Data has been invalid for X frames, filling with fake frequencies.');
      dataIsInvalid = false;
      fillWithFakeData = true;
    }
  }

  function fillFakeData () {
    for (let i = 0; i < freqArray.length; i++) {
      freqArray[i] = 127;
    }
  }

  function queue () {
    if (queueing) return lastTrackName;
    queueing = true;
    const sources = playlists[playlistCounter++ % playlists.length];
    const sourceUrl = typeof sources[0] === 'string' ? sources[0] : sources[0].src;

    loadAudio(sources, (audio) => {
      queuedAudio = audio;
      queueing = false;
      player.emit('ready');
    });
    lastTrackName = path.basename(sourceUrl, path.extname(sourceUrl));
    lastTrackName = lastTrackName.replace(/\_Dolby/i, '');
    return lastTrackName;
  }

  function playQueued () {
    // console.log('About to play...');
    if (waitingForNext) return;
    if (queueing) {
      if (playingAudio) playingAudio.pause();
      waitingForNext = true;
      player.once('ready', () => {
        waitingForNext = false;
        playQueued();
      });
      // console.log('Deferring next load...');
      return;
    }
    if (playingAudio) {
      playingAudio.pause();
    }
    dataIsInvalid = false;
    fillWithFakeData = false;
    queuedAudio.play();
    playingAudio = queuedAudio;
    if (dataValidationInterval) clearTimeout(dataValidationInterval);
    dataValidationInterval = setTimeout(dataValidation, VALIDATION_TIME);
    // console.log('Playing...');
  }

  function loadAudio (sources, cb) {
    if (loadingAudio) return;
    if (!Array.isArray(sources)) sources = [ sources ];
    const urlKey = typeof sources[0] === 'string' ? sources[0] : sources[0].src;
    loadingAudio = true;

    if (urlKey in audioCache) {
      const ret = audioCache[urlKey];
      process.nextTick(() => {
        cb(ret);
        loadingAudio = false;
      });
      return ret;
    }

    // Fix Safari 9 bug
    resume();

    const audio = audioPlayer(sources, {
      loop: true,
      buffer: false,
      context: audioContext
    });
    audioCache[urlKey] = audio;

    audio.on('decoding', () => {
      // console.log('Decoding', urlKey);
    });
    audio.on('load', () => {
      // console.log('Audio loaded...');
      // start playing audio file
      cb(audio);
      loadingAudio = false;
    });
    audio.node.connect(analyserNode);
    return audio;
  }
};

function testCanPlayDDPlus () {
  // create audio element to test Dolby Digital Plus playback
  var audio = new window.Audio();

  // check to see if EC-3 (Dolby Digital Plus) can be played
  if (audio.canPlayType('audio/mp4;codecs="ec-3"') !== '') {
    if (navigator.userAgent.indexOf('Safari') !== -1 &&
        navigator.userAgent.indexOf('Mac OS X 10_11') !== -1 &&
        navigator.userAgent.indexOf('Version/9') !== -1) {
      // everything checks out so we can play Dolby Digital Plus
      return true;
    }
    if (navigator.userAgent.indexOf('Edge') !== -1) {
      return true;
    }
  }
  return false;
}