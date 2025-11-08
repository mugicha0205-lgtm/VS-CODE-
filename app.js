// ========================================
// グローバル変数とデータ構造
// ========================================

let clients = [];
let currentClientId = null;
let currentPage = 'dashboard';
let charts = {
    weight: null,
    bodyFat: null,
    muscleMass: null,
    bmr: null,
    integrated: null
};

let deferredInstallPrompt = null;

// Google API関連
let googleAccessToken = null;
let gapiInited = false;
let gisInited = false;

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // ユーザーが設定する必要があります
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; // ユーザーが設定する必要があります
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest', 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file';

// トレーニング種目リスト（カテゴリー別）
const EXERCISE_CATEGORIES = {
    '胸': [
        'ベンチプレス',
        'インクラインベンチプレス',
        'デクラインベンチプレス',
        'ダンベルプレス',
        'ダンベルフライ',
        'チェストフライ',
        'ケーブルクロスオーバー',
        'ペックデック',
        'ケーブルフライ',
        'ディップス',
        'プッシュアップ'
    ],
    '背中': [
        'デッドリフト',
        'ラットプルダウン',
        'バーベルロウ',
        'ワンハンドダンベルロウ',
        'Tバーロウ',
        'シーテッドロウ',
        'プルアップ',
        'チンアップ',
        'ワイドグリッププルアップ',
        'フェイスプル',
        'バックエクステンション',
        'シュラッグ'
    ],
    '肩': [
        'ショルダープレス',
        'サイドレイズ',
        'フロントレイズ',
        'リアデルトフライ',
        'アップライトロウ'
    ],
    '腕': [
        'ダンベルカール',
        'バイセップスカール',
        'ハンマーカール',
        'プリーチャーカール',
        'トライセップスエクステンション',
        'トライセップスプッシュダウン',
        'バーベルクリーン'
    ],
    '脚': [
        'スクワット',
        'レッグプレス',
        'レッグカール',
        'レッグエクステンション',
        'ブルガリアンスクワット',
        'ランジ',
        'レッグアダクション',
        'レッグアブダクション',
        'カーフレイズ',
        'シーテッドカーフレイズ',
        'グッドモーニング',
        'ヒップスラスト'
    ],
    '体幹': [
        'プランク',
        'サイドプランク',
        'アブドミナルクランチ',
        'レッグレイズ',
        'ケーブルクランチ',
        'バイシクルクランチ',
        'ロシアンツイスト',
        'マウンテンクライマー',
        '腹筋ローラー'
    ],
    '有酸素・全身': [
        'バーピー',
        'ボックスジャンプ',
        'バトルロープ',
        'ケトルベルスイング',
        'ダンベルスナッチ',
        'ランニング',
        'バイク',
        'ローイング'
    ]
};

// カスタム種目を保存する配列
let customExercises = [];

// テンプレートメニュー（顧客ごとに保存）
let menuTemplates = {};

// ========================================
// 初期化
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('アプリケーション起動中...');

    // LocalStorageからデータ読み込み
    loadFromLocalStorage();

    // 既存セッションデータにBMRを追加（マイグレーション）
    migrateSessionsWithBMR();

    // イベントリスナー設定
    setupEventListeners();
    setupPwaInstallPrompt();
    document.addEventListener('sw:updated', () => {
        showNotification('最新バージョンを読み込むため再読み込みします。');
        setTimeout(() => window.location.reload(), 1500);
    });

    // 初期画面描画
    renderDashboard();
    renderClientsGrid();
    updateStats();

    // 通知権限をリクエスト
    requestNotificationPermission();

    console.log('アプリケーション準備完了');
});

// ========================================
// イベントリスナー設定
// ========================================

function setupEventListeners() {
    // サイドバーナビゲーション
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            navigateToPage(page);
        });
    });

    // サイドバートグル（モバイル）
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
    }

    // 新規顧客登録ボタン
    document.getElementById('addClientBtn').addEventListener('click', openAddClientModal);

    // モーダルクローズボタン
    document.getElementById('modalClose').addEventListener('click', closeClientModal);
    document.getElementById('sessionModalClose').addEventListener('click', closeSessionModal);
    document.getElementById('ticketModalClose').addEventListener('click', closeTicketModal);

    // キャンセルボタン
    document.getElementById('cancelBtn').addEventListener('click', closeClientModal);
    document.getElementById('sessionCancelBtn').addEventListener('click', closeSessionModal);
    document.getElementById('ticketCancelBtn').addEventListener('click', closeTicketModal);

    // 下書き保存ボタン
    document.getElementById('saveDraftBtn').addEventListener('click', saveSessionDraft);

    // フォーム送信
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('sessionForm').addEventListener('submit', handleSessionFormSubmit);
    document.getElementById('ticketForm').addEventListener('submit', handleTicketFormSubmit);

    // 削除ボタン
    document.getElementById('deleteBtn').addEventListener('click', deleteClient);

    // モーダルタブ
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchModalTab(tabName);
        });
    });

    // セッション記録ボタン
    document.getElementById('addSessionBtn').addEventListener('click', openSessionModal);

    // グラフエクスポートボタン
    document.getElementById('exportChartBtn').addEventListener('click', exportChartAsImage);

    // チケット購入ボタン
    document.getElementById('addTicketBtn').addEventListener('click', openTicketModal);

    // チケット追加購入ボタン（基本情報タブ内）
    document.getElementById('addMoreTicketsBtn').addEventListener('click', openTicketModal);

    // エクササイズ追加ボタン
    document.getElementById('addExerciseBtn').addEventListener('click', addExerciseEntry);
    document.getElementById('saveTemplateBtn').addEventListener('click', saveMenuTemplate);
    document.getElementById('loadTemplateBtn').addEventListener('click', loadMenuTemplate);

    // レーティングスライダー
    const ratingSlider = document.getElementById('sessionRating');
    if (ratingSlider) {
        ratingSlider.addEventListener('input', function() {
            document.getElementById('ratingValue').textContent = this.value;
        });
    }

    // パーソナルを受ける目的で「その他」選択時の処理
    const trainingPurposeSelect = document.getElementById('trainingPurpose');
    if (trainingPurposeSelect) {
        trainingPurposeSelect.addEventListener('change', function() {
            const otherPurposeGroup = document.getElementById('otherPurposeGroup');
            if (this.value === 'その他') {
                otherPurposeGroup.style.display = 'block';
            } else {
                otherPurposeGroup.style.display = 'none';
                document.getElementById('otherPurpose').value = '';
            }
        });
    }

    // PT経験ラジオボタンの処理
    const ptExperienceRadios = document.querySelectorAll('input[name="ptExperience"]');
    ptExperienceRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const detailsField = document.getElementById('ptExperienceDetails');
            if (this.value === '有') {
                detailsField.style.display = 'block';
            } else {
                detailsField.style.display = 'none';
                detailsField.value = '';
            }
        });
    });

    // 運動歴ラジオボタンの処理
    const exerciseHistoryRadios = document.querySelectorAll('input[name="exerciseHistory"]');
    exerciseHistoryRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const detailsField = document.getElementById('exerciseHistoryDetails');
            if (this.value === '有') {
                detailsField.style.display = 'block';
            } else {
                detailsField.style.display = 'none';
                detailsField.value = '';
            }
        });
    });

    // セッション写真プレビュー
    const sessionPhotos = document.getElementById('sessionPhotos');
    if (sessionPhotos) {
        sessionPhotos.addEventListener('change', function(e) {
            const photoPreview = document.getElementById('photoPreview');
            photoPreview.innerHTML = '';

            const files = e.target.files;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();

                reader.onload = function(event) {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.width = '100%';
                    img.style.height = '100px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '4px';
                    photoPreview.appendChild(img);
                };

                reader.readAsDataURL(file);
            }
        });
    }

    // 検索・フィルター
    document.getElementById('searchInput').addEventListener('input', filterClients);
    document.getElementById('statusFilter').addEventListener('change', filterClients);

    // CSV エクスポート/インポート
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importCsv').click();
    });
    document.getElementById('importCsv').addEventListener('change', importFromCSV);

    // レポート印刷
    document.getElementById('printReportBtn').addEventListener('click', printClientReport);

    // Google認証
    document.getElementById('googleAuthBtn').addEventListener('click', handleGoogleAuth);

    // チケット種類選択で「その他」選択時の処理（新規登録）
    const initialTicketsSelect = document.getElementById('initialTickets');
    if (initialTicketsSelect) {
        initialTicketsSelect.addEventListener('change', function() {
            const customPriceGroup = document.getElementById('customPriceGroup');
            if (this.value === 'custom') {
                customPriceGroup.style.display = 'block';
            } else {
                customPriceGroup.style.display = 'none';
                document.getElementById('customPrice').value = '';
            }
        });
    }

    // チケット種類選択で「その他」選択時の処理（チケット購入モーダル）
    document.querySelectorAll('input[name="ticketType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const customPriceGroupModal = document.getElementById('customPriceGroupModal');
            if (this.value === 'custom') {
                customPriceGroupModal.style.display = 'block';
            } else {
                customPriceGroupModal.style.display = 'none';
                document.getElementById('customPriceModal').value = '';
            }
        });
    });

    // カレンダー同期
    document.getElementById('syncCalendarBtn').addEventListener('click', syncWithGoogleCalendar);

    // バックアップ・復元
    document.getElementById('backupToDrive').addEventListener('click', backupToGoogleDrive);
    document.getElementById('restoreFromDrive').addEventListener('click', restoreFromGoogleDrive);

    // 通知設定
    document.getElementById('notificationToggle').addEventListener('change', toggleNotifications);

    // 目標達成アニメーション閉じるボタン
    document.getElementById('goalAchievedClose').addEventListener('click', () => {
        document.getElementById('goalAchievedOverlay').classList.remove('active');
    });

    // モーダル外クリックで閉じる
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // 折りたたみセクション
    setupCollapsibleSections();
}

// 折りたたみセクションのセットアップ
function setupCollapsibleSections() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const section = this.closest('.collapsible-section');
            section.classList.toggle('collapsed');
        });
    });

    // デフォルトで全て折りたたむ
    document.querySelectorAll('.collapsible-section').forEach(section => {
        section.classList.add('collapsed');
    });
}

function setupPwaInstallPrompt() {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (!installBtn) {
        return;
    }

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installBtn.hidden = false;
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
            return;
        }

        installBtn.disabled = true;
        try {
            const result = await deferredInstallPrompt.prompt();
            if (result && result.outcome === 'accepted') {
                showNotification('アプリのインストールを開始しました。');
            } else {
                showNotification('インストールがキャンセルされました。');
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
            showNotification('インストールを開始できませんでした。');
        } finally {
            installBtn.disabled = false;
            installBtn.hidden = true;
            deferredInstallPrompt = null;
        }
    });

    window.addEventListener('appinstalled', () => {
        installBtn.hidden = true;
        deferredInstallPrompt = null;
        showNotification('アプリがホーム画面に追加されました。');
    });
}

// ========================================
// ページナビゲーション
// ========================================

function navigateToPage(pageName) {
    currentPage = pageName;

    // 全ページを非表示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // ナビゲーションアイテムのアクティブ状態を更新
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });

    // 選択されたページを表示
    const pageElement = document.getElementById(pageName + 'Page');
    if (pageElement) {
        pageElement.classList.add('active');
    }

    // ページごとの処理
    switch(pageName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'clients':
            renderClientsGrid();
            break;
        case 'calendar':
            renderCalendarPage();
            break;
        case 'settings':
            // 設定ページは静的なのでレンダリング不要
            break;
    }

    updateStats();
}

// ========================================
// ダッシュボード
// ========================================

function renderDashboard() {
    renderAlerts();
    renderUpcomingAppointments();
}

// カレンダーページを描画
function renderCalendarPage() {
    renderAllAppointments();
}

// すべての予約を近い順に表示
function renderAllAppointments() {
    const container = document.getElementById('calendarView');
    container.innerHTML = '';

    const now = new Date();
    const appointments = [];

    // すべての顧客の予約を収集
    clients.forEach(client => {
        if (client.nextAppointment) {
            const appointmentDate = new Date(client.nextAppointment);
            appointments.push({
                client: client,
                date: appointmentDate
            });
        }
    });

    // 日時が近い順にソート
    appointments.sort((a, b) => a.date - b.date);

    if (appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>予約はありません</p>
                <small>顧客詳細ページから予約を追加できます</small>
            </div>
        `;
        return;
    }

    // 予約リストを表示
    const appointmentsList = document.createElement('div');
    appointmentsList.className = 'appointments-list';

    appointments.forEach(appt => {
        const apptDiv = document.createElement('div');
        apptDiv.className = 'appointment-card';

        const isPast = appt.date < now;
        const isToday = appt.date.toDateString() === now.toDateString();
        const isTomorrow = appt.date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

        let dateLabel = formatDateTime(appt.date);
        if (isToday) {
            dateLabel = '<span class="date-label today">今日</span> ' + formatTime(appt.date);
        } else if (isTomorrow) {
            dateLabel = '<span class="date-label tomorrow">明日</span> ' + formatTime(appt.date);
        }

        const statusClass = isPast ? 'past' : (isToday ? 'today' : 'upcoming');

        // チケット残数の取得
        const ticketsRemaining = appt.client.tickets ? appt.client.tickets.remaining : 0;
        let ticketBadge = '';
        if (ticketsRemaining === 0) {
            ticketBadge = '<span class="ticket-warning">チケット残0</span>';
        } else if (ticketsRemaining <= 2) {
            ticketBadge = `<span class="ticket-low">残り${ticketsRemaining}回</span>`;
        }

        apptDiv.innerHTML = `
            <div class="appointment-status ${statusClass}"></div>
            <div class="appointment-info">
                <div class="appointment-header">
                    <h3>${appt.client.name}</h3>
                    ${ticketBadge}
                </div>
                <p class="appointment-time">${dateLabel}</p>
                <div class="appointment-details">
                    <span>📞 ${appt.client.phone}</span>
                    ${appt.client.medicalNotes ? '<span class="medical-note">⚠️ 特記事項あり</span>' : ''}
                </div>
            </div>
            <div class="appointment-actions">
                <button class="btn btn-primary btn-small" onclick="openClientDetail('${appt.client.id}')">詳細</button>
            </div>
        `;

        appointmentsList.appendChild(apptDiv);
    });

    container.appendChild(appointmentsList);
}

function renderDashboard() {
    renderAlerts();
    renderUpcomingAppointments();
}

function renderAlerts() {
    const container = document.getElementById('alertsContainer');
    container.innerHTML = '';

    const alerts = [];
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    clients.forEach(client => {
        // チケット残数が少ない顧客
        if (client.tickets && client.tickets.remaining <= 2 && client.tickets.remaining > 0) {
            alerts.push({
                type: 'warning',
                client: client,
                message: `チケット残り${client.tickets.remaining}回`,
                icon: 'warning'
            });
        }

        // 前回セッションから2週間以上経過
        if (client.sessions && client.sessions.length > 0) {
            const lastSession = client.sessions[0];
            const lastSessionDate = new Date(lastSession.date);
            if (lastSessionDate < twoWeeksAgo) {
                alerts.push({
                    type: 'danger',
                    client: client,
                    message: `最終セッションから${Math.floor((now - lastSessionDate) / (24 * 60 * 60 * 1000))}日経過`,
                    icon: 'alert'
                });
            }
        }
    });

    if (alerts.length === 0) {
        container.innerHTML = '<div class="alert-item"><p>現在、フォローアップが必要な顧客はいません。</p></div>';
        return;
    }

    alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-item ${alert.type}`;
        alertDiv.innerHTML = `
            <div>
                <strong>${alert.client.name}</strong>
                <p>${alert.message}</p>
            </div>
            <button class="btn btn-secondary btn-small" onclick="openClientDetail('${alert.client.id}')">詳細</button>
        `;
        alertDiv.style.cursor = 'pointer';
        alertDiv.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn')) {
                openClientDetail(alert.client.id);
            }
        });
        container.appendChild(alertDiv);
    });
}

function renderUpcomingAppointments() {
    const container = document.getElementById('upcomingAppointments');
    container.innerHTML = '';

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(23, 59, 59, 999);

    const appointments = [];

    clients.forEach(client => {
        if (client.nextAppointment) {
            const appointmentDate = new Date(client.nextAppointment);
            if (appointmentDate >= now && appointmentDate <= tomorrow) {
                appointments.push({
                    client: client,
                    date: appointmentDate
                });
            }
        }
    });

    // 日時順にソート
    appointments.sort((a, b) => a.date - b.date);

    if (appointments.length === 0) {
        container.innerHTML = '<div class="appointment-item"><p>今日・明日の予約はありません。</p></div>';
        return;
    }

    appointments.forEach(appt => {
        const apptDiv = document.createElement('div');
        apptDiv.className = 'appointment-item';
        const timeStr = formatDateTime(appt.date);
        apptDiv.innerHTML = `
            <div>
                <strong>${appt.client.name}</strong>
                <p>${timeStr}</p>
            </div>
            <button class="btn btn-primary btn-small" onclick="openClientDetail('${appt.client.id}')">詳細</button>
        `;
        container.appendChild(apptDiv);
    });
}

