(function(global) {
    'use strict';

    var WALLPAPER_PRESETS = {
        '1.jpg': { desktopPos: '50% 0%', mobilePos: '78% 6%', originX: '78%' },
        '2.jpg': { desktopPos: '50% 0%', mobilePos: '32% 8%', originX: '32%' },
        '3.jpg': { desktopPos: '50% 0%', mobilePos: '76% 0%', originX: '76%' },
        '4.jpg': { desktopPos: '50% 0%', mobilePos: '78% 10%', originX: '78%' },
        '5.jpg': { desktopPos: '50% 10%', mobilePos: '84% 12%', originX: '84%' },
        '6.jpg': { desktopPos: '50% 0%', mobilePos: '18% 0%', originX: '18%' },
        '7.jpg': { desktopPos: '50% 0%', mobilePos: '76% 0%', originX: '76%' },
        '8.jpg': { desktopPos: '50% 0%', mobilePos: '68% 0%', originX: '68%' },
        '9.jpg': { desktopPos: '50% 0%', mobilePos: '16% 0%', originX: '16%' },
        '10.jpg': { desktopPos: '50% 0%', mobilePos: '34% 8%', originX: '34%' },
        '12.jpg': { desktopPos: '50% 0%', mobilePos: '52% 18%', originX: '50%' }
    };

    function buildWallpaperEntry(filename) {
        var cleanName = String(filename || '').split('/').pop();
        var preset = WALLPAPER_PRESETS[cleanName] || {};
        return {
            file: cleanName,
            src: 'assets/wallpaper/' + cleanName,
            desktopPos: preset.desktopPos || '50% 0%',
            mobilePos: preset.mobilePos || '50% 10%',
            originX: preset.originX || '50%'
        };
    }

    var DEFAULT_FILES = (global.EcologicaMedia && global.EcologicaMedia.fallbackWallpapers)
        ? global.EcologicaMedia.fallbackWallpapers
        : ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg', '10.jpg', '12.jpg'];

    var WALLPAPERS = DEFAULT_FILES.map(buildWallpaperEntry);

    var TRANSITIONS = ['radial', 'wipe-up', 'diagonal-right', 'diagonal-left'];

    var SCENES = {
        hero: {
            id: 'hero',
            accentHex: '#4ade80',
            accentRgb: '74, 222, 128'
        },
        website: {
            id: 'website',
            accentHex: '#22c55e',
            accentRgb: '34, 197, 94'
        },
        bluesky: {
            id: 'bluesky',
            accentHex: '#38bdf8',
            accentRgb: '56, 189, 248'
        },
        twitter: {
            id: 'twitter',
            accentHex: '#e2e8f0',
            accentRgb: '226, 232, 240'
        },
        threads: {
            id: 'threads',
            accentHex: '#d4d4d8',
            accentRgb: '212, 212, 216'
        },
        tiktok: {
            id: 'tiktok',
            accentHex: '#22d3ee',
            accentRgb: '34, 211, 238'
        },
        instagram: {
            id: 'instagram',
            accentHex: '#d946ef',
            accentRgb: '217, 70, 239'
        },
        facebook: {
            id: 'facebook',
            accentHex: '#3b82f6',
            accentRgb: '59, 130, 246'
        },
        discord: {
            id: 'discord',
            accentHex: '#818cf8',
            accentRgb: '129, 140, 248'
        }
    };

    var LINKS_CONFIG = [
        {
            id: 'website',
            nameKey: 'site',
            username: 'ecologica2verde.online',
            url: 'https://ecologica2verde.online/',
            icon: 'fa-globe',
            styleClass: 'website',
            hasFollowers: false,
            useFavicon: true
        },
        {
            id: 'bluesky',
            nameKey: 'bluesky',
            username: '@ecologica.bsky.social',
            url: 'https://bsky.app/profile/ecologica.bsky.social',
            icon: 'fa-bluesky',
            styleClass: 'bluesky',
            hasFollowers: true,
            key: 'bluesky'
        },
        {
            id: 'twitter',
            nameKey: 'twitter',
            username: '@oficialecoverde',
            url: 'https://x.com/oficialecoverde',
            icon: 'fa-x-twitter',
            styleClass: 'twitter',
            hasFollowers: true,
            key: 'twitter'
        },
        {
            id: 'threads',
            nameKey: 'threads',
            username: '@ecologicaverde',
            url: 'https://www.threads.com/@ecologicaverde',
            icon: 'fa-threads',
            styleClass: 'threads',
            hasFollowers: true,
            key: 'threads'
        },
        {
            id: 'tiktok',
            nameKey: 'tiktok',
            username: '@ecologica2verde',
            url: 'https://www.tiktok.com/@ecologica2verde',
            icon: 'fa-tiktok',
            styleClass: 'tiktok',
            hasFollowers: true,
            key: 'tiktok'
        },
        {
            id: 'instagram',
            nameKey: 'instagram',
            username: '@ecologicaverde',
            url: 'https://www.instagram.com/ecologicaverde',
            icon: 'fa-instagram',
            styleClass: 'instagram',
            hasFollowers: true,
            key: 'instagram'
        },
        {
            id: 'facebook',
            nameKey: 'facebook',
            username: 'ecologica2verde',
            url: 'https://www.facebook.com/ecologica2verde',
            icon: 'fa-facebook-f',
            styleClass: 'facebook',
            hasFollowers: true,
            key: 'facebook'
        },
        {
            id: 'discord',
            nameKey: 'discord',
            username: 'Ecológica Verde',
            url: 'https://discord.gg/ZPbzpcPwFf',
            icon: 'fa-discord',
            styleClass: 'discord',
            hasFollowers: true,
            key: 'discord',
            followersLabelKey: 'members'
        }
    ];

    global.EcologicaScenes = {
        wallpapers: WALLPAPERS,
        transitions: TRANSITIONS,
        scenes: SCENES,
        links: LINKS_CONFIG,
        setWallpapers: function(files) {
            if (!Array.isArray(files) || files.length === 0) return;
            var entries = files.map(buildWallpaperEntry);
            WALLPAPERS.length = 0;
            for (var i = 0; i < entries.length; i++) {
                WALLPAPERS.push(entries[i]);
            }
        },
        getScene: function(id) {
            return SCENES[id] || SCENES.hero;
        }
    };
})(window);
