import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/generate"
LLM_MODEL   = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

INTENT_PROMPT_FILE = "backend/prompts/intent_router.prompt"

VALID_INTENTS = [
    "overview",
    "how_it_works",
    "getting_started",
    "opportunities",
    "trust_legal",
    "support",
    "fallback"
]

def load_prompt_template() -> str:
    with open(INTENT_PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


def detect_intent(user_message: str) -> str:
    template = load_prompt_template()
    prompt = template.replace("{{user_message}}", user_message)

    response = requests.post(OLLAMA_URL, json={
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    })
    response.raise_for_status()

    raw = response.json().get("response", "").strip().lower()

    for intent in VALID_INTENTS:
        if intent in raw:
            return intent

    return "fallback"


if __name__ == "__main__":
    test_messages = [
        "What is Divido?",
        "How does fractional ownership work?",
        "How do I start investing?",
        "Is this legal?",
        "I need help with my account",
        "What opportunities are available?",
        "blah blah random text"
    ]

    print("Testing intent router...\n")
    for msg in test_messages:
        intent = detect_intent(msg)
        print(f"  '{msg}' → {intent}")