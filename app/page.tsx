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

type LeaderboardEntry = {
  username: string;
  balance: number;
  rounds: number;
  wins: number;
  losses: number;
  winRate: number;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  const [walletLoading, setWalletLoading] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const isAuthenticated = status === "authenticated" && !!session?.user;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    const loadWallet = async (showLoading = false) => {
      if (showLoading) setWalletLoading(true);

      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { wallet: WalletState };
          setWallet(data.wallet);
        } else if (showLoading) {
          setMessage("Không thể tải số dư tài khoản.");
        }
      } catch {
        if (showLoading && !cancelled) {
          setMessage("Không thể tải số dư tài khoản.");
        }
      } finally {
        if (showLoading && !cancelled) setWalletLoading(false);
      }
    };

    void loadWallet(true);
    const refreshInterval = window.setInterval(() => {
      if (!document.hidden) void loadWallet();
    }, 5000);
    const handleWindowFocus = () => void loadWallet();
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const loadLeaderboard = async () => {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!cancelled && res.ok) {
        const data = (await res.json()) as { leaderboard: LeaderboardEntry[] };
        setLeaderboard(data.leaderboard);
      }
    };

    void loadLeaderboard();
    const refreshInterval = window.setInterval(() => {
      if (!document.hidden) void loadLeaderboard();
    }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [isAuthenticated]);

  const handleGameWalletUpdate = (newBalance: number, newDebt: number): Promise<boolean> => {
    if (!wallet) return Promise.resolve(false);
    setWallet((current) => current ? { ...current, balance: newBalance, debt: newDebt } : current);
    return Promise.resolve(true);
  };

  const claimBonus = async (action: "daily" | "newbie") => {
    if (!wallet) return;
    const todayKey = formatDateKey(new Date());
    setLoading(true);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, dateKey: todayKey }),
    });
    const data = (await res.json()) as { wallet?: WalletState; error?: string };
    setLoading(false);
    if (!res.ok || !data.wallet) {
      setMessage(data.error || "Không thể đồng bộ dữ liệu");
      return;
    }
    setWallet(data.wallet);
    setMessage(action === "daily" ? "Bạn đã nhận 50.000 VND từ Daily." : "Bạn đã nhận Daily người mới.");
  };

  const handleDailyBonus = () => void claimBonus("daily");

  const handleBorrow = async () => {
    setLoading(true);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "borrow" }),
    });
    const data = (await res.json()) as { wallet?: WalletState; error?: string };
    setLoading(false);
    if (!res.ok || !data.wallet) {
      setMessage(data.error || "Không thể vay nợ");
      return;
    }
    setWallet(data.wallet);
    setMessage("Bạn đã vay 50.000 VND. Khoản nợ đã được cập nhật.");
  };

  const handleRepay = async () => {
    const amount = Number(repaymentAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setMessage("Nhập số tiền trả nợ hợp lệ.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repay", amount }),
    });
    const data = (await res.json()) as { wallet?: WalletState; error?: string };
    setLoading(false);
    if (!res.ok || !data.wallet) {
      setMessage(data.error || "Không thể trả nợ");
      return;
    }
    setWallet(data.wallet);
    setRepaymentAmount("");
    setMessage(`Đã trả ${amount.toLocaleString("vi-VN")} VND tiền nợ.`);
  };

  const handleNewUserDaily = () => {
    if (!wallet) return;
    const todayKey = formatDateKey(new Date());

    if (wallet.newbieStep >= 7) {
      setMessage("Nút Daily người mới đã hết hiệu lực.");
      return;
    }

    if (wallet.newbieDailyClaimDate === todayKey) {
      setMessage("Bạn đã nhận Daily người mới hôm nay rồi.");
      return;
    }

    void claimBonus("newbie");
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

        <section className="mx-auto w-full max-w-[1440px] px-6 py-10">
          {walletLoading ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-slate-300">Đang tải số dư...</div>
          ) : activeMenu === "Sòng bạc" ? (
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
                    <p className="text-sm text-red-300">Nợ</p>
                    <p className="mt-2 text-2xl font-bold text-red-200">{wallet.debt.toLocaleString("vi-VN")} VND</p>
                  </div>
                )}
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDailyBonus}
                  disabled={loading}
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 text-left transition hover:bg-amber-500/15"
                >
                  <p className="text-sm text-amber-200">Daily</p>
                  <p className="mt-2 text-2xl font-bold text-white">+50.000 VND</p>
                  <p className="mt-2 text-sm text-slate-300">Nhận mỗi ngày, reset 00:00 ngày mai.</p>
                </button>

                <button
                  type="button"
                  onClick={handleBorrow}
                  disabled={loading}
                  className="rounded-2xl border border-red-400/40 bg-red-500/10 p-5 text-left transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm text-red-200">Vay nợ</p>
                  <p className="mt-2 text-2xl font-bold text-white">+50.000 VND</p>
                  <p className="mt-2 text-sm text-slate-300">Tối đa 2.000.000 VND tiền nợ.</p>
                </button>

                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5">
                  <p className="text-sm text-emerald-200">Trả nợ</p>
                  <input
                    type="number"
                    min="1"
                    value={repaymentAmount}
                    onChange={(event) => setRepaymentAmount(event.target.value)}
                    placeholder="Nhập số tiền"
                    disabled={loading || !wallet?.debt}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleRepay}
                    disabled={loading || !repaymentAmount || !wallet?.debt}
                    className="mt-3 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Xác nhận trả nợ
                  </button>
                </div>

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

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Bảng xếp hạng</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Top người chơi theo số tiền</h2>
                  </div>
                  <span className="text-xs text-slate-400">Cập nhật tự động</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-3 py-3">Hạng</th>
                        <th className="px-3 py-3">Người chơi</th>
                        <th className="px-3 py-3 text-right">Số tiền</th>
                        <th className="px-3 py-3 text-right">Ván chơi</th>
                        <th className="px-3 py-3 text-right">Thắng</th>
                        <th className="px-3 py-3 text-right">Thua</th>
                        <th className="px-3 py-3 text-right">Tỷ lệ thắng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, index) => (
                        <tr key={entry.username} className="border-b border-white/5 text-slate-200 last:border-0">
                          <td className="px-3 py-4 font-bold text-amber-300">#{index + 1}</td>
                          <td className="px-3 py-4 font-semibold text-white">{entry.username}</td>
                          <td className="px-3 py-4 text-right font-semibold text-emerald-300">{entry.balance.toLocaleString("vi-VN")} VND</td>
                          <td className="px-3 py-4 text-right">{entry.rounds}</td>
                          <td className="px-3 py-4 text-right text-emerald-300">{entry.wins}</td>
                          <td className="px-3 py-4 text-right text-red-300">{entry.losses}</td>
                          <td className="px-3 py-4 text-right font-semibold">{entry.winRate.toLocaleString("vi-VN")} %</td>
                        </tr>
                      ))}
                      {!leaderboard.length && (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Chưa có dữ liệu xếp hạng.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
