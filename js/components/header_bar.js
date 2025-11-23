/**
 * header-and-nav.js
 * --------------------------------
 * 사이트의 헤더와 네비게이션 관련 동작들을 묶은 모듈
 */

/* =========================
   1) 모바일 헤더 바 숨김 동작
   ========================= */
const initMobileHeaderBar = () => {
    const headerBar = document.querySelector('.header_bar');
    if (!headerBar) return;

    const mobileQuery = window.matchMedia('(max-width: 599px)');
    let lastScrollY = window.scrollY;
    let ticking = false;

    const THRESHOLD = 6;
    let mobileEnabled = false;

    const setHiddenState = (shouldHide) => {
        if (shouldHide) {
            headerBar.classList.add('header_bar--hidden');
        } else {
            headerBar.classList.remove('header_bar--hidden');
        }
    };

    const handleScroll = () => {
        const currentY = window.scrollY;
        const diff = currentY - lastScrollY;

        if (Math.abs(diff) > THRESHOLD) {
            if (diff > 0 && currentY > 0) {
                setHiddenState(true);
            } else {
                setHiddenState(false);
            }
            lastScrollY = currentY;
        }
    };

    const onScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    };

    const enableMobileBehavior = () => {
        if (mobileEnabled) return;
        lastScrollY = window.scrollY;
        setHiddenState(false);
        window.addEventListener('scroll', onScroll, { passive: true });
        mobileEnabled = true;
    };

    const disableMobileBehavior = () => {
        if (!mobileEnabled) return;
        window.removeEventListener('scroll', onScroll);
        setHiddenState(false);
        mobileEnabled = false;
    };

    const evaluateMode = (matches = mobileQuery.matches) => {
        if (matches) {
            enableMobileBehavior();
        } else {
            disableMobileBehavior();
        }
    };

    const handleQueryChange = (event) => {
        evaluateMode(event.matches);
    };

    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', handleQueryChange);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(handleQueryChange);
    }

    evaluateMode();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileHeaderBar);
} else {
    initMobileHeaderBar();
}

/* =========================
   2) 로그인 상태에 따른 헤더 표시
   ========================= */
const initHeaderLoginState = () => {
    const userAction = document.querySelector('.header_bar__useraction');
    if (!userAction) return;

    const findLoginLink = () => {
        let link = userAction.querySelector('.header_bar__useraction__logintext');
        if (link) return link;
        const anchors = Array.from(userAction.querySelectorAll('a'));
        const found = anchors.find(a => (a.textContent || '').trim().toLowerCase() === 'login');
        return found || null;
    };

    const loginLink = findLoginLink();
    if (!loginLink) return;

    const ensureLogoutButton = () => {
        let logoutBtn = userAction.querySelector('#logoutBtn');
        if (!logoutBtn) {
            logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.type = 'button';
            logoutBtn.className = 'header_bar__logout';
            logoutBtn.textContent = '로그아웃';
            userAction.appendChild(logoutBtn);
        }
        return logoutBtn;
    };

    const logoutAndRedirect = () => {
        try { localStorage.removeItem('mc_user'); } catch {}
        try { localStorage.removeItem('mc_token'); } catch {}
        try { localStorage.removeItem('mc_access_token'); } catch {}
        try { sessionStorage.setItem('mc_toast', JSON.stringify({ type: 'info', message: '로그아웃되었습니다.' })); } catch {}

        // 로그아웃 후 UI 즉시 갱신
        renderLoggedOut();
        if (window.updateHeaderLoginState) window.updateHeaderLoginState();
        window.location.href = './login.html';
    };

    // [수정됨] 로그아웃 상태 렌더링: 링크 기능 및 스타일 복구
    const renderLoggedOut = () => {
        loginLink.textContent = 'login';

        // 링크 복구
        loginLink.setAttribute('href', './login.html');

        // 스타일 복구 (클릭 가능, 커서 손가락)
        loginLink.style.pointerEvents = 'auto';
        loginLink.style.cursor = 'pointer';

        loginLink.onclick = null;
        const logoutBtn = ensureLogoutButton();
        logoutBtn.onclick = logoutAndRedirect;
    };

    // [수정됨] 로그인 상태 렌더링: 링크 비활성화 및 호버 효과 제거
    const renderLoggedIn = (user) => {
        const displayName = user && (user.nickname || user.name);
        loginLink.textContent = displayName || 'me';

        // 1. 링크 속성 제거 (페이지 이동 방지)
        loginLink.removeAttribute('href');

        // 2. 스타일 변경 (호버 안 됨, 커서 기본 화살표)
        loginLink.style.pointerEvents = 'none'; // 마우스 이벤트 무시 (호버 색상 변경 방지, 클릭 방지)
        loginLink.style.cursor = 'default';     // 커서 모양 일반 화살표로

        // 3. 클릭 이벤트 방어 코드 (pointer-events가 안 먹는 브라우저 대비)
        loginLink.onclick = (e) => { e.preventDefault(); };

        const logoutBtn = ensureLogoutButton();
        logoutBtn.onclick = logoutAndRedirect;
    };

    try {
        const raw = localStorage.getItem('mc_user');
        if (raw) {
            const user = JSON.parse(raw);
            renderLoggedIn(user);
            return;
        }
    } catch (err) {
        console.error('localStorage read error', err);
    }

    renderLoggedOut();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderLoginState);
} else {
    initHeaderLoginState();
}

