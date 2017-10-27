/**
 * Converts seconds into human readable time hh:mm:ss
 *
 * @param {Number} seconds
 * @return {String}
 */
exports.toHumanTime = (seconds) => {
  var h = Math.floor(seconds / 3600);
  var m = Math.floor(seconds / 60) % 60;

  var time;
  if (h > 0) {
    time = h + ':';
    if (m < 10) { m = '0' + m; }
  } else {
    time = '';
  }

  var s = seconds % 60;
  if (s < 10) { s = '0' + s; }

  return time + m + ':' + s;
};


/**
 * Converst bytes to human readable unit.
 * Thank you Amir from StackOverflow.
 *
 * @param {Number} bytes
 * @return {String}
 */
const units = ' KMGTPEZYXWVU';
exports.toHumanSize = (bytes) => {
  if (bytes <= 0) { return '0'; }
  var t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
  return (Math.round(bytes * 100 / Math.pow(1024, t2)) / 100) +
          units.charAt(t2).replace(' ', '') + 'B';
};


/**
 * Template a string with variables denoted by {prop}.
 *
 * @param {String} str
 * @param {Array.<Object>} objs
 * @return {string}
 */
exports.tmpl = (str, objs) => {
  return str.replace(/\{([\w.-]+)\}/g, (match, prop) => {
    prop = prop.split('.');
    for (var i = 0, len = objs.length; i < len; i++) {
      var result = objs[i];
      var j = 0;
      var myprop = prop[j];
      while (myprop != null && result[myprop] != null) {
        result = result[myprop];
        if (prop.length === ++j) {
          return result;
        }
        myprop = prop[j];
      }
    }
    return match;
  });
};
