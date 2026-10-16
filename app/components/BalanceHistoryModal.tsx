"use client";

import { useEffect, useState } from "react";

type BalanceHistory = {
  today: { spent: number; received: number };
  last7Days: { spent: number; received: number };
  last30Days: { spent: number; received: number };
  allTime: { spent: number; received: number };
  transactions: Array<{ id: number; amount: number; createdAt: string }>;
};

const periods: Array<{ key: keyof Pick<BalanceHistory, "today" | "last7Days" | "last30Days" | "allTime">; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "last7Days", label: "7 ngày qua" },
  { key: "last30Days", label: "30 ngày qua" },
  { key: "allTime", label: "Toàn thời gian" },
];

interface BalanceHistoryModalProps {
  onClose: () => void;
}

export default function BalanceHistoryModal({ onClose }: BalanceHistoryModalProps) {
  const [history, setHistory] = useState<BalanceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const response = await fetch("/api/wallet/history", { cache: "no-store" });
        const data = await response.json() as BalanceHistory & { error?: string };
        if (!response.ok) throw new Error(data.error || "Không thể tải biến động số dư.");
        if (!cancelled) setHistory(data);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Không thể tải biến động số dư.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadHistory();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const formatAmount = (amount: number) => `${amount.toLocaleString("vi-VN")} VND`;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-history-title"
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-400/30 bg-slate-950 p-5 text-white shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Ví HY88</p>
            <h2 id="balance-history-title" className="mt-2 text-2xl font-bold sm:text-3xl">Biến động số dư</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng biến động số dư"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Đóng
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-300">Đang tải lịch sử số dư...</p>
        ) : error ? (
          <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>
        ) : history ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {periods.map(({ key, label }) => {
                const period = history[key];
                const net = period.received - period.spent;
                return (
                  <article key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                    <h3 className="font-semibold text-amber-100">{label}</h3>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-400">Đã chi / khấu trừ</span>
                      <span className="font-semibold tabular-nums text-red-300">− {formatAmount(period.spent)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-400">Đã nhận / thắng</span>
                      <span className="font-semibold tabular-nums text-emerald-300">+ {formatAmount(period.received)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm">
                      <span className="text-slate-300">Chênh lệch ròng</span>
                      <span className={`font-bold tabular-nums ${net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {net > 0 ? "+" : net < 0 ? "−" : ""} {formatAmount(Math.abs(net))}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-7">
              <h3 className="font-semibold text-white">Giao dịch gần đây</h3>
              {history.transactions.length ? (
                <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
                  {history.transactions.map((transaction) => (
                    <li key={transaction.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <time className="text-sm text-slate-400">
                        {new Date(transaction.createdAt).toLocaleString("vi-VN")}
                      </time>
                      <span className={`shrink-0 font-semibold tabular-nums ${transaction.amount > 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {transaction.amount > 0 ? "+" : "−"} {formatAmount(Math.abs(transaction.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  Chưa có biến động số dư được ghi nhận.
                </p>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Lịch sử được ghi nhận từ khi tính năng theo dõi biến động số dư được bật; các thay đổi trước đó không có dữ liệu để thống kê.
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
