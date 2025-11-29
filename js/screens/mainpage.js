// mainpage.js
// ----------------------------------
// 목적: 오늘의 복약 일정(시간별 항목), 요약 카드(총정/완료/남음/다음 복용), 카테고리별 약물 요약을
//       API 또는 localStorage 데이터를 기반으로 렌더링

// API 기본 URL
const MAINPAGE_API_URL = (typeof window.API_BASE_URL !== 'undefined')
    ? window.API_BASE_URL
    : "http://localhost:8080";

// 약 목록 캐시
let mainpageMedicationsCache = [];

// ------------------------------
// 인증 헤더
// ------------------------------
function getMainpageAuthHeaders() {
    const token = localStorage.getItem("mc_token");
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

// ------------------------------
// 사용자 정보 가져오기
// ------------------------------
function getUserInfo() {
    const userStr = localStorage.getItem("mc_user");
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.warn("사용자 정보 파싱 오류:", e);
        }
    }
    return null;
}

// ------------------------------
// API에서 약 목록 불러오기
// ------------------------------
async function fetchMainpageMedications() {
    const token = localStorage.getItem("mc_token");
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return [];
    }

    try {
        const response = await fetch(`${MAINPAGE_API_URL}/api/mediinfo/medicines`, {
            method: "GET",
            headers: getMainpageAuthHeaders()
        });

        if (!response.ok) {
            console.error("약 목록 로드 실패:", response.status);
            return [];
        }

        const data = await response.json();
        mainpageMedicationsCache = data || [];
        return mainpageMedicationsCache;
    } catch (error) {
        console.error("약 목록 로드 중 오류:", error);
        return [];
    }
}

// ------------------------------
// 약 데이터를 UI용 형식으로 변환 (오늘 복용할 약만 필터링)
// ------------------------------
function transformMedicationData(medications) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const todayDayIndex = today.getDay(); // 0(일) ~ 6(토)
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const todayDay = dayNames[todayDayIndex];
    
    // 오늘 요일에 해당하는지 확인하는 함수
    const isTodaySchedule = (frequency) => {
        if (!frequency) return true;
        if (frequency === "매일" || frequency === "DAILY") return true;
        // "월,화,수,목,금,토,일" 또는 "월, 화, 수" 형태 처리
        const cleanFreq = frequency.replace(/\s/g, "");
        return cleanFreq.includes(todayDay);
    };
    
    // 날짜가 기간 내인지 확인하는 함수
    const isWithinDateRange = (startDate, endDate) => {
        // 시작일/종료일이 없으면 항상 표시
        if (!startDate && !endDate) return true;
        
        // 시작일만 있는 경우
        if (startDate && !endDate) {
            return todayStr >= startDate;
        }
        
        // 종료일만 있는 경우
        if (!startDate && endDate) {
            return todayStr <= endDate;
        }
        
        // 둘 다 있는 경우
        return todayStr >= startDate && todayStr <= endDate;
    };
    
    return medications
        .filter(item => {
            const schedules = item.schedulesWithLogs || [];
            
            // 스케줄이 없으면 제외
            if (schedules.length === 0) return false;
            
            // 오늘 날짜에 해당하는 스케줄이 하나라도 있는지 확인
            return schedules.some(schedule => {
                const frequency = schedule.frequency || "";
                const startDate = schedule.startDate;
                const endDate = schedule.endDate;
                
                return isTodaySchedule(frequency) && isWithinDateRange(startDate, endDate);
            });
        })
        .map(item => {
            const schedules = item.schedulesWithLogs || [];
            
            // 오늘 날짜에 해당하는 스케줄만 필터링
            const todaySchedules = schedules.filter(schedule => {
                const frequency = schedule.frequency || "";
                const startDate = schedule.startDate;
                const endDate = schedule.endDate;
                
                return isTodaySchedule(frequency) && isWithinDateRange(startDate, endDate);
            });
            
            // 시간 목록 추출 (오늘 스케줄만)
            let times = todaySchedules
                .map(s => s.intakeTime ? s.intakeTime.substring(0, 5) : "")
                .filter(t => t);
            times = [...new Set(times)];
            
            // 복용 현황 계산 (오늘 스케줄만)
            let takenCount = 0;
            for (const s of todaySchedules) {
                if (s.logId && (s.intakeStatus === 'TAKEN' || s.intakeStatus === 'LATE')) {
                    takenCount++;
                }
            }
            
            return {
                title: item.name,
                subtitle: item.category || "기타",
                time: times.length > 0 ? times : ["--:--"],
                dose: `${item.doseUnitQuantity || 1}정`,
                doseCount: item.doseUnitQuantity || 1,
                dailyTimes: times.length || 1,
                takenCountToday: takenCount,
                nextIntakeTime: item.nextIntakeTime || "-",
                memo: item.memo || ""
            };
        });
}

