const zmq = require('zeromq');
const mutex = require('async-mutex');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // Import path module
const fs = require('fs').promises;
let { Aworset } = import('./crdt/Aworset.js');

class ClientWeb {
    constructor(coordinatorAddress, coordinatorPort, client_id) {
        this.dealer = new zmq.Dealer();
        this.coordinatorAddress = coordinatorAddress;
        this.coordinatorPort = coordinatorPort;
        this.nodeConnections = new Map();
        this.localStore = new Map();
        this.client_id = client_id;
        this.client_request_id = 0;
        this.mutex = new mutex.Mutex();
        
        // Express app setup
        this.app = express();
        this.PORT = parseInt(client_id);

        // Middleware
        this.app.use(cors());
        this.app.use(bodyParser.json());
    }

    async initialize() {
        await this.dealer.connect(`tcp://${this.coordinatorAddress}:${this.coordinatorPort}`);

        // Setup API routes
        this.setupRoutes();

        // Start Express server
        this.app.listen(this.PORT, async () => {
            console.log(`Client server running on http://localhost:${this.PORT}`);
            const open = await import('open'); // Dynamic import
            open.default(`http://localhost:8081/multiple_lists.html?port=${this.client_id}`);
        });
    }

    get_token() {
        this.mutex.acquire();
        this.client_request_id++;
        this.mutex.release();
        return `${this.client_id},${this.client_request_id}`;
    }

    async set(key, value) {
        const token = this.get_token();
        await this.dealer.send(['SET_CLIENT', token, key, value]);
        const [status] = await this.dealer.receive();
        return status.toString();
    }

    async get(key) {
        const token = this.get_token();
        await this.dealer.send(['GET_CLIENT', token, key]);
        const [type, result] = await this.dealer.receive();
        return result.toString();
    }

    async getallshoppingLists() {
        try {
            console.log("getallshoppingLists");
            const LISTS_FILE = path.resolve(__dirname, 'data', 'lists.json');
            console.log("LISTS_FILE", LISTS_FILE);
            const data = await fs.readFile(LISTS_FILE, 'utf8');
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
                await fs.mkdir(path.dirname(LISTS_FILE), { recursive: true });
                await fs.writeFile(LISTS_FILE, JSON.stringify([]));
                return new Map();
            }
            console.log("error", error);
            throw error;
        }
    }
    
    // Utility function to write lists
    async writeLists(lists) {
        const serializableLists = Array.from(lists.entries()).map(([name, aworset]) => ({
            name: name,
            crdt: JSON.parse(aworset.toJson())
        }));
        await fs.writeFile(LISTS_FILE, JSON.stringify(serializableLists, null, 2));
    }

    setupRoutes() {
        // GET all lists
        this.app.get('/api/lists', async (req, res) => {
            try {
                console.log("getallshoppingLists");
                const lists = await this.getallshoppingLists();
                console.log("lists", lists);
                res.json(Array.from(lists.keys()));
            } catch (error) {
                res.status(500).json({ error: 'Failed to retrieve lists' });
            }
        });

        // GET a specific list
        this.app.get('/api/list', async (req, res) => {
            try {
                const listId = req.query.id.replace(/^['"]+|['"]+$/g, '');
                const listKey = `${this.client_id}_list_${listId}`;
                const listData = await this.get(listKey);
                
                if (!listData) {
                    return res.status(404).json({ error: 'List not found' });
                }
                
                res.json(JSON.parse(listData));
            } catch (error) {
                res.status(500).json({ error: 'Failed to retrieve list' });
            }
        });

        // POST create a new list
        this.app.post('/api/lists', async (req, res) => {
            try {
                const { name, uniqueId } = req.body;
                const listsKey = `${this.client_id}_lists`;
                
                // Get existing lists
                let lists = [];
                try {
                    const existingListsData = await this.get(listsKey);
                    lists = existingListsData ? JSON.parse(existingListsData) : [];
                } catch {}

                // Check if list already exists
                if (lists.includes(name)) {
                    return res.status(400).json({ error: 'List already exists' });
                }

                // Add new list name
                lists.push(name);
                await this.set(listsKey, JSON.stringify(lists));

                // Create initial list data
                const listKey = `${this.client_id}_list_${name}`;
                await this.set(listKey, JSON.stringify({
                    name: name,
                    uniqueId: uniqueId,
                    items: []
                }));

                res.status(201).json(lists);
            } catch (error) {
                res.status(500).json({ error: 'Failed to create list' });
            }
        });

        // POST update a list (add/update items)
        this.app.post('/api/list', async (req, res) => {
            try {
                const { listId, items } = req.body;
                const listKey = `${this.client_id}_list_${listId}`;

                // Get existing list
                const existingListData = await this.get(listKey);
                if (!existingListData) {
                    return res.status(404).json({ error: 'List not found' });
                }

                const listData = JSON.parse(existingListData);
                
                // Update items
                items.forEach(item => {
                    const existingItemIndex = listData.items.findIndex(
                        existing => existing.name === item.name
                    );

                    if (existingItemIndex !== -1) {
                        // Update existing item
                        listData.items[existingItemIndex] = item;
                    } else {
                        // Add new item
                        listData.items.push(item);
                    }
                });

                // Save updated list
                await this.set(listKey, JSON.stringify(listData));
                
                res.json({ message: 'List updated successfully' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to update list' });
            }
        });

        // DELETE a list
        this.app.delete('/api/lists/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const listsKey = `${this.client_id}_lists`;
                const listKey = `${this.client_id}_list_${id}`;

                // Get existing lists
                let lists = [];
                try {
                    const existingListsData = await this.get(listsKey);
                    lists = existingListsData ? JSON.parse(existingListsData) : [];
                } catch {}

                // Remove list from lists
                const updatedLists = lists.filter(listName => listName !== id);
                await this.set(listsKey, JSON.stringify(updatedLists));

                // Delete list data
                await this.set(listKey, '');

                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: 'Failed to delete list' });
            }
        });
    }
}

module.exports = { ClientWeb };