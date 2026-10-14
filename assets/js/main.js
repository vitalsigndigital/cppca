/* CPPCA — progressive enhancement only. Every piece of content is already in the HTML;
   this file adds menus, reveals, copy buttons, form submission and the lite video embed. */
(function () {
  "use strict";
  var doc = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* sticky header shadow */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-stuck", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* desktop dropdowns: click/tap + keyboard, hover handled in CSS */
  var items = document.querySelectorAll(".nav__item.has-menu");
  function closeAll(except) {
    items.forEach(function (it) {
      if (it !== except) { it.classList.remove("is-open"); var b = it.querySelector("button"); if (b) b.setAttribute("aria-expanded", "false"); }
    });
  }
  items.forEach(function (it) {
    var btn = it.querySelector("button");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !it.classList.contains("is-open");
      closeAll(it);
      it.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("click", function () { closeAll(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeAll(); closeDrawer(); } });

  /* mobile drawer */
  var drawer = document.getElementById("drawer");
  var opener = document.querySelector("[data-drawer-open]");
  var lastFocus = null;
  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    void drawer.offsetWidth; /* force a reflow so the slide-in transition runs (rAF is paused in background tabs) */
    drawer.classList.add("is-open");
    opener && opener.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    var first = drawer.querySelector("button, a");
    first && first.focus();
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    opener && opener.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(function () { drawer.hidden = true; }, reduce ? 0 : 300);
    lastFocus && lastFocus.focus();
  }
  if (drawer && opener) {
    opener.addEventListener("click", openDrawer);
    drawer.querySelectorAll("[data-drawer-close]").forEach(function (el) { el.addEventListener("click", closeDrawer); });
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = drawer.querySelectorAll("a, button");
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }

  /* scroll reveals, with a failsafe so nothing can stay hidden */
  var reveals = document.querySelectorAll(".reveal");
  function showAll() { reveals.forEach(function (el) { if (!el.classList.contains("is-in")) el.classList.add("is-now", "is-in"); }); }
  if (reduce || !("IntersectionObserver" in window)) { showAll(); }
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
    setTimeout(showAll, 2500);
  }

  /* copy-to-clipboard for e-transfer addresses */
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy");
      var done = function () { var t = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = t; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, function () {});
    });
  });

  /* lite YouTube embed: no third-party request until the visitor asks for the video */
  document.querySelectorAll("[data-yt]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var id = a.getAttribute("data-yt");
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      f.title = a.getAttribute("aria-label") || "Video";
      f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      a.parentNode.replaceChild(f, a);
    });
  });

  /* forms: inline validation on blur, AJAX submit with a plain-POST fallback */
  function validate(field) {
    var input = field.querySelector("input, select, textarea");
    if (!input) return true;
    var ok = input.checkValidity();
    field.classList.toggle("is-invalid", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }
  document.querySelectorAll("form[data-ajax]").forEach(function (form) {
    var status = form.querySelector(".form__status");
    var btn = form.querySelector("button[type=submit]");
    form.querySelectorAll(".field").forEach(function (f) {
      var i = f.querySelector("input, select, textarea");
      if (i) i.addEventListener("blur", function () { if (i.value) validate(f); });
    });
    form.setAttribute("novalidate", "");
    form.addEventListener("submit", function (e) {
      var bad = null;
      form.querySelectorAll(".field").forEach(function (f) { if (!validate(f) && !bad) bad = f; });
      if (bad) { e.preventDefault(); var i = bad.querySelector("input, select, textarea"); i && i.focus(); return; }
      var consent = form.querySelector('.consent input[required]');
      if (consent && !consent.checked) {
        e.preventDefault();
        status.textContent = "Please tick the consent box so we can reply to you.";
        status.className = "form__status is-err";
        consent.focus();
        return;
      }
      if (!window.fetch || !window.FormData) return; /* let the browser post normally */
      e.preventDefault();
      btn.setAttribute("aria-busy", "true");
      status.className = "form__status";
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (d) {
          if (d && d.ok) {
            status.textContent = form.getAttribute("data-success") || "Thank you — your message has been sent.";
            status.className = "form__status is-ok";
            form.reset();
          } else { throw new Error(d && d.error); }
        })
        .catch(function () {
          status.innerHTML = "Sorry, that didn’t go through. Please email <a href=\"mailto:cppcaofficial@gmail.com\">cppcaofficial@gmail.com</a> or call +1 (416) 845-3209.";
          status.className = "form__status is-err";
        })
        .then(function () { btn.removeAttribute("aria-busy"); status.focus && status.focus(); });
    });
  });

  /* current year, computed at view time in CPPCA's timezone (never written at build time) */
  var y = document.querySelectorAll("[data-year]");
  if (y.length) {
    try {
      var yr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(new Date());
      y.forEach(function (el) { el.textContent = "© " + yr + " "; });
    } catch (err) { /* fallback text stays */ }
  }
})();
