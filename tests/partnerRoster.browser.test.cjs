// PLAYWRIGHT_MODULE=/path/to/playwright PARTNER_BROWSER=webkit node tests/partnerRoster.browser.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {once}=require('node:events');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
let server,browser;
async function run(){
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.pdf':'application/pdf'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 }).listen(0,'127.0.0.1');await once(server,'listening');
 console.log('Launching partner test browser');
 browser=await pw[process.env.PARTNER_BROWSER||'webkit'].launch({headless:true,timeout:30000,...(process.env.PARTNER_BROWSER_EXECUTABLE?{executablePath:process.env.PARTNER_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({...pw.devices['iPhone 13'],timezoneId:'Australia/Perth',acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-18T14:00:00Z')});
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);console.log('App loaded');
 await page.evaluate(()=>{
  const days=Array.from({length:14},(_,i)=>[1,2,3,4,9,10,11,13].includes(i)?{code:'2M',entered:true,type:'Rostered'}:{code:'',entered:true,type:'Off'});
  AppStorage.saveCurrent({startDate:'2026-10-18',settings:{homeLine:'ARMADALE',classification:'STO3',rosterLineNumber:3,rosterLineAnchorDate:'2026-10-18'},days});
 });await page.reload();
 const go=async screen=>{await page.click(`[data-go="${screen}"]`);await page.waitForSelector(`#${screen}.active`)};
 const calendarDay=key=>page.locator(`#calendarMonths [data-key="${key}"]`);
 const shared=async key=>(await calendarDay(key).getAttribute('class')).includes('shared-off');
 assert.equal(await page.locator('.shared-off').count(),0);
 await go('calendar');await calendarDay('2026-10-25').waitFor();
 const initialStars=await page.locator('#calendarMonths .ot-stars').count();
 const initialBorder=await calendarDay('2026-10-25').evaluate(el=>getComputedStyle(el).borderColor);
 await go('settings');await page.click('#partnerRosterSettings summary');
 await page.fill('#partnerName','Example partner');await page.click('#partnerSixFour');
 await page.fill('#partnerAnchor','2026-10-19');await page.fill('#partnerEffective','2026-10-19');
 await page.click('#partnerSave');assert.match(await page.textContent('#partnerMessage'),/saved/);console.log('Partner pattern saved');
 assert.equal(await page.locator('#partnerPattern button').count(),10);
 assert.equal(await page.locator('#partnerPattern .off').count(),4);
 await go('calendar');await calendarDay('2026-10-25').waitFor();
 assert.equal(await shared('2026-10-25'),true);assert.equal(await shared('2026-10-26'),true);
 for(const key of ['2026-10-24','2026-10-27','2026-10-28','2026-10-29'])assert.equal(await shared(key),false,key);
 assert.equal(await page.locator('#calendarMonths .ot-stars').count(),initialStars,'OT stars unchanged');
 assert.equal(await calendarDay('2026-10-25').evaluate(el=>getComputedStyle(el).borderColor),initialBorder,'off border unchanged');
 const tint=await calendarDay('2026-10-25').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.match(tint,/75, 50, 60/,'rose background rendered');
 assert.equal(await page.locator('#calendarMonths .today-marker').count(),1);
 await go('home');assert.equal(await page.locator('#homeWeekStrip .shared-off').count(),2);
 assert.equal(await page.locator('#homeWeekStrip [data-key="2026-10-27"].shared-off').count(),0);
 await page.reload();assert.equal(await page.locator('#homeWeekStrip .shared-off').count(),2,'survives reload');
 await go('settings');await page.click('#partnerRosterSettings summary');
 const preview=key=>page.locator(`#partnerPreview [data-date="${key}"]`);
 await preview('2026-10-25').click();await page.click('#partnerSave');
 await go('calendar');assert.equal(await shared('2026-10-25'),false,'partner overtime overrides off');
 await go('settings');await preview('2026-10-25').click();await page.click('#partnerSave');
 await go('calendar');assert.equal(await shared('2026-10-25'),true,'partner off override');
 await go('settings');await preview('2026-10-25').click();await page.click('#partnerSave');
 await go('calendar');assert.equal(await shared('2026-10-25'),false,'unknown never shades');
 await go('settings');await preview('2026-10-25').click();await page.click('#partnerSave');
 // Verify anchor can be any cycle day, not only day 1.
 await page.fill('#partnerAnchor','2026-10-24');await page.selectOption('#partnerCycleDay','6');await page.click('#partnerSave');
 assert.equal(await page.evaluate(()=>PartnerRoster.stateOn(AppStorage.loadPartnerRoster(),'2026-10-25')),'off');
 // A changed cycle preserves the preceding pattern.
 await page.selectOption('#partnerVersion','new');await page.selectOption('#partnerLength','7');
 await page.fill('#partnerAnchor','2026-11-01');await page.fill('#partnerEffective','2026-11-01');await page.click('#partnerSave');
 assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster().versions.length),2);
 assert.equal(await page.evaluate(()=>PartnerRoster.stateOn(AppStorage.loadPartnerRoster(),'2026-10-25')),'off');
 await page.selectOption('#partnerLength','custom');await page.fill('#partnerCustom','0');await page.click('#partnerSave');
 assert.match(await page.textContent('#partnerMessage'),/valid cycle length/);
 assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster().versions.at(-1).pattern.length),7,'invalid custom cycle not saved');
 await page.fill('#partnerCustom','14');await page.click('#partnerSave');
 assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster().versions.at(-1).pattern.length),14);
 // Manual availability: only entered dates have a known status.
 await page.selectOption('#partnerMode','manual');await page.click('#partnerSave');
 await go('calendar');assert.equal(await page.locator('#calendarMonths .shared-off').count(),0);
 await go('settings');await page.selectOption('#partnerMode','repeat');await page.click('#partnerSave');
 const downloadPromise=page.waitForEvent('download');await page.locator('summary').filter({hasText:'Backup and restore'}).click();await page.click('#exportBackup');
 const download=await downloadPromise,backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(backup.partnerRoster.name,'Example partner');
 page.on('dialog',dialog=>dialog.accept());
 const old={...backup};delete old.partnerRoster;
 await page.setInputFiles('#importBackup',{name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await page.waitForEvent('load');assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster()),null,'old backup clears absent partner data');
 await go('settings');await page.locator('summary').filter({hasText:'Backup and restore'}).click();
 await page.setInputFiles('#importBackup',{name:'new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForEvent('load');assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster().name),'Example partner');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const assetsCached=await page.evaluate(async()=>{
  const assets=['partnerRoster.js','partnerRosterUI.js','partnerRoster.css','storage.js'];
  return (await Promise.all(assets.map(asset=>caches.match('./'+asset)))).every(Boolean);
 });assert.equal(assetsCached,true,'all partner assets cached for offline use');
 if(process.env.PARTNER_SKIP_OFFLINE_RELOAD!=='1'){
  await context.setOffline(true);await page.reload();
 }else console.log('Offline reload skipped: this WebKit host returns an internal navigation error. Asset caching is verified.');
 await go('calendar');assert.equal(await shared('2026-10-25'),true);
 fs.mkdirSync(path.join(root,'tmp','partner-review'),{recursive:true});
 await page.screenshot({path:path.join(root,'tmp','partner-review','calendar.png'),fullPage:true});
 await go('settings');await page.click('#partnerRosterSettings summary');
 await page.screenshot({path:path.join(root,'tmp','partner-review','settings.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'no horizontal overflow');
 await page.click('#partnerRemove');assert.equal(await page.evaluate(()=>AppStorage.loadPartnerRoster()),null);
 assert.equal(await page.locator('.shared-off').count(),0);
 // An untouched own roster without a projection cannot imply a shared off day.
 await page.evaluate(()=>{
  AppStorage.saveCurrent({startDate:'2026-10-18',settings:{},days:Array.from({length:14},()=>({code:'',entered:false,type:'Rostered'}))});
  AppStorage.saveCycles([]);
  AppStorage.savePartnerRoster({mode:'repeat',versions:[{effectiveFrom:'2026-10-01',anchorDate:'2026-10-01',pattern:['off']}],overrides:{}});
 });await page.reload();assert.equal(await page.locator('.shared-off').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Partner browser checks passed: setup, tint, borders/stars, home, persistence, anchor, versions, overrides, manual, validation, backup, cached assets, unknown own days and removal.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.close()});
