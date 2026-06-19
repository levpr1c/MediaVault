import * as THREE from 'three';

export function initHomeBg(opts) {
  opts = opts || {};
  var containerId = opts.containerId || 'hmBgCanvas';
  var container = opts.container || document.getElementById(containerId);
  if (!container || document.documentElement.getAttribute('data-no-effects') !== null) return;
  if (document.documentElement.getAttribute('data-three-bg') === '0') return;

  var w = window.innerWidth, h = window.innerHeight;

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, -1000, 1000);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  var pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  var SPACING = 14;
  var extent = Math.max(w, h) * 1.5;
  var cols = Math.ceil(extent * 2 / SPACING);
  var rows = Math.ceil(extent * 2 / SPACING);
  var NUM = cols * rows;
  var pos = new Float32Array(NUM * 3);
  var idx = 0;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      pos[idx*3] = c * SPACING - extent;
      pos[idx*3+1] = r * SPACING - extent;
      pos[idx*3+2] = 0;
      idx++;
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  var vertexShader = [
    'uniform float u_time;uniform float u_pixel_ratio;uniform float u_hover;uniform float u_warning;uniform float u_dark;uniform vec3 u_accent;',
    'varying float v_value;varying vec3 v_color;',
    'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}',
    'float snoise(vec3 v){',
    'const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);',
    'vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
    'vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;',
    'vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
    'vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
    'i=mod289(i);',
    'vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));',
    'float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
    'vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);',
    'vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;',
    'vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
    'vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));',
    'vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    'vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
    'vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    'p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    'vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);',
    'm=m*m;return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',
    'void main(){',
    'vec3 p=position;float t=u_time*.0003;',
    'float n1=snoise(vec3(p.x*.0015,p.y*.0015,t));',
    'float n2=snoise(vec3(p.x*.003-t*.5,p.y*.003+t*.5,t*1.5));',
    'float v=(n1+n2*.5)*.66;v=v*.5+.5;v_value=smoothstep(.15,.85,v);',
    'float size=.5+v_value*12.;',
    'vec3 bc=mix(vec3(.0),vec3(.95),u_dark);if(u_warning>.5)bc=vec3(1.,.15,.15);',
    'v_color=mix(bc,u_accent,u_hover);',
    'gl_PointSize=size*u_pixel_ratio;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'varying float v_value;varying vec3 v_color;',
    'void main(){',
    'vec2 c=gl_PointCoord-.5;float dist=length(c);if(dist>.5)discard;',
    'float a=smoothstep(.5,.4,dist);float b=smoothstep(.05,.5,v_value);',
    'gl_FragColor=vec4(v_color*b,a*b);',
    '}'
  ].join('\n');

  var mat = new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_pixel_ratio: { value: pixelRatio },
      u_hover: { value: 0 },
      u_warning: { value: 0 },
      u_dark: { value: document.documentElement.getAttribute('data-theme') !== 'light' ? 1 : 0 },
      u_accent: { value: new THREE.Color(0.95, 0.95, 0.95) }
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false
  });

  var sys = new THREE.Points(geo, mat);
  sys.rotation.z = Math.PI / 6;
  scene.add(sys);

  var themeObs = new MutationObserver(function() {
    mat.uniforms.u_dark.value = document.documentElement.getAttribute('data-theme') !== 'light' ? 1 : 0;
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var fxObs = new MutationObserver(function() {
    container.style.display = document.documentElement.getAttribute('data-no-effects') !== null ? 'none' : '';
  });
  fxObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-no-effects'] });

  var bgObs = new MutationObserver(function() {
    container.style.display = document.documentElement.getAttribute('data-three-bg') === '0' ? 'none' : '';
  });
  bgObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-three-bg'] });

  function onResize() {
    var ww = window.innerWidth, hh = window.innerHeight;
    camera.left = -ww/2; camera.right = ww/2;
    camera.top = hh/2; camera.bottom = -hh/2;
    camera.updateProjectionMatrix();
    renderer.setSize(ww, hh);
  }
  window.addEventListener('resize', onResize);

  var running = true;
  function animate(time) {
    if (!running) return;
    requestAnimationFrame(animate);
    if (opts.beforeRender) opts.beforeRender(mat.uniforms);
    mat.uniforms.u_time.value = time;
    renderer.render(scene, camera);
  }
  window.addEventListener('beforeunload', function(){ running = false; });
  window.addEventListener('pageshow', function() {
    if (!running) { running = true; requestAnimationFrame(animate); }
  });

  animate(0);
}
