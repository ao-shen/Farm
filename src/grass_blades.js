import * as THREE from 'three';
import { ShaderChunk } from 'three';

function replaceThreeChunkFn(a, b) {
    return THREE.ShaderChunk[b] + '\n'
}

function shaderParse(glsl) {
    return glsl.replace(/\/\/\s?chunk\(\s?(\w+)\s?\);/g, replaceThreeChunkFn)
}

//Variables for blade mesh
var joints = 4;
var bladeWidth = 0.4 * 10;
var bladeHeight = 1.5 * 10;

//Patch side length
var width = 10;
//Number of vertices on ground plane side
var resolution = 10;
//Distance between two ground plane vertices
var delta = width / resolution;
//User movement speed
var speed = 3;

//Lighting variables for grass
var ambientStrength = 0.7;
var translucencyStrength = 1.5;
var specularStrength = 0.5;
var diffuseStrength = 1.5;
var shininess = 256;
var sunColour = new THREE.Vector3(1.0, 1.0, 1.0);
var specularColour = new THREE.Vector3(1.0, 1.0, 1.0);

var instances = 2000;

//Define the bend of the grass blade as the combination of three quaternion rotations
let vertex = new THREE.Vector3();
let quaternion0 = new THREE.Quaternion();
let quaternion1 = new THREE.Quaternion();
let x, y, z, w, angle, sinAngle, rotationAngle;

//************** Grass **************
var grassVertexSource = `
precision mediump float;

#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )

varying float vFragDepth;
varying float vIsPerspective;

  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 offset;
  attribute vec2 uv;
  attribute vec2 halfRootAngle;
  attribute float scale;
  attribute float index;
  uniform float time;
  
  uniform float delta;
  uniform float posX;
  uniform float posZ;
  uniform float width;

  // = object.matrixWorld
uniform mat4 modelMatrix;

// = camera.matrixWorldInverse * object.matrixWorld
uniform mat4 modelViewMatrix;

// = camera.projectionMatrix
uniform mat4 projectionMatrix;

// = camera.matrixWorldInverse
uniform mat4 viewMatrix;

// = inverse transpose of modelViewMatrix
uniform mat3 normalMatrix;

// = camera position in world space
uniform vec3 cameraPosition;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float frc;
  varying float idx;

  const float TWO_PI = 2.0 * PI;
  
  //https://www.geeks3d.com/20141201/how-to-rotate-a-vertex-by-a-quaternion-in-glsl/
  vec3 rotateVectorByQuaternion(vec3 v, vec4 q){
    return 2.0 * cross(q.xyz, v * q.w + cross(q.xyz, v)) + v;
  }

  #include <common>
  #include <uv_pars_vertex>
  #include <displacementmap_pars_vertex>
  #include <morphtarget_pars_vertex>
  #include <skinning_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  // chunk(shadowmap_pars_vertex);
  
  // This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.
// Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for
// depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.
varying vec2 vHighPrecisionZW;

  void main() {

    #include <uv_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

  
    //Vertex height in blade geometry
    frc = position.y / float(1.5);
  
    //Scale vertices
    vec3 vPosition = position;
    vPosition.y *= scale;
  
    //Invert scaling for normals
    vNormal = normal;
    vNormal.y /= scale;
  
    //Rotate blade around Y axis
    vec4 direction = vec4(0.0, halfRootAngle.x, 0.0, halfRootAngle.y);
    vPosition = rotateVectorByQuaternion(vPosition, direction);
    vNormal = rotateVectorByQuaternion(vNormal, direction);
  
    //UV for texture
    vUv = uv;
  
    vec3 pos;
    vec3 globalPos;
    vec3 tile;
  
    globalPos.x = offset.x-posX*delta;
    globalPos.z = offset.z-posZ*delta;
  
    tile.x = floor((globalPos.x + 0.5 * width) / width);
    tile.z = floor((globalPos.z + 0.5 * width) / width);
  
    pos.x = globalPos.x - tile.x * width;
    pos.z = globalPos.z - tile.z * width;
  
    pos.y = 0.0;
  
    //Position of the blade in the visible patch [0->1]
    vec2 fractionalPos = 0.5 + offset.xz / width;
    //To make it seamless, make it a multiple of 2*PI
    fractionalPos *= TWO_PI * 16.0;

    //Wind is sine waves in time. 
    float noise = sin(fractionalPos.x + time);
    float halfAngle = noise * 0.1;
    noise = 0.5 + 0.5 * cos(fractionalPos.y + 0.25 * time);
    halfAngle -= noise * 0.2;
  
    direction = normalize(vec4(sin(halfAngle), 0.0, -sin(halfAngle), cos(halfAngle)));
  
    //Rotate blade and normals according to the wind
    vPosition = rotateVectorByQuaternion(vPosition, direction);
    vNormal = rotateVectorByQuaternion(vNormal, direction);
  
    //Move vertex to global location
    vPosition += pos;
  
    //Index of instance for varying colour in fragment shader
    idx = index;

    // chunk(shadowmap_vertex);
  
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);

    vHighPrecisionZW = gl_Position.zw;

		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );

  }    
`;

