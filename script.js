/**
 * 星际数学探险 - 核心逻辑
 */

const Game = {
    score: 0,
    streak: 0,
    currentModule: 'warmup',
    audioCtx: null,
    synthesis: window.speechSynthesis,
    voice: null,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    isLandscape: false,

    init() {
        this.setupMobileOptimizations();
        this.setupNavigation();
        this.setupAudio();
        this.initTTS();
        this.startStarfield();
        this.handleOrientationChange();
        
        // Initialize modules
        WarmupModule.init();
        VisualModule.init();
        EstimationModule.init();
        DivisionModule.init();

        // Start with warmup
        this.switchModule('warmup');
    },

    setupMobileOptimizations() {
        // 防止移动端双击放大
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // 防止页面滚动
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });

        // 监听屏幕方向变化
        window.addEventListener('orientationchange', () => {
            this.handleOrientationChange();
        });

        window.addEventListener('resize', () => {
            this.handleOrientationChange();
        });

        // iOS Safari地址栏处理
        if (this.isMobile) {
            const updateViewportHeight = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            };
            updateViewportHeight();
            window.addEventListener('resize', updateViewportHeight);
        }
        
        // 为所有交互元素添加触摸反馈
        this.addTouchFeedback();
        
        // 防止iOS Safari弹性滚动
        document.addEventListener('touchmove', (e) => {
            if (e.scale !== 1) {
                e.preventDefault();
            }
        }, { passive: false });
    },
    
    addTouchFeedback() {
        // 为所有可点击元素添加触摸反馈
        const interactiveElements = document.querySelectorAll('button, .nav-btn, .diff-btn, .action-btn, .secondary-btn');
        
        interactiveElements.forEach(element => {
            element.addEventListener('touchstart', () => {
                element.style.opacity = '0.7';
            }, { passive: true });
            
            element.addEventListener('touchend', () => {
                element.style.opacity = '1';
            }, { passive: true });
            
            element.addEventListener('touchcancel', () => {
                element.style.opacity = '1';
            }, { passive: true });
        });
    },

    handleOrientationChange() {
        const wasLandscape = this.isLandscape;
        this.isLandscape = window.innerWidth > window.innerHeight;
        
        if (wasLandscape !== this.isLandscape) {
            // 屏幕方向改变时重新调整画布大小
            setTimeout(() => {
                if (this.currentModule === 'warmup' && WarmupModule.canvas) {
                    WarmupModule.resizeCanvas();
                }
                // 可以在这里添加其他模块的重绘逻辑
            }, 100);
        }
    },

    initTTS() {
        // Try to get voices. Chrome needs onvoiceschanged
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => this.loadVoices();
        }
        // Also try immediately in case they are already loaded
        this.loadVoices();
    },

    loadVoices() {
        const voices = this.synthesis.getVoices();
        // Try to find a Chinese voice. 
        // Priority: Microsoft Xiaoxiao (Natural), Microsoft Yaoyao, Google, System Default
        this.voice = voices.find(v => v.lang === 'zh-CN' && v.name.includes('Xiaoxiao')) ||
                     voices.find(v => v.lang === 'zh-CN' && v.name.includes('Yaoyao')) ||
                     voices.find(v => v.lang === 'zh-CN' && v.name.includes('Google')) ||
                     voices.find(v => v.lang === 'zh-CN');
    },

    speak(text) {
        if (!this.synthesis) return;
        
        // Cancel previous speech to avoid queue buildup
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        
        // Adjusted parameters for more natural sound
        // Removed high pitch to fix trembling/robotic sound
        utterance.pitch = 1.0; 
        utterance.rate = 1.5; 
        utterance.volume = 1;

        this.synthesis.speak(utterance);
    },

    setupNavigation() {
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moduleName = e.target.dataset.module;
                this.switchModule(moduleName);
                
                // Update UI
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    },

    switchModule(moduleName) {
        // Hide all modules
        document.querySelectorAll('.game-module').forEach(el => el.classList.remove('active'));
        
        // Show selected
        document.getElementById(`module-${moduleName}`).classList.add('active');
        this.currentModule = moduleName;

        // Stop/Start specific module loops
        WarmupModule.stop();
        if (moduleName === 'warmup') WarmupModule.start();
        
        if (moduleName === 'division') DivisionModule.newGame();
        if (moduleName === 'estimation') EstimationModule.newGame();
    },

    updateScore(points) {
        this.score += points;
        document.getElementById('score').innerText = this.score;
        if (points > 0) {
            this.streak++;
            this.playSound('correct');
        } else {
            this.streak = 0;
            this.playSound('wrong');
        }
        document.getElementById('streak').innerText = this.streak;
    },

    setupAudio() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
    },

    playSound(type) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.5);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        } else if (type === 'pop') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        }
    },

    startStarfield() {
        const canvas = document.getElementById('starfield');
        const ctx = canvas.getContext('2d');
        let width, height;
        const stars = [];

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        
        window.addEventListener('resize', resize);
        resize();

        for(let i=0; i<200; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2,
                speed: Math.random() * 0.5 + 0.1
            });
        }

        const animate = () => {
            ctx.fillStyle = '#0f0c29'; // Clear with bg color (or transparent if handled by CSS)
            ctx.clearRect(0, 0, width, height);
            
            ctx.fillStyle = '#ffffff';
            stars.forEach(star => {
                star.y += star.speed;
                if (star.y > height) star.y = 0;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
            requestAnimationFrame(animate);
        };
        animate();
    }
};

