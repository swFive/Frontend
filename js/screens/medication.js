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
const typeColors = {
    "필수 복용": { light: "#ffd0d0", deep: "#f28282" },
    "기간제": { light: "#d0d0ff", deep: "#8282f2" },
    "건강보조제": { light: "#fff7b0", deep: "#ffe12e" }
};

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
            data.forEach(item => {
                const schedules = item.schedulesWithLogs || [];

                // 시간 정렬
                schedules.sort((a, b) => (a.intakeTime || "").localeCompare(b.intakeTime || ""));

                // 시간 목록
                let times = schedules
                    .map(s => s.intakeTime ? s.intakeTime.substring(0, 5) : "")
                    .filter(t => t);
                times = [...new Set(times)];

                // 복용 현황
                let takenCount = 0;
                let nextScheduleId = null;
                let lastLogId = null;

                for (const s of schedules) {
                    if (s.logId) {
                        if (s.intakeStatus === 'TAKEN' || s.intakeStatus === 'LATE') {
                            takenCount++;
                            lastLogId = s.logId;
                        }
                    } else {
                        if (!nextScheduleId) nextScheduleId = s.scheduleId;
                    }
                }

                const firstSch = schedules[0] || {};

                const cardData = {
                    id: item.medicationId,
                    title: item.name,
                    subtitle: item.category,
                    drugs: [item.memo || ""],
                    rule: firstSch.frequency || "매일",
                    time: times,
                    next: item.nextIntakeTime || "-",
                    dose: item.doseUnitQuantity || 1,
                    stock: item.currentQuantity || 0,
                    doseCount: item.doseUnitQuantity || 1,
                    startDate: firstSch.startDate || "",
                    endDate: firstSch.endDate || "",
                    dailyTimes: times.length,
                    takenCountToday: takenCount,
                    nextScheduleId: nextScheduleId,
                    lastLogId: lastLogId,
                    refillThreshold: 5
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
// 🔹 API 호출 함수들
// ==================================================

async function recordIntake(scheduleId, status = "TAKEN") {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs/intake`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                scheduleId: scheduleId,
                intakeStatus: status
                // recordTime은 서버 시간 사용
            })
        });
        return response.ok;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function deleteIntakeLog(logId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs/${logId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        return response.ok;
    } catch (e) {
        console.error(e);
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
    newCard.dataset.stock = cardData.stock;
    newCard.dataset.doseCount = cardData.doseCount;
    newCard.dataset.nextScheduleId = cardData.nextScheduleId || "";
    newCard.dataset.lastLogId = cardData.lastLogId || "";
    newCard.dataset.category = cardData.subtitle;
    newCard.dataset.memo = cardData.drugs[0];
    newCard.dataset.refillThreshold = cardData.refillThreshold;

    const color = typeColors[cardData.subtitle] || { light: "#e6d6ff", deep: "#a86af2" };
    const timeHTML = cardData.time.map(t => `<p class="time-item">${t}</p>`).join("");

    const takenCount = parseInt(cardData.takenCountToday);
    const totalTimes = parseInt(cardData.dailyTimes);

    const isDone = takenCount >= totalTimes;
    let takeBtnText = `💊 복용 (${takenCount}/${totalTimes})`;
    let btnClass = "take-btn";

    if (isDone) {
        takeBtnText = "✅ 복용 완료";
        btnClass += " completed";
    }

    newCard.innerHTML = `
    <div class="color-tool-red">
      <div class="color-tool-red__lilight" style="background:${color.light}"></div>
      <div class="color-tool-red__deep" style="background:${color.deep}"></div>
    </div>

    <button class="delete-btn" title="약 삭제">×</button>

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
        <div><p>${cardData.drugs[0] || "메모 없음"}</p></div>
      </div>
    </div>

    <div class="drug-rule-info">
      <div class="drug-rule-info__row"><p class="rule">${cardData.rule}</p></div>
      <div class="drug-rule-info__row time">${timeHTML}</div>
      <div class="drug-rule-info__row"><p class="next">${cardData.next}</p></div>
      <div class="drug-rule-info__row"><p class="dose">${cardData.dose}</p>정</div>
      <div class="drug-rule-info__row stock-row">재고: <span class="stock">${cardData.stock}</span>정</div>
      <div class="drug-rule-info__row period">기간: ${cardData.startDate} ~ ${cardData.endDate}</div>
      <button class="${btnClass}">${takeBtnText}</button>
    </div>
  `;

    // --- 이벤트 ---

    newCard.querySelector(".delete-btn").addEventListener("click", () => deleteMedication(cardData.id, newCard));

    newCard.querySelector(".drug-info").addEventListener("click", (e) => {
        if (!e.target.closest("select")) showStockEditor(newCard);
    });

    // 🟢 [핵심 수정됨] 복용 버튼 로직
    const takeBtn = newCard.querySelector("button.take-btn");
    takeBtn.addEventListener("click", async () => {
        const dose = parseInt(newCard.dataset.doseCount);
        let currentStock = parseInt(newCard.dataset.stock);

        // A. 취소 로직 (이미 완료했거나, 마지막 기록이 있는 경우)
        // 취소할 때는 트리거가 없으므로 '수동으로' 재고를 +1 해줘야 합니다.
        if (newCard.dataset.lastLogId) {
            if (isDone || confirm("마지막 복용 기록을 취소하시겠습니까?\n(재고가 복구됩니다)")) {
                const logId = newCard.dataset.lastLogId;

                // 1. 로그 삭제
                const deleted = await deleteIntakeLog(logId);
                if (deleted) {
                    // 2. 재고 복구 (수동 증가)
                    const newStock = currentStock + dose;
                    await updateMedicationData(newCard, { currentQuantity: newStock });

                    alert("취소되었습니다.");
                    window.location.reload();
                } else {
                    alert("취소 실패");
                }
            }
            return;
        }

        // B. 복용 로직
        // 여기서는 '수동 차감'을 하지 않습니다! (DB 트리거가 자동으로 깎음)
        const targetScheduleId = newCard.dataset.nextScheduleId;
        if (!targetScheduleId) return alert("오늘 예정된 일정이 없습니다.");

        if(currentStock < dose) return alert("⚠️ 재고가 부족합니다!");

        // 1. 기록 생성만 요청 -> DB 트리거가 재고 차감 수행
        const logRecorded = await recordIntake(targetScheduleId);

        if(logRecorded) {
            // 성공 시 새로고침 (차감된 재고를 서버에서 다시 받아옴)
            // alert("복용 완료!");
            window.location.reload();
        } else {
            alert("기록 실패");
        }
    });

    // 기타 수정 리스너
    const catSelect = newCard.querySelector(".drug-info__subtitle select");
    catSelect.addEventListener("change", () => updateMedicationData(newCard, { category: catSelect.value }));
    makeEditable(newCard.querySelector(".drug-info__title p"), newCard, "name");
    makeEditable(newCard.querySelector(".drug-info__list p"), newCard, "memo");
    makeEditable(newCard.querySelector(".dose"), newCard, "doseUnitQuantity", true);

    if (grid && addBtn) grid.insertBefore(newCard, addBtn);
}

// ... (이하 showAddForm, updateMedicationData, deleteMedication 등은 기존과 동일) ...

// ==================================================
// 🔹 [C] 약 등록 (POST)
// ==================================================
function showAddForm() {
    const wrapper = document.createElement("div");
    wrapper.className = "modal-bg";
    wrapper.innerHTML = `
    <div class="modal">
      <h3>💊 새 약 추가</h3>
      <label>약 이름 <input type="text" id="drugName" placeholder="예: 타이레놀"></label>
      <label>카테고리 <select id="drugType"><option>필수 복용</option><option>기간제</option><option>건강보조제</option></select></label>
      <label>주기(요일) <input type="text" id="drugDays" placeholder="예: 월,수,금 (쉼표구분)"></label>
      <label>시간 <input type="text" id="drugTimes" placeholder="예: 09:00, 18:00"></label>
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

    wrapper.querySelector("#cancelBtn").onclick = () => wrapper.remove();

    wrapper.querySelector("#okBtn").onclick = async () => {
        const name = wrapper.querySelector("#drugName").value;
        const category = wrapper.querySelector("#drugType").value;
        const days = wrapper.querySelector("#drugDays").value || "DAILY";
        const times = wrapper.querySelector("#drugTimes").value;
        const doseUnitQuantity = parseInt(wrapper.querySelector("#doseCount").value);
        const initialQuantity = parseInt(wrapper.querySelector("#drugStock").value);
        const memo = wrapper.querySelector("#drugMemo").value;
        const startDate = wrapper.querySelector("#startDate").value;
        const endDate = wrapper.querySelector("#endDate").value;

        if (!name || !times) return alert("이름과 시간은 필수입니다.");

        const payload = {
            userId: 0,
            name, category, memo, times, days,
            startDate, endDate,
            doseUnitQuantity, initialQuantity,
            currentQuantity: initialQuantity,
            refillThreshold: 5,
            isPublic: true
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("약이 등록되었습니다.");
                wrapper.remove();
                loadCards();
            } else {
                alert("등록 실패");
            }
        } catch (e) {
            console.error(e);
            alert("서버 오류");
        }
    };
}

async function updateMedicationData(cardElement, changes) {
    const id = cardElement.dataset.id;
    const payload = {
        name: cardElement.querySelector(".drug-info__title p").innerText,
        category: cardElement.dataset.category || "기타",
        memo: cardElement.dataset.memo || "",
        doseUnitQuantity: parseInt(cardElement.dataset.doseCount),
        currentQuantity: parseInt(cardElement.dataset.stock),
        refillThreshold: 5,
        ...changes
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function deleteMedication(id, cardElement) {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/mediinfo/medicines/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        if (res.ok) cardElement.remove();
        else alert("삭제 실패");
    } catch (e) {
        console.error(e);
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

if (hasMedicationUI) {
    addBtn.addEventListener("click", showAddForm);
    loadCards();
}