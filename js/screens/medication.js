// ----------------------------
// 🔹 설정 및 공통 변수
// ----------------------------
const grid = document.getElementById("medicationGrid");
const addBtn = document.getElementById("addDrugBtn");
const hasMedicationUI = Boolean(grid && addBtn);

// API 기본 URL
const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined')
    ? window.API_BASE_URL
    : "http://localhost:8080";

// ----------------------------
// 🔹 복용 타입별 색상 설정
// ----------------------------
const defaultTypeColors = {
    "필수 복용": { light: "#ffd0d0", deep: "#f28282" },
    "기간제": { light: "#d0d0ff", deep: "#8282f2" },
    "건강보조제": { light: "#fff7b0", deep: "#ffe12e" }
};

// 사용자 정의 카테고리 불러오기
function loadCustomCategories() {
    try {
        const saved = localStorage.getItem("mc_custom_categories");
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        return {};
    }
}

// 사용자 정의 카테고리 저장
function saveCustomCategories(categories) {
    localStorage.setItem("mc_custom_categories", JSON.stringify(categories));
}

// 기본 + 사용자 정의 카테고리 합치기
function getTypeColors() {
    return { ...defaultTypeColors, ...loadCustomCategories() };
}

// 전역 참조용 (기존 코드 호환)
let typeColors = getTypeColors();

