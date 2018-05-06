const tweenr = require('tweenr')();
const css = require('dom-css');
const isMobile = require('./isMobile');
const noop = function () {};

module.exports = function (opt = {}, cb = noop) {
  const intro1a = document.querySelector('.intro-1a');
  const intro1b = document.querySelector('.intro-1b');
  const intro2 = document.querySelector('.intro-2');
  const intro3 = document.querySelector('.intro-3');
  const header = document.querySelector('.header-container');
  const logo = document.querySelector('.logo-container');
  const introContanier = document.querySelector('#intro');
  const yOff = 10;
  const globalDuration = 0.25;
  const elementsToHide = [ header, logo ].filter(Boolean);
  // const WAIT_TIME_A = 1.5;
  const WAIT_TIME_B = 3.5;

  let finishedEarly = false;
  const interactions = opt.interactions;

  let delayedReleaseSpacebar = null;

  const introHint = intro1a;
  // if (isMobile) {
    intro2.innerHTML = '<span class="spacebar">tap</span> and hold to load a new track';
    intro3.innerHTML = 'Release <span class="spacebar">tap</span> to play';
  // }

  const introDelay = 0.0;
  animateIn(header, {
    childTagName: 'div'
  });
  showIntroTrackName();

  function showIntroTrackName () {
    animateIn(introHint, { delay: introDelay + 0.5 }, () => {
      animateOut(introHint, { delay: WAIT_TIME_B }, () => {
        showIdleSplash();
      });
    });
  }

  function showIdleSplash () {
    animateIn(intro2);
    interactions.enable();
    interactions.once('start', () => {
      hideLogos();
      animateOut(intro2, {}, () => {
        if (!finishedEarly) {
          delayedReleaseSpacebar = setTimeout(() => {
            animateIn(intro3);
          }, 650);
        }
      });
    });
    interactions.once('stop', () => {
      finishedEarly = true;
      animateOut(intro3);
      onFinished();
    });
  }

  function onFinished () {
    if (delayedReleaseSpacebar) clearTimeout(delayedReleaseSpacebar);
    introContanier.style.display = 'none';
    hideLogos();
    cb();
  }

  function hideLogos () {
    elementsToHide.forEach(e => {
      // animateOut(e, { duration: 1 });
      e.style.display = 'none';
    });
  }

  function animateIn (element, opt = {}, cb = noop) {
    let delay = opt.delay || 0;
    element.style.display = 'block';

    const duration = typeof opt.duration === 'number' ? opt.duration : globalDuration;
    const children = getAnimatables(element, opt);
    children.forEach((child, i) => {
      const tween = { opacity: 0, yOff, element: child };
      update({ target: tween });
      const lastTween = tweenr.to(tween, { delay, opacity: 1, duration, ease: 'quadOut' })
        .on('update', update);
      tweenr.to(tween, { delay, yOff: 0, duration: duration * 0.5, ease: 'expoOut' });
      delay += 0.1;
      if (i === children.length - 1) lastTween.on('complete', cb);
    });
  }

  function animateOut (element, opt = {}, cb = noop) {
    let delay = opt.delay || 0;
    const duration = typeof opt.duration === 'number' ? opt.duration : globalDuration;
    const children = getAnimatables(element, opt);
    children.reverse();
    children.forEach((child, i) => {
      const tween = { opacity: 1, yOff: 0, element: child };
      update({ target: tween });
      tweenr.to(tween, { delay, opacity: 0, duration: duration * 0.25, ease: 'quadOut' })
      const lastTween = tweenr.to(tween, { delay, yOff: yOff, duration: duration * 0.5, ease: 'expoOut' })
        .on('update', update);
      delay += 0.075;
      if (i === children.length - 1) {
        lastTween.on('complete', () => {
          element.style.display = 'none';
          cb();
        });
      }
    });
  }

  function update (ev) {
    const tween = ev.target;
    css(tween.element, {
      transform: `translateY(${tween.yOff}px)`,
      opacity: tween.opacity
    });
  }

  function getAnimatables (element, opt = {}) {
    const children = Array.prototype.slice.call(element.querySelectorAll(opt.childTagName || 'p'));
    if (children.length === 0) children.push(element);
    return children;
  }
}