// ------------------------------
// 사용자 이름 표시 업데이트
// ------------------------------
function updateUserName() {
    const nameElement = document.querySelector(".welcome-user-name");
    if (!nameElement) return;
    
    const user = getUserInfo();
    const userName = user?.nickname || user?.name || user?.username || "사용자";
    
    nameElement.textContent = `${userName} 님,`;
}

// ------------------------------
// 오늘의 복약 목록을 구성하고 .today-meds 컨테이너에 렌더링
// ------------------------------
function renderTodayMeds(allMeds) {
    const todayMedsContainer = document.querySelector(".today-meds");
    if (!todayMedsContainer) return;
    
    const todaySchedule = [];

    // 각 카드(약)에 대해 복용 시간별 항목을 분리해서 todaySchedule에 넣음
    allMeds.forEach(card => {
        const times = Array.isArray(card.time) ? card.time : [card.time];

        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday, 10) || 0;
            const isDone = (index + 1) <= takenCount;

            todaySchedule.push({
                name: card.title,
                time: time,
                dose: card.dose,
                isDone: isDone,
                drugCardTitle: card.title
            });
        });
    });

    // 시간 기준 오름차순 정렬
    todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

    if (todaySchedule.length === 0) {
        todayMedsContainer.innerHTML = `
            <div class="today-meds__empty">
                <p>등록된 약이 없습니다.</p>
                <a href="./medication.html">약 등록하러 가기 →</a>
            </div>
        `;
        return;
    }

    // HTML 생성
    const medsHTML = todaySchedule.map(item => {
        const statusText = item.isDone ? "복용 완료" : "미복용";
        const statusClass = item.isDone ? 'data-initial-state="done"' : '';
        const doneStyle = item.isDone ? 'style="background-color: #e3ffe5; color: #1e88e5;"' : '';

        return `
            <div class="today-meds__row" data-drug-title="${escapeHtmlAttr(item.drugCardTitle)}" data-dose-time="${escapeHtmlAttr(item.time)}">
                <span class="today-meds__name">${escapeHtml(item.name)}</span>
                <span class="today-meds__time">${escapeHtml(item.time)}</span>
                <span class="today-meds__dose">${escapeHtml(item.dose)}</span>
                <button type="button" class="today-meds__status" ${statusClass} ${doneStyle}>${escapeHtml(statusText)}</button>
            </div>
        `;
    }).join("");

    todayMedsContainer.innerHTML = medsHTML;
}

// ------------------------------
// 요약 카드 업데이트
// ------------------------------
function updateSummaryCard(allMeds) {
    const totalDoseElement = document.querySelector(".total-dose-value");
    const completedDoseElement = document.querySelector(".completed-dose-value");
    const remainingDoseElement = document.querySelector(".remaining-dose-value");
    const nextDoseElement = document.querySelector(".summary-card__next p");
    const descEl = document.getElementById('summaryDescription');

    const todaySchedule = [];
    let totalCount = 0;
    let completedCount = 0;

    allMeds.forEach(card => {
        const times = Array.isArray(card.time) ? card.time : [card.time];
        const dailyTimes = times.length || 1;
        const takenCount = parseInt(card.takenCountToday, 10) || 0;

        times.forEach((time, index) => {
            const isDone = (index + 1) <= takenCount;
            totalCount++;
            if (isDone) completedCount++;

            todaySchedule.push({
                name: card.title,
                time: time,
                isDone: isDone
            });
        });
    });

    const remainingCount = totalCount - completedCount;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // 다음 복용 예정
    const notTakenSchedule = todaySchedule.filter(item => !item.isDone);
    notTakenSchedule.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    let nextDoseText = "✅ 오늘 복용 완료";
    if (notTakenSchedule.length > 0) {
        const nextDose = notTakenSchedule[0];
        nextDoseText = `${nextDose.name} · ${nextDose.time || '--:--'}`;
    }

    // 설명 업데이트
    if (descEl) {
        if (totalCount > 0) {
            descEl.textContent = `총 ${totalCount}회 중 ${completedCount}회 복용 완료 (${percentage}%)`;
        } else {
            descEl.textContent = '등록된 복용 일정이 없습니다.';
        }
    }

    if (totalDoseElement) totalDoseElement.innerText = `${totalCount}회`;
    if (completedDoseElement) completedDoseElement.innerText = `${completedCount}회`;
    if (remainingDoseElement) remainingDoseElement.innerText = `${remainingCount}회`;
    if (nextDoseElement) nextDoseElement.innerText = nextDoseText;
}

