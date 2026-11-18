// まなびば（試作版）フロントエンド — ハッシュでページを切り替える 1 ページアプリ
const app = document.getElementById("app");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const yen = (n) => (n === 0 ? "無料" : `¥${n.toLocaleString("ja-JP")}`);

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
  return res.json();
}

// AI の回答を安全に表示する（まずエスケープしてから、コードブロック・太字・改行だけ整形）
function renderAnswer(text) {
  const parts = esc(text).split(/```[a-zA-Z]*\n?/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return `<pre><code>${part.replace(/\n$/, "")}</code></pre>`;
      return part
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p) =>
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

// ---- ページ: 講座一覧 ----
async function showCatalog() {
  const courses = await getJSON("/api/courses");
  document.title = "まなびば — 講座一覧";
  app.innerHTML = `
    <h1>講座一覧</h1>
    <p class="lead">気になる講座を選んで、AI チューターと一緒に学びましょう。</p>
    <div class="grid">
      ${courses
        .map(
          (c) => `
        <a class="card" href="#/course/${esc(c.id)}">
          <div class="card-band" style="background:${esc(c.color)}"></div>
          <div class="card-body">
            <h2>${esc(c.title)}</h2>
            <p>${esc(c.summary)}</p>
            <div class="meta">
              <span class="pill">${esc(c.level)}</span>
              <span class="pill">${c.lessons.length} レッスン</span>
              <span class="pill">${c.lessons.reduce((a, l) => a + l.minutes, 0)} 分</span>
              <span class="pill price">${yen(c.price)}</span>
            </div>
          </div>
        </a>`
        )
        .join("")}
    </div>`;
}

// ---- ページ: 講座詳細 ----
async function showCourse(courseId) {
  const courses = await getJSON("/api/courses");
  const c = courses.find((x) => x.id === courseId);
  if (!c) return showError("講座が見つかりません。");
  document.title = `まなびば — ${c.title}`;
  app.innerHTML = `
    <div class="breadcrumb"><a href="#/">講座一覧</a> › ${esc(c.title)}</div>
    <h1>${esc(c.title)}</h1>
    <p class="lead">${esc(c.summary)}</p>
    <p class="meta"><span class="pill">${esc(c.level)}</span><span class="pill price">${yen(c.price)}</span></p>
    <ol class="lesson-list">
      ${c.lessons
        .map(
          (l, i) => `
        <li><a href="#/course/${esc(c.id)}/lesson/${esc(l.id)}">
          <span class="num">${i + 1}</span><span>${esc(l.title)}</span><span class="mins">${l.minutes} 分</span>
        </a></li>`
        )
        .join("")}
    </ol>
    <p style="margin-top:20px"><a class="btn" href="#/course/${esc(c.id)}/lesson/${esc(c.lessons[0].id)}">最初のレッスンから始める</a></p>`;
}

// ---- ページ: レッスン + AI チューター ----
async function showLesson(courseId, lessonId) {
  const data = await getJSON(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`);
  const { course, lesson, html, prev, next } = data;
  document.title = `まなびば — ${lesson.title}`;
  const link = (l) => `#/course/${esc(course.id)}/lesson/${esc(l.id)}`;
  app.innerHTML = `
    <div class="breadcrumb"><a href="#/">講座一覧</a> › <a href="#/course/${esc(course.id)}">${esc(course.title)}</a> › ${esc(lesson.title)}</div>
    <div class="lesson-layout">
      <article class="lesson-body">
        ${html}
        <nav class="pager">
          ${prev ? `<a class="btn ghost" href="${link(prev)}">← ${esc(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="btn" href="${link(next)}">${esc(next.title)} →</a>` : `<a class="btn" href="#/course/${esc(course.id)}">講座トップへ</a>`}
        </nav>
      </article>
      <aside class="tutor" aria-label="AI チューター">
        <div class="tutor-head">
          <strong>AI チューター</strong>
          <small>このレッスンについて何でも質問できます</small>
        </div>
        <div class="chat" id="chat">
          <div class="bubble assistant"><p>こんにちは！「${esc(lesson.title)}」でわからないところがあれば、気軽に質問してください。</p></div>
          <div class="suggestions" id="suggestions">
            <button type="button">このレッスンの要点を 3 行で</button>
            <button type="button">練習問題を 1 問出して</button>
            <button type="button">もっとかんたんに説明して</button>
          </div>
        </div>
        <form id="ask-form">
          <textarea id="ask-input" rows="1" maxlength="2000" placeholder="質問を入力（Enter で送信）" aria-label="質問"></textarea>
          <button class="btn" id="ask-btn" type="submit">送信</button>
        </form>
      </aside>
    </div>`;
  window.scrollTo(0, 0);
  setupTutor(course.id, lesson.id);
}

function setupTutor(courseId, lessonId) {
  const chat = document.getElementById("chat");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  const btn = document.getElementById("ask-btn");
  const history = []; // { role: "user" | "assistant", text }

  const addBubble = (cls, htmlContent) => {
    const div = document.createElement("div");
    div.className = `bubble ${cls}`;
    div.innerHTML = htmlContent;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  };

  async function ask(question) {
    question = question.trim();
    if (!question) return;
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
        body: JSON.stringify({ courseId, lessonId, messages: history.slice(-19) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `エラーが発生しました（${res.status}）`);
      }
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
      history.pop(); // 失敗した質問は履歴から外す（会話の形を崩さないため）
      answer.className = "bubble notice";
      answer.textContent = e.message;
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!btn.disabled) ask(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  document.getElementById("suggestions").addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON" && !btn.disabled) ask(e.target.textContent);
  });
}

function showError(message) {
  app.innerHTML = `<h1>ページを表示できません</h1><p class="lead">${esc(message)}</p><a class="btn" href="#/">講座一覧へ</a>`;
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === "course" && parts[2] === "lesson") await showLesson(parts[1], parts[3]);
    else if (parts[0] === "course") await showCourse(parts[1]);
    else await showCatalog();
  } catch (e) {
    showError(e.message);
  }
}

window.addEventListener("hashchange", route);
route();
