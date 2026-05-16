from retriever import retrieve


query = "Java developer with leadership skills"

results = retrieve(query)

print("\n")
print(f"QUERY: {query}")
print("\n")


for idx, doc in enumerate(results):

    print("=" * 80)

    print(f"RESULT {idx + 1}")

    print("=" * 80)

    print("\nMETADATA:\n")

    print(doc.metadata)

    print("\nCONTENT:\n")

    print(doc.page_content)

    print("\n")