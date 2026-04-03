const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJM_fPxtlc5UEyNf0DHLNg5B4tGIm8Qbba3k78kbQDRj9a9jGpSDRHwz_UOgAz4jbpcRJKHEUe1eNY/pub?gid=1007467973&single=true&output=csv";

const ROUND_SIZE = 5;
const FRAGMENT_SECONDS = 10;
const FADE_IN_SECONDS = 0.8;
const FADE_OUT_SECONDS = 0.8;
const FADE_INTERVAL_MS = 50;

const topRowEl = document.getElementById("topRow");
const bottomRowEl = document.getElementById("bottomRow");

const overlayEl = document.getElementById("overlay");
const overlayKickerEl = document.getElementById("overlayKicker");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const overlayButtonEl = document.getElementById("overlayButton");

const currencies = [
  { name: "dólares", symbol: "$", emoji: "🇺🇸" },
  { name: "pesos mexicanos", symbol: "$", emoji: "🇲🇽" },
  { name: "soles", symbol: "S/", emoji: "🇵🇪" },
  { name: "bolívares", symbol: "Bs", emoji: "🇻🇪" },
  { name: "guaraníes", symbol: "Gs", emoji: "🇵🇾" },
  { name: "lempiras", symbol: "L", emoji: "🇭🇳" },
  { name: "quetzales", symbol: "Q", emoji: "🇬🇹" },
  { name: "córdobas", symbol: "C$", emoji: "🇳🇮" },
  { name: "reales", symbol: "R$", emoji: "🇧🇷" },
  { name: "pesos argentinos", symbol: "$", emoji: "🇦🇷" }
];

const soundGain = new Audio("assets/gain.mp3");
const soundLoss = new Audio("assets/loss.mp3");

let allPairs = [];
let roundPairs = [];

let topCards = [];
let bottomCards = [];

let selectedTopId = null;
let solvedCount = 0;
let listenCount = 0;

let currentAudioState = null;

let balance = 100;
let currency = "$";

let correctMatches = 0;
let wrongAttempts = 0;

let roundNumber = 1;
let usedPairIds = new Set();

let hudTimeout = null;
let displayedBalance = 100;
let hudCountInterval = null;

let currencyName = "dólares";
let currencyEmoji = "🇺🇸";

function pickCurrency() {
  const c = currencies[Math.floor(Math.random() * currencies.length)];
  currency = c.symbol;
  currencyName = c.name;
  currencyEmoji = c.emoji;
}

function singularCurrency(name) {
  const map = {
    "dólares": "dólar",
    "pesos mexicanos": "peso mexicano",
    "soles": "sol",
    "bolívares": "bolívar",
    "guaraníes": "guaraní",
    "lempiras": "lempira",
    "quetzales": "quetzal",
    "córdobas": "córdoba",
    "reales": "real",
    "pesos argentinos": "peso argentino"
  };

  return map[name] || name;
}

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return "#b8ab95";
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
  return "#b8ab95";
}

function showLoadingOverlay() {
  if (!overlayEl) return;

  overlayEl.classList.remove("is-hidden");
  overlayEl.classList.add("overlay-loading");

  overlayKickerEl.textContent = "";
  overlayTitleEl.textContent = "Cargando…";
  overlayTextEl.innerHTML = "";
  overlayButtonEl.hidden = true;
}

function mapRow(row, index) {
  const normalized = {};

  Object.keys(row).forEach((key) => {
    normalized[normalizeHeader(key)] = String(row[key] || "").trim();
  });

  return {
    id: `pair-${index + 1}`,
    autor: normalized.autor || "",
    obra: normalized.obra || "",
    ano: normalized.ano || "",
    pais: normalized.pais || "",
    color: normalizeColor(normalized.color),
    colorLight: lightenColor(normalizeColor(normalized.color), 0.25),
    audio1: normalized.audio1 || "",
    foto1: normalized.foto1 || "",
    audio2: normalized.audio2 || "",
    foto2: normalized.foto2 || "",
    texto: normalized.texto || "",
    interprete: normalized.interprete || "",
    ano_interprete: normalized.ano_interprete || ""
  };
}

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}