/**
 * 模块一：口算热身 (Meteor Defense)
 * 重构版：陨石防御战 + 连击系统 + 危机模式
 */
const WarmupModule = {
    canvas: null,
    ctx: null,
    bubbles: [], // Now represents Meteors
    particles: [],
    active: false,
    lastSpawn: 0,
    spawnRate: 1500,
    targetQuotient: 0,
    
    // New Game Logic
    timeLeft: 60,
    timerInterval: null,
    difficultyMultiplier: 1, // 1 = Easy, 2 = Medium, 3 = Hard
    streakForTarget: 0, 
    REQUIRED_STREAK: 3,
    combo: 0, // Global combo for this session

    init() {
        this.canvas = document.getElementById('warmup-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 统一的点击处理函数
        const handleInteraction = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            this.handleClick(x, y);
        };
        
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => {
            handleInteraction(e.clientX, e.clientY);
        });
        
        // 触摸事件优化
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleInteraction(touch.clientX, touch.clientY);
        }, {passive: false});

        // Bind Difficulty Buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseFloat(e.target.dataset.speed);
                this.startGame(speed);
            });
        });
    },

    resizeCanvas() {
        if(this.canvas && this.canvas.parentElement) {
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.canvas.height = this.canvas.parentElement.clientHeight;
        }
    },

    start() {
        document.getElementById('warmup-menu').style.display = 'flex';
        document.getElementById('warmup-result').style.display = 'none';
        this.active = false; 
        
        this.resizeCanvas();
    },

    startGame(difficultySpeed) {
        this.difficultyMultiplier = difficultySpeed;
        this.active = true;
        this.bubbles = [];
        this.particles = [];
        this.timeLeft = 60;
        this.streakForTarget = 0;
        this.combo = 0;
        Game.score = 0; 
        Game.updateScore(0);

        document.getElementById('warmup-menu').style.display = 'none';
        this.updateTimerDisplay();
        this.updateProgressDots();
        
        this.setNewTarget();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);

        this.loop();
    },

    stop() {
        this.active = false;
        if (this.timerInterval) clearInterval(this.timerInterval);
    },

    endGame() {
        this.stop();
        document.getElementById('warmup-menu').style.display = 'flex';
        document.getElementById('warmup-result').style.display = 'block';
        document.getElementById('final-score').innerText = Game.score;
        Game.playSound('success'); 
        Game.speak(`时间到！你的得分是 ${Game.score}`);
    },

    updateTimerDisplay() {
        const el = document.getElementById('warmup-timer');
        if(el) {
            el.innerText = this.timeLeft;
            if(this.timeLeft <= 10) el.style.color = 'var(--accent-color)';
            else el.style.color = 'var(--warning-color)';
        }
    },

    updateProgressDots() {
        const dots = document.querySelectorAll('#target-progress .dot');
        dots.forEach((dot, index) => {
            if (index < this.streakForTarget) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    },

    setNewTarget() {
        this.targetQuotient = Math.floor(Math.random() * 8 + 2);
        this.streakForTarget = 0;
        this.updateProgressDots();

        const targetEl = document.getElementById('target-num');
        if(targetEl) {
            targetEl.innerText = this.targetQuotient;
            targetEl.parentElement.style.transform = 'scale(1.2)';
            setTimeout(() => targetEl.parentElement.style.transform = 'scale(1)', 200);
        }
        
        Game.speak(`目标商是 ${this.targetQuotient}`);
    },

    generateMeteorShape(r) {
        const points = [];
        const steps = 8;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const dist = r * (0.8 + Math.random() * 0.4); 
            points.push({x: Math.cos(angle) * dist, y: Math.sin(angle) * dist});
        }
        return points;
    },

    spawnBubble() {
        const isCorrect = Math.random() < 0.4;
        let quotient;
        
        if (isCorrect) {
            quotient = this.targetQuotient;
        } else {
            do {
                quotient = Math.floor(Math.random() * 9 + 1);
            } while (quotient === this.targetQuotient);
        }

        const divisor = Math.floor(Math.random() * 8 + 2) * 10; 
        const dividend = divisor * quotient;
        
        const radius = 45; 
        const x = Math.random() * (this.canvas.width - radius * 2) + radius;
        
        const baseSpeed = 0.5; 
        const speed = (baseSpeed + Math.random() * 0.5) * this.difficultyMultiplier;

        this.bubbles.push({
            x: x,
            y: -radius,
            r: radius,
            text: `${dividend}÷${divisor}`,
            answer: quotient,
            isCorrect: isCorrect,
            speed: speed,
            displayColor: isCorrect ? '#00d2ff' : '#ff0055', // Blue for correct (maybe?), Red for wrong? No, random colors better but let's stick to theme.
            // Actually let's use random neon colors
            colorHue: Math.random() * 360,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.05,
            shapePoints: this.generateMeteorShape(radius)
        });
    },

    createExplosion(x, y, color) {
        // Debris
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                color: color,
                type: 'debris'
            });
        }
        // Shockwave
        this.particles.push({
            x: x,
            y: y,
            r: 10,
            life: 1.0,
            color: 'white',
            type: 'shockwave'
        });
    },

    loop(timestamp) {
        if (!this.active) return;

        const currentSpawnRate = Math.max(300, 800 / this.difficultyMultiplier);

        if (!this.lastSpawn || timestamp - this.lastSpawn > currentSpawnRate) {
            this.spawnBubble();
            this.lastSpawn = timestamp;
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and Draw Meteors
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            let b = this.bubbles[i];
            b.y += b.speed;
            b.angle += b.rotationSpeed;

            ctx.save();
            ctx.translate(b.x, b.y);
            
            // Draw Rotating Ring
            ctx.save();
            ctx.rotate(b.angle);
            ctx.beginPath();
            ctx.arc(0, 0, b.r + 10, 0, Math.PI * 1.5);
            ctx.strokeStyle = `hsla(${b.colorHue}, 100%, 70%, 0.5)`;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
            
            // Draw Meteor Body
            ctx.save();
            ctx.rotate(b.angle * 0.5);
            
            ctx.beginPath();
            if (b.shapePoints && b.shapePoints.length > 0) {
                ctx.moveTo(b.shapePoints[0].x, b.shapePoints[0].y);
                for(let p of b.shapePoints) ctx.lineTo(p.x, p.y);
            } else {
                ctx.arc(0, 0, b.r, 0, Math.PI*2);
            }
            ctx.closePath();

            // Gradient Fill
            const grad = ctx.createRadialGradient(-10, -10, 5, 0, 0, b.r);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(0.4, `hsla(${b.colorHue}, 80%, 60%, 0.8)`);
            grad.addColorStop(1, `hsla(${b.colorHue}, 80%, 40%, 0.6)`);
            
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsla(${b.colorHue}, 100%, 50%, 0.8)`;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Text (No rotation)
            ctx.font = 'bold 28px "Fredoka One"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(b.text, 0, 0);
            ctx.shadowBlur = 0;

            ctx.restore();

            if (b.y - b.r > this.canvas.height) {
                this.bubbles.splice(i, 1);
            }
        }

        // Update and Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            
            if (p.type === 'shockwave') {
                p.r += 5;
                p.life -= 0.05;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${p.life})`;
                ctx.lineWidth = 5;
                ctx.stroke();
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.03;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Draw Combo
        if (this.combo > 1) {
            ctx.save();
            ctx.font = 'bold 60px "Fredoka One"';
            ctx.fillStyle = '#ffdd00';
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const scale = 1 + Math.sin(timestamp / 100) * 0.1;
            ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.strokeText(`COMBO x${this.combo}!`, 0, 0);
            ctx.fillText(`COMBO x${this.combo}!`, 0, 0);
            ctx.restore();
        }

        requestAnimationFrame((t) => this.loop(t));
    },

    handleClick(x, y) {
        if (!this.active) return; 

        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            let b = this.bubbles[i];
            const dist = Math.sqrt((x - b.x) ** 2 + (y - b.y) ** 2);
            
            if (dist < b.r + 10) { // Slightly larger hit area
                if (b.answer === this.targetQuotient) {
                    // Correct!
                    this.createExplosion(b.x, b.y, `hsl(${b.colorHue}, 100%, 70%)`);
                    this.bubbles.splice(i, 1);
                    
                    this.combo++;
                    const comboBonus = this.combo > 1 ? this.combo * 5 : 0;
                    Game.updateScore(10 * this.difficultyMultiplier + comboBonus); 
                    
                    this.streakForTarget++;
                    this.updateProgressDots();

                    if (this.streakForTarget >= this.REQUIRED_STREAK) {
                        Game.playSound('correct'); 
                        setTimeout(() => this.setNewTarget(), 300);
                    } else {
                        // Small correct sound
                        Game.playSound('pop');
                    }
                } else {
                    // Wrong!
                    Game.updateScore(-5); 
                    this.combo = 0; // Reset combo
                    this.createExplosion(b.x, b.y, '#555');
                    this.bubbles.splice(i, 1);
                    Game.playSound('wrong');
                }
                break; 
            }
        }
    },

    showFloatingText(x, y, text) {
        // Placeholder
    }
};

