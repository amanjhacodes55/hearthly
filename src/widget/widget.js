/*! Hearthly widget — AGPL-3.0-or-later. Copyright © 2026 Aman Jha. Embed:
 *  <script src="https://HOST/widget.js" data-website="WEBSITE_ID" async></script>
 * JS API: Hearthly.open() .close() .toggle() .identify({email,name,phone,data,user_hash}) .track(name, props)
 *         .on(event, fn) .off(event, fn) .send(text) .push(["set","user:email","x"]) .reset()
 */
(function () {
  "use strict";
  var doc = document;
  var script = doc.currentScript || doc.querySelector("script[data-website]");
  if (!script || window.__hearthlyLoaded) return;
  window.__hearthlyLoaded = true;
  var WID = script.getAttribute("data-website");
  var PREVIEW = script.getAttribute("data-preview") === "1";
  var ORIGIN = new URL(script.src, location.href).origin;
  var KEY = "hearthly:" + WID;
  var queued = Array.isArray(window.Hearthly) ? window.Hearthly : [];

  // ---------------------------------------------------------------- state
  var S = {
    cfg: null, token: null, visitor: {}, conv: null, msgs: [], open: false, unread: 0, typing: null, seenAt: null,
    status: { online: false }, view: "chat", uploads: [], es: null, poll: null, pageStart: Date.now(), lastSync: null, rated: false, help: [], ready: false,
  };
  var handlers = {};
  var STR = {
    title: "Chat with us", placeholder: "Write a message…", send: "Send", online: "We're online", away: "We reply as soon as we can",
    offline: "We're away", help: "Help", chat: "Chat", searchHelp: "Search our help center", noArticles: "No articles found",
    rateTitle: "How was this conversation?", rateThanks: "Thanks for your feedback!", ratePlaceholder: "Tell us more (optional)",
    transcript: "Email me this transcript", transcriptSent: "Transcript on its way ✉️", emailPlaceholder: "you@company.com",
    prechatTitle: "Before we start", start: "Start chat", seen: "Seen", typing: "is typing", attach: "Attach a file",
    emoji: "Emoji", dropHere: "Drop files to attach", poweredBy: "Chat by Hearthly", leaveEmail: "Get notified by email", save: "Save",
    you: "You", close: "Close", tooBig: "Files must be under 10 MB", uploadFailed: "Upload failed",
  };
  var t = function (k) { return (S.cfg && S.cfg.widget.strings && S.cfg.widget.strings[k]) || STR[k]; };

  function emit(ev, data) { (handlers[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(KEY + ":" + k); if (v === null) localStorage.removeItem(KEY + ":" + k); else localStorage.setItem(KEY + ":" + k, v); } catch { return null; } }
  function sessionId() {
    try { var s = sessionStorage.getItem(KEY + ":sid"); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(KEY + ":sid", s); } return s; } catch { return "nosession"; }
  }
  function api(path, body, method) {
    var h = { "Content-Type": "application/json" };
    if (S.token) h["Hearthly-Token"] = S.token;
    return fetch(ORIGIN + "/api/widget/" + path, { method: method || (body ? "POST" : "GET"), headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function el(tag, attrs, kids) {
    var e = doc.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? doc.createTextNode(c) : c); });
    return e;
  }
  var ICON = {
    hearth: "M12 3.5c5 0 8.5 3.3 8.5 7.6s-3.5 7.6-8.5 7.6c-1 0-2-.1-2.9-.4L5 20.5l.9-3.6c-1.5-1.3-2.4-3.4-2.4-5.8 0-4.3 3.5-7.6 8.5-7.6zM12 7.3c.4 1.8 2.7 2.8 2.7 5.1a2.7 2.7 0 0 1-5.4 0c0-1 .5-1.9 1.1-2.5.1.8.5 1.3 1 1.6-.3-1.6.1-3.1.6-4.2z",
    bubble: "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z",
    wave: "M7 11.5V6a1.5 1.5 0 0 1 3 0v4m0-1.5V4.5a1.5 1.5 0 0 1 3 0v5m0-3a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.6-2.2L4.5 15.5a1.6 1.6 0 0 1 2.4-2.1L8 14.5",
    spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
    help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14m0 3h.01",
    close: "M6 6l12 12M18 6L6 18", send: "M4 12l16-8-6 16-2.5-6.5z", clip: "M20 11.5l-8.2 8.2a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8",
    smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01", minus: "M6 12h12",
    file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5", mail: "M4 6h16v12H4zM4 7l8 6 8-6", search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm9 2l-4-4",
  };
  function svg(name, size) {
    var s = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size || 20); s.setAttribute("height", size || 20); s.setAttribute("aria-hidden", "true");
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.9"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    var p = doc.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICON[name]); s.appendChild(p); return s;
  }
  /** Text → nodes with safe auto-linking (http/https only). Never uses innerHTML for message content. */
  function richText(text) {
    var frag = doc.createDocumentFragment();
    var re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
      var href = m[1].indexOf(ORIGIN + "/help/") === 0 || /^https?:\/\//.test(m[1]) ? m[1] : "#";
      frag.appendChild(el("a", { href: href, target: "_blank", rel: "noopener noreferrer nofollow", text: m[1] }));
      last = re.lastIndex;
    }
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    return frag;
  }
  function fileUrl(a, dl) { return ORIGIN + "/api/files/" + a.id + "?token=" + encodeURIComponent(S.token || "") + (dl ? "&download=1" : ""); }
  function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function beep() {
    if (!S.cfg || !S.cfg.widget.sound) return;
    try {
      var C = window.AudioContext || window.webkitAudioContext; var ctx = beep.ctx || (beep.ctx = new C());
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = 880; o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.32);
    } catch { /* no audio */ }
  }

  // ---------------------------------------------------------------- styles
  function css(w) {
    var dark = w.theme === "dark" || (w.theme === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    var bg = dark ? "#1f1529" : "#ffffff", fg = dark ? "#f7ede5" : "#2b1b3d", mut = dark ? "#b3a2bd" : "#67566f", sub = dark ? "#2a1e37" : "#f8f2ec", bd = dark ? "#3b2c4b" : "#ece2d8";
    var grad = w.gradient ? "linear-gradient(135deg," + w.color + "," + w.accent + ")" : w.color, r = w.radius + "px", side = w.position === "left" ? "left" : "right";
    return ":host{all:initial}*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
      ".cc{--c:" + w.color + ";--g:" + grad + ";--bg:" + bg + ";--fg:" + fg + ";--mut:" + mut + ";--sub:" + sub + ";--bd:" + bd + ";--r:" + r + ";position:fixed;" + side + ":20px;bottom:20px;z-index:2147483000;color:var(--fg);font-size:14px;line-height:1.45}" +
      ".launch{display:flex;align-items:center;gap:8px;height:58px;min-width:58px;padding:0 17px;border:0;border-radius:29px;background:var(--g);color:#fff;cursor:pointer;box-shadow:0 10px 30px -6px rgba(0,0,0,.35);transition:transform .2s;font-weight:600;font-size:15px;margin-" + side + ":0;float:" + side + "}" +
      ".launch:hover{transform:translateY(-2px) scale(1.03)}.launch:focus-visible,button:focus-visible,a:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid var(--c);outline-offset:2px}" +
      ".badge{position:absolute;top:-4px;" + (side === "left" ? "left" : "right") + ":-4px;min-width:20px;height:20px;border-radius:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid #fff}" +
      ".panel{position:absolute;bottom:72px;" + side + ":0;width:380px;height:min(620px,calc(100vh - 110px));background:var(--bg);border-radius:var(--r);box-shadow:0 24px 60px -12px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--bd);transform-origin:bottom " + side + ";animation:pop .22s cubic-bezier(.2,.9,.3,1.2)}" +
      "@keyframes pop{from{opacity:0;transform:scale(.92) translateY(10px)}}@media(max-width:480px){.panel{position:fixed;inset:0;width:auto;height:auto;border-radius:0;bottom:0}.cc.open .launch{display:none}}" +
      ".hd{background:var(--g);color:#fff;padding:16px 16px 14px;position:relative}.hd h2{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em}.hd p{margin:3px 0 0;font-size:12.5px;opacity:.92;display:flex;align-items:center;gap:6px}" +
      ".dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 2px rgba(255,255,255,.35)}.dot.off{background:#fbbf24}" +
      ".team{display:flex;margin-bottom:8px}.av{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.8);margin-right:-8px;background:rgba(255,255,255,.25);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}.av img{width:100%;height:100%;object-fit:cover}" +
      ".x{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.18);border:0;color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      ".tabs{display:flex;gap:4px;margin-top:12px}.tab{flex:1;border:0;border-radius:9px;padding:6px;background:rgba(255,255,255,.16);color:#fff;font-weight:600;cursor:pointer;font-size:13px}.tab.on{background:#fff;color:var(--c)}" +
      ".body{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:6px;background:var(--bg)}" +
      ".m{max-width:82%;display:flex;flex-direction:column;gap:3px}.m.v{align-self:flex-end;align-items:flex-end}.m.o{align-self:flex-start}" +
      ".b{padding:9px 13px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}.v .b{background:var(--g);color:#fff;border-bottom-right-radius:5px}.o .b{background:var(--sub);border-bottom-left-radius:5px}" +
      ".v .b a{color:#fff}.o .b a{color:var(--c)}.who{font-size:11.5px;color:var(--mut);margin:6px 4px 0}.meta{font-size:10.5px;color:var(--mut);margin:0 4px}" +
      ".img{max-width:220px;max-height:200px;border-radius:12px;cursor:zoom-in;display:block;border:1px solid var(--bd)}.fil{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:12px;background:var(--sub);color:var(--fg);text-decoration:none;font-size:13px;border:1px solid var(--bd)}" +
      ".qr{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.qr button{border:1.5px solid var(--c);color:var(--c);background:transparent;border-radius:16px;padding:5px 11px;cursor:pointer;font-weight:600;font-size:13px}.qr button:hover{background:var(--c);color:#fff}" +
      ".welcome{background:var(--sub);border-radius:16px;padding:12px 14px;margin-bottom:6px;border:1px solid var(--bd)}" +
      ".typing{display:flex;gap:4px;padding:11px 14px;background:var(--sub);border-radius:16px;width:fit-content}.typing i{width:6px;height:6px;border-radius:50%;background:var(--mut);animation:bl 1.2s infinite}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}@keyframes bl{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}" +
      ".ft{border-top:1px solid var(--bd);padding:10px 10px 8px;background:var(--bg)}.row{display:flex;align-items:flex-end;gap:6px}" +
      "textarea{flex:1;resize:none;border:1px solid var(--bd);border-radius:14px;padding:10px 12px;font-size:14px;max-height:120px;min-height:42px;background:var(--sub);color:var(--fg);outline:none}" +
      ".ib{border:0;background:transparent;color:var(--mut);width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}.ib:hover{background:var(--sub);color:var(--fg)}" +
      ".sb{background:var(--g);color:#fff}.sb:hover{background:var(--g);color:#fff;filter:brightness(1.08)}.sb:disabled{opacity:.45}" +
      ".chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.chip{display:flex;align-items:center;gap:6px;background:var(--sub);border:1px solid var(--bd);border-radius:9px;padding:4px 8px;font-size:12px}.chip button{border:0;background:none;color:var(--mut);cursor:pointer;padding:0}" +
      ".brand{text-align:center;font-size:11px;color:var(--mut);margin-top:6px}.brand a{color:inherit;text-decoration:none}" +
      ".emo{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;background:var(--bg);border:1px solid var(--bd);border-radius:12px;margin-bottom:6px}.emo button{border:0;background:none;font-size:20px;cursor:pointer;border-radius:8px;padding:3px}.emo button:hover{background:var(--sub)}" +
      ".card{border:1px solid var(--bd);border-radius:16px;padding:14px;background:var(--sub);display:flex;flex-direction:column;gap:8px;margin:6px 0}.card h3{margin:0;font-size:14px}" +
      ".stars{display:flex;gap:4px}.stars button{border:0;background:none;font-size:26px;cursor:pointer;color:#d1d5db;padding:0;line-height:1}.stars button.on{color:#f59e0b}" +
      "input{border:1px solid var(--bd);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--bg);color:var(--fg);width:100%;outline:none}label{font-size:12px;font-weight:600;color:var(--mut);display:flex;flex-direction:column;gap:4px}" +
      ".btn{border:0;border-radius:11px;padding:10px 14px;background:var(--g);color:#fff;font-weight:700;cursor:pointer;font-size:14px}.lnk{border:0;background:none;color:var(--c);cursor:pointer;font-size:12.5px;font-weight:600;padding:2px}" +
      ".art{display:block;padding:11px 13px;border:1px solid var(--bd);border-radius:12px;text-decoration:none;color:var(--fg);background:var(--bg)}.art:hover{border-color:var(--c)}.art b{display:block;font-size:14px}.art span{font-size:12.5px;color:var(--mut)}" +
      ".drop{position:absolute;inset:0;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;z-index:5;border-radius:var(--r);pointer-events:none}" +
      ".lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:10;cursor:zoom-out}.lb img{max-width:92vw;max-height:90vh;border-radius:8px}" +
      ".err{color:#ef4444;font-size:12px;padding:0 4px 4px}";
  }

  // ---------------------------------------------------------------- DOM
  var host, root, wrap;
  function mount() {
    host = el("div", { id: "hearthly-root" });
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    doc.body.appendChild(host);
    render();
  }
  function setOpen(v) {
    if (S.open === v) return;
    S.open = v;
    if (v) { S.unread = 0; markRead(); }
    render();
    emit(v ? "open" : "close");
    if (v) setTimeout(function () { var ta = root.querySelector("textarea"); if (ta && !matchMedia("(max-width:480px)").matches) ta.focus(); var b = root.querySelector(".body"); if (b) b.scrollTop = b.scrollHeight; }, 30);
  }

  function header(w) {
    var team = (S.cfg.team || []).slice(0, 3);
    return el("div", { class: "hd" }, [
      team.length ? el("div", { class: "team" }, team.map(function (m) { return el("span", { class: "av", title: m.name }, [m.avatar ? el("img", { src: m.avatar, alt: m.name }) : (m.name || "?").charAt(0).toUpperCase()]); })) : null,
      el("h2", { text: w.teamName || w.title || t("title") }),
      el("p", {}, [el("span", { class: "dot" + (S.status.online ? "" : " off") }), S.status.online ? t("online") : S.cfg.status.withinHours === false ? t("offline") : t("away")]),
      el("button", { class: "x", "aria-label": t("close"), onclick: function () { setOpen(false); } }, [svg("minus", 18)]),
      w.kbSearch ? el("div", { class: "tabs", role: "tablist" }, [
        el("button", { class: "tab" + (S.view !== "help" ? " on" : ""), role: "tab", "aria-selected": S.view !== "help" ? "true" : "false", onclick: function () { S.view = "chat"; render(); } }, [t("chat")]),
        el("button", { class: "tab" + (S.view === "help" ? " on" : ""), role: "tab", "aria-selected": S.view === "help" ? "true" : "false", onclick: function () { S.view = "help"; render(); searchHelp(""); } }, [t("help")]),
      ]) : null,
    ]);
  }

  function messageNode(m, prev) {
    var mine = m.from === "visitor";
    var box = el("div", { class: "m " + (mine ? "v" : "o") });
    if (!mine && (!prev || prev.from === "visitor" || (prev.author && m.author && prev.author.name !== m.author.name))) box.appendChild(el("div", { class: "who", text: (m.author && m.author.name) || S.cfg.website.name }));
    if (m.text) { var b = el("div", { class: "b" }); b.appendChild(richText(m.text)); box.appendChild(b); }
    (m.attachments || []).forEach(function (a) {
      if (/^image\//.test(a.type)) box.appendChild(el("img", { class: "img", src: fileUrl(a), alt: a.name, loading: "lazy", onclick: function () { lightbox(fileUrl(a)); } }));
      else box.appendChild(el("a", { class: "fil", href: fileUrl(a, true), target: "_blank", rel: "noopener" }, [svg("file", 18), el("span", { text: a.name + " · " + fmtSize(a.size) })]));
    });
    if (m.actions && m.actions.length && m === S.msgs[S.msgs.length - 1])
      box.appendChild(el("div", { class: "qr" }, m.actions.map(function (a, i) { return el("button", { onclick: function () { api("action", { messageId: m.id, index: i }).catch(function () {}); }, text: a.label }); })));
    return box;
  }
  function lightbox(src) {
    var lb = el("div", { class: "lb", role: "dialog", "aria-label": "Image preview", tabindex: "-1", onclick: function () { lb.remove(); }, onkeydown: function (e) { if (e.key === "Escape") lb.remove(); } }, [el("img", { src: src, alt: "" })]);
    root.appendChild(lb); lb.focus();
  }

  function chatBody(w) {
    var body = el("div", { class: "body", role: "log", "aria-live": "polite" });
    body.appendChild(el("div", { class: "welcome" }, [richText(w.welcome || "")]));
    if (!S.msgs.length && w.quickReplies && w.quickReplies.length)
      body.appendChild(el("div", { class: "qr" }, w.quickReplies.map(function (q, i) { return el("button", { text: q.label, onclick: function () { send(q.label, [], { index: i }); } }); })));
    var lastVisitor = null;
    S.msgs.forEach(function (m, i) { body.appendChild(messageNode(m, S.msgs[i - 1])); if (m.from === "visitor") lastVisitor = m; });
    if (lastVisitor && S.seenAt && new Date(S.seenAt) >= new Date(lastVisitor.created_at) && S.msgs[S.msgs.length - 1] === lastVisitor) body.appendChild(el("div", { class: "meta", style: "align-self:flex-end", text: t("seen") + " · " + fmtTime(S.seenAt) }));
    if (S.typing) body.appendChild(el("div", { class: "m o" }, [el("div", { class: "who", text: S.typing + " " + t("typing") }), el("div", { class: "typing", "aria-label": t("typing") }, [el("i"), el("i"), el("i")])]));
    if (needsPrechat(w)) body.appendChild(prechatCard(w));
    else if (S.conv && S.conv.status === "resolved" && w.allowRating && !S.conv.rating && !S.rated) body.appendChild(ratingCard());
    else if (S.rated) body.appendChild(el("div", { class: "card" }, [el("h3", { text: t("rateThanks") })]));
    if (S.msgs.length && !S.visitor.email && !needsPrechat(w)) body.appendChild(emailCard());
    if (S.msgs.length && w.allowTranscript) body.appendChild(el("button", { class: "lnk", style: "align-self:center", onclick: transcript }, [t("transcript")]));
    return body;
  }
  function needsPrechat(w) { return w.preChat && w.preChat.enabled && w.preChat.fields.length && !S.visitor.email && !store("prechat") && !S.msgs.length; }
  function prechatCard(w) {
    var inputs = {};
    var form = el("form", { class: "card", onsubmit: function (e) {
      e.preventDefault(); var data = {}, idn = {};
      for (var k in inputs) { var v = inputs[k].value.trim(); if (!v) continue; if (k === "email" || k === "name" || k === "phone") idn[k] = v; else data[k] = v; }
      idn.data = data; store("prechat", "1");
      api("identify", idn).then(function (r) { S.visitor = r.visitor; render(); }).catch(function (er) { alert(er.message); store("prechat", null); });
    } }, [el("h3", { text: t("prechatTitle") })]);
    w.preChat.fields.forEach(function (f) {
      var inp = el(f.type === "textarea" ? "textarea" : "input", { type: f.type === "textarea" ? null : f.type, required: f.required, name: f.key, autocomplete: f.key === "email" ? "email" : f.key === "name" ? "name" : f.key === "phone" ? "tel" : "off" });
      inputs[f.key] = inp; form.appendChild(el("label", {}, [f.label + (f.required ? " *" : ""), inp]));
    });
    form.appendChild(el("button", { class: "btn", type: "submit", text: t("start") }));
    return form;
  }
  function ratingCard() {
    var score = S.rateScore || 0, comment = el("input", { placeholder: t("ratePlaceholder"), "aria-label": t("ratePlaceholder") }), stars = el("div", { class: "stars", role: "radiogroup", "aria-label": t("rateTitle") });
    for (var i = 1; i <= 5; i++) (function (n) {
      stars.appendChild(el("button", { type: "button", role: "radio", class: n <= score ? "on" : "", "aria-label": n + " / 5", onclick: function () { score = S.rateScore = n; [].forEach.call(stars.children, function (b, j) { b.className = j < n ? "on" : ""; b.setAttribute("aria-checked", j === n - 1 ? "true" : "false"); }); } }, ["★"]));
    })(i);
    return el("div", { class: "card" }, [el("h3", { text: t("rateTitle") }), stars, comment, el("button", { class: "btn", onclick: function () {
      if (!score) return; api("rate", { score: score, comment: comment.value }).then(function () { S.rated = true; render(); emit("rating:submitted", { score: score }); });
    } }, [t("save")])]);
  }
  function emailCard() {
    var inp = el("input", { type: "email", placeholder: t("emailPlaceholder"), "aria-label": t("leaveEmail") });
    return el("form", { class: "card", onsubmit: function (e) { e.preventDefault(); if (!inp.checkValidity() || !inp.value) return; api("identify", { email: inp.value }).then(function (r) { S.visitor = r.visitor; render(); }); } },
      [el("h3", { text: t("leaveEmail") }), el("div", { class: "row" }, [inp, el("button", { class: "btn", type: "submit", text: "OK" })])]);
  }
  function transcript() {
    var email = S.visitor.email || prompt(t("emailPlaceholder"));
    if (!email) return;
    api("transcript", { email: email }).then(function () { toastIn(t("transcriptSent")); }).catch(function (e) { toastIn(e.message); });
  }
  function toastIn(msg) { var b = root.querySelector(".body"); if (b) { b.appendChild(el("div", { class: "meta", style: "align-self:center", text: msg })); b.scrollTop = b.scrollHeight; } }

  var EMOJI = "😀 😂 😊 😍 🤔 😅 😎 🥳 😢 😡 👍 👎 👏 🙏 💪 👋 🎉 ❤️ 🔥 ✨ ✅ ❌ ⭐ 💡 🚀 📎 📦 💳 🕐 📧 🙌 🤝".split(" ");
  var emojiOpen = false, draft = "", err = "";
  function footer(w) {
    var ta = el("textarea", { rows: "1", placeholder: t("placeholder"), "aria-label": t("placeholder"), maxlength: "5000" });
    ta.value = draft;
    var sendBtn = el("button", { class: "ib sb", "aria-label": t("send"), disabled: !draft.trim() && !S.uploads.length, onclick: function () { submit(); } }, [svg("send", 18)]);
    function submit() { var v = ta.value.trim(); if (!v && !S.uploads.length) return; var up = S.uploads.filter(function (u) { return u.id; }); draft = ""; S.uploads = []; send(v, up); }
    var typingT = 0;
    ta.addEventListener("input", function () {
      draft = ta.value; sendBtn.disabled = !draft.trim() && !S.uploads.length;
      ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px";
      var now = Date.now(); if (now - typingT > 1500 && S.conv) { typingT = now; api("typing", { typing: true, preview: draft.slice(0, 200) }).catch(function () {}); }
      clearTimeout(ta._s); ta._s = setTimeout(function () { if (S.conv) api("typing", { typing: false }).catch(function () {}); }, 3000);
    });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } });
    ta.addEventListener("paste", function (e) {
      var files = [].slice.call((e.clipboardData && e.clipboardData.files) || []);
      if (files.length) { e.preventDefault(); files.forEach(upload); }
    });
    var fileIn = el("input", { type: "file", multiple: true, style: "display:none", accept: "image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.docx,.xlsx,.zip", onchange: function () { [].forEach.call(fileIn.files, upload); fileIn.value = ""; } });
    var kids = [];
    if (emojiOpen) kids.push(el("div", { class: "emo", role: "listbox", "aria-label": t("emoji") }, EMOJI.map(function (em) { return el("button", { type: "button", "aria-label": em, onclick: function () { draft = (ta.value || "") + em; emojiOpen = false; render(); focusTa(); } }, [em]); })));
    if (S.uploads.length) kids.push(el("div", { class: "chips" }, S.uploads.map(function (u, i) {
      return el("span", { class: "chip" }, [u.id ? "📎 " + u.name : "⏳ " + u.name, el("button", { "aria-label": "Remove", onclick: function () { S.uploads.splice(i, 1); render(); } }, ["✕"])]);
    })));
    if (err) kids.push(el("div", { class: "err", role: "alert", text: err }));
    kids.push(el("div", { class: "row" }, [
      el("button", { class: "ib", "aria-label": t("emoji"), "aria-expanded": emojiOpen ? "true" : "false", onclick: function () { emojiOpen = !emojiOpen; draft = ta.value; render(); } }, [svg("smile")]),
      w.allowAttachments ? el("button", { class: "ib", "aria-label": t("attach"), onclick: function () { fileIn.click(); } }, [svg("clip")]) : null,
      ta, sendBtn, fileIn,
    ]));
    if (w.showBranding) kids.push(el("div", { class: "brand" }, [el("a", { href: ORIGIN + "/?ref=widget", target: "_blank", rel: "noopener", text: "⚡ " + t("poweredBy") })]));
    return el("div", { class: "ft" }, kids);
  }
  function focusTa() { setTimeout(function () { var ta = root.querySelector("textarea"); if (ta) { ta.focus(); ta.selectionStart = ta.value.length; } }, 0); }

  function helpBody() {
    var q = el("input", { type: "search", placeholder: t("searchHelp"), "aria-label": t("searchHelp"), value: S.helpQ || "" });
    var timer; q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { searchHelp(q.value); }, 250); });
    var list = el("div", { style: "display:flex;flex-direction:column;gap:8px" }, S.help.length ? S.help.map(function (a) {
      return el("a", { class: "art", href: ORIGIN + a.url, target: "_blank", rel: "noopener" }, [el("b", { text: a.title }), el("span", { text: a.excerpt || "" })]);
    }) : [el("div", { class: "meta", text: t("noArticles") })]);
    setTimeout(function () { var i = root.querySelector('input[type="search"]'); if (i && S.helpFocus) { i.focus(); i.selectionStart = i.value.length; } }, 0);
    return el("div", { class: "body" }, [q, list, el("a", { class: "lnk", href: ORIGIN + S.cfg.help, target: "_blank", rel: "noopener", style: "text-align:center;margin-top:8px", text: "→ " + t("help") })]);
  }
  function searchHelp(q) {
    S.helpQ = q; S.helpFocus = true;
    fetch(ORIGIN + "/api/widget/kb?website=" + encodeURIComponent(WID) + "&q=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) { S.help = j.articles || []; if (S.view === "help") render(); });
  }

  var dragDepth = 0;
  function render() {
    if (!root || !S.cfg) return;
    var w = S.cfg.widget;
    var hadFocus = root.activeElement && root.activeElement.tagName === "TEXTAREA";
    var prevBody = root.querySelector(".body"), atBottom = !prevBody || prevBody.scrollHeight - prevBody.scrollTop - prevBody.clientHeight < 80;
    root.innerHTML = ""; // structure only; all user content below is inserted as text nodes
    root.appendChild(el("style", { text: css(w) }));
    wrap = el("div", { class: "cc" + (S.open ? " open" : "") });
    if (S.open) {
      var panel = el("div", { class: "panel", role: "dialog", "aria-label": w.title || t("title") }, [header(w), S.view === "help" ? helpBody() : chatBody(w), S.view === "help" ? null : footer(w)]);
      if (w.allowAttachments) {
        panel.addEventListener("dragenter", function (e) { e.preventDefault(); dragDepth++; if (!panel.querySelector(".drop")) panel.appendChild(el("div", { class: "drop", text: t("dropHere") })); });
        panel.addEventListener("dragover", function (e) { e.preventDefault(); });
        panel.addEventListener("dragleave", function () { if (--dragDepth <= 0) { dragDepth = 0; var d = panel.querySelector(".drop"); if (d) d.remove(); } });
        panel.addEventListener("drop", function (e) { e.preventDefault(); dragDepth = 0; var d = panel.querySelector(".drop"); if (d) d.remove(); [].forEach.call(e.dataTransfer.files || [], upload); });
      }
      panel.addEventListener("keydown", function (e) { if (e.key === "Escape" && !root.querySelector(".lb")) setOpen(false); });
      wrap.appendChild(panel);
    }
    var launcher = el("button", { class: "launch", "aria-label": S.open ? t("close") : w.title || t("title"), "aria-expanded": S.open ? "true" : "false", onclick: function () { setOpen(!S.open); } },
      [svg(S.open ? "close" : w.launcherIcon || "hearth", 26), !S.open && w.launcherText ? el("span", { text: w.launcherText }) : null]);
    wrap.appendChild(el("div", { style: "position:relative" }, [launcher, S.unread && !S.open ? el("span", { class: "badge", "aria-label": S.unread + " unread", text: String(S.unread) }) : null]));
    root.appendChild(wrap);
    var body = root.querySelector(".body");
    if (body && atBottom) body.scrollTop = body.scrollHeight;
    if (hadFocus) focusTa();
  }

  // ---------------------------------------------------------------- actions
  function upload(file) {
    err = "";
    if (file.size > 10 * 1024 * 1024) { err = t("tooBig"); render(); return; }
    var item = { name: file.name || "pasted-image.png", id: null };
    S.uploads.push(item); render();
    var fd = new FormData(); fd.append("file", file, item.name);
    fetch(ORIGIN + "/api/widget/upload", { method: "POST", headers: { "Hearthly-Token": S.token }, body: fd })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (j) { Object.assign(item, j); render(); })
      .catch(function (e) { S.uploads.splice(S.uploads.indexOf(item), 1); err = e.message || t("uploadFailed"); render(); });
  }
  function send(text, attachments, quick) {
    if (!S.token) return;
    err = "";
    var tmp = { id: "tmp" + Date.now(), from: "visitor", text: text, attachments: attachments || [], created_at: new Date().toISOString(), author: null };
    S.msgs.push(tmp); emojiOpen = false; render();
    api("messages", { text: text, attachments: attachments || [], quickReply: quick ? quick.index : undefined }).then(function (r) {
      var i = S.msgs.indexOf(tmp); if (i >= 0) S.msgs[i] = r.message;
      var isNew = !S.conv; S.conv = r.conversation; if (isNew) connect();
      render(); emit("message:sent", r.message);
    }).catch(function (e) { S.msgs.splice(S.msgs.indexOf(tmp), 1); err = e.message; draft = text; render(); });
  }
  function markRead() { if (S.conv && S.token && S.open && !doc.hidden) api("read", {}).catch(function () {}); }

  function addMessage(m) {
    if (S.msgs.some(function (x) { return x.id === m.id; })) return;
    if (m.from === "visitor") { var tmp = S.msgs.filter(function (x) { return /^tmp/.test(x.id) && x.text === m.text; })[0]; if (tmp) { S.msgs[S.msgs.indexOf(tmp)] = m; render(); return; } }
    S.msgs.push(m); S.lastSync = m.created_at;
    if (m.from !== "visitor") {
      S.typing = null;
      if (!S.open || doc.hidden) { S.unread++; beep(); }
      // proactive chat from an operator: pop the widget open on larger screens
      if (!S.open && m.from === "operator" && !matchMedia("(max-width:640px)").matches) { S.typing = null; setOpen(true); return; }
      if (S.open) markRead();
      emit("message:received", m);
    }
    render();
  }

  // ---------------------------------------------------------------- realtime: SSE with polling fallback
  function connect() {
    if (PREVIEW || !S.token) return;
    if (S.es) S.es.close();
    if (!window.EventSource) return startPolling();
    var es = (S.es = new EventSource(ORIGIN + "/api/widget/stream?token=" + encodeURIComponent(S.token)));
    var fails = 0;
    es.addEventListener("open", function () { fails = 0; stopPolling(); sync(); });
    es.addEventListener("message", function (e) { var m = JSON.parse(e.data); if (!S.conv) S.conv = { id: m.conversation_id, status: "open" }; addMessage(m); });
    es.addEventListener("typing", function (e) { var d = JSON.parse(e.data); S.typing = d.typing ? d.name || "…" : null; render(); clearTimeout(S.typT); if (d.typing) S.typT = setTimeout(function () { S.typing = null; render(); }, 6000); });
    es.addEventListener("read", function (e) { S.seenAt = JSON.parse(e.data).at; render(); });
    es.addEventListener("status", function (e) { var d = JSON.parse(e.data); if (S.conv) { S.conv.status = d.status; if (d.status !== "resolved") S.rated = false; render(); } });
    es.onerror = function () { if (++fails >= 3) { es.close(); S.es = null; startPolling(); setTimeout(connect, 30000); } };
  }
  function startPolling() { if (!S.poll) S.poll = setInterval(sync, 5000); }
  function stopPolling() { clearInterval(S.poll); S.poll = null; }
  function sync() {
    if (!S.token) return;
    api("messages?since=" + encodeURIComponent(S.lastSync || ""), null, "GET").then(function (r) {
      if (r.conversation) { var st = S.conv && S.conv.status; S.conv = r.conversation; if (st !== r.conversation.status) render(); }
      r.messages.forEach(addMessage);
    }).catch(function () {});
  }

  // ---------------------------------------------------------------- tracking: heartbeat, triggers, SPA navigation
  var pingTimer;
  function schedulePing(sec) { clearTimeout(pingTimer); pingTimer = setTimeout(ping, Math.max(2, Math.min(30, sec || 30)) * 1000); }
  function ping() {
    if (!S.token || doc.hidden) return schedulePing(30);
    api("ping", { timeOnPage: Math.round((Date.now() - S.pageStart) / 1000) }).then(handleTrig).catch(function () { schedulePing(30); });
  }
  function handleTrig(r) {
    if (r.status) { var was = S.status.online; S.status = r.status; if (was !== r.status.online) render(); }
    if (r.open && !S.open) { if (!S.es) sync(); setOpen(true); }
    schedulePing(r.nextCheckSec != null ? r.nextCheckSec + 0.5 : 30);
  }
  var lastUrl = location.href;
  function onNav() {
    if (location.href === lastUrl) return;
    var ref = lastUrl; lastUrl = location.href; S.pageStart = Date.now();
    if (hiddenHere()) { if (host) host.style.display = "none"; return; } else if (host) host.style.display = "";
    if (S.token) api("page", { url: location.href, title: doc.title, referrer: ref, sessionId: sessionId() }).then(handleTrig).catch(function () {});
  }
  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () { var r = orig.apply(this, arguments); setTimeout(onNav, 0); return r; };
  });
  window.addEventListener("popstate", onNav);
  window.addEventListener("hashchange", onNav);
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) { markRead(); ping(); } });

  function globMatch(p, s) { p = p.toLowerCase(); s = s.toLowerCase(); if (p.indexOf("*") < 0) return s.indexOf(p) >= 0; var parts = p.split("*"), pos = 0; for (var i = 0; i < parts.length; i++) { if (!parts[i]) continue; var ix = s.indexOf(parts[i], pos); if (ix < 0 || (i === 0 && ix !== 0)) return false; pos = ix + parts[i].length; } return true; }
  function hiddenHere() {
    var w = S.cfg.widget;
    if (w.hideOnMobile && matchMedia("(max-width:640px)").matches) return true;
    return (w.hideOnUrls || []).some(function (p) { return p && globMatch(p, location.href); });
  }

  // ---------------------------------------------------------------- public JS API
  var pendingIdentify = [];
  var Api = {
    open: function () { setOpen(true); }, close: function () { setOpen(false); }, toggle: function () { setOpen(!S.open); },
    isOpen: function () { return S.open; },
    show: function () { if (host) host.style.display = ""; }, hide: function () { if (host) host.style.display = "none"; },
    on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return Api; },
    off: function (ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); return Api; },
    identify: function (p) {
      if (!S.token) { pendingIdentify.push(p); return Promise.resolve(); }
      return api("identify", p || {}).then(function (r) { S.visitor = r.visitor; render(); return r; });
    },
    track: function (name, props) { if (!S.token) return pendingIdentify.push({ __track: [name, props] }); return api("event", { name: name, props: props || {}, url: location.href }).catch(function () {}); },
    send: function (text) { if (text) send(String(text), []); },
    reset: function () { store("token", null); store("prechat", null); S.token = null; S.msgs = []; S.conv = null; S.visitor = {}; if (S.es) S.es.close(); boot(); },
    push: function (cmd) {
      if (!Array.isArray(cmd)) return;
      var verb = cmd[0], key = cmd[1], val = cmd[2];
      if (verb === "set") {
        var map = { "user:email": "email", "user:nickname": "name", "user:name": "name", "user:phone": "phone", "user:company": "company", "user:avatar": "avatar" };
        if (map[key]) { var o = {}; o[map[key]] = Array.isArray(val) ? val[0] : val; Api.identify(o); }
        else if (key === "session:data") { var d = {}; (Array.isArray(val[0]) ? val : [val]).forEach(function (kv) { if (Array.isArray(kv)) d[kv[0]] = kv[1]; else for (var k in kv) d[k] = kv[k]; }); Api.identify({ data: d }); }
        else if (key === "session:event") (Array.isArray(val[0]) ? val : [val]).forEach(function (e) { Api.track(e[0], e[1]); });
      } else if (verb === "do") {
        if (key === "chat:open") Api.open(); else if (key === "chat:close") Api.close(); else if (key === "chat:toggle") Api.toggle();
        else if (key === "chat:show") Api.show(); else if (key === "chat:hide") Api.hide(); else if (key === "message:send") Api.send(Array.isArray(val) ? val[1] || val[0] : val);
        else if (key === "session:reset") Api.reset();
      } else if (verb === "on") Api.on(key, val);
      else if (verb === "off") Api.off(key, val);
    },
  };
  window.Hearthly = Api;
  window.$hearthly = { push: Api.push };

  // ---------------------------------------------------------------- boot
  function boot() {
    return api("session", {
      website: WID, token: store("token"), sessionId: sessionId(), url: location.href, title: doc.title, referrer: doc.referrer,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || ""), language: navigator.language || "",
    }).then(function (r) {
      S.token = r.token; store("token", r.token); S.visitor = r.visitor || {}; S.conv = r.conversation; S.msgs = r.messages || []; S.status = r.status || S.status;
      S.lastSync = S.msgs.length ? S.msgs[S.msgs.length - 1].created_at : null;
      S.unread = S.conv ? S.conv.unread || 0 : 0;
      render(); connect(); handleTrig(r);
      pendingIdentify.splice(0).forEach(function (p) { if (p.__track) Api.track(p.__track[0], p.__track[1]); else Api.identify(p); });
      if (!S.ready) { S.ready = true; emit("ready", { visitor: S.visitor }); }
    });
  }
  function previewBoot(cfg) {
    S.cfg = cfg; S.open = true; S.status = cfg.status || { online: true };
    S.msgs = [
      { id: "p1", from: "visitor", text: "Hi! Can I change my plan later?", attachments: [], created_at: new Date().toISOString() },
      { id: "p2", from: "operator", author: { name: (cfg.team[0] && cfg.team[0].name) || "Alex" }, text: "Absolutely — you can switch plans anytime from Settings → Billing 🙂", attachments: [], created_at: new Date().toISOString() },
    ];
    S.seenAt = new Date().toISOString();
    if (!root) mount(); else render();
  }

  function start() {
    if (PREVIEW) {
      window.addEventListener("message", function (e) { if (e.origin === ORIGIN && e.data && e.data.type === "hearthly:preview") previewBoot(e.data.config); });
      if (window.parent !== window) window.parent.postMessage({ type: "hearthly:preview-ready" }, ORIGIN);
      return;
    }
    fetch(ORIGIN + "/api/widget/config?website=" + encodeURIComponent(WID)).then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg.error) return console.warn("[Hearthly] " + cfg.error);
      S.cfg = cfg; S.status = cfg.status;
      mount();
      if (hiddenHere()) host.style.display = "none";
      return boot().then(function () {
        var w = cfg.widget;
        var auto = w.autoOpenAfterSec > 0 && (!w.autoOpenOnUrls || !w.autoOpenOnUrls.length || w.autoOpenOnUrls.some(function (p) { return globMatch(p, location.href); }));
        if (auto && !store("autoopened")) setTimeout(function () { if (!S.open) { store("autoopened", "1"); setOpen(true); } }, w.autoOpenAfterSec * 1000);
      });
    }).catch(function (e) { console.warn("[Hearthly] failed to load", e); }).then(function () {
      queued.forEach(function (c) { Api.push(c); });
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
