/**
 * header-and-nav.js
 * --------------------------------
 * 사이트의 헤더와 네비게이션 관련 동작들을 묶은 모듈
 * - 모바일에서의 헤더 숨김/보이기 동작
 * - 로그인 상태에 따른 헤더 텍스트 변경
 * - 전역 내비게이션 로더 표시/초기화
 * - 내비게이션 하이라이트(인디케이터) 애니메이션
 * - 헤더에 현재 날짜(YYYY-MM-DD) 표시
 *
 * 구현 철학:
 * - DOMContentLoaded 시점에 각 초기화 함수를 안전하게 실행
 * - 브라우저 호환성(older matchMedia API, ResizeObserver 존재 여부 등)에 주의
 * - 성능: 스크롤 핸들링은 requestAnimationFrame + passive 옵션으로 최적화
 */

/* =========================
   1) 모바일 헤더 바 숨김 동작
   ========================= */
/**
 * initMobileHeaderBar
 * - 목적: 모바일(최대 599px) 화면일 때 스크롤 방향에 따라 헤더를 숨기고 보이게 함.
 * - 동작 요약:
 *   1. .header_bar 엘리먼트가 없으면 아무 동작도 하지 않음.
 *   2. window.matchMedia('(max-width: 599px)')를 통해 모바일 여부 판정.
 *   3. 스크롤 시 diff(현 스크롤 - 이전 스크롤)가 THRESHOLD(6px) 이상일 때만 반응.
 *   4. 스크롤이 아래이면 숨김(header_bar--hidden 클래스 추가), 위이면 보임.
 *   5. requestAnimationFrame + ticking 플래그로 repaint 횟수 제한.
 *   6. matchMedia의 change 이벤트를 바인딩(호환성 위해 addEventListener/addListener 모두 처리).
 */
const initMobileHeaderBar = () => {
	const headerBar = document.querySelector('.header_bar');
	if (!headerBar) return; // 헤더가 없으면 아무 것도 할 필요 없음

	const mobileQuery = window.matchMedia('(max-width: 599px)');
	let lastScrollY = window.scrollY; // 마지막으로 확인한 스크롤 Y 위치
	let ticking = false; // rAF가 이미 예약되었는지 여부

	const THRESHOLD = 6; // 이 값보다 작은 스크롤 변화는 무시(잡다한 흔들림 필터링)
	let mobileEnabled = false; // 모바일 동작 활성화 여부 트래킹

	// 헤더를 숨김/보임으로 설정하는 유틸
	const setHiddenState = (shouldHide) => {
		if (shouldHide) {
			headerBar.classList.add('header_bar--hidden');
		} else {
			headerBar.classList.remove('header_bar--hidden');
		}
	};

	// 실제 스크롤 처리 로직(성능에 민감한 부분은 여기서만 처리)
	const handleScroll = () => {
		const currentY = window.scrollY;
		const diff = currentY - lastScrollY;

		// THRESHOLD보다 작으면 무시
		if (Math.abs(diff) > THRESHOLD) {
			// 양수(diff > 0)이면 아래로 스크롤 중 => 숨김
			// 음수이면 위로 스크롤 중 => 보임
			if (diff > 0 && currentY > 0) {
				setHiddenState(true);
			} else {
				setHiddenState(false);
			}
			lastScrollY = currentY; // 기준 위치 갱신
		}
	};

	// 스크롤 이벤트 핸들러: rAF로 handleScroll 호출 예약
	const onScroll = () => {
		if (!ticking) {
			window.requestAnimationFrame(() => {
				handleScroll();
				ticking = false;
			});
			ticking = true;
		}
	};

	// 모바일 동작 활성화: 스크롤 이벤트 등록
	const enableMobileBehavior = () => {
		if (mobileEnabled) return;
		lastScrollY = window.scrollY;
		setHiddenState(false); // 활성화 시 기본은 보이도록 설정
		window.addEventListener('scroll', onScroll, { passive: true }); // passive로 성능 최적화
		mobileEnabled = true;
	};

	// 모바일 동작 비활성화: 이벤트 제거하고 헤더 보이게 함
	const disableMobileBehavior = () => {
		if (!mobileEnabled) return;
		window.removeEventListener('scroll', onScroll);
		setHiddenState(false);
		mobileEnabled = false;
	};

	// 현재 matchMedia 결과 또는 전달된 matches 값에 따라 모드 평가
	const evaluateMode = (matches = mobileQuery.matches) => {
		if (matches) {
			enableMobileBehavior();
		} else {
			disableMobileBehavior();
		}
	};

	// matchMedia change 이벤트 핸들러 (이벤트 객체를 받아서 처리)
	const handleQueryChange = (event) => {
		evaluateMode(event.matches);
	};

	// matchMedia 이벤트 리스너 등록 (addEventListener 우선, 구형 브라우저는 addListener)
	if (typeof mobileQuery.addEventListener === 'function') {
		mobileQuery.addEventListener('change', handleQueryChange);
	} else if (typeof mobileQuery.addListener === 'function') {
		mobileQuery.addListener(handleQueryChange);
	}

	// 초기 평가
	evaluateMode();
};

