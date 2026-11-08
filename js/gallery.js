import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as F from './factory.js';
import * as FX from './fx.js';
import {listAssets,loadAsset} from './model-assets.js';
const $=id=>document.getElementById(id), entries=[], errors=[];
const renderer=new THREE.WebGLRenderer({canvas:$('renderer'),antialias:true});
const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const composer=new EffectComposer(renderer);composer.renderToScreen=false;
const renderPass=new RenderPass(new THREE.Scene(),new THREE.PerspectiveCamera());
const aoPass=new GTAOPass(renderPass.scene,renderPass.camera,400,240);aoPass.enabled=false;
const bloomPass=new UnrealBloomPass(new THREE.Vector2(400,240),.35,.4,2);
composer.addPass(renderPass);composer.addPass(aoPass);composer.addPass(bloomPass);composer.addPass(new OutputPass());
const copyScene=new THREE.Scene(),copyCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const copyMat=new THREE.ShaderMaterial({uniforms:{map:{value:null}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 v;void main(){gl_FragColor=texture2D(map,v);} ',depthTest:false,depthWrite:false});copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),copyMat));
const defaults={theme:'light',ambient:1.5,sun:3,lightColor:'#fff4e5',azimuth:315,elevation:50,exposure:1,tone:'aces',environment:.5,shadows:true,softness:3,ao:false,aoStrength:1,bloom:true,bloomStrength:.35,effects:true,speed:1,rotate:false,wireframe:false};let config={...defaults},dirty=true,time=0,filter='all',expanded=null;
function group(...objects){const g=new THREE.Group();g.add(...objects);return g;}
function pipe(){return F.pipe([[-4,0,0],[-2,0,0],[-2,2,0],[2,2,0],[2,2,-2],[4,2,-2]],{r:.22,kind:'water'});}
function water(o={}){const m=new THREE.Mesh(new THREE.PlaneGeometry(8,6,1,1),F.waterMaterial({size:[8,6],...o}));m.rotation.x=-Math.PI/2;return m;}
function add(title,api,description,type,build,dark=false){
 const card=document.createElement('article');card.className='card';card.dataset.type=type;
 card.innerHTML=`<div class="view${dark?' darkview':''}"><span class="badge">${String(entries.length+1).padStart(2,'0')} / ${type==='fx'?'EFFECT':type==='model'?'EQUIPMENT':'COMPONENT'}</span><button class="expand">放大 ↗</button></div><div class="caption"><h2>${title}</h2><p>${description}</p><code>${api}</code></div>`;$('grid').append(card);
 const view=card.querySelector('.view');const scene=new THREE.Scene();scene.environment=environment;const camera=new THREE.PerspectiveCamera(34,1,.01,1000);const controls=new OrbitControls(camera,view);controls.enableDamping=true;controls.enablePan=false;controls.autoRotateSpeed=1.1;
 card.querySelector('h2').textContent=title;card.querySelector('.caption p').textContent=description;card.querySelector('code').textContent=api;
 const hemi=new THREE.HemisphereLight('#d5eaff','#7a7166',1.5);const sun=new THREE.DirectionalLight('#fff4e5',3);sun.castShadow=true;sun.shadow.mapSize.set(512,512);sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;scene.add(hemi,sun,sun.target);
 let object;try{object=build();scene.add(object);}catch(e){errors.push(title+': '+e.message);object=new THREE.Group();scene.add(object);}
 const bounds=new THREE.Box3().setFromObject(object);if(bounds.isEmpty())bounds.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(8,6,8));const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const radius=Math.max(size.length()/2,.6);
 controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1.25,.95,1.5).normalize().multiplyScalar(radius*3.4));camera.far=radius*30;camera.updateProjectionMatrix();controls.minDistance=radius*.7;controls.maxDistance=radius*10;controls.update();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(radius*6,radius*6),new THREE.MeshStandardMaterial({color:dark?'#0b1b30':'#e3eaf1',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.set(center.x,bounds.min.y-.05,center.z);floor.receiveShadow=true;scene.add(floor);
 sun.shadow.camera.left=sun.shadow.camera.bottom=-radius*1.8;sun.shadow.camera.right=sun.shadow.camera.top=radius*1.8;sun.shadow.camera.near=.1;sun.shadow.camera.far=radius*12;sun.target.position.copy(center);
 const entry={title,card,view,scene,camera,controls,hemi,sun,center,radius,floor,object,type,dark,home:camera.position.clone()};entries.push(entry);
 card.querySelector('.expand').addEventListener('pointerdown',event=>event.stopPropagation());
 card.querySelector('.expand').onclick=()=>{expanded=entry;$('expanded').append(card);$('modal').hidden=false;document.body.classList.add('expanded');dirty=true;};
}
add('离心泵','pump()','电机、泵壳、进出口与底座。','model',()=>F.pump({}));
add('搅拌机','mixer()','原库自带旋转件动画。','model',()=>F.mixer({shaft:3}));
add('矩形水池','rectTank()','池壁、压顶、栏杆与动态水面。','model',()=>F.rectTank(10,7,3,{}));
add('分格处理池','rectTank({dividers, waters})','同一构造函数的多格、多水色配置。','model',()=>F.rectTank(12,7,3,{dividers:[-2,2],waters:[{x0:-5.55,x1:-2.23,deep:'#6c7040',light:'#b3ae70'},{x0:-1.77,x1:1.77,deep:'#398274',light:'#72b4a0'},{x0:2.23,x1:5.55,deep:'#167dac',light:'#73cce4'}]}));
add('辐流沉淀池','clarifier()','圆池、中心筒与缓慢旋转的刮泥桥。','model',()=>F.clarifier(5,2.5,{}));
add('立式穹顶罐','vTank()','金属罐体、加强环与爬梯。','model',()=>F.vTank(2,6,{rail:true,ladderSide:0}));
add('锥底反应罐','vTank({bottom:"cone"})','同一罐体函数的锥底、支腿配置。','model',()=>F.vTank(2,5,{bottom:'cone',legs:2,mat:F.M.white,rail:true}));
add('敞口圆罐','vTank({open:true,water})','开放顶部与罐内动态水面。','model',()=>F.vTank(3,3,{open:true,water:{},rail:true}));
add('鼓风机柜','blowerCabinet()','双机柜、百叶、底座与接口。','model',()=>F.blowerCabinet());
add('卧式锅炉','boiler()','筒体、燃烧器、烟囱与检修平台。','model',()=>F.boiler());
add('阻火器','flameArrester()','翅片外壳、支架与两侧接口。','model',()=>F.flameArrester());
add('增压撬装','boosterSkid()','组合泵、卧式筒体、仪表与底座。','model',()=>F.boosterSkid());
add('废气洗涤塔','scrubber()','绿色塔体、加强环与观察窗。','model',()=>F.scrubber());
add('离心风机','centrifugalFan()','风机外壳、出口与电机。','model',()=>F.centrifugalFan());
add('圆角管道','pipe()','折线路径生成管道、法兰与流动贴图。','part',pipe);
add('手轮阀门','valve()','阀体、阀杆与红色手轮。','part',()=>F.valve());
add('网格平台','platform()','可调整尺寸的网格地台。','part',()=>F.platform(8,6));
add('折线栏杆','railing()','按路径排列立柱和两层横杆。','part',()=>F.railing([[-3,1],[3,1],[3,-2]],0,{h:1.2}));
add('环形栏杆','ringRailing()','圆形罐顶或圆池周边防护。','part',()=>F.ringRailing(3,0,{}));
add('护笼爬梯','ladder()','梯架、踏步和上部护笼。','part',()=>F.ladder(5));
add('流向箭头','arrowHead()','原库提供的圆锥箭头基础件。','part',()=>{const a=F.arrowHead('water',1);a.rotation.z=-Math.PI/2;return a;});
add('基础几何','box() / cyl()','模型工厂用于拼装设备的盒体和圆柱。','part',()=>group(F.box(2,2,2,F.M.white,-1.8,1,0),(()=>{const c=F.cyl(1,1,3,F.M.steel);c.position.set(1.5,1.5,0);return c;})()));
add('材质样本','M / pipeMat()','钢、白漆、泵体、玻璃、红色与管线材质。','part',()=>{const g=new THREE.Group();[F.M.steel,F.M.white,F.M.pump,F.M.glass,F.M.red,F.pipeMat('water')].forEach((m,i)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.7,32,24),m);b.position.set((i%3-1)*1.8,.7,Math.floor(i/3)*1.8);g.add(b);});return g;});
add('文字贴图','textTex()','运行时绘制文字，贴到设备或标牌上。','part',()=>{const tex=F.textTex([{text:'P-101',size:110},{text:'提升泵',size:70}]);return new THREE.Mesh(new THREE.BoxGeometry(5,2.5,.2),new THREE.MeshStandardMaterial({map:tex,color:'#ffffff'}));});
add('清水波纹','waterMaterial()','原库水面着色器，观察波纹与高光变化。','fx',()=>water());
add('浑水与泡沫','waterMaterial({foam})','配置灰黄绿色水体与泡沫。','fx',()=>water({deep:'#696d38',light:'#b6ad68',foam:.8}));
add('曝气水面','waterMaterial({bubbles})','同一水面着色器的气泡配置。','fx',()=>water({bubbles:1,foam:.6}));
add('发光粒子流','FlowParticles','沿原管线路径运动的粒子和拖尾。','fx',()=>{const p=pipe();const fx=new FX.FlowParticles([{group:p,entry:p.userData.flow,color:'#20e6ff'}],{speed:2});const g=group(p,fx.points);g.userData.particles=fx;return g;},true);
add('地面扫描线','scanFloor()','周期扫描光带与网格。','fx',()=>FX.scanFloor(9,7),true);
add('柔和扫描带','scanFloor({soft:true})','同一扫描特效的柔和配置。','fx',()=>FX.scanFloor(9,7,{soft:true}),true);
add('全息底座','holoBase()','呼吸描边、角标与边缘光晕。','fx',()=>FX.holoBase(8,6),true);
add('报警光柱','beacon()','闪烁光柱与向外扩散的脉冲环。','fx',()=>FX.beacon('#ff4058',5),true);
add('设备全息描边','edgeOverlay()','原泵模型叠加青色几何轮廓线。','fx',()=>{const p=F.pump({scale:2});FX.edgeOverlay(p,{opacity:.9});return p;},true);
add('温度色带','tempColor() / RAMP_CSS','10–105 °C 颜色映射；示例管段展示冷暖变化。','fx',()=>{const g=new THREE.Group();[10,25,40,55,75,105].forEach((t,i)=>{const m=new THREE.MeshStandardMaterial({color:FX.tempColor(t)});const p=F.cyl(.45,.45,1.2,m);p.rotation.z=Math.PI/2;p.position.x=(i-2.5)*1.25;g.add(p);});return g;});
function syncUI(){for(const [key,value] of Object.entries(config)){const el=$(key);if(el.type==='checkbox')el.checked=value;else el.value=value;const out=el.parentElement.querySelector('output');if(out)out.value=typeof value==='number'?String(value):value;}dirty=true;}
for(const key of Object.keys(defaults))$(key).addEventListener('input',e=>{config[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;syncUI();});
$('reset').onclick=()=>{config={...defaults};syncUI();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const presets={day:{...defaults},night:{...defaults,theme:'dark',ambient:.5,sun:1.2,bloomStrength:.8,lightColor:'#aaccff'},side:{...defaults,ambient:.45,sun:4,elevation:15,azimuth:260,softness:1}};config=presets[b.dataset.preset];syncUI();});
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));entries.forEach(e=>e.card.hidden=filter!=='all'&&e.type!==filter);updateCount();});
function updateCount(){$('count').textContent=`${entries.filter(e=>filter==='all'||e.type===filter).length} / ${entries.length} 个样本`;}
function close(){if(!expanded)return;const next=entries[entries.indexOf(expanded)+1];$('grid').insertBefore(expanded.card,next?.card.parentElement===$('grid')?next.card:null);expanded=null;$('modal').hidden=true;document.body.classList.remove('expanded');}
$('close').onclick=close;addEventListener('keydown',e=>{if(e.key==='Escape')close();});
function apply(){document.body.classList.toggle('dark',config.theme==='dark');renderer.shadowMap.enabled=config.shadows;renderer.toneMappingExposure=config.exposure;renderer.toneMapping={aces:THREE.ACESFilmicToneMapping,neutral:THREE.NeutralToneMapping,linear:THREE.LinearToneMapping}[config.tone];aoPass.enabled=config.ao;aoPass.blendIntensity=config.aoStrength;bloomPass.enabled=config.bloom;bloomPass.strength=config.bloomStrength;
 for(const e of entries){const dark=e.dark||config.theme==='dark';e.scene.environmentIntensity=config.environment;e.scene.background=new THREE.Color(dark?'#071426':'#e8eef4');e.floor.material.color.set(dark?'#0b1b30':'#dfe7ef');e.hemi.intensity=config.ambient;e.sun.intensity=config.sun;e.sun.color.set(config.lightColor);e.sun.castShadow=config.shadows;e.sun.shadow.radius=config.softness;e.sun.shadow.blurSamples=12;
 const a=THREE.MathUtils.degToRad(config.azimuth),h=THREE.MathUtils.degToRad(config.elevation);e.sun.position.copy(e.center).add(new THREE.Vector3(Math.cos(a)*Math.cos(h),Math.sin(h),Math.sin(a)*Math.cos(h)).multiplyScalar(e.radius*5));
 e.object.traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(!m.isShaderMaterial)m.wireframe=config.wireframe;}});e.controls.autoRotate=config.rotate;}
 dirty=false;}
