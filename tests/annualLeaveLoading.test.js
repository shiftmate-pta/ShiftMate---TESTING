const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['agreementData.js','shiftData.js','annualLeaveLoading.js','payCalculator.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const {PayCalc,AnnualLeaveLoading:ALL}=context.window;
const settings={classification:'STO3',classificationOverride:true,baseRate:44.37,homeLine:'ARMADALE',employmentFraction:1,wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2,annualLeaveLoadingRate:12.5483,lease:546.95,gesb:100,postTax:7.4,extraTax:0};
const off=()=>({code:'',type:'Off'});
const annual=(hours=10)=>({code:'A/L',type:'Leave',leaveHours:hours,start:'00:00',finish:'10:00'});
const calc=(days,startDate='2026-09-17',extra={})=>PayCalc.calculate({days,startDate,settings:{...settings,...extra}});
const close=(actual,expected,label='')=>assert.ok(Math.abs(actual-expected)<.005,`${label}: ${actual} != ${expected}`);

const percentages={STO3:.2879,STO2:.2894,STO1:.291,FCO:.313,TO5:.3138,TO4:.3158,TO3:.3178,TO2:.3197,TO1:.3217,TRAINEE:.2};
for(const [classification,percentage] of Object.entries(percentages)){
  const resolved=ALL.resolve({...settings,classification},'2026-08-23');
  assert.equal(resolved.percentage,percentage);
  assert.equal(resolved.baseRate,context.window.PTA_AGREEMENT.rateFor(classification,'2026-08-23').hourly);
  assert.equal(resolved.hourlyLoading,resolved.baseRate*percentage);
}
assert.equal(ALL.resolve(settings,'2026-08-22'),null);
const before=calc([annual()],'2026-08-22');
close(before.breakdown.annualLeavePay,10*(44.37+12.5483),'historical leave unchanged');
close(calc([annual()],'2026-08-23').annualLeaveDetails[0].loadingPay,127.74);
assert.equal(ALL.resolve(settings,'2026-08-23').hourlyLoading,12.774123);
// A substantive anniversary inside the cycle must resolve on each leave date.
const progression={...settings,classificationOverride:false,employmentRole:'TO',toCommencementDate:'2025-09-18',classification:'TO1'};
assert.equal(ALL.resolve(progression,'2026-09-17').classification,'TO1');
assert.equal(ALL.resolve(progression,'2026-09-18').classification,'TO2');
assert.equal(ALL.resolve(progression,'2026-09-18').baseRate,1561.7/40);
const acting=calc([{...annual(),hd:true}]);
close(acting.annualLeaveDetails[0].loadingRate,12.774123,'acting does not inflate loading');
assert.equal(ALL.resolve({...settings,rateSource:'manual',manualBaseRate:50},'2026-09-17').hourlyLoading,50*.2879);

const first=calc([annual(),annual(),annual()]);
close(first.annualLeaveDetails.reduce((s,x)=>s+x.loadingPay,0),383.22);
close(first.breakdown.annualLeavePay,1714.32);
close(first.leaveUsage.annual,30);

const days=Array.from({length:14},off);
for(const index of [0,1,5,6,7,8,9,10])days[index]=annual();
const second=calc(days,'2026-09-20');
assert.equal(second.hours,80);
assert.equal(second.annualLeaveDetails.length,7);
close(second.annualLeaveDetails.slice(0,4).reduce((s,x)=>s+x.loadingPay,0),510.96,'four daily payment lines reproduce 40-hour payroll line');
close(second.annualLeaveDetails.reduce((s,x)=>s+x.loadingPay,0),894.18);
close(second.breakdown.annualLeavePay,4000.08);
close(second.breakdown.publicHolidayPay,443.70);
close(second.gross,4443.78);
close(4444.26-second.gross,.48,'retrospective allowance remains separate');
close(second.leaveUsage.annual,70);
// Withholding engine and CDTX treatment deliberately unchanged in this update.
assert.equal(second.tax,850,'existing annualised estimate, not payroll-verified PAYG');
assert.equal(second.deductions.salaryPackaging,546.95);
assert.equal(second.deductions.superPreTax,100);
assert.equal(second.deductions.postTax,7.4);
close(second.net,2939.43,'arithmetic only, not a target deposit');
assert.notEqual(second.net,2935.91);
const mixed=calc([{code:'Sick',leaveHours:6,annualLeaveHours:4,type:'Leave'}]);
close(mixed.breakdown.annualLeavePay,4*44.37+51.10);
close(mixed.leaveUsage.annual,4);
const phMixed=calc([{code:'Sick',leaveHours:6,annualLeaveHours:4,type:'Leave',phOrdinaryHours:10}],'2026-09-28');
close(phMixed.breakdown.publicHolidayPay,443.7);
assert.equal(phMixed.annualLeaveDetails.length,0);
assert.equal(phMixed.leaveUsage.annual,0);
const ph=calc([annual()],'2026-09-28');
assert.equal(ph.annualLeaveDetails.length,0);
assert.equal(PayCalc.leaveHoursUsed(annual(),new Date('2026-09-28T00:00:00'),settings),0);
close(calc([off()],'2026-09-28').breakdown.publicHolidayPay,354.96);
close(calc([annual()],'2026-09-28',{employmentFraction:.5}).hours,10,'entered holiday hours preserved');
close(calc([off()],'2026-09-28',{employmentFraction:.5}).hours,8,'legacy fraction does not reduce holiday');
close(calc([{...off(),phOrdinaryDay:'no'}],'2026-09-28',{employmentFraction:0}).hours,8);
const lsl=calc([{code:'LSL',leaveHours:10}],'2026-09-28');
assert.equal(lsl.breakdown.publicHolidayPay,0);assert.equal(lsl.leaveUsage.longService,10);
// Old saved part-time settings must not affect full-time entitlements.
const legacy={employmentFraction:.5,partTimeLeaveHours:6};
close(calc([{code:'A/L',leaveHours:''}],'2026-09-17',legacy).leaveUsage.annual,10);
close(calc([annual(6)],'2026-09-17',legacy).leaveUsage.annual,6,'individual entered hours preserved');
close(PayCalc.leaveHoursUsed({code:'A/L',leaveHours:''},new Date('2026-09-17T00:00:00'),legacy),10);
for(const employmentFraction of [0,.5,1,2]){
 const migrated=calc(days,'2026-09-20',{employmentFraction,partTimeLeaveHours:6});
 close(migrated.gross,4443.78);assert.equal(migrated.hours,80);assert.equal(migrated.leaveUsage.annual,70);
}
close(ALL.capFor(2026,200),2648.49);close(ALL.capFor(2026,320),4237.58);
close(ALL.capFor(2026,100,.5),2648.49,'old fraction argument cannot prorate cap');
const fco=calc([annual(200)],'2026-09-17',{classification:'FCO'});
close(fco.annualLeaveDetails[0].loadingPay,2648.49);assert.equal(fco.annualLeaveDetails[0].capped,true);
const fcoExtended=calc([annual(320)],'2026-09-17',{classification:'FCO'});
close(fcoExtended.annualLeaveDetails[0].loadingPay,4237.58);
const cappedPt=calc([annual(100)],'2026-09-17',{classification:'FCO',employmentFraction:.5});
close(cappedPt.annualLeaveDetails[0].loadingPay,1324.25);
close(cappedPt.annualLeaveDetails[0].cap,2648.49,'legacy fraction does not reduce full-time annual ceiling');
const history=calc([annual(10)],'2026-09-17',{loadingHistoryYear:'2026',loadingHistoryHours:'190',loadingHistoryPaid:'2640'});
close(history.annualLeaveDetails[0].loadingPay,8.49,'known previous loading limits remaining cap');
assert.ok(!history.calculationWarnings.some(x=>x.includes('history is unavailable')));
assert.ok(first.calculationWarnings.some(x=>x.includes('history is unavailable')));
assert.ok(calc([annual()],'2027-01-05').calculationWarnings.some(x=>x.includes('2027')));
const spanning=calc([{...annual(),leaveCommencementDate:'2026-12-20'}],'2027-01-05');
assert.equal(spanning.annualLeaveDetails[0].year,2026,'commencement year selects cap for a spanning block');
assert.ok(!spanning.calculationWarnings.some(x=>x.includes('cap for 2027')));
const ptTimes=calc([{code:'A/L',leaveHours:'',start:'00:00',finish:'10:00'}],'2026-09-17',{employmentFraction:.5,partTimeLeaveHours:6});
assert.equal(ptTimes.leaveUsage.annual,10,'legacy part-time average is ignored');
context.window.SHIFT_DATA.Parental={leaveType:'paid-parental',defaultHours:10,times:{monthu:['00:00','10:00']}};
assert.equal(calc([{code:'Parental',leaveHours:10}],'2026-09-28').breakdown.publicHolidayPay,0);
assert.equal(calc([{code:'LWOP',leaveHours:10}],'2026-09-28').breakdown.publicHolidayPay,0);
const unknown=calc([annual()],'2026-09-17',{classification:'',employmentRole:''});
assert.ok(unknown.calculationWarnings.some(x=>x.includes('classification')));
assert.equal(unknown.annualLeaveDetails[0].loadingPay,0,'missing classification never guesses STO3');
console.log('annual leave MOU, payment lines, holiday exclusions and cap tests passed');
