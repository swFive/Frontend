const grid = document.getElementById("medicationGrid");
const addBtn = document.getElementById("addDrugBtn");

// ✅ 복용 타입별 색상
const typeColors = {
  "필수 복용": { light: "#ffd0d0", deep: "#f28282" }, // 빨
  "기간제": { light: "#d0d0ff", deep: "#8282f2" }, // 파
  "건강보조제": { light: "#fff7b0", deep: "#ffe12e" } // 노
};

// ----------------------------------------------------
// 15분 지각 체크 유틸리티 함수 (새로 추가) 
// ----------------------------------------------------

/**
 * 복용 시간이 예정 시간보다 15분 이상 늦었는지 확인합니다.
 * @param {string} scheduledTime - 예정 시간 ("HH:MM" 형식)
 * @param {Date} actualTime - 복용 완료 시점의 실제 Date 객체
 * @returns {boolean} 지각 여부 (true/false)
 */
function isTimeLate(scheduledTime, actualTime) {
    if (!scheduledTime) return false;

    // 1. 예정 시간을 오늘 날짜의 Date 객체로 변환
    const [h, m] = scheduledTime.split(':').map(Number);
    const scheduledDate = new Date(actualTime.getFullYear(), actualTime.getMonth(), actualTime.getDate());
    scheduledDate.setHours(h, m, 0, 0); // 예정 시간으로 설정

    // 예정 시간이 아직 오지 않았으면 지각이 아님
    if (scheduledDate.getTime() > actualTime.getTime()) {
        return false;
    }

    // 2. 실제 복용 시간과 예정 시간의 차이 (밀리초) 계산
    const diffMs = actualTime.getTime() - scheduledDate.getTime();
    
    // 3. 15분(15 * 60 * 1000ms) 이상 차이 나는지 확인
    const fifteenMinutesMs = 15 * 60 * 1000;

    // 복용 완료 시점이 예정 시간보다 15분 이상 뒤라면 지각
    return diffMs >= fifteenMinutesMs;
}

