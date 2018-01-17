#!/usr/bin/env node

var url;
const info = require('../package');
const chalk = require('chalk');
const opts = require('commander')
  .version(info.version)
  .arguments('<url>')
  .action((a) => { url = a; })
  .option('-q, --quality <ITAG>',
    'Video quality to download, default: highest')
  .option('-r, --range <INT>..<INT>',
    'Byte range to download, ie 10355705-12452856')
  .option('-b, --begin <INT>', 'Time to begin video, format by 1:30.123 and 1m30s')
  .option('-o, --output <FILE>', 'Save to file, template by {prop}, default: stdout')
  .option('--filter <STR>',
    'Can be video, videoonly, audio, audioonly',
    /^(video|audio)(only)?$/)
  .option('--filter-container <REGEXP>', 'Filter in format container')
  .option('--unfilter-container <REGEXP>', 'Filter out format container')
  .option('--filter-resolution <REGEXP>', 'Filter in format resolution')
  .option('--unfilter-resolution <REGEXP>', 'Filter out format resolution')
  .option('--filter-encoding <REGEXP>', 'Filter in format encoding')
  .option('--unfilter-encoding <REGEXP>', 'Filter out format encoding')
  .option('-i, --info', 'Print video info without downloading')
  .option('-j, --info-json', 'Print video info as JSON without downloading')
  .option('--print-url', 'Print direct download URL')
  .option('--no-cache', 'Skip file cache for html5player')
  .option('--debug', 'Print debug information')
  .parse(process.argv)
  ;

if (!url) {
  opts.outputHelp((help) => {
    return chalk.red('\n  url argument is required\n') + help;
  });
  process.exit(1);
}

const path         = require('path');
const fs           = require('fs');
const ytdl         = require('ytdl-core');
const homedir      = require('homedir');
const util         = require('../lib/util');
const sanitizeName = require('sanitize-filename');

const label = chalk.bold.gray;


if (opts.cache !== false) {
  // Keep cache in file.
  var cachefile = path.resolve(homedir(), '.ytdl-cache.json');
  var cache = {};
  fs.readFile(cachefile, (err, contents) => {
    if (err) return;
    try {
      cache = JSON.parse(contents);
    } catch (err) {
      console.error(`Badly formatted cachefile (${cachefile}): ${err.message}`);
    }
  });

  ytdl.cache.get = key => cache[key];
  ytdl.cache.set = (key, value) => {
    cache[key] = value;
    fs.writeFile(cachefile,
      JSON.stringify(cache, null, 2), () => {});
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
  ytdl.getInfo(url, { debug: opts.debug }, (err, info) => {
    if (err) {
      console.error(err.message);
      process.exit(1);
      return;
    }
    console.log(JSON.stringify(info));
  });
} else if (opts.info) {
  const cliff = require('cliff');
  ytdl.getInfo(url, { debug: opts.debug }, (err, info) => {
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
    info.formats.forEach((format) => {
      format['video enc']     = format.encoding;
      format['audio bitrate'] = format.audioBitrate;
      format['audio enc']     = format.audioEncoding;
      cols.forEach((col) => {
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
  var createFilter = (field, regexpStr, negated) => {
    try {
      var regexp = new RegExp(regexpStr, 'i');
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }

    filters.push(format => negated !== regexp.test(format[field]));
  };

  ['container', 'resolution', 'encoding'].forEach((field) => {
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
      filters.push(format => format.bitrate);
      break;

    case 'videoonly':
      filters.push(format => format.bitrate && !format.audioBitrate);
      break;

    case 'audio':
      filters.push(format => format.audioBitrate);
      break;

    case 'audioonly':
      filters.push(format => !format.bitrate && format.audioBitrate);
      break;
  }

  ytdlOptions.filter = (format) => {
    return filters.every(filter => filter(format));
  };

  if (opts.printUrl) {
    ytdl.getInfo(url, { debug: opts.debug }, (err, info) => {
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
    var readStream = ytdl(url, ytdlOptions);
    var liveBroadcast = false;
    var stdoutMutable = process.stdout && process.stdout.cursorTo && process.stdout.clearLine;

    readStream.on('info', (info, format) => {
      if (!output) {
        readStream.pipe(process.stdout).on('error', (err) => {
          console.error(err.message);
          process.exit(1);
        });
        return;
      }

      output = util.tmpl(output, [info, format]);
      if (!ext && format.container) {
        output += '.' + format.container;
      }

      // Parses & sanitises output filename for any illegal characters
      var parsedOutput = path.parse(output);
      output = path.format({
        dir: parsedOutput.dir,
        base: sanitizeName(parsedOutput.base)
      });

      readStream.pipe(fs.createWriteStream(output))
        .on('error', (err) => {
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
      var updateProgress = throttle(() => {
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(label('size: ') + util.toHumanSize(dataRead) +
                             ' (' + dataRead +' bytes)');
      }, 500);

      readStream.on('data', (data) => {
        dataRead += data.length;
        if (stdoutMutable) {
          updateProgress();
        }
      });

      readStream.on('end', () => {
        if (stdoutMutable) {
          console.log(label('downloaded: ') + util.toHumanSize(dataRead));
        }
        console.log();
      })
    });

    readStream.on('response', (res) => {
      if (!output || liveBroadcast) { return; }

      // Print information about the format we're downloading.
      var size = parseInt(res.headers['content-length'], 10);
      console.log(label('size: ') + util.toHumanSize(size) +
                  ' (' + size +' bytes)');
      console.log(label('output: ') + output);
      console.log();
      if (!stdoutMutable) { return; }

      // Create progress bar.
      const bar = require('progress-bar').create(process.stdout, 50);
      const throttle = require('lodash.throttle');
      bar.format = '$bar; $percentage;%';

      var lastPercent = null;
      var updateBar = () => {
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
      readStream.on('data', (data) => {
        dataRead += data.length;
        if (dataRead === size) {
          updateBar();
        } else {
          updateBarThrottled();
        }
      });

      readStream.on('end', () => {
        console.log();
      });
    });

    readStream.on('error', (err) => {
      console.error(err.message);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      console.log();
      process.exit();
    });
  }
}
