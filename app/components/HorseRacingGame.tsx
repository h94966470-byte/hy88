"use client";

import { useEffect, useState } from "react";
import {
  distanceLabels,
  horseBetTypes,
  preferredTrackLabels,
  trackConditionLabels,
  type HorseBetType,
  type HorseRaceCard,
  type RacingHorse,
} from "@/lib/horse-racing";

type Wallet = {
  balance: number;
  debt: number;
};

type RaceOutcome = {
  wallet: Wallet;
  won: boolean;
  finishPosition: number;
  finishOrder: number[];
  odds: number;
  totalReturn: number;
  netProfit: number;
  race: HorseRaceCard;
};

type PreparedRace = Omit<RaceOutcome, "wallet"> & {
  pendingId: string;
};

type BetMode = "custom" | "half" | "all";

const raceNumbers = [1, 2, 3, 4, 5];

const formatMoney = (amount: number) => `${amount.toLocaleString("vi-VN")} VND`;

const formatFractionalOdds = (decimalOdds: number) => {
  let numerator = Math.round((decimalOdds - 1) * 100);
  let denominator = 100;
  let divisor = numerator;
  let remainder = denominator;
  while (remainder !== 0) {
    [divisor, remainder] = [remainder, divisor % remainder];
  }
  numerator /= divisor;
  denominator /= divisor;
  return `${numerator}/${denominator}`;
};

