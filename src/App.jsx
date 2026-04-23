import { useState, useRef, useEffect } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ═══════════════════════════════
// 🎨 EGYTRANS NOSCO BRAND COLORS
// ═══════════════════════════════
const C = {
  blue:      "#1B3A8C",   // أزرق EGY
  blueMid:   "#2756C5",
  blueLight: "#4A80E8",
  bluePale:  "#EEF3FF",
  green:     "#2E7D32",   // أخضر NOSCO
  greenLight:"#4CAF50",
  greenPale: "#F0FAF0",
  white:     "#FFFFFF",
  bg:        "#F5F8FF",
  bgCard:    "#FFFFFF",
  border:    "#D0DCF8",
  text:      "#1A2847",
  textSub:   "#5A6A8A",
  textLight: "#8A9ABB",
  red:       "#D32F2F",
  redLight:  "#FFEBEE",
  amber:     "#E65100",
  amberLight:"#FFF3E0",
};

// ═══════════════════════════════
// 📐 CALC ENGINE
// ═══════════════════════════════
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
  const insWage = Math.max(INSURANCE_MIN, Math.min(INSURANCE_MAX, basic));
  const siEmp   = insWage * 0.11;
  const martyrs = gross * 0.0005;
  const taxBase = Math.max(0, gross * 12 - siEmp * 12 - 20000);
  const taxAnn  = calcAnnualTax(taxBase);
  const taxMo   = taxAnn / 12;
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

const SYSTEM_PROMPT = `أنت خبير متخصص في حساب الرواتب والمرتبات المصرية بشركة Egytrans وNOSCO. تحسب بدقة صافي الراتب (Net) والإجمالي (Gross-Up) وضريبة المكافآت.

القوانين المعتمدة — محدث 2026:
❶ التأمينات | ق.148/2019: عامل 11% | صاحب عمل 18.75% | أجر (Min 2,700 — Max 16,700)
❷ صندوق الشهداء | ق.4/2021: 0.05% من إجمالي الراتب (30,000 × 0.05% = 15 ج ✓)
❸ إعانة الطوارئ | ق.156/2002: 1% على صاحب العمل فقط
❹ ضريبة كسب العمل | ق.7/2024: إعفاء 20,000/سنة | شرائح 0%→27.5%

خطوات حساب NET:
1. أجر التأمين = MAX(2700, MIN(16700, الأساسي))
2. تأمينات = أجر × 11%
3. شهداء = الإجمالي × 0.05%
4. وعاء = (إجمالي×12) - (تأمينات×12) - 20,000
5. ضريبة شهرية = ضريبة_سنوية(الوعاء) ÷ 12
6. الصافي = الإجمالي - تأمينات - شهداء - ضريبة

ضريبة المكافأة (منظومة توحيد YTD):
ضريبة المكافأة = ضريبة(وعاء سنوي + مكافأة) − ضريبة(وعاء سنوي)
صافي المكافأة = الإجمالي − ضريبة المكافأة − 0.05% شهداء

قواعد: حسابات خطوة بخطوة • جدول واضح • اذكر المرجع • رد بنفس لغة المستخدم • احسب لأقرب جنيه`;

const fmt = n => Math.round(n || 0).toLocaleString("ar-EG");
const fd  = n => (n || 0).toFixed(2);

// ═══════════════════════════════
// 🧩 SHARED COMPONENTS
// ═══════════════════════════════

// SVG Logo Egytrans NOSCO
function EgytransLogo({ size = 38 }) {
  return (
    <svg width={size * 2.8} height={size} viewBox="0 0 110 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="22" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="16" fill={C.blue}>EGY</text>
      <text x="38" y="22" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="16" fill={C.blue}>TRANS</text>
      <text x="0" y="36" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="14" fill={C.green}>NOSCO</text>
      {/* Chevron arrow */}
      <polygon points="97,4 110,19 97,34 103,34 116,19 103,4" fill={C.blue} transform="translate(-10,0)"/>
      <polygon points="97,4 110,19 97,34 103,34 116,19 103,4" fill={C.green} transform="translate(-3,0)"/>
    </svg>
  );
}

