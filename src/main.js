import './style.css';

const MORSE_TABLE = {
  '.-': 'A',
  '-...': 'B',
  '-.-.': 'C',
  '-..': 'D',
  '.': 'E',
  '..-.': 'F',
  '--.': 'G',
  '....': 'H',
  '..': 'I',
  '.---': 'J',
  '-.-': 'K',
  '.-..': 'L',
  '--': 'M',
  '-.': 'N',
  '---': 'O',
  '.--.': 'P',
  '--.-': 'Q',
  '.-.': 'R',
  '...': 'S',
  '-': 'T',
  '..-': 'U',
  '...-': 'V',
  '.--': 'W',
  '-..-': 'X',
  '-.--': 'Y',
  '--..': 'Z',
  '-----': '0',
  '.----': '1',
  '..---': '2',
  '...--': '3',
  '....-': '4',
  '.....': '5',
  '-....': '6',
  '--...': '7',
  '---..': '8',
  '----.': '9',
  '.-.-.-': '.',
  '--..--': ',',
  '..--..': '?',
  '-.-.--': '!',
  '-..-.': '/',
  '-.--.': '(',
  '-.--.-': ')',
  '.-...': '&',
  '---...': ':',
  '-.-.-.': ';',
  '-...-': '=',
  '.-.-.': '+',
  '-....-': '-',
  '..--.-': '_',
  '.-..-.': '"',
  '...-..-': '$',
  '.--.-.': '@'
};

const MORSE_REVERSE = Object.entries(MORSE_TABLE).reduce((acc, [code, char]) => {
  acc[char] = code;
  return acc;
}, {});

const HISTORY_LIMIT = 10;

const PRACTICE_PROMPTS = [
  'CQ CQ DE N0CALL K',
  'UR RST 579 QTH DENVER CO',
  'NAME ALEX RIG KX2 ANT EFHW',
  'WX HR SUNNY 72F',
  'TNX QSO 73 ES GL',
  'QTH SEATTLE WA',
  'RIG IC-7300 100W',
  'ANT DIPOLE 40M',
  'FB COPY?',
  'BTU TU SK'
];

const state = {
  keyDown: false,
  downAt: 0,
  lastUpAt: 0,
  currentSymbols: '',
  decoded: '',
  symbolStream: '',
  charTimer: null,
  wordTimer: null,
  sendTimer: null,
  audioContext: null,
  audio: null,
  remoteQueue: Promise.resolve(),
  chatHistory: [],
  localProfile: null,
  intraGapMs: null,
  charWpm: 22,
  effWpm: 16,
  tone: 650,
  volume: 0.35,
  attackMs: 6,
  releaseMs: 18,
  clickLevel: 0.2,
  qsbDepth: 0.1,
  qsbRate: 0.3,
  qrmLevel: 0.08,
  adaptiveTiming: true,
  autoSpacing: true,
  trainingMode: false,
  allowTypedDecoded: false,
  autoSpacingBeforePractice: true,
  practiceMode: false,
  estimatedUnitMs: null,
  practicePrompt: PRACTICE_PROMPTS[0],
  keyCode: 'ControlLeft'
};