// ========================================
// 統計情報の更新
// ========================================

function updateStats() {
    const total = clients.length;
    document.getElementById('totalClients').textContent = total;

    // 今月の売上
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyRevenue = 0;
    let monthlySessions = 0;

    clients.forEach(client => {
        if (client.ticketHistory) {
            client.ticketHistory.forEach(purchase => {
                const purchaseDate = new Date(purchase.date);
                if (purchaseDate.getMonth() === currentMonth &&
                    purchaseDate.getFullYear() === currentYear &&
                    purchase.paymentStatus === '支払済み') {
                    monthlyRevenue += purchase.price;
                }
            });
        }

        if (client.sessions) {
            client.sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                if (sessionDate.getMonth() === currentMonth &&
                    sessionDate.getFullYear() === currentYear) {
                    monthlySessions++;
                }
            });
        }
    });

    document.getElementById('monthlyRevenue').textContent = '¥' + monthlyRevenue.toLocaleString();
    document.getElementById('monthlySessions').textContent = monthlySessions;

    // チケット残数が少ない顧客
    const lowTicketClients = clients.filter(c =>
        c.tickets && c.tickets.remaining <= 2 && c.tickets.remaining > 0
    ).length;
    document.getElementById('lowTicketClients').textContent = lowTicketClients;
}

// ========================================
// 顧客一覧グリッド
// ========================================

function renderClientsGrid() {
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '';

    if (clients.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px;">顧客データがありません。新規顧客を登録してください。</p>';
        return;
    }

    clients.forEach(client => {
        const card = createClientCard(client);
        grid.appendChild(card);
    });
}

// 目標達成率を計算
function calculateGoalProgress(client) {
    if (!client.sessions || client.sessions.length === 0) return null;

    const latestSession = client.sessions[0];
    let weightProgress = null;
    let bodyFatProgress = null;

    // 体重目標の達成率
    if (client.goalWeight && client.initialWeight) {
        const totalChange = client.initialWeight - client.goalWeight;
        const currentChange = client.initialWeight - latestSession.weight;
        weightProgress = {
            percentage: Math.min(100, Math.round((currentChange / totalChange) * 100)),
            remaining: Math.max(0, latestSession.weight - client.goalWeight),
            type: 'weight'
        };
    }

    // 体脂肪率目標の達成率
    if (client.goalBodyFat && client.initialBodyFat && latestSession.bodyFat) {
        const totalChange = client.initialBodyFat - client.goalBodyFat;
        const currentChange = client.initialBodyFat - latestSession.bodyFat;
        bodyFatProgress = {
            percentage: Math.min(100, Math.round((currentChange / totalChange) * 100)),
            remaining: Math.max(0, latestSession.bodyFat - client.goalBodyFat),
            type: 'bodyFat'
        };
    }

    return { weightProgress, bodyFatProgress };
}

// 達成率に応じた色クラスを取得
function getProgressColorClass(percentage) {
    if (percentage >= 100) return 'gold';
    if (percentage >= 81) return 'light-green';
    if (percentage >= 61) return 'yellow';
    if (percentage >= 31) return 'orange';
    return 'red';
}

function createClientCard(client) {
    const card = document.createElement('div');
    card.className = 'client-card';

    // ステータス自動判定: チケット1回以上でアクティブ、0回で非アクティブ
    if (client.tickets) {
        if (client.tickets.remaining >= 1 && client.status !== 'アクティブ') {
            client.status = 'アクティブ';
            saveToLocalStorage();
        } else if (client.tickets.remaining === 0 && client.status !== '非アクティブ') {
            client.status = '非アクティブ';
            saveToLocalStorage();
        }
    }

    // ステータスクラス
    let statusClass = 'active';
    if (client.status === '非アクティブ') statusClass = 'inactive';

    // チケット残数バッジ
    let ticketBadgeHTML = '';
    if (client.tickets) {
        let ticketClass = 'high';
        if (client.tickets.remaining === 0) ticketClass = 'low';
        else if (client.tickets.remaining <= 2) ticketClass = 'medium';

        ticketBadgeHTML = `
            <div class="ticket-badge-large ${ticketClass}">
                <div class="ticket-count">${client.tickets.remaining}</div>
                <div class="ticket-label">回分残り</div>
            </div>
        `;
    }

    // 特記事項警告
    let medicalWarningHTML = '';
    if (client.medicalNotes && client.medicalNotes.trim() !== '') {
        medicalWarningHTML = `
            <div class="medical-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                ${client.medicalNotes}
            </div>
        `;
    }

    // 次回予約日の表示（カード用にシンプルに）
    let nextApptHTML = '';
    if (client.nextAppointment) {
        const apptDate = new Date(client.nextAppointment);
        const month = apptDate.getMonth() + 1;
        const day = apptDate.getDate();
        const hours = apptDate.getHours().toString().padStart(2, '0');
        const minutes = apptDate.getMinutes().toString().padStart(2, '0');
        nextApptHTML = `
            <div class="client-card-next-appt">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${month}/${day} ${hours}:${minutes}</span>
            </div>
        `;
    } else {
        nextApptHTML = `
            <div class="client-card-next-appt no-appointment">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>予約なし</span>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="client-card-body">
            <div class="client-card-header">
                <div class="client-name">${client.name}</div>
                <span class="client-status ${statusClass}">${client.status || 'アクティブ'}</span>
            </div>
            ${nextApptHTML}
        </div>
        ${ticketBadgeHTML}
    `;

    card.addEventListener('click', () => {
        openClientDetail(client.id);
    });

    return card;
}

function filterClients() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = clients;

    // 検索フィルタ
    if (searchTerm) {
        filtered = filtered.filter(c =>
            (c.name && c.name.toLowerCase().includes(searchTerm)) ||
            (c.phone && c.phone.includes(searchTerm)) ||
            (c.email && c.email.toLowerCase().includes(searchTerm))
        );
    }

    // ステータスフィルタ
    if (statusFilter !== 'all') {
        filtered = filtered.filter(c => (c.status || 'アクティブ') === statusFilter);
    }

    // グリッドを再描画
    const grid = document.getElementById('clientsGrid');
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px;">該当する顧客が見つかりません。</p>';
        return;
    }

    filtered.forEach(client => {
        const card = createClientCard(client);
        grid.appendChild(card);
    });
}

// ========================================
// 顧客詳細モーダル
// ========================================

function openAddClientModal() {
    currentClientId = null;
    document.getElementById('modalTitle').textContent = '新規顧客登録';
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = generateClientId();
    document.getElementById('deleteBtn').style.display = 'none';

    // 医療アラート非表示
    document.getElementById('medicalAlert').style.display = 'none';

    // 基本情報タブに切り替え
    switchModalTab('info');

    // 新規登録時はセッション履歴・進捗グラフ・チケット管理タブを非表示
    document.querySelectorAll('.modal-tab').forEach(tab => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName === 'sessions' || tabName === 'progress' || tabName === 'tickets') {
            tab.style.display = 'none';
        } else {
            tab.style.display = 'inline-block';
        }
    });

    // モーダルを表示
    document.getElementById('clientModal').classList.add('active');
}

function openClientDetail(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    currentClientId = clientId;
    document.getElementById('modalTitle').textContent = client.name + ' - 顧客情報';
    document.getElementById('deleteBtn').style.display = 'inline-flex';

    // 既存顧客を開く時は全てのタブを表示
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.style.display = 'inline-block';
    });

    // 基本情報を設定
    document.getElementById('clientId').value = client.id;
    document.getElementById('name').value = client.name || '';
    document.getElementById('furigana').value = client.furigana || '';
    document.getElementById('gender').value = client.gender || '男性';
    document.getElementById('birthdate').value = client.birthdate || '';
    document.getElementById('phone').value = client.phone || '';
    document.getElementById('email').value = client.email || '';
    if (document.getElementById('occupation')) document.getElementById('occupation').value = client.occupation || '';
    document.getElementById('goalDate').value = client.goalDate || '';
    document.getElementById('goalWeight').value = client.goalWeight || '';
    document.getElementById('goalBodyFat').value = client.goalBodyFat || '';
    document.getElementById('goal').value = client.goal || '';
    document.getElementById('medicalNotes').value = client.medicalNotes || '';

    // 身長フィールド
    if (document.getElementById('height')) document.getElementById('height').value = client.height || '';

    // PT経験フィールド
    const ptExp = client.ptExperience || '無';
    const ptExpRadio = document.querySelector(`input[name="ptExperience"][value="${ptExp}"]`);
    if (ptExpRadio) ptExpRadio.checked = true;
    const ptExpDetails = document.getElementById('ptExperienceDetails');
    if (ptExpDetails) {
        ptExpDetails.value = client.ptExperienceDetails || '';
        ptExpDetails.style.display = ptExp === '有' ? 'block' : 'none';
    }

    // 運動歴フィールド
    const exHist = client.exerciseHistory || '無';
    const exHistRadio = document.querySelector(`input[name="exerciseHistory"][value="${exHist}"]`);
    if (exHistRadio) exHistRadio.checked = true;
    const exHistDetails = document.getElementById('exerciseHistoryDetails');
    if (exHistDetails) {
        exHistDetails.value = client.exerciseHistoryDetails || '';
        exHistDetails.style.display = exHist === '有' ? 'block' : 'none';
    }

    // トレーニング頻度・開始希望日フィールド
    if (document.getElementById('trainingFrequency')) document.getElementById('trainingFrequency').value = client.trainingFrequency || '';
    if (document.getElementById('ptStartDate')) document.getElementById('ptStartDate').value = client.ptStartDate || '';

    // ボディサイズフィールド
    if (client.bodySizes) {
        if (document.getElementById('initialChest')) document.getElementById('initialChest').value = client.bodySizes.chest || '';
        if (document.getElementById('initialWaist')) document.getElementById('initialWaist').value = client.bodySizes.waist || '';
        if (document.getElementById('initialHip')) document.getElementById('initialHip').value = client.bodySizes.hip || '';
        if (document.getElementById('initialRightArm')) document.getElementById('initialRightArm').value = client.bodySizes.rightArm || '';
        if (document.getElementById('initialLeftArm')) document.getElementById('initialLeftArm').value = client.bodySizes.leftArm || '';
        if (document.getElementById('initialRightThigh')) document.getElementById('initialRightThigh').value = client.bodySizes.rightThigh || '';
        if (document.getElementById('initialLeftThigh')) document.getElementById('initialLeftThigh').value = client.bodySizes.leftThigh || '';
        if (document.getElementById('initialRightCalf')) document.getElementById('initialRightCalf').value = client.bodySizes.rightCalf || '';
        if (document.getElementById('initialLeftCalf')) document.getElementById('initialLeftCalf').value = client.bodySizes.leftCalf || '';
    }

    // 生活習慣フィールド
    if (document.getElementById('sleepHours')) document.getElementById('sleepHours').value = client.sleepHours || '';
    if (document.getElementById('mealFrequency')) document.getElementById('mealFrequency').value = client.mealFrequency || '';
    if (document.getElementById('snackFrequency')) document.getElementById('snackFrequency').value = client.snackFrequency || '';
    if (document.getElementById('alcoholConsumption')) document.getElementById('alcoholConsumption').value = client.alcoholConsumption || '';
    if (document.getElementById('smokingHabit')) document.getElementById('smokingHabit').value = client.smokingHabit || '';

    // 次回予約日時を設定（ISO8601形式に変換）
    if (client.nextAppointment) {
        const apptDate = new Date(client.nextAppointment);
        // datetime-local用にフォーマット (YYYY-MM-DDTHH:mm)
        const year = apptDate.getFullYear();
        const month = String(apptDate.getMonth() + 1).padStart(2, '0');
        const day = String(apptDate.getDate()).padStart(2, '0');
        const hours = String(apptDate.getHours()).padStart(2, '0');
        const minutes = String(apptDate.getMinutes()).padStart(2, '0');
        document.getElementById('clientNextAppointment').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
        document.getElementById('clientNextAppointment').value = '';
    }

    // チケット情報の表示/入力切り替え
    const ticketInfoDisplay = document.getElementById('ticketInfoDisplay');
    const ticketInfoInput = document.getElementById('ticketInfoInput');

    if (client.tickets && client.tickets.remaining !== undefined) {
        // 既存顧客：チケット残数表示 + 追加購入ボタン
        ticketInfoDisplay.style.display = 'block';
        ticketInfoInput.style.display = 'none';
        document.getElementById('currentTicketCount').textContent = client.tickets.remaining;
    } else {
        // チケット情報がない場合：入力欄を表示
        ticketInfoDisplay.style.display = 'none';
        ticketInfoInput.style.display = 'block';
        document.getElementById('initialTickets').value = '';
        document.getElementById('initialTicketPrice').value = '';
    }

    // 特記事項の警告表示
    if (client.medicalNotes && client.medicalNotes.trim() !== '') {
        document.getElementById('medicalAlert').style.display = 'flex';
        document.getElementById('medicalAlertText').textContent = client.medicalNotes;
    } else {
        document.getElementById('medicalAlert').style.display = 'none';
    }

    // セッション履歴を描画
    renderSessionsList(client);

    // グラフを描画
    renderProgressCharts(client);

    // チケット情報を描画
    renderTicketsInfo(client);

    // セッション記録ボタンの状態を更新
    updateSessionButtonState(client);

    // 基本情報タブに切り替え
    switchModalTab('info');

    // モーダルを表示
    document.getElementById('clientModal').classList.add('active');
}

// セッション記録ボタンの状態を更新
function updateSessionButtonState(client) {
    const sessionBtn = document.getElementById('addSessionBtn');

    if (!client.tickets || client.tickets.remaining === 0) {
        sessionBtn.disabled = true;
        sessionBtn.classList.add('btn-disabled');
        sessionBtn.title = 'チケット残数が0です。チケットを購入してください。';
    } else {
        sessionBtn.disabled = false;
        sessionBtn.classList.remove('btn-disabled');
        sessionBtn.title = 'セッション記録';
    }
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('active');
    currentClientId = null;
}

function switchModalTab(tabName) {
    // 全タブの非アクティブ化
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 選択されたタブをアクティブ化
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    // グラフタブの場合、グラフを再描画
    if (tabName === 'progress' && currentClientId) {
        const client = clients.find(c => c.id === currentClientId);
        if (client) {
            setTimeout(() => renderProgressCharts(client), 100);
        }
    }
}

