(function (root) {
  'use strict';
  const tiers = [
    { name: 'Gold', min: 0, points: 5, color: '#f4cd7d', asset: 'gold' },
    { name: 'Diamond', min: 2, points: 6, color: '#8dd5ff', asset: 'diamond' },
    { name: 'Master', min: 5, points: 7, color: '#c4a5ff', asset: 'master' },
    { name: 'Predator', min: 12, points: 10, color: '#ff9292', asset: 'predator' }
  ];
  function tier(streak) { return [...tiers].reverse().find(t => streak >= t.min) || tiers[0]; }
  function standing(person, employees) {
    const current = tier(person.streak);
    const next = tiers.find(t => t.min > person.streak) || null;
    const active = employees.filter(e => e.role === 'employee' && e.active);
    const eligible = person.role === 'employee' && person.active;
    return { tier: current.name, nextTier: next?.name || null,
      monthsToNext: next ? next.min - person.streak : 0,
      rank: eligible ? 1 + active.filter(e => e.streak > person.streak).length : null,
      total: active.length,
      tied: eligible && active.filter(e => e.streak === person.streak).length > 1 };
  }
  function greeting(hour, name) {
    if (hour >= 5 && hour < 12) return `สวัสดีตอนเช้า ${name}`;
    if (hour >= 12 && hour < 17) return `สวัสดีตอนบ่าย ${name}`;
    if (hour >= 17 && hour < 22) return `สวัสดีตอนเย็น ${name}`;
    return `ยังไม่นอนอีกหรอ ${name}`;
  }
  function award({ streak, balance, cases = 0, kpi = false, teamTop = false, floorZero = true }) {
    if (!Number.isInteger(cases) || cases < 0) throw new Error('จำนวนเคสต้องเป็นจำนวนเต็มตั้งแต่ 0');
    const base = tier(streak).points;
    const kpiBonus = kpi && cases === 0 ? 1 : 0;
    const teamBonus = teamTop ? 1 : 0;
    const deduction = cases * 2;
    const calculated = base + kpiBonus + teamBonus - deduction;
    const after = floorZero ? Math.max(0, balance + calculated) : balance + calculated;
    return { base, kpiBonus, teamBonus, deduction, calculated, delta: after - balance, after, streakAfter: cases ? 0 : streak + 1 };
  }
  function summarize(record) {
    if (!record || !Array.isArray(record.entries)) return null;
    const entries = record.entries;
    const affected = entries.filter(e => e.cases > 0).length;
    return { people: entries.length, affected, clean: entries.length - affected, cases: entries.reduce((n,e) => n + e.cases, 0), kpi: entries.filter(e => e.kpi && !e.cases).length, teamTop: !!record.teamTop };
  }
  const api = { tiers, tier, standing, greeting, award, summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CERules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
