from pathlib import Path
import hashlib
import json
import logging
from typing import Any, Optional

from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
)
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

logger = logging.getLogger("documind.rag")

# ==========================================
# Configuration
# ==========================================

DOCUMENTS_DIR = Path("documents")
VECTORSTORE_DIR = "vectorstore"

EMBEDDING_MODEL = "nomic-embed-text"
CHROMA_DIR = "chroma_db"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

COLLECTION_NAME = "rag_documents"
SUPPORTED_EXTENSIONS = {".pdf", ".txt"}

# Retrieval: lower distance = more similar (Chroma default L2)
RETRIEVAL_K = 8
# Reject entire result set when the best match is this weak
MAX_BEST_DISTANCE = 1.02
# Keep only chunks close to the best score (cuts weakly related noise)
SCORE_MARGIN = 0.045
# Hard cap after filtering
MAX_CONTEXT_CHUNKS = 4

MANIFEST_PATH = Path(CHROMA_DIR) / "documind_manifest.json"


# ==========================================
# Embeddings
# ==========================================

embeddings = OllamaEmbeddings(
    model=EMBEDDING_MODEL
)


# ==========================================
# Helpers
# ==========================================

def ensure_documents_dir():
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    return DOCUMENTS_DIR


def _normalize_source_name(source: str) -> str:
    return Path(source).name


def file_content_hash(file_path: Path) -> str:
    data = Path(file_path).read_bytes()
    return hashlib.sha256(data).hexdigest()


def list_document_files():
    """Return PDF/TXT files currently in the documents folder."""
    ensure_documents_dir()

    files = []
    for file_path in sorted(DOCUMENTS_DIR.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(file_path)

    return files


def _load_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {"documents": {}}
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"documents": {}}


def _save_manifest(manifest: dict[str, Any]) -> None:
    Path(CHROMA_DIR).mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def get_indexed_filenames() -> set[str]:
    """Filenames present in Chroma metadata or the local manifest."""
    filenames: set[str] = set()

    manifest = _load_manifest()
    for filename, meta in (manifest.get("documents") or {}).items():
        if meta.get("indexed"):
            filenames.add(filename)

    try:
        vectorstore = load_vectorstore()
        collection = vectorstore._collection
        result = collection.get(include=["metadatas"])
        for metadata in result.get("metadatas") or []:
            if not metadata:
                continue
            source = metadata.get("source")
            if source:
                filenames.add(_normalize_source_name(source))
    except Exception:
        pass

    return filenames


def get_indexed_hashes() -> dict[str, str]:
    """Map filename -> content hash for indexed documents."""
    hashes: dict[str, str] = {}
    manifest = _load_manifest()
    for filename, meta in (manifest.get("documents") or {}).items():
        if meta.get("doc_hash"):
            hashes[filename] = meta["doc_hash"]

    try:
        vectorstore = load_vectorstore()
        collection = vectorstore._collection
        result = collection.get(include=["metadatas"])
        for metadata in result.get("metadatas") or []:
            if not metadata:
                continue
            source = metadata.get("source")
            doc_hash = metadata.get("doc_hash")
            if source and doc_hash:
                hashes[_normalize_source_name(source)] = doc_hash
    except Exception:
        pass

    return hashes


def is_document_indexed(filename: str) -> bool:
    return _normalize_source_name(filename) in get_indexed_filenames()


def _normalize_page(page: Any) -> Optional[int]:
    if page is None or page == "":
        return None
    try:
        return int(page) + 1  # PyPDFLoader is 0-indexed
    except (TypeError, ValueError):
        return None


def _enrich_documents(documents: list[Document], file_path: Path, doc_hash: str) -> list[Document]:
    """Ensure every chunk carries stable, UI-friendly metadata."""
    filename = file_path.name
    file_type = file_path.suffix.lower().lstrip(".")

    enriched: list[Document] = []
    for doc in documents:
        page = doc.metadata.get("page")
        metadata = {
            "source": filename,
            "file_type": file_type,
            "doc_hash": doc_hash,
        }
        if page is not None and file_type == "pdf":
            metadata["page"] = int(page)  # keep 0-indexed in store; convert on read
        else:
            # Chroma metadata values cannot be None — omit page for TXT
            pass

        enriched.append(
            Document(page_content=doc.page_content, metadata=metadata)
        )

    return enriched


