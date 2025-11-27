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
// 약 데이터를 UI용 형식으로 변환
// ------------------------------
function transformMedicationData(medications) {
    return medications.map(item => {
        const schedules = item.schedulesWithLogs || [];
        
        // 시간 목록 추출
        let times = schedules
            .map(s => s.intakeTime ? s.intakeTime.substring(0, 5) : "")
            .filter(t => t);
        times = [...new Set(times)];
        
        // 복용 현황 계산
        let takenCount = 0;
        for (const s of schedules) {
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

    const todaySchedule = [];
    let totalDoseCount = 0;
    let completedDoseCount = 0;

    allMeds.forEach(card => {
        const dosePerTime = parseInt(card.doseCount, 10) || 1;
        const times = Array.isArray(card.time) ? card.time : [card.time];

        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday, 10) || 0;
            const isDone = (index + 1) <= takenCount;

            totalDoseCount += dosePerTime;

            if (isDone) {
                completedDoseCount += dosePerTime;
            }

            todaySchedule.push({
                name: card.title,
                time: time,
                isDone: isDone
            });
        });
    });

    const remainingDoseCount = totalDoseCount - completedDoseCount;

    // 다음 복용 예정
    const notTakenSchedule = todaySchedule.filter(item => !item.isDone);
    notTakenSchedule.sort((a, b) => a.time.localeCompare(b.time));

    let nextDoseText = "✅ 오늘 복용 완료";
    if (notTakenSchedule.length > 0) {
        const nextDose = notTakenSchedule[0];
        nextDoseText = `${nextDose.name} · ${nextDose.time}`;
    }

    if (totalDoseElement) totalDoseElement.innerText = `${totalDoseCount}정`;
    if (completedDoseElement) completedDoseElement.innerText = `${completedDoseCount}정`;
    if (remainingDoseElement) remainingDoseElement.innerText = `${remainingDoseCount}정`;
    if (nextDoseElement) nextDoseElement.innerText = nextDoseText;
}

// ------------------------------
// 카테고리별로 약물 그룹화하여 렌더링
// ------------------------------
function renderTodayMedicationCategories(allMeds) {
    const categoryGrid = document.querySelector(".dashboard__category-grid");
    if (!categoryGrid) return;

    // subtitle 필드를 카테고리로 간주하여 그룹화
    const groupedMeds = allMeds.reduce((acc, med) => {
        const category = med.subtitle || "기타";
        if (!acc[category]) {
            acc[category] = [];
        }

        const statusText = ` (${parseInt(med.takenCountToday, 10) || 0}/${parseInt(med.dailyTimes, 10) || 1} 완료)`;
        acc[category].push(med.title + statusText);
        return acc;
    }, {});

    categoryGrid.innerHTML = '';

    if (Object.keys(groupedMeds).length === 0) {
        const emptyCardHTML = `
            <article class="category-card">
                <p class="category-card__title">등록된 약 없음</p>
                <ul>
                    <li>Medication 페이지에서 약을 등록해주세요.</li>
                </ul>
            </article>
        `;
        categoryGrid.insertAdjacentHTML('beforeend', emptyCardHTML);
    } else {
        Object.keys(groupedMeds).forEach(category => {
            const drugsList = groupedMeds[category];

            const cardHTML = `
                <article class="category-card">
                    <p class="category-card__title">${escapeHtml(category)}</p>
                    <ul>
                        ${drugsList.map(drug => `<li>${escapeHtml(drug)}</li>`).join("")}
                    </ul>
                    <button class="category-card__cta" type="button" aria-label="${escapeHtml(category)} 상세 보기">&gt;</button>
                </article>
            `;
            categoryGrid.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // 카테고리 추가 버튼
    const addCardHTML = `
        <article id="openAddModalCard" class="category-card category-card--add">
            <button type="button" aria-label="새 약 카테고리 추가">+</button>
        </article>
    `;
    categoryGrid.insertAdjacentHTML('beforeend', addCardHTML);
    
    // 추가 버튼 이벤트 재연결
    const openCard = document.getElementById('openAddModalCard');
    if (openCard && typeof openModal === 'function') {
        openCard.addEventListener('click', openModal);
    }
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
    renderTodayMedicationCategories(transformedMeds);
    
    // 버튼 이벤트 바인딩
    bindStatusButtons();
});

