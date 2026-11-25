const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.YUEHAI_PLAYWRIGHT || 'playwright-core');
const output = path.resolve(__dirname, '../YueHaiAssistant/assets/demo');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.YUEHAI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  try {
    const page = await browser.newPage();
    for (let index = 0; index < 8; index++) {
      const result = await page.evaluate(async index => {
        const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
        document.body.replaceChildren(canvas);
        const c = canvas.getContext('2d'); const W = 960, H = 600;
        const tau = Math.PI * 2;
        function gradient(a, b, x, y, radius) {
          const g = c.createRadialGradient(x || W / 2, y || H / 2, 0, x || W / 2, y || H / 2, radius || 650); g.addColorStop(0, a); g.addColorStop(1, b); return g;
        }
        function circle(x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, tau); c.fillStyle = fill; c.fill(); }
        function label(text, color) { c.font = '13px Segoe UI'; c.letterSpacing = '3px'; c.fillStyle = color; c.fillText(text, 44, 51); }
        function draw(t) {
          const p = t * tau / 3.2;
          c.clearRect(0, 0, W, H); c.globalAlpha = 1; c.shadowBlur = 0; c.setTransform(1, 0, 0, 1, 0, 0);
          if (index === 0) {
            c.fillStyle = gradient('#173769', '#080f20', 500, 280); c.fillRect(0, 0, W, H);
            c.globalCompositeOperation = 'screen';
            for (let i = 0; i < 24; i++) {
              c.beginPath(); const offset = Math.sin(p + i * .04) * 24;
              c.moveTo(-100, 360 + i * 3); c.bezierCurveTo(160, 520 - i * 8, 430, 80 + i * 7 + offset, 1060, 330 + i * 6);
              c.strokeStyle = `hsla(${199 + i},85%,${55 + i}%,${.07 + i / 450})`; c.lineWidth = 2 + i / 5; c.shadowBlur = 12; c.shadowColor = '#5796ff'; c.stroke();
            }
            c.globalCompositeOperation = 'source-over'; c.shadowBlur = 30; c.shadowColor = '#9ad8ff'; circle(650 + Math.sin(p) * 6, 204, 40, '#a7cae8'); circle(665 + Math.sin(p) * 6, 192, 37, '#17345d'); c.shadowBlur = 0;
            label('01   /   LUNAR FLOW', '#94b4d0');
          } else if (index === 1) {
            c.fillStyle = gradient('#b08abb', '#25233d', 470, 210); c.fillRect(0, 0, W, H);
            c.save(); c.translate(W / 2, H / 2); c.rotate(-.3 + Math.sin(p) * .1);
            for (let i = 0; i < 6; i++) { c.fillStyle = gradient('#edc8e0', '#7768a255', -80 + i * 40, -100 + i * 20, 270); c.beginPath(); c.ellipse(-240 + i * 95, -55 + Math.sin(p + i) * 35, 130, 210, .4, 0, tau); c.fill(); }
            c.restore(); c.fillStyle = '#f4e6ef'; c.font = 'italic 88px Georgia'; c.fillText('soft', 95, 320); c.font = 'italic 66px Georgia'; c.fillText('light.', 194, 385); label('02   /   SOFT GRADIENT', '#e5cedd');
          } else if (index === 2) {
            c.fillStyle = gradient('#1d4440', '#081a1d'); c.fillRect(0, 0, W, H);
            c.save(); c.translate(480, 310); c.rotate(-.4);
            for (let j = 0; j < 5; j++) {
              c.beginPath(); c.ellipse(0, 0, 110 + j * 39, 50 + j * 24, j * .35, 0, tau); c.strokeStyle = '#a7e3ca44'; c.lineWidth = 1; c.stroke();
              for (let k = 0; k < 9; k++) { const angle = k * tau / 9 + p * (j % 2 ? 1 : -1) + j; const x = Math.cos(angle) * (110 + j * 39), y = Math.sin(angle) * (50 + j * 24); c.shadowBlur = 12; c.shadowColor = '#b6f6db'; circle(x, y, k % 3 === 0 ? 4 : 2, '#c6ebd6'); }
            }
            c.shadowBlur = 45; c.shadowColor = '#83d5bb'; circle(0, 0, 36, gradient('#dcf6df', '#53998a', 0, 0, 44)); c.restore(); label('03   /   PARTICLE ORBIT', '#a4c8b8');
          } else if (index === 3) {
            c.fillStyle = '#c7d4c1'; c.fillRect(0, 0, W, H); c.strokeStyle = '#52675822'; c.lineWidth = 1;
            for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
            for (let y = 0; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            c.save(); c.translate(480, 340 + Math.sin(p) * 18); c.rotate(Math.sin(p) * .035); c.fillStyle = '#243b31'; c.font = 'bold 260px Georgia'; c.textAlign = 'center'; c.fillText('Aa', 0, 50); c.restore(); c.textAlign = 'start';
            c.font = '14px Segoe UI'; c.fillStyle = '#536451'; c.fillText('A little movement. A new expression.', 287, 505); label('04   /   TYPE IN MOTION', '#536451');
          } else if (index === 4) {
            c.fillStyle = '#29251f'; c.fillRect(0, 0, W, H);
            const g = c.createLinearGradient(0, 100, 0, 500); g.addColorStop(0, '#b9a07d'); g.addColorStop(.7, '#cca777'); g.addColorStop(1, '#625444'); c.fillStyle = g; c.fillRect(84, 85, 792, 430);
            circle(560 + Math.sin(p) * 15, 270, 100, '#d9bb89');
            for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(84, 400 + j * 20); for (let x = 84; x <= 876; x += 10) c.lineTo(x, 410 + j * 22 + Math.sin(x / 110 + j * 2 + p * .08) * 45); c.lineTo(876, 515); c.lineTo(84, 515); c.fillStyle = ['#927c59', '#76694e', '#5a5544', '#414438', '#303831'][j]; c.fill(); }
            c.fillStyle = '#e1d9c566'; for (let j = 0; j < 2500; j++) { const x = ((j * 197 + Math.floor(t * 6) * 113) % 792) + 84, y = ((j * 131) % 430) + 85; c.globalAlpha = j % 5 / 10; c.fillRect(x, y, 1, 1); } c.globalAlpha = 1;
            label('05   /   GRAIN & MEMORY', '#c3b59e');
          } else if (index === 5) {
            c.fillStyle = gradient('#45456e', '#14162b'); c.fillRect(0, 0, W, H); c.save(); c.translate(480, 310); c.rotate(-.12 + Math.sin(p) * .1);
            for (let i = 10; i > 0; i--) { c.save(); c.rotate(i * .1 + Math.sin(p) * .03 * i); const s = 35 + i * 25; c.strokeStyle = `rgba(191,186,245,${.15 + i / 20})`; c.lineWidth = 2; c.shadowBlur = 14; c.shadowColor = '#a1a1ff'; c.strokeRect(-s, -s * .65, s * 2, s * 1.3); c.restore(); } c.restore(); label('06   /   FOLDING SPACE', '#aaa9d0');
          } else if (index === 6) {
            const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9eafba'); g.addColorStop(.55, '#bac9c9'); g.addColorStop(.56, '#607f8a'); g.addColorStop(1, '#253f50'); c.fillStyle = g; c.fillRect(0, 0, W, H); circle(690, 200, 60, '#d9e2dc');
            for (let j = 0; j < 45; j++) { c.beginPath(); c.moveTo(0, 340 + j * 6); for (let x = 0; x <= W; x += 8) c.lineTo(x, 340 + j * 6 + Math.sin(x / (15 + j) + j) * (1 + j / 10)); c.strokeStyle = j % 3 ? '#d8e6e715' : '#d8e6e744'; c.lineWidth = 1; c.stroke(); } label('07   /   QUIET COAST', '#465f6d');
          } else {
            c.fillStyle = '#172442'; c.fillRect(0, 0, W, H);
            for (let j = 0; j < 8; j++) { c.beginPath(); c.moveTo(-50, H); c.lineTo(-50, 120 + j * 40); c.bezierCurveTo(300, 30 + j * 20, 600, 560 - j * 20, 1050, 130 + j * 30); c.lineTo(1050, H); c.fillStyle = ['#253960', '#304f7a', '#46678f', '#557d9e', '#6b95ad', '#83afba', '#9bc6c8', '#b4d8d1'][j]; c.fill(); } circle(750, 120, 28, '#c6e6de'); label('08   /   THE BLUE HOUR', '#b0c8dd');
          }
          c.shadowBlur = 0; c.globalAlpha = 1; c.fillStyle = index === 3 || index === 6 ? '#354d4855' : '#e1eaf055'; c.font = '10px Segoe UI'; c.fillText('Y U E H A I   /   S T U D I O', 44, 566);
        }
        draw(.8);
        const poster = canvas.toDataURL('image/png').split(',')[1];
        if (index >= 6) return { poster };
        const stream = canvas.captureStream(30);
        const chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1600000 });
        const finished = new Promise(resolve => { recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; recorder.onstop = resolve; });
        const begin = performance.now(); let frame;
        function tick(now) { draw((now - begin) / 1000); frame = requestAnimationFrame(tick); }
        recorder.start(); frame = requestAnimationFrame(tick);
        await new Promise(resolve => setTimeout(resolve, 3200)); recorder.stop(); cancelAnimationFrame(frame); await finished; stream.getTracks().forEach(track => track.stop());
        const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
        let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 8192));
        return { poster, video: btoa(binary) };
      }, index);
      const number = String(index + 1).padStart(2, '0');
      fs.writeFileSync(path.join(output, number + '.png'), Buffer.from(result.poster, 'base64'));
      if (result.video) fs.writeFileSync(path.join(output, number + '.webm'), Buffer.from(result.video, 'base64'));
      console.log('Generated demo ' + number);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
