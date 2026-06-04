import type { AuthStatus } from "../ipc.js";

const api = window.meetcopilot;

function asButton(element: HTMLElement | null): HTMLButtonElement | null {
  return element instanceof HTMLButtonElement ? element : null;
}

/** Wires the overlay's Account section to the main-process auth service. */
export function initAuthUi(log: (label: string, value: string) => void): void {
  const statusEl = document.getElementById("auth-status");
  const dotEl = document.getElementById("auth-dot");
  const signInBtn = asButton(document.getElementById("signin-btn"));
  const signOutBtn = asButton(document.getElementById("signout-btn"));

  function render(status: AuthStatus): void {
    if (statusEl) {
      statusEl.textContent = status.signedIn
        ? `Signed in as ${status.email ?? "unknown"}`
        : "Signed out";
    }
    if (dotEl) dotEl.dataset.state = status.signedIn ? "active" : "";
    if (signInBtn) signInBtn.disabled = status.signedIn;
    if (signOutBtn) signOutBtn.disabled = !status.signedIn;
  }

  api.auth.onChanged(render);

  signInBtn?.addEventListener("click", () => {
    void (async () => {
      signInBtn.disabled = true;
      const result = await api.auth.login();
      if (result.ok) {
        log("Auth", "opened browser — complete sign-in there, then return");
      } else {
        signInBtn.disabled = false;
        log("Auth error", result.error ?? "could not start sign-in");
      }
    })();
  });

  signOutBtn?.addEventListener("click", () => {
    void (async () => {
      render(await api.auth.logout());
      log("Auth", "signed out");
    })();
  });

  void api.auth.getStatus().then(render);
}
