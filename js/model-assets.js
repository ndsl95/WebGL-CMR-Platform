import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
const DB='scada-local-models',STORE='assets';
async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(mode,action){const d=await db();try{return await new Promise((resolve,reject)=>{const t=d.transaction(STORE,mode);const r=action(t.objectStore(STORE));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('本地存储操作中断'));});}finally{d.close();}}
export const listAssets=()=>transaction('readonly',s=>s.getAll());
export const saveAsset=a=>transaction('readwrite',s=>s.put(a));
export const getAsset=id=>transaction('readonly',s=>s.get(id));
export async function loadAsset(record){
 const manager=new THREE.LoadingManager(),urls=[],missing=[];const files=record.files;const main=files.find(f=>f.name===record.main);if(!main)throw new Error('缺少主模型文件');
 manager.addHandler(/\.tga$/i,new TGALoader(manager));
 manager.setURLModifier(url=>{if(url.startsWith('data:')||url.startsWith('blob:'))return url;let name;try{name=decodeURIComponent(url).replaceAll('\\','/').split('/').pop();}catch{name=url;}
 const candidates=files.filter(f=>f.name.replaceAll('\\','/').split('/').pop()===name);if(candidates.length!==1){missing.push(name);return 'data:application/octet-stream;base64,';}const objectURL=URL.createObjectURL(candidates[0].blob);urls.push(objectURL);return objectURL;});
 const loaded=new Promise(resolve=>manager.onLoad=resolve);let started=false;manager.onStart=()=>started=true;manager.onError=url=>missing.push(url.startsWith('data:')||url.startsWith('blob:')?'贴图无法解码（请检查图片格式与文件完整性）':url);
 try{const buffer=await main.blob.arrayBuffer();let root,clips;
 if(/\.glb$/i.test(main.name)){const gltf=await new GLTFLoader(manager).parseAsync(buffer,'');root=gltf.scene;clips=gltf.animations;}
 else if(/\.fbx$/i.test(main.name)){root=new FBXLoader(manager).parse(buffer,'');clips=root.animations||[];}
 else throw new Error('请选择 .glb 或 .fbx 模型');
 if(started)await loaded;if(missing.length)throw new Error('缺少或无法读取配套资源：'+[...new Set(missing)].join('、')+'。请连同贴图一起选择；重名贴图请先改名。');
 let meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();}});if(!meshes)throw new Error('文件中没有可显示的网格');
 const wrapper=new THREE.Group(),pivot=new THREE.Group();wrapper.add(pivot);pivot.add(root);const originalBox=new THREE.Box3().setFromObject(root);const originalSize=originalBox.getSize(new THREE.Vector3());if(originalBox.isEmpty()||!Number.isFinite(originalSize.length()))throw new Error('模型包围盒无效');
 // Import placement lives on a separate pivot so animation tracks retain the original root transform.
 if(record.config?.normalize!==false){const center=originalBox.getCenter(new THREE.Vector3());pivot.position.set(-center.x,-originalBox.min.y,-center.z);}
 const result={wrapper,pivot,root,clips,originalSize,record};applyConfig(result,record.config||{});return result;
 }finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
export function applyConfig(asset,c){const w=asset.wrapper;w.position.fromArray(c.position||[0,0,0]);w.rotation.set(...(c.rotation||[0,0,0]).map(THREE.MathUtils.degToRad));w.scale.fromArray(c.scale||[1,1,1]);w.userData={assetId:asset.record.id,name:c.name||asset.record.name,tag:c.tag||'',kind:c.kind||'equipment',nozzles:c.nozzles||{},dynamic:asset.clips.length>0};w.traverse(o=>{if(o.isMesh){o.castShadow=c.castShadow!==false;o.receiveShadow=c.receiveShadow!==false;}});w.updateMatrixWorld(true);}
export function disposeAsset(a){if(!a)return;const geometries=new Set(),materials=new Set(),textures=new Set();a.wrapper.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
