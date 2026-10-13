(function (root) {
  'use strict';
  const tiers = [
    { name: 'Gold', min: 0, points: 5, color: '#f4cd7d', asset: 'gold' },
    { name: 'Diamond', min: 3, points: 6, color: '#8dd5ff', asset: 'diamond' },
    { name: 'Master', min: 6, points: 7, color: '#c4a5ff', asset: 'master' },
    { name: 'Predator', min: 11, points: 10, color: '#ff9292', asset: 'predator' }
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
  function award({ streak, balance, cases = 0, repeatCases = 0, kpi = false, top = false, teamTop = false, extra = 0, floorZero = true }) {
    if (!Number.isInteger(cases) || cases < 0) throw new Error('จำนวนเคสต้องเป็นจำนวนเต็มตั้งแต่ 0');
    if (!Number.isInteger(repeatCases) || repeatCases < 0 || repeatCases > Math.max(0, cases - 1)) throw new Error('จำนวนเคสซ้ำต้องไม่เกินเคสทั้งหมดลบหนึ่ง');
    if (!Number.isSafeInteger(extra) || extra < 0 || extra > 1000) throw new Error('Point พิเศษต้องเป็น 0–1000');
    const base = tier(streak).points;
    const kpiComplete = kpi && cases === 0;
    const kpiBonus = kpiComplete ? 2 : 0;
    const teamBonus = top ? 5 : teamTop && kpiComplete ? 1 : 0;
    const deduction = (cases - repeatCases) * 2 + repeatCases * 4;
    const extraBonus = extra;
    const calculated = base + kpiBonus + teamBonus + extraBonus - deduction;
    const after = floorZero ? Math.max(0, balance + calculated) : balance + calculated;
    return { base, kpiBonus, teamBonus, extraBonus, deduction, calculated, delta: after - balance, after, streakAfter: cases ? 0 : streak + 1 };
  }
  function summarize(record) {
    if (!record || !Array.isArray(record.entries)) return null;
    const entries = record.entries;
    const affected = entries.filter(e => e.cases > 0).length;
    return { people: entries.length, affected, clean: entries.length - affected, cases: entries.reduce((n,e) => n + e.cases, 0), repeatCases: entries.reduce((n,e) => n + (e.repeatCases || 0), 0), kpi: entries.filter(e => e.kpi && !e.cases).length, teamTop: !!record.teamTop, topEmployeeId: record.topEmployeeId || null, topName: entries.find(e => e.employeeId === record.topEmployeeId)?.name || null };
  }
  function replay({ employees, requests, months, startMonth, adjustments = [] }) {
    const nextMonth = month => { const [y, m] = month.split('-').map(Number); return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`; };
    const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));
    let expected = startMonth;
    for (const record of ordered) {
      if (record.month !== expected) throw new Error('กรุณาปิดเดือนเรียงจากเดือนเริ่มระบบ');
      expected = nextMonth(expected);
    }
    const balances = new Map(employees.filter(e => e.role === 'employee').map(e => [e.id, { points: 0, streak: 0, lastMonth: null }]));
    const account = id => {
      if (!balances.has(id)) balances.set(id, { points: 0, streak: 0, lastMonth: null });
      return balances.get(id);
    };
    const events = [
      ...ordered.map(record => ({ kind: 'month', at: `${record.month}-99`, record })),
      ...requests.filter(r => r.status === 'approved' && (r.decidedAt || r.date || '').slice(0, 7) >= startMonth).map(request => ({ kind: 'reward', at: request.decidedAt || request.date, request })),
      ...adjustments.filter(a => a.date?.slice(0, 7) >= startMonth).map(adjustment => ({ kind: 'adjustment', at: adjustment.date, adjustment }))
    ].sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind));
    const rebuilt = [], adjustmentResults = [];
    for (const event of events) {
      if (event.kind === 'adjustment') {
        const change = event.adjustment, balance = account(change.employeeId), amount = change.requestedAmount ?? change.amount;
        if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000) throw new Error('รายการปรับ Point ไม่ถูกต้อง');
        const before = balance.points;
        balance.points = Math.max(0, Math.min(10000000, before + amount));
        adjustmentResults.push({ id: change.id, amount: balance.points - before, balanceBefore: before, balanceAfter: balance.points });
        continue;
      }
      if (event.kind === 'reward') {
        const balance = account(event.request.employeeId);
        balance.points = Math.max(0, balance.points - event.request.cost);
        continue;
      }
      const record = event.record;
      const topEmployeeId = record.topEmployeeId || null;
      const entries = record.entries.map(input => {
        const balance = account(input.employeeId);
        if (balance.lastMonth && nextMonth(balance.lastMonth) !== record.month) balance.streak = 0;
        const before = balance.points;
        const streakBefore = balance.streak;
        const result = award({ streak: streakBefore, balance: before, cases: input.cases, repeatCases: input.repeatCases || 0, kpi: input.kpi, extra: input.extraBonus ?? input.extra ?? 0, top: topEmployeeId === input.employeeId, teamTop: topEmployeeId ? topEmployeeId !== input.employeeId : record.teamTop === true });
        balance.points = result.after;
        balance.streak = result.streakAfter;
        balance.lastMonth = record.month;
        return { ...input, base: result.base, kpiBonus: result.kpiBonus, teamBonus: result.teamBonus, extraBonus: result.extraBonus, deduction: result.deduction, calculated: result.calculated, delta: result.delta, balanceBefore: before, balanceAfter: result.after, streakBefore, streakAfter: result.streakAfter };
      });
      rebuilt.push({ ...record, entries });
    }
    return { months: rebuilt, balances, adjustmentResults };
  }
  const api = { tiers, tier, standing, greeting, award, summarize, replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CERules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
