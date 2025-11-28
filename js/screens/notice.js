/**
 * notice.js — 약 목록 기반 통계 계산 버전
 * ----------------------------------
 * ✔ GET /api/mediinfo/medicines 에서 schedulesWithLogs 활용
 * ✔ 클라이언트에서 통계 직접 계산
 */

// ===================================================================
// 0) 공통 설정
// ===================================================================
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
        return user?.id || user?.userId || null;
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
// 2) 약 목록 API 호출
// ===================================================================
async function fetchMedicines() {
    const token = getToken();
    
    if (!token) {
        showToast("로그인이 필요합니다.", { type: "error" });
        setTimeout(() => (window.location.href = "./login.html"), 500);
        return [];
    }

    const url = `${API_BASE_URL}/api/mediinfo/medicines`;
    console.log("[notice] 약 목록 요청 →", url);

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            }
        });

        if (res.status === 401) {
            showToast("로그인이 만료되었습니다.", { type: "error" });
            setTimeout(() => (window.location.href = "./login.html"), 800);
            return [];
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        console.log("[notice] 약 목록:", json.length, "개");
        return json;
    } catch (e) {
        console.error("[notice] 약 목록 API 오류:", e);
        return [];
    }
}

// ===================================================================
// 2-1) 복용 기록 API 호출
// ===================================================================
// 캘린더 API로 복용 기록 가져오기
async function fetchCalendarLogs(year, month) {
    const token = getToken();
    if (!token) return {};

    const url = `${API_BASE_URL}/api/calendar?year=${year}&month=${month}`;

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            }
        });

        if (!res.ok) return {};
        return await res.json();
    } catch (e) {
        console.error("[notice] 캘린더 API 오류:", e);
        return {};
    }
}

// 모든 약의 복용 기록 가져오기 (캘린더 API 사용)
async function fetchAllLogs(medications) {
    const allLogs = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // 이번 달 캘린더 데이터 가져오기
    const calendarData = await fetchCalendarLogs(year, month);
    console.log("[notice] 캘린더 데이터:", calendarData);
    
    // 날짜별 복용 기록을 배열로 변환
    Object.entries(calendarData).forEach(([dateStr, dayLogs]) => {
        if (Array.isArray(dayLogs)) {
            dayLogs.forEach(log => {
                console.log("[notice] 원본 로그:", dateStr, log);
                const status = log.status || log.intakeStatus || log.logStatus;
                allLogs.push({
                    ...log,
                    medicationName: log.medicationName || log.name || log.medicineName,
                    recordTime: `${dateStr}T${log.intakeTime || "00:00:00"}`,
                    intakeStatus: status
                });
            });
        }
    });
    
    console.log("[notice] 전체 복용 기록:", allLogs.length, "개");
    console.log("[notice] 복용 기록 샘플:", allLogs.slice(0, 3));
    return allLogs;
}

// ===================================================================
// 2-2) 시간대 분류 헬퍼
// ===================================================================
function getTimeSlot(timeStr) {
    if (!timeStr) return "저녁";
    const hour = parseInt(timeStr.substring(0, 2), 10);
    
    if (hour >= 6 && hour < 12) return "아침";
    if (hour >= 12 && hour < 18) return "점심";
    if (hour >= 18 && hour < 22) return "저녁";
    return "취침전";
}

