(function () {

  /**
   * 📌 toast 메시지를 담는 컨테이너(.toast-container)를 보장하는 함수
   * 없으면 body에 자동 생성해서 반환
   */
  function ensureContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) {
      c = document.createElement('div');
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * 📌 토스트 메시지 표시 함수
   * @param {string} message - 토스트에 표시할 문구
   * @param {object} opts - 옵션(type, duration)
   */
  function showToast(message, opts) {
    opts = opts || {};

    // type: success / error / info 등. 기본값 = success
    const type = opts.type || 'success';

    // 표시 시간 (최소 800ms 보장)
    const duration = Math.max(800, Number(opts.duration || 2200));

    // 토스트 영역(container) 생성/조회
    const container = ensureContainer();

    // 토스트 요소 생성
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');     // 접근성
    toast.setAttribute('aria-live', 'polite'); // 접근성(읽기 우선순위 낮음)

    // 메시지 영역
    const msg = document.createElement('span');
    msg.className = 'toast__msg';
    msg.textContent = message || '';

    // 닫기 버튼 생성
    const close = document.createElement('button');
    close.className = 'toast__close';
    close.setAttribute('aria-label', '닫기');
    close.textContent = '×';

    // 자식 요소 조립
    toast.appendChild(msg);
    toast.appendChild(close);

    /**
     * 📌 토스트 제거 애니메이션 처리
     * animation: toast-out 160ms 실행 → DOM에서 제거
     */
    let removing = false;
    const remove = () => {
      if (removing) return;      // 중복 실행 방지
      removing = true;

      toast.style.animation = 'toast-out 160ms ease-in forwards';
      setTimeout(() => {
        toast.remove();
      }, 170); // 애니메이션 끝난 뒤 실제 삭제
    };

    // 닫기 버튼 클릭 → 제거
    close.addEventListener('click', remove);

    // 화면에 토스트 삽입
    container.appendChild(toast);

    // 일정 시간 후 자동 제거
    const timer = setTimeout(remove, duration);

    // 마우스가 올라가면 자동 제거 취소(한 번만 실행)
    toast.addEventListener('mouseenter', () => clearTimeout(timer), { once: true });
  }

  /**
   * 📌 세션스토리지(sessionStorage)에 저장된 토스트 자동 실행
   *    예: 로그인 후 페이지 이동 → 완료 메시지 자동 출력
   *
   * 저장 형식:
   * sessionStorage.setItem('mc_toast', JSON.stringify({
   *   message: "로그인 성공",
   *   type: "success",
   *   duration: 2200
   * }));
   */
  function checkSessionToast() {
    try {
      const raw = sessionStorage.getItem('mc_toast');
      if (!raw) return;

      sessionStorage.removeItem('mc_toast'); // 한 번 표시 후 제거

      const data = JSON.parse(raw);

      showToast(
        data.message || '완료되었습니다.',
        {
          type: data.type || 'success',
          duration: data.duration || 2200
        }
      );
    } catch (e) {
      // JSON parse 오류 발생 시 무시
    }
  }

  /**
   * 📌 showToast 전역 등록
   * 외부에서 window.showToast("내용") 형태로 호출 가능
   */
  if (typeof window !== 'undefined') {
    window.showToast = showToast;
  }

  /**
   * 📌 DOM 로딩 완료 후 세션토스트 체크 실행
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSessionToast);
  } else {
    checkSessionToast();
  }

})();
