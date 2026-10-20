/**
 * ==============================================================================
 * ANALYTICS & LEADERBOARD ENGINE
 * ==============================================================================
 */

export const UNITS = [
  'DKC',
  'UBALOKA',
  'UNPASA',
  'PASPANCA',
  'CYBER JURNALIST',
  'UNPRADA'
];

export class AnalyticsManager {
  // Hitung metrik ringkasan keseluruhan
  static calculateDashboardMetrics(members, attendance) {
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'Aktif Tugas').length;
    const completedMembers = members.filter(m => m.status === 'Selesai Masa Tugas').length;

    const todayDate = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    const todayAttendance = attendance.filter(a => a.date === todayDate).length;
    const monthAttendance = attendance.filter(a => a.date && a.date.startsWith(thisMonth)).length;

    return {
      totalMembers,
      activeMembers,
      completedMembers,
      todayAttendance,
      monthAttendance
    };
  }

  // Ringkasan per Unit Organisasi
  static getUnitSummary(members, attendance) {
    return UNITS.map(unit => {
      const unitMembers = members.filter(m => m.unit === unit);
      const activeCount = unitMembers.filter(m => m.status === 'Aktif Tugas').length;
      const completedCount = unitMembers.filter(m => m.status === 'Selesai Masa Tugas').length;
      
      const thisMonth = new Date().toISOString().slice(0, 7);
      const unitAttendance = attendance.filter(a => a.unit === unit && a.date && a.date.startsWith(thisMonth)).length;

      return {
        unit,
        displayName: unit === 'DKC' ? 'DKC Cilacap' : unit,
        total: unitMembers.length,
        active: activeCount,
        completed: completedCount,
        monthAttendance: unitAttendance,
        quota: unit === 'DKC' ? 21 : null // Khusus DKC kuota 21
      };
    });
  }

  // Peringkat Kehadiran Bulanan
  static getMonthlyRankings(members, attendance, selectedMonth, unitFilter = '') {
    const month = selectedMonth || new Date().toISOString().slice(0, 7);

    let filteredMembers = members;
    if (unitFilter) {
      filteredMembers = filteredMembers.filter(m => m.unit === unitFilter);
    }

    const rankings = filteredMembers.map(member => {
      const memberAtt = attendance.filter(a => a.memberId === member.id && a.date && a.date.startsWith(month));
      const activities = memberAtt.map(a => a.activity).filter(Boolean);

      return {
        ...member,
        attendanceCount: memberAtt.length,
        activities: activities
      };
    });

    // Urutkan dari jumlah hadir terbanyak -> nama abjad
    rankings.sort((a, b) => {
      if (b.attendanceCount !== a.attendanceCount) {
        return b.attendanceCount - a.attendanceCount;
      }
      return a.nama.localeCompare(b.nama);
    });

    return rankings;
  }

  // Peringkat Kehadiran Sepanjang Waktu (All-Time)
  static getAllTimeRankings(members, attendance, unitFilter = '') {
    let filteredMembers = members;
    if (unitFilter) {
      filteredMembers = filteredMembers.filter(m => m.unit === unitFilter);
    }

    const rankings = filteredMembers.map(member => {
      const count = attendance.filter(a => a.memberId === member.id).length;
      return {
        ...member,
        totalAttendance: count
      };
    });

    rankings.sort((a, b) => {
      if (b.totalAttendance !== a.totalAttendance) {
        return b.totalAttendance - a.totalAttendance;
      }
      return a.nama.localeCompare(b.nama);
    });

    return rankings;
  }
}
