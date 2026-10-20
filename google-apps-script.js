/**
 * ==============================================================================
 * SISTEM KEANGGOTAAN & PRESENSI DKC CILACAP - GOOGLE APPS SCRIPT BACKEND
 * ==============================================================================
 * Petunjuk Instalasi:
 * 1. Buat Google Spreadsheet baru di https://sheets.google.com
 *    Beri nama misalnya: "Database Presensi DKC Cilacap"
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script"
 * 3. Hapus semua kode default di editor, lalu salin dan tempel SEMUA kode di bawah ini.
 * 4. Klik ikon Save (Disket).
 * 5. Klik tombol "Terapkan" (Deploy) -> "Penerapan baru" (New deployment)
 * 6. Pilih jenis: "Aplikasi Web" (Web app)
 * 7. Konfigurasi:
 *    - Deskripsi: "API Presensi DKC Cilacap v1"
 *    - Jalankan sebagai (Execute as): "Saya" (Me - akun Google Anda)
 *    - Siapa yang memiliki akses (Who has access): "Siapa saja" (Anyone) -> WAJIB!
 * 8. Klik "Terapkan" (Deploy), lalu setujui izin akses (Authorize access).
 * 9. Salin "URL Aplikasi Web" (Web App URL) yang berakhiran "/exec".
 * 10. Masukkan URL tersebut ke menu "Pengaturan & Integrasi Google Sheets" di aplikasi web.
 * ==============================================================================
 */

const SHEET_MEMBERS = "Anggota";
const SHEET_ATTENDANCE = "Presensi";

// Inisialisasi Sheet otomatis jika belum ada
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet Anggota
  let sheetMembers = ss.getSheetByName(SHEET_MEMBERS);
  if (!sheetMembers) {
    sheetMembers = ss.insertSheet(SHEET_MEMBERS);
    const headers = [
      "ID", "NTA", "Nama", "Unit", "Status", "Pangkalan", 
      "Jabatan", "Golongan", "Kontak", "Catatan", "Dibuat_Pada"
    ];
    sheetMembers.appendRow(headers);
    sheetMembers.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#064e3b")
      .setFontColor("#ffffff");
    sheetMembers.setFrozenRows(1);
  }

  // Sheet Presensi
  let sheetAtt = ss.getSheetByName(SHEET_ATTENDANCE);
  if (!sheetAtt) {
    sheetAtt = ss.insertSheet(SHEET_ATTENDANCE);
    const headers = [
      "ID", "MemberId", "Tanggal", "NTA", "Nama", "Unit", 
      "Aktivitas", "Selfie_URL", "Lokasi", "Waktu_Presensi"
    ];
    sheetAtt.appendRow(headers);
    sheetAtt.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#064e3b")
      .setFontColor("#ffffff");
    sheetAtt.setFrozenRows(1);
  }

  return { ss, sheetMembers, sheetAtt };
}

