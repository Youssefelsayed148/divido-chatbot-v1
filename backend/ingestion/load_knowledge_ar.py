import os
import json
import uuid
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE  = "data/processed/website_chunks_ar.json"
OLLAMA_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/embeddings"
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")


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
    response = requests.post(
        OLLAMA_URL,
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60
    )
    response.raise_for_status()
    return response.json()["embedding"]


def load_arabic_chunks():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    print(f"[INFO] Loaded {len(chunks)} Arabic chunks from {INPUT_FILE}")

    conn     = get_db_connection()
    cursor   = conn.cursor()
    inserted = 0
    skipped  = 0

    for chunk in chunks:
        try:
            arabic_chars = sum(1 for c in chunk["content"] if "\u0600" <= c <= "\u06FF")
            if arabic_chars < 30:
                print(f"  [SKIP] Not enough Arabic content: {chunk['title']}")
                skipped += 1
                continue

            print(f"  [EMBEDDING] {chunk['title']}")
            embedding = get_embedding(chunk["content"])

            cursor.execute("""
                INSERT INTO knowledge_items (
                    id, title, content, source_type, source_name,
                    topic, intent_categories, priority, approved, embedding
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()),
                chunk["title"],
                chunk["content"],
                chunk["source_type"],
                chunk["source_name"],
                chunk["topic"],
                chunk["intent_categories"],
                chunk["priority"],
                chunk["approved"],
                str(embedding)
            ))
            conn.commit()
            inserted += 1

        except Exception as e:
            print(f"  [ERROR] {chunk['title']}: {e}")
            conn.rollback()

    cursor.close()
    conn.close()
    print(f"\n✅ Done. {inserted} Arabic chunks inserted, {skipped} skipped.")


if __name__ == "__main__":
    load_arabic_chunks()