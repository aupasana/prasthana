(function () {
  const SCRIPTS = [["devanagari", "देवनागरी"], ["iast", "IAST"], ["iso", "ISO 15919"],
    ["telugu", "తెలుగు"], ["kannada", "ಕನ್ನಡ"], ["tamil", "தமிழ்"], ["malayalam", "മലയാളം"],
    ["bengali", "বাংলা"], ["gujarati", "ગુજરાતી"], ["oriya", "ଓଡ଼ିଆ"], ["gurmukhi", "ਗੁਰਮੁਖੀ"],
    ["grantha", "Grantha"]];
  const LATIN = new Set(["iast", "iso"]);
  const RUN = /[ऀ-ॿ᳐-᳿꣠-ꣿ][ऀ-ॿ᳐-᳿꣠-ꣿ‌‍\s.,;:'‘’“”()\-–—?!]*/g;
  const HAS = /[ऀ-ॿ]/;
  const orig = new WeakMap();   // text node -> its Devanagari
  let current = "devanagari";
  const get = () => { try { return localStorage.getItem("lipi") || "devanagari"; } catch (e) { return "devanagari"; } };
  const put = v => { try { localStorage.setItem("lipi", v); } catch (e) {} };
  const lib = () => window.Sanscript || window.sanscript;

  function nodes(root) {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (orig.has(n) || HAS.test(n.nodeValue)) {
        if (!orig.has(n)) orig.set(n, n.nodeValue);
        out.push(n);
      }
    }
    return out;
  }
  // marks Sanscript leaves in Devanagari: the Vedic anusvara (ꣳ, Taittiriya,
  // Chandogya) becomes the plain one outside Latin; the abbreviation sign
  // (बृ॰उ॰) a full stop. Gurmukhi's ॐ would be ੴ, and Tamil and Gurmukhi
  // have no avagraha: an apostrophe, as in IAST.
  function one(S, r, to) {
    if (!LATIN.has(to)) r = r.replace(/\uA8F3/g, "\u0902");
    r = r.replace(/\u0970/g, ".");
    if (to === "gurmukhi") r = r.replace(/\u0950/g, "\u0913\u0902");
    let out = S.t(r, "devanagari", to);
    if (to === "tamil" || to === "gurmukhi") out = out.replace(/\u093D/g, "'");
    return out;
  }
  function convert(list, to, done) {
    const S = lib();
    let i = 0;
    (function batch() {
      const end = Math.min(i + 1500, list.length);
      for (; i < end; i++) {
        const n = list[i], o = orig.get(n);
        n.nodeValue = to === "devanagari" ? o : o.replace(RUN, r => one(S, r, to));
      }
      if (i < list.length) setTimeout(batch, 0); else if (done) done();
    })();
  }
  function apply(root) {
    if (current === "devanagari" && !root) return;
    if (current !== "devanagari" && !lib()) return;
    convert(nodes(root || document.body), current);
  }
  function choose(to) {
    current = to;
    put(to);
    document.documentElement.dataset.lipi = to;
    document.documentElement.classList.toggle("lipi-latin", LATIN.has(to));
    if (to !== "devanagari" && !lib()) return;
    convert(nodes(document.body), to);
  }
  function load(then) {
    if (lib()) return then(true);
    const s = document.createElement("script");
    s.src = "assets/sanscript.js";
    s.onload = () => then(!!lib());
    s.onerror = () => then(false);
    document.head.appendChild(s);
  }
  function chooser() {
    const box = document.getElementById("lipi");
    if (!box) return;
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "लिपिः");
    for (const [v, label] of SCRIPTS) sel.add(new Option(label, v));
    sel.value = get();
    box.appendChild(sel);
    sel.onchange = () => load(ok => {
      if (!ok && sel.value !== "devanagari") { note(box); sel.value = "devanagari"; return; }
      choose(sel.value);
    });
  }
  function note(box) {
    if (box.querySelector(".lipi-note")) return;
    const p = document.createElement("div");
    p.className = "lipi-note";
    p.textContent = "assets/sanscript.js is missing";
    box.appendChild(p);
  }
  // text size: a step of 1pt at a time for the middle and right panels,
  // kept like the script, from -6 to +12
  function sizer() {
    const box = document.getElementById("size");
    if (!box) return;
    let step = 0;
    try { step = parseInt(localStorage.getItem("fontstep") || "0", 10) || 0; } catch (e) {}
    const label = document.createElement("span");
    label.className = "step";
    const set = k => {
      step = Math.max(-6, Math.min(12, k));
      document.documentElement.style.setProperty("--bump", step + "pt");
      label.textContent = step ? (step > 0 ? "+" : "") + step + "pt" : "";
      try { localStorage.setItem("fontstep", String(step)); } catch (e) {}
    };
    for (const [text, d, name] of [["अ−", -1, "smaller"], ["अ+", 1, "larger"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.title = b.ariaLabel = name;
      b.onclick = () => set(step + d);
      box.appendChild(b);
    }
    box.appendChild(label);
    set(step);
  }
  // the font, under the text size: Adishila, Sanskrit 2003 or Noto Sans, kept
  // like the script (the CSS's :root[data-font]); set at once, so the text
  // doesn't change font after it is drawn
  const FONTS = [["adishila", "Adishila"], ["sanskrit2003", "Sanskrit 2003"], ["noto", "Noto Sans"]];
  const setFont = v => {
    if (!FONTS.some(([k]) => k === v)) v = "adishila";
    if (v === "adishila") delete document.documentElement.dataset.font;
    else document.documentElement.dataset.font = v;
    try { localStorage.setItem("font", v); } catch (e) {}
    return v;
  };
  let font = "adishila";
  try { font = localStorage.getItem("font") || "adishila"; } catch (e) {}
  font = setFont(font);
  function fonter() {
    const box = document.getElementById("font");
    if (!box) return;
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "font");
    sel.title = "font";
    for (const [v, label] of FONTS) sel.add(new Option(label, v));
    sel.value = font;
    sel.onchange = () => { font = setFont(sel.value); };
    box.appendChild(sel);
  }
  window.lipi = { apply: root => apply(root) };
  document.addEventListener("DOMContentLoaded", () => {
    sizer();
    fonter();
    chooser();
    const want = get();
    if (want !== "devanagari") load(ok => ok && choose(want));
  });
})();
