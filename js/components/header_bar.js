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
