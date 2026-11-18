// 習熟度の計算（ブラウザ内に保存した解答記録から算出）
//
// 1 問ごとのスコア: 直近 3 回の正誤を 新しい順に 5:3:2 で重み付け（解答回数が少ないときは、ある分だけで正規化）
// 単元の習熟度 = 単元内の全問題のスコアの平均（未解答の問題は 0 点）
// 講座の習熟度 = 講座内の全問題のスコアの平均

export const WEIGHTS = [5, 3, 2];
const KEEP = 10; // 1 問あたり保存する解答記録の数
const STORAGE_KEY = "manabiba.progress.v1";

export function problemScore(attempts) {
  if (!attempts || attempts.length === 0) return 0;
  const recent = attempts.slice(-WEIGHTS.length).reverse(); // 新しい順
  let sum = 0;
  let total = 0;
  recent.forEach((a, i) => {
    sum += (a.correct ? 1 : 0) * WEIGHTS[i];
    total += WEIGHTS[i];
  });
  return sum / total;
}

export function levelOf(percent, attempted) {
  if (!attempted) return { label: "未学習", key: "none" };
  if (percent >= 80) return { label: "定着", key: "good" };
  if (percent >= 40) return { label: "学習中", key: "mid" };
  return { label: "要復習", key: "low" };
}

// problems: 対象の問題の配列, progress: { [problemId]: attempts[] }
export function mastery(problems, progress) {
  if (problems.length === 0) return { percent: 0, attempted: 0, total: 0, level: levelOf(0, 0) };
  let sum = 0;
  let attempted = 0;
  for (const p of problems) {
    const attempts = progress[p.id] ?? [];
    if (attempts.length) attempted++;
    sum += problemScore(attempts);
  }
  const percent = Math.round((sum / problems.length) * 100);
  return { percent, attempted, total: problems.length, level: levelOf(percent, attempted) };
}

// ---- 保存（localStorage。使えない環境でも動くように try/catch） ----
export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function recordAttempt(problemId, correct) {
  const progress = loadProgress();
  const list = progress[problemId] ?? [];
  list.push({ correct, at: Date.now() });
  progress[problemId] = list.slice(-KEEP);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* 保存できなくても採点は続ける */
  }
  return progress;
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
