const POPUP_COUNT = 8;
const POPUP_WIDTH = 168;
const POPUP_HEIGHT = 118;
const STEP_MS = 1000 / 45;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#b8f7d4', '#cdb4db', '#90dbf4', '#f4a261', '#f7ede2'];
const POPUP_FEATURES = [
  'popup=yes',
  'toolbar=no',
  'menubar=no',
  'location=no',
  'status=no',
  'scrollbars=no',
  'resizable=no',
  `width=${POPUP_WIDTH}`,
  `height=${POPUP_HEIGHT}`,
  `innerWidth=${POPUP_WIDTH}`,
  `innerHeight=${POPUP_HEIGHT}`
];

const startButton = document.querySelector('#startButton');
const kickButton = document.querySelector('#kickButton');
const closeButton = document.querySelector('#closeButton');
const statusLine = document.querySelector('#status');

let bodies = [];
let timer = 0;
let lastTick = performance.now();

function setStatus(message) {
  statusLine.textContent = message;
}

function testPopupPermission() {
  const probe = window.open('', 'popup-physics-permission-test', 'popup=yes,width=80,height=60,innerWidth=80,innerHeight=60,left=80,top=80');
  if (!probe || probe.closed) return false;
  probe.document.write('<!doctype html><title>OK</title><body style="font-family:Arial">Popup check OK</body>');
  probe.document.close();
  probe.close();
  return true;
}

function popupHtml(index, color) {
  return `<!doctype html>
<html><head><title>Body ${index + 1}</title><style>
html,body{height:100%;margin:0;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:${color};color:#111;user-select:none;cursor:grab}
body{border:5px solid #111;display:grid;place-items:center;text-align:center}
body:active{cursor:grabbing}.box{padding:8px}.name{font-size:34px;font-weight:900;line-height:1}.hint{font-size:12px;font-weight:700;margin-top:6px}
</style></head><body data-index="${index}"><div class="box"><div class="name">#${index + 1}</div><div class="hint">drag me<br>click = punch</div></div></body></html>`;
}

function spawnBody(index) {
  const x = Math.round(screen.availLeft + 120 + Math.random() * Math.max(80, screen.availWidth - 360));
  const y = Math.round(screen.availTop + 120 + Math.random() * Math.max(80, screen.availHeight - 320));
  const color = COLORS[index % COLORS.length];
  const popup = window.open('', `popup-box2d-body-${Date.now()}-${index}`, [...POPUP_FEATURES, `left=${x}`, `top=${y}`].join(','));
  if (!popup || popup.closed) return null;

  popup.document.write(popupHtml(index, color));
  popup.document.close();
  keepPopupSmall(popup, x, y);

  const body = {
    popup, x, y,
    vx: (Math.random() - .5) * 16,
    vy: (Math.random() - .5) * 12,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    dragging: false,
    dragDX: 0,
    dragDY: 0,
    lastDragX: x,
    lastDragY: y,
    lastResize: 0
  };

  popup.addEventListener('beforeunload', () => { body.closed = true; });
  popup.document.body.addEventListener('pointerdown', (event) => {
    body.dragging = true;
    body.dragDX = event.screenX - body.x;
    body.dragDY = event.screenY - body.y;
    body.lastDragX = body.x;
    body.lastDragY = body.y;
  });
  popup.document.body.addEventListener('click', () => punch(body));
  popup.addEventListener('pointerup', () => { body.dragging = false; });
  popup.addEventListener('pointermove', (event) => {
    if (!body.dragging) return;
    body.lastDragX = body.x;
    body.lastDragY = body.y;
    body.x = event.screenX - body.dragDX;
    body.y = event.screenY - body.dragDY;
    body.vx = (body.x - body.lastDragX) * .8;
    body.vy = (body.y - body.lastDragY) * .8;
  });

  return body;
}

function keepPopupSmall(popup, x, y) {
  try {
    popup.resizeTo(POPUP_WIDTH, POPUP_HEIGHT);
    popup.moveTo(Math.round(x), Math.round(y));
  } catch {
    // Some browsers disallow resizing/moving windows. The game still cleans these up later.
  }
}

