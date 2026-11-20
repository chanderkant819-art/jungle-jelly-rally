const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- 30 DISTINCT STAGES GENERATOR ---
const STAGE_THEMES = [
    {
        name: 'Sunny Meadow',
        skyTop: '#9be7ff', skyMid: '#dcf8ec', skyBot: '#98e6be',
        hillColor: '#7fd19b', riverColor: '#6ad5fa',
        sandColor: '#f5d4a8', earthColor: '#be7d58', grassColor: '#52be69', pebbleColor: '#deb27d',
        jellyColor: '#b983ff', jellyDotColor: '#ffe066'
    },
    {
        name: 'Bubble Lagoon',
        skyTop: '#8ce0ff', skyMid: '#d9f7ff', skyBot: '#86decb',
        hillColor: '#63c4b2', riverColor: '#38bdf8',
        sandColor: '#fff0b3', earthColor: '#539c96', grassColor: '#2fb096', pebbleColor: '#e5cf7e',
        jellyColor: '#ff758f', jellyDotColor: '#fff3b0'
    },
    {
        name: 'Candy Valley',
        skyTop: '#ffc8dd', skyMid: '#fff0f6', skyBot: '#bde0fe',
        hillColor: '#f4a5b8', riverColor: '#90e0ef',
        sandColor: '#ffe5d9', earthColor: '#ad7884', grassColor: '#ff7aa2', pebbleColor: '#f2a2b2',
        jellyColor: '#72efdd', jellyDotColor: '#ffbe0b'
    },
    {
        name: 'Amber Canyon',
        skyTop: '#ffd166', skyMid: '#fff3cc', skyBot: '#f8b179',
        hillColor: '#e09f67', riverColor: '#5bc0eb',
        sandColor: '#f6bd60', earthColor: '#9c523b', grassColor: '#8ac926', pebbleColor: '#d48c46',
        jellyColor: '#9b5de5', jellyDotColor: '#fee440'
    },
    {
        name: 'Crystal Forest',
        skyTop: '#b8f2e6', skyMid: '#eafcf6', skyBot: '#a2d2ff',
        hillColor: '#76c893', riverColor: '#48cae4',
        sandColor: '#e9ecef', earthColor: '#6c757d', grassColor: '#38b000', pebbleColor: '#adb5bd',
        jellyColor: '#f15bb5', jellyDotColor: '#00bbf9'
    },
    {
        name: 'Rainbow Summit',
        skyTop: '#cdb4db', skyMid: '#fff1e6', skyBot: '#bee1e6',
        hillColor: '#b892ff', riverColor: '#72efdd',
        sandColor: '#fde2e4', earthColor: '#8d6e63', grassColor: '#ff9e00', pebbleColor: '#f7b267',
        jellyColor: '#4cc9f0', jellyDotColor: '#ffd166'
    }
];

const STAGES = Array.from({ length: 30 }, (_, idx) => {
    const theme = STAGE_THEMES[idx % STAGE_THEMES.length];
    const diff = idx / 29;
    const trackLength = 5600 + idx * 140;
    const jellyCount = 6 + Math.floor(idx * 0.45);
    const jellies = [];
    const usableSpan = trackLength - 950;
    for (let j = 0; j < jellyCount; j++) {
        jellies.push(Math.round(720 + ((j + 0.5) / jellyCount) * usableSpan));
    }

    return {
        index: idx,
        name: `${theme.name} ${Math.floor(idx / STAGE_THEMES.length) + 1}`,
        trackLength,
        waveAmp1: 36 + diff * 54,
        waveFreq1: 0.0021 + diff * 0.0016,
        waveAmp2: 14 + diff * 22,
        waveFreq2: 0.0048 + diff * 0.0034,
        bounceVy: -(17.2 + diff * 5.2),
        ...theme,
        jellies
    };
});

