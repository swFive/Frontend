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
async function fetchLogs(medicationId) {
    const token = getToken();
    if (!token) return [];

    const url = `${API_BASE_URL}/api/logs/medication/${medicationId}`;

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            }
        });

        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error("[notice] 복용 기록 API 오류:", e);
        return [];
    }
}

// 모든 약의 복용 기록 가져오기
async function fetchAllLogs(medications) {
    const allLogs = [];
    
    for (const med of medications) {
        const logs = await fetchLogs(med.medicationId);
        logs.forEach(log => {
            allLogs.push({
                ...log,
                medicationName: med.name
            });
        });
    }
    
    console.log("[notice] 전체 복용 기록:", allLogs.length, "개");
    return allLogs;
}

// ===================================================================
// 2-2) 클라이언트 통계 계산 (복용 기록 기반)
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
    
    console.log("[notice] 통계 계산 시작...");
    console.log("[notice] 오늘:", todayStr);
    console.log("[notice] 이번 주 시작:", weekStartStr);
    
    // 복용 기록을 날짜별로 정리
    const logsByDate = {};
    logs.forEach(log => {
        // recordTime에서 날짜 추출
        let dateStr = null;
        if (log.recordTime) {
            if (log.recordTime.includes('T')) {
                dateStr = log.recordTime.split('T')[0];
            } else {
                dateStr = log.recordTime.substring(0, 10);
            }
        }
        if (!dateStr) return;
        
        if (!logsByDate[dateStr]) {
            logsByDate[dateStr] = [];
        }
        logsByDate[dateStr].push(log);
    });
    
    console.log("[notice] 날짜별 복용 기록:", Object.keys(logsByDate));
    
    // 이번 주 통계 계산
    let weeklyTaken = 0;
    let weeklyLate = 0;
    let weeklyMissed = 0;
    
    // 약물별 미복용 집계
    const drugMissedCount = {};
    
    // 이번 주 복용 기록 분석
    logs.forEach(log => {
        let dateStr = null;
        if (log.recordTime) {
            if (log.recordTime.includes('T')) {
                dateStr = log.recordTime.split('T')[0];
            } else {
                dateStr = log.recordTime.substring(0, 10);
            }
        }
        if (!dateStr) return;
        
        // 이번 주 범위인지 확인
        if (dateStr < weekStartStr || dateStr > todayStr) return;
        
        const status = log.intakeStatus;
        if (status === "TAKEN") {
            weeklyTaken++;
        } else if (status === "LATE") {
            weeklyLate++;
        } else if (status === "SKIPPED") {
            weeklyMissed++;
            const medName = log.medicationName || "알 수 없음";
            drugMissedCount[medName] = (drugMissedCount[medName] || 0) + 1;
        }
    });
    
    // 오늘의 복용률 계산 (schedulesWithLogs 사용)
    let todayTotal = 0;
    let todaySuccess = 0;
    
    medications.forEach(med => {
        const schedules = med.schedulesWithLogs || [];
        schedules.forEach(schedule => {
            const intakeTime = schedule.intakeTime ? schedule.intakeTime.substring(0, 5) : "00:00";
            
            // 시간이 지난 스케줄만 카운트
            if (intakeTime <= currentTimeStr) {
                todayTotal++;
                
                if (schedule.logId) {
                    const status = schedule.intakeStatus;
                    if (status === "TAKEN" || status === "LATE") {
                        todaySuccess++;
                    }
                    if (status === "LATE") {
                        // 오늘의 지각도 추가
                        if (!logs.some(l => l.logId === schedule.logId)) {
                            weeklyLate++;
                        }
                    }
                    if (status === "SKIPPED") {
                        if (!logs.some(l => l.logId === schedule.logId)) {
                            weeklyMissed++;
                            drugMissedCount[med.name] = (drugMissedCount[med.name] || 0) + 1;
                        }
                    }
                } else {
                    // 기록이 없으면 미복용
                    weeklyMissed++;
                    drugMissedCount[med.name] = (drugMissedCount[med.name] || 0) + 1;
                }
            }
        });
    });
    
    const successRate = todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 100) : 100;
    
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
        topDrugs: topDrugs
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
// 5) Top 3 도넛 차트 렌더링
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
// 6) 페이지 로드 실행
// ===================================================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[notice] ===== 페이지 로드 시작 =====");

    // 1. 약 목록 가져오기
    const medications = await fetchMedicines();
    
    if (medications.length === 0) {
        console.log("[notice] 등록된 약이 없습니다.");
        updateSummaryCards({
            weekly: { failureCount: 0, lateCount: 0 },
            monthly: { successRate: 100 }
        });
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

    // 5. Top 3 도넛 차트 렌더링
    renderTopDrugsDoughnut(getTopDrugsData(stats.topDrugs), "drug-doughnut-chart");

    console.log("[notice] ===== 렌더링 완료 =====");
});