import { useState, useEffect, useRef, useCallback } from "react";

const API = "/api/generate";
const DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MEALS = ["Petit-déjeuner","Déjeuner","Dîner"];
const MEAL_ICON = { "Petit-déjeuner":"🌅","Déjeuner":"☀️","Dîner":"🌙" };
const C = { green:"#4ade80",orange:"#fb923c",blue:"#60a5fa",purple:"#a78bfa",bg:"#0d1117",card:"#161b22",border:"#30363d",muted:"#8b949e",text:"#f0f6fc" };

const BADGES = [
  { id:"first_meal", emoji:"🌱", name:"Premier repas",   desc:"Premier plat généré",           msg:"L'aventure commence ! 🌱",              check:({st})=>st.meals>=1 },
  { id:"regular",    emoji:"🔥", name:"Régulier",        desc:"5 repas générés",                msg:"Super habitudes ! 🔥",                  check:({st})=>st.meals>=5 },
  { id:"herbivore",  emoji:"🥗", name:"Herbivore",       desc:"5 repas végétariens",            msg:"La nature vous remercie ! 🥗",          check:({st})=>st.vege>=5 },
  { id:"express",    emoji:"⚡", name:"Express addict",  desc:"3 versions express utilisées",   msg:"La rapidité c'est votre truc ! ⚡",     check:({st})=>st.express>=3 },
  { id:"gourmet",    emoji:"❤️", name:"Gourmet",         desc:"5 favoris sauvegardés",          msg:"Vous savez ce que vous aimez ! ❤️",     check:({favs})=>favs.length>=5 },
  { id:"planner",    emoji:"📋", name:"Planificateur",   desc:"Premier plan semaine",           msg:"Organisé et équilibré ! 📋",             check:({st})=>st.plans>=1 },
  { id:"snacker",    emoji:"🍎", name:"Anti-fringale",   desc:"5 snacks consultés",             msg:"Fini les coups de fatigue ! 🍎",        check:({st})=>st.snacks>=5 },
  { id:"balanced",   emoji:"🏆", name:"Équilibré",       desc:"Badge vert 3 fois",              msg:"Alimentation au top ! 🏆",              check:({st})=>st.greens>=3 },
  { id:"curious",    emoji:"💬", name:"Curieux",         desc:"10 recettes consultées",         msg:"La curiosité, clé de la santé ! 💬",    check:({hist})=>hist.length>=10 },
  { id:"streak",     emoji:"📅", name:"Cette semaine",   desc:"5 jours d'utilisation de suite", msg:"Une semaine parfaite ! 📅",             check:({st})=>st.streak>=5 },
  { id:"expert",     emoji:"🌟", name:"Expert",          desc:"10 badges débloqués",            msg:"Vrai expert nutrition ! 🌟",             check:({unlocked})=>unlocked.length>=10 },
];
const LEVELS = [
  { name:"Débutant", min:0,  color:C.muted },
  { name:"Régulier", min:3,  color:C.blue },
  { name:"Confirmé", min:6,  color:C.orange },
  { name:"Expert",   min:10, color:C.green },
];
const getLevel = n => [...LEVELS].reverse().find(l=>n>=l.min)||LEVELS[0];
const extractMins = txt => { const m=txt.match(/(\d+)\s*min/i); return m?parseInt(m[1]):null; };
const fmtDate = d => new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

async function aiCall(prompt, system) {
  try {
    const r = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1500, system, messages:[{role:"user",content:prompt}] }) });
    const d = await r.json();
    const t = (d.content||[]).map(b=>b.text||"").join("");
    return JSON.parse(t.replace(/```json|```/g,"").trim());
  } catch { return null; }
}

// ─── SMALL UI ────────────────────────────────────────────────
function Spinner({ text }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:".7rem",padding:"1.5rem"}}>
      <div style={{width:30,height:30,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.green}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <p style={{color:C.muted,fontSize:".82rem"}}>{text}</p>
    </div>
  );
}

