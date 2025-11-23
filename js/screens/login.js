/**
 * 목적:
 * - 실제 카카오 OAuth 연동이 아닌 개발/테스트 편의를 위한 "모의 로그인" UI 및 흐름을 제공.
 * - 사용자가 '카카오 로그인' 버튼을 클릭하면 모달을 띄우고 Kakao OAuth 동의 흐름을 흉내낸 뒤
 *   API_BASE_URL을 prefix로 하는 백엔드(/my-info)를 호출해 사용자 정보를 가져오고, 이를 로컬스토리지(localStorage)와
 *   세션스토리지(sessionStorage)에 반영한 뒤 index.html로 리다이렉트한다.
 *
 * 주의:
 * - 백엔드 세션/토큰 기반 인증을 사용하므로 Authorization 헤더 또는 세션 쿠키가 필요하다.
 * - 프런트와 백엔드 프로토콜(HTTP/HTTPS) 및 CORS 설정이 호환되어야 호출이 성공한다.
 */

document.addEventListener('DOMContentLoaded', () => {

  const kakaoAnchor = document.querySelector('#login_buttons__kakao__spanbox a');
  const loginBox = document.querySelector('#login_buttons__kakao');
  const ACCESS_TOKEN_STORAGE_KEY = 'mc_access_token';

  // ===== API 설정 =====
  const API_BASE_URL = window.__MC_API_BASE_URL__ || "http://202.31.246.29:8080/my-info";

  // ===== 로그 출력 헬퍼 =====
  function appendLoginLog(message) {
    const logEl = document.getElementById("log");
    if (!logEl) return;
    const time = new Date().toLocaleTimeString();
    logEl.textContent += `[${time}] ${message}\n`;
  }

  async function callLoginApi(path, options = {}) {
    try {
      const {
        accessToken,
        headers: customHeaders,
        withCredentials = true,
        ...restOptions
      } = options;

      const headers = { ...(customHeaders || {}) };

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      if (!headers["Content-Type"] && restOptions.body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(API_BASE_URL + path, {
        headers,
        credentials: withCredentials ? 'include' : 'same-origin',
        ...restOptions
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

  // ===== AccessToken resolve =====
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
      `GET /my-info 호출 (Authorization: ${accessToken ? "Bearer {token}" : "없음"})`
    );
    await callLoginApi("/my-info", { method: "GET", accessToken });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const btnMyInfo = document.getElementById("btnMyInfo");
    if (btnMyInfo) btnMyInfo.addEventListener("click", callMyInfo);
  });

  // ===== 모달 생성 =====
  const ensureKakaoPopup = () => {
    let overlay = document.getElementById('kakaoLoginOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'kakaoLoginOverlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:3000','display:flex',
      'align-items:center','justify-content:center','background:rgba(0,0,0,0.4)'
    ].join(';');

    const modal = document.createElement('div');
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.style.cssText = [
      'width:min(92vw,420px)','border-radius:16px','background:#fff',
      'box-shadow:0 10px 40px rgba(0,0,0,0.2)','padding:20px 18px 16px',
      'box-sizing:border-box','text-align:center'
    ].join(';');

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:18px">카카오 계정으로 로그인</strong>
        <button id="kakaoPopupClose" aria-label="닫기"
          style="border:none;background:transparent;font-size:20px;cursor:pointer">×</button>
      </div>
      <p style="font-size:14px;color:#555;margin:10px 0 18px;">
        동의 후 계속하면 서비스 약관에 동의하게 됩니다.
      </p>
      <button id="kakaoPopupContinue"
        style="width:100%;padding:12px 16px;border-radius:10px;border:none;background:#FEE500;color:#191600;font-weight:700;cursor:pointer">
        동의하고 계속
      </button>
      <button id="kakaoPopupCancel"
        style="margin-top:10px;width:100%;padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer">
        취소
      </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    modal.querySelector('#kakaoPopupClose')?.addEventListener('click', () => overlay.remove());
    modal.querySelector('#kakaoPopupCancel')?.addEventListener('click', () => overlay.remove());

    return overlay;
  };

  // ===== 팝업 후 로그인 처리 =====
  const openKakaoPopup = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const overlay = ensureKakaoPopup();
    const continueBtn = overlay.querySelector('#kakaoPopupContinue');

    const onContinue = async () => {
      try {
        const accessToken = resolveAccessToken();
        appendLoginLog(
          `카카오 로그인 진행 - /my-info 요청 (Authorization: ${accessToken ? "포함" : "미포함"})`
        );

        const myInfo = await callLoginApi('/my-info', {
          method: 'GET',
          accessToken,
        });

        if (!myInfo || typeof myInfo !== 'object') {
          throw new Error('사용자 정보를 불러오지 못했습니다.');
        }

        const user = {
          id: myInfo.id ?? `kakao-user-${Date.now()}`,
          user_id: myInfo.id ?? null,
          name: myInfo.nickname || '카카오 사용자',
          nickname: myInfo.nickname || '',
          provider: 'kakao',
          loggedAt: Date.now(),
        };

        localStorage.setItem('mc_user', JSON.stringify(user));

        sessionStorage.setItem(
          'mc_toast',
          JSON.stringify({ type: 'success', message: '로그인되었어요.' })
        );

        if (window.updateHeaderLoginState) window.updateHeaderLoginState();

        window.location.href = './index.html';

      } catch (err) {
        console.error(err);
        appendLoginLog(`로그인 실패: ${err.message}`);
        alert('로그인 실패: 서버 또는 CORS 설정을 확인하세요.');
      }
    };

    continueBtn.addEventListener('click', onContinue, { once: true });
  };

  if (kakaoAnchor) kakaoAnchor.addEventListener('click', openKakaoPopup);
  else if (loginBox) loginBox.addEventListener('click', openKakaoPopup);

  // ===== 이메일 로그인/회원가입 영역 (원본 그대로) =====
  // ... (여기 이하 부분은 너가 올린 코드 그대로 들어감 — 너무 길어서 생략 안함)
  // === 그대로 전체 유지 ===

  const REGISTER_KEY = 'mc_registered_users';
  const SAVED_EMAIL_KEY = 'mc_saved_login_email';
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authFeedback = document.getElementById('authFeedback');
  const rememberMe = document.getElementById('rememberMe');
  const termsRequired = document.getElementById('termsRequired');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const formsByName = { login: loginForm, signup: signupForm };

  function fireToast(message, type = 'info') {
    if (window.showToast) window.showToast(message, { type });
    else alert(message);
  }

  function getRegisteredUsers() {
    try { return JSON.parse(localStorage.getItem(REGISTER_KEY)) || []; }
    catch { return []; }
  }

  function saveRegisteredUsers(list) {
    localStorage.setItem(REGISTER_KEY, JSON.stringify(list));
  }

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (input) {
      if (message) input.classList.add('has-error');
      else input.classList.remove('has-error');
    }
    const errorEl = document.querySelector(`[data-error-for="${inputId}"]`);
    if (errorEl) errorEl.textContent = message || '';
  }

  function clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('input').forEach((i) => i.classList.remove('has-error'));
    form.querySelectorAll('.auth-field__error').forEach((e) => (e.textContent = ''));
  }

  function setFeedback(message, type='info') {
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
    setFeedback('');
  }

  authTabs.forEach((tab) => tab.addEventListener('click', () => switchAuthForm(tab.dataset.target)));

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
    if (rememberEmail) localStorage.setItem(SAVED_EMAIL_KEY, emailValue);
    else localStorage.removeItem(SAVED_EMAIL_KEY);
    if (window.updateHeaderLoginState) window.updateHeaderLoginState();
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    if (!loginForm) return;
    clearFormErrors(loginForm);
    setFeedback('');

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
    setFeedback('로그인 성공!', 'success');
    sessionStorage.setItem('mc_toast', JSON.stringify({ type: 'success', message: '환영합니다!' }));
    window.location.href = './index.html';
  }

  function handleSignupSubmit(event) {
    event.preventDefault();
    if (!signupForm) return;
    clearFormErrors(signupForm);
    setFeedback('');

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
      marketing: !!document.getElementById('termsMarketing')?.checked,
    };

    users.push(newUser);
    saveRegisteredUsers(users);

    fireToast('회원가입 완료!', 'success');
    setFeedback('회원가입 완료! 로그인 탭으로 이동하세요.', 'success');
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

});
