export class History {
    public history: string[] = [];

    public currentIndex: number = -1;

    constructor() {
        // if (process.env.NODE_ENV === "development") {
        //     // @ts-ignore
        //     if (typeof window !== "undefined") {
        //         window.printHistory = this.printHistory.bind(this);
        //     }
        // }
    }

    reset(): void {
        this.currentIndex = this.history.length - 1;
    }

    push(command: string): void {
        if (command.trim() !== "") {
            this.history.push(command);
            this.currentIndex = this.history.length;
        }
    }

    up(): string {
        if (this.history.length === 0 || this.currentIndex < 0) {
            return "";
        }

        this.currentIndex--;

        if (this.currentIndex < 0) {
            this.currentIndex = 0;
        }

        return this.history[this.currentIndex];
    }

    down(): string {
        if (
            this.history.length === 0 ||
            this.currentIndex >= this.history.length
        ) {
            return "";
        }

        this.currentIndex++;

        if (!this.history[this.currentIndex]) return "";

        return this.history[this.currentIndex];
    }

    getPrevious(): string {
        if (this.currentIndex === 0) {
            return "";
        }

        return this.history[this.currentIndex - 1];
    }

    getNext(): string {
        return this.history[this.currentIndex + 1];
    }

    printHistory(): void {
        console.log("[ GPT INPUT HISTORY ]", this.currentIndex, this.history);
    }
}

const history = new History();

export default history;
