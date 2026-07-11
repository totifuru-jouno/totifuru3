// ストレージキー
const STORAGE_KEYS = {
    vehicles: 'scale_vehicles',
    records: 'scale_records'
};

// 現在編集中の車両ID
let currentEditId = null;

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadVehiclesTable();
    loadRecordsTable();
});

function initializeApp() {
    // デフォルト時刻を設定
    setDefaultTime();
}

function setupEventListeners() {
    // ナビゲーションタブ
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });

    // QR入力
    document.getElementById('qrInput').addEventListener('change', handleQRInput);

    // 入場受付
    document.getElementById('entranceBtn').addEventListener('click', registerEntry);
    document.getElementById('clearEntranceBtn').addEventListener('click', clearEntryForm);
    document.getElementById('entranceWeight').addEventListener('input', () => {
        updateEntranceButtonState();
    });

    // マスタ管理
    document.getElementById('masterRegisterBtn').addEventListener('click', registerMaster);
    document.getElementById('masterClearBtn').addEventListener('click', clearMasterForm);

    // 記録管理
    document.getElementById('exportBtn').addEventListener('click', exportCSV);
    document.getElementById('clearRecordsBtn').addEventListener('click', clearRecords);

    // モーダル
    const modal = document.getElementById('editModal');
    const closeBtn = document.querySelector('.close');
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.getElementById('editSaveBtn').addEventListener('click', saveEdit);
    document.getElementById('editCancelBtn').addEventListener('click', closeModal);
}

// ===== タブ切り替え =====
function handleTabClick(e) {
    // アクティブ状態を更新
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    e.target.classList.add('active');

    // タブコンテンツを表示
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const tabId = e.target.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');

    // 記録タブの場合は最新データを読み込む
    if (tabId === 'records') {
        loadRecordsTable();
    }
}

// ===== QR処理 =====
function handleQRInput(e) {
    const input = e.target.value.toUpperCase().trim();
    if (!input) {
        clearQRDisplay();
        return;
    }

    const vehicles = getVehicles();
    const vehicle = vehicles.find(v => v.number === input);

    if (vehicle) {
        displayVehicleInfo(vehicle);
        document.getElementById('entranceWeight').focus();
        updateEntranceButtonState();
    } else {
        showMessage('entranceMessage', '⚠️ この車両番号は登録されていません', 'error');
        clearQRDisplay();
    }
}

function displayVehicleInfo(vehicle) {
    document.getElementById('displayNumber').textContent = vehicle.number;
    document.getElementById('displayCompany').textContent = vehicle.company;
    document.getElementById('displayItem').textContent = vehicle.item;
}

function clearQRDisplay() {
    document.getElementById('displayNumber').textContent = '-';
    document.getElementById('displayCompany').textContent = '-';
    document.getElementById('displayItem').textContent = '-';
    document.getElementById('entranceWeight').value = '';
    updateEntranceButtonState();
}

// ===== 入場受付 =====
function registerEntry() {
    const qrInput = document.getElementById('qrInput');
    const vehicleNumber = qrInput.value.toUpperCase().trim();
    const weight = parseFloat(document.getElementById('entranceWeight').value);

    if (!vehicleNumber || weight <= 0) {
        showMessage('entranceMessage', '❌ 必須項目を入力してください', 'error');
        return;
    }

    const vehicles = getVehicles();
    const vehicle = vehicles.find(v => v.number === vehicleNumber);

    if (!vehicle) {
        showMessage('entranceMessage', '❌ 車両が見つかりません', 'error');
        return;
    }

    // 記録を追加
    const records = getRecords();
    const now = new Date();
    const today = formatDate(now);
    const time = formatTime(now);

    records.push({
        id: Date.now(),
        date: today,
        time: time,
        number: vehicle.number,
        company: vehicle.company,
        item: vehicle.item,
        weight: weight
    });

    saveRecords(records);
    showMessage('entranceMessage', '✅ 入場を登録しました', 'success');
    
    // フォームをクリア
    setTimeout(() => {
        clearEntryForm();
        loadRecordsTable();
    }, 1000);
}

function clearEntryForm() {
    document.getElementById('qrInput').value = '';
    document.getElementById('entranceWeight').value = '';
    clearQRDisplay();
    document.getElementById('entranceMessage').textContent = '';
    setDefaultTime();
}

