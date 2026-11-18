import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, parseAmount, formatAnswer, publicProblem } from "../lib/grade.js";
import { problemScore, mastery, levelOf } from "../public/mastery.js";

const journal = {
  id: "q", type: "journal",
  answer: { debit: [{ account: "現金", amount: 100000 }], credit: [{ account: "資本金", amount: 60000 }, { account: "借入金", amount: 40000 }] },
};

test("parseAmount: 全角・カンマ・円", () => {
  assert.equal(parseAmount("１００，０００円"), 100000);
  assert.equal(parseAmount("¥250,000"), 250000);
  assert.ok(Number.isNaN(parseAmount("abc")));
});

test("仕訳: 順番違い・行の分割は正解、科目違い・金額違いは不正解", () => {
  const ok = { debit: [{ account: "現金", amount: "60,000" }, { account: "現金", amount: "40000" }],
               credit: [{ account: "借入金", amount: "40000" }, { account: "資本金", amount: "６００００" }, { account: "", amount: "" }] };
  assert.equal(grade(journal, ok).correct, true);
  assert.equal(grade(journal, { ...ok, credit: [{ account: "資本金", amount: "100000" }] }).correct, false);
  assert.equal(grade(journal, { debit: [{ account: "普通預金", amount: "100000" }], credit: ok.credit }).correct, false);
  assert.ok(grade(journal, { debit: [], credit: [] }).error);
  assert.ok(grade(journal, { debit: [{ account: "現金", amount: "" }], credit: ok.credit }).error);
});

test("選択式・数値", () => {
  assert.equal(grade({ type: "choice", answer: 1 }, "1").correct, true);
  assert.equal(grade({ type: "choice", answer: 1 }, "2").correct, false);
  assert.equal(grade({ type: "number", answer: 250000 }, "250,000").correct, true);
  assert.ok(grade({ type: "number", answer: 1 }, "x").error);
});

test("正解・解説は受講者に送らない", () => {
  const p = publicProblem({ ...journal, explanation: "e" });
  assert.equal(p.answer, undefined); assert.equal(p.explanation, undefined);
  assert.match(formatAnswer(journal), /（借方）現金 100,000 ／（貸方）資本金 60,000、借入金 40,000/);
});

test("習熟度: 直近を重く (5:3:2)", () => {
  const T = { correct: true }, F = { correct: false };
  assert.equal(problemScore([]), 0);
  assert.equal(problemScore([T]), 1);
  assert.equal(problemScore([F, T]), 5 / 8);            // 最新が正解
  assert.equal(problemScore([T, T, T, F]), 0.5);        // 最新が不正解 → 3+2 / 10
  const m = mastery([{ id: "a" }, { id: "b" }], { a: [T] });
  assert.deepEqual([m.percent, m.attempted, m.level.label], [50, 1, "学習中"]);
  assert.equal(levelOf(0, 0).label, "未学習");
  assert.equal(levelOf(80, 1).label, "定着");
  assert.equal(levelOf(39, 1).label, "要復習");
});
