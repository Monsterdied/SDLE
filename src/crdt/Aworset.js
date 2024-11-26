import {PNCounter} from "./PNCounter.js";
class Aworset{
    constructor(id, listname){
        this.id = id;
        this.counter=0;
        this.listname = listname;
        this.items= new Map();
        this.removed_items = new Set();

    }
    generate_id(){
        this.counter++;
        return this.counter;
    }
    addItem(item_name,quantity=1){
        if(!this.items.has(item_name)){
            this.items.set(item_name,{
                id:this.generate_id(),
                counter: new PNCounter(this.id),
                addedby: this.id

            });
        }
        const item = this.items.get(item_name);
        item.counter.increment(quantity);
        this.removed_items.delete(item_name);
    }
    removeQuantity(item_name,quantity=1){
        if(this.items.has(item_name)){
            const item = this.items.get(item_name);
            item.counter.decrement(quantity)
        }
    }
    removeItem(item_name){
        if(this.items.has(item_name)){
            this.removed_items.add(item_name)
        }
    }
    getQuantity(item_name){
        if(!this.items.has(item_name) || this.removed_items.has(item_name)){
            return 0;
        }
        return this.items.get(item_name).counter.getValue();
    }

    getItems(){
        const active_items = new Map();
        for (let [item_name, item] of this.items){
            if(!this.removed_items.has(item_name)){
                const quantity= item.counter.getValue();
                if(quantity>0){
                    active_items[item_name] = {
                        quantity:quantity,
                        addedby: item.addedby
                    };
                }
            }
        }
        return active_items;
    }
    merge(other) {

        // Merge items
        for (const [itemName, otherItem] of other.items) {
            if (!this.items.has(itemName)) {
                // New item, copy it
                this.items.set(itemName, {
                    id: otherItem.id,
                    counter: new PNCounter(this.id),
                    addedby: otherItem.addedby
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

    toString() {
        // Prepare serializable object
        const serializable = {
            id: this.id,
            counter: this.counter,
            listname: this.listname,
            items: Array.from(this.items.entries()).map(([name, item]) => ({
                name: name,
                id: item.id,
                addedby: item.addedby,
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

    // New static fromString method to deserialize the Aworset
    static fromString(jsonString) {
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
                id: itemData.id,
                counter: pnCounter,
                addedby: itemData.addedby
            });
        });
        
        // Restore removed items
        aworset.removed_items = new Set(parsed.removed_items);
        
        return aworset;
    }
}
export {Aworset};