function updateEntranceButtonState() {
    const btn = document.getElementById('entranceBtn');
    const vehicleNumber = document.getElementById('displayNumber').textContent;
    const weight = parseFloat(document.getElementById('entranceWeight').value);
    
    if (vehicleNumber !== '-' && weight > 0) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// ===== マスタ管理 =====
function registerMaster() {
    const number = document.getElementById('masterNumber').value.toUpperCase().trim();
    const company = document.getElementById('masterCompany').value.trim();
    const item = document.getElementById('masterItem').value;

    if (!number || !company || !item) {
        showMessage('masterMessage', '❌ すべての項目を入力してください', 'error');
        return;
    }

    const vehicles = getVehicles();
    
    // 更新か新規作成か判定
    const existingIndex = vehicles.findIndex(v => v.number === number);
    
    if (existingIndex >= 0) {
        // 更新
        vehicles[existingIndex] = {
            ...vehicles[existingIndex],
            company,
            item,
            updatedAt: new Date().toISOString()
        };
    } else {
        // 新規作成
        vehicles.push({
            id: Date.now(),
            number,
            company,
            item,
            createdAt: new Date().toISOString()
        });
    }

    saveVehicles(vehicles);
    showMessage('masterMessage', '✅ 車両情報を登録しました', 'success');
    clearMasterForm();
    loadVehiclesTable();
}

function clearMasterForm() {
    document.getElementById('masterNumber').value = '';
    document.getElementById('masterCompany').value = '';
    document.getElementById('masterItem').value = '';
    document.getElementById('masterMessage').textContent = '';
}

function loadVehiclesTable() {
    const vehicles = getVehicles();
    const tbody = document.querySelector('#masterTable tbody');

    if (vehicles.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4" style="text-align: center; color: #999;">登録データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = vehicles.map(v => `
        <tr>
            <td><strong>${v.number}</strong></td>
            <td>${v.company}</td>
            <td>${v.item}</td>
            <td>
                <button class="btn-edit" onclick="openEditModal('${v.id}')">編集</button>
                <button class="btn-danger" onclick="deleteVehicle('${v.id}')">削除</button>
            </td>
        </tr>
    `).join('');
}

// ===== 記録管理 =====
function loadRecordsTable() {
    const records = getRecords();
    const today = formatDate(new Date());
    const todayRecords = records.filter(r => r.date === today).reverse();

    const tbody = document.querySelector('#recordsTable tbody');

    if (todayRecords.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" style="text-align: center; color: #999;">本日の入場記録がありません</td></tr>';
        return;
    }

    tbody.innerHTML = todayRecords.map(r => `
        <tr>
            <td>${r.time}</td>
            <td><strong>${r.number}</strong></td>
            <td>${r.company}</td>
            <td>${r.item}</td>
            <td>${r.weight} t</td>
            <td>
                <button class="btn-danger" onclick="deleteRecord('${r.id}')">削除</button>
            </td>
        </tr>
    `).join('');
}

function deleteRecord(id) {
    if (!confirm('この記録を削除してもよろしいですか？')) return;
    
    let records = getRecords();
    records = records.filter(r => r.id !== parseInt(id));
    saveRecords(records);
    loadRecordsTable();
}

function clearRecords() {
    if (!confirm('本日の全記録を削除してもよろしいですか？')) return;
    
    const records = getRecords();
    const today = formatDate(new Date());
    const filteredRecords = records.filter(r => r.date !== today);
    saveRecords(filteredRecords);
    loadRecordsTable();
}

function exportCSV() {
    const records = getRecords();
    const today = formatDate(new Date());
    const todayRecords = records.filter(r => r.date === today);

    if (todayRecords.length === 0) {
        alert('エクスポートするデータがありません');
        return;
    }

    let csv = '時刻,ナンバー,業者名,品目,重量(t)\n';
    csv += todayRecords.map(r => {
        return `${r.time},${r.number},${r.company},${r.item},${r.weight}`;
    }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `scale_management_${today}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== 編集機能 =====
function openEditModal(id) {
    currentEditId = parseInt(id);
    const vehicles = getVehicles();
    const vehicle = vehicles.find(v => v.id === currentEditId);

    if (vehicle) {
        document.getElementById('editNumber').value = vehicle.number;
        document.getElementById('editCompany').value = vehicle.company;
        document.getElementById('editItem').value = vehicle.item;
        
        const modal = document.getElementById('editModal');
        modal.classList.add('show');
    }
}

function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('show');
    currentEditId = null;
}

function saveEdit() {
    const company = document.getElementById('editCompany').value.trim();
    const item = document.getElementById('editItem').value;

    if (!company || !item) {
        alert('業者名と品目を入力してください');
        return;
    }

    let vehicles = getVehicles();
    const index = vehicles.findIndex(v => v.id === currentEditId);

    if (index >= 0) {
        vehicles[index].company = company;
        vehicles[index].item = item;
        vehicles[index].updatedAt = new Date().toISOString();
        saveVehicles(vehicles);
        loadVehiclesTable();
        closeModal();
        alert('更新しました');
    }
}

function deleteVehicle(id) {
    if (!confirm('この車両を削除してもよろしいですか？')) return;
    
    let vehicles = getVehicles();
    vehicles = vehicles.filter(v => v.id !== parseInt(id));
    saveVehicles(vehicles);
    loadVehiclesTable();
}

// ===== ストレージ操作 =====
function getVehicles() {
    const data = localStorage.getItem(STORAGE_KEYS.vehicles);
    return data ? JSON.parse(data) : [];
}

function saveVehicles(vehicles) {
    localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(vehicles));
}

function getRecords() {
    const data = localStorage.getItem(STORAGE_KEYS.records);
    return data ? JSON.parse(data) : [];
}

function saveRecords(records) {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

// ===== ユーティリティ =====
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function setDefaultTime() {
    // QR入力にフォーカス
    document.getElementById('qrInput').focus();
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message show ${type}`;
    
    setTimeout(() => {
        element.classList.remove('show');
    }, 4000);
}
