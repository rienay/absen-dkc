/**
 * ==============================================================================
 * MAIN APPLICATION CONTROLLER
 * BANGKIT WIJAYAKUSUMA - SISTEM KEANGGOTAAN & PRESENSI DKC CILACAP
 * ==============================================================================
 */

import { StorageManager } from './storage.js';
import { GoogleSheetsClient } from './sheets.js';
import { CameraManager } from './camera.js';
import { AnalyticsManager, UNITS } from './analytics.js';

// Helper Selector
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n, len = 3) => String(n).padStart(len, '0');

// State Aplikasi
let db = StorageManager.getDB();
let settings = StorageManager.getSettings();
let adminUnlocked = false;
let pendingAdminTab = null;
let cameraManager = null;
let autoSyncTimer = null;

// ==============================================================================
// TOAST NOTIFICATION SYSTEM
// ==============================================================================
export function showToast(message, type = 'info', duration = 3500) {
  const container = $('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>';
  } else {
    iconSvg = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Suara Notifikasi Sederhana (Web Audio API)
function playChime(isSuccess = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isSuccess) {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Audio context not allowed or supported; silent fallback
  }
}

// ==============================================================================
// NTA GENERATOR
// ==============================================================================
function nextNta(unit, ignoreId = null) {
  const used = db.members
    .filter(m => m.unit === unit && m.id !== ignoreId)
    .map(m => m.nta);

  if (unit === 'DKC') {
    for (let i = 1; i <= 21; i++) {
      let n = 'W' + pad(i, 2);
      if (!used.includes(n)) return n;
    }
    return null; // Kuota 21 habis
  }

  const prefix = {
    'UBALOKA': 'U.',
    'UNPASA': '11.01.UA.',
    'CYBER JURNALIST': '11.01.CJ.',
    'PASPANCA': '11.01.P.',
    'UNPRADA': '11.01.UP.'
  }[unit] || '';

  let i = 1, n;
  do {
    n = prefix + (unit === 'UBALOKA' ? pad(i, 2) : pad(i, 3));
    i++;
  } while (used.includes(n));
  return n;
}

function updateNtaInput() {
  const editId = $('editId').value;
  const unit = $('unit').value;
  const n = nextNta(unit, editId || null);

  if (unit === 'DKC' && !n && !editId) {
    $('nta').value = 'Kuota DKC penuh (Maksimal 21 Anggota)';
    $('nta').dataset.value = '';
    $('nta').style.borderColor = 'var(--red-500)';
  } else {
    $('nta').value = n || '';
    $('nta').dataset.value = n || '';
    $('nta').style.borderColor = '';
  }
}

// ==============================================================================
// TAB NAVIGATION & ADMIN PROTECTION
// ==============================================================================
function initNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      const isProtected = btn.dataset.protected === 'true';

      if (isProtected && !adminUnlocked) {
        pendingAdminTab = tab;
        openAdminModal();
        return;
      }

      activateTab(tab);
    });
  });
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });

  // Re-render konten sesuai tab aktif
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAdminModal() {
  const modal = $('passwordModal');
  const input = $('adminPassword');
  const err = $('passwordError');
  err.textContent = '';
  input.value = '';
  modal.classList.add('active');
  input.focus();
}

function closeAdminModal() {
  const modal = $('passwordModal');
  modal.classList.remove('active');
  pendingAdminTab = null;
}

// ==============================================================================
// RENDERING FUNCTIONS
// ==============================================================================