// --- 5 CARS + CHALLENGE UNLOCKS ---
const CARS = [
    {
        id: 'sky', name: 'Sky Racer',
        body: '#5bc0eb', cabin: '#90e0ef', stripe: '#ffe066', badge: '1',
        reqText: 'Starter Car', isUnlocked: () => true
    },
    {
        id: 'sunny', name: 'Sunny Buggy',
        body: '#ffd166', cabin: '#fff0b3', stripe: '#ff6b6b', badge: '2',
        reqText: 'Collect 8 ⭐', isUnlocked: (p) => p.totalStars >= 8
    },
    {
        id: 'berry', name: 'Berry Zoomer',
        body: '#ff758f', cabin: '#ffc2d1', stripe: '#ffe066', badge: '3',
        reqText: '3 Jelly Boings', isUnlocked: (p) => p.totalBounces >= 3
    },
    {
        id: 'mint', name: 'Mint Hopper',
        body: '#6bcb77', cabin: '#c7f9cc', stripe: '#fff3b0', badge: '4',
        reqText: 'Clear Stage 1', isUnlocked: (p) => p.unlockedStage >= 1
    },
    {
        id: 'comet', name: 'Star Comet',
        body: '#b983ff', cabin: '#e0aaff', stripe: '#72efdd', badge: '5',
        reqText: 'Collect 30 ⭐', isUnlocked: (p) => p.totalStars >= 30
    }
];

// --- SAVED PROGRESS ---
const STORAGE_KEY = 'jjr_30stages_progress_v1';
let progress = loadProgress();
let currentStageIndex = Math.min(progress.unlockedStage, STAGES.length - 1);
let currentCarIndex = 0;

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            return {
                unlockedStage: Math.min(29, Math.max(0, p.unlockedStage ?? 0)),
                totalStars: p.totalStars ?? 0,
                totalBounces: p.totalBounces ?? 0
            };
        }
    } catch (e) {}
    return { unlockedStage: 0, totalStars: 0, totalBounces: 0 };
}

function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {}
}

// --- GENUINE MULTI-LAYERED WEB AUDIO ENGINE ---
let audioCtx = null;
let muted = false;
let engineOsc = null;
let engineGain = null;

function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        setupEngineHum();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function setupEngineHum() {
    if (!audioCtx || engineOsc) return;
    engineOsc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    engineGain = audioCtx.createGain();

    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 68;

    filter.type = 'lowpass';
    filter.frequency.value = 240;

    engineGain.gain.value = 0.0001;

    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function updateEngineHum(active, speedRatio) {
    if (!audioCtx || !engineOsc || !engineGain) return;
    const now = audioCtx.currentTime;
    if (muted || !active || gameWon) {
        engineGain.gain.setTargetAtTime(0.0001, now, 0.08);
        return;
    }
    const targetFreq = 64 + Math.min(1.6, Math.max(0, speedRatio)) * 52;
    const targetVol = 0.025 + Math.min(0.03, speedRatio * 0.02);
    engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
}

function playNoiseBurst(duration, freqStart, freqEnd, volume) {
    if (muted || !audioCtx) return;
    const now = audioCtx.currentTime;
    const sampleCount = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), now + duration);
    filter.Q.value = 1.6;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
}

function playSound(type) {
    if (muted || !audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === 'jump') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.17);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.19);
        playNoiseBurst(0.08, 900, 300, 0.08);
    } else if (type === 'star') {
        [659.25, 987.77, 1318.5].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = i === 0 ? 'triangle' : 'sine';
            const t = now + i * 0.055;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.18 / (i + 1), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(t); osc.stop(t + 0.25);
        });
    } else if (type === 'boing') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.22);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.34);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.37);
        playNoiseBurst(0.12, 420, 180, 0.12);
    } else if (type === 'boost') {
        playNoiseBurst(0.32, 320, 1400, 0.22);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.28);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.31);
    } else if (type === 'win') {
        const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        chord.forEach((freq, idx) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = idx % 2 === 0 ? 'triangle' : 'sine';
            const t = now + idx * 0.1;
            o.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.2, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t); o.stop(t + 0.46);
        });
    }
}

