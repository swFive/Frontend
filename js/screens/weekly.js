// ==================================================
// 🗓️ 복용 이력 & 증상 관리 - 주간 리포트 (API 연동)
// ==================================================

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const HISTORY_STORAGE_KEY = "manualIntakeHistory";
const GROUP_STORAGE_KEY = "manualIntakeGroups";

const STATUS_LABELS = { success: "복용", miss: "미복용", late: "지각" };
const STATUS_MAP_TO_API = { success: "TAKEN", miss: "SKIPPED", late: "LATE" };
const STATUS_MAP_FROM_API = { TAKEN: "success", SKIPPED: "miss", LATE: "late" };
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
let selectedDateStr = window.MediCommon?.formatDate
  ? window.MediCommon.formatDate(new Date())
  : new Date().toISOString().split("T")[0];
let manualConditionValue = "";
let manualRefs = {};

// 약 목록 캐시 (API에서 불러온 데이터)
let medicationsCache = [];

// 로딩 상태
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  initWeeklyPage();
  initManualUi();
});

// ==================================================
// 🔹 날짜 관련 헬퍼
// ==================================================
function getWeekLabel(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = String(month + 1).padStart(2, "0");
  const firstDay = new Date(year, month, 1);
  const adjustedDate = date.getDate() + firstDay.getDay();
  const weekNumber = Math.ceil(adjustedDate / 7);
  return `${year}년 ${monthLabel}월 ${weekNumber}주차`;
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const adjustedDate = date.getDate() + firstDay.getDay();
  return Math.ceil(adjustedDate / 7);
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

function formatDateTimeISO(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  return `${dateStr}T${timeStr}:00`;
}

// ==================================================
// 🔹 Storage helpers (폴백용 로컬 저장소)
// ==================================================
const loadHistory = () => JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "{}");
const saveHistory = (data) => localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data));
const loadGroups = () => JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || "[]");
const saveGroups = (groups) => localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));

// ==================================================
// 🔹 API 호출 함수들
// ==================================================

/**
 * 약 목록 조회 (API)
 */
async function fetchMedications() {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded, using empty list");
    return [];
  }
  
  try {
    const data = await MediAPI.getMedicines();
    medicationsCache = data || [];
    return medicationsCache;
  } catch (error) {
    console.error("[Weekly] Failed to fetch medications:", error);
    return [];
  }
}

/**
 * 캘린더 데이터 조회 (API)
 * @param {number} year
 * @param {number} month
 */
async function fetchCalendarData(year, month) {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded");
    return null;
  }
  
  try {
    const data = await MediAPI.getCalendar(year, month);
    return data;
  } catch (error) {
    console.error("[Weekly] Failed to fetch calendar:", error);
    return null;
  }
}

/**
 * 통계 데이터 조회 (API)
 * @param {number} year
 * @param {number} month
 * @param {number} week
 */
async function fetchWeeklyStatistics(year, month, week) {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded");
    return null;
  }
  
  try {
    const data = await MediAPI.getFixedStatistics(year, month, week);
    return data;
  } catch (error) {
    console.error("[Weekly] Failed to fetch statistics:", error);
    return null;
  }
}

/**
 * 복용 기록 생성 (API)
 * @param {number} scheduleId
 * @param {string} status - success | miss | late
 * @param {string} recordTime - ISO 8601 형식
 */
async function createIntakeRecord(scheduleId, status, recordTime) {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded");
    return null;
  }
  
  const apiStatus = STATUS_MAP_TO_API[status] || "TAKEN";
  
  try {
    const result = await MediAPI.createIntakeLog(scheduleId, apiStatus, recordTime);
    return result;
  } catch (error) {
    console.error("[Weekly] Failed to create intake log:", error);
    return null;
  }
}

/**
 * 복용 일지 생성 (API)
 * @param {Array<number>} logIds
 * @param {string} journalTime
 * @param {string} conditionEmoji
 * @param {string} memo
 */
async function createJournalRecord(logIds, journalTime, conditionEmoji, memo) {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded");
    return null;
  }
  
  try {
    const result = await MediAPI.createJournal(logIds, journalTime, conditionEmoji, memo);
    return result;
  } catch (error) {
    console.error("[Weekly] Failed to create journal:", error);
    return null;
  }
}

/**
 * 복용 기록 삭제 (API)
 * @param {number} logId
 */