// ===================================================================
// 2-3) 클라이언트 통계 계산 (저장된 스케줄 기반)
// ===================================================================
function calculateStatistics(medications, logs) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 이번 주 시작일 (일요일)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    // 이번 달 시작일
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    
    console.log("[notice] 통계 계산 시작...");
    console.log("[notice] 오늘:", todayStr);
    console.log("[notice] 이번 주 시작:", weekStartStr);
    console.log("[notice] 이번 달 시작:", monthStartStr);
    
    // 요일 이름 배열
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayKorToNum = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
    
    // 복용 기록을 날짜+스케줄ID로 정리 (빠른 조회용)
    const logMap = {};
    logs.forEach(log => {
        let dateStr = null;
        if (log.recordTime) {
            dateStr = log.recordTime.includes('T') 
                ? log.recordTime.split('T')[0] 
                : log.recordTime.substring(0, 10);
        }
        if (!dateStr) return;
        
        const key = `${dateStr}_${log.scheduleId || log.medicationId}_${log.intakeTime || ""}`;
        logMap[key] = log;
    });
    
    console.log("[notice] 복용 기록 맵 키:", Object.keys(logMap).length, "개");
    
    // 이번 주 통계 계산
    let weeklyTaken = 0;
    let weeklyLate = 0;
    let weeklyMissed = 0;
    
    // 이번 달 통계 계산
    let monthlyTotal = 0;
    let monthlySuccess = 0;
    
    // 약물별 미복용 집계
    const drugMissedCount = {};
    
    // 시간대별 미복용 집계
    const timeSlotMissed = { "아침": 0, "점심": 0, "저녁": 0, "취침전": 0 };
    
    // 요일별 미복용 집계
    const dayOfWeekMissed = { "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0 };
    
    // 저장된 약의 스케줄을 기반으로 이번 주/이번 달 통계 계산
    medications.forEach(med => {
        const medName = med.name || med.medicineName || "알 수 없음";
        const schedules = med.schedules || med.schedulesWithLogs || [];
        
        schedules.forEach(schedule => {
            const frequency = schedule.frequency || "";
            const intakeTime = schedule.intakeTime ? schedule.intakeTime.substring(0, 5) : "09:00";
            const startDate = schedule.startDate || monthStartStr;
            const endDate = schedule.endDate || todayStr;
            const scheduleId = schedule.scheduleId || schedule.id;
            
            // 복용 요일 파싱 (예: "월, 수, 금" → [1, 3, 5])
            const daysToTake = [];
            Object.keys(dayKorToNum).forEach(dayKor => {
                if (frequency.includes(dayKor)) {
                    daysToTake.push(dayKorToNum[dayKor]);
                }
            });
            
            // 매일인 경우
            if (frequency.includes("매일") || daysToTake.length === 0) {
                for (let i = 0; i < 7; i++) daysToTake.push(i);
            }
            
            // 이번 달 1일부터 오늘까지 순회
            const checkDate = new Date(monthStart);
            while (checkDate <= today) {
                const dateStr = checkDate.toISOString().split('T')[0];
                const dayOfWeek = checkDate.getDay();
                const dayName = dayNames[dayOfWeek];
                
                // 해당 날짜에 복용해야 하는지 확인
                const shouldTake = daysToTake.includes(dayOfWeek) 
                    && dateStr >= startDate 
                    && dateStr <= endDate;
                
                if (shouldTake) {
                    // 복용 기록 찾기
                    const key1 = `${dateStr}_${scheduleId}_${intakeTime}`;
                    const key2 = `${dateStr}_${med.medicationId || med.id}_${intakeTime}`;
                    const log = logMap[key1] || logMap[key2];
                    
                    const status = log?.intakeStatus || log?.status || null;
                    const slot = getTimeSlot(intakeTime);
                    
                    // 이번 달 통계
                    monthlyTotal++;
                    if (status === "TAKEN" || status === "LATE") {
                        monthlySuccess++;
                    } else {
                        // 미복용
                        drugMissedCount[medName] = (drugMissedCount[medName] || 0) + 1;
                    }
                    
                    // 이번 주 통계
                    if (dateStr >= weekStartStr && dateStr <= todayStr) {
                        if (status === "TAKEN") {
                            weeklyTaken++;
                        } else if (status === "LATE") {
                            weeklyLate++;
                        } else {
                            weeklyMissed++;
                            timeSlotMissed[slot]++;
                            dayOfWeekMissed[dayName]++;
                        }
                    }
                }
                
                checkDate.setDate(checkDate.getDate() + 1);
            }
        });
    });
    
    console.log("[notice] 이번 달 전체 스케줄:", monthlyTotal, "개");
    console.log("[notice] 이번 달 복용 성공:", monthlySuccess, "개");
    
    // 복용 성공률 계산
    let successRate = monthlyTotal > 0 ? Math.round((monthlySuccess / monthlyTotal) * 100) : 0;
    
    console.log("[notice] 이번 달 복용 성공률:", successRate + "%");
    
    // 약물별 미복용 Top 3
    const topDrugs = Object.entries(drugMissedCount)
        .map(([name, count]) => ({ title: name, missed: count, total: Math.max(count * 2, 10) }))
        .sort((a, b) => b.missed - a.missed)
        .slice(0, 3);
    
    // 기본 3개 채우기
    while (topDrugs.length < 3) {
        topDrugs.push({ title: "-", missed: 0, total: 1 });
    }

    console.log("[notice] ===== 통계 결과 =====");
    console.log("[notice] 이번 주 복용:", weeklyTaken);
    console.log("[notice] 이번 주 지각:", weeklyLate);
    console.log("[notice] 이번 주 미복용:", weeklyMissed);
    console.log("[notice] 시간대별 미복용:", timeSlotMissed);
    console.log("[notice] 요일별 미복용:", dayOfWeekMissed);
    console.log("[notice] 오늘 복용률:", successRate + "%");
    console.log("[notice] 미복용 Top 3:", topDrugs);

    return {
        weekly: {
            failureCount: weeklyMissed,
            lateCount: weeklyLate,
            takenCount: weeklyTaken
        },
        monthly: {
            successRate: successRate
        },
        topDrugs: topDrugs,
        timeSlotMissed: timeSlotMissed,
        dayOfWeekMissed: dayOfWeekMissed
    };
}

