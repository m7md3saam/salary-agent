import { useState, useRef, useEffect } from "react";

const INSURANCE_MIN = 2700;
const INSURANCE_MAX = 16700;

function calcAnnualTax(t) {
  if (t <= 0)       return 0;
  if (t <= 40000)   return 0;
  if (t <= 55000)   return (t - 40000) * 0.10;
  if (t <= 70000)   return 1500  + (t - 55000)  * 0.15;
  if (t <= 200000)  return 3750  + (t - 70000)  * 0.20;
  if (t <= 400000)  return 29750 + (t - 200000) * 0.225;
  if (t <= 1200000) return 74750 + (t - 400000) * 0.25;
  return 274750 + (t - 1200000) * 0.275;
}

function calcNetFromGross(gross, basic) {
  const insWage  = Math.max(INSURANCE_MIN, Math.min(INSURANCE_MAX, basic));
  const siEmp    = insWage * 0.11;
  const martyrs  = gross * 0.0005;
  const taxBase  = Math.max(0, gross * 12 - siEmp * 12 - 20000);
  const taxAnn   = calcAnnualTax(taxBase);
  const taxMo    = taxAnn / 12;
  return { net: gross - siEmp - martyrs - taxMo, siEmp, martyrs, taxMo, taxAnn, taxBase, insWage };
}

function grossUpSalary(targetNet, basic) {
  let g = targetNet / 0.75;
  for (let i = 0; i < 300; i++) {
    const { net } = calcNetFromGross(g, basic || g);
    const d = targetNet - net;
    if (Math.abs(d) < 0.05) break;
    g += d * 0.55;
  }
  return g;
}

function calcBonusTax(monthlyGross, basicSal, bonusGross) {
  const basic    = basicSal || monthlyGross;
  const insWage  = Math.max(INSURANCE_MIN, Math.min(INSURANCE_MAX, basic));
  const siAnn    = insWage * 0.11 * 12;
  const regBase  = Math.max(0, monthlyGross * 12 - siAnn - 20000);
  const taxWith  = calcAnnualTax(regBase + bonusGross);
  const taxWitho = calcAnnualTax(regBase);
  const bonusTax = taxWith - taxWitho;
  const martyrs  = bonusGross * 0.0005;
  const netBonus = bonusGross - bonusTax - martyrs;
  const effRate  = bonusGross > 0 ? (bonusTax / bonusGross) * 100 : 0;
  return { bonusTax, martyrs, netBonus, effRate, regBase };
}

function grossUpBonus(mg, bs, targetNet) {
  let g = targetNet / 0.70;
  for (let i = 0; i < 300; i++) {
    const { netBonus } = calcBonusTax(mg, bs, g);
    const d = targetNet - netBonus;
    if (Math.abs(d) < 0.05) break;
    g += d * 0.5;
  }
  return g;
}