// DOM 준비 시 자동 초기화
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initMobileHeaderBar);
} else {
	initMobileHeaderBar();
}

/* =========================
   2) 로그인 상태에 따른 헤더 표시
   ========================= */
/**
 * initHeaderLoginState
 * - 목적: 헤더의 로그인 링크를 로컬 스토리지(mc_user)에 따라 'login' 혹은 사용자 이름으로 렌더링
 * - 동작 요약:
 *   1. .header_bar__useraction 요소 검색(없으면 종료)
 *   2. 우선 클래스 .header_bar__useraction__logintext를 가진 링크를 찾고, 없으면 텍스트가 'login'인 <a> 태그를 찾음
 *   3. localStorage의 'mc_user'를 파싱하여 존재하면 로그인 상태로 렌더링(이름 표시, 클릭 시 로그아웃 처리)
 *   4. 오류(파싱 실패 등)는 콘솔에 남기고 비로그인 모드로 렌더링
 *
 * - 보안/호환성:
 *   - localStorage 접근은 try/catch로 감싸서 프라이빗 모드/접근 거부 상황을 안전하게 처리
 *   - 로그아웃 시 localStorage.removeItem 호출, 이후 UI를 즉시 업데이트
 */
const initHeaderLoginState = () => {
	const userAction = document.querySelector('.header_bar__useraction');
	if (!userAction) return;

	// 로그인 링크 찾기: 클래스가 우선, 없으면 텍스트 검사
	const findLoginLink = () => {
		let link = userAction.querySelector('.header_bar__useraction__logintext');
		if (link) return link;
		const anchors = Array.from(userAction.querySelectorAll('a'));
		const found = anchors.find(a => (a.textContent || '').trim().toLowerCase() === 'login');
		return found || null;
	};

	const loginLink = findLoginLink();
	if (!loginLink) return;

	// 로그아웃 버튼 생성 보장
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
		try { localStorage.removeItem('mc_access_token'); } catch {}
		try { sessionStorage.setItem('mc_toast', JSON.stringify({ type: 'info', message: '로그아웃되었습니다.' })); } catch {}
		renderLoggedOut();
		if (window.updateHeaderLoginState) window.updateHeaderLoginState();
		window.location.href = './login.html';
	};

	// 로그아웃 상태 렌더링 (기본 링크/텍스트)
	const renderLoggedOut = () => {
		loginLink.textContent = 'login';
		loginLink.href = './login.html';
		loginLink.onclick = null; // 기존 핸들러 제거
		const logoutBtn = ensureLogoutButton();
		logoutBtn.onclick = logoutAndRedirect;
	};

	// 로그인 상태 렌더링: user 객체의 name 사용, 클릭 시 로그아웃 처리
	const renderLoggedIn = (user) => {
		loginLink.textContent = user.name || 'me';
		loginLink.href = './login.html';
		loginLink.onclick = null;
		const logoutBtn = ensureLogoutButton();
		logoutBtn.onclick = logoutAndRedirect;
	};

	// localStorage 읽기(파싱) - 실패 시 비로그인 상태로
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

