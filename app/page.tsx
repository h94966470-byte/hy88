"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const menuItems = ["Trang chủ", "Sòng bạc", "Ví", "Khuyến mãi", "Hỗ trợ"];
const supportLinks = [
  {
    label: "Website",
    href: "https://hy88-woad.vercel.app/",
    value: "https://hy88-woad.vercel.app/",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/duchuy23712",
    value: "https://www.facebook.com/duchuy23712",
  },
  {
    label: "Discord",
    href: "https://discord.gg/tnSt9Ppb94",
    value: "https://discord.gg/tnSt9Ppb94",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [activeMenu, setActiveMenu] = useState<string>("Trang chủ");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isAuthenticated = status === "authenticated" && !!session?.user;

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage("Vui lòng nhập username và mật khẩu");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    setMessage("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "Đăng ký thất bại");
      return;
    }

    setMessage("Đăng ký thành công. Bạn có thể đăng nhập ngay.");
    setMode("login");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleCredentialsLogin = async () => {
    setLoading(true);
    setMessage("");

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setMessage("Username hoặc mật khẩu không đúng");
      return;
    }

    router.refresh();
  };

  if (isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="text-xl font-bold text-amber-400">HY88</div>
              <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
                {menuItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`transition ${activeMenu === item ? "text-white" : "hover:text-white"}`}
                    onClick={() => setActiveMenu(item)}
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                {session.user?.name || "Người chơi"}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-10">
          {activeMenu === "Hỗ trợ" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88</p>
                <h1 className="mt-3 text-4xl font-bold text-white">Hỗ trợ khách hàng</h1>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">
                  <p className="text-sm text-amber-200">Tên thương hiệu</p>
                  <p className="mt-2 text-2xl font-semibold text-white">HY88</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
                  <p className="text-sm text-cyan-200">Website</p>
                  <a href="https://hy88-woad.vercel.app/" target="_blank" rel="noreferrer" className="mt-2 block text-lg font-semibold text-white underline decoration-cyan-400/70 underline-offset-4">
                    hy88-woad.vercel.app
                  </a>
                </div>
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <p className="text-sm text-violet-200">Liên hệ</p>
                  <p className="mt-2 text-lg font-semibold text-white">24/7</p>
                </div>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {supportLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-white/10 bg-slate-800/80 p-5 transition hover:border-amber-400/50 hover:bg-slate-800"
                  >
                    <p className="text-sm text-slate-400">{item.label}</p>
                    <p className="mt-2 break-all text-base font-medium text-white">{item.value}</p>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8 rounded-3xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Game hub</p>
                <h1 className="mt-3 text-4xl font-bold">Xin chào, {session.user?.name || "Người chơi"}</h1>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <p className="text-sm text-emerald-200">Tài khoản</p>
                  <p className="mt-2 text-2xl font-semibold">{session.user?.name || "Người chơi"}</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
                  <p className="text-sm text-cyan-200">Trạng thái</p>
                  <p className="mt-2 text-2xl font-semibold">Đã đăng nhập</p>
                </div>
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
                  <p className="text-sm text-violet-200">Nền tảng</p>
                  <p className="mt-2 text-2xl font-semibold">Next.js + Vercel</p>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b,_#020617_60%)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex gap-2 rounded-full bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full px-4 py-2 font-medium ${mode === "login" ? "bg-amber-400 text-slate-950" : "text-slate-300"}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full px-4 py-2 font-medium ${mode === "signup" ? "bg-amber-400 text-slate-950" : "text-slate-300"}`}
          >
            Đăng ký
          </button>
        </div>

        <h1 className="mb-6 text-3xl font-bold text-white">Sòng bạc online</h1>

        {mode === "signup" && (
          <div className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              type="password"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu"
              type="password"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
            <button type="button" onClick={handleSignup} disabled={loading} className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
              {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
            </button>
          </div>
        )}

        {mode === "login" && (
          <div className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              type="password"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
            <button type="button" onClick={handleCredentialsLogin} disabled={loading} className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
      </div>
    </main>
  );
}
