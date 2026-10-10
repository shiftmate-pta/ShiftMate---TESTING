const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('shiftData.js','utf8'),context);
vm.runInContext(fs.readFileSync('payCalculator.js','utf8'),context);

const {
  PayCalc,
  ROSTER_LINES,
  DESIGNATED_LINE_BY_ROSTER,
  SHIFT_DATA
}=context.window;

const settings={
  baseRate:44.37,
  wdMult:1,
  satMult:1.5,
  sunMult:2,
  addHoursMult:1.84,
  weekendOtMult:2,
  annualLeaveLoadingRate:12.5483,
  lease:0,
  gesb:0,
  extraTax:0,
  postTax:0,
  customPublicHolidays:''
};

const rowFor=(code,data,reason='directed')=>({
  code,
  type:'Rostered',
  start:'10:00',
  finish:'18:00',
  offline:true,
  workedRosterLine:data.line,
  offlineShiftCode:code,
  offlineReason:reason,
  hd:false,
  earlyStartHours:0,
  additionalHours:0,
  leaveHours:'',
  annualLeaveHours:0,
  phBenefit:'lieu'
});

let crossLineCombinations=0;
let sameLineCombinations=0;

for(const homeLine of Object.keys(ROSTER_LINES)){
  const homeDesignated=DESIGNATED_LINE_BY_ROSTER[homeLine];
  for(const [code,data] of Object.entries(SHIFT_DATA)){
    if(data.leaveType)continue;
    const workedDesignated=DESIGNATED_LINE_BY_ROSTER[data.line]||data.designatedLine||data.line;
    const result=PayCalc.calculate({
      startDate:'2026-10-05',
      days:[rowFor(code,data)],
      settings:{...settings,homeLine}
    });
    const otherLine=result.allowanceDetails.filter(item=>item.type==='Other line allowance');
    const mileage=result.reimbursementDetails.filter(item=>item.type==='Kilometre reimbursement');

    if(homeDesignated===workedDesignated){
      sameLineCombinations++;
      assert.equal(otherLine.length,0,`${homeLine} -> ${code} incorrectly received other-line pay`);
      assert.equal(mileage.length,0,`${homeLine} -> ${code} incorrectly received mileage`);
      continue;
    }

    crossLineCombinations++;
    assert.equal(otherLine.length,1,`${homeLine} -> ${code} did not receive the one-hour other-line payment`);
    assert.equal(mileage.length,1,`${homeLine} -> ${code} has no kilometre reimbursement route`);
    assert.ok(Number.isFinite(mileage[0].distance)&&mileage[0].distance>0,`${homeLine} -> ${code} has an invalid distance`);

    const neutral=PayCalc.calculate({
      startDate:'2026-10-05',
      days:[rowFor(code,data,'cost-neutral')],
      settings:{...settings,homeLine}
    });
    assert.equal(neutral.allowanceDetails.some(item=>item.type==='Other line allowance'),false,`${homeLine} -> ${code} cost-neutral exchange received other-line pay`);
    assert.equal(neutral.reimbursements,0,`${homeLine} -> ${code} cost-neutral exchange received mileage`);
  }
}

assert.equal(crossLineCombinations,1033,'the expected cross-line combination count changed');
assert.equal(sameLineCombinations,137,'the expected same-line combination count changed');
console.log(`offline allowance coverage passed: ${crossLineCombinations} cross-line and ${sameLineCombinations} same-line shift combinations`);