// DOM 준비 시 초기화
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHeaderLoginState);
} else {
	initHeaderLoginState();
}

// 외부 스크립트(로그인/로그아웃 흐름)가 로컬 스토리지를 수정한 후 UI 갱신을 요청할 수 있도록 전역 함수 노출
if (typeof window !== 'undefined') {
	window.updateHeaderLoginState = initHeaderLoginState;
}

/* =========================
   3) 내비게이션 로더 처리
   ========================= */
/**
 * ensureNavLoader
 * - 목적: 문서 body에 nav-loader DOM이 존재하지 않으면 생성
 * - 접근성: role="status"와 aria-live="polite"를 사용하여 스크린 리더에 로드 상태를 알림
 * - 구성: spinner(시각적 요소)와 텍스트 "Loading..."
 */
const ensureNavLoader = () => {
	if (document.querySelector('.nav-loader')) return;
	const loader = document.createElement('div');
	loader.className = 'nav-loader';
	loader.setAttribute('role', 'status');
	loader.setAttribute('aria-live', 'polite');
	loader.innerHTML = '<div class="nav-loader__spinner" aria-hidden="true"></div><p>Loading...</p>';
	document.body.appendChild(loader);
};

// clearNavTransitionState
// - 목적: 네비게이션 이동 전환 클래스를 제거 (예: 페이지 복원 시 상태 초기화)
const clearNavTransitionState = () => {
	document.documentElement.classList.remove('is-nav-transitioning');
};

// initNavLoader
// - 목적: 로더 보장, 전환 상태 초기화
const initNavLoader = () => {
	ensureNavLoader();
	clearNavTransitionState();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initNavLoader);
} else {
	initNavLoader();
}

// pageshow 이벤트: 브라우저의 페이지 복원(bfcache) 등으로 복원될 때 전환 상태를 초기화
window.addEventListener('pageshow', clearNavTransitionState);

/* =========================
   4) Global nav highlight animation (인디케이터)
   ========================= */
