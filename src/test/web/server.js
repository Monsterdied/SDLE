const express = require( 'express');
const bodyParser = require( 'body-parser');
const { promises } = require('fs');
const { fileURLToPath } = require( 'url');
const path = require( 'path');
const  cors = require( 'cors');
const { Aworset } = require('../crdt/Aworset.js');
const {Client} = require( '../client.js')

const app = express();
const coordinatorAddress= process.argv[2];
const coordinatorPort = process.argv[3];
const PORT = process.argv[4] || 3000;
if (!coordinatorAddress || !coordinatorPort || PORT ===3000) {
    console.error('Usage: node server.js <coordinatorAddress> <coordinatorPort> [<port>]');
    process.exit(1);
}
console.log("coordinatorAddress", coordinatorAddress);
console.log("coordinatorPort", coordinatorPort);
console.log("PORT", PORT);
let client = new Client(coordinatorAddress, coordinatorPort, PORT);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// File paths
//const __filename = fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);
const LISTS_FILE = path.join(__dirname, 'data', 'lists.json');


let Map_of_shopping_lists = new Map();

// Utility function to read lists
async function getallshoppingLists() {
    try {
        const data = await promises.readFile(LISTS_FILE, 'utf8');
        const lists = JSON.parse(data);

        // Create an Aworset for each list
        Map_of_shopping_lists = new Map(lists.map(list => {
            const aworset = Aworset.fromJson(JSON.stringify(list.crdt));
            return [list.name, aworset];
        }));
        
        console.log('Lists loaded:', Map_of_shopping_lists);
        return Map_of_shopping_lists;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('File not found, creating new file');
            await promises.mkdir(path.dirname(LISTS_FILE), { recursive: true });
            await promises.writeFile(LISTS_FILE, JSON.stringify([]));
            return new Map();
        }
        throw error;
    }
}

// Utility function to write lists
async function writeLists(lists) {
    const serializableLists = Array.from(lists.entries()).map(([name, aworset]) => ({
        name: name,
        crdt: JSON.parse(aworset.toJson())
    }));
    await promises.writeFile(LISTS_FILE, JSON.stringify(serializableLists, null, 2));
}

// GET all lists
app.get('/api/lists', async (req, res) => {
    try {
        const lists = await getallshoppingLists();
        res.json(Array.from(lists.keys()));
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve lists' });
    }
});

// GET a specific list
app.get('/api/list', async (req, res) => {
    try {
        let name = req.query.id;
        name = name.replace(/^['"]+|['"]+$/g, ''); // Remove leading and trailing quotes
        const lists = await getallshoppingLists();
        const list = lists.get(name);
        console.log("name", name);
        console.log("ll", list);
        
        if (!list) {
            console.log('List not found');
            return res.status(404).json({ error: 'List not found' });
        }
        
        console.log("stringy", list.toFormattedJson());
        res.json(list.toFormattedJson());
    } catch (error) {
        console.error('Error retrieving list:', error);
        res.status(500).json({ error: 'Failed to retrieve list' });
    }
});

// POST create a new list
app.post('/api/lists', async (req, res) => {
    try {
        const { name, uniqueId } = req.body;
        console.log("name", name);
        console.log("uniqueId", uniqueId);
        
        let aworset = new Aworset(uniqueId, name);
        console.log("aworset", aworset.getItems());

        let map = await getallshoppingLists();
        
        map.set(name, aworset);
        console.log("map", map.get('Bobs List'));
        console.log("mapdeg", map.get(name));
        console.log("map", map);
        await writeLists(map);
        res.status(201).json(Array.from(map.keys()));
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ error: 'Failed to create list' });
    }
});

// POST update a list (add/update items)
app.post('/api/list', async (req, res) => {
    try {
        const { listId, items } = req.body;

        const lists = await getallshoppingLists();
        console.log("listsdeg", lists);
        const listIndex = lists.get(listId);
        console.log("listIndex", listId);
        console.log("listIndex", listIndex);
        console.log("body", req.body);
        
        if (!listIndex) {
            return res.status(404).json({ error: 'List not found' });
        }
        
        // Update list
        items.forEach(item => {
            listIndex.addItem(item.name, item.quantity);
        });
        
        await writeLists(lists);
        
        res.json({ message: 'List updated successfully' });
    } catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ error: 'Failed to update list' });
    }
});

// DELETE a list
app.delete('/api/lists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let lists = await getallshoppingLists();
        
        lists.delete(id);
        
        await writeLists(lists);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const open = (await import('open')).default;
    open(`http://localhost:8080/multiple_lists.html?port=${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    process.exit();
});