// A procedural illustration of damaged sparse-view splats resolving into text.
// The particles are generated from the heading, not from research data or a model.
(() => {
  const heading = document.querySelector('.reconstruction-title');
  const canvas = heading?.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const palette = [[34, 43, 31], [52, 69, 43], [72, 91, 53], [113, 123, 67], [57, 111, 90], [90, 144, 133]];
  const sprites = palette.map(color => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 48;
    const brush = sprite.getContext('2d');
    const gradient = brush.createRadialGradient(24, 24, 0, 24, 24, 24);
    for (let i = 0; i <= 12; i++) {
      const r = i / 12;
      gradient.addColorStop(r, `rgba(${color},${i === 12 ? 0 : Math.exp(-5.5 * r * r)})`);
    }
    brush.fillStyle = gradient;
    brush.fillRect(0, 0, 48, 48);
    return sprite;
  });

  let particles = [];
  let floaters = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let started = null;
  let lastFrame = 0;
  let progress = 0;
  let initialized = false;
  let hiddenAt = 0;
  const duration = 5800;
  const pointer = { x: 0, y: 0 };
  const random = seed => {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (from, to, value) => {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };

  function splat(x, y, radius, ratio, angle, color, opacity) {
    if (opacity < .012) return;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.globalAlpha = opacity;
    context.drawImage(sprites[color], -radius, -radius * ratio, radius * 2, radius * 2 * ratio);
    context.restore();
  }

  function draw(now) {
    frame = 0;
    if (document.hidden) return;
    if (started === null) started = now;
    if (now - lastFrame < 30 && progress < 1 && !motion.matches) {
      requestDraw();
      return;
    }
    lastFrame = now;
    progress = motion.matches ? 1 : Math.min(1, (now - started) / duration);
    const repair = smooth(.15, .92, progress);
    const damage = 1 - repair;
    const precision = smooth(.58, 1, repair);
    const textOpacity = smooth(.72, 1, repair) * .91;
    const opacity = 1 - precision * .58;
    heading.style.setProperty('--type-opacity', motion.matches ? 1 : textOpacity);
    heading.dataset.reconstruction = progress >= 1 ? 'restored' : repair < .08 ? 'sparse' : repair < .72 ? 'repairing' : 'refining';
    context.clearRect(0, 0, width, height);

    for (const p of particles) {
      const presence = p.birth === 0 ? 1 : smooth(p.birth, Math.min(1, p.birth + .18), repair);
      if (presence < .01) continue;
      const displacement = damage * damage;
      const depthShift = p.depth * (motion.matches ? 0 : .55 + damage * 2);
      const x = p.x + (p.fragmentX + p.jitterX) * displacement + pointer.x * depthShift;
      const y = p.y + (p.fragmentY + p.jitterY) * displacement + pointer.y * depthShift * .6;
      const radius = p.radius * (1 + damage * (1.7 + p.depth * 1.3));
      const angle = p.angle * damage + p.tangent * repair;
      splat(x, y, radius, .72 - damage * .36, angle, p.color,
        presence * opacity * (.69 + p.depth * .24));
    }

    // Detached floaters and duplicated fragments disappear as support improves.
    for (const p of floaters) {
      splat(p.x + p.dx * damage, p.y + p.dy * damage,
        p.radius * (1 + damage), .36, p.angle, p.color, damage * damage * .48);
    }
    if (progress < 1) requestDraw();
  }

  function requestDraw() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function restart() {
    if (!initialized || motion.matches || progress < 1) return;
    started = null;
    lastFrame = 0;
    progress = 0;
    pointer.x = pointer.y = 0;
    heading.style.setProperty('--type-opacity', 0);
    requestDraw();
  }

  function rebuild() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = Math.ceil(width);
    mask.height = Math.ceil(height);
    const brush = mask.getContext('2d', { willReadFrequently: true });
    brush.textBaseline = 'alphabetic';
    // DOM ranges keep every line, font and responsive wrap aligned with the h1.
    for (const label of heading.querySelectorAll('[data-splat-text]')) {
      const style = getComputedStyle(label);
      brush.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      brush.letterSpacing = style.letterSpacing;
      const box = label.getBoundingClientRect();
      const gradient = brush.createLinearGradient(box.left - bounds.left, 0, box.right - bounds.left, 0);
      if (label.classList.contains('gaussian-word')) {
        gradient.addColorStop(0, '#717b43');
        gradient.addColorStop(.5, '#485b35');
        gradient.addColorStop(1, '#396f5a');
      } else {
        gradient.addColorStop(0, '#222b1f');
        gradient.addColorStop(1, label.classList.contains('title-phrase') ? '#485b35' : '#34452b');
      }
      brush.fillStyle = gradient;
      const text = label.firstChild;
      const range = document.createRange();
      const lines = [];
      for (let i = 0; i < text.length; i++) {
        range.setStart(text, i);
        range.setEnd(text, i + 1);
        const rect = range.getBoundingClientRect();
        let line = lines.at(-1);
        if (!line || Math.abs(line.top - rect.top) > 2) {
          line = { text: '', left: rect.left, top: rect.top, height: rect.height };
          lines.push(line);
        }
        line.text += text.textContent[i];
      }
      for (const line of lines) {
        const metrics = brush.measureText(line.text);
        const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .9;
        const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .24;
        const baseline = line.top - bounds.top + (line.height - ascent - descent) / 2 + ascent;
        brush.fillText(line.text, line.left - bounds.left, baseline);
      }
    }

    const pixels = brush.getImageData(0, 0, mask.width, mask.height).data;
    const spacing = width < 600 ? 1.45 : 2;
    particles = [];
    floaters = [];
    let seed = 0;
    for (let y = 0; y < mask.height; y += spacing) {
      for (let x = 0; x < mask.width; x += spacing) {
        const pixel = (Math.floor(y) * mask.width + Math.floor(x)) * 4;
        if (pixels[pixel + 3] < 85) continue;
        const i = seed++;
        const tile = Math.floor(x / 19) + Math.floor(y / 13) * 79;
        const missingPatch = random(tile + 31) > .59;
        const initiallyVisible = !missingPatch && random(i + 8) < .44;
        let color = 0;
        let distance = Infinity;
        palette.forEach((rgb, index) => {
          const d = rgb.reduce((sum, channel, c) => sum + (channel - pixels[pixel + c]) ** 2, 0);
          if (d < distance) { color = index; distance = d; }
        });
        const p = {
          x, y, color,
          birth: initiallyVisible ? 0 : .04 + random(tile + 19) * .42 + random(i + 14) * .28 + (missingPatch ? .12 : 0),
          radius: spacing * (1.1 + random(i + 2) * .3),
          depth: random(i + 5),
          angle: (random(tile + 3) - .5) * Math.PI,
          tangent: random(i + 4) * .5,
          fragmentX: (random(tile + 7) - .5) * 16,
          fragmentY: (random(tile + 11) - .5) * 10,
          jitterX: (random(i + 17) - .5) * 7,
          jitterY: (random(i + 23) - .5) * 6
        };
        particles.push(p);
        if (random(i + 80) < .018) floaters.push({ ...p,
          dx: (random(i + 90) - .5) * 70,
          dy: (random(i + 91) - .5) * 48,
          radius: 2 + random(i + 92) * 3
        });
      }
    }
    particles.sort((a, b) => a.depth - b.depth);
    if (!initialized) {
      initialized = true;
      started = null;
      progress = motion.matches ? 1 : 0;
      heading.style.setProperty('--type-opacity', motion.matches ? 1 : 0);
      heading.classList.add('splats-ready');
    }
    requestDraw();
  }

  heading.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') restart();
  });
  heading.addEventListener('click', restart);
  heading.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType === 'touch') return;
    const box = heading.getBoundingClientRect();
    pointer.x = (event.clientX - box.left) / box.width * 2 - 1;
    pointer.y = (event.clientY - box.top) / box.height * 2 - 1;
    requestDraw();
  });
  heading.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = 0;
    requestDraw();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) {
      progress = 1;
      started = performance.now() - duration;
    }
    requestDraw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now();
    else {
      if (started !== null && hiddenAt) started += performance.now() - hiddenAt;
      hiddenAt = 0;
      requestDraw();
    }
  });
  document.fonts.ready.then(() => {
    rebuild();
    new ResizeObserver(rebuild).observe(heading);
  });
})();
