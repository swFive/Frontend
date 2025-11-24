/**
 * notice.js — 최종 API 연동 + 방어 코드 버전
 * ----------------------------------
 * ✔ /api/v1/statistics/daily-intake (오늘)
 * ✔ /api/v1/statistics?duration=WEEKLY (금주)
 * ✔ /api/v1/statistics?duration=MONTHLY (금월)
 * 응답 형식: [ { userName, date, totalRecords, successCount, ... } ]
 */

// ===================================================================
// 0) 공통 설정
// ===================================================================

// login.js랑 맞춰서 사용
const API_BASE_URL =
    (typeof window !== "undefined" && window.__MC_API_BASE_URL__)
        ? window.__MC_API_BASE_URL__
        : "http://localhost:8080";

// ===================================================================
// 1) 사용자 ID, 토큰 가져오기
// ===================================================================
function getUserId() {
    try {
        const raw = localStorage.getItem("mc_user");
        if (!raw) {
            console.warn("[notice] mc_user 없음 (비로그인 상태)");
            return null;
        }
        const user = JSON.parse(raw);
        const uid = user?.id || user?.userId || null;
        console.log("[notice] userId =", uid, "raw user =", user);
        return uid;
    } catch (e) {
        console.error("[notice] mc_user 파싱 실패:", e);
        return null;
    }
}

function getToken() {
    try {
        const token = localStorage.getItem("mc_token");
        if (!token) {
            console.warn("[notice] mc_token 없음");
            return null;
        }
        return token;
    } catch (e) {
        console.error("[notice] mc_token 조회 실패:", e);
        return null;
    }
}

// ===================================================================
// 2) 통계 API 호출
// ===================================================================
async function fetchStatistics({ duration = "DAILY" }) {
    const userId = getUserId();
    const token = getToken();

    if (!userId || !token) {
        showToast("로그인이 필요합니다.", { type: "error" });
        setTimeout(() => (window.location.href = "./login.html"), 500);
        return null;
    }

    let url;
    if (duration === "DAILY") {
        url = `${API_BASE_URL}/api/v1/statistics/daily-intake?userId=${userId}`;
    } else {
        url = `${API_BASE_URL}/api/v1/statistics?userId=${userId}&duration=${duration}`;
    }

    console.log(`[notice] 통계 요청 (${duration}) →`, url);

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            }
        });

        console.log(`[notice] 응답 상태 (${duration}):`, res.status);

        if (res.status === 401) {
            showToast("로그인이 만료되었습니다. 다시 로그인 해주세요.", { type: "error" });
            setTimeout(() => (window.location.href = "./login.html"), 800);
            return null;
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        console.log(`[notice] 응답 JSON (${duration}):`, json);

        if (!Array.isArray(json) || json.length === 0) {
            console.warn(`[notice] ${duration} 결과 배열이 비어 있음`);
            return null;
        }

        return json[0];
    } catch (e) {
        console.error(`[notice] 통계 API 오류 (${duration}):`, e);
        showToast(`통계 데이터를 불러올 수 없습니다. (${duration})`, { type: "error" });
        return null;
    }
}

// ===================================================================
// 3) Summary Cards 업데이트
// ===================================================================
function updateSummaryCards(weekly, monthly) {
    const missedEl = document.getElementById("missed-weekly");
    const lateEl = document.getElementById("late-weekly");
    const successEl = document.getElementById("success-monthly");

    const weeklyFailure = weekly?.failureCount ?? 0;
    const weeklyLate = weekly?.lateCount ?? 0;
    const monthlySuccess = monthly?.successRate ?? 0;

    if (missedEl) missedEl.textContent = `${weeklyFailure}회`;
    if (lateEl) lateEl.textContent = `${weeklyLate}회`;
    if (successEl) successEl.textContent = `${monthlySuccess}%`;

    console.log("[notice] SummaryCards:", {
        weeklyFailure,
        weeklyLate,
        monthlySuccess,
    });
}

