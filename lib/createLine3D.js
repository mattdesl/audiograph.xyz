const buffer = require('three-buffer-vertex-data');
const clamp = require('clamp');

module.exports = createLine3D;
function createLine3D (path) {
  const geometry = new THREE.BufferGeometry();

  geometry.update = update;
  if (path) update(path);

  return geometry;

  function update (path) {
    // ensure 3 component vectors
    if (path.length > 0 && path[0].length !== 3) {
      path = path.map(point => {
        let [x, y, z] = point;
        return [x || 0, y || 0, z || 0];
      });
    }

    // each pair has a mirrored direction
    const direction = duplicate(path.map(x => 1), true);

    // now get the positional data for each vertex
    const positions = duplicate(path);
    const previous = duplicate(path.map(relative(-1)));
    const next = duplicate(path.map(relative(+1)));
    const indexUint16 = createIndices(path.length - 1);

    // now update the buffers with float/short data
    buffer.index(geometry, indexUint16);
    buffer.attr(geometry, 'position', positions, 3);
    buffer.attr(geometry, 'previousPosition', previous, 3);
    buffer.attr(geometry, 'nextPosition', next, 3);
    buffer.attr(geometry, 'direction', direction, 1);
  }
}

function relative (offset) {
  return (point, index, list) => {
    index = clamp(index + offset, 0, list.length - 1);
    return list[index];
  };
}

function duplicate (nestedArray, mirror) {
  var out = [];
  nestedArray.forEach(x => {
    let x1 = mirror ? -x : x;
    out.push(x1, x);
  });
  return out;
}

// counter-clockwise indices but prepared for duplicate vertices
function createIndices (length) {
  let indices = new Uint16Array(length * 6);
  let c = 0;
  let index = 0;
  for (let j = 0; j < length; j++) {
    let i = index;
    indices[c++] = i + 0;
    indices[c++] = i + 1;
    indices[c++] = i + 2;
    indices[c++] = i + 2;
    indices[c++] = i + 1;
    indices[c++] = i + 3;
    index += 2;
  }
  return indices;
}