// ----------------------------
// 🔹 유틸리티: 토큰 가져오기
// ----------------------------
function getAuthHeaders() {
    const token = localStorage.getItem("mc_token");
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

// [알림] - userId 헬퍼 추가. 현재 로그인한 사용자ID 조회
function getCurrentUserId() {
    try {
        const raw = localStorage.getItem("mc_user");
        if (!raw) return null;
        const user = JSON.parse(raw);
        return user.id || user.userId || null;
    } catch (e) {
        console.warn("mc_user 파싱 실패:", e);
        return null;
    }
}

// ==================================================
// 🔹 [R] API에서 약 목록 불러오기 (GET)
// ==================================================
async function loadCards() {
    if (!hasMedicationUI) return;

    const token = localStorage.getItem("mc_token");
    if (!token) {
        console.warn("로그인 토큰이 없습니다.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/mediinfo/medicines`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error(`로드 실패: ${response.status}`);

        const data = await response.json();

        const existingCards = grid.querySelectorAll('.drug-card');
        existingCards.forEach(card => card.remove());

        if (Array.isArray(data) && data.length > 0) {
            // 모든 스케줄을 수집해서 시간순으로 정렬
            const allScheduleCards = [];
            
            data.forEach(item => {
                const schedules = item.schedulesWithLogs || [];
                
                // 스케줄이 없으면 약 자체를 하나의 카드로
                if (schedules.length === 0) {
                    allScheduleCards.push({
                        medicationData: item,
                        schedule: null,
                        intakeTime: "00:00"
                    });
                    return;
                }
                
                // 각 스케줄마다 별도의 카드 생성
                schedules.forEach(schedule => {
                    allScheduleCards.push({
                        medicationData: item,
                        schedule: schedule,
                        intakeTime: schedule.intakeTime ? schedule.intakeTime.substring(0, 5) : "00:00"
                    });
                });
            });
            
            // 시간순 정렬
            allScheduleCards.sort((a, b) => a.intakeTime.localeCompare(b.intakeTime));
            
            // 카드 생성
            allScheduleCards.forEach(({ medicationData, schedule }) => {
                const item = medicationData;
                const sch = schedule || {};
                
                // 현재 스케줄의 복용/건너뜀 여부
                const isTaken = sch.logId && (sch.intakeStatus === 'TAKEN' || sch.intakeStatus === 'LATE');
                const isSkipped = sch.logId && sch.intakeStatus === 'SKIPPED';
                const isLate = sch.logId && sch.intakeStatus === 'LATE';
                
                const cardData = {
                    id: item.medicationId,
                    scheduleId: sch.scheduleId || null,  // 스케줄 ID 추가
                    title: item.name,
                    subtitle: item.category,
                    drugs: [item.memo || ""],
                    rule: sch.frequency || "매일",
                    time: sch.intakeTime ? [sch.intakeTime.substring(0, 5)] : [],
                    next: sch.intakeTime ? sch.intakeTime.substring(0, 5) : "-",
                    dose: item.doseUnitQuantity || 1,
                    stock: item.currentQuantity || 0,
                    doseCount: item.doseUnitQuantity || 1,
                    startDate: sch.startDate || "",
                    endDate: sch.endDate || "",
                    dailyTimes: 1,
                    takenCountToday: isTaken ? 1 : 0,
                    isSkipped: isSkipped,  // 건너뜀 상태 추가
                    isLate: isLate,  // 지각 상태 추가
                    nextScheduleId: sch.scheduleId || null,
                    lastLogId: sch.logId || null,
                    refillThreshold: 5,
                    schedules: [{
                        scheduleId: sch.scheduleId,
                        intakeTime: sch.intakeTime ? sch.intakeTime.substring(0, 5) : "",
                        frequency: sch.frequency || "매일",
                        startDate: sch.startDate || "",
                        endDate: sch.endDate || ""
                    }]
                };

                createCard(cardData);
            });
        }

        if (typeof renderTodayMeds === 'function') renderTodayMeds();
        if (typeof updateSummaryCard === 'function') updateSummaryCard();

    } catch (error) {
        console.error("약 목록 로드 중 오류:", error);
    }
}

// ==================================================
// 🔹 [알림] 복용 기록 생성 (POST /api/intake-logs)
// 지원 상태: TAKEN, LATE(지각), SKIPPED(건너뛰기)
// ==================================================
async function recordIntake(scheduleId, status = "TAKEN", lateMinutes = null) {
    const userId = getCurrentUserId();
    if (!userId) {
        if (window.showToast) {
            window.showToast("로그인 정보가 없습니다. 다시 로그인해 주세요.", { type: "error" });
        } else {
            alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
        }
        return false;
    }

    const payload = {
        scheduleId,
        userId,
        intakeStatus: status
    };

    // 지각일 때만 lateMinutes 전송
    if (status === "LATE" && typeof lateMinutes === "number") {
        payload.lateMinutes = lateMinutes;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/intake-logs`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.status === 400) {
            window.showToast?.("입력값을 다시 확인해 주세요.", { type: "error" }) || alert("입력값을 다시 확인해 주세요.");
            return false;
        }
        if (response.status === 409) {
            window.showToast?.("이미 처리된 일정이거나 잘못된 요청입니다.", { type: "error" }) || alert("이미 처리된 일정이거나 잘못된 요청입니다.");
            return false;
        }
        if (!response.ok) {
            window.showToast?.("복용 기록 저장 중 오류가 발생했습니다.", { type: "error" }) || alert("복용 기록 저장 중 오류가 발생했습니다.");
            return false;
        }

        // 201 + log 객체가 오지만, 현재 UI에서는 값이 필요 없으므로 버림
        return true;
    } catch (e) {
        console.error("intake-logs 호출 중 오류:", e);
        window.showToast?.("네트워크 오류로 복용 기록을 저장하지 못했습니다.", { type: "error" }) || alert("네트워크 오류로 복용 기록을 저장하지 못했습니다.");
        return false;
    }
}


// ==================================================
// 🔹 [알림] 복용 기록 삭제 (DELETE /api/logs/{logId})
// ==================================================
async function deleteIntakeLog(logId) {
    if (!logId) {
        console.error("deleteIntakeLog: logId가 없습니다.");
        return false;
    }

    try {
        console.log(`[복용취소] DELETE /api/logs/${logId}`);
        
        const response = await fetch(`${API_BASE_URL}/api/logs/${logId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        console.log(`[복용취소] 응답 상태: ${response.status}`);

        if (response.status === 204 || response.ok) {
            // 204 No Content = 성공
            console.log("[복용취소] 삭제 성공");
            return true;
        }

        if (response.status === 404) {
            window.showToast?.("삭제할 기록을 찾을 수 없습니다.", { type: "error" }) || alert("삭제할 기록을 찾을 수 없습니다.");
            return false;
        }

        const errorText = await response.text().catch(() => '');
        console.error("[복용취소] 삭제 실패:", response.status, errorText);
        window.showToast?.("복용 기록 삭제에 실패했습니다.", { type: "error" }) || alert("복용 기록 삭제에 실패했습니다.");
        return false;
    } catch (e) {
        console.error("deleteIntakeLog 호출 중 오류:", e);
        window.showToast?.("네트워크 오류로 복용 기록을 삭제하지 못했습니다.", { type: "error" }) || alert("네트워크 오류로 복용 기록을 삭제하지 못했습니다.");
        return false;
    }
}


// ==================================================
// 🔹 카드 생성 및 DOM 삽입
// ==================================================
function createCard(cardData) {
    const newCard = document.createElement("div");
    newCard.classList.add("drug-card");

    newCard.dataset.id = cardData.id;
    newCard.dataset.scheduleId = cardData.scheduleId || "";  // 개별 스케줄 ID
    newCard.dataset.stock = cardData.stock;
    newCard.dataset.doseCount = cardData.doseCount;
    newCard.dataset.nextScheduleId = cardData.nextScheduleId || "";
    newCard.dataset.lastLogId = cardData.lastLogId || "";
    newCard.dataset.category = cardData.subtitle;
    newCard.dataset.memo = cardData.drugs[0];
    newCard.dataset.refillThreshold = cardData.refillThreshold;
    newCard.dataset.takenCount = cardData.takenCountToday;
    newCard.dataset.totalTimes = cardData.dailyTimes;
    newCard.dataset.schedules = JSON.stringify(cardData.schedules || []);  // 스케줄 정보 저장

    const color = typeColors[cardData.subtitle] || { light: "#e6d6ff", deep: "#a86af2" };
    const timeHTML = cardData.time.map(t => `<p class="time-item">${t}</p>`).join("");

    const takenCount = parseInt(cardData.takenCountToday);
    const totalTimes = parseInt(cardData.dailyTimes);
    const isDone = takenCount >= totalTimes && totalTimes > 0;
    const hasAnyTaken = takenCount > 0;
    const isSkipped = cardData.isSkipped || false;
    const isLate = cardData.isLate || false;
    
    // 상태에 따른 표시 텍스트
    let statusText = `${takenCount}/${totalTimes} 복용`;
    let statusClass = "";
    if (isSkipped) {
        statusText = "⏭ 건너뜀";
        statusClass = "skipped";
    } else if (isDone) {
        statusText = isLate ? "⏰ 지각 복용" : "✅ 완료";
        statusClass = isDone ? "done" : "";
    }
    
    // 건너뜀 상태면 버튼 모두 비활성화
    const buttonsDisabled = isDone || isSkipped;
    const hasCancelable = hasAnyTaken || isSkipped;

    newCard.innerHTML = `
    <div class="color-tool-red">
      <div class="color-tool-red__lilight" style="background:${color.light}"></div>
      <div class="color-tool-red__deep" style="background:${color.deep}"></div>
    </div>

    <button class="delete-btn" title="약 삭제">×</button>

    <div class="drug-info">
      <div class="drug-info__title"><p>${cardData.title}</p></div>
      <div class="drug-info__subtitle editable-category" title="클릭하여 카테고리 수정">
        <p class="category-text">${cardData.subtitle || "필수 복용"}</p>
      </div>
      <div class="drug-info__list">
        <div><p>${cardData.drugs[0] || "메모 없음"}</p></div>
      </div>
    </div>

    <div class="drug-rule-info">
      <div class="drug-rule-info__row editable-row" data-field="rule" title="클릭하여 수정"><p class="rule">${cardData.rule}</p></div>
      <div class="drug-rule-info__row time editable-row" data-field="time" title="클릭하여 수정">${timeHTML}</div>
      <div class="drug-rule-info__row editable-row" data-field="dose" title="클릭하여 수정"><p class="dose">${cardData.dose}</p>정</div>
      <div class="drug-rule-info__row stock-row editable-row" data-field="stock" title="클릭하여 수정">재고: <span class="stock">${cardData.stock}</span>정</div>
      <div class="drug-rule-info__row period editable-row" data-field="period" title="클릭하여 수정">기간: <span class="start-date">${cardData.startDate}</span> ~ <span class="end-date">${cardData.endDate}</span></div>
      <div class="drug-rule-info__row intake-status ${statusClass}">
        <span class="intake-progress">${statusText}</span>
      </div>
      <div class="drug-btn-group">
        <button class="take-btn ${buttonsDisabled ? 'disabled' : ''}" ${buttonsDisabled ? 'disabled' : ''}>💊 복용</button>
        <button class="late-btn ${buttonsDisabled ? 'disabled' : ''}" ${buttonsDisabled ? 'disabled' : ''}>⏰ 지각</button>
        <button class="skip-btn ${buttonsDisabled ? 'disabled' : ''}" ${buttonsDisabled ? 'disabled' : ''}>⏭ 건너뛰기</button>
        <button class="cancel-btn ${!hasCancelable ? 'disabled' : ''}" ${!hasCancelable ? 'disabled' : ''}>↩ 취소</button>
      </div>
    </div>
  `;

    // --- 이벤트 ---

    newCard.querySelector(".delete-btn").addEventListener("click", () => {
        const scheduleId = cardData.scheduleId || null;
        deleteMedication(cardData.id, newCard, scheduleId);
    });

    // drug-info 영역 클릭 이벤트 제거 (개별 필드에서 처리)

    // 🟢 복용 버튼 로직
    const takeBtn = newCard.querySelector("button.take-btn");
    takeBtn.addEventListener("click", async () => {
        if (takeBtn.disabled) return;
        
        const dose = parseInt(newCard.dataset.doseCount);
        let currentStock = parseInt(newCard.dataset.stock);
        const targetScheduleId = newCard.dataset.nextScheduleId;
        
        if (!targetScheduleId) {
            return alert("오늘 예정된 일정이 없습니다.");
        }

        if (currentStock < dose) {
            return alert("⚠️ 재고가 부족합니다!");
        }

        // 버튼 비활성화 (중복 클릭 방지)
        takeBtn.disabled = true;
        takeBtn.textContent = "처리중...";

        // 복용 기록 생성 -> DB 트리거가 재고 차감 수행
        const logRecorded = await recordIntake(targetScheduleId);

        if (logRecorded) {
            showToastIfAvailable("복용이 기록되었습니다.", "success");
            
            // 재고 부족 확인 (복용 후 재고)
            const newStock = currentStock - dose;
            const threshold = parseInt(newCard.dataset.refillThreshold) || 5;
            const medName = newCard.querySelector('.title-1')?.textContent || '약';
            
            // MediNotification이 있으면 재고 부족 알림 표시
            if (typeof MediNotification !== 'undefined' && MediNotification.stockWarning) {
                MediNotification.stockWarning(medName, newStock, threshold);
            }
            
            window.location.reload();
        } else {
            alert("기록 실패");
            takeBtn.disabled = false;
            takeBtn.textContent = "💊 복용";
        }
    });

    // 🔴 복용 취소 버튼 로직
    const cancelBtn = newCard.querySelector("button.cancel-btn");
    cancelBtn.addEventListener("click", async () => {
        if (cancelBtn.disabled) return;
        
        const logId = newCard.dataset.lastLogId;
        if (!logId) {
            return alert("취소할 복용 기록이 없습니다.");
        }

        // 건너뛰기 상태인지 확인
        const progressText = newCard.querySelector(".intake-progress")?.textContent || "";
        const wasSkipped = progressText.includes("건너뜀");
        
        const confirmMsg = wasSkipped 
            ? "건너뛰기를 취소하시겠습니까?" 
            : "마지막 복용 기록을 취소하시겠습니까?\n(재고가 복구됩니다)";
        
        if (!confirm(confirmMsg)) {
            return;
        }

        // 버튼 비활성화 (중복 클릭 방지)
        cancelBtn.disabled = true;
        cancelBtn.textContent = "처리중...";

        const dose = parseInt(newCard.dataset.doseCount);
        let currentStock = parseInt(newCard.dataset.stock);

        // 1. 로그 삭제
        const deleted = await deleteIntakeLog(logId);
        if (deleted) {
            // 2. 재고 복구 (건너뛰기가 아닌 경우에만)
            if (!wasSkipped) {
                const newStock = currentStock + dose;
                await updateMedicationData(newCard, { currentQuantity: newStock });
            }

            const toastMsg = wasSkipped ? "건너뛰기가 취소되었습니다." : "복용이 취소되었습니다.";
            showToastIfAvailable(toastMsg, "info");
            window.location.reload();
        } else {
            alert("취소 실패");
            cancelBtn.disabled = false;
            cancelBtn.textContent = "↩ 취소";
        }
    });

    // 🟡 지각 복용 버튼 로직
    const lateBtn = newCard.querySelector("button.late-btn");
    lateBtn.addEventListener("click", async () => {
        if (lateBtn.disabled) return;
        
        const dose = parseInt(newCard.dataset.doseCount);
        let currentStock = parseInt(newCard.dataset.stock);
        const targetScheduleId = newCard.dataset.nextScheduleId;
        
        if (!targetScheduleId) {
            return alert("오늘 예정된 일정이 없습니다.");
        }

        if (currentStock < dose) {
            return alert("⚠️ 재고가 부족합니다!");
        }

        // 지각 시간(분) 입력 받기
        const lateMinutesStr = prompt("몇 분 지각하셨나요?", "10");
        if (lateMinutesStr === null) return; // 취소 버튼 클릭
        
        const lateMinutes = parseInt(lateMinutesStr);
        if (isNaN(lateMinutes) || lateMinutes < 0) {
            return alert("올바른 지각 시간(분)을 입력해주세요.");
        }

        // 버튼 비활성화 (중복 클릭 방지)
        lateBtn.disabled = true;
        lateBtn.textContent = "처리중...";

        // 지각 복용 기록 생성
        const logRecorded = await recordIntake(targetScheduleId, "LATE", lateMinutes);

        if (logRecorded) {
            showToastIfAvailable(`지각 복용이 기록되었습니다. (${lateMinutes}분 지연)`, "warning");
            
            // 재고 부족 확인 (복용 후 재고)
            const newStock = currentStock - dose;
            const threshold = parseInt(newCard.dataset.refillThreshold) || 5;
            const medName = newCard.querySelector('.title-1')?.textContent || '약';
            
            // MediNotification이 있으면 재고 부족 알림 표시
            if (typeof MediNotification !== 'undefined' && MediNotification.stockWarning) {
                MediNotification.stockWarning(medName, newStock, threshold);
            }
            
            window.location.reload();
        } else {
            alert("기록 실패");
            lateBtn.disabled = false;
            lateBtn.textContent = "⏰ 지각";
        }
    });

    // ⏭ 건너뛰기 버튼 로직
    const skipBtn = newCard.querySelector("button.skip-btn");
    skipBtn.addEventListener("click", async () => {
        if (skipBtn.disabled) return;
        
        const targetScheduleId = newCard.dataset.nextScheduleId;
        
        if (!targetScheduleId) {
            return alert("오늘 예정된 일정이 없습니다.");
        }

        if (!confirm("이 복용을 건너뛰시겠습니까?\n(재고는 차감되지 않습니다)")) {
            return;
        }

        // 버튼 비활성화 (중복 클릭 방지)
        skipBtn.disabled = true;
        skipBtn.textContent = "처리중...";

        // 건너뛰기 기록 생성 (SKIPPED 상태, 재고 차감 안 함)
        const logRecorded = await recordIntake(targetScheduleId, "SKIPPED");

        if (logRecorded) {
            showToastIfAvailable("복용을 건너뛰었습니다.", "info");
            window.location.reload();
        } else {
            alert("기록 실패");
            skipBtn.disabled = false;
            skipBtn.textContent = "⏭ 건너뛰기";
        }
    });

    // 기타 수정 리스너
    const categoryEl = newCard.querySelector(".editable-category");
    categoryEl.style.cursor = "pointer";
    categoryEl.addEventListener("click", () => showCategoryEditor(newCard, cardData));
    
    makeEditable(newCard.querySelector(".drug-info__title p"), newCard, "name");
    makeEditable(newCard.querySelector(".drug-info__list p"), newCard, "memo");

    // drug-rule-info__row 클릭 수정 이벤트
    newCard.querySelectorAll(".editable-row").forEach(row => {
        row.style.cursor = "pointer";
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            const field = row.dataset.field;
            showFieldEditor(newCard, cardData, field);
        });
    });

    if (grid && addBtn) grid.insertBefore(newCard, addBtn);
}

// 토스트 메시지 (있으면 사용)
function showToastIfAvailable(message, type = "success") {
    if (window.showToast && typeof window.showToast === "function") {
        window.showToast(message, { type, duration: 2500 });
    }
}

// ... (이하 showAddForm, updateMedicationData, deleteMedication 등은 기존과 동일) ...

// ==================================================
// 🔹 [C] 약 등록 (POST)
// ==================================================
function showAddForm() {
    // 카테고리 옵션 동적 생성
    typeColors = getTypeColors();
    const categoryOptions = Object.keys(typeColors)
        .map(name => `<option value="${name}">${name}</option>`)
        .join("");
    
    // 기존 약 목록 수집 (중복 제거)
    const existingMeds = {};
    document.querySelectorAll(".drug-card").forEach(card => {
        const medId = card.dataset.id;
        if (!existingMeds[medId]) {
            const times = [];
            document.querySelectorAll(`.drug-card[data-id="${medId}"] .time-item`).forEach(t => {
                const timeStr = t.innerText.trim();
                if (timeStr && !times.includes(timeStr)) times.push(timeStr);
            });
            
            existingMeds[medId] = {
                id: medId,
                name: card.querySelector(".drug-info__title p")?.innerText || "",
                category: card.dataset.category || "필수 복용",
                days: card.querySelector(".rule")?.innerText || "매일",
                times: times.join(", "),
                doseCount: card.dataset.doseCount || "1",
                stock: card.dataset.stock || "30",
                memo: card.querySelector(".drug-info__list p")?.innerText || "",
                startDate: card.querySelector(".start-date")?.innerText || "",
                endDate: card.querySelector(".end-date")?.innerText || ""
            };
        }
    });
    const existingMedsList = Object.values(existingMeds);
    
    // 기존 약 텍스트 목록 HTML
    let existingMedsText = "";
    if (existingMedsList.length > 0) {
        existingMedsText = `
        <div id="existingMedsSection" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; align-items: center;">
            ${existingMedsList.map(med => `
                <span class="existing-med-text" data-med='${JSON.stringify(med).replace(/'/g, "&#39;")}'
                    style="padding: 4px 10px; background: #f0f7ff; color: #4c82ff; 
                    border-radius: 12px; font-size: 13px; cursor: pointer;
                    border: 1px solid #4c82ff; transition: all 0.2s;">
                    ${med.name}
                </span>
            `).join("")}
        </div>`;
    }
    
    const wrapper = document.createElement("div");
    wrapper.className = "modal-bg";
    wrapper.innerHTML = `
    <div class="modal" style="max-height: 90vh; overflow-y: auto;">
      <h3>💊 새 약 추가</h3>
      <label>약 이름 <input type="text" id="drugName" placeholder="예: 타이레놀"></label>
      ${existingMedsText}
      <label>카테고리 
        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="drugType" style="flex: 1;">${categoryOptions}</select>
          <button type="button" id="addCategoryBtnInForm" 
            style="padding: 8px 12px; background: #4c82ff; color: white; border: none; 
            border-radius: 6px; cursor: pointer; font-size: 14px; white-space: nowrap;">+ 추가</button>
        </div>
      </label>
      
      <!-- 카테고리 추가 영역 (기본 숨김) -->
      <div id="newCategorySection" style="display: none; background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
        <p style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">➕ 새 카테고리</p>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="newCatName" placeholder="카테고리 이름" 
            style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
          <input type="color" id="newCatColor" value="#82c8f2" 
            style="width: 36px; height: 32px; border: none; cursor: pointer;">
          <button type="button" id="confirmNewCat" 
            style="padding: 8px 12px; background: #28a745; color: white; border: none; 
            border-radius: 6px; cursor: pointer; font-size: 13px;">확인</button>
          <button type="button" id="cancelNewCat" 
            style="padding: 8px 12px; background: #6c757d; color: white; border: none; 
            border-radius: 6px; cursor: pointer; font-size: 13px;">취소</button>
        </div>
      </div>
      
      <label>주기(요일) <input type="text" id="drugDays" placeholder="예: 월,수,금 (쉼표구분)"></label>
      <label>시간 <input type="text" id="drugTimes" placeholder="예: 09:00, 18:00"></label>
      <div id="existingTimesDisplay" style="display: none; margin-bottom: 10px; padding: 8px; background: #fff9e6; border-radius: 6px;"></div>
      <label>1회 복용량 <input type="number" id="doseCount" value="1"></label>
      <label>총 재고 <input type="number" id="drugStock" value="30"></label>
      <label>메모 <input type="text" id="drugMemo" placeholder="식후 30분"></label>
      <label>기간 <input type="date" id="startDate"> ~ <input type="date" id="endDate"></label>
      <div class="btn-row">
        <button id="cancelBtn">취소</button>
        <button id="okBtn">저장</button>
      </div>
    </div>`;
    document.body.appendChild(wrapper);

    const today = new Date().toISOString().split('T')[0];
    wrapper.querySelector("#startDate").value = today;
    wrapper.querySelector("#endDate").value = "2025-12-31";

    // 기존 약 텍스트 클릭 시 정보 자동 완성
    wrapper.querySelectorAll(".existing-med-text").forEach(span => {
        span.onclick = () => {
            const med = JSON.parse(span.dataset.med);
            
            // 폼에 값 채우기
            wrapper.querySelector("#drugName").value = med.name;
            wrapper.querySelector("#drugName").readOnly = true;
            wrapper.querySelector("#drugName").style.background = "#f0f0f0";
            
            wrapper.querySelector("#drugType").value = med.category;
            wrapper.querySelector("#drugType").disabled = true;
            wrapper.querySelector("#drugType").style.background = "#f0f0f0";
            
            wrapper.querySelector("#drugDays").value = med.days === "매일" ? "월,화,수,목,금,토,일" : med.days;
            wrapper.querySelector("#drugDays").readOnly = true;
            wrapper.querySelector("#drugDays").style.background = "#f0f0f0";
            
            // 기존 시간들을 태그로 표시
            const existingTimesContainer = wrapper.querySelector("#existingTimesDisplay");
            if (existingTimesContainer) {
                const timesArr = med.times.split(",").map(t => t.trim()).filter(t => t);
                existingTimesContainer.innerHTML = timesArr.length > 0 ? `
                    <p style="font-size: 12px; color: #666; margin-bottom: 4px;">기존 시간:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${timesArr.map(t => `<span style="padding: 2px 8px; background: #e0e0e0; border-radius: 10px; font-size: 12px;">${t}</span>`).join("")}
                    </div>
                ` : "";
                existingTimesContainer.style.display = "block";
            }
            
            // 새 시간 입력 필드는 비워두기 (새로 추가할 시간 입력용)
            wrapper.querySelector("#drugTimes").value = "";
            wrapper.querySelector("#drugTimes").placeholder = "새로 추가할 시간 입력 (예: 14:00)";
            
            wrapper.querySelector("#doseCount").value = med.doseCount;
            wrapper.querySelector("#doseCount").readOnly = true;
            wrapper.querySelector("#doseCount").style.background = "#f0f0f0";
            
            wrapper.querySelector("#drugStock").value = med.stock;
            wrapper.querySelector("#drugStock").readOnly = true;
            wrapper.querySelector("#drugStock").style.background = "#f0f0f0";
            
            wrapper.querySelector("#drugMemo").value = med.memo;
            
            if (med.startDate) wrapper.querySelector("#startDate").value = med.startDate;
            wrapper.querySelector("#startDate").readOnly = true;
            wrapper.querySelector("#startDate").style.background = "#f0f0f0";
            
            if (med.endDate) wrapper.querySelector("#endDate").value = med.endDate;
            wrapper.querySelector("#endDate").readOnly = true;
            wrapper.querySelector("#endDate").style.background = "#f0f0f0";
            
            // 선택된 항목 스타일 변경
            wrapper.querySelectorAll(".existing-med-text").forEach(s => {
                s.style.background = "#f0f7ff";
                s.style.color = "#4c82ff";
            });
            span.style.background = "#4c82ff";
            span.style.color = "white";
            
            // 선택 해제 버튼 표시
            let clearBtn = wrapper.querySelector("#clearSelectionBtn");
            if (!clearBtn) {
                clearBtn = document.createElement("button");
                clearBtn.id = "clearSelectionBtn";
                clearBtn.type = "button";
                clearBtn.textContent = "✕ 선택 해제";
                clearBtn.style.cssText = "margin-left: 8px; padding: 4px 10px; background: #ff6b6b; color: white; border: none; border-radius: 12px; font-size: 12px; cursor: pointer;";
                wrapper.querySelector("#existingMedsSection")?.appendChild(clearBtn);
                
                clearBtn.onclick = () => {
                    // 모든 필드 초기화
                    wrapper.querySelector("#drugName").value = "";
                    wrapper.querySelector("#drugName").readOnly = false;
                    wrapper.querySelector("#drugName").style.background = "";
                    
                    wrapper.querySelector("#drugType").disabled = false;
                    wrapper.querySelector("#drugType").style.background = "";
                    wrapper.querySelector("#drugType").value = "필수 복용";
                    
                    wrapper.querySelector("#drugDays").value = "";
                    wrapper.querySelector("#drugDays").readOnly = false;
                    wrapper.querySelector("#drugDays").style.background = "";
                    
                    wrapper.querySelector("#drugTimes").value = "";
                    wrapper.querySelector("#drugTimes").placeholder = "예: 09:00, 18:00";
                    
                    const existingTimesDisplay = wrapper.querySelector("#existingTimesDisplay");
                    if (existingTimesDisplay) {
                        existingTimesDisplay.innerHTML = "";
                        existingTimesDisplay.style.display = "none";
                    }
                    
                    wrapper.querySelector("#doseCount").value = "1";
                    wrapper.querySelector("#doseCount").readOnly = false;
                    wrapper.querySelector("#doseCount").style.background = "";
                    
                    wrapper.querySelector("#drugStock").value = "30";
                    wrapper.querySelector("#drugStock").readOnly = false;
                    wrapper.querySelector("#drugStock").style.background = "";
                    
                    wrapper.querySelector("#drugMemo").value = "";
                    
                    wrapper.querySelector("#startDate").value = today;
                    wrapper.querySelector("#startDate").readOnly = false;
                    wrapper.querySelector("#startDate").style.background = "";
                    
                    wrapper.querySelector("#endDate").value = "2025-12-31";
                    wrapper.querySelector("#endDate").readOnly = false;
                    wrapper.querySelector("#endDate").style.background = "";
                    
                    // 스타일 초기화
                    wrapper.querySelectorAll(".existing-med-text").forEach(s => {
                        s.style.background = "#f0f7ff";
                        s.style.color = "#4c82ff";
                    });
                    
                    clearBtn.remove();
                    showToastIfAvailable("선택이 해제되었습니다.", "info");
                };
            }
            
            showToastIfAvailable(`'${med.name}' 선택됨. 새로 추가할 시간을 입력하세요.`, "info");
        };
    });

    // 카테고리 추가 버튼 클릭 시 입력 영역 표시
    const newCatSection = wrapper.querySelector("#newCategorySection");
    wrapper.querySelector("#addCategoryBtnInForm").onclick = () => {
        newCatSection.style.display = "block";
    };
    
    // 새 카테고리 취소
    wrapper.querySelector("#cancelNewCat").onclick = () => {
        newCatSection.style.display = "none";
        wrapper.querySelector("#newCatName").value = "";
    };
    
    // 새 카테고리 확인
    wrapper.querySelector("#confirmNewCat").onclick = () => {
        const newName = wrapper.querySelector("#newCatName").value.trim();
        const newColor = wrapper.querySelector("#newCatColor").value;
        
        if (!newName) {
            showToastIfAvailable("카테고리 이름을 입력하세요.", "error");
            return;
        }
        
        // 중복 검사
        typeColors = getTypeColors();
        if (typeColors[newName]) {
            showToastIfAvailable("카테고리가 존재합니다. 다른 카테고리를 적어주세요.", "error");
            return;
        }
        
        // 새 카테고리 저장
        const lightColor = newColor + "40";
        const deepColor = newColor;
        const customCategories = loadCustomCategories();
        customCategories[newName] = { light: lightColor, deep: deepColor };
        saveCustomCategories(customCategories);
        typeColors = getTypeColors();
        
        // select에 옵션 추가하고 선택
        const select = wrapper.querySelector("#drugType");
        const newOption = document.createElement("option");
        newOption.value = newName;
        newOption.textContent = newName;
        select.appendChild(newOption);
        select.value = newName;
        
        // 입력 영역 숨기기
        newCatSection.style.display = "none";
        wrapper.querySelector("#newCatName").value = "";
        
        showToastIfAvailable(`'${newName}' 카테고리가 추가되었습니다.`, "success");
    };

    wrapper.querySelector("#cancelBtn").onclick = () => wrapper.remove();

    wrapper.querySelector("#okBtn").onclick = async () => {
        const name = wrapper.querySelector("#drugName").value.trim();
        const category = wrapper.querySelector("#drugType").value;
        const days = wrapper.querySelector("#drugDays").value.trim();
        const times = wrapper.querySelector("#drugTimes").value.trim();
        const doseUnitQuantity = parseInt(wrapper.querySelector("#doseCount").value);
        const initialQuantity = parseInt(wrapper.querySelector("#drugStock").value);
        const memo = wrapper.querySelector("#drugMemo").value;
        const startDate = wrapper.querySelector("#startDate").value;
        const endDate = wrapper.querySelector("#endDate").value;

        // 필수 항목 검증
        const missingFields = [];
        if (!name) missingFields.push("이름");
        if (!category) missingFields.push("카테고리");
        if (!days) missingFields.push("주기(요일)");
        if (!times) missingFields.push("시간");
        
        if (missingFields.length > 0) {
            showToastIfAvailable(`${missingFields.join(", ")}을(를) 입력해주세요.`, "error");
            return;
        }
        
        // 기존 약 선택된 경우 시간 중복 검사
        const isExistingMed = wrapper.querySelector("#drugName").readOnly;
        if (isExistingMed) {
            // 기존 시간 가져오기
            const existingTimesDisplay = wrapper.querySelector("#existingTimesDisplay");
            const existingTimesSpans = existingTimesDisplay?.querySelectorAll("span") || [];
            const existingTimes = Array.from(existingTimesSpans).map(s => s.textContent.trim());
            
            // 입력한 시간들 파싱
            const newTimesArr = times.split(",").map(t => t.trim()).filter(t => t);
            
            // 중복 검사
            const duplicateTimes = newTimesArr.filter(t => existingTimes.includes(t));
            if (duplicateTimes.length > 0) {
                showToastIfAvailable(`이미 존재하는 시간입니다: ${duplicateTimes.join(", ")}. 다른 시간을 입력해주세요.`, "error");
                return;
            }
        } else {
            // 새 약 등록 시 약 이름 중복 검사
            const existingNames = existingMedsList.map(med => med.name);
            if (existingNames.includes(name)) {
                showToastIfAvailable(`'${name}' 약이 이미 존재합니다. 다른 이름을 입력하거나 기존 약을 선택해주세요.`, "error");
                return;
            }
        }

        try {
            if (isExistingMed) {
                // 기존 약에 새 스케줄(시간) 추가
                const selectedMed = existingMedsList.find(med => med.name === name);
                if (!selectedMed) {
                    showToastIfAvailable("선택된 약 정보를 찾을 수 없습니다.", "error");
                    return;
                }
                
                const medicationId = selectedMed.id;
                const newTimesArr = times.split(",").map(t => t.trim()).filter(t => t);
                
                let allSuccess = true;
                for (const time of newTimesArr) {
                    const result = await createNewSchedule(medicationId, {
                        intakeTime: time,
                        frequency: days,
                        startDate: startDate,
                        endDate: endDate
                    });
                    if (!result) allSuccess = false;
                }
                
                if (allSuccess) {
                    showToastIfAvailable(`'${name}'에 새 복용 시간이 추가되었습니다.`, "success");
                    wrapper.remove();
                    loadCards();
                } else {
                    showToastIfAvailable("일부 시간 추가에 실패했습니다.", "error");
                }
            } else {
                // 새 약 등록
                const payload = {
                    userId: 0,
                    name, category, memo, times, days,
                    startDate, endDate,
                    doseUnitQuantity, initialQuantity,
                    currentQuantity: initialQuantity,
                    refillThreshold: 5,
                    isPublic: true
                };

                const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToastIfAvailable("약이 등록되었습니다.", "success");
                    wrapper.remove();
                    loadCards();
                } else {
                    showToastIfAvailable("등록 실패", "error");
                }
            }
        } catch (e) {
            console.error(e);
            showToastIfAvailable("서버 오류", "error");
        }
    };
}

