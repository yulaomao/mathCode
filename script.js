/**
 * 星际数学探险 - 核心逻辑
 */

const Game = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    currentModule: 'warmup',
    sessionStartedAt: null,
    summaryUnlocked: false,
    moduleEnteredAt: null,
    lessonAnalytics: null,
    aiSummary: null,
    aiModuleSupport: null,
    aiTutor: null,
    aiHealth: null,
    aiRequestInFlight: false,
    aiModuleRequestInFlight: false,
    aiTutorRequestInFlight: false,
    activeDockTab: 'analytics',
    audioCtx: null,
    synthesis: window.speechSynthesis || null,
    voice: null,
    speechRecognition: null,
    speechRecognitionSupported: false,
    speechRecognitionListening: false,
    isLandscape: false,
    teacherMode: true,
    paused: false,
    audioEnabled: true,
    voiceEnabled: true,
    pageVisible: true,
    completedModules: {
        warmup: false,
        visual: false,
        estimation: false,
        division: false
    },
    moduleMeta: {
        warmup: {
            title: '口算热身',
            description: '通过限时找商唤醒旧知，快速进入除法思维。',
            goal: '唤醒已有经验，快速判断商。',
            teacherTip: '教师建议：让学生先口头说出“先看除数和被除数的大致关系”，再开始限时挑战。'
        },
        visual: {
            title: '算理探究',
            description: '借助“平均分配”动画理解几个十除以几个十的意义。',
            goal: '理解除法算理，建立“平均分”的直观模型。',
            teacherTip: '教师建议：暂停在分配完成时，让学生用“每人分到几个十”解释为什么商是几。'
        },
        estimation: {
            title: '估算试商',
            description: '通过推力滑块验证商的大小是否合理，理解余数与除数的关系。',
            goal: '学会试商，判断商偏大还是偏小。',
            teacherTip: '教师建议：让学生先预测商的大致范围，再操作滑块验证。'
        },
        division: {
            title: '竖式巩固',
            description: '在分步提示中完成三位数除以两位数的竖式计算。',
            goal: '掌握试商、乘、减、落的完整竖式流程。',
            teacherTip: '教师建议：边做边说步骤名称，帮助学生把口头策略迁移到规范竖式。'
        },
        summary: {
            title: '课堂总结',
            description: '从完成进度、关键能力和课堂建议三个方面回顾本节学习。',
            goal: '梳理三位数除以两位数的关键方法，完成课堂总结。',
            teacherTip: '教师建议：引导学生用“估一估、试一试、算一算、验一验”复述整节课的策略链条。'
        }
    },

    createEmptyAnalytics() {
        return {
            sessionId: `lesson-${Date.now()}`,
            totalInteractions: 0,
            moduleTime: {
                warmup: 0,
                visual: 0,
                estimation: 0,
                division: 0,
                summary: 0
            },
            warmup: {
                rounds: 0,
                attempts: 0,
                correct: 0,
                wrong: 0,
                lastDifficulty: '未开始',
                lastRoundScore: 0
            },
            visual: {
                rounds: 0,
                adjustments: 0,
                launches: 0,
                completed: 0
            },
            estimation: {
                rounds: 0,
                attempts: 0,
                correct: 0,
                tooHigh: 0,
                tooLow: 0
            },
            division: {
                rounds: 0,
                prompts: 0,
                entries: 0,
                correct: 0,
                wrong: 0
            },
            ai: {
                requests: 0,
                source: '未生成',
                generatedAt: '',
                lastSkill: 'none'
            }
        };
    },

    createEmptyAiSummary() {
        return {
            status: 'idle',
            source: '待生成',
            studentSummary: '完成课堂活动后可生成智能总结。',
            teacherAdvice: '建议先完成至少两个核心环节，再生成课堂建议。',
            nextStep: '优先推进当前未完成模块。',
            riskPoints: ['当前暂无足够数据，请继续完成课堂互动。']
        };
    },

    createEmptyAiModuleSupport() {
        return {
            status: 'idle',
            source: '待生成',
            headline: 'AI助教已接入当前课堂',
            studentHint: '完成课堂活动后，可获取当前环节的导学提示。',
            nextAction: '优先完成当前互动任务。',
            teacherCue: '教师可结合当前环节组织口头追问。',
            focusPoints: ['继续完成课堂互动，解锁更具体的 AI 建议。']
        };
    },

    createEmptyAiHealth() {
        return {
            mode: 'loading',
            label: '检测中',
            model: '虚拟教师',
            caption: '点击打开虚拟教师'
        };
    },

    createEmptyAiTutor() {
        const welcomeReply = '把你想问的问题直接发给我，我会结合前面的聊天内容连续回答。';
        return {
            status: 'idle',
            source: '待提问',
            lastQuestion: '',
            lastReply: welcomeReply,
            history: [
                {
                    role: 'assistant',
                    text: welcomeReply
                }
            ]
        };
    },

    init() {
        this.sessionStartedAt = Date.now();
        this.lessonAnalytics = this.createEmptyAnalytics();
        this.aiSummary = this.createEmptyAiSummary();
        this.aiModuleSupport = this.createEmptyAiModuleSupport();
        this.aiTutor = this.createEmptyAiTutor();
        this.aiHealth = this.createEmptyAiHealth();
        this.cacheDom();
        this.setupNavigation();
        this.setupDockTabs();
        this.setupReportActions();
        this.setupTeacherControls();
        this.setupAudio();
        this.initTTS();
        this.setupSpeechRecognition();
        this.setupPageState();
        this.applyTeacherMode();
        this.startStarfield();
        this.fetchAiHealth();
        
        // Initialize modules
        WarmupModule.init();
        VisualModule.init();
        EstimationModule.init();
        DivisionModule.init();

        this.resetScoreboard();
        this.renderTutorExchange();

        // Start with warmup
        this.switchModule('warmup');
    },

    cacheDom() {
        this.scoreEl = document.getElementById('score');
        this.streakEl = document.getElementById('streak');
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.moduleGuidanceEl = document.getElementById('module-guidance');
        this.currentStageNameEl = document.getElementById('current-stage-name');
        this.currentStageGoalEl = document.getElementById('current-stage-goal');
        this.topbarStageNameEl = document.getElementById('topbar-stage-name');
        this.completedCountEl = document.getElementById('completed-count');
        this.teacherTipEl = document.getElementById('teacher-tip');
        this.stageAiHeadlineEl = document.getElementById('stage-ai-headline');
        this.stageAiBriefEl = document.getElementById('stage-ai-brief');
        this.progressSteps = document.querySelectorAll('.progress-step');
        this.moduleStatusCards = document.querySelectorAll('.module-status-card');
        this.dockTabs = document.querySelectorAll('.dock-tab');
        this.dockPanels = document.querySelectorAll('.dock-panel');
        this.teacherModeBtn = document.getElementById('toggle-teacher-mode');
        this.pauseBtn = document.getElementById('toggle-pause');
        this.voiceBtn = document.getElementById('toggle-voice');
        this.soundBtn = document.getElementById('toggle-sound');
        this.resetCurrentBtn = document.getElementById('btn-reset-current');
        this.openSummaryBtn = document.getElementById('btn-open-summary');
        this.resetCourseBtn = document.getElementById('btn-reset-course');
        this.summaryReturnBtn = document.getElementById('btn-summary-return');
        this.summaryResetBtn = document.getElementById('btn-summary-reset');
        this.reportStatusTextEl = document.getElementById('report-status-text');
        this.reportLevelEl = document.getElementById('report-level');
        this.reportProgressEl = document.getElementById('report-progress');
        this.reportScoreEl = document.getElementById('report-score');
        this.reportBestStreakEl = document.getElementById('report-best-streak');
        this.summaryOverviewEl = document.getElementById('summary-overview');
        this.summaryProgressRateEl = document.getElementById('summary-progress-rate');
        this.summaryScoreEl = document.getElementById('summary-score');
        this.summaryBestStreakEl = document.getElementById('summary-best-streak');
        this.summaryDurationEl = document.getElementById('summary-duration');
        this.summaryLevelEl = document.getElementById('summary-level');
        this.summaryPointsEl = document.getElementById('summary-points');
        this.summaryExtensionEl = document.getElementById('summary-extension');
        this.analyticsWarmupAccuracyEl = document.getElementById('analytics-warmup-accuracy');
        this.analyticsEstimationAccuracyEl = document.getElementById('analytics-estimation-accuracy');
        this.analyticsDivisionHintsEl = document.getElementById('analytics-division-hints');
        this.analyticsSessionDurationEl = document.getElementById('analytics-session-duration');
        this.aiStatusBadgeEl = document.getElementById('ai-status-badge');
        this.aiStudentSummaryEl = document.getElementById('ai-student-summary');
        this.aiTeacherAdviceEl = document.getElementById('ai-teacher-advice');
        this.aiNextStepEl = document.getElementById('ai-next-step');
        this.aiRiskPointsEl = document.getElementById('ai-risk-points');
        this.generateAiBtn = document.getElementById('btn-generate-ai');
        this.exportReportBtn = document.getElementById('btn-export-report');
        this.summaryAiSourceEl = document.getElementById('summary-ai-source');
        this.summaryAiStudentEl = document.getElementById('summary-ai-student');
        this.summaryAiTeacherEl = document.getElementById('summary-ai-teacher');
        this.summaryAiNextEl = document.getElementById('summary-ai-next');
        this.summaryAiRisksEl = document.getElementById('summary-ai-risks');
        this.aiServiceStateEl = document.getElementById('ai-service-state');
        this.aiServiceModelEl = document.getElementById('ai-service-model');
        this.aiServiceCaptionEl = document.getElementById('ai-service-caption');
        this.aiCommandContextEl = document.getElementById('ai-command-context');
        this.aiModuleHeadlineEl = document.getElementById('ai-module-headline');
        this.aiModuleStudentEl = document.getElementById('ai-module-student');
        this.aiModuleActionEl = document.getElementById('ai-module-action');
        this.aiModuleTeacherEl = document.getElementById('ai-module-teacher');
        this.aiModuleFocusEl = document.getElementById('ai-module-focus');
        this.aiCurrentBtn = document.getElementById('btn-ai-current');
        this.aiTeacherBtn = document.getElementById('btn-ai-teacher');
        this.aiVisionBtn = document.getElementById('btn-ai-vision');
        this.aiSummaryQuickBtn = document.getElementById('btn-ai-summary-quick');
        this.aiReadoutBtn = document.getElementById('btn-ai-readout');
        this.aiImageUrlInput = document.getElementById('ai-image-url');
        this.aiFabBtn = document.getElementById('btn-ai-fab');
        this.aiTeacherInputEl = document.getElementById('ai-teacher-input');
        this.aiTeacherLogEl = document.getElementById('ai-teacher-log');
        this.aiTeacherStatusEl = document.getElementById('ai-teacher-status');
        this.aiDockPanelEl = document.querySelector('.dock-panel[data-dock-panel="ai"]');
        this.insightDockEl = document.querySelector('.insight-dock');
        this.aiSendBtn = document.getElementById('btn-ai-send');
        this.aiVoiceInputBtn = document.getElementById('btn-ai-voice-input');
    },

    initTTS() {
        if (!this.synthesis) {
            this.voiceEnabled = false;
            this.updateControlStates();
            return;
        }
        // Try to get voices. Chrome needs onvoiceschanged
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => this.loadVoices();
        }
        // Also try immediately in case they are already loaded
        this.loadVoices();
    },

    loadVoices() {
        if (!this.synthesis || !this.synthesis.getVoices) return;
        const voices = this.synthesis.getVoices();
        // Try to find a Chinese voice. 
        // Priority: Microsoft Xiaoxiao (Natural), Microsoft Yaoyao, Google, System Default
        this.voice = voices.find(v => v.lang === 'zh-CN' && v.name.includes('Xiaoxiao')) ||
                     voices.find(v => v.lang === 'zh-CN' && v.name.includes('Yaoyao')) ||
                     voices.find(v => v.lang === 'zh-CN' && v.name.includes('Google')) ||
                     voices.find(v => v.lang === 'zh-CN');
    },

    speak(text) {
        if (!this.synthesis || !this.voiceEnabled || !text || this.isInteractionPaused()) return;
        
        // Cancel previous speech to avoid queue buildup
        try {
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            if (this.voice) utterance.voice = this.voice;
            utterance.pitch = 1.0;
            utterance.rate = 1.5;
            utterance.volume = 1;

            this.synthesis.speak(utterance);
        } catch (error) {
            console.warn('语音播报不可用:', error);
        }
    },

    stopSpeaking() {
        if (!this.synthesis) return;
        try {
            this.synthesis.cancel();
        } catch (error) {
            console.warn('停止语音失败:', error);
        }
    },

    setupNavigation() {
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moduleName = e.currentTarget.dataset.module;
                if (!moduleName) return;
                this.switchModule(moduleName);
            });
        });
    },

    setupDockTabs() {
        this.setDockTab(this.activeDockTab);
        this.dockTabs.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.dockTab;
                if (!tabName) return;
                this.setDockTab(tabName);
            });
        });
    },

    setDockTab(tabName) {
        this.activeDockTab = tabName;
        document.body.classList.toggle('dock-ai-active', tabName === 'ai');

        this.dockTabs.forEach(button => {
            const isActive = button.dataset.dockTab === tabName;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        this.dockPanels.forEach(panel => {
            panel.classList.toggle('is-active', panel.dataset.dockPanel === tabName);
        });

        if (tabName === 'ai') {
            this.scrollTutorPanelToTop();
            this.scrollTutorConversationToBottom();
        }
    },

    scrollTutorPanelToTop() {
        const panel = this.aiDockPanelEl;
        const dock = this.insightDockEl;
        if (!panel && !dock) return;
        requestAnimationFrame(() => {
            if (dock) dock.scrollTop = 0;
            if (panel) panel.scrollTop = 0;
        });
    },

    scrollTutorConversationToBottom() {
        const log = this.aiTeacherLogEl;
        if (!log) return;
        requestAnimationFrame(() => {
            log.scrollTop = log.scrollHeight;
        });
    },

    setupReportActions() {
        this.summaryReturnBtn?.addEventListener('click', () => {
            this.setDockTab('analytics');
            this.switchModule(this.getRecommendedModule());
        });
        this.summaryResetBtn?.addEventListener('click', () => {
            this.setDockTab('analytics');
            this.resetCourse();
        });
        this.exportReportBtn?.addEventListener('click', () => this.exportLessonRecord());
        this.aiFabBtn?.addEventListener('click', () => {
            this.setDockTab('ai');
        });
        this.aiSendBtn?.addEventListener('click', () => {
            this.setDockTab('ai');
            this.askVirtualTeacher();
        });
        this.aiTeacherInputEl?.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                this.setDockTab('ai');
                this.askVirtualTeacher();
            }
        });
        this.aiVoiceInputBtn?.addEventListener('click', () => {
            this.setDockTab('ai');
            this.toggleVoiceInput();
        });
        this.aiReadoutBtn?.addEventListener('click', () => {
            this.setDockTab('ai');
            this.readLatestTutorReply();
        });
    },

    setupSpeechRecognition() {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            this.speechRecognitionSupported = false;
            this.setTutorStatus('当前浏览器不支持语音输入，请直接输入文字。');
            if (this.aiVoiceInputBtn) {
                this.aiVoiceInputBtn.disabled = true;
            }
            return;
        }

        this.speechRecognitionSupported = true;
        this.speechRecognition = new Recognition();
        this.speechRecognition.lang = 'zh-CN';
        this.speechRecognition.interimResults = false;
        this.speechRecognition.continuous = false;

        this.speechRecognition.onstart = () => {
            this.speechRecognitionListening = true;
            if (this.aiVoiceInputBtn) this.aiVoiceInputBtn.textContent = '停止转写';
            this.setTutorStatus('正在听，请直接说出学生的思路或问题。');
        };

        this.speechRecognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0]?.transcript || '')
                .join('')
                .trim();
            if (transcript && this.aiTeacherInputEl) {
                this.aiTeacherInputEl.value = this.aiTeacherInputEl.value
                    ? `${this.aiTeacherInputEl.value}\n${transcript}`
                    : transcript;
            }
            this.setTutorStatus('语音已转成文字并填入输入框，可以直接发送或继续修改。');
        };

        this.speechRecognition.onerror = () => {
            this.setTutorStatus('语音输入失败，请改用文字输入。');
        };

        this.speechRecognition.onend = () => {
            this.speechRecognitionListening = false;
            if (this.aiVoiceInputBtn) this.aiVoiceInputBtn.textContent = '语音转文字';
        };
    },

    toggleVoiceInput() {
        if (!this.speechRecognitionSupported || !this.speechRecognition) return;
        if (this.speechRecognitionListening) {
            this.speechRecognition.stop();
            return;
        }
        this.speechRecognition.start();
    },

    setupTeacherControls() {
        this.teacherModeBtn.addEventListener('click', () => {
            this.teacherMode = !this.teacherMode;
            this.applyTeacherMode();
            this.renderDashboard();
        });

        this.pauseBtn.addEventListener('click', () => {
            this.setPaused(!this.paused);
        });

        this.voiceBtn.addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled;
            if (!this.voiceEnabled) this.stopSpeaking();
            this.updateControlStates();
        });

        this.soundBtn.addEventListener('click', () => {
            this.audioEnabled = !this.audioEnabled;
            this.updateControlStates();
        });

        this.resetCurrentBtn.addEventListener('click', () => {
            this.resetCurrentModule();
        });

        this.updateControlStates();
    },

    setupPageState() {
        document.addEventListener('visibilitychange', () => {
            this.pageVisible = !document.hidden;
            if (!this.pageVisible) {
                VisualModule.stopLaunch();
                this.stopSpeaking();
                this.flushModuleDuration();
            }
            this.updateControlStates();
        });

        window.addEventListener('beforeunload', () => {
            this.flushModuleDuration();
            this.saveLessonRecord();
        });
    },

    applyTeacherMode() {
        document.body.classList.toggle('teacher-mode', this.teacherMode);

        document.querySelectorAll('.teacher-only').forEach(element => {
            element.style.display = this.teacherMode ? '' : 'none';
        });

        this.aiModuleSupport = this.createRuleBasedModuleSupport(this.teacherMode ? 'teacher' : 'student');
        this.renderModuleAiSupport();

        this.updateControlStates();
    },

    updateControlStates() {
        this.updateToggleButton(this.teacherModeBtn, this.teacherMode, '教师视图', '学生视图');
        this.updateToggleButton(this.voiceBtn, this.voiceEnabled, '语音开启', '语音关闭');
        this.updateToggleButton(this.soundBtn, this.audioEnabled, '音效开启', '音效关闭');

        const pauseLabel = this.paused ? '继续讲解' : '暂停讲解';
        this.pauseBtn.textContent = pauseLabel;
        this.pauseBtn.classList.toggle('is-paused', this.paused);
        this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
    },

    updateToggleButton(button, enabled, enabledText, disabledText) {
        button.textContent = enabled ? enabledText : disabledText;
        button.classList.toggle('is-on', enabled);
        button.classList.toggle('is-off', !enabled);
        button.setAttribute('aria-pressed', String(enabled));
    },

    isInteractionPaused() {
        return this.paused || !this.pageVisible;
    },

    setPaused(shouldPause) {
        this.paused = shouldPause;
        document.body.classList.toggle('is-paused', shouldPause);

        if (shouldPause) {
            VisualModule.stopLaunch();
            this.stopSpeaking();
            this.setTeacherTip('教师建议：当前已暂停讲解，可结合画面进行板书或口头追问。');
        } else {
            this.resumeAudioContext();
            this.renderDashboard();
        }

        this.updateControlStates();
    },

    switchModule(moduleName) {
        const nextModule = document.getElementById(`module-${moduleName}`);
        if (!nextModule) return;

        this.flushModuleDuration();

        // Hide all modules
        document.querySelectorAll('.game-module').forEach(el => el.classList.remove('active'));
        
        // Show selected
        nextModule.classList.add('active');
        this.currentModule = moduleName;
        this.moduleEnteredAt = Date.now();
        this.updateNavigationState(moduleName);

        // Stop/Start specific module loops
        WarmupModule.stop();
        VisualModule.stopLaunch();
        if (moduleName === 'warmup') WarmupModule.start();
        if (moduleName === 'visual') VisualModule.newGame();
        
        if (moduleName === 'division') DivisionModule.newGame();
        if (moduleName === 'estimation') EstimationModule.newGame();

        this.renderDashboard();
        this.aiModuleSupport = this.createRuleBasedModuleSupport(this.teacherMode ? 'teacher' : 'student');
        this.renderModuleAiSupport();
    },

    renderDashboard() {
        const meta = this.moduleMeta[this.currentModule];
        if (!meta) return;

        if (this.moduleGuidanceEl) this.moduleGuidanceEl.innerText = meta.description;
        if (this.currentStageNameEl) this.currentStageNameEl.innerText = meta.title;
        if (this.currentStageGoalEl) this.currentStageGoalEl.innerText = meta.goal;
        if (this.topbarStageNameEl) this.topbarStageNameEl.innerText = meta.title;
        this.setTeacherTip(meta.teacherTip);

        const completedCount = this.getCompletedCount();
        this.completedCountEl.innerText = `${completedCount} / 4`;

        this.progressSteps.forEach(step => {
            const moduleName = step.dataset.progressModule;
            step.classList.toggle('current', moduleName === this.currentModule);
            step.classList.toggle('completed', this.completedModules[moduleName]);
        });

        this.navButtons.forEach(button => {
            const moduleName = button.dataset.module;
            const completed = moduleName === 'summary'
                ? this.summaryUnlocked
                : Boolean(this.completedModules[moduleName]);
            button.classList.toggle('is-completed', completed);
        });

        this.updateReportView();
        this.updateTutorContext();
    },

    setTeacherTip(text) {
        if (!this.teacherTipEl) return;
        if (this.paused) {
            this.teacherTipEl.innerText = '教师建议：当前已暂停讲解，可结合画面进行板书或口头追问。';
            return;
        }
        this.teacherTipEl.innerText = text;
    },

    markModuleCompleted(moduleName) {
        this.completedModules[moduleName] = true;
        this.renderDashboard();

        if (this.getCompletedCount() === Object.keys(this.completedModules).length && !this.summaryUnlocked) {
            this.summaryUnlocked = true;
            this.switchModule('summary');
            this.speak('全部学习环节已完成，下面进入课堂总结。');
        }
    },

    resetCurrentModule() {
        if (this.currentModule === 'summary') {
            this.switchModule(this.getRecommendedModule());
            return;
        }

        this.completedModules[this.currentModule] = false;
        if (this.currentModule === 'warmup') WarmupModule.start();
        if (this.currentModule === 'visual') VisualModule.newGame();
        if (this.currentModule === 'estimation') EstimationModule.newGame();
        if (this.currentModule === 'division') DivisionModule.newGame();
        this.renderDashboard();
    },

    resetScoreboard() {
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.syncScoreboard();
    },

    syncScoreboard() {
        this.scoreEl.innerText = this.score;
        this.streakEl.innerText = this.streak;
        this.updateReportView();
    },

    updateScore(points) {
        this.score += points;
        if (points > 0) {
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            this.playSound('correct');
        } else if (points < 0) {
            this.streak = 0;
            this.playSound('wrong');
        }
        this.syncScoreboard();
    },

    updateNavigationState(moduleName) {
        this.navButtons.forEach(button => {
            const isActive = button.dataset.module === moduleName;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    },

    getCompletedCount() {
        return Object.values(this.completedModules).filter(Boolean).length;
    },

    getCompletionRate() {
        return Math.round((this.getCompletedCount() / Object.keys(this.completedModules).length) * 100);
    },

    getReportLevel() {
        const rate = this.getCompletionRate();
        if (rate >= 100) return '任务达成';
        if (rate >= 75) return '总结阶段';
        if (rate >= 50) return '推进中';
        return '启航中';
    },

    getRecommendedModule() {
        return Object.keys(this.completedModules).find(moduleName => !this.completedModules[moduleName]) || 'warmup';
    },

    formatDuration() {
        if (!this.sessionStartedAt) return '00:00';
        const elapsed = Math.max(0, Math.floor((Date.now() - this.sessionStartedAt) / 1000));
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    },

    getSummaryPoints() {
        const completedCount = this.getCompletedCount();
        if (completedCount === 4) {
            return [
                '学生已走完整个“口算热身-算理探究-估算试商-竖式巩固”的学习链条。',
                '建议课堂总结时让学生用“估一估、试一试、算一算、验一验”完整复述方法。',
                '可立即布置一题迁移练习，检验是否能独立完成三位数除以两位数。'
            ];
        }

        if (completedCount >= 2) {
            return [
                '学生已完成核心探究任务，适合组织阶段性回顾。',
                '重点追问“为什么商不能偏大”和“余数为什么要比除数小”。',
                '建议继续完成剩余模块后，再组织完整课堂总结。'
            ];
        }

        return [
            '当前仍处于学习推进阶段，建议先完成更多核心模块。',
            '教师可借助左侧状态卡判断下一步优先推进的环节。',
            '完成口算和算理探究后，再引导学生做口头总结更自然。'
        ];
    },

    updateReportView() {
        const completedCount = this.getCompletedCount();
        const progressRate = this.getCompletionRate();
        const level = this.getReportLevel();

        if (this.reportStatusTextEl) {
            this.reportStatusTextEl.innerText = `已完成 ${completedCount} / 4 个核心环节，${completedCount === 4 ? '可以进入课堂总结与成果展示。' : '建议继续按模块推进。'}`;
        }
        if (this.reportLevelEl) this.reportLevelEl.innerText = level;
        if (this.reportProgressEl) this.reportProgressEl.innerText = `${progressRate}%`;
        if (this.reportScoreEl) this.reportScoreEl.innerText = this.score;
        if (this.reportBestStreakEl) this.reportBestStreakEl.innerText = this.bestStreak;

        Object.entries(this.completedModules).forEach(([moduleName, completed]) => {
            const card = document.querySelector(`[data-module-card="${moduleName}"]`);
            const statusEl = document.getElementById(`module-status-${moduleName}`);
            const noteEl = document.getElementById(`module-status-note-${moduleName}`);
            const summaryStatusEl = document.getElementById(`summary-module-${moduleName}`);
            const meta = this.moduleMeta[moduleName];

            if (card) {
                card.classList.toggle('is-current', moduleName === this.currentModule);
                card.classList.toggle('is-completed', completed);
            }

            if (statusEl) statusEl.innerText = completed ? '已完成' : (moduleName === this.currentModule ? '进行中' : '待完成');
            if (summaryStatusEl) summaryStatusEl.innerText = completed ? '已完成' : '待完成';
            if (noteEl && meta) {
                noteEl.innerText = completed
                    ? `已完成，可用于课堂复盘：${meta.goal}`
                    : (moduleName === this.currentModule ? `当前推进：${meta.goal}` : meta.description);
            }
        });

        if (this.summaryOverviewEl) {
            this.summaryOverviewEl.innerText = progressRate === 100
                ? '四个核心学习环节均已完成，可以据此进行课堂展示、学习汇报与课后延伸。'
                : `当前已完成 ${completedCount} / 4 个核心环节，建议完成剩余模块后再进行完整课堂总结。`;
        }
        if (this.summaryProgressRateEl) this.summaryProgressRateEl.innerText = `${progressRate}%`;
        if (this.summaryScoreEl) this.summaryScoreEl.innerText = this.score;
        if (this.summaryBestStreakEl) this.summaryBestStreakEl.innerText = this.bestStreak;
        if (this.summaryDurationEl) this.summaryDurationEl.innerText = this.formatDuration();
        if (this.summaryLevelEl) this.summaryLevelEl.innerText = level;

        if (this.summaryPointsEl) {
            const points = this.getSummaryPoints();
            this.summaryPointsEl.innerHTML = points.map(point => `<p>${point}</p>`).join('');
        }

        if (this.summaryExtensionEl) {
            this.summaryExtensionEl.innerText = completedCount === 4
                ? '建议课后补充一题不同除数的变式练习，让学生独立完成估商和竖式检验。'
                : '建议先补足未完成模块，再设计同类型迁移题，巩固估商与竖式的衔接。';
        }

        const warmupAccuracy = this.formatAccuracy(this.lessonAnalytics.warmup.correct, this.lessonAnalytics.warmup.attempts);
        const estimationAccuracy = this.formatAccuracy(this.lessonAnalytics.estimation.correct, this.lessonAnalytics.estimation.attempts);

        if (this.analyticsWarmupAccuracyEl) this.analyticsWarmupAccuracyEl.innerText = warmupAccuracy;
        if (this.analyticsEstimationAccuracyEl) this.analyticsEstimationAccuracyEl.innerText = estimationAccuracy;
        if (this.analyticsDivisionHintsEl) this.analyticsDivisionHintsEl.innerText = `${this.lessonAnalytics.division.prompts} 次`;
        if (this.analyticsSessionDurationEl) this.analyticsSessionDurationEl.innerText = this.formatDuration();

        this.renderAiInsights();
    },

    resetCourse() {
        this.summaryUnlocked = false;
        this.sessionStartedAt = Date.now();
        this.moduleEnteredAt = Date.now();
        this.lessonAnalytics = this.createEmptyAnalytics();
        this.aiSummary = this.createEmptyAiSummary();
        this.aiModuleSupport = this.createRuleBasedModuleSupport(this.teacherMode ? 'teacher' : 'student');
        this.aiTutor = this.createEmptyAiTutor();
        this.aiRequestInFlight = false;
        this.aiModuleRequestInFlight = false;
        this.aiTutorRequestInFlight = false;
        this.setDockTab('analytics');
        this.setPaused(false);
        Object.keys(this.completedModules).forEach(moduleName => {
            this.completedModules[moduleName] = false;
        });
        WarmupModule.stop();
        VisualModule.stopLaunch();
        this.resetScoreboard();
        if (this.aiTeacherInputEl) this.aiTeacherInputEl.value = '';
        this.renderTutorExchange();
        this.switchModule('warmup');
        this.saveLessonRecord();
    },

    flushModuleDuration() {
        if (!this.moduleEnteredAt || !this.lessonAnalytics) return;
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.moduleEnteredAt) / 1000));
        if (this.lessonAnalytics.moduleTime[this.currentModule] !== undefined) {
            this.lessonAnalytics.moduleTime[this.currentModule] += elapsedSeconds;
        }
        this.moduleEnteredAt = Date.now();
    },

    saveLessonRecord() {
        if (!window.localStorage || !this.lessonAnalytics) return;

        const snapshot = this.buildLessonSnapshot();
        window.localStorage.setItem('mathCode.currentLesson', JSON.stringify(snapshot));

        const rawHistory = window.localStorage.getItem('mathCode.lessonHistory');
        const history = rawHistory ? JSON.parse(rawHistory) : [];
        const nextHistory = history.filter(item => item.sessionId !== snapshot.sessionId);
        nextHistory.unshift(snapshot);
        window.localStorage.setItem('mathCode.lessonHistory', JSON.stringify(nextHistory.slice(0, 8)));
    },

    buildLessonSnapshot() {
        this.flushModuleDuration();
        return {
            sessionId: this.lessonAnalytics.sessionId,
            exportedAt: new Date().toISOString(),
            score: this.score,
            streak: this.streak,
            bestStreak: this.bestStreak,
            currentModule: this.currentModule,
            currentQuestion: this.getCurrentQuestionContext().question,
            completionRate: this.getCompletionRate(),
            completedModules: {...this.completedModules},
            duration: this.formatDuration(),
            analytics: JSON.parse(JSON.stringify(this.lessonAnalytics)),
            aiSummary: {...this.aiSummary}
        };
    },

    exportLessonRecord() {
        const snapshot = this.buildLessonSnapshot();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type: 'application/json;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lesson-report-${snapshot.sessionId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.saveLessonRecord();
    },

    formatAccuracy(correct, attempts) {
        if (!attempts) return '暂无';
        return `${Math.round((correct / attempts) * 100)}%`;
    },

    normalizeAiSummary(payload, fallbackSource = '豆包大模型') {
        const riskPoints = Array.isArray(payload?.riskPoints) && payload.riskPoints.length
            ? payload.riskPoints.filter(Boolean).slice(0, 4)
            : this.getRiskPointsFromAnalytics();

        return {
            status: payload?.status || 'ready',
            source: payload?.source || fallbackSource,
            studentSummary: payload?.studentSummary || '本节课已生成课堂总结。',
            teacherAdvice: payload?.teacherAdvice || '建议结合课堂数据进行针对性讲评。',
            nextStep: payload?.nextStep || this.getRecommendedModule(),
            riskPoints
        };
    },

    getRiskPointsFromAnalytics() {
        const points = [];
        const warmup = this.lessonAnalytics.warmup;
        const estimation = this.lessonAnalytics.estimation;
        const division = this.lessonAnalytics.division;

        if (warmup.attempts > 0 && warmup.correct < warmup.wrong) {
            points.push('口算热身中对商的快速判断还不够稳定，可先做口头估商。');
        }
        if (estimation.tooHigh > estimation.tooLow && estimation.attempts > 0) {
            points.push('估算试商中“商偏大”的情况更明显，需要强化“乘回去比较”意识。');
        }
        if (division.prompts >= 2) {
            points.push('竖式练习对步骤提示依赖较强，建议继续强化“试商、乘、减、落”口令。');
        }
        if (this.getCompletedCount() < 2) {
            points.push('课堂仍处于推进阶段，建议先完成更多模块再进行整合总结。');
        }

        if (!points.length) {
            points.push('当前课堂节奏较平稳，可适时加入一题变式练习检验迁移能力。');
        }

        return points.slice(0, 4);
    },

    createRuleBasedAiSummary() {
        const completedCount = this.getCompletedCount();
        const risks = this.getRiskPointsFromAnalytics();
        const warmupAccuracy = this.formatAccuracy(this.lessonAnalytics.warmup.correct, this.lessonAnalytics.warmup.attempts);
        const estimationAccuracy = this.formatAccuracy(this.lessonAnalytics.estimation.correct, this.lessonAnalytics.estimation.attempts);
        const nextModule = this.getRecommendedModule();
        const nextTitle = this.moduleMeta[nextModule]?.title || '口算热身';

        return {
            status: 'fallback',
            source: '本地规则建议',
            studentSummary: `本节课已完成 ${completedCount} / 4 个核心环节，口算正确率 ${warmupAccuracy}，估算试商表现 ${estimationAccuracy}。`,
            teacherAdvice: completedCount >= 3
                ? '建议用一题完整竖式让学生口述“估一估、试一试、算一算、验一验”的策略链条。'
                : '建议继续推进未完成模块，并根据错误较多的环节做短暂停顿讲评。',
            nextStep: `下一步推荐进入“${nextTitle}”，围绕当前课堂薄弱点继续练习。`,
            riskPoints: risks
        };
    },

    createRuleBasedModuleSupport(audience = 'student') {
        const moduleName = this.currentModule;
        const warmupAccuracy = this.formatAccuracy(this.lessonAnalytics.warmup.correct, this.lessonAnalytics.warmup.attempts);
        const estimationAccuracy = this.formatAccuracy(this.lessonAnalytics.estimation.correct, this.lessonAnalytics.estimation.attempts);
        const divisionAccuracy = this.formatAccuracy(this.lessonAnalytics.division.correct, this.lessonAnalytics.division.entries);
        const baseMap = {
            warmup: {
                headline: '先判断除数和被除数的大致关系',
                studentHint: `当前口算正确率 ${warmupAccuracy}。先看“几个十除以几个十”，再判断商可能是几。`,
                nextAction: '点击气泡前，先口头说出商的范围，再做选择。',
                teacherCue: '教师可追问：为什么这个商不是更大或更小？',
                focusPoints: ['关注学生能否先说出商的范围。', '优先让学生比较被除数和除数的大小关系。']
            },
            visual: {
                headline: '把“除法”转成“平均分”的画面',
                studentHint: '先想每个机器人要分到几个十，再按住发射按钮完成平均分。',
                nextAction: '调整“每人分几个”后，观察仓库是否能刚好分完。',
                teacherCue: '教师可在分配完成后追问“每人分到几个十，所以商为什么是几”。',
                focusPoints: ['引导学生说出“每人分到几个十”。', '让学生把动画结果迁移到除法算式。']
            },
            estimation: {
                headline: '先估商，再乘回去比较是否合适',
                studentHint: `当前估算试商表现 ${estimationAccuracy}。先选一个接近的商，再看乘积有没有超过被除数。`,
                nextAction: '如果动力过载，说明商偏大；如果余数还大于等于除数，说明商偏小。',
                teacherCue: '教师可让学生先预测商，再解释“为什么偏大/偏小”。',
                focusPoints: ['关注学生是否会“乘回去比较”。', '强化“余数一定比除数小”的判断。']
            },
            division: {
                headline: '竖式要按“试商、乘、减、落”一步一步来',
                studentHint: `当前竖式表现 ${divisionAccuracy}，提示触发 ${this.lessonAnalytics.division.prompts} 次。先看当前被除数里有几个除数。`,
                nextAction: '输入商以后，马上想“这个商乘除数是多少”，再继续减法与落位。',
                teacherCue: '教师可要求学生边写边说步骤名称，帮助形成稳定策略链条。',
                focusPoints: ['先判断商，再乘回去。', '减法完成后，别忘记把下一位落下来。']
            },
            summary: {
                headline: '把整节课的方法链条说完整',
                studentHint: '试着用“估一估、试一试、算一算、验一验”复述本节课的方法。',
                nextAction: '点击“AI课堂复盘”生成完整总结，再看是否需要补做迁移题。',
                teacherCue: '教师可基于课堂数据，决定是先复盘试商还是先补做竖式巩固。',
                focusPoints: ['结合完成率与错误点组织讲评。', '优先处理“商偏大”和“步骤断裂”两类问题。']
            }
        };

        const current = baseMap[moduleName] || baseMap.warmup;

        return {
            status: 'fallback',
            source: audience === 'teacher' ? '本地规则教师建议' : '本地规则导学',
            headline: current.headline,
            studentHint: current.studentHint,
            nextAction: current.nextAction,
            teacherCue: current.teacherCue,
            focusPoints: current.focusPoints
        };
    },

    normalizeModuleSupport(payload, fallbackSource = '豆包大模型') {
        const focusPoints = Array.isArray(payload?.focusPoints) && payload.focusPoints.length
            ? payload.focusPoints.filter(Boolean).slice(0, 4)
            : this.createRuleBasedModuleSupport().focusPoints;

        return {
            status: payload?.status || 'ready',
            source: payload?.source || fallbackSource,
            headline: payload?.headline || 'AI助教已生成当前环节建议。',
            studentHint: payload?.studentHint || '可结合当前环节继续完成课堂任务。',
            nextAction: payload?.nextAction || '优先完成当前互动任务。',
            teacherCue: payload?.teacherCue || '教师可根据当前环节组织补充追问。',
            focusPoints
        };
    },

    async fetchAiHealth() {
        try {
            const response = await fetch('/api/health');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const health = await response.json();
            this.aiHealth = {
                mode: health.mode === 'ark' ? 'connected' : 'fallback',
                label: health.mode === 'ark' ? '豆包在线' : '本地规则',
                model: '虚拟教师',
                caption: health.hasApiKey
                        ? '点击打开虚拟教师'
                        : '未检测到豆包密钥，将使用本地提示回答。'
            };
        } catch (error) {
            this.aiHealth = {
                mode: 'offline',
                label: '服务离线',
                model: '虚拟教师',
                    caption: '点击打开虚拟教师'
            };
        }
        this.renderModuleAiSupport();
    },

        getCurrentQuestionContext() {
            const meta = this.moduleMeta[this.currentModule] || this.moduleMeta.warmup;
            const fallback = {
                question: `${meta.title}：${meta.goal}`,
                note: `当前环节：${meta.title}。${meta.description}`
            };

            if (this.currentModule === 'warmup') {
                const target = WarmupModule.targetQuotient > 0
                    ? WarmupModule.targetQuotient
                    : (document.getElementById('target-num')?.innerText || '?');
                return {
                    question: `当前目标：寻找商是 ${target} 的算式气泡。`,
                    note: '学生需要先判断“几个十除以几个十”，再决定点击哪个气泡。'
                };
            }

            if (this.currentModule === 'visual') {
                return {
                    question: `当前题目：${VisualModule.dividend || '?'} ÷ ${VisualModule.divisor || '?'} = ?`,
                    note: `正在通过平均分理解算理，目前每人分 ${VisualModule.distributeAmount || 1} 个。`
                };
            }

            if (this.currentModule === 'estimation') {
                const currentGuess = document.getElementById('est-slider-val')?.innerText || '5';
                return {
                    question: `当前题目：${EstimationModule.dividend || '?'} ÷ ${EstimationModule.divisor || '?'} = ?`,
                    note: `学生当前把商估成 ${currentGuess}，需要用乘回去和余数判断是否合适。`
                };
            }

            if (this.currentModule === 'division') {
                return {
                    question: `当前题目：${DivisionModule.dividend || '?'} ÷ ${DivisionModule.divisor || '?'} = ?`,
                    note: `当前正在处理“${DivisionModule.currentDividendVal || '?'} 里面有几个 ${DivisionModule.divisor || '?'}”。`
                };
            }

            if (this.currentModule === 'summary') {
                return {
                    question: '当前处于课堂总结页，需要回顾“估一估、试一试、算一算、验一验”的方法链条。',
                    note: '虚拟教师会围绕本节课的方法回顾回答，不再生成额外复盘报告。'
                };
            }

            return fallback;
        },

        updateTutorContext() {},

        setTutorStatus(text) {
            if (this.aiTeacherStatusEl) this.aiTeacherStatusEl.innerText = text;
        },

        buildTutorPageContext() {
            const meta = this.moduleMeta[this.currentModule] || this.moduleMeta.warmup;
            const base = {
                moduleName: this.currentModule,
                moduleTitle: meta.title,
                moduleDescription: meta.description,
                goal: meta.goal,
                currentState: '',
                howToPlay: '',
                controls: ''
            };

            if (this.currentModule === 'warmup') {
                const target = WarmupModule.targetQuotient > 0
                    ? WarmupModule.targetQuotient
                    : (document.getElementById('target-num')?.innerText || '?');
                const timer = document.getElementById('warmup-timer')?.innerText || '60';
                return {
                    ...base,
                    currentState: `当前目标是找到商为 ${target} 的气泡，剩余时间约 ${timer} 秒。`,
                    howToPlay: '先选择难度开始，然后在倒计时内点击商等于目标值的气泡；每连续找对 3 次会刷新目标。',
                    controls: '简单、普通、困难按钮用于开始；画布里的气泡用于作答。'
                };
            }

            if (this.currentModule === 'visual') {
                return {
                    ...base,
                    currentState: `当前题目是 ${VisualModule.dividend || '?'} ÷ ${VisualModule.divisor || '?'}，仓库剩余 ${VisualModule.currentWarehouse || 0}，现在每人分 ${VisualModule.distributeAmount || 1} 个。`,
                    howToPlay: '先看题目，再用加减按钮调整“每人分几个”，按住“发射能量”把能量平均分给每个机器人，直到仓库正好分完。',
                    controls: '加号和减号调整每人分配数量；发射能量执行分配；换一题重新开始。'
                };
            }

            if (this.currentModule === 'estimation') {
                const guess = document.getElementById('est-slider-val')?.innerText || '5';
                return {
                    ...base,
                    currentState: `当前题目是 ${EstimationModule.dividend || '?'} ÷ ${EstimationModule.divisor || '?'}，当前商的猜测是 ${guess}。`,
                    howToPlay: '拖动滑块估计商，观察“除数 × 商”的乘积，再点击“启动引擎”判断商是偏大、偏小还是合适。',
                    controls: '滑块调整商；启动引擎提交判断；寻找新航线换题。'
                };
            }

            if (this.currentModule === 'division') {
                return {
                    ...base,
                    currentState: `当前题目是 ${DivisionModule.dividend || '?'} ÷ ${DivisionModule.divisor || '?'}，当前正在判断 ${DivisionModule.currentDividendVal || '?'} 里面有几个 ${DivisionModule.divisor || '?'}。`,
                    howToPlay: '按竖式步骤依次完成试商、乘、减、落，用下方数字键盘输入答案，再按确认提交。',
                    controls: '数字键盘输入；退格删除；确认提交；换一题重新开始。'
                };
            }

            if (this.currentModule === 'summary') {
                return {
                    ...base,
                    currentState: `当前在课堂总结页，已完成 ${this.getCompletedCount()} / 4 个核心模块。`,
                    howToPlay: '查看学习报告、模块完成状态和课堂总结建议，然后决定返回学习模块还是重新开始整课。',
                    controls: '返回学习模块回到练习；重新开始整课重置全部内容。'
                };
            }

            return base;
        },

        isTutorPageContextQuestion(studentInput) {
            const text = String(studentInput || '').trim();
            return /(当前页面|当前界面|这个页面|这个界面|这页|这一页|这个游戏|当前游戏|这个模块|当前模块|怎么玩|怎么操作|如何玩|游戏规则|按钮|发射能量|滑块|加号|减号|换一题|确认|退格|分配游戏|这一关|这个关卡)/.test(text);
        },

        createTutorPageContextReply(studentInput, pageContext) {
            if (!pageContext || !this.isTutorPageContextQuestion(studentInput)) return '';

            const title = pageContext.moduleTitle || '当前页面';
            const description = pageContext.moduleDescription || '';
            const howToPlay = pageContext.howToPlay || '';
            const controls = pageContext.controls || '';
            const currentState = pageContext.currentState || '';
            const text = String(studentInput || '');

            if (/(怎么玩|怎么操作|如何玩|游戏规则|分配游戏)/.test(text)) {
                return `当前页面是“${title}”。玩法是：${howToPlay}${controls ? ` 操作上：${controls}` : ''}${currentState ? ` 现在这页的状态是：${currentState}` : ''}`;
            }

            if (/(按钮|发射能量|滑块|加号|减号|换一题|确认|退格)/.test(text)) {
                return `当前页面是“${title}”。主要操作有：${controls || howToPlay}${currentState ? ` 现在界面显示的是：${currentState}` : ''}`;
            }

            return `当前页面是“${title}”。${description}${howToPlay ? ` 这一页的玩法是：${howToPlay}` : ''}${currentState ? ` 目前画面内容是：${currentState}` : ''}`;
        },

        renderTutorExchange() {
            if (!this.aiTeacherLogEl) return;

            const history = Array.isArray(this.aiTutor?.history) && this.aiTutor.history.length
                ? this.aiTutor.history
                : [{ role: 'assistant', text: this.aiTutor?.lastReply || '把学生的思路、步骤或困惑直接发给我，我会结合当前题目直接回答。' }];

            const messageNodes = history.map(message => {
                const article = document.createElement('article');
                article.className = `chat-message ${message.role}${message.pending ? ' pending' : ''}`;

                const role = document.createElement('span');
                role.className = 'chat-role';
                role.innerText = message.role === 'user' ? '你' : '豆包虚拟教师';

                const content = document.createElement('p');
                content.innerText = message.text || '';

                article.append(role, content);
                return article;
            });

            this.aiTeacherLogEl.replaceChildren(...messageNodes);
            this.scrollTutorConversationToBottom();
        },

        createLocalTutorReply(studentInput, previousHistory = [], pageContext = null) {
            const pageReply = this.createTutorPageContextReply(studentInput, pageContext);
            if (pageReply) return pageReply;

            const lastAssistantReply = previousHistory.slice().reverse().find(message => message?.role === 'assistant')?.text || '';
            if (lastAssistantReply) {
                return `我接着上一句继续回答。你刚才问“${studentInput}”。如果你是在追问上一步，可以直接指出“哪一步”或“哪个数字”，我会顺着刚才的内容继续解释。`;
            }
            return `你刚才问“${studentInput}”。如果你愿意，可以继续补充背景或直接追问上一句里的某一步，我会按聊天上下文继续回答。`;
        },

        extractTutorDivisionFocus(previousHistory = []) {
            const texts = previousHistory.slice().reverse().map(message => message?.text || '');

            for (const rawText of texts) {
                const text = String(rawText || '');
                let match = text.match(/(\d+)\s*[÷/]\s*(\d+)/);
                if (match) {
                    return {
                        dividend: Number(match[1]),
                        divisor: Number(match[2])
                    };
                }

                match = text.match(/(\d+)\s*乘(?:多少|几).{0,8}?(\d+)/);
                if (match) {
                    return {
                        dividend: Number(match[2]),
                        divisor: Number(match[1])
                    };
                }
            }

            return null;
        },

        extractTutorTrialFactor(studentInput) {
            const text = String(studentInput || '').trim();
            const patterns = [
                /乘\s*(\d+)/,
                /为什么不能是\s*(\d+)/,
                /^(?:那|试|商是)?\s*(\d+)\s*(?:呢|吗)?$/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    return Number(match[1]);
                }
            }

            return null;
        },

        createContinuousTutorFollowUpReply(studentInput, previousHistory = []) {
            if (!previousHistory.length) return '';

            const factor = this.extractTutorTrialFactor(studentInput);
            const focus = this.extractTutorDivisionFocus(previousHistory);
            if (!factor || !focus) return '';

            const product = focus.divisor * factor;
            if (product > focus.dividend) {
                return `如果你是在继续试商，那就是看 ${focus.divisor} 乘 ${factor}。${focus.divisor}×${factor}=${product}，已经超过 ${focus.dividend} 了，所以 ${factor} 偏大，可以再试小一点。`;
            }
            if (product === focus.dividend) {
                return `如果你是在继续试商，那就是看 ${focus.divisor} 乘 ${factor}。${focus.divisor}×${factor}=${product}，正好等于 ${focus.dividend}，说明这一步就试对了。`;
            }

            const remainder = focus.dividend - product;
            if (remainder < focus.divisor) {
                return `如果你是在继续试商，那就是看 ${focus.divisor} 乘 ${factor}。${focus.divisor}×${factor}=${product}，还没有超过 ${focus.dividend}，余下 ${remainder}，而且余数比除数小，这个商就可以继续往下判断。`;
            }

            return `如果你是在继续试商，那就是看 ${focus.divisor} 乘 ${factor}。${focus.divisor}×${factor}=${product}，还没有超过 ${focus.dividend}，但还可以继续试更大的数。`;
        },

        async askVirtualTeacher() {
            const studentInput = this.aiTeacherInputEl?.value.trim();
            if (!studentInput || this.aiTutorRequestInFlight) return;

            const previousHistory = Array.isArray(this.aiTutor?.history)
                ? this.aiTutor.history.filter(message => !message?.pending)
                : [];
            const pageContext = this.buildTutorPageContext();
            const continuousFollowUpReply = this.createContinuousTutorFollowUpReply(studentInput, previousHistory);

            if (continuousFollowUpReply) {
                this.aiTutor = {
                    ...this.aiTutor,
                    status: 'ready',
                    source: '连续追问规则',
                    lastQuestion: studentInput,
                    lastReply: continuousFollowUpReply,
                    history: [
                        ...previousHistory,
                        { role: 'user', text: studentInput },
                        { role: 'assistant', text: continuousFollowUpReply }
                    ]
                };
                this.renderTutorExchange();
                this.setTutorStatus('本次回答来源：连续追问规则');
                if (this.aiTeacherInputEl) this.aiTeacherInputEl.value = '';
                this.saveLessonRecord();
                return;
            }

            const loadingReply = '正在整理回复...';
            const pendingHistory = [
                ...previousHistory,
                { role: 'user', text: studentInput },
                { role: 'assistant', text: loadingReply, pending: true }
            ];

            this.aiTutorRequestInFlight = true;
            this.aiTutor = {
                ...this.aiTutor,
                status: 'loading',
                source: '生成中',
                lastQuestion: studentInput,
                lastReply: loadingReply,
                history: pendingHistory
            };
            this.renderTutorExchange();
            this.setTutorStatus('虚拟教师正在继续回答...');
            if (this.aiTeacherInputEl) this.aiTeacherInputEl.value = '';

            try {
                const response = await fetch('/api/ai/virtual-teacher', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentInput,
                        pageContext,
                        conversationHistory: previousHistory.map(message => ({
                            role: message.role,
                            text: message.text
                        }))
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                const reply = result?.reply || this.createLocalTutorReply(studentInput, previousHistory, pageContext);
                this.aiTutor = {
                    status: result?.status || 'ready',
                    source: result?.source || '豆包大模型',
                    lastQuestion: studentInput,
                    lastReply: reply,
                    history: [
                        ...previousHistory,
                        { role: 'user', text: studentInput },
                        { role: 'assistant', text: reply }
                    ]
                };
                this.renderTutorExchange();
                this.setTutorStatus(`本次回答来源：${this.aiTutor.source}`);
            } catch (error) {
                console.warn('虚拟教师回答失败，回退到本地提示。', error);
                const reply = this.createLocalTutorReply(studentInput, previousHistory, pageContext);
                this.aiTutor = {
                    status: 'fallback',
                    source: '本地提示',
                    lastQuestion: studentInput,
                    lastReply: reply,
                    history: [
                        ...previousHistory,
                        { role: 'user', text: studentInput },
                        { role: 'assistant', text: reply }
                    ]
                };
                this.renderTutorExchange();
                this.setTutorStatus('AI 服务暂不可用，已切换为本地提示。');
            } finally {
                this.aiTutorRequestInFlight = false;
                this.saveLessonRecord();
            }
        },

        readLatestTutorReply() {
            if (!this.aiTutor?.lastReply) return;
            this.speak(this.aiTutor.lastReply);
        },

    async generateModuleSupport(audience = 'student', imageUrl = '') {
        if (this.aiModuleRequestInFlight) return;

        this.aiModuleRequestInFlight = true;
        this.lessonAnalytics.ai.requests += 1;
        this.lessonAnalytics.ai.lastSkill = 'module-support';
        this.aiModuleSupport = {
            ...this.aiModuleSupport,
            status: 'loading',
            source: '生成中',
            headline: `正在分析“${this.moduleMeta[this.currentModule]?.title || '当前环节'}”...`,
            studentHint: imageUrl ? '豆包正在结合图片与课堂数据生成讲解，请稍候。' : '豆包正在整理当前环节的导学提示，请稍候。',
            nextAction: '请稍候，AI正在生成建议。',
            teacherCue: '请稍候，AI正在生成教师建议。',
            focusPoints: ['正在分析当前环节表现，请稍候。']
        };
        this.renderModuleAiSupport();

        try {
            const response = await fetch('/api/ai/module-support', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    snapshot: this.buildLessonSnapshot(),
                    moduleName: this.currentModule,
                    audience,
                    imageUrl: imageUrl || undefined
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            this.aiModuleSupport = this.normalizeModuleSupport(result?.support || result?.result || result, result?.source || '豆包大模型');
        } catch (error) {
            console.warn('模块 AI 建议生成失败，回退到本地规则导学。', error);
            this.aiModuleSupport = this.createRuleBasedModuleSupport(audience);
        } finally {
            this.lessonAnalytics.ai.source = this.aiModuleSupport.source;
            this.lessonAnalytics.ai.generatedAt = new Date().toISOString();
            this.aiModuleRequestInFlight = false;
            this.renderModuleAiSupport();
            this.saveLessonRecord();
        }
    },

    renderModuleAiSupport() {
        const meta = this.moduleMeta[this.currentModule] || this.moduleMeta.warmup;
        const support = this.aiModuleSupport || this.createEmptyAiModuleSupport();
        const health = this.aiHealth || this.createEmptyAiHealth();
        if (this.aiServiceStateEl) {
            this.aiServiceStateEl.innerText = health.label;
            this.aiServiceStateEl.dataset.state = health.mode;
        }
        if (this.aiServiceModelEl) this.aiServiceModelEl.innerText = health.model;
        if (this.aiServiceCaptionEl) this.aiServiceCaptionEl.innerText = health.caption;
        if (this.stageAiHeadlineEl) this.stageAiHeadlineEl.innerText = support.headline;
        if (this.stageAiBriefEl) this.stageAiBriefEl.innerText = support.studentHint;
        if (this.aiModuleHeadlineEl) this.aiModuleHeadlineEl.innerText = support.headline;
        if (this.aiModuleStudentEl) this.aiModuleStudentEl.innerText = support.studentHint;
        if (this.aiModuleActionEl) this.aiModuleActionEl.innerText = support.nextAction;
        if (this.aiModuleTeacherEl) this.aiModuleTeacherEl.innerText = support.teacherCue;

        if (this.aiModuleFocusEl) {
            this.aiModuleFocusEl.innerHTML = '';
            support.focusPoints.forEach(point => {
                const item = document.createElement('li');
                item.innerText = point;
                this.aiModuleFocusEl.appendChild(item);
            });
        }
    },

    readCurrentAiSupport() {
        if (!this.aiModuleSupport) return;
        const textParts = [
            this.aiModuleSupport.headline,
            this.aiModuleSupport.studentHint,
            this.aiModuleSupport.nextAction
        ];
        if (this.teacherMode) {
            textParts.push(this.aiModuleSupport.teacherCue);
        }
        this.speak(textParts.filter(Boolean).join('。'));
    },

    async generateAiInsights() {
        if (this.aiRequestInFlight) return;

        this.aiRequestInFlight = true;
        this.lessonAnalytics.ai.requests += 1;
        this.lessonAnalytics.ai.lastSkill = 'class-summary';
        this.aiSummary = {
            ...this.aiSummary,
            status: 'loading',
            source: '生成中',
            studentSummary: '正在生成课堂智能分析，请稍候。'
        };
        this.renderAiInsights();

        const payload = this.buildLessonSnapshot();

        try {
            const response = await fetch('/api/ai/class-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            this.aiSummary = this.normalizeAiSummary(result?.summary || result?.result || result, result?.source || '豆包大模型');
        } catch (error) {
            console.warn('AI课堂分析生成失败，回退到本地规则建议。', error);
            this.aiSummary = this.createRuleBasedAiSummary();
        } finally {
            this.lessonAnalytics.ai.source = this.aiSummary.source;
            this.lessonAnalytics.ai.generatedAt = new Date().toISOString();
            this.aiRequestInFlight = false;
            this.renderAiInsights();
            this.saveLessonRecord();
        }
    },

    renderAiInsights() {
        if (!this.aiSummary) return;

        const statusMap = {
            idle: '未生成',
            loading: '生成中',
            ready: 'AI已生成',
            fallback: '本地建议'
        };

        const statusText = statusMap[this.aiSummary.status] || this.aiSummary.source;
        if (this.aiStatusBadgeEl) {
            this.aiStatusBadgeEl.innerText = statusText;
            this.aiStatusBadgeEl.dataset.state = this.aiSummary.status;
        }
        if (this.aiStudentSummaryEl) this.aiStudentSummaryEl.innerText = this.aiSummary.studentSummary;
        if (this.aiTeacherAdviceEl) this.aiTeacherAdviceEl.innerText = this.aiSummary.teacherAdvice;
        if (this.aiNextStepEl) this.aiNextStepEl.innerText = this.aiSummary.nextStep;
        if (this.summaryAiSourceEl) this.summaryAiSourceEl.innerText = this.aiSummary.source;
        if (this.summaryAiStudentEl) this.summaryAiStudentEl.innerText = this.aiSummary.studentSummary;
        if (this.summaryAiTeacherEl) this.summaryAiTeacherEl.innerText = this.aiSummary.teacherAdvice;
        if (this.summaryAiNextEl) this.summaryAiNextEl.innerText = this.aiSummary.nextStep;

        [this.aiRiskPointsEl, this.summaryAiRisksEl].forEach(listEl => {
            if (!listEl) return;
            listEl.innerHTML = '';
            this.aiSummary.riskPoints.forEach(point => {
                const item = document.createElement('li');
                item.innerText = point;
                listEl.appendChild(item);
            });
        });
    },

    recordWarmupRound(difficultySpeed) {
        const difficultyMap = {
            1: '简单',
            2: '普通',
            3.5: '困难'
        };
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.warmup.rounds += 1;
        this.lessonAnalytics.warmup.lastDifficulty = difficultyMap[difficultySpeed] || `${difficultySpeed}`;
        this.updateReportView();
    },

    recordWarmupAttempt(isCorrect) {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.warmup.attempts += 1;
        if (isCorrect) {
            this.lessonAnalytics.warmup.correct += 1;
        } else {
            this.lessonAnalytics.warmup.wrong += 1;
        }
        this.updateReportView();
    },

    recordWarmupRoundResult(roundScore) {
        this.lessonAnalytics.warmup.lastRoundScore = roundScore;
        this.saveLessonRecord();
        this.updateReportView();
    },

    recordVisualRound() {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.visual.rounds += 1;
        this.updateReportView();
    },

    recordVisualAdjustment() {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.visual.adjustments += 1;
        this.updateReportView();
    },

    recordVisualLaunch() {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.visual.launches += 1;
        this.updateReportView();
    },

    recordVisualCompleted() {
        this.lessonAnalytics.visual.completed += 1;
        this.saveLessonRecord();
        this.updateReportView();
    },

    recordEstimationRound() {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.estimation.rounds += 1;
        this.updateReportView();
    },

    recordEstimationAttempt(result) {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.estimation.attempts += 1;
        if (result === 'correct') this.lessonAnalytics.estimation.correct += 1;
        if (result === 'tooHigh') this.lessonAnalytics.estimation.tooHigh += 1;
        if (result === 'tooLow') this.lessonAnalytics.estimation.tooLow += 1;
        this.updateReportView();
    },

    recordDivisionRound() {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.division.rounds += 1;
        this.updateReportView();
    },

    recordDivisionPrompt() {
        this.lessonAnalytics.division.prompts += 1;
        this.updateReportView();
    },

    recordDivisionEntry(isCorrect) {
        this.lessonAnalytics.totalInteractions += 1;
        this.lessonAnalytics.division.entries += 1;
        if (isCorrect) {
            this.lessonAnalytics.division.correct += 1;
        } else {
            this.lessonAnalytics.division.wrong += 1;
        }
        this.updateReportView();
    },

    setupAudio() {
        const AudioConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioConstructor) {
            this.audioEnabled = false;
            this.updateControlStates();
            return;
        }

        const unlockAudio = () => {
            if (!this.audioCtx) {
                try {
                    this.audioCtx = new AudioConstructor();
                } catch (error) {
                    console.warn('音频上下文初始化失败:', error);
                    return;
                }
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(error => {
                    console.warn('音频恢复失败:', error);
                });
            }
        };

        this.resumeAudioContext = unlockAudio;
        ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
            window.addEventListener(eventName, unlockAudio, { passive: true });
        });
    },

    playSound(type) {
        if (!this.audioEnabled) return;
        this.resumeAudioContext?.();
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
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(900, this.audioCtx.currentTime + 0.12);
            osc.frequency.linearRampToValueAtTime(1200, this.audioCtx.currentTime + 0.24);
            gainNode.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.45);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.45);
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
                if (!this.isInteractionPaused()) star.y += star.speed;
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
    roundScore: 0,

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
        if (this.timerInterval) clearInterval(this.timerInterval);
        
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
        this.roundScore = 0;
        this.lastSpawn = 0;

        document.getElementById('warmup-menu').style.display = 'none';
        this.updateTimerDisplay();
        this.updateProgressDots();
        Game.recordWarmupRound(difficultySpeed);
        
        this.setNewTarget();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (Game.isInteractionPaused()) return;
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
        document.getElementById('final-score').innerText = this.roundScore;
        Game.playSound('success'); 
        Game.speak(`时间到！你本轮得分是 ${this.roundScore}`);
        Game.recordWarmupRoundResult(this.roundScore);
        Game.markModuleCompleted('warmup');
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

        if (Game.isInteractionPaused()) {
            requestAnimationFrame((t) => this.loop(t));
            return;
        }

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
                    Game.recordWarmupAttempt(true);
                    
                    this.combo++;
                    const comboBonus = this.combo > 1 ? this.combo * 5 : 0;
                    const award = 10 * this.difficultyMultiplier + comboBonus;
                    this.roundScore += award;
                    Game.updateScore(award); 
                    
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
                    this.roundScore -= 5;
                    Game.recordWarmupAttempt(false);
                    Game.updateScore(-5); 
                    this.combo = 0; // Reset combo
                    this.createExplosion(b.x, b.y, '#555');
                    this.bubbles.splice(i, 1);
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
        Game.recordVisualRound();
        
        this.renderStage();
    },

    adjustAmount(delta) {
        let newVal = this.distributeAmount + delta;
        if (newVal < 1) newVal = 1;
        if (newVal > 9) newVal = 9;
        this.distributeAmount = newVal;
        document.getElementById('distribute-amount').innerText = this.distributeAmount;
        Game.recordVisualAdjustment();
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
        if (this.isLaunching || Game.isInteractionPaused()) return;
        this.isLaunching = true;
        this.launchLoop();
    },

    stopLaunch() {
        this.isLaunching = false;
        clearTimeout(this.launchTimer);
    },

    launchLoop() {
        if (!this.isLaunching) return;
        if (Game.isInteractionPaused()) return;
        
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
        Game.recordVisualLaunch();
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
            Game.recordVisualCompleted();
            Game.updateScore(50);
            this.stopLaunch();
            Game.markModuleCompleted('visual');
        }
    },

    showFeedback(text, type) {
        const el = document.getElementById('visual-feedback');
        el.innerText = text;
        el.className = 'feedback-text ' + (type === 'neutral' ? '' : type);
        el.style.color = type === 'correct' ? 'var(--success-color)' : (type === 'wrong' ? 'var(--accent-color)' : '#fff');
        if(type === 'wrong') Game.playSound('wrong');
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
        Game.recordEstimationRound();
        
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
        if (Game.isInteractionPaused()) return;

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
            Game.recordEstimationAttempt('tooHigh');
            
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
                Game.recordEstimationAttempt('tooLow');
                
                const text = `警告！动力不足！余数 ${remainder} >= 除数 ${this.divisor}`;
                feedback.innerText = text;
                feedback.style.color = "var(--warning-color)";
                Game.playSound('wrong');
                Game.speak(`警告！动力不足！余数 ${remainder} 大于等于 除数 ${this.divisor}`);
            } else {
                // Correct - Land
                ship.style.left = 'calc(90% - 60px)'; // Near planet
                Game.recordEstimationAttempt('correct');
                
                const text = `轨道同步成功！商是 ${val}，余数 ${remainder}`;
                feedback.innerText = text;
                feedback.style.color = "var(--success-color)";
                Game.updateScore(50);
                Game.speak(text);
                Game.markModuleCompleted('estimation');
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
            Game.recordDivisionPrompt();
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
        } while (this.dividend > 999 || this.dividend < 100);

        this.digits = this.dividend.toString().split('').map(Number);
        
        this.renderGridInitial();
        this.startStep1();
        this.resetIdleTimer();
                Game.recordDivisionRound();
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
        
        // Removed to prevent overlap with startStep1 speech
        
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
        this.helperSay(`我们要计算 ${this.dividend} 除以 ${this.divisor}。看 ${this.currentDividendVal}里面有几个 ${this.divisor}？`);
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
        if (Game.isInteractionPaused()) return;
        if (!this.activeInputCell) return;
        this.inputValue = val;
        this.activeInputCell.innerText = val;
    },

    handleBackspace() {
        if (Game.isInteractionPaused()) return;
        if (!this.activeInputCell) return;
        this.inputValue = '';
        this.activeInputCell.innerText = '?';
    },

    handleEnter() {
        if (Game.isInteractionPaused()) return;
        if (!this.activeInputCell || this.inputValue === '') return;
        
        const val = parseInt(this.inputValue);
        const r = parseInt(this.activeInputCell.dataset.r);
        const c = parseInt(this.activeInputCell.dataset.c);

        if (r === 0) {
            const correctQ = Math.floor(this.currentDividendVal / this.divisor);
            if (val === correctQ) {
                Game.recordDivisionEntry(true);
                this.activeInputCell.classList.remove('input-active');
                this.activeInputCell.classList.add('correct');
                Game.playSound('correct');
                this.helperSay(`对了！${val} 乘以 ${this.divisor} 是多少？`);
                
                // Draw dynamic line (simulated by highlighting)
                this.drawConnectionLine();

                const product = val * this.divisor;
                this.showProductStep(product, this.currentCalculationRow, c); 
                
            } else {
                Game.recordDivisionEntry(false);
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
        this.helperSay(`现在做减法：${this.currentDividendVal} 减去 ${product}。`);
        
        setTimeout(() => {
            this.showRemainderStep(remainder, r + 1, alignCol);
        }, 3000); // 增加时间使语音充分播放完
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
             this.helperSay(`落下 ${nextDigitVal}。看 ${this.currentDividendVal} 里面有几个 ${this.divisor}？`);
             
             this.currentCalculationRow = r + 1;

             this.highlightInput(0, nextDigitCol);
             this.resetIdleTimer();
             
        } else {
            this.helperSay("计算完成！你太棒了！点击右上角换一题继续挑战！");
            Game.updateScore(100);
            Game.markModuleCompleted('division');
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
