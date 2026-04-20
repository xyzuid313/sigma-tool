const HISTORY_KEY = "signal-desk-history";
const HISTORY_LIMIT = 8;
const THEME_KEY = "signal-desk-theme";
const NOTES_KEY = "signal-desk-notes";
const GROUP_LABELS = {
  discord: "Discord",
  telegram: "Telegram",
  vk: "VK",
  global: "Global"
};

const analyzeButton = document.getElementById("analyze-btn");
const clearButton = document.getElementById("clear-btn");
const exportButton = document.getElementById("export-btn");
const clearHistoryButton = document.getElementById("clear-history-btn");
const profileInput = document.getElementById("profile-input");
const caseNotes = document.getElementById("case-notes");
const sampleButtons = document.querySelectorAll("[data-sample]");
const statusCard = document.getElementById("status-card");
const identityList = document.getElementById("identity-list");
const noteList = document.getElementById("note-list");
const toolFilters = document.getElementById("tool-filters");
const toolGroups = document.getElementById("tool-groups");
const chainView = document.getElementById("chain-view");
const historyList = document.getElementById("history-list");
const themeSwitcher = document.getElementById("theme-switcher");

const overviewTitle = document.getElementById("overview-title");
const overviewSubtitle = document.getElementById("overview-subtitle");
const platformPill = document.getElementById("platform-pill");
const overviewIdentities = document.getElementById("overview-identities");
const overviewTools = document.getElementById("overview-tools");
const overviewCategories = document.getElementById("overview-categories");

const metaPlatform = document.getElementById("meta-platform");
const metaIdentities = document.getElementById("meta-identities");
const metaTools = document.getElementById("meta-tools");
const metaNotes = document.getElementById("meta-notes");
const metaSummary = document.getElementById("meta-summary");

const vkForm = document.getElementById("vk-resolve-form");
const vkInput = document.getElementById("vk-url");
const vkResult = document.getElementById("vk-result");
const copyVkButton = document.getElementById("copy-vk-btn");

let currentVkUserId = "";
let currentAnalysis = null;
let currentPlatformFilter = "all";
let historyCache = loadHistory();
let notesCache = loadCaseNotes();
let revealObserver = null;

function setStatus(text, isError = false) {
  statusCard.textContent = text;
  statusCard.classList.toggle("error", isError);
}

function setAnalyzeLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.classList.toggle("loading", isLoading);
  analyzeButton.textContent = isLoading ? "Analyzing..." : "Run Analysis";
}

function setVkResult(text, isError = false) {
  vkResult.textContent = text;
  vkResult.classList.toggle("error", isError);
}

function scanRevealTargets(scope = document) {
  const nodes = scope.querySelectorAll(".reveal, .motion-item");
  if (!nodes.length) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: "0px 0px -8% 0px"
      }
    );
  }

  nodes.forEach((node) => {
    if (node.dataset.motionObserved) {
      return;
    }
    node.dataset.motionObserved = "1";
    revealObserver.observe(node);
  });
}

function enableGlowParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  if (!window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  const glowA = document.querySelector(".glow-a");
  const glowB = document.querySelector(".glow-b");
  if (!glowA || !glowB) {
    return;
  }

  let rafId = 0;
  let nextX = 0;
  let nextY = 0;

  const paint = () => {
    rafId = 0;
    glowA.style.transform = `translate3d(${nextX * -1}px, ${nextY * -1}px, 0)`;
    glowB.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  };

  window.addEventListener("pointermove", (event) => {
    nextX = (event.clientX / window.innerWidth - 0.5) * 14;
    nextY = (event.clientY / window.innerHeight - 0.5) * 14;
    if (!rafId) {
      rafId = window.requestAnimationFrame(paint);
    }
  }, { passive: true });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmpty(container, className, text) {
  container.className = `${className} empty-state`;
  container.textContent = text;
  container.dataset.hash = text;
}

function createCopyButton(value) {
  return `<button type="button" class="copy-inline-btn" data-copy="${escapeHtml(value)}">Copy</button>`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCaseNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHistory(items) {
  historyCache = items.slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyCache));
}

function saveCaseNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notesCache));
}

function getCurrentCaseKey() {
  return profileInput.value.trim();
}

function hydrateCaseNotes() {
  const key = getCurrentCaseKey();
  caseNotes.value = key ? notesCache[key] || "" : "";
}