// ===================================================================
// 4) daily-intake 차트용 데이터 생성
// ===================================================================
function generateDailyDetailStats(daily) {
    if (!daily) {
        const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
        return {
            dailyStats: WEEKDAYS.map((d) => ({ day: d, missed: 0, late: 0, total: 1 })),
            timeStats: {
                "아침": { missed: 0, late: 0 },
                "점심": { missed: 0, late: 0 },
                "저녁": { missed: 0, late: 0 },
                "취침 전": { missed: 0, late: 0 },
            },
            topDrugs: [
                { title: "처방약", missed: 0, total: 1 },
                { title: "유산균", missed: 0, total: 1 },
                { title: "비타민", missed: 0, total: 1 },
            ],
        };
    }

    const total = daily.totalRecords || 1;
    const late = daily.lateCount || 0;
    const skipped = daily.skippedCount || 0;

    const dateStr = daily.date || new Date().toISOString().slice(0, 10);

    const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
    const todayIdx = new Date(dateStr).getDay();

    const dailyStats = WEEKDAYS.map((day, idx) => {
        if (idx === todayIdx) {
            return { day, missed: skipped, late: late, total };
        }
        return { day, missed: 0, late: 0, total };
    });

    const timeStats = {
        "아침": { missed: 0, late: 0 },
        "점심": { missed: 0, late: 0 },
        "저녁": { missed: 0, late: 0 },
        "취침 전": { missed: 0, late: 0 },
    };

    const keys = Object.keys(timeStats);
    let rLate = late;
    let rMiss = skipped;
    let i = 0;

    while (rLate-- > 0) timeStats[keys[i++ % 4]].late++;
    i = 0;
    while (rMiss-- > 0) timeStats[keys[i++ % 4]].missed++;

    const failRate = (late + skipped) / total;
    const topDrugs = [
        { title: "처방약", missed: Math.round(10 * failRate), total: 10 },
        { title: "유산균", missed: Math.round(8 * failRate), total: 8 },
        { title: "비타민", missed: Math.round(5 * failRate), total: 5 },
    ];

    return { dailyStats, timeStats, topDrugs };
}

// ===================================================================
// 5) 렌더링 함수들
// ===================================================================
function renderDailyBarChart(dailyStats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    dailyStats.forEach((stat) => {
        const failed = stat.missed + stat.late;
        const complete = stat.total - failed;
        const percent = (complete / stat.total) * 100;

        const html = `
            <div class="day-chart-row">
                <span class="day-chart-day">${stat.day}</span>
                <div class="day-chart-bar-container">
                    <div class="day-chart-bar" style="width:${percent}%"></div>
                </div>
                <span class="day-chart-value">미복용 ${stat.missed}</span>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

function renderTimeBarChart(timeStats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const order = ["아침", "점심", "저녁", "취침 전"];
    const max = Math.max(
        ...order.map((t) => timeStats[t].missed + timeStats[t].late),
        1
    );

    order.forEach((slot) => {
        const val = timeStats[slot].late;
        const width = (val / max) * 100;

        const html = `
            <div class="time-chart-row">
                <span class="time-chart-label">${slot}</span>
                <div class="time-chart-bar-container">
                    <div class="time-chart-bar" style="width:${width}%"></div>
                </div>
                <span class="time-chart-count">${val}</span>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

function renderTopDrugsDoughnut(topDrugs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    topDrugs.forEach((drug) => {
        const rate = (drug.missed / drug.total) * 100;

        const html = `
            <div class="doughnut-item">
                <div class="doughnut-chart-area">
                    <div class="doughnut-placeholder"
                        style="background: conic-gradient(#f44336 0% ${rate}%, #4c82ff ${rate}% 100%);">
                    </div>
                    <div class="doughnut-center-hole"></div>
                </div>
                <p class="doughnut-title">${drug.title}</p>
                <p class="doughnut-stat">미복용률 ${rate.toFixed(1)}%</p>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

// ===================================================================
// 6) 페이지 로드 실행
// ===================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[notice] DOMContentLoaded, API_BASE_URL =", API_BASE_URL);

    const daily = await fetchStatistics({ duration: "DAILY" });
    const weekly = await fetchStatistics({ duration: "WEEKLY" });
    const monthly = await fetchStatistics({ duration: "MONTHLY" });

    updateSummaryCards(weekly, monthly);

    const { dailyStats, timeStats, topDrugs } = generateDailyDetailStats(daily);

    renderDailyBarChart(dailyStats, "day-bar-chart");
    renderTimeBarChart(timeStats, "time-bar-chart");
    renderTopDrugsDoughnut(topDrugs, "drug-doughnut-chart");

    console.log("[notice] 렌더링 완료");
});