function showOverlayScreen(type) {
  if (!overlayEl) return;

  overlayEl.classList.remove("is-hidden");
  overlayEl.classList.remove("overlay-loading");
  overlayButtonEl.hidden = false;

  let kicker = "";
  let title = "";
  let text = "";
  let buttonLabel = "Continuar";

  if (type === "intro") {
    kicker = "";
    title = "RONDA 1";
    text = `
      <p>Escucha y empareja las <strong class="core">obras de la fila superior</strong> con las <strong class="core">versiones de la fila inferior</strong>.</p>
      <p>Comenzarás con <strong class="core">100 ${currencyName} ${currencyEmoji}</strong>, que podrás <strong class="gain">incrementar</strong> o <strong class="loss">perder</strong> según tus aciertos y errores.</p>
      <p>Escucha con atención para decidir con criterio.</p>
    `;
    buttonLabel = "Comenzar";
  }

  if (type === "round2") {
    kicker = "";
    title = "RONDA 2";
    text = `
      <p>En esta ronda, los <strong class="gain">aciertos valen más</strong> y los <strong class="loss">errores penalizan más</strong>.</p>
    `;
    buttonLabel = "Jugar";
  }

  if (type === "final") {
    kicker = "";
    title = "RESULTADOS";
    text = `
      <p>Saldo final: <strong class="core">${currency}${balance}</strong></p>
      <p>Aciertos: <strong class="gain">${correctMatches}</strong> · Errores: <strong class="loss">${wrongAttempts}</strong></p>
    `;
    buttonLabel = "Cerrar";
  }

  overlayKickerEl.textContent = kicker;
  overlayTitleEl.textContent = title;
  overlayTextEl.innerHTML = text;
  overlayButtonEl.textContent = buttonLabel;

  overlayButtonEl.onclick = () => {
    if (type === "round2") {
      buildRound();
    }
    overlayEl.classList.add("is-hidden");
  };
}

function clearTopSelection() {
  selectedTopId = null;

  document.querySelectorAll(".card.top").forEach((card) => {
    card.classList.remove("active");

    const badge = card.querySelector(".state-badge");
    if (!badge) return;

    if (card.classList.contains("locked")) {
      badge.textContent = "Resuelta";
    } else {
      badge.textContent = "";
    }
  });
}

function flashHUD(type) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  let className = "";

  if (type === "gain") className = "flash-green";
  else if (type === "loss") className = "flash-red";
  else if (type === "listen") className = "flash-listen";

  hud.classList.add(className);

  setTimeout(() => {
    hud.classList.remove(className);
  }, 380);
}

function animateHUDValue(targetBalance, delta = 0) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  if (hudCountInterval) {
    clearInterval(hudCountInterval);
  }

  const start = displayedBalance;
  const end = targetBalance;
  const diff = end - start;

  if (diff === 0) {
    const sign = delta > 0 ? "+" : "";
    const deltaText = delta !== 0 ? `${sign}${delta}` : "";
    hud.textContent = delta !== 0
      ? `${deltaText} | ${currency}${end}`
      : `${currency}${end}`;
    return;
  }

  const steps = Math.min(12, Math.max(4, Math.abs(diff)));
  const stepValue = diff / steps;
  let currentStep = 0;

  hudCountInterval = setInterval(() => {
    currentStep += 1;

    const currentValue =
      currentStep >= steps
        ? end
        : Math.round(start + stepValue * currentStep);

    const sign = delta > 0 ? "+" : "";
    const deltaText = delta !== 0 ? `${sign}${delta}` : "";

    hud.textContent = delta !== 0
      ? `${deltaText} | ${currency}${currentValue}`
      : `${currency}${currentValue}`;

    if (currentStep >= steps) {
      clearInterval(hudCountInterval);
      hudCountInterval = null;
      displayedBalance = end;
    }
  }, 35);
}

function setTopSelection(id) {
  selectedTopId = id;

  document.querySelectorAll(".card.top").forEach((card) => {
    const isActive = card.dataset.id === id;
    card.classList.toggle("active", isActive);

    const badge = card.querySelector(".state-badge");
    if (!badge) return;

    if (card.classList.contains("locked")) {
      badge.textContent = "Resuelta";
    } else if (isActive) {
      badge.textContent = "Seleccionada";
    } else {
      badge.textContent = "";
    }
  });
}

function resetAudioButton(button) {
  if (!button) return;
  button.classList.remove("playing");
  button.innerHTML = "▶";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Escuchar");
  button.setAttribute("title", "Escuchar");
}

