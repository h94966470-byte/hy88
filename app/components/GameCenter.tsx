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

const secureRandomInt = (min: number, max: number) => {
  const range = max - min + 1;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return min + (values[0] % range);
};

type RoundPoint = {
  result: "tai" | "xiu";
  playerChoice: "tai" | "xiu";
  won: boolean;
};

interface GameCenterProps {
  wallet: {
    balance: number;
    debt: number;
    dailyClaimDate: string | null;
    newbieStep: number;
    newbieDailyClaimDate: string | null;
    createdAt: string;
  } | null;
  onWalletUpdate: (newBalance: number, newDebt: number) => Promise<boolean>;
}

export default function GameCenter({ wallet, onWalletUpdate }: GameCenterProps) {
  const [betAmount, setBetAmount] = useState("");
  const [betType, setBetType] = useState<"custom" | "half" | "all">("custom");
  const [playing, setPlaying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [message, setMessage] = useState("");
  const [roundHistory, setRoundHistory] = useState<RoundPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadRounds = async () => {
      const response = await fetch("/api/games", { cache: "no-store" });
      if (!cancelled && response.ok) {
        const data = (await response.json()) as { rounds: RoundPoint[] };
        setRoundHistory(data.rounds);
      }
    };

    void loadRounds();
    const refreshInterval = window.setInterval(() => {
      if (!document.hidden) void loadRounds();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, []);

  if (!wallet) return null;

  const actualBalance = wallet.balance;

  const rollGame = async (choice: "tai" | "xiu") => {
    if (!betAmount && betType === "custom") {
      setMessage("Nhập tiền cược");
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

    const targetResult = secureRandomInt(0, 1) === 0 ? "tai" : "xiu";
    let dice1 = secureRandomInt(1, 6);
    let dice2 = secureRandomInt(1, 6);
    let dice3 = secureRandomInt(1, 6);
    while ((dice1 + dice2 + dice3 > 10 ? "tai" : "xiu") !== targetResult) {
      dice1 = secureRandomInt(1, 6);
      dice2 = secureRandomInt(1, 6);
      dice3 = secureRandomInt(1, 6);
    }
    const dice = [dice1, dice2, dice3];
    const total = dice1 + dice2 + dice3;
    const result = targetResult;

    const interestDebt = wallet.debt > 0 ? Math.floor(wallet.debt * INTEREST_RATE) : 0;
    const won = result === choice;
    const multiplier = betType === "all" ? MULTIPLIER_ALL : betType === "half" ? MULTIPLIER_HALF : 1.0;

    const profit = won ? Math.floor(amount * multiplier) : -amount;
    let newBalance = actualBalance + profit;
    let newDebt = wallet.debt + interestDebt;

    if (newBalance < 0) {
      newDebt += Math.abs(newBalance);
      newBalance = 0;
    }

    const newRound: RoundPoint = { result, playerChoice: choice, won };
    const gameResponse = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newRound, balanceDelta: newBalance - actualBalance, debtDelta: newDebt - wallet.debt }),
    });
    const gameData = (await gameResponse.json()) as { wallet?: { balance: number; debt: number }; error?: string };
    if (!gameResponse.ok || !gameData.wallet) {
      setRolling(false);
      setPlaying(false);
      setMessage(gameData.error || "Không thể lưu kết quả ván chơi. Vui lòng thử lại.");
      return;
    }

    await onWalletUpdate(gameData.wallet.balance, gameData.wallet.debt);
    setRoundHistory((current) => [...current, newRound].slice(-100));

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
        ? `Bạn thắng! Lãi ${profit.toLocaleString("vi-VN")} K${interestDebt > 0 ? ` (Lãi nợ: ${interestDebt})` : ""}`
        : `Bạn thua ${Math.abs(profit).toLocaleString("vi-VN")} K${interestDebt > 0 ? ` (Lãi nợ: ${interestDebt})` : ""}`
    );
    setPlaying(false);
  };

  const chartPoints = roundHistory.map((round, index) => {
    const x = roundHistory.length === 1 ? 50 : (index / (roundHistory.length - 1)) * 100;
    const y = round.result === "tai" ? 22 : 78;
    return `${x},${y}`;
  });
  const chartPath = chartPoints.length > 1
    ? chartPoints.reduce((path, point, index) => {
        if (index === 0) return `M ${point}`;
        const [previousX, previousY] = chartPoints[index - 1].split(",");
        const [currentX, currentY] = point.split(",");
        const midpoint = (Number(previousX) + Number(currentX)) / 2;
        return `${path} Q ${midpoint},${previousY} ${currentX},${currentY}`;
      }, "")
    : chartPoints.length === 1
      ? `M 0,50 Q 50,${chartPoints[0].split(",")[1]} 100,50`
      : "M 0,50 C 20,12 30,88 50,50 S 80,12 100,50";

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {/* Game Area */}
      <div className="md:col-span-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Tài Xỉu</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Cuộc chơi Tài Xỉu</h1>
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
                <p className="text-xs text-blue-300 uppercase">Ván</p>
                <p className="mt-1 text-2xl font-bold text-white">{roundHistory.length}</p>
              </div>
            </div>
          </div>

          {!playing && !gameResult ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Nhập tiền cược (K)</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Ví dụ: 10"
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
                  Tùy chỉnh ({betAmount || "0"}K)
                </button>
                <button
                  onClick={() => setBetType("half")}
                  className={`rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "half" ? "border-blue-400/60 bg-blue-500/20 text-blue-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Nửa ({Math.floor(actualBalance / 2)}K) x{MULTIPLIER_HALF}
                </button>
                <button
                  onClick={() => setBetType("all")}
                  className={`rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "all" ? "border-red-400/60 bg-red-500/20 text-red-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Tất cả ({actualBalance}K) x{MULTIPLIER_ALL}
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
                  TÀI (&gt;10)
                </button>
                <button
                  onClick={() => {
                    setPlaying(true);
                    rollGame("xiu");
                  }}
                  disabled={rolling || !betAmount && betType === "custom"}
                  className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-6 py-4 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
                >
                  XỈU (&lt;=10)
                </button>
              </div>
            </div>
          ) : null}

          {playing && rolling && (
            <div className="text-center space-y-6">
              <p className="text-sm text-slate-300">Đang gieo xúc xắc...</p>
              <div className="text-6xl animate-spin">*</div>
            </div>
          )}

          {gameResult && (
            <div className="text-center space-y-6">
              <div className="rounded-2xl border border-amber-500/50 bg-amber-500/20 p-6">
                <p className="text-3xl font-bold">
                  {gameResult.dice[0]} + {gameResult.dice[1]} + {gameResult.dice[2]} = {gameResult.total}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Kết quả: {gameResult.result === "tai" ? "TÀI" : "XỈU"}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-6 ${gameResult.won ? "border-emerald-500/50 bg-emerald-500/20" : "border-red-500/50 bg-red-500/20"}`}
              >
                <p className={`text-lg font-bold ${gameResult.won ? "text-emerald-200" : "text-red-200"}`}>
                  {gameResult.won ? "THẮNG" : "THUA"}
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
      </div>

      {/* Shared round chart */}
      <div className="md:col-span-1">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl h-full flex flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-violet-300 mb-4">Biểu đồ các ván</p>

          <div className="relative w-full aspect-square flex items-center justify-center mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3">
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" role="img" aria-label="Biểu đồ hình sin kết quả các ván">
              <path d="M 0,50 H 100" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 3" />
              <path d={chartPath} fill="none" stroke="#c4b5fd" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              {chartPoints.slice(-20).map((point, index) => {
                const [x, y] = point.split(",");
                return <circle key={`${point}-${index}`} cx={x} cy={y} r="1.6" fill="#fbbf24" />;
              })}
            </svg>
          </div>

          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Phạm vi</span>
              <span className="text-violet-300 font-bold">Tất cả người chơi</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tổng số ván</span>
              <span className="font-bold text-white">{roundHistory.length}</span>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            TÀI ở đỉnh, XỈU ở đáy | Cập nhật theo từng ván
          </p>
        </div>
      </div>
    </div>
  );
}
