import { AbstractGameObject } from "./AbstractGameObject";

export abstract class AbstractGamePlayer extends AbstractGameObject {
    // @ts-ignore
    public readonly isPlayer = true;

    constructor() {
        super();
    }

    deactivateControls?() {}

    activateControls?() {}

    setHealth(health: number) {}

    setScore(score: number) {}

    setHasLost(hasLost: boolean) {}

    setHasWon(hasWon: boolean) {}

    getHasLost(): boolean {
        return false;
    }

    getHasWon(): boolean {
        return false;
    }

    getHealth(): number {
        return 0;
    }

    getScore(): number {
        return 0;
    }
}