let width=0,height=0,last=performance.now(),cw=0,ch=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05)*config.speed;last=now;time+=dt;
 if(width!==innerWidth||height!==innerHeight){width=innerWidth;height=innerHeight;renderer.setSize(width,height,false);}if(dirty)apply();
 F.waterUniforms.uTime.value=config.effects?time:0;FX.holoUniforms.uTime.value=time;for(const a of F.animated)a.update(time,dt);for(const f of F.flowTextures){f.tex.offset.x-=dt*f.speed*.2;f.mesh.visible=config.effects;}
 renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setClearColor('#eef2f6',0);renderer.clear();let visible=0;
 for(const e of entries){if(e.card.hidden||(expanded&&expanded!==e))continue;const r=e.view.getBoundingClientRect();if(r.bottom<0||r.top>height||r.width===0)continue;visible++;e.controls.update();e.camera.aspect=r.width/r.height;e.camera.updateProjectionMatrix();
 e.object.traverse(o=>{if(o.userData.update)o.userData.update(config.effects?time:0);if(o.material?.uniforms?.uTime)o.material.uniforms.uTime.value=config.effects?time:0;});if(e.object.userData.particles){const p=e.object.userData.particles;p.points.visible=config.effects;p.update(dt,renderer,e.camera);p.mat.uniforms.uScale.value*=r.height/1080*.14;}if(e.type==='fx'&&e.dark)e.object.visible=config.effects;
 const w=Math.round(r.width),h=Math.round(r.height);renderer.setScissorTest(false);if(cw!==w||ch!==h){composer.setSize(w,h);cw=w;ch=h;}renderPass.scene=e.scene;renderPass.camera=e.camera;aoPass.scene=e.scene;aoPass.camera=e.camera;aoPass.updateGtaoMaterial({radius:e.radius*.12});composer.render(dt);copyMat.uniforms.map.value=composer.readBuffer.texture;
 renderer.setRenderTarget(null);renderer.setViewport(r.left,height-r.bottom,r.width,r.height);renderer.setScissor(r.left,height-r.bottom,r.width,r.height);renderer.setScissorTest(true);renderer.render(copyScene,copyCamera);
 }renderer.setScissorTest(false);$('status').textContent=errors.length?errors.join(' / '):`已加载 ${entries.length} 个样本 · 当前渲染 ${visible} 格`;
}
syncUI();updateCount();requestAnimationFrame(frame);window.gallery={entries,errors,get config(){return config;},get time(){return time;}};
async function loadLibrary(){try{for(const record of await listAssets()){try{const asset=await loadAsset(record);add('自定义模型','本地导入','用户模型','custom',()=>asset.wrapper);const e=entries.at(-1);e.title=record.name;e.card.querySelector('h2').textContent=record.name;e.card.querySelector('.caption p').textContent=[record.config?.tag,record.config?.kind,record.main].filter(Boolean).join(' · ');e.card.querySelector('code').textContent='本地模型库 · GLB / FBX';e.card.querySelector('.badge').textContent='CUSTOM / 自定义';if(asset.clips.length){const mixer=new THREE.AnimationMixer(asset.root);mixer.clipAction(asset.clips[0]).play();F.animated.push({update:(t,dt)=>mixer.update(dt)});}e.card.hidden=filter!=='all'&&filter!=='custom';}catch(error){errors.push(record.name+' 导入失败：'+error.message);}}updateCount();dirty=true;}catch(error){errors.push('本地模型库读取失败：'+error.message);}}
loadLibrary();
