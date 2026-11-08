// 示例页面驱动：引擎 + 三维布局 + 仿真 + 界面。复制后改 plant.js 和 sim.js 即可做新页面。
import { createEngine, defaultLabelEl } from './engine.js';
import * as THREE from 'three';
import { flowTextures } from './factory.js';
import { buildPlant } from './plant.js';
import * as Sim from './sim.js';
const { D, S, DEV, PUMPS, run, lvl, VAL } = Sim;
const $ = id => document.getElementById(id), two = n => String(n).padStart(2, '0');
const QS = new URLSearchParams(location.search);

const OFF = [14, -46];
const VIEWS = {
  all: { target: new THREE.Vector3(8, 0, 2), dist: 150, polar: 0.9, azim: 0, offset: OFF },
  pump: { target: new THREE.Vector3(-8, 2, 0), dist: 70, polar: 0.9, azim: 0 },
  react: { target: new THREE.Vector3(12, 5, 0), dist: 80, polar: 0.9, azim: 0 },
};
const engine = createEngine({ fill: true, view: { ...VIEWS.all, fov: 19, near: 1, far: 800, limits: { minDistance: 30, maxDistance: 260 } }, exportName: () => '示例工艺_工艺流程' });
const plant = buildPlant(engine.scene);
engine.optimize(plant.selectables);

// ---- 数值牌：key → [取值, 小数位]
const G = { lv: [() => S.L, 2], ph: [() => S.pH, 2], pi: [() => (run('PA') || run('PB') ? 0.31 : 0), 2] };
const demo = () => S.demo;
const val = k => (G[k] ? (demo() ? G[k][0]().toFixed(G[k][1]) : '--') : null);
const limKey = { lv: 'LIR1', ph: 'PH1' };

// ---- 标签；设备名称牌前的状态点（正常绿 / 异常红闪 / 离线灰），设备本身不染色
const labelRecs = engine.addLabels(plant.labels, l => {
  const el = defaultLabelEl(l);
  if (l.kind === 'flow' && l.rev) el.classList.add('rev');
  if (l.kind === 'tag' && /^(pi|fc)/.test(l.key)) el.classList.add('sec');          // 次要数值牌：远景隐藏
  return el;
});
const tagEls = labelRecs.filter(r => r.kind === 'tag');
const nameEls = new Map(); labelRecs.filter(r => r.kind === 'name').forEach(r => (nameEls.get(r.text) || nameEls.set(r.text, []).get(r.text)).push(r.el));
const stateOf = s => (!demo() ? 'off' : s.ids.some(i => D[i]?.fault) ? 'fault' : 'ok');

// ---- 悬停 / 详情
const pill = id => (!demo() ? '离线' : D[id].fault ? '故障' : D[id].run ? '运行中' : '停止') + ' · ' + (D[id].auto ? '自动' : '手动');
const specValue = spec => spec.startsWith('dev:') ? `<b>${pill(spec.slice(4))}</b>` : spec.includes('|') ? `<b>${val(spec.split('|')[0]) ?? '--'}</b> ${demo() ? spec.split('|')[1] : ''}` : `<b>${spec}</b>`;
engine.enableHover(plant.selectables, s => `<h4>${s.title}</h4>` + s.rows().map(([k, v]) => `<div class="r"><span>${k}</span><span>${specValue(v)}</span></div>`).join(''));
engine.onClick(s => { if (s?.ids.length) { const id = s.ids[0]; if (!D[id].auto) { D[id].run = !D[id].run; refresh(); engine.toast(`${DEV[id].tag}：${D[id].run ? '手动启动' : '手动停止'}`); } else engine.toast(`${DEV[id].tag}：自动方式（点击不切换；改手动后可启停）`); } });

