const {PNCounter} = require( "./PNCounter.js");
const {Aworset} =  require("./Aworset.js");

// PNCounter Tests
function runPNCounterTests() {
    console.log("PNCounter Tests:");
    let counter1 = new PNCounter(1);
    let counter2 = new PNCounter(2);

    counter1.increment(1);
    counter2.increment(1);
    console.log("Initial increment test:");
    console.log("Counter1 value:", counter1.getValue(), "Expected: 1");
    console.log("Counter2 value:", counter2.getValue(), "Expected: 1");

    counter1.merge(counter2);
    counter2.merge(counter1);
    counter1.decrement(1);
    
    console.log("After merge and decrement:");
    console.log("Counter1 value:", counter1.getValue(), "Expected: 1");
    console.log("Counter2 value:", counter2.getValue(), "Expected: 2");
}

// Aworset Tests
function runAworsetTests() {
    console.log("\nAworset Tests:");
    
    // Test 1: Basic Item Addition
    const aliceList = new Aworset('replica1', 'Alices List');
    const bobList = new Aworset('replica2', 'Bobs List');

    console.log("\nTest 1: Basic Item Addition");
    aliceList.addItem('milk', 2);
    aliceList.addItem('bread', 1);

    console.log("Alice's list items:", aliceList.getItems());

    bobList.addItem('milk', 1);
    bobList.addItem('eggs', 6);
    console.log("Bob's list items:", bobList.getItems());

    // Test 2: Merging Lists
    console.log("\nTest 2: Merging Lists");
    console.log("debug", aliceList.toJson());
    aliceList.merge(bobList);
    console.log("debug", aliceList.toJson());
    bobList.merge(aliceList);
    console.log("Merged Alice's list:", aliceList.getItems());
    console.log("Merged Bob's list:", bobList.getItems());

    // Test 3: Removing Quantities
    console.log("\nTest 3: Removing Quantities");
    aliceList.removeQuantity('milk', 1);
    console.log("Milk quantity after removal:", aliceList.getQuantity('milk'));

    // Test 4: Removing Items
    console.log("\nTest 4: Removing Items");
    aliceList.removeItem('bread');
    console.log("List after removing bread:", aliceList.getItems());

    // Test 5: Re-adding Removed Items
    console.log("\nTest 5: Re-adding Removed Items");
    aliceList.addItem('bread', 1);
    console.log("List after re-adding bread:", aliceList.getItems());

    // Test 6: Multiple Additions and Merging
    console.log("\nTest 6: Multiple Additions and Merging");
    aliceList.addItem('milk', 1);
    console.log("Alice's list after adding milk:", aliceList.getItems());

    aliceList.merge(bobList);
    console.log("Alice's list after merging with Bob's:", aliceList.getItems());

    // Test 7: Removing and Merging
    console.log("\nTest 7: Removing and Merging");
    aliceList.removeItem('milk');
    bobList.merge(aliceList);
    aliceList.merge(bobList);
    console.log("Bob's list after removing milk and merging:", bobList.getItems());

    // Test 8: Serialization and Deserialization
    console.log("\nTest 8: Serialization and Deserialization");
    const serializedList = aliceList.toJson();
    const deserializedList = Aworset.fromJson(serializedList);
    console.log("Original list items:", aliceList.getItems());
    console.log("Deserialized list items:", deserializedList.getItems());

    // Test 9: Concurrent Modifications
    console.log("\nTest 9: Concurrent Modifications");
    const list1 = new Aworset('replica1', 'Concurrent Test');
    const list2 = new Aworset('replica2', 'Concurrent Test');

    list1.addItem('apple', 3);
    list2.addItem('apple', 2);
    list1.merge(list2);
    list2.merge(list1);
    console.log("Concurrent apple quantity:", list1.getQuantity('apple'));

    // Test 10: toString and fromString
    console.log("\nTest 10: toJson and fromJson");

    aliceList.addItem('milk', 1);
    aliceList.addItem('potatoes', 30);
    aliceList.addItem('bread', 2);
    aliceList.addItem('eggs', 6);
    aliceList.addItem('cheese', 1);
    aliceList.addItem('apples', 3);
    aliceList.addItem('oranges', 5);
    aliceList.removeQuantity('oranges', 2);
    aliceList.removeItem('cheese');

    bobList.addItem('milk', 1);
    bobList.removeItem('milk');
    bobList.addItem('bread', 2);
    bobList.addItem('eggs', 6);
    bobList.addItem('cheese', 1);
    bobList.addItem('apples', 3);
    bobList.addItem('oranges', 5);
    bobList.removeQuantity('oranges', 2);

    aliceList.merge(bobList);

    
    const serialstring = aliceList.toJson();
    const deserialized = Aworset.fromJson(serialstring);
    //console.log("Original list items:", serializedList,"\n");
    console.log("Original list items:", aliceList.getItems(),"\n\n");
    console.log("Original to string:", aliceList.toJson(),"\n\n");
    console.log("Deserialized list items:", Aworset.fromJson(aliceList.toJson()).toJson(),"\n\n");
    console.log("Deserialized to string:", deserialized.toJson(),"\n\n");

    console.log("This must be equal:", deserialized.getItems(),"\n");
    console.log("This must be equal:", aliceList.getItems(),"\n");

    // test 11: remove in one replica and add in another then merge
    console.log("\nTest 11: remove in one replica and add in another then merge");
    const list3 = new Aworset('replica1', 'Concurrent Test');
    const list4 = new Aworset('replica2', 'Concurrent Test');

    list3.addItem('apple', 3);
    list4.merge(list3);
    list3.removeItem('apple');
    list4.addItem('apple', 2);
    list4.merge(list3);
    console.log("Concurrent apple quantity:", list4.getQuantity('apple'));
    console.log("Concurrent apple quantity:", list4.toJson());
    list3.merge(list4);
    list4.removeItem('apple');
    list3.merge(list4);
    console.log("Concurrent apple quantity:", list3.getQuantity('apple'));



}

// Run all tests
function runAllTests() {
    runPNCounterTests();
    runAworsetTests();
}

// Execute the tests
runAllTests();