// --- GAME STATE ---
let gameStarted = false;
let gameWon = false;
let cameraX = 0;
let stageStars = 0;
let frameCount = 0;
let keys = { right: false };

const car = {
    x: 160, y: 0, width: 112, height: 66,
    vx: 0, vy: 0, wheelAngle: 0, squash: 1,
    grounded: false, boostTimer: 0
};

let jellies = [];
let stars = [];
let particles = [];
let floatingTexts = [];
let confetti = [];
let clouds = [];

function initClouds() {
    clouds = Array.from({ length: 8 }, (_, i) => ({
        x: i * 260 + Math.random() * 90,
        y: 55 + (i % 3) * 42 + Math.random() * 18,
        scale: 0.7 + (i % 3) * 0.22,
        speed: 0.18 + (i % 4) * 0.06
    }));
}
initClouds();

function getStage() { return STAGES[currentStageIndex]; }
function getCar() { return CARS[currentCarIndex]; }

function getRoadY(worldX) {
    const st = getStage();
    const base = canvas.height * 0.74;
    return base + Math.sin(worldX * st.waveFreq1) * st.waveAmp1 + Math.cos(worldX * st.waveFreq2) * st.waveAmp2;
}

function getRoadSlope(worldX) {
    const dy = getRoadY(worldX + 8) - getRoadY(worldX - 8);
    return Math.atan2(dy, 16);
}

function updateLiveChallengeBanner() {
    const banner = document.getElementById('challengeBanner');
    const textEl = document.getElementById('challengeText');
    if (!gameStarted || gameWon) {
        banner.classList.add('hidden');
        return;
    }
    banner.classList.remove('hidden');

    if (progress.totalStars < 8) {
        textEl.innerText = `Unlock Sunny Buggy: ${Math.min(8, progress.totalStars)}/8 ⭐`;
    } else if (progress.totalBounces < 3) {
        textEl.innerText = `Unlock Berry Zoomer: ${Math.min(3, progress.totalBounces)}/3 Jelly Boings`;
    } else if (currentStageIndex < STAGES.length - 1) {
        textEl.innerText = `Reach GOAL to unlock Stage ${currentStageIndex + 2} of 30!`;
    } else {
        textEl.innerText = `Unlock Star Comet: ${Math.min(30, progress.totalStars)}/30 ⭐`;
    }
}

function renderPickers() {
    const stagePicker = document.getElementById('stagePicker');
    stagePicker.innerHTML = '';
    STAGES.forEach((st, idx) => {
        const unlocked = idx <= progress.unlockedStage;
        const btn = document.createElement('button');
        btn.className = `pick-card ${idx === currentStageIndex ? 'active' : ''} ${!unlocked ? 'locked' : ''}`;
        btn.innerHTML = `
            <span class="pick-title">${unlocked ? `Stage ${idx + 1}` : `🔒 ${idx + 1}`}</span>
            <span class="pick-sub">${unlocked ? st.name : `Clear Stg ${idx}`}</span>
        `;
        if (unlocked) {
            btn.addEventListener('click', () => {
                buildLevel(idx);
                renderPickers();
            });
        }
        stagePicker.appendChild(btn);
    });

    const carPicker = document.getElementById('carPicker');
    carPicker.innerHTML = '';
    CARS.forEach((c, idx) => {
        const unlocked = c.isUnlocked(progress);
        if (!unlocked && idx === currentCarIndex) currentCarIndex = 0;
        const btn = document.createElement('button');
        btn.className = `pick-card ${idx === currentCarIndex ? 'active' : ''} ${!unlocked ? 'locked' : ''}`;
        btn.innerHTML = `
            <span class="car-swatch" style="background:${c.body}"></span>
            <span class="pick-title">${unlocked ? c.name : `🔒 ${c.name}`}</span>
            <span class="pick-sub">${unlocked ? 'Ready!' : c.reqText}</span>
        `;
        if (unlocked) {
            btn.addEventListener('click', () => {
                currentCarIndex = idx;
                renderPickers();
            });
        }
        carPicker.appendChild(btn);
    });
}

