import * as THREE from 'three';
import { Vector3 } from 'three';

let fps = 60;
let fpsInterval = 1000 / fps;
let then = window.performance.now();
let now, elapsed;

export function onAnimationFrame(Farm, newtime) {
    requestAnimationFrame(function(newtime) {
        onAnimationFrame(Farm, newtime);
    });

    now = newtime;
    elapsed = now - then;

    // if enough time has elapsed, draw the next frame

    if (elapsed > fpsInterval) {

        // Get ready for next frame by setting then=now, but...
        // Also, adjust for fpsInterval not being multiple of 16.67
        then = now - (elapsed % fpsInterval);

        animate(Farm, elapsed);
    }

}

export function animate(Farm, elapsed) {

    Farm.stats.begin();

    Farm.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    Farm.scheduler.onFrame();

    // Update plants buildings and entities
    for (let plantType of Farm.plantTypeAwaitingMeshUpdate) {
        let plantBuilding = Farm.BUILDINGS[plantType];
        for (let m = 0; m < plantBuilding.meshes.length; m++) {
            plantBuilding.meshes[m].instanceMatrix.needsUpdate = true;
        }
    }
    Farm.plantTypeAwaitingMeshUpdate = new Set();

    if (Farm.grassBladeMeshNeedsUpdate) {
        Farm.grassBladeMesh.instanceMatrix.needsUpdate = true;
        Farm.grassBladeMeshNeedsUpdate = false;
    }

    for (const building in Farm.buildings) {
        Farm.buildings[building].update();
    }

    for (const entity in Farm.entities) {
        Farm.entities[entity].update();
    }

    // Update dragging info boxes
    if (Farm.draggingInfoBox) {
        Farm.draggingInfoBox.pos.set(
            Farm.draggingInfoBoxStartPos.x + (Farm.mousePos.x - Farm.draggingInfoBoxStartMousePos.x) / 2 * window.innerWidth,
            Farm.draggingInfoBoxStartPos.y + (Farm.mousePos.y - Farm.draggingInfoBoxStartMousePos.y) / 2 * window.innerHeight,
            Farm.draggingInfoBoxStartPos.z
        );
    }

    // Update Shadows
    let d = 256 * Farm.controls.object.position.distanceTo(Farm.controls.target) / 100;

    Farm.shadowLight.shadow.camera.left = -d;
    Farm.shadowLight.shadow.camera.right = d;
    Farm.shadowLight.shadow.camera.top = d;
    Farm.shadowLight.shadow.camera.bottom = -d;
    Farm.shadowLight.shadow.camera.updateProjectionMatrix();

    d *= 10;

    Farm.shadowLight.position.set(Farm.controls.target.x + Farm.sun.x * d, Farm.sun.y * d, Farm.controls.target.z + Farm.sun.z * d);
    Farm.shadowLight.target.position.set(Farm.controls.target.x, 0, Farm.controls.target.z);

    //Farm.shadowLight.shadow.camera.position.set(Farm.controls.target.x, 10, Farm.controls.target.y);

    // Update grass blades

    //Farm.grassBladeMaterial.uniforms.posX.value = Farm.controls.target.x;
    //Farm.grassBladeMaterial.uniforms.posZ.value = Farm.controls.target.z;
    Farm.grassBladeMaterial.uniforms.time.value = (Math.sin(now * 0.1) + 2 * now * 0.1) * 0.03;
    //Farm.grassBladeMesh.position.set(Farm.controls.target.x, 0, Farm.controls.target.z);

    render(Farm);

    Farm.stats.end();

}

function render(Farm) {

    renderOverlays(Farm);
    renderInfoBoxes(Farm);

    for (const building in Farm.buildings) {
        Farm.buildings[building].render();
    }

    for (const entity in Farm.entities) {
        Farm.entities[entity].render();
    }

    Farm.renderer.clear();
    Farm.composer.render();
    //Farm.renderer.render(Farm.scene, Farm.camera);

    Farm.renderer.clearDepth();
    Farm.renderer.render(Farm.hudScene, Farm.hudCamera);
}

function renderInfoBoxes(Farm) {

    if (Farm.lens == Farm.LENS.DEFAULT) {
        Farm.infoBoxRaycaster.setFromCamera(Farm.mousePos, Farm.camera);

        const intersects = Farm.infoBoxRaycaster.intersectObject(Farm.groupInfoable, true);

        if (intersects.length > 0) {
            const selectedObject = intersects[0].object;
            Farm.outlinePass.selectedObjects = [selectedObject];
        } else {
            Farm.outlinePass.selectedObjects = [];
        }
    }
}

function renderOverlays(Farm) {

    if (Farm.lens == Farm.LENS.BUILD || Farm.lens == Farm.LENS.REMOVE) {
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

            // Find building side

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

            if (Farm.overlay == Farm.OVERLAY.BUILD_AREA ||
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
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_LINE) {

                let rectX1 = Math.min(point.x, Farm.buildAreaCorner.x);
                let rectZ1 = Math.min(point.z, Farm.buildAreaCorner.z);
                let rectX2 = Math.max(point.x, Farm.buildAreaCorner.x) + Farm.blockSize;
                let rectZ2 = Math.max(point.z, Farm.buildAreaCorner.z) + Farm.blockSize;

                if ((point.x - Farm.buildAreaCorner.x - point.z + Farm.buildAreaCorner.z) * (point.x - Farm.buildAreaCorner.x + point.z - Farm.buildAreaCorner.z) < 0) {
                    rectX1 = Farm.buildAreaCorner.x;
                    rectX2 = Farm.buildAreaCorner.x + Farm.blockSize;
                } else {
                    rectZ1 = Farm.buildAreaCorner.z;
                    rectZ2 = Farm.buildAreaCorner.z + Farm.blockSize;
                }

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
                    Farm.buildBuildingMesh.position.set(
                        (rectX2) - 0.5 * Farm.blockSize,
                        0.01,
                        (rectZ2) - 0.5 * Farm.blockSize
                    );
                }
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_SINGLE) {

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
                    let buildingSize = Farm.BUILDINGS[Farm.buildPaletteSelect].size;
                    Farm.buildBuildingMesh.rotation.y = -(Farm.buildBuildingSide - 1) * Math.PI / 2;
                    Farm.buildBuildingMesh.position.set(
                        (Farm.buildAreaPoint1.x + buildingSize.x * 0.5 - 0.5) * Farm.blockSize,
                        0,
                        (Farm.buildAreaPoint1.z + buildingSize.z * 0.5 - 0.5) * Farm.blockSize
                    );
                }
            }
        } else {
            Farm.blockLine.visible = false;
        }
    } else {
        Farm.blockLine.visible = false;
    }
}