import os
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/embeddings"
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

INTENT_SOURCE_PREFERENCE = {
    "trust_legal":     "canonical_doc",
    "overview":        "canonical_doc",
    "how_it_works":    "canonical_doc",
    "getting_started": "canonical_doc",
    "opportunities":   "canonical_doc",
    "support":         "canonical_doc",
    "fallback":        "canonical_doc",
}


# ── DB Connection ─────────────────────────────────────────────────────────────
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
    response = requests.post(OLLAMA_URL, json={
        "model": EMBED_MODEL,
        "prompt": text
    })
    response.raise_for_status()
    return response.json()["embedding"]


def retrieve(user_message: str, intent: str, top_k: int = 5, language: str = "en") -> list[dict]:
    embedding        = get_embedding(user_message)
    preferred_source = INTENT_SOURCE_PREFERENCE.get(intent, "website")

    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            id, title, content, source_type, source_name, topic, priority,
            (1 - (embedding <=> %s::vector)) AS semantic_score,
            CASE WHEN source_type = %s THEN 0.15 ELSE 0.0 END AS source_bonus,
            CASE WHEN source_type = 'canonical_doc' THEN 0.20 ELSE 0.0 END AS priority_bonus
        FROM knowledge_items
        WHERE approved = true
        ORDER BY (
            (1 - (embedding <=> %s::vector)) +
            CASE WHEN source_type = %s THEN 0.15 ELSE 0.0 END +
            CASE WHEN source_type = 'canonical_doc' THEN 0.20 ELSE 0.0 END
        ) DESC
        LIMIT %s
    """, (
        str(embedding), preferred_source,
        str(embedding), preferred_source,
        top_k
    ))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "id":             row[0],
            "title":          row[1],
            "content":        row[2],
            "source_type":    row[3],
            "source_name":    row[4],
            "topic":          row[5],
            "priority":       row[6],
            "semantic_score": round(float(row[7]), 4),
            "source_bonus":   round(float(row[8]), 4),
            "priority_bonus": round(float(row[9]), 4),
        }
        for row in rows
    ]


if __name__ == "__main__":
    tests = [
        ("What is Divido?", "overview"),
        ("Is fractional ownership legal?", "trust_legal"),
        ("How do I start investing?", "getting_started"),
        ("What investment opportunities are there?", "opportunities"),
        ("How do I contact support?", "support"),
    ]

    for message, intent in tests:
        print(f"\nQuery: '{message}' (intent: {intent})")
        print("-" * 60)
        results = retrieve(message, intent, top_k=3)
        for r in results:
            print(f"  [{r['source_type']}] {r['title']}")
            print(f"  Score: {r['semantic_score']} + bonus: {round(r['source_bonus'] + r['priority_bonus'], 2)}")