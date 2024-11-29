const crypto = require('crypto');
class ConsistentHash {
    constructor(replicas = 100) {
        this.replicas = replicas;
        this.ring = new Map();
        this.nodes = new Set();
    }

    addNode(node) {
        this.nodes.add(node);
        // Add virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.set(hash, node);
        }
    }

    removeNode(node) {
        this.nodes.delete(node);
        // Remove virtual nodes
        for (let i = 0; i < this.replicas; i++) {
            const hash = this.getHash(`${node}:${i}`);
            this.ring.delete(hash);
        }
    }

    getNode(key) {
        if (this.ring.size === 0) return null;

        const hash = this.getHash(key);
        const sortedHashes = Array.from(this.ring.keys()).sort();
        //sortedHashes.forEach((h) => console.log(h));
        // Find the first hash >= our key's hash
        for (const h of sortedHashes) {
            if (h >= hash) return this.ring.get(h);
        }
        
        // Wrap around to first node if we're past the end
        return this.ring.get(sortedHashes[0]);
    }

    getHash(key) {
        return crypto.createHash('sha1').update(key).digest('hex');
    }
}
module.exports = ConsistentHash;