function handleClientFormSubmit(e) {
    e.preventDefault();

    // パーソナルを受ける目的
    const trainingPurposeEl = document.getElementById('trainingPurpose');
    const otherPurposeEl = document.getElementById('otherPurpose');
    const trainingPurpose = trainingPurposeEl?.value || '';
    const otherPurpose = otherPurposeEl?.value || '';
    const finalPurpose = trainingPurpose === 'その他' && otherPurpose ? otherPurpose : trainingPurpose;

    // PT経験
    const ptExperienceRadio = document.querySelector('input[name="ptExperience"]:checked');
    const ptExperience = ptExperienceRadio?.value || '無';
    const ptExperienceDetails = ptExperience === '有' ? document.getElementById('ptExperienceDetails')?.value || '' : '';

    // 運動歴
    const exerciseHistoryRadio = document.querySelector('input[name="exerciseHistory"]:checked');
    const exerciseHistory = exerciseHistoryRadio?.value || '無';
    const exerciseHistoryDetails = exerciseHistory === '有' ? document.getElementById('exerciseHistoryDetails')?.value || '' : '';

    const clientData = {
        id: document.getElementById('clientId').value,
        name: document.getElementById('name').value,
        furigana: document.getElementById('furigana').value,
        gender: document.getElementById('gender').value,
        birthdate: document.getElementById('birthdate').value,
        age: calculateAge(document.getElementById('birthdate').value),
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value || '',
        occupation: document.getElementById('occupation')?.value || '',
        address: document.getElementById('address')?.value || '',
        emergencyContact: document.getElementById('emergencyContact')?.value || '',
        emergencyPhone: document.getElementById('emergencyPhone')?.value || '',
        ptExperience: ptExperience,
        ptExperienceDetails: ptExperienceDetails,
        exerciseHistory: exerciseHistory,
        exerciseHistoryDetails: exerciseHistoryDetails,
        trainingFrequency: document.getElementById('trainingFrequency')?.value || '',
        ptStartDate: document.getElementById('ptStartDate')?.value || '',
        trainingPurpose: finalPurpose || '',
        goalDate: document.getElementById('goalDate').value,
        goalWeight: parseFloat(document.getElementById('goalWeight').value) || null,
        goalBodyFat: parseFloat(document.getElementById('goalBodyFat').value) || null,
        goal: document.getElementById('goal').value,
        height: parseFloat(document.getElementById('height')?.value) || null,
        bodySizes: {
            chest: parseFloat(document.getElementById('initialChest')?.value) || null,
            waist: parseFloat(document.getElementById('initialWaist')?.value) || null,
            hip: parseFloat(document.getElementById('initialHip')?.value) || null,
            rightArm: parseFloat(document.getElementById('initialRightArm')?.value) || null,
            leftArm: parseFloat(document.getElementById('initialLeftArm')?.value) || null,
            rightThigh: parseFloat(document.getElementById('initialRightThigh')?.value) || null,
            leftThigh: parseFloat(document.getElementById('initialLeftThigh')?.value) || null,
            rightCalf: parseFloat(document.getElementById('initialRightCalf')?.value) || null,
            leftCalf: parseFloat(document.getElementById('initialLeftCalf')?.value) || null
        },
        sleepHours: parseFloat(document.getElementById('sleepHours')?.value) || null,
        mealFrequency: parseInt(document.getElementById('mealFrequency')?.value) || null,
        snackFrequency: parseInt(document.getElementById('snackFrequency')?.value) || null,
        alcoholConsumption: document.getElementById('alcoholConsumption')?.value || '',
        smokingHabit: document.getElementById('smokingHabit')?.value || '',
        medicalNotes: document.getElementById('medicalNotes').value,
        nextAppointment: document.getElementById('clientNextAppointment').value || null,
        status: 'アクティブ'
    };

    if (currentClientId) {
        // 更新
        const index = clients.findIndex(c => c.id === currentClientId);
        // 既存のデータを保持
        const existingClient = clients[index];
        clients[index] = {
            ...existingClient,
            ...clientData
        };

        // 既存顧客のチケット情報を更新（入力欄が表示されている場合のみ）
        const ticketInfoInput = document.getElementById('ticketInfoInput');
        if (ticketInfoInput.style.display !== 'none') {
            const initialTicketsValue = document.getElementById('initialTickets').value;

            if (initialTicketsValue) {
                if (!clients[index].tickets) {
                    clients[index].tickets = { remaining: 0, total: 0 };
                }
                if (!clients[index].ticketHistory) {
                    clients[index].ticketHistory = [];
                }

                // チケット種類と料金を取得
                let ticketCount = 0;
                let ticketPrice = 0;
                let ticketTypeName = '';

                if (initialTicketsValue === 'pt-extension') {
                    ticketCount = 1;
                    ticketPrice = 4500;
                    ticketTypeName = 'PT延長';
                } else if (initialTicketsValue === 'fascia-release') {
                    ticketCount = 1;
                    ticketPrice = 4500;
                    ticketTypeName = '筋膜リリース';
                } else if (initialTicketsValue === 'pair-training') {
                    ticketCount = 1;
                    ticketPrice = 15000;
                    ticketTypeName = 'ペアトレ';
                } else if (initialTicketsValue === 'custom') {
                    ticketCount = 1;
                    ticketPrice = parseInt(document.getElementById('customPrice').value) || 0;
                    ticketTypeName = 'カスタム';
                } else {
                    // 通常の回数券（1/4/8回）
                    ticketCount = parseInt(initialTicketsValue);
                    if (ticketCount === 1) {
                        ticketPrice = 9000;
                        ticketTypeName = '1回チケット';
                    } else if (ticketCount === 4) {
                        ticketPrice = 36000;
                        ticketTypeName = '4回チケット';
                    } else if (ticketCount === 8) {
                        ticketPrice = 70000;
                        ticketTypeName = '8回チケット';
                    }
                }

                clients[index].tickets.remaining += ticketCount;
                clients[index].tickets.total += ticketCount;

                clients[index].ticketHistory.push({
                    id: 'ticket_' + Date.now(),
                    date: new Date().toISOString(),
                    type: ticketTypeName,
                    count: ticketCount,
                    price: ticketPrice,
                    paymentMethod: 'その他',
                    paymentStatus: '完了'
                });
            }
        }
    } else {
        // 新規追加
        clientData.sessions = [];
        clientData.ticketHistory = [];

        // 初回チケット情報を取得
        const initialTicketsValue = document.getElementById('initialTickets').value;

        // チケット種類と料金を取得
        let ticketCount = 0;
        let ticketPrice = 0;
        let ticketTypeName = '';

        if (initialTicketsValue === 'pt-extension') {
            ticketCount = 1;
            ticketPrice = 4500;
            ticketTypeName = 'PT延長';
        } else if (initialTicketsValue === 'fascia-release') {
            ticketCount = 1;
            ticketPrice = 4500;
            ticketTypeName = '筋膜リリース';
        } else if (initialTicketsValue === 'pair-training') {
            ticketCount = 1;
            ticketPrice = 15000;
            ticketTypeName = 'ペアトレ';
        } else if (initialTicketsValue === 'custom') {
            ticketCount = 1;
            ticketPrice = parseInt(document.getElementById('customPrice').value) || 0;
            ticketTypeName = 'カスタム';
        } else if (initialTicketsValue) {
            // 通常の回数券（1/4/8回）
            ticketCount = parseInt(initialTicketsValue);
            if (ticketCount === 1) {
                ticketPrice = 9000;
                ticketTypeName = '1回チケット';
            } else if (ticketCount === 4) {
                ticketPrice = 36000;
                ticketTypeName = '4回チケット';
            } else if (ticketCount === 8) {
                ticketPrice = 70000;
                ticketTypeName = '8回チケット';
            }
        }

        clientData.tickets = {
            remaining: ticketCount,
            total: ticketCount
        };

        // チケット履歴に記録
        if (ticketCount > 0) {
            clientData.ticketHistory.push({
                id: 'ticket_' + Date.now(),
                date: new Date().toISOString(),
                type: ticketTypeName,
                count: ticketCount,
                price: ticketPrice,
                paymentMethod: '初回購入',
                paymentStatus: '完了'
            });
        }

        // 初回身体測定データを取得
        const initialWeight = parseFloat(document.getElementById('initialWeight').value);
        const initialBodyFat = parseFloat(document.getElementById('initialBodyFat').value);
        const initialMuscleMass = parseFloat(document.getElementById('initialMuscleMass').value);
        const initialBasalMetabolism = parseFloat(document.getElementById('initialBasalMetabolism').value);

        // 初回測定データがあれば最初のセッションを自動作成
        if (initialWeight || initialBodyFat || initialMuscleMass) {
            const initialSession = {
                id: 'session_' + Date.now(),
                date: new Date().toISOString().split('T')[0],
                weight: initialWeight || null,
                bodyFat: initialBodyFat || null,
                muscleMass: initialMuscleMass || null,
                basalMetabolism: initialBasalMetabolism || null,
                exercises: [],
                rating: 5,
                notes: '初回測定'
            };
            clientData.sessions.push(initialSession);
        }

        clients.push(clientData);
    }

    saveToLocalStorage();
    renderDashboard();
    renderClientsGrid();
    updateStats();
    closeClientModal();

    showNotification('顧客情報を保存しました');
}

function deleteClient() {
    if (!currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) return;

    if (confirm(`${client.name}さんのデータを削除してもよろしいですか？この操作は取り消せません。`)) {
        clients = clients.filter(c => c.id !== currentClientId);
        saveToLocalStorage();
        renderDashboard();
        renderClientsGrid();
        updateStats();
        closeClientModal();
        showNotification('顧客データを削除しました');
    }
}

// ========================================
// セッション記録
// ========================================

function openSessionModal() {
    if (!currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) return;

    // チケット残数チェック
    if (!client.tickets || client.tickets.remaining === 0) {
        showNotification('チケット残数が0です。チケットを購入してください。', 'error');
        // チケット購入モーダルを開く
        openTicketModal();
        return;
    }

    // 編集モードフラグをクリア
    delete window.editingSessionId;

    // モーダルタイトルをリセット
    document.querySelector('#sessionModal h2').textContent = 'セッション記録';

    // フォームリセット
    document.getElementById('sessionForm').reset();
    document.getElementById('sessionRating').value = 5;
    document.getElementById('ratingValue').textContent = '5';

    // 前回のセッションデータを取得して自動入力
    if (client.sessions && client.sessions.length > 0) {
        const lastSession = client.sessions[client.sessions.length - 1];

        // 体重
        if (lastSession.weight) {
            document.getElementById('sessionWeight').value = lastSession.weight;
        }

        // 体脂肪率
        if (lastSession.bodyFat) {
            document.getElementById('sessionBodyFat').value = lastSession.bodyFat;
        }

        // 筋肉量
        if (lastSession.muscleMass) {
            document.getElementById('sessionMuscleMass').value = lastSession.muscleMass;
        }

        // 基礎代謝量
        if (lastSession.bmr || lastSession.basalMetabolism) {
            document.getElementById('sessionBMR').value = lastSession.bmr || lastSession.basalMetabolism;
        }
    }

    // 下書きがあれば読み込む
    const draftKey = `sessionDraft_${currentClientId}`;
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft) {
        try {
            const draft = JSON.parse(savedDraft);
            // フォームに下書きデータを入力
            if (draft.weight) document.getElementById('sessionWeight').value = draft.weight;
            if (draft.bodyFat) document.getElementById('sessionBodyFat').value = draft.bodyFat;
            if (draft.muscleMass) document.getElementById('sessionMuscleMass').value = draft.muscleMass;
            if (draft.bmr) document.getElementById('sessionBMR').value = draft.bmr;
            if (draft.rating) {
                document.getElementById('sessionRating').value = draft.rating;
                document.getElementById('ratingValue').textContent = draft.rating;
            }
            if (draft.notes) document.getElementById('sessionNotes').value = draft.notes;
            if (draft.nextAppointment) document.getElementById('nextAppointment').value = draft.nextAppointment;

            // エクササイズリストを再構築
            document.getElementById('exercisesList').innerHTML = '';
            if (draft.exercises && draft.exercises.length > 0) {
                draft.exercises.forEach(exercise => {
                    const entry = addExerciseEntry();
                    const inputs = entry.querySelectorAll('input, select');
                    inputs[0].value = exercise.name || '';
                    inputs[1].value = exercise.sets || '';
                    inputs[2].value = exercise.reps || '';
                    inputs[3].value = exercise.weight || '';
                });
            } else {
                addExerciseEntry();
            }

            // 下書き通知を表示
            document.getElementById('draftAlert').style.display = 'flex';
        } catch (e) {
            console.error('下書きの読み込みに失敗しました:', e);
            document.getElementById('exercisesList').innerHTML = '';
            addExerciseEntry();
            document.getElementById('draftAlert').style.display = 'none';
        }
    } else {
        // エクササイズリストをクリア
        document.getElementById('exercisesList').innerHTML = '';
        addExerciseEntry(); // 最初のエクササイズを追加
        document.getElementById('draftAlert').style.display = 'none';
    }

    // 特記事項の警告表示
    if (client.medicalNotes && client.medicalNotes.trim() !== '') {
        document.getElementById('sessionMedicalAlert').style.display = 'flex';
        document.getElementById('sessionMedicalAlertText').textContent = client.medicalNotes;
    } else {
        document.getElementById('sessionMedicalAlert').style.display = 'none';
    }

    // モーダルを表示
    document.getElementById('sessionModal').classList.add('active');
}

function closeSessionModal() {
    document.getElementById('sessionModal').classList.remove('active');
}

// セッション下書き保存
function saveSessionDraft() {
    if (!currentClientId) return;

    // エクササイズデータを収集
    const exerciseEntries = document.querySelectorAll('.exercise-entry');
    const exercises = [];
    exerciseEntries.forEach(entry => {
        const inputs = entry.querySelectorAll('input, select');
        const name = inputs[0].value;
        const sets = inputs[1].value;
        const reps = inputs[2].value;
        const weight = inputs[3].value;

        if (name || sets || reps || weight) {
            exercises.push({
                name: name,
                sets: parseInt(sets) || 0,
                reps: parseInt(reps) || 0,
                weight: parseFloat(weight) || 0
            });
        }
    });

    const draftData = {
        weight: parseFloat(document.getElementById('sessionWeight').value) || null,
        bodyFat: parseFloat(document.getElementById('sessionBodyFat').value) || null,
        muscleMass: parseFloat(document.getElementById('sessionMuscleMass').value) || null,
        bmr: parseFloat(document.getElementById('sessionBMR').value) || null,
        rating: parseInt(document.getElementById('sessionRating').value) || 5,
        notes: document.getElementById('sessionNotes').value || '',
        nextAppointment: document.getElementById('nextAppointment').value || null,
        exercises: exercises
    };

    const draftKey = `sessionDraft_${currentClientId}`;
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    showNotification('下書きを保存しました');
    closeSessionModal();
}

function addExerciseEntry() {
    const container = document.getElementById('exercisesList');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'exercise-entry';

    const entryId = 'exercise_' + Date.now();

    // セット数のオプション（1〜10）
    const setsOptions = Array.from({length: 10}, (_, i) => i + 1)
        .map(num => `<option value="${num}">${num}</option>`).join('');

    // レップ数のオプション（1〜30）
    const repsOptions = Array.from({length: 30}, (_, i) => i + 1)
        .map(num => `<option value="${num}">${num}</option>`).join('');

    // 重量のオプション（1〜200kg、0.5kg刻み）
    const weightOptions = ['<option value="">選択</option>'];
    for (let i = 1; i <= 200; i += 0.5) {
        weightOptions.push(`<option value="${i}">${i}kg</option>`);
    }

    // カテゴリー別の種目オプションを生成（カスタム種目含む）
    let exerciseOptions = '<option value="">種目を選択</option>';
    const allExercisesData = getAllExercises();
    for (const [category, exercises] of Object.entries(allExercisesData)) {
        exerciseOptions += `<optgroup label="${category}">`;
        exercises.forEach(ex => {
            exerciseOptions += `<option value="${ex}">${ex}</option>`;
        });
        exerciseOptions += '</optgroup>';
    }

    entryDiv.innerHTML = `
        <button type="button" class="exercise-remove" onclick="removeExerciseEntry('${entryId}')">削除</button>
        <div class="form-group">
            <label>種目</label>
            <select class="exercise-select" onchange="loadPreviousRecord(this, '${entryId}')">
                ${exerciseOptions}
            </select>
            <div class="previous-record" id="prevRecord_${entryId}" style="display: none;"></div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>セット数</label>
                <select class="exercise-sets">
                    <option value="">選択</option>
                    ${setsOptions}
                </select>
            </div>
            <div class="form-group">
                <label>レップ数（回数）</label>
                <select class="exercise-reps">
                    <option value="">選択</option>
                    ${repsOptions}
                </select>
            </div>
            <div class="form-group">
                <label>重量</label>
                <select class="exercise-weight">
                    ${weightOptions.join('')}
                </select>
            </div>
        </div>
    `;

    entryDiv.id = entryId;
    container.appendChild(entryDiv);
}

function removeExerciseEntry(entryId) {
    const entry = document.getElementById(entryId);
    if (entry) {
        entry.remove();
    }
}

// 前回の記録を読み込む
function loadPreviousRecord(selectElement, entryId) {
    const exerciseName = selectElement.value;
    if (!exerciseName || !currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client || !client.sessions || client.sessions.length === 0) return;

    // 最新のセッションから該当する種目を探す
    let previousExercise = null;
    for (let i = 0; i < client.sessions.length; i++) {
        const session = client.sessions[i];
        if (session.exercises) {
            const found = session.exercises.find(ex => ex.name === exerciseName);
            if (found) {
                previousExercise = found;
                break;
            }
        }
    }

    const prevRecordDiv = document.getElementById(`prevRecord_${entryId}`);
    if (previousExercise) {
        prevRecordDiv.style.display = 'block';
        prevRecordDiv.innerHTML = `
            <div class="prev-record-label">前回の記録:</div>
            <div class="prev-record-data">
                ${previousExercise.weight}kg × ${previousExercise.reps}回 × ${previousExercise.sets}セット
            </div>
        `;

        // 前回の値をセレクトボックスに自動設定
        const entry = document.getElementById(entryId);
        entry.querySelector('.exercise-sets').value = previousExercise.sets;
        entry.querySelector('.exercise-reps').value = previousExercise.reps;
        entry.querySelector('.exercise-weight').value = previousExercise.weight;

        // 前回のデータを保存（記録更新判定用）
        entry.dataset.previousWeight = previousExercise.weight;
        entry.dataset.previousReps = previousExercise.reps;
    } else {
        prevRecordDiv.style.display = 'none';
    }
}

// 記録更新をチェック
function checkRecordImprovement(entryId) {
    const entry = document.getElementById(entryId);
    if (!entry.dataset.previousWeight) return false;

    const currentWeight = parseFloat(entry.querySelector('.exercise-weight').value) || 0;
    const currentReps = parseInt(entry.querySelector('.exercise-reps').value) || 0;
    const previousWeight = parseFloat(entry.dataset.previousWeight);
    const previousReps = parseInt(entry.dataset.previousReps);

    // 重量が増えた、または同じ重量でレップ数が増えた場合を記録更新とする
    return currentWeight > previousWeight ||
           (currentWeight === previousWeight && currentReps > previousReps);
}

