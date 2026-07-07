const motionButtons = [...document.querySelectorAll(".motion-button")];
const historyList = document.querySelector("#history-list");
const clearHistory = document.querySelector("#clear-history");
const hourHand = document.querySelector("#hour-hand");
const minuteHand = document.querySelector("#minute-hand");
const ticks = document.querySelector("#ticks");
const numbers = document.querySelector("#numbers");
const trails = document.querySelector("#trails");
const statusText = document.querySelector("#status-text");
const durationText = document.querySelector("#duration-text");
const meter = [...document.querySelectorAll(".meter span")];
const watchToggle = document.querySelector("#watch-toggle");
const watchVideo = document.querySelector("#watch-video");
const watchCanvas = document.querySelector("#watch-canvas");
const watchState = document.querySelector("#watch-state");
const watchLight = document.querySelector("#watch-light");

const motions = {
  yawn: {
    label: "あくび",
    words: ["あくび", "のび", "伸び", "たいくつ", "ふわあ"],
    description: "大きくのびをして、ゆっくり戻ります。",
    duration: 4200,
    strength: 4,
    color: "#ed4b38",
  },
  surprise: {
    label: "びっくり",
    words: ["びっくり", "驚き", "おどろき", "はっ", "わっ"],
    description: "一瞬で跳ね上がり、細かく震えます。",
    duration: 2600,
    strength: 5,
    color: "#e67f12",
  },
  sad: {
    label: "しょんぼり",
    words: ["しょんぼり", "かなしい", "悲しい", "落ち込", "へこむ"],
    description: "下を向いて、少しだけ揺れて戻ります。",
    duration: 3600,
    strength: 2,
    color: "#2776ba",
  },
  excited: {
    label: "わくわく",
    words: ["わくわく", "楽しみ", "うれしい", "嬉しい", "そわそわ"],
    description: "待ちきれないように左右へ弾みます。",
    duration: 3300,
    strength: 5,
    color: "#009f95",
  },
  sleepy: {
    label: "ねむい",
    words: ["ねむい", "眠い", "ねむ", "うとうと", "寝る"],
    description: "力が抜けて、ゆっくり沈みます。",
    duration: 4400,
    strength: 2,
    color: "#8b62b0",
  },
  loose: {
    label: "だら〜ん",
    words: [],
    description: "下の方で重たくダラダラ揺れます。",
    duration: 4700,
    strength: 2,
    color: "#74624f",
  },
  hello: {
    label: "やっほー",
    words: [],
    description: "片方の針を手みたいに左右へ振ります。",
    duration: 3400,
    strength: 4,
    color: "#d75f87",
  },
};

let currentMotion = null;
let motionStartedAt = 0;
let lastCameraStatus = "";
let history = [
  { word: "あくび", key: "yawn", at: new Date(Date.now() - 120000) },
  { word: "びっくり", key: "surprise", at: new Date(Date.now() - 315000) },
  { word: "しょんぼり", key: "sad", at: new Date(Date.now() - 482000) },
  { word: "わくわく", key: "excited", at: new Date(Date.now() - 640000) },
  { word: "ねむい", key: "sleepy", at: new Date(Date.now() - 810000) },
  { word: "だら〜ん", key: "loose", at: new Date(Date.now() - 980000) },
  { word: "やっほー", key: "hello", at: new Date(Date.now() - 1160000) },
];

const watchMode = {
  active: false,
  watched: false,
  stream: null,
  detector: null,
  detectionTimer: null,
  lastFrame: null,
  lastFrameScore: 0,
  lastFrameBrightness: 0,
  lastFrameContrast: 0,
  nextSlackAt: 0,
  detectionMethod: "none",
};

function polarPoint(radius, degrees) {
  const rad = (degrees - 90) * Math.PI / 180;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
  };
}

