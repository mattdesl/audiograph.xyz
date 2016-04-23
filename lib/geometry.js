// Simple 3D geometry
const data = require('three-buffer-vertex-data');

// Grab some mesh primitives
// https://www.npmjs.com/package/mesh-primitives
// https://www.stack.gl/packages
// const primitive = require('geo-chevron')({
//   width: 1,
//   depth: 1,
//   thickness: 0.5
// });

// Others to try
// const primitive = require('primitive-torus')();
// const primitive = require('primitive-cube')();
// const primitive = require('snowden');
const primitive = require('bunny');

module.exports = function (opt = {}) {
  // Set up our geometry
  const geometry = new THREE.BufferGeometry();

  // Sharing normals gives us a smooth look, splitting
  // them gives us a faceted look
  data.index(geometry, primitive.cells);
  data.attr(geometry, 'position', primitive.positions);

  // This is a ThreeJS utility to position the vertices
  // into world center [ 0, 0, 0 ]
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
};