// テンプレートメニューを保存
function saveMenuTemplate() {
    if (!currentClientId) return;

    const exercises = [];
    document.querySelectorAll('.exercise-entry').forEach(entry => {
        const exercise = {
            name: entry.querySelector('.exercise-select').value,
            sets: parseInt(entry.querySelector('.exercise-sets').value) || 0,
            reps: parseInt(entry.querySelector('.exercise-reps').value) || 0,
            weight: parseFloat(entry.querySelector('.exercise-weight').value) || 0
        };
        if (exercise.name) {
            exercises.push(exercise);
        }
    });

    if (exercises.length === 0) {
        showNotification('保存する種目がありません', 'error');
        return;
    }

    const templateName = prompt('テンプレート名を入力してください:', '通常メニュー');
    if (!templateName) return;

    if (!menuTemplates[currentClientId]) {
        menuTemplates[currentClientId] = [];
    }

    menuTemplates[currentClientId].push({
        name: templateName,
        exercises: exercises,
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('menuTemplates', JSON.stringify(menuTemplates));
    showNotification(`テンプレート「${templateName}」を保存しました`);
}

// テンプレートメニューを読み込み
function loadMenuTemplate() {
    if (!currentClientId) return;

    const templates = menuTemplates[currentClientId];
    if (!templates || templates.length === 0) {
        showNotification('保存されたテンプレートがありません', 'error');
        return;
    }

    // テンプレート選択ダイアログ
    let templateList = 'テンプレートを選択してください:\n\n';
    templates.forEach((tmpl, index) => {
        templateList += `${index + 1}. ${tmpl.name} (${tmpl.exercises.length}種目)\n`;
    });
    templateList += '\n番号を入力してください:';

    const選択 = prompt(templateList);
    if (!選択) return;

    const index = parseInt(選択) - 1;
    if (index < 0 || index >= templates.length) {
        showNotification('無効な番号です', 'error');
        return;
    }

    const template = templates[index];

    // 既存の種目をクリア
    document.getElementById('exercisesList').innerHTML = '';

    // テンプレートから種目を復元
    template.exercises.forEach(ex => {
        addExerciseEntry();
        const entries = document.querySelectorAll('.exercise-entry');
        const lastEntry = entries[entries.length - 1];

        lastEntry.querySelector('.exercise-select').value = ex.name;
        lastEntry.querySelector('.exercise-sets').value = ex.sets;
        lastEntry.querySelector('.exercise-reps').value = ex.reps;
        lastEntry.querySelector('.exercise-weight').value = ex.weight;
    });

    showNotification(`テンプレート「${template.name}」を読み込みました`);
}

// 基礎代謝を計算（LBM使用）
function calculateBasalMetabolism(weight, bodyFat) {
    if (!weight || !bodyFat) return null;

    // 除脂肪体重（LBM）= 体重 - (体重 × 体脂肪率 / 100)
    const lbm = weight - (weight * bodyFat / 100);

    // 基礎代謝 = LBM × 28.5
    const bmr = lbm * 28.5;

    return Math.round(bmr);
}

async function handleSessionFormSubmit(e) {
    e.preventDefault();

    if (!currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) return;

    // エクササイズデータを収集 + 記録更新チェック
    const exercises = [];
    const improvements = [];
    document.querySelectorAll('.exercise-entry').forEach(entry => {
        const exercise = {
            name: entry.querySelector('.exercise-select').value,
            sets: parseInt(entry.querySelector('.exercise-sets').value) || 0,
            reps: parseInt(entry.querySelector('.exercise-reps').value) || 0,
            weight: parseFloat(entry.querySelector('.exercise-weight').value) || 0
        };
        exercises.push(exercise);

        // 記録更新チェック
        if (checkRecordImprovement(entry.id)) {
            improvements.push(exercise.name);
        }
    });

    // 体重・体脂肪率取得
    const weight = parseFloat(document.getElementById('sessionWeight').value);
    const bodyFat = parseFloat(document.getElementById('sessionBodyFat').value) || null;
    const muscleMass = parseFloat(document.getElementById('sessionMuscleMass').value) || null;

    // 基礎代謝量を体組成計で測定した値から取得
    const bmr = parseFloat(document.getElementById('sessionBMR').value) || null;

    // 写真を Base64 に変換
    const photoFiles = document.getElementById('sessionPhotos').files;
    const photoPromises = [];
    for (let i = 0; i < photoFiles.length; i++) {
        const promise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                resolve(event.target.result);
            };
            reader.readAsDataURL(photoFiles[i]);
        });
        photoPromises.push(promise);
    }

    // 写真の読み込みを待つ
    const photos = await Promise.all(photoPromises);

    // セッションデータ
    const sessionData = {
        id: 'session_' + Date.now(),
        date: new Date().toISOString(),
        weight: weight,
        bodyFat: bodyFat,
        muscleMass: muscleMass,
        bmr: bmr,
        basalMetabolism: bmr, // 後方互換性のため
        sleepHours: document.getElementById('sessionSleepHours').value || null,
        exercises: exercises,
        rating: parseInt(document.getElementById('sessionRating').value),
        notes: document.getElementById('sessionNotes').value,
        nextAppointment: document.getElementById('nextAppointment').value || null,
        photos: photos
    };

    // セッション配列がなければ作成
    if (!client.sessions) {
        client.sessions = [];
    }

    // 編集モードかどうかをチェック
    if (window.editingSessionId) {
        // 編集モード：既存セッションを更新
        const sessionIndex = client.sessions.findIndex(s => s.id === window.editingSessionId);
        if (sessionIndex !== -1) {
            // 既存のIDと日付を保持
            sessionData.id = client.sessions[sessionIndex].id;
            sessionData.date = client.sessions[sessionIndex].date;
            client.sessions[sessionIndex] = sessionData;
        }
        // 編集モードフラグをクリア
        delete window.editingSessionId;
    } else {
        // 新規作成モード：セッションを先頭に追加（新しいものが上）
        client.sessions.unshift(sessionData);

        // チケット残数を減らす
        if (client.tickets && client.tickets.remaining > 0) {
            client.tickets.remaining--;
        }
    }

    // 次回予約日を更新
    if (sessionData.nextAppointment) {
        client.nextAppointment = sessionData.nextAppointment;
    }

    // 目標達成チェック
    checkGoalAchievement(client, sessionData);

    // 保存
    saveToLocalStorage();

    // 下書きを削除
    const draftKey = `sessionDraft_${currentClientId}`;
    localStorage.removeItem(draftKey);

    // UI更新
    renderSessionsList(client);
    renderProgressCharts(client);
    updateStats();
    renderDashboard();
    renderClientsGrid();

    closeSessionModal();

    // 記録更新の通知
    if (improvements.length > 0) {
        showNotification(`🎉 記録更新！ ${improvements.join(', ')}`, 'success');
    } else {
        showNotification('セッションを記録しました');
    }

    // Google Calendarに予約を追加
    if (sessionData.nextAppointment && googleAccessToken) {
        addToGoogleCalendar(client, sessionData.nextAppointment);
    }
}