function buildLevel(stageIdx = currentStageIndex) {
    currentStageIndex = stageIdx;
    const st = getStage();
    document.getElementById('stageBadge').innerText = `Stage ${currentStageIndex + 1}/30 • ${st.name}`;

    jellies = [];
    stars = [];
    particles = [];
    floatingTexts = [];
    confetti = [];
    stageStars = 0;
    cameraX = 0;
    gameWon = false;

    car.x = 160;
    car.y = getRoadY(160) - car.height;
    car.vx = 0;
    car.vy = 0;
    car.boostTimer = 0;
    document.getElementById('scoreText').innerText = progress.totalStars;

    st.jellies.forEach((jx, idx) => {
        jellies.push({
            x: jx, width: 82, height: 58,
            wobblePhase: idx * 1.3, hitSquash: 0
        });
    });

    for (let x = 420; x < st.trackLength - 320; x += 180) {
        const nearJelly = st.jellies.some(jx => Math.abs(jx - x) < 115);
        const arcOffset = nearJelly ? 135 : (Math.sin(x * 0.01) > 0 ? 84 : 38);
        stars.push({
            x: x, y: getRoadY(x) - arcOffset,
            collected: false, bobPhase: x * 0.02
        });
    }
    updateLiveChallengeBanner();
}

// --- CONTROLS ---
function triggerJump() {
    if (!gameStarted || gameWon) return;
    if (car.grounded) {
        car.vy = -16.2;
        car.grounded = false;
        car.squash = 1.26;
        playSound('jump');
        spawnDust(car.x, car.y + car.height, 9);
    }
}

function triggerBoost() {
    if (!gameStarted || gameWon) return;
    car.boostTimer = 58;
    car.squash = 1.15;
    playSound('boost');
}

window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault(); initAudio(); triggerJump();
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { initAudio(); keys.right = true; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { initAudio(); triggerBoost(); }
});

window.addEventListener('keyup', e => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

function bindHoldButton(btnId, onDown, onUp) {
    const btn = document.getElementById(btnId);
    const start = e => { e.preventDefault(); initAudio(); btn.classList.add('pressed'); onDown(); };
    const end = e => { e.preventDefault(); btn.classList.remove('pressed'); if (onUp) onUp(); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
}

bindHoldButton('jumpBtn', triggerJump);
bindHoldButton('gasBtn', () => { keys.right = true; }, () => { keys.right = false; });
bindHoldButton('boostBtn', triggerBoost);

document.getElementById('muteBtn').addEventListener('click', () => {
    initAudio();
    muted = !muted;
    document.getElementById('muteBtn').innerText = muted ? '🔇' : '🔊';
    if (muted) updateEngineHum(false, 0);
});

document.getElementById('stageMenuBtn').addEventListener('click', () => {
    gameStarted = false;
    updateEngineHum(false, 0);
    updateLiveChallengeBanner();
    renderPickers();
    document.getElementById('winOverlay').classList.add('hidden');
    document.getElementById('startOverlay').classList.remove('hidden');
});

document.getElementById('startBtn').addEventListener('click', () => {
    initAudio();
    buildLevel(currentStageIndex);
    gameStarted = true;
    updateLiveChallengeBanner();
    document.getElementById('startOverlay').classList.add('hidden');
});

document.getElementById('nextStageBtn').addEventListener('click', () => {
    initAudio();
    const nextIdx = (currentStageIndex + 1) % STAGES.length;
    buildLevel(nextIdx);
    gameStarted = true;
    updateLiveChallengeBanner();
    document.getElementById('winOverlay').classList.add('hidden');
});

document.getElementById('garageBtn').addEventListener('click', () => {
    gameWon = false;
    updateEngineHum(false, 0);
    updateLiveChallengeBanner();
    renderPickers();
    document.getElementById('winOverlay').classList.add('hidden');
    document.getElementById('startOverlay').classList.remove('hidden');
});

document.getElementById('replayBtn').addEventListener('click', () => {
    initAudio();
    buildLevel(currentStageIndex);
    gameStarted = true;
    updateLiveChallengeBanner();
    document.getElementById('winOverlay').classList.add('hidden');
});

// --- PARTICLES & POPUPS ---
function spawnDust(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 32, y: y - 4,
            vx: -1.6 - Math.random() * 2.6, vy: -0.6 - Math.random() * 2.2,
            size: 5 + Math.random() * 6, alpha: 1, color: '#fff8dc'
        });
    }
}

