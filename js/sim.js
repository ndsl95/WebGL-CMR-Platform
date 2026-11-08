// 示例工艺仿真（与画面无关）：台账 DEV、状态 D / S、控制 control()、工艺 step()、报警 evalAlarms()。
// 接真实 PLC 时，把 D / S 的来源换成现场点位即可，画面（main.js / plant.js）不用改。
export const SPEED = 120;                                   // 现实 1 秒 = 工艺 120 秒
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const DEV = {};
const def = (id, o) => (DEV[id] = { id, ...o });
const pr = (a, b) => [a, b];
['A', 'B'].forEach(k => def('P' + k, { kind: 'pump', tag: 'P101-' + k, name: '提升泵', vfd: false, spec: [pr('型号', 'XXX-80'), pr('流量 / 扬程', '75 m³/h · 35 m'), pr('功率', '15 kW')], lock: '一用一备；调节池液位 < 1.0 m 联锁停泵；故障自动切换' }));
def('LIR1', { kind: 'inst', tag: 'LIRSA 101', name: '调节池液位', unit: 'm', spec: [pr('量程', '0 ~ 8 m')], lock: '低 1.0 m / 高 5.2 m 报警' });
def('PH1', { kind: 'inst', tag: 'AIRSA 102', name: '反应罐 pH', unit: '', spec: [pr('量程', '0 ~ 14')], lock: '设定 9.5；< 8.5 或 > 10.5 报警' });
export const PUMPS = ['PA', 'PB'];
export const D = {}; PUMPS.forEach(id => (D[id] = { run: false, fault: false, auto: true, rt: 0 }));
export const S = { t: 0, demo: true, L: 3.5, qin: 60, q: 0, pH: 9.5, alarms: [], active: {}, hy: {} };
export const run = id => S.demo && D[id].run && !D[id].fault;
const hyst = (k, v, lo, hi) => { const c = S.hy[k]; return (S.hy[k] = v > hi ? true : v < lo ? false : c == null ? v > (lo + hi) / 2 : c); };
export const LIM = { LIR1: [1.0, 1.5, 4.8, 5.2], PH1: [8.5, 8.8, 10.2, 10.5] };   // [低低, 低, 高, 高高]：低低 / 高高 = 报警，低 / 高 = 预警
export const VAL = { LIR1: () => S.L, PH1: () => S.pH };
export const lvl = (k, v) => { const m = LIM[k]; if (!m) return ''; if ((m[0] != null && v < m[0]) || (m[3] != null && v > m[3])) return 'alarm'; if ((m[1] != null && v < m[1]) || (m[2] != null && v > m[2])) return 'warn'; return ''; };

export function emit(l, text) { S.alarms.unshift({ id: 'e' + Math.random(), l, text, t: new Date(), ack: l === 'i', clr: l === 'i' }); S.alarms.length = Math.min(S.alarms.length, 40); }
// 备用泵：在自动且未故障的泵里选 n 台运行，已运行的优先保持；有泵故障时备用泵启动会写一条信息事件
function duty(ids, n, want) {
  const need = want ? n : 0, cand = ids.filter(i => D[i].auto && !D[i].fault).sort((a, b) => D[a].rt - D[b].rt);
  const pick = cand.filter(i => D[i].run).slice(0, need); cand.forEach(i => { if (pick.length < need && !pick.includes(i)) pick.push(i); });
  ids.filter(i => D[i].auto).forEach(i => { const now = pick.includes(i); if (!D[i].run && now && S.t > 2 && ids.some(j => D[j].fault)) emit('i', `${DEV[i].tag} 备用泵自动投运`); D[i].run = now; });
}
export function control() { duty(PUMPS, 1, hyst('pump', S.L, 1.0, 1.4)); }
export function step(dt) {
  if (!S.demo) return;
  S.t += dt; control();
  const ds = dt * SPEED;
  S.qin = 60 + 6 * Math.sin(S.t / 37);
  S.q = PUMPS.filter(run).length ? clamp(S.qin + (S.L - 3.5) * 12, 25, 75) : 0;
  S.L = clamp(S.L + (S.qin - S.q) / 60 / 3600 * ds, 0, 6);
  S.pH += (9.5 + 0.2 * Math.sin(S.t / 23) - S.pH) * (1 - Math.exp(-dt / 6)) + (Math.random() - .5) * 0.02;
  PUMPS.forEach(id => { if (run(id)) D[id].rt += dt; });
  evalAlarms();
}
export function evalAlarms() {
  const now = {};
  for (const k of Object.keys(LIM)) { const v = VAL[k](), l = lvl(k, v); if (l) now[k] = { l: l === 'alarm' ? 'a' : 'w', text: `${DEV[k].name} ${v < LIM[k][1] ? '过低' : '过高'}（${v.toFixed(2)}）` }; }
  PUMPS.forEach(id => { if (D[id].fault) now['f' + id] = { l: 'a', text: `${DEV[id].tag} ${DEV[id].name} 故障停机` }; });
  Object.keys(now).forEach(k => { if (!S.active[k]) { const a = { id: k, ...now[k], t: new Date(), ack: false, clr: false }; S.alarms.unshift(a); S.active[k] = a; } else S.active[k].l = now[k].l; });
  Object.keys(S.active).forEach(k => { if (!now[k]) { S.active[k].clr = true; delete S.active[k]; } });
}
export function warmup(sec = 150) { for (let i = 0; i < sec * 2; i++) step(0.5); S.alarms.length = 0; S.active = {}; }
