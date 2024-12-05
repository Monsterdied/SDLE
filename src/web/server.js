import express from 'express';
import bodyParser from 'body-parser';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { Aworset } from './crdt/Aworset.js';
import { type } from 'os';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LISTS_FILE = path.join(__dirname, 'data', 'lists.json');


let Map_of_shopping_lists = new Map();

// Utility function to read lists
async function getallshoppingLists() {
    try {
        const data = await fs.readFile(LISTS_FILE, 'utf8');
        const lists = JSON.parse(data);

        // Create an Aworset for each list
        Map_of_shopping_lists = new Map(lists.map(list => {
            const aworset = Aworset.fromJson(JSON.stringify(list.crdt));
            return [list.name, aworset];
        }));
        for (const [name, aworset] of Map_of_shopping_lists) {
            console.log(name, aworset.getItems());
        }
        return Map_of_shopping_lists;
    } catch (error) {
        if (error.code === 'ENOENT') {
            
            console.log('File not found, creating new file');
            await fs.mkdir(path.dirname(LISTS_FILE), { recursive: true });
            await fs.writeFile(LISTS_FILE, JSON.stringify([]));
            return [];
        }
        console.error('Error reading lists:', error);
        throw error;
    }
}

// Utility function to write lists
async function writeLists(lists) {
    // save map of lists to file
    let text = JSON.stringify(Array.from(lists.entries()).map(([name, aworset]) => ({
        name: name,
        crdt: JSON.parse(aworset.toJson())
    })));
    for (const [name, aworset] of lists) {
        console.log("type",typeof(aworset),name, aworset.getItems());
        console.log("debug\n",name, aworset.toJson());
    }


    await fs.writeFile(LISTS_FILE, text);
}

// GET all lists
app.get('/api/lists', async (req, res) => {
    try {
        const map = await getallshoppingLists();
        console.log('Lists:', map);
        res.json(Array.from(map.keys()));
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve lists' });
    }
});

// GET a specific list
app.get('/api/list', async (req, res) => {
    try {
        let name = req.query.id;
        name = name.replace(/^['"]+|['"]+$/g, ''); 
        const map = await getallshoppingLists();
        const list = map.get(name);
        
        if (!list) {
            console.log('List not found');
            return res.status(404).json({ error: 'List not found' });
        }
        console.log("stringy",list.toFormattedJson());
        res.json(list.toFormattedJson());
    } catch (error) {
        console.error('Error retrieving list:', error);
        res.status(500).json({ error: 'Failed to retrieve list' });
    }
});

// POST create a new list
app.post('/api/lists', async (req, res) => {
    try {
        const  name  = req.body.name;
        const uniqueId = req.body.uniqueId;
        console.log("name",name);
        console.log("uniqueId",uniqueId);
        
        let aworset = new Aworset(uniqueId, name);
        console.log("aworset",aworset.getItems());

        let map = await getallshoppingLists();
        
        map.set(name,  aworset);
        console.log("map",map.get('Bobs List'));
        console.log("mapdeg",map.get(name));
        console.log("map",map);
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
        const { listName, items } = req.body;

        const lists = await getallshoppingLists();
        
        const listIndex = lists.findIndex(l => l.name = listName);
        
        if (listIndex === -1) {
            return res.status(404).json({ error: 'List not found' });
        }
        
        // Update list
        lists[listIndex] = {
            name: listName || lists[listIndex].name,
            items: items
        };
        
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
        console.log("lists",lists);
        lists.delete(id);
        
        await writeLists(lists);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ error: 'Failed to delete list' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    process.exit();
});