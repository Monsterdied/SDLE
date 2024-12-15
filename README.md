# SDLE Second Assignment

SDLE Second Assignment of group T02G13.
## After running 
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