// [알림] - 재고 수동 수정 -> 재고/복용량/리필 한도만 수정하는 용도
async function updateMedicationData(cardElement, changes) {
    const id = cardElement.dataset.id;

    // 현재 카드에 저장된 값 기준 기본 payload
    const basePayload = {
        currentQuantity: parseInt(cardElement.dataset.stock),
        doseUnitQuantity: parseInt(cardElement.dataset.doseCount),
        refillThreshold: parseInt(cardElement.dataset.refillThreshold || "5")
    };

    // 변경값 merge 후, 허용된 세 필드만 필터링
    const merged = { ...basePayload, ...changes };
    const payload = {};

    ["currentQuantity", "doseUnitQuantity", "refillThreshold"].forEach((key) => {
        if (typeof merged[key] === "number" && !Number.isNaN(merged[key])) {
            payload[key] = merged[key];
        }
    });

    if (Object.keys(payload).length === 0) {
        console.warn("updateMedicationData: 변경할 필드가 없습니다.");
        return false;
    }

    console.log("[MedData] PATCH 요청:", `${API_BASE_URL}/api/medications/${id}`, payload);

    try {
        const res = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        console.log("[MedData] 응답 상태:", res.status);

        if (res.status === 400) {
            const errBody = await res.text().catch(() => "");
            console.error("[MedData] 400 에러:", errBody);
            showToastIfAvailable("입력값이 잘못되었습니다.", "error");
            return false;
        }
        if (res.status === 404) {
            console.error("[MedData] 404 에러: 약을 찾을 수 없음");
            showToastIfAvailable("해당 약 정보를 찾을 수 없습니다.", "error");
            return false;
        }
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            console.error("[MedData] 에러:", res.status, errBody);
            showToastIfAvailable(`서버 오류 (${res.status})`, "error");
            return false;
        }
        
        console.log("[MedData] 업데이트 성공");
        return true;
    } catch (e) {
        console.error("[MedData] 네트워크 오류:", e);
        showToastIfAvailable("네트워크 오류가 발생했습니다.", "error");
        return false;
    }
}