const SYSTEM_PROMPT = `أنت خبير متخصص في حساب الرواتب والمرتبات المصرية. تحسب بدقة صافي الراتب (Net) والإجمالي (Gross-Up) وضريبة المكافآت.

══════════════════
القوانين المعتمدة — محدث 2026
══════════════════

❶ التأمينات | ق.148/2019 | يناير 2026
• عامل: 11% | صاحب عمل: 18.75%
• أجر الاشتراك = الأساسي (Min 2,700 — Max 16,700 ج/شهر)

❷ صندوق الشهداء | ق.4/2021 + ك.دوري 61/2024
• ✅ 5/10,000 = 0.05% من إجمالي الراتب الشهري
• تحقق: 30,000 × 0.05% = 15 ج ✓

❸ إعانة الطوارئ | ق.156/2002
• 1% على صاحب العمل فقط — لا تُخصم من الموظف

❹ ضريبة كسب العمل | ق.7/2024 | مارس 2024
إعفاء شخصي: 20,000 ج/سنة
وعاء = (إجمالي × 12) - (تأمينات سنوية) - 20,000

الشرائح:
0 – 40,000      →  0%
40,001 – 55,000 → 10%
55,001 – 70,000 → 15%
70,001 – 200,000 → 20%
200,001 – 400,000 → 22.5%
400,001 – 1,200,000 → 25%
> 1,200,000 → 27.5%

══════════════════
حساب NET من GROSS
══════════════════
1. أجر التأمين = MAX(2700, MIN(16700, الأساسي))
2. تأمينات = أجر × 11%
3. شهداء = الإجمالي × 0.05%
4. وعاء سنوي = (إجمالي×12) - (تأمينات×12) - 20,000
5. ضريبة سنوية = حسب الشرائح → ÷12 شهرياً
6. الصافي = الإجمالي - تأمينات - شهداء - ضريبة

══════════════════
ضريبة المكافأة — منظومة توحيد الضرائب (YTD)
══════════════════
الضريبة على المكافأة = ضريبة(وعاء سنوي + مكافأة) − ضريبة(وعاء سنوي)
صافي المكافأة = الإجمالي − ضريبة المكافأة − صندوق الشهداء (0.05%)
للـ Gross-Up: iteration حتى دقة <0.1 ج

قواعد الرد:
• حسابات خطوة بخطوة مع الأرقام الدقيقة
• جدول واضح: إجمالي — خصومات — صافي
• اذكر دائماً المرجع القانوني
• رد بنفس لغة المستخدم
• احسب لأقرب جنيه`;

const fmt = n => Math.round(n||0).toLocaleString("ar-EG");
const fd  = n => (n||0).toFixed(2);

function NInput({ label, value, onChange, help }) {
  return (
    <div>
      <label style={{fontSize:11.5,color:"rgba(195,200,220,0.62)",display:"block",marginBottom:5}}>{label}</label>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder="0"
        style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(218,165,32,0.2)",
          borderRadius:10,padding:"10px 14px",color:"#f0c040",fontSize:16,fontWeight:700,
          outline:"none",boxSizing:"border-box",fontFamily:"inherit",textAlign:"center",transition:"border-color 0.2s"}}
        onFocus={e=>e.target.style.borderColor="rgba(218,165,32,0.55)"}
        onBlur={e=>e.target.style.borderColor="rgba(218,165,32,0.2)"}/>
      {help&&<div style={{fontSize:10.5,color:"rgba(135,140,165,0.42)",marginTop:3}}>{help}</div>}
    </div>
  );
}

function Btn({ onClick, label, color }) {
  const c = color||"#b8860b,#daa520";
  return (
    <button onClick={onClick} style={{width:"100%",marginTop:16,padding:13,
      background:`linear-gradient(135deg,${c})`,border:"none",borderRadius:12,
      color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",
      boxShadow:`0 4px 16px rgba(218,165,32,0.28)`}}>
      {label}
    </button>
  );
}

function Card({ icon, label, val, color }) {
  return (
    <div style={{background:`${color}09`,border:`1px solid ${color}25`,borderRadius:13,padding:"13px 14px",textAlign:"center"}}>
      <div style={{fontSize:20,marginBottom:3}}>{icon}</div>
      <div style={{fontSize:10,color:"rgba(175,180,210,0.55)",marginBottom:3}}>{label}</div>
      <div style={{fontSize:17,fontWeight:800,color}}>{val}</div>
    </div>
  );
}

function Row({ label, val, note, color, bold, border }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
      padding:bold?"6px 0":"4px 0",color:color||"rgba(195,200,228,0.72)",
      borderTop:border?"1px solid rgba(255,255,255,0.07)":undefined,
      marginTop:border?8:0,paddingTop:border?10:undefined}}>
      <span style={{fontWeight:bold?700:400,fontSize:bold?13.5:13}}>
        {label} {note&&<span style={{fontSize:10,opacity:.5}}>{note}</span>}
      </span>
      <span style={{fontWeight:bold?800:600,fontSize:bold?15:13}}>{val} ج</span>
    </div>
  );
}