function setAudioButtonPlaying(button) {
  if (!button) return;
  button.classList.add("playing");
  button.innerHTML = "■";
  button.setAttribute("aria-pressed", "true");
  button.setAttribute("aria-label", "Detener");
  button.setAttribute("title", "Detener");
}

function cleanupCurrentAudioState() {
  if (!currentAudioState) return;

  if (currentAudioState.fadeInterval) {
    clearInterval(currentAudioState.fadeInterval);
  }

  if (currentAudioState.stopTimer) {
    clearTimeout(currentAudioState.stopTimer);
  }

  if (currentAudioState.audio) {
    currentAudioState.audio.pause();
    currentAudioState.audio.src = "";
  }

  resetAudioButton(currentAudioState.button);
  currentAudioState = null;
}

function stopCurrentAudio() {
  cleanupCurrentAudioState();
}

function getRandomStartTime(duration, fragmentLength) {
  if (!Number.isFinite(duration) || duration <= fragmentLength) return 0;
  const maxStart = Math.max(0, duration - fragmentLength);
  return Math.random() * maxStart;
}

function fadeVolume(audio, from, to, durationSeconds, onComplete) {
  if (!audio || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    if (audio) audio.volume = to;
    if (typeof onComplete === "function") onComplete();
    return null;
  }

  const steps = Math.max(1, Math.round((durationSeconds * 1000) / FADE_INTERVAL_MS));
  const delta = (to - from) / steps;
  let currentStep = 0;

  audio.volume = from;

  const intervalId = setInterval(() => {
    currentStep += 1;
    audio.volume = Math.max(0, Math.min(1, from + delta * currentStep));

    if (currentStep >= steps) {
      clearInterval(intervalId);
      audio.volume = to;
      if (typeof onComplete === "function") onComplete();
    }
  }, FADE_INTERVAL_MS);

  return intervalId;
}

function playRandomFragment(url, button, cardId) {
  penalizeListen();
  if (!url || !button || !cardId) return;

  const sameCardIsPlaying =
    currentAudioState &&
    currentAudioState.cardId === cardId;

  if (sameCardIsPlaying) {
    stopCurrentAudio();
    return;
  }

  stopCurrentAudio();

  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = url;

  const state = {
    audio,
    button,
    cardId,
    fadeInterval: null,
    stopTimer: null,
    ending: false
  };

  currentAudioState = state;
  setAudioButtonPlaying(button);

  audio.addEventListener("loadedmetadata", () => {
    if (currentAudioState !== state) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const fragmentLength = Math.min(FRAGMENT_SECONDS, duration || FRAGMENT_SECONDS);

    const startTime = getRandomStartTime(duration, fragmentLength);
    const effectiveDuration = duration > 0
      ? Math.min(fragmentLength, Math.max(0.2, duration - startTime))
      : FRAGMENT_SECONDS;

    const fadeIn = Math.min(FADE_IN_SECONDS, effectiveDuration / 3);
    const fadeOut = Math.min(FADE_OUT_SECONDS, effectiveDuration / 3);
    const mainPlayTime = Math.max(0, effectiveDuration - fadeIn - fadeOut);

    audio.currentTime = startTime;
    audio.volume = 0;

    audio.play()
      .then(() => {
        if (currentAudioState !== state) return;

        listenCount += 1;

        state.fadeInterval = fadeVolume(audio, 0, 1, fadeIn, () => {
          if (currentAudioState !== state) return;

          state.stopTimer = setTimeout(() => {
            if (currentAudioState !== state || state.ending) return;

            state.ending = true;
            state.fadeInterval = fadeVolume(audio, audio.volume, 0, fadeOut, () => {
              if (currentAudioState !== state) return;
              cleanupCurrentAudioState();
            });
          }, mainPlayTime * 1000);
        });
      })
      .catch(() => {
        if (currentAudioState === state) {
          cleanupCurrentAudioState();
        }
      });
  });

  audio.addEventListener("error", () => {
    if (currentAudioState === state) {
      cleanupCurrentAudioState();
    }
  });
}

