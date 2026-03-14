import os
import json
import uuid
import time
from playwright.sync_api import sync_playwright

# ── Config ───────────────────────────────────────────────────────────────────
APPROVED_URLS_FILE = "data/approved_urls.json"
OUTPUT_FILE = "data/processed/website_chunks.json"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 50

# ── Helpers ───────────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 50:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def scrape_page(page, url: str, section: str) -> str:
    try:
        base_url = url.split("#")[0]
        page.goto(base_url, wait_until="networkidle", timeout=30000)

        # If anchor section, scroll to it
        anchor = url.split("#")[1] if "#" in url else None
        if anchor:
            page.evaluate(f"""
                const el = document.getElementById('{anchor}') ||
                           document.querySelector('[id*="{anchor}"]') ||
                           document.querySelector('[class*="{anchor}"]');
                if (el) el.scrollIntoView();
            """)
            time.sleep(1)

        # Remove noise elements
        page.evaluate("""
            ['nav', 'header', 'footer', 'script', 'style', 'noscript'].forEach(tag => {
                document.querySelectorAll(tag).forEach(el => el.remove());
            });
        """)

        # Extract all visible text
        text = page.evaluate("""
            () => {
                const tags = document.querySelectorAll('p, h1, h2, h3, h4, h5, li, span, div');
                const seen = new Set();
                const lines = [];
                tags.forEach(el => {
                    const t = el.innerText?.trim();
                    if (t && t.length > 30 && !seen.has(t)) {
                        seen.add(t);
                        lines.push(t);
                    }
                });
                return lines.join('\\n');
            }
        """)
        return text or ""

    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
        return ""


# ── Main ──────────────────────────────────────────────────────────────────────
def scrape_all_urls():
    os.makedirs("data/processed", exist_ok=True)

    with open(APPROVED_URLS_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    urls = config.get("urls", [])
    all_chunks = []
    scraped_base_urls = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for entry in urls:
            url = entry["url"]
            section = entry["section"]
            intent_categories = entry["intent_categories"]
            base_url = url.split("#")[0]

            print(f"[SCRAPING] {url}  (section: {section})")

            # For anchor URLs reuse already-scraped base page text
            # but still scroll to section for targeted extraction
            text = scrape_page(page, url, section)

            if not text.strip():
                print(f"  → No content extracted, skipping")
                continue

            chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
            print(f"  → {len(chunks)} chunks extracted")

            for i, chunk in enumerate(chunks):
                all_chunks.append({
                    "id": str(uuid.uuid4()),
                    "title": f"{section.replace('_', ' ').title()} – Part {i + 1}",
                    "content": chunk,
                    "source_type": "website",
                    "source_name": f"projectdivido.com/{section}",
                    "topic": section,
                    "intent_categories": intent_categories,
                    "priority": 2,
                    "approved": True
                })

            time.sleep(1)

        browser.close()

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done. {len(all_chunks)} total chunks saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_all_urls()