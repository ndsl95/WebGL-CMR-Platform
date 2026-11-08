// 示例三维布局：调节池 → 提升泵 ×2（一用一备）→ 反应罐 → 出水。单位米，x 向右，z 朝向观察者，y 向上。
// 约定：每个设备 sel(group, title, rows, ids)；泵用 pumpOne / pumpSet；管线 pipe(pts, {kind, r, act})，act = 设备 id，设备运行时才流动。
import * as THREE from 'three';
import * as F from './factory.js';

Object.assign(F.PIPE_COLORS, { raw: '#a6a05a', clean: '#58bde6' });      // 自己的介质色：原水浑浊灰黄绿，达标出水清澈蓝
const PY = 0.35, Y = new THREE.Vector3(0, 1, 0);

export function buildPlant(scene) {
  const labels = [], selectables = [], pumps = [];
  const add = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  const sel = (group, title, rows, ids = [], o = {}) => { const s = { group, title, rows, ids, ...o }; selectables.push(s); return s; };
  const name = (text, x, y, z, o = {}) => labels.push({ kind: 'name', text, pos: new THREE.Vector3(x, y, z), ...o });
  const tag = (ic, key, unit, x, y, z, o = {}) => labels.push({ kind: 'tag', ic, key, unit, pos: new THREE.Vector3(x, y, z), ...o });
  const flow = (text, x, y, z, o = {}) => labels.push({ kind: 'flow', text, pos: new THREE.Vector3(x, y, z), ...o });
  const pipe = (pts, o) => { const g = F.pipe(pts, o); if (o && o.act) g.userData.actId = o.act; scene.add(g); return g; };
  const plabel = (pid, text, x, y, z) => { labels.push({ kind: 'pump', text, pid, pos: new THREE.Vector3(x, y, z) }); pumps.push(pid); };
  // 单台泵：rot = π 进口朝 −x；π/2 朝 −z；−π/2 朝 +z；0 朝 +x。返回进 / 出口世界坐标
  function pumpOne({ id, x, z, rot, scale = 1, label }) {
    const p = F.pump({ scale }); p.position.set(x, PY, z); p.rotation.y = rot; scene.add(p);
    const inl = new THREE.Vector3(1.15, 0.62, 0).multiplyScalar(scale).applyAxisAngle(Y, rot).add(p.position);
    const out = new THREE.Vector3(0.62, 1.45, 0).multiplyScalar(scale).applyAxisAngle(Y, rot).add(p.position);
    plabel(id, label, x, PY + 1.9 * scale, z);
    return { p, inl, out };
  }

  add(F.platform(70, 36), 8, 0, 0);

  // 调节池（原水：浑浊灰黄绿）
  const tk = F.rectTank(14, 10, 4.5, { water: { deep: '#6d6f3f', light: '#b9b583', foam: 0.3, speed: 1.0 } });
  sel(add(tk, -16, PY, 0), '调节池', () => [['液位', 'lv|m'], ['液位计', 'LIRSA 101']], [], { tank: 'LIR1' });
  name('调节池', -16, PY, 6.6);
  tag('L', 'lv', 'm', -16, 6.6, 0);
  pipe([[-30, 5.2, 0], [-20, 5.2, 0], [-20, 3.6, 0]], { kind: 'raw', r: 0.3 });
  flow('来水', -32, 7.2, 0);

  // 提升泵 ×2：从池壁出水 → 泵 → 汇管 → 反应罐
  const zs = [-2.5, 2.5], PXP = -6.5;
  zs.forEach((z, i) => {
    const id = i ? 'PB' : 'PA', p = pumpOne({ id, x: PXP, z, rot: Math.PI, label: i ? '2#' : '1#' });
    sel(p.p, `提升泵 ${i + 1}#`, () => [['状态', 'dev:' + id], ['出口压力', 'pi|MPa']], [id]);
    pipe([[-9.4, 1.6, z], [p.inl.x, p.inl.y, z]], { kind: 'raw', r: 0.2, flow: false });          // 吸水：池壁 → 泵进口
    pipe([[p.out.x, p.out.y, z], [p.out.x, 3.2, z]], { kind: 'raw', r: 0.2, act: id });            // 出口立管
  });
  const ox = PXP - 0.62;
  pipe([[ox, 3.2, zs[0]], [ox, 3.2, zs[1]]], { kind: 'raw', r: 0.26, flow: false });               // 汇管
  pipe([[ox, 3.2, 0], [12, 3.2, 0], [12, 2.6, 0]], { kind: 'raw', r: 0.26 });                       // 去反应罐锥底
  name('提升泵', PXP, PY, 6.2, { sm: true });

  // 反应罐（pH 计 + 数值牌）
  const re = F.vTank(3, 9, { top: 'dome', bottom: 'cone', legs: 2.2, mat: F.M.white, rail: true, ladderSide: Math.PI * 0.2 });
  sel(add(re, 12, PY, 0), '反应罐', () => [['pH', 'ph|'], ['pH 计', 'AIRSA 102']], [], { reactor: 1 });
  name('反应罐', 12, PY, 5.8);
  tag('pH', 'ph', '', 8.4, 15.8, 0);
  pipe([[14.8, 9, 0], [22, 9, 0], [22, 2.4, 0], [28, 2.4, 0]], { kind: 'clean', r: 0.28 });          // 达标出水：清澈蓝
  flow('达标出水', 29, 4.0, 0);

  return { labels, selectables, pumps };
}
