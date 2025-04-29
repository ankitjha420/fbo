// imports ->
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import fragment from './shaders/frag.glsl?raw'
import fragmentSimulation from './shaders/fragmentSimulation.glsl?raw'
import vertex from './shaders/vert.glsl?raw'
import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js'

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
    mouse: THREE.Vector2 = new THREE.Vector2(0, 0)
    mouseTarget: THREE.Vector2 = new THREE.Vector2(0, 0)
    dtPosition?: THREE.DataTexture
    positionVariable: any

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
        this.clock = new THREE.Clock()

        this.initStats()
        this.init()
    }

    init(): void {
        this.initGPGPU()
        this.addLights()
        this.addGeometry()
        this.resize()
        this.render()
    }

    addGeometry(): void {
        const plane = new THREE.BufferGeometry()
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

        let positions: Float32Array = new Float32Array(WIDTH * WIDTH * 3)
        let reference: Float32Array = new Float32Array(WIDTH * WIDTH * 2)
        for (let i = 0; i < WIDTH * WIDTH; i++) {
            let x: number = Math.random()
            let y: number = Math.random()
            let z: number = Math.random()

            let xx: number = (i % WIDTH) / WIDTH
            let yy: number = ~~(i / WIDTH) / WIDTH

            positions.set([x, y, z], i * 3)
            reference.set([xx, yy], i * 2)
        }

        plane.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        plane.setAttribute('reference', new THREE.BufferAttribute(reference, 2))

        this.mesh = new THREE.Points(plane, this.material)
        this.scene.add(this.mesh)
    }

    render(): void {
        this.stats?.begin()
        this.time += 0.005

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
            let x: number = Math.random()
            let y: number = Math.random()
            let z: number = Math.random()

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

    onResize(): void {
        device.width = window.innerWidth
        device.height = window.innerHeight

        // this.camera.aspect = device.width / device.height
        this.camera.updateProjectionMatrix()

        this.renderer.setSize(device.width, device.height)
    }
}
