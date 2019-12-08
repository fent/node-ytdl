#!/usr/bin/env node

let url;
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
  .option('-o, --output <FILE>', 'Save to file, template by {prop}, default: stdout or {title}')
  .option('--filter <STR>',
    'Can be video, videoonly, audio, audioonly',
    /^(video|audio)(only)?$/)
  .option('--filter-container <REGEXP>', 'Filter in format container')
  .option('--unfilter-container <REGEXP>', 'Filter out format container')
  .option('--filter-resolution <REGEXP>', 'Filter in format resolution')
  .option('--unfilter-resolution <REGEXP>', 'Filter out format resolution')
  .option('--filter-codecs <REGEXP>', 'Filter in format codecs')
  .option('--unfilter-codecs <REGEXP>', 'Filter out format codecs')
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

const label = chalk.bold.gray;


ytdl.cache.info.timeout = 0;
if (opts.cache !== false) {
  // Keep cache in file.
  const cachefile = path.resolve(homedir(), '.ytdl-cache.json');
  let cache = {};
  fs.readFile(cachefile, (err, contents) => {
    if (err) return;
    try {
      cache = JSON.parse(contents);
    } catch (err) {
      console.error(`Badly formatted cachefile (${cachefile}): ${err.message}`);
    }
  });

  ytdl.cache.sig.get = key => cache[key];
  ytdl.cache.sig.set = (key, value) => {
    cache[key] = value;
    fs.writeFile(cachefile,
      JSON.stringify(cache, null, 2), () => {});
  };
}


/**
 * Prints basic video information.
 *
 * @param {Object} info
 * @param {boolean} live
 */
