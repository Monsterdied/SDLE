# SDLE Second Assignment
# Shopping Lists on the Cloud - Internal Architecture Overview

## Core Data Structure: CRDT Implementation

The application uses two specialized CRDTs (Conflict-Free Replicated Data Types) to handle distributed data consistency:

### AWORSET (Add-Wins Observed Remove Set)
- **Purpose**: Manages the overall shopping list items (product names and quantities)
- **Why AWORSET?**: Implements OrMap-style semantics where additions win over removals during conflict resolution
- **Behavior**: When multiple clients simultaneously add and remove the same item, the add operation prevails, ensuring no items are unintentionally lost

### PNCounter (Positive-Negative Counter)
- **Purpose**: Tracks individual product quantities
- **Why PNCounter?**: Allows seamless merging of quantity changes across different clients
- **Behavior**: Separately tracks increments and decrements, enabling accurate quantity reconciliation even with concurrent updates

## System Architecture

### Component Layers

1. **Client Layer**
   - Uses ZMQ DEALER sockets to communicate with the Proxy/Coordinator
   - Each client can create and share shopping lists via unique IDs

2. **Proxy/Coordinator Layer**
   - Receives requests through ROUTER sockets
   - Calculates preference lists using consistent hashing
   - Forwards requests to the first available node in the preference list

3. **Storage Node Layer**
   - **Socket Types**:
     - SUBSCRIBER: Receives ring updates
     - DEALER: Registers the node and handles incoming requests
     - ROUTER: Communicates with other storage nodes
     - REQUEST: Propagates PUT commands to subsequent nodes

### Data Distribution: Consistent Hashing

- **Hash Ring**: Circular structure mapping both nodes and data to positions
- **Virtual Nodes**: Each physical node occupies multiple ring positions for better distribution
- **Replication Factor (N)**: Each list is replicated to the top K nodes in the preference list
- **Node Assignment**: Data is stored on the first healthy node encountered after its hash position

### Replica Propagation Strategy

When a write request arrives:
1. Coordinator forwards to first node in preference list
2. Node propagates to next node in preference list via REQUEST socket
3. Propagation continues until required replica count is achieved
4. Each node sends acknowledgment back through the chain
5. Client receives confirmation only after quorum requirements are met

### Failure Handling: Hinted Handoffs & Sloppy Quorum

- **Sloppy Quorum**: Writes are approved using the top K *healthy* nodes, not necessarily the first K nodes
- **Quorum Condition**: R + W > N ensures consistency (Read + Write replicas > Total replicas)
- **Hinted Handoffs**: When failed nodes recover, temporarily stored replicas are forwarded to them

## Technical Challenges & Solutions

### ZMQ Socket Management
- **Challenge**: REQ sockets block if no response received; multiple connection attempts fail
- **Solution**: Implemented proper socket lifecycle management and timeout handling

### Concurrency Control
- **Challenge**: Parallel operations on shared resources (storage, router.send)
- **Solution**: Extensive use of mutexes for all non-parallelizable operations

### Virtual Node Complexity
- **Challenge**: Dynamic addition of nodes complicates rebalancing
- **Solution**: Careful management of virtual node assignments during cluster changes

## Validation & Testing
- Comprehensive test suite validating CRDT convergence
- Network partition simulation
- Concurrent update resolution testing
- Node failure and recovery scenarios
SDLE Second Assignment of group T02G13.
## Quick Start
## run the client ui
- go to ./src/test/web
- run the storage nodes by running ```node test_web.json```
- in a different terminal go to ./src/test/web
- run ```npx http-server``` to run the host for the cliente ui we will need that port to run the client
- in a different terminal go to ./src/test/web
- to run the client the PLACEHOLDER is the port of the previous command the 3000 is the port is used for the client port, if u want to run more that one it will need to be changed```node server.js localhost 5555 3000 PLACEHOLDER```

## running tests
- Warning after each test delete the contents of the storage folder
- the main battery of tests is in the test folder
- cd src/test
- this test runs storage nodes, cordinator and clients
- run ```node test.js```

## there are different files that ran different things to be ran 
- test_storage.js runs one storage node
- test_storage1.js runs one different storage node
- testStorage.js runs 5 storage nodes
- test_cordinator.js runs the cordinator
- test_client.js runs various clients that set and get values
- test_client_get.js only makes get requests, this only works after the lists were set

Using a combination of the above files we can test the system in different ways
Failure of the cordinator node.
Failure of a storage node.
Failure of multiple storage nodes.

1. Diogo Sarmento(up202109663)
2. Rodrigo Póvoa (up202108890)
3. Tomás Câmara (up202108665)
4. Tomás Sarmento (up202108890)