function persistCurrentCaseNotes() {
  const key = getCurrentCaseKey();
  if (!key) {
    return;
  }

  const value = caseNotes.value.trim();
  if (value) {
    notesCache[key] = value;
  } else {
    delete notesCache[key];
  }
  saveCaseNotes();
}

function pushHistoryEntry(analysis, input) {
  const next = [
    {
      id: `${Date.now()}`,
      input,
      platform: analysis.platformLabel || analysis.platform || "Unknown",
      title: analysis.title,
      generatedAt: analysis.generatedAt,
      counts: analysis.counts || { identities: 0, tools: 0, notes: 0 }
    },
    ...historyCache.filter((item) => item.input !== input)
  ];

  saveHistory(next);
  renderHistory();
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ru-RU");
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll("[data-theme]").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === theme);
  });
}

function hydrateTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "killer");
}

function updateMeta(analysis) {
  if (!analysis) {
    metaPlatform.textContent = "Пока нет";
    metaIdentities.textContent = "0";
    metaTools.textContent = "0";
    metaNotes.textContent = "0";
    metaSummary.textContent = "После анализа тут появится короткая сводка по кейсу.";
    overviewTitle.textContent = "Ничего не выбрано";
    overviewSubtitle.textContent = "Запусти анализ, и здесь появится краткое описание текущего набора данных.";
    platformPill.textContent = "idle";
    platformPill.dataset.platform = "idle";
    overviewIdentities.textContent = "0";
    overviewTools.textContent = "0";
    overviewCategories.textContent = "0";
    exportButton.disabled = true;
    return;
  }

  metaPlatform.textContent = analysis.platformLabel || analysis.platform;
  metaIdentities.textContent = String(analysis.counts?.identities || 0);
  metaTools.textContent = String(analysis.counts?.tools || 0);
  metaNotes.textContent = String(analysis.counts?.notes || 0);
  metaSummary.textContent = analysis.summary || analysis.subtitle || "Краткая сводка недоступна.";

  overviewTitle.textContent = analysis.title || "Результат анализа";
  overviewSubtitle.textContent = analysis.subtitle || "";
  platformPill.textContent = analysis.platformLabel || analysis.platform || "unknown";
  platformPill.dataset.platform = analysis.platform || "unknown";
  overviewIdentities.textContent = String(analysis.counts?.identities || 0);
  overviewTools.textContent = String(analysis.counts?.tools || 0);
  overviewCategories.textContent = String((analysis.platformGroups || []).length);
  exportButton.disabled = false;
}

function renderIdentities(items) {
  if (!items.length) {
    renderEmpty(identityList, "identity-list", "Нет полей для отображения.");
    return;
  }

  const html = items
    .map((item) => {
      const toneClass = item.highlight ? "identity-card highlight motion-item" : "identity-card motion-item";
      const copyControl = item.copyable ? createCopyButton(item.value) : "";
      return `
        <article class="${toneClass}">
          <p class="identity-label">${escapeHtml(item.label)}</p>
          <div class="identity-value-row">
            <p class="identity-value">${escapeHtml(item.value)}</p>
            ${copyControl}
          </div>
        </article>
      `;
    })
    .join("");

  if (identityList.dataset.hash === html) {
    return;
  }

  identityList.className = "identity-list";
  identityList.dataset.hash = html;
  identityList.innerHTML = html;
  scanRevealTargets(identityList);
}

function getFilteredTools() {
  if (!currentAnalysis) {
    return [];
  }

  const tools = currentAnalysis.tools || [];
  if (currentPlatformFilter === "all") {
    return tools;
  }

  return tools.filter((tool) => (tool.platformGroup || "global") === currentPlatformFilter);
}