function markSolved(pairId) {
  const pair = roundPairs.find((item) => item.id === pairId);
  if (!pair) return;

  const topCard = topRowEl.querySelector(`.card.top[data-id="${pairId}"]`);
  const bottomCard = bottomRowEl.querySelector(`.card.bottom[data-id="${pairId}"]`);

  if (topCard) {
    topCard.classList.add("locked");
    topCard.classList.remove("active");

    const badge = topCard.querySelector(".state-badge");
    if (badge) {
      badge.textContent = "Resuelta";
    }
  }

  if (bottomCard) {
    bottomCard.classList.add("locked", "correct");
    bottomCard.style.borderColor = pair.colorLight;
    bottomCard.style.background = pair.colorLight;

    const body = bottomCard.querySelector(".card-body");
    const meta = bottomCard.querySelector(".bottom-meta");
    const overlay = bottomCard.querySelector(".bottom-text-overlay");
    const badge = bottomCard.querySelector(".state-badge");

    if (body) {
      body.style.background = "transparent";
    }

    if (meta) {
      if (pair.interprete || pair.ano_interprete) {
        meta.innerHTML = `
          <div class="interprete">${pair.interprete || "Versión identificada"}</div>
          ${pair.ano_interprete ? `<div class="ano-interprete">${pair.ano_interprete}</div>` : ""}
        `;
      } else {
        meta.innerHTML = `<div class="interprete">Versión identificada</div>`;
      }
    }

    if (overlay) {
      overlay.innerHTML = `
        <div class="text">${pair.texto || "Emparejado correctamente."}</div>
      `;
    }

    if (badge) {
      badge.textContent = "Resuelta";
    }
  }

  solvedCount += 1;
  clearTopSelection();
  stopCurrentAudio();

  if (solvedCount === roundPairs.length) {
    setTimeout(() => {
      onRoundComplete();
    }, 150);
  }
}

function flashError(card) {
  if (!card) return;
  card.classList.add("error");
  setTimeout(() => {
    card.classList.remove("error");
  }, 280);
}

function tryMatch(bottomId, bottomCard) {
  if (!selectedTopId) return;

  if (selectedTopId === bottomId) {
    rewardSuccess();
    markSolved(bottomId);
  } else {
    const remaining = getRemainingPairs();
    penalizeError(remaining);
    flashError(bottomCard);
  }
}

function lightenColor(hex, amount = 0.2) {
  const clean = hex.replace("#", "");

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);

  return `rgb(${newR}, ${newG}, ${newB})`;
}

function renderTopCards() {
  topRowEl.innerHTML = "";

  topCards.forEach((pair) => {
    const card = document.createElement("article");
    card.className = "card top";
    card.dataset.id = pair.id;
    card.style.background = pair.colorLight;
    card.style.borderColor = pair.color;

    card.innerHTML = `
      <div class="card-inner">
        <div class="media">
          <img src="${pair.foto1 || ""}" alt="${escapeHtml(pair.obra || "Original")}">
          <button class="audio-btn" type="button" aria-pressed="false" aria-label="Escuchar" title="Escuchar">▶</button>
        </div>

        <div class="card-body">
          <div class="author">${escapeHtml(pair.autor)}</div>
          <div class="work">${escapeHtml(pair.obra)}</div>
          <div class="meta">${escapeHtml(pair.ano)} · ${escapeHtml(pair.pais)}</div>
        </div>

        <div class="state-badge"></div>
      </div>
    `;

    card.addEventListener("click", (event) => {
      if (card.classList.contains("locked")) return;
      if (event.target.closest(".audio-btn")) return;

      if (selectedTopId === pair.id) {
        clearTopSelection();
      } else {
        setTopSelection(pair.id);
      }
    });

    const audioBtn = card.querySelector(".audio-btn");
    audioBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (card.classList.contains("locked")) return;

      playRandomFragment(pair.audio1, audioBtn, `top-${pair.id}`);
    });

    topRowEl.appendChild(card);
  });
}

