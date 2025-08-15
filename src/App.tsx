import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
 

const texture = {
	matcap:
		'https://images.unsplash.com/photo-1626908013943-df94de54984c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2673&q=80',
	skin:
		'https://images.unsplash.com/photo-1560780552-ba54683cb263?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80',
	env:
		'https://images.unsplash.com/photo-1536566482680-fca31930a0bd?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=987&q=80',
}

const config = {
	scene: { speed: 0.2 },
	object: { speed: 0 },
}

export function App(): React.ReactElement {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		if (!canvasRef.current) return

		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current,
			antialias: true,
			alpha: true,
		})
		const clock = new THREE.Clock()
		const scene = new THREE.Scene()
		const camera = new THREE.PerspectiveCamera(35)
		camera.position.set(0, -1.7, 10)
		scene.background = new THREE.Color(0x000a0b)

		const controls = new OrbitControls(camera, canvasRef.current)
		controls.target.set(0, 0, 0)
		controls.rotateSpeed = 0.9
		controls.enableZoom = false
		controls.enableDamping = true
		controls.dampingFactor = 0.02

		const axesHelper = new THREE.AxesHelper(2)
		axesHelper.position.y = -1.5
		// scene.add(axesHelper)

		renderer.shadowMap.enabled = true
		// @ts-expect-error - keep parity with original code spelling
		renderer.shadowMap.type = THREE.PCFShoftSHadowMap

		// lights: move primary light above the object and add subtle ambient
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
		scene.add(ambientLight)
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
		directionalLight.position.set(0, 5, 2)
		directionalLight.target.position.set(0, 0, 0)
		scene.add(directionalLight)
		scene.add(directionalLight.target)

		// object -> 3D text "Vis" using same material
		const textureLoader = new THREE.TextureLoader()
		const objectMaterial = new THREE.MeshMatcapMaterial({
			color: 0xffffff,
			matcap: textureLoader.load(texture.matcap),
			map: textureLoader.load(texture.env),
		})
		// keep matcap as-is (no shader rotation)
		let objectMesh: THREE.Mesh | null = null

		const fontLoader = new FontLoader()
		fontLoader.load(
			'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
			(font) => {
				const textOptions: any = {
					font,
					size: 1,
					height: 0.25,
					curveSegments: 12,
					bevelEnabled: true,
					bevelThickness: 0.03,
					bevelSize: 0.02,
					bevelOffset: 0,
					bevelSegments: 5,
				}
				const textGeometry = new TextGeometry('Vis', textOptions)
				textGeometry.center()
				objectMesh = new THREE.Mesh(textGeometry, objectMaterial)
				scene.add(objectMesh)
			}
		)

		// capsules
		const capsules: THREE.Mesh[] = []
		for (let i = 0; i <= 20; i++) {
			const cMat = new THREE.MeshBasicMaterial()
			const cGeo2 = new THREE.CapsuleGeometry(0.02, 0.5 + Math.random(), 5, 16)
			const cap = new THREE.Mesh(cGeo2, cMat)
			const amp = 1
			cap.position.y = -Math.random() * (amp / 2) + Math.random() * (amp / 2)
			cap.position.x = -Math.sin(i * 0.3) * Math.PI
			cap.position.z = -Math.cos(i * 0.3) * Math.PI
			scene.add(cap)
			capsules.push(cap)
		}

		// panel removed

		function resize() {
			camera.aspect = window.innerWidth / window.innerHeight
			camera.updateProjectionMatrix()
			renderer.setSize(window.innerWidth, window.innerHeight)
		}

		function render() {
			if (objectMesh) {
				objectMesh.rotation.y = -clock.getElapsedTime() * config.object.speed
				objectMesh.rotation.z = clock.getElapsedTime() * config.object.speed
				objectMesh.rotation.x = clock.getElapsedTime() * config.object.speed
				objectMesh.position.y = Math.sin(clock.getElapsedTime() * config.object.speed) * 0.2
			}
			camera.lookAt(scene.position)
			camera.updateMatrixWorld()
			renderer.render(scene, camera)
			controls.update()
		}

		let raf = 0
		const loop = () => {
			render()
			raf = requestAnimationFrame(loop)
		}
		resize()
		loop()

		window.addEventListener('resize', resize)

		return () => {
			window.removeEventListener('resize', resize)
			cancelAnimationFrame(raf)
			controls.dispose()
			renderer.dispose()
			if (objectMesh) objectMesh.geometry.dispose()
			objectMaterial.dispose()
			capsules.forEach((m) => m.geometry.dispose())
		}
	}, [])

	return (
		<>
			<canvas ref={canvasRef} className="three-canvas" />
			<div className="footer">
				<a href="" target="_blank" rel="noreferrer">
				</a>
			</div>
		</>
	)
}

