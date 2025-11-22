const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const mockWeeklyData = {
  dayMetrics: {
    sun: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    mon: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    tue: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    wed: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    thu: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    fri: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
    sat: { summary: { success: 0, miss: 0, late: 0 }, history: [] },
  },
  summaryTop: [],
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekLabel = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = String(month + 1).padStart(2, "0");
  const firstDay = new Date(year, month, 1);
  const adjustedDate = date.getDate() + firstDay.getDay();
  const weekNumber = Math.ceil(adjustedDate / 7);
  return `${year}년 ${monthLabel}월 ${weekNumber}주차`;
};

const getWeekDates = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return DAY_KEYS.map((_, idx) => {
    const day = new Date(start);
    day.setDate(start.getDate() + idx);
    return day;
  });
};

const getDayMetrics = (key) => {
  const fallback = { summary: { success: 0, miss: 0, late: 0 }, history: [] };
  const data = mockWeeklyData.dayMetrics[key];
  if (!data) return fallback;
  return {
    summary: Object.assign({ success: 0, miss: 0, late: 0 }, data.summary || {}),
    history: Array.isArray(data.history) ? data.history : [],
  };
};

function initWeeklyPage() {
  const periodLabel = document.querySelector(".weekly-period-label");
  const weeklyDays = Array.from(document.querySelectorAll(".weekly-day"));
  const selectedDateLabel = document.querySelector(".weekly-selected-date");
  const historyList = document.querySelector(".weekly-history-list");
  const summaryContainer = document.querySelector(".weekly-summary-bars");

  if (!periodLabel || !historyList || !selectedDateLabel || !weeklyDays.length) return;

  const today = new Date();
  const weekDates = getWeekDates(today);
  periodLabel.textContent = getWeekLabel(today);

  const selectDay = (targetDay, dayKey, dateObj) => {
    weeklyDays.forEach((d) => d.classList.remove("active"));
    if (targetDay) targetDay.classList.add("active");
    const metrics = getDayMetrics(dayKey);
    renderHistory(metrics.history, historyList, selectedDateLabel, formatDate(dateObj));
  };

  weeklyDays.forEach((day, index) => {
    const key = day.dataset.day || DAY_KEYS[index] || "sun";
    const dayIndex = DAY_KEYS.indexOf(key);
    const dateObj = weekDates[dayIndex >= 0 ? dayIndex : index];
    if (!dateObj) return;

    day.dataset.day = key;
    day.dataset.fullDate = formatDate(dateObj);

    const dateEl = day.querySelector(".weekly-day-date");
    if (dateEl) dateEl.textContent = dateObj.getDate();

    const metrics = getDayMetrics(key);
    const existingDots = day.querySelector(".weekly-day-dots");
    if (existingDots) existingDots.remove();
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

    day.addEventListener("click", () => {
      selectDay(day, key, dateObj);
    });
  });

  const todayKey = DAY_KEYS[today.getDay()];
  const defaultDay = weeklyDays.find((day) => (day.dataset.day || "") === todayKey) || weeklyDays[0];
  const defaultKey = defaultDay ? defaultDay.dataset.day : todayKey;
  const defaultIndex = DAY_KEYS.indexOf(defaultKey);
  const defaultDate = weekDates[defaultIndex >= 0 ? defaultIndex : 0] || today;

  selectDay(defaultDay, defaultKey, defaultDate);
  renderSummary(summaryContainer, mockWeeklyData.summaryTop);
}

function renderHistory(items, container, selectedDateLabel, dateLabel = "") {
  if (!container || !selectedDateLabel) return;
  container.innerHTML = "";
  selectedDateLabel.textContent = dateLabel || "";

  if (items.length === 0) {
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

    const status = document.createElement("span");
    status.className = `weekly-history-status ${item.status}`;
    status.textContent = item.status === "success" ? "복용" : item.status === "miss" ? "미복용" : "지각";

    // 상태 토글: 기본값은 미복용, 클릭 시 미복용/복용 전환
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

window.addEventListener("DOMContentLoaded", initWeeklyPage);
