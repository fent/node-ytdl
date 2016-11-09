# node-ytdl

A youtube downloader written in Javascript. To be used with the command line. If you're looking to use it in your node program, check out [ytdl-core](https://github.com/fent/node-ytdl-core).

[![Build Status](https://secure.travis-ci.org/fent/node-ytdl.svg)](http://travis-ci.org/fent/node-ytdl)
[![Dependency Status](https://gemnasium.com/fent/node-ytdl.svg)](https://gemnasium.com/fent/node-ytdl)
[![codecov](https://codecov.io/gh/fent/node-ytdl/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/node-ytdl)

# Usage

    ytdl http://www.youtube.com/watch?v=_HSylqgVYQI > myvideo.webm

And it streams!

    Usage: ytdl <url> [options]

    url     URL to the video.

    Options:
       -v, --version                  Print program version.
       -q ITAG, --quality ITAG        Video quality to download. Default: highest
       -r INT-INT, --range INT-INT    Byte range to download. ie 10355705-12452856
       -o FILE, --output FILE         Where to save the file. Default: stdout
       --filter-container REGEXP      Filter in format container. Default: -o ext
       --unfilter-container REGEXP    Filter out format container.
       --filter-resolution REGEXP     Filter in format resolution.
       --unfilter-resolution REGEXP   Filter out format resolution.
       --filter-encoding REGEXP       Filter in format encoding.
       --unfilter-encoding REGEXP     Filter out format encoding.
       -i, --info                     Print video info without downloading
       --print-url                    Print direct download url

# Install

    [sudo] npm -g install ytdl


# Tests
Tests are written with [mocha](http://visionmedia.github.com/mocha/)

```bash
npm test
```

# License
MIT