function NInput({ label, value, onChange, help }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: C.textSub, display: "block", marginBottom: 5, fontWeight: 600 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="0"
        style={{
          width: "100%", background: C.white, border: `1.5px solid ${C.border}`,
          borderRadius: 10, padding: "10px 14px", color: C.blue, fontSize: 16, fontWeight: 700,
          outline: "none", boxSizing: "border-box", fontFamily: "inherit", textAlign: "center",
          transition: "border-color 0.2s", boxShadow: "0 1px 4px rgba(27,58,140,0.06)"
        }}
        onFocus={e => e.target.style.borderColor = C.blueLight}
        onBlur={e => e.target.style.borderColor = C.border} />
      {help && <div style={{ fontSize: 10.5, color: C.textLight, marginTop: 3 }}>{help}</div>}
    </div>
  );
}

function Btn({ onClick, label, color }) {
  const bg = color || `${C.blue}, ${C.blueMid}`;
  return (
    <button onClick={onClick} style={{
      width: "100%", marginTop: 16, padding: "13px",
      background: `linear-gradient(135deg, ${bg})`,
      border: "none", borderRadius: 12, color: "#fff", fontWeight: 700,
      fontSize: 14, cursor: "pointer", fontFamily: "inherit",
      boxShadow: `0 4px 16px rgba(27,58,140,0.25)`, transition: "opacity 0.2s"
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {label}
    </button>
  );
}

function Card({ icon, label, val, color, bg }) {
  return (
    <div style={{ background: bg || `${color}12`, border: `1.5px solid ${color}30`, borderRadius: 13, padding: "13px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 10, color: C.textLight, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{val}</div>
    </div>
  );
}

function Row({ label, val, note, color, bold, border }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: bold ? "7px 0" : "4px 0",
      color: color || C.textSub,
      borderTop: border ? `1px solid ${C.border}` : undefined,
      marginTop: border ? 8 : 0, paddingTop: border ? 10 : undefined
    }}>
      <span style={{ fontWeight: bold ? 700 : 400, fontSize: bold ? 13.5 : 13 }}>
        {label} {note && <span style={{ fontSize: 10, opacity: 0.6 }}>{note}</span>}
      </span>
      <span style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 15 : 13 }}>{val} ج</span>
    </div>
  );
}

function Legal({ text }) {
  return (
    <div style={{
      marginTop: 14, background: C.bluePale, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "8px 12px", fontSize: 10.5, color: C.textLight, lineHeight: 1.6
    }}>
      📌 {text}
    </div>
  );
}