// Menangani permintaan GET (Membaca Data & Ping)
function doGet(e) {
  try {
    initSheets();
    const action = e && e.parameter ? e.parameter.action : "getAll";

    if (action === "ping") {
      return jsonResponse({
        status: "success",
        message: "Google Sheets API Presensi DKC Cilacap aktif dan siap!",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getAll" || !action) {
      const data = getAllData();
      return jsonResponse({
        status: "success",
        data: data,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ status: "error", message: "Action tidak dikenali" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// Menangani permintaan POST (Simpan, Update, Hapus)
function doPost(e) {
  try {
    initSheets();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const action = body.action;

    if (action === "ping") {
      return jsonResponse({ status: "success", message: "Ping OK" });
    }

    // SIMPAN / UPDATE ANGGOTA
    if (action === "saveMember") {
      const member = body.member;
      const result = saveMember(member);
      return jsonResponse({ status: "success", data: result });
    }

    // HAPUS ANGGOTA
    if (action === "deleteMember") {
      const memberId = body.id;
      deleteMember(memberId);
      return jsonResponse({ status: "success", message: "Anggota berhasil dihapus" });
    }

    // SIMPAN / UPDATE PRESENSI
    if (action === "saveAttendance") {
      const attendance = body.attendance;
      const result = saveAttendance(attendance);
      return jsonResponse({ status: "success", data: result });
    }

    // HAPUS PRESENSI
    if (action === "deleteAttendance") {
      const attendanceId = body.id;
      deleteAttendance(attendanceId);
      return jsonResponse({ status: "success", message: "Presensi berhasil dihapus" });
    }

    // BATCH SYNC (Untuk sinkronisasi data lokal ke Google Sheets sekaligus)
    if (action === "batchSync") {
      const members = body.members || [];
      const attendance = body.attendance || [];
      syncAllData(members, attendance);
      const updated = getAllData();
      return jsonResponse({ status: "success", data: updated });
    }

    return jsonResponse({ status: "error", message: "Action POST tidak valid" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// Mengambil seluruh data anggota dan presensi
function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mSheet = ss.getSheetByName(SHEET_MEMBERS);
  const aSheet = ss.getSheetByName(SHEET_ATTENDANCE);

  const members = [];
  if (mSheet && mSheet.getLastRow() > 1) {
    const mRows = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 11).getValues();
    mRows.forEach(r => {
      if (r[0]) {
        members.push({
          id: String(r[0]),
          nta: String(r[1] || ""),
          nama: String(r[2] || ""),
          unit: String(r[3] || ""),
          status: String(r[4] || "Aktif Tugas"),
          pangkalan: String(r[5] || ""),
          jabatan: String(r[6] || ""),
          golongan: String(r[7] || ""),
          kontak: String(r[8] || ""),
          catatan: String(r[9] || ""),
          createdAt: r[10] ? String(r[10]) : ""
        });
      }
    });
  }

  const attendance = [];
  if (aSheet && aSheet.getLastRow() > 1) {
    const aRows = aSheet.getRange(2, 1, aSheet.getLastRow() - 1, 10).getValues();
    aRows.forEach(r => {
      if (r[0]) {
        attendance.push({
          id: String(r[0]),
          memberId: String(r[1] || ""),
          date: String(r[2] || ""),
          nta: String(r[3] || ""),
          nama: String(r[4] || ""),
          unit: String(r[5] || ""),
          activity: String(r[6] || ""),
          selfie: String(r[7] || ""),
          location: String(r[8] || ""),
          time: r[9] ? String(r[9]) : ""
        });
      }
    });
  }

  return { members, attendance };
}

// Simpan atau update anggota
function saveMember(member) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]));
    const index = ids.indexOf(String(member.id));
    if (index !== -1) {
      // Update baris yang sudah ada
      const row = index + 2;
      sheet.getRange(row, 1, 1, 10).setValues([[
        member.id,
        member.nta,
        member.nama,
        member.unit,
        member.status,
        member.pangkalan,
        member.jabatan || "-",
        member.golongan,
        member.kontak || "",
        member.catatan || ""
      ]]);
      return member;
    }
  }

  // Tambah baris baru
  const createdAt = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  sheet.appendRow([
    member.id,
    member.nta,
    member.nama,
    member.unit,
    member.status,
    member.pangkalan,
    member.jabatan || "-",
    member.golongan,
    member.kontak || "",
    member.catatan || "",
    createdAt
  ]);
  return member;
}

// Hapus anggota berdasarkan ID
function deleteMember(memberId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MEMBERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]));
  const index = ids.indexOf(String(memberId));
  if (index !== -1) {
    sheet.deleteRow(index + 2);
  }
}

// Simpan atau update presensi
function saveAttendance(att) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const lastRow = sheet.getLastRow();

  // Tangani selfie: jika base64 panjang, kita bisa simpan ke Drive jika mau,
  // atau simpan langsung ke cell (Google Sheets mendukung sampai 50.000 karakter).
  let selfieRef = att.selfie || "";
  if (selfieRef && selfieRef.startsWith("data:image")) {
    try {
      selfieRef = saveImageToDrive(att.selfie, "Selfie_" + att.nta + "_" + att.date);
    } catch (e) {
      // Fallback: jika Drive tidak diizinkan, potong jika terlalu panjang atau simpan langsung
      if (selfieRef.length > 45000) {
        selfieRef = "[Foto Selfie Terlampir]";
      }
    }
  }

  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    // Cek apakah sudah ada dengan ID yang sama atau (memberId sama DAN tanggal sama)
    for (let i = 0; i < data.length; i++) {
      const rowId = String(data[i][0]);
      const rowMemberId = String(data[i][1]);
      const rowDate = String(data[i][2]);

      if (rowId === String(att.id) || (rowMemberId === String(att.memberId) && rowDate === String(att.date))) {
        const targetRow = i + 2;
        sheet.getRange(targetRow, 1, 1, 9).setValues([[
          att.id,
          att.memberId,
          att.date,
          att.nta,
          att.nama,
          att.unit,
          att.activity,
          selfieRef,
          att.location || "-"
        ]]);
        att.selfie = selfieRef;
        return att;
      }
    }
  }

  // Tambah baris presensi baru
  const waktuPresensi = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  sheet.appendRow([
    att.id,
    att.memberId,
    att.date,
    att.nta,
    att.nama,
    att.unit,
    att.activity,
    selfieRef,
    att.location || "-",
    waktuPresensi
  ]);
  att.selfie = selfieRef;
  return att;
}

// Hapus presensi berdasarkan ID
function deleteAttendance(attId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ATTENDANCE);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]));
  const index = ids.indexOf(String(attId));
  if (index !== -1) {
    sheet.deleteRow(index + 2);
  }
}

// Simpan foto selfie ke Google Drive folder otomatis
function saveImageToDrive(base64Data, filename) {
  try {
    const folderName = "Foto Presensi DKC Cilacap";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data;
    }

    const contentType = matches[1];
    const bytes = Utilities.base64Decode(matches[2]);
    const blob = Utilities.newBlob(bytes, contentType, filename + ".jpg");
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return base64Data; // Kembalikan data original jika Drive ditolak
  }
}

// Sinkronisasi data menyeluruh
function syncAllData(members, attendance) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mSheet = ss.getSheetByName(SHEET_MEMBERS);
  const aSheet = ss.getSheetByName(SHEET_ATTENDANCE);

  if (members && members.length > 0) {
    members.forEach(m => saveMember(m));
  }
  if (attendance && attendance.length > 0) {
    attendance.forEach(a => saveAttendance(a));
  }
}

// Helper untuk format JSON Response dengan CORS
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