var grassFragmentSource = `
precision mediump float;

uniform mat4 viewMatrix;

uniform float logDepthBufFC;
varying float vFragDepth;
varying float vIsPerspective;

uniform vec3 cameraPosition;

//Light uniforms
uniform float ambientStrength;
uniform float diffuseStrength;
uniform float specularStrength;
uniform float translucencyStrength;
uniform float shininess;
uniform vec3 lightColour;
uniform vec3 sunDirection;


//Surface uniforms
uniform sampler2D map;
uniform sampler2D alphaMap;
uniform vec3 specularColour;


varying float frc;
varying float idx;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

vec3 ACESFilm(vec3 x){
float a = 2.51;
float b = 0.03;
float c = 2.43;
float d = 0.59;
float e = 0.14;
return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// chunk(common);
// chunk(packing);
// chunk(fog_pars_fragment);
// chunk(bsdfs);
// chunk(lights_pars_begin);
// chunk(shadowmap_pars_fragment);
// chunk(shadowmask_pars_fragment);

void main() {

//If transparent, don't draw
if(texture2D(alphaMap, vUv).r < 0.15){
  discard;
}

vec3 normal;

//Flip normals when viewing reverse of the blade
if(gl_FrontFacing){
  normal = normalize(vNormal);
}else{
  normal = normalize(-vNormal);
}

//Get colour data from texture
vec3 textureColour = pow(texture2D(map, vUv).rgb, vec3(2.2));

//Add different green tones towards root
//vec3 mixColour = idx > 0.75 ? vec3(0.07, 0.52, 0.06) : vec3(0.07, 0.43, 0.08);
//textureColour = mix(pow(mixColour, vec3(2.2)), textureColour, frc);

vec3 lightTimesTexture = lightColour * textureColour;
vec3 ambient = textureColour;
vec3 lightDir = normalize(sunDirection);

//How much a fragment faces the light
float dotNormalLight = dot(normal, lightDir);
float diff = max(dotNormalLight, 0.0);

//Colour when lit by light
vec3 diffuse = diff * lightTimesTexture;

float sky = max(dot(normal, vec3(0,1,0)), 0.0);
vec3 skyLight = sky * vec3(0.12, 0.29, 0.55);

vec3 viewDirection = normalize(cameraPosition - vPosition);
vec3 halfwayDir = normalize(lightDir + viewDirection);
//How much a fragment directly reflects the light to the camera
float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);

//Colour of light sharply reflected into the camera
vec3 specular = spec * specularColour * lightColour;

//https://en.wikibooks.org/wiki/GLSL_Programming/Unity/Translucent_Surfaces
vec3 diffuseTranslucency = vec3(0);
vec3 forwardTranslucency = vec3(0);
float dotViewLight = dot(-lightDir, viewDirection);
if(dotNormalLight <= 0.0){
  diffuseTranslucency = lightTimesTexture * translucencyStrength * -dotNormalLight;
  if(dotViewLight > 0.0){
    forwardTranslucency = lightTimesTexture * translucencyStrength * pow(dotViewLight, 16.0);
  }
}

vec3 col = 0.3 * skyLight * textureColour + ambientStrength * ambient + diffuseStrength * diffuse + diffuseTranslucency + forwardTranslucency;

//Tonemapping
col = ACESFilm(col);

//Gamma correction 1.0/2.2 = 0.4545...
col = pow(col, vec3(0.4545));

//Add a shadow towards root
col = mix(vec3(0.1, 0.4, 0.1), col, frc);

// chunk(fog_fragment);

col = vec3(1, 1, 1);

col *= getShadowMask();

gl_FragColor = vec4(col, 1.0);

gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
}
`;