function SectionBox({ children, borderColor, mobile }) {
  return (
    <div style={{
      background: C.white, border: `1.5px solid ${borderColor || C.border}`,
      borderRadius: 16, padding: mobile ? 14 : 22, marginBottom: 14,
      boxShadow: "0 2px 12px rgba(27,58,140,0.06)"
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════
// 📊 NET TAB
// ═══════════════════════════════
function NetTab({ isMobile }) {
  const [gross, setGross] = useState("");
  const [basic, setBasic] = useState("");
  const [mode, setMode] = useState("gtn");
  const [res, setRes] = useState(null);
  const p = s => parseFloat((s || "").replace(/,/g, "")) || 0;

  const calc = () => {
    const g = p(gross), b = p(basic) || p(gross);
    if (!g) return;
    if (mode === "gtn") {
      setRes({ ...calcNetFromGross(g, b), gross: g, basic: b, mode: "gtn" });
    } else {
      const go = grossUpSalary(g, b);
      setRes({ ...calcNetFromGross(go, b), gross: go, basic: b, targetNet: g, mode: "ntg" });
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", paddingBottom: 20 }}>
      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 6, background: C.bluePale, borderRadius: 12, padding: 4, marginBottom: 18, border: `1px solid ${C.border}` }}>
        {[{ id: "gtn", l: "📊 Gross → Net" }, { id: "ntg", l: "🔄 Net → Gross Up" }].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setRes(null); }}
            style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, transition: "all .2s",
              background: mode === m.id ? C.blue : "transparent",
              color: mode === m.id ? "#fff" : C.textSub,
              boxShadow: mode === m.id ? "0 2px 8px rgba(27,58,140,0.25)" : "none"
            }}>{m.l}</button>
        ))}
      </div>

      <SectionBox mobile={isMobile}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <NInput label={mode === "gtn" ? "الراتب الإجمالي (ج/شهر)" : "الصافي المطلوب (ج/شهر)"}
            value={gross} onChange={setGross}
            help={mode === "gtn" ? "كامل ما يتقاضاه الموظف" : "المبلغ الذي يصل للموظف"} />
          <NInput label="المرتب الأساسي (ج/شهر)" value={basic} onChange={setBasic} help="اتركه فارغاً إذا = الإجمالي" />
        </div>
        <Btn onClick={calc} label={mode === "gtn" ? "🧮 احسب الصافي" : "🔄 احسب Gross Up"} />
      </SectionBox>

      {res && (
        <div style={{ background: C.white, border: `1.5px solid ${C.green}40`, borderRadius: 16, padding: 22, animation: "fadeIn .3s ease", boxShadow: "0 2px 16px rgba(46,125,50,0.08)" }}>
          {res.mode === "ntg" && (
            <div style={{ color: C.blue, fontSize: 12, marginBottom: 14, background: C.bluePale, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 12px", fontWeight: 600 }}>
              🔄 Grossing Up: صافي {fmt(res.targetNet)} ج → إجمالي {fmt(res.gross)} ج
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
            <Card icon="💰" label="الإجمالي" val={`${fmt(res.gross)} ج`} color={C.blue} bg={C.bluePale} />
            <Card icon="📉" label="إجمالي الخصومات" val={`${fmt(res.siEmp + res.martyrs + res.taxMo)} ج`} color={C.red} bg={C.redLight} />
            <Card icon="✅" label="الصافي" val={`${fmt(res.net)} ج`} color={C.green} bg={C.greenPale} />
          </div>
          <Row label="أجر الاشتراك التأميني" val={fmt(res.insWage)} note="(2,700–16,700)" color={C.textSub} />
          <Row label="تأمينات اجتماعية — العامل (11%)" val={`- ${fmt(res.siEmp)}`} color={C.red} />
          <Row label="صندوق الشهداء (0.05% من الإجمالي)" val={`- ${fd(res.martyrs)}`} color={C.amber} note="ق.4/2021" />
          <Row label="وعاء الضريبة السنوي" val={`${fmt(res.taxBase)} / سنة`} color={C.textLight} />
          <Row label="الضريبة السنوية" val={fmt(res.taxAnn)} color={C.textLight} />
          <Row label="الضريبة الشهرية" val={`- ${fd(res.taxMo)}`} color={C.red} />
          <Row label="✅ صافي الراتب" val={fmt(res.net)} color={C.green} bold border />
          <Row label="🏢 إعانة الطوارئ (1% — على الشركة)" val={fmt(res.insWage * 0.01)} color={C.blue} note="لا تُخصم من الموظف" />
          <Row label="💼 تأمينات صاحب العمل (18.75%)" val={fmt(res.insWage * 0.1875)} color={C.textSub} />
          <Legal text="ق.148/2019 (تأمينات 2026) • ق.7/2024 (ضريبة) • ق.4/2021+ك.61/2024 (شهداء 0.05%) • ق.156/2002 (طوارئ)" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════
// 🎁 BONUS TAB
// ═══════════════════════════════
function BonusTab({ isMobile }) {
  const [mg, setMg] = useState("");
  const [bs, setBs] = useState("");
  const [bi, setBi] = useState("");
  const [mode, setMode] = useState("gb");
  const [res, setRes] = useState(null);
  const p = s => parseFloat((s || "").replace(/,/g, "")) || 0;

  const calc = () => {
    const mg_ = p(mg), bs_ = p(bs) || p(mg), bi_ = p(bi);
    if (!mg_ || !bi_) return;
    if (mode === "gb") {
      setRes({ ...calcBonusTax(mg_, bs_, bi_), grossBonus: bi_, mg: mg_, bs: bs_, mode: "gb" });
    } else {
      const gb = grossUpBonus(mg_, bs_, bi_);
      setRes({ ...calcBonusTax(mg_, bs_, gb), grossBonus: gb, targetNet: bi_, mg: mg_, bs: bs_, mode: "nb" });
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", paddingBottom: 20 }}>
      <div style={{ background: C.bluePale, border: `1px solid ${C.border}`, borderRadius: 13, padding: "13px 17px", marginBottom: 18, fontSize: 12.5, lineHeight: 1.75, color: C.blue }}>
        <strong>📋 منظومة توحيد الضرائب — طريقة حساب المكافأة</strong><br />
        ضريبة المكافأة = ضريبة(وعاء سنوي + مكافأة) − ضريبة(وعاء سنوي)<br />
        <span style={{ fontSize: 11, color: C.textSub }}>المكافأة تُضاف للوعاء السنوي وتُحسب الضريبة الهامشية المتزايدة فقط</span>
      </div>

      <div style={{ display: "flex", gap: 6, background: C.bluePale, borderRadius: 12, padding: 4, marginBottom: 18, border: `1px solid ${C.border}` }}>
        {[{ id: "gb", l: "📊 Gross Bonus → Net" }, { id: "nb", l: "🔄 Net Bonus → Gross Up" }].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setRes(null); }}
            style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, transition: "all .2s",
              background: mode === m.id ? C.green : "transparent",
              color: mode === m.id ? "#fff" : C.textSub,
              boxShadow: mode === m.id ? "0 2px 8px rgba(46,125,50,0.25)" : "none"
            }}>{m.l}</button>
        ))}
      </div>

      <SectionBox borderColor={`${C.green}50`} mobile={isMobile}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <NInput label="الراتب الإجمالي الشهري (ج)" value={mg} onChange={setMg} help="لتحديد الوعاء الضريبي الحالي" />
          <NInput label="الأساسي الشهري (ج)" value={bs} onChange={setBs} help="اتركه فارغاً إذا = الإجمالي" />
        </div>
        <NInput label={mode === "gb" ? "المكافأة الإجمالية (ج)" : "صافي المكافأة المطلوب (ج)"}
          value={bi} onChange={setBi}
          help={mode === "gb" ? "المبلغ قبل خصم الضريبة" : "المبلغ الذي يصل للموظف"} />
        <Btn onClick={calc} label={mode === "gb" ? "🧮 احسب صافي المكافأة" : "🔄 Gross Up للمكافأة"} color={`${C.green}, ${C.greenLight}`} />
      </SectionBox>

      {res && (
        <div style={{ background: C.white, border: `1.5px solid ${C.green}40`, borderRadius: 16, padding: 22, animation: "fadeIn .3s ease", boxShadow: "0 2px 16px rgba(46,125,50,0.08)" }}>
          {res.mode === "nb" && (
            <div style={{ color: C.blue, fontSize: 12, marginBottom: 14, background: C.bluePale, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 12px", fontWeight: 600 }}>
              🔄 Gross-Up: صافي مكافأة {fmt(res.targetNet)} ج → إجمالي {fmt(res.grossBonus)} ج
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
            <Card icon="🎁" label="إجمالي المكافأة" val={`${fmt(res.grossBonus)} ج`} color={C.blue} bg={C.bluePale} />
            <Card icon="📊" label="نسبة الضريبة الفعلية" val={`${res.effRate.toFixed(1)}%`} color={C.red} bg={C.redLight} />
            <Card icon="✅" label="صافي المكافأة" val={`${fmt(res.netBonus)} ج`} color={C.green} bg={C.greenPale} />
          </div>
          <div style={{ fontSize: 11.5, color: C.textLight, marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
            تفاصيل وفق منظومة توحيد الضرائب (YTD):
          </div>
          <Row label="وعاء الراتب السنوي (بدون مكافأة)" val={`${fmt(res.regBase)} / سنة`} color={C.textSub} />
          <Row label="+ المكافأة الإجمالية" val={`${fmt(res.grossBonus)}`} color={C.blue} />
          <Row label="= الوعاء السنوي الجديد" val={`${fmt(res.regBase + res.grossBonus)} / سنة`} color={C.textSub} />
          <Row label="ضريبة المكافأة الهامشية" val={`- ${fd(res.bonusTax)}`} color={C.red} />
          <Row label="صندوق الشهداء على المكافأة (0.05%)" val={`- ${fd(res.martyrs)}`} color={C.amber} />
          <Row label="✅ صافي المكافأة" val={fmt(res.netBonus)} color={C.green} bold border />
          <div style={{ marginTop: 13, background: C.bluePale, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 13px", fontSize: 11.5, color: C.blue, lineHeight: 1.7 }}>
            💡 الشريحة الهامشية الفعلية = <strong>{res.effRate.toFixed(2)}%</strong>
            &nbsp;|&nbsp; الدخل السنوي مع المكافأة = {fmt(res.regBase + res.grossBonus + 20000)} ج
          </div>
          <Legal text="منظومة توحيد الضرائب: ضريبة(وعاء+مكافأة) − ضريبة(وعاء) • ق.7/2024 • ق.4/2021 (شهداء 0.05%)" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════
// 💬 CHAT TAB
// ═══════════════════════════════
function ChatTab({ isMobile }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    const next = [...msgs, { role: "user", content: msg }];
    setMsgs(next);
    setLoading(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: next.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const d = await r.json();
      setMsgs([...next, { role: "assistant", content: d.content?.[0]?.text || "حدث خطأ." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "⚠️ خطأ في الاتصال." }]);
    } finally { setLoading(false); }
  };

  const qs = [
    "احسب Net لراتب إجمالي 30,000 وأساسي 12,000 ج",
    "Grossing up: صافي 20,000 ج — إيه الإجمالي؟",
    "موظف Gross 25,000 — مكافأة صافية 15,000 — الإجمالي؟",
    "احسب ضريبة مكافأة 50,000 لموظف راتبه 40,000 ج",
    "الفرق بين ضريبة الراتب والمكافأة في المنظومة الموحدة",
    "احسب إعانة الطوارئ لـ 80 موظف أساسيهم 8,000 ج"
  ];

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 0" }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <EgytransLogo size={32} />
            </div>
            <h2 style={{ color: C.blue, margin: "0 0 6px", fontSize: 19, fontWeight: 700 }}>مساعد الرواتب — Egytrans & NOSCO</h2>
            <p style={{ color: C.textSub, margin: "0 0 20px", fontSize: 12.5, lineHeight: 1.7 }}>
              Net • Gross-Up • ضريبة المكافآت • إعانة الطوارئ<br />
              <span style={{ fontSize: 10.5, color: C.textLight }}>محدث 2026 — شهداء 0.05% ✓ — منظومة توحيد الضرائب ✓</span>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, maxWidth: 620, margin: "0 auto" }}>
              {qs.map(q => (
                <button key={q} onClick={() => { setInput(q); taRef.current?.focus(); }}
                  style={{
                    background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10,
                    padding: "10px 13px", color: C.text, cursor: "pointer", textAlign: "right",
                    fontSize: 12, lineHeight: 1.5, transition: "all .2s", fontFamily: "inherit",
                    boxShadow: "0 1px 4px rgba(27,58,140,0.06)"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.blueLight; e.currentTarget.style.background = C.bluePale; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 9, marginBottom: 15, alignItems: "flex-start", animation: "fadeIn .25s ease" }}>
            <div style={{
              width: 33, height: 33, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              background: m.role === "user" ? `linear-gradient(135deg,${C.blue},${C.blueMid})` : `linear-gradient(135deg,${C.green},${C.greenLight})`,
              boxShadow: `0 2px 8px ${m.role === "user" ? "rgba(27,58,140,0.3)" : "rgba(46,125,50,0.3)"}`
            }}>
              {m.role === "user" ? "👤" : "⚖️"}
            </div>
            <div style={{
              maxWidth: "76%",
              background: m.role === "user" ? C.bluePale : C.white,
              border: `1.5px solid ${m.role === "user" ? C.border : `${C.green}30`}`,
              borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              padding: "11px 14px", color: C.text, fontSize: 13, lineHeight: 1.85,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              boxShadow: "0 1px 6px rgba(27,58,140,0.06)"
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 9, marginBottom: 15, alignItems: "flex-start" }}>
            <div style={{ width: 33, height: 33, borderRadius: 10, background: `linear-gradient(135deg,${C.green},${C.greenLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚖️</div>
            <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: "4px 16px 16px 16px", padding: "12px 17px", display: "flex", gap: 5, boxShadow: "0 1px 6px rgba(27,58,140,0.06)" }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, animation: `pulse 1.1s ${i * .18}s infinite ease-in-out` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} style={{ height: 8 }} />
      </div>

      <div style={{ background: C.white, borderTop: `1.5px solid ${C.border}`, padding: "11px 18px 13px", flexShrink: 0, boxShadow: "0 -2px 12px rgba(27,58,140,0.06)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 13, padding: "7px 7px 7px 13px" }}>
          <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اسأل عن Net، Gross-Up، ضريبة المكافأة، إعانة الطوارئ..."
            rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, resize: "none", fontFamily: "inherit", lineHeight: 1.65, padding: "4px 0", maxHeight: 85, overflowY: "auto" }} />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "none", flexShrink: 0,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              background: loading || !input.trim() ? C.border : `linear-gradient(135deg,${C.blue},${C.blueMid})`,
              fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: loading || !input.trim() ? "none" : "0 2px 10px rgba(27,58,140,0.3)",
              transition: "all .2s"
            }}>
            {loading ? "⏳" : "▲"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 6, color: C.textLight, fontSize: 10 }}>
          Enter للإرسال • Shift+Enter سطر جديد • للاسترشاد فقط
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════
// 🎬 TUTORIAL MODAL
// ═══════════════════════════════
const SLIDES = [
  {
    icon: "👋",
    title: "أهلاً بك في مساعد الرواتب",
    subtitle: "Egytrans & NOSCO",
    body: "الأداة دي بتجاوب على سؤال واحد بشكل فوري:\n«كم يستلم الموظف في النهاية؟»\n\nمعاك 3 أقسام — كل قسم لاحتياج مختلف.\nالشرح الجاي هيوضحلك متى تستخدم كل واحد.",
    color: "#1B3A8C", bg: "#EEF3FF", tag: "مقدمة"
  },
  {
    icon: "📊",
    title: "Net / Gross-Up",
    subtitle: "حساب الراتب الشهري",
    body: "📌 لو عندك الإجمالي وعايز الصافي:\nمثال: راتب 30,000 إجمالي — كم يستلم الموظف؟\n\n📌 لو عايز الموظف يستلم صافي معين:\nمثال: عايزه يستلم 20,000 — كم يكون الإجمالي؟\n\nاكتب الرقم واضغط احسب — النتيجة في ثانية ✅",
    color: "#1B3A8C", bg: "#EEF3FF", tag: "القسم الأول"
  },
  {
    icon: "🎁",
    title: "مكافأة Bonus",
    subtitle: "ضريبة المكافآت — منظومة توحيد الضرائب",
    body: "📌 لو هتصرف مكافأة إجمالي وعايز الصافي:\nمثال: مكافأة 50,000 — كم يستلم الموظف؟\n\n📌 لو قررت الموظف يستلم مكافأة صافية محددة:\nمثال: عايزه يستلم 30,000 صافي — كم تدفع الشركة؟\n\nحساب يأخذ دقائق يدوياً — هنا في ثانية 🎯",
    color: "#2E7D32", bg: "#F0FAF0", tag: "القسم الثاني"
  },
  {
    icon: "💬",
    title: "محادثة AI",
    subtitle: "الخبير الضريبي الافتراضي",
    body: "📌 لو عندك سؤال مركّب أو حالة خاصة:\n• احسب إعانة الطوارئ لمسير 80 موظف\n• ما الفرق بين ضريبة الراتب والمكافأة؟\n• موظف أساسي 8,000 وإجمالي 18,000\n\nالمساعد يرد بخطوات تفصيلية مع المراجع القانونية 📋",
    color: "#6B21A8", bg: "#FAF5FF", tag: "القسم الثالث"
  },
  {
    icon: "⚖️",
    title: "القوانين المطبقة",
    subtitle: "محدّثة يناير 2026",
    body: "✅ التأمينات — ق.148/2019\nعامل 11% | صاحب عمل 18.75% | أجر (2,700–16,700)\n\n✅ ضريبة كسب العمل — ق.7/2024\nإعفاء 20,000 سنوياً | شرائح 0% حتى 27.5%\n\n✅ صندوق الشهداء — ق.4/2021: 0.05%\n✅ إعانة الطوارئ — ق.156/2002: 1% على الشركة",
    color: "#E65100", bg: "#FFF3E0", tag: "القوانين"
  },
];

function TutorialModal({ onClose }) {
  const [slide, setSlide] = useState(0);
  const [anim, setAnim] = useState(true);
  const cur = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  const go = (dir) => {
    setAnim(false);
    setTimeout(() => { setSlide(s => s + dir); setAnim(true); }, 150);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(10,20,50,0.6)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn 0.25s ease"}}>
      <div style={{background:"#fff",borderRadius:24,width:"100%",maxWidth:460,boxShadow:"0 24px 64px rgba(10,20,50,0.28)",overflow:"hidden",position:"relative"}}>
        {/* Progress */}
        <div style={{height:4,background:"#D0DCF8"}}>
          <div style={{height:"100%",width:`${((slide+1)/SLIDES.length)*100}%`,background:`linear-gradient(90deg,${cur.color},#4A80E8)`,transition:"width 0.35s ease"}}/>
        </div>
        {/* Content */}
        <div style={{padding:"26px 26px 16px",opacity:anim?1:0,transition:"opacity 0.15s ease"}}>
          <div style={{display:"inline-block",background:cur.bg,color:cur.color,fontSize:11,fontWeight:700,
            padding:"3px 12px",borderRadius:20,border:`1px solid ${cur.color}30`,marginBottom:14}}>{cur.tag}</div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:52,height:52,borderRadius:14,flexShrink:0,background:cur.bg,
              border:`2px solid ${cur.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{cur.icon}</div>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:cur.color,lineHeight:1.2}}>{cur.title}</div>
              <div style={{fontSize:11.5,color:"#5A6A8A",marginTop:2}}>{cur.subtitle}</div>
            </div>
          </div>
          <div style={{background:cur.bg,borderRadius:12,padding:"13px 15px",fontSize:12.5,lineHeight:1.9,
            color:"#1A2847",whiteSpace:"pre-wrap",border:`1px solid ${cur.color}18`,minHeight:130}}>{cur.body}</div>
          {/* Dots */}
          <div style={{display:"flex",justifyContent:"center",gap:5,margin:"16px 0 2px"}}>
            {SLIDES.map((_,i)=>(
              <div key={i} onClick={()=>{setAnim(false);setTimeout(()=>{setSlide(i);setAnim(true);},150);}}
                style={{width:i===slide?18:6,height:6,borderRadius:3,background:i===slide?cur.color:"#D0DCF8",
                  cursor:"pointer",transition:"all 0.3s ease"}}/>
            ))}
          </div>
        </div>
        {/* Buttons */}
        <div style={{display:"flex",gap:8,padding:"0 26px 22px",borderTop:"1px solid #D0DCF8",paddingTop:14}}>
          {slide > 0 && (
            <button onClick={()=>go(-1)} style={{flex:1,padding:"10px",borderRadius:11,border:"1.5px solid #D0DCF8",
              background:"#fff",color:"#5A6A8A",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← السابق</button>
          )}
          {!isLast ? (
            <button onClick={()=>go(1)} style={{flex:2,padding:"10px",background:`linear-gradient(135deg,${cur.color},#4A80E8)`,
              border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              boxShadow:`0 4px 14px ${cur.color}35`}}>التالي ←</button>
          ) : (
            <button onClick={onClose} style={{flex:2,padding:"10px",background:"linear-gradient(135deg,#2E7D32,#4CAF50)",
              border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 4px 14px rgba(46,125,50,0.35)"}}>🚀 ابدأ الاستخدام</button>
          )}
        </div>
        {/* Close */}
        <button onClick={onClose} style={{position:"absolute",top:12,left:12,width:26,height:26,borderRadius:7,
          border:"1px solid #D0DCF8",background:"#fff",color:"#8A9ABB",fontSize:13,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════
// 🏠 MAIN APP
// ═══════════════════════════════
export default function App() {
  const [tab, setTab] = useState("net");
  const [showTutorial, setShowTutorial] = useState(true);
  const isMobile = useIsMobile();

  const tabs = [
    { id: "net",   l: "📊 Net / Gross-Up" },
    { id: "bonus", l: "🎁 مكافأة Bonus" },
    { id: "chat",  l: "💬 محادثة AI" },
  ];

  return (
    <div style={{
      minHeight: "100vh", maxHeight: "100vh", overflow: "hidden",
      background: C.bg,
      fontFamily: "'Cairo','Noto Sans Arabic',system-ui,sans-serif",
      display: "flex", flexDirection: "column", direction: "rtl", color: C.text
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;900&display=swap" rel="stylesheet" />

      {/* ─── Header ─── */}
      <div style={{
        background: C.white,
        borderBottom: `2px solid ${C.border}`,
        padding: isMobile ? "0 12px" : "0 20px",
        display: "flex", alignItems: "center",
        height: isMobile ? 52 : 58,
        gap: isMobile ? 8 : 14, flexShrink: 0,
        boxShadow: "0 2px 12px rgba(27,58,140,0.08)"
      }}>
        {/* Logo */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          {/* Chevron Icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueMid})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 3px 12px rgba(27,58,140,0.3)`
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <text x="2" y="15" fontSize="14" fill="white" fontWeight="bold">⚖</text>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.1 }}>
              <span style={{ color: C.blue }}>EGY</span>
              <span style={{ color: C.blue }}>TRANS</span>
              <span style={{ color: C.blue, marginRight: 3 }}> ❯</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 13, color: C.green, lineHeight: 1 }}>NOSCO</div>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: C.border, flexShrink: 0 }} />

        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: C.text }}>مساعد الرواتب</div>
          <div style={{ fontSize: 10, color: C.textLight }}>ق.148/2019 • ق.7/2024 • ق.4/2021 • يناير 2026</div>
        </div>

        {/* Badges */}
        <div style={{ marginRight: "auto", display: isMobile ? "none" : "flex", gap: 6 }}>
          <span style={{ background: C.greenPale, border: `1px solid ${C.green}40`, borderRadius: 20, padding: "3px 10px", fontSize: 10, color: C.green, fontWeight: 600 }}>✓ شهداء 0.05%</span>
          <span style={{ background: C.bluePale, border: `1px solid ${C.blue}30`, borderRadius: 20, padding: "3px 10px", fontSize: 10, color: C.blue, fontWeight: 600 }}>✓ منظومة توحيد</span>
        </div>

        {/* Help Button */}
        <button onClick={() => setShowTutorial(true)} title="شرح الأداة" style={{
          width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`,
          background: C.white, color: C.blue, fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, flexShrink: 0, boxShadow: "0 1px 4px rgba(27,58,140,0.1)"
        }}>?</button>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 11, padding: 3, border: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: isMobile ? "5px 8px" : "5px 13px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: isMobile ? 10.5 : 12, fontFamily: "inherit", fontWeight: 600, transition: "all .2s",
                background: tab === t.id ? C.blue : "transparent",
                color: tab === t.id ? "#fff" : C.textSub,
                boxShadow: tab === t.id ? "0 2px 8px rgba(27,58,140,0.25)" : "none"
              }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tutorial ─── */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {/* ─── Content ─── */}
      {tab === "chat" ? (
        <ChatTab isMobile={isMobile} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 12 : 20, scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent` }}>
          {tab === "net"   && <NetTab isMobile={isMobile} />}
          {tab === "bonus" && <BonusTab isMobile={isMobile} />}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{transform:scale(0.65);opacity:.4} 50%{transform:scale(1.1);opacity:1} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        ::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar { width: 3px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
