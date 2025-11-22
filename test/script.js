(function () {
  'use strict';

  /*  DOM 요소 캐싱 */

  // 복용/미복용 + 토스트 + 되돌리기 영역
  const takeBtn = document.getElementById('takeBtn');
  const skipBtn = document.getElementById('skipBtn');
  const feedback = document.getElementById('pillFeedback');
  const toast = document.getElementById('toast');
  const undoWrap = document.querySelector('.pill__undo-wrap');
  const undoBtn = document.getElementById('undoBtn');

  // 컨디션(기분) 선택 영역
  const moodFieldset = document.getElementById('moodFieldset');
  const moodInputs = Array.from(document.querySelectorAll('input[name="mood"]'));
  const moodFeedback = document.getElementById('moodFeedback');

  // 메모/노트 영역
  const note = document.getElementById('note');
  const charCount = document.getElementById('charCount');
  const tagButtons = Array.from(document.querySelectorAll('.note__tag-btn'));

  // 시간 입력 + 빠른 선택 버튼
  const timeInput = document.getElementById('takeTime');
  const timeFeedback = document.getElementById('timeFeedback');
  const timeButtons = Array.from(document.querySelectorAll('.time__quick-btn'));
  const openTimeWheelBtn = document.getElementById('openTimeWheel');

  // 시간 선택 모달(휠)
  const timeModal = document.getElementById('timeModal');
  const hourCol = document.getElementById('hourCol');
  const minCol = document.getElementById('minCol');
  const timeClose = document.getElementById('timeClose');
  const timeCancel = document.getElementById('timeCancel');
  const timeApply = document.getElementById('timeApply');

  // 알림 설정 영역
  const notifSave = document.getElementById('notifSave');
  const notifMaster = document.getElementById('notifMaster');
  const notifFeedback = document.getElementById('notifFeedback');

  
  /* 공통 유틸 함수 */

  // 현재 시각 "HH:MM" 문자열로 반환
  function nowTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // 토스트 메시지 출력
  function showToast(msg) {
    const textEl = toast.querySelector('.toast__text');
    if (textEl) textEl.textContent = msg;
    toast.hidden = false;

    setTimeout(() => {
      toast.hidden = true;
    }, 1600);
  }


  /* 컨디션(기분) 관련 함수 */

  // 선택된 컨디션 radio 정보 반환 { value, text } 또는 null
  function selectedMood() {
    const checked = moodInputs.find((i) => i.checked);
    if (!checked) return null;

    const label = document.querySelector(`label[for="${checked.id}"]`);

    const text =
      label?.dataset?.label ||
      label?.querySelector('.mood__text')?.textContent ||
      '';

    return { value: checked.value, text };
  }

  // 컨디션 피드백 문구 업데이트
  function updateMoodFeedback() {
    const m = selectedMood();
    moodFeedback.textContent = m ? `컨디션: ${m.text}` : '';
  }

  // 복용 완료 후 컨디션/노트 잠그기 또는 잠금 해제
  function lockMoodAndNote(lock) {
    if (lock) {
      moodFieldset.classList.add('is-locked');
      moodInputs.forEach((i) => (i.disabled = true));
      note.setAttribute('disabled', 'true');
    } else {
      moodFieldset.classList.remove('is-locked');
      moodInputs.forEach((i) => (i.disabled = false));
      note.removeAttribute('disabled');
    }
  }


  /* 시간 관련 유틸 함수 */

  // Date 객체를 "HH:MM" 형식으로 input에 세팅
  function setTimeToInput(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    timeInput.value = `${hh}:${mm}`;
  }

  // 최초 기본 시간 세팅 (현재 시각)
  function initDefaultTime() {
    const d = new Date();
    setTimeToInput(d);
    timeFeedback.textContent = `기본값: 현재 시각 ${nowTime()}`;
  }

  // 시간 입력 및 관련 버튼 활성/비활성
  function lockTime(lock) {
    const btns = document.querySelectorAll(
      '.time__quick-btn,.time__toggle-btn'
    );

    if (lock) {
      timeInput.setAttribute('disabled', 'true');
      btns.forEach((b) => b.setAttribute('disabled', 'true'));
    } else {
      timeInput.removeAttribute('disabled');
      btns.forEach((b) => b.removeAttribute('disabled'));
    }
  }


  /* 시간 휠 모달 생성/조작 */

  // 시간 휠 컬럼 DOM 생성 (시/분)
  function buildWheel(stepMin = 5) {
    hourCol.innerHTML = '';
    minCol.innerHTML = '';

    // 시(00~23)
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const el = document.createElement('div');
      el.className = 'time-modal__wheel-item';
      el.dataset.value = hh;
      el.setAttribute('role', 'option');
      el.textContent = hh;
      hourCol.appendChild(el);
    }

    // 분(00, 05, 10, ...)
    for (let m = 0; m < 60; m += stepMin) {
      const mm = String(m).padStart(2, '0');
      const el = document.createElement('div');
      el.className = 'time-modal__wheel-item';
      el.dataset.value = mm;
      el.setAttribute('role', 'option');
      el.textContent = mm;
      minCol.appendChild(el);
    }
  }

  // 특정 컬럼에서 value에 해당하는 아이템 선택 표시
  function selectWheelItem(col, val) {
    const prev = col.querySelector('[aria-selected="true"]');
    if (prev) prev.removeAttribute('aria-selected');

    const el = col.querySelector(`[data-value="${val}"]`);
    if (el) {
      el.setAttribute('aria-selected', 'true');
      el.scrollIntoView({ block: 'center' });
    }
  }

  // 현재 input 또는 현재 시각 기준으로 휠 선택값 맞추기
  function setWheelToCurrent() {
    const [h, m] = (timeInput.value || nowTime()).split(':');
    const roundedM = String(
      Math.round(parseInt(m, 10) / 5) * 5
    ).padStart(2, '0');

    selectWheelItem(hourCol, h);
    selectWheelItem(minCol, roundedM);
  }

  // 시간 휠 모달 열기
  function openWheel() {
    buildWheel(5);
    setWheelToCurrent();
    timeModal.hidden = false;
  }

  // 시간 휠 모달 닫기
  function closeWheel() {
    timeModal.hidden = true;
  }

  // 휠 아이템 클릭 핸들러 (시/분 공용)
  function onWheelClick(e) {
    const item = e.target.closest('.time-modal__wheel-item');
    if (!item) return;

    selectWheelItem(e.currentTarget, item.dataset.value);
  }


  /* 복용 완료 / 되돌리기 처리 */

  // "복용하기" 버튼 클릭 시 처리
  function markCompleted() {
    // 버튼 상태 변경
    takeBtn.classList.add('is-done');
    takeBtn.setAttribute('aria-pressed', 'true');
    takeBtn.disabled = true;

    // 버튼 라벨 텍스트 변경
    const labelSpan = takeBtn.querySelector('.pill__take-label');
    if (labelSpan) labelSpan.textContent = '복용 완료';

    // 피드백 텍스트
    feedback.textContent = `오늘 ${nowTime()}에 복용 기록됨`;

    // 되돌리기 UI 표시
    undoWrap.hidden = false;

    // 토스트 노출
    showToast('복용이 기록되었습니다.');

    // 컨디션/노트 잠그기
    lockMoodAndNote(true);

    // 시간이 비어있는 경우 현재 시각으로 세팅
    if (!timeInput.value) {
      setTimeToInput(new Date());
    }

    // 시간 관련 입력/버튼 잠그기
    lockTime(true);

    // 컨디션 피드백 최신화
    updateMoodFeedback();
  }

  // "되돌리기" 버튼 클릭 시 처리 (복용 기록 취소)
  function undoCompleted() {
    takeBtn.classList.remove('is-done');
    takeBtn.setAttribute('aria-pressed', 'false');
    takeBtn.disabled = false;

    const labelSpan = takeBtn.querySelector('.pill__take-label');
    if (labelSpan) labelSpan.textContent = '복용하기';

    feedback.textContent = '';
    undoWrap.hidden = true;

    showToast('기록을 취소했습니다.');

    // 다시 컨디션/노트 수정 가능
    lockMoodAndNote(false);
    lockTime(false);
  }


  /* 메모(노트) 관련 처리 */

  // 글자 수 카운트 업데이트
  function updateCharCount() {
    charCount.textContent = `${note.value.length} / ${note.getAttribute(
      'maxlength'
    )}`;
  }

  // 태그 버튼 클릭 시 #태그 자동 추가
  function handleTagClick(btn) {
    const tag = btn.dataset.tag;
    const prefix = note.value && !note.value.endsWith(' ') ? ' ' : '';
    note.value += `${prefix}#${tag}`;
    note.dispatchEvent(new Event('input')); // input 이벤트 강제 발생
    note.focus();
  }

  /* 알림 설정 관련 처리 */

  function handleNotifSave() {
    const snooze =
      document.querySelector('input[name="snooze"]:checked')?.value || '5';

    notifFeedback.textContent = `알림 ${
      notifMaster.checked ? '켜짐' : '꺼짐'
    }, 재알림 ${snooze}분`;

    showToast('알림 설정이 저장되었습니다.');
  }


  /* 이벤트 바인딩 */

  // 복용 / 되돌리기
  takeBtn.addEventListener('click', markCompleted);
  undoBtn.addEventListener('click', undoCompleted);

  // 미복용 표시
  skipBtn.addEventListener('click', () => {
    feedback.textContent = `미복용으로 표시됨 (오늘 ${nowTime()})`;
    if (undoWrap) undoWrap.hidden = false;
    showToast('미복용으로 표시했습니다.');
  });

  // 컨디션 선택 변경 시 피드백 업데이트
  moodInputs.forEach((i) =>
    i.addEventListener('change', updateMoodFeedback)
  );

  // 노트 입력 시 글자 수 업데이트
  note.addEventListener('input', updateCharCount);
  // 초기 글자 수 세팅
  updateCharCount();

  // 노트 태그 버튼 클릭
  tagButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleTagClick(btn));
  });

  // 시간 빠른 설정(지금, ±분)
  timeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.shift;
      const d = new Date();

      if (mode === 'now') {
        // 현재 시각 그대로 세팅
        setTimeToInput(d);
        timeFeedback.textContent = '현재 시각으로 설정됨';
      } else {
        // 현재 값 기준으로 ±분 조정
        const current = new Date();

        if (timeInput.value) {
          const [h, m] = timeInput.value.split(':');
          current.setHours(parseInt(h, 10));
          current.setMinutes(parseInt(m, 10));
        }

        const delta = parseInt(mode, 10);
        current.setMinutes(current.getMinutes() + delta);

        setTimeToInput(current);
        timeFeedback.textContent = `${delta > 0 ? '+' : ''}${delta}분 조정됨`;
      }
    });
  });

  // 시간 휠 모달 열기/닫기
  if (openTimeWheelBtn) {
    openTimeWheelBtn.addEventListener('click', openWheel);
  }
  if (timeClose) {
    timeClose.addEventListener('click', closeWheel);
  }
  if (timeCancel) {
    timeCancel.addEventListener('click', closeWheel);
  }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (timeModal.hidden) return;
    if (e.key === 'Escape') closeWheel();
  });

  // 휠 컬럼 클릭 (시/분)
  if (hourCol) {
    hourCol.addEventListener('click', onWheelClick);
  }
  if (minCol) {
    minCol.addEventListener('click', onWheelClick);
  }

  // "적용" 버튼: 휠에서 선택된 시/분을 input에 반영
  if (timeApply) {
    timeApply.addEventListener('click', () => {
      const selH =
        hourCol.querySelector('[aria-selected="true"]')?.dataset.value;
      const selM =
        minCol.querySelector('[aria-selected="true"]')?.dataset.value;

      if (selH && selM) {
        timeInput.value = `${selH}:${selM}`;
        timeFeedback.textContent = `${selH}:${selM}로 설정됨`;
      }
      closeWheel();
    });
  }

  // 알림 설정 저장 버튼
  if (notifSave) {
    notifSave.addEventListener('click', handleNotifSave);
  }

  /* 초기화 */
  initDefaultTime();
})();
