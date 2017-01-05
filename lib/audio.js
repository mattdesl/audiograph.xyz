const audioPlayer = require('web-audio-player');
const frequencyToIndex = require('audio-frequency-to-index');
const createAudioContext = require('ios-safe-audio-context');
const createBeatDetection = require('beats');
const EventEmitter = require('events').EventEmitter;
const newArray = require('new-array');
const Reverb = require('soundbank-reverb');
const path = require('path');
const log = require('./log');
const NUM_BINS = 2;

const canPlayDDS = testCanPlayDDPlus();
const filenames = [
  '01_-_Matter',
  '02_-_Now_Be_The_Light',
  '03_-_Entrance',
  '04_-_I_Am_You',
  '05_-_Skin',
  '06_-_Anthem',
  '07_-_Lipstick',
  '08_-_Softcore',
  '09_-_Starfilter_Fur_Alina'
];

const frequencies = [
  [ [40, 55], [40, 55] ], // Matter
  [ [145, 5000], [145, 5000] ], // Now Be The Light
  [ [510, 535], [20, 50] ], // Entrance
  [ [35, 55], [35, 55] ], // I Am You
  [ [30, 55], [30, 50] ], // Skin
  [ [1200, 2000], [20, 50] ], // Anthem
  [ [50, 80], [16800, 20000] ], // Lipstick
  [ [10, 150], [10, 150] ], // Softcore
  [ [0, 0], [450, 4500] ] // Fur Alina
];

const playlists = filenames.map(f => {
  return `assets/audio/pilotpriest/${f}`;
}).map(url => {
  const formats = [ url + '.mp3' ];
  if (canPlayDDS) {
    formats.unshift({
      src: url + '_Dolby.mp4'
    });
  }
  return formats;
});

module.exports = function () {
  if (canPlayDDS) log('Dolby Digital Plus supported!');

  const audioCache = {};
  const audioTimeCache = {};
  let playlistCounter = 0;

  const audioContext = createAudioContext();
  setTimeout(() => resume(), 1000);

  // console.log(audioContext.sampleRate)
  //new (window.AudioContext || window.webkitAudioContext)();
  const analyserNode = audioContext.createAnalyser();
  const freqArray = new Uint8Array(analyserNode.frequencyBinCount);

  // If rate is not 44100, the reverb module bugs out
  const supportReverb = audioContext.sampleRate <= 96000; 
  const effectNode = createEffectNode(audioContext.destination);
  analyserNode.connect(effectNode);

  const sampleRate = audioContext.sampleRate;
  const freqBinCount = analyserNode.frequencyBinCount;

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
  player.binCount = NUM_BINS;
  player.beats = newArray(NUM_BINS, 0);

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
      reverb.cutoff.value = 200; // Hz
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
    analyserNode.getByteFrequencyData(freqArray);
    player.beats = playingAudio.detectBeats(freqArray);

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
    const newIdx = playlistCounter++ % playlists.length;
    const sources = playlists[newIdx];
    const frequencyBand = frequencies[newIdx];
    const sourceUrl = typeof sources[0] === 'string' ? sources[0] : sources[0].src;

    loadAudio(sources, frequencyBand, (audio) => {
      queuedAudio = audio;
      queueing = false;
      player.emit('ready');
    });
    lastTrackName = path.basename(sourceUrl, path.extname(sourceUrl));

    // Send original track name so we know what is being played
    if (window.ga) {
      window.ga('send', 'event', 'audio', 'queue', lastTrackName);
    }

    lastTrackName = lastTrackName.replace(/\_Dolby/i, '');
    lastTrackName = lastTrackName.replace(/\_/g, ' ');
    lastTrackName = lastTrackName.replace('Interlude', ' (Interlude)');
    lastTrackName = lastTrackName.replace('Fur Alina', '(Für Alina)');
    return lastTrackName.trim();
  }

  function playQueued () {
    // console.log('About to play...');
    if (waitingForNext) return;
    if (queueing) {
      stopLast();
      waitingForNext = true;
      player.once('ready', () => {
        waitingForNext = false;
        playQueued();
      });
      // console.log('Deferring next load...');
      return;
    }
    stopLast();
    dataIsInvalid = false;
    fillWithFakeData = false;
    queuedAudio.play();
    playingAudio = queuedAudio;
    if (dataValidationInterval) clearTimeout(dataValidationInterval);
    dataValidationInterval = setTimeout(dataValidation, VALIDATION_TIME);
    // console.log('Playing...');
  }
  
  function stopLast () {
    if (playingAudio) {
      audioTimeCache[playingAudio.urlKey] = playingAudio.element.currentTime;
      playingAudio.stop();

      const lastSources = [];
      const element = playingAudio.element;
      while (element.firstChild) {
        lastSources.push(element.firstChild);
        element.removeChild(element.firstChild);
      }

      playingAudio.lastSources = lastSources;
      playingAudio.element.load();
      playingAudio.node.disconnect();
    }
  }

  function loadAudio (sources, ranges, cb) {
    if (loadingAudio) return;
    if (!Array.isArray(sources)) sources = [ sources ];
    const urlKey = typeof sources[0] === 'string' ? sources[0] : sources[0].src;
    loadingAudio = true;

    // if (urlKey in audioCache) {
    //   const ret = audioCache[urlKey];
    //   ret.lastSources.forEach(source => {
    //     ret.element.appendChild(source);
    //   });
    //   ret.lastSources.length = 0;
    //   ret.element.currentTime = ret.lastTime;
    //   ret.element.load();
    //   process.nextTick(() => {
    //     cb(ret);
    //     loadingAudio = false;
    //   });
    //   return ret;
    // }

    // Fix Safari 9 bug
    resume();

    const audio = audioPlayer(sources, {
      loop: true,
      buffer: false,
      context: audioContext
    });
    audioCache[urlKey] = audio;
    audio.urlKey = urlKey;

    audio.on('error', err => {
      console.error(err);
    });

    const bins = ranges.map(range => {
      return {
        lo: frequencyToIndex(range[0], sampleRate, freqBinCount),
        hi: frequencyToIndex(range[1], sampleRate, freqBinCount),
        threshold: 100,
        decay: 0.001
      };
    });
    audio.detectBeats = createBeatDetection(bins);
    
    audio.on('decoding', () => {
      // console.log('Decoding', urlKey);
    });
    audio.on('load', () => {
      // console.log('Audio loaded...');
      // start playing audio file
      
      if (urlKey in audioTimeCache) {
        audio.element.currentTime = audioTimeCache[urlKey];
      }

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
