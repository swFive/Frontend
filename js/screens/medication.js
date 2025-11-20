const grid = document.getElementById("medicationGrid");
const addBtn = document.getElementById("addDrugBtn");

// ✅ 복용 타입별 색상
const typeColors = {
  "필수 복용": { light: "#ffd0d0", deep: "#f28282" }, // 빨
  "기간제": { light: "#d0d0ff", deep: "#8282f2" }, // 파
  "건강보조제": { light: "#fff7b0", deep: "#ffe12e" } // 노
};

// ✅ localStorage에서 카드 로드
function loadCards() {
  const data = JSON.parse(localStorage.getItem("medicationCards")) || [];
  data.forEach(card => createCard(card, false));
}

// ✅ localStorage 저장
function saveCards() {
  const allCards = [...document.querySelectorAll(".drug-card")].map(card => ({
    title: card.querySelector(".drug-info__title p").innerText,
    subtitle: card.querySelector(".drug-info__subtitle select").value,
    drugs: [...card.querySelectorAll(".drug-info__list p")].map(p => p.innerText),
    rule: card.querySelector(".rule").innerText,
    time: [...card.querySelectorAll(".time-item")].map(p => p.innerText),
    next: card.querySelector(".next").innerText,
    dose: card.querySelector(".dose").innerText,
    stock: parseInt(card.querySelector(".stock").innerText.replace("정", "").trim(), 10),
    doseCount: card.dataset.doseCount || "1",
    startDate: card.dataset.startDate || "",
    endDate: card.dataset.endDate || ""
  }));
  localStorage.setItem("medicationCards", JSON.stringify(allCards));
}

// ✅ 카드 생성
function createCard(cardData, save = true) {
  const newCard = document.createElement("div");
  newCard.classList.add("drug-card");

  // 사용자 정의 카테고리면 보라색 기본값
  const color = typeColors[cardData.subtitle] || { light: "#e6d6ff", deep: "#a86af2" };

  newCard.dataset.stock = cardData.stock || 0;
  newCard.dataset.doseCount = cardData.doseCount || 1;
  newCard.dataset.startDate = cardData.startDate || "";
  newCard.dataset.endDate = cardData.endDate || "";

  const timeHTML = Array.isArray(cardData.time)
    ? cardData.time.map(t => `<p class="time-item">${t}</p>`).join("")
    : `<p class="time-item">${cardData.time}</p>`;

  newCard.innerHTML = `
    <div class="color-tool-red">
      <div class="color-tool-red__lilight" style="background:${color.light}"></div>
      <div class="color-tool-red__deep" style="background:${color.deep}"></div>
    </div>

    <button class="delete-btn">×</button>

    <div class="drug-info">
      <div class="drug-info__title"><p>${cardData.title}</p></div>
      <div class="drug-info__subtitle">
        <select class="inline-select">
          <option ${cardData.subtitle==="필수 복용" ? "selected" : ""}>필수 복용</option>
          <option ${cardData.subtitle==="기간제" ? "selected" : ""}>기간제</option>
          <option ${cardData.subtitle==="건강보조제" ? "selected" : ""}>건강보조제</option>
          <option ${!(cardData.subtitle in typeColors) ? "selected" : ""}>${cardData.subtitle}</option>
        </select>
      </div>
      <div class="drug-info__list">
        <div>${cardData.drugs.map(d => `<p>${d}</p>`).join("")}</div>
      </div>
    </div>

    <div class="drug-rule-info">
      <div class="drug-rule-info__row"><p class="rule">${cardData.rule}</p></div>
      <div class="drug-rule-info__row time">${timeHTML}</div>
      <div class="drug-rule-info__row"><p class="next">${cardData.next}</p></div>
      <div class="drug-rule-info__row"><p class="dose">${cardData.dose}</p></div>
      <div class="drug-rule-info__row stock-row">재고: <span class="stock">${cardData.stock || 0}</span>정</div>
      <div class="drug-rule-info__row period">기간: ${cardData.startDate || "-"} ~ ${cardData.endDate || "-"}</div>
      <button class="take-btn">💊 복용</button>
    </div>
  `;

  grid.insertBefore(newCard, addBtn);

  // ✅ 복용 버튼 로직
  const takeBtn = newCard.querySelector(".take-btn");
  takeBtn.addEventListener("click", () => {
    let stock = parseInt(newCard.dataset.stock);
    const dose = parseInt(newCard.dataset.doseCount);

    if (stock >= dose) {
      stock -= dose;
      newCard.dataset.stock = stock;
      newCard.querySelector(".stock").innerText = stock;
      alert(`${dose}정을 복용했습니다. 남은 재고: ${stock}정`);
    } else {
      alert("⚠️ 재고가 부족합니다!");
    }
    saveCards();
  });

  // ✅ select 변경 시 색상 변경
  const select = newCard.querySelector(".drug-info__subtitle select");
  select.addEventListener("change", () => {
    const selected = select.value;

    if (!(selected in typeColors)) {
      // 사용자 정의 카테고리인 경우 → 보라색
      const customColor = { light: "#e6d6ff", deep: "#a86af2" };
      newCard.querySelector(".color-tool-red__lilight").style.background = customColor.light;
      newCard.querySelector(".color-tool-red__deep").style.background = customColor.deep;
    } else {
      const c = typeColors[selected];
      newCard.querySelector(".color-tool-red__lilight").style.background = c.light;
      newCard.querySelector(".color-tool-red__deep").style.background = c.deep;
    }

    saveCards();
  });

  // ✅ 삭제 버튼
  const deleteBtn = newCard.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    if (confirm("이 약을 삭제하시겠습니까?")) {
      newCard.remove();
      saveCards();
    }
  });

  if (save) saveCards();
}

