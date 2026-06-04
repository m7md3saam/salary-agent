// ========================================================
//  Tax Engine (ported from tested Node module)
// ========================================================
const PERSONAL_EXEMPTION = 20000;
const MARTYRS_RATE = 0.0005;
const INS = { rate:0.11, min:2700, max:16700 };

function getBrackets(net){
  if(net<=600000) return [[40000,0],[55000,.10],[70000,.15],[200000,.20],[400000,.225],[600000,.25],[Infinity,.25]];
  if(net<=700000) return [[55000,.10],[70000,.15],[200000,.20],[400000,.225],[700000,.25],[Infinity,.25]];
  if(net<=800000) return [[70000,.15],[200000,.20],[400000,.225],[800000,.25],[Infinity,.25]];
  if(net<=900000) return [[200000,.20],[400000,.225],[900000,.25],[Infinity,.25]];
  if(net<=1200000) return [[400000,.225],[1200000,.25],[Infinity,.25]];
  return [[Infinity,.275]];
}
const round10 = x => Math.round(x/10)*10;
function annualTaxOnTaxable(t){
  if(t<=0) return 0;
  const base=round10(t), br=getBrackets(base);
  let tax=0, prev=0;
  for(const [ceil,rate] of br){
    if(base>prev){ const slice=Math.min(base,ceil)-prev; tax+=slice*rate; prev=ceil; if(base<=ceil) break; }
    else break;
  }
  return tax;
}
const annualTax = g => annualTaxOnTaxable(Math.max(0,g-PERSONAL_EXEMPTION));
const roundInsWage = w => Math.ceil(w/100)*100;

function netFromGross(o){
  const gross=o.monthlyGross, add=o.add||0, ded=o.deduct||0;
  let insW = roundInsWage(Math.min(Math.max(o.insWage||gross,INS.min),INS.max));
  const insEmp = insW*INS.rate;
  const martyrs = gross*MARTYRS_RATE;
  const monthlyTaxable = gross+add-ded-insEmp;
  const yearTax = annualTax(monthlyTaxable*12);
  const monthlyTax = yearTax/12;
  const net = gross+add-insEmp-martyrs-monthlyTax-ded;
  return {gross,insW,insEmp,martyrs,monthlyTaxable,annualTax:yearTax,monthlyTax,net,add,ded};
}
function grossFromNet(target,o){
  let lo=target, hi=target*3+200000;
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;const r=netFromGross({...o,monthlyGross:mid,insWage:o.insWage||mid});if(r.net<target)lo=mid;else hi=mid;}
  const g=(lo+hi)/2; return netFromGross({...o,monthlyGross:g,insWage:o.insWage||g});
}

function bonusCalc(o){
  const monthlyTaxableSalary = (o.salary||0)+(o.add||0);
  const annualWithout = monthlyTaxableSalary*12 + (o.prior||0);
  const taxWithout = annualTax(annualWithout);
  const bonusTaxable = o.bonusGross - (o.bonusIns||0);
  const annualWith = annualWithout + bonusTaxable;
  const taxWith = annualTax(annualWith);
  const taxOnBonus = taxWith - taxWithout;
  return {
    bonusGross:o.bonusGross, bonusTaxable, bonusIns:o.bonusIns||0,
    annualWithout, annualWith, taxWithout, taxWith, taxOnBonus,
    netBonus: o.bonusGross-(o.bonusIns||0)-taxOnBonus
  };
}
function bonusGrossFromNet(target,o){
  let lo=target, hi=target*3+400000;
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;const r=bonusCalc({...o,bonusGross:mid});if(r.netBonus<target)lo=mid;else hi=mid;}
  const g=(lo+hi)/2; return bonusCalc({...o,bonusGross:g});
}

// ========================================================
//  UI
// ========================================================
const fmt = n => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const num = id => parseFloat(document.getElementById(id).value)||0;

let salMode='net', bonMode='net';

function switchTab(t){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+t).classList.add('active');
}
function toggleAdv(p){
  document.getElementById(p+'-adv').classList.toggle('open');
  document.getElementById(p+'-adv-toggle').classList.toggle('open');
}
function setSalMode(m){
  salMode=m;
  document.getElementById('sal-mode-net').classList.toggle('active',m==='net');
  document.getElementById('sal-mode-gross').classList.toggle('active',m==='gross');
  document.getElementById('sal-main-label').innerHTML = m==='net'
    ? 'إجمالي المرتب الشهري <span class="hint">(جنيه)</span>'
    : 'صافي المرتب المطلوب <span class="hint">(جنيه)</span>';
  document.getElementById('sal-btn').textContent = m==='net' ? 'احسب الصافي' : 'احسب الإجمالي (Gross-Up)';
}
function setBonMode(m){
  bonMode=m;
  document.getElementById('bon-mode-net').classList.toggle('active',m==='net');
  document.getElementById('bon-mode-gross').classList.toggle('active',m==='gross');
  document.getElementById('bon-main-label').innerHTML = m==='net'
    ? 'إجمالي المكافأة <span class="hint">(جنيه)</span>'
    : 'صافي المكافأة المطلوب <span class="hint">(جنيه)</span>';
  document.getElementById('bon-btn').textContent = m==='net' ? 'احسب صافي المكافأة' : 'احسب إجمالي المكافأة (Gross-Up)';
}

