document.addEventListener('DOMContentLoaded', () => {
  const edits = document.querySelectorAll('.drug-rule-info__edit');
  edits.forEach((edit) => {
    edit.addEventListener('click', () => {
      if (typeof window.showToast === 'function') {
        window.showToast('수정 기능은 준비 중입니다.', { type: 'info', duration: 2000 });
      } else {
        alert('수정 기능은 준비 중입니다.');
      }
    });
  });
});
