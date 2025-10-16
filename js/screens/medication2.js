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

  // ✅ 인라인 편집 (약 이름 / 약품 목록)
  newCard.querySelectorAll(".drug-info__title p, .drug-info__list p").forEach(p => {
    p.addEventListener("click", () => {
      const oldValue = p.innerText;
      const input = document.createElement("input");
      input.type = "text";
      input.value = oldValue;
      input.className = "inline-edit";
      p.replaceWith(input);
      input.focus();

      const finish = () => {
        const newValue = input.value.trim() || oldValue;
        const newP = document.createElement("p");
        newP.innerText = newValue;
        input.replaceWith(newP);
        saveCards();
      };

      input.addEventListener("blur", finish);
      input.addEventListener("keydown", ev => { if (ev.key === "Enter") finish(); });
    });
  });

  // ✅ 인라인 편집 (복용 정보: 매일 1회 / 09:00 / 다음 / 1정)
  newCard.querySelectorAll(".drug-rule-info__row p").forEach(p => {
    p.addEventListener("click", () => {
      const oldValue = p.innerText;
      const input = document.createElement("input");
      input.type = "text";
      input.value = oldValue;
      input.className = "inline-edit";
      p.replaceWith(input);
      input.focus();

      const finish = () => {
        const newValue = input.value.trim() || oldValue;
        const newP = document.createElement("p");
        newP.innerText = newValue;
        newP.className = p.className; // 기존 클래스 유지
        input.replaceWith(newP);
        saveCards();
      };

      input.addEventListener("blur", finish);
      input.addEventListener("keydown", ev => { if (ev.key === "Enter") finish(); });
    });
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
