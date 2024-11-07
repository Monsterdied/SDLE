CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE shoppingList (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator INTEGER NOT NULL,
    FOREIGN KEY (creator) REFERENCES users(id)
);

CREATE TABLE item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    list_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (list_id) REFERENCES shoppingList(id),
    quantity INTEGER DEFAULT 1
);