async function deleteIntakeRecord(logId) {
  if (!window.MediAPI) {
    console.warn("[Weekly] MediAPI not loaded");
    return false;
  }
  
  try {
    return await MediAPI.deleteIntakeLog(logId);
  } catch (error) {
    console.error("[Weekly] Failed to delete intake log:", error);
    return false;
  }
}

// ==================================================
// 🔹 Weekly dataset builder
// ==================================================

/**
 * 약 목록에서 스케줄 정보 및 로그 추출하여 주간 데이터 생성
 * @param {Date} anchorDate
 * @param {Array} medications
 */
function buildWeeklyDataFromAPI(anchorDate, medications) {
  const dataset = createEmptyWeeklyData();
  const dates = getWeekDates(anchorDate);
  const missAggregator = {};

  dates.forEach((date, idx) => {
    const key = DAY_KEYS[idx];
    const dayStr = window.MediCommon.formatDate(date);
    const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    
    const summary = { success: 0, miss: 0, late: 0 };
    const historyItems = [];

    // 각 약의 스케줄과 로그 확인
    medications.forEach((med) => {
      const schedules = med.schedulesWithLogs || [];
      
      schedules.forEach((schedule) => {
        // 스케줄 날짜 범위 확인
        const startDate = schedule.startDate ? new Date(schedule.startDate) : null;
        const endDate = schedule.endDate ? new Date(schedule.endDate) : null;
        
        if (startDate && date < startDate) return;
        if (endDate && date > endDate) return;
        
        // 요일 매칭 확인
        const frequency = schedule.frequency || "매일";
        if (frequency !== "매일" && !frequency.includes(dayOfWeek)) return;
        
        // 해당 날짜의 로그 확인
        const recordTime = schedule.recordTime;
        let logDate = null;
        
        if (recordTime) {
          // recordTime이 ISO 형식일 경우 날짜 추출
          if (recordTime.includes("T")) {
            logDate = recordTime.split("T")[0];
          } else {
            // 시간만 있는 경우, 오늘 날짜와 비교 필요
            logDate = dayStr;
          }
        }
        
        // 로그가 해당 날짜에 있는 경우
        if (schedule.logId && logDate === dayStr) {
          const apiStatus = schedule.intakeStatus;
          const status = STATUS_MAP_FROM_API[apiStatus] || "success";
          
          summary[status] = (summary[status] || 0) + 1;
          
          if (status === "miss") {
            missAggregator[med.name] = (missAggregator[med.name] || 0) + 1;
          }
          
          historyItems.push({
            logId: schedule.logId,
            scheduleId: schedule.scheduleId,
            medicationId: med.medicationId,
            time: schedule.intakeTime ? schedule.intakeTime.substring(0, 5) : "--:--",
            name: med.name,
            status,
            condition: "",
            memo: med.memo || "",
          });
        }
      });
    });

    // 시간순 정렬
    historyItems.sort((a, b) => a.time.localeCompare(b.time));
    
    dataset.dayMetrics[key] = { summary, history: historyItems };
  });

  // 미복용 상위 5개
  dataset.summaryTop = Object.entries(missAggregator)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return dataset;
}

/**
 * 로컬 히스토리 기반 주간 데이터 생성 (폴백)
 * @param {Date} anchorDate
 */
