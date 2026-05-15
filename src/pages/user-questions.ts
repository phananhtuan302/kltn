import { navigate } from "../lib/router";

type AnswerMap = Record<string, unknown>;

const QUESTIONS: Array<{
  id: string;
  title: string;
  subtitle?: string;
  type: "single" | "multi" | "text";
  options?: Array<{ value: string; label: string; img: string }>;
}> = [
  {
    id: "food",
    title: "Bạn muốn ăn gì hôm nay?",
    subtitle: "Chọn một hoặc bỏ qua",
    type: "single",
    options: [
      { value: "com", label: "Cơm", img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=60" },
      { value: "bun", label: "Bún", img: "https://images.unsplash.com/photo-1604908177522-2f6d1f6a3b03?auto=format&fit=crop&w=800&q=60" },
      { value: "pho", label: "Phở", img: "https://images.unsplash.com/photo-1604908177618-9f9f5d6b0c3a?auto=format&fit=crop&w=800&q=60" },
      { value: "hai-san", label: "Hải sản", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=60" },
      { value: "lau-nuong", label: "Lẩu & nướng", img: "https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=60" },
      { value: "do-chay", label: "Đồ chay", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=60" }
    ]
  },
  {
    id: "place",
    title: "Bạn thường thích đi đâu?",
    subtitle: "Chọn những địa điểm bạn quan tâm",
    type: "multi",
    options: [
      { value: "cong-vien", label: "Công viên", img: "https://images.unsplash.com/photo-1504198458649-3128b932f49b?auto=format&fit=crop&w=800&q=60" },
      { value: "cho", label: "Chợ", img: "https://images.unsplash.com/photo-1544025162-6c4d4b2b8a0a?auto=format&fit=crop&w=800&q=60" },
      { value: "chua", label: "Chùa", img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=60" },
      { value: "coffee", label: "Cà phê", img: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=60" },
      { value: "karaoke", label: "Karaoke", img: "https://images.unsplash.com/photo-1564866657312-8be6b8d3f6a0?auto=format&fit=crop&w=800&q=60" },
      { value: "nha-tho", label: "Nhà thờ", img: "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=800&q=60" }
    ]
  },
  {
    id: "shopping",
    title: "Bạn thích đi chợ hay siêu thị?",
    type: "single",
    options: [
      { value: "cho", label: "Chợ", img: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c0?auto=format&fit=crop&w=800&q=60" },
      { value: "sieu-thi", label: "Siêu thị", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=60" }
    ]
  },
  {
    id: "budget",
    title: "Ngân sách mỗi chuyến (VND)",
    subtitle: "Ví dụ: 1500000 — có thể bỏ qua",
    type: "text"
  },
  {
    id: "diet",
    title: "Bạn có hạn chế ăn uống/tôn giáo cần lưu ý không?",
    subtitle: "Chọn nếu có",
    type: "multi",
    options: [
      { value: "an-chay", label: "Ăn chay", img: "https://images.unsplash.com/photo-1505577058444-a3dab7b6a92b?auto=format&fit=crop&w=800&q=60" },
      { value: "khong-an-pork", label: "Không ăn pork", img: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=800&q=60" },
      { value: "khong-kieng", label: "Không có hạn chế", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=60" }
    ]
  }
];

export function renderUserQuestionsPage(container: HTMLElement): void {
  const state: { idx: number; answers: AnswerMap } = {
    idx: 0,
    answers: {}
  };
  let isSaving = false;

  function saveAnswers() {
    try {
      localStorage.setItem("userPreferences", JSON.stringify(state.answers));
    } catch (e) {
      // ignore
    }
  }

  async function persistAnswers(): Promise<void> {
    saveAnswers();
    const { apiSaveUserPreferences } = await import("../lib/api");
    await apiSaveUserPreferences(state.answers);
  }

  function render() {
    const q = QUESTIONS[state.idx];
    container.innerHTML = `
      <div class="section">
        <div class="shell">
          <div class="question-card">
            <button class="btn btn-outline" id="skip-btn">Bỏ qua</button>
            <h2 class="section__title">${q.title}</h2>
            ${q.subtitle ? `<p class="form-hint">${q.subtitle}</p>` : ""}
            <div id="options" class="question-options"></div>
            <div style="margin-top:1rem; display:flex; gap:0.6rem;">
              <button class="btn" id="back-btn">Quay lại</button>
              <button class="btn btn-primary" id="next-btn">Tiếp theo</button>
            </div>
            <div style="margin-top:.8rem; color:var(--c-muted); font-size:.95rem">${state.idx + 1}/${QUESTIONS.length}</div>
          </div>
        </div>
      </div>
    `;

    const optionsEl = container.querySelector<HTMLDivElement>("#options")!;

    if (q.type === "text") {
      optionsEl.innerHTML = `<input id="text-input" placeholder="Ví dụ: 1500000" class="input-text" />`;
      const input = optionsEl.querySelector<HTMLInputElement>("#text-input")!;
      input.value = (state.answers[q.id] as string) ?? "";
    } else if (q.options) {
      optionsEl.innerHTML = q.options
        .map((o) => {
          const selected = Array.isArray(state.answers[q.id])
            ? (state.answers[q.id] as string[]).includes(o.value)
            : state.answers[q.id] === o.value;
          return `
            <label class="q-option ${selected ? "q-option--selected" : ""}" data-value="${o.value}">
              <img src="${o.img}" alt="${o.label}" />
              <div class="q-label">${o.label}</div>
            </label>
          `;
        })
        .join("\n");

      optionsEl.querySelectorAll<HTMLLabelElement>(".q-option").forEach((el) => {
        el.addEventListener("click", () => {
          const val = el.getAttribute("data-value")!;
          const cur = state.answers[q.id];
          if (q.type === "single") {
            state.answers[q.id] = val;
          } else {
            // multi
            const arr: string[] = Array.isArray(cur) ? cur.slice() : [];
            const idx = arr.indexOf(val);
            if (idx === -1) arr.push(val);
            else arr.splice(idx, 1);
            state.answers[q.id] = arr;
          }
          render();
        });
      });
    }

    container.querySelector<HTMLButtonElement>("#next-btn")!.addEventListener("click", () => {
      const curQ = QUESTIONS[state.idx];
      if (curQ.type === "text") {
        const val = (container.querySelector<HTMLInputElement>("#text-input")!).value.trim();
        state.answers[curQ.id] = val || null;
      }
      state.idx++;
      if (state.idx >= QUESTIONS.length) {
        if (isSaving) {
          return;
        }

        isSaving = true;
        const nextBtn = container.querySelector<HTMLButtonElement>("#next-btn")!;
        nextBtn.disabled = true;
        nextBtn.textContent = "Đang lưu...";

        void (async () => {
          try {
            await persistAnswers();
            navigate("/");
          } catch (e) {
            console.warn("Save prefs failed", e);
            saveAnswers();
            navigate("/");
          } finally {
            isSaving = false;
          }
        })();
        return;
      }
      render();
    });

    container.querySelector<HTMLButtonElement>("#back-btn")!.addEventListener("click", () => {
      if (state.idx > 0) {
        state.idx--;
        render();
      } else {
        navigate("/");
      }
    });

    container.querySelector<HTMLButtonElement>("#skip-btn")!.addEventListener("click", () => {
      // skip current question
      state.answers[QUESTIONS[state.idx].id] = null;
      state.idx++;
      if (state.idx >= QUESTIONS.length) {
        if (isSaving) {
          return;
        }

        isSaving = true;
        const skipBtn = container.querySelector<HTMLButtonElement>("#skip-btn")!;
        skipBtn.disabled = true;
        skipBtn.textContent = "Đang lưu...";

        void (async () => {
          try {
            await persistAnswers();
          } catch (e) {
            console.warn("Save prefs failed", e);
            saveAnswers();
          } finally {
            isSaving = false;
            navigate("/");
          }
        })();
        return;
      }
      render();
    });
  }

  render();
}