// ===================================================================
// 3) Summary Cards 업데이트
// ===================================================================
function updateSummaryCards(stats) {
    const missedEl = document.getElementById("missed-weekly");
    const lateEl = document.getElementById("late-weekly");
    const successEl = document.getElementById("success-monthly");
    const missedChangeEl = document.getElementById("missed-change-text");
    const lateChangeEl = document.getElementById("late-change-text");
    const successTargetEl = document.getElementById("success-target-text");

    const weeklyFailure = stats.weekly?.failureCount ?? 0;
    const weeklyLate = stats.weekly?.lateCount ?? 0;
    const monthlySuccess = stats.monthly?.successRate ?? 0;

    if (missedEl) missedEl.textContent = `${weeklyFailure}회`;
    if (lateEl) lateEl.textContent = `${weeklyLate}회`;
    if (successEl) successEl.textContent = `${monthlySuccess}%`;
    
    // 비교 텍스트 업데이트
    if (missedChangeEl) {
        missedChangeEl.textContent = weeklyFailure === 0 ? "유지" : `${weeklyFailure}회 발생`;
        missedChangeEl.className = weeklyFailure === 0 ? "trend-down" : "trend-up";
    }
    if (lateChangeEl) {
        lateChangeEl.textContent = weeklyLate === 0 ? "유지" : `${weeklyLate}회 발생`;
        lateChangeEl.className = weeklyLate === 0 ? "trend-down" : "trend-up";
    }
    if (successTargetEl) {
        successTargetEl.textContent = monthlySuccess >= 80 ? "목표 달성! 🎉" : "목표: 80%";
    }

    console.log("[notice] SummaryCards 업데이트 완료:", {
        weeklyFailure,
        weeklyLate,
        monthlySuccess,
    });
}

// ===================================================================
// 4) Top 3 도넛 차트용 데이터
// ===================================================================
function getTopDrugsData(topDrugs) {
    if (!topDrugs || topDrugs.length === 0) {
        return [
            { title: "-", missed: 0, total: 1 },
            { title: "-", missed: 0, total: 1 },
            { title: "-", missed: 0, total: 1 },
        ];
    }
    return topDrugs;
}

