// ==================================================
// 🗓️ 주간 복용 기록 페이지 JS
// ==================================================

// ----------------------------
// 🔹 요일 키 배열 (sun~sat)
// ----------------------------
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// ----------------------------
// 🔹 샘플/모킹 데이터 (weekly)
// ----------------------------
const mockWeeklyData = {
  // 요일별 복용 데이터
  dayMetrics: {
    sun: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    mon: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    tue: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    wed: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    thu: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    fri: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    sat: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
  },
  // 상위 통계용 summaryTop (예: 미복용 TOP)
  summaryTop: [],
};

// ==================================================
// 🔹 날짜 포맷 변환: "YYYY-MM-DD"
// ==================================================
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ==================================================
// 🔹 주차 라벨 계산: "YYYY년 MM월 n주차"
// ==================================================
const getWeekLabel = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = String(month + 1).padStart(2, "0");

  // 해당 월 1일
  const firstDay = new Date(year, month, 1);

  // 현재 날짜 + 1일 기준 요일
  const adjustedDate = date.getDate() + firstDay.getDay();

  // 주차 계산 (1~5주차)
  const weekNumber = Math.ceil(adjustedDate / 7);

  return `${year}년 ${monthLabel}월 ${weekNumber}주차`;
};

// ==================================================
// 🔹 해당 주 일별 Date 객체 배열 반환
// ==================================================
const getWeekDates = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  // 주 시작: 일요일 기준
  start.setDate(start.getDate() - start.getDay());

  // DAY_KEYS 순서대로 날짜 배열 반환
  return DAY_KEYS.map((_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
};

// ==================================================
// 🔹 특정 요일(key) metrics 가져오기
// ==================================================
const getDayMetrics = (key) => {
  const fallback = { summary: { success: 0, miss: 0, late: 0 }, history: [] };
  const data = mockWeeklyData.dayMetrics[key];
  if (!data) return fallback;

  // summary와 history 안전하게 반환
  return {
    summary: Object.assign({ success: 0, miss: 0, late: 0 }, data.summary || {}),
    history: Array.isArray(data.history) ? data.history : [],
  };
};

// ==================================================
// 🔹 페이지 초기화 함수
// ==================================================
function initWeeklyPage() {
  // 🔹 DOM 요소
  const periodLabel = document.querySelector(".weekly-period-label"); // 주차 표시
  const weeklyDays = Array.from(document.querySelectorAll(".weekly-day")); // 요일 버튼/박스
  const selectedDateLabel = document.querySelector(".weekly-selected-date"); // 선택된 날짜 표시
  const historyList = document.querySelector(".weekly-history-list"); // 기록 리스트
  const summaryContainer = document.querySelector(".weekly-summary-bars"); // summary 막대

  if (!periodLabel || !historyList || !selectedDateLabel || !weeklyDays.length) return;

  const today = new Date();
  const weekDates = getWeekDates(today);

  // 🔹 주차 라벨 설정
  periodLabel.textContent = getWeekLabel(today);

  // ----------------------------
  // 🔹 요일 선택 및 클릭 이벤트
  // ----------------------------
  const selectDay = (targetDay, dayKey, dateObj) => {
    // 모든 요일 active 해제
    weeklyDays.forEach((d) => d.classList.remove("active"));
    if (targetDay) targetDay.classList.add("active");

    // 선택 요일 metrics 가져오기
    const metrics = getDayMetrics(dayKey);

    // 해당 요일 기록 렌더
    renderHistory(metrics.history, historyList, selectedDateLabel, formatDate(dateObj));
  };

  // ----------------------------
  // 🔹 각 요일 DOM 세팅
  // ----------------------------
  weeklyDays.forEach((day, index) => {
    const key = day.dataset.day || DAY_KEYS[index] || "sun";
    const dayIndex = DAY_KEYS.indexOf(key);
    const dateObj = weekDates[dayIndex >= 0 ? dayIndex : index];
    if (!dateObj) return;

    // 데이터 속성 설정
    day.dataset.day = key;
    day.dataset.fullDate = formatDate(dateObj);

    // 날짜 텍스트
    const dateEl = day.querySelector(".weekly-day-date");
    if (dateEl) dateEl.textContent = dateObj.getDate();

    // 해당 요일 metrics
    const metrics = getDayMetrics(key);

    // 기존 dot 제거
    const existingDots = day.querySelector(".weekly-day-dots");
    if (existingDots) existingDots.remove();

    // 복용 성공/미복용/지각 점 표시
    const dots = document.createElement("div");
    dots.className = "weekly-day-dots";

    ["success", "miss", "late"].forEach((type) => {
      if ((metrics.summary[type] || 0) > 0) {
        const dot = document.createElement("span");
        dot.className = `weekly-day-dot ${type}`;
        dots.appendChild(dot);
      }
    });

    day.appendChild(dots);

    // 클릭 시 해당 요일 선택
    day.addEventListener("click", () => {
      selectDay(day, key, dateObj);
    });
  });

  // ----------------------------
  // 🔹 기본 선택: 오늘 또는 첫 요일
  // ----------------------------
  const todayKey = DAY_KEYS[today.getDay()];
  const defaultDay = weeklyDays.find((day) => (day.dataset.day || "") === todayKey) || weeklyDays[0];
  const defaultKey = defaultDay ? defaultDay.dataset.day : todayKey;
  const defaultIndex = DAY_KEYS.indexOf(defaultKey);
  const defaultDate = weekDates[defaultIndex >= 0 ? defaultIndex : 0] || today;

  selectDay(defaultDay, defaultKey, defaultDate);

  // 🔹 summary 막대 렌더링
  renderSummary(summaryContainer, mockWeeklyData.summaryTop);
}

// ==================================================
// 🔹 기록 리스트 렌더링
// ==================================================
function renderHistory(items, container, selectedDateLabel, dateLabel = "") {
  if (!container || !selectedDateLabel) return;

  container.innerHTML = "";
  selectedDateLabel.textContent = dateLabel || "";

  if (items.length === 0) {
    // 기록 없으면 안내 문구
    const empty = document.createElement("li");
    empty.textContent = "복용 기록이 없습니다.";
    empty.style.fontSize = "14px";
    empty.style.color = "#999";
    container.appendChild(empty);
    return;
  }

  // 기록 목록 렌더링
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "weekly-history-item";

    // 좌측: 시간 + 약 이름
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

    // 우측: 상태 (복용/미복용/지각)
    const status = document.createElement("span");
    status.className = `weekly-history-status ${item.status}`;
    status.textContent =
      item.status === "success" ? "복용" : item.status === "miss" ? "미복용" : "지각";

    // 상태 클릭 시 토글 (복용/미복용)
    if (item.status === "miss" || item.status === "success") {
      status.style.cursor = "pointer";
      status.addEventListener("click", () => {
        const isMiss = status.classList.contains("miss");
        if (isMiss) {
          status.classList.remove("miss");
          status.classList.add("success");
          status.textContent = "복용";
        } else {
          status.classList.remove("success");
          status.classList.add("miss");
          status.textContent = "미복용";
        }
      });
    }

    li.appendChild(left);
    li.appendChild(status);
    container.appendChild(li);
  });
}

// ==================================================
// 🔹 summary 막대 렌더링
// ==================================================
function renderSummary(container, rows) {
  container.innerHTML = "";
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

// ==================================================
// 🔹 DOMContentLoaded 시 초기화
// ==================================================
window.addEventListener("DOMContentLoaded", initWeeklyPage);
