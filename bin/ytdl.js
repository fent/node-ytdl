#!/usr/bin/env node

let url;
const info = require('../package');
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
  .parse(process.argv)
  ;

const chalk = require('chalk');
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


ytdl.cache.sig.timeout = 0;
ytdl.cache.info.timeout = 0;
ytdl.cache.watch.timeout = 0;
ytdl.cache.cookie.timeout = 0;

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
  console.log(label('title: ') + info.videoDetails.title);
  console.log(label('author: ') + info.videoDetails.author.name);
  console.log(label('avg rating: ') + info.videoDetails.averageRating);
  console.log(label('views: ') + info.videoDetails.viewCount);
  if (!live) {
    console.log(label('length: ') + util.toHumanTime(info.videoDetails.lengthSeconds));
  }
};

const onError = (err) => {
  console.error(err.message);
  process.exit(1);
};

if (opts.infoJson) {
  ytdl.getInfo(url).then((info) => {
    console.log(JSON.stringify(info));
  }, onError);
} else if (opts.info) {
  const ListIt = require('list-it');
  ytdl.getInfo(url).then((info) => {
    printVideoInfo(info, info.formats.some(f => f.isLive));

    const formats = info.formats.map((format) => ({
      itag: format.itag,
      container: format.container,
      quality: format.qualityLabel || '',
      codecs: format.codecs,
      bitrate: format.qualityLabel ? util.toHumanSize(format.bitrate) : '',
      'audio bitrate': format.audioBitrate ? format.audioBitrate + 'KB' : '',
      size: format.contentLength ? util.toHumanSize(format.contentLength) : '',
    }));
    console.log(label('formats:'));
    let listit = new ListIt({ headerBold: true, headerColor: 'gray' });
    console.log(listit.d(formats).toString());
  }, onError);

} else {
  let output = opts.output;
  let ext = (output || '').match(/(\.\w+)?$/)[1];

  if (output) {
    if (ext && !opts.quality && !opts.filterContainer) {
      opts.filterContainer = '^' + ext.slice(1) + '$';
    }
  } else if (process.stdout.isTTY) {
    output = '{videoDetails.title}';
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
   * @param {string} name
   * @param {string} field
   * @param {string} regexpStr
   * @param {boolean|null} negated
   */
  const createFilter = (name, field, regexpStr, negated) => {
    let regexp;
    try {
      regexp = new RegExp(regexpStr, 'i');
    } catch (err) {
      onError(err);
    }

    filters.push([name, format => negated !== regexp.test(format[field])]);
  };

  ['container', 'resolution:qualityLabel', 'encoding'].forEach((field) => {
    let [fieldName, fieldKey] = field.split(':');
    fieldKey = fieldKey || fieldName;
    let optsKey = 'filter' + fieldName[0].toUpperCase() + fieldName.slice(1);
    let value = opts[optsKey];
    let name = `${fieldName}=${value}`;
    if (opts[optsKey]) {
      createFilter(name, fieldKey, value, false);
    }

    optsKey = 'un' + optsKey;
    if (opts[optsKey]) {
      createFilter(name, fieldKey, value, true);
    }
  });

  // Support basic ytdl-core filters manually, so that other
  // cli filters are supported when used together.
  const hasVideo = format => !!format.qualityLabel;
  const hasAudio = format => !!format.audioBitrate;
  switch (opts.filter) {
    case 'video':
      filters.push(['video', hasVideo]);
      break;

    case 'videoonly':
      filters.push(['videoonly', format => hasVideo(format) && !hasAudio(format)]);
      break;

    case 'audio':
      filters.push(['audio', hasAudio]);
      break;

    case 'audioonly':
      filters.push(['audioonly', format => !hasVideo(format) && hasAudio(format)]);
      break;
  }

  ytdlOptions.filter = (format) => {
    return filters.every(filter => filter[1](format));
  };

  if (opts.printUrl) {
    ytdl.getInfo(url).then((info) => {
      let format = ytdl.chooseFormat(info.formats, ytdlOptions);
      if (format instanceof Error) {
        onError(format);
        return;
      }
      console.log(format.url);
    }, onError);

  } else {
    const readStream = ytdl(url, ytdlOptions);
    const stdoutMutable = process.stdout && process.stdout.cursorTo && process.stdout.clearLine;


    /**
     * Prints video size with a progress bar as it downloads.
     *
     * @param {number} size
     */
    const printVideoSize = (size) => {
      console.log(label('size: ') + util.toHumanSize(size));
      console.log();
      if (!stdoutMutable) { return; }

      // Create progress bar.
      const CliProgress = require('cli-progress');
      const StreamSpeed = require('streamspeed');
      const bar = new CliProgress.SingleBar({
        format: '{bar} {percentage}% {speed}',
        complete: '#',
        incomplete: '-',
        width: 50,
        total: size,
      }, CliProgress.Presets.shades_grey);
      bar.start(size);
      const ss = new StreamSpeed();
      ss.add(readStream);

      // Keep track of progress.
      const getSpeed = () => ({
        speed: StreamSpeed.toHuman(ss.getSpeed(), { timeUnit: 's', precision: 3 }),
      });
      readStream.on('data', (data) => {
        bar.increment(data.length, getSpeed());
      });

      // Update speed every second, in case download is rate limited,
      // which is the case with `audioonly` formats.
      let iid = setInterval(() => {
        bar.increment(0, getSpeed());
      }, 1000);

      readStream.on('end', () => {
        bar.stop();
        clearInterval(iid);
      });
    };


    /**
     * Prints size of a live video, playlist, or video format that does not
     * have a content size either in its format metadata or its headers.
     */
    const printLiveVideoSize = () => {
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
    };

    readStream.on('info', (info, format) => {
      if (!output) {
        readStream.pipe(process.stdout).on('error', onError);
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

      readStream.pipe(fs.createWriteStream(output)).on('error', onError);

      // Print information about the video if not streaming to stdout.
      printVideoInfo(info, format.isLive);

      // Print format information.
      console.log(label('itag: ') + format.itag);
      console.log(label('container: ') + format.container);
      if (format.qualityLabel) {
        console.log(label('quality: ') + format.qualityLabel);
        console.log(label('video bitrate: ') + util.toHumanSize(format.bitrate));
      }
      if (format.audioBitrate) {
        console.log(label('audio bitrate: ') + format.audioBitrate + 'KB');
      }
      console.log(label('codecs: ') + format.codecs);
      console.log(label('output: ') + output);

      // Print an incremental size if format size is unknown.
      let sizeUnknown = !format.clen &&
        (format.isLive || format.isHLS || format.isDashMPD);

      if (sizeUnknown) {
        printLiveVideoSize();
      } else if (format.contentLength) {
        printVideoSize(parseInt(format.contentLength, 10));
      } else {
        readStream.once('response', (res) => {
          if (res.headers['content-length']) {
            const size = parseInt(res.headers['content-length'], 10);
            printVideoSize(size);
          } else {
            printLiveVideoSize();
          }
        });
      }

    });

    readStream.on('error', (err) => {
      if (/No such format found/.test(err.message) && filters.length) {
        console.error(`No videos matching filters: ${filters.map(filter => filter[0]).join(', ')}`);
      } else {
        console.error(err.message);
      }
      process.exit(1);
    });

    process.on('SIGINT', () => {
      console.log();
      process.exit();
    });
  }
}
