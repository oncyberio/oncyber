(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();const LA=32,Ga=Object.freeze({self:"",host:"",online:!1,members:[]}),hi=(n,e)=>typeof n=="string"?n.slice(0,e):"";function vf(n){const e=n;if(!e||typeof e!="object"||!Array.isArray(e.members))return Ga;const t=new Set,i=[];for(const a of e.members.slice(0,LA)){const o=hi(a==null?void 0:a.id,64);!o||t.has(o)||(t.add(o),i.push({id:o,session:hi(a==null?void 0:a.session,64),name:hi(a==null?void 0:a.name,24).trim()||"Player",pfp:hi(a==null?void 0:a.pfp,2048),avatarUrl:hi(a==null?void 0:a.avatarUrl,2048),seat:(a==null?void 0:a.seat)==="spectator"?"spectator":"player",state:(a==null?void 0:a.state)==="away"?"away":"here",order:Number.isFinite(a==null?void 0:a.order)?Number(a.order):i.length}))}i.sort((a,o)=>a.order-o.order||(a.id<o.id?-1:1));const r=hi(e.self,64),s=hi(e.host,64);return{self:t.has(r)?r:"",host:t.has(s)?s:"",online:e.online!==!1,members:i}}function DA(n,e){const t=[],i=new Map(((n==null?void 0:n.members)??[]).map(a=>[a.id,a])),r=new Map(e.members.map(a=>[a.id,a])),s=!!(n!=null&&n.self);n&&n.online!==e.online&&t.push({type:e.online?"online":"offline"});for(const a of(n==null?void 0:n.members)??[])r.has(a.id)||t.push({type:"left",member:a});for(const a of e.members){const o=i.get(a.id);o?(o.state==="here"&&a.state==="away"&&t.push({type:"dropped",member:a}),o.state==="away"&&a.state==="here"&&t.push({type:"returned",member:a}),o.seat==="spectator"&&a.seat==="player"&&t.push({type:"seat",member:a})):t.push({type:"arrived",member:a,late:s&&a.id!==e.self})}return(((n==null?void 0:n.host)??"")!==e.host||((n==null?void 0:n.self)??"")!==e.self)&&(e.host||n!=null&&n.host)&&t.push({type:"host",member:r.get(e.host)??null,self:!!e.host&&e.host===e.self}),t}const PA=(n,e)=>n.members.find(t=>t.id===e)??null;function UA(n,e){var t,i;return e.includes(n.host)&&((t=PA(n,n.host))==null?void 0:t.state)==="here"?n.host:((i=n.members.find(r=>r.state==="here"&&e.includes(r.id)))==null?void 0:i.id)??""}const NA=2,Ln="oncyber:game:",FA=n=>`${n}:`;function OA(n,e){if(typeof n!="string")return null;for(const t of[Ln])if(n.startsWith(t)&&/^[a-z][a-z-]{0,31}$/.test(n.slice(t.length)))return n.slice(t.length);return null}const kA=Object.freeze({arrival:Object.freeze({from:"direct",view:null}),trip:null}),bf=7,Ri=(n,e)=>typeof n=="string"?n.trim().slice(0,e):"",Su=n=>n&&[n.x,n.y,n.z].every(e=>typeof e=="number"&&Number.isFinite(e)&&Math.abs(e)<=1e3)?{x:n.x,y:n.y,z:n.z}:null;function xf(n){const e=Su(n==null?void 0:n.cameraOffset),t=Su(n==null?void 0:n.cameraTargetOffset);return!e||!t||typeof n.avatarRotation!="number"||!Number.isFinite(n.avatarRotation)||Math.abs(n.avatarRotation)>1e6||!(typeof n.fov=="number"&&n.fov>5&&n.fov<150)?null:{cameraOffset:e,cameraTargetOffset:t,avatarRotation:n.avatarRotation,avatarHeight:typeof n.avatarHeight=="number"&&n.avatarHeight>=.2&&n.avatarHeight<=10?n.avatarHeight:1.8,fov:n.fov,cameraMode:n.cameraMode==="first-person"?"first-person":"third-person"}}function Cu(n){if(!Array.isArray(n))return[];const e=new Set,t=[];for(const i of n.slice(0,32)){const r=Ri(i==null?void 0:i.id,64);!r||e.has(r)||t.length>=bf||(e.add(r),t.push({id:r,name:Ri(i==null?void 0:i.name,24)||"Player",pfp:Ri(i==null?void 0:i.pfp,2048),avatarUrl:Ri(i==null?void 0:i.avatarUrl,2048)}))}return t}function Rs(n){const e=Ri(n==null?void 0:n.id,96);if(!e)return null;const t=Cu(n.members),i=Cu(n.arrived),r=n.roster?vf(n.roster):null,s=Number.isInteger(n.size)?Math.max(2,Math.min(bf+1,n.size)):0;return{id:e,room:Ri(n.room,160),size:Math.max(s,t.length+1,i.length+1,2),members:t,self:Ri(n.self,64),arrived:i,roster:r!=null&&r.members.length?r:null}}function QA(n){var t;const e=((t=n==null?void 0:n.arrival)==null?void 0:t.from)==="lobby"?"lobby":"direct";return{arrival:{from:e,view:e==="lobby"?xf(n.arrival.view):null},trip:Rs(n==null?void 0:n.trip)}}const yf=Object.freeze({Escape:"menu",Enter:"chat",NumpadEnter:"chat",KeyM:"mute"}),$i=Object.freeze({key:"key",input:"input",muted:"muted",probe:"input-probe",state:"input-state"});function HA(n){const e=new Map;for(const[t,i]of Object.entries(n??{}))for(const r of(i==null?void 0:i.keyboard)??[])typeof r!="string"||Object.hasOwn(yf,r)||e.set(r,[...e.get(r)??[],t]);return e}const wu=/^[a-z][a-z0-9-]{0,23}$/;class GA{constructor(e={}){this.holds=new Map,this.listener=e}get paused(){return this.holds.size>0}get reason(){return this.holds.values().next().value??""}put(e,t){var r,s;const i=this.holds.size===0;this.holds.size>=16&&!this.holds.has(e)||(this.holds.set(e,t),i&&((s=(r=this.listener).paused)==null||s.call(r,t)))}drop(e){var t,i;this.holds.delete(e)&&!this.holds.size&&((i=(t=this.listener).resumed)==null||i.call(t))}hold(e){wu.test(e)&&!this.holds.has(e)&&this.put(e,e)}release(e){this.drop(e)}set(e,t="page"){e?this.put("@page",wu.test(t)?t:"page"):this.drop("@page")}}class VA{constructor(e){this.keys=new Map,this.down=new Map,this.delivered=0,this.keys=HA(e)}bound(e){return this.keys.has(e)}key(e,t){const i=[];for(const r of this.keys.get(e)??[]){const s=this.down.get(r)??new Set,a=s.size>0;t?s.add(e):s.delete(e),s.size?this.down.set(r,s):this.down.delete(r),a!==s.size>0&&i.push([r,t?1:0])}return this.delivered+=i.length,i}held(){return[...this.down.keys()]}releaseAll(){const e=this.held();return this.down.clear(),e}}const zA=32*1024*1024;function er(n,e=16384){const t=new Set;let i=0,r=0;const s=(o,l)=>{if(++i>4096)throw new Error("UI_MESSAGE_SIZE");if(l>8)throw new Error("UI_MESSAGE_DEPTH");if(typeof o=="string"){if(r+=o.length,r>e)throw new Error("UI_MESSAGE_SIZE");return o}if(o===null||typeof o=="boolean"||typeof o=="number"&&Number.isFinite(o))return o;if(!o||typeof o!="object"||t.has(o))throw new Error("UI_MESSAGE_INVALID");if(!Array.isArray(o)&&Object.getPrototypeOf(o)!==Object.prototype&&Object.getPrototypeOf(o)!==null)throw new Error("UI_MESSAGE_INVALID");t.add(o);const c=Object.entries(Object.getOwnPropertyDescriptors(o));if(c.length>1024)throw new Error("UI_MESSAGE_SIZE");const u=Array.isArray(o)?[]:{};for(const[h,d]of c)if(!(Array.isArray(o)&&h==="length")){if(r+=h.length,r>e)throw new Error("UI_MESSAGE_SIZE");if(["__proto__","constructor","prototype"].includes(h)||d.get||d.set)throw new Error("UI_MESSAGE_INVALID");u[h]=s(d.value,l+1)}return t.delete(o),u},a=s(n,0);if(new TextEncoder().encode(JSON.stringify(a)).length>e)throw new Error("UI_MESSAGE_SIZE");return a}class WA{constructor(e,t){this.phase="created",this.frames=0,this.lifetime=new AbortController,this.input=Object.create(null),this.deltas=Object.create(null),this.presses=new Set,this.saved=null,this.pending=Promise.resolve(),this.uiAt=-1/0,this.visit={arrival:"",trip:null},this.inputPaused=!1,this.options=t;for(const a of Object.keys(t.manifest.input))this.input[a]=this.deltas[a]=0;const i=new Set(t.manifest.capabilities),r=new Set(t.manifest.assets),s={identity:Object.freeze({...t.services.identity}),asset:(a,o)=>!i.has("assets")||!r.has(a)?Promise.reject(new Error("ASSET_NOT_DECLARED")):(this.assertLive(),t.services.asset(a,o)),avatar:(a,o)=>{if(!i.has("avatar")||typeof a!="string"||!a||a.length>2048)return Promise.reject(new Error("CAPABILITY_NOT_GRANTED"));if(!t.services.avatar)return Promise.reject(new Error("HOST_SERVICE_ADAPTER_REQUIRED"));try{this.assertLive()}catch(l){return Promise.reject(l)}return t.services.avatar(a,o).then(l=>{if(!(l instanceof ArrayBuffer))throw new Error("AVATAR_INVALID");if(l.byteLength>zA)throw new Error("AVATAR_TOO_LARGE");return l})},call:(a,o,l,c)=>!i.has(a)||!/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(o)?Promise.reject(new Error("CAPABILITY_NOT_GRANTED")):(this.assertLive(),t.services.call(a,o,er(l),c).then(u=>er(u)))};this.game=e({graphics:t.graphics,services:s,audio:t.audio,signal:this.lifetime.signal,ui:{publish:a=>{this.assertLive(),this.pendingUI=er(a)}},loading:{progress:(a,o)=>{var l;this.phase==="preparing"&&((l=t.onProgress)==null||l.call(t,a,o))}},input:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.input[a]}])))),deltas:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.deltas[a]}])))),pressed:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.presses.has(a)}]))))})}setInputPaused(e,t="page"){var i,r;this.inputPaused===e||this.phase==="disposed"||this.phase==="failed"||(this.inputPaused=e,this.clearInput(),(r=(i=this.game).inputPaused)==null||r.call(i,e,e?t:""))}assertLive(){if(this.lifetime.signal.aborted||this.phase==="disposed"||this.phase==="failed")throw new Error("RUNTIME_DISPOSED")}async bounded(e){this.assertLive();let t;const i=new Promise((r,s)=>{t=setTimeout(()=>{this.lifetime.abort(),s(new Error("RUNTIME_TIMEOUT"))},this.options.timeoutMs??3e4)});try{const r=await Promise.race([Promise.resolve().then(e),i]);return this.assertLive(),r}finally{clearTimeout(t)}}serial(e){const t=this.pending.then(e);return this.pending=t.catch(()=>{this.phase!=="disposed"&&(this.phase="failed")}),t}prepare(){return this.serial(async()=>{if(this.phase!=="created")throw new Error("RUNTIME_PHASE");this.phase="preparing",await this.bounded(()=>this.game.prepare()),this.phase="ready"})}enter(e){return this.serial(async()=>{var i;if(this.phase!=="ready")throw new Error("RUNTIME_PHASE");const t=JSON.parse(JSON.stringify(e));t.arrival&&(t.arrival=t.arrival.from==="lobby"?{from:"lobby",view:xf(t.arrival.view)}:{from:"direct",view:null}),t.trip!==void 0&&(t.trip=Rs(t.trip)),this.visit={arrival:((i=t.arrival)==null?void 0:i.from)??"",trip:t.trip??null},await this.bounded(()=>this.game.enter(t)),this.phase="entered"})}party(e){var t,i;this.assertLive(),!(this.phase!=="entered"&&this.phase!=="suspended")&&(this.visit.trip=Rs(e),(i=(t=this.game).party)==null||i.call(t,Rs(e)))}suspend(){return this.serial(async()=>{var e;if(this.phase!=="entered")throw new Error("RUNTIME_PHASE");this.phase="suspended",this.clearInput(),(e=this.options.audio)==null||e.suspend(),this.saved=er(await this.bounded(()=>this.game.suspend()),65536)})}restore(){return this.serial(async()=>{var e;if(this.phase!=="suspended")throw new Error("RUNTIME_PHASE");await this.bounded(()=>this.game.restore(er(this.saved,65536))),this.phase="entered",(e=this.options.audio)==null||e.restore()})}action(e,t=1){if(this.assertLive(),!Object.hasOwn(this.input,e)||!Number.isFinite(t)||Math.abs(t)>1)throw new Error("INPUT_ACTION_INVALID");this.phase==="entered"&&!this.inputPaused&&(t>0&&this.input[e]<=0&&this.presses.add(e),this.input[e]=t)}delta(e,t){if(this.assertLive(),!Object.hasOwn(this.deltas,e)||!Number.isFinite(t)||Math.abs(t)>1)throw new Error("INPUT_ACTION_INVALID");this.phase==="entered"&&!this.inputPaused&&(this.deltas[e]=Math.max(-64,Math.min(64,this.deltas[e]+t)))}clearInput(){for(const e of Object.keys(this.input))this.input[e]=this.deltas[e]=0;this.presses.clear()}tick(e){if(this.phase==="entered"){if(!Number.isFinite(e)||e<0)throw new Error("RUNTIME_DELTA_INVALID");try{this.game.update(Math.min(e,.1)),this.presses.clear();for(const i of Object.keys(this.deltas))this.deltas[i]=0;this.frames++;const t=(this.options.now??Date.now)();this.pendingUI!==void 0&&t-this.uiAt>=50&&(this.options.sendUI(this.pendingUI),this.pendingUI=void 0,this.uiAt=t)}catch(t){throw this.phase="failed",this.lifetime.abort(),t}}}inspect(){var i;const{arrival:e,trip:t}=this.visit;return er({...this.game.inspect(),...(i=this.options.audio)==null?void 0:i.inspect(),hostPhase:this.phase,hostFrames:this.frames,hostArrival:e,hostParty:(t==null?void 0:t.size)??0,hostPartyArrived:t?t.arrived.length+1:0,hostInputPaused:this.inputPaused})}dispose(){return this.stop?this.stop:(this.lifetime.abort(),this.clearInput(),this.phase="disposed",this.pendingUI=void 0,this.stop=this.pending.then(async()=>{let e;try{await Promise.race([Promise.resolve().then(()=>this.game.dispose()),new Promise((t,i)=>{e=setTimeout(()=>i(new Error("RUNTIME_DISPOSE_TIMEOUT")),this.options.timeoutMs??3e4)})])}finally{clearTimeout(e)}}),this.stop)}}async function qA(n,e,t,i=(r,s)=>n.action(r,s)){if(n.phase!=="entered")throw new Error("RUNTIME_NOT_READY");if(e.version!==1||!Array.isArray(e.steps)||e.steps.length<1||e.steps.length>128)throw new Error("SCENARIO_INVALID");for(const s of e.steps)if(s.type==="action")await i(s.action,s.value??1);else if(s.type==="wait"){if(!Number.isInteger(s.frames)||s.frames<1||s.frames>600)throw new Error("SCENARIO_INVALID");for(let a=0;a<s.frames;a++)n.tick(1/60),await t()}else if(s.type==="waitUntil"){if(typeof s.key!="string"||!Number.isInteger(s.maxFrames)||s.maxFrames<1||s.maxFrames>3600)throw new Error("SCENARIO_INVALID");let a=!1;for(let o=0;o<=s.maxFrames;o++){const l=n.inspect();if(l&&typeof l=="object"&&!Array.isArray(l)&&Object.hasOwn(l,s.key)&&l[s.key]===s.equals){a=!0;break}if(o===s.maxFrames)break;n.tick(1/60),await t()}if(!a)throw new Error(`SCENARIO_TIMEOUT:${s.key}`)}else if(s.type==="assert"){const a=n.inspect();if(!Object.hasOwn(a,s.key)||a[s.key]!==s.equals)throw new Error(`SCENARIO_ASSERT:${s.key}`)}else throw new Error("SCENARIO_INVALID");await n.suspend();const r=n.frames;if(n.tick(1),n.frames!==r)throw new Error("LIFECYCLE_SUSPEND_FAILED");if(await n.restore(),n.tick(1/60),await t(),n.phase!=="entered"||n.frames!==r+1)throw new Error("LIFECYCLE_RESTORE_FAILED")}const jA=.3,XA=(n,e)=>typeof n=="number"&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):e;function YA(n){var _,y;let e=1,t=!1,i=!1,r=!1,s=!1,a=!1,o=!1,l=0,c=!1;const u=new Set,h=(n==null?void 0:n.createGain())??null,d=(n==null?void 0:n.createGain())??null,f=((_=n==null?void 0:n.createAnalyser)==null?void 0:_.call(n))??null,g=((y=n==null?void 0:n.createAnalyser)==null?void 0:y.call(n))??null;n&&h&&d&&(h.connect(d),d.connect(n.destination),f&&g&&(f.fftSize=g.fftSize=2048,h.connect(f),d.connect(g)));const m=new Float32Array(2048),A=S=>{if(!S||(n==null?void 0:n.state)!=="running")return 0;S.getFloatTimeDomainData(m);let C=0;for(let v=0;v<m.length;v++)C=Math.max(C,Math.abs(m[v]));return Math.round(C*1e4)/1e4},p=()=>t||s?0:e*(i||r?jA:1),b=()=>u.forEach(S=>S()),M=S=>{!n||!d||(d.gain.cancelScheduledValues(n.currentTime),n.state!=="running"||S===0?d.gain.value=p():d.gain.setTargetAtTime(p(),n.currentTime,S))};M(0);const E=S=>(S??Promise.resolve()).then(()=>!0,()=>!1).then(C=>(b(),C));return{context:n,output:h,get muted(){return t},get volume(){return e},get audible(){return(n==null?void 0:n.state)==="running"&&p()>0},receive(S){if(!S||typeof S!="object"||c)return!1;const C=S,v=`${e}|${t}|${i}`,x=i||r;if(e=XA(C.volume,e),typeof C.muted=="boolean"&&(t=C.muted),typeof C.speaking=="boolean"&&(i=C.speaking),v!==`${e}|${t}|${i}`){const T=i||r;M(x&&!T?.35:T&&!x?.06:.02),b()}return C.gesture===!0&&this.unlock(),C.probe===!0},async unlock(){if(!n||c||(a=!0,s))return!1;if(n.state==="running")return!0;let S;try{S=n.resume()}catch{return!1}const C=await E(S);return M(0),C&&n.state==="running"},setTalking(S){if(c||r===(S===!0))return;const C=i||r;r=S===!0;const v=i||r;C!==v&&M(v?.06:.35),b()},suspend(){if(!(s||c)){if(s=!0,M(0),(n==null?void 0:n.state)==="running")try{E(n.suspend())}catch{}b()}},restore(){if(!(!s||c)){if(s=!1,M(0),a&&n)try{E(n.resume())}catch{}b()}},onChange(S){return u.add(S),()=>void u.delete(S)},inspect(){const S=A(f);return S>0&&(o=!0),{audioState:(n==null?void 0:n.state)??"none",audioRouted:o,audioBypass:l,audioMuted:t,audioVolume:e,audioDucked:(i||r)&&!t,audioSuspended:s,audioGain:d?Math.round(d.gain.value*1e3)/1e3:0,audioInput:S,audioLevel:A(g)}},reportBypass(){l++},dispose(){if(!c){c=!0,u.clear();for(const S of[h,d,f,g])try{S==null||S.disconnect()}catch{}n&&n.state!=="closed"&&n.close().catch(()=>{})}}}}const Tu="oncyber:sound";function KA(n){var p,b,M;const e=Ln,t=window.AudioContext||window.webkitAudioContext;let i=null;try{i=t?new t:null}catch{}const r=YA(i),s=window.parent!==window,a=(E,_)=>{s&&window.parent.postMessage({type:`${e}${E}`,..._},"*")},o=[],l=(E,_,y)=>{if(!E||typeof E[_]!="function")return;const S=E[_];E[_]=y(S),o.push(()=>{E[_]=S})};let c=!1;const u=E=>{r.reportBypass(),c||console.warn(`[oncyber] ${E} bypasses the game's sound output; connect it to audio.output`),c=!0},h=new WeakSet;l((p=window.AudioNode)==null?void 0:p.prototype,"connect",E=>function(..._){const y=window.AudioDestinationNode;return y&&_[0]instanceof y&&u("A node connected to a destination"),E.apply(this,_)}),l((b=window.AudioContext)==null?void 0:b.prototype,"createMediaElementSource",E=>function(_){return h.add(_),E.call(this,_)}),l((M=window.HTMLMediaElement)==null?void 0:M.prototype,"play",E=>function(){return!h.has(this)&&!this.muted&&this.volume>0&&u("A media element"),E.call(this)});const d=()=>a("audio-state",{state:r.inspect()}),f=E=>{var _;E.source!==window.parent||((_=E.data)==null?void 0:_.type)!==`${e}audio`||r.receive(E.data)&&d()},g=E=>{E.isTrusted&&r.unlock()},m=["pointerdown","pointerup","keydown","touchend"];s&&window.addEventListener("message",f);for(const E of m)window.addEventListener(E,g,{capture:!0,passive:!0});if(!s)try{r.receive(JSON.parse(localStorage.getItem(Tu)||"{}"))}catch{}a("audio",{hello:!0});const A=r.dispose;return Object.assign(r,{requestMuted(E){if(r.receive({muted:E}),a("audio",{muted:E}),!s)try{localStorage.setItem(Tu,JSON.stringify({volume:r.volume,muted:E}))}catch{}},dispose(){window.removeEventListener("message",f);for(const E of m)window.removeEventListener(E,g,{capture:!0});for(const E of o.splice(0))E();A()}})}const Ho="__oncyberGame";function JA(n){const e=globalThis,t=e[Ho]??(e[Ho]={});t.inspect=()=>JSON.parse(JSON.stringify(n()))}const ZA="oncyber:check-report";async function $A(n,e){const t=[];let i=await e();for(let a=0;a<n;a++){const o=await e();t.push(o-i),i=o}t.sort((a,o)=>a-o);const r=a=>t.length?t[Math.min(t.length-1,Math.floor(a*t.length))]:0,s=a=>Math.round(a*10)/10;return{count:t.length,medianMs:s(r(.5)),p95Ms:s(r(.95)),worstMs:s(t[t.length-1]??0)}}const Ru=n=>String((n==null?void 0:n.message)??n).slice(0,500);async function em(n){const{session:e,scenario:t,frame:i}=n,r=[{stage:"boot",status:e.phase==="entered"?"passed":"failed",ms:Math.round(n.bootMs)}];let s={count:0,medianMs:0,p95Ms:0,worstMs:0};const a=async(l,c)=>{const u=performance.now();try{await c(),r.push({stage:l,status:"passed",ms:Math.round(performance.now()-u)})}catch(h){r.push({stage:l,status:"failed",ms:Math.round(performance.now()-u),error:Ru(h)})}};r[0].status==="passed"&&(n.pauseHostClock(!0),await a("scenario",()=>qA(e,t,()=>i().then(()=>{}),n.act)),r[1].status==="passed"&&r.push({stage:"lifecycle",status:"passed",ms:0}),n.pauseHostClock(!1),await a("frames",async()=>{if(s=await $A(n.frames??180,i),e.phase!=="entered")throw new Error(`RUNTIME_${e.phase.toUpperCase()}`)}));let o=null;try{o=e.inspect()}catch(l){o={error:Ru(l)}}return{version:1,status:r.every(l=>l.status==="passed")?"passed":"failed",backend:n.backend,bootMs:Math.round(n.bootMs),stages:r,frames:s,inspect:o}}function tm(n){window.parent!==window&&window.parent.postMessage({type:ZA,report:n},"*"),window.__checkReport=n}const Va=n=>typeof n=="number"&&Number.isFinite(n),Bu=n=>!!n&&[n.x,n.y,n.z].every(e=>Va(e)&&Math.abs(e)<=1e3),Lu=n=>({x:n.x,y:n.y,z:n.z}),eo=(n,e)=>({x:n.x-e.x,y:n.y-e.y,z:n.z-e.z}),Mf=n=>Math.hypot(n.x,n.y,n.z);function If(n){const e=n;return!e||!Bu(e.cameraOffset)||!Bu(e.cameraTargetOffset)||!Va(e.avatarRotation)||Math.abs(e.avatarRotation)>1e6||!Va(e.avatarHeight)||e.avatarHeight<.2||e.avatarHeight>10||!Va(e.fov)||e.fov<=5||e.fov>=150?null:{cameraOffset:Lu(e.cameraOffset),cameraTargetOffset:Lu(e.cameraTargetOffset),avatarRotation:e.avatarRotation,avatarHeight:e.avatarHeight,fov:e.fov}}function nm(n){const{camera:e,avatar:t}=n,i=t.facing,r=t.yaw??(i&&Math.hypot(i.x,i.z)>1e-6?Math.atan2(-i.x,-i.z):0),s=If({cameraOffset:eo(e.position,t.feet),cameraTargetOffset:eo(e.target,t.feet),avatarRotation:r,avatarHeight:t.height,fov:e.fov});if(!s)throw new Error("DEPARTURE_VIEW_INVALID");return s}function im(n,e){const t=n.cameraOffset,i=eo(n.cameraTargetOffset,t),r=Mf(i);if(r<1e-6||!(e>0))return null;const s={x:i.x/r,y:i.y/r,z:i.z/r};let a={x:-s.z,y:0,z:s.x};const o=Math.hypot(a.x,a.z);a=o>1e-6?{x:a.x/o,y:0,z:a.z/o}:{x:1,y:0,z:0};const l={x:a.y*s.z-a.z*s.y,y:a.z*s.x-a.x*s.z,z:a.x*s.y-a.y*s.x},c=Math.tan(n.fov*Math.PI/360),u=f=>{const g=eo(f,t),m=g.x*s.x+g.y*s.y+g.z*s.z;return m<.05?null:{x:.5+(g.x*a.x+g.y*a.y+g.z*a.z)/(m*c*e)/2,y:.5-(g.x*l.x+g.y*l.y+g.z*l.z)/(m*c)/2}},h=u({x:0,y:0,z:0}),d=u({x:0,y:n.avatarHeight,z:0});return!h||!d?null:{x:(h.x+d.x)/2,top:d.y,bottom:h.y,height:h.y-d.y}}function rm(n,e=16/9){if(!n)return"DEPARTURE_VIEW_INVALID";if(Mf(n.cameraOffset)<.6)return"DEPARTURE_CAMERA_INSIDE_AVATAR";const t=im(n,e);return t?t.height<.08?"DEPARTURE_AVATAR_TOO_SMALL":t.top<-.02||t.bottom>1.02||t.x<.05||t.x>.95?"DEPARTURE_AVATAR_OFF_SCREEN":null:"DEPARTURE_AVATAR_BEHIND_CAMERA"}const sm=()=>new Promise(n=>{const e=globalThis;typeof e.requestAnimationFrame=="function"?e.requestAnimationFrame(n):setTimeout(n,16)});function am(n){const e=n.frame??sm;let t="playing",i=null;const r=async s=>{t="staging",n.post("departure-staging");let a=null;try{const o=await n.stage(s);i="camera"in o?nm(o):If(o),a=rm(i);for(let l=0;l<(n.settleFrames??2);l++)await e()}catch(o){i=null,a=String((o==null?void 0:o.message)??o).slice(0,120)}t="staged",n.post("departure-ready",a?{view:null,problem:a}:{view:i})};return{get phase(){return t},get view(){return i},leave(){t==="playing"&&(t="asked",n.post("exit"))},receive(s,a){return s!=="departure"?!1:(t==="staged"?n.post("departure-ready",{view:i}):t!=="staging"&&r((a==null?void 0:a.reason)==="party"?"party":"self"),!0)}}}const om="oncyber:check-input",lm="oncyber:check-input-done";function cm(n=location.search){const e=new URLSearchParams(n);if(!e.has("check"))return null;const t=e.get("check");return t==="phone"||t==="gamepad"?t:"desktop"}const Du=(n,e)=>e===0?(n??0)===0:n!==void 0&&Math.abs(n-e)<=.1;function um(n,e=cm(),t={}){if(e!=="phone"&&e!=="gamepad")return;const i=t.post??(c=>window.parent.postMessage(c,"*")),r=t.listen??(c=>{const u=h=>{h.source===window.parent&&c(h.data)};return window.addEventListener("message",u),()=>window.removeEventListener("message",u)}),s=t.wait??(()=>new Promise(c=>setTimeout(c,16))),a=Object.create(null),o=n.action.bind(n);n.action=(c,u=1)=>{o(c,u),a[c]=u};let l=0;return async(c,u)=>{const h=++l,d=await new Promise(f=>{const g=setTimeout(()=>{m(),f("DEVICE_DRIVER_TIMEOUT")},t.timeoutMs??15e3),m=r(A=>{(A==null?void 0:A.type)!==lm||A.id!==h||(clearTimeout(g),m(),f(typeof A.error=="string"&&A.error?A.error:null))});i({type:om,id:h,profile:e,action:c,value:u})});if(d)throw new Error(d);for(let f=0;f<60&&!Du(a[c],u);f++)await s();if(!Du(a[c],u))throw new Error(`DEVICE_INPUT_LOST:${c}`)}}const Pu={"stick-up":{axis:"y",sign:1},"stick-down":{axis:"y",sign:-1},"stick-left":{axis:"x",sign:-1},"stick-right":{axis:"x",sign:1},"stick-x":{axis:"x",sign:0},"stick-y":{axis:"y",sign:0}};function hm(n,e=""){return typeof n!="string"?null:Object.hasOwn(Pu,n)?{kind:"stick",...Pu[n]}:n==="button"?{kind:"button",label:Uu(e)}:n.startsWith("button:")?{kind:"button",label:n.slice(7).trim().slice(0,12)||Uu(e)}:null}const Uu=n=>n?n[0].toUpperCase()+n.slice(1,12):"",dm=["button-a","button-b","button-x","button-y","left-bumper","right-bumper","left-trigger","right-trigger","button-select","button-start","left-stick-press","right-stick-press","dpad-up","dpad-down","dpad-left","dpad-right"],fm={left:0,right:2};function pm(n){if(typeof n!="string")return null;const e=dm.indexOf(n);if(e>=0)return{kind:"button",index:e};const t=/^(left|right)-stick-(up|down|left|right|x|y)$/.exec(n);if(!t)return null;const i=["up","down","y"].includes(t[2]),r=t[2]==="up"||t[2]==="right"?1:t[2]==="down"||t[2]==="left"?-1:0;return{kind:"axis",index:fm[t[1]]+(i?1:0),sign:r,invert:i}}const Am=n=>(n==null?void 0:n.gamepad)===void 0?[]:Array.isArray(n.gamepad)?n.gamepad:[n.gamepad];function mm(n){const e={stick:[],buttons:[],custom:[]};for(const[t,i]of Object.entries(n??{})){if((i==null?void 0:i.touch)===void 0)continue;const r=hm(i.touch,t);r?r.kind==="stick"?e.stick.push({action:t,axis:r.axis,sign:r.sign}):e.buttons.push({action:t,label:r.label}):e.custom.push(t)}return e}const gm=n=>Math.round(n*1e3)/1e3,Sf=(n,e)=>gm(e===0?n:Math.max(0,n*e));function Nu(n,e,t){const i=Math.hypot(e,t);i>1&&(e/=i,t/=i);const r={};for(const s of n)r[s.action]=Sf(s.axis==="x"?e:t,s.sign);return r}function _m(n){const e=[];for(const[t,i]of Object.entries(n??{})){const r=Am(i).map(pm).filter(s=>s!==null);r.length&&e.push({action:t,sources:r})}return e}function Em(n,e,t=.2){const i=[0,2].map(s=>{const a=e.axes[s]??0,o=e.axes[s+1]??0,l=Math.hypot(a,o);if(!(l>t))return[0,0];const c=Math.min(1,(l-t)/(1-t))/l;return[a*c,o*c]}),r={};for(const{action:s,sources:a}of n){let o=0;for(const l of a){let c;if(l.kind==="button"){const u=e.buttons[l.index];c=u!=null&&u.pressed?1:0}else{const u=i[l.index>>1][l.index&1];c=Sf(l.invert?-u:u,l.sign)}Math.abs(c)>Math.abs(o)&&(o=c)}r[s]=o}return r}const tr=46,vm=`
:where(.oncyber-controls){position:fixed;inset:0;z-index:2147483000;pointer-events:none;
  font:700 15px/1 system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
:where(.oncyber-controls *){box-sizing:border-box;touch-action:none;-webkit-tap-highlight-color:transparent}
:where(.oncyber-controls [data-oncyber-stick]){position:absolute;pointer-events:auto;width:148px;height:148px;
  left:max(16px,env(safe-area-inset-left),calc(var(--oncyber-safe-left,0px) + 8px));
  bottom:max(20px,env(safe-area-inset-bottom),calc(var(--oncyber-safe-bottom,0px) + 8px));display:grid;place-items:center}
:where(.oncyber-controls [data-oncyber-stick-base]){width:120px;height:120px;border-radius:50%;display:grid;place-items:center;
  border:3px solid rgba(255,255,255,.7);background:rgba(20,22,30,.3)}
:where(.oncyber-controls [data-oncyber-stick-knob]){width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.92);
  box-shadow:0 2px 8px rgba(0,0,0,.35);will-change:transform}
:where(.oncyber-controls [data-oncyber-buttons]){position:absolute;
  right:max(16px,env(safe-area-inset-right),calc(var(--oncyber-safe-right,0px) + 8px));
  bottom:max(20px,env(safe-area-inset-bottom),calc(var(--oncyber-safe-bottom,0px) + 8px));display:flex;flex-flow:row-reverse wrap-reverse;align-items:flex-end;
  justify-content:flex-start;gap:10px;max-width:min(240px,calc(100vw - 196px))}
:where(.oncyber-controls [data-oncyber-action]){pointer-events:auto;appearance:none;margin:0;padding:0;width:64px;height:64px;
  border-radius:50%;border:3px solid rgba(255,255,255,.7);background:rgba(20,22,30,.45);color:#fff;font:inherit;
  font-size:14px;overflow:hidden}
:where(.oncyber-controls [data-oncyber-action]:first-child){width:84px;height:84px;font-size:17px}
:where(.oncyber-controls [data-oncyber-action][data-oncyber-down]){background:rgba(255,255,255,.85);color:#14161e;transform:scale(.94)}
`;function bm(n,e,t={}){const i=mm(e),r=_m(e),s=()=>(n.phase===void 0||n.phase==="entered")&&!n.inputPaused,a={touch:{},gamepad:{}},o=Object.create(null),l=(y,S)=>{var C;for(const[v,x]of Object.entries(S)){if(!s()&&x!==0){a[y][v]=0;continue}if((a[y][v]??0)!==x){a[y][v]=x;try{n.action(v,x)}catch{continue}o[v]={device:y,value:x,count:(((C=o[v])==null?void 0:C.count)??0)+1}}}},c=y=>l(y,Object.fromEntries(Object.keys(a[y]).map(S=>[S,0])));let u,h;const d=[],f=(y,S,C,v)=>{y.addEventListener(S,C,v),d.push(()=>y.removeEventListener(S,C,v))},g=()=>{if(!(u||!i.stick.length&&!i.buttons.length)){if(h=document.createElement("style"),h.textContent=vm,document.head.prepend(h),u=document.createElement("div"),u.className="oncyber-controls",u.setAttribute("data-oncyber-controls",""),f(u,"touchstart",y=>y.preventDefault(),{passive:!1}),f(u,"contextmenu",y=>y.preventDefault()),i.stick.length){const y=document.createElement("div"),S=document.createElement("div"),C=document.createElement("div");y.setAttribute("data-oncyber-stick",i.stick.map(N=>N.action).join(" ")),y.setAttribute("data-hud","control-stick"),S.setAttribute("data-oncyber-stick-base",""),C.setAttribute("data-oncyber-stick-knob",""),S.append(C),y.append(S),u.append(y);let v=null,x=0,T=0;const D=N=>{let Q=N.clientX-x,G=N.clientY-T;const X=Math.hypot(Q,G);X>tr&&(Q*=tr/X,G*=tr/X),C.style.transform=`translate(${Q}px,${G}px)`,l("touch",Nu(i.stick,Q/tr,-G/tr))},U=N=>{N.pointerId===v&&(v=null,C.style.transform="",y.removeAttribute("data-oncyber-down"),l("touch",Nu(i.stick,0,0)))};f(y,"pointerdown",N=>{if(v!==null)return;v=N.pointerId;const Q=S.getBoundingClientRect();x=Q.left+Q.width/2,T=Q.top+Q.height/2,y.setAttribute("data-oncyber-down","");try{y.setPointerCapture(N.pointerId)}catch{}D(N)}),f(y,"pointermove",N=>{N.pointerId===v&&D(N)});for(const N of["pointerup","pointercancel","lostpointercapture"])f(y,N,U)}if(i.buttons.length){const y=document.createElement("div");y.setAttribute("data-oncyber-buttons","");for(const{action:S,label:C}of i.buttons){const v=document.createElement("button");v.type="button",v.tabIndex=-1,v.setAttribute("data-oncyber-action",S),v.setAttribute("data-hud",`control-${S}`),v.setAttribute("aria-label",C),v.textContent=C;const x=new Set;f(v,"pointerdown",D=>{x.add(D.pointerId),v.setAttribute("data-oncyber-down","");try{v.setPointerCapture(D.pointerId)}catch{}l("touch",{[S]:1})});const T=D=>{!x.delete(D.pointerId)||x.size||(v.removeAttribute("data-oncyber-down"),l("touch",{[S]:0}))};for(const D of["pointerup","pointercancel","lostpointercapture"])f(v,D,T);y.append(v)}u.append(y)}(t.root??document.body).append(u)}};typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches&&g();const m=y=>{y.pointerType==="touch"&&g()};window.addEventListener("pointerdown",m,{capture:!0,passive:!0});let A=0,p=!0,b=r.length>0&&typeof navigator<"u"&&"getGamepads"in navigator;const M=()=>{if(!p||!b)return;A=requestAnimationFrame(M);let y;try{y=navigator.getGamepads()}catch{b=!1;return}const S={};for(const C of y)if(!(!C||C.connected===!1))for(const[v,x]of Object.entries(Em(r,C,t.deadZone)))(Math.abs(x)>Math.abs(S[v]??0)||!(v in S))&&(S[v]=x);Object.keys(S).length?l("gamepad",S):c("gamepad")};b&&(A=requestAnimationFrame(M));const E=()=>{a.touch={},a.gamepad={}};window.addEventListener("blur",E);const _={log:o,layout:i,pads:r.map(y=>y.action),reach:tr,showTouch:g};return window.__oncyberDevices=_,{showTouch:g,dispose(){p=!1,cancelAnimationFrame(A),window.removeEventListener("pointerdown",m,{capture:!0}),window.removeEventListener("blur",E);for(const y of d.splice(0))y();u==null||u.remove(),h==null||h.remove(),u=h=void 0,window.__oncyberDevices===_&&delete window.__oncyberDevices}}}const xm=2e4,Fu="ONCYBER_HEALTH_PROBE",ym=["prepare","enter","update","suspend","restore","dispose"],Mm=200,Im=10,Sm=30;function Ou(n,e){if(typeof n!="string"||!n)return"";const i=(n.split(/[?#]/)[0].split("/").pop()??"").replace(/[^\w.-]/g,"").slice(0,80);return i&&Number.isInteger(e)&&e>0?`${i}:${e}`:i}function Go(n,e,t){const i=n,r=typeof(i==null?void 0:i.name)=="string"&&i.name!=="Error"?`${i.name}: `:"",s=typeof(i==null?void 0:i.message)=="string"?i.message:typeof n=="string"?n:"unknown error";let a=Ou(e,t);if(!a&&typeof(i==null?void 0:i.stack)=="string"){const o=/(?:\(|@|at )([^\s()@]+?):(\d+):\d+\)?\s*$/m.exec(i.stack);o&&(a=Ou(o[1],Number(o[2])))}return{message:(r+s).replace(/\s+/g," ").trim().slice(0,Mm),where:a}}function Cm(n){const e=[...n].sort((r,s)=>r-s),t=r=>e.length?e[Math.min(e.length-1,Math.floor(r*e.length))]:0,i=r=>Math.round(r*10)/10;return{count:e.length,medianMs:i(t(.5)),p95Ms:i(t(.95))}}function wm(n=xm){let e=[],t=-1,i=-1;return{frame(r){if(t<0)return t=i=r,null;if(e.push(r-i),i=r,r-t<n)return null;const s=e.length>=Sm?Cm(e):null;return e=[],t=r,s},reset(){e=[],t=i=-1}}}function Tm(n={}){return Rm(n)}function Rm(n){var M,E;const e=n.target??globalThis,t=e.parent,i=n.post??(_=>{var y;t&&t!==e&&((y=t.postMessage)==null||y.call(t,_,"*"))}),r=n.game?`${n.game}:`:Ln,s=`${r}health`,a=new Set;let o=0,l=!1,c=0;const u=_=>{const y=`${_.kind}:${"stage"in _?_.stage:""}:${_.message}`;if(!(l||a.has(y)||o>=Im)){a.add(y),o++;try{i({type:s,..._})}catch{}}},h=(_,y)=>{ym.includes(_)&&u({kind:"stage",stage:_,...Go(y)})},d=_=>{var S;const y=(_==null?void 0:_.error)??(_==null?void 0:_.message);u({kind:"error",...Go(y,_==null?void 0:_.filename,_==null?void 0:_.lineno)}),(y==null?void 0:y.message)===Fu&&((S=_.preventDefault)==null||S.call(_))},f=_=>u({kind:"error",...Go(_==null?void 0:_.reason)}),g=/[?&]check\b/.test(((M=e.location)==null?void 0:M.search)??""),m=_=>{var y,S;g&&(_==null?void 0:_.source)===e.parent&&(((y=_==null?void 0:_.data)==null?void 0:y.type)===`${r}health-probe`||((S=_==null?void 0:_.data)==null?void 0:S.type)===`${Ln}health-probe`)&&(e.setTimeout??setTimeout)(()=>{throw new Error(Fu)},0)},A=wm(n.windowMs),p=_=>{var S;if(l)return;const y=(S=e.document)!=null&&S.hidden?null:A.frame(_);if(y)try{i({type:s,kind:"frames",...y})}catch{}c=e.requestAnimationFrame(p)},b=()=>A.reset();return e.addEventListener("error",d),e.addEventListener("unhandledrejection",f),e.addEventListener("message",m),(E=e.document)==null||E.addEventListener("visibilitychange",b),e.requestAnimationFrame&&(c=e.requestAnimationFrame(p)),{stageFailed:h,async stage(_,y){try{return await y()}catch(S){throw h(_,S),S}},dispose(){var _,y;l=!0,(_=e.cancelAnimationFrame)==null||_.call(e,c),e.removeEventListener("error",d),e.removeEventListener("unhandledrejection",f),e.removeEventListener("message",m),(y=e.document)==null||y.removeEventListener("visibilitychange",b)}}}const Bm=n=>{const e=n;return!!e&&typeof e.tagName=="string"&&(e.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))};function Lm(n){const e=n.window??window,t=n.document??e.document,i=n.prefix??`${n.game}:`,r=n.post??(p=>{e.parent!==e&&e.parent.postMessage(p,"*")}),s=new VA(n.input);let a=null,o=!1,l=!1;const c=()=>{for(const p of s.releaseAll())n.action(p,0)},u=new GA({paused(p){var b,M;c(),t.pointerLockElement&&(o=!0,(b=t.exitPointerLock)==null||b.call(t)),(M=n.paused)==null||M.call(n,p)},resumed(){var p;(p=n.resumed)==null||p.call(n)}}),h=p=>{if(Bm(p.target)||p.isComposing)return;const b=p.type==="keydown";if(Object.hasOwn(yf,p.code)){p.preventDefault(),b&&!p.repeat&&r({type:i+$i.key,code:p.code});return}if(!s.bound(p.code)||p.ctrlKey||p.metaKey||p.altKey){if(!b)for(const[M,E]of s.key(p.code,!1))n.action(M,E);return}if(p.preventDefault(),!(u.paused||b&&p.repeat))for(const[M,E]of s.key(p.code,b))n.action(M,E)},d=()=>c(),f=p=>{var E,_;if(p.source!==e.parent)return;const b=p.data,M=typeof(b==null?void 0:b.type)=="string"&&b.type.startsWith(i)?b.type.slice(i.length):"";if(M===$i.input)u.set(b.paused===!0,typeof b.reason=="string"?b.reason:"page");else if(M===$i.muted)(E=n.muted)==null||E.call(n,b.muted===!0);else if(M===$i.probe){let y=null;try{y=((_=n.probe)==null?void 0:_.call(n))??null}catch{}r({type:i+$i.state,paused:u.paused,reason:u.reason,held:s.held(),delivered:s.delivered,locked:!!t.pointerLockElement,probe:y})}},g=()=>{if(t.pointerLockElement)return;const p=o;o=!1,!p&&a&&!u.paused&&r({type:i+$i.key,code:"Escape"})},m=()=>{a&&!u.paused&&!t.pointerLockElement&&a.isConnected!==!1&&A(a)},A=p=>{var b;try{const M=(b=p.requestPointerLock)==null?void 0:b.call(p);M&&typeof M.catch=="function"&&M.catch(()=>{})}catch{}};return e.addEventListener("keydown",h),e.addEventListener("keyup",h),e.addEventListener("blur",d),e.addEventListener("message",f),e.addEventListener("pointerdown",m),t.addEventListener("pointerlockchange",g),{get paused(){return u.paused},hold:p=>u.hold(p),release:p=>u.release(p),lockPointer(p){a=p,u.paused||A(p)},unlockPointer(){var p;a=null,t.pointerLockElement&&(o=!0,(p=t.exitPointerLock)==null||p.call(t))},dispose(){l||(l=!0,c(),e.removeEventListener("keydown",h),e.removeEventListener("keyup",h),e.removeEventListener("blur",d),e.removeEventListener("message",f),e.removeEventListener("pointerdown",m),t.removeEventListener("pointerlockchange",g))}}}function Dm(n,e){return Lm({probe:()=>n.inspect(),...e,action(t,i){n.phase==="entered"&&n.action(t,i)},paused(t){var i;n.setInputPaused(!0,t),(i=e.paused)==null||i.call(e,t)},resumed(){var t;n.setInputPaused(!1),(t=e.resumed)==null||t.call(e)}})}const ku=n=>{const e=t=>Number.isFinite(t)?Math.max(0,Math.round(t)):0;return{width:e(n==null?void 0:n.width),height:e(n==null?void 0:n.height)}};function Pm(n){const e=n.now??(()=>{var d,f;return((f=(d=globalThis.performance)==null?void 0:d.now)==null?void 0:f.call(d))??Date.now()}),t=n.minIntervalMs??100;let i=0,r=-1/0,s=-1,a="",o=0,l=null,c=0,u=null;const h={progress(d,f=""){if(l!==null||!Number.isFinite(d))return;i=Math.max(i,Math.min(1,Math.max(0,d)));const g=typeof f=="string"?f.slice(0,80):"",m=e();i===s&&g===a||i<1&&m-r<t||(r=m,s=i,a=g,o++,n.post("progress",{value:i,label:g}))},firstFrame(d){l===null&&(l=Math.max(0,Math.round(e())),u=ku(d),i=1,n.post("first-frame",{ms:l,...u}))},redrawn(d){const f=ku(d);l!==null&&(u&&u.width===f.width&&u.height===f.height||(u=f,c++,n.post("frame",{...f})))},report:()=>({progress:i,progressMessages:o,firstFrameMs:l,redraws:c,size:u&&{...u}})};return Cf("loading",h.report),h}function Um(n,e,t){const i=()=>{e(),n.redrawn({width:t.innerWidth,height:t.innerHeight})};return t.addEventListener("resize",i),()=>t.removeEventListener("resize",i)}function Cf(n,e){const t=globalThis;(t.__oncyberGame??(t.__oncyberGame={}))[n]=e}const ns=(n,e)=>typeof n=="string"?n.trim().slice(0,e):"";function Nm(n){const e=n.window??window,t=e.parent!==e,i=new Set(n.storageKeys),r=n.storageMax??256*1024,s=new Map,a={};let o=null,l=null,c=null,u="",h=!1,d=!t,f;const g={identity:[],enter:[]},m=(_,y)=>{var S;return(S=a[_])==null?void 0:S.forEach(C=>C(y))},A=(_,y={})=>{t&&e.parent.postMessage({type:Ln+_,...y},e.location.origin)},p=_=>{const y=JSON.stringify(c);c=_&&{..._,self:_.self||u},JSON.stringify(c)!==y&&m("party",c)},b=_=>{var C;if(_.source!==e.parent||_.origin!==e.location.origin)return;const y=OA((C=_.data)==null?void 0:C.type),S=_.data;if(y==="identity"){if(o={name:ns(S.name,24)||"You",pfp:ns(S.pfp,2048),avatarUrl:ns(S.avatarUrl,2048)},S.storage&&typeof S.storage=="object")for(const v of i)typeof S.storage[v]=="string"&&S.storage[v].length<=r&&s.set(v,S.storage[v]);clearInterval(f),g.identity.splice(0).forEach(v=>v(o)),h&&A("ready")}else y==="enter"?(l=QA(S),p(l.trip),g.enter.splice(0).forEach(v=>v({...l,trip:c}))):y==="party"?p(Rs(S.party)):y==="self"?(u=ns(S.id,64),m("self",u),c&&p({...c,self:u})):y==="peers"?m("peers",(Array.isArray(S.players)?S.players:[]).slice(0,32).filter(v=>v&&typeof v.id=="string"&&v.id).map(v=>({...v,id:v.id.slice(0,64),name:ns(v.name,24)||"Player"}))):y==="net"?typeof S.from=="string"&&m("net",{from:S.from.slice(0,64),data:S.data??null}):y==="entered"?(d=!0,m("revealed",void 0)):y==="departure"?m("departure",S.reason==="party"?"party":"self"):y==="dispose"&&m("dispose",void 0)};e.addEventListener("message",b);const M=()=>A("hello",{contract:NA,arrival:n.arrival??null,party:n.party??null}),E=_=>`${n.storageNamespace}:${_}`;return{embedded:t,get selfId(){return u},get trip(){return c},get revealed(){return d},on(_,y){(a[_]??(a[_]=[])).push(y)},hello(){if(M(),!t)return;let _=0;f=setInterval(()=>o||++_>40?clearInterval(f):M(),250)},identity(){return o?Promise.resolve(o):new Promise(_=>{g.identity.push(_),setTimeout(()=>{o||(o={name:"You",pfp:"",avatarUrl:""},g.identity.splice(0).forEach(y=>y(o)))},t?n.identityTimeoutMs:0)})},enterData(){return l?Promise.resolve({...l,trip:c}):t?new Promise(_=>g.enter.push(_)):Promise.resolve(kA)},ready(){h=!0,A("ready")},arrivalReady(){A("arrival-ready")},fail(_){A("error",{message:String(_).slice(0,200)})},exit(){A("exit")},post(_,y){A(_,y)},pose(_){A("pose",_)},net(_){A("net",{data:_})},storage:{get(_){if(!i.has(_))return null;if(t)return s.get(_)??null;try{return e.localStorage.getItem(E(_))}catch{return null}},set(_,y){if(!i.has(_)||typeof y!="string"||y.length>r)return!1;if(t)return s.set(_,y),A("storage",{key:_,value:y}),!0;try{return e.localStorage.setItem(E(_),y),!0}catch{return!1}}},dispose(){clearInterval(f),e.removeEventListener("message",b)}}}const Qu=30,Fm=1200,Om=32;function km(n){try{return JSON.stringify(n??null).length}catch{return 1/0}}function Qm(n){const e=n.now??(()=>performance.now()),t=1e3/Math.min(Qu,Math.max(1,n.rate??Qu)),i={sent:0,dropped:0,received:0,stale:0,limited:0},r=[],s=new Map;let a=null,o=0,l=0;function c(u,h,d){const f=[++o,u,h];return km(f)>Fm?(i.dropped++,!1):(n.post(f,d),i.sent++,!0)}return{stats:i,state(u){a={data:u}},event(u,h){r.push({data:u,to:h}),r.length>Om&&(r.shift(),i.dropped++)},pump(){const u=e();let h=0;for(l<u-t*2&&(l=u-t*2);l<=u&&(r.length||a);){const d=r.shift();d?c(1,d.data,d.to):(c(0,a.data),a=null),l+=t,h++}return h},flush(){let u=0;for(;r.length&&u<4;){const h=r.shift();c(1,h.data,h.to),l=Math.max(l,e())+t,u++}return u},receive(u,h){if(typeof u!="string"||!u||!Array.isArray(h))return null;const[d,f,g]=h;if(!Number.isInteger(d)||f!==0&&f!==1)return null;if(i.received++,f===0){if(d<=(s.get(u)??0))return i.stale++,null;s.set(u,d)}return{from:u,kind:f===0?"state":"event",seq:d,data:g}},forget(u){s.delete(u)},limited(u){i.limited+=Math.max(0,Math.floor(u)||0)}}}function Hm(n){if(!n||typeof n.id!="string"||!Array.isArray(n.members))return null;const e=n.members.slice(0,7).filter(t=>t&&typeof t.id=="string"&&t.id).map(t=>({id:t.id.slice(0,64),name:typeof t.name=="string"&&t.name.trim()?t.name.trim().slice(0,24):"Player"}));return e.length?{id:n.id.slice(0,96),size:e.length+1,members:e}:null}function Gm(n="",e=window){const t=[Ln,...n?[`${n}:`]:[]];let i=t[0];const r=e.parent,s=r!==e,a=new URLSearchParams(e.location.search).has("check"),o={},l=(m,...A)=>{for(const p of o[m]??[])p(...A)},c=(m,A)=>{s&&r.postMessage({type:i+m,...A},e.location.origin)},u=Qm({post:(m,A)=>c("match",A?{data:m,to:A}:{data:m})});let h=null;const d={embedded:s,party:null,roster:Ga,channel:u,on(m,A){return(o[m]??(o[m]=[])).push(A),()=>{const p=o[m],b=(p==null?void 0:p.indexOf(A))??-1;b>=0&&p.splice(b,1)}},report(m){h=m},dispose(){e.removeEventListener("message",g)}};function f(m){const A=Hm(m);JSON.stringify(A)!==JSON.stringify(d.party)&&(d.party=A,l("party",A));const p=A?vf(m.roster):Ga;if(JSON.stringify(p)===JSON.stringify(d.roster))return;const b=d.roster===Ga?null:d.roster,M=DA(b,p);d.roster=p;for(const E of M)(E.type==="returned"||E.type==="left")&&u.forget(E.member.id),l(E.type,E,p);l("roster",p,M)}function g(m){if(m.source!==r||m.origin!==e.location.origin)return;const A=m.data??{},p=typeof A.type=="string"?t.find(M=>A.type.startsWith(M)):void 0;if(!p)return;const b=A.type.slice(p.length);if(i=p,b==="enter")f(A.trip);else if(b==="party")f(A.party);else if(b==="match"){const M=u.receive(A.from,A.data);M&&l("match",M)}else if(b==="match-limit")u.limited(A.dropped);else if(b==="party-probe"){A.op==="choose"&&a&&typeof A.option=="string"&&l("choose",A.option);let M=null;try{M=(h==null?void 0:h())??null}catch{M=null}c("party-report",{id:A.id,report:M})}}return e.addEventListener("message",g),d}const wf=["hidden","menu","input"];function Vm(n){const e=n.now??(()=>{var m,A;return((A=(m=globalThis.performance)==null?void 0:m.now)==null?void 0:A.call(m))??Date.now()}),t=()=>typeof n.mode=="function"?n.mode():n.mode,i=new Set;let r=!1,s=0,a=0,o=0,l=0,c=null,u=null,h=!1;const d=()=>{var p;if(c===null)return;const m=e(),A=Math.max(0,(m-c)/1e3);c=m,A>0&&(l+=A,(p=n.catchUp)==null||p.call(n,A))},f=()=>{u==null||u(),u=null,c=null},g={get paused(){return r},hold(m){var A,p;!wf.includes(m)||i.has(m)||(i.add(m),!r&&(t()==="solo"?(f(),r=!0,s=e(),a++,n.pause(m)):m==="hidden"&&c===null&&(c=e(),u=((A=n.every)==null?void 0:A.call(n,d,1e3))??null,h=!0,(p=n.away)==null||p.call(n,!0))))},release(m){var A;i.delete(m)&&(m==="hidden"&&(d(),f(),h&&(h=!1,(A=n.away)==null||A.call(n,!1))),!(!r||i.size)&&(r=!1,o++,n.resume({reason:m,awayMs:Math.max(0,e()-s)})))},report:()=>{var m;return{mode:t(),paused:r,reasons:[...i],pauses:a,resumes:o,caughtUp:Math.round(l*1e3)/1e3,fingerprint:((m=n.fingerprint)==null?void 0:m.call(n))??null}},dispose(){f(),i.clear(),r=!1}};return Cf("pausing",g.report),g}function zm(n,e,t=.1,i=10){if(!Number.isFinite(n)||n<=0||!(t>0))return 0;const r=Math.min(n,i),s=Math.ceil(r/t-1e-9);for(let a=0;a<s;a++)e(a<s-1?t:r-t*(s-1));return r}function Wm(n,e){const{document:t,window:i}=e,r=[Ln,e.prefix].filter(Boolean),s=()=>t.hidden?n.hold("hidden"):n.release("hidden"),a=o=>{var c,u;if(o.source!==i.parent)return;const l=(c=o.data)==null?void 0:c.type;((u=o.data)==null?void 0:u.reason)==="menu"&&(r.some(h=>l===`${h}pause`)?n.hold("menu"):r.some(h=>l===`${h}resume`)&&n.release("menu"))};return t.addEventListener("visibilitychange",s),i.addEventListener("message",a),s(),()=>{t.removeEventListener("visibilitychange",s),i.removeEventListener("message",a),n.dispose()}}function qm(n,e){let t=Promise.resolve();const i=s=>{t=t.then(s).catch(a=>{var o;return(o=e.onError)==null?void 0:o.call(e,a)})};let r=null;return Vm({mode:e.mode,now:e.now,away:e.away,every:e.every??((s,a)=>{const o=setInterval(s,a);return()=>clearInterval(o)}),pause:()=>i(async()=>{var s;n.phase==="entered"&&await n.suspend(),(s=e.onChange)==null||s.call(e,!0)}),resume:()=>i(async()=>{var s;n.phase==="suspended"&&await n.restore(),(s=e.onChange)==null||s.call(e,!1)}),catchUp:s=>{var a;try{zm(s,o=>n.tick(o))}catch(o){(a=e.onError)==null||a.call(e,o)}},fingerprint:()=>{try{r=n.inspect()}catch{}return{frames:n.frames,inspect:r}}})}const Tf={match:/^[A-Za-z0-9_-]{6,64}$/,format:/^[a-z0-9][a-z0-9-]{0,31}$/,maxSeconds:1440*60,minTeams:2,maxTeams:8,maxPlayers:16,maxScore:1e9,idLength:64,nameLength:24},jm=["self","peer","cpu"],Vo=n=>!!n&&typeof n=="object"&&!Array.isArray(n),Hu=(n,e)=>typeof n=="string"&&n.trim()?n.trim().slice(0,e):"";function Xm(n){const e=l=>({ok:!1,error:l});if(!Vo(n))return e("RESULT_INVALID");const t=Tf;if(typeof n.match!="string"||!t.match.test(n.match))return e("RESULT_MATCH_ID");if(typeof n.format!="string"||!t.format.test(n.format))return e("RESULT_FORMAT");const i=n.durationSeconds;if(typeof i!="number"||!Number.isFinite(i)||i<0||i>t.maxSeconds)return e("RESULT_DURATION");if(!Array.isArray(n.teams)||n.teams.length<t.minTeams||n.teams.length>t.maxTeams)return e("RESULT_TEAMS");const r=[],s=new Set;let a=0;for(const l of n.teams){if(!Vo(l))return e("RESULT_TEAMS");if(typeof l.score!="number"||!Number.isFinite(l.score)||Math.abs(l.score)>t.maxScore)return e("RESULT_SCORE");if(!Array.isArray(l.players)||l.players.length<1)return e("RESULT_PLAYERS");const c=[];for(const h of l.players){if(!Vo(h))return e("RESULT_PLAYERS");const d=typeof h.id=="string"&&h.id.length<=t.idLength?h.id:"",f=Hu(h.name,t.nameLength);if(!d||!f||typeof h.kind!="string"||!jm.includes(h.kind))return e("RESULT_PLAYERS");if(s.has(d))return e("RESULT_PLAYER_REPEATED");s.add(d),h.kind==="self"&&a++,c.push({id:d,name:f,kind:h.kind})}const u=Hu(l.name,t.nameLength);r.push(u?{name:u,score:l.score,players:c}:{score:l.score,players:c})}if(s.size>t.maxPlayers)return e("RESULT_PLAYERS");if(a!==1)return e("RESULT_SELF");const o=n.winner;return o!==null&&!(Number.isInteger(o)&&o>=0&&o<r.length)?e("RESULT_WINNER"):{ok:!0,result:{match:n.match,format:n.format,durationSeconds:Math.round(i*10)/10,teams:r,winner:o}}}function Ym(n,e=()=>Date.now()){let t=null,i=0;const r=()=>{const s=new Uint8Array(12);return globalThis.crypto.getRandomValues(s),Array.from(s,a=>a.toString(16).padStart(2,"0")).join("")};return{begin(s){const a=s??r();if(!Tf.match.test(a))throw new Error("RESULT_MATCH_ID");return t={match:a,at:e()},a},report(s){if(!t)throw new Error("RESULT_NO_OPEN_MATCH");const a=Xm({match:t.match,format:s==null?void 0:s.format,durationSeconds:(s==null?void 0:s.durationSeconds)??Math.max(0,(e()-t.at)/1e3),teams:s==null?void 0:s.teams,winner:s==null?void 0:s.winner});if(a.ok===!1)throw new Error(a.error);return t=null,i++,n(a.result),a.result},abandon(){t=null},inspect:()=>({matchOpen:t!==null,resultsSent:i})}}const Gu="safe-area",Vu="oncyber:safe-area",Km="oncyber:hud-request",Jm="oncyber:hud-report",Zm={top:"--oncyber-safe-top",right:"--oncyber-safe-right",bottom:"--oncyber-safe-bottom",left:"--oncyber-safe-left"},Rf=Object.freeze({top:0,right:0,bottom:0,left:0}),Xc=["top","right","bottom","left"],$m=4096,Bf=64;function eg(n){if(!n||typeof n!="object")return null;const e={top:0,right:0,bottom:0,left:0};for(const t of Xc){const i=n[t];if(typeof i!="number"||!Number.isFinite(i))return null;e[t]=Math.min($m,Math.max(0,Math.ceil(i)))}return e}const tg=(n,e)=>Xc.every(t=>n[t]===e[t]);function zu(n,e){for(const t of Xc)n.style.setProperty(Zm[t],`${e[t]}px`)}function ng(n={}){var o,l;const e=n.window??globalThis,t=(o=e.document)==null?void 0:o.documentElement,i=new Set([Vu,Ln+Gu,...n.game?[FA(n.game)+Gu]:[]]);let r=Rf;t&&zu(t,r);const s=()=>{var c;for(const u of n.relay??[])(c=u.contentWindow)==null||c.postMessage({type:Vu,insets:r},"*")},a=c=>{var d,f;if(c.source!==e.parent||e.parent===e||!i.has((d=c.data)==null?void 0:d.type))return;const u=eg(c.data.insets);if(!u)return;const h=!tg(u,r);r=u,h&&t&&zu(t,r),s(),h&&((f=n.onChange)==null||f.call(n,r))};e.addEventListener("message",a);for(const c of n.relay??[])(l=c.addEventListener)==null||l.call(c,"load",s);return{get insets(){return r},dispose(){var c;e.removeEventListener("message",a);for(const u of n.relay??[])(c=u.removeEventListener)==null||c.call(u,"load",s)}}}function ig(n=globalThis.document,e="[data-hud]"){var r;const t=[],i=Array.from(n.querySelectorAll(e));for(let s=0;s<i.length&&t.length<Bf;s++){const a=i[s],o=a.getBoundingClientRect();if(!(o.width>0&&o.height>0))continue;const l=c=>Math.round(c*10)/10;t.push({id:String(((r=a.getAttribute)==null?void 0:r.call(a,"data-hud"))||a.id||`hud-${s}`).slice(0,64),x:l(o.left),y:l(o.top),width:l(o.width),height:l(o.height)})}return t}function rg(n){if(!Array.isArray(n))return[];const e=[];for(const t of n.slice(0,Bf)){if(!t||typeof t!="object")continue;const{id:i,x:r,y:s,width:a,height:o}=t;[r,s,a,o].every(l=>typeof l=="number"&&Number.isFinite(l))&&a>0&&o>0&&e.push({id:typeof i=="string"&&i?i.slice(0,64):`hud-${e.length}`,x:r,y:s,width:a,height:o})}return e}function sg(n,e={}){const t=e.window??globalThis,i=r=>{var a;if(r.source!==t.parent||t.parent===t||((a=r.data)==null?void 0:a.type)!==Km)return;const s=r.data.request;Promise.resolve().then(n).then(o=>rg(o==null?void 0:o.hud),()=>[]).then(o=>{var l;return r.source.postMessage({type:Jm,request:s,hud:o,insets:((l=e.insets)==null?void 0:l.call(e))??Rf,width:t.innerWidth,height:t.innerHeight},"*")})};return t.addEventListener("message",i),()=>t.removeEventListener("message",i)}const Lf=64,ag=100,di=n=>typeof n=="number"&&Number.isFinite(n),fi=n=>Math.round(n*100)/100;function og(n,e,t){if(!e||!di(e.x)||!di(e.y)||!di(e.z))return null;const i=[];for(const r of t){if(i.length>=Lf)break;typeof(r==null?void 0:r.id)!="string"||!r.id||!di(r.x)||!di(r.y)||!di(r.z)||i.push({id:r.id,x:fi(r.x),y:fi(r.y),z:fi(r.z)})}return{type:`${n}:voice`,listener:{x:fi(e.x),y:fi(e.y),z:fi(e.z),h:di(e.h)?fi(e.h):0},players:i}}function lg(n,e){return(e==null?void 0:e.type)!==`${n}:talking`||!Array.isArray(e.ids)?null:{ids:e.ids.filter(t=>typeof t=="string"&&t).slice(0,Lf+1).map(t=>t.slice(0,64)),self:e.self===!0}}function cg(){return{post:n=>{window.parent!==window&&window.parent.postMessage(n,"*")},listen:n=>{const e=t=>{t.source===window.parent&&n(t.data)};return window.addEventListener("message",e),()=>window.removeEventListener("message",e)}}}function ug(n,e={}){const t=e.port??cg(),i=e.now??(()=>performance.now()),r=new Set;let s=new Set,a=!1,o=-1/0,l=!1;const c=t.listen(u=>{const h=lg(n,u);if(!(!h||l)){s=new Set(h.ids),a=h.self;for(const d of[...r])d(h.ids.slice(),h.self)}});return{setPoses(u,h=[]){const d=i();if(l||d-o<ag)return!1;const f=og(n,u,h);return f?(o=d,t.post(f),!0):!1},onTalking(u){return r.add(u),()=>{r.delete(u)}},isTalking:u=>s.has(u),get selfTalking(){return a},get talking(){return[...s]},dispose(){l=!0,r.clear(),s.clear(),a=!1,c()}}}const hg="oncyber:inspect",dg="oncyber:inspect-result";function fg(n,e=window){if(!new URLSearchParams(e.location.search).has("check")||e.parent===e)return()=>{};const t=i=>{var s;if(i.source!==e.parent||((s=i.data)==null?void 0:s.type)!==hg)return;let r;try{r=JSON.parse(JSON.stringify(n()))}catch(a){r={error:String((a==null?void 0:a.message)??a).slice(0,200)}}e.parent.postMessage({type:dg,nonce:i.data.nonce,inspect:r},"*")};return e.addEventListener("message",t),()=>e.removeEventListener("message",t)}const pg={walkable:!0},Ag={sizes:[1,8],formats:[{id:"duel",label:"Head to head",sizes:[2]},{id:"round",label:"Everyone plays",sizes:[3,4,5,6,7,8]},{id:"solo",label:"Solo round",sizes:[1,2,3,4,5,6,7,8]}],solo:"solo",play:"duel",late:"A member who arrives while the party's round is on can join it in progress, starting from zero, or play a solo round.",dropped:"The round goes on without them and their score stays on the board, marked as left. If they were running the round, another member takes it over.",extra:"A round seats the whole party, up to eight, so nobody sits out. A member who would rather not join can play solo or walk the courtyard."},mg={profile:"portable-v1",version:"1",platforms:["web"],entries:{web:"index.html",game:"src/game.js",scenario:"scenario.json"},capabilities:["audio","avatar","results","travel"],assets:[],input:{up:{keyboard:["KeyW","ArrowUp"],touch:"stick-up",gamepad:["left-stick-up","dpad-up"]},down:{keyboard:["KeyS","ArrowDown"],touch:"stick-down",gamepad:["left-stick-down","dpad-down"]},left:{keyboard:["KeyA","ArrowLeft"],touch:"stick-left",gamepad:["left-stick-left","dpad-left"]},right:{keyboard:["KeyD","ArrowRight"],touch:"stick-right",gamepad:["left-stick-right","dpad-right"]},interact:{keyboard:["KeyE","KeyJ"],touch:"button:Go",gamepad:"button-x"},jump:{keyboard:["Space"],touch:"button:Jump",gamepad:"button-a"},run:{keyboard:["ShiftLeft","ShiftRight"],touch:"button:Run",gamepad:["right-trigger","left-stick-press"]},back:{keyboard:["Backspace"],gamepad:"button-b"},lookX:{touch:"drag",gamepad:"right-stick-x"},lookY:{touch:"drag",gamepad:"right-stick-y"}}},un={arrival:pg,party:Ag,runtime:mg},gg=1,_g={arrival:"lobby"},Eg=[{type:"waitUntil",key:"standing",equals:!0,maxFrames:180},{type:"assert",key:"booted",equals:!0},{type:"assert",key:"screen",equals:"arrival"},{type:"assert",key:"came",equals:"lobby"},{type:"assert",key:"hostArrival",equals:"lobby"},{type:"assert",key:"partySize",equals:1},{type:"assert",key:"options",equals:"solo"},{type:"action",action:"up"},{type:"wait",frames:45},{type:"action",action:"up",value:0},{type:"assert",key:"walked",equals:!0},{type:"assert",key:"screen",equals:"arrival"},{type:"action",action:"interact"},{type:"wait",frames:2},{type:"action",action:"interact",value:0},{type:"assert",key:"screen",equals:"menu"},{type:"action",action:"interact"},{type:"wait",frames:2},{type:"action",action:"interact",value:0},{type:"assert",key:"screen",equals:"match"},{type:"assert",key:"format",equals:"solo"},{type:"waitUntil",key:"lanternsLit",equals:!0,maxFrames:120},{type:"assert",key:"phase",equals:"playing"},{type:"assert",key:"score",equals:0},{type:"wait",frames:30},{type:"assert",key:"screen",equals:"match"}],vg={version:gg,enter:_g,steps:Eg};/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Oi="180",bg=0,Wu=1,xg=2,Df=1,yg=2,Vn=3,Yn=0,qt=1,tn=2,oi=0,Dr=1,to=2,qu=3,ju=4,Mg=5,Si=100,Ig=101,Sg=102,Cg=103,wg=104,Tg=200,Rg=201,Bg=202,Lg=203,ic=204,rc=205,Dg=206,Pg=207,Ug=208,Ng=209,Fg=210,Og=211,kg=212,Qg=213,Hg=214,sc=0,ac=1,oc=2,kr=3,lc=4,cc=5,uc=6,hc=7,Yc=0,Gg=1,Vg=2,li=0,zg=1,Wg=2,qg=3,jg=4,Xg=5,Yg=6,Kg=7,Xu="attached",Jg="detached",Pf=300,ki=301,Qr=302,dc=303,fc=304,yo=306,Qi=1e3,Wn=1001,no=1002,Nt=1003,Kc=1004,Cs=1005,Ut=1006,za=1007,vn=1008,ze=1009,Uf=1010,Nf=1011,Os=1012,Jc=1013,Hi=1014,kt=1015,hn=1016,Zc=1017,$c=1018,ks=1020,Mo=35902,Io=35899,Ff=1021,Qs=1022,Pt=1023,Hs=1026,Gs=1027,ai=1028,eu=1029,Bi=1030,tu=1031,nu=1033,Pr=33776,Ui=33777,Ur=33778,Bs=33779,io=35840,pc=35841,Hr=35842,Vs=35843,ro=36196,zs=37492,Ws=37496,Ni=37808,Ac=37809,mc=37810,gc=37811,Nr=37812,_c=37813,Ec=37814,vc=37815,bc=37816,xc=37817,yc=37818,Mc=37819,Ic=37820,Sc=37821,Gr=36492,Cc=36494,so=36495,ao=36283,oo=36284,lo=36285,co=36286,Zg=2200,$g=2201,e_=2202,qs=2300,js=2301,zo=2302,wr=2400,Tr=2401,uo=2402,iu=2500,t_=2501,n_=0,Of=1,wc=2,i_=3200,r_=3201,So=0,s_=1,Tn="",Ct="srgb",Qt="srgb-linear",ho="linear",ht="srgb",nr=7680,Yu=519,a_=512,o_=513,l_=514,kf=515,c_=516,u_=517,h_=518,d_=519,Tc=35044,f_=35048,Ku="300 es",Rn=2e3,fo=2001;class qi{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){const i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){const i=this._listeners;if(i===void 0)return;const r=i[e];if(r!==void 0){const s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const i=t[e.type];if(i!==void 0){e.target=this;const r=i.slice(0);for(let s=0,a=r.length;s<a;s++)r[s].call(this,e);e.target=null}}}const Ft=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let Ju=1234567;const Ls=Math.PI/180,Vr=180/Math.PI;function bn(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ft[n&255]+Ft[n>>8&255]+Ft[n>>16&255]+Ft[n>>24&255]+"-"+Ft[e&255]+Ft[e>>8&255]+"-"+Ft[e>>16&15|64]+Ft[e>>24&255]+"-"+Ft[t&63|128]+Ft[t>>8&255]+"-"+Ft[t>>16&255]+Ft[t>>24&255]+Ft[i&255]+Ft[i>>8&255]+Ft[i>>16&255]+Ft[i>>24&255]).toLowerCase()}function je(n,e,t){return Math.max(e,Math.min(t,n))}function ru(n,e){return(n%e+e)%e}function p_(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function A_(n,e,t){return n!==e?(t-n)/(e-n):0}function Ds(n,e,t){return(1-t)*n+t*e}function m_(n,e,t,i){return Ds(n,e,1-Math.exp(-t*i))}function g_(n,e=1){return e-Math.abs(ru(n,e*2)-e)}function __(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function E_(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function v_(n,e){return n+Math.floor(Math.random()*(e-n+1))}function b_(n,e){return n+Math.random()*(e-n)}function x_(n){return n*(.5-Math.random())}function y_(n){n!==void 0&&(Ju=n);let e=Ju+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function M_(n){return n*Ls}function I_(n){return n*Vr}function S_(n){return(n&n-1)===0&&n!==0}function C_(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function w_(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function T_(n,e,t,i,r){const s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+i)/2),u=a((e+i)/2),h=s((e-i)/2),d=a((e-i)/2),f=s((i-e)/2),g=a((i-e)/2);switch(r){case"XYX":n.set(o*u,l*h,l*d,o*c);break;case"YZY":n.set(l*d,o*u,l*h,o*c);break;case"ZXZ":n.set(l*h,l*d,o*u,o*c);break;case"XZX":n.set(o*u,l*g,l*f,o*c);break;case"YXY":n.set(l*f,o*u,l*g,o*c);break;case"ZYZ":n.set(l*g,l*f,o*u,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function En(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function lt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const Mt={DEG2RAD:Ls,RAD2DEG:Vr,generateUUID:bn,clamp:je,euclideanModulo:ru,mapLinear:p_,inverseLerp:A_,lerp:Ds,damp:m_,pingpong:g_,smoothstep:__,smootherstep:E_,randInt:v_,randFloat:b_,randFloatSpread:x_,seededRandom:y_,degToRad:M_,radToDeg:I_,isPowerOfTwo:S_,ceilPowerOfTwo:C_,floorPowerOfTwo:w_,setQuaternionFromProperEuler:T_,normalize:lt,denormalize:En};class we{constructor(e=0,t=0){we.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*i-a*r+e.x,this.y=s*r+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Qe{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,a,o){let l=i[r+0],c=i[r+1],u=i[r+2],h=i[r+3];const d=s[a+0],f=s[a+1],g=s[a+2],m=s[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(o===1){e[t+0]=d,e[t+1]=f,e[t+2]=g,e[t+3]=m;return}if(h!==m||l!==d||c!==f||u!==g){let A=1-o;const p=l*d+c*f+u*g+h*m,b=p>=0?1:-1,M=1-p*p;if(M>Number.EPSILON){const _=Math.sqrt(M),y=Math.atan2(_,p*b);A=Math.sin(A*y)/_,o=Math.sin(o*y)/_}const E=o*b;if(l=l*A+d*E,c=c*A+f*E,u=u*A+g*E,h=h*A+m*E,A===1-o){const _=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=_,c*=_,u*=_,h*=_}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,r,s,a){const o=i[r],l=i[r+1],c=i[r+2],u=i[r+3],h=s[a],d=s[a+1],f=s[a+2],g=s[a+3];return e[t]=o*g+u*h+l*f-c*d,e[t+1]=l*g+u*d+c*h-o*f,e[t+2]=c*g+u*f+o*d-l*h,e[t+3]=u*g-o*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,r=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),u=o(r/2),h=o(s/2),d=l(i/2),f=l(r/2),g=l(s/2);switch(a){case"XYZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"YXZ":this._x=d*u*h+c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"ZXY":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h-d*f*g;break;case"ZYX":this._x=d*u*h-c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h+d*f*g;break;case"YZX":this._x=d*u*h+c*f*g,this._y=c*f*h+d*u*g,this._z=c*u*g-d*f*h,this._w=c*u*h-d*f*g;break;case"XZY":this._x=d*u*h-c*f*g,this._y=c*f*h-d*u*g,this._z=c*u*g+d*f*h,this._w=c*u*h+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],r=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=i+o+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(s-c)*f,this._z=(a-r)*f}else if(i>o&&i>h){const f=2*Math.sqrt(1+i-o-h);this._w=(u-l)/f,this._x=.25*f,this._y=(r+a)/f,this._z=(s+c)/f}else if(o>h){const f=2*Math.sqrt(1+o-i-h);this._w=(s-c)/f,this._x=(r+a)/f,this._y=.25*f,this._z=(l+u)/f}else{const f=2*Math.sqrt(1+h-i-o);this._w=(a-r)/f,this._x=(s+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(je(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,r=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+a*o+r*c-s*l,this._y=r*u+a*l+s*o-i*c,this._z=s*u+a*c+i*l-r*o,this._w=a*u-i*o-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,r=this._y,s=this._z,a=this._w;let o=a*e._w+i*e._x+r*e._y+s*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=i,this._y=r,this._z=s,this;const l=1-o*o;if(l<=Number.EPSILON){const f=1-t;return this._w=f*a+t*this._w,this._x=f*i+t*this._x,this._y=f*r+t*this._y,this._z=f*s+t*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,o),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=a*h+this._w*d,this._x=i*h+this._x*d,this._y=r*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(e=0,t=0,i=0){R.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Zu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Zu.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=e.elements,a=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*a,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*a,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*a,this}applyQuaternion(e){const t=this.x,i=this.y,r=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*r-o*i),u=2*(o*t-s*r),h=2*(s*i-a*t);return this.x=t+l*c+a*h-o*u,this.y=i+l*u+o*c-s*h,this.z=r+l*h+s*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,r=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=r*l-s*o,this.y=s*a-i*l,this.z=i*o-r*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Wo.copy(this).projectOnVector(e),this.sub(Wo)}reflect(e){return this.sub(Wo.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Wo=new R,Zu=new Qe;class Le{constructor(e,t,i,r,s,a,o,l,c){Le.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c)}set(e,t,i,r,s,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=r,u[2]=o,u[3]=t,u[4]=s,u[5]=l,u[6]=i,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],u=i[4],h=i[7],d=i[2],f=i[5],g=i[8],m=r[0],A=r[3],p=r[6],b=r[1],M=r[4],E=r[7],_=r[2],y=r[5],S=r[8];return s[0]=a*m+o*b+l*_,s[3]=a*A+o*M+l*y,s[6]=a*p+o*E+l*S,s[1]=c*m+u*b+h*_,s[4]=c*A+u*M+h*y,s[7]=c*p+u*E+h*S,s[2]=d*m+f*b+g*_,s[5]=d*A+f*M+g*y,s[8]=d*p+f*E+g*S,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-i*s*u+i*o*l+r*s*c-r*a*l}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=u*a-o*c,d=o*l-u*s,f=c*s-a*l,g=t*h+i*d+r*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const m=1/g;return e[0]=h*m,e[1]=(r*c-u*i)*m,e[2]=(o*i-r*a)*m,e[3]=d*m,e[4]=(u*t-r*l)*m,e[5]=(r*s-o*t)*m,e[6]=f*m,e[7]=(i*l-c*t)*m,e[8]=(a*t-i*s)*m,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-r*c,r*l,-r*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(qo.makeScale(e,t)),this}rotate(e){return this.premultiply(qo.makeRotation(-e)),this}translate(e,t){return this.premultiply(qo.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const qo=new Le;function Qf(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Xs(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function R_(){const n=Xs("canvas");return n.style.display="block",n}const $u={};function Ys(n){n in $u||($u[n]=!0,console.warn(n))}function B_(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}const eh=new Le().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),th=new Le().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function L_(){const n={enabled:!0,workingColorSpace:Qt,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===ht&&(r.r=Xn(r.r),r.g=Xn(r.g),r.b=Xn(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ht&&(r.r=Fr(r.r),r.g=Fr(r.g),r.b=Fr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Tn?ho:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ys("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ys("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Qt]:{primaries:e,whitePoint:i,transfer:ho,toXYZ:eh,fromXYZ:th,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ct},outputColorSpaceConfig:{drawingBufferColorSpace:Ct}},[Ct]:{primaries:e,whitePoint:i,transfer:ht,toXYZ:eh,fromXYZ:th,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ct}}}),n}const Je=L_();function Xn(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Fr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let ir;class D_{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{ir===void 0&&(ir=Xs("canvas")),ir.width=e.width,ir.height=e.height;const r=ir.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=ir}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Xs("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let a=0;a<s.length;a++)s[a]=Xn(s[a]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Xn(t[i]/255)*255):t[i]=Xn(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let P_=0;class su{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:P_++}),this.uuid=bn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let a=0,o=r.length;a<o;a++)r[a].isDataTexture?s.push(jo(r[a].image)):s.push(jo(r[a]))}else s=jo(r);i.url=s}return t||(e.images[this.uuid]=i),i}}function jo(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?D_.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let U_=0;const Xo=new R;class Tt extends qi{constructor(e=Tt.DEFAULT_IMAGE,t=Tt.DEFAULT_MAPPING,i=Wn,r=Wn,s=Ut,a=vn,o=Pt,l=ze,c=Tt.DEFAULT_ANISOTROPY,u=Tn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:U_++}),this.uuid=bn(),this.name="",this.source=new su(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new we(0,0),this.repeat=new we(1,1),this.center=new we(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Le,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Xo).x}get height(){return this.source.getSize(Xo).y}get depth(){return this.source.getSize(Xo).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Pf)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Qi:e.x=e.x-Math.floor(e.x);break;case Wn:e.x=e.x<0?0:1;break;case no:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Qi:e.y=e.y-Math.floor(e.y);break;case Wn:e.y=e.y<0?0:1;break;case no:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Tt.DEFAULT_IMAGE=null;Tt.DEFAULT_MAPPING=Pf;Tt.DEFAULT_ANISOTROPY=1;class nt{constructor(e=0,t=0,i=0,r=1){nt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*r+a[12]*s,this.y=a[1]*t+a[5]*i+a[9]*r+a[13]*s,this.z=a[2]*t+a[6]*i+a[10]*r+a[14]*s,this.w=a[3]*t+a[7]*i+a[11]*r+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s;const l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],g=l[9],m=l[2],A=l[6],p=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-m)<.01&&Math.abs(g-A)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+m)<.1&&Math.abs(g+A)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const M=(c+1)/2,E=(f+1)/2,_=(p+1)/2,y=(u+d)/4,S=(h+m)/4,C=(g+A)/4;return M>E&&M>_?M<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(M),r=y/i,s=S/i):E>_?E<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(E),i=y/r,s=C/r):_<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(_),i=S/s,r=C/s),this.set(i,r,s,t),this}let b=Math.sqrt((A-g)*(A-g)+(h-m)*(h-m)+(d-u)*(d-u));return Math.abs(b)<.001&&(b=1),this.x=(A-g)/b,this.y=(h-m)/b,this.z=(d-u)/b,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this.w=je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this.w=je(this.w,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class N_ extends qi{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ut,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new nt(0,0,e,t),this.scissorTest=!1,this.viewport=new nt(0,0,e,t);const r={width:e,height:t,depth:i.depth},s=new Tt(r);this.textures=[];const a=i.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview}_setTextureOptions(e={}){const t={minFilter:Ut,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isArrayTexture=this.textures[r].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const r=Object.assign({},e.textures[t].image);this.textures[t].source=new su(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Gi extends N_{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class Hf extends Tt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Gf extends Tt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class xn{constructor(e=new R(1/0,1/0,1/0),t=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(An.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(An.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=An.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,An):An.fromBufferAttribute(s,a),An.applyMatrix4(e.matrixWorld),this.expandByPoint(An);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ra.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),ra.copy(i.boundingBox)),ra.applyMatrix4(e.matrixWorld),this.union(ra)}const r=e.children;for(let s=0,a=r.length;s<a;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,An),An.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(is),sa.subVectors(this.max,is),rr.subVectors(e.a,is),sr.subVectors(e.b,is),ar.subVectors(e.c,is),Jn.subVectors(sr,rr),Zn.subVectors(ar,sr),pi.subVectors(rr,ar);let t=[0,-Jn.z,Jn.y,0,-Zn.z,Zn.y,0,-pi.z,pi.y,Jn.z,0,-Jn.x,Zn.z,0,-Zn.x,pi.z,0,-pi.x,-Jn.y,Jn.x,0,-Zn.y,Zn.x,0,-pi.y,pi.x,0];return!Yo(t,rr,sr,ar,sa)||(t=[1,0,0,0,1,0,0,0,1],!Yo(t,rr,sr,ar,sa))?!1:(aa.crossVectors(Jn,Zn),t=[aa.x,aa.y,aa.z],Yo(t,rr,sr,ar,sa))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,An).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(An).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Nn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Nn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Nn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Nn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Nn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Nn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Nn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Nn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Nn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Nn=[new R,new R,new R,new R,new R,new R,new R,new R],An=new R,ra=new xn,rr=new R,sr=new R,ar=new R,Jn=new R,Zn=new R,pi=new R,is=new R,sa=new R,aa=new R,Ai=new R;function Yo(n,e,t,i,r){for(let s=0,a=n.length-3;s<=a;s+=3){Ai.fromArray(n,s);const o=r.x*Math.abs(Ai.x)+r.y*Math.abs(Ai.y)+r.z*Math.abs(Ai.z),l=e.dot(Ai),c=t.dot(Ai),u=i.dot(Ai);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const F_=new xn,rs=new R,Ko=new R;class Dn{constructor(e=new R,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):F_.setFromPoints(e).getCenter(i);let r=0;for(let s=0,a=e.length;s<a;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;rs.subVectors(e,this.center);const t=rs.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(rs,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ko.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(rs.copy(e.center).add(Ko)),this.expandByPoint(rs.copy(e.center).sub(Ko))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const Fn=new R,Jo=new R,oa=new R,$n=new R,Zo=new R,la=new R,$o=new R;class Co{constructor(e=new R,t=new R(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Fn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Fn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Fn.copy(this.origin).addScaledVector(this.direction,t),Fn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Jo.copy(e).add(t).multiplyScalar(.5),oa.copy(t).sub(e).normalize(),$n.copy(this.origin).sub(Jo);const s=e.distanceTo(t)*.5,a=-this.direction.dot(oa),o=$n.dot(this.direction),l=-$n.dot(oa),c=$n.lengthSq(),u=Math.abs(1-a*a);let h,d,f,g;if(u>0)if(h=a*l-o,d=a*o-l,g=s*u,h>=0)if(d>=-g)if(d<=g){const m=1/u;h*=m,d*=m,f=h*(h+a*d+2*o)+d*(a*h+d+2*l)+c}else d=s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d<=-g?(h=Math.max(0,-(-a*s+o)),d=h>0?-s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c):d<=g?(h=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(h=Math.max(0,-(a*s+o)),d=h>0?s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c);else d=a>0?-s:s,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(Jo).addScaledVector(oa,d),f}intersectSphere(e,t){Fn.subVectors(e.center,this.origin);const i=Fn.dot(this.direction),r=Fn.dot(Fn)-i*i,s=e.radius*e.radius;if(r>s)return null;const a=Math.sqrt(s-r),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,a=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,a=(e.min.y-d.y)*u),i>a||s>r||((s>i||isNaN(i))&&(i=s),(a<r||isNaN(r))&&(r=a),h>=0?(o=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(o=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),i>l||o>r)||((o>i||i!==i)&&(i=o),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Fn)!==null}intersectTriangle(e,t,i,r,s){Zo.subVectors(t,e),la.subVectors(i,e),$o.crossVectors(Zo,la);let a=this.direction.dot($o),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;$n.subVectors(this.origin,e);const l=o*this.direction.dot(la.crossVectors($n,la));if(l<0)return null;const c=o*this.direction.dot(Zo.cross($n));if(c<0||l+c>a)return null;const u=-o*$n.dot($o);return u<0?null:this.at(u/a,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class De{constructor(e,t,i,r,s,a,o,l,c,u,h,d,f,g,m,A){De.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c,u,h,d,f,g,m,A)}set(e,t,i,r,s,a,o,l,c,u,h,d,f,g,m,A){const p=this.elements;return p[0]=e,p[4]=t,p[8]=i,p[12]=r,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=u,p[10]=h,p[14]=d,p[3]=f,p[7]=g,p[11]=m,p[15]=A,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new De().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,r=1/or.setFromMatrixColumn(e,0).length(),s=1/or.setFromMatrixColumn(e,1).length(),a=1/or.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,r=e.y,s=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const d=a*u,f=a*h,g=o*u,m=o*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+g*c,t[5]=d-m*c,t[9]=-o*l,t[2]=m-d*c,t[6]=g+f*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*u,f=l*h,g=c*u,m=c*h;t[0]=d+m*o,t[4]=g*o-f,t[8]=a*c,t[1]=a*h,t[5]=a*u,t[9]=-o,t[2]=f*o-g,t[6]=m+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*u,f=l*h,g=c*u,m=c*h;t[0]=d-m*o,t[4]=-a*h,t[8]=g+f*o,t[1]=f+g*o,t[5]=a*u,t[9]=m-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*u,f=a*h,g=o*u,m=o*h;t[0]=l*u,t[4]=g*c-f,t[8]=d*c+m,t[1]=l*h,t[5]=m*c+d,t[9]=f*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,f=a*c,g=o*l,m=o*c;t[0]=l*u,t[4]=m-d*h,t[8]=g*h+f,t[1]=h,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=f*h+g,t[10]=d-m*h}else if(e.order==="XZY"){const d=a*l,f=a*c,g=o*l,m=o*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+m,t[5]=a*u,t[9]=f*h-g,t[2]=g*h-f,t[6]=o*u,t[10]=m*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(O_,e,k_)}lookAt(e,t,i){const r=this.elements;return $t.subVectors(e,t),$t.lengthSq()===0&&($t.z=1),$t.normalize(),ei.crossVectors(i,$t),ei.lengthSq()===0&&(Math.abs(i.z)===1?$t.x+=1e-4:$t.z+=1e-4,$t.normalize(),ei.crossVectors(i,$t)),ei.normalize(),ca.crossVectors($t,ei),r[0]=ei.x,r[4]=ca.x,r[8]=$t.x,r[1]=ei.y,r[5]=ca.y,r[9]=$t.y,r[2]=ei.z,r[6]=ca.z,r[10]=$t.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],u=i[1],h=i[5],d=i[9],f=i[13],g=i[2],m=i[6],A=i[10],p=i[14],b=i[3],M=i[7],E=i[11],_=i[15],y=r[0],S=r[4],C=r[8],v=r[12],x=r[1],T=r[5],D=r[9],U=r[13],N=r[2],Q=r[6],G=r[10],X=r[14],V=r[3],ee=r[7],Z=r[11],se=r[15];return s[0]=a*y+o*x+l*N+c*V,s[4]=a*S+o*T+l*Q+c*ee,s[8]=a*C+o*D+l*G+c*Z,s[12]=a*v+o*U+l*X+c*se,s[1]=u*y+h*x+d*N+f*V,s[5]=u*S+h*T+d*Q+f*ee,s[9]=u*C+h*D+d*G+f*Z,s[13]=u*v+h*U+d*X+f*se,s[2]=g*y+m*x+A*N+p*V,s[6]=g*S+m*T+A*Q+p*ee,s[10]=g*C+m*D+A*G+p*Z,s[14]=g*v+m*U+A*X+p*se,s[3]=b*y+M*x+E*N+_*V,s[7]=b*S+M*T+E*Q+_*ee,s[11]=b*C+M*D+E*G+_*Z,s[15]=b*v+M*U+E*X+_*se,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],g=e[3],m=e[7],A=e[11],p=e[15];return g*(+s*l*h-r*c*h-s*o*d+i*c*d+r*o*f-i*l*f)+m*(+t*l*f-t*c*d+s*a*d-r*a*f+r*c*u-s*l*u)+A*(+t*c*h-t*o*f-s*a*h+i*a*f+s*o*u-i*c*u)+p*(-r*o*u-t*l*h+t*o*d+r*a*h-i*a*d+i*l*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],g=e[12],m=e[13],A=e[14],p=e[15],b=h*A*c-m*d*c+m*l*f-o*A*f-h*l*p+o*d*p,M=g*d*c-u*A*c-g*l*f+a*A*f+u*l*p-a*d*p,E=u*m*c-g*h*c+g*o*f-a*m*f-u*o*p+a*h*p,_=g*h*l-u*m*l-g*o*d+a*m*d+u*o*A-a*h*A,y=t*b+i*M+r*E+s*_;if(y===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const S=1/y;return e[0]=b*S,e[1]=(m*d*s-h*A*s-m*r*f+i*A*f+h*r*p-i*d*p)*S,e[2]=(o*A*s-m*l*s+m*r*c-i*A*c-o*r*p+i*l*p)*S,e[3]=(h*l*s-o*d*s-h*r*c+i*d*c+o*r*f-i*l*f)*S,e[4]=M*S,e[5]=(u*A*s-g*d*s+g*r*f-t*A*f-u*r*p+t*d*p)*S,e[6]=(g*l*s-a*A*s-g*r*c+t*A*c+a*r*p-t*l*p)*S,e[7]=(a*d*s-u*l*s+u*r*c-t*d*c-a*r*f+t*l*f)*S,e[8]=E*S,e[9]=(g*h*s-u*m*s-g*i*f+t*m*f+u*i*p-t*h*p)*S,e[10]=(a*m*s-g*o*s+g*i*c-t*m*c-a*i*p+t*o*p)*S,e[11]=(u*o*s-a*h*s-u*i*c+t*h*c+a*i*f-t*o*f)*S,e[12]=_*S,e[13]=(u*m*r-g*h*r+g*i*d-t*m*d-u*i*A+t*h*A)*S,e[14]=(g*o*r-a*m*r-g*i*l+t*m*l+a*i*A-t*o*A)*S,e[15]=(a*h*r-u*o*r+u*i*l-t*h*l-a*i*d+t*o*d)*S,this}scale(e){const t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),r=Math.sin(t),s=1-i,a=e.x,o=e.y,l=e.z,c=s*a,u=s*o;return this.set(c*a+i,c*o-r*l,c*l+r*o,0,c*o+r*l,u*o+i,u*l-r*a,0,c*l-r*o,u*l+r*a,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,a){return this.set(1,i,s,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){const r=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,u=a+a,h=o+o,d=s*c,f=s*u,g=s*h,m=a*u,A=a*h,p=o*h,b=l*c,M=l*u,E=l*h,_=i.x,y=i.y,S=i.z;return r[0]=(1-(m+p))*_,r[1]=(f+E)*_,r[2]=(g-M)*_,r[3]=0,r[4]=(f-E)*y,r[5]=(1-(d+p))*y,r[6]=(A+b)*y,r[7]=0,r[8]=(g+M)*S,r[9]=(A-b)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){const r=this.elements;let s=or.set(r[0],r[1],r[2]).length();const a=or.set(r[4],r[5],r[6]).length(),o=or.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],mn.copy(this);const c=1/s,u=1/a,h=1/o;return mn.elements[0]*=c,mn.elements[1]*=c,mn.elements[2]*=c,mn.elements[4]*=u,mn.elements[5]*=u,mn.elements[6]*=u,mn.elements[8]*=h,mn.elements[9]*=h,mn.elements[10]*=h,t.setFromRotationMatrix(mn),i.x=s,i.y=a,i.z=o,this}makePerspective(e,t,i,r,s,a,o=Rn,l=!1){const c=this.elements,u=2*s/(t-e),h=2*s/(i-r),d=(t+e)/(t-e),f=(i+r)/(i-r);let g,m;if(l)g=s/(a-s),m=a*s/(a-s);else if(o===Rn)g=-(a+s)/(a-s),m=-2*a*s/(a-s);else if(o===fo)g=-a/(a-s),m=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,a,o=Rn,l=!1){const c=this.elements,u=2/(t-e),h=2/(i-r),d=-(t+e)/(t-e),f=-(i+r)/(i-r);let g,m;if(l)g=1/(a-s),m=a/(a-s);else if(o===Rn)g=-2/(a-s),m=-(a+s)/(a-s);else if(o===fo)g=-1/(a-s),m=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=h,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}const or=new R,mn=new De,O_=new R(0,0,0),k_=new R(1,1,1),ei=new R,ca=new R,$t=new R,nh=new De,ih=new Qe;class jt{constructor(e=0,t=0,i=0,r=jt.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const r=e.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],u=r[9],h=r[2],d=r[6],f=r[10];switch(t){case"XYZ":this._y=Math.asin(je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-je(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(je(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-je(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-u,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return nh.makeRotationFromQuaternion(e),this.setFromRotationMatrix(nh,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ih.setFromEuler(this),this.setFromQuaternion(ih,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}jt.DEFAULT_ORDER="XYZ";class Vf{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Q_=0;const rh=new R,lr=new Qe,On=new De,ua=new R,ss=new R,H_=new R,G_=new Qe,sh=new R(1,0,0),ah=new R(0,1,0),oh=new R(0,0,1),lh={type:"added"},V_={type:"removed"},cr={type:"childadded",child:null},el={type:"childremoved",child:null};class ct extends qi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Q_++}),this.uuid=bn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ct.DEFAULT_UP.clone();const e=new R,t=new jt,i=new Qe,r=new R(1,1,1);function s(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new De},normalMatrix:{value:new Le}}),this.matrix=new De,this.matrixWorld=new De,this.matrixAutoUpdate=ct.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Vf,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return lr.setFromAxisAngle(e,t),this.quaternion.multiply(lr),this}rotateOnWorldAxis(e,t){return lr.setFromAxisAngle(e,t),this.quaternion.premultiply(lr),this}rotateX(e){return this.rotateOnAxis(sh,e)}rotateY(e){return this.rotateOnAxis(ah,e)}rotateZ(e){return this.rotateOnAxis(oh,e)}translateOnAxis(e,t){return rh.copy(e).applyQuaternion(this.quaternion),this.position.add(rh.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(sh,e)}translateY(e){return this.translateOnAxis(ah,e)}translateZ(e){return this.translateOnAxis(oh,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(On.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?ua.copy(e):ua.set(e,t,i);const r=this.parent;this.updateWorldMatrix(!0,!1),ss.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?On.lookAt(ss,ua,this.up):On.lookAt(ua,ss,this.up),this.quaternion.setFromRotationMatrix(On),r&&(On.extractRotation(r.matrixWorld),lr.setFromRotationMatrix(On),this.quaternion.premultiply(lr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(lh),cr.child=e,this.dispatchEvent(cr),cr.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(V_),el.child=e,this.dispatchEvent(el),el.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),On.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),On.multiply(e.parent.matrixWorld)),e.applyMatrix4(On),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(lh),cr.child=e,this.dispatchEvent(cr),cr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){const a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ss,e,H_),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ss,G_,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){const i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];r.animations.push(s(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),h=a(e.shapes),d=a(e.skeletons),f=a(e.animations),g=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),h.length>0&&(i.shapes=h),d.length>0&&(i.skeletons=d),f.length>0&&(i.animations=f),g.length>0&&(i.nodes=g)}return i.object=r,i;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const r=e.children[i];this.add(r.clone())}return this}}ct.DEFAULT_UP=new R(0,1,0);ct.DEFAULT_MATRIX_AUTO_UPDATE=!0;ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const gn=new R,kn=new R,tl=new R,Qn=new R,ur=new R,hr=new R,ch=new R,nl=new R,il=new R,rl=new R,sl=new nt,al=new nt,ol=new nt;class dn{constructor(e=new R,t=new R,i=new R){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),gn.subVectors(e,t),r.cross(gn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){gn.subVectors(r,t),kn.subVectors(i,t),tl.subVectors(e,t);const a=gn.dot(gn),o=gn.dot(kn),l=gn.dot(tl),c=kn.dot(kn),u=kn.dot(tl),h=a*c-o*o;if(h===0)return s.set(0,0,0),null;const d=1/h,f=(c*l-o*u)*d,g=(a*u-o*l)*d;return s.set(1-f-g,g,f)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Qn)===null?!1:Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(e,t,i,r,s,a,o,l){return this.getBarycoord(e,t,i,r,Qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Qn.x),l.addScaledVector(a,Qn.y),l.addScaledVector(o,Qn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,a){return sl.setScalar(0),al.setScalar(0),ol.setScalar(0),sl.fromBufferAttribute(e,t),al.fromBufferAttribute(e,i),ol.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(sl,s.x),a.addScaledVector(al,s.y),a.addScaledVector(ol,s.z),a}static isFrontFacing(e,t,i,r){return gn.subVectors(i,t),kn.subVectors(e,t),gn.cross(kn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return gn.subVectors(this.c,this.b),kn.subVectors(this.a,this.b),gn.cross(kn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return dn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return dn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return dn.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return dn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return dn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,r=this.b,s=this.c;let a,o;ur.subVectors(r,i),hr.subVectors(s,i),nl.subVectors(e,i);const l=ur.dot(nl),c=hr.dot(nl);if(l<=0&&c<=0)return t.copy(i);il.subVectors(e,r);const u=ur.dot(il),h=hr.dot(il);if(u>=0&&h<=u)return t.copy(r);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(i).addScaledVector(ur,a);rl.subVectors(e,s);const f=ur.dot(rl),g=hr.dot(rl);if(g>=0&&f<=g)return t.copy(s);const m=f*c-l*g;if(m<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(i).addScaledVector(hr,o);const A=u*g-f*h;if(A<=0&&h-u>=0&&f-g>=0)return ch.subVectors(s,r),o=(h-u)/(h-u+(f-g)),t.copy(r).addScaledVector(ch,o);const p=1/(A+m+d);return a=m*p,o=d*p,t.copy(i).addScaledVector(ur,a).addScaledVector(hr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const zf={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ti={h:0,s:0,l:0},ha={h:0,s:0,l:0};function ll(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class be{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ct){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Je.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=Je.workingColorSpace){return this.r=e,this.g=t,this.b=i,Je.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=Je.workingColorSpace){if(e=ru(e,1),t=je(t,0,1),i=je(i,0,1),t===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+t):i+t-i*t,a=2*i-s;this.r=ll(a,s,e+1/3),this.g=ll(a,s,e),this.b=ll(a,s,e-1/3)}return Je.colorSpaceToWorking(this,r),this}setStyle(e,t=Ct){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const a=r[1],o=r[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ct){const i=zf[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Xn(e.r),this.g=Xn(e.g),this.b=Xn(e.b),this}copyLinearToSRGB(e){return this.r=Fr(e.r),this.g=Fr(e.g),this.b=Fr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ct){return Je.workingToColorSpace(Ot.copy(this),e),Math.round(je(Ot.r*255,0,255))*65536+Math.round(je(Ot.g*255,0,255))*256+Math.round(je(Ot.b*255,0,255))}getHexString(e=Ct){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Je.workingColorSpace){Je.workingToColorSpace(Ot.copy(this),t);const i=Ot.r,r=Ot.g,s=Ot.b,a=Math.max(i,r,s),o=Math.min(i,r,s);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=u<=.5?h/(a+o):h/(2-a-o),a){case i:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-i)/h+2;break;case s:l=(i-r)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=Je.workingColorSpace){return Je.workingToColorSpace(Ot.copy(this),t),e.r=Ot.r,e.g=Ot.g,e.b=Ot.b,e}getStyle(e=Ct){Je.workingToColorSpace(Ot.copy(this),e);const t=Ot.r,i=Ot.g,r=Ot.b;return e!==Ct?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ti),this.setHSL(ti.h+e,ti.s+t,ti.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ti),e.getHSL(ha);const i=Ds(ti.h,ha.h,t),r=Ds(ti.s,ha.s,t),s=Ds(ti.l,ha.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ot=new be;be.NAMES=zf;let z_=0;class nn extends qi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:z_++}),this.uuid=bn(),this.name="",this.type="Material",this.blending=Dr,this.side=Yn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ic,this.blendDst=rc,this.blendEquation=Si,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new be(0,0,0),this.blendAlpha=0,this.depthFunc=kr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Yu,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=nr,this.stencilZFail=nr,this.stencilZPass=nr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Dr&&(i.blending=this.blending),this.side!==Yn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==ic&&(i.blendSrc=this.blendSrc),this.blendDst!==rc&&(i.blendDst=this.blendDst),this.blendEquation!==Si&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==kr&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Yu&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==nr&&(i.stencilFail=this.stencilFail),this.stencilZFail!==nr&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==nr&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(t){const s=r(e.textures),a=r(e.images);s.length>0&&(i.textures=s),a.length>0&&(i.images=a)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Kt extends nn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.combine=Yc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const wt=new R,da=new we;let W_=0;class tt{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:W_++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Tc,this.updateRanges=[],this.gpuType=kt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)da.fromBufferAttribute(this,t),da.applyMatrix3(e),this.setXY(t,da.x,da.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix3(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix4(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyNormalMatrix(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.transformDirection(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=En(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=lt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=En(t,this.array)),t}setX(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=En(t,this.array)),t}setY(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=En(t,this.array)),t}setZ(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=En(t,this.array)),t}setW(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array),s=lt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Tc&&(e.usage=this.usage),e}}class Wf extends tt{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class qf extends tt{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class st extends tt{constructor(e,t,i){super(new Float32Array(e),t,i)}}let q_=0;const on=new De,cl=new ct,dr=new R,en=new xn,as=new xn,Dt=new R;class dt extends qi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:q_++}),this.uuid=bn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Qf(e)?qf:Wf)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new Le().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return on.makeRotationFromQuaternion(e),this.applyMatrix4(on),this}rotateX(e){return on.makeRotationX(e),this.applyMatrix4(on),this}rotateY(e){return on.makeRotationY(e),this.applyMatrix4(on),this}rotateZ(e){return on.makeRotationZ(e),this.applyMatrix4(on),this}translate(e,t,i){return on.makeTranslation(e,t,i),this.applyMatrix4(on),this}scale(e,t,i){return on.makeScale(e,t,i),this.applyMatrix4(on),this}lookAt(e){return cl.lookAt(e),cl.updateMatrix(),this.applyMatrix4(cl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(dr).negate(),this.translate(dr.x,dr.y,dr.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const i=[];for(let r=0,s=e.length;r<s;r++){const a=e[r];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new st(i,3))}else{const i=Math.min(e.length,t.count);for(let r=0;r<i;r++){const s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new xn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){const s=t[i];en.setFromBufferAttribute(s),this.morphTargetsRelative?(Dt.addVectors(this.boundingBox.min,en.min),this.boundingBox.expandByPoint(Dt),Dt.addVectors(this.boundingBox.max,en.max),this.boundingBox.expandByPoint(Dt)):(this.boundingBox.expandByPoint(en.min),this.boundingBox.expandByPoint(en.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Dn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(e){const i=this.boundingSphere.center;if(en.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){const o=t[s];as.setFromBufferAttribute(o),this.morphTargetsRelative?(Dt.addVectors(en.min,as.min),en.expandByPoint(Dt),Dt.addVectors(en.max,as.max),en.expandByPoint(Dt)):(en.expandByPoint(as.min),en.expandByPoint(as.max))}en.getCenter(i);let r=0;for(let s=0,a=e.count;s<a;s++)Dt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Dt));if(t)for(let s=0,a=t.length;s<a;s++){const o=t[s],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)Dt.fromBufferAttribute(o,c),l&&(dr.fromBufferAttribute(e,c),Dt.add(dr)),r=Math.max(r,i.distanceToSquared(Dt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,r=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new tt(new Float32Array(4*i.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let C=0;C<i.count;C++)o[C]=new R,l[C]=new R;const c=new R,u=new R,h=new R,d=new we,f=new we,g=new we,m=new R,A=new R;function p(C,v,x){c.fromBufferAttribute(i,C),u.fromBufferAttribute(i,v),h.fromBufferAttribute(i,x),d.fromBufferAttribute(s,C),f.fromBufferAttribute(s,v),g.fromBufferAttribute(s,x),u.sub(c),h.sub(c),f.sub(d),g.sub(d);const T=1/(f.x*g.y-g.x*f.y);isFinite(T)&&(m.copy(u).multiplyScalar(g.y).addScaledVector(h,-f.y).multiplyScalar(T),A.copy(h).multiplyScalar(f.x).addScaledVector(u,-g.x).multiplyScalar(T),o[C].add(m),o[v].add(m),o[x].add(m),l[C].add(A),l[v].add(A),l[x].add(A))}let b=this.groups;b.length===0&&(b=[{start:0,count:e.count}]);for(let C=0,v=b.length;C<v;++C){const x=b[C],T=x.start,D=x.count;for(let U=T,N=T+D;U<N;U+=3)p(e.getX(U+0),e.getX(U+1),e.getX(U+2))}const M=new R,E=new R,_=new R,y=new R;function S(C){_.fromBufferAttribute(r,C),y.copy(_);const v=o[C];M.copy(v),M.sub(_.multiplyScalar(_.dot(v))).normalize(),E.crossVectors(y,v);const T=E.dot(l[C])<0?-1:1;a.setXYZW(C,M.x,M.y,M.z,T)}for(let C=0,v=b.length;C<v;++C){const x=b[C],T=x.start,D=x.count;for(let U=T,N=T+D;U<N;U+=3)S(e.getX(U+0)),S(e.getX(U+1)),S(e.getX(U+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new tt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,f=i.count;d<f;d++)i.setXYZ(d,0,0,0);const r=new R,s=new R,a=new R,o=new R,l=new R,c=new R,u=new R,h=new R;if(e)for(let d=0,f=e.count;d<f;d+=3){const g=e.getX(d+0),m=e.getX(d+1),A=e.getX(d+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,m),a.fromBufferAttribute(t,A),u.subVectors(a,s),h.subVectors(r,s),u.cross(h),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,m),c.fromBufferAttribute(i,A),o.add(u),l.add(u),c.add(u),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(m,l.x,l.y,l.z),i.setXYZ(A,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)r.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),u.subVectors(a,s),h.subVectors(r,s),u.cross(h),i.setXYZ(d+0,u.x,u.y,u.z),i.setXYZ(d+1,u.x,u.y,u.z),i.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Dt.fromBufferAttribute(e,t),Dt.normalize(),e.setXYZ(t,Dt.x,Dt.y,Dt.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,h=o.normalized,d=new c.constructor(l.length*u);let f=0,g=0;for(let m=0,A=l.length;m<A;m++){o.isInterleavedBufferAttribute?f=l[m]*o.data.stride+o.offset:f=l[m]*u;for(let p=0;p<u;p++)d[g++]=c[f++]}return new tt(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new dt,i=this.index.array,r=this.attributes;for(const o in r){const l=r[o],c=e(l,i);t.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let u=0,h=c.length;u<h;u++){const d=c[u],f=e(d,i);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){const f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(r[l]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone());const r=e.attributes;for(const c in r){const u=r[c];this.setAttribute(c,u.clone(t))}const s=e.morphAttributes;for(const c in s){const u=[],h=s[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const uh=new De,mi=new Co,fa=new Dn,hh=new R,pa=new R,Aa=new R,ma=new R,ul=new R,ga=new R,dh=new R,_a=new R;class Ke extends ct{constructor(e=new dt,t=new Kt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(r,e);const o=this.morphTargetInfluences;if(s&&o){ga.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const u=o[l],h=s[l];u!==0&&(ul.fromBufferAttribute(h,e),a?ga.addScaledVector(ul,u):ga.addScaledVector(ul.sub(t),u))}t.add(ga)}return t}raycast(e,t){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),fa.copy(i.boundingSphere),fa.applyMatrix4(s),mi.copy(e.ray).recast(e.near),!(fa.containsPoint(mi.origin)===!1&&(mi.intersectSphere(fa,hh)===null||mi.origin.distanceToSquared(hh)>(e.far-e.near)**2))&&(uh.copy(s).invert(),mi.copy(e.ray).applyMatrix4(uh),!(i.boundingBox!==null&&mi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,mi)))}_computeIntersections(e,t,i){let r;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,h=s.attributes.normal,d=s.groups,f=s.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,m=d.length;g<m;g++){const A=d[g],p=a[A.materialIndex],b=Math.max(A.start,f.start),M=Math.min(o.count,Math.min(A.start+A.count,f.start+f.count));for(let E=b,_=M;E<_;E+=3){const y=o.getX(E),S=o.getX(E+1),C=o.getX(E+2);r=Ea(this,p,e,i,c,u,h,y,S,C),r&&(r.faceIndex=Math.floor(E/3),r.face.materialIndex=A.materialIndex,t.push(r))}}else{const g=Math.max(0,f.start),m=Math.min(o.count,f.start+f.count);for(let A=g,p=m;A<p;A+=3){const b=o.getX(A),M=o.getX(A+1),E=o.getX(A+2);r=Ea(this,a,e,i,c,u,h,b,M,E),r&&(r.faceIndex=Math.floor(A/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,m=d.length;g<m;g++){const A=d[g],p=a[A.materialIndex],b=Math.max(A.start,f.start),M=Math.min(l.count,Math.min(A.start+A.count,f.start+f.count));for(let E=b,_=M;E<_;E+=3){const y=E,S=E+1,C=E+2;r=Ea(this,p,e,i,c,u,h,y,S,C),r&&(r.faceIndex=Math.floor(E/3),r.face.materialIndex=A.materialIndex,t.push(r))}}else{const g=Math.max(0,f.start),m=Math.min(l.count,f.start+f.count);for(let A=g,p=m;A<p;A+=3){const b=A,M=A+1,E=A+2;r=Ea(this,a,e,i,c,u,h,b,M,E),r&&(r.faceIndex=Math.floor(A/3),t.push(r))}}}}function j_(n,e,t,i,r,s,a,o){let l;if(e.side===qt?l=i.intersectTriangle(a,s,r,!0,o):l=i.intersectTriangle(r,s,a,e.side===Yn,o),l===null)return null;_a.copy(o),_a.applyMatrix4(n.matrixWorld);const c=t.ray.origin.distanceTo(_a);return c<t.near||c>t.far?null:{distance:c,point:_a.clone(),object:n}}function Ea(n,e,t,i,r,s,a,o,l,c){n.getVertexPosition(o,pa),n.getVertexPosition(l,Aa),n.getVertexPosition(c,ma);const u=j_(n,e,t,i,pa,Aa,ma,dh);if(u){const h=new R;dn.getBarycoord(dh,pa,Aa,ma,h),r&&(u.uv=dn.getInterpolatedAttribute(r,o,l,c,h,new we)),s&&(u.uv1=dn.getInterpolatedAttribute(s,o,l,c,h,new we)),a&&(u.normal=dn.getInterpolatedAttribute(a,o,l,c,h,new R),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new R,materialIndex:0};dn.getNormal(pa,Aa,ma,d.normal),u.face=d,u.barycoord=h}return u}class qn extends dt{constructor(e=1,t=1,i=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:a};const o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],u=[],h=[];let d=0,f=0;g("z","y","x",-1,-1,i,t,e,a,s,0),g("z","y","x",1,-1,i,t,-e,a,s,1),g("x","z","y",1,1,e,i,t,r,a,2),g("x","z","y",1,-1,e,i,-t,r,a,3),g("x","y","z",1,-1,e,t,i,r,s,4),g("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new st(c,3)),this.setAttribute("normal",new st(u,3)),this.setAttribute("uv",new st(h,2));function g(m,A,p,b,M,E,_,y,S,C,v){const x=E/S,T=_/C,D=E/2,U=_/2,N=y/2,Q=S+1,G=C+1;let X=0,V=0;const ee=new R;for(let Z=0;Z<G;Z++){const se=Z*T-U;for(let pe=0;pe<Q;pe++){const Ue=pe*x-D;ee[m]=Ue*b,ee[A]=se*M,ee[p]=N,c.push(ee.x,ee.y,ee.z),ee[m]=0,ee[A]=0,ee[p]=y>0?1:-1,u.push(ee.x,ee.y,ee.z),h.push(pe/S),h.push(1-Z/C),X+=1}}for(let Z=0;Z<C;Z++)for(let se=0;se<S;se++){const pe=d+se+Q*Z,Ue=d+se+Q*(Z+1),We=d+(se+1)+Q*(Z+1),Ge=d+(se+1)+Q*Z;l.push(pe,Ue,Ge),l.push(Ue,We,Ge),V+=6}o.addGroup(f,V,v),f+=V,d+=X}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function zr(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function zt(n){const e={};for(let t=0;t<n.length;t++){const i=zr(n[t]);for(const r in i)e[r]=i[r]}return e}function X_(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function jf(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Je.workingColorSpace}const Xf={clone:zr,merge:zt};var Y_=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,K_=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Kn extends nn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Y_,this.fragmentShader=K_,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=zr(e.uniforms),this.uniformsGroups=X_(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const r in this.uniforms){const a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}}class Yf extends ct{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new De,this.projectionMatrix=new De,this.projectionMatrixInverse=new De,this.coordinateSystem=Rn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const ni=new R,fh=new we,ph=new we;class Wt extends Yf{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Vr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Ls*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Vr*2*Math.atan(Math.tan(Ls*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){ni.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ni.x,ni.y).multiplyScalar(-e/ni.z),ni.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ni.x,ni.y).multiplyScalar(-e/ni.z)}getViewSize(e,t){return this.getViewBounds(e,fh,ph),t.subVectors(ph,fh)}setViewOffset(e,t,i,r,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Ls*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*r/l,t-=a.offsetY*i/c,r*=a.width/l,i*=a.height/c}const o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const fr=-90,pr=1;class J_ extends ct{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new Wt(fr,pr,e,t);r.layers=this.layers,this.add(r);const s=new Wt(fr,pr,e,t);s.layers=this.layers,this.add(s);const a=new Wt(fr,pr,e,t);a.layers=this.layers,this.add(a);const o=new Wt(fr,pr,e,t);o.layers=this.layers,this.add(o);const l=new Wt(fr,pr,e,t);l.layers=this.layers,this.add(l);const c=new Wt(fr,pr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,r,s,a,o,l]=t;for(const c of t)this.remove(c);if(e===Rn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===fo)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const m=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,s),e.setRenderTarget(i,1,r),e.render(t,a),e.setRenderTarget(i,2,r),e.render(t,o),e.setRenderTarget(i,3,r),e.render(t,l),e.setRenderTarget(i,4,r),e.render(t,c),i.texture.generateMipmaps=m,e.setRenderTarget(i,5,r),e.render(t,u),e.setRenderTarget(h,d,f),e.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class Kf extends Tt{constructor(e=[],t=ki,i,r,s,a,o,l,c,u){super(e,t,i,r,s,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Z_ extends Gi{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new Kf(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new qn(5,5,5),s=new Kn({name:"CubemapFromEquirect",uniforms:zr(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:qt,blending:oi});s.uniforms.tEquirect.value=t;const a=new Ke(r,s),o=t.minFilter;return t.minFilter===vn&&(t.minFilter=Ut),new J_(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){const s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,r);e.setRenderTarget(s)}}class mt extends ct{constructor(){super(),this.isGroup=!0,this.type="Group"}}const $_={type:"move"};class hl{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new mt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new mt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new mt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const m of e.hand.values()){const A=t.getJointPose(m,i),p=this._getHandJoint(c,m);A!==null&&(p.matrix.fromArray(A.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=A.radius),p.visible=A!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent($_)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new mt;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}class au{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new be(e),this.near=t,this.far=i}clone(){return new au(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Ah extends ct{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new jt,this.environmentIntensity=1,this.environmentRotation=new jt,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class wo{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Tc,this.updateRanges=[],this.version=0,this.uuid=bn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[i+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Gt=new R;class Vi{constructor(e,t,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.applyMatrix4(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.applyNormalMatrix(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.transformDirection(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=En(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=lt(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=En(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=En(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=En(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=En(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array),s=lt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new tt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new Vi(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class ou extends nn{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new be(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let Ar;const os=new R,mr=new R,gr=new R,_r=new we,ls=new we,Jf=new De,va=new R,cs=new R,ba=new R,mh=new we,dl=new we,gh=new we;class Rc extends ct{constructor(e=new ou){if(super(),this.isSprite=!0,this.type="Sprite",Ar===void 0){Ar=new dt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new wo(t,5);Ar.setIndex([0,1,2,0,2,3]),Ar.setAttribute("position",new Vi(i,3,0,!1)),Ar.setAttribute("uv",new Vi(i,2,3,!1))}this.geometry=Ar,this.material=e,this.center=new we(.5,.5),this.count=1}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),mr.setFromMatrixScale(this.matrixWorld),Jf.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),gr.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&mr.multiplyScalar(-gr.z);const i=this.material.rotation;let r,s;i!==0&&(s=Math.cos(i),r=Math.sin(i));const a=this.center;xa(va.set(-.5,-.5,0),gr,a,mr,r,s),xa(cs.set(.5,-.5,0),gr,a,mr,r,s),xa(ba.set(.5,.5,0),gr,a,mr,r,s),mh.set(0,0),dl.set(1,0),gh.set(1,1);let o=e.ray.intersectTriangle(va,cs,ba,!1,os);if(o===null&&(xa(cs.set(-.5,.5,0),gr,a,mr,r,s),dl.set(0,1),o=e.ray.intersectTriangle(va,ba,cs,!1,os),o===null))return;const l=e.ray.origin.distanceTo(os);l<e.near||l>e.far||t.push({distance:l,point:os.clone(),uv:dn.getInterpolation(os,va,cs,ba,mh,dl,gh,new we),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function xa(n,e,t,i,r,s){_r.subVectors(n,t).addScalar(.5).multiply(i),r!==void 0?(ls.x=s*_r.x-r*_r.y,ls.y=r*_r.x+s*_r.y):ls.copy(_r),n.copy(e),n.x+=ls.x,n.y+=ls.y,n.applyMatrix4(Jf)}const _h=new R,Eh=new nt,vh=new nt,eE=new R,bh=new De,ya=new R,fl=new Dn,xh=new De,pl=new Co;class Zf extends Ke{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Xu,this.bindMatrix=new De,this.bindMatrixInverse=new De,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new xn),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,ya),this.boundingBox.expandByPoint(ya)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Dn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,ya),this.boundingSphere.expandByPoint(ya)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const i=this.material,r=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),fl.copy(this.boundingSphere),fl.applyMatrix4(r),e.ray.intersectsSphere(fl)!==!1&&(xh.copy(r).invert(),pl.copy(e.ray).applyMatrix4(xh),!(this.boundingBox!==null&&pl.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,pl)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new nt,t=this.geometry.attributes.skinWeight;for(let i=0,r=t.count;i<r;i++){e.fromBufferAttribute(t,i);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Xu?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Jg?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const i=this.skeleton,r=this.geometry;Eh.fromBufferAttribute(r.attributes.skinIndex,e),vh.fromBufferAttribute(r.attributes.skinWeight,e),_h.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const a=vh.getComponent(s);if(a!==0){const o=Eh.getComponent(s);bh.multiplyMatrices(i.bones[o].matrixWorld,i.boneInverses[o]),t.addScaledVector(eE.copy(_h).applyMatrix4(bh),a)}}return t.applyMatrix4(this.bindMatrixInverse)}}class $f extends ct{constructor(){super(),this.isBone=!0,this.type="Bone"}}class lu extends Tt{constructor(e=null,t=1,i=1,r,s,a,o,l,c=Nt,u=Nt,h,d){super(null,a,o,l,c,u,r,s,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const yh=new De,tE=new De;class Xr{constructor(e=[],t=[]){this.uuid=bn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new De)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new De;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,a=e.length;s<a;s++){const o=e[s]?e[s].matrixWorld:tE;yh.multiplyMatrices(o,t[s]),yh.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new Xr(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const i=new lu(t,e,e,Pt,kt);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){const s=e.bones[i];let a=t[s];a===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),a=new $f),this.bones.push(a),this.boneInverses.push(new De().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){const a=t[r];e.bones.push(a.uuid);const o=i[r];e.boneInverses.push(o.toArray())}return e}}class Bc extends tt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Er=new De,Mh=new De,Ma=[],Ih=new xn,nE=new De,us=new Ke,hs=new Dn;class iE extends Ke{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Bc(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,nE)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new xn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Er),Ih.copy(e.boundingBox).applyMatrix4(Er),this.boundingBox.union(Ih)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Dn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Er),hs.copy(e.boundingSphere).applyMatrix4(Er),this.boundingSphere.union(hs)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,a=e*s+1;for(let o=0;o<i.length;o++)i[o]=r[a+o]}raycast(e,t){const i=this.matrixWorld,r=this.count;if(us.geometry=this.geometry,us.material=this.material,us.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),hs.copy(this.boundingSphere),hs.applyMatrix4(i),e.ray.intersectsSphere(hs)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,Er),Mh.multiplyMatrices(i,Er),us.matrixWorld=Mh,us.raycast(e,Ma);for(let a=0,o=Ma.length;a<o;a++){const l=Ma[a];l.instanceId=s,l.object=this,t.push(l)}Ma.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Bc(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new lu(new Float32Array(r*this.count),r,this.count,ai,kt));const s=this.morphTexture.source.data.data;let a=0;for(let c=0;c<i.length;c++)a+=i[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=r*e;s[l]=o,s.set(i,l+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Al=new R,rE=new R,sE=new Le;class Mi{constructor(e=new R(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const r=Al.subVectors(i,t).cross(rE.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const i=e.delta(Al),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||sE.getNormalMatrix(e),r=this.coplanarPoint(Al).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const gi=new Dn,aE=new we(.5,.5),Ia=new R;class cu{constructor(e=new Mi,t=new Mi,i=new Mi,r=new Mi,s=new Mi,a=new Mi){this.planes=[e,t,i,r,s,a]}set(e,t,i,r,s,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(r),o[4].copy(s),o[5].copy(a),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=Rn,i=!1){const r=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],u=s[4],h=s[5],d=s[6],f=s[7],g=s[8],m=s[9],A=s[10],p=s[11],b=s[12],M=s[13],E=s[14],_=s[15];if(r[0].setComponents(c-a,f-u,p-g,_-b).normalize(),r[1].setComponents(c+a,f+u,p+g,_+b).normalize(),r[2].setComponents(c+o,f+h,p+m,_+M).normalize(),r[3].setComponents(c-o,f-h,p-m,_-M).normalize(),i)r[4].setComponents(l,d,A,E).normalize(),r[5].setComponents(c-l,f-d,p-A,_-E).normalize();else if(r[4].setComponents(c-l,f-d,p-A,_-E).normalize(),t===Rn)r[5].setComponents(c+l,f+d,p+A,_+E).normalize();else if(t===fo)r[5].setComponents(l,d,A,E).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),gi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),gi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(gi)}intersectsSprite(e){gi.center.set(0,0,0);const t=aE.distanceTo(e.center);return gi.radius=.7071067811865476+t,gi.applyMatrix4(e.matrixWorld),this.intersectsSphere(gi)}intersectsSphere(e){const t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const r=t[i];if(Ia.x=r.normal.x>0?e.max.x:e.min.x,Ia.y=r.normal.y>0?e.max.y:e.min.y,Ia.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Ia)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class ji extends nn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new be(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const po=new R,Ao=new R,Sh=new De,ds=new Co,Sa=new Dn,ml=new R,Ch=new R;class To extends ct{constructor(e=new dt,t=new ji){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[0];for(let r=1,s=t.count;r<s;r++)po.fromBufferAttribute(t,r-1),Ao.fromBufferAttribute(t,r),i[r]=i[r-1],i[r]+=po.distanceTo(Ao);e.setAttribute("lineDistance",new st(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Sa.copy(i.boundingSphere),Sa.applyMatrix4(r),Sa.radius+=s,e.ray.intersectsSphere(Sa)===!1)return;Sh.copy(r).invert(),ds.copy(e.ray).applyMatrix4(Sh);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,u=i.index,d=i.attributes.position;if(u!==null){const f=Math.max(0,a.start),g=Math.min(u.count,a.start+a.count);for(let m=f,A=g-1;m<A;m+=c){const p=u.getX(m),b=u.getX(m+1),M=Ca(this,e,ds,l,p,b,m);M&&t.push(M)}if(this.isLineLoop){const m=u.getX(g-1),A=u.getX(f),p=Ca(this,e,ds,l,m,A,g-1);p&&t.push(p)}}else{const f=Math.max(0,a.start),g=Math.min(d.count,a.start+a.count);for(let m=f,A=g-1;m<A;m+=c){const p=Ca(this,e,ds,l,m,m+1,m);p&&t.push(p)}if(this.isLineLoop){const m=Ca(this,e,ds,l,g-1,f,g-1);m&&t.push(m)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Ca(n,e,t,i,r,s,a){const o=n.geometry.attributes.position;if(po.fromBufferAttribute(o,r),Ao.fromBufferAttribute(o,s),t.distanceSqToSegment(po,Ao,ml,Ch)>i)return;ml.applyMatrix4(n.matrixWorld);const c=e.ray.origin.distanceTo(ml);if(!(c<e.near||c>e.far))return{distance:c,point:Ch.clone().applyMatrix4(n.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:n}}const wh=new R,Th=new R;class Js extends To{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[];for(let r=0,s=t.count;r<s;r+=2)wh.fromBufferAttribute(t,r),Th.fromBufferAttribute(t,r+1),i[r]=r===0?0:i[r-1],i[r+1]=i[r]+wh.distanceTo(Th);e.setAttribute("lineDistance",new st(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class oE extends To{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class uu extends nn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new be(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Rh=new De,Lc=new Co,wa=new Dn,Ta=new R;class ep extends ct{constructor(e=new dt,t=new uu){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),wa.copy(i.boundingSphere),wa.applyMatrix4(r),wa.radius+=s,e.ray.intersectsSphere(wa)===!1)return;Rh.copy(r).invert(),Lc.copy(e.ray).applyMatrix4(Rh);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,h=i.attributes.position;if(c!==null){const d=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let g=d,m=f;g<m;g++){const A=c.getX(g);Ta.fromBufferAttribute(h,A),Bh(Ta,A,l,r,e,t,this)}}else{const d=Math.max(0,a.start),f=Math.min(h.count,a.start+a.count);for(let g=d,m=f;g<m;g++)Ta.fromBufferAttribute(h,g),Bh(Ta,g,l,r,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Bh(n,e,t,i,r,s,a){const o=Lc.distanceSqToPoint(n);if(o<t){const l=new R;Lc.closestPointToPoint(n,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class Ro extends Tt{constructor(e,t,i,r,s,a,o,l,c,u,h,d){super(null,a,o,l,c,u,r,s,h,d),this.isCompressedTexture=!0,this.image={width:t,height:i},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}class lE extends Ro{constructor(e,t,i,r,s,a){super(e,t,i,s,a),this.isCompressedArrayTexture=!0,this.image.depth=r,this.wrapR=Wn,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class cE extends Ro{constructor(e,t,i){super(void 0,e[0].width,e[0].height,t,i,ki),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=e}}class tp extends Tt{constructor(e,t,i,r,s,a,o,l,c){super(e,t,i,r,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class np extends Tt{constructor(e,t,i=Hi,r,s,a,o=Nt,l=Nt,c,u=Hs,h=1){if(u!==Hs&&u!==Gs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:h};super(d,r,s,a,o,l,u,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new su(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class ip extends Tt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class mo extends dt{constructor(e=1,t=1,i=4,r=8,s=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:i,radialSegments:r,heightSegments:s},t=Math.max(0,t),i=Math.max(1,Math.floor(i)),r=Math.max(3,Math.floor(r)),s=Math.max(1,Math.floor(s));const a=[],o=[],l=[],c=[],u=t/2,h=Math.PI/2*e,d=t,f=2*h+d,g=i*2+s,m=r+1,A=new R,p=new R;for(let b=0;b<=g;b++){let M=0,E=0,_=0,y=0;if(b<=i){const v=b/i,x=v*Math.PI/2;E=-u-e*Math.cos(x),_=e*Math.sin(x),y=-e*Math.cos(x),M=v*h}else if(b<=i+s){const v=(b-i)/s;E=-u+v*t,_=e,y=0,M=h+v*d}else{const v=(b-i-s)/i,x=v*Math.PI/2;E=u+e*Math.sin(x),_=e*Math.cos(x),y=e*Math.sin(x),M=h+d+v*h}const S=Math.max(0,Math.min(1,M/f));let C=0;b===0?C=.5/r:b===g&&(C=-.5/r);for(let v=0;v<=r;v++){const x=v/r,T=x*Math.PI*2,D=Math.sin(T),U=Math.cos(T);p.x=-_*U,p.y=E,p.z=_*D,o.push(p.x,p.y,p.z),A.set(-_*U,y,_*D),A.normalize(),l.push(A.x,A.y,A.z),c.push(x+C,S)}if(b>0){const v=(b-1)*m;for(let x=0;x<r;x++){const T=v+x,D=v+x+1,U=b*m+x,N=b*m+x+1;a.push(T,D,U),a.push(D,N,U)}}}this.setIndex(a),this.setAttribute("position",new st(o,3)),this.setAttribute("normal",new st(l,3)),this.setAttribute("uv",new st(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new mo(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}}class Rr extends dt{constructor(e=1,t=32,i=0,r=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:r},t=Math.max(3,t);const s=[],a=[],o=[],l=[],c=new R,u=new we;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){const f=i+h/t*r;c.x=e*Math.cos(f),c.y=e*Math.sin(f),a.push(c.x,c.y,c.z),o.push(0,0,1),u.x=(a[d]/e+1)/2,u.y=(a[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new st(a,3)),this.setAttribute("normal",new st(o,3)),this.setAttribute("uv",new st(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Rr(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class Wr extends dt{constructor(e=1,t=1,i=1,r=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;r=Math.floor(r),s=Math.floor(s);const u=[],h=[],d=[],f=[];let g=0;const m=[],A=i/2;let p=0;b(),a===!1&&(e>0&&M(!0),t>0&&M(!1)),this.setIndex(u),this.setAttribute("position",new st(h,3)),this.setAttribute("normal",new st(d,3)),this.setAttribute("uv",new st(f,2));function b(){const E=new R,_=new R;let y=0;const S=(t-e)/i;for(let C=0;C<=s;C++){const v=[],x=C/s,T=x*(t-e)+e;for(let D=0;D<=r;D++){const U=D/r,N=U*l+o,Q=Math.sin(N),G=Math.cos(N);_.x=T*Q,_.y=-x*i+A,_.z=T*G,h.push(_.x,_.y,_.z),E.set(Q,S,G).normalize(),d.push(E.x,E.y,E.z),f.push(U,1-x),v.push(g++)}m.push(v)}for(let C=0;C<r;C++)for(let v=0;v<s;v++){const x=m[v][C],T=m[v+1][C],D=m[v+1][C+1],U=m[v][C+1];(e>0||v!==0)&&(u.push(x,T,U),y+=3),(t>0||v!==s-1)&&(u.push(T,D,U),y+=3)}c.addGroup(p,y,0),p+=y}function M(E){const _=g,y=new we,S=new R;let C=0;const v=E===!0?e:t,x=E===!0?1:-1;for(let D=1;D<=r;D++)h.push(0,A*x,0),d.push(0,x,0),f.push(.5,.5),g++;const T=g;for(let D=0;D<=r;D++){const N=D/r*l+o,Q=Math.cos(N),G=Math.sin(N);S.x=v*G,S.y=A*x,S.z=v*Q,h.push(S.x,S.y,S.z),d.push(0,x,0),y.x=Q*.5+.5,y.y=G*.5*x+.5,f.push(y.x,y.y),g++}for(let D=0;D<r;D++){const U=_+D,N=T+D;E===!0?u.push(N,N+1,U):u.push(N+1,N,U),C+=3}c.addGroup(p,C,E===!0?1:2),p+=C}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Wr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Bo extends Wr{constructor(e=1,t=1,i=32,r=1,s=!1,a=0,o=Math.PI*2){super(0,e,t,i,r,s,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Bo(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class hu extends dt{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};const s=[],a=[];o(r),c(i),u(),this.setAttribute("position",new st(s,3)),this.setAttribute("normal",new st(s.slice(),3)),this.setAttribute("uv",new st(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(b){const M=new R,E=new R,_=new R;for(let y=0;y<t.length;y+=3)f(t[y+0],M),f(t[y+1],E),f(t[y+2],_),l(M,E,_,b)}function l(b,M,E,_){const y=_+1,S=[];for(let C=0;C<=y;C++){S[C]=[];const v=b.clone().lerp(E,C/y),x=M.clone().lerp(E,C/y),T=y-C;for(let D=0;D<=T;D++)D===0&&C===y?S[C][D]=v:S[C][D]=v.clone().lerp(x,D/T)}for(let C=0;C<y;C++)for(let v=0;v<2*(y-C)-1;v++){const x=Math.floor(v/2);v%2===0?(d(S[C][x+1]),d(S[C+1][x]),d(S[C][x])):(d(S[C][x+1]),d(S[C+1][x+1]),d(S[C+1][x]))}}function c(b){const M=new R;for(let E=0;E<s.length;E+=3)M.x=s[E+0],M.y=s[E+1],M.z=s[E+2],M.normalize().multiplyScalar(b),s[E+0]=M.x,s[E+1]=M.y,s[E+2]=M.z}function u(){const b=new R;for(let M=0;M<s.length;M+=3){b.x=s[M+0],b.y=s[M+1],b.z=s[M+2];const E=A(b)/2/Math.PI+.5,_=p(b)/Math.PI+.5;a.push(E,1-_)}g(),h()}function h(){for(let b=0;b<a.length;b+=6){const M=a[b+0],E=a[b+2],_=a[b+4],y=Math.max(M,E,_),S=Math.min(M,E,_);y>.9&&S<.1&&(M<.2&&(a[b+0]+=1),E<.2&&(a[b+2]+=1),_<.2&&(a[b+4]+=1))}}function d(b){s.push(b.x,b.y,b.z)}function f(b,M){const E=b*3;M.x=e[E+0],M.y=e[E+1],M.z=e[E+2]}function g(){const b=new R,M=new R,E=new R,_=new R,y=new we,S=new we,C=new we;for(let v=0,x=0;v<s.length;v+=9,x+=6){b.set(s[v+0],s[v+1],s[v+2]),M.set(s[v+3],s[v+4],s[v+5]),E.set(s[v+6],s[v+7],s[v+8]),y.set(a[x+0],a[x+1]),S.set(a[x+2],a[x+3]),C.set(a[x+4],a[x+5]),_.copy(b).add(M).add(E).divideScalar(3);const T=A(_);m(y,x+0,b,T),m(S,x+2,M,T),m(C,x+4,E,T)}}function m(b,M,E,_){_<0&&b.x===1&&(a[M]=b.x-1),E.x===0&&E.z===0&&(a[M]=_/2/Math.PI+.5)}function A(b){return Math.atan2(b.z,-b.x)}function p(b){return Math.atan2(-b.y,Math.sqrt(b.x*b.x+b.z*b.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new hu(e.vertices,e.indices,e.radius,e.details)}}class du extends hu{constructor(e=1,t=0){const i=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],r=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(i,r,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new du(e.radius,e.detail)}}class Yr extends dt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};const s=e/2,a=t/2,o=Math.floor(i),l=Math.floor(r),c=o+1,u=l+1,h=e/o,d=t/l,f=[],g=[],m=[],A=[];for(let p=0;p<u;p++){const b=p*d-a;for(let M=0;M<c;M++){const E=M*h-s;g.push(E,-b,0),m.push(0,0,1),A.push(M/o),A.push(1-p/l)}}for(let p=0;p<l;p++)for(let b=0;b<o;b++){const M=b+c*p,E=b+c*(p+1),_=b+1+c*(p+1),y=b+1+c*p;f.push(M,E,y),f.push(E,_,y)}this.setIndex(f),this.setAttribute("position",new st(g,3)),this.setAttribute("normal",new st(m,3)),this.setAttribute("uv",new st(A,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Yr(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ks extends dt{constructor(e=1,t=32,i=16,r=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:r,phiLength:s,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const u=[],h=new R,d=new R,f=[],g=[],m=[],A=[];for(let p=0;p<=i;p++){const b=[],M=p/i;let E=0;p===0&&a===0?E=.5/t:p===i&&l===Math.PI&&(E=-.5/t);for(let _=0;_<=t;_++){const y=_/t;h.x=-e*Math.cos(r+y*s)*Math.sin(a+M*o),h.y=e*Math.cos(a+M*o),h.z=e*Math.sin(r+y*s)*Math.sin(a+M*o),g.push(h.x,h.y,h.z),d.copy(h).normalize(),m.push(d.x,d.y,d.z),A.push(y+E,1-M),b.push(c++)}u.push(b)}for(let p=0;p<i;p++)for(let b=0;b<t;b++){const M=u[p][b+1],E=u[p][b],_=u[p+1][b],y=u[p+1][b+1];(p!==0||a>0)&&f.push(M,E,y),(p!==i-1||l<Math.PI)&&f.push(E,_,y)}this.setIndex(f),this.setAttribute("position",new st(g,3)),this.setAttribute("normal",new st(m,3)),this.setAttribute("uv",new st(A,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ks(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Lo extends dt{constructor(e=1,t=.4,i=12,r=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:r,arc:s},i=Math.floor(i),r=Math.floor(r);const a=[],o=[],l=[],c=[],u=new R,h=new R,d=new R;for(let f=0;f<=i;f++)for(let g=0;g<=r;g++){const m=g/r*s,A=f/i*Math.PI*2;h.x=(e+t*Math.cos(A))*Math.cos(m),h.y=(e+t*Math.cos(A))*Math.sin(m),h.z=t*Math.sin(A),o.push(h.x,h.y,h.z),u.x=e*Math.cos(m),u.y=e*Math.sin(m),d.subVectors(h,u).normalize(),l.push(d.x,d.y,d.z),c.push(g/r),c.push(f/i)}for(let f=1;f<=i;f++)for(let g=1;g<=r;g++){const m=(r+1)*f+g-1,A=(r+1)*(f-1)+g-1,p=(r+1)*(f-1)+g,b=(r+1)*f+g;a.push(m,A,b),a.push(A,p,b)}this.setIndex(a),this.setAttribute("position",new st(o,3)),this.setAttribute("normal",new st(l,3)),this.setAttribute("uv",new st(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Lo(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class fu extends nn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new be(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=So,this.normalScale=new we(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Pn extends fu{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new we(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return je(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new be(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new be(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new be(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Ps extends nn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=So,this.normalScale=new we(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.combine=Yc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class uE extends nn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=i_,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class hE extends nn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Ra(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function dE(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function fE(n){function e(r,s){return n[r]-n[s]}const t=n.length,i=new Array(t);for(let r=0;r!==t;++r)i[r]=r;return i.sort(e),i}function Lh(n,e,t){const i=n.length,r=new n.constructor(i);for(let s=0,a=0;a!==i;++s){const o=t[s]*e;for(let l=0;l!==e;++l)r[a++]=n[o+l]}return r}function rp(n,e,t,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let a=s[i];if(a!==void 0)if(Array.isArray(a))do a=s[i],a!==void 0&&(e.push(s.time),t.push(...a)),s=n[r++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[i],a!==void 0&&(e.push(s.time),a.toArray(t,t.length)),s=n[r++];while(s!==void 0);else do a=s[i],a!==void 0&&(e.push(s.time),t.push(a)),s=n[r++];while(s!==void 0)}class Zs{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let i=this._cachedIndex,r=t[i],s=t[i-1];e:{t:{let a;n:{i:if(!(e<r)){for(let o=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(s=r,r=t[++i],e<r)break t}a=t.length;break n}if(!(e>=s)){const o=t[1];e<o&&(i=2,s=o);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break t}a=i,i=0;break n}break e}for(;i<a;){const o=i+a>>>1;e<t[o]?a=o:i=o+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let a=0;a!==r;++a)t[a]=i[s+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class pE extends Zs{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:wr,endingEnd:wr}}intervalChanged_(e,t,i){const r=this.parameterPositions;let s=e-2,a=e+1,o=r[s],l=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case Tr:s=e,o=2*t-i;break;case uo:s=r.length-2,o=t+r[s]-r[s+1];break;default:s=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Tr:a=e,l=2*i-t;break;case uo:a=1,l=i+r[1]-r[0];break;default:a=e-1,l=t}const c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=s*u,this._offsetNext=a*u}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,f=this._weightNext,g=(i-t)/(r-t),m=g*g,A=m*g,p=-d*A+2*d*m-d*g,b=(1+d)*A+(-1.5-2*d)*m+(-.5+d)*g+1,M=(-1-f)*A+(1.5+f)*m+.5*g,E=f*A-f*m;for(let _=0;_!==o;++_)s[_]=p*a[u+_]+b*a[c+_]+M*a[l+_]+E*a[h+_];return s}}class sp extends Zs{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=(i-t)/(r-t),h=1-u;for(let d=0;d!==o;++d)s[d]=a[c+d]*h+a[l+d]*u;return s}}class AE extends Zs{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}}class yn{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ra(t,this.TimeBufferType),this.values=Ra(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:Ra(e.times,Array),values:Ra(e.values,Array)};const r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new AE(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new sp(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new pE(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case qs:t=this.InterpolantFactoryMethodDiscrete;break;case js:t=this.InterpolantFactoryMethodLinear;break;case zo:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return console.warn("THREE.KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return qs;case this.InterpolantFactoryMethodLinear:return js;case this.InterpolantFactoryMethodSmooth:return zo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){const i=this.times,r=i.length;let s=0,a=r-1;for(;s!==r&&i[s]<e;)++s;for(;a!==-1&&i[a]>t;)--a;if(++a,s!==0||a!==r){s>=a&&(a=Math.max(a,1),s=a-1);const o=this.getValueSize();this.times=i.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const i=this.times,r=this.values,s=i.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){const l=i[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(r!==void 0&&dE(r))for(let o=0,l=r.length;o!==l;++o){const c=r[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===zo,s=e.length-1;let a=1;for(let o=1;o<s;++o){let l=!1;const c=e[o],u=e[o+1];if(c!==u&&(o!==1||c!==e[0]))if(r)l=!0;else{const h=o*i,d=h-i,f=h+i;for(let g=0;g!==i;++g){const m=t[h+g];if(m!==t[d+g]||m!==t[f+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const h=o*i,d=a*i;for(let f=0;f!==i;++f)t[d+f]=t[h+f]}++a}}if(s>0){e[a]=e[s];for(let o=s*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}}yn.prototype.ValueTypeName="";yn.prototype.TimeBufferType=Float32Array;yn.prototype.ValueBufferType=Float32Array;yn.prototype.DefaultInterpolation=js;class Kr extends yn{constructor(e,t,i){super(e,t,i)}}Kr.prototype.ValueTypeName="bool";Kr.prototype.ValueBufferType=Array;Kr.prototype.DefaultInterpolation=qs;Kr.prototype.InterpolantFactoryMethodLinear=void 0;Kr.prototype.InterpolantFactoryMethodSmooth=void 0;class ap extends yn{constructor(e,t,i,r){super(e,t,i,r)}}ap.prototype.ValueTypeName="color";class qr extends yn{constructor(e,t,i,r){super(e,t,i,r)}}qr.prototype.ValueTypeName="number";class mE extends Zs{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(r-t);let c=e*o;for(let u=c+o;c!==u;c+=4)Qe.slerpFlat(s,0,a,c-o,a,c,l);return s}}class zi extends yn{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new mE(this.times,this.values,this.getValueSize(),e)}}zi.prototype.ValueTypeName="quaternion";zi.prototype.InterpolantFactoryMethodSmooth=void 0;class Jr extends yn{constructor(e,t,i){super(e,t,i)}}Jr.prototype.ValueTypeName="string";Jr.prototype.ValueBufferType=Array;Jr.prototype.DefaultInterpolation=qs;Jr.prototype.InterpolantFactoryMethodLinear=void 0;Jr.prototype.InterpolantFactoryMethodSmooth=void 0;class Wi extends yn{constructor(e,t,i,r){super(e,t,i,r)}}Wi.prototype.ValueTypeName="vector";class go{constructor(e="",t=-1,i=[],r=iu){this.name=e,this.tracks=i,this.duration=t,this.blendMode=r,this.uuid=bn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],i=e.tracks,r=1/(e.fps||1);for(let a=0,o=i.length;a!==o;++a)t.push(_E(i[a]).scale(r));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s.userData=JSON.parse(e.userData||"{}"),s}static toJSON(e){const t=[],i=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let s=0,a=i.length;s!==a;++s)t.push(yn.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(e,t,i,r){const s=t.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);const u=fE(l);l=Lh(l,1,u),c=Lh(c,1,u),!r&&l[0]===0&&(l.push(s),c.push(c[0])),a.push(new qr(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/i))}return new this(e,-1,a)}static findByName(e,t){let i=e;if(!Array.isArray(e)){const r=e;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null}static CreateClipsFromMorphTargetSequences(e,t,i){const r={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],u=c.name.match(s);if(u&&u.length>1){const h=u[1];let d=r[h];d||(r[h]=d=[]),d.push(c)}}const a=[];for(const o in r)a.push(this.CreateFromMorphTargetSequence(o,r[o],t,i));return a}static parseAnimation(e,t){if(console.warn("THREE.AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const i=function(h,d,f,g,m){if(f.length!==0){const A=[],p=[];rp(f,A,p,g),A.length!==0&&m.push(new h(d,A,p))}},r=[],s=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let h=0;h<c.length;h++){const d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let g;for(g=0;g<d.length;g++)if(d[g].morphTargets)for(let m=0;m<d[g].morphTargets.length;m++)f[d[g].morphTargets[m]]=-1;for(const m in f){const A=[],p=[];for(let b=0;b!==d[g].morphTargets.length;++b){const M=d[g];A.push(M.time),p.push(M.morphTarget===m?1:0)}r.push(new qr(".morphTargetInfluence["+m+"]",A,p))}l=f.length*a}else{const f=".bones["+t[h].name+"]";i(Wi,f+".position",d,"pos",r),i(zi,f+".quaternion",d,"rot",r),i(Wi,f+".scale",d,"scl",r)}}return r.length===0?null:new this(s,l,r,o)}resetDuration(){const e=this.tracks;let t=0;for(let i=0,r=e.length;i!==r;++i){const s=this.tracks[i];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let i=0;i<this.tracks.length;i++)e.push(this.tracks[i].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}}function gE(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return qr;case"vector":case"vector2":case"vector3":case"vector4":return Wi;case"color":return ap;case"quaternion":return zi;case"bool":case"boolean":return Kr;case"string":return Jr}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function _E(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=gE(n.type);if(n.times===void 0){const t=[],i=[];rp(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}const jn={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class op{constructor(e,t,i){const r=this;let s=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.abortController=new AbortController,this.itemStart=function(u){o++,s===!1&&r.onStart!==void 0&&r.onStart(u,a,o),s=!0},this.itemEnd=function(u){a++,r.onProgress!==void 0&&r.onProgress(u,a,o),a===o&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){const h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){const f=c[h],g=c[h+1];if(f.global&&(f.lastIndex=0),f.test(u))return g}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}const EE=new op;class Xi{constructor(e){this.manager=e!==void 0?e:EE,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Xi.DEFAULT_MATERIAL_NAME="__DEFAULT";const Hn={};class vE extends Error{constructor(e,t){super(e),this.response=t}}class Us extends Xi{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=jn.get(`file:${e}`);if(s!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0),s;if(Hn[e]!==void 0){Hn[e].push({onLoad:t,onProgress:i,onError:r});return}Hn[e]=[],Hn[e].push({onLoad:t,onProgress:i,onError:r});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const u=Hn[e],h=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=d?parseInt(d):0,g=f!==0;let m=0;const A=new ReadableStream({start(p){b();function b(){h.read().then(({done:M,value:E})=>{if(M)p.close();else{m+=E.byteLength;const _=new ProgressEvent("progress",{lengthComputable:g,loaded:m,total:f});for(let y=0,S=u.length;y<S;y++){const C=u[y];C.onProgress&&C.onProgress(_)}p.enqueue(E),b()}},M=>{p.error(M)})}}});return new Response(A)}else throw new vE(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,o));case"json":return c.json();default:if(o==="")return c.text();{const h=/charset="?([^;"\s]*)"?/i.exec(o),d=h&&h[1]?h[1].toLowerCase():void 0,f=new TextDecoder(d);return c.arrayBuffer().then(g=>f.decode(g))}}}).then(c=>{jn.add(`file:${e}`,c);const u=Hn[e];delete Hn[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onLoad&&f.onLoad(c)}}).catch(c=>{const u=Hn[e];if(u===void 0)throw this.manager.itemError(e),c;delete Hn[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const vr=new WeakMap;class lp extends Xi{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=jn.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)s.manager.itemStart(e),setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0);else{let h=vr.get(a);h===void 0&&(h=[],vr.set(a,h)),h.push({onLoad:t,onError:r})}return a}const o=Xs("img");function l(){u(),t&&t(this);const h=vr.get(this)||[];for(let d=0;d<h.length;d++){const f=h[d];f.onLoad&&f.onLoad(this)}vr.delete(this),s.manager.itemEnd(e)}function c(h){u(),r&&r(h),jn.remove(`image:${e}`);const d=vr.get(this)||[];for(let f=0;f<d.length;f++){const g=d[f];g.onError&&g.onError(h)}vr.delete(this),s.manager.itemError(e),s.manager.itemEnd(e)}function u(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),jn.add(`image:${e}`,o),s.manager.itemStart(e),o.src=e,o}}class bE extends Xi{constructor(e){super(e)}load(e,t,i,r){const s=new Tt,a=new lp(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){s.image=o,s.needsUpdate=!0,t!==void 0&&t(s)},i,r),s}}class Do extends ct{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new be(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class xE extends Do{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.groundColor=new be(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const gl=new De,Dh=new R,Ph=new R;class pu{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new we(512,512),this.mapType=ze,this.map=null,this.mapPass=null,this.matrix=new De,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new cu,this._frameExtents=new we(1,1),this._viewportCount=1,this._viewports=[new nt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;Dh.setFromMatrixPosition(e.matrixWorld),t.position.copy(Dh),Ph.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ph),t.updateMatrixWorld(),gl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(gl,t.coordinateSystem,t.reversedDepth),t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(gl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class yE extends pu{constructor(){super(new Wt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,i=Vr*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height*this.aspect,s=e.distance||t.far;(i!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=i,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class ME extends Do{constructor(e,t,i=0,r=Math.PI/3,s=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.target=new ct,this.distance=i,this.angle=r,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new yE}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const Uh=new De,fs=new R,_l=new R;class IE extends pu{constructor(){super(new Wt(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new we(4,2),this._viewportCount=6,this._viewports=[new nt(2,1,1,1),new nt(0,1,1,1),new nt(3,1,1,1),new nt(1,1,1,1),new nt(3,0,1,1),new nt(1,0,1,1)],this._cubeDirections=[new R(1,0,0),new R(-1,0,0),new R(0,0,1),new R(0,0,-1),new R(0,1,0),new R(0,-1,0)],this._cubeUps=[new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,0,1),new R(0,0,-1)]}updateMatrices(e,t=0){const i=this.camera,r=this.matrix,s=e.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),fs.setFromMatrixPosition(e.matrixWorld),i.position.copy(fs),_l.copy(i.position),_l.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(_l),i.updateMatrixWorld(),r.makeTranslation(-fs.x,-fs.y,-fs.z),Uh.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Uh,i.coordinateSystem,i.reversedDepth)}}class SE extends Do{constructor(e,t,i=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new IE}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class Po extends Yf{constructor(e=-1,t=1,i=1,r=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,a=i+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class CE extends pu{constructor(){super(new Po(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class cp extends Do{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.target=new ct,this.shadow=new CE}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class Ns{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}const El=new WeakMap;class wE extends Xi{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=jn.get(`image-bitmap:${e}`);if(a!==void 0){if(s.manager.itemStart(e),a.then){a.then(c=>{if(El.has(a)===!0)r&&r(El.get(a)),s.manager.itemError(e),s.manager.itemEnd(e);else return t&&t(c),s.manager.itemEnd(e),c});return}return setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0),a}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return jn.add(`image-bitmap:${e}`,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){r&&r(c),El.set(l,c),jn.remove(`image-bitmap:${e}`),s.manager.itemError(e),s.manager.itemEnd(e)});jn.add(`image-bitmap:${e}`,l),s.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}class TE extends Wt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class RE{constructor(e,t,i){this.binding=e,this.valueSize=i;let r,s,a;switch(t){case"quaternion":r=this._slerp,s=this._slerpAdditive,a=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(i*6),this._workIndex=5;break;case"string":case"bool":r=this._select,s=this._select,a=this._setAdditiveIdentityOther,this.buffer=new Array(i*5);break;default:r=this._lerp,s=this._lerpAdditive,a=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(i*5)}this._mixBufferRegion=r,this._mixBufferRegionAdditive=s,this._setIdentity=a,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const i=this.buffer,r=this.valueSize,s=e*r+r;let a=this.cumulativeWeight;if(a===0){for(let o=0;o!==r;++o)i[s+o]=i[o];a=t}else{a+=t;const o=t/a;this._mixBufferRegion(i,s,0,o,r)}this.cumulativeWeight=a}accumulateAdditive(e){const t=this.buffer,i=this.valueSize,r=i*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,r,0,e,i),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,i=this.buffer,r=e*t+t,s=this.cumulativeWeight,a=this.cumulativeWeightAdditive,o=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const l=t*this._origIndex;this._mixBufferRegion(i,r,l,1-s,t)}a>0&&this._mixBufferRegionAdditive(i,r,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(i[l]!==i[l+t]){o.setValue(i,r);break}}saveOriginalState(){const e=this.binding,t=this.buffer,i=this.valueSize,r=i*this._origIndex;e.getValue(t,r);for(let s=i,a=r;s!==a;++s)t[s]=t[r+s%i];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let i=e;i<t;i++)this.buffer[i]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let i=0;i<this.valueSize;i++)this.buffer[t+i]=this.buffer[e+i]}_select(e,t,i,r,s){if(r>=.5)for(let a=0;a!==s;++a)e[t+a]=e[i+a]}_slerp(e,t,i,r){Qe.slerpFlat(e,t,e,t,e,i,r)}_slerpAdditive(e,t,i,r,s){const a=this._workIndex*s;Qe.multiplyQuaternionsFlat(e,a,e,t,e,i),Qe.slerpFlat(e,t,e,t,e,a,r)}_lerp(e,t,i,r,s){const a=1-r;for(let o=0;o!==s;++o){const l=t+o;e[l]=e[l]*a+e[i+o]*r}}_lerpAdditive(e,t,i,r,s){for(let a=0;a!==s;++a){const o=t+a;e[o]=e[o]+e[i+a]*r}}}const Au="\\[\\]\\.:\\/",BE=new RegExp("["+Au+"]","g"),mu="[^"+Au+"]",LE="[^"+Au.replace("\\.","")+"]",DE=/((?:WC+[\/:])*)/.source.replace("WC",mu),PE=/(WCOD+)?/.source.replace("WCOD",LE),UE=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",mu),NE=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",mu),FE=new RegExp("^"+DE+PE+UE+NE+"$"),OE=["material","materials","bones","map"];class kE{constructor(e,t,i){const r=i||rt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();const i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){const i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}}class rt{constructor(e,t,i){this.path=t,this.parsedPath=i||rt.parseTrackName(t),this.node=rt.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new rt.Composite(e,t,i):new rt(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(BE,"")}static parseTrackName(e){const t=FE.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){const s=i.nodeName.substring(r+1);OE.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){const i=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===t||o.uuid===t)return o;const l=i(o.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,i=t.objectName,r=t.propertyName;let s=t.propertyIndex;if(e||(e=rt.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const a=e[r];if(a===void 0){const c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}rt.Composite=kE;rt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};rt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};rt.prototype.GetterByBindingType=[rt.prototype._getValue_direct,rt.prototype._getValue_array,rt.prototype._getValue_arrayElement,rt.prototype._getValue_toArray];rt.prototype.SetterByBindingTypeAndVersioning=[[rt.prototype._setValue_direct,rt.prototype._setValue_direct_setNeedsUpdate,rt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_array,rt.prototype._setValue_array_setNeedsUpdate,rt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_arrayElement,rt.prototype._setValue_arrayElement_setNeedsUpdate,rt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_fromArray,rt.prototype._setValue_fromArray_setNeedsUpdate,rt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class QE{constructor(e,t,i=null,r=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=i,this.blendMode=r;const s=t.tracks,a=s.length,o=new Array(a),l={endingStart:wr,endingEnd:wr};for(let c=0;c!==a;++c){const u=s[c].createInterpolant(null);o[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=o,this._propertyBindings=new Array(a),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=$g,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,i=!1){if(e.fadeOut(t),this.fadeIn(t),i===!0){const r=this._clip.duration,s=e._clip.duration,a=s/r,o=r/s;e.warp(1,a,t),this.warp(o,1,t)}return this}crossFadeTo(e,t,i=!1){return e.crossFadeFrom(this,t,i)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,i){const r=this._mixer,s=r.time,a=this.timeScale;let o=this._timeScaleInterpolant;o===null&&(o=r._lendControlInterpolant(),this._timeScaleInterpolant=o);const l=o.parameterPositions,c=o.sampleValues;return l[0]=s,l[1]=s+i,c[0]=e/a,c[1]=t/a,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,i,r){if(!this.enabled){this._updateWeight(e);return}const s=this._startTime;if(s!==null){const l=(e-s)*i;l<0||i===0?t=0:(this._startTime=null,t=i*l)}t*=this._updateTimeScale(e);const a=this._updateTime(t),o=this._updateWeight(e);if(o>0){const l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case t_:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(a),c[u].accumulateAdditive(o);break;case iu:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(a),c[u].accumulate(r,o)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const i=this._weightInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopFading(),r===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const i=this._timeScaleInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,i=this.loop;let r=this.time+e,s=this._loopCount;const a=i===e_;if(e===0)return s===-1?r:a&&(s&1)===1?t-r:r;if(i===Zg){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(r>=t)r=t;else if(r<0)r=0;else{this.time=r;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,a)):this._setEndings(this.repetitions===0,!0,a)),r>=t||r<0){const o=Math.floor(r/t);r-=t*o,s+=Math.abs(o);const l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,r=e>0?t:0,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){const c=e<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=s,this.time=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}else this.time=r;if(a&&(s&1)===1)return t-r}return r}_setEndings(e,t,i){const r=this._interpolantSettings;i?(r.endingStart=Tr,r.endingEnd=Tr):(e?r.endingStart=this.zeroSlopeAtStart?Tr:wr:r.endingStart=uo,t?r.endingEnd=this.zeroSlopeAtEnd?Tr:wr:r.endingEnd=uo)}_scheduleFading(e,t,i){const r=this._mixer,s=r.time;let a=this._weightInterpolant;a===null&&(a=r._lendControlInterpolant(),this._weightInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=s,l[0]=t,o[1]=s+e,l[1]=i,this}}const HE=new Float32Array(1);class GE extends qi{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){const i=e._localRoot||this._root,r=e._clip.tracks,s=r.length,a=e._propertyBindings,o=e._interpolants,l=i.uuid,c=this._bindingsByRootAndName;let u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){const d=r[h],f=d.name;let g=u[f];if(g!==void 0)++g.referenceCount,a[h]=g;else{if(g=a[h],g!==void 0){g._cacheIndex===null&&(++g.referenceCount,this._addInactiveBinding(g,l,f));continue}const m=t&&t._propertyBindings[h].binding.parsedPath;g=new RE(rt.create(i,f,m),d.ValueTypeName,d.getValueSize()),++g.referenceCount,this._addInactiveBinding(g,l,f),a[h]=g}o[h].resultBuffer=g.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){const i=(e._localRoot||this._root).uuid,r=e._clip.uuid,s=this._actionsByClip[r];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,r,i)}const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){const t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,i){const r=this._actions,s=this._actionsByClip;let a=s[t];if(a===void 0)a={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=a;else{const o=a.knownActions;e._byClipCacheIndex=o.length,o.push(e)}e._cacheIndex=r.length,r.push(e),a.actionByRoot[i]=e}_removeInactiveAction(e){const t=this._actions,i=t[t.length-1],r=e._cacheIndex;i._cacheIndex=r,t[r]=i,t.pop(),e._cacheIndex=null;const s=e._clip.uuid,a=this._actionsByClip,o=a[s],l=o.knownActions,c=l[l.length-1],u=e._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),e._byClipCacheIndex=null;const h=o.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],l.length===0&&delete a[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){const t=this._actions,i=e._cacheIndex,r=this._nActiveActions++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackAction(e){const t=this._actions,i=e._cacheIndex,r=--this._nActiveActions,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_addInactiveBinding(e,t,i){const r=this._bindingsByRootAndName,s=this._bindings;let a=r[t];a===void 0&&(a={},r[t]=a),a[i]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){const t=this._bindings,i=e.binding,r=i.rootNode.uuid,s=i.path,a=this._bindingsByRootAndName,o=a[r],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete o[s],Object.keys(o).length===0&&delete a[r]}_lendBinding(e){const t=this._bindings,i=e._cacheIndex,r=this._nActiveBindings++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackBinding(e){const t=this._bindings,i=e._cacheIndex,r=--this._nActiveBindings,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_lendControlInterpolant(){const e=this._controlInterpolants,t=this._nActiveControlInterpolants++;let i=e[t];return i===void 0&&(i=new sp(new Float32Array(2),new Float32Array(2),1,HE),i.__cacheIndex=t,e[t]=i),i}_takeBackControlInterpolant(e){const t=this._controlInterpolants,i=e.__cacheIndex,r=--this._nActiveControlInterpolants,s=t[r];e.__cacheIndex=r,t[r]=e,s.__cacheIndex=i,t[i]=s}clipAction(e,t,i){const r=t||this._root,s=r.uuid;let a=typeof e=="string"?go.findByName(r,e):e;const o=a!==null?a.uuid:e,l=this._actionsByClip[o];let c=null;if(i===void 0&&(a!==null?i=a.blendMode:i=iu),l!==void 0){const h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===i)return h;c=l.knownActions[0],a===null&&(a=c._clip)}if(a===null)return null;const u=new QE(this,a,t,i);return this._bindAction(u,c),this._addInactiveAction(u,o,s),u}existingAction(e,t){const i=t||this._root,r=i.uuid,s=typeof e=="string"?go.findByName(i,e):e,a=s?s.uuid:e,o=this._actionsByClip[a];return o!==void 0&&o.actionByRoot[r]||null}stopAllAction(){const e=this._actions,t=this._nActiveActions;for(let i=t-1;i>=0;--i)e[i].stop();return this}update(e){e*=this.timeScale;const t=this._actions,i=this._nActiveActions,r=this.time+=e,s=Math.sign(e),a=this._accuIndex^=1;for(let c=0;c!==i;++c)t[c]._update(r,e,s,a);const o=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)o[c].apply(a);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){const t=this._actions,i=e.uuid,r=this._actionsByClip,s=r[i];if(s!==void 0){const a=s.knownActions;for(let o=0,l=a.length;o!==l;++o){const c=a[o];this._deactivateAction(c);const u=c._cacheIndex,h=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(c)}delete r[i]}}uncacheRoot(e){const t=e.uuid,i=this._actionsByClip;for(const a in i){const o=i[a].actionByRoot,l=o[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}const r=this._bindingsByRootAndName,s=r[t];if(s!==void 0)for(const a in s){const o=s[a];o.restoreOriginalState(),this._removeInactiveBinding(o)}}uncacheAction(e,t){const i=this.existingAction(e,t);i!==null&&(this._deactivateAction(i),this._removeInactiveAction(i))}}class Nh{constructor(e,t,i,r,s,a=!1){this.isGLBufferAttribute=!0,this.name="",this.buffer=e,this.type=t,this.itemSize=i,this.elementSize=r,this.count=s,this.normalized=a,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}}class VE extends Js{constructor(e=1){const t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],r=new dt;r.setAttribute("position",new st(t,3)),r.setAttribute("color",new st(i,3));const s=new ji({vertexColors:!0,toneMapped:!1});super(r,s),this.type="AxesHelper"}setColors(e,t,i){const r=new be,s=this.geometry.attributes.color.array;return r.set(e),r.toArray(s,0),r.toArray(s,3),r.set(t),r.toArray(s,6),r.toArray(s,9),r.set(i),r.toArray(s,12),r.toArray(s,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}function Fh(n,e,t,i){const r=zE(i);switch(t){case Ff:return n*e;case ai:return n*e/r.components*r.byteLength;case eu:return n*e/r.components*r.byteLength;case Bi:return n*e*2/r.components*r.byteLength;case tu:return n*e*2/r.components*r.byteLength;case Qs:return n*e*3/r.components*r.byteLength;case Pt:return n*e*4/r.components*r.byteLength;case nu:return n*e*4/r.components*r.byteLength;case Pr:case Ui:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ur:case Bs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case pc:case Vs:return Math.max(n,16)*Math.max(e,8)/4;case io:case Hr:return Math.max(n,8)*Math.max(e,8)/2;case ro:case zs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ws:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ni:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ac:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case mc:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case gc:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Nr:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case _c:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Ec:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case vc:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case bc:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case xc:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case yc:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Mc:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Ic:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Sc:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Gr:case Cc:case so:return Math.ceil(n/4)*Math.ceil(e/4)*16;case ao:case oo:return Math.ceil(n/4)*Math.ceil(e/4)*8;case lo:case co:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function zE(n){switch(n){case ze:case Uf:return{byteLength:1,components:1};case Os:case Nf:case hn:return{byteLength:2,components:1};case Zc:case $c:return{byteLength:2,components:4};case Hi:case Jc:case kt:return{byteLength:4,components:1};case Mo:case Io:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Oi}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Oi);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function up(){let n=null,e=!1,t=null,i=null;function r(s,a){t(s,a),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function WE(n){const e=new WeakMap;function t(o,l){const c=o.array,u=o.usage,h=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,u),o.onUploadCallback();let f;if(c instanceof Float32Array)f=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=n.HALF_FLOAT:f=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=n.SHORT;else if(c instanceof Uint32Array)f=n.UNSIGNED_INT;else if(c instanceof Int32Array)f=n.INT;else if(c instanceof Int8Array)f=n.BYTE;else if(c instanceof Uint8Array)f=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function i(o,l,c){const u=l.array,h=l.updateRanges;if(n.bindBuffer(c,o),h.length===0)n.bufferSubData(c,0,u);else{h.sort((f,g)=>f.start-g.start);let d=0;for(let f=1;f<h.length;f++){const g=h[d],m=h[f];m.start<=g.start+g.count+1?g.count=Math.max(g.count,m.start+m.count-g.start):(++d,h[d]=m)}h.length=d+1;for(let f=0,g=h.length;f<g;f++){const m=h[f];n.bufferSubData(c,m.start*u.BYTES_PER_ELEMENT,u,m.start,m.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var qE=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,jE=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,XE=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,YE=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,KE=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,JE=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ZE=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,$E=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,e0=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,t0=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,n0=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,i0=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,r0=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,s0=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,a0=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,o0=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,l0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,c0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,u0=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,h0=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,d0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,f0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,p0=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,A0=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,m0=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,g0=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,_0=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,E0=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,v0=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,b0=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,x0="gl_FragColor = linearToOutputTexel( gl_FragColor );",y0=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,M0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,I0=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,S0=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,C0=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,w0=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,T0=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,R0=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,B0=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,L0=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,D0=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,P0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,U0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,N0=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,F0=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,O0=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,k0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Q0=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,H0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,G0=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,V0=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,z0=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,W0=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,q0=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,j0=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,X0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Y0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,K0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,J0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Z0=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,$0=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ev=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,tv=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,nv=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,iv=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,rv=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,sv=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,av=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ov=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,lv=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,cv=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,uv=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,hv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,dv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,fv=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,pv=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Av=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,mv=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,gv=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,_v=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ev=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,vv=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,bv=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,xv=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,yv=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Mv=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Iv=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Sv=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Cv=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,wv=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Tv=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Rv=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Bv=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Lv=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Dv=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Pv=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Uv=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Nv=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Fv=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Ov=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,kv=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Qv=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Hv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Gv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Vv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,zv=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Wv=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,qv=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,jv=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Xv=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yv=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Kv=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Jv=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Zv=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,$v=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,eb=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,tb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,nb=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ib=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,rb=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sb=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,ab=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ob=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lb=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,cb=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,ub=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,hb=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,db=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,fb=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,pb=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ab=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,mb=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gb=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_b=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Eb=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,vb=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,bb=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,xb=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,yb=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Mb=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,He={alphahash_fragment:qE,alphahash_pars_fragment:jE,alphamap_fragment:XE,alphamap_pars_fragment:YE,alphatest_fragment:KE,alphatest_pars_fragment:JE,aomap_fragment:ZE,aomap_pars_fragment:$E,batching_pars_vertex:e0,batching_vertex:t0,begin_vertex:n0,beginnormal_vertex:i0,bsdfs:r0,iridescence_fragment:s0,bumpmap_pars_fragment:a0,clipping_planes_fragment:o0,clipping_planes_pars_fragment:l0,clipping_planes_pars_vertex:c0,clipping_planes_vertex:u0,color_fragment:h0,color_pars_fragment:d0,color_pars_vertex:f0,color_vertex:p0,common:A0,cube_uv_reflection_fragment:m0,defaultnormal_vertex:g0,displacementmap_pars_vertex:_0,displacementmap_vertex:E0,emissivemap_fragment:v0,emissivemap_pars_fragment:b0,colorspace_fragment:x0,colorspace_pars_fragment:y0,envmap_fragment:M0,envmap_common_pars_fragment:I0,envmap_pars_fragment:S0,envmap_pars_vertex:C0,envmap_physical_pars_fragment:O0,envmap_vertex:w0,fog_vertex:T0,fog_pars_vertex:R0,fog_fragment:B0,fog_pars_fragment:L0,gradientmap_pars_fragment:D0,lightmap_pars_fragment:P0,lights_lambert_fragment:U0,lights_lambert_pars_fragment:N0,lights_pars_begin:F0,lights_toon_fragment:k0,lights_toon_pars_fragment:Q0,lights_phong_fragment:H0,lights_phong_pars_fragment:G0,lights_physical_fragment:V0,lights_physical_pars_fragment:z0,lights_fragment_begin:W0,lights_fragment_maps:q0,lights_fragment_end:j0,logdepthbuf_fragment:X0,logdepthbuf_pars_fragment:Y0,logdepthbuf_pars_vertex:K0,logdepthbuf_vertex:J0,map_fragment:Z0,map_pars_fragment:$0,map_particle_fragment:ev,map_particle_pars_fragment:tv,metalnessmap_fragment:nv,metalnessmap_pars_fragment:iv,morphinstance_vertex:rv,morphcolor_vertex:sv,morphnormal_vertex:av,morphtarget_pars_vertex:ov,morphtarget_vertex:lv,normal_fragment_begin:cv,normal_fragment_maps:uv,normal_pars_fragment:hv,normal_pars_vertex:dv,normal_vertex:fv,normalmap_pars_fragment:pv,clearcoat_normal_fragment_begin:Av,clearcoat_normal_fragment_maps:mv,clearcoat_pars_fragment:gv,iridescence_pars_fragment:_v,opaque_fragment:Ev,packing:vv,premultiplied_alpha_fragment:bv,project_vertex:xv,dithering_fragment:yv,dithering_pars_fragment:Mv,roughnessmap_fragment:Iv,roughnessmap_pars_fragment:Sv,shadowmap_pars_fragment:Cv,shadowmap_pars_vertex:wv,shadowmap_vertex:Tv,shadowmask_pars_fragment:Rv,skinbase_vertex:Bv,skinning_pars_vertex:Lv,skinning_vertex:Dv,skinnormal_vertex:Pv,specularmap_fragment:Uv,specularmap_pars_fragment:Nv,tonemapping_fragment:Fv,tonemapping_pars_fragment:Ov,transmission_fragment:kv,transmission_pars_fragment:Qv,uv_pars_fragment:Hv,uv_pars_vertex:Gv,uv_vertex:Vv,worldpos_vertex:zv,background_vert:Wv,background_frag:qv,backgroundCube_vert:jv,backgroundCube_frag:Xv,cube_vert:Yv,cube_frag:Kv,depth_vert:Jv,depth_frag:Zv,distanceRGBA_vert:$v,distanceRGBA_frag:eb,equirect_vert:tb,equirect_frag:nb,linedashed_vert:ib,linedashed_frag:rb,meshbasic_vert:sb,meshbasic_frag:ab,meshlambert_vert:ob,meshlambert_frag:lb,meshmatcap_vert:cb,meshmatcap_frag:ub,meshnormal_vert:hb,meshnormal_frag:db,meshphong_vert:fb,meshphong_frag:pb,meshphysical_vert:Ab,meshphysical_frag:mb,meshtoon_vert:gb,meshtoon_frag:_b,points_vert:Eb,points_frag:vb,shadow_vert:bb,shadow_frag:xb,sprite_vert:yb,sprite_frag:Mb},oe={common:{diffuse:{value:new be(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Le}},envmap:{envMap:{value:null},envMapRotation:{value:new Le},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Le}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Le}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Le},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Le},normalScale:{value:new we(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Le},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Le}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Le}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Le}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new be(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new be(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0},uvTransform:{value:new Le}},sprite:{diffuse:{value:new be(16777215)},opacity:{value:1},center:{value:new we(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}}},wn={basic:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.fog]),vertexShader:He.meshbasic_vert,fragmentShader:He.meshbasic_frag},lambert:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new be(0)}}]),vertexShader:He.meshlambert_vert,fragmentShader:He.meshlambert_frag},phong:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new be(0)},specular:{value:new be(1118481)},shininess:{value:30}}]),vertexShader:He.meshphong_vert,fragmentShader:He.meshphong_frag},standard:{uniforms:zt([oe.common,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.roughnessmap,oe.metalnessmap,oe.fog,oe.lights,{emissive:{value:new be(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:He.meshphysical_vert,fragmentShader:He.meshphysical_frag},toon:{uniforms:zt([oe.common,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.gradientmap,oe.fog,oe.lights,{emissive:{value:new be(0)}}]),vertexShader:He.meshtoon_vert,fragmentShader:He.meshtoon_frag},matcap:{uniforms:zt([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,{matcap:{value:null}}]),vertexShader:He.meshmatcap_vert,fragmentShader:He.meshmatcap_frag},points:{uniforms:zt([oe.points,oe.fog]),vertexShader:He.points_vert,fragmentShader:He.points_frag},dashed:{uniforms:zt([oe.common,oe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:He.linedashed_vert,fragmentShader:He.linedashed_frag},depth:{uniforms:zt([oe.common,oe.displacementmap]),vertexShader:He.depth_vert,fragmentShader:He.depth_frag},normal:{uniforms:zt([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,{opacity:{value:1}}]),vertexShader:He.meshnormal_vert,fragmentShader:He.meshnormal_frag},sprite:{uniforms:zt([oe.sprite,oe.fog]),vertexShader:He.sprite_vert,fragmentShader:He.sprite_frag},background:{uniforms:{uvTransform:{value:new Le},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:He.background_vert,fragmentShader:He.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Le}},vertexShader:He.backgroundCube_vert,fragmentShader:He.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:He.cube_vert,fragmentShader:He.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:He.equirect_vert,fragmentShader:He.equirect_frag},distanceRGBA:{uniforms:zt([oe.common,oe.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:He.distanceRGBA_vert,fragmentShader:He.distanceRGBA_frag},shadow:{uniforms:zt([oe.lights,oe.fog,{color:{value:new be(0)},opacity:{value:1}}]),vertexShader:He.shadow_vert,fragmentShader:He.shadow_frag}};wn.physical={uniforms:zt([wn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Le},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Le},clearcoatNormalScale:{value:new we(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Le},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Le},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Le},sheen:{value:0},sheenColor:{value:new be(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Le},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Le},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Le},transmissionSamplerSize:{value:new we},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Le},attenuationDistance:{value:0},attenuationColor:{value:new be(0)},specularColor:{value:new be(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Le},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Le},anisotropyVector:{value:new we},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Le}}]),vertexShader:He.meshphysical_vert,fragmentShader:He.meshphysical_frag};const Ba={r:0,b:0,g:0},_i=new jt,Ib=new De;function Sb(n,e,t,i,r,s,a){const o=new be(0);let l=s===!0?0:1,c,u,h=null,d=0,f=null;function g(M){let E=M.isScene===!0?M.background:null;return E&&E.isTexture&&(E=(M.backgroundBlurriness>0?t:e).get(E)),E}function m(M){let E=!1;const _=g(M);_===null?p(o,l):_&&_.isColor&&(p(_,1),E=!0);const y=n.xr.getEnvironmentBlendMode();y==="additive"?i.buffers.color.setClear(0,0,0,1,a):y==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,a),(n.autoClear||E)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function A(M,E){const _=g(E);_&&(_.isCubeTexture||_.mapping===yo)?(u===void 0&&(u=new Ke(new qn(1,1,1),new Kn({name:"BackgroundCubeMaterial",uniforms:zr(wn.backgroundCube.uniforms),vertexShader:wn.backgroundCube.vertexShader,fragmentShader:wn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(y,S,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),_i.copy(E.backgroundRotation),_i.x*=-1,_i.y*=-1,_i.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&(_i.y*=-1,_i.z*=-1),u.material.uniforms.envMap.value=_,u.material.uniforms.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(Ib.makeRotationFromEuler(_i)),u.material.toneMapped=Je.getTransfer(_.colorSpace)!==ht,(h!==_||d!==_.version||f!==n.toneMapping)&&(u.material.needsUpdate=!0,h=_,d=_.version,f=n.toneMapping),u.layers.enableAll(),M.unshift(u,u.geometry,u.material,0,0,null)):_&&_.isTexture&&(c===void 0&&(c=new Ke(new Yr(2,2),new Kn({name:"BackgroundMaterial",uniforms:zr(wn.background.uniforms),vertexShader:wn.background.vertexShader,fragmentShader:wn.background.fragmentShader,side:Yn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=_,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.toneMapped=Je.getTransfer(_.colorSpace)!==ht,_.matrixAutoUpdate===!0&&_.updateMatrix(),c.material.uniforms.uvTransform.value.copy(_.matrix),(h!==_||d!==_.version||f!==n.toneMapping)&&(c.material.needsUpdate=!0,h=_,d=_.version,f=n.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null))}function p(M,E){M.getRGB(Ba,jf(n)),i.buffers.color.setClear(Ba.r,Ba.g,Ba.b,E,a)}function b(){u!==void 0&&(u.geometry.dispose(),u.material.dispose(),u=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,E=1){o.set(M),l=E,p(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(M){l=M,p(o,l)},render:m,addToRenderList:A,dispose:b}}function Cb(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=d(null);let s=r,a=!1;function o(x,T,D,U,N){let Q=!1;const G=h(U,D,T);s!==G&&(s=G,c(s.object)),Q=f(x,U,D,N),Q&&g(x,U,D,N),N!==null&&e.update(N,n.ELEMENT_ARRAY_BUFFER),(Q||a)&&(a=!1,E(x,T,D,U),N!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(N).buffer))}function l(){return n.createVertexArray()}function c(x){return n.bindVertexArray(x)}function u(x){return n.deleteVertexArray(x)}function h(x,T,D){const U=D.wireframe===!0;let N=i[x.id];N===void 0&&(N={},i[x.id]=N);let Q=N[T.id];Q===void 0&&(Q={},N[T.id]=Q);let G=Q[U];return G===void 0&&(G=d(l()),Q[U]=G),G}function d(x){const T=[],D=[],U=[];for(let N=0;N<t;N++)T[N]=0,D[N]=0,U[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:T,enabledAttributes:D,attributeDivisors:U,object:x,attributes:{},index:null}}function f(x,T,D,U){const N=s.attributes,Q=T.attributes;let G=0;const X=D.getAttributes();for(const V in X)if(X[V].location>=0){const Z=N[V];let se=Q[V];if(se===void 0&&(V==="instanceMatrix"&&x.instanceMatrix&&(se=x.instanceMatrix),V==="instanceColor"&&x.instanceColor&&(se=x.instanceColor)),Z===void 0||Z.attribute!==se||se&&Z.data!==se.data)return!0;G++}return s.attributesNum!==G||s.index!==U}function g(x,T,D,U){const N={},Q=T.attributes;let G=0;const X=D.getAttributes();for(const V in X)if(X[V].location>=0){let Z=Q[V];Z===void 0&&(V==="instanceMatrix"&&x.instanceMatrix&&(Z=x.instanceMatrix),V==="instanceColor"&&x.instanceColor&&(Z=x.instanceColor));const se={};se.attribute=Z,Z&&Z.data&&(se.data=Z.data),N[V]=se,G++}s.attributes=N,s.attributesNum=G,s.index=U}function m(){const x=s.newAttributes;for(let T=0,D=x.length;T<D;T++)x[T]=0}function A(x){p(x,0)}function p(x,T){const D=s.newAttributes,U=s.enabledAttributes,N=s.attributeDivisors;D[x]=1,U[x]===0&&(n.enableVertexAttribArray(x),U[x]=1),N[x]!==T&&(n.vertexAttribDivisor(x,T),N[x]=T)}function b(){const x=s.newAttributes,T=s.enabledAttributes;for(let D=0,U=T.length;D<U;D++)T[D]!==x[D]&&(n.disableVertexAttribArray(D),T[D]=0)}function M(x,T,D,U,N,Q,G){G===!0?n.vertexAttribIPointer(x,T,D,N,Q):n.vertexAttribPointer(x,T,D,U,N,Q)}function E(x,T,D,U){m();const N=U.attributes,Q=D.getAttributes(),G=T.defaultAttributeValues;for(const X in Q){const V=Q[X];if(V.location>=0){let ee=N[X];if(ee===void 0&&(X==="instanceMatrix"&&x.instanceMatrix&&(ee=x.instanceMatrix),X==="instanceColor"&&x.instanceColor&&(ee=x.instanceColor)),ee!==void 0){const Z=ee.normalized,se=ee.itemSize,pe=e.get(ee);if(pe===void 0)continue;const Ue=pe.buffer,We=pe.type,Ge=pe.bytesPerElement,Y=We===n.INT||We===n.UNSIGNED_INT||ee.gpuType===Jc;if(ee.isInterleavedBufferAttribute){const J=ee.data,de=J.stride,Ie=ee.offset;if(J.isInstancedInterleavedBuffer){for(let xe=0;xe<V.locationSize;xe++)p(V.location+xe,J.meshPerAttribute);x.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let xe=0;xe<V.locationSize;xe++)A(V.location+xe);n.bindBuffer(n.ARRAY_BUFFER,Ue);for(let xe=0;xe<V.locationSize;xe++)M(V.location+xe,se/V.locationSize,We,Z,de*Ge,(Ie+se/V.locationSize*xe)*Ge,Y)}else{if(ee.isInstancedBufferAttribute){for(let J=0;J<V.locationSize;J++)p(V.location+J,ee.meshPerAttribute);x.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let J=0;J<V.locationSize;J++)A(V.location+J);n.bindBuffer(n.ARRAY_BUFFER,Ue);for(let J=0;J<V.locationSize;J++)M(V.location+J,se/V.locationSize,We,Z,se*Ge,se/V.locationSize*J*Ge,Y)}}else if(G!==void 0){const Z=G[X];if(Z!==void 0)switch(Z.length){case 2:n.vertexAttrib2fv(V.location,Z);break;case 3:n.vertexAttrib3fv(V.location,Z);break;case 4:n.vertexAttrib4fv(V.location,Z);break;default:n.vertexAttrib1fv(V.location,Z)}}}}b()}function _(){C();for(const x in i){const T=i[x];for(const D in T){const U=T[D];for(const N in U)u(U[N].object),delete U[N];delete T[D]}delete i[x]}}function y(x){if(i[x.id]===void 0)return;const T=i[x.id];for(const D in T){const U=T[D];for(const N in U)u(U[N].object),delete U[N];delete T[D]}delete i[x.id]}function S(x){for(const T in i){const D=i[T];if(D[x.id]===void 0)continue;const U=D[x.id];for(const N in U)u(U[N].object),delete U[N];delete D[x.id]}}function C(){v(),a=!0,s!==r&&(s=r,c(s.object))}function v(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:C,resetDefaultState:v,dispose:_,releaseStatesOfGeometry:y,releaseStatesOfProgram:S,initAttributes:m,enableAttribute:A,disableUnusedAttributes:b}}function wb(n,e,t){let i;function r(c){i=c}function s(c,u){n.drawArrays(i,c,u),t.update(u,i,1)}function a(c,u,h){h!==0&&(n.drawArraysInstanced(i,c,u,h),t.update(u,i,h))}function o(c,u,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,u,0,h);let f=0;for(let g=0;g<h;g++)f+=u[g];t.update(f,i,1)}function l(c,u,h,d){if(h===0)return;const f=e.get("WEBGL_multi_draw");if(f===null)for(let g=0;g<c.length;g++)a(c[g],u[g],d[g]);else{f.multiDrawArraysInstancedWEBGL(i,c,0,u,0,d,0,h);let g=0;for(let m=0;m<h;m++)g+=u[m]*d[m];t.update(g,i,1)}}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function Tb(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){const S=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(S.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(S){return!(S!==Pt&&i.convert(S)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(S){const C=S===hn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(S!==ze&&i.convert(S)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&S!==kt&&!C)}function l(S){if(S==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";S="mediump"}return S==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const h=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),f=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),m=n.getParameter(n.MAX_TEXTURE_SIZE),A=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),p=n.getParameter(n.MAX_VERTEX_ATTRIBS),b=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),M=n.getParameter(n.MAX_VARYING_VECTORS),E=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),_=g>0,y=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:d,maxTextures:f,maxVertexTextures:g,maxTextureSize:m,maxCubemapSize:A,maxAttributes:p,maxVertexUniforms:b,maxVaryings:M,maxFragmentUniforms:E,vertexTextures:_,maxSamples:y}}function Rb(n){const e=this;let t=null,i=0,r=!1,s=!1;const a=new Mi,o=new Le,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){const f=h.length!==0||d||i!==0||r;return r=d,i=h.length,f},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,f){const g=h.clippingPlanes,m=h.clipIntersection,A=h.clipShadows,p=n.get(h);if(!r||g===null||g.length===0||s&&!A)s?u(null):c();else{const b=s?0:i,M=b*4;let E=p.clippingState||null;l.value=E,E=u(g,d,M,f);for(let _=0;_!==M;++_)E[_]=t[_];p.clippingState=E,this.numIntersection=m?this.numPlanes:0,this.numPlanes+=b}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(h,d,f,g){const m=h!==null?h.length:0;let A=null;if(m!==0){if(A=l.value,g!==!0||A===null){const p=f+m*4,b=d.matrixWorldInverse;o.getNormalMatrix(b),(A===null||A.length<p)&&(A=new Float32Array(p));for(let M=0,E=f;M!==m;++M,E+=4)a.copy(h[M]).applyMatrix4(b,o),a.normal.toArray(A,E),A[E+3]=a.constant}l.value=A,l.needsUpdate=!0}return e.numPlanes=m,e.numIntersection=0,A}}function Bb(n){let e=new WeakMap;function t(a,o){return o===dc?a.mapping=ki:o===fc&&(a.mapping=Qr),a}function i(a){if(a&&a.isTexture){const o=a.mapping;if(o===dc||o===fc)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Z_(l.height);return c.fromEquirectangularTexture(n,a),e.set(a,c),a.addEventListener("dispose",r),t(c.texture,a.mapping)}else return null}}return a}function r(a){const o=a.target;o.removeEventListener("dispose",r);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}const Br=4,Oh=[.125,.215,.35,.446,.526,.582],Ci=20,vl=new Po,kh=new be;let bl=null,xl=0,yl=0,Ml=!1;const Ii=(1+Math.sqrt(5))/2,br=1/Ii,Qh=[new R(-Ii,br,0),new R(Ii,br,0),new R(-br,0,Ii),new R(br,0,Ii),new R(0,Ii,-br),new R(0,Ii,br),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)],Lb=new R;class Hh{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100,s={}){const{size:a=256,position:o=Lb}=s;bl=this._renderer.getRenderTarget(),xl=this._renderer.getActiveCubeFace(),yl=this._renderer.getActiveMipmapLevel(),Ml=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=zh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Vh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(bl,xl,yl),this._renderer.xr.enabled=Ml,e.scissorTest=!1,La(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ki||e.mapping===Qr?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),bl=this._renderer.getRenderTarget(),xl=this._renderer.getActiveCubeFace(),yl=this._renderer.getActiveMipmapLevel(),Ml=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Ut,minFilter:Ut,generateMipmaps:!1,type:hn,format:Pt,colorSpace:Qt,depthBuffer:!1},r=Gh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Gh(e,t,i);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Db(s)),this._blurMaterial=Pb(s,e,t)}return r}_compileMaterial(e){const t=new Ke(this._lodPlanes[0],e);this._renderer.compile(t,vl)}_sceneToCubeUV(e,t,i,r,s){const l=new Wt(90,1,t,i),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,f=h.toneMapping;h.getClearColor(kh),h.toneMapping=li,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(r),h.clearDepth(),h.setRenderTarget(null));const m=new Kt({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1}),A=new Ke(new qn,m);let p=!1;const b=e.background;b?b.isColor&&(m.color.copy(b),e.background=null,p=!0):(m.color.copy(kh),p=!0);for(let M=0;M<6;M++){const E=M%3;E===0?(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+u[M],s.y,s.z)):E===1?(l.up.set(0,0,c[M]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+u[M],s.z)):(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+u[M]));const _=this._cubeSize;La(r,E*_,M>2?_:0,_,_),h.setRenderTarget(r),p&&h.render(A,l),h.render(e,l)}A.geometry.dispose(),A.material.dispose(),h.toneMapping=f,h.autoClear=d,e.background=b}_textureToCubeUV(e,t){const i=this._renderer,r=e.mapping===ki||e.mapping===Qr;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=zh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Vh());const s=r?this._cubemapMaterial:this._equirectMaterial,a=new Ke(this._lodPlanes[0],s),o=s.uniforms;o.envMap.value=e;const l=this._cubeSize;La(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(a,vl)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodPlanes.length;for(let s=1;s<r;s++){const a=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),o=Qh[(r-s-1)%Qh.length];this._blur(e,s-1,s,a,o)}t.autoClear=i}_blur(e,t,i,r,s){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,i,r,"latitudinal",s),this._halfBlur(a,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,h=new Ke(this._lodPlanes[r],c),d=c.uniforms,f=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*f):2*Math.PI/(2*Ci-1),m=s/g,A=isFinite(s)?1+Math.floor(u*m):Ci;A>Ci&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${A} samples when the maximum is set to ${Ci}`);const p=[];let b=0;for(let S=0;S<Ci;++S){const C=S/m,v=Math.exp(-C*C/2);p.push(v),S===0?b+=v:S<A&&(b+=2*v)}for(let S=0;S<p.length;S++)p[S]=p[S]/b;d.envMap.value=e.texture,d.samples.value=A,d.weights.value=p,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:M}=this;d.dTheta.value=g,d.mipInt.value=M-i;const E=this._sizeLods[r],_=3*E*(r>M-Br?r-M+Br:0),y=4*(this._cubeSize-E);La(t,_,y,3*E,2*E),l.setRenderTarget(t),l.render(h,vl)}}function Db(n){const e=[],t=[],i=[];let r=n;const s=n-Br+1+Oh.length;for(let a=0;a<s;a++){const o=Math.pow(2,r);t.push(o);let l=1/o;a>n-Br?l=Oh[a-n+Br-1]:a===0&&(l=0),i.push(l);const c=1/(o-2),u=-c,h=1+c,d=[u,u,h,u,h,h,u,u,h,h,u,h],f=6,g=6,m=3,A=2,p=1,b=new Float32Array(m*g*f),M=new Float32Array(A*g*f),E=new Float32Array(p*g*f);for(let y=0;y<f;y++){const S=y%3*2/3-1,C=y>2?0:-1,v=[S,C,0,S+2/3,C,0,S+2/3,C+1,0,S,C,0,S+2/3,C+1,0,S,C+1,0];b.set(v,m*g*y),M.set(d,A*g*y);const x=[y,y,y,y,y,y];E.set(x,p*g*y)}const _=new dt;_.setAttribute("position",new tt(b,m)),_.setAttribute("uv",new tt(M,A)),_.setAttribute("faceIndex",new tt(E,p)),e.push(_),r>Br&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function Gh(n,e,t){const i=new Gi(n,e,t);return i.texture.mapping=yo,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function La(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Pb(n,e,t){const i=new Float32Array(Ci),r=new R(0,1,0);return new Kn({name:"SphericalGaussianBlur",defines:{n:Ci,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:gu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function Vh(){return new Kn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:gu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function zh(){return new Kn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:gu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function gu(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Ub(n){let e=new WeakMap,t=null;function i(o){if(o&&o.isTexture){const l=o.mapping,c=l===dc||l===fc,u=l===ki||l===Qr;if(c||u){let h=e.get(o);const d=h!==void 0?h.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return t===null&&(t=new Hh(n)),h=c?t.fromEquirectangular(o,h):t.fromCubemap(o,h),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),h.texture;if(h!==void 0)return h.texture;{const f=o.image;return c&&f&&f.height>0||u&&f&&r(f)?(t===null&&(t=new Hh(n)),h=c?t.fromEquirectangular(o):t.fromCubemap(o),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),o.addEventListener("dispose",s),h.texture):null}}}return o}function r(o){let l=0;const c=6;for(let u=0;u<c;u++)o[u]!==void 0&&l++;return l===c}function s(o){const l=o.target;l.removeEventListener("dispose",s);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:a}}function Nb(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&Ys("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function Fb(n,e,t,i){const r={},s=new WeakMap;function a(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const g in d.attributes)e.remove(d.attributes[g]);d.removeEventListener("dispose",a),delete r[d.id];const f=s.get(d);f&&(e.remove(f),s.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(h,d){return r[d.id]===!0||(d.addEventListener("dispose",a),r[d.id]=!0,t.memory.geometries++),d}function l(h){const d=h.attributes;for(const f in d)e.update(d[f],n.ARRAY_BUFFER)}function c(h){const d=[],f=h.index,g=h.attributes.position;let m=0;if(f!==null){const b=f.array;m=f.version;for(let M=0,E=b.length;M<E;M+=3){const _=b[M+0],y=b[M+1],S=b[M+2];d.push(_,y,y,S,S,_)}}else if(g!==void 0){const b=g.array;m=g.version;for(let M=0,E=b.length/3-1;M<E;M+=3){const _=M+0,y=M+1,S=M+2;d.push(_,y,y,S,S,_)}}else return;const A=new(Qf(d)?qf:Wf)(d,1);A.version=m;const p=s.get(h);p&&e.remove(p),s.set(h,A)}function u(h){const d=s.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return s.get(h)}return{get:o,update:l,getWireframeAttribute:u}}function Ob(n,e,t){let i;function r(d){i=d}let s,a;function o(d){s=d.type,a=d.bytesPerElement}function l(d,f){n.drawElements(i,f,s,d*a),t.update(f,i,1)}function c(d,f,g){g!==0&&(n.drawElementsInstanced(i,f,s,d*a,g),t.update(f,i,g))}function u(d,f,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,f,0,s,d,0,g);let A=0;for(let p=0;p<g;p++)A+=f[p];t.update(A,i,1)}function h(d,f,g,m){if(g===0)return;const A=e.get("WEBGL_multi_draw");if(A===null)for(let p=0;p<d.length;p++)c(d[p]/a,f[p],m[p]);else{A.multiDrawElementsInstancedWEBGL(i,f,0,s,d,0,m,0,g);let p=0;for(let b=0;b<g;b++)p+=f[b]*m[b];t.update(p,i,1)}}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=h}function kb(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(s/3);break;case n.LINES:t.lines+=o*(s/2);break;case n.LINE_STRIP:t.lines+=o*(s-1);break;case n.LINE_LOOP:t.lines+=o*s;break;case n.POINTS:t.points+=o*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function Qb(n,e,t){const i=new WeakMap,r=new nt;function s(a,o,l){const c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=u!==void 0?u.length:0;let d=i.get(o);if(d===void 0||d.count!==h){let v=function(){S.dispose(),i.delete(o),o.removeEventListener("dispose",v)};d!==void 0&&d.texture.dispose();const f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,m=o.morphAttributes.color!==void 0,A=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],b=o.morphAttributes.color||[];let M=0;f===!0&&(M=1),g===!0&&(M=2),m===!0&&(M=3);let E=o.attributes.position.count*M,_=1;E>e.maxTextureSize&&(_=Math.ceil(E/e.maxTextureSize),E=e.maxTextureSize);const y=new Float32Array(E*_*4*h),S=new Hf(y,E,_,h);S.type=kt,S.needsUpdate=!0;const C=M*4;for(let x=0;x<h;x++){const T=A[x],D=p[x],U=b[x],N=E*_*4*x;for(let Q=0;Q<T.count;Q++){const G=Q*C;f===!0&&(r.fromBufferAttribute(T,Q),y[N+G+0]=r.x,y[N+G+1]=r.y,y[N+G+2]=r.z,y[N+G+3]=0),g===!0&&(r.fromBufferAttribute(D,Q),y[N+G+4]=r.x,y[N+G+5]=r.y,y[N+G+6]=r.z,y[N+G+7]=0),m===!0&&(r.fromBufferAttribute(U,Q),y[N+G+8]=r.x,y[N+G+9]=r.y,y[N+G+10]=r.z,y[N+G+11]=U.itemSize===4?r.w:1)}}d={count:h,texture:S,size:new we(E,_)},i.set(o,d),o.addEventListener("dispose",v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let f=0;for(let m=0;m<c.length;m++)f+=c[m];const g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(n,"morphTargetBaseInfluence",g),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:s}}function Hb(n,e,t,i){let r=new WeakMap;function s(l){const c=i.render.frame,u=l.geometry,h=e.get(l,u);if(r.get(h)!==c&&(e.update(h),r.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),r.get(l)!==c&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;r.get(d)!==c&&(d.update(),r.set(d,c))}return h}function a(){r=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:a}}const hp=new Tt,Wh=new np(1,1),dp=new Hf,fp=new Gf,pp=new Kf,qh=[],jh=[],Xh=new Float32Array(16),Yh=new Float32Array(9),Kh=new Float32Array(4);function Zr(n,e,t){const i=n[0];if(i<=0||i>0)return n;const r=e*t;let s=qh[r];if(s===void 0&&(s=new Float32Array(r),qh[r]=s),e!==0){i.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(s,o)}return s}function Bt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Lt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Uo(n,e){let t=jh[e];t===void 0&&(t=new Int32Array(e),jh[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function Gb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function Vb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2fv(this.addr,e),Lt(t,e)}}function zb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Bt(t,e))return;n.uniform3fv(this.addr,e),Lt(t,e)}}function Wb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4fv(this.addr,e),Lt(t,e)}}function qb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;Kh.set(i),n.uniformMatrix2fv(this.addr,!1,Kh),Lt(t,i)}}function jb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;Yh.set(i),n.uniformMatrix3fv(this.addr,!1,Yh),Lt(t,i)}}function Xb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;Xh.set(i),n.uniformMatrix4fv(this.addr,!1,Xh),Lt(t,i)}}function Yb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function Kb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2iv(this.addr,e),Lt(t,e)}}function Jb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3iv(this.addr,e),Lt(t,e)}}function Zb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4iv(this.addr,e),Lt(t,e)}}function $b(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function ex(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2uiv(this.addr,e),Lt(t,e)}}function tx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3uiv(this.addr,e),Lt(t,e)}}function nx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4uiv(this.addr,e),Lt(t,e)}}function ix(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Wh.compareFunction=kf,s=Wh):s=hp,t.setTexture2D(e||s,r)}function rx(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||fp,r)}function sx(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||pp,r)}function ax(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||dp,r)}function ox(n){switch(n){case 5126:return Gb;case 35664:return Vb;case 35665:return zb;case 35666:return Wb;case 35674:return qb;case 35675:return jb;case 35676:return Xb;case 5124:case 35670:return Yb;case 35667:case 35671:return Kb;case 35668:case 35672:return Jb;case 35669:case 35673:return Zb;case 5125:return $b;case 36294:return ex;case 36295:return tx;case 36296:return nx;case 35678:case 36198:case 36298:case 36306:case 35682:return ix;case 35679:case 36299:case 36307:return rx;case 35680:case 36300:case 36308:case 36293:return sx;case 36289:case 36303:case 36311:case 36292:return ax}}function lx(n,e){n.uniform1fv(this.addr,e)}function cx(n,e){const t=Zr(e,this.size,2);n.uniform2fv(this.addr,t)}function ux(n,e){const t=Zr(e,this.size,3);n.uniform3fv(this.addr,t)}function hx(n,e){const t=Zr(e,this.size,4);n.uniform4fv(this.addr,t)}function dx(n,e){const t=Zr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function fx(n,e){const t=Zr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function px(n,e){const t=Zr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Ax(n,e){n.uniform1iv(this.addr,e)}function mx(n,e){n.uniform2iv(this.addr,e)}function gx(n,e){n.uniform3iv(this.addr,e)}function _x(n,e){n.uniform4iv(this.addr,e)}function Ex(n,e){n.uniform1uiv(this.addr,e)}function vx(n,e){n.uniform2uiv(this.addr,e)}function bx(n,e){n.uniform3uiv(this.addr,e)}function xx(n,e){n.uniform4uiv(this.addr,e)}function yx(n,e,t){const i=this.cache,r=e.length,s=Uo(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture2D(e[a]||hp,s[a])}function Mx(n,e,t){const i=this.cache,r=e.length,s=Uo(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture3D(e[a]||fp,s[a])}function Ix(n,e,t){const i=this.cache,r=e.length,s=Uo(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTextureCube(e[a]||pp,s[a])}function Sx(n,e,t){const i=this.cache,r=e.length,s=Uo(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture2DArray(e[a]||dp,s[a])}function Cx(n){switch(n){case 5126:return lx;case 35664:return cx;case 35665:return ux;case 35666:return hx;case 35674:return dx;case 35675:return fx;case 35676:return px;case 5124:case 35670:return Ax;case 35667:case 35671:return mx;case 35668:case 35672:return gx;case 35669:case 35673:return _x;case 5125:return Ex;case 36294:return vx;case 36295:return bx;case 36296:return xx;case 35678:case 36198:case 36298:case 36306:case 35682:return yx;case 35679:case 36299:case 36307:return Mx;case 35680:case 36300:case 36308:case 36293:return Ix;case 36289:case 36303:case 36311:case 36292:return Sx}}class wx{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=ox(t.type)}}class Tx{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Cx(t.type)}}class Rx{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const r=this.seq;for(let s=0,a=r.length;s!==a;++s){const o=r[s];o.setValue(e,t[o.id],i)}}}const Il=/(\w+)(\])?(\[|\.)?/g;function Jh(n,e){n.seq.push(e),n.map[e.id]=e}function Bx(n,e,t){const i=n.name,r=i.length;for(Il.lastIndex=0;;){const s=Il.exec(i),a=Il.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){Jh(t,c===void 0?new wx(o,n,e):new Tx(o,n,e));break}else{let h=t.map[o];h===void 0&&(h=new Rx(o),Jh(t,h)),t=h}}}class Wa{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){const s=e.getActiveUniform(t,r),a=e.getUniformLocation(t,s.name);Bx(s,a,this)}}setValue(e,t,i,r){const s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){const r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,a=t.length;s!==a;++s){const o=t[s],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){const i=[];for(let r=0,s=e.length;r!==s;++r){const a=e[r];a.id in t&&i.push(a)}return i}}function Zh(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const Lx=37297;let Dx=0;function Px(n,e){const t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=r;a<s;a++){const o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}const $h=new Le;function Ux(n){Je._getMatrix($h,Je.workingColorSpace,n);const e=`mat3( ${$h.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(n)){case ho:return[e,"LinearTransferOETF"];case ht:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function ed(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";const a=/ERROR: 0:(\d+)/.exec(s);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+Px(n.getShaderSource(e),o)}else return s}function Nx(n,e){const t=Ux(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Fx(n,e){let t;switch(e){case zg:t="Linear";break;case Wg:t="Reinhard";break;case qg:t="Cineon";break;case jg:t="ACESFilmic";break;case Yg:t="AgX";break;case Kg:t="Neutral";break;case Xg:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Da=new R;function Ox(){Je.getLuminanceCoefficients(Da);const n=Da.x.toFixed(4),e=Da.y.toFixed(4),t=Da.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function kx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ws).join(`
`)}function Qx(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Hx(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=n.getActiveAttrib(e,r),a=s.name;let o=1;s.type===n.FLOAT_MAT2&&(o=2),s.type===n.FLOAT_MAT3&&(o=3),s.type===n.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function ws(n){return n!==""}function td(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function nd(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Gx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Dc(n){return n.replace(Gx,zx)}const Vx=new Map;function zx(n,e){let t=He[e];if(t===void 0){const i=Vx.get(e);if(i!==void 0)t=He[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return Dc(t)}const Wx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function id(n){return n.replace(Wx,qx)}function qx(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function rd(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function jx(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===Df?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===yg?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Vn&&(e="SHADOWMAP_TYPE_VSM"),e}function Xx(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case ki:case Qr:e="ENVMAP_TYPE_CUBE";break;case yo:e="ENVMAP_TYPE_CUBE_UV";break}return e}function Yx(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Qr:e="ENVMAP_MODE_REFRACTION";break}return e}function Kx(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case Yc:e="ENVMAP_BLENDING_MULTIPLY";break;case Gg:e="ENVMAP_BLENDING_MIX";break;case Vg:e="ENVMAP_BLENDING_ADD";break}return e}function Jx(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Zx(n,e,t,i){const r=n.getContext(),s=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=jx(t),c=Xx(t),u=Yx(t),h=Kx(t),d=Jx(t),f=kx(t),g=Qx(s),m=r.createProgram();let A,p,b=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(A=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ws).join(`
`),A.length>0&&(A+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ws).join(`
`),p.length>0&&(p+=`
`)):(A=[rd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ws).join(`
`),p=[rd(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==li?"#define TONE_MAPPING":"",t.toneMapping!==li?He.tonemapping_pars_fragment:"",t.toneMapping!==li?Fx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",He.colorspace_pars_fragment,Nx("linearToOutputTexel",t.outputColorSpace),Ox(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ws).join(`
`)),a=Dc(a),a=td(a,t),a=nd(a,t),o=Dc(o),o=td(o,t),o=nd(o,t),a=id(a),o=id(o),t.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,A=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+A,p=["#define varying in",t.glslVersion===Ku?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Ku?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const M=b+A+a,E=b+p+o,_=Zh(r,r.VERTEX_SHADER,M),y=Zh(r,r.FRAGMENT_SHADER,E);r.attachShader(m,_),r.attachShader(m,y),t.index0AttributeName!==void 0?r.bindAttribLocation(m,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(m,0,"position"),r.linkProgram(m);function S(T){if(n.debug.checkShaderErrors){const D=r.getProgramInfoLog(m)||"",U=r.getShaderInfoLog(_)||"",N=r.getShaderInfoLog(y)||"",Q=D.trim(),G=U.trim(),X=N.trim();let V=!0,ee=!0;if(r.getProgramParameter(m,r.LINK_STATUS)===!1)if(V=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,m,_,y);else{const Z=ed(r,_,"vertex"),se=ed(r,y,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(m,r.VALIDATE_STATUS)+`

Material Name: `+T.name+`
Material Type: `+T.type+`

Program Info Log: `+Q+`
`+Z+`
`+se)}else Q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Q):(G===""||X==="")&&(ee=!1);ee&&(T.diagnostics={runnable:V,programLog:Q,vertexShader:{log:G,prefix:A},fragmentShader:{log:X,prefix:p}})}r.deleteShader(_),r.deleteShader(y),C=new Wa(r,m),v=Hx(r,m)}let C;this.getUniforms=function(){return C===void 0&&S(this),C};let v;this.getAttributes=function(){return v===void 0&&S(this),v};let x=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return x===!1&&(x=r.getProgramParameter(m,Lx)),x},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(m),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Dx++,this.cacheKey=e,this.usedTimes=1,this.program=m,this.vertexShader=_,this.fragmentShader=y,this}let $x=0;class ey{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(i),a=this._getShaderCacheForMaterial(e);return a.has(r)===!1&&(a.add(r),r.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new ty(e),t.set(e,i)),i}}class ty{constructor(e){this.id=$x++,this.code=e,this.usedTimes=0}}function ny(n,e,t,i,r,s,a){const o=new Vf,l=new ey,c=new Set,u=[],h=r.logarithmicDepthBuffer,d=r.vertexTextures;let f=r.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(v){return c.add(v),v===0?"uv":`uv${v}`}function A(v,x,T,D,U){const N=D.fog,Q=U.geometry,G=v.isMeshStandardMaterial?D.environment:null,X=(v.isMeshStandardMaterial?t:e).get(v.envMap||G),V=X&&X.mapping===yo?X.image.height:null,ee=g[v.type];v.precision!==null&&(f=r.getMaxPrecision(v.precision),f!==v.precision&&console.warn("THREE.WebGLProgram.getParameters:",v.precision,"not supported, using",f,"instead."));const Z=Q.morphAttributes.position||Q.morphAttributes.normal||Q.morphAttributes.color,se=Z!==void 0?Z.length:0;let pe=0;Q.morphAttributes.position!==void 0&&(pe=1),Q.morphAttributes.normal!==void 0&&(pe=2),Q.morphAttributes.color!==void 0&&(pe=3);let Ue,We,Ge,Y;if(ee){const Ze=wn[ee];Ue=Ze.vertexShader,We=Ze.fragmentShader}else Ue=v.vertexShader,We=v.fragmentShader,l.update(v),Ge=l.getVertexShaderID(v),Y=l.getFragmentShaderID(v);const J=n.getRenderTarget(),de=n.state.buffers.depth.getReversed(),Ie=U.isInstancedMesh===!0,xe=U.isBatchedMesh===!0,Ve=!!v.map,St=!!v.matcap,P=!!X,at=!!v.aoMap,Ne=!!v.lightMap,Te=!!v.bumpMap,_e=!!v.normalMap,ot=!!v.displacementMap,Ee=!!v.emissiveMap,Oe=!!v.metalnessMap,_t=!!v.roughnessMap,gt=v.anisotropy>0,B=v.clearcoat>0,I=v.dispersion>0,L=v.iridescence>0,O=v.sheen>0,j=v.transmission>0,z=gt&&!!v.anisotropyMap,fe=B&&!!v.clearcoatMap,$=B&&!!v.clearcoatNormalMap,me=B&&!!v.clearcoatRoughnessMap,Ae=L&&!!v.iridescenceMap,ie=L&&!!v.iridescenceThicknessMap,ce=O&&!!v.sheenColorMap,Se=O&&!!v.sheenRoughnessMap,ye=!!v.specularMap,le=!!v.specularColorMap,Re=!!v.specularIntensityMap,F=j&&!!v.transmissionMap,te=j&&!!v.thicknessMap,ae=!!v.gradientMap,ue=!!v.alphaMap,ne=v.alphaTest>0,K=!!v.alphaHash,ve=!!v.extensions;let ke=li;v.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(ke=n.toneMapping);const it={shaderID:ee,shaderType:v.type,shaderName:v.name,vertexShader:Ue,fragmentShader:We,defines:v.defines,customVertexShaderID:Ge,customFragmentShaderID:Y,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:f,batching:xe,batchingColor:xe&&U._colorsTexture!==null,instancing:Ie,instancingColor:Ie&&U.instanceColor!==null,instancingMorph:Ie&&U.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:J===null?n.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Qt,alphaToCoverage:!!v.alphaToCoverage,map:Ve,matcap:St,envMap:P,envMapMode:P&&X.mapping,envMapCubeUVHeight:V,aoMap:at,lightMap:Ne,bumpMap:Te,normalMap:_e,displacementMap:d&&ot,emissiveMap:Ee,normalMapObjectSpace:_e&&v.normalMapType===s_,normalMapTangentSpace:_e&&v.normalMapType===So,metalnessMap:Oe,roughnessMap:_t,anisotropy:gt,anisotropyMap:z,clearcoat:B,clearcoatMap:fe,clearcoatNormalMap:$,clearcoatRoughnessMap:me,dispersion:I,iridescence:L,iridescenceMap:Ae,iridescenceThicknessMap:ie,sheen:O,sheenColorMap:ce,sheenRoughnessMap:Se,specularMap:ye,specularColorMap:le,specularIntensityMap:Re,transmission:j,transmissionMap:F,thicknessMap:te,gradientMap:ae,opaque:v.transparent===!1&&v.blending===Dr&&v.alphaToCoverage===!1,alphaMap:ue,alphaTest:ne,alphaHash:K,combine:v.combine,mapUv:Ve&&m(v.map.channel),aoMapUv:at&&m(v.aoMap.channel),lightMapUv:Ne&&m(v.lightMap.channel),bumpMapUv:Te&&m(v.bumpMap.channel),normalMapUv:_e&&m(v.normalMap.channel),displacementMapUv:ot&&m(v.displacementMap.channel),emissiveMapUv:Ee&&m(v.emissiveMap.channel),metalnessMapUv:Oe&&m(v.metalnessMap.channel),roughnessMapUv:_t&&m(v.roughnessMap.channel),anisotropyMapUv:z&&m(v.anisotropyMap.channel),clearcoatMapUv:fe&&m(v.clearcoatMap.channel),clearcoatNormalMapUv:$&&m(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:me&&m(v.clearcoatRoughnessMap.channel),iridescenceMapUv:Ae&&m(v.iridescenceMap.channel),iridescenceThicknessMapUv:ie&&m(v.iridescenceThicknessMap.channel),sheenColorMapUv:ce&&m(v.sheenColorMap.channel),sheenRoughnessMapUv:Se&&m(v.sheenRoughnessMap.channel),specularMapUv:ye&&m(v.specularMap.channel),specularColorMapUv:le&&m(v.specularColorMap.channel),specularIntensityMapUv:Re&&m(v.specularIntensityMap.channel),transmissionMapUv:F&&m(v.transmissionMap.channel),thicknessMapUv:te&&m(v.thicknessMap.channel),alphaMapUv:ue&&m(v.alphaMap.channel),vertexTangents:!!Q.attributes.tangent&&(_e||gt),vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!Q.attributes.color&&Q.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!Q.attributes.uv&&(Ve||ue),fog:!!N,useFog:v.fog===!0,fogExp2:!!N&&N.isFogExp2,flatShading:v.flatShading===!0&&v.wireframe===!1,sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:de,skinning:U.isSkinnedMesh===!0,morphTargets:Q.morphAttributes.position!==void 0,morphNormals:Q.morphAttributes.normal!==void 0,morphColors:Q.morphAttributes.color!==void 0,morphTargetsCount:se,morphTextureStride:pe,numDirLights:x.directional.length,numPointLights:x.point.length,numSpotLights:x.spot.length,numSpotLightMaps:x.spotLightMap.length,numRectAreaLights:x.rectArea.length,numHemiLights:x.hemi.length,numDirLightShadows:x.directionalShadowMap.length,numPointLightShadows:x.pointShadowMap.length,numSpotLightShadows:x.spotShadowMap.length,numSpotLightShadowsWithMaps:x.numSpotLightShadowsWithMaps,numLightProbes:x.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:v.dithering,shadowMapEnabled:n.shadowMap.enabled&&T.length>0,shadowMapType:n.shadowMap.type,toneMapping:ke,decodeVideoTexture:Ve&&v.map.isVideoTexture===!0&&Je.getTransfer(v.map.colorSpace)===ht,decodeVideoTextureEmissive:Ee&&v.emissiveMap.isVideoTexture===!0&&Je.getTransfer(v.emissiveMap.colorSpace)===ht,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===tn,flipSided:v.side===qt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ve&&v.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ve&&v.extensions.multiDraw===!0||xe)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return it.vertexUv1s=c.has(1),it.vertexUv2s=c.has(2),it.vertexUv3s=c.has(3),c.clear(),it}function p(v){const x=[];if(v.shaderID?x.push(v.shaderID):(x.push(v.customVertexShaderID),x.push(v.customFragmentShaderID)),v.defines!==void 0)for(const T in v.defines)x.push(T),x.push(v.defines[T]);return v.isRawShaderMaterial===!1&&(b(x,v),M(x,v),x.push(n.outputColorSpace)),x.push(v.customProgramCacheKey),x.join()}function b(v,x){v.push(x.precision),v.push(x.outputColorSpace),v.push(x.envMapMode),v.push(x.envMapCubeUVHeight),v.push(x.mapUv),v.push(x.alphaMapUv),v.push(x.lightMapUv),v.push(x.aoMapUv),v.push(x.bumpMapUv),v.push(x.normalMapUv),v.push(x.displacementMapUv),v.push(x.emissiveMapUv),v.push(x.metalnessMapUv),v.push(x.roughnessMapUv),v.push(x.anisotropyMapUv),v.push(x.clearcoatMapUv),v.push(x.clearcoatNormalMapUv),v.push(x.clearcoatRoughnessMapUv),v.push(x.iridescenceMapUv),v.push(x.iridescenceThicknessMapUv),v.push(x.sheenColorMapUv),v.push(x.sheenRoughnessMapUv),v.push(x.specularMapUv),v.push(x.specularColorMapUv),v.push(x.specularIntensityMapUv),v.push(x.transmissionMapUv),v.push(x.thicknessMapUv),v.push(x.combine),v.push(x.fogExp2),v.push(x.sizeAttenuation),v.push(x.morphTargetsCount),v.push(x.morphAttributeCount),v.push(x.numDirLights),v.push(x.numPointLights),v.push(x.numSpotLights),v.push(x.numSpotLightMaps),v.push(x.numHemiLights),v.push(x.numRectAreaLights),v.push(x.numDirLightShadows),v.push(x.numPointLightShadows),v.push(x.numSpotLightShadows),v.push(x.numSpotLightShadowsWithMaps),v.push(x.numLightProbes),v.push(x.shadowMapType),v.push(x.toneMapping),v.push(x.numClippingPlanes),v.push(x.numClipIntersection),v.push(x.depthPacking)}function M(v,x){o.disableAll(),x.supportsVertexTextures&&o.enable(0),x.instancing&&o.enable(1),x.instancingColor&&o.enable(2),x.instancingMorph&&o.enable(3),x.matcap&&o.enable(4),x.envMap&&o.enable(5),x.normalMapObjectSpace&&o.enable(6),x.normalMapTangentSpace&&o.enable(7),x.clearcoat&&o.enable(8),x.iridescence&&o.enable(9),x.alphaTest&&o.enable(10),x.vertexColors&&o.enable(11),x.vertexAlphas&&o.enable(12),x.vertexUv1s&&o.enable(13),x.vertexUv2s&&o.enable(14),x.vertexUv3s&&o.enable(15),x.vertexTangents&&o.enable(16),x.anisotropy&&o.enable(17),x.alphaHash&&o.enable(18),x.batching&&o.enable(19),x.dispersion&&o.enable(20),x.batchingColor&&o.enable(21),x.gradientMap&&o.enable(22),v.push(o.mask),o.disableAll(),x.fog&&o.enable(0),x.useFog&&o.enable(1),x.flatShading&&o.enable(2),x.logarithmicDepthBuffer&&o.enable(3),x.reversedDepthBuffer&&o.enable(4),x.skinning&&o.enable(5),x.morphTargets&&o.enable(6),x.morphNormals&&o.enable(7),x.morphColors&&o.enable(8),x.premultipliedAlpha&&o.enable(9),x.shadowMapEnabled&&o.enable(10),x.doubleSided&&o.enable(11),x.flipSided&&o.enable(12),x.useDepthPacking&&o.enable(13),x.dithering&&o.enable(14),x.transmission&&o.enable(15),x.sheen&&o.enable(16),x.opaque&&o.enable(17),x.pointsUvs&&o.enable(18),x.decodeVideoTexture&&o.enable(19),x.decodeVideoTextureEmissive&&o.enable(20),x.alphaToCoverage&&o.enable(21),v.push(o.mask)}function E(v){const x=g[v.type];let T;if(x){const D=wn[x];T=Xf.clone(D.uniforms)}else T=v.uniforms;return T}function _(v,x){let T;for(let D=0,U=u.length;D<U;D++){const N=u[D];if(N.cacheKey===x){T=N,++T.usedTimes;break}}return T===void 0&&(T=new Zx(n,x,v,s),u.push(T)),T}function y(v){if(--v.usedTimes===0){const x=u.indexOf(v);u[x]=u[u.length-1],u.pop(),v.destroy()}}function S(v){l.remove(v)}function C(){l.dispose()}return{getParameters:A,getProgramCacheKey:p,getUniforms:E,acquireProgram:_,releaseProgram:y,releaseShaderCache:S,programs:u,dispose:C}}function iy(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function r(a,o,l){n.get(a)[o]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function ry(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function sd(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function ad(){const n=[];let e=0;const t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function a(h,d,f,g,m,A){let p=n[e];return p===void 0?(p={id:h.id,object:h,geometry:d,material:f,groupOrder:g,renderOrder:h.renderOrder,z:m,group:A},n[e]=p):(p.id=h.id,p.object=h,p.geometry=d,p.material=f,p.groupOrder=g,p.renderOrder=h.renderOrder,p.z=m,p.group=A),e++,p}function o(h,d,f,g,m,A){const p=a(h,d,f,g,m,A);f.transmission>0?i.push(p):f.transparent===!0?r.push(p):t.push(p)}function l(h,d,f,g,m,A){const p=a(h,d,f,g,m,A);f.transmission>0?i.unshift(p):f.transparent===!0?r.unshift(p):t.unshift(p)}function c(h,d){t.length>1&&t.sort(h||ry),i.length>1&&i.sort(d||sd),r.length>1&&r.sort(d||sd)}function u(){for(let h=e,d=n.length;h<d;h++){const f=n[h];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:o,unshift:l,finish:u,sort:c}}function sy(){let n=new WeakMap;function e(i,r){const s=n.get(i);let a;return s===void 0?(a=new ad,n.set(i,[a])):r>=s.length?(a=new ad,s.push(a)):a=s[r],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function ay(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new R,color:new be};break;case"SpotLight":t={position:new R,direction:new R,color:new be,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new R,color:new be,distance:0,decay:0};break;case"HemisphereLight":t={direction:new R,skyColor:new be,groundColor:new be};break;case"RectAreaLight":t={color:new be,position:new R,halfWidth:new R,halfHeight:new R};break}return n[e.id]=t,t}}}function oy(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let ly=0;function cy(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function uy(n){const e=new ay,t=oy(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new R);const r=new R,s=new De,a=new De;function o(c){let u=0,h=0,d=0;for(let v=0;v<9;v++)i.probe[v].set(0,0,0);let f=0,g=0,m=0,A=0,p=0,b=0,M=0,E=0,_=0,y=0,S=0;c.sort(cy);for(let v=0,x=c.length;v<x;v++){const T=c[v],D=T.color,U=T.intensity,N=T.distance,Q=T.shadow&&T.shadow.map?T.shadow.map.texture:null;if(T.isAmbientLight)u+=D.r*U,h+=D.g*U,d+=D.b*U;else if(T.isLightProbe){for(let G=0;G<9;G++)i.probe[G].addScaledVector(T.sh.coefficients[G],U);S++}else if(T.isDirectionalLight){const G=e.get(T);if(G.color.copy(T.color).multiplyScalar(T.intensity),T.castShadow){const X=T.shadow,V=t.get(T);V.shadowIntensity=X.intensity,V.shadowBias=X.bias,V.shadowNormalBias=X.normalBias,V.shadowRadius=X.radius,V.shadowMapSize=X.mapSize,i.directionalShadow[f]=V,i.directionalShadowMap[f]=Q,i.directionalShadowMatrix[f]=T.shadow.matrix,b++}i.directional[f]=G,f++}else if(T.isSpotLight){const G=e.get(T);G.position.setFromMatrixPosition(T.matrixWorld),G.color.copy(D).multiplyScalar(U),G.distance=N,G.coneCos=Math.cos(T.angle),G.penumbraCos=Math.cos(T.angle*(1-T.penumbra)),G.decay=T.decay,i.spot[m]=G;const X=T.shadow;if(T.map&&(i.spotLightMap[_]=T.map,_++,X.updateMatrices(T),T.castShadow&&y++),i.spotLightMatrix[m]=X.matrix,T.castShadow){const V=t.get(T);V.shadowIntensity=X.intensity,V.shadowBias=X.bias,V.shadowNormalBias=X.normalBias,V.shadowRadius=X.radius,V.shadowMapSize=X.mapSize,i.spotShadow[m]=V,i.spotShadowMap[m]=Q,E++}m++}else if(T.isRectAreaLight){const G=e.get(T);G.color.copy(D).multiplyScalar(U),G.halfWidth.set(T.width*.5,0,0),G.halfHeight.set(0,T.height*.5,0),i.rectArea[A]=G,A++}else if(T.isPointLight){const G=e.get(T);if(G.color.copy(T.color).multiplyScalar(T.intensity),G.distance=T.distance,G.decay=T.decay,T.castShadow){const X=T.shadow,V=t.get(T);V.shadowIntensity=X.intensity,V.shadowBias=X.bias,V.shadowNormalBias=X.normalBias,V.shadowRadius=X.radius,V.shadowMapSize=X.mapSize,V.shadowCameraNear=X.camera.near,V.shadowCameraFar=X.camera.far,i.pointShadow[g]=V,i.pointShadowMap[g]=Q,i.pointShadowMatrix[g]=T.shadow.matrix,M++}i.point[g]=G,g++}else if(T.isHemisphereLight){const G=e.get(T);G.skyColor.copy(T.color).multiplyScalar(U),G.groundColor.copy(T.groundColor).multiplyScalar(U),i.hemi[p]=G,p++}}A>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=oe.LTC_FLOAT_1,i.rectAreaLTC2=oe.LTC_FLOAT_2):(i.rectAreaLTC1=oe.LTC_HALF_1,i.rectAreaLTC2=oe.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=h,i.ambient[2]=d;const C=i.hash;(C.directionalLength!==f||C.pointLength!==g||C.spotLength!==m||C.rectAreaLength!==A||C.hemiLength!==p||C.numDirectionalShadows!==b||C.numPointShadows!==M||C.numSpotShadows!==E||C.numSpotMaps!==_||C.numLightProbes!==S)&&(i.directional.length=f,i.spot.length=m,i.rectArea.length=A,i.point.length=g,i.hemi.length=p,i.directionalShadow.length=b,i.directionalShadowMap.length=b,i.pointShadow.length=M,i.pointShadowMap.length=M,i.spotShadow.length=E,i.spotShadowMap.length=E,i.directionalShadowMatrix.length=b,i.pointShadowMatrix.length=M,i.spotLightMatrix.length=E+_-y,i.spotLightMap.length=_,i.numSpotLightShadowsWithMaps=y,i.numLightProbes=S,C.directionalLength=f,C.pointLength=g,C.spotLength=m,C.rectAreaLength=A,C.hemiLength=p,C.numDirectionalShadows=b,C.numPointShadows=M,C.numSpotShadows=E,C.numSpotMaps=_,C.numLightProbes=S,i.version=ly++)}function l(c,u){let h=0,d=0,f=0,g=0,m=0;const A=u.matrixWorldInverse;for(let p=0,b=c.length;p<b;p++){const M=c[p];if(M.isDirectionalLight){const E=i.directional[h];E.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),E.direction.sub(r),E.direction.transformDirection(A),h++}else if(M.isSpotLight){const E=i.spot[f];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(A),E.direction.setFromMatrixPosition(M.matrixWorld),r.setFromMatrixPosition(M.target.matrixWorld),E.direction.sub(r),E.direction.transformDirection(A),f++}else if(M.isRectAreaLight){const E=i.rectArea[g];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(A),a.identity(),s.copy(M.matrixWorld),s.premultiply(A),a.extractRotation(s),E.halfWidth.set(M.width*.5,0,0),E.halfHeight.set(0,M.height*.5,0),E.halfWidth.applyMatrix4(a),E.halfHeight.applyMatrix4(a),g++}else if(M.isPointLight){const E=i.point[d];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(A),d++}else if(M.isHemisphereLight){const E=i.hemi[m];E.direction.setFromMatrixPosition(M.matrixWorld),E.direction.transformDirection(A),m++}}}return{setup:o,setupView:l,state:i}}function od(n){const e=new uy(n),t=[],i=[];function r(u){c.camera=u,t.length=0,i.length=0}function s(u){t.push(u)}function a(u){i.push(u)}function o(){e.setup(t)}function l(u){e.setupView(t,u)}const c={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function hy(n){let e=new WeakMap;function t(r,s=0){const a=e.get(r);let o;return a===void 0?(o=new od(n),e.set(r,[o])):s>=a.length?(o=new od(n),a.push(o)):o=a[s],o}function i(){e=new WeakMap}return{get:t,dispose:i}}const dy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,fy=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function py(n,e,t){let i=new cu;const r=new we,s=new we,a=new nt,o=new uE({depthPacking:r_}),l=new hE,c={},u=t.maxTextureSize,h={[Yn]:qt,[qt]:Yn,[tn]:tn},d=new Kn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new we},radius:{value:4}},vertexShader:dy,fragmentShader:fy}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const g=new dt;g.setAttribute("position",new tt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const m=new Ke(g,d),A=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Df;let p=this.type;this.render=function(y,S,C){if(A.enabled===!1||A.autoUpdate===!1&&A.needsUpdate===!1||y.length===0)return;const v=n.getRenderTarget(),x=n.getActiveCubeFace(),T=n.getActiveMipmapLevel(),D=n.state;D.setBlending(oi),D.buffers.depth.getReversed()===!0?D.buffers.color.setClear(0,0,0,0):D.buffers.color.setClear(1,1,1,1),D.buffers.depth.setTest(!0),D.setScissorTest(!1);const U=p!==Vn&&this.type===Vn,N=p===Vn&&this.type!==Vn;for(let Q=0,G=y.length;Q<G;Q++){const X=y[Q],V=X.shadow;if(V===void 0){console.warn("THREE.WebGLShadowMap:",X,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;r.copy(V.mapSize);const ee=V.getFrameExtents();if(r.multiply(ee),s.copy(V.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/ee.x),r.x=s.x*ee.x,V.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/ee.y),r.y=s.y*ee.y,V.mapSize.y=s.y)),V.map===null||U===!0||N===!0){const se=this.type!==Vn?{minFilter:Nt,magFilter:Nt}:{};V.map!==null&&V.map.dispose(),V.map=new Gi(r.x,r.y,se),V.map.texture.name=X.name+".shadowMap",V.camera.updateProjectionMatrix()}n.setRenderTarget(V.map),n.clear();const Z=V.getViewportCount();for(let se=0;se<Z;se++){const pe=V.getViewport(se);a.set(s.x*pe.x,s.y*pe.y,s.x*pe.z,s.y*pe.w),D.viewport(a),V.updateMatrices(X,se),i=V.getFrustum(),E(S,C,V.camera,X,this.type)}V.isPointLightShadow!==!0&&this.type===Vn&&b(V,C),V.needsUpdate=!1}p=this.type,A.needsUpdate=!1,n.setRenderTarget(v,x,T)};function b(y,S){const C=e.update(m);d.defines.VSM_SAMPLES!==y.blurSamples&&(d.defines.VSM_SAMPLES=y.blurSamples,f.defines.VSM_SAMPLES=y.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),y.mapPass===null&&(y.mapPass=new Gi(r.x,r.y)),d.uniforms.shadow_pass.value=y.map.texture,d.uniforms.resolution.value=y.mapSize,d.uniforms.radius.value=y.radius,n.setRenderTarget(y.mapPass),n.clear(),n.renderBufferDirect(S,null,C,d,m,null),f.uniforms.shadow_pass.value=y.mapPass.texture,f.uniforms.resolution.value=y.mapSize,f.uniforms.radius.value=y.radius,n.setRenderTarget(y.map),n.clear(),n.renderBufferDirect(S,null,C,f,m,null)}function M(y,S,C,v){let x=null;const T=C.isPointLight===!0?y.customDistanceMaterial:y.customDepthMaterial;if(T!==void 0)x=T;else if(x=C.isPointLight===!0?l:o,n.localClippingEnabled&&S.clipShadows===!0&&Array.isArray(S.clippingPlanes)&&S.clippingPlanes.length!==0||S.displacementMap&&S.displacementScale!==0||S.alphaMap&&S.alphaTest>0||S.map&&S.alphaTest>0||S.alphaToCoverage===!0){const D=x.uuid,U=S.uuid;let N=c[D];N===void 0&&(N={},c[D]=N);let Q=N[U];Q===void 0&&(Q=x.clone(),N[U]=Q,S.addEventListener("dispose",_)),x=Q}if(x.visible=S.visible,x.wireframe=S.wireframe,v===Vn?x.side=S.shadowSide!==null?S.shadowSide:S.side:x.side=S.shadowSide!==null?S.shadowSide:h[S.side],x.alphaMap=S.alphaMap,x.alphaTest=S.alphaToCoverage===!0?.5:S.alphaTest,x.map=S.map,x.clipShadows=S.clipShadows,x.clippingPlanes=S.clippingPlanes,x.clipIntersection=S.clipIntersection,x.displacementMap=S.displacementMap,x.displacementScale=S.displacementScale,x.displacementBias=S.displacementBias,x.wireframeLinewidth=S.wireframeLinewidth,x.linewidth=S.linewidth,C.isPointLight===!0&&x.isMeshDistanceMaterial===!0){const D=n.properties.get(x);D.light=C}return x}function E(y,S,C,v,x){if(y.visible===!1)return;if(y.layers.test(S.layers)&&(y.isMesh||y.isLine||y.isPoints)&&(y.castShadow||y.receiveShadow&&x===Vn)&&(!y.frustumCulled||i.intersectsObject(y))){y.modelViewMatrix.multiplyMatrices(C.matrixWorldInverse,y.matrixWorld);const U=e.update(y),N=y.material;if(Array.isArray(N)){const Q=U.groups;for(let G=0,X=Q.length;G<X;G++){const V=Q[G],ee=N[V.materialIndex];if(ee&&ee.visible){const Z=M(y,ee,v,x);y.onBeforeShadow(n,y,S,C,U,Z,V),n.renderBufferDirect(C,null,U,Z,y,V),y.onAfterShadow(n,y,S,C,U,Z,V)}}}else if(N.visible){const Q=M(y,N,v,x);y.onBeforeShadow(n,y,S,C,U,Q,null),n.renderBufferDirect(C,null,U,Q,y,null),y.onAfterShadow(n,y,S,C,U,Q,null)}}const D=y.children;for(let U=0,N=D.length;U<N;U++)E(D[U],S,C,v,x)}function _(y){y.target.removeEventListener("dispose",_);for(const C in c){const v=c[C],x=y.target.uuid;x in v&&(v[x].dispose(),delete v[x])}}}const Ay={[sc]:ac,[oc]:uc,[lc]:hc,[kr]:cc,[ac]:sc,[uc]:oc,[hc]:lc,[cc]:kr};function my(n,e){function t(){let F=!1;const te=new nt;let ae=null;const ue=new nt(0,0,0,0);return{setMask:function(ne){ae!==ne&&!F&&(n.colorMask(ne,ne,ne,ne),ae=ne)},setLocked:function(ne){F=ne},setClear:function(ne,K,ve,ke,it){it===!0&&(ne*=ke,K*=ke,ve*=ke),te.set(ne,K,ve,ke),ue.equals(te)===!1&&(n.clearColor(ne,K,ve,ke),ue.copy(te))},reset:function(){F=!1,ae=null,ue.set(-1,0,0,0)}}}function i(){let F=!1,te=!1,ae=null,ue=null,ne=null;return{setReversed:function(K){if(te!==K){const ve=e.get("EXT_clip_control");K?ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.ZERO_TO_ONE_EXT):ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.NEGATIVE_ONE_TO_ONE_EXT),te=K;const ke=ne;ne=null,this.setClear(ke)}},getReversed:function(){return te},setTest:function(K){K?J(n.DEPTH_TEST):de(n.DEPTH_TEST)},setMask:function(K){ae!==K&&!F&&(n.depthMask(K),ae=K)},setFunc:function(K){if(te&&(K=Ay[K]),ue!==K){switch(K){case sc:n.depthFunc(n.NEVER);break;case ac:n.depthFunc(n.ALWAYS);break;case oc:n.depthFunc(n.LESS);break;case kr:n.depthFunc(n.LEQUAL);break;case lc:n.depthFunc(n.EQUAL);break;case cc:n.depthFunc(n.GEQUAL);break;case uc:n.depthFunc(n.GREATER);break;case hc:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ue=K}},setLocked:function(K){F=K},setClear:function(K){ne!==K&&(te&&(K=1-K),n.clearDepth(K),ne=K)},reset:function(){F=!1,ae=null,ue=null,ne=null,te=!1}}}function r(){let F=!1,te=null,ae=null,ue=null,ne=null,K=null,ve=null,ke=null,it=null;return{setTest:function(Ze){F||(Ze?J(n.STENCIL_TEST):de(n.STENCIL_TEST))},setMask:function(Ze){te!==Ze&&!F&&(n.stencilMask(Ze),te=Ze)},setFunc:function(Ze,pn,rn){(ae!==Ze||ue!==pn||ne!==rn)&&(n.stencilFunc(Ze,pn,rn),ae=Ze,ue=pn,ne=rn)},setOp:function(Ze,pn,rn){(K!==Ze||ve!==pn||ke!==rn)&&(n.stencilOp(Ze,pn,rn),K=Ze,ve=pn,ke=rn)},setLocked:function(Ze){F=Ze},setClear:function(Ze){it!==Ze&&(n.clearStencil(Ze),it=Ze)},reset:function(){F=!1,te=null,ae=null,ue=null,ne=null,K=null,ve=null,ke=null,it=null}}}const s=new t,a=new i,o=new r,l=new WeakMap,c=new WeakMap;let u={},h={},d=new WeakMap,f=[],g=null,m=!1,A=null,p=null,b=null,M=null,E=null,_=null,y=null,S=new be(0,0,0),C=0,v=!1,x=null,T=null,D=null,U=null,N=null;const Q=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,X=0;const V=n.getParameter(n.VERSION);V.indexOf("WebGL")!==-1?(X=parseFloat(/^WebGL (\d)/.exec(V)[1]),G=X>=1):V.indexOf("OpenGL ES")!==-1&&(X=parseFloat(/^OpenGL ES (\d)/.exec(V)[1]),G=X>=2);let ee=null,Z={};const se=n.getParameter(n.SCISSOR_BOX),pe=n.getParameter(n.VIEWPORT),Ue=new nt().fromArray(se),We=new nt().fromArray(pe);function Ge(F,te,ae,ue){const ne=new Uint8Array(4),K=n.createTexture();n.bindTexture(F,K),n.texParameteri(F,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(F,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let ve=0;ve<ae;ve++)F===n.TEXTURE_3D||F===n.TEXTURE_2D_ARRAY?n.texImage3D(te,0,n.RGBA,1,1,ue,0,n.RGBA,n.UNSIGNED_BYTE,ne):n.texImage2D(te+ve,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ne);return K}const Y={};Y[n.TEXTURE_2D]=Ge(n.TEXTURE_2D,n.TEXTURE_2D,1),Y[n.TEXTURE_CUBE_MAP]=Ge(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[n.TEXTURE_2D_ARRAY]=Ge(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),Y[n.TEXTURE_3D]=Ge(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),J(n.DEPTH_TEST),a.setFunc(kr),Te(!1),_e(Wu),J(n.CULL_FACE),at(oi);function J(F){u[F]!==!0&&(n.enable(F),u[F]=!0)}function de(F){u[F]!==!1&&(n.disable(F),u[F]=!1)}function Ie(F,te){return h[F]!==te?(n.bindFramebuffer(F,te),h[F]=te,F===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=te),F===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=te),!0):!1}function xe(F,te){let ae=f,ue=!1;if(F){ae=d.get(te),ae===void 0&&(ae=[],d.set(te,ae));const ne=F.textures;if(ae.length!==ne.length||ae[0]!==n.COLOR_ATTACHMENT0){for(let K=0,ve=ne.length;K<ve;K++)ae[K]=n.COLOR_ATTACHMENT0+K;ae.length=ne.length,ue=!0}}else ae[0]!==n.BACK&&(ae[0]=n.BACK,ue=!0);ue&&n.drawBuffers(ae)}function Ve(F){return g!==F?(n.useProgram(F),g=F,!0):!1}const St={[Si]:n.FUNC_ADD,[Ig]:n.FUNC_SUBTRACT,[Sg]:n.FUNC_REVERSE_SUBTRACT};St[Cg]=n.MIN,St[wg]=n.MAX;const P={[Tg]:n.ZERO,[Rg]:n.ONE,[Bg]:n.SRC_COLOR,[ic]:n.SRC_ALPHA,[Fg]:n.SRC_ALPHA_SATURATE,[Ug]:n.DST_COLOR,[Dg]:n.DST_ALPHA,[Lg]:n.ONE_MINUS_SRC_COLOR,[rc]:n.ONE_MINUS_SRC_ALPHA,[Ng]:n.ONE_MINUS_DST_COLOR,[Pg]:n.ONE_MINUS_DST_ALPHA,[Og]:n.CONSTANT_COLOR,[kg]:n.ONE_MINUS_CONSTANT_COLOR,[Qg]:n.CONSTANT_ALPHA,[Hg]:n.ONE_MINUS_CONSTANT_ALPHA};function at(F,te,ae,ue,ne,K,ve,ke,it,Ze){if(F===oi){m===!0&&(de(n.BLEND),m=!1);return}if(m===!1&&(J(n.BLEND),m=!0),F!==Mg){if(F!==A||Ze!==v){if((p!==Si||E!==Si)&&(n.blendEquation(n.FUNC_ADD),p=Si,E=Si),Ze)switch(F){case Dr:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case to:n.blendFunc(n.ONE,n.ONE);break;case qu:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case ju:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",F);break}else switch(F){case Dr:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case to:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case qu:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ju:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",F);break}b=null,M=null,_=null,y=null,S.set(0,0,0),C=0,A=F,v=Ze}return}ne=ne||te,K=K||ae,ve=ve||ue,(te!==p||ne!==E)&&(n.blendEquationSeparate(St[te],St[ne]),p=te,E=ne),(ae!==b||ue!==M||K!==_||ve!==y)&&(n.blendFuncSeparate(P[ae],P[ue],P[K],P[ve]),b=ae,M=ue,_=K,y=ve),(ke.equals(S)===!1||it!==C)&&(n.blendColor(ke.r,ke.g,ke.b,it),S.copy(ke),C=it),A=F,v=!1}function Ne(F,te){F.side===tn?de(n.CULL_FACE):J(n.CULL_FACE);let ae=F.side===qt;te&&(ae=!ae),Te(ae),F.blending===Dr&&F.transparent===!1?at(oi):at(F.blending,F.blendEquation,F.blendSrc,F.blendDst,F.blendEquationAlpha,F.blendSrcAlpha,F.blendDstAlpha,F.blendColor,F.blendAlpha,F.premultipliedAlpha),a.setFunc(F.depthFunc),a.setTest(F.depthTest),a.setMask(F.depthWrite),s.setMask(F.colorWrite);const ue=F.stencilWrite;o.setTest(ue),ue&&(o.setMask(F.stencilWriteMask),o.setFunc(F.stencilFunc,F.stencilRef,F.stencilFuncMask),o.setOp(F.stencilFail,F.stencilZFail,F.stencilZPass)),Ee(F.polygonOffset,F.polygonOffsetFactor,F.polygonOffsetUnits),F.alphaToCoverage===!0?J(n.SAMPLE_ALPHA_TO_COVERAGE):de(n.SAMPLE_ALPHA_TO_COVERAGE)}function Te(F){x!==F&&(F?n.frontFace(n.CW):n.frontFace(n.CCW),x=F)}function _e(F){F!==bg?(J(n.CULL_FACE),F!==T&&(F===Wu?n.cullFace(n.BACK):F===xg?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):de(n.CULL_FACE),T=F}function ot(F){F!==D&&(G&&n.lineWidth(F),D=F)}function Ee(F,te,ae){F?(J(n.POLYGON_OFFSET_FILL),(U!==te||N!==ae)&&(n.polygonOffset(te,ae),U=te,N=ae)):de(n.POLYGON_OFFSET_FILL)}function Oe(F){F?J(n.SCISSOR_TEST):de(n.SCISSOR_TEST)}function _t(F){F===void 0&&(F=n.TEXTURE0+Q-1),ee!==F&&(n.activeTexture(F),ee=F)}function gt(F,te,ae){ae===void 0&&(ee===null?ae=n.TEXTURE0+Q-1:ae=ee);let ue=Z[ae];ue===void 0&&(ue={type:void 0,texture:void 0},Z[ae]=ue),(ue.type!==F||ue.texture!==te)&&(ee!==ae&&(n.activeTexture(ae),ee=ae),n.bindTexture(F,te||Y[F]),ue.type=F,ue.texture=te)}function B(){const F=Z[ee];F!==void 0&&F.type!==void 0&&(n.bindTexture(F.type,null),F.type=void 0,F.texture=void 0)}function I(){try{n.compressedTexImage2D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function L(){try{n.compressedTexImage3D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function O(){try{n.texSubImage2D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function j(){try{n.texSubImage3D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function z(){try{n.compressedTexSubImage2D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function fe(){try{n.compressedTexSubImage3D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function $(){try{n.texStorage2D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function me(){try{n.texStorage3D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function Ae(){try{n.texImage2D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function ie(){try{n.texImage3D(...arguments)}catch(F){console.error("THREE.WebGLState:",F)}}function ce(F){Ue.equals(F)===!1&&(n.scissor(F.x,F.y,F.z,F.w),Ue.copy(F))}function Se(F){We.equals(F)===!1&&(n.viewport(F.x,F.y,F.z,F.w),We.copy(F))}function ye(F,te){let ae=c.get(te);ae===void 0&&(ae=new WeakMap,c.set(te,ae));let ue=ae.get(F);ue===void 0&&(ue=n.getUniformBlockIndex(te,F.name),ae.set(F,ue))}function le(F,te){const ue=c.get(te).get(F);l.get(te)!==ue&&(n.uniformBlockBinding(te,ue,F.__bindingPointIndex),l.set(te,ue))}function Re(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},ee=null,Z={},h={},d=new WeakMap,f=[],g=null,m=!1,A=null,p=null,b=null,M=null,E=null,_=null,y=null,S=new be(0,0,0),C=0,v=!1,x=null,T=null,D=null,U=null,N=null,Ue.set(0,0,n.canvas.width,n.canvas.height),We.set(0,0,n.canvas.width,n.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:J,disable:de,bindFramebuffer:Ie,drawBuffers:xe,useProgram:Ve,setBlending:at,setMaterial:Ne,setFlipSided:Te,setCullFace:_e,setLineWidth:ot,setPolygonOffset:Ee,setScissorTest:Oe,activeTexture:_t,bindTexture:gt,unbindTexture:B,compressedTexImage2D:I,compressedTexImage3D:L,texImage2D:Ae,texImage3D:ie,updateUBOMapping:ye,uniformBlockBinding:le,texStorage2D:$,texStorage3D:me,texSubImage2D:O,texSubImage3D:j,compressedTexSubImage2D:z,compressedTexSubImage3D:fe,scissor:ce,viewport:Se,reset:Re}}function gy(n,e,t,i,r,s,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new we,u=new WeakMap;let h;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(B,I){return f?new OffscreenCanvas(B,I):Xs("canvas")}function m(B,I,L){let O=1;const j=gt(B);if((j.width>L||j.height>L)&&(O=L/Math.max(j.width,j.height)),O<1)if(typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&B instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&B instanceof ImageBitmap||typeof VideoFrame<"u"&&B instanceof VideoFrame){const z=Math.floor(O*j.width),fe=Math.floor(O*j.height);h===void 0&&(h=g(z,fe));const $=I?g(z,fe):h;return $.width=z,$.height=fe,$.getContext("2d").drawImage(B,0,0,z,fe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+j.width+"x"+j.height+") to ("+z+"x"+fe+")."),$}else return"data"in B&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+j.width+"x"+j.height+")."),B;return B}function A(B){return B.generateMipmaps}function p(B){n.generateMipmap(B)}function b(B){return B.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:B.isWebGL3DRenderTarget?n.TEXTURE_3D:B.isWebGLArrayRenderTarget||B.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function M(B,I,L,O,j=!1){if(B!==null){if(n[B]!==void 0)return n[B];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+B+"'")}let z=I;if(I===n.RED&&(L===n.FLOAT&&(z=n.R32F),L===n.HALF_FLOAT&&(z=n.R16F),L===n.UNSIGNED_BYTE&&(z=n.R8)),I===n.RED_INTEGER&&(L===n.UNSIGNED_BYTE&&(z=n.R8UI),L===n.UNSIGNED_SHORT&&(z=n.R16UI),L===n.UNSIGNED_INT&&(z=n.R32UI),L===n.BYTE&&(z=n.R8I),L===n.SHORT&&(z=n.R16I),L===n.INT&&(z=n.R32I)),I===n.RG&&(L===n.FLOAT&&(z=n.RG32F),L===n.HALF_FLOAT&&(z=n.RG16F),L===n.UNSIGNED_BYTE&&(z=n.RG8)),I===n.RG_INTEGER&&(L===n.UNSIGNED_BYTE&&(z=n.RG8UI),L===n.UNSIGNED_SHORT&&(z=n.RG16UI),L===n.UNSIGNED_INT&&(z=n.RG32UI),L===n.BYTE&&(z=n.RG8I),L===n.SHORT&&(z=n.RG16I),L===n.INT&&(z=n.RG32I)),I===n.RGB_INTEGER&&(L===n.UNSIGNED_BYTE&&(z=n.RGB8UI),L===n.UNSIGNED_SHORT&&(z=n.RGB16UI),L===n.UNSIGNED_INT&&(z=n.RGB32UI),L===n.BYTE&&(z=n.RGB8I),L===n.SHORT&&(z=n.RGB16I),L===n.INT&&(z=n.RGB32I)),I===n.RGBA_INTEGER&&(L===n.UNSIGNED_BYTE&&(z=n.RGBA8UI),L===n.UNSIGNED_SHORT&&(z=n.RGBA16UI),L===n.UNSIGNED_INT&&(z=n.RGBA32UI),L===n.BYTE&&(z=n.RGBA8I),L===n.SHORT&&(z=n.RGBA16I),L===n.INT&&(z=n.RGBA32I)),I===n.RGB&&(L===n.UNSIGNED_INT_5_9_9_9_REV&&(z=n.RGB9_E5),L===n.UNSIGNED_INT_10F_11F_11F_REV&&(z=n.R11F_G11F_B10F)),I===n.RGBA){const fe=j?ho:Je.getTransfer(O);L===n.FLOAT&&(z=n.RGBA32F),L===n.HALF_FLOAT&&(z=n.RGBA16F),L===n.UNSIGNED_BYTE&&(z=fe===ht?n.SRGB8_ALPHA8:n.RGBA8),L===n.UNSIGNED_SHORT_4_4_4_4&&(z=n.RGBA4),L===n.UNSIGNED_SHORT_5_5_5_1&&(z=n.RGB5_A1)}return(z===n.R16F||z===n.R32F||z===n.RG16F||z===n.RG32F||z===n.RGBA16F||z===n.RGBA32F)&&e.get("EXT_color_buffer_float"),z}function E(B,I){let L;return B?I===null||I===Hi||I===ks?L=n.DEPTH24_STENCIL8:I===kt?L=n.DEPTH32F_STENCIL8:I===Os&&(L=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):I===null||I===Hi||I===ks?L=n.DEPTH_COMPONENT24:I===kt?L=n.DEPTH_COMPONENT32F:I===Os&&(L=n.DEPTH_COMPONENT16),L}function _(B,I){return A(B)===!0||B.isFramebufferTexture&&B.minFilter!==Nt&&B.minFilter!==Ut?Math.log2(Math.max(I.width,I.height))+1:B.mipmaps!==void 0&&B.mipmaps.length>0?B.mipmaps.length:B.isCompressedTexture&&Array.isArray(B.image)?I.mipmaps.length:1}function y(B){const I=B.target;I.removeEventListener("dispose",y),C(I),I.isVideoTexture&&u.delete(I)}function S(B){const I=B.target;I.removeEventListener("dispose",S),x(I)}function C(B){const I=i.get(B);if(I.__webglInit===void 0)return;const L=B.source,O=d.get(L);if(O){const j=O[I.__cacheKey];j.usedTimes--,j.usedTimes===0&&v(B),Object.keys(O).length===0&&d.delete(L)}i.remove(B)}function v(B){const I=i.get(B);n.deleteTexture(I.__webglTexture);const L=B.source,O=d.get(L);delete O[I.__cacheKey],a.memory.textures--}function x(B){const I=i.get(B);if(B.depthTexture&&(B.depthTexture.dispose(),i.remove(B.depthTexture)),B.isWebGLCubeRenderTarget)for(let O=0;O<6;O++){if(Array.isArray(I.__webglFramebuffer[O]))for(let j=0;j<I.__webglFramebuffer[O].length;j++)n.deleteFramebuffer(I.__webglFramebuffer[O][j]);else n.deleteFramebuffer(I.__webglFramebuffer[O]);I.__webglDepthbuffer&&n.deleteRenderbuffer(I.__webglDepthbuffer[O])}else{if(Array.isArray(I.__webglFramebuffer))for(let O=0;O<I.__webglFramebuffer.length;O++)n.deleteFramebuffer(I.__webglFramebuffer[O]);else n.deleteFramebuffer(I.__webglFramebuffer);if(I.__webglDepthbuffer&&n.deleteRenderbuffer(I.__webglDepthbuffer),I.__webglMultisampledFramebuffer&&n.deleteFramebuffer(I.__webglMultisampledFramebuffer),I.__webglColorRenderbuffer)for(let O=0;O<I.__webglColorRenderbuffer.length;O++)I.__webglColorRenderbuffer[O]&&n.deleteRenderbuffer(I.__webglColorRenderbuffer[O]);I.__webglDepthRenderbuffer&&n.deleteRenderbuffer(I.__webglDepthRenderbuffer)}const L=B.textures;for(let O=0,j=L.length;O<j;O++){const z=i.get(L[O]);z.__webglTexture&&(n.deleteTexture(z.__webglTexture),a.memory.textures--),i.remove(L[O])}i.remove(B)}let T=0;function D(){T=0}function U(){const B=T;return B>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+B+" texture units while this GPU supports only "+r.maxTextures),T+=1,B}function N(B){const I=[];return I.push(B.wrapS),I.push(B.wrapT),I.push(B.wrapR||0),I.push(B.magFilter),I.push(B.minFilter),I.push(B.anisotropy),I.push(B.internalFormat),I.push(B.format),I.push(B.type),I.push(B.generateMipmaps),I.push(B.premultiplyAlpha),I.push(B.flipY),I.push(B.unpackAlignment),I.push(B.colorSpace),I.join()}function Q(B,I){const L=i.get(B);if(B.isVideoTexture&&Oe(B),B.isRenderTargetTexture===!1&&B.isExternalTexture!==!0&&B.version>0&&L.__version!==B.version){const O=B.image;if(O===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(O.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(L,B,I);return}}else B.isExternalTexture&&(L.__webglTexture=B.sourceTexture?B.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,L.__webglTexture,n.TEXTURE0+I)}function G(B,I){const L=i.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&L.__version!==B.version){Y(L,B,I);return}t.bindTexture(n.TEXTURE_2D_ARRAY,L.__webglTexture,n.TEXTURE0+I)}function X(B,I){const L=i.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&L.__version!==B.version){Y(L,B,I);return}t.bindTexture(n.TEXTURE_3D,L.__webglTexture,n.TEXTURE0+I)}function V(B,I){const L=i.get(B);if(B.version>0&&L.__version!==B.version){J(L,B,I);return}t.bindTexture(n.TEXTURE_CUBE_MAP,L.__webglTexture,n.TEXTURE0+I)}const ee={[Qi]:n.REPEAT,[Wn]:n.CLAMP_TO_EDGE,[no]:n.MIRRORED_REPEAT},Z={[Nt]:n.NEAREST,[Kc]:n.NEAREST_MIPMAP_NEAREST,[Cs]:n.NEAREST_MIPMAP_LINEAR,[Ut]:n.LINEAR,[za]:n.LINEAR_MIPMAP_NEAREST,[vn]:n.LINEAR_MIPMAP_LINEAR},se={[a_]:n.NEVER,[d_]:n.ALWAYS,[o_]:n.LESS,[kf]:n.LEQUAL,[l_]:n.EQUAL,[h_]:n.GEQUAL,[c_]:n.GREATER,[u_]:n.NOTEQUAL};function pe(B,I){if(I.type===kt&&e.has("OES_texture_float_linear")===!1&&(I.magFilter===Ut||I.magFilter===za||I.magFilter===Cs||I.magFilter===vn||I.minFilter===Ut||I.minFilter===za||I.minFilter===Cs||I.minFilter===vn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(B,n.TEXTURE_WRAP_S,ee[I.wrapS]),n.texParameteri(B,n.TEXTURE_WRAP_T,ee[I.wrapT]),(B===n.TEXTURE_3D||B===n.TEXTURE_2D_ARRAY)&&n.texParameteri(B,n.TEXTURE_WRAP_R,ee[I.wrapR]),n.texParameteri(B,n.TEXTURE_MAG_FILTER,Z[I.magFilter]),n.texParameteri(B,n.TEXTURE_MIN_FILTER,Z[I.minFilter]),I.compareFunction&&(n.texParameteri(B,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(B,n.TEXTURE_COMPARE_FUNC,se[I.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(I.magFilter===Nt||I.minFilter!==Cs&&I.minFilter!==vn||I.type===kt&&e.has("OES_texture_float_linear")===!1)return;if(I.anisotropy>1||i.get(I).__currentAnisotropy){const L=e.get("EXT_texture_filter_anisotropic");n.texParameterf(B,L.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(I.anisotropy,r.getMaxAnisotropy())),i.get(I).__currentAnisotropy=I.anisotropy}}}function Ue(B,I){let L=!1;B.__webglInit===void 0&&(B.__webglInit=!0,I.addEventListener("dispose",y));const O=I.source;let j=d.get(O);j===void 0&&(j={},d.set(O,j));const z=N(I);if(z!==B.__cacheKey){j[z]===void 0&&(j[z]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,L=!0),j[z].usedTimes++;const fe=j[B.__cacheKey];fe!==void 0&&(j[B.__cacheKey].usedTimes--,fe.usedTimes===0&&v(I)),B.__cacheKey=z,B.__webglTexture=j[z].texture}return L}function We(B,I,L){return Math.floor(Math.floor(B/L)/I)}function Ge(B,I,L,O){const z=B.updateRanges;if(z.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,I.width,I.height,L,O,I.data);else{z.sort((ie,ce)=>ie.start-ce.start);let fe=0;for(let ie=1;ie<z.length;ie++){const ce=z[fe],Se=z[ie],ye=ce.start+ce.count,le=We(Se.start,I.width,4),Re=We(ce.start,I.width,4);Se.start<=ye+1&&le===Re&&We(Se.start+Se.count-1,I.width,4)===le?ce.count=Math.max(ce.count,Se.start+Se.count-ce.start):(++fe,z[fe]=Se)}z.length=fe+1;const $=n.getParameter(n.UNPACK_ROW_LENGTH),me=n.getParameter(n.UNPACK_SKIP_PIXELS),Ae=n.getParameter(n.UNPACK_SKIP_ROWS);n.pixelStorei(n.UNPACK_ROW_LENGTH,I.width);for(let ie=0,ce=z.length;ie<ce;ie++){const Se=z[ie],ye=Math.floor(Se.start/4),le=Math.ceil(Se.count/4),Re=ye%I.width,F=Math.floor(ye/I.width),te=le,ae=1;n.pixelStorei(n.UNPACK_SKIP_PIXELS,Re),n.pixelStorei(n.UNPACK_SKIP_ROWS,F),t.texSubImage2D(n.TEXTURE_2D,0,Re,F,te,ae,L,O,I.data)}B.clearUpdateRanges(),n.pixelStorei(n.UNPACK_ROW_LENGTH,$),n.pixelStorei(n.UNPACK_SKIP_PIXELS,me),n.pixelStorei(n.UNPACK_SKIP_ROWS,Ae)}}function Y(B,I,L){let O=n.TEXTURE_2D;(I.isDataArrayTexture||I.isCompressedArrayTexture)&&(O=n.TEXTURE_2D_ARRAY),I.isData3DTexture&&(O=n.TEXTURE_3D);const j=Ue(B,I),z=I.source;t.bindTexture(O,B.__webglTexture,n.TEXTURE0+L);const fe=i.get(z);if(z.version!==fe.__version||j===!0){t.activeTexture(n.TEXTURE0+L);const $=Je.getPrimaries(Je.workingColorSpace),me=I.colorSpace===Tn?null:Je.getPrimaries(I.colorSpace),Ae=I.colorSpace===Tn||$===me?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,I.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,I.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae);let ie=m(I.image,!1,r.maxTextureSize);ie=_t(I,ie);const ce=s.convert(I.format,I.colorSpace),Se=s.convert(I.type);let ye=M(I.internalFormat,ce,Se,I.colorSpace,I.isVideoTexture);pe(O,I);let le;const Re=I.mipmaps,F=I.isVideoTexture!==!0,te=fe.__version===void 0||j===!0,ae=z.dataReady,ue=_(I,ie);if(I.isDepthTexture)ye=E(I.format===Gs,I.type),te&&(F?t.texStorage2D(n.TEXTURE_2D,1,ye,ie.width,ie.height):t.texImage2D(n.TEXTURE_2D,0,ye,ie.width,ie.height,0,ce,Se,null));else if(I.isDataTexture)if(Re.length>0){F&&te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,Re[0].width,Re[0].height);for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],F?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,Se,le.data):t.texImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,ce,Se,le.data);I.generateMipmaps=!1}else F?(te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,ie.width,ie.height),ae&&Ge(I,ie,ce,Se)):t.texImage2D(n.TEXTURE_2D,0,ye,ie.width,ie.height,0,ce,Se,ie.data);else if(I.isCompressedTexture)if(I.isCompressedArrayTexture){F&&te&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,ye,Re[0].width,Re[0].height,ie.depth);for(let ne=0,K=Re.length;ne<K;ne++)if(le=Re[ne],I.format!==Pt)if(ce!==null)if(F){if(ae)if(I.layerUpdates.size>0){const ve=Fh(le.width,le.height,I.format,I.type);for(const ke of I.layerUpdates){const it=le.data.subarray(ke*ve/le.data.BYTES_PER_ELEMENT,(ke+1)*ve/le.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,ke,le.width,le.height,1,ce,it)}I.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,0,le.width,le.height,ie.depth,ce,le.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,ne,ye,le.width,le.height,ie.depth,0,le.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else F?ae&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,0,le.width,le.height,ie.depth,ce,Se,le.data):t.texImage3D(n.TEXTURE_2D_ARRAY,ne,ye,le.width,le.height,ie.depth,0,ce,Se,le.data)}else{F&&te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,Re[0].width,Re[0].height);for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],I.format!==Pt?ce!==null?F?ae&&t.compressedTexSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,le.data):t.compressedTexImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):F?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,Se,le.data):t.texImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,ce,Se,le.data)}else if(I.isDataArrayTexture)if(F){if(te&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,ye,ie.width,ie.height,ie.depth),ae)if(I.layerUpdates.size>0){const ne=Fh(ie.width,ie.height,I.format,I.type);for(const K of I.layerUpdates){const ve=ie.data.subarray(K*ne/ie.data.BYTES_PER_ELEMENT,(K+1)*ne/ie.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,K,ie.width,ie.height,1,ce,Se,ve)}I.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ie.width,ie.height,ie.depth,ce,Se,ie.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,ye,ie.width,ie.height,ie.depth,0,ce,Se,ie.data);else if(I.isData3DTexture)F?(te&&t.texStorage3D(n.TEXTURE_3D,ue,ye,ie.width,ie.height,ie.depth),ae&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ie.width,ie.height,ie.depth,ce,Se,ie.data)):t.texImage3D(n.TEXTURE_3D,0,ye,ie.width,ie.height,ie.depth,0,ce,Se,ie.data);else if(I.isFramebufferTexture){if(te)if(F)t.texStorage2D(n.TEXTURE_2D,ue,ye,ie.width,ie.height);else{let ne=ie.width,K=ie.height;for(let ve=0;ve<ue;ve++)t.texImage2D(n.TEXTURE_2D,ve,ye,ne,K,0,ce,Se,null),ne>>=1,K>>=1}}else if(Re.length>0){if(F&&te){const ne=gt(Re[0]);t.texStorage2D(n.TEXTURE_2D,ue,ye,ne.width,ne.height)}for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],F?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,ce,Se,le):t.texImage2D(n.TEXTURE_2D,ne,ye,ce,Se,le);I.generateMipmaps=!1}else if(F){if(te){const ne=gt(ie);t.texStorage2D(n.TEXTURE_2D,ue,ye,ne.width,ne.height)}ae&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,ce,Se,ie)}else t.texImage2D(n.TEXTURE_2D,0,ye,ce,Se,ie);A(I)&&p(O),fe.__version=z.version,I.onUpdate&&I.onUpdate(I)}B.__version=I.version}function J(B,I,L){if(I.image.length!==6)return;const O=Ue(B,I),j=I.source;t.bindTexture(n.TEXTURE_CUBE_MAP,B.__webglTexture,n.TEXTURE0+L);const z=i.get(j);if(j.version!==z.__version||O===!0){t.activeTexture(n.TEXTURE0+L);const fe=Je.getPrimaries(Je.workingColorSpace),$=I.colorSpace===Tn?null:Je.getPrimaries(I.colorSpace),me=I.colorSpace===Tn||fe===$?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,I.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,I.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,me);const Ae=I.isCompressedTexture||I.image[0].isCompressedTexture,ie=I.image[0]&&I.image[0].isDataTexture,ce=[];for(let K=0;K<6;K++)!Ae&&!ie?ce[K]=m(I.image[K],!0,r.maxCubemapSize):ce[K]=ie?I.image[K].image:I.image[K],ce[K]=_t(I,ce[K]);const Se=ce[0],ye=s.convert(I.format,I.colorSpace),le=s.convert(I.type),Re=M(I.internalFormat,ye,le,I.colorSpace),F=I.isVideoTexture!==!0,te=z.__version===void 0||O===!0,ae=j.dataReady;let ue=_(I,Se);pe(n.TEXTURE_CUBE_MAP,I);let ne;if(Ae){F&&te&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Re,Se.width,Se.height);for(let K=0;K<6;K++){ne=ce[K].mipmaps;for(let ve=0;ve<ne.length;ve++){const ke=ne[ve];I.format!==Pt?ye!==null?F?ae&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,0,0,ke.width,ke.height,ye,ke.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,Re,ke.width,ke.height,0,ke.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):F?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,0,0,ke.width,ke.height,ye,le,ke.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,Re,ke.width,ke.height,0,ye,le,ke.data)}}}else{if(ne=I.mipmaps,F&&te){ne.length>0&&ue++;const K=gt(ce[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Re,K.width,K.height)}for(let K=0;K<6;K++)if(ie){F?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,ce[K].width,ce[K].height,ye,le,ce[K].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Re,ce[K].width,ce[K].height,0,ye,le,ce[K].data);for(let ve=0;ve<ne.length;ve++){const it=ne[ve].image[K].image;F?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,0,0,it.width,it.height,ye,le,it.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,Re,it.width,it.height,0,ye,le,it.data)}}else{F?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,ye,le,ce[K]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Re,ye,le,ce[K]);for(let ve=0;ve<ne.length;ve++){const ke=ne[ve];F?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,0,0,ye,le,ke.image[K]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,Re,ye,le,ke.image[K])}}}A(I)&&p(n.TEXTURE_CUBE_MAP),z.__version=j.version,I.onUpdate&&I.onUpdate(I)}B.__version=I.version}function de(B,I,L,O,j,z){const fe=s.convert(L.format,L.colorSpace),$=s.convert(L.type),me=M(L.internalFormat,fe,$,L.colorSpace),Ae=i.get(I),ie=i.get(L);if(ie.__renderTarget=I,!Ae.__hasExternalTextures){const ce=Math.max(1,I.width>>z),Se=Math.max(1,I.height>>z);j===n.TEXTURE_3D||j===n.TEXTURE_2D_ARRAY?t.texImage3D(j,z,me,ce,Se,I.depth,0,fe,$,null):t.texImage2D(j,z,me,ce,Se,0,fe,$,null)}t.bindFramebuffer(n.FRAMEBUFFER,B),Ee(I)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,O,j,ie.__webglTexture,0,ot(I)):(j===n.TEXTURE_2D||j>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&j<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,O,j,ie.__webglTexture,z),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ie(B,I,L){if(n.bindRenderbuffer(n.RENDERBUFFER,B),I.depthBuffer){const O=I.depthTexture,j=O&&O.isDepthTexture?O.type:null,z=E(I.stencilBuffer,j),fe=I.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,$=ot(I);Ee(I)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,$,z,I.width,I.height):L?n.renderbufferStorageMultisample(n.RENDERBUFFER,$,z,I.width,I.height):n.renderbufferStorage(n.RENDERBUFFER,z,I.width,I.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,fe,n.RENDERBUFFER,B)}else{const O=I.textures;for(let j=0;j<O.length;j++){const z=O[j],fe=s.convert(z.format,z.colorSpace),$=s.convert(z.type),me=M(z.internalFormat,fe,$,z.colorSpace),Ae=ot(I);L&&Ee(I)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,Ae,me,I.width,I.height):Ee(I)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Ae,me,I.width,I.height):n.renderbufferStorage(n.RENDERBUFFER,me,I.width,I.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function xe(B,I){if(I&&I.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,B),!(I.depthTexture&&I.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const O=i.get(I.depthTexture);O.__renderTarget=I,(!O.__webglTexture||I.depthTexture.image.width!==I.width||I.depthTexture.image.height!==I.height)&&(I.depthTexture.image.width=I.width,I.depthTexture.image.height=I.height,I.depthTexture.needsUpdate=!0),Q(I.depthTexture,0);const j=O.__webglTexture,z=ot(I);if(I.depthTexture.format===Hs)Ee(I)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0,z):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0);else if(I.depthTexture.format===Gs)Ee(I)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0,z):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0);else throw new Error("Unknown depthTexture format")}function Ve(B){const I=i.get(B),L=B.isWebGLCubeRenderTarget===!0;if(I.__boundDepthTexture!==B.depthTexture){const O=B.depthTexture;if(I.__depthDisposeCallback&&I.__depthDisposeCallback(),O){const j=()=>{delete I.__boundDepthTexture,delete I.__depthDisposeCallback,O.removeEventListener("dispose",j)};O.addEventListener("dispose",j),I.__depthDisposeCallback=j}I.__boundDepthTexture=O}if(B.depthTexture&&!I.__autoAllocateDepthBuffer){if(L)throw new Error("target.depthTexture not supported in Cube render targets");const O=B.texture.mipmaps;O&&O.length>0?xe(I.__webglFramebuffer[0],B):xe(I.__webglFramebuffer,B)}else if(L){I.__webglDepthbuffer=[];for(let O=0;O<6;O++)if(t.bindFramebuffer(n.FRAMEBUFFER,I.__webglFramebuffer[O]),I.__webglDepthbuffer[O]===void 0)I.__webglDepthbuffer[O]=n.createRenderbuffer(),Ie(I.__webglDepthbuffer[O],B,!1);else{const j=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,z=I.__webglDepthbuffer[O];n.bindRenderbuffer(n.RENDERBUFFER,z),n.framebufferRenderbuffer(n.FRAMEBUFFER,j,n.RENDERBUFFER,z)}}else{const O=B.texture.mipmaps;if(O&&O.length>0?t.bindFramebuffer(n.FRAMEBUFFER,I.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,I.__webglFramebuffer),I.__webglDepthbuffer===void 0)I.__webglDepthbuffer=n.createRenderbuffer(),Ie(I.__webglDepthbuffer,B,!1);else{const j=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,z=I.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,z),n.framebufferRenderbuffer(n.FRAMEBUFFER,j,n.RENDERBUFFER,z)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function St(B,I,L){const O=i.get(B);I!==void 0&&de(O.__webglFramebuffer,B,B.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),L!==void 0&&Ve(B)}function P(B){const I=B.texture,L=i.get(B),O=i.get(I);B.addEventListener("dispose",S);const j=B.textures,z=B.isWebGLCubeRenderTarget===!0,fe=j.length>1;if(fe||(O.__webglTexture===void 0&&(O.__webglTexture=n.createTexture()),O.__version=I.version,a.memory.textures++),z){L.__webglFramebuffer=[];for(let $=0;$<6;$++)if(I.mipmaps&&I.mipmaps.length>0){L.__webglFramebuffer[$]=[];for(let me=0;me<I.mipmaps.length;me++)L.__webglFramebuffer[$][me]=n.createFramebuffer()}else L.__webglFramebuffer[$]=n.createFramebuffer()}else{if(I.mipmaps&&I.mipmaps.length>0){L.__webglFramebuffer=[];for(let $=0;$<I.mipmaps.length;$++)L.__webglFramebuffer[$]=n.createFramebuffer()}else L.__webglFramebuffer=n.createFramebuffer();if(fe)for(let $=0,me=j.length;$<me;$++){const Ae=i.get(j[$]);Ae.__webglTexture===void 0&&(Ae.__webglTexture=n.createTexture(),a.memory.textures++)}if(B.samples>0&&Ee(B)===!1){L.__webglMultisampledFramebuffer=n.createFramebuffer(),L.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,L.__webglMultisampledFramebuffer);for(let $=0;$<j.length;$++){const me=j[$];L.__webglColorRenderbuffer[$]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,L.__webglColorRenderbuffer[$]);const Ae=s.convert(me.format,me.colorSpace),ie=s.convert(me.type),ce=M(me.internalFormat,Ae,ie,me.colorSpace,B.isXRRenderTarget===!0),Se=ot(B);n.renderbufferStorageMultisample(n.RENDERBUFFER,Se,ce,B.width,B.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+$,n.RENDERBUFFER,L.__webglColorRenderbuffer[$])}n.bindRenderbuffer(n.RENDERBUFFER,null),B.depthBuffer&&(L.__webglDepthRenderbuffer=n.createRenderbuffer(),Ie(L.__webglDepthRenderbuffer,B,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(z){t.bindTexture(n.TEXTURE_CUBE_MAP,O.__webglTexture),pe(n.TEXTURE_CUBE_MAP,I);for(let $=0;$<6;$++)if(I.mipmaps&&I.mipmaps.length>0)for(let me=0;me<I.mipmaps.length;me++)de(L.__webglFramebuffer[$][me],B,I,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,me);else de(L.__webglFramebuffer[$],B,I,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,0);A(I)&&p(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(fe){for(let $=0,me=j.length;$<me;$++){const Ae=j[$],ie=i.get(Ae);let ce=n.TEXTURE_2D;(B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&(ce=B.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(ce,ie.__webglTexture),pe(ce,Ae),de(L.__webglFramebuffer,B,Ae,n.COLOR_ATTACHMENT0+$,ce,0),A(Ae)&&p(ce)}t.unbindTexture()}else{let $=n.TEXTURE_2D;if((B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&($=B.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture($,O.__webglTexture),pe($,I),I.mipmaps&&I.mipmaps.length>0)for(let me=0;me<I.mipmaps.length;me++)de(L.__webglFramebuffer[me],B,I,n.COLOR_ATTACHMENT0,$,me);else de(L.__webglFramebuffer,B,I,n.COLOR_ATTACHMENT0,$,0);A(I)&&p($),t.unbindTexture()}B.depthBuffer&&Ve(B)}function at(B){const I=B.textures;for(let L=0,O=I.length;L<O;L++){const j=I[L];if(A(j)){const z=b(B),fe=i.get(j).__webglTexture;t.bindTexture(z,fe),p(z),t.unbindTexture()}}}const Ne=[],Te=[];function _e(B){if(B.samples>0){if(Ee(B)===!1){const I=B.textures,L=B.width,O=B.height;let j=n.COLOR_BUFFER_BIT;const z=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,fe=i.get(B),$=I.length>1;if($)for(let Ae=0;Ae<I.length;Ae++)t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);const me=B.texture.mipmaps;me&&me.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let Ae=0;Ae<I.length;Ae++){if(B.resolveDepthBuffer&&(B.depthBuffer&&(j|=n.DEPTH_BUFFER_BIT),B.stencilBuffer&&B.resolveStencilBuffer&&(j|=n.STENCIL_BUFFER_BIT)),$){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,fe.__webglColorRenderbuffer[Ae]);const ie=i.get(I[Ae]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,ie,0)}n.blitFramebuffer(0,0,L,O,0,0,L,O,j,n.NEAREST),l===!0&&(Ne.length=0,Te.length=0,Ne.push(n.COLOR_ATTACHMENT0+Ae),B.depthBuffer&&B.resolveDepthBuffer===!1&&(Ne.push(z),Te.push(z),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Te)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Ne))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),$)for(let Ae=0;Ae<I.length;Ae++){t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.RENDERBUFFER,fe.__webglColorRenderbuffer[Ae]);const ie=i.get(I[Ae]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.TEXTURE_2D,ie,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(B.depthBuffer&&B.resolveDepthBuffer===!1&&l){const I=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[I])}}}function ot(B){return Math.min(r.maxSamples,B.samples)}function Ee(B){const I=i.get(B);return B.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&I.__useRenderToTexture!==!1}function Oe(B){const I=a.render.frame;u.get(B)!==I&&(u.set(B,I),B.update())}function _t(B,I){const L=B.colorSpace,O=B.format,j=B.type;return B.isCompressedTexture===!0||B.isVideoTexture===!0||L!==Qt&&L!==Tn&&(Je.getTransfer(L)===ht?(O!==Pt||j!==ze)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",L)),I}function gt(B){return typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement?(c.width=B.naturalWidth||B.width,c.height=B.naturalHeight||B.height):typeof VideoFrame<"u"&&B instanceof VideoFrame?(c.width=B.displayWidth,c.height=B.displayHeight):(c.width=B.width,c.height=B.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=D,this.setTexture2D=Q,this.setTexture2DArray=G,this.setTexture3D=X,this.setTextureCube=V,this.rebindTextures=St,this.setupRenderTarget=P,this.updateRenderTargetMipmap=at,this.updateMultisampleRenderTarget=_e,this.setupDepthRenderbuffer=Ve,this.setupFrameBufferTexture=de,this.useMultisampledRTT=Ee}function _y(n,e){function t(i,r=Tn){let s;const a=Je.getTransfer(r);if(i===ze)return n.UNSIGNED_BYTE;if(i===Zc)return n.UNSIGNED_SHORT_4_4_4_4;if(i===$c)return n.UNSIGNED_SHORT_5_5_5_1;if(i===Mo)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===Io)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===Uf)return n.BYTE;if(i===Nf)return n.SHORT;if(i===Os)return n.UNSIGNED_SHORT;if(i===Jc)return n.INT;if(i===Hi)return n.UNSIGNED_INT;if(i===kt)return n.FLOAT;if(i===hn)return n.HALF_FLOAT;if(i===Ff)return n.ALPHA;if(i===Qs)return n.RGB;if(i===Pt)return n.RGBA;if(i===Hs)return n.DEPTH_COMPONENT;if(i===Gs)return n.DEPTH_STENCIL;if(i===ai)return n.RED;if(i===eu)return n.RED_INTEGER;if(i===Bi)return n.RG;if(i===tu)return n.RG_INTEGER;if(i===nu)return n.RGBA_INTEGER;if(i===Pr||i===Ui||i===Ur||i===Bs)if(a===ht)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Pr)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Ui)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ur)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Bs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Pr)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Ui)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ur)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Bs)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===io||i===pc||i===Hr||i===Vs)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===io)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===pc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Hr)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Vs)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===ro||i===zs||i===Ws)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===ro||i===zs)return a===ht?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===Ws)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===Ni||i===Ac||i===mc||i===gc||i===Nr||i===_c||i===Ec||i===vc||i===bc||i===xc||i===yc||i===Mc||i===Ic||i===Sc)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Ni)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ac)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===mc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===gc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Nr)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===_c)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ec)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===vc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===bc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===xc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===yc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Mc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Ic)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Sc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Gr||i===Cc||i===so)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Gr)return a===ht?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Cc)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===so)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===ao||i===oo||i===lo||i===co)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===ao)return s.COMPRESSED_RED_RGTC1_EXT;if(i===oo)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===lo)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===co)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===ks?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}const Ey=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,vy=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class by{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const i=new ip(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new Kn({vertexShader:Ey,fragmentShader:vy,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Ke(new Yr(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class xy extends qi{constructor(e,t){super();const i=this;let r=null,s=1,a=null,o="local-floor",l=1,c=null,u=null,h=null,d=null,f=null,g=null;const m=typeof XRWebGLBinding<"u",A=new by,p={},b=t.getContextAttributes();let M=null,E=null;const _=[],y=[],S=new we;let C=null;const v=new Wt;v.viewport=new nt;const x=new Wt;x.viewport=new nt;const T=[v,x],D=new TE;let U=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let J=_[Y];return J===void 0&&(J=new hl,_[Y]=J),J.getTargetRaySpace()},this.getControllerGrip=function(Y){let J=_[Y];return J===void 0&&(J=new hl,_[Y]=J),J.getGripSpace()},this.getHand=function(Y){let J=_[Y];return J===void 0&&(J=new hl,_[Y]=J),J.getHandSpace()};function Q(Y){const J=y.indexOf(Y.inputSource);if(J===-1)return;const de=_[J];de!==void 0&&(de.update(Y.inputSource,Y.frame,c||a),de.dispatchEvent({type:Y.type,data:Y.inputSource}))}function G(){r.removeEventListener("select",Q),r.removeEventListener("selectstart",Q),r.removeEventListener("selectend",Q),r.removeEventListener("squeeze",Q),r.removeEventListener("squeezestart",Q),r.removeEventListener("squeezeend",Q),r.removeEventListener("end",G),r.removeEventListener("inputsourceschange",X);for(let Y=0;Y<_.length;Y++){const J=y[Y];J!==null&&(y[Y]=null,_[Y].disconnect(J))}U=null,N=null,A.reset();for(const Y in p)delete p[Y];e.setRenderTarget(M),f=null,d=null,h=null,r=null,E=null,Ge.stop(),i.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return h===null&&m&&(h=new XRWebGLBinding(r,t)),h},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(Y){if(r=Y,r!==null){if(M=e.getRenderTarget(),r.addEventListener("select",Q),r.addEventListener("selectstart",Q),r.addEventListener("selectend",Q),r.addEventListener("squeeze",Q),r.addEventListener("squeezestart",Q),r.addEventListener("squeezeend",Q),r.addEventListener("end",G),r.addEventListener("inputsourceschange",X),b.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,Ie=null,xe=null;b.depth&&(xe=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=b.stencil?Gs:Hs,Ie=b.stencil?ks:Hi);const Ve={colorFormat:t.RGBA8,depthFormat:xe,scaleFactor:s};h=this.getBinding(),d=h.createProjectionLayer(Ve),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),E=new Gi(d.textureWidth,d.textureHeight,{format:Pt,type:ze,depthTexture:new np(d.textureWidth,d.textureHeight,Ie,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const de={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:s};f=new XRWebGLLayer(r,t,de),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),E=new Gi(f.framebufferWidth,f.framebufferHeight,{format:Pt,type:ze,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}E.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await r.requestReferenceSpace(o),Ge.setContext(r),Ge.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return A.getDepthTexture()};function X(Y){for(let J=0;J<Y.removed.length;J++){const de=Y.removed[J],Ie=y.indexOf(de);Ie>=0&&(y[Ie]=null,_[Ie].disconnect(de))}for(let J=0;J<Y.added.length;J++){const de=Y.added[J];let Ie=y.indexOf(de);if(Ie===-1){for(let Ve=0;Ve<_.length;Ve++)if(Ve>=y.length){y.push(de),Ie=Ve;break}else if(y[Ve]===null){y[Ve]=de,Ie=Ve;break}if(Ie===-1)break}const xe=_[Ie];xe&&xe.connect(de)}}const V=new R,ee=new R;function Z(Y,J,de){V.setFromMatrixPosition(J.matrixWorld),ee.setFromMatrixPosition(de.matrixWorld);const Ie=V.distanceTo(ee),xe=J.projectionMatrix.elements,Ve=de.projectionMatrix.elements,St=xe[14]/(xe[10]-1),P=xe[14]/(xe[10]+1),at=(xe[9]+1)/xe[5],Ne=(xe[9]-1)/xe[5],Te=(xe[8]-1)/xe[0],_e=(Ve[8]+1)/Ve[0],ot=St*Te,Ee=St*_e,Oe=Ie/(-Te+_e),_t=Oe*-Te;if(J.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(_t),Y.translateZ(Oe),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),xe[10]===-1)Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{const gt=St+Oe,B=P+Oe,I=ot-_t,L=Ee+(Ie-_t),O=at*P/B*gt,j=Ne*P/B*gt;Y.projectionMatrix.makePerspective(I,L,O,j,gt,B),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function se(Y,J){J===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(J.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(r===null)return;let J=Y.near,de=Y.far;A.texture!==null&&(A.depthNear>0&&(J=A.depthNear),A.depthFar>0&&(de=A.depthFar)),D.near=x.near=v.near=J,D.far=x.far=v.far=de,(U!==D.near||N!==D.far)&&(r.updateRenderState({depthNear:D.near,depthFar:D.far}),U=D.near,N=D.far),D.layers.mask=Y.layers.mask|6,v.layers.mask=D.layers.mask&3,x.layers.mask=D.layers.mask&5;const Ie=Y.parent,xe=D.cameras;se(D,Ie);for(let Ve=0;Ve<xe.length;Ve++)se(xe[Ve],Ie);xe.length===2?Z(D,v,x):D.projectionMatrix.copy(v.projectionMatrix),pe(Y,D,Ie)};function pe(Y,J,de){de===null?Y.matrix.copy(J.matrixWorld):(Y.matrix.copy(de.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(J.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Vr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Y)},this.hasDepthSensing=function(){return A.texture!==null},this.getDepthSensingMesh=function(){return A.getMesh(D)},this.getCameraTexture=function(Y){return p[Y]};let Ue=null;function We(Y,J){if(u=J.getViewerPose(c||a),g=J,u!==null){const de=u.views;f!==null&&(e.setRenderTargetFramebuffer(E,f.framebuffer),e.setRenderTarget(E));let Ie=!1;de.length!==D.cameras.length&&(D.cameras.length=0,Ie=!0);for(let P=0;P<de.length;P++){const at=de[P];let Ne=null;if(f!==null)Ne=f.getViewport(at);else{const _e=h.getViewSubImage(d,at);Ne=_e.viewport,P===0&&(e.setRenderTargetTextures(E,_e.colorTexture,_e.depthStencilTexture),e.setRenderTarget(E))}let Te=T[P];Te===void 0&&(Te=new Wt,Te.layers.enable(P),Te.viewport=new nt,T[P]=Te),Te.matrix.fromArray(at.transform.matrix),Te.matrix.decompose(Te.position,Te.quaternion,Te.scale),Te.projectionMatrix.fromArray(at.projectionMatrix),Te.projectionMatrixInverse.copy(Te.projectionMatrix).invert(),Te.viewport.set(Ne.x,Ne.y,Ne.width,Ne.height),P===0&&(D.matrix.copy(Te.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),Ie===!0&&D.cameras.push(Te)}const xe=r.enabledFeatures;if(xe&&xe.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&m){h=i.getBinding();const P=h.getDepthInformation(de[0]);P&&P.isValid&&P.texture&&A.init(P,r.renderState)}if(xe&&xe.includes("camera-access")&&m){e.state.unbindTexture(),h=i.getBinding();for(let P=0;P<de.length;P++){const at=de[P].camera;if(at){let Ne=p[at];Ne||(Ne=new ip,p[at]=Ne);const Te=h.getCameraImage(at);Ne.sourceTexture=Te}}}}for(let de=0;de<_.length;de++){const Ie=y[de],xe=_[de];Ie!==null&&xe!==void 0&&xe.update(Ie,J,c||a)}Ue&&Ue(Y,J),J.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:J}),g=null}const Ge=new up;Ge.setAnimationLoop(We),this.setAnimationLoop=function(Y){Ue=Y},this.dispose=function(){}}}const Ei=new jt,yy=new De;function My(n,e){function t(A,p){A.matrixAutoUpdate===!0&&A.updateMatrix(),p.value.copy(A.matrix)}function i(A,p){p.color.getRGB(A.fogColor.value,jf(n)),p.isFog?(A.fogNear.value=p.near,A.fogFar.value=p.far):p.isFogExp2&&(A.fogDensity.value=p.density)}function r(A,p,b,M,E){p.isMeshBasicMaterial||p.isMeshLambertMaterial?s(A,p):p.isMeshToonMaterial?(s(A,p),h(A,p)):p.isMeshPhongMaterial?(s(A,p),u(A,p)):p.isMeshStandardMaterial?(s(A,p),d(A,p),p.isMeshPhysicalMaterial&&f(A,p,E)):p.isMeshMatcapMaterial?(s(A,p),g(A,p)):p.isMeshDepthMaterial?s(A,p):p.isMeshDistanceMaterial?(s(A,p),m(A,p)):p.isMeshNormalMaterial?s(A,p):p.isLineBasicMaterial?(a(A,p),p.isLineDashedMaterial&&o(A,p)):p.isPointsMaterial?l(A,p,b,M):p.isSpriteMaterial?c(A,p):p.isShadowMaterial?(A.color.value.copy(p.color),A.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(A,p){A.opacity.value=p.opacity,p.color&&A.diffuse.value.copy(p.color),p.emissive&&A.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(A.map.value=p.map,t(p.map,A.mapTransform)),p.alphaMap&&(A.alphaMap.value=p.alphaMap,t(p.alphaMap,A.alphaMapTransform)),p.bumpMap&&(A.bumpMap.value=p.bumpMap,t(p.bumpMap,A.bumpMapTransform),A.bumpScale.value=p.bumpScale,p.side===qt&&(A.bumpScale.value*=-1)),p.normalMap&&(A.normalMap.value=p.normalMap,t(p.normalMap,A.normalMapTransform),A.normalScale.value.copy(p.normalScale),p.side===qt&&A.normalScale.value.negate()),p.displacementMap&&(A.displacementMap.value=p.displacementMap,t(p.displacementMap,A.displacementMapTransform),A.displacementScale.value=p.displacementScale,A.displacementBias.value=p.displacementBias),p.emissiveMap&&(A.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,A.emissiveMapTransform)),p.specularMap&&(A.specularMap.value=p.specularMap,t(p.specularMap,A.specularMapTransform)),p.alphaTest>0&&(A.alphaTest.value=p.alphaTest);const b=e.get(p),M=b.envMap,E=b.envMapRotation;M&&(A.envMap.value=M,Ei.copy(E),Ei.x*=-1,Ei.y*=-1,Ei.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(Ei.y*=-1,Ei.z*=-1),A.envMapRotation.value.setFromMatrix4(yy.makeRotationFromEuler(Ei)),A.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,A.reflectivity.value=p.reflectivity,A.ior.value=p.ior,A.refractionRatio.value=p.refractionRatio),p.lightMap&&(A.lightMap.value=p.lightMap,A.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,A.lightMapTransform)),p.aoMap&&(A.aoMap.value=p.aoMap,A.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,A.aoMapTransform))}function a(A,p){A.diffuse.value.copy(p.color),A.opacity.value=p.opacity,p.map&&(A.map.value=p.map,t(p.map,A.mapTransform))}function o(A,p){A.dashSize.value=p.dashSize,A.totalSize.value=p.dashSize+p.gapSize,A.scale.value=p.scale}function l(A,p,b,M){A.diffuse.value.copy(p.color),A.opacity.value=p.opacity,A.size.value=p.size*b,A.scale.value=M*.5,p.map&&(A.map.value=p.map,t(p.map,A.uvTransform)),p.alphaMap&&(A.alphaMap.value=p.alphaMap,t(p.alphaMap,A.alphaMapTransform)),p.alphaTest>0&&(A.alphaTest.value=p.alphaTest)}function c(A,p){A.diffuse.value.copy(p.color),A.opacity.value=p.opacity,A.rotation.value=p.rotation,p.map&&(A.map.value=p.map,t(p.map,A.mapTransform)),p.alphaMap&&(A.alphaMap.value=p.alphaMap,t(p.alphaMap,A.alphaMapTransform)),p.alphaTest>0&&(A.alphaTest.value=p.alphaTest)}function u(A,p){A.specular.value.copy(p.specular),A.shininess.value=Math.max(p.shininess,1e-4)}function h(A,p){p.gradientMap&&(A.gradientMap.value=p.gradientMap)}function d(A,p){A.metalness.value=p.metalness,p.metalnessMap&&(A.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,A.metalnessMapTransform)),A.roughness.value=p.roughness,p.roughnessMap&&(A.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,A.roughnessMapTransform)),p.envMap&&(A.envMapIntensity.value=p.envMapIntensity)}function f(A,p,b){A.ior.value=p.ior,p.sheen>0&&(A.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),A.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(A.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,A.sheenColorMapTransform)),p.sheenRoughnessMap&&(A.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,A.sheenRoughnessMapTransform))),p.clearcoat>0&&(A.clearcoat.value=p.clearcoat,A.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(A.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,A.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(A.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,A.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(A.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,A.clearcoatNormalMapTransform),A.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===qt&&A.clearcoatNormalScale.value.negate())),p.dispersion>0&&(A.dispersion.value=p.dispersion),p.iridescence>0&&(A.iridescence.value=p.iridescence,A.iridescenceIOR.value=p.iridescenceIOR,A.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],A.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(A.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,A.iridescenceMapTransform)),p.iridescenceThicknessMap&&(A.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,A.iridescenceThicknessMapTransform))),p.transmission>0&&(A.transmission.value=p.transmission,A.transmissionSamplerMap.value=b.texture,A.transmissionSamplerSize.value.set(b.width,b.height),p.transmissionMap&&(A.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,A.transmissionMapTransform)),A.thickness.value=p.thickness,p.thicknessMap&&(A.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,A.thicknessMapTransform)),A.attenuationDistance.value=p.attenuationDistance,A.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(A.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(A.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,A.anisotropyMapTransform))),A.specularIntensity.value=p.specularIntensity,A.specularColor.value.copy(p.specularColor),p.specularColorMap&&(A.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,A.specularColorMapTransform)),p.specularIntensityMap&&(A.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,A.specularIntensityMapTransform))}function g(A,p){p.matcap&&(A.matcap.value=p.matcap)}function m(A,p){const b=e.get(p).light;A.referencePosition.value.setFromMatrixPosition(b.matrixWorld),A.nearDistance.value=b.shadow.camera.near,A.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Iy(n,e,t,i){let r={},s={},a=[];const o=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(b,M){const E=M.program;i.uniformBlockBinding(b,E)}function c(b,M){let E=r[b.id];E===void 0&&(g(b),E=u(b),r[b.id]=E,b.addEventListener("dispose",A));const _=M.program;i.updateUBOMapping(b,_);const y=e.render.frame;s[b.id]!==y&&(d(b),s[b.id]=y)}function u(b){const M=h();b.__bindingPointIndex=M;const E=n.createBuffer(),_=b.__size,y=b.usage;return n.bindBuffer(n.UNIFORM_BUFFER,E),n.bufferData(n.UNIFORM_BUFFER,_,y),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,M,E),E}function h(){for(let b=0;b<o;b++)if(a.indexOf(b)===-1)return a.push(b),b;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(b){const M=r[b.id],E=b.uniforms,_=b.__cache;n.bindBuffer(n.UNIFORM_BUFFER,M);for(let y=0,S=E.length;y<S;y++){const C=Array.isArray(E[y])?E[y]:[E[y]];for(let v=0,x=C.length;v<x;v++){const T=C[v];if(f(T,y,v,_)===!0){const D=T.__offset,U=Array.isArray(T.value)?T.value:[T.value];let N=0;for(let Q=0;Q<U.length;Q++){const G=U[Q],X=m(G);typeof G=="number"||typeof G=="boolean"?(T.__data[0]=G,n.bufferSubData(n.UNIFORM_BUFFER,D+N,T.__data)):G.isMatrix3?(T.__data[0]=G.elements[0],T.__data[1]=G.elements[1],T.__data[2]=G.elements[2],T.__data[3]=0,T.__data[4]=G.elements[3],T.__data[5]=G.elements[4],T.__data[6]=G.elements[5],T.__data[7]=0,T.__data[8]=G.elements[6],T.__data[9]=G.elements[7],T.__data[10]=G.elements[8],T.__data[11]=0):(G.toArray(T.__data,N),N+=X.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,D,T.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function f(b,M,E,_){const y=b.value,S=M+"_"+E;if(_[S]===void 0)return typeof y=="number"||typeof y=="boolean"?_[S]=y:_[S]=y.clone(),!0;{const C=_[S];if(typeof y=="number"||typeof y=="boolean"){if(C!==y)return _[S]=y,!0}else if(C.equals(y)===!1)return C.copy(y),!0}return!1}function g(b){const M=b.uniforms;let E=0;const _=16;for(let S=0,C=M.length;S<C;S++){const v=Array.isArray(M[S])?M[S]:[M[S]];for(let x=0,T=v.length;x<T;x++){const D=v[x],U=Array.isArray(D.value)?D.value:[D.value];for(let N=0,Q=U.length;N<Q;N++){const G=U[N],X=m(G),V=E%_,ee=V%X.boundary,Z=V+ee;E+=ee,Z!==0&&_-Z<X.storage&&(E+=_-Z),D.__data=new Float32Array(X.storage/Float32Array.BYTES_PER_ELEMENT),D.__offset=E,E+=X.storage}}}const y=E%_;return y>0&&(E+=_-y),b.__size=E,b.__cache={},this}function m(b){const M={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(M.boundary=4,M.storage=4):b.isVector2?(M.boundary=8,M.storage=8):b.isVector3||b.isColor?(M.boundary=16,M.storage=12):b.isVector4?(M.boundary=16,M.storage=16):b.isMatrix3?(M.boundary=48,M.storage=48):b.isMatrix4?(M.boundary=64,M.storage=64):b.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",b),M}function A(b){const M=b.target;M.removeEventListener("dispose",A);const E=a.indexOf(M.__bindingPointIndex);a.splice(E,1),n.deleteBuffer(r[M.id]),delete r[M.id],delete s[M.id]}function p(){for(const b in r)n.deleteBuffer(r[b]);a=[],r={},s={}}return{bind:l,update:c,dispose:p}}class Sy{constructor(e={}){const{canvas:t=R_(),context:i=null,depth:r=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:d=!1}=e;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=a;const g=new Uint32Array(4),m=new Int32Array(4);let A=null,p=null;const b=[],M=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=li,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const E=this;let _=!1;this._outputColorSpace=Ct;let y=0,S=0,C=null,v=-1,x=null;const T=new nt,D=new nt;let U=null;const N=new be(0);let Q=0,G=t.width,X=t.height,V=1,ee=null,Z=null;const se=new nt(0,0,G,X),pe=new nt(0,0,G,X);let Ue=!1;const We=new cu;let Ge=!1,Y=!1;const J=new De,de=new R,Ie=new nt,xe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Ve=!1;function St(){return C===null?V:1}let P=i;function at(w,k){return t.getContext(w,k)}try{const w={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Oi}`),t.addEventListener("webglcontextlost",ae,!1),t.addEventListener("webglcontextrestored",ue,!1),t.addEventListener("webglcontextcreationerror",ne,!1),P===null){const k="webgl2";if(P=at(k,w),P===null)throw at(k)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let Ne,Te,_e,ot,Ee,Oe,_t,gt,B,I,L,O,j,z,fe,$,me,Ae,ie,ce,Se,ye,le,Re;function F(){Ne=new Nb(P),Ne.init(),ye=new _y(P,Ne),Te=new Tb(P,Ne,e,ye),_e=new my(P,Ne),Te.reversedDepthBuffer&&d&&_e.buffers.depth.setReversed(!0),ot=new kb(P),Ee=new iy,Oe=new gy(P,Ne,_e,Ee,Te,ye,ot),_t=new Bb(E),gt=new Ub(E),B=new WE(P),le=new Cb(P,B),I=new Fb(P,B,ot,le),L=new Hb(P,I,B,ot),ie=new Qb(P,Te,Oe),$=new Rb(Ee),O=new ny(E,_t,gt,Ne,Te,le,$),j=new My(E,Ee),z=new sy,fe=new hy(Ne),Ae=new Sb(E,_t,gt,_e,L,f,l),me=new py(E,L,Te),Re=new Iy(P,ot,Te,_e),ce=new wb(P,Ne,ot),Se=new Ob(P,Ne,ot),ot.programs=O.programs,E.capabilities=Te,E.extensions=Ne,E.properties=Ee,E.renderLists=z,E.shadowMap=me,E.state=_e,E.info=ot}F();const te=new xy(E,P);this.xr=te,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){const w=Ne.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=Ne.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return V},this.setPixelRatio=function(w){w!==void 0&&(V=w,this.setSize(G,X,!1))},this.getSize=function(w){return w.set(G,X)},this.setSize=function(w,k,W=!0){if(te.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}G=w,X=k,t.width=Math.floor(w*V),t.height=Math.floor(k*V),W===!0&&(t.style.width=w+"px",t.style.height=k+"px"),this.setViewport(0,0,w,k)},this.getDrawingBufferSize=function(w){return w.set(G*V,X*V).floor()},this.setDrawingBufferSize=function(w,k,W){G=w,X=k,V=W,t.width=Math.floor(w*W),t.height=Math.floor(k*W),this.setViewport(0,0,w,k)},this.getCurrentViewport=function(w){return w.copy(T)},this.getViewport=function(w){return w.copy(se)},this.setViewport=function(w,k,W,q){w.isVector4?se.set(w.x,w.y,w.z,w.w):se.set(w,k,W,q),_e.viewport(T.copy(se).multiplyScalar(V).round())},this.getScissor=function(w){return w.copy(pe)},this.setScissor=function(w,k,W,q){w.isVector4?pe.set(w.x,w.y,w.z,w.w):pe.set(w,k,W,q),_e.scissor(D.copy(pe).multiplyScalar(V).round())},this.getScissorTest=function(){return Ue},this.setScissorTest=function(w){_e.setScissorTest(Ue=w)},this.setOpaqueSort=function(w){ee=w},this.setTransparentSort=function(w){Z=w},this.getClearColor=function(w){return w.copy(Ae.getClearColor())},this.setClearColor=function(){Ae.setClearColor(...arguments)},this.getClearAlpha=function(){return Ae.getClearAlpha()},this.setClearAlpha=function(){Ae.setClearAlpha(...arguments)},this.clear=function(w=!0,k=!0,W=!0){let q=0;if(w){let H=!1;if(C!==null){const re=C.texture.format;H=re===nu||re===tu||re===eu}if(H){const re=C.texture.type,he=re===ze||re===Hi||re===Os||re===ks||re===Zc||re===$c,Me=Ae.getClearColor(),ge=Ae.getClearAlpha(),Pe=Me.r,Fe=Me.g,Ce=Me.b;he?(g[0]=Pe,g[1]=Fe,g[2]=Ce,g[3]=ge,P.clearBufferuiv(P.COLOR,0,g)):(m[0]=Pe,m[1]=Fe,m[2]=Ce,m[3]=ge,P.clearBufferiv(P.COLOR,0,m))}else q|=P.COLOR_BUFFER_BIT}k&&(q|=P.DEPTH_BUFFER_BIT),W&&(q|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),P.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ae,!1),t.removeEventListener("webglcontextrestored",ue,!1),t.removeEventListener("webglcontextcreationerror",ne,!1),Ae.dispose(),z.dispose(),fe.dispose(),Ee.dispose(),_t.dispose(),gt.dispose(),L.dispose(),le.dispose(),Re.dispose(),O.dispose(),te.dispose(),te.removeEventListener("sessionstart",rn),te.removeEventListener("sessionend",$r),Un.stop()};function ae(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),_=!0}function ue(){console.log("THREE.WebGLRenderer: Context Restored."),_=!1;const w=ot.autoReset,k=me.enabled,W=me.autoUpdate,q=me.needsUpdate,H=me.type;F(),ot.autoReset=w,me.enabled=k,me.autoUpdate=W,me.needsUpdate=q,me.type=H}function ne(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function K(w){const k=w.target;k.removeEventListener("dispose",K),ve(k)}function ve(w){ke(w),Ee.remove(w)}function ke(w){const k=Ee.get(w).programs;k!==void 0&&(k.forEach(function(W){O.releaseProgram(W)}),w.isShaderMaterial&&O.releaseShaderCache(w))}this.renderBufferDirect=function(w,k,W,q,H,re){k===null&&(k=xe);const he=H.isMesh&&H.matrixWorld.determinant()<0,Me=Iu(w,k,W,q,H);_e.setMaterial(q,he);let ge=W.index,Pe=1;if(q.wireframe===!0){if(ge=I.getWireframeAttribute(W),ge===void 0)return;Pe=2}const Fe=W.drawRange,Ce=W.attributes.position;let Ye=Fe.start*Pe,ut=(Fe.start+Fe.count)*Pe;re!==null&&(Ye=Math.max(Ye,re.start*Pe),ut=Math.min(ut,(re.start+re.count)*Pe)),ge!==null?(Ye=Math.max(Ye,0),ut=Math.min(ut,ge.count)):Ce!=null&&(Ye=Math.max(Ye,0),ut=Math.min(ut,Ce.count));const xt=ut-Ye;if(xt<0||xt===1/0)return;le.setup(H,q,Me,W,ge);let pt,ft=ce;if(ge!==null&&(pt=B.get(ge),ft=Se,ft.setIndex(pt)),H.isMesh)q.wireframe===!0?(_e.setLineWidth(q.wireframeLinewidth*St()),ft.setMode(P.LINES)):ft.setMode(P.TRIANGLES);else if(H.isLine){let Be=q.linewidth;Be===void 0&&(Be=1),_e.setLineWidth(Be*St()),H.isLineSegments?ft.setMode(P.LINES):H.isLineLoop?ft.setMode(P.LINE_LOOP):ft.setMode(P.LINE_STRIP)}else H.isPoints?ft.setMode(P.POINTS):H.isSprite&&ft.setMode(P.TRIANGLES);if(H.isBatchedMesh)if(H._multiDrawInstances!==null)Ys("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),ft.renderMultiDrawInstances(H._multiDrawStarts,H._multiDrawCounts,H._multiDrawCount,H._multiDrawInstances);else if(Ne.get("WEBGL_multi_draw"))ft.renderMultiDraw(H._multiDrawStarts,H._multiDrawCounts,H._multiDrawCount);else{const Be=H._multiDrawStarts,Et=H._multiDrawCounts,$e=H._multiDrawCount,Jt=ge?B.get(ge).bytesPerElement:1,Zi=Ee.get(q).currentProgram.getUniforms();for(let Zt=0;Zt<$e;Zt++)Zi.setValue(P,"_gl_DrawID",Zt),ft.render(Be[Zt]/Jt,Et[Zt])}else if(H.isInstancedMesh)ft.renderInstances(Ye,xt,H.count);else if(W.isInstancedBufferGeometry){const Be=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,Et=Math.min(W.instanceCount,Be);ft.renderInstances(Ye,xt,Et)}else ft.render(Ye,xt)};function it(w,k,W){w.transparent===!0&&w.side===tn&&w.forceSinglePass===!1?(w.side=qt,w.needsUpdate=!0,ci(w,k,W),w.side=Yn,w.needsUpdate=!0,ci(w,k,W),w.side=tn):ci(w,k,W)}this.compile=function(w,k,W=null){W===null&&(W=w),p=fe.get(W),p.init(k),M.push(p),W.traverseVisible(function(H){H.isLight&&H.layers.test(k.layers)&&(p.pushLight(H),H.castShadow&&p.pushShadow(H))}),w!==W&&w.traverseVisible(function(H){H.isLight&&H.layers.test(k.layers)&&(p.pushLight(H),H.castShadow&&p.pushShadow(H))}),p.setupLights();const q=new Set;return w.traverse(function(H){if(!(H.isMesh||H.isPoints||H.isLine||H.isSprite))return;const re=H.material;if(re)if(Array.isArray(re))for(let he=0;he<re.length;he++){const Me=re[he];it(Me,W,H),q.add(Me)}else it(re,W,H),q.add(re)}),p=M.pop(),q},this.compileAsync=function(w,k,W=null){const q=this.compile(w,k,W);return new Promise(H=>{function re(){if(q.forEach(function(he){Ee.get(he).currentProgram.isReady()&&q.delete(he)}),q.size===0){H(w);return}setTimeout(re,10)}Ne.get("KHR_parallel_shader_compile")!==null?re():setTimeout(re,10)})};let Ze=null;function pn(w){Ze&&Ze(w)}function rn(){Un.stop()}function $r(){Un.start()}const Un=new up;Un.setAnimationLoop(pn),typeof self<"u"&&Un.setContext(self),this.setAnimationLoop=function(w){Ze=w,te.setAnimationLoop(w),w===null?Un.stop():Un.start()},te.addEventListener("sessionstart",rn),te.addEventListener("sessionend",$r),this.render=function(w,k){if(k!==void 0&&k.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(_===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),k.parent===null&&k.matrixWorldAutoUpdate===!0&&k.updateMatrixWorld(),te.enabled===!0&&te.isPresenting===!0&&(te.cameraAutoUpdate===!0&&te.updateCamera(k),k=te.getCamera()),w.isScene===!0&&w.onBeforeRender(E,w,k,C),p=fe.get(w,M.length),p.init(k),M.push(p),J.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse),We.setFromProjectionMatrix(J,Rn,k.reversedDepth),Y=this.localClippingEnabled,Ge=$.init(this.clippingPlanes,Y),A=z.get(w,b.length),A.init(),b.push(A),te.enabled===!0&&te.isPresenting===!0){const re=E.xr.getDepthSensingMesh();re!==null&&es(re,k,-1/0,E.sortObjects)}es(w,k,0,E.sortObjects),A.finish(),E.sortObjects===!0&&A.sort(ee,Z),Ve=te.enabled===!1||te.isPresenting===!1||te.hasDepthSensing()===!1,Ve&&Ae.addToRenderList(A,w),this.info.render.frame++,Ge===!0&&$.beginShadows();const W=p.state.shadowsArray;me.render(W,w,k),Ge===!0&&$.endShadows(),this.info.autoReset===!0&&this.info.reset();const q=A.opaque,H=A.transmissive;if(p.setupLights(),k.isArrayCamera){const re=k.cameras;if(H.length>0)for(let he=0,Me=re.length;he<Me;he++){const ge=re[he];ea(q,H,w,ge)}Ve&&Ae.render(w);for(let he=0,Me=re.length;he<Me;he++){const ge=re[he];$s(A,w,ge,ge.viewport)}}else H.length>0&&ea(q,H,w,k),Ve&&Ae.render(w),$s(A,w,k);C!==null&&S===0&&(Oe.updateMultisampleRenderTarget(C),Oe.updateRenderTargetMipmap(C)),w.isScene===!0&&w.onAfterRender(E,w,k),le.resetDefaultState(),v=-1,x=null,M.pop(),M.length>0?(p=M[M.length-1],Ge===!0&&$.setGlobalState(E.clippingPlanes,p.state.camera)):p=null,b.pop(),b.length>0?A=b[b.length-1]:A=null};function es(w,k,W,q){if(w.visible===!1)return;if(w.layers.test(k.layers)){if(w.isGroup)W=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(k);else if(w.isLight)p.pushLight(w),w.castShadow&&p.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||We.intersectsSprite(w)){q&&Ie.setFromMatrixPosition(w.matrixWorld).applyMatrix4(J);const he=L.update(w),Me=w.material;Me.visible&&A.push(w,he,Me,W,Ie.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||We.intersectsObject(w))){const he=L.update(w),Me=w.material;if(q&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Ie.copy(w.boundingSphere.center)):(he.boundingSphere===null&&he.computeBoundingSphere(),Ie.copy(he.boundingSphere.center)),Ie.applyMatrix4(w.matrixWorld).applyMatrix4(J)),Array.isArray(Me)){const ge=he.groups;for(let Pe=0,Fe=ge.length;Pe<Fe;Pe++){const Ce=ge[Pe],Ye=Me[Ce.materialIndex];Ye&&Ye.visible&&A.push(w,he,Ye,W,Ie.z,Ce)}}else Me.visible&&A.push(w,he,Me,W,Ie.z,null)}}const re=w.children;for(let he=0,Me=re.length;he<Me;he++)es(re[he],k,W,q)}function $s(w,k,W,q){const H=w.opaque,re=w.transmissive,he=w.transparent;p.setupLightsView(W),Ge===!0&&$.setGlobalState(E.clippingPlanes,W),q&&_e.viewport(T.copy(q)),H.length>0&&Yi(H,k,W),re.length>0&&Yi(re,k,W),he.length>0&&Yi(he,k,W),_e.buffers.depth.setTest(!0),_e.buffers.depth.setMask(!0),_e.buffers.color.setMask(!0),_e.setPolygonOffset(!1)}function ea(w,k,W,q){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[q.id]===void 0&&(p.state.transmissionRenderTarget[q.id]=new Gi(1,1,{generateMipmaps:!0,type:Ne.has("EXT_color_buffer_half_float")||Ne.has("EXT_color_buffer_float")?hn:ze,minFilter:vn,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Je.workingColorSpace}));const re=p.state.transmissionRenderTarget[q.id],he=q.viewport||T;re.setSize(he.z*E.transmissionResolutionScale,he.w*E.transmissionResolutionScale);const Me=E.getRenderTarget(),ge=E.getActiveCubeFace(),Pe=E.getActiveMipmapLevel();E.setRenderTarget(re),E.getClearColor(N),Q=E.getClearAlpha(),Q<1&&E.setClearColor(16777215,.5),E.clear(),Ve&&Ae.render(W);const Fe=E.toneMapping;E.toneMapping=li;const Ce=q.viewport;if(q.viewport!==void 0&&(q.viewport=void 0),p.setupLightsView(q),Ge===!0&&$.setGlobalState(E.clippingPlanes,q),Yi(w,W,q),Oe.updateMultisampleRenderTarget(re),Oe.updateRenderTargetMipmap(re),Ne.has("WEBGL_multisampled_render_to_texture")===!1){let Ye=!1;for(let ut=0,xt=k.length;ut<xt;ut++){const pt=k[ut],ft=pt.object,Be=pt.geometry,Et=pt.material,$e=pt.group;if(Et.side===tn&&ft.layers.test(q.layers)){const Jt=Et.side;Et.side=qt,Et.needsUpdate=!0,Ki(ft,W,q,Be,Et,$e),Et.side=Jt,Et.needsUpdate=!0,Ye=!0}}Ye===!0&&(Oe.updateMultisampleRenderTarget(re),Oe.updateRenderTargetMipmap(re))}E.setRenderTarget(Me,ge,Pe),E.setClearColor(N,Q),Ce!==void 0&&(q.viewport=Ce),E.toneMapping=Fe}function Yi(w,k,W){const q=k.isScene===!0?k.overrideMaterial:null;for(let H=0,re=w.length;H<re;H++){const he=w[H],Me=he.object,ge=he.geometry,Pe=he.group;let Fe=he.material;Fe.allowOverride===!0&&q!==null&&(Fe=q),Me.layers.test(W.layers)&&Ki(Me,k,W,ge,Fe,Pe)}}function Ki(w,k,W,q,H,re){w.onBeforeRender(E,k,W,q,H,re),w.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),H.onBeforeRender(E,k,W,q,w,re),H.transparent===!0&&H.side===tn&&H.forceSinglePass===!1?(H.side=qt,H.needsUpdate=!0,E.renderBufferDirect(W,k,q,H,w,re),H.side=Yn,H.needsUpdate=!0,E.renderBufferDirect(W,k,q,H,w,re),H.side=tn):E.renderBufferDirect(W,k,q,H,w,re),w.onAfterRender(E,k,W,q,H,re)}function ci(w,k,W){k.isScene!==!0&&(k=xe);const q=Ee.get(w),H=p.state.lights,re=p.state.shadowsArray,he=H.state.version,Me=O.getParameters(w,H.state,re,k,W),ge=O.getProgramCacheKey(Me);let Pe=q.programs;q.environment=w.isMeshStandardMaterial?k.environment:null,q.fog=k.fog,q.envMap=(w.isMeshStandardMaterial?gt:_t).get(w.envMap||q.environment),q.envMapRotation=q.environment!==null&&w.envMap===null?k.environmentRotation:w.envMapRotation,Pe===void 0&&(w.addEventListener("dispose",K),Pe=new Map,q.programs=Pe);let Fe=Pe.get(ge);if(Fe!==void 0){if(q.currentProgram===Fe&&q.lightsStateVersion===he)return na(w,Me),Fe}else Me.uniforms=O.getUniforms(w),w.onBeforeCompile(Me,E),Fe=O.acquireProgram(Me,ge),Pe.set(ge,Fe),q.uniforms=Me.uniforms;const Ce=q.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ce.clippingPlanes=$.uniform),na(w,Me),q.needsLights=ia(w),q.lightsStateVersion=he,q.needsLights&&(Ce.ambientLightColor.value=H.state.ambient,Ce.lightProbe.value=H.state.probe,Ce.directionalLights.value=H.state.directional,Ce.directionalLightShadows.value=H.state.directionalShadow,Ce.spotLights.value=H.state.spot,Ce.spotLightShadows.value=H.state.spotShadow,Ce.rectAreaLights.value=H.state.rectArea,Ce.ltc_1.value=H.state.rectAreaLTC1,Ce.ltc_2.value=H.state.rectAreaLTC2,Ce.pointLights.value=H.state.point,Ce.pointLightShadows.value=H.state.pointShadow,Ce.hemisphereLights.value=H.state.hemi,Ce.directionalShadowMap.value=H.state.directionalShadowMap,Ce.directionalShadowMatrix.value=H.state.directionalShadowMatrix,Ce.spotShadowMap.value=H.state.spotShadowMap,Ce.spotLightMatrix.value=H.state.spotLightMatrix,Ce.spotLightMap.value=H.state.spotLightMap,Ce.pointShadowMap.value=H.state.pointShadowMap,Ce.pointShadowMatrix.value=H.state.pointShadowMatrix),q.currentProgram=Fe,q.uniformsList=null,Fe}function ta(w){if(w.uniformsList===null){const k=w.currentProgram.getUniforms();w.uniformsList=Wa.seqWithValue(k.seq,w.uniforms)}return w.uniformsList}function na(w,k){const W=Ee.get(w);W.outputColorSpace=k.outputColorSpace,W.batching=k.batching,W.batchingColor=k.batchingColor,W.instancing=k.instancing,W.instancingColor=k.instancingColor,W.instancingMorph=k.instancingMorph,W.skinning=k.skinning,W.morphTargets=k.morphTargets,W.morphNormals=k.morphNormals,W.morphColors=k.morphColors,W.morphTargetsCount=k.morphTargetsCount,W.numClippingPlanes=k.numClippingPlanes,W.numIntersection=k.numClipIntersection,W.vertexAlphas=k.vertexAlphas,W.vertexTangents=k.vertexTangents,W.toneMapping=k.toneMapping}function Iu(w,k,W,q,H){k.isScene!==!0&&(k=xe),Oe.resetTextureUnits();const re=k.fog,he=q.isMeshStandardMaterial?k.environment:null,Me=C===null?E.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:Qt,ge=(q.isMeshStandardMaterial?gt:_t).get(q.envMap||he),Pe=q.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,Fe=!!W.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Ce=!!W.morphAttributes.position,Ye=!!W.morphAttributes.normal,ut=!!W.morphAttributes.color;let xt=li;q.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(xt=E.toneMapping);const pt=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,ft=pt!==void 0?pt.length:0,Be=Ee.get(q),Et=p.state.lights;if(Ge===!0&&(Y===!0||w!==x)){const Ht=w===x&&q.id===v;$.setState(q,w,Ht)}let $e=!1;q.version===Be.__version?(Be.needsLights&&Be.lightsStateVersion!==Et.state.version||Be.outputColorSpace!==Me||H.isBatchedMesh&&Be.batching===!1||!H.isBatchedMesh&&Be.batching===!0||H.isBatchedMesh&&Be.batchingColor===!0&&H.colorTexture===null||H.isBatchedMesh&&Be.batchingColor===!1&&H.colorTexture!==null||H.isInstancedMesh&&Be.instancing===!1||!H.isInstancedMesh&&Be.instancing===!0||H.isSkinnedMesh&&Be.skinning===!1||!H.isSkinnedMesh&&Be.skinning===!0||H.isInstancedMesh&&Be.instancingColor===!0&&H.instanceColor===null||H.isInstancedMesh&&Be.instancingColor===!1&&H.instanceColor!==null||H.isInstancedMesh&&Be.instancingMorph===!0&&H.morphTexture===null||H.isInstancedMesh&&Be.instancingMorph===!1&&H.morphTexture!==null||Be.envMap!==ge||q.fog===!0&&Be.fog!==re||Be.numClippingPlanes!==void 0&&(Be.numClippingPlanes!==$.numPlanes||Be.numIntersection!==$.numIntersection)||Be.vertexAlphas!==Pe||Be.vertexTangents!==Fe||Be.morphTargets!==Ce||Be.morphNormals!==Ye||Be.morphColors!==ut||Be.toneMapping!==xt||Be.morphTargetsCount!==ft)&&($e=!0):($e=!0,Be.__version=q.version);let Jt=Be.currentProgram;$e===!0&&(Jt=ci(q,k,H));let Zi=!1,Zt=!1,ts=!1;const vt=Jt.getUniforms(),sn=Be.uniforms;if(_e.useProgram(Jt.program)&&(Zi=!0,Zt=!0,ts=!0),q.id!==v&&(v=q.id,Zt=!0),Zi||x!==w){_e.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),vt.setValue(P,"projectionMatrix",w.projectionMatrix),vt.setValue(P,"viewMatrix",w.matrixWorldInverse);const Xt=vt.map.cameraPosition;Xt!==void 0&&Xt.setValue(P,de.setFromMatrixPosition(w.matrixWorld)),Te.logarithmicDepthBuffer&&vt.setValue(P,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&vt.setValue(P,"isOrthographic",w.isOrthographicCamera===!0),x!==w&&(x=w,Zt=!0,ts=!0)}if(H.isSkinnedMesh){vt.setOptional(P,H,"bindMatrix"),vt.setOptional(P,H,"bindMatrixInverse");const Ht=H.skeleton;Ht&&(Ht.boneTexture===null&&Ht.computeBoneTexture(),vt.setValue(P,"boneTexture",Ht.boneTexture,Oe))}H.isBatchedMesh&&(vt.setOptional(P,H,"batchingTexture"),vt.setValue(P,"batchingTexture",H._matricesTexture,Oe),vt.setOptional(P,H,"batchingIdTexture"),vt.setValue(P,"batchingIdTexture",H._indirectTexture,Oe),vt.setOptional(P,H,"batchingColorTexture"),H._colorsTexture!==null&&vt.setValue(P,"batchingColorTexture",H._colorsTexture,Oe));const an=W.morphAttributes;if((an.position!==void 0||an.normal!==void 0||an.color!==void 0)&&ie.update(H,W,Jt),(Zt||Be.receiveShadow!==H.receiveShadow)&&(Be.receiveShadow=H.receiveShadow,vt.setValue(P,"receiveShadow",H.receiveShadow)),q.isMeshGouraudMaterial&&q.envMap!==null&&(sn.envMap.value=ge,sn.flipEnvMap.value=ge.isCubeTexture&&ge.isRenderTargetTexture===!1?-1:1),q.isMeshStandardMaterial&&q.envMap===null&&k.environment!==null&&(sn.envMapIntensity.value=k.environmentIntensity),Zt&&(vt.setValue(P,"toneMappingExposure",E.toneMappingExposure),Be.needsLights&&Fo(sn,ts),re&&q.fog===!0&&j.refreshFogUniforms(sn,re),j.refreshMaterialUniforms(sn,q,V,X,p.state.transmissionRenderTarget[w.id]),Wa.upload(P,ta(Be),sn,Oe)),q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(Wa.upload(P,ta(Be),sn,Oe),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&vt.setValue(P,"center",H.center),vt.setValue(P,"modelViewMatrix",H.modelViewMatrix),vt.setValue(P,"normalMatrix",H.normalMatrix),vt.setValue(P,"modelMatrix",H.matrixWorld),q.isShaderMaterial||q.isRawShaderMaterial){const Ht=q.uniformsGroups;for(let Xt=0,Qo=Ht.length;Xt<Qo;Xt++){const ui=Ht[Xt];Re.update(ui,Jt),Re.bind(ui,Jt)}}return Jt}function Fo(w,k){w.ambientLightColor.needsUpdate=k,w.lightProbe.needsUpdate=k,w.directionalLights.needsUpdate=k,w.directionalLightShadows.needsUpdate=k,w.pointLights.needsUpdate=k,w.pointLightShadows.needsUpdate=k,w.spotLights.needsUpdate=k,w.spotLightShadows.needsUpdate=k,w.rectAreaLights.needsUpdate=k,w.hemisphereLights.needsUpdate=k}function ia(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return y},this.getActiveMipmapLevel=function(){return S},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(w,k,W){const q=Ee.get(w);q.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,q.__autoAllocateDepthBuffer===!1&&(q.__useRenderToTexture=!1),Ee.get(w.texture).__webglTexture=k,Ee.get(w.depthTexture).__webglTexture=q.__autoAllocateDepthBuffer?void 0:W,q.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,k){const W=Ee.get(w);W.__webglFramebuffer=k,W.__useDefaultFramebuffer=k===void 0};const Oo=P.createFramebuffer();this.setRenderTarget=function(w,k=0,W=0){C=w,y=k,S=W;let q=!0,H=null,re=!1,he=!1;if(w){const ge=Ee.get(w);if(ge.__useDefaultFramebuffer!==void 0)_e.bindFramebuffer(P.FRAMEBUFFER,null),q=!1;else if(ge.__webglFramebuffer===void 0)Oe.setupRenderTarget(w);else if(ge.__hasExternalTextures)Oe.rebindTextures(w,Ee.get(w.texture).__webglTexture,Ee.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Ce=w.depthTexture;if(ge.__boundDepthTexture!==Ce){if(Ce!==null&&Ee.has(Ce)&&(w.width!==Ce.image.width||w.height!==Ce.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Oe.setupDepthRenderbuffer(w)}}const Pe=w.texture;(Pe.isData3DTexture||Pe.isDataArrayTexture||Pe.isCompressedArrayTexture)&&(he=!0);const Fe=Ee.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Fe[k])?H=Fe[k][W]:H=Fe[k],re=!0):w.samples>0&&Oe.useMultisampledRTT(w)===!1?H=Ee.get(w).__webglMultisampledFramebuffer:Array.isArray(Fe)?H=Fe[W]:H=Fe,T.copy(w.viewport),D.copy(w.scissor),U=w.scissorTest}else T.copy(se).multiplyScalar(V).floor(),D.copy(pe).multiplyScalar(V).floor(),U=Ue;if(W!==0&&(H=Oo),_e.bindFramebuffer(P.FRAMEBUFFER,H)&&q&&_e.drawBuffers(w,H),_e.viewport(T),_e.scissor(D),_e.setScissorTest(U),re){const ge=Ee.get(w.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+k,ge.__webglTexture,W)}else if(he){const ge=k;for(let Pe=0;Pe<w.textures.length;Pe++){const Fe=Ee.get(w.textures[Pe]);P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0+Pe,Fe.__webglTexture,W,ge)}}else if(w!==null&&W!==0){const ge=Ee.get(w.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,ge.__webglTexture,W)}v=-1},this.readRenderTargetPixels=function(w,k,W,q,H,re,he,Me=0){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ge=Ee.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge){_e.bindFramebuffer(P.FRAMEBUFFER,ge);try{const Pe=w.textures[Me],Fe=Pe.format,Ce=Pe.type;if(!Te.textureFormatReadable(Fe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Te.textureTypeReadable(Ce)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}k>=0&&k<=w.width-q&&W>=0&&W<=w.height-H&&(w.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+Me),P.readPixels(k,W,q,H,ye.convert(Fe),ye.convert(Ce),re))}finally{const Pe=C!==null?Ee.get(C).__webglFramebuffer:null;_e.bindFramebuffer(P.FRAMEBUFFER,Pe)}}},this.readRenderTargetPixelsAsync=async function(w,k,W,q,H,re,he,Me=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ge=Ee.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge)if(k>=0&&k<=w.width-q&&W>=0&&W<=w.height-H){_e.bindFramebuffer(P.FRAMEBUFFER,ge);const Pe=w.textures[Me],Fe=Pe.format,Ce=Pe.type;if(!Te.textureFormatReadable(Fe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Te.textureTypeReadable(Ce))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ye=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,Ye),P.bufferData(P.PIXEL_PACK_BUFFER,re.byteLength,P.STREAM_READ),w.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+Me),P.readPixels(k,W,q,H,ye.convert(Fe),ye.convert(Ce),0);const ut=C!==null?Ee.get(C).__webglFramebuffer:null;_e.bindFramebuffer(P.FRAMEBUFFER,ut);const xt=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await B_(P,xt,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,Ye),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,re),P.deleteBuffer(Ye),P.deleteSync(xt),re}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,k=null,W=0){const q=Math.pow(2,-W),H=Math.floor(w.image.width*q),re=Math.floor(w.image.height*q),he=k!==null?k.x:0,Me=k!==null?k.y:0;Oe.setTexture2D(w,0),P.copyTexSubImage2D(P.TEXTURE_2D,W,0,0,he,Me,H,re),_e.unbindTexture()};const ko=P.createFramebuffer(),Ji=P.createFramebuffer();this.copyTextureToTexture=function(w,k,W=null,q=null,H=0,re=null){re===null&&(H!==0?(Ys("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),re=H,H=0):re=0);let he,Me,ge,Pe,Fe,Ce,Ye,ut,xt;const pt=w.isCompressedTexture?w.mipmaps[re]:w.image;if(W!==null)he=W.max.x-W.min.x,Me=W.max.y-W.min.y,ge=W.isBox3?W.max.z-W.min.z:1,Pe=W.min.x,Fe=W.min.y,Ce=W.isBox3?W.min.z:0;else{const an=Math.pow(2,-H);he=Math.floor(pt.width*an),Me=Math.floor(pt.height*an),w.isDataArrayTexture?ge=pt.depth:w.isData3DTexture?ge=Math.floor(pt.depth*an):ge=1,Pe=0,Fe=0,Ce=0}q!==null?(Ye=q.x,ut=q.y,xt=q.z):(Ye=0,ut=0,xt=0);const ft=ye.convert(k.format),Be=ye.convert(k.type);let Et;k.isData3DTexture?(Oe.setTexture3D(k,0),Et=P.TEXTURE_3D):k.isDataArrayTexture||k.isCompressedArrayTexture?(Oe.setTexture2DArray(k,0),Et=P.TEXTURE_2D_ARRAY):(Oe.setTexture2D(k,0),Et=P.TEXTURE_2D),P.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,k.flipY),P.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,k.premultiplyAlpha),P.pixelStorei(P.UNPACK_ALIGNMENT,k.unpackAlignment);const $e=P.getParameter(P.UNPACK_ROW_LENGTH),Jt=P.getParameter(P.UNPACK_IMAGE_HEIGHT),Zi=P.getParameter(P.UNPACK_SKIP_PIXELS),Zt=P.getParameter(P.UNPACK_SKIP_ROWS),ts=P.getParameter(P.UNPACK_SKIP_IMAGES);P.pixelStorei(P.UNPACK_ROW_LENGTH,pt.width),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,pt.height),P.pixelStorei(P.UNPACK_SKIP_PIXELS,Pe),P.pixelStorei(P.UNPACK_SKIP_ROWS,Fe),P.pixelStorei(P.UNPACK_SKIP_IMAGES,Ce);const vt=w.isDataArrayTexture||w.isData3DTexture,sn=k.isDataArrayTexture||k.isData3DTexture;if(w.isDepthTexture){const an=Ee.get(w),Ht=Ee.get(k),Xt=Ee.get(an.__renderTarget),Qo=Ee.get(Ht.__renderTarget);_e.bindFramebuffer(P.READ_FRAMEBUFFER,Xt.__webglFramebuffer),_e.bindFramebuffer(P.DRAW_FRAMEBUFFER,Qo.__webglFramebuffer);for(let ui=0;ui<ge;ui++)vt&&(P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Ee.get(w).__webglTexture,H,Ce+ui),P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Ee.get(k).__webglTexture,re,xt+ui)),P.blitFramebuffer(Pe,Fe,he,Me,Ye,ut,he,Me,P.DEPTH_BUFFER_BIT,P.NEAREST);_e.bindFramebuffer(P.READ_FRAMEBUFFER,null),_e.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else if(H!==0||w.isRenderTargetTexture||Ee.has(w)){const an=Ee.get(w),Ht=Ee.get(k);_e.bindFramebuffer(P.READ_FRAMEBUFFER,ko),_e.bindFramebuffer(P.DRAW_FRAMEBUFFER,Ji);for(let Xt=0;Xt<ge;Xt++)vt?P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,an.__webglTexture,H,Ce+Xt):P.framebufferTexture2D(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,an.__webglTexture,H),sn?P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Ht.__webglTexture,re,xt+Xt):P.framebufferTexture2D(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,Ht.__webglTexture,re),H!==0?P.blitFramebuffer(Pe,Fe,he,Me,Ye,ut,he,Me,P.COLOR_BUFFER_BIT,P.NEAREST):sn?P.copyTexSubImage3D(Et,re,Ye,ut,xt+Xt,Pe,Fe,he,Me):P.copyTexSubImage2D(Et,re,Ye,ut,Pe,Fe,he,Me);_e.bindFramebuffer(P.READ_FRAMEBUFFER,null),_e.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else sn?w.isDataTexture||w.isData3DTexture?P.texSubImage3D(Et,re,Ye,ut,xt,he,Me,ge,ft,Be,pt.data):k.isCompressedArrayTexture?P.compressedTexSubImage3D(Et,re,Ye,ut,xt,he,Me,ge,ft,pt.data):P.texSubImage3D(Et,re,Ye,ut,xt,he,Me,ge,ft,Be,pt):w.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,re,Ye,ut,he,Me,ft,Be,pt.data):w.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,re,Ye,ut,pt.width,pt.height,ft,pt.data):P.texSubImage2D(P.TEXTURE_2D,re,Ye,ut,he,Me,ft,Be,pt);P.pixelStorei(P.UNPACK_ROW_LENGTH,$e),P.pixelStorei(P.UNPACK_IMAGE_HEIGHT,Jt),P.pixelStorei(P.UNPACK_SKIP_PIXELS,Zi),P.pixelStorei(P.UNPACK_SKIP_ROWS,Zt),P.pixelStorei(P.UNPACK_SKIP_IMAGES,ts),re===0&&k.generateMipmaps&&P.generateMipmap(Et),_e.unbindTexture()},this.initRenderTarget=function(w){Ee.get(w).__webglFramebuffer===void 0&&Oe.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?Oe.setTextureCube(w,0):w.isData3DTexture?Oe.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?Oe.setTexture2DArray(w,0):Oe.setTexture2D(w,0),_e.unbindTexture()},this.resetState=function(){y=0,S=0,C=null,_e.reset(),le.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Je._getDrawingBufferColorSpace(e),t.unpackColorSpace=Je._getUnpackColorSpace()}}class Cy{constructor(e=4){this.pool=e,this.queue=[],this.workers=[],this.workersResolve=[],this.workerStatus=0,this.workerCreator=null}_initWorker(e){if(!this.workers[e]){const t=this.workerCreator();t.addEventListener("message",this._onMessage.bind(this,e)),this.workers[e]=t}}_getIdleWorker(){for(let e=0;e<this.pool;e++)if(!(this.workerStatus&1<<e))return e;return-1}_onMessage(e,t){const i=this.workersResolve[e];if(i&&i(t),this.queue.length){const{resolve:r,msg:s,transfer:a}=this.queue.shift();this.workersResolve[e]=r,this.workers[e].postMessage(s,a)}else this.workerStatus^=1<<e}setWorkerCreator(e){this.workerCreator=e}setWorkerLimit(e){this.pool=e}postMessage(e,t){return new Promise(i=>{const r=this._getIdleWorker();r!==-1?(this._initWorker(r),this.workerStatus|=1<<r,this.workersResolve[r]=i,this.workers[r].postMessage(e,t)):this.queue.push({resolve:i,msg:e,transfer:t})})}dispose(){this.workers.forEach(e=>e.terminate()),this.workersResolve.length=0,this.workers.length=0,this.queue.length=0,this.workerStatus=0}}const wy=0,ld=2,Ty=1,cd=2,Ry=0,By=1,Ly=10,Dy=0,Ap=9,mp=15,gp=16,_p=22,Ep=37,vp=43,bp=76,xp=83,yp=97,Mp=100,Ip=103,Sp=109,Cp=122,wp=123,Tp=131,Rp=132,Bp=133,Lp=134,Dp=137,Pp=138,Up=139,Np=140,Fp=141,Op=142,kp=145,Qp=146,Hp=148,Gp=152,Vp=157,zp=158,Wp=165,qp=166,jp=1000054e3,Xp=1000054001,Yp=1000054004,Kp=1000054005,_u=1000066e3,Jp=1000066004;class ps{constructor(e,t,i,r){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+t,i),this._littleEndian=r,this._offset=0}_nextUint8(){const e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){const e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){const e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){const e=this._dataView.getUint32(this._offset,this._littleEndian)+4294967296*this._dataView.getUint32(this._offset+4,this._littleEndian);return this._offset+=8,e}_nextInt32(){const e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){const t=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,t}_skip(e){return this._offset+=e,this}_scan(e,t=0){const i=this._offset;let r=0;for(;this._dataView.getUint8(this._offset)!==t&&r<e;)r++,this._offset++;return r<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+i,r)}}const Vt=[171,75,84,88,32,50,48,187,13,10,26,10];function ud(n){return new TextDecoder().decode(n)}function Py(n){const e=new Uint8Array(n.buffer,n.byteOffset,Vt.length);if(e[0]!==Vt[0]||e[1]!==Vt[1]||e[2]!==Vt[2]||e[3]!==Vt[3]||e[4]!==Vt[4]||e[5]!==Vt[5]||e[6]!==Vt[6]||e[7]!==Vt[7]||e[8]!==Vt[8]||e[9]!==Vt[9]||e[10]!==Vt[10]||e[11]!==Vt[11])throw new Error("Missing KTX 2.0 identifier.");const t={vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null},i=17*Uint32Array.BYTES_PER_ELEMENT,r=new ps(n,Vt.length,i,!0);t.vkFormat=r._nextUint32(),t.typeSize=r._nextUint32(),t.pixelWidth=r._nextUint32(),t.pixelHeight=r._nextUint32(),t.pixelDepth=r._nextUint32(),t.layerCount=r._nextUint32(),t.faceCount=r._nextUint32(),t.levelCount=r._nextUint32(),t.supercompressionScheme=r._nextUint32();const s=r._nextUint32(),a=r._nextUint32(),o=r._nextUint32(),l=r._nextUint32(),c=r._nextUint64(),u=r._nextUint64(),h=3*Math.max(t.levelCount,1)*8,d=new ps(n,Vt.length+i,h,!0);for(let se=0,pe=Math.max(t.levelCount,1);se<pe;se++)t.levels.push({levelData:new Uint8Array(n.buffer,n.byteOffset+d._nextUint64(),d._nextUint64()),uncompressedByteLength:d._nextUint64()});const f=new ps(n,s,a,!0);f._skip(4);const g=f._nextUint16(),m=f._nextUint16(),A=f._nextUint16(),p=f._nextUint16(),b={vendorId:g,descriptorType:m,versionNumber:A,colorModel:f._nextUint8(),colorPrimaries:f._nextUint8(),transferFunction:f._nextUint8(),flags:f._nextUint8(),texelBlockDimension:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],bytesPlane:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],samples:[]},M=(p/4-6)/4;for(let se=0;se<M;se++){const pe={bitOffset:f._nextUint16(),bitLength:f._nextUint8(),channelType:f._nextUint8(),samplePosition:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};64&pe.channelType?(pe.sampleLower=f._nextInt32(),pe.sampleUpper=f._nextInt32()):(pe.sampleLower=f._nextUint32(),pe.sampleUpper=f._nextUint32()),b.samples[se]=pe}t.dataFormatDescriptor.length=0,t.dataFormatDescriptor.push(b);const E=new ps(n,o,l,!0);for(;E._offset<l;){const se=E._nextUint32(),pe=E._scan(se),Ue=ud(pe);if(t.keyValue[Ue]=E._nextUint8Array(se-pe.byteLength-1),Ue.match(/^ktx/i)){const We=ud(t.keyValue[Ue]);t.keyValue[Ue]=We.substring(0,We.lastIndexOf("\0"))}E._skip(se%4?4-se%4:0)}if(u<=0)return t;const _=new ps(n,c,u,!0),y=_._nextUint16(),S=_._nextUint16(),C=_._nextUint32(),v=_._nextUint32(),x=_._nextUint32(),T=_._nextUint32(),D=[];for(let se=0,pe=Math.max(t.levelCount,1);se<pe;se++)D.push({imageFlags:_._nextUint32(),rgbSliceByteOffset:_._nextUint32(),rgbSliceByteLength:_._nextUint32(),alphaSliceByteOffset:_._nextUint32(),alphaSliceByteLength:_._nextUint32()});const U=c+_._offset,N=U+C,Q=N+v,G=Q+x,X=new Uint8Array(n.buffer,n.byteOffset+U,C),V=new Uint8Array(n.buffer,n.byteOffset+N,v),ee=new Uint8Array(n.buffer,n.byteOffset+Q,x),Z=new Uint8Array(n.buffer,n.byteOffset+G,T);return t.globalData={endpointCount:y,selectorCount:S,imageDescs:D,endpointsData:X,selectorsData:V,tablesData:ee,extendedData:Z},t}let Sl,zn,Pc;const Cl={env:{emscripten_notify_memory_growth:function(n){Pc=new Uint8Array(zn.exports.memory.buffer)}}};class Uy{init(){return Sl||(Sl=typeof fetch<"u"?fetch("data:application/wasm;base64,"+hd).then(e=>e.arrayBuffer()).then(e=>WebAssembly.instantiate(e,Cl)).then(this._init):WebAssembly.instantiate(Buffer.from(hd,"base64"),Cl).then(this._init),Sl)}_init(e){zn=e.instance,Cl.env.emscripten_notify_memory_growth(0)}decode(e,t=0){if(!zn)throw new Error("ZSTDDecoder: Await .init() before decoding.");const i=e.byteLength,r=zn.exports.malloc(i);Pc.set(e,r),t=t||Number(zn.exports.ZSTD_findDecompressedSize(r,i));const s=zn.exports.malloc(t),a=zn.exports.ZSTD_decompress(s,t,r,i),o=Pc.slice(s,s+a);return zn.exports.free(r),zn.exports.free(s),o}}const hd="AGFzbQEAAAABpQEVYAF/AX9gAn9/AGADf39/AX9gBX9/f39/AX9gAX8AYAJ/fwF/YAR/f39/AX9gA39/fwBgBn9/f39/fwF/YAd/f39/f39/AX9gAn9/AX5gAn5+AX5gAABgBX9/f39/AGAGf39/f39/AGAIf39/f39/f38AYAl/f39/f39/f38AYAABf2AIf39/f39/f38Bf2ANf39/f39/f39/f39/fwF/YAF/AX4CJwEDZW52H2Vtc2NyaXB0ZW5fbm90aWZ5X21lbW9yeV9ncm93dGgABANpaAEFAAAFAgEFCwACAQABAgIFBQcAAwABDgsBAQcAEhMHAAUBDAQEAAANBwQCAgYCBAgDAwMDBgEACQkHBgICAAYGAgQUBwYGAwIGAAMCAQgBBwUGCgoEEQAEBAEIAwgDBQgDEA8IAAcABAUBcAECAgUEAQCAAgYJAX8BQaCgwAILB2AHBm1lbW9yeQIABm1hbGxvYwAoBGZyZWUAJgxaU1REX2lzRXJyb3IAaBlaU1REX2ZpbmREZWNvbXByZXNzZWRTaXplAFQPWlNURF9kZWNvbXByZXNzAEoGX3N0YXJ0ACQJBwEAQQELASQKussBaA8AIAAgACgCBCABajYCBAsZACAAKAIAIAAoAgRBH3F0QQAgAWtBH3F2CwgAIABBiH9LC34BBH9BAyEBIAAoAgQiA0EgTQRAIAAoAggiASAAKAIQTwRAIAAQDQ8LIAAoAgwiAiABRgRAQQFBAiADQSBJGw8LIAAgASABIAJrIANBA3YiBCABIARrIAJJIgEbIgJrIgQ2AgggACADIAJBA3RrNgIEIAAgBCgAADYCAAsgAQsUAQF/IAAgARACIQIgACABEAEgAgv3AQECfyACRQRAIABCADcCACAAQQA2AhAgAEIANwIIQbh/DwsgACABNgIMIAAgAUEEajYCECACQQRPBEAgACABIAJqIgFBfGoiAzYCCCAAIAMoAAA2AgAgAUF/ai0AACIBBEAgAEEIIAEQFGs2AgQgAg8LIABBADYCBEF/DwsgACABNgIIIAAgAS0AACIDNgIAIAJBfmoiBEEBTQRAIARBAWtFBEAgACABLQACQRB0IANyIgM2AgALIAAgAS0AAUEIdCADajYCAAsgASACakF/ai0AACIBRQRAIABBADYCBEFsDwsgAEEoIAEQFCACQQN0ams2AgQgAgsWACAAIAEpAAA3AAAgACABKQAINwAICy8BAX8gAUECdEGgHWooAgAgACgCAEEgIAEgACgCBGprQR9xdnEhAiAAIAEQASACCyEAIAFCz9bTvtLHq9lCfiAAfEIfiUKHla+vmLbem55/fgsdAQF/IAAoAgggACgCDEYEfyAAKAIEQSBGBUEACwuCBAEDfyACQYDAAE8EQCAAIAEgAhBnIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAsMACAAIAEpAAA3AAALQQECfyAAKAIIIgEgACgCEEkEQEEDDwsgACAAKAIEIgJBB3E2AgQgACABIAJBA3ZrIgE2AgggACABKAAANgIAQQALDAAgACABKAIANgAAC/cCAQJ/AkAgACABRg0AAkAgASACaiAASwRAIAAgAmoiBCABSw0BCyAAIAEgAhALDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAwRAIAAhAwwDCyAAQQNxRQRAIAAhAwwCCyAAIQMDQCACRQ0EIAMgAS0AADoAACABQQFqIQEgAkF/aiECIANBAWoiA0EDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQhBSAGQQR2IQRBICAAdCIAQQFyIQkgASgCACEPQQAhAiADIQYCQANAIAlBAkggAiAPS3JFBEAgAiEHAkAgCARAA0AgBEH//wNxQf//A0YEQCAHQRhqIQcgBiAQSQR/IAZBAmoiBigAACAFdgUgBUEQaiEFIARBEHYLIQQMAQsLA0AgBEEDcSIIQQNGBEAgBUECaiEFIARBAnYhBCAHQQNqIQcMAQsLIAcgCGoiByAPSw0EIAVBAmohBQNAIAIgB0kEQCANIAJBAXRqQQA7AQAgAkEBaiECDAELCyAGIA5LQQAgBiAFQQN1aiIHIAxLG0UEQCAHKAAAIAVBB3EiBXYhBAwCCyAEQQJ2IQQLIAYhBwsCfyALQX9qIAQgAEF/anEiBiAAQQF0QX9qIgggCWsiEUkNABogBCAIcSIEQQAgESAEIABIG2shBiALCyEIIA0gAkEBdGogBkF/aiIEOwEAIAlBASAGayAEIAZBAUgbayEJA0AgCSAASARAIABBAXUhACALQX9qIQsMAQsLAn8gByAOS0EAIAcgBSAIaiIFQQN1aiIGIAxLG0UEQCAFQQdxDAELIAUgDCIGIAdrQQN0awshBSACQQFqIQIgBEUhCCAGKAAAIAVBH3F2IQQMAQsLQWwgCUEBRyAFQSBKcg0BGiABIAJBf2o2AgAgBiAFQQdqQQN1aiADawwBC0FQCyEAIApBEGokACAACwkAQQFBBSAAGwsMACAAIAEoAAA2AAALqgMBCn8jAEHwAGsiCiQAIAJBAWohDiAAQQhqIQtBgIAEIAVBf2p0QRB1IQxBACECQQEhBkEBIAV0IglBf2oiDyEIA0AgAiAORkUEQAJAIAEgAkEBdCINai8BACIHQf//A0YEQCALIAhBA3RqIAI2AgQgCEF/aiEIQQEhBwwBCyAGQQAgDCAHQRB0QRB1ShshBgsgCiANaiAHOwEAIAJBAWohAgwBCwsgACAFNgIEIAAgBjYCACAJQQN2IAlBAXZqQQNqIQxBACEAQQAhBkEAIQIDQCAGIA5GBEADQAJAIAAgCUYNACAKIAsgAEEDdGoiASgCBCIGQQF0aiICIAIvAQAiAkEBajsBACABIAUgAhAUayIIOgADIAEgAiAIQf8BcXQgCWs7AQAgASAEIAZBAnQiAmooAgA6AAIgASACIANqKAIANgIEIABBAWohAAwBCwsFIAEgBkEBdGouAQAhDUEAIQcDQCAHIA1ORQRAIAsgAkEDdGogBjYCBANAIAIgDGogD3EiAiAISw0ACyAHQQFqIQcMAQsLIAZBAWohBgwBCwsgCkHwAGokAAsjAEIAIAEQCSAAhUKHla+vmLbem55/fkLj3MqV/M7y9YV/fAsQACAAQn43AwggACABNgIACyQBAX8gAARAIAEoAgQiAgRAIAEoAgggACACEQEADwsgABAmCwsfACAAIAEgAi8BABAINgIAIAEQBBogACACQQRqNgIEC0oBAX9BoCAoAgAiASAAaiIAQX9MBEBBiCBBMDYCAEF/DwsCQCAAPwBBEHRNDQAgABBmDQBBiCBBMDYCAEF/DwtBoCAgADYCACABC9cBAQh/Qbp/IQoCQCACKAIEIgggAigCACIJaiIOIAEgAGtLDQBBbCEKIAkgBCADKAIAIgtrSw0AIAAgCWoiBCACKAIIIgxrIQ0gACABQWBqIg8gCyAJQQAQKSADIAkgC2o2AgACQAJAIAwgBCAFa00EQCANIQUMAQsgDCAEIAZrSw0CIAcgDSAFayIAaiIBIAhqIAdNBEAgBCABIAgQDxoMAgsgBCABQQAgAGsQDyEBIAIgACAIaiIINgIEIAEgAGshBAsgBCAPIAUgCEEBECkLIA4hCgsgCgubAgEBfyMAQYABayINJAAgDSADNgJ8AkAgAkEDSwRAQX8hCQwBCwJAAkACQAJAIAJBAWsOAwADAgELIAZFBEBBuH8hCQwEC0FsIQkgBS0AACICIANLDQMgACAHIAJBAnQiAmooAgAgAiAIaigCABA7IAEgADYCAEEBIQkMAwsgASAJNgIAQQAhCQwCCyAKRQRAQWwhCQwCC0EAIQkgC0UgDEEZSHINAUEIIAR0QQhqIQBBACECA0AgAiAATw0CIAJBQGshAgwAAAsAC0FsIQkgDSANQfwAaiANQfgAaiAFIAYQFSICEAMNACANKAJ4IgMgBEsNACAAIA0gDSgCfCAHIAggAxAYIAEgADYCACACIQkLIA1BgAFqJAAgCQsLACAAIAEgAhALGgsQACAALwAAIAAtAAJBEHRyCy8AAn9BuH8gAUEISQ0AGkFyIAAoAAQiAEF3Sw0AGkG4fyAAQQhqIgAgACABSxsLCwkAIAAgATsAAAsDAAELigYBBX8gACAAKAIAIgVBfnE2AgBBACAAIAVBAXZqQYQgKAIAIgQgAEYbIQECQAJAIAAoAgQiAkUNACACKAIAIgNBAXENACACQQhqIgUgA0EBdkF4aiIDQQggA0EISxtnQR9zQQJ0QYAfaiIDKAIARgRAIAMgAigCDDYCAAsgAigCCCIDBEAgAyACKAIMNgIECyACKAIMIgMEQCADIAIoAgg2AgALIAIgAigCACAAKAIAQX5xajYCAEGEICEAAkACQCABRQ0AIAEgAjYCBCABKAIAIgNBAXENASADQQF2QXhqIgNBCCADQQhLG2dBH3NBAnRBgB9qIgMoAgAgAUEIakYEQCADIAEoAgw2AgALIAEoAggiAwRAIAMgASgCDDYCBAsgASgCDCIDBEAgAyABKAIINgIAQYQgKAIAIQQLIAIgAigCACABKAIAQX5xajYCACABIARGDQAgASABKAIAQQF2akEEaiEACyAAIAI2AgALIAIoAgBBAXZBeGoiAEEIIABBCEsbZ0Efc0ECdEGAH2oiASgCACEAIAEgBTYCACACIAA2AgwgAkEANgIIIABFDQEgACAFNgIADwsCQCABRQ0AIAEoAgAiAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAigCACABQQhqRgRAIAIgASgCDDYCAAsgASgCCCICBEAgAiABKAIMNgIECyABKAIMIgIEQCACIAEoAgg2AgBBhCAoAgAhBAsgACAAKAIAIAEoAgBBfnFqIgI2AgACQCABIARHBEAgASABKAIAQQF2aiAANgIEIAAoAgAhAgwBC0GEICAANgIACyACQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgIoAgAhASACIABBCGoiAjYCACAAIAE2AgwgAEEANgIIIAFFDQEgASACNgIADwsgBUEBdkF4aiIBQQggAUEISxtnQR9zQQJ0QYAfaiICKAIAIQEgAiAAQQhqIgI2AgAgACABNgIMIABBADYCCCABRQ0AIAEgAjYCAAsLDgAgAARAIABBeGoQJQsLgAIBA38CQCAAQQ9qQXhxQYQgKAIAKAIAQQF2ayICEB1Bf0YNAAJAQYQgKAIAIgAoAgAiAUEBcQ0AIAFBAXZBeGoiAUEIIAFBCEsbZ0Efc0ECdEGAH2oiASgCACAAQQhqRgRAIAEgACgCDDYCAAsgACgCCCIBBEAgASAAKAIMNgIECyAAKAIMIgFFDQAgASAAKAIINgIAC0EBIQEgACAAKAIAIAJBAXRqIgI2AgAgAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAygCACECIAMgAEEIaiIDNgIAIAAgAjYCDCAAQQA2AgggAkUNACACIAM2AgALIAELtwIBA38CQAJAIABBASAAGyICEDgiAA0AAkACQEGEICgCACIARQ0AIAAoAgAiA0EBcQ0AIAAgA0EBcjYCACADQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgAgAEEIakYEQCABIAAoAgw2AgALIAAoAggiAQRAIAEgACgCDDYCBAsgACgCDCIBBEAgASAAKAIINgIACyACECchAkEAIQFBhCAoAgAhACACDQEgACAAKAIAQX5xNgIAQQAPCyACQQ9qQXhxIgMQHSICQX9GDQIgAkEHakF4cSIAIAJHBEAgACACaxAdQX9GDQMLAkBBhCAoAgAiAUUEQEGAICAANgIADAELIAAgATYCBAtBhCAgADYCACAAIANBAXRBAXI2AgAMAQsgAEUNAQsgAEEIaiEBCyABC7kDAQJ/IAAgA2ohBQJAIANBB0wEQANAIAAgBU8NAiAAIAItAAA6AAAgAEEBaiEAIAJBAWohAgwAAAsACyAEQQFGBEACQCAAIAJrIgZBB00EQCAAIAItAAA6AAAgACACLQABOgABIAAgAi0AAjoAAiAAIAItAAM6AAMgAEEEaiACIAZBAnQiBkHAHmooAgBqIgIQFyACIAZB4B5qKAIAayECDAELIAAgAhAMCyACQQhqIQIgAEEIaiEACwJAAkACQAJAIAUgAU0EQCAAIANqIQEgBEEBRyAAIAJrQQ9Kcg0BA0AgACACEAwgAkEIaiECIABBCGoiACABSQ0ACwwFCyAAIAFLBEAgACEBDAQLIARBAUcgACACa0EPSnINASAAIQMgAiEEA0AgAyAEEAwgBEEIaiEEIANBCGoiAyABSQ0ACwwCCwNAIAAgAhAHIAJBEGohAiAAQRBqIgAgAUkNAAsMAwsgACEDIAIhBANAIAMgBBAHIARBEGohBCADQRBqIgMgAUkNAAsLIAIgASAAa2ohAgsDQCABIAVPDQEgASACLQAAOgAAIAFBAWohASACQQFqIQIMAAALAAsLQQECfyAAIAAoArjgASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigCACACaiAAQQZ2IgFBAnRBsB5qKAIAaiAAQSBxIgBFaiABRSAAQQV2cWoFQbh/CwsdACAAKAKQ4gEQWiAAQQA2AqDiASAAQgA3A5DiAQu1AwEFfyMAQZACayIKJABBuH8hBgJAIAVFDQAgBCwAACIIQf8BcSEHAkAgCEF/TARAIAdBgn9qQQF2IgggBU8NAkFsIQYgB0GBf2oiBUGAAk8NAiAEQQFqIQdBACEGA0AgBiAFTwRAIAUhBiAIIQcMAwUgACAGaiAHIAZBAXZqIgQtAABBBHY6AAAgACAGQQFyaiAELQAAQQ9xOgAAIAZBAmohBgwBCwAACwALIAcgBU8NASAAIARBAWogByAKEFMiBhADDQELIAYhBEEAIQYgAUEAQTQQECEJQQAhBQNAIAQgBkcEQCAAIAZqIggtAAAiAUELSwRAQWwhBgwDBSAJIAFBAnRqIgEgASgCAEEBajYCACAGQQFqIQZBASAILQAAdEEBdSAFaiEFDAILAAsLQWwhBiAFRQ0AIAUQFEEBaiIBQQxLDQAgAyABNgIAQQFBASABdCAFayIDEBQiAXQgA0cNACAAIARqIAFBAWoiADoAACAJIABBAnRqIgAgACgCAEEBajYCACAJKAIEIgBBAkkgAEEBcXINACACIARBAWo2AgAgB0EBaiEGCyAKQZACaiQAIAYLxhEBDH8jAEHwAGsiBSQAQWwhCwJAIANBCkkNACACLwAAIQogAi8AAiEJIAIvAAQhByAFQQhqIAQQDgJAIAMgByAJIApqakEGaiIMSQ0AIAUtAAohCCAFQdgAaiACQQZqIgIgChAGIgsQAw0BIAVBQGsgAiAKaiICIAkQBiILEAMNASAFQShqIAIgCWoiAiAHEAYiCxADDQEgBUEQaiACIAdqIAMgDGsQBiILEAMNASAAIAFqIg9BfWohECAEQQRqIQZBASELIAAgAUEDakECdiIDaiIMIANqIgIgA2oiDiEDIAIhBCAMIQcDQCALIAMgEElxBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgCS0AAyELIAcgBiAFQUBrIAgQAkECdGoiCS8BADsAACAFQUBrIAktAAIQASAJLQADIQogBCAGIAVBKGogCBACQQJ0aiIJLwEAOwAAIAVBKGogCS0AAhABIAktAAMhCSADIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgDS0AAyENIAAgC2oiCyAGIAVB2ABqIAgQAkECdGoiAC8BADsAACAFQdgAaiAALQACEAEgAC0AAyEAIAcgCmoiCiAGIAVBQGsgCBACQQJ0aiIHLwEAOwAAIAVBQGsgBy0AAhABIActAAMhByAEIAlqIgkgBiAFQShqIAgQAkECdGoiBC8BADsAACAFQShqIAQtAAIQASAELQADIQQgAyANaiIDIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgACALaiEAIAcgCmohByAEIAlqIQQgAyANLQADaiEDIAVB2ABqEA0gBUFAaxANciAFQShqEA1yIAVBEGoQDXJFIQsMAQsLIAQgDksgByACS3INAEFsIQsgACAMSw0BIAxBfWohCQNAQQAgACAJSSAFQdgAahAEGwRAIAAgBiAFQdgAaiAIEAJBAnRqIgovAQA7AAAgBUHYAGogCi0AAhABIAAgCi0AA2oiACAGIAVB2ABqIAgQAkECdGoiCi8BADsAACAFQdgAaiAKLQACEAEgACAKLQADaiEADAEFIAxBfmohCgNAIAVB2ABqEAQgACAKS3JFBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgACAJLQADaiEADAELCwNAIAAgCk0EQCAAIAYgBUHYAGogCBACQQJ0aiIJLwEAOwAAIAVB2ABqIAktAAIQASAAIAktAANqIQAMAQsLAkAgACAMTw0AIAAgBiAFQdgAaiAIEAIiAEECdGoiDC0AADoAACAMLQADQQFGBEAgBUHYAGogDC0AAhABDAELIAUoAlxBH0sNACAFQdgAaiAGIABBAnRqLQACEAEgBSgCXEEhSQ0AIAVBIDYCXAsgAkF9aiEMA0BBACAHIAxJIAVBQGsQBBsEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiIAIAYgBUFAayAIEAJBAnRqIgcvAQA7AAAgBUFAayAHLQACEAEgACAHLQADaiEHDAEFIAJBfmohDANAIAVBQGsQBCAHIAxLckUEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwNAIAcgDE0EQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwJAIAcgAk8NACAHIAYgBUFAayAIEAIiAEECdGoiAi0AADoAACACLQADQQFGBEAgBUFAayACLQACEAEMAQsgBSgCREEfSw0AIAVBQGsgBiAAQQJ0ai0AAhABIAUoAkRBIUkNACAFQSA2AkQLIA5BfWohAgNAQQAgBCACSSAFQShqEAQbBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2oiACAGIAVBKGogCBACQQJ0aiIELwEAOwAAIAVBKGogBC0AAhABIAAgBC0AA2ohBAwBBSAOQX5qIQIDQCAFQShqEAQgBCACS3JFBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsDQCAEIAJNBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsCQCAEIA5PDQAgBCAGIAVBKGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBKGogAi0AAhABDAELIAUoAixBH0sNACAFQShqIAYgAEECdGotAAIQASAFKAIsQSFJDQAgBUEgNgIsCwNAQQAgAyAQSSAFQRBqEAQbBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2oiACAGIAVBEGogCBACQQJ0aiICLwEAOwAAIAVBEGogAi0AAhABIAAgAi0AA2ohAwwBBSAPQX5qIQIDQCAFQRBqEAQgAyACS3JFBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsDQCADIAJNBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsCQCADIA9PDQAgAyAGIAVBEGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBEGogAi0AAhABDAELIAUoAhRBH0sNACAFQRBqIAYgAEECdGotAAIQASAFKAIUQSFJDQAgBUEgNgIUCyABQWwgBUHYAGoQCiAFQUBrEApxIAVBKGoQCnEgBUEQahAKcRshCwwJCwAACwALAAALAAsAAAsACwAACwALQWwhCwsgBUHwAGokACALC7UEAQ5/IwBBEGsiBiQAIAZBBGogABAOQVQhBQJAIARB3AtJDQAgBi0ABCEHIANB8ARqQQBB7AAQECEIIAdBDEsNACADQdwJaiIJIAggBkEIaiAGQQxqIAEgAhAxIhAQA0UEQCAGKAIMIgQgB0sNASADQdwFaiEPIANBpAVqIREgAEEEaiESIANBqAVqIQEgBCEFA0AgBSICQX9qIQUgCCACQQJ0aigCAEUNAAsgAkEBaiEOQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgASALaiAKNgIAIAVBAWohBSAKIAxqIQoMAQsLIAEgCjYCAEEAIQUgBigCCCELA0AgBSALRkUEQCABIAUgCWotAAAiDEECdGoiDSANKAIAIg1BAWo2AgAgDyANQQF0aiINIAw6AAEgDSAFOgAAIAVBAWohBQwBCwtBACEBIANBADYCqAUgBEF/cyAHaiEJQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgAyALaiABNgIAIAwgBSAJanQgAWohASAFQQFqIQUMAQsLIAcgBEEBaiIBIAJrIgRrQQFqIQgDQEEBIQUgBCAIT0UEQANAIAUgDk9FBEAgBUECdCIJIAMgBEE0bGpqIAMgCWooAgAgBHY2AgAgBUEBaiEFDAELCyAEQQFqIQQMAQsLIBIgByAPIAogESADIAIgARBkIAZBAToABSAGIAc6AAYgACAGKAIENgIACyAQIQULIAZBEGokACAFC8ENAQt/IwBB8ABrIgUkAEFsIQkCQCADQQpJDQAgAi8AACEKIAIvAAIhDCACLwAEIQYgBUEIaiAEEA4CQCADIAYgCiAMampBBmoiDUkNACAFLQAKIQcgBUHYAGogAkEGaiICIAoQBiIJEAMNASAFQUBrIAIgCmoiAiAMEAYiCRADDQEgBUEoaiACIAxqIgIgBhAGIgkQAw0BIAVBEGogAiAGaiADIA1rEAYiCRADDQEgACABaiIOQX1qIQ8gBEEEaiEGQQEhCSAAIAFBA2pBAnYiAmoiCiACaiIMIAJqIg0hAyAMIQQgCiECA0AgCSADIA9JcQRAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAACAGIAVBQGsgBxACQQF0aiIILQAAIQsgBUFAayAILQABEAEgAiALOgAAIAYgBUEoaiAHEAJBAXRqIggtAAAhCyAFQShqIAgtAAEQASAEIAs6AAAgBiAFQRBqIAcQAkEBdGoiCC0AACELIAVBEGogCC0AARABIAMgCzoAACAGIAVB2ABqIAcQAkEBdGoiCC0AACELIAVB2ABqIAgtAAEQASAAIAs6AAEgBiAFQUBrIAcQAkEBdGoiCC0AACELIAVBQGsgCC0AARABIAIgCzoAASAGIAVBKGogBxACQQF0aiIILQAAIQsgBUEoaiAILQABEAEgBCALOgABIAYgBUEQaiAHEAJBAXRqIggtAAAhCyAFQRBqIAgtAAEQASADIAs6AAEgA0ECaiEDIARBAmohBCACQQJqIQIgAEECaiEAIAkgBUHYAGoQDUVxIAVBQGsQDUVxIAVBKGoQDUVxIAVBEGoQDUVxIQkMAQsLIAQgDUsgAiAMS3INAEFsIQkgACAKSw0BIApBfWohCQNAIAVB2ABqEAQgACAJT3JFBEAgBiAFQdgAaiAHEAJBAXRqIggtAAAhCyAFQdgAaiAILQABEAEgACALOgAAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAASAAQQJqIQAMAQsLA0AgBUHYAGoQBCAAIApPckUEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCwNAIAAgCkkEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCyAMQX1qIQADQCAFQUBrEAQgAiAAT3JFBEAgBiAFQUBrIAcQAkEBdGoiCi0AACEJIAVBQGsgCi0AARABIAIgCToAACAGIAVBQGsgBxACQQF0aiIKLQAAIQkgBUFAayAKLQABEAEgAiAJOgABIAJBAmohAgwBCwsDQCAFQUBrEAQgAiAMT3JFBEAgBiAFQUBrIAcQAkEBdGoiAC0AACEKIAVBQGsgAC0AARABIAIgCjoAACACQQFqIQIMAQsLA0AgAiAMSQRAIAYgBUFAayAHEAJBAXRqIgAtAAAhCiAFQUBrIAAtAAEQASACIAo6AAAgAkEBaiECDAELCyANQX1qIQADQCAFQShqEAQgBCAAT3JFBEAgBiAFQShqIAcQAkEBdGoiAi0AACEKIAVBKGogAi0AARABIAQgCjoAACAGIAVBKGogBxACQQF0aiICLQAAIQogBUEoaiACLQABEAEgBCAKOgABIARBAmohBAwBCwsDQCAFQShqEAQgBCANT3JFBEAgBiAFQShqIAcQAkEBdGoiAC0AACECIAVBKGogAC0AARABIAQgAjoAACAEQQFqIQQMAQsLA0AgBCANSQRAIAYgBUEoaiAHEAJBAXRqIgAtAAAhAiAFQShqIAAtAAEQASAEIAI6AAAgBEEBaiEEDAELCwNAIAVBEGoQBCADIA9PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIAYgBUEQaiAHEAJBAXRqIgAtAAAhAiAFQRBqIAAtAAEQASADIAI6AAEgA0ECaiEDDAELCwNAIAVBEGoQBCADIA5PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIANBAWohAwwBCwsDQCADIA5JBEAgBiAFQRBqIAcQAkEBdGoiAC0AACECIAVBEGogAC0AARABIAMgAjoAACADQQFqIQMMAQsLIAFBbCAFQdgAahAKIAVBQGsQCnEgBUEoahAKcSAFQRBqEApxGyEJDAELQWwhCQsgBUHwAGokACAJC8oCAQR/IwBBIGsiBSQAIAUgBBAOIAUtAAIhByAFQQhqIAIgAxAGIgIQA0UEQCAEQQRqIQIgACABaiIDQX1qIQQDQCAFQQhqEAQgACAET3JFBEAgAiAFQQhqIAcQAkEBdGoiBi0AACEIIAVBCGogBi0AARABIAAgCDoAACACIAVBCGogBxACQQF0aiIGLQAAIQggBUEIaiAGLQABEAEgACAIOgABIABBAmohAAwBCwsDQCAFQQhqEAQgACADT3JFBEAgAiAFQQhqIAcQAkEBdGoiBC0AACEGIAVBCGogBC0AARABIAAgBjoAACAAQQFqIQAMAQsLA0AgACADT0UEQCACIAVBCGogBxACQQF0aiIELQAAIQYgBUEIaiAELQABEAEgACAGOgAAIABBAWohAAwBCwsgAUFsIAVBCGoQChshAgsgBUEgaiQAIAILtgMBCX8jAEEQayIGJAAgBkEANgIMIAZBADYCCEFUIQQCQAJAIANBQGsiDCADIAZBCGogBkEMaiABIAIQMSICEAMNACAGQQRqIAAQDiAGKAIMIgcgBi0ABEEBaksNASAAQQRqIQogBkEAOgAFIAYgBzoABiAAIAYoAgQ2AgAgB0EBaiEJQQEhBANAIAQgCUkEQCADIARBAnRqIgEoAgAhACABIAU2AgAgACAEQX9qdCAFaiEFIARBAWohBAwBCwsgB0EBaiEHQQAhBSAGKAIIIQkDQCAFIAlGDQEgAyAFIAxqLQAAIgRBAnRqIgBBASAEdEEBdSILIAAoAgAiAWoiADYCACAHIARrIQhBACEEAkAgC0EDTQRAA0AgBCALRg0CIAogASAEakEBdGoiACAIOgABIAAgBToAACAEQQFqIQQMAAALAAsDQCABIABPDQEgCiABQQF0aiIEIAg6AAEgBCAFOgAAIAQgCDoAAyAEIAU6AAIgBCAIOgAFIAQgBToABCAEIAg6AAcgBCAFOgAGIAFBBGohAQwAAAsACyAFQQFqIQUMAAALAAsgAiEECyAGQRBqJAAgBAutAQECfwJAQYQgKAIAIABHIAAoAgBBAXYiAyABa0F4aiICQXhxQQhHcgR/IAIFIAMQJ0UNASACQQhqC0EQSQ0AIAAgACgCACICQQFxIAAgAWpBD2pBeHEiASAAa0EBdHI2AgAgASAANgIEIAEgASgCAEEBcSAAIAJBAXZqIAFrIgJBAXRyNgIAQYQgIAEgAkH/////B3FqQQRqQYQgKAIAIABGGyABNgIAIAEQJQsLygIBBX8CQAJAAkAgAEEIIABBCEsbZ0EfcyAAaUEBR2oiAUEESSAAIAF2cg0AIAFBAnRB/B5qKAIAIgJFDQADQCACQXhqIgMoAgBBAXZBeGoiBSAATwRAIAIgBUEIIAVBCEsbZ0Efc0ECdEGAH2oiASgCAEYEQCABIAIoAgQ2AgALDAMLIARBHksNASAEQQFqIQQgAigCBCICDQALC0EAIQMgAUEgTw0BA0AgAUECdEGAH2ooAgAiAkUEQCABQR5LIQIgAUEBaiEBIAJFDQEMAwsLIAIgAkF4aiIDKAIAQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgBGBEAgASACKAIENgIACwsgAigCACIBBEAgASACKAIENgIECyACKAIEIgEEQCABIAIoAgA2AgALIAMgAygCAEEBcjYCACADIAAQNwsgAwvhCwINfwV+IwBB8ABrIgckACAHIAAoAvDhASIINgJcIAEgAmohDSAIIAAoAoDiAWohDwJAAkAgBUUEQCABIQQMAQsgACgCxOABIRAgACgCwOABIREgACgCvOABIQ4gAEEBNgKM4QFBACEIA0AgCEEDRwRAIAcgCEECdCICaiAAIAJqQazQAWooAgA2AkQgCEEBaiEIDAELC0FsIQwgB0EYaiADIAQQBhADDQEgB0EsaiAHQRhqIAAoAgAQEyAHQTRqIAdBGGogACgCCBATIAdBPGogB0EYaiAAKAIEEBMgDUFgaiESIAEhBEEAIQwDQCAHKAIwIAcoAixBA3RqKQIAIhRCEIinQf8BcSEIIAcoAkAgBygCPEEDdGopAgAiFUIQiKdB/wFxIQsgBygCOCAHKAI0QQN0aikCACIWQiCIpyEJIBVCIIghFyAUQiCIpyECAkAgFkIQiKdB/wFxIgNBAk8EQAJAIAZFIANBGUlyRQRAIAkgB0EYaiADQSAgBygCHGsiCiAKIANLGyIKEAUgAyAKayIDdGohCSAHQRhqEAQaIANFDQEgB0EYaiADEAUgCWohCQwBCyAHQRhqIAMQBSAJaiEJIAdBGGoQBBoLIAcpAkQhGCAHIAk2AkQgByAYNwNIDAELAkAgA0UEQCACBEAgBygCRCEJDAMLIAcoAkghCQwBCwJAAkAgB0EYakEBEAUgCSACRWpqIgNBA0YEQCAHKAJEQX9qIgMgA0VqIQkMAQsgA0ECdCAHaigCRCIJIAlFaiEJIANBAUYNAQsgByAHKAJINgJMCwsgByAHKAJENgJIIAcgCTYCRAsgF6chAyALBEAgB0EYaiALEAUgA2ohAwsgCCALakEUTwRAIAdBGGoQBBoLIAgEQCAHQRhqIAgQBSACaiECCyAHQRhqEAQaIAcgB0EYaiAUQhiIp0H/AXEQCCAUp0H//wNxajYCLCAHIAdBGGogFUIYiKdB/wFxEAggFadB//8DcWo2AjwgB0EYahAEGiAHIAdBGGogFkIYiKdB/wFxEAggFqdB//8DcWo2AjQgByACNgJgIAcoAlwhCiAHIAk2AmggByADNgJkAkACQAJAIAQgAiADaiILaiASSw0AIAIgCmoiEyAPSw0AIA0gBGsgC0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdBKGogACgCBBATQQAhBCAHQeAAaiEMIAdB5ABqIQoDQCAHQShqEARBAksgBCAXTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEJIAcoAkggBygCREEDdGopAgAiH0IgiKchCCAeQiCIISAgHUIgiKchAgJAIB9CEIinQf8BcSIDQQJPBEACQCAGRSADQRlJckUEQCAIIAdBKGogA0EgIAcoAixrIg0gDSADSxsiDRAFIAMgDWsiA3RqIQggB0EoahAEGiADRQ0BIAdBKGogAxAFIAhqIQgMAQsgB0EoaiADEAUgCGohCCAHQShqEAQaCyAHKQJUISEgByAINgJUIAcgITcDWAwBCwJAIANFBEAgAgRAIAcoAlQhCAwDCyAHKAJYIQgMAQsCQAJAIAdBKGpBARAFIAggAkVqaiIDQQNGBEAgBygCVEF/aiIDIANFaiEIDAELIANBAnQgB2ooAlQiCCAIRWohCCADQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAg2AlQLICCnIQMgCQRAIAdBKGogCRAFIANqIQMLIAkgC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgAmohAgsgB0EoahAEGiAHIAcoAmggAmoiCSADajYCaCAKIAwgCCAJSxsoAgAhDSAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogB0EoaiAfQhiIp0H/AXEQCCEOIAdB8ABqIARBBHRqIgsgCSANaiAIazYCDCALIAg2AgggCyADNgIEIAsgAjYCACAHIA4gH6dB//8DcWo2AkQgBEEBaiEEDAELCyAEIBdIDQEgEkFgaiEYIAdB4ABqIRogB0HkAGohGyABIQMDQCAHQShqEARBAksgBCAFTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEIIAcoAkggBygCREEDdGopAgAiH0IgiKchCSAeQiCIISAgHUIgiKchDAJAIB9CEIinQf8BcSICQQJPBEACQCAGRSACQRlJckUEQCAJIAdBKGogAkEgIAcoAixrIgogCiACSxsiChAFIAIgCmsiAnRqIQkgB0EoahAEGiACRQ0BIAdBKGogAhAFIAlqIQkMAQsgB0EoaiACEAUgCWohCSAHQShqEAQaCyAHKQJUISEgByAJNgJUIAcgITcDWAwBCwJAIAJFBEAgDARAIAcoAlQhCQwDCyAHKAJYIQkMAQsCQAJAIAdBKGpBARAFIAkgDEVqaiICQQNGBEAgBygCVEF/aiICIAJFaiEJDAELIAJBAnQgB2ooAlQiCSAJRWohCSACQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAk2AlQLICCnIRQgCARAIAdBKGogCBAFIBRqIRQLIAggC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgDGohDAsgB0EoahAEGiAHIAcoAmggDGoiGSAUajYCaCAbIBogCSAZSxsoAgAhHCAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogByAHQShqIB9CGIinQf8BcRAIIB+nQf//A3FqNgJEIAcgB0HwAGogBEEDcUEEdGoiDSkDCCIdNwPIASAHIA0pAwAiHjcDwAECQAJAAkAgBygCvAEiDiAepyICaiIWIBNLDQAgAyAHKALEASIKIAJqIgtqIBhLDQAgEiADayALQSBqTw0BCyAHIAcpA8gBNwMQIAcgBykDwAE3AwggAyASIAdBCGogB0G8AWogEyAPIBUgERAeIQsMAQsgAiADaiEIIAMgDhAHIAJBEU8EQCADQRBqIQIDQCACIA5BEGoiDhAHIAJBEGoiAiAISQ0ACwsgCCAdpyIOayECIAcgFjYCvAEgDiAIIA9rSwRAIA4gCCAVa0sEQEFsIQsMAgsgESACIA9rIgJqIhYgCmogEU0EQCAIIBYgChAPGgwCCyAIIBZBACACaxAPIQggByACIApqIgo2AsQBIAggAmshCCAPIQILIA5BEE8EQCAIIApqIQoDQCAIIAIQByACQRBqIQIgCEEQaiIIIApJDQALDAELAkAgDkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgDkECdCIKQcAeaigCAGoiAhAXIAIgCkHgHmooAgBrIQIgBygCxAEhCgwBCyAIIAIQDAsgCkEJSQ0AIAggCmohCiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAKSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAKSQ0ACwsgCxADBEAgCyEQDAQFIA0gDDYCACANIBkgHGogCWs2AgwgDSAJNgIIIA0gFDYCBCAEQQFqIQQgAyALaiEDDAILAAsLIAQgBUgNASAEIBdrIQtBACEEA0AgCyAFSARAIAcgB0HwAGogC0EDcUEEdGoiAikDCCIdNwPIASAHIAIpAwAiHjcDwAECQAJAAkAgBygCvAEiDCAepyICaiIKIBNLDQAgAyAHKALEASIJIAJqIhBqIBhLDQAgEiADayAQQSBqTw0BCyAHIAcpA8gBNwMgIAcgBykDwAE3AxggAyASIAdBGGogB0G8AWogEyAPIBUgERAeIRAMAQsgAiADaiEIIAMgDBAHIAJBEU8EQCADQRBqIQIDQCACIAxBEGoiDBAHIAJBEGoiAiAISQ0ACwsgCCAdpyIGayECIAcgCjYCvAEgBiAIIA9rSwRAIAYgCCAVa0sEQEFsIRAMAgsgESACIA9rIgJqIgwgCWogEU0EQCAIIAwgCRAPGgwCCyAIIAxBACACaxAPIQggByACIAlqIgk2AsQBIAggAmshCCAPIQILIAZBEE8EQCAIIAlqIQYDQCAIIAIQByACQRBqIQIgCEEQaiIIIAZJDQALDAELAkAgBkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgBkECdCIGQcAeaigCAGoiAhAXIAIgBkHgHmooAgBrIQIgBygCxAEhCQwBCyAIIAIQDAsgCUEJSQ0AIAggCWohBiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAGSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAGSQ0ACwsgEBADDQMgC0EBaiELIAMgEGohAwwBCwsDQCAEQQNHBEAgACAEQQJ0IgJqQazQAWogAiAHaigCVDYCACAEQQFqIQQMAQsLIAcoArwBIQgLQbp/IRAgEyAIayIAIBIgA2tLDQAgAwR/IAMgCCAAEAsgAGoFQQALIAFrIRALIAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY0AAQMyIFEAMiBg0AIANBHzYCfCADIANB/ABqIANB+ABqIAQgBCAFaiAGGyIEIAEgAmoiAiAEaxAVIgUQAw0AIAMoAnwiBkEfSw0AIAMoAngiB0EJTw0AIABBiCBqIAMgBkGAC0GADCAHEBggA0E0NgJ8IAMgA0H8AGogA0H4AGogBCAFaiIEIAIgBGsQFSIFEAMNACADKAJ8IgZBNEsNACADKAJ4IgdBCk8NACAAQZAwaiADIAZBgA1B4A4gBxAYIANBIzYCfCADIANB/ABqIANB+ABqIAQgBWoiBCACIARrEBUiBRADDQAgAygCfCIGQSNLDQAgAygCeCIHQQpPDQAgACADIAZBwBBB0BEgBxAYIAQgBWoiBEEMaiIFIAJLDQAgAiAFayEFQQAhAgNAIAJBA0cEQCAEKAAAIgZBf2ogBU8NAiAAIAJBAnRqQZzQAWogBjYCACACQQFqIQIgBEEEaiEEDAELCyAEIAFrIQgLIANBgAFqJAAgCAtGAQN/IABBCGohAyAAKAIEIQJBACEAA0AgACACdkUEQCABIAMgAEEDdGotAAJBFktqIQEgAEEBaiEADAELCyABQQggAmt0C4YDAQV/Qbh/IQcCQCADRQ0AIAItAAAiBEUEQCABQQA2AgBBAUG4fyADQQFGGw8LAn8gAkEBaiIFIARBGHRBGHUiBkF/Sg0AGiAGQX9GBEAgA0EDSA0CIAUvAABBgP4BaiEEIAJBA2oMAQsgA0ECSA0BIAItAAEgBEEIdHJBgIB+aiEEIAJBAmoLIQUgASAENgIAIAVBAWoiASACIANqIgNLDQBBbCEHIABBEGogACAFLQAAIgVBBnZBI0EJIAEgAyABa0HAEEHQEUHwEiAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBmCBqIABBCGogBUEEdkEDcUEfQQggASABIAZqIAgbIgEgAyABa0GAC0GADEGAFyAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBoDBqIABBBGogBUECdkEDcUE0QQkgASABIAZqIAgbIgEgAyABa0GADUHgDkGQGSAAKAKM4QEgACgCnOIBIAQQHyIAEAMNACAAIAFqIAJrIQcLIAcLrQMBCn8jAEGABGsiCCQAAn9BUiACQf8BSw0AGkFUIANBDEsNABogAkEBaiELIABBBGohCUGAgAQgA0F/anRBEHUhCkEAIQJBASEEQQEgA3QiB0F/aiIMIQUDQCACIAtGRQRAAkAgASACQQF0Ig1qLwEAIgZB//8DRgRAIAkgBUECdGogAjoAAiAFQX9qIQVBASEGDAELIARBACAKIAZBEHRBEHVKGyEECyAIIA1qIAY7AQAgAkEBaiECDAELCyAAIAQ7AQIgACADOwEAIAdBA3YgB0EBdmpBA2ohBkEAIQRBACECA0AgBCALRkUEQCABIARBAXRqLgEAIQpBACEAA0AgACAKTkUEQCAJIAJBAnRqIAQ6AAIDQCACIAZqIAxxIgIgBUsNAAsgAEEBaiEADAELCyAEQQFqIQQMAQsLQX8gAg0AGkEAIQIDfyACIAdGBH9BAAUgCCAJIAJBAnRqIgAtAAJBAXRqIgEgAS8BACIBQQFqOwEAIAAgAyABEBRrIgU6AAMgACABIAVB/wFxdCAHazsBACACQQFqIQIMAQsLCyEFIAhBgARqJAAgBQvjBgEIf0FsIQcCQCACQQNJDQACQAJAAkACQCABLQAAIgNBA3EiCUEBaw4DAwEAAgsgACgCiOEBDQBBYg8LIAJBBUkNAkEDIQYgASgAACEFAn8CQAJAIANBAnZBA3EiCEF+aiIEQQFNBEAgBEEBaw0BDAILIAVBDnZB/wdxIQQgBUEEdkH/B3EhAyAIRQwCCyAFQRJ2IQRBBCEGIAVBBHZB//8AcSEDQQAMAQsgBUEEdkH//w9xIgNBgIAISw0DIAEtAARBCnQgBUEWdnIhBEEFIQZBAAshBSAEIAZqIgogAksNAgJAIANBgQZJDQAgACgCnOIBRQ0AQQAhAgNAIAJBg4ABSw0BIAJBQGshAgwAAAsACwJ/IAlBA0YEQCABIAZqIQEgAEHw4gFqIQIgACgCDCEGIAUEQCACIAMgASAEIAYQXwwCCyACIAMgASAEIAYQXQwBCyAAQbjQAWohAiABIAZqIQEgAEHw4gFqIQYgAEGo0ABqIQggBQRAIAggBiADIAEgBCACEF4MAQsgCCAGIAMgASAEIAIQXAsQAw0CIAAgAzYCgOIBIABBATYCiOEBIAAgAEHw4gFqNgLw4QEgCUECRgRAIAAgAEGo0ABqNgIMCyAAIANqIgBBiOMBakIANwAAIABBgOMBakIANwAAIABB+OIBakIANwAAIABB8OIBakIANwAAIAoPCwJ/AkACQAJAIANBAnZBA3FBf2oiBEECSw0AIARBAWsOAgACAQtBASEEIANBA3YMAgtBAiEEIAEvAABBBHYMAQtBAyEEIAEQIUEEdgsiAyAEaiIFQSBqIAJLBEAgBSACSw0CIABB8OIBaiABIARqIAMQCyEBIAAgAzYCgOIBIAAgATYC8OEBIAEgA2oiAEIANwAYIABCADcAECAAQgA3AAggAEIANwAAIAUPCyAAIAM2AoDiASAAIAEgBGo2AvDhASAFDwsCfwJAAkACQCADQQJ2QQNxQX9qIgRBAksNACAEQQFrDgIAAgELQQEhByADQQN2DAILQQIhByABLwAAQQR2DAELIAJBBEkgARAhIgJBj4CAAUtyDQFBAyEHIAJBBHYLIQIgAEHw4gFqIAEgB2otAAAgAkEgahAQIQEgACACNgKA4gEgACABNgLw4QEgB0EBaiEHCyAHC0sAIABC+erQ0OfJoeThADcDICAAQgA3AxggAELP1tO+0ser2UI3AxAgAELW64Lu6v2J9eAANwMIIABCADcDACAAQShqQQBBKBAQGgviAgICfwV+IABBKGoiASAAKAJIaiECAn4gACkDACIDQiBaBEAgACkDECIEQgeJIAApAwgiBUIBiXwgACkDGCIGQgyJfCAAKQMgIgdCEol8IAUQGSAEEBkgBhAZIAcQGQwBCyAAKQMYQsXP2bLx5brqJ3wLIAN8IQMDQCABQQhqIgAgAk0EQEIAIAEpAAAQCSADhUIbiUKHla+vmLbem55/fkLj3MqV/M7y9YV/fCEDIAAhAQwBCwsCQCABQQRqIgAgAksEQCABIQAMAQsgASgAAK1Ch5Wvr5i23puef34gA4VCF4lCz9bTvtLHq9lCfkL5893xmfaZqxZ8IQMLA0AgACACSQRAIAAxAABCxc/ZsvHluuonfiADhUILiUKHla+vmLbem55/fiEDIABBAWohAAwBCwsgA0IhiCADhULP1tO+0ser2UJ+IgNCHYggA4VC+fPd8Zn2masWfiIDQiCIIAOFC+8CAgJ/BH4gACAAKQMAIAKtfDcDAAJAAkAgACgCSCIDIAJqIgRBH00EQCABRQ0BIAAgA2pBKGogASACECAgACgCSCACaiEEDAELIAEgAmohAgJ/IAMEQCAAQShqIgQgA2ogAUEgIANrECAgACAAKQMIIAQpAAAQCTcDCCAAIAApAxAgACkAMBAJNwMQIAAgACkDGCAAKQA4EAk3AxggACAAKQMgIABBQGspAAAQCTcDICAAKAJIIQMgAEEANgJIIAEgA2tBIGohAQsgAUEgaiACTQsEQCACQWBqIQMgACkDICEFIAApAxghBiAAKQMQIQcgACkDCCEIA0AgCCABKQAAEAkhCCAHIAEpAAgQCSEHIAYgASkAEBAJIQYgBSABKQAYEAkhBSABQSBqIgEgA00NAAsgACAFNwMgIAAgBjcDGCAAIAc3AxAgACAINwMICyABIAJPDQEgAEEoaiABIAIgAWsiBBAgCyAAIAQ2AkgLCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQEBogAwVBun8LCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQCxogAwVBun8LC6gCAQZ/IwBBEGsiByQAIABB2OABaikDAEKAgIAQViEIQbh/IQUCQCAEQf//B0sNACAAIAMgBBBCIgUQAyIGDQAgACgCnOIBIQkgACAHQQxqIAMgAyAFaiAGGyIKIARBACAFIAYbayIGEEAiAxADBEAgAyEFDAELIAcoAgwhBCABRQRAQbp/IQUgBEEASg0BCyAGIANrIQUgAyAKaiEDAkAgCQRAIABBADYCnOIBDAELAkACQAJAIARBBUgNACAAQdjgAWopAwBCgICACFgNAAwBCyAAQQA2ApziAQwBCyAAKAIIED8hBiAAQQA2ApziASAGQRRPDQELIAAgASACIAMgBSAEIAgQOSEFDAELIAAgASACIAMgBSAEIAgQOiEFCyAHQRBqJAAgBQtnACAAQdDgAWogASACIAAoAuzhARAuIgEQAwRAIAEPC0G4fyECAkAgAQ0AIABB7OABaigCACIBBEBBYCECIAAoApjiASABRw0BC0EAIQIgAEHw4AFqKAIARQ0AIABBkOEBahBDCyACCycBAX8QVyIERQRAQUAPCyAEIAAgASACIAMgBBBLEE8hACAEEFYgAAs/AQF/AkACQAJAIAAoAqDiAUEBaiIBQQJLDQAgAUEBaw4CAAECCyAAEDBBAA8LIABBADYCoOIBCyAAKAKU4gELvAMCB38BfiMAQRBrIgkkAEG4fyEGAkAgBCgCACIIQQVBCSAAKALs4QEiBRtJDQAgAygCACIHQQFBBSAFGyAFEC8iBRADBEAgBSEGDAELIAggBUEDakkNACAAIAcgBRBJIgYQAw0AIAEgAmohCiAAQZDhAWohCyAIIAVrIQIgBSAHaiEHIAEhBQNAIAcgAiAJECwiBhADDQEgAkF9aiICIAZJBEBBuH8hBgwCCyAJKAIAIghBAksEQEFsIQYMAgsgB0EDaiEHAn8CQAJAAkAgCEEBaw4CAgABCyAAIAUgCiAFayAHIAYQSAwCCyAFIAogBWsgByAGEEcMAQsgBSAKIAVrIActAAAgCSgCCBBGCyIIEAMEQCAIIQYMAgsgACgC8OABBEAgCyAFIAgQRQsgAiAGayECIAYgB2ohByAFIAhqIQUgCSgCBEUNAAsgACkD0OABIgxCf1IEQEFsIQYgDCAFIAFrrFINAQsgACgC8OABBEBBaiEGIAJBBEkNASALEEQhDCAHKAAAIAynRw0BIAdBBGohByACQXxqIQILIAMgBzYCACAEIAI2AgAgBSABayEGCyAJQRBqJAAgBgsuACAAECsCf0EAQQAQAw0AGiABRSACRXJFBEBBYiAAIAEgAhA9EAMNARoLQQALCzcAIAEEQCAAIAAoAsTgASABKAIEIAEoAghqRzYCnOIBCyAAECtBABADIAFFckUEQCAAIAEQWwsL0QIBB38jAEEQayIGJAAgBiAENgIIIAYgAzYCDCAFBEAgBSgCBCEKIAUoAgghCQsgASEIAkACQANAIAAoAuzhARAWIQsCQANAIAQgC0kNASADKAAAQXBxQdDUtMIBRgRAIAMgBBAiIgcQAw0EIAQgB2shBCADIAdqIQMMAQsLIAYgAzYCDCAGIAQ2AggCQCAFBEAgACAFEE5BACEHQQAQA0UNAQwFCyAAIAogCRBNIgcQAw0ECyAAIAgQUCAMQQFHQQAgACAIIAIgBkEMaiAGQQhqEEwiByIDa0EAIAMQAxtBCkdyRQRAQbh/IQcMBAsgBxADDQMgAiAHayECIAcgCGohCEEBIQwgBigCDCEDIAYoAgghBAwBCwsgBiADNgIMIAYgBDYCCEG4fyEHIAQNASAIIAFrIQcMAQsgBiADNgIMIAYgBDYCCAsgBkEQaiQAIAcLRgECfyABIAAoArjgASICRwRAIAAgAjYCxOABIAAgATYCuOABIAAoArzgASEDIAAgATYCvOABIAAgASADIAJrajYCwOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEEdCAAbiECCyAAQQh2IgEgAkEYbCIAQYwIaigCAGwgAEGICGooAgBqIgJBA3YgAmogAEGACGooAgAgAEGECGooAgAgAWxqSQs3ACAAIAMgBCAFQYAQEDMiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQMgVBuH8LC78DAQN/IwBBIGsiBSQAIAVBCGogAiADEAYiAhADRQRAIAAgAWoiB0F9aiEGIAUgBBAOIARBBGohAiAFLQACIQMDQEEAIAAgBkkgBUEIahAEGwRAIAAgAiAFQQhqIAMQAkECdGoiBC8BADsAACAFQQhqIAQtAAIQASAAIAQtAANqIgQgAiAFQQhqIAMQAkECdGoiAC8BADsAACAFQQhqIAAtAAIQASAEIAAtAANqIQAMAQUgB0F+aiEEA0AgBUEIahAEIAAgBEtyRQRAIAAgAiAFQQhqIAMQAkECdGoiBi8BADsAACAFQQhqIAYtAAIQASAAIAYtAANqIQAMAQsLA0AgACAES0UEQCAAIAIgBUEIaiADEAJBAnRqIgYvAQA7AAAgBUEIaiAGLQACEAEgACAGLQADaiEADAELCwJAIAAgB08NACAAIAIgBUEIaiADEAIiA0ECdGoiAC0AADoAACAALQADQQFGBEAgBUEIaiAALQACEAEMAQsgBSgCDEEfSw0AIAVBCGogAiADQQJ0ai0AAhABIAUoAgxBIUkNACAFQSA2AgwLIAFBbCAFQQhqEAobIQILCwsgBUEgaiQAIAILkgIBBH8jAEFAaiIJJAAgCSADQTQQCyEDAkAgBEECSA0AIAMgBEECdGooAgAhCSADQTxqIAgQIyADQQE6AD8gAyACOgA+QQAhBCADKAI8IQoDQCAEIAlGDQEgACAEQQJ0aiAKNgEAIARBAWohBAwAAAsAC0EAIQkDQCAGIAlGRQRAIAMgBSAJQQF0aiIKLQABIgtBAnRqIgwoAgAhBCADQTxqIAotAABBCHQgCGpB//8DcRAjIANBAjoAPyADIAcgC2siCiACajoAPiAEQQEgASAKa3RqIQogAygCPCELA0AgACAEQQJ0aiALNgEAIARBAWoiBCAKSQ0ACyAMIAo2AgAgCUEBaiEJDAELCyADQUBrJAALowIBCX8jAEHQAGsiCSQAIAlBEGogBUE0EAsaIAcgBmshDyAHIAFrIRADQAJAIAMgCkcEQEEBIAEgByACIApBAXRqIgYtAAEiDGsiCGsiC3QhDSAGLQAAIQ4gCUEQaiAMQQJ0aiIMKAIAIQYgCyAPTwRAIAAgBkECdGogCyAIIAUgCEE0bGogCCAQaiIIQQEgCEEBShsiCCACIAQgCEECdGooAgAiCEEBdGogAyAIayAHIA4QYyAGIA1qIQgMAgsgCUEMaiAOECMgCUEBOgAPIAkgCDoADiAGIA1qIQggCSgCDCELA0AgBiAITw0CIAAgBkECdGogCzYBACAGQQFqIQYMAAALAAsgCUHQAGokAA8LIAwgCDYCACAKQQFqIQoMAAALAAs0ACAAIAMgBCAFEDYiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQNAVBuH8LCyMAIAA/AEEQdGtB//8DakEQdkAAQX9GBEBBAA8LQQAQAEEBCzsBAX8gAgRAA0AgACABIAJBgCAgAkGAIEkbIgMQCyEAIAFBgCBqIQEgAEGAIGohACACIANrIgINAAsLCwYAIAAQAwsLqBUJAEGICAsNAQAAAAEAAAACAAAAAgBBoAgLswYBAAAAAQAAAAIAAAACAAAAJgAAAIIAAAAhBQAASgAAAGcIAAAmAAAAwAEAAIAAAABJBQAASgAAAL4IAAApAAAALAIAAIAAAABJBQAASgAAAL4IAAAvAAAAygIAAIAAAACKBQAASgAAAIQJAAA1AAAAcwMAAIAAAACdBQAASgAAAKAJAAA9AAAAgQMAAIAAAADrBQAASwAAAD4KAABEAAAAngMAAIAAAABNBgAASwAAAKoKAABLAAAAswMAAIAAAADBBgAATQAAAB8NAABNAAAAUwQAAIAAAAAjCAAAUQAAAKYPAABUAAAAmQQAAIAAAABLCQAAVwAAALESAABYAAAA2gQAAIAAAABvCQAAXQAAACMUAABUAAAARQUAAIAAAABUCgAAagAAAIwUAABqAAAArwUAAIAAAAB2CQAAfAAAAE4QAAB8AAAA0gIAAIAAAABjBwAAkQAAAJAHAACSAAAAAAAAAAEAAAABAAAABQAAAA0AAAAdAAAAPQAAAH0AAAD9AAAA/QEAAP0DAAD9BwAA/Q8AAP0fAAD9PwAA/X8AAP3/AAD9/wEA/f8DAP3/BwD9/w8A/f8fAP3/PwD9/38A/f//AP3//wH9//8D/f//B/3//w/9//8f/f//P/3//38AAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAAHwAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACUAAAAnAAAAKQAAACsAAAAvAAAAMwAAADsAAABDAAAAUwAAAGMAAACDAAAAAwEAAAMCAAADBAAAAwgAAAMQAAADIAAAA0AAAAOAAAADAAEAQeAPC1EBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAEAAAABQAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAQcQQC4sBAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABIAAAAUAAAAFgAAABgAAAAcAAAAIAAAACgAAAAwAAAAQAAAAIAAAAAAAQAAAAIAAAAEAAAACAAAABAAAAAgAAAAQAAAAIAAAAAAAQBBkBIL5gQBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAAAEAAAAEAAAACAAAAAAAAAABAAEBBgAAAAAAAAQAAAAAEAAABAAAAAAgAAAFAQAAAAAAAAUDAAAAAAAABQQAAAAAAAAFBgAAAAAAAAUHAAAAAAAABQkAAAAAAAAFCgAAAAAAAAUMAAAAAAAABg4AAAAAAAEFEAAAAAAAAQUUAAAAAAABBRYAAAAAAAIFHAAAAAAAAwUgAAAAAAAEBTAAAAAgAAYFQAAAAAAABwWAAAAAAAAIBgABAAAAAAoGAAQAAAAADAYAEAAAIAAABAAAAAAAAAAEAQAAAAAAAAUCAAAAIAAABQQAAAAAAAAFBQAAACAAAAUHAAAAAAAABQgAAAAgAAAFCgAAAAAAAAULAAAAAAAABg0AAAAgAAEFEAAAAAAAAQUSAAAAIAABBRYAAAAAAAIFGAAAACAAAwUgAAAAAAADBSgAAAAAAAYEQAAAABAABgRAAAAAIAAHBYAAAAAAAAkGAAIAAAAACwYACAAAMAAABAAAAAAQAAAEAQAAACAAAAUCAAAAIAAABQMAAAAgAAAFBQAAACAAAAUGAAAAIAAABQgAAAAgAAAFCQAAACAAAAULAAAAIAAABQwAAAAAAAAGDwAAACAAAQUSAAAAIAABBRQAAAAgAAIFGAAAACAAAgUcAAAAIAADBSgAAAAgAAQFMAAAAAAAEAYAAAEAAAAPBgCAAAAAAA4GAEAAAAAADQYAIABBgBcLhwIBAAEBBQAAAAAAAAUAAAAAAAAGBD0AAAAAAAkF/QEAAAAADwX9fwAAAAAVBf3/HwAAAAMFBQAAAAAABwR9AAAAAAAMBf0PAAAAABIF/f8DAAAAFwX9/38AAAAFBR0AAAAAAAgE/QAAAAAADgX9PwAAAAAUBf3/DwAAAAIFAQAAABAABwR9AAAAAAALBf0HAAAAABEF/f8BAAAAFgX9/z8AAAAEBQ0AAAAQAAgE/QAAAAAADQX9HwAAAAATBf3/BwAAAAEFAQAAABAABgQ9AAAAAAAKBf0DAAAAABAF/f8AAAAAHAX9//8PAAAbBf3//wcAABoF/f//AwAAGQX9//8BAAAYBf3//wBBkBkLhgQBAAEBBgAAAAAAAAYDAAAAAAAABAQAAAAgAAAFBQAAAAAAAAUGAAAAAAAABQgAAAAAAAAFCQAAAAAAAAULAAAAAAAABg0AAAAAAAAGEAAAAAAAAAYTAAAAAAAABhYAAAAAAAAGGQAAAAAAAAYcAAAAAAAABh8AAAAAAAAGIgAAAAAAAQYlAAAAAAABBikAAAAAAAIGLwAAAAAAAwY7AAAAAAAEBlMAAAAAAAcGgwAAAAAACQYDAgAAEAAABAQAAAAAAAAEBQAAACAAAAUGAAAAAAAABQcAAAAgAAAFCQAAAAAAAAUKAAAAAAAABgwAAAAAAAAGDwAAAAAAAAYSAAAAAAAABhUAAAAAAAAGGAAAAAAAAAYbAAAAAAAABh4AAAAAAAAGIQAAAAAAAQYjAAAAAAABBicAAAAAAAIGKwAAAAAAAwYzAAAAAAAEBkMAAAAAAAUGYwAAAAAACAYDAQAAIAAABAQAAAAwAAAEBAAAABAAAAQFAAAAIAAABQcAAAAgAAAFCAAAACAAAAUKAAAAIAAABQsAAAAAAAAGDgAAAAAAAAYRAAAAAAAABhQAAAAAAAAGFwAAAAAAAAYaAAAAAAAABh0AAAAAAAAGIAAAAAAAEAYDAAEAAAAPBgOAAAAAAA4GA0AAAAAADQYDIAAAAAAMBgMQAAAAAAsGAwgAAAAACgYDBABBpB0L2QEBAAAAAwAAAAcAAAAPAAAAHwAAAD8AAAB/AAAA/wAAAP8BAAD/AwAA/wcAAP8PAAD/HwAA/z8AAP9/AAD//wAA//8BAP//AwD//wcA//8PAP//HwD//z8A//9/AP///wD///8B////A////wf///8P////H////z////9/AAAAAAEAAAACAAAABAAAAAAAAAACAAAABAAAAAgAAAAAAAAAAQAAAAIAAAABAAAABAAAAAQAAAAEAAAABAAAAAgAAAAIAAAACAAAAAcAAAAIAAAACQAAAAoAAAALAEGgIAsDwBBQ",Ny="display-p3",Fy="display-p3-linear";({...Je.spaces[Ct]});const wl=new WeakMap;let Tl=0,Rl;class fn extends Xi{constructor(e){super(e),this.transcoderPath="",this.transcoderBinary=null,this.transcoderPending=null,this.workerPool=new Cy,this.workerSourceURL="",this.workerConfig=null,typeof MSC_TRANSCODER<"u"&&console.warn('THREE.KTX2Loader: Please update to latest "basis_transcoder". "msc_basis_transcoder" is no longer supported in three.js r125+.')}setTranscoderPath(e){return this.transcoderPath=e,this}setWorkerLimit(e){return this.workerPool.setWorkerLimit(e),this}async detectSupportAsync(e){return this.workerConfig={astcSupported:await e.hasFeatureAsync("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:await e.hasFeatureAsync("texture-compression-etc2"),etc2Supported:await e.hasFeatureAsync("texture-compression-etc2"),dxtSupported:await e.hasFeatureAsync("texture-compression-bc"),bptcSupported:await e.hasFeatureAsync("texture-compression-bc"),pvrtcSupported:await e.hasFeatureAsync("texture-compression-pvrtc")},this}detectSupport(e){return e.isWebGPURenderer===!0?this.workerConfig={astcSupported:e.hasFeature("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:e.hasFeature("texture-compression-etc2"),etc2Supported:e.hasFeature("texture-compression-etc2"),dxtSupported:e.hasFeature("texture-compression-bc"),bptcSupported:e.hasFeature("texture-compression-bc"),pvrtcSupported:e.hasFeature("texture-compression-pvrtc")}:this.workerConfig={astcSupported:e.extensions.has("WEBGL_compressed_texture_astc"),astcHDRSupported:e.extensions.has("WEBGL_compressed_texture_astc")&&e.extensions.get("WEBGL_compressed_texture_astc").getSupportedProfiles().includes("hdr"),etc1Supported:e.extensions.has("WEBGL_compressed_texture_etc1"),etc2Supported:e.extensions.has("WEBGL_compressed_texture_etc"),dxtSupported:e.extensions.has("WEBGL_compressed_texture_s3tc"),bptcSupported:e.extensions.has("EXT_texture_compression_bptc"),pvrtcSupported:e.extensions.has("WEBGL_compressed_texture_pvrtc")||e.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")},this}init(){if(!this.transcoderPending){const e=new Us(this.manager);e.setPath(this.transcoderPath),e.setWithCredentials(this.withCredentials);const t=e.loadAsync("basis_transcoder.js"),i=new Us(this.manager);i.setPath(this.transcoderPath),i.setResponseType("arraybuffer"),i.setWithCredentials(this.withCredentials);const r=i.loadAsync("basis_transcoder.wasm");this.transcoderPending=Promise.all([t,r]).then(([s,a])=>{const o=fn.BasisWorker.toString(),l=["/* constants */","let _EngineFormat = "+JSON.stringify(fn.EngineFormat),"let _EngineType = "+JSON.stringify(fn.EngineType),"let _TranscoderFormat = "+JSON.stringify(fn.TranscoderFormat),"let _BasisFormat = "+JSON.stringify(fn.BasisFormat),"/* basis_transcoder.js */",s,"/* worker */",o.substring(o.indexOf("{")+1,o.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([l])),this.transcoderBinary=a,this.workerPool.setWorkerCreator(()=>{const c=new Worker(this.workerSourceURL),u=this.transcoderBinary.slice(0);return c.postMessage({type:"init",config:this.workerConfig,transcoderBinary:u},[u]),c})}),Tl>0&&console.warn("THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."),Tl++}return this.transcoderPending}load(e,t,i,r){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");const s=new Us(this.manager);s.setPath(this.path),s.setCrossOrigin(this.crossOrigin),s.setWithCredentials(this.withCredentials),s.setResponseType("arraybuffer"),s.load(e,a=>{this.parse(a,t,r)},i,r)}parse(e,t,i){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");if(wl.has(e))return wl.get(e).promise.then(t).catch(i);this._createTexture(e).then(r=>t?t(r):null).catch(i)}_createTextureFrom(e,t){const{type:i,error:r,data:{faces:s,width:a,height:o,format:l,type:c,dfdFlags:u}}=e;if(i==="error")return Promise.reject(r);let h;if(t.faceCount===6)h=new cE(s,l,c);else{const d=s[0].mipmaps;h=t.layerCount>1?new lE(d,a,o,t.layerCount,l,c):new Ro(d,a,o,l,c)}return h.minFilter=s[0].mipmaps.length===1?Ut:vn,h.magFilter=Ut,h.generateMipmaps=!1,h.needsUpdate=!0,h.colorSpace=Zp(t),h.premultiplyAlpha=!!(u&Ty),h}async _createTexture(e,t={}){const i=Py(new Uint8Array(e)),r=i.vkFormat===_u&&i.dataFormatDescriptor[0].colorModel===167;if(!(i.vkFormat===Dy||r&&!this.workerConfig.astcHDRSupported))return ky(i);const a=t,o=this.init().then(()=>this.workerPool.postMessage({type:"transcode",buffer:e,taskConfig:a},[e])).then(l=>this._createTextureFrom(l.data,i));return wl.set(e,{promise:o}),o}dispose(){this.workerPool.dispose(),this.workerSourceURL&&URL.revokeObjectURL(this.workerSourceURL),Tl--}}fn.BasisFormat={ETC1S:0,UASTC:1,UASTC_HDR:2};fn.TranscoderFormat={ETC1:0,ETC2:1,BC1:2,BC3:3,BC4:4,BC5:5,BC7_M6_OPAQUE_ONLY:6,BC7_M5:7,PVRTC1_4_RGB:8,PVRTC1_4_RGBA:9,ASTC_4x4:10,ATC_RGB:11,ATC_RGBA_INTERPOLATED_ALPHA:12,RGBA32:13,RGB565:14,BGR565:15,RGBA4444:16,BC6H:22,RGB_HALF:24,RGBA_HALF:25};fn.EngineFormat={RGBAFormat:Pt,RGBA_ASTC_4x4_Format:Ni,RGB_BPTC_UNSIGNED_Format:so,RGBA_BPTC_Format:Gr,RGBA_ETC2_EAC_Format:Ws,RGBA_PVRTC_4BPPV1_Format:Hr,RGBA_S3TC_DXT5_Format:Bs,RGB_ETC1_Format:ro,RGB_ETC2_Format:zs,RGB_PVRTC_4BPPV1_Format:io,RGBA_S3TC_DXT1_Format:Ui};fn.EngineType={UnsignedByteType:ze,HalfFloatType:hn,FloatType:kt};fn.BasisWorker=function(){let n,e,t;const i=_EngineFormat,r=_EngineType,s=_TranscoderFormat,a=_BasisFormat;self.addEventListener("message",function(g){const m=g.data;switch(m.type){case"init":n=m.config,o(m.transcoderBinary);break;case"transcode":e.then(()=>{try{const{faces:A,buffers:p,width:b,height:M,hasAlpha:E,format:_,type:y,dfdFlags:S}=l(m.buffer);self.postMessage({type:"transcode",id:m.id,data:{faces:A,width:b,height:M,hasAlpha:E,format:_,type:y,dfdFlags:S}},p)}catch(A){console.error(A),self.postMessage({type:"error",id:m.id,error:A.message})}});break}});function o(g){e=new Promise(m=>{t={wasmBinary:g,onRuntimeInitialized:m},BASIS(t)}).then(()=>{t.initializeBasis(),t.KTX2File===void 0&&console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.")})}function l(g){const m=new t.KTX2File(new Uint8Array(g));function A(){m.close(),m.delete()}if(!m.isValid())throw A(),new Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");let p;if(m.isUASTC())p=a.UASTC;else if(m.isETC1S())p=a.ETC1S;else if(m.isHDR())p=a.UASTC_HDR;else throw new Error("THREE.KTX2Loader: Unknown Basis encoding");const b=m.getWidth(),M=m.getHeight(),E=m.getLayers()||1,_=m.getLevels(),y=m.getFaces(),S=m.getHasAlpha(),C=m.getDFDFlags(),{transcoderFormat:v,engineFormat:x,engineType:T}=h(p,b,M,S);if(!b||!M||!_)throw A(),new Error("THREE.KTX2Loader:	Invalid texture");if(!m.startTranscoding())throw A(),new Error("THREE.KTX2Loader: .startTranscoding failed");const D=[],U=[];for(let N=0;N<y;N++){const Q=[];for(let G=0;G<_;G++){const X=[];let V,ee;for(let se=0;se<E;se++){const pe=m.getImageLevelInfo(G,se,N);N===0&&G===0&&se===0&&(pe.origWidth%4!==0||pe.origHeight%4!==0)&&console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions."),_>1?(V=pe.origWidth,ee=pe.origHeight):(V=pe.width,ee=pe.height);let Ue=new Uint8Array(m.getImageTranscodedSizeInBytes(G,se,0,v));const We=m.transcodeImage(Ue,G,se,N,v,0,-1,-1);if(T===r.HalfFloatType&&(Ue=new Uint16Array(Ue.buffer,Ue.byteOffset,Ue.byteLength/Uint16Array.BYTES_PER_ELEMENT)),!We)throw A(),new Error("THREE.KTX2Loader: .transcodeImage failed.");X.push(Ue)}const Z=f(X);Q.push({data:Z,width:V,height:ee}),U.push(Z.buffer)}D.push({mipmaps:Q,width:b,height:M,format:x,type:T})}return A(),{faces:D,buffers:U,width:b,height:M,hasAlpha:S,dfdFlags:C,format:x,type:T}}const c=[{if:"astcSupported",basisFormat:[a.UASTC],transcoderFormat:[s.ASTC_4x4,s.ASTC_4x4],engineFormat:[i.RGBA_ASTC_4x4_Format,i.RGBA_ASTC_4x4_Format],engineType:[r.UnsignedByteType],priorityETC1S:1/0,priorityUASTC:1,needsPowerOfTwo:!1},{if:"bptcSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.BC7_M5,s.BC7_M5],engineFormat:[i.RGBA_BPTC_Format,i.RGBA_BPTC_Format],engineType:[r.UnsignedByteType],priorityETC1S:3,priorityUASTC:2,needsPowerOfTwo:!1},{if:"dxtSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.BC1,s.BC3],engineFormat:[i.RGBA_S3TC_DXT1_Format,i.RGBA_S3TC_DXT5_Format],engineType:[r.UnsignedByteType],priorityETC1S:4,priorityUASTC:5,needsPowerOfTwo:!1},{if:"etc2Supported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.ETC1,s.ETC2],engineFormat:[i.RGB_ETC2_Format,i.RGBA_ETC2_EAC_Format],engineType:[r.UnsignedByteType],priorityETC1S:1,priorityUASTC:3,needsPowerOfTwo:!1},{if:"etc1Supported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.ETC1],engineFormat:[i.RGB_ETC1_Format],engineType:[r.UnsignedByteType],priorityETC1S:2,priorityUASTC:4,needsPowerOfTwo:!1},{if:"pvrtcSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.PVRTC1_4_RGB,s.PVRTC1_4_RGBA],engineFormat:[i.RGB_PVRTC_4BPPV1_Format,i.RGBA_PVRTC_4BPPV1_Format],engineType:[r.UnsignedByteType],priorityETC1S:5,priorityUASTC:6,needsPowerOfTwo:!0},{if:"bptcSupported",basisFormat:[a.UASTC_HDR],transcoderFormat:[s.BC6H],engineFormat:[i.RGB_BPTC_UNSIGNED_Format],engineType:[r.HalfFloatType],priorityHDR:1,needsPowerOfTwo:!1},{basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.RGBA32,s.RGBA32],engineFormat:[i.RGBAFormat,i.RGBAFormat],engineType:[r.UnsignedByteType,r.UnsignedByteType],priorityETC1S:100,priorityUASTC:100,needsPowerOfTwo:!1},{basisFormat:[a.UASTC_HDR],transcoderFormat:[s.RGBA_HALF],engineFormat:[i.RGBAFormat],engineType:[r.HalfFloatType],priorityHDR:100,needsPowerOfTwo:!1}],u={[a.ETC1S]:c.filter(g=>g.basisFormat.includes(a.ETC1S)).sort((g,m)=>g.priorityUASTC-m.priorityUASTC),[a.UASTC]:c.filter(g=>g.basisFormat.includes(a.UASTC)).sort((g,m)=>g.priorityUASTC-m.priorityUASTC),[a.UASTC_HDR]:c.filter(g=>g.basisFormat.includes(a.UASTC_HDR)).sort((g,m)=>g.priorityHDR-m.priorityHDR)};function h(g,m,A,p){const b=u[g];for(let M=0;M<b.length;M++){const E=b[M];if(E.if&&!n[E.if]||!E.basisFormat.includes(g)||p&&E.transcoderFormat.length<2||E.needsPowerOfTwo&&!(d(m)&&d(A)))continue;const _=E.transcoderFormat[p?1:0],y=E.engineFormat[p?1:0],S=E.engineType[0];return{transcoderFormat:_,engineFormat:y,engineType:S}}throw new Error("THREE.KTX2Loader: Failed to identify transcoding target.")}function d(g){return g<=2?!0:(g&g-1)===0&&g!==0}function f(g){if(g.length===1)return g[0];let m=0;for(let b=0;b<g.length;b++){const M=g[b];m+=M.byteLength}const A=new Uint8Array(m);let p=0;for(let b=0;b<g.length;b++){const M=g[b];A.set(M,p),p+=M.byteLength}return A}};const Oy=new Set([Pt,Qs,Bi,ai]),Bl={[Sp]:Pt,[Ip]:Bi,[Mp]:ai,[yp]:Pt,[xp]:Bi,[bp]:ai,[vp]:Pt,[Ep]:Pt,[_p]:Bi,[gp]:Bi,[mp]:ai,[Ap]:ai,[wp]:Qs,[Cp]:Qs,[Gp]:Ws,[Hp]:zs,[_u]:Ni,[zp]:Ni,[Vp]:Ni,[Jp]:Nr,[qp]:Nr,[Wp]:Nr,[Lp]:Ui,[Bp]:Ui,[Rp]:Pr,[Tp]:Pr,[Pp]:Ur,[Dp]:Ur,[Np]:oo,[Up]:ao,[Op]:co,[Fp]:lo,[Qp]:Gr,[kp]:Gr,[Kp]:Hr,[Xp]:Hr,[Yp]:Vs,[jp]:Vs},xr={[Sp]:kt,[Ip]:kt,[Mp]:kt,[yp]:hn,[xp]:hn,[bp]:hn,[vp]:ze,[Ep]:ze,[_p]:ze,[gp]:ze,[mp]:ze,[Ap]:ze,[wp]:Mo,[Cp]:Io,[Gp]:ze,[Hp]:ze,[_u]:hn,[zp]:ze,[Vp]:ze,[Jp]:hn,[qp]:ze,[Wp]:ze,[Lp]:ze,[Bp]:ze,[Rp]:ze,[Tp]:ze,[Pp]:ze,[Dp]:ze,[Np]:ze,[Up]:ze,[Op]:ze,[Fp]:ze,[Qp]:ze,[kp]:ze,[Kp]:ze,[Xp]:ze,[Yp]:ze,[jp]:ze};async function ky(n){const{vkFormat:e}=n;if(Bl[e]===void 0)throw new Error("THREE.KTX2Loader: Unsupported vkFormat: "+e);xr[e]===void 0&&console.warn('THREE.KTX2Loader: Missing ".type" for vkFormat: '+e);let t;n.supercompressionScheme===ld&&(Rl||(Rl=new Promise(async a=>{const o=new Uy;await o.init(),a(o)})),t=await Rl);const i=[];for(let a=0;a<n.levels.length;a++){const o=Math.max(1,n.pixelWidth>>a),l=Math.max(1,n.pixelHeight>>a),c=n.pixelDepth?Math.max(1,n.pixelDepth>>a):0,u=n.levels[a];let h;if(n.supercompressionScheme===wy)h=u.levelData;else if(n.supercompressionScheme===ld)h=t.decode(u.levelData,u.uncompressedByteLength);else throw new Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");let d;xr[e]===kt?d=new Float32Array(h.buffer,h.byteOffset,h.byteLength/Float32Array.BYTES_PER_ELEMENT):xr[e]===hn?d=new Uint16Array(h.buffer,h.byteOffset,h.byteLength/Uint16Array.BYTES_PER_ELEMENT):xr[e]===Mo||xr[e]===Io?d=new Uint32Array(h.buffer,h.byteOffset,h.byteLength/Uint32Array.BYTES_PER_ELEMENT):d=h,i.push({data:d,width:o,height:l,depth:c})}const r=n.levelCount===0||i.length>1;let s;if(Oy.has(Bl[e]))s=n.pixelDepth===0?new lu(i[0].data,n.pixelWidth,n.pixelHeight):new Gf(i[0].data,n.pixelWidth,n.pixelHeight,n.pixelDepth),s.minFilter=r?Kc:Nt,s.magFilter=Nt,s.generateMipmaps=n.levelCount===0;else{if(n.pixelDepth>0)throw new Error("THREE.KTX2Loader: Unsupported pixelDepth.");s=new Ro(i,n.pixelWidth,n.pixelHeight),s.minFilter=r?vn:Ut,s.magFilter=Ut}return s.mipmaps=i,s.type=xr[e],s.format=Bl[e],s.colorSpace=Zp(n),s.needsUpdate=!0,Promise.resolve(s)}function Zp(n){const e=n.dataFormatDescriptor[0];return e.colorPrimaries===By?e.transferFunction===cd?Ct:Qt:e.colorPrimaries===Ly?e.transferFunction===cd?Ny:Fy:(e.colorPrimaries===Ry||console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${e.colorPrimaries}"`),Tn)}const Qy=""+new URL("basis_transcoder-o4Hde_L7.js",import.meta.url).href,Hy=""+new URL("basis_transcoder-VXdx5NbI.wasm",import.meta.url).href,Rt={step:1/60,walkSpeed:3.2,runSpeed:5.4,acceleration:6.4,steerRate:12,brakeRate:28,restSpeed:.06,inputDeadzone:.01,jumpSpeed:6,gravity:18,maxJumps:2,faceMinSpeed:.1,maxFrame:.1,referenceHeight:1.8},It={distance:5,lookHeight:1.2,pitch:-.28,pitchMin:-.65,pitchMax:.05,fov:58,narrowFov:72,narrowWidth:600,near:.08,lookRate:18,dragYaw:.0032,dragPitch:.0025},dd={lookYawRate:2.6,lookPitchRate:1.6},Gy={settleRate:4},No=(n,e,t)=>Math.max(e,Math.min(t,n)),fd=(n,e)=>1-Math.exp(-n*No(Number.isFinite(e)?e:0,0,.1)),Vy=n=>n<It.narrowWidth?It.narrowFov:It.fov;function Uc(n={}){const e=n.scale&&n.scale>0?n.scale:1,t=n.yaw||0;return{yaw:t,pitch:It.pitch,targetYaw:t,targetPitch:It.pitch,scale:e,distance:It.distance*e,look:{x:0,y:It.lookHeight*e,z:0},fov:null,fovBlend:0,settling:!1}}const Eu=n=>{n.fov===null||n.settling||(n.settling=!0,n.targetPitch=No(n.targetPitch,It.pitchMin,It.pitchMax))};function zy(n,e,t){Eu(n),n.targetYaw-=e*It.dragYaw,n.targetPitch=No(n.targetPitch-t*It.dragPitch,It.pitchMin,It.pitchMax)}function Wy(n,e,t=0){!e&&!t||(Eu(n),n.targetYaw+=e,n.yaw+=e,n.targetPitch=No(n.targetPitch+t,It.pitchMin,It.pitchMax))}function qy(n,e,t=!1){t&&Eu(n);const i=fd(It.lookRate,e);if(n.yaw+=(n.targetYaw-n.yaw)*i,n.pitch+=(n.targetPitch-n.pitch)*i,!n.settling)return;const r=fd(Gy.settleRate,e),s=It.distance*n.scale,a=It.lookHeight*n.scale;n.distance+=(s-n.distance)*r,n.look.x+=-n.look.x*r,n.look.y+=(a-n.look.y)*r,n.look.z+=-n.look.z*r,n.fovBlend+=-n.fovBlend*r,n.fovBlend<.002&&Math.abs(n.distance-s)<.002*n.scale&&Math.hypot(n.look.x,n.look.y-a,n.look.z)<.002*n.scale&&(n.distance=s,n.look={x:0,y:a,z:0},n.settling=!1,n.fov=null,n.fovBlend=0)}function jy(n,e,t=1280){const i={x:e.x+n.look.x,y:0+n.look.y,z:e.z+n.look.z},r=Math.cos(n.pitch)*n.distance,s=Vy(t),a=n.fov===null?s:s+(n.fov-s)*n.fovBlend;return{position:{x:i.x+Math.sin(n.yaw)*r,y:i.y-Math.sin(n.pitch)*n.distance,z:i.z+Math.cos(n.yaw)*r},target:i,fov:a,near:It.near*n.scale}}const Xy=(n,e,t)=>Math.max(e,Math.min(t,n)),Yt=(n,e=NaN)=>typeof n=="number"&&Number.isFinite(n)?n:e,As=n=>Array.isArray(n)?{x:Yt(n[0]),y:Yt(n[1]),z:Yt(n[2])}:{x:Yt(n==null?void 0:n.x),y:Yt(n==null?void 0:n.y),z:Yt(n==null?void 0:n.z)};function Yy(n){const e=n;if(!e||typeof e!="object")return null;let t;if(e.camera&&e.avatar){const s=As(e.avatar.position),a=As(e.camera.position),o=As(e.camera.target),[l,c,u,h]=[0,1,2,3].map(d=>{var f;return Yt((f=e.avatar.rotation)==null?void 0:f[d],d===3?1:0)});t={cameraOffset:{x:a.x-s.x,y:a.y-s.y,z:a.z-s.z},cameraTargetOffset:{x:o.x-s.x,y:o.y-s.y,z:o.z-s.z},avatarRotation:Math.atan2(2*(h*c+l*u),1-2*(c*c+l*l)),fov:Yt(e.camera.fov)}}else t={cameraOffset:As(e.cameraOffset),cameraTargetOffset:As(e.cameraTargetOffset),avatarRotation:Yt(e.avatarRotation),avatarHeight:Yt(e.avatarHeight)>=.2&&e.avatarHeight<=10?e.avatarHeight:void 0,fov:Yt(e.fov)};const i={x:t.cameraOffset.x-t.cameraTargetOffset.x,y:t.cameraOffset.y-t.cameraTargetOffset.y,z:t.cameraOffset.z-t.cameraTargetOffset.z},r=Math.hypot(i.x,i.y,i.z);return!(r>.3&&r<100)||!(t.fov>5&&t.fov<150)||![t.cameraOffset,t.cameraTargetOffset].every(s=>Math.hypot(s.x,s.y,s.z)<=1e3)||!Number.isFinite(t.avatarRotation)?null:t}function Ky(n,e){const t=e.avatarHeight,i=t/Rt.referenceHeight,r={x:e.at.x,y:e.at.y||0,z:e.at.z},s=Yy(n),a=s?s.cameraOffset.x-s.cameraTargetOffset.x:0,o=s?s.cameraOffset.z-s.cameraTargetOffset.z:0,l=s&&Math.hypot(a,o)>1e-6?Math.atan2(a,o):(s==null?void 0:s.avatarRotation)??0,c=Yt(e.avatarFacing),u=s?Number.isFinite(c)?c-s.avatarRotation:Yt(e.facing,0)-l:0,h=s?l+u:Number.isFinite(c)?c:Yt(e.facing,0),d=Uc({yaw:h,scale:i});if(!s){const _=Math.cos(It.pitch)*d.distance;return{position:{x:r.x+Math.sin(h)*_,y:r.y+d.look.y-Math.sin(It.pitch)*d.distance,z:r.z+Math.cos(h)*_},target:{x:r.x,y:r.y+d.look.y,z:r.z},fov:It.fov,avatarRotation:h,scale:i,camera:d}}const f=t/(s.avatarHeight??Rt.referenceHeight),g=s.cameraOffset.y-s.cameraTargetOffset.y,m=Math.sin(u),A=Math.cos(u),p=_=>({x:(_.x*A+_.z*m)*f,y:_.y*f,z:(_.z*A-_.x*m)*f}),b=p(s.cameraOffset),M=p(s.cameraTargetOffset),E=Math.hypot(a,g,o)*f;return d.distance=E,d.look=M,d.pitch=d.targetPitch=-Math.asin(Xy(g*f/E,-1,1)),d.fov=s.fov,d.fovBlend=1,{position:{x:r.x+b.x,y:r.y+b.y,z:r.z+b.z},target:{x:r.x+M.x,y:r.y+M.y,z:r.z+M.z},fov:s.fov,avatarRotation:Math.atan2(Math.sin(s.avatarRotation+u),Math.cos(s.avatarRotation+u)),scale:i,camera:d}}const Jy=.7;function Zy(n,e,t){const i=t.x-n.x,r=t.z-n.z,s=Math.hypot(i,r);return s<1e-6?!0:(Math.sin(e)*i+Math.cos(e)*r)/s>=.5}function $y(){let n="none",e=0,t=!1,i=!1,r=null;return{get phase(){return n},get crouch(){return e*e*(3-2*e)},get handsEmpty(){return i},get view(){return r},stage(s,a={}){r=s,i=!0,e=s?1:0,t=!s||!!a.entered,n=e>0?t?"rising":"crouched":"standing"},enter(){n!=="none"&&(t=!0,e>0&&(n="rising"))},fillHands(){i=!1},update(s){!t||e<=0||!(s>0)||(e=Math.max(0,e-s/Jy),e===0&&(n="standing"))}}}function pd(n,e,t){const i=Math.max(0,Math.min(1,n)),r=e+t,s=r*.42*i,a=Math.max(Math.abs(e-t)+1e-6,r-s),o=(u,h,d)=>Math.acos(Math.max(-1,Math.min(1,(u*u+h*h-d*d)/(2*u*h)))),l=e>0&&i>0?o(e,a,t):0,c=t>0&&i>0?o(t,a,e):0;return{drop:s,upperLeg:-l,lowerLeg:l+c,foot:-c,spine:.3*i,head:-.22*i,armDown:-1.2*i,armForward:.35*i,elbow:.5*i}}const _o=["CHAABI","CHAABI2","CRIP","DEATH","FLOORSITTING","FLY","HIPHOP","MOONWALK","PRAYING","SEXY","SHUFFLING","SITTALKING","SITTING","TECHNO","WANNAROCK"],qa=8;function eM(n){const e=_o.indexOf(n.emote);if(e>=0)return qa+e;if(n.air)return 3;if(n.wave)return 4;const t=n.speed??0;return t<.3?0:t<2.8?1:2}function tM(n,e=0){const t=typeof n=="number"&&Number.isInteger(n)?n:0;return t>=qa&&t<qa+_o.length?{emote:_o[t-qa],speed:0}:t===3?{air:!0,speed:e}:t===4?{wave:!0,speed:0}:t===1?{speed:Math.min(2.7,Math.max(1.5,e))}:t===2?{speed:Math.max(3.4,e)}:{speed:0}}function Ad(n,e=!0){if(n.emote&&e)return{[n.emote]:1};if(n.air)return{JUMP:1};if(n.wave)return{WAVING:1};const t=n.speed??0;if(t<.3)return{IDLE:1};if(t<2.8){const r=Math.min(1,(t-.3)/1.2);return{WALK:r,IDLE:1-r}}const i=Math.min(1,(t-2.8)/1.5);return{RUN:i,WALK:1-i}}function nM(n,e){return n==="WALK"?Math.max(.6,e/1.5):n==="RUN"?Math.max(.7,e/5):1}const ms=n=>typeof n=="number"&&Number.isFinite(n)?n:0;function iM(n){if(!n||typeof n.id!="string"||!n.id)return null;const e=typeof n.name=="string"&&n.name.trim()?n.name.trim().slice(0,24):"Visitor",t=typeof n.vrm=="string"&&n.vrm.length<=2048?n.vrm:typeof n.avatarUrl=="string"&&n.avatarUrl.length<=2048?n.avatarUrl:"";return{id:n.id.slice(0,64),name:e,vrm:t,talking:n.talking===!0,fresh:n.fresh===!0,pose:{x:ms(n.x),y:ms(n.y),z:ms(n.z),h:ms(n.h),a:Math.max(0,Math.min(31,Math.round(ms(n.a))))}}}function rM(n,e,t,i=!1,r=20){const s=n[n.length-1];s&&!i&&s.x===e.x&&s.y===e.y&&s.z===e.z&&s.h===e.h&&s.a===e.a||(n.push({t,...e}),n.length>r&&n.shift())}const sM=(n,e,t)=>n+Math.atan2(Math.sin(e-n),Math.cos(e-n))*t;function aM(n,e){if(!n.length)return null;let t=n.length-1;for(;t>0&&n[t].t>e;)t--;const i=n[t],r=n[t+1];if(!r||e<=i.t)return{x:i.x,y:i.y,z:i.z,h:i.h,a:i.a,speed:0};const s=Math.max(.001,r.t-i.t),a=Math.min(1,(e-i.t)/s);return{x:i.x+(r.x-i.x)*a,y:i.y+(r.y-i.y)*a,z:i.z+(r.z-i.z)*a,h:sM(i.h,r.h,a),a:a<.5?i.a:r.a,speed:Math.hypot(r.x-i.x,r.z-i.z)/s}}const oM=.26;function lM(){let n=!1;const e=()=>{n=!0};return{watch(t){t.traverse(i=>{i.isMesh&&(i.onBeforeRender=e)})},take(){const t=n;return n=!1,t}}}const $p={mixamorigHips:"hips",mixamorigSpine:"spine",mixamorigSpine1:"chest",mixamorigSpine2:"upperChest",mixamorigNeck:"neck",mixamorigHead:"head",mixamorigLeftShoulder:"leftShoulder",mixamorigLeftArm:"leftUpperArm",mixamorigLeftForeArm:"leftLowerArm",mixamorigLeftHand:"leftHand",mixamorigRightShoulder:"rightShoulder",mixamorigRightArm:"rightUpperArm",mixamorigRightForeArm:"rightLowerArm",mixamorigRightHand:"rightHand",mixamorigLeftUpLeg:"leftUpperLeg",mixamorigLeftLeg:"leftLowerLeg",mixamorigLeftFoot:"leftFoot",mixamorigLeftToeBase:"leftToes",mixamorigRightUpLeg:"rightUpperLeg",mixamorigRightLeg:"rightLowerLeg",mixamorigRightFoot:"rightFoot",mixamorigRightToeBase:"rightToes"},cM=Object.values($p);function uM(n){const e=n==null?void 0:n.tracks.find(t=>t.name==="mixamorigHips.position");return e&&Math.abs(e.values[1])||1}function hM(n,e,t,i){var a;const r=[],s=((a=e.meta)==null?void 0:a.metaVersion)==="0";for(const o of n.tracks){const[l,c]=o.name.split("."),u=e.humanoid.getNormalizedBoneNode($p[l]);if(!u)continue;const h=Float32Array.from(o.values);if(c==="quaternion"){if(s)for(let d=0;d<h.length;d+=4)h[d]*=-1,h[d+2]*=-1;r.push(new zi(`${u.uuid}.quaternion`,o.times,h))}else if(c==="position"&&l==="mixamorigHips"){for(let d=0;d<h.length;d+=3)h[d]=t.x,h[d+1]*=t.height/i,h[d+2]=t.z;r.push(new Wi(`${u.uuid}.position`,o.times,h))}}return new go(n.name,n.duration,r)}function dM(n,e){const t=new mt;t.name="stand-in";const i=n/1.75,r=(s,a,o,l=0)=>{const c=new Ke(s,new Ps({color:a}));c.position.set(l*i,o*i,0),c.castShadow=!0,t.add(c)};r(new mo(.24*i,.5*i,6,12),e,1.05),r(new Ks(.2*i,16,12),15848118,1.58);for(const s of[-1,1])r(new mo(.085*i,.5*i,4,8),2764613,.34,s*.12);return t}const fM=(n,e,t,i)=>n+(e-n)*Math.min(1,t*i),Pa=new Qe,pM=new jt,Ua=new xn,AM=new R,mM=new R;function md(n={}){const e=n.height??1.75,t=new mt;t.name="avatar";const i=lM(),r=m=>i.watch(m);let s=n.standIn===!1?null:dM(e,n.color??3111935);s&&(t.add(s),r(s));let a=null;const o=[];let l="",c=!1,u=0,h="";const d=(m,A)=>{A.IDLE&&m.clips.size===0&&(m.sourceHeight=uM(A.IDLE));for(const[p,b]of Object.entries(A)){if(!(b!=null&&b.tracks)||m.clips.has(p))continue;const M=m.mixer.clipAction(hM(b,m.vrm,m.ref,m.sourceHeight));M.play();const E=p==="IDLE"&&m.clips.size===0?1:0;M.setEffectiveWeight(E),m.clips.set(p,{action:M,weight:E})}},f=(m,A)=>{const p=pd(A,m.upperLeg,m.lowerLeg),b=m.vrm0?-1:1,M=(y,S,C,v,x)=>{y&&(Pa.setFromEuler(pM.set(S,C,v,"YZX")),Pa.x*=b,Pa.z*=b,y.quaternion.slerp(Pa,x))},E=Math.min(1,A*4);for(const y of["left","right"])M(m.bones[`${y}UpperLeg`],p.upperLeg,0,0,E),M(m.bones[`${y}LowerLeg`],p.lowerLeg,0,0,E),M(m.bones[`${y}Foot`],p.foot,0,0,E);const _=pd(1,m.upperLeg,m.lowerLeg);M(m.bones.spine,_.spine,0,0,A),M(m.bones.head,_.head,0,0,A),M(m.bones.leftUpperArm,0,-_.armForward,_.armDown,A),M(m.bones.rightUpperArm,0,_.armForward,-_.armDown,A),M(m.bones.leftLowerArm,0,-_.elbow,0,A),M(m.bones.rightLowerArm,0,_.elbow,0,A),m.bones.hips&&(m.bones.hips.position.x+=(m.hipsRest.x-m.bones.hips.position.x)*E,m.bones.hips.position.z+=(m.hipsRest.z-m.bones.hips.position.z)*E,m.bones.hips.position.y-=p.drop)},g={root:t,height:e,motion:{},manual:!1,get kind(){return a?"vrm":s?"stand-in":"none"},get vrm(){return(a==null?void 0:a.vrm)??null},get holder(){return(a==null?void 0:a.holder)??null},get playing(){return h},attach(m){var x,T,D;if(a)throw new Error("AVATAR_ATTACHED");const A=new mt;A.name="vrm",A.add(m.scene),t.add(A),m.proxyRoot&&t.add(m.proxyRoot),t.updateMatrixWorld(!0),Ua.setFromObject(m.scene);const p=Ua.max.y-Ua.min.y,b=Math.max(.3,Math.min(3,e/(p||e)));A.scale.setScalar(b),A.position.y=-Ua.min.y*b,t.updateMatrixWorld(!0);const M={};for(const U of cM)M[U]=m.humanoid.getNormalizedBoneNode(U);const E=M.hips,_=((T=(x=m.humanoid).getRawBoneNode)==null?void 0:T.call(x,"hips"))??E,y=m.scene.worldToLocal(_.getWorldPosition(AM)),S=m.scene.getWorldScale(mM).y||1,C=U=>{var N,Q,G;return(G=((Q=(N=m.humanoid).getRawBoneNode)==null?void 0:Q.call(N,U))??M[U])==null?void 0:G.getWorldPosition(new R)},v=(U,N)=>{const Q=C(U),G=C(N);return Q&&G?Q.distanceTo(G)/S:0};a={vrm:m,holder:A,scale:b,bones:M,vrm0:((D=m.meta)==null?void 0:D.metaVersion)==="0",hipsRest:E.position.clone(),ref:{x:E.position.x,z:E.position.z,height:Math.abs(y.y)||E.position.y||1},upperLeg:v("leftUpperLeg","leftLowerLeg"),lowerLeg:v("leftLowerLeg","leftFoot"),mixer:new GE(m.proxyRoot??m.scene),clips:new Map,sourceHeight:1};for(const U of o.splice(0))d(a,U);s&&(t.remove(s),Ll(s),s=null),r(m.scene)},addClips(m){!m||typeof m!="object"||(a?d(a,m):o.push(m))},hasClip(m){return a?a.clips.has(m):o.some(A=>m in A)},drive(m,A=0){var C;const p=g.motion;if(!a){if(!s)return;u+=m*(4+(p.speed??0)*2),s.position.y=((p.speed??0)>.3?Math.abs(Math.sin(u))*.05:0)-A*.42*e*.5,s.scale.y=1-A*.25,h=Object.entries(Ad(p)).sort((v,x)=>x[1]-v[1])[0][0];return}if(g.manual)return;const b=a,M=Ad(p,!!(p.emote&&b.clips.has(p.emote))),E=p.speed??0;let _=0;for(const[v,x]of b.clips)x.weight=fM(x.weight,M[v]??0,v==="JUMP"?14:9,m),x.action.setEffectiveWeight(x.weight),x.action.timeScale=nM(v,E),x.weight>_&&(_=x.weight,h=v);const y=p.emote&&b.clips.has(p.emote)?p.emote:"";y&&y!==l&&(b.clips.get(y).action.time=0),l=y;const S=!!p.air;if(S&&!c&&b.clips.has("JUMP")&&(b.clips.get("JUMP").action.time=.35),c=S,b.clips.size)b.mixer.update(m);else for(const v of Object.values(b.bones))v==null||v.quaternion.identity();b.clips.size||(C=b.bones.hips)==null||C.position.copy(b.hipsRest),A>0&&f(b,A),b.vrm.update(m)},rest(){var m;if(a){for(const A of Object.values(a.bones))A==null||A.quaternion.identity();(m=a.bones.hips)==null||m.position.copy(a.hipsRest)}},takeDrawn(){return i.take()},dispose(){var m;(m=t.parent)==null||m.remove(t),s&&Ll(s),a&&(a.mixer.stopAllAction(),a.vrm.dispose?a.vrm.dispose():Ll(a.vrm.scene),a=null)}};return g}function Ll(n){n.traverse(e=>{var t,i;if(e.isMesh){(t=e.geometry)==null||t.dispose();for(const r of[].concat(e.material))(i=r==null?void 0:r.map)==null||i.dispose(),r==null||r.dispose()}})}const gM=(n,e)=>Object.assign(document.createElement("canvas"),{width:n,height:e}),gs=.2,gd='600 52px system-ui, -apple-system, "Segoe UI", sans-serif';function _M(n,e){var a;const t=e(8,8).getContext("2d");t.font=gd;const i=Math.ceil(Math.min(640,Math.max(96,t.measureText(n).width+56))),r=e(i,96),s=r.getContext("2d");return s.fillStyle="rgba(12, 14, 24, 0.72)",s.beginPath(),(a=s.roundRect)==null||a.call(s,0,8,i,80,40),s.roundRect||s.rect(0,8,i,80),s.fill(),s.font=gd,s.textAlign="center",s.textBaseline="middle",s.fillStyle="#ffffff",s.fillText(n,i/2,50,i-40),{canvas:r,aspect:i/96}}function EM(n){const e=n(96,96),t=e.getContext("2d");return t.fillStyle="#2fd67b",t.beginPath(),t.arc(48,48,40,0,Math.PI*2),t.fill(),t.fillStyle="#06220f",[[30,22],[44,40],[58,28]].forEach(([i,r])=>t.fillRect(i,48-r/2,9,r)),e}function vM(n,e={}){const t=e.canvas??gM,i=new mt;i.name="name-tag";const r=h=>{const d=new tp(h);return d.colorSpace=Ct,new ou({map:d,transparent:!0,depthTest:!1,depthWrite:!1})},s=new Rc;s.renderOrder=10;const a=new Rc(r(EM(t)));a.renderOrder=11,a.visible=!1,i.add(s,a);let o="",l=!1,c=0;a.position.y=gs*1.15;const u={object:i,get name(){return o},get talking(){return l},setName(h){var m;const d=String(h||"Visitor").slice(0,24);if(d===o)return;o=d;const{canvas:f,aspect:g}=_M(d,t);(m=s.material.map)==null||m.dispose(),s.material.dispose(),s.material=r(f),s.scale.set(gs*g,gs,1)},setTalking(h){l=!!h,a.visible=l,l||(c=0)},update(h){l&&(c+=h*9,a.scale.setScalar(gs*(.95+.14*Math.sin(c))))},dispose(){var h,d;for(const f of[s,a])(h=f.material.map)==null||h.dispose(),f.material.dispose();(d=i.parent)==null||d.remove(i)}};return a.scale.setScalar(gs),u.setName(n),u}function _d(n,e){if(e===n_)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===wc||e===Of){let t=n.getIndex();if(t===null){const a=[],o=n.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)a.push(l);n.setIndex(a),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}const i=t.count-2,r=[];if(e===wc)for(let a=1;a<=i;a++)r.push(t.getX(0)),r.push(t.getX(a)),r.push(t.getX(a+1));else for(let a=0;a<i;a++)a%2===0?(r.push(t.getX(a)),r.push(t.getX(a+1)),r.push(t.getX(a+2))):(r.push(t.getX(a+2)),r.push(t.getX(a+1)),r.push(t.getX(a)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=n.clone();return s.setIndex(r),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}class bM extends Xi{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new SM(t)}),this.register(function(t){return new CM(t)}),this.register(function(t){return new NM(t)}),this.register(function(t){return new FM(t)}),this.register(function(t){return new OM(t)}),this.register(function(t){return new TM(t)}),this.register(function(t){return new RM(t)}),this.register(function(t){return new BM(t)}),this.register(function(t){return new LM(t)}),this.register(function(t){return new IM(t)}),this.register(function(t){return new DM(t)}),this.register(function(t){return new wM(t)}),this.register(function(t){return new UM(t)}),this.register(function(t){return new PM(t)}),this.register(function(t){return new yM(t)}),this.register(function(t){return new kM(t)}),this.register(function(t){return new QM(t)})}load(e,t,i,r){const s=this;let a;if(this.resourcePath!=="")a=this.resourcePath;else if(this.path!==""){const c=Ns.extractUrlBase(e);a=Ns.resolveURL(c,this.path)}else a=Ns.extractUrlBase(e);this.manager.itemStart(e);const o=function(c){r?r(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new Us(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,a,function(u){t(u),s.manager.itemEnd(e)},o)}catch(u){o(u)}},i,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,r){let s;const a={},o={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===eA){try{a[Xe.KHR_BINARY_GLTF]=new HM(e)}catch(h){r&&r(h);return}s=JSON.parse(a[Xe.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new eI(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[h.name]=h,a[h.name]=!0}if(s.extensionsUsed)for(let u=0;u<s.extensionsUsed.length;++u){const h=s.extensionsUsed[u],d=s.extensionsRequired||[];switch(h){case Xe.KHR_MATERIALS_UNLIT:a[h]=new MM;break;case Xe.KHR_DRACO_MESH_COMPRESSION:a[h]=new GM(s,this.dracoLoader);break;case Xe.KHR_TEXTURE_TRANSFORM:a[h]=new VM;break;case Xe.KHR_MESH_QUANTIZATION:a[h]=new zM;break;default:d.indexOf(h)>=0&&o[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(a),c.setPlugins(o),c.parse(i,r)}parseAsync(e,t){const i=this;return new Promise(function(r,s){i.parse(e,t,r,s)})}}function xM(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}const Xe={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class yM{constructor(e){this.parser=e,this.name=Xe.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){const s=t[i];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){const t=this.parser,i="light:"+e;let r=t.cache.get(i);if(r)return r;const s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e];let c;const u=new be(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],Qt);const h=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new cp(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new SE(u),c.distance=h;break;case"spot":c=new ME(u),c.distance=h,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),Cn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),r=Promise.resolve(c),t.cache.add(i,r),r}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,i=this.parser,s=i.json.nodes[e],o=(s.extensions&&s.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return i._getNodeRef(t.cache,o,l)})}}class MM{constructor(){this.name=Xe.KHR_MATERIALS_UNLIT}getMaterialType(){return Kt}extendParams(e,t,i){const r=[];e.color=new be(1,1,1),e.opacity=1;const s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){const a=s.baseColorFactor;e.color.setRGB(a[0],a[1],a[2],Qt),e.opacity=a[3]}s.baseColorTexture!==void 0&&r.push(i.assignTexture(e,"map",s.baseColorTexture,Ct))}return Promise.all(r)}}class IM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name].emissiveStrength;return s!==void 0&&(t.emissiveIntensity=s),Promise.resolve()}}class SM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];if(a.clearcoatFactor!==void 0&&(t.clearcoat=a.clearcoatFactor),a.clearcoatTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatMap",a.clearcoatTexture)),a.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=a.clearcoatRoughnessFactor),a.clearcoatRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatRoughnessMap",a.clearcoatRoughnessTexture)),a.clearcoatNormalTexture!==void 0&&(s.push(i.assignTexture(t,"clearcoatNormalMap",a.clearcoatNormalTexture)),a.clearcoatNormalTexture.scale!==void 0)){const o=a.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new we(o,o)}return Promise.all(s)}}class CM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_DISPERSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.dispersion=s.dispersion!==void 0?s.dispersion:0,Promise.resolve()}}class wM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.iridescenceFactor!==void 0&&(t.iridescence=a.iridescenceFactor),a.iridescenceTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceMap",a.iridescenceTexture)),a.iridescenceIor!==void 0&&(t.iridescenceIOR=a.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),a.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=a.iridescenceThicknessMinimum),a.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=a.iridescenceThicknessMaximum),a.iridescenceThicknessTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceThicknessMap",a.iridescenceThicknessTexture)),Promise.all(s)}}class TM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_SHEEN}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[];t.sheenColor=new be(0,0,0),t.sheenRoughness=0,t.sheen=1;const a=r.extensions[this.name];if(a.sheenColorFactor!==void 0){const o=a.sheenColorFactor;t.sheenColor.setRGB(o[0],o[1],o[2],Qt)}return a.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=a.sheenRoughnessFactor),a.sheenColorTexture!==void 0&&s.push(i.assignTexture(t,"sheenColorMap",a.sheenColorTexture,Ct)),a.sheenRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"sheenRoughnessMap",a.sheenRoughnessTexture)),Promise.all(s)}}class RM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.transmissionFactor!==void 0&&(t.transmission=a.transmissionFactor),a.transmissionTexture!==void 0&&s.push(i.assignTexture(t,"transmissionMap",a.transmissionTexture)),Promise.all(s)}}class BM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_VOLUME}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];t.thickness=a.thicknessFactor!==void 0?a.thicknessFactor:0,a.thicknessTexture!==void 0&&s.push(i.assignTexture(t,"thicknessMap",a.thicknessTexture)),t.attenuationDistance=a.attenuationDistance||1/0;const o=a.attenuationColor||[1,1,1];return t.attenuationColor=new be().setRGB(o[0],o[1],o[2],Qt),Promise.all(s)}}class LM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_IOR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.ior=s.ior!==void 0?s.ior:1.5,Promise.resolve()}}class DM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_SPECULAR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];t.specularIntensity=a.specularFactor!==void 0?a.specularFactor:1,a.specularTexture!==void 0&&s.push(i.assignTexture(t,"specularIntensityMap",a.specularTexture));const o=a.specularColorFactor||[1,1,1];return t.specularColor=new be().setRGB(o[0],o[1],o[2],Qt),a.specularColorTexture!==void 0&&s.push(i.assignTexture(t,"specularColorMap",a.specularColorTexture,Ct)),Promise.all(s)}}class PM{constructor(e){this.parser=e,this.name=Xe.EXT_MATERIALS_BUMP}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return t.bumpScale=a.bumpFactor!==void 0?a.bumpFactor:1,a.bumpTexture!==void 0&&s.push(i.assignTexture(t,"bumpMap",a.bumpTexture)),Promise.all(s)}}class UM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.anisotropyStrength!==void 0&&(t.anisotropy=a.anisotropyStrength),a.anisotropyRotation!==void 0&&(t.anisotropyRotation=a.anisotropyRotation),a.anisotropyTexture!==void 0&&s.push(i.assignTexture(t,"anisotropyMap",a.anisotropyTexture)),Promise.all(s)}}class NM{constructor(e){this.parser=e,this.name=Xe.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,i=t.json,r=i.textures[e];if(!r.extensions||!r.extensions[this.name])return null;const s=r.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,a)}}class FM{constructor(e){this.parser=e,this.name=Xe.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=r.images[a.source];let l=i.textureLoader;if(o.uri){const c=i.options.manager.getHandler(o.uri);c!==null&&(l=c)}return i.loadTextureImage(e,a.source,l)}}class OM{constructor(e){this.parser=e,this.name=Xe.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=r.images[a.source];let l=i.textureLoader;if(o.uri){const c=i.options.manager.getHandler(o.uri);c!==null&&(l=c)}return i.loadTextureImage(e,a.source,l)}}class kM{constructor(e){this.name=Xe.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){const t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){const r=i.extensions[this.name],s=this.parser.getDependency("buffer",r.buffer),a=this.parser.options.meshoptDecoder;if(!a||!a.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(o){const l=r.byteOffset||0,c=r.byteLength||0,u=r.count,h=r.byteStride,d=new Uint8Array(o,l,c);return a.decodeGltfBufferAsync?a.decodeGltfBufferAsync(u,h,d,r.mode,r.filter).then(function(f){return f.buffer}):a.ready.then(function(){const f=new ArrayBuffer(u*h);return a.decodeGltfBuffer(new Uint8Array(f),u,h,d,r.mode,r.filter),f})})}else return null}}class QM{constructor(e){this.name=Xe.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const r=t.meshes[i.mesh];for(const c of r.primitives)if(c.mode!==cn.TRIANGLES&&c.mode!==cn.TRIANGLE_STRIP&&c.mode!==cn.TRIANGLE_FAN&&c.mode!==void 0)return null;const a=i.extensions[this.name].attributes,o=[],l={};for(const c in a)o.push(this.parser.getDependency("accessor",a[c]).then(u=>(l[c]=u,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{const u=c.pop(),h=u.isGroup?u.children:[u],d=c[0].count,f=[];for(const g of h){const m=new De,A=new R,p=new Qe,b=new R(1,1,1),M=new iE(g.geometry,g.material,d);for(let E=0;E<d;E++)l.TRANSLATION&&A.fromBufferAttribute(l.TRANSLATION,E),l.ROTATION&&p.fromBufferAttribute(l.ROTATION,E),l.SCALE&&b.fromBufferAttribute(l.SCALE,E),M.setMatrixAt(E,m.compose(A,p,b));for(const E in l)if(E==="_COLOR_0"){const _=l[E];M.instanceColor=new Bc(_.array,_.itemSize,_.normalized)}else E!=="TRANSLATION"&&E!=="ROTATION"&&E!=="SCALE"&&g.geometry.setAttribute(E,l[E]);ct.prototype.copy.call(M,g),this.parser.assignFinalMaterial(M),f.push(M)}return u.isGroup?(u.clear(),u.add(...f),u):f[0]}))}}const eA="glTF",_s=12,Ed={JSON:1313821514,BIN:5130562};class HM{constructor(e){this.name=Xe.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,_s),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==eA)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const r=this.header.length-_s,s=new DataView(e,_s);let a=0;for(;a<r;){const o=s.getUint32(a,!0);a+=4;const l=s.getUint32(a,!0);if(a+=4,l===Ed.JSON){const c=new Uint8Array(e,_s+a,o);this.content=i.decode(c)}else if(l===Ed.BIN){const c=_s+a;this.body=e.slice(c,c+o)}a+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class GM{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=Xe.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const i=this.json,r=this.dracoLoader,s=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},c={};for(const u in a){const h=Nc[u]||u.toLowerCase();o[h]=a[u]}for(const u in e.attributes){const h=Nc[u]||u.toLowerCase();if(a[u]!==void 0){const d=i.accessors[e.attributes[u]],f=Or[d.componentType];c[h]=f.name,l[h]=d.normalized===!0}}return t.getDependency("bufferView",s).then(function(u){return new Promise(function(h,d){r.decodeDracoFile(u,function(f){for(const g in f.attributes){const m=f.attributes[g],A=l[g];A!==void 0&&(m.normalized=A)}h(f)},o,c,Qt,d)})})}}class VM{constructor(){this.name=Xe.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class zM{constructor(){this.name=Xe.KHR_MESH_QUANTIZATION}}class tA extends Zs{constructor(e,t,i,r){super(e,t,i,r)}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r*3+r;for(let a=0;a!==r;a++)t[a]=i[s+a];return t}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,u=r-t,h=(i-t)/u,d=h*h,f=d*h,g=e*c,m=g-c,A=-2*f+3*d,p=f-d,b=1-A,M=p-d+h;for(let E=0;E!==o;E++){const _=a[m+E+o],y=a[m+E+l]*u,S=a[g+E+o],C=a[g+E]*u;s[E]=b*_+M*y+A*S+p*C}return s}}const WM=new Qe;class qM extends tA{interpolate_(e,t,i,r){const s=super.interpolate_(e,t,i,r);return WM.fromArray(s).normalize().toArray(s),s}}const cn={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Or={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},vd={9728:Nt,9729:Ut,9984:Kc,9985:za,9986:Cs,9987:vn},bd={33071:Wn,33648:no,10497:Qi},Dl={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Nc={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},ii={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},jM={CUBICSPLINE:void 0,LINEAR:js,STEP:qs},Pl={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function XM(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new fu({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Yn})),n.DefaultMaterial}function vi(n,e,t){for(const i in t.extensions)n[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function Cn(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function YM(n,e,t){let i=!1,r=!1,s=!1;for(let c=0,u=e.length;c<u;c++){const h=e[c];if(h.POSITION!==void 0&&(i=!0),h.NORMAL!==void 0&&(r=!0),h.COLOR_0!==void 0&&(s=!0),i&&r&&s)break}if(!i&&!r&&!s)return Promise.resolve(n);const a=[],o=[],l=[];for(let c=0,u=e.length;c<u;c++){const h=e[c];if(i){const d=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):n.attributes.position;a.push(d)}if(r){const d=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):n.attributes.normal;o.push(d)}if(s){const d=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):n.attributes.color;l.push(d)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){const u=c[0],h=c[1],d=c[2];return i&&(n.morphAttributes.position=u),r&&(n.morphAttributes.normal=h),s&&(n.morphAttributes.color=d),n.morphTargetsRelative=!0,n})}function KM(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)n.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function JM(n){let e;const t=n.extensions&&n.extensions[Xe.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Ul(t.attributes):e=n.indices+":"+Ul(n.attributes)+":"+n.mode,n.targets!==void 0)for(let i=0,r=n.targets.length;i<r;i++)e+=":"+Ul(n.targets[i]);return e}function Ul(n){let e="";const t=Object.keys(n).sort();for(let i=0,r=t.length;i<r;i++)e+=t[i]+":"+n[t[i]]+";";return e}function Fc(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function ZM(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":n.search(/\.ktx2($|\?)/i)>0||n.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const $M=new De;class eI{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new xM,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=-1,s=!1,a=-1;if(typeof navigator<"u"){const o=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(o)===!0;const l=o.match(/Version\/(\d+)/);r=i&&l?parseInt(l[1],10):-1,s=o.indexOf("Firefox")>-1,a=s?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&r<17||s&&a<98?this.textureLoader=new bE(this.options.manager):this.textureLoader=new wE(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Us(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const i=this,r=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(a){return a._markDefs&&a._markDefs()}),Promise.all(this._invokeAll(function(a){return a.beforeRoot&&a.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(a){const o={scene:a[0][r.scene||0],scenes:a[0],animations:a[1],cameras:a[2],asset:r.asset,parser:i,userData:{}};return vi(s,o,r),Cn(o,r),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(const l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,s=t.length;r<s;r++){const a=t[r].joints;for(let o=0,l=a.length;o<l;o++)e[a[o]].isBone=!0}for(let r=0,s=e.length;r<s;r++){const a=e[r];a.mesh!==void 0&&(this._addNodeRef(this.meshCache,a.mesh),a.skin!==void 0&&(i[a.mesh].isSkinnedMesh=!0)),a.camera!==void 0&&this._addNodeRef(this.cameraCache,a.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;const r=i.clone(),s=(a,o)=>{const l=this.associations.get(a);l!=null&&this.associations.set(o,l);for(const[c,u]of a.children.entries())s(u,o.children[c])};return s(i,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const r=e(t[i]);if(r)return r}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let r=0;r<t.length;r++){const s=e(t[r]);s&&i.push(s)}return i}getDependency(e,t){const i=e+":"+t;let r=this.cache.get(i);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":r=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!r)throw new Error("Unknown type: "+e);break}this.cache.add(i,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){const i=this,r=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(s,a){return i.getDependency(e,a)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[Xe.KHR_BINARY_GLTF].body);const r=this.options;return new Promise(function(s,a){i.load(Ns.resolveURL(t.uri,r.path),s,void 0,function(){a(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){const r=t.byteLength||0,s=t.byteOffset||0;return i.slice(s,s+r)})}loadAccessor(e){const t=this,i=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){const a=Dl[r.type],o=Or[r.componentType],l=r.normalized===!0,c=new o(r.count*a);return Promise.resolve(new tt(c,a,l))}const s=[];return r.bufferView!==void 0?s.push(this.getDependency("bufferView",r.bufferView)):s.push(null),r.sparse!==void 0&&(s.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(s).then(function(a){const o=a[0],l=Dl[r.type],c=Or[r.componentType],u=c.BYTES_PER_ELEMENT,h=u*l,d=r.byteOffset||0,f=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,g=r.normalized===!0;let m,A;if(f&&f!==h){const p=Math.floor(d/f),b="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+p+":"+r.count;let M=t.cache.get(b);M||(m=new c(o,p*f,r.count*f/u),M=new wo(m,f/u),t.cache.add(b,M)),A=new Vi(M,l,d%f/u,g)}else o===null?m=new c(r.count*l):m=new c(o,d,r.count*l),A=new tt(m,l,g);if(r.sparse!==void 0){const p=Dl.SCALAR,b=Or[r.sparse.indices.componentType],M=r.sparse.indices.byteOffset||0,E=r.sparse.values.byteOffset||0,_=new b(a[1],M,r.sparse.count*p),y=new c(a[2],E,r.sparse.count*l);o!==null&&(A=new tt(A.array.slice(),A.itemSize,A.normalized)),A.normalized=!1;for(let S=0,C=_.length;S<C;S++){const v=_[S];if(A.setX(v,y[S*l]),l>=2&&A.setY(v,y[S*l+1]),l>=3&&A.setZ(v,y[S*l+2]),l>=4&&A.setW(v,y[S*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}A.normalized=g}return A})}loadTexture(e){const t=this.json,i=this.options,s=t.textures[e].source,a=t.images[s];let o=this.textureLoader;if(a.uri){const l=i.manager.getHandler(a.uri);l!==null&&(o=l)}return this.loadTextureImage(e,s,o)}loadTextureImage(e,t,i){const r=this,s=this.json,a=s.textures[e],o=s.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,i).then(function(u){u.flipY=!1,u.name=a.name||o.name||"",u.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(u.name=o.uri);const d=(s.samplers||{})[a.sampler]||{};return u.magFilter=vd[d.magFilter]||Ut,u.minFilter=vd[d.minFilter]||vn,u.wrapS=bd[d.wrapS]||Qi,u.wrapT=bd[d.wrapT]||Qi,u.generateMipmaps=!u.isCompressedTexture&&u.minFilter!==Nt&&u.minFilter!==Ut,r.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const i=this,r=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const a=r.images[e],o=self.URL||self.webkitURL;let l=a.uri||"",c=!1;if(a.bufferView!==void 0)l=i.getDependency("bufferView",a.bufferView).then(function(h){c=!0;const d=new Blob([h],{type:a.mimeType});return l=o.createObjectURL(d),l});else if(a.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(l).then(function(h){return new Promise(function(d,f){let g=d;t.isImageBitmapLoader===!0&&(g=function(m){const A=new Tt(m);A.needsUpdate=!0,d(A)}),t.load(Ns.resolveURL(h,s.path),g,void 0,f)})}).then(function(h){return c===!0&&o.revokeObjectURL(l),Cn(h,a),h.userData.mimeType=a.mimeType||ZM(a.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),h});return this.sourceCache[e]=u,u}assignTexture(e,t,i,r){const s=this;return this.getDependency("texture",i.index).then(function(a){if(!a)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(a=a.clone(),a.channel=i.texCoord),s.extensions[Xe.KHR_TEXTURE_TRANSFORM]){const o=i.extensions!==void 0?i.extensions[Xe.KHR_TEXTURE_TRANSFORM]:void 0;if(o){const l=s.associations.get(a);a=s.extensions[Xe.KHR_TEXTURE_TRANSFORM].extendTexture(a,o),s.associations.set(a,l)}}return r!==void 0&&(a.colorSpace=r),e[t]=a,a})}assignFinalMaterial(e){const t=e.geometry;let i=e.material;const r=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){const o="PointsMaterial:"+i.uuid;let l=this.cache.get(o);l||(l=new uu,nn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(o,l)),i=l}else if(e.isLine){const o="LineBasicMaterial:"+i.uuid;let l=this.cache.get(o);l||(l=new ji,nn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(o,l)),i=l}if(r||s||a){let o="ClonedMaterial:"+i.uuid+":";r&&(o+="derivative-tangents:"),s&&(o+="vertex-colors:"),a&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=i.clone(),s&&(l.vertexColors=!0),a&&(l.flatShading=!0),r&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return fu}loadMaterial(e){const t=this,i=this.json,r=this.extensions,s=i.materials[e];let a;const o={},l=s.extensions||{},c=[];if(l[Xe.KHR_MATERIALS_UNLIT]){const h=r[Xe.KHR_MATERIALS_UNLIT];a=h.getMaterialType(),c.push(h.extendParams(o,s,t))}else{const h=s.pbrMetallicRoughness||{};if(o.color=new be(1,1,1),o.opacity=1,Array.isArray(h.baseColorFactor)){const d=h.baseColorFactor;o.color.setRGB(d[0],d[1],d[2],Qt),o.opacity=d[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",h.baseColorTexture,Ct)),o.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,o.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",h.metallicRoughnessTexture))),a=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,o)})))}s.doubleSided===!0&&(o.side=tn);const u=s.alphaMode||Pl.OPAQUE;if(u===Pl.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,u===Pl.MASK&&(o.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&a!==Kt&&(c.push(t.assignTexture(o,"normalMap",s.normalTexture)),o.normalScale=new we(1,1),s.normalTexture.scale!==void 0)){const h=s.normalTexture.scale;o.normalScale.set(h,h)}if(s.occlusionTexture!==void 0&&a!==Kt&&(c.push(t.assignTexture(o,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&a!==Kt){const h=s.emissiveFactor;o.emissive=new be().setRGB(h[0],h[1],h[2],Qt)}return s.emissiveTexture!==void 0&&a!==Kt&&c.push(t.assignTexture(o,"emissiveMap",s.emissiveTexture,Ct)),Promise.all(c).then(function(){const h=new a(o);return s.name&&(h.name=s.name),Cn(h,s),t.associations.set(h,{materials:e}),s.extensions&&vi(r,h,s),h})}createUniqueName(e){const t=rt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,i=this.extensions,r=this.primitiveCache;function s(o){return i[Xe.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return xd(l,o,t)})}const a=[];for(let o=0,l=e.length;o<l;o++){const c=e[o],u=JM(c),h=r[u];if(h)a.push(h.promise);else{let d;c.extensions&&c.extensions[Xe.KHR_DRACO_MESH_COMPRESSION]?d=s(c):d=xd(new dt,c,t),r[u]={primitive:c,promise:d},a.push(d)}}return Promise.all(a)}loadMesh(e){const t=this,i=this.json,r=this.extensions,s=i.meshes[e],a=s.primitives,o=[];for(let l=0,c=a.length;l<c;l++){const u=a[l].material===void 0?XM(this.cache):this.getDependency("material",a[l].material);o.push(u)}return o.push(t.loadGeometries(a)),Promise.all(o).then(function(l){const c=l.slice(0,l.length-1),u=l[l.length-1],h=[];for(let f=0,g=u.length;f<g;f++){const m=u[f],A=a[f];let p;const b=c[f];if(A.mode===cn.TRIANGLES||A.mode===cn.TRIANGLE_STRIP||A.mode===cn.TRIANGLE_FAN||A.mode===void 0)p=s.isSkinnedMesh===!0?new Zf(m,b):new Ke(m,b),p.isSkinnedMesh===!0&&p.normalizeSkinWeights(),A.mode===cn.TRIANGLE_STRIP?p.geometry=_d(p.geometry,Of):A.mode===cn.TRIANGLE_FAN&&(p.geometry=_d(p.geometry,wc));else if(A.mode===cn.LINES)p=new Js(m,b);else if(A.mode===cn.LINE_STRIP)p=new To(m,b);else if(A.mode===cn.LINE_LOOP)p=new oE(m,b);else if(A.mode===cn.POINTS)p=new ep(m,b);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+A.mode);Object.keys(p.geometry.morphAttributes).length>0&&KM(p,s),p.name=t.createUniqueName(s.name||"mesh_"+e),Cn(p,s),A.extensions&&vi(r,p,A),t.assignFinalMaterial(p),h.push(p)}for(let f=0,g=h.length;f<g;f++)t.associations.set(h[f],{meshes:e,primitives:f});if(h.length===1)return s.extensions&&vi(r,h[0],s),h[0];const d=new mt;s.extensions&&vi(r,d,s),t.associations.set(d,{meshes:e});for(let f=0,g=h.length;f<g;f++)d.add(h[f]);return d})}loadCamera(e){let t;const i=this.json.cameras[e],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new Wt(Mt.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new Po(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),Cn(t,i),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],i=[];for(let r=0,s=t.joints.length;r<s;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){const s=r.pop(),a=r,o=[],l=[];for(let c=0,u=a.length;c<u;c++){const h=a[c];if(h){o.push(h);const d=new De;s!==null&&d.fromArray(s.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Xr(o,l)})}loadAnimation(e){const t=this.json,i=this,r=t.animations[e],s=r.name?r.name:"animation_"+e,a=[],o=[],l=[],c=[],u=[];for(let h=0,d=r.channels.length;h<d;h++){const f=r.channels[h],g=r.samplers[f.sampler],m=f.target,A=m.node,p=r.parameters!==void 0?r.parameters[g.input]:g.input,b=r.parameters!==void 0?r.parameters[g.output]:g.output;m.node!==void 0&&(a.push(this.getDependency("node",A)),o.push(this.getDependency("accessor",p)),l.push(this.getDependency("accessor",b)),c.push(g),u.push(m))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(h){const d=h[0],f=h[1],g=h[2],m=h[3],A=h[4],p=[];for(let M=0,E=d.length;M<E;M++){const _=d[M],y=f[M],S=g[M],C=m[M],v=A[M];if(_===void 0)continue;_.updateMatrix&&_.updateMatrix();const x=i._createAnimationTracks(_,y,S,C,v);if(x)for(let T=0;T<x.length;T++)p.push(x[T])}const b=new go(s,void 0,p);return Cn(b,r),b})}createNodeMesh(e){const t=this.json,i=this,r=t.nodes[e];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(s){const a=i._getNodeRef(i.meshCache,r.mesh,s);return r.weights!==void 0&&a.traverse(function(o){if(o.isMesh)for(let l=0,c=r.weights.length;l<c;l++)o.morphTargetInfluences[l]=r.weights[l]}),a})}loadNode(e){const t=this.json,i=this,r=t.nodes[e],s=i._loadNodeShallow(e),a=[],o=r.children||[];for(let c=0,u=o.length;c<u;c++)a.push(i.getDependency("node",o[c]));const l=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([s,Promise.all(a),l]).then(function(c){const u=c[0],h=c[1],d=c[2];d!==null&&u.traverse(function(f){f.isSkinnedMesh&&f.bind(d,$M)});for(let f=0,g=h.length;f<g;f++)u.add(h[f]);return u})}_loadNodeShallow(e){const t=this.json,i=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const s=t.nodes[e],a=s.name?r.createUniqueName(s.name):"",o=[],l=r._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),s.camera!==void 0&&o.push(r.getDependency("camera",s.camera).then(function(c){return r._getNodeRef(r.cameraCache,s.camera,c)})),r._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let u;if(s.isBone===!0?u=new $f:c.length>1?u=new mt:c.length===1?u=c[0]:u=new ct,u!==c[0])for(let h=0,d=c.length;h<d;h++)u.add(c[h]);if(s.name&&(u.userData.name=s.name,u.name=a),Cn(u,s),s.extensions&&vi(i,u,s),s.matrix!==void 0){const h=new De;h.fromArray(s.matrix),u.applyMatrix4(h)}else s.translation!==void 0&&u.position.fromArray(s.translation),s.rotation!==void 0&&u.quaternion.fromArray(s.rotation),s.scale!==void 0&&u.scale.fromArray(s.scale);if(!r.associations.has(u))r.associations.set(u,{});else if(s.mesh!==void 0&&r.meshCache.refs[s.mesh]>1){const h=r.associations.get(u);r.associations.set(u,{...h})}return r.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){const t=this.extensions,i=this.json.scenes[e],r=this,s=new mt;i.name&&(s.name=r.createUniqueName(i.name)),Cn(s,i),i.extensions&&vi(t,s,i);const a=i.nodes||[],o=[];for(let l=0,c=a.length;l<c;l++)o.push(r.getDependency("node",a[l]));return Promise.all(o).then(function(l){for(let u=0,h=l.length;u<h;u++)s.add(l[u]);const c=u=>{const h=new Map;for(const[d,f]of r.associations)(d instanceof nn||d instanceof Tt)&&h.set(d,f);return u.traverse(d=>{const f=r.associations.get(d);f!=null&&h.set(d,f)}),h};return r.associations=c(s),s})}_createAnimationTracks(e,t,i,r,s){const a=[],o=e.name?e.name:e.uuid,l=[];ii[s.path]===ii.weights?e.traverse(function(d){d.morphTargetInfluences&&l.push(d.name?d.name:d.uuid)}):l.push(o);let c;switch(ii[s.path]){case ii.weights:c=qr;break;case ii.rotation:c=zi;break;case ii.translation:case ii.scale:c=Wi;break;default:switch(i.itemSize){case 1:c=qr;break;case 2:case 3:default:c=Wi;break}break}const u=r.interpolation!==void 0?jM[r.interpolation]:js,h=this._getArrayFromAccessor(i);for(let d=0,f=l.length;d<f;d++){const g=new c(l[d]+"."+ii[s.path],t.array,h,u);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(g),a.push(g)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const i=Fc(t.constructor),r=new Float32Array(t.length);for(let s=0,a=t.length;s<a;s++)r[s]=t[s]*i;t=r}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){const r=this instanceof zi?qM:tA;return new r(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function tI(n,e,t){const i=e.attributes,r=new xn;if(i.POSITION!==void 0){const o=t.json.accessors[i.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(r.set(new R(l[0],l[1],l[2]),new R(c[0],c[1],c[2])),o.normalized){const u=Fc(Or[o.componentType]);r.min.multiplyScalar(u),r.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=e.targets;if(s!==void 0){const o=new R,l=new R;for(let c=0,u=s.length;c<u;c++){const h=s[c];if(h.POSITION!==void 0){const d=t.json.accessors[h.POSITION],f=d.min,g=d.max;if(f!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(f[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(f[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(f[2]),Math.abs(g[2]))),d.normalized){const m=Fc(Or[d.componentType]);l.multiplyScalar(m)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(o)}n.boundingBox=r;const a=new Dn;r.getCenter(a.center),a.radius=r.min.distanceTo(r.max)/2,n.boundingSphere=a}function xd(n,e,t){const i=e.attributes,r=[];function s(a,o){return t.getDependency("accessor",a).then(function(l){n.setAttribute(o,l)})}for(const a in i){const o=Nc[a]||a.toLowerCase();o in n.attributes||r.push(s(i[a],o))}if(e.indices!==void 0&&!n.index){const a=t.getDependency("accessor",e.indices).then(function(o){n.setIndex(o)});r.push(a)}return Je.workingColorSpace!==Qt&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Je.workingColorSpace}" not supported.`),Cn(n,e),tI(n,e,t),Promise.all(r).then(function(){return e.targets!==void 0?YM(n,e.targets,t):n})}var nI=(function(){var n="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:q:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq;w8Wqdbk;esezu8Jjjjjbcj;eb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Radz1jjjbhwcj;abad9Uc;WFbGgocjdaocjd6EhDaicefhocbhqdnindndndnaeaq9nmbaDaeaq9RaqaDfae6Egkcsfglcl4cifcd4hxalc9WGgmTmecbhPawcjdfhsaohzinaraz9Rax6mvarazaxfgo9RcK6mvczhlcbhHinalgic9WfgOawcj;cbffhldndndndndnazaOco4fRbbaHcoG4ciGPlbedibkal9cb83ibalcwf9cb83ibxikalaoRblaoRbbgOco4gAaAciSgAE86bbawcj;cbfaifglcGfaoclfaAfgARbbaOcl4ciGgCaCciSgCE86bbalcVfaAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc7faAaCfgARbbaOciGgOaOciSgOE86bbalctfaAaOfgARbbaoRbegOco4gCaCciSgCE86bbalc91faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc4faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc93faAaCfgARbbaOciGgOaOciSgOE86bbalc94faAaOfgARbbaoRbdgOco4gCaCciSgCE86bbalc95faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc96faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc97faAaCfgARbbaOciGgOaOciSgOE86bbalc98faAaOfgORbbaoRbigoco4gAaAciSgAE86bbalc99faOaAfgORbbaocl4ciGgAaAciSgAE86bbalc9:faOaAfgORbbaocd4ciGgAaAciSgAE86bbalcufaOaAfglRbbaociGgoaociSgoE86bbalaofhoxdkalaoRbwaoRbbgOcl4gAaAcsSgAE86bbawcj;cbfaifglcGfaocwfaAfgARbbaOcsGgOaOcsSgOE86bbalcVfaAaOfgORbbaoRbegAcl4gCaCcsSgCE86bbalc7faOaCfgORbbaAcsGgAaAcsSgAE86bbalctfaOaAfgORbbaoRbdgAcl4gCaCcsSgCE86bbalc91faOaCfgORbbaAcsGgAaAcsSgAE86bbalc4faOaAfgORbbaoRbigAcl4gCaCcsSgCE86bbalc93faOaCfgORbbaAcsGgAaAcsSgAE86bbalc94faOaAfgORbbaoRblgAcl4gCaCcsSgCE86bbalc95faOaCfgORbbaAcsGgAaAcsSgAE86bbalc96faOaAfgORbbaoRbvgAcl4gCaCcsSgCE86bbalc97faOaCfgORbbaAcsGgAaAcsSgAE86bbalc98faOaAfgORbbaoRbogAcl4gCaCcsSgCE86bbalc99faOaCfgORbbaAcsGgAaAcsSgAE86bbalc9:faOaAfgORbbaoRbrgocl4gAaAcsSgAE86bbalcufaOaAfglRbbaocsGgoaocsSgoE86bbalaofhoxekalao8Pbb83bbalcwfaocwf8Pbb83bbaoczfhokdnaiam9pmbaHcdfhHaiczfhlarao9RcL0mekkaiam6mvaoTmvdnakTmbawaPfRbbhHawcj;cbfhlashiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkkascefhsaohzaPcefgPad9hmbxikkcbc99arao9Radcaadca0ESEhoxlkaoaxad2fhCdnakmbadhlinaoTmlarao9Rax6mlaoaxfhoalcufglmbkaChoxekcbhmawcjdfhAinarao9Rax6miawamfRbbhHawcj;cbfhlaAhiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkaAcefhAaoaxfhoamcefgmad9hmbkaChokabaqad2fawcjdfakad2z1jjjb8Aawawcjdfakcufad2fadz1jjjb8Aakaqfhqaombkc9:hoxekc9:hokavcj;ebf8Kjjjjbaok;cseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkkkebcjwklzNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq:p9sqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:N8JlHud97euo978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Rad;8qbbcj;abad9UhlaicefhodnaeTmbadTmbalc;WFbGglcjdalcjd6EhwcbhDinawaeaD9RaDawfae6Egqcsfglc9WGgkci2hxakcethmalcl4cifcd4hPabaDad2fhsakc;ab6hzcbhHincbhOaohAdndninaraA9RaP6meavcj;cbfaOak2fhCaAaPfhocbhidnazmbarao9Rc;Gb6mbcbhlinaCalfhidndndndndnaAalco4fRbbgXciGPlbedibkaipxbbbbbbbbbbbbbbbbpklbxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklbaoczfhokdndndndndnaXcd4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklzxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklzaoczfhokdndndndndnaXcl4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklaxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklaaoczfhokdndndndndnaXco4Plbedibkaipxbbbbbbbbbbbbbbbbpkl8WxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaoclfaYpQbfaXc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaocwfaYpQbfaXc:q:yjjbfRbbfhoxekaiaopbbbpkl8Waoczfhokalc;abfhialcjefak0meaihlarao9Rc;Fb0mbkkdnaiak9pmbaici4hlinarao9RcK6miaCaifhXdndndndndnaAaico4fRbbalcoG4ciGPlbedibkaXpxbbbbbbbbbbbbbbbbpkbbxikaXaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaXaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaXaopbbbpkbbaoczfhokalcdfhlaiczfgiak6mbkkaoTmeaohAaOcefgOclSmdxbkkc9:hoxlkdnakTmbavcjdfaHfhiavaHfpbdbhYcbhXinaiavcj;cbfaXfglpblbgLcep9TaLpxeeeeeeeeeeeeeeeegQp9op9Hp9rgLalakfpblbg8Acep9Ta8AaQp9op9Hp9rg8ApmbzeHdOiAlCvXoQrLgEalamfpblbg3cep9Ta3aQp9op9Hp9rg3alaxfpblbg5cep9Ta5aQp9op9Hp9rg5pmbzeHdOiAlCvXoQrLg8EpmbezHdiOAlvCXorQLgQaQpmbedibedibedibediaYp9UgYp9AdbbaiadfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaEa8EpmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwKDYq8AkEx3m5P8Es8FgLa3a5pmwKDYq8AkEx3m5P8Es8Fg8ApmbezHdiOAlvCXorQLgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfhiaXczfgXak6mbkkaHclfgHad6mbkasavcjdfaqad2;8qbbavavcjdfaqcufad2fad;8qbbaqaDfgDae6mbkkcbc99arao9Radcaadca0ESEhokavcj;kbf8Kjjjjbaokwbz:bjjjbk::seHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:wPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiaeciGgvcitgdfcbcaad9R;8kbaiabalcitfglad;8qbbdnavTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkalaiad;8qbbkk;4wllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiaeciGgvcitgofcbcaao9R;8kbaiabalcitfgwao;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkawaiao;8qbbkk:Pddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaialciGgecdtgdVcbc;abad9R;8kbaiabavcdtfgvad;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkavaiad;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",t=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),i=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r=WebAssembly.validate(t)?o(e):o(n),s,a=WebAssembly.instantiate(r,{}).then(function(p){s=p.instance,s.exports.__wasm_call_ctors()});function o(p){for(var b=new Uint8Array(p.length),M=0;M<p.length;++M){var E=p.charCodeAt(M);b[M]=E>96?E-97:E>64?E-39:E+4}for(var _=0,M=0;M<p.length;++M)b[_++]=b[M]<60?i[b[M]]:(b[M]-60)*64+b[++M];return b.buffer.slice(0,_)}function l(p,b,M,E,_,y,S){var C=p.exports.sbrk,v=E+3&-4,x=C(v*_),T=C(y.length),D=new Uint8Array(p.exports.memory.buffer);D.set(y,T);var U=b(x,E,_,T,y.length);if(U==0&&S&&S(x,v,_),M.set(D.subarray(x,x+E*_)),C(x-C(0)),U!=0)throw new Error("Malformed buffer data: "+U)}var c={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},u={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},h=[],d=0;function f(p){var b={object:new Worker(p),pending:0,requests:{}};return b.object.onmessage=function(M){var E=M.data;b.pending-=E.count,b.requests[E.id][E.action](E.value),delete b.requests[E.id]},b}function g(p){for(var b="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(r)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+A.name+";"+l.toString()+A.toString(),M=new Blob([b],{type:"text/javascript"}),E=URL.createObjectURL(M),_=h.length;_<p;++_)h[_]=f(E);for(var _=p;_<h.length;++_)h[_].object.postMessage({});h.length=p,URL.revokeObjectURL(E)}function m(p,b,M,E,_){for(var y=h[0],S=1;S<h.length;++S)h[S].pending<y.pending&&(y=h[S]);return new Promise(function(C,v){var x=new Uint8Array(M),T=++d;y.pending+=p,y.requests[T]={resolve:C,reject:v},y.object.postMessage({id:T,count:p,size:b,source:x,mode:E,filter:_},[x.buffer])})}function A(p){var b=p.data;if(!b.id)return self.close();self.ready.then(function(M){try{var E=new Uint8Array(b.count*b.size);l(M,M.exports[b.mode],E,b.count,b.size,b.source,M.exports[b.filter]),self.postMessage({id:b.id,count:b.count,action:"resolve",value:E},[E.buffer])}catch(_){self.postMessage({id:b.id,count:b.count,action:"reject",value:_})}})}return{ready:a,supported:!0,useWorkers:function(p){g(p)},decodeVertexBuffer:function(p,b,M,E,_){l(s,s.exports.meshopt_decodeVertexBuffer,p,b,M,E,s.exports[c[_]])},decodeIndexBuffer:function(p,b,M,E){l(s,s.exports.meshopt_decodeIndexBuffer,p,b,M,E)},decodeIndexSequence:function(p,b,M,E){l(s,s.exports.meshopt_decodeIndexSequence,p,b,M,E)},decodeGltfBuffer:function(p,b,M,E,_,y){l(s,s.exports[u[_]],p,b,M,E,s.exports[c[y]])},decodeGltfBufferAsync:function(p,b,M,E,_){return h.length>0?m(p,b,M,u[E],c[_]):a.then(function(){var y=new Uint8Array(p*b);return l(s,s.exports[u[E]],y,p,b,M,s.exports[c[_]]),y})}}})();/*!
 * @pixiv/three-vrm v3.5.5
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */var Na=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),et=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),yd=class extends ct{constructor(n){super(),this.weight=0,this.isBinary=!1,this.overrideBlink="none",this.overrideLookAt="none",this.overrideMouth="none",this._binds=[],this.name=`VRMExpression_${n}`,this.expressionName=n,this.type="VRMExpression",this.visible=!1}get binds(){return this._binds}get overrideBlinkAmount(){return this.overrideBlink==="block"?0<this.outputWeight?1:0:this.overrideBlink==="blend"?this.outputWeight:0}get overrideLookAtAmount(){return this.overrideLookAt==="block"?0<this.outputWeight?1:0:this.overrideLookAt==="blend"?this.outputWeight:0}get overrideMouthAmount(){return this.overrideMouth==="block"?0<this.outputWeight?1:0:this.overrideMouth==="blend"?this.outputWeight:0}get outputWeight(){return this.isBinary?this.weight>.5?1:0:this.weight}addBind(n){this._binds.push(n)}deleteBind(n){const e=this._binds.indexOf(n);e>=0&&this._binds.splice(e,1)}applyWeight(n){var e;let t=this.outputWeight;t*=(e=n==null?void 0:n.multiplier)!=null?e:1,this.isBinary&&t<1&&(t=0),this._binds.forEach(i=>i.applyWeight(t))}clearAppliedWeight(){this._binds.forEach(n=>n.clearAppliedWeight())}};function nA(n,e,t){var i,r;const s=n.parser.json,a=(i=s.nodes)==null?void 0:i[e];if(a==null)return console.warn(`extractPrimitivesInternal: Attempt to use nodes[${e}] of glTF but the node doesn't exist`),null;const o=a.mesh;if(o==null)return null;const l=(r=s.meshes)==null?void 0:r[o];if(l==null)return console.warn(`extractPrimitivesInternal: Attempt to use meshes[${o}] of glTF but the mesh doesn't exist`),null;const c=l.primitives.length,u=[];return t.traverse(h=>{u.length<c&&h.isMesh&&u.push(h)}),u}function Md(n,e){return et(this,null,function*(){const t=yield n.parser.getDependency("node",e);return nA(n,e,t)})}function Id(n){return et(this,null,function*(){const e=yield n.parser.getDependencies("node"),t=new Map;return e.forEach((i,r)=>{const s=nA(n,r,i);s!=null&&t.set(r,s)}),t})}var Oc={Aa:"aa",Ih:"ih",Ou:"ou",Ee:"ee",Oh:"oh",Blink:"blink",Happy:"happy",Angry:"angry",Sad:"sad",Relaxed:"relaxed",LookUp:"lookUp",Surprised:"surprised",LookDown:"lookDown",LookLeft:"lookLeft",LookRight:"lookRight",BlinkLeft:"blinkLeft",BlinkRight:"blinkRight",Neutral:"neutral"};function iA(n){return Math.max(Math.min(n,1),0)}var Sd=class rA{constructor(){this.blinkExpressionNames=["blink","blinkLeft","blinkRight"],this.lookAtExpressionNames=["lookLeft","lookRight","lookUp","lookDown"],this.mouthExpressionNames=["aa","ee","ih","oh","ou"],this._expressions=[],this._expressionMap={}}get expressions(){return this._expressions.concat()}get expressionMap(){return Object.assign({},this._expressionMap)}get presetExpressionMap(){const e={},t=new Set(Object.values(Oc));return Object.entries(this._expressionMap).forEach(([i,r])=>{t.has(i)&&(e[i]=r)}),e}get customExpressionMap(){const e={},t=new Set(Object.values(Oc));return Object.entries(this._expressionMap).forEach(([i,r])=>{t.has(i)||(e[i]=r)}),e}copy(e){return this._expressions.concat().forEach(i=>{this.unregisterExpression(i)}),e._expressions.forEach(i=>{this.registerExpression(i)}),this.blinkExpressionNames=e.blinkExpressionNames.concat(),this.lookAtExpressionNames=e.lookAtExpressionNames.concat(),this.mouthExpressionNames=e.mouthExpressionNames.concat(),this}clone(){return new rA().copy(this)}getExpression(e){var t;return(t=this._expressionMap[e])!=null?t:null}registerExpression(e){this._expressions.push(e),this._expressionMap[e.expressionName]=e}unregisterExpression(e){const t=this._expressions.indexOf(e);t===-1&&console.warn("VRMExpressionManager: The specified expressions is not registered"),this._expressions.splice(t,1),delete this._expressionMap[e.expressionName]}getValue(e){var t;const i=this.getExpression(e);return(t=i==null?void 0:i.weight)!=null?t:null}setValue(e,t){const i=this.getExpression(e);i&&(i.weight=iA(t))}resetValues(){this._expressions.forEach(e=>{e.weight=0})}getExpressionTrackName(e){const t=this.getExpression(e);return t?`${t.name}.weight`:null}update(){const e=this._calculateWeightMultipliers();this._expressions.forEach(t=>{t.clearAppliedWeight()}),this._expressions.forEach(t=>{let i=1;const r=t.expressionName;this.blinkExpressionNames.indexOf(r)!==-1&&(i*=e.blink),this.lookAtExpressionNames.indexOf(r)!==-1&&(i*=e.lookAt),this.mouthExpressionNames.indexOf(r)!==-1&&(i*=e.mouth),t.applyWeight({multiplier:i})})}_calculateWeightMultipliers(){let e=1,t=1,i=1;return this._expressions.forEach(r=>{e-=r.overrideBlinkAmount,t-=r.overrideLookAtAmount,i-=r.overrideMouthAmount}),e=Math.max(0,e),t=Math.max(0,t),i=Math.max(0,i),{blink:e,lookAt:t,mouth:i}}},Es={Color:"color",EmissionColor:"emissionColor",ShadeColor:"shadeColor",RimColor:"rimColor",OutlineColor:"outlineColor"},iI={_Color:Es.Color,_EmissionColor:Es.EmissionColor,_ShadeColor:Es.ShadeColor,_RimColor:Es.RimColor,_OutlineColor:Es.OutlineColor},rI=new be,sA=class aA{constructor({material:e,type:t,targetValue:i,targetAlpha:r}){this.material=e,this.type=t,this.targetValue=i,this.targetAlpha=r??1;const s=this._initColorBindState(),a=this._initAlphaBindState();this._state={color:s,alpha:a}}applyWeight(e){const{color:t,alpha:i}=this._state;if(t!=null){const{propertyName:r,deltaValue:s}=t,a=this.material[r];a!=null&&a.add(rI.copy(s).multiplyScalar(e))}if(i!=null){const{propertyName:r,deltaValue:s}=i;this.material[r]!=null&&(this.material[r]+=s*e)}}clearAppliedWeight(){const{color:e,alpha:t}=this._state;if(e!=null){const{propertyName:i,initialValue:r}=e,s=this.material[i];s!=null&&s.copy(r)}if(t!=null){const{propertyName:i,initialValue:r}=t;this.material[i]!=null&&(this.material[i]=r)}}_initColorBindState(){var e,t,i;const{material:r,type:s,targetValue:a}=this,o=this._getPropertyNameMap(),l=(t=(e=o==null?void 0:o[s])==null?void 0:e[0])!=null?t:null;if(l==null)return console.warn(`Tried to add a material color bind to the material ${(i=r.name)!=null?i:"(no name)"}, the type ${s} but the material or the type is not supported.`),null;const u=r[l].clone(),h=new be(a.r-u.r,a.g-u.g,a.b-u.b);return{propertyName:l,initialValue:u,deltaValue:h}}_initAlphaBindState(){var e,t,i;const{material:r,type:s,targetAlpha:a}=this,o=this._getPropertyNameMap(),l=(t=(e=o==null?void 0:o[s])==null?void 0:e[1])!=null?t:null;if(l==null&&a!==1)return console.warn(`Tried to add a material alpha bind to the material ${(i=r.name)!=null?i:"(no name)"}, the type ${s} but the material or the type does not support alpha.`),null;if(l==null)return null;const c=r[l],u=a-c;return{propertyName:l,initialValue:c,deltaValue:u}}_getPropertyNameMap(){var e,t;return(t=(e=Object.entries(aA._propertyNameMapMap).find(([i])=>this.material[i]===!0))==null?void 0:e[1])!=null?t:null}};sA._propertyNameMapMap={isMeshStandardMaterial:{color:["color","opacity"],emissionColor:["emissive",null]},isMeshBasicMaterial:{color:["color","opacity"]},isMToonMaterial:{color:["color","opacity"],emissionColor:["emissive",null],outlineColor:["outlineColorFactor",null],matcapColor:["matcapFactor",null],rimColor:["parametricRimColorFactor",null],shadeColor:["shadeColorFactor",null]}};var Cd=sA,Eo=class{constructor({primitives:n,index:e,weight:t}){this.primitives=n,this.index=e,this.weight=t}applyWeight(n){this.primitives.forEach(e=>{var t;((t=e.morphTargetInfluences)==null?void 0:t[this.index])!=null&&(e.morphTargetInfluences[this.index]+=this.weight*n)})}clearAppliedWeight(){this.primitives.forEach(n=>{var e;((e=n.morphTargetInfluences)==null?void 0:e[this.index])!=null&&(n.morphTargetInfluences[this.index]=0)})}},wd=new we,oA=class lA{constructor({material:e,scale:t,offset:i}){var r,s;this.material=e,this.scale=t,this.offset=i;const a=(r=Object.entries(lA._propertyNamesMap).find(([o])=>e[o]===!0))==null?void 0:r[1];a==null?(console.warn(`Tried to add a texture transform bind to the material ${(s=e.name)!=null?s:"(no name)"} but the material is not supported.`),this._properties=[]):(this._properties=[],a.forEach(o=>{var l;const c=(l=e[o])==null?void 0:l.clone();if(!c)return null;e[o]=c;const u=c.offset.clone(),h=c.repeat.clone(),d=i.clone().sub(u),f=t.clone().sub(h);this._properties.push({name:o,initialOffset:u,deltaOffset:d,initialScale:h,deltaScale:f})}))}applyWeight(e){this._properties.forEach(t=>{const i=this.material[t.name];i!==void 0&&(i.offset.add(wd.copy(t.deltaOffset).multiplyScalar(e)),i.repeat.add(wd.copy(t.deltaScale).multiplyScalar(e)))})}clearAppliedWeight(){this._properties.forEach(e=>{const t=this.material[e.name];t!==void 0&&(t.offset.copy(e.initialOffset),t.repeat.copy(e.initialScale))})}};oA._propertyNamesMap={isMeshStandardMaterial:["map","emissiveMap","bumpMap","normalMap","displacementMap","roughnessMap","metalnessMap","alphaMap"],isMeshBasicMaterial:["map","specularMap","alphaMap"],isMToonMaterial:["map","normalMap","emissiveMap","shadeMultiplyTexture","rimMultiplyTexture","outlineWidthMultiplyTexture","uvAnimationMaskTexture"]};var Td=oA,sI=new Set(["1.0","1.0-beta"]),cA=class uA{get name(){return"VRMExpressionLoaderPlugin"}constructor(e){this.parser=e}afterRoot(e){return et(this,null,function*(){e.userData.vrmExpressionManager=yield this._import(e)})}_import(e){return et(this,null,function*(){const t=yield this._v1Import(e);if(t)return t;const i=yield this._v0Import(e);return i||null})}_v1Import(e){return et(this,null,function*(){var t,i;const r=this.parser.json;if(!(((t=r.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const a=(i=r.extensions)==null?void 0:i.VRMC_vrm;if(!a)return null;const o=a.specVersion;if(!sI.has(o))return console.warn(`VRMExpressionLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.expressions;if(!l)return null;const c=new Set(Object.values(Oc)),u=new Map;l.preset!=null&&Object.entries(l.preset).forEach(([d,f])=>{if(f!=null){if(!c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${d}" detected. Ignoring the expression`);return}u.set(d,f)}}),l.custom!=null&&Object.entries(l.custom).forEach(([d,f])=>{if(c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${d}". Ignoring the expression`);return}u.set(d,f)});const h=new Sd;return yield Promise.all(Array.from(u.entries()).map(d=>et(this,[d],function*([f,g]){var m,A,p,b,M,E,_;const y=new yd(f);if(e.scene.add(y),y.isBinary=(m=g.isBinary)!=null?m:!1,y.overrideBlink=(A=g.overrideBlink)!=null?A:"none",y.overrideLookAt=(p=g.overrideLookAt)!=null?p:"none",y.overrideMouth=(b=g.overrideMouth)!=null?b:"none",(M=g.morphTargetBinds)==null||M.forEach(S=>et(this,null,function*(){var C;if(S.node===void 0||S.index===void 0)return;const v=yield Md(e,S.node),x=S.index;if(!v.every(T=>Array.isArray(T.morphTargetInfluences)&&x<T.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${g.name} attempts to index morph #${x} but not found.`);return}y.addBind(new Eo({primitives:v,index:x,weight:(C=S.weight)!=null?C:1}))})),g.materialColorBinds||g.textureTransformBinds){const S=[];e.scene.traverse(C=>{const v=C.material;v&&(Array.isArray(v)?S.push(...v):S.push(v))}),(E=g.materialColorBinds)==null||E.forEach(C=>et(this,null,function*(){S.filter(x=>{var T;const D=(T=this.parser.associations.get(x))==null?void 0:T.materials;return C.material===D}).forEach(x=>{y.addBind(new Cd({material:x,type:C.type,targetValue:new be().fromArray(C.targetValue),targetAlpha:C.targetValue[3]}))})})),(_=g.textureTransformBinds)==null||_.forEach(C=>et(this,null,function*(){S.filter(x=>{var T;const D=(T=this.parser.associations.get(x))==null?void 0:T.materials;return C.material===D}).forEach(x=>{var T,D;y.addBind(new Td({material:x,offset:new we().fromArray((T=C.offset)!=null?T:[0,0]),scale:new we().fromArray((D=C.scale)!=null?D:[1,1])}))})}))}h.registerExpression(y)}))),h})}_v0Import(e){return et(this,null,function*(){var t;const i=this.parser.json,r=(t=i.extensions)==null?void 0:t.VRM;if(!r)return null;const s=r.blendShapeMaster;if(!s)return null;const a=new Sd,o=s.blendShapeGroups;if(!o)return a;const l=new Set;return yield Promise.all(o.map(c=>et(this,null,function*(){var u;const h=c.presetName,d=h!=null&&uA.v0v1PresetNameMap[h]||null,f=d??c.name;if(f==null){console.warn("VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression");return}if(l.has(f)){console.warn(`VRMExpressionLoaderPlugin: An expression preset ${h} has duplicated entries. Ignoring the expression`);return}l.add(f);const g=new yd(f);e.scene.add(g),g.isBinary=(u=c.isBinary)!=null?u:!1,c.binds&&c.binds.forEach(A=>et(this,null,function*(){var p;if(A.mesh===void 0||A.index===void 0)return;const b=[];if((p=i.nodes)==null||p.forEach((E,_)=>{E.mesh===A.mesh&&b.push(_)}),b.length===0){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to bind a morph target to the mesh #${A.mesh} but the mesh is not found or not used in the scene. Ignoring the bind.`);return}const M=A.index;yield Promise.all(b.map(E=>et(this,null,function*(){var _;const y=yield Md(e,E);if(!y.every(S=>Array.isArray(S.morphTargetInfluences)&&M<S.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to index ${M}th morph but not found.`);return}g.addBind(new Eo({primitives:y,index:M,weight:.01*((_=A.weight)!=null?_:100)}))})))}));const m=c.materialValues;m&&m.length!==0&&m.forEach(A=>{if(A.materialName===void 0||A.propertyName===void 0||A.targetValue===void 0)return;const p=[];e.scene.traverse(M=>{if(M.material){const E=M.material;Array.isArray(E)?p.push(...E.filter(_=>(_.name===A.materialName||_.name===A.materialName+" (Outline)")&&p.indexOf(_)===-1)):E.name===A.materialName&&p.indexOf(E)===-1&&p.push(E)}});const b=A.propertyName;p.forEach(M=>{if(b==="_MainTex_ST"){const _=new we(A.targetValue[0],A.targetValue[1]),y=new we(A.targetValue[2],A.targetValue[3]);y.y=1-y.y-_.y,g.addBind(new Td({material:M,scale:_,offset:y}));return}const E=iI[b];if(E){g.addBind(new Cd({material:M,type:E,targetValue:new be().fromArray(A.targetValue),targetAlpha:A.targetValue[3]}));return}console.warn(b+" is not supported")})}),a.registerExpression(g)}))),a})}};cA.v0v1PresetNameMap={a:"aa",e:"ee",i:"ih",o:"oh",u:"ou",blink:"blink",joy:"happy",angry:"angry",sorrow:"sad",fun:"relaxed",lookup:"lookUp",lookdown:"lookDown",lookleft:"lookLeft",lookright:"lookRight",blink_l:"blinkLeft",blink_r:"blinkRight",neutral:"neutral"};var aI=cA,vu=class Sr{constructor(e,t){this._firstPersonOnlyLayer=Sr.DEFAULT_FIRSTPERSON_ONLY_LAYER,this._thirdPersonOnlyLayer=Sr.DEFAULT_THIRDPERSON_ONLY_LAYER,this._initializedLayers=!1,this.humanoid=e,this.meshAnnotations=t}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMFirstPerson: humanoid must be same in order to copy");return this.meshAnnotations=e.meshAnnotations.map(t=>({meshes:t.meshes.concat(),type:t.type})),this}clone(){return new Sr(this.humanoid,this.meshAnnotations).copy(this)}get firstPersonOnlyLayer(){return this._firstPersonOnlyLayer}get thirdPersonOnlyLayer(){return this._thirdPersonOnlyLayer}setup({firstPersonOnlyLayer:e=Sr.DEFAULT_FIRSTPERSON_ONLY_LAYER,thirdPersonOnlyLayer:t=Sr.DEFAULT_THIRDPERSON_ONLY_LAYER}={}){this._initializedLayers||(this._firstPersonOnlyLayer=e,this._thirdPersonOnlyLayer=t,this.meshAnnotations.forEach(i=>{i.meshes.forEach(r=>{i.type==="firstPersonOnly"?(r.layers.set(this._firstPersonOnlyLayer),r.traverse(s=>s.layers.set(this._firstPersonOnlyLayer))):i.type==="thirdPersonOnly"?(r.layers.set(this._thirdPersonOnlyLayer),r.traverse(s=>s.layers.set(this._thirdPersonOnlyLayer))):i.type==="auto"&&this._createHeadlessModel(r)})}),this._initializedLayers=!0)}_excludeTriangles(e,t,i,r){let s=0;if(t!=null&&t.length>0)for(let a=0;a<e.length;a+=3){const o=e[a],l=e[a+1],c=e[a+2],u=t[o],h=i[o];if(u[0]>0&&r.includes(h[0])||u[1]>0&&r.includes(h[1])||u[2]>0&&r.includes(h[2])||u[3]>0&&r.includes(h[3]))continue;const d=t[l],f=i[l];if(d[0]>0&&r.includes(f[0])||d[1]>0&&r.includes(f[1])||d[2]>0&&r.includes(f[2])||d[3]>0&&r.includes(f[3]))continue;const g=t[c],m=i[c];g[0]>0&&r.includes(m[0])||g[1]>0&&r.includes(m[1])||g[2]>0&&r.includes(m[2])||g[3]>0&&r.includes(m[3])||(e[s++]=o,e[s++]=l,e[s++]=c)}return s}_createErasedMesh(e,t){const i=new Zf(e.geometry.clone(),e.material);i.name=`${e.name}(erase)`,i.frustumCulled=e.frustumCulled,i.layers.set(this._firstPersonOnlyLayer);const r=i.geometry,s=r.getAttribute("skinIndex"),a=s instanceof Nh?[]:s.array,o=[];for(let m=0;m<a.length;m+=4)o.push([a[m],a[m+1],a[m+2],a[m+3]]);const l=r.getAttribute("skinWeight"),c=l instanceof Nh?[]:l.array,u=[];for(let m=0;m<c.length;m+=4)u.push([c[m],c[m+1],c[m+2],c[m+3]]);const h=r.getIndex();if(!h)throw new Error("The geometry doesn't have an index buffer");const d=Array.from(h.array),f=this._excludeTriangles(d,u,o,t),g=[];for(let m=0;m<f;m++)g[m]=d[m];return r.setIndex(g),e.onBeforeRender&&(i.onBeforeRender=e.onBeforeRender),i.bind(new Xr(e.skeleton.bones,e.skeleton.boneInverses),new De),i}_createHeadlessModelForSkinnedMesh(e,t){const i=[];if(t.skeleton.bones.forEach((s,a)=>{this._isEraseTarget(s)&&i.push(a)}),!i.length){t.layers.enable(this._thirdPersonOnlyLayer),t.layers.enable(this._firstPersonOnlyLayer);return}t.layers.set(this._thirdPersonOnlyLayer);const r=this._createErasedMesh(t,i);e.add(r)}_createHeadlessModel(e){if(e.type==="Group")if(e.layers.set(this._thirdPersonOnlyLayer),this._isEraseTarget(e))e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer));else{const t=new mt;t.name=`_headless_${e.name}`,t.layers.set(this._firstPersonOnlyLayer),e.parent.add(t),e.children.filter(i=>i.type==="SkinnedMesh").forEach(i=>{const r=i;this._createHeadlessModelForSkinnedMesh(t,r)})}else if(e.type==="SkinnedMesh"){const t=e;this._createHeadlessModelForSkinnedMesh(e.parent,t)}else this._isEraseTarget(e)&&(e.layers.set(this._thirdPersonOnlyLayer),e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer)))}_isEraseTarget(e){return e===this.humanoid.getRawBoneNode("head")?!0:e.parent?this._isEraseTarget(e.parent):!1}};vu.DEFAULT_FIRSTPERSON_ONLY_LAYER=9;vu.DEFAULT_THIRDPERSON_ONLY_LAYER=10;var Rd=vu,oI=new Set(["1.0","1.0-beta"]),lI=class{get name(){return"VRMFirstPersonLoaderPlugin"}constructor(n){this.parser=n}afterRoot(n){return et(this,null,function*(){const e=n.userData.vrmHumanoid;if(e!==null){if(e===void 0)throw new Error("VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");n.userData.vrmFirstPerson=yield this._import(n,e)}})}_import(n,e){return et(this,null,function*(){if(e==null)return null;const t=yield this._v1Import(n,e);if(t)return t;const i=yield this._v0Import(n,e);return i||null})}_v1Import(n,e){return et(this,null,function*(){var t,i;const r=this.parser.json;if(!(((t=r.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const a=(i=r.extensions)==null?void 0:i.VRMC_vrm;if(!a)return null;const o=a.specVersion;if(!oI.has(o))return console.warn(`VRMFirstPersonLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.firstPerson,c=[],u=yield Id(n);return Array.from(u.entries()).forEach(([h,d])=>{var f,g;const m=(f=l==null?void 0:l.meshAnnotations)==null?void 0:f.find(A=>A.node===h);c.push({meshes:d,type:(g=m==null?void 0:m.type)!=null?g:"auto"})}),new Rd(e,c)})}_v0Import(n,e){return et(this,null,function*(){var t;const i=this.parser.json,r=(t=i.extensions)==null?void 0:t.VRM;if(!r)return null;const s=r.firstPerson;if(!s)return null;const a=[],o=yield Id(n);return Array.from(o.entries()).forEach(([l,c])=>{const u=i.nodes[l],h=s.meshAnnotations?s.meshAnnotations.find(d=>d.mesh===u.mesh):void 0;a.push({meshes:c,type:this._convertV0FlagToV1Type(h==null?void 0:h.firstPersonFlag)})}),new Rd(e,a)})}_convertV0FlagToV1Type(n){return n==="FirstPersonOnly"?"firstPersonOnly":n==="ThirdPersonOnly"?"thirdPersonOnly":n==="Both"?"both":"auto"}},Bd=new R,Ld=new R,cI=new Qe,Dd=class extends mt{constructor(n){super(),this.vrmHumanoid=n,this._boneAxesMap=new Map,Object.values(n.humanBones).forEach(e=>{const t=new VE(1);t.matrixAutoUpdate=!1,t.material.depthTest=!1,t.material.depthWrite=!1,this.add(t),this._boneAxesMap.set(e,t)})}dispose(){Array.from(this._boneAxesMap.values()).forEach(n=>{n.geometry.dispose(),n.material.dispose()})}updateMatrixWorld(n){Array.from(this._boneAxesMap.entries()).forEach(([e,t])=>{e.node.updateWorldMatrix(!0,!1),e.node.matrixWorld.decompose(Bd,cI,Ld);const i=Bd.set(.1,.1,.1).divide(Ld);t.matrix.copy(e.node.matrixWorld).scale(i)}),super.updateMatrixWorld(n)}},Nl=["hips","spine","chest","upperChest","neck","head","leftEye","rightEye","jaw","leftUpperLeg","leftLowerLeg","leftFoot","leftToes","rightUpperLeg","rightLowerLeg","rightFoot","rightToes","leftShoulder","leftUpperArm","leftLowerArm","leftHand","rightShoulder","rightUpperArm","rightLowerArm","rightHand","leftThumbMetacarpal","leftThumbProximal","leftThumbDistal","leftIndexProximal","leftIndexIntermediate","leftIndexDistal","leftMiddleProximal","leftMiddleIntermediate","leftMiddleDistal","leftRingProximal","leftRingIntermediate","leftRingDistal","leftLittleProximal","leftLittleIntermediate","leftLittleDistal","rightThumbMetacarpal","rightThumbProximal","rightThumbDistal","rightIndexProximal","rightIndexIntermediate","rightIndexDistal","rightMiddleProximal","rightMiddleIntermediate","rightMiddleDistal","rightRingProximal","rightRingIntermediate","rightRingDistal","rightLittleProximal","rightLittleIntermediate","rightLittleDistal"],uI={hips:null,spine:"hips",chest:"spine",upperChest:"chest",neck:"upperChest",head:"neck",leftEye:"head",rightEye:"head",jaw:"head",leftUpperLeg:"hips",leftLowerLeg:"leftUpperLeg",leftFoot:"leftLowerLeg",leftToes:"leftFoot",rightUpperLeg:"hips",rightLowerLeg:"rightUpperLeg",rightFoot:"rightLowerLeg",rightToes:"rightFoot",leftShoulder:"upperChest",leftUpperArm:"leftShoulder",leftLowerArm:"leftUpperArm",leftHand:"leftLowerArm",rightShoulder:"upperChest",rightUpperArm:"rightShoulder",rightLowerArm:"rightUpperArm",rightHand:"rightLowerArm",leftThumbMetacarpal:"leftHand",leftThumbProximal:"leftThumbMetacarpal",leftThumbDistal:"leftThumbProximal",leftIndexProximal:"leftHand",leftIndexIntermediate:"leftIndexProximal",leftIndexDistal:"leftIndexIntermediate",leftMiddleProximal:"leftHand",leftMiddleIntermediate:"leftMiddleProximal",leftMiddleDistal:"leftMiddleIntermediate",leftRingProximal:"leftHand",leftRingIntermediate:"leftRingProximal",leftRingDistal:"leftRingIntermediate",leftLittleProximal:"leftHand",leftLittleIntermediate:"leftLittleProximal",leftLittleDistal:"leftLittleIntermediate",rightThumbMetacarpal:"rightHand",rightThumbProximal:"rightThumbMetacarpal",rightThumbDistal:"rightThumbProximal",rightIndexProximal:"rightHand",rightIndexIntermediate:"rightIndexProximal",rightIndexDistal:"rightIndexIntermediate",rightMiddleProximal:"rightHand",rightMiddleIntermediate:"rightMiddleProximal",rightMiddleDistal:"rightMiddleIntermediate",rightRingProximal:"rightHand",rightRingIntermediate:"rightRingProximal",rightRingDistal:"rightRingIntermediate",rightLittleProximal:"rightHand",rightLittleIntermediate:"rightLittleProximal",rightLittleDistal:"rightLittleIntermediate"};function hA(n){return n.invert?n.invert():n.inverse(),n}var bi=new R,xi=new Qe,kc=class{constructor(n){this.humanBones=n,this.restPose=this.getAbsolutePose()}getAbsolutePose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);i&&(bi.copy(i.position),xi.copy(i.quaternion),n[t]={position:bi.toArray(),rotation:xi.toArray()})}),n}getPose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);if(!i)return;bi.set(0,0,0),xi.identity();const r=this.restPose[t];r!=null&&r.position&&bi.fromArray(r.position).negate(),r!=null&&r.rotation&&hA(xi.fromArray(r.rotation)),bi.add(i.position),xi.premultiply(i.quaternion),n[t]={position:bi.toArray(),rotation:xi.toArray()}}),n}setPose(n){Object.entries(n).forEach(([e,t])=>{const i=e,r=this.getBoneNode(i);if(!r)return;const s=this.restPose[i];s&&(t!=null&&t.position&&(r.position.fromArray(t.position),s.position&&r.position.add(bi.fromArray(s.position))),t!=null&&t.rotation&&(r.quaternion.fromArray(t.rotation),s.rotation&&r.quaternion.multiply(xi.fromArray(s.rotation))))})}resetPose(){Object.entries(this.restPose).forEach(([n,e])=>{const t=this.getBoneNode(n);t&&(e!=null&&e.position&&t.position.fromArray(e.position),e!=null&&e.rotation&&t.quaternion.fromArray(e.rotation))})}getBone(n){var e;return(e=this.humanBones[n])!=null?e:void 0}getBoneNode(n){var e,t;return(t=(e=this.humanBones[n])==null?void 0:e.node)!=null?t:null}},Fl=new R,hI=new Qe,dI=new R,Pd=class dA extends kc{static _setupTransforms(e){const t=new ct;t.name="VRMHumanoidRig";const i={},r={},s={};Nl.forEach(o=>{var l;const c=e.getBoneNode(o);if(c){const u=new R,h=new Qe;c.updateWorldMatrix(!0,!1),c.matrixWorld.decompose(u,h,Fl),i[o]=u,r[o]=c.quaternion.clone();const d=new Qe;(l=c.parent)==null||l.matrixWorld.decompose(Fl,d,Fl),s[o]=d}});const a={};return Nl.forEach(o=>{var l;const c=e.getBoneNode(o);if(c){const u=i[o];let h=o,d;for(;d==null&&(h=uI[h],h!=null);)d=i[h];const f=new ct;f.name="Normalized_"+c.name,(h?(l=a[h])==null?void 0:l.node:t).add(f),f.position.copy(u),d&&f.position.sub(d),a[o]={node:f}}}),{rigBones:a,root:t,parentWorldRotations:s,boneRotations:r}}constructor(e){const{rigBones:t,root:i,parentWorldRotations:r,boneRotations:s}=dA._setupTransforms(e);super(t),this.original=e,this.root=i,this._parentWorldRotations=r,this._boneRotations=s}update(){Nl.forEach(e=>{const t=this.original.getBoneNode(e);if(t!=null){const i=this.getBoneNode(e),r=this._parentWorldRotations[e],s=hI.copy(r).invert(),a=this._boneRotations[e];if(t.quaternion.copy(i.quaternion).multiply(r).premultiply(s).multiply(a),e==="hips"){const o=i.getWorldPosition(dI);t.parent.updateWorldMatrix(!0,!1);const l=t.parent.matrixWorld,c=o.applyMatrix4(l.invert());t.position.copy(c)}}})}},Ud=class fA{get restPose(){return console.warn("VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead."),this.rawRestPose}get rawRestPose(){return this._rawHumanBones.restPose}get normalizedRestPose(){return this._normalizedHumanBones.restPose}get humanBones(){return this._rawHumanBones.humanBones}get rawHumanBones(){return this._rawHumanBones.humanBones}get normalizedHumanBones(){return this._normalizedHumanBones.humanBones}get normalizedHumanBonesRoot(){return this._normalizedHumanBones.root}constructor(e,t){var i;this.autoUpdateHumanBones=(i=t==null?void 0:t.autoUpdateHumanBones)!=null?i:!0,this._rawHumanBones=new kc(e),this._normalizedHumanBones=new Pd(this._rawHumanBones)}copy(e){return this.autoUpdateHumanBones=e.autoUpdateHumanBones,this._rawHumanBones=new kc(e.humanBones),this._normalizedHumanBones=new Pd(this._rawHumanBones),this}clone(){return new fA(this.humanBones,{autoUpdateHumanBones:this.autoUpdateHumanBones}).copy(this)}getAbsolutePose(){return console.warn("VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead."),this.getRawAbsolutePose()}getRawAbsolutePose(){return this._rawHumanBones.getAbsolutePose()}getNormalizedAbsolutePose(){return this._normalizedHumanBones.getAbsolutePose()}getPose(){return console.warn("VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead."),this.getRawPose()}getRawPose(){return this._rawHumanBones.getPose()}getNormalizedPose(){return this._normalizedHumanBones.getPose()}setPose(e){return console.warn("VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead."),this.setRawPose(e)}setRawPose(e){return this._rawHumanBones.setPose(e)}setNormalizedPose(e){return this._normalizedHumanBones.setPose(e)}resetPose(){return console.warn("VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead."),this.resetRawPose()}resetRawPose(){return this._rawHumanBones.resetPose()}resetNormalizedPose(){return this._normalizedHumanBones.resetPose()}getBone(e){return console.warn("VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead."),this.getRawBone(e)}getRawBone(e){return this._rawHumanBones.getBone(e)}getNormalizedBone(e){return this._normalizedHumanBones.getBone(e)}getBoneNode(e){return console.warn("VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead."),this.getRawBoneNode(e)}getRawBoneNode(e){return this._rawHumanBones.getBoneNode(e)}getNormalizedBoneNode(e){return this._normalizedHumanBones.getBoneNode(e)}update(){this.autoUpdateHumanBones&&this._normalizedHumanBones.update()}},fI={Hips:"hips",Spine:"spine",Head:"head",LeftUpperLeg:"leftUpperLeg",LeftLowerLeg:"leftLowerLeg",LeftFoot:"leftFoot",RightUpperLeg:"rightUpperLeg",RightLowerLeg:"rightLowerLeg",RightFoot:"rightFoot",LeftUpperArm:"leftUpperArm",LeftLowerArm:"leftLowerArm",LeftHand:"leftHand",RightUpperArm:"rightUpperArm",RightLowerArm:"rightLowerArm",RightHand:"rightHand"},pI=new Set(["1.0","1.0-beta"]),Nd={leftThumbProximal:"leftThumbMetacarpal",leftThumbIntermediate:"leftThumbProximal",rightThumbProximal:"rightThumbMetacarpal",rightThumbIntermediate:"rightThumbProximal"},AI=class{get name(){return"VRMHumanoidLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot,this.autoUpdateHumanBones=e==null?void 0:e.autoUpdateHumanBones}afterRoot(n){return et(this,null,function*(){n.userData.vrmHumanoid=yield this._import(n)})}_import(n){return et(this,null,function*(){const e=yield this._v1Import(n);if(e)return e;const t=yield this._v0Import(n);return t||null})}_v1Import(n){return et(this,null,function*(){var e,t;const i=this.parser.json;if(!(((e=i.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const s=(t=i.extensions)==null?void 0:t.VRMC_vrm;if(!s)return null;const a=s.specVersion;if(!pI.has(a))return console.warn(`VRMHumanoidLoaderPlugin: Unknown VRMC_vrm specVersion "${a}"`),null;const o=s.humanoid;if(!o)return null;const l=o.humanBones.leftThumbIntermediate!=null||o.humanBones.rightThumbIntermediate!=null,c={};o.humanBones!=null&&(yield Promise.all(Object.entries(o.humanBones).map(h=>et(this,[h],function*([d,f]){let g=d;const m=f.node;if(l){const p=Nd[g];p!=null&&(g=p)}const A=yield this.parser.getDependency("node",m);if(A==null){console.warn(`A glTF node bound to the humanoid bone ${g} (index = ${m}) does not exist`);return}c[g]={node:A}}))));const u=new Ud(this._ensureRequiredBonesExist(c),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(u.normalizedHumanBonesRoot),this.helperRoot){const h=new Dd(u);this.helperRoot.add(h),h.renderOrder=this.helperRoot.renderOrder}return u})}_v0Import(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const r=i.humanoid;if(!r)return null;const s={};r.humanBones!=null&&(yield Promise.all(r.humanBones.map(o=>et(this,null,function*(){const l=o.bone,c=o.node;if(l==null||c==null)return;if(c<0){console.warn(`A glTF node index for the humanoid bone ${l} is negative (${c}), ignoring this bone.`);return}const u=yield this.parser.getDependency("node",c);if(u==null){console.warn(`A glTF node bound to the humanoid bone ${l} (index = ${c}) does not exist`);return}const h=Nd[l],d=h??l;if(s[d]!=null){console.warn(`Multiple bone entries for ${d} detected (index = ${c}), ignoring duplicated entries.`);return}s[d]={node:u}}))));const a=new Ud(this._ensureRequiredBonesExist(s),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(a.normalizedHumanBonesRoot),this.helperRoot){const o=new Dd(a);this.helperRoot.add(o),o.renderOrder=this.helperRoot.renderOrder}return a})}_ensureRequiredBonesExist(n){const e=Object.values(fI).filter(t=>n[t]==null);if(e.length>0)throw new Error(`VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${e.join(", ")}`);return n}},Fd=class extends dt{constructor(){super(),this._currentTheta=0,this._currentRadius=0,this.theta=0,this.radius=0,this._currentTheta=0,this._currentRadius=0,this._attrPos=new tt(new Float32Array(195),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(189),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentTheta!==this.theta&&(this._currentTheta=this.theta,n=!0),this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,0,0,0);for(let n=0;n<64;n++){const e=n/63*this._currentTheta;this._attrPos.setXYZ(n+1,this._currentRadius*Math.sin(e),0,this._currentRadius*Math.cos(e))}this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<63;n++)this._attrIndex.setXYZ(n*3,0,n+1,n+2);this._attrIndex.needsUpdate=!0}},mI=class extends dt{constructor(){super(),this.radius=0,this._currentRadius=0,this.tail=new R,this._currentTail=new R,this._attrPos=new tt(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),this._currentTail.equals(this.tail)||(this._currentTail.copy(this.tail),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},Fa=new Qe,Od=new Qe,vs=new R,kd=new R,Qd=Math.sqrt(2)/2,gI=new Qe(0,0,-Qd,Qd),_I=new R(0,1,0),EI=class extends mt{constructor(n){super(),this.matrixAutoUpdate=!1,this.vrmLookAt=n;{const e=new Fd;e.radius=.5;const t=new Kt({color:65280,transparent:!0,opacity:.5,side:tn,depthTest:!1,depthWrite:!1});this._meshPitch=new Ke(e,t),this.add(this._meshPitch)}{const e=new Fd;e.radius=.5;const t=new Kt({color:16711680,transparent:!0,opacity:.5,side:tn,depthTest:!1,depthWrite:!1});this._meshYaw=new Ke(e,t),this.add(this._meshYaw)}{const e=new mI;e.radius=.1;const t=new ji({color:16777215,depthTest:!1,depthWrite:!1});this._lineTarget=new Js(e,t),this._lineTarget.frustumCulled=!1,this.add(this._lineTarget)}}dispose(){this._meshYaw.geometry.dispose(),this._meshYaw.material.dispose(),this._meshPitch.geometry.dispose(),this._meshPitch.material.dispose(),this._lineTarget.geometry.dispose(),this._lineTarget.material.dispose()}updateMatrixWorld(n){const e=Mt.DEG2RAD*this.vrmLookAt.yaw;this._meshYaw.geometry.theta=e,this._meshYaw.geometry.update();const t=Mt.DEG2RAD*this.vrmLookAt.pitch;this._meshPitch.geometry.theta=t,this._meshPitch.geometry.update(),this.vrmLookAt.getLookAtWorldPosition(vs),this.vrmLookAt.getLookAtWorldQuaternion(Fa),Fa.multiply(this.vrmLookAt.getFaceFrontQuaternion(Od)),this._meshYaw.position.copy(vs),this._meshYaw.quaternion.copy(Fa),this._meshPitch.position.copy(vs),this._meshPitch.quaternion.copy(Fa),this._meshPitch.quaternion.multiply(Od.setFromAxisAngle(_I,e)),this._meshPitch.quaternion.multiply(gI);const{target:i,autoUpdate:r}=this.vrmLookAt;i!=null&&r&&(i.getWorldPosition(kd).sub(vs),this._lineTarget.geometry.tail.copy(kd),this._lineTarget.geometry.update(),this._lineTarget.position.copy(vs)),super.updateMatrixWorld(n)}},vI=new R,bI=new R;function Qc(n,e){return n.matrixWorld.decompose(vI,e,bI),e}function ja(n){return[Math.atan2(-n.z,n.x),Math.atan2(n.y,Math.sqrt(n.x*n.x+n.z*n.z))]}function Hd(n){const e=Math.round(n/2/Math.PI);return n-2*Math.PI*e}var Gd=new R(0,0,1),xI=new R,yI=new R,MI=new R,II=new Qe,Ol=new Qe,Vd=new Qe,SI=new Qe,kl=new jt,pA=class AA{constructor(e,t){this.offsetFromHeadBone=new R,this.autoUpdate=!0,this.faceFront=new R(0,0,1),this.humanoid=e,this.applier=t,this._yaw=0,this._pitch=0,this._needsUpdate=!0,this._restHeadWorldQuaternion=this.getLookAtWorldQuaternion(new Qe)}get yaw(){return this._yaw}set yaw(e){this._yaw=e,this._needsUpdate=!0}get pitch(){return this._pitch}set pitch(e){this._pitch=e,this._needsUpdate=!0}get euler(){return console.warn("VRMLookAt: euler is deprecated. use getEuler() instead."),this.getEuler(new jt)}getEuler(e){return e.set(Mt.DEG2RAD*this._pitch,Mt.DEG2RAD*this._yaw,0,"YXZ")}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMLookAt: humanoid must be same in order to copy");return this.offsetFromHeadBone.copy(e.offsetFromHeadBone),this.applier=e.applier,this.autoUpdate=e.autoUpdate,this.target=e.target,this.faceFront.copy(e.faceFront),this}clone(){return new AA(this.humanoid,this.applier).copy(this)}reset(){this._yaw=0,this._pitch=0,this._needsUpdate=!0}getLookAtWorldPosition(e){const t=this.humanoid.getRawBoneNode("head");return e.copy(this.offsetFromHeadBone).applyMatrix4(t.matrixWorld)}getLookAtWorldQuaternion(e){const t=this.humanoid.getRawBoneNode("head");return Qc(t,e)}getFaceFrontQuaternion(e){if(this.faceFront.distanceToSquared(Gd)<.01)return e.copy(this._restHeadWorldQuaternion).invert();const[t,i]=ja(this.faceFront);return kl.set(0,.5*Math.PI+t,i,"YZX"),e.setFromEuler(kl).premultiply(SI.copy(this._restHeadWorldQuaternion).invert())}getLookAtWorldDirection(e){return this.getLookAtWorldQuaternion(Ol),this.getFaceFrontQuaternion(Vd),e.copy(Gd).applyQuaternion(Ol).applyQuaternion(Vd).applyEuler(this.getEuler(kl))}lookAt(e){const t=II.copy(this._restHeadWorldQuaternion).multiply(hA(this.getLookAtWorldQuaternion(Ol))),i=this.getLookAtWorldPosition(yI),r=MI.copy(e).sub(i).applyQuaternion(t).normalize(),[s,a]=ja(this.faceFront),[o,l]=ja(r),c=Hd(o-s),u=Hd(a-l);this._yaw=Mt.RAD2DEG*c,this._pitch=Mt.RAD2DEG*u,this._needsUpdate=!0}update(e){this.target!=null&&this.autoUpdate&&this.lookAt(this.target.getWorldPosition(xI)),this._needsUpdate&&(this._needsUpdate=!1,this.applier.applyYawPitch(this._yaw,this._pitch))}};pA.EULER_ORDER="YXZ";var CI=pA,wI=new R(0,0,1),Mn=new Qe,yr=new Qe,ln=new jt(0,0,0,"YXZ"),Xa=class{constructor(n,e,t,i,r){this.humanoid=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=r,this.faceFront=new R(0,0,1),this._restQuatLeftEye=new Qe,this._restQuatRightEye=new Qe,this._restLeftEyeParentWorldQuat=new Qe,this._restRightEyeParentWorldQuat=new Qe;const s=this.humanoid.getRawBoneNode("leftEye"),a=this.humanoid.getRawBoneNode("rightEye");s&&(this._restQuatLeftEye.copy(s.quaternion),Qc(s.parent,this._restLeftEyeParentWorldQuat)),a&&(this._restQuatRightEye.copy(a.quaternion),Qc(a.parent,this._restRightEyeParentWorldQuat))}applyYawPitch(n,e){const t=this.humanoid.getRawBoneNode("leftEye"),i=this.humanoid.getRawBoneNode("rightEye"),r=this.humanoid.getNormalizedBoneNode("leftEye"),s=this.humanoid.getNormalizedBoneNode("rightEye");t&&(e<0?ln.x=-Mt.DEG2RAD*this.rangeMapVerticalDown.map(-e):ln.x=Mt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?ln.y=-Mt.DEG2RAD*this.rangeMapHorizontalInner.map(-n):ln.y=Mt.DEG2RAD*this.rangeMapHorizontalOuter.map(n),Mn.setFromEuler(ln),this._getWorldFaceFrontQuat(yr),r.quaternion.copy(yr).multiply(Mn).multiply(yr.invert()),Mn.copy(this._restLeftEyeParentWorldQuat),t.quaternion.copy(r.quaternion).multiply(Mn).premultiply(Mn.invert()).multiply(this._restQuatLeftEye)),i&&(e<0?ln.x=-Mt.DEG2RAD*this.rangeMapVerticalDown.map(-e):ln.x=Mt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?ln.y=-Mt.DEG2RAD*this.rangeMapHorizontalOuter.map(-n):ln.y=Mt.DEG2RAD*this.rangeMapHorizontalInner.map(n),Mn.setFromEuler(ln),this._getWorldFaceFrontQuat(yr),s.quaternion.copy(yr).multiply(Mn).multiply(yr.invert()),Mn.copy(this._restRightEyeParentWorldQuat),i.quaternion.copy(s.quaternion).multiply(Mn).premultiply(Mn.invert()).multiply(this._restQuatRightEye))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=Mt.RAD2DEG*n.y,t=Mt.RAD2DEG*n.x;this.applyYawPitch(e,t)}_getWorldFaceFrontQuat(n){if(this.faceFront.distanceToSquared(wI)<.01)return n.identity();const[e,t]=ja(this.faceFront);return ln.set(0,.5*Math.PI+e,t,"YZX"),n.setFromEuler(ln)}};Xa.type="bone";var Hc=class{constructor(n,e,t,i,r){this.expressions=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=r}applyYawPitch(n,e){e<0?(this.expressions.setValue("lookDown",0),this.expressions.setValue("lookUp",this.rangeMapVerticalUp.map(-e))):(this.expressions.setValue("lookUp",0),this.expressions.setValue("lookDown",this.rangeMapVerticalDown.map(e))),n<0?(this.expressions.setValue("lookLeft",0),this.expressions.setValue("lookRight",this.rangeMapHorizontalOuter.map(-n))):(this.expressions.setValue("lookRight",0),this.expressions.setValue("lookLeft",this.rangeMapHorizontalOuter.map(n)))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=Mt.RAD2DEG*n.y,t=Mt.RAD2DEG*n.x;this.applyYawPitch(e,t)}};Hc.type="expression";var zd=class{constructor(n,e){this.inputMaxValue=n,this.outputScale=e}map(n){return this.outputScale*iA(n/this.inputMaxValue)}},TI=new Set(["1.0","1.0-beta"]),Oa=.01,RI=class{get name(){return"VRMLookAtLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot}afterRoot(n){return et(this,null,function*(){const e=n.userData.vrmHumanoid;if(e===null)return;if(e===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");const t=n.userData.vrmExpressionManager;if(t!==null){if(t===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first");n.userData.vrmLookAt=yield this._import(n,e,t)}})}_import(n,e,t){return et(this,null,function*(){if(e==null||t==null)return null;const i=yield this._v1Import(n,e,t);if(i)return i;const r=yield this._v0Import(n,e,t);return r||null})}_v1Import(n,e,t){return et(this,null,function*(){var i,r,s;const a=this.parser.json;if(!(((i=a.extensionsUsed)==null?void 0:i.indexOf("VRMC_vrm"))!==-1))return null;const l=(r=a.extensions)==null?void 0:r.VRMC_vrm;if(!l)return null;const c=l.specVersion;if(!TI.has(c))return console.warn(`VRMLookAtLoaderPlugin: Unknown VRMC_vrm specVersion "${c}"`),null;const u=l.lookAt;if(!u)return null;const h=u.type==="expression"?1:10,d=this._v1ImportRangeMap(u.rangeMapHorizontalInner,h),f=this._v1ImportRangeMap(u.rangeMapHorizontalOuter,h),g=this._v1ImportRangeMap(u.rangeMapVerticalDown,h),m=this._v1ImportRangeMap(u.rangeMapVerticalUp,h);let A;u.type==="expression"?A=new Hc(t,d,f,g,m):A=new Xa(e,d,f,g,m);const p=this._importLookAt(e,A);return p.offsetFromHeadBone.fromArray((s=u.offsetFromHeadBone)!=null?s:[0,.06,0]),p})}_v1ImportRangeMap(n,e){var t,i;let r=(t=n==null?void 0:n.inputMaxValue)!=null?t:90;const s=(i=n==null?void 0:n.outputScale)!=null?i:e;return r<Oa&&(console.warn("VRMLookAtLoaderPlugin: inputMaxValue of a range map is too small. Consider reviewing the range map!"),r=Oa),new zd(r,s)}_v0Import(n,e,t){return et(this,null,function*(){var i,r,s,a;const l=(i=this.parser.json.extensions)==null?void 0:i.VRM;if(!l)return null;const c=l.firstPerson;if(!c)return null;const u=c.lookAtTypeName==="BlendShape"?1:10,h=this._v0ImportDegreeMap(c.lookAtHorizontalInner,u),d=this._v0ImportDegreeMap(c.lookAtHorizontalOuter,u),f=this._v0ImportDegreeMap(c.lookAtVerticalDown,u),g=this._v0ImportDegreeMap(c.lookAtVerticalUp,u);let m;c.lookAtTypeName==="BlendShape"?m=new Hc(t,h,d,f,g):m=new Xa(e,h,d,f,g);const A=this._importLookAt(e,m);return c.firstPersonBoneOffset?A.offsetFromHeadBone.set((r=c.firstPersonBoneOffset.x)!=null?r:0,(s=c.firstPersonBoneOffset.y)!=null?s:.06,-((a=c.firstPersonBoneOffset.z)!=null?a:0)):A.offsetFromHeadBone.set(0,.06,0),A.faceFront.set(0,0,-1),m instanceof Xa&&m.faceFront.set(0,0,-1),A})}_v0ImportDegreeMap(n,e){var t,i;const r=n==null?void 0:n.curve;JSON.stringify(r)!=="[0,0,0,1,1,1,1,0]"&&console.warn("Curves of LookAtDegreeMap defined in VRM 0.0 are not supported");let s=(t=n==null?void 0:n.xRange)!=null?t:90;const a=(i=n==null?void 0:n.yRange)!=null?i:e;return s<Oa&&(console.warn("VRMLookAtLoaderPlugin: xRange of a degree map is too small. Consider reviewing the degree map!"),s=Oa),new zd(s,a)}_importLookAt(n,e){const t=new CI(n,e);if(this.helperRoot){const i=new EI(t);this.helperRoot.add(i),i.renderOrder=this.helperRoot.renderOrder}return t}};function BI(n,e){return typeof n!="string"||n===""?"":(/^https?:\/\//i.test(e)&&/^\//.test(n)&&(e=e.replace(/(^https?:\/\/[^/]+).*/i,"$1")),/^(https?:)?\/\//i.test(n)||/^data:.*,.*$/i.test(n)||/^blob:.*$/i.test(n)?n:e+n)}var LI=new Set(["1.0","1.0-beta"]),DI=class{get name(){return"VRMMetaLoaderPlugin"}constructor(n,e){var t,i,r;this.parser=n,this.needThumbnailImage=(t=e==null?void 0:e.needThumbnailImage)!=null?t:!1,this.acceptLicenseUrls=(i=e==null?void 0:e.acceptLicenseUrls)!=null?i:["https://vrm.dev/licenses/1.0/"],this.acceptV0Meta=(r=e==null?void 0:e.acceptV0Meta)!=null?r:!0}afterRoot(n){return et(this,null,function*(){n.userData.vrmMeta=yield this._import(n)})}_import(n){return et(this,null,function*(){const e=yield this._v1Import(n);if(e!=null)return e;const t=yield this._v0Import(n);return t??null})}_v1Import(n){return et(this,null,function*(){var e,t,i;const r=this.parser.json;if(!(((e=r.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const a=(t=r.extensions)==null?void 0:t.VRMC_vrm;if(a==null)return null;const o=a.specVersion;if(!LI.has(o))return console.warn(`VRMMetaLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.meta;if(!l)return null;const c=l.licenseUrl;if(!new Set(this.acceptLicenseUrls).has(c))throw new Error(`VRMMetaLoaderPlugin: The license url "${c}" is not accepted`);let h;return this.needThumbnailImage&&l.thumbnailImage!=null&&(h=(i=yield this._extractGLTFImage(l.thumbnailImage))!=null?i:void 0),{metaVersion:"1",name:l.name,version:l.version,authors:l.authors,copyrightInformation:l.copyrightInformation,contactInformation:l.contactInformation,references:l.references,thirdPartyLicenses:l.thirdPartyLicenses,thumbnailImage:h,licenseUrl:l.licenseUrl,avatarPermission:l.avatarPermission,allowExcessivelyViolentUsage:l.allowExcessivelyViolentUsage,allowExcessivelySexualUsage:l.allowExcessivelySexualUsage,commercialUsage:l.commercialUsage,allowPoliticalOrReligiousUsage:l.allowPoliticalOrReligiousUsage,allowAntisocialOrHateUsage:l.allowAntisocialOrHateUsage,creditNotation:l.creditNotation,allowRedistribution:l.allowRedistribution,modification:l.modification,otherLicenseUrl:l.otherLicenseUrl}})}_v0Import(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const r=i.meta;if(!r)return null;if(!this.acceptV0Meta)throw new Error("VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false");let s;return this.needThumbnailImage&&r.texture!=null&&r.texture!==-1&&(s=yield this.parser.getDependency("texture",r.texture)),{metaVersion:"0",allowedUserName:r.allowedUserName,author:r.author,commercialUssageName:r.commercialUssageName,contactInformation:r.contactInformation,licenseName:r.licenseName,otherLicenseUrl:r.otherLicenseUrl,otherPermissionUrl:r.otherPermissionUrl,reference:r.reference,sexualUssageName:r.sexualUssageName,texture:s??void 0,title:r.title,version:r.version,violentUssageName:r.violentUssageName}})}_extractGLTFImage(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.images)==null?void 0:e[n];if(i==null)return console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image doesn't exist`),null;let r=i.uri;if(i.bufferView!=null){const a=yield this.parser.getDependency("bufferView",i.bufferView),o=new Blob([a],{type:i.mimeType});r=URL.createObjectURL(o)}return r==null?(console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image couldn't load properly`),null):yield new lp().loadAsync(BI(r,this.parser.options.path)).catch(a=>(console.error(a),console.warn("VRMMetaLoaderPlugin: Failed to load a thumbnail image"),null))})}},PI=class{constructor(n){this.scene=n.scene,this.meta=n.meta,this.humanoid=n.humanoid,this.expressionManager=n.expressionManager,this.firstPerson=n.firstPerson,this.lookAt=n.lookAt}update(n){this.humanoid.update(),this.lookAt&&this.lookAt.update(n),this.expressionManager&&this.expressionManager.update()}},UI=class extends PI{constructor(n){super(n),this.materials=n.materials,this.springBoneManager=n.springBoneManager,this.nodeConstraintManager=n.nodeConstraintManager}update(n){super.update(n),this.nodeConstraintManager&&this.nodeConstraintManager.update(),this.springBoneManager&&this.springBoneManager.update(n),this.materials&&this.materials.forEach(e=>{e.update&&e.update(n)})}},NI=Object.defineProperty,Wd=Object.getOwnPropertySymbols,FI=Object.prototype.hasOwnProperty,OI=Object.prototype.propertyIsEnumerable,qd=(n,e,t)=>e in n?NI(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,jd=(n,e)=>{for(var t in e||(e={}))FI.call(e,t)&&qd(n,t,e[t]);if(Wd)for(var t of Wd(e))OI.call(e,t)&&qd(n,t,e[t]);return n},Li=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),kI={"":3e3,srgb:3001};function QI(n,e){parseInt(Oi,10)>=152?n.colorSpace=e:n.encoding=kI[e]}var HI=class{get pending(){return Promise.all(this._pendings)}constructor(n,e){this._parser=n,this._materialParams=e,this._pendings=[]}assignPrimitive(n,e){e!=null&&(this._materialParams[n]=e)}assignColor(n,e,t){if(e!=null){const i=new be().fromArray(e);t&&i.convertSRGBToLinear(),this._materialParams[n]=i}}assignTexture(n,e,t){return Li(this,null,function*(){const i=Li(this,null,function*(){if(e!=null){const r=yield this._parser.assignTexture(this._materialParams,n,e);if(r==null){console.warn("GLTFMToonMaterialParamsAssignHelper: Failed to load texture. The rendering result may be wrong");return}t&&QI(r,"srgb")}});return this._pendings.push(i),i})}assignTextureByIndex(n,e,t){return Li(this,null,function*(){return this.assignTexture(n,e!=null?{index:e}:void 0,t)})}},GI=`// #define PHONG

varying vec3 vViewPosition;

#ifndef FLAT_SHADED
  varying vec3 vNormal;
#endif

#include <common>

// #include <uv_pars_vertex>
#ifdef MTOON_USE_UV
  varying vec2 vUv;

  // COMPAT: pre-r151 uses a common uvTransform
  #if THREE_VRM_THREE_REVISION < 151
    uniform mat3 uvTransform;
  #endif
#endif

// #include <uv2_pars_vertex>
// COMAPT: pre-r151 uses uv2 for lightMap and aoMap
#if THREE_VRM_THREE_REVISION < 151
  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
    attribute vec2 uv2;
    varying vec2 vUv2;
    uniform mat3 uv2Transform;
  #endif
#endif

// #include <displacementmap_pars_vertex>
// #include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE
  uniform sampler2D outlineWidthMultiplyTexture;
  uniform mat3 outlineWidthMultiplyTextureUvTransform;
#endif

uniform float outlineWidthFactor;

void main() {

  // #include <uv_vertex>
  #ifdef MTOON_USE_UV
    // COMPAT: pre-r151 uses a common uvTransform
    #if THREE_VRM_THREE_REVISION >= 151
      vUv = uv;
    #else
      vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
    #endif
  #endif

  // #include <uv2_vertex>
  // COMAPT: pre-r151 uses uv2 for lightMap and aoMap
  #if THREE_VRM_THREE_REVISION < 151
    #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
      vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
    #endif
  #endif

  #include <color_vertex>

  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>

  // we need this to compute the outline properly
  objectNormal = normalize( objectNormal );

  #include <defaultnormal_vertex>

  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED
    vNormal = normalize( transformedNormal );
  #endif

  #include <begin_vertex>

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  // #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>

  vViewPosition = - mvPosition.xyz;

  #ifdef OUTLINE
    float worldNormalLength = length( transformedNormal );
    vec3 outlineOffset = outlineWidthFactor * worldNormalLength * objectNormal;

    #ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE
      vec2 outlineWidthMultiplyTextureUv = ( outlineWidthMultiplyTextureUvTransform * vec3( vUv, 1 ) ).xy;
      float outlineTex = texture2D( outlineWidthMultiplyTexture, outlineWidthMultiplyTextureUv ).g;
      outlineOffset *= outlineTex;
    #endif

    #ifdef OUTLINE_WIDTH_SCREEN
      outlineOffset *= vViewPosition.z / projectionMatrix[ 1 ].y;
    #endif

    gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );

    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic
  #endif

  #include <worldpos_vertex>
  // #include <envmap_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>

}`,VI=`// #define PHONG

uniform vec3 litFactor;

uniform float opacity;

uniform vec3 shadeColorFactor;
#ifdef USE_SHADEMULTIPLYTEXTURE
  uniform sampler2D shadeMultiplyTexture;
  uniform mat3 shadeMultiplyTextureUvTransform;
#endif

uniform float shadingShiftFactor;
uniform float shadingToonyFactor;

#ifdef USE_SHADINGSHIFTTEXTURE
  uniform sampler2D shadingShiftTexture;
  uniform mat3 shadingShiftTextureUvTransform;
  uniform float shadingShiftTextureScale;
#endif

uniform float giEqualizationFactor;

uniform vec3 parametricRimColorFactor;
#ifdef USE_RIMMULTIPLYTEXTURE
  uniform sampler2D rimMultiplyTexture;
  uniform mat3 rimMultiplyTextureUvTransform;
#endif
uniform float rimLightingMixFactor;
uniform float parametricRimFresnelPowerFactor;
uniform float parametricRimLiftFactor;

#ifdef USE_MATCAPTEXTURE
  uniform vec3 matcapFactor;
  uniform sampler2D matcapTexture;
  uniform mat3 matcapTextureUvTransform;
#endif

uniform vec3 emissive;
uniform float emissiveIntensity;

uniform vec3 outlineColorFactor;
uniform float outlineLightingMixFactor;

#ifdef USE_UVANIMATIONMASKTEXTURE
  uniform sampler2D uvAnimationMaskTexture;
  uniform mat3 uvAnimationMaskTextureUvTransform;
#endif

uniform float uvAnimationScrollXOffset;
uniform float uvAnimationScrollYOffset;
uniform float uvAnimationRotationPhase;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>

// #include <uv_pars_fragment>
#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )
  varying vec2 vUv;
#endif

// #include <uv2_pars_fragment>
// COMAPT: pre-r151 uses uv2 for lightMap and aoMap
#if THREE_VRM_THREE_REVISION < 151
  #if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
    varying vec2 vUv2;
  #endif
#endif

#include <map_pars_fragment>

#ifdef USE_MAP
  uniform mat3 mapUvTransform;
#endif

// #include <alphamap_pars_fragment>

#include <alphatest_pars_fragment>

#include <aomap_pars_fragment>
// #include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>

#ifdef USE_EMISSIVEMAP
  uniform mat3 emissiveMapUvTransform;
#endif

// #include <envmap_common_pars_fragment>
// #include <envmap_pars_fragment>
// #include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>

// #include <bsdfs>
// COMPAT: pre-r151 doesn't have BRDF_Lambert in <common>
#if THREE_VRM_THREE_REVISION < 151
  vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
    return RECIPROCAL_PI * diffuseColor;
  }
#endif

#include <lights_pars_begin>

#include <normal_pars_fragment>

// #include <lights_phong_pars_fragment>
varying vec3 vViewPosition;

struct MToonMaterial {
  vec3 diffuseColor;
  vec3 shadeColor;
  float shadingShift;
};

float linearstep( float a, float b, float t ) {
  return clamp( ( t - a ) / ( b - a ), 0.0, 1.0 );
}

/**
 * Convert NdotL into toon shading factor using shadingShift and shadingToony
 */
float getShading(
  const in float dotNL,
  const in float shadow,
  const in float shadingShift
) {
  float shading = dotNL;
  shading = shading + shadingShift;
  shading = linearstep( -1.0 + shadingToonyFactor, 1.0 - shadingToonyFactor, shading );
  shading *= shadow;
  return shading;
}

/**
 * Mix diffuseColor and shadeColor using shading factor and light color
 */
vec3 getDiffuse(
  const in MToonMaterial material,
  const in float shading,
  in vec3 lightColor
) {
  #ifdef DEBUG_LITSHADERATE
    return vec3( BRDF_Lambert( shading * lightColor ) );
  #endif

  vec3 col = lightColor * BRDF_Lambert( mix( material.shadeColor, material.diffuseColor, shading ) );

  // The "comment out if you want to PBR absolutely" line
  #ifdef V0_COMPAT_SHADE
    col = min( col, material.diffuseColor );
  #endif

  return col;
}

// COMPAT: pre-r156 uses a struct GeometricContext
#if THREE_VRM_THREE_REVISION >= 157
  void RE_Direct_MToon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {
    float dotNL = clamp( dot( geometryNormal, directLight.direction ), -1.0, 1.0 );
    vec3 irradiance = directLight.color;

    // directSpecular will be used for rim lighting, not an actual specular
    reflectedLight.directSpecular += irradiance;

    irradiance *= dotNL;

    float shading = getShading( dotNL, shadow, material.shadingShift );

    // toon shaded diffuse
    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );
  }

  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {
    // indirect diffuse will use diffuseColor, no shadeColor involved
    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

    // directSpecular will be used for rim lighting, not an actual specular
    reflectedLight.directSpecular += irradiance;
  }
#else
  void RE_Direct_MToon( const in IncidentLight directLight, const in GeometricContext geometry, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {
    float dotNL = clamp( dot( geometry.normal, directLight.direction ), -1.0, 1.0 );
    vec3 irradiance = directLight.color;

    // directSpecular will be used for rim lighting, not an actual specular
    reflectedLight.directSpecular += irradiance;

    irradiance *= dotNL;

    float shading = getShading( dotNL, shadow, material.shadingShift );

    // toon shaded diffuse
    reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );
  }

  void RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in GeometricContext geometry, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {
    // indirect diffuse will use diffuseColor, no shadeColor involved
    reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

    // directSpecular will be used for rim lighting, not an actual specular
    reflectedLight.directSpecular += irradiance;
  }
#endif

#define RE_Direct RE_Direct_MToon
#define RE_IndirectDiffuse RE_IndirectDiffuse_MToon
#define Material_LightProbeLOD( material ) (0)

#include <shadowmap_pars_fragment>
// #include <bumpmap_pars_fragment>

// #include <normalmap_pars_fragment>
#ifdef USE_NORMALMAP

  uniform sampler2D normalMap;
  uniform mat3 normalMapUvTransform;
  uniform vec2 normalScale;

#endif

// COMPAT: pre-r151
// USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151
#if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )

  uniform mat3 normalMatrix;

#endif

// COMPAT: pre-r151
// USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( TANGENTSPACE_NORMALMAP ) )

  // Per-Pixel Tangent Space Normal Mapping
  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html

  // three-vrm specific change: it requires \`uv\` as an input in order to support uv scrolls

  // Temporary compat against shader change @ Three.js r126, r151
  #if THREE_VRM_THREE_REVISION >= 151

    mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {

      vec3 q0 = dFdx( eye_pos.xyz );
      vec3 q1 = dFdy( eye_pos.xyz );
      vec2 st0 = dFdx( uv.st );
      vec2 st1 = dFdy( uv.st );

      vec3 N = surf_norm;

      vec3 q1perp = cross( q1, N );
      vec3 q0perp = cross( N, q0 );

      vec3 T = q1perp * st0.x + q0perp * st1.x;
      vec3 B = q1perp * st0.y + q0perp * st1.y;

      float det = max( dot( T, T ), dot( B, B ) );
      float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );

      return mat3( T * scale, B * scale, N );

    }

  #else

    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {

      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
      vec2 st0 = dFdx( uv.st );
      vec2 st1 = dFdy( uv.st );

      vec3 N = normalize( surf_norm );

      vec3 q1perp = cross( q1, N );
      vec3 q0perp = cross( N, q0 );

      vec3 T = q1perp * st0.x + q0perp * st1.x;
      vec3 B = q1perp * st0.y + q0perp * st1.y;

      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0
      // TODO: Is this still required? Or shall I make a PR about it?
      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {
        return surf_norm;
      }

      float det = max( dot( T, T ), dot( B, B ) );
      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );

      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );

    }

  #endif

#endif

// #include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

// == post correction ==========================================================
void postCorrection() {
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  #include <premultiplied_alpha_fragment>
  #include <dithering_fragment>
}

// == main procedure ===========================================================
void main() {
  #include <clipping_planes_fragment>

  vec2 uv = vec2(0.5, 0.5);

  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )
    uv = vUv;

    float uvAnimMask = 1.0;
    #ifdef USE_UVANIMATIONMASKTEXTURE
      vec2 uvAnimationMaskTextureUv = ( uvAnimationMaskTextureUvTransform * vec3( uv, 1 ) ).xy;
      uvAnimMask = texture2D( uvAnimationMaskTexture, uvAnimationMaskTextureUv ).b;
    #endif

    float uvRotCos = cos( uvAnimationRotationPhase * uvAnimMask );
    float uvRotSin = sin( uvAnimationRotationPhase * uvAnimMask );
    uv = mat2( uvRotCos, -uvRotSin, uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;
    uv = uv + vec2( uvAnimationScrollXOffset, uvAnimationScrollYOffset ) * uvAnimMask;
  #endif

  #ifdef DEBUG_UV
    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )
      gl_FragColor = vec4( uv, 0.0, 1.0 );
    #endif
    return;
  #endif

  vec4 diffuseColor = vec4( litFactor, opacity );
  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  vec3 totalEmissiveRadiance = emissive * emissiveIntensity;

  #include <logdepthbuf_fragment>

  // #include <map_fragment>
  #ifdef USE_MAP
    vec2 mapUv = ( mapUvTransform * vec3( uv, 1 ) ).xy;
    vec4 sampledDiffuseColor = texture2D( map, mapUv );
    #ifdef DECODE_VIDEO_TEXTURE
      sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
    #endif
    diffuseColor *= sampledDiffuseColor;
  #endif

  // #include <color_fragment>
  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )
    diffuseColor.rgb *= vColor;
  #endif

  // #include <alphamap_fragment>

  #include <alphatest_fragment>

  // #include <specularmap_fragment>

  // #include <normal_fragment_begin>
  float faceDirection = gl_FrontFacing ? 1.0 : -1.0;

  #ifdef FLAT_SHADED

    vec3 fdx = dFdx( vViewPosition );
    vec3 fdy = dFdy( vViewPosition );
    vec3 normal = normalize( cross( fdx, fdy ) );

  #else

    vec3 normal = normalize( vNormal );

    #ifdef DOUBLE_SIDED

      normal *= faceDirection;

    #endif

  #endif

  #ifdef USE_NORMALMAP

    vec2 normalMapUv = ( normalMapUvTransform * vec3( uv, 1 ) ).xy;

  #endif

  #ifdef USE_NORMALMAP_TANGENTSPACE

    #ifdef USE_TANGENT

      mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

    #else

      mat3 tbn = getTangentFrame( - vViewPosition, normal, normalMapUv );

    #endif

    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )

      tbn[0] *= faceDirection;
      tbn[1] *= faceDirection;

    #endif

  #endif

  #ifdef USE_CLEARCOAT_NORMALMAP

    #ifdef USE_TANGENT

      mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

    #else

      mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );

    #endif

    #if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )

      tbn2[0] *= faceDirection;
      tbn2[1] *= faceDirection;

    #endif

  #endif

  // non perturbed normal for clearcoat among others

  vec3 nonPerturbedNormal = normal;

  #ifdef OUTLINE
    normal *= -1.0;
  #endif

  // #include <normal_fragment_maps>

  // COMPAT: pre-r151
  // USE_NORMALMAP_OBJECTSPACE used to be OBJECTSPACE_NORMALMAP in pre-r151
  #if defined( USE_NORMALMAP_OBJECTSPACE ) || defined( OBJECTSPACE_NORMALMAP )

    normal = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals

    #ifdef FLIP_SIDED

      normal = - normal;

    #endif

    #ifdef DOUBLE_SIDED

      normal = normal * faceDirection;

    #endif

    normal = normalize( normalMatrix * normal );

  // COMPAT: pre-r151
  // USE_NORMALMAP_TANGENTSPACE used to be TANGENTSPACE_NORMALMAP in pre-r151
  #elif defined( USE_NORMALMAP_TANGENTSPACE ) || defined( TANGENTSPACE_NORMALMAP )

    vec3 mapN = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale;

    // COMPAT: pre-r151
    #if THREE_VRM_THREE_REVISION >= 151 || defined( USE_TANGENT )

      normal = normalize( tbn * mapN );

    #else

      normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );

    #endif

  #endif

  // #include <emissivemap_fragment>
  #ifdef USE_EMISSIVEMAP
    vec2 emissiveMapUv = ( emissiveMapUvTransform * vec3( uv, 1 ) ).xy;
    totalEmissiveRadiance *= texture2D( emissiveMap, emissiveMapUv ).rgb;
  #endif

  #ifdef DEBUG_NORMAL
    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );
    return;
  #endif

  // -- MToon: lighting --------------------------------------------------------
  // accumulation
  // #include <lights_phong_fragment>
  MToonMaterial material;

  material.diffuseColor = diffuseColor.rgb;

  material.shadeColor = shadeColorFactor;
  #ifdef USE_SHADEMULTIPLYTEXTURE
    vec2 shadeMultiplyTextureUv = ( shadeMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;
    material.shadeColor *= texture2D( shadeMultiplyTexture, shadeMultiplyTextureUv ).rgb;
  #endif

  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )
    material.shadeColor.rgb *= vColor;
  #endif

  material.shadingShift = shadingShiftFactor;
  #ifdef USE_SHADINGSHIFTTEXTURE
    vec2 shadingShiftTextureUv = ( shadingShiftTextureUvTransform * vec3( uv, 1 ) ).xy;
    material.shadingShift += texture2D( shadingShiftTexture, shadingShiftTextureUv ).r * shadingShiftTextureScale;
  #endif

  // #include <lights_fragment_begin>

  // MToon Specific changes:
  // Since we want to take shadows into account of shading instead of irradiance,
  // we had to modify the codes that multiplies the results of shadowmap into color of direct lights.

  // COMPAT: pre-r156 uses a struct GeometricContext
  #if THREE_VRM_THREE_REVISION >= 157
    vec3 geometryPosition = - vViewPosition;
    vec3 geometryNormal = normal;
    vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

    vec3 geometryClearcoatNormal;

    #ifdef USE_CLEARCOAT

      geometryClearcoatNormal = clearcoatNormal;

    #endif
  #else
    GeometricContext geometry;

    geometry.position = - vViewPosition;
    geometry.normal = normal;
    geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

    #ifdef USE_CLEARCOAT

      geometry.clearcoatNormal = clearcoatNormal;

    #endif
  #endif

  IncidentLight directLight;

  // since these variables will be used in unrolled loop, we have to define in prior
  float shadow;

  #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

    PointLight pointLight;
    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
    PointLightShadow pointLightShadow;
    #endif

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

      pointLight = pointLights[ i ];

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        getPointLightInfo( pointLight, geometryPosition, directLight );
      #else
        getPointLightInfo( pointLight, geometry, directLight );
      #endif

      shadow = 1.0;
      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
      pointLightShadow = pointLightShadows[ i ];
      // COMPAT: pre-r166
      // r166 introduced shadowIntensity
      #if THREE_VRM_THREE_REVISION >= 166
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
      #else
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
      #endif
      #endif

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );
      #else
        RE_Direct( directLight, geometry, material, shadow, reflectedLight );
      #endif

    }
    #pragma unroll_loop_end

  #endif

  #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

    SpotLight spotLight;
    // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS, r144+ uses NUM_SPOT_LIGHT_COORDS
    #if THREE_VRM_THREE_REVISION >= 144
      #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_COORDS > 0
      SpotLightShadow spotLightShadow;
      #endif
    #elif defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
    SpotLightShadow spotLightShadow;
    #endif

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

      spotLight = spotLights[ i ];

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        getSpotLightInfo( spotLight, geometryPosition, directLight );
      #else
        getSpotLightInfo( spotLight, geometry, directLight );
      #endif

      shadow = 1.0;
      // COMPAT: pre-r144 uses NUM_SPOT_LIGHT_SHADOWS and vSpotShadowCoord, r144+ uses NUM_SPOT_LIGHT_COORDS and vSpotLightCoord
      // COMPAT: pre-r166 does not have shadowIntensity, r166+ has shadowIntensity
      #if THREE_VRM_THREE_REVISION >= 166
        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )
        spotLightShadow = spotLightShadows[ i ];
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
        #endif
      #elif THREE_VRM_THREE_REVISION >= 144
        #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_COORDS )
        spotLightShadow = spotLightShadows[ i ];
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
        #endif
      #elif defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
      spotLightShadow = spotLightShadows[ i ];
      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
      #endif

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );
      #else
        RE_Direct( directLight, geometry, material, shadow, reflectedLight );
      #endif

    }
    #pragma unroll_loop_end

  #endif

  #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

    DirectionalLight directionalLight;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow directionalLightShadow;
    #endif

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

      directionalLight = directionalLights[ i ];

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        getDirectionalLightInfo( directionalLight, directLight );
      #else
        getDirectionalLightInfo( directionalLight, geometry, directLight );
      #endif

      shadow = 1.0;
      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
      directionalLightShadow = directionalLightShadows[ i ];
      // COMPAT: pre-r166
      // r166 introduced shadowIntensity
      #if THREE_VRM_THREE_REVISION >= 166
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
      #else
        shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
      #endif
      #endif

      // COMPAT: pre-r156 uses a struct GeometricContext
      #if THREE_VRM_THREE_REVISION >= 157
        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, shadow, reflectedLight );
      #else
        RE_Direct( directLight, geometry, material, shadow, reflectedLight );
      #endif

    }
    #pragma unroll_loop_end

  #endif

  // #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )

  //   RectAreaLight rectAreaLight;

  //   #pragma unroll_loop_start
  //   for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {

  //     rectAreaLight = rectAreaLights[ i ];
  //     RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );

  //   }
  //   #pragma unroll_loop_end

  // #endif

  #if defined( RE_IndirectDiffuse )

    vec3 iblIrradiance = vec3( 0.0 );

    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

    // COMPAT: pre-r156 uses a struct GeometricContext
    // COMPAT: pre-r156 doesn't have a define USE_LIGHT_PROBES
    #if THREE_VRM_THREE_REVISION >= 157
      #if defined( USE_LIGHT_PROBES )
        irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
      #endif
    #else
      irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
    #endif

    #if ( NUM_HEMI_LIGHTS > 0 )

      #pragma unroll_loop_start
      for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

        // COMPAT: pre-r156 uses a struct GeometricContext
        #if THREE_VRM_THREE_REVISION >= 157
          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
        #else
          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );
        #endif

      }
      #pragma unroll_loop_end

    #endif

  #endif

  // #if defined( RE_IndirectSpecular )

  //   vec3 radiance = vec3( 0.0 );
  //   vec3 clearcoatRadiance = vec3( 0.0 );

  // #endif

  #include <lights_fragment_maps>
  #include <lights_fragment_end>

  // modulation
  #include <aomap_fragment>

  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;

  #ifdef DEBUG_LITSHADERATE
    gl_FragColor = vec4( col, diffuseColor.a );
    postCorrection();
    return;
  #endif

  // -- MToon: rim lighting -----------------------------------------
  vec3 viewDir = normalize( vViewPosition );

  #ifndef PHYSICALLY_CORRECT_LIGHTS
    reflectedLight.directSpecular /= PI;
  #endif
  vec3 rimMix = mix( vec3( 1.0 ), reflectedLight.directSpecular, rimLightingMixFactor );

  vec3 rim = parametricRimColorFactor * pow( saturate( 1.0 - dot( viewDir, normal ) + parametricRimLiftFactor ), parametricRimFresnelPowerFactor );

  #ifdef USE_MATCAPTEXTURE
    {
      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );
      vec3 y = cross( viewDir, x ); // guaranteed to be normalized
      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );
      sphereUv = ( matcapTextureUvTransform * vec3( sphereUv, 1 ) ).xy;
      vec3 matcap = texture2D( matcapTexture, sphereUv ).rgb;
      rim += matcapFactor * matcap;
    }
  #endif

  #ifdef USE_RIMMULTIPLYTEXTURE
    vec2 rimMultiplyTextureUv = ( rimMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;
    rim *= texture2D( rimMultiplyTexture, rimMultiplyTextureUv ).rgb;
  #endif

  col += rimMix * rim;

  // -- MToon: Emission --------------------------------------------------------
  col += totalEmissiveRadiance;

  // #include <envmap_fragment>

  // -- Almost done! -----------------------------------------------------------
  #if defined( OUTLINE )
    col = outlineColorFactor.rgb * mix( vec3( 1.0 ), col, outlineLightingMixFactor );
  #endif

  #ifdef OPAQUE
    diffuseColor.a = 1.0;
  #endif

  gl_FragColor = vec4( col, diffuseColor.a );
  postCorrection();
}
`,zI={None:"none"},Xd={None:"none",ScreenCoordinates:"screenCoordinates"},WI={3e3:"",3001:"srgb"};function Ql(n){return parseInt(Oi,10)>=152?n.colorSpace:WI[n.encoding]}var qI=class extends Kn{constructor(n={}){var e;super({vertexShader:GI,fragmentShader:VI}),this.uvAnimationScrollXSpeedFactor=0,this.uvAnimationScrollYSpeedFactor=0,this.uvAnimationRotationSpeedFactor=0,this.fog=!0,this.normalMapType=So,this._ignoreVertexColor=!0,this._v0CompatShade=!1,this._debugMode=zI.None,this._outlineWidthMode=Xd.None,this._isOutline=!1,n.transparentWithZWrite&&(n.depthWrite=!0),delete n.transparentWithZWrite,n.fog=!0,n.lights=!0,n.clipping=!0,this.uniforms=Xf.merge([oe.common,oe.normalmap,oe.emissivemap,oe.fog,oe.lights,{litFactor:{value:new be(1,1,1)},mapUvTransform:{value:new Le},colorAlpha:{value:1},normalMapUvTransform:{value:new Le},shadeColorFactor:{value:new be(0,0,0)},shadeMultiplyTexture:{value:null},shadeMultiplyTextureUvTransform:{value:new Le},shadingShiftFactor:{value:0},shadingShiftTexture:{value:null},shadingShiftTextureUvTransform:{value:new Le},shadingShiftTextureScale:{value:1},shadingToonyFactor:{value:.9},giEqualizationFactor:{value:.9},matcapFactor:{value:new be(1,1,1)},matcapTexture:{value:null},matcapTextureUvTransform:{value:new Le},parametricRimColorFactor:{value:new be(0,0,0)},rimMultiplyTexture:{value:null},rimMultiplyTextureUvTransform:{value:new Le},rimLightingMixFactor:{value:1},parametricRimFresnelPowerFactor:{value:5},parametricRimLiftFactor:{value:0},emissive:{value:new be(0,0,0)},emissiveIntensity:{value:1},emissiveMapUvTransform:{value:new Le},outlineWidthMultiplyTexture:{value:null},outlineWidthMultiplyTextureUvTransform:{value:new Le},outlineWidthFactor:{value:0},outlineColorFactor:{value:new be(0,0,0)},outlineLightingMixFactor:{value:1},uvAnimationMaskTexture:{value:null},uvAnimationMaskTextureUvTransform:{value:new Le},uvAnimationScrollXOffset:{value:0},uvAnimationScrollYOffset:{value:0},uvAnimationRotationPhase:{value:0}},(e=n.uniforms)!=null?e:{}]),this.setValues(n),this._uploadUniformsWorkaround(),this.customProgramCacheKey=()=>[...Object.entries(this._generateDefines()).map(([t,i])=>`${t}:${i}`),this.matcapTexture?`matcapTextureColorSpace:${Ql(this.matcapTexture)}`:"",this.shadeMultiplyTexture?`shadeMultiplyTextureColorSpace:${Ql(this.shadeMultiplyTexture)}`:"",this.rimMultiplyTexture?`rimMultiplyTextureColorSpace:${Ql(this.rimMultiplyTexture)}`:""].join(","),this.onBeforeCompile=t=>{const i=parseInt(Oi,10),r=Object.entries(jd(jd({},this._generateDefines()),this.defines)).filter(([s,a])=>!!a).map(([s,a])=>`#define ${s} ${a}`).join(`
`)+`
`;t.vertexShader=r+t.vertexShader,t.fragmentShader=r+t.fragmentShader,i<154&&(t.fragmentShader=t.fragmentShader.replace("#include <colorspace_fragment>","#include <encodings_fragment>"))}}get color(){return this.uniforms.litFactor.value}set color(n){this.uniforms.litFactor.value=n}get map(){return this.uniforms.map.value}set map(n){this.uniforms.map.value=n}get normalMap(){return this.uniforms.normalMap.value}set normalMap(n){this.uniforms.normalMap.value=n}get normalScale(){return this.uniforms.normalScale.value}set normalScale(n){this.uniforms.normalScale.value=n}get emissive(){return this.uniforms.emissive.value}set emissive(n){this.uniforms.emissive.value=n}get emissiveIntensity(){return this.uniforms.emissiveIntensity.value}set emissiveIntensity(n){this.uniforms.emissiveIntensity.value=n}get emissiveMap(){return this.uniforms.emissiveMap.value}set emissiveMap(n){this.uniforms.emissiveMap.value=n}get shadeColorFactor(){return this.uniforms.shadeColorFactor.value}set shadeColorFactor(n){this.uniforms.shadeColorFactor.value=n}get shadeMultiplyTexture(){return this.uniforms.shadeMultiplyTexture.value}set shadeMultiplyTexture(n){this.uniforms.shadeMultiplyTexture.value=n}get shadingShiftFactor(){return this.uniforms.shadingShiftFactor.value}set shadingShiftFactor(n){this.uniforms.shadingShiftFactor.value=n}get shadingShiftTexture(){return this.uniforms.shadingShiftTexture.value}set shadingShiftTexture(n){this.uniforms.shadingShiftTexture.value=n}get shadingShiftTextureScale(){return this.uniforms.shadingShiftTextureScale.value}set shadingShiftTextureScale(n){this.uniforms.shadingShiftTextureScale.value=n}get shadingToonyFactor(){return this.uniforms.shadingToonyFactor.value}set shadingToonyFactor(n){this.uniforms.shadingToonyFactor.value=n}get giEqualizationFactor(){return this.uniforms.giEqualizationFactor.value}set giEqualizationFactor(n){this.uniforms.giEqualizationFactor.value=n}get matcapFactor(){return this.uniforms.matcapFactor.value}set matcapFactor(n){this.uniforms.matcapFactor.value=n}get matcapTexture(){return this.uniforms.matcapTexture.value}set matcapTexture(n){this.uniforms.matcapTexture.value=n}get parametricRimColorFactor(){return this.uniforms.parametricRimColorFactor.value}set parametricRimColorFactor(n){this.uniforms.parametricRimColorFactor.value=n}get rimMultiplyTexture(){return this.uniforms.rimMultiplyTexture.value}set rimMultiplyTexture(n){this.uniforms.rimMultiplyTexture.value=n}get rimLightingMixFactor(){return this.uniforms.rimLightingMixFactor.value}set rimLightingMixFactor(n){this.uniforms.rimLightingMixFactor.value=n}get parametricRimFresnelPowerFactor(){return this.uniforms.parametricRimFresnelPowerFactor.value}set parametricRimFresnelPowerFactor(n){this.uniforms.parametricRimFresnelPowerFactor.value=n}get parametricRimLiftFactor(){return this.uniforms.parametricRimLiftFactor.value}set parametricRimLiftFactor(n){this.uniforms.parametricRimLiftFactor.value=n}get outlineWidthMultiplyTexture(){return this.uniforms.outlineWidthMultiplyTexture.value}set outlineWidthMultiplyTexture(n){this.uniforms.outlineWidthMultiplyTexture.value=n}get outlineWidthFactor(){return this.uniforms.outlineWidthFactor.value}set outlineWidthFactor(n){this.uniforms.outlineWidthFactor.value=n}get outlineColorFactor(){return this.uniforms.outlineColorFactor.value}set outlineColorFactor(n){this.uniforms.outlineColorFactor.value=n}get outlineLightingMixFactor(){return this.uniforms.outlineLightingMixFactor.value}set outlineLightingMixFactor(n){this.uniforms.outlineLightingMixFactor.value=n}get uvAnimationMaskTexture(){return this.uniforms.uvAnimationMaskTexture.value}set uvAnimationMaskTexture(n){this.uniforms.uvAnimationMaskTexture.value=n}get uvAnimationScrollXOffset(){return this.uniforms.uvAnimationScrollXOffset.value}set uvAnimationScrollXOffset(n){this.uniforms.uvAnimationScrollXOffset.value=n}get uvAnimationScrollYOffset(){return this.uniforms.uvAnimationScrollYOffset.value}set uvAnimationScrollYOffset(n){this.uniforms.uvAnimationScrollYOffset.value=n}get uvAnimationRotationPhase(){return this.uniforms.uvAnimationRotationPhase.value}set uvAnimationRotationPhase(n){this.uniforms.uvAnimationRotationPhase.value=n}get ignoreVertexColor(){return this._ignoreVertexColor}set ignoreVertexColor(n){this._ignoreVertexColor=n,this.needsUpdate=!0}get v0CompatShade(){return this._v0CompatShade}set v0CompatShade(n){this._v0CompatShade=n,this.needsUpdate=!0}get debugMode(){return this._debugMode}set debugMode(n){this._debugMode=n,this.needsUpdate=!0}get outlineWidthMode(){return this._outlineWidthMode}set outlineWidthMode(n){this._outlineWidthMode=n,this.needsUpdate=!0}get isOutline(){return this._isOutline}set isOutline(n){this._isOutline=n,this.needsUpdate=!0}get isMToonMaterial(){return!0}update(n){this._uploadUniformsWorkaround(),this._updateUVAnimation(n)}copy(n){return super.copy(n),this.map=n.map,this.normalMap=n.normalMap,this.emissiveMap=n.emissiveMap,this.shadeMultiplyTexture=n.shadeMultiplyTexture,this.shadingShiftTexture=n.shadingShiftTexture,this.matcapTexture=n.matcapTexture,this.rimMultiplyTexture=n.rimMultiplyTexture,this.outlineWidthMultiplyTexture=n.outlineWidthMultiplyTexture,this.uvAnimationMaskTexture=n.uvAnimationMaskTexture,this.normalMapType=n.normalMapType,this.uvAnimationScrollXSpeedFactor=n.uvAnimationScrollXSpeedFactor,this.uvAnimationScrollYSpeedFactor=n.uvAnimationScrollYSpeedFactor,this.uvAnimationRotationSpeedFactor=n.uvAnimationRotationSpeedFactor,this.ignoreVertexColor=n.ignoreVertexColor,this.v0CompatShade=n.v0CompatShade,this.debugMode=n.debugMode,this.outlineWidthMode=n.outlineWidthMode,this.isOutline=n.isOutline,this.needsUpdate=!0,this}_updateUVAnimation(n){this.uniforms.uvAnimationScrollXOffset.value+=n*this.uvAnimationScrollXSpeedFactor,this.uniforms.uvAnimationScrollYOffset.value+=n*this.uvAnimationScrollYSpeedFactor,this.uniforms.uvAnimationRotationPhase.value+=n*this.uvAnimationRotationSpeedFactor,this.uniforms.alphaTest.value=this.alphaTest,this.uniformsNeedUpdate=!0}_uploadUniformsWorkaround(){this.uniforms.opacity.value=this.opacity,this._updateTextureMatrix(this.uniforms.map,this.uniforms.mapUvTransform),this._updateTextureMatrix(this.uniforms.normalMap,this.uniforms.normalMapUvTransform),this._updateTextureMatrix(this.uniforms.emissiveMap,this.uniforms.emissiveMapUvTransform),this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture,this.uniforms.shadeMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.shadingShiftTexture,this.uniforms.shadingShiftTextureUvTransform),this._updateTextureMatrix(this.uniforms.matcapTexture,this.uniforms.matcapTextureUvTransform),this._updateTextureMatrix(this.uniforms.rimMultiplyTexture,this.uniforms.rimMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.outlineWidthMultiplyTexture,this.uniforms.outlineWidthMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture,this.uniforms.uvAnimationMaskTextureUvTransform),this.uniformsNeedUpdate=!0}_generateDefines(){const n=parseInt(Oi,10),e=this.outlineWidthMultiplyTexture!==null,t=this.map!==null||this.normalMap!==null||this.emissiveMap!==null||this.shadeMultiplyTexture!==null||this.shadingShiftTexture!==null||this.rimMultiplyTexture!==null||this.uvAnimationMaskTexture!==null;return{THREE_VRM_THREE_REVISION:n,OUTLINE:this._isOutline,MTOON_USE_UV:e||t,MTOON_UVS_VERTEX_ONLY:e&&!t,V0_COMPAT_SHADE:this._v0CompatShade,USE_SHADEMULTIPLYTEXTURE:this.shadeMultiplyTexture!==null,USE_SHADINGSHIFTTEXTURE:this.shadingShiftTexture!==null,USE_MATCAPTEXTURE:this.matcapTexture!==null,USE_RIMMULTIPLYTEXTURE:this.rimMultiplyTexture!==null,USE_OUTLINEWIDTHMULTIPLYTEXTURE:this._isOutline&&this.outlineWidthMultiplyTexture!==null,USE_UVANIMATIONMASKTEXTURE:this.uvAnimationMaskTexture!==null,IGNORE_VERTEX_COLOR:this._ignoreVertexColor===!0,DEBUG_NORMAL:this._debugMode==="normal",DEBUG_LITSHADERATE:this._debugMode==="litShadeRate",DEBUG_UV:this._debugMode==="uv",OUTLINE_WIDTH_SCREEN:this._isOutline&&this._outlineWidthMode===Xd.ScreenCoordinates}}_updateTextureMatrix(n,e){n.value&&(n.value.matrixAutoUpdate&&n.value.updateMatrix(),e.value.copy(n.value.matrix))}},jI=new Set(["1.0","1.0-beta"]),mA=class Ya{get name(){return Ya.EXTENSION_NAME}constructor(e,t={}){var i,r,s,a;this.parser=e,this.materialType=(i=t.materialType)!=null?i:qI,this.renderOrderOffset=(r=t.renderOrderOffset)!=null?r:0,this.v0CompatShade=(s=t.v0CompatShade)!=null?s:!1,this.debugMode=(a=t.debugMode)!=null?a:"none",this._mToonMaterialSet=new Set}beforeRoot(){return Li(this,null,function*(){this._removeUnlitExtensionIfMToonExists()})}afterRoot(e){return Li(this,null,function*(){e.userData.vrmMToonMaterials=Array.from(this._mToonMaterialSet)})}getMaterialType(e){return this._getMToonExtension(e)?this.materialType:null}extendMaterialParams(e,t){const i=this._getMToonExtension(e);return i?this._extendMaterialParams(i,t):null}loadMesh(e){return Li(this,null,function*(){var t;const i=this.parser,s=(t=i.json.meshes)==null?void 0:t[e];if(s==null)throw new Error(`MToonMaterialLoaderPlugin: Attempt to use meshes[${e}] of glTF but the mesh doesn't exist`);const a=s.primitives,o=yield i.loadMesh(e);if(a.length===1){const l=o,c=a[0].material;c!=null&&this._setupPrimitive(l,c)}else{const l=o;for(let c=0;c<a.length;c++){const u=l.children[c],h=a[c].material;h!=null&&this._setupPrimitive(u,h)}}return o})}_removeUnlitExtensionIfMToonExists(){const i=this.parser.json.materials;i==null||i.map((r,s)=>{var a;this._getMToonExtension(s)&&((a=r.extensions)!=null&&a.KHR_materials_unlit)&&delete r.extensions.KHR_materials_unlit})}_getMToonExtension(e){var t,i;const a=(t=this.parser.json.materials)==null?void 0:t[e];if(a==null){console.warn(`MToonMaterialLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const o=(i=a.extensions)==null?void 0:i[Ya.EXTENSION_NAME];if(o==null)return;const l=o.specVersion;if(!jI.has(l)){console.warn(`MToonMaterialLoaderPlugin: Unknown ${Ya.EXTENSION_NAME} specVersion "${l}"`);return}return o}_extendMaterialParams(e,t){return Li(this,null,function*(){var i;delete t.metalness,delete t.roughness;const r=new HI(this.parser,t);r.assignPrimitive("transparentWithZWrite",e.transparentWithZWrite),r.assignColor("shadeColorFactor",e.shadeColorFactor),r.assignTexture("shadeMultiplyTexture",e.shadeMultiplyTexture,!0),r.assignPrimitive("shadingShiftFactor",e.shadingShiftFactor),r.assignTexture("shadingShiftTexture",e.shadingShiftTexture,!0),r.assignPrimitive("shadingShiftTextureScale",(i=e.shadingShiftTexture)==null?void 0:i.scale),r.assignPrimitive("shadingToonyFactor",e.shadingToonyFactor),r.assignPrimitive("giEqualizationFactor",e.giEqualizationFactor),r.assignColor("matcapFactor",e.matcapFactor),r.assignTexture("matcapTexture",e.matcapTexture,!0),r.assignColor("parametricRimColorFactor",e.parametricRimColorFactor),r.assignTexture("rimMultiplyTexture",e.rimMultiplyTexture,!0),r.assignPrimitive("rimLightingMixFactor",e.rimLightingMixFactor),r.assignPrimitive("parametricRimFresnelPowerFactor",e.parametricRimFresnelPowerFactor),r.assignPrimitive("parametricRimLiftFactor",e.parametricRimLiftFactor),r.assignPrimitive("outlineWidthMode",e.outlineWidthMode),r.assignPrimitive("outlineWidthFactor",e.outlineWidthFactor),r.assignTexture("outlineWidthMultiplyTexture",e.outlineWidthMultiplyTexture,!1),r.assignColor("outlineColorFactor",e.outlineColorFactor),r.assignPrimitive("outlineLightingMixFactor",e.outlineLightingMixFactor),r.assignTexture("uvAnimationMaskTexture",e.uvAnimationMaskTexture,!1),r.assignPrimitive("uvAnimationScrollXSpeedFactor",e.uvAnimationScrollXSpeedFactor),r.assignPrimitive("uvAnimationScrollYSpeedFactor",e.uvAnimationScrollYSpeedFactor),r.assignPrimitive("uvAnimationRotationSpeedFactor",e.uvAnimationRotationSpeedFactor),r.assignPrimitive("v0CompatShade",this.v0CompatShade),r.assignPrimitive("debugMode",this.debugMode),yield r.pending})}_setupPrimitive(e,t){const i=this._getMToonExtension(t);if(i){const r=this._parseRenderOrder(i);e.renderOrder=r+this.renderOrderOffset,this._generateOutline(e),this._addToMaterialSet(e);return}}_shouldGenerateOutline(e){return typeof e.outlineWidthMode=="string"&&e.outlineWidthMode!=="none"&&typeof e.outlineWidthFactor=="number"&&e.outlineWidthFactor>0}_generateOutline(e){const t=e.material;if(!(t instanceof nn)||!this._shouldGenerateOutline(t))return;e.material=[t];const i=t.clone();i.name+=" (Outline)",i.isOutline=!0,i.side=qt,e.material.push(i);const r=e.geometry,s=r.index?r.index.count:r.attributes.position.count/3;r.addGroup(0,s,0),r.addGroup(0,s,1)}_addToMaterialSet(e){const t=e.material,i=new Set;Array.isArray(t)?t.forEach(r=>i.add(r)):i.add(t);for(const r of i)this._mToonMaterialSet.add(r)}_parseRenderOrder(e){var t;return(e.transparentWithZWrite?0:19)+((t=e.renderQueueOffsetNumber)!=null?t:0)}};mA.EXTENSION_NAME="VRMC_materials_mtoon";var XI=mA,YI=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),gA=class Gc{get name(){return Gc.EXTENSION_NAME}constructor(e){this.parser=e}extendMaterialParams(e,t){return YI(this,null,function*(){const i=this._getHDREmissiveMultiplierExtension(e);if(i==null)return;console.warn("VRMMaterialsHDREmissiveMultiplierLoaderPlugin: `VRMC_materials_hdr_emissiveMultiplier` is archived. Use `KHR_materials_emissive_strength` instead.");const r=i.emissiveMultiplier;t.emissiveIntensity=r})}_getHDREmissiveMultiplierExtension(e){var t,i;const a=(t=this.parser.json.materials)==null?void 0:t[e];if(a==null){console.warn(`VRMMaterialsHDREmissiveMultiplierLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const o=(i=a.extensions)==null?void 0:i[Gc.EXTENSION_NAME];if(o!=null)return o}};gA.EXTENSION_NAME="VRMC_materials_hdr_emissiveMultiplier";var KI=gA,JI=Object.defineProperty,ZI=Object.defineProperties,$I=Object.getOwnPropertyDescriptors,Yd=Object.getOwnPropertySymbols,eS=Object.prototype.hasOwnProperty,tS=Object.prototype.propertyIsEnumerable,Kd=(n,e,t)=>e in n?JI(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,In=(n,e)=>{for(var t in e||(e={}))eS.call(e,t)&&Kd(n,t,e[t]);if(Yd)for(var t of Yd(e))tS.call(e,t)&&Kd(n,t,e[t]);return n},Jd=(n,e)=>ZI(n,$I(e)),nS=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())});function Mr(n){return Math.pow(n,2.2)}var iS=class{get name(){return"VRMMaterialsV0CompatPlugin"}constructor(n){var e;this.parser=n,this._renderQueueMapTransparent=new Map,this._renderQueueMapTransparentZWrite=new Map;const t=this.parser.json;t.extensionsUsed=(e=t.extensionsUsed)!=null?e:[],t.extensionsUsed.indexOf("KHR_texture_transform")===-1&&t.extensionsUsed.push("KHR_texture_transform")}beforeRoot(){return nS(this,null,function*(){var n;const e=this.parser.json,t=(n=e.extensions)==null?void 0:n.VRM,i=t==null?void 0:t.materialProperties;i&&(this._populateRenderQueueMap(i),i.forEach((r,s)=>{var a,o;const l=(a=e.materials)==null?void 0:a[s];if(l==null){console.warn(`VRMMaterialsV0CompatPlugin: Attempt to use materials[${s}] of glTF but the material doesn't exist`);return}if(r.shader==="VRM/MToon"){const c=this._parseV0MToonProperties(r,l);e.materials[s]=c}else if((o=r.shader)!=null&&o.startsWith("VRM/Unlit")){const c=this._parseV0UnlitProperties(r,l);e.materials[s]=c}else r.shader==="VRM_USE_GLTFSHADER"||console.warn(`VRMMaterialsV0CompatPlugin: Unknown shader: ${r.shader}`)}))})}_parseV0MToonProperties(n,e){var t,i,r,s,a,o,l,c,u,h,d,f,g,m,A,p,b,M,E,_,y,S,C,v,x,T,D,U,N,Q,G,X,V,ee,Z,se,pe,Ue,We,Ge,Y,J,de,Ie,xe,Ve,St,P,at,Ne,Te,_e,ot,Ee,Oe;const _t=(i=(t=n.keywordMap)==null?void 0:t._ALPHABLEND_ON)!=null?i:!1,B=((r=n.floatProperties)==null?void 0:r._ZWrite)===1&&_t,I=this._v0ParseRenderQueue(n),L=(a=(s=n.keywordMap)==null?void 0:s._ALPHATEST_ON)!=null?a:!1,O=_t?"BLEND":L?"MASK":"OPAQUE",j=L?(l=(o=n.floatProperties)==null?void 0:o._Cutoff)!=null?l:.5:void 0,fe=((u=(c=n.floatProperties)==null?void 0:c._CullMode)!=null?u:2)===0,$=this._portTextureTransform(n),me=((d=(h=n.vectorProperties)==null?void 0:h._Color)!=null?d:[1,1,1,1]).map((W,q)=>q===3?W:Mr(W)),Ae=(f=n.textureProperties)==null?void 0:f._MainTex,ie=Ae!=null?{index:Ae,extensions:In({},$)}:void 0,ce=(m=(g=n.floatProperties)==null?void 0:g._BumpScale)!=null?m:1,Se=(A=n.textureProperties)==null?void 0:A._BumpMap,ye=Se!=null?{index:Se,scale:ce,extensions:In({},$)}:void 0,le=((b=(p=n.vectorProperties)==null?void 0:p._EmissionColor)!=null?b:[0,0,0,1]).map(Mr),Re=(M=n.textureProperties)==null?void 0:M._EmissionMap,F=Re!=null?{index:Re,extensions:In({},$)}:void 0,te=((_=(E=n.vectorProperties)==null?void 0:E._ShadeColor)!=null?_:[.97,.81,.86,1]).map(Mr),ae=(y=n.textureProperties)==null?void 0:y._ShadeTexture,ue=ae!=null?{index:ae,extensions:In({},$)}:void 0;let ne=(C=(S=n.floatProperties)==null?void 0:S._ShadeShift)!=null?C:0,K=(x=(v=n.floatProperties)==null?void 0:v._ShadeToony)!=null?x:.9;K=Mt.lerp(K,1,.5+.5*ne),ne=-ne-(1-K);const ve=(D=(T=n.floatProperties)==null?void 0:T._IndirectLightIntensity)!=null?D:.1,ke=ve?1-ve:void 0,it=(U=n.textureProperties)==null?void 0:U._SphereAdd,Ze=it!=null?[1,1,1]:void 0,pn=it!=null?{index:it}:void 0,rn=(Q=(N=n.floatProperties)==null?void 0:N._RimLightingMix)!=null?Q:0,$r=(G=n.textureProperties)==null?void 0:G._RimTexture,Un=$r!=null?{index:$r,extensions:In({},$)}:void 0,es=((V=(X=n.vectorProperties)==null?void 0:X._RimColor)!=null?V:[0,0,0,1]).map(Mr),$s=(Z=(ee=n.floatProperties)==null?void 0:ee._RimFresnelPower)!=null?Z:1,ea=(pe=(se=n.floatProperties)==null?void 0:se._RimLift)!=null?pe:0,Yi=["none","worldCoordinates","screenCoordinates"][(We=(Ue=n.floatProperties)==null?void 0:Ue._OutlineWidthMode)!=null?We:0];let Ki=(Y=(Ge=n.floatProperties)==null?void 0:Ge._OutlineWidth)!=null?Y:0;Ki=.01*Ki;const ci=(J=n.textureProperties)==null?void 0:J._OutlineWidthTexture,ta=ci!=null?{index:ci,extensions:In({},$)}:void 0,na=((Ie=(de=n.vectorProperties)==null?void 0:de._OutlineColor)!=null?Ie:[0,0,0]).map(Mr),Fo=((Ve=(xe=n.floatProperties)==null?void 0:xe._OutlineColorMode)!=null?Ve:0)===1?(P=(St=n.floatProperties)==null?void 0:St._OutlineLightingMix)!=null?P:1:0,ia=(at=n.textureProperties)==null?void 0:at._UvAnimMaskTexture,Oo=ia!=null?{index:ia,extensions:In({},$)}:void 0,ko=(Te=(Ne=n.floatProperties)==null?void 0:Ne._UvAnimScrollX)!=null?Te:0;let Ji=(ot=(_e=n.floatProperties)==null?void 0:_e._UvAnimScrollY)!=null?ot:0;Ji!=null&&(Ji=-Ji);const w=(Oe=(Ee=n.floatProperties)==null?void 0:Ee._UvAnimRotation)!=null?Oe:0,k={specVersion:"1.0",transparentWithZWrite:B,renderQueueOffsetNumber:I,shadeColorFactor:te,shadeMultiplyTexture:ue,shadingShiftFactor:ne,shadingToonyFactor:K,giEqualizationFactor:ke,matcapFactor:Ze,matcapTexture:pn,rimLightingMixFactor:rn,rimMultiplyTexture:Un,parametricRimColorFactor:es,parametricRimFresnelPowerFactor:$s,parametricRimLiftFactor:ea,outlineWidthMode:Yi,outlineWidthFactor:Ki,outlineWidthMultiplyTexture:ta,outlineColorFactor:na,outlineLightingMixFactor:Fo,uvAnimationMaskTexture:Oo,uvAnimationScrollXSpeedFactor:ko,uvAnimationScrollYSpeedFactor:Ji,uvAnimationRotationSpeedFactor:w};return Jd(In({},e),{pbrMetallicRoughness:{baseColorFactor:me,baseColorTexture:ie},normalTexture:ye,emissiveTexture:F,emissiveFactor:le,alphaMode:O,alphaCutoff:j,doubleSided:fe,extensions:{VRMC_materials_mtoon:k}})}_parseV0UnlitProperties(n,e){var t,i,r,s,a;const o=n.shader==="VRM/UnlitTransparentZWrite",l=n.shader==="VRM/UnlitTransparent"||o,c=this._v0ParseRenderQueue(n),u=n.shader==="VRM/UnlitCutout",h=l?"BLEND":u?"MASK":"OPAQUE",d=u?(i=(t=n.floatProperties)==null?void 0:t._Cutoff)!=null?i:.5:void 0,f=this._portTextureTransform(n),g=((s=(r=n.vectorProperties)==null?void 0:r._Color)!=null?s:[1,1,1,1]).map(Mr),m=(a=n.textureProperties)==null?void 0:a._MainTex,A=m!=null?{index:m,extensions:In({},f)}:void 0,p={specVersion:"1.0",transparentWithZWrite:o,renderQueueOffsetNumber:c,shadeColorFactor:g,shadeMultiplyTexture:A};return Jd(In({},e),{pbrMetallicRoughness:{baseColorFactor:g,baseColorTexture:A},alphaMode:h,alphaCutoff:d,extensions:{VRMC_materials_mtoon:p}})}_portTextureTransform(n){var e,t,i,r,s;const a=(e=n.vectorProperties)==null?void 0:e._MainTex;if(a==null)return{};const o=[(t=a==null?void 0:a[0])!=null?t:0,(i=a==null?void 0:a[1])!=null?i:0],l=[(r=a==null?void 0:a[2])!=null?r:1,(s=a==null?void 0:a[3])!=null?s:1];return o[1]=1-l[1]-o[1],{KHR_texture_transform:{offset:o,scale:l}}}_v0ParseRenderQueue(n){var e,t;const i=n.shader==="VRM/UnlitTransparentZWrite",r=((e=n.keywordMap)==null?void 0:e._ALPHABLEND_ON)!=null||n.shader==="VRM/UnlitTransparent"||i,s=((t=n.floatProperties)==null?void 0:t._ZWrite)===1||i;let a=0;if(r){const o=n.renderQueue;o!=null&&(s?a=this._renderQueueMapTransparentZWrite.get(o):a=this._renderQueueMapTransparent.get(o))}return a}_populateRenderQueueMap(n){const e=new Set,t=new Set;n.forEach(i=>{var r,s;const a=i.shader==="VRM/UnlitTransparentZWrite",o=((r=i.keywordMap)==null?void 0:r._ALPHABLEND_ON)!=null||i.shader==="VRM/UnlitTransparent"||a,l=((s=i.floatProperties)==null?void 0:s._ZWrite)===1||a;if(o){const c=i.renderQueue;c!=null&&(l?t.add(c):e.add(c))}}),e.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${e.size} render queues for Transparent materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),t.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${t.size} render queues for TransparentZWrite materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),Array.from(e).sort().forEach((i,r)=>{const s=Math.min(Math.max(r-e.size+1,-9),0);this._renderQueueMapTransparent.set(i,s)}),Array.from(t).sort().forEach((i,r)=>{const s=Math.min(Math.max(r,0),9);this._renderQueueMapTransparentZWrite.set(i,s)})}},Zd=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),ri=new R,Hl=class extends mt{constructor(n){super(),this._attrPosition=new tt(new Float32Array([0,0,0,0,0,0]),3),this._attrPosition.setUsage(f_);const e=new dt;e.setAttribute("position",this._attrPosition);const t=new ji({color:16711935,depthTest:!1,depthWrite:!1});this._line=new To(e,t),this.add(this._line),this.constraint=n}updateMatrixWorld(n){ri.setFromMatrixPosition(this.constraint.destination.matrixWorld),this._attrPosition.setXYZ(0,ri.x,ri.y,ri.z),this.constraint.source&&ri.setFromMatrixPosition(this.constraint.source.matrixWorld),this._attrPosition.setXYZ(1,ri.x,ri.y,ri.z),this._attrPosition.needsUpdate=!0,super.updateMatrixWorld(n)}};function $d(n,e){return e.set(n.elements[12],n.elements[13],n.elements[14])}var rS=new R,sS=new R;function aS(n,e){return n.decompose(rS,e,sS),e}function vo(n){return n.invert?n.invert():n.inverse(),n}var bu=class{constructor(n,e){this.destination=n,this.source=e,this.weight=1}},oS=new R,lS=new R,cS=new R,uS=new Qe,hS=new Qe,dS=new Qe,fS=class extends bu{get aimAxis(){return this._aimAxis}set aimAxis(n){this._aimAxis=n,this._v3AimAxis.set(n==="PositiveX"?1:n==="NegativeX"?-1:0,n==="PositiveY"?1:n==="NegativeY"?-1:0,n==="PositiveZ"?1:n==="NegativeZ"?-1:0)}get dependencies(){const n=new Set([this.source]);return this.destination.parent&&n.add(this.destination.parent),n}constructor(n,e){super(n,e),this._aimAxis="PositiveX",this._v3AimAxis=new R(1,0,0),this._dstRestQuat=new Qe}setInitState(){this._dstRestQuat.copy(this.destination.quaternion)}update(){this.destination.updateWorldMatrix(!0,!1),this.source.updateWorldMatrix(!0,!1);const n=uS.identity(),e=hS.identity();this.destination.parent&&(aS(this.destination.parent.matrixWorld,n),vo(e.copy(n)));const t=oS.copy(this._v3AimAxis).applyQuaternion(this._dstRestQuat).applyQuaternion(n),i=$d(this.source.matrixWorld,lS).sub($d(this.destination.matrixWorld,cS)).normalize(),r=dS.setFromUnitVectors(t,i).premultiply(e).multiply(n).multiply(this._dstRestQuat);this.destination.quaternion.copy(this._dstRestQuat).slerp(r,this.weight)}};function pS(n,e){const t=[n];let i=n.parent;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(r=>{e(r)})}var AS=class{constructor(){this._constraints=new Set,this._objectConstraintsMap=new Map}get constraints(){return this._constraints}addConstraint(n){this._constraints.add(n);let e=this._objectConstraintsMap.get(n.destination);e==null&&(e=new Set,this._objectConstraintsMap.set(n.destination,e)),e.add(n)}deleteConstraint(n){this._constraints.delete(n),this._objectConstraintsMap.get(n.destination).delete(n)}setInitState(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.setInitState())}update(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.update())}_processConstraint(n,e,t,i){if(t.has(n))return;if(e.has(n))throw new Error("VRMNodeConstraintManager: Circular dependency detected while updating constraints");e.add(n);const r=n.dependencies;for(const s of r)pS(s,a=>{const o=this._objectConstraintsMap.get(a);if(o)for(const l of o)this._processConstraint(l,e,t,i)});i(n),t.add(n)}},mS=new Qe,gS=new Qe,_S=class extends bu{get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._dstRestQuat=new Qe,this._invSrcRestQuat=new Qe}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),vo(this._invSrcRestQuat.copy(this.source.quaternion))}update(){const n=mS.copy(this._invSrcRestQuat).multiply(this.source.quaternion),e=gS.copy(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(e,this.weight)}},ES=new R,vS=new Qe,bS=new Qe,xS=class extends bu{get rollAxis(){return this._rollAxis}set rollAxis(n){this._rollAxis=n,this._v3RollAxis.set(n==="X"?1:0,n==="Y"?1:0,n==="Z"?1:0)}get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._rollAxis="X",this._v3RollAxis=new R(1,0,0),this._dstRestQuat=new Qe,this._invDstRestQuat=new Qe,this._invSrcRestQuatMulDstRestQuat=new Qe}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),vo(this._invDstRestQuat.copy(this._dstRestQuat)),vo(this._invSrcRestQuatMulDstRestQuat.copy(this.source.quaternion)).multiply(this._dstRestQuat)}update(){const n=vS.copy(this._invDstRestQuat).multiply(this.source.quaternion).multiply(this._invSrcRestQuatMulDstRestQuat),e=ES.copy(this._v3RollAxis).applyQuaternion(n),i=bS.setFromUnitVectors(e,this._v3RollAxis).premultiply(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(i,this.weight)}},yS=new Set(["1.0","1.0-beta"]),_A=class Ts{get name(){return Ts.EXTENSION_NAME}constructor(e,t){this.parser=e,this.helperRoot=t==null?void 0:t.helperRoot}afterRoot(e){return Zd(this,null,function*(){e.userData.vrmNodeConstraintManager=yield this._import(e)})}_import(e){return Zd(this,null,function*(){var t;const i=this.parser.json;if(!(((t=i.extensionsUsed)==null?void 0:t.indexOf(Ts.EXTENSION_NAME))!==-1))return null;const s=new AS,a=yield this.parser.getDependencies("node");return a.forEach((o,l)=>{var c;const u=i.nodes[l],h=(c=u==null?void 0:u.extensions)==null?void 0:c[Ts.EXTENSION_NAME];if(h==null)return;const d=h.specVersion;if(!yS.has(d)){console.warn(`VRMNodeConstraintLoaderPlugin: Unknown ${Ts.EXTENSION_NAME} specVersion "${d}"`);return}const f=h.constraint;if(f.roll!=null){const g=this._importRollConstraint(o,a,f.roll);s.addConstraint(g)}else if(f.aim!=null){const g=this._importAimConstraint(o,a,f.aim);s.addConstraint(g)}else if(f.rotation!=null){const g=this._importRotationConstraint(o,a,f.rotation);s.addConstraint(g)}}),e.scene.updateMatrixWorld(),s.setInitState(),s})}_importRollConstraint(e,t,i){const{source:r,rollAxis:s,weight:a}=i,o=t[r],l=new xS(e,o);if(s!=null&&(l.rollAxis=s),a!=null&&(l.weight=a),this.helperRoot){const c=new Hl(l);this.helperRoot.add(c)}return l}_importAimConstraint(e,t,i){const{source:r,aimAxis:s,weight:a}=i,o=t[r],l=new fS(e,o);if(s!=null&&(l.aimAxis=s),a!=null&&(l.weight=a),this.helperRoot){const c=new Hl(l);this.helperRoot.add(c)}return l}_importRotationConstraint(e,t,i){const{source:r,weight:s}=i,a=t[r],o=new _S(e,a);if(s!=null&&(o.weight=s),this.helperRoot){const l=new Hl(o);this.helperRoot.add(l)}return o}};_A.EXTENSION_NAME="VRMC_node_constraint";var MS=_A,ka=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),xu=class{},Gl=new R,yi=new R,EA=class extends xu{get type(){return"capsule"}constructor(n){var e,t,i,r;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.tail=(t=n==null?void 0:n.tail)!=null?t:new R(0,0,0),this.radius=(i=n==null?void 0:n.radius)!=null?i:0,this.inside=(r=n==null?void 0:n.inside)!=null?r:!1}calculateCollision(n,e,t,i){Gl.setFromMatrixPosition(n),yi.subVectors(this.tail,this.offset).applyMatrix4(n),yi.sub(Gl);const r=yi.lengthSq();i.copy(e).sub(Gl);const s=yi.dot(i);s<=0||(r<=s||yi.multiplyScalar(s/r),i.sub(yi));const a=i.length(),o=this.inside?this.radius-t-a:a-t-this.radius;return o<0&&(i.multiplyScalar(1/a),this.inside&&i.negate()),o}},Vl=new R,ef=new Le,vA=class extends xu{get type(){return"plane"}constructor(n){var e,t;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.normal=(t=n==null?void 0:n.normal)!=null?t:new R(0,0,1)}calculateCollision(n,e,t,i){i.setFromMatrixPosition(n),i.negate().add(e),ef.getNormalMatrix(n),Vl.copy(this.normal).applyNormalMatrix(ef).normalize();const r=i.dot(Vl)-t;return i.copy(Vl),r}},IS=new R,bA=class extends xu{get type(){return"sphere"}constructor(n){var e,t,i;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.radius=(t=n==null?void 0:n.radius)!=null?t:0,this.inside=(i=n==null?void 0:n.inside)!=null?i:!1}calculateCollision(n,e,t,i){i.subVectors(e,IS.setFromMatrixPosition(n));const r=i.length(),s=this.inside?this.radius-t-r:r-t-this.radius;return s<0&&(i.multiplyScalar(1/r),this.inside&&i.negate()),s}},Sn=new R,SS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new R,this._currentTail=new R,this._shape=n,this._attrPos=new tt(new Float32Array(396),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(264),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0);const t=Sn.copy(this._shape.tail).divideScalar(this.worldScale);this._currentTail.distanceToSquared(t)>1e-10&&(this._currentTail.copy(t),n=!0),n&&this._buildPosition()}_buildPosition(){Sn.copy(this._currentTail).sub(this._currentOffset);const n=Sn.length()/this._currentRadius;for(let i=0;i<=16;i++){const r=i/16*Math.PI;this._attrPos.setXYZ(i,-Math.sin(r),-Math.cos(r),0),this._attrPos.setXYZ(17+i,n+Math.sin(r),Math.cos(r),0),this._attrPos.setXYZ(34+i,-Math.sin(r),0,-Math.cos(r)),this._attrPos.setXYZ(51+i,n+Math.sin(r),0,Math.cos(r))}for(let i=0;i<32;i++){const r=i/16*Math.PI;this._attrPos.setXYZ(68+i,0,Math.sin(r),Math.cos(r)),this._attrPos.setXYZ(100+i,n,Math.sin(r),Math.cos(r))}const e=Math.atan2(Sn.y,Math.sqrt(Sn.x*Sn.x+Sn.z*Sn.z)),t=-Math.atan2(Sn.z,Sn.x);this.rotateZ(e),this.rotateY(t),this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<34;n++){const e=(n+1)%34;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(68+n*2,34+n,34+e)}for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(136+n*2,68+n,68+e),this._attrIndex.setXY(200+n*2,100+n,100+e)}this._attrIndex.needsUpdate=!0}},CS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentOffset=new R,this._currentNormal=new R,this._shape=n,this._attrPos=new tt(new Float32Array(18),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(10),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),this._currentNormal.equals(this._shape.normal)||(this._currentNormal.copy(this._shape.normal),n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,-.5,-.5,0),this._attrPos.setXYZ(1,.5,-.5,0),this._attrPos.setXYZ(2,.5,.5,0),this._attrPos.setXYZ(3,-.5,.5,0),this._attrPos.setXYZ(4,0,0,0),this._attrPos.setXYZ(5,0,0,.25),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this.lookAt(this._currentNormal),this._attrPos.needsUpdate=!0}_buildIndex(){this._attrIndex.setXY(0,0,1),this._attrIndex.setXY(2,1,2),this._attrIndex.setXY(4,2,3),this._attrIndex.setXY(6,3,0),this._attrIndex.setXY(8,4,5),this._attrIndex.needsUpdate=!0}},wS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new R,this._shape=n,this._attrPos=new tt(new Float32Array(288),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(192),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.needsUpdate=!0}},TS=new R,zl=class extends mt{constructor(n){if(super(),this.matrixAutoUpdate=!1,this.collider=n,this.collider.shape instanceof bA)this._geometry=new wS(this.collider.shape);else if(this.collider.shape instanceof EA)this._geometry=new SS(this.collider.shape);else if(this.collider.shape instanceof vA)this._geometry=new CS(this.collider.shape);else throw new Error("VRMSpringBoneColliderHelper: Unknown collider shape type detected");const e=new ji({color:16711935,depthTest:!1,depthWrite:!1});this._line=new Js(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.collider.updateWorldMatrix(!0,!1),this.matrix.copy(this.collider.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=TS.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},RS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentTail=new R,this._springBone=n,this._attrPos=new tt(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._springBone.settings.hitRadius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentTail.equals(this._springBone.initialLocalChildPosition)||(this._currentTail.copy(this._springBone.initialLocalChildPosition),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},BS=new R,LS=class extends mt{constructor(n){super(),this.matrixAutoUpdate=!1,this.springBone=n,this._geometry=new RS(this.springBone);const e=new ji({color:16776960,depthTest:!1,depthWrite:!1});this._line=new Js(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.springBone.bone.updateWorldMatrix(!0,!1),this.matrix.copy(this.springBone.bone.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=BS.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},Wl=class extends ct{constructor(n){super(),this.colliderMatrix=new De,this.shape=n}updateWorldMatrix(n,e){super.updateWorldMatrix(n,e),DS(this.colliderMatrix,this.matrixWorld,this.shape.offset)}};function DS(n,e,t){const i=e.elements;n.copy(e),t&&(n.elements[12]=i[0]*t.x+i[4]*t.y+i[8]*t.z+i[12],n.elements[13]=i[1]*t.x+i[5]*t.y+i[9]*t.z+i[13],n.elements[14]=i[2]*t.x+i[6]*t.y+i[10]*t.z+i[14])}var PS=new De;function US(n){return n.invert?n.invert():n.getInverse(PS.copy(n)),n}var NS=class{constructor(n){this._inverseCache=new De,this._shouldUpdateInverse=!0,this.matrix=n;const e={set:(t,i,r)=>(this._shouldUpdateInverse=!0,t[i]=r,!0)};this._originalElements=n.elements,n.elements=new Proxy(n.elements,e)}get inverse(){return this._shouldUpdateInverse&&(US(this._inverseCache.copy(this.matrix)),this._shouldUpdateInverse=!1),this._inverseCache}revert(){this.matrix.elements=this._originalElements}},ql=new De,Ir=new R,bs=new R,xs=new R,ys=new R,FS=new De,OS=class{constructor(n,e,t={},i=[]){this._currentTail=new R,this._prevTail=new R,this._boneAxis=new R,this._worldSpaceBoneLength=0,this._center=null,this._initialLocalMatrix=new De,this._initialLocalRotation=new Qe,this._initialLocalChildPosition=new R;var r,s,a,o,l,c;this.bone=n,this.bone.matrixAutoUpdate=!1,this.child=e,this.settings={hitRadius:(r=t.hitRadius)!=null?r:0,stiffness:(s=t.stiffness)!=null?s:1,gravityPower:(a=t.gravityPower)!=null?a:0,gravityDir:(l=(o=t.gravityDir)==null?void 0:o.clone())!=null?l:new R(0,-1,0),dragForce:(c=t.dragForce)!=null?c:.4},this.colliderGroups=i}get dependencies(){const n=new Set,e=this.bone.parent;e&&n.add(e);for(let t=0;t<this.colliderGroups.length;t++)for(let i=0;i<this.colliderGroups[t].colliders.length;i++)n.add(this.colliderGroups[t].colliders[i]);return n}get center(){return this._center}set center(n){var e;(e=this._center)!=null&&e.userData.inverseCacheProxy&&(this._center.userData.inverseCacheProxy.revert(),delete this._center.userData.inverseCacheProxy),this._center=n,this._center&&(this._center.userData.inverseCacheProxy||(this._center.userData.inverseCacheProxy=new NS(this._center.matrixWorld)))}get initialLocalChildPosition(){return this._initialLocalChildPosition}get _parentMatrixWorld(){return this.bone.parent?this.bone.parent.matrixWorld:ql}setInitState(){this._initialLocalMatrix.copy(this.bone.matrix),this._initialLocalRotation.copy(this.bone.quaternion),this.child?this._initialLocalChildPosition.copy(this.child.position):this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(.07);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail),this._boneAxis.copy(this._initialLocalChildPosition).normalize()}reset(){this.bone.quaternion.copy(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail)}update(n){if(n<=0)return;this._calcWorldSpaceBoneLength();const e=bs.copy(this._boneAxis).transformDirection(this._initialLocalMatrix).transformDirection(this._parentMatrixWorld);ys.copy(this._currentTail).add(Ir.subVectors(this._currentTail,this._prevTail).multiplyScalar(1-this.settings.dragForce)).applyMatrix4(this._getMatrixCenterToWorld()).addScaledVector(e,this.settings.stiffness*n).addScaledVector(this.settings.gravityDir,this.settings.gravityPower*n),xs.setFromMatrixPosition(this.bone.matrixWorld),ys.sub(xs).normalize().multiplyScalar(this._worldSpaceBoneLength).add(xs),this._collision(ys),this._prevTail.copy(this._currentTail),this._currentTail.copy(ys).applyMatrix4(this._getMatrixWorldToCenter());const t=FS.multiplyMatrices(this._parentMatrixWorld,this._initialLocalMatrix).invert();this.bone.quaternion.setFromUnitVectors(this._boneAxis,Ir.copy(ys).applyMatrix4(t).normalize()).premultiply(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix)}_collision(n){for(let e=0;e<this.colliderGroups.length;e++)for(let t=0;t<this.colliderGroups[e].colliders.length;t++){const i=this.colliderGroups[e].colliders[t],r=i.shape.calculateCollision(i.colliderMatrix,n,this.settings.hitRadius,Ir);if(r<0){n.addScaledVector(Ir,-r),n.sub(xs);const s=n.length();n.multiplyScalar(this._worldSpaceBoneLength/s).add(xs)}}}_calcWorldSpaceBoneLength(){Ir.setFromMatrixPosition(this.bone.matrixWorld),this.child?bs.setFromMatrixPosition(this.child.matrixWorld):(bs.copy(this._initialLocalChildPosition),bs.applyMatrix4(this.bone.matrixWorld)),this._worldSpaceBoneLength=Ir.sub(bs).length()}_getMatrixCenterToWorld(){return this._center?this._center.matrixWorld:ql}_getMatrixWorldToCenter(){return this._center?this._center.userData.inverseCacheProxy.inverse:ql}};function kS(n,e){const t=[];let i=n;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(r=>{e(r)})}function Vc(n,e){n.children.forEach(t=>{e(t)||Vc(t,e)})}function QS(n){var e;const t=new Map;for(const i of n){let r=i;do{const s=((e=t.get(r))!=null?e:0)+1;if(s===n.size)return r;t.set(r,s),r=r.parent}while(r!==null)}return null}var tf=class{constructor(){this._joints=new Set,this._sortedJoints=[],this._hasWarnedCircularDependency=!1,this._ancestors=[],this._objectSpringBonesMap=new Map,this._isSortedJointsDirty=!1,this._relevantChildrenUpdated=this._relevantChildrenUpdated.bind(this)}get joints(){return this._joints}get springBones(){return console.warn("VRMSpringBoneManager: springBones is deprecated. use joints instead."),this._joints}get colliderGroups(){const n=new Set;return this._joints.forEach(e=>{e.colliderGroups.forEach(t=>{n.add(t)})}),Array.from(n)}get colliders(){const n=new Set;return this.colliderGroups.forEach(e=>{e.colliders.forEach(t=>{n.add(t)})}),Array.from(n)}addJoint(n){this._joints.add(n);let e=this._objectSpringBonesMap.get(n.bone);e==null&&(e=new Set,this._objectSpringBonesMap.set(n.bone,e)),e.add(n),this._isSortedJointsDirty=!0}addSpringBone(n){console.warn("VRMSpringBoneManager: addSpringBone() is deprecated. use addJoint() instead."),this.addJoint(n)}deleteJoint(n){this._joints.delete(n),this._objectSpringBonesMap.get(n.bone).delete(n),this._isSortedJointsDirty=!0}deleteSpringBone(n){console.warn("VRMSpringBoneManager: deleteSpringBone() is deprecated. use deleteJoint() instead."),this.deleteJoint(n)}setInitState(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.setInitState()}}reset(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.reset()}}update(n){this._sortJoints();for(let e=0;e<this._ancestors.length;e++)this._ancestors[e].updateWorldMatrix(e===0,!1);for(let e=0;e<this._sortedJoints.length;e++){const t=this._sortedJoints[e];t.bone.updateMatrix(),t.bone.updateWorldMatrix(!1,!1),t.update(n),Vc(t.bone,this._relevantChildrenUpdated)}}_sortJoints(){if(!this._isSortedJointsDirty)return;const n=[],e=new Set,t=new Set,i=new Set;for(const s of this._joints)this._insertJointSort(s,e,t,n,i);this._sortedJoints=n;const r=QS(i);this._ancestors=[],r&&(this._ancestors.push(r),Vc(r,s=>{var a,o;return((o=(a=this._objectSpringBonesMap.get(s))==null?void 0:a.size)!=null?o:0)>0?!0:(this._ancestors.push(s),!1)})),this._isSortedJointsDirty=!1}_insertJointSort(n,e,t,i,r){if(t.has(n))return;if(e.has(n)){this._hasWarnedCircularDependency||(console.warn("VRMSpringBoneManager: Circular dependency detected"),this._hasWarnedCircularDependency=!0);return}e.add(n);const s=n.dependencies;for(const a of s){let o=!1,l=null;kS(a,c=>{const u=this._objectSpringBonesMap.get(c);if(u)for(const h of u)o=!0,this._insertJointSort(h,e,t,i,r);else o||(l=c)}),l&&r.add(l)}i.push(n),t.add(n)}_relevantChildrenUpdated(n){var e,t;return((t=(e=this._objectSpringBonesMap.get(n))==null?void 0:e.size)!=null?t:0)>0?!0:(n.updateWorldMatrix(!1,!1),!1)}},nf="VRMC_springBone_extended_collider",HS=new Set(["1.0","1.0-beta"]),GS=new Set(["1.0"]),xA=class Cr{get name(){return Cr.EXTENSION_NAME}constructor(e,t){var i;this.parser=e,this.jointHelperRoot=t==null?void 0:t.jointHelperRoot,this.colliderHelperRoot=t==null?void 0:t.colliderHelperRoot,this.useExtendedColliders=(i=t==null?void 0:t.useExtendedColliders)!=null?i:!0}afterRoot(e){return ka(this,null,function*(){e.userData.vrmSpringBoneManager=yield this._import(e)})}_import(e){return ka(this,null,function*(){const t=yield this._v1Import(e);if(t!=null)return t;const i=yield this._v0Import(e);return i??null})}_v1Import(e){return ka(this,null,function*(){var t,i,r,s,a;const o=e.parser.json;if(!(((t=o.extensionsUsed)==null?void 0:t.indexOf(Cr.EXTENSION_NAME))!==-1))return null;const c=new tf,u=yield e.parser.getDependencies("node"),h=(i=o.extensions)==null?void 0:i[Cr.EXTENSION_NAME];if(!h)return null;const d=h.specVersion;if(!HS.has(d))return console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${Cr.EXTENSION_NAME} specVersion "${d}"`),null;const f=(r=h.colliders)==null?void 0:r.map((m,A)=>{var p,b,M,E,_,y,S,C,v,x,T,D,U,N,Q;const G=u[m.node];if(G==null)return console.warn(`VRMSpringBoneLoaderPlugin: The collider #${A} attempted to reference a node #${m.node} but not found. Skipping the collider`),null;const X=m.shape,V=(p=m.extensions)==null?void 0:p[nf];if(this.useExtendedColliders&&V!=null){const ee=V.specVersion;if(!GS.has(ee))console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${nf} specVersion "${ee}". Fallbacking to the ${Cr.EXTENSION_NAME} definition`);else{const Z=V.shape;if(Z.sphere)return this._importSphereCollider(G,{offset:new R().fromArray((b=Z.sphere.offset)!=null?b:[0,0,0]),radius:(M=Z.sphere.radius)!=null?M:0,inside:(E=Z.sphere.inside)!=null?E:!1});if(Z.capsule)return this._importCapsuleCollider(G,{offset:new R().fromArray((_=Z.capsule.offset)!=null?_:[0,0,0]),radius:(y=Z.capsule.radius)!=null?y:0,tail:new R().fromArray((S=Z.capsule.tail)!=null?S:[0,0,0]),inside:(C=Z.capsule.inside)!=null?C:!1});if(Z.plane)return this._importPlaneCollider(G,{offset:new R().fromArray((v=Z.plane.offset)!=null?v:[0,0,0]),normal:new R().fromArray((x=Z.plane.normal)!=null?x:[0,0,1])})}}if(X.sphere)return this._importSphereCollider(G,{offset:new R().fromArray((T=X.sphere.offset)!=null?T:[0,0,0]),radius:(D=X.sphere.radius)!=null?D:0,inside:!1});if(X.capsule)return this._importCapsuleCollider(G,{offset:new R().fromArray((U=X.capsule.offset)!=null?U:[0,0,0]),radius:(N=X.capsule.radius)!=null?N:0,tail:new R().fromArray((Q=X.capsule.tail)!=null?Q:[0,0,0]),inside:!1});console.warn(`VRMSpringBoneLoaderPlugin: The collider #${A} has no valid shape. Skipping the collider`)}),g=(s=h.colliderGroups)==null?void 0:s.map((m,A)=>{var p;return{colliders:((p=m.colliders)!=null?p:[]).map(M=>{const E=f==null?void 0:f[M];return E??(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${A} attempted to reference a collider #${M} but not found. Skipping the collider`),null)}).filter(M=>M!=null),name:m.name}});return(a=h.springs)==null||a.forEach((m,A)=>{var p;const b=m.joints,M=(p=m.colliderGroups)==null?void 0:p.map(y=>{const S=g==null?void 0:g[y];return S??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${A} attempted to reference a collider group #${y} but not found. Skipping the collider group`),null)}).filter(y=>y!=null),E=m.center!=null?u[m.center]:void 0;let _;b.forEach(y=>{if(_){const S=_.node,C=u[S],v=y.node,x=u[v],T={hitRadius:_.hitRadius,dragForce:_.dragForce,gravityPower:_.gravityPower,stiffness:_.stiffness,gravityDir:_.gravityDir!=null?new R().fromArray(_.gravityDir):void 0},D=this._importJoint(C,x,T,M);E&&(D.center=E),c.addJoint(D)}_=y})}),c.setInitState(),c})}_v0Import(e){return ka(this,null,function*(){var t,i,r;const s=e.parser.json;if(!(((t=s.extensionsUsed)==null?void 0:t.indexOf("VRM"))!==-1))return null;const o=(i=s.extensions)==null?void 0:i.VRM,l=o==null?void 0:o.secondaryAnimation;if(!l)return null;const c=l==null?void 0:l.boneGroups;if(!c)return null;const u=new tf,h=yield e.parser.getDependencies("node"),d=(r=l.colliderGroups)==null?void 0:r.map((f,g)=>{var m;const A=h[f.node];return A==null?(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${g} attempted to reference a node #${f.node} but not found. Skipping the collider group`),null):{colliders:((m=f.colliders)!=null?m:[]).map((b,M)=>{var E,_,y;const S=new R(0,0,0);return b.offset&&S.set((E=b.offset.x)!=null?E:0,(_=b.offset.y)!=null?_:0,b.offset.z?-b.offset.z:0),this._importSphereCollider(A,{offset:S,radius:(y=b.radius)!=null?y:0,inside:!1})})}});return c==null||c.forEach((f,g)=>{const m=f.bones;m&&m.forEach(A=>{var p,b,M,E;const _=h[A];if(_==null){console.warn(`VRMSpringBoneLoaderPlugin: The spring bone group #${g} attempted to reference a node #${A} but not found. Skipping the node`);return}const y=new R;f.gravityDir?y.set((p=f.gravityDir.x)!=null?p:0,(b=f.gravityDir.y)!=null?b:0,(M=f.gravityDir.z)!=null?M:0):y.set(0,-1,0);const S=f.center!=null?h[f.center]:void 0,C={hitRadius:f.hitRadius,dragForce:f.dragForce,gravityPower:f.gravityPower,stiffness:f.stiffiness,gravityDir:y},v=(E=f.colliderGroups)==null?void 0:E.map(x=>{const T=d==null?void 0:d[x];return T??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${g} attempted to reference a collider group #${x} but not found. Skipping the collider group`),null)}).filter(x=>x!=null);_.traverse(x=>{var T;const D=(T=x.children[0])!=null?T:null,U=this._importJoint(x,D,C,v);S&&(U.center=S),u.addJoint(U)})})}),e.scene.updateMatrixWorld(),u.setInitState(),u})}_importJoint(e,t,i,r){const s=new OS(e,t,i,r);if(this.jointHelperRoot){const a=new LS(s);this.jointHelperRoot.add(a),a.renderOrder=this.jointHelperRoot.renderOrder}return s}_importSphereCollider(e,t){const i=new bA(t),r=new Wl(i);if(e.add(r),this.colliderHelperRoot){const s=new zl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}_importCapsuleCollider(e,t){const i=new EA(t),r=new Wl(i);if(e.add(r),this.colliderHelperRoot){const s=new zl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}_importPlaneCollider(e,t){const i=new vA(t),r=new Wl(i);if(e.add(r),this.colliderHelperRoot){const s=new zl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}};xA.EXTENSION_NAME="VRMC_springBone";var VS=xA,zS=class{get name(){return"VRMLoaderPlugin"}constructor(n,e){var t,i,r,s,a,o,l,c,u,h;this.parser=n;const d=e==null?void 0:e.helperRoot,f=e==null?void 0:e.autoUpdateHumanBones;this.expressionPlugin=(t=e==null?void 0:e.expressionPlugin)!=null?t:new aI(n),this.firstPersonPlugin=(i=e==null?void 0:e.firstPersonPlugin)!=null?i:new lI(n),this.humanoidPlugin=(r=e==null?void 0:e.humanoidPlugin)!=null?r:new AI(n,{helperRoot:d,autoUpdateHumanBones:f}),this.lookAtPlugin=(s=e==null?void 0:e.lookAtPlugin)!=null?s:new RI(n,{helperRoot:d}),this.metaPlugin=(a=e==null?void 0:e.metaPlugin)!=null?a:new DI(n),this.mtoonMaterialPlugin=(o=e==null?void 0:e.mtoonMaterialPlugin)!=null?o:new XI(n),this.materialsHDREmissiveMultiplierPlugin=(l=e==null?void 0:e.materialsHDREmissiveMultiplierPlugin)!=null?l:new KI(n),this.materialsV0CompatPlugin=(c=e==null?void 0:e.materialsV0CompatPlugin)!=null?c:new iS(n),this.springBonePlugin=(u=e==null?void 0:e.springBonePlugin)!=null?u:new VS(n,{colliderHelperRoot:d,jointHelperRoot:d}),this.nodeConstraintPlugin=(h=e==null?void 0:e.nodeConstraintPlugin)!=null?h:new MS(n,{helperRoot:d})}beforeRoot(){return Na(this,null,function*(){yield this.materialsV0CompatPlugin.beforeRoot(),yield this.mtoonMaterialPlugin.beforeRoot()})}loadMesh(n){return Na(this,null,function*(){return yield this.mtoonMaterialPlugin.loadMesh(n)})}getMaterialType(n){const e=this.mtoonMaterialPlugin.getMaterialType(n);return e??null}extendMaterialParams(n,e){return Na(this,null,function*(){yield this.materialsHDREmissiveMultiplierPlugin.extendMaterialParams(n,e),yield this.mtoonMaterialPlugin.extendMaterialParams(n,e)})}afterRoot(n){return Na(this,null,function*(){yield this.metaPlugin.afterRoot(n),yield this.humanoidPlugin.afterRoot(n),yield this.expressionPlugin.afterRoot(n),yield this.lookAtPlugin.afterRoot(n),yield this.firstPersonPlugin.afterRoot(n),yield this.springBonePlugin.afterRoot(n),yield this.nodeConstraintPlugin.afterRoot(n),yield this.mtoonMaterialPlugin.afterRoot(n);const e=n.userData.vrmMeta,t=n.userData.vrmHumanoid;if(e&&t){const i=new UI({scene:n.scene,expressionManager:n.userData.vrmExpressionManager,firstPerson:n.userData.vrmFirstPerson,humanoid:t,lookAt:n.userData.vrmLookAt,meta:e,materials:n.userData.vrmMToonMaterials,springBoneManager:n.userData.vrmSpringBoneManager,nodeConstraintManager:n.userData.vrmNodeConstraintManager});n.userData.vrm=i}})}};function WS(n){const e=new Set;return n.traverse(t=>{if(!t.isMesh)return;const i=t;e.add(i)}),e}function rf(n,e,t){if(e.size===1){const a=e.values().next().value;if(a.weight===1)return n[a.index]}const i=new Float32Array(n[0].count*3);let r=0;if(t)r=1;else for(const a of e)r+=a.weight;for(const a of e){const o=n[a.index],l=a.weight/r;for(let c=0;c<o.count;c++)i[c*3+0]+=o.getX(c)*l,i[c*3+1]+=o.getY(c)*l,i[c*3+2]+=o.getZ(c)*l}return new tt(i,3)}function qS(n){var e;const t=WS(n.scene),i=new Map,r=(e=n.expressionManager)==null?void 0:e.expressionMap;if(r!=null)for(const[s,a]of Object.entries(r)){const o=new Set;for(const l of a.binds)if(l instanceof Eo){if(l.weight!==0)for(const c of l.primitives){let u=i.get(c);u==null&&(u=new Map,i.set(c,u));let h=u.get(s);h==null&&(h=new Set,u.set(s,h)),h.add(l)}o.add(l)}for(const l of o)a.deleteBind(l)}for(const s of t){const a=i.get(s);if(a==null)continue;const o=s.geometry.morphAttributes;s.geometry.morphAttributes={};const l=s.geometry.clone();s.geometry=l;const c=l.morphTargetsRelative,u=o.position!=null,h=o.normal!=null,d={},f={},g=[];if(u||h){u&&(d.position=[]),h&&(d.normal=[]);let m=0;for(const[A,p]of a)u&&(d.position[m]=rf(o.position,p,c)),h&&(d.normal[m]=rf(o.normal,p,c)),r==null||r[A].addBind(new Eo({index:m,weight:1,primitives:[s]})),f[A]=m,g.push(0),m++}l.morphAttributes=d,s.morphTargetDictionary=f,s.morphTargetInfluences=g}}function bo(n,e,t){if(n.getComponent)return n.getComponent(e,t);{let i=n.array[e*n.itemSize+t];return n.normalized&&(i=Mt.denormalize(i,n.array)),i}}function yA(n,e,t,i){n.setComponent?n.setComponent(e,t,i):(n.normalized&&(i=Mt.normalize(i,n.array)),n.array[e*n.itemSize+t]=i)}function jS(n){var e;const t=XS(n),i=new Set;for(const h of t)i.has(h.geometry)&&(h.geometry=eC(h.geometry)),i.add(h.geometry);const r=new Map;for(const h of i){const d=h.getAttribute("skinIndex"),f=(e=r.get(d))!=null?e:new Map;r.set(d,f);const g=h.getAttribute("skinWeight"),m=YS(d,g);f.set(g,m)}const s=new Map;for(const h of t){const d=KS(h,r);s.set(h,d)}const a=[];for(const[h,d]of s){let f=!1;for(const g of a)if(JS(d,g.boneInverseMap)){f=!0,g.meshes.add(h);for(const[A,p]of d)g.boneInverseMap.set(A,p);break}f||a.push({boneInverseMap:d,meshes:new Set([h])})}const o=new Map,l=new jl,c=new jl,u=new jl;for(const h of a){const{boneInverseMap:d,meshes:f}=h,g=Array.from(d.keys()),m=Array.from(d.values()),A=new Xr(g,m),p=c.getOrCreate(A);for(const b of f){const M=b.geometry.getAttribute("skinIndex"),E=l.getOrCreate(M),_=b.skeleton.bones,y=_.map(v=>u.getOrCreate(v)).join(","),S=`${E};${p};${y}`;let C=o.get(S);C==null&&(C=M.clone(),ZS(C,_,g),o.set(S,C)),b.geometry.setAttribute("skinIndex",C)}for(const b of f)b.bind(A,new De)}}function XS(n){const e=new Set;return n.traverse(t=>{if(!t.isSkinnedMesh)return;const i=t;e.add(i)}),e}function YS(n,e){const t=new Set;for(let i=0;i<n.count;i++)for(let r=0;r<n.itemSize;r++){const s=bo(n,i,r);bo(e,i,r)!==0&&t.add(s)}return t}function KS(n,e){const t=new Map,i=n.skeleton,r=n.geometry,s=r.getAttribute("skinIndex"),a=r.getAttribute("skinWeight"),o=e.get(s),l=o==null?void 0:o.get(a);if(!l)throw new Error("Unreachable. attributeUsedIndexSetMap does not know the skin index attribute or the skin weight attribute.");for(const c of l)t.set(i.bones[c],i.boneInverses[c]);return t}function JS(n,e){for(const[t,i]of n.entries()){const r=e.get(t);if(r!=null&&!$S(i,r))return!1}return!0}function ZS(n,e,t){const i=new Map;for(const s of e)i.set(s,i.size);const r=new Map;for(const[s,a]of t.entries()){const o=i.get(a);r.set(o,s)}for(let s=0;s<n.count;s++)for(let a=0;a<n.itemSize;a++){const o=bo(n,s,a),l=r.get(o);yA(n,s,a,l)}n.needsUpdate=!0}function $S(n,e,t){if(t=t||1e-4,n.elements.length!=e.elements.length)return!1;for(let i=0,r=n.elements.length;i<r;i++)if(Math.abs(n.elements[i]-e.elements[i])>t)return!1;return!0}var jl=class{constructor(){this._objectIndexMap=new Map,this._index=0}get(n){return this._objectIndexMap.get(n)}getOrCreate(n){let e=this._objectIndexMap.get(n);return e==null&&(e=this._index,this._objectIndexMap.set(n,e),this._index++),e}};function eC(n){var e,t,i,r;const s=new dt;s.name=n.name,s.setIndex(n.index);for(const[a,o]of Object.entries(n.attributes))s.setAttribute(a,o);for(const[a,o]of Object.entries(n.morphAttributes)){const l=a;s.morphAttributes[l]=o.concat()}s.morphTargetsRelative=n.morphTargetsRelative,s.groups=[];for(const a of n.groups)s.addGroup(a.start,a.count,a.materialIndex);return s.boundingSphere=(t=(e=n.boundingSphere)==null?void 0:e.clone())!=null?t:null,s.boundingBox=(r=(i=n.boundingBox)==null?void 0:i.clone())!=null?r:null,s.drawRange.start=n.drawRange.start,s.drawRange.count=n.drawRange.count,s.userData=n.userData,s}function sf(n){if(Object.values(n).forEach(e=>{e!=null&&e.isTexture&&e.dispose()}),n.isShaderMaterial){const e=n.uniforms;e&&Object.values(e).forEach(t=>{const i=t.value;i!=null&&i.isTexture&&i.dispose()})}n.dispose()}function tC(n){const e=n.geometry;e&&e.dispose();const t=n.skeleton;t&&t.dispose();const i=n.material;i&&(Array.isArray(i)?i.forEach(r=>sf(r)):i&&sf(i))}function nC(n){n.traverse(tC)}function iC(n,e){var t,i;console.warn("VRMUtils.removeUnnecessaryJoints: removeUnnecessaryJoints is deprecated. Use combineSkeletons instead. combineSkeletons contributes more to the performance improvement. This function will be removed in the next major version.");const r=(t=e==null?void 0:e.experimentalSameBoneCounts)!=null?t:!1,s=[];n.traverse(l=>{l.type==="SkinnedMesh"&&s.push(l)});const a=new Map;let o=0;for(const l of s){const u=l.geometry.getAttribute("skinIndex");if(a.has(u))continue;const h=new Map,d=new Map;for(let f=0;f<u.count;f++)for(let g=0;g<u.itemSize;g++){const m=bo(u,f,g);let A=h.get(m);A==null&&(A=h.size,h.set(m,A),d.set(A,m)),yA(u,f,g,A)}u.needsUpdate=!0,a.set(u,d),o=Math.max(o,h.size)}for(const l of s){const u=l.geometry.getAttribute("skinIndex"),h=a.get(u),d=[],f=[],g=r?o:h.size;for(let A=0;A<g;A++){const p=(i=h.get(A))!=null?i:0;d.push(l.skeleton.bones[p]),f.push(l.skeleton.boneInverses[p])}const m=new Xr(d,f);l.bind(m,new De)}}function rC(n,e){const t=n.position.count,i=new Array(t);let r=0;const s=e.array;for(let a=0;a<s.length;a++){const o=s[a];i[o]||(i[o]=!0,r++)}return{isVertexUsed:i,vertexCount:t,verticesUsed:r}}function sC(n){const e=[],t=[];let i=0;for(let r=0;r<n.length;r++)if(n[r]){const s=i++;e[r]=s,t[s]=r}return{originalIndexNewIndexMap:e,newIndexOriginalIndexMap:t}}function aC(n,e){var t,i,r,s;e.name=n.name,e.morphTargetsRelative=n.morphTargetsRelative,n.groups.forEach(a=>{e.addGroup(a.start,a.count,a.materialIndex)}),e.boundingBox=(i=(t=n.boundingBox)==null?void 0:t.clone())!=null?i:null,e.boundingSphere=(s=(r=n.boundingSphere)==null?void 0:r.clone())!=null?s:null,e.setDrawRange(n.drawRange.start,n.drawRange.count),e.userData=n.userData}function oC(n,e,t){const i=e.array,r=new i.constructor(i.length);for(let s=0;s<i.length;s++){const a=i[s];r[s]=t[a]}n.setIndex(new tt(r,e.itemSize,e.normalized))}function xo(n,e,t){const i=n.constructor,r=new i(e.length*t);let s=!0;for(let a=0;a<e.length;a++){const l=e[a]*t,c=a*t;for(let u=0;u<t;u++){const h=n[l+u];r[c+u]=h,s=s&&h===0}}return[r,s]}function lC(n){var e;const t=new Map,i=[];for(const[r,s]of Object.entries(n))if(s.isInterleavedBufferAttribute){const a=s,o=a.data,l=(e=t.get(o))!=null?e:[];t.set(o,l),l.push([r,a])}else{const a=s;i.push([r,a])}return[t,i]}function cC(n,e,t){const[i,r]=lC(e);for(const[s,a]of i){const o=s.array,{stride:l}=s,[c]=xo(o,t,l),u=new wo(c,l);u.setUsage(s.usage);for(const[h,d]of a){const{itemSize:f,offset:g,normalized:m}=d,A=new Vi(u,f,g,m);n.setAttribute(h,A)}}for(const[s,a]of r){const o=a.array,{itemSize:l,normalized:c}=a,[u]=xo(o,t,l);n.setAttribute(s,new tt(u,l,c))}}function uC(n){var e;const t=new Map,i=[];for(const[r,s]of Object.entries(n)){const a=r;for(let o=0;o<s.length;o++){const l=s[o];if(l.isInterleavedBufferAttribute){const c=l,u=c.data,h=(e=t.get(u))!=null?e:[];t.set(u,h),h.push([a,o,c])}else{const c=l;i.push([a,o,c])}}}return[t,i]}function hC(n,e,t){var i,r;let s=!0;const[a,o]=uC(e),l={};for(const[c,u]of a){const h=c.array,{stride:d}=c,[f,g]=xo(h,t,d);s=s&&g;const m=new wo(f,d);m.setUsage(c.usage);for(const[A,p,b]of u){const{itemSize:M,offset:E,normalized:_}=b,y=new Vi(m,M,E,_);(i=l[A])!=null||(l[A]=[]),l[A][p]=y}}for(const[c,u,h]of o){const d=h,f=d.array,{itemSize:g,normalized:m}=d,[A,p]=xo(f,t,g);s=s&&p,(r=l[c])!=null||(l[c]=[]),l[c][u]=new tt(A,g,m)}n.morphAttributes=s?{}:l}function dC(n){const e=new Map;n.traverse(t=>{if(!t.isMesh)return;const i=t,r=i.geometry,s=r.index;if(s==null)return;const a=e.get(r);if(a!=null){i.geometry=a;return}const{isVertexUsed:o,vertexCount:l,verticesUsed:c}=rC(r.attributes,s);if(c===l)return;const{originalIndexNewIndexMap:u,newIndexOriginalIndexMap:h}=sC(o),d=new dt;aC(r,d),e.set(r,d),oC(d,s,u),cC(d,r.attributes,h),hC(d,r.morphAttributes,h),i.geometry=d}),Array.from(e.keys()).forEach(t=>{t.dispose()})}function fC(n){var e;((e=n.meta)==null?void 0:e.metaVersion)==="0"&&(n.scene.rotation.y=Math.PI)}var Bn=class{constructor(){}};Bn.combineMorphs=qS;Bn.combineSkeletons=jS;Bn.deepDispose=nC;Bn.removeUnnecessaryJoints=iC;Bn.removeUnnecessaryVertices=dC;Bn.rotateVRM0=fC;/*!
 * @pixiv/three-vrm-core v3.5.5
 * The implementation of core features of VRM, for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-core is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 *//*!
 * @pixiv/three-vrm-materials-mtoon v3.5.5
 * MToon (toon material) module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-mtoon is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 *//*!
 * @pixiv/three-vrm-materials-hdr-emissive-multiplier v3.5.5
 * Support VRMC_hdr_emissiveMultiplier for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-hdr-emissive-multiplier is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 *//*!
 * @pixiv/three-vrm-materials-v0compat v3.5.5
 * VRM0.0 materials compatibility layer plugin for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-materials-v0compat is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 *//*!
 * @pixiv/three-vrm-node-constraint v3.5.5
 * Node constraint module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-node-constraint is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 *//*!
 * @pixiv/three-vrm-springbone v3.5.5
 * Spring bone module for @pixiv/three-vrm
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm-springbone is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */async function MA(n,e={}){var s;const t=new bM;t.setMeshoptDecoder(nI),e.ktx2&&t.setKTX2Loader(e.ktx2),t.register(a=>new zS(a));const i=await t.parseAsync(n,""),r=i.userData.vrm;if(!((s=r==null?void 0:r.humanoid)!=null&&s.getNormalizedBoneNode("hips")))throw Bn.deepDispose(i.scene),new Error("NOT_A_VRM");return Bn.removeUnnecessaryVertices(i.scene),Bn.rotateVRM0(r),r.scene.traverse(a=>{a.isMesh&&(a.castShadow=!0,a.frustumCulled=!1)}),r.dispose=()=>Bn.deepDispose(r.scene),r}const Ms=new R,af=[16736126,3111935,16761405,4177754,10517503,16747082],pC=n=>{let e=0;for(const t of n)e=e*31+t.charCodeAt(0)>>>0;return af[e%af.length]};function AC(n){var C;const e=n.height??1.75,t=n.now??(()=>performance.now()/1e3),i=n.load??(v=>MA(v)),r=new AbortController;(C=n.signal)==null||C.addEventListener("abort",()=>r.abort(),{once:!0});const s=n.onError??((v,x)=>console.warn(`[avatar kit] ${x}`,v)),a=md({height:e,standIn:n.standIn}),o=new mt;o.name="other-players";const l=new Map,c=$y();let u=null,h=!1,d=!1,f=null,g=null;const m=(v,x)=>v?v().catch(T=>(s(T,x),null)):Promise.resolve(null),A=()=>f??(f=m(n.motion,"motion")),p=()=>g??(g=m(n.emotes,"emotes")),b=(v,x)=>{!n.emotes||v.hasClip(x)||!_o.includes(x)||p().then(T=>{d||v.addClips(T)})},M=async(v,x)=>{var N;if(!n.services.avatar)throw new Error("AVATAR_SERVICE_MISSING");const[T,D]=await Promise.all([n.services.avatar(x,r.signal),A()]),U=await i(T);if(d)throw(N=U.dispose)==null||N.call(U),new Error("KIT_DISPOSED");v.attach(U),v.addClips(D)};let E=0;const _=[],y=(v,x)=>{const T=()=>{if(d||l.get(v.id)!==v||v.vrm!==x||v.avatar.kind==="vrm")return D();E++,M(v.avatar,x).catch(U=>s(U,`player ${v.id}`)).finally(()=>{E--,D()})},D=()=>{var U;E<(n.maxLoads??2)&&((U=_.shift())==null||U())};_.push(T),D()},S=v=>{const x=md({height:e,color:pC(v)}),T=vM("…",{canvas:n.canvas});T.object.position.y=e+.22,x.root.add(T.object),x.root.visible=!1,o.add(x.root);const D={id:v,name:"",vrm:"",talking:!1,avatar:x,tag:T,samples:[],drawn:!1};return l.set(v,D),D};return{self:a,group:o,others:l,arrival:c,async loadSelf(){const v=n.services.identity.avatar;try{return v?(await M(a,v),!0):(a.addClips(await A()),!1)}catch(x){return d||s(x,"visitor"),!1}},setPeers(v){if(d)return;const x=t(),T=new Set;for(const D of Array.isArray(v)?v.slice(0,32):[]){const U=iM(D);if(!U||T.has(U.id))continue;T.add(U.id);const N=l.get(U.id)??S(U.id);U.name!==N.name&&(N.name=U.name,N.tag.setName(U.name)),U.talking!==N.talking&&(N.talking=U.talking,N.tag.setTalking(U.talking)),U.vrm&&U.vrm!==N.vrm&&(N.vrm=U.vrm,y(N,U.vrm)),rM(N.samples,U.pose,x,U.fresh)}for(const D of[...l.values()])T.has(D.id)||(D.tag.dispose(),D.avatar.dispose(),l.delete(D.id))},emote(v){a.motion=v?{emote:v}:{},v&&b(a,v)},pose(v,x){return{x:v.x,y:v.y,z:v.z,h:x,a:eM(a.motion)}},update(v,x){if(d)return;u=x,c.update(v),h=a.takeDrawn(),a.drive(v,c.crouch);const T=t()-oM;for(const D of l.values()){D.drawn=D.avatar.takeDrawn();const U=aM(D.samples,T);if(!U)continue;const N=D.avatar.root;N.visible=!0,N.position.set(U.x,U.y,U.z),N.rotation.y=U.h+(n.heading??0),D.avatar.motion=tM(U.a,U.speed),D.avatar.motion.emote&&b(D.avatar,D.avatar.motion.emote),D.avatar.drive(v),D.tag.update(v)}},inspect(){let v=!1,x=!1;if(u){a.root.updateWorldMatrix(!0,!1),u.updateMatrixWorld();const D=a.root.getWorldPosition(new R);Ms.copy(D).setY(D.y+e*.5*(1-c.crouch*.4)).project(u),v=h&&Math.abs(Ms.x)<=1&&Math.abs(Ms.y)<=1&&Ms.z>-1&&Ms.z<1;const U=u.getWorldPosition(new R),N=a.root.getWorldDirection(new R);x=Zy(D,Math.atan2(N.x,N.z),U)}const T=[...l.values()].filter(D=>D.drawn);return{avatarSelf:a.kind,avatarSelfInFrame:v,avatarOthers:l.size,avatarOthersDrawn:T.length,avatarOthersVrm:T.filter(D=>D.avatar.kind==="vrm").length,avatarArrival:c.phase,avatarFacingCamera:x,avatarHandsEmpty:c.handsEmpty,avatarTalking:[...l.values()].filter(D=>D.talking).length,avatarEmote:a.motion.emote??""}},dispose(){var v;if(!d){d=!0,r.abort(),_.length=0;for(const x of l.values())x.tag.dispose(),x.avatar.dispose();l.clear(),(v=o.parent)==null||v.remove(o),a.dispose()}}}}const Fs=Rt.step,Ka=(n,e,t)=>Math.max(e,Math.min(t,n)),of=n=>Math.atan2(Math.sin(n),Math.cos(n)),Lr=n=>Number.isFinite(n)?n:0;function lf(n={}){return{x:n.x||0,y:n.y||0,z:n.z||0,rotation:n.rotation||0,vx:0,vz:0,vy:0,jumpHeld:!1,jumpCount:(n.y||0)>0?1:0,floor:!(n.y&&n.y>0),time:0}}function mC(n,e,t,i,r){r=Ka(Lr(r),0,Rt.maxFrame);const s=Math.abs(e)+Math.abs(t)>Rt.inputDeadzone,a=Math.max(1,Math.hypot(e,t)),o=i?Rt.runSpeed:Rt.walkSpeed,l=Math.hypot(n.vx,n.vz),c=1-Math.exp(-(s?Rt.steerRate:Rt.brakeRate)*r);n.vx+=(e/a*o-n.vx)*c,n.vz+=(t/a*o-n.vz)*c;const u=Math.hypot(n.vx,n.vz),h=l+Rt.acceleration*r;s&&u>h&&(n.vx*=h/u,n.vz*=h/u),!s&&u<Rt.restSpeed&&(n.vx=n.vz=0)}function cf(n,e,t=Fs,i=1){t=Ka(Lr(t),0,Fs);const r=Lr(e.yaw);mC(n,Ka(Lr(e.strafe),-1,1),Ka(Lr(e.forward),-1,1),!!e.running,t),!n.y&&n.vy<=0&&(n.jumpCount=0),e.jump&&!n.jumpHeld&&n.jumpCount<Rt.maxJumps&&(n.vy=Rt.jumpSpeed,n.jumpCount++),n.jumpHeld=!!e.jump,(n.y>0||n.vy>0)&&(n.vy-=Rt.gravity*t,n.y=Math.max(0,n.y+n.vy*t*i),n.y||(n.vy=0,n.jumpCount=0));const s=Math.cos(r)*n.vx+Math.sin(r)*n.vz,a=-Math.sin(r)*n.vx+Math.cos(r)*n.vz;return n.x+=s*t*i,n.z+=a*t*i,Math.hypot(s,a)>Rt.faceMinSpeed&&(n.rotation=of(n.rotation+of(r+Math.atan2(-n.vx,-n.vz)-n.rotation)*(1-Math.exp(-12*t)))),n.floor=n.y===0,n.time+=t,n}function gC(n={},e={}){let t=lf(n),i=0,r={x:t.x,z:t.z,time:t.time};const s={get rest(){return r},get state(){return t},scale:e.scale&&e.scale>0?e.scale:1,advance(a,o){var c,u;for(i=Math.min(Rt.maxFrame,i+Math.max(0,Lr(a)));i+1e-9>=Fs;)i-=Fs,cf(t,o,Fs,s.scale),(c=e.constrain)==null||c.call(e,t),!t.vx&&!t.vz&&(r={x:t.x,z:t.z,time:t.time});const l=cf({...t},o,i,s.scale);return(u=e.constrain)==null||u.call(e,l),l},place(a){const o=t.time;t=lf({...t,...a}),t.time=o,r={x:t.x,z:t.z,time:o},i=0},speed:()=>Math.hypot(t.vx,t.vz),velocity:a=>({x:(Math.cos(a)*t.vx+Math.sin(a)*t.vz)*s.scale,z:(-Math.sin(a)*t.vx+Math.cos(a)*t.vz)*s.scale})};return s}function _C(){let n=0,e=!1,t=0;return{queue(){n=Math.min(Rt.maxJumps,n+1)},read(i){t<=1e-9&&(e?(e=!1,t=Rt.step):n&&(n--,e=!0,t=Rt.step));const r=e;return t-=Number.isFinite(i)?Math.max(0,i):0,r},clear(){n=t=0,e=!1}}}function EC(n,e){var r;const t=globalThis;if(!/[?&]check\b/.test(String(((r=t.location)==null?void 0:r.search)??"")))return;const i={begin:e,read(){const s=n();return s?{x:s.state.x,z:s.state.z,time:s.state.time,scale:s.scale,floor:s.state.floor,rest:{...s.rest}}:null}};t.__oncyberLocomotion=i}function vC(n,e,t={}){n.position.set(e.position.x,e.position.y,e.position.z),n.lookAt(e.target.x,e.target.y,e.target.z);const i=t.near===!1?n.near:e.near;(n.fov!==e.fov||n.near!==i)&&(n.fov=e.fov,n.near=i,n.updateProjectionMatrix())}const Qa=n=>Math.round(n*100)/100;function bC(n){const e=n.camera.x-n.avatar.x,t=n.camera.z-n.avatar.z;return{distance:Qa(Math.hypot(e,t)),height:Qa(n.camera.y-n.avatar.y),fov:Qa(n.fov),avatarHeight:Qa(n.avatarHeight),facingCamera:e*n.avatarForward.x+t*n.avatarForward.z>0,crouched:n.crouched,handsEmpty:n.handsEmpty}}const zc=90,IA=9,Wc=.6,xC=1.4,_n=12,Ha=_n-.6,Di=1.5,jr=(()=>{const n=[];for(let e=0;e<8;e++){const t=e/8*Math.PI*2+Math.PI/8;n.push([Math.sin(t)*9.2,Math.cos(t)*9.2])}for(let e=0;e<4;e++){const t=e/4*Math.PI*2+Math.PI/4;n.push([Math.sin(t)*4.6,Math.cos(t)*4.6])}return n.map(([e,t])=>[Math.round(e*100)/100,Math.round(t*100)/100])})();function yC(n){let e=n>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function MC(n){let e=2166136261;for(const t of String(n))e=Math.imul(e^t.charCodeAt(0),16777619);return e>>>0}const IC=n=>Math.max(2,Math.min(5,2+Math.floor((n-1)/2))),si=(n,e,t,i)=>typeof n=="number"&&Number.isFinite(n)?Math.max(e,Math.min(t,n)):i;function uf({id:n,seed:e,duration:t=zc,players:i}){return{id:String(n),seed:e>>>0,draws:0,duration:t,elapsed:0,lit:{},nextAt:0,scores:Object.fromEntries(i.map(r=>[r,0])),gone:[],missed:0,over:!1}}const Ja=n=>Object.keys(n.scores).filter(e=>!n.gone.includes(e));function SC(n){const e=yC(n.seed+n.draws*7919);return n.draws++,e()}function CC(n,e){const t=[];if(n.over||!(e>0))return t;n.elapsed=Math.min(n.duration,n.elapsed+e);for(const[r,s]of Object.entries(n.lit))n.elapsed-s>=IA&&(delete n.lit[r],n.missed++,n.nextAt=Math.max(n.nextAt,n.elapsed+Wc),t.push({type:"faded",post:Number(r)}));if(n.elapsed>=n.duration)return n.over=!0,n.lit={},t.push({type:"over",post:-1}),t;const i=IC(Math.max(1,Ja(n).length));for(;Object.keys(n.lit).length<i&&n.elapsed>=n.nextAt;){const r=jr.map((a,o)=>o).filter(a=>!(a in n.lit)),s=r[Math.floor(SC(n)*r.length)];n.lit[s]=n.elapsed,n.nextAt=n.elapsed+Wc,t.push({type:"lit",post:s})}return t}function wC(n,e,t=xC){const i=jr[e];return!!i&&Math.hypot(n[0]-i[0],n[1]-i[1])<=t}const hf=(n,e)=>Object.keys(n.lit).map(Number).filter(t=>wC(e,t));function df(n,e,t,i){return n.over||!(e in n.scores)||n.gone.includes(e)||!(t in n.lit)||Math.abs(n.lit[t]-i)>.051?!1:(delete n.lit[t],n.scores[e]++,n.nextAt=Math.max(n.nextAt,n.elapsed+Wc),!0)}function ff(n,e){if(n.over)return!1;if(!(e in n.scores)){if(Object.keys(n.scores).length>=8)return!1;n.scores[e]=0}return n.gone=n.gone.filter(t=>t!==e),!0}function Xl(n,e){e in n.scores&&!n.gone.includes(e)&&n.gone.push(e)}const Yl=n=>Math.round(n*10);function pf(n){return[n.id,n.seed,n.draws,n.duration,Yl(n.elapsed),Yl(n.nextAt),Object.entries(n.lit).map(([e,t])=>[Number(e),Yl(t)]),Object.entries(n.scores).map(([e,t])=>[e,t,n.gone.includes(e)?1:0]),n.missed,n.over?1:0]}function TC(n,e=()=>!0){if(!Array.isArray(n)||n.length<10)return null;const[t,i,r,s,a,o,l,c,u]=n;if(typeof t!="string"||!/^[A-Za-z0-9_-]{6,64}$/.test(t)||!Array.isArray(l)||!Array.isArray(c))return null;const h=si(s,5,600,NaN);if(!Number.isFinite(h))return null;const d={id:t,seed:si(i,0,4294967295,0)>>>0,draws:Math.floor(si(r,0,1e6,0)),duration:h,elapsed:si(a,0,h*10,0)/10,nextAt:si(o,0,h*10+100,0)/10,lit:{},scores:{},gone:[],missed:Math.floor(si(u,0,1e4,0)),over:n[9]===1};for(const f of l.slice(0,jr.length)){if(!Array.isArray(f))continue;const g=f[0];!Number.isInteger(g)||g<0||g>=jr.length||(d.lit[g]=si(f[1],0,h*10,0)/10)}for(const f of c.slice(0,8)){if(!Array.isArray(f))continue;const g=f[0];typeof g!="string"||!g||g.length>64||e(g)&&(d.scores[g]=Math.floor(si(f[1],0,1e4,0)),f[2]===1&&d.gone.push(g))}return d}function RC(n){return Object.entries(n.scores).map(([e,t])=>({id:e,score:t,gone:n.gone.includes(e)})).sort((e,t)=>t.score-e.score||(e.id<t.id?-1:1))}function BC(n,{format:e,self:t,name:i}){if(!n.over||!(t in n.scores)||n.gone.includes(t))return null;const s=Object.keys(n.scores).sort().map(l=>({score:n.scores[l],players:[{id:l,name:i(l),kind:l===t?"self":"peer"}]}));s.length<2&&s.push({score:n.missed,players:[{id:"cpu-night",name:"The night",kind:"cpu"}]});const a=Math.max(...s.map(l=>l.score)),o=s.filter(l=>l.score===a);return{format:e,teams:s,winner:o.length===1?s.indexOf(o[0]):null}}function LC(n){n.x=Math.max(-Ha,Math.min(Ha,n.x)),n.z=Math.max(-Ha,Math.min(Ha,n.z));const e=Math.hypot(n.x,n.z);if(e<Di){const t=e>1e-6?Di/e:0;n.x=e>1e-6?n.x*t:0,n.z=e>1e-6?n.z*t:Di}}function DC(n,e){let t=null,i=1/0;for(const r of Object.keys((n==null?void 0:n.lit)??{})){const s=jr[r],a=Math.hypot(s[0]-e[0],s[1]-e[1]);a<i&&(i=a,t=s)}return!t||i<.3?{strafe:0,forward:0}:{strafe:(t[0]-e[0])/i,forward:(t[1]-e[1])/i}}const PC=3e3,UC=4e3,Af=["duel","round"];function NC({link:n,authorityOf:e,self:t,now:i=()=>performance.now(),newId:r=()=>`lt-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`,onEvent:s=()=>{}}){let a=null,o="",l="",c="",u=0,h=!1,d=null;const f=new Set,g=[],m=C=>n.roster.members.some(v=>v.id===C),A=C=>n.roster.members.some(v=>v.id===C&&v.state==="here"),p=()=>Af.includes(o),b=(C,v)=>n.channel.event(C,v);function M(){a&&(a.over=!0,a.lit={},s({type:"over"}))}function E(C){const v=Ja(a).filter(x=>x!==C&&(x===t()||A(x)));return e(n.roster,v)||(v.includes(t())?t():"")}function _(C){if(!a||l!=="guest")return;const v=E(C);C&&Xl(a,C),v===t()?(l="authority",c=t(),ff(a,t()),s({type:"taken-over"})):v&&(c=v,u=i())}function y(C,v,x){const T=a;if(a=C,o=v,l="guest",c=x,u=i(),T&&T.id===C.id){for(const U of Object.keys(C.lit))T.lit[U]!==C.lit[U]&&s({type:"lit",post:Number(U)});const D=t();(C.scores[D]??0)>(T.scores[D]??0)&&s({type:"caught",mine:!0})}C.over&&!(T&&T.id===C.id&&T.over)&&s({type:"over"})}g.push(n.on("match",({from:C,data:v})=>{if(!m(C)||C===t()||!Array.isArray(v))return;const[x,T,D,U]=v;if(x==="s"||x==="o"){if(!Af.includes(T))return;const N=TC(D,Q=>m(Q));if(!N)return;if(!a||a.over){N.over?(d==null?void 0:d.round.id)===N.id&&(d=null):d={round:N,format:T,from:C,at:i()};return}if(!p())return;if(l==="authority"){if(e(n.roster,[t(),C])===t())return;N.id!==a.id&&s({type:"merged",id:N.id}),b(["j",N.id],C),y(N,T,C);return}if(N.id!==a.id||C!==c&&A(c)&&i()-u<1e3)return;y(N,T,C);return}if(!a||l!=="authority"||T!==a.id){x==="a"&&a&&T===a.id&&C===c&&_(C);return}x==="j"?ff(a,C)&&s({type:"joined",id:C}):x==="c"?Number.isInteger(D)&&typeof U=="number"&&df(a,C,D,U/10)&&s({type:"caught",mine:!1,id:C}):(x==="l"||x==="a")&&Xl(a,C)}),n.on("dropped",({member:C})=>S(C.id)),n.on("left",({member:C})=>S(C.id)));function S(C){(d==null?void 0:d.from)===C&&(d=null),!(!a||a.over||!p())&&(l==="authority"?Xl(a,C):C===c&&_(C))}return{get round(){return a},get format(){return o},get role(){return l},get authority(){return c},get versus(){return!!a&&!a.over&&p()},joinable(){return d&&(i()-d.at>UC||!A(d.from))&&(d=null),d},startSolo({seed:C,duration:v}){return o="solo",l="solo",c=t(),a=uf({id:r(),seed:C,duration:v,players:[t()]}),s({type:"started"}),a.id},startParty({format:C,seed:v,duration:x}){const T=this.joinable();return f.clear(),T?(d=null,a=T.round,o=T.format,l="guest",c=T.from,u=i(),b(["j",a.id],c),s({type:"started",joined:!0}),a.id):(o=C,l="authority",c=t(),a=uf({id:r(),seed:v,duration:x,players:[t()]}),s({type:"started"}),a.id)},update(C,v){if(!(!a||a.over)){if(l==="guest"){if(a.elapsed=Math.min(a.duration,a.elapsed+C),!h)for(const x of hf(a,v)){const T=`${x}:${a.lit[x]}`;f.has(T)||(f.add(T),b(["c",a.id,x,Math.round(a.lit[x]*10)],c))}i()-u>PC&&_(c)}else{for(const x of CC(a,C))x.type!=="over"&&s(x);if(!h)for(const x of hf(a,v))df(a,t(),x,a.lit[x])&&s({type:"caught",mine:!0});p()&&(a.over?(b(["o",o,pf(a)]),n.channel.flush()):n.channel.state(["s",o,pf(a)])),a.over&&s({type:"over"})}p()&&n.channel.pump()}},leave(){a&&!a.over&&p()&&(l==="guest"?b(["l",a.id],c):(n.channel.state(null),b(["a",a.id])),n.channel.flush(),n.channel.pump()),a=null,o=l=c="",f.clear()},clear(){a=null,o=l=c="",f.clear()},away(C){if(h=C,!(!a||a.over||!p()))if(C){const v=Ja(a).filter(x=>x!==t()&&A(x));l==="authority"&&v.length&&(n.channel.state(null),b(["a",a.id]),n.channel.flush(),l="guest",c=e(n.roster,v)||v[0],u=i())}else l==="guest"&&(b(["j",a.id],c),u=i())},report(){return!a||a.over?null:{format:o,players:Ja(a),authority:c,role:l,progress:Math.round(a.elapsed*10),standIns:[]}},finish:M,dispose(){g.forEach(C=>C())}}}const Kl=24,FC=[0,0,0,1],OC=["Hips","Spine","Head","LeftUpLeg","RightUpLeg","LeftLeg","RightLeg","LeftFoot","RightFoot","LeftArm","RightArm","LeftForeArm","RightForeArm"],mf=(n,e)=>.003*Math.sin(n+e*1.7),At=(n,e)=>{const t=Math.sin(e/2);return[n==="x"?t:0,n==="y"?t:0,n==="z"?t:0,Math.cos(e/2)]},SA=(n,e)=>[n[3]*e[0]+n[0]*e[3]+n[1]*e[2]-n[2]*e[1],n[3]*e[1]-n[0]*e[2]+n[1]*e[3]+n[2]*e[0],n[3]*e[2]+n[0]*e[1]-n[1]*e[0]+n[2]*e[3],n[3]*e[3]-n[0]*e[0]-n[1]*e[1]-n[2]*e[2]];function Is(n,e,t,i=0){const r=[],s={},a=[];for(let o=0;o<=Kl;o++){r.push(o/Kl*e);const l=o/Kl*Math.PI*2;a.push(0,1-i*(.5+.5*Math.cos(l*2))+mf(l,0),0);const c=t(l);OC.forEach((u,h)=>(s[u]??(s[u]=[])).push(...SA(c[u]??FC,At("x",mf(l,h)))))}return{name:n,duration:e,tracks:[{name:"mixamorigHips.position",times:r,values:a},...Object.entries(s).map(([o,l])=>({name:`mixamorig${o}.quaternion`,times:r,values:l.map(c=>Math.round(c*1e6)/1e6)}))]}}const wi=(n,e,t=1.25)=>SA(At("x",e),At("z",n*t)),Ti=(n,e)=>At("y",n*e);function gf({stride:n,knee:e,swing:t,bend:i,lean:r,bounce:s}){return a=>{const o=Math.sin(a),l=-o,c=u=>At("x",e*Math.max(0,Math.cos(u+.6))+.08);return{Hips:At("x",r*.4+Math.sin(a*2)*s),Spine:At("x",r),LeftUpLeg:At("x",-n*o-.05),RightUpLeg:At("x",-n*l-.05),LeftLeg:c(a),RightLeg:c(a+Math.PI),LeftArm:wi(-1,t*o),RightArm:wi(1,t*l),LeftForeArm:Ti(-1,i),RightForeArm:Ti(1,i)}}}function kC(){return{IDLE:Is("IDLE",3,n=>({Spine:At("x",.02+Math.sin(n)*.015),Head:At("x",-Math.sin(n)*.01),LeftArm:wi(-1,Math.sin(n)*.02),RightArm:wi(1,Math.sin(n)*.02),LeftForeArm:Ti(-1,.15),RightForeArm:Ti(1,.15),LeftUpLeg:At("x",0),RightUpLeg:At("x",0),LeftLeg:At("x",0),RightLeg:At("x",0),Hips:At("x",0)})),WALK:Is("WALK",1,gf({stride:.42,knee:.7,swing:.4,bend:.3,lean:.05,bounce:.01}),.015),RUN:Is("RUN",.7,gf({stride:.8,knee:1.3,swing:.9,bend:1.2,lean:.2,bounce:.03}),.04),JUMP:Is("JUMP",1,()=>({Hips:At("x",.05),Spine:At("x",.1),LeftUpLeg:At("x",-.5),RightUpLeg:At("x",-.2),LeftLeg:At("x",.9),RightLeg:At("x",.5),LeftArm:wi(-1,-.3,.7),RightArm:wi(1,-.3,.7),LeftForeArm:Ti(-1,.4),RightForeArm:Ti(1,.4)})),WAVING:Is("WAVING",1.2,n=>({Spine:At("x",.02),LeftArm:wi(-1,0),RightArm:At("z",-.9),RightForeArm:At("z",-.6+Math.sin(n*2)*.35),LeftForeArm:Ti(-1,.15)}))}}function QC(n){const e=(n==null?void 0:n.context)??null,t=(n==null?void 0:n.output)??null;if(!e||!t){const E=()=>{};return{lit:E,caught:E,faded:E,start:E,end:E,tick:E,dispose:E}}const i=e.createGain();i.gain.value=.5,i.connect(t);const r=e.createGain();r.gain.value=.16,r.connect(t);const s=e.createBuffer(1,e.sampleRate*2,e.sampleRate),a=s.getChannelData(0);let o=1234567;for(let E=0;E<a.length;E++)o=o*1664525+1013904223>>>0,a[E]=o/4294967296*2-1;const l=e.createBufferSource();l.buffer=s,l.loop=!0;const c=e.createBiquadFilter();c.type="lowpass",c.frequency.value=420;const u=e.createOscillator();u.frequency.value=.13;const h=e.createGain();h.gain.value=160,u.connect(h).connect(c.frequency),l.connect(c).connect(r);const d=e.createOscillator();d.type="sine",d.frequency.value=73.4;const f=e.createGain();f.gain.value=.5,d.connect(f).connect(r);const g=e.createOscillator();g.type="sine",g.frequency.value=4100;const m=e.createOscillator();m.type="square",m.frequency.value=17;const A=e.createGain();A.gain.value=0;const p=e.createGain();p.gain.value=.035,m.connect(p).connect(A.gain),g.connect(A).connect(r);const b=[l,u,d,g,m];b.forEach(E=>E.start());function M(E,{at:_=0,length:y=.5,level:S=.5,type:C="sine"}={}){if(!n.audible)return;const v=e.currentTime+_,x=e.createGain();x.gain.setValueAtTime(1e-4,v),x.gain.exponentialRampToValueAtTime(S,v+.012),x.gain.exponentialRampToValueAtTime(1e-4,v+y),x.connect(i);for(const[T,D]of[[1,1],[2.76,.28]]){const U=e.createOscillator();U.type=C,U.frequency.value=E*T;const N=e.createGain();N.gain.value=D,U.connect(N).connect(x),U.start(v),U.stop(v+y+.05)}}return{lit:()=>M(1318.5,{length:.35,level:.16}),caught(){M(880,{length:.45,level:.5}),M(1318.5,{at:.09,length:.6,level:.42})},faded:()=>M(196,{length:.5,level:.22,type:"triangle"}),start(){M(392,{length:.9,level:.45}),M(587.3,{at:.18,length:.9,level:.4})},end(){[523.3,659.3,784,1046.5].forEach((E,_)=>M(E,{at:_*.14,length:.9,level:.4}))},tick:()=>M(660,{length:.12,level:.2,type:"triangle"}),dispose(){b.forEach(E=>{try{E.stop()}catch{}}),i.disconnect(),r.disconnect()}}}const HC=new be(16762219),_f=new be(2764613);function CA(n,e){const t=document.createElement("canvas");t.width=t.height=n,e(t.getContext("2d"),n);const i=new tp(t);return i.colorSpace=Ct,i}function GC(){const n=CA(256,(e,t)=>{e.fillStyle="#1d2233",e.fillRect(0,0,t,t);let i=7;const r=()=>(i=i*16807%2147483647)%1e3/1e3,s=t/4;for(let a=0;a<4;a++)for(let o=0;o<4;o++){const l=46+Math.floor(r()*22);e.fillStyle=`rgb(${l},${l+6},${l+22})`,e.fillRect(o*s+2+(a%2?s/2:0)-(o===3&&a%2?t:0),a*s+2,s-4,s-4),a%2&&o===3&&e.fillRect(-s/2+2,a*s+2,s-4,s-4)}});return n.wrapS=n.wrapT=Qi,n.repeat.set(8,8),n}function VC(){return CA(128,(n,e)=>{const t=n.createRadialGradient(e/2,e/2,0,e/2,e/2,e/2);t.addColorStop(0,"rgba(255,226,160,1)"),t.addColorStop(.25,"rgba(255,190,96,0.55)"),t.addColorStop(1,"rgba(255,160,60,0)"),n.fillStyle=t,n.fillRect(0,0,e,e)})}function zC(){const n=new mt;n.name="courtyard";const e=[],t=N=>(e.push(N),N),i=(N,Q={})=>t(new Ps({color:N,...Q}));n.add(new xE(9413887,2302002,1.5));const r=new cp(12570879,1.6);r.position.set(-8,14,-10),n.add(r);const s=new Ke(t(new Yr(_n*2,_n*2)),i(16777215,{map:t(GC())}));s.rotation.x=-Math.PI/2,n.add(s);const a=new Ke(t(new Rr(90,24)),i(1054762));a.rotation.x=-Math.PI/2,a.position.y=-.02,n.add(a);const o=i(4936560),l=i(6713232),c=t(new qn(_n-1.4,2.4,.6)),u=t(new qn(_n-1.2,.25,.8)),h=t(new qn(.9,3.4,.9)),d=t(new qn(3.7,.5,.8));for(let N=0;N<4;N++){const Q=new mt;Q.rotation.y=N*Math.PI/2;for(const X of[-1,1]){const V=new Ke(c,o);V.position.set(X*(_n/2+.7),1.2,-_n);const ee=new Ke(u,l);ee.position.set(X*(_n/2+.7),2.52,-_n);const Z=new Ke(h,l);Z.position.set(X*1.4,1.7,-_n),Q.add(V,ee,Z)}const G=new Ke(d,l);G.position.set(0,3.55,-_n),Q.add(G),n.add(Q)}const f=new Ke(t(new Wr(Di-.35,Di-.25,.9,20,1,!0)),i(5923718,{side:tn}));f.position.y=.45;const g=new Ke(t(new Lo(Di-.35,.12,8,24)),l);g.rotation.x=Math.PI/2,g.position.y=.9;const m=new Ke(t(new Rr(Di-.4,20)),t(new Kt({color:2310254})));m.rotation.x=-Math.PI/2,m.position.y=.6,n.add(f,g,m);const A=new mt,p=new Ke(t(new Rr(5,28)),t(new Kt({color:15265279,fog:!1})));p.position.set(-34,42,-78),p.lookAt(0,0,0),A.add(p);const b=[];let M=99;const E=()=>(M=M*48271%2147483647)%1e4/1e4;for(let N=0;N<260;N++){const Q=E()*Math.PI*2,G=.12+E()*.85,X=95;b.push(Math.cos(Q)*Math.sqrt(1-G*G)*X,G*X,Math.sin(Q)*Math.sqrt(1-G*G)*X)}const _=t(new dt);_.setAttribute("position",new st(b,3)),A.add(new ep(_,t(new uu({color:14673663,size:1.6,sizeAttenuation:!1,fog:!1})))),n.add(A);const y=t(new Wr(.05,.07,2.1,8)),S=t(new du(.26,0)),C=t(new Bo(.34,.2,6)),v=t(new Rr(1.4,20)),x=i(1842988),T=t(VC()),D=jr.map(([N,Q])=>{const G=new mt;G.position.set(N,0,Q);const X=new Ke(y,x);X.position.y=1.05;const V=new Ke(C,x);V.position.y=2.42;const ee=t(new Kt({color:_f.clone()})),Z=new Ke(S,ee);Z.position.y=2.1;const se=t(new ou({map:T,blending:to,depthWrite:!1,transparent:!0,opacity:0})),pe=new Rc(se);pe.position.y=2.1,pe.scale.setScalar(3.2);const Ue=t(new Kt({map:T,blending:to,depthWrite:!1,transparent:!0,opacity:0})),We=new Ke(v,Ue);return We.rotation.x=-Math.PI/2,We.position.y=.03,G.add(X,V,Z,pe,We),n.add(G),{lamp:Z,lampMaterial:ee,haloMaterial:se,poolMaterial:Ue,level:0}});let U=0;return{group:n,update(N,Q,G){U+=N,D.forEach((X,V)=>{let ee=0;if(Q&&V in Q){const se=1-(G-Q[V])/IA,pe=se<.35?.75+.25*Math.sin(U*22+V):1;ee=Math.max(.15,Math.min(1,.3+se))*pe}X.level+=(ee-X.level)*Math.min(1,N*10);const Z=X.level;X.lampMaterial.color.copy(_f).lerp(HC,Z),X.haloMaterial.opacity=Z*.95,X.poolMaterial.opacity=Z*.55,X.lamp.rotation.y=U*.6+V})},dispose(){e.forEach(N=>N.dispose())}}}function WC(n){const e=new mt;e.name="bearer";const t=new Ps({color:14277874}),i=new Ps({color:15780264}),r=new Ps({color:16757844}),s=new mt,a=new Ke(new Wr(.17,.36,n*.74,12),t);a.position.y=n*.37;const o=new Ke(new Lo(.24,.035,6,16),r);o.rotation.x=Math.PI/2,o.position.y=n*.5;const l=new Ke(new Ks(.15,14,10),i);l.position.y=n*.86;const c=new Ke(new Ks(.19,14,10,0,Math.PI*2,0,Math.PI*.62),t);c.position.set(0,n*.88,-.03),c.rotation.x=-.35;const u=new Ke(new Bo(.06,.12,8),t);return u.position.set(0,n*.965,-.06),s.add(a,o,l,c,u),e.add(s),{root:e,height:n,crouch(h){s.scale.y=1-.45*h},dispose(){s.traverse(h=>{var d;return(d=h.geometry)==null?void 0:d.dispose()}),t.dispose(),i.dispose(),r.dispose()}}}const qe={link:null,pose:null,config:{}},Gn=1.75,Jl={x:-2.6,z:3.4},Zl=0,qC=.4,$l=1,bt=n=>document.querySelector(n),Ef=n=>Math.round(n*100)/100;function jC(n){const{graphics:e,services:t,signal:i}=n,r=qe.config,s=qe.link,a=new Sy({canvas:e.canvas,antialias:e.pixelRatio>=1,powerPreference:"high-performance"}),o=new Ah;o.background=new be(461592),o.fog=new au(461592,26,92);const l=new Wt(58,1,.1,220),c={w:0,h:0};let u=null,h=null,d=null,f=null,g=null,m=!1,A=null,p=Uc({yaw:Zl,scale:Gn/1.8});const b=new mt,M=gC({...Jl,rotation:Zl},{scale:Gn/1.8,constrain:LC}),E=_C(),_={screen:"boot",came:"direct",walked:0,lift:0,focus:0,options:[],autopilot:!1,inputPaused:!1,noticeUntil:0,clock:0,poseAt:0,lastSecond:-1},y={active:!1,t:0,done:null,marked:!1},S=()=>(s==null?void 0:s.roster.self)||(A==null?void 0:A.self)||"self",C=I=>{var L,O;return I===S()?t.identity.name||"You":((L=s==null?void 0:s.roster.members.find(j=>j.id===I))==null?void 0:L.name)||((O=d==null?void 0:d.others.get(I))==null?void 0:O.name)||"Player"},v=(I,L=null)=>t.call("results",I,L,i).catch(O=>(console.warn("[lantern-tag] result",(O==null?void 0:O.message)??O),null)),x=NC({link:s??{roster:{self:"",host:"",members:[]},channel:{state(){},event(){},pump(){},flush(){}},on:()=>()=>{}},authorityOf:UA,self:S,onEvent(I){I.type==="lit"?f==null||f.lit():I.type==="faded"?f==null||f.faded():I.type==="caught"&&I.mine?f==null||f.caught():I.type==="joined"?G(`${C(I.id)} joined the round`):I.type==="merged"?(v("abandon"),v("begin",{match:I.id})):I.type==="over"&&U()}});function T(){const I=A?Math.max(1,Math.min(8,A.size)):1;return un.party.formats.filter(L=>L.sizes.includes(I))}function D(I,L=!1){if(y.active||!m)return;_.screen==="match"&&N(),_.screen==="results"&&x.clear();const O=r.round||zc,j=MC(`${(A==null?void 0:A.id)??""}${Date.now()}${Math.random()}`),z=I===un.party.solo?x.startSolo({seed:j,duration:O}):x.startParty({format:I,seed:j,duration:O});v("begin",{match:z}),_.autopilot=L,_.lastSecond=-1,d.arrival.enter(),Q("match"),f.start()}function U(){const I=x.round;if(!I||_.screen!=="match")return;const L=BC(I,{format:x.format,self:S(),name:C});v(L?"report":"abandon",L),pe(I,L),M.place({}),Q("results"),f.end()}function N(){x.leave(),v("abandon"),Q("arrival")}function Q(I){_.screen=I,document.body.dataset.screen=I,document.body.classList.toggle("party",I==="match"&&x.format!==un.party.solo);for(const L of["boot","title","menu","results"])bt(`#${L}`).classList.toggle("show",L===I);bt("#hud").classList.toggle("show",I==="arrival"||I==="match"),I==="arrival"&&(bt("#hint").textContent="Walk around, then start a round"),I==="match"&&(bt("#hint").textContent="Walk up to a lit lantern to catch it")}function G(I){const L=bt("#notice");L.textContent=I,L.classList.add("show"),_.noticeUntil=_.clock+4}function X(I){const L=Ky(I,{at:Jl,facing:Zl,avatarHeight:Gn});p=L.camera,M.scale=L.scale,M.place({...Jl,y:0,rotation:L.avatarRotation}),E.clear(),_.lift=0,d.arrival.stage(I),d.self.motion={},Q("arrival"),Y()}function V(){_.options=T(),_.focus=0;const I=x.joinable();bt("#options").replaceChildren(..._.options.map((O,j)=>{const z=document.createElement("button");z.className="oui-list__item",z.dataset.option=O.id;const fe=document.createElement("span");fe.className="oui-list__body",fe.textContent=O.label;const $=document.createElement("span");return $.className="oui-list__meta",$.textContent=O.id===un.party.solo?"You against the night":I?"Join the round in progress":"Your party, the same lanterns",z.append(fe,$),z.addEventListener("click",()=>{_.focus=j,D(O.id)}),z})),bt("#menu-text").textContent=`A round lasts ${r.round||zc} seconds. Lanterns caught is your score.`,ee(),M.place({}),Q("menu")}function ee(){[...bt("#options").children].forEach((I,L)=>L===_.focus?I.setAttribute("data-oui-focus",""):I.removeAttribute("data-oui-focus"))}function Z(I,L,O,j,z){const fe=document.createElement("div");fe.className="oui-score",j&&fe.setAttribute("aria-current","true");for(const[$,me]of[["rank",I],["name",z?`${L} (left)`:L],["value",O]]){const Ae=document.createElement("span");Ae.className=`oui-score__${$}`,Ae.textContent=String(me),fe.append(Ae)}return fe}function se(I,L){const O=RC(I).map((j,z)=>Z(z+1,C(j.id),j.score,j.id===S(),j.gone));return L&&O.push(Z("","The night",I.missed,!1,!1)),O}function pe(I,L){const O=I.scores[S()]??0,j=L&&L.winner!==null&&L.teams[L.winner].players[0].kind==="self";bt("#results-title").textContent=L?j?`You won with ${O} lantern${O===1?"":"s"}`:L.winner===null?`A tie on ${O}`:`You caught ${O} lantern${O===1?"":"s"}`:"The round is over",bt("#results-board").replaceChildren(...se(I,Object.keys(I.scores).length<2))}let Ue="";function We(){const I=x.round;if(_.screen==="match"&&I){const L=Math.max(0,Math.ceil(I.duration-I.elapsed)),O=`${I.scores[S()]??0}|${L}|${JSON.stringify(I.scores)}|${I.gone.length}`;O!==Ue&&(Ue=O,bt("#score-value").textContent=String(I.scores[S()]??0),bt("#time-value").textContent=`${Math.floor(L/60)}:${String(L%60).padStart(2,"0")}`,x.format!==un.party.solo&&bt("#board").replaceChildren(...se(I,!1))),L<=5&&L!==_.lastSecond&&L>0&&(_.lastSecond=L,f.tick())}_.noticeUntil&&_.clock>_.noticeUntil&&(_.noticeUntil=0,bt("#notice").classList.remove("show"))}function Ge(){const I=Math.max(1,Math.round(e.width)),L=Math.max(1,Math.round(e.height));return I===c.w&&L===c.h?!1:(c.w=I,c.h=L,a.setPixelRatio(e.pixelRatio),a.setSize(I,L,!1),l.aspect=I/L,l.updateProjectionMatrix(),!0)}function Y(){const I=M.state;vC(l,jy(p,{x:I.x,z:I.z},c.w||1280))}function J(I){b.position.set(I.x,I.y,I.z),b.rotation.y=I.rotation+Math.PI}function de(){if(!y.active)return a.render(o,l);const I=Math.max(0,Math.min(1,y.t/qC)),L=I*I*(3-2*I);y.marked||(y.marked=!0,b.traverse(j=>j.layers.enable($l)),o.traverse(j=>j.isLight&&j.layers.enable($l)));const{background:O}=o;if(a.autoClear=!0,L<1?(a.render(o,l),a.autoClear=!1,Ie.material.opacity=L,a.render(xe,Ve),a.clearDepth()):a.setClearColor(0,1),o.background=null,l.layers.set($l),a.render(o,l),l.layers.set(0),o.background=O,a.autoClear=!0,L>=1&&y.done){const j=y.done;y.done=null,j(P())}}const Ie=new Ke(new Yr(2,2),new Kt({color:0,transparent:!0,depthTest:!1,depthWrite:!1,fog:!1}));Ie.frustumCulled=!1;const xe=new Ah;xe.add(Ie);const Ve=new Po(-1,1,1,-1,0,1);function St(){if(d.self.kind!=="vrm")return Gn;const L=new xn().setFromObject(d.self.root).max.y-b.position.y;return L>=.5&&L<=4?L:Gn}function P(){const I=new R;l.getWorldDirection(I).multiplyScalar(5).add(l.position);const L=O=>({x:O.x,y:O.y,z:O.z});return{camera:{position:L(l.position),target:L(I),fov:l.fov},avatar:{feet:{x:b.position.x,y:0,z:b.position.z},yaw:M.state.rotation,height:St()}}}function at(){return y.active?new Promise(I=>I(P())):(_.screen==="match"?(x.leave(),v("abandon")):x.clear(),Q("arrival"),document.body.classList.add("leaving"),M.place({y:0}),E.clear(),_.lift=0,d.arrival.phase!=="standing"&&d.arrival.stage(null),d.self.motion={},p=Uc({yaw:p.yaw,scale:M.scale}),Ge(),J(M.state),Y(),d.update(.3,l),h.crouch(0),y.active=!0,y.t=0,new Promise(I=>{y.done=I,de()}))}function Ne(I){if(_.clock+=I,Ge(),y.active)return y.t+=I,de();const{input:L,pressed:O,deltas:j}=n,z=_.screen,fe=d.arrival.crouch>0||_.inputPaused,$=(z==="arrival"||z==="match")&&!fe;if(z==="title")O.interact&&X(null);else if(z==="arrival")O.interact&&!fe&&V();else if(z==="menu"){const ue=_.options.length;O.down&&(_.focus=(_.focus+1)%ue),O.up&&(_.focus=(_.focus+ue-1)%ue),(O.up||O.down)&&ee(),O.back?Q("arrival"):O.interact&&ue&&D(_.options[_.focus].id)}else z==="results"&&O.interact&&(x.clear(),Q("arrival"));let me=0,Ae=0,ie=!1;const ce=$&&z==="match"&&_.autopilot&&x.round;if(ce){const ue=DC(x.round,[M.state.x,M.state.z]);me=ue.strafe,Ae=ue.forward,ie=!0}else $&&((j.lookX||j.lookY)&&zy(p,j.lookX*100,j.lookY*100),(L.lookX||L.lookY)&&Wy(p,-L.lookX*dd.lookYawRate*I,L.lookY*dd.lookPitchRate*I),O.jump&&E.queue(),me=L.right-L.left,Ae=L.down-L.up,ie=L.run>0);const Se=Math.abs(me)+Math.abs(Ae)>.05;qy(p,I,Se);const ye=ce?0:p.yaw,le={x:M.state.x,z:M.state.z},Re=M.advance(I,{strafe:me,forward:Ae,yaw:ye,running:ie,jump:$&&E.read(I)});z==="arrival"&&(_.walked+=Math.hypot(M.state.x-le.x,M.state.z-le.z)),_.lift=Re.y,J(Re);const F=M.speed();d.self.motion=Re.floor?{speed:F}:{air:!0,speed:F},_.screen==="match"&&x.update(I,[M.state.x,M.state.z]),We(),Y(),d.update(I,l),h.root.visible=d.self.kind!=="vrm",h.crouch(d.arrival.crouch);const te=_.screen==="match"?x.round:null;u.update(I,(te==null?void 0:te.lit)??null,(te==null?void 0:te.elapsed)??0);const ae=performance.now();qe.pose&&ae-_.poseAt>100&&(_.poseAt=ae,qe.pose(d.pose({x:Re.x,y:Re.y,z:Re.z},Re.rotation))),de()}EC(()=>_.screen==="arrival"&&!y.active&&m?M:null,()=>{!m||y.active||_.screen==="arrival"||(_.screen==="match"&&N(),X(null))});async function Te(){const I=(L,O)=>{n.loading.progress(L,O),bt("#boot-text").textContent=O};I(.1,"Laying the flagstones…"),u=zC(),o.add(u.group),h=WC(Gn),d=AC({services:t,motion:async()=>kC(),load:L=>{if(!g){const O=new op;O.setURLModifier(j=>j.endsWith("basis_transcoder.js")?Qy:j.endsWith("basis_transcoder.wasm")?Hy:j),g=new fn(O).setTranscoderPath("/").setWorkerLimit(1),g.detectSupport(a)}return MA(L,{ktx2:g})},height:Gn,heading:Math.PI,standIn:!1,signal:i}),b.add(d.self.root,h.root),o.add(b,d.group),f=QC(n.audio),I(.4,"Lighting the lanterns…"),Q("boot"),Ge(),J(M.state),Y(),a.compile(o,l),I(.7,"Finding your avatar…"),await Promise.race([d.loadSelf(),new Promise(L=>setTimeout(()=>L(!1),15e3))]),I(1,"Ready"),m=!0,h.root.visible=d.self.kind!=="vrm",u.update(0,null,0),de()}function _e(I){var O;A=I.trip??null,_.came=((O=I.arrival)==null?void 0:O.from)==="lobby"?"lobby":"direct",bt("#title-lobby").hidden=!r.embedded,bt("#title-go").addEventListener("click",()=>X(null)),bt("#start").addEventListener("click",()=>{_.screen==="arrival"&&V()}),bt("#menu-back").addEventListener("click",()=>Q("arrival")),bt("#menu-go").addEventListener("click",()=>{_.options.length&&D(_.options[_.focus].id)}),bt("#leave-round").addEventListener("click",()=>{_.screen==="match"&&N()}),bt("#results-done").addEventListener("click",()=>{x.clear(),Q("arrival")});const L=()=>t.call("travel","lobby",null,i).catch(()=>{});for(const j of["lobby","title-lobby","results-lobby"])bt(`#${j}`).addEventListener("click",L);_.came==="lobby"?X(I.arrival.view):r.autoplay?(X(null),D(un.party.solo,!0)):(X(null),Q("title")),Ge(),de()}function ot(I){A=I,_.screen==="menu"&&V()}s==null||s.report(()=>({options:T().map(I=>({id:I.id,solo:I.id===un.party.solo})),phase:_.screen==="match"?"match":_.screen==="results"?"results":"menu",match:_.screen==="match"?x.report():null})),s==null||s.on("choose",I=>{T().some(L=>L.id===I)&&D(I,!0)}),s==null||s.on("arrived",({member:I,late:L})=>{L&&x.versus&&G(`${I.name} arrived: they can join this round`)}),qe.peers=I=>d==null?void 0:d.setPeers(I),qe.entered=()=>d==null?void 0:d.arrival.enter(),qe.stageDeparture=at,qe.redraw=()=>{m&&(Ge(),Y(),de())},qe.versus=()=>x.versus,qe.soloMatch=()=>_.screen==="match"&&!x.versus,qe.away=I=>x.away(I);function Ee(){return{screen:_.screen}}function Oe(){}function _t(I){_.inputPaused=I,I&&M.place({})}function gt(){const I=d?d.inspect():{},L=x.round,O=M.state,j=new R(O.x,Gn*.5,O.z).project(l);return{booted:m,screen:_.screen,position:[Ef(O.x),Ef(O.z)],arrival:_.screen==="arrival"&&d?bC({camera:l.position,fov:l.fov,avatar:{x:O.x,y:0,z:O.z},avatarForward:{x:-Math.sin(O.rotation),z:-Math.cos(O.rotation)},avatarHeight:Gn,crouched:d.arrival.crouch>0,handsEmpty:d.arrival.handsEmpty}):null,came:_.came,standing:d?d.arrival.crouch===0:!1,walked:_.walked>.5,partySize:A?A.size:1,options:T().map(z=>z.id).join(","),format:x.format,role:x.role,phase:L?L.over?"over":"playing":"idle",score:L?L.scores[S()]??0:0,missed:L?L.missed:0,left:L?Math.ceil(L.duration-L.elapsed):0,lanterns:L?Object.keys(L.lit).length:0,lanternsLit:L?Object.keys(L.lit).length>0:!1,players:L?Object.keys(L.scores).length:0,leaving:y.active,...I,avatarSelf:I.avatarSelf==="none"?"stand-in":I.avatarSelf,avatarSelfInFrame:I.avatarSelf==="none"?Math.abs(j.x)<=1&&Math.abs(j.y)<=1&&j.z<1:I.avatarSelfInFrame}}function B(){x.dispose(),f==null||f.dispose(),d==null||d.dispose(),h==null||h.dispose(),u==null||u.dispose(),g==null||g.dispose(),Ie.geometry.dispose(),Ie.material.dispose(),a.dispose();for(const I of["peers","entered","stageDeparture","redraw","versus","soloMatch","away"])delete qe[I]}return{prepare:Te,enter:_e,update:Ne,suspend:Ee,restore:Oe,dispose:B,inspect:gt,party:ot,inputPaused:_t}}const Fi=new URLSearchParams(location.search),ec=document.querySelector("#stage"),Ss=Fi.has("check")?Fi.get("check")||"scenario":"",XC=["avatars","party","results","locomotion","saved","process"],tc=Tm(),qc=Gm(),yt=Nm({arrival:un.arrival,party:un.party,storageKeys:[],storageNamespace:"lantern-tag",identityTimeoutMs:1500}),wA=ng(),TA=()=>{document.body.classList.add("hud-measure");try{return ig()}finally{document.body.classList.remove("hud-measure")}},YC=sg(()=>({hud:TA()}),{insets:()=>wA.insets}),yu=ug(Ln.slice(0,-1)),jc=KA();yu.onTalking((n,e)=>jc.setTalking(n.length>(e?1:0)));const Mu=new Set;yt.on("peers",n=>{var e;for(const t of n)for(const i of[t.vrm,t.avatarUrl])typeof i=="string"&&i&&i.length<=2048&&Mu.add(i);(e=qe.peers)==null||e.call(qe,n.map(t=>({...t,talking:t.talking===!0||yu.isTalking(t.id)})))});qc.on("roster",n=>{for(const e of n.members)e.avatarUrl&&Mu.add(e.avatarUrl)});const RA=am({post:(n,e)=>yt.post(n,e),stage(n){if(!qe.stageDeparture)throw new Error("NOT_READY");return qe.stageDeparture(n)}});let Pi=null,BA=!1;yt.on("departure",n=>{BA=!0;for(const e of wf)Pi==null||Pi.release(e);RA.receive("departure",{reason:n})});const nc=Pm({post:(n,e)=>yt.post(n,e)}),Za=Ym(n=>yt.post("result",{result:n}));yt.hello();let $a=null;async function KC(n,e,t){if(n==="results"){if(e==="begin")return Za.begin((t==null?void 0:t.match)||void 0);if(e==="report")return Za.report(t).match;if(e==="abandon")return Za.abandon(),!0}if(n==="travel"&&e==="lobby")return RA.leave(),!0;throw new Error("HOST_SERVICE_UNAVAILABLE")}async function JC(n,e){if(n!==$a.avatar&&!Mu.has(n))throw new Error("AVATAR_NOT_VOUCHED");const t=await fetch(n,{signal:e});if(!t.ok)throw new Error(`AVATAR_HTTP_${t.status}`);return t.arrayBuffer()}function ZC(){const n=Number(Fi.get("party"));return{arrival:Fi.has("arrive")?{from:"lobby",view:{cameraOffset:{x:0,y:2,z:5.04},cameraTargetOffset:{x:0,y:1.05,z:0},avatarRotation:0,avatarHeight:1.7,fov:58}}:{from:"direct",view:null},trip:Number.isInteger(n)&&n>=2&&n<=8?{id:`dev-party-${n}`,room:"",size:n,self:"",arrived:[],roster:null,members:Array.from({length:n-1},(e,t)=>({id:`dev-${t+2}`,name:`Player ${t+2}`,pfp:"",avatarUrl:""}))}:null}}async function $C(){var _;const n=performance.now(),e=await yt.identity();$a={id:"visitor",name:e.name||"You",pfp:e.pfp,avatar:e.avatarUrl||""};const t=Number(Fi.get("round"));qe.link=qc,qe.pose=y=>yt.pose(y),qe.config={embedded:yt.embedded,check:Ss,autoplay:Fi.has("autoplay"),round:t>=5&&t<=600?t:0};const i={canvas:ec,width:window.innerWidth,height:window.innerHeight,pixelRatio:["party","results","locomotion"].includes(Ss)||Ss==="process"&&!Fi.has("video")?.3:Math.min(window.devicePixelRatio||1,2)},r=new WA(jC,{manifest:un.runtime,graphics:i,services:{identity:$a,asset:()=>Promise.reject(new Error("NO_ASSETS")),call:KC,avatar:JC},sendUI(){},onProgress:(y,S)=>nc.progress(y,S),audio:jc,now:()=>performance.now()});let s=!0,a=!1,o=!1,l=performance.now();Pi=qm(r,{mode:()=>{var y;return BA||(y=qe.versus)!=null&&y.call(qe)?"multiplayer":"solo"},away:y=>{var S;return(S=qe.away)==null?void 0:S.call(qe,y)},onChange:()=>{l=performance.now()},onError:y=>console.error("[lantern-tag]",y)});const c=Wm(Pi,{document,window}),u=Dm(r,{game:"lantern-tag",prefix:Ln,input:un.runtime.input,paused:()=>{var y;return((y=qe.soloMatch)==null?void 0:y.call(qe))&&Pi.hold("input")},resumed:()=>Pi.release("input")}),h=bm(r,un.runtime.input),d=new AbortController;let f=null;const g=(y,S)=>{try{r.delta(y,Math.max(-1,Math.min(1,S/100)))}catch{}};ec.addEventListener("pointerdown",y=>f={id:y.pointerId,x:y.clientX,y:y.clientY},{signal:d.signal}),window.addEventListener("pointermove",y=>{(f==null?void 0:f.id)===y.pointerId&&(g("lookX",y.clientX-f.x),g("lookY",y.clientY-f.y),f.x=y.clientX,f.y=y.clientY)},{signal:d.signal});for(const y of["pointerup","pointercancel"])window.addEventListener(y,()=>f=null,{signal:d.signal});ec.addEventListener("contextmenu",y=>y.preventDefault(),{signal:d.signal});const m=y=>{if(s){if(requestAnimationFrame(m),i.width=window.innerWidth,i.height=window.innerHeight,!a&&!o)try{r.tick(Math.max(0,y-l)/1e3)}catch(S){console.error("[lantern-tag]",S),tc.stageFailed("update",S)}l=y}};requestAnimationFrame(m);const A=()=>new Promise(y=>requestAnimationFrame(y)),p=Um(nc,()=>{var y;i.width=window.innerWidth,i.height=window.innerHeight,(y=qe.redraw)==null||y.call(qe)},window);await tc.stage("prepare",()=>r.prepare());const b=()=>({...r.inspect(),...Za.inspect(),hud:TA()});fg(b),JA(b),await Promise.race([A(),new Promise(y=>setTimeout(y,1e3))]),nc.firstFrame({width:window.innerWidth,height:window.innerHeight}),yt.ready();const M=yt.embedded?await yt.enterData():ZC();await tc.stage("enter",()=>{var y;return r.enter({avatar:{id:$a.id,position:[-2.6,0,3.4],rotation:[0,1,0,0]},camera:{position:[-2.6,2,8.4],target:[-2.6,1.05,3.4],fov:((y=M.arrival.view)==null?void 0:y.fov)??58,mode:"third-person"},party:[],arrival:M.arrival,trip:M.trip})}),yt.embedded&&JSON.stringify(yt.trip)!==JSON.stringify(M.trip)&&r.party(yt.trip),yt.on("party",y=>r.party(y)),await A(),await A(),M.arrival.from==="lobby"&&!yt.revealed?(o=!0,yt.on("revealed",()=>{var y;o=!1,l=performance.now(),(y=qe.entered)==null||y.call(qe)})):(_=qe.entered)==null||_.call(qe),yt.arrivalReady(),Ss&&!XC.includes(Ss)&&tm(await em({session:r,scenario:vg,backend:"webgl2",bootMs:performance.now()-n,frame:A,pauseHostClock:y=>{a=y,l=performance.now()},act:um(r)}));const E=()=>{s&&(s=!1,c(),p(),YC(),wA.dispose(),u.dispose(),h.dispose(),d.abort(),yu.dispose(),qc.dispose(),jc.dispose(),yt.dispose(),r.dispose())};yt.on("dispose",E),window.addEventListener("pagehide",E,{once:!0})}$C().catch(n=>{console.error(n),yt.fail((n==null?void 0:n.message)||"boot failed"),document.querySelector("#boot-text").textContent="Something went wrong. Please reload."});
