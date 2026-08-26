"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "today" | "plan" | "finance" | "health" | "goals";
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_at: string | null;
  completed_at?: string | null;
};
type Transaction = {
  id: string;
  merchant: string | null;
  description: string | null;
  amount: number;
  type: string;
  occurred_at: string;
  category?: string;
};
type Goal = {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  target_date: string | null;
  domain: string;
};
type Health = {
  steps: number;
  distance_meters: number;
  active_minutes: number;
  resting_heart_rate: number;
  sleep_minutes: number;
};

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Hôm nay", icon: "⌂" },
  { id: "plan", label: "Kế hoạch", icon: "✓" },
  { id: "finance", label: "Tài chính", icon: "₫" },
  { id: "health", label: "Sức khỏe", icon: "♡" },
  { id: "goals", label: "Mục tiêu", icon: "◎" },
];

const sampleTasks: Task[] = [];

const sampleTransactions: Transaction[] = [];

const sampleGoals: Goal[] = [];

const sampleHealth: Health = {
  steps: 0,
  distance_meters: 0,
  active_minutes: 0,
  resting_heart_rate: 0,
  sleep_minutes: 0,
};

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function Icon({ children }: { children: ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

function Ring({ value, max, label, tone = "orange" }: { value: number; max: number; label: string; tone?: "orange" | "green" | "blue" }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={`ring ring-${tone}`} style={{ "--ring-value": `${percent * 3.6}deg` } as React.CSSProperties}>
      <div className="ring-inner"><strong>{percent}%</strong><span>{label}</span></div>
    </div>
  );
}

function Progress({ value, max, tone = "orange" }: { value: number; max: number; tone?: string }) {
  return <div className="progress"><span className={`progress-${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}

function StatCard({ eyebrow, value, note, icon, tone }: { eyebrow: string; value: string; note: string; icon: string; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div><span className="eyebrow">{eyebrow}</span><strong className="stat-value">{value}</strong><small>{note}</small></div>
    </article>
  );
}

function formatTime(value: string | null) {
  if (!value) return "Chưa đặt giờ";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function LifeDashboard({ mode }: { mode: "demo" | "live" }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[]>(sampleTasks);
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [goals, setGoals] = useState<Goal[]>(sampleGoals);
  const [health, setHealth] = useState<Health>(sampleHealth);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(mode === "live");
  const [quickAdd, setQuickAdd] = useState<"task" | "transaction" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "live") return;
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    async function load() {
      const { data: userData } = await supabase!.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const [taskResult, transactionResult, goalResult, healthResult, reviewResult] = await Promise.all([
        supabase!.from("tasks").select("id,title,status,priority,scheduled_at,completed_at").order("scheduled_at", { ascending: true }).limit(12),
        supabase!.from("transactions").select("id,merchant,description,amount,type,occurred_at").order("occurred_at", { ascending: false }).limit(12),
        supabase!.from("goals").select("id,title,current_value,target_value,unit,target_date,domain").eq("status", "active").limit(8),
        supabase!.from("daily_health_metrics").select("steps,distance_meters,active_minutes,resting_heart_rate,sleep_minutes").order("metric_date", { ascending: false }).limit(1).maybeSingle(),
        supabase!.from("review_items").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      if (taskResult.data) setTasks(taskResult.data.map((row) => ({ ...row, priority: row.priority ?? "medium" })));
      if (transactionResult.data) setTransactions(transactionResult.data.map((row) => ({ ...row, amount: Number(row.amount) })));
      if (goalResult.data) setGoals(goalResult.data.map((row) => ({ ...row, current_value: Number(row.current_value), target_value: Number(row.target_value) })));
      if (healthResult.data) setHealth({
        steps: healthResult.data.steps ?? 0,
        distance_meters: Number(healthResult.data.distance_meters ?? 0),
        active_minutes: healthResult.data.active_minutes ?? 0,
        resting_heart_rate: healthResult.data.resting_heart_rate ?? 0,
        sleep_minutes: healthResult.data.sleep_minutes ?? 0,
      });
      setReviewCount(reviewResult.count ?? 0);
      setLoading(false);
    }

    void load();
  }, [mode]);

  const expenseToday = useMemo(() => transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0), [transactions]);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const isDemo = mode === "demo" || !userId;

  async function toggleTask(task: Task) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    if (!isDemo) {
      const supabase = createClient();
      await supabase?.from("tasks").update({ status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null }).eq("id", task.id);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LM</span><div><strong>Life Monitor</strong><small>Personal data system</small></div></div>
        <nav className="side-nav" aria-label="Điều hướng chính">
          <span className="nav-section">TỔNG QUAN</span>
          {navItems.map((item) => (
            <button key={item.id} className={activeTab === item.id ? "nav-item active" : "nav-item"} onClick={() => setActiveTab(item.id)}>
              <Icon>{item.icon}</Icon>{item.label}
            </button>
          ))}
          <span className="nav-section nav-spaced">HỆ THỐNG</span>
          <button className="nav-item"><Icon>↻</Icon>Nguồn dữ liệu<span className="status-dot" /></button>
          <button className="nav-item"><Icon>⚙</Icon>Cài đặt</button>
        </nav>
        <div className="sync-card"><div><span className="live-dot" />Nguồn dữ liệu</div><strong>Chưa có nguồn kết nối</strong><small>Kết nối thiết bị hoặc dịch vụ để bắt đầu</small></div>
        <div className="sidebar-profile">
          <span className="avatar">{userEmail ? userEmail[0].toUpperCase() : "C"}</span>
          <div><strong>{userEmail ?? "Chế độ xem thử"}</strong><small>{isDemo ? "Chưa có dữ liệu" : "Dữ liệu cá nhân"}</small></div>
          {userId && <button onClick={signOut} title="Đăng xuất">↗</button>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="date-label">{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</p><h1>{activeTab === "today" ? "Chào buổi sáng" : navItems.find((item) => item.id === activeTab)?.label}</h1></div>
          <div className="top-actions">
            {isDemo && <span className="demo-badge">CHƯA CÓ DỮ LIỆU</span>}
            <button className="review-button" onClick={() => flash(`${reviewCount} mục đang chờ bạn xác nhận`)}>◉<span>{reviewCount}</span></button>
            {userId ? <button className="secondary-button" onClick={() => setQuickAdd("task")}>+ Thêm nhanh</button> : <Link className="primary-button" href="/login">Kết nối dữ liệu</Link>}
          </div>
        </header>

        {loading && <div className="loading-line"><span /></div>}
        {notice && <div className="toast">{notice}</div>}

        {activeTab === "today" && <TodayView health={health} tasks={tasks} expense={expenseToday} goals={goals} completedTasks={completedTasks} onToggle={toggleTask} onAdd={setQuickAdd} />}
        {activeTab === "plan" && <PlanView tasks={tasks} onToggle={toggleTask} onAdd={() => setQuickAdd("task")} />}
        {activeTab === "finance" && <FinanceView transactions={transactions} expense={expenseToday} onAdd={() => setQuickAdd("transaction")} />}
        {activeTab === "health" && <HealthView health={health} />}
        {activeTab === "goals" && <GoalsView goals={goals} />}
      </main>

      <nav className="mobile-nav">
        {navItems.map((item) => <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => setActiveTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}
      </nav>

      {quickAdd && <QuickAdd type={quickAdd} userId={userId} isDemo={isDemo} onClose={() => setQuickAdd(null)} onTask={(task) => { setTasks((items) => [task, ...items]); flash("Đã thêm công việc"); }} onTransaction={(transaction) => { setTransactions((items) => [transaction, ...items]); flash("Đã thêm giao dịch"); }} />}
    </div>
  );
}

function TodayView({ health, tasks, expense, goals, completedTasks, onToggle, onAdd }: { health: Health; tasks: Task[]; expense: number; goals: Goal[]; completedTasks: number; onToggle: (task: Task) => void; onAdd: (type: "task" | "transaction") => void }) {
  const hasHealth = health.steps > 0 || health.sleep_minutes > 0 || health.resting_heart_rate > 0 || health.active_minutes > 0;
  const hasData = hasHealth || tasks.length > 0 || goals.length > 0 || expense > 0;
  return (
    <div className="page-grid">
      <section className="hero-summary">
        <div className="hero-copy"><span className="section-kicker">TỔNG QUAN HÔM NAY</span><h2>{hasData ? "Dữ liệu hôm nay của bạn." : "Bắt đầu ghi nhận ngày hôm nay."}</h2><p>{hasData ? "Các chỉ số bên dưới được tổng hợp từ dữ liệu cá nhân đã lưu." : "Thêm công việc, giao dịch hoặc kết nối nguồn sức khỏe để xem tổng quan."}</p><div className="hero-actions"><button className="primary-button" onClick={() => onAdd("task")}>+ Thêm công việc</button></div></div>
        <Ring value={0} max={100} label="Chưa tính" />
      </section>

      <section className="stat-grid">
        <StatCard eyebrow="GIẤC NGỦ" value={health.sleep_minutes ? `${Math.floor(health.sleep_minutes / 60)}h ${health.sleep_minutes % 60}p` : "—"} note={health.sleep_minutes ? "Dữ liệu gần nhất" : "Chưa có dữ liệu"} icon="☾" tone="purple" />
        <StatCard eyebrow="BƯỚC CHÂN" value={health.steps ? health.steps.toLocaleString("vi-VN") : "—"} note={health.distance_meters ? `${(health.distance_meters / 1000).toFixed(1)} km` : "Chưa có dữ liệu"} icon="↗" tone="green" />
        <StatCard eyebrow="NHỊP TIM NGHỈ" value={health.resting_heart_rate ? `${health.resting_heart_rate} bpm` : "—"} note={health.resting_heart_rate ? "Dữ liệu gần nhất" : "Chưa có dữ liệu"} icon="♥" tone="red" />
        <StatCard eyebrow="CHI TIÊU" value={expense ? money.format(expense) : "—"} note={expense ? "Tổng giao dịch đã ghi nhận" : "Chưa có dữ liệu"} icon="₫" tone="orange" />
      </section>

      <section className="content-card tasks-card">
        <div className="card-heading"><div><span className="section-kicker">KẾ HOẠCH</span><h3>Việc cần làm</h3></div><span className="heading-meta">{completedTasks}/{tasks.length} hoàn thành</span></div>
        <Progress value={completedTasks} max={Math.max(tasks.length, 1)} tone="green" />
        <div className="task-list">{tasks.slice(0, 4).map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}{!tasks.length && <EmptyState text="Chưa có công việc nào cho hôm nay." />}</div>
      </section>

      <section className="content-card goals-card">
        <div className="card-heading"><div><span className="section-kicker">TIẾN ĐỘ</span><h3>Mục tiêu nổi bật</h3></div></div>
        <div className="goal-list">{goals.slice(0, 3).map((goal, index) => <GoalRow key={goal.id} goal={goal} tone={["orange", "green", "blue"][index % 3]} />)}{!goals.length && <EmptyState text="Chưa có mục tiêu đang hoạt động." />}</div>
      </section>

      <section className="content-card insight-card"><div className="insight-icon">✦</div><div><span className="section-kicker">LIFE INSIGHT</span><h3>Chưa đủ dữ liệu để phân tích</h3><p>Insight sẽ xuất hiện sau khi hệ thống có đủ dữ liệu thực của bạn.</p></div></section>
      <section className="content-card timeline-card"><div className="card-heading"><div><span className="section-kicker">DÒNG THỜI GIAN</span><h3>Hoạt động gần đây</h3></div></div><EmptyState text="Chưa có hoạt động nào được ghi nhận." /></section>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) {
  const done = task.status === "done";
  return <button className={`task-row ${done ? "done" : ""}`} onClick={() => onToggle(task)}><span className="check">{done ? "✓" : ""}</span><span><strong>{task.title}</strong><small>{formatTime(task.scheduled_at)} · <em className={`priority ${task.priority}`}>{task.priority === "high" ? "Ưu tiên cao" : task.priority === "low" ? "Linh hoạt" : "Ưu tiên vừa"}</em></small></span><b>•••</b></button>;
}

function GoalRow({ goal, tone }: { goal: Goal; tone: string }) {
  const percent = Math.round((goal.current_value / Math.max(goal.target_value, 1)) * 100);
  const current = goal.unit === "VND" ? money.format(goal.current_value) : `${goal.current_value} ${goal.unit}`;
  const target = goal.unit === "VND" ? money.format(goal.target_value) : `${goal.target_value} ${goal.unit}`;
  return <div className="goal-row"><div className="goal-line"><span className={`goal-domain ${tone}`}>{goal.domain === "finance" ? "₫" : goal.domain === "health" ? "♡" : "◈"}</span><div><strong>{goal.title}</strong><small>{current} / {target}</small></div><b>{percent}%</b></div><Progress value={goal.current_value} max={goal.target_value} tone={tone} /></div>;
}

function PlanView({ tasks, onToggle, onAdd }: { tasks: Task[]; onToggle: (task: Task) => void; onAdd: () => void }) {
  return <div className="single-page"><section className="page-intro"><div><span className="section-kicker">KẾ HOẠCH</span><h2>Biến dự định thành hành động.</h2><p>Chỉ hiển thị những công việc bạn đã tạo.</p></div><button className="primary-button" onClick={onAdd}>+ Công việc mới</button></section><section className="content-card wide-card"><div className="card-heading"><div><span className="section-kicker">HÔM NAY</span><h3>Danh sách công việc</h3></div><span className="heading-meta">{tasks.filter((t) => t.status === "done").length}/{tasks.length} hoàn thành</span></div><div className="task-list large">{tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}{!tasks.length && <EmptyState text="Chưa có công việc. Hãy thêm việc quan trọng đầu tiên." />}</div></section></div>;
}

function FinanceView({ transactions, expense, onAdd }: { transactions: Transaction[]; expense: number; onAdd: () => void }) {
  return <div className="single-page"><section className="page-intro"><div><span className="section-kicker">TÀI CHÍNH CÁ NHÂN</span><h2>Biết rõ tiền đang đi đâu.</h2><p>Chỉ số tài chính sẽ được tính từ các giao dịch thực tế bạn ghi nhận.</p></div><button className="primary-button" onClick={onAdd}>+ Thêm giao dịch</button></section><section className="finance-overview"><article><span>CHI TIÊU ĐÃ GHI NHẬN</span><strong>{expense ? money.format(expense) : "—"}</strong><small>{expense ? "Từ dữ liệu giao dịch hiện có" : "Chưa có dữ liệu"}</small></article></section><section className="content-card wide-card"><div className="card-heading"><div><span className="section-kicker">GIAO DỊCH</span><h3>Gần đây</h3></div></div><div className="transaction-list">{transactions.map((item) => <div key={item.id}><span className={`transaction-icon ${item.type}`}>{item.type === "income" ? "↙" : "↗"}</span><div><strong>{item.merchant ?? item.description ?? "Giao dịch"}</strong><small>{item.category ?? "Chưa phân loại"} · {formatTime(item.occurred_at)}</small></div><b className={item.type}>{item.type === "income" ? "+" : "−"}{money.format(item.amount)}</b></div>)}{!transactions.length && <EmptyState text="Chưa có giao dịch nào." />}</div></section></div>;
}

function HealthView({ health }: { health: Health }) {
  const hasHealth = health.steps > 0 || health.sleep_minutes > 0 || health.resting_heart_rate > 0 || health.active_minutes > 0;
  return <div className="single-page"><section className="page-intro"><div><span className="section-kicker">SỨC KHỎE</span><h2>Hiểu cơ thể qua dữ liệu thật.</h2><p>Các chỉ số chỉ xuất hiện khi có dữ liệu được đồng bộ hoặc ghi nhận.</p></div><span className="connected-pill"><i />{hasHealth ? "Đã nhận dữ liệu" : "Chưa kết nối nguồn dữ liệu"}</span></section><section className="stat-grid"><StatCard eyebrow="BƯỚC CHÂN" value={health.steps ? health.steps.toLocaleString("vi-VN") : "—"} note={health.distance_meters ? `${(health.distance_meters / 1000).toFixed(1)} km` : "Chưa có dữ liệu"} icon="↗" tone="green" /><StatCard eyebrow="VẬN ĐỘNG" value={health.active_minutes ? `${health.active_minutes} phút` : "—"} note={health.active_minutes ? "Dữ liệu gần nhất" : "Chưa có dữ liệu"} icon="⌁" tone="orange" /><StatCard eyebrow="NHỊP TIM NGHỈ" value={health.resting_heart_rate ? `${health.resting_heart_rate} bpm` : "—"} note={health.resting_heart_rate ? "Dữ liệu gần nhất" : "Chưa có dữ liệu"} icon="♥" tone="red" /><StatCard eyebrow="GIẤC NGỦ" value={health.sleep_minutes ? `${Math.floor(health.sleep_minutes / 60)}h ${health.sleep_minutes % 60}p` : "—"} note={health.sleep_minutes ? "Dữ liệu gần nhất" : "Chưa có dữ liệu"} icon="☾" tone="purple" /></section>{!hasHealth && <section className="content-card wide-card"><EmptyState text="Chưa có dữ liệu sức khỏe. Hãy kết nối thiết bị hoặc nhập dữ liệu đầu tiên." /></section>}</div>;
}

function GoalsView({ goals }: { goals: Goal[] }) {
  return <div className="single-page"><section className="page-intro"><div><span className="section-kicker">MỤC TIÊU</span><h2>Đo tiến độ, không đo cảm giác.</h2><p>Mỗi mục tiêu tự cập nhật từ tài chính, sức khỏe và công việc hằng ngày.</p></div><button className="primary-button">+ Mục tiêu mới</button></section><section className="goal-cards">{goals.map((goal, index) => { const percent = Math.round((goal.current_value / Math.max(goal.target_value, 1)) * 100); return <article key={goal.id}><div className={`big-goal-icon tone-${index % 3}`}>{goal.domain === "finance" ? "₫" : goal.domain === "health" ? "♡" : "◈"}</div><span className="section-kicker">{goal.domain.toUpperCase()}</span><h3>{goal.title}</h3><div className="goal-percent"><strong>{percent}%</strong><small>{percent >= 65 ? "Đúng tiến độ" : "Cần chú ý"}</small></div><Progress value={goal.current_value} max={goal.target_value} tone={["orange", "green", "blue"][index % 3]} /><p><span>Hiện tại</span><b>{goal.unit === "VND" ? money.format(goal.current_value) : `${goal.current_value} ${goal.unit}`}</b></p><p><span>Mục tiêu</span><b>{goal.unit === "VND" ? money.format(goal.target_value) : `${goal.target_value} ${goal.unit}`}</b></p><p><span>Dự kiến</span><b>{goal.target_date ? new Intl.DateTimeFormat("vi-VN").format(new Date(goal.target_date)) : "Không giới hạn"}</b></p></article>; })}{!goals.length && <EmptyState text="Chưa có mục tiêu. Hãy tạo một kết quả có thể đo lường." />}</section></div>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }

function QuickAdd({ type, userId, isDemo, onClose, onTask, onTransaction }: { type: "task" | "transaction"; userId: string | null; isDemo: boolean; onClose: () => void; onTask: (task: Task) => void; onTransaction: (transaction: Transaction) => void }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    if (type === "task") {
      const draft: Task = { id: crypto.randomUUID(), title: String(form.get("title")), status: "todo", priority: String(form.get("priority")), scheduled_at: new Date(String(form.get("scheduled_at"))).toISOString() };
      if (!isDemo && userId) {
        const supabase = createClient();
        const { data } = await supabase!.from("tasks").insert({ user_id: userId, title: draft.title, status: draft.status, priority: draft.priority, scheduled_at: draft.scheduled_at }).select("id,title,status,priority,scheduled_at,completed_at").single();
        if (data) onTask(data); else onTask(draft);
      } else onTask(draft);
    } else {
      const draft: Transaction = { id: crypto.randomUUID(), merchant: String(form.get("merchant")), description: String(form.get("description")), amount: Number(form.get("amount")), type: "expense", occurred_at: new Date().toISOString(), category: "Chưa phân loại" };
      if (!isDemo && userId) {
        const supabase = createClient();
        const { data } = await supabase!.from("transactions").insert({ user_id: userId, merchant: draft.merchant, description: draft.description, amount: draft.amount, type: "expense", occurred_at: draft.occurred_at }).select("id,merchant,description,amount,type,occurred_at").single();
        if (data) onTransaction({ ...data, amount: Number(data.amount) }); else onTransaction(draft);
      } else onTransaction(draft);
    }
    setSaving(false);
    onClose();
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="quick-modal" onSubmit={submit}><div className="modal-heading"><div><span className="section-kicker">THÊM NHANH</span><h3>{type === "task" ? "Công việc mới" : "Giao dịch mới"}</h3></div><button type="button" onClick={onClose}>×</button></div>{type === "task" ? <><label>Tên công việc<input name="title" required autoFocus placeholder="Ví dụ: Chạy bộ 30 phút" /></label><div className="form-row"><label>Mức ưu tiên<select name="priority" defaultValue="medium"><option value="high">Cao</option><option value="medium">Vừa</option><option value="low">Linh hoạt</option></select></label><label>Thời gian<input name="scheduled_at" type="datetime-local" required defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></label></div></> : <><label>Nơi chi tiêu<input name="merchant" required autoFocus placeholder="Ví dụ: Cửa hàng tiện lợi" /></label><label>Số tiền<input name="amount" type="number" min="0" required placeholder="0" /></label><label>Ghi chú<input name="description" placeholder="Nội dung giao dịch" /></label></>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu dữ liệu"}</button></form></div>;
}