const el = {
  keyZone: document.getElementById('keyZone'),
  keyIndicator: document.getElementById('keyIndicator'),
  keyLabel: document.getElementById('keyLabel'),
  symbolStream: document.getElementById('symbolStream'),
  decodedStream: document.getElementById('decodedStream'),
  confirmSend: document.getElementById('confirmSend'),
  typeDecoded: document.getElementById('typeDecoded'),
  typeDecodedWrap: document.getElementById('typeDecodedWrap'),
  clearMessage: document.getElementById('clearMessage'),
  transcript: document.getElementById('transcript'),
  callCq: document.getElementById('callCq'),
  resetRagchew: document.getElementById('resetRagchew'),
  keyCode: document.getElementById('keyCode'),
  charWpm: document.getElementById('charWpm'),
  charWpmInput: document.getElementById('charWpmInput'),
  effWpm: document.getElementById('effWpm'),
  effWpmInput: document.getElementById('effWpmInput'),
  tone: document.getElementById('tone'),
  toneValue: document.getElementById('toneValue'),
  volume: document.getElementById('volume'),
  volumeValue: document.getElementById('volumeValue'),
  attack: document.getElementById('attack'),
  attackValue: document.getElementById('attackValue'),
  release: document.getElementById('release'),
  releaseValue: document.getElementById('releaseValue'),
  click: document.getElementById('click'),
  clickValue: document.getElementById('clickValue'),
  qsbDepth: document.getElementById('qsbDepth'),
  qsbDepthValue: document.getElementById('qsbDepthValue'),
  qsbRate: document.getElementById('qsbRate'),
  qsbRateValue: document.getElementById('qsbRateValue'),
  qrm: document.getElementById('qrm'),
  qrmValue: document.getElementById('qrmValue'),
  adaptiveTiming: document.getElementById('adaptiveTiming'),
  autoSpacing: document.getElementById('autoSpacing'),
  trainingMode: document.getElementById('trainingMode'),
  practiceMode: document.getElementById('practiceMode'),
  practicePrompt: document.getElementById('practicePrompt'),
  newPrompt: document.getElementById('newPrompt'),
  myCall: document.getElementById('myCall'),
  theirCall: document.getElementById('theirCall'),
  stationStyle: document.getElementById('stationStyle'),
  unlockAudio: document.getElementById('unlockAudio'),
  audioStatus: document.getElementById('audioStatus'),
  llmEnabled: document.getElementById('llmEnabled'),
  llmEndpoint: document.getElementById('llmEndpoint'),
  llmKey: document.getElementById('llmKey'),
  llmModel: document.getElementById('llmModel')
};

function baseUnitMs() {
  return 1200 / state.charWpm;
}

function spacingUnitMs() {
  return 1200 / state.effWpm;
}

function unitMs() {
  if (!state.adaptiveTiming || !state.estimatedUnitMs) {
    return baseUnitMs();
  }
  const base = baseUnitMs();
  const min = base * 0.6;
  const max = base * 1.6;
  return Math.min(Math.max(state.estimatedUnitMs, min), max);
}

function gapUnitMs() {
  return state.intraGapMs || unitMs();
}

function letterGapUnits() {
  return state.trainingMode ? 4.5 : 3.2;
}

function wordGapUnits() {
  return state.trainingMode ? 12 : 10;
}

function updateControlDisplays() {
  el.charWpm.value = String(state.charWpm);
  el.effWpm.value = String(state.effWpm);
  el.charWpmInput.value = String(state.charWpm);
  el.effWpmInput.value = String(state.effWpm);
  el.toneValue.textContent = state.tone;
  el.volumeValue.textContent = Math.round(state.volume * 100);
  el.attackValue.textContent = state.attackMs;
  el.releaseValue.textContent = state.releaseMs;
  el.clickValue.textContent = Math.round(state.clickLevel * 100);
  el.qsbDepthValue.textContent = Math.round(state.qsbDepth * 100);
  el.qsbRateValue.textContent = state.qsbRate.toFixed(2);
  el.qrmValue.textContent = Math.round(state.qrmLevel * 100);
  el.practicePrompt.textContent = state.practicePrompt;
  el.keyLabel.textContent = el.keyCode.selectedOptions[0]?.textContent || 'Left Ctrl';
}

function updateTrainingUI() {
  el.confirmSend.classList.toggle('is-hidden', !state.trainingMode);
  el.trainingMode.checked = state.trainingMode;
  el.typeDecodedWrap.classList.toggle('is-hidden', !state.trainingMode);
  if (!state.trainingMode) {
    state.allowTypedDecoded = false;
    el.typeDecoded.checked = false;
    setDecodedEditable(false);
  }
}

function setDecodedEditable(enabled) {
  el.decodedStream.contentEditable = enabled ? 'true' : 'false';
  el.decodedStream.classList.toggle('editable', enabled);
}

function normalizeSpeeds() {
  if (state.effWpm > state.charWpm) {
    state.effWpm = state.charWpm;
  }
}