/**
 * initNavIndicator
 * - 목적: 헤더 네비게이션의 활성 메뉴 아래에 'indicator'를 생성해 이동/크기 애니메이션을 함
 * - 동작 요약:
 *   1. .header_bar__nav 내부의 .header_bar__nav__box들을 링크로 취급
 *   2. indicator 엘리먼트를 동적으로 추가하고 위치/너비를 설정
 *   3. 링크 focus/click 시 indicator가 이동하며 .is-highlighted 클래스 토글
 *   4. 클릭 시 내부 링크이면 로케이션 이동을 애니메이션(0.4s 지연)과 함께 수행하고
 *      document.documentElement에 is-nav-transitioning 클래스를 추가하여 CSS 전환 처리 가능
 *   5. 창 리사이즈, 폰트 로드, ResizeObserver를 통해 표시 위치 재계산
 *
 * - 성능 고려: requestAnimationFrame을 사용하여 리사이즈 처리 시 레이아웃 스래싱을 최소화
 * - 호환성: ResizeObserver가 없으면 fallback(윈도우 resize만 사용)
 */
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

	// 기본 대상: .is-active가 있으면 그것, 없으면 첫번째 링크
	const getDefaultTarget = () => nav.querySelector('.header_bar__nav__box.is-active') || links[0];

	// indicator를 target 위치/너비로 업데이트
	const updateIndicator = (target, { instant = false } = {}) => {
		if (!indicator || !target) return;
		activeLink = target;
		links.forEach((link) => link.classList.remove('is-highlighted'));
		target.classList.add('is-highlighted');
		if (instant) {
			indicator.classList.add('is-teleport'); // 즉시 위치 변경 클래스(애니메이션 비활성화용)
		}
		// 좌표 계산: nav-relative offset
		const navRect = nav.getBoundingClientRect();
		const targetRect = target.getBoundingClientRect();
		const offset = targetRect.left - navRect.left;
		indicator.style.width = `${targetRect.width}px`;
		indicator.style.transform = `translate3d(${offset}px, 0, 0)`;
		indicator.classList.add('is-visible');
		if (instant) {
			// 다음 프레임에 teleport 제거하여 CSS 애니메이션을 재활성화
			requestAnimationFrame(() => indicator.classList.remove('is-teleport'));
		}
	};

	const scheduleInstantUpdate = () => updateIndicator(activeLink || getDefaultTarget(), { instant: true });

	// indicator DOM을 붙이고 이벤트 리스너 설정
	const attachIndicator = () => {
		if (indicator) return;
		indicator = document.createElement('span');
		indicator.className = 'header_bar__nav-indicator';
		nav.appendChild(indicator);
		updateIndicator(getDefaultTarget(), { instant: true });

		// 리사이즈 시 위치 재계산 (rAF로 래핑)
		resizeHandler = () => {
			window.requestAnimationFrame(scheduleInstantUpdate);
		};
		window.addEventListener('resize', resizeHandler);

		// ResizeObserver가 있으면 nav의 크기 변화를 더 정밀히 감지
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(scheduleInstantUpdate);
			resizeObserver.observe(nav);
		}

		// window load, 폰트 로드 안정성 확보
		loadHandler = scheduleInstantUpdate;
		window.addEventListener('load', loadHandler, { once: false });
		if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
			document.fonts.ready.then(scheduleInstantUpdate).catch(() => {});
		}

		// 각 링크에 포커스/클릭 이벤트 바인딩
		links.forEach((link) => {
			link.addEventListener('focus', handleLinkEvent);
			link.addEventListener('click', handleLinkClick);
		});
	};

	// 포커스(또는 키보드 네비게이션) 이벤트: indicator 이동
	function handleLinkEvent(event) {
		updateIndicator(event.currentTarget);
	}

	// 클릭 이벤트: 내부 링크가 실제 페이지 이동을 한다면 transition 클래스를 추가 후 지연된 이동
	function handleLinkClick(event) {
		const link = event.currentTarget;
		const href = link.getAttribute('href');
		if (!href || href.startsWith('#')) return; // 앵커 링크면 기본 동작
		event.preventDefault();
		updateIndicator(link);
		document.documentElement.classList.add('is-nav-transitioning');
		// CSS 전환(예: fade out) 시간이 필요하면 setTimeout으로 지연 후 실제 이동
		setTimeout(() => {
			window.location.href = href;
		}, 400);
	}

	attachIndicator();
};

// DOM 준비 시 초기화
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initNavIndicator);
} else {
	initNavIndicator();
}

/* =========================
   5) 헤더 날짜/시간 표시
   ========================= */
/**
 * initHeaderDateTime
 * - 목적: .header_bar__date 및 .hero__panel-date에 현재 날짜(YYYY-MM-DD)를 표시
 * - 동작 요약:
 *   1. 존재하는 경우 초기 렌더링
 *   2. setInterval로 1분마다 갱신 (시/분 단위는 표시하지 않지만 분 단위 갱신으로 날짜 변경을 반영)
 * - 주의: 현재 formatDateTime 함수는 시/분을 계산하나 최종 문자열에는 YYYY-MM-DD만 반환함.
 *   (코드를 확장하면 시간까지 표시 가능)
 */
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
		return `${year}-${month}-${day}`; // 현재는 YYYY-MM-DD 포맷만 사용
	};

	const render = () => {
		const stamp = formatDateTime(new Date());
		if (dateElement) dateElement.textContent = stamp;
		if (heroDateElement) heroDateElement.textContent = stamp;
	};

	render();
	setInterval(render, 60 * 1000); // 1분마다 갱신
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initHeaderDateTime);
} else {
	initHeaderDateTime();
}
