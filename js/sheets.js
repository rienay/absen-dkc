/**
 * ==============================================================================
 * GOOGLE SHEETS REAL-TIME API CLIENT
 * ==============================================================================
 */

import { StorageManager } from './storage.js';

export class GoogleSheetsClient {
  static getScriptUrl() {
    const settings = StorageManager.getSettings();
    return (settings.googleSheetsUrl || '').trim();
  }

  static isConfigured() {
    const url = this.getScriptUrl();
    return url.length > 10 && url.startsWith('http');
  }

  // Ping Google Apps Script untuk mengetes koneksi dan mengukur latensi
  static async testConnection(overrideUrl = null) {
    const url = overrideUrl || this.getScriptUrl();
    if (!url) {
      return { ok: false, message: 'URL Google Apps Script belum diisi.' };
    }

    const startTime = performance.now();
    try {
      // Kita tambahkan parameter ping & timestamp untuk mencegah caching browser
      const pingUrl = `${url}${url.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
      
      const res = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      const latency = Math.round(performance.now() - startTime);
      if (!res.ok) {
        return { ok: false, latency, message: `Server mengembalikan status HTTP ${res.status}` };
      }

      const json = await res.json();
      if (json.status === 'success') {
        return { ok: true, latency, message: 'Koneksi ke Google Sheets berhasil!', data: json };
      } else {
        return { ok: false, latency, message: json.message || 'Respon Google Sheets tidak valid' };
      }
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      console.error('Google Sheets Ping Error:', err);
      return {
        ok: false,
        latency,
        message: 'Gagal terhubung ke Google Sheets. Pastikan Web App disetting "Anyone" (Siapa saja) dan URL benar.'
      };
    }
  }

  // Ambil semua data dari Google Sheets
  static async pullAll() {
    const url = this.getScriptUrl();
    if (!this.isConfigured()) return null;

    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=getAll&_t=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return json.data; // { members: [...], attendance: [...] }
      }
      return null;
    } catch (err) {
      console.warn('Google Sheets Pull Failed (Offline or CORS):', err);
      return null;
    }
  }

  // Kirim data anggota ke Google Sheets
  static async saveMember(member) {
    const url = this.getScriptUrl();
    if (!this.isConfigured()) return false;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script redirects across domains; no-cors allows saving reliably
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveMember',
          member: member
        })
      });
      return true;
    } catch (err) {
      console.error('Google Sheets saveMember error:', err);
      return false;
    }
  }

  // Hapus data anggota di Google Sheets
  static async deleteMember(memberId) {
    const url = this.getScriptUrl();
    if (!this.isConfigured()) return false;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'deleteMember',
          id: memberId
        })
      });
      return true;
    } catch (err) {
      console.error('Google Sheets deleteMember error:', err);
      return false;
    }
  }

  // Kirim presensi ke Google Sheets
  static async saveAttendance(attendance) {
    const url = this.getScriptUrl();
    if (!this.isConfigured()) return false;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveAttendance',
          attendance: attendance
        })
      });
      return true;
    } catch (err) {
      console.error('Google Sheets saveAttendance error:', err);
      return false;
    }
  }

  // Hapus presensi di Google Sheets
  static async deleteAttendance(attendanceId) {
    const url = this.getScriptUrl();
    if (!this.isConfigured()) return false;

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'deleteAttendance',
          id: attendanceId
        })
      });
      return true;
    } catch (err) {
      console.error('Google Sheets deleteAttendance error:', err);
      return false;
    }
  }

  // Sinkronisasi Dua Arah (Two-Way Sync):
  // 1. Ambil data terbaru dari Google Sheets
  // 2. Gabungkan dengan data lokal (merge by ID & timestamp)
  // 3. Simpan ke local storage
  // 4. Update status & UI
  static async performSync(notifyCallback = null) {
    if (!this.isConfigured()) {
      if (notifyCallback) notifyCallback({ status: 'unconfigured', message: 'Google Sheets belum dikonfigurasi' });
      return false;
    }

    if (notifyCallback) notifyCallback({ status: 'syncing', message: 'Menghubungkan ke Google Sheets...' });

    try {
      const remoteData = await this.pullAll();
      const localDB = StorageManager.getDB();

      if (remoteData) {
        // Merge Members
        const remoteMembers = remoteData.members || [];
        const remoteAttendance = remoteData.attendance || [];

        // Gabungkan anggota
        const memberMap = new Map();
        localDB.members.forEach(m => memberMap.set(m.id, m));
        remoteMembers.forEach(m => memberMap.set(m.id, m)); // remote overrides if exists

        // Gabungkan presensi
        const attendanceMap = new Map();
        localDB.attendance.forEach(a => attendanceMap.set(a.id, a));
        remoteAttendance.forEach(a => attendanceMap.set(a.id, a));

        const mergedMembers = Array.from(memberMap.values());
        const mergedAttendance = Array.from(attendanceMap.values());

        // Simpan hasil merge ke lokal
        StorageManager.saveDB({
          members: mergedMembers,
          attendance: mergedAttendance
        });

        // Update waktu sync terakhir
        const now = new Date().toISOString();
        StorageManager.saveSettings({ lastSyncTime: now });

        if (notifyCallback) {
          notifyCallback({
            status: 'connected',
            message: 'Sinkronisasi Google Sheets berhasil!',
            lastSync: now,
            memberCount: mergedMembers.length,
            attendanceCount: mergedAttendance.length
          });
        }
        return true;
      } else {
        if (notifyCallback) {
          notifyCallback({
            status: 'offline',
            message: 'Tidak dapat mengambil data dari Google Sheets. Menggunakan database lokal.'
          });
        }
        return false;
      }
    } catch (err) {
      console.error('PerformSync failed:', err);
      if (notifyCallback) {
        notifyCallback({ status: 'error', message: 'Koneksi Google Sheets gagal: ' + err.message });
      }
      return false;
    }
  }
}