const depthFragment = /* glsl */ `

precision mediump float;

uniform mat4 viewMatrix;

varying float vFragDepth;
varying float vIsPerspective;

uniform vec3 cameraPosition;

//Light uniforms
uniform float ambientStrength;
uniform float diffuseStrength;
uniform float specularStrength;
uniform float translucencyStrength;
uniform float shininess;
uniform vec3 lightColour;
uniform vec3 sunDirection;


//Surface uniforms
uniform sampler2D map;
uniform sampler2D alphaMap;
uniform vec3 specularColour;


varying float frc;
varying float idx;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

vec3 ACESFilm(vec3 x){
float a = 2.51;
float b = 0.03;
float c = 2.43;
float d = 0.59;
float e = 0.14;
return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}


#define DEPTH_PACKING 3200

#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphatest_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

varying vec2 vHighPrecisionZW;

uniform float logDepthBufFC;

// chunk(common);
// chunk(packing);
// chunk(fog_pars_fragment);
// chunk(bsdfs);
// chunk(lights_pars_begin);
// chunk(shadowmap_pars_fragment);
// chunk(shadowmask_pars_fragment);

void main() {

//If transparent, don't draw
if(texture2D(alphaMap, vUv).r < 0.15){
  discard;
}

#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <logdepthbuf_fragment>

vec3 normal;

//Flip normals when viewing reverse of the blade
if(gl_FrontFacing){
  normal = normalize(vNormal);
}else{
  normal = normalize(-vNormal);
}

//Get colour data from texture
vec3 textureColour = pow(texture2D(map, vUv).rgb, vec3(2.2));

//Add different green tones towards root
//vec3 mixColour = idx > 0.75 ? vec3(0.07, 0.52, 0.06) : vec3(0.07, 0.43, 0.08);
//textureColour = mix(pow(mixColour, vec3(2.2)), textureColour, frc);

vec3 lightTimesTexture = lightColour * textureColour;
vec3 ambient = textureColour;
vec3 lightDir = normalize(sunDirection);

//How much a fragment faces the light
float dotNormalLight = dot(normal, lightDir);
float diff = max(dotNormalLight, 0.0);

//Colour when lit by light
vec3 diffuse = diff * lightTimesTexture;

float sky = max(dot(normal, vec3(0,1,0)), 0.0);
vec3 skyLight = sky * vec3(0.12, 0.29, 0.55);

vec3 viewDirection = normalize(cameraPosition - vPosition);
vec3 halfwayDir = normalize(lightDir + viewDirection);
//How much a fragment directly reflects the light to the camera
float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);

//Colour of light sharply reflected into the camera
vec3 specular = spec * specularColour * lightColour;

//https://en.wikibooks.org/wiki/GLSL_Programming/Unity/Translucent_Surfaces
vec3 diffuseTranslucency = vec3(0);
vec3 forwardTranslucency = vec3(0);
float dotViewLight = dot(-lightDir, viewDirection);
if(dotNormalLight <= 0.0){
  diffuseTranslucency = lightTimesTexture * translucencyStrength * -dotNormalLight;
  if(dotViewLight > 0.0){
    forwardTranslucency = lightTimesTexture * translucencyStrength * pow(dotViewLight, 16.0);
  }
}

vec3 col = 0.3 * skyLight * textureColour + ambientStrength * ambient + diffuseStrength * diffuse + diffuseTranslucency + forwardTranslucency;

//Tonemapping
col = ACESFilm(col);

//Gamma correction 1.0/2.2 = 0.4545...
col = pow(col, vec3(0.4545));

//Add a shadow towards root
col = mix(vec3(0.1, 0.4, 0.1), col, frc);

// chunk(fog_fragment);

// Higher precision equivalent of gl_FragCoord.z. This assumes depthRange has been left to its default values.
	float fragCoordZ = 1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5);
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif

gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
}

`;

let phongVertex = `
#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform float time;

vec3 rotateVectorByQuaternion(vec3 v, vec4 q){
    return 2.0 * cross(q.xyz, v * q.w + cross(q.xyz, v)) + v;
}

void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

    vec3 pos = gl_Position.xyz;

    vec2 fractionalPos = pos.xz * 0.1;

    //Wind is sine waves in time. 
    float noise = sin(fractionalPos.x + time);
    float halfAngle = noise * 0.1;
    noise = 0.5 + 0.5 * cos(fractionalPos.y + 0.25 * time);
    halfAngle -= noise * 0.2;
  
    vec4 direction = normalize(vec4(sin(halfAngle), 0.0, -sin(halfAngle), cos(halfAngle)));
  
    //Rotate blade and normals according to the wind
    //pos = rotateVectorByQuaternion(pos, direction);

    gl_Position = vec4(vec3(pos.x, pos.y, pos.z), gl_Position.w);
}`;


