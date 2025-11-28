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

/* =========================
   6) 알림 팝업 기능
   ========================= */
const initNotificationPopup = () => {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined')
        ? window.API_BASE_URL
        : "http://localhost:8080";

    const notifBtn = document.querySelector('.header_bar__notif');
    if (!notifBtn) return;

    // 버튼을 wrapper로 감싸기
    const wrapper = document.createElement('div');
    wrapper.className = 'header_bar__notif-wrapper';
    notifBtn.parentNode.insertBefore(wrapper, notifBtn);
    wrapper.appendChild(notifBtn);

    // 알림 팝업 생성 (탭 구조 추가)
    const popup = document.createElement('div');
    popup.className = 'notif-popup';
    popup.innerHTML = `
        <div class="notif-popup__header">
            <div class="notif-popup__tabs">
                <button class="notif-popup__tab is-active" data-tab="notifications" type="button">
                    🔔 알림
                </button>
                <button class="notif-popup__tab" data-tab="settings" type="button">
                    ⚙️ 설정
                </button>
            </div>
            <div class="notif-popup__header-actions">
                <button class="notif-popup__delete-all" type="button" title="모두 삭제">🗑️ 전체삭제</button>
                <button class="notif-popup__close" type="button" aria-label="닫기">×</button>
            </div>
        </div>
        <div class="notif-popup__content" data-content="notifications">
            <div class="notif-popup__body">
                <div class="notif-popup__empty">
                    <span class="notif-popup__empty-icon">🔕</span>
                    <p class="notif-popup__empty-text">알림을 불러오는 중...</p>
                </div>
            </div>
            <div class="notif-popup__footer">
                <button class="notif-popup__read-all" type="button">모두 읽음 처리</button>
            </div>
        </div>
        <div class="notif-popup__content notif-popup__content--hidden" data-content="settings">
            <div class="notif-settings">
                <div class="notif-settings__section">
                    <h4 class="notif-settings__title">⏰ 알림 시간 설정</h4>
                    <p class="notif-settings__desc">복용 시간 기준으로 언제 알림을 받을지 설정합니다.</p>
                    <div class="notif-settings__field">
                        <label class="notif-settings__label" for="notifyTimeOffset">알림 시간</label>
                        <div class="notif-settings__input-group">
                            <select id="notifyTimeOffset" class="notif-settings__select">
                                <option value="-30">30분 전</option>
                                <option value="-15">15분 전</option>
                                <option value="-10">10분 전</option>
                                <option value="-5">5분 전</option>
                                <option value="0" selected>정시</option>
                                <option value="5">5분 후</option>
                                <option value="10">10분 후</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="notif-settings__section">
                    <h4 class="notif-settings__title">🔁 반복 알림</h4>
                    <p class="notif-settings__desc">복용하지 않았을 때 재알림을 받습니다.</p>
                    <div class="notif-settings__field notif-settings__field--toggle">
                        <label class="notif-settings__label" for="isRepeat">반복 알림 사용</label>
                        <label class="notif-settings__toggle">
                            <input type="checkbox" id="isRepeat" class="notif-settings__checkbox">
                            <span class="notif-settings__toggle-slider"></span>
                        </label>
                    </div>
                    <div class="notif-settings__field notif-settings__field--sub" id="reNotifyGroup">
                        <label class="notif-settings__label" for="reNotifyInterval">재알림 간격</label>
                        <div class="notif-settings__input-group">
                            <select id="reNotifyInterval" class="notif-settings__select">
                                <option value="3">3분</option>
                                <option value="5" selected>5분</option>
                                <option value="10">10분</option>
                                <option value="15">15분</option>
                                <option value="30">30분</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="notif-settings__actions">
                    <button type="button" class="notif-settings__save-btn" id="saveNotifSettings">
                        💾 설정 저장
                    </button>
                </div>
                <div class="notif-settings__status" id="notifSettingsStatus"></div>
            </div>
        </div>
    `;
    wrapper.appendChild(popup);

    const notifDot = notifBtn.querySelector('.header_bar__notif-dot');
    const popupBody = popup.querySelector('.notif-popup__body');
    const closeBtn = popup.querySelector('.notif-popup__close');
    const readAllBtn = popup.querySelector('.notif-popup__read-all');
    const deleteAllBtn = popup.querySelector('.notif-popup__delete-all');
    const tabs = popup.querySelectorAll('.notif-popup__tab');
    const contents = popup.querySelectorAll('.notif-popup__content');
    
    // 알림 설정 요소들
    const notifyTimeOffsetEl = popup.querySelector('#notifyTimeOffset');
    const isRepeatEl = popup.querySelector('#isRepeat');
    const reNotifyIntervalEl = popup.querySelector('#reNotifyInterval');
    const reNotifyGroupEl = popup.querySelector('#reNotifyGroup');
    const saveSettingsBtn = popup.querySelector('#saveNotifSettings');
    const settingsStatusEl = popup.querySelector('#notifSettingsStatus');

    let notifications = [];
    let isOpen = false;
    let currentSettings = {
        notifyTimeOffset: 0,
        isRepeat: false,
        reNotifyInterval: 5,
    };

    // 토큰 가져오기
    const getAuthHeaders = () => {
        const token = localStorage.getItem("mc_token");
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    };

    // 알림 목록 가져오기
    // 참고: GET /api/notifications는 API 명세에 없음 - 목업 데이터 사용
    const fetchNotifications = async () => {
        const token = localStorage.getItem("mc_token");
        if (!token) {
            renderEmpty("로그인이 필요합니다.");
            return;
        }

        // API가 구현되어 있지 않으므로 바로 목업 데이터 사용
        // 서버에 GET /api/notifications가 구현되면 아래 주석 해제
        useMockData();
        return;

        /*
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications`, {
                method: "GET",
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                renderEmpty("로그인이 필요합니다.");
                return;
            }

            if (!response.ok) {
                useMockData();
                return;
            }

            notifications = await response.json();
            renderNotifications();
            updateNotifDot();
        } catch (error) {
            useMockData();
        }
        */
    };

    // 저장된 알림 또는 목업 데이터 사용
    const useMockData = () => {
        // 로컬 스토리지에서 알림 불러오기
        try {
            const stored = localStorage.getItem('mc_notifications');
            if (stored) {
                const savedNotifications = JSON.parse(stored);
                if (savedNotifications.length > 0) {
                    notifications = savedNotifications.map(n => ({
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        type: "info",
                        isRead: n.read || false,
                        createdAt: n.timestamp
                    }));
                    renderNotifications();
                    updateNotifDot();
                    return;
                }
            }
        } catch (e) {
            // 파싱 실패 시 목업 데이터 사용
        }
        
        // 저장된 알림이 없으면 빈 상태 표시
        notifications = [];
        renderEmpty("받은 알림이 없습니다.\n약 복용 시간이 되면 알림이 표시됩니다.");
        updateNotifDot();
    };

    // 빈 상태 렌더링
    const renderEmpty = (message = "받은 알림이 없습니다.") => {
        popupBody.innerHTML = `
            <div class="notif-popup__empty">
                <span class="notif-popup__empty-icon">🔕</span>
                <p class="notif-popup__empty-text">${message}</p>
            </div>
        `;
    };

    // 알림 목록 렌더링
    const renderNotifications = () => {
        if (!notifications || notifications.length === 0) {
            renderEmpty();
            return;
        }

        const html = notifications.map(notif => {
            const iconClass = `notif-item__icon--${notif.type || 'info'}`;
            const unreadClass = notif.isRead ? '' : 'is-unread';
            const icon = getNotifIcon(notif.type);
            const timeAgo = formatTimeAgo(notif.createdAt);

            return `
                <div class="notif-item ${unreadClass}" data-id="${notif.id}">
                    <div class="notif-item__icon ${iconClass}">${icon}</div>
                    <div class="notif-item__content">
                        <p class="notif-item__title">${escapeHtml(notif.title)}</p>
                        <p class="notif-item__body">${escapeHtml(notif.body)}</p>
                        <p class="notif-item__time">${timeAgo}</p>
                    </div>
                    <button class="notif-popup__item-delete" title="삭제">✕</button>
                </div>
            `;
        }).join('');

        popupBody.innerHTML = html;

        // 알림 아이템 클릭 이벤트
        popupBody.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 삭제 버튼 클릭 시 읽음 처리 안 함
                if (e.target.classList.contains('notif-popup__item-delete')) return;
                
                const id = parseInt(item.dataset.id);
                markAsRead(id);
                item.classList.remove('is-unread');
            });
            
            // 삭제 버튼 이벤트
            const deleteBtn = item.querySelector('.notif-popup__item-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(item.dataset.id);
                    deleteNotification(id);
                    item.style.transform = 'translateX(100%)';
                    item.style.opacity = '0';
                    item.style.transition = 'all 0.2s';
                    setTimeout(() => {
                        item.remove();
                        if (popupBody.querySelectorAll('.notif-item').length === 0) {
                            renderEmpty();
                        }
                    }, 200);
                });
            }
        });
    };
    
    // 알림 삭제
    const deleteNotification = (id) => {
        notifications = notifications.filter(n => n.id !== id);
        updateNotifDot();
        
        // 로컬 스토리지에서도 삭제
        try {
            const stored = localStorage.getItem('mc_notifications') || '[]';
            let savedNotifs = JSON.parse(stored);
            savedNotifs = savedNotifs.filter(n => n.id !== id);
            localStorage.setItem('mc_notifications', JSON.stringify(savedNotifs));
        } catch (e) {}
    };
    
    // 모든 알림 삭제
    const deleteAllNotifications = () => {
        if (!confirm('모든 알림을 삭제하시겠습니까?')) return;
        
        notifications = [];
        localStorage.removeItem('mc_notifications');
        renderEmpty();
        updateNotifDot();
        
        if (typeof showToast === 'function') {
            showToast('모든 알림이 삭제되었습니다.', { type: 'info' });
        }
    };

    // 알림 아이콘 반환
    const getNotifIcon = (type) => {
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: '💊'
        };
        return icons[type] || '🔔';
    };

    // 시간 포맷팅
    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
        return date.toLocaleDateString('ko-KR');
    };

    // HTML 이스케이프
    const escapeHtml = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    // 읽음 처리
    const markAsRead = async (id) => {
        const notif = notifications.find(n => n.id === id);
        if (notif) {
            notif.isRead = true;
            updateNotifDot();
        }

        try {
            await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: getAuthHeaders()
            });
        } catch (error) {
            console.warn("[Notification] 읽음 처리 실패:", error);
        }
    };

    // 모두 읽음 처리
    const markAllAsRead = async () => {
        notifications.forEach(n => n.isRead = true);
        renderNotifications();
        updateNotifDot();

        try {
            await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
                method: "PATCH",
                headers: getAuthHeaders()
            });
        } catch (error) {
            console.warn("[Notification] 모두 읽음 처리 실패:", error);
        }
    };

    // 알림 점 업데이트
    const updateNotifDot = () => {
        if (!notifDot) return;
        const hasUnread = notifications.some(n => !n.isRead);
        notifDot.classList.toggle('has-unread', hasUnread);
    };

    // 탭 전환
    const switchTab = (tabName) => {
        tabs.forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.tab === tabName);
        });
        contents.forEach(content => {
            content.classList.toggle('notif-popup__content--hidden', content.dataset.content !== tabName);
        });

        // 설정 탭으로 전환 시 설정값 로드
        if (tabName === 'settings') {
            loadNotificationSettings();
        }
    };

    // 알림 설정 로드
    // 참고: GET /api/notification-settings/{userId}는 API 명세에 없음
    // POST /api/notification-settings만 있음 (저장용)
    // 따라서 로컬 스토리지에서 불러오거나 기본값 사용
    const loadNotificationSettings = async () => {
        try {
            // 로컬 스토리지에서 설정 불러오기
            const savedSettings = localStorage.getItem("mc_notification_settings");
            if (savedSettings) {
                currentSettings = JSON.parse(savedSettings);
            } else {
                // 기본값 사용
                currentSettings = { notifyTimeOffset: 0, isRepeat: false, reNotifyInterval: 5 };
            }
            applySettingsToUI();
            showSettingsStatus('', '');
        } catch (error) {
            // 실패해도 기본값으로 UI 표시
            currentSettings = { notifyTimeOffset: 0, isRepeat: false, reNotifyInterval: 5 };
            applySettingsToUI();
            showSettingsStatus('', '');
        }
    };

    // 설정값을 UI에 적용
    const applySettingsToUI = () => {
        if (notifyTimeOffsetEl) {
            notifyTimeOffsetEl.value = String(currentSettings.notifyTimeOffset || 0);
        }
        if (isRepeatEl) {
            isRepeatEl.checked = currentSettings.isRepeat || false;
        }
        if (reNotifyIntervalEl) {
            reNotifyIntervalEl.value = String(currentSettings.reNotifyInterval || 5);
        }
        updateReNotifyVisibility();
    };

    // 재알림 그룹 표시/숨김
    const updateReNotifyVisibility = () => {
        if (reNotifyGroupEl && isRepeatEl) {
            reNotifyGroupEl.style.display = isRepeatEl.checked ? 'flex' : 'none';
        }
    };

    // 알림 설정 저장 (POST /api/notification-settings)
    const saveNotificationSettings = async () => {
        showSettingsStatus('저장 중...', 'loading');
        
        const settings = {
            notifyTimeOffset: parseInt(notifyTimeOffsetEl?.value || '0', 10),
            isRepeat: isRepeatEl?.checked || false,
            reNotifyInterval: parseInt(reNotifyIntervalEl?.value || '5', 10),
        };

        try {
            const token = localStorage.getItem("mc_token");
            const userStr = localStorage.getItem("mc_user");
            if (!token || !userStr) {
                showSettingsStatus('로그인이 필요합니다.', 'error');
                console.warn('[알림설정] 로그인 필요');
                return;
            }

            const user = JSON.parse(userStr);
            const userId = user.userId || user.id;

            const body = {
                userId: userId,
                notifyTimeOffset: settings.notifyTimeOffset,
                isRepeat: settings.isRepeat,
                reNotifyInterval: settings.reNotifyInterval,
            };

            console.log('[알림설정] POST /api/notification-settings 요청:', body);

            const response = await fetch(`${API_BASE_URL}/api/notification-settings`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });

            console.log('[알림설정] 응답 상태:', response.status);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('[알림설정] 저장 실패:', response.status, errorText);
                const errorMsg = getErrorMessage(response.status);
                showSettingsStatus(errorMsg, 'error');
                // 서버 저장 실패해도 로컬에는 저장
                localStorage.setItem("mc_notification_settings", JSON.stringify(settings));
                currentSettings = settings;
                return;
            }

            console.log('[알림설정] 저장 성공!');
            currentSettings = settings;
            // 로컬 스토리지에도 저장 (서버 GET API 없으므로)
            localStorage.setItem("mc_notification_settings", JSON.stringify(settings));
            showSettingsStatus('설정이 저장되었습니다!', 'success');

            // 토스트 메시지 표시 (showToast가 있는 경우)
            if (typeof showToast === 'function') {
                showToast('알림 설정이 저장되었습니다.', { type: 'success' });
            }

            setTimeout(() => showSettingsStatus('', ''), 3000);
        } catch (error) {
            console.error("[Notification] 설정 저장 실패:", error);
            showSettingsStatus('저장 중 오류가 발생했습니다.', 'error');
        }
    };

    // 에러 메시지 반환
    const getErrorMessage = (status) => {
        const messages = {
            400: '입력값을 확인해주세요.',
            401: '로그인이 필요합니다.',
            404: '대상을 찾을 수 없습니다.',
            409: '중복/제약 위반이 발생했습니다.',
            500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        };
        return messages[status] || `오류가 발생했습니다. (${status})`;
    };

    // 설정 상태 메시지 표시
    const showSettingsStatus = (message, type) => {
        if (!settingsStatusEl) return;
        settingsStatusEl.textContent = message;
        settingsStatusEl.className = 'notif-settings__status';
        if (type) {
            settingsStatusEl.classList.add(`notif-settings__status--${type}`);
        }
    };

    // 팝업 열기/닫기
    const togglePopup = () => {
        isOpen = !isOpen;
        popup.classList.toggle('is-open', isOpen);
        if (isOpen) {
            fetchNotifications();
        }
    };

    const closePopup = () => {
        isOpen = false;
        popup.classList.remove('is-open');
    };

    // 탭 이벤트 바인딩
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // 설정 관련 이벤트 바인딩
    if (isRepeatEl) {
        isRepeatEl.addEventListener('change', updateReNotifyVisibility);
    }
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveNotificationSettings);
    }

    // 이벤트 바인딩
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopup();
    });

    closeBtn.addEventListener('click', closePopup);
    readAllBtn.addEventListener('click', markAllAsRead);
    deleteAllBtn.addEventListener('click', deleteAllNotifications);

    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (isOpen && !wrapper.contains(e.target)) {
            closePopup();
        }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closePopup();
        }
    });

    // 초기 알림 점 상태 확인
    fetchNotifications();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationPopup);
} else {
    initNotificationPopup();
}

