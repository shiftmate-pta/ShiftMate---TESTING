const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('agreementData.js','utf8'),context);
vm.runInContext(fs.readFileSync('shiftData.js','utf8'),context);
vm.runInContext(fs.readFileSync('annualLeaveLoading.js','utf8'),context);
vm.runInContext(fs.readFileSync('payCalculator.js','utf8'),context);
const {PayCalc}=context.window;

const settings={classification:'STO3',classificationOverride:true,homeLine:'ARMADALE',baseRate:44.37,wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2,annualLeaveLoadingRate:12.5483,lease:546.95,gesb:100,extraTax:0,postTax:7.4,customPublicHolidays:''};
const off=()=>({code:'',type:'Off',start:'',finish:'',offline:false,workedRosterLine:'',offlineReason:'directed'});
const day=(code,type='Rostered',start='',finish='',offline=false,line='')=>({code,type,start,finish,offline,workedRosterLine:line,offlineShiftCode:offline?code:'',offlineReason:'directed',hd:false,earlyStartHours:0,additionalHours:0,leaveHours:'',annualLeaveHours:0,phBenefit:'lieu'});
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<0.005,`${message}: expected ${expected}, got ${actual}`);

const screenshotRoster=[off(),day('21'),day('BR'),day('AR'),day('2A','Rostered','15:30','02:05'),day('2A','Rostered','16:30','03:30'),day('OS','Picked-up OT','15:45','02:45'),day('81','Picked-up OT','14:30','00:30',true,'ELLENBROOK'),off(),off(),off(),day('A/L'),day('A/L'),day('A/L')];
const reconciled=PayCalc.calculate({startDate:'2026-09-06',days:screenshotRoster,settings});
// Anonymous payroll evidence. Validate components rather than target a deposit.
close(reconciled.breakdown.workedPay,2273.96,'ordinary shifts and Saturday penalty');
close(reconciled.breakdown.annualLeavePay,1714.32,'annual leave including MOU loading');
close(reconciled.breakdown.extrasPay,245.30+44.37,'shift allowances plus separate transfer');
close(reconciled.reimbursements,53.214,'54.3 km at the September rate');
assert.equal(reconciled.reimbursements.toFixed(2),'53.21');
assert.equal(reconciled.reimbursementDetails[0].distance,54.3);
assert.match(reconciled.reimbursementDetails[0].distanceMeta.status,/provisional/);
close(reconciled.allowanceDetails.find(x=>x.type==='Other line allowance').amount,44.37);
// Existing minute-based overtime differs from payroll's decimal-hour lines.
close(reconciled.breakdown.additionalHoursPay,1996.3541333333,'minute-based overtime retained');
close(reconciled.gross+reconciled.reimbursements-6327.23,.2898,'unresolved earnings rounding difference');
assert.notEqual(reconciled.tax,1490,'legacy withholding is not asserted payroll-reconciled');
close(reconciled.deductions.salaryPackaging,546.95);close(reconciled.deductions.superPreTax,100);close(reconciled.deductions.postTax,7.4);
close(reconciled.net,reconciled.gross-546.95-100-reconciled.tax-7.4+reconciled.reimbursements,'net arithmetic checked independently');
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
assert.equal(context.window.LINE_ALLOWANCE_KM.ARMADALE.PC,11,'official route unchanged');
assert.equal(context.window.LINE_ALLOWANCE_PROVISIONAL_KM.ARMADALE.EB,55,'road estimate retained behind payroll-confirmed route');
assert.equal(context.window.LINE_ALLOWANCE_PROVISIONAL_KM.ELLENBROOK.BUR,22.1,'reverse arrangement unchanged');
const otherStation=PayCalc.calculate({startDate:'2026-09-13',days:[day('82','Picked-up OT','14:30','00:30',true,'ELLENBROOK')],settings});
if(otherStation.reimbursementDetails.length)assert.notEqual(otherStation.reimbursementDetails[0].distance,54.3,'54.3 is not a whole-line override');
const oldRate=PayCalc.calculate({startDate:'2026-06-01',days:[day('30','Picked-up OT','14:45','00:45',true,'PERTH')],settings:{...settings,lease:0,postTax:0}});
close(oldRate.reimbursements,9.845,'pre-July-2026 reimbursement keeps the prior rate');

console.log('payCalculator regression tests passed');
