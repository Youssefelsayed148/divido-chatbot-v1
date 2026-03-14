"""
load_knowledge_docx_ar.py
Loads Arabic knowledge chunks from Divido info.docx into the database.
Run AFTER parse_docx_ar.py.
"""
import json
import os
import sys
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

INPUT            = "data/processed/docx_chunks_ar.json"
OLLAMA_URL       = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/embeddings"
EMBED_MODEL      = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
MIN_ARABIC_CHARS = 20


def get_db_connection():
    conn_str = (
        f"host={os.getenv('DB_HOST', 'localhost')} "
        f"port={os.getenv('DB_PORT', '5432')} "
        f"dbname={os.getenv('DB_NAME', 'divido_chatbot')} "
        f"user={os.getenv('DB_USER', 'postgres')} "
        f"password={os.getenv('DB_PASSWORD', '')}"
    )
    return psycopg2.connect(conn_str)


def get_embedding(text: str) -> list[float]:
    # OLLAMA_URL already includes /api/embeddings — do NOT append it again
    res = requests.post(
        OLLAMA_URL,
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60
    )
    res.raise_for_status()
    return res.json()["embedding"]


def count_arabic(text: str) -> int:
    return sum(1 for c in text if "\u0600" <= c <= "\u06FF")


def load_chunks():
    if not os.path.exists(INPUT):
        print(f"[ERROR] {INPUT} not found. Run parse_docx_ar.py first.")
        sys.exit(1)

    with open(INPUT, encoding="utf-8") as f:
        chunks = json.load(f)

    print(f"\n[LOADING] {len(chunks)} Arabic chunks from {INPUT}\n")

    conn   = get_db_connection()
    cursor = conn.cursor()

    inserted = 0
    skipped  = 0

    for chunk in chunks:
        content  = chunk["content"]
        ar_count = count_arabic(content)

        if ar_count < MIN_ARABIC_CHARS:
            print(f"  [SKIP] '{chunk['title']}' — only {ar_count} Arabic chars")
            skipped += 1
            continue

        cursor.execute(
            "SELECT id FROM knowledge_items WHERE title = %s AND source_name = %s",
            (chunk["title"], chunk["source_name"])
        )
        if cursor.fetchone():
            print(f"  [SKIP] Already exists: '{chunk['title']}'")
            skipped += 1
            continue

        print(f"  [EMBED] '{chunk['title']}'...")
        try:
            embedding = get_embedding(content)
        except Exception as e:
            print(f"  [ERROR] Embedding failed for '{chunk['title']}': {e}")
            skipped += 1
            continue

        cursor.execute("""
            INSERT INTO knowledge_items
              (title, content, source_type, source_name, topic,
               intent_categories, priority, approved, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
        """, (
            chunk["title"],
            content,
            chunk["source_type"],
            chunk["source_name"],
            chunk["topic"],
            chunk["intent_categories"],
            chunk["priority"],
            chunk["approved"],
            str(embedding),
        ))
        conn.commit()
        print(f"  [OK] Inserted: '{chunk['title']}' ({ar_count} Arabic chars)")
        inserted += 1

    cursor.close()
    conn.close()
    print(f"\n✅ Done. {inserted} inserted, {skipped} skipped.")


if __name__ == "__main__":
    load_chunks()