def load_single_document(file_path: Path):
    """Load a single PDF or TXT file into LangChain documents."""
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = file_path.suffix.lower()

    try:
        if suffix == ".pdf":
            loader = PyPDFLoader(str(file_path))
            documents = loader.load()
        elif suffix == ".txt":
            loader = TextLoader(str(file_path), encoding="utf-8")
            documents = loader.load()
        else:
            raise ValueError(
                "Unsupported file type. Please upload a PDF or TXT file."
            )
    except ValueError:
        raise
    except Exception as exc:
        logger.exception("Failed to load document %s", file_path.name)
        raise ValueError(
            f"Document processing failed. The file may be corrupted or unreadable ({file_path.name})."
        ) from exc

    if not documents or all(not doc.page_content.strip() for doc in documents):
        raise ValueError(f"Document appears to be empty: {file_path.name}")

    return documents


def _chunk_ids_for_hash(doc_hash: str, chunk_count: int) -> list[str]:
    """Stable IDs keyed by content hash prevent duplicate inserts."""
    short = doc_hash[:16]
    return [f"{short}::chunk::{i}" for i in range(chunk_count)]


def _delete_chunks_for_filename(filename: str) -> int:
    """Remove all vector chunks belonging to a filename. Returns deleted count."""
    filename = _normalize_source_name(filename)
    try:
        vectorstore = load_vectorstore()
        collection = vectorstore._collection
        result = collection.get(include=["metadatas"])
        ids_to_delete = []

        for doc_id, metadata in zip(
            result.get("ids") or [],
            result.get("metadatas") or [],
        ):
            if not metadata:
                continue
            source = metadata.get("source")
            if source and _normalize_source_name(source) == filename:
                ids_to_delete.append(doc_id)

        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
        return len(ids_to_delete)
    except Exception:
        logger.exception("Failed deleting chunks for %s", filename)
        return 0


def _delete_chunks_for_hash(doc_hash: str) -> int:
    try:
        vectorstore = load_vectorstore()
        collection = vectorstore._collection
        result = collection.get(include=["metadatas"])
        ids_to_delete = []

        for doc_id, metadata in zip(
            result.get("ids") or [],
            result.get("metadatas") or [],
        ):
            if metadata and metadata.get("doc_hash") == doc_hash:
                ids_to_delete.append(doc_id)

        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
        return len(ids_to_delete)
    except Exception:
        logger.exception("Failed deleting chunks for hash %s", doc_hash[:12])
        return 0


# ==========================================
# Load PDF and TXT files
# ==========================================

def load_documents():

    documents = []
    ensure_documents_dir()

    for file_path in DOCUMENTS_DIR.iterdir():

        if file_path.suffix.lower() == ".pdf":
            loader = PyPDFLoader(str(file_path))
            documents.extend(loader.load())

        elif file_path.suffix.lower() == ".txt":
            loader = TextLoader(str(file_path), encoding="utf-8")
            documents.extend(loader.load())

    return documents


# ==========================================
# Split Documents
# ==========================================

def split_documents(documents):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )

    chunks = splitter.split_documents(documents)

    return chunks


# ==========================================
# Create Vector Store
# ==========================================
def create_vectorstore():

    documents = load_documents()

    if not documents:
        raise ValueError(
            "No PDF or TXT files found in the documents folder."
        )

    chunks = split_documents(documents)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=CHROMA_DIR
    )

    print(f"Created ChromaDB with {len(chunks)} chunks.")
    return vectorstore


# ==========================================
# Load Existing Vector Store
# ==========================================

def load_vectorstore():

    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=CHROMA_DIR
    )

    return vectorstore


def chromadb_available() -> bool:
    try:
        vs = load_vectorstore()
        _ = vs._collection.count()
        return True
    except Exception:
        return False


# ==========================================
# Index a single document (content-hash safe)
# ==========================================

