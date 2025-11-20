document.addEventListener('DOMContentLoaded', () => {
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
    });
  });
});

/**
 * 오늘 날짜 문자열(YYYY-MM-DD)을 반환합니다.
 */
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 2단계: 오늘 복용을 시작했거나 완료한 약들을 카테고리별로 그룹화하여 렌더링합니다.
 */
function renderTodayMedicationCategories() {
    const categoryGrid = document.querySelector(".dashboard__category-grid");
    const todayString = getTodayDateString();

    // 1. localStorage에서 약물 데이터 로드
    // medication.js에서 저장한 dailyTimes, takenCountToday, lastTakenDate를 사용합니다.
    const allMeds = JSON.parse(localStorage.getItem("medicationCards")) || [];
    
    // 2. 오늘 복용이 진행된 약물만 필터링
    const todayActiveMeds = allMeds;

    // 3. 카테고리별로 약물 목록 그룹화
    const groupedMeds = todayActiveMeds.reduce((acc, med) => {
        const category = med.subtitle;
        if (!acc[category]) {
            acc[category] = [];
        }
        
        // 복용 상태를 이름 옆에 표시합니다 (예: 한미 파모티딘 정 20mg (1/2 완료))
        const statusText = ` (${med.takenCountToday}/${med.dailyTimes} 완료)`;
        acc[category].push(med.title + statusText);
        return acc;
    }, {});
    
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

// ⭐ index.html 페이지가 로드될 때 이 함수를 호출
document.addEventListener('DOMContentLoaded', renderTodayMedicationCategories);