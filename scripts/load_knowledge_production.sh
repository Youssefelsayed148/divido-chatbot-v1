#!/bin/bash
# ── Divido Chatbot — Production Knowledge Loader ──────────────────────────────
# Run this ONCE after first docker-compose up
# Works on Linux/Mac. On Windows run the commands manually (see below).

echo "🏠 Divido Chatbot — Loading knowledge base..."
echo ""

echo "📄 Loading English seeds..."
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_seeds

echo "📄 Loading Arabic documents..."
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_knowledge_docx_ar

echo "🌐 Loading Arabic website content..."
docker exec --env-file .env.production divido_chat_api python -m backend.ingestion.load_knowledge_ar

echo ""
echo "✅ Verifying knowledge count..."
docker exec divido_db psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT COUNT(*) FROM knowledge_items;"

echo ""
echo "✅ Knowledge base loaded. Open the Admin Panel to verify."