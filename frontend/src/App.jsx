import TradingViewChart from './TradingViewChart';
import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL  = import.meta.env.VITE_WS_URL  || "ws://localhost:8000/ws";

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
  const pl=row.prob_long ?? row.long_prob, ps=row.prob_short ?? row.short_prob;
  if (pl>=lt && pl>ps)  return "BUY";
  if (ps>=st && ps>pl)  return "SELL";
  return "WAIT";
}

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
      <input type="range" min={50} max={95} step={5} value={val} onChange={e=>isAdmin&&onChange(+e.target.value)} disabled={!isAdmin} style={{accentColor:color,width:"100%",cursor:isAdmin?"pointer":"not-allowed",opacity:isAdmin?1:.6}}/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {marks.map(m=><span key={m} style={{fontSize:9,color:m===val?color:"#3a4052",fontWeight:m===val?700:400,fontFamily:"'JetBrains Mono',monospace"}}>{m}</span>)}
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [user, setUser] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const fd = new URLSearchParams(); fd.append("username", user); fd.append("password", pass);
      const res = await fetch(`${API_URL}/auth/token`, {method:"POST", body:fd});
      if (!res.ok) { const e=await res.json(); throw new Error(e.detail); }
      const data = await res.json();
      localStorage.setItem("ns_token", data.access_token); localStorage.setItem("ns_user", JSON.stringify(data));
      onLogin(data);
    } catch(e) { setErr(e.message||"Login failed"); } finally { setBusy(false); }
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0b0e14"}}>
      <div style={{width:360,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:18,padding:"36px 32px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#00e5a0,#00b8d9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#0b0e14",fontFamily:"'Syne',sans-serif"}}>N</div>
          <div><div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#e8ecf3"}}>NIFTY SNIPER</div><div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em"}}>LIVE SIGNAL PLATFORM</div></div>
        </div>
        <div style={{fontSize:13,color:"#5a6478"}}>Sign in to access live signals</div>
        {err && <div style={{background:"rgba(255,75,110,.12)",border:"1px solid rgba(255,75,110,.3)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#ff4b6e"}}>{err}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Username" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"11px 14px",color:"#e8ecf3",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none"}} onKeyDown={e=>e.key==="Enter"&&submit()} />
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Password" style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"11px 14px",color:"#e8ecf3",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none"}} onKeyDown={e=>e.key==="Enter"&&submit()} />
          <button onClick={submit} disabled={busy||!user||!pass} style={{background:"linear-gradient(135deg,#00e5a0,#00b8d9)",border:"none",borderRadius:8,padding:"12px 0",color:"#0b0e14",fontSize:13,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer",opacity:busy||!user||!pass?0.5:1}}>{busy ? "Signing in…" : "Sign in →"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ user, onLogout }) {
  const [tab, setTab]  = useState("history");
  const [subs, setSubs] = useState([]);
  const [stats, setStats]= useState(null);
  const [ds, setDs]   = useState(null);
  const [msg, setMsg]  = useState("");

  const [newUser, setNewUser] = useState({username:"",password:"",name:"",email:""});
  const [breeze, setBreeze]   = useState({api_key:"",api_secret:"",session_token:""});

  const [histTab, setHistTab] = useState({ data: [], days: 1, loading: false });
  const [simT, setSimT] = useState({ long: 80, short: 80, linked: true });
  
  // Track backend evaluation mode
  const [evalMode, setEvalMode] = useState(1);
  const wsRef = useRef(null);

  const load = async () => {
    try {
      const [s, st, d] = await Promise.all([ api("/admin/subscribers"), api("/admin/stats"), api("/admin/data-source") ]);
      setSubs(s); setStats(st); setDs(d);
      if (st.eval_mode) setEvalMode(st.eval_mode);
    } catch(e) { setMsg("Error: "+e.message); }
  };

  useEffect(() => { load(); }, []);
  const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  const createSub = async () => {
    try { await api("/admin/subscribers",{method:"POST",body:JSON.stringify(newUser)}); setNewUser({username:"",password:"",name:"",email:""}); flash("✓ Subscriber created"); load(); }
    catch(e) { flash("✗ "+e.message); }
  };

  const toggleStatus = async (username, currentStatus) => {
    try { await api(`/admin/subscribers/${username}`,{method:"PATCH",body:JSON.stringify({status:currentStatus==="active"?"suspended":"active"})}); load(); }
    catch(e) { flash("✗ "+e.message); }
  };

  const removeSub = async (username) => {
    if (!confirm(`Delete ${username}?`)) return;
    try { await api(`/admin/subscribers/${username}`,{method:"DELETE"}); load(); flash("✓ Deleted"); }
    catch(e) { flash("✗ "+e.message); }
  };

  const switchToYF = async () => { try { await api("/admin/data-source",{method:"POST",body:JSON.stringify({source:"yfinance"})}); load(); flash("✓ Switched to yfinance"); } catch(e) { flash("✗ "+e.message); } };
  const switchToBreeze = async () => {
    if (!breeze.api_key||!breeze.api_secret||!breeze.session_token) return flash("Fill all Breeze fields");
    try { await api("/admin/data-source",{method:"POST",body:JSON.stringify({source:"breeze",...breeze})}); load(); flash("✓ Switched to Breeze"); } catch(e) { flash("✗ "+e.message); }
  };

  const fetchHistory = async (d) => {
    setHistTab(p => ({ ...p, loading: true, days: d }));
    try {
      const res = await api(`/admin/history?days_back=${d}`);
      setHistTab({ data: res.data.reverse(), days: d, loading: false });
    } catch(e) {
      if (e.message.includes("warming up")) flash("⏳ Engine is currently warming up indicators. Please wait a minute.");
      else flash("✗ History fetch failed.");
      setHistTab(p => ({ ...p, loading: false }));
    }
  };

  useEffect(() => { if (tab === "history" && histTab.data.length === 0) fetchHistory(histTab.days); }, [tab]);

  // Connect WS just to push Admin Mode changes instantly without refreshing
  useEffect(() => {
    const token = localStorage.getItem("ns_token");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = ({data}) => {
        const msg = JSON.parse(data);
        if (msg.type === "eval_mode_changed") {
            setEvalMode(msg.mode);
            fetchHistory(histTab.days); // Re-fetch exact history points
        }
    };
    return () => ws.close();
  }, []);

  const changeEvalMode = (mode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "set_eval_mode", mode }));
        flash("Rebuilding backend state. Please wait...");
    }
  };

  const tabStyle = (t) => ({ padding:"8px 16px", fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", letterSpacing:".08em", textTransform:"uppercase", cursor:"pointer", border:"none", borderBottom: tab===t ? "2px solid #00e5a0" : "2px solid transparent", background:"transparent", color: tab===t ? "#00e5a0" : "#5a6478" });
  const input = (val, onChange, placeholder, type="text") => ( <input value={val} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"9px 12px",color:"#e8ecf3",fontSize:12,fontFamily:"'JetBrains Mono',monospace",outline:"none",width:"100%"}} /> );

  return (
    <div style={{minHeight:"100vh",background:"#0b0e14",display:"flex",flexDirection:"column"}}>
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:52,borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(11,14,20,.97)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#00e5a0,#00b8d9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#0b0e14"}}>N</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:"#e8ecf3"}}>NIFTY SNIPER</span><span style={{fontSize:10,color:"#3a4052",letterSpacing:".1em"}}>ADMIN CONSOLE</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {ds && <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:ds.connected?"#00e5a0":"#ff4b6e",background:ds.connected?"rgba(0,229,160,.08)":"rgba(255,75,110,.08)",border:`1px solid ${ds.connected?"rgba(0,229,160,.2)":"rgba(255,75,110,.2)"}`,borderRadius:5,padding:"2px 10px"}}>{ds.source?.toUpperCase()} {ds.connected?"●":"○"}</span>}
          <span style={{fontSize:11,color:"#5a6478",fontFamily:"'JetBrains Mono',monospace"}}>{user.name}</span>
          <button onClick={onLogout} style={{fontSize:11,color:"#ff4b6e",background:"rgba(255,75,110,.08)",border:"1px solid rgba(255,75,110,.2)",borderRadius:5,padding:"4px 12px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>Logout</button>
        </div>
      </header>

      <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16,maxWidth:1000,width:"100%",margin:"0 auto"}}>
        {stats && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[{label:"Active sessions", val:stats.connected_users, c:"#00e5a0"},{label:"Signals logged", val:stats.signal_count, c:"#c5ccd8"},{label:"Long threshold", val:stats.thresholds?.long+"%", c:"#00e5a0"},{label:"Short threshold", val:stats.thresholds?.short+"%", c:"#ff4b6e"}].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"#5a6478",letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>{s.label}</div><div style={{fontSize:22,fontWeight:700,color:s.c,fontFamily:"'JetBrains Mono',monospace"}}>{s.val}</div></div>
            ))}
          </div>
        )}
        {msg && <div style={{background:"rgba(0,229,160,.08)",border:"1px solid rgba(0,229,160,.2)",borderRadius:8,padding:"10px 16px",fontSize:12,color:"#00e5a0",fontFamily:"'JetBrains Mono',monospace"}}>{msg}</div>}

        <div style={{borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",gap:4}}>
          <button style={tabStyle("history")}     onClick={()=>setTab("history")}>Simulation Engine</button>
          <button style={tabStyle("datasource")}  onClick={()=>setTab("datasource")}>Data Connection</button>
          <button style={tabStyle("subscribers")} onClick={()=>setTab("subscribers")}>Subscribers</button>
        </div>

        {tab==="subscribers" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:11,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase"}}>Add subscriber</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{input(newUser.username, v=>setNewUser(p=>({...p,username:v})), "Username *")} {input(newUser.password, v=>setNewUser(p=>({...p,password:v})), "Password *", "password")} {input(newUser.name, v=>setNewUser(p=>({...p,name:v})), "Full name")} {input(newUser.email, v=>setNewUser(p=>({...p,email:v})), "Email")}</div>
              <button onClick={createSub} disabled={!newUser.username||!newUser.password} style={{alignSelf:"flex-start",background:"linear-gradient(135deg,#00e5a0,#00b8d9)",border:"none",borderRadius:7,padding:"9px 20px",color:"#0b0e14",fontSize:12,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer",opacity:!newUser.username||!newUser.password?0.4:1}}>+ Add subscriber</button>
            </div>
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 120px 120px",padding:"9px 16px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)"}}>{["Username","Name","Email","Status","Actions"].map(h=>(<span key={h} style={{fontSize:10,color:"#5a6478",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>{h}</span>))}</div>
              {subs.length===0 ? <div style={{padding:"30px 0",textAlign:"center",color:"#5a6478",fontSize:12}}>No subscribers yet</div> : subs.map((s,i)=>(
                <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 120px 120px",padding:"10px 16px",background:i%2===0?"rgba(255,255,255,.015)":"transparent",borderBottom:"1px solid rgba(255,255,255,.04)",alignItems:"center",fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>
                  <span style={{color:"#c5ccd8"}}>{s.username}</span><span style={{color:"#8892a4"}}>{s.name}</span><span style={{color:"#5a6478",fontSize:11}}>{s.email||"—"}</span><span style={{color:s.status==="active"?"#00e5a0":"#ff4b6e",fontSize:11,fontWeight:700}}>{s.status.toUpperCase()}</span>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>toggleStatus(s.username,s.status)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",color:"#c5ccd8",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{s.status==="active"?"Suspend":"Activate"}</button>
                    <button onClick={()=>removeSub(s.username)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,75,110,.2)",background:"rgba(255,75,110,.06)",color:"#ff4b6e",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="datasource" && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {ds && (
              <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${ds.connected?"rgba(0,229,160,.2)":"rgba(255,75,110,.2)"}`,borderRadius:12,padding:"16px 20px"}}>
                <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Active data source</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18,fontWeight:800,color:ds.connected?"#00e5a0":"#ff4b6e",fontFamily:"'JetBrains Mono',monospace"}}>{ds.source?.toUpperCase()}</span>
                  <span style={{fontSize:11,color:"#8892a4"}}>{ds.delay_note}</span>
                  {ds.error && <span style={{fontSize:11,color:"#ff4b6e"}}>⚠ {ds.error}</span>}
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#c5ccd8",fontFamily:"'JetBrains Mono',monospace"}}>yfinance (Free)</div>
                <div style={{fontSize:11,color:"#5a6478",lineHeight:1.7}}>• No API key needed<br/>• NSE Nifty 50 (^NSEI)<br/>• ~15 min delay during market hours<br/>• Good for testing & paper trading</div>
                <button onClick={switchToYF} style={{background:"rgba(0,229,160,.1)",border:"1px solid rgba(0,229,160,.3)",borderRadius:7,padding:"9px 0",color:"#00e5a0",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer"}}>Switch to yfinance</button>
              </div>
              <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,165,0,.15)",borderRadius:12,padding:"18px 20px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f0c040",fontFamily:"'JetBrains Mono',monospace"}}>ICICI Direct Breeze</div>
                <div style={{fontSize:11,color:"#5a6478",lineHeight:1.7}}>• Real-time tick data<br/>• Requires ICICI demat + API registration<br/>• Session token refreshed daily<br/>• Best for live trading</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>{input(breeze.api_key, v=>setBreeze(p=>({...p,api_key:v})), "API Key")} {input(breeze.api_secret, v=>setBreeze(p=>({...p,api_secret:v})), "API Secret", "password")} {input(breeze.session_token, v=>setBreeze(p=>({...p,session_token:v})), "Session Token (daily)")}</div>
                <button onClick={switchToBreeze} style={{background:"rgba(240,192,64,.1)",border:"1px solid rgba(240,192,64,.3)",borderRadius:7,padding:"9px 0",color:"#f0c040",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",cursor:"pointer"}}>Connect Breeze →</button>
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            
            {/* Global Mode Switcher */}
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.09)",borderRadius:13,padding:"18px 22px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase"}}>Global Algorithm Mode</div>
              </div>
              <div style={{display:"flex",gap:12}}>
                  <button onClick={() => changeEvalMode(1)} style={{flex:1, padding:"12px", borderRadius:6, background:evalMode===1?"rgba(0,229,160,.1)":"rgba(255,255,255,.03)", border:`1px solid ${evalMode===1?"#00e5a0":"rgba(255,255,255,.1)"}`, color:evalMode===1?"#00e5a0":"#8892a4", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace"}}>
                      Mode 1: Classic (Repaints)<br/><span style={{fontSize:10,color:"#5a6478"}}>Aggressive open-candle evaluation.</span>
                  </button>
                  <button onClick={() => changeEvalMode(2)} style={{flex:1, padding:"12px", borderRadius:6, background:evalMode===2?"rgba(255,75,110,.1)":"rgba(255,255,255,.03)", border:`1px solid ${evalMode===2?"#ff4b6e":"rgba(255,255,255,.1)"}`, color:evalMode===2?"#ff4b6e":"#8892a4", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace"}}>
                      Mode 2: Strict (Locked)<br/><span style={{fontSize:10,color:"#5a6478"}}>100% Repaint-free closed-candle output.</span>
                  </button>
              </div>
            </div>

            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.09)",borderRadius:13,padding:"18px 22px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase"}}>Historical Simulation Controls</div>
                <div style={{display:"flex",gap:8}}>
                  {[1, 3, 5].map(d => <button key={d} onClick={() => fetchHistory(d)} style={{fontSize:10,padding:"4px 10px",borderRadius:4,background:histTab.days===d?"rgba(0,229,160,.2)":"rgba(255,255,255,.05)",color:histTab.days===d?"#00e5a0":"#c5ccd8",border:"none",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{d} Day{d>1?'s':''}</button>)}
                  <button onClick={() => fetchHistory(histTab.days)} style={{fontSize:10,padding:"4px 10px",borderRadius:4,background:"rgba(255,255,255,.05)",color:"#c5ccd8",border:"none",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>↻ Refresh</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <ThresholdBar label="SIMULATED LONG" val={simT.long} onChange={v => setSimT(p=>({...p, long:v, short: p.linked?v:p.short}))} color="#00e5a0" isAdmin={true}/>
                <ThresholdBar label="SIMULATED SHORT" val={simT.short} onChange={v => setSimT(p=>({...p, short:v, long: p.linked?v:p.long}))} color="#ff4b6e" isAdmin={true}/>
              </div>
            </div>

            {!histTab.loading && histTab.data.length > 0 && (
                <TradingViewChart data={histTab.data} longT={simT.long} shortT={simT.short} />
            )}

            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:13,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"140px 100px 100px 90px 90px",padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)"}}>
                {["Time (IST)","Price ₹","Sim Signal","Long %","Short %"].map(h=><span key={h} style={{fontSize:10,color:"#5a6478",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</span>)}
              </div>
              <div style={{maxHeight:350,overflowY:"auto"}}>
                {histTab.loading ? <div style={{padding:"32px 0",textAlign:"center",color:"#5a6478",fontSize:12}}>Loading history from Engine...</div> : histTab.data.length === 0 ? <div style={{padding:"32px 0",textAlign:"center",color:"#5a6478",fontSize:12}}>No history available.</div> : histTab.data.map((s,i) => {
                   let sig = "WAIT";
                   if (s.long_prob >= simT.long && s.long_prob > s.short_prob) sig = "BUY";
                   if (s.short_prob >= simT.short && s.short_prob > s.long_prob) sig = "SELL";
                   const d = new Date(s.time);
                   const tStr = d.toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit", timeZone:"Asia/Kolkata"});
                   const dateStr = d.toLocaleDateString("en-IN", {month:"short", day:"numeric", timeZone:"Asia/Kolkata"});

                   return (
                     <div key={i} style={{display:"grid",gridTemplateColumns:"140px 100px 100px 90px 90px",padding:"7px 14px",background:i%2===0?"rgba(255,255,255,.018)":"transparent",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:"#8892a4",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                       <span style={{color:"#5a6478"}}>{dateStr} {tStr}</span>
                       <span style={{color:"#c5ccd8",fontWeight:600}}>{fmtPrice(s.close)}</span>
                       <SignalBadge signal={sig}/>
                       <span style={{color:s.long_prob>=simT.long?"#00e5a0":"#5a6478",fontWeight:s.long_prob>=simT.long?700:400}}>{fmt(s.long_prob)}%</span>
                       <span style={{color:s.short_prob>=simT.short?"#ff4b6e":"#5a6478",fontWeight:s.short_prob>=simT.short?700:400}}>{fmt(s.short_prob)}%</span>
                     </div>
                   );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Gauge({ label, value, color, threshold }) {
  const pct=Math.min(100,Math.max(0,value||0)), r=32, cx=42, cy=42, C=2*Math.PI*r;
  const thDash=(threshold/100)*C;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={7}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} strokeDasharray={`1.5 ${C-1.5}`} strokeDashoffset={-(thDash-C*0.25)} opacity={0.5}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${(pct/100)*C} ${C}`} strokeDashoffset={C*0.25} strokeLinecap="round" style={{transition:"stroke-dasharray .8s cubic-bezier(.4,0,.2,1)"}}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,fill:pct>=threshold?color:"#5a6478"}}>{fmt(pct,0)}%</text>
      </svg>
      <span style={{fontSize:11,color:"#5a6478",letterSpacing:".08em",textTransform:"uppercase",fontFamily:"'JetBrains Mono',monospace"}}>{label}</span>
    </div>
  );
}

function HistoryRow({ s, i, lt, st }) {
  const t = new Date(s.timestamp);
  const timeStr = t.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit", timeZone: "Asia/Kolkata"});
  const recomputed = computeSig(s,lt,st);
  return (
    <div style={{display:"grid",gridTemplateColumns:"80px 90px 80px 65px 65px 56px 70px",padding:"7px 14px",background:i%2===0?"rgba(255,255,255,.018)":"transparent",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:"#8892a4",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
      <span style={{color:"#5a6478"}}>{timeStr}</span>
      <span style={{color:"#c5ccd8"}}>{fmtPrice(s.price)}</span>
      <SignalBadge signal={recomputed}/>
      <span style={{color:s.prob_long>=lt?"#00e5a0":"#5a6478",fontWeight:s.prob_long>=lt?700:400}}>{fmt(s.prob_long)}%</span>
      <span style={{color:s.prob_short>=st?"#ff4b6e":"#5a6478",fontWeight:s.prob_short>=st?700:400}}>{fmt(s.prob_short)}%</span>
      <span style={{color:s.adx_2m>25?"#f0c040":"#5a6478"}}>{fmt(s.adx_2m)}</span>
      <span style={{fontSize:10,color:s.data_source==="breeze"?"#f0c040":"#3a4052"}}>{s.data_source||"—"}</span>
    </div>
  );
}

function SignalDashboard({ user, onLogout, token }) {
  const [latest,  setLatest]  = useState(null);
  const [history, setHistory] = useState([]);
  const [wsState, setWsState] = useState("connecting");
  const [longT,   setLongT]   = useState(80);
  const [shortT,  setShortT]  = useState(80);
  const [linked,  setLinked]  = useState(true);
  const [evalMode, setEvalMode] = useState(1);
  const wsRef=useRef(null), rTimer=useRef(null);
  const isAdmin = user.role==="admin";

  const connect = useCallback(()=>{
    if (wsRef.current?.readyState===WebSocket.OPEN) return;
    setWsState("connecting");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onopen=()=>{ setWsState("open"); };
    ws.onclose=()=>{ setWsState("closed"); rTimer.current=setTimeout(connect,4000); };
    ws.onerror=()=>ws.close();
    ws.onmessage=({data})=>{
      const msg = JSON.parse(data);
      if (msg.type==="signal"){ setLatest(msg.data); setHistory(h=>[msg.data,...h].slice(0,200)); }
      if (msg.type==="history"){ setHistory(msg.data); if(msg.data.length) setLatest(msg.data[0]); }
      if (msg.type==="eval_mode_changed") setEvalMode(msg.mode);
    };
  },[]);

  useEffect(()=>{ connect(); return ()=>{ clearTimeout(rTimer.current); wsRef.current?.close(); }; },[connect]);

  const displaySig=computeSig(latest,longT,shortT);
  const statusColor={connecting:"#f0c040",open:"#00e5a0",closed:"#ff4b6e"}[wsState];

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Syne:wght@700;800&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:#0b0e14;color:#c5ccd8;font-family:'JetBrains Mono',monospace}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}`}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:52,borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(11,14,20,.97)",position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#00e5a0,#00b8d9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#0b0e14"}}>N</div>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:"#e8ecf3"}}>NIFTY SNIPER</span>
            <span style={{fontSize:10,color:evalMode===1?"#f0c040":"#00e5a0",border:`1px solid ${evalMode===1?"#f0c040":"#00e5a0"}`,padding:"2px 6px",borderRadius:4}}>MODE {evalMode}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:10,color:"#5a6478",fontFamily:"'JetBrains Mono',monospace"}}>{user.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
              <span style={{fontSize:11,color:statusColor}}>{wsState==="open"?"Live":wsState==="connecting"?"Connecting…":"Reconnecting…"}</span>
            </div>
            <button onClick={onLogout} style={{fontSize:10,color:"#ff4b6e",background:"rgba(255,75,110,.08)",border:"1px solid rgba(255,75,110,.2)",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>Logout</button>
          </div>
        </header>

        <main style={{flex:1,padding:"20px 24px",display:"flex",flexDirection:"column",gap:16,maxWidth:1100,width:"100%",margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <div style={{background:"rgba(255,255,255,.03)",border:`1px solid rgba(255,255,255,.07)`,borderRadius:14,padding:"20px 22px",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase"}}>Current Signal</div>
              <SignalBadge signal={displaySig||"—"} large/>
              <div>
                <div style={{fontSize:26,fontWeight:700,color:"#e8ecf3",letterSpacing:"-.02em"}}>₹ {fmtPrice(latest?.price)}</div>
                <div style={{fontSize:11,color:"#5a6478",marginTop:3}}>{latest?.timestamp?new Date(latest.timestamp).toLocaleTimeString("en-IN", {timeZone: "Asia/Kolkata"}):"—"}</div>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"20px 16px",display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:10,color:"#5a6478",letterSpacing:".1em",textTransform:"uppercase"}}>Brain probabilities</div>
              <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",flex:1}}>
                <Gauge label="Long"  value={latest?.prob_long}  color="#00e5a0" threshold={longT}/>
                <Gauge label="Short" value={latest?.prob_short} color="#ff4b6e" threshold={shortT}/>
              </div>
            </div>
          </div>

          {history && history.length > 0 && <TradingViewChart data={history} longT={longT} shortT={shortT} />}

          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:13,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"80px 90px 80px 65px 65px 56px 70px",padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)"}}>
              {["Time (IST)","Price ₹","Signal","Long %","Short %","ADX","Source"].map(h=><span key={h} style={{fontSize:10,color:"#5a6478",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</span>)}
            </div>
            <div style={{maxHeight:280,overflowY:"auto"}}>
              {history.map((s,i)=><HistoryRow key={s.timestamp+i} s={s} i={i} lt={longT} st={shortT}/>)}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(() => { const raw = localStorage.getItem("ns_user"); return raw ? JSON.parse(raw) : null; });
  const handleLogin = (data) => setAuthUser(data);
  const handleLogout = () => { localStorage.removeItem("ns_token"); localStorage.removeItem("ns_user"); setAuthUser(null); };

  if (!authUser) return <LoginPage onLogin={handleLogin}/>;
  if (authUser.role==="admin") return <AdminPanel user={authUser} onLogout={handleLogout}/>;
  return <SignalDashboard user={authUser} onLogout={handleLogout} token={localStorage.getItem("ns_token")}/>;
}
