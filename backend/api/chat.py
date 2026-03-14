from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
import psycopg2
import os
import uuid
import json
import hashlib
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.intent_router import detect_intent
from services.retrieval import retrieve
from services.response_generator import (
    generate_response, build_prompt,
    iter_ollama_stream, iter_openai_stream,
    get_buttons, USE_OPENAI
)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Divido Chatbot API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "info@projectdivido.com")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE", "(+20) 1080 833686")
CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS", "7"))


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


# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    clicked_button: str | None = None
    language: str = "en"

class ChatResponse(BaseModel):
    session_id: str
    message: str
    intent: str
    suggested_buttons: list[str]
    sources: list[dict]
    show_contact_form: bool = False
    contact_info: dict = {}

class LeadRequest(BaseModel):
    session_id: str
    name: str
    email: str
    phone: str | None = None
    context_message: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def is_arabic(text: str) -> bool:
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
    return arabic_chars / max(len(text), 1) > 0.3


def make_cache_key(message: str, intent: str, language: str) -> str:
    key = f"{message.lower().strip()}|{intent}|{language}"
    return hashlib.md5(key.encode()).hexdigest()


def get_cached_response(message_hash: str) -> str | None:
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT response_text FROM response_cache
            WHERE message_hash = %s
            AND created_at > NOW() - INTERVAL '%s days'
            LIMIT 1
        """, (message_hash, CACHE_TTL_DAYS))
        row = cursor.fetchone()
        if row:
            # Update hit count and last used
            cursor.execute("""
                UPDATE response_cache
                SET hit_count = hit_count + 1, last_used_at = NOW()
                WHERE message_hash = %s
            """, (message_hash,))
            conn.commit()
        cursor.close()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        print(f"[CACHE GET ERROR] {e}")
        return None


def save_cached_response(message_hash: str, response_text: str):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO response_cache (message_hash, response_text)
            VALUES (%s, %s)
            ON CONFLICT (message_hash) DO UPDATE SET
                response_text = EXCLUDED.response_text,
                created_at    = NOW(),
                last_used_at  = NOW()
        """, (message_hash, response_text))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[CACHE SAVE ERROR] {e}")


def get_conversation_history(session_id: str, max_turns: int = 6) -> list[dict]:
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_message, response_text
            FROM conversation_logs
            WHERE session_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """, (session_id, max_turns))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        history = []
        for user_msg, assistant_msg in reversed(rows):
            history.append({"role": "user",      "content": user_msg})
            history.append({"role": "assistant",  "content": assistant_msg})
        return history
    except Exception as e:
        print(f"[HISTORY ERROR] {e}")
        return []


def count_consecutive_fallbacks(session_id: str) -> int:
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT fallback_event FROM conversation_logs
            WHERE session_id = %s
            ORDER BY created_at DESC
            LIMIT 2
        """, (session_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return sum(1 for row in rows if row[0] is True)
    except Exception as e:
        print(f"[FALLBACK CHECK ERROR] {e}")
        return 0


def log_conversation(session_id, user_message, intent, retrieved_ids,
                     response_text, clicked_button, is_fallback):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversation_logs (
                session_id, user_message, detected_intent,
                retrieved_knowledge_ids, response_text,
                clicked_buttons, fallback_event, created_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            session_id, user_message, intent,
            retrieved_ids, response_text,
            [clicked_button] if clicked_button else [],
            is_fallback, datetime.utcnow()
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[LOG ERROR] {e}")


def build_done_event(session_id, intent, language, chunks,
                     show_form, contact_info) -> str:
    return json.dumps({
        "type":              "done",
        "session_id":        session_id,
        "intent":            intent,
        "suggested_buttons": get_buttons(intent, language),
        "sources": [
            {"title": c["title"], "source_type": c["source_type"],
             "source_name": c["source_name"]}
            for c in chunks
        ],
        "show_contact_form": show_form,
        "contact_info":      contact_info,
    })


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Divido Chatbot API"}


# ── Streaming Endpoint ────────────────────────────────────────────────────────
@app.post("/chat/stream")
@limiter.limit("20/minute")
def chat_stream(request: Request, body: ChatRequest):
    """SSE streaming endpoint — words appear as they are generated."""
    session_id   = body.session_id or str(uuid.uuid4())
    user_message = body.message.strip()

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # ── Language detection ────────────────────────────────────────────────
    detected_language = body.language
    if detected_language == "en" and is_arabic(user_message):
        detected_language = "ar"

    intent  = detect_intent(user_message)
    chunks  = retrieve(user_message, intent, top_k=5, language=detected_language)
    history = get_conversation_history(session_id, max_turns=6)

    cache_key = make_cache_key(user_message, intent, detected_language)
    cached    = get_cached_response(cache_key)

    consecutive_fallbacks = count_consecutive_fallbacks(session_id)
    show_form    = intent == "support" or consecutive_fallbacks >= 2
    contact_info = {"email": SUPPORT_EMAIL, "phone": SUPPORT_PHONE} if (show_form or intent == "support") else {}
    retrieved_ids = [c["id"] for c in chunks]
    is_fallback   = intent == "fallback"

    def generate():
        full_response = ""

        if cached:
            print(f"[CACHE HIT] {cache_key[:8]}… serving cached response")
            # Stream cached response word-by-word for consistent UX
            words = cached.split(" ")
            for i, word in enumerate(words):
                chunk = word if i == len(words) - 1 else word + " "
                full_response_ref = chunk  # track for log below
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
                time.sleep(0.025)
            full_response = cached
        else:
            print(f"[CACHE MISS] calling LLM for {cache_key[:8]}…")
            prompt   = build_prompt(user_message, intent, chunks, history, detected_language)
            streamer = iter_openai_stream(prompt) if USE_OPENAI else iter_ollama_stream(prompt)

            for chunk_text in streamer:
                full_response += chunk_text
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk_text})}\n\n"

            # Save to cache after full response is built
            if full_response.strip():
                save_cached_response(cache_key, full_response.strip())

        # Log and send final done event
        log_conversation(session_id, user_message, intent, retrieved_ids,
                         full_response, body.clicked_button, is_fallback)

        done = build_done_event(session_id, intent, detected_language,
                                chunks, show_form, contact_info)
        yield f"data: {done}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # tells nginx not to buffer SSE
            "Connection":       "keep-alive",
        }
    )


