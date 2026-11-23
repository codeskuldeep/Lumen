from app.services.parser import Brand, find_mentions


def test_order_and_sentiment():
    text = "1. **Rival Co** is a strong choice.\n2. Acme Inc is pricey and slow."
    m = find_mentions(text, [Brand("Acme", ["Acme Inc"], True), Brand("Rival Co", [])])
    assert [x.name for x in m] == ["Rival Co", "Acme"]
    assert m[0].sentiment > 0 > m[1].sentiment
    assert m[1].is_client and m[1].position == 2


def test_word_boundary():
    assert find_mentions("Acmeology is a thing", [Brand("Acme", [], True)]) == []
