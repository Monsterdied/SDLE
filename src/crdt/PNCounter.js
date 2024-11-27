
class PNCounter{
    constructor(id){
        this.id = id;
        this.pCounters = {};
        this.nCounters = {};
        this.pCounters[id] = 0;
        this.nCounters[id] = 0;
    }
    increment(val) {
        this.pCounters[this.id]+= val;
    }

    decrement(val) {
        this.nCounters[this.id]+= val;
    }
    getValue(){
        const pSum = Object.values(this.pCounters).reduce((a, b) => a + b, 0);
        const nSum = Object.values(this.nCounters).reduce((a, b) => a + b, 0);
        return pSum - nSum;
    }

    merge(other){
        for (let key in other.pCounters){
            if (this.pCounters[key] === undefined){
                this.pCounters[key] = 0;
            }
            this.pCounters[key] = Math.max(this.pCounters[key], other.pCounters[key]);
        }
        for (let key in other.nCounters){
            if (this.nCounters[key] === undefined){
                this.nCounters[key] = 0;
            }
            this.nCounters[key] = Math.max(this.nCounters[key], other.nCounters[key]);
        }
    }

    

}
export {PNCounter};