function renderSessionsList(client) {
    const container = document.getElementById('sessionsList');
    container.innerHTML = '';

    if (!client.sessions || client.sessions.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #888;">セッション履歴がありません</p>';
        return;
    }

    client.sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'session-item';

        const exercisesHTML = session.exercises.map(ex => {
            let details = '';
            if (ex.sets) details += `${ex.sets}セット `;
            if (ex.reps) details += `${ex.reps}回 `;
            if (ex.weight) details += `${ex.weight}kg`;
            return `<div class="exercise-item">${ex.name} ${details}</div>`;
        }).join('');

        sessionDiv.innerHTML = `
            <div class="session-header">
                <div class="session-date">${formatDate(new Date(session.date))}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="session-rating">⭐ ${session.rating}/10</div>
                    <button class="btn-small btn-secondary" onclick="editSession('${client.id}', '${session.id}')">編集</button>
                    <button class="btn-small btn-danger" onclick="deleteSession('${client.id}', '${session.id}')">削除</button>
                </div>
            </div>
            <div class="session-body">
                <div class="session-measurements">
                    <div class="measurement-item">
                        <span class="measurement-label">体重</span>
                        <span class="measurement-value-large">${session.weight}<span class="unit">kg</span></span>
                    </div>
                    ${session.bodyFat ? `
                        <div class="measurement-item">
                            <span class="measurement-label">体脂肪率</span>
                            <span class="measurement-value-large">${session.bodyFat}<span class="unit">%</span></span>
                        </div>
                    ` : ''}
                    ${session.muscleMass ? `
                        <div class="measurement-item">
                            <span class="measurement-label">筋肉量</span>
                            <span class="measurement-value-large">${session.muscleMass}<span class="unit">kg</span></span>
                        </div>
                    ` : ''}
                    ${session.bmr || session.basalMetabolism ? `
                        <div class="measurement-item">
                            <span class="measurement-label">基礎代謝量</span>
                            <span class="measurement-value-large">${session.bmr || session.basalMetabolism}<span class="unit">kcal</span></span>
                        </div>
                    ` : ''}
                </div>
                ${session.exercises.length > 0 ? `
                    <div class="session-exercises">
                        <strong>トレーニング種目:</strong>
                        ${exercisesHTML}
                    </div>
                ` : ''}
                ${session.notes ? `<p><strong>メモ:</strong> ${session.notes}</p>` : ''}
                ${session.photos && session.photos.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <strong>写真:</strong>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-top: 8px;">
                            ${session.photos.map(photo => `<img src="${photo}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${photo}')">`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.appendChild(sessionDiv);
    });
}

// セッション編集
function editSession(clientId, sessionId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const session = client.sessions.find(s => s.id === sessionId);
    if (!session) return;

    // セッションフォームに既存データを入力
    document.getElementById('sessionWeight').value = session.weight || '';
    document.getElementById('sessionBodyFat').value = session.bodyFat || '';
    document.getElementById('sessionMuscleMass').value = session.muscleMass || '';
    document.getElementById('sessionBMR').value = session.bmr || session.basalMetabolism || '';
    document.getElementById('sessionRating').value = session.rating || 5;
    document.getElementById('ratingValue').textContent = session.rating || 5;
    document.getElementById('sessionNotes').value = session.notes || '';
    document.getElementById('nextAppointment').value = session.nextAppointment || '';

    // エクササイズリストを再構築
    document.getElementById('exercisesList').innerHTML = '';
    if (session.exercises && session.exercises.length > 0) {
        session.exercises.forEach(exercise => {
            const entry = addExerciseEntry();
            const inputs = entry.querySelectorAll('input, select');
            inputs[0].value = exercise.name || '';
            inputs[1].value = exercise.sets || '';
            inputs[2].value = exercise.reps || '';
            inputs[3].value = exercise.weight || '';
        });
    } else {
        addExerciseEntry();
    }

    // 下書き通知を非表示
    document.getElementById('draftAlert').style.display = 'none';

    // 編集モードフラグを設定
    window.editingSessionId = sessionId;

    // モーダルタイトルを変更
    document.querySelector('#sessionModal h2').textContent = 'セッション記録を編集';

    // モーダルを表示
    document.getElementById('sessionModal').classList.add('active');
}

// セッション削除
function deleteSession(clientId, sessionId) {
    if (!confirm('このセッション記録を削除しますか？')) return;

    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const sessionIndex = client.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return;

    // セッションを削除
    client.sessions.splice(sessionIndex, 1);

    // チケット残数を戻す
    if (client.tickets) {
        client.tickets.remaining++;
    }

    // 保存
    saveToLocalStorage();

    // UI更新
    renderSessionsList(client);
    renderProgressCharts(client);
    updateStats();
    renderDashboard();
    renderClientsGrid();

    showNotification('セッション記録を削除しました');
}

// ========================================
// 進捗グラフ
// ========================================

function renderProgressCharts(client) {
    if (!client.sessions || client.sessions.length === 0) {
        document.getElementById('progressTab').innerHTML = '<p style="text-align: center; padding: 40px; color: #888;">グラフ表示にはセッションデータが必要です</p>';
        return;
    }

    // データを古い順にソート
    const sortedSessions = [...client.sessions].reverse();

    // 目標期日までのデータを抽出
    let sessionsToShow = sortedSessions;
    if (client.goalDate) {
        const goalDate = new Date(client.goalDate);
        sessionsToShow = sortedSessions.filter(s => new Date(s.date) <= goalDate);
    }

    const labels = sessionsToShow.map(s => formatDate(new Date(s.date)));
    const weights = sessionsToShow.map(s => s.weight);
    const bodyFats = sessionsToShow.map(s => s.bodyFat).filter(v => v !== null);
    const muscleMasses = sessionsToShow.map(s => s.muscleMass).filter(v => v !== null);

    // 統合グラフを描画
    renderIntegratedChart(client, sessionsToShow, labels);

    // 体重グラフ
    const weightCtx = document.getElementById('weightChart');
    if (weightCtx) {
        if (charts.weight) charts.weight.destroy();

        const datasets = [{
            label: '体重 (kg)',
            data: weights,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true
        }];

        // 目標体重のライン
        if (client.goalWeight) {
            datasets.push({
                label: '目標体重',
                data: new Array(weights.length).fill(client.goalWeight),
                borderColor: '#d4af37',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }

        charts.weight = new Chart(weightCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: '体重の推移',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    // 体脂肪率グラフ
    const bodyFatCtx = document.getElementById('bodyFatChart');
    if (bodyFatCtx && bodyFats.length > 0) {
        if (charts.bodyFat) charts.bodyFat.destroy();

        const bodyFatLabels = sessionsToShow.filter(s => s.bodyFat !== null).map(s => formatDate(new Date(s.date)));

        const datasets = [{
            label: '体脂肪率 (%)',
            data: bodyFats,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }];

        // 目標体脂肪率のライン
        if (client.goalBodyFat) {
            datasets.push({
                label: '目標体脂肪率',
                data: new Array(bodyFats.length).fill(client.goalBodyFat),
                borderColor: '#d4af37',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        }

        charts.bodyFat = new Chart(bodyFatCtx, {
            type: 'line',
            data: {
                labels: bodyFatLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: '体脂肪率の推移',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    // 筋肉量グラフ
    const muscleMassCtx = document.getElementById('muscleMassChart');
    if (muscleMassCtx && muscleMasses.length > 0) {
        if (charts.muscleMass) charts.muscleMass.destroy();

        const muscleMassLabels = sessionsToShow.filter(s => s.muscleMass !== null).map(s => formatDate(new Date(s.date)));

        charts.muscleMass = new Chart(muscleMassCtx, {
            type: 'line',
            data: {
                labels: muscleMassLabels,
                datasets: [{
                    label: '筋肉量 (kg)',
                    data: muscleMasses,
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: '筋肉量の推移',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    // 基礎代謝量グラフ
    const bmrCtx = document.getElementById('bmrChart');
    const bmrs = sessionsToShow.map(s => s.bmr).filter(v => v !== null && v !== undefined);

    if (bmrCtx && bmrs.length > 0) {
        if (charts.bmr) charts.bmr.destroy();

        const bmrLabels = sessionsToShow.filter(s => s.bmr !== null && s.bmr !== undefined).map(s => formatDate(new Date(s.date)));

        charts.bmr = new Chart(bmrCtx, {
            type: 'line',
            data: {
                labels: bmrLabels,
                datasets: [{
                    label: '基礎代謝量 (kcal)',
                    data: bmrs,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: '基礎代謝量の推移',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }
}

// 統合グラフを描画（4つの指標を1つのグラフに）
function renderIntegratedChart(client, sessionsToShow, labels) {
    const ctx = document.getElementById('integratedChart');
    if (!ctx) return;

    if (charts.integrated) charts.integrated.destroy();

    // データ取得
    const weights = sessionsToShow.map(s => s.weight);
    const bodyFats = sessionsToShow.map(s => s.bodyFat);
    const muscleMasses = sessionsToShow.map(s => s.muscleMass);
    const bmrs = sessionsToShow.map(s => s.bmr);

    const datasets = [
        // 体重
        {
            label: '体重 (kg)',
            data: weights,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y'
        },
        // 体脂肪率
        {
            label: '体脂肪率 (%)',
            data: bodyFats,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1'
        },
        // 筋肉量
        {
            label: '筋肉量 (kg)',
            data: muscleMasses,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y'
        },
        // 基礎代謝量
        {
            label: '基礎代謝量 (kcal)',
            data: bmrs,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1'
        }
    ];

    // 目標値を追加（破線）
    if (client.goalWeight) {
        datasets.push({
            label: '目標体重',
            data: new Array(weights.length).fill(client.goalWeight),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false,
            yAxisID: 'y'
        });
    }

    if (client.goalBodyFat) {
        datasets.push({
            label: '目標体脂肪率',
            data: new Array(bodyFats.length).fill(client.goalBodyFat),
            borderColor: '#3b82f6',
            borderWidth: 2,
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false,
            yAxisID: 'y1'
        });
    }

    charts.integrated = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false // カスタム凡例を使用
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fff',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: '開始時の値',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#1e293b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: '目標値',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#f59e0b'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// グラフを画像としてエクスポート
function exportChartAsImage() {
    const canvas = document.getElementById('integratedChart');
    if (!canvas) {
        showNotification('グラフが見つかりません', 'error');
        return;
    }

    // キャンバスを画像に変換
    canvas.toBlob(function(blob) {
        if (!blob) {
            showNotification('画像の生成に失敗しました', 'error');
            return;
        }

        // ダウンロード用のリンクを作成
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const client = clients.find(c => c.id === currentClientId);
        const clientName = client ? client.name : '顧客';
        const date = new Date().toISOString().split('T')[0];

        link.download = `${clientName}_進捗グラフ_${date}.png`;
        link.href = url;
        link.click();

        // URLを解放
        URL.revokeObjectURL(url);

        showNotification('グラフを画像として保存しました');
    }, 'image/png');
}

// ========================================
// チケット管理
// ========================================

function openTicketModal() {
    if (!currentClientId) return;

    document.getElementById('ticketForm').reset();
    document.querySelector('input[name="ticketType"][value="4"]').checked = true;
    document.getElementById('ticketModal').classList.add('active');
}

function closeTicketModal() {
    document.getElementById('ticketModal').classList.remove('active');
}

function handleTicketFormSubmit(e) {
    e.preventDefault();

    if (!currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) return;

    const selectedTicket = document.querySelector('input[name="ticketType"]:checked');
    const ticketValue = selectedTicket.value;

    // チケット種類と料金を取得
    let ticketCount = 0;
    let ticketPrice = 0;
    let ticketTypeName = '';

    if (ticketValue === 'pt-extension') {
        ticketCount = 1;
        ticketPrice = 4500;
        ticketTypeName = 'PT延長';
    } else if (ticketValue === 'fascia-release') {
        ticketCount = 1;
        ticketPrice = 4500;
        ticketTypeName = '筋膜リリース';
    } else if (ticketValue === 'pair-training') {
        ticketCount = 1;
        ticketPrice = 15000;
        ticketTypeName = 'ペアトレ';
    } else if (ticketValue === 'custom') {
        ticketCount = 1;
        ticketPrice = parseInt(document.getElementById('customPriceModal').value) || 0;
        ticketTypeName = 'カスタム';
    } else {
        // 通常の回数券（1/4/8回）
        ticketCount = parseInt(ticketValue);
        ticketPrice = parseInt(selectedTicket.getAttribute('data-price'));
        if (ticketCount === 1) {
            ticketTypeName = '1回チケット';
        } else if (ticketCount === 4) {
            ticketTypeName = '4回チケット';
        } else if (ticketCount === 8) {
            ticketTypeName = '8回チケット';
        }
    }

    const purchaseData = {
        id: 'purchase_' + Date.now(),
        date: new Date().toISOString(),
        type: ticketTypeName,
        count: ticketCount,
        price: ticketPrice,
        paymentMethod: document.getElementById('ticketPaymentMethod').value,
        paymentStatus: document.getElementById('ticketPaymentStatus').value
    };

    // チケット履歴に追加
    if (!client.ticketHistory) {
        client.ticketHistory = [];
    }
    client.ticketHistory.unshift(purchaseData);

    // チケット残数を更新
    if (!client.tickets) {
        client.tickets = { remaining: 0, total: 0 };
    }
    client.tickets.remaining += ticketCount;
    client.tickets.total += ticketCount;

    // 保存
    saveToLocalStorage();

    // UI更新
    renderTicketsInfo(client);
    updateSessionButtonState(client); // セッション記録ボタンの状態を更新
    updateStats();
    renderDashboard();
    renderClientsGrid();

    closeTicketModal();
    showNotification(`${ticketTypeName}を追加しました`);
}

function renderTicketsInfo(client) {
    // 現在のチケット情報
    const currentTicketsDiv = document.getElementById('currentTickets');
    currentTicketsDiv.innerHTML = '';

    if (!client.tickets) {
        client.tickets = { remaining: 0, total: 0 };
    }

    const ticketCard = document.createElement('div');
    ticketCard.className = 'ticket-info-card';
    ticketCard.innerHTML = `
        <div class="ticket-count">${client.tickets.remaining}</div>
        <div class="ticket-label">残りチケット数</div>
    `;
    currentTicketsDiv.appendChild(ticketCard);

    // チケット購入履歴
    const historyDiv = document.getElementById('ticketHistory');
    historyDiv.innerHTML = '<h3 style="margin-bottom: 16px;">購入履歴</h3>';

    if (!client.ticketHistory || client.ticketHistory.length === 0) {
        historyDiv.innerHTML += '<p style="text-align: center; padding: 20px; color: #888;">購入履歴がありません</p>';
        return;
    }

    client.ticketHistory.forEach(purchase => {
        const historyItem = document.createElement('div');
        historyItem.className = 'ticket-history-item';

        const statusClass = purchase.paymentStatus === '支払済み' ? 'paid' : 'unpaid';
        const statusButtonText = purchase.paymentStatus === '支払済み' ? '未払いに変更' : '支払済みに変更';

        // チケット種類名を表示（新しいデータには type があり、古いデータには count のみ）
        const ticketDisplayName = purchase.type || `${purchase.count}回チケット`;

        historyItem.innerHTML = `
            <div class="ticket-history-info">
                <div>
                    <strong>${ticketDisplayName}</strong>
                    <p>${formatDate(new Date(purchase.date))} - ¥${purchase.price.toLocaleString()}</p>
                    <small>${purchase.paymentMethod}</small>
                </div>
                <div class="ticket-history-actions">
                    <span class="payment-status ${statusClass}">${purchase.paymentStatus}</span>
                    <button class="btn-small" onclick="togglePaymentStatus('${client.id}', '${purchase.id}')">${statusButtonText}</button>
                </div>
            </div>
        `;

        historyDiv.appendChild(historyItem);
    });
}

// 支払いステータスを切り替える
function togglePaymentStatus(clientId, purchaseId) {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.ticketHistory) return;

    const purchase = client.ticketHistory.find(p => p.id === purchaseId);
    if (!purchase) return;

    // ステータスを切り替え
    purchase.paymentStatus = purchase.paymentStatus === '支払済み' ? '未払い' : '支払済み';

    // 保存
    saveToLocalStorage();

    // UI更新
    renderTicketsInfo(client);

    showNotification(`支払いステータスを「${purchase.paymentStatus}」に変更しました`);
}

// ========================================
// 目標達成チェック
// ========================================

function checkGoalAchievement(client, sessionData) {
    let achieved = false;
    let achievementMessage = '';

    // 体重目標
    if (client.goalWeight && sessionData.weight <= client.goalWeight) {
        achieved = true;
        achievementMessage = `目標体重 ${client.goalWeight}kg を達成しました！現在の体重: ${sessionData.weight}kg`;
    }

    // 体脂肪率目標
    if (client.goalBodyFat && sessionData.bodyFat && sessionData.bodyFat <= client.goalBodyFat) {
        achieved = true;
        achievementMessage = `目標体脂肪率 ${client.goalBodyFat}% を達成しました！現在の体脂肪率: ${sessionData.bodyFat}%`;
    }

    if (achieved) {
        showGoalAchievement(client.name, achievementMessage);
    }
}

function showGoalAchievement(clientName, message) {
    const overlay = document.getElementById('goalAchievedOverlay');
    const textElement = document.getElementById('goalAchievedText');

    textElement.textContent = `${clientName}さんが${message}`;
    overlay.classList.add('active');

    // 紙吹雪アニメーション（簡易版）
    createConfetti();
}

function createConfetti() {
    // 簡易的な紙吹雪エフェクト
    const colors = ['#d4af37', '#4a90e2', '#2ecc71', '#f39c12', '#e74c3c'];
    const confettiContainer = document.querySelector('.confetti');

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = Math.random() * 100 + '%';
        confetti.style.opacity = Math.random();
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confettiContainer.appendChild(confetti);

        // アニメーション
        setTimeout(() => {
            confetti.style.transition = 'all 3s ease-out';
            confetti.style.top = '100%';
            confetti.style.opacity = '0';
        }, 100);
    }
}

// ========================================
// カレンダー
// ========================================

function renderCalendar() {
    const calendarView = document.getElementById('calendarView');
    calendarView.innerHTML = '<h3>予約一覧</h3>';

    // 予約のある顧客を収集
    const appointments = [];
    clients.forEach(client => {
        if (client.nextAppointment) {
            appointments.push({
                client: client,
                date: new Date(client.nextAppointment)
            });
        }
    });

    // 日時順にソート
    appointments.sort((a, b) => a.date - b.date);

    if (appointments.length === 0) {
        calendarView.innerHTML += '<p style="text-align: center; padding: 40px; color: #888;">予約がありません</p>';
        return;
    }

    const listDiv = document.createElement('div');
    listDiv.style.display = 'grid';
    listDiv.style.gap = '16px';
    listDiv.style.marginTop = '20px';

    appointments.forEach(appt => {
        const apptDiv = document.createElement('div');
        apptDiv.className = 'appointment-item';
        apptDiv.innerHTML = `
            <div>
                <strong>${appt.client.name}</strong>
                <p>${formatDateTime(appt.date)}</p>
            </div>
            <button class="btn btn-primary btn-small" onclick="openClientDetail('${appt.client.id}')">詳細</button>
        `;
        listDiv.appendChild(apptDiv);
    });

    calendarView.appendChild(listDiv);
}

// ========================================
// Google連携
// ========================================

// Google認証処理
function handleGoogleAuth() {
    if (googleAccessToken) {
        // ログアウト
        googleAccessToken = null;
        localStorage.removeItem('googleAccessToken');
        document.getElementById('googleAuthText').textContent = 'Google連携';
        showNotification('Googleアカウントからログアウトしました');
    } else {
        // ログインフロー開始
        initiateGoogleAuth();
    }
}

// Google OAuth2.0認証フローの初期化
function initiateGoogleAuth() {
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
        showNotification('Google連携を使用するには、Google Cloud Consoleでプロジェクトを設定し、app.js内のGOOGLE_CLIENT_IDとGOOGLE_API_KEYを更新してください。詳細は README.md を参照してください。', 'info');
        return;
    }

    // Google Identity Services を使用した認証
    showNotification('Google認証フローを開始しています...', 'info');
    simulateGoogleAuth();
}

// Google認証のシミュレーション（実装デモ用）
function simulateGoogleAuth() {
    showNotification('【デモモード】Google連携を有効にするには、CLIENT_IDとAPI_KEYの設定が必要です', 'info');

    const demoToken = 'DEMO_TOKEN_' + Date.now();
    googleAccessToken = demoToken;
    localStorage.setItem('googleAccessToken', demoToken);
    document.getElementById('googleAuthText').textContent = 'Google連携解除';
    showNotification('【デモモード】Google連携が有効になりました（実際のAPI接続には設定が必要です）', 'info');
}

// Googleカレンダーと同期
async function syncWithGoogleCalendar() {
    if (!googleAccessToken) {
        showNotification('先にGoogle連携を行ってください', 'error');
        return;
    }

    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
        showNotification('Google Calendar APIを使用するには、CLIENT_IDとAPI_KEYの設定が必要です。詳細はREADME.mdを参照してください。', 'info');
        return;
    }

    showNotification('カレンダーと同期中...', 'info');

    try {
        setTimeout(() => {
            showNotification('【デモモード】カレンダー同期が完了しました（実際のAPI接続には設定が必要です）', 'info');
        }, 1000);
    } catch (error) {
        console.error('Calendar sync error:', error);
        showNotification('カレンダーの同期に失敗しました', 'error');
    }
}

// Googleカレンダーにイベントを追加
async function addToGoogleCalendar(client, appointmentDateTime) {
    if (!googleAccessToken) {
        console.log('Google not authenticated');
        return;
    }

    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
        console.log('Google Calendar API not configured');
        return;
    }

    console.log('Adding to Google Calendar (demo mode):', client.name, appointmentDateTime);
}

function backupToGoogleDrive() {
    if (!googleAccessToken) {
        showNotification('先にGoogle連携を行ってください');
        return;
    }

    const dataToBackup = JSON.stringify(clients, null, 2);
    const blob = new Blob([dataToBackup], { type: 'application/json' });

    showNotification('Google Driveにバックアップ中...');
    // 実際の実装では、Google Drive APIを使用
    // 実装は省略
}

function restoreFromGoogleDrive() {
    if (!googleAccessToken) {
        showNotification('先にGoogle連携を行ってください');
        return;
    }

    showNotification('Google Driveから復元中...');
    // 実際の実装では、Google Drive APIを使用
    // 実装は省略
}

// ========================================
// 通知
// ========================================

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function toggleNotifications(e) {
    const enabled = e.target.checked;
    localStorage.setItem('notificationsEnabled', enabled);

    if (enabled) {
        showNotification('通知が有効になりました');
        scheduleNotifications();
    } else {
        showNotification('通知が無効になりました');
    }
}

function scheduleNotifications() {
    // 予約のリマインダー通知をスケジュール
    // Service Workerと連携して実装
    // 実装は省略
}

function showNotification(message) {
    // 簡易的なトースト通知
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#1a2332';
    toast.style.color = 'white';
    toast.style.padding = '16px 24px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    toast.style.zIndex = '10000';
    toast.style.animation = 'slideInRight 0.4s ease';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.4s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 400);
    }, 3000);
}

// ========================================
// レポート印刷
// ========================================

function printClientReport() {
    if (!currentClientId) return;

    const client = clients.find(c => c.id === currentClientId);
    if (!client) return;

    const printReport = document.getElementById('printReport');

    // 最新と最古のセッションデータ
    let latestSession = null;
    let oldestSession = null;

    if (client.sessions && client.sessions.length > 0) {
        latestSession = client.sessions[0];
        oldestSession = client.sessions[client.sessions.length - 1];
    }

    // 変化量を計算
    let weightChange = '';
    let bodyFatChange = '';

    if (latestSession && oldestSession) {
        const weightDiff = latestSession.weight - oldestSession.weight;
        weightChange = `${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}kg`;

        if (latestSession.bodyFat && oldestSession.bodyFat) {
            const bodyFatDiff = latestSession.bodyFat - oldestSession.bodyFat;
            bodyFatChange = `${bodyFatDiff > 0 ? '+' : ''}${bodyFatDiff.toFixed(1)}%`;
        }
    }

    // レポートHTML生成
    printReport.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; font-family: sans-serif;">
            <h1 style="text-align: center; border-bottom: 3px solid #1a2332; padding-bottom: 10px;">
                トレーニング進捗レポート
            </h1>

            <div style="margin: 30px 0;">
                <h2 style="color: #1a2332;">基本情報</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;"><strong>氏名</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${client.name}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;"><strong>性別</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${client.gender}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;"><strong>電話番号</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${client.phone}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa;"><strong>年齢</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${client.age || '-'}歳</td>
                    </tr>
                </table>
            </div>

            <div style="margin: 30px 0;">
                <h2 style="color: #1a2332;">目標</h2>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <p><strong>目標期日:</strong> ${client.goalDate ? formatDate(new Date(client.goalDate)) : '未設定'}</p>
                    <p><strong>目標体重:</strong> ${client.goalWeight ? client.goalWeight + 'kg' : '未設定'}</p>
                    <p><strong>目標体脂肪率:</strong> ${client.goalBodyFat ? client.goalBodyFat + '%' : '未設定'}</p>
                    <p><strong>目標内容:</strong> ${client.goal || '未設定'}</p>
                </div>
            </div>

            ${client.medicalNotes ? `
                <div style="margin: 30px 0; padding: 15px; background: #fff3e0; border-left: 4px solid #f39c12; border-radius: 8px;">
                    <h3 style="color: #f39c12; margin-top: 0;">⚠️ 特記事項</h3>
                    <p>${client.medicalNotes}</p>
                </div>
            ` : ''}

            <div style="margin: 30px 0;">
                <h2 style="color: #1a2332;">進捗データ</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #1a2332; color: white;">
                        <th style="padding: 12px; border: 1px solid #ddd;">項目</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">開始時</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">現在</th>
                        <th style="padding: 12px; border: 1px solid #ddd;">変化量</th>
                    </tr>
                    ${latestSession && oldestSession ? `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>体重</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${oldestSession.weight}kg</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${latestSession.weight}kg</td>
                            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${weightChange}</td>
                        </tr>
                        ${latestSession.bodyFat && oldestSession.bodyFat ? `
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>体脂肪率</strong></td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${oldestSession.bodyFat}%</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${latestSession.bodyFat}%</td>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${bodyFatChange}</td>
                            </tr>
                        ` : ''}
                    ` : '<tr><td colspan="4" style="padding: 20px; text-align: center;">セッションデータがありません</td></tr>'}
                </table>
            </div>

            <div style="margin: 30px 0;">
                <h2 style="color: #1a2332;">直近のセッション履歴</h2>
                ${client.sessions && client.sessions.length > 0 ? client.sessions.slice(0, 5).map(session => `
                    <div style="padding: 15px; margin-bottom: 10px; background: #f8f9fa; border-radius: 8px;">
                        <p><strong>${formatDate(new Date(session.date))}</strong> - 評価: ⭐${session.rating}/10</p>
                        <p>体重: ${session.weight}kg ${session.bodyFat ? `/ 体脂肪率: ${session.bodyFat}%` : ''}</p>
                        ${session.exercises.length > 0 ? `
                            <p><strong>種目:</strong> ${session.exercises.map(ex => ex.name).join(', ')}</p>
                        ` : ''}
                    </div>
                `).join('') : '<p>セッション履歴がありません</p>'}
            </div>

            <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #888;">
                <p>発行日: ${formatDate(new Date())}</p>
                <p>PT Manager - パーソナルトレーナー顧客管理システム</p>
            </div>
        </div>
    `;

    // DOMの更新を待ってから印刷実行
    setTimeout(() => {
        window.print();
    }, 100);
}

