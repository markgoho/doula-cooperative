// Copy buttons: any <button data-copy-text="…"> copies that text and briefly
// swaps its label for data-copied-label. Buttons ship hidden and are revealed
// here, so they never appear where copying cannot work.

const COPIED_LABEL_MS = 2000;

const copyButtons = document.querySelectorAll<HTMLButtonElement>(
  "button[data-copy-text]",
);

if ("clipboard" in navigator) {
  for (const button of copyButtons) {
    const idleLabel = button.textContent ?? "";
    const copiedLabel = button.dataset["copiedLabel"] ?? idleLabel;
    const status = button.parentElement?.querySelector("[data-copy-status]");

    button.hidden = false;

    button.addEventListener("click", () => {
      void navigator.clipboard
        .writeText(button.dataset["copyText"] ?? "")
        .then(() => {
          button.textContent = copiedLabel;
          button.dataset["copied"] = "true";
          if (status) {
            status.textContent = copiedLabel;
          }

          setTimeout(() => {
            button.textContent = idleLabel;
            delete button.dataset["copied"];
            if (status) {
              status.textContent = "";
            }
          }, COPIED_LABEL_MS);
        })
        .catch(() => {
          // Copying was blocked: select the text so it can be copied by hand.
          const source = button.parentElement?.querySelector(
            ".profile-contact__value",
          );
          if (source) {
            globalThis.getSelection()?.selectAllChildren(source);
          }
        });
    });
  }
}