export default function HorseRacingGame({
  wallet,
  onWalletUpdate,
}: {
  wallet: Wallet | null;
  onWalletUpdate: (newBalance: number, newDebt: number) => Promise<boolean>;
}) {
  const [raceNumber, setRaceNumber] = useState(5);
  const [race, setRace] = useState<HorseRaceCard | null>(null);
  const [raceLoading, setRaceLoading] = useState(true);
  const [betMode, setBetMode] = useState<BetMode>("custom");
  const [customAmount, setCustomAmount] = useState("");
  const [betType, setBetType] = useState<HorseBetType>("win");
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [raceRunning, setRaceRunning] = useState(false);
  const [raceProgress, setRaceProgress] = useState(0);
  const [pendingRace, setPendingRace] = useState<PreparedRace | null>(null);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/horse-racing?race=${raceNumber}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { race?: HorseRaceCard; error?: string };
        if (!response.ok || !data.race) {
          throw new Error(data.error || "Không thể tải thông tin cuộc đua.");
        }
        if (!cancelled) {
          setRace(data.race);
          setRaceLoading(false);
        }
      })
      .catch((error: unknown) => {
        console.error("Load horse race card error:", error);
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Không thể tải thông tin cuộc đua.");
          setRaceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [raceNumber]);

  if (!wallet) return null;

  const selectedAmount = betMode === "all"
    ? wallet.balance
    : betMode === "half"
      ? Math.floor(wallet.balance / 2)
      : Number(customAmount);
  const validAmount = Number.isSafeInteger(selectedAmount) &&
    selectedAmount > 0 &&
    selectedAmount <= wallet.balance;
  const selectedHorseData = race?.horses.find((horse) => horse.number === selectedHorse) ?? null;
  const selectedOdds = race && selectedHorse
    ? race.odds[betType][selectedHorse - 1]
    : null;
  const estimatedReturn = selectedOdds && validAmount
    ? Math.floor(selectedAmount * selectedOdds)
    : null;
  const selectedBetLabel = horseBetTypes.find((item) => item.value === betType)?.label;
  const betControlsDisabled = submitting || raceRunning || Boolean(pendingRace);

  const selectBetMode = (mode: BetMode) => {
    setBetMode(mode);
    setMessage("");
  };

  const handleRaceChange = (value: string) => {
    const nextRaceNumber = Number(value);
    setRaceNumber(nextRaceNumber);
    setRaceLoading(true);
    setRace(null);
    setOutcome(null);
    setSelectedHorse(null);
    setMessage("");
  };

  const settlePendingRace = async (preparedRace: PreparedRace) => {
    setSubmitting(true);
    setMessage("");
    let response: Response;
    let data: Partial<RaceOutcome> & { error?: string };
    try {
      response = await fetch("/api/horse-racing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle", pendingId: preparedRace.pendingId }),
      });
      data = await response.json() as typeof data;
    } catch (error) {
      console.error("Settle horse racing bet error:", error);
      setMessage("Cuộc đua đã kết thúc nhưng chưa thể chốt kết quả. Bấm “Hoàn tất cuộc đua” để thử lại.");
      setRaceRunning(false);
      setSubmitting(false);
      return;
    }

    if (!response.ok || !data.wallet || typeof data.won !== "boolean" ||
        !data.finishOrder || typeof data.finishPosition !== "number" ||
        typeof data.odds !== "number" || typeof data.totalReturn !== "number" ||
        typeof data.netProfit !== "number") {
      setMessage(data.error || "Cuộc đua đã kết thúc nhưng chưa thể chốt kết quả. Bấm “Hoàn tất cuộc đua” để thử lại.");
      setRaceRunning(false);
      setSubmitting(false);
      return;
    }

    setOutcome({
      wallet: data.wallet,
      won: data.won,
      finishPosition: data.finishPosition,
      finishOrder: data.finishOrder,
      odds: data.odds,
      totalReturn: data.totalReturn,
      netProfit: data.netProfit,
      race: preparedRace.race,
    });
    setPendingRace(null);
    setRaceRunning(false);
    setSubmitting(false);
    await onWalletUpdate(data.wallet.balance, data.wallet.debt);
  };

  const confirmBet = async () => {
    if (!race || !selectedHorse || !validAmount || raceRunning || submitting) return;
    setSubmitting(true);
    setMessage("");
    setOutcome(null);
    setRaceProgress(0);

    let response: Response;
    let data: PreparedRace & { wallet?: Wallet; error?: string };
    try {
      response = await fetch("/api/horse-racing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          raceNumber,
          amount: selectedAmount,
          betType,
          horseNumber: selectedHorse,
        }),
      });
      data = await response.json() as typeof data;
    } catch (error) {
      console.error("Place horse racing bet error:", error);
      setMessage("Không thể kết nối để đặt cược. Vui lòng thử lại.");
      setSubmitting(false);
      return;
    }

    if (!response.ok || !data.pendingId || !data.race || !data.wallet || !data.finishOrder?.length) {
      setMessage(data.error || "Không thể đặt cược. Vui lòng kiểm tra lại số dư.");
      setSubmitting(false);
      return;
    }

    const preparedRace = data as PreparedRace;
    setRace(data.race);
    setPendingRace(preparedRace);
    setOutcome(null);
    await onWalletUpdate(data.wallet.balance, data.wallet.debt);
    setRaceRunning(true);
    await new Promise<void>((resolve) => {
      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min((now - startedAt) / 15000, 1);
        setRaceProgress(progress);
        if (progress === 1) {
          resolve();
        } else {
          window.requestAnimationFrame(animate);
        }
      };
      window.requestAnimationFrame(animate);
    });
    await settlePendingRace(preparedRace);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="rounded-3xl border border-amber-400/20 bg-slate-900/80 p-5 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">HY88 • Trường đua ảo</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Đua Ngựa</h1>
            <p className="mt-2 text-sm text-slate-300">Chọn cuộc đua, kiểu cược và ngựa dự đoán. Kết quả được xác định ở máy chủ.</p>
          </div>
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wider text-red-200">Số nợ</p>
            <p className="mt-1 font-bold tabular-nums text-white">{formatMoney(wallet.debt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8">
        <StepHeading number={1} title="Chọn cuộc đua" />
        <div className="grid gap-4 sm:grid-cols-[minmax(180px,240px)_1fr] sm:items-end">
          <label className="block text-sm font-semibold text-slate-200">
            Số cuộc đua
            <select
              value={raceNumber}
              onChange={(event) => handleRaceChange(event.target.value)}
              disabled={betControlsDisabled}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-400/60 disabled:opacity-60"
            >
              {raceNumbers.map((number) => (
                <option key={number} value={number}>Cuộc đua #{number}</option>
              ))}
            </select>
          </label>
          {raceLoading ? (
            <p className="text-sm text-slate-300">Đang tải thông tin cuộc đua...</p>
          ) : race ? (
            <div className="grid gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 sm:grid-cols-3">
              <RaceFact label="Trường đua" value={`#${race.raceNumber} · ${race.trackName}`} />
              <RaceFact label="Mặt sân" value={trackConditionLabels[race.condition]} />
              <RaceFact label="Cự ly" value={distanceLabels[race.distance]} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8">
        <StepHeading number={2} title="Chọn số tiền cược" />
        <div className="grid gap-3 sm:grid-cols-3">
          <AmountButton selected={betMode === "custom"} label="Tùy chỉnh" detail="Nhập số tiền" disabled={betControlsDisabled} onClick={() => selectBetMode("custom")} />
          <AmountButton selected={betMode === "half"} label="50% số dư" detail={formatMoney(Math.floor(wallet.balance / 2))} disabled={betControlsDisabled} onClick={() => selectBetMode("half")} />
          <AmountButton selected={betMode === "all"} label="Tất cả số dư" detail={formatMoney(wallet.balance)} disabled={betControlsDisabled} onClick={() => selectBetMode("all")} />
        </div>
        <label className="block max-w-xl text-sm font-semibold text-slate-200">
          Số tiền (VND)
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={betMode === "custom" ? customAmount : selectedAmount || ""}
            onChange={(event) => {
              setBetMode("custom");
              setCustomAmount(event.target.value);
            }}
            disabled={betMode !== "custom" || betControlsDisabled}
            placeholder="Ví dụ: 10.000"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none focus:border-amber-400/60 disabled:opacity-60"
          />
        </label>
        {!validAmount && (betMode !== "custom" || customAmount !== "") && (
          <p className="text-sm text-red-300" aria-live="polite">
            {selectedAmount > wallet.balance ? "Số dư không đủ cho mức cược này." : "Nhập số tiền cược nguyên dương."}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8">
        <StepHeading number={3} title="Chọn kiểu cược" />
        <div className="grid gap-3 md:grid-cols-3">
          {horseBetTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              aria-pressed={betType === type.value}
              disabled={betControlsDisabled}
              onClick={() => setBetType(type.value)}
              className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                betType === type.value
                  ? "border-amber-300/70 bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30"
                  : "border-white/10 bg-slate-950/40 text-slate-200 hover:border-amber-400/40"
              }`}
            >
              <span className="block font-bold">{type.label}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {type.value === "win" ? "Ngựa được chọn phải về nhất." : type.value === "place" ? "Ngựa được chọn về nhất hoặc nhì." : "Ngựa được chọn nằm trong top 3."}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8">
        <StepHeading number={4} title="Chọn ngựa" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {race?.horses.map((horse) => (
            <HorseFormCard
              key={horse.number}
              horse={horse}
              odds={race.odds[betType][horse.number - 1]}
              selected={selectedHorse === horse.number}
              disabled={betControlsDisabled}
              onSelect={() => {
                setSelectedHorse(horse.number);
                setMessage("");
              }}
            />
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          Chuỗi phong độ đọc từ trái sang phải, kết quả gần nhất nằm bên phải: 1 nhất · 2 nhì · 3 ba · 0 ngoài top 3 · F ngã · P bỏ cuộc.
        </p>
      </section>

      <section className="rounded-3xl border border-emerald-400/20 bg-slate-900/80 p-5 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Vòng đua 5 làn</p>
            <h2 className="mt-1 text-xl font-bold text-white">
              {race ? `Cuộc đua #${race.raceNumber} · ${race.trackName}` : "Đang chuẩn bị trường đua"}
            </h2>
          </div>
          {race && (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-100">
              Mặt sân: {trackConditionLabels[race.condition]}
            </span>
          )}
        </div>

        {race && (
          <OvalRaceTrack
            race={race}
            progress={raceProgress}
            finishOrder={outcome?.finishOrder ?? pendingRace?.finishOrder ?? null}
            running={raceRunning}
          />
        )}

        {raceRunning && (
          <p className="mt-4 animate-pulse text-center text-lg font-bold text-amber-200" aria-live="polite">
            Cuộc đua đang diễn ra... {Math.max(0, 15 - Math.floor(raceProgress * 15))} giây
          </p>
        )}

        {!raceRunning && outcome && (
          <div className={`mt-5 rounded-2xl border p-5 ${outcome.won ? "border-emerald-400/40 bg-emerald-500/10" : "border-red-400/30 bg-red-500/10"}`} aria-live="polite">
            <h3 className={`text-xl font-black ${outcome.won ? "text-emerald-200" : "text-red-200"}`}>
              {outcome.won ? "Bạn đã thắng!" : "Chưa may mắn lần này"}
            </h3>
            <p className="mt-2 text-sm text-slate-200">
              Thứ tự về đích: {outcome.finishOrder.map((number, index) => `#${number}${index < outcome.finishOrder.length - 1 ? " → " : ""}`)}
            </p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <RaceFact label="Ngựa chọn" value={`#${selectedHorse} · vị trí ${outcome.finishPosition}`} />
              <RaceFact label="Tỷ lệ cược" value={`${outcome.odds.toFixed(2)}x (${formatFractionalOdds(outcome.odds)}) · ${selectedBetLabel}`} />
              <RaceFact label="Tổng nhận / lãi ròng" value={`${formatMoney(outcome.totalReturn)} / ${formatMoney(outcome.netProfit)}`} />
            </div>
          </div>
        )}

        {selectedHorseData && validAmount && selectedOdds && !raceRunning && !outcome && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
            Cược {formatMoney(selectedAmount)} vào <span className="font-bold text-white">#{selectedHorseData.number} {selectedHorseData.name}</span>
            {" "}· {selectedBetLabel} · tỷ lệ {selectedOdds.toFixed(2)}x ({formatFractionalOdds(selectedOdds)})
            <p className="mt-1 text-slate-400">
              Nếu thắng: tổng nhận {formatMoney(estimatedReturn ?? 0)}, lãi ròng {formatMoney((estimatedReturn ?? 0) - selectedAmount)}.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (pendingRace) {
              void settlePendingRace(pendingRace);
              return;
            }
            if (outcome) {
              setOutcome(null);
              setRaceProgress(0);
              setMessage("");
              return;
            }
            void confirmBet();
          }}
          disabled={!race || raceLoading || (!pendingRace && !outcome && (!validAmount || !selectedHorse)) || submitting || raceRunning}
          className="mt-5 w-full rounded-xl border border-amber-300/50 bg-amber-500/20 px-5 py-4 text-lg font-black text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {raceRunning
            ? submitting && raceProgress >= 1 ? "Đang chốt kết quả..." : "Đang đua..."
            : submitting
              ? "Đang xác nhận cược..."
              : pendingRace
                ? "Hoàn tất cuộc đua"
                : outcome
                  ? "Chơi lại"
                  : "Xác nhận cược"}
        </button>
        {message && !outcome && <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100" aria-live="polite">{message}</p>}
      </section>
    </div>
  );
}

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold text-white">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/50 bg-amber-500/10 text-sm text-amber-200">{number}</span>
      {title}
    </h2>
  );
}

function RaceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function AmountButton({
  selected,
  label,
  detail,
  disabled,
  onClick,
}: {
  selected: boolean;
  label: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-amber-300/70 bg-amber-500/15 text-amber-100"
          : "border-white/10 bg-slate-950/40 text-slate-200 hover:border-amber-400/40"
      }`}
    >
      <span className="block font-bold">{label}</span>
      <span className="mt-1 block text-xs text-slate-400">{detail}</span>
    </button>
  );
}

function HorseFormCard({
  horse,
  odds,
  selected,
  disabled,
  onSelect,
}: {
  horse: RacingHorse;
  odds: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
        selected
          ? "border-amber-300/70 bg-amber-500/10 ring-1 ring-amber-300/30"
          : "border-white/10 bg-slate-950/40 hover:border-white/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-slate-950" style={{ backgroundColor: horse.color }}>#{horse.number}</span>
        <span className="text-right">
          <span className="block text-lg font-black text-amber-200">{odds.toFixed(2)}x</span>
          <span className="block text-[10px] font-semibold text-slate-400">({formatFractionalOdds(odds)})</span>
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-white">{horse.name}</h3>
      <dl className="mt-3 space-y-2 text-xs text-slate-300">
        <div className="flex justify-between gap-2"><dt>Phong độ</dt><dd className="font-mono font-bold text-white">{horse.form}</dd></div>
        <div className="flex justify-between gap-2"><dt>Trọng lượng kỵ sĩ + trang bị</dt><dd className="font-semibold text-white">{horse.weight} kg</dd></div>
        <div><dt className="text-slate-400">Sân sở trường</dt><dd className="mt-0.5 font-semibold text-white">{preferredTrackLabels[horse.preferredTrack]}</dd></div>
        <div><dt className="text-slate-400">Cự ly sở trường</dt><dd className="mt-0.5 font-semibold text-white">{distanceLabels[horse.preferredDistance]}</dd></div>
      </dl>
      <p className="mt-3 border-t border-white/10 pt-2 text-xs font-semibold text-amber-200">{selected ? "Đã chọn ngựa này" : "Chọn ngựa"}</p>
    </button>
  );
}

function getHorseProgress(progress: number, rank: number, horseNumber: number) {
  const targetProgress = getHorseFinishProgress(rank);
  const phase = horseNumber * 1.37 + rank * 0.71;
  const speedSwing = 0.82;
  const variedProgress = progress + (
    Math.cos(phase) - Math.cos(progress * Math.PI * 2 + phase)
  ) * speedSwing / (Math.PI * 2);
  return targetProgress * variedProgress;
}

function getHorseFinishProgress(rank: number) {
  return 1.04 + ((5 - rank) / 4) * 0.16;
}

function OvalRaceTrack({
  race,
  progress,
  finishOrder,
  running,
}: {
  race: HorseRaceCard;
  progress: number;
  finishOrder: number[] | null;
  running: boolean;
}) {
  const laneRadii = race.horses.map((_, index) => ({
    x: 310 - index * 34,
    y: 166 - index * 18,
  }));

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-2 sm:p-5">
      <svg
        viewBox="0 0 800 440"
        role="img"
        aria-label="Đường đua hình oval gồm năm làn đồng tâm"
        className="mx-auto block w-full max-w-4xl"
      >
        <defs>
          <linearGradient id="race-track-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#163c2e" />
            <stop offset="100%" stopColor="#0d291f" />
          </linearGradient>
          <filter id="race-horse-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.65" />
          </filter>
        </defs>

        <rect x="0" y="0" width="800" height="440" rx="26" fill="#090f0c" />
        <ellipse cx="400" cy="220" rx="332" ry="190" fill="#0b1b14" stroke="#b68a36" strokeWidth="3" />
        {laneRadii.map((radii, index) => (
          <g key={index}>
            <ellipse
              cx="400"
              cy="220"
              rx={radii.x}
              ry={radii.y}
              fill="none"
              stroke="url(#race-track-grass)"
              strokeWidth="31"
            />
            <ellipse
              cx="400"
              cy="220"
              rx={radii.x}
              ry={radii.y}
              fill="none"
              stroke="#a6c4a9"
              strokeOpacity="0.28"
              strokeWidth="1"
              strokeDasharray="7 9"
            />
          </g>
        ))}

        <ellipse cx="400" cy="220" rx="122" ry="74" fill="#101812" stroke="#c9a44d" strokeOpacity="0.6" strokeWidth="2" />
        <text x="400" y="211" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="800" letterSpacing="3">
          HY88
        </text>
        <text x="400" y="235" textAnchor="middle" fill="#cbd5c0" fontSize="11" fontWeight="700">
          {race.trackName.toUpperCase()}
        </text>

        {laneRadii.map((radii, index) => (
          <g key={`finish-${index}`}>
            <line
              x1="400"
              y1={220 - radii.y - 16}
              x2="400"
              y2={220 - radii.y + 16}
              stroke={index % 2 === 0 ? "#fff" : "#111"}
              strokeWidth="5"
            />
            <text
              x={400 + radii.x + 6}
              y="224"
              fill="#fde68a"
              fontSize="12"
              fontWeight="800"
            >
              {index + 1}
            </text>
          </g>
        ))}

        <text x="400" y="35" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="800" letterSpacing="2">
          VẠCH ĐÍCH
        </text>

        {race.horses.map((horse, index) => {
          const rank = finishOrder
            ? finishOrder.indexOf(horse.number) + 1
            : index + 1;
          const horseProgress = running && finishOrder
            ? getHorseProgress(progress, rank, horse.number)
            : finishOrder && progress >= 1
              ? getHorseFinishProgress(rank)
              : 0;
          const angle = -Math.PI / 2 + horseProgress * Math.PI * 2;
          const radii = laneRadii[index];
          const x = 400 + radii.x * Math.cos(angle);
          const y = 220 + radii.y * Math.sin(angle);
          const hasFinished = Boolean(finishOrder && !running && progress >= 1);

          return (
            <g
              key={horse.number}
              transform={`translate(${x} ${y})`}
              filter="url(#race-horse-shadow)"
            >
              {hasFinished && (
                <g transform="translate(0 -29)">
                  <circle r="10" fill="#fbbf24" stroke="#fff" strokeWidth="1.5" />
                  <text y="4" textAnchor="middle" fill="#111827" fontSize="11" fontWeight="900">
                    {rank}
                  </text>
                </g>
              )}
              <circle r="17" fill={horse.color} stroke="#fff" strokeOpacity="0.75" strokeWidth="2" />
              <text
                y="5"
                textAnchor="middle"
                fill="#111827"
                fontSize="14"
                fontWeight="900"
              >
                {horse.number}
              </text>
              <text x="20" y="5" fontSize="21" textAnchor="middle" aria-hidden="true">🏇</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-300">
        {(finishOrder && !running && progress >= 1
          ? finishOrder.map((number) => race.horses.find((horse) => horse.number === number)).filter((horse): horse is RacingHorse => Boolean(horse))
          : race.horses
        ).map((horse) => (
          <span key={horse.number} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: horse.color }} />
            #{horse.number} {horse.name}
            {finishOrder && !running && progress >= 1 && (
              <span className="font-bold text-amber-200">· Hạng {finishOrder.indexOf(horse.number) + 1}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
