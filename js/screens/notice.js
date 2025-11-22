// report.js

/**
 * medication.js의 데이터를 읽는 함수 (localStorage에서 "medicationCards" 데이터를 가져옴)
 */
function getMedicationData() {
    const data = localStorage.getItem("medicationCards");
    return JSON.parse(data) || []; 
}

// ----------------------------------------------------
// ⭐ 시간대 분류 유틸리티 함수 (새로 추가) ⭐
// ----------------------------------------------------

/**
 * 시간을 네 가지 시간대로 분류합니다.
 * 04:00~10:00: 아침, 10:00~15:00: 점심, 15:00~20:30: 저녁, 그 외: 취침 전
 * @param {string} timeStr - 복용 예정 시간 ("HH:MM" 형식)
 * @returns {string} 시간대 ("아침", "점심", "저녁", "취침 전")
 */
function classifyTimeSlot(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const timeInMinutes = h * 60 + m;

    if (timeInMinutes >= (4 * 60) && timeInMinutes < (10 * 60)) {
        return "아침"; // 04:00 ~ 09:59
    } else if (timeInMinutes >= (10 * 60) && timeInMinutes < (15 * 60)) {
        return "점심"; // 10:00 ~ 14:59
    } else if (timeInMinutes >= (15 * 60) && timeInMinutes < (20 * 60 + 30)) {
        return "저녁"; // 15:00 ~ 20:29
    } else {
        return "취침 전"; // 20:30 ~ 03:59
    }
}


/**
 * 날짜 데이터를 기반으로 리포트에 필요한 모든 통계 데이터를 계산합니다.
 */
