import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { transactions as txApi, goals as goalsApi, profiles as profilesApi, dismissals as dismissApi, auth } from "./lib/db.js";

// ═══ Constants ═══
const EXP_CATS = [
  { id:"vivienda",name:"Vivienda",icon:"\u{1F3E0}",type:"necesidad",color:"#E8625C" },
  { id:"comida",name:"Comida y super",icon:"\u{1F6D2}",type:"necesidad",color:"#F4845F" },
  { id:"transporte",name:"Transporte",icon:"\u{1F697}",type:"necesidad",color:"#F9A03F" },
  { id:"servicios",name:"Luz/Agua/Gas",icon:"\u{1F4A1}",type:"necesidad",color:"#F7B731" },
  { id:"salud",name:"Salud",icon:"\u{1F3E5}",type:"necesidad",color:"#7BC67E" },
  { id:"telefono",name:"Telefono/Internet",icon:"\u{1F4F1}",type:"necesidad",color:"#4ECDC4" },
  { id:"restaurantes",name:"Restaurantes",icon:"\u{1F37D}\u{FE0F}",type:"deseo",color:"#A78BFA" },
  { id:"entretenimiento",name:"Entretenimiento",icon:"\u{1F3AC}",type:"deseo",color:"#818CF8" },
  { id:"ropa",name:"Ropa y zapatos",icon:"\u{1F45F}",type:"deseo",color:"#C084FC" },
  { id:"suscripciones",name:"Suscripciones",icon:"\u{1F4FA}",type:"deseo",color:"#F472B6" },
  { id:"viajes",name:"Viajes",icon:"\u{2708}\u{FE0F}",type:"deseo",color:"#FB923C" },
  { id:"caprichos",name:"Caprichos",icon:"\u{1F381}",type:"deseo",color:"#E879F9" },
  { id:"ahorro_cat",name:"Ahorro",icon:"\u{1F437}",type:"ahorro",color:"#34D399" },
  { id:"inversion",name:"Inversion",icon:"\u{1F4C8}",type:"ahorro",color:"#2DD4BF" },
  { id:"deudas",name:"Pago de deudas",icon:"\u{1F4B3}",type:"ahorro",color:"#38BDF8" },
  { id:"emergencia",name:"Fondo emergencia",icon:"\u{1F6DF}",type:"ahorro",color:"#60A5FA" },
];
const INC_CATS = [
  { id:"salario",name:"Salario",icon:"\u{1F4B0}",type:"ingreso",color:"#34D399" },
  { id:"freelance",name:"Freelance",icon:"\u{1F4BB}",type:"ingreso",color:"#2DD4BF" },
  { id:"negocio",name:"Negocio",icon:"\u{1F3EA}",type:"ingreso",color:"#38BDF8" },
  { id:"otro_ingreso",name:"Otro ingreso",icon:"\u{2795}",type:"ingreso",color:"#A78BFA" },
];
const CAT_MAP = Object.fromEntries([...EXP_CATS,...INC_CATS].map(c=>[c.id,c]));
const MN = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ═══ Utils ═══
const curMK = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const parseMK = mk => { const [y,m]=mk.split("-").map(Number); return {y,m}; };
const shiftMK = (mk,d) => { const {y,m}=parseMK(mk); const dt=new Date(y,m-1+d,1); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
const mlabel = mk => { const {y,m}=parseMK(mk); return `${MN[m-1]} ${y}`; };
const mshort = mk => { const {y,m}=parseMK(mk); return `${MS[m-1]} ${String(y).slice(2)}`; };
const fmt = n => "$"+Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtS = n => n>=1000?"$"+(n/1000).toFixed(n%1000===0?0:1)+"k":"$"+n;
const today = () => new Date().toISOString().slice(0,10);

// ═══ Components ═══
const Ring = memo(({pct,size=100,stroke=8,color="#34D399",children})=>{
  const r=(size-stroke)/2,c=2*Math.PI*r,o=c-(Math.min(Math.max(pct,0),100)/100)*c;
  return <div style={{position:"relative",width:size,height:size}}><svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/></svg><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div></div>;
});

// ═══ Main Finance App ═══
export default function FinanceApp({ userId, userEmail }) {
  const [allTx, setAllTx] = useState([]);
  const [allGoals, setAllGoals] = useState([]);
  const [dismissed, setDismissed] = useState({});
  const [income, setIncome] = useState(0);
  const [incomeSet, setIncomeSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [viewMonth, setViewMonth] = useState(curMK());
  const [toast, setToast] = useState(null);

  // Modal state
  const [modal, setModal] = useState(false);
  const [mMode, setMMode] = useState("create");
  const [mEditId, setMEditId] = useState(null);
  const [mType, setMType] = useState("gasto");
  const [mAmt, setMAmt] = useState("");
  const [mCat, setMCat] = useState("");
  const [mNote, setMNote] = useState("");
  const [mDate, setMDate] = useState(today());
  const [mErr, setMErr] = useState("");

  // Goal form
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gSaved, setGSaved] = useState("");
  const [gDeadline, setGDeadline] = useState("");

  // Income input
  const [incInput, setIncInput] = useState("");

  // Confirm delete
  const [confirmDel, setConfirmDel] = useState(null);

  // Show toast
  const showToast = (type, msg) => { setToast({type,msg}); setTimeout(()=>setToast(null),2500); };

  // ─── Load data ───
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [txData, goalsData, dismissData, profile] = await Promise.all([
          txApi.getAll(userId), goalsApi.getAll(userId), dismissApi.getAll(userId), profilesApi.get(userId),
        ]);
        if (cancelled) return;
        setAllTx(txData);
        setAllGoals(goalsData);
        setDismissed(dismissData);
        if (profile && profile.base_income > 0) { setIncome(profile.base_income); setIncomeSet(true); }
      } catch (e) { console.error("Load error:", e); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ─── Computed ───
  const mk = viewMonth, cmk = curMK(), isCur = mk === cmk;
  const monthTx = useMemo(() => allTx.filter(t => t.month === mk), [allTx, mk]);
  const gastos = useMemo(() => monthTx.filter(t => t.type === "gasto"), [monthTx]);
  const ingresos = useMemo(() => monthTx.filter(t => t.type === "ingreso"), [monthTx]);
  const totIng = ingresos.reduce((s,t) => s + Number(t.amount), 0);
  const effIncome = totIng > 0 ? totIng : income;
  const totGasto = gastos.reduce((s,t) => s + Number(t.amount), 0);
  const disponible = effIncome - totGasto;
  const pctUsado = effIncome > 0 ? (totGasto / effIncome) * 100 : 0;

  const byGroup = useMemo(() => {
    const g = { necesidad: 0, deseo: 0, ahorro: 0 };
    for (const tx of gastos) { const c = CAT_MAP[tx.category]; if (c && c.type in g) g[c.type] += Number(tx.amount); }
    return Object.fromEntries(["necesidad","deseo","ahorro"].map(k => {
      const pct = k === "necesidad" ? 0.5 : k === "deseo" ? 0.3 : 0.2;
      const b = effIncome * pct;
      return [k, { budget: b, spent: g[k], pct: b > 0 ? (g[k]/b)*100 : 0, over: g[k] > b }];
    }));
  }, [gastos, effIncome]);

  const catBreak = useMemo(() => {
    const t = {};
    for (const tx of gastos) t[tx.category] = (t[tx.category]||0) + Number(tx.amount);
    return Object.entries(t).map(([id,total]) => { const c=CAT_MAP[id]; return c ? {...c,total} : null; }).filter(Boolean).sort((a,b)=>b.total-a.total);
  }, [gastos]);

  const alerts = useMemo(() => {
    if (!isCur || effIncome <= 0) return [];
    const a = [];
    if (byGroup.necesidad.over && !dismissed[`nec-${mk}`]) a.push({key:`nec-${mk}`,type:"danger",msg:`\u26A0\uFE0F Necesidades: +${fmt(byGroup.necesidad.spent-byGroup.necesidad.budget)} sobre el 50%`});
    if (byGroup.deseo.over && !dismissed[`des-${mk}`]) a.push({key:`des-${mk}`,type:"warning",msg:`\u{1F6D1} Deseos: +${fmt(byGroup.deseo.spent-byGroup.deseo.budget)} sobre el 30%`});
    if (pctUsado > 80 && pctUsado < 100 && !dismissed[`80-${mk}`]) a.push({key:`80-${mk}`,type:"warning",msg:"\u{1F514} Mas del 80% usado"});
    if (pctUsado >= 100 && !dismissed[`100-${mk}`]) a.push({key:`100-${mk}`,type:"danger",msg:"\u{1F6A8} Gastaste todo tu ingreso!"});
    return a;
  }, [byGroup, pctUsado, dismissed, isCur, mk, effIncome]);

  const allMonths = useMemo(() => { const s=new Set(allTx.map(t=>t.month)); s.add(cmk); return [...s].sort().reverse(); }, [allTx,cmk]);

  // ─── Actions ───
  const openModal = (txType="gasto", editTx=null) => {
    if (editTx) { setMMode("edit"); setMEditId(editTx.id); setMType(editTx.type); setMAmt(String(editTx.amount)); setMCat(editTx.category); setMNote(editTx.note||""); setMDate(editTx.date); }
    else { setMMode("create"); setMEditId(null); setMType(txType); setMAmt(""); setMCat(""); setMNote(""); setMDate(today()); }
    setMErr(""); setModal(true);
  };

  const saveTx = async () => {
    const amt = Number(mAmt);
    if (!amt || amt <= 0) { setMErr("Cantidad invalida"); return; }
    if (!mCat) { setMErr("Selecciona categoria"); return; }
    if (!mDate) { setMErr("Fecha requerida"); return; }
    try {
      if (mMode === "edit") {
        const updated = await txApi.update(mEditId, userId, { amount: amt, type: mType, category: mCat, note: mNote, date: mDate });
        setAllTx(prev => prev.map(t => t.id === mEditId ? updated : t));
        showToast("success", "Actualizado");
      } else {
        const created = await txApi.add(userId, { amount: amt, type: mType, category: mCat, note: mNote, date: mDate });
        setAllTx(prev => [created, ...prev]);
        showToast("success", mType === "ingreso" ? "Ingreso registrado" : "Gasto registrado");
      }
      setModal(false);
    } catch (e) { setMErr(e.message); }
  };

  const deleteTx = async (id) => {
    try { await txApi.remove(id, userId); setAllTx(prev => prev.filter(t => t.id !== id)); setConfirmDel(null); showToast("success","Eliminado"); } catch(e) { showToast("error",e.message); }
  };

  const saveGoal = async () => {
    if (!gName.trim() || !gTarget) { showToast("error","Nombre y cantidad requeridos"); return; }
    try {
      const created = await goalsApi.add(userId, { name: gName.trim(), target: Number(gTarget), saved: Number(gSaved)||0, deadline: gDeadline||null });
      setAllGoals(prev => [created, ...prev]); setGName(""); setGTarget(""); setGSaved(""); setGDeadline(""); showToast("success","Meta creada");
    } catch(e) { showToast("error",e.message); }
  };

  const abonarGoal = async (g) => {
    const v = prompt("Cuanto abonar?");
    if (!v || isNaN(v) || Number(v) <= 0) return;
    try {
      const updated = await goalsApi.update(g.id, userId, { saved: Number(g.saved) + Number(v) });
      setAllGoals(prev => prev.map(x => x.id === g.id ? updated : x)); showToast("success",`+${fmt(Number(v))} abonado`);
    } catch(e) { showToast("error",e.message); }
  };

  const deleteGoal = async (id) => {
    try { await goalsApi.remove(id, userId); setAllGoals(prev => prev.filter(g => g.id !== id)); setConfirmDel(null); showToast("success","Meta eliminada"); } catch(e) { showToast("error",e.message); }
  };

  const updateIncome = async () => {
    const v = Number(incInput);
    if (!v || v <= 0) { showToast("error","Cantidad invalida"); return; }
    try { await profilesApi.update(userId, { base_income: v }); setIncome(v); setIncomeSet(true); setIncInput(""); showToast("success","Ingreso actualizado"); } catch(e) { showToast("error",e.message); }
  };

  const dismissAlert = async (key) => {
    setDismissed(prev => ({...prev,[key]:true}));
    try { await dismissApi.dismiss(userId, key); } catch(e) { console.error(e); }
  };

  const handleSignOut = async () => { try { await auth.signOut(); } catch(e) { showToast("error",e.message); } };

  // ─── Loading ───
  if (loading) return <div style={{...S.ctn,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><style>{CSS}</style><div style={{fontSize:40,animation:"pulse 1.5s infinite"}}>{"\u{1F4B0}"}</div></div>;

  // ─── Onboarding ───
  if (!incomeSet) return (
    <div style={S.ctn}><style>{CSS}</style>
      <div style={{padding:"60px 24px 40px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",animation:"fadeIn 0.6s ease"}}>
        <div style={{fontSize:64,marginBottom:16}}>{"\u{1F4B8}"}</div>
        <h1 style={{fontSize:28,fontWeight:700,marginBottom:8,background:"linear-gradient(135deg,#34D399,#2DD4BF,#38BDF8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tu dinero, tus reglas</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:20,lineHeight:1.5}}>Regla 50/30/20: <strong>50% Necesidades</strong>, <strong>30% Deseos</strong>, <strong>20% Ahorro</strong></p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:12}}>Cuanto ganas al mes?</p>
        <div style={S.iRow}><span style={S.dSign}>$</span><input type="number" placeholder="Ej: 15000" value={incInput} onChange={e=>setIncInput(e.target.value)} inputMode="decimal" style={S.iInp}/></div>
        <button style={{...S.pBtn,opacity:incInput?1:0.4,marginTop:16}} disabled={!incInput} onClick={updateIncome}>Comenzar {"\u{1F680}"}</button>
      </div>
    </div>
  );

  // ─── Main ───
  const titles = {home:{s:"RESUMEN",t:"Tu mes"},gastos:{s:"GASTOS",t:"Detalle"},historial:{s:"HISTORIAL",t:"Mes a mes"},metas:{s:"METAS",t:"Metas"},ajustes:{s:"AJUSTES",t:"Ajustes"}};
  const ti = titles[screen]||titles.home;

  return (
    <div style={S.ctn}><style>{CSS}</style>
      {/* Header */}
      <div style={S.hdr}><div><div style={S.hSub}>{ti.s}</div><div style={S.hTitle}>{ti.t}</div></div><div style={S.badge}>{fmt(effIncome)}/mes</div></div>

      {/* Month sel */}
      {(screen==="home"||screen==="gastos")&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"8px 0 4px"}}>
        <button onClick={()=>setViewMonth(shiftMK(viewMonth,-1))} style={S.mArr}>{"\u2039"}</button>
        <button onClick={()=>setViewMonth(curMK())} style={{background:isCur?"none":"rgba(52,211,153,0.1)",border:"none",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans'",padding:"4px 10px",borderRadius:8}}>{mlabel(viewMonth)}{!isCur&&<span style={{fontSize:9,marginLeft:6,color:"#34D399"}}>{"\u2190"} hoy</span>}</button>
        <button onClick={()=>{const n=shiftMK(viewMonth,1);if(n<=curMK())setViewMonth(n);}} style={{...S.mArr,opacity:isCur?0.2:1}} disabled={isCur}>{"\u203A"}</button>
      </div>}

      {/* Alerts */}
      {alerts.map(a=><div key={a.key} style={{...S.alert,background:a.type==="danger"?"rgba(232,98,92,0.15)":"rgba(249,160,63,0.15)",borderColor:a.type==="danger"?"#E8625C":"#F9A03F"}}><span style={{flex:1,fontSize:13}}>{a.msg}</span><button onClick={()=>dismissAlert(a.key)} style={S.aClose}>{"\u2715"}</button></div>)}

      <div style={S.content}>
        {/* HOME */}
        {screen==="home"&&<div style={{animation:"fadeIn 0.4s ease"}}>
          <div style={{display:"flex",justifyContent:"center",margin:"4px 0 14px"}}><Ring pct={pctUsado} size={150} stroke={11} color={pctUsado>100?"#E8625C":pctUsado>80?"#F9A03F":"#34D399"}><span style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"'Space Mono'"}} >Disponible</span><span style={{fontSize:22,fontWeight:700,color:disponible<0?"#E8625C":"#fff",fontFamily:"'Space Mono'"}}>{fmt(disponible)}</span><span style={{fontSize:9,color:"rgba(255,255,255,0.35)"}}>{Math.round(pctUsado)}% usado</span></Ring></div>
          {!isCur&&<div style={{textAlign:"center",marginBottom:10}}><span style={{fontSize:11,padding:"3px 10px",borderRadius:6,background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)"}}>Viendo: {mlabel(mk)}</span></div>}
          {totIng>0&&totIng!==income&&<div style={S.card}><div style={S.cTitle}>Ingresos del mes</div><div style={{fontFamily:"'Space Mono'",fontSize:18,fontWeight:700,color:"#34D399"}}>{fmt(totIng)}</div></div>}
          <div style={S.card}><div style={S.cTitle}>Regla 50 / 30 / 20</div>
            {[{l:"Necesidades",g:"necesidad",c:"#E8625C",p:"50%"},{l:"Deseos",g:"deseo",c:"#A78BFA",p:"30%"},{l:"Ahorro",g:"ahorro",c:"#34D399",p:"20%"}].map((it,i)=>{const d=byGroup[it.g];return<div key={i} style={{marginBottom:i<2?14:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}><span style={{color:"rgba(255,255,255,0.7)"}}>{it.l} <span style={{color:"rgba(255,255,255,0.3)"}}>({it.p})</span></span><span style={{color:d.over?"#E8625C":"rgba(255,255,255,0.5)",fontFamily:"'Space Mono'",fontSize:11}}>{fmt(d.spent)}/{fmt(d.budget)}</span></div><div style={{height:8,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,width:`${Math.min(d.pct,100)}%`,background:d.over?"#E8625C":it.c,transition:"width 0.6s"}}/></div></div>;})}
          </div>
          {catBreak.length>0&&<div style={S.card}><div style={S.cTitle}>A donde se va tu dinero?</div>{catBreak.slice(0,5).map((c,i)=><div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:i<Math.min(catBreak.length,5)-1?"1px solid rgba(255,255,255,0.05)":"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:"50%",background:c.color,display:"inline-block"}}/><span style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{c.icon} {c.name}</span></div><span style={{fontFamily:"'Space Mono'",fontSize:12,color:"rgba(255,255,255,0.6)"}}>{fmt(c.total)}</span></div>)}</div>}
          {allGoals.length>0&&<div style={S.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={S.cTitle}>Metas</div><button onClick={()=>setScreen("metas")} style={S.lBtn}>Ver {"\u2192"}</button></div>{allGoals.slice(0,2).map(g=>{const p=g.target>0?(Number(g.saved)/Number(g.target))*100:0;return<div key={g.id} style={{marginTop:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"rgba(255,255,255,0.8)"}}>{g.name}</span><span style={{fontFamily:"'Space Mono'",color:"rgba(255,255,255,0.5)",fontSize:11}}>{Math.round(p)}%</span></div><div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.06)"}}><div style={{height:"100%",borderRadius:3,width:`${Math.min(p,100)}%`,background:"linear-gradient(90deg,#34D399,#2DD4BF)",transition:"width 0.6s"}}/></div></div>;})}</div>}
          {monthTx.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,0.3)",fontSize:13}}>{isCur?"Sin movimientos. Toca + para empezar!":"Sin movimientos este mes."}</div>}
        </div>}

        {/* GASTOS */}
        {screen==="gastos"&&<div style={{animation:"fadeIn 0.4s ease"}}>
          {monthTx.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.3)",fontSize:13}}>Sin movimientos</div>:
          <>
            {ingresos.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:11,color:"#34D399",fontWeight:600,letterSpacing:0.5,marginBottom:6,textTransform:"uppercase"}}>Ingresos ({ingresos.length})</div>{ingresos.map(tx=><TxRow key={tx.id} tx={tx} onEdit={()=>openModal("ingreso",tx)} onDel={()=>setConfirmDel({type:"tx",id:tx.id})} isInc/>)}</div>}
            {gastos.length>0&&<div>{ingresos.length>0&&<div style={{fontSize:11,color:"#E8625C",fontWeight:600,letterSpacing:0.5,marginBottom:6,textTransform:"uppercase"}}>Gastos ({gastos.length})</div>}{gastos.sort((a,b)=>b.date.localeCompare(a.date)).map(tx=><TxRow key={tx.id} tx={tx} onEdit={()=>openModal("gasto",tx)} onDel={()=>setConfirmDel({type:"tx",id:tx.id})}/>)}</div>}
          </>}
        </div>}

        {/* HISTORIAL */}
        {screen==="historial"&&<div style={{animation:"fadeIn 0.4s ease"}}>
          {allTx.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.3)",fontSize:13}}>Registra movimientos para ver historial</div>:<>
            <div style={S.card}><div style={S.cTitle}>Ultimos 6 meses</div><HistChart txs={allTx} income={income} curMonth={cmk}/></div>
            {(()=>{const tot=allTx.filter(t=>t.type==="gasto").reduce((s,t)=>s+Number(t.amount),0),mc=new Set(allTx.map(t=>t.month)).size||1;return<div style={{display:"flex",gap:8,marginBottom:12}}><div style={{...S.card,flex:1,marginBottom:0}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Total</div><div style={{fontFamily:"'Space Mono'",fontSize:16,fontWeight:700,color:"#fff",marginTop:4}}>{fmt(tot)}</div></div><div style={{...S.card,flex:1,marginBottom:0}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Promedio/mes</div><div style={{fontFamily:"'Space Mono'",fontSize:16,fontWeight:700,color:"#fff",marginTop:4}}>{fmt(tot/mc)}</div></div></div>;})()}
            <div style={S.card}><div style={S.cTitle}>Por mes</div>{allMonths.map(m=><MRow key={m} mk={m} txs={allTx} income={income}/>)}</div>
          </>}
        </div>}

        {/* METAS */}
        {screen==="metas"&&<div style={{animation:"fadeIn 0.4s ease"}}>
          {allGoals.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"rgba(255,255,255,0.3)",fontSize:13}}>Crea tu primera meta abajo</div>}
          {allGoals.map(g=>{const p=g.target>0?(Number(g.saved)/Number(g.target))*100:0;return<div key={g.id} style={S.gCard}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:15,fontWeight:600,color:"#fff"}}>{g.name}</div>{g.deadline&&<div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>Meta: {g.deadline}</div>}</div><Ring pct={p} size={52} stroke={5} color={p>=100?"#34D399":"#2DD4BF"}><span style={{fontSize:10,fontWeight:700,fontFamily:"'Space Mono'"}}>{Math.round(p)}%</span></Ring></div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:8,color:"rgba(255,255,255,0.5)"}}><span>Ahorrado: <strong style={{color:"#34D399"}}>{fmt(g.saved)}</strong></span><span>Meta: {fmt(g.target)}</span></div>{p>=100&&<div style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:"rgba(52,211,153,0.1)",color:"#34D399",fontSize:12,fontWeight:600,textAlign:"center"}}>{"\u{1F389}"} Meta alcanzada!</div>}<div style={{display:"flex",gap:8,marginTop:10}}><button onClick={()=>abonarGoal(g)} style={{...S.sBtn,background:"rgba(52,211,153,0.15)",color:"#34D399"}}>+ Abonar</button><button onClick={()=>setConfirmDel({type:"goal",id:g.id})} style={{...S.sBtn,background:"rgba(232,98,92,0.1)",color:"#E8625C"}}>Eliminar</button></div></div>;})}
          <div style={{...S.card,marginTop:8}}><div style={S.cTitle}>Nueva meta</div><input placeholder="Nombre" value={gName} onChange={e=>setGName(e.target.value)} maxLength={100} style={S.inp}/><div style={{display:"flex",gap:8}}><input type="number" placeholder="Cantidad meta" value={gTarget} onChange={e=>setGTarget(e.target.value)} inputMode="decimal" style={{...S.inp,flex:1}}/><input type="number" placeholder="Ya tengo..." value={gSaved} onChange={e=>setGSaved(e.target.value)} inputMode="decimal" style={{...S.inp,flex:1}}/></div><input type="date" value={gDeadline} onChange={e=>setGDeadline(e.target.value)} style={S.inp}/><button disabled={!gName||!gTarget} onClick={saveGoal} style={{...S.pBtn,opacity:gName&&gTarget?1:0.4,marginTop:8}}>Crear meta {"\u{1F3AF}"}</button></div>
        </div>}

        {/* AJUSTES */}
        {screen==="ajustes"&&<div style={{animation:"fadeIn 0.4s ease"}}>
          <div style={S.card}><div style={S.cTitle}>Ingreso base mensual</div><div style={S.iRow}><span style={S.dSign}>$</span><input type="number" value={incInput||income} onChange={e=>setIncInput(e.target.value)} inputMode="decimal" style={S.iInp}/></div><button onClick={updateIncome} style={{...S.pBtn,marginTop:8}}>Actualizar</button></div>
          <div style={S.card}><div style={S.cTitle}>Cuenta</div><p style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>{userEmail}</p><button onClick={handleSignOut} style={{...S.sBtn,background:"rgba(232,98,92,0.1)",color:"#E8625C",marginTop:10}}>Cerrar sesion</button></div>
          <div style={S.card}><div style={S.cTitle}>Datos</div><p style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>{allTx.length} transacciones en {new Set(allTx.map(t=>t.month)).size} mes(es). Sincronizados en la nube.</p></div>
        </div>}
      </div>

      {/* TX Modal */}
      {modal&&<div style={S.ov} onClick={()=>setModal(false)}><div style={S.mod} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{fontSize:18,fontWeight:700,color:"#fff"}}>{mMode==="edit"?"Editar":"Nuevo"} {mType==="ingreso"?"ingreso":"gasto"}</h3><button onClick={()=>setModal(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:20,cursor:"pointer"}}>{"\u2715"}</button></div>
        {mMode!=="edit"&&<div style={{display:"flex",gap:6,marginBottom:14}}>{[{t:"gasto",l:"Gasto",c:"#E8625C"},{t:"ingreso",l:"Ingreso",c:"#34D399"}].map(o=><button key={o.t} onClick={()=>{setMType(o.t);setMCat("");}} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans'",border:"1px solid",background:mType===o.t?`${o.c}20`:"transparent",borderColor:mType===o.t?o.c:"rgba(255,255,255,0.08)",color:mType===o.t?o.c:"rgba(255,255,255,0.4)"}}>{o.l}</button>)}</div>}
        <div style={S.iRow}><span style={S.dSign}>$</span><input type="number" placeholder="0" value={mAmt} autoFocus onChange={e=>setMAmt(e.target.value)} inputMode="decimal" style={{...S.iInp,fontSize:28}}/></div>
        {mErr&&<div style={{fontSize:11,color:"#E8625C",marginTop:4}}>{mErr}</div>}
        <div style={{margin:"12px 0 8px",fontSize:12,color:"rgba(255,255,255,0.4)"}}>Categoria</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:160,overflowY:"auto"}}>{(mType==="ingreso"?INC_CATS:EXP_CATS).map(c=><button key={c.id} onClick={()=>setMCat(c.id)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans'",whiteSpace:"nowrap",background:mCat===c.id?`${c.color}30`:"rgba(255,255,255,0.04)",borderColor:mCat===c.id?c.color:"rgba(255,255,255,0.08)",color:mCat===c.id?c.color:"rgba(255,255,255,0.6)"}}>{c.icon} {c.name}</button>)}</div>
        <input placeholder="Nota (opcional)" value={mNote} onChange={e=>setMNote(e.target.value)} maxLength={200} style={{...S.inp,marginTop:10}}/>
        <input type="date" value={mDate} onChange={e=>setMDate(e.target.value)} style={S.inp}/>
        <button disabled={!mAmt||!mCat} onClick={saveTx} style={{...S.pBtn,opacity:mAmt&&mCat?1:0.4,marginTop:12,background:mType==="ingreso"?"linear-gradient(135deg,#34D399,#2DD4BF)":"linear-gradient(135deg,#E8625C,#F4845F)"}}>{mMode==="edit"?"Guardar":"Registrar"} {"\u2713"}</button>
      </div></div>}

      {/* Confirm */}
      {confirmDel&&<div style={S.cOv} onClick={()=>setConfirmDel(null)}><div style={S.cBox} onClick={e=>e.stopPropagation()}><div style={{fontSize:15,color:"#fff",marginBottom:16}}>Eliminar {confirmDel.type==="goal"?"esta meta":"esta transaccion"}?</div><div style={{display:"flex",gap:8}}><button onClick={()=>setConfirmDel(null)} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans'"}}>Cancelar</button><button onClick={()=>confirmDel.type==="goal"?deleteGoal(confirmDel.id):deleteTx(confirmDel.id)} style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",background:"#E8625C",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans'"}}>Eliminar</button></div></div></div>}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:200,animation:"fadeIn 0.3s ease",fontFamily:"'DM Sans'",maxWidth:400,background:toast.type==="error"?"rgba(232,98,92,0.92)":"rgba(52,211,153,0.92)",color:"#fff"}}>{toast.type==="success"?"\u2713":"\u2717"} {toast.msg}</div>}

      {/* FAB */}
      <button onClick={()=>openModal("gasto")} style={S.fab}><span style={{fontSize:28,lineHeight:1}}>+</span></button>

      {/* Nav */}
      <div style={S.nav}>{[{id:"home",i:"\u{1F4CA}",l:"Resumen"},{id:"gastos",i:"\u{1F4B8}",l:"Gastos"},{id:"historial",i:"\u{1F4C5}",l:"Historial"},{id:"metas",i:"\u{1F3AF}",l:"Metas"},{id:"ajustes",i:"\u{2699}\u{FE0F}",l:"Ajustes"}].map(t=><button key={t.id} onClick={()=>setScreen(t.id)} style={{...S.nBtn,color:screen===t.id?"#34D399":"rgba(255,255,255,0.35)"}}><span style={{fontSize:18}}>{t.i}</span><span style={{fontSize:8,marginTop:2,fontWeight:screen===t.id?600:400}}>{t.l}</span></button>)}</div>
    </div>
  );
}

// ─── Sub-components ───
const TxRow = memo(({tx,onEdit,onDel,isInc})=>{
  const c=CAT_MAP[tx.category];const cl=c?.color||"#555";
  return<div style={S.txR}><div style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer"}} onClick={onEdit}><div style={{width:36,height:36,borderRadius:10,background:`${cl}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c?.icon||"\u{1F4B0}"}</div><div><div style={{fontSize:13,color:"rgba(255,255,255,0.9)",fontWeight:500}}>{c?.name||tx.category}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{tx.note?`${tx.note} \u00B7 ${tx.date}`:tx.date}</div></div></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:"'Space Mono'",fontSize:13,color:isInc?"#34D399":"#E8625C"}}>{isInc?"+":"-"}{fmt(tx.amount)}</span><button onClick={e=>{e.stopPropagation();onDel();}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:12,cursor:"pointer",padding:4}}>{"\u2715"}</button></div></div>;
});

const HistChart = memo(({txs,income,curMonth})=>{
  const data=useMemo(()=>{const ms=[];for(let i=5;i>=0;i--)ms.push(shiftMK(curMonth,-i));return ms.map(mk=>{const g=txs.filter(t=>t.month===mk&&t.type==="gasto");const bg={n:0,d:0,a:0};for(const t of g){const c=CAT_MAP[t.category];if(c){if(c.type==="necesidad")bg.n+=Number(t.amount);if(c.type==="deseo")bg.d+=Number(t.amount);if(c.type==="ahorro")bg.a+=Number(t.amount);}}return{mk,n:bg.n,d:bg.d,a:bg.a,t:bg.n+bg.d+bg.a};});},[txs,curMonth]);
  const mx=Math.max(...data.map(d=>d.t),income||1),H=130;
  return<div style={{padding:"0 4px"}}>{income>0&&<div style={{position:"relative",height:0}}><div style={{position:"absolute",top:-H*(income/mx),left:0,right:0,borderTop:"1.5px dashed rgba(52,211,153,0.35)",zIndex:1}}><span style={{position:"absolute",right:0,top:-14,fontSize:9,color:"rgba(52,211,153,0.6)",fontFamily:"'Space Mono'"}}>Ingreso</span></div></div>}<div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6,height:H}}>{data.map((d,i)=>{const hN=mx>0?(d.n/mx)*H:0,hD=mx>0?(d.d/mx)*H:0,hA=mx>0?(d.a/mx)*H:0,now=d.mk===curMonth;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>{d.t>0&&<span style={{fontSize:8,color:"rgba(255,255,255,0.4)",fontFamily:"'Space Mono'"}}>{fmtS(d.t)}</span>}<div style={{width:"100%",display:"flex",flexDirection:"column-reverse",borderRadius:6,overflow:"hidden",opacity:now?1:0.65}}>{hN>0&&<div style={{height:hN,background:"#E8625C",transition:"height 0.6s"}}/>}{hD>0&&<div style={{height:hD,background:"#A78BFA",transition:"height 0.6s"}}/>}{hA>0&&<div style={{height:hA,background:"#34D399",transition:"height 0.6s"}}/>}{d.t===0&&<div style={{height:3,background:"rgba(255,255,255,0.06)"}}/>}</div><span style={{fontSize:9,color:now?"#fff":"rgba(255,255,255,0.35)",fontWeight:now?600:400}}>{mshort(d.mk)}</span></div>;})}</div><div style={{display:"flex",justifyContent:"center",gap:14,marginTop:10}}>{[{c:"#E8625C",l:"Necesidades"},{c:"#A78BFA",l:"Deseos"},{c:"#34D399",l:"Ahorro"}].map((it,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:it.c}}/><span style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>{it.l}</span></div>)}</div></div>;
});

const MRow = memo(({mk,txs,income})=>{
  const g=txs.filter(t=>t.month===mk&&t.type==="gasto"),ing=txs.filter(t=>t.month===mk&&t.type==="ingreso");
  const tg=g.reduce((s,t)=>s+Number(t.amount),0),ti=ing.reduce((s,t)=>s+Number(t.amount),0),eff=ti>0?ti:income,saved=eff-tg;
  return<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}><div><div style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:500}}>{mlabel(mk)}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{g.length}g{ing.length>0?` \u00B7 ${ing.length}i`:""}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:"'Space Mono'",fontSize:13,color:"#E8625C"}}>{fmt(tg)}</div><div style={{fontFamily:"'Space Mono'",fontSize:10,color:saved>=0?"#34D399":"#E8625C"}}>{saved>=0?"+":""}{fmt(saved)}</div></div></div>;
});