function row(k,v,cls=''){return `<div class="br-row ${cls}"><span class="k">${k}</span><span class="v">${v}</span></div>`;}

function calcSalary(){
  const main=num('sal-main'); if(main<=0){alert('من فضلك أدخل قيمة المرتب');return;}
  const o={ add:num('sal-add'), deduct:num('sal-deduct'), insWage: num('sal-inswage')||undefined };
  let r, grossLabel, headLabel, headVal, headCls;
  if(salMode==='net'){
    r=netFromGross({...o,monthlyGross:main});
    headLabel='صافي المرتب الشهري'; headVal=r.net; headCls='';
  } else {
    // gross-up: insWage unknown if not entered → use solved gross
    if(!o.insWage){ r=grossFromNet(main,{add:o.add,deduct:o.deduct}); }
    else { r=grossFromNet(main,o); }
    headLabel='إجمالي المرتب المطلوب'; headVal=r.gross; headCls='green';
  }
  let html=`<div class="headline ${headCls}"><div class="lbl">${headLabel}</div><div class="val">${fmt(headVal)} <span class="unit">ج.م</span></div></div>`;
  html+='<div class="breakdown">';
  html+=row('إجمالي المرتب', fmt(r.gross));
  if(r.add>0) html+=row('استحقاقات داخلة بالوعاء', fmt(r.add));
  html+=row('الأجر التأميني (بعد التقريب)', fmt(r.insW));
  html+=row('حصة الموظف بالتأمينات (11%)', '− '+fmt(r.insEmp),'deduct');
  html+=row('صندوق الشهداء (0.05%)', '− '+fmt(r.martyrs),'deduct');
  if(r.ded>0) html+=row('استقطاعات من الوعاء', '− '+fmt(r.ded),'deduct');
  html+=row('ضريبة الدخل الشهرية', '− '+fmt(r.monthlyTax),'deduct');
  html+=row('صافي المرتب', fmt(r.net),'total');
  html+='</div>';
  html+=`<div class="note">الوعاء الضريبي الشهري: <b>${fmt(r.monthlyTaxable)}</b> ج.م &nbsp;|&nbsp; سنوياً: <b>${fmt(r.monthlyTaxable*12)}</b> ج.م &nbsp;|&nbsp; إجمالي الضريبة السنوية: <b>${fmt(r.annualTax)}</b> ج.م</div>`;
  document.getElementById('sal-result').innerHTML=html;
}

function calcBonus(){
  const main=num('bon-main'); if(main<=0){alert('من فضلك أدخل قيمة المكافأة');return;}
  const o={ salary:num('bon-salary'), add:num('bon-add'), prior:num('bon-prior'), bonusIns:num('bon-ins') };
  let r, headLabel, headVal, headCls;
  if(bonMode==='net'){
    r=bonusCalc({...o,bonusGross:main});
    headLabel='صافي المكافأة'; headVal=r.netBonus; headCls='';
  } else {
    r=bonusGrossFromNet(main,o);
    headLabel='إجمالي المكافأة المطلوب'; headVal=r.bonusGross; headCls='green';
  }
  const monthName = document.getElementById('bon-month').selectedOptions[0].text;
  let html=`<div class="headline ${headCls}"><div class="lbl">${headLabel}</div><div class="val">${fmt(headVal)} <span class="unit">ج.م</span></div></div>`;
  html+='<div class="breakdown">';
  html+=row('إجمالي المكافأة', fmt(r.bonusGross));
  html+=row('حصة الموظف بالتأمينات', '− '+fmt(r.bonusIns),'deduct');
  html+=row('المكافأة الخاضعة للضريبة', fmt(r.bonusTaxable));
  html+=row('ضريبة المكافأة (تسوية '+monthName+')', '− '+fmt(r.taxOnBonus),'deduct');
  html+=row('صافي المكافأة', fmt(r.netBonus),'total');
  html+='</div>';
  html+=`<div class="note"><b>طريقة الحساب (YTD):</b><br>
    الوعاء السنوي بدون المكافأة: <b>${fmt(r.annualWithout)}</b> ← ضريبة: <b>${fmt(r.taxWithout)}</b><br>
    الوعاء السنوي مع المكافأة: <b>${fmt(r.annualWith)}</b> ← ضريبة: <b>${fmt(r.taxWith)}</b><br>
    ضريبة المكافأة = الفرق بين التسويتين = <b>${fmt(r.taxOnBonus)}</b> ج.م</div>`;
  document.getElementById('bon-result').innerHTML=html;
}
