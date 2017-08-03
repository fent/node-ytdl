#!/usr/bin/env node


const info = require('../package');

var opts = require('nomnom')
  .option('version', {
    abbr: 'v',
    flag: true,
    callback: function() {
      console.log(info.version);
      process.exit();
    },
    help: 'Print program version.'
  })
  .option('url', {
    position: 0,
    required: true,
    help: 'URL to the video.'
  })
  .option('quality', {
    abbr: 'q',
    metavar: 'ITAG',
    help: 'Video quality to download, default: highest'
  })
  .option('range', {
    abbr: 'r',
    metavar: 'INT-INT',
    help: 'Byte range to download, ie 10355705-12452856'
  })
  .option('begin', {
    abbr: 'b',
    metavar: 'INT',
    help: 'Time to begin video, format by 1:30.123 and 1m30s'
  })
  .option('output', {
    abbr: 'o',
    metavar: 'FILE',
    help: 'Save to file, template by {prop}, default: stdout'
  })
  .option('filter', {
    full: 'filter',
    metavar: 'STR',
    help: 'Can be video, videoonly, audio, audioonly'
  })
  .option('filterContainer', {
    full: 'filter-container',
    metavar: 'REGEXP',
    help: 'Filter in format container'
  })
  .option('unfilterContainer', {
    full: 'unfilter-container',
    metavar: 'REGEXP',
    help: 'Filter out format container'
  })
  .option('filterResolution', {
    full: 'filter-resolution',
    metavar: 'REGEXP',
    help: 'Filter in format resolution'
  })
  .option('unfilterResolution', {
    full: 'unfilter-resolution',
    metavar: 'REGEXP',
    help: 'Filter out format resolution'
  })
  .option('filterEncoding', {
    full: 'filter-encoding',
    metavar: 'REGEXP',
    help: 'Filter in format encoding'
  })
  .option('unfilterEncoding', {
    full: 'unfilter-encoding',
    metavar: 'REGEXP',
    help: 'Filter out format encoding'
  })
  .option('info', {
    abbr: 'i',
    flag: true,
    help: 'Print video info without downloading'
  })
  .option('infoJson', {
    full: 'info-json',
    abbr: 'j',
    flag: true,
    help: 'Print video info as JSON without downloading'
  })
  .option('printUrl', {
    full: 'print-url',
    flag: true,
    help: 'Print direct download URL'
  })
  .option('noCache', {
    full: 'no-cache',
    flat: true,
    help: 'Skip file cache for html5player'
  })
  .option('debug', {
    flag: true,
    help: 'Print debug information'
  })
  .script('ytdl')
  .colors()
  .parse()
  ;


const path    = require('path');
const fs      = require('fs');
const ytdl    = require('ytdl-core');
const homedir = require('homedir');
const util    = require('../lib/util');

const chalk = require('chalk');
const label = chalk.bold.gray;


if (opts.cache !== false) {
  // Keep cache in file.
  var cachefile = path.resolve(homedir(), '.ytdl-cache.json');
  fs.readFile(cachefile, function(err, contents) {
    if (err) return;
    try {
      ytdl.cache.store = JSON.parse(contents);
    } catch (err) {
      console.error(err.message);
    }
  });

  ytdl.cache.set = function(key, value) {
    ytdl.cache.store[key] = value;
    fs.writeFile(cachefile, JSON.stringify(ytdl.cache.store, null, 2), function() {});
  };
}


/**
 * Prints basic video information.
 *
 * @param {Object} info
 */
function printVideoInfo(info) {
  console.log();
  console.log(label('title: ') + info.title);
  console.log(label('author: ') + info.author.name);
  console.log(label('average rating: ') + info.avg_rating);
  console.log(label('view count: ') + info.view_count);
  console.log(label('length: ') + util.toHumanTime(info.length_seconds));
}

