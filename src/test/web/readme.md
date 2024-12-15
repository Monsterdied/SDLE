npm install

Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

npx http-server

then for example to now run the client backend:
.\server localhost 5555 3333 {the port number ex: 8081}