from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vectordb = Chroma(
    persist_directory="./chroma_db",
    embedding_function=embedding_model,
)

retriever = vectordb.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 12,
        "fetch_k": 40,
        "lambda_mult": 0.6,
    },
)


def retrieve(query: str):
    return retriever.invoke(query)
