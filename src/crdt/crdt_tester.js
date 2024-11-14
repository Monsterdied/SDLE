import { PNCounter } from "./PNCounter.js";
import {Aworset} from "./Aworset.js";


let counter1 = new PNCounter(1);
let counter2 = new PNCounter(2);

counter1.increment(1);
counter2.increment(1);
console.log(counter1.getValue()==1);
console.log(counter2.getValue()==1);
counter1.merge(counter2);
counter2.merge(counter1);
counter1.decrement(1);
//print in terminal
console.log(counter1.getValue()==1);
console.log(counter2.getValue()==2);

console.log("AWORSET TESTS");
const aliceList = new Aworset('replica1');
const bobList = new Aworset('replica2');


// Alice adds items
aliceList.addItem('milk', 2);
aliceList.addItem('bread', 1);

// Bob adds items
bobList.addItem('milk', 1);
bobList.addItem('eggs', 6);

// Merge the lists
aliceList.merge(bobList);

// Check the combined list
console.log(aliceList.getItems());
// Output will be something like:
// {
//   milk: { quantity: 3, addedBy: 'alice' },
//   bread: { quantity: 1, addedBy: 'alice' },
//   eggs: { quantity: 6, addedBy: 'bob' }
// }

// Remove some quantity
aliceList.removeQuantity('milk', 1);
console.log(aliceList.getQuantity('milk')); // 2

// Remove an item completely
aliceList.removeItem('bread');
console.log(aliceList.getItems()); // bread won't appear in the list

//add bread
aliceList.addItem('bread', 1);
console.log(aliceList.getItems());
