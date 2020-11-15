# node-ytdl

A youtube downloader written in Javascript. To be used with the command line. If you're looking to use it in your node program, check out [ytdl-core](https://github.com/fent/node-ytdl-core).

![Depfu](https://img.shields.io/depfu/fent/node-ytdl)
[![codecov](https://codecov.io/gh/fent/node-ytdl/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/node-ytdl)

# Usage

Streams to stdout by default

    ytdl "http://www.youtube.com/watch?v=_HSylqgVYQI" | mpv -

To save to a file

    ytdl "http://www.youtube.com/watch?v=_HSylqgVYQI" > myvideo.mp4

or

    ytdl -o "{author.name} - {title}" "http://www.youtube.com/watch?v=_HSylqgVYQI"


Download video and convert to mp3 (Requires ffmpeg)

```bash
ytdl http://www.youtube.com/watch?v=_HSylqgVYQI | ffmpeg -i pipe:0 -b:a 192K -vn myfile.mp3
```


Supported options

    Usage: ytdl <url> [options]

    url     URL to the video.

    Options:
       -v, --version                  Print program version.
       -q ITAG, --quality ITAG        Video quality to download, default: highest
       -r INT-INT, --range INT-INT    Byte range to download, ie 10355705-12452856
       -b INT, --begin INT            Time to begin video, format by 1:30.123 and 1m30s
       -o FILE, --output FILE         Save to file, template by {prop}, default: stdout
       --filter STR                   Can be video, videoonly, audio, audioonly
       --filter-container REGEXP      Filter in format container
       --unfilter-container REGEXP    Filter out format container
       --filter-resolution REGEXP     Filter in format resolution
       --unfilter-resolution REGEXP   Filter out format resolution
       --filter-encoding REGEXP       Filter in format encoding
       --unfilter-encoding REGEXP     Filter out format encoding
       -i, --info                     Print video info without downloading
       -j, --info-json                Print video info as JSON without downloading
       --print-url                    Print direct download URL
       --no-cache                     Skip file cache for html5player
       --debug                        Print debug information


# Install

    npm -g install ytdl


# Tests
Tests are written with [mocha](https://mochajs.org)

```bash
npm test
```