// ✅ localStorage에서 카드 로드
function loadCards() {
  const data = JSON.parse(localStorage.getItem("medicationCards")) || [];
  data.forEach(card => createCard(card, false));

  if (typeof renderTodayMeds === 'function') {
    renderTodayMeds();
  }
  if (typeof updateSummaryCard === 'function') {
    updateSummaryCard();
  }
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
    endDate: card.dataset.endDate || "",
    dailyTimes: parseInt(card.dataset.dailyTimes) || 1, 
    takenCountToday: parseInt(card.dataset.takenCountToday) || 0,
    // ⭐ lateCountToday 속성 저장 추가 ⭐
    lateCountToday: parseInt(card.dataset.lateCountToday) || 0,
    lastTakenDate: card.dataset.lastTakenDate || ""
  }));
  localStorage.setItem("medicationCards", JSON.stringify(allCards));
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// ✅ 카드 생성
function createCard(cardData, save = true) {
  const newCard = document.createElement("div");
  newCard.classList.add("drug-card");

  // 데이터 로드 시 isTakenToday를 기본값(false)과 함께 초기화
  const isTakenToday = cardData.isTakenToday || false;

  // 사용자 정의 카테고리면 보라색 기본값
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
    let initialLateCount = cardData.lateCountToday || 0; // ⭐ 초기 지각 횟수 로드 ⭐
    
    // ⭐ 오늘 날짜와 마지막 복용 날짜가 다르면 복용/지각 횟수를 0으로 리셋 ⭐
    if (newCard.dataset.lastTakenDate !== todayString) {
        initialTakenCount = 0;
        initialLateCount = 0;
    }
    
    newCard.dataset.takenCountToday = initialTakenCount;
    newCard.dataset.lateCountToday = initialLateCount; // ⭐ 지각 횟수 데이터 속성 설정 ⭐
    
    let takenCount = initialTakenCount;
    const totalTimes = parseInt(newCard.dataset.dailyTimes);
    
    // ... (HTML 생성 로직) ...
    // 복용 버튼 텍스트를 현재 상태에 맞게 설정
    const takeBtnText = takenCount === totalTimes 
        ? "✅ 오늘 복용 완료" 
        : `💊 복용 (${takenCount}/${totalTimes} 완료)`;

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

  // 약 이름 수정 가능
makeEditable(
  newCard.querySelector(".drug-info__title p"),
  (val) => {}
);

// 메모 수정 가능
newCard.querySelectorAll(".drug-info__list p").forEach(p => {
  makeEditable(p, () => {});
});

// 복용 규칙 수정
makeEditable(
  newCard.querySelector(".rule"),
  (val) => {}
);

// 복용 시간 각각 수정
newCard.querySelectorAll(".time-item").forEach(timeEl => {
  makeEditable(timeEl, () => {});
});

// 복용량(정) 수정 — 숫자 모드
makeEditable(
  newCard.querySelector(".dose"),
  (val) => {
    newCard.dataset.doseCount = parseInt(val);
  },
  true
);

// 재고 수정 — 숫자 모드
makeEditable(
  newCard.querySelector(".stock"),
  (val) => {
    newCard.dataset.stock = parseInt(val);
  },
  true
);

  grid.insertBefore(newCard, addBtn);

  // ✅ 복용 버튼 로직
  const takeBtn = newCard.querySelector(".take-btn");
  takeBtn.addEventListener("click", () => {
    
    let stock = parseInt(newCard.dataset.stock);
    const dose = parseInt(newCard.dataset.doseCount);
    let takenCount = parseInt(newCard.dataset.takenCountToday); 
    let lateCount = parseInt(newCard.dataset.lateCountToday) || 0; // ⭐ 지각 횟수 로드 ⭐
    const totalTimes = parseInt(newCard.dataset.dailyTimes);     
    
    const drugName = newCard.querySelector(".drug-info__title p").innerText; // 약 이름 가져오기
    
    // ⭐ 현재 복용 예정 시간 슬롯 찾기 (단순화를 위해 takenCount를 인덱스로 사용) ⭐
    const scheduledTimes = [...newCard.querySelectorAll(".time-item")].map(p => p.innerText);
    // 아직 복용하지 않은 다음 슬롯의 예정 시간
    const currentScheduleTime = scheduledTimes[takenCount]; 
    const actualTime = new Date(); // 복용 완료를 누른 현재 시간

    // 1. 복용 횟수 체크
    if (takenCount >= totalTimes) {
        alert("오늘은 이미 모든 복용을 완료했습니다.");
        return;
    }

    // 2. ⭐ 지각 체크 로직 실행 ⭐
    const isLate = isTimeLate(currentScheduleTime, actualTime);
    let lateAlert = "";
    if (isLate) {
        lateCount += 1; // 지각 횟수 증가
        lateAlert = "\n⚠️ 이 복용은 15분 이상 늦어져 '지각'으로 기록됩니다.";
    }


    // 3. 복용 확인 대화 상자
    const confirmation = confirm(`[${drugName}] ${dose}정을 복용하시겠습니까? 복용을 완료하면 재고가 차감됩니다.${lateAlert}`);
    
    if (confirmation) {
        // '확인'을 눌렀을 때만 복용 처리 진행

        // 4. 재고 체크
        if (stock < dose) {
            alert("⚠️ 재고가 부족합니다! 재고를 확인해 주세요.");
            return;
        }

        // 5. 복용 처리 및 상태 업데이트
        stock -= dose;
        takenCount += 1; // 복용 횟수 1 증가
        newCard.dataset.lastTakenDate = getTodayDateString();
        
        // 데이터 속성 및 UI 업데이트
        newCard.dataset.stock = stock;
        newCard.querySelector(".stock").innerText = stock;
        newCard.dataset.takenCountToday = takenCount;
        newCard.dataset.lateCountToday = lateCount; // ⭐ 지각 횟수 업데이트 ⭐
        
        // 버튼 텍스트 업데이트 
        takeBtn.innerText = `💊 복용 (${takenCount}/${totalTimes} 완료)`;

        // 6. 최종 완료 여부
        if (takenCount === totalTimes) {
            takeBtn.innerText = "✅ 오늘 복용 완료";
        }

        alert(`✅ ${drugName} ${dose}정을 복용했습니다. 남은 재고: ${stock}정`);
        saveCards(); // 변경된 takenCountToday, lateCountToday 포함하여 저장
        if (typeof renderTodayMeds === 'function') {
            renderTodayMeds();
        }
        if (typeof updateSummaryCard === 'function') {
            updateSummaryCard();
        }

    } else {
        // '취소'를 눌렀을 때
        alert("복용 처리가 취소되었습니다.");
    }
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

    // 입력 확정 함수
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

      // 다시 수정 가능하게 이벤트 등록
      makeEditable(p, saveCallback, isNumber);
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish();
    });
  });
}

// 페이지 로드시 실행
loadCards();