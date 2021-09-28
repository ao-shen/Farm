import { Inventory } from "./inventory";

export class Restaurant {
    constructor(Farm) {
        this.Farm = Farm;
    }

    update() {

    }

    render() {

    }
}

export class Stand extends Restaurant {
    constructor(Farm, restaurantStandMesh, restaurantStandInvMesh) {
        super(Farm);

        this.inventory = new Inventory(50);

        this.restaurantStandMesh = restaurantStandMesh;
        this.restaurantStandInvMesh = restaurantStandInvMesh;

        Farm.scene.add(this.restaurantStandMesh);
        Farm.scene.add(this.restaurantStandInvMesh);
    }

    update() {

    }

    render() {

        let invMeshY = 0.27 * (-1 + this.inventory.getFillLevel());

        this.restaurantStandMesh.position.set(75, 0, -20);
        this.restaurantStandInvMesh.position.set(75, invMeshY, -20);
    }
}