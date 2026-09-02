"use client";

import { useState, useEffect } from "react";

type GameResult = {
  dice: number[];
  total: number;
  result: "tai" | "xiu" | null;
  playerChoice: string | null;
  won: boolean;
  profit: number;
};

const INTEREST_RATE = 0.2;
const MULTIPLIER_ALL = 2.0;
const MULTIPLIER_HALF = 1.5;
const CAU_BASE = 100;

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
  const [betAmount, setBetAmount] = useState("");
  const [betType, setBetType] = useState<"custom" | "half" | "all">("custom");
  const [playing, setPlaying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [message, setMessage] = useState("");
  const [cau, setCau] = useState(CAU_BASE);
  const [rounds, setRounds] = useState(0);

  useEffect(() => {
    if (!wallet) return;
    const saved = localStorage.getItem(`hy88-cau-${wallet.balance}`);
    if (saved) {
      const data = JSON.parse(saved);
      setCau(data.cau);
      setRounds(data.rounds);
    }
  }, [wallet?.balance]);

  if (!wallet) return null;

  const actualBalance = wallet.balance;

  const rollGame = async (choice: "tai" | "xiu") => {
    if (!betAmount && betType === "custom") {
      setMessage("Nhap tien cuoc");
      return;
    }

    const amount = betType === "all" ? actualBalance : betType === "half" ? Math.floor(actualBalance / 2) : Number(betAmount);
    if (!amount || amount <= 0 || amount > actualBalance) {
      setMessage("So tien cuoc khong hop le");
      return;
    }

    setRolling(true);
    setMessage("");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice = [dice1, dice2];
    const total = dice1 + dice2;
    const result = total > 10 ? "tai" : "xiu";

    let interestDebt = wallet.debt > 0 ? Math.floor(wallet.debt * INTEREST_RATE) : 0;
    let won = result === choice;
    let multiplier = betType === "all" ? MULTIPLIER_ALL : betType === "half" ? MULTIPLIER_HALF : 1.0;

    let profit = won ? Math.floor(amount * multiplier) : -amount;
    let newBalance = actualBalance + profit;
    let newDebt = wallet.debt + interestDebt;
    let newCau = cau;

    if (newBalance < 0) {
      newDebt += Math.abs(newBalance);
      newBalance = 0;
    }

    if (won) {
      newCau = CAU_BASE;
    } else {
      newCau += Math.floor(amount * 0.1);
    }

    onWalletUpdate(newBalance, newDebt);
    setCau(newCau);
    setRounds(rounds + 1);

    localStorage.setItem(
      `hy88-cau-${newBalance}`,
      JSON.stringify({
        cau: newCau,
        rounds: rounds + 1,
      })
    );

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
        ? `Ban thang! Lai ${profit.toLocaleString("vi-VN")} K${interestDebt > 0 ? ` (Lai no: ${interestDebt})` : ""}`
        : `Ban thua ${Math.abs(profit).toLocaleString("vi-VN")} K${interestDebt > 0 ? ` (Lai no: ${interestDebt})` : ""}`
    );
    setPlaying(false);
  };

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {/* Game Area */}
      <div className="md:col-span-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Tai Xiu</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Cuoc choi tai xiu</h1>
          </div>

          <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-emerald-300 uppercase">So du</p>
                <p className="mt-1 text-2xl font-bold text-white">{actualBalance.toLocaleString("vi-VN")}</p>
              </div>
              <div>
                <p className="text-xs text-red-300 uppercase">No</p>
                <p className="mt-1 text-2xl font-bold text-white">{wallet.debt.toLocaleString("vi-VN")}</p>
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase">Van</p>
                <p className="mt-1 text-2xl font-bold text-white">{rounds}</p>
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
                  className={`rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "custom" ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Tuy chi ({betAmount || "0"}K)
                </button>
                <button
                  onClick={() => setBetType("half")}
                  className={`rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "half" ? "border-blue-400/60 bg-blue-500/20 text-blue-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Nua ({Math.floor(actualBalance / 2)}K) x{MULTIPLIER_HALF}
                </button>
                <button
                  onClick={() => setBetType("all")}
                  className={`rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "all" ? "border-red-400/60 bg-red-500/20 text-red-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  All ({actualBalance}K) x{MULTIPLIER_ALL}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => {
                    setPlaying(true);
                    rollGame("tai");
                  }}
                  disabled={rolling || !betAmount && betType === "custom"}
                  className="rounded-2xl border border-red-400/40 bg-red-500/10 px-6 py-4 font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  TAI (&gt;10)
                </button>
                <button
                  onClick={() => {
                    setPlaying(true);
                    rollGame("xiu");
                  }}
                  disabled={rolling || !betAmount && betType === "custom"}
                  className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-6 py-4 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
                >
                  XIU (&lt;=10)
                </button>
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
                  {gameResult.dice[0]} + {gameResult.dice[1]} = {gameResult.total}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Ket qua: {gameResult.result === "tai" ? "TAI" : "XIU"}
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
      </div>

      {/* Cau Display */}
      <div className="md:col-span-1">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl h-full flex flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-violet-300 mb-4">Cau hien tai</p>

          <div className="relative w-full aspect-square flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-violet-500/30 bg-violet-500/10"></div>
            <div className="text-5xl font-bold text-violet-300">{(cau / 1000).toFixed(1)}K</div>
          </div>

          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Trang thai</span>
              <span className="text-violet-300 font-bold">{cau > 500 ? "CAO" : "TRUNG"}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Muc do</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full ${i < Math.ceil((cau / 1000) * 5) ? "bg-violet-400" : "bg-slate-700"}`}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            +{Math.floor(50 * 0.1)}K moi van thua | Reset khi thang
          </p>
        </div>
      </div>
    </div>
  );
}
