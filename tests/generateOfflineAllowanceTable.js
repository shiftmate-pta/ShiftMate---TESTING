const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('shiftData.js','utf8'),context);

const {
  ROSTER_LINES,
  DESIGNATED_LINE_BY_ROSTER,
  LINE_ALLOWANCE_KM,
  LINE_ALLOWANCE_VALIDATED_KM,
  LINE_ALLOWANCE_PROVISIONAL_KM,
  SHIFT_STATION_CODE_BY_NAME,
  SHIFT_DATA
}=context.window;

const csv=value=>`"${String(value??'').replaceAll('"','""')}"`;
const rows=[[
  'Home line',
  'Home designated line',
  'Off-line roster',
  'Off-line designated line',
  'Duty start location',
  'Station code',
  'Return km',
  'Distance status',
  'One-hour payment',
  '2026-27 mileage at $0.98/km',
  'Shift codes'
]];

for(const [homeLine,homeLabel] of Object.entries(ROSTER_LINES)){
  const homeDesignated=DESIGNATED_LINE_BY_ROSTER[homeLine];
  const destinations=new Map();

  for(const [shiftCode,data] of Object.entries(SHIFT_DATA)){
    if(data.leaveType)continue;
    const workedDesignated=DESIGNATED_LINE_BY_ROSTER[data.line]||data.designatedLine||data.line;
    if(homeDesignated===workedDesignated)continue;
    const stationCode=data.stationCode||SHIFT_STATION_CODE_BY_NAME[data.name];
    const key=`${data.line}|${stationCode}`;
    const destination=destinations.get(key)||{
      roster:data.line,
      designated:workedDesignated,
      location:data.name,
      stationCode,
      shiftCodes:[]
    };
    destination.shiftCodes.push(shiftCode);
    destinations.set(key,destination);
  }

  for(const destination of [...destinations.values()].sort((a,b)=>a.roster.localeCompare(b.roster)||a.location.localeCompare(b.location))){
    let matrixKey=homeDesignated;
    if(homeDesignated==='NORTHERN_MANDURAH'){
      matrixKey=destination.designated==='SOUTHERN_MANDURAH'
        ? 'NORTHERN_MANDURAH_AUBINGROVE'
        : 'NORTHERN_MANDURAH_BULLCREEK';
    }
    let distance,status;
    if(Object.hasOwn(LINE_ALLOWANCE_KM[matrixKey]||{},destination.stationCode)){
      distance=LINE_ALLOWANCE_KM[matrixKey][destination.stationCode];
      status='Agreement Schedule 2';
    }else if(Object.hasOwn(LINE_ALLOWANCE_VALIDATED_KM[matrixKey]||{},destination.stationCode)){
      distance=LINE_ALLOWANCE_VALIDATED_KM[matrixKey][destination.stationCode];
      status='Validated against supplied payroll test';
    }else{
      distance=LINE_ALLOWANCE_PROVISIONAL_KM[matrixKey]?.[destination.stationCode];
      status='Provisional calculated route';
    }
    if(!Number.isFinite(Number(distance)))throw new Error(`Missing distance: ${homeLine} -> ${destination.roster} ${destination.location}`);

    rows.push([
      homeLabel,
      homeDesignated,
      ROSTER_LINES[destination.roster]||destination.roster,
      destination.designated,
      destination.location,
      destination.stationCode,
      Number(distance).toFixed(2),
      status,
      'Yes — 1 hour at base rate',
      (Number(distance)*.98).toFixed(2),
      destination.shiftCodes.sort().join(' ')
    ]);
  }
}

const notes=[
  ['ShiftMate off-line allowance combination table'],
  ['Generated','10 October 2026'],
  ['Rule','Cross-designated-line directed/rostered work receives one hour at base rate plus the return-kilometre reimbursement. Cost-neutral exchanges receive neither.'],
  ['Agreement distances','Transit Officers Enterprise Agreement 2022, Schedule 2; preserved exactly.'],
  ['Validated distance','Armadale home to Ellenbrook duty start is retained at 34.38 km because it reconciles the supplied actual payroll test.'],
  ['Provisional distances','Network extensions absent from Schedule 2 use OSRM road routes and OpenStreetMap station coordinates. They require replacement if PTA/union supplies an agreed updated table.'],
  []
];

fs.writeFileSync(
  'OFFLINE-ALLOWANCE-COMBINATION-TABLE.csv',
  [...notes,...rows].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n'
);
console.log(`wrote ${rows.length-1} unique home-line/duty-location combinations`);
