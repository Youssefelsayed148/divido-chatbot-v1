import os
import json
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

CANONICAL_FILE = "data/processed/canonical_chunks.json"
WEBSITE_FILE   = "data/processed/website_chunks.json"
OLLAMA_URL     = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/embeddings"
EMBED_MODEL    = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")


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


def insert_chunk(cursor, chunk: dict, embedding: list[float]):
    cursor.execute("""
        INSERT INTO knowledge_items (
            id, title, content, source_type, source_name,
            topic, intent_categories, priority, approved, embedding
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        )
        ON CONFLICT (id) DO NOTHING
    """, (
        chunk["id"],
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


def load_all():
    all_chunks = []
    for filepath in [CANONICAL_FILE, WEBSITE_FILE]:
        with open(filepath, "r", encoding="utf-8") as f:
            chunks = json.load(f)
            all_chunks.extend(chunks)
            print(f"[LOADED] {len(chunks)} chunks from {filepath}")

    print(f"\n[TOTAL] {len(all_chunks)} chunks to process\n")

    conn     = get_db_connection()
    cursor   = conn.cursor()
    inserted = 0
    failed   = 0

    for i, chunk in enumerate(all_chunks):
        try:
            print(f"[{i+1}/{len(all_chunks)}] Embedding: {chunk['title'][:60]}...")
            embedding = get_embedding(chunk["content"])
            insert_chunk(cursor, chunk, embedding)
            conn.commit()
            inserted += 1
        except Exception as e:
            print(f"  [ERROR] {e}")
            conn.rollback()
            failed += 1

    cursor.close()
    conn.close()
    print(f"\n✅ Done. {inserted} inserted, {failed} failed.")


if __name__ == "__main__":
    load_all()