if (opts.infoJson) {
  ytdl.getInfo(opts.url, { debug: opts.debug }, function(err, info) {
    if (err) {
      console.error(err.message);
      process.exit(1);
      return;
    }
    console.log(JSON.stringify(info));
  });
} else if (opts.info) {
  const cliff = require('cliff');
  ytdl.getInfo(opts.url, { debug: opts.debug }, function(err, info) {
    if (err) {
      console.error(err.message);
      process.exit(1);
      return;
    }

    printVideoInfo(info);

    var cols = [
      'itag',
      'container',
      'resolution',
      'video enc',
      'audio bitrate',
      'audio enc'
    ];
    info.formats.forEach(function(format) {
      format['video enc']     = format.encoding;
      format['audio bitrate'] = format.audioBitrate;
      format['audio enc']     = format.audioEncoding;
      cols.forEach(function(col) {
        format[col] = format[col] || '';
      });
    });
    console.log(label('formats:'));
    var colors = ['green', 'blue', 'green', 'blue', 'green', 'blue'];
    console.log(cliff.stringifyObjectRows(info.formats, cols, colors));
  });

} else {
  var output = opts.output;
  var ext = (output || '').match(/(\.\w+)?$/)[1];

  if (output) {
    if (ext && !opts.quality && !opts.filterContainer) {
      opts.filterContainer = '^' + ext.slice(1) + '$';
    }
  }

  var ytdlOptions = {};
  ytdlOptions.quality = /,/.test(opts.quality) ?
    opts.quality.split(',') : opts.quality;
  if (opts.range) {
    var s = opts.range.split('-');
    ytdlOptions.range = { start: s[0], end: s[1] };
  }
  ytdlOptions.begin = opts.begin;

  // Create filters.
  var filters = [];

  /**
   * @param {String} field
   * @param {String} regexpStr
   * @param {Boolean|null} negated
   */
  var createFilter = function(field, regexpStr, negated) {
    try {
      var regexp = new RegExp(regexpStr, 'i');
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }

    filters.push(function(format) {
      return negated !== regexp.test(format[field]);
    });
  };

  ['container', 'resolution', 'encoding'].forEach(function(field) {
    var key = 'filter' + field[0].toUpperCase() + field.slice(1);
    if (opts[key]) {
      createFilter(field, opts[key], false);
    }

    key = 'un' + key;
    if (opts[key]) {
      createFilter(field, opts[key], true);
    }
  });

  // Support basic ytdl-core filters manually, so that other
  // cli filters are supported when used together.
  switch (opts.filter) {
    case 'video':
      filters.push(function(format) {
        return format.bitrate;
      });
      break;

    case 'videoonly':
      filters.push(function(format) {
        return format.bitrate && !format.audioBitrate;
      });
      break;

    case 'audio':
      filters.push(function(format) {
        return format.audioBitrate;
      });
      break;

    case 'audioonly':
      filters.push(function(format) {
        return !format.bitrate && format.audioBitrate;
      });
      break;
  }

  ytdlOptions.filter = function(format) {
    return filters.every(function(filter) {
      return filter(format);
    });
  };

  if (opts.printUrl) {
    ytdl.getInfo(opts.url, { debug: opts.debug }, function(err, info) {
      if (err) {
        console.error(err.message);
        process.exit(1);
        return;
      }
      var format = ytdl.chooseFormat(info.formats, ytdlOptions);
      if (format instanceof Error) {
        console.error(format.message);
        process.exit(1);
        return;
      }
      console.log(format.url);
    });

  } else {
    var readStream = ytdl(opts.url, ytdlOptions);
    var liveBroadcast = false;

    readStream.on('info', function(info, format) {
      if (!output) {
        readStream.pipe(process.stdout).on('error', function(err) {
          console.error(err.message);
          process.exit(1);
        });
        return;
      }

      output = util.tmpl(output, [info, format]);
      if (!ext && format.container) {
        output += '.' + format.container;
      }
      readStream.pipe(fs.createWriteStream(output))
        .on('error', function(err) {
          console.error(err.message);
          process.exit(1);
        });

      // Print information about the video if not streaming to stdout.
      printVideoInfo(info);

      console.log(label('container: ') + format.container);
      console.log(label('resolution: ') + format.resolution);
      console.log(label('encoding: ') + format.encoding);

      liveBroadcast = format.live;
      if (!liveBroadcast) { return; }

      const throttle = require('lodash.throttle');
      var dataRead = 0;
      var updateProgress = throttle(function() {
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(label('size: ') + util.toHumanSize(dataRead) +
                             ' (' + dataRead +' bytes)');
      }, 500);

      readStream.on('data', function(data) {
        dataRead += data.length;
        updateProgress();
      });
    });

    readStream.on('response', function(res) {
      if (!output || liveBroadcast) { return; }

      // Print information about the format we're downloading.
      var size = parseInt(res.headers['content-length'], 10);
      console.log(label('size: ') + util.toHumanSize(size) +
                  ' (' + size +' bytes)');
      console.log(label('output: ') + output);
      console.log();

      // Create progress bar.
      const bar = require('progress-bar').create(process.stdout, 50);
      const throttle = require('lodash.throttle');
      bar.format = '$bar; $percentage;%';

      var lastPercent = null;
      var updateBar = function() {
        var percent = dataRead / size;
        var newPercent = Math.floor(percent * 100);
        if (newPercent != lastPercent) {
          lastPercent = newPercent;
          bar.update(percent);
        }
      };
      var updateBarThrottled = throttle(updateBar, 100, { trailing: false });

      // Keep track of progress.
      var dataRead = 0;
      readStream.on('data', function(data) {
        dataRead += data.length;
        if (dataRead === size) {
          updateBar();
        } else {
          updateBarThrottled();
        }
      });
    });

    readStream.on('error', function(err) {
      console.error(err.message);
      process.exit(1);
    });

    readStream.on('end', function onend() {
      console.log();
    });

    process.on('SIGINT', function onsigint() {
      console.log();
      process.exit();
    });
  }
}
