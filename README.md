# DocuMind — AI Document Intelligence

Professional document Q&A app built on your existing LangChain + Ollama + ChromaDB RAG pipeline.

## Architecture

```
React + TypeScript + Tailwind
            ↓
         FastAPI
            ↓
    Existing RAG Pipeline
            ↓
         ChromaDB
            ↓
    Ollama (nomic-embed-text + gemma3:4b)
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) running locally with:
  - `gemma3:4b`
  - `nomic-embed-text`

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text
```

## Setup

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Run

Terminal 1 — API:

```bash
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Terminal 2 — UI:

```bash
cd frontend
npm run dev
```

Open http://localhost:5173

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Ollama + ChromaDB status |
| GET | `/api/documents` | List uploaded documents |
| POST | `/api/upload` | Upload & index PDF/TXT |
| DELETE | `/api/documents/{id}` | Remove document + vectors |
| POST | `/api/chat` | Ask a question (returns answer + sources) |

## Notes

- Existing `ragpipeline.py` retrieval logic is preserved (`retrieve_context`).
- Duplicate indexing is avoided via Chroma metadata + stable chunk IDs.
- Sources come from retrieved chunk metadata — the LLM never invents filenames/pages.
- CLI chatbot (`python chatbot.py`) still works independently.
