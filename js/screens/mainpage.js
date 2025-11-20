const initTodayStatusButtons = () => {
    const statusButtons = document.querySelectorAll('.today-meds__status');
    if (!statusButtons.length) return;

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
};

const initDynamicCalendar = () => {
    const daysContainer = document.querySelector('.calendar-days');
    const subtitle = document.querySelector('.calendar-card__subtitle');
    if (!daysContainer || !subtitle) return;

    const prevButton = document.querySelector('[data-calendar-nav="prev"]');
    const nextButton = document.querySelector('[data-calendar-nav="next"]');
    const today = new Date();
    const state = {
        reference: new Date(today.getFullYear(), today.getMonth(), 1),
        selectedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    };

    const formatMonthLabel = (date) => date.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const buildDayButton = ({ label = '', classNames = [], attributes = {} }) => {
        const classAttr = classNames.length ? ` class="${classNames.join(' ')}"` : '';
        const attrString = Object.entries(attributes)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => ` ${key}="${value}"`)
            .join('');
        return `<button type="button"${classAttr}${attrString}>${label}</button>`;
    };

    const renderCalendar = () => {
        const year = state.reference.getFullYear();
        const month = state.reference.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
        const markup = [];

        subtitle.textContent = formatMonthLabel(state.reference);

        for (let i = 0; i < firstDay; i += 1) {
            markup.push('<button type="button" class="is-placeholder" tabindex="-1" aria-hidden="true" disabled></button>');
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const isToday = isCurrentMonth && day === today.getDate();
            const isSelected = state.selectedDate
                && state.selectedDate.getFullYear() === year
                && state.selectedDate.getMonth() === month
                && state.selectedDate.getDate() === day;
            const classNames = [];
            if (isToday) classNames.push('is-today');
            if (isSelected) classNames.push('is-selected');
            const attributes = {
                'aria-current': isToday ? 'date' : undefined,
                'aria-pressed': String(isSelected),
                'data-calendar-day': day
            };
            markup.push(buildDayButton({ label: day, classNames, attributes }));
        }

        const totalCells = firstDay + daysInMonth;
        const trailing = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < trailing; i += 1) {
            markup.push('<button type="button" class="is-placeholder" tabindex="-1" aria-hidden="true" disabled></button>');
        }

        daysContainer.innerHTML = markup.join('');
    };

    const shiftMonth = (delta) => {
        state.reference.setMonth(state.reference.getMonth() + delta);
        renderCalendar();
    };

    prevButton?.addEventListener('click', () => shiftMonth(-1));
    nextButton?.addEventListener('click', () => shiftMonth(1));
    daysContainer.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target || target.disabled || target.classList.contains('is-placeholder')) return;
        const { calendarDay } = target.dataset;
        const dayNumber = Number(calendarDay);
        if (!dayNumber) return;
        state.selectedDate = new Date(state.reference.getFullYear(), state.reference.getMonth(), dayNumber);
        renderCalendar();
    });

    renderCalendar();
};

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

document.addEventListener('DOMContentLoaded', () => {
    initTodayStatusButtons();
    initDynamicCalendar();
    renderTodayMedicationCategories();
});