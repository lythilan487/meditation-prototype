const themes = {
  sleep: {
    title: '睡前放松',
    suggestion: '睡前 5 分钟放松',
    guide: [
      '把今天先放在门外。此刻不用复盘、不用证明自己，只要慢慢把呼吸放轻一点。',
      '让眼睛和额头也跟着松下来，像把房间的灯一盏一盏调暗。',
      '每一次呼气，都在告诉身体：今天可以先到这里了。'
    ]
  },
  relax: {
    title: '缓解焦虑',
    suggestion: '给紧绷一点出口',
    guide: [
      '先别急着处理所有事情。现在只照顾呼吸就够了。',
      '把肩膀放下来，把下巴也放松一点，让身体慢慢知道此刻是安全的。',
      '你不用立刻变好，先从不再那么绷紧开始。'
    ]
  },
  focus: {
    title: '恢复专注',
    suggestion: '把注意力收回来',
    guide: [
      '不用勉强自己瞬间进入状态，先把散开的心收回来。',
      '每次呼吸都像给大脑按下静音键，把杂音慢慢调低。',
      '等身体稳下来，专注也会跟着回来。'
    ]
  },
  gentle: {
    title: '温柔自我安抚',
    suggestion: '允许自己先被接住',
    guide: [
      '你已经很努力了，现在停下来，不代表你不够好。',
      '把一只手轻轻放在心口，感受身体还在认真陪着你。',
      '先不要催自己振作，先让自己被温柔地安静一下。'
    ]
  }
};

const breathPatterns = {
  '4-2-6': [
    { phase: '吸气', seconds: 4, className: 'inhale' },
    { phase: '停留', seconds: 2, className: 'hold' },
    { phase: '呼气', seconds: 6, className: 'exhale' }
  ],
  '4-4-4': [
    { phase: '吸气', seconds: 4, className: 'inhale' },
    { phase: '停留', seconds: 4, className: 'hold' },
    { phase: '呼气', seconds: 4, className: 'exhale' }
  ],
  '4-7-8': [
    { phase: '吸气', seconds: 4, className: 'inhale' },
    { phase: '停留', seconds: 7, className: 'hold' },
    { phase: '呼气', seconds: 8, className: 'exhale' }
  ]
};

const state = {
  theme: 'sleep',
  minutes: 5,
  breath: '4-7-8',
  remaining: 300,
  running: false,
  guideIndex: 0,
  countdownTimer: null,
  breathTimer: null,
  audioEnabled: true,
  volume: 0.55
};

const suggestionText = document.getElementById('suggestionText');
const themeTitle = document.getElementById('themeTitle');
const guideText = document.getElementById('guideText');
const breathText = document.getElementById('breathText');
const timerDisplay = document.getElementById('timerDisplay');
const sessionStatus = document.getElementById('sessionStatus');
const breathOrb = document.getElementById('breathOrb');
const reflectionInput = document.getElementById('reflectionInput');
const savedReflection = document.getElementById('savedReflection');
const ambientTag = document.getElementById('ambientTag');
const audioStatus = document.getElementById('audioStatus');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const testSoundBtn = document.getElementById('testSoundBtn');
const volumeControl = document.getElementById('volumeControl');
const meditationAudio = document.getElementById('meditationAudio');
const streakDays = document.getElementById('streakDays');
const totalSessions = document.getElementById('totalSessions');
const lastSessionText = document.getElementById('lastSessionText');
const streakHint = document.getElementById('streakHint');

const CHECKIN_STORAGE_KEY = 'jingdown-checkins-v1';

let audioContext = null;
let audioUnlocked = false;

function formatTime(totalSeconds) {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function setActive(selector, datasetKey, value) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle('active', button.dataset[datasetKey] === String(value));
  });
}

function updateThemeUI() {
  const theme = themes[state.theme];
  themeTitle.textContent = theme.title;
  suggestionText.textContent = theme.suggestion;
  guideText.textContent = theme.guide[state.guideIndex % theme.guide.length];
}

function updateTimeUI() {
  timerDisplay.textContent = formatTime(state.remaining);
}

function updateStatus(text) {
  sessionStatus.textContent = text;
}

function updateAudioUI() {
  ambientTag.textContent = '轻柔冥想音乐';
  audioStatus.textContent = state.audioEnabled ? '准备播放' : '已静音';
  audioToggleBtn.textContent = state.audioEnabled ? '关闭音乐' : '开启音乐';
  volumeControl.value = Math.round(state.volume * 100);
}

