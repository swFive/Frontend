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
  // 한국 시간대(Asia/Seoul, UTC+9)로 명시
  return `${dateStr}T${timeStr}:00`;
}

/**
 * 한국 시간대 오프셋을 포함한 ISO 형식 반환
 * 서버가 Asia/Seoul 시간대를 사용하므로 로컬 시간 그대로 전송
 */
function formatDateTimeForAPI(dateStr, timeStr) {
  // 서버가 Asia/Seoul 기준이므로, 로컬 시간을 그대로 보내도 됨
  // 단, 서버에서 UTC로 해석하는 경우를 대비해 시간대 명시
  const dateTime = new Date(`${dateStr}T${timeStr}:00`);
  
  // 로컬 시간대 오프셋 (분 단위, 한국은 -540)
  const offset = dateTime.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60));
  const offsetMinutes = Math.abs(offset % 60);
  const offsetSign = offset <= 0 ? '+' : '-';
  
  // ISO 8601 형식: 2025-11-27T15:00:00+09:00
  return `${dateStr}T${timeStr}:00${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
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
 * 캘린더 API를 통해 주간 복용 기록을 가져옴
 * GET /api/calendar?year={year}&month={month}
 * @param {Date} anchorDate - 기준 날짜
 * @returns {Object} { "2025-11-28": [...], ... }
 */
async function fetchCalendarLogs(anchorDate) {
  const calendarData = {};
  
  if (!window.MediAPI) {
    console.log("[Weekly] MediAPI not available");
    return calendarData;
  }
  
  try {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth() + 1;
    
    console.log(`[Weekly] Fetching calendar for ${year}-${month}`);
    const response = await MediAPI.getCalendar(year, month);
    console.log("[Weekly] Calendar response:", response);
    
    if (response && typeof response === 'object') {
      Object.assign(calendarData, response);
    }
    
    // 주간이 월 경계를 넘는 경우 다음/이전 달도 조회
    const weekDates = getWeekDates(anchorDate);
    const firstDate = weekDates[0];
    const lastDate = weekDates[6];
    
    if (firstDate.getMonth() !== anchorDate.getMonth()) {
      const prevMonth = firstDate.getMonth() + 1;
      const prevYear = firstDate.getFullYear();
      console.log(`[Weekly] Fetching previous month calendar: ${prevYear}-${prevMonth}`);
      const prevResponse = await MediAPI.getCalendar(prevYear, prevMonth);
      if (prevResponse && typeof prevResponse === 'object') {
        Object.assign(calendarData, prevResponse);
      }
    }
    
    if (lastDate.getMonth() !== anchorDate.getMonth()) {
      const nextMonth = lastDate.getMonth() + 1;
      const nextYear = lastDate.getFullYear();
      console.log(`[Weekly] Fetching next month calendar: ${nextYear}-${nextMonth}`);
      const nextResponse = await MediAPI.getCalendar(nextYear, nextMonth);
      if (nextResponse && typeof nextResponse === 'object') {
        Object.assign(calendarData, nextResponse);
      }
    }
  } catch (e) {
    console.error("[Weekly] Failed to fetch calendar:", e);
  }
  
  console.log("[Weekly] Final calendar data:", calendarData);
  return calendarData;
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
 * 캘린더 데이터를 사용하여 주간 데이터 생성
 * @param {Date} anchorDate
 * @param {Array} medications
 * @param {Object} calendarData - 캘린더 API 응답 { "2025-11-28": [...], ... }
 */
function buildWeeklyDataFromAPI(anchorDate, medications, calendarData = {}) {
  const dataset = createEmptyWeeklyData();
  const dates = getWeekDates(anchorDate);
  const missAggregator = {};
  const localHistory = loadHistory();
  
  // 오늘 날짜 (미래 날짜 필터링용)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = window.MediCommon.formatDate(today);
  
  console.log("[Weekly] buildWeeklyDataFromAPI - calendarData:", calendarData);

  dates.forEach((date, idx) => {
    const key = DAY_KEYS[idx];
    const dayStr = window.MediCommon.formatDate(date);
    
    // 미래 날짜는 건너뛰기
    if (dayStr > todayStr) {
      console.log(`[Weekly] ${dayStr}는 미래 날짜이므로 건너뜁니다.`);
      return;
    }
    
    const summary = { success: 0, miss: 0, late: 0 };
    const historyItems = [];

    // 1. 캘린더 API 데이터: 해당 날짜의 복용 기록 (표시용으로만 사용, summary에는 포함 안 함)
    const dayLogs = calendarData[dayStr] || [];
    console.log(`[Weekly] ${dayStr}: dayLogs =`, dayLogs);
    
    dayLogs.forEach(log => {
      // 로그의 날짜 확인 (recordTime 또는 date 필드)
      let logDateStr = null;
      if (log.recordTime) {
        logDateStr = log.recordTime.includes('T') 
          ? log.recordTime.split('T')[0] 
          : log.recordTime.substring(0, 10);
      } else if (log.date) {
        logDateStr = log.date;
      }
      
      // 로그의 날짜가 해당 날짜와 일치하지 않거나 미래 날짜면 건너뛰기
      if (logDateStr && (logDateStr !== dayStr || logDateStr > todayStr)) {
        console.log(`[Weekly] 로그 날짜 불일치 또는 미래 날짜: ${logDateStr} (예상: ${dayStr})`);
        return;
      }
      
      const apiStatus = log.status || log.intakeStatus;
      const status = STATUS_MAP_FROM_API[apiStatus] || "success";
      
      // SKIPPED는 표시하지 않음
      if (apiStatus === "SKIPPED") return;
      
      // journal이 있는 로그만 summary에 포함 (weekly report에서 추가한 기록)
      // journal 정보가 있으면 weekly report에서 추가한 것으로 간주
      const hasJournal = log.journalId || log.memo || log.conditionEmoji;
      if (hasJournal) {
        summary[status] = (summary[status] || 0) + 1;
        
        const medName = log.medicationName || log.name || "알 수 없음";
        
        if (status === "miss") {
          missAggregator[medName] = (missAggregator[medName] || 0) + 1;
        }
      }
      
      // 복용 시간 추출
      let intakeTime = "--:--";
      if (log.intakeTime) {
        intakeTime = log.intakeTime.substring(0, 5);
      }
      
      const medName = log.medicationName || log.name || "알 수 없음";
      
      historyItems.push({
        logId: log.logId,
        scheduleId: log.scheduleId,
        medicationId: log.medicationId,
        time: intakeTime,
        name: medName,
        status,
        condition: log.conditionEmoji || "",
        memo: log.memo || log.logMemo || "",
        source: "api"
      });
    });

    // 2. 로컬 저장소 데이터 추가 (weekly report에서 직접 추가한 기록)
    const localEntries = localHistory[dayStr] || [];
    localEntries.forEach((entry) => {
      const status = entry.status || "success";
      summary[status] = (summary[status] || 0) + 1;
      
      if (status === "miss") {
        (entry.meds || []).forEach((name) => {
          missAggregator[name] = (missAggregator[name] || 0) + 1;
        });
      }
      
      historyItems.push({
        id: entry.id,
        logId: entry.logIds?.[0] || null,
        time: entry.time || "--:--",
        name: (entry.meds || []).join(", "),
        status,
        condition: entry.condition || "",
        memo: entry.memo || "",
        source: "local"
      });
    });

    // 시간순 정렬
    historyItems.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    
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
  
  // 캘린더 API로 복용 기록 가져오기
  const calendarData = await fetchCalendarLogs(currentWeekAnchor);
  
  // 주간 데이터 빌드
  if (medicationsCache.length > 0) {
    weeklyData = buildWeeklyDataFromAPI(currentWeekAnchor, medicationsCache, calendarData);
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

  if (summaryContainerEl) {
    renderSummary(summaryContainerEl, weeklyData.summaryTop);
  }
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
  
  // active 클래스가 있는 날짜를 찾아서 선택
  const activeEl = weeklyDayEls.find((el) => el.classList.contains("active"));
  if (activeEl) {
    const activeKey = activeEl.dataset.day;
    selectDay(activeKey, activeEl);
  } else {
    // active가 없으면 첫 번째 날짜 선택
    const firstEl = weeklyDayEls[0];
    const firstKey = firstEl?.dataset.day || DAY_KEYS[0];
    selectDay(firstKey, firstEl);
  }
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

  // weekly report에서 직접 추가한 기록만 필터링 (로컬 히스토리 또는 journal이 있는 기록)
  const weeklyRecords = items.filter(item => {
    // 로컬 히스토리에서 추가한 기록 (source === "local")
    // 또는 memo나 condition이 있는 기록 (journal이 있는 기록)
    return item.source === "local" || item.memo || item.condition;
  });

  if (!weeklyRecords.length) {
    const empty = document.createElement("li");
    empty.textContent = "복용 기록이 없습니다.";
    empty.style.fontSize = "14px";
    empty.style.color = "#999";
    container.appendChild(empty);
    return;
  }

  weeklyRecords.forEach((item) => {
    const li = document.createElement("li");
    li.className = "weekly-history-item";
    if (item.logId) {
      li.dataset.logId = item.logId;
    }
    if (item.source === "local") {
      li.classList.add("from-local");
    }

    const left = document.createElement("div");
    left.className = "weekly-history-left";

    const time = document.createElement("span");
    time.className = "weekly-history-time";
    time.textContent = item.time || "--:--";

    const name = document.createElement("span");
    name.className = "weekly-history-pill-name";
    name.textContent = item.name || "알 수 없음";

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

    const rightGroup = document.createElement("div");
    rightGroup.className = "weekly-history-right";

    const status = document.createElement("span");
    status.className = `weekly-history-status ${item.status}`;
    status.textContent = STATUS_LABELS[item.status] || "복용";

    // 삭제 버튼
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "weekly-history-delete";
    deleteBtn.textContent = "×";
    deleteBtn.title = "삭제";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleHistoryDelete(item, dateLabel);
    });

    rightGroup.appendChild(status);
    rightGroup.appendChild(deleteBtn);

    li.appendChild(left);
    if (detail.childNodes.length) li.appendChild(detail);
    li.appendChild(rightGroup);
    container.appendChild(li);
  });
}

/**
 * 복용 기록 삭제 핸들러
 */
async function handleHistoryDelete(item, dateStr) {
  if (!confirm("이 복용 기록을 삭제하시겠습니까?")) return;

  let deleted = false;

  // API 로그 삭제
  if (item.logId) {
    deleted = await deleteIntakeRecord(item.logId);
  }

  // 로컬 저장소에서 삭제 (source가 local이거나 id가 있는 경우)
  if (item.source === "local" && item.id) {
    const history = loadHistory();
    if (history[dateStr]) {
      history[dateStr] = history[dateStr].filter((entry) => entry.id !== item.id);
      saveHistory(history);
      deleted = true;
    }
  }

  if (deleted) {
    showToastMessage("삭제되었습니다.", "info");
    await refreshWeeklyDataset();
  } else {
    showToastMessage("삭제에 실패했습니다.", "error");
  }
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
  
  // 캘린더 API로 복용 기록 가져오기
  const calendarData = await fetchCalendarLogs(currentWeekAnchor);
  
  if (medicationsCache.length > 0) {
    weeklyData = buildWeeklyDataFromAPI(currentWeekAnchor, medicationsCache, calendarData);
  } else {
    weeklyData = buildWeeklyDataFromLocal(currentWeekAnchor);
  }
  
  showLoading(false);
  
  refreshWeeklyDots();
  if (summaryContainerEl) {
    renderSummary(summaryContainerEl, weeklyData.summaryTop);
  }
  
  // active 클래스가 있는 날짜를 찾아서 선택 (없으면 첫 번째 날짜)
  const activeEl = weeklyDayEls.find((el) => el.classList.contains("active"));
  if (activeEl) {
    const activeKey = activeEl.dataset.day;
    selectDay(activeKey, activeEl);
  } else {
    const firstEl = weeklyDayEls[0];
    const firstKey = firstEl?.dataset.day || DAY_KEYS[0];
    selectDay(firstKey, firstEl);
  }
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
    memoInput: document.getElementById("manualMemoInput"),
    addBtn: document.getElementById("manualAddRecordBtn"),
    drugList: document.getElementById("manualDrugList"),
    groupSelect: document.getElementById("manualGroupSelect"),
    applyGroupBtn: document.getElementById("manualApplyGroupBtn"),
    saveGroupBtn: document.getElementById("manualSaveGroupBtn"),
  };

  if (!manualRefs.dateInput || !manualRefs.drugList) return;

  manualRefs.dateInput.value = selectedDateStr;

  await renderManualDrugList();
  renderGroupSelect();

  manualRefs.addBtn?.addEventListener("click", handleManualSave);
  manualRefs.saveGroupBtn?.addEventListener("click", handleGroupSave);
  manualRefs.applyGroupBtn?.addEventListener("click", handleGroupApply);
  manualRefs.groupSelect?.addEventListener("change", () => {
    if (manualRefs.applyGroupBtn) {
      manualRefs.applyGroupBtn.disabled = !manualRefs.groupSelect.value;
    }
  });
  
  // 날짜 입력 필드 변경 시 해당 날짜의 복용 약 목록 다시 렌더링
  manualRefs.dateInput?.addEventListener("change", async () => {
    await renderManualDrugList();
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
 * 선택된 날짜의 요일이 약의 복용 요일에 포함되는지 확인
 */
function isScheduledForDate(frequency, targetDate) {
  const dayMap = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
  const reverseDayMap = ["일", "월", "화", "수", "목", "금", "토"];
  
  const date = new Date(targetDate);
  const dayOfWeek = date.getDay(); // 0 = 일요일
  const targetDayKor = reverseDayMap[dayOfWeek];
  
  // frequency가 "매일"이면 모든 요일 해당
  if (frequency === "매일" || frequency === "월,화,수,목,금,토,일") {
    return true;
  }
  
  // frequency에서 요일 체크 (예: "월,수,금")
  const days = frequency.split(",").map(d => d.trim());
  return days.includes(targetDayKor);
}

/**
 * 약 목록 렌더링 (그날 복용하는 약 + medication management에서 복용 완료한 약만 표시)
 */
async function renderManualDrugList() {
  const container = manualRefs.drugList;
  if (!container) return;
  container.innerHTML = "";
  
  // 선택된 날짜 가져오기
  const targetDate = manualRefs.dateInput?.value || selectedDateStr;
  
  // 등록된 약 목록 가져오기
  if (medicationsCache.length === 0) {
    await fetchMedications();
  }
  
  // 캘린더 API로 해당 날짜의 복용 기록 가져오기
  let calendarData = {};
  try {
    const date = new Date(targetDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (window.MediAPI) {
      calendarData = await MediAPI.getCalendar(year, month) || {};
    }
  } catch (e) {
    console.error("[Weekly] Failed to fetch calendar for drug list:", e);
  }
  
  // 해당 날짜의 복용 기록 (TAKEN, LATE만)
  const dayLogs = (calendarData[targetDate] || []).filter(log => {
    const status = log.status || log.intakeStatus;
    return status === "TAKEN" || status === "LATE";
  });
  
  // 약 ID별로 복용 기록 그룹화 (약 이름, 시간, logId 등)
  const completedLogsByMedId = {};
  dayLogs.forEach(log => {
    const medId = log.medicationId;
    if (!completedLogsByMedId[medId]) {
      completedLogsByMedId[medId] = [];
    }
    completedLogsByMedId[medId].push({
      logId: log.logId,
      scheduleId: log.scheduleId,
      intakeTime: log.intakeTime ? log.intakeTime.substring(0, 5) : null,
      medicationName: log.medicationName || log.name
    });
  });
  
  // 조건에 맞는 약 필터링
  const eligibleMeds = medicationsCache.filter(med => {
    // 1. 해당 날짜에 복용 스케줄이 있는지 확인
    const schedules = med.schedulesWithLogs || med.schedules || [];
    if (schedules.length === 0) return false;
    
    // 선택된 날짜에 스케줄이 있는지 확인
    let hasScheduleForDate = false;
    for (const schedule of schedules) {
      const frequency = schedule.frequency || "";
      const startDate = schedule.startDate;
      const endDate = schedule.endDate;
      
      // 날짜 범위 확인
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = window.MediCommon.formatDate(today);
      
      if (startDate && targetDate < startDate) continue;
      if (endDate && targetDate > endDate) continue;
      if (targetDate > todayStr) continue; // 미래 날짜 제외
      
      // 요일 확인
      if (isScheduledForDate(frequency, targetDate)) {
        hasScheduleForDate = true;
        break;
      }
    }
    
    if (!hasScheduleForDate) return false;
    
    // 2. medication management에서 복용 완료한 약인지 확인
    const medId = med.medicationId;
    return completedLogsByMedId[medId] && completedLogsByMedId[medId].length > 0;
  });
  
  if (eligibleMeds.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = `${targetDate}에 복용 완료한 약이 없습니다.`;
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

  // 조건에 맞는 약 목록 표시
  eligibleMeds.forEach((med, index) => {
    const label = document.createElement("label");
    label.className = "manual-drug-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "manual-drug-checkbox";
    checkbox.id = `manual-drug-${index}`;
    checkbox.value = med.name;
    checkbox.dataset.medicationId = med.medicationId;
    
    // 해당 약의 복용 기록 정보 사용 (첫 번째 기록)
    const medLogs = completedLogsByMedId[med.medicationId] || [];
    if (medLogs.length > 0) {
      const firstLog = medLogs[0];
      if (firstLog.scheduleId) {
        checkbox.dataset.scheduleId = firstLog.scheduleId;
      }
      if (firstLog.logId) {
        checkbox.dataset.logId = firstLog.logId;
      }
      if (firstLog.intakeTime) {
        checkbox.dataset.intakeTime = firstLog.intakeTime;
      }
    }
    
    const text = document.createElement("span");
    text.textContent = med.name;
    
    const sub = document.createElement("small");
    sub.textContent = `${med.category || "기타"} ✓ 복용완료`;
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
      intakeTime: input.dataset.intakeTime || null,
    })
  );
}

/**
 * 복용 일지 저장 (복용 완료된 약에 대해 컨디션/메모 추가)
 */
async function handleManualSave() {
  // 선택된 날짜 사용 (active 클래스가 있는 날짜)
  const dateStr = selectedDateStr;
  const selectedDrugs = getSelectedDrugs();
  
  if (!selectedDrugs.length) {
    return alert("약을 최소 1개 선택해주세요.");
  }

  // 복용 상태는 항상 "success" (복용 완료된 약만 선택 가능하므로)
  const status = "success";
  
  // 선택된 약들의 실제 복용 시간 사용 (medication management에서 복용한 시간)
  // 여러 약이 선택된 경우 첫 번째 약의 시간 사용
  const timeValue = selectedDrugs[0]?.intakeTime || getCurrentTime();
  const memo = manualRefs.memoInput?.value.trim() || "";
  const recordTime = formatDateTimeForAPI(dateStr, timeValue);
  
  // 버튼 비활성화
  if (manualRefs.addBtn) {
    manualRefs.addBtn.disabled = true;
    manualRefs.addBtn.textContent = "저장 중...";
  }

  // 선택된 약들에 대해 복용 로그 생성 또는 기존 logId 수집
  const logIds = [];
  let hasApiSuccess = false;
  
  for (const drug of selectedDrugs) {
    if (drug.logId) {
      // 기존 logId가 있으면 사용
      logIds.push(drug.logId);
    } else if (drug.scheduleId && window.MediAPI) {
      // logId가 없으면 새로운 복용 로그 생성
      const apiStatus = STATUS_MAP_TO_API[status] || "TAKEN";
      const newLog = await window.MediAPI.createIntakeLog(
        parseInt(drug.scheduleId),
        apiStatus,
        recordTime
      );
      if (newLog && newLog.logId) {
        logIds.push(newLog.logId);
      }
    }
  }
  
  // 일지(컨디션/메모) 저장 - 생성된 복용 기록에 연결
  if (logIds.length > 0 && (manualConditionValue || memo)) {
    const conditionEmoji = CONDITION_EMOJI[manualConditionValue] || "";
    const result = await createJournalRecord(logIds, recordTime, conditionEmoji, memo);
    if (result) {
      hasApiSuccess = true;
    }
  } else if (logIds.length > 0) {
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
    logIds: logIds,
    apiSynced: hasApiSuccess,
  };

  history[dateStr] = history[dateStr] || [];
  history[dateStr].push(newEntry);
  saveHistory(history);

  // UI 리셋
  manualRefs.memoInput && (manualRefs.memoInput.value = "");
  
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
  await refreshWeeklyDataset();
  
  // 성공 메시지
  if (hasApiSuccess) {
    showToastMessage("복용 일지가 저장되었습니다.", "success");
  } else {
    showToastMessage("로컬에 저장되었습니다. (서버 동기화 실패)", "info");
  }
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

async function syncManualDate(dateStr) {
  if (manualRefs.dateInput) {
    manualRefs.dateInput.value = dateStr;
  }
  // 날짜가 변경되면 해당 날짜에 복용한 약 목록도 다시 렌더링
  await renderManualDrugList();
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