function buildDial() {
  for (let i = 0; i < 60; i += 1) {
    const degrees = i * 6;
    const major = i % 5 === 0;
    const outer = polarPoint(190, degrees);
    const inner = polarPoint(major ? 172 : 181, degrees);
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("class", `tick ${major ? "major" : "minor"}`);
    tick.setAttribute("x1", inner.x);
    tick.setAttribute("y1", inner.y);
    tick.setAttribute("x2", outer.x);
    tick.setAttribute("y2", outer.y);
    ticks.appendChild(tick);
  }

  for (let i = 1; i <= 12; i += 1) {
    const point = polarPoint(144, i * 30);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "number");
    text.setAttribute("x", point.x);
    text.setAttribute("y", point.y);
    text.textContent = String(i);
    numbers.appendChild(text);
  }
}

function baseAngles(date = new Date()) {
  const ms = date.getMilliseconds();
  const seconds = date.getSeconds() + ms / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  return {
    hour: hours * 30,
    minute: minutes * 6,
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function shortestMix(from, to, amount) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta * amount;
}

function motionOffset(key, t, base) {
  const wave = Math.sin(t * Math.PI * 2);
  const quick = Math.sin(t * Math.PI * 18) * (1 - t);
  const settle = Math.sin(t * Math.PI) * (1 - t * 0.45);

  if (key === "yawn") {
    const stretch = Math.sin(Math.min(1, t * 1.25) * Math.PI);
    const lift = easeInOutSine(Math.min(1, t * 1.35));
    return {
      hour: shortestMix(base.hour, 342 + wave * 4, lift),
      minute: shortestMix(base.minute, 2 + wave * 2, lift),
      hourScale: 1 + stretch * 0.22,
      minuteScale: 1 + stretch * 0.34,
    };
  }

  if (key === "surprise") {
    const pop = easeOutCubic(Math.min(1, t * 3));
    return {
      hour: shortestMix(base.hour, 316 + quick * 12, pop),
      minute: shortestMix(base.minute, 44 - quick * 14, pop),
      hourScale: 1 + Math.abs(quick) * 0.08,
      minuteScale: 1 + Math.abs(quick) * 0.1,
    };
  }

  if (key === "sad") {
    const droop = easeInOutSine(Math.min(1, t * 1.4));
    return {
      hour: shortestMix(base.hour, 202 + wave * 5, droop),
      minute: shortestMix(base.minute, 162 - wave * 4, droop),
      hourScale: 0.96,
      minuteScale: 0.93,
    };
  }

  if (key === "excited") {
    const bounce = Math.sin(t * Math.PI * 10) * (1 - t * 0.25);
    const lean = Math.sin(t * Math.PI * 4);
    return {
      hour: shortestMix(base.hour, 320 + bounce * 7, 0.75),
      minute: shortestMix(base.minute, 40 - bounce * 9 + lean * 3, 0.78),
      hourScale: 1 + Math.abs(bounce) * 0.03,
      minuteScale: 1 + Math.abs(bounce) * 0.04,
    };
  }

  if (key === "sleepy") {
    const sink = easeInOutSine(Math.min(1, t * 1.2));
    return {
      hour: shortestMix(base.hour, 238 + settle * 7, sink),
      minute: shortestMix(base.minute, 186 - settle * 5, sink),
      hourScale: 0.92,
      minuteScale: 0.88,
    };
  }

  if (key === "loose") {
    const drop = easeInOutSine(Math.min(1, t * 1.35));
    const drag = Math.sin(t * Math.PI * 5) * (1 - t * 0.22);
    return {
      hour: shortestMix(base.hour, 198 + drag * 8, drop),
      minute: shortestMix(base.minute, 170 - drag * 10, drop),
      hourScale: 1.06,
      minuteScale: 1.12,
    };
  }

  if (key === "hello") {
    const lift = easeOutCubic(Math.min(1, t * 2.2));
    const waveHand = Math.sin(t * Math.PI * 9) * (1 - t * 0.18);
    const smallWave = Math.sin(t * Math.PI * 9 + 0.9) * (1 - t * 0.32);
    return {
      hour: shortestMix(base.hour, 326 + smallWave * 7, lift),
      minute: shortestMix(base.minute, 38 + waveHand * 22, lift),
      hourScale: 0.98,
      minuteScale: 1.08,
    };
  }

  return {
    hour: base.hour + Math.sin(t * Math.PI * 4) * 9 * (1 - t),
    minute: base.minute - Math.sin(t * Math.PI * 4) * 12 * (1 - t),
    hourScale: 1,
    minuteScale: 1,
  };
}

function setHandTransform(hand, angle, scale = 1) {
  hand.style.transform = `rotate(${angle}deg) scaleY(${scale})`;
}

function updateStatus(key, word) {
  const motion = motions[key];
  statusText.textContent = `${word || motion.label}：${motion.description}`;
  durationText.textContent = `継続時間 ${(motion.duration / 1000).toFixed(1)} 秒`;
  meter.forEach((dot, index) => dot.classList.toggle("on", index < motion.strength));
  document.documentElement.style.setProperty("--red", motion.color);
}

function drawTrails(key) {
  trails.replaceChildren();
  const configs = {
    yawn: [
      { d: "M -78 -118 C -42 -232, 34 -232, 70 -118", muted: true },
      { d: "M -34 -132 C -16 -220, 12 -220, 34 -132", muted: false },
      { d: "M -148 -118 L -192 -182", muted: false },
      { d: "M 148 -118 L 192 -182", muted: false },
    ],
    surprise: [
      { d: "M -44 -170 L -84 -220", muted: false },
      { d: "M 44 -170 L 84 -220", muted: false },
      { d: "M -16 -196 L -22 -232", muted: true },
      { d: "M 18 -196 L 24 -232", muted: true },
    ],
    sad: [
      { d: "M -92 118 C -50 148, 50 148, 92 118", muted: true },
      { d: "M -52 150 C -22 166, 22 166, 52 150", muted: false },
    ],
    excited: [
      { d: "M -128 -72 C -70 -126, -16 -126, 38 -72", muted: false },
      { d: "M 128 -72 C 70 -126, 16 -126, -38 -72", muted: false },
      { d: "M -152 6 C -100 -26, -54 -26, -12 6", muted: true },
      { d: "M 152 6 C 100 -26, 54 -26, 12 6", muted: true },
    ],
    sleepy: [
      { d: "M -116 100 C -70 130, -22 128, 24 94", muted: true },
      { d: "M -74 138 C -34 158, 18 156, 54 124", muted: false },
    ],
    loose: [
      { d: "M -118 132 C -70 182, 18 184, 92 132", muted: false },
      { d: "M -70 162 C -26 198, 36 194, 74 154", muted: true },
      { d: "M -18 178 C 6 210, 44 204, 62 174", muted: false },
    ],
    hello: [
      { d: "M 52 -134 C 104 -188, 152 -188, 184 -132", muted: false },
      { d: "M 42 -106 C 106 -144, 156 -118, 188 -72", muted: true },
      { d: "M -116 -98 C -76 -130, -28 -130, 16 -98", muted: true },
    ],
  };

  configs[key].forEach((config) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `trail live ${config.muted ? "muted" : ""}`);
    path.setAttribute("d", config.d);
    trails.appendChild(path);
  });
}

