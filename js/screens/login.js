(() => {
    const API_BASE_URL = "http://localhost:8080";
    const MY_INFO_ENDPOINT = `${API_BASE_URL}/my-info`;
    const STORAGE_USER_KEY = "mc_user";
    const STORAGE_TOKEN_KEY = "mc_token";

    // 딜레이 설정
    const LOGIN_POST_DELAY_MS = 1000;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    console.log("✅ login.js 로드됨");

    document.addEventListener("DOMContentLoaded", () => {
        console.log("✅ DOMContentLoaded 실행됨");

        initAuthTabs();
        bindKakaoLoginButton();

        // 1. URL에서 토큰 낚아채기
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');

        if (urlToken) {
            console.log("🔥 주소창에서 토큰 발견! 저장합니다:", urlToken);
            localStorage.setItem(STORAGE_TOKEN_KEY, urlToken);

            // 주소창 청소 (토큰 파라미터 숨김)
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }

        // 2. 토큰이 있으면 로그인 시도
        const token = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (token) {
            console.log("🔑 저장된 토큰으로 내 정보 요청 시작...");
            requestMyInfo();
        } else {
            console.log("💤 토큰 없음. 로그인 필요.");
            updateLoginUI(false);
        }
    });

    // ----------------------------------------------------
    // 1) 탭 UI
    // ----------------------------------------------------
    function initAuthTabs() {
        const tabs = document.querySelectorAll(".auth-tab");
        const forms = document.querySelectorAll(".auth-form");
        if (!tabs.length) return;

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                const target = tab.dataset.target;
                tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
                forms.forEach((f) =>
                    f.classList.toggle("is-active", f.id === `${target}Form`)
                );
            });
        });
    }

    // ----------------------------------------------------
    // 2) 카카오 로그인 버튼
    // ----------------------------------------------------
    function bindKakaoLoginButton() {
        const kakaoBtn = document.getElementById("login_buttons__kakao__spanbox");
        if (!kakaoBtn) {
            return;
        }

        kakaoBtn.addEventListener("click", (e) => {
            e.preventDefault();
            console.log("▶️ 카카오 로그인 시작");
            window.location.href = `${API_BASE_URL}/oauth2/authorization/kakao`;
        });
    }

    // ----------------------------------------------------
    // 3) 내 정보 요청 (/my-info)
    // ----------------------------------------------------
    async function requestMyInfo() {
        const token = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (!token) return;

        try {
            const response = await fetch(MY_INFO_ENDPOINT, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                console.log("❌ 토큰 만료됨");
                localStorage.removeItem(STORAGE_TOKEN_KEY);
                updateLoginUI(false);
                return;
            }

            if (!response.ok) {
                console.warn("❌ 서버 응답 에러:", response.status);
                return;
            }

            const data = await response.json();
            console.log("✅ 내 정보 수신 완료:", data);

            // UI 갱신 전 딜레이
            await sleep(LOGIN_POST_DELAY_MS);

            const user = {
                id: data.id,
                nickname: data.nickname || data.name || "사용자",
            };

            // 1. 유저 정보 로컬 스토리지 저장
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));

            // 2. 로그인 화면 UI 업데이트
            updateLoginUI(true, user);

            // 3. [핵심] 상단 헤더바 즉시 갱신 (새로고침 없이 반영)
            if (typeof window.updateHeaderLoginState === 'function') {
                console.log("🔄 헤더 로그인 상태 갱신 요청");
                window.updateHeaderLoginState();
            }

            // 4. FCM 토큰 등록 (알림 기능 활성화)
            if (typeof window.initFcmToken === 'function') {
                console.log("🔔 FCM 토큰 등록 시작");
                window.initFcmToken();
            }

            // (선택) 로그인 완료 후 메인으로 보내려면 아래 주석 해제
            // window.location.replace("/");

        } catch (err) {
            console.error("❌ requestMyInfo 실행 중 오류:", err);
        }
    }

    // ----------------------------------------------------
    // 4) UI 업데이트 (로그인 폼 영역)
    // ----------------------------------------------------
    function updateLoginUI(isLoggedIn, user = null) {
        const el = document.getElementById("authFeedback");

        if (!el) return;

        if (!isLoggedIn) {
            el.textContent = "로그인이 필요합니다.";
            return;
        }

        el.textContent = `${user.nickname}님, 환영합니다!`;
        console.log("🎉 UI 로그인 상태로 변경됨");
    }
})();