/**
 * 模块二：可视化算理 (Visual Logic)
 * 重构版 V2：试商发射模式 + 零点高亮 + 蓄力发射
 */
const VisualModule = {
    dividend: 0,
    divisor: 0,
    currentWarehouse: 0,
    distributeAmount: 1,
    isLaunching: false,
    launchTimer: null,
    
    init() {
        const btnLaunch = document.getElementById('btn-launch');
        // Mouse events for holding
        btnLaunch.addEventListener('mousedown', () => this.startLaunch());
        btnLaunch.addEventListener('mouseup', () => this.stopLaunch());
        btnLaunch.addEventListener('mouseleave', () => this.stopLaunch());
        // Touch events - 优化移动端体验
        btnLaunch.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            this.startLaunch(); 
        }, {passive: false});
        btnLaunch.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            this.stopLaunch(); 
        }, {passive: false});
        btnLaunch.addEventListener('touchcancel', (e) => { 
            e.preventDefault(); 
            this.stopLaunch(); 
        }, {passive: false});

        document.getElementById('btn-reset-visual').addEventListener('click', () => this.newGame());
        
        const btnPlus = document.getElementById('btn-plus');
        const btnMinus = document.getElementById('btn-minus');
        
        // 添加触摸事件优化
        btnPlus.addEventListener('click', () => this.adjustAmount(1));
        btnMinus.addEventListener('click', () => this.adjustAmount(-1));
        
        // 添加触摸视觉反馈
        [btnPlus, btnMinus].forEach(btn => {
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.95)';
            }, {passive: true});
            btn.addEventListener('touchend', () => {
                btn.style.transform = 'scale(1)';
            }, {passive: true});
        });
    },

    newGame() {
        const divisors = [20, 30, 40];
        this.divisor = divisors[Math.floor(Math.random() * divisors.length)];
        const q = Math.floor(Math.random() * 8 + 2);
        this.dividend = this.divisor * q;
        this.currentWarehouse = this.dividend;
        this.distributeAmount = 1;

        // Render Question with Zero Highlighting
        const qContainer = document.getElementById('visual-question');
        qContainer.innerHTML = ''; 
        
        const createSpans = (str) => {
            const span = document.createElement('span');
            span.className = 'math-term';
            for(let char of str) {
                const s = document.createElement('span');
                s.innerText = char;
                if(char === '0') s.className = 'zero-digit';
                span.appendChild(s);
            }
            return span;
        };

        qContainer.appendChild(createSpans(this.dividend.toString()));
        qContainer.appendChild(document.createTextNode(' ÷ '));
        qContainer.appendChild(createSpans(this.divisor.toString()));
        qContainer.appendChild(document.createTextNode(' = ?'));

        // Hover effects
        qContainer.onmouseenter = () => {
            document.querySelectorAll('.zero-digit').forEach(el => el.classList.add('highlight-zero'));
        };
        qContainer.onmouseleave = () => {
            document.querySelectorAll('.zero-digit').forEach(el => el.classList.remove('highlight-zero'));
        };

        document.getElementById('distribute-amount').innerText = this.distributeAmount;
        this.showFeedback("准备开始分配！按住发射按钮！", "neutral");
        
        this.renderStage();
    },

    adjustAmount(delta) {
        let newVal = this.distributeAmount + delta;
        if (newVal < 1) newVal = 1;
        if (newVal > 9) newVal = 9;
        this.distributeAmount = newVal;
        document.getElementById('distribute-amount').innerText = this.distributeAmount;
    },

    renderStage() {
        const sourceGrid = document.getElementById('source-blocks');
        const robotsGrid = document.getElementById('robots-container');
        const warehouseCount = document.getElementById('warehouse-count');
        
        sourceGrid.innerHTML = '';
        robotsGrid.innerHTML = '';
        
        warehouseCount.innerText = this.currentWarehouse;
        
        const blockCount = this.currentWarehouse / 10;
        for(let i=0; i<blockCount; i++) {
            const block = document.createElement('div');
            block.className = 'mini-block';
            sourceGrid.appendChild(block);
        }

        const robotCount = this.divisor / 10; 
        for(let i=0; i<robotCount; i++) {
            const robot = document.createElement('div');
            robot.className = 'robot-unit';
            robot.innerHTML = `
                <div class="robot-img">🤖</div>
                <div class="robot-holdings"></div>
            `;
            robotsGrid.appendChild(robot);
        }
    },

    startLaunch() {
        if (this.isLaunching) return;
        this.isLaunching = true;
        this.launchLoop();
    },

    stopLaunch() {
        this.isLaunching = false;
        clearTimeout(this.launchTimer);
    },

    launchLoop() {
        if (!this.isLaunching) return;
        
        // Check if we can distribute
        const robots = document.querySelectorAll('.robot-unit');
        const totalNeeded = this.distributeAmount * robots.length * 10;
        
        if (totalNeeded <= this.currentWarehouse) {
            this.launchDistribution();
            // Fire again quickly
            this.launchTimer = setTimeout(() => this.launchLoop(), 300);
        } else {
            this.stopLaunch();
            if (this.currentWarehouse > 0) {
                this.showFeedback(`仓库不够啦！需要 ${totalNeeded}，但只有 ${this.currentWarehouse}。`, "wrong");
            }
        }
    },

    launchDistribution() {
        const robots = document.querySelectorAll('.robot-unit');
        const totalNeeded = this.distributeAmount * robots.length * 10; 
        
        this.currentWarehouse -= totalNeeded;
        document.getElementById('warehouse-count').innerText = this.currentWarehouse;
        
        const sourceGrid = document.getElementById('source-blocks');
        const blocksToRemove = totalNeeded / 10;
        
        let removedCount = 0;
        const blocks = Array.from(sourceGrid.children);
        
        robots.forEach((robot, rIndex) => {
            const holdings = robot.querySelector('.robot-holdings');
            
            for(let i=0; i<this.distributeAmount; i++) {
                if (removedCount < blocks.length) {
                    const sourceBlock = blocks[blocks.length - 1 - removedCount];
                    removedCount++;
                    
                    const startRect = sourceBlock.getBoundingClientRect();
                    const endRect = holdings.getBoundingClientRect();
                    
                    const flyer = sourceBlock.cloneNode(true);
                    flyer.classList.add('flying');
                    flyer.style.left = startRect.left + 'px';
                    flyer.style.top = startRect.top + 'px';
                    document.body.appendChild(flyer);
                    
                    sourceBlock.style.visibility = 'hidden'; 
                    
                    // Faster animation for rapid fire
                    setTimeout(() => {
                        flyer.style.left = (endRect.left + 10) + 'px';
                        flyer.style.top = (endRect.top + 10) + 'px';
                        flyer.style.transform = 'scale(0.5)'; 
                        
                        setTimeout(() => {
                            flyer.remove();
                            const newBlock = document.createElement('div');
                            newBlock.className = 'mini-block';
                            newBlock.style.width = '10px';
                            newBlock.style.height = '10px';
                            holdings.appendChild(newBlock);
                            Game.playSound('pop');
                        }, 300);
                    }, i * 20 + rIndex * 50);
                }
            }
        });

        // Cleanup
        setTimeout(() => {
            for(let i=0; i<blocksToRemove; i++) {
                if(sourceGrid.lastChild) sourceGrid.lastChild.remove();
            }
            this.checkWinCondition();
        }, 500);
    },

    checkWinCondition() {
        if (this.currentWarehouse === 0) {
            const robots = document.querySelectorAll('.robot-unit');
            const perRobot = robots[0].querySelector('.robot-holdings').children.length;
            
            this.showFeedback(`完美分配！每人分得 ${perRobot} 个十。答案是 ${perRobot}！`, "correct");
            Game.updateScore(50);
            Game.playSound('correct');
            this.stopLaunch();
        }
    },

    showFeedback(text, type) {
        const el = document.getElementById('visual-feedback');
        el.innerText = text;
        el.className = 'feedback-text ' + (type === 'neutral' ? '' : type);
        el.style.color = type === 'correct' ? 'var(--success-color)' : (type === 'wrong' ? 'var(--accent-color)' : '#fff');
        if(type !== 'neutral') Game.playSound(type);
        Game.speak(text);
    }
};

