// Part 3: Components
import { useState, useMemo, useCallback } from "react";
import { xlD, fmtDate, fmtMoney, SEED } from "./part1.js";
import { T, font, USERS } from "./part2.js";

function Badge({status}){
  const p=status==="VACANT";
  const cfg={PAID:{bg:T.greenDim,c:T.green,l:"Paid"},PARTIAL:{bg:T.amberDim,c:T.amber,l:"Partial"},OVERDUE:{bg:T.redDim,c:T.red,l:"Overdue"},VACANT:{bg:"#6B728022",c:T.muted,l:"Vacant"}}[status]||{bg:"#22283620",c:T.muted,l:status};
  const pulse=status==="OVERDUE";
  return(<span style={{background:cfg.bg,color:cfg.c,padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",animation:pulse?"pulse 2s infinite":"none"}}>{cfg.l}</span>);
}
function Stat({label,value,sub,accent}){return(<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 22px",position:"relative",overflow:"hidden"}}><div style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{label}</div><div style={{fontSize:24,fontWeight:800,color:accent||T.text,fontFamily:"'IBM Plex Mono',monospace"}}>{value}</div>{sub&&<div style={{fontSize:11,color:T.subtle,marginTop:4}}>{sub}</div>}<div style={{position:"absolute",bottom:0,right:0,width:60,height:60,borderRadius:"50%",background:accent?accent+"11":"#ffffff06",transform:"translate(20px,20px)"}}/></div>);}
function Bar({pct,color}){return(<div style={{background:T.border,borderRadius:99,height:5,overflow:"hidden"}}><div style={{width:`${Math.min(pct,100)}%`,background:color||T.gold,height:"100%",borderRadius:99,transition:"width .6s ease"}}/></div>);}
