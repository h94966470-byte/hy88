"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  username: string;
  role: "user" | "admin";
  balance: number;
  debt: number;
  rounds: number;
  wins: number;
  losses: number;
  banned: boolean;
};

type GameStats = {
  total: number;
  wins: number;
  losses: number;
  tai: number;
  xiu: number;
  triple: number;
  pair: number;
  totalBet: number;
  single: number;
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [rateInput, setRateInput] = useState("");

  const fetchUsers = async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = (await response.json()) as { users?: AdminUser[]; error?: string };
    return { response, data };
  };

  const fetchStats = async () => {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    const data = (await response.json()) as { stats?: GameStats; error?: string };
    return { response, data };
  };

  const loadUsers = async () => {
    setLoading(true);
    const { response, data } = await fetchUsers();
    if (response.ok && data.users) setUsers(data.users);
    else setMessage(data.error || "Không thể tải danh sách tài khoản");
    setLoading(false);
  };

  useEffect(() => {
    const loadInitialUsers = async () => {
      const { response, data } = await fetchUsers();
      if (response.ok && data.users) setUsers(data.users);
      else setMessage(data.error || "Không thể tải danh sách tài khoản");
      setLoading(false);
    };

    void loadInitialUsers();
    const loadInitialStats = async () => {
      const { response, data } = await fetchStats();
      if (response.ok && data.stats) setStats(data.stats);
      else setMessage(data.error || "Không thể tải thống kê ván");
    };

    void loadInitialStats();
    const loadSettings = async () => {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = (await response.json()) as { customRate?: number | null; error?: string };
      if (response.ok && "customRate" in data) {
        setCustomRate(data.customRate ?? null);
        setRateInput(data.customRate === null || data.customRate === undefined ? "" : String(data.customRate * 100));
      } else {
        setMessage(data.error || "Không thể tải cấu hình tỷ lệ");
      }
    };

    void loadSettings();
  }, []);

  const handleSaveRate = async (newRate: number | null) => {
    if (newRate !== null && (!Number.isFinite(newRate) || newRate < 0 || newRate > 100)) {
      setMessage("Tỷ lệ phải nằm trong khoảng 0 đến 100");
      return;
    }
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newSuccessRate: newRate }),
    });
    const data = (await response.json()) as { customRate?: number | null; error?: string };
    if (!response.ok || !("customRate" in data)) {
      setMessage(data.error || "Không thể cập nhật tỷ lệ");
      return;
    }
    setCustomRate(data.customRate ?? null);
    setRateInput(data.customRate === null || data.customRate === undefined ? "" : String(data.customRate * 100));
    setMessage(data.customRate === null ? "Đã bật tỷ lệ tự động." : "Đã cập nhật tỷ lệ thành công.");
  };

  const adjust = async (userId: string, amount: number, action: "balance" | "debt") => {
    if (!Number.isSafeInteger(amount) || amount === 0) {
      setMessage("Nhập số tiền hợp lệ trước khi điều chỉnh.");
      return;
    }
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, action }),
    });
    const data = (await response.json()) as { wallet?: { balance: number; debt: number }; error?: string };
    if (!response.ok || !data.wallet) {
      setMessage(data.error || "Không thể cập nhật số dư");
      return;
    }
    setMessage(`Đã cập nhật số dư cho ${users.find((user) => user.id === userId)?.username || "tài khoản"}.`);
    setAmounts((current) => ({ ...current, [userId]: "" }));
    await loadUsers();
  };

  const adjustBalance = (userId: string, direction: 1 | -1) => adjust(userId, Number(amounts[`balance-${userId}`]) * direction, "balance");
  const adjustDebt = (userId: string, direction: 1 | -1) => adjust(userId, Number(amounts[`debt-${userId}`]) * direction, "debt");

  const toggleBan = async (user: AdminUser) => {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action: "ban", amount: user.banned ? 0 : 1 }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "Không thể cập nhật trạng thái tài khoản");
      return;
    }
    setMessage(user.banned ? `Đã mở khóa ${user.username}.` : `Đã khóa ${user.username}.`);
    await loadUsers();
  };

  const deleteAccount = async (user: AdminUser) => {
    if (user.role === "admin" || !window.confirm(`Bạn có chắc muốn xóa tài khoản ${user.username}? Dữ liệu ván chơi và ví cũng sẽ bị xóa.`)) return;

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "Không thể xóa tài khoản");
      return;
    }
    setMessage(`Đã xóa tài khoản ${user.username}.`);
    await loadUsers();
  };

  const runPlayerDataAction = async (user: AdminUser, action: "reset-balance" | "reset-debt" | "reset-player-data", confirmation: string, successMessage: string) => {
    if (user.role === "admin" || !window.confirm(confirmation)) return;
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId: user.id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "Không thể cập nhật dữ liệu người chơi");
      return;
    }
    setMessage(successMessage);
    await Promise.all([loadUsers(), fetchStats().then(({ response: statsResponse, data: statsData }) => {
      if (statsResponse.ok && statsData.stats) setStats(statsData.stats);
    })]);
  };

  const formatRate = (count: number, total: number) => total ? `${((count / total) * 100).toFixed(1)}%` : "0%";

  return (
    <main className="min-h-screen w-full bg-slate-950 px-2 py-8 text-white sm:px-4 lg:px-6">
      <div className="w-full max-w-none">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88 Admin</p>
            <h1 className="mt-2 text-4xl font-bold">Quản trị tài khoản</h1>
          </div>
          <button type="button" onClick={() => void loadUsers()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Làm mới
          </button>
        </div>

        {message && <p className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</p>}

        <section className="mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Tỷ lệ thắng hệ thống</h2>
              <p className="mt-1 text-sm text-slate-400">{customRate === null ? "Đang dùng thuật toán tự động" : `Đang dùng tỷ lệ tùy chỉnh: ${(customRate * 100).toFixed(2)}%`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="number" min="0" max="100" step="0.01" value={rateInput} onChange={(event) => setRateInput(event.target.value)} placeholder="0 - 100%" className="w-32 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white" />
              <button type="button" onClick={() => void handleSaveRate(rateInput === "" ? null : Number(rateInput))} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-emerald-200">Lưu tỷ lệ</button>
              <button type="button" onClick={() => void handleSaveRate(null)} className="rounded-lg bg-white/10 px-4 py-2 text-slate-200">Tự động</button>
            </div>
          </div>
        </section>

        {stats && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Tài", stats.tai, stats.total], ["Xỉu", stats.xiu, stats.total],
              ["Bộ ba", stats.triple, stats.total], ["Cặp", stats.pair, stats.total],
              ["Tổng điểm", stats.totalBet, stats.total], ["Số đơn lẻ", stats.single, stats.total],
              ["Thắng", stats.wins, stats.total], ["Thua", stats.losses, stats.total],
            ].map(([label, count, total]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-bold text-white">{count}</p>
                <p className="mt-1 text-xs text-slate-400">Tỷ lệ: {formatRate(Number(count), Number(total))}</p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Tài khoản</th>
                <th className="px-4 py-4 text-right">Số dư</th>
                <th className="px-4 py-4 text-right">Nợ</th>
                <th className="px-4 py-4 text-right">Ván</th>
                <th className="px-4 py-4 text-right">Thắng</th>
                <th className="px-4 py-4 text-right">Thua</th>
                <th className="px-4 py-4">Điều chỉnh số dư</th>
                <th className="px-4 py-4">Điều chỉnh nợ</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Dữ liệu người chơi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-4 font-semibold">{user.username} {user.role === "admin" && <span className="ml-2 text-xs text-amber-300">ADMIN</span>} {user.banned && <span className="ml-2 text-xs text-red-300">ĐÃ KHÓA</span>}</td>
                  <td className="px-4 py-4 text-right font-semibold text-emerald-300">{user.balance.toLocaleString("vi-VN")} VND</td>
                  <td className="px-4 py-4 text-right text-red-300">{user.debt.toLocaleString("vi-VN")} VND</td>
                  <td className="px-4 py-4 text-right">{user.rounds}</td>
                  <td className="px-4 py-4 text-right text-emerald-300">{user.wins}</td>
                  <td className="px-4 py-4 text-right text-red-300">{user.losses}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <input type="number" min="1" value={amounts[`balance-${user.id}`] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [`balance-${user.id}`]: event.target.value }))} placeholder="Số tiền" className="w-32 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white" />
                      <button type="button" onClick={() => void adjustBalance(user.id, 1)} disabled={loading} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-emerald-200">Cộng</button>
                      <button type="button" onClick={() => void adjustBalance(user.id, -1)} disabled={loading} className="rounded-lg bg-red-500/20 px-3 py-2 text-red-200">Trừ</button>
                    </div>
                  </td>
                  <td className="px-4 py-4"><div className="flex gap-2"><input type="number" min="1" value={amounts[`debt-${user.id}`] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [`debt-${user.id}`]: event.target.value }))} placeholder="Tiền nợ" className="w-28 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white" /><button type="button" onClick={() => void adjustDebt(user.id, 1)} disabled={loading} className="rounded-lg bg-amber-500/20 px-3 py-2 text-amber-200">Thêm</button><button type="button" onClick={() => void adjustDebt(user.id, -1)} disabled={loading} className="rounded-lg bg-cyan-500/20 px-3 py-2 text-cyan-200">Xóa</button></div></td>
                  <td className="px-4 py-4"><button type="button" onClick={() => void toggleBan(user)} disabled={loading || user.role === "admin"} className="rounded-lg bg-white/10 px-3 py-2 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">{user.banned ? "Unban" : "Ban"}</button></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void runPlayerDataAction(user, "reset-balance", `Đưa số dư của ${user.username} về 0?`, "Đã xoá số dư tài khoản.")} disabled={loading || user.role === "admin"} className="rounded-lg bg-red-500/20 px-3 py-2 text-red-200 disabled:cursor-not-allowed disabled:opacity-50">Xoá tiền</button><button type="button" onClick={() => void runPlayerDataAction(user, "reset-debt", `Đưa khoản nợ của ${user.username} về 0?`, "Đã xoá nợ tài khoản.")} disabled={loading || user.role === "admin"} className="rounded-lg bg-amber-500/20 px-3 py-2 text-amber-200 disabled:cursor-not-allowed disabled:opacity-50">Xoá nợ</button><button type="button" onClick={() => void runPlayerDataAction(user, "reset-player-data", `Reset toàn bộ dữ liệu của ${user.username}? Lịch sử ván sẽ bị xoá và ví về 100.000.`, "Đã reset dữ liệu tài khoản.")} disabled={loading || user.role === "admin"} className="rounded-lg bg-cyan-500/20 px-3 py-2 text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">Reset</button><button type="button" onClick={() => void deleteAccount(user)} disabled={loading || user.role === "admin"} className="rounded-lg bg-red-500/20 px-3 py-2 text-red-200 disabled:cursor-not-allowed disabled:opacity-50">Xóa TK</button></div></td>
                </tr>
              ))}
              {!loading && !users.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Chưa có tài khoản.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
