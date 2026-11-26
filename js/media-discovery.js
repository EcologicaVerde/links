(function(global) {
    'use strict';

    var AUDIO_EXT_RE = /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i;
    var IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif)$/i;

    var FALLBACK_MUSIC = ['OST1.mp3', 'OST2.m4a', 'OST3.m4a', 'OST4.m4a'];
    var FALLBACK_WALLPAPERS = [
        '1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg',
        '6.jpg', '7.jpg', '8.jpg', '9.jpg', '10.jpg', '12.jpg'
    ];

    function naturalSort(list) {
        return list.slice().sort(function(a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    function dedupeAndSort(list, extRegex) {
        var seen = Object.create(null);
        var clean = [];
        for (var i = 0; i < list.length; i++) {
            var item = String(list[i] || '').trim().split('/').pop();
            if (!item || item.charAt(0) === '.' || !extRegex.test(item)) continue;
            var key = item.toLowerCase();
            if (!seen[key]) {
                seen[key] = true;
                clean.push(item);
            }
        }
        return naturalSort(clean);
    }

    function formatTrackTitle(filename) {
        var base = String(filename || '').split('/').pop().replace(/\.[^.]+$/, '');
        var ostMatch = base.match(/^ost[\s_-]*(\d+)$/i);
        if (ostMatch) {
            var num = parseInt(ostMatch[1], 10);
            if (!isNaN(num)) {
                return 'OST ' + (num < 10 ? '0' + num : String(num));
            }
        }
        return base.replace(/[_-]+/g, ' ').trim() || filename;
    }

    function isLocalDevServer() {
        if (window.location.protocol === 'file:') return false;
        var host = (window.location.hostname || '').toLowerCase();
        return host === 'localhost'
            || host === '127.0.0.1'
            || host === '[::1]'
            || /^192\.168\./.test(host)
            || /^10\./.test(host)
            || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    }

    function extractFilesFromDirectoryHtml(html, extRegex) {
        if (!html || typeof html !== 'string') return [];
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var anchors = doc.querySelectorAll('a[href]');
        var found = [];

        for (var i = 0; i < anchors.length; i++) {
            var rawHref = anchors[i].getAttribute('href') || '';
            var cleanHref = rawHref.split(/[?#]/)[0];
            if (!cleanHref || cleanHref.charAt(cleanHref.length - 1) === '/' || cleanHref.indexOf('..') !== -1) {
                continue;
            }
            var segment = cleanHref.split('/').pop();
            if (!segment) continue;
            try {
                segment = decodeURIComponent(segment);
            } catch (e) {}

            if (extRegex.test(segment)) {
                found.push(segment);
            }
        }

        return dedupeAndSort(found, extRegex);
    }

    function fetchDirectoryFiles(dirUrl, extRegex) {
        if (typeof fetch !== 'function') return Promise.resolve(null);
        return fetch(dirUrl + '?v=' + Date.now(), { cache: 'no-store' })
            .then(function(res) {
                if (!res.ok) return null;
                var ct = (res.headers.get('content-type') || '').toLowerCase();
                if (ct && ct.indexOf('text/html') === -1 && ct.indexOf('text/plain') === -1) {
                    return null;
                }
                return res.text().then(function(html) {
                    var parsed = extractFilesFromDirectoryHtml(html, extRegex);
                    return parsed.length > 0 ? parsed : null;
                });
            })
            .catch(function() {
                return null;
            });
    }

    function fetchManifest() {
        if (window.location.protocol === 'file:' || typeof fetch !== 'function') {
            return Promise.resolve(null);
        }
        var url = 'assets/media-manifest.json?v=' + Math.floor(Date.now() / 15000);
        return fetch(url, { cache: 'no-store' })
            .then(function(res) {
                if (!res.ok) return null;
                return res.json();
            })
            .catch(function() {
                return null;
            });
    }

    var discoveryPromise = null;

    function discoverAll() {
        if (discoveryPromise) return discoveryPromise;

        var dirMusicPromise = isLocalDevServer()
            ? fetchDirectoryFiles('assets/music/', AUDIO_EXT_RE)
            : Promise.resolve(null);
        var dirWallpaperPromise = isLocalDevServer()
            ? fetchDirectoryFiles('assets/wallpaper/', IMAGE_EXT_RE)
            : Promise.resolve(null);
        var manifestPromise = fetchManifest();

        discoveryPromise = Promise.all([dirMusicPromise, dirWallpaperPromise, manifestPromise])
            .then(function(results) {
                var dirMusic = results[0];
                var dirWallpapers = results[1];
                var manifest = results[2];

                var manifestMusic = (manifest && Array.isArray(manifest.music))
                    ? dedupeAndSort(manifest.music, AUDIO_EXT_RE)
                    : [];
                var manifestWallpapers = (manifest && Array.isArray(manifest.wallpapers))
                    ? dedupeAndSort(manifest.wallpapers, IMAGE_EXT_RE)
                    : [];

                return Promise.all([
                    (!dirMusic && !manifest) ? fetchDirectoryFiles('assets/music/', AUDIO_EXT_RE) : Promise.resolve(dirMusic),
                    (!dirWallpapers && !manifest) ? fetchDirectoryFiles('assets/wallpaper/', IMAGE_EXT_RE) : Promise.resolve(dirWallpapers)
                ]).then(function(resolvedDirs) {
                    var finalDirMusic = resolvedDirs[0];
                    var finalDirWallpapers = resolvedDirs[1];

                    var music = (finalDirMusic && finalDirMusic.length > 0)
                        ? finalDirMusic
                        : (manifestMusic.length > 0 ? manifestMusic : FALLBACK_MUSIC.slice());

                    var wallpapers = (finalDirWallpapers && finalDirWallpapers.length > 0)
                        ? finalDirWallpapers
                        : (manifestWallpapers.length > 0 ? manifestWallpapers : FALLBACK_WALLPAPERS.slice());

                    return {
                        music: music,
                        wallpapers: wallpapers,
                        source: (finalDirMusic || finalDirWallpapers) ? 'directory' : (manifest ? 'manifest' : 'fallback')
                    };
                });
            })
            .catch(function() {
                return {
                    music: FALLBACK_MUSIC.slice(),
                    wallpapers: FALLBACK_WALLPAPERS.slice(),
                    source: 'fallback'
                };
            });

        return discoveryPromise;
    }

    global.EcologicaMedia = {
        fallbackMusic: FALLBACK_MUSIC,
        fallbackWallpapers: FALLBACK_WALLPAPERS,
        formatTrackTitle: formatTrackTitle,
        naturalSort: naturalSort,
        dedupeAudio: function(list) { return dedupeAndSort(list || [], AUDIO_EXT_RE); },
        dedupeImages: function(list) { return dedupeAndSort(list || [], IMAGE_EXT_RE); },
        discoverAll: discoverAll
    };
})(window);
