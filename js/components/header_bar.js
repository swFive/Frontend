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