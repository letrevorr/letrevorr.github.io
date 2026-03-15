(function() {
    // constants
    const CONFIG = {
    Xmin: 0,
    Xmax: 100,
    Ymin: -10,
    Ymax: 50,
    g: 9.81,
    MAX_COMPONENT: 20,
    MAX_TOTAL: 28.3,
    TARGET_FPS: 60
    };

    // defaults
    const state = {
    vx: 14.14,
    vy: 14.14,
    angle: 45,
    h0: 0,
    currentTime: 0,
    maxTime: 0,
    isPlaying: false,
    animationId: null,
    lastTimestamp: 0,
    speedFactor: 5.0,
    
    showVelocity: true,
    showComponents: true,
    showForce: false,
    showAcceleration: false,
    showTrajectory: true,
    
    cachedMaxTime: 0,
    lastVx: null,
    lastVy: null,
    lastH0: null,
    cachedPeakTime: 0,
    
    pendingRedraw: false
    };

    // elements
    const svg = document.getElementById('projectile-svg');
    const ns = 'http://www.w3.org/2000/svg';

    const vxSlider = document.getElementById('vx-slider');
    const vySlider = document.getElementById('vy-slider');
    const vSlider = document.getElementById('v-slider');
    const angleSlider = document.getElementById('angle-slider');
    const heightSlider = document.getElementById('height-slider');
    const timeSlider = document.getElementById('time-slider');
    const speedSlider = document.getElementById('speed-slider');
    
    const vxNumber = document.getElementById('vx-number');
    const vyNumber = document.getElementById('vy-number');
    const vNumber = document.getElementById('v-number');
    const angleNumber = document.getElementById('angle-number');
    const heightNumber = document.getElementById('height-number');

    const timeSpan = document.getElementById('time-value');
    const speedSpan = document.getElementById('speed-value');
    
    const statX = document.getElementById('stat-x');
    const statY = document.getElementById('stat-y');
    const statSpeed = document.getElementById('stat-speed');
    const statMaxHeight = document.getElementById('stat-max-height');
    const statRange = document.getElementById('stat-range');
    
    const playBtn = document.getElementById('play-btn');
    const resetBtn = document.getElementById('reset-btn');
    const playIcon = document.getElementById('play-icon');
    const playText = document.getElementById('play-text');
    const tooltipText = document.getElementById('play-tooltip-text');
    
    const timePeakMark = document.getElementById('time-peak-mark');
    const timeLandMark = document.getElementById('time-land-mark');
    
    const trajectoryCheckbox = document.getElementById('show-trajectory');
    const trajectoryLabel = document.getElementById('trajectory-label');

    // funcUtility
    function validateNumber(value, min, max, defaultValue) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
    }

    // funcCalc
    function getTotalVelocity() { 
    return Math.sqrt(state.vx * state.vx + state.vy * state.vy); 
    }
    
    function getAngleFromComponents() {
    if (state.vx === 0) return state.vy > 0 ? 90 : (state.vy < 0 ? -90 : 0);
    return Math.atan2(state.vy, state.vx) * 180 / Math.PI;
    }
    
    function calculateMaxTime() {
    if (state.vx === state.lastVx && state.vy === state.lastVy && state.h0 === state.lastH0 && state.cachedMaxTime) {
        return state.cachedMaxTime;
    }
    
    const a = -0.5 * CONFIG.g;
    const b = state.vy;
    const c = state.h0;
    const disc = b * b - 4 * a * c;
    
    if (disc < 0) {
        state.cachedMaxTime = 5;
    } else {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        let tMax = Math.max(t1, t2, 0);
        state.cachedMaxTime = (tMax > 0 && tMax < 100) ? tMax : 5;
    }
    
    state.lastVx = state.vx;
    state.lastVy = state.vy;
    state.lastH0 = state.h0;
    
    state.cachedPeakTime = state.vy / CONFIG.g;
    if (state.cachedPeakTime < 0) state.cachedPeakTime = 0;
    
    return state.cachedMaxTime;
    }

    // funcGets
    
    function getPosition(t) {
    const x = state.vx * t;
    const y = state.h0 + state.vy * t - 0.5 * CONFIG.g * t * t;
    return { x, y: Math.max(y, 0) };
    }
    
    function getCurrentVelocity(t) { 
    return { vx: state.vx, vy: state.vy - CONFIG.g * t }; 
    }
    
    function getMaxHeight() {
    const tPeak = state.vy / CONFIG.g;
    if (tPeak < 0) return state.h0;
    const yPeak = state.h0 + state.vy * tPeak - 0.5 * CONFIG.g * tPeak * tPeak;
    return Math.max(yPeak, state.h0);
    }

    function getRange() {
    if (isNegativeAngleToGround()) return 0;
    return state.vx * state.maxTime;
    }

    // funcUpdate
    function updateMaxTimeAndClamp() {
    state.maxTime = calculateMaxTime();
    if (!state.maxTime || state.maxTime < 0.01) state.maxTime = 5;
    
    timeSlider.max = state.maxTime;
    timeSlider.step = state.maxTime / 500;
    
    if (state.currentTime > state.maxTime) { 
        state.currentTime = state.maxTime; 
        timeSlider.value = state.currentTime; 
    }
    timeSpan.textContent = state.currentTime.toFixed(2) + ' s';
    
    if (timePeakMark && timeLandMark) {
        timePeakMark.textContent = `↑ ${state.cachedPeakTime.toFixed(2)} s`;
        timeLandMark.textContent = `↓ ${state.maxTime.toFixed(2)} s`;
    }
    }

    function isNegativeAngleToGround() {
    return (state.h0 === 0 && state.angle < 0);
    }

    // updateStates
    function updateDisabledStates() {
    const disabled = isNegativeAngleToGround();

    // tooltipPlay
    if (disabled) {
        playBtn.classList.add('play-button-disabled');
        playBtn.style.pointerEvents = 'none';
        tooltipText.style.visibility = 'visible';
        tooltipText.style.opacity = '1';
        
        if (state.isPlaying) {
        state.isPlaying = false;
        updatePlayButton();
        }
    } else {
        playBtn.classList.remove('play-button-disabled');
        playBtn.style.pointerEvents = 'auto';
        tooltipText.style.visibility = 'hidden';
        tooltipText.style.opacity = '0';
    }

    // checkboxTraj
    if (disabled) {
        trajectoryCheckbox.classList.add('checkbox-disabled');
        trajectoryLabel.classList.add('cursor-not-allowed');
        trajectoryCheckbox.disabled = true;
        if (trajectoryCheckbox.checked) {
        trajectoryCheckbox.checked = false;
        state.showTrajectory = false;
        } else {
        state.showTrajectory = false;
        }
    } else {
        trajectoryCheckbox.classList.remove('checkbox-disabled');
        trajectoryLabel.classList.remove('cursor-not-allowed');
        trajectoryCheckbox.disabled = false;
        state.showTrajectory = trajectoryCheckbox.checked;
    }

    scheduleRedraw();
    }

    function updateUIValues() {
    vxNumber.value = state.vx.toFixed(1);
    vyNumber.value = state.vy.toFixed(1);
    
    const total = getTotalVelocity();
    vNumber.value = total.toFixed(1);
    vSlider.value = total.toFixed(1);
    
    angleNumber.value = state.angle.toFixed(0);
    heightNumber.value = state.h0.toFixed(1);
    
    speedSpan.textContent = state.speedFactor.toFixed(1);
    }

    function updateAllFromComponents() {
    state.vx = Math.min(CONFIG.MAX_COMPONENT, Math.max(0, state.vx));
    state.vy = Math.min(CONFIG.MAX_COMPONENT, Math.max(-CONFIG.MAX_COMPONENT, state.vy));
    
    state.angle = getAngleFromComponents();
    
    vxSlider.value = state.vx;
    vySlider.value = state.vy;
    
    updateUIValues();
    updateMaxTimeAndClamp();
    updateDisabledStates();
    scheduleRedraw();
    }

    function updateFromTotalAndAngle() {
    const total = parseFloat(vSlider.value);
    const angRad = state.angle * Math.PI / 180;
    
    let newVx = total * Math.cos(angRad);
    let newVy = total * Math.sin(angRad);
    
    state.vx = Math.min(CONFIG.MAX_COMPONENT, Math.max(0, newVx));
    state.vy = Math.min(CONFIG.MAX_COMPONENT, Math.max(-CONFIG.MAX_COMPONENT, newVy));
    
    vxSlider.value = state.vx;
    vySlider.value = state.vy;
    
    updateUIValues();
    updateMaxTimeAndClamp();
    updateDisabledStates();
    scheduleRedraw();
    }

    function updateStats() {
    const pos = getPosition(state.currentTime);
    const vel = getCurrentVelocity(state.currentTime);
    const speed = Math.hypot(vel.vx, vel.vy);
    const ballAngleDeg = Math.atan2(vel.vy, vel.vx) * 180 / Math.PI;
    const maxH = getMaxHeight();
    const range = getRange();
    
    statX.textContent = pos.x.toFixed(2) + ' m';
    statY.textContent = pos.y.toFixed(2) + ' m';
    statSpeed.textContent = speed.toFixed(2) + ' ms⁻¹ (' + ballAngleDeg.toFixed(1) + '°)';
    statMaxHeight.textContent = maxH.toFixed(2) + ' m';
    statRange.textContent = range.toFixed(2) + ' m';
    }

    // redraw
    function scheduleRedraw() {
    if (!state.pendingRedraw) {
        state.pendingRedraw = true;
        requestAnimationFrame(() => {
        redrawSVG();
        state.pendingRedraw = false;
        });
    }
    }

    // drawSVG
    function redrawSVG() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const w = 800, h = 500;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const pad = 60;
    const drawW = w - 2 * pad;
    const drawH = h - 2 * pad;
    const worldW = CONFIG.Xmax - CONFIG.Xmin;
    const worldH = CONFIG.Ymax - CONFIG.Ymin;

    const scaleX = drawW / worldW;
    const scaleY = drawH / worldH;
    const scale = Math.min(scaleX, scaleY);

    const originX = pad - CONFIG.Xmin * scale;
    const originY = h - pad + CONFIG.Ymin * scale;

    function toSVG(x, y) {
        return { x: originX + x * scale, y: originY - y * scale };
    }

    // drawAxes
    const axisGroup = document.createElementNS(ns, 'g');
    axisGroup.setAttribute('stroke', '#9ca3af');
    axisGroup.setAttribute('fill', 'none');
    axisGroup.setAttribute('stroke-width', '1.2');
    
    let line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', toSVG(0,0).x);
    line.setAttribute('y1', toSVG(0,0).y);
    line.setAttribute('x2', toSVG(CONFIG.Xmax,0).x);
    line.setAttribute('y2', toSVG(CONFIG.Xmax,0).y);
    axisGroup.appendChild(line);
    
    line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', toSVG(0, CONFIG.Ymin).x);
    line.setAttribute('y1', toSVG(0, CONFIG.Ymin).y);
    line.setAttribute('x2', toSVG(0, CONFIG.Ymax).x);
    line.setAttribute('y2', toSVG(0, CONFIG.Ymax).y);
    axisGroup.appendChild(line);
    svg.appendChild(axisGroup);

    // arrowheads
    const arrowGroup = document.createElementNS(ns, 'g');
    arrowGroup.setAttribute('fill', '#4b5563');
    
    let tipX = toSVG(CONFIG.Xmax,0).x;
    let arrowX = document.createElementNS(ns, 'polygon');
    arrowX.setAttribute('points', `${tipX-6},${toSVG(0,0).y-4} ${tipX},${toSVG(0,0).y} ${tipX-6},${toSVG(0,0).y+4}`);
    arrowGroup.appendChild(arrowX);
    
    let tipY = toSVG(0, CONFIG.Ymax).y;
    let arrowY = document.createElementNS(ns, 'polygon');
    arrowY.setAttribute('points', `${toSVG(0,0).x-4},${tipY+6} ${toSVG(0,0).x},${tipY} ${toSVG(0,0).x+4},${tipY+6}`);
    arrowGroup.appendChild(arrowY);
    svg.appendChild(arrowGroup);

    // axes
    const tickGroup = document.createElementNS(ns, 'g');
    tickGroup.setAttribute('stroke', '#4b5563');
    tickGroup.setAttribute('stroke-width', '0.5');
    tickGroup.setAttribute('font-family', 'Lexend');
    tickGroup.setAttribute('fill', '#4b5563');
    tickGroup.setAttribute('font-size', '10');
    
    for (let x = 20; x <= CONFIG.Xmax; x += 20) { 
        let p = toSVG(x, 0); 
        let tick = document.createElementNS(ns, 'line'); 
        tick.setAttribute('x1', p.x); 
        tick.setAttribute('y1', p.y-5); 
        tick.setAttribute('x2', p.x); 
        tick.setAttribute('y2', p.y+5); 
        tickGroup.appendChild(tick); 
        let lbl = document.createElementNS(ns, 'text'); 
        lbl.setAttribute('x', p.x); 
        lbl.setAttribute('y', p.y+18); 
        lbl.setAttribute('text-anchor', 'middle'); 
        lbl.textContent = x; 
        tickGroup.appendChild(lbl); 
    }
    
    for (let y = -10; y <= CONFIG.Ymax; y += 10) { 
        let p = toSVG(0, y); 
        let tick = document.createElementNS(ns, 'line'); 
        tick.setAttribute('x1', p.x-5); 
        tick.setAttribute('y1', p.y); 
        tick.setAttribute('x2', p.x+5); 
        tick.setAttribute('y2', p.y); 
        tickGroup.appendChild(tick); 
        let lbl = document.createElementNS(ns, 'text'); 
        lbl.setAttribute('x', p.x-18); 
        lbl.setAttribute('y', p.y+4); 
        lbl.setAttribute('text-anchor', 'end'); 
        lbl.textContent = y; 
        tickGroup.appendChild(lbl); 
    }
    svg.appendChild(tickGroup);

    // Add axis labels "x/m" and "y/m"
    const axisLabelGroup = document.createElementNS(ns, 'g');
    axisLabelGroup.setAttribute('stroke', '#4b5563');
    axisLabelGroup.setAttribute('stroke-width', '0.5');
    axisLabelGroup.setAttribute('font-family', 'Lexend');
    axisLabelGroup.setAttribute('fill', '#4b5563');
    axisLabelGroup.setAttribute('font-size', '10');

    // X-axis label "x/m"
    let xLabel = document.createElementNS(ns, 'text');
    let xLabelPos = toSVG(CONFIG.Xmax, 0);
    xLabel.setAttribute('x', xLabelPos.x + 10);
    xLabel.setAttribute('y', xLabelPos.y + 3);
    xLabel.setAttribute('text-anchor', 'start');
    xLabel.textContent = 'x / m';
    axisLabelGroup.appendChild(xLabel);

    // Y-axis label "y/m"
    let yLabel = document.createElementNS(ns, 'text');
    let yLabelPos = toSVG(0, CONFIG.Ymax);
    yLabel.setAttribute('x', yLabelPos.x - 10);
    yLabel.setAttribute('y', yLabelPos.y - 10);
    yLabel.setAttribute('text-anchor', 'start');
    yLabel.textContent = 'y / m';
    axisLabelGroup.appendChild(yLabel);

    svg.appendChild(axisLabelGroup);

    // trajPastFuture
    if (state.showTrajectory && state.maxTime > 0.01) {
        const steps = 200;
        let pastPoints = [];
        
        for (let i = 0; i <= steps; i++) {
        let t = (i / steps) * state.currentTime;
        if (t > state.currentTime) break;
        let pos = getPosition(t);
        if (pos.x > CONFIG.Xmax) break;
        if (pos.y < CONFIG.Ymin || pos.y > CONFIG.Ymax) continue;
        let p = toSVG(pos.x, pos.y);
        pastPoints.push(`${p.x},${p.y}`);
        }
        
        if (pastPoints.length > 1) {
        let poly = document.createElementNS(ns, 'polyline');
        poly.setAttribute('points', pastPoints.join(' '));
        poly.setAttribute('stroke', '#000');
        poly.setAttribute('stroke-width', '3');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke-linecap', 'round');
        svg.appendChild(poly);
        }

        if (state.currentTime < state.maxTime - 0.01) {
        let futurePoints = [];
        let startPos = getPosition(state.currentTime);
        if (startPos.x <= CONFIG.Xmax) {
            let sp = toSVG(startPos.x, startPos.y);
            futurePoints.push(`${sp.x},${sp.y}`);
            
            for (let i = 1; i <= steps; i++) {
            let t = state.currentTime + (i / steps) * (state.maxTime - state.currentTime);
            if (t > state.maxTime) break;
            let pos = getPosition(t);
            if (pos.x > CONFIG.Xmax) break;
            if (pos.y < CONFIG.Ymin || pos.y > CONFIG.Ymax) continue;
            let p = toSVG(pos.x, pos.y);
            futurePoints.push(`${p.x},${p.y}`);
            }
            
            if (futurePoints.length > 1) {
            let poly = document.createElementNS(ns, 'polyline');
            poly.setAttribute('points', futurePoints.join(' '));
            poly.setAttribute('stroke', '#aaa');
            poly.setAttribute('stroke-width', '2');
            poly.setAttribute('fill', 'none');
            poly.setAttribute('stroke-dasharray', '6,4');
            svg.appendChild(poly);
            }
        }
        }
    }

    // ballVectors
    const ballPos = getPosition(state.currentTime);
    if (ballPos.x <= CONFIG.Xmax && ballPos.y >= CONFIG.Ymin && ballPos.y <= CONFIG.Ymax) {
        const ballSVG = toSVG(ballPos.x, ballPos.y);
        const vel = getCurrentVelocity(state.currentTime);
        const vectorScale = 1; // for velocity

        /**
         * Draws an arrow on an SVG canvas.
         *
         * @param {number} x1 - The starting x-coordinate of the arrow.
         * @param {number} y1 - The starting y-coordinate of the arrow.
         * @param {number} dx - The x-component of the vector.
         * @param {number} dy - The y-component of the vector.
         * @param {string} color - The color of the arrow.
         * @param {number} width - The stroke width of the arrow's line.
         * @param {string} label - The text label for the arrow.
         * @param {number} [offsetX=0] - The x-offset for the label position.
         * @param {number} [offsetY=-15] - The y-offset for the label position.
         * @param {number} [internalScale=vectorScale] - A scaling factor for the vector's length.
         * @param {boolean} [doubleHeaded=false] - If true, draws a double arrowhead (>>).
         */
        function drawArrow(x1, y1, dx, dy, color, width, label, offsetX = 0, offsetY = -15, internalScale = vectorScale, doubleHeaded = false) {
            // Do not draw zero-length vectors
            if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

            // Calculate the tip of the vector based on components and scaling
            let x2 = x1 + dx * internalScale * scale;
            let y2 = y1 - dy * internalScale * scale; // Y is inverted for screen coordinates

            let group = document.createElementNS(ns, 'g');
            let angle = Math.atan2(y2 - y1, x2 - x1);
            let vectorLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

            // Define fixed arrowhead dimensions for a consistent look
            const HEAD_LEN = 12; // Fixed arrow head length in pixels
            const HEAD_ANGLE = 0.3; // Fixed arrow head angle in radians

            let lineStartX = x1;
            let lineStartY = y1;
            let lineEndX = x2 - HEAD_LEN * Math.cos(angle);
            let lineEndY = y2 - HEAD_LEN * Math.sin(angle);

            // Draw the main line of the arrow
            let line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', lineStartX);
            line.setAttribute('y1', lineStartY);
            line.setAttribute('x2', lineEndX);
            line.setAttribute('y2', lineEndY);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', width);
            line.setAttribute('stroke-linecap', 'round');
            group.appendChild(line);

            // Draw arrowheads at the tip, but only if the vector is long enough
            if (vectorLength > HEAD_LEN * 0.5) {
                if (doubleHeaded) {
                    // First arrowhead (at the very tip)
                    let tipLeftX = x2 - HEAD_LEN * Math.cos(angle - HEAD_ANGLE);
                    let tipLeftY = y2 - HEAD_LEN * Math.sin(angle - HEAD_ANGLE);
                    let tipRightX = x2 - HEAD_LEN * Math.cos(angle + HEAD_ANGLE);
                    let tipRightY = y2 - HEAD_LEN * Math.sin(angle + HEAD_ANGLE);

                    let tipPoly = document.createElementNS(ns, 'polygon');
                    tipPoly.setAttribute('points', `${x2},${y2} ${tipLeftX},${tipLeftY} ${tipRightX},${tipRightY}`);
                    tipPoly.setAttribute('fill', color);
                    group.appendChild(tipPoly);

                    // Second arrowhead (drawn slightly behind the first for the '>>' effect)
                    let innerHeadX = x2 - HEAD_LEN * 0.7 * Math.cos(angle);
                    let innerHeadY = y2 - HEAD_LEN * 0.7 * Math.sin(angle);

                    let innerLeftX = innerHeadX - HEAD_LEN * Math.cos(angle - HEAD_ANGLE);
                    let innerLeftY = innerHeadY - HEAD_LEN * Math.sin(angle - HEAD_ANGLE);
                    let innerRightX = innerHeadX - HEAD_LEN * Math.cos(angle + HEAD_ANGLE);
                    let innerRightY = innerHeadY - HEAD_LEN * Math.sin(angle + HEAD_ANGLE);

                    let innerPoly = document.createElementNS(ns, 'polygon');
                    innerPoly.setAttribute('points', `${innerHeadX},${innerHeadY} ${innerLeftX},${innerLeftY} ${innerRightX},${innerRightY}`);
                    innerPoly.setAttribute('fill', color);
                    group.appendChild(innerPoly);
                } else {
                    // Single arrowhead
                    let leftX = x2 - HEAD_LEN * Math.cos(angle - HEAD_ANGLE);
                    let leftY = y2 - HEAD_LEN * Math.sin(angle - HEAD_ANGLE);
                    let rightX = x2 - HEAD_LEN * Math.cos(angle + HEAD_ANGLE);
                    let rightY = y2 - HEAD_LEN * Math.sin(angle + HEAD_ANGLE);

                    let poly = document.createElementNS(ns, 'polygon');
                    poly.setAttribute('points', `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`);
                    poly.setAttribute('fill', color);
                    group.appendChild(poly);
                }
            }

            // Label positioning logic
            let labelX, labelY;
            if (label === 'vₓ') {
                labelX = x2 + 10;
                labelY = y2;
            } else if (label === 'vᵧ') {
                labelX = x2;
                labelY = y2 + (dy >= 0 ? -10 : 10);
            } else if (label === 'v') {
                labelX = x2 + 10 * Math.cos(angle);
                labelY = y2 + 10 * Math.sin(angle);
            } else if (label === 'W') {
                labelX = (x1 + x2) / 2 - 10;
                labelY = (y1 + y2) / 2;
            } else if (label === 'a') {
                labelX = (x1 + x2) / 2;
                labelY = (y1 + y2) / 2;
            } else {
                labelX = (x1 + x2) / 2 + offsetX;
                labelY = (y1 + y2) / 2 + offsetY;
            }

            let txt = document.createElementNS(ns, 'text');

            // Handle subscript text for velocity components
            if (label === 'vₓ' || label === 'vᵧ') {
                let tspan1 = document.createElementNS(ns, 'tspan');
                tspan1.textContent = 'v';
                let tspan2 = document.createElementNS(ns, 'tspan');
                tspan2.setAttribute('baseline-shift', 'sub');
                tspan2.setAttribute('font-size', '8');
                tspan2.textContent = label === 'vₓ' ? 'x' : 'y';
                txt.appendChild(tspan1);
                txt.appendChild(tspan2);
            } else {
                txt.textContent = label;
            }

            txt.setAttribute('x', labelX);
            txt.setAttribute('y', labelY);
            txt.setAttribute('fill', color);
            txt.setAttribute('font-size', '11');
            txt.setAttribute('font-weight', '600');
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'middle');

            group.appendChild(txt);
            svg.appendChild(group);
        }

        // Draw weight
        if (state.showForce) {
            drawArrow(ballSVG.x, ballSVG.y, 0, -CONFIG.g, '#f97316', 2, 'W', 0, 0, vectorScale);
        }

        // Draw components and velocity
        if (state.showComponents) {
            if (Math.abs(vel.vx) > 0.2) drawArrow(ballSVG.x, ballSVG.y, vel.vx, 0, '#e12a2a', 2, 'vₓ', 0, 0, vectorScale);
            if (Math.abs(vel.vy) > 0.2) drawArrow(ballSVG.x, ballSVG.y, 0, vel.vy, '#3b82f6', 2, 'vᵧ', 0, 0, vectorScale);
        }

        if (state.showVelocity && (Math.abs(vel.vx) > 0.1 || Math.abs(vel.vy) > 0.1)) {
            drawArrow(ballSVG.x, ballSVG.y, vel.vx, vel.vy, '#31a02b', 2.5, 'v', 0, 0, vectorScale);
        }

        // Draw accleration (top right corner)
        if (state.showAcceleration) {
            drawArrow(750, 20, 0, -CONFIG.g, '#5900a1', 2, 'a = g', 25, -10, vectorScale, true);
        }

        // Ball
        let circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', ballSVG.x);
        circle.setAttribute('cy', ballSVG.y);
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
    }

    updateStats();
    }

    // ==================== ANIMATION CONTROL ====================
    function updatePlayButton() {
    if (state.isPlaying) {
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" fill="currentColor" /><rect x="14" y="4" width="4" height="16" fill="currentColor" />';
        playText.textContent = 'Pause';
    } else {
        playIcon.innerHTML = '<polygon points="5,3 19,12 5,21" fill="currentColor" />';
        playText.textContent = 'Play';
    }
    }

    function updatePhysics(deltaTime) {
    state.currentTime += deltaTime;
    if (state.currentTime >= state.maxTime) {
        state.currentTime = state.maxTime;
        state.isPlaying = false;
        updatePlayButton();
    }
    timeSlider.value = state.currentTime;
    timeSpan.textContent = state.currentTime.toFixed(2) + ' s';
    scheduleRedraw();
    }

    function animate(timestamp) {
    if (state.isPlaying) {
        if (state.lastTimestamp) {
        const deltaTime = (timestamp - state.lastTimestamp) / 1000;
        const speedMultiplier = state.speedFactor / 5.0;
        const delta = Math.min(0.05, deltaTime * speedMultiplier);
        updatePhysics(delta);
        }
        state.lastTimestamp = timestamp;
    } else {
        state.lastTimestamp = 0;
    }
    
    state.animationId = requestAnimationFrame(animate);
    }

    // eventListeners
    
    // sliders
    vxSlider.addEventListener('input', () => { 
    state.vx = parseFloat(vxSlider.value); 
    updateAllFromComponents(); 
    });
    
    vySlider.addEventListener('input', () => { 
    state.vy = parseFloat(vySlider.value); 
    updateAllFromComponents(); 
    });
    
    vSlider.addEventListener('input', () => { 
    updateFromTotalAndAngle(); 
    });
    
    angleSlider.addEventListener('input', () => { 
    state.angle = parseFloat(angleSlider.value); 
    updateFromTotalAndAngle(); 
    });
    
    heightSlider.addEventListener('input', () => { 
    state.h0 = parseFloat(heightSlider.value); 
    heightNumber.value = state.h0.toFixed(1);
    updateMaxTimeAndClamp(); 
    updateDisabledStates(); 
    scheduleRedraw(); 
    });
    
    timeSlider.addEventListener('input', () => { 
    if (state.isPlaying) { 
        state.isPlaying = false; 
        updatePlayButton(); 
    } 
    state.currentTime = parseFloat(timeSlider.value); 
    timeSpan.textContent = state.currentTime.toFixed(2) + ' s'; 
    scheduleRedraw(); 
    });
    
    speedSlider.addEventListener('input', () => {
    state.speedFactor = parseFloat(speedSlider.value);
    speedSpan.textContent = state.speedFactor.toFixed(1);
    });

    // inputLimit
    vxNumber.addEventListener('change', () => {
    let val = validateNumber(vxNumber.value, 0, CONFIG.MAX_COMPONENT, state.vx);
    state.vx = val;
    vxSlider.value = val;
    updateAllFromComponents();
    });
    
    vyNumber.addEventListener('change', () => {
    let val = validateNumber(vyNumber.value, -CONFIG.MAX_COMPONENT, CONFIG.MAX_COMPONENT, state.vy);
    state.vy = val;
    vySlider.value = val;
    updateAllFromComponents();
    });
    
    vNumber.addEventListener('change', () => {
    let total = validateNumber(vNumber.value, 0, CONFIG.MAX_TOTAL, getTotalVelocity());
    vSlider.value = total;
    updateFromTotalAndAngle();
    });
    
    angleNumber.addEventListener('change', () => {
    state.angle = validateNumber(angleNumber.value, -90, 90, state.angle);
    angleSlider.value = state.angle;
    updateFromTotalAndAngle();
    });
    
    heightNumber.addEventListener('change', () => {
    state.h0 = validateNumber(heightNumber.value, 0, 20, state.h0);
    heightSlider.value = state.h0;
    updateMaxTimeAndClamp();
    updateDisabledStates();
    scheduleRedraw();
    });

    // button
    playBtn.addEventListener('click', () => { 
    if (isNegativeAngleToGround()) return;
    
    if (state.currentTime >= state.maxTime - 0.01) { 
        state.currentTime = 0; 
        timeSlider.value = 0; 
        timeSpan.textContent = '0.00 s'; 
    } 
    state.isPlaying = !state.isPlaying; 
    updatePlayButton(); 
    state.lastTimestamp = 0; 
    scheduleRedraw(); 
    });
    
    resetBtn.addEventListener('click', () => { 
    state.isPlaying = false; 
    updatePlayButton(); 
    state.currentTime = 0; 
    timeSlider.value = 0; 
    timeSpan.textContent = '0.00 s'; 
    scheduleRedraw(); 
    });

    // checkbox
    document.getElementById('show-velocity').addEventListener('change', e => { 
    state.showVelocity = e.target.checked; 
    scheduleRedraw(); 
    });
    
    document.getElementById('show-components').addEventListener('change', e => { 
    state.showComponents = e.target.checked; 
    scheduleRedraw(); 
    });
    
    document.getElementById('show-force').addEventListener('change', e => { 
    state.showForce = e.target.checked; 
    scheduleRedraw(); 
    });
    
    document.getElementById('show-acceleration').addEventListener('change', e => { 
    state.showAcceleration = e.target.checked; 
    scheduleRedraw(); 
    });
    
    trajectoryCheckbox.addEventListener('change', e => { 
    if (!isNegativeAngleToGround()) {
        state.showTrajectory = e.target.checked; 
    } else {
        e.target.checked = false;
        state.showTrajectory = false;
    }
    scheduleRedraw(); 
    });

    // cleanup
    window.addEventListener('beforeunload', () => {
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }
    });

    // initial
    vSlider.max = CONFIG.MAX_TOTAL;
    vNumber.max = CONFIG.MAX_TOTAL;
    
    updateUIValues();
    updateMaxTimeAndClamp();
    updateDisabledStates();
    scheduleRedraw();
    state.animationId = requestAnimationFrame(animate);
})();