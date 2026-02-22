const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");

const coneSlider = document.getElementById("coneAngle");
const coneAngleValue = document.getElementById("coneAngleValue");
const resetScenarioButton = document.getElementById("resetScenario");

const goal = {
  y: 84,
  left: 340,
  right: 640,
  depth: 35,
};

goal.lineY = goal.y + goal.depth;

goal.centerX = (goal.left + goal.right) / 2;

goal.width = goal.right - goal.left;

const attacker = {
  x: 490,
  y: 430,
  r: 16,
  color: "#ff9f1a",
  label: "Attacker",
};

const keeper = {
  x: 490,
  y: 140,
  r: 20,
  color: "#2584ff",
  label: "Goalkeeper",
};

const initialState = {
  coneAngleDeg: Number(coneSlider.value),
  attacker: { x: attacker.x, y: attacker.y },
  keeper: { x: keeper.x, y: keeper.y },
};

let coneAngleDeg = Number(coneSlider.value);
let dragging = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeAngle(angle) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function rayToGoalX(origin, angle) {
  const dy = Math.sin(angle);
  if (Math.abs(dy) < 1e-6) return null;

  const t = (goal.lineY - origin.y) / dy;
  if (t <= 0) return null;

  return origin.x + t * Math.cos(angle);
}

function getAngularIntervalOnGoalLine(
  origin,
  centerAngle,
  halfAngle,
  minX,
  maxX,
) {
  if (maxX <= minX) return null;

  const isInside = (x) => {
    const angleToPoint = Math.atan2(goal.lineY - origin.y, x - origin.x);
    const diff = normalizeAngle(angleToPoint - centerAngle);
    return Math.abs(diff) <= halfAngle + 1e-9;
  };

  const candidates = [];

  const boundaryA = centerAngle - halfAngle;
  const boundaryB = centerAngle + halfAngle;
  const xA = rayToGoalX(origin, boundaryA);
  const xB = rayToGoalX(origin, boundaryB);

  if (xA !== null) candidates.push(xA);
  if (xB !== null) candidates.push(xB);

  if (isInside(minX)) candidates.push(minX);
  if (isInside(maxX)) candidates.push(maxX);

  if (candidates.length === 0) return null;

  const left = clamp(Math.min(...candidates), minX, maxX);
  const right = clamp(Math.max(...candidates), minX, maxX);

  if (right <= left) return null;
  return { left, right };
}

function getConeData() {
  const half = (coneAngleDeg * Math.PI) / 360;
  const centerAngle = Math.atan2(
    goal.lineY - attacker.y,
    goal.centerX - attacker.x,
  );
  const leftAngle = centerAngle - half;
  const rightAngle = centerAngle + half;
  const interval = getAngularIntervalOnGoalLine(
    attacker,
    centerAngle,
    half,
    goal.left,
    goal.right,
  );

  return {
    centerAngle,
    leftAngle,
    rightAngle,
    goalInterval: interval,
  };
}

function getKeeperShadowInterval(coneData, extraReach = 0) {
  if (
    !coneData.goalInterval ||
    coneData.goalInterval.right <= coneData.goalInterval.left
  )
    return null;

  const dx = keeper.x - attacker.x;
  const dy = keeper.y - attacker.y;
  const d = Math.hypot(dx, dy);

  if (d < 1e-6) {
    return { ...coneData.goalInterval };
  }

  const keeperDir = Math.atan2(dy, dx);

  if (keeper.y >= attacker.y) {
    return null;
  }

  const effectiveRadius = keeper.r + extraReach;

  if (d <= effectiveRadius) {
    return { ...coneData.goalInterval };
  }

  const delta = Math.asin(Math.min(1, effectiveRadius / d));
  const keeperWindow = getAngularIntervalOnGoalLine(
    attacker,
    keeperDir,
    delta,
    goal.left,
    goal.right,
  );

  if (!keeperWindow) return null;

  const shadow = {
    left: Math.max(keeperWindow.left, coneData.goalInterval.left),
    right: Math.min(keeperWindow.right, coneData.goalInterval.right),
  };

  if (shadow.right <= shadow.left) return null;
  return shadow;
}

function drawPitch() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const stripeCount = 10;
  for (let i = 0; i < stripeCount; i++) {
    const x = (canvas.width / stripeCount) * i;
    ctx.fillStyle = i % 2 === 0 ? "#71ba66" : "#68b45f";
    ctx.fillRect(x, 0, canvas.width / stripeCount + 1, canvas.height);
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(goal.left, goal.y);
  ctx.lineTo(goal.left, goal.lineY);
  ctx.moveTo(goal.right, goal.y);
  ctx.lineTo(goal.right, goal.lineY);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
  ctx.beginPath();
  ctx.moveTo(goal.left, goal.lineY + 0.5);
  ctx.lineTo(goal.right, goal.lineY + 0.5);
  ctx.stroke();
}