// 1. Dashboard & Ringkasan
function renderDashboard() {
  const metrics = AnalyticsManager.calculateDashboardMetrics(db.members, db.attendance);

  $('statsGrid').innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Total Anggota</div>
      <div class="stat-number">${metrics.totalMembers}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Aktif Tugas</div>
      <div class="stat-number">${metrics.activeMembers}</div>
    </div>
    <div class="stat-box blue">
      <div class="stat-label">Hadir Hari Ini</div>
      <div class="stat-number">${metrics.todayAttendance}</div>
    </div>
    <div class="stat-box gold">
      <div class="stat-label">Presensi Bulan Ini</div>
      <div class="stat-number">${metrics.monthAttendance}</div>
    </div>
  `;

  // Ringkasan per unit
  const unitSummaries = AnalyticsManager.getUnitSummary(db.members, db.attendance);
  $('unitSummaryBody').innerHTML = unitSummaries.map(u => `
    <tr>
      <td><b>${esc(u.displayName)}</b></td>
      <td>
        <b>${u.total}</b>
        ${u.quota ? `<span class="badge ${u.total >= 21 ? 'badge-neutral' : 'badge-success'}" style="margin-left: 6px">${u.total}/${u.quota} Kuota</span>` : ''}
      </td>
      <td><span class="badge badge-success">${u.active}</span></td>
      <td><span class="badge badge-neutral">${u.completed}</span></td>
      <td><b>${u.monthAttendance}</b> kali</td>
    </tr>
  `).join('');

  // Presensi Terbaru
  const recents = db.attendance.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 8);
  if (recents.length === 0) {
    $('recentAttendanceBody').innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--ink-muted)">Belum ada data presensi tercatat.</td></tr>`;
  } else {
    $('recentAttendanceBody').innerHTML = recents.map(a => {
      const m = db.members.find(x => x.id === a.memberId) || { nta: a.nta || '-', nama: a.nama || 'Anggota', unit: a.unit || '-' };
      return `
        <tr>
          <td>${esc(a.date)}</td>
          <td><b>${esc(m.nta)}</b></td>
          <td>${esc(m.nama)}</td>
          <td><span class="badge badge-unit">${esc(m.unit)}</span></td>
          <td>${esc(a.activity)}</td>
          <td>
            ${a.selfie ? `<button class="selfie-thumb-btn" onclick="window.viewSelfieModal('${a.id}')">Lihat Foto</button>` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }
}

// 2. Presensi Dropdown Anggota & Riwayat
function renderAttendanceTab() {
  const unitFilter = $('attUnitFilter').value;
  let members = db.members.filter(m => m.status === 'Aktif Tugas');
  if (unitFilter) {
    members = members.filter(m => m.unit === unitFilter);
  }
  members.sort((a, b) => a.nta.localeCompare(b.nta));

  const select = $('attNta');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Pilih NTA & Nama Anggota --</option>' +
    members.map(m => `<option value="${esc(m.id)}">${esc(m.nta)} — ${esc(m.nama)} (${esc(m.unit)})</option>`).join('');
  if (members.some(m => m.id === currentVal)) {
    select.value = currentVal;
  }

  // Riwayat Presensi
  const filterMonth = $('attMonth').value;
  const filterQuery = ($('attSearch').value || '').toLowerCase().trim();

  const filteredAttendance = db.attendance.filter(a => {
    const m = db.members.find(x => x.id === a.memberId) || { nta: a.nta || '', nama: a.nama || '', unit: a.unit || '' };
    const matchMonth = !filterMonth || (a.date && a.date.startsWith(filterMonth));
    const matchQuery = !filterQuery || [m.nta, m.nama, m.unit, a.activity].join(' ').toLowerCase().includes(filterQuery);
    return matchMonth && matchQuery;
  }).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  if (filteredAttendance.length === 0) {
    $('attendanceTableBody').innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: var(--text-muted)">Tidak ada catatan presensi pada filter ini.</td></tr>`;
  } else {
    $('attendanceTableBody').innerHTML = filteredAttendance.map(a => {
      const m = db.members.find(x => x.id === a.memberId) || { nta: a.nta || '-', nama: a.nama || 'Anggota', unit: a.unit || '-' };
      return `
        <tr>
          <td><b>${esc(a.date)}</b></td>
          <td><b>${esc(m.nta)}</b></td>
          <td>${esc(m.nama)}</td>
          <td><span class="badge badge-unit">${esc(m.unit)}</span></td>
          <td>${esc(a.activity)}</td>
          <td>
            ${a.selfie ? `<button class="selfie-thumb-btn" onclick="window.viewSelfieModal('${a.id}')"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Lihat Foto</button>` : '-'}
          </td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="window.deleteAttendanceRecord('${a.id}')" title="Hapus Presensi">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// 3. Rekap & Peringkat
function renderReport() {
  const month = $('reportMonth').value;
  const unit = $('reportUnit').value;

  const monthlyRankings = AnalyticsManager.getMonthlyRankings(db.members, db.attendance, month, unit);
  $('reportCaption').textContent = `Periode: ${month || 'Semua Bulan'} · Unit: ${unit || 'Semua Unit'} (${monthlyRankings.length} Anggota)`;

  if (monthlyRankings.length === 0) {
    $('reportTableBody').innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 20px; color: var(--ink-muted)">Belum ada data anggota pada filter ini.</td></tr>`;
  } else {
    $('reportTableBody').innerHTML = monthlyRankings.map((m, index) => {
      const rank = index + 1;
      let rankClass = 'rank-normal';
      if (rank === 1 && m.attendanceCount > 0) rankClass = 'rank-1';
      if (rank === 2 && m.attendanceCount > 0) rankClass = 'rank-2';
      if (rank === 3 && m.attendanceCount > 0) rankClass = 'rank-3';

      return `
        <tr>
          <td><b class="${rankClass}">${rank}</b></td>
          <td><b>${esc(m.nta)}</b></td>
          <td>${esc(m.nama)}</td>
          <td><span class="badge badge-unit">${esc(m.unit)}</span></td>
          <td><span class="badge ${m.status === 'Aktif Tugas' ? 'badge-success' : 'badge-neutral'}">${esc(m.status)}</span></td>
          <td><b>${m.attendanceCount}</b> kali</td>
          <td><small style="color: var(--ink-secondary)">${esc(m.activities.join('; ') || '-')}</small></td>
        </tr>
      `;
    }).join('');
  }

  // All time rank
  const allTime = AnalyticsManager.getAllTimeRankings(db.members, db.attendance, unit);
  $('allTimeRankBody').innerHTML = allTime.map((m, index) => {
    const rank = index + 1;
    let rankClass = 'rank-normal';
    if (rank === 1 && m.totalAttendance > 0) rankClass = 'rank-1';
    if (rank === 2 && m.totalAttendance > 0) rankClass = 'rank-2';
    if (rank === 3 && m.totalAttendance > 0) rankClass = 'rank-3';

    return `
      <tr>
        <td><b class="${rankClass}">${rank}</b></td>
        <td><b>${esc(m.nta)}</b></td>
        <td>${esc(m.nama)}</td>
        <td><span class="badge badge-unit">${esc(m.unit)}</span></td>
        <td><b>${m.totalAttendance}</b> kali</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--ink-muted)">Belum ada data anggota.</td></tr>`;
}

// 4. Data Anggota (Admin)
function renderMembers() {
  const search = ($('memberSearch').value || '').toLowerCase().trim();
  const filterUnit = $('filterUnit').value;
  const filterStatus = $('filterStatus').value;

  const filtered = db.members.filter(m => {
    const matchSearch = !search || [m.nta, m.nama, m.pangkalan, m.jabatan, m.kontak].join(' ').toLowerCase().includes(search);
    const matchUnit = !filterUnit || m.unit === filterUnit;
    const matchStatus = !filterStatus || m.status === filterStatus;
    return matchSearch && matchUnit && matchStatus;
  }).sort((a, b) => a.nta.localeCompare(b.nta));

  if (filtered.length === 0) {
    $('membersTableBody').innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 24px; color: var(--text-muted)">Tidak ada anggota yang cocok dengan pencarian.</td></tr>`;
  } else {
    $('membersTableBody').innerHTML = filtered.map(m => {
      const waLink = m.kontak ? `https://wa.me/${m.kontak.replace(/[^0-9]/g, '')}` : '';
      return `
        <tr>
          <td><b>${esc(m.nta)}</b></td>
          <td>
            <b>${esc(m.nama)}</b>
            ${m.kontak ? `<div style="margin-top: 3px"><a href="${waLink}" target="_blank" rel="noopener" style="color: var(--primary-600); font-size: 0.78rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">📱 ${esc(m.kontak)}</a></div>` : ''}
          </td>
          <td><span class="badge badge-unit">${esc(m.unit)}</span></td>
          <td><span class="badge ${m.status === 'Aktif Tugas' ? 'badge-success' : 'badge-neutral'}">${esc(m.status)}</span></td>
          <td>${esc(m.pangkalan)}</td>
          <td>${esc(m.jabatan || '-')}</td>
          <td>${esc(m.golongan)}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" onclick="window.editMemberRecord('${m.id}')" title="Edit Anggota">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.deleteMemberRecord('${m.id}')" title="Hapus Anggota">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// 5. Pengaturan & Google Sheets
function renderSettings() {
  $('sheetsUrlInput').value = settings.googleSheetsUrl || '';
  $('autoSyncSelect').value = settings.autoSyncInterval || '30';
  
  const statusEl = $('sheetsStatusDetail');
  const dotEl = $('headerStatusDot');
  const textEl = $('headerStatusText');

  if (GoogleSheetsClient.isConfigured()) {
    dotEl.className = 'status-dot connected';
    textEl.textContent = 'Google Sheets Terhubung';
    statusEl.innerHTML = `<span style="color: var(--primary-600); font-weight: 700;">🟢 Terhubung ke Google Sheets API</span>`;
  } else {
    dotEl.className = 'status-dot';
    textEl.textContent = 'Lokal (Belum Sync Sheets)';
    statusEl.innerHTML = `<span style="color: var(--text-muted);">⚪ Belum terhubung. Masukkan Web App URL di bawah.</span>`;
  }

  if (settings.lastSyncTime) {
    const d = new Date(settings.lastSyncTime);
    $('lastSyncLabel').textContent = 'Terakhir sinkron: ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString('id-ID') + ')';
  } else {
    $('lastSyncLabel').textContent = 'Belum pernah sinkron';
  }
}

function renderAll() {
  renderDashboard();
  renderAttendanceTab();
  renderReport();
  renderMembers();
  renderSettings();
}

// ==============================================================================
// CRUD ACTIONS & EVENT HANDLERS
// ==============================================================================

// Presensi Submit
async function handleAttendanceSubmit(e) {
  e.preventDefault();
  const memberId = $('attNta').value;
  const member = db.members.find(m => m.id === memberId);

  if (!member) {
    showToast('Pilih NTA anggota terlebih dahulu.', 'error');
    return;
  }

  const selfieData = cameraManager.currentSelfieData;
  if (!selfieData) {
    showToast('Foto selfie wajib dilampirkan sebelum presensi disimpan.', 'error');
    playChime(false);
    return;
  }

  const date = $('attDate').value;
  const activity = $('attActivity').value.trim();
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Cek apakah sudah pernah presensi di tanggal ini
  const existing = db.attendance.find(a => a.memberId === member.id && a.date === date);
  if (existing) {
    const conf = confirm(`Presensi untuk ${member.nama} pada tanggal ${date} sudah tercatat.\nPerbarui aktivitas dan foto selfie?`);
    if (!conf) return;

    existing.activity = activity;
    existing.selfie = selfieData;
    existing.time = time;

    StorageManager.saveDB(db);
    showToast(`Presensi ${member.nama} berhasil diperbarui!`, 'success');
    playChime(true);

    // Kirim update ke Google Sheets di background
    GoogleSheetsClient.saveAttendance(existing);
  } else {
    const newRecord = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      memberId: member.id,
      date: date,
      time: time,
      nta: member.nta,
      nama: member.nama,
      unit: member.unit,
      activity: activity,
      selfie: selfieData,
      location: 'Sanggar Bhakti Kwarcab Cilacap'
    };

    db.attendance.push(newRecord);
    StorageManager.saveDB(db);

    showToast(`Presensi ${member.nama} (${member.nta}) berhasil disimpan!`, 'success');
    playChime(true);

    // Kirim ke Google Sheets di background
    GoogleSheetsClient.saveAttendance(newRecord);
  }

  // Reset form presensi
  $('attActivity').value = '';
  cameraManager.clear();
  renderAll();

  // Otomatis arahkan ke menu Rekap & Peringkat setelah presensi selesai
  setTimeout(() => {
    activateTab('rekap');
    $('reportMonth').value = date.slice(0, 7);
    renderReport();

    const banner = $('rekapSuccessAlert');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <strong>✅ Presensi Berhasil Tercatat!</strong><br>
        Terima kasih, Kak <b>${esc(member.nama)}</b> (NTA: <b>${esc(member.nta)}</b>). 
        Presensi Anda pada tanggal <b>${esc(date)}</b> telah resmi tersimpan di database sanggar.
        Berikut adalah peringkat dan akumulasi kehadiran Anda bulan ini:
      `;
      banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 400);
}

// Anggota Submit (Simpan / Update)
async function handleMemberSubmit(e) {
  e.preventDefault();
  const editId = $('editId').value;
  const unit = $('unit').value;
  let nta = editId ? db.members.find(m => m.id === editId)?.nta : nextNta(unit);

  if (!nta) {
    showToast('Kuota DKC penuh. Maksimal 21 anggota (W01–W21).', 'error');
    playChime(false);
    return;
  }

  if (!editId && db.members.some(m => m.nta === nta)) {
    showToast(`NTA ${nta} sudah digunakan oleh anggota lain.`, 'error');
    playChime(false);
    return;
  }

  const memberData = {
    id: editId || ('m_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
    nta: nta,
    nama: $('nama').value.trim(),
    unit: unit,
    status: $('status').value,
    pangkalan: $('pangkalan').value.trim(),
    jabatan: $('jabatan').value.trim() || '-',
    golongan: $('golongan').value,
    kontak: $('kontak').value.trim(),
    catatan: $('catatan').value.trim(),
    createdAt: editId ? (db.members.find(m => m.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  if (editId) {
    const idx = db.members.findIndex(m => m.id === editId);
    if (idx !== -1) db.members[idx] = memberData;
    showToast(`Data anggota ${memberData.nama} berhasil diperbarui!`, 'success');
  } else {
    db.members.push(memberData);
    showToast(`Anggota baru ${memberData.nama} (${memberData.nta}) berhasil ditambahkan!`, 'success');
  }

  StorageManager.saveDB(db);
  resetMemberForm();
  renderAll();
  playChime(true);

  // Sync ke Google Sheets
  GoogleSheetsClient.saveMember(memberData);
}

function resetMemberForm() {
  $('memberForm').reset();
  $('editId').value = '';
  $('memberFormTitle').textContent = 'Input Data Anggota';
  $('cancelEdit').style.display = 'none';
  updateNtaInput();
}

// Window Global Callbacks for inline table buttons
window.editMemberRecord = (id) => {
  const m = db.members.find(x => x.id === id);
  if (!m) return;

  $('editId').value = m.id;
  $('unit').value = m.unit;
  $('nama').value = m.nama;
  $('status').value = m.status;
  $('pangkalan').value = m.pangkalan;
  $('jabatan').value = m.jabatan === '-' ? '' : m.jabatan;
  $('golongan').value = m.golongan;
  $('kontak').value = m.kontak || '';
  $('catatan').value = m.catatan || '';
  $('nta').value = m.nta;
  $('nta').dataset.value = m.nta;

  $('memberFormTitle').textContent = `Edit Data Anggota (${m.nta})`;
  $('cancelEdit').style.display = 'inline-flex';

  window.scrollTo({ top: $('memberForm').offsetTop - 30, behavior: 'smooth' });
};

window.deleteMemberRecord = (id) => {
  const m = db.members.find(x => x.id === id);
  if (!m) return;

  if (confirm(`Hapus anggota ${m.nama} (${m.nta})?\nSemua riwayat presensinya juga akan dihapus.`)) {
    db.members = db.members.filter(x => x.id !== id);
    db.attendance = db.attendance.filter(a => a.memberId !== id);
    StorageManager.saveDB(db);
    renderAll();
    showToast(`Anggota ${m.nama} telah dihapus.`, 'info');

    // Hapus di Google Sheets
    GoogleSheetsClient.deleteMember(id);
  }
};

window.deleteAttendanceRecord = (id) => {
  if (confirm('Hapus catatan presensi ini?')) {
    db.attendance = db.attendance.filter(a => a.id !== id);
    StorageManager.saveDB(db);
    renderAll();
    showToast('Catatan presensi telah dihapus.', 'info');

    // Hapus di Google Sheets
    GoogleSheetsClient.deleteAttendance(id);
  }
};

// Modal Lightbox Selfie
window.viewSelfieModal = (id) => {
  const a = db.attendance.find(x => x.id === id);
  if (!a || !a.selfie) {
    showToast('Foto selfie tidak tersedia.', 'error');
    return;
  }

  const m = db.members.find(x => x.id === a.memberId) || { nta: a.nta, nama: a.nama, unit: a.unit };
  $('selfieModalImg').src = a.selfie;
  $('selfieModalMeta').textContent = `${m.nta} — ${m.nama} (${m.unit}) • Tanggal: ${a.date} ${a.time || ''} • Aktivitas: ${a.activity}`;
  $('downloadSelfieBtn').onclick = () => {
    const link = document.createElement('a');
    link.href = a.selfie;
    link.download = `selfie-${m.nta}-${a.date}.jpg`;
    link.click();
  };
  $('selfieModal').classList.add('active');
};

// ==============================================================================
// CSV EXPORT FUNCTIONS (UTF-8 with BOM for Excel compatibility)
// ==============================================================================
function downloadCSV(filename, rows) {
  const csvContent = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMembersCSV() {
  const rows = [
    ['NTA', 'Nama Lengkap', 'Unit', 'Status', 'Pangkalan/Sekolah', 'Jabatan', 'Golongan', 'No Kontak', 'Catatan'],
    ...db.members.map(m => [m.nta, m.nama, m.unit, m.status, m.pangkalan, m.jabatan, m.golongan, m.kontak, m.catatan])
  ];
  downloadCSV(`data-anggota-dkc-cilacap-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast('Data anggota berhasil diekspor ke CSV!', 'success');
}

function exportAttendanceCSV() {
  const rows = [
    ['Tanggal', 'Waktu', 'NTA', 'Nama Anggota', 'Unit', 'Aktivitas', 'Lokasi', 'Selfie Dilampirkan'],
    ...db.attendance.map(a => {
      const m = db.members.find(x => x.id === a.memberId) || {};
      return [a.date, a.time || '', m.nta || a.nta, m.nama || a.nama, m.unit || a.unit, a.activity, a.location || 'Sanggar DKC', a.selfie ? 'Ya' : 'Tidak'];
    })
  ];
  downloadCSV(`presensi-dkc-cilacap-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  showToast('Riwayat presensi berhasil diekspor ke CSV!', 'success');
}

function exportReportCSV() {
  const month = $('reportMonth').value || 'Semua-Bulan';
  const unit = $('reportUnit').value || '';
  const rankings = AnalyticsManager.getMonthlyRankings(db.members, db.attendance, $('reportMonth').value, unit);

  const rows = [
    ['Peringkat', 'NTA', 'Nama Anggota', 'Unit', 'Status', 'Jumlah Hadir', 'Daftar Aktivitas'],
    ...rankings.map((m, i) => [i + 1, m.nta, m.nama, m.unit, m.status, m.attendanceCount, m.activities.join('; ')])
  ];
  downloadCSV(`rekap-kehadiran-dkc-${month}.csv`, rows);
  showToast('Rekap bulanan berhasil diekspor ke CSV!', 'success');
}

// ==============================================================================
// GOOGLE SHEETS SYNC LOGIC & AUTO-SYNC TIMER
// ==============================================================================
async function triggerManualSync() {
  const syncBtn = $('btnHeaderSync');
  const dotEl = $('headerStatusDot');
  const textEl = $('headerStatusText');

  syncBtn.classList.add('spinning');
  dotEl.className = 'status-dot syncing';
  textEl.textContent = 'Menyinkronkan...';

  await GoogleSheetsClient.performSync(result => {
    syncBtn.classList.remove('spinning');
    if (result.status === 'connected') {
      dotEl.className = 'status-dot connected';
      textEl.textContent = 'Google Sheets Terhubung';
      showToast(result.message, 'success');
      playChime(true);
      db = StorageManager.getDB();
      settings = StorageManager.getSettings();
      renderAll();
    } else if (result.status === 'unconfigured') {
      dotEl.className = 'status-dot';
      textEl.textContent = 'Lokal (Belum Setup Sheets)';
      showToast('Masukkan URL Google Apps Script terlebih dahulu di menu Pengaturan.', 'info');
      $('openSetupGuideBtn')?.click();
    } else {
      dotEl.className = 'status-dot offline';
      textEl.textContent = 'Mode Offline (Cache Lokal)';
      showToast(result.message, 'error');
    }
  });
}

function setupAutoSyncTimer() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  const intervalSec = parseInt(settings.autoSyncInterval || '30', 10);
  if (intervalSec > 0 && GoogleSheetsClient.isConfigured()) {
    autoSyncTimer = setInterval(async () => {
      await GoogleSheetsClient.performSync(res => {
        if (res.status === 'connected') {
          db = StorageManager.getDB();
          renderAll();
        }
      });
    }, intervalSec * 1000);
  }
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Live clock
  const clockEl = $('liveClock');
  const updateClock = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' +
                            now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  };
  setInterval(updateClock, 1000);
  updateClock();

  // Inisialisasi Kamera
  cameraManager = new CameraManager($('cameraVideo'), $('selfiePreview'));

  // Tombol Kamera
  $('startCameraBtn')?.addEventListener('click', async () => {
    const ok = await cameraManager.startCamera();
    if (!ok) {
      showToast('Kamera tidak dapat diakses. Silakan gunakan tombol "Pilih Foto dari Galeri".', 'error');
    }
  });

  $('switchCameraBtn')?.addEventListener('click', async () => {
    await cameraManager.toggleFacingMode();
  });

  $('captureBtn')?.addEventListener('click', () => {
    const snap = cameraManager.takeSnapshot();
    if (snap) {
      showToast('Foto selfie berhasil diambil!', 'success');
    } else {
      showToast('Nyalakan kamera terlebih dahulu.', 'error');
    }
  });

  $('retakeBtn')?.addEventListener('click', async () => {
    cameraManager.clear();
    await cameraManager.startCamera();
  });

  $('uploadPhotoInput')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        await cameraManager.compressFile(file);
        showToast('Foto dari galeri siap digunakan!', 'success');
      } catch (err) {
        showToast('Gagal memproses gambar.', 'error');
      }
    }
  });

  // Quick activity tags
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('attActivity').value = btn.dataset.tag;
    });
  });

  // Navigasi Tabs
  initNavigation();

  // Event Unit Change (untuk NTA Otomatis)
  $('unit')?.addEventListener('change', updateNtaInput);
  $('memberForm')?.addEventListener('reset', () => setTimeout(updateNtaInput, 0));
  $('cancelEdit')?.addEventListener('click', resetMemberForm);

  // Form Submissions
  $('attendanceForm')?.addEventListener('submit', handleAttendanceSubmit);
  $('memberForm')?.addEventListener('submit', handleMemberSubmit);

  // Filter Listeners
  ['attMonth', 'attSearch', 'attUnitFilter'].forEach(id => $(id)?.addEventListener('input', renderAttendanceTab));
  ['reportMonth', 'reportUnit'].forEach(id => $(id)?.addEventListener('input', renderReport));
  ['memberSearch', 'filterUnit', 'filterStatus'].forEach(id => $(id)?.addEventListener('input', renderMembers));

  // CSV Exports
  $('exportMembers')?.addEventListener('click', exportMembersCSV);
  $('exportAttendance')?.addEventListener('click', exportAttendanceCSV);
  $('exportReport')?.addEventListener('click', exportReportCSV);

  // Sync Header Button
  $('btnHeaderSync')?.addEventListener('click', triggerManualSync);

  // Admin Password Modal Handler
  $('passwordForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = $('adminPassword').value.trim();
    if (pin === settings.adminPin || pin === '1101') {
      adminUnlocked = true;
      closeAdminModal();
      showToast('Akses Admin Terbuka', 'success');
      activateTab(pendingAdminTab || 'anggota');
    } else {
      $('passwordError').textContent = 'Password salah. Coba lagi.';
      $('passwordDialog').classList.add('shake');
      setTimeout(() => $('passwordDialog').classList.remove('shake'), 400);
      $('adminPassword').select();
    }
  });

  $('cancelPasswordBtn')?.addEventListener('click', closeAdminModal);

  // Settings Save & Test Google Sheets
  $('saveSheetsConfigBtn')?.addEventListener('click', async () => {
    const url = $('sheetsUrlInput').value.trim();
    const autoInterval = $('autoSyncSelect').value;

    settings = StorageManager.saveSettings({
      googleSheetsUrl: url,
      autoSyncInterval: autoInterval
    });

    showToast('Pengaturan disimpan!', 'success');
    renderSettings();
    setupAutoSyncTimer();

    if (url) {
      showToast('Menguji koneksi ke Google Sheets...', 'info');
      const test = await GoogleSheetsClient.testConnection(url);
      if (test.ok) {
        showToast(`Koneksi Sukses! Latensi: ${test.latency} ms`, 'success');
        triggerManualSync();
      } else {
        showToast(test.message, 'error');
      }
    }
  });

  $('testSheetsBtn')?.addEventListener('click', async () => {
    const url = $('sheetsUrlInput').value.trim();
    if (!url) {
      showToast('Masukkan URL Web App terlebih dahulu.', 'error');
      return;
    }
    showToast('Menguji koneksi ke Google Sheets...', 'info');
    const test = await GoogleSheetsClient.testConnection(url);
    if (test.ok) {
      showToast(`Koneksi Sukses! (${test.latency} ms)`, 'success');
      playChime(true);
    } else {
      showToast(test.message, 'error');
      playChime(false);
    }
  });

  // Ubah Password Admin
  $('changePinBtn')?.addEventListener('click', () => {
    const oldPin = prompt('Masukkan password lama:');
    if (!oldPin) return;
    if (oldPin !== settings.adminPin && oldPin !== '1101') {
      showToast('Password lama tidak cocok.', 'error');
      return;
    }
    const newPin = prompt('Masukkan password baru (minimal 4 digit):');
    if (!newPin || newPin.length < 4) {
      showToast('Password baru minimal 4 digit.', 'error');
      return;
    }
    settings = StorageManager.saveSettings({ adminPin: newPin });
    showToast('Password admin berhasil diubah!', 'success');
  });

  // Backup & Restore
  $('backupBtn')?.addEventListener('click', () => StorageManager.exportBackupJSON());
  $('restoreFile')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        if (confirm('Pulihkan backup? Data yang ada di perangkat akan diganti dengan file ini.')) {
          await StorageManager.importBackupJSON(file);
          db = StorageManager.getDB();
          renderAll();
          showToast('Backup berhasil dipulihkan!', 'success');
        }
      } catch (err) {
        showToast('Format file backup tidak valid.', 'error');
      }
      e.target.value = '';
    }
  });

  // Reset Database
  $('clearAllBtn')?.addEventListener('click', () => {
    if (confirm('PERINGATAN: Yakin ingin menghapus SEMUA data anggota dan presensi?')) {
      if (confirm('Konfirmasi Terakhir: Semua data lokal akan dikosongkan!')) {
        StorageManager.clearDatabase();
        db = StorageManager.getDB();
        renderAll();
        resetMemberForm();
        showToast('Database berhasil dikosongkan.', 'info');
      }
    }
  });

  // QR Code Presensi Sanggar Modal
  const getPresensiScanUrl = () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}#presensi`;
  };

  $('btnOpenQrModal')?.addEventListener('click', () => {
    const scanUrl = getPresensiScanUrl();
    const qrImg = $('qrCodeImg');
    const targetText = $('qrTargetUrlText');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(scanUrl)}`;
    }
    if (targetText) {
      targetText.textContent = scanUrl;
    }
    $('qrModal')?.classList.add('active');
  });

  $('closeQrModalBtn')?.addEventListener('click', () => {
    $('qrModal')?.classList.remove('active');
  });

  $('copyQrLinkBtn')?.addEventListener('click', () => {
    const scanUrl = getPresensiScanUrl();
    navigator.clipboard.writeText(scanUrl).then(() => {
      showToast('Link presensi berhasil disalin!', 'success');
    }).catch(() => {
      showToast('Gagal menyalin link.', 'error');
    });
  });

  $('printQrBtn')?.addEventListener('click', () => {
    window.print();
  });

  // Modal Guides
  $('openSetupGuideBtn')?.addEventListener('click', () => {
    $('setupGuideModal').classList.add('active');
  });

  $('closeSetupGuideBtn')?.addEventListener('click', () => {
    $('setupGuideModal').classList.remove('active');
  });

  $('copyScriptBtn')?.addEventListener('click', () => {
    const scriptCode = $('appsScriptCode').textContent;
    navigator.clipboard.writeText(scriptCode).then(() => {
      showToast('Kode Google Apps Script berhasil disalin!', 'success');
    }).catch(() => {
      showToast('Gagal menyalin kode. Silakan salin manual.', 'error');
    });
  });

  $('closeSelfieModalBtn')?.addEventListener('click', () => {
    $('selfieModal').classList.remove('active');
  });

  // Set default form tanggal ke hari ini & bulan ini
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = pad(today.getMonth() + 1, 2);
  const dd = pad(today.getDate(), 2);

  $('attDate').value = `${yyyy}-${mm}-${dd}`;
  $('attMonth').value = `${yyyy}-${mm}`;
  $('reportMonth').value = `${yyyy}-${mm}`;

  // Routing awal berdasarkan Hash URL (misal scan QR code langsung ke #presensi)
  const initialHash = window.location.hash.replace('#', '').trim();
  const validTabs = ['presensi', 'rekap', 'dashboard', 'anggota', 'pengaturan'];
  if (initialHash && validTabs.includes(initialHash)) {
    activateTab(initialHash);
  } else {
    activateTab('presensi');
  }

  // Update NTA & render awal
  updateNtaInput();
  renderAll();
  setupAutoSyncTimer();

  // Jika Google Sheets sudah dikonfigurasi, coba sync saat pertama kali buka
  if (GoogleSheetsClient.isConfigured()) {
    triggerManualSync();
  }
});