async function deleteMedication(id, cardElement, scheduleId = null) {
    // 스케줄 ID가 있으면 해당 시간대만 삭제, 없으면 약 전체 삭제
    const deleteType = scheduleId ? "이 시간대" : "이 약";
    if (!confirm(`${deleteType}를 삭제하시겠습니까?`)) return;
    
    try {
        let res;
        
        if (scheduleId) {
            // 스케줄만 삭제
            res = await fetch(`${API_BASE_URL}/api/schedules/${scheduleId}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            
            if (res.ok) {
                cardElement.remove();
                window.showToast?.("시간대가 삭제되었습니다.", { type: "success" });
            } else {
                window.showToast?.("시간대 삭제 실패", { type: "error" });
            }
        } else {
            // 약 전체 삭제
            res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            
            if (res.ok) {
                cardElement.remove();
                window.showToast?.("약이 삭제되었습니다.", { type: "success" });
            } else {
                window.showToast?.("삭제 실패", { type: "error" });
            }
        }
    } catch (e) {
        console.error(e);
        window.showToast?.("삭제 중 오류가 발생했습니다.", { type: "error" });
    }
}

function makeEditable(element, cardElement, fieldName, isNumber = false) {
    element.addEventListener("click", () => {
        const oldVal = element.innerText;
        const input = document.createElement("input");
        input.value = oldVal;
        input.style.width = "80px";
        element.replaceWith(input);
        input.focus();
        input.addEventListener("blur", async () => {
            const newVal = input.value;
            element.innerText = newVal;
            input.replaceWith(element);
            if(newVal !== oldVal) {
                const changes = {};
                changes[fieldName] = newVal;
                await updateMedicationData(cardElement, changes);
            }
        });
        input.addEventListener("keydown", (e) => { if(e.key==="Enter") input.blur(); });
    });
}

function showStockEditor(cardElement) {
    const currentStock = cardElement.dataset.stock;
    const name = cardElement.querySelector(".drug-info__title p").innerText;

    const wrapper = document.createElement("div");
    wrapper.className = "modal-bg";
    wrapper.innerHTML = `
    <div class="modal">
        <h3>${name} 재고 수정</h3>
        <label>현재 재고 <input type="number" id="newStock" value="${currentStock}"></label>
        <div class="btn-row"><button id="cancelStock">취소</button><button id="saveStock">저장</button></div>
    </div>`;
    document.body.appendChild(wrapper);

    wrapper.querySelector("#cancelStock").onclick = () => wrapper.remove();
    wrapper.querySelector("#saveStock").onclick = async () => {
        const newStock = parseInt(wrapper.querySelector("#newStock").value);
        if (await updateMedicationData(cardElement, { currentQuantity: newStock })) {
            cardElement.dataset.stock = newStock;
            cardElement.querySelector(".stock").innerText = newStock;
            wrapper.remove();
        }
    };
}

// ==================================================
// 🔹 카테고리 편집 모달
// ==================================================
function showCategoryEditor(cardElement, cardData) {
    const currentCategory = cardElement.querySelector(".category-text")?.innerText || "필수 복용";
    const medicationId = cardElement.dataset.id;
    
    // 최신 카테고리 목록 가져오기
    typeColors = getTypeColors();
    
    // 카테고리 버튼 HTML 생성
    const categoryEmojis = {
        "필수 복용": "🔴",
        "기간제": "🔵",
        "건강보조제": "🟡"
    };
    
    let categoryButtonsHTML = "";
    Object.entries(typeColors).forEach(([name, color]) => {
        const isSelected = currentCategory === name;
        const emoji = categoryEmojis[name] || "🏷️";
        const isCustom = !defaultTypeColors[name];
        
        categoryButtonsHTML += `
        <div class="category-option-wrapper" style="display: flex; align-items: center; gap: 8px;">
            <button class="category-option-btn ${isSelected ? 'selected' : ''}" data-value="${name}" 
                style="flex: 1; padding: 12px; border: 2px solid ${isSelected ? color.deep : '#ddd'}; 
                border-radius: 8px; background: ${isSelected ? color.light : '#fff'}; 
                cursor: pointer; font-size: 14px; text-align: left;">
                ${emoji} ${name}
            </button>
            ${isCustom ? `<button class="delete-category-btn" data-category="${name}" 
                style="width: 32px; height: 32px; border: none; background: #ff4444; 
                color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">×</button>` : ''}
        </div>`;
    });
    
    const wrapper = document.createElement("div");
    wrapper.className = "modal-bg";
    wrapper.innerHTML = `
    <div class="modal" style="max-width: 360px;">
      <h3>📁 카테고리 수정</h3>
      <p style="margin-bottom: 15px; color: #666;">카테고리를 선택하거나 새로 추가하세요</p>
      <div class="category-options" style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
        ${categoryButtonsHTML}
      </div>
      
      <div class="add-category-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
        <p style="font-weight: 600; margin-bottom: 10px;">➕ 새 카테고리 추가</p>
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <input type="text" id="newCategoryName" placeholder="카테고리 이름" 
                style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        </div>
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
            <label style="font-size: 13px; color: #666;">색상:</label>
            <input type="color" id="newCategoryColor" value="#82c8f2" 
                style="width: 40px; height: 30px; border: none; cursor: pointer;">
            <button id="addCategoryBtn" style="flex: 1; padding: 10px; background: #4c82ff; 
                color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                추가
            </button>
        </div>
      </div>
      
      <div class="modal-btns" style="margin-top: 15px;">
        <button class="cancel-modal-btn">닫기</button>
      </div>
    </div>
    `;
    document.body.appendChild(wrapper);
    
    // 카테고리 선택 이벤트
    function attachCategoryEvents() {
        wrapper.querySelectorAll(".category-option-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const newCategory = btn.dataset.value;
                const color = typeColors[newCategory] || { light: "#e6d6ff", deep: "#a86af2" };
                
                // 같은 약(medicationId)의 모든 카드 업데이트
                const allCardsWithSameId = document.querySelectorAll(`.drug-card[data-id="${medicationId}"]`);
                allCardsWithSameId.forEach(card => {
                    const categoryTextEl = card.querySelector(".category-text");
                    if (categoryTextEl) categoryTextEl.innerText = newCategory;
                    card.dataset.category = newCategory;
                    
                    const lightEl = card.querySelector(".color-tool-red__lilight");
                    const deepEl = card.querySelector(".color-tool-red__deep");
                    if (lightEl) lightEl.style.background = color.light;
                    if (deepEl) deepEl.style.background = color.deep;
                });
                
                const success = await updateMedicineInfo(medicationId, cardElement, { category: newCategory });
                
                wrapper.remove();
                
                if (success) {
                    showToastIfAvailable("카테고리가 변경되었습니다.", "success");
                }
            });
        });
        
        // 사용자 정의 카테고리 삭제 이벤트
        wrapper.querySelectorAll(".delete-category-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const categoryName = btn.dataset.category;
                
                if (confirm(`'${categoryName}' 카테고리를 삭제하시겠습니까?`)) {
                    const customCategories = loadCustomCategories();
                    delete customCategories[categoryName];
                    saveCustomCategories(customCategories);
                    typeColors = getTypeColors();
                    
                    // UI 새로고침
                    btn.closest(".category-option-wrapper").remove();
                    showToastIfAvailable("카테고리가 삭제되었습니다.", "success");
                }
            });
        });
    }
    
    attachCategoryEvents();
    
    // 새 카테고리 추가 이벤트
    wrapper.querySelector("#addCategoryBtn").addEventListener("click", () => {
        const nameInput = wrapper.querySelector("#newCategoryName");
        const colorInput = wrapper.querySelector("#newCategoryColor");
        const newName = nameInput.value.trim();
        const newColor = colorInput.value;
        
        if (!newName) {
            showToastIfAvailable("카테고리 이름을 입력하세요.", "error");
            return;
        }
        
        if (typeColors[newName]) {
            showToastIfAvailable("카테고리가 존재합니다. 다른 카테고리를 적어주세요.", "error");
            return;
        }
        
        // 색상 밝게/진하게 계산
        const lightColor = newColor + "40";  // 투명도 추가
        const deepColor = newColor;
        
        // 사용자 정의 카테고리 저장
        const customCategories = loadCustomCategories();
        customCategories[newName] = { light: lightColor, deep: deepColor };
        saveCustomCategories(customCategories);
        typeColors = getTypeColors();
        
        // 옵션 목록에 추가
        const optionsContainer = wrapper.querySelector(".category-options");
        const newOptionHTML = `
        <div class="category-option-wrapper" style="display: flex; align-items: center; gap: 8px;">
            <button class="category-option-btn" data-value="${newName}" 
                style="flex: 1; padding: 12px; border: 2px solid #ddd; 
                border-radius: 8px; background: #fff; 
                cursor: pointer; font-size: 14px; text-align: left;">
                🏷️ ${newName}
            </button>
            <button class="delete-category-btn" data-category="${newName}" 
                style="width: 32px; height: 32px; border: none; background: #ff4444; 
                color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">×</button>
        </div>`;
        optionsContainer.insertAdjacentHTML("beforeend", newOptionHTML);
        
        // 새로 추가된 버튼에 이벤트 연결
        attachCategoryEvents();
        
        // 입력 필드 초기화
        nameInput.value = "";
        showToastIfAvailable(`'${newName}' 카테고리가 추가되었습니다.`, "success");
    });
    
    // 닫기 버튼
    wrapper.querySelector(".cancel-modal-btn").addEventListener("click", () => wrapper.remove());
    wrapper.addEventListener("click", (e) => { if (e.target === wrapper) wrapper.remove(); });
}

// ==================================================
// 🔹 필드별 편집 모달
// ==================================================
function showFieldEditor(cardElement, cardData, field) {
    const medicationId = cardElement.dataset.id;
    const name = cardElement.querySelector(".drug-info__title p").innerText;
    
    // 현재 값 가져오기
    const currentRule = cardElement.querySelector(".rule")?.innerText || "매일";
    const timeItems = cardElement.querySelectorAll(".time-item");
    const currentTimes = Array.from(timeItems).map(t => t.innerText.trim()).join(",");
    const currentDose = parseInt(cardElement.querySelector(".dose")?.innerText) || 1;
    const currentStock = parseInt(cardElement.dataset.stock) || 0;
    const startDate = cardElement.querySelector(".start-date")?.innerText || "";
    const endDate = cardElement.querySelector(".end-date")?.innerText || "";

    const wrapper = document.createElement("div");
    wrapper.className = "modal-bg";
    
    let modalContent = "";
    
    switch(field) {
        case "rule":
            modalContent = `
                <div class="modal">
                    <h3>📆 ${name} - 복용 요일 수정</h3>
                    <div class="day-selector">
                        <label><input type="checkbox" value="월" ${currentRule.includes("월") || currentRule === "매일" ? "checked" : ""}> 월</label>
                        <label><input type="checkbox" value="화" ${currentRule.includes("화") || currentRule === "매일" ? "checked" : ""}> 화</label>
                        <label><input type="checkbox" value="수" ${currentRule.includes("수") || currentRule === "매일" ? "checked" : ""}> 수</label>
                        <label><input type="checkbox" value="목" ${currentRule.includes("목") || currentRule === "매일" ? "checked" : ""}> 목</label>
                        <label><input type="checkbox" value="금" ${currentRule.includes("금") || currentRule === "매일" ? "checked" : ""}> 금</label>
                        <label><input type="checkbox" value="토" ${currentRule.includes("토") || currentRule === "매일" ? "checked" : ""}> 토</label>
                        <label><input type="checkbox" value="일" ${currentRule.includes("일") && !currentRule.includes("매일") || currentRule === "매일" ? "checked" : ""}> 일</label>
                    </div>
                    <div class="btn-row">
                        <button class="preset-btn" data-preset="all">매일</button>
                        <button class="preset-btn" data-preset="weekday">평일</button>
                        <button class="preset-btn" data-preset="weekend">주말</button>
                    </div>
                    <div class="btn-row"><button id="cancelEdit">취소</button><button id="saveEdit">저장</button></div>
                </div>`;
            break;
            
        case "time":
            const timesArray = currentTimes ? currentTimes.split(",").map(t => t.trim()) : ["09:00"];
            const timeInputsHTML = timesArray.map((t, i) => `
                <div class="time-row">
                    <input type="time" class="time-input" value="${t}">
                    ${timesArray.length > 1 ? `<button type="button" class="remove-time">×</button>` : ''}
                </div>
            `).join("");
            
            modalContent = `
                <div class="modal">
                    <h3>⏰ ${name} - 복용 시간 수정</h3>
                    <div id="timeInputsContainer">${timeInputsHTML}</div>
                    <button type="button" id="addTimeBtn">+ 시간 추가</button>
                    <div class="btn-row"><button id="cancelEdit">취소</button><button id="saveEdit">저장</button></div>
                </div>`;
            break;
            
        case "dose":
            modalContent = `
                <div class="modal">
                    <h3>💊 ${name} - 1회 복용량 수정</h3>
                    <label>복용량 <input type="number" id="newDose" value="${currentDose}" min="1"> 정</label>
                    <div class="btn-row"><button id="cancelEdit">취소</button><button id="saveEdit">저장</button></div>
                </div>`;
            break;
            
        case "stock":
            modalContent = `
                <div class="modal">
                    <h3>📦 ${name} - 재고 수정</h3>
                    <label>현재 재고 <input type="number" id="newStock" value="${currentStock}" min="0"> 정</label>
                    <div class="btn-row"><button id="cancelEdit">취소</button><button id="saveEdit">저장</button></div>
                </div>`;
            break;
            
        case "period":
            modalContent = `
                <div class="modal">
                    <h3>📅 ${name} - 복용 기간 수정</h3>
                    <label>시작일 <input type="date" id="newStartDate" value="${startDate}"></label>
                    <label>종료일 <input type="date" id="newEndDate" value="${endDate}"></label>
                    <div class="btn-row"><button id="cancelEdit">취소</button><button id="saveEdit">저장</button></div>
                </div>`;
            break;
            
        default:
            return;
    }
    
    wrapper.innerHTML = modalContent;
    document.body.appendChild(wrapper);
    
    // 프리셋 버튼 (요일용)
    wrapper.querySelectorAll(".preset-btn").forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            const checkboxes = wrapper.querySelectorAll(".day-selector input");
            if (preset === "all") {
                checkboxes.forEach(cb => cb.checked = true);
            } else if (preset === "weekday") {
                checkboxes.forEach(cb => cb.checked = ["월","화","수","목","금"].includes(cb.value));
            } else if (preset === "weekend") {
                checkboxes.forEach(cb => cb.checked = ["토","일"].includes(cb.value));
            }
        };
    });
    
    // 시간 추가/삭제 버튼
    if (field === "time") {
        const container = wrapper.querySelector("#timeInputsContainer");
        
        wrapper.querySelector("#addTimeBtn").onclick = () => {
            const div = document.createElement("div");
            div.className = "time-row";
            div.innerHTML = `<input type="time" class="time-input" value="12:00"><button type="button" class="remove-time">×</button>`;
            container.appendChild(div);
            bindRemoveButtons();
        };
        
        const bindRemoveButtons = () => {
            wrapper.querySelectorAll(".remove-time").forEach(btn => {
                btn.onclick = () => {
                    if (container.querySelectorAll(".time-row").length > 1) {
                        btn.parentElement.remove();
                    }
                };
            });
        };
        bindRemoveButtons();
    }
    
    // 취소 버튼
    wrapper.querySelector("#cancelEdit").onclick = () => wrapper.remove();
    
    // 모달 외부 클릭 시 닫기
    wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) wrapper.remove();
    });
    
    // 저장 버튼
    wrapper.querySelector("#saveEdit").onclick = async () => {
        const saveBtn = wrapper.querySelector("#saveEdit");
        saveBtn.disabled = true;
        saveBtn.textContent = "저장 중...";
        
        let success = false;
        
        switch(field) {
            case "rule":
                const selectedDays = [];
                wrapper.querySelectorAll(".day-selector input:checked").forEach(cb => selectedDays.push(cb.value));
                if (selectedDays.length === 0) {
                    alert("최소 하나의 요일을 선택해주세요.");
                    saveBtn.disabled = false;
                    saveBtn.textContent = "저장";
                    return;
                }
                const allDays = ["월","화","수","목","금","토","일"];
                const isAllDays = allDays.every(d => selectedDays.includes(d));
                const daysStr = isAllDays ? "매일" : selectedDays.join(", ");
                
                // 같은 약의 모든 스케줄 업데이트
                const allCardsWithSameMedForRule = document.querySelectorAll(`.drug-card[data-id="${medicationId}"]`);
                let ruleAllSuccess = true;
                
                for (const card of allCardsWithSameMedForRule) {
                    const scheduleId = card.dataset.scheduleId;
                    if (scheduleId) {
                        const result = await updateScheduleOnServer(medicationId, card, { days: selectedDays.join(",") });
                        if (!result) ruleAllSuccess = false;
                    }
                    // UI 업데이트
                    const ruleEl = card.querySelector(".rule");
                    if (ruleEl) {
                        ruleEl.innerText = daysStr;
                    }
                }
                
                success = ruleAllSuccess;
                break;
                
            case "time":
                const newTimes = [];
                wrapper.querySelectorAll(".time-input").forEach(input => {
                    if (input.value) newTimes.push(input.value);
                });
                if (newTimes.length === 0) {
                    alert("최소 하나의 시간을 입력해주세요.");
                    saveBtn.disabled = false;
                    saveBtn.textContent = "저장";
                    return;
                }
                
                // 현재 카드의 시간 (원본)
                const currentTime = cardElement.querySelector(".time-item")?.innerText || "";
                const currentScheduleId = cardElement.dataset.scheduleId;
                
                // 같은 약의 기존 시간들 수집 (현재 편집 중인 스케줄 제외)
                const existingTimes = [];
                document.querySelectorAll(`.drug-card[data-id="${medicationId}"]`).forEach(card => {
                    const scheduleId = card.dataset.scheduleId;
                    // 현재 편집 중인 카드의 스케줄은 제외
                    if (scheduleId !== currentScheduleId) {
                        const timeEl = card.querySelector(".time-item");
                        if (timeEl) {
                            existingTimes.push(timeEl.innerText.trim());
                        }
                    }
                });
                console.log("[Time] 기존 시간들 (현재 편집 중 제외):", existingTimes);
                
                // 중복 시간 검사 (첫 번째 시간은 현재 스케줄 업데이트이므로 제외)
                const duplicateTimes = [];
                for (let i = 1; i < newTimes.length; i++) {
                    const time = newTimes[i];
                    // 기존 시간과 비교
                    if (existingTimes.includes(time)) {
                        duplicateTimes.push(time);
                    }
                    // 첫 번째 시간(업데이트될 시간)과도 비교
                    if (time === newTimes[0]) {
                        duplicateTimes.push(time);
                    }
                }
                
                // 입력한 시간들 중 중복 검사
                const inputTimesSet = new Set();
                let hasDuplicateInput = false;
                for (const time of newTimes) {
                    if (inputTimesSet.has(time)) {
                        hasDuplicateInput = true;
                        duplicateTimes.push(time);
                    }
                    inputTimesSet.add(time);
                }
                
                if (duplicateTimes.length > 0 || hasDuplicateInput) {
                    showToastIfAvailable("같은 시간대에 약이 존재합니다. 시간을 다시 선택해주세요.", "error");
                    saveBtn.disabled = false;
                    saveBtn.textContent = "저장";
                    return;
                }
                
                // 현재 카드의 스케줄 정보
                const scheduleData = JSON.parse(cardElement.dataset.schedules || "[]")[0] || {};
                const frequency = scheduleData.frequency || cardElement.querySelector(".rule")?.innerText || "매일";
                const scheduleStartDate = scheduleData.startDate || cardElement.querySelector(".start-date")?.innerText || "";
                const scheduleEndDate = scheduleData.endDate || cardElement.querySelector(".end-date")?.innerText || "";
                
                // 현재 시간은 기존 스케줄 업데이트, 새 시간은 새 스케줄 생성
                console.log("[Time] 저장할 시간들:", newTimes);
                console.log("[Time] 스케줄 정보:", { frequency, scheduleStartDate, scheduleEndDate });
                
                let timeSuccess = true;
                
                for (let i = 0; i < newTimes.length; i++) {
                    const time = newTimes[i];
                    console.log(`[Time] 처리 중 (${i}):`, time);
                    
                    if (i === 0) {
                        // 첫 번째 시간은 현재 스케줄 업데이트
                        const result = await updateScheduleOnServer(medicationId, cardElement, { 
                            intakeTime: time 
                        });
                        console.log("[Time] 첫 번째 시간 업데이트 결과:", result);
                        if (!result) timeSuccess = false;
                    } else {
                        // 추가된 시간은 새 스케줄 생성
                        console.log("[Time] 새 스케줄 생성 시도:", time);
                        const newScheduleResult = await createNewSchedule(medicationId, {
                            intakeTime: time,
                            frequency: frequency,
                            startDate: scheduleStartDate,
                            endDate: scheduleEndDate
                        });
                        console.log("[Time] 새 스케줄 생성 결과:", newScheduleResult);
                        // 실패해도 계속 진행
                    }
                }
                
                // 하나라도 처리했으면 성공으로 간주하고 새로고침
                success = true;
                break;
                
            case "dose":
                const newDose = parseInt(wrapper.querySelector("#newDose").value);
                if (isNaN(newDose) || newDose < 1) {
                    alert("1 이상의 값을 입력해주세요.");
                    saveBtn.disabled = false;
                    saveBtn.textContent = "저장";
                    return;
                }
                // PATCH API로 복용량 업데이트
                console.log("[Dose] 업데이트 시도:", newDose);
                success = await updateMedicationData(cardElement, { doseUnitQuantity: newDose });
                console.log("[Dose] 결과:", success);
                break;
                
            case "stock":
                const newStock = parseInt(wrapper.querySelector("#newStock").value);
                if (isNaN(newStock) || newStock < 0) {
                    alert("0 이상의 값을 입력해주세요.");
                    saveBtn.disabled = false;
                    saveBtn.textContent = "저장";
                    return;
                }
                // PATCH API로 재고 업데이트
                console.log("[Stock] 업데이트 시도:", newStock);
                success = await updateMedicationData(cardElement, { currentQuantity: newStock });
                console.log("[Stock] 결과:", success);
                break;
                
            case "period":
                const newStart = wrapper.querySelector("#newStartDate").value;
                const newEnd = wrapper.querySelector("#newEndDate").value;
                
                // 같은 약의 모든 스케줄 업데이트
                const allCardsWithSameId = document.querySelectorAll(`.drug-card[data-id="${medicationId}"]`);
                let allSuccess = true;
                
                for (const card of allCardsWithSameId) {
                    const scheduleId = card.dataset.scheduleId;
                    if (scheduleId) {
                        const result = await updateScheduleOnServer(medicationId, card, { 
                            startDate: newStart, 
                            endDate: newEnd 
                        });
                        if (!result) allSuccess = false;
                    }
                    // UI 업데이트
                    if (card.querySelector(".start-date")) {
                        card.querySelector(".start-date").innerText = newStart;
                    }
                    if (card.querySelector(".end-date")) {
                        card.querySelector(".end-date").innerText = newEnd;
                    }
                }
                
                success = allSuccess;
                break;
        }
        
        if (success) {
            wrapper.remove();
            showToastIfAvailable("수정되었습니다. 새로고침 중...", "success");
            // 서버 데이터와 동기화를 위해 카드 다시 불러오기
            setTimeout(() => {
                loadCards();
            }, 500);
        } else {
            saveBtn.disabled = false;
            saveBtn.textContent = "저장";
        }
    };
}

// ==================================================
// 🔹 새 스케줄 생성 (시간 추가용)
// POST /api/mediinfo/medicines/{medicationId}/schedules
// ==================================================
async function createNewSchedule(medicationId, scheduleData) {
    try {
        // 시간 형식 변환 (HH:mm -> HH:mm:ss)
        let intakeTime = scheduleData.intakeTime || "12:00";
        if (intakeTime.length === 5) {
            intakeTime = intakeTime + ":00";
        }
        
        // 요일 형식 변환
        let frequency = scheduleData.frequency || "매일";
        if (frequency === "매일") {
            frequency = "월,화,수,목,금,토,일";
        }
        // 요일에 공백 있으면 제거
        frequency = frequency.replace(/\s/g, "");
        
        const payload = {
            intakeTime: intakeTime,
            frequency: frequency,
            startDate: scheduleData.startDate || null,
            endDate: scheduleData.endDate || null
        };
        
        console.log("[Schedule] 새 스케줄 생성 요청:", `${API_BASE_URL}/api/mediinfo/medicines/${medicationId}/schedules`);
        console.log("[Schedule] 페이로드:", payload);
        
        const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${medicationId}/schedules`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        const responseText = await res.text();
        console.log("[Schedule] 응답:", res.status, responseText);
        
        if (res.ok || res.status === 201) {
            console.log("[Schedule] 새 스케줄 생성 성공");
            showToastIfAvailable("새 복용 시간이 추가되었습니다.", "success");
            return true;
        } else {
            console.error("[Schedule] 새 스케줄 생성 실패:", res.status, responseText);
            showToastIfAvailable("스케줄 생성 실패: " + res.status, "error");
            return false;
        }
    } catch (e) {
        console.error("[Schedule] 새 스케줄 생성 오류:", e);
        showToastIfAvailable("네트워크 오류", "error");
        return false;
    }
}

// ==================================================
// 🔹 스케줄 정보 서버 업데이트 (API 명세 준수)
// PUT /api/schedules/{scheduleId} 사용
// ==================================================
async function updateScheduleOnServer(medicationId, cardElement, scheduleChanges) {
    try {
        // 1. 카드에 저장된 스케줄 정보 사용 (API 호출 없이)
        let schedules = [];
        try {
            schedules = JSON.parse(cardElement.dataset.schedules || "[]");
        } catch (e) {
            console.warn("[Schedule] 스케줄 파싱 실패:", e);
        }
        
        console.log("[Schedule] 저장된 스케줄 목록:", schedules);
        
        if (schedules.length === 0) {
            console.warn("[Schedule] 스케줄이 없습니다.");
            showToastIfAvailable("수정할 스케줄이 없습니다.", "error");
            return false;
        }
        
        // 2. 현재 값 가져오기
        const currentRule = cardElement.querySelector(".rule")?.innerText || "매일";
        const timeItems = cardElement.querySelectorAll(".time-item");
        const currentTimes = Array.from(timeItems).map(t => t.innerText.trim());
        const startDateEl = cardElement.querySelector(".start-date");
        const endDateEl = cardElement.querySelector(".end-date");
        const currentStartDate = startDateEl?.innerText || schedules[0]?.startDate || "";
        const currentEndDate = endDateEl?.innerText || schedules[0]?.endDate || "";
        
        // 요일 변환
        let frequency = scheduleChanges.days || currentRule;
        if (frequency === "매일") {
            frequency = "월,화,수,목,금,토,일";
        } else {
            frequency = frequency.replace(/\s/g, "");
        }
        
        // 3. 시간 변경인 경우: 스케줄 개수가 다르면 삭제 후 재생성 필요
        const newTimes = scheduleChanges.times ? scheduleChanges.times.split(",") : currentTimes;
        
        let allSuccess = true;
        
        // 4. 기존 스케줄 수정 또는 삭제/생성
        if (newTimes.length === schedules.length) {
            // 개수가 같으면 각 스케줄 업데이트
            for (let i = 0; i < schedules.length; i++) {
                const scheduleId = schedules[i].scheduleId;
                const payload = {
                    intakeTime: newTimes[i],
                    frequency: frequency,
                    startDate: scheduleChanges.startDate || currentStartDate,
                    endDate: scheduleChanges.endDate || currentEndDate
                };
                
                console.log(`[Schedule] PUT /api/schedules/${scheduleId}`, payload);
                
                const res = await fetch(`${API_BASE_URL}/api/schedules/${scheduleId}`, {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                
                console.log(`[Schedule] 스케줄 ${scheduleId} 응답:`, res.status);
                
                if (!res.ok) {
                    allSuccess = false;
                    const errText = await res.text().catch(() => "");
                    console.error(`[Schedule] 스케줄 ${scheduleId} 업데이트 실패:`, res.status, errText);
                }
            }
        } else {
            // 시간 개수가 다르면: 기존 스케줄 삭제 후 새로 추가
            console.log("[Schedule] 스케줄 개수 변경, 삭제 후 재생성");
            
            // 기존 스케줄 삭제
            for (const sch of schedules) {
                const delRes = await fetch(`${API_BASE_URL}/api/schedules/${sch.scheduleId}`, {
                    method: "DELETE",
                    headers: getAuthHeaders()
                });
                console.log(`[Schedule] 스케줄 ${sch.scheduleId} 삭제:`, delRes.status);
            }
            
            // 새 스케줄 추가
            for (const time of newTimes) {
                const payload = {
                    intakeTime: time.length === 5 ? time + ":00" : time,
                    frequency: frequency.replace(/\s/g, ""),
                    startDate: scheduleChanges.startDate || currentStartDate,
                    endDate: scheduleChanges.endDate || currentEndDate
                };
                
                console.log(`[Schedule] POST /api/mediinfo/medicines/${medicationId}/schedules`, payload);
                
                const addRes = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${medicationId}/schedules`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                
                console.log(`[Schedule] 새 스케줄 추가 응답:`, addRes.status);
                
                if (!addRes.ok && addRes.status !== 201) {
                    allSuccess = false;
                }
            }
        }
        
        if (allSuccess) {
            console.log("[Schedule] 모든 스케줄 업데이트 성공");
            return true;
        } else {
            showToastIfAvailable("일부 스케줄 업데이트에 실패했습니다.", "error");
            return false;
        }
        
    } catch (e) {
        console.error("[Schedule] 오류:", e);
        showToastIfAvailable("네트워크 오류가 발생했습니다.", "error");
        return false;
    }
}

// ==================================================
// 🔹 약 기본 정보 수정 (PUT /api/medicines/{id})
// ==================================================
async function updateMedicineInfo(medicationId, cardElement, changes) {
    const name = changes.name || cardElement.querySelector(".drug-info__title p")?.innerText || "";
    const category = changes.category || cardElement.dataset.category || "필수 복용";
    const memo = changes.memo !== undefined ? changes.memo : (cardElement.dataset.memo || "");
    const doseUnitQuantity = changes.doseUnitQuantity || parseInt(cardElement.dataset.doseCount) || 1;
    const currentQuantity = changes.currentQuantity !== undefined ? changes.currentQuantity : parseInt(cardElement.dataset.stock) || 0;
    const refillThreshold = parseInt(cardElement.dataset.refillThreshold) || 5;
    
    const payload = {
        name,
        category,
        memo,
        doseUnitQuantity,
        currentQuantity,
        refillThreshold
    };
    
    console.log("[Medicine] PUT /api/mediinfo/medicines/" + medicationId, payload);
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${medicationId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        console.log("[Medicine] 응답:", res.status);
        
        if (res.ok) {
            return true;
        }
        
        if (res.status === 400) {
            showToastIfAvailable("입력값을 확인해주세요.", "error");
        } else if (res.status === 404) {
            showToastIfAvailable("해당 약을 찾을 수 없습니다.", "error");
        } else {
            showToastIfAvailable(`서버 오류 (${res.status})`, "error");
        }
        return false;
    } catch (e) {
        console.error("[Medicine] 오류:", e);
        showToastIfAvailable("네트워크 오류가 발생했습니다.", "error");
        return false;
    }
}

if (hasMedicationUI) {
    addBtn.addEventListener("click", showAddForm);
    loadCards();
}