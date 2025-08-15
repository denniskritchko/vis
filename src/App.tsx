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
	const inputContainerRef = useRef<HTMLDivElement | null>(null)
	const cursorRef = useRef<HTMLDivElement | null>(null)

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
		camera.position.set(0, 0.6, 12)
		scene.background = new THREE.Color(0x000a0b)

		const controls = new OrbitControls(camera, canvasRef.current)
		controls.target.set(0, 0, 0)
		controls.rotateSpeed = 0.9
		controls.enableZoom = false
		controls.enableDamping = true
		controls.dampingFactor = 0.02
		controls.enabled = false

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

		// root group that will follow the mouse (parallax/tilt)
		const root = new THREE.Group()
		scene.add(root)

		// object -> 3D text "Vis" using same material
		const textureLoader = new THREE.TextureLoader()
		const objectMaterial = new THREE.MeshMatcapMaterial({
			color: 0xffffff,
			matcap: textureLoader.load(texture.matcap),
			map: textureLoader.load(texture.env),
		})
		// inject glow that reacts to the DOM input position (screen-space)
		let matcapGlowShader: any = null
		objectMaterial.onBeforeCompile = (shader: any) => {
			shader.uniforms.uGlowCenter = { value: new THREE.Vector2(0, 0) }
			shader.uniforms.uGlowRadius = { value: 0.2 }
			shader.uniforms.uGlowIntensity = { value: 0.9 }
			shader.uniforms.uGlowColor = { value: new THREE.Color(0x66e0ff) }

			shader.vertexShader = `
				varying vec2 vNdc;
				${shader.vertexShader}
			`.replace(
				'#include <project_vertex>',
				`#include <project_vertex>
				vNdc = gl_Position.xy / gl_Position.w;
				`
			)

			shader.fragmentShader = `
				uniform vec2 uGlowCenter;
				uniform float uGlowRadius;
				uniform float uGlowIntensity;
				uniform vec3 uGlowColor;
				varying vec2 vNdc;
				${shader.fragmentShader}
			`.replace(
				'#include <matcap_fragment>',
				`
				#ifdef USE_MATCAP
					vec3 viewDir = normalize( vViewPosition );
					vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
					vec3 y = cross( viewDir, x );
					vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.5 + 0.5;
					vec4 matcapColor = texture2D( matcap, uv );
					matcapColor = matcapTexelToLinear( matcapColor );
					#ifdef MATCAP_BLENDING_MULTIPLY
						outgoingLight = mix( outgoingLight, outgoingLight * matcapColor.rgb, matcapIntensity );
					#else
						outgoingLight = mix( outgoingLight, matcapColor.rgb, matcapIntensity );
					#endif
				#endif
				// screen-space glow add
				float glow = smoothstep( uGlowRadius, 0.0, distance( vNdc, uGlowCenter ) ) * uGlowIntensity;
				outgoingLight += uGlowColor * glow;
				`
			)

			matcapGlowShader = shader
		}

		// helpers to sample DOM input styles and convert to THREE.Color
		function extractColorFromShadow(shadow: string): string | null {
			if (!shadow) return null
			const regex = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/g
			let match: RegExpExecArray | null
			let best: { r: number; g: number; b: number; a: number } | null = null
			while ((match = regex.exec(shadow))) {
				const r = parseFloat(match[1])
				const g = parseFloat(match[2])
				const b = parseFloat(match[3])
				const a = match[4] !== undefined ? parseFloat(match[4]) : 1
				if (!best || a > best.a) best = { r, g, b, a }
			}
			if (best) return `rgb(${best.r}, ${best.g}, ${best.b})`
			return null
		}

		function cssColorToRgb(color: string): [number, number, number] {
			const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
			ctx.fillStyle = '#000'
			ctx.fillStyle = color
			const computed = ctx.fillStyle as string
			const m = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
			if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
			return [102, 224, 255] // fallback to #66e0ff
		}
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
				root.add(objectMesh)
				// show input overlay once object is ready
				if (inputContainerRef.current) inputContainerRef.current.style.display = 'block'
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
			root.add(cap)
			capsules.push(cap)
		}

		// panel removed

		function resize() {
			camera.aspect = window.innerWidth / window.innerHeight
			camera.updateProjectionMatrix()
			renderer.setSize(window.innerWidth, window.innerHeight)
		}

		// target rotations derived from mouse
		let targetRotX = 0
		let targetRotY = 0

		function render() {
			if (objectMesh) {
				objectMesh.rotation.y = -clock.getElapsedTime() * config.object.speed
				objectMesh.rotation.z = clock.getElapsedTime() * config.object.speed
				objectMesh.rotation.x = clock.getElapsedTime() * config.object.speed
				objectMesh.position.y = Math.sin(clock.getElapsedTime() * config.object.speed) * 0.2
				// position input centered under the 3D text in screen space using its bottom bound
				if (inputContainerRef.current) {
					const geom = objectMesh.geometry as THREE.BufferGeometry
					if (!geom.boundingBox) geom.computeBoundingBox()
					const bbox = geom.boundingBox!
					const bottomWorld = new THREE.Vector3(0, bbox.min.y, 0).applyMatrix4(objectMesh.matrixWorld)
					const screenPos = bottomWorld.clone().project(camera)
					const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth
					const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight
					const offsetPx = 16
					const el = inputContainerRef.current
					el.style.left = `${x}px`
					el.style.top = `${y + offsetPx}px`
					el.style.transform = 'translate(-50%, 0)'
					// update shader glow center from DOM input center
					if (matcapGlowShader) {
						const rect = el.getBoundingClientRect()
						const cx = rect.left + rect.width / 2
						const cy = rect.top + rect.height / 2
						const ndcX = (cx / window.innerWidth) * 2 - 1
						const ndcY = 1 - (cy / window.innerHeight) * 2
						matcapGlowShader.uniforms.uGlowCenter.value.set(ndcX, ndcY)
						// force white glow for mesh matcap
						matcapGlowShader.uniforms.uGlowColor.value.setRGB(1, 1, 1)
					}
				}
			}
			// ease root rotation toward target (follow cursor)
			root.rotation.x += (targetRotX - root.rotation.x) * 0.08
			root.rotation.y += (targetRotY - root.rotation.y) * 0.08
			// animate soft pulsing of glow radius with scene speed
			if (matcapGlowShader) {
				const t = clock.getElapsedTime()
				matcapGlowShader.uniforms.uGlowRadius.value = 0.18 + 0.04 * (0.5 + 0.5 * Math.sin(t * (0.5 + 2.0 * config.scene.speed)))
			}
			camera.lookAt(scene.position)
			camera.updateMatrixWorld()
			renderer.render(scene, camera)
			// controls disabled; no update needed
		}

		let raf = 0
		const loop = () => {
			render()
			raf = requestAnimationFrame(loop)
		}
		resize()
		loop()

		window.addEventListener('resize', resize)
		// cursor highlight handlers
		const onMouseMove = (e: MouseEvent) => {
			const el = cursorRef.current
			if (!el) return
			el.style.opacity = '1'
			el.style.left = `${e.clientX}px`
			el.style.top = `${e.clientY}px`
			el.style.transform = 'translate(-50%, -50%)'
			// set white glow for cursor highlight
			el.style.setProperty('--cursor-glow', 'rgba(255, 255, 255, 0.7)')
			// update target rotation from pointer position (NDC)
			const ndcX = (e.clientX / window.innerWidth) * 2 - 1
			const ndcY = 1 - (e.clientY / window.innerHeight) * 2
			const maxTiltX = 0.2 // radians
			const maxTiltY = 0.35 // radians
			targetRotX = -ndcY * maxTiltX
			targetRotY = ndcX * maxTiltY
			// adjust input glow intensity based on distance to cursor
			const inputEl = inputContainerRef.current?.querySelector('input') as HTMLInputElement | null
			if (inputEl && inputContainerRef.current) {
				const rect = inputEl.getBoundingClientRect()
				const cx = rect.left + rect.width / 2
				const cy = rect.top + rect.height / 2
				const dx = e.clientX - cx
				const dy = e.clientY - cy
				const dist = Math.sqrt(dx * dx + dy * dy)
				const maxDist = Math.hypot(window.innerWidth, window.innerHeight) * 0.25
				const t = Math.max(0, 1 - dist / maxDist)
				const a1 = 0.15 + 0.5 * t
				const a2 = 0.10 + 0.45 * t
				inputEl.style.setProperty('--glow-a1', String(a1))
				inputEl.style.setProperty('--glow-a2', String(a2))
			}
		}
		const onMouseLeave = () => {
			const el = cursorRef.current
			if (!el) return
			el.style.opacity = '0'
		}
		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseleave', onMouseLeave)

		return () => {
			window.removeEventListener('resize', resize)
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseleave', onMouseLeave)
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
			<div ref={inputContainerRef} className="overlay-input">
				<input className="text-input" placeholder={"Let's get creative"} />
			</div>
			<div ref={cursorRef} className="cursor-highlight" />
			<div className="footer">
				<a href="" target="_blank" rel="noreferrer">
				</a>
			</div>
		</>
	)
}