function getStoredCheckins() {
  try {
    return JSON.parse(localStorage.getItem(CHECKIN_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredCheckins(entries) {
  localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(entries));
}

function normalizeDateKey(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
}

function calculateStreak(entries) {
  if (!entries.length) return 0;
  const days = [...new Set(entries.map((entry) => entry.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date();

  for (const day of days) {
    const expected = normalizeDateKey(cursor);
    if (day !== expected) {
      if (streak === 0 && day === normalizeDateKey(new Date(Date.now() - 86400000))) {
        cursor = new Date(cursor.getTime() - 86400000);
      } else {
        break;
      }
    }
    if (day === normalizeDateKey(cursor)) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  return streak;
}

function updateCheckinUI() {
  const entries = getStoredCheckins();
  const total = entries.length;
  const last = entries[entries.length - 1];
  const streak = calculateStreak(entries);

  streakDays.textContent = String(streak);
  totalSessions.textContent = String(total);
  lastSessionText.textContent = last ? `${last.date} · ${last.minutes}分钟` : '还没有打卡';

  if (streak >= 7) {
    streakHint.textContent = '你已经连续坚持 7 天+';
  } else if (streak > 0) {
    streakHint.textContent = `已经连续 ${streak} 天了`;
  } else {
    streakHint.textContent = '刚开始也很好';
  }
}

function recordCheckin() {
  const entries = getStoredCheckins();
  const today = normalizeDateKey();
  const alreadyExists = entries.some((entry) => entry.date === today && entry.minutes === state.minutes && entry.theme === state.theme);

  if (!alreadyExists) {
    entries.push({
      date: today,
      minutes: state.minutes,
      theme: state.theme,
      createdAt: new Date().toISOString()
    });
    saveStoredCheckins(entries);
  }

  updateCheckinUI();
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioUnlocked = true;
    return true;
  } catch (error) {
    console.warn('Audio unlock failed:', error);
    return false;
  }
}

async function playCue(type = 'inhale') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const settings = {
      inhale: { freq: 540, duration: 0.18 },
      hold: { freq: 420, duration: 0.12 },
      exhale: { freq: 300, duration: 0.24 },
      test: { freq: 660, duration: 0.2 }
    }[type] || { freq: 500, duration: 0.18 };

    osc.type = 'sine';
    osc.frequency.setValueAtTime(settings.freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
    osc.start(now);
    osc.stop(now + settings.duration + 0.03);
  } catch (error) {
    console.warn('Cue playback failed:', error);
  }
}

async function fadeAudio(targetVolume, duration = 1200) {
  const startVolume = meditationAudio.volume;
  const startTime = performance.now();

  return new Promise((resolve) => {
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress * (2 - progress);
      meditationAudio.volume = startVolume + (targetVolume - startVolume) * eased;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

async function playMeditationAudio() {
  if (!state.audioEnabled) {
    updateAudioUI();
    return;
  }

  await unlockAudio();
  meditationAudio.currentTime = meditationAudio.currentTime || 0;
  meditationAudio.volume = 0;

  try {
    await meditationAudio.play();
    await fadeAudio(state.volume, 1800);
    audioStatus.textContent = '播放中';
  } catch (error) {
    console.warn('Audio playback failed:', error);
    audioStatus.textContent = audioUnlocked ? '点击测试声音后再试' : '需要先解锁声音';
  }
}

async function stopMeditationAudio(statusText = '未播放') {
  if (!meditationAudio.paused) {
    await fadeAudio(0, 800);
    meditationAudio.pause();
  }
  audioStatus.textContent = statusText;
}

function clearTimers() {
  clearInterval(state.countdownTimer);
  clearTimeout(state.breathTimer);
  state.countdownTimer = null;
  state.breathTimer = null;
}

function idleOrb() {
  breathOrb.className = 'orb-core';
  breathText.textContent = '准备开始';
}

function runBreathLoop(index = 0) {
  if (!state.running) return;
  const sequence = breathPatterns[state.breath];
  const step = sequence[index % sequence.length];
  breathOrb.className = `orb-core ${step.className}`;
  breathText.textContent = step.phase;

  if (step.phase === '吸气') playCue('inhale');
  if (step.phase === '停留') playCue('hold');
  if (step.phase === '呼气') playCue('exhale');

  state.breathTimer = setTimeout(() => {
    if (step.phase === '呼气') {
      state.guideIndex += 1;
      updateThemeUI();
    }
    runBreathLoop(index + 1);
  }, step.seconds * 1000);
}

function updateBodyState(newState) {
  document.body.setAttribute('data-state', newState);
}

async function startSession() {
  clearTimers();
  state.running = true;
  updateStatus('进行中');
  updateBodyState('running');
  await playMeditationAudio();
  runBreathLoop();
  state.countdownTimer = setInterval(() => {
    state.remaining -= 1;
    updateTimeUI();
    if (state.remaining <= 0) {
      finishSession();
    }
  }, 1000);
}

async function pauseSession() {
  if (!state.running) return;
  clearTimers();
  state.running = false;
  breathText.textContent = '暂停中';
  breathOrb.className = 'orb-core hold';
  updateStatus('已暂停');
  updateBodyState('paused');
  await stopMeditationAudio('已暂停');
}

async function finishSession() {
  clearTimers();
  state.running = false;
  state.remaining = 0;
  updateTimeUI();
  updateStatus('已完成');
  updateBodyState('finished');
  breathText.textContent = '今晚辛苦了';
  breathOrb.className = 'orb-core inhale';
  guideText.textContent = '这次做得很好。现在先别急着离开，花两秒感受一下：你的身体是不是已经比刚开始更松一点了？';
  recordCheckin();
  await stopMeditationAudio('已结束');
}

async function resetSession() {
  clearTimers();
  state.running = false;
  state.remaining = state.minutes * 60;
  state.guideIndex = 0;
  updateThemeUI();
  updateTimeUI();
  updateStatus('未开始');
  updateBodyState('idle');
  await stopMeditationAudio(state.audioEnabled ? '准备播放' : '已静音');
  idleOrb();
}

document.getElementById('themeChips').addEventListener('click', (event) => {
  const target = event.target.closest('[data-theme]');
  if (!target) return;
  state.theme = target.dataset.theme;
  state.guideIndex = 0;
  setActive('.theme-card', 'theme', state.theme);
  updateThemeUI();
});

document.getElementById('durationChips').addEventListener('click', (event) => {
  const target = event.target.closest('[data-minutes]');
  if (!target) return;
  state.minutes = Number(target.dataset.minutes);
  setActive('.segment-btn', 'minutes', state.minutes);
  resetSession();
});

document.querySelector('.breath-cards').addEventListener('click', (event) => {
  const target = event.target.closest('[data-breath]');
  if (!target) return;
  state.breath = target.dataset.breath;
  setActive('.breath-card', 'breath', state.breath);
  resetSession();
});

document.getElementById('startBtn').addEventListener('click', async () => {
  if (state.remaining <= 0) state.remaining = state.minutes * 60;
  if (!state.running) await startSession();
});

document.getElementById('quickStartBtn').addEventListener('click', async () => {
  await resetSession();
  await startSession();
});

testSoundBtn.addEventListener('click', async () => {
  await unlockAudio();
  meditationAudio.currentTime = 0;
  meditationAudio.volume = state.volume;

  try {
    await meditationAudio.play();
    audioStatus.textContent = '测试播放中';
    playCue('test');
    setTimeout(() => {
      meditationAudio.pause();
      meditationAudio.currentTime = 0;
      audioStatus.textContent = state.audioEnabled ? '准备播放' : '已静音';
    }, 2200);
  } catch (error) {
    console.warn('Test playback failed:', error);
    playCue('test');
    audioStatus.textContent = '提示音可用，背景音乐受限';
  }
});

audioToggleBtn.addEventListener('click', async () => {
  state.audioEnabled = !state.audioEnabled;
  updateAudioUI();

  if (!state.audioEnabled) {
    await stopMeditationAudio('已静音');
    return;
  }

  if (state.running) {
    await playMeditationAudio();
  }
});

volumeControl.addEventListener('input', (event) => {
  state.volume = Number(event.target.value) / 100;
  if (!meditationAudio.paused) {
    meditationAudio.volume = state.volume;
  }
});

document.getElementById('pauseBtn').addEventListener('click', () => pauseSession());
document.getElementById('resetBtn').addEventListener('click', () => resetSession());

document.getElementById('saveReflectionBtn').addEventListener('click', () => {
  const text = reflectionInput.value.trim();
  if (!text) {
    savedReflection.textContent = '写下一点点感受吧，比如：呼吸平稳了一些。';
    return;
  }
  const now = new Date();
  savedReflection.textContent = `${now.toLocaleString('zh-CN')}：${text}`;
});

updateThemeUI();
updateAudioUI();
updateCheckinUI();
updateBodyState('idle');
resetSession();