/**
 * 模块三：星际导航 (Estimation)
 * 重构版：滑块试商 + 实时反馈
 */
const EstimationModule = {
    dividend: 0,
    divisor: 0,
    
    init() {
        document.getElementById('btn-next-est').addEventListener('click', () => this.newGame());
        document.getElementById('btn-engage').addEventListener('click', () => this.checkAnswer());
        
        const slider = document.getElementById('est-slider');
        slider.addEventListener('input', (e) => this.updateRealtimeCalc(e.target.value));
        
        // 添加触摸优化，确保移动端顺畅
        slider.addEventListener('touchstart', () => {
            slider.style.cursor = 'grabbing';
        });
        slider.addEventListener('touchend', () => {
            slider.style.cursor = 'grab';
        });
    },

    newGame() {
        this.divisor = Math.floor(Math.random() * 80 + 10); 
        const minQ = 3;
        const maxQ = 9;
        const q = Math.floor(Math.random() * (maxQ - minQ) + minQ);
        this.dividend = this.divisor * q + Math.floor(Math.random() * (this.divisor - 1));

        document.getElementById('est-dividend').innerText = this.dividend;
        document.getElementById('est-divisor').innerText = this.divisor;
        
        // Reset Slider
        const slider = document.getElementById('est-slider');
        slider.value = 5;
        this.updateRealtimeCalc(5);

        const startText = "请调节推力滑块...";
        document.getElementById('nav-feedback-display').innerText = startText;
        document.getElementById('nav-feedback-display').style.color = "var(--success-color)";
        Game.speak(startText);
        
        // Reset Ship
        const ship = document.getElementById('player-ship');
        ship.style.left = '10%';
        ship.style.bottom = '50%';
        ship.style.transform = 'translateY(50%) rotate(90deg)'; // Facing right
        ship.style.transition = 'all 0.5s ease';

        // Reset Planet
        const planet = document.getElementById('dest-planet');
        planet.style.right = '10%';
        planet.style.top = '50%';
        planet.style.transform = 'translateY(-50%)';
    },

    updateRealtimeCalc(val) {
        document.getElementById('est-slider-val').innerText = val;
        document.getElementById('est-quotient-display').innerText = val;
        document.getElementById('est-divisor-display').innerText = this.divisor;
        
        const product = this.divisor * val;
        document.getElementById('est-product-display').innerText = product;
        
        // Visual feedback on ship engine?
        // Maybe scale the ship slightly based on power
        const ship = document.getElementById('player-ship');
        ship.style.transform = `translateY(50%) rotate(90deg) scale(${1 + val/20})`;
    },

    checkAnswer() {
        const slider = document.getElementById('est-slider');
        const val = parseInt(slider.value);
        const product = this.divisor * val;
        const feedback = document.getElementById('nav-feedback-display');
        const ship = document.getElementById('player-ship');
        
        // Animate Ship Movement
        ship.style.transition = 'all 1.5s cubic-bezier(0.25, 1, 0.5, 1)';
        
        if (product > this.dividend) {
            // Too High - Overshoot
            ship.style.left = '110%'; // Fly off screen
            
            const text = `警告！动力过载！${product} > ${this.dividend}`;
            feedback.innerText = text;
            feedback.style.color = "var(--accent-color)";
            Game.playSound('wrong');
            Game.speak(`警告！动力过载！${product} 大于 ${this.dividend}`);
        } else {
            const remainder = this.dividend - product;
            if (remainder >= this.divisor) {
                // Too Low - Stop short
                ship.style.left = '40%'; // Stop in middle
                
                const text = `警告！动力不足！余数 ${remainder} >= 除数 ${this.divisor}`;
                feedback.innerText = text;
                feedback.style.color = "var(--warning-color)";
                Game.playSound('wrong');
                Game.speak(`警告！动力不足！余数 ${remainder} 大于等于 除数 ${this.divisor}`);
            } else {
                // Correct - Land
                ship.style.left = 'calc(90% - 60px)'; // Near planet
                
                const text = `轨道同步成功！商是 ${val}，余数 ${remainder}`;
                feedback.innerText = text;
                feedback.style.color = "var(--success-color)";
                Game.updateScore(50);
                Game.playSound('correct');
                Game.speak(text);
            }
        }
    }
};

