"use strict";

const TARGET_URL = "https://redeem.df.garena.sg/vi/cdkgarena.html";
const statusElement = document.querySelector("#status");

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
  });
}

async function sendToPage(type) {
  const tab = await activeTab();
  if (!tab?.id || !tab.url?.startsWith("https://redeem.df.garena.sg/")) {
    statusElement.textContent = "Tab hiện tại không phải trang đổi quà Delta Force.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      statusElement.textContent = "Hãy tải lại trang một lần sau khi cài extension.";
      return;
    }
    if (typeof response.total === "number") {
      statusElement.textContent = response.running
        ? `Đang xử lý ${response.currentIndex}/${response.total} code.`
        : `Sẵn sàng • ${response.currentIndex}/${response.total} code đã xử lý.`;
    } else {
      statusElement.textContent = response.visible ? "Đã hiện bảng điều khiển." : "Đã ẩn bảng điều khiển.";
    }
  });
}

document.querySelector("#toggle").addEventListener("click", () => sendToPage("DFGB_TOGGLE_PANEL"));
document.querySelector("#open").addEventListener("click", () => chrome.tabs.create({ url: TARGET_URL }));

sendToPage("DFGB_GET_STATUS");
