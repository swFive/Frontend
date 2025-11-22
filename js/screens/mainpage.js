// mainpage.js
// ----------------------------------
// 목적: 오늘의 복약 일정(시간별 항목), 요약 카드(총정/완료/남음/다음 복용), 카테고리별 약물 요약을
//       localStorage의 medicationCards 데이터를 기반으로 렌더링하고, 사용자 인터랙션(복용 버튼 클릭)을 처리한다.
//
// 전제/가정:
// - 로컬 스토리지 키: "medicationCards" (배열 형태의 객체들)
// - 각 카드 객체 예시:
//   {
//     title: "타이레놀",
//     subtitle: "진통제",          // 카테고리
//     time: "09:00" || ["09:00","21:00"], // 복용 시간(문자열 또는 문자열 배열)
//     dose: "1정",                // 표시용 복용량 텍스트
//     doseCount: "1",            // 1회 복용량을 숫자 형태로 담는 필드(문자열일 수 있음)
//     dailyTimes: 2,             // 하루에 몇 번 복용하는지 (UI에 표시용)
//     takenCountToday: 1         // 오늘 이미 복용한 횟수(변동 가능한 값)
//   }
//
// - 이 파일은 DOMContentLoaded 시점에 실행되어야 하며, medication 데이터가 미리 준비되어 있어야 정확히 동작한다.
//   (예: medication.js의 loadCards()가 먼저 실행되어 localStorage를 세팅해야 함)
// - updateMedicationTakenCount(drugTitle, newState)는 외부에 구현되어 있어야 하며,
//   사용자가 '복용' 상태를 변경했을 때 로컬스토리지에 해당 약의 takenCountToday를 실제로 갱신하도록 기대함.
//
// 개선 권장사항(별도):
// - 시간 비교를 위해 현재는 문자열 비교(localeCompare)을 사용(형식 'HH:MM'을 가정).
//   시간이 정규화 되어 있지 않다면 포맷 정규화 단계가 필요.
// - 날짜/타임존에 민감한 로직이 필요하면 Date 객체를 사용하고 날짜를 명시적으로 다루는 게 안전.
// - UI 갱신이 빈번하면 DOM 재생성이 비용이므로 diff/patch 방식 고려 가능.

// ------------------------------
// 유틸: 오늘 날짜 문자열(YYYY-MM-DD) 반환
// ------------------------------
function getTodayDateString() {
    // toISOString()은 UTC 기준이므로 로컬일자를 원한다면 다른 처리 필요.
    // 여기서는 간단히 YYYY-MM-DD 형식을 얻기 위해 사용.
    return new Date().toISOString().split('T')[0];
}

// ------------------------------
// 로컬 스토리지에서 medicationCards 읽기
// ------------------------------
function getMedicationData() {
    const data = localStorage.getItem("medicationCards");
    // 로컬 스토리지에 데이터가 없거나 JSON 파싱 실패 시 빈 배열 반환
    try {
        return JSON.parse(data) || [];
    } catch (e) {
        // 데이터가 꼬였을 경우 빈 배열로 처리하고 콘솔에 경고
        console.warn("medicationCards 파싱 오류:", e);
        return [];
    }
}