// ------------------------------
// 오늘 날짜 표시 업데이트
// ------------------------------
function updateTodayDate() {
    const dateElement = document.querySelector(".hero__panel-date");
    if (!dateElement) return;
    
    const today = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = today.toLocaleDateString('en-US', options);
    dateElement.textContent = formattedDate;
}

// ------------------------------
// 이번주 복용률 계산 및 업데이트
// ------------------------------
async function updateWeeklyProgress(allMeds) {
    const progressBar = document.querySelector(".hero-progress__bar span");
    const progressValue = document.querySelector(".hero-progress__value");
    const progressContainer = document.querySelector(".hero-progress__bar");
    
    if (!progressBar || !progressValue) return;
    
    // 방법 1: API 통계 사용 시도
    let weeklyRate = await fetchWeeklyStatisticsRate();
    
    // 방법 2: API 실패 시 현재 데이터로 계산
    if (weeklyRate === null) {
        weeklyRate = calculateWeeklyRateFromMeds(allMeds);
    }
    
    // UI 업데이트
    const percentage = Math.round(weeklyRate);
    progressBar.style.width = `${percentage}%`;
    progressValue.textContent = `${percentage}% 완료`;
    
    if (progressContainer) {
        progressContainer.setAttribute('aria-valuenow', percentage);
    }
    
    // 색상 변경 (복용률에 따라)
    if (percentage >= 80) {
        progressBar.style.background = 'linear-gradient(90deg, #30c85a, #50e87a)';
    } else if (percentage >= 50) {
        progressBar.style.background = 'linear-gradient(90deg, #ffa94d, #ffcc00)';
    } else {
        progressBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ff8a8a)';
    }
}

// ------------------------------
// API에서 주간 통계 가져오기
// ------------------------------
async function fetchWeeklyStatisticsRate() {
    const token = localStorage.getItem("mc_token");
    if (!token) return null;
    
    try {
        const user = getUserInfo();
        const userId = user?.id;
        if (!userId) return null;
        
        // 기간별 통계 API 호출
        const response = await fetch(`${MAINPAGE_API_URL}/api/v1/statistics?userId=${userId}&duration=week`, {
            method: "GET",
            headers: getMainpageAuthHeaders()
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        // 응답 형식에 따라 복용률 추출
        // 예: { takenCount: 14, totalCount: 20, rate: 70 }
        if (data.rate !== undefined) {
            return data.rate;
        }
        if (data.takenCount !== undefined && data.totalCount !== undefined && data.totalCount > 0) {
            return (data.takenCount / data.totalCount) * 100;
        }
        
        return null;
    } catch (error) {
        console.warn("주간 통계 API 호출 실패:", error);
        return null;
    }
}

// ------------------------------
// 현재 약 데이터에서 복용률 계산 (오늘 기준)
// ------------------------------
function calculateWeeklyRateFromMeds(allMeds) {
    if (!allMeds || allMeds.length === 0) return 0;
    
    let totalSchedules = 0;
    let completedSchedules = 0;
    
    allMeds.forEach(med => {
        const dailyTimes = parseInt(med.dailyTimes, 10) || 1;
        const takenCount = parseInt(med.takenCountToday, 10) || 0;
        
        totalSchedules += dailyTimes;
        completedSchedules += Math.min(takenCount, dailyTimes);
    });
    
    if (totalSchedules === 0) return 0;
    
    return (completedSchedules / totalSchedules) * 100;
}

// ------------------------------
// 안전한 HTML 이스케이프
// ------------------------------
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[m];
    });
}

