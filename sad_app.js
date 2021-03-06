// WebGL - load obj - cube
// from https://webglfundamentals.org/webgl/webgl-load-obj-cube.html

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [];
  const objColors = [];

  // same order as `f` indices
  const objVertexData = [objPositions, objColors];

  // same order as `f` indices
  let webglVertexData = [
    [], // positions
    [], // colors
    [], // normals
  ];

  // function newGeometry() {
  //   // If there is an existing geometry and it's
  //   // not empty then start a new one.
  //   if (geometry && geometry.data.position.length) {
  //     geometry = undefined;
  //   }
  //   setGeometry();
  // }

  function getNormal(vert) {
    const ptn = vert.split("/");
    let objIndex = [parseInt(ptn[0]), parseInt(ptn[1]), parseInt(ptn[2])];
    let a = 0;
    let b = 0;
    let c = 0;
    if (objIndex[0] > 0 && objIndex[1] > 0 && objIndex[2] > 0) {
      a = objVertexData[0][objIndex[0] - 1];
      b = objVertexData[0][objIndex[1] - 1];
      c = objVertexData[0][objIndex[2] - 1];
    } else {
      a = objVertexData[0][objIndex[0]];
      b = objVertexData[0][objIndex[1]];
      c = objVertexData[0][objIndex[2]];
    }
    let cross = [];
    try {
      let diff1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      let diff2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

      cross.push(diff1[1] * diff2[2] - diff1[2] * diff2[1]);
      cross.push(diff1[2] * diff2[0] - diff1[0] * diff2[2]);
      cross.push(diff1[0] * diff2[1] - diff1[1] * diff2[0]);
    } catch (e) {
      console.log(objIndex);
      throw e;
    }
    webglVertexData[2].push(...cross);
  }

  function addVertex(vert) {
    const ptn = vert.split("/");
    //console.log(ptn);
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      //const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      //console.log(objIndexStr, i);
      try {
        if (objIndex > 0) {
          webglVertexData[0].push(...objVertexData[0][objIndex - 1]);
          webglVertexData[1].push(...objVertexData[1][objIndex - 1]);
        } else {
          webglVertexData[0].push(...objVertexData[0][objIndex]);
          webglVertexData[1].push(...objVertexData[1][objIndex]);
        }
      } catch (e) {
        console.log(objIndex, ptn, e);
        throw e;
      }
      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
    });
  }

  const keywords = {
    v(parts) {
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    f(parts) {
      addVertex(parts[0]);
      getNormal(parts[0]);

      // const numTriangles = parts.length - 2;
      // console.log(numTriangles);
      // for (let tri = 0; tri < numTriangles; ++tri) {
      //   addVertex(parts[0]);
      //   addVertex(parts[tri + 1]);
      //   addVertex(parts[tri + 2]);
      // }
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  console.log(webglVertexData);

  return {
    position: webglVertexData[0],
    color: webglVertexData[1],
  };
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  const vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;

  varying vec3 v_normal;
  varying vec4 v_color;

  void main() {
    gl_Position = u_projection * u_view * u_world * a_position;
    v_normal = mat3(u_world) * a_normal;
    v_color = a_color;
  }
  `;

  const fs = `
  precision mediump float;

  varying vec3 v_normal;
  varying vec4 v_color;

  uniform vec4 u_diffuse;
  uniform vec3 u_lightDirection;

  void main () {
    vec3 normal = normalize(v_normal);
    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    vec4 diffuse = u_diffuse * v_color;
    gl_FragColor = vec4(diffuse.rgb * fakeLight, diffuse.a);
  }
  `;

  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);

  const response = await fetch("http://0.0.0.0:8000/new.obj");
  const text = await response.text();
  const data = parseOBJ(text);
  // Because data is just named arrays like this
  //
  // {
  //   position: [...],
  //   texcoord: [...],
  //   normal: [...],
  // }
  //
  // and because those names match the attributes in our vertex
  // shader we can pass it directly into `createBufferInfoFromArrays`
  // from the article "less code more fun".

  // create a buffer for each array by calling
  // gl.createBuffer, gl.bindBuffer, gl.bufferData
  const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
  console.log(bufferInfo);

  const cameraTarget = [0, 0, 0];
  const cameraPosition = [0, 0, 4];
  const zNear = 0.1;
  const zFar = 50;

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function render(time) {
    time *= 0.001; // convert to seconds

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
    };

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

    // calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
    webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);

    // calls gl.uniform
    webglUtils.setUniforms(meshProgramInfo, {
      u_world: m4.yRotation(time),
      u_diffuse: [1, 0.7, 0.5, 1],
    });

    // calls gl.drawArrays or gl.drawElements
    webglUtils.drawBufferInfo(gl, bufferInfo);
  }
  requestAnimationFrame(render);
}

main();