function updateKeyIndicator(active) {
  el.keyIndicator.textContent = active ? 'Key Down' : 'Idle';
  el.keyIndicator.style.background = active ? '#f06c3d' : '#fff';
  el.keyIndicator.style.color = active ? '#fff' : '#1b1a17';
  el.keyZone.classList.toggle('active', active);
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  initAudioGraph();
  el.audioStatus.textContent = state.audioContext.state === 'running' ? 'Ready' : 'Locked';
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function initAudioGraph() {
  if (state.audio || !state.audioContext) return;

  const ctx = state.audioContext;
  const toneOsc = ctx.createOscillator();
  toneOsc.type = 'sine';

  const gateGain = ctx.createGain();
  gateGain.gain.value = 0;

  const remoteOsc = ctx.createOscillator();
  remoteOsc.type = 'sine';

  const remoteGateGain = ctx.createGain();
  remoteGateGain.gain.value = 0;

  const qsbGain = ctx.createGain();
  qsbGain.gain.value = 1;

  const masterGain = ctx.createGain();
  masterGain.gain.value = state.volume;

  toneOsc.connect(gateGain).connect(qsbGain);
  remoteOsc.connect(remoteGateGain).connect(qsbGain);
  qsbGain.connect(masterGain).connect(ctx.destination);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx);
  noiseSource.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.Q.value = 1.2;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = state.qrmLevel;

  noiseSource.connect(noiseFilter).connect(noiseGain).connect(qsbGain);

  const qsbLfo = ctx.createOscillator();
  qsbLfo.type = 'sine';

  const qsbLfoGain = ctx.createGain();
  qsbLfo.connect(qsbLfoGain).connect(qsbGain.gain);

  toneOsc.start();
  remoteOsc.start();
  noiseSource.start();
  qsbLfo.start();

  state.audio = {
    toneOsc,
    gateGain,
    remoteOsc,
    remoteGateGain,
    qsbGain,
    masterGain,
    noiseSource,
    noiseFilter,
    noiseGain,
    qsbLfo,
    qsbLfoGain
  };

  updateAudioParams();
}

function updateAudioParams() {
  if (!state.audioContext || !state.audio) return;
  const ctx = state.audioContext;
  const now = ctx.currentTime;

  state.audio.toneOsc.frequency.setTargetAtTime(state.tone, now, 0.01);
  state.audio.remoteOsc.frequency.setTargetAtTime(state.tone, now, 0.01);
  state.audio.masterGain.gain.setTargetAtTime(state.volume, now, 0.02);
  state.audio.noiseFilter.frequency.setTargetAtTime(state.tone, now, 0.01);
  state.audio.noiseGain.gain.setTargetAtTime(state.qrmLevel, now, 0.02);

  const depth = state.qsbDepth;
  state.audio.qsbGain.gain.setTargetAtTime(1 - depth / 2, now, 0.05);
  state.audio.qsbLfoGain.gain.setTargetAtTime(depth / 2, now, 0.05);
  state.audio.qsbLfo.frequency.setTargetAtTime(state.qsbRate, now, 0.05);
}

function applyGate(target, rampMs) {
  if (!state.audioContext || !state.audio) return;
  const now = state.audioContext.currentTime;
  const seconds = Math.max(rampMs / 1000, 0.001);
  state.audio.gateGain.gain.cancelScheduledValues(now);
  state.audio.gateGain.gain.setTargetAtTime(target, now, seconds);
}

function scheduleGate(gainParam, startTime, endTime, level) {
  const attack = Math.max(state.attackMs / 1000, 0.001);
  const release = Math.max(state.releaseMs / 1000, 0.001);
  const sustainEnd = Math.max(endTime - release, startTime + attack);
  gainParam.setValueAtTime(0, startTime);
  gainParam.linearRampToValueAtTime(level, startTime + attack);
  gainParam.setValueAtTime(level, sustainEnd);
  gainParam.linearRampToValueAtTime(0, endTime);
}

