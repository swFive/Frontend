const listContainer = document.querySelector("#main__listbox__items");
const addButton = document.querySelector("#main__listbox__addBtn");
const listTemplate = listContainer?.querySelector(".main__listbox__list");

const FIELD_DEFAULTS = {
    name: "이름",
    time: "12:12",
    score: "1점",
};

const applyEditableAttributes = (listItem) => {
    listItem.querySelectorAll("[data-field]").forEach((field) => {
        const key = field.dataset.field;
        if (!key) return;

        field.setAttribute("contenteditable", "true");
        field.setAttribute("spellcheck", "false");
        field.setAttribute("role", "textbox");
        field.setAttribute("aria-label", `${FIELD_DEFAULTS[key]} 입력`);
        field.dataset.defaultValue = FIELD_DEFAULTS[key] ?? "";
    });
};

const resetListItem = (listItem) => {
    applyEditableAttributes(listItem);

    listItem.querySelectorAll("[data-field]").forEach((field) => {
        const key = field.dataset.field;
        if (!key) return;
        const fallback = FIELD_DEFAULTS[key];
        if (typeof fallback === "string") {
            field.textContent = fallback;
        }
    });

    const statusBtn = listItem.querySelector(".main__listbox__list__btnbox__btn");
    if (statusBtn) {
        statusBtn.textContent = "미복용";
        statusBtn.classList.remove("is-active");
    }
};

const formatTimeValue = (rawValue) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return FIELD_DEFAULTS.time;

    const colonMatch = trimmed.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
    if (colonMatch) {
        let [, hours, minutes] = colonMatch;
        const hh = parseInt(hours, 10);
        const mm = parseInt(minutes, 10);

        if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) {
            return FIELD_DEFAULTS.time;
        }

        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }

    const numeric = trimmed.replace(/\D/g, "");
    if (numeric.length !== 4) return FIELD_DEFAULTS.time;

    const hh = parseInt(numeric.slice(0, 2), 10);
    const mm = parseInt(numeric.slice(2), 10);
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh > 23 || mm > 59) {
        return FIELD_DEFAULTS.time;
    }

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const formatScoreValue = (rawValue) => {
    const numericMatch = rawValue.replace(/\s+/g, "").match(/\d+/);
    if (!numericMatch) return FIELD_DEFAULTS.score;
    return `${numericMatch[0]}점`;
};

const normalizeFieldValue = (field) => {
    const key = field.dataset.field;
    if (!key) return;

    const rawValue = field.textContent ?? "";
    let value = rawValue.replace(/\s+/g, " ").trim();

    if (!value) {
        field.textContent = FIELD_DEFAULTS[key];
        return;
    }

    if (key === "time") {
        field.textContent = formatTimeValue(value);
        return;
    }

    if (key === "score") {
        field.textContent = formatScoreValue(value);
        return;
    }

    field.textContent = value;
};

if (listContainer && addButton && listTemplate) {
    resetListItem(listTemplate);

    addButton.addEventListener("click", () => {
        const newItem = listTemplate.cloneNode(true);
        resetListItem(newItem);
        listContainer.appendChild(newItem);
        const nameField = newItem.querySelector('[data-field="name"]');
        if (nameField) {
            nameField.focus({ preventScroll: false });
        }
        newItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    listContainer.addEventListener("click", (event) => {
        const target = event.target.closest(".main__listbox__list__btnbox__btn");
        if (!target || !listContainer.contains(target)) return;

        target.classList.toggle("is-active");
        target.textContent = target.classList.contains("is-active") ? "복용" : "미복용";
    });

    listContainer.addEventListener("keydown", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            field.blur();
        }
    });

    listContainer.addEventListener("blur", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        normalizeFieldValue(field);
    }, true);

    listContainer.addEventListener("focusin", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        field.classList.add("is-editing");
    });

    listContainer.addEventListener("focusout", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field || !listContainer.contains(field)) return;
        field.classList.remove("is-editing");
    });
}