function calculateReportData(allMeds) {
    // --- 1. 오늘 복용량 및 완료량 계산 ---
    
    // 오늘 총 복용 예정 횟수 (정 단위)
    const totalDosesToday = allMeds.reduce((sum, card) => {
        const dosePerTime = parseInt(card.doseCount) || 1;
        const totalTimes = Array.isArray(card.time) ? card.time.length : (card.time ? 1 : 0);
        return sum + (dosePerTime * totalTimes);
    }, 0);

    // 오늘 복용 완료 횟수 (정 단위)
    const completedDosesToday = allMeds.reduce((sum, card) => {
        const dosePerTime = parseInt(card.doseCount) || 1;
        const takenCount = parseInt(card.takenCountToday) || 0;
        return sum + (dosePerTime * takenCount);
    }, 0);
    
    const todayMissed = totalDosesToday - completedDosesToday; // 오늘 미복용 횟수

    // --- 2. 통계 지표 계산 (임시 가정 기반) ---
    const weeklyMissed = todayMissed + 1; 
    const weeklyLate = allMeds.reduce((sum, card) => sum + (parseInt(card.lateCountToday) || 0), 0) || Math.max(1, Math.floor(totalDosesToday / 5)); // medication.js의 lateCountToday 사용

    const todaySuccessRate = totalDosesToday > 0 ? (completedDosesToday / totalDosesToday) * 100 : 0;
    const monthlySuccess = Math.min(95, Math.floor(todaySuccessRate * 0.9 + 15)); 


    // 3. 요일별 미복용/지각 데이터 (기존 로직 유지)
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyMissedCounts = {
        '일': 0, '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 1 
    };
    const totalDailyScheduled = totalDosesToday > 0 ? totalDosesToday : 7;

    const dailyStats = days.map(day => {
        const missed = dailyMissedCounts[day];
        return { 
            day, 
            missed, 
            late: 0, 
            total: totalDailyScheduled 
        };
    });
    
    // 4. 약물별 미복용 Top 3 (기존 로직 유지)
    const drugStats = allMeds.map(med => {
        const dosePerTime = parseInt(med.doseCount) || 1;
        const totalTimes = Array.isArray(med.time) ? med.time.length : (med.time ? 1 : 0);
        const takenCount = parseInt(med.takenCountToday) || 0;
        
        const potentialTotal = dosePerTime * totalTimes * 7; 
        const missed = (dosePerTime * totalTimes) - (dosePerTime * takenCount);
        const missed7Days = missed * 7;
        
        return {
            title: med.title, 
            missed: missed7Days, 
            total: potentialTotal
        };
    });

    const sortedDrugs = drugStats.sort((a, b) => b.missed - a.missed).slice(0, 3);


    // ----------------------------------------------------
    // ⭐ 5. 시간대별 누락 계산 (핵심 로직) ⭐
    // ----------------------------------------------------
    const timeStats = {
        '아침': { scheduled: 0, missed: 0, late: 0 },
        '점심': { scheduled: 0, missed: 0, late: 0 },
        '저녁': { scheduled: 0, missed: 0, late: 0 },
        '취침 전': { scheduled: 0, missed: 0, late: 0 }
    };

    allMeds.forEach(card => {
        const dosePerTime = parseInt(card.doseCount) || 1;
        const totalScheduledTimes = Array.isArray(card.time) ? card.time.length : (card.time ? 1 : 0);
        const takenCount = parseInt(card.takenCountToday) || 0;
        const lateCount = parseInt(card.lateCountToday) || 0; // 지각 횟수 로드

        // 복용 예정 시간 슬롯별로 순회하며 계산
        if (Array.isArray(card.time)) {
            card.time.forEach((t, index) => {
                const slotName = classifyTimeSlot(t);
                
                // 해당 시간대에 예정된 복용량 추가
                timeStats[slotName].scheduled += dosePerTime;

                // 1. 미복용 (미복용은 아직 복용 완료되지 않은 슬롯으로 간주)
                // takenCount는 총 복용 완료 횟수이므로, index가 takenCount와 같거나 크면 미복용으로 간주 (단순화)
                if (index >= takenCount) {
                    timeStats[slotName].missed += dosePerTime;
                }
                
                // 2. 지각 (현재 데이터 구조에서는 어떤 슬롯이 지각인지 알기 어려우므로, 
                // 지각 횟수(lateCount)를 복용 완료된 슬롯(index < takenCount)에 균등하게 배분하거나,
                // 가장 간단하게는 미복용/지각 중 하나로만 기록하기 위해 여기서는 미복용만 기록하고,
                // 아래 렌더링 시에는 지각 횟수(weeklyLate)를 사용합니다. 
                // -> 그러나 시간대별 누락이 '지각' 횟수를 보여주므로, 지각 횟수를 임시 배분합니다.
                
                // 임시 지각 배분 로직: 지각 횟수를 첫 lateCount 횟수만큼의 슬롯에 배분한다고 가정 (복용 완료된 슬롯 중)
                if (index < lateCount) {
                    timeStats[slotName].late += dosePerTime;
                }
            });
        }
    });


    return {
        weeklyMissed,
        weeklyLate,
        monthlySuccess,
        dailyStats,
        topDrugs: sortedDrugs,
        timeStats // ⭐ 시간대별 통계 추가
    };
}


// --- 렌더링 함수 ---

// ... (updateSummaryCards, renderDailyBarChart, renderTopDrugsDoughnut 기존 로직 유지) ...

/**
 * 1. Summary Cards (주요 지표)를 업데이트합니다.
 */
function updateSummaryCards(data) {
    const missedElement = document.getElementById('missed-weekly');
    const lateElement = document.getElementById('late-weekly');
    const successElement = document.getElementById('success-monthly');

    if (missedElement) missedElement.textContent = `${data.weeklyMissed}회`;
    if (lateElement) lateElement.textContent = `${data.weeklyLate}회`;
    if (successElement) successElement.textContent = `${data.monthlySuccess}%`;
}

/**
 * 2. 요일별 바 차트 요소를 렌더링합니다. (값에 비례하여 바의 너비 설정)
 */