function spawnSparkles(x, y, color) {
    for (let i = 0; i < 16; i++) {
        const ang = (Math.PI * 2 * i) / 16;
        const spd = 2.2 + Math.random() * 3.8;
        particles.push({
            x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            size: 5 + Math.random() * 4, alpha: 1, color
        });
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, alpha: 1, color });
}

function spawnConfetti() {
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff'];
    for (let i = 0; i < 100; i++) {
        confetti.push({
            x: Math.random() * canvas.width, y: -20 - Math.random() * 220,
            vx: (Math.random() - 0.5) * 4.5, vy: 2.2 + Math.random() * 4.2,
            size: 8 + Math.random() * 7, rot: Math.random() * Math.PI,
            vRot: (Math.random() - 0.5) * 0.22, color: colors[i % colors.length]
        });
    }
}

// --- UPDATED CARTOON GRAPHICS ---
function drawClouds() {
    ctx.save();
    clouds.forEach(cl => {
        cl.x -= cl.speed + (gameStarted && !gameWon ? car.vx * 0.04 : 0);
        if (cl.x < -180) cl.x = canvas.width + 180;
        ctx.save();
        ctx.translate(cl.x, cl.y);
        ctx.scale(cl.scale, cl.scale);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.strokeStyle = '#4a3b32';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-28, 8, 22, 0, Math.PI * 2);
        ctx.arc(0, -4, 28, 0, Math.PI * 2);
        ctx.arc(28, 6, 20, 0, Math.PI * 2);
        ctx.roundRect(-36, 6, 72, 20, 10);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    });
    ctx.restore();
}

