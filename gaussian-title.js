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
  // Larger splats use a shaded translucent core so their ellipsoid volume reads clearly.
  const volumeSprites = palette.map((color, index) => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const brush = sprite.getContext('2d');
    brush.globalAlpha = .72;
    brush.drawImage(sprites[index], 0, 0, 64, 64);
    brush.globalAlpha = 1;
    const surface = brush.createRadialGradient(26, 24, 1, 32, 32, 20);
    surface.addColorStop(0, 'rgba(249,253,233,.92)');
    surface.addColorStop(.2, 'rgba(232,243,204,.55)');
    surface.addColorStop(.46, `rgba(${color},.17)`);
    surface.addColorStop(.83, `rgba(${color},.52)`);
    surface.addColorStop(1, `rgba(${color},.12)`);
    brush.fillStyle = surface;
    brush.beginPath();
    brush.arc(32, 32, 20, 0, Math.PI * 2);
    brush.fill();
    brush.strokeStyle = `rgba(${color},.42)`;
    brush.lineWidth = 1;
    brush.stroke();
    brush.strokeStyle = `rgba(${color},.12)`;
    brush.beginPath();
    brush.arc(32, 32, 25, 0, Math.PI * 2);
    brush.stroke();
    return sprite;
  });

  let particles = [];
  let floaters = [];
  let healthyText = null;
  let width = 0;
  let height = 0;
  let frame = 0;
  let started = null;
  let lastFrame = 0;
  let progress = 0;
  let initialized = false;
  let hiddenAt = 0;
  const duration = 2500;
  const pointer = { x: 0, y: 0 };
  const random = seed => {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (from, to, value) => {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  // Spatially coherent confidence: some surfaces are already reconstructed well.
  const damageAt = (x, y) => {
    const cellX = x / (width < 600 ? 35 : 57);
    const cellY = y / (width < 600 ? 23 : 31);
    const ix = Math.floor(cellX);
    const iy = Math.floor(cellY);
    const tx = smooth(0, 1, cellX - ix);
    const ty = smooth(0, 1, cellY - iy);
    const mix = (a, b, t) => a + (b - a) * t;
    const a = mix(random(ix + iy * 79 + 27), random(ix + 1 + iy * 79 + 27), tx);
    const b = mix(random(ix + (iy + 1) * 79 + 27), random(ix + 1 + (iy + 1) * 79 + 27), tx);
    return smooth(.42, .64, mix(a, b, ty));
  };

  function splat(x, y, radius, ratio, angle, color, opacity, volume = false) {
    if (opacity < .012) return;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.globalAlpha = opacity;
    context.drawImage((volume ? volumeSprites : sprites)[color], -radius, -radius * ratio, radius * 2, radius * 2 * ratio);
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
    const repair = smooth(.08, .96, progress);
    const damage = 1 - repair;
    const precision = smooth(.58, 1, repair);
    const textOpacity = smooth(.72, 1, repair) * .91;
    const opacity = 1 - precision * .58;
    heading.style.setProperty('--type-opacity', motion.matches ? 1 : textOpacity);
    heading.dataset.reconstruction = progress >= 1 ? 'restored' : repair < .08 ? 'partial' : repair < .72 ? 'repairing' : 'refining';
    context.clearRect(0, 0, width, height);
    // Keep confident regions sharp from the first frame; only damaged regions move.
    if (healthyText) {
      context.globalAlpha = Math.max(0, .91 - textOpacity);
      context.drawImage(healthyText, 0, 0, width, height);
      context.globalAlpha = 1;
    }

    for (const p of particles) {
      const presence = p.birth === 0 ? 1 : smooth(p.birth, Math.min(1, p.birth + .18), repair);
      if (presence < .01) continue;
      const localDamage = damage * p.damage;
      const displacement = damage * damage * p.damage;
      const depthShift = p.depth * (motion.matches ? 0 : .4 + localDamage);
      const x = p.x + (p.fragmentX + p.jitterX) * displacement + pointer.x * depthShift;
      const y = p.y + (p.fragmentY + p.jitterY) * displacement + pointer.y * depthShift * .6;
      const radius = p.radius * (1 + localDamage * .7);
      const angle = p.angle * localDamage + p.tangent * (1 - localDamage);
      const texture = 1 - damage * .85 * (1 - p.damage);
      splat(x, y, radius, .72 - localDamage * .08, angle, p.color,
        presence * opacity * texture * (.69 + p.depth * .24) * (1 - localDamage * .83));
      if (p.coarse && localDamage > .015) {
        splat(x, y, p.radius * (1 + localDamage * (2.8 + p.depth * 1.2)),
          .66 + p.depth * .26, angle, p.color,
          Math.pow(localDamage, .85) * (.74 + p.depth * .15), true);
      }
    }

    // Detached floaters and duplicated fragments disappear as support improves.
    for (const p of floaters) {
      splat(p.x + p.dx * damage, p.y + p.dy * damage,
        p.radius * (1 + damage), .72, p.angle, p.color, damage * damage * .4, true);
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

    const maskData = brush.getImageData(0, 0, mask.width, mask.height);
    const pixels = maskData.data;
    healthyText = document.createElement('canvas');
    healthyText.width = mask.width;
    healthyText.height = mask.height;
    const healthyBrush = healthyText.getContext('2d');
    const healthyData = healthyBrush.createImageData(mask.width, mask.height);
    healthyData.data.set(pixels);
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const alpha = (y * mask.width + x) * 4 + 3;
        if (pixels[alpha]) healthyData.data[alpha] *= 1 - damageAt(x, y);
      }
    }
    healthyBrush.putImageData(healthyData, 0, 0);
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
        const localDamage = damageAt(x, y);
        const initiallyVisible = localDamage < .12 || random(i + 8) < .78 - localDamage * .23;
        let color = 0;
        let distance = Infinity;
        palette.forEach((rgb, index) => {
          const d = rgb.reduce((sum, channel, c) => sum + (channel - pixels[pixel + c]) ** 2, 0);
          if (d < distance) { color = index; distance = d; }
        });
        const p = {
          x, y, color, damage: localDamage, coarse: random(i + 103) < .14,
          birth: initiallyVisible ? 0 : .04 + random(tile + 19) * .36 + random(i + 14) * .24 + localDamage * .12,
          radius: spacing * (1.1 + random(i + 2) * .3),
          depth: random(i + 5),
          angle: (random(tile + 3) - .5) * Math.PI,
          tangent: random(i + 4) * .5,
          fragmentX: (random(tile + 7) - .5) * 10,
          fragmentY: (random(tile + 11) - .5) * 7,
          jitterX: (random(i + 17) - .5) * 4,
          jitterY: (random(i + 23) - .5) * 4
        };
        particles.push(p);
        if (localDamage > .6 && random(i + 80) < .012) floaters.push({ ...p,
          dx: (random(i + 90) - .5) * 45,
          dy: (random(i + 91) - .5) * 30,
          radius: 2.5 + random(i + 92) * 2
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
