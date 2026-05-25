#!/usr/bin/env python3
"""
AI Tools Indonesia - Full Stack Web Application
Server utama menggunakan Python built-in modules
"""

import http.server
import json
import sqlite3
import hashlib
import secrets
import os
import time
import urllib.parse
import threading
import re
from http import HTTPStatus
from datetime import datetime, timedelta

# Configuration
HOST = '0.0.0.0'
PORT = 8000
DB_PATH = 'database/aitools.db'
TELEGRAM_TOKEN = '8646403110:AAHjHiykfUzA8NMJE73g_ai51l2jFHJagBo'
SESSION_DURATION = 86400 * 7  # 7 days

# Rate limiting
RATE_LIMITS = {}
FREE_DAILY_LIMIT = 50


# ============ DATABASE ============

def init_db():
    """Initialize SQLite database with all tables"""
    os.makedirs('database', exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        telegram_id TEXT UNIQUE,
        telegram_username TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT,
        is_premium INTEGER DEFAULT 0,
        daily_usage INTEGER DEFAULT 0,
        last_usage_reset TEXT DEFAULT (date('now'))
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS usage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        details TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')


    c.execute('''CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS shortened_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        clicks INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')
    
    conn.commit()
    conn.close()

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{hashed.hex()}"

def verify_password(password, stored_hash):
    """Verify password against stored hash"""
    salt, hashed = stored_hash.split(':')
    check = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return check.hex() == hashed


# ============ AUTH HELPERS ============

def create_session(user_id):
    """Create new session token"""
    token = secrets.token_urlsafe(32)
    expires = datetime.now() + timedelta(seconds=SESSION_DURATION)
    conn = get_db()
    conn.execute(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        (user_id, token, expires.isoformat())
    )
    conn.commit()
    conn.close()
    return token

def validate_session(token):
    """Validate session token and return user"""
    if not token:
        return None
    conn = get_db()
    row = conn.execute(
        '''SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id 
           WHERE s.token = ? AND s.expires_at > datetime('now')''',
        (token,)
    ).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def check_rate_limit(user_id):
    """Check if user has exceeded daily rate limit"""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        conn.close()
        return False
    
    today = datetime.now().strftime('%Y-%m-%d')
    if user['last_usage_reset'] != today:
        conn.execute(
            'UPDATE users SET daily_usage = 0, last_usage_reset = ? WHERE id = ?',
            (today, user_id)
        )
        conn.commit()
        conn.close()
        return True
    
    if user['is_premium']:
        conn.close()
        return True
    
    if user['daily_usage'] >= FREE_DAILY_LIMIT:
        conn.close()
        return False
    
    conn.close()
    return True

def increment_usage(user_id, tool_name, details=''):
    """Increment usage counter and log history"""
    conn = get_db()
    conn.execute('UPDATE users SET daily_usage = daily_usage + 1 WHERE id = ?', (user_id,))
    conn.execute(
        'INSERT INTO usage_history (user_id, tool_name, details) VALUES (?, ?, ?)',
        (user_id, tool_name, details)
    )
    conn.commit()
    conn.close()


# ============ TELEGRAM BOT ============

def start_telegram_bot():
    """Start Telegram bot in background thread"""
    import urllib.request
    
    def get_updates(offset=0):
        try:
            url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates?offset={offset}&timeout=30'
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=35) as resp:
                data = json.loads(resp.read().decode())
                return data.get('result', [])
        except Exception as e:
            print(f"[Telegram] Error getting updates: {e}")
            time.sleep(5)
            return []
    
    def send_message(chat_id, text):
        try:
            url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage'
            payload = json.dumps({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'})
            req = urllib.request.Request(url, data=payload.encode(), headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=10)
        except Exception as e:
            print(f"[Telegram] Error sending message: {e}")
    
    def handle_message(msg):
        chat_id = msg['chat']['id']
        text = msg.get('text', '')
        tg_username = msg['from'].get('username', '')
        
        if text == '/start':
            welcome = (
                "🤖 <b>Selamat datang di AI Tools Indonesia Bot!</b>\n\n"
                "Bot ini digunakan untuk registrasi akun website AI Tools.\n\n"
                "📝 <b>Cara Register:</b>\n"
                "<code>/register username password</code>\n\n"
                "Contoh:\n"
                "<code>/register john rahasia123</code>\n\n"
                "Setelah register, kamu bisa login ke website dengan username dan password yang sudah dibuat.\n\n"
                "❓ <b>Commands:</b>\n"
                "/start - Mulai & info\n"
                "/register - Daftar akun baru\n"
                "/myaccount - Cek info akun\n"
                "/resetpassword - Reset password"
            )
            send_message(chat_id, welcome)


        elif text.startswith('/register'):
            parts = text.split()
            if len(parts) != 3:
                send_message(chat_id, "❌ Format salah!\n\nGunakan: <code>/register username password</code>")
                return
            
            _, username, password = parts
            
            if len(username) < 3 or len(username) > 20:
                send_message(chat_id, "❌ Username harus 3-20 karakter!")
                return
            if not re.match(r'^[a-zA-Z0-9_]+$', username):
                send_message(chat_id, "❌ Username hanya boleh huruf, angka, dan underscore!")
                return
            if len(password) < 6:
                send_message(chat_id, "❌ Password minimal 6 karakter!")
                return
            
            conn = get_db()
            existing = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
            if existing:
                conn.close()
                send_message(chat_id, "❌ Username sudah digunakan! Coba username lain.")
                return
            
            existing_tg = conn.execute('SELECT id FROM users WHERE telegram_id = ?', (str(chat_id),)).fetchone()
            if existing_tg:
                conn.close()
                send_message(chat_id, "❌ Akun Telegram kamu sudah terdaftar!")
                return
            
            pw_hash = hash_password(password)
            conn.execute(
                'INSERT INTO users (username, password_hash, telegram_id, telegram_username) VALUES (?, ?, ?, ?)',
                (username, pw_hash, str(chat_id), tg_username)
            )
            conn.commit()
            conn.close()
            
            send_message(chat_id, (
                f"✅ <b>Registrasi berhasil!</b>\n\n"
                f"👤 Username: <code>{username}</code>\n"
                f"🔑 Password: <code>{password}</code>\n\n"
                f"Sekarang kamu bisa login ke website AI Tools!\n"
                f"Jangan lupa simpan passwordmu ya 😉"
            ))


        elif text.startswith('/myaccount'):
            conn = get_db()
            user = conn.execute('SELECT * FROM users WHERE telegram_id = ?', (str(chat_id),)).fetchone()
            conn.close()
            if user:
                status = "⭐ Premium" if user['is_premium'] else "🆓 Free"
                send_message(chat_id, (
                    f"👤 <b>Info Akun Kamu</b>\n\n"
                    f"Username: <code>{user['username']}</code>\n"
                    f"Status: {status}\n"
                    f"Penggunaan hari ini: {user['daily_usage']}/{FREE_DAILY_LIMIT}\n"
                    f"Terdaftar: {user['created_at']}"
                ))
            else:
                send_message(chat_id, "❌ Kamu belum punya akun. Gunakan /register untuk daftar.")
        
        elif text.startswith('/resetpassword'):
            parts = text.split()
            if len(parts) != 2:
                send_message(chat_id, "Format: <code>/resetpassword passwordbaru</code>")
                return
            
            new_password = parts[1]
            if len(new_password) < 6:
                send_message(chat_id, "❌ Password minimal 6 karakter!")
                return
            
            conn = get_db()
            user = conn.execute('SELECT * FROM users WHERE telegram_id = ?', (str(chat_id),)).fetchone()
            if user:
                pw_hash = hash_password(new_password)
                conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (pw_hash, user['id']))
                conn.commit()
                conn.close()
                send_message(chat_id, f"✅ Password berhasil direset!\nPassword baru: <code>{new_password}</code>")
            else:
                conn.close()
                send_message(chat_id, "❌ Kamu belum punya akun.")
        
        else:
            send_message(chat_id, "🤖 Halo! Gunakan /start untuk melihat panduan.")
    
    def bot_loop():
        print("[Telegram] Bot started...")
        offset = 0
        while True:
            try:
                updates = get_updates(offset)
                for update in updates:
                    offset = update['update_id'] + 1
                    if 'message' in update:
                        handle_message(update['message'])
            except Exception as e:
                print(f"[Telegram] Bot loop error: {e}")
                time.sleep(5)
    
    thread = threading.Thread(target=bot_loop, daemon=True)
    thread.start()
    print("[Telegram] Bot thread started")


# ============ BLOCK BLAST SOLVER ============

class BlockBlastSolver:
    """AI Solver for Block Blast game using heuristic search"""
    
    BOARD_SIZE = 8
    
    # Common Block Blast pieces
    PIECES = {
        'single': [(0,0)],
        'h2': [(0,0),(0,1)],
        'h3': [(0,0),(0,1),(0,2)],
        'h4': [(0,0),(0,1),(0,2),(0,3)],
        'h5': [(0,0),(0,1),(0,2),(0,3),(0,4)],
        'v2': [(0,0),(1,0)],
        'v3': [(0,0),(1,0),(2,0)],
        'v4': [(0,0),(1,0),(2,0),(3,0)],
        'v5': [(0,0),(1,0),(2,0),(3,0),(4,0)],
        'square2': [(0,0),(0,1),(1,0),(1,1)],
        'square3': [(0,0),(0,1),(0,2),(1,0),(1,1),(1,2),(2,0),(2,1),(2,2)],
        'l_shape': [(0,0),(1,0),(2,0),(2,1)],
        'l_shape_r': [(0,0),(1,0),(2,0),(2,-1)],
        'l_shape_u': [(0,0),(0,1),(0,2),(1,0)],
        'l_shape_d': [(0,0),(0,1),(0,2),(1,2)],
        't_shape': [(0,0),(0,1),(0,2),(1,1)],
        'z_shape': [(0,0),(0,1),(1,1),(1,2)],
        's_shape': [(0,1),(0,2),(1,0),(1,1)],
    }
    
    @staticmethod
    def parse_board(board_data):
        """Parse board from 8x8 grid (0=empty, 1=filled)"""
        if isinstance(board_data, list) and len(board_data) == 8:
            return [row[:8] for row in board_data]
        return [[0]*8 for _ in range(8)]
    
    @staticmethod
    def can_place(board, piece, row, col):
        """Check if piece can be placed at position"""
        for dr, dc in piece:
            r, c = row + dr, col + dc
            if r < 0 or r >= 8 or c < 0 or c >= 8:
                return False
            if board[r][c] == 1:
                return False
        return True


    @staticmethod
    def place_piece(board, piece, row, col):
        """Place piece on board, return new board"""
        new_board = [r[:] for r in board]
        for dr, dc in piece:
            new_board[row + dr][col + dc] = 1
        return new_board
    
    @staticmethod
    def clear_lines(board):
        """Clear completed rows and columns, return (new_board, lines_cleared)"""
        new_board = [r[:] for r in board]
        cleared = 0
        
        # Check rows
        rows_to_clear = []
        for r in range(8):
            if all(new_board[r][c] == 1 for c in range(8)):
                rows_to_clear.append(r)
        
        # Check columns
        cols_to_clear = []
        for c in range(8):
            if all(new_board[r][c] == 1 for r in range(8)):
                cols_to_clear.append(c)
        
        # Clear rows
        for r in rows_to_clear:
            for c in range(8):
                new_board[r][c] = 0
            cleared += 1
        
        # Clear columns
        for c in cols_to_clear:
            for r in range(8):
                new_board[r][c] = 0
            cleared += 1
        
        return new_board, cleared
    
    @staticmethod
    def evaluate_board(board, lines_cleared):
        """Heuristic evaluation of board state"""
        score = 0
        
        # Lines cleared bonus (combo potential)
        score += lines_cleared * 100
        
        # Count empty spaces (more is better)
        empty = sum(1 for r in range(8) for c in range(8) if board[r][c] == 0)
        score += empty * 5
        
        # Penalize fragmentation
        for r in range(8):
            for c in range(7):
                if board[r][c] != board[r][c+1]:
                    score -= 2
        for r in range(7):
            for c in range(8):
                if board[r][c] != board[r+1][c]:
                    score -= 2
        
        # Bonus for nearly complete rows/cols
        for r in range(8):
            filled = sum(1 for c in range(8) if board[r][c] == 1)
            if filled >= 6:
                score += (filled - 5) * 15
        for c in range(8):
            filled = sum(1 for r in range(8) if board[r][c] == 1)
            if filled >= 6:
                score += (filled - 5) * 15
        
        # Penalize height concentration
        max_consecutive = 0
        for r in range(8):
            consecutive = 0
            for c in range(8):
                if board[r][c] == 1:
                    consecutive += 1
                    max_consecutive = max(max_consecutive, consecutive)
                else:
                    consecutive = 0
        
        # Bonus for keeping center accessible
        center_empty = sum(1 for r in range(2,6) for c in range(2,6) if board[r][c] == 0)
        score += center_empty * 3
        
        return score


    @classmethod
    def find_best_moves(cls, board, pieces):
        """Find optimal placement for given pieces using DFS with heuristic"""
        if not pieces:
            return []
        
        best_score = float('-inf')
        best_moves = []
        
        def solve(current_board, remaining_pieces, moves, depth=0):
            nonlocal best_score, best_moves
            
            if not remaining_pieces:
                score = cls.evaluate_board(current_board, 0)
                if score > best_score:
                    best_score = score
                    best_moves = moves[:]
                return
            
            piece_key = remaining_pieces[0]
            piece = cls.PIECES.get(piece_key, cls.PIECES['single'])
            rest = remaining_pieces[1:]
            
            placed = False
            candidates = []
            
            for r in range(8):
                for c in range(8):
                    if cls.can_place(current_board, piece, r, c):
                        new_board = cls.place_piece(current_board, piece, r, c)
                        cleared_board, lines = cls.clear_lines(new_board)
                        score = cls.evaluate_board(cleared_board, lines)
                        candidates.append((score, r, c, cleared_board, lines))
                        placed = True
            
            if not placed:
                # Can't place this piece, try skipping (dead move)
                return
            
            # Sort by score and take top candidates to limit search
            candidates.sort(key=lambda x: -x[0])
            top_n = min(5, len(candidates))  # Beam search width
            
            for score, r, c, cleared_board, lines in candidates[:top_n]:
                moves.append({
                    'piece': piece_key,
                    'row': r,
                    'col': c,
                    'lines_cleared': lines,
                    'score': score
                })
                solve(cleared_board, rest, moves, depth + 1)
                moves.pop()
        
        solve(board, pieces, [])
        return best_moves
    
    @classmethod
    def solve(cls, board_data, pieces):
        """Main solver entry point"""
        board = cls.parse_board(board_data)
        
        # Try all permutations of pieces (up to 3 pieces)
        from itertools import permutations
        
        best_result = None
        best_score = float('-inf')
        
        for perm in permutations(pieces):
            result = cls.find_best_moves(board, list(perm))
            if result:
                total_score = sum(m['score'] for m in result)
                if total_score > best_score:
                    best_score = total_score
                    best_result = result
        
        if best_result:
            return {
                'success': True,
                'moves': best_result,
                'total_score': best_score
            }
        
        return {'success': False, 'message': 'Tidak ada move yang valid ditemukan'}


# ============ TOOL IMPLEMENTATIONS ============

def tool_calculator(expression):
    """Safe calculator evaluation"""
    allowed = set('0123456789+-*/().% ')
    expr = expression.strip()
    if not all(c in allowed for c in expr):
        return {'error': 'Ekspresi tidak valid'}
    try:
        # Additional safety
        if any(kw in expr for kw in ['import', 'exec', 'eval', '__']):
            return {'error': 'Ekspresi tidak valid'}
        result = eval(expr)
        return {'result': str(result), 'expression': expr}
    except Exception as e:
        return {'error': f'Error: {str(e)}'}

def tool_qr_generate(text):
    """Generate QR code as SVG"""
    # Simple QR-like SVG generator (visual representation)
    import base64
    size = 200
    modules = 21
    cell = size // modules
    
    # Simple encoding visualization
    data_bits = []
    for ch in text:
        bits = format(ord(ch), '08b')
        data_bits.extend([int(b) for b in bits])
    
    # Fill grid
    grid = [[0]*modules for _ in range(modules)]
    
    # Position patterns (corners)
    for pos in [(0,0), (0,14), (14,0)]:
        r, c = pos
        for i in range(7):
            for j in range(7):
                if i == 0 or i == 6 or j == 0 or j == 6 or (2<=i<=4 and 2<=j<=4):
                    grid[r+i][c+j] = 1
    
    # Fill data
    idx = 0
    for r in range(8, modules):
        for c in range(8, modules):
            if idx < len(data_bits):
                grid[r][c] = data_bits[idx]
                idx += 1
            else:
                grid[r][c] = (r * c) % 2
    
    # Generate SVG
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}">'
    svg += f'<rect width="{size}" height="{size}" fill="white"/>'
    for r in range(modules):
        for c in range(modules):
            if grid[r][c]:
                svg += f'<rect x="{c*cell}" y="{r*cell}" width="{cell}" height="{cell}" fill="black"/>'
    svg += '</svg>'
    
    encoded = base64.b64encode(svg.encode()).decode()
    return {'svg': svg, 'data_url': f'data:image/svg+xml;base64,{encoded}'}

def tool_shorten_link(user_id, url):
    """Shorten a URL"""
    code = secrets.token_urlsafe(6)
    conn = get_db()
    conn.execute(
        'INSERT INTO shortened_links (user_id, original_url, short_code) VALUES (?, ?, ?)',
        (user_id, url, code)
    )
    conn.commit()
    conn.close()
    return {'short_code': code, 'short_url': f'/s/{code}', 'original': url}


# ============ HTTP SERVER ============

class AIToolsHandler(http.server.SimpleHTTPRequestHandler):
    """Main HTTP request handler"""
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")
    
    def send_json(self, data, status=200):
        """Send JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def send_html(self, html_content):
        """Send HTML response"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html_content.encode('utf-8'))
    
    def get_session_user(self):
        """Get current user from cookie/header"""
        cookie = self.headers.get('Cookie', '')
        token = None
        for part in cookie.split(';'):
            part = part.strip()
            if part.startswith('session='):
                token = part[8:]
                break
        if not token:
            auth = self.headers.get('Authorization', '')
            if auth.startswith('Bearer '):
                token = auth[7:]
        return validate_session(token)
    
    def read_body(self):
        """Read and parse request body"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        try:
            return json.loads(body.decode('utf-8'))
        except:
            return {}
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()


    def do_GET(self):
        """Handle GET requests"""
        path = urllib.parse.urlparse(self.path).path
        
        # Static files
        if path.startswith('/css/') or path.startswith('/js/') or path.startswith('/img/'):
            file_path = f'public{path}'
            if os.path.exists(file_path):
                ext = path.split('.')[-1]
                content_types = {
                    'css': 'text/css', 'js': 'application/javascript',
                    'png': 'image/png', 'jpg': 'image/jpeg',
                    'svg': 'image/svg+xml', 'ico': 'image/x-icon'
                }
                self.send_response(200)
                self.send_header('Content-Type', content_types.get(ext, 'application/octet-stream'))
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
        
        # Short link redirect
        if path.startswith('/s/'):
            code = path[3:]
            conn = get_db()
            link = conn.execute('SELECT * FROM shortened_links WHERE short_code = ?', (code,)).fetchone()
            if link:
                conn.execute('UPDATE shortened_links SET clicks = clicks + 1 WHERE id = ?', (link['id'],))
                conn.commit()
                conn.close()
                self.send_response(302)
                self.send_header('Location', link['original_url'])
                self.end_headers()
                return
            conn.close()
        
        # API endpoints
        if path == '/api/me':
            user = self.get_session_user()
            if user:
                self.send_json({
                    'success': True,
                    'user': {
                        'id': user['id'],
                        'username': user['username'],
                        'is_premium': bool(user['is_premium']),
                        'daily_usage': user['daily_usage'],
                        'daily_limit': FREE_DAILY_LIMIT,
                        'created_at': user['created_at']
                    }
                })
            else:
                self.send_json({'success': False, 'message': 'Not authenticated'}, 401)
            return


        if path == '/api/stats':
            user = self.get_session_user()
            if not user:
                self.send_json({'success': False}, 401)
                return
            conn = get_db()
            total_usage = conn.execute(
                'SELECT COUNT(*) as cnt FROM usage_history WHERE user_id = ?', (user['id'],)
            ).fetchone()['cnt']
            today_usage = conn.execute(
                'SELECT COUNT(*) as cnt FROM usage_history WHERE user_id = ? AND date(created_at) = date("now")',
                (user['id'],)
            ).fetchone()['cnt']
            recent = conn.execute(
                'SELECT tool_name, created_at FROM usage_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
                (user['id'],)
            ).fetchall()
            tool_stats = conn.execute(
                'SELECT tool_name, COUNT(*) as cnt FROM usage_history WHERE user_id = ? GROUP BY tool_name ORDER BY cnt DESC',
                (user['id'],)
            ).fetchall()
            conn.close()
            self.send_json({
                'success': True,
                'total_usage': total_usage,
                'today_usage': today_usage,
                'daily_limit': FREE_DAILY_LIMIT if not user['is_premium'] else 999,
                'recent': [dict(r) for r in recent],
                'tool_stats': [dict(r) for r in tool_stats]
            })
            return
        
        if path == '/api/notes':
            user = self.get_session_user()
            if not user:
                self.send_json({'success': False}, 401)
                return
            conn = get_db()
            notes = conn.execute(
                'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', (user['id'],)
            ).fetchall()
            conn.close()
            self.send_json({'success': True, 'notes': [dict(n) for n in notes]})
            return
        
        if path == '/api/todos':
            user = self.get_session_user()
            if not user:
                self.send_json({'success': False}, 401)
                return
            conn = get_db()
            todos = conn.execute(
                'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)
            ).fetchall()
            conn.close()
            self.send_json({'success': True, 'todos': [dict(t) for t in todos]})
            return
        
        if path == '/api/links':
            user = self.get_session_user()
            if not user:
                self.send_json({'success': False}, 401)
                return
            conn = get_db()
            links = conn.execute(
                'SELECT * FROM shortened_links WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)
            ).fetchall()
            conn.close()
            self.send_json({'success': True, 'links': [dict(l) for l in links]})
            return
        
        # Serve main HTML for all other routes (SPA)
        self.serve_app()


    def do_POST(self):
        """Handle POST requests"""
        path = urllib.parse.urlparse(self.path).path
        body = self.read_body()
        
        if path == '/api/login':
            username = body.get('username', '').strip()
            password = body.get('password', '')
            
            if not username or not password:
                self.send_json({'success': False, 'message': 'Username dan password wajib diisi'}, 400)
                return
            
            conn = get_db()
            user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            conn.close()
            
            if not user or not verify_password(password, user['password_hash']):
                self.send_json({'success': False, 'message': 'Username atau password salah'}, 401)
                return
            
            token = create_session(user['id'])
            conn = get_db()
            conn.execute('UPDATE users SET last_login = datetime("now") WHERE id = ?', (user['id'],))
            conn.commit()
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Set-Cookie', f'session={token}; Path=/; Max-Age={SESSION_DURATION}; HttpOnly')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True, 'token': token, 'message': 'Login berhasil!'
            }).encode('utf-8'))
            return
        
        if path == '/api/logout':
            user = self.get_session_user()
            if user:
                cookie = self.headers.get('Cookie', '')
                for part in cookie.split(';'):
                    part = part.strip()
                    if part.startswith('session='):
                        token = part[8:]
                        conn = get_db()
                        conn.execute('DELETE FROM sessions WHERE token = ?', (token,))
                        conn.commit()
                        conn.close()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Set-Cookie', 'session=; Path=/; Max-Age=0')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return


        # Protected endpoints - require auth
        user = self.get_session_user()
        if not user:
            self.send_json({'success': False, 'message': 'Silakan login terlebih dahulu'}, 401)
            return
        
        if not check_rate_limit(user['id']):
            self.send_json({'success': False, 'message': 'Batas penggunaan harian tercapai. Upgrade ke Premium!'}, 429)
            return
        
        # Calculator
        if path == '/api/tools/calculator':
            expr = body.get('expression', '')
            result = tool_calculator(expr)
            increment_usage(user['id'], 'Kalkulator', expr)
            self.send_json({'success': True, **result})
            return
        
        # QR Generator
        if path == '/api/tools/qr-generate':
            text = body.get('text', '')
            if not text:
                self.send_json({'success': False, 'message': 'Text tidak boleh kosong'}, 400)
                return
            result = tool_qr_generate(text)
            increment_usage(user['id'], 'QR Generator', text[:50])
            self.send_json({'success': True, **result})
            return
        
        # Link Shortener
        if path == '/api/tools/shorten-link':
            url = body.get('url', '')
            if not url or not url.startswith('http'):
                self.send_json({'success': False, 'message': 'URL tidak valid'}, 400)
                return
            result = tool_shorten_link(user['id'], url)
            increment_usage(user['id'], 'Pemendek Link', url[:50])
            self.send_json({'success': True, **result})
            return
        
        # Block Blast Solver
        if path == '/api/tools/block-blast':
            board = body.get('board', [[0]*8 for _ in range(8)])
            pieces = body.get('pieces', [])
            if not pieces:
                self.send_json({'success': False, 'message': 'Pilih minimal 1 piece'}, 400)
                return
            result = BlockBlastSolver.solve(board, pieces)
            increment_usage(user['id'], 'Block Blast Solver', f'{len(pieces)} pieces')
            self.send_json(result)
            return


        # Notes CRUD
        if path == '/api/notes':
            title = body.get('title', 'Tanpa Judul')
            content = body.get('content', '')
            conn = get_db()
            conn.execute(
                'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
                (user['id'], title, content)
            )
            conn.commit()
            conn.close()
            increment_usage(user['id'], 'Catatan', title[:30])
            self.send_json({'success': True, 'message': 'Catatan disimpan'})
            return
        
        if path == '/api/notes/update':
            note_id = body.get('id')
            title = body.get('title', '')
            content = body.get('content', '')
            conn = get_db()
            conn.execute(
                'UPDATE notes SET title=?, content=?, updated_at=datetime("now") WHERE id=? AND user_id=?',
                (title, content, note_id, user['id'])
            )
            conn.commit()
            conn.close()
            self.send_json({'success': True})
            return
        
        if path == '/api/notes/delete':
            note_id = body.get('id')
            conn = get_db()
            conn.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user['id']))
            conn.commit()
            conn.close()
            self.send_json({'success': True})
            return
        
        # Todos CRUD
        if path == '/api/todos':
            task = body.get('task', '')
            if not task:
                self.send_json({'success': False, 'message': 'Task tidak boleh kosong'}, 400)
                return
            conn = get_db()
            conn.execute('INSERT INTO todos (user_id, task) VALUES (?, ?)', (user['id'], task))
            conn.commit()
            conn.close()
            increment_usage(user['id'], 'To Do List', task[:30])
            self.send_json({'success': True})
            return
        
        if path == '/api/todos/toggle':
            todo_id = body.get('id')
            conn = get_db()
            conn.execute(
                'UPDATE todos SET completed = NOT completed WHERE id=? AND user_id=?',
                (todo_id, user['id'])
            )
            conn.commit()
            conn.close()
            self.send_json({'success': True})
            return
        
        if path == '/api/todos/delete':
            todo_id = body.get('id')
            conn = get_db()
            conn.execute('DELETE FROM todos WHERE id=? AND user_id=?', (todo_id, user['id']))
            conn.commit()
            conn.close()
            self.send_json({'success': True})
            return


        # Text tools
        if path == '/api/tools/word-counter':
            text = body.get('text', '')
            words = len(text.split()) if text.strip() else 0
            chars = len(text)
            chars_no_space = len(text.replace(' ', ''))
            sentences = len([s for s in text.split('.') if s.strip()])
            paragraphs = len([p for p in text.split('\n') if p.strip()])
            increment_usage(user['id'], 'Penghitung Kata', f'{words} kata')
            self.send_json({
                'success': True,
                'words': words, 'characters': chars,
                'characters_no_space': chars_no_space,
                'sentences': sentences, 'paragraphs': paragraphs
            })
            return
        
        if path == '/api/tools/case-converter':
            text = body.get('text', '')
            mode = body.get('mode', 'upper')
            if mode == 'upper':
                result = text.upper()
            elif mode == 'lower':
                result = text.lower()
            elif mode == 'title':
                result = text.title()
            elif mode == 'sentence':
                result = '. '.join(s.capitalize() for s in text.split('. '))
            elif mode == 'reverse':
                result = text[::-1]
            else:
                result = text
            increment_usage(user['id'], 'Konversi Huruf', mode)
            self.send_json({'success': True, 'result': result})
            return
        
        if path == '/api/tools/password-generator':
            import string
            length = min(max(body.get('length', 16), 4), 128)
            use_upper = body.get('uppercase', True)
            use_lower = body.get('lowercase', True)
            use_digits = body.get('digits', True)
            use_symbols = body.get('symbols', True)
            
            chars = ''
            if use_upper: chars += string.ascii_uppercase
            if use_lower: chars += string.ascii_lowercase
            if use_digits: chars += string.digits
            if use_symbols: chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
            if not chars: chars = string.ascii_letters + string.digits
            
            password = ''.join(secrets.choice(chars) for _ in range(length))
            
            # Strength calculation
            strength = 'Lemah'
            if length >= 8 and sum([use_upper, use_lower, use_digits, use_symbols]) >= 3:
                strength = 'Sedang'
            if length >= 12 and sum([use_upper, use_lower, use_digits, use_symbols]) >= 3:
                strength = 'Kuat'
            if length >= 16 and all([use_upper, use_lower, use_digits, use_symbols]):
                strength = 'Sangat Kuat'
            
            increment_usage(user['id'], 'Password Generator', f'{length} chars')
            self.send_json({'success': True, 'password': password, 'strength': strength})
            return


        if path == '/api/tools/json-formatter':
            text = body.get('text', '')
            try:
                parsed = json.loads(text)
                formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
                increment_usage(user['id'], 'JSON Formatter')
                self.send_json({'success': True, 'result': formatted})
            except json.JSONDecodeError as e:
                self.send_json({'success': False, 'message': f'JSON tidak valid: {str(e)}'})
            return
        
        if path == '/api/tools/base64':
            import base64
            text = body.get('text', '')
            mode = body.get('mode', 'encode')
            try:
                if mode == 'encode':
                    result = base64.b64encode(text.encode()).decode()
                else:
                    result = base64.b64decode(text.encode()).decode()
                increment_usage(user['id'], 'Base64', mode)
                self.send_json({'success': True, 'result': result})
            except Exception as e:
                self.send_json({'success': False, 'message': str(e)})
            return
        
        if path == '/api/tools/hash-generator':
            text = body.get('text', '')
            results = {
                'md5': hashlib.md5(text.encode()).hexdigest(),
                'sha1': hashlib.sha1(text.encode()).hexdigest(),
                'sha256': hashlib.sha256(text.encode()).hexdigest(),
                'sha512': hashlib.sha512(text.encode()).hexdigest(),
            }
            increment_usage(user['id'], 'Hash Generator')
            self.send_json({'success': True, 'hashes': results})
            return
        
        if path == '/api/tools/color-converter':
            color = body.get('color', '#000000')
            # Parse hex
            hex_color = color.lstrip('#')
            if len(hex_color) == 6:
                r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
                # HSL conversion
                r1, g1, b1 = r/255, g/255, b/255
                mx, mn = max(r1, g1, b1), min(r1, g1, b1)
                l = (mx + mn) / 2
                if mx == mn:
                    h = s = 0
                else:
                    d = mx - mn
                    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
                    if mx == r1: h = (g1 - b1) / d + (6 if g1 < b1 else 0)
                    elif mx == g1: h = (b1 - r1) / d + 2
                    else: h = (r1 - g1) / d + 4
                    h /= 6
                
                increment_usage(user['id'], 'Color Converter')
                self.send_json({
                    'success': True,
                    'hex': f'#{hex_color}',
                    'rgb': f'rgb({r}, {g}, {b})',
                    'hsl': f'hsl({int(h*360)}, {int(s*100)}%, {int(l*100)}%)',
                    'r': r, 'g': g, 'b': b
                })
            else:
                self.send_json({'success': False, 'message': 'Format warna tidak valid'})
            return
        
        if path == '/api/tools/lorem-ipsum':
            paragraphs = min(body.get('paragraphs', 3), 10)
            lorem = [
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
                "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.",
                "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta.",
                "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
                "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
            ]
            result = '\n\n'.join(lorem[i % len(lorem)] for i in range(paragraphs))
            increment_usage(user['id'], 'Lorem Ipsum', f'{paragraphs} paragraf')
            self.send_json({'success': True, 'text': result})
            return
        
        self.send_json({'success': False, 'message': 'Endpoint tidak ditemukan'}, 404)


    def do_DELETE(self):
        """Handle DELETE requests"""
        self.do_POST()
    
    def do_PUT(self):
        """Handle PUT requests"""
        self.do_POST()
    
    def serve_app(self):
        """Serve the main SPA HTML"""
        html_path = 'public/index.html'
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                self.send_html(f.read())
        else:
            self.send_html('<h1>AI Tools Indonesia</h1><p>Building...</p>')


# ============ MAIN ============

def main():
    """Start the application"""
    print("=" * 50)
    print("  AI TOOLS INDONESIA")
    print("  Full Stack Web Application")
    print("=" * 50)
    
    # Initialize database
    init_db()
    print("[DB] Database initialized")
    
    # Start Telegram bot
    try:
        start_telegram_bot()
    except Exception as e:
        print(f"[Telegram] Bot start failed (will retry): {e}")
    
    # Start HTTP server
    server = http.server.HTTPServer((HOST, PORT), AIToolsHandler)
    print(f"[Server] Running on http://{HOST}:{PORT}")
    print(f"[Server] Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