/* =========================
   7) FCM 토큰 관리
   ========================= */
const initFcmTokenManager = () => {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined')
        ? window.API_BASE_URL
        : "http://localhost:8080";

    // 로그인 상태 확인
    const isLoggedIn = () => {
        try {
            const token = localStorage.getItem("mc_token");
            const user = localStorage.getItem("mc_user");
            return !!(token && user);
        } catch {
            return false;
        }
    };

    // 사용자 ID 가져오기
    const getUserId = () => {
        try {
            const userStr = localStorage.getItem("mc_user");
            if (!userStr) return null;
            const user = JSON.parse(userStr);
            return user.userId || user.id || null;
        } catch {
            return null;
        }
    };

    // 인증 헤더
    const getAuthHeaders = () => {
        const token = localStorage.getItem("mc_token");
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    };

    // FCM 토큰 등록
    const registerFcmToken = async (fcmToken) => {
        if (!isLoggedIn()) {
            console.log("[FCM] 로그인되지 않음, 토큰 등록 스킵");
            return false;
        }

        const userId = getUserId();
        if (!userId || !fcmToken) {
            console.warn("[FCM] userId 또는 fcmToken 없음");
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/token`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId, fcmToken })
            });

            if (!response.ok) {
                console.error("[FCM] 토큰 등록 실패:", response.status);
                return false;
            }

            console.log("[FCM] 토큰 등록 성공");
            localStorage.setItem("mc_fcm_token_registered", "true");
            return true;
        } catch (error) {
            console.error("[FCM] 토큰 등록 오류:", error);
            return false;
        }
    };

    // Firebase 메시징 초기화 (Firebase SDK가 로드된 경우)
    const initFirebaseMessaging = async () => {
        // Firebase SDK가 없으면 스킵
        if (typeof firebase === 'undefined' || !firebase.messaging) {
            console.log("[FCM] Firebase SDK 없음, 웹 푸시 비활성화");
            return;
        }

        try {
            const messaging = firebase.messaging();

            // 알림 권한 요청
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log("[FCM] 알림 권한 거부됨");
                return;
            }

            // FCM 토큰 가져오기
            const fcmToken = await messaging.getToken();
            if (fcmToken) {
                await registerFcmToken(fcmToken);
            }

            // 토큰 갱신 리스너
            messaging.onTokenRefresh(async () => {
                console.log("[FCM] 토큰 갱신됨");
                const newToken = await messaging.getToken();
                if (newToken) {
                    await registerFcmToken(newToken);
                }
            });

            // 포그라운드 메시지 수신
            messaging.onMessage((payload) => {
                console.log("[FCM] 메시지 수신:", payload);
                
                // 브라우저 알림 표시
                if (payload.notification) {
                    const { title, body } = payload.notification;
                    
                    // 토스트 메시지 표시
                    if (typeof showToast === 'function') {
                        showToast(`${title}: ${body}`, { type: 'info' });
                    }

                    // 알림 팝업 새로고침
                    const notifDot = document.querySelector('.header_bar__notif-dot');
                    if (notifDot) {
                        notifDot.classList.add('has-unread');
                    }
                }
            });

        } catch (error) {
            console.error("[FCM] Firebase 초기화 오류:", error);
        }
    };

    // 웹 푸시 대체 (Service Worker 기반)
    const initServiceWorkerPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log("[Push] 서비스 워커 또는 Push API 미지원");
            return;
        }

        try {
            // 알림 권한 요청
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log("[Push] 알림 권한 거부됨");
                return;
            }

            console.log("[Push] 알림 권한 허용됨");
            
            // 서비스 워커가 이미 등록되어 있다면 활용
            const registration = await navigator.serviceWorker.ready;
            console.log("[Push] 서비스 워커 준비됨:", registration);

        } catch (error) {
            console.error("[Push] 초기화 오류:", error);
        }
    };

    // 초기화
    const init = () => {
        if (!isLoggedIn()) {
            console.log("[FCM] 로그인되지 않음, FCM 초기화 스킵");
            return;
        }

        // Firebase SDK가 있으면 FCM 사용, 없으면 기본 Web Push 사용
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            initFirebaseMessaging();
        } else {
            initServiceWorkerPush();
        }
    };

    // DOM 로드 후 초기화
    init();

    // 전역 함수로 노출 (로그인 후 호출용)
    if (typeof window !== 'undefined') {
        window.initFcmToken = init;
        window.registerFcmToken = registerFcmToken;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFcmTokenManager);
} else {
    initFcmTokenManager();
}