// ========================================
// CSV エクスポート/インポート
// ========================================

function exportToCSV() {
    const headers = ['顧客ID', '氏名', 'ふりがな', '性別', '生年月日', '年齢', '電話番号', 'メールアドレス',
                     '住所', 'ステータス', '目標期日', '目標体重', '目標体脂肪率', '目標内容', '特記事項'];

    const csvContent = [
        headers.join(','),
        ...clients.map(c => [
            c.id, c.name, c.furigana, c.gender, c.birthdate, c.age, c.phone, c.email,
            c.address, c.status, c.goalDate, c.goalWeight, c.goalBodyFat, c.goal, c.medicalNotes
        ].map(field => `"${field || ''}"`).join(','))
    ].join('\n');

    // BOM付きUTF-8でエンコード
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `顧客データ_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('CSVファイルをエクスポートしました');
}

function importFromCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        const newClients = [];

        // ヘッダー行をスキップ
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = parseCSVLine(lines[i]);
            if (values.length < 2) continue;

            newClients.push({
                id: values[0] || generateClientId(),
                name: values[1] || '',
                furigana: values[2] || '',
                gender: values[3] || '男性',
                birthdate: values[4] || '',
                age: values[5] || calculateAge(values[4]),
                phone: values[6] || '',
                email: values[7] || '',
                address: values[8] || '',
                status: values[9] || 'アクティブ',
                goalDate: values[10] || '',
                goalWeight: parseFloat(values[11]) || null,
                goalBodyFat: parseFloat(values[12]) || null,
                goal: values[13] || '',
                medicalNotes: values[14] || '',
                tickets: { remaining: 0, total: 0 },
                sessions: [],
                ticketHistory: []
            });
        }

        if (confirm(`${newClients.length}件のデータをインポートしますか？\n既存のデータは上書きされます。`)) {
            clients = newClients;
            saveToLocalStorage();
            renderDashboard();
            renderClientsGrid();
            updateStats();
            showNotification('インポートが完了しました');
        }
    };

    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// ========================================
// データ管理
// ========================================

function saveToLocalStorage() {
    try {
        localStorage.setItem('ptManagerClients', JSON.stringify(clients));
        console.log('データを保存しました');
    } catch (e) {
        console.error('データ保存エラー:', e);
        showNotification('データの保存に失敗しました');
    }
}

function loadFromLocalStorage() {
    try {
        const data = localStorage.getItem('ptManagerClients');
        if (data) {
            clients = JSON.parse(data);
            console.log(`${clients.length}件の顧客データを読み込みました`);
        } else {
            // サンプルデータをロード
            loadSampleData();
        }

        // テンプレートメニューを読み込み
        const templatesData = localStorage.getItem('menuTemplates');
        if (templatesData) {
            menuTemplates = JSON.parse(templatesData);
        }

        // カスタム種目を読み込み
        const customExData = localStorage.getItem('customExercises');
        if (customExData) {
            customExercises = JSON.parse(customExData);
        }
    } catch (e) {
        console.error('データ読み込みエラー:', e);
        clients = [];
    }
}

// 既存セッションデータにBMRを追加するマイグレーション関数
function migrateSessionsWithBMR() {
    let updated = false;

    clients.forEach(client => {
        if (client.sessions && client.sessions.length > 0) {
            client.sessions.forEach(session => {
                // BMRがまだ計算されていない場合
                if (!session.bmr && session.weight && session.bodyFat) {
                    const age = calculateAge(new Date(client.birthday));
                    const gender = client.gender || '男性';

                    if (gender === '男性') {
                        session.bmr = Math.round(88.362 + (13.397 * session.weight) + (4.799 * 170) - (5.677 * age));
                    } else {
                        session.bmr = Math.round(447.593 + (9.247 * session.weight) + (3.098 * 160) - (4.330 * age));
                    }

                    // 後方互換性のため
                    session.basalMetabolism = session.bmr;
                    updated = true;
                }
            });
        }
    });

    if (updated) {
        saveToLocalStorage();
        console.log('既存セッションデータにBMRを追加しました');
    }
}

function loadSampleData() {
    clients = [
        {
            id: '001',
            name: '山田太郎',
            furigana: 'やまだたろう',
            gender: '男性',
            birthdate: '1985-04-15',
            age: 40,
            phone: '090-1234-5678',
            email: 'yamada@example.com',
            address: '東京都渋谷区1-2-3',
            emergencyContact: '山田花子',
            emergencyPhone: '090-8765-4321',
            status: 'アクティブ',
            goalDate: '2025-12-31',
            goalWeight: 70,
            goalBodyFat: 15,
            goal: '体重を70kgまで減量し、体脂肪率15%を目指す',
            medicalNotes: '',
            tickets: { remaining: 6, total: 8 },
            sessions: [
                {
                    id: 'session_1',
                    date: '2025-10-28T10:00:00',
                    weight: 78,
                    bodyFat: 22,
                    muscleMass: 58,
                    exercises: [
                        { name: 'ベンチプレス', sets: 3, reps: 10, weight: 60 },
                        { name: 'スクワット', sets: 3, reps: 12, weight: 80 }
                    ],
                    rating: 8,
                    notes: '調子良好'
                }
            ],
            ticketHistory: [
                {
                    id: 'purchase_1',
                    date: '2025-10-01T00:00:00',
                    count: 8,
                    price: 70000,
                    paymentMethod: 'クレジットカード',
                    paymentStatus: '支払済み'
                }
            ],
            nextAppointment: '2025-11-02T10:00:00'
        }
    ];
    saveToLocalStorage();
}

// ========================================
// ユーティリティ関数
// ========================================

function generateClientId() {
    const maxId = clients.reduce((max, c) => {
        const num = parseInt(c.id);
        return num > max ? num : max;
    }, 0);

    return String(maxId + 1).padStart(3, '0');
}

function calculateAge(birthdate) {
    if (!birthdate) return '';
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
}

function formatDate(date) {
    if (!date) return '-';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

function formatDateTime(date) {
    if (!date) return '-';
    const dateStr = formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}`;
}

