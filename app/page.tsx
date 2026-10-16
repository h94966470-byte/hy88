"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { hasPasswordDiacritics } from "@/lib/password-validation";
import BalanceHistoryModal from "./components/BalanceHistoryModal";
import GameCenter from "./components/GameCenter";

const menuItems = ["Ví", "Khuyến mãi", "Hỗ trợ"];
let simulationDisclaimerDismissed = false;

type DeviceLoginNotification = {
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

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

function SimulationDisclaimer() {
  const [visible, setVisible] = useState(!simulationDisclaimerDismissed);
  if (!visible) return null;

  const dismiss = () => {
    simulationDisclaimerDismissed = true;
    setVisible(false);
  };

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Đóng thông báo"
      className="simulation-disclaimer-overlay fixed inset-0 z-[100] flex w-full cursor-pointer items-start justify-center bg-black/75 px-4 pt-[10vh] text-center backdrop-blur-sm"
    >
      <span className="w-full max-w-2xl rounded-2xl border border-amber-400/40 bg-slate-950 px-6 py-7 text-base leading-relaxed text-slate-200 shadow-[0_24px_80px_rgba(0,0,0,0.75)] sm:px-10 sm:py-9 sm:text-lg">
        <span className="block">Mọi thứ trên web này đều là giả lập, không quy đổi ra tiền mặt, không cổ xúy chơi cờ bạc, đỏ đen.</span>
        <span className="mt-3 block font-bold text-amber-300">Hãy tránh xa cờ bạc.</span>
        <span className="mt-5 block text-xs text-slate-400">Chạm hoặc nhấn bất kỳ đâu để đóng</span>
      </span>
    </button>
  );
}

