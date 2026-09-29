(() => {
  "use strict";

  if (window.__DF_GIFTCODE_EXTENSION_LOADED__) return;
  window.__DF_GIFTCODE_EXTENSION_LOADED__ = true;

  const STORAGE_KEY = "dfGiftcodeStateV1";
  const INPUT_SELECTOR = ".state-after .exc-input";
  const SUBMIT_SELECTOR = ".state-after .btn-exchange";
  const DIALOG_SELECTOR = "#diaTips";
  const DIALOG_TEXT_SELECTOR = "#diaTips p";
  const DIALOG_CLOSE_SELECTOR = "#diaTips .btn-close";
  const INLINE_MESSAGE_SELECTOR = "#superTips";
  const CODE_DELAY_SECONDS = 2;

  let codes = [];
  let results = [];
  let currentIndex = 0;
  let running = false;
  let paused = false;
  let stopRequested = false;
  let panelHidden = false;

  const host = document.createElement("section");
  host.id = "dfgb-root";
  host.innerHTML = `
    <div class="dfgb-panel" role="region" aria-label="Auto redeem code Delta Force">
      <header class="dfgb-header">
        <div>
          <strong>Delta Force Giftcode</strong>
          <span>Auto redeem code Delta Force</span>
        </div>
        <button type="button" class="dfgb-icon-button" id="dfgb-collapse" title="Thu gọn">−</button>
      </header>

      <main class="dfgb-body">
        <div class="dfgb-banner dfgb-banner-info" id="dfgb-banner">
          Chọn file TXT, mỗi dòng là một giftcode.
        </div>

        <label class="dfgb-file">
          <input id="dfgb-file-input" type="file" accept=".txt,text/plain">
          <span>Chọn file TXT</span>
        </label>
        <div class="dfgb-file-name" id="dfgb-file-name">Chưa chọn file</div>

        <div class="dfgb-settings">
          <label>
            <span>Chờ giữa các code</span>
            <div class="dfgb-fixed-delay"><strong>${CODE_DELAY_SECONDS}</strong><em>giây (cố định)</em></div>
          </label>
        </div>

        <div class="dfgb-actions">
          <button type="button" class="dfgb-button dfgb-primary" id="dfgb-start">Bắt đầu</button>
          <button type="button" class="dfgb-button" id="dfgb-pause" disabled>Tạm dừng</button>
          <button type="button" class="dfgb-button dfgb-danger" id="dfgb-stop" disabled>Dừng</button>
        </div>

        <div class="dfgb-progress-wrap">
          <div class="dfgb-progress-label"><span id="dfgb-progress-text">0 / 0</span><span id="dfgb-percent">0%</span></div>
          <div class="dfgb-progress"><i id="dfgb-progress-bar"></i></div>
        </div>

        <div class="dfgb-stats">
          <div><b id="dfgb-total">0</b><span>Tổng</span></div>
          <div><b id="dfgb-success">0</b><span>Thành công</span></div>
          <div><b id="dfgb-notice">0</b><span>Thông báo/lỗi</span></div>
        </div>

        <div class="dfgb-current" id="dfgb-current">Sẵn sàng.</div>

        <div class="dfgb-results" id="dfgb-results" aria-live="polite"></div>

        <footer class="dfgb-footer">
          <div class="dfgb-export-actions">
            <button type="button" class="dfgb-link-button" id="dfgb-export" disabled>Xuất CSV</button>
            <button type="button" class="dfgb-link-button" id="dfgb-export-errors" disabled>Xuất code lỗi TXT</button>
          </div>
          <button type="button" class="dfgb-link-button" id="dfgb-reset">Làm mới danh sách</button>
        </footer>
      </main>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (selector) => host.querySelector(selector);
  const ui = {
    panel: $(".dfgb-panel"),
    body: $(".dfgb-body"),
    banner: $("#dfgb-banner"),
    collapse: $("#dfgb-collapse"),
    fileInput: $("#dfgb-file-input"),
    fileName: $("#dfgb-file-name"),
    start: $("#dfgb-start"),
    pause: $("#dfgb-pause"),
    stop: $("#dfgb-stop"),
    progressText: $("#dfgb-progress-text"),
    percent: $("#dfgb-percent"),
    progressBar: $("#dfgb-progress-bar"),
    total: $("#dfgb-total"),
    success: $("#dfgb-success"),
    notice: $("#dfgb-notice"),
    current: $("#dfgb-current"),
    results: $("#dfgb-results"),
    export: $("#dfgb-export"),
    exportErrors: $("#dfgb-export-errors"),
    reset: $("#dfgb-reset")
  };

  class StopRequestedError extends Error {}
  class BlockedPageError extends Error {}

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function pageIsBlocked() {
    const text = (document.body?.innerText || "").toLocaleLowerCase("vi");
    return [
      "truy cập tạm thời bị hạn chế",
      "why have i been blocked",
      "access temporarily restricted",
      "hành vi của trình duyệt đã thu hút sự chú ý"
    ].some((phrase) => text.includes(phrase));
  }

  function setBanner(message, kind = "info") {
    ui.banner.textContent = message;
    ui.banner.className = `dfgb-banner dfgb-banner-${kind}`;
  }

  function setCurrent(message) {
    ui.current.textContent = message;
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString("vi-VN", { hour12: false });
  }

  function classifyMessage(message) {
    const normalized = message.toLocaleLowerCase("vi");
    const failurePhrases = [
      "không thành công",
      "không hợp lệ",
      "đã được sử dụng",
      "hết hạn",
      "xin lỗi",
      "sorry",
      "not gained access",
      "error_",
      "failed",
      "invalid",
      "expired",
      "already used"
    ];
    if (failurePhrases.some((phrase) => normalized.includes(phrase))) return "Lỗi";
    const successPhrases = [
      "đã nhận thành công",
      "thành công",
      "successfully",
      "success",
      "berhasil",
      "สำเร็จ",
      "sucesso",
      "éxito"
    ];
    return successPhrases.some((phrase) => normalized.includes(phrase)) ? "Thành công" : "Thông báo";
  }

  function updateUi() {
    const total = codes.length;
    const done = Math.min(currentIndex, total);
    const percent = total ? Math.round((done / total) * 100) : 0;
    const successCount = results.filter((item) => item.status === "Thành công").length;

    ui.total.textContent = String(total);
    ui.success.textContent = String(successCount);
    ui.notice.textContent = String(results.length - successCount);
    ui.progressText.textContent = `${done} / ${total}`;
    ui.percent.textContent = `${percent}%`;
    ui.progressBar.style.width = `${percent}%`;
    ui.export.disabled = results.length === 0;
    ui.exportErrors.disabled = !results.some((item) => item.status !== "Thành công");

    ui.fileInput.disabled = running;
    ui.start.disabled = running || total === 0;
    ui.pause.disabled = !running;
    ui.stop.disabled = !running;
    ui.pause.textContent = paused ? "Tiếp tục" : "Tạm dừng";
    ui.start.textContent = currentIndex > 0 && currentIndex < total ? "Tiếp tục" : "Bắt đầu";

    renderResults();
  }

  function renderResults() {
    ui.results.replaceChildren();
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "dfgb-empty";
      empty.textContent = "Kết quả sẽ xuất hiện tại đây.";
      ui.results.appendChild(empty);
      return;
    }

    for (const item of results.slice().reverse()) {
      const row = document.createElement("div");
      row.className = `dfgb-result ${item.status === "Thành công" ? "is-success" : "is-notice"}`;

      const top = document.createElement("div");
      const code = document.createElement("code");
      code.textContent = item.code;
      const status = document.createElement("b");
      status.textContent = item.status;
      top.append(code, status);

      const message = document.createElement("p");
      message.textContent = item.message;
      const time = document.createElement("small");
      time.textContent = `${item.number}/${codes.length} • ${item.time}`;
      row.append(top, message, time);
      ui.results.appendChild(row);
    }
  }

  function getSavedState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (data) => resolve(data[STORAGE_KEY] || null));
    });
  }

  function saveState() {
    const state = {
      codes,
      results,
      currentIndex,
      fileName: ui.fileName.textContent
    };
    chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  async function restoreState() {
    const state = await getSavedState();
    if (!state) {
      updateUi();
      return;
    }
    codes = Array.isArray(state.codes) ? state.codes.filter((value) => typeof value === "string") : [];
    results = Array.isArray(state.results) ? state.results : [];
    currentIndex = Math.min(clampNumber(state.currentIndex, 0, codes.length, 0), codes.length);
    ui.fileName.textContent = state.fileName || (codes.length ? `Đã lưu • ${codes.length} code` : "Chưa chọn file");
    if (codes.length) setBanner(`Đã khôi phục ${codes.length} code từ bộ nhớ cục bộ.`, "info");
    updateUi();
  }

  function setNativeInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (descriptor?.set) descriptor.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: value ? "a" : "Backspace" }));
  }

  function closeDialogIfVisible() {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    if (!isVisible(dialog)) return false;
    const closeButton = document.querySelector(DIALOG_CLOSE_SELECTOR);
    if (!closeButton) return false;
    closeButton.click();
    return true;
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function checkControlState() {
    if (stopRequested) throw new StopRequestedError();
    if (pageIsBlocked()) throw new BlockedPageError();
    while (paused && !stopRequested) {
      setCurrent("Đã tạm dừng. Bấm Tiếp tục để chạy tiếp.");
      await sleep(150);
      if (pageIsBlocked()) throw new BlockedPageError();
    }
    if (stopRequested) throw new StopRequestedError();
  }

  async function waitInterruptibly(milliseconds, label) {
    let remaining = Math.max(0, milliseconds);
    while (remaining > 0) {
      await checkControlState();
      if (label) setCurrent(`${label} ${Math.ceil(remaining / 1000)} giây…`);
      const step = Math.min(200, remaining);
      await sleep(step);
      remaining -= step;
    }
  }

  async function waitForResult() {
    while (true) {
      await checkControlState();
      const dialog = document.querySelector(DIALOG_SELECTOR);
      if (isVisible(dialog)) {
        const message = document.querySelector(DIALOG_TEXT_SELECTOR)?.textContent?.trim();
        return message || "Trang đã hiện thông báo nhưng không đọc được nội dung.";
      }
      const inlineMessage = document.querySelector(INLINE_MESSAGE_SELECTOR);
      const inlineText = inlineMessage?.textContent?.trim();
      if (inlineText) {
        await sleep(80);
        const readableMessage = document.querySelector(DIALOG_TEXT_SELECTOR)?.textContent?.trim();
        return readableMessage || inlineText;
      }
      await sleep(120);
    }
  }

  async function redeemOne(code, number) {
    await checkControlState();
    closeDialogIfVisible();
    await sleep(180);

    const input = document.querySelector(INPUT_SELECTOR);
    const button = document.querySelector(SUBMIT_SELECTOR);
    if (!input || !button || !isVisible(input)) {
      throw new Error("Không tìm thấy ô nhập code. Hãy đăng nhập và mở đúng trang đổi quà.");
    }

    input.focus();
    const inlineMessage = document.querySelector(INLINE_MESSAGE_SELECTOR);
    if (inlineMessage) inlineMessage.textContent = "";
    setNativeInputValue(input, "");
    setNativeInputValue(input, code);
    setCurrent(`Đang đổi ${number}/${codes.length}: ${code}`);
    await sleep(250);

    button.classList.remove("gray");
    button.click();
    const message = await waitForResult();
    const status = classifyMessage(message);

    closeDialogIfVisible();
    await sleep(180);
    const currentInput = document.querySelector(INPUT_SELECTOR);
    if (currentInput) setNativeInputValue(currentInput, "");

    return { number, code, status, message, time: formatTime() };
  }

  async function runQueue() {
    if (running || !codes.length) return;
    if (pageIsBlocked()) {
      setBanner("Trang đang hạn chế truy cập. Extension đã dừng để không gửi thêm yêu cầu.", "error");
      setCurrent("Hãy đóng extension và liên hệ hỗ trợ nếu tình trạng kéo dài.");
      return;
    }
    if (!document.querySelector(INPUT_SELECTOR)) {
      setBanner("Không tìm thấy ô nhập code. Hãy đăng nhập trên trang trước.", "error");
      return;
    }
    if (currentIndex >= codes.length) {
      currentIndex = 0;
      results = [];
    }

    running = true;
    paused = false;
    stopRequested = false;
    setBanner("Đang chạy. Không đóng hoặc tải lại tab này.", "running");
    updateUi();

    try {
      while (currentIndex < codes.length) {
        await checkControlState();
        const code = codes[currentIndex];
        let result;
        try {
          result = await redeemOne(code, currentIndex + 1);
        } catch (error) {
          if (error instanceof StopRequestedError || error instanceof BlockedPageError) throw error;
          result = {
            number: currentIndex + 1,
            code,
            status: "Lỗi",
            message: error instanceof Error ? error.message : String(error),
            time: formatTime()
          };
          closeDialogIfVisible();
          const input = document.querySelector(INPUT_SELECTOR);
          if (input) setNativeInputValue(input, "");
        }

        results.push(result);
        currentIndex += 1;
        saveState();
        updateUi();

        if (currentIndex < codes.length) {
          await waitInterruptibly(CODE_DELAY_SECONDS * 1000, "Chờ trước code tiếp theo:");
        }
      }

      setBanner(`Hoàn tất ${codes.length} code.`, "success");
      setCurrent("Đã xử lý xong toàn bộ danh sách.");
    } catch (error) {
      if (error instanceof BlockedPageError) {
        stopRequested = true;
        setBanner("Phát hiện trang hạn chế truy cập — đã dừng an toàn.", "error");
        setCurrent("Không tiếp tục thử. Hãy chờ hết hạn chế hoặc liên hệ hỗ trợ.");
      } else if (error instanceof StopRequestedError) {
        setBanner(`Đã dừng tại ${currentIndex}/${codes.length}.`, "warning");
        setCurrent("Có thể bấm Tiếp tục để chạy từ code chưa xử lý.");
      } else {
        setBanner("Đã dừng vì xảy ra lỗi ngoài dự kiến.", "error");
        setCurrent(error instanceof Error ? error.message : String(error));
      }
    } finally {
      running = false;
      paused = false;
      saveState();
      updateUi();
    }
  }

  function resetQueue() {
    if (running) return;
    currentIndex = 0;
    results = [];
    setBanner(codes.length ? `Đã đặt lại ${codes.length} code.` : "Chọn file TXT, mỗi dòng là một giftcode.", "info");
    setCurrent("Sẵn sàng.");
    saveState();
    updateUi();
  }

  function exportCsv() {
    if (!results.length) return;
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["STT", "Giftcode", "Trạng thái", "Thông báo", "Thời gian"],
      ...results.map((item) => [item.number, item.code, item.status, item.message, item.time])
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `delta-force-giftcode-${new Date().toISOString().replaceAll(":", "-").slice(0, 19)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportErrorCodes() {
    const failedCodes = results
      .filter((item) => item.status !== "Thành công")
      .map((item) => item.code);
    if (!failedCodes.length) return;

    const text = "\uFEFF" + failedCodes.join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `delta-force-giftcode-loi-${new Date().toISOString().replaceAll(":", "-").slice(0, 19)}.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ui.fileInput.addEventListener("change", async () => {
    const file = ui.fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const loadedCodes = text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      if (!loadedCodes.length) throw new Error("File không có code hợp lệ.");
      codes = loadedCodes;
      results = [];
      currentIndex = 0;
      ui.fileName.textContent = `${file.name} • ${codes.length} code`;
      setBanner(`Đã nạp ${codes.length} code.`, "success");
      setCurrent("Kiểm tra trang đã đăng nhập rồi bấm Bắt đầu.");
      saveState();
      updateUi();
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "Không đọc được file TXT.", "error");
    } finally {
      ui.fileInput.value = "";
    }
  });

  ui.start.addEventListener("click", runQueue);
  ui.pause.addEventListener("click", () => {
    if (!running) return;
    paused = !paused;
    setBanner(paused ? "Đã tạm dừng." : "Đang tiếp tục…", paused ? "warning" : "running");
    updateUi();
  });
  ui.stop.addEventListener("click", () => {
    if (!running) return;
    stopRequested = true;
    paused = false;
    setBanner("Đang dừng sau thao tác hiện tại…", "warning");
  });
  ui.export.addEventListener("click", exportCsv);
  ui.exportErrors.addEventListener("click", exportErrorCodes);
  ui.reset.addEventListener("click", resetQueue);
  ui.collapse.addEventListener("click", () => {
    ui.body.hidden = !ui.body.hidden;
    ui.collapse.textContent = ui.body.hidden ? "+" : "−";
    ui.collapse.title = ui.body.hidden ? "Mở rộng" : "Thu gọn";
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "DFGB_TOGGLE_PANEL") {
      panelHidden = !panelHidden;
      host.hidden = panelHidden;
      sendResponse({ ok: true, visible: !panelHidden });
    } else if (message?.type === "DFGB_SHOW_PANEL") {
      panelHidden = false;
      host.hidden = false;
      sendResponse({ ok: true, visible: true });
    } else if (message?.type === "DFGB_GET_STATUS") {
      sendResponse({ ok: true, running, currentIndex, total: codes.length });
    }
  });

  restoreState();
})();
