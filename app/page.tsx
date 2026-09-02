"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GameCenter from "./components/GameCenter";

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

type WalletState = {
  balance: number;
  debt: number;
  dailyClaimDate: string | null;
  newbieStep: number;
  newbieDailyClaimDate: string | null;
  createdAt: string;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWalletStorageKey = (username?: string | null) => `hy88-wallet-${username || "guest"}`;

const generateDeviceId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getDeviceIdStorageKey = () => "hy88-device-id";

const getOrCreateDeviceId = (): string => {
  try {
    let deviceId = localStorage.getItem(getDeviceIdStorageKey());
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(getDeviceIdStorageKey(), deviceId);
    }
    return deviceId;
  } catch {
    return generateDeviceId();
  }
};

const getDeviceAccountsStorageKey = () => "hy88-device-accounts";

const getDeviceAccounts = (): string[] => {
  try {
    const stored = localStorage.getItem(getDeviceAccountsStorageKey());
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addDeviceAccount = (username: string) => {
  const accounts = getDeviceAccounts();
  if (!accounts.includes(username)) {
    accounts.push(username);
    localStorage.setItem(getDeviceAccountsStorageKey(), JSON.stringify(accounts));
  }
};

const createDefaultWallet = (): WalletState => ({
  balance: 100000,
  debt: 0,
  dailyClaimDate: null,
  newbieStep: 0,
  newbieDailyClaimDate: null,
  createdAt: new Date().toISOString(),
});

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
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const isAuthenticated = status === "authenticated" && !!session?.user;

  useEffect(() => {
    if (!isAuthenticated) {
      setWallet(null);
      return;
    }

    const walletKey = getWalletStorageKey(session.user?.name || session.user?.email || "guest");
    const saved = localStorage.getItem(walletKey);

    if (!saved) {
      const initialWallet = createDefaultWallet();
      localStorage.setItem(walletKey, JSON.stringify(initialWallet));
      setWallet(initialWallet);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as WalletState;
      const normalized: WalletState = {
        balance: Number(parsed.balance) || 100000,
        debt: Number(parsed.debt) || 0,
        dailyClaimDate: parsed.dailyClaimDate || null,
        newbieDailyClaimDate: parsed.newbieDailyClaimDate || null,
        newbieStep: Number(parsed.newbieStep) || 0,
        createdAt: parsed.createdAt || new Date().toISOString(),
      };
      setWallet(normalized);
    } catch {
      const initialWallet = createDefaultWallet();
      localStorage.setItem(walletKey, JSON.stringify(initialWallet));
      setWallet(initialWallet);
    }
  }, [isAuthenticated, session?.user?.name, session?.user?.email]);

  const persistWallet = (nextWallet: WalletState) => {
    if (!isAuthenticated) return;
    const walletKey = getWalletStorageKey(session.user?.name || session.user?.email || "guest");
    localStorage.setItem(walletKey, JSON.stringify(nextWallet));
    setWallet(nextWallet);
  };

  const handleGameWalletUpdate = (newBalance: number, newDebt: number) => {
    if (!wallet) return;
    const nextWallet = {
      ...wallet,
      balance: newBalance,
      debt: newDebt,
    };
    persistWallet(nextWallet);
  };

  const handleDailyBonus = () => {
    if (!wallet) return;
    const todayKey = formatDateKey(new Date());

    if (wallet.dailyClaimDate === todayKey) {
      setMessage("Bạn đã nhận Daily hôm nay rồi.");
      return;
    }

    const nextWallet = {
      ...wallet,
      balance: wallet.balance + 50000,
      dailyClaimDate: todayKey,
    };

    persistWallet(nextWallet);
    setMessage("Bạn đã nhận 50.000 VND từ Daily.");
  };

  const handleNewUserDaily = () => {
    if (!wallet) return;
    const newbieRewards = [300000, 200000, 100000, 100000, 100000, 100000, 100000];
    const todayKey = formatDateKey(new Date());

    if (wallet.newbieStep >= newbieRewards.length) {
      setMessage("Nút Daily người mới đã hết hiệu lực.");
      return;
    }

    if (wallet.newbieDailyClaimDate === todayKey) {
      setMessage("Bạn đã nhận Daily người mới hôm nay rồi.");
      return;
    }

    const reward = newbieRewards[wallet.newbieStep];
    const nextWallet = {
      ...wallet,
      balance: wallet.balance + reward,
      newbieStep: wallet.newbieStep + 1,
      newbieDailyClaimDate: todayKey,
    };

    persistWallet(nextWallet);
    setMessage(`Bạn nhận ${reward.toLocaleString("vi-VN")} VND từ Daily người mới.`);
  };

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage("Vui lòng nhập username và mật khẩu");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }

    const deviceAccounts = getDeviceAccounts();
    if (deviceAccounts.length >= 3) {
      setMessage("Thiết bị này đã tạo tối đa 3 tài khoản. Không thể tạo thêm.");
      return;
    }

    setLoading(true);
    setMessage("");

    const deviceId = getOrCreateDeviceId();
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, deviceId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || "Đăng ký thất bại");
      return;
    }

    addDeviceAccount(username);
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
          {activeMenu === "Sòng bạc" ? (
            <GameCenter wallet={wallet} onWalletUpdate={handleGameWalletUpdate} />
          ) : activeMenu === "Ví" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Ví tiền</p>
                  <h1 className="mt-2 text-4xl font-bold text-white">{wallet ? `${wallet.balance.toLocaleString("vi-VN")} VND` : "0 VND"}</h1>
                </div>
                {wallet && wallet.debt > 0 && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4">
                    <p className="text-sm text-red-300">No</p>
                    <p className="mt-2 text-2xl font-bold text-red-200">{wallet.debt.toLocaleString("vi-VN")} VND</p>
                  </div>
                )}
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDailyBonus}
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-left transition hover:bg-amber-500/15"
                >
                  <p className="text-sm text-amber-200">Daily</p>
                  <p className="mt-2 text-2xl font-bold text-white">+50.000 VND</p>
                  <p className="mt-2 text-sm text-slate-300">Nhận mỗi ngày, reset 00:00 ngày mai.</p>
                </button>

                <button
                  type="button"
                  onClick={handleNewUserDaily}
                  disabled={(wallet?.newbieStep ?? 0) >= 7}
                  className="rounded-2xl border border-violet-400/40 bg-violet-500/10 p-5 text-left transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm text-violet-200">Daily người mới</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {(wallet?.newbieStep ?? 0) >= 7 ? "Hoàn thành" : `+${[300000, 200000, 100000, 100000, 100000, 100000, 100000][wallet?.newbieStep ?? 0].toLocaleString("vi-VN")} VND`}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {wallet && (wallet.newbieStep ?? 0) >= 7 ? "Bạn đã hoàn tất 7 ngày." : "Ngày 1: 300k • Ngày 2: 200k • Từ ngày 3 đến 7: 100k"}
                  </p>
                </button>
              </div>

              {message && <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
            </div>
          ) : activeMenu === "Hỗ trợ" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88</p>
                <h1 className="mt-3 text-4xl font-bold text-white">Hỗ trợ khách hàng</h1>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-amber-400/40 bg-slate-900/80 p-5 shadow-inner shadow-amber-500/10">
                  <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Thương hiệu</p>
                  <p className="mt-3 text-3xl font-bold text-white">HY88</p>
                </div>

                <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/80 p-5 shadow-inner shadow-cyan-500/10">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Website</p>
                  <a href="https://hy88-woad.vercel.app/" target="_blank" rel="noreferrer" className="mt-3 block text-xl font-semibold text-white underline decoration-cyan-400/70 underline-offset-4">
                    https://hy88-woad.vercel.app/
                  </a>
                </div>

                <div className="rounded-2xl border border-violet-400/40 bg-slate-900/80 p-5 shadow-inner shadow-violet-500/10">
                  <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Liên hệ</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="https://www.facebook.com/duchuy23712"
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-3 text-center font-medium text-blue-200 transition hover:bg-blue-500/20"
                    >
                      Facebook
                    </a>
                    <a
                      href="https://discord.gg/tnSt9Ppb94"
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-center font-medium text-violet-200 transition hover:bg-violet-500/20"
                    >
                      Discord
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8 rounded-3xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Game hub</p>
                <h1 className="mt-3 text-4xl font-bold">Xin chào, {session.user?.name || "Người chơi"}</h1>
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

        <h1 className="mb-6 text-3xl font-bold text-white">HY88</h1>

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
