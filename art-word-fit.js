// Fit only the decorative word. The artwork and its animation keep their size.
export function fitArtWord(word, stage = word?.parentElement) {
  if (!word || !stage || !word.textContent || stage.clientWidth <= 4) return;
  word.style.removeProperty('font-size');
  const document = word.ownerDocument, view = document.defaultView;
  const originalSize = parseFloat(view.getComputedStyle(word).fontSize);
  const range = document.createRange();
  range.selectNodeContents(word);
  // A Range measures the actual glyphs, including the loaded font and letter
  // spacing, even when the element's box is constrained to the available width.
  const textWidth = range.getBoundingClientRect().width;
  const available = stage.clientWidth - 4;
  if (textWidth > available && originalSize > 0) {
    word.style.fontSize = `${originalSize * available / textWidth}px`;
  }
}

export function watchArtWord(word, stage = word?.parentElement) {
  if (!word || !stage) return () => {};
  const document = word.ownerDocument, view = document.defaultView;
  let frame = null, stopped = false;
  const schedule = () => {
    if (stopped || frame !== null) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      if (!stopped) fitArtWord(word, stage);
    });
  };
  const textObserver = new view.MutationObserver(schedule);
  textObserver.observe(word, { childList: true, characterData: true, subtree: true });
  const sizeObserver = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  sizeObserver?.observe(stage);
  // Resize also catches a font-size breakpoint when the stage has a max-width.
  view.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  schedule();
  return () => {
    stopped = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    textObserver.disconnect(); sizeObserver?.disconnect();
    view.removeEventListener('resize', schedule);
    document.fonts?.removeEventListener('loadingdone', schedule);
  };
}

if (typeof document !== 'undefined') watchArtWord(document.getElementById('art-word'));
