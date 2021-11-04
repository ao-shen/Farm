import * as THREE from './three/src/Three';
import { grassFragmentShader } from './shaders/grass_fragment';
import { grassVertexShader } from './shaders/grass_vertex';
import { TextureLoader } from 'three';

//Variables for blade mesh
var joints = 2;
var bladeWidth = 0.25 * 2;
var bladeHeight = 1.0 * 1.5;
var instances = 128;

//Define the bend of the grass blade as the combination of three quaternion rotations
let vertex = new THREE.Vector3();
let x, y, z;

export function initGrassBlades(Farm) {

    let width = 32;

    const textureLoader = new THREE.TextureLoader();

    var grassTexture = textureLoader.load('assets/textures/grass_blades.png');
    //grassTexture.encoding = THREE.sRGBEncoding;
    var alphaMap = textureLoader.load('assets/textures/grass_blades_alpha.png');
    alphaMap.encoding = THREE.sRGBEncoding;
    var perlinMap = textureLoader.load('assets/textures/perlin_noise.png');

    let uniforms = THREE.UniformsUtils.merge([
        THREE.ShaderLib.phong.uniforms,
        { diffuse: { value: new THREE.Color(0x00ff00) } },
        { time: { value: 0.0 } },
        { perlinMap: { value: null } },
        { grassPropertiesMap: { value: null } },
        { mouse_pos_x: { value: 0.0 } },
        { mouse_pos_z: { value: 0.0 } },
        { target_pos_x: { value: 0.0 } },
        { target_pos_z: { value: 0.0 } },
        { specular: { value: new THREE.Color(0x000000) } },
        { shininess: { value: 0.01 } }
    ]);

    //Define base geometry that will be instanced. We use a plane for an individual blade of grass
    var grassBaseGeometry = new THREE.PlaneBufferGeometry(bladeWidth, bladeHeight, 1, joints);
    grassBaseGeometry.translate(0, bladeHeight / 2, 0);

    //Bend grass base geometry for more organic look
    for (let v = 0; v < grassBaseGeometry.attributes.position.array.length; v += 3) {
        vertex.x = grassBaseGeometry.attributes.position.array[v];
        vertex.y = grassBaseGeometry.attributes.position.array[v + 1];
        vertex.z = grassBaseGeometry.attributes.position.array[v + 2];
        vertex.x -= bladeWidth * 0.5;
        let frac = vertex.y / bladeHeight;
        if (frac > 0.9) {
            vertex.x *= 0.3;
        } else {
            vertex.x *= ((frac) * 0.5 + 0.5);
        }
        vertex.z += (Math.pow(1.2, frac) - 1) * 1.7;
        grassBaseGeometry.attributes.position.array[v] = vertex.x;
        grassBaseGeometry.attributes.position.array[v + 1] = vertex.y;
        grassBaseGeometry.attributes.position.array[v + 2] = vertex.z;
    }

    grassBaseGeometry.computeVertexNormals();
    grassBaseGeometry.computeTangents();
    grassBaseGeometry.computeBoundingBox();
    grassBaseGeometry.computeBoundingSphere();

    let phongMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: grassVertexShader,
        fragmentShader: grassFragmentShader,
        side: THREE.DoubleSide,
        lights: true,
        transparent: true,
        extensions: {
            fragDepth: true,
        },
    });
    //const theArray = texture.image.data;

    uniforms.map.value = grassTexture;
    phongMaterial.map = grassTexture;
    uniforms.perlinMap.value = perlinMap;
    phongMaterial.perlinMap = perlinMap;
    uniforms.grassPropertiesMap.value = Farm.grassPropertiesMap;
    phongMaterial.grassPropertiesMap = Farm.grassPropertiesMap;
    //uniforms.alphaMap.value = alphaMap;
    //phongMaterial.alphaMap = alphaMap;
    //uniforms.lightPos = { value: Farm.shadowLight.position }

    var baseMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    var baseBlade = new THREE.Mesh(grassBaseGeometry, baseMaterial);
    baseBlade.castShadow = true;
    baseBlade.receiveShadow = true;
    // Show grass base geometry
    //Farm.scene.add(baseBlade);

    let grass = new THREE.InstancedMesh(grassBaseGeometry, phongMaterial, instances * width * width);

    const matrix = new THREE.Matrix4();

    let curMatrixIdx = 0;

    for (let blockX = 0; blockX < width; blockX++) {
        for (let blockZ = 0; blockZ < width; blockZ++) {

            //For each instance of the grass blade
            for (let i = 0; i < instances; i++) {

                //Offset of the roots
                x = (blockX + Math.random() - 0.5) * Farm.blockSize;
                z = (blockZ + Math.random() - 0.5) * Farm.blockSize;
                y = 0;

                //Random orientation
                let angle = Math.PI - (Math.random() * Math.PI) * 2;

                //Define variety in height
                let scale = 1;
                if (i % 3 != 0) {
                    scale = 1.0 + Math.random() * 0.2 * 1.25;
                } else {
                    scale = 1.0 + Math.random() * 0.2;
                }

                matrix.set(
                    x, y, z, scale,
                    angle * 0.5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
                );

                grass.setMatrixAt(curMatrixIdx, matrix);
                curMatrixIdx++;
            }
        }
    }

    grass.receiveShadow = true;

    grass.name = "GrassBladeMesh";

    Farm.scene.add(grass);

    Farm.grassBladeMesh = grass;
    Farm.grassBladeMaterial = phongMaterial;

    Farm.timeUpdateMaterials.push(phongMaterial);
}