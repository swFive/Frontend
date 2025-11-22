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

// 로그인 상태에 따른 헤더 표시(공통)
const initHeaderLoginState = () => {
	const userAction = document.querySelector('.header_bar__useraction');
	if (!userAction) return;

	const findLoginLink = () => {
		// 우선 클래스가 있는 링크를 찾고, 없으면 텍스트가 'login'인 a를 찾음
		let link = userAction.querySelector('.header_bar__useraction__logintext');
		if (link) return link;
		const anchors = Array.from(userAction.querySelectorAll('a'));
		const found = anchors.find(a => (a.textContent || '').trim().toLowerCase() === 'login');
		return found || null;
	};

	const loginLink = findLoginLink();
	if (!loginLink) return;

	const renderLoggedOut = () => {
		loginLink.textContent = 'login';
		loginLink.href = './login.html';
		loginLink.onclick = null;
	};

	const renderLoggedIn = (user) => {
		loginLink.textContent = user.name || 'me';
		loginLink.href = '#';
		loginLink.onclick = (e) => {
			e.preventDefault();
			try { localStorage.removeItem('mc_user'); } catch {}
			renderLoggedOut();
		};
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

// Expose update function for other scripts (e.g., login flow) to call after mutating storage
if (typeof window !== 'undefined') {
	window.updateHeaderLoginState = initHeaderLoginState;
}

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

// Global nav highlight animation
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

// Header date/time display
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

// 1. medication.js의 데이터를 읽는 함수 (medication.js의 saveCards 구조에 기반)
function getMedicationData() {
    const data = localStorage.getItem("medicationCards");
    // 로컬 스토리지에 데이터가 없으면 [] 반환
    return JSON.parse(data) || []; 
}


// 2. 오늘의 복약 목록을 구성하고 렌더링하는 함수 (이전 답변에서 제안된 함수)
function renderTodayMeds() {
    const todayMedsContainer = document.querySelector(".today-meds"); 
    const allMeds = getMedicationData(); 
    const todaySchedule = [];

    // C. 전체 약 데이터를 순회하며 오늘의 일정을 추출
    allMeds.forEach(card => {
        const times = Array.isArray(card.time) ? card.time : [card.time];
        
        times.forEach((time, index) => {
            const takenCount = parseInt(card.takenCountToday) || 0;
            const totalTimes = parseInt(card.dailyTimes) || 1;
            
            // NOTE: 복용 상태는 해당 시간대의 복용이 완료되었는지를 판단해야 하지만,
            // 현재 데이터 구조상 (takenCountToday) 총 횟수만 알 수 있습니다.
            // 여기서는 '오늘 복용 횟수'를 기준으로 순차적으로 완료 상태를 표시합니다.
            const isDone = (index + 1) <= takenCount; 
            
            todaySchedule.push({
                name: card.title,
                time: time,
                dose: card.dose,
                isDone: isDone,
                // 복용 버튼 클릭 시 해당 약을 찾기 위한 식별자 추가 (선택 사항)
                drugCardTitle: card.title 
            });
        });
    });

    // D. 시간을 기준으로 일정을 오름차순 정렬
    todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

    // E. HTML 생성
    const medsHTML = todaySchedule.map(item => {
        const statusText = item.isDone ? "복용 완료" : "미복용";
        const statusClass = item.isDone ? 'data-initial-state="done"' : '';
        const doneStyle = item.isDone ? 'style="background-color: #e3ffe5; color: #1e88e5;"' : ''; // 임시 스타일
        
        return `
            <div class="today-meds__row" data-drug-title="${item.drugCardTitle}" data-dose-time="${item.time}">
                <span>${item.name}</span>
                <span>${item.time}</span>
                <span>${item.dose}</span>
                <button type="button" class="today-meds__status" ${statusClass} ${doneStyle}>${statusText}</button>
            </div>
        `;
    }).join("");

    // F. 컨테이너에 HTML 삽입
    todayMedsContainer.innerHTML = medsHTML;
}

// 3. 페이지 로드 후 renderTodayMeds 함수 실행
document.addEventListener("DOMContentLoaded", () => {
    // ⭐ medication.js에서 loadCards()가 실행되어 localStorage 데이터가 준비된 후 
    // 이 함수가 호출되어야 합니다.
    renderTodayMeds(); 
});