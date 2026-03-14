import os
import json
import uuid
from docx import Document

# ── Config ──────────────────────────────────────────────────────────────────
RAW_DIR = "data/raw"
OUTPUT_FILE = "data/processed/canonical_chunks.json"
CHUNK_SIZE = 400        # words per chunk
CHUNK_OVERLAP = 50      # words overlap between chunks

DOCUMENTS = [
    {
        "filename": "Terms and Conditions.docx",
        "source_name": "Terms and Conditions",
        "topic": "terms",
        "intent_categories": ["trust_legal", "getting_started"]
    },
    {
        "filename": "Policy.docx",
        "source_name": "Divido Policy",
        "topic": "policy",
        "intent_categories": ["trust_legal"]
    }
]
# ── Helpers ──────────────────────────────────────────────────────────────────
def extract_text_from_docx(filepath: str) -> str:
    doc = Document(filepath)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


# ── Main ─────────────────────────────────────────────────────────────────────
def parse_all_documents():
    os.makedirs("data/processed", exist_ok=True)
    all_chunks = []

    for doc_config in DOCUMENTS:
        filepath = os.path.join(RAW_DIR, doc_config["filename"])

        if not os.path.exists(filepath):
            print(f"[SKIP] File not found: {filepath}")
            continue

        print(f"[PARSING] {doc_config['filename']}")
        text = extract_text_from_docx(filepath)
        chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

        print(f"  → {len(chunks)} chunks extracted")

        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "id": str(uuid.uuid4()),
                "title": f"{doc_config['source_name']} – Part {i + 1}",
                "content": chunk,
                "source_type": "canonical_doc",
                "source_name": doc_config["source_name"],
                "topic": doc_config["topic"],
                "intent_categories": doc_config["intent_categories"],
                "priority": 1,
                "approved": True
            })

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done. {len(all_chunks)} total chunks saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    parse_all_documents()