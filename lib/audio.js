const audioPlayer = require('web-audio-player');
const frequencyToIndex = require('audio-frequency-to-index');
const beats = require('beats');
const EventEmitter = require('events').EventEmitter;
const newArray = require('new-array');
const shuffle = require('array-shuffle');
const Reverb = require('soundbank-reverb');
const path = require('path');
const fs = require('fs');

const allUrls = fs.readdirSync(__dirname + '/../assets/audio/moderat').filter(f => {
  return /\.(wav|mp3|mp4)$/i.test(f);
}).map(x => `assets/audio/moderat/${x}`);

// Only use mp3/wav, we will change URL to DDPlus if necessary
let playlists = allUrls.filter(f => {
  return /\.(mp3|wav)$/i.test(f);
});
// playlists = shuffle(playlists);
// playlists = playlists.slice(0, 5);

module.exports = function () {
  const canPlayDDS = testCanPlayDDPlus();
  if (canPlayDDS) {
    console.log('Dolby Digital Plus supported!');
  }

  const ranges = [ [30, 150], [ 2500, 4500 ] ];
  const audioCache = {};
  let playlistCounter = 0;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyserNode = audioContext.createAnalyser();
  const freqArray = new Uint8Array(analyserNode.frequencyBinCount);
  const reverb = Reverb(audioContext);

  analyserNode.connect(reverb);
  reverb.connect(audioContext.destination);
  reverb.time = 4.5; // seconds
  reverb.wet.value = 0;
  reverb.dry.value = 1;
  reverb.filterType = 'highpass';
  reverb.cutoff.value = 1000; // Hz

  const sampleRate = audioContext.sampleRate;
  const freqBinCount = analyserNode.frequencyBinCount;
  const bins = ranges.map(range => {
    return {
      lo: frequencyToIndex(range[0], sampleRate, freqBinCount),
      hi: frequencyToIndex(range[1], sampleRate, freqBinCount),
      threshold: 50,
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

  Object.defineProperty(player, 'effect', {
    get: function () {
      return effect;
    },
    set: function (val) {
      effect = val;
      reverb.wet.value = val;
      reverb.dry.value = 1 - val;
    }
  });
  player.update = update;
  player.binCount = ranges.length;
  player.beats = newArray(ranges.length, 0);

  player.queue = queue;
  player.playQueued = playQueued;
  return player;

  function update (dt) {
    if (!playingAudio) return;
    analyserNode.getByteTimeDomainData(freqArray);
    player.beats = detectBeats(freqArray);
  }

  function queue (url) {
    if (queueing) return;
    queueing = true;
    url = url || getBestUrl(playlists[playlistCounter++ % playlists.length]);

    loadAudio(url, (audio) => {
      queuedAudio = audio;
      queueing = false;
      player.emit('ready');
    });
    return path.basename(url, path.extname(url));
  }

  // picks best format
  function getBestUrl (url) {
    if (canPlayDDS) {
      const newUrl = url.replace(/\.(wav)$/i, '_Dolby.mp4');
      if (allUrls.indexOf(newUrl) === -1) {
        console.warn('No DDPlus for', newUrl);
        return url;
      }
      return newUrl;
    } else {
      return url;
    }
  }

  function playQueued () {
    if (waitingForNext) return;
    if (queueing) {
      if (playingAudio) playingAudio.pause();
      waitingForNext = true;
      player.once('ready', () => {
        waitingForNext = false;
        playQueued();
      });
      console.log('Deferring next load...');
      return;
    }
    if (playingAudio) {
      playingAudio.pause();
    }
    queuedAudio.play();
    playingAudio = queuedAudio;
  }

  function loadAudio (url, cb) {
    if (loadingAudio) return;
    loadingAudio = true;

    if (url in audioCache) {
      const ret = audioCache[url];
      process.nextTick(() => {
        cb(ret);
        loadingAudio = false;
      });
      return ret;
    }

    const audio = audioPlayer(url, {
      loop: true,
      buffer: false,
      context: audioContext
    });
    audioCache[url] = audio;

    audio.on('decoding', () => {
      console.log('Decoding', url);
    });
    audio.on('load', () => {
      console.log('Audio loaded...');
      // start playing audio file
      cb(audio);
      loadingAudio = false;
    });
    audio.node.connect(analyserNode);
    return audio;
  }

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
};
