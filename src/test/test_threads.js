const { Mutex } = require('async-mutex');

class runWithMutex{
    // Create a shared resource
    constructor() {
    this.token_counter = 0;
    this.mutex = new Mutex();
    }
    // Create a mutex


    // Function to simulate work and update shared resource
    async updateResource(id) {
        // Use runExclusive to ensure thread-safe access
        await this.mutex.acquire();
        console.log(`Task ${id} acquiring lock`);        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        // Update shared resource
        this.token_counter++;
        console.log(`Task ${id} updated value to ${this.token_counter}`);
        await this.mutex.release();
        return this.token_counter;
    }
}

const classe = new runWithMutex();
classe.updateResource(1);
classe.updateResource(2);
classe.updateResource(3);
classe.updateResource(4);
classe.updateResource(5);