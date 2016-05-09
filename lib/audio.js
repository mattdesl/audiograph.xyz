const audioPlayer = require('web-audio-player');
const frequencyToIndex = require('audio-frequency-to-index');
const createAudioContext = require('ios-safe-audio-context');
const createBeatDetection = require('beats');
const EventEmitter = require('events').EventEmitter;
const newArray = require('new-array');
const Reverb = require('soundbank-reverb');
const path = require('path');
const lerp = require('lerp');
const log = require('./log');
const NUM_BINS = 2;

const canPlayDDS = testCanPlayDDPlus();
const filenames = [
  '01_-_The_Mark_Interlude',
  '02_-_Bad_Kingdom',
  '03_-_Versions',
  '04_-_Let_In_The_Light',
  '05_-_Milk',
  '06_-_Therapy',
  '07_-_Gita',
  '08_-_Clouded_Interlude',
  '09_-_Ilona',
  '10_-_Damage_Done',
  '11_-_This_Time'
];

const frequencies = [
  [ [175, 3000], [ 100, 118 ] ], // Mark (interlude)
  [ [30, 150], [ 30, 150 ] ], // Bad kingdom
  [ [200, 1900], [30, 130] ], // Versions
  [ [900, 5000], [30, 150] ], // Let in the light
  [ [900, 5000], [110, 120] ], // Milk
  [ [30, 150], [600, 800] ], // Therapy
  [ [900, 5000], [50, 159] ], // Gita
  [ [1000, 2000], [40, 100] ], // Clouded
  [ [300, 360], [50, 65] ], // Ilona
  [ [30, 150], [ 0, 70 ] ], // Damage Done
  [ [1000, 2000], [ 20, 35 ] ], // This time
];

const playlists = filenames.map(f => {
  return `assets/audio/moderat/${f}`;
}).map(url => {
  const formats = [ url + '.mp3', url + '.ogg' ];
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
  const supportReverb = audioContext.sampleRate === 44100;

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
    return lastTrackName;
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
