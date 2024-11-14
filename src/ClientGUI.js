const readline = require('node:readline');
//const sqlite = require('node:sqlite');

class ClientGUI {
  constructor() {
    this.ID = -1;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  start() {
    this.rl.question(`What's your Id?`, ID => {
      console.log(`Hi ${ID}!`);
      this.ID = ID;
      //this.rl.close();
    });
  }
  getList() {
    console.log('List');
  }
}



const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const args = process.argv.slice(2);
console.log(args);
rl.question(`What's your Id?`, name => {
  console.log(`Hi ${name}!`);
  rl.close();
});
console.log('finished');