import * as THREE from './three/src/Three';
import { Building } from "./building";

export class MechanicalPart extends Building {
    constructor(Farm, idx, x, z, type, side, height = 0) {
        super(Farm, idx, x, z, type, side);

        this.isMechanical = true;
        this.height = height;

        this.pos.y = this.height;

        this.center = { x: 0, z: 0 };

        let center = this.Farm.BUILDINGS[this.type].center;
        if (center) {
            if (this.side == 3) {
                this.center.x = center.x;
                this.center.z = center.z;
            } else if (this.side == 2) {
                this.center.x = center.z;
                this.center.z = -center.x;
            } else if (this.side == 1) {
                this.center.x = -center.x;
                this.center.z = -center.z;
            } else if (this.side == 0) {
                this.center.x = -center.z;
                this.center.z = center.x;
            }
        }
        this.center.x *= this.Farm.blockSize;
        this.center.z *= this.Farm.blockSize;
    }

    remove() {
        super.remove();
    }
}

export class MechanicalRotator extends MechanicalPart {
    constructor(Farm, idx, x, z, type, side, height = 0) {
        super(Farm, idx, x, z, type, side, height);

        this.isMechanicalRotator = true;
        this.rotation = 0;

        this.euler = new THREE.Euler(0, 1, 1.57, 'XYZ');

        this.rotatorOffset = new THREE.Vector3();
        if (this.Farm.BUILDINGS[this.type].rotatorOffset) {
            this.rotatorOffset = this.Farm.BUILDINGS[this.type].rotatorOffset.clone();
        }

        this.rotatorOffset.multiplyScalar(5);

        this.rotatorOffset.x += this.pos.x * this.Farm.blockSize;
        this.rotatorOffset.y += this.pos.y * this.Farm.blockSize * 0.5;
        this.rotatorOffset.z += this.pos.z * this.Farm.blockSize;

        this.rotationData = { speed: 0, offset: 0, network: null };
    }

    updateInstancedMesh() {
        if (this.infoable) {
            this.super.updateInstancedMesh();
            return;
        }

        let Farm = this.Farm;

        let BUILDING = Farm.BUILDINGS[this.type];

        this.matrix.makeRotationY(-(this.side - 1) * Math.PI / 2);

        this.matrix.setPosition(
            this.pos.x * this.Farm.blockSize,
            this.pos.y * this.Farm.blockSize * 0.5,
            this.pos.z * this.Farm.blockSize
        );

        if (BUILDING.meshes.length >= 2) {

            let baseMesh = BUILDING.meshes[1];

            baseMesh.setMatrixAt(this.meshIdx, this.matrix);
        }

        this.rotatorMesh = BUILDING.meshes[0];

        this.rotatorMesh.setMatrixAt(this.meshIdx, this.matrix);

    }

    render() {
        super.render();

        if (this.rotationData && this.rotationData.network && this.rotationData.network.torque > 0) {
            this.rotation = (this.Farm.now * this.rotationData.speed + this.rotationData.offset) % (Math.PI * 2);
        }

        if (this.rotatorMesh) {

            let rotation = this.rotation;

            if (this.side < 2) rotation = -rotation;

            this.euler.set(0, -(this.side - 1) * Math.PI / 2, rotation, 'YZX');

            this.matrix.makeRotationFromEuler(this.euler);

            this.matrix.setPosition(
                this.rotatorOffset.x + this.center.x,
                this.rotatorOffset.y,
                this.rotatorOffset.z + this.center.z
            );

            this.rotatorMesh.setMatrixAt(this.meshIdx, this.matrix);

            this.rotatorMesh.instanceMatrix.needsUpdate = true;
        }
        //this.mesh.position.set(this.center.x, 0, this.center.z);
    }
}