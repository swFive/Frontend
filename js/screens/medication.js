// ----------------------------
// 🔹 DOM 요소 가져오기
// ----------------------------
const grid = document.getElementById("medicationGrid");  // 약 카드들이 들어가는 그리드
const addBtn = document.getElementById("addDrugBtn");    // 새 약 추가 버튼
const hasMedicationUI = Boolean(grid && addBtn);
const storageApi = window.MediStorage;

// ----------------------------
// 🔹 복용 타입별 색상 설정
// ----------------------------
const typeColors = {
  "필수 복용": { light: "#ffd0d0", deep: "#f28282" }, // 빨강 계열
  "기간제": { light: "#d0d0ff", deep: "#8282f2" },     // 파랑 계열
  "건강보조제": { light: "#fff7b0", deep: "#ffe12e" }  // 노랑 계열
};

// ==================================================
// 🔹 15분 지각 체크 유틸리티 함수
// ==================================================
/**
 * 예정 시간과 실제 복용 시간을 비교하여 15분 이상 늦었는지 판단
 * @param {string} scheduledTime - 예정 시간 ("HH:MM")
 * @param {Date} actualTime - 복용 완료 시점 Date 객체
 * @returns {boolean} 지각 여부
 */
function isTimeLate(scheduledTime, actualTime) {
  if (!scheduledTime) return false;

  const [h, m] = scheduledTime.split(':').map(Number);
  const scheduledDate = new Date(actualTime.getFullYear(), actualTime.getMonth(), actualTime.getDate());
  scheduledDate.setHours(h, m, 0, 0);

  if (scheduledDate.getTime() > actualTime.getTime()) {
    return false; // 예정 시간이 아직 안 됨
  }

  const diffMs = actualTime.getTime() - scheduledDate.getTime();
  const fifteenMinutesMs = 15 * 60 * 1000;

  return diffMs >= fifteenMinutesMs;
}

// ==================================================
// 🔹 localStorage에서 카드 로드/저장
// ==================================================
function loadCards() {
  if (!hasMedicationUI) return;
  const data = storageApi?.getMedicationCards?.() || JSON.parse(localStorage.getItem("medicationCards")) || [];
  data.forEach(card => createCard(card, false));

  // 선택적 UI 업데이트 함수 호출
  if (typeof renderTodayMeds === 'function') renderTodayMeds();
  if (typeof updateSummaryCard === 'function') updateSummaryCard();
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
    stock: parseInt(card.querySelector(".stock").innerText.replace("정", "").trim(), 10),
    doseCount: card.dataset.doseCount || "1",
    startDate: card.dataset.startDate || "",
    endDate: card.dataset.endDate || "",
    dailyTimes: parseInt(card.dataset.dailyTimes) || 1,
    takenCountToday: parseInt(card.dataset.takenCountToday) || 0,
    lateCountToday: parseInt(card.dataset.lateCountToday) || 0, // 지각 횟수
    lastTakenDate: card.dataset.lastTakenDate || ""
  }));
  if (storageApi?.saveMedicationCards) {
    storageApi.saveMedicationCards(allCards);
  } else {
    localStorage.setItem("medicationCards", JSON.stringify(allCards));
  }
}

// 오늘 날짜 문자열 → MediCommon 사용
const getTodayDateString = () => (window.MediCommon?.getTodayDateString) ? window.MediCommon.getTodayDateString() : new Date().toISOString().split('T')[0];

