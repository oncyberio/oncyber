import { Client, Room } from "colyseus";

const ROOM_CONFIG = {
    maxPlayers: 200,
    tickRate: 0,
};

export class EditRoom extends Room<{}, Metadata> {
    onCreate(options: any): void | Promise<any> {
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        this.maxClients = ROOM_CONFIG.maxPlayers;

        this.setMetadata({
            spaceId: options?.label,
            exhibitId: options?.currentSpace,
        });

        // 10fps
        this.setPatchRate(1000 / ROOM_CONFIG.tickRate);
    }

    update(delta: number) {}

    async onAuth(client: Client, options: JoinParams) {}

    async onJoin(client: Client, options: JoinParams, fromAuth: any) {}

    async onLeave(client: Client, consented: boolean) {}

    onDispose() {}
}