// ─── Styles ───
const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}input:focus,button:focus{outline:none}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}button{-webkit-tap-highlight-color:transparent}`;

const S = {
  ctn:{fontFamily:"'DM Sans',sans-serif",background:"linear-gradient(165deg,#0F1119 0%,#171B2D 50%,#0F1119 100%)",minHeight:"100vh",color:"#fff",position:"relative",maxWidth:480,margin:"0 auto",paddingBottom:80},
  hdr:{padding:"16px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-end",borderBottom:"1px solid rgba(255,255,255,0.05)"},
  hSub:{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Space Mono'",letterSpacing:1.5,textTransform:"uppercase"},
  hTitle:{fontSize:22,fontWeight:700,marginTop:2},
  badge:{fontSize:11,padding:"4px 10px",borderRadius:8,background:"rgba(52,211,153,0.1)",color:"#34D399",fontFamily:"'Space Mono'",whiteSpace:"nowrap"},
  content:{padding:"12px 16px"},
  card:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:16,marginBottom:12},
  cTitle:{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.5)",marginBottom:12,letterSpacing:0.3},
  gCard:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:16,marginBottom:10},
  txR:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"},
  iRow:{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"8px 14px",border:"1px solid rgba(255,255,255,0.08)"},
  dSign:{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.3)",fontFamily:"'Space Mono'"},
  iInp:{flex:1,background:"none",border:"none",color:"#fff",fontSize:22,fontFamily:"'Space Mono'",fontWeight:700},
  inp:{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,marginTop:6,fontFamily:"'DM Sans'"},
  pBtn:{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#34D399,#2DD4BF)",color:"#0F1119",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans'"},
  sBtn:{padding:"6px 12px",borderRadius:8,border:"none",fontSize:12,cursor:"pointer",fontWeight:500,fontFamily:"'DM Sans'"},
  lBtn:{background:"none",border:"none",color:"#34D399",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans'"},
  alert:{margin:"8px 16px 0",padding:"10px 12px",borderRadius:10,border:"1px solid",display:"flex",alignItems:"center",gap:8,animation:"fadeIn 0.5s ease"},
  aClose:{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:14,cursor:"pointer",padding:4},
  mArr:{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:"4px 8px",fontWeight:700},
  fab:{position:"fixed",bottom:76,right:"calc(50% - 220px)",width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#34D399,#2DD4BF)",border:"none",color:"#0F1119",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(52,211,153,0.3)",zIndex:50},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(15,17,25,0.95)",backdropFilter:"blur(12px)",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-around",padding:"8px 0 12px",zIndex:40},
  nBtn:{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",fontFamily:"'DM Sans'",padding:"4px 8px"},
  ov:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  mod:{background:"#1A1E2E",borderRadius:"20px 20px 0 0",padding:"20px 20px 28px",width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.3s ease"},
  cOv:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center"},
  cBox:{background:"#1A1E2E",borderRadius:16,padding:24,width:"calc(100% - 48px)",maxWidth:320,textAlign:"center"},
};
