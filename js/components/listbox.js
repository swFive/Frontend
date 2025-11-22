// 리스트가 들어갈 컨테이너 요소
const listContainer = document.querySelector("#main__listbox__items");
// 리스트 추가 버튼
const addButton = document.querySelector("#main__listbox__addBtn");
// 템플릿으로 사용할 첫 번째 리스트 요소
const listTemplate = listContainer?.querySelector(".main__listbox__list");

// 각 필드의 기본값 정의
const FIELD_DEFAULTS = {
    name: "이름",
    time: "12:12",
    score: "1점",
};

/** 
 * 리스트 항목의 각 필드에 contenteditable 속성 부여
 * 접근성 관련 설정(aria-label, role)도 함께 적용
 */
const applyEditableAttributes = (listItem) => {
    listItem.querySelectorAll("[data-field]").forEach((field) => {
        const key = field.dataset.field;
        if (!key) return;

        // 입력 가능 설정
        field.setAttribute("contenteditable", "true");
        field.setAttribute("spellcheck", "false");
        field.setAttribute("role", "textbox");
        field.setAttribute("aria-label", `${FIELD_DEFAULTS[key]} 입력`);

        // 기본값 저장
        field.dataset.defaultValue = FIELD_DEFAULTS[key] ?? "";
    });
};

/**
 * 리스트 항목 초기화(기본값 세팅)
 * 이름/시간/점수 등 텍스트 초기화 + 복용 버튼 상태 초기화
 */
const resetListItem = (listItem) => {
    applyEditableAttributes(listItem);

    // 각 필드에 기본 텍스트 삽입
    listItem.querySelectorAll("[data-field]").forEach((field) => {
        const key = field.dataset.field;
        if (!key) return;

        const fallback = FIELD_DEFAULTS[key];
        if (typeof fallback === "string") {
            field.textContent = fallback;
        }
    });

    // '복용/미복용' 버튼 초기 상태
    const statusBtn = listItem.querySelector(".main__listbox__list__btnbox__btn");
    if (statusBtn) {
        statusBtn.textContent = "미복용";
        statusBtn.classList.remove("is-active");
    }
};

/**
 * 시간 값 포맷팅
 * 입력 예: "9:5" → "09:05", "1234" → "12:34"
 * 잘못된 입력 시 기본값 반환
 */
const formatTimeValue = (rawValue) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return FIELD_DEFAULTS.time;

    // 패턴: HH:MM
    const colonMatch = trimmed.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
    if (colonMatch) {
        let [, hours, minutes] = colonMatch;
        const hh = parseInt(hours, 10);
        const mm = parseInt(minutes, 10);

        // 범위 검사
        if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) {
            return FIELD_DEFAULTS.time;
        }

        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }

    // 숫자만 입력된 경우: HHMM
    const numeric = trimmed.replace(/\D/g, "");
    if (numeric.length !== 4) return FIELD_DEFAULTS.time;

    const hh = parseInt(numeric.slice(0, 2), 10);
    const mm = parseInt(numeric.slice(2), 10);

    if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) {
        return FIELD_DEFAULTS.time;
    }

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/**
 * 점수값 포맷팅
 * 숫자만 추출하여 "N점" 형식으로 변환
 */
const formatScoreValue = (rawValue) => {
    const numericMatch = rawValue.replace(/\s+/g, "").match(/\d+/);
    if (!numericMatch) return FIELD_DEFAULTS.score;
    return `${numericMatch[0]}점`;
};

/**
 * 필드 값 정규화
 * - 빈값이면 기본값 복원
 * - 시간/점수 필드는 전용 포맷팅 적용
 */
const normalizeFieldValue = (field) => {
    const key = field.dataset.field;
    if (!key) return;

    const rawValue = field.textContent ?? "";
    let value = rawValue.replace(/\s+/g, " ").trim();

    // 비었을 경우 기본값
    if (!value) {
        field.textContent = FIELD_DEFAULTS[key];
        return;
    }

    // 시간 필드 처리
    if (key === "time") {
        field.textContent = formatTimeValue(value);
        return;
    }

    // 점수 필드 처리
    if (key === "score") {
        field.textContent = formatScoreValue(value);
        return;
    }

    // 일반 텍스트 필드
    field.textContent = value;
};

// 실제 기능 로직 실행(필수 요소가 있는 경우에만)
if (listContainer && addButton && listTemplate) {

    // 템플릿에 기본값 세팅
    resetListItem(listTemplate);

    /**
     * ➕ 추가 버튼 클릭 → 리스트 항목 복제 & 초기화
     */
    addButton.addEventListener("click", () => {
        const newItem = listTemplate.cloneNode(true);
        resetListItem(newItem);
        listContainer.appendChild(newItem);

        // 추가 직후 "이름" 필드에 포커스
        const nameField = newItem.querySelector('[data-field="name"]');
        if (nameField) {
            nameField.focus({ preventScroll: false });
        }

        // 새 항목으로 스크롤 이동
        newItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    /**
     * ✔️ 복용/미복용 버튼 토글
     */
    listContainer.addEventListener("click", (event) => {
        const target = event.target.closest(".main__listbox__list__btnbox__btn");
        if (!target || !listContainer.contains(target)) return;

        target.classList.toggle("is-active");
        target.textContent = target.classList.contains("is-active") ? "복용" : "미복용";
    });

    /**
     * ⏎ Enter 입력 시 줄바꿈 방지 & blur로 포맷팅 트리거
     */
    listContainer.addEventListener("keydown", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;

        // Enter로 줄바꿈 방지 (Shift+Enter만 허용)
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            field.blur();
        }
    });

    /**
     * 포커스 빠질 때 값 정규화
     */
    listContainer.addEventListener("blur", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        normalizeFieldValue(field);
    }, true);

    /**
     * 편집 시작 → 스타일 적용
     */
    listContainer.addEventListener("focusin", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        field.classList.add("is-editing");
    });

    /**
     * 편집 종료 → 스타일 제거
     */
    listContainer.addEventListener("focusout", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        field.classList.remove("is-editing");
    });
}
