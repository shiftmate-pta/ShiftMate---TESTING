// Run with PLAYWRIGHT_MODULE set to an installed Playwright package.
// Chrome by default; UI_BROWSER_CHANNEL can select another installed channel.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {once}=require('node:events');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let server,browser;
(async()=>{
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)==='.mjs'?'.js':path.extname(file)]||'application/octet-stream'});res.end(error?'Missing':data);});
  }).listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({channel:process.env.UI_BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const fixture={startDate:'2026-10-08',days:[],settings:{classification:'STO3',homeLine:'ARMADALE'}};
  const historical={id:'cycle-2026-09-20',startDate:'2026-09-20',settings:fixture.settings,days:[{code:'A/L',leaveHours:10}]};
  await context.addInitScript(({fixture,historical})=>{
    if(!localStorage.getItem('ptaV2Current'))localStorage.setItem('ptaV2Current',JSON.stringify(fixture));
    if(!localStorage.getItem('ptaV2Cycles'))localStorage.setItem('ptaV2Cycles',JSON.stringify([historical]));
  },{fixture,historical});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('.nav-button[data-go="roster"]').click();
  const day=page.locator('.day-card').first();
  const selector=day.locator('.shift-code');
  await selector.selectOption('SAFEK');
  await page.waitForFunction(()=>document.querySelector('.day-card .finish-time').value==='19:00');
  await day.locator('.details-button').click();
  const finish=page.locator('.finish-time:visible');
  await finish.fill('16:40');
  await finish.dispatchEvent('change');
  await page.locator('#bookOffAnnual').click();
  await page.locator('.verified-training-km:visible').fill('80.8');
  await page.locator('.roster-detail-close:visible').click();
  await page.locator('#rosterSaveCycle').click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ptaV2Current')).days[0]);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ptaV2Current')).days[0].verifiedTrainingKm===80.8);
  const saved=await read();
  assert.equal(saved.bookOffHours,2.33);
  assert.equal(saved.bookOffLeaveType,'annual');
  assert.equal(saved.finish,'16:40');
  assert.deepEqual(await page.evaluate(()=>window.AppStorage.loadCycles().find(c=>c.id==='cycle-2026-09-20')),historical);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller!=null);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.nav-button[data-go="roster"]').click();
  assert.equal(await selector.inputValue(),'SAFEK');
  assert.equal((await read()).verifiedTrainingKm,80.8);
  await selector.selectOption('ARM-ADMIN');
  await page.waitForFunction(()=>document.querySelector('.day-card .finish-time').value==='17:00');
  await day.locator('.details-button').click();
  await page.locator('.posted-finish:visible').fill('16:00');
  await page.locator('.posted-finish:visible').dispatchEvent('change');
  assert.equal(await page.locator('.finish-time:visible').inputValue(),'16:00');
  assert.deepEqual(errors,[]);
  console.log('Mobile training and ADMIN entry, persistence and offline reload passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