const addDeviceAccount = (username: string) => {
  const accounts = getDeviceAccounts();
  if (!accounts.includes(username)) {
    accounts.push(username);
    localStorage.setItem(getDeviceAccountsStorageKey(), JSON.stringify(accounts));
  }
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenHtmlElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function DeviceAccessGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<"checking" | "desktop" | "desktop-mode" | "portrait" | "allowed">("checking");

  useEffect(() => {
    const updateAccess = () => {
      const mobileUserAgent = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini|Mobile/i.test(navigator.userAgent);
      const smallTouchScreen = navigator.maxTouchPoints > 1 &&
        Math.min(window.screen.width, window.screen.height) <= 600;
      const isMobile = mobileUserAgent || smallTouchScreen;

      if (!isMobile) {
        setAccess("desktop");
      } else if (smallTouchScreen && !mobileUserAgent) {
        setAccess("desktop-mode");
      } else if (!window.matchMedia("(orientation: landscape)").matches) {
        setAccess("portrait");
      } else {
        setAccess("allowed");
      }
    };

    updateAccess();
    window.addEventListener("resize", updateAccess);
    window.addEventListener("orientationchange", updateAccess);
    return () => {
      window.removeEventListener("resize", updateAccess);
      window.removeEventListener("orientationchange", updateAccess);
    };
  }, []);

  if (access === "checking") {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300">
        Đang kiểm tra thiết bị...
      </div>
    );
  }

  if (access === "desktop-mode" || access === "portrait") {
    const message = access === "desktop-mode"
      ? 'hãy tắt tính năng "Trang cho máy tính" để tiếp tục'
      : "hãy xoay ngang máy để tiếp tục";

    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-amber-400/30 bg-slate-900/80 p-8 text-center shadow-2xl">
        <p className="text-xl font-semibold text-amber-200">{message}</p>
      </div>
    );
  }

  return children;
}

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [activeMenu, setActiveMenu] = useState<string>("Trang chủ");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBalanceHistoryOpen, setIsBalanceHistoryOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [deviceNotifications, setDeviceNotifications] = useState<{
    currentDevice: DeviceLoginNotification | null;
    recentLogins: DeviceLoginNotification[];
  } | null>(null);
  const closeBalanceHistory = useCallback(() => setIsBalanceHistoryOpen(false), []);
  const [animatedBalance, setAnimatedBalance] = useState(0);
  const animatedBalanceRef = useRef(0);
  const hasInitializedBalance = useRef(false);
  const balanceTarget = wallet?.balance;

  const isAuthenticated = status === "authenticated" && !!session?.user;

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const checkDeviceSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;
        const currentSession = (await response.json()) as {
          deviceSessionActive?: boolean;
          user?: { id?: string };
        };
        if (!cancelled && (currentSession.deviceSessionActive === false || currentSession.user?.id === "guest")) {
          setMessage("Tài khoản đã đăng nhập trên thiết bị khác. Thiết bị này đã được đăng xuất.");
          await signOut({ redirect: false });
        }
      } catch (error) {
        console.error("Check active device session error:", error);
      }
    };

    void checkDeviceSession();
    const interval = window.setInterval(() => void checkDeviceSession(), 5000);
    window.addEventListener("focus", checkDeviceSession);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkDeviceSession);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeMenu !== "Thông báo") return;

    let cancelled = false;
    void fetch("/api/device-notifications", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải thông báo thiết bị");
        return response.json() as Promise<{
          currentDevice: DeviceLoginNotification | null;
          recentLogins: DeviceLoginNotification[];
        }>;
      })
      .then((data) => {
        if (!cancelled) setDeviceNotifications(data);
      })
      .catch((error: unknown) => {
        console.error("Load device notifications error:", error);
        if (!cancelled) setMessage("Không thể tải thông báo thiết bị.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeMenu, isAuthenticated]);

  useEffect(() => {
    const mobileUserAgent = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini|Mobile/i.test(navigator.userAgent);
    const smallTouchScreen = navigator.maxTouchPoints > 1 &&
      Math.min(window.screen.width, window.screen.height) <= 600;
    if (!mobileUserAgent && !smallTouchScreen) return;

    const fullscreenDocument = document as FullscreenDocument;
    const root = document.documentElement as FullscreenHtmlElement;
    let requestPending = false;
    const isFullscreen = () => Boolean(
      fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement,
    );
    const requestFullscreenOnInteraction = () => {
      if (isFullscreen() || requestPending) return;
      const requestFullscreen = root.requestFullscreen?.bind(root) ??
        root.webkitRequestFullscreen?.bind(root);
      if (!requestFullscreen) return;

      requestPending = true;
      try {
        void Promise.resolve(requestFullscreen())
          .catch((error: unknown) => {
            console.warn("Unable to enter fullscreen mode:", error);
          })
          .finally(() => {
            requestPending = false;
          });
      } catch (error) {
        requestPending = false;
        console.warn("Unable to enter fullscreen mode:", error);
      }
    };
    const handleFullscreenChange = () => {
      if (isFullscreen()) requestPending = false;
    };

    window.addEventListener("pointerup", requestFullscreenOnInteraction, true);
    window.addEventListener("touchend", requestFullscreenOnInteraction, true);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("pointerup", requestFullscreenOnInteraction, true);
      window.removeEventListener("touchend", requestFullscreenOnInteraction, true);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    const loadWallet = async (showLoading = false) => {
      if (showLoading) setWalletLoading(true);

      try {
        if (showLoading) {
          try {
            const recoveryResponse = await fetch("/api/games", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "recover" }),
              cache: "no-store",
            });
            if (!cancelled && recoveryResponse.ok) {
              const recoveryData = (await recoveryResponse.json()) as { recovered: number };
              if (recoveryData.recovered > 0) {
                setMessage("Ván chơi chưa mở bát đã được tự động chốt sau khi tải lại ứng dụng.");
              }
            } else if (!cancelled) {
              setMessage("Không thể tự động chốt ván chơi đang chờ.");
            }
          } catch {
            if (!cancelled) setMessage("Không thể tự động chốt ván chơi đang chờ.");
          }
        }

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

  useEffect(() => {
    if (balanceTarget === undefined) return;
    const target = balanceTarget;
    if (!hasInitializedBalance.current) {
      hasInitializedBalance.current = true;
      animatedBalanceRef.current = target;
      setAnimatedBalance(target);
      return;
    }
    if (target === animatedBalanceRef.current) return;

    let frame = 0;
    const start = performance.now();
    const from = animatedBalanceRef.current;
    const duration = 1500;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const value = Math.round(from + (target - from) * easedProgress);
      animatedBalanceRef.current = value;
      setAnimatedBalance(value);
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        animatedBalanceRef.current = target;
        setAnimatedBalance(target);
      }
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [balanceTarget]);

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

  const handleNewUserDaily = () => {
    if (!wallet) return;
    const todayKey = formatDateKey(new Date());

    if (wallet.newbieStep >= 7) {
      setMessage("Bạn đã hoàn tất Daily người mới.");
      return;
    }

    if (wallet.newbieDailyClaimDate === todayKey) {
      setMessage("Bạn đã nhận Daily người mới hôm nay rồi.");
      return;
    }

    void claimBonus("newbie");
  };

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

  const handleQuickRepay = async (portion: "half" | "all") => {
    if (!wallet || wallet.debt <= 0) return;

    const amount = portion === "all" ? wallet.debt : Math.ceil(wallet.debt / 2);
    setLoading(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repay", amount }),
      });
      const data = (await res.json()) as { wallet?: WalletState; error?: string };
      if (!res.ok || !data.wallet) {
        setMessage(data.error || "Không thể trả nợ");
        return;
      }
      setWallet(data.wallet);
      setMessage(`Đã trả ${portion === "all" ? "hết" : "một nửa"} số nợ (${amount.toLocaleString("vi-VN")} VND).`);
    } catch {
      setMessage("Không thể kết nối để trả nợ.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage("Vui lòng nhập username và mật khẩu");
      return;
    }

    if (hasPasswordDiacritics(password)) {
      setMessage("Mật khẩu không được chứa dấu");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
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
    if (hasPasswordDiacritics(password)) {
      setMessage("Mật khẩu không được chứa dấu");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await signIn("credentials", {
        username,
        password,
        deviceId: getOrCreateDeviceId(),
        redirect: false,
      });

      if (res?.status === 429) {
        setMessage("Bạn đã đăng nhập quá 5 lần trong một phút. Vui lòng thử lại sau.");
        return;
      }

      if (res?.error) {
        setMessage("Username hoặc mật khẩu không đúng");
        return;
      }

      router.refresh();
    } catch {
      setMessage("Không thể đăng nhập. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    const result = await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign(result?.url || "/");
  };

  if (isAuthenticated) {
    return (
      <DeviceAccessGate>
        <main className="min-h-screen bg-slate-950 text-white">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_auto] sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="shrink-0 text-lg font-bold text-amber-400 sm:text-xl"
                onClick={() => setActiveMenu("Trang chủ")}
              >
                HY88
              </button>
              <span className="max-w-[88px] truncate rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-100 sm:max-w-[150px] sm:text-sm">
                {session.user?.name || "Người chơi"}
              </span>
            </div>

            <div className="col-span-2 row-start-2 flex min-h-10 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:min-h-11">
              <span className="truncate text-sm font-bold tabular-nums text-emerald-200 sm:text-base">
                {wallet ? animatedBalance.toLocaleString("vi-VN") : "—"} VND
              </span>
            </div>

            <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-3 sm:row-start-1 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation"
                className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-200 transition hover:bg-white/10"
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu("Thông báo");
                  setIsMobileMenuOpen(false);
                }}
                aria-label="Thông báo"
                title="Thông báo"
                className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-200 transition hover:bg-white/10"
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMenu("Sòng bạc");
                  setIsMobileMenuOpen(false);
                }}
                aria-label="Sòng bạc"
                title="Sòng bạc"
                className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5 text-amber-200 transition hover:bg-amber-500/20"
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
                  <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                  <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
                  <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs transition hover:bg-white/10 sm:px-4 sm:text-sm"
              >
                {loading ? "Thoát..." : "Đăng xuất"}
              </button>
            </div>

            <nav
              id="mobile-navigation"
              aria-label="Điều hướng chính"
              className={`${isMobileMenuOpen ? "grid" : "hidden"} w-full grid-cols-2 gap-1 border-t border-white/10 pt-3 text-sm text-slate-300`}
            >
              {menuItems.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  style={{ animationDelay: `${index * 60}ms` }}
                  className={`auth-field auth-btn rounded-lg border px-3 py-2 text-left transition ${item === "Ví" ? "col-start-1 row-start-1" : item === "Khuyến mãi" ? "col-start-2 row-start-1" : "col-start-2 row-start-2"} ${activeMenu === item ? "auth-btn-active border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-amber-400/20 bg-slate-950/20 text-slate-300 hover:border-amber-400/50 hover:text-amber-100"}`}
                  onClick={() => {
                    setActiveMenu(item);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                style={{ animationDelay: `${menuItems.length * 60}ms` }}
                className="auth-field auth-btn col-start-1 row-start-2 rounded-lg border border-amber-400/20 bg-slate-950/20 px-3 py-2 text-left font-semibold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-100"
                onClick={() => {
                  setIsBalanceHistoryOpen(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                Biến động số dư
              </button>
            </nav>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1440px] px-6 py-10">
          {walletLoading ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-slate-300">Đang tải số dư...</div>
          ) : activeMenu === "Sòng bạc" ? (
            <GameCenter wallet={wallet} onWalletUpdate={handleGameWalletUpdate} />
          ) : activeMenu === "Thông báo" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
              <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Thông báo</p>
              <h1 className="mt-3 text-3xl font-bold text-white">Thiết bị đăng nhập</h1>
              {!deviceNotifications ? (
                <p className="mt-5 text-slate-300">Đang tải thông tin thiết bị...</p>
              ) : (
                <div className="mt-6 space-y-6">
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                    <h2 className="font-semibold text-emerald-200">Phiên đăng nhập hiện tại</h2>
                    {deviceNotifications.currentDevice ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p>IP: <span className="font-semibold">{deviceNotifications.currentDevice.ipAddress || "Không xác định"}</span></p>
                        <p>Thiết bị/trình duyệt: {deviceNotifications.currentDevice.userAgent || "Không xác định"}</p>
                        <p>Đăng nhập lúc: {new Date(deviceNotifications.currentDevice.createdAt).toLocaleString("vi-VN")}</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-300">Chưa có thông tin phiên đăng nhập.</p>
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Lịch sử đăng nhập gần đây</h2>
                    <div className="mt-3 space-y-3">
                      {deviceNotifications.recentLogins.map((login, index) => (
                        <div key={`${login.deviceId}-${login.createdAt}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                          <p>IP: <span className="font-medium text-white">{login.ipAddress || "Không xác định"}</span></p>
                          <p className="mt-1 break-words">{login.userAgent || "Không xác định thiết bị"}</p>
                          <p className="mt-1 text-xs text-slate-400">{new Date(login.createdAt).toLocaleString("vi-VN")}</p>
                        </div>
                      ))}
                      {!deviceNotifications.recentLogins.length && (
                        <p className="text-sm text-slate-400">Chưa có lịch sử đăng nhập.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeMenu === "Ví" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-5">
                <p className="text-sm uppercase tracking-[0.18em] text-red-300">Số nợ</p>
                <p className="mt-2 text-3xl font-bold text-red-100">{(wallet?.debt ?? 0).toLocaleString("vi-VN")} VND</p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5">
                  <button type="button" onClick={handleDailyBonus} disabled={loading} className="w-full text-left transition disabled:opacity-50">
                    <p className="text-sm text-amber-200">Daily</p>
                    <p className="mt-2 text-2xl font-bold text-white">+50.000 VND</p>
                    <p className="mt-2 text-sm text-slate-300">Nhận mỗi ngày, reset 00:00 ngày mai.</p>
                  </button>
                </div>

                <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-5">
                  <button type="button" onClick={handleBorrow} disabled={loading} className="w-full text-left transition disabled:opacity-50">
                    <p className="text-sm text-red-200">Vay nợ</p>
                    <p className="mt-2 text-2xl font-bold text-white">+50.000 VND</p>
                    <p className="mt-2 text-sm text-slate-300">Tối đa 2.000.000 VND tiền nợ.</p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleNewUserDaily}
                  disabled={loading || (wallet?.newbieStep ?? 0) >= 7}
                  className="rounded-2xl border border-violet-400/40 bg-violet-500/10 p-5 text-left transition hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm text-violet-200">Daily người mới</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {(wallet?.newbieStep ?? 0) >= 7
                      ? "Hoàn thành"
                      : `+${[300000, 200000, 100000, 100000, 100000, 100000, 100000][wallet?.newbieStep ?? 0].toLocaleString("vi-VN")} VND`}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {wallet && wallet.newbieStep >= 7
                      ? "Bạn đã hoàn tất 7 ngày."
                      : "Ngày 1: 300k • Ngày 2: 200k • Ngày 3-7: 100k"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => void handleQuickRepay("half")}
                  disabled={loading || !wallet?.debt}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-left transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm text-emerald-200">Trả nửa nợ</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {wallet?.debt ? `${Math.ceil(wallet.debt / 2).toLocaleString("vi-VN")} VND` : "0 VND"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">Thanh toán một nửa khoản nợ hiện tại.</p>
                </button>

                <button
                  type="button"
                  onClick={() => void handleQuickRepay("all")}
                  disabled={loading || !wallet?.debt}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-left transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-sm text-emerald-200">Trả hết nợ</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {(wallet?.debt ?? 0).toLocaleString("vi-VN")} VND
                  </p>
                  <p className="mt-2 text-sm text-slate-300">Thanh toán toàn bộ khoản nợ hiện tại.</p>
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

              </div>

              {message && <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
            </div>
          ) : activeMenu === "Khuyến mãi" ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300 shadow-2xl">
              tính năng này đang trong thời gian phát triển
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
                  <a href="https://hy88-pi.vercel.app/" target="_blank" rel="noreferrer" className="mt-3 block text-xl font-semibold text-white underline decoration-cyan-400/70 underline-offset-4">
                    https://hy88-pi.vercel.app/
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
                <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88</p>
                <h1 className="mt-3 text-4xl font-bold">Xin chào, {session.user?.name || "Người chơi"}</h1>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Bảng xếp hạng</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Top người chơi</h2>
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
        {isBalanceHistoryOpen && <BalanceHistoryModal onClose={closeBalanceHistory} />}
        <SimulationDisclaimer />
        </main>
      </DeviceAccessGate>
    );
  }

  return (
    <DeviceAccessGate>
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#392719,_#09070a_60%)] px-4">
        <div className="auth-shell w-full max-w-md">
        <div className="auth-card rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="relative mb-6 rounded-full bg-slate-800 p-1 ring-1 ring-white/10">
            <div
              className={`auth-mode-indicator absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-amber-400 transition-transform duration-300 ease-out ${mode === "login" ? "translate-x-0" : "translate-x-full"}`}
            />
            <div className="relative z-10 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`relative z-10 flex-1 rounded-full px-4 py-2 font-medium transition-colors duration-200 ${mode === "login" ? "text-slate-950" : "text-slate-300"}`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`relative z-10 flex-1 rounded-full px-4 py-2 font-medium transition-colors duration-200 ${mode === "signup" ? "text-slate-950" : "text-slate-300"}`}
              >
                Đăng ký
              </button>
            </div>
          </div>

          <h1 className="mb-6 text-3xl font-bold text-white">HY88</h1>

          {mode === "signup" && (
            <div className="space-y-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="auth-field w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition duration-200 placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  type={showPassword ? "text" : "password"}
                  className="auth-field w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 pr-16 text-white outline-none transition duration-200 placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-3 text-sm text-slate-300 hover:text-white"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
              <div className="relative">
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu"
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-field w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 pr-16 text-white outline-none transition duration-200 placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-3 text-sm text-slate-300 hover:text-white"
                >
                  {showConfirmPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
              <button type="button" onClick={handleSignup} disabled={loading} className="auth-btn w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
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
                className="auth-field w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition duration-200 placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  type={showPassword ? "text" : "password"}
                  className="auth-field w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 pr-16 text-white outline-none transition duration-200 placeholder:text-slate-400 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-3 text-sm text-slate-300 hover:text-white"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
              <button type="button" onClick={handleCredentialsLogin} disabled={loading} className="auth-btn w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
          )}

          {message && <p className="auth-message mt-4 text-sm text-amber-300">{message}</p>}
        </div>
        </div>
        <SimulationDisclaimer />
      </main>
    </DeviceAccessGate>
  );
}
