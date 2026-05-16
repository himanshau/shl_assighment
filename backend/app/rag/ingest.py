"""Build ChromaDB from SHL catalog (local file or public URL)."""

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

from app.rag.catalog_loader import catalog_items_to_documents, load_catalog_items

CHROMA_DIR = "./chroma_db"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def run_ingest() -> None:
    data = load_catalog_items()
    documents = catalog_items_to_documents(data)
    print(f"Created {len(documents)} documents")

    embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    Chroma.from_documents(
        documents=documents,
        embedding=embedding_model,
        persist_directory=CHROMA_DIR,
    )
    print(f"ChromaDB created successfully at {CHROMA_DIR}")


if __name__ == "__main__":
    run_ingest()
