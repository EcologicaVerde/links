(function(global) {
    'use strict';

    var FALLBACK_FILES = ['OST1.mp3', 'OST2.m4a', 'OST3.m4a', 'OST4.m4a'];

    function cryptoRandomInt(max) {
        if (max <= 1) return 0;
        if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
            var range = 0x100000000;
            var limit = range - (range % max);
            var buf = new Uint32Array(1);
            do {
                global.crypto.getRandomValues(buf);
            } while (buf[0] >= limit);
            return buf[0] % max;
        }
        return Math.floor(Math.random() * max);
    }

    function buildShuffledOrder(length, avoidFirstIndex) {
        var order = [];
        for (var i = 0; i < length; i++) {
            order.push(i);
        }
        for (var j = order.length - 1; j > 0; j--) {
            var k = cryptoRandomInt(j + 1);
            var tmp = order[j];
            order[j] = order[k];
            order[k] = tmp;
        }
        if (length > 1 && avoidFirstIndex >= 0 && order[0] === avoidFirstIndex) {
            var swapIdx = 1 + cryptoRandomInt(length - 1);
            var first = order[0];
            order[0] = order[swapIdx];
            order[swapIdx] = first;
        }
        return order;
    }

    function formatTime(sec) {
        if (!isFinite(sec) || sec < 0) return '00:00';
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function formatTrackTitle(filename) {
        if (global.EcologicaMedia && typeof global.EcologicaMedia.formatTrackTitle === 'function') {
            return global.EcologicaMedia.formatTrackTitle(filename);
        }
        var base = String(filename || '').split('/').pop().replace(/\.[^.]+$/, '');
        var ostMatch = base.match(/^ost[\s_-]*(\d+)$/i);
        if (ostMatch) {
            var num = parseInt(ostMatch[1], 10);
            if (!isNaN(num)) {
                return 'OST ' + (num < 10 ? '0' + num : String(num));
            }
        }
        return base || filename;
    }

    function sameList(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function MusicEngine(onStateChange, options) {
        this.onStateChange = onStateChange || function() {};
        this.audio = document.createElement('audio');
        this.audio.preload = 'auto';
        this.audio.setAttribute('playsinline', '');

        this.playlist = [];
        this.playOrder = [];
        this.orderCursor = 0;
        this.songIndex = 0;
        this.failedAttempts = 0;
        this.started = false;
        this.pendingGesturePlay = false;
        this.gestureBound = false;

        var savedVol = parseInt(localStorage.getItem('musicVolume'), 10);
        this.targetVolume = (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 100) ? savedVol / 100 : 0.65;

        var savedState = localStorage.getItem('musicState');
        this.wantsAutoplay = savedState !== 'false';
        this.isPlaying = false;
        this.awaitingGesture = false;
        this.fadeTimer = null;

        this.bindAudioEvents();
        this.initGestureUnlock();

        if (!options || !options.deferStart) {
            this.start(options && options.initialFiles);
        }
    }

    MusicEngine.prototype.start = function(initialFiles) {
        var files = (Array.isArray(initialFiles) && initialFiles.length > 0)
            ? initialFiles.slice()
            : ((global.EcologicaMedia && global.EcologicaMedia.fallbackMusic)
                ? global.EcologicaMedia.fallbackMusic.slice()
                : FALLBACK_FILES.slice());

        this.started = true;
        this.playlist = files;
        this.playOrder = buildShuffledOrder(this.playlist.length, -1);
        this.orderCursor = 0;
        this.songIndex = this.playOrder[0] || 0;
        this.failedAttempts = 0;

        this.loadTrack(this.songIndex, false);
        this.attemptInitialAutoplay();
    };

    MusicEngine.prototype.attemptInitialAutoplay = function() {
        var self = this;
        if (!this.wantsAutoplay && !this.pendingGesturePlay) return;

        var useFade = this.pendingGesturePlay;
        this.pendingGesturePlay = false;
        this.tryPlay(useFade);

        this.audio.addEventListener('canplay', function onCanPlay() {
            self.audio.removeEventListener('canplay', onCanPlay);
            if (self.wantsAutoplay && !self.isPlaying) {
                self.tryPlay(false);
            }
        });
    };

    MusicEngine.prototype.setPlaylist = function(newFiles) {
        if (!Array.isArray(newFiles) || newFiles.length === 0) return;
        if (!this.started) {
            this.start(newFiles);
            return;
        }
        if (sameList(this.playlist, newFiles)) return;

        var currentFile = this.playlist[this.songIndex];
        this.playlist = newFiles.slice();
        this.failedAttempts = 0;

        // If playback hasn't actually started yet, re-draw so new tracks participate on open
        if (!this.isPlaying && (this.audio.currentTime || 0) === 0) {
            this.playOrder = buildShuffledOrder(this.playlist.length, -1);
            this.orderCursor = 0;
            this.loadTrack(this.playOrder[0], this.wantsAutoplay);
            return;
        }

        // Already playing: keep current track active and reshuffle remaining tracks
        var keptIdx = this.playlist.indexOf(currentFile);
        if (keptIdx === -1) {
            this.playOrder = buildShuffledOrder(this.playlist.length, -1);
            this.orderCursor = 0;
            this.loadTrack(this.playOrder[0], this.wantsAutoplay);
            return;
        }

        var remaining = [];
        for (var i = 0; i < this.playlist.length; i++) {
            if (i !== keptIdx) remaining.push(i);
        }
        for (var j = remaining.length - 1; j > 0; j--) {
            var k = cryptoRandomInt(j + 1);
            var tmp = remaining[j];
            remaining[j] = remaining[k];
            remaining[k] = tmp;
        }
        this.playOrder = [keptIdx].concat(remaining);
        this.orderCursor = 0;
        this.songIndex = keptIdx;
        this.notify();
    };

    MusicEngine.prototype.bindAudioEvents = function() {
        var self = this;

        this.audio.addEventListener('ended', function() {
            self.failedAttempts = 0;
            self.next(true);
        });

        this.audio.addEventListener('play', function() {
            self.failedAttempts = 0;
            self.isPlaying = true;
            self.awaitingGesture = false;
            self.notify();
        });

        this.audio.addEventListener('pause', function() {
            if (!self.audio.ended) {
                self.isPlaying = false;
                self.notify();
            }
        });

        this.audio.addEventListener('timeupdate', function() {
            self.notify(true);
        });

        this.audio.addEventListener('loadedmetadata', function() {
            self.notify(true);
        });

        this.audio.addEventListener('error', function() {
            if (!self.started || self.playlist.length <= 1) return;
            self.failedAttempts += 1;
            if (self.failedAttempts < self.playlist.length) {
                self.next(self.wantsAutoplay || self.isPlaying);
            }
        });
    };

    MusicEngine.prototype.fadeInVolume = function() {
        var self = this;
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        var startVol = Math.min(0.05, this.targetVolume);
        this.audio.volume = startVol;
        var stepCount = 12;
        var currentStep = 0;

        this.fadeTimer = setInterval(function() {
            currentStep++;
            var ratio = currentStep / stepCount;
            self.audio.volume = Math.min(1, Math.max(0, startVol + (self.targetVolume - startVol) * ratio));
            if (currentStep >= stepCount) {
                clearInterval(self.fadeTimer);
                self.fadeTimer = null;
                self.audio.volume = self.targetVolume;
            }
        }, 35);
    };

    MusicEngine.prototype.tryPlay = function(withFade) {
        var self = this;
        if (!this.audio || !this.started) return Promise.resolve(false);
        if (this.audio.error) {
            this.audio.load();
        }

        if (withFade) {
            this.audio.volume = Math.min(0.05, this.targetVolume);
        } else {
            this.audio.volume = this.targetVolume;
        }

        var playPromise;
        try {
            playPromise = this.audio.play();
        } catch (err) {
            this.awaitingGesture = this.wantsAutoplay;
            this.notify();
            return Promise.resolve(false);
        }

        if (playPromise && typeof playPromise.then === 'function') {
            return playPromise.then(function() {
                self.isPlaying = true;
                self.awaitingGesture = false;
                if (withFade) self.fadeInVolume();
                self.notify();
                return true;
            }).catch(function(err) {
                if (err && err.name === 'AbortError') {
                    return false;
                }
                self.isPlaying = false;
                if (self.wantsAutoplay) {
                    self.awaitingGesture = true;
                }
                self.notify();
                return false;
            });
        }

        this.isPlaying = !this.audio.paused;
        this.notify();
        return Promise.resolve(this.isPlaying);
    };

    MusicEngine.prototype.initGestureUnlock = function() {
        if (this.gestureBound) return;
        this.gestureBound = true;

        var self = this;
        var events = ['click', 'touchend', 'keydown'];

        function onGesture() {
            if (!self.wantsAutoplay || self.isPlaying) return;
            if (!self.started) {
                self.pendingGesturePlay = true;
                return;
            }
            self.tryPlay(true).then(function(started) {
                if (started) {
                    removeAll();
                }
            });
        }

        function removeAll() {
            events.forEach(function(evt) {
                window.removeEventListener(evt, onGesture, true);
            });
        }

        events.forEach(function(evt) {
            window.addEventListener(evt, onGesture, { capture: true, passive: true });
        });
    };

    MusicEngine.prototype.loadTrack = function(index, shouldPlay) {
        var total = this.playlist.length;
        if (total === 0) return;

        this.songIndex = ((index % total) + total) % total;
        var file = this.playlist[this.songIndex];
        this.audio.src = 'assets/music/' + encodeURIComponent(file);
        this.audio.load();
        this.notify();

        if (shouldPlay) {
            this.wantsAutoplay = true;
            localStorage.setItem('musicState', 'true');
            this.tryPlay(false);
        }
    };

    MusicEngine.prototype.toggle = function() {
        if (!this.started) return;
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.wantsAutoplay = false;
            this.awaitingGesture = false;
            localStorage.setItem('musicState', 'false');
            this.notify();
        } else {
            this.wantsAutoplay = true;
            this.awaitingGesture = false;
            localStorage.setItem('musicState', 'true');
            this.tryPlay(true);
        }
    };

    MusicEngine.prototype.prev = function(forcePlay) {
        if (!this.started || this.playlist.length === 0) return;
        this.orderCursor = (this.orderCursor - 1 + this.playOrder.length) % this.playOrder.length;
        this.loadTrack(this.playOrder[this.orderCursor], forcePlay || this.isPlaying || this.wantsAutoplay);
    };

    MusicEngine.prototype.next = function(forcePlay) {
        if (!this.started || this.playlist.length === 0) return;
        if (this.orderCursor + 1 >= this.playOrder.length) {
            this.playOrder = buildShuffledOrder(this.playlist.length, this.songIndex);
            this.orderCursor = 0;
        } else {
            this.orderCursor += 1;
        }
        this.loadTrack(this.playOrder[this.orderCursor], forcePlay || this.isPlaying || this.wantsAutoplay);
    };

    MusicEngine.prototype.setVolume = function(pct) {
        var clamped = Math.max(0, Math.min(100, pct));
        this.targetVolume = clamped / 100;
        if (this.fadeTimer) {
            clearInterval(this.fadeTimer);
            this.fadeTimer = null;
        }
        this.audio.volume = this.targetVolume;
        localStorage.setItem('musicVolume', String(clamped));
    };

    MusicEngine.prototype.getState = function() {
        var duration = this.audio.duration || 0;
        var current = this.audio.currentTime || 0;
        var progress = duration > 0 ? (current / duration) * 100 : 0;
        var file = this.playlist[this.songIndex] || '';

        return {
            songIndex: this.songIndex,
            file: file,
            title: file ? formatTrackTitle(file) : 'OST',
            trackCount: this.playlist.length,
            isPlaying: this.isPlaying,
            wantsAutoplay: this.wantsAutoplay,
            awaitingGesture: this.awaitingGesture,
            volumePercent: Math.round(this.targetVolume * 100),
            currentFormatted: formatTime(current),
            durationFormatted: formatTime(duration),
            progress: progress
        };
    };

    MusicEngine.prototype.notify = function(timeOnly) {
        this.onStateChange(this.getState(), !!timeOnly);
    };

    global.MusicEngine = MusicEngine;
})(window);
