const fs = require('fs');

module.exports.createTexture = createTexture;
function createTexture (url, repeats = 1) {
  const textureLoader = new THREE.TextureLoader();
  return textureLoader.load(url, function (map) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    if (!Array.isArray(repeats)) {
      repeats = [ repeats, repeats ];
    }
    map.repeat.set(repeats[0], repeats[1]);      
  }, (err) => {
    console.error(err);
  });
}

module.exports.createPBRMaterial = createPBRMaterial;
function createPBRMaterial (opts = {}) {
  const material = new THREE.MeshPhysicalMaterial(opts);
  // material.shaderOverride = {
  //   vertexShader: fs.readFileSync(__dirname + '/shader/mesh.vert', 'utf8'),
  //   fragmentShader: fs.readFileSync(__dirname + '/shader/mesh.frag', 'utf8')
  // };
  // material.name = 'meshStandard';
  // material.extensions = {
  //   drawBuffers: true,
  //   derivatives: true
  // };
  return material;
}
