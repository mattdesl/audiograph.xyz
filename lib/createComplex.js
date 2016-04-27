const createSimplicialComplex = require('three-simplicial-complex')(THREE);
const unlerp = require('unlerp');

module.exports = function (complex, opt = {}) {
  const type = opt.type || 0;
  const geometry = createSimplicialComplex(complex);
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  
  const faceVertexUvs = [];
  const vertices = geometry.vertices;
  const faces = geometry.faces;
  
  
  const A = 'x';
  const B = type === 0 ? 'y' : 'z';
  const radial = type === 0;

  const minX = bbox.min[A];
  const maxX = bbox.max[A];
  const minZ = bbox.min[B];
  const maxZ = bbox.max[B];
  faces.forEach((face, i) => {
    const a = face.a;
    const b = face.b;
    const c = face.c;
    const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];

    faceVertexUvs.push([
      getUV(va),
      getUV(vb),
      getUV(vc)      
    ]);
  });
  geometry.faceVertexUvs[0] = faceVertexUvs;
  geometry.uvsNeedUpdate = true;
  geometry.dynamic = true;
  return geometry;
  
  function getUV (vert) {
    let u;
    
    if (radial) {
      let angle = Math.atan2(vert.z, vert.x);
      if (angle < 0) angle += 2 * Math.PI;
      u = angle / (Math.PI * 2);
    } else {
      u = minX === maxX ? 0 : unlerp(minX, maxX, vert[A]);
    }
    const v = minZ === maxZ ? 0 : unlerp(minZ, maxZ, vert[B]);
    return new THREE.Vector2(u, 1 - v);
  }
}