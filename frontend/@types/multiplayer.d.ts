interface Player {
    rotation: {
        x: number;
        y: number;
        z: number;
    };
    position: {
        x: number;
        y: number;
        z: number;
    };
    sessionId: string;
    scale: {
        x: number;
        y: number;
        z: number;
    };
    space: string;
    userId: string;
    userData: {
        avatar: string;
        username: string;
        walletId: string;
    };
    roomParameters: {};
    isPaused: boolean;
    animation: number;
}