// ------------------------------
// 오늘의 복약 목록을 구성하고 .today-meds 컨테이너에 렌더링
// ------------------------------
function renderTodayMeds() {
    const todayMedsContainer = document.querySelector(".today-meds");
    const allMeds = getMedicationData();
    const todaySchedule = [];

    // 각 카드(약)에 대해 복용 시간별 항목을 분리해서 todaySchedule에 넣음
    allMeds.forEach(card => {
        // card.time이 배열이면 그대로, 아니면 단일값을 배열로 변환
        const times = Array.isArray(card.time) ? card.time : [card.time];

        times.forEach((time, index) => {
            // takenCountToday가 문자열일 수 있으므로 파싱
            const takenCount = parseInt(card.takenCountToday, 10) || 0;

            // 인덱스(0-based) 기준으로 현재 항목이 완료 상태인지 판단
            // 예: takenCount = 1 이면 index 0 항목은 완료, index 1 항목은 미완료
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

    // 시간 기준 오름차순 정렬 (시간 문자열이 'HH:MM' 형식이라고 가정)
    // localeCompare로 비교하지만, 형식이 일정하지 않으면 정확하지 않을 수 있음.
    todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

    // HTML 생성: 각 행에는 데이터 속성으로 약 제목과 시간 정보를 담아두어 이후 이벤트에서 사용 가능
    const medsHTML = todaySchedule.map(item => {
        const statusText = item.isDone ? "복용 완료" : "미복용";
        // data-initial-state는 이후 버튼 초기 상태 설정을 위해 사용됨
        const statusClass = item.isDone ? 'data-initial-state="done"' : '';
        // done일 때 인라인 스타일(예시). 프로덕션에서는 CSS 클래스 사용 권장
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

    // 컨테이너에 삽입
    if (todayMedsContainer) {
        todayMedsContainer.innerHTML = medsHTML;
    }
}

// ------------------------------
// 요약 카드 업데이트: 총 복용량, 완료된 수, 남은 수, 다음 복용 항목
// ------------------------------
function updateSummaryCard() {
    // DOM 요소 선택 (없을 경우 안전하게 무시)
    const totalDoseElement = document.querySelector(".total-dose-value");
    const completedDoseElement = document.querySelector(".completed-dose-value");
    const remainingDoseElement = document.querySelector(".remaining-dose-value");
    const nextDoseElement = document.querySelector(".summary-card__next p");

    // 데이터 로드
    const allMeds = getMedicationData();
    const todaySchedule = [];

    // 누적 카운트
    let totalDoseCount = 0;
    let completedDoseCount = 0;

    allMeds.forEach(card => {
        // doseCount: 1회 복용량(숫자) — 문자열일 수 있으니 파싱
        const dosePerTime = parseInt(card.doseCount, 10) || 1;
        const times = Array.isArray(card.time) ? card.time : [card.time];

        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday, 10) || 0;
            const isDone = (index + 1) <= takenCount;

            // 총 복용량은 각 복용 시간마다 dosePerTime을 더함
            totalDoseCount += dosePerTime;

            // 완료된 경우 completed에 더함
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

    // 아직 복용하지 않은 항목 중 시간 기준으로 가장 이른 것을 '다음 복용'으로 지정
    const notTakenSchedule = todaySchedule.filter(item => !item.isDone);
    notTakenSchedule.sort((a, b) => a.time.localeCompare(b.time));

    let nextDoseText = "✅ 오늘 복용 완료";
    if (notTakenSchedule.length > 0) {
        const nextDose = notTakenSchedule[0];
        nextDoseText = `${nextDose.name} · ${nextDose.time}`;
    }

    // UI 업데이트(엘리먼트가 있을 경우에만)
    if (totalDoseElement) totalDoseElement.innerText = `${totalDoseCount}정`;
    if (completedDoseElement) completedDoseElement.innerText = `${completedDoseCount}정`;
    if (remainingDoseElement) remainingDoseElement.innerText = `${remainingDoseCount}정`;
    if (nextDoseElement) nextDoseElement.innerText = nextDoseText;
}

// ------------------------------
// 카테고리별로 오늘의 약물을 그룹화하여 렌더링
// ------------------------------
function renderTodayMedicationCategories() {
    const categoryGrid = document.querySelector(".dashboard__category-grid");
    const allMeds = getMedicationData();

    // 현재는 필터 없이 전체 사용(필요시 오늘 날짜 기준 필터 적용 가능)
    const todayActiveMeds = allMeds;

    // subtitle 필드를 카테고리로 간주하여 그룹화
    const groupedMeds = todayActiveMeds.reduce((acc, med) => {
        const category = med.subtitle || "기타";
        if (!acc[category]) {
            acc[category] = [];
        }

        // 상태 텍스트 예: (1/2 완료)
        const statusText = ` (${parseInt(med.takenCountToday, 10) || 0}/${parseInt(med.dailyTimes, 10) || 1} 완료)`;
        acc[category].push(med.title + statusText);
        return acc;
    }, {});

    if (categoryGrid) {
        categoryGrid.innerHTML = '';

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

        // 카테고리 추가 버튼(마지막에)
        const addCardHTML = `
            <article class="category-card category-card--add">
                <button type="button" aria-label="새 약 카테고리 추가">+</button>
            </article>
        `;
        categoryGrid.insertAdjacentHTML('beforeend', addCardHTML);
    }
}

// ------------------------------
// 안전한 HTML 이스케이프(텍스트를 HTML로 삽입할 때 사용)
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

// 속성 값(예: data-attr)에 넣을 때 안전하게 변환
function escapeHtmlAttr(str) {
    return escapeHtml(String(str || '')).replace(/"/g, '&quot;');
}

// ------------------------------
// 페이지 로드 후 초기화: 버튼 상태 초기화, 이벤트 바인딩, 초기 렌더링
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // 1) 현재 DOM에 있는 .today-meds__status 버튼들을 가져온다.
    // 주의: renderTodayMeds()가 먼저 호출되어 있어야 버튼들이 DOM에 존재함.
    // 따라서 이 블록의 흐름 끝에서 renderTodayMeds를 호출하되, 버튼 바인딩은
    // renderTodayMeds가 생성한 요소에 대해 동적 바인딩(이벤트 위임 등)으로 처리하는 편이 안전함.
    // 여기서는 기존 구조를 유지하되, 먼저 렌더링을 실행한 다음 버튼을 바인딩하는 방식으로 구현.
    
    // 실행 순서: render -> 바인딩
    renderTodayMeds();
    updateSummaryCard();
    renderTodayMedicationCategories();

    // 버튼 바인딩(동적 요소가 이미 DOM에 있음)
    const statusButtons = document.querySelectorAll('.today-meds__status');

    // 내부 유틸: 버튼의 시각/ARIA 상태를 적용
    const applyState = (button, state) => {
        const isDone = state === 'done';
        button.dataset.state = state;
        button.classList.toggle('is-done', isDone);
        button.classList.toggle('is-missed', !isDone);
        button.setAttribute('aria-pressed', String(isDone));
        button.textContent = isDone ? '복용 완료' : '미복용';
    };

    statusButtons.forEach((button) => {
        // 초기 상태 설정: data-initial-state가 'done'이면 done, 아니면 'missed'
        const initial = button.dataset.initialState === 'done' ? 'done' : 'missed';
        applyState(button, initial);

        // 클릭 시 상태 토글 및 로컬 스토리지 업데이트 → UI/요약 갱신
        button.addEventListener('click', () => {
            // 토글된 상태 결정
            const nextState = button.dataset.state === 'done' ? 'missed' : 'done';

            // 1) 버튼 UI를 먼저 적용
            applyState(button, nextState);

            // 2) 데이터 갱신: 관련 약물의 takenCountToday 값을 실제로 변경해야 함.
            //    이 함수는 외부에서 정의되어 있어야 한다. 기대 동작은 다음과 같음:
            //      updateMedicationTakenCount(drugTitle, newState)
            //    - drugTitle: data-drug-title 어트리뷰트에서 읽음
            //    - newState: 'done'이면 해당 시간의 복용을 증가시키거나 플래그를 세팅,
            //                'missed'이면 감소시키거나 취소 처리
            //    - 내부적으로 localStorage의 medicationCards를 갱신하고 저장해야 함.
            const row = button.closest('.today-meds__row');
            const drugTitle = row ? row.dataset.drugTitle : null;

            if (typeof updateMedicationTakenCount === 'function') {
                try {
                    updateMedicationTakenCount(drugTitle, nextState);
                } catch (e) {
                    console.error('updateMedicationTakenCount 실행 중 오류:', e);
                }
            } else {
                // 함수가 정의되어 있지 않으면 경고. 실제 업데이트가 없다면 그 사실을 개발자에게 알림.
                console.warn('updateMedicationTakenCount 함수가 정의되어 있지 않습니다. 로컬 데이터 갱신 로직을 구현하세요.');
            }

            // 3) 데이터 기반 UI 재렌더링(요약 카드 포함)
            //    renderTodayMeds는 전체 today-meds DOM을 재생성하므로 기존 버튼 레퍼런스는 무효화됨.
            //    이 코드는 간단한 흐름을 위해 전체 재렌더링을 호출하지만, 성능을 위해서는
            //    부분 업데이트(해당 row만 변경)로 최적화 가능.
            renderTodayMeds();
            updateSummaryCard();

            // 참고: renderTodayMeds를 호출하면 현재 콜백 내부의 버튼 참조는 더 이상 유효.
            // 이후 추가 바인딩이 필요하면 이벤트 위임을 사용하거나 render 이후 재바인딩을 해야 함.
        });
    });
});