def index_document(file_path: Path):
    """
    Index one PDF/TXT file into ChromaDB using a content hash.

    Returns status:
      - indexed: newly added
      - skipped: identical content already present
      - reindexed: same filename but content changed
    """
    file_path = Path(file_path)
    filename = file_path.name

    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            "Unsupported file type. Please upload a PDF or TXT file."
        )

    doc_hash = file_content_hash(file_path)
    indexed_hashes = get_indexed_hashes()

    # Exact same content already indexed under this filename
    if indexed_hashes.get(filename) == doc_hash:
        return {
            "status": "skipped",
            "filename": filename,
            "chunks": 0,
            "doc_hash": doc_hash,
            "message": "Document is already in your knowledge base.",
        }

    # Same content indexed under another filename — skip embedding again
    for existing_name, existing_hash in indexed_hashes.items():
        if existing_hash == doc_hash and existing_name != filename:
            return {
                "status": "skipped",
                "filename": filename,
                "chunks": 0,
                "doc_hash": doc_hash,
                "message": f"Identical content already indexed as {existing_name}.",
            }

    documents = load_single_document(file_path)
    documents = _enrich_documents(documents, file_path, doc_hash)
    chunks = split_documents(documents)

    # Re-apply enrichment after split (splitter preserves metadata, but normalize)
    for i, chunk in enumerate(chunks):
        chunk.metadata["source"] = filename
        chunk.metadata["file_type"] = file_path.suffix.lower().lstrip(".")
        chunk.metadata["doc_hash"] = doc_hash
        chunk.metadata["chunk_index"] = i
        # Drop None-like / path leftovers
        if "page" in chunk.metadata and chunk.metadata["page"] is None:
            del chunk.metadata["page"]

    if not chunks:
        raise ValueError(f"No content chunks created for: {filename}")

    # Remove previous version for this filename (changed content or dirty dupes)
    deleted = _delete_chunks_for_filename(filename)
    status = "reindexed" if deleted > 0 or filename in indexed_hashes else "indexed"

    ids = _chunk_ids_for_hash(doc_hash, len(chunks))
    vectorstore = load_vectorstore()

    # If IDs already exist from a prior identical hash insert, skip add
    try:
        existing = vectorstore._collection.get(ids=ids)
        existing_ids = set(existing.get("ids") or [])
    except Exception:
        existing_ids = set()

    if len(existing_ids) == len(ids):
        status = "skipped"
        message = "Document is already in your knowledge base."
    else:
        # Drop colliding IDs then add
        if existing_ids:
            vectorstore._collection.delete(ids=list(existing_ids))
        vectorstore.add_documents(documents=chunks, ids=ids)
        message = (
            f"{filename} re-indexed successfully."
            if status == "reindexed"
            else f"{filename} indexed successfully."
        )
        status = "reindexed" if deleted > 0 else "indexed"

    manifest = _load_manifest()
    manifest.setdefault("documents", {})[filename] = {
        "indexed": True,
        "doc_hash": doc_hash,
        "chunks": len(chunks),
        "file_type": file_path.suffix.lower().lstrip("."),
        "size_bytes": file_path.stat().st_size,
    }
    _save_manifest(manifest)

    return {
        "status": status,
        "filename": filename,
        "chunks": len(chunks),
        "doc_hash": doc_hash,
        "message": message,
    }


def reindex_all_documents():
    """
    Clean rebuild helper: remove orphan/duplicate vectors and index each file once.
    Safe to run after upgrading ingestion logic.
    """
    ensure_documents_dir()
    results = []

    # Clear collection contents carefully by deleting known filenames first,
    # then wipe any leftover ids.
    try:
        vectorstore = load_vectorstore()
        collection = vectorstore._collection
        existing = collection.get()
        if existing.get("ids"):
            collection.delete(ids=existing["ids"])
    except Exception:
        logger.exception("Failed clearing vector store during reindex")

    _save_manifest({"documents": {}})

    for file_path in list_document_files():
        results.append(index_document(file_path))

    return results


def list_documents_info():
    """Return document metadata for the API/UI."""
    indexed_hashes = get_indexed_hashes()
    docs = []

    for file_path in list_document_files():
        filename = file_path.name
        current_hash = file_content_hash(file_path)
        stored_hash = indexed_hashes.get(filename)
        indexed = stored_hash == current_hash

        docs.append({
            "id": filename,
            "filename": filename,
            "file_type": file_path.suffix.lower().lstrip("."),
            "size_bytes": file_path.stat().st_size,
            "status": "ready" if indexed else ("stale" if stored_hash else "pending"),
            "indexed": indexed,
            "doc_hash": stored_hash,
        })

    return docs


def delete_document(document_id: str):
    """Remove a document file, its Chroma chunks, and manifest entry."""
    filename = _normalize_source_name(document_id)
    file_path = DOCUMENTS_DIR / filename

    deleted_chunks = _delete_chunks_for_filename(filename)

    # Also clear by hash if present in manifest
    manifest = _load_manifest()
    meta = (manifest.get("documents") or {}).pop(filename, None)
    if meta and meta.get("doc_hash"):
        _delete_chunks_for_hash(meta["doc_hash"])
    _save_manifest(manifest)

    if file_path.exists():
        file_path.unlink()

    return {
        "status": "deleted",
        "filename": filename,
        "chunks_removed": deleted_chunks,
        "message": f"{filename} deleted successfully.",
    }


