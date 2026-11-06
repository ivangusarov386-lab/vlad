const {chromium} = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(process.env.SITE_ROOT || path.join(__dirname,'..'));
const base = process.env.SITE_BASE || '/vlad/';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const originalWorker = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const oldName = JSON.parse(originalWorker.match(/const CACHE_NAME = (.*);/)[1]);
let nextRelease = false;
const server = http.createServer((req,res)=>{
  const u = new URL(req.url,'http://localhost');
  if(!u.pathname.startsWith(base)){res.writeHead(404).end();return;}
  let file = path.resolve(root,'./'+decodeURIComponent(u.pathname.slice(base.length)));
  if(!file.startsWith(root+'/') && file!==root){res.writeHead(403).end();return;}
  if(fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  if(!exists) file=path.join(root,'404.html');
  let data = fs.readFileSync(file);
  if(nextRelease && file===path.join(root,'sw.js')) data=Buffer.from(originalWorker.replace(JSON.stringify(oldName),JSON.stringify(oldName+'-test-update')));
  if(nextRelease && file===path.join(root,'index.html')) data=Buffer.from(data.toString().replace('</head>','<meta name="pwa-test-release" content="next"></head>'));
  res.writeHead(exists?200:404,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-cache'});
  res.end(data);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const profile=fs.mkdtempSync(path.join(require('os').tmpdir(),'flowpass-pwa-test-'));
  // A persistent regular profile is required: Chromium rejects app installation
  // in the incognito contexts created by browser.newContext().
  const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox'],viewport:{width:390,height:844},reducedMotion:'reduce'});
  try {
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await context.newPage();
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(origin+base);
    await p.evaluate(()=>navigator.serviceWorker.ready);
    await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const manifest=await (await context.request.get(origin+base+'manifest.webmanifest')).json();
    assert.equal(manifest.start_url,base);assert.equal(manifest.scope,base);assert.equal(manifest.id,base);
    assert.equal(manifest.display,'standalone');assert(manifest.icons.some(i=>i.purpose==='maskable'));
    for(const icon of [...manifest.icons,{src:base+'assets/icons/apple-touch-icon.png',sizes:'180x180'}]) {
      const bytes=await (await context.request.get(origin+icon.src)).body();
      assert.equal(bytes.subarray(1,4).toString(),'PNG');
      assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
    }
    const cdp=await context.newCDPSession(p);
    const appManifest=await cdp.send('Page.getAppManifest');assert.deepEqual(appManifest.errors,[]);
    const eligibility=await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(eligibility.installabilityErrors,[],'Chromium installability requirements failed');
    assert.equal(await p.locator('link[rel="apple-touch-icon"]').count(),1);
    const saved=await p.evaluate(async()=>{const keys=await caches.keys();const cache=await caches.open(keys.find(k=>k.startsWith('flowpass-')));return (await cache.keys()).map(r=>r.url);});
    for(const route of ['', 'vpn/iphone/','vpn/android/','smart-routing/']) assert(saved.includes(origin+base+route));
    assert(saved.every(url=>url.startsWith(origin+base)),'External/private resource cached');
    console.log('PASS: Chromium installability, scoped manifest, PNG sizes, public-only precache.');

    await context.setOffline(true);
    for(const route of ['vpn/android/','smart-routing/','vpn/iphone/','']) {
      const response=await p.goto(origin+base+route);assert.equal(response.status(),200);
      assert(await p.locator('h1').isVisible());
      try {await p.locator('.pwa-offline').waitFor({state:'visible',timeout:5000});}
      catch(error) {
        console.error('Offline diagnostics:',route,errors,await p.evaluate(()=>({online:navigator.onLine,hidden:document.querySelector('.pwa-offline').hidden,status:document.querySelector('.pwa-install-status').textContent,scripts:[...document.scripts].map(s=>s.src)})));
        throw error;
      }
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await p.locator('[data-device="android"]').click();
    assert.equal(await p.locator('#steps-list .step-guide').getAttribute('href'),base+'vpn/android/');
    const missing=await p.goto(origin+base+'not-saved/');assert.equal(missing.status(),503);
    assert.equal(await p.title(),'Нет подключения — Flowpass');
    await p.screenshot({path:'/tmp/flowpass-pwa-offline.png'});
    console.log('PASS: all four pages offline before visiting them; tabs work; unknown offline URL gets explicit 503 fallback.');

    await context.setOffline(false);
    assert.equal((await p.goto(origin+base+'not-saved/')).status(),404);
    await p.goto(origin+base);
    await p.evaluate(()=>caches.open('another-app-keep'));
    // A controlled second release tests the complete waiting -> activate ->
    // reload lifecycle without changing files in the checkout.
    nextRelease=true;
    await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await p.locator('.pwa-update').waitFor({state:'visible',timeout:15000});
    await Promise.all([p.waitForNavigation(),p.locator('.pwa-update button').click()]);
    assert.equal(await p.locator('meta[name="pwa-test-release"]').count(),1);
    const cachesAfter=await p.evaluate(()=>caches.keys());
    assert(!cachesAfter.includes(oldName));assert(cachesAfter.includes(oldName+'-test-update'));
    assert(cachesAfter.includes('another-app-keep'),'Another app cache was deleted');
    await context.setOffline(true);await p.goto(origin+base);
    assert.equal(await p.locator('meta[name="pwa-test-release"]').count(),1,'Offline cache did not update');
    await context.setOffline(false);await p.goto(origin+base);
    await p.evaluate(()=>{
      const event=new Event('beforeinstallprompt');
      event.prompt=async()=>{window.testInstallPrompted=true;};
      event.userChoice=Promise.resolve({outcome:'accepted'});
      window.dispatchEvent(event);
    });
    await p.locator('.pwa-install').click();assert(await p.evaluate(()=>window.testInstallPrompted));
    await p.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    assert(await p.locator('.pwa-install').isHidden());
    await p.setViewportSize({width:844,height:390});
    await p.goto(origin+base);
    await p.locator('#menu').click();
    await p.locator('#navlinks a').last().click();
    assert.equal(await p.locator('#menu').getAttribute('aria-expanded'),'false');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.setViewportSize({width:390,height:844});
    await p.locator('.pwa-help').evaluate(e=>{e.open=true;});
    await p.locator('#install').scrollIntoViewIfNeeded();
    await p.screenshot({path:'/tmp/flowpass-pwa-install.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: update prompt/reload/new offline release; cache isolation; online 404; install event handling (simulated OS confirmation).');
  } finally {await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
