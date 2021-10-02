import { Entity } from "./entity";

export class Vehicle extends Entity {
    constructor(Farm, idx, x, z, type, variation = 0) {
        super(Farm, idx, x, z, type, variation);

        this.entitySlots = this.Farm.ENTITIES[this.type].entitySlots;
        this.entities = [];

    }

    remove() {
        for (let entity of this.entities) {
            entity.remove();
        }
        super.remove();
    }

    update() {
        super.update();

        for (let entity of this.entities) {
            entity.pos.x = this.pos.x;
            entity.pos.z = this.pos.z;
        }
    }
}