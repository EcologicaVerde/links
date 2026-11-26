const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const MUSIC_DIR = path.join(ROOT_DIR, 'assets', 'music');
const WALLPAPER_DIR = path.join(ROOT_DIR, 'assets', 'wallpaper');
const MANIFEST_PATH = path.join(ROOT_DIR, 'assets', 'media-manifest.json');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

function listMediaFiles(dirPath, allowedExtensions) {
    if (!fs.existsSync(dirPath)) return [];

    return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(function(entry) {
            if (!entry.isFile() || entry.name.startsWith('.')) return false;
            const ext = path.extname(entry.name).toLowerCase();
            return allowedExtensions.has(ext);
        })
        .map(function(entry) {
            return entry.name;
        })
        .sort(function(a, b) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
}

function sameStringList(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function generateMediaManifest() {
    const music = listMediaFiles(MUSIC_DIR, AUDIO_EXTENSIONS);
    const wallpapers = listMediaFiles(WALLPAPER_DIR, IMAGE_EXTENSIONS);

    let previous = null;
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        } catch (err) {
            previous = null;
        }
    }

    const unchanged = previous
        && sameStringList(previous.music, music)
        && sameStringList(previous.wallpapers, wallpapers);

    if (unchanged) {
        console.log('media-manifest.json já está atualizado (' + music.length + ' músicas, ' + wallpapers.length + ' wallpapers).');
        return;
    }

    const payload = {
        music: music,
        wallpapers: wallpapers,
        generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    console.log('media-manifest.json atualizado com sucesso:', {
        musicCount: music.length,
        wallpapersCount: wallpapers.length
    });
}

generateMediaManifest();
