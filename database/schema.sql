
CREATE TABLE shoppingList (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator INTEGER NOT NULL
);

CREATE TABLE item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    list_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (list_id) REFERENCES shoppingList(id),
    quantity INTEGER DEFAULT 1
);