function groupToolsByPlatform(items) {
  return items.reduce((acc, item) => {
    const key = item.platformGroup || "global";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
}

function renderToolFilters(filters) {
  if (!filters.length) {
    toolFilters.innerHTML = "";
    toolFilters.dataset.hash = "";
    return;
  }

  const html = ["all", ...filters]
    .map((filterName) => {
      const active = filterName === currentPlatformFilter ? "filter-chip active" : "filter-chip";
      const label = filterName === "all" ? "All" : (GROUP_LABELS[filterName] || filterName);
      return `<button type="button" class="${active}" data-tool-filter="${escapeHtml(filterName)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  if (toolFilters.dataset.hash === html) {
    return;
  }

  toolFilters.dataset.hash = html;
  toolFilters.innerHTML = html;
}

function renderToolGroups() {
  const items = getFilteredTools();
  if (!items.length) {
    renderEmpty(toolGroups, "tool-groups", "Нет доступных ссылок для выбранного фильтра.");
    return;
  }

  const grouped = groupToolsByPlatform(items);
  const order = ["discord", "telegram", "vk", "global"];
  const html = order
    .filter((key) => grouped[key]?.length)
    .map((key) => {
      const cards = grouped[key]
        .map((item, index) => {
          const badge = item.kind ? `<span class="tool-kind">${escapeHtml(item.kind)}</span>` : "";
          const category = item.category ? `<span class="tool-category">${escapeHtml(item.category)}</span>` : "";
          return `
            <a class="tool-card motion-item stagger-${(index % 4) + 1}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
              <div class="tool-copy">
                <span class="tool-title">${escapeHtml(item.title)}</span>
                <span class="tool-url">${escapeHtml(item.url)}</span>
              </div>
              <div class="tool-meta">
                ${category}
                ${badge}
              </div>
            </a>
          `;
        })
        .join("");

      return `
        <section class="tool-section motion-item tool-section-${escapeHtml(key)}">
          <div class="tool-section-head">
            <span class="tool-section-dot"></span>
            <h3>${escapeHtml(GROUP_LABELS[key] || key)}</h3>
          </div>
          <div class="tool-section-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  if (toolGroups.dataset.hash === html) {
    return;
  }

  toolGroups.className = "tool-groups";
  toolGroups.dataset.hash = html;
  toolGroups.innerHTML = html;
  scanRevealTargets(toolGroups);
}

function renderChain(chain) {
  if (!chain?.length) {
    renderEmpty(chainView, "chain-view", "После анализа здесь появится визуальная цепь.");
    return;
  }

  const html = `
    <div class="chain-track">
      ${chain.map((item, index) => `
        <div class="chain-node motion-item ${index === 0 ? "main" : ""}">
          <span class="chain-label">${escapeHtml(item.label)}</span>
          <strong class="chain-value">${escapeHtml(item.value)}</strong>
        </div>
        ${index < chain.length - 1 ? '<span class="chain-arrow">→</span>' : ""}
      `).join("")}
    </div>
  `;

  if (chainView.dataset.hash === html) {
    return;
  }

  chainView.className = "chain-view";
  chainView.dataset.hash = html;
  chainView.innerHTML = html;
  scanRevealTargets(chainView);
}

function renderNotes(items) {
  if (!items.length) {
    renderEmpty(noteList, "note-list", "Нет подсказок.");
    return;
  }

  const html = items
    .map((item, index) => `<article class="note-card motion-item stagger-${(index % 4) + 1}"><span class="note-index">0${index + 1}</span><p>${escapeHtml(item)}</p></article>`)
    .join("");

  if (noteList.dataset.hash === html) {
    return;
  }

  noteList.className = "note-list";
  noteList.dataset.hash = html;
  noteList.innerHTML = html;
  scanRevealTargets(noteList);
}

function renderHistory() {
  if (!historyCache.length) {
    renderEmpty(historyList, "history-list", "История пока пуста.");
    return;
  }

  const html = historyCache
    .map((item) => `
      <button type="button" class="history-card motion-item" data-history-input="${escapeHtml(item.input)}">
        <span class="history-platform">${escapeHtml(item.platform)}</span>
        <strong class="history-input">${escapeHtml(item.input)}</strong>
        <span class="history-meta">${escapeHtml(formatDate(item.generatedAt))}</span>
        <span class="history-counts">${escapeHtml(`${item.counts.identities} полей • ${item.counts.tools} ссылок`)}</span>
      </button>
    `)
    .join("");

  if (historyList.dataset.hash === html) {
    return;
  }

  historyList.className = "history-list";
  historyList.dataset.hash = html;
  historyList.innerHTML = html;
  scanRevealTargets(historyList);
}

function resetDashboard() {
  currentAnalysis = null;
  currentPlatformFilter = "all";
  renderEmpty(identityList, "identity-list", "Пока нет данных.");
  renderEmpty(toolGroups, "tool-groups", "После анализа тут появятся секции сервисов.");
  renderEmpty(chainView, "chain-view", "После анализа здесь появится визуальная цепь.");
  renderEmpty(noteList, "note-list", "Подсказки появятся после анализа.");
  toolFilters.innerHTML = "";
  toolFilters.dataset.hash = "";
  updateMeta(null);
}

function applyAnalysis(analysis, input) {
  currentAnalysis = analysis;
  currentPlatformFilter = "all";
  updateMeta(analysis);

  requestAnimationFrame(() => {
    renderIdentities(analysis.identities || []);
    renderToolFilters(analysis.platformGroups || []);
    renderToolGroups();
    renderChain(analysis.chain || []);
    renderNotes(analysis.notes || []);
  });

  pushHistoryEntry(analysis, input);
  hydrateCaseNotes();
}

function getFriendlyNetworkError(error) {
  if (error instanceof TypeError || /Failed to fetch/i.test(error.message || "")) {
    return "Сервер недоступен. Запусти `node server.js` и открой сайт через http://localhost:3000";
  }

  return error.message || "Ошибка анализа.";
}

async function analyzeProfile() {
  const input = profileInput.value.trim();

  if (!input) {
    setStatus("Вставь ссылку, username, handle или id.", true);
    return;
  }

  setAnalyzeLoading(true);
  setStatus("SIGMA.XYZ processing case...");

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Не удалось выполнить анализ.");
    }

    applyAnalysis(data, input);
    setStatus(`${data.title}: ${data.subtitle}`);
  } catch (error) {
    setStatus(getFriendlyNetworkError(error), true);
    resetDashboard();
  } finally {
    setAnalyzeLoading(false);
  }
}

async function resolveVkUserId(event) {
  event.preventDefault();

  const url = vkInput.value.trim();
  currentVkUserId = "";
  copyVkButton.disabled = true;

  if (!url) {
    setVkResult("Вставь ссылку VK.", true);
    return;
  }

  setVkResult("Resolving VK numeric id...");

  try {
    const response = await fetch("/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Не удалось определить user_id.");
    }

    currentVkUserId = data.userId;
    copyVkButton.disabled = false;
    setVkResult(`user_id: ${data.userId}`);
  } catch (error) {
    setVkResult(getFriendlyNetworkError(error), true);
  }
}

