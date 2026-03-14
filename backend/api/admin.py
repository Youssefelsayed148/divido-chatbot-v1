from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv
import requests

load_dotenv()

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.retrieval import retrieve
from services.response_generator import generate_response
from services.intent_router import detect_intent

app = FastAPI(title="Divido Admin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5174").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
OLLAMA_URL     = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/embeddings"
EMBED_MODEL    = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

# ── In-memory token store ─────────────────────────────────────────────────────
active_tokens: set[str] = set()


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


# ── Auth ──────────────────────────────────────────────────────────────────────
def verify_token(x_admin_token: str = Header(...)):
    if x_admin_token not in active_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return x_admin_token


# ── Models ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    password: str

class KnowledgeItem(BaseModel):
    title: str
    content: str
    source_type: str
    source_name: str
    topic: str | None = None
    intent_categories: list[str] = []
    priority: int = 2
    approved: bool = True

class PreviewRequest(BaseModel):
    question: str


# ── Embedding Helper ──────────────────────────────────────────────────────────
def generate_embedding(text: str) -> list[float]:
    response = requests.post(OLLAMA_URL, json={
        "model": EMBED_MODEL,
        "prompt": text
    })
    response.raise_for_status()
    return response.json()["embedding"]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/admin/health")
def health():
    return {"status": "ok", "service": "Divido Admin API"}


@app.post("/admin/login")
def login(body: LoginRequest):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect password")
    token = str(uuid.uuid4())
    active_tokens.add(token)
    return {"token": token}


@app.post("/admin/logout")
def logout(token: str = Depends(verify_token)):
    active_tokens.discard(token)
    return {"status": "logged out"}


@app.get("/admin/knowledge")
def list_knowledge(token: str = Depends(verify_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, source_type, source_name, topic,
               intent_categories, priority, approved, updated_at
        FROM knowledge_items
        ORDER BY priority ASC, updated_at DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"items": [
        {
            "id":                str(row[0]),
            "title":             row[1],
            "source_type":       row[2],
            "source_name":       row[3],
            "topic":             row[4],
            "intent_categories": row[5] or [],
            "priority":          row[6],
            "approved":          row[7],
            "updated_at":        row[8].isoformat() if row[8] else None
        }
        for row in rows
    ]}


@app.get("/admin/knowledge/{item_id}")
def get_knowledge_item(item_id: str, token: str = Depends(verify_token)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, content, source_type, source_name,
               topic, intent_categories, priority, approved
        FROM knowledge_items WHERE id = %s
    """, (item_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "id":                str(row[0]),
        "title":             row[1],
        "content":           row[2],
        "source_type":       row[3],
        "source_name":       row[4],
        "topic":             row[5],
        "intent_categories": row[6] or [],
        "priority":          row[7],
        "approved":          row[8]
    }


@app.post("/admin/knowledge")
def add_knowledge(item: KnowledgeItem, token: str = Depends(verify_token)):
    embedding = generate_embedding(item.title + " " + item.content)
    item_id   = str(uuid.uuid4())
    now       = datetime.utcnow()
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO knowledge_items (
            id, title, content, source_type, source_name,
            topic, intent_categories, priority, approved,
            embedding, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        item_id, item.title, item.content, item.source_type,
        item.source_name, item.topic, item.intent_categories,
        item.priority, item.approved, embedding, now
    ))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "created", "id": item_id}


@app.put("/admin/knowledge/{item_id}")
def update_knowledge(item_id: str, item: KnowledgeItem, token: str = Depends(verify_token)):
    embedding = generate_embedding(item.title + " " + item.content)
    now       = datetime.utcnow()
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE knowledge_items SET
            title=%s, content=%s, source_type=%s, source_name=%s,
            topic=%s, intent_categories=%s, priority=%s,
            approved=%s, embedding=%s, updated_at=%s
        WHERE id=%s
    """, (
        item.title, item.content, item.source_type, item.source_name,
        item.topic, item.intent_categories, item.priority,
        item.approved, embedding, now, item_id
    ))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "updated", "id": item_id}


@app.delete("/admin/knowledge/{item_id}")
def delete_knowledge(item_id: str, token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM knowledge_items WHERE id = %s", (item_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted", "id": item_id}


@app.post("/admin/preview")
def preview_answer(body: PreviewRequest, token: str = Depends(verify_token)):
    intent = detect_intent(body.question)
    chunks = retrieve(body.question, intent, top_k=5)
    result = generate_response(body.question, intent, chunks, history=[])
    return {
        "question":     body.question,
        "intent":       intent,
        "answer":       result["answer"],
        "sources_used": result["sources"],
        "buttons":      result["suggested_buttons"]
    }


# ── Leads Management ──────────────────────────────────────────────────────────

@app.get("/admin/leads")
def list_leads(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, phone, session_id,
               context_message, contacted, created_at
        FROM leads
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"leads": [
        {
            "id":              str(row[0]),
            "name":            row[1],
            "email":           row[2],
            "phone":           row[3],
            "session_id":      row[4],
            "context_message": row[5],
            "contacted":       row[6],
            "created_at":      row[7].isoformat() if row[7] else None
        }
        for row in rows
    ]}


