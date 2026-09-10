let progress = 0;
export function startLoadingUI() {
  document
    .querySelectorAll<HTMLElement>(".header,.deck")
    .forEach((node) => (node.inert = true));
  document
    .getElementById("retry")!
    .addEventListener("click", () => location.reload());
  setLoadingProgress(0);
}
/** Completed preparation work, never a timer pretending to download data. */
export function setLoadingProgress(value: number) {
  progress = Math.max(progress, Math.min(100, Math.floor(value)));
  const indicator = document.getElementById("loading-progress")!;
  indicator.style.setProperty("--progress", `${progress}%`);
  indicator.setAttribute("aria-valuenow", String(progress));
}
export function setLoadingStage(index: number, message: string) {
  document.getElementById("loading-message")!.textContent = message;
  setLoadingProgress([0, 30, 70, 100][index] ?? 0);
}
export function showLoadingError(message: string) {
  const loading = document.getElementById("loading")!;
  loading.classList.remove("leaving");
  loading.hidden = false;
  document.getElementById("loading-message")!.textContent = message;
  document.getElementById("retry")!.hidden = false;
}
