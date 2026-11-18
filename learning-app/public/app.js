// まなびば（簿記入門・試作版）フロントエンド — ハッシュでページを切り替える 1 ページアプリ
import { mastery, loadProgress, recordAttempt, resetProgress } from "./mastery.js";

const app = document.getElementById("app");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function getJSON(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
  return body;
}
const postJSON = (url, data) =>
  getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

// AI の回答を安全に表示する（まずエスケープしてから、コードブロック・見出し・太字・箇条書き・改行だけ整形）
function renderAnswer(text) {
  return esc(text)
    .split(/```[a-zA-Z]*\n?/)
    .map((part, i) => {
      if (i % 2 === 1) return `<pre><code>${part.replace(/\n$/, "")}</code></pre>`;
      return part
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map(
          (p) =>
            `<p>${p
              .replace(/^#{1,6}\s*(.+)$/gm, "<strong>$1</strong>")
              .replace(/^\s*[-*]\s+/gm, "・")
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
              .replace(/`([^`]+)`/g, "<code>$1</code>")
              .replace(/\n/g, "<br>")}</p>`
        )
        .join("");
    })
    .join("");
}

// ---- 習熟度の表示部品 ----
function masteryBar(m, label = "習熟度") {
  return `
    <div class="mastery mastery-${m.level.key}">
      <div class="mastery-head">
        <span>${esc(label)}</span>
        <span><strong>${m.percent}%</strong> <span class="badge">${m.level.label}</span></span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.percent}"><span style="width:${m.percent}%"></span></div>
      <small>${m.total} 問中 ${m.attempted} 問に取り組みました</small>
    </div>`;
}

const loadCourses = () => getJSON("/api/courses");
const loadProblems = (courseId) => getJSON(`/api/courses/${encodeURIComponent(courseId)}/problems`);

// ---- ページ: 講座一覧 ----
async function showCatalog() {
  const courses = await loadCourses();
  const progress = loadProgress();
  const cards = await Promise.all(
    courses.map(async (c) => {
      const m = mastery(await loadProblems(c.id), progress);
      return `
        <a class="card" href="#/course/${esc(c.id)}">
          <div class="card-band" style="background:${esc(c.color)}"></div>
          <div class="card-body">
            <h2>${esc(c.title)}</h2>
            <p>${esc(c.summary)}</p>
            <div class="meta">
              <span class="pill">${esc(c.level)}</span>
              <span class="pill">${c.lessons.length} 単元</span>
              <span class="pill">${c.problemCount} 問</span>
            </div>
            ${masteryBar(m)}
          </div>
        </a>`;
    })
  );
  document.title = "まなびば — 講座一覧";
  app.innerHTML = `
    <h1>講座一覧</h1>
    <p class="lead">教材で学び、問題を解いて、習熟度を上げていきましょう。</p>
    <div class="grid">${cards.join("")}</div>`;
}

// ---- ページ: 講座（単元一覧と習熟度） ----
async function showCourse(courseId) {
  const c = (await loadCourses()).find((x) => x.id === courseId);
  if (!c) return showError("講座が見つかりません。");
  const problems = await loadProblems(c.id);
  const progress = loadProgress();
  document.title = `まなびば — ${c.title}`;
  app.innerHTML = `
    <div class="breadcrumb"><a href="#/">講座一覧</a> › ${esc(c.title)}</div>
    <h1>${esc(c.title)}</h1>
    <p class="lead">${esc(c.summary)}</p>
    <section class="panel">${masteryBar(mastery(problems, progress), "講座全体の習熟度")}</section>
    <h2 class="section-title">単元</h2>
    <ol class="unit-list">
      ${c.lessons
        .map((l, i) => {
          const ps = problems.filter((p) => p.lessonId === l.id);
          const m = mastery(ps, progress);
          return `
          <li class="unit">
            <div class="unit-head">
              <span class="num">${i + 1}</span>
              <div class="unit-title">
                <strong>${esc(l.title)}</strong>
                <small>${l.minutes} 分 ・ 問題 ${ps.length} 問</small>
              </div>
            </div>
            ${ps.length ? masteryBar(m) : ""}
            <div class="unit-actions">
              <a class="btn ghost" href="#/course/${esc(c.id)}/lesson/${esc(l.id)}">教材を読む</a>
              ${ps.length ? `<a class="btn" href="#/course/${esc(c.id)}/practice/${esc(l.id)}">問題を解く</a>` : ""}
            </div>
          </li>`;
        })
        .join("")}
    </ol>
    <p class="reset"><button type="button" class="link" id="reset">学習記録をリセット</button></p>
    <p class="note">学習記録はこのブラウザの中にだけ保存されます（別の端末には引き継がれません）。</p>`;
  document.getElementById("reset").addEventListener("click", () => {
    if (confirm("この講座を含む、すべての学習記録を消去します。よろしいですか？")) {
      resetProgress();
      showCourse(courseId);
    }
  });
}

