/**
 * AI Tools Indonesia - Single Page Application
 * Full-featured client-side application
 */

// ============ STATE & CONFIG ============
const state = {
    user: null,
    currentPage: 'dashboard',
    board: Array(8).fill(null).map(() => Array(8).fill(0)),
    selectedPieces: [],
    notes: [],
    todos: [],
    links: [],
    stats: null
};

// ============ UTILITIES ============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showLoading() { document.getElementById('loading').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading').style.display = 'none'; }

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}


async function api(path, data = null) {
    const opts = { headers: { 'Content-Type': 'application/json' } };
    if (data) {
        opts.method = 'POST';
        opts.body = JSON.stringify(data);
    }
    const res = await fetch(path, opts);
    const json = await res.json();
    if (res.status === 401 && !path.includes('/login')) {
        state.user = null;
        render();
        return json;
    }
    return json;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============ ROUTER ============
function navigate(page) {
    state.currentPage = page;
    render();
    // Close mobile sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

// ============ AUTH ============
async function checkAuth() {
    const res = await api('/api/me');
    if (res.success) {
        state.user = res.user;
    }
    render();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        toast('Isi username dan password!', 'warning');
        return;
    }
    
    showLoading();
    const res = await api('/api/login', { username, password });
    hideLoading();
    
    if (res.success) {
        toast('Login berhasil! Selamat datang 👋', 'success');
        await checkAuth();
    } else {
        toast(res.message || 'Login gagal', 'error');
    }
}

async function handleLogout() {
    await api('/api/logout', {});
    state.user = null;
    toast('Berhasil logout', 'info');
    render();
}


// ============ RENDER FUNCTIONS ============

function renderLoginPage() {
    return `
    <div class="login-container">
        <div class="login-box">
            <h1>🤖 AI Tools Indonesia</h1>
            <p class="subtitle">Platform AI Multifungsi Terlengkap</p>
            <form onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="login-username" placeholder="Masukkan username" autocomplete="username">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="login-password" placeholder="Masukkan password" autocomplete="current-password">
                </div>
                <button type="submit" class="btn btn-primary">Masuk</button>
            </form>
            <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--border); text-align:center;">
                <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">Belum punya akun?</p>
                <p style="color:var(--text-secondary); font-size:13px; line-height:1.6;">
                    📱 Chat bot Telegram kami:<br>
                    <a href="https://t.me/aitoolsindonesia_bot" target="_blank" style="color:var(--secondary);">@aitoolsindonesia_bot</a><br><br>
                    Kirim <code style="background:var(--bg-input); padding:2px 6px; border-radius:4px;">/start</code> lalu<br>
                    <code style="background:var(--bg-input); padding:2px 6px; border-radius:4px;">/register username password</code>
                </p>
            </div>
        </div>
    </div>`;
}

function renderSidebar() {
    const tools = [
        { id: 'dashboard', icon: '📊', name: 'Dashboard' },
        { id: 'block-blast', icon: '🧩', name: 'Block Blast Solver' },
        { id: 'calculator', icon: '🔢', name: 'Kalkulator' },
        { id: 'notes', icon: '📝', name: 'Catatan' },
        { id: 'todos', icon: '✅', name: 'To Do List' },
        { id: 'qr-generator', icon: '📱', name: 'QR Generator' },
        { id: 'password-gen', icon: '🔐', name: 'Password Generator' },
        { id: 'word-counter', icon: '📄', name: 'Penghitung Kata' },
        { id: 'case-converter', icon: '🔤', name: 'Konversi Huruf' },
        { id: 'json-formatter', icon: '{ }', name: 'JSON Formatter' },
        { id: 'base64', icon: '🔄', name: 'Base64 Encode/Decode' },
        { id: 'hash-generator', icon: '#️⃣', name: 'Hash Generator' },
        { id: 'color-converter', icon: '🎨', name: 'Color Converter' },
        { id: 'link-shortener', icon: '🔗', name: 'Pemendek Link' },
        { id: 'lorem-ipsum', icon: '📜', name: 'Lorem Ipsum' },
        { id: 'unit-converter', icon: '📐', name: 'Konversi Unit' },
        { id: 'timestamp', icon: '🕐', name: 'Timestamp' },
        { id: 'text-diff', icon: '🔍', name: 'Bandingkan Teks' },
        { id: 'history', icon: '📋', name: 'Riwayat' },
    ];
    
    const initial = state.user ? state.user.username[0].toUpperCase() : '?';
    const status = state.user?.is_premium ? '⭐ Premium' : '🆓 Free';
    
    return `
    <div class="sidebar" id="sidebar">
        <div class="sidebar-logo">
            <h2>🤖 AI Tools ID</h2>
            <span>Platform AI Multifungsi</span>
        </div>
        <div class="nav-section">
            <div class="nav-section-title">Menu Utama</div>
            ${tools.slice(0, 2).map(t => `
                <div class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
                    <span class="icon">${t.icon}</span>${t.name}
                </div>
            `).join('')}
        </div>
        <div class="nav-section">
            <div class="nav-section-title">Produktivitas</div>
            ${tools.slice(2, 6).map(t => `
                <div class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
                    <span class="icon">${t.icon}</span>${t.name}
                </div>
            `).join('')}
        </div>
        <div class="nav-section">
            <div class="nav-section-title">Developer Tools</div>
            ${tools.slice(6, 17).map(t => `
                <div class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
                    <span class="icon">${t.icon}</span>${t.name}
                </div>
            `).join('')}
        </div>
        <div class="nav-section">
            <div class="nav-section-title">Lainnya</div>
            ${tools.slice(17).map(t => `
                <div class="nav-item ${state.currentPage === t.id ? 'active' : ''}" onclick="navigate('${t.id}')">
                    <span class="icon">${t.icon}</span>${t.name}
                </div>
            `).join('')}
        </div>
        <div class="user-menu">
            <div class="user-avatar">${initial}</div>
            <div class="user-info">
                <div class="name">${state.user?.username || 'User'}</div>
                <div class="status">${status}</div>
            </div>
            <div style="cursor:pointer;font-size:18px;" onclick="handleLogout()" title="Logout">🚪</div>
        </div>
    </div>`;
}


// ============ PAGE RENDERERS ============

function renderDashboard() {
    const usage = state.user?.daily_usage || 0;
    const limit = state.user?.daily_limit || 50;
    const pct = Math.min((usage / limit) * 100, 100);
    
    return `
    <div class="page-header">
        <h1>Selamat datang, ${state.user?.username}! 👋</h1>
        <p>Gunakan berbagai tools AI dan utilitas gratis.</p>
    </div>
    
    <div class="card-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); margin-bottom:24px;">
        <div class="stat-card">
            <div class="stat-icon purple">📊</div>
            <div class="stat-info">
                <h3>${usage}/${limit}</h3>
                <p>Penggunaan Hari Ini</p>
                <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue">🔧</div>
            <div class="stat-info">
                <h3>15+</h3>
                <p>Tools Tersedia</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green">⚡</div>
            <div class="stat-info">
                <h3>${state.user?.is_premium ? '∞' : 'Free'}</h3>
                <p>Status Akun</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow">🧩</div>
            <div class="stat-info">
                <h3>AI</h3>
                <p>Block Blast Solver</p>
            </div>
        </div>
    </div>
    
    <h2 style="font-size:18px; margin-bottom:16px;">🚀 Tools Populer</h2>
    <div class="card-grid">
        <div class="tool-card" onclick="navigate('block-blast')">
            <div class="tool-icon">🧩</div>
            <h3>Block Blast Solver AI</h3>
            <p>AI pintar yang mencari move terbaik di game Block Blast</p>
        </div>
        <div class="tool-card" onclick="navigate('calculator')">
            <div class="tool-icon">🔢</div>
            <h3>Kalkulator Modern</h3>
            <p>Kalkulator dengan dukungan operasi matematika lengkap</p>
        </div>
        <div class="tool-card" onclick="navigate('qr-generator')">
            <div class="tool-icon">📱</div>
            <h3>QR Code Generator</h3>
            <p>Buat QR code dari teks atau URL apapun secara instan</p>
        </div>
        <div class="tool-card" onclick="navigate('password-gen')">
            <div class="tool-icon">🔐</div>
            <h3>Password Generator</h3>
            <p>Generate password kuat dan aman secara acak</p>
        </div>
        <div class="tool-card" onclick="navigate('notes')">
            <div class="tool-icon">📝</div>
            <h3>Catatan Online</h3>
            <p>Simpan catatan dan ide kamu dengan aman di cloud</p>
        </div>
        <div class="tool-card" onclick="navigate('json-formatter')">
            <div class="tool-icon">{ }</div>
            <h3>JSON Formatter</h3>
            <p>Format dan validasi JSON dengan tampilan rapi</p>
        </div>
    </div>`;
}

function renderBlockBlast() {
    const pieces = Object.keys(BlockBlastPieces);
    
    return `
    <div class="page-header">
        <h1>🧩 Block Blast Solver AI</h1>
        <p>Upload screenshot atau klik cell manual, pilih pieces, lalu Solve!</p>
    </div>
    
    <!-- Upload Section -->
    <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:12px;">📸 Upload Screenshot (Opsional)</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Upload screenshot Block Blast dari HP kamu, AI akan otomatis deteksi board.</p>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label class="btn btn-secondary" style="cursor:pointer;">
                📷 Pilih Gambar
                <input type="file" id="bb-image-input" accept="image/*" onchange="analyzeBlockBlastImage(event)" style="display:none;">
            </label>
            <span id="bb-upload-status" style="font-size:12px; color:var(--text-muted);"></span>
        </div>
        <div id="bb-image-preview" style="margin-top:12px;"></div>
    </div>
    
    <div class="bb-layout" style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; align-items:start;">
        <div class="card">
            <h3 style="margin-bottom:12px;">Board 8x8</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Klik cell untuk toggle filled/empty</p>
            <div class="bb-board" id="bb-board">
                ${state.board.map((row, r) => 
                    row.map((cell, c) => 
                        `<div class="bb-cell ${cell ? 'filled' : 'empty'}" onclick="toggleCell(${r},${c})"></div>`
                    ).join('')
                ).join('')}
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="clearBoard()">🗑️ Reset Board</button>
                <button class="btn btn-secondary btn-sm" onclick="randomBoard()">🎲 Random</button>
            </div>
        </div>
        
        <div class="card">
            <h3 style="margin-bottom:12px;">Pilih Pieces (maks 3)</h3>
            <div class="pieces-grid">
                ${pieces.map(p => `
                    <div class="piece-option ${state.selectedPieces.includes(p) ? 'selected' : ''}" 
                         onclick="togglePiece('${p}')">
                        ${p.replace(/_/g, ' ')}
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:16px;">
                <p style="font-size:12px; color:var(--text-muted);">Selected: ${state.selectedPieces.join(', ') || 'Belum ada'}</p>
            </div>
            <button class="btn btn-primary" style="margin-top:16px;" onclick="solveBlockBlast()">
                🧠 Solve dengan AI
            </button>
            <div id="bb-result" style="margin-top:16px;"></div>
        </div>
    </div>`;
}


function renderCalculator() {
    return `
    <div class="page-header">
        <h1>🔢 Kalkulator Modern</h1>
        <p>Hitung ekspresi matematika dengan mudah</p>
    </div>
    <div class="card" style="max-width:500px;">
        <input type="text" class="form-input" id="calc-input" placeholder="Contoh: (5 + 3) * 2 - 1" 
               onkeypress="if(event.key==='Enter')calculate()" style="font-size:20px; text-align:right; margin-bottom:16px;">
        <div id="calc-result" style="font-size:32px; font-weight:700; text-align:right; color:var(--primary-light); min-height:40px;"></div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:20px;">
            ${['7','8','9','/','4','5','6','*','1','2','3','-','0','.','(',')','+','%','C','='].map(btn => {
                let cls = 'btn btn-secondary';
                if (btn === '=') cls = 'btn btn-primary';
                if (btn === 'C') cls = 'btn btn-danger';
                let onclick = `calcBtn('${btn}')`;
                if (btn === '=') onclick = 'calculate()';
                if (btn === 'C') onclick = 'clearCalc()';
                return `<button class="${cls}" onclick="${onclick}">${btn}</button>`;
            }).join('')}
        </div>
    </div>`;
}

function renderNotes() {
    return `
    <div class="page-header">
        <h1>📝 Catatan Online</h1>
        <p>Simpan ide dan catatan penting kamu</p>
    </div>
    <div class="card" style="margin-bottom:16px;">
        <input type="text" class="form-input" id="note-title" placeholder="Judul catatan" style="margin-bottom:12px;">
        <textarea id="note-content" placeholder="Tulis catatan kamu di sini..."></textarea>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="saveNote()">💾 Simpan Catatan</button>
    </div>
    <div id="notes-list">
        ${state.notes.map(n => `
            <div class="card" style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:15px;">${n.title}</h3>
                    <button class="btn btn-danger btn-sm" onclick="deleteNote(${n.id})">🗑️</button>
                </div>
                <p style="font-size:13px; color:var(--text-secondary); margin-top:8px; white-space:pre-wrap;">${n.content || ''}</p>
                <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">${formatDate(n.updated_at)}</p>
            </div>
        `).join('')}
    </div>`;
}

function renderTodos() {
    return `
    <div class="page-header">
        <h1>✅ To Do List</h1>
        <p>Kelola tugas dan aktivitas harian kamu</p>
    </div>
    <div class="card">
        <div style="display:flex; gap:8px; margin-bottom:20px;">
            <input type="text" class="form-input" id="todo-input" placeholder="Tambah tugas baru..." 
                   onkeypress="if(event.key==='Enter')addTodo()">
            <button class="btn btn-primary" onclick="addTodo()">+ Tambah</button>
        </div>
        <div id="todos-list">
            ${state.todos.map(t => `
                <div class="todo-item ${t.completed ? 'completed' : ''}">
                    <div class="todo-check ${t.completed ? 'checked' : ''}" onclick="toggleTodo(${t.id})">
                        ${t.completed ? '✓' : ''}
                    </div>
                    <span class="todo-text">${t.task}</span>
                    <span class="todo-delete" onclick="deleteTodo(${t.id})">×</span>
                </div>
            `).join('')}
            ${state.todos.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada tugas. Tambahkan sekarang!</p>' : ''}
        </div>
    </div>`;
}


function renderQRGenerator() {
    return `
    <div class="page-header">
        <h1>📱 QR Code Generator</h1>
        <p>Buat QR code dari teks atau URL apapun</p>
    </div>
    <div class="card" style="max-width:600px;">
        <textarea id="qr-text" placeholder="Masukkan teks atau URL..." style="min-height:80px;"></textarea>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="generateQR()">📱 Generate QR Code</button>
        <div id="qr-result" style="margin-top:20px; text-align:center;"></div>
    </div>`;
}

function renderPasswordGen() {
    return `
    <div class="page-header">
        <h1>🔐 Password Generator</h1>
        <p>Generate password yang kuat dan aman</p>
    </div>
    <div class="card" style="max-width:600px;">
        <div id="pw-result" style="font-family:monospace; font-size:20px; padding:16px; background:var(--bg-dark); border-radius:8px; text-align:center; margin-bottom:20px; word-break:break-all; min-height:60px; display:flex; align-items:center; justify-content:center; color:var(--success);">
            Klik Generate untuk membuat password
        </div>
        <div class="form-group">
            <label>Panjang Password: <span id="pw-length-val">16</span></label>
            <input type="range" id="pw-length" min="4" max="64" value="16" oninput="document.getElementById('pw-length-val').textContent=this.value" style="width:100%;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="pw-upper" checked> Huruf Besar (A-Z)
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="pw-lower" checked> Huruf Kecil (a-z)
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="pw-digits" checked> Angka (0-9)
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="pw-symbols" checked> Simbol (!@#$%)
            </label>
        </div>
        <button class="btn btn-primary" onclick="generatePassword()">🔐 Generate Password</button>
    </div>`;
}

function renderWordCounter() {
    return `
    <div class="page-header">
        <h1>📄 Penghitung Kata</h1>
        <p>Hitung jumlah kata, karakter, dan kalimat</p>
    </div>
    <div class="card" style="max-width:700px;">
        <textarea id="wc-text" placeholder="Tempel atau ketik teks di sini..." style="min-height:200px;" oninput="countWords()"></textarea>
        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; margin-top:16px;" id="wc-result">
            <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
                <div style="font-size:24px; font-weight:700; color:var(--primary-light);">0</div>
                <div style="font-size:11px; color:var(--text-muted);">Kata</div>
            </div>
            <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
                <div style="font-size:24px; font-weight:700; color:var(--secondary);">0</div>
                <div style="font-size:11px; color:var(--text-muted);">Karakter</div>
            </div>
            <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
                <div style="font-size:24px; font-weight:700; color:var(--success);">0</div>
                <div style="font-size:11px; color:var(--text-muted);">Kalimat</div>
            </div>
            <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
                <div style="font-size:24px; font-weight:700; color:var(--accent);">0</div>
                <div style="font-size:11px; color:var(--text-muted);">Paragraf</div>
            </div>
        </div>
    </div>`;
}


function renderCaseConverter() {
    return `
    <div class="page-header">
        <h1>🔤 Konversi Huruf</h1>
        <p>Ubah format huruf teks dengan cepat</p>
    </div>
    <div class="card" style="max-width:700px;">
        <textarea id="case-input" placeholder="Masukkan teks yang ingin dikonversi..." style="min-height:120px;"></textarea>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
            <button class="btn btn-secondary btn-sm" onclick="convertCase('upper')">HURUF BESAR</button>
            <button class="btn btn-secondary btn-sm" onclick="convertCase('lower')">huruf kecil</button>
            <button class="btn btn-secondary btn-sm" onclick="convertCase('title')">Huruf Judul</button>
            <button class="btn btn-secondary btn-sm" onclick="convertCase('sentence')">Huruf kalimat</button>
            <button class="btn btn-secondary btn-sm" onclick="convertCase('reverse')">🔄 Balik</button>
        </div>
        <div class="result-box" id="case-result" style="display:none;"></div>
    </div>`;
}

function renderJsonFormatter() {
    return `
    <div class="page-header">
        <h1>{ } JSON Formatter</h1>
        <p>Format, validasi, dan rapikan JSON</p>
    </div>
    <div class="card" style="max-width:800px;">
        <textarea id="json-input" placeholder='Tempel JSON di sini, contoh: {"name":"AI Tools","version":1}' style="min-height:200px; font-family:monospace;"></textarea>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="formatJson()">✨ Format JSON</button>
        <div class="result-box" id="json-result" style="display:none;"></div>
    </div>`;
}

function renderBase64() {
    return `
    <div class="page-header">
        <h1>🔄 Base64 Encode / Decode</h1>
        <p>Encode atau decode teks ke/dari Base64</p>
    </div>
    <div class="card" style="max-width:700px;">
        <textarea id="b64-input" placeholder="Masukkan teks..." style="min-height:120px;"></textarea>
        <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-primary" onclick="base64Action('encode')">🔒 Encode</button>
            <button class="btn btn-secondary" onclick="base64Action('decode')">🔓 Decode</button>
        </div>
        <div class="result-box" id="b64-result" style="display:none;"></div>
    </div>`;
}

function renderHashGenerator() {
    return `
    <div class="page-header">
        <h1>#️⃣ Hash Generator</h1>
        <p>Generate hash MD5, SHA-1, SHA-256, SHA-512</p>
    </div>
    <div class="card" style="max-width:700px;">
        <textarea id="hash-input" placeholder="Masukkan teks untuk di-hash..." style="min-height:80px;"></textarea>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="generateHash()">🔐 Generate Hash</button>
        <div id="hash-result" style="margin-top:16px;"></div>
    </div>`;
}

function renderColorConverter() {
    return `
    <div class="page-header">
        <h1>🎨 Color Converter</h1>
        <p>Konversi warna antara HEX, RGB, dan HSL</p>
    </div>
    <div class="card" style="max-width:600px;">
        <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
            <input type="color" id="color-picker" value="#6366f1" onchange="convertColor()" style="width:80px; height:60px; border:none; cursor:pointer; border-radius:8px;">
            <input type="text" class="form-input" id="color-hex" value="#6366f1" placeholder="#000000" style="flex:1;" onchange="convertColor()">
        </div>
        <button class="btn btn-primary" onclick="convertColor()">🎨 Konversi</button>
        <div id="color-result" style="margin-top:16px;"></div>
    </div>`;
}


function renderLinkShortener() {
    return `
    <div class="page-header">
        <h1>🔗 Pemendek Link</h1>
        <p>Pendekkan URL panjang menjadi link singkat</p>
    </div>
    <div class="card" style="max-width:600px;">
        <input type="url" class="form-input" id="link-input" placeholder="https://contoh.com/url-panjang-sekali...">
        <button class="btn btn-primary" style="margin-top:12px;" onclick="shortenLink()">✂️ Pendekkan Link</button>
        <div id="link-result" style="margin-top:16px;"></div>
    </div>
    <div class="card" style="margin-top:16px;">
        <h3 style="margin-bottom:12px;">Link Tersimpan</h3>
        ${state.links.map(l => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:13px;">
                <div>
                    <div style="color:var(--primary-light);">${window.location.origin}/s/${l.short_code}</div>
                    <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${l.original_url.substring(0,50)}...</div>
                </div>
                <span class="badge badge-free">${l.clicks} klik</span>
            </div>
        `).join('')}
        ${state.links.length === 0 ? '<p style="color:var(--text-muted); text-align:center; padding:16px;">Belum ada link</p>' : ''}
    </div>`;
}

function renderLoremIpsum() {
    return `
    <div class="page-header">
        <h1>📜 Lorem Ipsum Generator</h1>
        <p>Generate teks placeholder untuk desain dan development</p>
    </div>
    <div class="card" style="max-width:700px;">
        <div class="form-group">
            <label>Jumlah Paragraf</label>
            <input type="number" class="form-input" id="lorem-count" value="3" min="1" max="10">
        </div>
        <button class="btn btn-primary" onclick="generateLorem()">📜 Generate</button>
        <div class="result-box" id="lorem-result" style="display:none;"></div>
    </div>`;
}

function renderUnitConverter() {
    return `
    <div class="page-header">
        <h1>📐 Konversi Unit</h1>
        <p>Konversi berbagai satuan ukuran dengan mudah</p>
    </div>
    <div class="card" style="max-width:600px;">
        <div class="form-group">
            <label>Kategori</label>
            <select class="form-input" id="uc-category" onchange="updateUnitOptions()">
                <option value="length">Panjang</option>
                <option value="weight">Berat</option>
                <option value="temperature">Suhu</option>
                <option value="data">Data Digital</option>
                <option value="time">Waktu</option>
            </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:12px; align-items:end;">
            <div class="form-group" style="margin:0;">
                <label>Dari</label>
                <input type="number" class="form-input" id="uc-value" value="1" step="any">
            </div>
            <div style="padding-bottom:12px; font-size:20px; color:var(--text-muted);">→</div>
            <div class="form-group" style="margin:0;">
                <label>Hasil</label>
                <div id="uc-result" style="font-size:20px; font-weight:700; color:var(--primary-light); min-height:40px; display:flex; align-items:center;">-</div>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
            <select class="form-input" id="uc-from"></select>
            <select class="form-input" id="uc-to"></select>
        </div>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="convertUnit()">📐 Konversi</button>
    </div>`;
}

function renderTimestamp() {
    return `
    <div class="page-header">
        <h1>🕐 Timestamp Converter</h1>
        <p>Konversi antara Unix timestamp dan tanggal</p>
    </div>
    <div class="card" style="max-width:600px;">
        <button class="btn btn-primary" onclick="getTimestampNow()" style="margin-bottom:16px;">🕐 Timestamp Sekarang</button>
        <div id="ts-now-result"></div>
        
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
            <h3 style="font-size:15px; margin-bottom:12px;">Timestamp → Tanggal</h3>
            <div style="display:flex; gap:8px;">
                <input type="number" class="form-input" id="ts-input" placeholder="Contoh: 1700000000">
                <button class="btn btn-secondary" onclick="timestampToDate()">Konversi</button>
            </div>
            <div id="ts-to-date-result" style="margin-top:8px;"></div>
        </div>
        
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
            <h3 style="font-size:15px; margin-bottom:12px;">Tanggal → Timestamp</h3>
            <div style="display:flex; gap:8px;">
                <input type="datetime-local" class="form-input" id="ts-date-input">
                <button class="btn btn-secondary" onclick="dateToTimestamp()">Konversi</button>
            </div>
            <div id="ts-to-ts-result" style="margin-top:8px;"></div>
        </div>
    </div>`;
}

function renderTextDiff() {
    return `
    <div class="page-header">
        <h1>🔍 Bandingkan Teks</h1>
        <p>Temukan perbedaan antara dua teks</p>
    </div>
    <div class="card">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div>
                <label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">Teks Asli</label>
                <textarea id="diff-text1" placeholder="Masukkan teks pertama..." style="min-height:200px;"></textarea>
            </div>
            <div>
                <label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">Teks Baru</label>
                <textarea id="diff-text2" placeholder="Masukkan teks kedua..." style="min-height:200px;"></textarea>
            </div>
        </div>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="compareTexts()">🔍 Bandingkan</button>
        <div id="diff-result" style="margin-top:16px;"></div>
    </div>`;
}

function renderHistory() {
    return `
    <div class="page-header">
        <h1>📋 Riwayat Penggunaan</h1>
        <p>Lihat semua aktivitas penggunaan tools kamu</p>
    </div>
    <div class="card">
        <div id="history-content">
            <p style="text-align:center; color:var(--text-muted); padding:20px;">Memuat riwayat...</p>
        </div>
    </div>`;
}

// ============ PAGE CONTENT ROUTER ============
function getPageContent() {
    switch(state.currentPage) {
        case 'dashboard': return renderDashboard();
        case 'block-blast': return renderBlockBlast();
        case 'calculator': return renderCalculator();
        case 'notes': return renderNotes();
        case 'todos': return renderTodos();
        case 'qr-generator': return renderQRGenerator();
        case 'password-gen': return renderPasswordGen();
        case 'word-counter': return renderWordCounter();
        case 'case-converter': return renderCaseConverter();
        case 'json-formatter': return renderJsonFormatter();
        case 'base64': return renderBase64();
        case 'hash-generator': return renderHashGenerator();
        case 'color-converter': return renderColorConverter();
        case 'link-shortener': return renderLinkShortener();
        case 'lorem-ipsum': return renderLoremIpsum();
        case 'unit-converter': return renderUnitConverter();
        case 'timestamp': return renderTimestamp();
        case 'text-diff': return renderTextDiff();
        case 'history': return renderHistory();
        default: return renderDashboard();
    }
}


// ============ MAIN RENDER ============
function render() {
    const app = document.getElementById('app');
    
    if (!state.user) {
        app.innerHTML = renderLoginPage();
        return;
    }
    
    app.innerHTML = `
        <div class="mobile-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</div>
        ${renderSidebar()}
        <div class="main-content">
            ${getPageContent()}
        </div>
    `;
    
    // Post-render actions
    if (state.currentPage === 'history') loadHistory();
    if (state.currentPage === 'notes') loadNotes();
    if (state.currentPage === 'todos') loadTodos();
    if (state.currentPage === 'link-shortener') loadLinks();
    if (state.currentPage === 'unit-converter') setTimeout(updateUnitOptions, 50);
}

// ============ BLOCK BLAST LOGIC ============
const BlockBlastPieces = {
    'single': [[0,0]],
    'h2': [[0,0],[0,1]],
    'h3': [[0,0],[0,1],[0,2]],
    'h4': [[0,0],[0,1],[0,2],[0,3]],
    'h5': [[0,0],[0,1],[0,2],[0,3],[0,4]],
    'v2': [[0,0],[1,0]],
    'v3': [[0,0],[1,0],[2,0]],
    'v4': [[0,0],[1,0],[2,0],[3,0]],
    'v5': [[0,0],[1,0],[2,0],[3,0],[4,0]],
    'square2': [[0,0],[0,1],[1,0],[1,1]],
    'square3': [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
    'l_shape': [[0,0],[1,0],[2,0],[2,1]],
    'l_shape_r': [[0,0],[1,0],[2,0],[2,-1]],
    'l_shape_u': [[0,0],[0,1],[0,2],[1,0]],
    'l_shape_d': [[0,0],[0,1],[0,2],[1,2]],
    't_shape': [[0,0],[0,1],[0,2],[1,1]],
    'z_shape': [[0,0],[0,1],[1,1],[1,2]],
    's_shape': [[0,1],[0,2],[1,0],[1,1]],
};

function toggleCell(r, c) {
    state.board[r][c] = state.board[r][c] ? 0 : 1;
    render();
}

function clearBoard() {
    state.board = Array(8).fill(null).map(() => Array(8).fill(0));
    state.selectedPieces = [];
    render();
}

function randomBoard() {
    state.board = Array(8).fill(null).map(() => 
        Array(8).fill(0).map(() => Math.random() > 0.6 ? 1 : 0)
    );
    render();
}

function togglePiece(piece) {
    const idx = state.selectedPieces.indexOf(piece);
    if (idx >= 0) {
        state.selectedPieces.splice(idx, 1);
    } else if (state.selectedPieces.length < 3) {
        state.selectedPieces.push(piece);
    } else {
        toast('Maksimal 3 pieces!', 'warning');
        return;
    }
    render();
}

async function solveBlockBlast() {
    if (state.selectedPieces.length === 0) {
        toast('Pilih minimal 1 piece!', 'warning');
        return;
    }
    
    showLoading();
    const res = await api('/api/tools/block-blast', {
        board: state.board,
        pieces: state.selectedPieces
    });
    hideLoading();
    
    if (res.success) {
        const resultDiv = document.getElementById('bb-result');
        let html = '<div style="background:var(--bg-dark); border-radius:8px; padding:16px;">';
        html += '<h4 style="color:var(--success); margin-bottom:12px;">✅ Solusi Ditemukan!</h4>';
        res.moves.forEach((m, i) => {
            html += `<div style="padding:8px 0; border-bottom:1px solid var(--border);">
                <span style="color:var(--primary-light);">Move ${i+1}:</span> 
                Letakkan <b>${m.piece}</b> di posisi (${m.row}, ${m.col})
                ${m.lines_cleared > 0 ? `<span style="color:var(--success);">+${m.lines_cleared} baris clear!</span>` : ''}
            </div>`;
        });
        html += `<p style="margin-top:12px; color:var(--accent);">Total Score: ${res.total_score}</p>`;
        html += '</div>';
        resultDiv.innerHTML = html;
        
        // Highlight moves on board
        highlightMoves(res.moves);
        toast('Solusi berhasil ditemukan!', 'success');
    } else {
        toast(res.message || 'Tidak ada solusi', 'error');
    }
}

function highlightMoves(moves) {
    const cells = document.querySelectorAll('.bb-cell');
    moves.forEach(m => {
        const piece = BlockBlastPieces[m.piece] || [[0,0]];
        piece.forEach(([dr, dc]) => {
            const r = m.row + dr;
            const c = m.col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const idx = r * 8 + c;
                if (cells[idx]) cells[idx].classList.add('highlight');
            }
        });
    });
}

// Image Upload & Analysis
async function analyzeBlockBlastImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById('bb-upload-status');
    const previewEl = document.getElementById('bb-image-preview');
    
    statusEl.textContent = 'Menganalisis gambar...';
    statusEl.style.color = 'var(--accent)';
    
    // Show preview
    const reader = new FileReader();
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        
        previewEl.innerHTML = `
            <img src="${dataUrl}" style="max-width:200px; max-height:150px; border-radius:8px; border:1px solid var(--border);">
        `;
        
        // Send to API
        showLoading();
        const res = await api('/api/tools/block-blast-analyze', { image: dataUrl });
        hideLoading();
        
        if (res.success) {
            // Update board state
            state.board = res.board;
            if (res.pieces && res.pieces.length > 0) {
                state.selectedPieces = res.pieces;
            }
            
            statusEl.innerHTML = `<span style="color:var(--success);">✅ Board terdeteksi! ${res.filled_count} cell terisi, ${res.empty_count} kosong.</span>`;
            if (res.note) {
                statusEl.innerHTML += `<br><span style="font-size:11px; color:var(--text-muted);">${res.note}</span>`;
            }
            
            toast('Screenshot berhasil dianalisis!', 'success');
            render();
        } else {
            statusEl.innerHTML = `<span style="color:var(--danger);">❌ ${res.message}</span>`;
            toast('Gagal analisis gambar', 'error');
        }
    };
    reader.readAsDataURL(file);
}


// ============ TOOL ACTIONS ============

// Calculator
function calcBtn(val) {
    const input = document.getElementById('calc-input');
    input.value += val;
}
function clearCalc() {
    document.getElementById('calc-input').value = '';
    document.getElementById('calc-result').textContent = '';
}
async function calculate() {
    const expr = document.getElementById('calc-input').value;
    if (!expr) return;
    const res = await api('/api/tools/calculator', { expression: expr });
    if (res.result !== undefined) {
        document.getElementById('calc-result').textContent = '= ' + res.result;
    } else {
        toast(res.error || 'Error', 'error');
    }
}

// Notes
async function loadNotes() {
    const res = await api('/api/notes');
    if (res.success) {
        state.notes = res.notes;
        const list = document.getElementById('notes-list');
        if (list) {
            list.innerHTML = state.notes.map(n => `
                <div class="card" style="margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="font-size:15px;">${n.title}</h3>
                        <button class="btn btn-danger btn-sm" onclick="deleteNote(${n.id})">🗑️</button>
                    </div>
                    <p style="font-size:13px; color:var(--text-secondary); margin-top:8px; white-space:pre-wrap;">${n.content || ''}</p>
                    <p style="font-size:11px; color:var(--text-muted); margin-top:8px;">${formatDate(n.updated_at)}</p>
                </div>
            `).join('');
        }
    }
}
async function saveNote() {
    const title = document.getElementById('note-title').value.trim() || 'Tanpa Judul';
    const content = document.getElementById('note-content').value;
    if (!content) { toast('Isi catatan dulu!', 'warning'); return; }
    const res = await api('/api/notes', { title, content });
    if (res.success) {
        toast('Catatan disimpan!', 'success');
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
        loadNotes();
    }
}
async function deleteNote(id) {
    const res = await api('/api/notes/delete', { id });
    if (res.success) { toast('Catatan dihapus', 'info'); loadNotes(); }
}

// Todos
async function loadTodos() {
    const res = await api('/api/todos');
    if (res.success) {
        state.todos = res.todos;
        const list = document.getElementById('todos-list');
        if (list) {
            list.innerHTML = state.todos.map(t => `
                <div class="todo-item ${t.completed ? 'completed' : ''}">
                    <div class="todo-check ${t.completed ? 'checked' : ''}" onclick="toggleTodo(${t.id})">
                        ${t.completed ? '✓' : ''}
                    </div>
                    <span class="todo-text">${t.task}</span>
                    <span class="todo-delete" onclick="deleteTodo(${t.id})">×</span>
                </div>
            `).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada tugas.</p>';
        }
    }
}
async function addTodo() {
    const input = document.getElementById('todo-input');
    const task = input.value.trim();
    if (!task) return;
    const res = await api('/api/todos', { task });
    if (res.success) { input.value = ''; toast('Tugas ditambahkan!', 'success'); loadTodos(); }
}
async function toggleTodo(id) {
    await api('/api/todos/toggle', { id });
    loadTodos();
}
async function deleteTodo(id) {
    await api('/api/todos/delete', { id });
    toast('Tugas dihapus', 'info');
    loadTodos();
}


// QR Generator
async function generateQR() {
    const text = document.getElementById('qr-text').value.trim();
    if (!text) { toast('Masukkan teks atau URL!', 'warning'); return; }
    showLoading();
    const res = await api('/api/tools/qr-generate', { text });
    hideLoading();
    if (res.success) {
        document.getElementById('qr-result').innerHTML = `
            <div style="background:white; display:inline-block; padding:16px; border-radius:12px;">
                ${res.svg}
            </div>
            <p style="margin-top:12px; color:var(--text-muted); font-size:12px;">QR Code berhasil dibuat!</p>
        `;
        toast('QR Code berhasil dibuat!', 'success');
    }
}

// Password Generator
async function generatePassword() {
    const length = parseInt(document.getElementById('pw-length').value);
    const uppercase = document.getElementById('pw-upper').checked;
    const lowercase = document.getElementById('pw-lower').checked;
    const digits = document.getElementById('pw-digits').checked;
    const symbols = document.getElementById('pw-symbols').checked;
    
    const res = await api('/api/tools/password-generator', { length, uppercase, lowercase, digits, symbols });
    if (res.success) {
        document.getElementById('pw-result').innerHTML = `
            <div style="margin-bottom:8px;">${res.password}</div>
            <div style="font-size:12px; color:var(--text-muted);">Kekuatan: <span style="color:${res.strength === 'Sangat Kuat' ? 'var(--success)' : res.strength === 'Kuat' ? 'var(--primary-light)' : 'var(--warning)'};">${res.strength}</span></div>
        `;
        toast('Password berhasil di-generate!', 'success');
    }
}

// Word Counter (client-side)
function countWords() {
    const text = document.getElementById('wc-text').value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
    const paragraphs = text.split(/\n+/).filter(p => p.trim()).length;
    
    document.getElementById('wc-result').innerHTML = `
        <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
            <div style="font-size:24px; font-weight:700; color:var(--primary-light);">${words}</div>
            <div style="font-size:11px; color:var(--text-muted);">Kata</div>
        </div>
        <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
            <div style="font-size:24px; font-weight:700; color:var(--secondary);">${chars}</div>
            <div style="font-size:11px; color:var(--text-muted);">Karakter</div>
        </div>
        <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
            <div style="font-size:24px; font-weight:700; color:var(--success);">${sentences}</div>
            <div style="font-size:11px; color:var(--text-muted);">Kalimat</div>
        </div>
        <div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
            <div style="font-size:24px; font-weight:700; color:var(--accent);">${paragraphs}</div>
            <div style="font-size:11px; color:var(--text-muted);">Paragraf</div>
        </div>
    `;
}

// Case Converter
async function convertCase(mode) {
    const text = document.getElementById('case-input').value;
    if (!text) { toast('Masukkan teks dulu!', 'warning'); return; }
    const res = await api('/api/tools/case-converter', { text, mode });
    if (res.success) {
        const el = document.getElementById('case-result');
        el.style.display = 'block';
        el.textContent = res.result;
        toast('Teks berhasil dikonversi!', 'success');
    }
}


// JSON Formatter
async function formatJson() {
    const text = document.getElementById('json-input').value;
    if (!text) { toast('Masukkan JSON!', 'warning'); return; }
    const res = await api('/api/tools/json-formatter', { text });
    const el = document.getElementById('json-result');
    el.style.display = 'block';
    if (res.success) {
        el.textContent = res.result;
        el.style.color = 'var(--success)';
        toast('JSON berhasil diformat!', 'success');
    } else {
        el.textContent = res.message;
        el.style.color = 'var(--danger)';
        toast('JSON tidak valid!', 'error');
    }
}

// Base64
async function base64Action(mode) {
    const text = document.getElementById('b64-input').value;
    if (!text) { toast('Masukkan teks!', 'warning'); return; }
    const res = await api('/api/tools/base64', { text, mode });
    const el = document.getElementById('b64-result');
    el.style.display = 'block';
    if (res.success) {
        el.textContent = res.result;
        toast(`${mode === 'encode' ? 'Encode' : 'Decode'} berhasil!`, 'success');
    } else {
        el.textContent = res.message;
        toast('Gagal!', 'error');
    }
}

// Hash Generator
async function generateHash() {
    const text = document.getElementById('hash-input').value;
    if (!text) { toast('Masukkan teks!', 'warning'); return; }
    showLoading();
    const res = await api('/api/tools/hash-generator', { text });
    hideLoading();
    if (res.success) {
        document.getElementById('hash-result').innerHTML = Object.entries(res.hashes).map(([alg, hash]) => `
            <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${alg}</label>
                <div class="result-box" style="margin-top:4px; font-size:12px; padding:10px;">${hash}</div>
            </div>
        `).join('');
        toast('Hash berhasil di-generate!', 'success');
    }
}

// Color Converter
async function convertColor() {
    const hex = document.getElementById('color-hex').value || document.getElementById('color-picker').value;
    const res = await api('/api/tools/color-converter', { color: hex });
    if (res.success) {
        document.getElementById('color-result').innerHTML = `
            <div style="display:grid; gap:12px; margin-top:12px;">
                <div style="width:100%; height:80px; background:${res.hex}; border-radius:12px; border:1px solid var(--border);"></div>
                <div class="result-box" style="margin-top:0;"><b>HEX:</b> ${res.hex}\n<b>RGB:</b> ${res.rgb}\n<b>HSL:</b> ${res.hsl}</div>
            </div>
        `;
    }
}

// Link Shortener
async function loadLinks() {
    const res = await api('/api/links');
    if (res.success) state.links = res.links;
}
async function shortenLink() {
    const url = document.getElementById('link-input').value.trim();
    if (!url || !url.startsWith('http')) { toast('Masukkan URL yang valid!', 'warning'); return; }
    const res = await api('/api/tools/shorten-link', { url });
    if (res.success) {
        document.getElementById('link-result').innerHTML = `
            <div style="background:var(--bg-dark); padding:16px; border-radius:8px;">
                <p style="color:var(--text-muted); font-size:12px;">Link pendek kamu:</p>
                <p style="font-size:18px; color:var(--primary-light); margin-top:4px;">${window.location.origin}${res.short_url}</p>
            </div>
        `;
        toast('Link berhasil dipendekkan!', 'success');
        document.getElementById('link-input').value = '';
        loadLinks();
    }
}

// Lorem Ipsum
async function generateLorem() {
    const count = parseInt(document.getElementById('lorem-count').value) || 3;
    const res = await api('/api/tools/lorem-ipsum', { paragraphs: count });
    if (res.success) {
        const el = document.getElementById('lorem-result');
        el.style.display = 'block';
        el.textContent = res.text;
        toast('Lorem Ipsum berhasil di-generate!', 'success');
    }
}


// History
async function loadHistory() {
    const res = await api('/api/stats');
    if (res.success) {
        const el = document.getElementById('history-content');
        if (!el) return;
        
        let html = '';
        
        if (res.tool_stats && res.tool_stats.length > 0) {
            html += '<h3 style="margin-bottom:12px; font-size:15px;">📊 Statistik Tools</h3>';
            html += '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; margin-bottom:24px;">';
            res.tool_stats.forEach(ts => {
                html += `<div class="stat-card" style="flex-direction:column; text-align:center; padding:12px;">
                    <div style="font-size:20px; font-weight:700; color:var(--primary-light);">${ts.cnt}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${ts.tool_name}</div>
                </div>`;
            });
            html += '</div>';
        }
        
        html += '<h3 style="margin-bottom:12px; font-size:15px;">🕐 Aktivitas Terakhir</h3>';
        if (res.recent && res.recent.length > 0) {
            html += '<ul class="history-list">';
            res.recent.forEach(r => {
                html += `<li class="history-item">
                    <span class="time">${formatDate(r.created_at)}</span>
                    <span class="tool-name">${r.tool_name}</span>
                </li>`;
            });
            html += '</ul>';
        } else {
            html += '<p style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada riwayat penggunaan</p>';
        }
        
        html += `<div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
            <p style="font-size:13px; color:var(--text-secondary);">
                Total penggunaan: <b>${res.total_usage}</b> | Hari ini: <b>${res.today_usage}</b> | Batas harian: <b>${res.daily_limit}</b>
            </p>
        </div>`;
        
        el.innerHTML = html;
    }
}

// Unit Converter
function updateUnitOptions() {
    const cat = document.getElementById('uc-category').value;
    const units = {
        length: ['mm', 'cm', 'm', 'km', 'inch', 'feet', 'yard', 'mile'],
        weight: ['mg', 'g', 'kg', 'ton', 'oz', 'lb'],
        temperature: ['C', 'F', 'K'],
        data: ['bit', 'byte', 'KB', 'MB', 'GB', 'TB'],
        time: ['ms', 'detik', 'menit', 'jam', 'hari', 'minggu', 'bulan', 'tahun']
    };
    const opts = (units[cat] || []).map(u => `<option value="${u}">${u}</option>`).join('');
    document.getElementById('uc-from').innerHTML = opts;
    document.getElementById('uc-to').innerHTML = opts;
    // Set different default for 'to'
    const toEl = document.getElementById('uc-to');
    if (toEl.options.length > 1) toEl.selectedIndex = 1;
}
async function convertUnit() {
    const value = document.getElementById('uc-value').value;
    const from = document.getElementById('uc-from').value;
    const to = document.getElementById('uc-to').value;
    const category = document.getElementById('uc-category').value;
    
    const res = await api('/api/tools/unit-converter', { value: parseFloat(value), from, to, category });
    if (res.success) {
        document.getElementById('uc-result').textContent = res.result + ' ' + to;
        toast(res.formatted, 'success');
    } else {
        toast(res.message, 'error');
    }
}

// Timestamp
async function getTimestampNow() {
    const res = await api('/api/tools/timestamp', { mode: 'now' });
    if (res.success) {
        document.getElementById('ts-now-result').innerHTML = `
            <div class="result-box" style="display:block;">
                <b>Unix Timestamp:</b> ${res.timestamp}\n<b>ISO:</b> ${res.iso}\n<b>Tanggal:</b> ${res.readable}\n<b>Date:</b> ${res.date}\n<b>Time:</b> ${res.time}
            </div>
        `;
    }
}
async function timestampToDate() {
    const ts = document.getElementById('ts-input').value;
    if (!ts) return;
    const res = await api('/api/tools/timestamp', { mode: 'to_date', timestamp: ts });
    if (res.success) {
        document.getElementById('ts-to-date-result').innerHTML = `<div class="result-box" style="display:block;">${res.readable}</div>`;
    } else {
        toast(res.message, 'error');
    }
}
async function dateToTimestamp() {
    const date = document.getElementById('ts-date-input').value;
    if (!date) return;
    const res = await api('/api/tools/timestamp', { mode: 'to_timestamp', date });
    if (res.success) {
        document.getElementById('ts-to-ts-result').innerHTML = `<div class="result-box" style="display:block;">Unix Timestamp: <b>${res.timestamp}</b></div>`;
    } else {
        toast(res.message, 'error');
    }
}

// Text Diff
async function compareTexts() {
    const text1 = document.getElementById('diff-text1').value;
    const text2 = document.getElementById('diff-text2').value;
    if (!text1 && !text2) { toast('Masukkan teks!', 'warning'); return; }
    
    showLoading();
    const res = await api('/api/tools/text-diff', { text1, text2 });
    hideLoading();
    
    if (res.success) {
        let html = `<div style="margin-bottom:12px; display:flex; gap:16px; font-size:13px;">
            <span style="color:var(--text-muted);">Sama: ${res.stats.same}</span>
            <span style="color:var(--success);">+ Ditambah: ${res.stats.added}</span>
            <span style="color:var(--danger);">- Dihapus: ${res.stats.removed}</span>
        </div>`;
        html += '<div style="background:var(--bg-dark); border-radius:8px; padding:12px; font-family:monospace; font-size:12px; max-height:400px; overflow-y:auto;">';
        res.diff.forEach(d => {
            const color = d.type === 'added' ? 'var(--success)' : d.type === 'removed' ? 'var(--danger)' : 'var(--text-muted)';
            const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
            html += `<div style="color:${color}; padding:2px 0;">${prefix} ${d.content || '(kosong)'}</div>`;
        });
        html += '</div>';
        document.getElementById('diff-result').innerHTML = html;
        toast('Perbandingan selesai!', 'success');
    }
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
