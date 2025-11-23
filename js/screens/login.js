(() => {
    const API_BASE_URL = "http://202.31.246.29:8080";  // 백엔드
    const MY_INFO_ENDPOINT = "${API_BASE_URL}/my-info";
    const STORAGE_USER_KEY = "mc_user";

    console.log("✅ login.js 로드됨");

    document.addEventListener("DOMContentLoaded", () => {
        console.log("✅ DOMContentLoaded 실행됨");

        initAuthTabs();
        bindKakaoLoginButton();
        requestMyInfo(); // 페이지 열릴 때 자동 로그인 상태 확인
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

            window.location.href = `${API_BASE_URL}/oauth2/authorization/kakao`;
        });
    }

    // ----------------------------------------------------
    // 3) 세션 기반 사용자 정보 확인(/my-info)
    // ----------------------------------------------------
    async function requestMyInfo() {
        console.log(`📡 GET ${MY_INFO_ENDPOINT}`);

        try {
            const response = await fetch(MY_INFO_ENDPOINT, {
                method: "GET",
                credentials: "include",  // ⭐ 세션 쿠키 필요
                headers: {
                    "Accept": "application/json"
                }
            });

            if (response.status === 401) {
                console.log("❌ 로그인 안됨 (401)");
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

            const user = {
                id: data.id,
                name: data.nickname || data.name || "사용자",
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
            return;
        }

        el.textContent = `${user.name}님, 로그인되었습니다.`;
        el.dataset.state = "success";

        if (typeof window.updateHeaderLoginState === "function") {
            window.updateHeaderLoginState();
        }
    }

})();