function Legal({ text }) {
  return (
    <div style={{marginTop:14,background:"rgba(218,165,32,0.04)",border:"1px solid rgba(218,165,32,0.13)",
      borderRadius:10,padding:"8px 12px",fontSize:10.5,color:"rgba(165,170,195,0.48)",lineHeight:1.6}}>
      📌 {text}
    </div>
  );
}

// ─── NET TAB ───
function NetTab() {
  const [gross,setGross]=useState("");
  const [basic,setBasic]=useState("");
  const [mode,setMode]=useState("gtn");
  const [res,setRes]=useState(null);
  const p=s=>parseFloat((s||"").replace(/,/g,""))||0;
  const calc=()=>{
    const g=p(gross),b=p(basic)||p(gross);
    if(!g)return;
    if(mode==="gtn"){
      const r=calcNetFromGross(g,b);
      setRes({...r,gross:g,basic:b,mode:"gtn"});
    }else{
      const grossOut=grossUpSalary(g,b);
      const r=calcNetFromGross(grossOut,b);
      setRes({...r,gross:grossOut,basic:b,targetNet:g,mode:"ntg"});
    }
  };
  return (
    <div style={{maxWidth:700,margin:"0 auto",paddingBottom:20}}>
      <div style={{display:"flex",gap:5,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:4,marginBottom:18}}>
        {[{id:"gtn",l:"📊 Gross → Net"},{id:"ntg",l:"🔄 Net → Gross Up"}].map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);setRes(null);}}
            style={{flex:1,padding:"9px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12.5,
              background:mode===m.id?"rgba(218,165,32,0.18)":"transparent",
              color:mode===m.id?"#f0c040":"rgba(175,180,210,0.48)",transition:"all .2s"}}>{m.l}</button>
        ))}
      </div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(218,165,32,0.15)",borderRadius:16,padding:22,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <NInput label={mode==="gtn"?"الراتب الإجمالي (ج/شهر)":"الصافي المطلوب (ج/شهر)"} value={gross} onChange={setGross} help={mode==="gtn"?"كامل ما يتقاضاه الموظف":"المبلغ الذي يصل للموظف"} />
          <NInput label="المرتب الأساسي (ج/شهر)" value={basic} onChange={setBasic} help="اتركه فارغاً إذا = الإجمالي" />
        </div>
        <Btn onClick={calc} label={mode==="gtn"?"🧮 احسب الصافي":"🔄 احسب Gross Up"} />
      </div>
      {res&&(
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(80,200,120,0.2)",borderRadius:16,padding:22,animation:"fadeIn .3s ease"}}>
          {res.mode==="ntg"&&<div style={{color:"#90c8ff",fontSize:12,marginBottom:12,background:"rgba(100,180,255,0.07)",border:"1px solid rgba(100,180,255,0.18)",borderRadius:9,padding:"8px 12px"}}>🔄 Grossing Up: صافي {fmt(res.targetNet)} ج → إجمالي {fmt(res.gross)} ج</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
            <Card icon="💰" label="الإجمالي" val={`${fmt(res.gross)} ج`} color="#f0c040"/>
            <Card icon="📉" label="إجمالي الخصومات" val={`${fmt(res.siEmp+res.martyrs+res.taxMo)} ج`} color="#ff7070"/>
            <Card icon="✅" label="الصافي" val={`${fmt(res.net)} ج`} color="#80e090"/>
          </div>
          <Row label="أجر الاشتراك التأميني" val={fmt(res.insWage)} note="(2,700–16,700)" color="rgba(190,195,225,0.6)"/>
          <Row label="تأمينات اجتماعية — العامل (11%)" val={`- ${fmt(res.siEmp)}`} color="#ff9090"/>
          <Row label="صندوق الشهداء (0.05% من الإجمالي)" val={`- ${fd(res.martyrs)}`} color="#ffb070" note="ق.4/2021"/>
          <Row label="وعاء الضريبة السنوي" val={`${fmt(res.taxBase)} / سنة`} color="rgba(175,180,210,0.52)"/>
          <Row label="الضريبة السنوية" val={fmt(res.taxAnn)} color="rgba(175,180,210,0.52)"/>
          <Row label="الضريبة الشهرية" val={`- ${fd(res.taxMo)}`} color="#ff9090"/>
          <Row label="✅ صافي الراتب" val={fmt(res.net)} color="#80e090" bold border/>
          <Row label="🏢 إعانة الطوارئ (1% — على الشركة)" val={fmt(res.insWage*0.01)} color="#70c0ff" note="لا تُخصم من الموظف"/>
          <Row label="💼 تأمينات صاحب العمل (18.75%)" val={fmt(res.insWage*0.1875)} color="#a0a0d0"/>
          <Legal text="ق.148/2019 (تأمينات 2026) • ق.7/2024 (ضريبة) • ق.4/2021+ك.61/2024 (شهداء 0.05%) • ق.156/2002 (طوارئ)"/>
        </div>
      )}
    </div>
  );
}