function drawCone(coneData) {
  const far = 1300;

  ctx.beginPath();
  ctx.moveTo(attacker.x, attacker.y);
  ctx.lineTo(
    attacker.x + Math.cos(coneData.leftAngle) * far,
    attacker.y + Math.sin(coneData.leftAngle) * far,
  );
  ctx.lineTo(
    attacker.x + Math.cos(coneData.rightAngle) * far,
    attacker.y + Math.sin(coneData.rightAngle) * far,
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 166, 0, 0.22)";
  ctx.fill();

  ctx.strokeStyle = "rgba(201, 120, 0, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(attacker.x, attacker.y);
  ctx.lineTo(
    attacker.x + Math.cos(coneData.leftAngle) * far,
    attacker.y + Math.sin(coneData.leftAngle) * far,
  );
  ctx.moveTo(attacker.x, attacker.y);
  ctx.lineTo(
    attacker.x + Math.cos(coneData.rightAngle) * far,
    attacker.y + Math.sin(coneData.rightAngle) * far,
  );
  ctx.stroke();
}

function drawGoalVisibility(coneData, standingShadow, reachableShadow) {
  ctx.lineCap = "round";

  ctx.lineWidth = 10;
  ctx.strokeStyle = "#dce6f3";
  ctx.beginPath();
  ctx.moveTo(goal.left, goal.lineY);
  ctx.lineTo(goal.right, goal.lineY);
  ctx.stroke();

  if (
    coneData.goalInterval &&
    coneData.goalInterval.right > coneData.goalInterval.left
  ) {
    ctx.strokeStyle = "#2eaf5d";
    ctx.beginPath();
    ctx.moveTo(coneData.goalInterval.left, goal.lineY);
    ctx.lineTo(coneData.goalInterval.right, goal.lineY);
    ctx.stroke();

    if (reachableShadow) {
      ctx.strokeStyle = "rgba(222, 52, 45, 0.55)";
      ctx.beginPath();
      ctx.moveTo(reachableShadow.left, goal.lineY);
      ctx.lineTo(reachableShadow.right, goal.lineY);
      ctx.stroke();

      ctx.fillStyle = "rgba(222, 52, 45, 0.18)";
      ctx.beginPath();
      ctx.moveTo(attacker.x, attacker.y);
      ctx.lineTo(reachableShadow.left, goal.lineY);
      ctx.lineTo(reachableShadow.right, goal.lineY);
      ctx.closePath();
      ctx.fill();
    }

    if (standingShadow) {
      ctx.strokeStyle = "#de342d";
      ctx.beginPath();
      ctx.moveTo(standingShadow.left, goal.lineY);
      ctx.lineTo(standingShadow.right, goal.lineY);
      ctx.stroke();

      ctx.fillStyle = "rgba(222, 52, 45, 0.32)";
      ctx.beginPath();
      ctx.moveTo(attacker.x, attacker.y);
      ctx.lineTo(standingShadow.left, goal.lineY);
      ctx.lineTo(standingShadow.right, goal.lineY);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.lineCap = "butt";
}

function drawPlayer(player) {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#0f1722";
  ctx.font = "600 14px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(player.label, player.x, player.y + player.r + 20);
}

function draw() {
  drawPitch();
  const coneData = getConeData();
  drawCone(coneData);

  const standingShadow = getKeeperShadowInterval(coneData, 0);
  const reachableShadow = getKeeperShadowInterval(coneData, keeper.r);
  drawGoalVisibility(coneData, standingShadow, reachableShadow);

  drawPlayer(attacker);
  drawPlayer(keeper);
}

function getPointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function pickPlayer(pos) {
  const players = [attacker, keeper];
  for (const player of players) {
    if (Math.hypot(pos.x - player.x, pos.y - player.y) <= player.r + 5) {
      return player;
    }
  }
  return null;
}

canvas.addEventListener("pointerdown", (event) => {
  const pos = getPointerPos(event);
  dragging = pickPlayer(pos);
  if (!dragging) return;

  canvas.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;

  const pos = getPointerPos(event);
  dragging.x = clamp(pos.x, 40 + dragging.r, canvas.width - 40 - dragging.r);
  if (dragging === keeper) {
    keeper.y = clamp(pos.y, goal.lineY + keeper.r + 1, attacker.y - 15);
  }

  if (dragging === attacker) {
    attacker.y = clamp(
      pos.y,
      goal.lineY + 30 + attacker.r,
      canvas.height - 35 - attacker.r,
    );
    attacker.y = clamp(
      attacker.y,
      keeper.y + 20,
      canvas.height - 35 - attacker.r,
    );
  }

  draw();
});

function endDrag(event) {
  if (!dragging) return;
  canvas.classList.remove("dragging");
  canvas.releasePointerCapture(event.pointerId);
  dragging = null;
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

coneSlider.addEventListener("input", () => {
  coneAngleDeg = Number(coneSlider.value);
  coneAngleValue.textContent = `${coneAngleDeg}°`;
  draw();
});

resetScenarioButton.addEventListener("click", () => {
  coneAngleDeg = initialState.coneAngleDeg;
  coneSlider.value = String(initialState.coneAngleDeg);
  coneAngleValue.textContent = `${initialState.coneAngleDeg}°`;

  attacker.x = initialState.attacker.x;
  attacker.y = initialState.attacker.y;
  keeper.x = initialState.keeper.x;
  keeper.y = initialState.keeper.y;

  dragging = null;
  canvas.classList.remove("dragging");
  draw();
});

draw();
