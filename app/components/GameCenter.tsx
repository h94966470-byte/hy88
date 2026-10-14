"use client";

import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

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

type PendingBet = {
  amount: number;
  betType: "custom" | "half" | "all";
  wagerMode: WagerMode;
  selectedNumber: number;
  choice?: "tai" | "xiu";
  pendingId?: string;
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

function BowlCover({ onReveal, disabled = false }: { onReveal?: () => Promise<boolean>; disabled?: boolean }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const pointerStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || !onReveal) return;
    event.preventDefault();
    pointerStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || !onReveal) return;
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    setOffset({ x, y });

    const circle = event.currentTarget.parentElement?.getBoundingClientRect();
    const threshold = circle ? Math.min(circle.width, circle.height) / 2 : 90;
    if (Math.hypot(x, y) >= threshold) {
      pointerStart.current = null;
      setDragging(false);
      setRevealing(true);
      void onReveal().then((success) => {
        if (!success) {
          setRevealing(false);
          setOffset({ x: 0, y: 0 });
        }
      });
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerStart.current?.pointerId !== event.pointerId) return;
    pointerStart.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <button
      type="button"
      aria-label="Giữ và kéo bát lên để mở kết quả"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      disabled={disabled}
      className={`absolute inset-[5%] z-10 flex touch-none select-none flex-col items-center justify-center rounded-full border-4 border-amber-100/70 text-amber-50 shadow-[inset_0_8px_18px_rgba(255,255,255,0.55),inset_0_-18px_22px_rgba(0,0,0,0.65),0_12px_22px_rgba(0,0,0,0.65)] transition-[transform,opacity] duration-300 ease-out disabled:cursor-default disabled:opacity-100 ${dragging ? "cursor-grabbing duration-0" : "cursor-grab"} ${revealing ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        backgroundImage: "radial-gradient(ellipse at 35% 25%, #fff0b8 0%, #c8a66d 24%, #766044 58%, #32271e 100%)",
      }}
    >
      <span className="rounded-full border border-amber-50/60 bg-black/35 px-3 py-1 text-[9px] font-black tracking-[0.18em] sm:text-xs">
        GIỮ &amp; KÉO LÊN
      </span>
    </button>
  );
}

function TaiXiuBoard({
  onChoose,
  disabled,
  rolling,
  countdown,
  dice,
  result,
  bowlCovered,
  bowlInteractive,
  onReveal,
}: {
  onChoose?: (choice: "tai" | "xiu") => void;
  disabled?: boolean;
  rolling?: boolean;
  countdown?: number;
  dice: number[];
  result?: "tai" | "xiu" | null;
  bowlCovered?: boolean;
  bowlInteractive?: boolean;
  onReveal?: () => Promise<boolean>;
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

        <div className="relative flex aspect-square min-w-[6.5rem] flex-col items-center justify-center rounded-full border-2 border-amber-300/70 bg-slate-950/90 p-1 shadow-[0_0_24px_rgba(251,191,36,0.2)] sm:p-3">
          <div className="grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-0.5">
            {dice.slice(0, 3).map((value, index) => (
              <span key={index} className={index === 0 ? "col-span-2" : ""}>
                <Die value={value} rolling={rolling} />
              </span>
            ))}
          </div>
          {rolling && (
            bowlCovered && (countdown ?? 0) > 0 ? (
              <span aria-live="polite" className="absolute -top-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200/70 bg-slate-950/90 px-3 py-1 text-lg font-black tabular-nums text-amber-200 shadow-lg sm:text-2xl">
                {String(countdown ?? 0).padStart(2, "0")}
              </span>
            ) : (
              <span aria-live="polite" className="mt-1 text-lg font-black tabular-nums text-amber-200 sm:text-2xl">
                {String(countdown ?? 0).padStart(2, "0")}
              </span>
            )
          )}
          {!rolling && !bowlCovered && (
            <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-200 sm:text-[10px]">
              {result ? `Tổng ${dice.reduce((sum, die) => sum + die, 0)}` : "Sẵn sàng"}
            </span>
          )}
          {bowlCovered && <BowlCover onReveal={onReveal} disabled={!bowlInteractive} />}
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
  const [pendingBet, setPendingBet] = useState<PendingBet | null>(null);
  const [revealingResult, setRevealingResult] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [resultRevealed, setResultRevealed] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [roundHistory, setRoundHistory] = useState<RoundPoint[]>([]);
  const [historyBeforeRound, setHistoryBeforeRound] = useState<RoundPoint[] | null>(null);
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

  useEffect(() => {
    if (!isHistoryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHistoryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isHistoryOpen]);

  if (!wallet) return null;

  const actualBalance = wallet.balance;
  const historyForPanel = historyBeforeRound ?? roundHistory;

  const settleBet = async (bet: PendingBet): Promise<boolean> => {
    setRevealingResult(true);
    let gameResponse: Response;
    let gameData: {
      wallet?: { balance: number; debt: number };
      round?: RoundPoint;
      profit?: number;
      interestDebt?: number;
      error?: string;
    };
    try {
      gameResponse = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bet.pendingId
          ? { action: "settle", pendingId: bet.pendingId }
          : {
              amount: bet.amount,
              betType: bet.betType,
              wagerMode: bet.wagerMode,
              selectedNumber: bet.wagerMode === "tai-xiu" ? null : bet.selectedNumber,
              playerChoice: bet.choice ?? null,
            }),
      });
      gameData = await gameResponse.json() as typeof gameData;
    } catch {
      setRolling(false);
      setCountdown(0);
      setRevealingResult(false);
      setPlaying(bet.wagerMode === "tai-xiu");
      if (bet.wagerMode !== "tai-xiu") setHistoryBeforeRound(null);
      setMessage("Không thể kết nối để lưu kết quả ván chơi. Vui lòng thử lại.");
      return false;
    }
    if (!gameResponse.ok || !gameData.wallet || !gameData.round) {
      setRolling(false);
      setCountdown(0);
      setRevealingResult(false);
      setPlaying(bet.wagerMode === "tai-xiu");
      if (bet.wagerMode !== "tai-xiu") setHistoryBeforeRound(null);
      setMessage(gameData.error || "Không thể lưu kết quả ván chơi. Vui lòng thử lại.");
      return false;
    }

    const dice = gameData.round.dice ?? [];
    await onWalletUpdate(gameData.wallet.balance, gameData.wallet.debt);
    setRoundHistory((current) => [...current, gameData.round!].slice(-30));
    setHistoryBeforeRound(null);
    setTotalRounds((current) => current + 1);

    setGameResult({
      dice,
      total: gameData.round.total || 0,
      result: gameData.round.result,
      playerChoice: gameData.round.playerChoice,
      won: gameData.round.won,
      triple: dice[0] === dice[1] && dice[1] === dice[2],
      profit: gameData.profit || 0,
      wagerLabel: bet.wagerMode === "tai-xiu" ? bet.choice === "tai" ? "Cửa Tài" : "Cửa Xỉu" : `${bet.wagerMode} ${bet.selectedNumber}`,
      wagerMode: bet.wagerMode,
    });
    setResultRevealed(true);
    setPendingBet(null);
    setRolling(false);
    setRevealingResult(false);
    setMessage(bet.wagerMode === "tai-xiu"
      ? "Kéo bát lên để xem kết quả."
      : gameData.round.won
        ? `Bạn thắng! Lãi ${Math.max(0, gameData.profit || 0).toLocaleString("vi-VN")} K`
        : `Bạn thua. Mất ${bet.amount.toLocaleString("vi-VN")} K`);
    setPlaying(false);
    return true;
  };

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
    setGameResult(null);
    setHistoryBeforeRound(wagerMode === "tai-xiu" ? roundHistory : null);
    setResultRevealed(false);
    setRevealingResult(false);
    setIsHistoryOpen(false);
    setMessage("");

    const bet: PendingBet = {
      amount,
      betType,
      wagerMode,
      selectedNumber,
      choice,
    };
    setPendingBet(bet);

    if (wagerMode === "tai-xiu") {
      for (let remaining = 5; remaining > 0; remaining--) {
        setCountdown(remaining);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(0);
      try {
        const response = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            amount: bet.amount,
            betType: bet.betType,
            wagerMode: bet.wagerMode,
            selectedNumber: null,
            playerChoice: bet.choice,
          }),
        });
        const data = await response.json() as {
          id?: string;
          dice?: number[];
          error?: string;
        };
        if (!response.ok || !data.id || !data.dice || data.dice.length !== 3 ||
            data.dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
          setRolling(false);
          setPlaying(false);
          setPendingBet(null);
          setHistoryBeforeRound(null);
          setMessage(data.error || "Không thể chuẩn bị kết quả ván chơi. Vui lòng thử lại.");
          return;
        }
        setRollingDice(data.dice);
        setPendingBet({ ...bet, pendingId: data.id });
        setRolling(false);
        setMessage("Kéo bát ra khỏi vòng tròn để xem kết quả.");
      } catch {
        setRolling(false);
        setPlaying(false);
        setPendingBet(null);
        setHistoryBeforeRound(null);
        setMessage("Không thể kết nối để chuẩn bị kết quả ván chơi. Vui lòng thử lại.");
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await settleBet(bet);
  };

  const visibleHistory = historyForPanel.slice(-35);
  const chartPoints = visibleHistory.map((round, index) => {
    const x = visibleHistory.length === 1 ? 50 : (index / (visibleHistory.length - 1)) * 100;
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
    <div className="mx-auto w-full max-w-3xl">
      {/* Game Area */}
      <div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Tài Xỉu</p>
              <h1 className="mt-2 text-3xl font-bold text-white">Tài Xỉu</h1>
            </div>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label="Mở kết quả cầu"
              className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-500/20"
            >
              Cầu
            </button>
          </div>

          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-xs uppercase text-red-300">Số nợ</p>
            <p className="mt-1 text-xl font-bold text-white">{wallet.debt.toLocaleString("vi-VN")}</p>
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
                  Nửa số dư x{MULTIPLIER_HALF}
                </button>
                <button
                  type="button"
                  onClick={() => setBetType("all")}
                  style={{ animationDelay: "120ms" }}
                  className={`auth-field auth-btn rounded-xl border px-4 py-2 font-bold transition text-sm ${
                    betType === "all" ? "auth-btn-active border-red-400/60 bg-red-500/20 text-red-200" : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  Tất cả số dư x{MULTIPLIER_ALL}
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
                  disabled={playing || (!betAmount && betType === "custom")}
                  dice={[1, 3, 5]}
                />
              ) : <button
                type="button"
                onClick={() => {
                  void rollGame();
                }}
                disabled={playing || (!betAmount && betType === "custom")}
                className="w-full rounded-2xl border border-violet-400/40 bg-violet-500/10 px-6 py-4 font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                Đặt cược {wagerMode === "triple" ? "Bộ Ba" : wagerMode === "pair" ? "Cặp" : wagerMode === "total" ? "Tổng Điểm" : "Số Đơn Lẻ"}
              </button>}
            </div>
          ) : null}

          {playing && rolling && wagerMode === "tai-xiu" && (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold uppercase tracking-widest text-amber-200">Đang lắc xúc xắc</p>
              <TaiXiuBoard disabled rolling countdown={countdown} dice={rollingDice} bowlCovered />
            </div>
          )}

          {playing && !rolling && wagerMode === "tai-xiu" && pendingBet && (
            <div className="space-y-3">
              <p aria-live="polite" className="text-center text-sm font-semibold text-amber-200">
                {revealingResult
                  ? "Đang mở bát..."
                  : pendingBet.pendingId
                    ? "Kéo bát ra khỏi vòng tròn theo bất kỳ hướng nào."
                    : "Đang tính kết quả..."}
              </p>
              <TaiXiuBoard
                disabled
                dice={rollingDice}
                bowlCovered
                bowlInteractive={Boolean(pendingBet.pendingId) && !revealingResult}
                onReveal={pendingBet.pendingId ? () => settleBet(pendingBet) : undefined}
              />
            </div>
          )}

          {playing && rolling && wagerMode !== "tai-xiu" && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-300">Đang gieo xúc xắc...</p>
              <div className="text-6xl animate-spin">*</div>
            </div>
          )}

          {gameResult && (
            <div className="space-y-5 text-center">
              {gameResult.wagerMode === "tai-xiu" ? (
                <TaiXiuBoard
                  disabled
                  dice={gameResult.dice}
                  result={resultRevealed ? gameResult.result : null}
                  bowlCovered={!resultRevealed}
                  bowlInteractive={!resultRevealed}
                />
              ) : (
                <div className="rounded-2xl border border-amber-500/50 bg-amber-500/20 p-6">
                  <p className="text-2xl font-bold">
                    {gameResult.dice[0]} + {gameResult.dice[1]} + {gameResult.dice[2]} = {gameResult.total}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Kết quả: {gameResult.result === "tai" ? "TÀI" : "XỈU"}
                  </p>
                </div>
              )}

              {gameResult.wagerMode === "tai-xiu" && (
                <p
                  aria-live="polite"
                  className={`text-sm font-bold ${resultRevealed ? gameResult.won ? "text-emerald-300" : "text-red-300" : "text-amber-200"}`}
                >
                  {resultRevealed ? gameResult.won ? "THẮNG" : "THUA" : "Nhấn giữ và kéo bát lên để mở kết quả."}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setGameResult(null);
                  setResultRevealed(false);
                  setIsHistoryOpen(false);
                  setPendingBet(null);
                  setHistoryBeforeRound(null);
                  setBetAmount("");
                  setMessage("");
                }}
                className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20"
              >
                Chơi lại
              </button>
            </div>
          )}

          {message && !gameResult && (
            <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
              {message}
            </p>
          )}
        </div>
      </div>

      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setIsHistoryOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-history-title"
            className="max-h-[90vh] w-full max-w-5xl space-y-5 overflow-y-auto rounded-3xl border border-amber-300/40 bg-slate-900 p-5 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Cầu</p>
                <h2 id="game-history-title" className="mt-2 text-2xl font-bold text-white">Lịch sử kết quả</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Đóng lịch sử"
                className="rounded-lg border border-white/10 px-3 py-1 text-slate-300 hover:bg-white/10"
              >
                ×
              </button>
            </div>

            <div className="flex justify-between text-sm text-slate-400">
              <span>Kết quả các ván</span>
              <span className="font-bold text-white">{totalRounds} ván</span>
            </div>
            <div className="relative flex aspect-[1.6] items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3 sm:aspect-[2.4]">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Biểu đồ kết quả các ván">
                <path d="M 0,50 H 100" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 3" />
                <path d={chartPath} fill="none" stroke="#c4b5fd" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                {chartPoints.map((point, index) => {
                  const [x, y] = point.split(",");
                  return <circle key={`${point}-${index}`} cx={x} cy={y} r="1.6" fill="#fbbf24" />;
                })}
              </svg>
            </div>

            <p className="text-center text-xs text-slate-400">TÀI ở đỉnh · XỈU ở đáy</p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Xúc xắc</th>
                    <th className="px-3 py-2 text-right">Tổng</th>
                    <th className="px-3 py-2 text-right">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {[...historyForPanel].reverse().map((round, index) => (
                    <tr key={`${totalRounds - index}-${round.total}`} className="border-t border-white/5 text-slate-200">
                      <td className="px-3 py-2">{totalRounds - index}</td>
                      <td className="px-3 py-2">{round.dice?.join(" · ") || "—"}</td>
                      <td className="px-3 py-2 text-right">{round.total ?? "—"}</td>
                      <td className={`px-3 py-2 text-right font-bold ${round.result === "tai" ? "text-amber-300" : "text-cyan-300"}`}>
                        {round.result === "tai" ? "TÀI" : "XỈU"}
                      </td>
                    </tr>
                  ))}
                  {!historyForPanel.length && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                        Chưa có kết quả ván chơi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {gameResult && (gameResult.wagerMode !== "tai-xiu" || resultRevealed) && (
              <p className="text-center text-sm text-slate-300">
                Ván gần nhất: {gameResult.dice.join(" + ")} = {gameResult.total} · {gameResult.result === "tai" ? "TÀI" : "XỈU"}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