// ---- AI チューター欄（単元・問題で共通） ----
function tutorPanel(title, greeting, suggestions) {
  return `
    <aside class="tutor" aria-label="AI チューター">
      <div class="tutor-head"><strong>AI チューター</strong><small>${esc(title)}</small></div>
      <div class="chat" id="chat">
        <div class="bubble assistant"><p>${esc(greeting)}</p></div>
        <div class="suggestions" id="suggestions">${suggestions.map((s) => `<button type="button">${esc(s)}</button>`).join("")}</div>
      </div>
      <form id="ask-form">
        <textarea id="ask-input" rows="1" maxlength="2000" placeholder="質問を入力（Enter で送信）" aria-label="質問"></textarea>
        <button class="btn" id="ask-btn" type="submit">送信</button>
      </form>
    </aside>`;
}

// getContext(): AI に渡す文脈（courseId, lessonId, problemId, userAnswer）
function setupTutor(getContext) {
  const chat = document.getElementById("chat");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  const btn = document.getElementById("ask-btn");
  const history = [];

  const addBubble = (cls, html) => {
    const div = document.createElement("div");
    div.className = `bubble ${cls}`;
    div.innerHTML = html;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  };

  async function ask(question) {
    question = question.trim();
    if (!question || btn.disabled) return;
    document.getElementById("suggestions")?.remove();
    history.push({ role: "user", text: question });
    addBubble("user", esc(question));
    input.value = "";
    btn.disabled = true;
    const answer = addBubble("assistant typing", "");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...getContext(), messages: history.slice(-19) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `エラー（${res.status}）`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        answer.innerHTML = renderAnswer(text);
        chat.scrollTop = chat.scrollHeight;
      }
      answer.classList.remove("typing");
      history.push({ role: "assistant", text });
    } catch (e) {
      history.pop();
      answer.className = "bubble notice";
      answer.textContent = e.message;
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  document.getElementById("suggestions")?.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") ask(e.target.textContent);
  });
  return { ask };
}

