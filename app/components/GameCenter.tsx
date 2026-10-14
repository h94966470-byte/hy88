"use client";

import { useState, useEffect } from "react";

type GameResult = {
  dice: number[];
  total: number;
  result: "tai" | "xiu" | null;
  playerChoice: string | null;
  won: boolean;
  profit: number;
  triple: boolean;
  wagerLabel: string;
  wagerMode: WagerMode;
};

const MULTIPLIER_ALL = 2.0;
const MULTIPLIER_HALF = 1.5;
const TRIPLE_MULTIPLIER = 150;
const PAIR_MULTIPLIER = 10;
const TOTAL_MULTIPLIER = 8;

type WagerMode = "tai-xiu" | "triple" | "pair" | "total" | "single";

type RoundPoint = {
  result: "tai" | "xiu";
  playerChoice: "tai" | "xiu";
  won: boolean;
  wagerMode?: "tai-xiu" | "triple" | "pair" | "total" | "single";
  selectedNumber?: number | null;
  total?: number;
  dice?: number[];
};

const diePips: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling = false }: { value: number; rolling?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Xúc xắc ${value}`}
      className={`grid h-8 w-8 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border border-red-200/40 p-1 shadow-lg shadow-black/40 sm:h-14 sm:w-14 sm:gap-1 sm:rounded-xl sm:p-2 ${rolling ? "animate-bounce" : ""}`}
      style={{ backgroundImage: "linear-gradient(135deg, #ff5364 0%, #db1732 55%, #8b071d 100%)" }}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={`rounded-full ${diePips[value]?.includes(index) ? "bg-white shadow-sm" : ""}`}
        />
      ))}
    </span>
  );
}

function TaiXiuBoard({
  onChoose,
  disabled,
  rolling,
  countdown,
  dice,
  result,
}: {
  onChoose?: (choice: "tai" | "xiu") => void;
  disabled?: boolean;
  rolling?: boolean;
  countdown?: number;
  dice: number[];
  result?: "tai" | "xiu" | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-950/30 p-3 shadow-inner shadow-black/20 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,1.2fr)_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => onChoose?.("tai")}
          disabled={disabled || !onChoose}
          aria-pressed={result === "tai"}
          className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-800 px-2 py-4 text-slate-950 shadow-lg shadow-black/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 sm:min-h-32 sm:px-4 ${result === "tai" ? "ring-2 ring-white ring-offset-2 ring-offset-amber-950" : ""}`}
        >
          <span className="text-xl font-black tracking-wider sm:text-3xl">TÀI</span>
          <span className="mt-1 text-xs font-semibold sm:text-sm">&gt; 10</span>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-widest sm:text-xs">
            {rolling ? "Đang lắc" : result === "tai" ? "Kết quả" : "Đặt cược"}
          </span>
        </button>

        <div className="flex aspect-square flex-col items-center justify-center rounded-full border-2 border-amber-300/70 bg-slate-950/90 p-1 shadow-[0_0_24px_rgba(251,191,36,0.2)] sm:p-3">
          {rolling ? (
            <>
              <div className="flex items-center justify-center gap-1">
                {dice.map((value, index) => <Die key={index} value={value} rolling />)}
              </div>
              <span aria-live="polite" className="mt-1 text-2xl font-black tabular-nums text-amber-200 sm:text-3xl">
                {String(countdown ?? 0).padStart(2, "0")}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1">
                {dice.map((value, index) => <Die key={index} value={value} />)}
              </div>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-200 sm:text-[10px]">
                {result ? `Tổng ${dice.reduce((sum, die) => sum + die, 0)}` : "Sẵn sàng"}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onChoose?.("xiu")}
          disabled={disabled || !onChoose}
          aria-pressed={result === "xiu"}
          className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-800 px-2 py-4 text-slate-950 shadow-lg shadow-black/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 sm:min-h-32 sm:px-4 ${result === "xiu" ? "ring-2 ring-white ring-offset-2 ring-offset-amber-950" : ""}`}
        >
          <span className="text-xl font-black tracking-wider sm:text-3xl">XỈU</span>
          <span className="mt-1 text-xs font-semibold sm:text-sm">&le; 10</span>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-widest sm:text-xs">
            {rolling ? "Đang lắc" : result === "xiu" ? "Kết quả" : "Đặt cược"}
          </span>
        </button>
      </div>
    </div>
  );
}

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
    const [wagerMode, setWagerMode] = useState<WagerMode>("tai-xiu");
    const [selectedNumber, setSelectedNumber] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [rollingDice, setRollingDice] = useState([2, 4, 6]);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [message, setMessage] = useState("");
  const [roundHistory, setRoundHistory] = useState<RoundPoint[]>([]);
  const [totalRounds, setTotalRounds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadRounds = async () => {
      const response = await fetch("/api/games", { cache: "no-store" });
      if (!cancelled && response.ok) {
        const data = (await response.json()) as { rounds: RoundPoint[]; totalRounds: number };
        setRoundHistory(data.rounds.slice(-30));
        setTotalRounds(data.totalRounds);
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

  useEffect(() => {
    if (!rolling || wagerMode !== "tai-xiu") return;
    const interval = window.setInterval(() => {
      setRollingDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 180);
    return () => window.clearInterval(interval);
  }, [rolling, wagerMode]);

  if (!wallet) return null;

  const actualBalance = wallet.balance;

  const rollGame = async (choice?: "tai" | "xiu") => {
    if (!betAmount && betType === "custom") {
      setMessage("Nhập tiền cược");
      return;
    }

    if (wagerMode === "tai-xiu" && !choice) return;

    const amount = betType === "all" ? actualBalance : betType === "half" ? Math.floor(actualBalance / 2) : Number(betAmount);
    if (!amount || amount <= 0 || amount > actualBalance) {
      setMessage("Số tiền cược không hợp lệ");
      return;
    }

    setPlaying(true);
    setRolling(true);
    setMessage("");

    if (wagerMode === "tai-xiu") {
      for (let remaining = 5; remaining > 0; remaining--) {
        setCountdown(remaining);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(0);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const gameResponse = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        betType,
        wagerMode,
        selectedNumber: wagerMode === "tai-xiu" ? null : selectedNumber,
        playerChoice: choice ?? null,
      }),
    });
    const gameData = (await gameResponse.json()) as {
      wallet?: { balance: number; debt: number };
      round?: RoundPoint;
      profit?: number;
      interestDebt?: number;
      error?: string;
    };
    if (!gameResponse.ok || !gameData.wallet || !gameData.round) {
      setRolling(false);
      setCountdown(0);
      setPlaying(false);
      setMessage(gameData.error || "Không thể lưu kết quả ván chơi. Vui lòng thử lại.");
      return;
    }

    const dice = gameData.round.dice ?? [];
    await onWalletUpdate(gameData.wallet.balance, gameData.wallet.debt);
    setRoundHistory((current) => [...current, gameData.round!].slice(-30));
    setTotalRounds((current) => current + 1);

    setGameResult({
      dice,
      total: gameData.round.total || 0,
      result: gameData.round.result,
      playerChoice: gameData.round.playerChoice,
      won: gameData.round.won,
      triple: dice[0] === dice[1] && dice[1] === dice[2],
      profit: gameData.profit || 0,
      wagerLabel: wagerMode === "tai-xiu" ? choice === "tai" ? "Cửa Tài" : "Cửa Xỉu" : `${wagerMode} ${selectedNumber}`,
      wagerMode,
    });

    setRolling(false);
    setMessage(
      dice[0] === dice[1] && dice[1] === dice[2] && wagerMode === "tai-xiu"
        ? `Bộ ba đồng nhất: cả Tài và Xỉu đều thua. Bạn mất ${amount.toLocaleString("vi-VN")} K`
        : gameData.round.won
          ? `Bạn thắng! Lãi ${Math.max(0, gameData.profit || 0).toLocaleString("vi-VN")} K`
          : `Bạn thua. Mất ${amount.toLocaleString("vi-VN")} K`
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(420px,1fr)]">
      {/* Game Area */}
      <div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Tài Xỉu</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Tài Xỉu</h1>
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
                <p className="mt-1 text-2xl font-bold text-white">{totalRounds}</p>
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
                  type="button"
                  onClick={() => setBetType("custom")}
                  style={{ animationDelay: "0ms" }}
                  className={`auth-field auth-btn rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "custom" ? "auth-btn-active border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Tùy chỉnh ({betAmount || "0"}K)
                </button>
                <button
                  type="button"
                  onClick={() => setBetType("half")}
                  style={{ animationDelay: "60ms" }}
                  className={`auth-field auth-btn rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "half" ? "auth-btn-active border-blue-400/60 bg-blue-500/20 text-blue-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Nửa ({Math.floor(actualBalance / 2)}K) x{MULTIPLIER_HALF}
                </button>
                <button
                  type="button"
                  onClick={() => setBetType("all")}
                  style={{ animationDelay: "120ms" }}
                  className={`auth-field auth-btn rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "all" ? "auth-btn-active border-red-400/60 bg-red-500/20 text-red-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Tất cả ({actualBalance}K) x{MULTIPLIER_ALL}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-5">
                {([
                  ["tai-xiu", "Tài / Xỉu"],
                  ["triple", "Bộ ba"],
                  ["pair", "Cặp"],
                  ["total", "Tổng điểm"],
                  ["single", "Số đơn lẻ"],
                ] as const).map(([mode, label], index) => (
                  <button
                    key={mode}
                    type="button"
                    style={{ animationDelay: `${index * 60}ms` }}
                    onClick={() => {
                      setWagerMode(mode);
                      if (mode === "total" && selectedNumber < 4) setSelectedNumber(4);
                      if (mode !== "total" && selectedNumber > 6) setSelectedNumber(1);
                    }}
                    className={`auth-field auth-btn rounded-xl border px-3 py-2 text-sm font-bold transition ${
                      wagerMode === mode
                        ? "auth-btn-active border-amber-400/60 bg-amber-500/20 text-amber-200"
                        : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {wagerMode !== "tai-xiu" && (
                <div className="space-y-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
                  <label className="block text-sm text-slate-300">
                    {wagerMode === "triple" ? "Chọn số cho Bộ Ba" : wagerMode === "pair" ? "Chọn số cho Cặp" : wagerMode === "total" ? "Chọn tổng điểm" : "Chọn số cần xuất hiện"}
                  </label>
                  <select
                    value={selectedNumber}
                    onChange={(event) => setSelectedNumber(Number(event.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none"
                  >
                    {(wagerMode === "total" ? Array.from({ length: 14 }, (_, index) => index + 4) : [1, 2, 3, 4, 5, 6]).map((number) => (
                      <option key={number} value={number}>{number}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-300">
                    {wagerMode === "triple" ? `Thưởng ${TRIPLE_MULTIPLIER}x nếu cả 3 viên là số ${selectedNumber}.` :
                      wagerMode === "pair" ? `Thưởng ${PAIR_MULTIPLIER}x nếu đúng 2 viên là số ${selectedNumber}.` :
                        wagerMode === "total" ? `Thưởng ${TOTAL_MULTIPLIER}x nếu tổng chính xác là ${selectedNumber}.` :
                          "Thưởng 1x, 2x hoặc 3x theo số lần xuất hiện."}
                  </p>
                </div>
              )}

              {wagerMode === "tai-xiu" ? (
                <TaiXiuBoard
                  onChoose={(choice) => {
                    void rollGame(choice);
                  }}
                  disabled={rolling || (!betAmount && betType === "custom")}
                  dice={[1, 3, 5]}
                />
              ) : <button
                type="button"
                onClick={() => {
                  void rollGame();
                }}
                disabled={rolling || (!betAmount && betType === "custom")}
                className="w-full rounded-2xl border border-violet-400/40 bg-violet-500/10 px-6 py-4 font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                Đặt cược {wagerMode === "triple" ? "Bộ Ba" : wagerMode === "pair" ? "Cặp" : wagerMode === "total" ? "Tổng Điểm" : "Số Đơn Lẻ"}
              </button>}
            </div>
          ) : null}

          {playing && rolling && (
                wagerMode === "tai-xiu" ? (
                  <div className="space-y-3">
                    <p className="text-center text-sm font-semibold uppercase tracking-widest text-amber-200">Đang lắc xúc xắc</p>
                    <TaiXiuBoard disabled rolling countdown={countdown} dice={rollingDice} />
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <p className="text-sm text-slate-300">Đang gieo xúc xắc...</p>
                    <div className="text-6xl animate-spin">*</div>
                  </div>
                )
              )}

              {gameResult && (
                <div className="text-center space-y-6">
                  {gameResult.wagerMode === "tai-xiu" ? (
                    <TaiXiuBoard disabled dice={gameResult.dice} result={gameResult.result} />
                  ) : (
                    <div className="rounded-2xl border border-amber-500/50 bg-amber-500/20 p-6">
                      <p className="text-3xl font-bold">
                        {gameResult.dice[0]} + {gameResult.dice[1]} + {gameResult.dice[2]} = {gameResult.total}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Kết quả: {gameResult.result === "tai" ? "TÀI" : "XỈU"}
                      </p>
                      <p className="mt-1 text-sm text-amber-200">Cược: {gameResult.wagerLabel}</p>
                    </div>
                  )}
                  {gameResult.wagerMode === "tai-xiu" && (
                    <p className="text-sm text-slate-300">
                      {gameResult.dice.join(" + ")} = {gameResult.total} · Cược: {gameResult.wagerLabel}
                    </p>
                  )}

              <div
                className={`rounded-2xl border p-6 ${gameResult.won ? "border-emerald-500/50 bg-emerald-500/20" : "border-red-500/50 bg-red-500/20"}`}
              >
                <p className={`text-lg font-bold ${gameResult.won ? "text-emerald-200" : "text-red-200"}`}>
                  {gameResult.triple && gameResult.wagerMode === "tai-xiu" ? "BỘ BA ĐỒNG NHẤT - THUA" : gameResult.won ? "THẮNG" : "THUA"}
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
      <div>
        <div className="h-full min-h-[520px] rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl flex flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-violet-300 mb-4">Biểu đồ các ván</p>

          <div className="relative w-full aspect-[1.6] flex items-center justify-center mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3">
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
              <span className="font-bold text-white">{totalRounds}</span>
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