// ─── BONUS TAB ───
function BonusTab() {
  const [mg,setMg]=useState("");
  const [bs,setBs]=useState("");
  const [bi,setBi]=useState("");
  const [mode,setMode]=useState("gb");
  const [res,setRes]=useState(null);
  const p=s=>parseFloat((s||"").replace(/,/g,""))||0;
  const calc=()=>{
    const mg_=p(mg),bs_=p(bs)||p(mg),bi_=p(bi);
    if(!mg_||!bi_)return;
    if(mode==="gb"){
      const r=calcBonusTax(mg_,bs_,bi_);
      setRes({...r,grossBonus:bi_,mg:mg_,bs:bs_,mode:"gb"});
    }else{
      const gb=grossUpBonus(mg_,bs_,bi_);
      const r=calcBonusTax(mg_,bs_,gb);
      setRes({...r,grossBonus:gb,targetNet:bi_,mg:mg_,bs:bs_,mode:"nb"});
    }
  };
  return (
    <div style={{maxWidth:700,margin:"0 auto",paddingBottom:20}}>
      <div style={{background:"rgba(100,180,255,0.06)",border:"1px solid rgba(100,180,255,0.18)",borderRadius:13,padding:"13px 17px",marginBottom:18,fontSize:12.5,lineHeight:1.75,color:"rgba(175,210,255,0.72)"}}>
        <strong style={{color:"#90c8ff"}}>📋 منظومة توحيد الضرائب — طريقة حساب المكافأة</strong><br/>
        ضريبة المكافأة = ضريبة(وعاء سنوي + مكافأة) − ضريبة(وعاء سنوي)<br/>
        <span style={{fontSize:11,opacity:.7}}>المكافأة تُضاف للوعاء السنوي وتُحسب الضريبة الهامشية المتزايدة فقط</span>
      </div>
      <div style={{display:"flex",gap:5,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:4,marginBottom:18}}>
        {[{id:"gb",l:"📊 Gross Bonus → Net"},{id:"nb",l:"🔄 Net Bonus → Gross Up"}].map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);setRes(null);}}
            style={{flex:1,padding:"9px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12.5,
              background:mode===m.id?"rgba(100,180,255,0.15)":"transparent",
              color:mode===m.id?"#90c8ff":"rgba(175,180,210,0.48)",transition:"all .2s"}}>{m.l}</button>
        ))}
      </div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(100,180,255,0.2)",borderRadius:16,padding:22,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <NInput label="الراتب الإجمالي الشهري (ج)" value={mg} onChange={setMg} help="لتحديد الوعاء الضريبي الحالي"/>
          <NInput label="الأساسي الشهري (ج)" value={bs} onChange={setBs} help="اتركه فارغاً إذا = الإجمالي"/>
        </div>
        <NInput label={mode==="gb"?"المكافأة الإجمالية (ج)":"صافي المكافأة المطلوب (ج)"} value={bi} onChange={setBi}
          help={mode==="gb"?"المبلغ قبل خصم الضريبة":"المبلغ الذي يصل للموظف"}/>
        <Btn onClick={calc} label={mode==="gb"?"🧮 احسب صافي المكافأة":"🔄 Gross Up للمكافأة"} color="#1a6eb8,#2a9ae8"/>
      </div>
      {res&&(
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(80,200,120,0.2)",borderRadius:16,padding:22,animation:"fadeIn .3s ease"}}>
          {res.mode==="nb"&&<div style={{color:"#90c8ff",fontSize:12,marginBottom:12,background:"rgba(100,180,255,0.07)",border:"1px solid rgba(100,180,255,0.18)",borderRadius:9,padding:"8px 12px"}}>🔄 Gross-Up: صافي مكافأة {fmt(res.targetNet)} ج → إجمالي {fmt(res.grossBonus)} ج</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
            <Card icon="🎁" label="إجمالي المكافأة" val={`${fmt(res.grossBonus)} ج`} color="#f0c040"/>
            <Card icon="📊" label="نسبة الضريبة الفعلية" val={`${res.effRate.toFixed(1)}%`} color="#ff9090"/>
            <Card icon="✅" label="صافي المكافأة" val={`${fmt(res.netBonus)} ج`} color="#80e090"/>
          </div>
          <div style={{fontSize:11.5,color:"rgba(175,180,210,0.5)",marginBottom:8,borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:8}}>تفاصيل وفق منظومة توحيد الضرائب (YTD):</div>
          <Row label="وعاء الراتب السنوي (بدون مكافأة)" val={`${fmt(res.regBase)} / سنة`} color="rgba(180,185,210,0.58)"/>
          <Row label="+ المكافأة الإجمالية" val={`${fmt(res.grossBonus)}`} color="#f0c040"/>
          <Row label="= الوعاء السنوي الجديد" val={`${fmt(res.regBase+res.grossBonus)} / سنة`} color="rgba(180,185,210,0.58)"/>
          <Row label="ضريبة المكافأة الهامشية" val={`- ${fd(res.bonusTax)}`} color="#ff9090"/>
          <Row label="صندوق الشهداء على المكافأة (0.05%)" val={`- ${fd(res.martyrs)}`} color="#ffb070"/>
          <Row label="✅ صافي المكافأة" val={fmt(res.netBonus)} color="#80e090" bold border/>
          <div style={{marginTop:13,background:"rgba(100,180,255,0.05)",border:"1px solid rgba(100,180,255,0.15)",borderRadius:10,padding:"9px 13px",fontSize:11.5,color:"rgba(155,200,255,0.62)",lineHeight:1.7}}>
            💡 الشريحة الهامشية الفعلية على هذه المكافأة = <strong style={{color:"#90c8ff"}}>{res.effRate.toFixed(2)}%</strong>
            <br/>الدخل السنوي الإجمالي مع المكافأة = {fmt(res.regBase + res.grossBonus + 20000)} ج (قبل الإعفاء)
          </div>
          <Legal text="منظومة توحيد الضرائب: ضريبة(وعاء+مكافأة) − ضريبة(وعاء) • ق.7/2024 • ق.4/2021 (شهداء 0.05%) — للاسترشاد فقط"/>
        </div>
      )}
    </div>
  );
}

