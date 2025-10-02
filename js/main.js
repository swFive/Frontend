document.addEventListener('DOMContentLoaded', () => {
	const headerBar = document.querySelector('.header_bar');
	if (!headerBar) return;

	const mobileQuery = window.matchMedia('(max-width: 599px)');
	let lastScrollY = window.scrollY;
	let ticking = false;
	let scrollHandlerAttached = false;

	const THRESHOLD = 8;

	const setHeaderState = (state) => {
		if (state === 'show') {
			headerBar.classList.add('show');
			headerBar.classList.remove('hide');
		} else if (state === 'hide') {
			headerBar.classList.add('hide');
			headerBar.classList.remove('show');
		}
	};

	const handleScroll = (currentY) => {
		const diff = currentY - lastScrollY;

		if (Math.abs(diff) < THRESHOLD) return;

		if (currentY <= 0) {
			setHeaderState('show');
		} else if (diff > 0) {
			setHeaderState('hide');
		} else {
			setHeaderState('show');
		}

		lastScrollY = currentY;
	};

	const onScroll = () => {
		const currentY = window.scrollY;
		if (!ticking) {
			window.requestAnimationFrame(() => {
				handleScroll(currentY);
				ticking = false;
			});
			ticking = true;
		}
	};

	const attachScrollHandler = () => {
		if (scrollHandlerAttached) return;
		lastScrollY = window.scrollY;
		setHeaderState('show');
		window.addEventListener('scroll', onScroll, { passive: true });
		scrollHandlerAttached = true;
	};

	const detachScrollHandler = () => {
		if (!scrollHandlerAttached) return;
		window.removeEventListener('scroll', onScroll);
		headerBar.classList.remove('show', 'hide');
		scrollHandlerAttached = false;
	};

	const evaluateMode = () => {
		if (mobileQuery.matches) {
			attachScrollHandler();
		} else {
			detachScrollHandler();
		}
	};

	mobileQuery.addEventListener('change', evaluateMode);
	evaluateMode();
});
