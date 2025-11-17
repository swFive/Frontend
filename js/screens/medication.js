const grid = document.getElementById("medicationGrid");
const addBtn = document.getElementById("addDrugBtn");

// 복용 타입별 색상
const typeColors = {
  "필수 복용": { light: "#ffd0d0", deep: "#f28282" }, // 빨
  "선택 복용": { light: "#d0d0ff", deep: "#8282f2" }, // 파
  "건강보조제": { light: "#fff7b0", deep: "#ffe12e" } // 노
};

// localStorage에서 카드 로드
function loadCards() {
  const data = JSON.parse(localStorage.getItem("medicationCards")) || [];
  data.forEach(card => createCard(card, false));
}

// localStorage 저장
function saveCards() {
  const allCards = [...document.querySelectorAll(".drug-card")].map(card => ({
    title: card.querySelector(".drug-info__title p").innerText,
    subtitle: card.querySelector(".drug-info__subtitle select").value,
    drugs: [...card.querySelectorAll(".drug-info__list p")].map(p => p.innerText),
    rule: card.querySelector(".rule").innerText,
    time: card.querySelector(".time").innerText,
    next: card.querySelector(".next").innerText,
    dose: card.querySelector(".dose").innerText
  }));
  localStorage.setItem("medicationCards", JSON.stringify(allCards));
}

// 카드 생성
function createCard(cardData, save = true) {
  const newCard = document.createElement("div");
  newCard.classList.add("drug-card");

  const color = typeColors[cardData.subtitle] || typeColors["필수 복용"];

  newCard.innerHTML = `
    <div class="color-tool-red">
      <div class="color-tool-red__lilight" style="background:${color.light}"></div>
      <div class="color-tool-red__deep" style="background:${color.deep}"></div>
    </div>

    <!-- ❌ 삭제 버튼 -->
    <button class="delete-btn">×</button>

    <div class="drug-info">
      <div class="drug-info__title"><p>${cardData.title}</p></div>
      <div class="drug-info__subtitle">
        <select class="inline-select">
          <option ${cardData.subtitle==="필수 복용" ? "selected" : ""}>필수 복용</option>
          <option ${cardData.subtitle==="선택 복용" ? "selected" : ""}>선택 복용</option>
          <option ${cardData.subtitle==="건강보조제" ? "selected" : ""}>건강보조제</option>
        </select>
      </div>
      <div class="drug-info__list">
        <div>${cardData.drugs.map(d => `<p>${d}</p>`).join("")}</div>
      </div>
    </div>

    <div class="drug-rule-info">
      <div class="drug-rule-info__row"><p class="rule">${cardData.rule}</p></div>
      <div class="drug-rule-info__row"><p class="time">${cardData.time}</p></div>
      <div class="drug-rule-info__row"><p class="next">${cardData.next}</p></div>
      <div class="drug-rule-info__row"><p class="dose">${cardData.dose}</p></div>
    </div>
  `;

  grid.insertBefore(newCard, addBtn);

  // ✅ select 변경 시 색상 변경
  const select = newCard.querySelector(".drug-info__subtitle select");
  select.addEventListener("change", () => {
    const c = typeColors[select.value] || typeColors["필수 복용"];
    newCard.querySelector(".color-tool-red__lilight").style.background = c.light;
    newCard.querySelector(".color-tool-red__deep").style.background = c.deep;
    saveCards();
  });

  // ✅ 삭제 버튼 동작
  const deleteBtn = newCard.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    if (confirm("이 약을 삭제하시겠습니까?")) {
      newCard.remove();
      saveCards();
    }
  });

  // 표시용 editable 클래스 부여
  newCard.querySelectorAll(".drug-info__title p, .drug-info__list p, .drug-rule-info__row p").forEach(p => p.classList.add('editable'));

  // ✅ 인라인 편집: 이벤트 위임으로 반복 편집 가능하게 처리
  newCard.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.tagName !== 'P') return;
    const inTitleOrList = target.closest('.drug-info__title, .drug-info__list');
    const inRule = target.closest('.drug-rule-info__row');
    if (!inTitleOrList && !inRule) return;

  const oldValue = target.innerText;
  const input = document.createElement('input');
    input.type = 'text';
    input.value = oldValue;
    input.className = 'inline-edit';
  // lock input width to the original element width to prevent jump
  const rect = target.getBoundingClientRect();
  input.style.width = rect.width ? rect.width + 'px' : '';
  input.style.minWidth = '120px'; // small floor to avoid too small caret area
  target.replaceWith(input);
    input.focus();

    const originalClass = target.className; // rule 항목은 클래스 유지

    const finish = () => {
      const newValue = input.value.trim() || oldValue;
      const newP = document.createElement('p');
      newP.innerText = newValue;
      if (inRule && originalClass) newP.className = originalClass;
      newP.classList.add('editable');
      input.replaceWith(newP);
      saveCards();
    };

    input.addEventListener('blur', finish, { once: true });
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(); });
  });

  if (save) saveCards();
}

// ✅ 추가 버튼
addBtn.addEventListener("click", () => {
  const newData = {
    title: "새 약",
    subtitle: "필수 복용",
    drugs: ["예시 약품"],
    rule: "매일 1회",
    time: "09:00",
    next: "다음: 오늘 09:00",
    dose: "1정"
  };
  createCard(newData);
});

// 페이지 로드시 실행
loadCards();
