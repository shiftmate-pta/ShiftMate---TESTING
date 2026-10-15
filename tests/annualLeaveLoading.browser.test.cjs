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
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Missing':data);});
  }).listen(0,'127.0.0.1');await once(server,'listening');
  browser=await chromium.launch({channel:process.env.UI_BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const days=Array.from({length:14},(_,i)=>[0,1,5,6,7,8,9,10].includes(i)
    ?{code:'A/L',type:'Leave',start:'00:00',finish:'10:00',leaveHours:10,entered:true}
    :{code:'',type:'Off',entered:true});
  const fixture={startDate:'2026-09-20',days,settings:{employmentFraction:.5,partTimeLeaveHours:6,classification:'STO3',classificationOverride:true,rateSource:'agreement',baseRate:44.37,homeLine:'ARMADALE',lease:546.95,gesb:100,postTax:7.4,extraTax:0}};
  await context.addInitScript(f=>{if(!localStorage.getItem('ptaV2Current'))localStorage.setItem('ptaV2Current',JSON.stringify(f));},fixture);
  const url=`http://127.0.0.1:${server.address().port}/`;await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('#gross')?.textContent==='$4,443.78');
  assert.equal(await page.locator('#annualLeavePay').textContent(),'$4,000.08');
  assert.equal(await page.locator('#publicHolidayPay').textContent(),'$443.70');
  assert.match(await page.locator('#leaveCalculationAudit').textContent(),/12\.774123/);
  assert.match(await page.locator('#leaveCalculationAudit').textContent(),/history is unavailable/);
  await page.locator('.nav-button[data-go="settings"]').click();
  assert.equal(await page.locator('#employmentFraction,#partTimeLeaveHours').count(),0);
  assert.equal(await page.locator('#advancedLeaveLoadingSettings').getAttribute('open'),null);
  assert.equal(await page.locator('#loadingHistoryHours').getAttribute('placeholder'),'Unknown');
  await page.locator('#advancedLeaveLoadingSettings summary').click();
  await page.locator('#loadingHistoryYear').fill('2026');
  await page.locator('#loadingHistoryHours').fill('190');
  await page.locator('#loadingHistoryPaid').fill('2640');
  await page.locator('#saveCurrent').click();
  await page.waitForFunction(()=>document.querySelector('#leaveCalculationAudit').textContent.includes('loading ='));
  assert.ok(!(await page.locator('#leaveCalculationAudit').textContent()).includes('history is unavailable'));
  await page.locator('.nav-button[data-go="settings"]').click();
  await page.locator('#loadingHistoryYear').fill('');
  await page.locator('#loadingHistoryHours').fill('');
  await page.locator('#loadingHistoryPaid').fill('');
  await page.locator('#saveCurrent').click();
  await page.waitForFunction(()=>document.querySelector('#gross').textContent==='$4,443.78');
  // Exercise controls and saved data, including the real day-details portal.
  await page.locator('.nav-button[data-go="roster"]').click();
  const holiday=page.locator('.day-card').nth(8);await holiday.locator('.details-button').click();
  await page.locator('.ph-ordinary-day:visible').selectOption('no');
  await page.waitForFunction(()=>document.querySelector('#publicHolidayPay').textContent==='$354.96');
  await page.locator('.ph-ordinary-day:visible').selectOption('yes');
  await page.locator('.ph-ordinary-hours:visible').fill('10');
  await page.waitForFunction(()=>document.querySelector('#publicHolidayPay').textContent==='$443.70');
  await page.locator('.roster-detail-close:visible').click();
  // Complete versioned shell must load without the network, including new module.
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!=null);
  await context.setOffline(true);await page.reload();
  await page.waitForFunction(()=>window.AnnualLeaveLoading&&document.querySelector('#annualLeavePay')?.textContent==='$4,000.08');
  assert.equal(await page.locator('#gross').textContent(),'$4,443.78');
  assert.deepEqual(errors,[]);
  console.log('mobile viewport controls and offline PWA loading tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
