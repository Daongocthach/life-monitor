"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "profiles","finance_transactions","finance_categories","finance_budgets","finance_goals",
  "exercise_muscle_groups","exercises","workout_routines","workout_routine_exercises","workout_sessions","workout_sets","body_metrics",
  "daily_health","daily_meals","daily_nutrition","meals","tasks","task_completions",
  "english_lessons","english_words","english_lesson_words","english_study_logs",
] as const;

type Row = Record<string, unknown>;

const LABELS: Record<string, string> = {
  profiles:"Hồ sơ", finance_transactions:"Giao dịch", finance_categories:"Danh mục tài chính", finance_budgets:"Ngân sách", finance_goals:"Mục tiêu tài chính",
  exercise_muscle_groups:"Nhóm cơ", exercises:"Bài tập", workout_routines:"Lịch tập", workout_routine_exercises:"Bài tập trong lịch", workout_sessions:"Buổi tập", workout_sets:"Set tập", body_metrics:"Chỉ số cơ thể",
  daily_health:"Sức khỏe hằng ngày", daily_meals:"Bữa ăn hằng ngày", daily_nutrition:"Dinh dưỡng hằng ngày", meals:"Món ăn", tasks:"Công việc", task_completions:"Hoàn thành công việc",
  english_lessons:"Bài học tiếng Anh", english_words:"Từ vựng", english_lesson_words:"Từ trong bài học", english_study_logs:"Lịch sử học tiếng Anh",
};

