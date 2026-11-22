// Expertise carousel on the home page: prev/next buttons, "01 / 08" counter,
// and diagram animations that play when a card scrolls into view.
// Without this script the cards still scroll sideways (scroll-snap) and the
// diagrams are shown complete.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".xp").forEach(function (root) {
    var track = root.querySelector(".xp-track");
    var cards = track.children;
    var count = root.querySelector(".xp-count");
    var prev = root.querySelector(".xp-prev");
    var next = root.querySelector(".xp-next");
    var n = cards.length;
    var pad = function (k) { return String(k).padStart(2, "0"); };
    var step = function () { return n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth; };

    function update() {
      var i = Math.min(n - 1, Math.round(track.scrollLeft / step()));
      var shown = Math.max(1, Math.round(track.clientWidth / step()));
      var last = Math.min(n, i + shown);
      count.textContent = pad(i + 1) + (last > i + 1 ? "–" + pad(last) : "") + " / " + pad(n);
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }
    function go(dir) { track.scrollBy({ left: dir * step(), behavior: reduce ? "auto" : "smooth" }); }

    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);
    update();

    // Animations: .in starts them; removing it when the card is fully out of view lets them replay.
    if (reduce || !("IntersectionObserver" in window)) return;
    root.classList.add("xp-js");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.intersectionRatio >= 0.5) e.target.classList.add("in");
        else if (!e.isIntersecting) e.target.classList.remove("in");
      });
    }, { threshold: [0, 0.5] });
    Array.prototype.forEach.call(cards, function (c) { io.observe(c); });
  });
})();