if (typeof window !== 'undefined') {
    window.updateHeaderLoginState = initHeaderLoginState;
}

/* =========================
   3) 내비게이션 로더 처리
   ========================= */
const ensureNavLoader = () => {
    if (document.querySelector('.nav-loader')) return;
    const loader = document.createElement('div');
    loader.className = 'nav-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = '<div class="nav-loader__spinner" aria-hidden="true"></div><p>Loading...</p>';
    document.body.appendChild(loader);
};

const clearNavTransitionState = () => {
    document.documentElement.classList.remove('is-nav-transitioning');
};

const initNavLoader = () => {
    ensureNavLoader();
    clearNavTransitionState();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavLoader);
} else {
    initNavLoader();
}

window.addEventListener('pageshow', clearNavTransitionState);

/* =========================
   4) Global nav highlight animation
   ========================= */
const initNavIndicator = () => {
    const nav = document.querySelector('.header_bar__nav');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll('.header_bar__nav__box'));
    if (!links.length) return;

    let indicator;
    let activeLink = null;
    let resizeHandler = null;
    let loadHandler = null;
    let resizeObserver = null;

    const getDefaultTarget = () => nav.querySelector('.header_bar__nav__box.is-active') || links[0];

    const updateIndicator = (target, { instant = false } = {}) => {
        if (!indicator || !target) return;
        activeLink = target;
        links.forEach((link) => link.classList.remove('is-highlighted'));
        target.classList.add('is-highlighted');
        if (instant) {
            indicator.classList.add('is-teleport');
        }
        const navRect = nav.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.left - navRect.left;
        indicator.style.width = `${targetRect.width}px`;
        indicator.style.transform = `translate3d(${offset}px, 0, 0)`;
        indicator.classList.add('is-visible');
        if (instant) {
            requestAnimationFrame(() => indicator.classList.remove('is-teleport'));
        }
    };

    const scheduleInstantUpdate = () => updateIndicator(activeLink || getDefaultTarget(), { instant: true });

    const attachIndicator = () => {
        if (indicator) return;
        indicator = document.createElement('span');
        indicator.className = 'header_bar__nav-indicator';
        nav.appendChild(indicator);
        updateIndicator(getDefaultTarget(), { instant: true });

        resizeHandler = () => {
            window.requestAnimationFrame(scheduleInstantUpdate);
        };
        window.addEventListener('resize', resizeHandler);

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleInstantUpdate);
            resizeObserver.observe(nav);
        }

        loadHandler = scheduleInstantUpdate;
        window.addEventListener('load', loadHandler, { once: false });
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
            document.fonts.ready.then(scheduleInstantUpdate).catch(() => {});
        }

        links.forEach((link) => {
            link.addEventListener('focus', handleLinkEvent);
            link.addEventListener('click', handleLinkClick);
        });
    };

    function handleLinkEvent(event) {
        updateIndicator(event.currentTarget);
    }

    function handleLinkClick(event) {
        const link = event.currentTarget;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        event.preventDefault();
        updateIndicator(link);
        document.documentElement.classList.add('is-nav-transitioning');
        setTimeout(() => {
            window.location.href = href;
        }, 400);
    }

    attachIndicator();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavIndicator);
} else {
    initNavIndicator();
}

/* =========================
   5) 헤더 날짜/시간 표시
   ========================= */
const initHeaderDateTime = () => {
    const dateElement = document.querySelector('.header_bar__date');
    const heroDateElement = document.querySelector('.hero__panel-date');
    if (!dateElement && !heroDateElement) return;

    const formatDateTime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const render = () => {
        const stamp = formatDateTime(new Date());
        if (dateElement) dateElement.textContent = stamp;
        if (heroDateElement) heroDateElement.textContent = stamp;
    };

    render();
    setInterval(render, 60 * 1000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderDateTime);
} else {
    initHeaderDateTime();
}