function playKeyClick() {
  if (!state.audioContext || !state.audio || state.clickLevel <= 0) return;
  const ctx = state.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 2000;
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(state.audio.masterGain);
  const now = ctx.currentTime;
  const peak = 0.08 * state.clickLevel;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  osc.start(now);
  osc.stop(now + 0.04);
}

function startTone() {
  ensureAudioContext();
  applyGate(1, state.attackMs);
  playKeyClick();
}

function stopTone() {
  applyGate(0, state.releaseMs);
  playKeyClick();
}

function playRemoteMorse(text, unit) {
  ensureAudioContext();
  if (!state.audioContext || !state.audio) return;
  const now = state.audioContext.currentTime + 0.05;
  const cleaned = text.toUpperCase();
  let t = now;
  const toneLevel = 1;

  for (const char of cleaned) {
    if (char === ' ') {
      t += (unit * 4) / 1000;
      continue;
    }
    const code = MORSE_REVERSE[char];
    if (!code) continue;
    for (const symbol of code) {
      if (symbol === '.') {
        const end = t + unit / 1000;
        scheduleGate(state.audio.remoteGateGain.gain, t, end, toneLevel);
        t = end + unit / 1000;
      } else if (symbol === '-') {
        const end = t + (unit * 3) / 1000;
        scheduleGate(state.audio.remoteGateGain.gain, t, end, toneLevel);
        t = end + unit / 1000;
      }
    }
    t += (unit * 2) / 1000;
  }
}

function scheduleGapTimers() {
  clearTimeout(state.charTimer);
  clearTimeout(state.wordTimer);
  clearTimeout(state.sendTimer);

  if (!(state.autoSpacing || state.practiceMode)) return;

  const gapUnit = gapUnitMs();
  state.charTimer = setTimeout(() => {
    flushCharacter();
  }, gapUnit * letterGapUnits());

  state.wordTimer = setTimeout(() => {
    if (state.decoded && !state.decoded.endsWith(' ')) {
      state.decoded += ' ';
      renderStreams();
    }
  }, gapUnit * wordGapUnits());

  if (!state.trainingMode) {
    state.sendTimer = setTimeout(() => {
      if (!state.trainingMode && !state.keyDown && state.decoded.trim()) {
        sendMessage();
      }
    }, Math.max(spacingUnitMs() * 12, 4000));
  }
}

function updateGapEstimate(gapMs) {
  const base = unitMs();
  if (gapMs < base * 0.5 || gapMs > base * 2.2) return;
  state.intraGapMs = state.intraGapMs ? state.intraGapMs * 0.8 + gapMs * 0.2 : gapMs;
}

function flushCharacter() {
  if (!state.currentSymbols) return;
  const resolved = resolveSymbols(state.currentSymbols);
  state.decoded += resolved;
  state.currentSymbols = '';
  renderStreams();
}

function resolveSymbols(symbols) {
  const direct = MORSE_TABLE[symbols];
  if (direct) return direct;
  const letters = splitSymbols(symbols);
  if (letters) return letters.join('');
  return '?';
}

function splitSymbols(symbols) {
  const memo = new Map();
  const codes = Object.keys(MORSE_TABLE);

  const dfs = (index) => {
    if (index === symbols.length) return [];
    if (memo.has(index)) return memo.get(index);
    let best = null;
    for (const code of codes) {
      if (symbols.startsWith(code, index)) {
        const rest = dfs(index + code.length);
        if (rest) {
          const candidate = [MORSE_TABLE[code], ...rest];
          if (!best || candidate.length < best.length) {
            best = candidate;
          }
        }
      }
    }
    memo.set(index, best);
    return best;
  };

  return dfs(0);
}

function addSymbol(symbol) {
  state.currentSymbols += symbol;
  state.symbolStream = state.currentSymbols;
  renderStreams();
}

function renderStreams() {
  el.symbolStream.textContent = state.currentSymbols || '\u00a0';
  if (!(state.allowTypedDecoded && document.activeElement === el.decodedStream)) {
    el.decodedStream.textContent = state.decoded || '\u00a0';
  }
}