// ─── CHAT TAB ───
function ChatTab() {
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);
  const taRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,loading]);

  const send=async(text)=>{
    const msg=(text||input).trim();
    if(!msg||loading)return;
    setInput("");
    const next=[...msgs,{role:"user",content:msg}];
    setMsgs(next);
    setLoading(true);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8192,
          system:SYSTEM_PROMPT,messages:next.map(m=>({role:m.role,content:m.content}))})});
      const d=await r.json();
      setMsgs([...next,{role:"assistant",content:d.content?.[0]?.text||"حدث خطأ."}]);
    }catch{
      setMsgs([...next,{role:"assistant",content:"⚠️ خطأ في الاتصال."}]);
    }finally{setLoading(false);}
  };

  const qs=[
    "احسب Net لراتب إجمالي 30,000 وأساسي 12,000 ج",
    "Grossing up: صافي 20,000 ج — إيه الإجمالي؟",
    "موظف Gross 25,000 — مكافأة صافية 15,000 — الإجمالي؟",
    "احسب ضريبة مكافأة 50,000 لموظف راتبه 40,000 ج",
    "الفرق بين ضريبة الراتب والمكافأة في المنظومة الموحدة",
    "احسب إعانة الطوارئ لـ 80 موظف أساسيهم 8,000 ج"
  ];

  return (
    <>
      <div style={{flex:1,overflowY:"auto",padding:"18px 18px 0"}}>
        {msgs.length===0&&(
          <div style={{textAlign:"center",paddingTop:14}}>
            <div style={{fontSize:38,marginBottom:10}}>🏛️</div>
            <h2 style={{color:"#f0c040",margin:"0 0 6px",fontSize:19,fontWeight:700}}>مساعد الرواتب — Egytrans & NOSCO</h2>
            <p style={{color:"rgba(170,175,205,0.58)",margin:"0 0 20px",fontSize:12.5,lineHeight:1.7}}>
              Net • Gross-Up • ضريبة المكافآت • إعانة الطوارئ<br/>
              <span style={{fontSize:10.5}}>محدث 2026 — شهداء 0.05% ✓ — منظومة توحيد الضرائب ✓</span>
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,maxWidth:620,margin:"0 auto"}}>
              {qs.map(q=>(
                <button key={q} onClick={()=>{setInput(q);taRef.current?.focus();}}
                  style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(218,165,32,0.13)",
                    borderRadius:10,padding:"10px 13px",color:"rgba(200,205,230,0.8)",
                    cursor:"pointer",textAlign:"right",fontSize:12,lineHeight:1.5,transition:"all .2s",fontFamily:"inherit"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(218,165,32,0.08)";e.currentTarget.style.borderColor="rgba(218,165,32,0.3)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(218,165,32,0.13)";}}
                >{q}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",gap:9,marginBottom:15,alignItems:"flex-start",animation:"fadeIn .25s ease"}}>
            <div style={{width:33,height:33,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
              background:m.role==="user"?"linear-gradient(135deg,#1a3a6e,#2a5aae)":"linear-gradient(135deg,#b8860b,#daa520)"}}>
              {m.role==="user"?"👤":"⚖️"}
            </div>
            <div style={{maxWidth:"76%",background:m.role==="user"?"rgba(26,58,110,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${m.role==="user"?"rgba(100,150,255,0.17)":"rgba(218,165,32,0.13)"}`,
              borderRadius:m.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",
              padding:"11px 14px",color:m.role==="user"?"rgba(175,210,255,0.9)":"rgba(215,220,240,0.88)",
              fontSize:13,lineHeight:1.85,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:9,marginBottom:15,alignItems:"flex-start"}}>
            <div style={{width:33,height:33,borderRadius:10,background:"linear-gradient(135deg,#b8860b,#daa520)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚖️</div>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(218,165,32,0.13)",borderRadius:"4px 16px 16px 16px",padding:"12px 17px",display:"flex",gap:5}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#c8a030",animation:`pulse 1.1s ${i*.18}s infinite ease-in-out`}}/>)}
            </div>
          </div>
        )}
        <div ref={endRef} style={{height:8}}/>
      </div>
      <div style={{background:"rgba(0,0,0,0.38)",backdropFilter:"blur(16px)",borderTop:"1px solid rgba(218,165,32,0.11)",padding:"11px 18px 13px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(218,165,32,0.19)",borderRadius:13,padding:"7px 7px 7px 13px"}}>
          <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="اسأل عن Net، Gross-Up، ضريبة المكافأة، إعانة الطوارئ..."
            rows={1} style={{flex:1,background:"transparent",border:"none",outline:"none",
              color:"rgba(215,220,240,0.9)",fontSize:13,resize:"none",fontFamily:"inherit",lineHeight:1.65,padding:"4px 0",maxHeight:85,overflowY:"auto"}}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()}
            style={{width:36,height:36,borderRadius:10,border:"none",flexShrink:0,cursor:loading||!input.trim()?"not-allowed":"pointer",
              background:loading||!input.trim()?"rgba(218,165,32,0.1)":"linear-gradient(135deg,#b8860b,#daa520)",
              fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:loading||!input.trim()?"none":"0 2px 10px rgba(218,165,32,0.28)",transition:"all .2s"}}>
            {loading?"⏳":"▲"}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:6,color:"rgba(125,130,155,0.36)",fontSize:10}}>Enter للإرسال • Shift+Enter سطر جديد • للاسترشاد فقط</div>
      </div>
    </>
  );
}

