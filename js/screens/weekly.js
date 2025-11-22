// ==================================================
// 🗓️ 복용 이력 & 증상 관리 - 주간 리포트
// ==================================================

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HISTORY_STORAGE_KEY = "manualIntakeHistory";
const GROUP_STORAGE_KEY = "manualIntakeGroups";
const CARD_STORAGE_KEY = "medicationCards";

const STATUS_LABELS = { success: "복용", miss: "미복용", late: "지각" };
const CONDITION_LABELS = { good: "좋음", normal: "보통", bad: "나쁨" };
const CONDITION_EMOJI = { good: "😀", normal: "😐", bad: "😣" };

let weeklyData = createEmptyWeeklyData();
let weekDates = [];
let weeklyDayEls = [];
let historyListEl;
let selectedDateLabelEl;
let summaryContainerEl;
let currentWeekAnchor = new Date();
let selectedDayKey = DAY_KEYS[new Date().getDay()];
let selectedDateStr = formatDate(new Date());
let manualConditionValue = "";
let manualRefs = {};

document.addEventListener("DOMContentLoaded", () => {
  initWeeklyPage();
  initManualUi();
});

// ==================================================
// 🔹 날짜 관련 헬퍼
// ==================================================
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekLabel(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = String(month + 1).padStart(2, "0");
  const firstDay = new Date(year, month, 1);
  const adjustedDate = date.getDate() + firstDay.getDay();
  const weekNumber = Math.ceil(adjustedDate / 7);
  return `${year}년 ${monthLabel}월 ${weekNumber}주차`;
}

function getWeekDates(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return DAY_KEYS.map((_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
}

function createEmptyWeeklyData() {
  return {
    dayMetrics: DAY_KEYS.reduce((acc, key) => {
      acc[key] = { summary: { success: 0, miss: 0, late: 0 }, history: [] };
      return acc;
    }, {}),
    summaryTop: [],
  };
}

// ==================================================
// 🔹 Storage helpers
// ==================================================
const loadHistory = () => JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "{}");
const saveHistory = (data) => localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
const loadGroups = () => JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || "[]");
const saveGroups = (groups) => localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));
const loadMedicationCards = () => JSON.parse(localStorage.getItem(CARD_STORAGE_KEY) || "[]");

// ==================================================
// 🔹 Weekly dataset builder
// ==================================================
function buildWeeklyData(anchorDate) {
  const dataset = createEmptyWeeklyData();
  const history = loadHistory();
  const dates = getWeekDates(anchorDate);
  const missAggregator = {};

  dates.forEach((date, idx) => {
    const key = DAY_KEYS[idx];
    const dayStr = formatDate(date);
    const entries = history[dayStr] || [];
    const summary = { success: 0, miss: 0, late: 0 };

    const historyItems = entries.map((entry) => {
      const status = entry.status || "success";
      summary[status] = (summary[status] || 0) + 1;
      if (status === "miss") {
        entry.meds.forEach((name) => {
          missAggregator[name] = (missAggregator[name] || 0) + 1;
        });
      }

      return {
        time: entry.time || "--:--",
        name: entry.meds.join(", "),
        status,
        condition: entry.condition || "",
        memo: entry.memo || "",
      };
    });

    dataset.dayMetrics[key] = { summary, history: historyItems };
  });

  dataset.summaryTop = Object.entries(missAggregator)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return dataset;
}

const getDayMetrics = (key) => weeklyData.dayMetrics[key] || { summary: {}, history: [] };

// ==================================================
// 🔹 Weekly calendar + history UI
// ==================================================
function initWeeklyPage() {
  const periodLabel = document.querySelector(".weekly-period-label");
  weeklyDayEls = Array.from(document.querySelectorAll(".weekly-day"));
  historyListEl = document.querySelector(".weekly-history-list");
  selectedDateLabelEl = document.querySelector(".weekly-selected-date");
  summaryContainerEl = document.querySelector(".weekly-summary-bars");

  if (!periodLabel || !weeklyDayEls.length || !historyListEl || !selectedDateLabelEl) return;

  currentWeekAnchor.setHours(0, 0, 0, 0);
  weekDates = getWeekDates(currentWeekAnchor);
  weeklyData = buildWeeklyData(currentWeekAnchor);
  periodLabel.textContent = getWeekLabel(currentWeekAnchor);

  weeklyDayEls.forEach((dayEl, index) => {
    const key = dayEl.dataset.day || DAY_KEYS[index] || "sun";
    const idx = DAY_KEYS.indexOf(key);
    const dateObj = weekDates[idx >= 0 ? idx : index];
    dayEl.dataset.day = key;
    dayEl.dataset.fullDate = formatDate(dateObj);

    const dateEl = dayEl.querySelector(".weekly-day-date");
    if (dateEl) dateEl.textContent = dateObj.getDate();

    dayEl.addEventListener("click", () => selectDay(key, dayEl));
  });

  refreshWeeklyDots();

  const defaultEl =
    weeklyDayEls.find((el) => el.dataset.day === selectedDayKey) || weeklyDayEls[0];
  const defaultKey = defaultEl?.dataset.day || DAY_KEYS[0];
  selectDay(defaultKey, defaultEl);

  renderSummary(summaryContainerEl, weeklyData.summaryTop);
}