function buildWeeklyDataFromLocal(anchorDate) {
  const dataset = createEmptyWeeklyData();
  const history = loadHistory();
  const dates = getWeekDates(anchorDate);
  const missAggregator = {};

  dates.forEach((date, idx) => {
    const key = DAY_KEYS[idx];
    const dayStr = window.MediCommon.formatDate(date);
    const entries = history[dayStr] || [];
    const summary = { success: 0, miss: 0, late: 0 };

    const historyItems = entries.map((entry) => {
      const status = entry.status || "success";
      summary[status] = (summary[status] || 0) + 1;
      if (status === "miss") {
        (entry.meds || []).forEach((name) => {
          missAggregator[name] = (missAggregator[name] || 0) + 1;
        });
      }

      return {
        id: entry.id,
        logId: entry.logId || null,
        time: entry.time || "--:--",
        name: (entry.meds || []).join(", "),
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
async function initWeeklyPage() {
  const periodLabel = document.querySelector(".weekly-period-label");
  weeklyDayEls = Array.from(document.querySelectorAll(".weekly-day"));
  historyListEl = document.querySelector(".weekly-history-list");
  selectedDateLabelEl = document.querySelector(".weekly-selected-date");
  summaryContainerEl = document.querySelector(".weekly-summary-bars");

  if (!periodLabel || !weeklyDayEls.length || !historyListEl || !selectedDateLabelEl) return;

  // 주간 이동 버튼 이벤트
  document.querySelectorAll(".weekly-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleWeekNav(btn.dataset.dir));
  });

  currentWeekAnchor.setHours(0, 0, 0, 0);
  weekDates = getWeekDates(currentWeekAnchor);
  
  // 약 목록 먼저 로드
  showLoading(true);
  await fetchMedications();
  
  // 주간 데이터 빌드
  if (medicationsCache.length > 0) {
    weeklyData = buildWeeklyDataFromAPI(currentWeekAnchor, medicationsCache);
  } else {
    weeklyData = buildWeeklyDataFromLocal(currentWeekAnchor);
  }
  
  showLoading(false);
  
  periodLabel.textContent = getWeekLabel(currentWeekAnchor);

  weeklyDayEls.forEach((dayEl, index) => {
    const key = dayEl.dataset.day || DAY_KEYS[index] || "sun";
    const idx = DAY_KEYS.indexOf(key);
    const dateObj = weekDates[idx >= 0 ? idx : index];
    dayEl.dataset.day = key;
    dayEl.dataset.fullDate = window.MediCommon.formatDate(dateObj);

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

/**
 * 주간 이동 핸들러
 * @param {string} direction - prev | next
 */
async function handleWeekNav(direction) {
  const offset = direction === "prev" ? -7 : 7;
  currentWeekAnchor.setDate(currentWeekAnchor.getDate() + offset);
  
  await refreshWeeklyDataset();
  
  const periodLabel = document.querySelector(".weekly-period-label");
  if (periodLabel) {
    periodLabel.textContent = getWeekLabel(currentWeekAnchor);
  }
  
  // 날짜 업데이트
  weekDates = getWeekDates(currentWeekAnchor);
  weeklyDayEls.forEach((dayEl, index) => {
    const key = dayEl.dataset.day || DAY_KEYS[index];
    const idx = DAY_KEYS.indexOf(key);
    const dateObj = weekDates[idx >= 0 ? idx : index];
    dayEl.dataset.fullDate = window.MediCommon.formatDate(dateObj);
    
    const dateEl = dayEl.querySelector(".weekly-day-date");
    if (dateEl) dateEl.textContent = dateObj.getDate();
  });
}

function selectDay(dayKey, dayElement) {
  const idx = DAY_KEYS.indexOf(dayKey);
  const dateObj = weekDates[idx >= 0 ? idx : 0];
  selectedDayKey = dayKey;
  selectedDateStr = window.MediCommon.formatDate(dateObj);

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
    if (item.logId) {
      li.dataset.logId = item.logId;
    }

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

async function refreshWeeklyDataset() {
  showLoading(true);
  
  await fetchMedications();
  
  if (medicationsCache.length > 0) {
    weeklyData = buildWeeklyDataFromAPI(currentWeekAnchor, medicationsCache);
  } else {
    weeklyData = buildWeeklyDataFromLocal(currentWeekAnchor);
  }
  
  showLoading(false);
  
  refreshWeeklyDots();
  renderSummary(summaryContainerEl, weeklyData.summaryTop);
  const selectedEl = weeklyDayEls.find((el) => el.dataset.day === selectedDayKey);
  selectDay(selectedDayKey, selectedEl || weeklyDayEls[0]);
}

function showLoading(show) {
  isLoading = show;
  // 로딩 인디케이터 (필요시 구현)
  const container = document.querySelector(".weekly-history-list");
  if (show && container) {
    container.innerHTML = '<li style="color:#999;font-size:14px;">데이터를 불러오는 중...</li>';
  }
}

// ==================================================
// 🔹 Manual intake UI
// ==================================================
async function initManualUi() {
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

  // 날짜 변경 시 히스토리 리스트 갱신
  manualRefs.dateInput.addEventListener("change", () => {
    const newDate = manualRefs.dateInput.value;
    if (newDate) {
      renderManualHistoryList(newDate);
    }
  });

  await renderManualDrugList();
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

/**
 * 약이 오늘 복용 완료 상태인지 확인
 * @param {Object} med - 약 정보
 * @returns {boolean}
 */
function isMedicationCompleted(med) {
  const schedules = med.schedulesWithLogs || [];
  
  if (schedules.length === 0) return false;
  
  // 오늘 스케줄 중 복용 완료된 개수 계산
  let takenCount = 0;
  let totalSchedules = 0;
  
  // 시간 목록 (중복 제거)
  const times = [...new Set(
    schedules
      .map(s => s.intakeTime ? s.intakeTime.substring(0, 5) : "")
      .filter(t => t)
  )];
  
  totalSchedules = times.length;
  
  for (const s of schedules) {
    if (s.logId && (s.intakeStatus === "TAKEN" || s.intakeStatus === "LATE")) {
      takenCount++;
    }
  }
  
  // 모든 스케줄 복용 완료 시 true
  return totalSchedules > 0 && takenCount >= totalSchedules;
}

/**
 * 약 목록 렌더링 (복용 완료된 약만 표시)
 */
async function renderManualDrugList() {
  const container = manualRefs.drugList;
  if (!container) return;
  container.innerHTML = "";
  
  // API에서 약 목록 가져오기
  let medications = medicationsCache;
  if (!medications.length) {
    medications = await fetchMedications();
  }

  // 복용 완료된 약만 필터링
  const completedMedications = medications.filter(isMedicationCompleted);

  if (!medications.length) {
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

  if (!completedMedications.length) {
    const empty = document.createElement("p");
    empty.textContent = "복용 완료된 약이 없습니다. Medication 페이지에서 복용 처리 후 이용해주세요.";
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

  completedMedications.forEach((med, index) => {
    const label = document.createElement("label");
    label.className = "manual-drug-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "manual-drug-checkbox";
    checkbox.id = `manual-drug-${index}`;
    checkbox.value = med.name;
    checkbox.dataset.medicationId = med.medicationId;
    
    // 스케줄 정보 저장 (복용 완료된 스케줄의 logId 사용)
    const schedules = med.schedulesWithLogs || [];
    const completedSchedule = schedules.find((s) => s.logId && (s.intakeStatus === "TAKEN" || s.intakeStatus === "LATE"));
    if (completedSchedule) {
      checkbox.dataset.scheduleId = completedSchedule.scheduleId;
      checkbox.dataset.logId = completedSchedule.logId;
    }
    
    const text = document.createElement("span");
    text.textContent = med.name;
    
    const sub = document.createElement("small");
    sub.textContent = `${med.category || ""} ✓ 복용완료`;
    sub.style.color = "#30c85a";
    sub.style.fontSize = "12px";

    const textWrapper = document.createElement("div");
    textWrapper.style.display = "flex";
    textWrapper.style.flexDirection = "column";
    textWrapper.style.gap = "2px";
    textWrapper.appendChild(text);
    textWrapper.appendChild(sub);

    label.appendChild(checkbox);
    label.appendChild(textWrapper);
    container.appendChild(label);
  });
}

function getSelectedDrugs() {
  return Array.from(document.querySelectorAll(".manual-drug-checkbox:checked")).map(
    (input) => ({
      name: input.value,
      medicationId: input.dataset.medicationId,
      scheduleId: input.dataset.scheduleId,
      logId: input.dataset.logId ? parseInt(input.dataset.logId) : null,
    })
  );
}

/**
 * 복용 일지 저장 (복용 완료된 약에 대해 컨디션/메모 추가)
 */
async function handleManualSave() {
  const dateStr = manualRefs.dateInput?.value || selectedDateStr;
  const selectedDrugs = getSelectedDrugs();
  
  if (!selectedDrugs.length) {
    return alert("약을 최소 1개 선택해주세요.");
  }

  const status = manualRefs.statusSelect?.value || "success";
  const timeValue = manualRefs.timeInput?.value || getCurrentTime();
  const memo = manualRefs.memoInput?.value.trim() || "";
  const recordTime = formatDateTimeISO(dateStr, timeValue);
  
  // 버튼 비활성화
  if (manualRefs.addBtn) {
    manualRefs.addBtn.disabled = true;
    manualRefs.addBtn.textContent = "저장 중...";
  }

  // 복용 완료된 약들의 logId 수집
  const existingLogIds = selectedDrugs
    .filter((d) => d.logId)
    .map((d) => d.logId);
  
  let hasApiSuccess = false;

  // 일지(컨디션/메모) 저장 - 기존 복용 기록에 연결
  if (existingLogIds.length > 0 && (manualConditionValue || memo)) {
    const conditionEmoji = CONDITION_EMOJI[manualConditionValue] || "";
    const result = await createJournalRecord(existingLogIds, recordTime, conditionEmoji, memo);
    if (result) {
      hasApiSuccess = true;
    }
  } else if (existingLogIds.length > 0) {
    // 컨디션/메모 없이도 성공으로 처리
    hasApiSuccess = true;
  }

  // 로컬 히스토리에도 저장 (폴백 및 UI 표시용)
  const history = loadHistory();
  const entryId = window.crypto?.randomUUID?.() || `entry-${Date.now()}`;
  const newEntry = {
    id: entryId,
    meds: selectedDrugs.map((d) => d.name),
    status,
    time: timeValue,
    condition: manualConditionValue,
    memo,
    logIds: existingLogIds,
    apiSynced: hasApiSuccess,
  };

  history[dateStr] = history[dateStr] || [];
  history[dateStr].push(newEntry);
  saveHistory(history);

  // UI 리셋
  manualRefs.memoInput && (manualRefs.memoInput.value = "");
  manualRefs.timeInput && (manualRefs.timeInput.value = getCurrentTime());
  
  // 체크박스 해제
  document.querySelectorAll(".manual-drug-checkbox:checked").forEach((cb) => {
    cb.checked = false;
  });
  
  // 컨디션 리셋
  document.querySelectorAll(".condition-emoji-btn").forEach((btn) => {
    btn.classList.remove("is-selected");
  });
  manualConditionValue = "";

  // 버튼 복원
  if (manualRefs.addBtn) {
    manualRefs.addBtn.disabled = false;
    manualRefs.addBtn.textContent = "복용 기록 추가";
  }

  // UI 갱신
  renderManualHistoryList(dateStr);
  await refreshWeeklyDataset();
  
  // 성공 메시지
  if (hasApiSuccess) {
    showToastMessage("복용 일지가 저장되었습니다.", "success");
  } else {
    showToastMessage("로컬에 저장되었습니다. (서버 동기화 실패)", "info");
  }
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
    if (entry.apiSynced) {
      li.classList.add("api-synced");
    }

    const top = document.createElement("div");
    top.className = "manual-history-top";

    const meta = document.createElement("div");
    meta.className = "manual-history-meta";
    const pill = document.createElement("span");
    pill.className = "manual-history-pills";
    pill.textContent = (entry.meds || []).join(", ");
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
    deleteBtn.addEventListener("click", () => removeManualEntry(dateStr, entry.id, entry.logIds));

    li.appendChild(top);
    if (detail.childNodes.length) li.appendChild(detail);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

/**
 * 기록 삭제 (API 연동)
 */
async function removeManualEntry(dateStr, entryId, logIds) {
  if (!confirm("이 기록을 삭제하시겠습니까?")) return;
  
  // API에서 로그 삭제
  if (logIds && logIds.length > 0) {
    for (const logId of logIds) {
      await deleteIntakeRecord(logId);
    }
  }
  
  // 로컬 히스토리에서 삭제
  const history = loadHistory();
  history[dateStr] = (history[dateStr] || []).filter((entry) => entry.id !== entryId);
  saveHistory(history);
  
  renderManualHistoryList(dateStr);
  await refreshWeeklyDataset();
  
  showToastMessage("기록이 삭제되었습니다.", "info");
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
  const selectedDrugs = getSelectedDrugs();
  if (!selectedDrugs.length) return alert("그룹으로 저장할 약을 선택해주세요.");
  const name = prompt("그룹 이름을 입력하세요", `그룹 ${new Date().toLocaleDateString()}`);
  if (!name) return;
  const groups = loadGroups();
  groups.push({ name, meds: selectedDrugs.map((d) => d.name) });
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

/**
 * 토스트 메시지 표시 (있으면 사용)
 */
function showToastMessage(message, type = "success") {
  if (window.showToast && typeof window.showToast === "function") {
    window.showToast(message, { type, duration: 2500 });
  } else {
    console.log(`[Toast] ${type}: ${message}`);
  }
}
