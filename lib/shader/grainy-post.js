const glslify = require('glslify');
module.exports = {
  uniforms: {
    tDiffuse: { type: 't', value: null },
    tLookup: { type: 't', value: null },
    iGlobalTime: { type: 'f', value: 0 },
    resolution: { type: 'v2', value: new THREE.Vector2() }
  },
  vertexShader: glslify(__dirname + '/14-post.vert'),
  fragmentShader: glslify(__dirname + '/14-post.frag')
};