function renderBottomCards() {
  bottomRowEl.innerHTML = "";

  bottomCards.forEach((pair) => {
    const card = document.createElement("article");
    card.className = "card bottom";
    card.dataset.id = pair.id;
    card.style.background = "";
    card.style.borderColor = "";

    card.innerHTML = `
      <div class="card-inner">
        <div class="media">
          <img src="${pair.foto2 || ""}" alt="Versión">

          <button class="audio-btn" type="button" aria-pressed="false" aria-label="Escuchar" title="Escuchar">▶</button>

          <div class="bottom-text-overlay"></div>

          <div class="state-badge"></div>
        </div>

        <div class="card-body">
          <div class="bottom-meta">
            ${pair.interprete ? `<div class="interprete">${pair.interprete}</div>` : ""}
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (event) => {
      if (card.classList.contains("locked")) return;
      if (event.target.closest(".audio-btn")) return;

      tryMatch(pair.id, card);
    });

    const audioBtn = card.querySelector(".audio-btn");
    audioBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (card.classList.contains("locked")) return;

      playRandomFragment(pair.audio2, audioBtn, `bottom-${pair.id}`);
    });

    bottomRowEl.appendChild(card);
  });
}

function buildRound() {
  const availablePairs = allPairs.filter((item) => item.audio1 && item.audio2);

  if (roundNumber === 1) {
    pickCurrency();
    balance = 100;
    displayedBalance = balance;
    correctMatches = 0;
    wrongAttempts = 0;
    listenCount = 0;

    const shuffled = shuffle(availablePairs);
    roundPairs = shuffled.slice(0, Math.min(ROUND_SIZE, shuffled.length));
    usedPairIds = new Set(roundPairs.map(p => p.id));
  } else {
    const remaining = availablePairs.filter(p => !usedPairIds.has(p.id));
    const shuffled = shuffle(remaining);
    roundPairs = shuffled.slice(0, Math.min(ROUND_SIZE, shuffled.length));

    roundPairs.forEach(p => usedPairIds.add(p.id));
  }

  topCards = shuffle(roundPairs);
  bottomCards = shuffle(roundPairs);

  if (topCards.length > 1) {
    let aligned = true;
    let attempts = 0;

    while (aligned && attempts < 12) {
      aligned = topCards.some((item, index) => bottomCards[index] && bottomCards[index].id === item.id);
      if (aligned) bottomCards = shuffle(roundPairs);
      attempts += 1;
    }
  }

  solvedCount = 0;
  selectedTopId = null;
  stopCurrentAudio();
  updateHUD();

  renderTopCards();
  renderBottomCards();
}

function onRoundComplete() {
  if (roundNumber === 1) {
    roundNumber++;
    showOverlayScreen("round2");
  } else {
    showOverlayScreen("final");
  }
}

function showFinalScreen() {
  const hud = document.getElementById("hud");

  hud.textContent = `Final: ${currency}${balance} · ✔ ${correctMatches} · ✖ ${wrongAttempts}`;
}

function getRemainingPairs() {
  return roundPairs.length - solvedCount;
}

function penalizeListen() {
  const cost = 1;

  balance -= cost;
  listenCount++;

  updateHUD(-cost);
  flashHUD("listen");
}

let lastDelta = 0;

function updateHUD(delta = 0) {
  const hud = document.getElementById("hud");
  if (!hud) return;

  if (hudTimeout) {
    clearTimeout(hudTimeout);
  }

  animateHUDValue(balance, delta);

  if (delta !== 0) {
    hudTimeout = setTimeout(() => {
      fadeToBalanceOnly();
    }, 1400);
  }
}

function penalizeError(remaining) {
  let penalty = 0;

  if (remaining >= 5) penalty = 4;
  else if (remaining === 4) penalty = 6;
  else if (remaining === 3) penalty = 8;
  else if (remaining === 2) penalty = 11;
  else penalty = 15;

  if (roundNumber === 2) {
    penalty += 3;
  }

  balance -= penalty;
  wrongAttempts++;

  updateHUD(-penalty);
  flashHUD("loss");
  soundLoss.currentTime = 0;
  soundLoss.play();
}

function rewardSuccess() {
  const gain = roundNumber === 2 ? 4 : 2;

  balance += gain;
  correctMatches++;

  updateHUD(gain);
  flashHUD("gain");
  soundGain.currentTime = 0;
  soundGain.play();
}

function fadeToBalanceOnly() {
  const hud = document.getElementById("hud");
  if (!hud) return;

  hud.style.transition = "opacity 0.2s ease";
  hud.style.opacity = "0.6";

  setTimeout(() => {
    hud.textContent = `${currency}${balance}`;
    displayedBalance = balance;
    hud.style.opacity = "1";
  }, 180);
}

function loadCSV() {
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      allPairs = results.data
        .map(mapRow)
        .filter((item) => item.autor || item.obra || item.audio1 || item.audio2);
    
      buildRound();                 // 👈 prepara el tablero
      showOverlayScreen("intro");   // 👈 muestra pantalla inicial
    },
    error: () => {
      topRowEl.innerHTML = "<p>No se pudo cargar el CSV.</p>";
      bottomRowEl.innerHTML = "";
    }
  });
}

showLoadingOverlay();
loadCSV();