@app.put("/admin/leads/{lead_id}/contacted")
def mark_contacted(lead_id: str, token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE leads SET contacted = NOT contacted WHERE id = %s RETURNING contacted",
        (lead_id,)
    )
    result = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    if not result:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"id": lead_id, "contacted": result[0]}


@app.delete("/admin/leads/{lead_id}")
def delete_lead(lead_id: str, token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leads WHERE id = %s", (lead_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted", "id": lead_id}


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.get("/admin/analytics/overview")
def analytics_overview(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(DISTINCT session_id) FROM conversation_logs")
    total_sessions = (cursor.fetchone() or (0,))[0]

    cursor.execute("SELECT COUNT(*) FROM conversation_logs")
    total_messages = (cursor.fetchone() or (0,))[0]

    cursor.execute("SELECT COUNT(*) FROM conversation_logs WHERE fallback_event = TRUE")
    total_fallbacks = (cursor.fetchone() or (0,))[0]
    fallback_rate = round((total_fallbacks / total_messages * 100), 1) if total_messages > 0 else 0

    cursor.execute("SELECT COUNT(*) FROM leads")
    total_leads = (cursor.fetchone() or (0,))[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE contacted = FALSE")
    uncontacted_leads = (cursor.fetchone() or (0,))[0]

    cursor.execute(
        "SELECT COUNT(DISTINCT session_id) FROM conversation_logs WHERE DATE(created_at) = CURRENT_DATE"
    )
    today_sessions = (cursor.fetchone() or (0,))[0]

    cursor.execute(
        "SELECT COUNT(*) FROM conversation_logs WHERE DATE(created_at) = CURRENT_DATE"
    )
    today_messages = (cursor.fetchone() or (0,))[0]

    cursor.close()
    conn.close()
    return {
        "total_sessions":    total_sessions,
        "total_messages":    total_messages,
        "fallback_rate":     fallback_rate,
        "total_fallbacks":   total_fallbacks,
        "total_leads":       total_leads,
        "uncontacted_leads": uncontacted_leads,
        "today_sessions":    today_sessions,
        "today_messages":    today_messages,
    }


@app.get("/admin/analytics/intents")
def analytics_intents(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT detected_intent, COUNT(*) AS count
        FROM conversation_logs
        GROUP BY detected_intent
        ORDER BY count DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"intents": [{"intent": row[0], "count": row[1]} for row in rows]}


@app.get("/admin/analytics/buttons")
def analytics_buttons(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT unnest(clicked_buttons) AS button, COUNT(*) AS count
        FROM conversation_logs
        WHERE clicked_buttons IS NOT NULL
          AND array_length(clicked_buttons, 1) > 0
        GROUP BY button
        ORDER BY count DESC
        LIMIT 10
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"buttons": [{"button": row[0], "count": row[1]} for row in rows]}


@app.get("/admin/analytics/daily")
def analytics_daily(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DATE(created_at) AS day,
               COUNT(DISTINCT session_id) AS sessions,
               COUNT(*) AS messages
        FROM conversation_logs
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day
        ORDER BY day ASC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"daily": [
        {"date": row[0].isoformat(), "sessions": row[1], "messages": row[2]}
        for row in rows
    ]}


@app.get("/admin/analytics/fallbacks")
def analytics_fallbacks(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_message, session_id, created_at
        FROM conversation_logs
        WHERE fallback_event = TRUE
        ORDER BY created_at DESC
        LIMIT 25
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"fallbacks": [
        {"message": row[0], "session_id": row[1], "created_at": row[2].isoformat()}
        for row in rows
    ]}


@app.get("/admin/analytics/topics")
def analytics_topics(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            ki.topic,
            ki.source_name,
            COUNT(*) AS retrieval_count
        FROM conversation_logs cl,
             unnest(cl.retrieved_knowledge_ids) AS kid
        JOIN knowledge_items ki ON ki.id::text = kid
        WHERE ki.topic IS NOT NULL
          AND ki.topic != ''
        GROUP BY ki.topic, ki.source_name
        ORDER BY retrieval_count DESC
        LIMIT 15
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"topics": [
        {"topic": row[0], "source_name": row[1], "retrieval_count": row[2]}
        for row in rows
    ]}


@app.get("/admin/analytics/export")
def export_logs(token: str = Depends(verify_token)):
    import csv, io
    from fastapi.responses import StreamingResponse

    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT session_id, user_message, detected_intent,
               response_text, clicked_buttons, fallback_event, created_at
        FROM conversation_logs
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "session_id", "user_message", "detected_intent",
        "response_text", "clicked_buttons", "fallback_event", "created_at"
    ])
    for row in rows:
        writer.writerow(row)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=conversation_logs.csv"}
    )


@app.get("/admin/analytics/knowledge_count")
def analytics_knowledge_count(token: str = Depends(verify_token)):
    conn   = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM knowledge_items WHERE approved = TRUE")
    approved = (cursor.fetchone() or (0,))[0]
    cursor.execute("SELECT COUNT(*) FROM knowledge_items")
    total = (cursor.fetchone() or (0,))[0]
    cursor.close()
    conn.close()
    return {"approved": approved, "total": total}