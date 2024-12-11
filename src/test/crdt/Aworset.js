const {PNCounter} = require( "./PNCounter.js");
class Aworset{
    constructor(id=0, listname="none"){
        this.id = id;
        this.counter=0;
        this.listname = listname;
        this.items= new Map();
        this.removed_items = new Set();

    }
    // Generate a unique ID for this machine
    generate_id(){
        this.counter++;
        return this.counter;
    }

    // Add an item to the list you especify the quantity
    addItem(item_name,quantity=1){
        if(!this.items.has(item_name)){
            this.items.set(item_name,{
                counter: new PNCounter(this.id),

            });
        }
        const item = this.items.get(item_name);
        item.counter.increment(quantity);
        this.removed_items.delete(item_name);
    }
    // Remove a quantity of an item
    removeQuantity(item_name,quantity=1){
        if(this.items.has(item_name)){
            const item = this.items.get(item_name);
            item.counter.decrement(quantity)
        }
    }
    // Remove all items from the list
    removeItem(item_name){
        if(this.items.has(item_name)){
            this.removed_items.add(item_name)
        }
    }
    // Get the quantity of an item
    getQuantity(item_name){
        if(!this.items.has(item_name) || this.removed_items.has(item_name)){
            return 0;
        }
        return this.items.get(item_name).counter.getValue();
    }

    // Get all the items in the list
    getItems(){
        const active_items = new Map();
        for (let [item_name, item] of this.items){
            if(!this.removed_items.has(item_name)){
                const quantity= item.counter.getValue();
                if(quantity>0){
                    active_items[item_name] = {
                        quantity:quantity
                    };
                }
            }
        }
        return active_items;
    }

    toFormattedJson() {
        const items = Array.from(this.items.entries()).map(([name, item]) => ({
            name: name,
            quantity: item.counter.getValue()
        }));

        const formatted = {
            listname: this.listname,
            items: items
        };

        return formatted;
    }

    static FromFormattedJson(id,formatted) {
        this.id = id;
        this.listname = formatted.listname;
        this.items = new Map(formatted.items.map(item => [
            item.name,
            {
                counter: new PNCounter(this.id, item.quantity)
            }
        ]));
    }

    // Merge two Aworsets
    merge(other) {

        // Merge items
        for (const [itemName, otherItem] of other.items) {
            if (!this.items.has(itemName)) {
                // New item, copy it
                this.items.set(itemName, {
                    counter: new PNCounter(this.id),
                });
            }
            // Merge counters
            this.items.get(itemName).counter.merge(otherItem.counter);
        }

        // Merge removals
        //console.log(other.removedItems);
        for (const removedItem of other.removed_items) {
            this.removed_items.add(removedItem);
        }
    }

    // Serialize the Aworset to a JSON string
    toJson() {
        // Prepare serializable object
        const serializable = {
            id: this.id,
            counter: this.counter,
            listname: this.listname,
            items: Array.from(this.items.entries()).map(([name, item]) => ({
                name: name,
                counter: {
                    pCounters: item.counter.pCounters,
                    nCounters: item.counter.nCounters
                }
            })),
            removed_items: Array.from(this.removed_items)
        };

        // Convert to JSON string
        return JSON.stringify(serializable);
    }

    //  Deserialize an Aworset from a JSON string
    static fromJson(jsonString) {
        // Parse the JSON string
        const parsed = JSON.parse(jsonString);
        
        // Create a new Aworset instance
        const aworset = new Aworset(parsed.id, parsed.listname);
        
        // Restore counter
        aworset.counter = parsed.counter;
        
        // Restore items
        parsed.items.forEach(itemData => {
            // Recreate the item with its counter
            const pnCounter = new PNCounter(aworset.id);
            pnCounter.pCounters = itemData.counter.pCounters;
            pnCounter.nCounters = itemData.counter.nCounters;
            
            aworset.items.set(itemData.name, {
                counter: pnCounter
            });
        });
        
        // Restore removed items
        aworset.removed_items = new Set(parsed.removed_items);
        
        return aworset;
    }
}
module.exports = {Aworset};