// ─── MAIN ───
export default function App() {
  const [tab,setTab]=useState("chat");
  const tabs=[{id:"chat",l:"💬 محادثة AI"},{id:"net",l:"📊 Net / Gross-Up"},{id:"bonus",l:"🎁 مكافأة Bonus"}];
  return (
    <div style={{minHeight:"100vh",maxHeight:"100vh",overflow:"hidden",
      background:"linear-gradient(155deg,#060d1a 0%,#0b1930 45%,#071220 100%)",
      fontFamily:"'Cairo','Noto Sans Arabic',system-ui,sans-serif",
      display:"flex",flexDirection:"column",direction:"rtl",color:"#dde"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;900&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{background:"rgba(0,0,0,0.42)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(218,165,32,0.17)",padding:"0 18px",
        display:"flex",alignItems:"center",height:54,gap:11,flexShrink:0}}>
        <div style={{width:35,height:35,borderRadius:10,background:"linear-gradient(135deg,#b8860b,#f0c040)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
          boxShadow:"0 3px 12px rgba(218,165,32,0.32)",flexShrink:0}}>⚖️</div>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#f0c040"}}>مساعد الرواتب — Egytrans & NOSCO</div>
          <div style={{fontSize:9.5,color:"rgba(185,190,215,0.44)"}}>ق.148/2019 • ق.7/2024 • ق.4/2021 • ق.156/2002 — يناير 2026</div>
        </div>
        <div style={{marginRight:"auto",display:"flex",gap:6}}>
          <span style={{background:"rgba(80,200,120,0.08)",border:"1px solid rgba(80,200,120,0.22)",borderRadius:20,padding:"3px 10px",fontSize:10,color:"#70d090",fontWeight:600}}>✓ شهداء 0.05%</span>
          <span style={{background:"rgba(100,180,255,0.08)",border:"1px solid rgba(100,180,255,0.2)",borderRadius:20,padding:"3px 10px",fontSize:10,color:"#80c0ff",fontWeight:600}}>✓ منظومة توحيد</span>
        </div>
        <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:11,padding:3}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:"5px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11.5,
                fontFamily:"inherit",fontWeight:600,
                background:tab===t.id?"rgba(218,165,32,0.18)":"transparent",
                color:tab===t.id?"#f0c040":"rgba(175,180,210,0.46)",transition:"all .2s"}}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab==="chat"?(
        <ChatTab/>
      ):(
        <div style={{flex:1,overflowY:"auto",padding:18,scrollbarWidth:"thin",scrollbarColor:"rgba(218,165,32,0.18) transparent"}}>
          {tab==="net"&&<NetTab/>}
          {tab==="bonus"&&<BonusTab/>}
        </div>
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(0.65);opacity:.4}50%{transform:scale(1.1);opacity:1}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(218,165,32,0.18);border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
        textarea::-webkit-scrollbar{width:3px}
      `}</style>
    </div>
  );
}
