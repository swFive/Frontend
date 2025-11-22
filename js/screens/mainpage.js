// mainpage.js

/**
 * 오늘 날짜 문자열(YYYY-MM-DD)을 반환합니다.
 */
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * medication.js의 데이터를 읽는 함수 (localStorage에서 "medicationCards" 데이터를 가져옴)
 */
function getMedicationData() {
    const data = localStorage.getItem("medicationCards");
    // 로컬 스토리지에 데이터가 없으면 [] 반환
    return JSON.parse(data) || []; 
}

/**
 * 오늘의 복약 목록을 구성하고 렌더링하는 함수 (.today-meds)
 */
function renderTodayMeds() {
    const todayMedsContainer = document.querySelector(".today-meds"); 
    const allMeds = getMedicationData(); 
    const todaySchedule = [];

    // C. 전체 약 데이터를 순회하며 오늘의 일정을 추출
    allMeds.forEach(card => {
        // card.time이 단일 문자열일 경우 배열로 변환
        const times = Array.isArray(card.time) ? card.time : [card.time];
        
        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday) || 0;
            
            // index (0부터 시작) + 1이 현재 복용 완료 횟수보다 작거나 같으면 완료 상태로 간주
            const isDone = (index + 1) <= takenCount; 
            
            todaySchedule.push({
                name: card.title,
                time: time,
                // dose는 문자열 형태로 가정 (예: '1정')
                dose: card.dose, 
                isDone: isDone,
                drugCardTitle: card.title 
            });
        });
    });

    // D. 시간을 기준으로 일정을 오름차순 정렬
    todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

    // E. HTML 생성
    const medsHTML = todaySchedule.map(item => {
        const statusText = item.isDone ? "복용 완료" : "미복용";
        const statusClass = item.isDone ? 'data-initial-state="done"' : '';
        const doneStyle = item.isDone ? 'style="background-color: #e3ffe5; color: #1e88e5;"' : ''; 
        
        return `
            <div class="today-meds__row" data-drug-title="${item.drugCardTitle}" data-dose-time="${item.time}">
                <span>${item.name}</span>
                <span>${item.time}</span>
                <span>${item.dose}</span>
                <button type="button" class="today-meds__status" ${statusClass} ${doneStyle}>${statusText}</button>
            </div>
        `;
    }).join("");

    // F. 컨테이너에 HTML 삽입
    if (todayMedsContainer) {
        todayMedsContainer.innerHTML = medsHTML;
    }
}

/**
 * 오늘의 요약 섹션 (.summary-card)을 실제 데이터로 업데이트합니다.
 */
function updateSummaryCard() {
    // 1. DOM 요소 가져오기 (클래스 선택자 사용)
    const totalDoseElement = document.querySelector(".total-dose-value");
    const completedDoseElement = document.querySelector(".completed-dose-value");
    const remainingDoseElement = document.querySelector(".remaining-dose-value");
    const nextDoseElement = document.querySelector(".summary-card__next p");

    // 2. 데이터 로드 및 오늘의 일정 생성 (renderTodayMeds와 동일 로직)
    const allMeds = getMedicationData(); 
    const todaySchedule = [];
    
    let totalDoseCount = 0;
    let completedDoseCount = 0;
    
    allMeds.forEach(card => {
        // doseCount는 1회 복용량(숫자)을 나타내는 속성이라고 가정
        const dosePerTime = parseInt(card.doseCount) || 1; 
        const times = Array.isArray(card.time) ? card.time : [card.time];
        
        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday) || 0;
            const isDone = (index + 1) <= takenCount;
            
            // 총 복용량 합산: (1회 복용량 * 복용 시간 수)
            totalDoseCount += dosePerTime;
            
            // 완료 복용량 합산
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

    // 3. 남은 복용량 계산
    const remainingDoseCount = totalDoseCount - completedDoseCount;
    
    // 4. 다음 복용 예정 시간/약 찾기
    const notTakenSchedule = todaySchedule.filter(item => !item.isDone);
    notTakenSchedule.sort((a, b) => a.time.localeCompare(b.time));
    
    let nextDoseText = "✅ 오늘 복용 완료";

    if (notTakenSchedule.length > 0) {
        const nextDose = notTakenSchedule[0];
        nextDoseText = `${nextDose.name} · ${nextDose.time}`;
    }

    // 5. UI 업데이트 (null 체크 없이 진행)
    if (totalDoseElement) totalDoseElement.innerText = `${totalDoseCount}정`;
    if (completedDoseElement) completedDoseElement.innerText = `${completedDoseCount}정`;
    if (remainingDoseElement) remainingDoseElement.innerText = `${remainingDoseCount}정`;
    if (nextDoseElement) nextDoseElement.innerText = nextDoseText;
}


/**
 * 오늘 복용을 시작했거나 완료한 약들을 카테고리별로 그룹화하여 렌더링합니다.
 */
function renderTodayMedicationCategories() {
    const categoryGrid = document.querySelector(".dashboard__category-grid");
    // const todayString = getTodayDateString(); // 현재 사용되지 않음

    // 1. localStorage에서 약물 데이터 로드
    const allMeds = getMedicationData(); 
    
    // 2. 오늘 복용이 진행된 약물만 필터링 (현재는 전체 약물 사용)
    const todayActiveMeds = allMeds;

    // 3. 카테고리별로 약물 목록 그룹화
    const groupedMeds = todayActiveMeds.reduce((acc, med) => {
        const category = med.subtitle; // subtitle이 카테고리라고 가정
        if (!acc[category]) {
            acc[category] = [];
        }
        
        // 복용 상태를 이름 옆에 표시 (예: (1/2 완료))
        const statusText = ` (${med.takenCountToday}/${med.dailyTimes} 완료)`;
        acc[category].push(med.title + statusText);
        return acc;
    }, {});
    
    if (categoryGrid) {
        // 4. 기존 카테고리 섹션 비우기
        categoryGrid.innerHTML = ''; 
        
        // 5. 새로운 카테고리 카드를 생성하여 추가
        Object.keys(groupedMeds).forEach(category => {
            const drugsList = groupedMeds[category];
            
            const cardHTML = `
                <article class="category-card">
                    <p class="category-card__title">${category}</p>
                    <ul>
                        ${drugsList.map(drug => `<li>${drug}</li>`).join("")}
                    </ul>
                    <button class="category-card__cta" type="button" aria-label="${category} 상세 보기">&gt;</button>
                </article>
            `;
            categoryGrid.insertAdjacentHTML('beforeend', cardHTML);
        });

        // 6. 약 카테고리 추가 버튼 다시 추가
        const addCardHTML = `
            <article class="category-card category-card--add">
                <button type="button" aria-label="새 약 카테고리 추가">+</button>
            </article>
        `;
        categoryGrid.insertAdjacentHTML('beforeend', addCardHTML);
    }
}


// --- 페이지 로드 후 실행 (DOMContentLoaded 리스너 통합) ---

document.addEventListener("DOMContentLoaded", () => {
    // 1. 복약 상태 버튼 초기화 및 이벤트 리스너 설정
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
            const nextState = button.dataset.state === 'done' ? 'missed' : 'done';
            applyState(button, nextState);
            // ⭐ 복용 상태 변경 시 Summary Card 업데이트 (추가 필요)
            // updateSummaryCard(); 
        });
    });

    // 2. 데이터 기반 UI 렌더링 및 업데이트
    // medication.js의 loadCards()가 먼저 실행되어 localStorage 데이터가 준비된 후 
    // 이 함수들이 호출되어야 합니다.
    renderTodayMeds(); 
    updateSummaryCard();
    renderTodayMedicationCategories();
});