function escapeHtmlAttr(str) {
    return escapeHtml(String(str || '')).replace(/"/g, '&quot;');
}

// ==================================================
// 🗓️ 캘린더 기능
// ==================================================

let currentCalendarDate = new Date();
let calendarData = {}; // 날짜별 복용 데이터 캐시
let selectedCalendarDate = null;

// ------------------------------
// 캘린더 초기화
// ------------------------------
function initCalendar() {
    const prevBtn = document.getElementById('calendarPrev');
    const nextBtn = document.getElementById('calendarNext');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }
    
    renderCalendar();
}

// ------------------------------
// 캘린더 렌더링
// ------------------------------
async function renderCalendar() {
    const container = document.getElementById('calendarDays');
    const subtitle = document.getElementById('calendarSubtitle');
    
    if (!container) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 제목 업데이트
    if (subtitle) {
        subtitle.textContent = `${year}년 ${month + 1}월`;
    }
    
    // 캘린더 데이터 가져오기
    await fetchCalendarData(year, month + 1);
    
    // 날짜 계산
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const today = new Date();
    const todayStr = formatDateStr(today);
    
    let html = '';
    
    // 이전 달 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<button type="button" class="is-placeholder" disabled></button>';
    }
    
    // 현재 달 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = selectedCalendarDate === dateStr;
        const dayData = calendarData[dateStr];
        
        let statusDot = '';
        if (dayData) {
            if (dayData.status === 'complete') {
                statusDot = '<span class="status-dot complete"></span>';
            } else if (dayData.status === 'partial') {
                statusDot = '<span class="status-dot partial"></span>';
            } else if (dayData.status === 'missed') {
                statusDot = '<span class="status-dot missed"></span>';
            }
        }
        
        const classes = [];
        if (isToday) classes.push('is-today');
        if (isSelected) classes.push('is-selected');
        
        html += `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}">${day}${statusDot}</button>`;
    }
    
    container.innerHTML = html;
    
    // 날짜 클릭 이벤트
    container.querySelectorAll('button[data-date]').forEach(btn => {
        btn.addEventListener('click', () => {
            const date = btn.dataset.date;
            selectCalendarDate(date);
        });
    });
}

// ------------------------------
// 캘린더 데이터 가져오기 (API)
// ------------------------------
async function fetchCalendarData(year, month) {
    const token = localStorage.getItem("mc_token");
    if (!token) {
        // API 없으면 현재 약 데이터로 시뮬레이션
        simulateCalendarData(year, month);
        return;
    }
    
    try {
        const response = await fetch(`${MAINPAGE_API_URL}/api/calendar?year=${year}&month=${month}`, {
            method: "GET",
            headers: getMainpageAuthHeaders()
        });
        
        if (!response.ok) {
            simulateCalendarData(year, month);
            return;
        }
        
        const data = await response.json();
        
        // API 응답을 calendarData 형식으로 변환
        // 응답이 객체 형태인 경우 (날짜를 키로 하는 형식: { "2025-11-28": [...], ... })
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            Object.keys(data).forEach(dateStr => {
                const dayLogs = data[dateStr] || [];
                
                // 각 로그의 상태 확인
                let total = 0;
                let taken = 0;
                
                dayLogs.forEach(log => {
                    const status = log.status || log.intakeStatus;
                    // SKIPPED는 제외
                    if (status !== 'SKIPPED') {
                        total++;
                        if (status === 'TAKEN' || status === 'LATE') {
                            taken++;
                        }
                    }
                });
                
                let status = null;
                if (total > 0) {
                    if (taken >= total) {
                        status = 'complete';
                    } else if (taken > 0) {
                        status = 'partial';
                    } else {
                        status = 'missed';
                    }
                }
                
                calendarData[dateStr] = {
                    status,
                    total,
                    taken,
                    records: dayLogs
                };
            });
        }
        // 응답이 배열 형태인 경우
        else if (Array.isArray(data)) {
            data.forEach(item => {
                const dateStr = item.date || item.recordDate;
                if (dateStr) {
                    const total = item.totalCount || item.total || 0;
                    const taken = item.takenCount || item.taken || 0;
                    
                    let status = null;
                    if (total > 0) {
                        if (taken >= total) {
                            status = 'complete';
                        } else if (taken > 0) {
                            status = 'partial';
                        } else {
                            status = 'missed';
                        }
                    }
                    
                    calendarData[dateStr] = {
                        status,
                        total,
                        taken,
                        records: item.records || []
                    };
                }
            });
        }
    } catch (error) {
        console.warn("캘린더 API 호출 실패:", error);
        simulateCalendarData(year, month);
    }
}

