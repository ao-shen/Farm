import { Entity } from "./entity";
import { Vehicle } from "./vehicle";

export function spawnCustomers(Farm) {

    let newIdx = Farm.entityIdx++;
    let customerCar = new CustomerCar(Farm, newIdx);
    Farm.entities[newIdx] = customerCar;

    setTimeout(function() { spawnCustomers(Farm); }, Math.random() * 1000 + 500);
}

export class Customer extends Entity {
    constructor(Farm, idx, x, z, type, variation) {
        super(Farm, idx, x, z, type, variation);


    }

    logic() {

    }
}

export class CustomerCar extends Vehicle {
    constructor(Farm, idx) {

        const variation = Math.floor(Math.random() * Farm.ENTITIES[2].models.length);
        const lane = Math.floor(Math.random() * 2);

        const Lane0Z = -136.6;
        const ParkingStartZ = -106.6;

        super(Farm, idx, -160, Lane0Z - lane * 16.5, 2, variation);

        this.lane = lane;
        this.path = [];
        this.secondHalfPath = [];
        this.parkingIdx = -1;

        if (this.lane == 0 && Math.random() < 0.5) {

            let parkingIdx = -1;
            for (let i = 0; i < Farm.parkingLot.length; i++) {
                if (Farm.parkingLot[i].vehicle == null) {
                    parkingIdx = i;
                    break;
                }
            }

            if (parkingIdx !== -1) {

                Farm.parkingLot[parkingIdx].vehicle = this;
                this.parkingIdx = parkingIdx;

                //this.generateCustomers();

                this.path.push({ x: 3.85, z: Lane0Z / this.Farm.blockSize, allowedDeviation: 1 });
                this.path.push({ x: 6.0, z: (ParkingStartZ - 20) / this.Farm.blockSize, speedLimit: 3, allowedDeviation: 1 });
                this.path.push({ x: 6.85, z: ParkingStartZ / this.Farm.blockSize, speedLimit: 2, allowedDeviation: 1 });

                this.path.push({ x: 6.85, z: Farm.parkingLot[parkingIdx].z, speedLimit: 1, allowedDeviation: 1 });
                this.path.push({ x: Farm.parkingLot[parkingIdx].x, z: Farm.parkingLot[parkingIdx].z, speedLimit: 1, allowedDeviation: 1 });
                this.secondHalfPath.push({ x: 8.15, z: Farm.parkingLot[parkingIdx].z, speedLimit: 1, allowedDeviation: 1 });

                this.secondHalfPath.push({ x: 8.15, z: ParkingStartZ / this.Farm.blockSize, speedLimit: 1, allowedDeviation: 1 });
                this.secondHalfPath.push({ x: 9.0, z: (ParkingStartZ - 20) / this.Farm.blockSize, speedLimit: 2, allowedDeviation: 1 });
                this.secondHalfPath.push({ x: 11.15, z: Lane0Z / this.Farm.blockSize, speedLimit: 3, allowedDeviation: 1 });

            }
        }

        this.secondHalfPath.push({ x: this.Farm.numBlocks.x, z: (Lane0Z - lane * 16.5) / this.Farm.blockSize });

        if (this.path.length == 0) {
            this.path = this.secondHalfPath;
        }
    }

    generateCustomers() {
        let numCustomers = 1 + Math.floor(Math.random() * (this.entitySlots - 1));

        for (let i = 0; i < numCustomers; i++) {
            let customerEntity = new Customer(this.Farm, this.Farm.entityIdx, this.pos.x, this.pos.z, 1);
            customerEntity.parentEntitiy = this;
            this.entities.push(customerEntity);
            this.Farm.entities[this.Farm.entityIdx] = customerEntity;
            this.Farm.entityIdx++;
        }
    }

    logic() {}

    reachedTarget() {
        if (this.pos.x > this.Farm.numBlocks.x - 2) {
            this.remove();
        } else {
            setTimeout(() => {
                this.path = this.secondHalfPath;
                this.Farm.parkingLot[this.parkingIdx].vehicle = null;
            }, 2000 + Math.random() * 5000);
        }
    }
}