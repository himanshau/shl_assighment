from app.rag.catalog_loader import load_catalog_items


def load_catalog() -> list[dict]:
    return load_catalog_items()


if __name__ == "__main__":
    catalog = load_catalog()
    print(catalog[0])