# ==========================================
# Get Retriever
# ==========================================

def get_retriever():

    vectorstore = load_vectorstore()

    retriever = vectorstore.as_retriever(
        search_kwargs={
            "k": RETRIEVAL_K
        }
    )

    return retriever


def _source_from_document(document: Document) -> dict[str, Any]:
    source = _normalize_source_name(document.metadata.get("source", "Unknown"))
    file_type = document.metadata.get("file_type")
    if not file_type:
        file_type = Path(source).suffix.lower().lstrip(".") or "unknown"

    page = document.metadata.get("page")
    if page is not None:
        try:
            page = int(page) + 1
        except (TypeError, ValueError):
            page = None
    else:
        page = None

    # TXT should never expose a page
    if file_type == "txt":
        page = None

    return {
        "source": source,
        "page": page,
        "file_type": file_type,
        "chunk_index": document.metadata.get("chunk_index"),
        "score": document.metadata.get("_score"),
    }


# ==========================================
# MAIN RAG FUNCTION
# ==========================================
def retrieve_context(query: str):
    """
    Retrieve relevant chunks with score-based filtering.

    Returns:
      context: str
      sources: list[{source, page, file_type}]  (deduped later by caller)
      meta: {filtered_count, best_score, rejected}
    """
    vectorstore = load_vectorstore()

    try:
        paired = vectorstore.similarity_search_with_score(query, k=RETRIEVAL_K)
    except Exception:
        logger.exception("similarity_search_with_score failed; falling back")
        docs = vectorstore.similarity_search(query, k=min(4, RETRIEVAL_K))
        paired = [(d, 0.0) for d in docs]

    if not paired:
        return "", [], {"rejected": True, "reason": "no_results"}

    # Deduplicate identical page content (guards against historical duplicate indexing)
    seen_content: set[str] = set()
    unique_pairs: list[tuple[Document, float]] = []
    for doc, score in paired:
        key = doc.page_content.strip()
        if key in seen_content:
            continue
        seen_content.add(key)
        unique_pairs.append((doc, float(score)))

    best_score = unique_pairs[0][1]

    if best_score > MAX_BEST_DISTANCE:
        return "", [], {
            "rejected": True,
            "reason": "low_relevance",
            "best_score": best_score,
        }

    filtered: list[tuple[Document, float]] = []
    for doc, score in unique_pairs:
        if score <= best_score + SCORE_MARGIN:
            doc.metadata = {**doc.metadata, "_score": score}
            filtered.append((doc, score))
        if len(filtered) >= MAX_CONTEXT_CHUNKS:
            break

    if not filtered:
        return "", [], {"rejected": True, "reason": "filtered_empty", "best_score": best_score}

    context_parts = []
    sources = []

    for idx, (document, score) in enumerate(filtered, start=1):
        context_parts.append(f"Document [{idx}]:\n{document.page_content}")
        src = _source_from_document(document)
        src["id"] = idx
        sources.append(src)

    context = "\n\n".join(context_parts)

    return context, sources, {
        "rejected": False,
        "best_score": best_score,
        "kept": len(filtered),
    }


def deduplicate_sources(sources):
    """
    Deduplicate source rows for API/UI display.

    One row per unique (source, page).
    """
    seen = set()
    unique = []

    for item in sources:
        filename = item.get("source", "Unknown")
        page = item.get("page")
        key = (filename, page)

        if key in seen:
            continue

        seen.add(key)
        row = {
            "source": filename,
            "page": page,
        }
        if item.get("file_type"):
            row["file_type"] = item["file_type"]
        unique.append(row)

    return unique


# ==========================================
# Test RAG Pipeline
# ==========================================

if __name__ == "__main__":

    print("\n==============================")
    print("       RAG CHATBOT")
    print("==============================")
    print("Type 'exit' to quit.\n")

    reindex_all_documents()

    while True:

        query = input("You: ")

        if query.lower() == "exit":
            print("Goodbye!")
            break

        context, sources, meta = retrieve_context(query)

        print("\nRetrieved Context:\n")
        print(context)
        print("\nMeta:", meta)
        print("\nSources:")

        for source in deduplicate_sources(sources):
            if source["page"] is not None:
                print(f"📄 {source['source']} - Page {source['page']}")
            else:
                print(f"📄 {source['source']}")

        print("\n" + "=" * 50)