// ---- ページ: 教材 ----
async function showLesson(courseId, lessonId) {
  const { course, lesson, html, prev, next } = await getJSON(
    `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`
  );
  const problems = (await loadProblems(course.id)).filter((p) => p.lessonId === lesson.id);
  document.title = `まなびば — ${lesson.title}`;
  const link = (l) => `#/course/${esc(course.id)}/lesson/${esc(l.id)}`;
  app.innerHTML = `
    <div class="breadcrumb"><a href="#/">講座一覧</a> › <a href="#/course/${esc(course.id)}">${esc(course.title)}</a> › ${esc(lesson.title)}</div>
    <div class="two-col">
      <article class="lesson-body">
        ${html}
        ${problems.length ? `<p class="cta"><a class="btn" href="#/course/${esc(course.id)}/practice/${esc(lesson.id)}">この単元の問題を解く（${problems.length} 問）</a></p>` : ""}
        <nav class="pager">
          ${prev ? `<a class="btn ghost" href="${link(prev)}">← ${esc(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="btn ghost" href="${link(next)}">${esc(next.title)} →</a>` : `<a class="btn ghost" href="#/course/${esc(course.id)}">講座トップへ</a>`}
        </nav>
      </article>
      ${tutorPanel("この単元について質問できます", `「${lesson.title}」でわからないところがあれば、気軽に質問してください。`, [
        "この単元の要点を 3 行で",
        "借方と貸方の見分け方は？",
        "もっとかんたんに説明して",
      ])}
    </div>`;
  window.scrollTo(0, 0);
  setupTutor(() => ({ courseId: course.id, lessonId: lesson.id }));
}

// ---- 解答フォーム（問題の形式ごと） ----
function answerForm(p) {
  if (p.type === "choice") {
    return `<fieldset class="choices"><legend class="sr-only">選択肢</legend>
      ${p.choices.map((c, i) => `<label><input type="radio" name="choice" value="${i}"> ${esc(c)}</label>`).join("")}
    </fieldset>`;
  }
  if (p.type === "number") {
    return `<label class="number-answer">答え <input type="text" inputmode="numeric" name="number" autocomplete="off"> ${esc(p.unit ?? "")}</label>`;
  }
  if (p.type === "journal") {
    const options = `<option value="">勘定科目を選択</option>${(p.accounts ?? []).map((a) => `<option>${esc(a)}</option>`).join("")}`;
    const row = (side) => `
      <div class="jrow">
        <select name="${side}-account" aria-label="${side === "debit" ? "借方" : "貸方"}の勘定科目">${options}</select>
        <input type="text" inputmode="numeric" name="${side}-amount" placeholder="金額" autocomplete="off" aria-label="${side === "debit" ? "借方" : "貸方"}の金額">
      </div>`;
    return `
      <div class="journal">
        <div class="jside" data-side="debit"><div class="jlabel">借方</div>${row("debit")}</div>
        <div class="jside" data-side="credit"><div class="jlabel">貸方</div>${row("credit")}</div>
      </div>
      <p class="jhelp"><button type="button" class="link" data-add="debit">＋ 借方の行を追加</button>
      <button type="button" class="link" data-add="credit">＋ 貸方の行を追加</button></p>`;
  }
  return "<p>この形式の問題には対応していません。</p>";
}

function readAnswer(p, form) {
  if (p.type === "choice") return form.querySelector("input[name=choice]:checked")?.value ?? null;
  if (p.type === "number") return form.querySelector("input[name=number]").value;
  if (p.type === "journal") {
    const side = (s) =>
      [...form.querySelectorAll(`.jside[data-side=${s}] .jrow`)].map((r) => ({
        account: r.querySelector("select").value,
        amount: r.querySelector("input").value,
      }));
    return { debit: side("debit"), credit: side("credit") };
  }
  return null;
}

// ---- ページ: 問題演習 ----
async function showPractice(courseId, lessonId) {
  const course = (await loadCourses()).find((c) => c.id === courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  if (!lesson) return showError("単元が見つかりません。");
  const problems = (await loadProblems(course.id)).filter((p) => p.lessonId === lesson.id);
  if (!problems.length) return showError("この単元には、まだ問題がありません。");

  let index = 0;
  let lastAnswer; // AI に渡す受講者の答え（解答後のみ）
  let tutor;

  function render() {
    const p = problems[index];
    lastAnswer = undefined;
    document.title = `まなびば — ${lesson.title} 問題 ${index + 1}`;
    app.innerHTML = `
      <div class="breadcrumb"><a href="#/">講座一覧</a> › <a href="#/course/${esc(course.id)}">${esc(course.title)}</a> › ${esc(lesson.title)} の問題</div>
      <div class="two-col">
        <section class="lesson-body">
          <div class="qhead"><span>問題 ${index + 1} / ${problems.length}</span>${p.sample ? '<span class="pill">サンプル</span>' : ""}</div>
          <p class="question">${esc(p.question)}</p>
          <form id="answer-form">
            ${answerForm(p)}
            <p class="error" id="answer-error" role="alert"></p>
            <button class="btn" type="submit" id="check-btn">答え合わせ</button>
          </form>
          <div id="result"></div>
          <div id="mastery-now"></div>
        </section>
        ${tutorPanel("この問題について質問できます", "解き方がわからないときは、ヒントを聞いてみてください。答え合わせの後は、詳しい解説もできます。", [
          "ヒントをください",
          "この問題で使う考え方は？",
        ])}
      </div>`;
    window.scrollTo(0, 0);
    tutor = setupTutor(() => ({ courseId: course.id, problemId: p.id, ...(lastAnswer !== undefined ? { userAnswer: lastAnswer } : {}) }));

    const form = document.getElementById("answer-form");
    form.addEventListener("click", (e) => {
      const side = e.target.dataset?.add;
      if (!side) return;
      const rows = form.querySelectorAll(`.jside[data-side=${side}] .jrow`);
      const clone = rows[0].cloneNode(true);
      clone.querySelector("select").value = "";
      clone.querySelector("input").value = "";
      rows[rows.length - 1].after(clone);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("answer-error");
      errorEl.textContent = "";
      const answer = readAnswer(p, form);
      if (answer === null) return (errorEl.textContent = "選択肢を選んでください。");
      try {
        const r = await postJSON(`/api/courses/${encodeURIComponent(course.id)}/problems/${encodeURIComponent(p.id)}/check`, { answer });
        lastAnswer = answer;
        const progress = recordAttempt(p.id, r.correct);
        form.querySelectorAll("input, select, button").forEach((el) => (el.disabled = true));
        document.getElementById("result").innerHTML = `
          <div class="result ${r.correct ? "ok" : "ng"}">
            <strong>${r.correct ? "正解！" : "不正解"}</strong>
            <p>正解：${esc(r.correctAnswerText)}</p>
            ${r.explanation ? `<p class="expl">${esc(r.explanation)}</p>` : ""}
          </div>
          <div class="result-actions">
            <button class="btn ghost" type="button" id="ai-explain">AI に詳しく解説してもらう</button>
            <button class="btn ghost" type="button" id="retry">もう一度解く</button>
            ${index + 1 < problems.length ? `<button class="btn" type="button" id="next">次の問題へ</button>` : `<a class="btn" href="#/course/${esc(course.id)}">結果を見る（講座トップへ）</a>`}
          </div>`;
        document.getElementById("mastery-now").innerHTML = masteryBar(mastery(problems, progress), "この単元の習熟度");
        document.getElementById("ai-explain").addEventListener("click", () =>
          tutor.ask(r.correct ? "正解でした。考え方を確認したいので解説してください。" : "間違えました。どこが違ったのか詳しく解説してください。")
        );
        document.getElementById("retry").addEventListener("click", render);
        document.getElementById("next")?.addEventListener("click", () => {
          index++;
          render();
        });
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }
  render();
}

function showError(message) {
  app.innerHTML = `<h1>ページを表示できません</h1><p class="lead">${esc(message)}</p><a class="btn" href="#/">講座一覧へ</a>`;
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === "course" && parts[2] === "lesson") await showLesson(parts[1], parts[3]);
    else if (parts[0] === "course" && parts[2] === "practice") await showPractice(parts[1], parts[3]);
    else if (parts[0] === "course") await showCourse(parts[1]);
    else await showCatalog();
  } catch (e) {
    showError(e.message);
  }
}

window.addEventListener("hashchange", route);
route();