// ---- 参数卡 / 报警表 / 刷新
$('prows').innerHTML = [['调节池液位', 'lv', 'm'], ['反应罐 pH', 'ph', ''], ['提升泵出口压力', 'pi', 'MPa']].map(([n, k, u]) => `<tr><td class="k">${n}</td><td class="v"><span class="val" data-rx="${k}">0</span><span class="unit">${u}</span></td></tr>`).join('');
function refresh() {
  tagEls.forEach(r => { r.el.querySelector('.v').textContent = val(r.key) ?? '--'; r.el.classList.remove('warn', 'alarm'); const l = limKey[r.key] && demo() ? lvl(limKey[r.key], G[r.key][0]()) : ''; if (l) r.el.classList.add(l); });
  document.querySelectorAll('[data-rx]').forEach(el => (el.textContent = val(el.dataset.rx)));
  document.querySelectorAll('.lbl.pump').forEach(el => { const d = D[el.dataset.pid]; el.classList.toggle('run', !!(demo() && d.run && !d.fault)); el.classList.add('auto'); });
  for (const s of plant.selectables) (nameEls.get(s.title) || []).forEach(el => { el.classList.remove('st-ok', 'st-fault', 'st-off'); el.classList.add('st-' + stateOf(s)); });
  const act = { raw: demo() && S.q > 1, clean: demo() && S.q > 1 };
  for (const f of flowTextures) { const u = f.mesh.parent?.userData || {}; f.mesh.visible = !!act[u.kind] && (!u.actId || run(u.actId)); }   // 指定了设备的管线，只在它运行时流动
  const p = $('plc1'); p.className = 'plc' + (demo() ? ' ok' : ''); p.querySelector('span').textContent = demo() ? '通信正常' : '通信失败';
  const sb = document.querySelector('.sb-warn'); sb.classList.toggle('ok', demo()); sb.lastChild.textContent = demo() ? '服务器连接正常。' : '所有服务器连接失败。';
  const list = demo() ? Sim.S.alarms.slice(0, 3) : [], un = Sim.S.alarms.filter(a => demo() && !a.clr && a.l !== 'i');
  $('alarm-rows').innerHTML = list.length ? list.map(a => `<tr data-id="${a.id}"><td>${a.t.getFullYear()}/${two(a.t.getMonth() + 1)}/${two(a.t.getDate())}</td><td>${two(a.t.getHours())}:${two(a.t.getMinutes())}:${two(a.t.getSeconds())}</td><td${a.clr || a.l === 'i' ? '' : ' style="color:#c62f34;font-weight:600"'}>${a.text}</td><td>${a.ack ? '已确认' : '未确认'}</td><td>${a.clr ? '已恢复' : { a: '报警中', w: '预警', i: '信息' }[a.l]}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">暂无报警信息</td></tr>';
  $('alarm-count').textContent = un.length;
}
$('alarm-rows').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); const a = tr && S.alarms.find(x => x.id === tr.dataset.id); if (a) { a.ack = true; refresh(); } });

// ---- 工具条：演示数据 / 模拟异常 / 复位 / 视角 / 折叠 / 全屏仅场景
function setDemo(v) { S.demo = v; $('demo-toggle').checked = v; if (v) Sim.warmup(150); refresh(); }
$('demo-toggle').addEventListener('change', e => setDemo(e.target.checked));
$('btn-fault').addEventListener('click', () => { if (!demo()) setDemo(true); const id = PUMPS.find(i => run(i)); if (!id) return; D[id].fault = true; D[id].run = false; Sim.control(); Sim.evalAlarms(); refresh(); engine.toast(`${DEV[id].tag} 模拟故障`); });
$('btn-reset-fault').addEventListener('click', () => { PUMPS.forEach(i => (D[i].fault = false)); S.alarms.forEach(a => a.id.startsWith('f') && (a.clr = true)); Object.keys(S.active).forEach(k => k.startsWith('f') && delete S.active[k]); refresh(); });
$('views').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; engine.flyTo({ ...VIEWS[b.dataset.v], offset: VIEWS[b.dataset.v].offset || OFF }, 1400); document.querySelectorAll('#views button').forEach(x => x.classList.toggle('on', x === b)); });
$('fold').addEventListener('click', () => $('param-card').classList.toggle('collapsed'));
const stageEl = $('stage');
engine.onFrame(() => { const far = engine.getView().dist > 170; if (far !== stageEl.classList.contains('far')) stageEl.classList.toggle('far', far); });
{ // 全屏 = 只显示模型场景
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement; let saved = null;
  const sync = () => { const on = !!fsEl(); if (on === stageEl.classList.contains('only')) return; stageEl.classList.toggle('only', on);
    if (on) { saved = engine.getView(); engine.flyTo({ ...saved, dist: saved.dist * 0.7, offset: [0, 10] }, 700); } else if (saved) { engine.flyTo(saved, 700); saved = null; } };
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  $('fs-exit').addEventListener('click', () => (document.exitFullscreen || document.webkitExitFullscreen).call(document));
}

// ---- 启动：?demo=0 离线、?freeze=1 不推进（截图）、?warm=秒 预热、?view=键 直接取视角
S.demo = QS.get('demo') !== '0';
if (S.demo) Sim.warmup(+(QS.get('warm') || 150));
$('demo-toggle').checked = S.demo;
if (VIEWS[QS.get('view')]) engine.setView({ ...VIEWS[QS.get('view')], offset: VIEWS[QS.get('view')].offset || OFF });
refresh();
let last = performance.now();
setInterval(() => { const now = performance.now(), dt = Math.min((now - last) / 1000, 1); last = now; if (demo() && QS.get('freeze') !== '1') Sim.step(dt); refresh(); }, 500);
engine.start();
