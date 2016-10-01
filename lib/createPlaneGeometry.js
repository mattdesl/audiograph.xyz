const buffer = require('three-buffer-vertex-data');

module.exports = function () {
  const geometry = new THREE.BufferGeometry();
  const indices = [
    [ 0, 1, 2 ],
    [ 2, 3, 0 ]
  ];
  const positions = [
    [ 0, 0, 0 ],
    [ 0, 1, 0 ],
    [ 1, 1, 0 ],
    [ 1, 0, 0 ]
  ];
  const uvs = [
    [ 0, 1 ],
    [ 0, 0 ],
    [ 1, 0 ],
    [ 1, 1 ]
  ];
  buffer.attr(geometry, 'position', positions);
  buffer.attr(geometry, 'uv', uvs, 2);
  buffer.index(geometry, indices);
  return geometry;
};
