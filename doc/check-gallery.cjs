require('fs').mkdirSync('exports',{recursive:true});
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1500,height:1050},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:8080/gallery.html');await page.waitForFunction(()=>window.gallery?.entries.length===34);await page.waitForTimeout(2500);
 await page.screenshot({path:'exports/gallery-models.png'});
 for(let y=800;y<4500;y+=800){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(150);}await page.evaluate(()=>window.scrollTo(0,0));
 const before=await page.evaluate(()=>({count:gallery.entries.length,errors:gallery.errors,time:gallery.time}));
 await page.locator('[data-preset="side"]').click();await page.locator('#shadows').uncheck();await page.waitForTimeout(200);
 const controls=await page.evaluate(()=>({sun:gallery.config.sun,shadows:gallery.config.shadows,light:gallery.entries[0].sun.intensity,cast:gallery.entries[0].sun.castShadow}));
 await page.locator('#ao').check();await page.waitForTimeout(350);await page.locator('#ao').uncheck();
 await page.locator('[data-filter="fx"]').click();await page.locator('[data-preset="night"]').click();await page.waitForTimeout(1600);await page.screenshot({path:'exports/gallery-effects.png'});
 await page.evaluate(()=>window.scrollTo(0,650));await page.waitForTimeout(400);await page.screenshot({path:'exports/gallery-effects-lower.png'});await page.evaluate(()=>window.scrollTo(0,0));
 await page.locator('.card:not([hidden]) .expand').first().click();await page.waitForTimeout(300);const modal=await page.locator('#modal').isVisible();await page.screenshot({path:'exports/gallery-expanded.png'});await page.keyboard.press('Escape');
 await page.locator('#speed').fill('0');const t1=await page.evaluate(()=>gallery.time);await page.waitForTimeout(350);const t2=await page.evaluate(()=>gallery.time);
 const results={before,controls,modal,pause:t1===t2,errors};fs.writeFileSync('doc/gallery-verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();if(errors.length||before.errors.length||!modal||t1!==t2)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
