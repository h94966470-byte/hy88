export type TrackCondition = "fast" | "good" | "yielding" | "muddy";
export type RaceDistance = "sprint" | "endurance";
export type HorseBetType = "win" | "place" | "show";

export type RacingHorse = {
  number: number;
  name: string;
  form: string;
  weight: number;
  preferredTrack: "fast" | "yielding" | "muddy";
  preferredDistance: RaceDistance;
  color: string;
  baseAbility: number;
};

export type HorseRaceCard = {
  raceNumber: number;
  raceDate: string;
  trackName: string;
  condition: TrackCondition;
  distance: RaceDistance;
  horses: RacingHorse[];
  odds: Record<HorseBetType, number[]>;
};

export const horseBetTypes: Array<{ value: HorseBetType; label: string; places: number }> = [
  { value: "win", label: "Về nhất", places: 1 },
  { value: "place", label: "Về nhì / Top 2", places: 2 },
  { value: "show", label: "Về ba / Top 3", places: 3 },
];

const raceTracks = [
  { name: "Ascot", distance: "endurance" },
  { name: "Kentucky Downs", distance: "sprint" },
  { name: "Belmont Park", distance: "endurance" },
  { name: "Royal Ascot", distance: "sprint" },
  { name: "Churchill Downs", distance: "endurance" },
] as const;

const trackConditions: TrackCondition[] = ["fast", "good", "yielding", "muddy"];

export const horseEntries: RacingHorse[] = [
  { number: 1, name: "Ánh Chớp", form: "1-3-2-F-4", weight: 55, preferredTrack: "fast", preferredDistance: "sprint", color: "#f87171", baseAbility: 1.12 },
  { number: 2, name: "Bão Táp", form: "2-1-3-2-1", weight: 57, preferredTrack: "yielding", preferredDistance: "endurance", color: "#60a5fa", baseAbility: 1.08 },
  { number: 3, name: "Hắc Mã", form: "3-2-0-1-3", weight: 56, preferredTrack: "muddy", preferredDistance: "endurance", color: "#c084fc", baseAbility: 1.03 },
  { number: 4, name: "Sao Băng", form: "0-4-1-3-2", weight: 58, preferredTrack: "fast", preferredDistance: "sprint", color: "#34d399", baseAbility: 1 },
  { number: 5, name: "Thần Tốc", form: "P-3-2-0-1", weight: 59, preferredTrack: "yielding", preferredDistance: "endurance", color: "#fbbf24", baseAbility: 0.97 },
];

const formPoints: Record<string, number> = {
  "1": 1.18,
  "2": 1.1,
  "3": 1.02,
  "4": 0.94,
  "0": 0.88,
  F: 0.72,
  P: 0.62,
};

export const trackConditionLabels: Record<TrackCondition, string> = {
  fast: "Khô ráo / nhanh",
  good: "Tốt",
  yielding: "Ẩm / cầm chừng",
  muddy: "Bùn lầy",
};

export const preferredTrackLabels: Record<RacingHorse["preferredTrack"], string> = {
  fast: "Khô ráo / nhanh",
  yielding: "Ẩm / cầm chừng",
  muddy: "Bùn lầy",
};

export const distanceLabels: Record<RaceDistance, string> = {
  sprint: "Nước rút / cự ly ngắn",
  endurance: "Đường dài / sức bền",
};

export function getHorseRaceCard(raceNumber: number, now = new Date()): HorseRaceCard {
  if (!Number.isInteger(raceNumber) || raceNumber < 1 || raceNumber > raceTracks.length) {
    throw new Error("INVALID_RACE_NUMBER");
  }

  const raceDate = now.toISOString().slice(0, 10);
  const conditionSeed = `${raceDate}-${raceNumber}`.split("").reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  const race = raceTracks[raceNumber - 1];
  const condition = trackConditions[conditionSeed % trackConditions.length];
  const scores = getHorsePerformanceScores(condition, race.distance);
  const placeProbabilities = getPlaceProbabilities(scores);

  return {
    raceNumber,
    raceDate,
    trackName: race.name,
    condition,
    distance: race.distance,
    horses: horseEntries,
    odds: {
      win: placeProbabilities[0].map((probability) => oddsFromProbability(probability)),
      place: placeProbabilities[1].map((probability) => oddsFromProbability(probability)),
      show: placeProbabilities[2].map((probability) => oddsFromProbability(probability)),
    },
  };
}

export function getHorsePerformanceScores(
  condition: TrackCondition,
  distance: RaceDistance,
): number[] {
  return horseEntries.map((horse) => {
    const recentResults = horse.form.split("-").reverse();
    const formFactor = recentResults.reduce((total, result, index) => (
      total + (formPoints[result] ?? 0.8) * 0.6 ** index
    ), 0) / recentResults.reduce((total, _, index) => total + 0.6 ** index, 0);
    const matchesTrack = horse.preferredTrack === "fast"
      ? condition === "fast" || condition === "good"
      : horse.preferredTrack === condition;
    const trackFactor = matchesTrack ? 1.2 : 0.84;
    const distanceFactor = horse.preferredDistance === distance ? 1.16 : 0.82;
    const weightFactor = Math.max(0.78, 1 - (horse.weight - 55) * 0.018);
    return horse.baseAbility * formFactor * trackFactor * distanceFactor * weightFactor;
  });
}

export function getPlaceProbabilities(scores: number[]): [number[], number[], number[]] {
  const placeProbabilities: [number[], number[], number[]] = [
    Array(scores.length).fill(0),
    Array(scores.length).fill(0),
    Array(scores.length).fill(0),
  ];

  const visit = (remaining: number[], positions: number[], probability: number) => {
    if (positions.length === 3 || remaining.length === 0) return;
    const totalScore = remaining.reduce((total, index) => total + scores[index], 0);
    for (const horseIndex of remaining) {
      const nextProbability = probability * scores[horseIndex] / totalScore;
      placeProbabilities[positions.length][horseIndex] += nextProbability;
      visit(
        remaining.filter((index) => index !== horseIndex),
        [...positions, horseIndex],
        nextProbability,
      );
    }
  };

  visit(scores.map((_, index) => index), [], 1);
  for (let horseIndex = 0; horseIndex < scores.length; horseIndex += 1) {
    placeProbabilities[1][horseIndex] += placeProbabilities[0][horseIndex];
    placeProbabilities[2][horseIndex] += placeProbabilities[1][horseIndex];
  }
  return placeProbabilities;
}

export function getDecimalOdds(probability: number): number {
  return oddsFromProbability(probability);
}

function oddsFromProbability(probability: number): number {
  return Math.max(1.05, Math.round((0.92 / probability) * 100) / 100);
}

export function drawHorseRaceOrder(scores: number[], random: () => number): number[] {
  const remaining = scores.map((_, index) => index);
  const order: number[] = [];

  while (remaining.length) {
    const totalScore = remaining.reduce((total, index) => total + scores[index], 0);
    let choice = random() * totalScore;
    let selectedIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index += 1) {
      choice -= scores[remaining[index]];
      if (choice < 0) {
        selectedIndex = index;
        break;
      }
    }
    order.push(remaining.splice(selectedIndex, 1)[0]);
  }

  return order;
}
