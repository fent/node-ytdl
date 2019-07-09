const sanitizeName = require('sanitize-filename');


/**
 * Converts seconds into human readable time hh:mm:ss
 *
 * @param {number} seconds
 * @return {string}
 */
exports.toHumanTime = (seconds) => {
  let h = Math.floor(seconds / 3600);
  let m = Math.floor(seconds / 60) % 60;

  let time;
  if (h > 0) {
    time = h + ':';
    if (m < 10) { m = '0' + m; }
  } else {
    time = '';
  }

  let s = seconds % 60;
  if (s < 10) { s = '0' + s; }

  return time + m + ':' + s;
};


/**
 * Converst bytes to human readable unit.
 * Thank you Amir from StackOverflow.
 *
 * @param {number} bytes
 * @return {string}
 */
const units = ' KMGTPEZYXWVU';
exports.toHumanSize = (bytes) => {
  if (bytes <= 0) { return '0'; }
  let t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
  return (Math.round(bytes * 100 / Math.pow(1024, t2)) / 100) +
          units.charAt(t2).replace(' ', '') + 'B';
};


/**
 * Template a string with variables denoted by {prop}.
 *
 * @param {string} str
 * @param {Array.<Object>} objs
 * @return {string}
 */
exports.tmpl = (str, objs) => {
  return str.replace(/\{([\w.-]+)\}/g, (match, prop) => {
    prop = prop.split('.');
    for (let result of objs) {
      let j = 0;
      let myprop = prop[j];
      while (myprop != null && result[myprop] != null) {
        result = result[myprop];
        if (prop.length === ++j) {
          return sanitizeName(result, { replacement: '-' });
        }
        myprop = prop[j];
      }
    }
    return match;
  });
};
