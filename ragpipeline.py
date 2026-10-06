from pathlib import Path

from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
)

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings


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


# ==========================================
# Embeddings
# ==========================================

embeddings = OllamaEmbeddings(
    model=EMBEDDING_MODEL
)


# ==========================================
# Load PDF and TXT files
# ==========================================

def load_documents():

    documents = []

    for file_path in DOCUMENTS_DIR.iterdir():

        # PDF
        if file_path.suffix.lower() == ".pdf":

            loader = PyPDFLoader(str(file_path))

            documents.extend(
                loader.load()
            )

        # TXT
        elif file_path.suffix.lower() == ".txt":

            loader = TextLoader(
                str(file_path),
                encoding="utf-8"
            )

            documents.extend(
                loader.load()
            )

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

    print(
        f"Created ChromaDB with {len(chunks)} chunks."
    )

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


# ==========================================
# Get Retriever
# ==========================================

def get_retriever():

    vectorstore = load_vectorstore()

    retriever = vectorstore.as_retriever(
        search_kwargs={
            "k": 4
        }
    )

    return retriever


# ==========================================
# MAIN RAG FUNCTION
# ==========================================
def retrieve_context(query: str):

    retriever = get_retriever()

    documents = retriever.invoke(query)

    context_parts = []
    sources = []

    for document in documents:

        context_parts.append(
            document.page_content
        )

        source = document.metadata.get(
            "source",
            "Unknown"
        )

        page = document.metadata.get(
            "page"
        )

        # Convert page number to human-readable numbering
        if page is not None:
            page = page + 1

        sources.append({
            "source": Path(source).name,
            "page": page
        })

    context = "\n\n".join(
        context_parts
    )

    return context, sources


# ==========================================
# Create Vector Store when running directly
# ==========================================



# ==========================================
# Test RAG Pipeline
# ==========================================

if __name__ == "__main__":

    print("\n==============================")
    print("       RAG CHATBOT")
    print("==============================")
    print("Type 'exit' to quit.\n")

    create_vectorstore()

    while True:

        query = input("You: ")

        if query.lower() == "exit":
            print("Goodbye!")
            break

        context, sources = retrieve_context(query)

        print("\nRetrieved Context:\n")

        print(context)

        print("\nSources:")

        for source in sources:

            if source["page"] is not None:

                print(
                    f"📄 {source['source']} "
                    f"- Page {source['page']}"
                )

            else:

                print(
                    f"📄 {source['source']}"
                )

        print("\n" + "=" * 50)