(function(){
  function ensureContainer(){
    let c = document.querySelector('.toast-container');
    if (!c) {
      c = document.createElement('div');
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, opts){
    opts = opts || {};
    const type = opts.type || 'success';
    const duration = Math.max(800, Number(opts.duration || 2200));

    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const msg = document.createElement('span');
    msg.className = 'toast__msg';
    msg.textContent = message || '';

    const close = document.createElement('button');
    close.className = 'toast__close';
    close.setAttribute('aria-label', '닫기');
    close.textContent = '×';

    toast.appendChild(msg);
    toast.appendChild(close);

    let removing = false;
    const remove = () => {
      if (removing) return; removing = true;
      toast.style.animation = 'toast-out 160ms ease-in forwards';
      setTimeout(() => { toast.remove(); }, 170);
    };

    close.addEventListener('click', remove);

    container.appendChild(toast);

    const timer = setTimeout(remove, duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer), { once: true });
  }

  // Auto show if session flag exists (e.g., after login redirect)
  function checkSessionToast(){
    try {
      const raw = sessionStorage.getItem('mc_toast');
      if (!raw) return;
      sessionStorage.removeItem('mc_toast');
      const data = JSON.parse(raw);
      showToast(data.message || '완료되었습니다.', { type: data.type || 'success', duration: data.duration || 2200 });
    } catch (e) { /* ignore */ }
  }

  if (typeof window !== 'undefined') {
    window.showToast = showToast;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkSessionToast);
  } else {
    checkSessionToast();
  }
})();