// ------------------------------
// 캘린더 데이터 시뮬레이션 (API 실패 시 또는 초기 로드)
// ------------------------------
function simulateCalendarData(year, month) {
    const today = new Date();
    const todayStr = formatDateStr(today);
    
    // 현재 약 데이터로 오늘 날짜 설정
    populateTodayCalendarData();
}

// ------------------------------
// 오늘 날짜 캘린더 데이터 설정
// ------------------------------
function populateTodayCalendarData() {
    const today = new Date();
    const todayStr = formatDateStr(today);
    
    if (mainpageMedicationsCache.length > 0) {
        const meds = transformMedicationData(mainpageMedicationsCache);
        let total = 0;
        let taken = 0;
        
        meds.forEach(med => {
            const dailyTimes = parseInt(med.dailyTimes, 10) || 1;
            const takenCount = parseInt(med.takenCountToday, 10) || 0;
            total += dailyTimes;
            taken += Math.min(takenCount, dailyTimes);
        });
        
        let status = null;
        if (total > 0) {
            if (taken >= total) {
                status = 'complete';
            } else if (taken > 0) {
                status = 'partial';
            } else {
                status = 'missed';
            }
        }
        
        calendarData[todayStr] = { status, total, taken, records: meds };
    }
}

// ------------------------------
// 날짜 선택 시 요약 카드 업데이트
// ------------------------------
function selectCalendarDate(dateStr) {
    selectedCalendarDate = dateStr;
    
    // 캘린더 UI 업데이트
    const container = document.getElementById('calendarDays');
    if (container) {
        container.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('is-selected', btn.dataset.date === dateStr);
        });
    }
    
    // 요약 카드 업데이트
    updateSummaryForDate(dateStr);
}