analyzeButton.addEventListener("click", analyzeProfile);

clearButton.addEventListener("click", () => {
  profileInput.value = "";
  caseNotes.value = "";
  setStatus("Поле очищено.");
  resetDashboard();
  profileInput.focus();
});

exportButton.addEventListener("click", () => {
  if (!currentAnalysis) {
    return;
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadJson(`signal-desk-${currentAnalysis.platform || "result"}-${stamp}.json`, {
    ...currentAnalysis,
    localNotes: caseNotes.value.trim()
  });
});

clearHistoryButton.addEventListener("click", () => {
  historyCache = [];
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

profileInput.addEventListener("input", hydrateCaseNotes);

caseNotes.addEventListener("input", persistCurrentCaseNotes);

profileInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    analyzeProfile();
  }
});

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    profileInput.value = button.dataset.sample || "";
    profileInput.focus();
    hydrateCaseNotes();
  });
});

vkForm.addEventListener("submit", resolveVkUserId);

copyVkButton.addEventListener("click", async () => {
  if (!currentVkUserId) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentVkUserId);
    copyVkButton.textContent = "Скопировано";
    setTimeout(() => {
      copyVkButton.textContent = "Скопировать id";
    }, 1200);
  } catch {
    setVkResult("Не удалось скопировать id.", true);
  }
});

themeSwitcher.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) {
    return;
  }

  applyTheme(button.dataset.theme || "killer");
});

document.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy]");
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy || "");
      const original = copyButton.textContent;
      copyButton.textContent = "Copied";
      setTimeout(() => {
        copyButton.textContent = original;
      }, 900);
    } catch {
      setStatus("Не удалось скопировать значение.", true);
    }
    return;
  }

  const filterButton = event.target.closest("[data-tool-filter]");
  if (filterButton) {
    currentPlatformFilter = filterButton.dataset.toolFilter || "all";
    renderToolFilters(currentAnalysis?.platformGroups || []);
    renderToolGroups();
    return;
  }

  const historyButton = event.target.closest("[data-history-input]");
  if (historyButton) {
    profileInput.value = historyButton.dataset.historyInput || "";
    profileInput.focus();
    hydrateCaseNotes();
  }
});

hydrateTheme();
renderHistory();
resetDashboard();
hydrateCaseNotes();
scanRevealTargets();
enableGlowParallax();