function selectDay(dayKey, dayElement) {
  const idx = DAY_KEYS.indexOf(dayKey);
  const dateObj = weekDates[idx >= 0 ? idx : 0];
  selectedDayKey = dayKey;
  selectedDateStr = formatDate(dateObj);

  weeklyDayEls.forEach((el) => el.classList.toggle("active", el === dayElement));
  renderHistory(
    getDayMetrics(dayKey).history,
    historyListEl,
    selectedDateLabelEl,
    selectedDateStr
  );
  syncManualDate(selectedDateStr);
}

function refreshWeeklyDots() {
  weeklyDayEls.forEach((dayEl) => {
    const key = dayEl.dataset.day;
    const metrics = getDayMetrics(key);
    const { summary } = metrics;
    const dotsWrapper = dayEl.querySelector(".weekly-day-dots");
    if (dotsWrapper) dotsWrapper.remove();

    const dots = document.createElement("div");
    dots.className = "weekly-day-dots";

    ["success", "miss", "late"].forEach((type) => {
      if ((summary[type] || 0) > 0) {
        const dot = document.createElement("span");
        dot.className = `weekly-day-dot ${type}`;
        dots.appendChild(dot);
      }
    });

    dayEl.appendChild(dots);
  });
}

function renderHistory(items, container, selectedDateLabel, dateLabel = "") {
  if (!container || !selectedDateLabel) return;

  container.innerHTML = "";
  selectedDateLabel.textContent = dateLabel || "";

  if (!items.length) {
    const empty = document.createElement("li");
    empty.textContent = "복용 기록이 없습니다.";
    empty.style.fontSize = "14px";
    empty.style.color = "#999";
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "weekly-history-item";

    const left = document.createElement("div");
    left.className = "weekly-history-left";

    const time = document.createElement("span");
    time.className = "weekly-history-time";
    time.textContent = item.time;

    const name = document.createElement("span");
    name.className = "weekly-history-pill-name";
    name.textContent = item.name;

    left.appendChild(time);
    left.appendChild(name);

    const detail = document.createElement("div");
    detail.className = "weekly-history-detail";
    if (item.condition) {
      const cond = document.createElement("span");
      cond.textContent = `${CONDITION_EMOJI[item.condition] || ""} ${CONDITION_LABELS[item.condition] || ""}`;
      detail.appendChild(cond);
    }
    if (item.memo) {
      const memo = document.createElement("span");
      memo.className = "weekly-history-memo";
      memo.textContent = item.memo;
      detail.appendChild(memo);
    }

    const status = document.createElement("span");
    status.className = `weekly-history-status ${item.status}`;
    status.textContent = STATUS_LABELS[item.status] || "복용";

    li.appendChild(left);
    if (detail.childNodes.length) li.appendChild(detail);
    li.appendChild(status);
    container.appendChild(li);
  });
}

function renderSummary(container, rows) {
  if (!container) return;
  container.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "weekly-summary-label";
    empty.textContent = "미복용 상위 데이터가 없습니다.";
    container.appendChild(empty);
    return;
  }

  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  rows.forEach((row) => {
    const wrapper = document.createElement("div");
    wrapper.className = "weekly-summary-row";

    const label = document.createElement("div");
    label.className = "weekly-summary-label";
    label.textContent = `${row.name} · 미복용 ${row.value}회`;

    const track = document.createElement("div");
    track.className = "weekly-summary-bar-track";

    const fill = document.createElement("div");
    fill.className = "weekly-summary-bar-fill";
    fill.style.width = `${(row.value / maxVal) * 100}%`;

    track.appendChild(fill);
    wrapper.appendChild(label);
    wrapper.appendChild(track);
    container.appendChild(wrapper);
  });
}