// ------------------------------
// 선택된 날짜의 요약 표시
// ------------------------------
function updateSummaryForDate(dateStr) {
    const titleEl = document.getElementById('summaryTitle');
    const descEl = document.getElementById('summaryDescription');
    const totalEl = document.querySelector('.total-dose-value');
    const completedEl = document.querySelector('.completed-dose-value');
    const remainingEl = document.querySelector('.remaining-dose-value');
    const nextEl = document.querySelector('.summary-card__next');
    const nextDoseEl = nextEl?.querySelector('p');
    
    // 날짜 파싱
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dateObj.getDay()];
    
    const today = new Date();
    const todayStr = formatDateStr(today);
    const isToday = dateStr === todayStr;
    
    // 제목 업데이트
    if (titleEl) {
        titleEl.textContent = isToday ? '오늘의 요약' : `${month}월 ${day}일 (${dayName})`;
    }
    
    // 데이터 가져오기
    const dayData = calendarData[dateStr];
    
    // 데이터 없으면 기본 메시지
    if (!dayData || dayData.total === 0) {
        if (descEl) descEl.textContent = isToday 
            ? '등록된 복용 일정이 없습니다.' 
            : '해당 날짜에 복용 기록이 없습니다.';
        if (totalEl) totalEl.textContent = '0회';
        if (completedEl) completedEl.textContent = '0회';
        if (remainingEl) remainingEl.textContent = '0회';
        if (nextEl) nextEl.style.display = 'none';
        return;
    }
    
    const remaining = dayData.total - dayData.taken;
    const percentage = dayData.total > 0 ? Math.round((dayData.taken / dayData.total) * 100) : 0;
    
    // 설명 업데이트
    if (descEl) {
        descEl.textContent = `총 ${dayData.total}회 중 ${dayData.taken}회 복용 완료 (${percentage}%)`;
    }
    
    // 통계 업데이트
    if (totalEl) totalEl.textContent = `${dayData.total}회`;
    if (completedEl) completedEl.textContent = `${dayData.taken}회`;
    if (remainingEl) remainingEl.textContent = `${remaining}회`;
    
    // 선택된 날짜의 약 목록 표시
    if (nextEl) {
        nextEl.style.display = 'block';
        const medsListEl = nextEl.querySelector('.summary-card__meds-list');
        
        if (medsListEl) {
            // 해당 날짜의 약 목록 구성
            const medsList = [];
            
            // dayData.records는 로그 배열
            if (dayData.records && Array.isArray(dayData.records) && dayData.records.length > 0) {
                // 로그 데이터를 약 이름 + 시간별로 그룹화
                dayData.records.forEach(log => {
                    const medName = log.medicationName || log.name || '알 수 없음';
                    const intakeTime = log.intakeTime ? log.intakeTime.substring(0, 5) : '--:--';
                    const status = log.status || log.intakeStatus;
                    const isDone = status === 'TAKEN' || status === 'LATE';
                    const dose = log.doseUnitQuantity ? `${log.doseUnitQuantity}정` : '1정';
                    
                    medsList.push({
                        name: medName,
                        time: intakeTime,
                        dose: dose,
                        isDone: isDone
                    });
                });
            }
            
            // 시간순 정렬
            medsList.sort((a, b) => a.time.localeCompare(b.time));
            
            if (medsList.length === 0) {
                medsListEl.innerHTML = '<p style="text-align: center; color: #999; margin: 10px 0; padding: 20px;">해당 날짜에 복용 기록이 없습니다.</p>';
            } else {
                const medsHTML = medsList.map(item => {
                    const statusText = item.isDone ? "복용 완료" : "미복용";
                    const statusClass = item.isDone ? 'is-done' : 'is-missed';
                    
                    return `
                        <div class="summary-meds__row">
                            <span class="summary-meds__name">${escapeHtml(item.name)}</span>
                            <span class="summary-meds__time">${escapeHtml(item.time)}</span>
                            <span class="summary-meds__dose">${escapeHtml(item.dose)}</span>
                            <span class="summary-meds__status ${statusClass}">${escapeHtml(statusText)}</span>
                        </div>
                    `;
                }).join("");
                
                medsListEl.innerHTML = medsHTML;
            }
        }
    }
}

// ------------------------------
// 날짜 포맷 헬퍼
// ------------------------------
function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ------------------------------
// 버튼 이벤트 바인딩
// ------------------------------
function bindStatusButtons() {
    const statusButtons = document.querySelectorAll('.today-meds__status');

    const applyState = (button, state) => {
        const isDone = state === 'done';
        button.dataset.state = state;
        button.classList.toggle('is-done', isDone);
        button.classList.toggle('is-missed', !isDone);
        button.setAttribute('aria-pressed', String(isDone));
        button.textContent = isDone ? '복용 완료' : '미복용';
    };

    statusButtons.forEach((button) => {
        const initial = button.dataset.initialState === 'done' ? 'done' : 'missed';
        applyState(button, initial);

        button.addEventListener('click', () => {
            if (button.dataset.state === 'missed') {
                window.location.href = './medication.html';
            }
        });
    });
}

// ------------------------------
// 페이지 로드 후 초기화
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    // 사용자 이름 업데이트
    updateUserName();
    
    // 오늘 날짜 업데이트
    updateTodayDate();
    
    // API에서 약 목록 불러오기
    const medications = await fetchMainpageMedications();
    const transformedMeds = transformMedicationData(medications);
    
    // UI 렌더링
    renderTodayMeds(transformedMeds);
    updateSummaryCard(transformedMeds);
    
    // 이번주 복용률 업데이트
    await updateWeeklyProgress(transformedMeds);
    
    // 오늘 날짜 캘린더 데이터 미리 설정
    populateTodayCalendarData();
    
    // 캘린더 초기화 및 렌더링
    initCalendar();
    
    // 오늘 날짜의 캘린더 데이터 로드 후 요약 카드 업데이트
    const today = new Date();
    const todayStr = formatDateStr(today);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // 오늘 날짜의 캘린더 데이터 가져오기
    await fetchCalendarData(year, month);
    
    // 오늘 날짜 선택하여 요약 카드 업데이트
    selectCalendarDate(todayStr);
    
    // 버튼 이벤트 바인딩
    bindStatusButtons();
});

