const comparison = document.querySelector('.comparison-image');
const divider = document.querySelector('#split');
const views = document.querySelector('.view-controls');

function updateDivider() {
  const position = divider.valueAsNumber;
  comparison.style.setProperty('--split', `${position}%`);
  divider.setAttribute('aria-valuetext', `${position}% simulated input, ${100 - position}% detail reference`);
}

divider.addEventListener('input', updateDivider);
views.addEventListener('change', () => {
  comparison.dataset.view = views.querySelector(':checked').value;
});
updateDivider();