function refreshWeeklyDataset() {
  weeklyData = buildWeeklyData(currentWeekAnchor);
  refreshWeeklyDots();
  renderSummary(summaryContainerEl, weeklyData.summaryTop);
  const selectedEl = weeklyDayEls.find((el) => el.dataset.day === selectedDayKey);
  selectDay(selectedDayKey, selectedEl || weeklyDayEls[0]);
}

// ==================================================
// 🔹 Manual intake UI
// ==================================================
function initManualUi() {
  manualRefs = {
    dateInput: document.getElementById("manualDatePicker"),
    timeInput: document.getElementById("manualTimeInput"),
    memoInput: document.getElementById("manualMemoInput"),
    statusSelect: document.getElementById("manualStatusSelect"),
    addBtn: document.getElementById("manualAddRecordBtn"),
    drugList: document.getElementById("manualDrugList"),
    historyList: document.getElementById("manualHistoryList"),
    groupSelect: document.getElementById("manualGroupSelect"),
    applyGroupBtn: document.getElementById("manualApplyGroupBtn"),
    saveGroupBtn: document.getElementById("manualSaveGroupBtn"),
  };

  if (!manualRefs.dateInput || !manualRefs.drugList || !manualRefs.historyList) return;

  manualRefs.dateInput.value = selectedDateStr;
  if (manualRefs.timeInput) manualRefs.timeInput.value = getCurrentTime();

  renderManualDrugList();
  renderGroupSelect();
  renderManualHistoryList(selectedDateStr);

  manualRefs.addBtn?.addEventListener("click", handleManualSave);
  manualRefs.saveGroupBtn?.addEventListener("click", handleGroupSave);
  manualRefs.applyGroupBtn?.addEventListener("click", handleGroupApply);
  manualRefs.groupSelect?.addEventListener("change", () => {
    if (manualRefs.applyGroupBtn) {
      manualRefs.applyGroupBtn.disabled = !manualRefs.groupSelect.value;
    }
  });

  document.querySelectorAll(".condition-emoji-btn").forEach((btn) => {
    btn.addEventListener("click", () => setCondition(btn));
  });
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function renderManualDrugList() {
  const container = manualRefs.drugList;
  if (!container) return;
  container.innerHTML = "";
  const cards = loadMedicationCards();

  if (!cards.length) {
    const empty = document.createElement("p");
    empty.textContent = "등록된 약이 없습니다. Medication 페이지에서 추가해주세요.";
    empty.style.fontSize = "13px";
    empty.style.color = "#777";
    container.appendChild(empty);
    manualRefs.saveGroupBtn?.setAttribute("disabled", "true");
    manualRefs.applyGroupBtn?.setAttribute("disabled", "true");
    manualRefs.groupSelect?.setAttribute("disabled", "true");
    return;
  }

  manualRefs.saveGroupBtn?.removeAttribute("disabled");
  manualRefs.groupSelect?.removeAttribute("disabled");

  cards.forEach((card, index) => {
    const label = document.createElement("label");
    label.className = "manual-drug-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "manual-drug-checkbox";
    checkbox.id = `manual-drug-${index}`;
    checkbox.value = card.title;
    const text = document.createElement("span");
    text.textContent = card.title;
    const sub = document.createElement("small");
    sub.textContent = card.subtitle || "";
    sub.style.color = "#999";
    sub.style.fontSize = "12px";

    const textWrapper = document.createElement("div");
    textWrapper.style.display = "flex";
    textWrapper.style.flexDirection = "column";
    textWrapper.style.gap = "2px";
    textWrapper.appendChild(text);
    if (card.subtitle) textWrapper.appendChild(sub);

    label.appendChild(checkbox);
    label.appendChild(textWrapper);
    container.appendChild(label);
  });
}

function getSelectedDrugs() {
  return Array.from(document.querySelectorAll(".manual-drug-checkbox:checked")).map(
    (input) => input.value
  );
}

function handleManualSave() {
  const dateStr = manualRefs.dateInput?.value || selectedDateStr;
  const meds = getSelectedDrugs();
  if (!meds.length) return alert("복용한 약을 최소 1개 선택해주세요.");

  const status = manualRefs.statusSelect?.value || "success";
  const timeValue = manualRefs.timeInput?.value || getCurrentTime();
  const memo = manualRefs.memoInput?.value.trim() || "";

  const history = loadHistory();
  const entryId = (window.crypto?.randomUUID && window.crypto.randomUUID()) || `entry-${Date.now()}`;
  const newEntry = {
    id: entryId,
    meds,
    status,
    time: timeValue,
    condition: manualConditionValue,
    memo,
  };

  history[dateStr] = history[dateStr] || [];
  history[dateStr].push(newEntry);
  saveHistory(history);

  manualRefs.memoInput && (manualRefs.memoInput.value = "");
  manualRefs.timeInput && (manualRefs.timeInput.value = getCurrentTime());

  renderManualHistoryList(dateStr);
  refreshWeeklyDataset();
}

function renderManualHistoryList(dateStr) {
  const list = manualRefs.historyList;
  if (!list) return;
  list.innerHTML = "";
  const history = loadHistory();
  const entries = history[dateStr] || [];

  if (!entries.length) {
    const empty = document.createElement("li");
    empty.textContent = "기록이 없습니다.";
    empty.style.fontSize = "13px";
    empty.style.color = "#888";
    list.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "manual-history-item";

    const top = document.createElement("div");
    top.className = "manual-history-top";

    const meta = document.createElement("div");
    meta.className = "manual-history-meta";
    const pill = document.createElement("span");
    pill.className = "manual-history-pills";
    pill.textContent = entry.meds.join(", ");
    const time = document.createElement("span");
    time.textContent = `${entry.time || "--:--"}`;
    meta.appendChild(pill);
    meta.appendChild(time);

    const status = document.createElement("span");
    status.className = `weekly-history-status ${entry.status}`;
    status.textContent = STATUS_LABELS[entry.status] || STATUS_LABELS.success;

    top.appendChild(meta);
    top.appendChild(status);

    const detail = document.createElement("div");
    detail.className = "manual-history-detail";
    if (entry.condition) {
      const cond = document.createElement("span");
      cond.textContent = `컨디션 ${CONDITION_EMOJI[entry.condition] || ""} ${
        CONDITION_LABELS[entry.condition] || ""
      }`;
      detail.appendChild(cond);
    }
    if (entry.memo) {
      const memo = document.createElement("span");
      memo.textContent = entry.memo;
      detail.appendChild(memo);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "manual-history-delete";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => removeManualEntry(dateStr, entry.id));

    li.appendChild(top);
    if (detail.childNodes.length) li.appendChild(detail);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

function removeManualEntry(dateStr, entryId) {
  const history = loadHistory();
  history[dateStr] = (history[dateStr] || []).filter((entry) => entry.id !== entryId);
  saveHistory(history);
  renderManualHistoryList(dateStr);
  refreshWeeklyDataset();
}

function setCondition(btn) {
  const alreadySelected = btn.classList.contains("is-selected");
  document.querySelectorAll(".condition-emoji-btn").forEach((node) =>
    node.classList.remove("is-selected")
  );
  if (!alreadySelected) {
    btn.classList.add("is-selected");
    manualConditionValue = btn.dataset.value || "";
  } else {
    manualConditionValue = "";
  }
}

function renderGroupSelect() {
  const select = manualRefs.groupSelect;
  if (!select) return;
  const groups = loadGroups();
  select.innerHTML = '<option value="">그룹 선택</option>';
  if (manualRefs.applyGroupBtn) manualRefs.applyGroupBtn.disabled = true;
  if (!groups.length) {
    return;
  }
  groups.forEach((group, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = `${group.name} (${group.meds.length})`;
    select.appendChild(option);
  });
}

function handleGroupSave() {
  const meds = getSelectedDrugs();
  if (!meds.length) return alert("그룹으로 저장할 약을 선택해주세요.");
  const name = prompt("그룹 이름을 입력하세요", `그룹 ${new Date().toLocaleDateString()}`);
  if (!name) return;
  const groups = loadGroups();
  groups.push({ name, meds });
  saveGroups(groups);
  renderGroupSelect();
}

function handleGroupApply() {
  const select = manualRefs.groupSelect;
  if (!select || !select.value) return;
  const groups = loadGroups();
  const group = groups[Number(select.value)];
  if (!group) return;
  document.querySelectorAll(".manual-drug-checkbox").forEach((input) => {
    input.checked = group.meds.includes(input.value);
  });
}

function syncManualDate(dateStr) {
  if (manualRefs.dateInput) {
    manualRefs.dateInput.value = dateStr;
  }
  if (manualRefs.historyList) {
    renderManualHistoryList(dateStr);
  }
}
