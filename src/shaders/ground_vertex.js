export const groundVertexShader = `
#define PHONG

varying vec3 vViewPosition;


#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6

#ifndef saturate
// <tonemapping_pars_fragment> may have defined saturate() already
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )

float pow2( const in float x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }

// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.
// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {

	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );

	return fract( sin( sn ) * c );
 
 }
 
 #ifdef HIGH_PRECISION
 	float precisionSafeLength( vec3 v ) { return length( v ); }
 #else
 	float precisionSafeLength( vec3 v ) {
 		float maxComponent = max3( abs( v ) );
 		return length( v / maxComponent ) * maxComponent;
 	}
 #endif
 
 struct IncidentLight {
 	vec3 color;
 	vec3 direction;
 	bool visible;
 };
 
 struct ReflectedLight {
 	vec3 directDiffuse;
 	vec3 directSpecular;
 	vec3 indirectDiffuse;
 	vec3 indirectSpecular;
 };
 
 struct GeometricContext {
 	vec3 position;
 	vec3 normal;
 	vec3 viewDir;
 #ifdef USE_CLEARCOAT
 	vec3 clearcoatNormal;
 #endif
 };
 
 vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
 
 	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
 
 }
 
 vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
 
 	// dir can be either a direction vector or a normal vector
 	// upper-left 3x3 of matrix is assumed to be orthogonal
 
 	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
 
 }
 
 mat3 transposeMat3( const in mat3 m ) {
 
 	mat3 tmp;
 
 	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
 	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
 	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
 
 	return tmp;
 
 }
 
 // https://en.wikipedia.org/wiki/Relative_luminance
 float linearToRelativeLuminance( const in vec3 color ) {
 
 	vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
 
 	return dot( weights, color.rgb );
 
 }
 
 bool isPerspectiveMatrix( mat4 m ) {
 
 	return m[ 2 ][ 3 ] == - 1.0;
 
 }
 
 vec2 equirectUv( in vec3 dir ) {
 
 	// dir is assumed to be unit length
 
 	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
 
 	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
 
 	return vec2( u, v );
 
 }
 
 
 #ifdef USE_UV
 
 	#ifdef UVS_VERTEX_ONLY
 
 		vec2 vUv;
 
 	#else
 
 		varying vec2 vUv;
 
 	#endif
 
 	uniform mat3 uvTransform;
 
 #endif
 
 
 #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
 
 	attribute vec2 uv2;
 	varying vec2 vUv2;
 
 	uniform mat3 uv2Transform;
 
 #endif
 
 
 #ifdef USE_DISPLACEMENTMAP
 
 	uniform sampler2D displacementMap;
 	uniform float displacementScale;
 	uniform float displacementBias;
 
 #endif
 
 
 #ifdef USE_ENVMAP
 
 	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
 
 		#define ENV_WORLDPOS
 
 	#endif
 
 	#ifdef ENV_WORLDPOS
 		
 		varying vec3 vWorldPosition;
 
 	#else
 
 		varying vec3 vReflect;
 		uniform float refractionRatio;
 
 	#endif
 
 #endif
 
 
 #if defined( USE_COLOR_ALPHA )
 
 	varying vec4 vColor;
 
 #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
 
 	varying vec3 vColor;
 
 #endif
 
 
 #ifdef USE_FOG
 
 	varying float vFogDepth;
 
 #endif
 
 
 #ifndef FLAT_SHADED
 
 	varying vec3 vNormal;
 
 	#ifdef USE_TANGENT
 
 		varying vec3 vTangent;
 		varying vec3 vBitangent;
 
 	#endif
 
 #endif
 
 
 #ifdef USE_MORPHTARGETS
 
 	uniform float morphTargetBaseInfluence;
 
 	#ifdef MORPHTARGETS_TEXTURE
 
 		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
 		uniform sampler2DArray morphTargetsTexture;
 		uniform vec2 morphTargetsTextureSize;
 
 		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {
 
 			float texelIndex = float( vertexIndex * stride + offset );
 			float y = floor( texelIndex / morphTargetsTextureSize.x );
 			float x = texelIndex - y * morphTargetsTextureSize.x;
 
 			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );
 			return texture( morphTargetsTexture, morphUV ).xyz;
 
 		}
 
 	#else
 
 		#ifndef USE_MORPHNORMALS
 
 			uniform float morphTargetInfluences[ 8 ];
 
 		#else
 
 			uniform float morphTargetInfluences[ 4 ];
 
 		#endif
 
 	#endif
 
 #endif
 
 
 #ifdef USE_SKINNING
 
 	uniform mat4 bindMatrix;
 	uniform mat4 bindMatrixInverse;
 
 	#ifdef BONE_TEXTURE
 
 		uniform highp sampler2D boneTexture;
 		uniform int boneTextureSize;
 
 		mat4 getBoneMatrix( const in float i ) {
 
 		#ifdef USE_INSTANCING
 			
 			int j = 4 * int(i);
 			vec4 v1 = texelFetch(boneTexture, ivec2( j, gl_InstanceID ), 0);
 			vec4 v2 = texelFetch(boneTexture, ivec2( j + 1, gl_InstanceID ), 0);
 			vec4 v3 = texelFetch(boneTexture, ivec2( j + 2, gl_InstanceID ), 0);
 			vec4 v4 = texelFetch(boneTexture, ivec2( j + 3, gl_InstanceID ), 0);
 			
 		#else
 
 			float j = i * 4.0;
 			float x = mod( j, float( boneTextureSize ) );
 			float y = floor( j / float( boneTextureSize ) );
 
 			float dx = 1.0 / float( boneTextureSize );
 			float dy = 1.0 / float( boneTextureSize );
 
 			y = dy * ( y + 0.5 );
 
 			vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
 			vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
 			vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
 			vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );
 
 		#endif
 		
 			mat4 bone = mat4( v1, v2, v3, v4 );
 
 			return bone;
 
 		}
 
 	#else
 
 		uniform mat4 boneMatrices[ MAX_BONES ];
 
 		mat4 getBoneMatrix( const in float i ) {
 
 			mat4 bone = boneMatrices[ int(i) ];
 			return bone;
 
 		}
 
 	#endif
 
 #endif
 
 
 #ifdef USE_SHADOWMAP
 
 	#if 1 > 0
 
 		uniform mat4 directionalShadowMatrix[ 1 ];
 		varying vec4 vDirectionalShadowCoord[ 1 ];
 
 		struct DirectionalLightShadow {
 			float shadowBias;
 			float shadowNormalBias;
 			float shadowRadius;
 			vec2 shadowMapSize;
 		};
 
 		uniform DirectionalLightShadow directionalLightShadows[ 1 ];
 
 	#endif
 
 	#if 0 > 0
 
 		uniform mat4 spotShadowMatrix[ 0 ];
 		varying vec4 vSpotShadowCoord[ 0 ];
 
 		struct SpotLightShadow {
 			float shadowBias;
 			float shadowNormalBias;
 			float shadowRadius;
 			vec2 shadowMapSize;
 		};
 
 		uniform SpotLightShadow spotLightShadows[ 0 ];
 
 	#endif
 
 	#if 0 > 0
 
 		uniform mat4 pointShadowMatrix[ 0 ];
 		varying vec4 vPointShadowCoord[ 0 ];
 
 		struct PointLightShadow {
 			float shadowBias;
 			float shadowNormalBias;
 			float shadowRadius;
 			vec2 shadowMapSize;
 			float shadowCameraNear;
 			float shadowCameraFar;
 		};
 
 		uniform PointLightShadow pointLightShadows[ 0 ];
 
 	#endif
 
 	/*
 	#if 0 > 0
 
 		// TODO (abelnation): uniforms for area light shadows
 
 	#endif
 	*/
 
 #endif
 
 
 #ifdef USE_LOGDEPTHBUF
 
 	#ifdef USE_LOGDEPTHBUF_EXT
 
 		varying float vFragDepth;
 		varying float vIsPerspective;
 
 	#else
 
 		uniform float logDepthBufFC;
 
 	#endif
 
 #endif
 
 
 #if 0 > 0
 
 	varying vec3 vClipPosition;
 
 #endif
 
varying vec3 vCustomWorldPosition;
 
 
 void main() {
 
 
 #ifdef USE_UV
 
 	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
 
 #endif
 
 
 #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
 
 	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
 
 #endif
 
 
 #if defined( USE_COLOR_ALPHA )
 
 	vColor = vec4( 1.0 );
 
 #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
 
 	vColor = vec3( 1.0 );
 
 #endif
 
 #ifdef USE_COLOR
 
 	vColor *= color;
 
 #endif
 
 #ifdef USE_INSTANCING_COLOR
 
 	vColor.xyz *= instanceColor.xyz;
 
 #endif
 
 
 
 vec3 objectNormal = vec3( normal );
 
 #ifdef USE_TANGENT
 
 	vec3 objectTangent = vec3( tangent.xyz );
 
 #endif
 
 
 #ifdef USE_MORPHNORMALS
 
 	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
 	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)
 	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
 	objectNormal *= morphTargetBaseInfluence;
 
 	#ifdef MORPHTARGETS_TEXTURE
 
 		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
 
 			if ( morphTargetInfluences[ i ] > 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];
 
 		}
 
 	#else
 
 		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
 		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
 		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
 		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
 
 	#endif
 
 #endif
 
 
 #ifdef USE_SKINNING
 
 	mat4 boneMatX = getBoneMatrix( skinIndex.x );
 	mat4 boneMatY = getBoneMatrix( skinIndex.y );
 	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
 	mat4 boneMatW = getBoneMatrix( skinIndex.w );
 
 #endif
 
 
 #ifdef USE_SKINNING
 
 	mat4 skinMatrix = mat4( 0.0 );
 	skinMatrix += skinWeight.x * boneMatX;
 	skinMatrix += skinWeight.y * boneMatY;
 	skinMatrix += skinWeight.z * boneMatZ;
 	skinMatrix += skinWeight.w * boneMatW;
 	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
 
 	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
 
 	#ifdef USE_TANGENT
 
 		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
 
 	#endif
 
 #endif
 
 
 vec3 transformedNormal = objectNormal;
 
 #ifdef USE_INSTANCING
 
 	// this is in lieu of a per-instance normal-matrix
 	// shear transforms in the instance matrix are not supported
 
 	mat3 m = mat3( instanceMatrix );
 
 	transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
 
 	transformedNormal = m * transformedNormal;
 
 #endif
 
 transformedNormal = normalMatrix * transformedNormal;
 
 #ifdef FLIP_SIDED
 
 	transformedNormal = - transformedNormal;
 
 #endif
 
 #ifdef USE_TANGENT
 
 	vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
 
 	#ifdef FLIP_SIDED
 
 		transformedTangent = - transformedTangent;
 
 	#endif
 
 #endif
 
 
 #ifndef FLAT_SHADED // normal is computed with derivatives when FLAT_SHADED
 
 	vNormal = normalize( transformedNormal );
 
 	#ifdef USE_TANGENT
 
 		vTangent = normalize( transformedTangent );
 		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
 
 	#endif
 
 #endif
 
 
 
 vec3 transformed = vec3( position );
 
 
 #ifdef USE_MORPHTARGETS
 
 	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
 	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in position = sum((target - base) * influence)
 	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
 	transformed *= morphTargetBaseInfluence;
 
 	#ifdef MORPHTARGETS_TEXTURE
 
 		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
 
 			#ifndef USE_MORPHNORMALS
 
 				if ( morphTargetInfluences[ i ] > 0.0 ) transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];
 
 			#else
 
 				if ( morphTargetInfluences[ i ] > 0.0 ) transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];
 
 			#endif
 
 		}
 
 	#else
 
 		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
 		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
 		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
 		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
 
 		#ifndef USE_MORPHNORMALS
 
 			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
 			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
 			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
 			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
 
 		#endif
 
 	#endif
 
 #endif
 
 
 #ifdef USE_SKINNING
 
 	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
 
 	vec4 skinned = vec4( 0.0 );
 	skinned += boneMatX * skinVertex * skinWeight.x;
 	skinned += boneMatY * skinVertex * skinWeight.y;
 	skinned += boneMatZ * skinVertex * skinWeight.z;
 	skinned += boneMatW * skinVertex * skinWeight.w;
 
 	transformed = ( bindMatrixInverse * skinned ).xyz;
 
 #endif
 
 
 #ifdef USE_DISPLACEMENTMAP
 
 	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
 
 #endif
 
 
 vec4 mvPosition = vec4( transformed, 1.0 );
 
 #ifdef USE_INSTANCING
 
 	mvPosition = instanceMatrix * mvPosition;
 
 #endif
 
 mvPosition = modelViewMatrix * mvPosition;
 
 gl_Position = projectionMatrix * mvPosition;
 
 
 #ifdef USE_LOGDEPTHBUF
 
 	#ifdef USE_LOGDEPTHBUF_EXT
 
 		vFragDepth = 1.0 + gl_Position.w;
 		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
 
 	#else
 
 		if ( isPerspectiveMatrix( projectionMatrix ) ) {
 
 			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
 
 			gl_Position.z *= gl_Position.w;
 
 		}
 
 	#endif
 
 #endif
 
 
 #if 0 > 0
 
 	vClipPosition = - mvPosition.xyz;
 
 #endif
 
 
 	vViewPosition = - mvPosition.xyz;
 
 
 #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
 
 	vec4 worldPosition = vec4( transformed, 1.0 );
 
 	#ifdef USE_INSTANCING
 
 		worldPosition = instanceMatrix * worldPosition;
 
 	#endif
 
 	worldPosition = modelMatrix * worldPosition;
 
 #endif
 
 vCustomWorldPosition = worldPosition.xyz;
 
 #ifdef USE_ENVMAP
 
 	#ifdef ENV_WORLDPOS
 
 		vWorldPosition = worldPosition.xyz;
 
 	#else
 
 		vec3 cameraToVertex;
 
 		if ( isOrthographic ) {
 
 			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
 
 		} else {
 
 			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
 
 		}
 
 		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
 
 		#ifdef ENVMAP_MODE_REFLECTION
 
 			vReflect = reflect( cameraToVertex, worldNormal );
 
 		#else
 
 			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
 
 		#endif
 
 	#endif
 
 #endif
 
 
 #ifdef USE_SHADOWMAP
 
 	#if 1 > 0 || 0 > 0 || 0 > 0
 
 		// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
 		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
 		vec4 shadowWorldPosition;
 
 	#endif
 
 	#if 1 > 0
 
 	
 
 		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ 0 ].shadowNormalBias, 0 );
 		vDirectionalShadowCoord[ 0 ] = directionalShadowMatrix[ 0 ] * shadowWorldPosition;
 
 	
 
 	#endif
 
 	#if 0 > 0
 
 	
 
 	#endif
 
 	#if 0 > 0
 
 	
 
 	#endif
 
 	/*
 	#if 0 > 0
 
 		// TODO (abelnation): update vAreaShadowCoord with area light info
 
 	#endif
 	*/
 
 #endif
 
 
 #ifdef USE_FOG
 
 	vFogDepth = - mvPosition.z;
 
 #endif
 
 
 }

 `;