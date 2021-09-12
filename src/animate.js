import * as THREE from 'three';
import { Vector3 } from 'three';

export function animate(Farm) {

    requestAnimationFrame(function() {
        animate(Farm);
    });


    Farm.stats.begin();

    Farm.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    Farm.scheduler.onFrame();

    for (let plantType of Farm.plantTypeAwaitingMeshUpdate) {
        let plantBuilding = Farm.BUILDINGS[plantType];
        for (let m = 0; m < plantBuilding.meshes.length; m++) {
            plantBuilding.meshes[m].instanceMatrix.needsUpdate = true;
        }
    }
    Farm.plantTypeAwaitingMeshUpdate = new Set();

    for (const building of Farm.buildings) {
        building.update();
    }

    for (const entity of Farm.entities) {
        entity.update();
    }

    render(Farm);

    Farm.stats.end();

}

function render(Farm) {

    renderOverlays(Farm);

    for (const building of Farm.buildings) {
        building.render();
    }

    for (const entity of Farm.entities) {
        entity.render();
    }

    Farm.renderer.clear();
    Farm.renderer.render(Farm.scene, Farm.camera);

    Farm.renderer.clearDepth();
    Farm.renderer.render(Farm.hudScene, Farm.hudCamera);
}

function renderOverlays(Farm) {
    Farm.mouseRaycaster.setFromCamera(Farm.mousePos, Farm.camera);

    const intersects = Farm.mouseRaycaster.intersectObject(Farm.groundMesh);

    Farm.hoveringBlock = null;
    if (intersects.length > 0) {

        const intersect = intersects[0];
        const face = intersect.face;

        const meshPosition = Farm.groundMesh.geometry.attributes.position;

        let point = new THREE.Vector3();

        point.add(new THREE.Vector3(meshPosition.getX(face.a), 0, meshPosition.getZ(face.a)));
        point.add(new THREE.Vector3(meshPosition.getX(face.b), 0, meshPosition.getZ(face.b)));
        point.add(new THREE.Vector3(meshPosition.getX(face.c), 0, meshPosition.getZ(face.c)));
        point.divideScalar(3);

        point = Farm.magnetToBlocks(point);
        let blockPos = Farm.posToBlocks(point.x, point.z);
        Farm.hoveringBlock = Farm.blocks[blockPos.x + ',' + blockPos.z];

        let rectScreenPoint1 = Farm.posToScreenPos(new Vector3(point.x, 0, point.z), Farm.camera);
        let rectScreenPoint2 = Farm.posToScreenPos(new Vector3(point.x + Farm.blockSize, 0, point.z), Farm.camera);
        let rectScreenPoint3 = Farm.posToScreenPos(new Vector3(point.x + Farm.blockSize, 0, point.z + Farm.blockSize), Farm.camera);
        let rectScreenPoint4 = Farm.posToScreenPos(new Vector3(point.x, 0, point.z + Farm.blockSize), Farm.camera);

        Farm.blockLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            rectScreenPoint1.x, rectScreenPoint1.y, -101,
            rectScreenPoint2.x, rectScreenPoint2.y, -101,
            rectScreenPoint3.x, rectScreenPoint3.y, -101,
            rectScreenPoint4.x, rectScreenPoint4.y, -101,
        ]), 3));

        Farm.groundMesh.updateMatrix();

        Farm.blockLine.geometry.applyMatrix4(Farm.groundMesh.matrix);

        Farm.blockLine.visible = true;

        if (Farm.overlay == Farm.OVERLAY.BUILD_AREA ||
            Farm.overlay == Farm.OVERLAY.BUILD_PLANTS ||
            Farm.overlay == Farm.OVERLAY.REMOVE_AREA ||
            Farm.overlay == Farm.OVERLAY.REMOVE_PLANTS ||
            Farm.overlay == Farm.OVERLAY.REMOVE_BUILDINGS) {

            let rectX1 = Math.min(point.x, Farm.buildAreaCorner.x);
            let rectZ1 = Math.min(point.z, Farm.buildAreaCorner.z);
            let rectX2 = Math.max(point.x, Farm.buildAreaCorner.x) + Farm.blockSize;
            let rectZ2 = Math.max(point.z, Farm.buildAreaCorner.z) + Farm.blockSize;

            Farm.buildAreaPoint1 = Farm.posToBlocks(rectX1, rectZ1);
            Farm.buildAreaPoint2 = Farm.posToBlocks(rectX2 - Farm.blockSize, rectZ2 - Farm.blockSize);

            rectScreenPoint1 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ1), Farm.camera);
            rectScreenPoint2 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ2), Farm.camera);
            rectScreenPoint3 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ2), Farm.camera);
            rectScreenPoint4 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ1), Farm.camera);

            Farm.buildAreaRect.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                rectScreenPoint1.x, rectScreenPoint1.y, -100,
                rectScreenPoint2.x, rectScreenPoint2.y, -100,
                rectScreenPoint3.x, rectScreenPoint3.y, -100,
                rectScreenPoint4.x, rectScreenPoint4.y, -100,
                rectScreenPoint1.x, rectScreenPoint1.y, -100,
            ]), 3));
        } else if (Farm.overlay == Farm.OVERLAY.BUILD_BUILDINGS) {

            let offsetFromCenterOfBlock = intersect.point.clone();
            offsetFromCenterOfBlock.sub(point);
            offsetFromCenterOfBlock.subScalar(Farm.blockSize * 0.5);

            if (offsetFromCenterOfBlock.x <= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x <= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.SOUTH;
            } else if (offsetFromCenterOfBlock.x >= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x <= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.WEST;
            } else if (offsetFromCenterOfBlock.x >= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x >= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.NORTH;
            } else if (offsetFromCenterOfBlock.x <= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x >= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.EAST;
            }

            let curSizeX = Farm.BUILDINGS[Farm.buildPaletteSelect].size.x;
            let curSizeZ = Farm.BUILDINGS[Farm.buildPaletteSelect].size.z;

            let buildingCenterX = Math.floor((point.x) / Farm.blockSize) + 0.5;
            let buildingCenterZ = Math.floor((point.z) / Farm.blockSize) + 0.5;

            let rectX1 = (buildingCenterX - Math.floor(curSizeX * 0.5)) * Farm.blockSize;
            let rectZ1 = (buildingCenterZ - Math.floor(curSizeZ * 0.5)) * Farm.blockSize;
            let rectX2 = (buildingCenterX + Math.ceil(curSizeX * 0.5)) * Farm.blockSize;
            let rectZ2 = (buildingCenterZ + Math.ceil(curSizeZ * 0.5)) * Farm.blockSize;

            Farm.buildAreaPoint1 = Farm.posToBlocks(rectX1, rectZ1);
            Farm.buildAreaPoint2 = Farm.posToBlocks(rectX2 - Farm.blockSize, rectZ2 - Farm.blockSize);

            rectScreenPoint1 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ1), Farm.camera);
            rectScreenPoint2 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ2), Farm.camera);
            rectScreenPoint3 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ2), Farm.camera);
            rectScreenPoint4 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ1), Farm.camera);

            Farm.buildAreaRect.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                rectScreenPoint1.x, rectScreenPoint1.y, -100,
                rectScreenPoint2.x, rectScreenPoint2.y, -100,
                rectScreenPoint3.x, rectScreenPoint3.y, -100,
                rectScreenPoint4.x, rectScreenPoint4.y, -100,
                rectScreenPoint1.x, rectScreenPoint1.y, -100,
            ]), 3));

            // update build building preview
            if (Farm.buildBuildingMesh != null) {
                Farm.buildBuildingMesh.rotation.y = -(Farm.buildBuildingSide - 1) * Math.PI / 2;
                Farm.buildBuildingMesh.position.set(Farm.buildAreaPoint1.x * Farm.blockSize, 0, Farm.buildAreaPoint1.z * Farm.blockSize);
            }
        }

    } else {

        Farm.blockLine.visible = false;

    }
}