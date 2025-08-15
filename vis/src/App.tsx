import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Pane } from 'tweakpane'

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

export function App(): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const paneRef = useRef<Pane | null>(null)

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
		camera.position.set(0, -1.7, 5)
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

		// object
		const oGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.05)
		const textureLoader = new THREE.TextureLoader()
		const oMat = new THREE.MeshMatcapMaterial({
			color: 0xffffff,
			matcap: textureLoader.load(texture.matcap),
			map: textureLoader.load(texture.env),
		})

		const oMesh = new THREE.Mesh(oGeo, oMat)
		scene.add(oMesh)

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

		// panel
		const pane = new Pane({ title: 'Panel' })
		paneRef.current = pane
		const sn = pane.addFolder({ title: 'Scene' })
		sn.addBinding(config.scene, 'speed', { min: 0, max: 1, label: 'Speed' })
		const ob = pane.addFolder({ title: 'Object' })
		ob.addBinding(config.object, 'speed', { min: 0, max: 1, label: 'Speed' })

		function resize() {
			camera.aspect = window.innerWidth / window.innerHeight
			camera.updateProjectionMatrix()
			renderer.setSize(window.innerWidth, window.innerHeight)
		}

		function render() {
			scene.rotation.y = clock.getElapsedTime() * config.scene.speed
			oMesh.rotation.y = -clock.getElapsedTime() * config.object.speed
			oMesh.rotation.z = clock.getElapsedTime() * config.object.speed
			oMesh.rotation.x = clock.getElapsedTime() * config.object.speed
			oMesh.position.y = Math.sin(clock.getElapsedTime() * config.object.speed) * 0.2
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
			pane.dispose()
			controls.dispose()
			renderer.dispose()
			oGeo.dispose()
			oMat.dispose()
			capsules.forEach((m) => m.geometry.dispose())
		}
	}, [])

	return (
		<>
			<canvas ref={canvasRef} className="three-canvas" />
			<div className="footer">
				<a href="https://www.instagram.com/victorvergara.co/" target="_blank" rel="noreferrer">
					<img src="https://victorvergara.co/logo.svg" />
				</a>
			</div>
		</>
	)
}

