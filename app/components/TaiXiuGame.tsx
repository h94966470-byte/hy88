"use client";

import { useState } from "react";

type GameResult = {
  dice1: number;
  dice2: number;
  total: number;
  result: "tai" | "xiu" | null;
  playerChoice: "tai" | "xiu" | null;
  won: boolean;
  profit: number;
};

interface TaiXiuGameProps {
  wallet: {
    balance: number;
    dailyClaimDate: string | null;
    newbieStep: number;
    newbieDailyClaimDate: string | null;
    createdAt: string;
  } | null;
  onWalletUpdate: (newBalance: number) => void;
}

export default function TaiXiuGame({ wallet, onWalletUpdate }: TaiXiuGameProps) {
  const [betAmount, setBetAmount] = useState("");
  const [playing, setPlaying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [message, setMessage] = useState("");

  const rollDice = async (choice: "tai" | "xiu") => {
    if (!wallet) return;

    const amount = Number(betAmount);
    if (!betAmount || amount <= 0 || amount > wallet.balance) {
      setMessage("Nhập số tiền cược hợp lệ");
      return;
    }

    setRolling(true);
    setMessage("");

    // Animate dice rolling
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;

    // Tài: > 10 (11, 12), Xỉu: < 11 (2-10)
    const result = total > 10 ? "tai" : "xiu";
    const won = result === choice;
    const profit = won ? amount : -amount;

    const newBalance = wallet.balance + profit;
    onWalletUpdate(newBalance);

    setGameResult({
      dice1,
      dice2,
      total,
      result,
      playerChoice: choice,
      won,
      profit,
    });

    setRolling(false);
    setMessage(
      won ? `🎉 Bạn thắng! Lãi ${amount.toLocaleString("vi-VN")} VND` : `😢 Bạn thua ${amount.toLocaleString("vi-VN")} VND`
    );
  };

  if (!wallet) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Tài Xỉu</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Cuộc chơi tài xỉu</h1>
      </div>

      <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
        <p className="text-sm text-emerald-200">Số dư ví</p>
        <p className="mt-2 text-3xl font-bold text-white">{wallet.balance.toLocaleString("vi-VN")} VND</p>
      </div>

      {!playing && !gameResult ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Nhập tiền cược (VND)</label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Ví dụ: 10000"
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setPlaying(true);
                rollDice("tai");
              }}
              disabled={rolling || !betAmount}
              className="rounded-2xl border border-red-400/40 bg-red-500/10 px-6 py-4 font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              🔴 TÀI (&gt;10)
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(true);
                rollDice("xiu");
              }}
              disabled={rolling || !betAmount}
              className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-6 py-4 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              🔵 XỈU (&lt;11)
            </button>
          </div>
        </div>
      ) : null}

      {playing && rolling && (
        <div className="text-center space-y-6">
          <p className="text-sm text-slate-300">Đang gieo xúc xắc...</p>
          <div className="flex justify-center gap-4">
            <div className="text-6xl animate-spin">🎲</div>
            <div className="text-6xl animate-spin" style={{ animationDelay: "0.2s" }}>
              🎲
            </div>
          </div>
        </div>
      )}

      {gameResult && (
        <div className="text-center space-y-6">
          <div className="flex justify-center gap-4">
            <div className="text-6xl">{gameResult.dice1 === 1 ? "⚫" : gameResult.dice1 === 2 ? "⚪⚪" : gameResult.dice1 === 3 ? "🎲" : gameResult.dice1 === 4 ? "⬜⬜⬜⬜" : gameResult.dice1 === 5 ? "🔴🔴🔴🔴🔴" : "⬜⬜⬜⬜⬜⬜"}</div>
            <div className="text-4xl self-center font-bold text-amber-300">+</div>
            <div className="text-6xl">{gameResult.dice2 === 1 ? "⚫" : gameResult.dice2 === 2 ? "⚪⚪" : gameResult.dice2 === 3 ? "🎲" : gameResult.dice2 === 4 ? "⬜⬜⬜⬜" : gameResult.dice2 === 5 ? "🔴🔴🔴🔴🔴" : "⬜⬜⬜⬜⬜⬜"}</div>
          </div>

          <div className={`rounded-2xl border p-6 ${gameResult.won ? "border-emerald-500/50 bg-emerald-500/20" : "border-red-500/50 bg-red-500/20"}`}>
            <p className="text-sm text-slate-300">Kết quả: {gameResult.result === "tai" ? "TÀI" : "XỈU"}</p>
            <p className="text-4xl font-bold mt-2">Tổng: {gameResult.total}</p>
          </div>

          <div className={`rounded-2xl border p-6 ${gameResult.won ? "border-emerald-400/40 bg-emerald-500/10" : "border-red-400/40 bg-red-500/10"}`}>
            <p className={`text-lg font-bold ${gameResult.won ? "text-emerald-200" : "text-red-200"}`}>
              {gameResult.won ? "🎉 THẮNG!" : "😢 THUA"}
            </p>
            <p className={`text-3xl font-bold mt-2 ${gameResult.won ? "text-emerald-300" : "text-red-300"}`}>
              {gameResult.won ? "+" : "-"}{Math.abs(gameResult.profit).toLocaleString("vi-VN")} VND
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setGameResult(null);
              setPlaying(false);
              setBetAmount("");
              setMessage("");
            }}
            className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            Chơi lại
          </button>
        </div>
      )}

      {message && (
        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
          {message}
        </p>
      )}
    </div>
  );
}
