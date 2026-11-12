export class AIStore {
    public callbacks: { [key: string]: Function } = {};
    public contextCallback: Function;
    public contextString: object = {};

    addCallback(key: string, callback: Function) {
        if (this.callbacks[key]) {
            throw new Error(
                " [ AI STORE - CALLBACKS ] " + key + " already exists"
            );
        }

        this.callbacks[key] = callback;
    }

    removeCallback(key: string) {
        if (!this.callbacks[key]) {
            throw new Error(
                " [ AI STORE - CALLBACKS ] " + key + " does not exist"
            );
        }

        delete this.callbacks[key];
    }

    addCallbacks = (callbacks: { [key: string]: Function }) => {
        Object.keys(callbacks).forEach((key) => {
            this.addCallback(key, callbacks[key]);
        });
    };

    removeCallbacks = (callbacks: { [key: string]: Function }) => {
        Object.keys(callbacks).forEach((key) => {
            this.removeCallback(key);
        });
    };

    setContext = (newContext: object) => {
        this.contextString = newContext;
        this.contextCallback(newContext);
    };

    setContextCallback = (callback: Function) => {
        this.contextCallback = callback;
    };

    clear() {
        this.callbacks = {};
    }

    print() {
        console.log(" [ AI STORE - CALLBACKS ] ", this.callbacks);
    }
}

const aiStore = new AIStore();

export default aiStore;