/**
 * 模块四：交互式竖式 (Interactive Long Division)
 * 重构版：智能提示 + 动态连线
 */
const DivisionModule = {
    dividend: 0,
    divisor: 0,
    digits: [], 
    step: 0, 
    grid: null,
    currentRow: 0,
    currentCol: 0,
    
    currentDividendVal: 0, 
    remainder: 0,
    currentCalculationRow: 2,
    
    idleTimer: null,

    init() {
        this.grid = document.getElementById('division-grid');
        document.getElementById('btn-next-division').addEventListener('click', () => this.newGame());
        
        document.querySelectorAll('.numpad .num-btn').forEach(btn => {
            // 统一的点击处理
            const handlePress = (e) => {
                if (e) e.preventDefault();
                this.resetIdleTimer();
                const val = btn.dataset.val;
                const action = btn.id;
                if (val !== undefined) this.handleInput(val);
                if (action === 'btn-backspace') this.handleBackspace();
                if (action === 'btn-enter') this.handleEnter();
                
                // 添加视觉反馈
                btn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                }, 100);
            };
            
            // 鼠标事件
            btn.addEventListener('click', handlePress);
            
            // 触摸事件优化
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }, {passive: false});
            
            btn.addEventListener('touchend', (e) => {
                handlePress(e);
                btn.style.backgroundColor = '';
            }, {passive: false});
            
            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                btn.style.backgroundColor = '';
            }, {passive: false});
        });
    },

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.showHint();
        }, 5000);
    },

    showHint() {
        // Context aware hint
        if (this.activeInputCell) {
            const r = parseInt(this.activeInputCell.dataset.r);
            if (r === 0) {
                this.helperSay(`试试看，${this.currentDividendVal} 里面有几个 ${this.divisor}？`);
            } else {
                this.helperSay("加油！算出结果填进去。");
            }
        }
    },

    newGame() {
        do {
            this.divisor = Math.floor(Math.random() * 80 + 10);
            const q = Math.floor(Math.random() * 20 + 10); 
            this.dividend = this.divisor * q;
        } while (this.dividend > 999);

        this.digits = this.dividend.toString().split('').map(Number);
        
        this.renderGridInitial();
        this.startStep1();
        this.resetIdleTimer();
    },

    renderGridInitial() {
        this.grid.innerHTML = '';
        this.currentCalculationRow = 2;
        
        const createCell = (r, c, content = '', classes = []) => {
            const cell = document.createElement('div');
            cell.className = `cell ${classes.join(' ')}`;
            cell.style.gridColumn = c + 1;
            cell.style.gridRow = r + 1;
            cell.innerText = content;
            cell.dataset.r = r;
            cell.dataset.c = c;
            this.grid.appendChild(cell);
            return cell;
        };

        const divStr = this.divisor.toString();
        createCell(1, 0, divStr[0]);
        createCell(1, 1, divStr[1], ['border-right']); 
        
        this.digits.forEach((d, i) => {
            createCell(1, 2 + i, d, ['border-bottom']); 
        });

        for(let i=2; i<6; i++) {
            createCell(0, i, '', ['border-bottom']);
        }
        
        this.helperSay(`我们要计算 ${this.dividend} ÷ ${this.divisor}`);
        
        this.currentRow = 0; 
        this.currentCol = 2; 
        
        const firstTwo = parseInt(this.digits[0] + '' + this.digits[1]);
        if (firstTwo >= this.divisor) {
            this.currentDividendVal = firstTwo;
            this.currentCol = 3; 
        } else {
            const firstThree = parseInt(this.digits.join(''));
            this.currentDividendVal = firstThree;
            this.currentCol = 4; 
        }
    },

    activeInputCell: null,

    startStep1() {
        this.helperSay(`看 ${this.currentDividendVal}里面有几个 ${this.divisor}？`);
        this.highlightInput(0, this.currentCol); 
    },

    highlightInput(r, c) {
        if (this.activeInputCell) {
            this.activeInputCell.classList.remove('input-active');
        }
        
        let cell = this.grid.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell) {
            const div = document.createElement('div');
            div.className = `cell`;
            div.style.gridColumn = c + 1;
            div.style.gridRow = r + 1;
            div.dataset.r = r;
            div.dataset.c = c;
            this.grid.appendChild(div);
            cell = div;
        }
        
        cell.classList.add('input-active');
        this.activeInputCell = cell;
        this.inputValue = '';
        cell.innerText = '?';
    },

    handleInput(val) {
        if (!this.activeInputCell) return;
        this.inputValue = val;
        this.activeInputCell.innerText = val;
    },

    handleBackspace() {
        if (!this.activeInputCell) return;
        this.inputValue = '';
        this.activeInputCell.innerText = '?';
    },

    handleEnter() {
        if (!this.activeInputCell || this.inputValue === '') return;
        
        const val = parseInt(this.inputValue);
        const r = parseInt(this.activeInputCell.dataset.r);
        const c = parseInt(this.activeInputCell.dataset.c);

        if (r === 0) {
            const correctQ = Math.floor(this.currentDividendVal / this.divisor);
            if (val === correctQ) {
                this.activeInputCell.classList.remove('input-active');
                this.activeInputCell.classList.add('correct');
                Game.playSound('correct');
                this.helperSay(`对了！${val} 乘以 ${this.divisor} 是多少？`);
                
                // Draw dynamic line (simulated by highlighting)
                this.drawConnectionLine();

                const product = val * this.divisor;
                this.showProductStep(product, this.currentCalculationRow, c); 
                
            } else {
                this.activeInputCell.classList.add('wrong');
                Game.playSound('wrong');
                if (val > correctQ) this.helperSay("太大了！积会比被除数还大哦。");
                else this.helperSay("太小了！余数会比除数大哦。");
                setTimeout(() => this.activeInputCell.classList.remove('wrong'), 500);
            }
        }
    },

    drawConnectionLine() {
        // Visual effect: Highlight divisor and quotient briefly
        // In a real implementation, we would draw an SVG line.
        // Here we just flash them.
        const divisorCells = [
            this.grid.querySelector('.cell[data-r="1"][data-c="0"]'),
            this.grid.querySelector('.cell[data-r="1"][data-c="1"]')
        ];
        divisorCells.forEach(c => c && c.classList.add('highlight-connect'));
        this.activeInputCell.classList.add('highlight-connect');
        
        setTimeout(() => {
            divisorCells.forEach(c => c && c.classList.remove('highlight-connect'));
            this.activeInputCell.classList.remove('highlight-connect');
        }, 1000);
    },

    showProductStep(product, r, alignCol) {
        const pStr = product.toString();
        
        for (let i = 0; i < pStr.length; i++) {
            const digit = pStr[pStr.length - 1 - i];
            const col = alignCol - i;
            
            const cell = document.createElement('div');
            cell.className = 'cell border-bottom'; 
            cell.style.gridColumn = col + 1;
            cell.style.gridRow = r + 1;
            cell.innerText = digit;
            cell.style.animation = 'fadeIn 0.5s';
            this.grid.appendChild(cell);
        }

        const remainder = this.currentDividendVal - product;
        this.helperSay(`现在做减法：${this.currentDividendVal} - ${product} = ?`);
        
        setTimeout(() => {
            this.showRemainderStep(remainder, r + 1, alignCol);
        }, 1000);
    },

    showRemainderStep(remainder, r, alignCol) {
        const rStr = remainder.toString();
        for (let i = 0; i < rStr.length; i++) {
            const digit = rStr[rStr.length - 1 - i];
            const col = alignCol - i;
            
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.gridColumn = col + 1;
            cell.style.gridRow = r + 1;
            cell.innerText = digit;
            this.grid.appendChild(cell);
        }

        if (alignCol < this.digits.length + 1) { 
             const nextDigitIndex = alignCol - 1;
             const nextDigitVal = this.digits[nextDigitIndex];
             const nextDigitCol = alignCol + 1;
             
             const arrow = document.createElement('div');
             arrow.innerText = '↓';
             arrow.style.gridColumn = nextDigitCol + 1;
             arrow.style.gridRow = r; 
             arrow.style.fontSize = '10px';
             arrow.style.textAlign = 'center';
             this.grid.appendChild(arrow);

             const cell = document.createElement('div');
             cell.className = 'cell';
             cell.style.gridColumn = nextDigitCol + 1;
             cell.style.gridRow = r + 1;
             cell.innerText = nextDigitVal;
             cell.style.color = 'var(--warning-color)';
             this.grid.appendChild(cell);

             this.currentDividendVal = parseInt(remainder.toString() + nextDigitVal.toString());
             this.helperSay(`落下 ${nextDigitVal}。现在计算 ${this.currentDividendVal} ÷ ${this.divisor}`);
             
             this.currentCalculationRow = r + 1;

             this.highlightInput(0, nextDigitCol);
             this.resetIdleTimer();
             
        } else {
            this.helperSay("计算完成！你太棒了！点击右上角换一题继续挑战！");
            Game.updateScore(100);
            if (this.idleTimer) clearTimeout(this.idleTimer);
        }
    },

    helperSay(text) {
        const bubble = document.getElementById('helper-bubble');
        bubble.innerText = text;
        bubble.style.animation = 'none';
        bubble.offsetHeight; 
        bubble.style.animation = 'pulse 0.5s';
        
        Game.speak(text);
    }
};

// Start Game
window.onload = () => Game.init();
