"""
DocuMind FastAPI backend.

Thin API layer around the existing RAG pipeline — does not duplicate retrieval logic.
"""

from __future__ import annotations

import logging
import os
import traceback
from pathlib import Path
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field

from ragpipeline import (
    DOCUMENTS_DIR,
    SUPPORTED_EXTENSIONS,
    chromadb_available,
    deduplicate_sources,
    delete_document,
    ensure_documents_dir,
    get_indexed_filenames,
    index_document,
    list_documents_info,
    reindex_all_documents,
    retrieve_context,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("documind.api")

# ==========================================
# Config
# ==========================================

LLM_MODEL = os.getenv("LLM_MODEL", "gemma3:4b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

NOT_FOUND_PHRASE = "I couldn't find this information in the provided documents."

SYSTEM_PROMPT = f"""You are an AI document assistant.

Answer questions only using the supplied document context.

Rules:
- Do not make up information.
- If the answer cannot be found in the supplied context, say exactly:
  "{NOT_FOUND_PHRASE}"
- Do not invent facts.
- Do not invent sources.
- Do not invent filenames or page numbers.
- Cite the documents you use by their ID in brackets like [1] or [2].
- Source attribution is handled by the application.
- Give concise but useful answers.
- Preserve important technical details.
- Do not use outside knowledge.
"""

LLM = ChatOllama(model=LLM_MODEL, temperature=0.1, base_url=OLLAMA_BASE_URL)

app = FastAPI(
    title="DocuMind API",
    description="AI Document Intelligence backend",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Schemas
# ==========================================

class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[HistoryMessage] = Field(default_factory=list)
    session_id: Optional[str] = None


class SourceItem(BaseModel):
    source: str
    page: Optional[int] = None
    file_type: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    status: str
    indexed: bool
    doc_hash: Optional[str] = None


class UploadResponse(BaseModel):
    status: str
    filename: str
    chunks: int
    message: str
    document: DocumentInfo


class HealthResponse(BaseModel):
    status: str
    ollama: bool
    chromadb: bool


# ==========================================
# Helpers
# ==========================================

def check_ollama() -> bool:
    try:
        response = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        return response.status_code == 200
    except Exception:
        return False


def _message_text(content) -> str:
    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, str):
                text_parts.append(block)
            elif isinstance(block, dict) and "text" in block:
                text_parts.append(str(block["text"]))
        return "".join(text_parts)
    return str(content)


def is_not_found_answer(answer: str) -> bool:
    lowered = answer.lower().strip()
    needles = [
        "couldn't find this information",
        "could not find this information",
        "not found in the provided documents",
        "not present in the provided",
        "no relevant information",
        "i don't know",
        "i do not know",
    ]
    return any(n in lowered for n in needles)


def generate_answer(question: str, context: str, history: list[HistoryMessage] | None = None) -> str:
    if not context or not context.strip():
        return NOT_FOUND_PHRASE

    prompt = f"""{SYSTEM_PROMPT}

Document context:
{context}

User question:
{question}

Answer using only the document context above."""

    messages = [SystemMessage(content=prompt)]

    # Keep a short conversational window (RAG remains grounded on latest question context)
    for turn in (history or [])[-6:]:
        if turn.role == "user":
            messages.append(HumanMessage(content=turn.content))
        else:
            messages.append(AIMessage(content=turn.content))

    messages.append(HumanMessage(content=question))

    response = LLM.invoke(messages)
    answer = _message_text(response.content).strip()
    return answer or NOT_FOUND_PHRASE


def _document_info_for(filename: str) -> DocumentInfo:
    ensure_documents_dir()
    docs = {d["id"]: d for d in list_documents_info()}
    if filename not in docs:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentInfo(**docs[filename])


def user_error(status: int, message: str, exc: Exception | None = None) -> HTTPException:
    if exc is not None:
        logger.error("%s | %s", message, exc)
        logger.debug(traceback.format_exc())
    else:
        logger.error(message)
    return HTTPException(status_code=status, detail=message)


# ==========================================
# Routes
# ==========================================

@app.on_event("startup")
def on_startup():
    ensure_documents_dir()
    # One-time cleanup of historical duplicate chunks when manifest is missing
    manifest = Path("chroma_db") / "documind_manifest.json"
    if not manifest.exists() and list(DOCUMENTS_DIR.glob("*")):
        try:
            logger.info("Building clean knowledge-base index (content-hash safe)...")
            reindex_all_documents()
            logger.info("Knowledge-base reindex complete.")
        except Exception as exc:
            logger.exception("Startup reindex failed: %s", exc)


@app.get("/api/health", response_model=HealthResponse)
def health():
    ollama_ok = check_ollama()
    chroma_ok = chromadb_available()
    return HealthResponse(
        status="ok" if ollama_ok and chroma_ok else "degraded",
        ollama=ollama_ok,
        chromadb=chroma_ok,
    )


@app.get("/api/documents", response_model=list[DocumentInfo])
def get_documents():
    return [DocumentInfo(**doc) for doc in list_documents_info()]


@app.post("/api/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise user_error(400, "No filename provided.")

    filename = Path(file.filename).name
    suffix = Path(filename).suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise user_error(
            400,
            "Unsupported file type. Please upload a PDF or TXT file.",
        )

    data = await file.read()
    if not data:
        raise user_error(400, "Uploaded file is empty.")

    if len(data) > MAX_UPLOAD_BYTES:
        raise user_error(400, "File exceeds the 20MB upload limit.")

    if not check_ollama():
        raise user_error(
            503,
            "Ollama unavailable. Please make sure Ollama is running with nomic-embed-text.",
        )

    ensure_documents_dir()
    destination = DOCUMENTS_DIR / filename

    try:
        destination.write_bytes(data)
        result = index_document(destination)
    except ValueError as exc:
        if destination.exists():
            # Only remove if it was not previously indexed under another hash
            try:
                info = next((d for d in list_documents_info() if d["id"] == filename), None)
                if not info or not info.get("indexed"):
                    destination.unlink(missing_ok=True)
            except Exception:
                pass
        raise user_error(400, str(exc), exc) from exc
    except Exception as exc:
        if destination.exists():
            try:
                info = next((d for d in list_documents_info() if d["id"] == filename), None)
                if not info or not info.get("indexed"):
                    destination.unlink(missing_ok=True)
            except Exception:
                pass
        raise user_error(
            500,
            "Document processing failed. Please try again.",
            exc,
        ) from exc

    return UploadResponse(
        status=result["status"],
        filename=result["filename"],
        chunks=result["chunks"],
        message=result["message"],
        document=_document_info_for(filename),
    )


@app.delete("/api/documents/{document_id}")
def remove_document(document_id: str):
    filename = Path(document_id).name
    path = DOCUMENTS_DIR / filename

    if not path.exists() and filename not in get_indexed_filenames():
        raise user_error(404, "Document not found.")

    try:
        return delete_document(filename)
    except Exception as exc:
        raise user_error(500, "Unable to delete document. Please try again.", exc) from exc


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise user_error(400, "Message cannot be empty.")

    docs = list_documents_info()
    if not docs:
        raise user_error(
            400,
            "Your knowledge base is empty. Upload PDF or TXT documents to start asking questions.",
        )

    if not any(doc.get("indexed") for doc in docs):
        raise user_error(400, "Documents are still being indexed. Please wait.")

    if not check_ollama():
        raise user_error(
            503,
            "Ollama unavailable. Please make sure Ollama is running.",
        )

    try:
        context, sources, meta = retrieve_context(message)
    except Exception as exc:
        raise user_error(
            500,
            "Unable to search the knowledge base. Please try again.",
            exc,
        ) from exc

    logger.info(
        "chat query=%r meta=%s sources=%s",
        message,
        meta,
        [s.get("source") for s in sources],
    )

    try:
        answer = generate_answer(message, context, request.history)
    except Exception as exc:
        raise user_error(
            500,
            "Unable to generate an answer. Please try again.",
            exc,
        ) from exc

    # Never attribute sources when the model (or retriever) found nothing useful
    if is_not_found_answer(answer) or meta.get("rejected") or not context.strip():
        return ChatResponse(answer=NOT_FOUND_PHRASE if is_not_found_answer(answer) or meta.get("rejected") else answer, sources=[])

    import re
    citations = set(int(m) for m in re.findall(r'\[(\d+)\]', answer))
    
    used_sources = [s for s in sources if s.get("id") in citations]
    if not citations:
        used_sources = sources

    answer = re.sub(r'\s*\[\d+\]', '', answer)

    unique_sources = deduplicate_sources(used_sources)

    return ChatResponse(
        answer=answer,
        sources=[SourceItem(**item) for item in unique_sources],
    )


@app.get("/")
def root():
    return {
        "name": "DocuMind API",
        "version": "1.1.0",
        "docs": "/docs",
    }