// ===================================================================
// 5) 요일별 미복용/지각 차트 렌더링
// ===================================================================
function renderDayBarChart(dayOfWeekMissed, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const days = ["월", "화", "수", "목", "금", "토", "일"];
    const maxValue = Math.max(...days.map(d => dayOfWeekMissed[d] || 0), 1);

    days.forEach((day) => {
        const value = dayOfWeekMissed[day] || 0;
        const widthPercent = (value / maxValue) * 100;

        const html = `
            <div class="day-chart-row">
                <span class="day-chart-day">${day}</span>
                <div class="day-chart-bar-container">
                    <div class="day-chart-bar" style="width: ${widthPercent}%"></div>
                </div>
                <span class="day-chart-value">미복용 ${value}</span>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

// ===================================================================
// 6) 시간대별 누락 차트 렌더링
// ===================================================================
function renderTimeBarChart(timeSlotMissed, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const slots = ["아침", "점심", "저녁", "취침전"];
    const maxValue = Math.max(...slots.map(s => timeSlotMissed[s] || 0), 1);

    slots.forEach((slot) => {
        const value = timeSlotMissed[slot] || 0;
        const widthPercent = (value / maxValue) * 100;

        const html = `
            <div class="time-chart-row">
                <span class="time-chart-label">${slot}</span>
                <div class="time-chart-bar-container">
                    <div class="time-chart-bar" style="width: ${widthPercent}%"></div>
                </div>
                <span class="time-chart-count">${value}</span>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

// ===================================================================
// 7) Top 3 도넛 차트 렌더링
// ===================================================================
function renderTopDrugsDoughnut(topDrugs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    topDrugs.forEach((drug) => {
        const rate = drug.total > 0 ? (drug.missed / drug.total) * 100 : 0;

        const html = `
            <div class="doughnut-item">
                <div class="doughnut-chart-area">
                    <div class="doughnut-placeholder"
                        style="background: conic-gradient(#f44336 0% ${rate}%, #4c82ff ${rate}% 100%);">
                    </div>
                    <div class="doughnut-center-hole"></div>
                </div>
                <p class="doughnut-title">${drug.title}</p>
                <p class="doughnut-stat">${drug.title !== "-" ? `미복용 ${drug.missed}회` : "데이터 없음"}</p>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

// ===================================================================
// 8) 페이지 로드 실행
// ===================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[notice] ===== 페이지 로드 시작 =====");

    // 1. 약 목록 가져오기
    const medications = await fetchMedicines();
    
    const emptyDayStats = { "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0 };
    const emptyTimeStats = { "아침": 0, "점심": 0, "저녁": 0, "취침전": 0 };
    
    if (medications.length === 0) {
        console.log("[notice] 등록된 약이 없습니다.");
        updateSummaryCards({
            weekly: { failureCount: 0, lateCount: 0 },
            monthly: { successRate: 100 }
        });
        renderDayBarChart(emptyDayStats, "day-bar-chart");
        renderTimeBarChart(emptyTimeStats, "time-bar-chart");
        renderTopDrugsDoughnut(getTopDrugsData([]), "drug-doughnut-chart");
        return;
    }

    // 2. 모든 약의 복용 기록 가져오기
    console.log("[notice] 복용 기록 로드 중...");
    const logs = await fetchAllLogs(medications);

    // 3. 통계 계산 (약 목록 + 복용 기록)
    const stats = calculateStatistics(medications, logs);

    // 4. 카드 업데이트
    updateSummaryCards(stats);

    // 5. 요일별 미복용/지각 차트 렌더링
    renderDayBarChart(stats.dayOfWeekMissed, "day-bar-chart");

    // 6. 시간대별 누락 차트 렌더링
    renderTimeBarChart(stats.timeSlotMissed, "time-bar-chart");

    // 7. Top 3 도넛 차트 렌더링
    renderTopDrugsDoughnut(getTopDrugsData(stats.topDrugs), "drug-doughnut-chart");

    console.log("[notice] ===== 렌더링 완료 =====");
});