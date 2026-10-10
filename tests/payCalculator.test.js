const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('shiftData.js','utf8'),context);
vm.runInContext(fs.readFileSync('payCalculator.js','utf8'),context);
const {PayCalc}=context.window;

const settings={homeLine:'ARMADALE',baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2,annualLeaveLoadingRate:12.5483,lease:646.95,gesb:0,extraTax:0,postTax:7.4,customPublicHolidays:''};
const off=()=>({code:'',type:'Off',start:'',finish:'',offline:false,workedRosterLine:'',offlineReason:'directed'});
const day=(code,type='Rostered',start='',finish='',offline=false,line='')=>({code,type,start,finish,offline,workedRosterLine:line,offlineShiftCode:offline?code:'',offlineReason:'directed',hd:false,earlyStartHours:0,additionalHours:0,leaveHours:'',annualLeaveHours:0,phBenefit:'lieu'});
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<0.005,`${message}: expected ${expected}, got ${actual}`);

const screenshotRoster=[off(),day('21'),day('BR'),day('AR'),day('2A','Rostered','15:30','02:05'),day('2A','Rostered','16:30','03:30'),day('OS','Picked-up OT','15:45','02:45'),day('81','Picked-up OT','14:30','00:30',true,'ELLENBROOK'),off(),off(),off(),day('A/L'),day('A/L'),day('A/L')];
const reconciled=PayCalc.calculate({startDate:'2026-09-06',days:screenshotRoster,settings});
close(reconciled.gross,6267.5357,'reconciled gross');
assert.equal(reconciled.tax,1464,'reconciled tax');
close(reconciled.reimbursements,33.6924,'Ellenbrook kilometre reimbursement');
close(reconciled.net,4182.8781,'reconciled bank deposit');
assert.equal(reconciled.hours.toFixed(1),'102.6','worked hours stay unchanged');

const homeOnly=PayCalc.calculate({startDate:'2026-09-06',days:[day('2A','Picked-up OT')],settings:{...settings,lease:0,postTax:0}});
assert.equal(homeOnly.reimbursements,0,'home-line shifts have no reimbursement');
assert.equal(homeOnly.allowanceDetails.some(item=>item.type==='Other line allowance'),false,'home-line shifts have no other-line payment');

const neutral=[day('81','Picked-up OT','14:30','00:30',true,'ELLENBROOK')];
neutral[0].offlineReason='cost-neutral';
const costNeutral=PayCalc.calculate({startDate:'2026-09-13',days:neutral,settings:{...settings,lease:0,postTax:0}});
assert.equal(costNeutral.reimbursements,0,'cost-neutral exchange has no reimbursement');
assert.equal(costNeutral.allowanceDetails.some(item=>item.type==='Other line allowance'),false,'cost-neutral exchange has no other-line payment');

const knownRoute=PayCalc.calculate({startDate:'2026-09-07',days:[day('30','Picked-up OT','14:45','00:45',true,'PERTH')],settings:{...settings,lease:0,postTax:0}});
close(knownRoute.reimbursements,10.78,'station-matrix reimbursement uses the 2026 rate');
const oldRate=PayCalc.calculate({startDate:'2026-06-01',days:[day('30','Picked-up OT','14:45','00:45',true,'PERTH')],settings:{...settings,lease:0,postTax:0}});
close(oldRate.reimbursements,9.845,'pre-July-2026 reimbursement keeps the prior rate');

console.log('payCalculator regression tests passed');
