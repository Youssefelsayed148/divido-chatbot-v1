# Divido Chatbot V1

An AI-powered bilingual (English + Arabic) chatbot for the Divido fractional real estate investment platform. Deployed as a website widget and mobile app component.

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js v24+
- Ollama running locally with `llama3.1:8b` and `nomic-embed-text`

### Local Development (without Docker)
```bash
# Backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn backend.api.chat:app --reload --port 8000
uvicorn backend.api.admin:app --reload --port 8001

# Frontend
cd frontend/chat-widget && npm install && npm run dev
cd frontend/admin && npm install && npm run dev -- --port 5174
```

### Docker (recommended)
```bash
# Build frontends
cd frontend/chat-widget && npm run build && cd ../..
cd frontend/admin && npm run build && cd ../..

# Start all containers
docker-compose --env-file .env.production up -d --build

# Load knowledge (first time only)
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_seeds
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_knowledge_docx_ar
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_knowledge_ar
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_knowledge

# Open
# http://localhost:8080       → chat widget
# http://localhost:8080/admin/ → admin panel
```

## Project Structure
```
divido-chatbot/
├── backend/
│   ├── api/
│   │   ├── chat.py              # Chat API + streaming + cache
│   │   └── admin.py             # Admin API + analytics
│   ├── services/
│   │   ├── intent_router.py     # LLM intent classification
│   │   ├── retrieval.py         # Vector similarity search
│   │   └── response_generator.py # LLM response + streaming
│   ├── ingestion/
│   │   ├── load_seeds.py        # English seed knowledge
│   │   ├── load_knowledge.py    # English canonical + website chunks
│   │   ├── load_knowledge_ar.py # Arabic website chunks
│   │   └── load_knowledge_docx_ar.py # Arabic Word doc chunks
│   └── prompts/
│       ├── answer_generator.prompt
│       └── intent_router.prompt
├── frontend/
│   ├── chat-widget/             # React widget (Vite)
│   │   └── src/ChatWidget.jsx
│   └── admin/                   # React admin panel (Vite)
│       └── src/AdminPanel.jsx
├── data/
│   ├── knowledge_seed.json
│   ├── processed/               # Pre-processed chunks (gitignored)
│   └── raw/                     # Source documents (gitignored)
├── nginx/
│   ├── nginx.conf               # Reverse proxy config
│   └── ssl/                     # SSL certs (gitignored)
├── scripts/
│   ├── init.sql                 # DB schema (runs on first up)
│   └── load_knowledge_production.sh
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.production              # Real credentials (gitignored)
└── .env.production.example      # Template for deployer
```

## Environment Variables
See `.env.production.example` for all required variables.

Key variables:
| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `ADMIN_PASSWORD` | Admin panel login password |
| `OLLAMA_BASE_URL` | Ollama URL (host.docker.internal:11434 in Docker) |
| `OLLAMA_MODEL` | LLM model name (llama3.1:8b) |
| `OLLAMA_EMBED_MODEL` | Embedding model (nomic-embed-text) |
| `USE_OPENAI` | Set to true to switch to OpenAI |
| `OPENAI_API_KEY` | OpenAI key (only if USE_OPENAI=true) |
| `SUPPORT_EMAIL` | Shown in contact card |
| `SUPPORT_PHONE` | Shown in contact card |
| `CACHE_TTL_DAYS` | Response cache lifetime (default: 7) |

## API Endpoints

### Chat API (port 8000)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/chat/stream` | Streaming SSE response |
| POST | `/chat/message` | Non-streaming response |
| POST | `/chat/lead` | Submit contact form |
| GET | `/chat/buttons/{context}` | Welcome buttons |

### Admin API (port 8001)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/login` | Get auth token |
| GET | `/admin/knowledge` | List knowledge items |
| POST | `/admin/knowledge` | Add knowledge item |
| PUT | `/admin/knowledge/{id}` | Update item |
| DELETE | `/admin/knowledge/{id}` | Delete item |
| POST | `/admin/preview` | Test bot response |
| GET | `/admin/leads` | List leads |
| GET | `/admin/analytics/overview` | Dashboard stats |

## Switching to OpenAI
In `.env.production`:
```
USE_OPENAI=true
OPENAI_API_KEY=sk-...
```
Restart containers. No code changes needed.

## Common Commands
```bash
# View logs
docker-compose logs chat_api -f
docker-compose logs nginx -f

# Restart single service
docker-compose restart nginx

# Check DB
docker exec divido_db psql -U divido_user -d divido_chatbot -c "SELECT COUNT(*) FROM knowledge_items;"

# Backup DB
docker exec divido_db pg_dump -U divido_user divido_chatbot > backup_$(date +%Y%m%d).sql
```
