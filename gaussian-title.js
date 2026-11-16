// An artistic Gaussian-splat title, drawn locally from the heading's text.
const title = document.querySelector('.gaussian-title');
const label = title.querySelector('.gaussian-title-label');
const canvas = title.querySelector('canvas');
const context = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const palette = ['160,139,60', '123,151,73', '72,115,57', '58,136,108', '87,154,156'];

// A clarity sweep makes the enhancement phrase illustrate its own meaning.
const enhancementTitle = document.querySelector('.enhancement-title');
if (enhancementTitle) {
  const replayEnhancement = () => {
    if (!reducedMotion.matches) enhancementTitle.classList.add('is-enhancing');
  };
  document.fonts.ready.then(replayEnhancement);
  enhancementTitle.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') replayEnhancement();
  });
  enhancementTitle.addEventListener('animationend', event => {
    if (event.animationName === 'enhancement-sweep') enhancementTitle.classList.remove('is-enhancing');
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) enhancementTitle.classList.remove('is-enhancing');
  });
}

if (context) {
  const sprites = palette.map(color => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const brush = sprite.getContext('2d');
    const gradient = brush.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (let stop = 0; stop <= 10; stop++) {
      const radius = stop / 10;
      const opacity = stop === 10 ? 0 : Math.exp(-4.5 * radius * radius);
      gradient.addColorStop(radius, `rgba(${color},${opacity})`);
    }
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, 64, 64);
    return sprite;
  });

  let particles = [];
  let width = 0;
  let height = 0;
  let pointer = { x: 0, y: 0 };
  let frame = 0;
  let animationStarted = 0;
  let clarity = reducedMotion.matches ? 1 : 0;

  function randomAt(index) {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function drawSplat(x, y, radius, ratio, angle, color, opacity) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(1, ratio);
    context.globalAlpha = opacity;
    context.drawImage(sprites[color], -radius, -radius, radius * 2, radius * 2);
    context.restore();
  }

  function draw(now) {
    frame = 0;
    if (!animationStarted) animationStarted = now;
    const progress = Math.min(1, (now - animationStarted) / 1700);
    clarity = reducedMotion.matches ? 1 : 1 - Math.pow(1 - progress, 3);
    title.style.setProperty('--clarity', clarity);
    context.clearRect(0, 0, width, height);
    // Back-to-front compositing gives the letterforms a shallow 3D volume.
    for (const particle of particles) {
      const depth = particle.depth;
      const spread = (1 - clarity) * 22;
      drawSplat(particle.x + depth * (2.4 + pointer.x * 3.2) + Math.cos(particle.angle * 9) * spread,
        particle.y + depth * (3.2 + pointer.y * 2.2) + Math.sin(particle.angle * 7) * spread,
        particle.radius * (1 + (1 - clarity) * 1.7), particle.ratio, particle.angle,
        particle.color, .22 + clarity * .2);
    }
    if (clarity < 1 && !document.hidden) requestDraw();
  }

  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function rebuild() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = Math.ceil(width);
    mask.height = Math.ceil(height);
    const brush = mask.getContext('2d', { willReadFrequently: true });
    const style = getComputedStyle(label);
    brush.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    brush.letterSpacing = style.letterSpacing;
    brush.textBaseline = 'alphabetic';
    brush.fillStyle = '#000';

    // Browser text ranges preserve the exact font, kerning and mobile wrapping.
    const text = label.firstChild;
    const range = document.createRange();
    const lines = [];
    for (let index = 0; index < text.length; index++) {
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const box = range.getBoundingClientRect();
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.top - box.top) > 2) {
        line = { text: '', left: box.left, top: box.top, height: box.height };
        lines.push(line);
      }
      line.text += text.textContent[index];
    }
    for (const line of lines) {
      const metrics = brush.measureText(line.text);
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .9;
      const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .24;
      const baseline = line.top - bounds.top + (line.height - ascent - descent) / 2 + ascent;
      brush.fillText(line.text, line.left - bounds.left, baseline);
    }

    const pixels = brush.getImageData(0, 0, mask.width, mask.height).data;
    const spacing = width < 650 ? 1.65 : 2.1;
    particles = [];
    let index = 0;
    for (let y = 0; y < mask.height; y += spacing) {
      for (let x = 0; x < mask.width; x += spacing) {
        const alpha = pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3];
        if (alpha < 90) continue;
        const seed = index++;
        particles.push({
          x: x + (randomAt(seed) - .5) * spacing,
          y: y + (randomAt(seed + 17) - .5) * spacing,
          depth: randomAt(seed + 34),
          radius: spacing * (1.35 + randomAt(seed + 73) * .8),
          ratio: .55 + randomAt(seed + 9) * .35,
          angle: randomAt(seed + 99) * Math.PI,
          color: Math.min(4, Math.floor(x / width * 5))
        });
      }
    }
    particles.sort((a, b) => b.depth - a.depth);
    title.classList.add('splats-ready');
    requestDraw();
  }

  const hero = title.closest('.hero');
  hero.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    pointer = { x: (event.clientX - bounds.left) / bounds.width * 2 - 1,
      y: (event.clientY - bounds.top) / bounds.height * 2 - 1 };
    requestDraw();
  });
  hero.addEventListener('pointerleave', () => {
    pointer = { x: 0, y: 0 };
    requestDraw();
  });
  reducedMotion.addEventListener('change', () => {
    pointer = { x: 0, y: 0 };
    requestDraw();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) requestDraw();
  });
  new ResizeObserver(rebuild).observe(title);
  document.fonts.ready.then(rebuild);
}
