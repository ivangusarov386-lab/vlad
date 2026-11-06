// Uses the Playwright and Chromium installed in the prepared cloud environment.
const {chromium} = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(process.env.SITE_ROOT || path.join(__dirname, '..'));
const base = process.env.SITE_BASE || '/vlad/';
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (!u.pathname.startsWith(base)) {res.writeHead(404).end();return;}
  let file = path.resolve(root, './' + decodeURIComponent(u.pathname.slice(base.length)));
  if (!file.startsWith(root + '/') && file !== root) {res.writeHead(403).end();return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!u.pathname.endsWith('/')) {res.writeHead(301,{Location:u.pathname+'/'}).end();return;}
    file = path.join(file,'index.html');
  }
  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  if (!exists) file = path.join(root,'404.html');
  res.writeHead(exists ? 200 : 404, {'Content-Type': types[path.extname(file)] || 'text/plain'});
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    for (const javaScriptEnabled of [true,false]) {
      const context = await browser.newContext({javaScriptEnabled,reducedMotion:'reduce'});
      // External network is intentionally not needed by this local regression test.
      await context.route('**/*',route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',e => errors.push(e.message));
      page.on('response',r => {if(r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);});
      for (const url of ['', 'vpn/iphone/', 'vpn/android/', 'smart-routing/']) {
        for (const width of [390,768,1440]) {
          await page.setViewportSize({width,height:900});
          const response = await page.goto(origin+base+url);
          assert.equal(response.status(),200);
          assert.equal(await page.locator('h1').count(),1);
          assert(await page.locator('h1').isVisible());
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`Overflow at ${url} ${width}`);
          if (javaScriptEnabled && width === 390) {
            await page.locator('#menu').click();
            assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'true');
            await page.locator('#navlinks a').last().click();
            assert.equal(await page.locator('#menu').getAttribute('aria-expanded'),'false');
            await page.goto(origin+base+url);
          }
        }
        if (javaScriptEnabled) {
          const faq = page.locator('.faqitem button').nth(1);
          await faq.click();
          assert.equal(await faq.getAttribute('aria-expanded'),'true');
          assert(await faq.locator('..').locator('.faqanswer').isVisible());
          if (url === '' || url === 'smart-routing/') {
            await page.locator('[data-route="vpn"]').click();
            assert.equal(await page.locator('[data-route="vpn"]').getAttribute('aria-pressed'),'true');
            assert((await page.locator('#route-explain').innerText()).includes('Зарубежный'));
          }
          if (url === '') {
            for (const device of ['iphone','android','windows','macos','tv']) {
              await page.locator(`[data-device="${device}"]`).click();
              assert.equal(await page.locator(`[data-device="${device}"]`).getAttribute('aria-selected'),'true');
              assert.equal(await page.locator('#steps-list .step').count(),3);
              assert.equal(await page.locator('#connect a[href$="vpn/android/"]').count(),1);
            }
            assert.equal(await page.locator('.price-card').count(),4);
          }
        } else if (url) {
          assert((await page.locator('main').innerText()).length > 2000,'Missing static article');
          if(url.startsWith('vpn/')) assert.equal(await page.locator('.seo-steps li').count(),5);
        }
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS: JS ${javaScriptEnabled ? 'on':'off'}, 4 pages × phone/tablet/desktop; metadata/content/menu/FAQ/routes/tabs as applicable.`);
      await context.close();
    }
    const p = await browser.newPage({viewport:{width:390,height:844}});
    await p.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await p.goto(origin+base);
    const annual = p.locator('.price-card.featured');
    await annual.scrollIntoViewIfNeeded();
    await p.waitForTimeout(1200);
    assert(await annual.evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.animationName==='annualPlanPulse')));
    assert.equal(await annual.evaluate(e=>getComputedStyle(e,'::after').animationName),'annualPlanShimmer');
    await p.screenshot({path:'/tmp/flowpass-demo1-pricing.png'});
    await p.goto(origin+base+'vpn/iphone/');
    await p.screenshot({path:'/tmp/flowpass-demo1-iphone.png',fullPage:true});
    await p.goto(origin+base+'smart-routing/');
    await p.locator('#routes').scrollIntoViewIfNeeded();
    await p.screenshot({path:'/tmp/flowpass-demo1-routing.png'});
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.goto(origin+base);
    assert(!await p.locator('.price-card.featured').evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.animationName.startsWith('annualPlan'))));
    await p.setViewportSize({width:1200,height:630});
    await p.goto(origin+base);
    if(process.env.UPDATE_SOCIAL_IMAGE === '1') await p.screenshot({path:path.join(root,'assets/flowpass-social.png')});
    const missing = await p.request.get(origin+base+'missing-page/');
    assert.equal(missing.status(),404);
    console.log('PASS: annual plan animation, reduced motion, custom 404; screenshots saved in /tmp.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
