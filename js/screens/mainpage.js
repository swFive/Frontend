document.addEventListener('DOMContentLoaded', () => {
  const statusButtons = document.querySelectorAll('.today-meds__status');

  const applyState = (button, state) => {
    const isDone = state === 'done';
    button.dataset.state = state;
    button.classList.toggle('is-done', isDone);
    button.classList.toggle('is-missed', !isDone);
    button.setAttribute('aria-pressed', String(isDone));
    button.textContent = isDone ? '복용 완료' : '미복용';
  };

  statusButtons.forEach((button) => {
    const initial = button.dataset.initialState === 'done' ? 'done' : 'missed';
    applyState(button, initial);

    button.addEventListener('click', () => {
      const nextState = button.dataset.state === 'done' ? 'missed' : 'done';
      applyState(button, nextState);
    });
  });
});
