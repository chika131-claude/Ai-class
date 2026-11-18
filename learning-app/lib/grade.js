// 採点（AI は使わず、正解データと機械的に照合する）

// 全角数字・カンマ・「円」などを取り除いて数値にする
export function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const s = value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,、\s円¥￥]/g, "")
    .replace(/[－−ー]/g, "-")
    .replace(/．/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

const normAccount = (a) => String(a ?? "").normalize("NFKC").replace(/\s/g, "");

// 仕訳の片側（借方 or 貸方）を「勘定科目 → 合計金額」にまとめる
function sideTotals(lines) {
  if (!Array.isArray(lines)) return null;
  const totals = new Map();
  for (const line of lines) {
    const account = normAccount(line?.account);
    const amount = parseAmount(line?.amount);
    if (!account && (line?.amount === "" || line?.amount == null)) continue; // 空行は無視
    if (!account || !Number.isFinite(amount) || amount <= 0) return null;
    totals.set(account, (totals.get(account) ?? 0) + amount);
  }
  return totals;
}

function sameTotals(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

// 受講者の答えを採点する。戻り値: { correct: boolean, error?: string }
export function grade(problem, userAnswer) {
  switch (problem.type) {
    case "choice": {
      const idx = Number(userAnswer);
      if (!Number.isInteger(idx)) return { correct: false, error: "選択肢を選んでください。" };
      return { correct: idx === problem.answer };
    }
    case "number": {
      const n = parseAmount(userAnswer);
      if (!Number.isFinite(n)) return { correct: false, error: "数値で答えてください。" };
      return { correct: n === problem.answer };
    }
    case "journal": {
      const debit = sideTotals(userAnswer?.debit);
      const credit = sideTotals(userAnswer?.credit);
      if (!debit || !credit || debit.size === 0 || credit.size === 0) {
        return { correct: false, error: "借方・貸方それぞれに、勘定科目と正しい金額を入力してください。" };
      }
      return {
        correct:
          sameTotals(debit, sideTotals(problem.answer.debit)) &&
          sameTotals(credit, sideTotals(problem.answer.credit)),
      };
    }
    default:
      return { correct: false, error: "この問題の形式には対応していません。" };
  }
}

// 正解を人が読める文章にする（AI への説明や画面表示に使う）
export function formatAnswer(problem, answer = problem.answer) {
  const yen = (n) => `${Number(n).toLocaleString("ja-JP")}`;
  switch (problem.type) {
    case "choice":
      return problem.choices?.[answer] ?? "（未回答）";
    case "number": {
      const n = parseAmount(answer);
      return Number.isFinite(n) ? `${yen(n)}${problem.unit ?? ""}` : String(answer ?? "（未回答）");
    }
    case "journal": {
      const side = (lines) =>
        (lines ?? [])
          .filter((l) => l?.account || l?.amount)
          .map((l) => `${l.account || "？"} ${Number.isFinite(parseAmount(l.amount)) ? yen(parseAmount(l.amount)) : l.amount || "？"}`)
          .join("、") || "（なし）";
      return `（借方）${side(answer?.debit)} ／（貸方）${side(answer?.credit)}`;
    }
    default:
      return String(answer);
  }
}

// 受講者に送ってよい問題データ（正解・解説を除く）
export function publicProblem(p) {
  const { answer, explanation, ...rest } = p;
  return rest;
}
