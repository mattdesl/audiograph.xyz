const tweenr = require('tweenr')();
const css = require('dom-css');
const noop = function () {};

module.exports = function (opt = {}, cb = noop) {
  const intro1 = document.querySelector('.intro-1');
  const intro2 = document.querySelector('.intro-2');
  const intro3 = document.querySelector('.intro-3');
  const header = document.querySelector('.header-container');
  const logo = document.querySelector('.logo-container');
  const yOff = 10;
  const globalDuration = 0.25;
  const elementsToHide = [ header, logo ].filter(Boolean);
  const WAIT_TIME = 2.5;

  let finishedEarly = false;
  const interactions = opt.interactions;

  let delayedReleaseSpacebar = null;
  animateIn(intro1, { delay: 0.5 }, () => {
    animateOut(intro1, { delay: WAIT_TIME }, () => {
      animateIn(intro2);
      interactions.enable();
      interactions.once('start', () => {
        hideLogos();
        animateOut(intro2, {}, () => {
          if (!finishedEarly) {
            delayedReleaseSpacebar = setTimeout(() => {
              animateIn(intro3);
            }, 750);
          }
        });
      });
      interactions.once('stop', () => {
        finishedEarly = true;
        animateOut(intro3);
        onFinished();
      });
    });
  });

  function onFinished () {
    if (delayedReleaseSpacebar) clearTimeout(delayedReleaseSpacebar);
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
    const children = getAnimatables(element);
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
    const children = getAnimatables(element);
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
  
  function getAnimatables (element) {
    const children = [ ...element.querySelectorAll('p') ];
    if (children.length === 0) children.push(element);
    return children;
  }
}