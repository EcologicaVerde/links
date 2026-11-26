const fs = require('fs');
const path = require('path');

const followersFile = path.join(__dirname, 'followers.json');

let followers = {
    twitter: '704',
    instagram: '1477',
    threads: '72',
    tiktok: '368',
    facebook: '37',
    discord: '59981',
    bluesky: '25100',
    lastUpdated: new Date().toISOString()
};

async function fetchJson(url) {
    if (typeof fetch === 'function') {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    const axios = require('axios');
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
    });
    return response.data;
}

async function fetchDiscordMembers() {
    try {
        const data = await fetchJson('https://discord.com/api/v9/invites/ZPbzpcPwFf?with_counts=true');
        if (data && data.approximate_member_count) {
            return data.approximate_member_count.toString();
        }
    } catch (error) {
        console.error('Erro ao buscar Discord via API:', error.message);
    }
    return null;
}

async function fetchBlueskyFollowers() {
    try {
        const data = await fetchJson('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=ecologica.bsky.social');
        if (data && typeof data.followersCount === 'number') {
            return data.followersCount.toString();
        }
    } catch (error) {
        console.error('Erro ao buscar BlueSky via API:', error.message);
    }
    return null;
}

async function updateAllFollowers() {
    console.log('========================================');
    console.log('Iniciando atualização de seguidores...');
    console.log('Data/Hora:', new Date().toLocaleString('pt-BR'));
    console.log('========================================');

    const existingData = JSON.parse(fs.readFileSync(followersFile, 'utf8'));
    followers.twitter = existingData.twitter || followers.twitter;
    followers.instagram = existingData.instagram || followers.instagram;
    followers.threads = existingData.threads || followers.threads;
    followers.tiktok = existingData.tiktok || followers.tiktok;
    followers.facebook = existingData.facebook || followers.facebook;
    followers.discord = existingData.discord || followers.discord;
    followers.bluesky = existingData.bluesky || followers.bluesky;

    console.log('\n📡 Buscando dados do Discord...');
    const discordMembers = await fetchDiscordMembers();
    if (discordMembers) {
        followers.discord = discordMembers;
        console.log('✅ Discord atualizado:', discordMembers, 'membros');
    } else {
        console.log('⚠️ Discord não atualizado, mantendo valor anterior:', followers.discord);
    }

    console.log('\n🦋 Buscando dados do BlueSky...');
    const blueskyFollowers = await fetchBlueskyFollowers();
    if (blueskyFollowers) {
        followers.bluesky = blueskyFollowers;
        console.log('✅ BlueSky atualizado:', blueskyFollowers, 'seguidores');
    } else {
        console.log('⚠️ BlueSky não atualizado, mantendo valor anterior:', followers.bluesky);
    }

    console.log('\n📊 VALORES ATUAIS:');
    console.log('────────────────────────────────────────');
    console.log('🐦 Twitter (manual):', followers.twitter);
    console.log('📸 Instagram (manual):', followers.instagram);
    console.log('🪡 Threads (manual):', followers.threads);
    console.log('🎵 TikTok (manual):', followers.tiktok);
    console.log('📘 Facebook (manual):', followers.facebook);
    console.log('🎮 Discord (automático):', followers.discord);
    console.log('🦋 BlueSky (automático):', followers.bluesky);
    console.log('────────────────────────────────────────');

    followers.lastUpdated = new Date().toISOString();

    fs.writeFileSync(followersFile, JSON.stringify(followers, null, 2), 'utf8');
    console.log('\n✅ Arquivo followers.json atualizado com sucesso!');
    console.log('🕒 Última atualização:', new Date(followers.lastUpdated).toLocaleString('pt-BR'));
    console.log('========================================');
}

updateAllFollowers().catch(error => {
    console.error('❌ Erro durante atualização:', error);
    process.exit(1);
});
