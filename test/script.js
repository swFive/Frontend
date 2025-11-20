
(function () {
  const takeBtn = document.getElementById('takeBtn');
  const skipBtn = document.getElementById('skipBtn');
  const feedback = document.getElementById('pillFeedback');
  const toast = document.getElementById('toast');
  const undoWrap = document.querySelector('.pill__undo-wrap');
  const undoBtn = document.getElementById('undoBtn');

  const moodFieldset = document.getElementById('moodFieldset');
  const moodInputs = Array.from(document.querySelectorAll('input[name="mood"]'));
  const moodFeedback = document.getElementById('moodFeedback');

  const note = document.getElementById('note');
  const charCount = document.getElementById('charCount');
  const tagButtons = Array.from(document.querySelectorAll('.note__tag-btn'));

  const timeInput = document.getElementById('takeTime');
  const timeFeedback = document.getElementById('timeFeedback');
  const timeButtons = Array.from(document.querySelectorAll('.time__quick-btn'));
  const openTimeWheelBtn = document.getElementById('openTimeWheel');

  const timeModal = document.getElementById('timeModal');
  const hourCol = document.getElementById('hourCol');
  const minCol = document.getElementById('minCol');
  const timeClose = document.getElementById('timeClose');
  const timeCancel = document.getElementById('timeCancel');
  const timeApply = document.getElementById('timeApply');

  function nowTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  function showToast(msg) {
    const textEl = toast.querySelector('.toast__text');
    if (textEl) textEl.textContent = msg;
    toast.hidden = false;
    setTimeout(() => {
      toast.hidden = true;
    }, 1600);
  }

  function selectedMood() {
    const checked = moodInputs.find(i => i.checked);
    if (!checked) return null;
    const label = document.querySelector(`label[for="${checked.id}"]`);
    const text =
      label?.dataset?.label ||
      label?.querySelector('.mood__text')?.textContent ||
      '';
    return { value: checked.value, text };
  }

  function updateMoodFeedback() {
    const m = selectedMood();
    moodFeedback.textContent = m ? `컨디션: ${m.text}` : '';
  }

  function lockMoodAndNote(lock) {
    if (lock) {
      moodFieldset.classList.add('is-locked');
      moodInputs.forEach(i => (i.disabled = true));
      note.setAttribute('disabled', 'true');
    } else {
      moodFieldset.classList.remove('is-locked');
      moodInputs.forEach(i => (i.disabled = false));
      note.removeAttribute('disabled');
    }
  }

  function setTimeToInput(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    timeInput.value = `${hh}:${mm}`;
  }
  function initDefaultTime() { const d=new Date(); setTimeToInput(d); timeFeedback.textContent = `기본값: 현재 시각 ${nowTime()}`; }
  function lockTime(lock) {
    const btns = document.querySelectorAll('.time__quick-btn,.time__toggle-btn');
    if (lock) {
     timeInput.setAttribute('disabled','true');
     btns.forEach(b => b.setAttribute('disabled','true'));
   } else {
     timeInput.removeAttribute('disabled');
     btns.forEach(b => b.removeAttribute('disabled'));
   }
  }


  function buildWheel(stepMin=5) {
    hourCol.innerHTML=''; minCol.innerHTML='';
    for (let h=0; h<24; h++){ const hh=String(h).padStart(2,'0'); const el=document.createElement('div'); el.className='time-modal__wheel-item'; el.dataset.value=hh; el.setAttribute('role','option'); el.textContent=hh; hourCol.appendChild(el); }
    for (let m=0; m<60; m+=stepMin){ const mm=String(m).padStart(2,'0'); const el=document.createElement('div'); el.className='time-modal__wheel-item'; el.dataset.value=mm; el.setAttribute('role','option'); el.textContent=mm; minCol.appendChild(el); }
  }
  function selectWheelItem(col,val){ const prev=col.querySelector('[aria-selected="true"]'); if(prev) prev.removeAttribute('aria-selected'); const el=col.querySelector(`[data-value="${val}"]`); if(el){ el.setAttribute('aria-selected','true'); el.scrollIntoView({block:'center'}); } }
  function setWheelToCurrent(){ const [h,m]=(timeInput.value||nowTime()).split(':'); const roundedM=String(Math.round(parseInt(m,10)/5)*5).padStart(2,'0'); selectWheelItem(hourCol,h); selectWheelItem(minCol,roundedM); }
  function openWheel(){ buildWheel(5); setWheelToCurrent(); timeModal.hidden=false; }
  function closeWheel(){ timeModal.hidden=true; }

  function markCompleted(){takeBtn.classList.add('is-done'); takeBtn.setAttribute('aria-pressed','true'); takeBtn.disabled = true; const labelSpan = takeBtn.querySelector('.pill__take-label'); if (labelSpan) labelSpan.textContent = '복용 완료'; feedback.textContent = `오늘 ${nowTime()}에 복용 기록됨`; undoWrap.hidden = false; showToast('복용이 기록되었습니다.'); lockMoodAndNote(true); if (!timeInput.value) setTimeToInput(new Date()); lockTime(true); updateMoodFeedback();}
  function undoCompleted(){ takeBtn.classList.remove('is-done'); takeBtn.setAttribute('aria-pressed','false'); takeBtn.disabled = false; const labelSpan = takeBtn.querySelector('.pill__take-label'); if (labelSpan) labelSpan.textContent = '복용하기'; feedback.textContent = ''; undoWrap.hidden = true; showToast('기록을 취소했습니다.'); lockMoodAndNote(false); lockTime(false);}
  function updateMoodFeedback(){ const m=selectedMood(); moodFeedback.textContent = m ? `컨디션: ${m.text}` : ''; }

  takeBtn.addEventListener('click',markCompleted); undoBtn.addEventListener('click',undoCompleted);
  skipBtn.addEventListener('click',()=>{ feedback.textContent=`미복용으로 표시됨 (오늘 ${nowTime()})`; if (undoWrap) undoWrap.hidden = false; showToast('미복용으로 표시했습니다.'); });
  moodInputs.forEach(i=>i.addEventListener('change',updateMoodFeedback));
  note.addEventListener('input',()=>{ charCount.textContent = `${note.value.length} / ${note.getAttribute('maxlength')}`; });
  charCount.textContent = `0 / ${note.getAttribute('maxlength')}`;
  tagButtons.forEach(btn=>{ btn.addEventListener('click',()=>{ const tag=btn.dataset.tag; const prefix = note.value && !note.value.endsWith(' ') ? ' ' : ''; note.value += `${prefix}#${tag}`; note.dispatchEvent(new Event('input')); note.focus(); }); });

  timeButtons.forEach(btn=>{ btn.addEventListener('click',()=>{ const mode=btn.dataset.shift; const d=new Date(); if(mode==='now'){ setTimeToInput(d); timeFeedback.textContent='현재 시각으로 설정됨'; } else { const current=new Date(); if(timeInput.value){ const [h,m]=timeInput.value.split(':'); current.setHours(parseInt(h,10)); current.setMinutes(parseInt(m,10)); } const delta=parseInt(mode,10); current.setMinutes(current.getMinutes()+delta); setTimeToInput(current); timeFeedback.textContent = `${delta>0?'+':''}${delta}분 조정됨`; } }); });

  if(openTimeWheelBtn) openTimeWheelBtn.addEventListener('click',openWheel);
  if(timeClose) timeClose.addEventListener('click',closeWheel);
  if(timeCancel) timeCancel.addEventListener('click',closeWheel);
  document.addEventListener('keydown',(e)=>{ if(timeModal.hidden) return; if(e.key==='Escape') closeWheel(); });
  function onWheelClick(e){ const item=e.target.closest('.time-modal__wheel-item'); if(!item) return; selectWheelItem(e.currentTarget,item.dataset.value); }
  hourCol.addEventListener('click',onWheelClick); minCol.addEventListener('click',onWheelClick);
  if(timeApply) timeApply.addEventListener('click',()=>{ const selH=hourCol.querySelector('[aria-selected="true"]')?.dataset.value; const selM=minCol.querySelector('[aria-selected="true"]')?.dataset.value; if(selH&&selM){ timeInput.value=`${selH}:${selM}`; timeFeedback.textContent=`${selH}:${selM}로 설정됨`; } closeWheel(); });

  const notifSave = document.getElementById('notifSave');
  const notifMaster = document.getElementById('notifMaster');
  const notifFeedback = document.getElementById('notifFeedback');
  if(notifSave) notifSave.addEventListener('click',()=>{
    const snooze = document.querySelector('input[name="snooze"]:checked')?.value || '5';
    notifFeedback.textContent = `알림 ${notifMaster.checked ? '켜짐' : '꺼짐'}, 재알림 ${snooze}분`;
    showToast('알림 설정이 저장되었습니다.');
  });

  initDefaultTime();
})();