import {PNCounter} from "./PNCounter.js";
class Aworset{
    constructor(id, loaded, listname){
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
                        addedBy: item.addedby
                    };
                }
            }
        }
        return active_items;
    }
    merge(other) {
        // Update counter
        this.counter = Math.max(this.counter, other.counter) + 1;

        // Merge items
        for (const [itemName, otherItem] of other.items) {
            if (!this.items.has(itemName)) {
                // New item, copy it
                this.items.set(itemName, {
                    id: otherItem.id,
                    counter: new PNCounter(this.replicaId),
                    addedby: otherItem.addedby
                });
            }
            // Merge counters
            this.items.get(itemName).counter.merge(otherItem.counter);
        }

        // Merge removals
        console.log(other.removedItems);
        for (const removedItem of other.removed_items) {
            this.removed_items.add(removedItem);
        }
    }




}
export {Aworset};