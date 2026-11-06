// Rasterize the existing brand SVG with Chromium; no artwork is invented.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
(async () => {
  const root = path.resolve(__dirname,'..');
  const svg = fs.readFileSync(path.join(root,'favicon.svg'),'utf8');
  const folder = path.join(root,'assets/icons');
  fs.mkdirSync(folder,{recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    for (const [name,size,padding] of [['icon-192.png',192,0],['icon-512.png',512,0],['maskable-512.png',512,56],['apple-touch-icon.png',180,0]]) {
      const page = await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
      await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#102b4a}body{padding:${padding}px}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({path:path.join(folder,name)});
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