// ✅ 약 추가 폼
function showAddForm() {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-bg";
  wrapper.innerHTML = `
    <div class="modal">
      <h3>💊 새 약 추가</h3>
      <label>약 이름 <input type="text" id="drugName" placeholder="예: 타이레놀"></label>
      <label>복용 카테고리
        <select id="drugType">
          <option>필수 복용</option>
          <option>기간제</option>
          <option>건강보조제</option>
          <option value="custom">직접 입력</option>
        </select>
        <input type="text" id="customCategory" placeholder="새 카테고리 이름" style="display:none; margin-top:6px;">
      </label>
      <label>복용 주기 <input type="text" id="drugRule" placeholder="예: 매일 2회, 월/수/금 3회"></label>
      <label>복용 시간 <input type="text" id="drugTimes" placeholder="쉼표로 구분 (예: 09:00, 18:00)"></label>
      <label>1회 복용량(정) <input type="number" id="doseCount" min="1"></label>
      <label>총 재고(정) <input type="number" id="drugStock" min="1"></label>
      <label>복용 기간 <input type="date" id="startDate"> ~ <input type="date" id="endDate"></label>
      <div class="btn-row">
        <button id="cancelBtn">취소</button>
        <button id="okBtn">추가</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const customCategoryInput = wrapper.querySelector("#customCategory");
  const typeSelect = wrapper.querySelector("#drugType");

  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === "custom") {
      customCategoryInput.style.display = "block";
    } else {
      customCategoryInput.style.display = "none";
    }
  });

  wrapper.querySelector("#cancelBtn").onclick = () => wrapper.remove();

  wrapper.querySelector("#okBtn").onclick = () => {
    const title = wrapper.querySelector("#drugName").value.trim();
    const baseType = wrapper.querySelector("#drugType").value;
    const customType = wrapper.querySelector("#customCategory").value.trim();
    const subtitle = baseType === "custom" && customType ? customType : baseType;

    const rule = wrapper.querySelector("#drugRule").value.trim() || "매일 1회";
    const times = wrapper.querySelector("#drugTimes").value.split(",").map(t => t.trim()).filter(t => t);
    const doseCount = parseInt(wrapper.querySelector("#doseCount").value);
    const stock = parseInt(wrapper.querySelector("#drugStock").value);
    const startDate = wrapper.querySelector("#startDate").value;
    const endDate = wrapper.querySelector("#endDate").value;

    if (!title) return alert("⚠️ 약 이름을 입력하세요!");
    if (times.length === 0) return alert("⚠️ 복용 시간을 입력하세요!");
    if (isNaN(doseCount) || doseCount <= 0) return alert("⚠️ 복용량을 입력하세요!");
    if (isNaN(stock) || stock <= 0) return alert("⚠️ 총 재고를 입력하세요!");
    if (startDate && endDate && startDate > endDate) return alert("⚠️ 종료일은 시작일보다 늦어야 합니다!");

    const newData = {
      title,
      subtitle,
      drugs: ["메모"],
      rule,
      time: times,
      next: `다음: ${times.join(", ")}`,
      dose: `${doseCount}정`,
      stock,
      doseCount,
      startDate,
      endDate
    };

    createCard(newData);
    wrapper.remove();
  };
}

// ✅ 추가 버튼 클릭 시
addBtn.addEventListener("click", showAddForm);

// ✅ 페이지 로드시 실행
loadCards();
