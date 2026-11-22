const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{}});
for(const file of ['agreementData.js','shiftData.js','annualLeaveLoading.js','payCalculator.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context);
}
const {PayCalc}=context.window;
const settings={classification:'STO3',classificationOverride:true,baseRate:44.37,homeLine:'ARMADALE',
  wdMult:1,satMult:1.5,sunMult:2,addHoursMult:1.84,weekendOtMult:2};
const calculate=(row,overrides={},date='2026-10-08')=>
  PayCalc.calculate({days:[row],startDate:date,settings:{...settings,...overrides}});
const close=(actual,expected,tolerance=.005)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const allowance=(result,type)=>result.allowanceDetails.find(item=>item.type===type);
for(const [code,distance] of [['SAFEK',76.4],['BH',22.6]]){
  const result=calculate({code});
  close(result.hours,10);
  close(result.breakdown.workedPay,443.70);
  close(allowance(result,'Supplementary training penalty').amount,66.56);
  close(allowance(result,'Training travel allowance').amount,44.37);
  assert.equal(result.allowanceDetails.length,2);
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
assert.equal(october.allowanceDetails.length,2);
assert.equal(october.reimbursementDetails.length,1);
assert.equal(bookOff.verifiedTrainingKm,80.8);

const missing=calculate({code:'BH'},{homeLine:'MIDLAND'});
assert.equal(missing.reimbursements,0);
assert.match(missing.calculationWarnings.join(' '),/Training mileage distance is unavailable/);
assert.equal(calculate({code:'SAFEK'},{classification:'TRAINEE'}).allowanceDetails.length,0);
assert.equal(calculate({code:'SAFEK'},{},'2026-10-09').hours,10);

const admin=calculate({code:'ARM-ADMIN'});
close(admin.hours,8);
close(admin.breakdown.workedPay,354.96);
assert.equal(admin.allowanceDetails.length,0);
const away=calculate({code:'PER-ADMIN',workedRosterLine:'ARMADALE'});
close(allowance(away,'Other line allowance').amount,44.37);
assert.equal(away.reimbursementDetails[0].distance,11);
assert.equal(calculate({code:'PER-ADMIN',offlineReason:'cost-neutral'}).reimbursements,0);
const adminOt=calculate({code:'ARM-ADMIN',start:'08:00',finish:'18:00'});
close(adminOt.breakdown.additionalHoursPay,2*44.37*1.84);
for(const leaveType of ['annual','sick']){
  const partial=calculate({code:'ARM-ADMIN',start:'08:00',finish:'14:00',scheduledStart:'08:00',
    scheduledFinish:'16:00',bookOffLeaveType:leaveType,bookOffHours:2});
  close(partial.hours,8);
  close(partial.breakdown.workedPay,6*44.37);
  close(partial.leaveUsage[leaveType==='annual'?'annual':'personal'],2);
  assert.equal(partial.allowanceDetails.length,0);
}
const afternoon=calculate({code:'ARM-ADMIN',start:'11:00',finish:'19:00',scheduledStart:'11:00',scheduledFinish:'19:00'});
assert.ok(allowance(afternoon,'Afternoon allowance'));
assert.equal(allowance(afternoon,'Supplementary training penalty'),undefined);
console.log('Training and administration pay checks passed');
