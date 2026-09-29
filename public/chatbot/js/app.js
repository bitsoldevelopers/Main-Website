/* ============================================================
   BITSOL MARKETING — Scripted Conversation Engine
   Standalone web app • no backend required to run the flow.
   Leads are sent to Google Sheets when configured (config.js),
   with an on-device fallback so the whole flow always works.
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.BITSOL_CONFIG;
  const DATA = window.BITSOL_DATA;

  // ---------- DOM ----------
  const chatWindow = document.getElementById("chatWindow");
  const inputForm = document.getElementById("inputForm");
  const userInput = document.getElementById("userInput");
  const restartBtn = document.getElementById("restartBtn");
  const waFooterLink = document.getElementById("waFooterLink");

  const WA_LINK = "https://wa.me/" + CFG.whatsappNumber;
  waFooterLink.href = WA_LINK;

  // ---------- State ----------
  const state = {
    branch: null,
    mode: "branch", // branch | menu | browsing | register
    reg: {},        // registration answers
    regStep: 0,     // current registration step index
  };

  const HANDOVER_KEYWORDS = [
    "agent", "human", "support", "representative",
    "admission", "counselor", "counsellor", "whatsapp", "call me",
  ];

  // ============================================================
  //  Rendering helpers
  // ============================================================
  function scrollDown() {
    requestAnimationFrame(() => { chatWindow.scrollTop = chatWindow.scrollHeight; });
  }

  // Bot copy is authored by us and may contain literal <strong>/<br> tags.
  // Any user-supplied value interpolated into bot copy is escaped via
  // escapeHtml() at the call site, so we render the string as trusted HTML
  // and additionally support **bold**, [text](url) links, and newlines.
  function formatText(t) {
    return String(t)
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function addUserMessage(text) {
    const msg = el("div", "msg user");
    const b = el("div", "bubble");
    b.textContent = text;
    msg.appendChild(b);
    chatWindow.appendChild(msg);
    scrollDown();
  }

  function addBotMessage(html) {
    const msg = el("div", "msg bot");
    const b = el("div", "bubble");
    b.innerHTML = formatText(html);
    msg.appendChild(b);
    chatWindow.appendChild(msg);
    scrollDown();
    return msg;
  }

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  // Typing indicator + delayed bot message
  function botSay(html, delay) {
    return new Promise((resolve) => {
      const typing = el("div", "msg bot typing");
      const b = el("div", "bubble");
      b.innerHTML = "<span></span><span></span><span></span>";
      typing.appendChild(b);
      chatWindow.appendChild(typing);
      scrollDown();
      setTimeout(() => {
        typing.remove();
        const m = html != null ? addBotMessage(html) : null;
        resolve(m);
      }, delay || 550);
    });
  }

  // Render a group of option buttons. opts: [{icon,label,value}]
  function addOptions(opts, onPick, layout) {
    const wrap = el("div", "options" + (layout === "grid" ? " grid" : ""));
    opts.forEach((o) => {
      const btn = el("button", "opt");
      btn.type = "button";
      btn.innerHTML =
        (o.icon ? `<span class="opt-ico">${o.icon}</span>` : "") +
        `<span>${escapeHtml(o.label)}</span>`;
      btn.addEventListener("click", () => {
        wrap.classList.add("spent");
        addUserMessage(o.label.replace(/^[^\w؀-ۿ]+/, "").trim() || o.label);
        onPick(o.value != null ? o.value : o.label);
      });
      wrap.appendChild(btn);
    });
    chatWindow.appendChild(wrap);
    scrollDown();
    return wrap;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ============================================================
  //  Conversation flow
  // ============================================================
  async function startConversation() {
    chatWindow.innerHTML = "";
    state.branch = null;
    state.mode = "branch";
    state.reg = {};
    state.regStep = 0;

    await botSay(
      "🤖 <strong>Welcome to BITSOL MARKETING Pvt. Ltd.</strong>\n\nAssalam-o-Alaikum! 👋\n\nThank you for contacting BITSOL MARKETING. We help students, professionals, entrepreneurs, and businesses grow through AI-powered education and digital solutions.",
      300
    );
    await botSay("Please select your preferred <strong>branch</strong> to continue 👇", 500);
    renderBranches();
  }

  function renderBranches() {
    state.mode = "branch";
    addOptions(
      DATA.branches.map((b) => ({ icon: b.icon, label: b.name, value: b.name })),
      onBranchPicked,
      "grid"
    );
  }

  async function onBranchPicked(branch) {
    state.branch = branch;
    state.mode = "menu";
    await botSay(
      `Great choice! You're connected with our <strong>${branch}</strong>. 🏢\n\nHow can I help you today?`,
      500
    );
    renderMainMenu();
  }

  function renderMainMenu() {
    state.mode = "menu";
    addOptions(
      DATA.mainMenu.map((m) => ({ icon: m.icon, label: m.label, value: m.action })),
      onMenuPicked,
      "grid"
    );
  }

  async function onMenuPicked(action) {
    switch (action) {
      case "courses":   return showCourses();
      case "services":  return showServices();
      case "register":  return startRegistration();
      case "faq":       return showFaqMenu();
      case "contact":   return showContact();
      case "counselor": return showHandover();
    }
  }

  // ---------- Courses ----------
  async function showCourses() {
    state.mode = "browsing";
    await botSay("🎓 Here are our <strong>Professional Courses</strong>. Tap any course to see full details:", 500);
    addOptions(
      DATA.courses.map((c) => ({ icon: c.icon, label: `${c.title} — ${c.fee}`, value: c.id })),
      (id) => showCourseDetail(DATA.courses.find((c) => c.id === id)),
      "grid"
    );
    addBackToMenu();
  }

  async function showCourseDetail(course) {
    await botSay(null, 400);
    const card = buildCourseCard(course);
    chatWindow.appendChild(card);
    scrollDown();
    addFollowUp([
      { icon: "📝", label: "Register for this course", fn: () => startRegistration({ interestedIn: "Course", selectedItem: course.title }) },
      { icon: "🎓", label: "See other courses", fn: showCourses },
      { icon: "🏠", label: "Main menu", fn: renderMainMenu },
    ]);
  }

  function buildCourseCard(c) {
    const card = el("div", "info-card");
    card.innerHTML = `
      <div class="ic-head">
        <div class="ic-ico">${c.icon}</div>
        <div>
          <div class="ic-title">${escapeHtml(c.title)}</div>
          <div class="ic-meta">⏱ ${escapeHtml(c.duration)} &nbsp;•&nbsp; 🎓 Certificate Included</div>
        </div>
      </div>
      <p class="ic-desc">${escapeHtml(c.overview)}</p>
      <div class="ic-facts">
        <div class="fact"><div class="fk">Duration</div><div class="fv">${escapeHtml(c.duration)}</div></div>
        <div class="fact"><div class="fk">Fee</div><div class="fv price">${escapeHtml(c.fee)}</div></div>
        <div class="fact"><div class="fk">Installments</div><div class="fv">${c.installments ? "Available ✅" : "One payment"}</div></div>
        <div class="fact"><div class="fk">Certificate</div><div class="fv">${c.certificate ? "Yes ✅" : "—"}</div></div>
      </div>
      <div class="ic-section"><h4>Skills Covered</h4><ul class="ic-list">${c.skills.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>
      <div class="ic-section"><h4>Learning Outcomes</h4><ul class="ic-list">${c.outcomes.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>
      <div class="ic-section"><h4>Career Opportunities</h4><div class="tags">${c.careers.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div></div>
    `;
    const cta = el("button", "ic-cta");
    cta.textContent = "📝 Register for this course";
    cta.addEventListener("click", () => {
      addUserMessage(`Register for ${c.title}`);
      startRegistration({ interestedIn: "Course", selectedItem: c.title });
    });
    card.appendChild(cta);
    return card;
  }

  // ---------- Services ----------
  async function showServices() {
    state.mode = "browsing";
    await botSay("💼 Here are our <strong>Business Services</strong>. Tap any service to learn more:", 500);
    addOptions(
      DATA.services.map((s, i) => ({ icon: s.icon, label: s.title, value: i })),
      (i) => showServiceDetail(DATA.services[i]),
      "grid"
    );
    addBackToMenu();
  }

  async function showServiceDetail(s) {
    await botSay(null, 400);
    const card = el("div", "info-card");
    card.innerHTML = `
      <div class="ic-head">
        <div class="ic-ico">${s.icon}</div>
        <div>
          <div class="ic-title">${escapeHtml(s.title)}</div>
          <div class="ic-meta">⏱ Est. delivery: ${escapeHtml(s.delivery)}</div>
        </div>
      </div>
      <div class="ic-section"><h4>What it is</h4><p class="ic-desc" style="margin:2px 0 0">${escapeHtml(s.what)}</p></div>
      <div class="ic-section"><h4>Who it's for</h4><p class="ic-desc" style="margin:2px 0 0">${escapeHtml(s.who)}</p></div>
      <div class="ic-section"><h4>Key Benefits</h4><ul class="ic-list">${s.benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul></div>
    `;
    const cta = el("button", "ic-cta");
    cta.textContent = "🎯 Request a Quotation";
    cta.addEventListener("click", () => {
      addUserMessage(`Request quotation for ${s.title}`);
      startRegistration({ interestedIn: "Service", selectedItem: s.title });
    });
    card.appendChild(cta);
    chatWindow.appendChild(card);
    scrollDown();
    addFollowUp([
      { icon: "💼", label: "See other services", fn: showServices },
      { icon: "🏠", label: "Main menu", fn: renderMainMenu },
    ]);
  }

  // ---------- FAQ ----------
  async function showFaqMenu() {
    state.mode = "browsing";
    await botSay("❓ <strong>Frequently Asked Questions</strong>\n\nTap a question to see the answer:", 500);
    addOptions(
      DATA.faqs.map((f, i) => ({ icon: "•", label: f.q, value: i })),
      async (i) => {
        await botSay(DATA.faqs[i].a, 500);
        addFollowUp([
          { icon: "❓", label: "Ask another question", fn: showFaqMenu },
          { icon: "📝", label: "Register now", fn: () => startRegistration() },
          { icon: "🏠", label: "Main menu", fn: renderMainMenu },
        ]);
      },
      "grid"
    );
    addBackToMenu();
  }

  // ---------- Contact ----------
  async function showContact() {
    state.mode = "browsing";
    await botSay(
      "📞 <strong>Contact Information</strong>\n\n🏢 Branches: Lahore (Head Office), Islamabad, Faisalabad, Sahiwal, Samundri\n💬 WhatsApp: [Chat with us](" +
        WA_LINK +
        ")\n\nOur admissions team is happy to help with any question.",
      500
    );
    addWhatsAppButton();
    addFollowUp([
      { icon: "📝", label: "Register now", fn: () => startRegistration() },
      { icon: "🏠", label: "Main menu", fn: renderMainMenu },
    ]);
  }

  // ---------- Handover ----------
  async function showHandover() {
    await botSay(
      "👨‍💼 Our admissions team is ready to assist you!\n\nClick below to start a <strong>WhatsApp</strong> conversation with a live counselor.",
      500
    );
    addWhatsAppButton();
    addFollowUp([{ icon: "🏠", label: "Back to menu", fn: renderMainMenu }]);
  }

  function addWhatsAppButton() {
    const a = document.createElement("a");
    a.className = "wa-cta";
    a.href = WA_LINK;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `<span class="wa-ico">💬</span> Chat on WhatsApp`;
    chatWindow.appendChild(a);
    scrollDown();
  }

  // ---------- Shared little helpers ----------
  function addBackToMenu() {
    addOptions([{ icon: "🏠", label: "Back to main menu", value: "__menu" }], renderMainMenu);
  }

  function addFollowUp(items) {
    const opts = items.map((it, idx) => ({ icon: it.icon, label: it.label, value: idx }));
    addOptions(opts, (idx) => items[idx].fn());
  }

  // ============================================================
  //  Registration flow (one question at a time)
  // ============================================================
  const nonEmpty = (v) => (v.trim().length > 0 ? true : "This field is required — please enter a value.");

  function validateName(v) {
    return v.trim().length >= 2 ? true : "Please enter your full name.";
  }
  function validatePhone(v) {
    const digits = v.replace(/[^\d]/g, "");
    // Accept 03XXXXXXXXX (11) or 92XXXXXXXXXX (12) or +92...
    const ok = /^(0\d{10}|92\d{10}|\d{10})$/.test(digits);
    return ok ? true : "Please enter a valid mobile number (e.g. 03XX-XXXXXXX).";
  }
  function validateEmail(v) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    return ok ? true : "That email doesn't look right — please enter a valid email (e.g. name@example.com).";
  }

  function buildRegSteps() {
    return [
      { key: "fullName", type: "text", q: "Let's get you registered! 📝\n\nWhat is your <strong>full name</strong>?", validate: validateName },
      { key: "phone", type: "text", q: "Thanks, {fullName}! 📱\n\nWhat's your <strong>mobile number</strong>?", validate: validatePhone },
      { key: "email", type: "text", q: "Great. What's your <strong>email address</strong>? 📧", validate: validateEmail },
      { key: "city", type: "text", q: "Which <strong>city</strong> are you in? 🏙️", validate: nonEmpty },
      {
        key: "interestedIn", type: "options",
        q: "Are you interested in a <strong>Course</strong> or a <strong>Service</strong>?",
        options: () => [
          { icon: "🎓", label: "Course", value: "Course" },
          { icon: "💼", label: "Service", value: "Service" },
        ],
      },
      {
        key: "selectedItem", type: "options",
        q: "Perfect! Which one would you like? 👇",
        options: () =>
          state.reg.interestedIn === "Service"
            ? DATA.services.map((s) => ({ icon: s.icon, label: s.title, value: s.title }))
            : DATA.courses.map((c) => ({ icon: c.icon, label: c.title, value: c.title })),
      },
      {
        key: "batch", type: "options",
        q: "Which <strong>batch</strong> suits you best? ⏰",
        skipIf: () => state.reg.interestedIn === "Service",
        skipValue: "N/A",
        options: () => [
          { icon: "🌅", label: "Morning", value: "Morning" },
          { icon: "🌆", label: "Evening", value: "Evening" },
          { icon: "📆", label: "Weekend", value: "Weekend" },
        ],
      },
      { key: "qualification", type: "text", q: "What is your <strong>highest educational qualification</strong>? 🎓", validate: nonEmpty },
      { key: "occupation", type: "text", q: "And your current <strong>occupation</strong>? 💼\n(e.g. Student, Job, Business — you can type 'N/A')" },
      {
        key: "leadSource", type: "options",
        q: "How did you <strong>hear about us</strong>? 📣",
        options: () => [
          { icon: "📘", label: "Facebook", value: "Facebook" },
          { icon: "📸", label: "Instagram", value: "Instagram" },
          { icon: "🔍", label: "Google", value: "Google" },
          { icon: "💬", label: "WhatsApp", value: "WhatsApp" },
          { icon: "🧑‍🤝‍🧑", label: "Friend / Referral", value: "Friend/Referral" },
          { icon: "✨", label: "Other", value: "Other" },
        ],
      },
      { key: "notes", type: "optional", q: "Anything else you'd like us to know? 📝\n(Type your note, or send 'skip')" },
    ];
  }

  let REG_STEPS = [];

  async function startRegistration(seed) {
    state.mode = "register";
    state.reg = Object.assign({}, seed || {});
    REG_STEPS = buildRegSteps();
    state.regStep = 0;

    if (!state.branch) {
      // Shouldn't happen (branch chosen first), but guard anyway.
      await botSay("Before we register you, please pick your branch:", 400);
      renderBranches();
      return;
    }
    if (seed && seed.selectedItem) {
      await botSay(
        `Awesome — let's register you for <strong>${escapeHtml(seed.selectedItem)}</strong>! ✨\nJust a few quick questions.`,
        450
      );
    }
    await askNextRegStep();
  }

  async function askNextRegStep() {
    // Skip already-answered or conditionally-skipped steps
    while (state.regStep < REG_STEPS.length) {
      const step = REG_STEPS[state.regStep];
      if (state.reg[step.key] != null && state.reg[step.key] !== "") { state.regStep++; continue; }
      if (step.skipIf && step.skipIf()) { state.reg[step.key] = step.skipValue || "N/A"; state.regStep++; continue; }
      break;
    }

    if (state.regStep >= REG_STEPS.length) { return submitRegistration(); }

    const step = REG_STEPS[state.regStep];
    renderProgress();
    const q = step.q.replace(/\{(\w+)\}/g, (_, k) => escapeHtml(state.reg[k] || ""));
    await botSay(q, 450);

    if (step.type === "options") {
      addOptions(step.options(), (val) => handleRegAnswer(val), "grid");
    }
    userInput.focus();
  }

  function renderProgress() {
    const pct = Math.round((state.regStep / REG_STEPS.length) * 100);
    const wrap = el("div", "reg-progress");
    const bar = el("div", "bar");
    bar.style.width = pct + "%";
    wrap.appendChild(bar);
    chatWindow.appendChild(wrap);
    scrollDown();
  }

  async function handleRegAnswer(rawValue) {
    const step = REG_STEPS[state.regStep];
    const value = String(rawValue).trim();

    if (step.type === "optional") {
      state.reg[step.key] = /^(skip|no|none|n\/a|-)$/i.test(value) ? "" : value;
      state.regStep++;
      return askNextRegStep();
    }

    if (step.validate) {
      const res = step.validate(value);
      if (res !== true) {
        await botSay("⚠️ " + res, 350);
        if (step.type === "options") addOptions(step.options(), (v) => handleRegAnswer(v), "grid");
        userInput.focus();
        return;
      }
    }

    state.reg[step.key] = value;
    state.regStep++;
    return askNextRegStep();
  }

  // ============================================================
  //  Submit → Google Sheets (with on-device fallback)
  // ============================================================
  async function submitRegistration() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const assignedTo = CFG.assignedToByBranch[state.branch] || "Admissions Team";

    const payload = {
      date: dateStr,
      time: timeStr,
      fullName: state.reg.fullName || "",
      phone: state.reg.phone || "",
      email: state.reg.email || "",
      city: state.reg.city || "",
      branch: state.branch,
      interestedIn: state.reg.interestedIn || "",
      selectedItem: state.reg.selectedItem || "",
      batch: state.reg.batch || "",
      qualification: state.reg.qualification || "",
      occupation: state.reg.occupation || "",
      leadSource: state.reg.leadSource || "",
      notes: state.reg.notes || "",
      status: "New Lead",
      assignedTo: assignedTo,
      followUpDate: "",
    };

    await botSay("Submitting your registration… ⏳", 400);

    let leadId = null;
    if (CFG.sheetsWebAppUrl && /^https?:\/\//.test(CFG.sheetsWebAppUrl)) {
      try {
        const res = await fetch(CFG.sheetsWebAppUrl, {
          method: "POST",
          // text/plain avoids a CORS preflight against Apps Script
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data && data.leadId) leadId = data.leadId;
      } catch (err) {
        console.warn("Sheets submission failed, using local fallback:", err);
      }
    }

    if (!leadId) leadId = localLeadId();
    saveLocalLead(Object.assign({ leadId }, payload));

    renderSuccess(leadId, payload);
  }

  function localLeadId() {
    let n = parseInt(localStorage.getItem("bitsol_lead_counter") || "0", 10);
    n += 1;
    localStorage.setItem("bitsol_lead_counter", String(n));
    return "BM-" + String(n).padStart(6, "0");
  }

  function saveLocalLead(record) {
    try {
      const all = JSON.parse(localStorage.getItem("bitsol_leads") || "[]");
      all.push(record);
      localStorage.setItem("bitsol_leads", JSON.stringify(all));
    } catch (e) { /* ignore */ }
  }

  async function renderSuccess(leadId, payload) {
    await botSay(null, 500);
    const card = el("div", "success-card");
    card.innerHTML = `
      <div class="sc-badge">✅</div>
      <h3>Registration Submitted!</h3>
      <p>Thank you for registering with <strong>BITSOL MARKETING</strong>, ${escapeHtml(payload.fullName)}.</p>
      <div class="lead-id">${escapeHtml(leadId)}</div>
      <p>Your Lead ID above is saved. One of our <strong>${escapeHtml(payload.assignedTo)}</strong> counselors will contact you shortly. 🌟</p>
    `;
    chatWindow.appendChild(card);
    scrollDown();

    addWhatsAppButton();
    state.mode = "menu";
    addFollowUp([
      { icon: "🎓", label: "Browse courses", fn: showCourses },
      { icon: "🏠", label: "Main menu", fn: renderMainMenu },
    ]);
  }

  // ============================================================
  //  Free-text input routing
  // ============================================================
  inputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = "";
    handleTextInput(text);
  });

  async function handleTextInput(text) {
    // Handover keywords: always available
    if (isHandoverRequest(text)) {
      addUserMessage(text);
      return showHandover();
    }

    if (state.mode === "register") {
      addUserMessage(text);
      return handleRegAnswer(text);
    }

    if (state.mode === "branch") {
      // Try to match a typed branch name
      const match = DATA.branches.find((b) => b.name.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().includes(b.name.split(" ")[0].toLowerCase()));
      addUserMessage(text);
      if (match) return onBranchPicked(match.name);
      await botSay("Please tap one of the branch options above to continue 👇", 400);
      return;
    }

    // menu / browsing modes → sales intelligence + gentle guidance
    addUserMessage(text);
    return handleFreeText(text);
  }

  function isHandoverRequest(text) {
    const t = text.toLowerCase().trim();
    // Only trigger when the message is essentially just the keyword
    return HANDOVER_KEYWORDS.some((k) => t === k || t === "talk to " + k || t === "i want an " + k || t === "call me");
  }

  async function handleFreeText(text) {
    const t = text.toLowerCase();

    // Sales intelligence
    if (/(freelanc|earn|income|side hustle|kamai|paisa)/.test(t)) {
      await botSay(
        "💡 If your goal is <strong>freelancing & earning</strong>, these courses are perfect for you:",
        500
      );
      recommendCourses(["Digital Marketing with AI", "Graphic Designing with AI", "Video Editing with AI", "Full Stack Web Development with AI"]);
      return;
    }
    if (/(automat|workflow|chatbot|bot)/.test(t)) {
      await botSay("💡 For <strong>automation</strong>, I'd recommend these programs:", 500);
      recommendCourses(["AI Chatbots & Business Automation", "AI Automation & Workflow Management"]);
      return;
    }
    if (/(business|company|shop|store|brand|website|seo|marketing service)/.test(t)) {
      await botSay("💡 It sounds like you might benefit from our <strong>Business Services</strong>. Let me show you 👇", 500);
      return showServices();
    }
    if (/(course|class|learn|study|training|seekh|parh)/.test(t)) {
      return showCourses();
    }
    if (/(register|enroll|admission|join|sign up|dakhla)/.test(t)) {
      return startRegistration();
    }
    if (/(fee|price|cost|charges|kitn)/.test(t)) {
      await botSay("Here are our courses with fees — tap any for full details:", 500);
      return showCourses();
    }
    if (/\b(hi|hello|hey|salam|assalam|aoa)\b/.test(t)) {
      await botSay("Wa Alaikum Assalam! 👋 How can I help you today?", 400);
      return renderMainMenu();
    }

    await botSay(
      "I'd love to help with that! 😊 Please choose an option below, or type <strong>\"agent\"</strong> anytime to talk to a live counselor.",
      450
    );
    renderMainMenu();
  }

  function recommendCourses(titles) {
    const items = titles
      .map((tt) => DATA.courses.find((c) => c.title === tt))
      .filter(Boolean);
    addOptions(
      items.map((c) => ({ icon: c.icon, label: `${c.title} — ${c.fee}`, value: c.id })),
      (id) => showCourseDetail(DATA.courses.find((c) => c.id === id)),
      "grid"
    );
    addFollowUp([
      { icon: "📝", label: "Register now", fn: () => startRegistration() },
      { icon: "🏠", label: "Main menu", fn: renderMainMenu },
    ]);
  }

  // ============================================================
  //  Init
  // ============================================================
  restartBtn.addEventListener("click", startConversation);
  startConversation();
})();
