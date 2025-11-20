document.addEventListener('DOMContentLoaded', () => {
  // 카카오 로그인 버튼(테스트용) 클릭 시 로컬에 로그인 플래그를 저장하고 인덱스로 이동
  const kakaoAnchor = document.querySelector('#login_buttons__kakao__spanbox a');
  const loginBox = document.querySelector('#login_buttons__kakao');
// 카카오 로그인 - 사용자 정보 조회 (/my-info)

// 본인 스프링 서버 주소로 바꾸면 됩니다.
// 예: 로컬에서 돌릴 때는 http://localhost:8080
const API_BASE_URL = "http://localhost:8080";

// 로그 출력 도우미 함수
function appendLoginLog(message) {
  const logEl = document.getElementById("log");
  if (!logEl) return;
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${message}\n`;
}

// 공통 fetch 래퍼: JSON 요청/응답 처리
async function callLoginApi(path, options = {}) {
  try {
    const response = await fetch(API_BASE_URL + path, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      const text = await response.text();
      appendLoginLog(`오류: ${response.status} ${response.statusText} - ${text}`);
      return;
    }

    const data = await response.json().catch(() => null);
    appendLoginLog(`성공: ${JSON.stringify(data, null, 2)}`);
    return data;
  } catch (error) {
    appendLoginLog(`예외 발생: ${error}`);
  }
}

// GET /my-info 호출 (현재 로그인한 사용자 정보 조회)
async function callMyInfo() {
  // 액세스 토큰 입력 필드에서 토큰 읽기 (선택)
  const tokenInput = document.getElementById("accessToken");
  const accessToken = tokenInput ? tokenInput.value.trim() : "";

  const headers = {};

  // 명세: Authorization: Bearer {access_token}
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  appendLoginLog(
    `GET /my-info 호출 (Authorization 헤더: ${accessToken ? "Bearer {token}" : "없음"})`
  );

  await callLoginApi("/my-info", {
    method: "GET",
    headers
  });
}

// 이벤트 리스너 등록
window.addEventListener("DOMContentLoaded", () => {
  const btnMyInfo = document.getElementById("btnMyInfo");

  if (btnMyInfo) {
    btnMyInfo.addEventListener("click", callMyInfo);
  }
});

  const ensureKakaoPopup = () => {
    let overlay = document.getElementById('kakaoLoginOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'kakaoLoginOverlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:3000','display:flex','align-items:center','justify-content:center',
      'background:rgba(0,0,0,0.4)'
    ].join(';');

    const modal = document.createElement('div');
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.style.cssText = [
      'width:min(92vw,420px)','border-radius:16px','background:#fff','box-shadow:0 10px 40px rgba(0,0,0,0.2)',
      'padding:20px 18px 16px','box-sizing:border-box','text-align:center'
    ].join(';');

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:18px">카카오 계정으로 로그인</strong>
        <button id="kakaoPopupClose" aria-label="닫기" style="border:none;background:transparent;font-size:20px;cursor:pointer">×</button>
      </div>
      <p style="font-size:14px;color:#555;margin:10px 0 18px;">동의 후 계속하면 서비스 약관에 동의하게 됩니다.</p>
      <button id="kakaoPopupContinue" style="width:100%;padding:12px 16px;border-radius:10px;border:none;background:#FEE500;color:#191600;font-weight:700;cursor:pointer">동의하고 계속</button>
      <button id="kakaoPopupCancel" style="margin-top:10px;width:100%;padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer">취소</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const remove = () => { overlay.remove(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });
    modal.querySelector('#kakaoPopupClose')?.addEventListener('click', remove);
    modal.querySelector('#kakaoPopupCancel')?.addEventListener('click', remove);
    return overlay;
  };

  const openKakaoPopup = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const overlay = ensureKakaoPopup();
    const continueBtn = overlay.querySelector('#kakaoPopupContinue');
    if (!continueBtn) return;

    const onContinue = () => {
      // 저장 후 이동
      const user = { provider: 'kakao', name: 'KakaoUser', loggedAt: Date.now() };
      try { localStorage.setItem('mc_user', JSON.stringify(user)); } catch (err) { console.error('localStorage set error', err); }
      // 성공 토스트 플래그를 세션 스토리지에 저장 (리다이렉트 후 자동 표시)
      try { sessionStorage.setItem('mc_toast', JSON.stringify({ type: 'success', message: '로그인되었어요.' })); } catch {}
      try { if (window.updateHeaderLoginState) window.updateHeaderLoginState(); } catch {}
      window.location.href = './index.html';
    };

    continueBtn.addEventListener('click', onContinue, { once: true });
  };

  if (kakaoAnchor) {
    kakaoAnchor.addEventListener('click', openKakaoPopup);
  } else if (loginBox) {
    loginBox.addEventListener('click', openKakaoPopup);
  }
});
