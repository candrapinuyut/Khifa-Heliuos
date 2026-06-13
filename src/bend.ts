import * as THREE from 'three'

/** Live handle to a material's bend uniform (shared by reference with the
 *  compiled shader, so writing .value each frame just works). */
export interface BendUniform {
  value: number
}

/** Inject a cylindrical "paper bow" along the card's local x axis into a built-in
 *  material via onBeforeCompile — map/fog/opacity/brightness all keep working.
 *  All card materials share one program (customProgramCacheKey), each keeps its
 *  own uniform value.
 *
 *  z(x) = uBend · (0.55·x² + 0.12·x): the x² term bows the sheet against the
 *  airflow, the linear term flicks the trailing edge slightly harder. */
export function addBend(mat: THREE.Material): BendUniform {
  const uBend: BendUniform = { value: 0 }
  mat.onBeforeCompile = shader => {
    shader.uniforms.uBend = uBend
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBend;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
          'transformed.z += uBend * (0.55 * position.x * position.x + 0.12 * position.x);',
      )
  }
  mat.customProgramCacheKey = () => 'card-bend'
  return uBend
}
