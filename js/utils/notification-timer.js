// ==================================================
// 🔔 복용 알림 타이머
// 약 복용 시간이 되면 알림을 표시합니다.
// ==================================================

const MediNotification = (function() {
    let checkInterval = null;
    let notifiedTimes = new Set(); // 이미 알린 시간 (중복 방지)
    let lastCheckDate = null;

    const CHECK_INTERVAL_MS = 10000; // 10초마다 체크

    // 알림 설정 불러오기
    const getSettings = () => {
        try {
            const saved = localStorage.getItem("mc_notification_settings");
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        // 기본값: 반복 알림 활성화, 5분 간격
        return { notifyTimeOffset: 0, isRepeat: true, reNotifyInterval: 5 };
    };

    // 현재 시간 (HH:mm 형식)
    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // 현재 날짜 (YYYY-MM-DD 형식)
    const getCurrentDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

    // 오늘 요일 (월, 화, 수, 목, 금, 토, 일)
    const getTodayDay = () => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[new Date().getDay()];
    };

    // 시간에 분 추가
    const addMinutesToTime = (timeStr, minutes) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m + minutes, 0, 0);
        const newH = String(date.getHours()).padStart(2, '0');
        const newM = String(date.getMinutes()).padStart(2, '0');
        return `${newH}:${newM}`;
    };

    // 브라우저 알림 권한 요청
    const requestPermission = async () => {
        if (!("Notification" in window)) {
            console.warn("[알림] 이 브라우저는 알림을 지원하지 않습니다.");
            return false;
        }

        if (Notification.permission === "granted") {
            return true;
        }

        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }

        return false;
    };

    // notif-popup__body에 알림 추가
    const addToNotifPopup = (title, body, medName) => {
        const notifBody = document.querySelector('.notif-popup__body');
        if (!notifBody) return;

        const now = new Date();
        const notifId = Date.now();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // 새 알림 아이템 생성
        const notifItem = document.createElement('div');
        notifItem.className = 'notif-popup__item notif-popup__item--new';
        notifItem.dataset.notifId = notifId;
        notifItem.innerHTML = `
            <div class="notif-popup__item-icon">💊</div>
            <div class="notif-popup__item-content">
                <p class="notif-popup__item-title">${title}</p>
                <p class="notif-popup__item-body">${body}</p>
                <span class="notif-popup__item-time">${timeStr}</span>
            </div>
            <button class="notif-popup__item-delete" title="삭제">✕</button>
        `;

        // 삭제 버튼 이벤트
        const deleteBtn = notifItem.querySelector('.notif-popup__item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifItem.style.transform = 'translateX(100%)';
            notifItem.style.opacity = '0';
            setTimeout(() => {
                notifItem.remove();
                removeNotificationFromStorage(notifId);
                checkEmptyState();
            }, 200);
        });

        // "알림이 없습니다" 메시지 제거
        const emptyMsg = notifBody.querySelector('.notif-popup__empty');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        // 맨 위에 추가
        notifBody.insertBefore(notifItem, notifBody.firstChild);

        // 알림 도트 표시
        const notifDot = document.querySelector('.header_bar__notif-dot');
        if (notifDot) {
            notifDot.classList.add('is-active');
        }

        // 새 알림 하이라이트 효과 (3초 후 제거)
        setTimeout(() => {
            notifItem.classList.remove('notif-popup__item--new');
        }, 3000);

        // 로컬 스토리지에 알림 저장 (페이지 새로고침 시에도 유지)
        saveNotificationToStorage(title, body, medName, now.toISOString(), notifId);
    };

    // 빈 상태 확인
    const checkEmptyState = () => {
        const notifBody = document.querySelector('.notif-popup__body');
        if (!notifBody) return;

        const items = notifBody.querySelectorAll('.notif-popup__item');
        if (items.length === 0) {
            notifBody.innerHTML = `
                <div class="notif-popup__empty">
                    <span class="notif-popup__empty-icon">🔔</span>
                    <p class="notif-popup__empty-text">받은 알림이 없습니다.</p>
                </div>
            `;
            // 도트 숨기기
            const notifDot = document.querySelector('.header_bar__notif-dot');
            if (notifDot) {
                notifDot.classList.remove('is-active');
            }
        }
    };

    // 로컬 스토리지에서 알림 삭제
    const removeNotificationFromStorage = (notifId) => {
        try {
            const stored = localStorage.getItem('mc_notifications') || '[]';
            let notifications = JSON.parse(stored);
            notifications = notifications.filter(n => n.id !== notifId);
            localStorage.setItem('mc_notifications', JSON.stringify(notifications));
        } catch (e) {}
    };

    // 알림을 로컬 스토리지에 저장
    const saveNotificationToStorage = (title, body, medName, timestamp, notifId) => {
        try {
            const stored = localStorage.getItem('mc_notifications') || '[]';
            const notifications = JSON.parse(stored);

            // 새 알림 추가
            notifications.unshift({
                id: notifId || Date.now(),
                title,
                body,
                medName,
                timestamp,
                read: false
            });

            // 최대 50개까지만 저장
            if (notifications.length > 50) {
                notifications.length = 50;
            }

            localStorage.setItem('mc_notifications', JSON.stringify(notifications));
        } catch (e) {
            // 저장 실패 시 무시
        }
    };

    // 알림 표시
    const showNotification = (title, body, medName) => {
        const currentTime = getCurrentTime();

        // 콘솔에 알림 출력
        console.log(`%c🔔 [복용 알림] ${currentTime}`, 'color: #ff6b6b; font-size: 16px; font-weight: bold;');
        console.log(`%c   💊 ${title}`, 'color: #4ecdc4; font-size: 14px;');
        console.log(`%c   ${body}`, 'color: #666; font-size: 12px;');

        // notif-popup__body에 추가
        addToNotifPopup(title, body, medName);

        // 브라우저 알림
        if (Notification.permission === "granted") {
            try {
                const notification = new Notification(title, {
                    body: body,
                    tag: `med-${medName}-${currentTime}`,
                    requireInteraction: true
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                // 30초 후 자동 닫기
                setTimeout(() => notification.close(), 30000);
            } catch (e) {
                // 브라우저 알림 실패 시 무시
            }
        }

        // 토스트 메시지 (showToast가 있는 경우)
        if (typeof showToast === 'function') {
            showToast(`💊 ${title}: ${body}`, { type: 'info', duration: 10000 });
        }

        // 비프음 (시스템 소리)
        try {
            // 브라우저 내장 비프음 시도
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // Hz
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200); // 0.2초 비프음
        } catch (e) {
            // 소리 재생 실패 시 무시
        }
    };

    // 시간을 분으로 변환
    const timeToMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    // 스케줄 체크
    const checkSchedules = () => {
        const currentTime = getCurrentTime();
        const currentDate = getCurrentDate();
        const todayDay = getTodayDay();
        const settings = getSettings();
        const currentMinutes = timeToMinutes(currentTime);

        // 날짜가 바뀌면 알림 기록 초기화
        if (lastCheckDate !== currentDate) {
            notifiedTimes.clear();
            lastCheckDate = currentDate;
            console.log(`[알림] 날짜 변경 감지: ${currentDate}, 알림 기록 초기화`);
        }

        // 알림 오프셋 적용
        const offsetMinutes = settings.notifyTimeOffset || 0;
        const reNotifyInterval = settings.reNotifyInterval || 5;
        const isRepeatEnabled = settings.isRepeat || false;

        // 페이지의 모든 약 카드 확인
        const cards = document.querySelectorAll('.drug-card');

        // 이미 처리한 약+시간 조합 추적 (중복 알림 방지)
        const processedMedTimes = new Set();
        
        cards.forEach(card => {
            const medId = card.dataset.id;
            const scheduleId = card.dataset.scheduleId || '';
            const medName = card.querySelector('.drug-info__title p')?.textContent || card.querySelector('.title-1')?.textContent || '약';
            const rule = card.querySelector('.rule')?.textContent || '매일';
            const timeItems = card.querySelectorAll('.time-item');

            // 복용 완료 또는 건너뛰기 여부 확인
            const progressText = card.querySelector('.intake-progress')?.textContent || '';
            const isDone = progressText.includes('완료') || progressText.includes('지각');
            const isSkipped = progressText.includes('건너뜀');
            
            // 건너뛴 약은 알림 제외
            if (isSkipped) return;

            // 오늘 복용하는 약인지 확인
            const isToday = rule === '매일' || rule.includes(todayDay);
            if (!isToday) return;

            timeItems.forEach(timeItem => {
                const scheduleTime = timeItem.textContent.trim();
                if (!scheduleTime || scheduleTime === '-') return;
                
                // 같은 약+시간 조합은 한 번만 처리
                const medTimeKey = `${medId}-${scheduleTime}`;
                if (processedMedTimes.has(medTimeKey)) return;
                processedMedTimes.add(medTimeKey);

                const scheduleMinutes = timeToMinutes(scheduleTime);

                // 오프셋 적용된 알림 시간 계산
                const notifyTime = addMinutesToTime(scheduleTime, offsetMinutes);
                const notifyKey = `${medId}-${scheduleTime}-${currentDate}`;

                // 1. 정시 알림: 현재 시간이 알림 시간과 같으면 알림
                if (currentTime === notifyTime && !notifiedTimes.has(notifyKey)) {
                    notifiedTimes.add(notifyKey);

                    const offsetText = offsetMinutes < 0
                        ? `${Math.abs(offsetMinutes)}분 전`
                        : offsetMinutes > 0
                            ? `${offsetMinutes}분 후`
                            : '';

                    showNotification(
                        `💊 ${medName} 복용 시간`,
                        `[${medName}] ${scheduleTime} ${offsetText} - 약을 복용해주세요!`,
                        medName
                    );
                }

                // 2. 재알림: 복용 시간이 지났고, 아직 복용하지 않았으면
                if (isRepeatEnabled && !isDone && currentMinutes > scheduleMinutes) {
                    const minutesPassed = currentMinutes - scheduleMinutes;

                    // reNotifyInterval 분마다 재알림 (예: 5분, 10분, 15분...)
                    if (minutesPassed > 0 && minutesPassed % reNotifyInterval === 0) {
                        const reNotifyKey = `${notifyKey}-re-${minutesPassed}`;

                        if (!notifiedTimes.has(reNotifyKey)) {
                            notifiedTimes.add(reNotifyKey);

                            showNotification(
                                `⏰ ${medName} 미복용 알림`,
                                `[${medName}] ${scheduleTime} 복용 시간이 ${minutesPassed}분 지났습니다! 약을 복용해주세요.`,
                                medName
                            );

                            console.log(`%c⏰ [재알림] ${medName} - ${minutesPassed}분 경과`, 'color: #f59e0b; font-weight: bold;');
                        }
                    }
                }
            });
        });
    };

    // 시작
    const start = async () => {
        console.log('%c🔔 [알림 타이머] 시작', 'color: #4ecdc4; font-weight: bold;');

        // 권한 요청
        const hasPermission = await requestPermission();
        if (hasPermission) {
            console.log('[알림] 브라우저 알림 권한 허용됨');
        } else {
            console.log('[알림] 브라우저 알림 권한 없음 - 콘솔 알림만 표시됩니다');
        }

        // 설정 표시
        const settings = getSettings();
        console.log('[알림] 현재 설정:', settings);

        // 이미 실행 중이면 중지 후 재시작
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        // 초기화
        lastCheckDate = getCurrentDate();

        // 주기적 체크 시작
        checkInterval = setInterval(checkSchedules, CHECK_INTERVAL_MS);

        // 즉시 한 번 체크
        checkSchedules();

        console.log(`[알림] ${CHECK_INTERVAL_MS / 1000}초마다 스케줄 체크 중...`);
    };

    // 중지
    const stop = () => {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
            console.log('[알림] 타이머 중지됨');
        }
    };

    // 테스트 알림
    const test = () => {
        console.log('%c🔔 [테스트] 알림 테스트 중...', 'color: #ff6b6b; font-weight: bold;');
        showNotification('테스트 알림', '알림이 정상 작동합니다!', 'test');
    };

    // 현재 스케줄 표시
    const showSchedules = () => {
        const currentTime = getCurrentTime();
        const todayDay = getTodayDay();
        const settings = getSettings();

        console.log('%c📋 [오늘의 복용 스케줄]', 'color: #4ecdc4; font-size: 14px; font-weight: bold;');
        console.log(`현재 시간: ${currentTime}, 오늘: ${todayDay}요일`);
        console.log(`알림 오프셋: ${settings.notifyTimeOffset}분`);
        console.log('---');

        const cards = document.querySelectorAll('.drug-card');

        if (cards.length === 0) {
            console.log('등록된 약이 없습니다.');
            return;
        }

        cards.forEach(card => {
            const medName = card.querySelector('.drug-info__title p')?.textContent || card.querySelector('.title-1')?.textContent || '약';
            const rule = card.querySelector('.rule')?.textContent || '매일';
            const timeItems = card.querySelectorAll('.time-item');
            const times = Array.from(timeItems).map(t => t.textContent.trim()).join(', ');

            const isToday = rule === '매일' || rule.includes(todayDay);
            const status = isToday ? '✅ 오늘 복용' : '⏸️ 오늘 아님';

            console.log(`💊 ${medName}: ${times} (${rule}) ${status}`);
        });
    };

    // 재고 부족 알림 (외부에서 호출 가능)
    const stockWarning = (medName, currentStock, threshold = 5) => {
        if (currentStock <= threshold) {
            const title = `⚠️ ${medName} 재고 부족`;
            const body = `[${medName}] 재고가 ${currentStock}개 남았습니다. 리필이 필요합니다!`;

            // 콘솔에 알림 출력
            console.log(`%c⚠️ [재고 부족] ${medName}`, 'color: #f59e0b; font-size: 16px; font-weight: bold;');
            console.log(`%c   재고: ${currentStock}개 (임계치: ${threshold}개)`, 'color: #666; font-size: 12px;');

            // notif-popup__body에 추가
            addToNotifPopup(title, body, medName);

            // 브라우저 알림
            if (Notification.permission === "granted") {
                try {
                    new Notification(title, {
                        body: body,
                        tag: `stock-${medName}`,
                        requireInteraction: false
                    });
                } catch (e) {}
            }

            // 토스트 메시지
            if (typeof showToast === 'function') {
                showToast(`⚠️ ${medName}: 재고 ${currentStock}개 남음`, { type: 'warning', duration: 5000 });
            }

            return true; // 알림 표시됨
        }
        return false; // 재고 충분
    };

    return {
        start,
        stop,
        test,
        showSchedules,
        requestPermission,
        stockWarning
    };
})();

// 페이지 로드 시 자동 시작
document.addEventListener('DOMContentLoaded', () => {
    // 약간의 지연 후 시작 (카드 로딩 대기)
    setTimeout(() => {
        MediNotification.start();
    }, 2000);
});

// 콘솔에서 사용 가능한 명령어 안내
console.log('%c💊 MediCare 알림 시스템', 'color: #4ecdc4; font-size: 16px; font-weight: bold;');
console.log('%c사용 가능한 명령어:', 'color: #666; font-weight: bold;');
console.log('  MediNotification.start()      - 알림 시작');
console.log('  MediNotification.stop()       - 알림 중지');
console.log('  MediNotification.test()       - 테스트 알림');
console.log('  MediNotification.showSchedules() - 오늘 스케줄 보기');

