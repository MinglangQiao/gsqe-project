const comparison = document.querySelector('.comparison-image');
const divider = document.querySelector('#split');
const views = document.querySelector('.view-controls');
const playButton = document.querySelector('.enhancement-play');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let enhancementFrame = 0;

function updateDivider() {
  const position = divider.valueAsNumber;
  comparison.style.setProperty('--split', `${position}%`);
  divider.setAttribute('aria-valuetext', `${position}% simulated input, ${100 - position}% detail reference`);
}

function stopEnhancement() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = 0;
  comparison.classList.remove('enhancing');
  playButton.textContent = 'Replay enhancement ▷';
}

function playEnhancement() {
  stopEnhancement();
  if (motionPreference.matches) {
    divider.value = 0;
    updateDivider();
    return;
  }
  const started = performance.now();
  comparison.classList.add('enhancing');
  playButton.textContent = 'Stop preview □';
  divider.value = 100;
  updateDivider();
  function reveal(now) {
    const progress = Math.min(1, Math.max(0, (now - started - 350) / 2400));
    const eased = progress * progress * (3 - 2 * progress);
    divider.value = 100 * (1 - eased);
    updateDivider();
    if (progress < 1) enhancementFrame = requestAnimationFrame(reveal);
    else stopEnhancement();
  }
  enhancementFrame = requestAnimationFrame(reveal);
}

playButton.addEventListener('click', () => {
  if (enhancementFrame) stopEnhancement();
  else playEnhancement();
});
document.querySelector('#explore-enhancement').addEventListener('click', playEnhancement);
divider.addEventListener('input', () => {
  stopEnhancement();
  updateDivider();
});
views.addEventListener('change', () => {
  stopEnhancement();
  comparison.dataset.view = views.querySelector(':checked').value;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopEnhancement();
});
motionPreference.addEventListener('change', stopEnhancement);
updateDivider();
