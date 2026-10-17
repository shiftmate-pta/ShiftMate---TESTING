// Coordinates use top-left template pixels; the renderer converts them to PDF points.
// Leave: measured from the July 2026 Word export at 1414 x 2000.
// Swap: measured from the retained blank PTA template at 1241 x 1754.
(() => {
  const field=(x,y,width,height,size=22,extra={})=>({x,y,width,height,size,...extra});
  window.FormPdfFields={
    leave:{
      width:1414,height:2000,template:'./leave-form-template.pdf',
      identity:{name:field(211,260,1138,37),service:field(1087,305,263,36),home:field(279,349,541,36)},
      employee:{name:field(398,1647,361,33,20),date:field(398,1732,361,33,20)},
      rows:{annual:[516,611],lsl:[613,654],illness:[753,794],care:[796,837],unanticipated:[839,907],bereavement:[909,950],dil:[952,992],'paid-parental':[995,1035],'unpaid-parental':[1037,1078],military:[1080,1121],union:[1123,1164],easter:[1166,1206],other:[1209,1249]},
      columns:{start:[619,143],end:[788,159],hours:[973,92],comments:[1091,259]},
      // Actual printed square interiors, not the Wingdings glyph bounding boxes.
      boxes:{contactYes:[674,1328,12,12],contactNo:[762,1328,12,12],evidenceYes:[674,1371,12,12],evidenceNo:[762,1371,12,12]}
    },
    swap:{
      width:1241,height:1754,template:'./shift-change-form-template.png',
      identity:{requestName:field(215,269,369,27,25,{bold:true}),requestService:field(790,269,331,27,25,{bold:true}),partnerName:field(215,1165,369,27,25,{bold:true}),partnerService:field(790,1165,331,27,25,{bold:true})},
      columns:{original:[293,285],requested:[845,276]},
      requestRows:{date:[361,394],shift:[409,442],start:[457,490],finish:[505,538]},
      partnerRows:{date:[1256,1289],shift:[1304,1337],start:[1352,1385],finish:[1400,1433]},
      // Erase only Word placeholder ink. Keep printed borders and labels intact.
      placeholders:[[805,565,321,29],[123,1058,427,31],[554,1058,202,31],[760,1058,371,31],[123,1445,427,34],[554,1445,214,34],[772,1445,359,34]],
      others:field(810,566,311,27,20,{bold:true}),
      requestConfirmation:{name:field(133,1059,405,30,20,{bold:true,align:'center'}),service:field(564,1059,182,30,20,{bold:true,align:'center'}),date:field(770,1059,350,30,20,{bold:true,align:'center'})},
      partnerConfirmation:{name:field(133,1447,405,30,20,{bold:true,align:'center'}),service:field(564,1447,182,30,20,{bold:true,align:'center'}),date:field(780,1447,338,30,20,{bold:true,align:'center'})},
      boxes:{contingent:[607,564,14,14],neutralCost:[547,1012,13,13]}
    }
  };
})();
