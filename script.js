const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJM_fPxtlc5UEyNf0DHLNg5B4tGIm8Qbba3k78kbQDRj9a9jGpSDRHwz_UOgAz4jbpcRJKHEUe1eNY/pub?gid=1007467973&single=true&output=csv";

const ROUND_SIZE = 5;

const topRowEl = document.getElementById("topRow");
const bottomRowEl = document.getElementById("bottomRow");
const progressEl = document.getElementById("progress");

let allPairs = [];
let roundPairs = [];

let topCards = [];
let bottomCards = [];

let selectedTopId = null;
let solvedCount = 0;

let currentAudio = null;
let currentAudioButton = null;
let currentAudioCardId = null;

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

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (currentAudioButton) {
    currentAudioButton.classList.remove("playing");
    currentAudioButton.textContent = "Escuchar";
    currentAudioButton.setAttribute("aria-pressed", "false");
    currentAudioButton = null;
  }

  currentAudioCardId = null;
}

function playAudio(url, button, cardId) {
  if (!url) return;

  if (currentAudio && currentAudioCardId === cardId) {
    stopCurrentAudio();
    return;
  }

  stopCurrentAudio();

  const audio = new Audio(url);
  currentAudio = audio;
  currentAudioButton = button;
  currentAudioCardId = cardId;

  button.classList.add("playing");
  button.textContent = "Detener";
  button.setAttribute("aria-pressed", "true");

  audio.addEventListener("ended", () => {
    stopCurrentAudio();
  });

  audio.addEventListener("error", () => {
    stopCurrentAudio();
  });

  audio.play().catch(() => {
    stopCurrentAudio();
  });
}

function updateProgress() {
  progressEl.textContent = `${solvedCount}/${roundPairs.length}`;
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
        playAudio(pair.audio1, audioBtn, `top-${pair.id}`);
      }
    });

    const audioBtn = card.querySelector(".audio-btn");
    audioBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (card.classList.contains("locked")) return;

      if (selectedTopId !== pair.id) {
        setTopSelection(pair.id);
      }

      playAudio(pair.audio1, audioBtn, `top-${pair.id}`);
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

      playAudio(pair.audio2, audioBtn, `bottom-${pair.id}`);
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