const printVideoInfo = (info, live) => {
  console.log();
  console.log(label('title: ') + info.title);
  console.log(label('author: ') + info.author.name);
  console.log(label('avg rating: ') +
    info.player_response.videoDetails.averageRating);
  console.log(label('views: ') +
    info.player_response.videoDetails.viewCount);
  if (!live) {
    console.log(label('length: ') + util.toHumanTime(info.length_seconds));
  }
};

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

    printVideoInfo(info, info.formats.some(f => f.live));

    const cols = [
      'itag',
      'container',
      'quality',
      'codecs',
      'bitrate',
      'audio bitrate'
    ];
    info.formats.forEach((format) => {
      format['quality'] = format.qualityLabel;
      format['bitrate'] = format.qualityLabel ?
        util.toHumanSize(format.bitrate) : null;
      format['audio bitrate'] = format.audioBitrate ?
        format.audioBitrate + 'KB' : null;
      cols.forEach((col) => {
        format[col] = format[col] || '';
      });
    });
    console.log(label('formats:'));
    const colors = ['green', 'blue', 'green', 'blue', 'green', 'blue'];
    console.log(cliff.stringifyObjectRows(info.formats, cols, colors));
  });

} else {
  let output = opts.output;
  let ext = (output || '').match(/(\.\w+)?$/)[1];

  if (output) {
    if (ext && !opts.quality && !opts.filterContainer) {
      opts.filterContainer = '^' + ext.slice(1) + '$';
    }
  } else if (process.stdout.isTTY) {
    output = '{title}';
  }

  const ytdlOptions = {};
  ytdlOptions.quality = /,/.test(opts.quality) ?
    opts.quality.split(',') : opts.quality;
  if (opts.range) {
    let s = opts.range.split('-');
    ytdlOptions.range = { start: s[0], end: s[1] };
  }
  ytdlOptions.begin = opts.begin;

  // Create filters.
  const filters = [];

  /**
   * @param {string} field
   * @param {string} regexpStr
   * @param {boolean|null} negated
   */
  const createFilter = (field, regexpStr, negated) => {
    let regexp;
    try {
      regexp = new RegExp(regexpStr, 'i');
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }

    filters.push(format => negated !== regexp.test(format[field]));
  };

  ['container', 'resolution:qualityLabel', 'encoding'].forEach((field) => {
    let [fieldName, fieldKey] = field.split(':');
    let optsKey = 'filter' + fieldName[0].toUpperCase() + fieldName.slice(1);
    if (opts[optsKey]) {
      createFilter(fieldKey, opts[optsKey], false);
    }

    optsKey = 'un' + optsKey;
    if (opts[optsKey]) {
      createFilter(fieldKey, opts[optsKey], true);
    }
  });

  // Support basic ytdl-core filters manually, so that other
  // cli filters are supported when used together.
  const hasVideo = format => !!format.qualityLabel;
  const hasAudio = format => !!format.audioBitrate;
  switch (opts.filter) {
    case 'video':
      filters.push(hasVideo);
      break;

    case 'videoonly':
      filters.push(format => hasVideo(format) && !hasAudio(format));
      break;

    case 'audio':
      filters.push(hasAudio);
      break;

    case 'audioonly':
      filters.push(format => !hasVideo(format) && hasAudio(format));
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
      let format = ytdl.chooseFormat(info.formats, ytdlOptions);
      if (format instanceof Error) {
        console.error(format.message);
        process.exit(1);
        return;
      }
      console.log(format.url);
    });

  } else {
    const readStream = ytdl(url, ytdlOptions);
    const stdoutMutable = process.stdout && process.stdout.cursorTo && process.stdout.clearLine;
    let isPlaylist = false;

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
      let parsedOutput = path.parse(output);
      output = path.format({
        dir: parsedOutput.dir,
        base: parsedOutput.base,
      });

      readStream.pipe(fs.createWriteStream(output))
        .on('error', (err) => {
          console.error(err.message);
          process.exit(1);
        });

      isPlaylist = format.live || format.isHLS || format.isDashMPD;

      // Print information about the video if not streaming to stdout.
      printVideoInfo(info, isPlaylist);

      console.log(label('container: ') + format.container);
      if (format.qualityLabel) {
        console.log(label('quality: ') + format.qualityLabel);
        console.log(label('bitrate: ') + util.toHumanSize(format.bitrate));
      }
      if (format.audioBitrate) {
        console.log(label('audio bitrate: ') + format.audioBitrate + 'KB');
      }
      console.log(label('codecs: ') + format.codecs);
      if (!isPlaylist) { return; }

      const throttle = require('lodash.throttle');
      let dataRead = 0;
      const updateProgress = throttle(() => {
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        let line = label('size: ') + util.toHumanSize(dataRead);
        if (dataRead >= 1024) {
          line += ` (${dataRead} bytes)`;
        }
        process.stdout.write(line);
      }, 500);

      readStream.on('data', (data) => {
        dataRead += data.length;
        if (stdoutMutable) {
          updateProgress();
        }
      });

      readStream.on('end', () => {
        if (stdoutMutable) {
          updateProgress.flush();
          console.log();
        } else {
          console.log('\n' + label('downloaded: ') + util.toHumanSize(dataRead));
        }
      });
    });

    readStream.once('response', (res) => {
      if (!output || isPlaylist) { return; }

      // Print information about the format we're downloading.
      const size = parseInt(res.headers['content-length'], 10);
      console.log(label('size: ') + util.toHumanSize(size) +
                  ' (' + size +' bytes)');
      console.log(label('output: ') + output);
      console.log();
      if (!stdoutMutable) { return; }

      // Create progress bar.
      const bar = require('progress-bar').create(process.stdout, 50);
      const throttle = require('lodash.throttle');
      bar.format = '$bar; $percentage;%';

      let lastPercent = null;
      let updateBar = () => {
        let percent = dataRead / size;
        let newPercent = Math.floor(percent * 100);
        if (newPercent != lastPercent) {
          lastPercent = newPercent;
          bar.update(percent);
        }
      };
      let updateBarThrottled = throttle(updateBar, 100, { trailing: false });

      // Keep track of progress.
      let dataRead = 0;
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
