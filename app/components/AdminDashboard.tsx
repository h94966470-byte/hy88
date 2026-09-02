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
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = (await response.json()) as { users?: AdminUser[]; error?: string };
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
  }, []);

  const adjustBalance = async (userId: string, direction: 1 | -1) => {
    const amount = Number(amounts[userId]);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setMessage("Nhập số tiền hợp lệ trước khi điều chỉnh.");
      return;
    }
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount: amount * direction }),
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88 Admin</p>
            <h1 className="mt-2 text-4xl font-bold">Quản lý số dư</h1>
          </div>
          <button type="button" onClick={() => void loadUsers()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
            Làm mới
          </button>
        </div>

        {message && <p className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</p>}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-4">Tài khoản</th>
                <th className="px-4 py-4 text-right">Số dư</th>
                <th className="px-4 py-4 text-right">Nợ</th>
                <th className="px-4 py-4 text-right">Ván</th>
                <th className="px-4 py-4 text-right">Thắng</th>
                <th className="px-4 py-4 text-right">Thua</th>
                <th className="px-4 py-4">Điều chỉnh</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-4 font-semibold">{user.username} {user.role === "admin" && <span className="ml-2 text-xs text-amber-300">ADMIN</span>}</td>
                  <td className="px-4 py-4 text-right font-semibold text-emerald-300">{user.balance.toLocaleString("vi-VN")} VND</td>
                  <td className="px-4 py-4 text-right text-red-300">{user.debt.toLocaleString("vi-VN")} VND</td>
                  <td className="px-4 py-4 text-right">{user.rounds}</td>
                  <td className="px-4 py-4 text-right text-emerald-300">{user.wins}</td>
                  <td className="px-4 py-4 text-right text-red-300">{user.losses}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <input type="number" min="1" value={amounts[user.id] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [user.id]: event.target.value }))} placeholder="Số tiền" className="w-32 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white" />
                      <button type="button" onClick={() => void adjustBalance(user.id, 1)} disabled={loading} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-emerald-200">Cộng</button>
                      <button type="button" onClick={() => void adjustBalance(user.id, -1)} disabled={loading} className="rounded-lg bg-red-500/20 px-3 py-2 text-red-200">Trừ</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !users.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Chưa có tài khoản.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