function formatTime(date) {
    if (!date) return '-';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ========================================
// 自動バックアップ機能
// ========================================

// データをJSONファイルとしてダウンロード
function downloadBackup() {
    const backupData = {
        clients: clients,
        menuTemplates: menuTemplates,
        customExercises: customExercises,
        backupDate: new Date().toISOString(),
        version: '1.0'
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `pt-manager-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('バックアップファイルをダウンロードしました');
}

// 毎週日曜日の夜に自動バックアップ
function scheduleAutoBackup() {
    const lastBackup = localStorage.getItem('lastBackupDate');
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 日曜日

    // 日曜日かつ前回のバックアップから7日以上経過している場合
    if (dayOfWeek === 0) {
        if (!lastBackup || (Date.now() - new Date(lastBackup).getTime()) > 7 * 24 * 60 * 60 * 1000) {
            downloadBackup();
            localStorage.setItem('lastBackupDate', today.toISOString());
        }
    }
}

// 起動時に自動バックアップをチェック
setTimeout(scheduleAutoBackup, 5000); // 5秒後にチェック

// ========================================
// 月次レポート機能
// ========================================

let reportRevenueChart = null;
let reportSessionsChart = null;
let currentReportMonth = null;

// 月次レポートページの初期化
function initReportPage() {
    const monthSelect = document.getElementById('reportMonthSelect');
    if (!monthSelect) return;

    // 過去12ヶ月分の選択肢を生成
    monthSelect.innerHTML = '';
    const today = new Date();

    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const option = document.createElement('option');
        option.value = `${year}-${String(month).padStart(2, '0')}`;
        option.textContent = `${year}年${month}月`;
        if (i === 0) option.selected = true;
        monthSelect.appendChild(option);
    }

    // イベントリスナー
    monthSelect.addEventListener('change', () => {
        currentReportMonth = monthSelect.value;
        updateReportData();
    });

    const generateBtn = document.getElementById('generateReportBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateMonthlyReportPDF);
    }

    // 初期データ表示
    currentReportMonth = monthSelect.value;
    updateReportData();
}

// レポートデータの集計
function aggregateMonthlyData(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    let totalRevenue = 0;
    let totalSessions = 0;
    let totalRatings = 0;
    let ratingCount = 0;
    let newClientsCount = 0;

    clients.forEach(client => {
        // 新規顧客数
        if (client.createdAt) {
            const createdDate = new Date(client.createdAt);
            if (createdDate >= startDate && createdDate <= endDate) {
                newClientsCount++;
            }
        }

        // チケット購入（売上）
        if (client.ticketPurchases) {
            client.ticketPurchases.forEach(purchase => {
                const purchaseDate = new Date(purchase.date);
                if (purchaseDate >= startDate && purchaseDate <= endDate) {
                    totalRevenue += purchase.price;
                }
            });
        }

        // セッション数と評価
        if (client.sessions) {
            client.sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                if (sessionDate >= startDate && sessionDate <= endDate) {
                    totalSessions++;
                    if (session.rating) {
                        totalRatings += session.rating;
                        ratingCount++;
                    }
                }
            });
        }
    });

    const avgRating = ratingCount > 0 ? (totalRatings / ratingCount).toFixed(1) : 0;

    return {
        totalRevenue,
        totalSessions,
        newClientsCount,
        avgRating: parseFloat(avgRating),
        ratingCount
    };
}

// 前月との比較計算
function calculateChange(current, previous) {
    if (!previous || previous === 0) return { value: 0, percentage: 0, direction: 'neutral' };

    const diff = current - previous;
    const percentage = ((diff / previous) * 100).toFixed(1);
    const direction = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';

    return { value: diff, percentage: parseFloat(percentage), direction };
}

// レポートデータの更新
function updateReportData() {
    if (!currentReportMonth) return;

    const currentData = aggregateMonthlyData(currentReportMonth);

    // 前月のデータを取得
    const [year, month] = currentReportMonth.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const previousData = aggregateMonthlyData(prevMonthStr);

    // サマリーカードの更新
    document.getElementById('reportRevenue').textContent = `¥${currentData.totalRevenue.toLocaleString()}`;
    document.getElementById('reportSessions').textContent = `${currentData.totalSessions}回`;
    document.getElementById('reportNewClients').textContent = `${currentData.newClientsCount}人`;
    document.getElementById('reportAvgRating').textContent = currentData.avgRating > 0 ? `${currentData.avgRating}/10` : '--';

    // 前月比の表示
    const revenueChange = calculateChange(currentData.totalRevenue, previousData.totalRevenue);
    const sessionsChange = calculateChange(currentData.totalSessions, previousData.totalSessions);
    const clientsChange = calculateChange(currentData.newClientsCount, previousData.newClientsCount);
    const ratingChange = calculateChange(currentData.avgRating, previousData.avgRating);

    updateChangeDisplay('reportRevenueChange', revenueChange, '円');
    updateChangeDisplay('reportSessionsChange', sessionsChange, '回');
    updateChangeDisplay('reportNewClientsChange', clientsChange, '人');
    updateChangeDisplay('reportRatingChange', ratingChange, '');

    // グラフの更新
    updateReportCharts();

    // 詳細テーブルの更新
    updateReportDetailsTable(currentData, previousData);
}

// 変化表示の更新
function updateChangeDisplay(elementId, change, unit) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = `summary-change ${change.direction}`;

    const arrow = change.direction === 'positive' ? '↑' : change.direction === 'negative' ? '↓' : '→';
    const sign = change.value > 0 ? '+' : '';

    if (change.direction === 'neutral' && change.value === 0) {
        element.textContent = '前月と同じ';
    } else {
        element.textContent = `${arrow} ${sign}${change.value.toLocaleString()}${unit} (${sign}${change.percentage}%)`;
    }
}

// グラフの更新
function updateReportCharts() {
    const [year, month] = currentReportMonth.split('-').map(Number);

    // 過去6ヶ月分のデータを取得
    const months = [];
    const revenueData = [];
    const sessionsData = [];

    for (let i = 5; i >= 0; i--) {
        const targetMonth = month - i;
        const targetYear = targetMonth <= 0 ? year - 1 : year;
        const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
        const monthStr = `${targetYear}-${String(adjustedMonth).padStart(2, '0')}`;

        const data = aggregateMonthlyData(monthStr);
        months.push(`${adjustedMonth}月`);
        revenueData.push(data.totalRevenue);
        sessionsData.push(data.totalSessions);
    }

    // 売上推移グラフ
    const revenueCtx = document.getElementById('reportRevenueChart');
    if (revenueCtx) {
        if (reportRevenueChart) {
            reportRevenueChart.destroy();
        }

        reportRevenueChart = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: '売上 (円)',
                    data: revenueData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '¥' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // セッション数推移グラフ
    const sessionsCtx = document.getElementById('reportSessionsChart');
    if (sessionsCtx) {
        if (reportSessionsChart) {
            reportSessionsChart.destroy();
        }

        reportSessionsChart = new Chart(sessionsCtx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'セッション数',
                    data: sessionsData,
                    backgroundColor: 'rgba(139, 92, 246, 0.8)',
                    borderColor: 'rgb(139, 92, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}

// 詳細テーブルの更新
function updateReportDetailsTable(currentData, previousData) {
    const tbody = document.querySelector('#reportDetailsTable tbody');
    if (!tbody) return;

    const rows = [
        {
            label: '総売上',
            current: `¥${currentData.totalRevenue.toLocaleString()}`,
            previous: `¥${previousData.totalRevenue.toLocaleString()}`,
            change: calculateChange(currentData.totalRevenue, previousData.totalRevenue)
        },
        {
            label: 'セッション数',
            current: `${currentData.totalSessions}回`,
            previous: `${previousData.totalSessions}回`,
            change: calculateChange(currentData.totalSessions, previousData.totalSessions)
        },
        {
            label: '新規顧客',
            current: `${currentData.newClientsCount}人`,
            previous: `${previousData.newClientsCount}人`,
            change: calculateChange(currentData.newClientsCount, previousData.newClientsCount)
        },
        {
            label: '平均評価',
            current: currentData.avgRating > 0 ? `${currentData.avgRating}/10` : '--',
            previous: previousData.avgRating > 0 ? `${previousData.avgRating}/10` : '--',
            change: calculateChange(currentData.avgRating, previousData.avgRating)
        },
        {
            label: '1セッション平均単価',
            current: currentData.totalSessions > 0 ? `¥${Math.round(currentData.totalRevenue / currentData.totalSessions).toLocaleString()}` : '--',
            previous: previousData.totalSessions > 0 ? `¥${Math.round(previousData.totalRevenue / previousData.totalSessions).toLocaleString()}` : '--',
            change: calculateChange(
                currentData.totalSessions > 0 ? currentData.totalRevenue / currentData.totalSessions : 0,
                previousData.totalSessions > 0 ? previousData.totalRevenue / previousData.totalSessions : 0
            )
        }
    ];

    tbody.innerHTML = rows.map(row => {
        const changeClass = row.change.direction === 'positive' ? 'change-positive' :
                          row.change.direction === 'negative' ? 'change-negative' : '';
        const arrow = row.change.direction === 'positive' ? '↑' :
                     row.change.direction === 'negative' ? '↓' : '→';
        const sign = row.change.value > 0 ? '+' : '';

        return `
            <tr>
                <td>${row.label}</td>
                <td>${row.current}</td>
                <td>${row.previous}</td>
                <td class="${changeClass}">${arrow} ${sign}${row.change.percentage}%</td>
            </tr>
        `;
    }).join('');
}

// PDF生成機能
function generateMonthlyReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const [year, month] = currentReportMonth.split('-').map(Number);
    const currentData = aggregateMonthlyData(currentReportMonth);

    // タイトル
    doc.setFontSize(20);
    doc.text(`${year}年${month}月 月次レポート`, 105, 20, { align: 'center' });

    // 生成日時
    doc.setFontSize(10);
    doc.text(`生成日: ${new Date().toLocaleDateString('ja-JP')}`, 105, 28, { align: 'center' });

    let yPos = 45;

    // サマリー
    doc.setFontSize(14);
    doc.text('サマリー', 20, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.text(`総売上: ¥${currentData.totalRevenue.toLocaleString()}`, 25, yPos);
    yPos += 8;
    doc.text(`セッション数: ${currentData.totalSessions}回`, 25, yPos);
    yPos += 8;
    doc.text(`新規顧客: ${currentData.newClientsCount}人`, 25, yPos);
    yPos += 8;
    doc.text(`平均評価: ${currentData.avgRating > 0 ? currentData.avgRating + '/10' : '--'}`, 25, yPos);
    yPos += 8;

    if (currentData.totalSessions > 0) {
        const avgPrice = Math.round(currentData.totalRevenue / currentData.totalSessions);
        doc.text(`1セッション平均単価: ¥${avgPrice.toLocaleString()}`, 25, yPos);
        yPos += 8;
    }

    yPos += 10;

    // 過去6ヶ月の推移
    doc.setFontSize(14);
    doc.text('過去6ヶ月の推移', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text('月', 30, yPos);
    doc.text('売上', 60, yPos);
    doc.text('セッション数', 100, yPos);
    yPos += 5;

    // 過去6ヶ月分のデータ
    for (let i = 5; i >= 0; i--) {
        const targetMonth = month - i;
        const targetYear = targetMonth <= 0 ? year - 1 : year;
        const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
        const monthStr = `${targetYear}-${String(adjustedMonth).padStart(2, '0')}`;

        const data = aggregateMonthlyData(monthStr);

        yPos += 7;
        doc.text(`${adjustedMonth}月`, 30, yPos);
        doc.text(`¥${data.totalRevenue.toLocaleString()}`, 60, yPos);
        doc.text(`${data.totalSessions}回`, 100, yPos);
    }

    yPos += 15;

    // フッター
    doc.setFontSize(8);
    doc.text('PT Manager - パーソナルトレーナー顧客管理システム', 105, 280, { align: 'center' });

    // PDFをダウンロード
    doc.save(`月次レポート_${year}年${month}月.pdf`);

    showNotification('PDFレポートをダウンロードしました');
}

// ページ切り替え時にレポートページを初期化
const originalNavigateTo = navigateTo;
navigateTo = function(page) {
    originalNavigateTo(page);
    if (page === 'report') {
        initReportPage();
    }
    if (page === 'dashboard') {
        updateMonthlyGoalDisplay();
    }
};

// ========================================
// 月間目標設定と売上予測機能
// ========================================

let monthlyGoals = {};

// 月間目標の読み込み
const goalsData = localStorage.getItem('monthlyGoals');
if (goalsData) {
    monthlyGoals = JSON.parse(goalsData);
}

// 月間目標モーダルの初期化
const monthlyGoalModal = document.getElementById('monthlyGoalModal');
const monthlyGoalModalClose = document.getElementById('monthlyGoalModalClose');
const monthlyGoalCancelBtn = document.getElementById('monthlyGoalCancelBtn');
const monthlyGoalForm = document.getElementById('monthlyGoalForm');
const setGoalBtn = document.getElementById('setGoalBtn');

if (setGoalBtn) {
    setGoalBtn.addEventListener('click', () => {
        const today = new Date();
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('goalMonth').value = yearMonth;

        // 既存の目標があれば読み込む
        if (monthlyGoals[yearMonth]) {
            document.getElementById('goalAmount').value = monthlyGoals[yearMonth].goalAmount;
            document.getElementById('ticketPrice').value = monthlyGoals[yearMonth].ticketPrice;
        }

        monthlyGoalModal.classList.add('active');
    });
}

if (monthlyGoalModalClose) {
    monthlyGoalModalClose.addEventListener('click', () => {
        monthlyGoalModal.classList.remove('active');
    });
}

if (monthlyGoalCancelBtn) {
    monthlyGoalCancelBtn.addEventListener('click', () => {
        monthlyGoalModal.classList.remove('active');
    });
}

if (monthlyGoalForm) {
    monthlyGoalForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const goalMonth = document.getElementById('goalMonth').value;
        const goalAmount = parseInt(document.getElementById('goalAmount').value);
        const ticketPrice = parseInt(document.getElementById('ticketPrice').value) || 36000;

        monthlyGoals[goalMonth] = {
            goalAmount,
            ticketPrice,
            setDate: new Date().toISOString()
        };

        localStorage.setItem('monthlyGoals', JSON.stringify(monthlyGoals));

        showNotification('月間目標を設定しました');
        monthlyGoalModal.classList.remove('active');
        updateMonthlyGoalDisplay();
    });
}

// 月間目標の表示を更新
function updateMonthlyGoalDisplay() {
    const goalContent = document.getElementById('goalContent');
    if (!goalContent) return;

    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // 今月のデータを集計
    const currentData = aggregateMonthlyData(yearMonth);
    const currentGoal = monthlyGoals[yearMonth];

    if (!currentGoal) {
        goalContent.innerHTML = `
            <div class="goal-empty">
                <p>今月の売上目標を設定しましょう</p>
            </div>
        `;
        return;
    }

    const goalAmount = currentGoal.goalAmount;
    const ticketPrice = currentGoal.ticketPrice;
    const currentRevenue = currentData.totalRevenue;
    const achievementRate = (currentRevenue / goalAmount * 100).toFixed(1);
    const remaining = Math.max(0, goalAmount - currentRevenue);
    const ticketsNeeded = Math.ceil(remaining / ticketPrice);

    // 売上ペースから予測
    const today_date = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyAverage = currentRevenue / today_date;
    const forecastRevenue = Math.round(dailyAverage * daysInMonth);
    const forecastAchievementRate = (forecastRevenue / goalAmount * 100).toFixed(1);

    const isComplete = achievementRate >= 100;
    const progressClass = isComplete ? 'complete' : '';

    goalContent.innerHTML = `
        <div class="goal-active">
            <div class="goal-stats">
                <div class="goal-stat">
                    <div class="goal-stat-label">目標金額</div>
                    <div class="goal-stat-value">¥${goalAmount.toLocaleString()}</div>
                </div>
                <div class="goal-stat">
                    <div class="goal-stat-label">現在の売上</div>
                    <div class="goal-stat-value">¥${currentRevenue.toLocaleString()}</div>
                </div>
                <div class="goal-stat">
                    <div class="goal-stat-label">達成率</div>
                    <div class="goal-stat-value">${achievementRate}%</div>
                </div>
            </div>

            <div class="goal-progress-section">
                <div class="goal-progress-label">
                    <span>進捗状況</span>
                    <span class="goal-progress-percentage">${achievementRate}%</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill ${progressClass}" style="width: ${Math.min(100, achievementRate)}%"></div>
                </div>
                <div class="goal-progress-info">
                    ${isComplete ?
                        '🎉 目標達成おめでとうございます！' :
                        `あと ¥${remaining.toLocaleString()} (チケット約${ticketsNeeded}枚分)`
                    }
                </div>
            </div>

            <div class="goal-forecast">
                <h4>売上予測</h4>
                <div class="forecast-items">
                    <div class="forecast-item">
                        <span class="forecast-label">1日平均売上:</span>
                        <span class="forecast-value">¥${Math.round(dailyAverage).toLocaleString()}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">今月末予測:</span>
                        <span class="forecast-value">¥${forecastRevenue.toLocaleString()}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">予測達成率:</span>
                        <span class="forecast-value">${forecastAchievementRate}%</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">必要チケット数:</span>
                        <span class="forecast-value">${ticketsNeeded}枚</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 目標達成した場合、アニメーション表示
    if (isComplete && !sessionStorage.getItem(`goal-celebrated-${yearMonth}`)) {
        setTimeout(() => {
            showGoalAchievement(goalAmount, achievementRate);
            sessionStorage.setItem(`goal-celebrated-${yearMonth}`, 'true');
        }, 1000);
    }
}

// 目標達成アニメーション
function showGoalAchievement(goalAmount, achievementRate) {
    const overlay = document.getElementById('goalAchievedOverlay');
    const text = document.getElementById('goalAchievedText');

    text.textContent = `今月の目標 ¥${goalAmount.toLocaleString()} を達成しました！（達成率: ${achievementRate}%）`;
    overlay.classList.add('active');

    const closeBtn = document.getElementById('goalAchievedClose');
    closeBtn.onclick = () => {
        overlay.classList.remove('active');
    };
}

// 初回表示
updateMonthlyGoalDisplay();

// ========================================
// カスタム種目管理
// ========================================

// カスタム種目の表示を更新
function updateCustomExerciseList() {
    const list = document.getElementById('customExerciseList');
    if (!list) return;

    if (customExercises.length === 0) {
        list.innerHTML = '<div class="custom-exercise-empty">カスタム種目はまだ登録されていません</div>';
        return;
    }

    list.innerHTML = customExercises.map((exercise, index) => `
        <div class="custom-exercise-item">
            <div class="custom-exercise-info">
                <div class="custom-exercise-name">${exercise.name}</div>
                <span class="custom-exercise-category">${exercise.category}</span>
            </div>
            <div class="custom-exercise-actions">
                <button class="btn-icon delete" onclick="deleteCustomExercise(${index})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// カスタム種目を追加
const addCustomExerciseBtn = document.getElementById('addCustomExerciseBtn');
if (addCustomExerciseBtn) {
    addCustomExerciseBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('customExerciseName');
        const categorySelect = document.getElementById('customExerciseCategory');

        const name = nameInput.value.trim();
        const category = categorySelect.value;

        if (!name) {
            showNotification('種目名を入力してください', 'error');
            return;
        }

        // 重複チェック
        const isDuplicate = customExercises.some(ex => ex.name === name);
        if (isDuplicate) {
            showNotification('この種目名は既に登録されています', 'error');
            return;
        }

        // カスタム種目を追加
        customExercises.push({
            name,
            category,
            createdAt: new Date().toISOString()
        });

        // LocalStorageに保存
        localStorage.setItem('customExercises', JSON.stringify(customExercises));

        // UIを更新
        updateCustomExerciseList();

        // フォームをリセット
        nameInput.value = '';
        categorySelect.value = '胸';

        showNotification(`「${name}」を追加しました`);
    });
}

// カスタム種目を削除
function deleteCustomExercise(index) {
    if (!confirm(`「${customExercises[index].name}」を削除してもよろしいですか？`)) {
        return;
    }

    const deletedName = customExercises[index].name;
    customExercises.splice(index, 1);

    // LocalStorageに保存
    localStorage.setItem('customExercises', JSON.stringify(customExercises));

    // UIを更新
    updateCustomExerciseList();

    showNotification(`「${deletedName}」を削除しました`);
}

// 設定ページを開いた時にカスタム種目リストを更新
const originalNavigateToV2 = navigateTo;
navigateTo = function(page) {
    originalNavigateToV2(page);
    if (page === 'report') {
        initReportPage();
    }
    if (page === 'dashboard') {
        updateMonthlyGoalDisplay();
    }
    if (page === 'settings') {
        updateCustomExerciseList();
    }
};

// エクササイズ選択肢を生成する関数を更新（カスタム種目を含める）
function getAllExercises() {
    const allExercises = {};

    // 既存のカテゴリーをコピー
    Object.keys(EXERCISE_CATEGORIES).forEach(category => {
        allExercises[category] = [...EXERCISE_CATEGORIES[category]];
    });

    // カスタム種目を各カテゴリーに追加
    customExercises.forEach(exercise => {
        const category = exercise.category;
        if (!allExercises[category]) {
            allExercises[category] = [];
        }
        allExercises[category].push(exercise.name);
    });

    return allExercises;
}

// ========================================
// PWA通知機能
// ========================================

let notificationPermission = 'default';
let notificationEnabled = false;

// 通知設定の読み込み
const notificationSettings = localStorage.getItem('notificationSettings');
if (notificationSettings) {
    const settings = JSON.parse(notificationSettings);
    notificationEnabled = settings.enabled || false;
    document.getElementById('notificationTiming').value = settings.timing || 60;
}

// 通知トグルの初期化
const notificationToggle = document.getElementById('notificationToggle');
const notificationSettingsDiv = document.getElementById('notificationSettings');

if (notificationToggle) {
    notificationToggle.checked = notificationEnabled;

    notificationToggle.addEventListener('change', (e) => {
        notificationEnabled = e.target.checked;
        notificationSettingsDiv.style.display = notificationEnabled ? 'block' : 'none';

        saveNotificationSettings();

        if (notificationEnabled && Notification.permission === 'default') {
            // 通知権限がまだの場合は表示
            showNotification('通知を有効化ボタンを押して権限を許可してください', 'info');
        }
    });

    // 初期表示
    notificationSettingsDiv.style.display = notificationEnabled ? 'block' : 'none';
}

// 通知権限リクエストボタン
const requestNotificationBtn = document.getElementById('requestNotificationBtn');
if (requestNotificationBtn) {
    requestNotificationBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showNotification('このブラウザは通知機能に対応していません', 'error');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            notificationPermission = permission;
            updateNotificationStatus();

            if (permission === 'granted') {
                showNotification('通知権限が許可されました');
                // テスト通知を送信
                new Notification('PT Manager', {
                    body: 'セッション通知が有効になりました！',
                    icon: 'icon-192.png',
                    badge: 'icon-192.png'
                });
            } else if (permission === 'denied') {
                showNotification('通知権限が拒否されました。ブラウザの設定から許可してください。', 'error');
            }
        } catch (error) {
            console.error('通知権限エラー:', error);
            showNotification('通知権限の取得に失敗しました', 'error');
        }
    });
}

// 通知タイミング変更
const notificationTimingSelect = document.getElementById('notificationTiming');
if (notificationTimingSelect) {
    notificationTimingSelect.addEventListener('change', () => {
        saveNotificationSettings();
    });
}

// 通知設定を保存
function saveNotificationSettings() {
    const settings = {
        enabled: notificationEnabled,
        timing: parseInt(document.getElementById('notificationTiming').value)
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
}

// 通知ステータスの更新
function updateNotificationStatus() {
    const statusDiv = document.getElementById('notificationStatus');
    if (!statusDiv) return;

    if (!('Notification' in window)) {
        statusDiv.innerHTML = '<p class="status-denied">このブラウザは通知機能に対応していません</p>';
        return;
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
        statusDiv.innerHTML = '<p class="status-granted">✓ 通知が有効です</p>';
        if (requestNotificationBtn) requestNotificationBtn.style.display = 'none';
    } else if (permission === 'denied') {
        statusDiv.innerHTML = '<p class="status-denied">通知が拒否されています。ブラウザの設定から許可してください。</p>';
        if (requestNotificationBtn) requestNotificationBtn.style.display = 'none';
    } else {
        statusDiv.innerHTML = '<p class="status-pending">通知権限を許可してください</p>';
        if (requestNotificationBtn) requestNotificationBtn.style.display = 'block';
    }
}

// 予約の通知をスケジュール
function scheduleAppointmentNotification(appointment, clientName) {
    if (!notificationEnabled || Notification.permission !== 'granted') {
        return;
    }

    const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{"timing": 60}');
    const notificationTime = new Date(appointment.getTime() - settings.timing * 60 * 1000);
    const now = new Date();

    if (notificationTime > now) {
        const delay = notificationTime.getTime() - now.getTime();

        setTimeout(() => {
            new Notification('セッションのリマインダー', {
                body: `${clientName}様のセッションが${settings.timing}分後に始まります`,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                tag: 'session-reminder',
                requireInteraction: true
            });
        }, delay);
    }
}

// 今日・明日の予約をチェックして通知をスケジュール
function checkUpcomingAppointments() {
    if (!notificationEnabled || Notification.permission !== 'granted') {
        return;
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59);

    clients.forEach(client => {
        if (client.sessions && client.sessions.length > 0) {
            client.sessions.forEach(session => {
                if (session.nextAppointment) {
                    const appointmentDate = new Date(session.nextAppointment);
                    if (appointmentDate >= now && appointmentDate <= tomorrow) {
                        scheduleAppointmentNotification(appointmentDate, client.name);
                    }
                }
            });
        }
    });
}

// 設定ページを開いた時に通知ステータスを更新
const originalNavigateToV3 = navigateTo;
navigateTo = function(page) {
    originalNavigateToV3(page);
    if (page === 'report') {
        initReportPage();
    }
    if (page === 'dashboard') {
        updateMonthlyGoalDisplay();
    }
    if (page === 'settings') {
        updateCustomExerciseList();
        updateNotificationStatus();
    }
};

// 起動時に予約をチェック
if ('Notification' in window && Notification.permission === 'granted') {
    checkUpcomingAppointments();
}

// 毎時間予約をチェック
setInterval(checkUpcomingAppointments, 60 * 60 * 1000);

// ========================================
// AIメニュー提案機能
// ========================================

let openaiApiKey = null;
let currentAISuggestion = null;

// OpenAI APIキーの読み込み
const savedApiKey = localStorage.getItem('openaiApiKey');
if (savedApiKey) {
    openaiApiKey = savedApiKey;
}

// APIキー保存
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
        const apiKeyInput = document.getElementById('openaiApiKey');
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showNotification('APIキーを入力してください', 'error');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            showNotification('有効なOpenAI APIキーを入力してください（sk-で始まる必要があります）', 'error');
            return;
        }

        openaiApiKey = apiKey;
        localStorage.setItem('openaiApiKey', apiKey);

        const statusDiv = document.getElementById('apiStatus');
        statusDiv.className = 'api-status success';
        statusDiv.textContent = '✓ APIキーが保存されました';

        document.getElementById('generateMenuBtn').disabled = false;

        showNotification('APIキーを保存しました');
    });
}

// 顧客選択リストの初期化
function initAIClientSelect() {
    const select = document.getElementById('aiClientSelect');
    if (!select) return;

    select.innerHTML = '<option value="">顧客を選択してください</option>';

    clients.forEach((client, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = client.name;
        select.appendChild(option);
    });

    // APIキーが設定されている場合はボタンを有効化
    const openaiKey = localStorage.getItem('openaiApiKey');
    if (openaiKey) {
        document.getElementById('openaiApiKey').value = openaiKey;
        document.getElementById('generateMenuBtn').disabled = false;

        const statusDiv = document.getElementById('apiStatus');
        statusDiv.className = 'api-status success';
        statusDiv.textContent = '✓ APIキーが設定されています';
    }
}

// AIメニュー生成
const generateMenuBtn = document.getElementById('generateMenuBtn');
if (generateMenuBtn) {
    generateMenuBtn.addEventListener('click', async () => {
        const clientIndex = document.getElementById('aiClientSelect').value;

        if (!clientIndex) {
            showNotification('顧客を選択してください', 'error');
            return;
        }

        if (!openaiApiKey) {
            showNotification('先にOpenAI APIキーを設定してください', 'error');
            return;
        }

        const client = clients[clientIndex];
        await generateAIMenu(client);
    });
}

// AIメニュー生成処理
async function generateAIMenu(client) {
    const resultSection = document.getElementById('aiResultSection');
    const resultContent = document.getElementById('aiResultContent');

    resultSection.style.display = 'block';
    resultContent.innerHTML = '<div class="ai-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg><span style="margin-left: 12px;">AIがメニューを生成中...</span></div>';

    try {
        // クライアント情報を収集
        const clientInfo = {
            name: client.name,
            goal: client.goal || '未設定',
            trainingPurpose: client.trainingPurpose || '未設定',
            initialWeight: client.initialWeight,
            goalWeight: client.goalWeight,
            initialBodyFat: client.initialBodyFat,
            goalBodyFat: client.goalBodyFat,
            medicalNotes: client.medicalNotes || 'なし',
            lastSession: client.sessions && client.sessions.length > 0 ? client.sessions[0] : null
        };

        // OpenAI APIを呼び出し
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'あなたは経験豊富なパーソナルトレーナーです。クライアントの情報に基づいて、最適なトレーニングメニューを提案してください。'
                }, {
                    role: 'user',
                    content: `以下のクライアント情報に基づいて、1時間のパーソナルトレーニングメニューを提案してください：

【クライアント情報】
- 名前: ${clientInfo.name}
- トレーニング目的: ${clientInfo.trainingPurpose}
- 目標: ${clientInfo.goal}
- 現在の体重: ${clientInfo.initialWeight || '未記録'}kg
- 目標体重: ${clientInfo.goalWeight || '未設定'}kg
- 現在の体脂肪率: ${clientInfo.initialBodyFat || '未記録'}%
- 目標体脂肪率: ${clientInfo.goalBodyFat || '未設定'}%
- 特記事項: ${clientInfo.medicalNotes}
${clientInfo.lastSession ? `- 前回のトレーニング評価: ${clientInfo.lastSession.rating}/10` : ''}

【提案形式】
1. ウォームアップ（5-10分）
2. メイントレーニング（40-45分）
   - 各種目：セット数、レップ数、推奨重量
3. クールダウン（5-10分）

注意点や励ましのメッセージも添えてください。`
                }],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const suggestion = data.choices[0].message.content;

        currentAISuggestion = suggestion;

        resultContent.innerHTML = `<div style="white-space: pre-wrap;">${suggestion}</div>`;

        showNotification('AIメニューが生成されました');

    } catch (error) {
        console.error('AI generation error:', error);
        resultContent.innerHTML = `<div class="api-status error">エラーが発生しました: ${error.message}<br><br>APIキーが正しいか確認してください。OpenAI APIキーは https://platform.openai.com/api-keys で取得できます。</div>`;
        showNotification('AIメニューの生成に失敗しました', 'error');
    }
}

// クリップボードにコピー
const copyMenuBtn = document.getElementById('copyMenuBtn');
if (copyMenuBtn) {
    copyMenuBtn.addEventListener('click', () => {
        if (!currentAISuggestion) return;

        navigator.clipboard.writeText(currentAISuggestion)
            .then(() => {
                showNotification('クリップボードにコピーしました');
            })
            .catch(err => {
                console.error('Copy error:', err);
                showNotification('コピーに失敗しました', 'error');
            });
    });
}

// セッションに適用
const applyMenuBtn = document.getElementById('applyMenuBtn');
if (applyMenuBtn) {
    applyMenuBtn.addEventListener('click', () => {
        showNotification('この機能は実装中です。現在はクリップボードにコピーして手動で入力してください。', 'info');
    });
}

// AI Trainerページを開いた時にクライアントリストを更新
const originalNavigateToV4 = navigateTo;
navigateTo = function(page) {
    originalNavigateToV4(page);
    if (page === 'report') {
        initReportPage();
    }
    if (page === 'home') {
        updateMonthlyGoalDisplay();
    }
    if (page === 'dashboard') {
        initDashboard();
    }
    if (page === 'settings') {
        updateCustomExerciseList();
        updateNotificationStatus();
    }
    if (page === 'ai-trainer') {
        initAIClientSelect();
    }
};

// ========================================
// ダッシュボード機能
// ========================================

let dashboardCharts = {
    revenue: null,
    sessions: null,
    ticketType: null,
    topClients: null
};

function initDashboard() {
    updateDashboardStats();
    updateDashboardCharts();
    updateRiskClientsList();
}

function updateDashboardStats() {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // 総顧客数
    const totalClients = clients.length;
    document.getElementById('dashTotalClients').textContent = totalClients;

    // 今月追加された顧客数
    const newClientsThisMonth = clients.filter(c => {
        const joinDate = new Date(c.joinDate || c.createdAt);
        return joinDate.getMonth() === thisMonth && joinDate.getFullYear() === thisYear;
    }).length;

    const clientsChange = document.getElementById('dashClientsChange');
    if (newClientsThisMonth > 0) {
        clientsChange.textContent = `+${newClientsThisMonth} 今月`;
        clientsChange.className = 'stat-change positive';
    } else {
        clientsChange.textContent = '±0 今月';
        clientsChange.className = 'stat-change';
    }

    // アクティブ顧客数（30日以内にセッションあり）
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeClients = clients.filter(c => {
        if (!c.sessions || c.sessions.length === 0) return false;
        const lastSession = new Date(c.sessions[0].date);
        return lastSession >= thirtyDaysAgo;
    }).length;
    document.getElementById('dashActiveClients').textContent = activeClients;

    // 今月の売上
    let monthlyRevenue = 0;
    let lastMonthRevenue = 0;

    clients.forEach(client => {
        if (client.ticketHistory) {
            client.ticketHistory.forEach(ticket => {
                // 支払い済みのチケットのみ集計
                if (ticket.paymentStatus === '完了' || ticket.paymentStatus === '支払済み') {
                    const ticketDate = new Date(ticket.date);
                    if (ticketDate.getMonth() === thisMonth && ticketDate.getFullYear() === thisYear) {
                        monthlyRevenue += ticket.price || 0;
                    }
                    // 先月の売上
                    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
                    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
                    if (ticketDate.getMonth() === lastMonth && ticketDate.getFullYear() === lastMonthYear) {
                        lastMonthRevenue += ticket.price || 0;
                    }
                }
            });
        }
    });

    document.getElementById('dashMonthlyRevenue').textContent = `¥${monthlyRevenue.toLocaleString()}`;

    // 先月比
    const revenueChange = document.getElementById('dashRevenueChange');
    if (lastMonthRevenue > 0) {
        const changePercent = ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1);
        revenueChange.textContent = `先月比: ${changePercent > 0 ? '+' : ''}${changePercent}%`;
        revenueChange.className = changePercent >= 0 ? 'stat-change positive' : 'stat-change negative';
    } else {
        revenueChange.textContent = '先月比: -';
        revenueChange.className = 'stat-change';
    }

    // 今月のセッション数
    let monthlySessions = 0;
    clients.forEach(client => {
        if (client.sessions) {
            monthlySessions += client.sessions.filter(s => {
                const sessionDate = new Date(s.date);
                return sessionDate.getMonth() === thisMonth && sessionDate.getFullYear() === thisYear;
            }).length;
        }
    });

    document.getElementById('dashMonthlySessions').textContent = `${monthlySessions}回`;

    // 一人当たり平均セッション数
    const avgSessions = activeClients > 0 ? (monthlySessions / activeClients).toFixed(1) : 0;
    document.getElementById('dashAvgSessionsPerClient').textContent = avgSessions;

    // チケット消化率
    let totalTickets = 0;
    let usedTickets = 0;

    clients.forEach(client => {
        if (client.tickets) {
            client.tickets.forEach(ticket => {
                totalTickets += ticket.sessions;
                usedTickets += ticket.used;
            });
        }
    });

    const usageRate = totalTickets > 0 ? ((usedTickets / totalTickets) * 100).toFixed(1) : 0;
    document.getElementById('dashTicketUsageRate').textContent = `${usageRate}%`;
    document.getElementById('dashUsedTickets').textContent = usedTickets;
    document.getElementById('dashTotalTickets').textContent = totalTickets;

    // 離脱リスク顧客
    const churnRiskClients = clients.filter(c => {
        if (!c.sessions || c.sessions.length === 0) return false;
        const lastSession = new Date(c.sessions[0].date);
        return lastSession < thirtyDaysAgo;
    }).length;
    document.getElementById('dashChurnRisk').textContent = `${churnRiskClients}人`;

    // トレーニング効果分析
    calculateTrainingEffectiveness();
}

function calculateTrainingEffectiveness() {
    let totalWeightLoss = 0;
    let totalBodyFatLoss = 0;
    let clientsWithWeightData = 0;
    let clientsWithBodyFatData = 0;
    let goalsAchieved = 0;
    let clientsWithGoals = 0;
    let totalRatings = 0;
    let ratingsCount = 0;

    clients.forEach(client => {
        if (client.sessions && client.sessions.length > 0) {
            // 体重減少
            const sessionsWithWeight = client.sessions.filter(s => s.weight).sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sessionsWithWeight.length >= 2) {
                const firstWeight = sessionsWithWeight[0].weight;
                const lastWeight = sessionsWithWeight[sessionsWithWeight.length - 1].weight;
                totalWeightLoss += (firstWeight - lastWeight);
                clientsWithWeightData++;
            }

            // 体脂肪率減少
            const sessionsWithBodyFat = client.sessions.filter(s => s.bodyFat).sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sessionsWithBodyFat.length >= 2) {
                const firstBodyFat = sessionsWithBodyFat[0].bodyFat;
                const lastBodyFat = sessionsWithBodyFat[sessionsWithBodyFat.length - 1].bodyFat;
                totalBodyFatLoss += (firstBodyFat - lastBodyFat);
                clientsWithBodyFatData++;
            }

            // 目標達成
            if (client.goalWeight && sessionsWithWeight.length > 0) {
                clientsWithGoals++;
                const currentWeight = sessionsWithWeight[sessionsWithWeight.length - 1].weight;
                if (currentWeight <= client.goalWeight) {
                    goalsAchieved++;
                }
            }

            // セッション評価
            client.sessions.forEach(s => {
                if (s.rating) {
                    totalRatings += s.rating;
                    ratingsCount++;
                }
            });
        }
    });

    // 平均値の表示
    const avgWeightLoss = clientsWithWeightData > 0 ? (totalWeightLoss / clientsWithWeightData).toFixed(1) : 0;
    document.getElementById('avgWeightLoss').textContent = `-${avgWeightLoss}kg`;

    const avgBodyFatLoss = clientsWithBodyFatData > 0 ? (totalBodyFatLoss / clientsWithBodyFatData).toFixed(1) : 0;
    document.getElementById('avgBodyFatLoss').textContent = `-${avgBodyFatLoss}%`;

    const achievementRate = clientsWithGoals > 0 ? ((goalsAchieved / clientsWithGoals) * 100).toFixed(1) : 0;
    document.getElementById('goalAchievementRate').textContent = `${achievementRate}%`;

    const avgRating = ratingsCount > 0 ? (totalRatings / ratingsCount).toFixed(1) : 0;
    document.getElementById('avgSessionRating').textContent = `${avgRating}/10`;
}

