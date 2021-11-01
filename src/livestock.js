import { Entity } from "./entity";

export class Livestock extends Entity {
    constructor(Farm, idx, x, z, type, variation = 0) {
        super(Farm, idx, x, z, type, variation);

        this.isLivestock = true;
    }

    logic() {
        switch (this.state) {
            case 0:
                break;
        }
    }
}