// ==================================================
// 🔹 카드 생성 함수
// ==================================================
function createCard(cardData, save = true) {
  const newCard = document.createElement("div");
  newCard.classList.add("drug-card");

  const isTakenToday = cardData.isTakenToday || false;
  const color = typeColors[cardData.subtitle] || { light: "#e6d6ff", deep: "#a86af2" };

  newCard.dataset.stock = cardData.stock || 0;
  newCard.dataset.doseCount = cardData.doseCount || 1;
  newCard.dataset.startDate = cardData.startDate || "";
  newCard.dataset.endDate = cardData.endDate || "";
  newCard.dataset.isTakenToday = isTakenToday;

  const timeHTML = Array.isArray(cardData.time)
    ? cardData.time.map(t => `<p class="time-item">${t}</p>`).join("")
    : `<p class="time-item">${cardData.time}</p>`;

  const dailyTimes = Array.isArray(cardData.time) ? cardData.time.length : 1;
  newCard.dataset.dailyTimes = dailyTimes;
  newCard.dataset.lastTakenDate = cardData.lastTakenDate || "";

  const todayString = getTodayDateString();
  let initialTakenCount = cardData.takenCountToday || 0;
  let initialLateCount = cardData.lateCountToday || 0;

  if (newCard.dataset.lastTakenDate !== todayString) {
    initialTakenCount = 0;
    initialLateCount = 0;
  }

  newCard.dataset.takenCountToday = initialTakenCount;
  newCard.dataset.lateCountToday = initialLateCount;

  let takenCount = initialTakenCount;
  const totalTimes = parseInt(newCard.dataset.dailyTimes);

  const takeBtnText = takenCount === totalTimes
      ? "✅ 오늘 복용 완료"
      : `💊 복용 (${takenCount}/${totalTimes} 완료)`;

  // ----------------------------
  // 🔹 카드 HTML 구성
  // ----------------------------
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
      <div class="drug-rule-info__row"><p class="dose">${cardData.dose}</p>정</div>
      <div class="drug-rule-info__row stock-row">재고: <span class="stock">${cardData.stock || 0}</span>정</div>
      <div class="drug-rule-info__row period">기간: ${cardData.startDate || "-"} ~ ${cardData.endDate || "-"}</div>
      <button class="take-btn">${takeBtnText}</button>
    </div>
  `;

  // ----------------------------
  // 🔹 편집 가능 기능
  // ----------------------------
  makeEditable(newCard.querySelector(".drug-info__title p"), val => {});
  newCard.querySelectorAll(".drug-info__list p").forEach(p => makeEditable(p, () => {}));
  makeEditable(newCard.querySelector(".rule"), val => {});
  newCard.querySelectorAll(".time-item").forEach(t => makeEditable(t, () => {}));
  makeEditable(newCard.querySelector(".dose"), val => { newCard.dataset.doseCount = parseInt(val); }, true);
  makeEditable(newCard.querySelector(".stock"), val => { newCard.dataset.stock = parseInt(val); }, true);

  const infoArea = newCard.querySelector(".drug-info");
  if (infoArea) {
    infoArea.addEventListener("click", (event) => {
      if (event.target.closest("select")) return;
      showStockEditor(newCard);
    });
  }

  const takeBtn = newCard.querySelector(".take-btn");
  takeBtn.addEventListener("click", () => {
    let stock = parseInt(newCard.dataset.stock);
    const dose = parseInt(newCard.dataset.doseCount);
    let takenCount = parseInt(newCard.dataset.takenCountToday);
    let lateCount = parseInt(newCard.dataset.lateCountToday) || 0;
    const totalTimes = parseInt(newCard.dataset.dailyTimes);
    const drugName = newCard.querySelector(".drug-info__title p").innerText;

    const scheduledTimes = [...newCard.querySelectorAll(".time-item")].map(p => p.innerText);
    const currentScheduleTime = scheduledTimes[takenCount];
    const actualTime = new Date();

    if (takenCount >= totalTimes) return alert("오늘은 이미 모든 복용을 완료했습니다.");

    const isLate = isTimeLate(currentScheduleTime, actualTime);
    let lateAlert = "";
    if (isLate) {
      lateCount += 1;
      lateAlert = "\n⚠️ 이 복용은 15분 이상 늦어져 '지각'으로 기록됩니다.";
    }

    const confirmation = confirm(`[${drugName}] ${dose}정을 복용하시겠습니까? 복용 완료 시 재고가 차감됩니다.${lateAlert}`);
    if (!confirmation) return alert("복용 처리가 취소되었습니다.");

    if (stock < dose) return alert("⚠️ 재고가 부족합니다! 재고를 확인해 주세요.");

    stock -= dose;
    takenCount += 1;
    newCard.dataset.lastTakenDate = getTodayDateString();
    newCard.dataset.stock = stock;
    newCard.querySelector(".stock").innerText = stock;
    newCard.dataset.takenCountToday = takenCount;
    newCard.dataset.lateCountToday = lateCount;

    takeBtn.innerText = takenCount === totalTimes ? "✅ 오늘 복용 완료" : `💊 복용 (${takenCount}/${totalTimes} 완료)`;

    alert(`✅ ${drugName} ${dose}정을 복용했습니다. 남은 재고: ${stock}정`);
    saveCards();
    if (typeof renderTodayMeds === 'function') renderTodayMeds();
    if (typeof updateSummaryCard === 'function') updateSummaryCard();
  });

  // ----------------------------
  // 🔹 카테고리 변경 시 색상 변경
  // ----------------------------
  const select = newCard.querySelector(".drug-info__subtitle select");
  select.addEventListener("change", () => {
    const selected = select.value;
    if (!(selected in typeColors)) {
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

  // ----------------------------
  // 🔹 삭제 버튼
  // ----------------------------
  const deleteBtn = newCard.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", () => {
    if (confirm("이 약을 삭제하시겠습니까?")) {
      newCard.remove();
      saveCards();
    }
  });

  // 새 카드를 실제 그리드에 꽂아 Add 카드 앞에 노출
  if (grid && addBtn) {
    grid.insertBefore(newCard, addBtn);
  }

  if (save) saveCards();
}

// ==================================================
// 🔹 새 약 추가 모달 함수
// ==================================================
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
    customCategoryInput.style.display = typeSelect.value === "custom" ? "block" : "none";
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

if (hasMedicationUI) {
  addBtn.addEventListener("click", showAddForm);
}

function showStockEditor(cardElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-bg";
  const name = cardElement.querySelector(".drug-info__title p")?.innerText || "-";
  const currentStock = parseInt(cardElement.dataset.stock, 10) || 0;

  wrapper.innerHTML = `
    <div class="modal">
      <h3>${name} 재고 조정</h3>
      <label>현재 재고(정)
        <input type="number" id="editStock" min="0" value="${currentStock}">
      </label>
      <p style="font-size:12px; color:#666; margin:4px 0 12px;">재고 변경 사항은 즉시 저장됩니다.</p>
      <div class="btn-row">
        <button id="editCancel">취소</button>
        <button id="editSave">저장</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);
  const stockInput = wrapper.querySelector("#editStock");

  const close = () => wrapper.remove();
  wrapper.querySelector("#editCancel").onclick = close;

  wrapper.querySelector("#editSave").onclick = () => {
    const newStock = parseInt(stockInput.value, 10);

    if (!Number.isFinite(newStock) || newStock < 0) {
      alert("재고는 0 이상의 숫자로 입력해주세요.");
      return;
    }

    cardElement.dataset.stock = String(newStock);
    const stockLabel = cardElement.querySelector(".stock");
    if (stockLabel) stockLabel.innerText = newStock;
    saveCards();
    close();
  };
}

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
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(); });
  });
}

// ==================================================
// 🔹 페이지 로드 시 카드 로드
// ==================================================
if (hasMedicationUI) {
  loadCards();
} else {
  console.debug("[medication] Medication UI not present, skipping card rendering.");
}
