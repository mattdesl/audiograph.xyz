const tweenr = require('tweenr')();
const css = require('dom-css');
const isMobile = require('./isMobile');
const noop = function () {};

module.exports = function () {
  const header = document.querySelector('.header-container');
  const yOff = 0;
  const globalDuration = 1;

  return {
    animateIn: () => {
      animateIn(header, {
        delay: 0.5,
        childTagName: 'div'
      });
    },
    animateOut: () => {
      animateOut(header, {
        childTagName: 'div',
        duration: 1
      });
    }
  };

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
      delay += 0.1;
      if (i === children.length - 1) lastTween.on('complete', cb);
    });
  }

  function animateOut (element, opt = {}, cb = noop) {
    tweenr.cancel();
    let delay = opt.delay || 0;
    const duration = typeof opt.duration === 'number' ? opt.duration : globalDuration;
    const children = getAnimatables(element, opt);
    children.reverse();
    children.forEach((child, i) => {
      const tween = { opacity: 1, yOff: 0, element: child };
      update({ target: tween });
      const lastTween = tweenr.to(tween, { delay: delay, opacity: 0, duration: duration * 0.85, ease: 'quadOut' })
        .on('update', update);
      delay += 0.05;
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
