const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJM_fPxtlc5UEyNf0DHLNg5B4tGIm8Qbba3k78kbQDRj9a9jGpSDRHwz_UOgAz4jbpcRJKHEUe1eNY/pub?gid=1007467973&single=true&output=csv";

const ROUND_SIZE = 5;
const FRAGMENT_SECONDS = 10;
const FADE_IN_SECONDS = 0.8;
const FADE_OUT_SECONDS = 0.8;
const FADE_INTERVAL_MS = 50;

const topRowEl = document.getElementById("topRow");
const bottomRowEl = document.getElementById("bottomRow");
const progressEl = document.getElementById("progress");

let allPairs = [];
let roundPairs = [];

let topCards = [];
let bottomCards = [];

let selectedTopId = null;
let solvedCount = 0;
let listenCount = 0;

let currentAudioState = null;

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
    audio1: normalized.audio1 || "",
    foto1: normalized.foto1 || "",
    audio2: normalized.audio2 || "",
    foto2: normalized.foto2 || "",
    texto: normalized.texto || ""
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

function updateProgress() {
  progressEl.textContent = `${solvedCount}/${roundPairs.length} · escuchas: ${listenCount}`;
}

function clearTopSelection() {
  selectedTopId = null;

  document.querySelectorAll(".card.top").forEach((card) => {
    card.classList.remove("active");
  });
}

function setTopSelection(id) {
  selectedTopId = id;

  document.querySelectorAll(".card.top").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });
}

function resetAudioButton(button) {
  if (!button) return;
  button.classList.remove("playing");
  button.textContent = "Escuchar";
  button.setAttribute("aria-pressed", "false");
}

function setAudioButtonPlaying(button) {
  if (!button) return;
  button.classList.add("playing");
  button.textContent = "Detener";
  button.setAttribute("aria-pressed", "true");
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
        updateProgress();

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
  }

  if (bottomCard) {
    bottomCard.classList.add("locked", "correct");
    bottomCard.style.background = pair.color;
    bottomCard.style.borderColor = pair.color;
    bottomCard.innerHTML = `
      <img src="${pair.foto2 || ""}" alt="${escapeHtml(pair.obra || "Versión")}">
      <div class="card-body">
        <div class="text">${escapeHtml(pair.texto || "Emparejado correctamente.")}</div>
      </div>
    `;
  }

  solvedCount += 1;
  updateProgress();
  clearTopSelection();
  stopCurrentAudio();

  if (solvedCount === roundPairs.length) {
    setTimeout(() => {
      alert("Ronda completada");
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
  if (!selectedTopId) {
    flashError(bottomCard);
    return;
  }

  if (selectedTopId === bottomId) {
    markSolved(bottomId);
  } else {
    flashError(bottomCard);
  }
}

function renderTopCards() {
  topRowEl.innerHTML = "";

  topCards.forEach((pair) => {
    const card = document.createElement("article");
    card.className = "card top";
    card.dataset.id = pair.id;
    card.style.background = pair.color;
    card.style.borderColor = pair.color;

    card.innerHTML = `
      <img src="${pair.foto1 || ""}" alt="${escapeHtml(pair.obra || "Original")}">
      <div class="card-body">
        <div class="author">${escapeHtml(pair.autor)}</div>
        <div class="work">${escapeHtml(pair.obra)}</div>
        <div class="meta">${escapeHtml(pair.ano)} · ${escapeHtml(pair.pais)}</div>
        <button class="audio-btn" type="button" aria-pressed="false">Escuchar</button>
      </div>
    `;

    card.addEventListener("click", (event) => {
      if (card.classList.contains("locked")) return;

      const audioBtn = card.querySelector(".audio-btn");

      if (event.target.closest(".audio-btn")) {
        return;
      }

      if (selectedTopId === pair.id) {
        clearTopSelection();
        stopCurrentAudio();
      } else {
        setTopSelection(pair.id);
        playRandomFragment(pair.audio1, audioBtn, `top-${pair.id}`);
      }
    });

    const audioBtn = card.querySelector(".audio-btn");
    audioBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (card.classList.contains("locked")) return;

      if (selectedTopId !== pair.id) {
        setTopSelection(pair.id);
      }

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

    card.innerHTML = `
      <img src="${pair.foto2 || ""}" alt="Versión">
      <div class="card-body">
        <button class="audio-btn" type="button" aria-pressed="false">Escuchar</button>
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
  const shuffled = shuffle(allPairs).filter((item) => item.audio1 && item.audio2);
  roundPairs = shuffled.slice(0, Math.min(ROUND_SIZE, shuffled.length));

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
  listenCount = 0;
  stopCurrentAudio();
  updateProgress();

  renderTopCards();
  renderBottomCards();
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

      buildRound();
    },
    error: () => {
      topRowEl.innerHTML = "<p>No se pudo cargar el CSV.</p>";
      bottomRowEl.innerHTML = "";
    }
  });
}

loadCSV();