function updateDashboardCharts() {
    // 月別売上推移
    createRevenueChart();

    // 月別セッション数推移
    createSessionsChart();

    // チケット種類別売上
    createTicketTypeChart();

    // 顧客別売上TOP10
    createTopClientsChart();
}

function createRevenueChart() {
    const ctx = document.getElementById('revenueChartDashboard');
    if (!ctx) return;

    if (dashboardCharts.revenue) dashboardCharts.revenue.destroy();

    // 過去12ヶ月のデータを生成
    const now = new Date();
    const labels = [];
    const data = [];

    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth();
        const year = date.getFullYear();
        labels.push(`${year}/${String(month + 1).padStart(2, '0')}`);

        let monthRevenue = 0;
        clients.forEach(client => {
            if (client.tickets) {
                client.tickets.forEach(ticket => {
                    const ticketDate = new Date(ticket.purchaseDate);
                    if (ticketDate.getMonth() === month && ticketDate.getFullYear() === year) {
                        monthRevenue += ticket.price;
                    }
                });
            }
        });
        data.push(monthRevenue);
    }

    dashboardCharts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '売上 (円)',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function createSessionsChart() {
    const ctx = document.getElementById('sessionsChartDashboard');
    if (!ctx) return;

    if (dashboardCharts.sessions) dashboardCharts.sessions.destroy();

    const now = new Date();
    const labels = [];
    const data = [];

    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth();
        const year = date.getFullYear();
        labels.push(`${year}/${String(month + 1).padStart(2, '0')}`);

        let monthSessions = 0;
        clients.forEach(client => {
            if (client.sessions) {
                monthSessions += client.sessions.filter(s => {
                    const sessionDate = new Date(s.date);
                    return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
                }).length;
            }
        });
        data.push(monthSessions);
    }

    dashboardCharts.sessions = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'セッション数',
                data: data,
                backgroundColor: '#10b981',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createTicketTypeChart() {
    const ctx = document.getElementById('ticketTypeChart');
    if (!ctx) return;

    if (dashboardCharts.ticketType) dashboardCharts.ticketType.destroy();

    // チケット種類別の売上を集計
    const ticketTypes = {};

    clients.forEach(client => {
        if (client.tickets) {
            client.tickets.forEach(ticket => {
                const typeName = ticket.type || '通常チケット';
                if (!ticketTypes[typeName]) {
                    ticketTypes[typeName] = 0;
                }
                ticketTypes[typeName] += ticket.price;
            });
        }
    });

    const labels = Object.keys(ticketTypes);
    const data = Object.values(ticketTypes);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    dashboardCharts.ticketType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ¥' + context.parsed.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function createTopClientsChart() {
    const ctx = document.getElementById('topClientsChart');
    if (!ctx) return;

    if (dashboardCharts.topClients) dashboardCharts.topClients.destroy();

    // 顧客別の総売上を計算
    const clientRevenue = clients.map(client => {
        let revenue = 0;
        if (client.tickets) {
            client.tickets.forEach(ticket => {
                revenue += ticket.price;
            });
        }
        return {
            name: client.name,
            revenue: revenue
        };
    }).filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const labels = clientRevenue.map(c => c.name);
    const data = clientRevenue.map(c => c.revenue);

    dashboardCharts.topClients = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '総売上 (円)',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '¥' + context.parsed.x.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function updateRiskClientsList() {
    const container = document.getElementById('riskClientsList');
    if (!container) return;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const riskClients = clients.filter(c => {
        if (!c.sessions || c.sessions.length === 0) return false;
        const lastSession = new Date(c.sessions[0].date);
        return lastSession < thirtyDaysAgo;
    }).sort((a, b) => {
        const aLast = new Date(a.sessions[0].date);
        const bLast = new Date(b.sessions[0].date);
        return aLast - bLast;
    });

    container.innerHTML = '';

    if (riskClients.length === 0) {
        return; // CSSの::beforeで「顧客なし」メッセージが表示される
    }

    riskClients.forEach(client => {
        const lastSessionDate = new Date(client.sessions[0].date);
        const daysSince = Math.floor((now - lastSessionDate) / (1000 * 60 * 60 * 24));

        const card = document.createElement('div');
        card.className = 'risk-client-card';
        card.innerHTML = `
            <div class="risk-client-info">
                <div class="risk-client-avatar">${client.name.charAt(0)}</div>
                <div class="risk-client-details">
                    <h4>${client.name}</h4>
                    <p>最終セッション: ${daysSince}日前 (${formatDate(lastSessionDate)})</p>
                </div>
            </div>
            <div class="risk-client-actions">
                <button class="btn btn-secondary btn-small" onclick="openClientDetail('${client.id}')">詳細を見る</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// グローバル関数（HTMLから呼び出すため）
window.openClientDetail = openClientDetail;
window.removeExerciseEntry = removeExerciseEntry;
window.downloadBackup = downloadBackup;
window.deleteCustomExercise = deleteCustomExercise;

console.log('app.js loaded successfully');
