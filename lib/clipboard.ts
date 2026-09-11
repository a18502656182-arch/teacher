export async function copyTextToClipboard(text: string, successMessage = "已复制") {
  try {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    }
    if (!copied) throw new Error("copy failed");
    window.dispatchEvent(new CustomEvent("classroom:toast", { detail: { message: successMessage, tone: "success" } }));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("classroom:toast", { detail: { message: "浏览器未允许复制，请检查权限后重试", tone: "error" } }));
    return false;
  }
}
