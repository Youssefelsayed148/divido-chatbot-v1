import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# ── Model Config ──────────────────────────────────────────────────────────────
USE_OPENAI   = os.getenv("USE_OPENAI", "false").lower() == "true"
OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = "gpt-4o"

OLLAMA_URL   = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/generate"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

PROMPT_FILE  = "backend/prompts/answer_generator.prompt"


# ── Helpers ───────────────────────────────────────────────────────────────────
def load_prompt_template() -> str:
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


def build_context(retrieved_chunks: list[dict]) -> str:
    context_parts = []
    for chunk in retrieved_chunks:
        source_label = (
            "Official Document" if chunk["source_type"] == "canonical_doc"
            else "Website Content"
        )
        context_parts.append(
            f"[{source_label} | {chunk['source_name']} | Topic: {chunk['topic']}]\n"
            f"{chunk['content']}"
        )
    return "\n\n---\n\n".join(context_parts)


def build_history_block(history: list[dict]) -> str:
    if not history:
        return ""
    lines = []
    for turn in history:
        role = "User" if turn["role"] == "user" else "Assistant"
        lines.append(f"{role}: {turn['content']}")
    return "\n".join(lines)


def build_prompt(
    user_message: str,
    intent: str,
    retrieved_chunks: list[dict],
    history: list[dict] = [],
    language: str = "en"
) -> str:
    """Build the full prompt string — shared by streaming and non-streaming."""
    template      = load_prompt_template()
    context       = build_context(retrieved_chunks)
    history_block = build_history_block(history)

    if language == "ar":
        language_instruction = (
            "CRITICAL INSTRUCTION: You MUST respond ENTIRELY in Arabic. "
            "Do NOT write any English words, sentences, or closing remarks. "
            "Do NOT add phrases like 'visit our website' or 'contact support' in English. "
            "Every single word in your response must be in Arabic. "
            "The user is using the Arabic version of the Divido platform.\n\n"
        )
    else:
        language_instruction = (
            "CRITICAL INSTRUCTION: You MUST respond ENTIRELY in English. "
            "Do NOT write any Arabic words or sentences under any circumstances. "
            "Even if the context documents contain Arabic text, your response must be in English only. "
            "The user is using the English version of the Divido platform.\n\n"
        )

    return (language_instruction + template
        .replace("{user_message}", user_message)
        .replace("{intent}",       intent)
        .replace("{context}",      context)
        .replace("{history}",      history_block)
    )


# ── LLM Calls ─────────────────────────────────────────────────────────────────
def call_ollama(prompt: str) -> str:
    response = requests.post(OLLAMA_URL, json={
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }, timeout=120)
    response.raise_for_status()
    return response.json().get("response", "").strip()


def iter_ollama_stream(prompt: str):
    """Sync generator — yields text chunks from Ollama streaming API."""
    with requests.post(OLLAMA_URL, json={
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True
    }, stream=True, timeout=120) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    if data.get("response"):
                        yield data["response"]
                    if data.get("done"):
                        break
                except Exception:
                    pass


def call_openai(prompt: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000,
        temperature=0.3
    )
    content = response.choices[0].message.content
    return content.strip() if content else ""


def iter_openai_stream(prompt: str):
    """Sync generator — yields text chunks from OpenAI streaming API."""
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_KEY)
    stream = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1000,
        temperature=0.3,
        stream=True
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


# ── Button Maps ───────────────────────────────────────────────────────────────
BUTTON_MAP_EN = {
    "overview":        ["How Divido Works", "Start Investing", "Contact Support"],
    "how_it_works":    ["Start Investing", "Explore Opportunities", "Contact Support"],
    "getting_started": ["Explore Opportunities", "Trust & Legal", "Contact Support"],
    "opportunities":   ["Start Investing", "How Divido Works", "Contact Support"],
    "trust_legal":     ["How Divido Works", "Start Investing", "Contact Support"],
    "support":         ["How Divido Works", "Start Investing", "Contact Support"],
    "fallback":        ["How Divido Works", "Start Investing", "Contact Support"],
}

BUTTON_MAP_AR = {
    "overview":        ["كيف يعمل ديفيدو", "ابدأ الاستثمار", "تواصل مع الدعم"],
    "how_it_works":    ["ابدأ الاستثمار", "استكشف الفرص", "تواصل مع الدعم"],
    "getting_started": ["استكشف الفرص", "الثقة والقانون", "تواصل مع الدعم"],
    "opportunities":   ["ابدأ الاستثمار", "كيف يعمل ديفيدو", "تواصل مع الدعم"],
    "trust_legal":     ["كيف يعمل ديفيدو", "ابدأ الاستثمار", "تواصل مع الدعم"],
    "support":         ["كيف يعمل ديفيدو", "ابدأ الاستثمار", "تواصل مع الدعم"],
    "fallback":        ["كيف يعمل ديفيدو", "ابدأ الاستثمار", "تواصل مع الدعم"],
}


def get_buttons(intent: str, language: str) -> list[str]:
    bmap = BUTTON_MAP_AR if language == "ar" else BUTTON_MAP_EN
    return bmap.get(intent, bmap["fallback"])


# ── Main Function (non-streaming, used for cache fallback) ────────────────────
def generate_response(
    user_message: str,
    intent: str,
    retrieved_chunks: list[dict],
    history: list[dict] = [],
    language: str = "en"
) -> dict:
    print(f"[DEBUG] generate_response called with language={language}")

    prompt = build_prompt(user_message, intent, retrieved_chunks, history, language)

    if USE_OPENAI:
        print("[LLM] Using OpenAI GPT-4o")
        answer = call_openai(prompt)
    else:
        print(f"[LLM] Using Ollama {OLLAMA_MODEL} at {OLLAMA_URL}")
        answer = call_ollama(prompt)

    return {
        "answer":            answer,
        "intent":            intent,
        "suggested_buttons": get_buttons(intent, language),
        "sources": [
            {
                "title":       c["title"],
                "source_type": c["source_type"],
                "source_name": c["source_name"],
            }
            for c in retrieved_chunks
        ]
    }