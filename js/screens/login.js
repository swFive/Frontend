document.addEventListener('DOMContentLoaded', () => {
  // 카카오 로그인 버튼(테스트용) 클릭 시 로컬에 로그인 플래그를 저장하고 인덱스로 이동
  const kakaoAnchor = document.querySelector('#login_buttons__kakao__spanbox a');
  const loginBox = document.querySelector('#login_buttons__kakao');

  const ensureKakaoPopup = () => {
    let overlay = document.getElementById('kakaoLoginOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'kakaoLoginOverlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:3000','display:flex','align-items:center','justify-content:center',
      'background:rgba(0,0,0,0.4)'
    ].join(';');

    const modal = document.createElement('div');
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.style.cssText = [
      'width:min(92vw,420px)','border-radius:16px','background:#fff','box-shadow:0 10px 40px rgba(0,0,0,0.2)',
      'padding:20px 18px 16px','box-sizing:border-box','text-align:center'
    ].join(';');

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:18px">카카오 계정으로 로그인</strong>
        <button id="kakaoPopupClose" aria-label="닫기" style="border:none;background:transparent;font-size:20px;cursor:pointer">×</button>
      </div>
      <p style="font-size:14px;color:#555;margin:10px 0 18px;">동의 후 계속하면 서비스 약관에 동의하게 됩니다.</p>
      <button id="kakaoPopupContinue" style="width:100%;padding:12px 16px;border-radius:10px;border:none;background:#FEE500;color:#191600;font-weight:700;cursor:pointer">동의하고 계속</button>
      <button id="kakaoPopupCancel" style="margin-top:10px;width:100%;padding:10px 16px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#333;cursor:pointer">취소</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const remove = () => { overlay.remove(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) remove(); });
    modal.querySelector('#kakaoPopupClose')?.addEventListener('click', remove);
    modal.querySelector('#kakaoPopupCancel')?.addEventListener('click', remove);
    return overlay;
  };

  const openKakaoPopup = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const overlay = ensureKakaoPopup();
    const continueBtn = overlay.querySelector('#kakaoPopupContinue');
    if (!continueBtn) return;

    const onContinue = () => {
      // 저장 후 이동
      const user = { provider: 'kakao', name: 'KakaoUser', loggedAt: Date.now() };
      try { localStorage.setItem('mc_user', JSON.stringify(user)); } catch (err) { console.error('localStorage set error', err); }
      try { if (window.updateHeaderLoginState) window.updateHeaderLoginState(); } catch {}
      window.location.href = './index.html';
    };

    continueBtn.addEventListener('click', onContinue, { once: true });
  };

  if (kakaoAnchor) kakaoAnchor.addEventListener('click', openKakaoPopup);
  if (loginBox) loginBox.addEventListener('click', openKakaoPopup);
});
