const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{}});
for(const file of ['agreementData.js','shiftData.js','annualLeaveLoading.js','payCalculator.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context);
}
const {PayCalc}=context.window;
const shifts=context.window.SHIFT_DATA;
const settings={classification:'STO3',classificationOverride:true,baseRate:44.37,homeLine:'ARMADALE',
  wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2};
const calculate=(row,overrides={},date='2026-10-08')=>
  PayCalc.calculate({days:[row],startDate:date,settings:{...settings,...overrides}});
const close=(actual,expected,tolerance=.005)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const allowance=(result,type)=>result.allowanceDetails.find(item=>item.type===type);
for(const [code,distance] of [['SAFEK',76.4],['BH',22.6]]){
  const result=calculate({code},{},'2026-10-28');
  close(result.hours,10);
  close(result.breakdown.workedPay,443.70);
  close(allowance(result,'Supplementary training penalty').amount,66.56);
  close(allowance(result,'Training travel allowance').amount,44.37);
  close(allowance(result,'Afternoon allowance').amount,48.70);
  close(result.gross,603.33);
  assert.equal(result.allowanceDetails.length,3);
  assert.equal(result.reimbursementDetails[0].distance,distance);
  assert.equal(result.reimbursementDetails[0].rate,.98);
}

// 8 October payroll component values supplied with the request. The $0.01
// ordinary pay tolerance covers payroll's displayed precision of 7.667 hours.
const bookOff={code:'SAFEK',start:'09:00',finish:'16:40',scheduledStart:'09:00',scheduledFinish:'19:00',
  bookOffHours:2.33,bookOffLeaveType:'annual',verifiedTrainingKm:80.8};
const october=calculate(bookOff);
close(Math.round(october.breakdown.workedPay*100)/100,340.18,.010001);
close(october.annualLeaveDetails[0].basePay,103.38);
close(october.annualLeaveDetails[0].loadingPay,29.76);
close(allowance(october,'Supplementary training penalty').amount,51.03);
close(allowance(october,'Supplementary training penalty').hours,460/60);
close(allowance(october,'Training travel allowance').amount,44.37);
close(october.reimbursements,79.18);
close(october.hours,460/60+2.33);
close(allowance(october,'Afternoon allowance').hours,460/60);
close(allowance(october,'Afternoon allowance').amount,460/60*4.87);
assert.equal(october.allowanceDetails.length,3);
assert.equal(october.reimbursementDetails.length,1);
assert.equal(bookOff.verifiedTrainingKm,80.8);

const missing=calculate({code:'BH'},{homeLine:'MIDLAND'});
assert.equal(missing.reimbursements,0);
assert.match(missing.calculationWarnings.join(' '),/Training mileage distance is unavailable/);
assert.equal(calculate({code:'SAFEK'},{classification:'TRAINEE'}).allowanceDetails.length,0);
assert.equal(calculate({code:'SAFEK'},{},'2026-10-09').hours,10);

const admin=calculate({code:'AD-ARM'});
close(admin.hours,8);
close(admin.breakdown.workedPay,354.96);
assert.equal(admin.allowanceDetails.length,0);
const away=calculate({code:'AD-PER',workedRosterLine:'ARMADALE'});
close(allowance(away,'Other line allowance').amount,44.37);
assert.equal(away.reimbursementDetails[0].distance,10.7);
for(const date of ['2026-10-19','2026-10-20','2026-10-29','2026-10-30']){
  const perth=calculate({code:'PD'},{},date);
  const mileage=perth.reimbursementDetails[0];
  assert.equal(mileage.distance,10.7);
  assert.equal(mileage.rate,.98);
  close(mileage.amount,10.49);
  close(allowance(perth,'Other line allowance').amount,44.37);
}
assert.equal(calculate({code:'PD'},{homeLine:'MIDLAND'}).reimbursementDetails[0].distance,8.2);
assert.equal(calculate({code:'PS'}).reimbursementDetails[0].distance,4.2);
assert.equal(calculate({code:'BH',scheduledStart:'07:00',scheduledFinish:'17:00',start:'07:00',finish:'17:00'}).allowanceDetails.some(item=>item.type==='Afternoon allowance'),false);
assert.equal(calculate({code:'AD-PER',offlineReason:'cost-neutral'}).reimbursements,0);
const adminOt=calculate({code:'AD-ARM',start:'08:00',finish:'18:00'});
close(adminOt.breakdown.additionalHoursPay,2*44.37*1.84);
for(const leaveType of ['annual','sick']){
  const partial=calculate({code:'AD-ARM',start:'08:00',finish:'14:00',scheduledStart:'08:00',
    scheduledFinish:'16:00',bookOffLeaveType:leaveType,bookOffHours:2});
  close(partial.hours,8);
  close(partial.breakdown.workedPay,6*44.37);
  close(partial.leaveUsage[leaveType==='annual'?'annual':'personal'],2);
  assert.equal(partial.allowanceDetails.length,0);
}
const afternoon=calculate({code:'AD-ARM',start:'11:00',finish:'19:00',scheduledStart:'11:00',scheduledFinish:'19:00'});
assert.ok(allowance(afternoon,'Afternoon allowance'));
assert.equal(allowance(afternoon,'Supplementary training penalty'),undefined);
assert.equal(shifts.SAFEK.name,'Kwinana Training');
assert.equal(shifts.BH.name,'Guildford Training');
assert.equal(shifts['AD-CMR'].location,'East Perth Station');
assert.equal(shifts['AD-CMR'].line,'MIDLAND');
assert.equal(shifts['AD-PER'].stationCode,'PC');
for(const [type,expected] of [['Rostered',8*44.37],['Picked-up OT',8*44.37*1.84]]){
  const cmr=calculate({code:'AD-CMR',type}, {}, '2026-10-15');
  close(cmr.breakdown[type==='Rostered'?'workedPay':'additionalHoursPay'],expected);
  assert.equal(cmr.allowanceDetails.length,1);
  close(allowance(cmr,'Other line allowance').amount,44.37);
  close(cmr.reimbursementDetails[0].distance,10.7);
  close(Math.round(cmr.reimbursements*100)/100,10.49);
}
const updatedCmr=calculate({code:'AD-CMR',scheduledStart:'08:00',scheduledFinish:'16:00',start:'08:00',finish:'17:00'});
close(updatedCmr.breakdown.additionalHoursPay,44.37*1.84);
assert.equal(calculate({code:'AD-CMR'},{homeLine:'MIDLAND'}).allowanceDetails.length,0);
assert.equal(calculate({code:'AD-CMR'},{homeLine:'FREMANTLE'}).reimbursements,0);

for(const code of ['SA','SM']){
  const perth=calculate({code},{homeLine:'PERTH'},'2026-10-09');
  const arm=calculate({code:code+'-ARM'},{},'2026-10-09');
  close(arm.hours,perth.hours);
  close(arm.breakdown.workedPay,perth.breakdown.workedPay);
  close(arm.breakdown.additionalHoursPay,perth.breakdown.additionalHoursPay);
  assert.equal(arm.reimbursements,0);
  const awayArm=calculate({code:code+'-ARM',type:'Picked-up OT'},{homeLine:'PERTH'});
  assert.equal(awayArm.reimbursementDetails[0].distance,75.8);
  close(allowance(awayArm,'Other line allowance').amount,44.37);
}
assert.equal(calculate({code:'SA',workedRosterLine:'ARMADALE'}).reimbursements,0);
console.log('Training and administration pay checks passed');
