import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL  = import.meta.env.VITE_WS_URL  || "ws://localhost:8000/ws";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt      = (n, d=1) => (typeof n==="number" ? n.toFixed(d) : "—");
const fmtPrice = (n) => (typeof n==="number" ? n.toLocaleString("en-IN",{maximumFractionDigits:2}) : "—");
const sigColor = (s) => ({BUY:"#00e5a0",SELL:"#ff4b6e",WAIT:"#8892a4"}[s]||"#8892a4");
const sigBg    = (s) => ({BUY:"rgba(0,229,160,.10)",SELL:"rgba(255,75,110,.10)",WAIT:"rgba(136,146,164,.06)"}[s]||"transparent");
const api      = async (path, opts={}) => {
  const token = localStorage.getItem("ns_token");
  const res   = await fetch(`${API_URL}${path}`, {
    headers:{"Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{})},
    ...opts,
  });
  if (!res.ok) { const e=await res.json().catch(()=>({detail:"Error"})); throw new Error(e.detail); }
  return res.json();
};

function computeSig(row, lt, st) {
  if (!row) return null;
  const pl=row.prob_long, ps=row.prob_short;
  if (pl>=lt && pl>ps)  return "BUY";
  if (ps>=st && ps>pl)  return "SELL";
  return "WAIT";
}

// ── Shared UI Components ──────────────────────────────────────────────────────
function SignalBadge({ signal, large }) {
  const c=sigColor(signal);
  const size=large?{fontSize:24,fontWeight:800,padding:"10px 26px",letterSpacing:".12em"}:{fontSize:11,fontWeight:700,padding:"2px 10px",letterSpacing:".1em"};
  return <span style={{fontFamily:"'JetBrains Mono',monospace",color:c,background:sigBg(signal),border:`1px solid ${c}33`,borderRadius:6,display:"inline-block",...size}}>{signal||"—"}</span>;
}

function ThresholdBar({ label, val, onChange, color, isAdmin }) {
  const marks=[50,60,70,80,90,95];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color,letterSpacing:".08em"}}>{label}</span>
        <span style={{fontSize:16,fontWeight:800,color,background:`${color}14`,border:`1px solid ${color}33`,borderRadius:6,padding:"1px 10px",fontFamily:"'JetBrains Mono',monospace"}}>{val}%</span>
      </div>
      <input type="range" min={50} max={95} step={5} value={val}
        onChange={e=>isAdmin&&onChange(+e.target.value)}
        disabled={!isAdmin}
        style={{accentColor:color,width:"100%",cursor:isAdmin?"pointer":"not-allowed",opacity:isAdmin?1:.6}}/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {marks.map(m=><span key={m} style={{fontSize:9,color:m===val?color:"#3a4052",fontWeight:m===val?700:400,fontFamily:"'JetBrains Mono',monospace"}}>{m}</span>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const fd = new URLSearchParams();
      fd.append("username", user); fd.append("password", pass);
      const res = await fetch(`${API_URL}/auth/token`, {method:"POST", body:fd});
      if (!res.ok) { const e=await res.json(); throw new Error(e.detail); }
      const data = await res.json();
      localStorage.setItem("ns_token", data.access_token);
      localStorage.setItem("ns_user",  JSON.stringify(data));
      onLogin(data);
    } catch(e) { setErr(e.message||"Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b0e14"}}>
      <div style={{width:360,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,padding:"36px 32px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#00e5a0,#00b8d9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#0b0e14",fontFamily:"'Syne',sans-serif"}}>N</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#e8ecf3"}}>NIFTY SNIPER</div>
            <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em"}}>LIVE SIGNAL PLATFORM</div>
          </div>
        </div>
        <div style={{fontSize:13,color:"#5a6478"}}>Sign in to access live signals</div>
        {err && <div style={{background:"rgba(255,75,110,.12)",border:"1px solid rgba(255,75,110,.3)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#ff4b6e"}}>{err}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Username"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"11px 14px",color:"#e8ecf3",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&submit()} />
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Password"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"11px 14px",color:"#e8ecf3",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&submit()} />
          <button onClick={submit} disabled={busy||!user||!pass}
            style={{background:"linear-gradient(135deg,#00e5a0,#00b8d9)",border:"none",borderRadius:8,padding:"12px 0",color:"#0b0e14",fontSize:13,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer",opacity:busy||!user||!pass?0.5:1}}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL + BACKTEST ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function AdminPanel({ user, onLogout }) {
  const [tab,   setTab]  = useState("subscribers");
  const [subs,  setSubs] = useState([]);
  const [stats, setStats]= useState(null);
  const [ds,    setDs]   = useState(null);
  const [msg,   setMsg]  = useState("");

  const [newUser, setNewUser] = useState({
