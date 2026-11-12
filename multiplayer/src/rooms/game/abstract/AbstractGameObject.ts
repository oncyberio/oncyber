import { AbstractGameManager, GAME_OBJECT } from "./AbstractGameManager";

export type Trigger = "touch" | "range" | "interact";

// if raycast you can add distance too
export type HitType = "touch" | "range" | "interact" | "raycast";

export abstract class AbstractGameObject {
    public readonly isPlayer = false;

    setMetadata(metadata: any) {}

    setPosition(x: number, y: number, z: number) {}

    setRotation(x: number, y: number, z: number) {}

    setScale(x: number, y: number, z: number) {}

    setAnimation(animation: number) {}

    setVisible(visible: boolean) {}

    setActive(active: boolean) {}

    setId?(id: string) {}

    getId(): string {
        return "";
    }

    getPosition(): { x: number; y: number; z: number } {
        return { x: 0, y: 0, z: 0 };
    }

    // could be anything like player role, etc
    getMetadata(): any {}

    getRotation(): { x: number; y: number; z: number } {
        return { x: 0, y: 0, z: 0 };
    }

    getScale(): { x: number; y: number; z: number } {
        return { x: 1, y: 1, z: 1 };
    }

    getAnimation(): number {
        return 0;
    }

    getActive(): boolean {
        return true;
    }

    getVisible(): boolean {
        return true;
    }

    attachTo(target: GAME_OBJECT) {}

    _isInteracting(
        game: AbstractGameManager,
        target: GAME_OBJECT,
        radius: number,
        callbacks: any
    ) {}

    _moveTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string,
        iteration: number,
        onComplete?: Function
    ) {}

    _rotateTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string,
        iteration: number,
        onComplete?: Function
    ) {}

    _scaleTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string,
        iteration: number,
        onComplete?: Function
    ) {}

    // add as a child to this object
    add?(object: any) {}

    playSound?(sound: string) {}

    init?() {}

    reset?() {}
}