function playMotion(key, options = {}) {
  const { record = true, source = "manual" } = options;
  const motion = motions[key] || motions.yawn;
  currentMotion = key;
  motionStartedAt = performance.now();
  updateStatus(key, motion.label);
  drawTrails(key);
  if (record) {
    addHistory(motion.label, key);
  }
  setActiveMotion(key);
  if (source === "manual" && watchMode.active) {
    setWatchReadout(watchMode.watched, "手動で動かし中");
  }
}

function addHistory(word, key) {
  history.unshift({ word, key, at: new Date() });
  history = history.slice(0, 20);
  renderHistory();
}

function renderHistory() {
  historyList.replaceChildren();
  history.forEach((item) => {
    const motion = motions[item.key];
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <span class="history-dot" style="background:${motion.color}"></span>
      <span class="history-word">${item.word}</span>
      <time class="history-time">${item.at.toLocaleTimeString("ja-JP", { hour12: false })}</time>
      <button class="history-play" type="button" aria-label="${item.word}をもう一度動かす" title="もう一度動かす">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" /></svg>
      </button>
    `;
    li.querySelector("button").addEventListener("click", () => playMotion(item.key));
    historyList.appendChild(li);
  });
}

function setActiveMotion(key) {
  motionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.motion === key);
  });
}

function setWatchReadout(watched, label) {
  watchMode.watched = watched;
  watchLight.classList.toggle("on", watched);
  watchLight.classList.toggle("away", watchMode.active && !watched);
  watchState.textContent = label;
}

function setExactTimeStatus() {
  const nextStatus = "検知中：ちゃんと現在時刻を指しています。";
  if (lastCameraStatus !== nextStatus) {
    statusText.textContent = nextStatus;
    durationText.textContent = "カメラ監視中";
    meter.forEach((dot, index) => dot.classList.toggle("on", index < 5));
    document.documentElement.style.setProperty("--red", "var(--teal)");
    lastCameraStatus = nextStatus;
  }
}

function chooseSlackMotion() {
  const keys = ["yawn", "sad", "excited", "sleepy", "loose", "hello", "surprise"];
  return keys[Math.floor(Math.random() * keys.length)];
}

function keepSlacking(now) {
  if (!watchMode.active || watchMode.watched || now < watchMode.nextSlackAt) {
    return;
  }
  const key = chooseSlackMotion();
  playMotion(key, { record: false, source: "camera" });
  watchMode.nextSlackAt = now + motions[key].duration * 0.72;
}

function analyzeCameraFrame() {
  const context = watchCanvas.getContext("2d");
  if (!context || watchVideo.readyState < 2) {
    return { usable: false, fallbackWatched: false };
  }

  context.drawImage(watchVideo, 0, 0, watchCanvas.width, watchCanvas.height);
  const data = context.getImageData(0, 0, watchCanvas.width, watchCanvas.height).data;
  let brightness = 0;
  let diff = 0;
  let min = 255;
  let max = 0;
  const current = new Uint8ClampedArray(watchCanvas.width * watchCanvas.height);

  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    const value = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
    current[pixel] = value;
    brightness += value;
    min = Math.min(min, value);
    max = Math.max(max, value);
    if (watchMode.lastFrame) {
      diff += Math.abs(value - watchMode.lastFrame[pixel]);
    }
  }

  const pixels = current.length;
  const averageBrightness = brightness / pixels;
  const averageDiff = watchMode.lastFrame ? diff / pixels : 0;
  const contrast = max - min;
  watchMode.lastFrame = current;
  watchMode.lastFrameScore = averageDiff;
  watchMode.lastFrameBrightness = averageBrightness;
  watchMode.lastFrameContrast = contrast;

  return {
    usable: averageBrightness > 28 && contrast > 12,
    fallbackWatched: averageBrightness > 42 && contrast > 22 && averageDiff > 2.8,
  };
}

function looksTowardClock(face) {
  const box = face.boundingBox;
  const videoWidth = watchVideo.videoWidth || watchVideo.clientWidth;
  const videoHeight = watchVideo.videoHeight || watchVideo.clientHeight;

  if (!box || !videoWidth || !videoHeight) {
    return true;
  }

  const centerX = (box.x + box.width / 2) / videoWidth;
  const centerY = (box.y + box.height / 2) / videoHeight;
  const faceWidth = box.width / videoWidth;
  const faceHeight = box.height / videoHeight;
  const centered = centerX > 0.28 && centerX < 0.72 && centerY > 0.18 && centerY < 0.82;
  const visibleEnough = faceWidth > 0.14 && faceHeight > 0.18;

  return centered && visibleEnough;
}

async function detectWatching() {
  if (!watchMode.active) {
    return;
  }

  let watched = false;
  let method = "気配";
  const frameSignal = analyzeCameraFrame();

  if (watchMode.detector && watchVideo.readyState >= 2) {
    method = "目線";
    try {
      if (frameSignal.usable) {
        const faces = await watchMode.detector.detect(watchVideo);
        watched = faces.some(looksTowardClock);
      }
    } catch {
      watchMode.detector = null;
    }
  }

  if (!watchMode.detector) {
    watched = frameSignal.fallbackWatched;
  }

  watchMode.detectionMethod = method;

  if (watched) {
    currentMotion = null;
    setActiveMotion("");
    setExactTimeStatus();
    setWatchReadout(true, `${method}を検知：ちゃんと時刻を表示`);
    watchMode.nextSlackAt = performance.now() + 1700;
    return;
  }

  lastCameraStatus = "";
  setWatchReadout(false, `${method}が外れてる：サボり中`);
  keepSlacking(performance.now());
}

async function startWatchMode() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setWatchReadout(false, "このブラウザではカメラが使えません");
    return;
  }

  watchToggle.disabled = true;
  watchState.textContent = "カメラの許可を待っています";

  try {
    watchMode.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 320 },
        height: { ideal: 240 },
      },
    });
    watchVideo.srcObject = watchMode.stream;
    await watchVideo.play();

    if ("FaceDetector" in window) {
      watchMode.detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    }

    watchMode.active = true;
    watchMode.lastFrame = null;
    watchMode.nextSlackAt = 0;
    watchToggle.classList.add("active");
    watchToggle.textContent = "検知を止める";
    setWatchReadout(false, "カメラ確認中");
    await detectWatching();
    watchMode.detectionTimer = window.setInterval(detectWatching, 650);
  } catch {
    setWatchReadout(false, "カメラを開始できませんでした");
  } finally {
    watchToggle.disabled = false;
  }
}

function stopWatchMode() {
  watchMode.active = false;
  watchMode.watched = false;
  watchMode.lastFrame = null;
  lastCameraStatus = "";
  window.clearInterval(watchMode.detectionTimer);
  watchMode.detectionTimer = null;
  if (watchMode.stream) {
    watchMode.stream.getTracks().forEach((track) => track.stop());
  }
  watchMode.stream = null;
  watchVideo.srcObject = null;
  watchToggle.classList.remove("active");
  watchToggle.textContent = "検知モード";
  setWatchReadout(false, "カメラはオフ");
  updateStatus(currentMotion || "yawn", currentMotion ? motions[currentMotion].label : "あくび");
}

function tick() {
  const now = performance.now();
  const base = baseAngles();
  let hour = base.hour;
  let minute = base.minute;
  let hourScale = 1;
  let minuteScale = 1;

  if (currentMotion) {
    const motion = motions[currentMotion];
    const t = (now - motionStartedAt) / motion.duration;
    if (t >= 1) {
      currentMotion = null;
    } else {
      const easedReturn = t > 0.68 ? 1 - easeOutCubic((t - 0.68) / 0.32) : 1;
      const posed = motionOffset(currentMotion, t, base);
      hour = shortestMix(base.hour, posed.hour, easedReturn);
      minute = shortestMix(base.minute, posed.minute, easedReturn);
      hourScale = 1 + (posed.hourScale - 1) * easedReturn;
      minuteScale = 1 + (posed.minuteScale - 1) * easedReturn;
    }
  }

  if (watchMode.active && watchMode.watched) {
    hour = base.hour;
    minute = base.minute;
    hourScale = 1;
    minuteScale = 1;
  }

  setHandTransform(hourHand, hour, hourScale);
  setHandTransform(minuteHand, minute, minuteScale);
  requestAnimationFrame(tick);
}

motionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    playMotion(button.dataset.motion);
  });
});

clearHistory.addEventListener("click", () => {
  history = [];
  renderHistory();
});

watchToggle.addEventListener("click", () => {
  if (watchMode.active) {
    stopWatchMode();
    return;
  }
  startWatchMode();
});

buildDial();
renderHistory();
updateStatus("yawn", "あくび");
drawTrails("yawn");
tick();