let phongFrag = `
#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <output_fragment>
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;

export function initGrassBlades(Farm) {

    width = Farm.numBlocks.x * Farm.blockSize;
    delta = 1;

    const textureLoader = new THREE.TextureLoader();

    var grassTexture = textureLoader.load('assets/textures/grass_blades.png');
    var alphaMap = textureLoader.load('assets/textures/grass_blades_alpha.png');

    let uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.shadowmap,
        THREE.UniformsLib.lights,
        THREE.UniformsLib.ambient,
        THREE.UniformsLib.common,
        THREE.UniformsLib.displacementmap,
        {
            time: { type: 'float', value: 0 },
            delta: { type: 'float', value: delta },
            posX: { type: 'float', value: 0 },
            posZ: { type: 'float', value: 0 },
            width: { type: 'float', value: width },
            sunDirection: { type: 'vec3', value: new THREE.Vector3(Math.sin(Farm.effectController.azimuth), Math.sin(Farm.effectController.elevation), -Math.cos(Farm.effectController.azimuth)) },
            cameraPosition: { type: 'vec3', value: Farm.camera.position },
            ambientStrength: { type: 'float', value: ambientStrength },
            translucencyStrength: { type: 'float', value: translucencyStrength },
            diffuseStrength: { type: 'float', value: diffuseStrength },
            specularStrength: { type: 'float', value: specularStrength },
            shininess: { type: 'float', value: shininess },
            lightColour: { type: 'vec3', value: sunColour },
            specularColour: { type: 'vec3', value: specularColour },
        }
    ]);

    uniforms.map = { value: grassTexture };
    uniforms.alphaMap = { value: alphaMap };
    uniforms.lightPos = { value: Farm.shadowLight.position }

    var grassMaterial = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: shaderParse(grassVertexSource),
        fragmentShader: shaderParse(grassFragmentSource),
        side: THREE.DoubleSide,
        lights: true,
        extensions: {
            fragDepth: true,
        },
        blending: THREE.NoBlending
    });

    var grassDepthMaterial = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: shaderParse(grassVertexSource),
        fragmentShader: shaderParse(depthFragment),
        depthTest: true,
        depthWrite: true,
        side: THREE.BackSide,
        blending: THREE.NoBlending,
        extensions: {
            fragDepth: true,
        },
    });

    //Define base geometry that will be instanced. We use a plane for an individual blade of grass
    var grassBaseGeometry = new THREE.PlaneBufferGeometry(bladeWidth, bladeHeight, 1, joints);
    grassBaseGeometry.translate(0, bladeHeight / 2, 0);

    grassBaseGeometry.computeVertexNormals();
    grassBaseGeometry.computeTangents();
    grassBaseGeometry.computeBoundingBox();
    grassBaseGeometry.computeBoundingSphere();
    let phongMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shaderParse(phongVertex),
        fragmentShader: shaderParse(phongFrag),
        side: THREE.DoubleSide,
        lights: true,
        extensions: {
            fragDepth: true,
        },
    });
    var baseMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    var baseBlade = new THREE.Mesh(grassBaseGeometry, baseMaterial);
    baseBlade.castShadow = true;
    baseBlade.receiveShadow = true;
    // Show grass base geometry
    Farm.scene.add(baseBlade);

    baseMaterial.onBeforeCompile = function(shader) {

        //console.log(shader.vertexShader);
        //console.log(shader.fragmentShader);

        /*shader.vertexShader = shader.vertexShader.replace('#include <clipping_planes_pars_vertex>', `
        #include <clipping_planes_pars_vertex>
        // some other code here
        
        uniform float time;
 
        `);

        shader.vertexShader = shader.vertexShader.replace('#include <clipping_planes_vertex>', `
        #include <clipping_planes_vertex>
        // some other code here
        
        uniform float time;

            `);*/
    }

    // Each instance has its own data for position, orientation and scale
    var indices = [];
    var offsets = [];
    var scales = [];
    var halfRootAngles = [];

    let grass = new THREE.InstancedMesh(grassBaseGeometry, phongMaterial, instances);

    const matrix = new THREE.Matrix4();

    //For each instance of the grass blade
    for (let i = 0; i < instances; i++) {

        indices.push(i / instances);

        //Offset of the roots
        x = Math.random() * width;
        z = Math.random() * width;
        y = 0;
        offsets.push(x, y, z);

        matrix.makeTranslation(x, y, z);

        grass.setMatrixAt(i, matrix);

        //Random orientation
        let angle = Math.PI - Math.random() * (2 * Math.PI);
        halfRootAngles.push(Math.sin(0.5 * angle), Math.cos(0.5 * angle));

        //Define variety in height
        if (i % 3 != 0) {
            scales.push(2.0 + Math.random() * 1.25);
        } else {
            scales.push(2.0 + Math.random());
        }
    }

    grass.castShadow = true;
    grass.receiveShadow = true;

    //grass.customDepthMaterial = grassDepthMaterial;

    for (const curBlockIdx in Farm.blocks) {
        let curBlock = Farm.blocks[curBlockIdx];
    }

    Farm.scene.add(grass);

    Farm.grassBladeMesh = grass;
    Farm.grassBladeMaterial = phongMaterial;
}