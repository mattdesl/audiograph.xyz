module.exports = class Audiograph extends THREE.Scene {

  constructor (opt = {}) {
    super();
    this.renderer = opt.renderer;

    // perspective camera
    const near = 0.01;
    const far = 100;
    const fieldOfView = 75;
    this.camera = new THREE.PerspectiveCamera(fieldOfView, 1, near, far);
    this.camera.position.set(0, 1, 0);
    this.camera.lookAt(new THREE.Vector3());

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({
      color: 'red'
    }));
    this.add(mesh);
  }

  resize (width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render () {
    this.renderer.render(this, this.camera);
  }
};