function updateAdaptiveTiming(duration) {
  if (!state.adaptiveTiming) return;
  const base = baseUnitMs();
  const current = state.estimatedUnitMs || base;
  const estimate = duration < current * 1.8 ? duration : duration / 3;
  const clamped = Math.min(Math.max(estimate, base * 0.5), base * 2);
  state.estimatedUnitMs = state.estimatedUnitMs ? current * 0.8 + clamped * 0.2 : clamped;
}

function handleKeyDown() {
  if (state.keyDown) return;
  if ((state.autoSpacing || state.practiceMode) && state.lastUpAt) {
    const gapMs = performance.now() - state.lastUpAt;
    updateGapEstimate(gapMs);
    const unit = gapUnitMs();
    if (gapMs >= unit * (state.trainingMode ? 10 : 8)) {
      flushCharacter();
      if (state.decoded && !state.decoded.endsWith(' ')) {
        state.decoded += ' ';
        renderStreams();
      }
    } else if (gapMs >= unit * (state.trainingMode ? 4.5 : 3)) {
      flushCharacter();
    }
  }
  state.keyDown = true;
  state.downAt = performance.now();
  updateKeyIndicator(true);
  startTone();
  clearTimeout(state.charTimer);
  clearTimeout(state.wordTimer);
  clearTimeout(state.sendTimer);
}

function handleKeyUp() {
  if (!state.keyDown) return;
  state.keyDown = false;
  const duration = performance.now() - state.downAt;
  state.lastUpAt = performance.now();
  updateKeyIndicator(false);
  stopTone();
  updateAdaptiveTiming(duration);
  const dit = duration < unitMs() * 1.8;
  addSymbol(dit ? '.' : '-');
  scheduleGapTimers();
}

function registerKeyEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.code === state.keyCode) {
      event.preventDefault();
      handleKeyDown();
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.code === state.keyCode) {
      event.preventDefault();
      handleKeyUp();
    }
  });

  el.keyZone.addEventListener('pointerdown', (event) => {
    el.keyZone.setPointerCapture(event.pointerId);
    handleKeyDown();
  });
  el.keyZone.addEventListener('pointerup', (event) => {
    el.keyZone.releasePointerCapture(event.pointerId);
    handleKeyUp();
  });
  el.keyZone.addEventListener('pointerleave', () => {
    handleKeyUp();
  });
  el.keyZone.addEventListener('pointercancel', () => {
    handleKeyUp();
  });
}

