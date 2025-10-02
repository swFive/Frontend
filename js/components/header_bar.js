// 모바일 하단바 자동 숨김/표시 기능
// - 639px 이하에서만 동작
// - 아래로 스크롤 시 숨김, 위로 스크롤 시 노출
// - 과도한 이벤트를 줄이기 위해 간단한 스로틀 적용
export function initHeaderBarHide() {
  const headerBar = document.querySelector('.header_bar');
  if (!headerBar) return;

  let lastScrollY = window.scrollY;
  let ticking = false; // requestAnimationFrame 스로틀 플래그

  const onScroll = () => {
    if (window.innerWidth > 639) return; // 데스크탑에서는 무시
    const currentY = window.scrollY;
    // 스크롤 방향 판별 (변화가 거의 없을 때는 상태 유지)
    if (currentY - lastScrollY > 2) {
      headerBar.classList.add('hide');
    } else if (lastScrollY - currentY > 2) {
      headerBar.classList.remove('hide');
    }
    lastScrollY = currentY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  // 초기 위치가 맨 위인 경우 노출 상태로 보장
  if (window.scrollY <= 0) headerBar.classList.remove('hide');
}
