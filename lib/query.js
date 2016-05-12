const qs = require('query-string');

// returns an object that auto-detects numbers / bools
// acts a bit like 'minimist'
module.exports = function (opt = {}) {
  const flags = { bools: {}, strings: {} };
  const bools = [].concat(opt.boolean).filter(Boolean);
  bools.forEach(function (key) {
    flags.bools[key] = true;
  });
  const strings = [].concat(opt.string).filter(Boolean);
  strings.forEach(function (key) {
    flags.strings[key] = true;
  });

  const parsed = qs.parse(window.location.search);
  Object.keys(parsed).forEach(key => {
    if (parsed[key] === null) parsed[key] = true;
    if (parsed[key] === 'false') parsed[key] = false;
    if (parsed[key] === 'true') parsed[key] = true;
    if (flags.bools[key]) parsed[key] = Boolean(parsed[key]);
    if (!flags.strings[key] && isNumber(parsed[key])) {
      parsed[key] = Number(parsed[key]);
    }
  });

  const defaults = opt.defaults || {};
  Object.keys(defaults).forEach(key => {
    if (typeof parsed[key] === 'undefined') {
      parsed[key] = defaults[key];
    }
  });
  return parsed;
};

function isNumber (x) {
  if (typeof x === 'number') return true;
  if (/^0x[0-9a-f]+$/i.test(x)) return true;
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}