function addTranscriptEntry(text, who) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${who === 'me' ? 'me' : ''}`;
  if (who === 'them') {
    bubble.classList.add('blurred');
    bubble.addEventListener('click', () => {
      bubble.classList.remove('blurred');
    }, { once: true });
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = who === 'me' ? el.myCall.value : el.theirCall.value;
  const content = document.createElement('div');
  content.textContent = text;
  bubble.appendChild(meta);
  bubble.appendChild(content);
  el.transcript.appendChild(bubble);
  el.transcript.scrollTop = el.transcript.scrollHeight;
}

function clearDecoded() {
  state.currentSymbols = '';
  state.decoded = '';
  state.symbolStream = '';
  renderStreams();
}

function resetRagchew() {
  el.transcript.innerHTML = '';
  state.chatHistory = [];
  state.localProfile = null;
  clearDecoded();
}

const LOCAL_PERSONAS = {
  friendly: {
    greeting: 'GM {their} DE {me} {me} K',
    acknowledgments: [
      'RGR {their} UR RST {rst} QTH {qth}',
      'FB {their} RST {rst} QTH {qth}',
      'R RST {rst} QTH {qth}'
    ],
    followups: [
      'WX HR {wx}, ANT {ant}',
      'RIG {rig} {pwr} INTO {ant}',
      'OP {op} NAME {op}',
      'ENJOYING {hobby}'
    ],
    signoff: 'TNX QSO {their} 73 ES GL DE {me} SK'
  },
  brief: {
    greeting: '{their} DE {me} R RST 599 599 QTH CHICAGO IL',
    acknowledgments: ['RGR {their} FB', 'R RST {rst}', 'OK FB'],
    followups: ['WX {wx}', 'RIG {rig} {pwr}', 'ANT {ant}'],
    signoff: 'TU {their} 73 DE {me} SK'
  },
  dx: {
    greeting: '{their} DE {me} {me} K',
    acknowledgments: ['UR {rst} HR', 'R RST {rst}', 'QSB BUT COPY OK'],
    followups: ['QTH {qth}', 'RIG {rig} {pwr}', 'ANT {ant}'],
    signoff: 'TNX DX {their} 73 DE {me} SK'
  }
};

const LOCAL_PROFILE_OPTIONS = {
  rst: ['559', '569', '579', '589', '599'],
  qth: ['PORTLAND OR', 'DENVER CO', 'AUSTIN TX', 'RALEIGH NC', 'BOSTON MA'],
  wx: ['SUNNY 72F', 'CLR 65F', 'OVERCAST 58F', 'WINDY 60F', 'RAIN 55F'],
  rig: ['KX2', 'IC-7300', 'FT-891', 'K3', 'TS-590'],
  ant: ['EFHW AT 30FT', 'DIPOLE AT 40FT', 'VERTICAL', 'YAGI 3EL', 'INV VEE'],
  pwr: ['50W', '100W', '20W', '5W'],
  hobby: ['QRP NIGHTS', 'OLD RIGS', 'FIELD OPS', 'POTA', 'ANT EXPERIMENTS'],
  op: ['ALEX', 'JIM', 'PAT', 'KIM', 'SAM']
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getLocalProfile() {
  const call = el.theirCall.value.trim() || 'K2RAG';
  if (!state.localProfile || state.localProfile.call !== call) {
    state.localProfile = {
      call,
      rst: pick(LOCAL_PROFILE_OPTIONS.rst),
      qth: pick(LOCAL_PROFILE_OPTIONS.qth),
      wx: pick(LOCAL_PROFILE_OPTIONS.wx),
      rig: pick(LOCAL_PROFILE_OPTIONS.rig),
      ant: pick(LOCAL_PROFILE_OPTIONS.ant),
      pwr: pick(LOCAL_PROFILE_OPTIONS.pwr),
      hobby: pick(LOCAL_PROFILE_OPTIONS.hobby),
      op: pick(LOCAL_PROFILE_OPTIONS.op)
    };
  }
  return state.localProfile;
}

function simpleLocalResponse(message) {
  const style = el.stationStyle.value;
  const persona = LOCAL_PERSONAS[style];
  const profile = getLocalProfile();
  const me = profile.call;
  const their = el.myCall.value || 'N0CALL';
  const hasCQ = message.includes('CQ');
  const fill = (template) =>
    template
      .replaceAll('{me}', me)
      .replaceAll('{their}', their)
      .replaceAll('{rst}', profile.rst)
      .replaceAll('{qth}', profile.qth)
      .replaceAll('{wx}', profile.wx)
      .replaceAll('{rig}', profile.rig)
      .replaceAll('{ant}', profile.ant)
      .replaceAll('{pwr}', profile.pwr)
      .replaceAll('{hobby}', profile.hobby)
      .replaceAll('{op}', profile.op);
  const greeting = fill(persona.greeting);
  const ack = fill(
    persona.acknowledgments[Math.floor(Math.random() * persona.acknowledgments.length)]
  );
  const follow = fill(persona.followups[Math.floor(Math.random() * persona.followups.length)]);
  const signoff = fill(persona.signoff);

  if (hasCQ) return `${greeting} ${ack}`;
  if (message.includes('73') || message.includes('SK')) return signoff;
  if (message.includes('WX') || message.includes('QTH')) return `${ack} ${follow}`;
  return `${ack} ${follow}`;
}

async function llmResponse(message) {
  const endpoint =
    el.llmEndpoint.value.trim() || 'https://api.openai.com/v1/chat/completions';
  const key = el.llmKey.value.trim();
  const model = el.llmModel.value.trim() || 'gpt-5-mini';
  if (!endpoint || !key) {
    return 'LLM not configured';
  }
  const profile = getLocalProfile();
  const profileLine = `Station profile (keep consistent): CALL ${profile.call}, QTH ${profile.qth}, RST ${profile.rst}, WX ${profile.wx}, RIG ${profile.rig} ${profile.pwr}, ANT ${profile.ant}, OP ${profile.op}.`;

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a friendly HF CW operator in a ragchew. Keep replies short and natural (1-3 sentences). Use common CW abbreviations (e.g., R, RGR, FB, WX, QTH, QRM, QSB, RST, NAME, OP, RIG, ANT, PWR, HW CPY, TNX, 73). Always include a plausible RST and QTH early in the exchange. Ask occasional questions to keep the ragchew going. Keep callsigns intact and repeat them occasionally. Avoid markdown; return plain text only. ' +
          profileLine
      },
      ...state.chatHistory,
      { role: 'user', content: message }
    ],
    max_tokens: 120,
    temperature: 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return `LLM error ${response.status}`;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || data.text?.trim();
  return text || 'LLM had no response.';
}

function recordHistory(role, content) {
  state.chatHistory.push({ role, content });
  if (state.chatHistory.length > HISTORY_LIMIT) {
    state.chatHistory = state.chatHistory.slice(-HISTORY_LIMIT);
  }
}

async function respondToMessage(message) {
  if (el.llmEnabled.checked) {
    try {
      const reply = await llmResponse(message);
      if (!reply.startsWith('LLM error') && reply !== 'LLM not configured') {
        return reply;
      }
    } catch (error) {
      // Fall through to local responder.
    }
  }
  return simpleLocalResponse(message);
}

async function sendMessage() {
  flushCharacter();
  const text = state.decoded.trim();
  if (!text) return;
  addTranscriptEntry(text, 'me');
  clearDecoded();
  if (state.practiceMode) {
    addTranscriptEntry(`PRACTICE TARGET: ${state.practicePrompt}`, 'them');
    return;
  }
  const unitSnapshot = unitMs();
  const userMessage = text.toUpperCase();
  recordHistory('user', userMessage);
  const reply = await respondToMessage(userMessage);
  recordHistory('assistant', reply);
  addTranscriptEntry(reply, 'them');
  state.remoteQueue = state.remoteQueue.then(() => {
    playRemoteMorse(reply, unitSnapshot);
  });
}

async function callCq() {
  if (state.practiceMode) return;
  const myCall = el.myCall.value.trim() || 'N0CALL';
  const message = `CQ CQ CQ DE ${myCall} ${myCall} K`;
  addTranscriptEntry(message, 'me');
  const unitSnapshot = unitMs();
  const userMessage = message.toUpperCase();
  recordHistory('user', userMessage);
  const reply = await respondToMessage(userMessage);
  recordHistory('assistant', reply);
  addTranscriptEntry(reply, 'them');
  state.remoteQueue = state.remoteQueue.then(() => {
    playRemoteMorse(reply, unitSnapshot);
  });
}

function newPracticePrompt() {
  state.practicePrompt = PRACTICE_PROMPTS[Math.floor(Math.random() * PRACTICE_PROMPTS.length)];
  el.practicePrompt.textContent = state.practicePrompt;
}

function bindUI() {
  el.charWpm.addEventListener('input', (event) => {
    state.charWpm = Number(event.target.value);
    state.estimatedUnitMs = null;
    state.intraGapMs = null;
    normalizeSpeeds();
    el.charWpmInput.value = String(state.charWpm);
    el.effWpm.value = String(state.effWpm);
    el.effWpmInput.value = String(state.effWpm);
    updateControlDisplays();
  });

  el.charWpmInput.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      state.charWpm = Math.min(Math.max(value, 10), 40);
      el.charWpm.value = String(state.charWpm);
      state.estimatedUnitMs = null;
      state.intraGapMs = null;
      normalizeSpeeds();
      el.effWpm.value = String(state.effWpm);
    }
    updateControlDisplays();
  });

  el.effWpm.addEventListener('input', (event) => {
    state.effWpm = Number(event.target.value);
    normalizeSpeeds();
    el.effWpm.value = String(state.effWpm);
    el.effWpmInput.value = String(state.effWpm);
    updateControlDisplays();
  });

  el.effWpmInput.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      state.effWpm = Math.min(Math.max(value, 5), 30);
      normalizeSpeeds();
      el.effWpm.value = String(state.effWpm);
    }
    updateControlDisplays();
  });

  el.keyCode.addEventListener('change', (event) => {
    state.keyCode = event.target.value;
    updateControlDisplays();
  });

  el.tone.addEventListener('input', (event) => {
    state.tone = Number(event.target.value);
    updateControlDisplays();
    updateAudioParams();
  });

  el.volume.addEventListener('input', (event) => {
    state.volume = Number(event.target.value) / 100;
    updateControlDisplays();
    updateAudioParams();
  });

  el.attack.addEventListener('input', (event) => {
    state.attackMs = Number(event.target.value);
    updateControlDisplays();
  });

  el.release.addEventListener('input', (event) => {
    state.releaseMs = Number(event.target.value);
    updateControlDisplays();
  });

  el.click.addEventListener('input', (event) => {
    state.clickLevel = Number(event.target.value) / 100;
    updateControlDisplays();
  });

  el.qsbDepth.addEventListener('input', (event) => {
    state.qsbDepth = Number(event.target.value) / 100;
    updateControlDisplays();
    updateAudioParams();
  });

  el.qsbRate.addEventListener('input', (event) => {
    state.qsbRate = Number(event.target.value) / 100;
    updateControlDisplays();
    updateAudioParams();
  });

  el.qrm.addEventListener('input', (event) => {
    state.qrmLevel = Number(event.target.value) / 100;
    updateControlDisplays();
    updateAudioParams();
  });

  el.adaptiveTiming.addEventListener('change', (event) => {
    state.adaptiveTiming = event.target.checked;
    state.estimatedUnitMs = null;
  });

  el.autoSpacing.addEventListener('change', (event) => {
    state.autoSpacing = event.target.checked;
  });

  el.trainingMode.addEventListener('change', (event) => {
    state.trainingMode = event.target.checked;
    updateTrainingUI();
    if (state.trainingMode) {
      clearTimeout(state.sendTimer);
    }
  });

  el.typeDecoded.addEventListener('change', (event) => {
    state.allowTypedDecoded = event.target.checked;
    setDecodedEditable(state.allowTypedDecoded);
    if (!state.allowTypedDecoded) {
      renderStreams();
    }
  });

  el.decodedStream.addEventListener('input', () => {
    if (!state.allowTypedDecoded) return;
    state.decoded = el.decodedStream.textContent.replace(/\s+/g, ' ').trim();
  });

  el.practiceMode.addEventListener('change', (event) => {
    state.practiceMode = event.target.checked;
    if (state.practiceMode) {
      state.autoSpacingBeforePractice = state.autoSpacing;
      state.autoSpacing = true;
      el.autoSpacing.checked = true;
      el.autoSpacing.disabled = true;
      newPracticePrompt();
    } else {
      el.autoSpacing.disabled = false;
      state.autoSpacing = state.autoSpacingBeforePractice;
      el.autoSpacing.checked = state.autoSpacing;
    }
  });

  el.newPrompt.addEventListener('click', () => {
    newPracticePrompt();
  });

  el.clearMessage.addEventListener('click', () => {
    clearDecoded();
  });

  el.confirmSend.addEventListener('click', () => {
    sendMessage();
  });

  el.callCq.addEventListener('click', () => {
    callCq();
  });

  el.resetRagchew.addEventListener('click', () => {
    resetRagchew();
  });

  el.theirCall.addEventListener('change', () => {
    state.localProfile = null;
  });

  el.unlockAudio.addEventListener('click', () => {
    ensureAudioContext();
    el.audioStatus.textContent = 'Ready';
  });
}

function init() {
  state.trainingMode = false;
  updateControlDisplays();
  renderStreams();
  registerKeyEvents();
  bindUI();
  updateTrainingUI();
  setDecodedEditable(false);
}

init();
