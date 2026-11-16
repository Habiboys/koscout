const endpointInput = document.querySelector("#endpoint");
const button = document.querySelector("#go");
const status = document.querySelector("#status");

chrome.storage.local.get({ endpoint: "http://localhost:3000" }, (stored) => {
  endpointInput.value = stored.endpoint;
});

button.addEventListener("click", async () => {
  const endpoint = endpointInput.value.trim().replace(/\/$/, "");
  chrome.storage.local.set({ endpoint });
  button.disabled = true;
  status.textContent = "Membaca halaman…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Tab tidak ditemukan.");
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPage,
    });
    const payload = injected?.result;
    if (!payload?.sourceUrl) throw new Error("Halaman tidak bisa dibaca.");
    status.textContent = `${payload.cards.length} kartu. Mengirim…`;
    const response = await fetch(`${endpoint}/api/import/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
    status.textContent = `${data.total} kos tersimpan (${data.created} baru, ${data.updated} diperbarui).`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Gagal mengambil halaman.";
  } finally {
    button.disabled = false;
  }
});

function collectPage() {
  const primary = Array.from(document.querySelectorAll('[data-testid="roomCard"], [data-testid="AssetCard"]'));
  const nodes = primary.length > 0 ? primary : Array.from(document.querySelectorAll('[data-testid="kostRoomCard"]'));
  const cards = nodes.map((el) => {
    const anchor = el.closest("a[href]") || el.querySelector("a[href]");
    const images = Array.from(el.querySelectorAll("img"))
      .map((img) => img.currentSrc || img.src || "")
      .filter((src) => /^https?:/i.test(src) && !/sprite|logo|icon|\.svg/i.test(src))
      .filter((src, index, all) => all.indexOf(src) === index)
      .slice(0, 3);
    return {
      html: el.outerHTML.slice(0, 12000),
      href: anchor ? anchor.href : null,
      text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2000),
      images,
    };
  });
  const geo = document.documentElement.innerHTML.match(
    /"latitude"\s*:\s*"(-?\d+\.\d+)"\s*,\s*"longitude"\s*:\s*"(-?\d+\.\d+)"/,
  );
  return {
    sourceUrl: location.href,
    title: document.title,
    cards,
    pageHtml:
      cards.length === 0 || /^\/(room|place)\//.test(location.pathname)
        ? document.documentElement.outerHTML.slice(0, 350000)
        : null,
    latitude: geo ? Number(geo[1]) : null,
    longitude: geo ? Number(geo[2]) : null,
  };
}
