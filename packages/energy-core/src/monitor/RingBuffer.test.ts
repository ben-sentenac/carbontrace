export class RingBuffer<T> {
    readonly capacity:number;
    #buffer: Array<T | undefined>;
    #head = 0;
    #size = 0;

    constructor(capacity:number) {
        if(!Number.isInteger(capacity) || capacity <= 0) {
            throw new Error("capacity must be a positive integer");
        }

        this.capacity = capacity;
        this.#buffer = new Array(capacity);
    }

    push(value: T):void {
        this.#buffer[this.#head] = value;

        this.#head = (this.#head + 1) % this.capacity;

        if(this.#size < this.capacity) {
            this.#size++;
        }
    }

    values():T[] {
        const results:T[] = [];

        const start = this.#size === this.capacity ? this.#head : 0;

        for(let i = 0; i < this.#size; i++) {
            const index = (start + i) % this.capacity;
            const value = this.#buffer[index];

            if(value !== undefined) {
                results.push(value);
            }
        }
        return results;
    }

    clear():void {
        this.#buffer.fill(undefined);
        this.#head = 0;
        this.#size = 0;
    }

    get size():number {
        return this.#size;
    }

    get isFull(): boolean {
        return this.#size === this.capacity;
    }

}