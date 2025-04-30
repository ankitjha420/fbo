// imports ->
import * as THREE from 'three'
import { OrbitControls, GLTFLoader, GLTF, GPUComputationRenderer } from 'three/examples/jsm/Addons.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import fragment from './shaders/frag.glsl?raw'
import fragmentSimulation from './shaders/fragmentSimulation.glsl?raw'
import vertex from './shaders/vert.glsl?raw'
import face from '/head.glb?url'

// constants ->
const device = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio
}
const WIDTH = 32

export class Sketch {
    canvas: HTMLCanvasElement
    renderer: THREE.WebGLRenderer
    camera: THREE.PerspectiveCamera
    gpuCompute?: GPUComputationRenderer
    scene: THREE.Scene
    clock: THREE.Clock
    time: number
    controls: OrbitControls
    stats?: Stats
    mesh?: THREE.Points
    material?: THREE.ShaderMaterial
    gltfLoader: GLTFLoader
    model?: THREE.Mesh
    isModel: boolean = false
    mouse: THREE.Vector2 = new THREE.Vector2(0, 0)
    mouseTarget: THREE.Vector2 = new THREE.Vector2(0, 0)
    dtPosition?: THREE.DataTexture
    positionVariable: any
    facePos?: THREE.TypedArray
    faceNum?: number
    geometry: THREE.BufferGeometry<THREE.NormalBufferAttributes> | undefined
    sphereGeometry?: THREE.IcosahedronGeometry

    constructor(canvas: HTMLCanvasElement) {
        this.time = 0

        this.canvas = canvas
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(
            35,
            device.width / device.height,
            0.01,
            1000
        )
        this.camera.position.set(0, 0, 10)
        this.scene.add(this.camera)

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        this.renderer.setSize(device.width, device.height)
        this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2))
        this.renderer.setClearColor(0xeeeeee, 1)

        this.controls = new OrbitControls(this.camera, canvas)
        this.gltfLoader = new GLTFLoader()
        this.clock = new THREE.Clock()
        document.getElementById('switch')?.addEventListener('click', this.handleSwitch.bind(this))

        this.initStats()
        this.gltfLoader.load(face, (gltf: GLTF) => {
            this.model = gltf.scene.children[0].children[0].children[0].children[0] as THREE.Mesh
            this.model.geometry.scale(0.025, 0.025, 0.025)
            this.model.geometry.rotateX(Math.PI / 2 * 3)
            this.model.geometry.rotateY(Math.PI / 2 * -3)

            this.facePos = this.model.geometry.attributes.position.array
            this.faceNum = this.facePos.length / 3

            this.init()
        })
    }

    init(): void {
        this.initGPGPU()
        this.addLights()
        this.addGeometry()
        this.resize()
        this.render()
    }

    addGeometry(): void {
        this.material = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            fragmentShader: fragment,
            vertexShader: vertex,
            uniforms: {
                time: { value: 0 },
                positionTexture: { value: null },
                resolution: {
                    value: new THREE.Vector2(device.width, device.height)
                },
            }
        })

        this.geometry = this.model?.geometry
        this.sphereGeometry = new THREE.IcosahedronGeometry(1.0, 64)
        this.mesh = new THREE.Points(this.sphereGeometry, this.material)
        this.scene.add(this.mesh)
    }

    render(): void {
        this.stats?.begin()
        this.time += 0.005

        this.positionVariable.material.uniforms['time'].value = this.time
        this.gpuCompute?.compute()

        this.controls.update()
        this.material!.uniforms.time.value = this.time
        this.material!.uniforms.positionTexture.value = this.gpuCompute
            ?.getCurrentRenderTarget(this.positionVariable).texture

        this.renderer.render(this.scene, this.camera)
        this.stats?.end()
        requestAnimationFrame(this.render.bind(this))
    }

    initGPGPU(): void {
        this.gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, this.renderer)
        this.dtPosition = this.gpuCompute.createTexture()
        this.fillPositions(this.dtPosition)
        this.positionVariable = this.gpuCompute.addVariable(
            'texturePosition',
            fragmentSimulation,
            this.dtPosition
        )

        this.positionVariable.wrapS = THREE.RepeatWrapping
        this.positionVariable.wrapT = THREE.RepeatWrapping
        this.positionVariable.material.uniforms['time'] = { value: 0 }

        const e = this.gpuCompute.init()
        if (e !== null) {
            console.error(e)
        }
    }

    fillPositions(texture: THREE.DataTexture): void {
        let arr: Float32Array = texture.image.data as Float32Array

        for (let i = 0; i < arr.length; i += 4) {
            let rand = Math.floor(Math.random() * this.faceNum!)
            let x: number = this.facePos![3 * rand]
            let y: number = this.facePos![3 * rand + 1]
            let z: number = this.facePos![3 * rand + 2]

            arr[i] = x
            arr[i + 1] = y
            arr[i + 2] = z
            arr[i + 3] = 1
        }
    }

    initStats(): void {
        this.stats = new Stats()
        this.stats.showPanel(0)
        this.stats.addPanel(new Stats.Panel('MB', '#f8f', '#212'))
        this.stats.dom.style.cssText = 'position:absolute;top:0;left:0;'
        document.body.appendChild(this.stats.dom)
    }

    addLights(): void {
        // const pointLight = new THREE.PointLight(0xffffff, 100)
        // pointLight.position.set(10, 10, 10)
        this.scene.add(new THREE.AmbientLight(new THREE.Color(1, 1, 1), 10))
        // this.scene.add(pointLight)
    }

    resize(): void {
        window.addEventListener('resize', this.onResize.bind(this))
    }

    handleSwitch(): void {
        this.mesh!.geometry = this.isModel ? this.sphereGeometry! : this.model!.geometry
        this.isModel = !this.isModel
    }

    onResize(): void {
        device.width = window.innerWidth
        device.height = window.innerHeight

        // this.camera.aspect = device.width / device.height
        this.camera.updateProjectionMatrix()

        this.renderer.setSize(device.width, device.height)
    }
}
