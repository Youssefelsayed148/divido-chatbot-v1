import os
import json
import uuid
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

SEED_FILE   = "data/knowledge_seed.json"
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


def load_seeds():
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        seeds = json.load(f)

    conn     = get_db_connection()
    cursor   = conn.cursor()
    inserted = 0

    for seed in seeds:
        try:
            print(f"[EMBEDDING] {seed['title']}")
            embedding = get_embedding(seed["content"])

            cursor.execute("""
                INSERT INTO knowledge_items (
                    id, title, content, source_type, source_name,
                    topic, intent_categories, priority, approved, embedding
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (
                str(uuid.uuid4()),
                seed["title"],
                seed["content"],
                "canonical_doc",
                seed["source_name"],
                seed["topic"],
                seed["intent_categories"],
                1,
                True,
                str(embedding)
            ))
            conn.commit()
            inserted += 1
        except Exception as e:
            print(f"  [ERROR] {e}")
            conn.rollback()

    cursor.close()
    conn.close()
    print(f"\n✅ Done. {inserted} seed entries inserted.")


if __name__ == "__main__":
    load_seeds()