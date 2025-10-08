const URL_REGEX = /^https:\/\/115\.com/;
const COOKIE_DOMAIN = "115.com";
const COOKIE_URL = `http://${COOKIE_DOMAIN}/`;
const COOKIE_NAMES = ["CID", "SEID", "UID", "KID"];
const COOKIE_FILE_PATH = "./cookie.json";
const EXPIRATION_DATE = Math.floor(Date.now() / 1000) + 3600 * 24 * 90;

function isCookieValueValid(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

async function loadCookieJSON() {
  try {
    const url = chrome.runtime.getURL(COOKIE_FILE_PATH);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn("讀取 cookie.json 錯誤，使用空資料:", err);
    return {};
  }
}

async function writeCookies() {
  const cookiesFromFile = await loadCookieJSON();
  const cookiesRaw = await chrome.cookies.getAll({ domain: COOKIE_DOMAIN });
  const cookiesFromBrowser = Object.fromEntries(
    cookiesRaw.map((cookie) => [cookie.name, cookie.value])
  );

  let changed = false;
  for (const name of COOKIE_NAMES) {
    const cookieValueFromFile = cookiesFromFile[name] || undefined;
    const cookieValueFromBrowser = cookiesFromBrowser[name] || undefined;

    // 1. 檢查檔案中的 cookie 是否有效
    // 2. 檢查檔案中的 cookie 是否與瀏覽器相同
    if (
      !(
        isCookieValueValid(cookieValueFromFile) &&
        cookieValueFromFile !== cookieValueFromBrowser
      )
    )
      continue;

    try {
      await chrome.cookies.set({
        url: COOKIE_URL,
        name: name,
        value: cookieValueFromFile,
        domain: COOKIE_DOMAIN,
        path: "/",
        expirationDate: EXPIRATION_DATE,
      });
      changed = true;
    } catch (err) {
      console.warn(`設定 cookie ${name} 失敗:`, err);
    }
    changed = true;
  }
  return changed;
}

const reloadedTabs = new Set();
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 檢查網頁是否載入完成 (status: 'complete')
  if (changeInfo.status !== "complete") return;
  // 檢查網址是否符合目標網域
  if (!URL_REGEX.test(tab.url)) return;
  // 防止重複 reload
  if (reloadedTabs.has(tabId)) return;
  if (await writeCookies()) {
    reloadedTabs.add(tabId);
    setTimeout(() => chrome.tabs.reload(tabId), 200);
    setTimeout(() => reloadedTabs.delete(tabId), 5000);
  }
});
