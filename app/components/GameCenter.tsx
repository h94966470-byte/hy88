"use client";

import { useState } from "react";

type GameResult = {
  dice: number[];
  total: number;
  result: "tai" | "xiu" | "cau" | "khong" | null;
  playerChoice: string | null;
  won: boolean;
  profit: number;
};

const INTEREST_RATE = 0.2;
const MULTIPLIER_ALL = 2.0;
const MULTIPLIER_HALF = 1.5;

interface GameCenterProps {
  wallet: {
    balance: number;
    debt: number;
    dailyClaimDate: string | null;
    newbieStep: number;
    newbieDailyClaimDate: string | null;
    createdAt: string;
  } | null;
  onWalletUpdate: (newBalance: number, newDebt: number) => void;
}

export default function GameCenter({ wallet, onWalletUpdate }: GameCenterProps) {
  const [activeGame, setActiveGame] = useState<"taixiu" | "cau">("taixiu");
  const [betAmount, setBetAmount] = useState("");
  const [betType, setBetType] = useState<"custom" | "half" | "all">("custom");
  const [playing, setPlaying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [message, setMessage] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  if (!wallet) return null;

  const actualBalance = wallet.balance;
  const maxBetAmount =
    betType === "all" ? actualBalance : betType === "half" ? Math.max(1, Math.floor(actualBalance / 2)) : Number(betAmount) || 0;

  const rollGame = async (choice: string, isDiceCount: number = 2) => {
    if (!betAmount && betType === "custom") {
      setMessage("Nhập số tiền cược");
      return;
    }

    const amount = betType === "all" ? actualBalance : betType === "half" ? Math.floor(actualBalance / 2) : Number(betAmount);
    if (!amount || amount <= 0 || amount > actualBalance) {
      setMessage("Số tiền cược không hợp lệ");
      return;
    }

    setRolling(true);
    setMessage("");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    let dice: number[] = [];
    let total = 0;
    let result: "tai" | "xiu" | "cau" | "khong" | null = null;

    if (isDiceCount === 2) {
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      dice = [dice1, dice2];
      total = dice1 + dice2;
      result = total > 10 ? "tai" : "xiu";
    } else {
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const dice3 = Math.floor(Math.random() * 6) + 1;
      dice = [dice1, dice2, dice3];
      total = dice1 + dice2 + dice3;
      result = total >= 11 ? "cau" : "khong";
    }

    let interestDebt = wallet.debt > 0 ? Math.floor(wallet.debt * INTEREST_RATE) : 0;
    let won = false;
    let multiplier = betType === "all" ? MULTIPLIER_ALL : betType === "half" ? MULTIPLIER_HALF : 1.0;

    if (result === choice) {
      won = true;
    }

    let profit = won ? Math.floor(amount * multiplier) : -amount;
    let newBalance = actualBalance + profit;
    let newDebt = wallet.debt + interestDebt;

    if (newBalance < 0) {
      newDebt += Math.abs(newBalance);
      newBalance = 0;
    }

    onWalletUpdate(newBalance, newDebt);

    setGameResult({
      dice,
      total,
      result,
      playerChoice: choice,
      won,
      profit,
    });

    setRolling(false);
    setMessage(
      won
        ? `Bạn thắng! Lãi ${profit.toLocaleString("vi-VN")} VND${interestDebt > 0 ? ` (Lãi nợ: ${interestDebt} K)` : ""}`
        : `Bạn thua ${Math.abs(profit).toLocaleString("vi-VN")} VND${interestDebt > 0 ? ` (Lãi nợ: ${interestDebt} K)` : ""}`
    );
    setPlaying(false);
  };

  const handleRepay = () => {
    if (!repayAmount || wallet.debt <= 0) {
      setMessage("Nhập số tiền trả nợ hợp lệ");
      return;
    }

    const amount = Number(repayAmount);
    if (amount <= 0 || amount > actualBalance || amount > wallet.debt) {
      setMessage("Số tiền trả nợ không hợp lệ");
      return;
    }

    onWalletUpdate(actualBalance - amount, wallet.debt - amount);
    setRepayAmount("");
    setMessage(`Đã trả nợ ${amount.toLocaleString("vi-VN")} VND`);
  };

  const handleBorrow = () => {
    const newBalance = actualBalance + 50;
    const newDebt = wallet.debt + 50;
    onWalletUpdate(newBalance, newDebt);
    setMessage("Vay 50K VND thành công");
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
      <div className="mb-8 flex gap-4">
        <button
          onClick={() => {
            setActiveGame("taixiu");
            setGameResult(null);
            setBetAmount("");
            setMessage("");
          }}
          className={`flex-1 rounded-2xl border px-6 py-3 font-bold transition ${
            activeGame === "taixiu"
              ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
              : "border-slate-500/40 bg-slate-800/50 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Tai Xiu
        </button>
        <button
          onClick={() => {
            setActiveGame("cau");
            setGameResult(null);
            setBetAmount("");
            setMessage("");
          }}
          className={`flex-1 rounded-2xl border px-6 py-3 font-bold transition ${
            activeGame === "cau"
              ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
              : "border-slate-500/40 bg-slate-800/50 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Cau
        </button>
      </div>

      <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-emerald-300 uppercase">Số dư</p>
            <p className="mt-1 text-2xl font-bold text-white">{actualBalance.toLocaleString("vi-VN")}</p>
          </div>
          <div>
            <p className="text-xs text-red-300 uppercase">Nợ</p>
            <p className="mt-1 text-2xl font-bold text-white">{wallet.debt.toLocaleString("vi-VN")}</p>
          </div>
          <div>
            <p className="text-xs text-blue-300 uppercase">Cọc</p>
            <p className="mt-1 text-2xl font-bold text-white">{(actualBalance - wallet.debt).toLocaleString("vi-VN")}</p>
          </div>
        </div>
      </div>

      {!playing && !gameResult ? (
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Nhap tien cuoc (K)</label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Vi du: 10"
              disabled={betType !== "custom"}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none disabled:opacity-50"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              onClick={() => setBetType("custom")}
              className={`rounded-xl border px-4 py-2 font-bold transition ${
                betType === "custom" ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
              }`}
            >
              Tuy chi ({betAmount || "0"}K)
            </button>
            <button
              onClick={() => setBetType("half")}
              className={`rounded-xl border px-4 py-2 font-bold transition ${
                betType === "half" ? "border-blue-400/60 bg-blue-500/20 text-blue-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
              }`}
            >
              Nua ({Math.floor(actualBalance / 2)}K) x{MULTIPLIER_HALF}
            </button>
            <button
              onClick={() => setBetType("all")}
              className={`rounded-xl border px-4 py-2 font-bold transition ${
                betType === "all" ? "border-red-400/60 bg-red-500/20 text-red-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
              }`}
            >
              All ({actualBalance}K) x{MULTIPLIER_ALL}
            </button>
          </div>

          {activeGame === "taixiu" && (
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => {
                  setPlaying(true);
                  rollGame("tai");
                }}
                disabled={rolling || !betAmount && betType === "custom"}
                className="rounded-2xl border border-red-400/40 bg-red-500/10 px-6 py-4 font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                Tai (&gt;10)
              </button>
              <button
                onClick={() => {
                  setPlaying(true);
                  rollGame("xiu");
                }}
                disabled={rolling || !betAmount && betType === "custom"}
                className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-6 py-4 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
              >
                Xiu (&lt;=10)
              </button>
            </div>
          )}

          {activeGame === "cau" && (
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => {
                  setPlaying(true);
                  rollGame("cau", 3);
                }}
                disabled={rolling || !betAmount && betType === "custom"}
                className="rounded-2xl border border-violet-400/40 bg-violet-500/10 px-6 py-4 font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                Cau (&gt;=11)
              </button>
              <button
                onClick={() => {
                  setPlaying(true);
                  rollGame("khong", 3);
                }}
                disabled={rolling || !betAmount && betType === "custom"}
                className="rounded-2xl border border-orange-400/40 bg-orange-500/10 px-6 py-4 font-bold text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-50"
              >
                Khong (&lt;11)
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBorrow}
              disabled={wallet.debt > 100}
              className="flex-1 rounded-xl border border-blue-400/40 bg-blue-500/10 px-4 py-3 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              Vay 50K
            </button>
            {wallet.debt > 0 && (
              <div className="flex flex-1 gap-2">
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="Tien tra no"
                  className="flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-3 text-white outline-none"
                />
                <button
                  onClick={handleRepay}
                  className="rounded-xl border border-green-400/40 bg-green-500/10 px-4 py-3 font-bold text-green-200 transition hover:bg-green-500/20"
                >
                  Tra no
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {playing && rolling && (
        <div className="text-center space-y-6">
          <p className="text-sm text-slate-300">Dang giao xuc xac...</p>
          <div className="text-6xl animate-spin">*</div>
        </div>
      )}

      {gameResult && (
        <div className="text-center space-y-6">
          <div className="rounded-2xl border border-amber-500/50 bg-amber-500/20 p-6">
            <p className="text-3xl font-bold">
              {gameResult.dice.map((d) => d).join(" + ")} = {gameResult.total}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Ket qua: {gameResult.result === "tai" ? "TAI" : gameResult.result === "xiu" ? "XIU" : gameResult.result === "cau" ? "CAU" : "KHONG"}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-6 ${gameResult.won ? "border-emerald-500/50 bg-emerald-500/20" : "border-red-500/50 bg-red-500/20"}`}
          >
            <p className={`text-lg font-bold ${gameResult.won ? "text-emerald-200" : "text-red-200"}`}>
              {gameResult.won ? "THANG" : "THUA"}
            </p>
            <p className={`text-3xl font-bold mt-2 ${gameResult.won ? "text-emerald-300" : "text-red-300"}`}>
              {gameResult.won ? "+" : "-"}{Math.abs(gameResult.profit).toLocaleString("vi-VN")} K
            </p>
          </div>

          <button
            onClick={() => {
              setGameResult(null);
              setBetAmount("");
              setMessage("");
            }}
            className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            Choi lai
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
