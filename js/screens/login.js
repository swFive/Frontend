/**
 * 목적:
 * - 실제 카카오 OAuth 연동이 아닌 개발/테스트 편의를 위한 "모의 로그인" UI 및 흐름을 제공.
 * - 사용자가 '카카오 로그인' 버튼을 클릭하면 모달을 띄우고 Kakao OAuth 동의 흐름을 흉내낸 뒤
 *   API_BASE_URL을 prefix로 하는 백엔드(/my-info)를 호출해 사용자 정보를 가져오고, 이를 로컬스토리지(localStorage)와
 *   세션스토리지(sessionStorage)에 반영한 뒤 index.html로 리다이렉트한다.
 *
 * 주요 동작 요약:
 * 1. DOMContentLoaded 시 초기화: 페이지에서 카카오 로그인 앵커(#login_buttons__kakao__spanbox a) 또는
 *    로그인 박스(#login_buttons__kakao)를 찾아 클릭 핸들러 연결.
 * 2. 클릭 시 모달을 띄워 사용자 동의 흐름 시뮬레이션: '동의하고 계속'을 누르면 /my-info를 호출해 현재 사용자 정보를 확보.
 * 3. 로그인 처리: localStorage.mc_user에 사용자 객체 저장, sessionStorage.mc_toast에 완료 토스트 플래그 저장,
 *    (있으면) window.updateHeaderLoginState() 호출, 그리고 index.html로 이동.
 *
 * 보안/주의:
 * - 이 스크립트는 테스트용입니다. 실제 배포 시에는 서버 기반 인증, 토큰 관리, CSRF/보안 고려가 필수입니다.
 * - API_BASE_URL을 실제 스프링 서버 주소로 바꿔서 /my-info 등 API 테스트도 수행할 수 있도록 설계되어 있습니다.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 페이지에서 카카오 로그인 관련 DOM 요소 찾아두기
  // - kakaoAnchor: 카카오 로그인 텍스트/링크(테스트 버튼) — 실제 버튼이 a 태그일 때 사용
  // - loginBox: 카카오 로그인 전체 박스(버튼 외 영역에 클릭 바인딩할 경우 사용)
  const kakaoAnchor = document.querySelector('#login_buttons__kakao__spanbox a');
  const loginBox = document.querySelector('#login_buttons__kakao');
  const ACCESS_TOKEN_STORAGE_KEY = 'mc_access_token';

  // ---------------------------
  // API 설정 (선택적)
  // ---------------------------
  // 실제 서버로 테스트할 때 여기를 자신의 스프링 서버 주소로 교체
  // 예: const API_BASE_URL = "http://localhost:8080";
  const API_BASE_URL = "http://localhost:8080";

  // ---------------------------
  // 로그 출력 헬퍼 (디버깅용)
  // ---------------------------
  // - 페이지 내에 <textarea id="log"> 또는 <pre id="log"> 같은 요소가 있으면 로그를 누적 출력.
  // - 개발 중 API 호출/응답을 화면에서 바로 확인할 수 있음.
  function appendLoginLog(message) {
    const logEl = document.getElementById("log");
    if (!logEl) return;
    const time = new Date().toLocaleTimeString();
    logEl.textContent += `[${time}] ${message}\n`;
  }

  // ---------------------------
  // 공통 fetch 래퍼 (JSON 요청/응답 처리)
  // ---------------------------
  // - API_BASE_URL을 prefix로 하여 fetch 호출
  // - 응답 상태가 ok가 아니면 텍스트를 읽어 화면 로그에 표시
  // - JSON 파싱 실패 시에도 예외를 피하고 null을 반환
  async function callLoginApi(path, options = {}) {
    try {
      const { accessToken, headers: customHeaders, ...restOptions } = options;
      const headers = { ...(customHeaders || {}) };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      if (!headers["Content-Type"] && restOptions.body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(API_BASE_URL + path, {
        ...restOptions,
        headers
      });

      if (!response.ok) {
        const text = await response.text();
        appendLoginLog(`오류: ${response.status} ${response.statusText} - ${text}`);
        return;
      }

      // JSON 파싱. 실패해도 프로그램 흐름은 유지
      const data = await response.json().catch(() => null);
      appendLoginLog(`성공: ${JSON.stringify(data, null, 2)}`);
      return data;
    } catch (error) {
      appendLoginLog(`예외 발생: ${error}`);
    }
  }

  // ---------------------------
  // GET /my-info 호출 함수 (테스트 용)
  // ---------------------------
  // - 페이지에 accessToken 입력 필드(#accessToken)가 있으면 그 값을 Authorization 헤더로 사용
  // - 서버에서 현재 로그인된 사용자 정보를 반환하는 엔드포인트 테스트에 사용
  function resolveAccessToken() {
    const tokenInput = document.getElementById("accessToken");
    const inlineToken = tokenInput ? tokenInput.value.trim() : "";
    if (inlineToken) return inlineToken;
    const stored = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return stored ? stored.trim() : "";
  }

  async function callMyInfo() {
    const accessToken = resolveAccessToken();

    appendLoginLog(
      `GET /my-info 호출 (Authorization 헤더: ${accessToken ? "Bearer {token}" : "없음"})`
    );

    await callLoginApi("/my-info", {
      method: "GET",
      accessToken
    });
  }

  // 버튼이 DOM에 있으면 클릭으로 callMyInfo 실행하도록 바인딩
  // (참고: 이 파일 최상단에서 이미 DOMContentLoaded로 감싸고 있으므로 실제로는 중복 바인딩 가능 — 아래 주석 참고)
  window.addEventListener("DOMContentLoaded", () => {
    const btnMyInfo = document.getElementById("btnMyInfo");
    if (btnMyInfo) {
      btnMyInfo.addEventListener("click", callMyInfo);
    }
  });

  // ---------------------------
  // 모달: 카카오 로그인 팝업 생성 및 보장 함수
  // ---------------------------
  // - 접근성: modal에 role="dialog"와 aria-modal="true"를 설정
  // - 오버레이 클릭이나 닫기 버튼으로 모달 닫기 가능
  // - 필요한 스타일은 inline style로 적용(간단한 모달 목적)
  const ensureKakaoPopup = () => {
    let overlay = document.getElementById('kakaoLoginOverlay');
    if (overlay) return overlay;

    // 오버레이(배경)
    overlay = document.createElement('div');
    overlay.id = 'kakaoLoginOverlay';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:3000',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.4)'
    ].join(';');

    // 모달 본체
    const modal = document.createElement('div');
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.style.cssText = [
      'width:min(92vw,420px)',
      'border-radius:16px',
      'background:#fff',
      'box-shadow:0 10px 40px rgba(0,0,0,0.2)',
      'padding:20px 18px 16px',
      'box-sizing:border-box',
      'text-align:center'
    ].join(';');

    // 모달 내용(제목, 안내문, 동의 버튼, 취소 버튼)
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

    // 닫기 헬퍼
    const remove = () => { overlay.remove(); };

    // 오버레이 바깥을 클릭하면 모달 닫기
    overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });

    // 각 버튼 이벤트 바인딩
    modal.querySelector('#kakaoPopupClose')?.addEventListener('click', remove);
    modal.querySelector('#kakaoPopupCancel')?.addEventListener('click', remove);

    return overlay;
  };

  // ---------------------------
  // 모달을 열고 '동의하고 계속' 클릭 시 로그인 처리 흐름
  // ---------------------------
  const openKakaoPopup = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // 오버레이 생성 또는 재사용
    const overlay = ensureKakaoPopup();
    const continueBtn = overlay.querySelector('#kakaoPopupContinue');
    if (!continueBtn) return;

    // '동의하고 계속' 버튼 클릭 시 실행할 비동기 핸들러
    const onContinue = async () => {
      try {
        const accessToken = resolveAccessToken();
        appendLoginLog(
          `카카오 로그인 진행 - /my-info 요청 (Authorization: ${accessToken ? "포함" : "미포함"})`
        );

        // 인증이 성공하면 /my-info에서 { id, nickname } JSON을 받을 것으로 명세됨
        const myInfo = await callLoginApi('/my-info', {
          method: 'GET',
          accessToken
        });

        if (!myInfo || typeof myInfo !== 'object') {
          throw new Error('사용자 정보를 불러오지 못했습니다. /my-info 응답을 확인하세요.');
        }

        if (myInfo.error) {
          throw new Error(myInfo.error);
        }

        // 명세: 성공 시 { id, nickname } → 내부 사용자 객체 구성
        const user = {
          id: myInfo.id ?? `kakao-user-${Date.now()}`,
          user_id: myInfo.id ?? null,
          name: myInfo.nickname || '카카오 사용자',
          nickname: myInfo.nickname || '',
          provider: 'kakao',
          loggedAt: Date.now(),
        };

        console.log('[LOGIN SUCCESS] kakao id:', user.user_id, 'nickname:', user.nickname);
        console.log('[LOGIN SUCCESS] full user object:', user);

        // 4) localStorage에 사용자 정보 저장 (키: mc_user)
        //    - 실제 서비스에서는 localStorage에 민감 정보를 저장하면 안 됨. 토큰은 HttpOnly 쿠키나 안전한 스토리지에.
        try {
          localStorage.setItem('mc_user', JSON.stringify(user));
          if (accessToken) {
            localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
          }
        } catch (err) {
          console.error('localStorage set error', err);
        }

        // 5) 세션 저장소에 토스트 표시 플래그 저장
        //    - 리다이렉트 후 index 페이지에서 sessionStorage 값을 읽어 토스트를 자동 표시하는 패턴
        try {
          sessionStorage.setItem(
            'mc_toast',
            JSON.stringify({ type: 'success', message: '로그인되었어요.' })
          );
        } catch {}

        // 6) 헤더 UI가 별도 스크립트로 로그인 상태를 표시한다면 갱신 함수 호출
        try {
          if (window.updateHeaderLoginState) window.updateHeaderLoginState();
        } catch {}

        // 7) 로그인 후 인덱스 페이지로 이동(리다이렉트)
        window.location.href = './index.html';
      } catch (error) {
        // 실패 시 사용자에게 알리고 콘솔에 에러 출력
        console.error('[LOGIN ERROR]', error);
        appendLoginLog(`로그인 실패: ${error.message || error}`);
        alert('로그인에 실패했습니다. Access Token과 API 상태를 확인해주세요.');
      }
    };

    // 클릭 핸들러를 한 번만 등록 (once: true)
    continueBtn.addEventListener('click', onContinue, { once: true });
  };

  // ---------------------------
  // 실제로 클릭 이벤트 연결 (kakaoAnchor 우선, 없으면 loginBox)
  // ---------------------------
  if (kakaoAnchor) {
    kakaoAnchor.addEventListener('click', openKakaoPopup);
  } else if (loginBox) {
    loginBox.addEventListener('click', openKakaoPopup);
  }

  // ---------------------------
  // 이메일 로그인 & 회원가입 UI
  // ---------------------------
  const REGISTER_KEY = 'mc_registered_users';
  const SAVED_EMAIL_KEY = 'mc_saved_login_email';
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authFeedback = document.getElementById('authFeedback');
  const rememberMe = document.getElementById('rememberMe');
  const termsRequired = document.getElementById('termsRequired');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const formsByName = {
    login: loginForm,
    signup: signupForm,
  };

  function fireToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, { type });
    } else {
      alert(message);
    }
  }

  function getRegisteredUsers() {
    try {
      return JSON.parse(localStorage.getItem(REGISTER_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveRegisteredUsers(list) {
    localStorage.setItem(REGISTER_KEY, JSON.stringify(list));
  }

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (input) {
      if (message) {
        input.classList.add('has-error');
      } else {
        input.classList.remove('has-error');
      }
    }
    const errorEl = document.querySelector(`[data-error-for="${inputId}"]`);
    if (errorEl) errorEl.textContent = message || '';
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('input').forEach((input) => input.classList.remove('has-error'));
    form.querySelectorAll('.auth-field__error').forEach((el) => (el.textContent = ''));
  }

  function setFeedback(message, type = 'info') {
    if (!authFeedback) return;
    authFeedback.textContent = message || '';
    authFeedback.dataset.type = type;
  }

  function switchAuthForm(target) {
    authTabs.forEach((tab) => {
      const isActive = tab.dataset.target === target;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    Object.entries(formsByName).forEach(([name, form]) => {
      if (!form) return;
      form.classList.toggle('is-active', name === target);
    });
    setFeedback('', 'info');
  }

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchAuthForm(tab.dataset.target));
  });

  function prefillLoginEmail() {
    const emailInput = document.getElementById('loginEmail');
    if (!emailInput) return;
    if (rememberMe && rememberMe.checked) return;
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      emailInput.value = saved;
      if (rememberMe) rememberMe.checked = true;
    }
  }

  function persistLoginUser(user, rememberEmail, emailValue) {
    const payload = { ...user, loggedAt: Date.now() };
    localStorage.setItem('mc_user', JSON.stringify(payload));
    if (rememberEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, emailValue);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }
    try {
      if (window.updateHeaderLoginState) window.updateHeaderLoginState();
    } catch {}
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    if (!loginForm) return;
    clearFormErrors(loginForm);
    setFeedback('', 'info');

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value.trim() || '';
    let hasError = false;

    if (!emailRegex.test(email)) {
      setFieldError('loginEmail', '올바른 이메일을 입력해주세요.');
      hasError = true;
    }
    if (!password || password.length < 8) {
      setFieldError('loginPassword', '비밀번호는 8자 이상 입력해주세요.');
      hasError = true;
    }
    if (hasError) {
      setFeedback('입력값을 다시 확인해주세요.', 'error');
      fireToast('로그인 정보를 확인해주세요.', 'error');
      return;
    }

    const users = getRegisteredUsers();
    const matched = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      setFieldError('loginEmail', '가입된 이메일이 아닙니다.');
      setFeedback('가입 정보를 찾을 수 없습니다.', 'error');
      fireToast('가입 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    if (matched.password !== password) {
      setFieldError('loginPassword', '비밀번호가 일치하지 않습니다.');
      setFeedback('비밀번호를 다시 확인해주세요.', 'error');
      fireToast('비밀번호를 확인해주세요.', 'error');
      return;
    }

    persistLoginUser(matched, rememberMe?.checked, email);
    fireToast('로그인되었어요.', 'success');
    setFeedback('로그인에 성공했습니다.', 'success');
    sessionStorage.setItem('mc_toast', JSON.stringify({ type: 'success', message: '환영합니다!' }));
    window.location.href = './index.html';
  }

  function handleSignupSubmit(event) {
    event.preventDefault();
    if (!signupForm) return;
    clearFormErrors(signupForm);
    setFeedback('', 'info');

    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const confirmInput = document.getElementById('signupPasswordConfirm');

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value.trim() || '';
    const confirm = confirmInput?.value.trim() || '';
    let hasError = false;

    if (!name) {
      setFieldError('signupName', '이름을 입력해주세요.');
      hasError = true;
    }
    if (!emailRegex.test(email)) {
      setFieldError('signupEmail', '올바른 이메일 주소를 입력해주세요.');
      hasError = true;
    }
    if (!password || password.length < 8) {
      setFieldError('signupPassword', '비밀번호는 8자 이상입니다.');
      hasError = true;
    }
    if (password !== confirm) {
      setFieldError('signupPasswordConfirm', '비밀번호가 일치하지 않습니다.');
      hasError = true;
    }
    if (!termsRequired?.checked) {
      setFeedback('필수 약관에 동의해주세요.', 'error');
      hasError = true;
    }
    if (hasError) {
      fireToast('입력 정보를 다시 확인해주세요.', 'error');
      return;
    }

    const users = getRegisteredUsers();
    const duplicated = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (duplicated) {
      setFieldError('signupEmail', '이미 가입된 이메일입니다.');
      setFeedback('다른 이메일을 사용해주세요.', 'error');
      fireToast('이미 가입된 이메일입니다.', 'error');
      return;
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      marketing: Boolean(document.getElementById('termsMarketing')?.checked),
    };
    users.push(newUser);
    saveRegisteredUsers(users);

    fireToast('회원가입이 완료되었습니다.', 'success');
    setFeedback('회원가입 완료! 로그인 탭에서 이어서 진행하세요.', 'success');
    signupForm.reset();
    switchAuthForm('login');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    if (loginEmailInput) loginEmailInput.value = email;
    loginPasswordInput?.focus();
  }

  loginForm?.addEventListener('submit', handleLoginSubmit);
  signupForm?.addEventListener('submit', handleSignupSubmit);

  prefillLoginEmail();
  switchAuthForm('login');

  // ---------------------------
  // 추가 설명 / 개선 포인트 (주석 내부 참고용)
  // ---------------------------
  // 1) DOMContentLoaded 중첩:
  //    - 파일 상단에서 이미 document.addEventListener('DOMContentLoaded', ...)로 전체를 감싸고 있음.
  //      중간에 window.addEventListener('DOMContentLoaded', ...)를 또 사용하는 부분은 중복이므로
  //      불필요하면 제거해도 됨(예: callMyInfo 버튼 바인딩은 최상단 DOMContentLoaded 블록 안에서 바로 처리).
  //
  // 2) 접근성:
  //    - 모달에 role="dialog"와 aria-modal="true"를 설정했지만 포커스 트랩(팝업 내부로 포커스를 가두는 처리)이 없음.
  //      실제 서비스로 옮길 때는 포커스 트랩과 키보드(ESC)로 닫기 처리를 추가하는 것이 좋음.
  //
  // 3) 보안:
  //    - localStorage에 민감한 사용자 정보를 저장하는 것은 권장되지 않음. 토큰/세션은 서버 측에서 관리하세요.
  //
  // 4) mock/login_user.json 구조 의존성:
  //    - 현재는 data.seedData.AppUsers[0]을 기본으로 사용함. 파일 구조가 바뀌면 코드도 수정 필요.
  //
  // 5) 리다이렉트 방식:
  //    - 현재는 window.location.href로 즉시 이동시키므로 SPA 환경이면 라우터 API로 이동시키는 것이 더 적절.
});
