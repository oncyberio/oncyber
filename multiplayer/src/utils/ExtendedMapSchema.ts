import { MapSchema } from "@colyseus/schema";

export class ExtendedMapSchema<T> {
    public _onAdd: (value: T) => void = null;

    public _onRemove: (value: T) => void = null;

    public map: MapSchema<T> = null;

    constructor(map: MapSchema<T>) {
        this.map = map;
    }

    setCallbacks({
        onAdd,
        onRemove,
    }: {
        onAdd: (value: T) => void;
        onRemove: (value: T) => void;
    }) {
        this._onAdd = onAdd;

        this._onRemove = onRemove;
    }

    set = (key: string, value: T) => {
        const result = this.map.set(key, value);

        if (this._onAdd) {
            this._onAdd(this.map.get(key));
        }

        return result;
    };

    delete = (key: string) => {
        const toRemove = this.map.get(key);

        const result = this.map.delete(key);

        // if true - user was removed, if false - user was not found

        if (result) {
            if (this._onRemove) {
                this._onRemove(toRemove);
            }
        }

        return result;
    };
}
