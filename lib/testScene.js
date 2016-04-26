module.exports = function ({ renderer, camera, scene, envMap, loop }) {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshBasicMaterial({ color: 'red' });
  const mesh = new THREE.Mesh(geometry, material);
  
  renderer.setClearColor('gray', 1);
  scene.add(mesh);
};