function punch(body) {
  body.vx += (Math.random() - .5) * 34;
  body.vy += -14 - Math.random() * 12;
}

function kickAll() {
  bodies.forEach((body) => {
    body.vx += (Math.random() - .5) * 42;
    body.vy += -18 - Math.random() * 18;
  });
}

function solveBodyCollision(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const overlapX = (a.width + b.width) / 2 - Math.abs(ax - bx);
  const overlapY = (a.height + b.height) / 2 - Math.abs(ay - by);
  if (overlapX <= 0 || overlapY <= 0) return;

  if (overlapX < overlapY) {
    const push = overlapX / 2 * Math.sign(ax - bx || 1);
    a.x += push; b.x -= push;
    const av = a.vx;
    a.vx = b.vx * .82;
    b.vx = av * .82;
  } else {
    const push = overlapY / 2 * Math.sign(ay - by || 1);
    a.y += push; b.y -= push;
    const av = a.vy;
    a.vy = b.vy * .82;
    b.vy = av * .82;
  }
}

function tick() {
  const now = performance.now();
  const dt = Math.min(2, (now - lastTick) / STEP_MS);
  lastTick = now;

  const minX = screen.availLeft;
  const minY = screen.availTop;
  const maxX = screen.availLeft + screen.availWidth - POPUP_WIDTH;
  const maxY = screen.availTop + screen.availHeight - POPUP_HEIGHT;

  bodies = bodies.filter((body) => body.popup && !body.popup.closed && !body.closed);

  bodies.forEach((body) => {
    if (!body.dragging) {
      body.vy += 1.15 * dt;
      body.vx *= .995;
      body.vy *= .998;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }

    if (body.x < minX) { body.x = minX; body.vx = Math.abs(body.vx) * .8; }
    if (body.x > maxX) { body.x = maxX; body.vx = -Math.abs(body.vx) * .8; }
    if (body.y < minY) { body.y = minY; body.vy = Math.abs(body.vy) * .8; }
    if (body.y > maxY) { body.y = maxY; body.vy = -Math.abs(body.vy) * .72; body.vx *= .94; }
  });

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) solveBodyCollision(bodies[i], bodies[j]);
  }

  bodies.forEach((body) => {
    try {
      if (now - body.lastResize > 500) {
        body.popup.resizeTo(POPUP_WIDTH, POPUP_HEIGHT);
        body.lastResize = now;
      }
      body.popup.moveTo(Math.round(body.x), Math.round(body.y));
    } catch {
      body.closed = true;
    }
  });

  setStatus(`${bodies.length} popup bodies running. Drag inside a popup, click to punch, or kick them all.`);
  if (bodies.length === 0) stopGame('All popups are closed. Start again whenever you like.');
}

function stopGame(message = 'Closed the popup physics demo.') {
  clearInterval(timer);
  timer = 0;
  bodies.forEach((body) => { if (body.popup && !body.popup.closed) body.popup.close(); });
  bodies = [];
  startButton.disabled = false;
  kickButton.disabled = true;
  closeButton.disabled = true;
  setStatus(message);
}

function startGame() {
  if (!testPopupPermission()) {
    setStatus('Popup permission is blocked. Allow popups for this page, then press start again.');
    return;
  }

  stopGame('Starting...');
  bodies = Array.from({ length: POPUP_COUNT }, (_, index) => spawnBody(index)).filter(Boolean);
  if (bodies.length === 0) {
    setStatus('No popups opened. Please allow popups for this page and try again.');
    return;
  }

  startButton.disabled = true;
  kickButton.disabled = false;
  closeButton.disabled = false;
  lastTick = performance.now();
  timer = setInterval(tick, STEP_MS);
  kickAll();
}

startButton.addEventListener('click', startGame);
kickButton.addEventListener('click', kickAll);
closeButton.addEventListener('click', () => stopGame());
window.addEventListener('beforeunload', () => stopGame());
