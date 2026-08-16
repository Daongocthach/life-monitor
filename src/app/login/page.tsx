"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase chưa được cấu hình cho môi trường này.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setLoading(true);
    setMessage(null);

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(error.message);
      else setMessage("Đã tạo tài khoản. Kiểm tra email để xác nhận đăng nhập.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        router.push("/dashboard");
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand"><span className="brand-mark">LM</span><div><strong>Life Monitor</strong><small>Personal data system</small></div></div>
        <div><span className="section-kicker">YOUR LIFE, MEASURED</span><h1>Dữ liệu giúp bạn hiểu chính mình.</h1><p>Gom sức khỏe, tài chính, công việc và mục tiêu vào một hệ thống có thể đo lường, phân tích và hành động.</p></div>
        <small>Private by design · Powered by Supabase</small>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <Link href="/" className="back-link">← Quay lại bản xem thử</Link>
          <span className="section-kicker">{isSignup ? "BẮT ĐẦU" : "CHÀO MỪNG TRỞ LẠI"}</span>
          <h2>{isSignup ? "Tạo hồ sơ dữ liệu" : "Đăng nhập Life Monitor"}</h2>
          <p>{isSignup ? "Mọi dữ liệu được tách riêng và bảo vệ bằng quyền truy cập theo người dùng." : "Tiếp tục theo dõi nhịp sống và những việc quan trọng."}</p>
          {message && <div className="auth-error">{message}</div>}
          <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Mật khẩu<input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={8} placeholder="Ít nhất 8 ký tự" /></label>
          <button className="primary-button" disabled={loading}>{loading ? "Đang xử lý…" : isSignup ? "Tạo tài khoản" : "Đăng nhập"}</button>
          <div className="auth-switch">{isSignup ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button type="button" onClick={() => { setIsSignup(!isSignup); setMessage(null); }}>{isSignup ? "Đăng nhập" : "Đăng ký"}</button></div>
        </form>
      </section>
    </main>
  );
}
