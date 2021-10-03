import { InfoBox } from "./info_box";
import { Inventory } from "./inventory";

export class Restaurant {
    constructor(Farm) {
        this.Farm = Farm;

        this.name = "Restaurant";

        this.dropOffPoint = { x: 0, z: 0 };

    }

    showInfoBox() {

    }

    update() {

    }

    render() {

    }
}

export class Stand extends Restaurant {
    constructor(Farm, restaurantStandMesh, restaurantStandInvMesh) {
        super(Farm);

        this.dropOffPoint = { x: 7, z: 0 };

        this.inventory = new Inventory(50);

        this.restaurantStandMesh = restaurantStandMesh;
        this.restaurantStandInvMesh = restaurantStandInvMesh;

        this.restaurantStandMesh.name = "Restaurant";

        Farm.groupInfoable.add(this.restaurantStandMesh);
        this.restaurantStandMesh.owner = this;
        this.restaurantStandInvMesh.owner = this;
        this.restaurantStandMesh.add(this.restaurantStandInvMesh);

        this.infoBox = new InfoBox(this.Farm, this, "restaurantStandMesh");
        this.infoBox.addText(this.name);
        this.infoBox.addInventory(this.inventory);
    }

    showInfoBox() {

        let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.restaurantStandMesh), this.Farm.camera);

        this.infoBox.updatePosition(pos.x, pos.y);

        this.infoBox.show();
    }


    update() {

    }

    render() {

        let invMeshY = 0.27 * (-1 + this.inventory.getFillLevel());

        this.restaurantStandMesh.position.set(75, 0, -20);
        this.restaurantStandInvMesh.position.set(0, invMeshY, 0);

        this.infoBox.render();
    }
}