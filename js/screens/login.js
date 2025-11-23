(() => {
    const API_BASE_URL = "http://localhost:8080";  // 백엔드
    const MY_INFO_ENDPOINT = `${API_BASE_URL}/my-info`;
    const STORAGE_USER_KEY = "mc_user";
    const STORAGE_TOKEN_KEY = "mc_token";
    const LOGIN_POST_DELAY_MS = 3000;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    console.log("✅ login.js 로드됨");

    document.addEventListener("DOMContentLoaded", () => {
        console.log("✅ DOMContentLoaded 실행됨");

        initAuthTabs();
        bindKakaoLoginButton();

        // 🔥 JWT가 있는 경우만 자동 로그인 시도
        const token = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (token) {
            requestMyInfo();
        } else {
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
    // 2) 카카오 로그인 버튼 → 백엔드 OAuth2 로그인 시작
    // ----------------------------------------------------
    function bindKakaoLoginButton() {
        const kakaoBtn = document.getElementById("kakaoLoginBtn");
        if (!kakaoBtn) {
            console.warn("⚠ kakaoLoginBtn 요소를 찾지 못함");
            return;
        }

        kakaoBtn.addEventListener("click", (e) => {
            e.preventDefault();
            console.log("▶️ 카카오 로그인 시작");

            // 🔥 redirect_uri 로 백엔드가 JWT를 전달하도록 구성해야 함
            window.location.href = `${API_BASE_URL}/oauth2/authorization/kakao`;
        });
    }

    // ----------------------------------------------------
    // 3) JWT 기반 사용자 정보 확인(/my-info)
    // ----------------------------------------------------
    async function requestMyInfo() {
        const token = localStorage.getItem(STORAGE_TOKEN_KEY);
        if (!token) {
            console.warn("❌ JWT 없음 → 로그인 필요");
            updateLoginUI(false);
            return;
        }

        console.log(`📡 GET ${MY_INFO_ENDPOINT}`);

        try {
            const response = await fetch(MY_INFO_ENDPOINT, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`   // ⭐ JWT 인증 방식
                }
            });

            if (response.status === 401) {
                console.log("❌ JWT 만료됨 or 유효하지 않음");
                localStorage.removeItem(STORAGE_TOKEN_KEY);
                updateLoginUI(false);
                return;
            }

            if (!response.ok) {
                console.warn("❌ /my-info 에러:", response.status);
                updateLoginUI(false);
                return;
            }

            const data = await response.json();
            console.log("✅ /my-info 응답:", data);

            // 백엔드가 사용자 데이터를 반영할 시간을 주기 위해 잠시 대기
            await sleep(LOGIN_POST_DELAY_MS);

            const user = {
                id: data.id,
                name: data.name || data.nickname || "사용자",
                nickname: data.nickname || null,
                raw: data
            };

            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
            updateLoginUI(true, user);

        } catch (err) {
            console.error("❌ /my-info fetch 오류:", err);
        }
    }

    // ----------------------------------------------------
    // 4) 로그인 UI 갱신
    // ----------------------------------------------------
    function updateLoginUI(isLoggedIn, user = null) {
        const el = document.getElementById("authFeedback");
        if (!el) return;

        if (!isLoggedIn) {
            el.textContent = "로그인이 필요합니다.";
            el.dataset.state = "warning";
            try { localStorage.removeItem(STORAGE_USER_KEY); } catch {}
            if (typeof window.updateHeaderLoginState === "function") {
                window.updateHeaderLoginState();
            }
            return;
        }

        el.textContent = `${user.nickname || user.name}님, 로그인되었습니다.`;
        el.dataset.state = "success";

        if (typeof window.updateHeaderLoginState === "function") {
            window.updateHeaderLoginState();
        }
    }

})();
