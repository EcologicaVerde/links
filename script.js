(function() {
    'use strict';

    var followersData = {
        twitter: '2125',
        instagram: '1526',
        threads: '84',
        tiktok: '392',
        facebook: '42',
        discord: '59751',
        bluesky: '25200'
    };

    var currentLanguage = 'pt';
    var activeSceneId = 'hero';
    var activeWallpaperSrc = null;
    var wallpaperQueue = [];
    var activeLayerIndex = 0;
    var countUpDone = false;
    var stageFX = null;
    var musicEngine = null;
    var hoverResetTimer = null;
    var ambientCycleTimer = null;
    var ambientPauseUntil = 0;
    var lastTouchCardId = null;
    var isTouchEnvironment = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

    function getT() {
        return window.EcologicaI18n.get(currentLanguage);
    }

    function formatNumber(num) {
        if (!num || num === '0') return '0';
        var n = parseInt(num, 10);
        if (isNaN(n)) return '0';
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
        return n.toLocaleString(getT().htmlLang || 'pt-BR');
    }

    function formatExact(num) {
        var n = parseInt(num, 10);
        if (isNaN(n)) return '0';
        return n.toLocaleString(getT().htmlLang || 'pt-BR');
    }

    function computeTotalReach() {
        return Object.keys(followersData).reduce(function(sum, key) {
            var val = parseInt(followersData[key], 10);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    }

    function animateValue(el, target, formatter, durationMs) {
        if (!el) return;
        var startTime = null;

        function tick(now) {
            if (!startTime) startTime = now;
            var elapsed = now - startTime;
            var progress = Math.min(elapsed / durationMs, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(target * eased);
            el.textContent = formatter(current);
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = formatter(target);
            }
        }

        requestAnimationFrame(tick);
    }

    function showToast(message) {
        var toast = document.getElementById('toastMessage');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(function() {
            toast.classList.remove('show');
        }, 2800);
    }

    /* =========================================================
       RANDOM NON-SEQUENTIAL WALLPAPER SHUFFLER (DYNAMIC MEDIA)
       ========================================================= */
    function sameWallpaperList(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if ((a[i] && a[i].src) !== b[i]) return false;
        }
        return true;
    }

    function updateWallpapersCatalog(wallpaperFiles) {
        if (!Array.isArray(wallpaperFiles) || wallpaperFiles.length === 0) return;
        var expectedSrcs = wallpaperFiles.map(function(name) {
            return 'assets/wallpaper/' + String(name).split('/').pop();
        });
        if (sameWallpaperList(window.EcologicaScenes.wallpapers, expectedSrcs)) return;
        if (window.EcologicaScenes.setWallpapers) {
            window.EcologicaScenes.setWallpapers(wallpaperFiles);
            wallpaperQueue = [];
        }
    }

    function refillWallpaperQueue() {
        var list = window.EcologicaScenes.wallpapers.slice();
        for (var i = list.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
        if (activeWallpaperSrc && list.length > 1 && list[0].src === activeWallpaperSrc) {
            var swapIdx = 1 + Math.floor(Math.random() * (list.length - 1));
            var t = list[0];
            list[0] = list[swapIdx];
            list[swapIdx] = t;
        }
        wallpaperQueue = list;
    }

    function pickRandomWallpaper() {
        if (wallpaperQueue.length === 0) {
            refillWallpaperQueue();
        }
        var nextItem = wallpaperQueue.shift();
        activeWallpaperSrc = nextItem.src;
        warmUpcomingWallpapers();
        return nextItem;
    }

    function warmUpcomingWallpapers() {
        if (wallpaperQueue.length === 0) {
            refillWallpaperQueue();
        }
        var lookahead = Math.min(2, wallpaperQueue.length);
        for (var i = 0; i < lookahead; i++) {
            var img = new Image();
            img.src = encodeURI(wallpaperQueue[i].src);
        }
    }

    function applyWallpaperTransition(wallItem, immediate) {
        var layerA = document.getElementById('bgLayerA');
        var layerB = document.getElementById('bgLayerB');
        if (!layerA || !layerB || !wallItem) return;

        var transitions = window.EcologicaScenes.transitions;
        var randomTrans = transitions[Math.floor(Math.random() * transitions.length)];

        var incoming = activeLayerIndex === 0 ? layerB : layerA;
        var outgoing = activeLayerIndex === 0 ? layerA : layerB;
        if (immediate) {
            incoming = layerA;
            outgoing = layerB;
            activeLayerIndex = 0;
        } else {
            activeLayerIndex = activeLayerIndex === 0 ? 1 : 0;
        }

        incoming.className = 'bg-layer';
        incoming.style.backgroundImage = 'url("' + encodeURI(wallItem.src) + '")';
        incoming.style.setProperty('--bg-pos-desktop', wallItem.desktopPos || '50% 0%');
        incoming.style.setProperty('--bg-pos-mobile', wallItem.mobilePos || '50% 8%');
        incoming.style.setProperty('--bg-origin-x', wallItem.originX || '50%');
        void incoming.offsetWidth;

        if (immediate) {
            incoming.classList.add('is-active');
            outgoing.className = 'bg-layer';
        } else {
            incoming.classList.add('is-active', 'trans-' + randomTrans);
            outgoing.className = 'bg-layer is-leaving';
        }
    }

    function setSceneAccent(sceneId) {
        var scene = window.EcologicaScenes.getScene(sceneId);
        if (!scene) return;
        activeSceneId = scene.id;
        document.body.setAttribute('data-active-scene', scene.id);

        // Changes UI accent colors only — wallpaper overlay tint remains fixed Ecológica Verde green
        var root = document.documentElement;
        root.style.setProperty('--accent-hex', scene.accentHex);
        root.style.setProperty('--accent-rgb', scene.accentRgb);

        updateCardSpotlightActiveState(scene.id);

        if (stageFX) {
            stageFX.setScene(scene);
        }
    }

    function triggerSocialTransition(sceneId, immediate) {
        setSceneAccent(sceneId);
        var nextWall = pickRandomWallpaper();
        applyWallpaperTransition(nextWall, immediate);
    }

    function updateCardSpotlightActiveState(sceneId) {
        var cards = document.querySelectorAll('.link-item');
        cards.forEach(function(card) {
            var isMatch = card.getAttribute('data-scene-id') === sceneId;
            card.classList.toggle('is-spotlight', isTouchEnvironment && isMatch);
        });
    }

    function scheduleAccentRestore() {
        clearTimeout(hoverResetTimer);
        hoverResetTimer = setTimeout(function() {
            setSceneAccent('hero');
        }, 260);
    }

    function initParallaxAndTouchTransitions() {
        if (!isTouchEnvironment) {
            window.addEventListener('pointermove', function(e) {
                var nx = (e.clientX / window.innerWidth - 0.5) * -12;
                // Keep vertical parallax positive (0..6px) so top head area never clips off-screen
                var ny = (e.clientY / window.innerHeight) * 6;
                document.documentElement.style.setProperty('--parallax-x', nx.toFixed(1) + 'px');
                document.documentElement.style.setProperty('--parallax-y', ny.toFixed(1) + 'px');
            }, { passive: true });
        }

        var hubCard = document.getElementById('hubCard');
        if (hubCard) {
            hubCard.addEventListener('pointermove', function(e) {
                var rect = hubCard.getBoundingClientRect();
                hubCard.style.setProperty('--card-mx', (e.clientX - rect.left) + 'px');
                hubCard.style.setProperty('--card-my', (e.clientY - rect.top) + 'px');
            }, { passive: true });
        }

        var linksContainer = document.getElementById('linksContainer');
        if (linksContainer) {
            linksContainer.addEventListener('touchmove', function(e) {
                if (!e.touches || !e.touches[0]) return;
                var el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
                var card = el && el.closest ? el.closest('.link-item') : null;
                if (card) {
                    var sid = card.getAttribute('data-scene-id');
                    if (sid && sid !== lastTouchCardId) {
                        lastTouchCardId = sid;
                        ambientPauseUntil = Date.now() + 10000;
                        triggerSocialTransition(sid, false);
                    }
                }
            }, { passive: true });
        }

        if (isTouchEnvironment) {
            ambientCycleTimer = setInterval(function() {
                if (Date.now() < ambientPauseUntil) return;
                var links = window.EcologicaScenes.links;
                var randomLink = links[Math.floor(Math.random() * links.length)];
                triggerSocialTransition(randomLink.id, false);
            }, 6000);
        }
    }

    function buildLink(link, index) {
        var scene = window.EcologicaScenes.getScene(link.id);
        var t = getT();
        var a = document.createElement('a');
        a.href = link.url;
        a.className = 'link-item';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-scene-id', link.id);
        a.style.setProperty('--item-rgb', scene.accentRgb);
        a.style.setProperty('--item-hex', scene.accentHex);
        a.style.animationDelay = (0.04 + index * 0.035) + 's';

        var labelText = link.followersLabelKey === 'members' ? t.members : t.followers;
        var rightBadgeHtml = '';

        if (link.hasFollowers && followersData[link.key]) {
            var rawCount = followersData[link.key];
            rightBadgeHtml =
                '<span class="link-followers" data-count-key="' + link.key + '" title="' + formatExact(rawCount) + ' ' + labelText + '">' +
                    '<i class="fas fa-users" aria-hidden="true"></i>' +
                    '<span class="follower-num">' + formatNumber(rawCount) + '</span>' +
                    '<span class="follower-unit">' + labelText + '</span>' +
                '</span>';
        } else {
            rightBadgeHtml =
                '<span class="link-cta-pill">' +
                    '<span>' + t.visitAction + '</span>' +
                '</span>';
        }

        var iconHtml = '';
        if (link.useFavicon) {
            iconHtml = '<img src="assets/logo/favicon.png" alt="">';
        } else if (link.styleClass === 'bluesky') {
            iconHtml = '<svg viewBox="0 0 600 530" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M135.72 44.03C202.67 91.75 274.79 189.53 300 243.67c25.21-54.14 97.33-151.92 164.28-199.64C501.96 13.87 540 3.46 540 56.46c0 11.95-6.97 100.52-11.06 114.99-14.22 50.24-65.23 63.04-110.77 55.31 79.59 13.55 99.87 58.45 56.12 103.39-82.94 85.32-119.22-21.39-128.51-48.72 0 0 1.84 63.55 5.28 102.68C358.6 442.22 336.38 530 300 530s-58.6-87.78-51.06-145.63C252.39 345.3 254.09 281.75 254.09 281.75c-9.29 27.33-45.57 134.04-128.51 48.72-43.75-44.94-23.47-89.84 56.12-103.39-45.54 7.73-96.55-5.07-110.77-55.31C67.04 156.98 60 68.41 60 56.46c0-53 38.04-42.59 75.72-12.43z"/></svg>';
        } else {
            iconHtml = '<i class="fa-brands ' + link.icon + '" aria-hidden="true"></i>';
        }

        var linkName = t[link.nameKey] || link.nameKey;

        a.innerHTML =
            '<div class="link-left">' +
                '<div class="icon-box ' + link.styleClass + '">' + iconHtml + '</div>' +
                '<div class="link-info">' +
                    '<span class="link-label">' + linkName + '</span>' +
                    '<span class="link-user">' + link.username + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="link-right">' +
                rightBadgeHtml +
                '<i class="fas fa-arrow-right link-arrow" aria-hidden="true"></i>' +
            '</div>';

        a.addEventListener('mouseenter', function() {
            clearTimeout(hoverResetTimer);
            triggerSocialTransition(link.id, false);
        });

        a.addEventListener('mouseleave', function() {
            if (!isTouchEnvironment) {
                scheduleAccentRestore();
            }
        });

        a.addEventListener('focus', function() {
            clearTimeout(hoverResetTimer);
            triggerSocialTransition(link.id, false);
        });

        a.addEventListener('blur', function() {
            if (!isTouchEnvironment) {
                scheduleAccentRestore();
            }
        });

        a.addEventListener('touchstart', function() {
            lastTouchCardId = link.id;
            ambientPauseUntil = Date.now() + 10000;
            triggerSocialTransition(link.id, false);
        }, { passive: true });

        return a;
    }

    function renderLinks(animateStats) {
        var container = document.getElementById('linksContainer');
        if (!container) return;
        container.innerHTML = '';

        var links = window.EcologicaScenes.links;
        for (var i = 0; i < links.length; i++) {
            container.appendChild(buildLink(links[i], i));
        }

        var totalReach = computeTotalReach();
        var totalEl = document.getElementById('totalReachValue');
        if (totalEl) {
            if (animateStats && !countUpDone) {
                countUpDone = true;
                animateValue(totalEl, totalReach, function(val) {
                    return formatNumber(val) + '+';
                }, 850);

                document.querySelectorAll('.link-followers').forEach(function(badge) {
                    var key = badge.getAttribute('data-count-key');
                    var numSpan = badge.querySelector('.follower-num');
                    var target = parseInt(followersData[key], 10);
                    if (numSpan && !isNaN(target)) {
                        animateValue(numSpan, target, formatNumber, 800);
                    }
                });
            } else {
                totalEl.textContent = formatNumber(totalReach) + '+';
            }
        }
    }

    function loadFollowers() {
        var cacheBust = 'followers.json?v=' + Math.floor(Date.now() / 60000);
        if (window.location.protocol !== 'file:' && typeof fetch === 'function') {
            fetch(cacheBust, { cache: 'no-store' })
                .then(function(res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(applyFollowersData)
                .catch(function() {
                    renderLinks(true);
                });
        } else {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', 'followers.json', true);
                xhr.timeout = 4000;
                xhr.onload = function() {
                    if (xhr.status === 200 || xhr.status === 0) {
                        try {
                            applyFollowersData(JSON.parse(xhr.responseText));
                            return;
                        } catch (e) {}
                    }
                    renderLinks(true);
                };
                xhr.onerror = function() { renderLinks(true); };
                xhr.ontimeout = function() { renderLinks(true); };
                xhr.send();
            } catch (e) {
                renderLinks(true);
            }
        }
    }

    function applyFollowersData(data) {
        if (data && typeof data === 'object') {
            ['twitter', 'instagram', 'threads', 'tiktok', 'facebook', 'discord', 'bluesky'].forEach(function(k) {
                if (data[k]) followersData[k] = String(data[k]);
            });
        }
        renderLinks(true);
    }

    function updateLanguage() {
        var t = getT();
        document.documentElement.lang = t.htmlLang;
        document.title = t.pageTitle;

        var titleEl = document.getElementById('siteTitle');
        if (titleEl) {
            titleEl.innerHTML = 'Ecológica <span class="title-underline">Verde</span>';
        }

        var map = {
            siteSubtitle: t.subtitle,
            nonprofitText: t.nonprofit,
            statTotalLabel: t.statTotalLabel,
            statLinksLabel: t.statLinksLabel,
            copyLinkText: t.copyLink,
            whatsappText: t.whatsapp,
            qrCodeText: t.qrCode,
            qrTitle: t.qrTitle,
            qrInstruction: t.qrInstruction,
            qrDownloadText: t.qrDownload,
            musicSectionTitle: t.musicSection,
            shareTitleText: t.shareSection,
            currentLanguageLabel: t.languageName,
            currentLanguageShort: t.languageShort
        };

        Object.keys(map).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = map[id];
        });

        var prevBtn = document.getElementById('prevBtn');
        var nextBtn = document.getElementById('nextBtn');
        var toggleBtn = document.getElementById('musicToggle');
        var drawerBtn = document.getElementById('musicDrawerToggle');
        if (prevBtn) prevBtn.setAttribute('aria-label', t.musicPrevLabel);
        if (nextBtn) nextBtn.setAttribute('aria-label', t.musicNextLabel);
        if (toggleBtn) toggleBtn.setAttribute('aria-label', t.musicToggleLabel);
        if (drawerBtn) drawerBtn.setAttribute('aria-label', t.musicExpandLabel);

        document.querySelectorAll('.lang-option').forEach(function(opt) {
            opt.classList.toggle('is-active', opt.getAttribute('data-lang') === currentLanguage);
        });

        renderLinks(false);
        if (musicEngine) {
            syncMusicUI(musicEngine.getState(), false);
        }
    }

    function initLanguageSelector() {
        var savedLang = localStorage.getItem('language');
        if (savedLang && window.EcologicaI18n.translations[savedLang]) {
            currentLanguage = savedLang;
        }

        var selector = document.getElementById('languageSelector');
        var menuBtn = document.getElementById('languageMenuBtn');
        var dropdown = document.getElementById('languageDropdown');

        if (menuBtn && dropdown && selector) {
            menuBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var open = dropdown.classList.toggle('show');
                selector.classList.toggle('is-open', open);
                menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            document.addEventListener('click', function() {
                dropdown.classList.remove('show');
                selector.classList.remove('is-open');
                menuBtn.setAttribute('aria-expanded', 'false');
            });

            dropdown.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        document.querySelectorAll('.lang-option').forEach(function(option) {
            option.addEventListener('click', function() {
                currentLanguage = this.getAttribute('data-lang');
                localStorage.setItem('language', currentLanguage);
                updateLanguage();
                if (dropdown) dropdown.classList.remove('show');
                if (selector) selector.classList.remove('is-open');
                if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
            });
        });
    }

    function syncMusicUI(state, timeOnly) {
        var panel = document.getElementById('musicPanel');
        var timer = document.getElementById('musicTimer');
        var progress = document.getElementById('musicProgressFill');
        if (timer) timer.textContent = state.currentFormatted;
        if (progress) progress.style.width = state.progress.toFixed(1) + '%';

        if (timeOnly) return;

        var trackTitle = state.title || state.file || 'OST';
        var nowPlayingEl = document.getElementById('nowPlaying');
        var volumeSlider = document.getElementById('volumeSlider');
        var volumeValue = document.getElementById('volumeValue');

        if (nowPlayingEl) nowPlayingEl.textContent = trackTitle;
        if (panel) panel.classList.toggle('is-playing', state.isPlaying);
        if (volumeSlider) volumeSlider.value = state.volumePercent;
        if (volumeValue) volumeValue.textContent = state.volumePercent + '%';
    }

    function initAudioHUD() {
        musicEngine = new window.MusicEngine(syncMusicUI, { deferStart: true });

        var panel = document.getElementById('musicPanel');
        var toggleBtn = document.getElementById('musicToggle');
        var prevBtn = document.getElementById('prevBtn');
        var nextBtn = document.getElementById('nextBtn');
        var drawerBtn = document.getElementById('musicDrawerToggle');
        var volumeSlider = document.getElementById('volumeSlider');
        var volumeValue = document.getElementById('volumeValue');

        if (toggleBtn) toggleBtn.addEventListener('click', function() { musicEngine.toggle(); });
        if (prevBtn) prevBtn.addEventListener('click', function() { musicEngine.prev(); });
        if (nextBtn) nextBtn.addEventListener('click', function() { musicEngine.next(); });

        if (drawerBtn && panel) {
            drawerBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var open = panel.classList.toggle('is-drawer-open');
                drawerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            document.addEventListener('click', function(e) {
                if (!panel.contains(e.target)) {
                    panel.classList.remove('is-drawer-open');
                    drawerBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', function() {
                var val = parseInt(this.value, 10);
                musicEngine.setVolume(val);
                if (volumeValue) volumeValue.textContent = val + '%';
            });
        }

        syncMusicUI(musicEngine.getState(), false);
    }

    function getShareUrl() {
        return window.location.protocol === 'file:'
            ? 'https://ecologicaverde.online/'
            : window.location.href;
    }

    function initShareFeatures() {
        var copyBtn = document.getElementById('copyLinkBtn');
        var whatsappBtn = document.getElementById('whatsappBtn');
        var qrBtn = document.getElementById('qrCodeBtn');
        var modal = document.getElementById('qrModal');
        var closeBtn = document.getElementById('qrCloseBtn');
        var downloadBtn = document.getElementById('qrDownloadBtn');

        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var url = getShareUrl();
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(function() {
                        showToast(getT().linkCopied);
                    }).catch(function() { fallbackCopy(url); });
                } else {
                    fallbackCopy(url);
                }
            });
        }

        function fallbackCopy(text) {
            var input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(input);
            showToast(getT().linkCopied);
        }

        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', function() {
                var url = getShareUrl();
                var text = encodeURIComponent(getT().whatsappShare + url);
                window.open('https://wa.me/?text=' + text, '_blank', 'noopener,noreferrer');
            });
        }

        if (qrBtn && modal) {
            qrBtn.addEventListener('click', function() {
                var container = document.getElementById('qrCodeContainer');
                if (container && typeof window.QRCode === 'function') {
                    container.innerHTML = '';
                    new window.QRCode(container, {
                        text: getShareUrl(),
                        width: 192,
                        height: 192,
                        colorDark: '#050806',
                        colorLight: '#ffffff',
                        correctLevel: window.QRCode.CorrectLevel.H
                    });
                }
                modal.hidden = false;
            });
        }

        function closeModal() {
            if (modal) modal.hidden = true;
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
        });

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                var container = document.getElementById('qrCodeContainer');
                if (!container) return;
                var canvas = container.querySelector('canvas');
                var img = container.querySelector('img');
                var dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
                if (!dataUrl) return;
                var link = document.createElement('a');
                link.download = 'ecologica-verde-qr.png';
                link.href = dataUrl;
                link.click();
                showToast(getT().qrDownloaded);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        var canvas = document.getElementById('fxCanvas');
        if (canvas && window.OptimusStageFX) {
            stageFX = new window.OptimusStageFX(canvas);
        }

        initLanguageSelector();
        initAudioHUD();
        updateLanguage();
        initParallaxAndTouchTransitions();
        initShareFeatures();
        loadFollowers();

        var discoveryPromise = (window.EcologicaMedia && window.EcologicaMedia.discoverAll)
            ? window.EcologicaMedia.discoverAll()
            : Promise.resolve(null);

        var timeoutPromise = new Promise(function(resolve) {
            setTimeout(function() { resolve(null); }, 350);
        });

        var booted = false;

        Promise.race([discoveryPromise, timeoutPromise]).then(function(media) {
            booted = true;
            if (media && media.wallpapers) {
                updateWallpapersCatalog(media.wallpapers);
            }
            if (musicEngine) {
                musicEngine.start(media && media.music ? media.music : null);
            }
            triggerSocialTransition('hero', true);
        });

        discoveryPromise.then(function(media) {
            if (!booted || !media) return;
            if (media.wallpapers) {
                updateWallpapersCatalog(media.wallpapers);
            }
            if (musicEngine && media.music && musicEngine.setPlaylist) {
                musicEngine.setPlaylist(media.music);
            }
        });
    });
})();