function MacroBar({ p, g, l, cal }) {
  return (
    <div style={{display:"flex",gap:".35rem",marginTop:".7rem"}}>
      {[["P",`${p}g`,C.green],["G",`${g}g`,C.orange],["L",`${l}g`,C.blue],["kcal",cal,C.purple]].map(([k,v,col])=>(
        <div key={k} style={{flex:1,textAlign:"center",background:"rgba(255,255,255,.03)",borderRadius:8,padding:".3rem 0"}}>
          <div style={{fontSize:".6rem",color:C.muted}}>{k}</div>
          <div style={{fontSize:".8rem",fontWeight:700,color:col}}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function Tag({ orange, children }) {
  return (
    <span style={{display:"inline-block",background:orange?"rgba(251,146,60,.12)":"rgba(74,222,128,.12)",color:orange?C.orange:C.green,borderRadius:6,padding:".17rem .52rem",fontSize:".71rem",fontWeight:500}}>
      {children}
    </span>
  );
}

// ─── CHRONO ──────────────────────────────────────────────────
function Chrono({ minutes, label }) {
  const total = minutes * 60;
  const [sec, setSec] = useState(total);
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (on && sec > 0) {
      ref.current = setInterval(() => setSec(s => {
        if (s <= 1) { clearInterval(ref.current); setOn(false); setDone(true); return 0; }
        return s - 1;
      }), 1000);
    } else clearInterval(ref.current);
    return () => clearInterval(ref.current);
  }, [on]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pct = (sec / total) * 100;

  return (
    <div style={{background:done?"rgba(74,222,128,.08)":"rgba(96,165,250,.06)",border:`1px solid ${done?C.green:"rgba(96,165,250,.2)"}`,borderRadius:10,padding:".55rem .8rem",marginTop:".4rem"}}>
      {done && <p style={{color:C.green,fontWeight:700,fontSize:".78rem",marginBottom:".25rem"}}>✅ C'est prêt !</p>}
      <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
        <span style={{fontSize:".76rem",color:C.muted,flex:1}}>⏱ {label}</span>
        <span style={{fontWeight:700,fontSize:".92rem",color:done?C.green:C.blue,fontVariantNumeric:"tabular-nums"}}>{fmt(sec)}</span>
        <button onClick={()=>setOn(o=>!o)} style={{background:on?"rgba(251,146,60,.12)":"rgba(74,222,128,.12)",color:on?C.orange:C.green,border:"none",borderRadius:8,padding:".22rem .55rem",cursor:"pointer",fontWeight:600,fontSize:".76rem"}}>{on?"⏸":"▶"}</button>
        <button onClick={()=>{setOn(false);setSec(total);setDone(false);}} style={{background:"transparent",border:"none",cursor:"pointer",color:C.muted,fontSize:".85rem"}}>↺</button>
      </div>
      <div style={{height:3,background:C.border,borderRadius:999,marginTop:".4rem",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:done?C.green:C.blue,borderRadius:999,transition:"width .8s"}}/>
      </div>
    </div>
  );
}

// ─── BADGE POPUP ─────────────────────────────────────────────
function BadgePopup({ badge, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:"fixed",bottom:72,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"linear-gradient(135deg,#0d2010,#1a2e1a)",border:`1px solid ${C.green}`,borderRadius:16,padding:"1.2rem 1.5rem",maxWidth:300,width:"88%",boxShadow:`0 0 40px rgba(74,222,128,.25)`,textAlign:"center",animation:"popUp .35s ease"}}>
      <div style={{fontSize:"2.4rem",marginBottom:".4rem"}}>{badge.emoji}</div>
      <div style={{color:C.green,fontWeight:700,fontSize:".88rem",marginBottom:".25rem"}}>🎉 Badge débloqué !</div>
      <div style={{fontWeight:700,fontSize:".95rem",marginBottom:".35rem"}}>{badge.name}</div>
      <div style={{color:C.muted,fontSize:".8rem"}}>{badge.msg}</div>
      <button onClick={onClose} style={{marginTop:".7rem",background:"rgba(74,222,128,.15)",color:C.green,border:`1px solid ${C.green}`,borderRadius:10,padding:".35rem .9rem",cursor:"pointer",fontSize:".78rem",fontWeight:600}}>Super !</button>
    </div>
  );
}

// ─── NUTRI BADGE ─────────────────────────────────────────────
function NutriBadge({ history, onGreen }) {
  const today = new Date().toDateString();
  const todayM = history.filter(h => new Date(h.date).toDateString() === today);
  const n = todayM.length;
  const fired = useRef(false);
  useEffect(() => { if (n >= 3 && !fired.current) { fired.current = true; onGreen(); } }, [n]);
  if (!n) return null;
  const [icon, label] = n >= 3 ? ["🏆","🟢 Bonne journée !"] : n >= 2 ? ["💪","🟠 Presque équilibré"] : ["🌱","🟡 Début de journée"];
  const cal = todayM.reduce((s,m) => s + (m.macros?.cal||0), 0);
  return (
    <div style={{background:"rgba(74,222,128,.07)",border:`1px solid rgba(74,222,128,.2)`,borderRadius:12,padding:".75rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <p style={{fontWeight:700,fontSize:".88rem"}}>{label}</p>
        <p style={{color:C.muted,fontSize:".73rem"}}>{n} repas · {cal} kcal</p>
      </div>
      <span style={{fontSize:"1.5rem"}}>{icon}</span>
    </div>
  );
}

// ─── MEAL MODAL ───────────────────────────────────────────────
function MealModal({ meal, onClose, onFav, isFav, onView, onExpressUsed }) {
  const [express, setExpress] = useState(null);
  const [loadEx, setLoadEx] = useState(false);
  const called = useRef(false);

  useEffect(() => { if (!called.current) { called.current = true; onView(meal); } }, []);

  const getExpress = async () => {
    setLoadEx(true);
    const r = await aiCall(
      `Version express <10min de: ${meal.name}. Simplifie. Mentionne le temps dans chaque étape si nécessaire.`,
      `Chef. JSON valide sans markdown. Format: {"name":"...","steps":["..."],"tip":"..."}`
    );
    setExpress(r); setLoadEx(false); onExpressUsed();
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:300,overflowY:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,width:"100%",maxWidth:460,border:`1px solid ${C.border}`,marginBottom:"3rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.1rem",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontWeight:700,fontSize:".92rem"}}>{meal.emoji||"🍽"} {meal.name}</span>
          <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
            <button onClick={()=>onFav(meal)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.25rem",color:isFav?"#fb923c":C.muted}}>{isFav?"♥":"♡"}</button>
            <button onClick={onClose} style={{background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:".3rem .65rem",cursor:"pointer",fontSize:".76rem"}}>✕</button>
          </div>
        </div>
        <div style={{padding:"1rem 1.1rem"}}>
          <p style={{color:C.muted,fontSize:".82rem",marginBottom:".6rem"}}>{meal.desc}</p>
          <div style={{display:"flex",gap:".35rem",flexWrap:"wrap",marginBottom:".5rem"}}>
            <Tag>⏱ {meal.time}</Tag>
            <Tag orange>{meal.difficulty}</Tag>
            {(meal.tags||[]).map(t=><Tag key={t}>{t}</Tag>)}
          </div>
          <MacroBar p={meal.macros?.p} g={meal.macros?.g} l={meal.macros?.l} cal={meal.macros?.cal}/>

          <div style={{marginTop:"1rem"}}>
            <p style={{fontWeight:600,fontSize:".85rem",marginBottom:".5rem"}}>🛒 Ingrédients</p>
            {(meal.ingredients||[]).map((ing,i)=>(
              <div key={i} style={{fontSize:".81rem",color:"#c9d1d9",padding:".22rem 0",borderBottom:`1px solid #21262d`}}>• {ing}</div>
            ))}
          </div>

          <div style={{marginTop:"1rem"}}>
            <p style={{fontWeight:600,fontSize:".85rem",marginBottom:".5rem"}}>👨‍🍳 Préparation</p>
            {(meal.steps||[]).map((step,i) => {
              const mins = extractMins(step);
              return (
                <div key={i} style={{marginBottom:".8rem"}}>
                  <div style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}>
                    <span style={{minWidth:22,height:22,background:"rgba(74,222,128,.15)",color:C.green,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".68rem",fontWeight:700,flexShrink:0}}>{i+1}</span>
                    <p style={{fontSize:".81rem",color:"#c9d1d9",lineHeight:1.65,flex:1}}>{step}</p>
                  </div>
                  {mins && <div style={{paddingLeft:28,marginTop:".2rem"}}><Chrono minutes={mins} label={`Étape ${i+1} · ${mins} min`}/></div>}
                </div>
              );
            })}
          </div>

          <div style={{marginTop:"1rem",borderTop:`1px solid ${C.border}`,paddingTop:"1rem"}}>
            {!express && !loadEx && (
              <button onClick={getExpress} style={{width:"100%",background:"rgba(251,146,60,.13)",color:C.orange,border:`1px solid rgba(251,146,60,.25)`,borderRadius:10,padding:".65rem",fontWeight:700,cursor:"pointer",fontSize:".88rem"}}>
                ⚡ Version express (&lt; 10 min)
              </button>
            )}
            {loadEx && <Spinner text="Adaptation express…"/>}
            {express && (
              <div style={{background:"rgba(251,146,60,.06)",border:`1px solid rgba(251,146,60,.2)`,borderRadius:10,padding:".9rem"}}>
                <p style={{fontWeight:700,fontSize:".88rem",color:C.orange,marginBottom:".5rem"}}>⚡ {express.name}</p>
                {(express.steps||[]).map((st,i) => {
                  const mins = extractMins(st);
                  return (
                    <div key={i} style={{marginBottom:".5rem"}}>
                      <p style={{fontSize:".8rem",color:"#c9d1d9"}}>• {st}</p>
                      {mins && <Chrono minutes={mins} label={`Express · ${mins} min`}/>}
                    </div>
                  );
                })}
                {express.tip && <p style={{fontSize:".77rem",color:C.orange,marginTop:".5rem",fontStyle:"italic"}}>💡 {express.tip}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SUGGEST ─────────────────────────────────────────────────
function SuggestScreen({ profile, favs, setFavs, history, setHistory, setSt, onBadge }) {
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState("Déjeuner");
  const [modal, setModal] = useState(false);

  const generate = async () => {
    setLoading(true); setMeal(null);
    const isVege = profile.diet.some(d => ["Végétarien","Vegan"].includes(d));
    const r = await aiCall(
      `Repas pour ${sel}. Profil: objectif ${profile.goals.join(", ")}, régime ${profile.diet.join(", ")}, éviter: ${profile.avoid.join(", ")||"rien"}, temps max ${profile.time}. Dans chaque étape mentionne le temps si applicable (ex: cuire 15 min).`,
      `Nutritionniste. JSON valide sans markdown. Format: {"name":"...","emoji":"...","desc":"...","time":"...","difficulty":"Facile|Moyen|Difficile","tags":["..."],"ingredients":["..."],"steps":["..."],"macros":{"p":0,"g":0,"l":0,"cal":0}}`
    );
    if (r) { setMeal(r); setSt(s=>({...s,meals:s.meals+1,vege:s.vege+(isVege?1:0),lastUsed:Date.now()})); onBadge(); }
    setLoading(false);
  };

  const toggleFav = m => { setFavs(f=>f.find(x=>x.name===m.name)?f.filter(x=>x.name!==m.name):[...f,{...m,savedAt:Date.now()}]); onBadge(); };
  const onView = m => { setHistory(h=>[{...m,date:Date.now(),type:sel},...h.filter(x=>x.name!==m.name)].slice(0,40)); onBadge(); };
  const onGreen = () => { setSt(s=>({...s,greens:s.greens+1})); onBadge(); };

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <NutriBadge history={history} onGreen={onGreen}/>
      <h2 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:".85rem"}}>Suggestion du jour</h2>
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        {MEALS.map(m=>(
          <button key={m} onClick={()=>setSel(m)} style={{padding:".38rem .7rem",borderRadius:8,border:"none",cursor:"pointer",fontSize:".77rem",fontWeight:600,background:sel===m?C.green:C.card,color:sel===m?"#0d1117":C.muted}}>
            {MEAL_ICON[m]} {m}
          </button>
        ))}
      </div>
      <button onClick={generate} style={{width:"100%",marginBottom:"1rem",background:C.green,color:"#0d1117",border:"none",borderRadius:10,padding:".65rem",fontWeight:700,cursor:"pointer",fontSize:".88rem"}}>
        {loading ? "Génération…" : "✨ Générer un repas"}
      </button>
      {loading && <Spinner text="L'IA prépare votre repas…"/>}
      {meal && (
        <>
          <div onClick={()=>setModal(true)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:".93rem",marginBottom:".25rem"}}>{meal.emoji} {meal.name}</p>
                <p style={{color:C.muted,fontSize:".81rem",marginBottom:".55rem"}}>{meal.desc}</p>
                <div style={{display:"flex",gap:".35rem",flexWrap:"wrap"}}><Tag>⏱ {meal.time}</Tag><Tag orange>{meal.difficulty}</Tag></div>
              </div>
              <button onClick={e=>{e.stopPropagation();toggleFav(meal);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.3rem",color:favs.find(x=>x.name===meal.name)?"#fb923c":C.muted}}>
                {favs.find(x=>x.name===meal.name)?"♥":"♡"}
              </button>
            </div>
            <MacroBar p={meal.macros?.p} g={meal.macros?.g} l={meal.macros?.l} cal={meal.macros?.cal}/>
            <p style={{color:C.muted,fontSize:".73rem",marginTop:".65rem",textAlign:"center"}}>Appuyez pour voir la recette →</p>
          </div>
          {modal && <MealModal meal={meal} onClose={()=>setModal(false)} onFav={toggleFav} isFav={!!favs.find(x=>x.name===meal.name)} onView={onView} onExpressUsed={()=>{setSt(s=>({...s,express:s.express+1}));onBadge();}}/>}
        </>
      )}
    </div>
  );
}

// ─── WEEK ─────────────────────────────────────────────────────
function WeekScreen({ profile, favs, setFavs, history, setHistory, setSt, onBadge }) {
  const [plan, setPlan] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState("Lundi");
  const [modal, setModal] = useState(null);
  const [loadMeal, setLoadMeal] = useState(null);

  const genWeek = async () => {
    setLoading(true); setPlan({});
    const r = await aiCall(
      `Plan repas 7 jours. Profil: ${profile.goals.join(", ")}, ${profile.diet.join(", ")}, éviter: ${profile.avoid.join(", ")||"rien"}, temps max ${profile.time}. Varié et équilibré.`,
      `Nutritionniste. JSON valide sans markdown. Format: {"Lundi":{"Petit-déjeuner":"nom","Déjeuner":"nom","Dîner":"nom"},...} pour les 7 jours.`
    );
    if (r) { setPlan(r); setSt(s=>({...s,plans:s.plans+1})); onBadge(); }
    setLoading(false);
  };

  const openMeal = async (name, type) => {
    setLoadMeal(name);
    const r = await aiCall(
      `Recette complète pour: ${name}. Profil: ${profile.diet.join(", ")}, temps max ${profile.time}. Dans chaque étape mentionne le temps si applicable.`,
      `Nutritionniste. JSON valide sans markdown. Format: {"name":"...","emoji":"...","desc":"...","time":"...","difficulty":"Facile|Moyen|Difficile","tags":["..."],"ingredients":["..."],"steps":["..."],"macros":{"p":0,"g":0,"l":0,"cal":0}}`
    );
    setLoadMeal(null);
    if (r) setModal({...r, mealType:type});
  };

  const toggleFav = m => { setFavs(f=>f.find(x=>x.name===m.name)?f.filter(x=>x.name!==m.name):[...f,{...m,savedAt:Date.now()}]); onBadge(); };
  const onView = m => { setHistory(h=>[{...m,date:Date.now()},...h.filter(x=>x.name!==m.name)].slice(0,40)); onBadge(); };
  const dp = plan[activeDay];

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <h2 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:".85rem"}}>Plan de la semaine</h2>
      <button onClick={genWeek} style={{width:"100%",marginBottom:"1rem",background:C.green,color:"#0d1117",border:"none",borderRadius:10,padding:".65rem",fontWeight:700,cursor:"pointer",fontSize:".88rem"}}>
        {loading ? "Génération…" : "🗓 Générer mon plan semaine"}
      </button>
      {loading && <Spinner text="L'IA prépare votre semaine…"/>}
      {Object.keys(plan).length > 0 && (
        <>
          <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:"1rem"}}>
            {DAYS.map(d=>(
              <button key={d} onClick={()=>setActiveDay(d)} style={{padding:".36rem .62rem",borderRadius:8,border:`1px solid ${activeDay===d?C.green:C.border}`,background:activeDay===d?"rgba(74,222,128,.1)":"transparent",color:activeDay===d?C.green:C.muted,cursor:"pointer",fontSize:".77rem",fontWeight:600}}>
                {d.slice(0,3)}
              </button>
            ))}
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
            <h3 style={{fontWeight:700,color:C.green,marginBottom:".9rem"}}>{activeDay}</h3>
            {MEALS.map(m=>(
              <div key={m} style={{display:"flex",gap:".65rem",alignItems:"center",marginBottom:".65rem",paddingBottom:".65rem",borderBottom:`1px solid #21262d`}}>
                <span style={{fontSize:"1.1rem"}}>{MEAL_ICON[m]}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:".71rem",color:C.muted}}>{m}</p>
                  <p style={{fontSize:".87rem",fontWeight:500}}>{dp?.[m]||"—"}</p>
                </div>
                {dp?.[m] && (loadMeal===dp[m]
                  ? <span style={{color:C.muted,fontSize:".72rem"}}>…</span>
                  : <button onClick={()=>openMeal(dp[m],m)} style={{background:"rgba(74,222,128,.12)",color:C.green,border:`1px solid rgba(74,222,128,.25)`,borderRadius:8,padding:".28rem .6rem",cursor:"pointer",fontWeight:600,fontSize:".76rem"}}>Voir →</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {modal && <MealModal meal={modal} onClose={()=>setModal(null)} onFav={toggleFav} isFav={!!favs.find(x=>x.name===modal.name)} onView={onView} onExpressUsed={()=>{setSt(s=>({...s,express:s.express+1}));onBadge();}}/>}
    </div>
  );
}

// ─── SNACK ────────────────────────────────────────────────────
function SnackScreen({ profile, setSt, onBadge }) {
  const [snacks, setSnacks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hunger, setHunger] = useState("légère");

  const generate = async () => {
    setLoading(true); setSnacks(null);
    const r = await aiCall(
      `4 snacks sains pour faim ${hunger}. Profil: ${profile.goals.join(", ")}, ${profile.diet.join(", ")}, éviter: ${profile.avoid.join(", ")||"rien"}.`,
      `Nutritionniste. JSON valide sans markdown. Format: [{"name":"...","emoji":"...","desc":"...","calories":0,"prep":"...","tags":["..."]}]`
    );
    if (r) { setSnacks(r); setSt(s=>({...s,snacks:s.snacks+1})); onBadge(); }
    setLoading(false);
  };

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <h2 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:".4rem"}}>🍎 Snacking malin</h2>
      <p style={{color:C.muted,fontSize:".82rem",marginBottom:"1rem"}}>Quand la petite faim arrive…</p>
      <div style={{display:"flex",gap:".35rem",flexWrap:"wrap",marginBottom:"1rem"}}>
        {["légère","modérée","envie sucrée","envie salée","post-sport"].map(h=>(
          <button key={h} onClick={()=>setHunger(h)} style={{padding:".33rem .65rem",borderRadius:8,border:`1px solid ${hunger===h?C.green:C.border}`,background:hunger===h?"rgba(74,222,128,.1)":"transparent",color:hunger===h?C.green:C.muted,cursor:"pointer",fontSize:".76rem"}}>
            {h}
          </button>
        ))}
      </div>
      <button onClick={generate} style={{width:"100%",marginBottom:"1rem",background:C.green,color:"#0d1117",border:"none",borderRadius:10,padding:".65rem",fontWeight:700,cursor:"pointer",fontSize:".88rem"}}>
        {loading ? "Génération…" : "✨ Trouver des snacks"}
      </button>
      {loading && <Spinner text="L'IA cherche des idées…"/>}
      {snacks && snacks.map((sk,i)=>(
        <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem",display:"flex",gap:".8rem",alignItems:"flex-start"}}>
          <span style={{fontSize:"1.8rem"}}>{sk.emoji}</span>
          <div style={{flex:1}}>
            <p style={{fontWeight:700,fontSize:".88rem",marginBottom:".2rem"}}>{sk.name}</p>
            <p style={{color:C.muted,fontSize:".79rem",marginBottom:".5rem"}}>{sk.desc}</p>
            <div style={{display:"flex",gap:".3rem",flexWrap:"wrap"}}>
              <Tag orange>🔥 {sk.calories} kcal</Tag>
              <Tag>⏱ {sk.prep}</Tag>
              {(sk.tags||[]).map(t=><Tag key={t}>{t}</Tag>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FAVS ─────────────────────────────────────────────────────
function FavsScreen({ favs, setFavs, history, setHistory, onBadge }) {
  const [modal, setModal] = useState(null);
  const toggleFav = m => { setFavs(f=>f.find(x=>x.name===m.name)?f.filter(x=>x.name!==m.name):[...f,m]); onBadge(); };
  const onView = m => { setHistory(h=>[{...m,date:Date.now()},...h.filter(x=>x.name!==m.name)].slice(0,40)); onBadge(); };

  if (!favs.length) return (
    <div style={{padding:"3rem 1.2rem",textAlign:"center"}}>
      <p style={{fontSize:"2rem",marginBottom:".7rem"}}>♡</p>
      <p style={{fontWeight:600,marginBottom:".35rem"}}>Aucun favori</p>
      <p style={{color:C.muted,fontSize:".82rem"}}>Sauvegardez des plats depuis les suggestions.</p>
    </div>
  );

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <h2 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:".85rem"}}>♥ Mes favoris ({favs.length})</h2>
      {favs.map((m,i)=>(
        <div key={i} onClick={()=>setModal(m)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:".9rem",marginBottom:".22rem"}}>{m.emoji} {m.name}</p>
              <p style={{color:C.muted,fontSize:".79rem",marginBottom:".5rem"}}>{m.desc}</p>
              <div style={{display:"flex",gap:".3rem"}}><Tag>⏱ {m.time}</Tag><Tag orange>{m.difficulty}</Tag></div>
            </div>
            <button onClick={e=>{e.stopPropagation();toggleFav(m);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.2rem",color:"#fb923c"}}>♥</button>
          </div>
          <MacroBar p={m.macros?.p} g={m.macros?.g} l={m.macros?.l} cal={m.macros?.cal}/>
        </div>
      ))}
      {modal && <MealModal meal={modal} onClose={()=>setModal(null)} onFav={toggleFav} isFav={true} onView={onView} onExpressUsed={()=>{}}/>}
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────
function HistoryScreen({ history, setHistory, favs, setFavs, onBadge }) {
  const [modal, setModal] = useState(null);
  const toggleFav = m => { setFavs(f=>f.find(x=>x.name===m.name)?f.filter(x=>x.name!==m.name):[...f,m]); onBadge(); };

  if (!history.length) return (
    <div style={{padding:"3rem 1.2rem",textAlign:"center"}}>
      <p style={{fontSize:"2rem",marginBottom:".7rem"}}>📋</p>
      <p style={{fontWeight:600,marginBottom:".35rem"}}>Historique vide</p>
      <p style={{color:C.muted,fontSize:".82rem"}}>Vos recettes consultées apparaîtront ici.</p>
    </div>
  );

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".85rem"}}>
        <h2 style={{fontSize:"1.05rem",fontWeight:700,margin:0}}>📋 Historique</h2>
        <button onClick={()=>setHistory([])} style={{background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:".3rem .65rem",cursor:"pointer",fontSize:".74rem"}}>Effacer tout</button>
      </div>
      {history.map((m,i)=>(
        <div key={i} onClick={()=>setModal(m)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1rem",marginBottom:"1rem",cursor:"pointer",display:"flex",gap:".75rem",alignItems:"center"}}>
          <span style={{fontSize:"1.45rem"}}>{m.emoji||"🍽"}</span>
          <div style={{flex:1}}>
            <p style={{fontWeight:600,fontSize:".87rem"}}>{m.name}</p>
            <p style={{color:C.muted,fontSize:".73rem"}}>{fmtDate(m.date)}{m.type?` · ${m.type}`:""}</p>
          </div>
          <button onClick={e=>{e.stopPropagation();toggleFav(m);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.1rem",color:favs.find(x=>x.name===m.name)?"#fb923c":C.muted}}>
            {favs.find(x=>x.name===m.name)?"♥":"♡"}
          </button>
        </div>
      ))}
      {modal && <MealModal meal={modal} onClose={()=>setModal(null)} onFav={toggleFav} isFav={!!favs.find(x=>x.name===modal.name)} onView={()=>{}} onExpressUsed={()=>{}}/>}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────
function ProfileScreen({ profile, setProfile, st, unlocked, onSave }) {
  const [loc, setLoc] = useState({...profile});
  const toggle = (f, v) => setLoc(l => ({...l, [f]: l[f].includes(v) ? l[f].filter(x=>x!==v) : [...l[f],v]}));

  const Chips = ({ field, opts }) => (
    <div style={{display:"flex",flexWrap:"wrap",gap:".38rem",marginBottom:".85rem"}}>
      {opts.map(o => {
        const a = loc[field].includes(o);
        return (
          <button key={o} onClick={()=>toggle(field,o)} style={{padding:".27rem .62rem",borderRadius:7,border:`1px solid ${a?C.green:C.border}`,background:a?"rgba(74,222,128,.12)":"transparent",color:a?C.green:C.muted,cursor:"pointer",fontSize:".77rem",fontWeight:500}}>
            {o}
          </button>
        );
      })}
    </div>
  );

  const lv = getLevel(unlocked.length);
  const nxt = LEVELS.find(l => l.min > unlocked.length);
  const pct = nxt ? Math.min(100,(unlocked.length/nxt.min)*100) : 100;

  return (
    <div style={{padding:"1rem 1.2rem"}}>
      <h2 style={{fontSize:"1.05rem",fontWeight:700,marginBottom:".85rem"}}>👤 Mon profil</h2>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".6rem"}}>
          <div>
            <p style={{fontWeight:700,color:lv.color,fontSize:".92rem"}}>{lv.name}</p>
            <p style={{color:C.muted,fontSize:".73rem"}}>{unlocked.length}/{BADGES.length} badges débloqués</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{color:C.muted,fontSize:".72rem"}}>🍽 {st.meals} repas générés</p>
            <p style={{color:C.muted,fontSize:".72rem"}}>🔥 Streak : {st.streak} jour{st.streak!==1?"s":""}</p>
          </div>
        </div>
        <div style={{height:4,background:C.border,borderRadius:999,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:lv.color,borderRadius:999,transition:"width .6s"}}/>
        </div>
        {nxt && <p style={{color:C.muted,fontSize:".7rem",marginTop:".35rem"}}>Encore {nxt.min-unlocked.length} badge(s) pour {nxt.name}</p>}
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
        <p style={{fontWeight:600,fontSize:".87rem",marginBottom:".75rem"}}>🏅 Mes badges</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:".45rem"}}>
          {BADGES.map(b => {
            const ok = unlocked.includes(b.id);
            return (
              <div key={b.id} title={`${b.name} — ${b.desc}`} style={{textAlign:"center",padding:".5rem .25rem",borderRadius:10,background:ok?"rgba(74,222,128,.08)":"rgba(255,255,255,.02)",border:`1px solid ${ok?C.green:C.border}`,opacity:ok?1:.38,transition:"opacity .3s"}}>
                <div style={{fontSize:"1.35rem"}}>{b.emoji}</div>
                <div style={{fontSize:".58rem",color:ok?C.text:C.muted,fontWeight:ok?600:400,marginTop:".2rem",lineHeight:1.25}}>{b.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
        <label style={{color:C.muted,fontSize:".8rem",display:"block",marginBottom:".38rem"}}>Prénom</label>
        <input value={loc.name} onChange={e=>setLoc({...loc,name:e.target.value})} placeholder="Ex : Sophie"
          style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:".55rem .85rem",color:C.text,fontSize:".88rem",width:"100%",outline:"none",marginBottom:".85rem"}}/>
        <label style={{color:C.muted,fontSize:".8rem",display:"block",marginBottom:".38rem"}}>Objectif</label>
        <Chips field="goals" opts={["Énergie","Minceur","Muscle","Santé","Équilibre"]}/>
        <label style={{color:C.muted,fontSize:".8rem",display:"block",marginBottom:".38rem"}}>Régime</label>
        <Chips field="diet" opts={["Omnivore","Végétarien","Vegan","Sans gluten","Sans lactose","Keto"]}/>
        <label style={{color:C.muted,fontSize:".8rem",display:"block",marginBottom:".38rem"}}>Allergies</label>
        <Chips field="avoid" opts={["Noix","Fruits de mer","Œufs","Soja","Arachides"]}/>
        <label style={{color:C.muted,fontSize:".8rem",display:"block",marginBottom:".38rem"}}>Temps max</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:".38rem"}}>
          {["15 min","30 min","45 min","1h+"].map(t=>(
            <button key={t} onClick={()=>setLoc({...loc,time:t})} style={{padding:".27rem .62rem",borderRadius:7,border:`1px solid ${loc.time===t?C.green:C.border}`,background:loc.time===t?"rgba(74,222,128,.12)":"transparent",color:loc.time===t?C.green:C.muted,cursor:"pointer",fontSize:".77rem"}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <button onClick={()=>{setProfile(loc);onSave();}} style={{width:"100%",background:C.green,color:"#0d1117",border:"none",borderRadius:10,padding:".65rem",fontWeight:700,cursor:"pointer",fontSize:".88rem"}}>
        Enregistrer ✓
      </button>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
const TABS = [
  {id:"suggest", icon:"✨", label:"Repas"},
  {id:"week",    icon:"🗓", label:"Semaine"},
  {id:"snack",   icon:"🍎", label:"Snacks"},
  {id:"favs",    icon:"♥",  label:"Favoris"},
  {id:"history", icon:"📋", label:"Historique"},
  {id:"profile", icon:"👤", label:"Profil"},
];

export default function App() {
  const [tab, setTab]         = useState("suggest");
  const [profile, setProfile] = useState({name:"",goals:["Équilibre"],diet:["Omnivore"],avoid:[],time:"30 min"});
  const [favs, setFavs]       = useState([]);
  const [history, setHistory] = useState([]);
  const [st, setSt]           = useState({meals:0,vege:0,express:0,plans:0,snacks:0,greens:0,streak:1,lastUsed:Date.now()});
  const [unlocked, setUnlocked] = useState([]);
  const [popup, setPopup]     = useState(null);

  const checkBadges = useCallback(() => {
    BADGES.forEach(b => {
      setUnlocked(u => {
        if (u.includes(b.id)) return u;
        if (b.check({st, favs, hist:history, unlocked:u})) {
          setTimeout(() => setPopup(b), 100);
          return [...u, b.id];
        }
        return u;
      });
    });
  }, [st, favs, history]);

  useEffect(() => { checkBadges(); }, [st, favs, history]);

  const shared = { profile, favs, setFavs, history, setHistory, setSt, onBadge:checkBadges };

  return (
    <div style={{fontFamily:"Inter,system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text,maxWidth:480,margin:"0 auto"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes popUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}} *{box-sizing:border-box}`}</style>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".85rem 1.2rem",borderBottom:`1px solid ${C.border}`,background:C.card,position:"sticky",top:0,zIndex:100}}>
        <div style={{fontWeight:800,fontSize:"1.1rem",color:C.green}}>🥗 MealEase</div>
        <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>
          {st.streak > 0 && <span style={{color:C.muted,fontSize:".74rem"}}>🔥 {st.streak}</span>}
          {profile.name && <span style={{color:C.muted,fontSize:".77rem"}}>👋 {profile.name}</span>}
        </div>
      </div>

      <div style={{overflowX:"auto",display:"flex",gap:".28rem",padding:".5rem 1rem",borderBottom:`1px solid ${C.border}`,background:C.card}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,padding:".36rem .72rem",borderRadius:8,border:"none",cursor:"pointer",fontSize:".77rem",fontWeight:600,whiteSpace:"nowrap",background:tab===t.id?C.green:"transparent",color:tab===t.id?"#0d1117":C.muted}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{paddingBottom:24}}>
        {tab==="suggest" && <SuggestScreen {...shared}/>}
        {tab==="week"    && <WeekScreen    {...shared}/>}
        {tab==="snack"   && <SnackScreen   profile={profile} setSt={setSt} onBadge={checkBadges}/>}
        {tab==="favs"    && <FavsScreen    favs={favs} setFavs={setFavs} history={history} setHistory={setHistory} onBadge={checkBadges}/>}
        {tab==="history" && <HistoryScreen history={history} setHistory={setHistory} favs={favs} setFavs={setFavs} onBadge={checkBadges}/>}
        {tab==="profile" && <ProfileScreen profile={profile} setProfile={setProfile} st={st} unlocked={unlocked} onSave={()=>setTab("suggest")}/>}
      </div>

      {popup && <BadgePopup badge={popup} onClose={()=>setPopup(null)}/>}
    </div>
  );
}