# ── Non-streaming Endpoint (kept for backwards compatibility) ─────────────────
@app.post("/chat/message", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat_message(request: Request, body: ChatRequest):
    session_id   = body.session_id or str(uuid.uuid4())
    user_message = body.message.strip()

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        detected_language = body.language
        if detected_language == "en" and is_arabic(user_message):
            detected_language = "ar"

        intent  = detect_intent(user_message)
        chunks  = retrieve(user_message, intent, top_k=5, language=detected_language)
        history = get_conversation_history(session_id, max_turns=6)

        # Check cache first
        cache_key = make_cache_key(user_message, intent, detected_language)
        cached    = get_cached_response(cache_key)

        if cached:
            print(f"[CACHE HIT] {cache_key[:8]}…")
            answer = cached
        else:
            result = generate_response(user_message, intent, chunks,
                                       history=history, language=detected_language)
            answer = result["answer"]
            save_cached_response(cache_key, answer)

        retrieved_ids = [c["id"] for c in chunks]
        is_fallback   = intent == "fallback"

        log_conversation(session_id, user_message, intent, retrieved_ids,
                         answer, body.clicked_button, is_fallback)

        consecutive_fallbacks = count_consecutive_fallbacks(session_id)
        show_form    = intent == "support" or consecutive_fallbacks >= 2
        contact_info = {"email": SUPPORT_EMAIL, "phone": SUPPORT_PHONE} if (show_form or intent == "support") else {}

        return ChatResponse(
            session_id        = session_id,
            message           = answer,
            intent            = intent,
            suggested_buttons = get_buttons(intent, detected_language),
            sources           = [{"title": c["title"], "source_type": c["source_type"],
                                   "source_name": c["source_name"]} for c in chunks],
            show_contact_form = show_form,
            contact_info      = contact_info,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Lead Capture ──────────────────────────────────────────────────────────────
@app.post("/chat/lead")
def submit_lead(body: LeadRequest):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leads (id, name, email, phone, session_id, context_message, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            str(uuid.uuid4()),
            body.name, body.email, body.phone,
            body.session_id, body.context_message,
            datetime.utcnow()
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "captured",
                "message": "Thank you! A member of our team will contact you shortly."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Welcome Buttons ───────────────────────────────────────────────────────────
@app.get("/chat/buttons/{context}")
def get_welcome_buttons(context: str, language: str = "en"):
    buttons_map = {
        "en": {
            "website": ["How Divido Works", "Start Investing", "Trust & Legal", "Contact Support"],
            "app":     ["How Divido Works", "Explore Opportunities", "Need Help", "Trust & Legal"]
        },
        "ar": {
            "website": ["كيف يعمل ديفيدو", "ابدأ الاستثمار", "الثقة والقانون", "تواصل مع الدعم"],
            "app":     ["كيف يعمل ديفيدو", "استكشف الفرص", "تحتاج مساعدة؟", "الثقة والقانون"]
        }
    }
    lang_buttons = buttons_map.get(language, buttons_map["en"])
    return {"buttons": lang_buttons.get(context, lang_buttons["website"])}