function renderDailyBarChart(dailyStats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    dailyStats.forEach(stat => {
        const totalFailed = stat.missed + stat.late;
        const completionCount = stat.total - totalFailed;

        const completionRate = stat.total > 0 ? (completionCount / stat.total) * 100 : 100;
        const barWidth = completionRate; 
        
        const barHTML = `
            <div class="day-chart-row">
                <span class="day-chart-day">${stat.day}</span>
                <div class="day-chart-bar-container">
                    <div class="day-chart-bar" style="width: ${barWidth}%"></div>
                </div>
                <span class="day-chart-value">미복용 ${stat.missed}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', barHTML);
    });
}

/**
 * 3. 약물별 Top 3 도넛 차트 요소를 렌더링합니다.
 */
function renderTopDrugsDoughnut(topDrugs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; 

    const chartContainer = document.createElement('div');
    chartContainer.className = 'top3-doughnut-chart'; 
    
    topDrugs.forEach(drug => {
        const missedRate = drug.total > 0 ? (drug.missed / drug.total) * 100 : 0;
        
        const drugHTML = `
            <div class="doughnut-item">
                <div class="doughnut-chart-area">
                    <div class="doughnut-placeholder" style="background: conic-gradient(#f44336 0% ${missedRate}%, #4c82ff ${missedRate}% 100%);"></div>
                    <div class="doughnut-center-hole"></div>
                </div>
                <p class="doughnut-title">${drug.title}</p>
                <p class="doughnut-stat">미복용률 ${missedRate.toFixed(1)}%</p>
            </div>
        `;
        chartContainer.insertAdjacentHTML('beforeend', drugHTML);
    });
    
    container.appendChild(chartContainer);
}

// ----------------------------------------------------
// ⭐ 4. 시간대별 누락 바 차트 렌더링 함수 (새로 추가) ⭐
// ----------------------------------------------------

/**
 * 4. 시간대별 누락 바 차트 요소를 렌더링합니다. (미복용/지각 횟수를 보여줌)
 */
function renderTimeBarChart(timeStats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    // 시간대 순서 정의 (이미지 레이아웃과 일치하도록)
    const timeOrder = ['아침', '점심', '저녁', '취침 전'];

    // 차트 스케일링을 위한 최대 누락 횟수 계산 (최대 10회로 가정)
    const maxFailedCount = Math.max(...timeOrder.map(slot => (timeStats[slot].missed + timeStats[slot].late)), 1);

    // 이미지의 '시간대별 누락'은 미복용과 지각 중 하나를 주로 보여주는데, 여기서는 지각 횟수를 중심으로 보여줍니다.
    timeOrder.forEach(slotName => {
        const stats = timeStats[slotName];
        if (!stats) return;

        // 지각 횟수를 바의 값으로 사용 (이미지 형태에 맞춰)
        const barValue = stats.late; 
        
        // 지각 횟수를 최대값에 대비하여 백분율로 변환
        const barWidth = (barValue / maxFailedCount) * 100;

        const barHTML = `
            <div class="time-chart-row">
                <span class="time-chart-label">${slotName}</span>
                <div class="time-chart-bar-container">
                    <div class="time-chart-bar" style="width: ${barWidth}%"></div>
                </div>
                <span class="time-chart-count">${barValue}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', barHTML);
    });
}


// --- 페이지 로드 후 실행 ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. 데이터 로드
    const allMeds = getMedicationData(); 
    
    // 2. 통계 계산
    const reportData = calculateReportData(allMeds);
    
    // 3. UI 렌더링
    updateSummaryCards(reportData);
    renderDailyBarChart(reportData.dailyStats, 'day-bar-chart');
    renderTimeBarChart(reportData.timeStats, 'time-bar-chart');
    renderTopDrugsDoughnut(reportData.topDrugs, 'drug-doughnut-chart');

    console.log("Report Data Loaded:", reportData);
});