function title(name:string){return LABELS[name] ?? name.replaceAll("_"," ")}
function fmt(value: unknown){
  if(value === null || value === undefined || value === "") return "—";
  if(typeof value === "object") return JSON.stringify(value);
  if(typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  return String(value);
}
function money(value: unknown){return typeof value === "number" ? new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(value) : fmt(value)}

export function DbExplorer(){
  const [tables,setTables]=useState<Record<string,Row[]>>({});
  const [active,setActive]=useState<string>("overview");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [userEmail,setUserEmail]=useState("");

  async function load(){
    setLoading(true); setError(null);
    const supabase=createClient();
    if(!supabase){setError("Thiếu cấu hình Supabase.");setLoading(false);return}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.href="/login";return}
    setUserEmail(user.email ?? "");
    const entries=await Promise.all(TABLES.map(async table=>{
      const {data,error}=await supabase.from(table).select("*").limit(200);
      return [table, data ?? [], error?.message] as const;
    }));
    const failed=entries.filter(([, , e])=>e).map(([t,,e])=>`${t}: ${e}`).join(" | ");
    if(failed) setError(failed);
    setTables(Object.fromEntries(entries.map(([t,d])=>[t,d])));
    setLoading(false);
  }

  useEffect(()=>{void load()},[]);

  const totals=useMemo(()=>({
    transactions:tables.finance_transactions?.length??0,
    exercises:tables.exercises?.length??0,
    routines:tables.workout_routines?.length??0,
    tasks:tables.tasks?.length??0,
    goals:tables.finance_goals?.length??0,
    words:tables.english_words?.length??0,
  }),[tables]);

  const filtered=useMemo(()=>{
    const rows=tables[active]??[];
    if(!search.trim()) return rows;
    const q=search.toLowerCase();
    return rows.filter(r=>Object.values(r).some(v=>fmt(v).toLowerCase().includes(q)));
  },[tables,active,search]);

  const recentTransactions=(tables.finance_transactions??[]).slice().sort((a,b)=>String(b.occurred_at??"").localeCompare(String(a.occurred_at??""))).slice(0,8);
  const totalExpense=(tables.finance_transactions??[]).filter(r=>String(r.type).toLowerCase()==="expense").reduce((s,r)=>s+Number(r.amount??0),0);
  const totalIncome=(tables.finance_transactions??[]).filter(r=>String(r.type).toLowerCase()==="income").reduce((s,r)=>s+Number(r.amount??0),0);

  return <div className="db-app">
    <aside className="db-sidebar">
      <div className="db-brand"><div className="db-logo">LO</div><div><strong>LifeOS</strong><span>Data Center</span></div></div>
      <button className={active==="overview"?"db-nav active":"db-nav"} onClick={()=>setActive("overview")}>⌂ <span>Tổng quan</span></button>
      <div className="db-section">DỮ LIỆU</div>
      {TABLES.map(t=><button key={t} className={active===t?"db-nav active":"db-nav"} onClick={()=>{setActive(t);setSearch("")}}><span className="db-dot"/><span>{title(t)}</span><b>{tables[t]?.length??0}</b></button>)}
      <div className="db-side-bottom"><span className="db-online"/> Supabase online<button onClick={async()=>{await createClient()?.auth.signOut();window.location.href="/login"}}>Đăng xuất</button></div>
    </aside>

    <main className="db-main">
      <header className="db-header"><div><div className="db-eyebrow">PERSONAL DATA SYSTEM</div><h1>{active==="overview"?"Tổng quan LifeOS":title(active)}</h1><p>{userEmail || "Dữ liệu cá nhân"}</p></div><div className="db-head-actions"><span className="db-status"><i/> LIVE</span><button onClick={()=>void load()}>↻ Làm mới</button></div></header>
      {error&&<div className="db-alert">⚠ Một số bảng không đọc được: {error}</div>}
      {loading?<div className="db-loading"><span/>Đang tải dữ liệu từ Supabase…</div>:active==="overview"?<>
        <section className="db-kpis">
          <article><span>GIAO DỊCH</span><strong>{totals.transactions}</strong><small>{money(totalExpense)} chi tiêu</small></article>
          <article><span>BÀI TẬP</span><strong>{totals.exercises}</strong><small>{totals.routines} lịch tập</small></article>
          <article><span>CÔNG VIỆC</span><strong>{totals.tasks}</strong><small>Task đã lưu</small></article>
          <article><span>MỤC TIÊU</span><strong>{totals.goals}</strong><small>Finance goals</small></article>
          <article><span>TỪ VỰNG</span><strong>{totals.words}</strong><small>English words</small></article>
        </section>
        <section className="db-grid-two">
          <div className="db-card"><div className="db-card-head"><div><span>FINANCE</span><h2>Dòng tiền</h2></div><button onClick={()=>setActive("finance_transactions")}>Xem tất cả →</button></div><div className="db-money"><div><small>CHI</small><strong>{money(totalExpense)}</strong></div><div><small>THU</small><strong>{money(totalIncome)}</strong></div></div><div className="db-table mini">{recentTransactions.map((r,i)=><div className="db-row" key={String(r.id??i)}><span>{fmt(r.merchant??r.description)}</span><strong className={String(r.type).toLowerCase()==="expense"?"negative":"positive"}>{money(r.amount)}</strong></div>)}</div></div>
          <div className="db-card"><div className="db-card-head"><div><span>SYSTEM</span><h2>Các bảng dữ liệu</h2></div></div><div className="db-table mini">{TABLES.map(t=><button className="db-row db-row-button" key={t} onClick={()=>setActive(t)}><span>{title(t)}</span><strong>{tables[t]?.length??0}</strong></button>)}</div></div>
        </section>
      </>:<section className="db-card db-full"><div className="db-card-head"><div><span>{filtered.length} / {tables[active]?.length??0} BẢN GHI</span><h2>{title(active)}</h2></div><div className="db-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm trong bảng…"/><button onClick={()=>setSearch("")}>Xóa</button></div></div><DataTable rows={filtered}/></section>}
    </main>
  </div>
}

function DataTable({rows}:{rows:Row[]}){
  if(!rows.length) return <div className="db-empty">Chưa có bản ghi phù hợp.</div>;
  const columns=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  return <div className="db-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id??i)}>{columns.map(c=><td key={c} title={fmt(r[c])}>{c.includes("amount")?money(r[c]):fmt(r[c])}</td>)}</tr>)}</tbody></table></div>
}