function drawBackground() {
    const st = getStage();
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, st.skyTop);
    sky.addColorStop(0.55, st.skyMid);
    sky.addColorStop(1, st.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sunX = canvas.width * 0.16;
    const sunY = canvas.height * 0.17;
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.fillStyle = 'rgba(255, 224, 102, 0.35)';
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3b32';
    ctx.beginPath(); ctx.arc(-11, -3, 3.5, 0, Math.PI * 2); ctx.arc(11, -3, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 5, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.restore();

    drawClouds();

    const volcX = canvas.width * 0.78 - (cameraX * 0.04) % (canvas.width + 300);
    drawCuteVolcano(volcX, canvas.height * 0.52);

    ctx.fillStyle = st.hillColor;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x <= canvas.width + 60; x += 60) {
        const h = canvas.height * 0.56 + Math.sin((x + cameraX * 0.12) * 0.004) * 35;
        ctx.lineTo(x, h);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();

    ctx.fillStyle = st.riverColor;
    ctx.fillRect(0, canvas.height * 0.61, canvas.width, 28);

    for (let i = 0; i < 12; i++) {
        const treeWorldX = i * 620 + 180;
        const screenX = ((treeWorldX - cameraX * 0.35) % (12 * 620) + (12 * 620)) % (12 * 620) - 120;
        drawSmilingPalmTree(screenX, canvas.height * 0.62, st.grassColor);
    }
}

function drawCuteVolcano(x, y) {
    ctx.save();
    ctx.translate(x, y);
    const puffColors = ['#ff8fa3', '#ffd166', '#80ed99', '#72efdd', '#bdb2ff'];
    puffColors.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(12 + i * 16, -72 - i * 11 + Math.sin(frameCount * 0.05 + i) * 4, 14 - i * 1.2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = '#9c8578'; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-75, 65); ctx.lineTo(-24, -45); ctx.lineTo(24, -45); ctx.lineTo(75, 65);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#4a3b32';
    ctx.beginPath();
    ctx.arc(-12, 12, 3.5, 0, Math.PI * 2); ctx.arc(12, 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, 15, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.restore();
}

function drawSmilingPalmTree(x, y, leafColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d49a6a'; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.roundRect(-14, -120, 28, 125, 12); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#4a3b32';
    ctx.beginPath(); ctx.arc(-5, -80, 2.5, 0, Math.PI * 2); ctx.arc(5, -80, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -78, 4.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();

    ctx.fillStyle = leafColor;
    for (let a = -2; a <= 2; a++) {
        ctx.save(); ctx.translate(0, -122); ctx.rotate(a * 0.45);
        ctx.beginPath(); ctx.ellipse(0, -34, 14, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function drawRoad() {
    const st = getStage();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    for (let sx = 0; sx <= canvas.width + 20; sx += 20) ctx.lineTo(sx, getRoadY(sx + cameraX));
    ctx.lineTo(canvas.width, canvas.height); ctx.closePath();
    ctx.fillStyle = st.sandColor; ctx.fill();

    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    for (let sx = 0; sx <= canvas.width + 20; sx += 20) ctx.lineTo(sx, getRoadY(sx + cameraX) + 56);
    ctx.lineTo(canvas.width, canvas.height); ctx.closePath();
    ctx.fillStyle = st.earthColor; ctx.fill();

    ctx.lineWidth = 14; ctx.strokeStyle = st.grassColor;
    ctx.beginPath();
    for (let sx = 0; sx <= canvas.width + 20; sx += 20) {
        const ry = getRoadY(sx + cameraX);
        if (sx === 0) ctx.moveTo(sx, ry); else ctx.lineTo(sx, ry);
    }
    ctx.stroke();

    ctx.lineWidth = 4; ctx.strokeStyle = '#4a3b32'; ctx.stroke();

    for (let wx = Math.floor(cameraX / 150) * 150; wx < cameraX + canvas.width + 150; wx += 150) {
        const sx = wx - cameraX;
        const ry = getRoadY(wx);
        ctx.fillStyle = st.pebbleColor;
        ctx.beginPath(); ctx.ellipse(sx, ry + 26, 10, 5, 0, 0, Math.PI * 2); ctx.fill();

        if (Math.abs(wx % 300) < 150) {
            ctx.fillStyle = '#ff8fab';
            ctx.beginPath(); ctx.arc(sx + 25, ry - 8, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe066';
            ctx.beginPath(); ctx.arc(sx + 25, ry - 8, 2.2, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
}

function drawPurpleJelly(jelly) {
    const st = getStage();
    const sx = jelly.x - cameraX;
    if (sx < -120 || sx > canvas.width + 120) return;

    const ry = getRoadY(jelly.x);
    jelly.wobblePhase += 0.08;
    if (jelly.hitSquash > 0) jelly.hitSquash *= 0.88;

    const w = jelly.width + Math.sin(jelly.wobblePhase) * 4 + jelly.hitSquash * 14;
    const h = Math.max(30, jelly.height + Math.cos(jelly.wobblePhase) * 3 - jelly.hitSquash * 10);

    ctx.save(); ctx.translate(sx, ry);
    ctx.fillStyle = st.jellyColor; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.bezierCurveTo(-w / 2, -h * 1.25, w / 2, -h * 1.25, w / 2, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-w * 0.16, -h * 0.65, 10, Math.PI * 1.1, Math.PI * 1.65);
    ctx.stroke();

    ctx.fillStyle = st.jellyDotColor;
    [[-16, -24, 5], [0, -34, 6], [17, -22, 5], [-8, -12, 4], [10, -11, 4]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#4a3b32';
    ctx.beginPath(); ctx.arc(-10, -20, 3.2, 0, Math.PI * 2); ctx.arc(10, -20, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawGlowingStar(star) {
    if (star.collected) return;
    const sx = star.x - cameraX;
    if (sx < -80 || sx > canvas.width + 80) return;

    star.bobPhase += 0.06;
    const sy = star.y + Math.sin(star.bobPhase) * 7;

    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(255, 230, 102, 0.36)';
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 19 : 9;
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawGoalArch() {
    const st = getStage();
    const sx = st.trackLength - cameraX;
    if (sx < -250 || sx > canvas.width + 250) return;
    const ry = getRoadY(st.trackLength);

    ctx.save(); ctx.translate(sx, ry);
    const balloonColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c'];
    for (let i = 0; i <= 13; i++) {
        const t = i / 13;
        const ang = Math.PI + t * Math.PI;
        ctx.fillStyle = balloonColors[i % balloonColors.length];
        ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(Math.cos(ang) * 95, -75 + Math.sin(ang) * 115, 18, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }

    ctx.fillStyle = '#fffdf5'; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-64, -225, 128, 44, 14); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#ff6b6b';
    ctx.font = '900 26px Comic Sans MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL!', 0, -195);
    ctx.restore();
}

function drawCuteCar() {
    const c = getCar();
    const sx = car.x - cameraX;
    const sy = car.y + car.height / 2;
    const slope = car.grounded ? getRoadSlope(car.x) : car.vy * 0.025;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(slope);
    ctx.scale(2 - car.squash, car.squash);

    if (car.boostTimer > 0) {
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath(); ctx.moveTo(-54, 4); ctx.lineTo(-90 - Math.random() * 18, 12); ctx.lineTo(-54, 20); ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = c.body; ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.roundRect(-56, -24, 16, 10, 4); ctx.fill(); ctx.stroke();

    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.roundRect(-50, -12, 100, 34, 18); ctx.fill(); ctx.stroke();

    ctx.fillStyle = c.cabin;
    ctx.beginPath(); ctx.arc(-4, -12, 30, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = c.stripe;
    ctx.fillRect(-48, 0, 96, 8);
    ctx.beginPath(); ctx.arc(-6, 6, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf5'; ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#4a3b32';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.badge, -6, 11);

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(34, -2, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#4a3b32';
    ctx.beginPath(); ctx.arc(36, -2, 4.5, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath(); ctx.arc(34, 9, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();

    [-28, 28].forEach(wx => {
        ctx.save(); ctx.translate(wx, 22); ctx.rotate(car.wheelAngle);
        ctx.fillStyle = '#4a3b32';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e2ece9';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    ctx.restore();
}

// --- UPDATE LOOP ---
function update() {
    frameCount++;
    car.squash += (1 - car.squash) * 0.18;

    if (!gameStarted || gameWon) {
        updateEngineHum(false, 0);
        return;
    }

    const st = getStage();
    const stageSpeedBonus = currentStageIndex * 0.08;
    let targetSpeed = 4.7 + stageSpeedBonus;
    if (keys.right) targetSpeed = 8.7 + stageSpeedBonus;
    if (car.boostTimer > 0) {
        targetSpeed = 12.8;
        car.boostTimer--;
        if (frameCount % 3 === 0) spawnDust(car.x - 45, car.y + car.height, 1);
    }

    car.vx += (targetSpeed - car.vx) * 0.1;
    car.x += car.vx;
    car.wheelAngle += car.vx * 0.08;
    updateEngineHum(true, car.vx / 10);

    car.vy += 0.72;
    car.y += car.vy;

    const roadY = getRoadY(car.x) - car.height + 10;
    if (car.y >= roadY) {
        if (!car.grounded && car.vy > 4) car.squash = 0.82;
        car.y = roadY; car.vy = 0; car.grounded = true;
        if (frameCount % 6 === 0) spawnDust(car.x - 36, car.y + car.height - 6, 1);
    } else {
        car.grounded = false;
    }

    jellies.forEach(jelly => {
        const jy = getRoadY(jelly.x) - jelly.height;
        if (Math.abs(car.x - jelly.x) < 60 && car.y + car.height > jy + 6 && car.vy >= -2) {
            car.vy = st.bounceVy;
            car.vx = Math.max(car.vx, 8.0);
            car.grounded = false;
            car.squash = 1.32;
            jelly.hitSquash = 1;
            progress.totalBounces += 1;
            saveProgress();
            updateLiveChallengeBanner();
            playSound('boing');
            spawnSparkles(jelly.x, jy, '#d8b4fe');
            addFloatingText('Boing!', jelly.x, jy - 25, '#8b5cf6');
        }
    });

    stars.forEach(star => {
        if (!star.collected && Math.hypot(car.x - star.x, (car.y + 25) - star.y) < 54) {
            star.collected = true;
            stageStars += 1;
            progress.totalStars += 1;
            saveProgress();
            document.getElementById('scoreText').innerText = progress.totalStars;
            updateLiveChallengeBanner();
            playSound('star');
            spawnSparkles(star.x, star.y, '#ffe066');
            addFloatingText('+1 ⭐', star.x, star.y - 20, '#e67e22');
        }
    });

    cameraX = car.x - canvas.width * 0.28;

    const pct = Math.min(100, Math.max(0, (car.x / st.trackLength) * 100));
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressCar').style.left = pct + '%';

    if (car.x >= st.trackLength) {
        gameWon = true;
        updateEngineHum(false, 0);
        updateLiveChallengeBanner();
        playSound('win');
        spawnConfetti();

        let unlocks = [];
        if (currentStageIndex + 1 < STAGES.length && progress.unlockedStage < currentStageIndex + 1) {
            progress.unlockedStage = currentStageIndex + 1;
            unlocks.push(`🗺️ Stage ${currentStageIndex + 2} Unlocked!`);
        }
        CARS.forEach(c => {
            if (c.isUnlocked(progress) && c.id !== 'sky' && !progress['_seen_' + c.id]) {
                progress['_seen_' + c.id] = true;
                unlocks.push(`🚗 ${c.name} Unlocked!`);
            }
        });
        saveProgress();

        const noticeEl = document.getElementById('unlockNotice');
        if (unlocks.length > 0) {
            noticeEl.innerText = 'NEW UNLOCK: ' + unlocks.join(' • ');
            noticeEl.classList.remove('hidden');
        } else {
            noticeEl.classList.add('hidden');
        }

        document.getElementById('winTitle').innerText = `STAGE ${currentStageIndex + 1} CLEAR!`;
        document.getElementById('finalScore').innerText = stageStars;
        document.getElementById('nextStageBtn').innerText = currentStageIndex < STAGES.length - 1 ? '➡ NEXT STAGE' : '🌟 STAGE 1';
        document.getElementById('winOverlay').classList.remove('hidden');
    }
}

function drawParticlesAndText() {
    particles.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.03;
        if (p.alpha <= 0) { particles.splice(idx, 1); return; }
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    floatingTexts.forEach((ft, idx) => {
        ft.y -= 1.4; ft.alpha -= 0.022;
        if (ft.alpha <= 0) { floatingTexts.splice(idx, 1); return; }
        ctx.save(); ctx.globalAlpha = ft.alpha;
        ctx.font = '900 24px Comic Sans MS, sans-serif'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#4a3b32'; ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x - cameraX, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x - cameraX, ft.y);
        ctx.restore();
    });

    confetti.forEach(c => {
        c.x += c.vx; c.y += c.vy; c.rot += c.vRot;
        if (c.y > canvas.height + 20) c.y = -20;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        ctx.restore();
    });
}

function loop() {
    update();
    drawBackground();
    drawRoad();
    jellies.forEach(drawPurpleJelly);
    stars.forEach(drawGlowingStar);
    drawGoalArch();
    drawCuteCar();
    drawParticlesAndText();
    requestAnimationFrame(loop);
}

renderPickers();
buildLevel(currentStageIndex);
loop();
