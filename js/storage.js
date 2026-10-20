/**
 * ==============================================================================
 * STORAGE & DATABASE ENGINE (Indexed / LocalStorage with Auto-Seeding)
 * ==============================================================================
 */

const STORAGE_KEY = 'dkc_cilacap_presensi_v2';
const SETTINGS_KEY = 'dkc_cilacap_settings_v2';

const DEFAULT_SETTINGS = {
  googleSheetsUrl: '', // URL dari Google Apps Script Web App
  autoSyncInterval: '30', // detik (0 = manual, 15, 30, 60)
  adminPin: '1101', // Default password admin
  lastSyncTime: null
};

// Data awal (Seed) jika sistem pertama kali dibuka
const SEED_MEMBERS = [
  {
    id: "m_dkc_01",
    nta: "W01",
    nama: "Fajar Nugraha",
    unit: "DKC",
    status: "Aktif Tugas",
    pangkalan: "Sanggar Bakti Kwarcab Cilacap",
    jabatan: "Ketua DKC Cilacap",
    golongan: "Pandega",
    kontak: "081234567890",
    catatan: "Masa Bakti 2023-2028",
    createdAt: "2026-01-10T08:00:00.000Z"
  },
  {
    id: "m_dkc_02",
    nta: "W02",
    nama: "Siti Rahmawati",
    unit: "DKC",
    status: "Aktif Tugas",
    pangkalan: "Sanggar Bakti Kwarcab Cilacap",
    jabatan: "Wakil Ketua DKC Cilacap",
    golongan: "Pandega",
    kontak: "081298765432",
    catatan: "Bidang Pembinaan & Pengembangan",
    createdAt: "2026-01-10T08:10:00.000Z"
  },
  {
    id: "m_dkc_03",
    nta: "W03",
    nama: "Bambang Kurniawan",
    unit: "DKC",
    status: "Aktif Tugas",
    pangkalan: "Sanggar Bakti Kwarcab Cilacap",
    jabatan: "Sekretaris I",
    golongan: "Penegak",
    kontak: "081345678901",
    catatan: "Administrasi & Kesekretariatan",
    createdAt: "2026-01-10T08:20:00.000Z"
  },
  {
    id: "m_uba_01",
    nta: "U.01",
    nama: "Rizky Pratama",
    unit: "UBALOKA",
    status: "Aktif Tugas",
    pangkalan: "Unit Bantu Pertolongan Pramuka",
    jabatan: "Komandan Ubaloka",
    golongan: "Penegak",
    kontak: "081211223344",
    catatan: "SAR & Tanggap Darurat Bencana",
    createdAt: "2026-01-11T09:00:00.000Z"
  },
  {
    id: "m_unp_01",
    nta: "11.01.UA.001",
    nama: "Dian Anggraeni",
    unit: "UNPASA",
    status: "Aktif Tugas",
    pangkalan: "Unit Protokol Kwarcab Cilacap",
    jabatan: "Koordinator Protokol",
    golongan: "Pandega",
    kontak: "081322334455",
    catatan: "Keprotokolan & Upacara Resmi",
    createdAt: "2026-01-12T09:30:00.000Z"
  },
  {
    id: "m_pas_01",
    nta: "11.01.P.001",
    nama: "Aditya Wardhana",
    unit: "PASPANCA",
    status: "Aktif Tugas",
    pangkalan: "Pasukan Pengibar Bendera Kwarcab",
    jabatan: "Danton Paspanca",
    golongan: "Penegak",
    kontak: "081255667788",
    catatan: "PBB & Pengibaran Panji Pramuka",
    createdAt: "2026-01-13T10:00:00.000Z"
  },
  {
    id: "m_cj_01",
    nta: "11.01.CJ.001",
    nama: "Nurul Aini",
    unit: "CYBER JURNALIST",
    status: "Aktif Tugas",
    pangkalan: "Media & Dokumentasi DKC",
    jabatan: "Pimred Pewarta Pramuka",
    golongan: "Penegak",
    kontak: "081377889900",
    catatan: "Publikasi, Foto & Media Sosial",
    createdAt: "2026-01-14T11:00:00.000Z"
  },
  {
    id: "m_unpr_01",
    nta: "11.01.UP.001",
    nama: "Hendra Setiawan",
    unit: "UNPRADA",
    status: "Aktif Tugas",
    pangkalan: "Unit Pramuka Peduli",
    jabatan: "Koordinator Lapangan",
    golongan: "Pandega",
    kontak: "081299001122",
    catatan: "Aksi Pengabdian Masyarakat",
    createdAt: "2026-01-15T13:00:00.000Z"
  }
];

export class StorageManager {
  static getDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initialData = {
          members: SEED_MEMBERS,
          attendance: []
        };
        this.saveDB(initialData);
        return initialData;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.members) || !Array.isArray(parsed.attendance)) {
        return { members: SEED_MEMBERS, attendance: [] };
      }
      return parsed;
    } catch (e) {
      console.error('Error loading DB from storage:', e);
      return { members: SEED_MEMBERS, attendance: [] };
    }
  }

  static saveDB(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving DB to storage:', e);
      return false;
    }
  }

  static getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings) {
    try {
      const merged = { ...this.getSettings(), ...settings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('Error saving settings:', e);
      return null;
    }
  }

  static exportBackupJSON() {
    const db = this.getDB();
    const settings = this.getSettings();
    const payload = {
      app: 'BANGKIT WIJAYAKUSUMA DKC CILACAP',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      members: db.members,
      attendance: db.attendance,
      settings: {
        autoSyncInterval: settings.autoSyncInterval
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-dkc-cilacap-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importBackupJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.members) || !Array.isArray(data.attendance)) {
            throw new Error('Format file backup tidak valid');
          }
          this.saveDB({
            members: data.members,
            attendance: data.attendance
          });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsText(file);
    });
  }

  static clearDatabase() {
    this.saveDB({ members: [], attendance: [] });
  }
}
