// @observablehq/stdlib v3.9.0 Copyright 2021 Observable, Inc.
const e=new Map,t=[],n=t.map,r=t.some,o=t.hasOwnProperty,i="https://cdn.jsdelivr.net/npm/",a=/^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/,s=/^\d+\.\d+\.\d+(-[\w-.+]+)?$/,u=/\.[^/]*$/,l=["unpkg","jsdelivr","browser","main"];class RequireError extends Error{constructor(e){super(e)}}function c(e){const t=a.exec(e);return t&&{name:t[1],version:t[2],path:t[3]}}function f(t){const n=`${i}${t.name}${t.version?`@${t.version}`:""}/package.json`;let r=e.get(n);return r||e.set(n,r=fetch(n).then((t=>{if(!t.ok)throw new RequireError("unable to load package.json");return t.redirected&&!e.has(t.url)&&e.set(t.url,r),t.json()}))),r}RequireError.prototype.name=RequireError.name;var d=h((async function(e,t){if(e.startsWith(i)&&(e=e.substring(i.length)),/^(\w+:)|\/\//i.test(e))return e;if(/^[.]{0,2}\//i.test(e))return new URL(e,null==t?location:t).href;if(!e.length||/^[\s._]/.test(e)||/\s$/.test(e))throw new RequireError("illegal name");const n=c(e);if(!n)return`${i}${e}`;if(!n.version&&null!=t&&t.startsWith(i)){const e=await f(c(t.substring(i.length)));n.version=e.dependencies&&e.dependencies[n.name]||e.peerDependencies&&e.peerDependencies[n.name]}if(n.path&&!u.test(n.path)&&(n.path+=".js"),n.path&&n.version&&s.test(n.version))return`${i}${n.name}@${n.version}/${n.path}`;const r=await f(n);return`${i}${r.name}@${r.version}/${n.path||function(e){for(const t of l){const n=e[t];if("string"==typeof n)return u.test(n)?n:`${n}.js`}}(r)||"index.js"}`}));function h(e){const r=new Map,o=a(null);function i(e){if("string"!=typeof e)return e;let n=r.get(e);return n||r.set(e,n=new Promise(((n,r)=>{const o=p!==window.define,i=window.define,s=document.createElement("script");s.onload=()=>{try{n(t.pop()(a(e)))}catch(e){r(new RequireError("invalid module"))}s.remove(),o&&(window.define=i)},s.onerror=()=>{r(new RequireError("unable to load module")),s.remove(),o&&(window.define=i)},s.async=!0,s.src=e,window.define=p,document.head.appendChild(s)}))),n}function a(t){return n=>Promise.resolve(e(n,t)).then(i)}function s(e){return arguments.length>1?Promise.all(n.call(arguments,o)).then(m):o(e)}return s.alias=function(t){return h(((n,r)=>n in t&&(r=null,"string"!=typeof(n=t[n]))?n:e(n,r)))},s.resolve=e,s}function m(e){const t={};for(const n of e)for(const e in n)o.call(n,e)&&(null==n[e]?Object.defineProperty(t,e,{get:w(n,e)}):t[e]=n[e]);return t}function w(e,t){return()=>e[t]}function v(e){return"exports"===(e+="")||"module"===e}function p(e,o,i){const a=arguments.length;a<2?(i=e,o=[]):a<3&&(i=o,o="string"==typeof e?[]:e),t.push(r.call(o,v)?e=>{const t={},r={exports:t};return Promise.all(n.call(o,(n=>"exports"===(n+="")?t:"module"===n?r:e(n)))).then((e=>(i.apply(null,e),r.exports)))}:e=>Promise.all(n.call(o,e)).then((e=>"function"==typeof i?i.apply(null,e):i)))}function y(e,t,n){return{resolve:(r=n)=>`https://cdn.jsdelivr.net/npm/${e}@${t}/${r}`}}p.amd={};const g=y("d3","6.7.0","dist/d3.min.js"),b=y("d3-dsv","2.0.0","dist/d3-dsv.min.js"),x=y("@observablehq/inputs","0.8.0","dist/inputs.umd.min.js"),j=y("@observablehq/plot","0.1.0","dist/plot.umd.min.js"),E=y("@observablehq/graphviz","0.2.1","dist/graphviz.min.js"),P=y("@observablehq/highlight.js","2.0.0","highlight.min.js"),L=y("@observablehq/katex","0.11.1","dist/katex.min.js"),O=y("lodash","4.17.21","lodash.min.js"),$=y("htl","0.2.5","dist/htl.min.js"),R=y("marked","0.3.12","marked.min.js"),k=y("sql.js","1.5.0","dist/sql-wasm.js"),A=y("vega","5.20.2","build/vega.min.js"),N=y("vega-lite","5.1.0","build/vega-lite.min.js"),C=y("vega-lite-api","5.0.0","build/vega-lite-api.min.js"),q=y("apache-arrow","4.0.1","Arrow.es2015.min.js");async function U(e){return(await e(k.resolve()))({locateFile:e=>k.resolve(`dist/${e}`)})}class SQLiteDatabaseClient{constructor(e){Object.defineProperties(this,{_db:{value:e}})}static async open(e){const[t,n]=await Promise.all([U(d),Promise.resolve(e).then(M)]);return new SQLiteDatabaseClient(new t.Database(n))}async query(e,t){return await async function(e,t,n){const[r]=await e.exec(t,n);if(!r)return[];const{columns:o,values:i}=r,a=i.map((e=>Object.fromEntries(e.map(((e,t)=>[o[t],e])))));return a.columns=o,a}(this._db,e,t)}async queryRow(e,t){return(await this.query(e,t))[0]||null}async explain(e,t){return S("pre",{className:"observablehq--inspect"},[_((await this.query(`EXPLAIN QUERY PLAN ${e}`,t)).map((e=>e.detail)).join("\n"))])}async describe(e){const t=await(void 0===e?this.query("SELECT name FROM sqlite_master WHERE type = 'table'"):this.query("SELECT * FROM pragma_table_info(?)",[e]));if(!t.length)throw new Error("Not found");const{columns:n}=t;return S("table",{value:t},[S("thead",[S("tr",n.map((e=>S("th",[_(e)]))))]),S("tbody",t.map((e=>S("tr",n.map((t=>S("td",[_(e[t])])))))))])}}function M(e){return"string"==typeof e?fetch(e).then(M):e instanceof Response||e instanceof Blob?e.arrayBuffer().then(M):e instanceof ArrayBuffer?new Uint8Array(e):e}function S(e,t,n){2===arguments.length&&(n=t,t=void 0);const r=document.createElement(e);if(void 0!==t)for(const e in t)r[e]=t[e];if(void 0!==n)for(const e of n)r.appendChild(e);return r}function _(e){return document.createTextNode(e)}async function T(e){return await e("jszip@3.6.0/dist/jszip.min.js")}async function F(e){const t=await fetch(await e.url());if(!t.ok)throw new Error(`Unable to load file: ${e.name}`);return t}async function D(e,t,{array:n=!1,typed:r=!1}={}){const[o,i]=await Promise.all([e.text(),d(b.resolve())]);return("\t"===t?n?i.tsvParseRows:i.tsvParse:n?i.csvParseRows:i.csvParse)(o,r&&i.autoType)}class z{constructor(e){Object.defineProperty(this,"name",{value:e,enumerable:!0})}async blob(){return(await F(this)).blob()}async arrayBuffer(){return(await F(this)).arrayBuffer()}async text(){return(await F(this)).text()}async json(){return(await F(this)).json()}async stream(){return(await F(this)).body}async csv(e){return D(this,",",e)}async tsv(e){return D(this,"\t",e)}async image(){const e=await this.url();return new Promise(((t,n)=>{const r=new Image;new URL(e,document.baseURI).origin!==new URL(location).origin&&(r.crossOrigin="anonymous"),r.onload=()=>t(r),r.onerror=()=>n(new Error(`Unable to load file: ${this.name}`)),r.src=e}))}async arrow(){const[e,t]=await Promise.all([d(q.resolve()),F(this)]);return e.Table.from(t)}async sqlite(){return SQLiteDatabaseClient.open(F(this))}async zip(){const[e,t]=await Promise.all([T(d),this.arrayBuffer()]);return new ZipArchive(await e.loadAsync(t))}}class FileAttachment extends z{constructor(e,t){super(t),Object.defineProperty(this,"_url",{value:e})}async url(){return await this._url+""}}function B(e){throw new Error(`File not found: ${e}`)}function W(e){return Object.assign((t=>{const n=e(t+="");if(null==n)throw new Error(`File not found: ${t}`);return new FileAttachment(n,t)}),{prototype:FileAttachment.prototype})}class ZipArchive{constructor(e){Object.defineProperty(this,"_",{value:e}),this.filenames=Object.keys(e.files).filter((t=>!e.files[t].dir))}file(e){const t=this._.file(e+="");if(!t||t.dir)throw new Error(`file not found: ${e}`);return new ZipArchiveEntry(t)}}class ZipArchiveEntry extends z{constructor(e){super(e.name),Object.defineProperty(this,"_",{value:e}),Object.defineProperty(this,"_url",{writable:!0})}async url(){return this._url||(this._url=this.blob().then(URL.createObjectURL))}async blob(){return this._.async("blob")}async arrayBuffer(){return this._.async("arraybuffer")}async text(){return this._.async("text")}async json(){return JSON.parse(await this.text())}}var H={math:"http://www.w3.org/1998/Math/MathML",svg:"http://www.w3.org/2000/svg",xhtml:"http://www.w3.org/1999/xhtml",xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};var I=0;function Q(e){this.id=e,this.href=new URL(`#${e}`,location)+""}Q.prototype.toString=function(){return"url("+this.href+")"};var V={canvas:function(e,t){var n=document.createElement("canvas");return n.width=e,n.height=t,n},context2d:function(e,t,n){null==n&&(n=devicePixelRatio);var r=document.createElement("canvas");r.width=e*n,r.height=t*n,r.style.width=e+"px";var o=r.getContext("2d");return o.scale(n,n),o},download:function(e,t="untitled",n="Save"){const r=document.createElement("a"),o=r.appendChild(document.createElement("button"));async function i(){await new Promise(requestAnimationFrame),URL.revokeObjectURL(r.href),r.removeAttribute("href"),o.textContent=n,o.disabled=!1}return o.textContent=n,r.download=t,r.onclick=async t=>{if(o.disabled=!0,r.href)return i();o.textContent="Saving…";try{const t=await("function"==typeof e?e():e);o.textContent="Download",r.href=URL.createObjectURL(t)}catch(e){o.textContent=n}if(t.eventPhase)return i();o.disabled=!1},r},element:function(e,t){var n,r=e+="",o=r.indexOf(":");o>=0&&"xmlns"!==(r=e.slice(0,o))&&(e=e.slice(o+1));var i=H.hasOwnProperty(r)?document.createElementNS(H[r],e):document.createElement(e);if(t)for(var a in t)o=(r=a).indexOf(":"),n=t[a],o>=0&&"xmlns"!==(r=a.slice(0,o))&&(a=a.slice(o+1)),H.hasOwnProperty(r)?i.setAttributeNS(H[r],a,n):i.setAttribute(a,n);return i},input:function(e){var t=document.createElement("input");return null!=e&&(t.type=e),t},range:function(e,t,n){1===arguments.length&&(t=e,e=null);var r=document.createElement("input");return r.min=e=null==e?0:+e,r.max=t=null==t?1:+t,r.step=null==n?"any":n=+n,r.type="range",r},select:function(e){var t=document.createElement("select");return Array.prototype.forEach.call(e,(function(e){var n=document.createElement("option");n.value=n.textContent=e,t.appendChild(n)})),t},svg:function(e,t){var n=document.createElementNS("http://www.w3.org/2000/svg","svg");return n.setAttribute("viewBox",[0,0,e,t]),n.setAttribute("width",e),n.setAttribute("height",t),n},text:function(e){return document.createTextNode(e)},uid:function(e){return new Q("O-"+(null==e?"":e+"-")+ ++I)}};var X={buffer:function(e){return new Promise((function(t,n){var r=new FileReader;r.onload=function(){t(r.result)},r.onerror=n,r.readAsArrayBuffer(e)}))},text:function(e){return new Promise((function(t,n){var r=new FileReader;r.onload=function(){t(r.result)},r.onerror=n,r.readAsText(e)}))},url:function(e){return new Promise((function(t,n){var r=new FileReader;r.onload=function(){t(r.result)},r.onerror=n,r.readAsDataURL(e)}))}};function G(){return this}function J(e,t){let n=!1;if("function"!=typeof t)throw new Error("dispose is not a function");return{[Symbol.iterator]:G,next:()=>n?{done:!0}:(n=!0,{done:!1,value:e}),return:()=>(n=!0,t(e),{done:!0}),throw:()=>({done:n=!0})}}function Y(e){let t,n,r=!1;const o=e((function(e){n?(n(e),n=null):r=!0;return t=e}));if(null!=o&&"function"!=typeof o)throw new Error("function"==typeof o.then?"async initializers are not supported":"initializer returned something, but not a dispose function");return{[Symbol.iterator]:G,throw:()=>({done:!0}),return:()=>(null!=o&&o(),{done:!0}),next:function(){return{done:!1,value:r?(r=!1,Promise.resolve(t)):new Promise((e=>n=e))}}}}function K(e){switch(e.type){case"range":case"number":return e.valueAsNumber;case"date":return e.valueAsDate;case"checkbox":return e.checked;case"file":return e.multiple?e.files:e.files[0];case"select-multiple":return Array.from(e.selectedOptions,(e=>e.value));default:return e.value}}var Z={disposable:J,filter:function*(e,t){for(var n,r=-1;!(n=e.next()).done;)t(n.value,++r)&&(yield n.value)},input:function(e){return Y((function(t){var n=function(e){switch(e.type){case"button":case"submit":case"checkbox":return"click";case"file":return"change";default:return"input"}}(e),r=K(e);function o(){t(K(e))}return e.addEventListener(n,o),void 0!==r&&t(r),function(){e.removeEventListener(n,o)}}))},map:function*(e,t){for(var n,r=-1;!(n=e.next()).done;)yield t(n.value,++r)},observe:Y,queue:function(e){let t;const n=[],r=e((function(e){n.push(e),t&&(t(n.shift()),t=null);return e}));if(null!=r&&"function"!=typeof r)throw new Error("function"==typeof r.then?"async initializers are not supported":"initializer returned something, but not a dispose function");return{[Symbol.iterator]:G,throw:()=>({done:!0}),return:()=>(null!=r&&r(),{done:!0}),next:function(){return{done:!1,value:n.length?Promise.resolve(n.shift()):new Promise((e=>t=e))}}}},range:function*(e,t,n){e=+e,t=+t,n=(o=arguments.length)<2?(t=e,e=0,1):o<3?1:+n;for(var r=-1,o=0|Math.max(0,Math.ceil((t-e)/n));++r<o;)yield e+r*n},valueAt:function(e,t){if(!(!isFinite(t=+t)||t<0||t!=t|0))for(var n,r=-1;!(n=e.next()).done;)if(++r===t)return n.value},worker:function(e){const t=URL.createObjectURL(new Blob([e],{type:"text/javascript"})),n=new Worker(t);return J(n,(()=>{n.terminate(),URL.revokeObjectURL(t)}))}};function ee(e,t){return function(n){var r,o,i,a,s,u,l,c,f=n[0],d=[],h=null,m=-1;for(s=1,u=arguments.length;s<u;++s){if((r=arguments[s])instanceof Node)d[++m]=r,f+="\x3c!--o:"+m+"--\x3e";else if(Array.isArray(r)){for(l=0,c=r.length;l<c;++l)(o=r[l])instanceof Node?(null===h&&(d[++m]=h=document.createDocumentFragment(),f+="\x3c!--o:"+m+"--\x3e"),h.appendChild(o)):(h=null,f+=o);h=null}else f+=r;f+=n[s]}if(h=e(f),++m>0){for(i=new Array(m),a=document.createTreeWalker(h,NodeFilter.SHOW_COMMENT,null,!1);a.nextNode();)o=a.currentNode,/^o:/.test(o.nodeValue)&&(i[+o.nodeValue.slice(2)]=o);for(s=0;s<m;++s)(o=i[s])&&o.parentNode.replaceChild(d[s],o)}return 1===h.childNodes.length?h.removeChild(h.firstChild):11===h.nodeType?((o=t()).appendChild(h),o):h}}var te=ee((function(e){var t=document.createElement("template");return t.innerHTML=e.trim(),document.importNode(t.content,!0)}),(function(){return document.createElement("span")}));function ne(e){let t;Object.defineProperties(this,{generator:{value:Y((e=>{t=e}))},value:{get:()=>e,set:n=>t(e=n)}}),void 0!==e&&t(e)}function*re(){for(;;)yield Date.now()}var oe=new Map;function ie(e,t){var n;return(n=oe.get(e=+e))?n.then((()=>t)):(n=Date.now())>=e?Promise.resolve(t):function(e,t){var n=new Promise((function(n){oe.delete(t);var r=t-e;if(!(r>0))throw new Error("invalid time");if(r>2147483647)throw new Error("too long to wait");setTimeout(n,r)}));return oe.set(t,n),n}(n,e).then((()=>t))}var ae={delay:function(e,t){return new Promise((function(n){setTimeout((function(){n(t)}),e)}))},tick:function(e,t){return ie(Math.ceil((Date.now()+1)/e)*e,t)},when:ie};function se(e,t){if(/^(\w+:)|\/\//i.test(e))return e;if(/^[.]{0,2}\//i.test(e))return new URL(e,null==t?location:t).href;if(!e.length||/^[\s._]/.test(e)||/\s$/.test(e))throw new Error("illegal name");return"https://unpkg.com/"+e}function ue(e){return null==e?d:h(e)}var le=ee((function(e){var t=document.createElementNS("http://www.w3.org/2000/svg","g");return t.innerHTML=e.trim(),t}),(function(){return document.createElementNS("http://www.w3.org/2000/svg","g")})),ce=String.raw;function fe(){return Y((function(e){var t=e(document.body.clientWidth);function n(){var n=document.body.clientWidth;n!==t&&e(t=n)}return window.addEventListener("resize",n),function(){window.removeEventListener("resize",n)}}))}var de=Object.assign((function(e){const t=ue(e);var n;Object.defineProperties(this,(n={FileAttachment:()=>B,Arrow:()=>t(q.resolve()),Inputs:()=>t(x.resolve()),Mutable:()=>ne,Plot:()=>t(j.resolve()),SQLite:()=>U(t),SQLiteDatabaseClient:()=>SQLiteDatabaseClient,_:()=>t(O.resolve()),d3:()=>t(g.resolve()),dot:()=>t(E.resolve()),htl:()=>t($.resolve()),html:()=>te,md:()=>function(e){return e(R.resolve()).then((function(t){return ee((function(n){var r=document.createElement("div");r.innerHTML=t(n,{langPrefix:""}).trim();var o=r.querySelectorAll("pre code[class]");return o.length>0&&e(P.resolve()).then((function(t){o.forEach((function(n){function r(){t.highlightBlock(n),n.parentNode.classList.add("observablehq--md-pre")}t.getLanguage(n.className)?r():e(P.resolve("async-languages/index.js")).then((r=>{if(r.has(n.className))return e(P.resolve("async-languages/"+r.get(n.className))).then((e=>{t.registerLanguage(n.className,e)}))})).then(r,r)}))})),r}),(function(){return document.createElement("div")}))}))}(t),now:re,require:()=>t,resolve:()=>se,svg:()=>le,tex:()=>function(e){return Promise.all([e(L.resolve()),(t=L.resolve("dist/katex.min.css"),new Promise((function(e,n){var r=document.createElement("link");r.rel="stylesheet",r.href=t,r.onerror=n,r.onload=e,document.head.appendChild(r)})))]).then((function(e){var t=e[0],n=r();function r(e){return function(){var n=document.createElement("div");return t.render(ce.apply(String,arguments),n,e),n.removeChild(n.firstChild)}}return n.options=r,n.block=r({displayMode:!0}),n}));var t}(t),vl:()=>async function(e){const[t,n,r]=await Promise.all([A,N,C].map((t=>e(t.resolve()))));return r.register(t,n)}(t),width:fe,DOM:V,Files:X,Generators:Z,Promises:ae},Object.fromEntries(Object.entries(n).map(he))))}),{resolve:d.resolve});function he([e,t]){return[e,{value:t,writable:!0,enumerable:!0}]}export{W as FileAttachments,de as Library};
