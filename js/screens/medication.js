const grid = document.getElementById("medicationGrid");
const addBtn = document.getElementById("addDrugBtn");

const typeColors = {
  "필수 복용": { light: "#ffd0d0", deep: "#f28282" },
  "기간제": { light: "#d0d0ff", deep: "#8282f2" },
  "건강보조제": { light: "#fff7b0", deep: "#ffe12e" }
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function updateTakeButtonLabel(cardElement) {
  const takeBtn = cardElement.querySelector(".take-btn");
  if (!takeBtn) return;
  const taken = parseInt(cardElement.dataset.takenCountToday, 10) || 0;
  const total = parseInt(cardElement.dataset.dailyTimes, 10) || 1;
  if (taken >= total) {
    takeBtn.innerText = "✅ 오늘 복용 완료";
  } else {
    takeBtn.innerText = `💊 복용 (${taken}/${total} 완료)`;
  }
}

function ensureTodayState(cardElement) {
  if (cardElement.dataset.lastTakenDate !== getTodayDateString()) {
    cardElement.dataset.takenCountToday = "0";
  }
  updateTakeButtonLabel(cardElement);
}

function loadCards() {
  const data = JSON.parse(localStorage.getItem("medicationCards")) || [];
  data.forEach(card => createCard(card, false));
  if (typeof renderTodayMeds === "function") {
    renderTodayMeds();
  }
  if (typeof updateSummaryCard === "function") {
    updateSummaryCard();
  }
}

function saveCards() {
  const allCards = [...document.querySelectorAll(".drug-card")].map(card => ({
    title: card.querySelector(".drug-info__title p").innerText,
    subtitle: card.querySelector(".drug-info__subtitle select").value,
    drugs: [...card.querySelectorAll(".drug-info__list p")].map(p => p.innerText),
    rule: card.querySelector(".rule").innerText,
    time: [...card.querySelectorAll(".time-item")].map(p => p.innerText),
    next: card.querySelector(".next").innerText,
    dose: card.querySelector(".dose").innerText,
    stock: parseInt(card.dataset.stock, 10) || 0,
    doseCount: parseInt(card.dataset.doseCount, 10) || 1,
    startDate: card.dataset.startDate || "",
    endDate: card.dataset.endDate || "",
    takenCountToday: parseInt(card.dataset.takenCountToday, 10) || 0,
    dailyTimes: parseInt(card.dataset.dailyTimes, 10) || 1,
    lastTakenDate: card.dataset.lastTakenDate || ""
  }));
  localStorage.setItem("medicationCards", JSON.stringify(allCards));
}

function createCard(cardData, save = true) {
  if (!grid || !addBtn) return;
  const newCard = document.createElement("div");
  newCard.classList.add("drug-card");

  const color = typeColors[cardData.subtitle] || { light: "#e6d6ff", deep: "#a86af2" };
  const drugList = Array.isArray(cardData.drugs) && cardData.drugs.length ? cardData.drugs : ["메모"];
  const times = Array.isArray(cardData.time) ? cardData.time.filter(Boolean) : [cardData.time].filter(Boolean);
  const displayTimes = times.length ? times : ["-"];
  const derivedDailyTimes = parseInt(cardData.dailyTimes, 10) || displayTimes.length || 1;
  const stockValue = parseInt(cardData.stock, 10) || 0;
  const doseValue = parseInt(cardData.doseCount, 10) || 1;

  newCard.dataset.stock = String(stockValue);
  newCard.dataset.doseCount = String(doseValue);
  newCard.dataset.startDate = cardData.startDate || "";
  newCard.dataset.endDate = cardData.endDate || "";
  newCard.dataset.dailyTimes = String(derivedDailyTimes);
  newCard.dataset.takenCountToday = String(cardData.takenCountToday || 0);
  newCard.dataset.lastTakenDate = cardData.lastTakenDate || "";

  const timeHTML = displayTimes.map(t => `<p class="time-item">${t}</p>`).join("");

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
          <option ${cardData.subtitle === "필수 복용" ? "selected" : ""}>필수 복용</option>
          <option ${cardData.subtitle === "기간제" ? "selected" : ""}>기간제</option>
          <option ${cardData.subtitle === "건강보조제" ? "selected" : ""}>건강보조제</option>
          <option ${!(cardData.subtitle in typeColors) ? "selected" : ""}>${cardData.subtitle}</option>
        </select>
      </div>
      <div class="drug-info__list">
        <div>${drugList.map(d => `<p>${d}</p>`).join("")}</div>
      </div>
    </div>

    <div class="drug-rule-info">
      <div class="drug-rule-info__row"><p class="rule">${cardData.rule}</p></div>
      <div class="drug-rule-info__row time">${timeHTML}</div>
      <div class="drug-rule-info__row"><p class="next">${cardData.next}</p></div>
      <div class="drug-rule-info__row"><p class="dose">${cardData.dose}</p></div>
      <div class="drug-rule-info__row stock-row">재고: <span class="stock">${stockValue}</span>정</div>
      <div class="drug-rule-info__row period">기간: ${cardData.startDate || "-"} ~ ${cardData.endDate || "-"}</div>
      <button class="take-btn">💊 복용</button>
    </div>
  `;

  grid.insertBefore(newCard, addBtn);
  ensureTodayState(newCard);

  const takeBtn = newCard.querySelector(".take-btn");
  takeBtn.addEventListener("click", () => {
    let stock = parseInt(newCard.dataset.stock, 10) || 0;
    const dose = parseInt(newCard.dataset.doseCount, 10) || 1;
    const totalTimes = parseInt(newCard.dataset.dailyTimes, 10) || 1;
    let takenCount = parseInt(newCard.dataset.takenCountToday, 10) || 0;
    const drugName = newCard.querySelector(".drug-info__title p").innerText;

    if (takenCount >= totalTimes) {
      alert("오늘은 이미 모든 복용을 완료했습니다.");
      return;
    }

    const confirmation = confirm(`[${drugName}] ${dose}정을 복용하시겠습니까? 복용을 완료하면 재고가 차감됩니다.`);
    if (!confirmation) return;

    if (stock < dose) {
      alert("⚠️ 재고가 부족합니다! 재고를 확인해 주세요.");
      return;
    }

    stock -= dose;
    takenCount += 1;
    newCard.dataset.stock = String(stock);
    newCard.dataset.takenCountToday = String(takenCount);
    newCard.dataset.lastTakenDate = getTodayDateString();
    newCard.querySelector(".stock").innerText = stock;
    updateTakeButtonLabel(newCard);

    alert(`✅ ${drugName} ${dose}정을 복용했습니다. 남은 재고: ${stock}정`);
    saveCards();
    if (typeof renderTodayMeds === "function") {
      renderTodayMeds();
    }
    if (typeof updateSummaryCard === "function") {
      updateSummaryCard();
    }
  });

  const select = newCard.querySelector(".drug-info__subtitle select");
  select.addEventListener("change", () => {
    const selected = select.value;
    const colorSet = typeColors[selected] || { light: "#e6d6ff", deep: "#a86af2" };
    newCard.querySelector(".color-tool-red__lilight").style.background = colorSet.light;
    newCard.querySelector(".color-tool-red__deep").style.background = colorSet.deep;
    saveCards();
  });

  const deleteBtn = newCard.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    if (confirm("이 약을 삭제하시겠습니까?")) {
      newCard.remove();
      saveCards();
      if (typeof renderTodayMeds === "function") {
        renderTodayMeds();
      }
      if (typeof updateSummaryCard === "function") {
        updateSummaryCard();
      }
    }
  });

  if (save) saveCards();
}

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
      endDate,
      takenCountToday: 0,
      dailyTimes: times.length || 1,
      lastTakenDate: ""
    };

    createCard(newData);
    wrapper.remove();
  };
}
addBtn.addEventListener("click", showAddForm);

function makeEditable(element, saveCallback, isNumber = false) {
  element.addEventListener("click", () => {
    const oldValue = element.innerText.trim();
    const input = document.createElement("input");

    input.type = isNumber ? "number" : "text";
    input.value = isNumber ? parseInt(oldValue) || 0 : oldValue;

    input.style.width = "80px";
    input.style.fontSize = "14px";

    element.replaceWith(input);
    input.focus();

    const finish = () => {
      let newValue = input.value;

      if (isNumber) {
        newValue = parseInt(newValue);
        if (isNaN(newValue)) newValue = 0;
      }

      const p = document.createElement("p");
      p.className = element.className;
      p.innerText = newValue;

      input.replaceWith(p);

      saveCallback(newValue);
      saveCards();

      makeEditable(p, saveCallback, isNumber);
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish();
    });
  });
}

loadCards();
