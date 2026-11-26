(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();const NA=32,Va=Object.freeze({self:"",host:"",online:!1,members:[]}),hi=(n,e)=>typeof n=="string"?n.slice(0,e):"";function Mf(n){const e=n;if(!e||typeof e!="object"||!Array.isArray(e.members))return Va;const t=new Set,i=[];for(const a of e.members.slice(0,NA)){const o=hi(a==null?void 0:a.id,64);!o||t.has(o)||(t.add(o),i.push({id:o,session:hi(a==null?void 0:a.session,64),name:hi(a==null?void 0:a.name,24).trim()||"Player",pfp:hi(a==null?void 0:a.pfp,2048),avatarUrl:hi(a==null?void 0:a.avatarUrl,2048),seat:(a==null?void 0:a.seat)==="spectator"?"spectator":"player",state:(a==null?void 0:a.state)==="away"?"away":"here",order:Number.isFinite(a==null?void 0:a.order)?Number(a.order):i.length}))}i.sort((a,o)=>a.order-o.order||(a.id<o.id?-1:1));const r=hi(e.self,64),s=hi(e.host,64);return{self:t.has(r)?r:"",host:t.has(s)?s:"",online:e.online!==!1,members:i}}function FA(n,e){const t=[],i=new Map(((n==null?void 0:n.members)??[]).map(a=>[a.id,a])),r=new Map(e.members.map(a=>[a.id,a])),s=!!(n!=null&&n.self);n&&n.online!==e.online&&t.push({type:e.online?"online":"offline"});for(const a of(n==null?void 0:n.members)??[])r.has(a.id)||t.push({type:"left",member:a});for(const a of e.members){const o=i.get(a.id);o?(o.state==="here"&&a.state==="away"&&t.push({type:"dropped",member:a}),o.state==="away"&&a.state==="here"&&t.push({type:"returned",member:a}),o.seat==="spectator"&&a.seat==="player"&&t.push({type:"seat",member:a})):t.push({type:"arrived",member:a,late:s&&a.id!==e.self})}return(((n==null?void 0:n.host)??"")!==e.host||((n==null?void 0:n.self)??"")!==e.self)&&(e.host||n!=null&&n.host)&&t.push({type:"host",member:r.get(e.host)??null,self:!!e.host&&e.host===e.self}),t}const OA=(n,e)=>n.members.find(t=>t.id===e)??null;function kA(n,e){var t,i;return e.includes(n.host)&&((t=OA(n,n.host))==null?void 0:t.state)==="here"?n.host:((i=n.members.find(r=>r.state==="here"&&e.includes(r.id)))==null?void 0:i.id)??""}const QA=3,xn="oncyber:game:",HA=n=>`${n}:`;function GA(n,e){if(typeof n!="string")return null;for(const t of[xn])if(n.startsWith(t)&&/^[a-z][a-z-]{0,31}$/.test(n.slice(t.length)))return n.slice(t.length);return null}const VA=Object.freeze({arrival:Object.freeze({from:"direct",view:null}),trip:null}),If=7,ac=24,za=Object.freeze({offset:1e3,rotation:1e6,fov:Object.freeze([5,150]),avatarHeight:Object.freeze([.2,10])}),Bi=(n,e)=>typeof n=="string"?n.trim().slice(0,e):"",Ru=n=>n&&[n.x,n.y,n.z].every(e=>typeof e=="number"&&Number.isFinite(e)&&Math.abs(e)<=za.offset)?{x:n.x,y:n.y,z:n.z}:null;function Sf(n){const e=Ru(n==null?void 0:n.cameraOffset),t=Ru(n==null?void 0:n.cameraTargetOffset);if(!e||!t||typeof n.avatarRotation!="number"||!Number.isFinite(n.avatarRotation)||Math.abs(n.avatarRotation)>za.rotation)return null;const[i,r]=za.fov;if(!(typeof n.fov=="number"&&n.fov>i&&n.fov<r))return null;const[s,a]=za.avatarHeight;return{cameraOffset:e,cameraTargetOffset:t,avatarRotation:n.avatarRotation,avatarHeight:typeof n.avatarHeight=="number"&&n.avatarHeight>=s&&n.avatarHeight<=a?n.avatarHeight:1.8,fov:n.fov,cameraMode:n.cameraMode==="first-person"?"first-person":"third-person"}}function Bu(n){if(!Array.isArray(n))return[];const e=new Set,t=[];for(const i of n.slice(0,32)){const r=Bi(i==null?void 0:i.id,64);!r||e.has(r)||t.length>=If||(e.add(r),t.push({id:r,name:Bi(i==null?void 0:i.name,ac)||"Player",pfp:Bi(i==null?void 0:i.pfp,2048),avatarUrl:Bi(i==null?void 0:i.avatarUrl,2048)}))}return t}function Bs(n){const e=Bi(n==null?void 0:n.id,96);if(!e)return null;const t=Bu(n.members),i=Bu(n.arrived),r=n.roster?Mf(n.roster):null,s=Number.isInteger(n.size)?Math.max(2,Math.min(If+1,n.size)):0;return{id:e,room:Bi(n.room,160),size:Math.max(s,t.length+1,i.length+1,2),members:t,self:Bi(n.self,64),arrived:i,roster:r!=null&&r.members.length?r:null}}function zA(n){var t;const e=((t=n==null?void 0:n.arrival)==null?void 0:t.from)==="lobby"?"lobby":"direct";return{arrival:{from:e,view:e==="lobby"?Sf(n.arrival.view):null},trip:Bs(n==null?void 0:n.trip)}}const Cf=Object.freeze({Escape:"menu",Enter:"chat",NumpadEnter:"chat"}),WA=Object.freeze({KeyM:"mute"});function qA(n){return(n.metaKey===!0||n.ctrlKey===!0)&&!n.altKey&&Object.hasOwn(WA,n.code)}const di=Object.freeze({key:"key",input:"input",muted:"muted",probe:"input-probe",state:"input-state"});function jA(n){const e=new Map;for(const[t,i]of Object.entries(n??{}))for(const r of(i==null?void 0:i.keyboard)??[])typeof r!="string"||Object.hasOwn(Cf,r)||e.set(r,[...e.get(r)??[],t]);return e}const Lu=/^[a-z][a-z0-9-]{0,23}$/;class XA{constructor(e={}){this.holds=new Map,this.listener=e}get paused(){return this.holds.size>0}get reason(){return this.holds.values().next().value??""}put(e,t){var r,s;const i=this.holds.size===0;this.holds.size>=16&&!this.holds.has(e)||(this.holds.set(e,t),i&&((s=(r=this.listener).paused)==null||s.call(r,t)))}drop(e){var t,i;this.holds.delete(e)&&!this.holds.size&&((i=(t=this.listener).resumed)==null||i.call(t))}hold(e){Lu.test(e)&&!this.holds.has(e)&&this.put(e,e)}release(e){this.drop(e)}set(e,t="page"){e?this.put("@page",Lu.test(t)?t:"page"):this.drop("@page")}}class YA{constructor(e){this.keys=new Map,this.down=new Map,this.delivered=0,this.keys=jA(e)}bound(e){return this.keys.has(e)}key(e,t){const i=[];for(const r of this.keys.get(e)??[]){const s=this.down.get(r)??new Set,a=s.size>0;t?s.add(e):s.delete(e),s.size?this.down.set(r,s):this.down.delete(r),a!==s.size>0&&i.push([r,t?1:0])}return this.delivered+=i.length,i}held(){return[...this.down.keys()]}releaseAll(){const e=this.held();return this.down.clear(),e}}const KA=32*1024*1024;function er(n,e=16384){const t=new Set;let i=0,r=0;const s=(o,l)=>{if(++i>4096)throw new Error("UI_MESSAGE_SIZE");if(l>8)throw new Error("UI_MESSAGE_DEPTH");if(typeof o=="string"){if(r+=o.length,r>e)throw new Error("UI_MESSAGE_SIZE");return o}if(o===null||typeof o=="boolean"||typeof o=="number"&&Number.isFinite(o))return o;if(!o||typeof o!="object"||t.has(o))throw new Error("UI_MESSAGE_INVALID");if(!Array.isArray(o)&&Object.getPrototypeOf(o)!==Object.prototype&&Object.getPrototypeOf(o)!==null)throw new Error("UI_MESSAGE_INVALID");t.add(o);const c=Object.entries(Object.getOwnPropertyDescriptors(o));if(c.length>1024)throw new Error("UI_MESSAGE_SIZE");const u=Array.isArray(o)?[]:{};for(const[h,d]of c)if(!(Array.isArray(o)&&h==="length")){if(r+=h.length,r>e)throw new Error("UI_MESSAGE_SIZE");if(["__proto__","constructor","prototype"].includes(h)||d.get||d.set)throw new Error("UI_MESSAGE_INVALID");u[h]=s(d.value,l+1)}return t.delete(o),u},a=s(n,0);if(new TextEncoder().encode(JSON.stringify(a)).length>e)throw new Error("UI_MESSAGE_SIZE");return a}class JA{constructor(e,t){this.phase="created",this.frames=0,this.lifetime=new AbortController,this.input=Object.create(null),this.deltas=Object.create(null),this.presses=new Set,this.saved=null,this.pending=Promise.resolve(),this.uiAt=-1/0,this.visit={arrival:"",trip:null},this.inputPaused=!1,this.options=t;for(const a of Object.keys(t.manifest.input))this.input[a]=this.deltas[a]=0;const i=new Set(t.manifest.capabilities),r=new Set(t.manifest.assets),s={identity:Object.freeze({...t.services.identity}),asset:(a,o)=>!i.has("assets")||!r.has(a)?Promise.reject(new Error("ASSET_NOT_DECLARED")):(this.assertLive(),t.services.asset(a,o)),avatar:(a,o)=>{if(!i.has("avatar")||typeof a!="string"||!a||a.length>2048)return Promise.reject(new Error("CAPABILITY_NOT_GRANTED"));if(!t.services.avatar)return Promise.reject(new Error("HOST_SERVICE_ADAPTER_REQUIRED"));try{this.assertLive()}catch(l){return Promise.reject(l)}return t.services.avatar(a,o).then(l=>{if(!(l instanceof ArrayBuffer))throw new Error("AVATAR_INVALID");if(l.byteLength>KA)throw new Error("AVATAR_TOO_LARGE");return l})},call:(a,o,l,c)=>!i.has(a)||!/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(o)?Promise.reject(new Error("CAPABILITY_NOT_GRANTED")):(this.assertLive(),t.services.call(a,o,er(l),c).then(u=>er(u)))};this.game=e({graphics:t.graphics,services:s,audio:t.audio,signal:this.lifetime.signal,ui:{publish:a=>{this.assertLive(),this.pendingUI=er(a)}},loading:{progress:(a,o)=>{var l;this.phase==="preparing"&&((l=t.onProgress)==null||l.call(t,a,o))}},input:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.input[a]}])))),deltas:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.deltas[a]}])))),pressed:Object.freeze(Object.defineProperties({},Object.fromEntries(Object.keys(this.input).map(a=>[a,{enumerable:!0,get:()=>this.presses.has(a)}]))))})}setInputPaused(e,t="page"){var i,r;this.inputPaused===e||this.phase==="disposed"||this.phase==="failed"||(this.inputPaused=e,this.clearInput(),(r=(i=this.game).inputPaused)==null||r.call(i,e,e?t:""))}assertLive(){if(this.lifetime.signal.aborted||this.phase==="disposed"||this.phase==="failed")throw new Error("RUNTIME_DISPOSED")}async bounded(e){this.assertLive();let t;const i=new Promise((r,s)=>{t=setTimeout(()=>{this.lifetime.abort(),s(new Error("RUNTIME_TIMEOUT"))},this.options.timeoutMs??3e4)});try{const r=await Promise.race([Promise.resolve().then(e),i]);return this.assertLive(),r}finally{clearTimeout(t)}}serial(e){const t=this.pending.then(e);return this.pending=t.catch(()=>{this.phase!=="disposed"&&(this.phase="failed")}),t}prepare(){return this.serial(async()=>{if(this.phase!=="created")throw new Error("RUNTIME_PHASE");this.phase="preparing",await this.bounded(()=>this.game.prepare()),this.phase="ready"})}enter(e){return this.serial(async()=>{var i;if(this.phase!=="ready")throw new Error("RUNTIME_PHASE");const t=JSON.parse(JSON.stringify(e));t.arrival&&(t.arrival=t.arrival.from==="lobby"?{from:"lobby",view:Sf(t.arrival.view)}:{from:"direct",view:null}),t.trip!==void 0&&(t.trip=Bs(t.trip)),this.visit={arrival:((i=t.arrival)==null?void 0:i.from)??"",trip:t.trip??null},await this.bounded(()=>this.game.enter(t)),this.phase="entered"})}party(e){var t,i;this.assertLive(),!(this.phase!=="entered"&&this.phase!=="suspended")&&(this.visit.trip=Bs(e),(i=(t=this.game).party)==null||i.call(t,Bs(e)))}suspend(){return this.serial(async()=>{var e;if(this.phase!=="entered")throw new Error("RUNTIME_PHASE");this.phase="suspended",this.clearInput(),(e=this.options.audio)==null||e.suspend(),this.saved=er(await this.bounded(()=>this.game.suspend()),65536)})}restore(){return this.serial(async()=>{var e;if(this.phase!=="suspended")throw new Error("RUNTIME_PHASE");await this.bounded(()=>this.game.restore(er(this.saved,65536))),this.phase="entered",(e=this.options.audio)==null||e.restore()})}action(e,t=1){if(this.assertLive(),!Object.hasOwn(this.input,e)||!Number.isFinite(t)||Math.abs(t)>1)throw new Error("INPUT_ACTION_INVALID");this.phase==="entered"&&!this.inputPaused&&(t>0&&this.input[e]<=0&&this.presses.add(e),this.input[e]=t)}delta(e,t){if(this.assertLive(),!Object.hasOwn(this.deltas,e)||!Number.isFinite(t)||Math.abs(t)>1)throw new Error("INPUT_ACTION_INVALID");this.phase==="entered"&&!this.inputPaused&&(this.deltas[e]=Math.max(-64,Math.min(64,this.deltas[e]+t)))}clearInput(){for(const e of Object.keys(this.input))this.input[e]=this.deltas[e]=0;this.presses.clear()}tick(e){if(this.phase==="entered"){if(!Number.isFinite(e)||e<0)throw new Error("RUNTIME_DELTA_INVALID");try{this.game.update(Math.min(e,.1)),this.presses.clear();for(const i of Object.keys(this.deltas))this.deltas[i]=0;this.frames++;const t=(this.options.now??Date.now)();this.pendingUI!==void 0&&t-this.uiAt>=50&&(this.options.sendUI(this.pendingUI),this.pendingUI=void 0,this.uiAt=t)}catch(t){throw this.phase="failed",this.lifetime.abort(),t}}}inspect(){var i;const{arrival:e,trip:t}=this.visit;return er({...this.game.inspect(),...(i=this.options.audio)==null?void 0:i.inspect(),hostPhase:this.phase,hostFrames:this.frames,hostArrival:e,hostParty:(t==null?void 0:t.size)??0,hostPartyArrived:t?t.arrived.length+1:0,hostInputPaused:this.inputPaused})}dispose(){return this.stop?this.stop:(this.lifetime.abort(),this.clearInput(),this.phase="disposed",this.pendingUI=void 0,this.stop=this.pending.then(async()=>{let e;try{await Promise.race([Promise.resolve().then(()=>this.game.dispose()),new Promise((t,i)=>{e=setTimeout(()=>i(new Error("RUNTIME_DISPOSE_TIMEOUT")),this.options.timeoutMs??3e4)})])}finally{clearTimeout(e)}}),this.stop)}}async function ZA(n,e,t,i=(r,s)=>n.action(r,s)){if(n.phase!=="entered")throw new Error("RUNTIME_NOT_READY");if(e.version!==1||!Array.isArray(e.steps)||e.steps.length<1||e.steps.length>128)throw new Error("SCENARIO_INVALID");for(const s of e.steps)if(s.type==="action")await i(s.action,s.value??1);else if(s.type==="wait"){if(!Number.isInteger(s.frames)||s.frames<1||s.frames>600)throw new Error("SCENARIO_INVALID");for(let a=0;a<s.frames;a++)n.tick(1/60),await t()}else if(s.type==="waitUntil"){if(typeof s.key!="string"||!Number.isInteger(s.maxFrames)||s.maxFrames<1||s.maxFrames>3600)throw new Error("SCENARIO_INVALID");let a=!1;for(let o=0;o<=s.maxFrames;o++){const l=n.inspect();if(l&&typeof l=="object"&&!Array.isArray(l)&&Object.hasOwn(l,s.key)&&l[s.key]===s.equals){a=!0;break}if(o===s.maxFrames)break;n.tick(1/60),await t()}if(!a)throw new Error(`SCENARIO_TIMEOUT:${s.key}`)}else if(s.type==="assert"){const a=n.inspect();if(!Object.hasOwn(a,s.key)||a[s.key]!==s.equals)throw new Error(`SCENARIO_ASSERT:${s.key}`)}else throw new Error("SCENARIO_INVALID");await n.suspend();const r=n.frames;if(n.tick(1),n.frames!==r)throw new Error("LIFECYCLE_SUSPEND_FAILED");if(await n.restore(),n.tick(1/60),await t(),n.phase!=="entered"||n.frames!==r+1)throw new Error("LIFECYCLE_RESTORE_FAILED")}const $A=.3,em=(n,e)=>typeof n=="number"&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):e;function tm(n){var b,M;let e=1,t=!1,i=!1,r=!1,s=!1,a=!1,o=!1,l=0,c=!1;const u=new Set,h=(n==null?void 0:n.createGain())??null,d=(n==null?void 0:n.createGain())??null,p=((b=n==null?void 0:n.createAnalyser)==null?void 0:b.call(n))??null,m=((M=n==null?void 0:n.createAnalyser)==null?void 0:M.call(n))??null;n&&h&&d&&(h.connect(d),d.connect(n.destination),p&&m&&(p.fftSize=m.fftSize=2048,h.connect(p),d.connect(m)));const g=new Float32Array(2048),A=S=>{if(!S||(n==null?void 0:n.state)!=="running")return 0;S.getFloatTimeDomainData(g);let C=0;for(let I=0;I<g.length;I++)C=Math.max(C,Math.abs(g[I]));return Math.round(C*1e4)/1e4},f=()=>t||s?0:e*(i||r?$A:1),E=()=>u.forEach(S=>S()),v=S=>{!n||!d||(d.gain.cancelScheduledValues(n.currentTime),n.state!=="running"||S===0?d.gain.value=f():d.gain.setTargetAtTime(f(),n.currentTime,S))};v(0);const _=S=>(S??Promise.resolve()).then(()=>!0,()=>!1).then(C=>(E(),C));return{context:n,output:h,get muted(){return t},get volume(){return e},get audible(){return(n==null?void 0:n.state)==="running"&&f()>0},receive(S){if(!S||typeof S!="object"||c)return!1;const C=S,I=`${e}|${t}|${i}`,y=i||r;if(e=em(C.volume,e),typeof C.muted=="boolean"&&(t=C.muted),typeof C.speaking=="boolean"&&(i=C.speaking),I!==`${e}|${t}|${i}`){const T=i||r;v(y&&!T?.35:T&&!y?.06:.02),E()}return C.gesture===!0&&this.unlock(),C.probe===!0},async unlock(){if(!n||c||(a=!0,s))return!1;if(n.state==="running")return!0;let S;try{S=n.resume()}catch{return!1}const C=await _(S);return v(0),C&&n.state==="running"},setTalking(S){if(c||r===(S===!0))return;const C=i||r;r=S===!0;const I=i||r;C!==I&&v(I?.06:.35),E()},suspend(){if(!(s||c)){if(s=!0,v(0),(n==null?void 0:n.state)==="running")try{_(n.suspend())}catch{}E()}},restore(){if(!(!s||c)){if(s=!1,v(0),a&&n)try{_(n.resume())}catch{}E()}},onChange(S){return u.add(S),()=>void u.delete(S)},inspect(){const S=A(p);return S>0&&(o=!0),{audioState:(n==null?void 0:n.state)??"none",audioRouted:o,audioBypass:l,audioMuted:t,audioVolume:e,audioDucked:(i||r)&&!t,audioSuspended:s,audioGain:d?Math.round(d.gain.value*1e3)/1e3:0,audioInput:S,audioLevel:A(m)}},reportBypass(){l++},dispose(){if(!c){c=!0,u.clear();for(const S of[h,d,p,m])try{S==null||S.disconnect()}catch{}n&&n.state!=="closed"&&n.close().catch(()=>{})}}}}const Du="oncyber:sound";function nm(n){var f,E,v;const e=xn,t=window.AudioContext||window.webkitAudioContext;let i=null;try{i=t?new t:null}catch{}const r=tm(i),s=window.parent!==window,a=(_,b)=>{s&&window.parent.postMessage({type:`${e}${_}`,...b},"*")},o=[],l=(_,b,M)=>{if(!_||typeof _[b]!="function")return;const S=_[b];_[b]=M(S),o.push(()=>{_[b]=S})};let c=!1;const u=_=>{r.reportBypass(),c||console.warn(`[oncyber] ${_} bypasses the game's sound output; connect it to audio.output`),c=!0},h=new WeakSet;l((f=window.AudioNode)==null?void 0:f.prototype,"connect",_=>function(...b){const M=window.AudioDestinationNode;return M&&b[0]instanceof M&&u("A node connected to a destination"),_.apply(this,b)}),l((E=window.AudioContext)==null?void 0:E.prototype,"createMediaElementSource",_=>function(b){return h.add(b),_.call(this,b)}),l((v=window.HTMLMediaElement)==null?void 0:v.prototype,"play",_=>function(){return!h.has(this)&&!this.muted&&this.volume>0&&u("A media element"),_.call(this)});const d=()=>a("audio-state",{state:r.inspect()}),p=_=>{var b;_.source!==window.parent||((b=_.data)==null?void 0:b.type)!==`${e}audio`||r.receive(_.data)&&d()},m=_=>{_.isTrusted&&r.unlock()},g=["pointerdown","pointerup","keydown","touchend"];s&&window.addEventListener("message",p);for(const _ of g)window.addEventListener(_,m,{capture:!0,passive:!0});if(!s)try{r.receive(JSON.parse(localStorage.getItem(Du)||"{}"))}catch{}a("audio",{hello:!0});const A=r.dispose;return Object.assign(r,{requestMuted(_){if(r.receive({muted:_}),a("audio",{muted:_}),!s)try{localStorage.setItem(Du,JSON.stringify({volume:r.volume,muted:_}))}catch{}},dispose(){window.removeEventListener("message",p);for(const _ of g)window.removeEventListener(_,m,{capture:!0});for(const _ of o.splice(0))_();A()}})}const Vo="__oncyberGame";function im(n){const e=globalThis,t=e[Vo]??(e[Vo]={});t.inspect=()=>JSON.parse(JSON.stringify(n()))}const rm="oncyber:check-report";async function sm(n,e){const t=[];let i=await e();for(let a=0;a<n;a++){const o=await e();t.push(o-i),i=o}t.sort((a,o)=>a-o);const r=a=>t.length?t[Math.min(t.length-1,Math.floor(a*t.length))]:0,s=a=>Math.round(a*10)/10;return{count:t.length,medianMs:s(r(.5)),p95Ms:s(r(.95)),worstMs:s(t[t.length-1]??0)}}const Pu=n=>String((n==null?void 0:n.message)??n).slice(0,500);async function am(n){const{session:e,scenario:t,frame:i}=n,r=[{stage:"boot",status:e.phase==="entered"?"passed":"failed",ms:Math.round(n.bootMs)}];let s={count:0,medianMs:0,p95Ms:0,worstMs:0};const a=async(l,c)=>{const u=performance.now();try{await c(),r.push({stage:l,status:"passed",ms:Math.round(performance.now()-u)})}catch(h){r.push({stage:l,status:"failed",ms:Math.round(performance.now()-u),error:Pu(h)})}};r[0].status==="passed"&&(n.pauseHostClock(!0),await a("scenario",()=>ZA(e,t,()=>i().then(()=>{}),n.act)),r[1].status==="passed"&&r.push({stage:"lifecycle",status:"passed",ms:0}),n.pauseHostClock(!1),await a("frames",async()=>{if(s=await sm(n.frames??180,i),e.phase!=="entered")throw new Error(`RUNTIME_${e.phase.toUpperCase()}`)}));let o=null;try{o=e.inspect()}catch(l){o={error:Pu(l)}}return{version:1,status:r.every(l=>l.status==="passed")?"passed":"failed",backend:n.backend,bootMs:Math.round(n.bootMs),stages:r,frames:s,inspect:o}}function om(n){window.parent!==window&&window.parent.postMessage({type:rm,report:n},"*"),window.__checkReport=n}const Wa=n=>typeof n=="number"&&Number.isFinite(n),Uu=n=>!!n&&[n.x,n.y,n.z].every(e=>Wa(e)&&Math.abs(e)<=1e3),Nu=n=>({x:n.x,y:n.y,z:n.z}),to=(n,e)=>({x:n.x-e.x,y:n.y-e.y,z:n.z-e.z}),wf=n=>Math.hypot(n.x,n.y,n.z);function Tf(n){const e=n;return!e||!Uu(e.cameraOffset)||!Uu(e.cameraTargetOffset)||!Wa(e.avatarRotation)||Math.abs(e.avatarRotation)>1e6||!Wa(e.avatarHeight)||e.avatarHeight<.2||e.avatarHeight>10||!Wa(e.fov)||e.fov<=5||e.fov>=150?null:{cameraOffset:Nu(e.cameraOffset),cameraTargetOffset:Nu(e.cameraTargetOffset),avatarRotation:e.avatarRotation,avatarHeight:e.avatarHeight,fov:e.fov}}function lm(n){const{camera:e,avatar:t}=n,i=t.facing,r=t.yaw??(i&&Math.hypot(i.x,i.z)>1e-6?Math.atan2(-i.x,-i.z):0),s=Tf({cameraOffset:to(e.position,t.feet),cameraTargetOffset:to(e.target,t.feet),avatarRotation:r,avatarHeight:t.height,fov:e.fov});if(!s)throw new Error("DEPARTURE_VIEW_INVALID");return s}function cm(n,e){const t=n.cameraOffset,i=to(n.cameraTargetOffset,t),r=wf(i);if(r<1e-6||!(e>0))return null;const s={x:i.x/r,y:i.y/r,z:i.z/r};let a={x:-s.z,y:0,z:s.x};const o=Math.hypot(a.x,a.z);a=o>1e-6?{x:a.x/o,y:0,z:a.z/o}:{x:1,y:0,z:0};const l={x:a.y*s.z-a.z*s.y,y:a.z*s.x-a.x*s.z,z:a.x*s.y-a.y*s.x},c=Math.tan(n.fov*Math.PI/360),u=p=>{const m=to(p,t),g=m.x*s.x+m.y*s.y+m.z*s.z;return g<.05?null:{x:.5+(m.x*a.x+m.y*a.y+m.z*a.z)/(g*c*e)/2,y:.5-(m.x*l.x+m.y*l.y+m.z*l.z)/(g*c)/2}},h=u({x:0,y:0,z:0}),d=u({x:0,y:n.avatarHeight,z:0});return!h||!d?null:{x:(h.x+d.x)/2,top:d.y,bottom:h.y,height:h.y-d.y}}function um(n,e=16/9){if(!n)return"DEPARTURE_VIEW_INVALID";if(wf(n.cameraOffset)<.6)return"DEPARTURE_CAMERA_INSIDE_AVATAR";const t=cm(n,e);return t?t.height<.08?"DEPARTURE_AVATAR_TOO_SMALL":t.top<-.02||t.bottom>1.02||t.x<.05||t.x>.95?"DEPARTURE_AVATAR_OFF_SCREEN":null:"DEPARTURE_AVATAR_BEHIND_CAMERA"}const hm=()=>new Promise(n=>{const e=globalThis;typeof e.requestAnimationFrame=="function"?e.requestAnimationFrame(n):setTimeout(n,16)});function dm(n){const e=n.frame??hm;let t="playing",i=null;const r=async s=>{t="staging",n.post("departure-staging");let a=null;try{const o=await n.stage(s);i="camera"in o?lm(o):Tf(o),a=um(i);for(let l=0;l<(n.settleFrames??2);l++)await e()}catch(o){i=null,a=String((o==null?void 0:o.message)??o).slice(0,120)}t="staged",n.post("departure-ready",a?{view:null,problem:a}:{view:i})};return{get phase(){return t},get view(){return i},leave(){t==="playing"&&(t="asked",n.post("exit"))},receive(s,a){return s!=="departure"?!1:(t==="staged"?n.post("departure-ready",{view:i}):t!=="staging"&&r((a==null?void 0:a.reason)==="party"?"party":"self"),!0)}}}const fm="oncyber:check-input",pm="oncyber:check-input-done";function Am(n=location.search){const e=new URLSearchParams(n);if(!e.has("check"))return null;const t=e.get("check");return t==="phone"||t==="gamepad"?t:"desktop"}const Fu=(n,e)=>e===0?(n??0)===0:n!==void 0&&Math.abs(n-e)<=.1;function mm(n,e=Am(),t={}){if(e!=="phone"&&e!=="gamepad")return;const i=t.post??(c=>window.parent.postMessage(c,"*")),r=t.listen??(c=>{const u=h=>{h.source===window.parent&&c(h.data)};return window.addEventListener("message",u),()=>window.removeEventListener("message",u)}),s=t.wait??(()=>new Promise(c=>setTimeout(c,16))),a=Object.create(null),o=n.action.bind(n);n.action=(c,u=1)=>{o(c,u),a[c]=u};let l=0;return async(c,u)=>{const h=++l,d=await new Promise(p=>{const m=setTimeout(()=>{g(),p("DEVICE_DRIVER_TIMEOUT")},t.timeoutMs??15e3),g=r(A=>{(A==null?void 0:A.type)!==pm||A.id!==h||(clearTimeout(m),g(),p(typeof A.error=="string"&&A.error?A.error:null))});i({type:fm,id:h,profile:e,action:c,value:u})});if(d)throw new Error(d);for(let p=0;p<60&&!Fu(a[c],u);p++)await s();if(!Fu(a[c],u))throw new Error(`DEVICE_INPUT_LOST:${c}`)}}const Ou={"stick-up":{axis:"y",sign:1},"stick-down":{axis:"y",sign:-1},"stick-left":{axis:"x",sign:-1},"stick-right":{axis:"x",sign:1},"stick-x":{axis:"x",sign:0},"stick-y":{axis:"y",sign:0}};function gm(n,e=""){return typeof n!="string"?null:Object.hasOwn(Ou,n)?{kind:"stick",...Ou[n]}:n==="button"?{kind:"button",label:ku(e)}:n.startsWith("button:")?{kind:"button",label:n.slice(7).trim().slice(0,12)||ku(e)}:null}const ku=n=>n?n[0].toUpperCase()+n.slice(1,12):"",_m=["button-a","button-b","button-x","button-y","left-bumper","right-bumper","left-trigger","right-trigger","button-select","button-start","left-stick-press","right-stick-press","dpad-up","dpad-down","dpad-left","dpad-right"],Em={left:0,right:2};function vm(n){if(typeof n!="string")return null;const e=_m.indexOf(n);if(e>=0)return{kind:"button",index:e};const t=/^(left|right)-stick-(up|down|left|right|x|y)$/.exec(n);if(!t)return null;const i=["up","down","y"].includes(t[2]),r=t[2]==="up"||t[2]==="right"?1:t[2]==="down"||t[2]==="left"?-1:0;return{kind:"axis",index:Em[t[1]]+(i?1:0),sign:r,invert:i}}const bm=n=>(n==null?void 0:n.gamepad)===void 0?[]:Array.isArray(n.gamepad)?n.gamepad:[n.gamepad];function xm(n){const e={stick:[],buttons:[],custom:[]};for(const[t,i]of Object.entries(n??{})){if((i==null?void 0:i.touch)===void 0)continue;const r=gm(i.touch,t);r?r.kind==="stick"?e.stick.push({action:t,axis:r.axis,sign:r.sign}):e.buttons.push({action:t,label:r.label}):e.custom.push(t)}return e}const ym=n=>Math.round(n*1e3)/1e3,Rf=(n,e)=>ym(e===0?n:Math.max(0,n*e));function Qu(n,e,t){const i=Math.hypot(e,t);i>1&&(e/=i,t/=i);const r={};for(const s of n)r[s.action]=Rf(s.axis==="x"?e:t,s.sign);return r}function Mm(n){const e=[];for(const[t,i]of Object.entries(n??{})){const r=bm(i).map(vm).filter(s=>s!==null);r.length&&e.push({action:t,sources:r})}return e}function Im(n,e,t=.2){const i=[0,2].map(s=>{const a=e.axes[s]??0,o=e.axes[s+1]??0,l=Math.hypot(a,o);if(!(l>t))return[0,0];const c=Math.min(1,(l-t)/(1-t))/l;return[a*c,o*c]}),r={};for(const{action:s,sources:a}of n){let o=0;for(const l of a){let c;if(l.kind==="button"){const u=e.buttons[l.index];c=u!=null&&u.pressed?1:0}else{const u=i[l.index>>1][l.index&1];c=Rf(l.invert?-u:u,l.sign)}Math.abs(c)>Math.abs(o)&&(o=c)}r[s]=o}return r}const tr=46,Sm=`
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
`;function Cm(n,e,t={}){const i=xm(e),r=Mm(e),s=()=>(n.phase===void 0||n.phase==="entered")&&!n.inputPaused,a={touch:{},gamepad:{}},o=Object.create(null),l=(M,S)=>{var C;for(const[I,y]of Object.entries(S)){if(!s()&&y!==0){a[M][I]=0;continue}if((a[M][I]??0)!==y){a[M][I]=y;try{n.action(I,y)}catch{continue}o[I]={device:M,value:y,count:(((C=o[I])==null?void 0:C.count)??0)+1}}}},c=M=>l(M,Object.fromEntries(Object.keys(a[M]).map(S=>[S,0])));let u,h;const d=[],p=(M,S,C,I)=>{M.addEventListener(S,C,I),d.push(()=>M.removeEventListener(S,C,I))},m=()=>{if(!(u||!i.stick.length&&!i.buttons.length)){if(h=document.createElement("style"),h.textContent=Sm,document.head.prepend(h),u=document.createElement("div"),u.className="oncyber-controls",u.setAttribute("data-oncyber-controls",""),p(u,"touchstart",M=>M.preventDefault(),{passive:!1}),p(u,"contextmenu",M=>M.preventDefault()),i.stick.length){const M=document.createElement("div"),S=document.createElement("div"),C=document.createElement("div");M.setAttribute("data-oncyber-stick",i.stick.map(P=>P.action).join(" ")),M.setAttribute("data-hud","control-stick"),S.setAttribute("data-oncyber-stick-base",""),C.setAttribute("data-oncyber-stick-knob",""),S.append(C),M.append(S),u.append(M);let I=null,y=0,T=0;const N=P=>{let k=P.clientX-y,F=P.clientY-T;const G=Math.hypot(k,F);G>tr&&(k*=tr/G,F*=tr/G),C.style.transform=`translate(${k}px,${F}px)`,l("touch",Qu(i.stick,k/tr,-F/tr))},D=P=>{P.pointerId===I&&(I=null,C.style.transform="",M.removeAttribute("data-oncyber-down"),l("touch",Qu(i.stick,0,0)))};p(M,"pointerdown",P=>{if(I!==null)return;I=P.pointerId;const k=S.getBoundingClientRect();y=k.left+k.width/2,T=k.top+k.height/2,M.setAttribute("data-oncyber-down","");try{M.setPointerCapture(P.pointerId)}catch{}N(P)}),p(M,"pointermove",P=>{P.pointerId===I&&N(P)});for(const P of["pointerup","pointercancel","lostpointercapture"])p(M,P,D)}if(i.buttons.length){const M=document.createElement("div");M.setAttribute("data-oncyber-buttons","");for(const{action:S,label:C}of i.buttons){const I=document.createElement("button");I.type="button",I.tabIndex=-1,I.setAttribute("data-oncyber-action",S),I.setAttribute("data-hud",`control-${S}`),I.setAttribute("aria-label",C),I.textContent=C;const y=new Set;p(I,"pointerdown",N=>{y.add(N.pointerId),I.setAttribute("data-oncyber-down","");try{I.setPointerCapture(N.pointerId)}catch{}l("touch",{[S]:1})});const T=N=>{!y.delete(N.pointerId)||y.size||(I.removeAttribute("data-oncyber-down"),l("touch",{[S]:0}))};for(const N of["pointerup","pointercancel","lostpointercapture"])p(I,N,T);M.append(I)}u.append(M)}(t.root??document.body).append(u)}};typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches&&m();const g=M=>{M.pointerType==="touch"&&m()};window.addEventListener("pointerdown",g,{capture:!0,passive:!0});let A=0,f=!0,E=r.length>0&&typeof navigator<"u"&&"getGamepads"in navigator;const v=()=>{if(!f||!E)return;A=requestAnimationFrame(v);let M;try{M=navigator.getGamepads()}catch{E=!1;return}const S={};for(const C of M)if(!(!C||C.connected===!1))for(const[I,y]of Object.entries(Im(r,C,t.deadZone)))(Math.abs(y)>Math.abs(S[I]??0)||!(I in S))&&(S[I]=y);Object.keys(S).length?l("gamepad",S):c("gamepad")};E&&(A=requestAnimationFrame(v));const _=()=>{a.touch={},a.gamepad={}};window.addEventListener("blur",_);const b={log:o,layout:i,pads:r.map(M=>M.action),reach:tr,showTouch:m};return window.__oncyberDevices=b,{showTouch:m,dispose(){f=!1,cancelAnimationFrame(A),window.removeEventListener("pointerdown",g,{capture:!0}),window.removeEventListener("blur",_);for(const M of d.splice(0))M();u==null||u.remove(),h==null||h.remove(),u=h=void 0,window.__oncyberDevices===b&&delete window.__oncyberDevices}}}const wm=2e4,Hu="ONCYBER_HEALTH_PROBE",Tm=["prepare","enter","update","suspend","restore","dispose"],Rm=200,Bm=10,Lm=30;function Gu(n,e){if(typeof n!="string"||!n)return"";const i=(n.split(/[?#]/)[0].split("/").pop()??"").replace(/[^\w.-]/g,"").slice(0,80);return i&&Number.isInteger(e)&&e>0?`${i}:${e}`:i}function zo(n,e,t){const i=n,r=typeof(i==null?void 0:i.name)=="string"&&i.name!=="Error"?`${i.name}: `:"",s=typeof(i==null?void 0:i.message)=="string"?i.message:typeof n=="string"?n:"unknown error";let a=Gu(e,t);if(!a&&typeof(i==null?void 0:i.stack)=="string"){const o=/(?:\(|@|at )([^\s()@]+?):(\d+):\d+\)?\s*$/m.exec(i.stack);o&&(a=Gu(o[1],Number(o[2])))}return{message:(r+s).replace(/\s+/g," ").trim().slice(0,Rm),where:a}}function Dm(n){const e=[...n].sort((r,s)=>r-s),t=r=>e.length?e[Math.min(e.length-1,Math.floor(r*e.length))]:0,i=r=>Math.round(r*10)/10;return{count:e.length,medianMs:i(t(.5)),p95Ms:i(t(.95))}}function Pm(n=wm){let e=[],t=-1,i=-1;return{frame(r){if(t<0)return t=i=r,null;if(e.push(r-i),i=r,r-t<n)return null;const s=e.length>=Lm?Dm(e):null;return e=[],t=r,s},reset(){e=[],t=i=-1}}}function Um(n={}){return Nm(n)}function Nm(n){var v,_;const e=n.target??globalThis,t=e.parent,i=n.post??(b=>{var M;t&&t!==e&&((M=t.postMessage)==null||M.call(t,b,"*"))}),r=n.game?`${n.game}:`:xn,s=`${r}health`,a=new Set;let o=0,l=!1,c=0;const u=b=>{const M=`${b.kind}:${"stage"in b?b.stage:""}:${b.message}`;if(!(l||a.has(M)||o>=Bm)){a.add(M),o++;try{i({type:s,...b})}catch{}}},h=(b,M)=>{Tm.includes(b)&&u({kind:"stage",stage:b,...zo(M)})},d=b=>{var S;const M=(b==null?void 0:b.error)??(b==null?void 0:b.message);u({kind:"error",...zo(M,b==null?void 0:b.filename,b==null?void 0:b.lineno)}),(M==null?void 0:M.message)===Hu&&((S=b.preventDefault)==null||S.call(b))},p=b=>u({kind:"error",...zo(b==null?void 0:b.reason)}),m=/[?&]check\b/.test(((v=e.location)==null?void 0:v.search)??""),g=b=>{var M,S;m&&(b==null?void 0:b.source)===e.parent&&(((M=b==null?void 0:b.data)==null?void 0:M.type)===`${r}health-probe`||((S=b==null?void 0:b.data)==null?void 0:S.type)===`${xn}health-probe`)&&(e.setTimeout??setTimeout)(()=>{throw new Error(Hu)},0)},A=Pm(n.windowMs),f=b=>{var S;if(l)return;const M=(S=e.document)!=null&&S.hidden?null:A.frame(b);if(M)try{i({type:s,kind:"frames",...M})}catch{}c=e.requestAnimationFrame(f)},E=()=>A.reset();return e.addEventListener("error",d),e.addEventListener("unhandledrejection",p),e.addEventListener("message",g),(_=e.document)==null||_.addEventListener("visibilitychange",E),e.requestAnimationFrame&&(c=e.requestAnimationFrame(f)),{stageFailed:h,async stage(b,M){try{return await M()}catch(S){throw h(b,S),S}},dispose(){var b,M;l=!0,(b=e.cancelAnimationFrame)==null||b.call(e,c),e.removeEventListener("error",d),e.removeEventListener("unhandledrejection",p),e.removeEventListener("message",g),(M=e.document)==null||M.removeEventListener("visibilitychange",E)}}}const Fm=n=>{const e=n;return!!e&&typeof e.tagName=="string"&&(e.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))};function Om(n){const e=n.window??window,t=n.document??e.document,i=n.prefix??`${n.game}:`,r=n.post??(f=>{e.parent!==e&&e.parent.postMessage(f,"*")}),s=new YA(n.input);let a=null,o=!1,l=!1;const c=()=>{for(const f of s.releaseAll())n.action(f,0)},u=new XA({paused(f){var E,v;c(),t.pointerLockElement&&(o=!0,(E=t.exitPointerLock)==null||E.call(t)),(v=n.paused)==null||v.call(n,f)},resumed(){var f;(f=n.resumed)==null||f.call(n)}}),h=f=>{if(Fm(f.target)||f.isComposing)return;const E=f.type==="keydown";if(qA(f)){f.preventDefault(),E&&!f.repeat&&r({type:i+di.key,code:f.code,mod:!0});return}if(Object.hasOwn(Cf,f.code)){f.preventDefault(),E&&!f.repeat&&r({type:i+di.key,code:f.code});return}if(!s.bound(f.code)||f.ctrlKey||f.metaKey||f.altKey){if(!E)for(const[v,_]of s.key(f.code,!1))n.action(v,_);return}if(f.preventDefault(),!(u.paused||E&&f.repeat))for(const[v,_]of s.key(f.code,E))n.action(v,_)},d=()=>c(),p=f=>{var _,b;if(f.source!==e.parent)return;const E=f.data,v=typeof(E==null?void 0:E.type)=="string"&&E.type.startsWith(i)?E.type.slice(i.length):"";if(v===di.input)u.set(E.paused===!0,typeof E.reason=="string"?E.reason:"page");else if(v===di.muted)(_=n.muted)==null||_.call(n,E.muted===!0);else if(v===di.probe){let M=null;try{M=((b=n.probe)==null?void 0:b.call(n))??null}catch{}r({type:i+di.state,paused:u.paused,reason:u.reason,held:s.held(),delivered:s.delivered,locked:!!t.pointerLockElement,probe:M})}},m=()=>{if(t.pointerLockElement)return;const f=o;o=!1,!f&&a&&!u.paused&&r({type:i+di.key,code:"Escape"})},g=()=>{a&&!u.paused&&!t.pointerLockElement&&a.isConnected!==!1&&A(a)},A=f=>{var E;try{const v=(E=f.requestPointerLock)==null?void 0:E.call(f);v&&typeof v.catch=="function"&&v.catch(()=>{})}catch{}};return e.addEventListener("keydown",h),e.addEventListener("keyup",h),e.addEventListener("blur",d),e.addEventListener("message",p),e.addEventListener("pointerdown",g),t.addEventListener("pointerlockchange",m),{get paused(){return u.paused},hold:f=>u.hold(f),release:f=>u.release(f),lockPointer(f){a=f,u.paused||A(f)},unlockPointer(){var f;a=null,t.pointerLockElement&&(o=!0,(f=t.exitPointerLock)==null||f.call(t))},dispose(){l||(l=!0,c(),e.removeEventListener("keydown",h),e.removeEventListener("keyup",h),e.removeEventListener("blur",d),e.removeEventListener("message",p),e.removeEventListener("pointerdown",g),t.removeEventListener("pointerlockchange",m))}}}function km(n,e){return Om({probe:()=>n.inspect(),...e,action(t,i){n.phase==="entered"&&n.action(t,i)},paused(t){var i;n.setInputPaused(!0,t),(i=e.paused)==null||i.call(e,t)},resumed(){var t;n.setInputPaused(!1),(t=e.resumed)==null||t.call(e)}})}const Vu=n=>{const e=t=>Number.isFinite(t)?Math.max(0,Math.round(t)):0;return{width:e(n==null?void 0:n.width),height:e(n==null?void 0:n.height)}};function Qm(n){const e=n.now??(()=>{var d,p;return((p=(d=globalThis.performance)==null?void 0:d.now)==null?void 0:p.call(d))??Date.now()}),t=n.minIntervalMs??100;let i=0,r=-1/0,s=-1,a="",o=0,l=null,c=0,u=null;const h={progress(d,p=""){if(l!==null||!Number.isFinite(d))return;i=Math.max(i,Math.min(1,Math.max(0,d)));const m=typeof p=="string"?p.slice(0,80):"",g=e();i===s&&m===a||i<1&&g-r<t||(r=g,s=i,a=m,o++,n.post("progress",{value:i,label:m}))},firstFrame(d){l===null&&(l=Math.max(0,Math.round(e())),u=Vu(d),i=1,n.post("first-frame",{ms:l,...u}))},redrawn(d){const p=Vu(d);l!==null&&(u&&u.width===p.width&&u.height===p.height||(u=p,c++,n.post("frame",{...p})))},report:()=>({progress:i,progressMessages:o,firstFrameMs:l,redraws:c,size:u&&{...u}})};return Bf("loading",h.report),h}function Hm(n,e,t){const i=()=>{e(),n.redrawn({width:t.innerWidth,height:t.innerHeight})};return t.addEventListener("resize",i),()=>t.removeEventListener("resize",i)}function Bf(n,e){const t=globalThis;(t.__oncyberGame??(t.__oncyberGame={}))[n]=e}const is=(n,e)=>typeof n=="string"?n.trim().slice(0,e):"";function Gm(n={}){const e=n.window??window,t=e.parent!==e,i={};let r=null,s=null,a=null,o="",l=!1,c=!t,u;const h={identity:[],enter:[]},d=(f,E)=>{var v;return(v=i[f])==null?void 0:v.forEach(_=>_(E))},p=(f,E={})=>{t&&e.parent.postMessage({type:xn+f,...E},e.location.origin)},m=f=>{const E=JSON.stringify(a);a=f&&{...f,self:f.self||o},JSON.stringify(a)!==E&&d("party",a)},g=f=>{var _;if(f.source!==e.parent||f.origin!==e.location.origin)return;const E=GA((_=f.data)==null?void 0:_.type),v=f.data;E==="identity"?(r={name:is(v.name,ac)||"You",pfp:is(v.pfp,2048),avatarUrl:is(v.avatarUrl,2048)},clearInterval(u),h.identity.splice(0).forEach(b=>b(r)),l&&p("ready")):E==="enter"?(s=zA(v),m(s.trip),h.enter.splice(0).forEach(b=>b({...s,trip:a}))):E==="party"?m(Bs(v.party)):E==="self"?(o=is(v.id,64),d("self",o),a&&m({...a,self:o})):E==="peers"?d("peers",(Array.isArray(v.players)?v.players:[]).slice(0,32).filter(b=>b&&typeof b.id=="string"&&b.id).map(b=>({...b,id:b.id.slice(0,64),name:is(b.name,ac)||"Player"}))):E==="net"?typeof v.from=="string"&&d("net",{from:v.from.slice(0,64),data:v.data??null}):E==="entered"?(c=!0,d("revealed",void 0)):E==="departure"?d("departure",v.reason==="party"?"party":"self"):E==="dispose"&&d("dispose",void 0)};e.addEventListener("message",g);const A=()=>p("hello",{contract:QA,arrival:n.arrival??null,party:n.party??null});return{embedded:t,get selfId(){return o},get trip(){return a},get revealed(){return c},on(f,E){(i[f]??(i[f]=[])).push(E)},hello(){if(A(),!t)return;let f=0;u=setInterval(()=>r||++f>40?clearInterval(u):A(),250)},identity(){return r?Promise.resolve(r):new Promise(f=>{h.identity.push(f),setTimeout(()=>{r||(r={name:"You",pfp:"",avatarUrl:""},h.identity.splice(0).forEach(E=>E(r)))},t?n.identityTimeoutMs??4e3:0)})},enterData(){return s?Promise.resolve({...s,trip:a}):t?new Promise(f=>h.enter.push(f)):Promise.resolve(VA)},ready(){l=!0,p("ready")},arrivalReady(){p("arrival-ready")},fail(f){p("error",{message:String(f).slice(0,200)})},exit(){p("exit")},post(f,E){p(f,E)},pose(f){p("pose",f)},net(f){p("net",{data:f})},dispose(){clearInterval(u),e.removeEventListener("message",g)}}}const zu=30,Vm=1200,zm=32;function Wm(n){try{return JSON.stringify(n??null).length}catch{return 1/0}}function qm(n){const e=n.now??(()=>performance.now()),t=1e3/Math.min(zu,Math.max(1,n.rate??zu)),i={sent:0,dropped:0,received:0,stale:0,limited:0},r=[],s=new Map;let a=null,o=0,l=0;function c(u,h,d){const p=[++o,u,h];return Wm(p)>Vm?(i.dropped++,!1):(n.post(p,d),i.sent++,!0)}return{stats:i,state(u){a={data:u}},event(u,h){r.push({data:u,to:h}),r.length>zm&&(r.shift(),i.dropped++)},pump(){const u=e();let h=0;for(l<u-t*2&&(l=u-t*2);l<=u&&(r.length||a);){const d=r.shift();d?c(1,d.data,d.to):(c(0,a.data),a=null),l+=t,h++}return h},flush(){let u=0;for(;r.length&&u<4;){const h=r.shift();c(1,h.data,h.to),l=Math.max(l,e())+t,u++}return u},receive(u,h){if(typeof u!="string"||!u||!Array.isArray(h))return null;const[d,p,m]=h;if(!Number.isInteger(d)||p!==0&&p!==1)return null;if(i.received++,p===0){if(d<=(s.get(u)??0))return i.stale++,null;s.set(u,d)}return{from:u,kind:p===0?"state":"event",seq:d,data:m}},forget(u){s.delete(u)},limited(u){i.limited+=Math.max(0,Math.floor(u)||0)}}}function jm(n){if(!n||typeof n.id!="string"||!Array.isArray(n.members))return null;const e=n.members.slice(0,7).filter(t=>t&&typeof t.id=="string"&&t.id).map(t=>({id:t.id.slice(0,64),name:typeof t.name=="string"&&t.name.trim()?t.name.trim().slice(0,24):"Player"}));return e.length?{id:n.id.slice(0,96),size:e.length+1,members:e}:null}function Xm(n="",e=window){const t=[xn,...n?[`${n}:`]:[]];let i=t[0];const r=e.parent,s=r!==e,a=new URLSearchParams(e.location.search).has("check"),o={},l=(g,...A)=>{for(const f of o[g]??[])f(...A)},c=(g,A)=>{s&&r.postMessage({type:i+g,...A},e.location.origin)},u=qm({post:(g,A)=>c("match",A?{data:g,to:A}:{data:g})});let h=null;const d={embedded:s,party:null,roster:Va,channel:u,on(g,A){return(o[g]??(o[g]=[])).push(A),()=>{const f=o[g],E=(f==null?void 0:f.indexOf(A))??-1;E>=0&&f.splice(E,1)}},report(g){h=g},dispose(){e.removeEventListener("message",m)}};function p(g){const A=jm(g);JSON.stringify(A)!==JSON.stringify(d.party)&&(d.party=A,l("party",A));const f=A?Mf(g.roster):Va;if(JSON.stringify(f)===JSON.stringify(d.roster))return;const E=d.roster===Va?null:d.roster,v=FA(E,f);d.roster=f;for(const _ of v)(_.type==="returned"||_.type==="left")&&u.forget(_.member.id),l(_.type,_,f);l("roster",f,v)}function m(g){if(g.source!==r||g.origin!==e.location.origin)return;const A=g.data??{},f=typeof A.type=="string"?t.find(v=>A.type.startsWith(v)):void 0;if(!f)return;const E=A.type.slice(f.length);if(i=f,E==="enter")p(A.trip);else if(E==="party")p(A.party);else if(E==="match"){const v=u.receive(A.from,A.data);v&&l("match",v)}else if(E==="match-limit")u.limited(A.dropped);else if(E==="party-probe"){A.op==="choose"&&a&&typeof A.option=="string"&&l("choose",A.option);let v=null;try{v=(h==null?void 0:h())??null}catch{v=null}c("party-report",{id:A.id,report:v})}}return e.addEventListener("message",m),d}const Lf=["hidden","menu","input"];function Ym(n){const e=n.now??(()=>{var g,A;return((A=(g=globalThis.performance)==null?void 0:g.now)==null?void 0:A.call(g))??Date.now()}),t=()=>typeof n.mode=="function"?n.mode():n.mode,i=new Set;let r=!1,s=0,a=0,o=0,l=0,c=null,u=null,h=!1;const d=()=>{var f;if(c===null)return;const g=e(),A=Math.max(0,(g-c)/1e3);c=g,A>0&&(l+=A,(f=n.catchUp)==null||f.call(n,A))},p=()=>{u==null||u(),u=null,c=null},m={get paused(){return r},hold(g){var A,f;!Lf.includes(g)||i.has(g)||(i.add(g),!r&&(t()==="solo"?(p(),r=!0,s=e(),a++,n.pause(g)):g==="hidden"&&c===null&&(c=e(),u=((A=n.every)==null?void 0:A.call(n,d,1e3))??null,h=!0,(f=n.away)==null||f.call(n,!0))))},release(g){var A;i.delete(g)&&(g==="hidden"&&(d(),p(),h&&(h=!1,(A=n.away)==null||A.call(n,!1))),!(!r||i.size)&&(r=!1,o++,n.resume({reason:g,awayMs:Math.max(0,e()-s)})))},report:()=>{var g;return{mode:t(),paused:r,reasons:[...i],pauses:a,resumes:o,caughtUp:Math.round(l*1e3)/1e3,fingerprint:((g=n.fingerprint)==null?void 0:g.call(n))??null}},dispose(){p(),i.clear(),r=!1}};return Bf("pausing",m.report),m}function Km(n,e,t=.1,i=10){if(!Number.isFinite(n)||n<=0||!(t>0))return 0;const r=Math.min(n,i),s=Math.ceil(r/t-1e-9);for(let a=0;a<s;a++)e(a<s-1?t:r-t*(s-1));return r}function Jm(n,e){const{document:t,window:i}=e,r=[xn,e.prefix].filter(Boolean),s=()=>t.hidden?n.hold("hidden"):n.release("hidden"),a=o=>{var c,u;if(o.source!==i.parent)return;const l=(c=o.data)==null?void 0:c.type;((u=o.data)==null?void 0:u.reason)==="menu"&&(r.some(h=>l===`${h}pause`)?n.hold("menu"):r.some(h=>l===`${h}resume`)&&n.release("menu"))};return t.addEventListener("visibilitychange",s),i.addEventListener("message",a),s(),()=>{t.removeEventListener("visibilitychange",s),i.removeEventListener("message",a),n.dispose()}}function Zm(n,e){let t=Promise.resolve();const i=s=>{t=t.then(s).catch(a=>{var o;return(o=e.onError)==null?void 0:o.call(e,a)})};let r=null;return Ym({mode:e.mode,now:e.now,away:e.away,every:e.every??((s,a)=>{const o=setInterval(s,a);return()=>clearInterval(o)}),pause:()=>i(async()=>{var s;n.phase==="entered"&&await n.suspend(),(s=e.onChange)==null||s.call(e,!0)}),resume:()=>i(async()=>{var s;n.phase==="suspended"&&await n.restore(),(s=e.onChange)==null||s.call(e,!1)}),catchUp:s=>{var a;try{Km(s,o=>n.tick(o))}catch(o){(a=e.onError)==null||a.call(e,o)}},fingerprint:()=>{try{r=n.inspect()}catch{}return{frames:n.frames,inspect:r}}})}const Df={match:/^[A-Za-z0-9_-]{6,64}$/,format:/^[a-z0-9][a-z0-9-]{0,31}$/,maxSeconds:1440*60,minTeams:2,maxTeams:8,maxPlayers:16,maxScore:1e9,idLength:64,nameLength:24},$m=["self","peer","cpu"],Wo=n=>!!n&&typeof n=="object"&&!Array.isArray(n),Wu=(n,e)=>typeof n=="string"&&n.trim()?n.trim().slice(0,e):"";function eg(n){const e=l=>({ok:!1,error:l});if(!Wo(n))return e("RESULT_INVALID");const t=Df;if(typeof n.match!="string"||!t.match.test(n.match))return e("RESULT_MATCH_ID");if(typeof n.format!="string"||!t.format.test(n.format))return e("RESULT_FORMAT");const i=n.durationSeconds;if(typeof i!="number"||!Number.isFinite(i)||i<0||i>t.maxSeconds)return e("RESULT_DURATION");if(!Array.isArray(n.teams)||n.teams.length<t.minTeams||n.teams.length>t.maxTeams)return e("RESULT_TEAMS");const r=[],s=new Set;let a=0;for(const l of n.teams){if(!Wo(l))return e("RESULT_TEAMS");if(typeof l.score!="number"||!Number.isFinite(l.score)||Math.abs(l.score)>t.maxScore)return e("RESULT_SCORE");if(!Array.isArray(l.players)||l.players.length<1)return e("RESULT_PLAYERS");const c=[];for(const h of l.players){if(!Wo(h))return e("RESULT_PLAYERS");const d=typeof h.id=="string"&&h.id.length<=t.idLength?h.id:"",p=Wu(h.name,t.nameLength);if(!d||!p||typeof h.kind!="string"||!$m.includes(h.kind))return e("RESULT_PLAYERS");if(s.has(d))return e("RESULT_PLAYER_REPEATED");s.add(d),h.kind==="self"&&a++,c.push({id:d,name:p,kind:h.kind})}const u=Wu(l.name,t.nameLength);r.push(u?{name:u,score:l.score,players:c}:{score:l.score,players:c})}if(s.size>t.maxPlayers)return e("RESULT_PLAYERS");if(a!==1)return e("RESULT_SELF");const o=n.winner;return o!==null&&!(Number.isInteger(o)&&o>=0&&o<r.length)?e("RESULT_WINNER"):{ok:!0,result:{match:n.match,format:n.format,durationSeconds:Math.round(i*10)/10,teams:r,winner:o}}}function tg(n,e=()=>Date.now()){let t=null,i=0;const r=()=>{const s=new Uint8Array(12);return globalThis.crypto.getRandomValues(s),Array.from(s,a=>a.toString(16).padStart(2,"0")).join("")};return{begin(s){const a=s??r();if(!Df.match.test(a))throw new Error("RESULT_MATCH_ID");return t={match:a,at:e()},a},report(s){if(!t)throw new Error("RESULT_NO_OPEN_MATCH");const a=eg({match:t.match,format:s==null?void 0:s.format,durationSeconds:(s==null?void 0:s.durationSeconds)??Math.max(0,(e()-t.at)/1e3),teams:s==null?void 0:s.teams,winner:s==null?void 0:s.winner});if(a.ok===!1)throw new Error(a.error);return t=null,i++,n(a.result),a.result},abandon(){t=null},inspect:()=>({matchOpen:t!==null,resultsSent:i})}}const qu="safe-area",ju="oncyber:safe-area",ng="oncyber:hud-request",ig="oncyber:hud-report",rg={top:"--oncyber-safe-top",right:"--oncyber-safe-right",bottom:"--oncyber-safe-bottom",left:"--oncyber-safe-left"},Pf=Object.freeze({top:0,right:0,bottom:0,left:0}),$c=["top","right","bottom","left"],sg=4096,Uf=64;function ag(n){if(!n||typeof n!="object")return null;const e={top:0,right:0,bottom:0,left:0};for(const t of $c){const i=n[t];if(typeof i!="number"||!Number.isFinite(i))return null;e[t]=Math.min(sg,Math.max(0,Math.ceil(i)))}return e}const og=(n,e)=>$c.every(t=>n[t]===e[t]);function Xu(n,e){for(const t of $c)n.style.setProperty(rg[t],`${e[t]}px`)}function lg(n={}){var o,l;const e=n.window??globalThis,t=(o=e.document)==null?void 0:o.documentElement,i=new Set([ju,xn+qu,...n.game?[HA(n.game)+qu]:[]]);let r=Pf;t&&Xu(t,r);const s=()=>{var c;for(const u of n.relay??[])(c=u.contentWindow)==null||c.postMessage({type:ju,insets:r},"*")},a=c=>{var d,p;if(c.source!==e.parent||e.parent===e||!i.has((d=c.data)==null?void 0:d.type))return;const u=ag(c.data.insets);if(!u)return;const h=!og(u,r);r=u,h&&t&&Xu(t,r),s(),h&&((p=n.onChange)==null||p.call(n,r))};e.addEventListener("message",a);for(const c of n.relay??[])(l=c.addEventListener)==null||l.call(c,"load",s);return{get insets(){return r},dispose(){var c;e.removeEventListener("message",a);for(const u of n.relay??[])(c=u.removeEventListener)==null||c.call(u,"load",s)}}}function cg(n=globalThis.document,e="[data-hud]"){var r;const t=[],i=Array.from(n.querySelectorAll(e));for(let s=0;s<i.length&&t.length<Uf;s++){const a=i[s],o=a.getBoundingClientRect();if(!(o.width>0&&o.height>0))continue;const l=c=>Math.round(c*10)/10;t.push({id:String(((r=a.getAttribute)==null?void 0:r.call(a,"data-hud"))||a.id||`hud-${s}`).slice(0,64),x:l(o.left),y:l(o.top),width:l(o.width),height:l(o.height)})}return t}function ug(n){if(!Array.isArray(n))return[];const e=[];for(const t of n.slice(0,Uf)){if(!t||typeof t!="object")continue;const{id:i,x:r,y:s,width:a,height:o}=t;[r,s,a,o].every(l=>typeof l=="number"&&Number.isFinite(l))&&a>0&&o>0&&e.push({id:typeof i=="string"&&i?i.slice(0,64):`hud-${e.length}`,x:r,y:s,width:a,height:o})}return e}function hg(n,e={}){const t=e.window??globalThis,i=r=>{var a;if(r.source!==t.parent||t.parent===t||((a=r.data)==null?void 0:a.type)!==ng)return;const s=r.data.request;Promise.resolve().then(n).then(o=>ug(o==null?void 0:o.hud),()=>[]).then(o=>{var l;return r.source.postMessage({type:ig,request:s,hud:o,insets:((l=e.insets)==null?void 0:l.call(e))??Pf,width:t.innerWidth,height:t.innerHeight},"*")})};return t.addEventListener("message",i),()=>t.removeEventListener("message",i)}const Nf=64,dg=100,fi=n=>typeof n=="number"&&Number.isFinite(n),pi=n=>Math.round(n*100)/100;function fg(n,e,t){if(!e||!fi(e.x)||!fi(e.y)||!fi(e.z))return null;const i=[];for(const r of t){if(i.length>=Nf)break;typeof(r==null?void 0:r.id)!="string"||!r.id||!fi(r.x)||!fi(r.y)||!fi(r.z)||i.push({id:r.id,x:pi(r.x),y:pi(r.y),z:pi(r.z)})}return{type:`${n}:voice`,listener:{x:pi(e.x),y:pi(e.y),z:pi(e.z),h:fi(e.h)?pi(e.h):0},players:i}}function pg(n,e){return(e==null?void 0:e.type)!==`${n}:talking`||!Array.isArray(e.ids)?null:{ids:e.ids.filter(t=>typeof t=="string"&&t).slice(0,Nf+1).map(t=>t.slice(0,64)),self:e.self===!0}}function Ag(){return{post:n=>{window.parent!==window&&window.parent.postMessage(n,"*")},listen:n=>{const e=t=>{t.source===window.parent&&n(t.data)};return window.addEventListener("message",e),()=>window.removeEventListener("message",e)}}}function mg(n,e={}){const t=e.port??Ag(),i=e.now??(()=>performance.now()),r=new Set;let s=new Set,a=!1,o=-1/0,l=!1;const c=t.listen(u=>{const h=pg(n,u);if(!(!h||l)){s=new Set(h.ids),a=h.self;for(const d of[...r])d(h.ids.slice(),h.self)}});return{setPoses(u,h=[]){const d=i();if(l||d-o<dg)return!1;const p=fg(n,u,h);return p?(o=d,t.post(p),!0):!1},onTalking(u){return r.add(u),()=>{r.delete(u)}},isTalking:u=>s.has(u),get selfTalking(){return a},get talking(){return[...s]},dispose(){l=!0,r.clear(),s.clear(),a=!1,c()}}}const gg="avatar-picker",_g="avatar",qo=(n,e)=>typeof n=="string"&&n&&n.length<=e?n:"";function Eg(n,e){const t=qo(n==null?void 0:n.avatarUrl,2048);if(!t)return null;let i;try{i=new URL(t,e)}catch{return null}if(!/^https?:$/.test(i.protocol)||i.username||i.password)return null;const r=n.avatarScale;return{id:qo(n.avatarId,200)||i.href,name:qo(n.avatarName,120)||"Avatar",url:i.href,...typeof r=="number"&&r>0&&r<=4?{scale:r}:{}}}function vg(n={}){const e=n.window??window,t=n.prefix??xn,i=e.parent!==e,r=new Set;let s=null;const a=o=>{var c;if(o.source!==e.parent||o.origin!==e.location.origin||((c=o.data)==null?void 0:c.type)!==t+_g)return;const l=Eg(o.data,e.location.origin);if(l){s=l;for(const u of[...r])u(l)}};return i&&e.addEventListener("message",a),{available:i,get current(){return s},ask(){return i?(e.parent.postMessage({type:t+gg},e.location.origin),!0):!1},on(o){return r.add(o),()=>void r.delete(o)},dispose(){r.clear(),i&&e.removeEventListener("message",a)}}}const bg="oncyber:inspect",xg="oncyber:inspect-result";function yg(n,e=window){if(!new URLSearchParams(e.location.search).has("check")||e.parent===e)return()=>{};const t=i=>{var s;if(i.source!==e.parent||((s=i.data)==null?void 0:s.type)!==bg)return;let r;try{r=JSON.parse(JSON.stringify(n()))}catch(a){r={error:String((a==null?void 0:a.message)??a).slice(0,200)}}e.parent.postMessage({type:xg,nonce:i.data.nonce,inspect:r},"*")};return e.addEventListener("message",t),()=>e.removeEventListener("message",t)}const Mg={walkable:!0},Ig={sizes:[1,8],formats:[{id:"duel",label:"Head to head",sizes:[2]},{id:"round",label:"Everyone plays",sizes:[3,4,5,6,7,8]},{id:"solo",label:"Solo round",sizes:[1,2,3,4,5,6,7,8]}],solo:"solo",play:"duel",late:"A member who arrives while the party's round is on can join it in progress, starting from zero, or play a solo round.",dropped:"The round goes on without them and their score stays on the board, marked as left. If they were running the round, another member takes it over.",extra:"A round seats the whole party, up to eight, so nobody sits out. A member who would rather not join can play solo or walk the courtyard."},Sg={profile:"portable-v1",version:"1",platforms:["web"],entries:{web:"index.html",game:"src/game.js",scenario:"scenario.json"},capabilities:["audio","avatar","results","travel"],assets:[],input:{up:{keyboard:["KeyW","ArrowUp"],touch:"stick-up",gamepad:["left-stick-up","dpad-up"]},down:{keyboard:["KeyS","ArrowDown"],touch:"stick-down",gamepad:["left-stick-down","dpad-down"]},left:{keyboard:["KeyA","ArrowLeft"],touch:"stick-left",gamepad:["left-stick-left","dpad-left"]},right:{keyboard:["KeyD","ArrowRight"],touch:"stick-right",gamepad:["left-stick-right","dpad-right"]},interact:{keyboard:["KeyE","KeyJ"],touch:"button:Go",gamepad:"button-x"},jump:{keyboard:["Space"],touch:"button:Jump",gamepad:"button-a"},run:{keyboard:["ShiftLeft","ShiftRight"],touch:"button:Run",gamepad:["right-trigger","left-stick-press"]},back:{keyboard:["Backspace"],gamepad:"button-b"},lookX:{touch:"drag",gamepad:"right-stick-x"},lookY:{touch:"drag",gamepad:"right-stick-y"}}},un={arrival:Mg,party:Ig,runtime:Sg},Cg=1,wg={arrival:"lobby"},Tg=[{type:"waitUntil",key:"standing",equals:!0,maxFrames:180},{type:"assert",key:"booted",equals:!0},{type:"assert",key:"screen",equals:"arrival"},{type:"assert",key:"came",equals:"lobby"},{type:"assert",key:"hostArrival",equals:"lobby"},{type:"assert",key:"partySize",equals:1},{type:"assert",key:"options",equals:"solo"},{type:"action",action:"up"},{type:"wait",frames:45},{type:"action",action:"up",value:0},{type:"assert",key:"walked",equals:!0},{type:"assert",key:"screen",equals:"arrival"},{type:"action",action:"interact"},{type:"wait",frames:2},{type:"action",action:"interact",value:0},{type:"assert",key:"screen",equals:"menu"},{type:"action",action:"interact"},{type:"wait",frames:2},{type:"action",action:"interact",value:0},{type:"assert",key:"screen",equals:"match"},{type:"assert",key:"format",equals:"solo"},{type:"waitUntil",key:"lanternsLit",equals:!0,maxFrames:120},{type:"assert",key:"phase",equals:"playing"},{type:"assert",key:"score",equals:0},{type:"wait",frames:30},{type:"assert",key:"screen",equals:"match"}],Rg={version:Cg,enter:wg,steps:Tg};/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const ki="180",Bg=0,Yu=1,Lg=2,Ff=1,Dg=2,Vn=3,Yn=0,qt=1,tn=2,oi=0,Dr=1,no=2,Ku=3,Ju=4,Pg=5,Ci=100,Ug=101,Ng=102,Fg=103,Og=104,kg=200,Qg=201,Hg=202,Gg=203,oc=204,lc=205,Vg=206,zg=207,Wg=208,qg=209,jg=210,Xg=211,Yg=212,Kg=213,Jg=214,cc=0,uc=1,hc=2,Qr=3,dc=4,fc=5,pc=6,Ac=7,eu=0,Zg=1,$g=2,li=0,e_=1,t_=2,n_=3,i_=4,r_=5,s_=6,a_=7,Zu="attached",o_="detached",Of=300,Qi=301,Hr=302,mc=303,gc=304,Mo=306,Hi=1e3,Wn=1001,io=1002,Nt=1003,tu=1004,ws=1005,Ut=1006,qa=1007,vn=1008,We=1009,kf=1010,Qf=1011,ks=1012,nu=1013,Gi=1014,kt=1015,hn=1016,iu=1017,ru=1018,Qs=1020,Io=35902,So=35899,Hf=1021,Hs=1022,Pt=1023,Gs=1026,Vs=1027,ai=1028,su=1029,Li=1030,au=1031,ou=1033,Pr=33776,Ni=33777,Ur=33778,Ls=33779,ro=35840,_c=35841,Gr=35842,zs=35843,so=36196,Ws=37492,qs=37496,Fi=37808,Ec=37809,vc=37810,bc=37811,Nr=37812,xc=37813,yc=37814,Mc=37815,Ic=37816,Sc=37817,Cc=37818,wc=37819,Tc=37820,Rc=37821,Vr=36492,Bc=36494,ao=36495,oo=36283,lo=36284,co=36285,uo=36286,l_=2200,c_=2201,u_=2202,js=2300,Xs=2301,jo=2302,wr=2400,Tr=2401,ho=2402,lu=2500,h_=2501,d_=0,Gf=1,Lc=2,f_=3200,p_=3201,Co=0,A_=1,Rn="",Ct="srgb",Qt="srgb-linear",fo="linear",ht="srgb",nr=7680,$u=519,m_=512,g_=513,__=514,Vf=515,E_=516,v_=517,b_=518,x_=519,Dc=35044,y_=35048,eh="300 es",Bn=2e3,po=2001;class ji{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){const i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){const i=this._listeners;if(i===void 0)return;const r=i[e];if(r!==void 0){const s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const i=t[e.type];if(i!==void 0){e.target=this;const r=i.slice(0);for(let s=0,a=r.length;s<a;s++)r[s].call(this,e);e.target=null}}}const Ft=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let th=1234567;const Ds=Math.PI/180,zr=180/Math.PI;function bn(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ft[n&255]+Ft[n>>8&255]+Ft[n>>16&255]+Ft[n>>24&255]+"-"+Ft[e&255]+Ft[e>>8&255]+"-"+Ft[e>>16&15|64]+Ft[e>>24&255]+"-"+Ft[t&63|128]+Ft[t>>8&255]+"-"+Ft[t>>16&255]+Ft[t>>24&255]+Ft[i&255]+Ft[i>>8&255]+Ft[i>>16&255]+Ft[i>>24&255]).toLowerCase()}function je(n,e,t){return Math.max(e,Math.min(t,n))}function cu(n,e){return(n%e+e)%e}function M_(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)}function I_(n,e,t){return n!==e?(t-n)/(e-n):0}function Ps(n,e,t){return(1-t)*n+t*e}function S_(n,e,t,i){return Ps(n,e,1-Math.exp(-t*i))}function C_(n,e=1){return e-Math.abs(cu(n,e*2)-e)}function w_(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function T_(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function R_(n,e){return n+Math.floor(Math.random()*(e-n+1))}function B_(n,e){return n+Math.random()*(e-n)}function L_(n){return n*(.5-Math.random())}function D_(n){n!==void 0&&(th=n);let e=th+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function P_(n){return n*Ds}function U_(n){return n*zr}function N_(n){return(n&n-1)===0&&n!==0}function F_(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function O_(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function k_(n,e,t,i,r){const s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+i)/2),u=a((e+i)/2),h=s((e-i)/2),d=a((e-i)/2),p=s((i-e)/2),m=a((i-e)/2);switch(r){case"XYX":n.set(o*u,l*h,l*d,o*c);break;case"YZY":n.set(l*d,o*u,l*h,o*c);break;case"ZXZ":n.set(l*h,l*d,o*u,o*c);break;case"XZX":n.set(o*u,l*m,l*p,o*c);break;case"YXY":n.set(l*p,o*u,l*m,o*c);break;case"ZYZ":n.set(l*m,l*p,o*u,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function En(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function lt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const Mt={DEG2RAD:Ds,RAD2DEG:zr,generateUUID:bn,clamp:je,euclideanModulo:cu,mapLinear:M_,inverseLerp:I_,lerp:Ps,damp:S_,pingpong:C_,smoothstep:w_,smootherstep:T_,randInt:R_,randFloat:B_,randFloatSpread:L_,seededRandom:D_,degToRad:P_,radToDeg:U_,isPowerOfTwo:N_,ceilPowerOfTwo:F_,floorPowerOfTwo:O_,setQuaternionFromProperEuler:k_,normalize:lt,denormalize:En};class we{constructor(e=0,t=0){we.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*i-a*r+e.x,this.y=s*r+a*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class He{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,s,a,o){let l=i[r+0],c=i[r+1],u=i[r+2],h=i[r+3];const d=s[a+0],p=s[a+1],m=s[a+2],g=s[a+3];if(o===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(o===1){e[t+0]=d,e[t+1]=p,e[t+2]=m,e[t+3]=g;return}if(h!==g||l!==d||c!==p||u!==m){let A=1-o;const f=l*d+c*p+u*m+h*g,E=f>=0?1:-1,v=1-f*f;if(v>Number.EPSILON){const b=Math.sqrt(v),M=Math.atan2(b,f*E);A=Math.sin(A*M)/b,o=Math.sin(o*M)/b}const _=o*E;if(l=l*A+d*_,c=c*A+p*_,u=u*A+m*_,h=h*A+g*_,A===1-o){const b=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=b,c*=b,u*=b,h*=b}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,r,s,a){const o=i[r],l=i[r+1],c=i[r+2],u=i[r+3],h=s[a],d=s[a+1],p=s[a+2],m=s[a+3];return e[t]=o*m+u*h+l*p-c*d,e[t+1]=l*m+u*d+c*h-o*p,e[t+2]=c*m+u*p+o*d-l*h,e[t+3]=u*m-o*h-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,r=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(i/2),u=o(r/2),h=o(s/2),d=l(i/2),p=l(r/2),m=l(s/2);switch(a){case"XYZ":this._x=d*u*h+c*p*m,this._y=c*p*h-d*u*m,this._z=c*u*m+d*p*h,this._w=c*u*h-d*p*m;break;case"YXZ":this._x=d*u*h+c*p*m,this._y=c*p*h-d*u*m,this._z=c*u*m-d*p*h,this._w=c*u*h+d*p*m;break;case"ZXY":this._x=d*u*h-c*p*m,this._y=c*p*h+d*u*m,this._z=c*u*m+d*p*h,this._w=c*u*h-d*p*m;break;case"ZYX":this._x=d*u*h-c*p*m,this._y=c*p*h+d*u*m,this._z=c*u*m-d*p*h,this._w=c*u*h+d*p*m;break;case"YZX":this._x=d*u*h+c*p*m,this._y=c*p*h+d*u*m,this._z=c*u*m-d*p*h,this._w=c*u*h-d*p*m;break;case"XZY":this._x=d*u*h-c*p*m,this._y=c*p*h-d*u*m,this._z=c*u*m+d*p*h,this._w=c*u*h+d*p*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],r=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=i+o+h;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(u-l)*p,this._y=(s-c)*p,this._z=(a-r)*p}else if(i>o&&i>h){const p=2*Math.sqrt(1+i-o-h);this._w=(u-l)/p,this._x=.25*p,this._y=(r+a)/p,this._z=(s+c)/p}else if(o>h){const p=2*Math.sqrt(1+o-i-h);this._w=(s-c)/p,this._x=(r+a)/p,this._y=.25*p,this._z=(l+u)/p}else{const p=2*Math.sqrt(1+h-i-o);this._w=(a-r)/p,this._x=(s+c)/p,this._y=(l+u)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(je(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,r=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+a*o+r*c-s*l,this._y=r*u+a*l+s*o-i*c,this._z=s*u+a*c+i*l-r*o,this._w=a*u-i*o-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,r=this._y,s=this._z,a=this._w;let o=a*e._w+i*e._x+r*e._y+s*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=a,this._x=i,this._y=r,this._z=s,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-t;return this._w=p*a+t*this._w,this._x=p*i+t*this._x,this._y=p*r+t*this._y,this._z=p*s+t*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,o),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=a*h+this._w*d,this._x=i*h+this._x*d,this._y=r*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(e=0,t=0,i=0){R.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(nh.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(nh.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=e.elements,a=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*a,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*a,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*a,this}applyQuaternion(e){const t=this.x,i=this.y,r=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*r-o*i),u=2*(o*t-s*r),h=2*(s*i-a*t);return this.x=t+l*c+a*h-o*u,this.y=i+l*u+o*c-s*h,this.z=r+l*h+s*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,r=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=r*l-s*o,this.y=s*a-i*l,this.z=i*o-r*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Xo.copy(this).projectOnVector(e),this.sub(Xo)}reflect(e){return this.sub(Xo.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(je(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Xo=new R,nh=new He;class Le{constructor(e,t,i,r,s,a,o,l,c){Le.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c)}set(e,t,i,r,s,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=r,u[2]=o,u[3]=t,u[4]=s,u[5]=l,u[6]=i,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],u=i[4],h=i[7],d=i[2],p=i[5],m=i[8],g=r[0],A=r[3],f=r[6],E=r[1],v=r[4],_=r[7],b=r[2],M=r[5],S=r[8];return s[0]=a*g+o*E+l*b,s[3]=a*A+o*v+l*M,s[6]=a*f+o*_+l*S,s[1]=c*g+u*E+h*b,s[4]=c*A+u*v+h*M,s[7]=c*f+u*_+h*S,s[2]=d*g+p*E+m*b,s[5]=d*A+p*v+m*M,s[8]=d*f+p*_+m*S,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-i*s*u+i*o*l+r*s*c-r*a*l}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=u*a-o*c,d=o*l-u*s,p=c*s-a*l,m=t*h+i*d+r*p;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/m;return e[0]=h*g,e[1]=(r*c-u*i)*g,e[2]=(o*i-r*a)*g,e[3]=d*g,e[4]=(u*t-r*l)*g,e[5]=(r*s-o*t)*g,e[6]=p*g,e[7]=(i*l-c*t)*g,e[8]=(a*t-i*s)*g,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*a+c*o)+a+e,-r*c,r*l,-r*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Yo.makeScale(e,t)),this}rotate(e){return this.premultiply(Yo.makeRotation(-e)),this}translate(e,t){return this.premultiply(Yo.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Yo=new Le;function zf(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Ys(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function Q_(){const n=Ys("canvas");return n.style.display="block",n}const ih={};function Ks(n){n in ih||(ih[n]=!0,console.warn(n))}function H_(n,e,t){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:i()}}setTimeout(s,t)})}const rh=new Le().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),sh=new Le().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function G_(){const n={enabled:!0,workingColorSpace:Qt,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===ht&&(r.r=Xn(r.r),r.g=Xn(r.g),r.b=Xn(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ht&&(r.r=Fr(r.r),r.g=Fr(r.g),r.b=Fr(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Rn?fo:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ks("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ks("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[Qt]:{primaries:e,whitePoint:i,transfer:fo,toXYZ:rh,fromXYZ:sh,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ct},outputColorSpaceConfig:{drawingBufferColorSpace:Ct}},[Ct]:{primaries:e,whitePoint:i,transfer:ht,toXYZ:rh,fromXYZ:sh,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ct}}}),n}const Je=G_();function Xn(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Fr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let ir;class V_{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{ir===void 0&&(ir=Ys("canvas")),ir.width=e.width,ir.height=e.height;const r=ir.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=ir}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Ys("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let a=0;a<s.length;a++)s[a]=Xn(s[a]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Xn(t[i]/255)*255):t[i]=Xn(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let z_=0;class uu{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:z_++}),this.uuid=bn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let a=0,o=r.length;a<o;a++)r[a].isDataTexture?s.push(Ko(r[a].image)):s.push(Ko(r[a]))}else s=Ko(r);i.url=s}return t||(e.images[this.uuid]=i),i}}function Ko(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?V_.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let W_=0;const Jo=new R;class Tt extends ji{constructor(e=Tt.DEFAULT_IMAGE,t=Tt.DEFAULT_MAPPING,i=Wn,r=Wn,s=Ut,a=vn,o=Pt,l=We,c=Tt.DEFAULT_ANISOTROPY,u=Rn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:W_++}),this.uuid=bn(),this.name="",this.source=new uu(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new we(0,0),this.repeat=new we(1,1),this.center=new we(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Le,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Jo).x}get height(){return this.source.getSize(Jo).y}get depth(){return this.source.getSize(Jo).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Of)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Hi:e.x=e.x-Math.floor(e.x);break;case Wn:e.x=e.x<0?0:1;break;case io:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Hi:e.y=e.y-Math.floor(e.y);break;case Wn:e.y=e.y<0?0:1;break;case io:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Tt.DEFAULT_IMAGE=null;Tt.DEFAULT_MAPPING=Of;Tt.DEFAULT_ANISOTROPY=1;class nt{constructor(e=0,t=0,i=0,r=1){nt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*i+a[8]*r+a[12]*s,this.y=a[1]*t+a[5]*i+a[9]*r+a[13]*s,this.z=a[2]*t+a[6]*i+a[10]*r+a[14]*s,this.w=a[3]*t+a[7]*i+a[11]*r+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s;const l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],p=l[5],m=l[9],g=l[2],A=l[6],f=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-g)<.01&&Math.abs(m-A)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+g)<.1&&Math.abs(m+A)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const v=(c+1)/2,_=(p+1)/2,b=(f+1)/2,M=(u+d)/4,S=(h+g)/4,C=(m+A)/4;return v>_&&v>b?v<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(v),r=M/i,s=S/i):_>b?_<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(_),i=M/r,s=C/r):b<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(b),i=S/s,r=C/s),this.set(i,r,s,t),this}let E=Math.sqrt((A-m)*(A-m)+(h-g)*(h-g)+(d-u)*(d-u));return Math.abs(E)<.001&&(E=1),this.x=(A-m)/E,this.y=(h-g)/E,this.z=(d-u)/E,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=je(this.x,e.x,t.x),this.y=je(this.y,e.y,t.y),this.z=je(this.z,e.z,t.z),this.w=je(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=je(this.x,e,t),this.y=je(this.y,e,t),this.z=je(this.z,e,t),this.w=je(this.w,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(je(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class q_ extends ji{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ut,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new nt(0,0,e,t),this.scissorTest=!1,this.viewport=new nt(0,0,e,t);const r={width:e,height:t,depth:i.depth},s=new Tt(r);this.textures=[];const a=i.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview}_setTextureOptions(e={}){const t={minFilter:Ut,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i,this.textures[r].isArrayTexture=this.textures[r].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const r=Object.assign({},e.textures[t].image);this.textures[t].source=new uu(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Vi extends q_{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class Wf extends Tt{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class qf extends Tt{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=Wn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class yn{constructor(e=new R(1/0,1/0,1/0),t=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(An.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(An.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=An.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const s=i.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,An):An.fromBufferAttribute(s,a),An.applyMatrix4(e.matrixWorld),this.expandByPoint(An);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),sa.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),sa.copy(i.boundingBox)),sa.applyMatrix4(e.matrixWorld),this.union(sa)}const r=e.children;for(let s=0,a=r.length;s<a;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,An),An.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rs),aa.subVectors(this.max,rs),rr.subVectors(e.a,rs),sr.subVectors(e.b,rs),ar.subVectors(e.c,rs),Jn.subVectors(sr,rr),Zn.subVectors(ar,sr),Ai.subVectors(rr,ar);let t=[0,-Jn.z,Jn.y,0,-Zn.z,Zn.y,0,-Ai.z,Ai.y,Jn.z,0,-Jn.x,Zn.z,0,-Zn.x,Ai.z,0,-Ai.x,-Jn.y,Jn.x,0,-Zn.y,Zn.x,0,-Ai.y,Ai.x,0];return!Zo(t,rr,sr,ar,aa)||(t=[1,0,0,0,1,0,0,0,1],!Zo(t,rr,sr,ar,aa))?!1:(oa.crossVectors(Jn,Zn),t=[oa.x,oa.y,oa.z],Zo(t,rr,sr,ar,aa))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,An).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(An).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Nn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Nn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Nn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Nn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Nn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Nn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Nn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Nn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Nn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Nn=[new R,new R,new R,new R,new R,new R,new R,new R],An=new R,sa=new yn,rr=new R,sr=new R,ar=new R,Jn=new R,Zn=new R,Ai=new R,rs=new R,aa=new R,oa=new R,mi=new R;function Zo(n,e,t,i,r){for(let s=0,a=n.length-3;s<=a;s+=3){mi.fromArray(n,s);const o=r.x*Math.abs(mi.x)+r.y*Math.abs(mi.y)+r.z*Math.abs(mi.z),l=e.dot(mi),c=t.dot(mi),u=i.dot(mi);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const j_=new yn,ss=new R,$o=new R;class Dn{constructor(e=new R,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):j_.setFromPoints(e).getCenter(i);let r=0;for(let s=0,a=e.length;s<a;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;ss.subVectors(e,this.center);const t=ss.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(ss,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):($o.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(ss.copy(e.center).add($o)),this.expandByPoint(ss.copy(e.center).sub($o))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const Fn=new R,el=new R,la=new R,$n=new R,tl=new R,ca=new R,nl=new R;class wo{constructor(e=new R,t=new R(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Fn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Fn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Fn.copy(this.origin).addScaledVector(this.direction,t),Fn.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){el.copy(e).add(t).multiplyScalar(.5),la.copy(t).sub(e).normalize(),$n.copy(this.origin).sub(el);const s=e.distanceTo(t)*.5,a=-this.direction.dot(la),o=$n.dot(this.direction),l=-$n.dot(la),c=$n.lengthSq(),u=Math.abs(1-a*a);let h,d,p,m;if(u>0)if(h=a*l-o,d=a*o-l,m=s*u,h>=0)if(d>=-m)if(d<=m){const g=1/u;h*=g,d*=g,p=h*(h+a*d+2*o)+d*(a*h+d+2*l)+c}else d=s,h=Math.max(0,-(a*d+o)),p=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(a*d+o)),p=-h*h+d*(d+2*l)+c;else d<=-m?(h=Math.max(0,-(-a*s+o)),d=h>0?-s:Math.min(Math.max(-s,-l),s),p=-h*h+d*(d+2*l)+c):d<=m?(h=0,d=Math.min(Math.max(-s,-l),s),p=d*(d+2*l)+c):(h=Math.max(0,-(a*s+o)),d=h>0?s:Math.min(Math.max(-s,-l),s),p=-h*h+d*(d+2*l)+c);else d=a>0?-s:s,h=Math.max(0,-(a*d+o)),p=-h*h+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,h),r&&r.copy(el).addScaledVector(la,d),p}intersectSphere(e,t){Fn.subVectors(e.center,this.origin);const i=Fn.dot(this.direction),r=Fn.dot(Fn)-i*i,s=e.radius*e.radius;if(r>s)return null;const a=Math.sqrt(s-r),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),u>=0?(s=(e.min.y-d.y)*u,a=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,a=(e.min.y-d.y)*u),i>a||s>r||((s>i||isNaN(i))&&(i=s),(a<r||isNaN(r))&&(r=a),h>=0?(o=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(o=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),i>l||o>r)||((o>i||i!==i)&&(i=o),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Fn)!==null}intersectTriangle(e,t,i,r,s){tl.subVectors(t,e),ca.subVectors(i,e),nl.crossVectors(tl,ca);let a=this.direction.dot(nl),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;$n.subVectors(this.origin,e);const l=o*this.direction.dot(ca.crossVectors($n,ca));if(l<0)return null;const c=o*this.direction.dot(tl.cross($n));if(c<0||l+c>a)return null;const u=-o*$n.dot(nl);return u<0?null:this.at(u/a,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class De{constructor(e,t,i,r,s,a,o,l,c,u,h,d,p,m,g,A){De.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,s,a,o,l,c,u,h,d,p,m,g,A)}set(e,t,i,r,s,a,o,l,c,u,h,d,p,m,g,A){const f=this.elements;return f[0]=e,f[4]=t,f[8]=i,f[12]=r,f[1]=s,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=u,f[10]=h,f[14]=d,f[3]=p,f[7]=m,f[11]=g,f[15]=A,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new De().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,r=1/or.setFromMatrixColumn(e,0).length(),s=1/or.setFromMatrixColumn(e,1).length(),a=1/or.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*a,t[9]=i[9]*a,t[10]=i[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,r=e.y,s=e.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const d=a*u,p=a*h,m=o*u,g=o*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=p+m*c,t[5]=d-g*c,t[9]=-o*l,t[2]=g-d*c,t[6]=m+p*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*u,p=l*h,m=c*u,g=c*h;t[0]=d+g*o,t[4]=m*o-p,t[8]=a*c,t[1]=a*h,t[5]=a*u,t[9]=-o,t[2]=p*o-m,t[6]=g+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*u,p=l*h,m=c*u,g=c*h;t[0]=d-g*o,t[4]=-a*h,t[8]=m+p*o,t[1]=p+m*o,t[5]=a*u,t[9]=g-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*u,p=a*h,m=o*u,g=o*h;t[0]=l*u,t[4]=m*c-p,t[8]=d*c+g,t[1]=l*h,t[5]=g*c+d,t[9]=p*c-m,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,p=a*c,m=o*l,g=o*c;t[0]=l*u,t[4]=g-d*h,t[8]=m*h+p,t[1]=h,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=p*h+m,t[10]=d-g*h}else if(e.order==="XZY"){const d=a*l,p=a*c,m=o*l,g=o*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+g,t[5]=a*u,t[9]=p*h-m,t[2]=m*h-p,t[6]=o*u,t[10]=g*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(X_,e,Y_)}lookAt(e,t,i){const r=this.elements;return $t.subVectors(e,t),$t.lengthSq()===0&&($t.z=1),$t.normalize(),ei.crossVectors(i,$t),ei.lengthSq()===0&&(Math.abs(i.z)===1?$t.x+=1e-4:$t.z+=1e-4,$t.normalize(),ei.crossVectors(i,$t)),ei.normalize(),ua.crossVectors($t,ei),r[0]=ei.x,r[4]=ua.x,r[8]=$t.x,r[1]=ei.y,r[5]=ua.y,r[9]=$t.y,r[2]=ei.z,r[6]=ua.z,r[10]=$t.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],u=i[1],h=i[5],d=i[9],p=i[13],m=i[2],g=i[6],A=i[10],f=i[14],E=i[3],v=i[7],_=i[11],b=i[15],M=r[0],S=r[4],C=r[8],I=r[12],y=r[1],T=r[5],N=r[9],D=r[13],P=r[2],k=r[6],F=r[10],G=r[14],H=r[3],ee=r[7],Z=r[11],se=r[15];return s[0]=a*M+o*y+l*P+c*H,s[4]=a*S+o*T+l*k+c*ee,s[8]=a*C+o*N+l*F+c*Z,s[12]=a*I+o*D+l*G+c*se,s[1]=u*M+h*y+d*P+p*H,s[5]=u*S+h*T+d*k+p*ee,s[9]=u*C+h*N+d*F+p*Z,s[13]=u*I+h*D+d*G+p*se,s[2]=m*M+g*y+A*P+f*H,s[6]=m*S+g*T+A*k+f*ee,s[10]=m*C+g*N+A*F+f*Z,s[14]=m*I+g*D+A*G+f*se,s[3]=E*M+v*y+_*P+b*H,s[7]=E*S+v*T+_*k+b*ee,s[11]=E*C+v*N+_*F+b*Z,s[15]=E*I+v*D+_*G+b*se,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],p=e[14],m=e[3],g=e[7],A=e[11],f=e[15];return m*(+s*l*h-r*c*h-s*o*d+i*c*d+r*o*p-i*l*p)+g*(+t*l*p-t*c*d+s*a*d-r*a*p+r*c*u-s*l*u)+A*(+t*c*h-t*o*p-s*a*h+i*a*p+s*o*u-i*c*u)+f*(-r*o*u-t*l*h+t*o*d+r*a*h-i*a*d+i*l*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],p=e[11],m=e[12],g=e[13],A=e[14],f=e[15],E=h*A*c-g*d*c+g*l*p-o*A*p-h*l*f+o*d*f,v=m*d*c-u*A*c-m*l*p+a*A*p+u*l*f-a*d*f,_=u*g*c-m*h*c+m*o*p-a*g*p-u*o*f+a*h*f,b=m*h*l-u*g*l-m*o*d+a*g*d+u*o*A-a*h*A,M=t*E+i*v+r*_+s*b;if(M===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const S=1/M;return e[0]=E*S,e[1]=(g*d*s-h*A*s-g*r*p+i*A*p+h*r*f-i*d*f)*S,e[2]=(o*A*s-g*l*s+g*r*c-i*A*c-o*r*f+i*l*f)*S,e[3]=(h*l*s-o*d*s-h*r*c+i*d*c+o*r*p-i*l*p)*S,e[4]=v*S,e[5]=(u*A*s-m*d*s+m*r*p-t*A*p-u*r*f+t*d*f)*S,e[6]=(m*l*s-a*A*s-m*r*c+t*A*c+a*r*f-t*l*f)*S,e[7]=(a*d*s-u*l*s+u*r*c-t*d*c-a*r*p+t*l*p)*S,e[8]=_*S,e[9]=(m*h*s-u*g*s-m*i*p+t*g*p+u*i*f-t*h*f)*S,e[10]=(a*g*s-m*o*s+m*i*c-t*g*c-a*i*f+t*o*f)*S,e[11]=(u*o*s-a*h*s-u*i*c+t*h*c+a*i*p-t*o*p)*S,e[12]=b*S,e[13]=(u*g*r-m*h*r+m*i*d-t*g*d-u*i*A+t*h*A)*S,e[14]=(m*o*r-a*g*r-m*i*l+t*g*l+a*i*A-t*o*A)*S,e[15]=(a*h*r-u*o*r+u*i*l-t*h*l-a*i*d+t*o*d)*S,this}scale(e){const t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),r=Math.sin(t),s=1-i,a=e.x,o=e.y,l=e.z,c=s*a,u=s*o;return this.set(c*a+i,c*o-r*l,c*l+r*o,0,c*o+r*l,u*o+i,u*l-r*a,0,c*l-r*o,u*l+r*a,s*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,s,a){return this.set(1,i,s,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){const r=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,u=a+a,h=o+o,d=s*c,p=s*u,m=s*h,g=a*u,A=a*h,f=o*h,E=l*c,v=l*u,_=l*h,b=i.x,M=i.y,S=i.z;return r[0]=(1-(g+f))*b,r[1]=(p+_)*b,r[2]=(m-v)*b,r[3]=0,r[4]=(p-_)*M,r[5]=(1-(d+f))*M,r[6]=(A+E)*M,r[7]=0,r[8]=(m+v)*S,r[9]=(A-E)*S,r[10]=(1-(d+g))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){const r=this.elements;let s=or.set(r[0],r[1],r[2]).length();const a=or.set(r[4],r[5],r[6]).length(),o=or.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],mn.copy(this);const c=1/s,u=1/a,h=1/o;return mn.elements[0]*=c,mn.elements[1]*=c,mn.elements[2]*=c,mn.elements[4]*=u,mn.elements[5]*=u,mn.elements[6]*=u,mn.elements[8]*=h,mn.elements[9]*=h,mn.elements[10]*=h,t.setFromRotationMatrix(mn),i.x=s,i.y=a,i.z=o,this}makePerspective(e,t,i,r,s,a,o=Bn,l=!1){const c=this.elements,u=2*s/(t-e),h=2*s/(i-r),d=(t+e)/(t-e),p=(i+r)/(i-r);let m,g;if(l)m=s/(a-s),g=a*s/(a-s);else if(o===Bn)m=-(a+s)/(a-s),g=-2*a*s/(a-s);else if(o===po)m=-a/(a-s),g=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=g,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,s,a,o=Bn,l=!1){const c=this.elements,u=2/(t-e),h=2/(i-r),d=-(t+e)/(t-e),p=-(i+r)/(i-r);let m,g;if(l)m=1/(a-s),g=a/(a-s);else if(o===Bn)m=-2/(a-s),g=-(a+s)/(a-s);else if(o===po)m=-1/(a-s),g=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=h,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=m,c[14]=g,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}const or=new R,mn=new De,X_=new R(0,0,0),Y_=new R(1,1,1),ei=new R,ua=new R,$t=new R,ah=new De,oh=new He;class jt{constructor(e=0,t=0,i=0,r=jt.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const r=e.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],u=r[9],h=r[2],d=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(je(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,p),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-je(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,s),this._z=0);break;case"ZXY":this._x=Math.asin(je(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-je(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(je(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,s)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-je(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-u,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return ah.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ah,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return oh.setFromEuler(this),this.setFromQuaternion(oh,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}jt.DEFAULT_ORDER="XYZ";class jf{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let K_=0;const lh=new R,lr=new He,On=new De,ha=new R,as=new R,J_=new R,Z_=new He,ch=new R(1,0,0),uh=new R(0,1,0),hh=new R(0,0,1),dh={type:"added"},$_={type:"removed"},cr={type:"childadded",child:null},il={type:"childremoved",child:null};class ct extends ji{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:K_++}),this.uuid=bn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ct.DEFAULT_UP.clone();const e=new R,t=new jt,i=new He,r=new R(1,1,1);function s(){i.setFromEuler(t,!1)}function a(){t.setFromQuaternion(i,void 0,!1)}t._onChange(s),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new De},normalMatrix:{value:new Le}}),this.matrix=new De,this.matrixWorld=new De,this.matrixAutoUpdate=ct.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new jf,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return lr.setFromAxisAngle(e,t),this.quaternion.multiply(lr),this}rotateOnWorldAxis(e,t){return lr.setFromAxisAngle(e,t),this.quaternion.premultiply(lr),this}rotateX(e){return this.rotateOnAxis(ch,e)}rotateY(e){return this.rotateOnAxis(uh,e)}rotateZ(e){return this.rotateOnAxis(hh,e)}translateOnAxis(e,t){return lh.copy(e).applyQuaternion(this.quaternion),this.position.add(lh.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ch,e)}translateY(e){return this.translateOnAxis(uh,e)}translateZ(e){return this.translateOnAxis(hh,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(On.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?ha.copy(e):ha.set(e,t,i);const r=this.parent;this.updateWorldMatrix(!0,!1),as.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?On.lookAt(as,ha,this.up):On.lookAt(ha,as,this.up),this.quaternion.setFromRotationMatrix(On),r&&(On.extractRotation(r.matrixWorld),lr.setFromRotationMatrix(On),this.quaternion.premultiply(lr.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(dh),cr.child=e,this.dispatchEvent(cr),cr.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent($_),il.child=e,this.dispatchEvent(il),il.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),On.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),On.multiply(e.parent.matrixWorld)),e.applyMatrix4(On),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(dh),cr.child=e,this.dispatchEvent(cr),cr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){const a=this.children[i].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(as,e,J_),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(as,Z_,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){const i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];s(e.shapes,h)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];r.animations.push(s(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),h=a(e.shapes),d=a(e.skeletons),p=a(e.animations),m=a(e.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),h.length>0&&(i.shapes=h),d.length>0&&(i.skeletons=d),p.length>0&&(i.animations=p),m.length>0&&(i.nodes=m)}return i.object=r,i;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const r=e.children[i];this.add(r.clone())}return this}}ct.DEFAULT_UP=new R(0,1,0);ct.DEFAULT_MATRIX_AUTO_UPDATE=!0;ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const gn=new R,kn=new R,rl=new R,Qn=new R,ur=new R,hr=new R,fh=new R,sl=new R,al=new R,ol=new R,ll=new nt,cl=new nt,ul=new nt;class dn{constructor(e=new R,t=new R,i=new R){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),gn.subVectors(e,t),r.cross(gn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){gn.subVectors(r,t),kn.subVectors(i,t),rl.subVectors(e,t);const a=gn.dot(gn),o=gn.dot(kn),l=gn.dot(rl),c=kn.dot(kn),u=kn.dot(rl),h=a*c-o*o;if(h===0)return s.set(0,0,0),null;const d=1/h,p=(c*l-o*u)*d,m=(a*u-o*l)*d;return s.set(1-p-m,m,p)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Qn)===null?!1:Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(e,t,i,r,s,a,o,l){return this.getBarycoord(e,t,i,r,Qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Qn.x),l.addScaledVector(a,Qn.y),l.addScaledVector(o,Qn.z),l)}static getInterpolatedAttribute(e,t,i,r,s,a){return ll.setScalar(0),cl.setScalar(0),ul.setScalar(0),ll.fromBufferAttribute(e,t),cl.fromBufferAttribute(e,i),ul.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(ll,s.x),a.addScaledVector(cl,s.y),a.addScaledVector(ul,s.z),a}static isFrontFacing(e,t,i,r){return gn.subVectors(i,t),kn.subVectors(e,t),gn.cross(kn).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return gn.subVectors(this.c,this.b),kn.subVectors(this.a,this.b),gn.cross(kn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return dn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return dn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,s){return dn.getInterpolation(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return dn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return dn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,r=this.b,s=this.c;let a,o;ur.subVectors(r,i),hr.subVectors(s,i),sl.subVectors(e,i);const l=ur.dot(sl),c=hr.dot(sl);if(l<=0&&c<=0)return t.copy(i);al.subVectors(e,r);const u=ur.dot(al),h=hr.dot(al);if(u>=0&&h<=u)return t.copy(r);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(i).addScaledVector(ur,a);ol.subVectors(e,s);const p=ur.dot(ol),m=hr.dot(ol);if(m>=0&&p<=m)return t.copy(s);const g=p*c-l*m;if(g<=0&&c>=0&&m<=0)return o=c/(c-m),t.copy(i).addScaledVector(hr,o);const A=u*m-p*h;if(A<=0&&h-u>=0&&p-m>=0)return fh.subVectors(s,r),o=(h-u)/(h-u+(p-m)),t.copy(r).addScaledVector(fh,o);const f=1/(A+g+d);return a=g*f,o=d*f,t.copy(i).addScaledVector(ur,a).addScaledVector(hr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Xf={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ti={h:0,s:0,l:0},da={h:0,s:0,l:0};function hl(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class be{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ct){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Je.colorSpaceToWorking(this,t),this}setRGB(e,t,i,r=Je.workingColorSpace){return this.r=e,this.g=t,this.b=i,Je.colorSpaceToWorking(this,r),this}setHSL(e,t,i,r=Je.workingColorSpace){if(e=cu(e,1),t=je(t,0,1),i=je(i,0,1),t===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+t):i+t-i*t,a=2*i-s;this.r=hl(a,s,e+1/3),this.g=hl(a,s,e),this.b=hl(a,s,e-1/3)}return Je.colorSpaceToWorking(this,r),this}setStyle(e,t=Ct){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const a=r[1],o=r[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ct){const i=Xf[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Xn(e.r),this.g=Xn(e.g),this.b=Xn(e.b),this}copyLinearToSRGB(e){return this.r=Fr(e.r),this.g=Fr(e.g),this.b=Fr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ct){return Je.workingToColorSpace(Ot.copy(this),e),Math.round(je(Ot.r*255,0,255))*65536+Math.round(je(Ot.g*255,0,255))*256+Math.round(je(Ot.b*255,0,255))}getHexString(e=Ct){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Je.workingColorSpace){Je.workingToColorSpace(Ot.copy(this),t);const i=Ot.r,r=Ot.g,s=Ot.b,a=Math.max(i,r,s),o=Math.min(i,r,s);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=u<=.5?h/(a+o):h/(2-a-o),a){case i:l=(r-s)/h+(r<s?6:0);break;case r:l=(s-i)/h+2;break;case s:l=(i-r)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=Je.workingColorSpace){return Je.workingToColorSpace(Ot.copy(this),t),e.r=Ot.r,e.g=Ot.g,e.b=Ot.b,e}getStyle(e=Ct){Je.workingToColorSpace(Ot.copy(this),e);const t=Ot.r,i=Ot.g,r=Ot.b;return e!==Ct?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(ti),this.setHSL(ti.h+e,ti.s+t,ti.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(ti),e.getHSL(da);const i=Ps(ti.h,da.h,t),r=Ps(ti.s,da.s,t),s=Ps(ti.l,da.l,t);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*i+s[6]*r,this.g=s[1]*t+s[4]*i+s[7]*r,this.b=s[2]*t+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ot=new be;be.NAMES=Xf;let eE=0;class nn extends ji{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:eE++}),this.uuid=bn(),this.name="",this.type="Material",this.blending=Dr,this.side=Yn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=oc,this.blendDst=lc,this.blendEquation=Ci,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new be(0,0,0),this.blendAlpha=0,this.depthFunc=Qr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=$u,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=nr,this.stencilZFail=nr,this.stencilZPass=nr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Dr&&(i.blending=this.blending),this.side!==Yn&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==oc&&(i.blendSrc=this.blendSrc),this.blendDst!==lc&&(i.blendDst=this.blendDst),this.blendEquation!==Ci&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Qr&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==$u&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==nr&&(i.stencilFail=this.stencilFail),this.stencilZFail!==nr&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==nr&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(t){const s=r(e.textures),a=r(e.images);s.length>0&&(i.textures=s),a.length>0&&(i.images=a)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const r=t.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=t[s].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class Kt extends nn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.combine=eu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const wt=new R,fa=new we;let tE=0;class tt{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:tE++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Dc,this.updateRanges=[],this.gpuType=kt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)fa.fromBufferAttribute(this,t),fa.applyMatrix3(e),this.setXY(t,fa.x,fa.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix3(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix4(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.applyNormalMatrix(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)wt.fromBufferAttribute(this,t),wt.transformDirection(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=En(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=lt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=En(t,this.array)),t}setX(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=En(t,this.array)),t}setY(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=En(t,this.array)),t}setZ(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=En(t,this.array)),t}setW(e,t){return this.normalized&&(t=lt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e*=this.itemSize,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array),s=lt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Dc&&(e.usage=this.usage),e}}class Yf extends tt{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class Kf extends tt{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class st extends tt{constructor(e,t,i){super(new Float32Array(e),t,i)}}let nE=0;const on=new De,dl=new ct,dr=new R,en=new yn,os=new yn,Dt=new R;class dt extends ji{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:nE++}),this.uuid=bn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(zf(e)?Kf:Yf)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new Le().getNormalMatrix(e);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return on.makeRotationFromQuaternion(e),this.applyMatrix4(on),this}rotateX(e){return on.makeRotationX(e),this.applyMatrix4(on),this}rotateY(e){return on.makeRotationY(e),this.applyMatrix4(on),this}rotateZ(e){return on.makeRotationZ(e),this.applyMatrix4(on),this}translate(e,t,i){return on.makeTranslation(e,t,i),this.applyMatrix4(on),this}scale(e,t,i){return on.makeScale(e,t,i),this.applyMatrix4(on),this}lookAt(e){return dl.lookAt(e),dl.updateMatrix(),this.applyMatrix4(dl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(dr).negate(),this.translate(dr.x,dr.y,dr.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const i=[];for(let r=0,s=e.length;r<s;r++){const a=e[r];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new st(i,3))}else{const i=Math.min(e.length,t.count);for(let r=0;r<i;r++){const s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new yn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){const s=t[i];en.setFromBufferAttribute(s),this.morphTargetsRelative?(Dt.addVectors(this.boundingBox.min,en.min),this.boundingBox.expandByPoint(Dt),Dt.addVectors(this.boundingBox.max,en.max),this.boundingBox.expandByPoint(Dt)):(this.boundingBox.expandByPoint(en.min),this.boundingBox.expandByPoint(en.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Dn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(e){const i=this.boundingSphere.center;if(en.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){const o=t[s];os.setFromBufferAttribute(o),this.morphTargetsRelative?(Dt.addVectors(en.min,os.min),en.expandByPoint(Dt),Dt.addVectors(en.max,os.max),en.expandByPoint(Dt)):(en.expandByPoint(os.min),en.expandByPoint(os.max))}en.getCenter(i);let r=0;for(let s=0,a=e.count;s<a;s++)Dt.fromBufferAttribute(e,s),r=Math.max(r,i.distanceToSquared(Dt));if(t)for(let s=0,a=t.length;s<a;s++){const o=t[s],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)Dt.fromBufferAttribute(o,c),l&&(dr.fromBufferAttribute(e,c),Dt.add(dr)),r=Math.max(r,i.distanceToSquared(Dt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,r=t.normal,s=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new tt(new Float32Array(4*i.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let C=0;C<i.count;C++)o[C]=new R,l[C]=new R;const c=new R,u=new R,h=new R,d=new we,p=new we,m=new we,g=new R,A=new R;function f(C,I,y){c.fromBufferAttribute(i,C),u.fromBufferAttribute(i,I),h.fromBufferAttribute(i,y),d.fromBufferAttribute(s,C),p.fromBufferAttribute(s,I),m.fromBufferAttribute(s,y),u.sub(c),h.sub(c),p.sub(d),m.sub(d);const T=1/(p.x*m.y-m.x*p.y);isFinite(T)&&(g.copy(u).multiplyScalar(m.y).addScaledVector(h,-p.y).multiplyScalar(T),A.copy(h).multiplyScalar(p.x).addScaledVector(u,-m.x).multiplyScalar(T),o[C].add(g),o[I].add(g),o[y].add(g),l[C].add(A),l[I].add(A),l[y].add(A))}let E=this.groups;E.length===0&&(E=[{start:0,count:e.count}]);for(let C=0,I=E.length;C<I;++C){const y=E[C],T=y.start,N=y.count;for(let D=T,P=T+N;D<P;D+=3)f(e.getX(D+0),e.getX(D+1),e.getX(D+2))}const v=new R,_=new R,b=new R,M=new R;function S(C){b.fromBufferAttribute(r,C),M.copy(b);const I=o[C];v.copy(I),v.sub(b.multiplyScalar(b.dot(I))).normalize(),_.crossVectors(M,I);const T=_.dot(l[C])<0?-1:1;a.setXYZW(C,v.x,v.y,v.z,T)}for(let C=0,I=E.length;C<I;++C){const y=E[C],T=y.start,N=y.count;for(let D=T,P=T+N;D<P;D+=3)S(e.getX(D+0)),S(e.getX(D+1)),S(e.getX(D+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new tt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,p=i.count;d<p;d++)i.setXYZ(d,0,0,0);const r=new R,s=new R,a=new R,o=new R,l=new R,c=new R,u=new R,h=new R;if(e)for(let d=0,p=e.count;d<p;d+=3){const m=e.getX(d+0),g=e.getX(d+1),A=e.getX(d+2);r.fromBufferAttribute(t,m),s.fromBufferAttribute(t,g),a.fromBufferAttribute(t,A),u.subVectors(a,s),h.subVectors(r,s),u.cross(h),o.fromBufferAttribute(i,m),l.fromBufferAttribute(i,g),c.fromBufferAttribute(i,A),o.add(u),l.add(u),c.add(u),i.setXYZ(m,o.x,o.y,o.z),i.setXYZ(g,l.x,l.y,l.z),i.setXYZ(A,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)r.fromBufferAttribute(t,d+0),s.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),u.subVectors(a,s),h.subVectors(r,s),u.cross(h),i.setXYZ(d+0,u.x,u.y,u.z),i.setXYZ(d+1,u.x,u.y,u.z),i.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Dt.fromBufferAttribute(e,t),Dt.normalize(),e.setXYZ(t,Dt.x,Dt.y,Dt.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,h=o.normalized,d=new c.constructor(l.length*u);let p=0,m=0;for(let g=0,A=l.length;g<A;g++){o.isInterleavedBufferAttribute?p=l[g]*o.data.stride+o.offset:p=l[g]*u;for(let f=0;f<u;f++)d[m++]=c[p++]}return new tt(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new dt,i=this.index.array,r=this.attributes;for(const o in r){const l=r[o],c=e(l,i);t.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let u=0,h=c.length;u<h;u++){const d=c[u],p=e(d,i);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){const p=c[h];u.push(p.toJSON(e.data))}u.length>0&&(r[l]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone());const r=e.attributes;for(const c in r){const u=r[c];this.setAttribute(c,u.clone(t))}const s=e.morphAttributes;for(const c in s){const u=[],h=s[c];for(let d=0,p=h.length;d<p;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const ph=new De,gi=new wo,pa=new Dn,Ah=new R,Aa=new R,ma=new R,ga=new R,fl=new R,_a=new R,mh=new R,Ea=new R;class Ke extends ct{constructor(e=new dt,t=new Kt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,a=i.morphTargetsRelative;t.fromBufferAttribute(r,e);const o=this.morphTargetInfluences;if(s&&o){_a.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const u=o[l],h=s[l];u!==0&&(fl.fromBufferAttribute(h,e),a?_a.addScaledVector(fl,u):_a.addScaledVector(fl.sub(t),u))}t.add(_a)}return t}raycast(e,t){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),pa.copy(i.boundingSphere),pa.applyMatrix4(s),gi.copy(e.ray).recast(e.near),!(pa.containsPoint(gi.origin)===!1&&(gi.intersectSphere(pa,Ah)===null||gi.origin.distanceToSquared(Ah)>(e.far-e.near)**2))&&(ph.copy(s).invert(),gi.copy(e.ray).applyMatrix4(ph),!(i.boundingBox!==null&&gi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,gi)))}_computeIntersections(e,t,i){let r;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,h=s.attributes.normal,d=s.groups,p=s.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,g=d.length;m<g;m++){const A=d[m],f=a[A.materialIndex],E=Math.max(A.start,p.start),v=Math.min(o.count,Math.min(A.start+A.count,p.start+p.count));for(let _=E,b=v;_<b;_+=3){const M=o.getX(_),S=o.getX(_+1),C=o.getX(_+2);r=va(this,f,e,i,c,u,h,M,S,C),r&&(r.faceIndex=Math.floor(_/3),r.face.materialIndex=A.materialIndex,t.push(r))}}else{const m=Math.max(0,p.start),g=Math.min(o.count,p.start+p.count);for(let A=m,f=g;A<f;A+=3){const E=o.getX(A),v=o.getX(A+1),_=o.getX(A+2);r=va(this,a,e,i,c,u,h,E,v,_),r&&(r.faceIndex=Math.floor(A/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(a))for(let m=0,g=d.length;m<g;m++){const A=d[m],f=a[A.materialIndex],E=Math.max(A.start,p.start),v=Math.min(l.count,Math.min(A.start+A.count,p.start+p.count));for(let _=E,b=v;_<b;_+=3){const M=_,S=_+1,C=_+2;r=va(this,f,e,i,c,u,h,M,S,C),r&&(r.faceIndex=Math.floor(_/3),r.face.materialIndex=A.materialIndex,t.push(r))}}else{const m=Math.max(0,p.start),g=Math.min(l.count,p.start+p.count);for(let A=m,f=g;A<f;A+=3){const E=A,v=A+1,_=A+2;r=va(this,a,e,i,c,u,h,E,v,_),r&&(r.faceIndex=Math.floor(A/3),t.push(r))}}}}function iE(n,e,t,i,r,s,a,o){let l;if(e.side===qt?l=i.intersectTriangle(a,s,r,!0,o):l=i.intersectTriangle(r,s,a,e.side===Yn,o),l===null)return null;Ea.copy(o),Ea.applyMatrix4(n.matrixWorld);const c=t.ray.origin.distanceTo(Ea);return c<t.near||c>t.far?null:{distance:c,point:Ea.clone(),object:n}}function va(n,e,t,i,r,s,a,o,l,c){n.getVertexPosition(o,Aa),n.getVertexPosition(l,ma),n.getVertexPosition(c,ga);const u=iE(n,e,t,i,Aa,ma,ga,mh);if(u){const h=new R;dn.getBarycoord(mh,Aa,ma,ga,h),r&&(u.uv=dn.getInterpolatedAttribute(r,o,l,c,h,new we)),s&&(u.uv1=dn.getInterpolatedAttribute(s,o,l,c,h,new we)),a&&(u.normal=dn.getInterpolatedAttribute(a,o,l,c,h,new R),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new R,materialIndex:0};dn.getNormal(Aa,ma,ga,d.normal),u.face=d,u.barycoord=h}return u}class qn extends dt{constructor(e=1,t=1,i=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:a};const o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],u=[],h=[];let d=0,p=0;m("z","y","x",-1,-1,i,t,e,a,s,0),m("z","y","x",1,-1,i,t,-e,a,s,1),m("x","z","y",1,1,e,i,t,r,a,2),m("x","z","y",1,-1,e,i,-t,r,a,3),m("x","y","z",1,-1,e,t,i,r,s,4),m("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new st(c,3)),this.setAttribute("normal",new st(u,3)),this.setAttribute("uv",new st(h,2));function m(g,A,f,E,v,_,b,M,S,C,I){const y=_/S,T=b/C,N=_/2,D=b/2,P=M/2,k=S+1,F=C+1;let G=0,H=0;const ee=new R;for(let Z=0;Z<F;Z++){const se=Z*T-D;for(let pe=0;pe<k;pe++){const Ue=pe*y-N;ee[g]=Ue*E,ee[A]=se*v,ee[f]=P,c.push(ee.x,ee.y,ee.z),ee[g]=0,ee[A]=0,ee[f]=M>0?1:-1,u.push(ee.x,ee.y,ee.z),h.push(pe/S),h.push(1-Z/C),G+=1}}for(let Z=0;Z<C;Z++)for(let se=0;se<S;se++){const pe=d+se+k*Z,Ue=d+se+k*(Z+1),qe=d+(se+1)+k*(Z+1),Ve=d+(se+1)+k*Z;l.push(pe,Ue,Ve),l.push(Ue,qe,Ve),H+=6}o.addGroup(p,H,I),p+=H,d+=G}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Wr(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function zt(n){const e={};for(let t=0;t<n.length;t++){const i=Wr(n[t]);for(const r in i)e[r]=i[r]}return e}function rE(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function Jf(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Je.workingColorSpace}const Zf={clone:Wr,merge:zt};var sE=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,aE=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Kn extends nn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=sE,this.fragmentShader=aE,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Wr(e.uniforms),this.uniformsGroups=rE(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const r in this.uniforms){const a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}}class $f extends ct{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new De,this.projectionMatrix=new De,this.projectionMatrixInverse=new De,this.coordinateSystem=Bn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const ni=new R,gh=new we,_h=new we;class Wt extends $f{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=zr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Ds*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return zr*2*Math.atan(Math.tan(Ds*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){ni.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ni.x,ni.y).multiplyScalar(-e/ni.z),ni.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(ni.x,ni.y).multiplyScalar(-e/ni.z)}getViewSize(e,t){return this.getViewBounds(e,gh,_h),t.subVectors(_h,gh)}setViewOffset(e,t,i,r,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Ds*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,s=-.5*r;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*r/l,t-=a.offsetY*i/c,r*=a.width/l,i*=a.height/c}const o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const fr=-90,pr=1;class oE extends ct{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new Wt(fr,pr,e,t);r.layers=this.layers,this.add(r);const s=new Wt(fr,pr,e,t);s.layers=this.layers,this.add(s);const a=new Wt(fr,pr,e,t);a.layers=this.layers,this.add(a);const o=new Wt(fr,pr,e,t);o.layers=this.layers,this.add(o);const l=new Wt(fr,pr,e,t);l.layers=this.layers,this.add(l);const c=new Wt(fr,pr,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,r,s,a,o,l]=t;for(const c of t)this.remove(c);if(e===Bn)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===po)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;const g=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,s),e.setRenderTarget(i,1,r),e.render(t,a),e.setRenderTarget(i,2,r),e.render(t,o),e.setRenderTarget(i,3,r),e.render(t,l),e.setRenderTarget(i,4,r),e.render(t,c),i.texture.generateMipmaps=g,e.setRenderTarget(i,5,r),e.render(t,u),e.setRenderTarget(h,d,p),e.xr.enabled=m,i.texture.needsPMREMUpdate=!0}}class ep extends Tt{constructor(e=[],t=Qi,i,r,s,a,o,l,c,u){super(e,t,i,r,s,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class lE extends Vi{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new ep(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new qn(5,5,5),s=new Kn({name:"CubemapFromEquirect",uniforms:Wr(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:qt,blending:oi});s.uniforms.tEquirect.value=t;const a=new Ke(r,s),o=t.minFilter;return t.minFilter===vn&&(t.minFilter=Ut),new oE(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,i=!0,r=!0){const s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,i,r);e.setRenderTarget(s)}}class gt extends ct{constructor(){super(),this.isGroup=!0,this.type="Group"}}const cE={type:"move"};class pl{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new gt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new gt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new gt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const g of e.hand.values()){const A=t.getJointPose(g,i),f=this._getHandJoint(c,g);A!==null&&(f.matrix.fromArray(A.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=A.radius),f.visible=A!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),p=.02,m=.005;c.inputState.pinching&&d>p+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(cE)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new gt;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}class hu{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new be(e),this.near=t,this.far=i}clone(){return new hu(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Eh extends ct{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new jt,this.environmentIntensity=1,this.environmentRotation=new jt,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class To{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Dc,this.updateRanges=[],this.version=0,this.uuid=bn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[i+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Gt=new R;class zi{constructor(e,t,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.applyMatrix4(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.applyNormalMatrix(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Gt.fromBufferAttribute(this,t),Gt.transformDirection(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=En(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=lt(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=En(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=En(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=En(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=En(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this}setXYZW(e,t,i,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=lt(t,this.array),i=lt(i,this.array),r=lt(r,this.array),s=lt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new tt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new zi(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class du extends nn{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new be(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let Ar;const ls=new R,mr=new R,gr=new R,_r=new we,cs=new we,tp=new De,ba=new R,us=new R,xa=new R,vh=new we,Al=new we,bh=new we;class Pc extends ct{constructor(e=new du){if(super(),this.isSprite=!0,this.type="Sprite",Ar===void 0){Ar=new dt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new To(t,5);Ar.setIndex([0,1,2,0,2,3]),Ar.setAttribute("position",new zi(i,3,0,!1)),Ar.setAttribute("uv",new zi(i,2,3,!1))}this.geometry=Ar,this.material=e,this.center=new we(.5,.5),this.count=1}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),mr.setFromMatrixScale(this.matrixWorld),tp.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),gr.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&mr.multiplyScalar(-gr.z);const i=this.material.rotation;let r,s;i!==0&&(s=Math.cos(i),r=Math.sin(i));const a=this.center;ya(ba.set(-.5,-.5,0),gr,a,mr,r,s),ya(us.set(.5,-.5,0),gr,a,mr,r,s),ya(xa.set(.5,.5,0),gr,a,mr,r,s),vh.set(0,0),Al.set(1,0),bh.set(1,1);let o=e.ray.intersectTriangle(ba,us,xa,!1,ls);if(o===null&&(ya(us.set(-.5,.5,0),gr,a,mr,r,s),Al.set(0,1),o=e.ray.intersectTriangle(ba,xa,us,!1,ls),o===null))return;const l=e.ray.origin.distanceTo(ls);l<e.near||l>e.far||t.push({distance:l,point:ls.clone(),uv:dn.getInterpolation(ls,ba,us,xa,vh,Al,bh,new we),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function ya(n,e,t,i,r,s){_r.subVectors(n,t).addScalar(.5).multiply(i),r!==void 0?(cs.x=s*_r.x-r*_r.y,cs.y=r*_r.x+s*_r.y):cs.copy(_r),n.copy(e),n.x+=cs.x,n.y+=cs.y,n.applyMatrix4(tp)}const xh=new R,yh=new nt,Mh=new nt,uE=new R,Ih=new De,Ma=new R,ml=new Dn,Sh=new De,gl=new wo;class np extends Ke{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Zu,this.bindMatrix=new De,this.bindMatrixInverse=new De,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new yn),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Ma),this.boundingBox.expandByPoint(Ma)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Dn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Ma),this.boundingSphere.expandByPoint(Ma)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const i=this.material,r=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ml.copy(this.boundingSphere),ml.applyMatrix4(r),e.ray.intersectsSphere(ml)!==!1&&(Sh.copy(r).invert(),gl.copy(e.ray).applyMatrix4(Sh),!(this.boundingBox!==null&&gl.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,gl)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new nt,t=this.geometry.attributes.skinWeight;for(let i=0,r=t.count;i<r;i++){e.fromBufferAttribute(t,i);const s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Zu?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===o_?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const i=this.skeleton,r=this.geometry;yh.fromBufferAttribute(r.attributes.skinIndex,e),Mh.fromBufferAttribute(r.attributes.skinWeight,e),xh.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let s=0;s<4;s++){const a=Mh.getComponent(s);if(a!==0){const o=yh.getComponent(s);Ih.multiplyMatrices(i.bones[o].matrixWorld,i.boneInverses[o]),t.addScaledVector(uE.copy(xh).applyMatrix4(Ih),a)}}return t.applyMatrix4(this.bindMatrixInverse)}}class ip extends ct{constructor(){super(),this.isBone=!0,this.type="Bone"}}class fu extends Tt{constructor(e=null,t=1,i=1,r,s,a,o,l,c=Nt,u=Nt,h,d){super(null,a,o,l,c,u,r,s,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Ch=new De,hE=new De;class Yr{constructor(e=[],t=[]){this.uuid=bn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new De)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new De;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,a=e.length;s<a;s++){const o=e[s]?e[s].matrixWorld:hE;Ch.multiplyMatrices(o,t[s]),Ch.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new Yr(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const i=new fu(t,e,e,Pt,kt);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){const s=e.bones[i];let a=t[s];a===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),a=new ip),this.bones.push(a),this.boneInverses.push(new De().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){const a=t[r];e.bones.push(a.uuid);const o=i[r];e.boneInverses.push(o.toArray())}return e}}class Uc extends tt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Er=new De,wh=new De,Ia=[],Th=new yn,dE=new De,hs=new Ke,ds=new Dn;class fE extends Ke{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Uc(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,dE)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new yn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Er),Th.copy(e.boundingBox).applyMatrix4(Er),this.boundingBox.union(Th)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Dn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Er),ds.copy(e.boundingSphere).applyMatrix4(Er),this.boundingSphere.union(ds)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,a=e*s+1;for(let o=0;o<i.length;o++)i[o]=r[a+o]}raycast(e,t){const i=this.matrixWorld,r=this.count;if(hs.geometry=this.geometry,hs.material=this.material,hs.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ds.copy(this.boundingSphere),ds.applyMatrix4(i),e.ray.intersectsSphere(ds)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,Er),wh.multiplyMatrices(i,Er),hs.matrixWorld=wh,hs.raycast(e,Ia);for(let a=0,o=Ia.length;a<o;a++){const l=Ia[a];l.instanceId=s,l.object=this,t.push(l)}Ia.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Uc(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new fu(new Float32Array(r*this.count),r,this.count,ai,kt));const s=this.morphTexture.source.data.data;let a=0;for(let c=0;c<i.length;c++)a+=i[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=r*e;s[l]=o,s.set(i,l+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const _l=new R,pE=new R,AE=new Le;class Ii{constructor(e=new R(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const r=_l.subVectors(i,t).cross(pE.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const i=e.delta(_l),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||AE.getNormalMatrix(e),r=this.coplanarPoint(_l).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const _i=new Dn,mE=new we(.5,.5),Sa=new R;class pu{constructor(e=new Ii,t=new Ii,i=new Ii,r=new Ii,s=new Ii,a=new Ii){this.planes=[e,t,i,r,s,a]}set(e,t,i,r,s,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(i),o[3].copy(r),o[4].copy(s),o[5].copy(a),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=Bn,i=!1){const r=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],u=s[4],h=s[5],d=s[6],p=s[7],m=s[8],g=s[9],A=s[10],f=s[11],E=s[12],v=s[13],_=s[14],b=s[15];if(r[0].setComponents(c-a,p-u,f-m,b-E).normalize(),r[1].setComponents(c+a,p+u,f+m,b+E).normalize(),r[2].setComponents(c+o,p+h,f+g,b+v).normalize(),r[3].setComponents(c-o,p-h,f-g,b-v).normalize(),i)r[4].setComponents(l,d,A,_).normalize(),r[5].setComponents(c-l,p-d,f-A,b-_).normalize();else if(r[4].setComponents(c-l,p-d,f-A,b-_).normalize(),t===Bn)r[5].setComponents(c+l,p+d,f+A,b+_).normalize();else if(t===po)r[5].setComponents(l,d,A,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),_i.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),_i.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(_i)}intersectsSprite(e){_i.center.set(0,0,0);const t=mE.distanceTo(e.center);return _i.radius=.7071067811865476+t,_i.applyMatrix4(e.matrixWorld),this.intersectsSphere(_i)}intersectsSphere(e){const t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const r=t[i];if(Sa.x=r.normal.x>0?e.max.x:e.min.x,Sa.y=r.normal.y>0?e.max.y:e.min.y,Sa.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Sa)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Xi extends nn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new be(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const Ao=new R,mo=new R,Rh=new De,fs=new wo,Ca=new Dn,El=new R,Bh=new R;class Ro extends ct{constructor(e=new dt,t=new Xi){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[0];for(let r=1,s=t.count;r<s;r++)Ao.fromBufferAttribute(t,r-1),mo.fromBufferAttribute(t,r),i[r]=i[r-1],i[r]+=Ao.distanceTo(mo);e.setAttribute("lineDistance",new st(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ca.copy(i.boundingSphere),Ca.applyMatrix4(r),Ca.radius+=s,e.ray.intersectsSphere(Ca)===!1)return;Rh.copy(r).invert(),fs.copy(e.ray).applyMatrix4(Rh);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,u=i.index,d=i.attributes.position;if(u!==null){const p=Math.max(0,a.start),m=Math.min(u.count,a.start+a.count);for(let g=p,A=m-1;g<A;g+=c){const f=u.getX(g),E=u.getX(g+1),v=wa(this,e,fs,l,f,E,g);v&&t.push(v)}if(this.isLineLoop){const g=u.getX(m-1),A=u.getX(p),f=wa(this,e,fs,l,g,A,m-1);f&&t.push(f)}}else{const p=Math.max(0,a.start),m=Math.min(d.count,a.start+a.count);for(let g=p,A=m-1;g<A;g+=c){const f=wa(this,e,fs,l,g,g+1,g);f&&t.push(f)}if(this.isLineLoop){const g=wa(this,e,fs,l,m-1,p,m-1);g&&t.push(g)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function wa(n,e,t,i,r,s,a){const o=n.geometry.attributes.position;if(Ao.fromBufferAttribute(o,r),mo.fromBufferAttribute(o,s),t.distanceSqToSegment(Ao,mo,El,Bh)>i)return;El.applyMatrix4(n.matrixWorld);const c=e.ray.origin.distanceTo(El);if(!(c<e.near||c>e.far))return{distance:c,point:Bh.clone().applyMatrix4(n.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:n}}const Lh=new R,Dh=new R;class Zs extends Ro{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[];for(let r=0,s=t.count;r<s;r+=2)Lh.fromBufferAttribute(t,r),Dh.fromBufferAttribute(t,r+1),i[r]=r===0?0:i[r-1],i[r+1]=i[r]+Lh.distanceTo(Dh);e.setAttribute("lineDistance",new st(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class gE extends Ro{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class Au extends nn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new be(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Ph=new De,Nc=new wo,Ta=new Dn,Ra=new R;class rp extends ct{constructor(e=new dt,t=new Au){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const i=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ta.copy(i.boundingSphere),Ta.applyMatrix4(r),Ta.radius+=s,e.ray.intersectsSphere(Ta)===!1)return;Ph.copy(r).invert(),Nc.copy(e.ray).applyMatrix4(Ph);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,h=i.attributes.position;if(c!==null){const d=Math.max(0,a.start),p=Math.min(c.count,a.start+a.count);for(let m=d,g=p;m<g;m++){const A=c.getX(m);Ra.fromBufferAttribute(h,A),Uh(Ra,A,l,r,e,t,this)}}else{const d=Math.max(0,a.start),p=Math.min(h.count,a.start+a.count);for(let m=d,g=p;m<g;m++)Ra.fromBufferAttribute(h,m),Uh(Ra,m,l,r,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Uh(n,e,t,i,r,s,a){const o=Nc.distanceSqToPoint(n);if(o<t){const l=new R;Nc.closestPointToPoint(n,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class Bo extends Tt{constructor(e,t,i,r,s,a,o,l,c,u,h,d){super(null,a,o,l,c,u,r,s,h,d),this.isCompressedTexture=!0,this.image={width:t,height:i},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}class _E extends Bo{constructor(e,t,i,r,s,a){super(e,t,i,s,a),this.isCompressedArrayTexture=!0,this.image.depth=r,this.wrapR=Wn,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class EE extends Bo{constructor(e,t,i){super(void 0,e[0].width,e[0].height,t,i,Qi),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=e}}class sp extends Tt{constructor(e,t,i,r,s,a,o,l,c){super(e,t,i,r,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class ap extends Tt{constructor(e,t,i=Gi,r,s,a,o=Nt,l=Nt,c,u=Gs,h=1){if(u!==Gs&&u!==Vs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:h};super(d,r,s,a,o,l,u,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new uu(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class op extends Tt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class go extends dt{constructor(e=1,t=1,i=4,r=8,s=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:i,radialSegments:r,heightSegments:s},t=Math.max(0,t),i=Math.max(1,Math.floor(i)),r=Math.max(3,Math.floor(r)),s=Math.max(1,Math.floor(s));const a=[],o=[],l=[],c=[],u=t/2,h=Math.PI/2*e,d=t,p=2*h+d,m=i*2+s,g=r+1,A=new R,f=new R;for(let E=0;E<=m;E++){let v=0,_=0,b=0,M=0;if(E<=i){const I=E/i,y=I*Math.PI/2;_=-u-e*Math.cos(y),b=e*Math.sin(y),M=-e*Math.cos(y),v=I*h}else if(E<=i+s){const I=(E-i)/s;_=-u+I*t,b=e,M=0,v=h+I*d}else{const I=(E-i-s)/i,y=I*Math.PI/2;_=u+e*Math.sin(y),b=e*Math.cos(y),M=e*Math.sin(y),v=h+d+I*h}const S=Math.max(0,Math.min(1,v/p));let C=0;E===0?C=.5/r:E===m&&(C=-.5/r);for(let I=0;I<=r;I++){const y=I/r,T=y*Math.PI*2,N=Math.sin(T),D=Math.cos(T);f.x=-b*D,f.y=_,f.z=b*N,o.push(f.x,f.y,f.z),A.set(-b*D,M,b*N),A.normalize(),l.push(A.x,A.y,A.z),c.push(y+C,S)}if(E>0){const I=(E-1)*g;for(let y=0;y<r;y++){const T=I+y,N=I+y+1,D=E*g+y,P=E*g+y+1;a.push(T,N,D),a.push(N,P,D)}}}this.setIndex(a),this.setAttribute("position",new st(o,3)),this.setAttribute("normal",new st(l,3)),this.setAttribute("uv",new st(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new go(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}}class Rr extends dt{constructor(e=1,t=32,i=0,r=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:r},t=Math.max(3,t);const s=[],a=[],o=[],l=[],c=new R,u=new we;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){const p=i+h/t*r;c.x=e*Math.cos(p),c.y=e*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),u.x=(a[d]/e+1)/2,u.y=(a[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new st(a,3)),this.setAttribute("normal",new st(o,3)),this.setAttribute("uv",new st(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Rr(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class qr extends dt{constructor(e=1,t=1,i=1,r=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;r=Math.floor(r),s=Math.floor(s);const u=[],h=[],d=[],p=[];let m=0;const g=[],A=i/2;let f=0;E(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(u),this.setAttribute("position",new st(h,3)),this.setAttribute("normal",new st(d,3)),this.setAttribute("uv",new st(p,2));function E(){const _=new R,b=new R;let M=0;const S=(t-e)/i;for(let C=0;C<=s;C++){const I=[],y=C/s,T=y*(t-e)+e;for(let N=0;N<=r;N++){const D=N/r,P=D*l+o,k=Math.sin(P),F=Math.cos(P);b.x=T*k,b.y=-y*i+A,b.z=T*F,h.push(b.x,b.y,b.z),_.set(k,S,F).normalize(),d.push(_.x,_.y,_.z),p.push(D,1-y),I.push(m++)}g.push(I)}for(let C=0;C<r;C++)for(let I=0;I<s;I++){const y=g[I][C],T=g[I+1][C],N=g[I+1][C+1],D=g[I][C+1];(e>0||I!==0)&&(u.push(y,T,D),M+=3),(t>0||I!==s-1)&&(u.push(T,N,D),M+=3)}c.addGroup(f,M,0),f+=M}function v(_){const b=m,M=new we,S=new R;let C=0;const I=_===!0?e:t,y=_===!0?1:-1;for(let N=1;N<=r;N++)h.push(0,A*y,0),d.push(0,y,0),p.push(.5,.5),m++;const T=m;for(let N=0;N<=r;N++){const P=N/r*l+o,k=Math.cos(P),F=Math.sin(P);S.x=I*F,S.y=A*y,S.z=I*k,h.push(S.x,S.y,S.z),d.push(0,y,0),M.x=k*.5+.5,M.y=F*.5*y+.5,p.push(M.x,M.y),m++}for(let N=0;N<r;N++){const D=b+N,P=T+N;_===!0?u.push(P,P+1,D):u.push(P+1,P,D),C+=3}c.addGroup(f,C,_===!0?1:2),f+=C}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new qr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Lo extends qr{constructor(e=1,t=1,i=32,r=1,s=!1,a=0,o=Math.PI*2){super(0,e,t,i,r,s,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Lo(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class mu extends dt{constructor(e=[],t=[],i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};const s=[],a=[];o(r),c(i),u(),this.setAttribute("position",new st(s,3)),this.setAttribute("normal",new st(s.slice(),3)),this.setAttribute("uv",new st(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(E){const v=new R,_=new R,b=new R;for(let M=0;M<t.length;M+=3)p(t[M+0],v),p(t[M+1],_),p(t[M+2],b),l(v,_,b,E)}function l(E,v,_,b){const M=b+1,S=[];for(let C=0;C<=M;C++){S[C]=[];const I=E.clone().lerp(_,C/M),y=v.clone().lerp(_,C/M),T=M-C;for(let N=0;N<=T;N++)N===0&&C===M?S[C][N]=I:S[C][N]=I.clone().lerp(y,N/T)}for(let C=0;C<M;C++)for(let I=0;I<2*(M-C)-1;I++){const y=Math.floor(I/2);I%2===0?(d(S[C][y+1]),d(S[C+1][y]),d(S[C][y])):(d(S[C][y+1]),d(S[C+1][y+1]),d(S[C+1][y]))}}function c(E){const v=new R;for(let _=0;_<s.length;_+=3)v.x=s[_+0],v.y=s[_+1],v.z=s[_+2],v.normalize().multiplyScalar(E),s[_+0]=v.x,s[_+1]=v.y,s[_+2]=v.z}function u(){const E=new R;for(let v=0;v<s.length;v+=3){E.x=s[v+0],E.y=s[v+1],E.z=s[v+2];const _=A(E)/2/Math.PI+.5,b=f(E)/Math.PI+.5;a.push(_,1-b)}m(),h()}function h(){for(let E=0;E<a.length;E+=6){const v=a[E+0],_=a[E+2],b=a[E+4],M=Math.max(v,_,b),S=Math.min(v,_,b);M>.9&&S<.1&&(v<.2&&(a[E+0]+=1),_<.2&&(a[E+2]+=1),b<.2&&(a[E+4]+=1))}}function d(E){s.push(E.x,E.y,E.z)}function p(E,v){const _=E*3;v.x=e[_+0],v.y=e[_+1],v.z=e[_+2]}function m(){const E=new R,v=new R,_=new R,b=new R,M=new we,S=new we,C=new we;for(let I=0,y=0;I<s.length;I+=9,y+=6){E.set(s[I+0],s[I+1],s[I+2]),v.set(s[I+3],s[I+4],s[I+5]),_.set(s[I+6],s[I+7],s[I+8]),M.set(a[y+0],a[y+1]),S.set(a[y+2],a[y+3]),C.set(a[y+4],a[y+5]),b.copy(E).add(v).add(_).divideScalar(3);const T=A(b);g(M,y+0,E,T),g(S,y+2,v,T),g(C,y+4,_,T)}}function g(E,v,_,b){b<0&&E.x===1&&(a[v]=E.x-1),_.x===0&&_.z===0&&(a[v]=b/2/Math.PI+.5)}function A(E){return Math.atan2(E.z,-E.x)}function f(E){return Math.atan2(-E.y,Math.sqrt(E.x*E.x+E.z*E.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new mu(e.vertices,e.indices,e.radius,e.details)}}class gu extends mu{constructor(e=1,t=0){const i=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],r=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(i,r,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new gu(e.radius,e.detail)}}class Kr extends dt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};const s=e/2,a=t/2,o=Math.floor(i),l=Math.floor(r),c=o+1,u=l+1,h=e/o,d=t/l,p=[],m=[],g=[],A=[];for(let f=0;f<u;f++){const E=f*d-a;for(let v=0;v<c;v++){const _=v*h-s;m.push(_,-E,0),g.push(0,0,1),A.push(v/o),A.push(1-f/l)}}for(let f=0;f<l;f++)for(let E=0;E<o;E++){const v=E+c*f,_=E+c*(f+1),b=E+1+c*(f+1),M=E+1+c*f;p.push(v,_,M),p.push(_,b,M)}this.setIndex(p),this.setAttribute("position",new st(m,3)),this.setAttribute("normal",new st(g,3)),this.setAttribute("uv",new st(A,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Kr(e.width,e.height,e.widthSegments,e.heightSegments)}}class Js extends dt{constructor(e=1,t=32,i=16,r=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:r,phiLength:s,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const u=[],h=new R,d=new R,p=[],m=[],g=[],A=[];for(let f=0;f<=i;f++){const E=[],v=f/i;let _=0;f===0&&a===0?_=.5/t:f===i&&l===Math.PI&&(_=-.5/t);for(let b=0;b<=t;b++){const M=b/t;h.x=-e*Math.cos(r+M*s)*Math.sin(a+v*o),h.y=e*Math.cos(a+v*o),h.z=e*Math.sin(r+M*s)*Math.sin(a+v*o),m.push(h.x,h.y,h.z),d.copy(h).normalize(),g.push(d.x,d.y,d.z),A.push(M+_,1-v),E.push(c++)}u.push(E)}for(let f=0;f<i;f++)for(let E=0;E<t;E++){const v=u[f][E+1],_=u[f][E],b=u[f+1][E],M=u[f+1][E+1];(f!==0||a>0)&&p.push(v,_,M),(f!==i-1||l<Math.PI)&&p.push(_,b,M)}this.setIndex(p),this.setAttribute("position",new st(m,3)),this.setAttribute("normal",new st(g,3)),this.setAttribute("uv",new st(A,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Js(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Do extends dt{constructor(e=1,t=.4,i=12,r=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:r,arc:s},i=Math.floor(i),r=Math.floor(r);const a=[],o=[],l=[],c=[],u=new R,h=new R,d=new R;for(let p=0;p<=i;p++)for(let m=0;m<=r;m++){const g=m/r*s,A=p/i*Math.PI*2;h.x=(e+t*Math.cos(A))*Math.cos(g),h.y=(e+t*Math.cos(A))*Math.sin(g),h.z=t*Math.sin(A),o.push(h.x,h.y,h.z),u.x=e*Math.cos(g),u.y=e*Math.sin(g),d.subVectors(h,u).normalize(),l.push(d.x,d.y,d.z),c.push(m/r),c.push(p/i)}for(let p=1;p<=i;p++)for(let m=1;m<=r;m++){const g=(r+1)*p+m-1,A=(r+1)*(p-1)+m-1,f=(r+1)*(p-1)+m,E=(r+1)*p+m;a.push(g,A,E),a.push(A,f,E)}this.setIndex(a),this.setAttribute("position",new st(o,3)),this.setAttribute("normal",new st(l,3)),this.setAttribute("uv",new st(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Do(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class _u extends nn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new be(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Co,this.normalScale=new we(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Pn extends _u{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new we(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return je(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new be(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new be(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new be(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Us extends nn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Co,this.normalScale=new we(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jt,this.combine=eu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class vE extends nn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=f_,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class bE extends nn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Ba(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function xE(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function yE(n){function e(r,s){return n[r]-n[s]}const t=n.length,i=new Array(t);for(let r=0;r!==t;++r)i[r]=r;return i.sort(e),i}function Nh(n,e,t){const i=n.length,r=new n.constructor(i);for(let s=0,a=0;a!==i;++s){const o=t[s]*e;for(let l=0;l!==e;++l)r[a++]=n[o+l]}return r}function lp(n,e,t,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let a=s[i];if(a!==void 0)if(Array.isArray(a))do a=s[i],a!==void 0&&(e.push(s.time),t.push(...a)),s=n[r++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[i],a!==void 0&&(e.push(s.time),a.toArray(t,t.length)),s=n[r++];while(s!==void 0);else do a=s[i],a!==void 0&&(e.push(s.time),t.push(a)),s=n[r++];while(s!==void 0)}class $s{constructor(e,t,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let i=this._cachedIndex,r=t[i],s=t[i-1];e:{t:{let a;n:{i:if(!(e<r)){for(let o=i+2;;){if(r===void 0){if(e<s)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===o)break;if(s=r,r=t[++i],e<r)break t}a=t.length;break n}if(!(e>=s)){const o=t[1];e<o&&(i=2,s=o);for(let l=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(r=s,s=t[--i-1],e>=s)break t}a=i,i=0;break n}break e}for(;i<a;){const o=i+a>>>1;e<t[o]?a=o:i=o+1}if(r=t[i],s=t[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let a=0;a!==r;++a)t[a]=i[s+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class ME extends $s{constructor(e,t,i,r){super(e,t,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:wr,endingEnd:wr}}intervalChanged_(e,t,i){const r=this.parameterPositions;let s=e-2,a=e+1,o=r[s],l=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case Tr:s=e,o=2*t-i;break;case ho:s=r.length-2,o=t+r[s]-r[s+1];break;default:s=e,o=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Tr:a=e,l=2*i-t;break;case ho:a=1,l=i+r[1]-r[0];break;default:a=e-1,l=t}const c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-i),this._offsetPrev=s*u,this._offsetNext=a*u}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,p=this._weightNext,m=(i-t)/(r-t),g=m*m,A=g*m,f=-d*A+2*d*g-d*m,E=(1+d)*A+(-1.5-2*d)*g+(-.5+d)*m+1,v=(-1-p)*A+(1.5+p)*g+.5*m,_=p*A-p*g;for(let b=0;b!==o;++b)s[b]=f*a[u+b]+E*a[c+b]+v*a[l+b]+_*a[h+b];return s}}class cp extends $s{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,u=(i-t)/(r-t),h=1-u;for(let d=0;d!==o;++d)s[d]=a[c+d]*h+a[l+d]*u;return s}}class IE extends $s{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}}class Mn{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ba(t,this.TimeBufferType),this.values=Ba(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:Ba(e.times,Array),values:Ba(e.values,Array)};const r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new IE(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new cp(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ME(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case js:t=this.InterpolantFactoryMethodDiscrete;break;case Xs:t=this.InterpolantFactoryMethodLinear;break;case jo:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return console.warn("THREE.KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return js;case this.InterpolantFactoryMethodLinear:return Xs;case this.InterpolantFactoryMethodSmooth:return jo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){const i=this.times,r=i.length;let s=0,a=r-1;for(;s!==r&&i[s]<e;)++s;for(;a!==-1&&i[a]>t;)--a;if(++a,s!==0||a!==r){s>=a&&(a=Math.max(a,1),s=a-1);const o=this.getValueSize();this.times=i.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const i=this.times,r=this.values,s=i.length;s===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){const l=i[o];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(r!==void 0&&xE(r))for(let o=0,l=r.length;o!==l;++o){const c=r[o];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===jo,s=e.length-1;let a=1;for(let o=1;o<s;++o){let l=!1;const c=e[o],u=e[o+1];if(c!==u&&(o!==1||c!==e[0]))if(r)l=!0;else{const h=o*i,d=h-i,p=h+i;for(let m=0;m!==i;++m){const g=t[h+m];if(g!==t[d+m]||g!==t[p+m]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const h=o*i,d=a*i;for(let p=0;p!==i;++p)t[d+p]=t[h+p]}++a}}if(s>0){e[a]=e[s];for(let o=s*i,l=a*i,c=0;c!==i;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*i)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}}Mn.prototype.ValueTypeName="";Mn.prototype.TimeBufferType=Float32Array;Mn.prototype.ValueBufferType=Float32Array;Mn.prototype.DefaultInterpolation=Xs;class Jr extends Mn{constructor(e,t,i){super(e,t,i)}}Jr.prototype.ValueTypeName="bool";Jr.prototype.ValueBufferType=Array;Jr.prototype.DefaultInterpolation=js;Jr.prototype.InterpolantFactoryMethodLinear=void 0;Jr.prototype.InterpolantFactoryMethodSmooth=void 0;class up extends Mn{constructor(e,t,i,r){super(e,t,i,r)}}up.prototype.ValueTypeName="color";class jr extends Mn{constructor(e,t,i,r){super(e,t,i,r)}}jr.prototype.ValueTypeName="number";class SE extends $s{constructor(e,t,i,r){super(e,t,i,r)}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(i-t)/(r-t);let c=e*o;for(let u=c+o;c!==u;c+=4)He.slerpFlat(s,0,a,c-o,a,c,l);return s}}class Wi extends Mn{constructor(e,t,i,r){super(e,t,i,r)}InterpolantFactoryMethodLinear(e){return new SE(this.times,this.values,this.getValueSize(),e)}}Wi.prototype.ValueTypeName="quaternion";Wi.prototype.InterpolantFactoryMethodSmooth=void 0;class Zr extends Mn{constructor(e,t,i){super(e,t,i)}}Zr.prototype.ValueTypeName="string";Zr.prototype.ValueBufferType=Array;Zr.prototype.DefaultInterpolation=js;Zr.prototype.InterpolantFactoryMethodLinear=void 0;Zr.prototype.InterpolantFactoryMethodSmooth=void 0;class qi extends Mn{constructor(e,t,i,r){super(e,t,i,r)}}qi.prototype.ValueTypeName="vector";class _o{constructor(e="",t=-1,i=[],r=lu){this.name=e,this.tracks=i,this.duration=t,this.blendMode=r,this.uuid=bn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],i=e.tracks,r=1/(e.fps||1);for(let a=0,o=i.length;a!==o;++a)t.push(wE(i[a]).scale(r));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s.userData=JSON.parse(e.userData||"{}"),s}static toJSON(e){const t=[],i=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let s=0,a=i.length;s!==a;++s)t.push(Mn.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(e,t,i,r){const s=t.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);const u=yE(l);l=Nh(l,1,u),c=Nh(c,1,u),!r&&l[0]===0&&(l.push(s),c.push(c[0])),a.push(new jr(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/i))}return new this(e,-1,a)}static findByName(e,t){let i=e;if(!Array.isArray(e)){const r=e;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null}static CreateClipsFromMorphTargetSequences(e,t,i){const r={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],u=c.name.match(s);if(u&&u.length>1){const h=u[1];let d=r[h];d||(r[h]=d=[]),d.push(c)}}const a=[];for(const o in r)a.push(this.CreateFromMorphTargetSequence(o,r[o],t,i));return a}static parseAnimation(e,t){if(console.warn("THREE.AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const i=function(h,d,p,m,g){if(p.length!==0){const A=[],f=[];lp(p,A,f,m),A.length!==0&&g.push(new h(d,A,f))}},r=[],s=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let h=0;h<c.length;h++){const d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const p={};let m;for(m=0;m<d.length;m++)if(d[m].morphTargets)for(let g=0;g<d[m].morphTargets.length;g++)p[d[m].morphTargets[g]]=-1;for(const g in p){const A=[],f=[];for(let E=0;E!==d[m].morphTargets.length;++E){const v=d[m];A.push(v.time),f.push(v.morphTarget===g?1:0)}r.push(new jr(".morphTargetInfluence["+g+"]",A,f))}l=p.length*a}else{const p=".bones["+t[h].name+"]";i(qi,p+".position",d,"pos",r),i(Wi,p+".quaternion",d,"rot",r),i(qi,p+".scale",d,"scl",r)}}return r.length===0?null:new this(s,l,r,o)}resetDuration(){const e=this.tracks;let t=0;for(let i=0,r=e.length;i!==r;++i){const s=this.tracks[i];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let i=0;i<this.tracks.length;i++)e.push(this.tracks[i].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}}function CE(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return jr;case"vector":case"vector2":case"vector3":case"vector4":return qi;case"color":return up;case"quaternion":return Wi;case"bool":case"boolean":return Jr;case"string":return Zr}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function wE(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=CE(n.type);if(n.times===void 0){const t=[],i=[];lp(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}const jn={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class hp{constructor(e,t,i){const r=this;let s=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.abortController=new AbortController,this.itemStart=function(u){o++,s===!1&&r.onStart!==void 0&&r.onStart(u,a,o),s=!0},this.itemEnd=function(u){a++,r.onProgress!==void 0&&r.onProgress(u,a,o),a===o&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){const h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){const p=c[h],m=c[h+1];if(p.global&&(p.lastIndex=0),p.test(u))return m}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}const TE=new hp;class Yi{constructor(e){this.manager=e!==void 0?e:TE,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const i=this;return new Promise(function(r,s){i.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Yi.DEFAULT_MATERIAL_NAME="__DEFAULT";const Hn={};class RE extends Error{constructor(e,t){super(e),this.response=t}}class Ns extends Yi{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=jn.get(`file:${e}`);if(s!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0),s;if(Hn[e]!==void 0){Hn[e].push({onLoad:t,onProgress:i,onError:r});return}Hn[e]=[],Hn[e].push({onLoad:t,onProgress:i,onError:r});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const u=Hn[e],h=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),p=d?parseInt(d):0,m=p!==0;let g=0;const A=new ReadableStream({start(f){E();function E(){h.read().then(({done:v,value:_})=>{if(v)f.close();else{g+=_.byteLength;const b=new ProgressEvent("progress",{lengthComputable:m,loaded:g,total:p});for(let M=0,S=u.length;M<S;M++){const C=u[M];C.onProgress&&C.onProgress(b)}f.enqueue(_),E()}},v=>{f.error(v)})}}});return new Response(A)}else throw new RE(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,o));case"json":return c.json();default:if(o==="")return c.text();{const h=/charset="?([^;"\s]*)"?/i.exec(o),d=h&&h[1]?h[1].toLowerCase():void 0,p=new TextDecoder(d);return c.arrayBuffer().then(m=>p.decode(m))}}}).then(c=>{jn.add(`file:${e}`,c);const u=Hn[e];delete Hn[e];for(let h=0,d=u.length;h<d;h++){const p=u[h];p.onLoad&&p.onLoad(c)}}).catch(c=>{const u=Hn[e];if(u===void 0)throw this.manager.itemError(e),c;delete Hn[e];for(let h=0,d=u.length;h<d;h++){const p=u[h];p.onError&&p.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const vr=new WeakMap;class dp extends Yi{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=jn.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)s.manager.itemStart(e),setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0);else{let h=vr.get(a);h===void 0&&(h=[],vr.set(a,h)),h.push({onLoad:t,onError:r})}return a}const o=Ys("img");function l(){u(),t&&t(this);const h=vr.get(this)||[];for(let d=0;d<h.length;d++){const p=h[d];p.onLoad&&p.onLoad(this)}vr.delete(this),s.manager.itemEnd(e)}function c(h){u(),r&&r(h),jn.remove(`image:${e}`);const d=vr.get(this)||[];for(let p=0;p<d.length;p++){const m=d[p];m.onError&&m.onError(h)}vr.delete(this),s.manager.itemError(e),s.manager.itemEnd(e)}function u(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),jn.add(`image:${e}`,o),s.manager.itemStart(e),o.src=e,o}}class BE extends Yi{constructor(e){super(e)}load(e,t,i,r){const s=new Tt,a=new dp(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){s.image=o,s.needsUpdate=!0,t!==void 0&&t(s)},i,r),s}}class Po extends ct{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new be(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class LE extends Po{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.groundColor=new be(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const vl=new De,Fh=new R,Oh=new R;class Eu{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new we(512,512),this.mapType=We,this.map=null,this.mapPass=null,this.matrix=new De,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new pu,this._frameExtents=new we(1,1),this._viewportCount=1,this._viewports=[new nt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;Fh.setFromMatrixPosition(e.matrixWorld),t.position.copy(Fh),Oh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Oh),t.updateMatrixWorld(),vl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(vl,t.coordinateSystem,t.reversedDepth),t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(vl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class DE extends Eu{constructor(){super(new Wt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,i=zr*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height*this.aspect,s=e.distance||t.far;(i!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=i,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class PE extends Po{constructor(e,t,i=0,r=Math.PI/3,s=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.target=new ct,this.distance=i,this.angle=r,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new DE}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const kh=new De,ps=new R,bl=new R;class UE extends Eu{constructor(){super(new Wt(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new we(4,2),this._viewportCount=6,this._viewports=[new nt(2,1,1,1),new nt(0,1,1,1),new nt(3,1,1,1),new nt(1,1,1,1),new nt(3,0,1,1),new nt(1,0,1,1)],this._cubeDirections=[new R(1,0,0),new R(-1,0,0),new R(0,0,1),new R(0,0,-1),new R(0,1,0),new R(0,-1,0)],this._cubeUps=[new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,0,1),new R(0,0,-1)]}updateMatrices(e,t=0){const i=this.camera,r=this.matrix,s=e.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),ps.setFromMatrixPosition(e.matrixWorld),i.position.copy(ps),bl.copy(i.position),bl.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(bl),i.updateMatrixWorld(),r.makeTranslation(-ps.x,-ps.y,-ps.z),kh.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(kh,i.coordinateSystem,i.reversedDepth)}}class NE extends Po{constructor(e,t,i=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new UE}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class Uo extends $f{constructor(e=-1,t=1,i=1,r=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,a=i+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class FE extends Eu{constructor(){super(new Uo(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class fp extends Po{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ct.DEFAULT_UP),this.updateMatrix(),this.target=new ct,this.shadow=new FE}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class Fs{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}const xl=new WeakMap;class OE extends Yi{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,i,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,a=jn.get(`image-bitmap:${e}`);if(a!==void 0){if(s.manager.itemStart(e),a.then){a.then(c=>{if(xl.has(a)===!0)r&&r(xl.get(a)),s.manager.itemError(e),s.manager.itemEnd(e);else return t&&t(c),s.manager.itemEnd(e),c});return}return setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0),a}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){return jn.add(`image-bitmap:${e}`,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){r&&r(c),xl.set(l,c),jn.remove(`image-bitmap:${e}`),s.manager.itemError(e),s.manager.itemEnd(e)});jn.add(`image-bitmap:${e}`,l),s.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}class kE extends Wt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class QE{constructor(e,t,i){this.binding=e,this.valueSize=i;let r,s,a;switch(t){case"quaternion":r=this._slerp,s=this._slerpAdditive,a=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(i*6),this._workIndex=5;break;case"string":case"bool":r=this._select,s=this._select,a=this._setAdditiveIdentityOther,this.buffer=new Array(i*5);break;default:r=this._lerp,s=this._lerpAdditive,a=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(i*5)}this._mixBufferRegion=r,this._mixBufferRegionAdditive=s,this._setIdentity=a,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const i=this.buffer,r=this.valueSize,s=e*r+r;let a=this.cumulativeWeight;if(a===0){for(let o=0;o!==r;++o)i[s+o]=i[o];a=t}else{a+=t;const o=t/a;this._mixBufferRegion(i,s,0,o,r)}this.cumulativeWeight=a}accumulateAdditive(e){const t=this.buffer,i=this.valueSize,r=i*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,r,0,e,i),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,i=this.buffer,r=e*t+t,s=this.cumulativeWeight,a=this.cumulativeWeightAdditive,o=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const l=t*this._origIndex;this._mixBufferRegion(i,r,l,1-s,t)}a>0&&this._mixBufferRegionAdditive(i,r,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(i[l]!==i[l+t]){o.setValue(i,r);break}}saveOriginalState(){const e=this.binding,t=this.buffer,i=this.valueSize,r=i*this._origIndex;e.getValue(t,r);for(let s=i,a=r;s!==a;++s)t[s]=t[r+s%i];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let i=e;i<t;i++)this.buffer[i]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let i=0;i<this.valueSize;i++)this.buffer[t+i]=this.buffer[e+i]}_select(e,t,i,r,s){if(r>=.5)for(let a=0;a!==s;++a)e[t+a]=e[i+a]}_slerp(e,t,i,r){He.slerpFlat(e,t,e,t,e,i,r)}_slerpAdditive(e,t,i,r,s){const a=this._workIndex*s;He.multiplyQuaternionsFlat(e,a,e,t,e,i),He.slerpFlat(e,t,e,t,e,a,r)}_lerp(e,t,i,r,s){const a=1-r;for(let o=0;o!==s;++o){const l=t+o;e[l]=e[l]*a+e[i+o]*r}}_lerpAdditive(e,t,i,r,s){for(let a=0;a!==s;++a){const o=t+a;e[o]=e[o]+e[i+a]*r}}}const vu="\\[\\]\\.:\\/",HE=new RegExp("["+vu+"]","g"),bu="[^"+vu+"]",GE="[^"+vu.replace("\\.","")+"]",VE=/((?:WC+[\/:])*)/.source.replace("WC",bu),zE=/(WCOD+)?/.source.replace("WCOD",GE),WE=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",bu),qE=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",bu),jE=new RegExp("^"+VE+zE+WE+qE+"$"),XE=["material","materials","bones","map"];class YE{constructor(e,t,i){const r=i||rt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();const i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,t)}setValue(e,t){const i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}}class rt{constructor(e,t,i){this.path=t,this.parsedPath=i||rt.parseTrackName(t),this.node=rt.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new rt.Composite(e,t,i):new rt(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(HE,"")}static parseTrackName(e){const t=jE.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){const s=i.nodeName.substring(r+1);XE.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){const i=function(s){for(let a=0;a<s.length;a++){const o=s[a];if(o.name===t||o.uuid===t)return o;const l=i(o.children);if(l)return l}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,i=t.objectName,r=t.propertyName;let s=t.propertyIndex;if(e||(e=rt.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const a=e[r];if(a===void 0){const c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}rt.Composite=YE;rt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};rt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};rt.prototype.GetterByBindingType=[rt.prototype._getValue_direct,rt.prototype._getValue_array,rt.prototype._getValue_arrayElement,rt.prototype._getValue_toArray];rt.prototype.SetterByBindingTypeAndVersioning=[[rt.prototype._setValue_direct,rt.prototype._setValue_direct_setNeedsUpdate,rt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_array,rt.prototype._setValue_array_setNeedsUpdate,rt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_arrayElement,rt.prototype._setValue_arrayElement_setNeedsUpdate,rt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_fromArray,rt.prototype._setValue_fromArray_setNeedsUpdate,rt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class KE{constructor(e,t,i=null,r=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=i,this.blendMode=r;const s=t.tracks,a=s.length,o=new Array(a),l={endingStart:wr,endingEnd:wr};for(let c=0;c!==a;++c){const u=s[c].createInterpolant(null);o[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=o,this._propertyBindings=new Array(a),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=c_,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,i=!1){if(e.fadeOut(t),this.fadeIn(t),i===!0){const r=this._clip.duration,s=e._clip.duration,a=s/r,o=r/s;e.warp(1,a,t),this.warp(o,1,t)}return this}crossFadeTo(e,t,i=!1){return e.crossFadeFrom(this,t,i)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,i){const r=this._mixer,s=r.time,a=this.timeScale;let o=this._timeScaleInterpolant;o===null&&(o=r._lendControlInterpolant(),this._timeScaleInterpolant=o);const l=o.parameterPositions,c=o.sampleValues;return l[0]=s,l[1]=s+i,c[0]=e/a,c[1]=t/a,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,i,r){if(!this.enabled){this._updateWeight(e);return}const s=this._startTime;if(s!==null){const l=(e-s)*i;l<0||i===0?t=0:(this._startTime=null,t=i*l)}t*=this._updateTimeScale(e);const a=this._updateTime(t),o=this._updateWeight(e);if(o>0){const l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case h_:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(a),c[u].accumulateAdditive(o);break;case lu:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(a),c[u].accumulate(r,o)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const i=this._weightInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopFading(),r===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const i=this._timeScaleInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,i=this.loop;let r=this.time+e,s=this._loopCount;const a=i===u_;if(e===0)return s===-1?r:a&&(s&1)===1?t-r:r;if(i===l_){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(r>=t)r=t;else if(r<0)r=0;else{this.time=r;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,a)):this._setEndings(this.repetitions===0,!0,a)),r>=t||r<0){const o=Math.floor(r/t);r-=t*o,s+=Math.abs(o);const l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,r=e>0?t:0,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){const c=e<0;this._setEndings(c,!c,a)}else this._setEndings(!1,!1,a);this._loopCount=s,this.time=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:o})}}else this.time=r;if(a&&(s&1)===1)return t-r}return r}_setEndings(e,t,i){const r=this._interpolantSettings;i?(r.endingStart=Tr,r.endingEnd=Tr):(e?r.endingStart=this.zeroSlopeAtStart?Tr:wr:r.endingStart=ho,t?r.endingEnd=this.zeroSlopeAtEnd?Tr:wr:r.endingEnd=ho)}_scheduleFading(e,t,i){const r=this._mixer,s=r.time;let a=this._weightInterpolant;a===null&&(a=r._lendControlInterpolant(),this._weightInterpolant=a);const o=a.parameterPositions,l=a.sampleValues;return o[0]=s,l[0]=t,o[1]=s+e,l[1]=i,this}}const JE=new Float32Array(1);class ZE extends ji{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){const i=e._localRoot||this._root,r=e._clip.tracks,s=r.length,a=e._propertyBindings,o=e._interpolants,l=i.uuid,c=this._bindingsByRootAndName;let u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){const d=r[h],p=d.name;let m=u[p];if(m!==void 0)++m.referenceCount,a[h]=m;else{if(m=a[h],m!==void 0){m._cacheIndex===null&&(++m.referenceCount,this._addInactiveBinding(m,l,p));continue}const g=t&&t._propertyBindings[h].binding.parsedPath;m=new QE(rt.create(i,p,g),d.ValueTypeName,d.getValueSize()),++m.referenceCount,this._addInactiveBinding(m,l,p),a[h]=m}o[h].resultBuffer=m.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){const i=(e._localRoot||this._root).uuid,r=e._clip.uuid,s=this._actionsByClip[r];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,r,i)}const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){const t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,i){const r=this._actions,s=this._actionsByClip;let a=s[t];if(a===void 0)a={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=a;else{const o=a.knownActions;e._byClipCacheIndex=o.length,o.push(e)}e._cacheIndex=r.length,r.push(e),a.actionByRoot[i]=e}_removeInactiveAction(e){const t=this._actions,i=t[t.length-1],r=e._cacheIndex;i._cacheIndex=r,t[r]=i,t.pop(),e._cacheIndex=null;const s=e._clip.uuid,a=this._actionsByClip,o=a[s],l=o.knownActions,c=l[l.length-1],u=e._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),e._byClipCacheIndex=null;const h=o.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],l.length===0&&delete a[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){const t=this._actions,i=e._cacheIndex,r=this._nActiveActions++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackAction(e){const t=this._actions,i=e._cacheIndex,r=--this._nActiveActions,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_addInactiveBinding(e,t,i){const r=this._bindingsByRootAndName,s=this._bindings;let a=r[t];a===void 0&&(a={},r[t]=a),a[i]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){const t=this._bindings,i=e.binding,r=i.rootNode.uuid,s=i.path,a=this._bindingsByRootAndName,o=a[r],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete o[s],Object.keys(o).length===0&&delete a[r]}_lendBinding(e){const t=this._bindings,i=e._cacheIndex,r=this._nActiveBindings++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackBinding(e){const t=this._bindings,i=e._cacheIndex,r=--this._nActiveBindings,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_lendControlInterpolant(){const e=this._controlInterpolants,t=this._nActiveControlInterpolants++;let i=e[t];return i===void 0&&(i=new cp(new Float32Array(2),new Float32Array(2),1,JE),i.__cacheIndex=t,e[t]=i),i}_takeBackControlInterpolant(e){const t=this._controlInterpolants,i=e.__cacheIndex,r=--this._nActiveControlInterpolants,s=t[r];e.__cacheIndex=r,t[r]=e,s.__cacheIndex=i,t[i]=s}clipAction(e,t,i){const r=t||this._root,s=r.uuid;let a=typeof e=="string"?_o.findByName(r,e):e;const o=a!==null?a.uuid:e,l=this._actionsByClip[o];let c=null;if(i===void 0&&(a!==null?i=a.blendMode:i=lu),l!==void 0){const h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===i)return h;c=l.knownActions[0],a===null&&(a=c._clip)}if(a===null)return null;const u=new KE(this,a,t,i);return this._bindAction(u,c),this._addInactiveAction(u,o,s),u}existingAction(e,t){const i=t||this._root,r=i.uuid,s=typeof e=="string"?_o.findByName(i,e):e,a=s?s.uuid:e,o=this._actionsByClip[a];return o!==void 0&&o.actionByRoot[r]||null}stopAllAction(){const e=this._actions,t=this._nActiveActions;for(let i=t-1;i>=0;--i)e[i].stop();return this}update(e){e*=this.timeScale;const t=this._actions,i=this._nActiveActions,r=this.time+=e,s=Math.sign(e),a=this._accuIndex^=1;for(let c=0;c!==i;++c)t[c]._update(r,e,s,a);const o=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)o[c].apply(a);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){const t=this._actions,i=e.uuid,r=this._actionsByClip,s=r[i];if(s!==void 0){const a=s.knownActions;for(let o=0,l=a.length;o!==l;++o){const c=a[o];this._deactivateAction(c);const u=c._cacheIndex,h=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(c)}delete r[i]}}uncacheRoot(e){const t=e.uuid,i=this._actionsByClip;for(const a in i){const o=i[a].actionByRoot,l=o[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}const r=this._bindingsByRootAndName,s=r[t];if(s!==void 0)for(const a in s){const o=s[a];o.restoreOriginalState(),this._removeInactiveBinding(o)}}uncacheAction(e,t){const i=this.existingAction(e,t);i!==null&&(this._deactivateAction(i),this._removeInactiveAction(i))}}class Qh{constructor(e,t,i,r,s,a=!1){this.isGLBufferAttribute=!0,this.name="",this.buffer=e,this.type=t,this.itemSize=i,this.elementSize=r,this.count=s,this.normalized=a,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}}class $E extends Zs{constructor(e=1){const t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],r=new dt;r.setAttribute("position",new st(t,3)),r.setAttribute("color",new st(i,3));const s=new Xi({vertexColors:!0,toneMapped:!1});super(r,s),this.type="AxesHelper"}setColors(e,t,i){const r=new be,s=this.geometry.attributes.color.array;return r.set(e),r.toArray(s,0),r.toArray(s,3),r.set(t),r.toArray(s,6),r.toArray(s,9),r.set(i),r.toArray(s,12),r.toArray(s,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}function Hh(n,e,t,i){const r=e0(i);switch(t){case Hf:return n*e;case ai:return n*e/r.components*r.byteLength;case su:return n*e/r.components*r.byteLength;case Li:return n*e*2/r.components*r.byteLength;case au:return n*e*2/r.components*r.byteLength;case Hs:return n*e*3/r.components*r.byteLength;case Pt:return n*e*4/r.components*r.byteLength;case ou:return n*e*4/r.components*r.byteLength;case Pr:case Ni:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Ur:case Ls:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case _c:case zs:return Math.max(n,16)*Math.max(e,8)/4;case ro:case Gr:return Math.max(n,8)*Math.max(e,8)/2;case so:case Ws:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case qs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Fi:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Ec:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case vc:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case bc:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Nr:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case xc:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case yc:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Mc:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Ic:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Sc:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Cc:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case wc:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Tc:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Rc:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Vr:case Bc:case ao:return Math.ceil(n/4)*Math.ceil(e/4)*16;case oo:case lo:return Math.ceil(n/4)*Math.ceil(e/4)*8;case co:case uo:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function e0(n){switch(n){case We:case kf:return{byteLength:1,components:1};case ks:case Qf:case hn:return{byteLength:2,components:1};case iu:case ru:return{byteLength:2,components:4};case Gi:case nu:case kt:return{byteLength:4,components:1};case Io:case So:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ki}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ki);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function pp(){let n=null,e=!1,t=null,i=null;function r(s,a){t(s,a),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function t0(n){const e=new WeakMap;function t(o,l){const c=o.array,u=o.usage,h=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,u),o.onUploadCallback();let p;if(c instanceof Float32Array)p=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=n.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=n.HALF_FLOAT:p=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=n.SHORT;else if(c instanceof Uint32Array)p=n.UNSIGNED_INT;else if(c instanceof Int32Array)p=n.INT;else if(c instanceof Int8Array)p=n.BYTE;else if(c instanceof Uint8Array)p=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function i(o,l,c){const u=l.array,h=l.updateRanges;if(n.bindBuffer(c,o),h.length===0)n.bufferSubData(c,0,u);else{h.sort((p,m)=>p.start-m.start);let d=0;for(let p=1;p<h.length;p++){const m=h[d],g=h[p];g.start<=m.start+m.count+1?m.count=Math.max(m.count,g.start+g.count-m.start):(++d,h[d]=g)}h.length=d+1;for(let p=0,m=h.length;p<m;p++){const g=h[p];n.bufferSubData(c,g.start*u.BYTES_PER_ELEMENT,u,g.start,g.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(n.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var n0=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,i0=`#ifdef USE_ALPHAHASH
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
#endif`,r0=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,s0=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,a0=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,o0=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,l0=`#ifdef USE_AOMAP
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
#endif`,c0=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,u0=`#ifdef USE_BATCHING
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
#endif`,h0=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,d0=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,f0=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,p0=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,A0=`#ifdef USE_IRIDESCENCE
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
#endif`,m0=`#ifdef USE_BUMPMAP
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
#endif`,g0=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,_0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,E0=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,v0=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,b0=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,x0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,y0=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,M0=`#if defined( USE_COLOR_ALPHA )
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
#endif`,I0=`#define PI 3.141592653589793
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
} // validated`,S0=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,C0=`vec3 transformedNormal = objectNormal;
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
#endif`,w0=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,T0=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,R0=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,B0=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,L0="gl_FragColor = linearToOutputTexel( gl_FragColor );",D0=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,P0=`#ifdef USE_ENVMAP
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
#endif`,U0=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,N0=`#ifdef USE_ENVMAP
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
#endif`,F0=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,O0=`#ifdef USE_ENVMAP
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
#endif`,k0=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Q0=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,H0=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,G0=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,V0=`#ifdef USE_GRADIENTMAP
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
}`,z0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,W0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,q0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,j0=`uniform bool receiveShadow;
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
#endif`,X0=`#ifdef USE_ENVMAP
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
#endif`,Y0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,K0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,J0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Z0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,$0=`PhysicalMaterial material;
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
#endif`,ev=`struct PhysicalMaterial {
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
}`,tv=`
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
#endif`,nv=`#if defined( RE_IndirectDiffuse )
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
#endif`,iv=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,rv=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,sv=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,av=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,ov=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,lv=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,cv=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,uv=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,hv=`#if defined( USE_POINTS_UV )
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
#endif`,dv=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,fv=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,pv=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Av=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,mv=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,gv=`#ifdef USE_MORPHTARGETS
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
#endif`,_v=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ev=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,vv=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,bv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,xv=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,yv=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Mv=`#ifdef USE_NORMALMAP
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
#endif`,Iv=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Sv=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Cv=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,wv=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Tv=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Rv=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Bv=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Lv=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Dv=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Pv=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Uv=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Nv=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Fv=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Ov=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,kv=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Qv=`float getShadowMask() {
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
}`,Hv=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Gv=`#ifdef USE_SKINNING
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
#endif`,Vv=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,zv=`#ifdef USE_SKINNING
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
#endif`,Wv=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,qv=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,jv=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Xv=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Yv=`#ifdef USE_TRANSMISSION
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
#endif`,Kv=`#ifdef USE_TRANSMISSION
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
#endif`,Jv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Zv=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,$v=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,eb=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const tb=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,nb=`uniform sampler2D t2D;
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
}`,ib=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,rb=`#ifdef ENVMAP_TYPE_CUBE
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
}`,sb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ab=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ob=`#include <common>
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
}`,lb=`#if DEPTH_PACKING == 3200
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
}`,cb=`#define DISTANCE
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
}`,ub=`#define DISTANCE
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
}`,hb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,db=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,fb=`uniform float scale;
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
}`,pb=`uniform vec3 diffuse;
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
}`,Ab=`#include <common>
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
}`,mb=`uniform vec3 diffuse;
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
}`,gb=`#define LAMBERT
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
}`,_b=`#define LAMBERT
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
}`,Eb=`#define MATCAP
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
}`,vb=`#define MATCAP
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
}`,bb=`#define NORMAL
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
}`,xb=`#define NORMAL
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
}`,yb=`#define PHONG
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
}`,Mb=`#define PHONG
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
}`,Ib=`#define STANDARD
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
}`,Sb=`#define STANDARD
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
}`,Cb=`#define TOON
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
}`,wb=`#define TOON
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
}`,Tb=`uniform float size;
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
}`,Rb=`uniform vec3 diffuse;
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
}`,Bb=`#include <common>
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
}`,Lb=`uniform vec3 color;
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
}`,Db=`uniform float rotation;
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
}`,Pb=`uniform vec3 diffuse;
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
}`,Ge={alphahash_fragment:n0,alphahash_pars_fragment:i0,alphamap_fragment:r0,alphamap_pars_fragment:s0,alphatest_fragment:a0,alphatest_pars_fragment:o0,aomap_fragment:l0,aomap_pars_fragment:c0,batching_pars_vertex:u0,batching_vertex:h0,begin_vertex:d0,beginnormal_vertex:f0,bsdfs:p0,iridescence_fragment:A0,bumpmap_pars_fragment:m0,clipping_planes_fragment:g0,clipping_planes_pars_fragment:_0,clipping_planes_pars_vertex:E0,clipping_planes_vertex:v0,color_fragment:b0,color_pars_fragment:x0,color_pars_vertex:y0,color_vertex:M0,common:I0,cube_uv_reflection_fragment:S0,defaultnormal_vertex:C0,displacementmap_pars_vertex:w0,displacementmap_vertex:T0,emissivemap_fragment:R0,emissivemap_pars_fragment:B0,colorspace_fragment:L0,colorspace_pars_fragment:D0,envmap_fragment:P0,envmap_common_pars_fragment:U0,envmap_pars_fragment:N0,envmap_pars_vertex:F0,envmap_physical_pars_fragment:X0,envmap_vertex:O0,fog_vertex:k0,fog_pars_vertex:Q0,fog_fragment:H0,fog_pars_fragment:G0,gradientmap_pars_fragment:V0,lightmap_pars_fragment:z0,lights_lambert_fragment:W0,lights_lambert_pars_fragment:q0,lights_pars_begin:j0,lights_toon_fragment:Y0,lights_toon_pars_fragment:K0,lights_phong_fragment:J0,lights_phong_pars_fragment:Z0,lights_physical_fragment:$0,lights_physical_pars_fragment:ev,lights_fragment_begin:tv,lights_fragment_maps:nv,lights_fragment_end:iv,logdepthbuf_fragment:rv,logdepthbuf_pars_fragment:sv,logdepthbuf_pars_vertex:av,logdepthbuf_vertex:ov,map_fragment:lv,map_pars_fragment:cv,map_particle_fragment:uv,map_particle_pars_fragment:hv,metalnessmap_fragment:dv,metalnessmap_pars_fragment:fv,morphinstance_vertex:pv,morphcolor_vertex:Av,morphnormal_vertex:mv,morphtarget_pars_vertex:gv,morphtarget_vertex:_v,normal_fragment_begin:Ev,normal_fragment_maps:vv,normal_pars_fragment:bv,normal_pars_vertex:xv,normal_vertex:yv,normalmap_pars_fragment:Mv,clearcoat_normal_fragment_begin:Iv,clearcoat_normal_fragment_maps:Sv,clearcoat_pars_fragment:Cv,iridescence_pars_fragment:wv,opaque_fragment:Tv,packing:Rv,premultiplied_alpha_fragment:Bv,project_vertex:Lv,dithering_fragment:Dv,dithering_pars_fragment:Pv,roughnessmap_fragment:Uv,roughnessmap_pars_fragment:Nv,shadowmap_pars_fragment:Fv,shadowmap_pars_vertex:Ov,shadowmap_vertex:kv,shadowmask_pars_fragment:Qv,skinbase_vertex:Hv,skinning_pars_vertex:Gv,skinning_vertex:Vv,skinnormal_vertex:zv,specularmap_fragment:Wv,specularmap_pars_fragment:qv,tonemapping_fragment:jv,tonemapping_pars_fragment:Xv,transmission_fragment:Yv,transmission_pars_fragment:Kv,uv_pars_fragment:Jv,uv_pars_vertex:Zv,uv_vertex:$v,worldpos_vertex:eb,background_vert:tb,background_frag:nb,backgroundCube_vert:ib,backgroundCube_frag:rb,cube_vert:sb,cube_frag:ab,depth_vert:ob,depth_frag:lb,distanceRGBA_vert:cb,distanceRGBA_frag:ub,equirect_vert:hb,equirect_frag:db,linedashed_vert:fb,linedashed_frag:pb,meshbasic_vert:Ab,meshbasic_frag:mb,meshlambert_vert:gb,meshlambert_frag:_b,meshmatcap_vert:Eb,meshmatcap_frag:vb,meshnormal_vert:bb,meshnormal_frag:xb,meshphong_vert:yb,meshphong_frag:Mb,meshphysical_vert:Ib,meshphysical_frag:Sb,meshtoon_vert:Cb,meshtoon_frag:wb,points_vert:Tb,points_frag:Rb,shadow_vert:Bb,shadow_frag:Lb,sprite_vert:Db,sprite_frag:Pb},oe={common:{diffuse:{value:new be(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Le}},envmap:{envMap:{value:null},envMapRotation:{value:new Le},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Le}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Le}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Le},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Le},normalScale:{value:new we(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Le},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Le}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Le}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Le}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new be(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new be(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0},uvTransform:{value:new Le}},sprite:{diffuse:{value:new be(16777215)},opacity:{value:1},center:{value:new we(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Le},alphaMap:{value:null},alphaMapTransform:{value:new Le},alphaTest:{value:0}}},Tn={basic:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.fog]),vertexShader:Ge.meshbasic_vert,fragmentShader:Ge.meshbasic_frag},lambert:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new be(0)}}]),vertexShader:Ge.meshlambert_vert,fragmentShader:Ge.meshlambert_frag},phong:{uniforms:zt([oe.common,oe.specularmap,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,oe.lights,{emissive:{value:new be(0)},specular:{value:new be(1118481)},shininess:{value:30}}]),vertexShader:Ge.meshphong_vert,fragmentShader:Ge.meshphong_frag},standard:{uniforms:zt([oe.common,oe.envmap,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.roughnessmap,oe.metalnessmap,oe.fog,oe.lights,{emissive:{value:new be(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ge.meshphysical_vert,fragmentShader:Ge.meshphysical_frag},toon:{uniforms:zt([oe.common,oe.aomap,oe.lightmap,oe.emissivemap,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.gradientmap,oe.fog,oe.lights,{emissive:{value:new be(0)}}]),vertexShader:Ge.meshtoon_vert,fragmentShader:Ge.meshtoon_frag},matcap:{uniforms:zt([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,oe.fog,{matcap:{value:null}}]),vertexShader:Ge.meshmatcap_vert,fragmentShader:Ge.meshmatcap_frag},points:{uniforms:zt([oe.points,oe.fog]),vertexShader:Ge.points_vert,fragmentShader:Ge.points_frag},dashed:{uniforms:zt([oe.common,oe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ge.linedashed_vert,fragmentShader:Ge.linedashed_frag},depth:{uniforms:zt([oe.common,oe.displacementmap]),vertexShader:Ge.depth_vert,fragmentShader:Ge.depth_frag},normal:{uniforms:zt([oe.common,oe.bumpmap,oe.normalmap,oe.displacementmap,{opacity:{value:1}}]),vertexShader:Ge.meshnormal_vert,fragmentShader:Ge.meshnormal_frag},sprite:{uniforms:zt([oe.sprite,oe.fog]),vertexShader:Ge.sprite_vert,fragmentShader:Ge.sprite_frag},background:{uniforms:{uvTransform:{value:new Le},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ge.background_vert,fragmentShader:Ge.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Le}},vertexShader:Ge.backgroundCube_vert,fragmentShader:Ge.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ge.cube_vert,fragmentShader:Ge.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ge.equirect_vert,fragmentShader:Ge.equirect_frag},distanceRGBA:{uniforms:zt([oe.common,oe.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ge.distanceRGBA_vert,fragmentShader:Ge.distanceRGBA_frag},shadow:{uniforms:zt([oe.lights,oe.fog,{color:{value:new be(0)},opacity:{value:1}}]),vertexShader:Ge.shadow_vert,fragmentShader:Ge.shadow_frag}};Tn.physical={uniforms:zt([Tn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Le},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Le},clearcoatNormalScale:{value:new we(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Le},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Le},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Le},sheen:{value:0},sheenColor:{value:new be(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Le},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Le},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Le},transmissionSamplerSize:{value:new we},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Le},attenuationDistance:{value:0},attenuationColor:{value:new be(0)},specularColor:{value:new be(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Le},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Le},anisotropyVector:{value:new we},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Le}}]),vertexShader:Ge.meshphysical_vert,fragmentShader:Ge.meshphysical_frag};const La={r:0,b:0,g:0},Ei=new jt,Ub=new De;function Nb(n,e,t,i,r,s,a){const o=new be(0);let l=s===!0?0:1,c,u,h=null,d=0,p=null;function m(v){let _=v.isScene===!0?v.background:null;return _&&_.isTexture&&(_=(v.backgroundBlurriness>0?t:e).get(_)),_}function g(v){let _=!1;const b=m(v);b===null?f(o,l):b&&b.isColor&&(f(b,1),_=!0);const M=n.xr.getEnvironmentBlendMode();M==="additive"?i.buffers.color.setClear(0,0,0,1,a):M==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,a),(n.autoClear||_)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function A(v,_){const b=m(_);b&&(b.isCubeTexture||b.mapping===Mo)?(u===void 0&&(u=new Ke(new qn(1,1,1),new Kn({name:"BackgroundCubeMaterial",uniforms:Wr(Tn.backgroundCube.uniforms),vertexShader:Tn.backgroundCube.vertexShader,fragmentShader:Tn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(M,S,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),Ei.copy(_.backgroundRotation),Ei.x*=-1,Ei.y*=-1,Ei.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(Ei.y*=-1,Ei.z*=-1),u.material.uniforms.envMap.value=b,u.material.uniforms.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(Ub.makeRotationFromEuler(Ei)),u.material.toneMapped=Je.getTransfer(b.colorSpace)!==ht,(h!==b||d!==b.version||p!==n.toneMapping)&&(u.material.needsUpdate=!0,h=b,d=b.version,p=n.toneMapping),u.layers.enableAll(),v.unshift(u,u.geometry,u.material,0,0,null)):b&&b.isTexture&&(c===void 0&&(c=new Ke(new Kr(2,2),new Kn({name:"BackgroundMaterial",uniforms:Wr(Tn.background.uniforms),vertexShader:Tn.background.vertexShader,fragmentShader:Tn.background.fragmentShader,side:Yn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=b,c.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,c.material.toneMapped=Je.getTransfer(b.colorSpace)!==ht,b.matrixAutoUpdate===!0&&b.updateMatrix(),c.material.uniforms.uvTransform.value.copy(b.matrix),(h!==b||d!==b.version||p!==n.toneMapping)&&(c.material.needsUpdate=!0,h=b,d=b.version,p=n.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null))}function f(v,_){v.getRGB(La,Jf(n)),i.buffers.color.setClear(La.r,La.g,La.b,_,a)}function E(){u!==void 0&&(u.geometry.dispose(),u.material.dispose(),u=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(v,_=1){o.set(v),l=_,f(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(v){l=v,f(o,l)},render:g,addToRenderList:A,dispose:E}}function Fb(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=d(null);let s=r,a=!1;function o(y,T,N,D,P){let k=!1;const F=h(D,N,T);s!==F&&(s=F,c(s.object)),k=p(y,D,N,P),k&&m(y,D,N,P),P!==null&&e.update(P,n.ELEMENT_ARRAY_BUFFER),(k||a)&&(a=!1,_(y,T,N,D),P!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(P).buffer))}function l(){return n.createVertexArray()}function c(y){return n.bindVertexArray(y)}function u(y){return n.deleteVertexArray(y)}function h(y,T,N){const D=N.wireframe===!0;let P=i[y.id];P===void 0&&(P={},i[y.id]=P);let k=P[T.id];k===void 0&&(k={},P[T.id]=k);let F=k[D];return F===void 0&&(F=d(l()),k[D]=F),F}function d(y){const T=[],N=[],D=[];for(let P=0;P<t;P++)T[P]=0,N[P]=0,D[P]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:T,enabledAttributes:N,attributeDivisors:D,object:y,attributes:{},index:null}}function p(y,T,N,D){const P=s.attributes,k=T.attributes;let F=0;const G=N.getAttributes();for(const H in G)if(G[H].location>=0){const Z=P[H];let se=k[H];if(se===void 0&&(H==="instanceMatrix"&&y.instanceMatrix&&(se=y.instanceMatrix),H==="instanceColor"&&y.instanceColor&&(se=y.instanceColor)),Z===void 0||Z.attribute!==se||se&&Z.data!==se.data)return!0;F++}return s.attributesNum!==F||s.index!==D}function m(y,T,N,D){const P={},k=T.attributes;let F=0;const G=N.getAttributes();for(const H in G)if(G[H].location>=0){let Z=k[H];Z===void 0&&(H==="instanceMatrix"&&y.instanceMatrix&&(Z=y.instanceMatrix),H==="instanceColor"&&y.instanceColor&&(Z=y.instanceColor));const se={};se.attribute=Z,Z&&Z.data&&(se.data=Z.data),P[H]=se,F++}s.attributes=P,s.attributesNum=F,s.index=D}function g(){const y=s.newAttributes;for(let T=0,N=y.length;T<N;T++)y[T]=0}function A(y){f(y,0)}function f(y,T){const N=s.newAttributes,D=s.enabledAttributes,P=s.attributeDivisors;N[y]=1,D[y]===0&&(n.enableVertexAttribArray(y),D[y]=1),P[y]!==T&&(n.vertexAttribDivisor(y,T),P[y]=T)}function E(){const y=s.newAttributes,T=s.enabledAttributes;for(let N=0,D=T.length;N<D;N++)T[N]!==y[N]&&(n.disableVertexAttribArray(N),T[N]=0)}function v(y,T,N,D,P,k,F){F===!0?n.vertexAttribIPointer(y,T,N,P,k):n.vertexAttribPointer(y,T,N,D,P,k)}function _(y,T,N,D){g();const P=D.attributes,k=N.getAttributes(),F=T.defaultAttributeValues;for(const G in k){const H=k[G];if(H.location>=0){let ee=P[G];if(ee===void 0&&(G==="instanceMatrix"&&y.instanceMatrix&&(ee=y.instanceMatrix),G==="instanceColor"&&y.instanceColor&&(ee=y.instanceColor)),ee!==void 0){const Z=ee.normalized,se=ee.itemSize,pe=e.get(ee);if(pe===void 0)continue;const Ue=pe.buffer,qe=pe.type,Ve=pe.bytesPerElement,Y=qe===n.INT||qe===n.UNSIGNED_INT||ee.gpuType===nu;if(ee.isInterleavedBufferAttribute){const J=ee.data,de=J.stride,Ie=ee.offset;if(J.isInstancedInterleavedBuffer){for(let xe=0;xe<H.locationSize;xe++)f(H.location+xe,J.meshPerAttribute);y.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let xe=0;xe<H.locationSize;xe++)A(H.location+xe);n.bindBuffer(n.ARRAY_BUFFER,Ue);for(let xe=0;xe<H.locationSize;xe++)v(H.location+xe,se/H.locationSize,qe,Z,de*Ve,(Ie+se/H.locationSize*xe)*Ve,Y)}else{if(ee.isInstancedBufferAttribute){for(let J=0;J<H.locationSize;J++)f(H.location+J,ee.meshPerAttribute);y.isInstancedMesh!==!0&&D._maxInstanceCount===void 0&&(D._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let J=0;J<H.locationSize;J++)A(H.location+J);n.bindBuffer(n.ARRAY_BUFFER,Ue);for(let J=0;J<H.locationSize;J++)v(H.location+J,se/H.locationSize,qe,Z,se*Ve,se/H.locationSize*J*Ve,Y)}}else if(F!==void 0){const Z=F[G];if(Z!==void 0)switch(Z.length){case 2:n.vertexAttrib2fv(H.location,Z);break;case 3:n.vertexAttrib3fv(H.location,Z);break;case 4:n.vertexAttrib4fv(H.location,Z);break;default:n.vertexAttrib1fv(H.location,Z)}}}}E()}function b(){C();for(const y in i){const T=i[y];for(const N in T){const D=T[N];for(const P in D)u(D[P].object),delete D[P];delete T[N]}delete i[y]}}function M(y){if(i[y.id]===void 0)return;const T=i[y.id];for(const N in T){const D=T[N];for(const P in D)u(D[P].object),delete D[P];delete T[N]}delete i[y.id]}function S(y){for(const T in i){const N=i[T];if(N[y.id]===void 0)continue;const D=N[y.id];for(const P in D)u(D[P].object),delete D[P];delete N[y.id]}}function C(){I(),a=!0,s!==r&&(s=r,c(s.object))}function I(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:C,resetDefaultState:I,dispose:b,releaseStatesOfGeometry:M,releaseStatesOfProgram:S,initAttributes:g,enableAttribute:A,disableUnusedAttributes:E}}function Ob(n,e,t){let i;function r(c){i=c}function s(c,u){n.drawArrays(i,c,u),t.update(u,i,1)}function a(c,u,h){h!==0&&(n.drawArraysInstanced(i,c,u,h),t.update(u,i,h))}function o(c,u,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,u,0,h);let p=0;for(let m=0;m<h;m++)p+=u[m];t.update(p,i,1)}function l(c,u,h,d){if(h===0)return;const p=e.get("WEBGL_multi_draw");if(p===null)for(let m=0;m<c.length;m++)a(c[m],u[m],d[m]);else{p.multiDrawArraysInstancedWEBGL(i,c,0,u,0,d,0,h);let m=0;for(let g=0;g<h;g++)m+=u[g]*d[g];t.update(m,i,1)}}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function kb(n,e,t,i){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){const S=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(S.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(S){return!(S!==Pt&&i.convert(S)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(S){const C=S===hn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(S!==We&&i.convert(S)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&S!==kt&&!C)}function l(S){if(S==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";S="mediump"}return S==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const h=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),p=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),m=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_TEXTURE_SIZE),A=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),f=n.getParameter(n.MAX_VERTEX_ATTRIBS),E=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),v=n.getParameter(n.MAX_VARYING_VECTORS),_=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),b=m>0,M=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:d,maxTextures:p,maxVertexTextures:m,maxTextureSize:g,maxCubemapSize:A,maxAttributes:f,maxVertexUniforms:E,maxVaryings:v,maxFragmentUniforms:_,vertexTextures:b,maxSamples:M}}function Qb(n){const e=this;let t=null,i=0,r=!1,s=!1;const a=new Ii,o=new Le,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){const p=h.length!==0||d||i!==0||r;return r=d,i=h.length,p},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,p){const m=h.clippingPlanes,g=h.clipIntersection,A=h.clipShadows,f=n.get(h);if(!r||m===null||m.length===0||s&&!A)s?u(null):c();else{const E=s?0:i,v=E*4;let _=f.clippingState||null;l.value=_,_=u(m,d,v,p);for(let b=0;b!==v;++b)_[b]=t[b];f.clippingState=_,this.numIntersection=g?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(h,d,p,m){const g=h!==null?h.length:0;let A=null;if(g!==0){if(A=l.value,m!==!0||A===null){const f=p+g*4,E=d.matrixWorldInverse;o.getNormalMatrix(E),(A===null||A.length<f)&&(A=new Float32Array(f));for(let v=0,_=p;v!==g;++v,_+=4)a.copy(h[v]).applyMatrix4(E,o),a.normal.toArray(A,_),A[_+3]=a.constant}l.value=A,l.needsUpdate=!0}return e.numPlanes=g,e.numIntersection=0,A}}function Hb(n){let e=new WeakMap;function t(a,o){return o===mc?a.mapping=Qi:o===gc&&(a.mapping=Hr),a}function i(a){if(a&&a.isTexture){const o=a.mapping;if(o===mc||o===gc)if(e.has(a)){const l=e.get(a).texture;return t(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new lE(l.height);return c.fromEquirectangularTexture(n,a),e.set(a,c),a.addEventListener("dispose",r),t(c.texture,a.mapping)}else return null}}return a}function r(a){const o=a.target;o.removeEventListener("dispose",r);const l=e.get(o);l!==void 0&&(e.delete(o),l.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}const Br=4,Gh=[.125,.215,.35,.446,.526,.582],wi=20,yl=new Uo,Vh=new be;let Ml=null,Il=0,Sl=0,Cl=!1;const Si=(1+Math.sqrt(5))/2,br=1/Si,zh=[new R(-Si,br,0),new R(Si,br,0),new R(-br,0,Si),new R(br,0,Si),new R(0,Si,-br),new R(0,Si,br),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)],Gb=new R;class Wh{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100,s={}){const{size:a=256,position:o=Gb}=s;Ml=this._renderer.getRenderTarget(),Il=this._renderer.getActiveCubeFace(),Sl=this._renderer.getActiveMipmapLevel(),Cl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,r,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Xh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=jh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Ml,Il,Sl),this._renderer.xr.enabled=Cl,e.scissorTest=!1,Da(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Qi||e.mapping===Hr?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ml=this._renderer.getRenderTarget(),Il=this._renderer.getActiveCubeFace(),Sl=this._renderer.getActiveMipmapLevel(),Cl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Ut,minFilter:Ut,generateMipmaps:!1,type:hn,format:Pt,colorSpace:Qt,depthBuffer:!1},r=qh(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=qh(e,t,i);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Vb(s)),this._blurMaterial=zb(s,e,t)}return r}_compileMaterial(e){const t=new Ke(this._lodPlanes[0],e);this._renderer.compile(t,yl)}_sceneToCubeUV(e,t,i,r,s){const l=new Wt(90,1,t,i),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,p=h.toneMapping;h.getClearColor(Vh),h.toneMapping=li,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(r),h.clearDepth(),h.setRenderTarget(null));const g=new Kt({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1}),A=new Ke(new qn,g);let f=!1;const E=e.background;E?E.isColor&&(g.color.copy(E),e.background=null,f=!0):(g.color.copy(Vh),f=!0);for(let v=0;v<6;v++){const _=v%3;_===0?(l.up.set(0,c[v],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+u[v],s.y,s.z)):_===1?(l.up.set(0,0,c[v]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+u[v],s.z)):(l.up.set(0,c[v],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+u[v]));const b=this._cubeSize;Da(r,_*b,v>2?b:0,b,b),h.setRenderTarget(r),f&&h.render(A,l),h.render(e,l)}A.geometry.dispose(),A.material.dispose(),h.toneMapping=p,h.autoClear=d,e.background=E}_textureToCubeUV(e,t){const i=this._renderer,r=e.mapping===Qi||e.mapping===Hr;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Xh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=jh());const s=r?this._cubemapMaterial:this._equirectMaterial,a=new Ke(this._lodPlanes[0],s),o=s.uniforms;o.envMap.value=e;const l=this._cubeSize;Da(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(a,yl)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodPlanes.length;for(let s=1;s<r;s++){const a=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),o=zh[(r-s-1)%zh.length];this._blur(e,s-1,s,a,o)}t.autoClear=i}_blur(e,t,i,r,s){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,i,r,"latitudinal",s),this._halfBlur(a,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,h=new Ke(this._lodPlanes[r],c),d=c.uniforms,p=this._sizeLods[i]-1,m=isFinite(s)?Math.PI/(2*p):2*Math.PI/(2*wi-1),g=s/m,A=isFinite(s)?1+Math.floor(u*g):wi;A>wi&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${A} samples when the maximum is set to ${wi}`);const f=[];let E=0;for(let S=0;S<wi;++S){const C=S/g,I=Math.exp(-C*C/2);f.push(I),S===0?E+=I:S<A&&(E+=2*I)}for(let S=0;S<f.length;S++)f[S]=f[S]/E;d.envMap.value=e.texture,d.samples.value=A,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:v}=this;d.dTheta.value=m,d.mipInt.value=v-i;const _=this._sizeLods[r],b=3*_*(r>v-Br?r-v+Br:0),M=4*(this._cubeSize-_);Da(t,b,M,3*_,2*_),l.setRenderTarget(t),l.render(h,yl)}}function Vb(n){const e=[],t=[],i=[];let r=n;const s=n-Br+1+Gh.length;for(let a=0;a<s;a++){const o=Math.pow(2,r);t.push(o);let l=1/o;a>n-Br?l=Gh[a-n+Br-1]:a===0&&(l=0),i.push(l);const c=1/(o-2),u=-c,h=1+c,d=[u,u,h,u,h,h,u,u,h,h,u,h],p=6,m=6,g=3,A=2,f=1,E=new Float32Array(g*m*p),v=new Float32Array(A*m*p),_=new Float32Array(f*m*p);for(let M=0;M<p;M++){const S=M%3*2/3-1,C=M>2?0:-1,I=[S,C,0,S+2/3,C,0,S+2/3,C+1,0,S,C,0,S+2/3,C+1,0,S,C+1,0];E.set(I,g*m*M),v.set(d,A*m*M);const y=[M,M,M,M,M,M];_.set(y,f*m*M)}const b=new dt;b.setAttribute("position",new tt(E,g)),b.setAttribute("uv",new tt(v,A)),b.setAttribute("faceIndex",new tt(_,f)),e.push(b),r>Br&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function qh(n,e,t){const i=new Vi(n,e,t);return i.texture.mapping=Mo,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Da(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function zb(n,e,t){const i=new Float32Array(wi),r=new R(0,1,0);return new Kn({name:"SphericalGaussianBlur",defines:{n:wi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:xu(),fragmentShader:`

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
		`,blending:oi,depthTest:!1,depthWrite:!1})}function jh(){return new Kn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:xu(),fragmentShader:`

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
		`,blending:oi,depthTest:!1,depthWrite:!1})}function Xh(){return new Kn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:xu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:oi,depthTest:!1,depthWrite:!1})}function xu(){return`

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
	`}function Wb(n){let e=new WeakMap,t=null;function i(o){if(o&&o.isTexture){const l=o.mapping,c=l===mc||l===gc,u=l===Qi||l===Hr;if(c||u){let h=e.get(o);const d=h!==void 0?h.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return t===null&&(t=new Wh(n)),h=c?t.fromEquirectangular(o,h):t.fromCubemap(o,h),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),h.texture;if(h!==void 0)return h.texture;{const p=o.image;return c&&p&&p.height>0||u&&p&&r(p)?(t===null&&(t=new Wh(n)),h=c?t.fromEquirectangular(o):t.fromCubemap(o),h.texture.pmremVersion=o.pmremVersion,e.set(o,h),o.addEventListener("dispose",s),h.texture):null}}}return o}function r(o){let l=0;const c=6;for(let u=0;u<c;u++)o[u]!==void 0&&l++;return l===c}function s(o){const l=o.target;l.removeEventListener("dispose",s);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function a(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:a}}function qb(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&Ks("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function jb(n,e,t,i){const r={},s=new WeakMap;function a(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const m in d.attributes)e.remove(d.attributes[m]);d.removeEventListener("dispose",a),delete r[d.id];const p=s.get(d);p&&(e.remove(p),s.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(h,d){return r[d.id]===!0||(d.addEventListener("dispose",a),r[d.id]=!0,t.memory.geometries++),d}function l(h){const d=h.attributes;for(const p in d)e.update(d[p],n.ARRAY_BUFFER)}function c(h){const d=[],p=h.index,m=h.attributes.position;let g=0;if(p!==null){const E=p.array;g=p.version;for(let v=0,_=E.length;v<_;v+=3){const b=E[v+0],M=E[v+1],S=E[v+2];d.push(b,M,M,S,S,b)}}else if(m!==void 0){const E=m.array;g=m.version;for(let v=0,_=E.length/3-1;v<_;v+=3){const b=v+0,M=v+1,S=v+2;d.push(b,M,M,S,S,b)}}else return;const A=new(zf(d)?Kf:Yf)(d,1);A.version=g;const f=s.get(h);f&&e.remove(f),s.set(h,A)}function u(h){const d=s.get(h);if(d){const p=h.index;p!==null&&d.version<p.version&&c(h)}else c(h);return s.get(h)}return{get:o,update:l,getWireframeAttribute:u}}function Xb(n,e,t){let i;function r(d){i=d}let s,a;function o(d){s=d.type,a=d.bytesPerElement}function l(d,p){n.drawElements(i,p,s,d*a),t.update(p,i,1)}function c(d,p,m){m!==0&&(n.drawElementsInstanced(i,p,s,d*a,m),t.update(p,i,m))}function u(d,p,m){if(m===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,p,0,s,d,0,m);let A=0;for(let f=0;f<m;f++)A+=p[f];t.update(A,i,1)}function h(d,p,m,g){if(m===0)return;const A=e.get("WEBGL_multi_draw");if(A===null)for(let f=0;f<d.length;f++)c(d[f]/a,p[f],g[f]);else{A.multiDrawElementsInstancedWEBGL(i,p,0,s,d,0,g,0,m);let f=0;for(let E=0;E<m;E++)f+=p[E]*g[E];t.update(f,i,1)}}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=h}function Yb(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,a,o){switch(t.calls++,a){case n.TRIANGLES:t.triangles+=o*(s/3);break;case n.LINES:t.lines+=o*(s/2);break;case n.LINE_STRIP:t.lines+=o*(s-1);break;case n.LINE_LOOP:t.lines+=o*s;break;case n.POINTS:t.points+=o*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function Kb(n,e,t){const i=new WeakMap,r=new nt;function s(a,o,l){const c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=u!==void 0?u.length:0;let d=i.get(o);if(d===void 0||d.count!==h){let I=function(){S.dispose(),i.delete(o),o.removeEventListener("dispose",I)};d!==void 0&&d.texture.dispose();const p=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,g=o.morphAttributes.color!==void 0,A=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],E=o.morphAttributes.color||[];let v=0;p===!0&&(v=1),m===!0&&(v=2),g===!0&&(v=3);let _=o.attributes.position.count*v,b=1;_>e.maxTextureSize&&(b=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);const M=new Float32Array(_*b*4*h),S=new Wf(M,_,b,h);S.type=kt,S.needsUpdate=!0;const C=v*4;for(let y=0;y<h;y++){const T=A[y],N=f[y],D=E[y],P=_*b*4*y;for(let k=0;k<T.count;k++){const F=k*C;p===!0&&(r.fromBufferAttribute(T,k),M[P+F+0]=r.x,M[P+F+1]=r.y,M[P+F+2]=r.z,M[P+F+3]=0),m===!0&&(r.fromBufferAttribute(N,k),M[P+F+4]=r.x,M[P+F+5]=r.y,M[P+F+6]=r.z,M[P+F+7]=0),g===!0&&(r.fromBufferAttribute(D,k),M[P+F+8]=r.x,M[P+F+9]=r.y,M[P+F+10]=r.z,M[P+F+11]=D.itemSize===4?r.w:1)}}d={count:h,texture:S,size:new we(_,b)},i.set(o,d),o.addEventListener("dispose",I)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",a.morphTexture,t);else{let p=0;for(let g=0;g<c.length;g++)p+=c[g];const m=o.morphTargetsRelative?1:1-p;l.getUniforms().setValue(n,"morphTargetBaseInfluence",m),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:s}}function Jb(n,e,t,i){let r=new WeakMap;function s(l){const c=i.render.frame,u=l.geometry,h=e.get(l,u);if(r.get(h)!==c&&(e.update(h),r.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),r.get(l)!==c&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;r.get(d)!==c&&(d.update(),r.set(d,c))}return h}function a(){r=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:s,dispose:a}}const Ap=new Tt,Yh=new ap(1,1),mp=new Wf,gp=new qf,_p=new ep,Kh=[],Jh=[],Zh=new Float32Array(16),$h=new Float32Array(9),ed=new Float32Array(4);function $r(n,e,t){const i=n[0];if(i<=0||i>0)return n;const r=e*t;let s=Kh[r];if(s===void 0&&(s=new Float32Array(r),Kh[r]=s),e!==0){i.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,n[a].toArray(s,o)}return s}function Bt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Lt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function No(n,e){let t=Jh[e];t===void 0&&(t=new Int32Array(e),Jh[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function Zb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function $b(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2fv(this.addr,e),Lt(t,e)}}function ex(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Bt(t,e))return;n.uniform3fv(this.addr,e),Lt(t,e)}}function tx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4fv(this.addr,e),Lt(t,e)}}function nx(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;ed.set(i),n.uniformMatrix2fv(this.addr,!1,ed),Lt(t,i)}}function ix(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;$h.set(i),n.uniformMatrix3fv(this.addr,!1,$h),Lt(t,i)}}function rx(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(Bt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Lt(t,e)}else{if(Bt(t,i))return;Zh.set(i),n.uniformMatrix4fv(this.addr,!1,Zh),Lt(t,i)}}function sx(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function ax(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2iv(this.addr,e),Lt(t,e)}}function ox(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3iv(this.addr,e),Lt(t,e)}}function lx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4iv(this.addr,e),Lt(t,e)}}function cx(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function ux(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Bt(t,e))return;n.uniform2uiv(this.addr,e),Lt(t,e)}}function hx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Bt(t,e))return;n.uniform3uiv(this.addr,e),Lt(t,e)}}function dx(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Bt(t,e))return;n.uniform4uiv(this.addr,e),Lt(t,e)}}function fx(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Yh.compareFunction=Vf,s=Yh):s=Ap,t.setTexture2D(e||s,r)}function px(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||gp,r)}function Ax(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||_p,r)}function mx(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||mp,r)}function gx(n){switch(n){case 5126:return Zb;case 35664:return $b;case 35665:return ex;case 35666:return tx;case 35674:return nx;case 35675:return ix;case 35676:return rx;case 5124:case 35670:return sx;case 35667:case 35671:return ax;case 35668:case 35672:return ox;case 35669:case 35673:return lx;case 5125:return cx;case 36294:return ux;case 36295:return hx;case 36296:return dx;case 35678:case 36198:case 36298:case 36306:case 35682:return fx;case 35679:case 36299:case 36307:return px;case 35680:case 36300:case 36308:case 36293:return Ax;case 36289:case 36303:case 36311:case 36292:return mx}}function _x(n,e){n.uniform1fv(this.addr,e)}function Ex(n,e){const t=$r(e,this.size,2);n.uniform2fv(this.addr,t)}function vx(n,e){const t=$r(e,this.size,3);n.uniform3fv(this.addr,t)}function bx(n,e){const t=$r(e,this.size,4);n.uniform4fv(this.addr,t)}function xx(n,e){const t=$r(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function yx(n,e){const t=$r(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Mx(n,e){const t=$r(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Ix(n,e){n.uniform1iv(this.addr,e)}function Sx(n,e){n.uniform2iv(this.addr,e)}function Cx(n,e){n.uniform3iv(this.addr,e)}function wx(n,e){n.uniform4iv(this.addr,e)}function Tx(n,e){n.uniform1uiv(this.addr,e)}function Rx(n,e){n.uniform2uiv(this.addr,e)}function Bx(n,e){n.uniform3uiv(this.addr,e)}function Lx(n,e){n.uniform4uiv(this.addr,e)}function Dx(n,e,t){const i=this.cache,r=e.length,s=No(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture2D(e[a]||Ap,s[a])}function Px(n,e,t){const i=this.cache,r=e.length,s=No(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture3D(e[a]||gp,s[a])}function Ux(n,e,t){const i=this.cache,r=e.length,s=No(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTextureCube(e[a]||_p,s[a])}function Nx(n,e,t){const i=this.cache,r=e.length,s=No(t,r);Bt(i,s)||(n.uniform1iv(this.addr,s),Lt(i,s));for(let a=0;a!==r;++a)t.setTexture2DArray(e[a]||mp,s[a])}function Fx(n){switch(n){case 5126:return _x;case 35664:return Ex;case 35665:return vx;case 35666:return bx;case 35674:return xx;case 35675:return yx;case 35676:return Mx;case 5124:case 35670:return Ix;case 35667:case 35671:return Sx;case 35668:case 35672:return Cx;case 35669:case 35673:return wx;case 5125:return Tx;case 36294:return Rx;case 36295:return Bx;case 36296:return Lx;case 35678:case 36198:case 36298:case 36306:case 35682:return Dx;case 35679:case 36299:case 36307:return Px;case 35680:case 36300:case 36308:case 36293:return Ux;case 36289:case 36303:case 36311:case 36292:return Nx}}class Ox{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=gx(t.type)}}class kx{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Fx(t.type)}}class Qx{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const r=this.seq;for(let s=0,a=r.length;s!==a;++s){const o=r[s];o.setValue(e,t[o.id],i)}}}const wl=/(\w+)(\])?(\[|\.)?/g;function td(n,e){n.seq.push(e),n.map[e.id]=e}function Hx(n,e,t){const i=n.name,r=i.length;for(wl.lastIndex=0;;){const s=wl.exec(i),a=wl.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){td(t,c===void 0?new Ox(o,n,e):new kx(o,n,e));break}else{let h=t.map[o];h===void 0&&(h=new Qx(o),td(t,h)),t=h}}}class ja{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){const s=e.getActiveUniform(t,r),a=e.getUniformLocation(t,s.name);Hx(s,a,this)}}setValue(e,t,i,r){const s=this.map[t];s!==void 0&&s.setValue(e,i,r)}setOptional(e,t,i){const r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let s=0,a=t.length;s!==a;++s){const o=t[s],l=i[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){const i=[];for(let r=0,s=e.length;r!==s;++r){const a=e[r];a.id in t&&i.push(a)}return i}}function nd(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const Gx=37297;let Vx=0;function zx(n,e){const t=n.split(`
`),i=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=r;a<s;a++){const o=a+1;i.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return i.join(`
`)}const id=new Le;function Wx(n){Je._getMatrix(id,Je.workingColorSpace,n);const e=`mat3( ${id.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(n)){case fo:return[e,"LinearTransferOETF"];case ht:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function rd(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),s=(n.getShaderInfoLog(e)||"").trim();if(i&&s==="")return"";const a=/ERROR: 0:(\d+)/.exec(s);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+zx(n.getShaderSource(e),o)}else return s}function qx(n,e){const t=Wx(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function jx(n,e){let t;switch(e){case e_:t="Linear";break;case t_:t="Reinhard";break;case n_:t="Cineon";break;case i_:t="ACESFilmic";break;case s_:t="AgX";break;case a_:t="Neutral";break;case r_:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Pa=new R;function Xx(){Je.getLuminanceCoefficients(Pa);const n=Pa.x.toFixed(4),e=Pa.y.toFixed(4),t=Pa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Yx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ts).join(`
`)}function Kx(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Jx(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=n.getActiveAttrib(e,r),a=s.name;let o=1;s.type===n.FLOAT_MAT2&&(o=2),s.type===n.FLOAT_MAT3&&(o=3),s.type===n.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:n.getAttribLocation(e,a),locationSize:o}}return t}function Ts(n){return n!==""}function sd(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ad(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Zx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Fc(n){return n.replace(Zx,ey)}const $x=new Map;function ey(n,e){let t=Ge[e];if(t===void 0){const i=$x.get(e);if(i!==void 0)t=Ge[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return Fc(t)}const ty=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function od(n){return n.replace(ty,ny)}function ny(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function ld(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}function iy(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===Ff?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===Dg?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Vn&&(e="SHADOWMAP_TYPE_VSM"),e}function ry(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Qi:case Hr:e="ENVMAP_TYPE_CUBE";break;case Mo:e="ENVMAP_TYPE_CUBE_UV";break}return e}function sy(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Hr:e="ENVMAP_MODE_REFRACTION";break}return e}function ay(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case eu:e="ENVMAP_BLENDING_MULTIPLY";break;case Zg:e="ENVMAP_BLENDING_MIX";break;case $g:e="ENVMAP_BLENDING_ADD";break}return e}function oy(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function ly(n,e,t,i){const r=n.getContext(),s=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=iy(t),c=ry(t),u=sy(t),h=ay(t),d=oy(t),p=Yx(t),m=Kx(s),g=r.createProgram();let A,f,E=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(A=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(Ts).join(`
`),A.length>0&&(A+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(Ts).join(`
`),f.length>0&&(f+=`
`)):(A=[ld(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ts).join(`
`),f=[ld(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==li?"#define TONE_MAPPING":"",t.toneMapping!==li?Ge.tonemapping_pars_fragment:"",t.toneMapping!==li?jx("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ge.colorspace_pars_fragment,qx("linearToOutputTexel",t.outputColorSpace),Xx(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ts).join(`
`)),a=Fc(a),a=sd(a,t),a=ad(a,t),o=Fc(o),o=sd(o,t),o=ad(o,t),a=od(a),o=od(o),t.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,A=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+A,f=["#define varying in",t.glslVersion===eh?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===eh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const v=E+A+a,_=E+f+o,b=nd(r,r.VERTEX_SHADER,v),M=nd(r,r.FRAGMENT_SHADER,_);r.attachShader(g,b),r.attachShader(g,M),t.index0AttributeName!==void 0?r.bindAttribLocation(g,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(g,0,"position"),r.linkProgram(g);function S(T){if(n.debug.checkShaderErrors){const N=r.getProgramInfoLog(g)||"",D=r.getShaderInfoLog(b)||"",P=r.getShaderInfoLog(M)||"",k=N.trim(),F=D.trim(),G=P.trim();let H=!0,ee=!0;if(r.getProgramParameter(g,r.LINK_STATUS)===!1)if(H=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,g,b,M);else{const Z=rd(r,b,"vertex"),se=rd(r,M,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(g,r.VALIDATE_STATUS)+`

Material Name: `+T.name+`
Material Type: `+T.type+`

Program Info Log: `+k+`
`+Z+`
`+se)}else k!==""?console.warn("THREE.WebGLProgram: Program Info Log:",k):(F===""||G==="")&&(ee=!1);ee&&(T.diagnostics={runnable:H,programLog:k,vertexShader:{log:F,prefix:A},fragmentShader:{log:G,prefix:f}})}r.deleteShader(b),r.deleteShader(M),C=new ja(r,g),I=Jx(r,g)}let C;this.getUniforms=function(){return C===void 0&&S(this),C};let I;this.getAttributes=function(){return I===void 0&&S(this),I};let y=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=r.getProgramParameter(g,Gx)),y},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(g),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Vx++,this.cacheKey=e,this.usedTimes=1,this.program=g,this.vertexShader=b,this.fragmentShader=M,this}let cy=0;class uy{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(i),a=this._getShaderCacheForMaterial(e);return a.has(r)===!1&&(a.add(r),r.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new hy(e),t.set(e,i)),i}}class hy{constructor(e){this.id=cy++,this.code=e,this.usedTimes=0}}function dy(n,e,t,i,r,s,a){const o=new jf,l=new uy,c=new Set,u=[],h=r.logarithmicDepthBuffer,d=r.vertexTextures;let p=r.precision;const m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(I){return c.add(I),I===0?"uv":`uv${I}`}function A(I,y,T,N,D){const P=N.fog,k=D.geometry,F=I.isMeshStandardMaterial?N.environment:null,G=(I.isMeshStandardMaterial?t:e).get(I.envMap||F),H=G&&G.mapping===Mo?G.image.height:null,ee=m[I.type];I.precision!==null&&(p=r.getMaxPrecision(I.precision),p!==I.precision&&console.warn("THREE.WebGLProgram.getParameters:",I.precision,"not supported, using",p,"instead."));const Z=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,se=Z!==void 0?Z.length:0;let pe=0;k.morphAttributes.position!==void 0&&(pe=1),k.morphAttributes.normal!==void 0&&(pe=2),k.morphAttributes.color!==void 0&&(pe=3);let Ue,qe,Ve,Y;if(ee){const Ze=Tn[ee];Ue=Ze.vertexShader,qe=Ze.fragmentShader}else Ue=I.vertexShader,qe=I.fragmentShader,l.update(I),Ve=l.getVertexShaderID(I),Y=l.getFragmentShaderID(I);const J=n.getRenderTarget(),de=n.state.buffers.depth.getReversed(),Ie=D.isInstancedMesh===!0,xe=D.isBatchedMesh===!0,ze=!!I.map,St=!!I.matcap,U=!!G,at=!!I.aoMap,Ne=!!I.lightMap,Te=!!I.bumpMap,_e=!!I.normalMap,ot=!!I.displacementMap,Ee=!!I.emissiveMap,ke=!!I.metalnessMap,Et=!!I.roughnessMap,_t=I.anisotropy>0,B=I.clearcoat>0,x=I.dispersion>0,L=I.iridescence>0,Q=I.sheen>0,j=I.transmission>0,W=_t&&!!I.anisotropyMap,fe=B&&!!I.clearcoatMap,$=B&&!!I.clearcoatNormalMap,me=B&&!!I.clearcoatRoughnessMap,Ae=L&&!!I.iridescenceMap,ie=L&&!!I.iridescenceThicknessMap,ce=Q&&!!I.sheenColorMap,Se=Q&&!!I.sheenRoughnessMap,ye=!!I.specularMap,le=!!I.specularColorMap,Re=!!I.specularIntensityMap,O=j&&!!I.transmissionMap,te=j&&!!I.thicknessMap,ae=!!I.gradientMap,ue=!!I.alphaMap,ne=I.alphaTest>0,K=!!I.alphaHash,ve=!!I.extensions;let Qe=li;I.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(Qe=n.toneMapping);const it={shaderID:ee,shaderType:I.type,shaderName:I.name,vertexShader:Ue,fragmentShader:qe,defines:I.defines,customVertexShaderID:Ve,customFragmentShaderID:Y,isRawShaderMaterial:I.isRawShaderMaterial===!0,glslVersion:I.glslVersion,precision:p,batching:xe,batchingColor:xe&&D._colorsTexture!==null,instancing:Ie,instancingColor:Ie&&D.instanceColor!==null,instancingMorph:Ie&&D.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:J===null?n.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Qt,alphaToCoverage:!!I.alphaToCoverage,map:ze,matcap:St,envMap:U,envMapMode:U&&G.mapping,envMapCubeUVHeight:H,aoMap:at,lightMap:Ne,bumpMap:Te,normalMap:_e,displacementMap:d&&ot,emissiveMap:Ee,normalMapObjectSpace:_e&&I.normalMapType===A_,normalMapTangentSpace:_e&&I.normalMapType===Co,metalnessMap:ke,roughnessMap:Et,anisotropy:_t,anisotropyMap:W,clearcoat:B,clearcoatMap:fe,clearcoatNormalMap:$,clearcoatRoughnessMap:me,dispersion:x,iridescence:L,iridescenceMap:Ae,iridescenceThicknessMap:ie,sheen:Q,sheenColorMap:ce,sheenRoughnessMap:Se,specularMap:ye,specularColorMap:le,specularIntensityMap:Re,transmission:j,transmissionMap:O,thicknessMap:te,gradientMap:ae,opaque:I.transparent===!1&&I.blending===Dr&&I.alphaToCoverage===!1,alphaMap:ue,alphaTest:ne,alphaHash:K,combine:I.combine,mapUv:ze&&g(I.map.channel),aoMapUv:at&&g(I.aoMap.channel),lightMapUv:Ne&&g(I.lightMap.channel),bumpMapUv:Te&&g(I.bumpMap.channel),normalMapUv:_e&&g(I.normalMap.channel),displacementMapUv:ot&&g(I.displacementMap.channel),emissiveMapUv:Ee&&g(I.emissiveMap.channel),metalnessMapUv:ke&&g(I.metalnessMap.channel),roughnessMapUv:Et&&g(I.roughnessMap.channel),anisotropyMapUv:W&&g(I.anisotropyMap.channel),clearcoatMapUv:fe&&g(I.clearcoatMap.channel),clearcoatNormalMapUv:$&&g(I.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:me&&g(I.clearcoatRoughnessMap.channel),iridescenceMapUv:Ae&&g(I.iridescenceMap.channel),iridescenceThicknessMapUv:ie&&g(I.iridescenceThicknessMap.channel),sheenColorMapUv:ce&&g(I.sheenColorMap.channel),sheenRoughnessMapUv:Se&&g(I.sheenRoughnessMap.channel),specularMapUv:ye&&g(I.specularMap.channel),specularColorMapUv:le&&g(I.specularColorMap.channel),specularIntensityMapUv:Re&&g(I.specularIntensityMap.channel),transmissionMapUv:O&&g(I.transmissionMap.channel),thicknessMapUv:te&&g(I.thicknessMap.channel),alphaMapUv:ue&&g(I.alphaMap.channel),vertexTangents:!!k.attributes.tangent&&(_e||_t),vertexColors:I.vertexColors,vertexAlphas:I.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!k.attributes.uv&&(ze||ue),fog:!!P,useFog:I.fog===!0,fogExp2:!!P&&P.isFogExp2,flatShading:I.flatShading===!0&&I.wireframe===!1,sizeAttenuation:I.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:de,skinning:D.isSkinnedMesh===!0,morphTargets:k.morphAttributes.position!==void 0,morphNormals:k.morphAttributes.normal!==void 0,morphColors:k.morphAttributes.color!==void 0,morphTargetsCount:se,morphTextureStride:pe,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:I.dithering,shadowMapEnabled:n.shadowMap.enabled&&T.length>0,shadowMapType:n.shadowMap.type,toneMapping:Qe,decodeVideoTexture:ze&&I.map.isVideoTexture===!0&&Je.getTransfer(I.map.colorSpace)===ht,decodeVideoTextureEmissive:Ee&&I.emissiveMap.isVideoTexture===!0&&Je.getTransfer(I.emissiveMap.colorSpace)===ht,premultipliedAlpha:I.premultipliedAlpha,doubleSided:I.side===tn,flipSided:I.side===qt,useDepthPacking:I.depthPacking>=0,depthPacking:I.depthPacking||0,index0AttributeName:I.index0AttributeName,extensionClipCullDistance:ve&&I.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ve&&I.extensions.multiDraw===!0||xe)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:I.customProgramCacheKey()};return it.vertexUv1s=c.has(1),it.vertexUv2s=c.has(2),it.vertexUv3s=c.has(3),c.clear(),it}function f(I){const y=[];if(I.shaderID?y.push(I.shaderID):(y.push(I.customVertexShaderID),y.push(I.customFragmentShaderID)),I.defines!==void 0)for(const T in I.defines)y.push(T),y.push(I.defines[T]);return I.isRawShaderMaterial===!1&&(E(y,I),v(y,I),y.push(n.outputColorSpace)),y.push(I.customProgramCacheKey),y.join()}function E(I,y){I.push(y.precision),I.push(y.outputColorSpace),I.push(y.envMapMode),I.push(y.envMapCubeUVHeight),I.push(y.mapUv),I.push(y.alphaMapUv),I.push(y.lightMapUv),I.push(y.aoMapUv),I.push(y.bumpMapUv),I.push(y.normalMapUv),I.push(y.displacementMapUv),I.push(y.emissiveMapUv),I.push(y.metalnessMapUv),I.push(y.roughnessMapUv),I.push(y.anisotropyMapUv),I.push(y.clearcoatMapUv),I.push(y.clearcoatNormalMapUv),I.push(y.clearcoatRoughnessMapUv),I.push(y.iridescenceMapUv),I.push(y.iridescenceThicknessMapUv),I.push(y.sheenColorMapUv),I.push(y.sheenRoughnessMapUv),I.push(y.specularMapUv),I.push(y.specularColorMapUv),I.push(y.specularIntensityMapUv),I.push(y.transmissionMapUv),I.push(y.thicknessMapUv),I.push(y.combine),I.push(y.fogExp2),I.push(y.sizeAttenuation),I.push(y.morphTargetsCount),I.push(y.morphAttributeCount),I.push(y.numDirLights),I.push(y.numPointLights),I.push(y.numSpotLights),I.push(y.numSpotLightMaps),I.push(y.numHemiLights),I.push(y.numRectAreaLights),I.push(y.numDirLightShadows),I.push(y.numPointLightShadows),I.push(y.numSpotLightShadows),I.push(y.numSpotLightShadowsWithMaps),I.push(y.numLightProbes),I.push(y.shadowMapType),I.push(y.toneMapping),I.push(y.numClippingPlanes),I.push(y.numClipIntersection),I.push(y.depthPacking)}function v(I,y){o.disableAll(),y.supportsVertexTextures&&o.enable(0),y.instancing&&o.enable(1),y.instancingColor&&o.enable(2),y.instancingMorph&&o.enable(3),y.matcap&&o.enable(4),y.envMap&&o.enable(5),y.normalMapObjectSpace&&o.enable(6),y.normalMapTangentSpace&&o.enable(7),y.clearcoat&&o.enable(8),y.iridescence&&o.enable(9),y.alphaTest&&o.enable(10),y.vertexColors&&o.enable(11),y.vertexAlphas&&o.enable(12),y.vertexUv1s&&o.enable(13),y.vertexUv2s&&o.enable(14),y.vertexUv3s&&o.enable(15),y.vertexTangents&&o.enable(16),y.anisotropy&&o.enable(17),y.alphaHash&&o.enable(18),y.batching&&o.enable(19),y.dispersion&&o.enable(20),y.batchingColor&&o.enable(21),y.gradientMap&&o.enable(22),I.push(o.mask),o.disableAll(),y.fog&&o.enable(0),y.useFog&&o.enable(1),y.flatShading&&o.enable(2),y.logarithmicDepthBuffer&&o.enable(3),y.reversedDepthBuffer&&o.enable(4),y.skinning&&o.enable(5),y.morphTargets&&o.enable(6),y.morphNormals&&o.enable(7),y.morphColors&&o.enable(8),y.premultipliedAlpha&&o.enable(9),y.shadowMapEnabled&&o.enable(10),y.doubleSided&&o.enable(11),y.flipSided&&o.enable(12),y.useDepthPacking&&o.enable(13),y.dithering&&o.enable(14),y.transmission&&o.enable(15),y.sheen&&o.enable(16),y.opaque&&o.enable(17),y.pointsUvs&&o.enable(18),y.decodeVideoTexture&&o.enable(19),y.decodeVideoTextureEmissive&&o.enable(20),y.alphaToCoverage&&o.enable(21),I.push(o.mask)}function _(I){const y=m[I.type];let T;if(y){const N=Tn[y];T=Zf.clone(N.uniforms)}else T=I.uniforms;return T}function b(I,y){let T;for(let N=0,D=u.length;N<D;N++){const P=u[N];if(P.cacheKey===y){T=P,++T.usedTimes;break}}return T===void 0&&(T=new ly(n,y,I,s),u.push(T)),T}function M(I){if(--I.usedTimes===0){const y=u.indexOf(I);u[y]=u[u.length-1],u.pop(),I.destroy()}}function S(I){l.remove(I)}function C(){l.dispose()}return{getParameters:A,getProgramCacheKey:f,getUniforms:_,acquireProgram:b,releaseProgram:M,releaseShaderCache:S,programs:u,dispose:C}}function fy(){let n=new WeakMap;function e(a){return n.has(a)}function t(a){let o=n.get(a);return o===void 0&&(o={},n.set(a,o)),o}function i(a){n.delete(a)}function r(a,o,l){n.get(a)[o]=l}function s(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:s}}function py(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function cd(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function ud(){const n=[];let e=0;const t=[],i=[],r=[];function s(){e=0,t.length=0,i.length=0,r.length=0}function a(h,d,p,m,g,A){let f=n[e];return f===void 0?(f={id:h.id,object:h,geometry:d,material:p,groupOrder:m,renderOrder:h.renderOrder,z:g,group:A},n[e]=f):(f.id=h.id,f.object=h,f.geometry=d,f.material=p,f.groupOrder=m,f.renderOrder=h.renderOrder,f.z=g,f.group=A),e++,f}function o(h,d,p,m,g,A){const f=a(h,d,p,m,g,A);p.transmission>0?i.push(f):p.transparent===!0?r.push(f):t.push(f)}function l(h,d,p,m,g,A){const f=a(h,d,p,m,g,A);p.transmission>0?i.unshift(f):p.transparent===!0?r.unshift(f):t.unshift(f)}function c(h,d){t.length>1&&t.sort(h||py),i.length>1&&i.sort(d||cd),r.length>1&&r.sort(d||cd)}function u(){for(let h=e,d=n.length;h<d;h++){const p=n[h];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:r,init:s,push:o,unshift:l,finish:u,sort:c}}function Ay(){let n=new WeakMap;function e(i,r){const s=n.get(i);let a;return s===void 0?(a=new ud,n.set(i,[a])):r>=s.length?(a=new ud,s.push(a)):a=s[r],a}function t(){n=new WeakMap}return{get:e,dispose:t}}function my(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new R,color:new be};break;case"SpotLight":t={position:new R,direction:new R,color:new be,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new R,color:new be,distance:0,decay:0};break;case"HemisphereLight":t={direction:new R,skyColor:new be,groundColor:new be};break;case"RectAreaLight":t={color:new be,position:new R,halfWidth:new R,halfHeight:new R};break}return n[e.id]=t,t}}}function gy(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new we,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let _y=0;function Ey(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function vy(n){const e=new my,t=gy(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new R);const r=new R,s=new De,a=new De;function o(c){let u=0,h=0,d=0;for(let I=0;I<9;I++)i.probe[I].set(0,0,0);let p=0,m=0,g=0,A=0,f=0,E=0,v=0,_=0,b=0,M=0,S=0;c.sort(Ey);for(let I=0,y=c.length;I<y;I++){const T=c[I],N=T.color,D=T.intensity,P=T.distance,k=T.shadow&&T.shadow.map?T.shadow.map.texture:null;if(T.isAmbientLight)u+=N.r*D,h+=N.g*D,d+=N.b*D;else if(T.isLightProbe){for(let F=0;F<9;F++)i.probe[F].addScaledVector(T.sh.coefficients[F],D);S++}else if(T.isDirectionalLight){const F=e.get(T);if(F.color.copy(T.color).multiplyScalar(T.intensity),T.castShadow){const G=T.shadow,H=t.get(T);H.shadowIntensity=G.intensity,H.shadowBias=G.bias,H.shadowNormalBias=G.normalBias,H.shadowRadius=G.radius,H.shadowMapSize=G.mapSize,i.directionalShadow[p]=H,i.directionalShadowMap[p]=k,i.directionalShadowMatrix[p]=T.shadow.matrix,E++}i.directional[p]=F,p++}else if(T.isSpotLight){const F=e.get(T);F.position.setFromMatrixPosition(T.matrixWorld),F.color.copy(N).multiplyScalar(D),F.distance=P,F.coneCos=Math.cos(T.angle),F.penumbraCos=Math.cos(T.angle*(1-T.penumbra)),F.decay=T.decay,i.spot[g]=F;const G=T.shadow;if(T.map&&(i.spotLightMap[b]=T.map,b++,G.updateMatrices(T),T.castShadow&&M++),i.spotLightMatrix[g]=G.matrix,T.castShadow){const H=t.get(T);H.shadowIntensity=G.intensity,H.shadowBias=G.bias,H.shadowNormalBias=G.normalBias,H.shadowRadius=G.radius,H.shadowMapSize=G.mapSize,i.spotShadow[g]=H,i.spotShadowMap[g]=k,_++}g++}else if(T.isRectAreaLight){const F=e.get(T);F.color.copy(N).multiplyScalar(D),F.halfWidth.set(T.width*.5,0,0),F.halfHeight.set(0,T.height*.5,0),i.rectArea[A]=F,A++}else if(T.isPointLight){const F=e.get(T);if(F.color.copy(T.color).multiplyScalar(T.intensity),F.distance=T.distance,F.decay=T.decay,T.castShadow){const G=T.shadow,H=t.get(T);H.shadowIntensity=G.intensity,H.shadowBias=G.bias,H.shadowNormalBias=G.normalBias,H.shadowRadius=G.radius,H.shadowMapSize=G.mapSize,H.shadowCameraNear=G.camera.near,H.shadowCameraFar=G.camera.far,i.pointShadow[m]=H,i.pointShadowMap[m]=k,i.pointShadowMatrix[m]=T.shadow.matrix,v++}i.point[m]=F,m++}else if(T.isHemisphereLight){const F=e.get(T);F.skyColor.copy(T.color).multiplyScalar(D),F.groundColor.copy(T.groundColor).multiplyScalar(D),i.hemi[f]=F,f++}}A>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=oe.LTC_FLOAT_1,i.rectAreaLTC2=oe.LTC_FLOAT_2):(i.rectAreaLTC1=oe.LTC_HALF_1,i.rectAreaLTC2=oe.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=h,i.ambient[2]=d;const C=i.hash;(C.directionalLength!==p||C.pointLength!==m||C.spotLength!==g||C.rectAreaLength!==A||C.hemiLength!==f||C.numDirectionalShadows!==E||C.numPointShadows!==v||C.numSpotShadows!==_||C.numSpotMaps!==b||C.numLightProbes!==S)&&(i.directional.length=p,i.spot.length=g,i.rectArea.length=A,i.point.length=m,i.hemi.length=f,i.directionalShadow.length=E,i.directionalShadowMap.length=E,i.pointShadow.length=v,i.pointShadowMap.length=v,i.spotShadow.length=_,i.spotShadowMap.length=_,i.directionalShadowMatrix.length=E,i.pointShadowMatrix.length=v,i.spotLightMatrix.length=_+b-M,i.spotLightMap.length=b,i.numSpotLightShadowsWithMaps=M,i.numLightProbes=S,C.directionalLength=p,C.pointLength=m,C.spotLength=g,C.rectAreaLength=A,C.hemiLength=f,C.numDirectionalShadows=E,C.numPointShadows=v,C.numSpotShadows=_,C.numSpotMaps=b,C.numLightProbes=S,i.version=_y++)}function l(c,u){let h=0,d=0,p=0,m=0,g=0;const A=u.matrixWorldInverse;for(let f=0,E=c.length;f<E;f++){const v=c[f];if(v.isDirectionalLight){const _=i.directional[h];_.direction.setFromMatrixPosition(v.matrixWorld),r.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(r),_.direction.transformDirection(A),h++}else if(v.isSpotLight){const _=i.spot[p];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(A),_.direction.setFromMatrixPosition(v.matrixWorld),r.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(r),_.direction.transformDirection(A),p++}else if(v.isRectAreaLight){const _=i.rectArea[m];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(A),a.identity(),s.copy(v.matrixWorld),s.premultiply(A),a.extractRotation(s),_.halfWidth.set(v.width*.5,0,0),_.halfHeight.set(0,v.height*.5,0),_.halfWidth.applyMatrix4(a),_.halfHeight.applyMatrix4(a),m++}else if(v.isPointLight){const _=i.point[d];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(A),d++}else if(v.isHemisphereLight){const _=i.hemi[g];_.direction.setFromMatrixPosition(v.matrixWorld),_.direction.transformDirection(A),g++}}}return{setup:o,setupView:l,state:i}}function hd(n){const e=new vy(n),t=[],i=[];function r(u){c.camera=u,t.length=0,i.length=0}function s(u){t.push(u)}function a(u){i.push(u)}function o(){e.setup(t)}function l(u){e.setupView(t,u)}const c={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function by(n){let e=new WeakMap;function t(r,s=0){const a=e.get(r);let o;return a===void 0?(o=new hd(n),e.set(r,[o])):s>=a.length?(o=new hd(n),a.push(o)):o=a[s],o}function i(){e=new WeakMap}return{get:t,dispose:i}}const xy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,yy=`uniform sampler2D shadow_pass;
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
}`;function My(n,e,t){let i=new pu;const r=new we,s=new we,a=new nt,o=new vE({depthPacking:p_}),l=new bE,c={},u=t.maxTextureSize,h={[Yn]:qt,[qt]:Yn,[tn]:tn},d=new Kn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new we},radius:{value:4}},vertexShader:xy,fragmentShader:yy}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const m=new dt;m.setAttribute("position",new tt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new Ke(m,d),A=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ff;let f=this.type;this.render=function(M,S,C){if(A.enabled===!1||A.autoUpdate===!1&&A.needsUpdate===!1||M.length===0)return;const I=n.getRenderTarget(),y=n.getActiveCubeFace(),T=n.getActiveMipmapLevel(),N=n.state;N.setBlending(oi),N.buffers.depth.getReversed()===!0?N.buffers.color.setClear(0,0,0,0):N.buffers.color.setClear(1,1,1,1),N.buffers.depth.setTest(!0),N.setScissorTest(!1);const D=f!==Vn&&this.type===Vn,P=f===Vn&&this.type!==Vn;for(let k=0,F=M.length;k<F;k++){const G=M[k],H=G.shadow;if(H===void 0){console.warn("THREE.WebGLShadowMap:",G,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;r.copy(H.mapSize);const ee=H.getFrameExtents();if(r.multiply(ee),s.copy(H.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/ee.x),r.x=s.x*ee.x,H.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/ee.y),r.y=s.y*ee.y,H.mapSize.y=s.y)),H.map===null||D===!0||P===!0){const se=this.type!==Vn?{minFilter:Nt,magFilter:Nt}:{};H.map!==null&&H.map.dispose(),H.map=new Vi(r.x,r.y,se),H.map.texture.name=G.name+".shadowMap",H.camera.updateProjectionMatrix()}n.setRenderTarget(H.map),n.clear();const Z=H.getViewportCount();for(let se=0;se<Z;se++){const pe=H.getViewport(se);a.set(s.x*pe.x,s.y*pe.y,s.x*pe.z,s.y*pe.w),N.viewport(a),H.updateMatrices(G,se),i=H.getFrustum(),_(S,C,H.camera,G,this.type)}H.isPointLightShadow!==!0&&this.type===Vn&&E(H,C),H.needsUpdate=!1}f=this.type,A.needsUpdate=!1,n.setRenderTarget(I,y,T)};function E(M,S){const C=e.update(g);d.defines.VSM_SAMPLES!==M.blurSamples&&(d.defines.VSM_SAMPLES=M.blurSamples,p.defines.VSM_SAMPLES=M.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),M.mapPass===null&&(M.mapPass=new Vi(r.x,r.y)),d.uniforms.shadow_pass.value=M.map.texture,d.uniforms.resolution.value=M.mapSize,d.uniforms.radius.value=M.radius,n.setRenderTarget(M.mapPass),n.clear(),n.renderBufferDirect(S,null,C,d,g,null),p.uniforms.shadow_pass.value=M.mapPass.texture,p.uniforms.resolution.value=M.mapSize,p.uniforms.radius.value=M.radius,n.setRenderTarget(M.map),n.clear(),n.renderBufferDirect(S,null,C,p,g,null)}function v(M,S,C,I){let y=null;const T=C.isPointLight===!0?M.customDistanceMaterial:M.customDepthMaterial;if(T!==void 0)y=T;else if(y=C.isPointLight===!0?l:o,n.localClippingEnabled&&S.clipShadows===!0&&Array.isArray(S.clippingPlanes)&&S.clippingPlanes.length!==0||S.displacementMap&&S.displacementScale!==0||S.alphaMap&&S.alphaTest>0||S.map&&S.alphaTest>0||S.alphaToCoverage===!0){const N=y.uuid,D=S.uuid;let P=c[N];P===void 0&&(P={},c[N]=P);let k=P[D];k===void 0&&(k=y.clone(),P[D]=k,S.addEventListener("dispose",b)),y=k}if(y.visible=S.visible,y.wireframe=S.wireframe,I===Vn?y.side=S.shadowSide!==null?S.shadowSide:S.side:y.side=S.shadowSide!==null?S.shadowSide:h[S.side],y.alphaMap=S.alphaMap,y.alphaTest=S.alphaToCoverage===!0?.5:S.alphaTest,y.map=S.map,y.clipShadows=S.clipShadows,y.clippingPlanes=S.clippingPlanes,y.clipIntersection=S.clipIntersection,y.displacementMap=S.displacementMap,y.displacementScale=S.displacementScale,y.displacementBias=S.displacementBias,y.wireframeLinewidth=S.wireframeLinewidth,y.linewidth=S.linewidth,C.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const N=n.properties.get(y);N.light=C}return y}function _(M,S,C,I,y){if(M.visible===!1)return;if(M.layers.test(S.layers)&&(M.isMesh||M.isLine||M.isPoints)&&(M.castShadow||M.receiveShadow&&y===Vn)&&(!M.frustumCulled||i.intersectsObject(M))){M.modelViewMatrix.multiplyMatrices(C.matrixWorldInverse,M.matrixWorld);const D=e.update(M),P=M.material;if(Array.isArray(P)){const k=D.groups;for(let F=0,G=k.length;F<G;F++){const H=k[F],ee=P[H.materialIndex];if(ee&&ee.visible){const Z=v(M,ee,I,y);M.onBeforeShadow(n,M,S,C,D,Z,H),n.renderBufferDirect(C,null,D,Z,M,H),M.onAfterShadow(n,M,S,C,D,Z,H)}}}else if(P.visible){const k=v(M,P,I,y);M.onBeforeShadow(n,M,S,C,D,k,null),n.renderBufferDirect(C,null,D,k,M,null),M.onAfterShadow(n,M,S,C,D,k,null)}}const N=M.children;for(let D=0,P=N.length;D<P;D++)_(N[D],S,C,I,y)}function b(M){M.target.removeEventListener("dispose",b);for(const C in c){const I=c[C],y=M.target.uuid;y in I&&(I[y].dispose(),delete I[y])}}}const Iy={[cc]:uc,[hc]:pc,[dc]:Ac,[Qr]:fc,[uc]:cc,[pc]:hc,[Ac]:dc,[fc]:Qr};function Sy(n,e){function t(){let O=!1;const te=new nt;let ae=null;const ue=new nt(0,0,0,0);return{setMask:function(ne){ae!==ne&&!O&&(n.colorMask(ne,ne,ne,ne),ae=ne)},setLocked:function(ne){O=ne},setClear:function(ne,K,ve,Qe,it){it===!0&&(ne*=Qe,K*=Qe,ve*=Qe),te.set(ne,K,ve,Qe),ue.equals(te)===!1&&(n.clearColor(ne,K,ve,Qe),ue.copy(te))},reset:function(){O=!1,ae=null,ue.set(-1,0,0,0)}}}function i(){let O=!1,te=!1,ae=null,ue=null,ne=null;return{setReversed:function(K){if(te!==K){const ve=e.get("EXT_clip_control");K?ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.ZERO_TO_ONE_EXT):ve.clipControlEXT(ve.LOWER_LEFT_EXT,ve.NEGATIVE_ONE_TO_ONE_EXT),te=K;const Qe=ne;ne=null,this.setClear(Qe)}},getReversed:function(){return te},setTest:function(K){K?J(n.DEPTH_TEST):de(n.DEPTH_TEST)},setMask:function(K){ae!==K&&!O&&(n.depthMask(K),ae=K)},setFunc:function(K){if(te&&(K=Iy[K]),ue!==K){switch(K){case cc:n.depthFunc(n.NEVER);break;case uc:n.depthFunc(n.ALWAYS);break;case hc:n.depthFunc(n.LESS);break;case Qr:n.depthFunc(n.LEQUAL);break;case dc:n.depthFunc(n.EQUAL);break;case fc:n.depthFunc(n.GEQUAL);break;case pc:n.depthFunc(n.GREATER);break;case Ac:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}ue=K}},setLocked:function(K){O=K},setClear:function(K){ne!==K&&(te&&(K=1-K),n.clearDepth(K),ne=K)},reset:function(){O=!1,ae=null,ue=null,ne=null,te=!1}}}function r(){let O=!1,te=null,ae=null,ue=null,ne=null,K=null,ve=null,Qe=null,it=null;return{setTest:function(Ze){O||(Ze?J(n.STENCIL_TEST):de(n.STENCIL_TEST))},setMask:function(Ze){te!==Ze&&!O&&(n.stencilMask(Ze),te=Ze)},setFunc:function(Ze,pn,rn){(ae!==Ze||ue!==pn||ne!==rn)&&(n.stencilFunc(Ze,pn,rn),ae=Ze,ue=pn,ne=rn)},setOp:function(Ze,pn,rn){(K!==Ze||ve!==pn||Qe!==rn)&&(n.stencilOp(Ze,pn,rn),K=Ze,ve=pn,Qe=rn)},setLocked:function(Ze){O=Ze},setClear:function(Ze){it!==Ze&&(n.clearStencil(Ze),it=Ze)},reset:function(){O=!1,te=null,ae=null,ue=null,ne=null,K=null,ve=null,Qe=null,it=null}}}const s=new t,a=new i,o=new r,l=new WeakMap,c=new WeakMap;let u={},h={},d=new WeakMap,p=[],m=null,g=!1,A=null,f=null,E=null,v=null,_=null,b=null,M=null,S=new be(0,0,0),C=0,I=!1,y=null,T=null,N=null,D=null,P=null;const k=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let F=!1,G=0;const H=n.getParameter(n.VERSION);H.indexOf("WebGL")!==-1?(G=parseFloat(/^WebGL (\d)/.exec(H)[1]),F=G>=1):H.indexOf("OpenGL ES")!==-1&&(G=parseFloat(/^OpenGL ES (\d)/.exec(H)[1]),F=G>=2);let ee=null,Z={};const se=n.getParameter(n.SCISSOR_BOX),pe=n.getParameter(n.VIEWPORT),Ue=new nt().fromArray(se),qe=new nt().fromArray(pe);function Ve(O,te,ae,ue){const ne=new Uint8Array(4),K=n.createTexture();n.bindTexture(O,K),n.texParameteri(O,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(O,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let ve=0;ve<ae;ve++)O===n.TEXTURE_3D||O===n.TEXTURE_2D_ARRAY?n.texImage3D(te,0,n.RGBA,1,1,ue,0,n.RGBA,n.UNSIGNED_BYTE,ne):n.texImage2D(te+ve,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ne);return K}const Y={};Y[n.TEXTURE_2D]=Ve(n.TEXTURE_2D,n.TEXTURE_2D,1),Y[n.TEXTURE_CUBE_MAP]=Ve(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[n.TEXTURE_2D_ARRAY]=Ve(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),Y[n.TEXTURE_3D]=Ve(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),J(n.DEPTH_TEST),a.setFunc(Qr),Te(!1),_e(Yu),J(n.CULL_FACE),at(oi);function J(O){u[O]!==!0&&(n.enable(O),u[O]=!0)}function de(O){u[O]!==!1&&(n.disable(O),u[O]=!1)}function Ie(O,te){return h[O]!==te?(n.bindFramebuffer(O,te),h[O]=te,O===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=te),O===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=te),!0):!1}function xe(O,te){let ae=p,ue=!1;if(O){ae=d.get(te),ae===void 0&&(ae=[],d.set(te,ae));const ne=O.textures;if(ae.length!==ne.length||ae[0]!==n.COLOR_ATTACHMENT0){for(let K=0,ve=ne.length;K<ve;K++)ae[K]=n.COLOR_ATTACHMENT0+K;ae.length=ne.length,ue=!0}}else ae[0]!==n.BACK&&(ae[0]=n.BACK,ue=!0);ue&&n.drawBuffers(ae)}function ze(O){return m!==O?(n.useProgram(O),m=O,!0):!1}const St={[Ci]:n.FUNC_ADD,[Ug]:n.FUNC_SUBTRACT,[Ng]:n.FUNC_REVERSE_SUBTRACT};St[Fg]=n.MIN,St[Og]=n.MAX;const U={[kg]:n.ZERO,[Qg]:n.ONE,[Hg]:n.SRC_COLOR,[oc]:n.SRC_ALPHA,[jg]:n.SRC_ALPHA_SATURATE,[Wg]:n.DST_COLOR,[Vg]:n.DST_ALPHA,[Gg]:n.ONE_MINUS_SRC_COLOR,[lc]:n.ONE_MINUS_SRC_ALPHA,[qg]:n.ONE_MINUS_DST_COLOR,[zg]:n.ONE_MINUS_DST_ALPHA,[Xg]:n.CONSTANT_COLOR,[Yg]:n.ONE_MINUS_CONSTANT_COLOR,[Kg]:n.CONSTANT_ALPHA,[Jg]:n.ONE_MINUS_CONSTANT_ALPHA};function at(O,te,ae,ue,ne,K,ve,Qe,it,Ze){if(O===oi){g===!0&&(de(n.BLEND),g=!1);return}if(g===!1&&(J(n.BLEND),g=!0),O!==Pg){if(O!==A||Ze!==I){if((f!==Ci||_!==Ci)&&(n.blendEquation(n.FUNC_ADD),f=Ci,_=Ci),Ze)switch(O){case Dr:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case no:n.blendFunc(n.ONE,n.ONE);break;case Ku:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Ju:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",O);break}else switch(O){case Dr:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case no:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case Ku:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Ju:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",O);break}E=null,v=null,b=null,M=null,S.set(0,0,0),C=0,A=O,I=Ze}return}ne=ne||te,K=K||ae,ve=ve||ue,(te!==f||ne!==_)&&(n.blendEquationSeparate(St[te],St[ne]),f=te,_=ne),(ae!==E||ue!==v||K!==b||ve!==M)&&(n.blendFuncSeparate(U[ae],U[ue],U[K],U[ve]),E=ae,v=ue,b=K,M=ve),(Qe.equals(S)===!1||it!==C)&&(n.blendColor(Qe.r,Qe.g,Qe.b,it),S.copy(Qe),C=it),A=O,I=!1}function Ne(O,te){O.side===tn?de(n.CULL_FACE):J(n.CULL_FACE);let ae=O.side===qt;te&&(ae=!ae),Te(ae),O.blending===Dr&&O.transparent===!1?at(oi):at(O.blending,O.blendEquation,O.blendSrc,O.blendDst,O.blendEquationAlpha,O.blendSrcAlpha,O.blendDstAlpha,O.blendColor,O.blendAlpha,O.premultipliedAlpha),a.setFunc(O.depthFunc),a.setTest(O.depthTest),a.setMask(O.depthWrite),s.setMask(O.colorWrite);const ue=O.stencilWrite;o.setTest(ue),ue&&(o.setMask(O.stencilWriteMask),o.setFunc(O.stencilFunc,O.stencilRef,O.stencilFuncMask),o.setOp(O.stencilFail,O.stencilZFail,O.stencilZPass)),Ee(O.polygonOffset,O.polygonOffsetFactor,O.polygonOffsetUnits),O.alphaToCoverage===!0?J(n.SAMPLE_ALPHA_TO_COVERAGE):de(n.SAMPLE_ALPHA_TO_COVERAGE)}function Te(O){y!==O&&(O?n.frontFace(n.CW):n.frontFace(n.CCW),y=O)}function _e(O){O!==Bg?(J(n.CULL_FACE),O!==T&&(O===Yu?n.cullFace(n.BACK):O===Lg?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):de(n.CULL_FACE),T=O}function ot(O){O!==N&&(F&&n.lineWidth(O),N=O)}function Ee(O,te,ae){O?(J(n.POLYGON_OFFSET_FILL),(D!==te||P!==ae)&&(n.polygonOffset(te,ae),D=te,P=ae)):de(n.POLYGON_OFFSET_FILL)}function ke(O){O?J(n.SCISSOR_TEST):de(n.SCISSOR_TEST)}function Et(O){O===void 0&&(O=n.TEXTURE0+k-1),ee!==O&&(n.activeTexture(O),ee=O)}function _t(O,te,ae){ae===void 0&&(ee===null?ae=n.TEXTURE0+k-1:ae=ee);let ue=Z[ae];ue===void 0&&(ue={type:void 0,texture:void 0},Z[ae]=ue),(ue.type!==O||ue.texture!==te)&&(ee!==ae&&(n.activeTexture(ae),ee=ae),n.bindTexture(O,te||Y[O]),ue.type=O,ue.texture=te)}function B(){const O=Z[ee];O!==void 0&&O.type!==void 0&&(n.bindTexture(O.type,null),O.type=void 0,O.texture=void 0)}function x(){try{n.compressedTexImage2D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function L(){try{n.compressedTexImage3D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function Q(){try{n.texSubImage2D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function j(){try{n.texSubImage3D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function W(){try{n.compressedTexSubImage2D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function fe(){try{n.compressedTexSubImage3D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function $(){try{n.texStorage2D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function me(){try{n.texStorage3D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function Ae(){try{n.texImage2D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function ie(){try{n.texImage3D(...arguments)}catch(O){console.error("THREE.WebGLState:",O)}}function ce(O){Ue.equals(O)===!1&&(n.scissor(O.x,O.y,O.z,O.w),Ue.copy(O))}function Se(O){qe.equals(O)===!1&&(n.viewport(O.x,O.y,O.z,O.w),qe.copy(O))}function ye(O,te){let ae=c.get(te);ae===void 0&&(ae=new WeakMap,c.set(te,ae));let ue=ae.get(O);ue===void 0&&(ue=n.getUniformBlockIndex(te,O.name),ae.set(O,ue))}function le(O,te){const ue=c.get(te).get(O);l.get(te)!==ue&&(n.uniformBlockBinding(te,ue,O.__bindingPointIndex),l.set(te,ue))}function Re(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),a.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},ee=null,Z={},h={},d=new WeakMap,p=[],m=null,g=!1,A=null,f=null,E=null,v=null,_=null,b=null,M=null,S=new be(0,0,0),C=0,I=!1,y=null,T=null,N=null,D=null,P=null,Ue.set(0,0,n.canvas.width,n.canvas.height),qe.set(0,0,n.canvas.width,n.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:J,disable:de,bindFramebuffer:Ie,drawBuffers:xe,useProgram:ze,setBlending:at,setMaterial:Ne,setFlipSided:Te,setCullFace:_e,setLineWidth:ot,setPolygonOffset:Ee,setScissorTest:ke,activeTexture:Et,bindTexture:_t,unbindTexture:B,compressedTexImage2D:x,compressedTexImage3D:L,texImage2D:Ae,texImage3D:ie,updateUBOMapping:ye,uniformBlockBinding:le,texStorage2D:$,texStorage3D:me,texSubImage2D:Q,texSubImage3D:j,compressedTexSubImage2D:W,compressedTexSubImage3D:fe,scissor:ce,viewport:Se,reset:Re}}function Cy(n,e,t,i,r,s,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new we,u=new WeakMap;let h;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(B,x){return p?new OffscreenCanvas(B,x):Ys("canvas")}function g(B,x,L){let Q=1;const j=_t(B);if((j.width>L||j.height>L)&&(Q=L/Math.max(j.width,j.height)),Q<1)if(typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&B instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&B instanceof ImageBitmap||typeof VideoFrame<"u"&&B instanceof VideoFrame){const W=Math.floor(Q*j.width),fe=Math.floor(Q*j.height);h===void 0&&(h=m(W,fe));const $=x?m(W,fe):h;return $.width=W,$.height=fe,$.getContext("2d").drawImage(B,0,0,W,fe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+j.width+"x"+j.height+") to ("+W+"x"+fe+")."),$}else return"data"in B&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+j.width+"x"+j.height+")."),B;return B}function A(B){return B.generateMipmaps}function f(B){n.generateMipmap(B)}function E(B){return B.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:B.isWebGL3DRenderTarget?n.TEXTURE_3D:B.isWebGLArrayRenderTarget||B.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(B,x,L,Q,j=!1){if(B!==null){if(n[B]!==void 0)return n[B];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+B+"'")}let W=x;if(x===n.RED&&(L===n.FLOAT&&(W=n.R32F),L===n.HALF_FLOAT&&(W=n.R16F),L===n.UNSIGNED_BYTE&&(W=n.R8)),x===n.RED_INTEGER&&(L===n.UNSIGNED_BYTE&&(W=n.R8UI),L===n.UNSIGNED_SHORT&&(W=n.R16UI),L===n.UNSIGNED_INT&&(W=n.R32UI),L===n.BYTE&&(W=n.R8I),L===n.SHORT&&(W=n.R16I),L===n.INT&&(W=n.R32I)),x===n.RG&&(L===n.FLOAT&&(W=n.RG32F),L===n.HALF_FLOAT&&(W=n.RG16F),L===n.UNSIGNED_BYTE&&(W=n.RG8)),x===n.RG_INTEGER&&(L===n.UNSIGNED_BYTE&&(W=n.RG8UI),L===n.UNSIGNED_SHORT&&(W=n.RG16UI),L===n.UNSIGNED_INT&&(W=n.RG32UI),L===n.BYTE&&(W=n.RG8I),L===n.SHORT&&(W=n.RG16I),L===n.INT&&(W=n.RG32I)),x===n.RGB_INTEGER&&(L===n.UNSIGNED_BYTE&&(W=n.RGB8UI),L===n.UNSIGNED_SHORT&&(W=n.RGB16UI),L===n.UNSIGNED_INT&&(W=n.RGB32UI),L===n.BYTE&&(W=n.RGB8I),L===n.SHORT&&(W=n.RGB16I),L===n.INT&&(W=n.RGB32I)),x===n.RGBA_INTEGER&&(L===n.UNSIGNED_BYTE&&(W=n.RGBA8UI),L===n.UNSIGNED_SHORT&&(W=n.RGBA16UI),L===n.UNSIGNED_INT&&(W=n.RGBA32UI),L===n.BYTE&&(W=n.RGBA8I),L===n.SHORT&&(W=n.RGBA16I),L===n.INT&&(W=n.RGBA32I)),x===n.RGB&&(L===n.UNSIGNED_INT_5_9_9_9_REV&&(W=n.RGB9_E5),L===n.UNSIGNED_INT_10F_11F_11F_REV&&(W=n.R11F_G11F_B10F)),x===n.RGBA){const fe=j?fo:Je.getTransfer(Q);L===n.FLOAT&&(W=n.RGBA32F),L===n.HALF_FLOAT&&(W=n.RGBA16F),L===n.UNSIGNED_BYTE&&(W=fe===ht?n.SRGB8_ALPHA8:n.RGBA8),L===n.UNSIGNED_SHORT_4_4_4_4&&(W=n.RGBA4),L===n.UNSIGNED_SHORT_5_5_5_1&&(W=n.RGB5_A1)}return(W===n.R16F||W===n.R32F||W===n.RG16F||W===n.RG32F||W===n.RGBA16F||W===n.RGBA32F)&&e.get("EXT_color_buffer_float"),W}function _(B,x){let L;return B?x===null||x===Gi||x===Qs?L=n.DEPTH24_STENCIL8:x===kt?L=n.DEPTH32F_STENCIL8:x===ks&&(L=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===Gi||x===Qs?L=n.DEPTH_COMPONENT24:x===kt?L=n.DEPTH_COMPONENT32F:x===ks&&(L=n.DEPTH_COMPONENT16),L}function b(B,x){return A(B)===!0||B.isFramebufferTexture&&B.minFilter!==Nt&&B.minFilter!==Ut?Math.log2(Math.max(x.width,x.height))+1:B.mipmaps!==void 0&&B.mipmaps.length>0?B.mipmaps.length:B.isCompressedTexture&&Array.isArray(B.image)?x.mipmaps.length:1}function M(B){const x=B.target;x.removeEventListener("dispose",M),C(x),x.isVideoTexture&&u.delete(x)}function S(B){const x=B.target;x.removeEventListener("dispose",S),y(x)}function C(B){const x=i.get(B);if(x.__webglInit===void 0)return;const L=B.source,Q=d.get(L);if(Q){const j=Q[x.__cacheKey];j.usedTimes--,j.usedTimes===0&&I(B),Object.keys(Q).length===0&&d.delete(L)}i.remove(B)}function I(B){const x=i.get(B);n.deleteTexture(x.__webglTexture);const L=B.source,Q=d.get(L);delete Q[x.__cacheKey],a.memory.textures--}function y(B){const x=i.get(B);if(B.depthTexture&&(B.depthTexture.dispose(),i.remove(B.depthTexture)),B.isWebGLCubeRenderTarget)for(let Q=0;Q<6;Q++){if(Array.isArray(x.__webglFramebuffer[Q]))for(let j=0;j<x.__webglFramebuffer[Q].length;j++)n.deleteFramebuffer(x.__webglFramebuffer[Q][j]);else n.deleteFramebuffer(x.__webglFramebuffer[Q]);x.__webglDepthbuffer&&n.deleteRenderbuffer(x.__webglDepthbuffer[Q])}else{if(Array.isArray(x.__webglFramebuffer))for(let Q=0;Q<x.__webglFramebuffer.length;Q++)n.deleteFramebuffer(x.__webglFramebuffer[Q]);else n.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&n.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&n.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let Q=0;Q<x.__webglColorRenderbuffer.length;Q++)x.__webglColorRenderbuffer[Q]&&n.deleteRenderbuffer(x.__webglColorRenderbuffer[Q]);x.__webglDepthRenderbuffer&&n.deleteRenderbuffer(x.__webglDepthRenderbuffer)}const L=B.textures;for(let Q=0,j=L.length;Q<j;Q++){const W=i.get(L[Q]);W.__webglTexture&&(n.deleteTexture(W.__webglTexture),a.memory.textures--),i.remove(L[Q])}i.remove(B)}let T=0;function N(){T=0}function D(){const B=T;return B>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+B+" texture units while this GPU supports only "+r.maxTextures),T+=1,B}function P(B){const x=[];return x.push(B.wrapS),x.push(B.wrapT),x.push(B.wrapR||0),x.push(B.magFilter),x.push(B.minFilter),x.push(B.anisotropy),x.push(B.internalFormat),x.push(B.format),x.push(B.type),x.push(B.generateMipmaps),x.push(B.premultiplyAlpha),x.push(B.flipY),x.push(B.unpackAlignment),x.push(B.colorSpace),x.join()}function k(B,x){const L=i.get(B);if(B.isVideoTexture&&ke(B),B.isRenderTargetTexture===!1&&B.isExternalTexture!==!0&&B.version>0&&L.__version!==B.version){const Q=B.image;if(Q===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(L,B,x);return}}else B.isExternalTexture&&(L.__webglTexture=B.sourceTexture?B.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,L.__webglTexture,n.TEXTURE0+x)}function F(B,x){const L=i.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&L.__version!==B.version){Y(L,B,x);return}t.bindTexture(n.TEXTURE_2D_ARRAY,L.__webglTexture,n.TEXTURE0+x)}function G(B,x){const L=i.get(B);if(B.isRenderTargetTexture===!1&&B.version>0&&L.__version!==B.version){Y(L,B,x);return}t.bindTexture(n.TEXTURE_3D,L.__webglTexture,n.TEXTURE0+x)}function H(B,x){const L=i.get(B);if(B.version>0&&L.__version!==B.version){J(L,B,x);return}t.bindTexture(n.TEXTURE_CUBE_MAP,L.__webglTexture,n.TEXTURE0+x)}const ee={[Hi]:n.REPEAT,[Wn]:n.CLAMP_TO_EDGE,[io]:n.MIRRORED_REPEAT},Z={[Nt]:n.NEAREST,[tu]:n.NEAREST_MIPMAP_NEAREST,[ws]:n.NEAREST_MIPMAP_LINEAR,[Ut]:n.LINEAR,[qa]:n.LINEAR_MIPMAP_NEAREST,[vn]:n.LINEAR_MIPMAP_LINEAR},se={[m_]:n.NEVER,[x_]:n.ALWAYS,[g_]:n.LESS,[Vf]:n.LEQUAL,[__]:n.EQUAL,[b_]:n.GEQUAL,[E_]:n.GREATER,[v_]:n.NOTEQUAL};function pe(B,x){if(x.type===kt&&e.has("OES_texture_float_linear")===!1&&(x.magFilter===Ut||x.magFilter===qa||x.magFilter===ws||x.magFilter===vn||x.minFilter===Ut||x.minFilter===qa||x.minFilter===ws||x.minFilter===vn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(B,n.TEXTURE_WRAP_S,ee[x.wrapS]),n.texParameteri(B,n.TEXTURE_WRAP_T,ee[x.wrapT]),(B===n.TEXTURE_3D||B===n.TEXTURE_2D_ARRAY)&&n.texParameteri(B,n.TEXTURE_WRAP_R,ee[x.wrapR]),n.texParameteri(B,n.TEXTURE_MAG_FILTER,Z[x.magFilter]),n.texParameteri(B,n.TEXTURE_MIN_FILTER,Z[x.minFilter]),x.compareFunction&&(n.texParameteri(B,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(B,n.TEXTURE_COMPARE_FUNC,se[x.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===Nt||x.minFilter!==ws&&x.minFilter!==vn||x.type===kt&&e.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||i.get(x).__currentAnisotropy){const L=e.get("EXT_texture_filter_anisotropic");n.texParameterf(B,L.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,r.getMaxAnisotropy())),i.get(x).__currentAnisotropy=x.anisotropy}}}function Ue(B,x){let L=!1;B.__webglInit===void 0&&(B.__webglInit=!0,x.addEventListener("dispose",M));const Q=x.source;let j=d.get(Q);j===void 0&&(j={},d.set(Q,j));const W=P(x);if(W!==B.__cacheKey){j[W]===void 0&&(j[W]={texture:n.createTexture(),usedTimes:0},a.memory.textures++,L=!0),j[W].usedTimes++;const fe=j[B.__cacheKey];fe!==void 0&&(j[B.__cacheKey].usedTimes--,fe.usedTimes===0&&I(x)),B.__cacheKey=W,B.__webglTexture=j[W].texture}return L}function qe(B,x,L){return Math.floor(Math.floor(B/L)/x)}function Ve(B,x,L,Q){const W=B.updateRanges;if(W.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,x.width,x.height,L,Q,x.data);else{W.sort((ie,ce)=>ie.start-ce.start);let fe=0;for(let ie=1;ie<W.length;ie++){const ce=W[fe],Se=W[ie],ye=ce.start+ce.count,le=qe(Se.start,x.width,4),Re=qe(ce.start,x.width,4);Se.start<=ye+1&&le===Re&&qe(Se.start+Se.count-1,x.width,4)===le?ce.count=Math.max(ce.count,Se.start+Se.count-ce.start):(++fe,W[fe]=Se)}W.length=fe+1;const $=n.getParameter(n.UNPACK_ROW_LENGTH),me=n.getParameter(n.UNPACK_SKIP_PIXELS),Ae=n.getParameter(n.UNPACK_SKIP_ROWS);n.pixelStorei(n.UNPACK_ROW_LENGTH,x.width);for(let ie=0,ce=W.length;ie<ce;ie++){const Se=W[ie],ye=Math.floor(Se.start/4),le=Math.ceil(Se.count/4),Re=ye%x.width,O=Math.floor(ye/x.width),te=le,ae=1;n.pixelStorei(n.UNPACK_SKIP_PIXELS,Re),n.pixelStorei(n.UNPACK_SKIP_ROWS,O),t.texSubImage2D(n.TEXTURE_2D,0,Re,O,te,ae,L,Q,x.data)}B.clearUpdateRanges(),n.pixelStorei(n.UNPACK_ROW_LENGTH,$),n.pixelStorei(n.UNPACK_SKIP_PIXELS,me),n.pixelStorei(n.UNPACK_SKIP_ROWS,Ae)}}function Y(B,x,L){let Q=n.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(Q=n.TEXTURE_2D_ARRAY),x.isData3DTexture&&(Q=n.TEXTURE_3D);const j=Ue(B,x),W=x.source;t.bindTexture(Q,B.__webglTexture,n.TEXTURE0+L);const fe=i.get(W);if(W.version!==fe.__version||j===!0){t.activeTexture(n.TEXTURE0+L);const $=Je.getPrimaries(Je.workingColorSpace),me=x.colorSpace===Rn?null:Je.getPrimaries(x.colorSpace),Ae=x.colorSpace===Rn||$===me?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,x.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,x.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae);let ie=g(x.image,!1,r.maxTextureSize);ie=Et(x,ie);const ce=s.convert(x.format,x.colorSpace),Se=s.convert(x.type);let ye=v(x.internalFormat,ce,Se,x.colorSpace,x.isVideoTexture);pe(Q,x);let le;const Re=x.mipmaps,O=x.isVideoTexture!==!0,te=fe.__version===void 0||j===!0,ae=W.dataReady,ue=b(x,ie);if(x.isDepthTexture)ye=_(x.format===Vs,x.type),te&&(O?t.texStorage2D(n.TEXTURE_2D,1,ye,ie.width,ie.height):t.texImage2D(n.TEXTURE_2D,0,ye,ie.width,ie.height,0,ce,Se,null));else if(x.isDataTexture)if(Re.length>0){O&&te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,Re[0].width,Re[0].height);for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],O?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,Se,le.data):t.texImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,ce,Se,le.data);x.generateMipmaps=!1}else O?(te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,ie.width,ie.height),ae&&Ve(x,ie,ce,Se)):t.texImage2D(n.TEXTURE_2D,0,ye,ie.width,ie.height,0,ce,Se,ie.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){O&&te&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,ye,Re[0].width,Re[0].height,ie.depth);for(let ne=0,K=Re.length;ne<K;ne++)if(le=Re[ne],x.format!==Pt)if(ce!==null)if(O){if(ae)if(x.layerUpdates.size>0){const ve=Hh(le.width,le.height,x.format,x.type);for(const Qe of x.layerUpdates){const it=le.data.subarray(Qe*ve/le.data.BYTES_PER_ELEMENT,(Qe+1)*ve/le.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,Qe,le.width,le.height,1,ce,it)}x.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,0,le.width,le.height,ie.depth,ce,le.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,ne,ye,le.width,le.height,ie.depth,0,le.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else O?ae&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,ne,0,0,0,le.width,le.height,ie.depth,ce,Se,le.data):t.texImage3D(n.TEXTURE_2D_ARRAY,ne,ye,le.width,le.height,ie.depth,0,ce,Se,le.data)}else{O&&te&&t.texStorage2D(n.TEXTURE_2D,ue,ye,Re[0].width,Re[0].height);for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],x.format!==Pt?ce!==null?O?ae&&t.compressedTexSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,le.data):t.compressedTexImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):O?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,le.width,le.height,ce,Se,le.data):t.texImage2D(n.TEXTURE_2D,ne,ye,le.width,le.height,0,ce,Se,le.data)}else if(x.isDataArrayTexture)if(O){if(te&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ue,ye,ie.width,ie.height,ie.depth),ae)if(x.layerUpdates.size>0){const ne=Hh(ie.width,ie.height,x.format,x.type);for(const K of x.layerUpdates){const ve=ie.data.subarray(K*ne/ie.data.BYTES_PER_ELEMENT,(K+1)*ne/ie.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,K,ie.width,ie.height,1,ce,Se,ve)}x.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ie.width,ie.height,ie.depth,ce,Se,ie.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,ye,ie.width,ie.height,ie.depth,0,ce,Se,ie.data);else if(x.isData3DTexture)O?(te&&t.texStorage3D(n.TEXTURE_3D,ue,ye,ie.width,ie.height,ie.depth),ae&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ie.width,ie.height,ie.depth,ce,Se,ie.data)):t.texImage3D(n.TEXTURE_3D,0,ye,ie.width,ie.height,ie.depth,0,ce,Se,ie.data);else if(x.isFramebufferTexture){if(te)if(O)t.texStorage2D(n.TEXTURE_2D,ue,ye,ie.width,ie.height);else{let ne=ie.width,K=ie.height;for(let ve=0;ve<ue;ve++)t.texImage2D(n.TEXTURE_2D,ve,ye,ne,K,0,ce,Se,null),ne>>=1,K>>=1}}else if(Re.length>0){if(O&&te){const ne=_t(Re[0]);t.texStorage2D(n.TEXTURE_2D,ue,ye,ne.width,ne.height)}for(let ne=0,K=Re.length;ne<K;ne++)le=Re[ne],O?ae&&t.texSubImage2D(n.TEXTURE_2D,ne,0,0,ce,Se,le):t.texImage2D(n.TEXTURE_2D,ne,ye,ce,Se,le);x.generateMipmaps=!1}else if(O){if(te){const ne=_t(ie);t.texStorage2D(n.TEXTURE_2D,ue,ye,ne.width,ne.height)}ae&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,ce,Se,ie)}else t.texImage2D(n.TEXTURE_2D,0,ye,ce,Se,ie);A(x)&&f(Q),fe.__version=W.version,x.onUpdate&&x.onUpdate(x)}B.__version=x.version}function J(B,x,L){if(x.image.length!==6)return;const Q=Ue(B,x),j=x.source;t.bindTexture(n.TEXTURE_CUBE_MAP,B.__webglTexture,n.TEXTURE0+L);const W=i.get(j);if(j.version!==W.__version||Q===!0){t.activeTexture(n.TEXTURE0+L);const fe=Je.getPrimaries(Je.workingColorSpace),$=x.colorSpace===Rn?null:Je.getPrimaries(x.colorSpace),me=x.colorSpace===Rn||fe===$?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,x.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,x.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,me);const Ae=x.isCompressedTexture||x.image[0].isCompressedTexture,ie=x.image[0]&&x.image[0].isDataTexture,ce=[];for(let K=0;K<6;K++)!Ae&&!ie?ce[K]=g(x.image[K],!0,r.maxCubemapSize):ce[K]=ie?x.image[K].image:x.image[K],ce[K]=Et(x,ce[K]);const Se=ce[0],ye=s.convert(x.format,x.colorSpace),le=s.convert(x.type),Re=v(x.internalFormat,ye,le,x.colorSpace),O=x.isVideoTexture!==!0,te=W.__version===void 0||Q===!0,ae=j.dataReady;let ue=b(x,Se);pe(n.TEXTURE_CUBE_MAP,x);let ne;if(Ae){O&&te&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Re,Se.width,Se.height);for(let K=0;K<6;K++){ne=ce[K].mipmaps;for(let ve=0;ve<ne.length;ve++){const Qe=ne[ve];x.format!==Pt?ye!==null?O?ae&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,0,0,Qe.width,Qe.height,ye,Qe.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,Re,Qe.width,Qe.height,0,Qe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):O?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,0,0,Qe.width,Qe.height,ye,le,Qe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve,Re,Qe.width,Qe.height,0,ye,le,Qe.data)}}}else{if(ne=x.mipmaps,O&&te){ne.length>0&&ue++;const K=_t(ce[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ue,Re,K.width,K.height)}for(let K=0;K<6;K++)if(ie){O?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,ce[K].width,ce[K].height,ye,le,ce[K].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Re,ce[K].width,ce[K].height,0,ye,le,ce[K].data);for(let ve=0;ve<ne.length;ve++){const it=ne[ve].image[K].image;O?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,0,0,it.width,it.height,ye,le,it.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,Re,it.width,it.height,0,ye,le,it.data)}}else{O?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,ye,le,ce[K]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Re,ye,le,ce[K]);for(let ve=0;ve<ne.length;ve++){const Qe=ne[ve];O?ae&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,0,0,ye,le,Qe.image[K]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+K,ve+1,Re,ye,le,Qe.image[K])}}}A(x)&&f(n.TEXTURE_CUBE_MAP),W.__version=j.version,x.onUpdate&&x.onUpdate(x)}B.__version=x.version}function de(B,x,L,Q,j,W){const fe=s.convert(L.format,L.colorSpace),$=s.convert(L.type),me=v(L.internalFormat,fe,$,L.colorSpace),Ae=i.get(x),ie=i.get(L);if(ie.__renderTarget=x,!Ae.__hasExternalTextures){const ce=Math.max(1,x.width>>W),Se=Math.max(1,x.height>>W);j===n.TEXTURE_3D||j===n.TEXTURE_2D_ARRAY?t.texImage3D(j,W,me,ce,Se,x.depth,0,fe,$,null):t.texImage2D(j,W,me,ce,Se,0,fe,$,null)}t.bindFramebuffer(n.FRAMEBUFFER,B),Ee(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,Q,j,ie.__webglTexture,0,ot(x)):(j===n.TEXTURE_2D||j>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&j<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,Q,j,ie.__webglTexture,W),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ie(B,x,L){if(n.bindRenderbuffer(n.RENDERBUFFER,B),x.depthBuffer){const Q=x.depthTexture,j=Q&&Q.isDepthTexture?Q.type:null,W=_(x.stencilBuffer,j),fe=x.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,$=ot(x);Ee(x)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,$,W,x.width,x.height):L?n.renderbufferStorageMultisample(n.RENDERBUFFER,$,W,x.width,x.height):n.renderbufferStorage(n.RENDERBUFFER,W,x.width,x.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,fe,n.RENDERBUFFER,B)}else{const Q=x.textures;for(let j=0;j<Q.length;j++){const W=Q[j],fe=s.convert(W.format,W.colorSpace),$=s.convert(W.type),me=v(W.internalFormat,fe,$,W.colorSpace),Ae=ot(x);L&&Ee(x)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,Ae,me,x.width,x.height):Ee(x)?o.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Ae,me,x.width,x.height):n.renderbufferStorage(n.RENDERBUFFER,me,x.width,x.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function xe(B,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,B),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Q=i.get(x.depthTexture);Q.__renderTarget=x,(!Q.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),k(x.depthTexture,0);const j=Q.__webglTexture,W=ot(x);if(x.depthTexture.format===Gs)Ee(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0,W):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0);else if(x.depthTexture.format===Vs)Ee(x)?o.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0,W):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0);else throw new Error("Unknown depthTexture format")}function ze(B){const x=i.get(B),L=B.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==B.depthTexture){const Q=B.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),Q){const j=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,Q.removeEventListener("dispose",j)};Q.addEventListener("dispose",j),x.__depthDisposeCallback=j}x.__boundDepthTexture=Q}if(B.depthTexture&&!x.__autoAllocateDepthBuffer){if(L)throw new Error("target.depthTexture not supported in Cube render targets");const Q=B.texture.mipmaps;Q&&Q.length>0?xe(x.__webglFramebuffer[0],B):xe(x.__webglFramebuffer,B)}else if(L){x.__webglDepthbuffer=[];for(let Q=0;Q<6;Q++)if(t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer[Q]),x.__webglDepthbuffer[Q]===void 0)x.__webglDepthbuffer[Q]=n.createRenderbuffer(),Ie(x.__webglDepthbuffer[Q],B,!1);else{const j=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,W=x.__webglDepthbuffer[Q];n.bindRenderbuffer(n.RENDERBUFFER,W),n.framebufferRenderbuffer(n.FRAMEBUFFER,j,n.RENDERBUFFER,W)}}else{const Q=B.texture.mipmaps;if(Q&&Q.length>0?t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=n.createRenderbuffer(),Ie(x.__webglDepthbuffer,B,!1);else{const j=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,W=x.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,W),n.framebufferRenderbuffer(n.FRAMEBUFFER,j,n.RENDERBUFFER,W)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function St(B,x,L){const Q=i.get(B);x!==void 0&&de(Q.__webglFramebuffer,B,B.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),L!==void 0&&ze(B)}function U(B){const x=B.texture,L=i.get(B),Q=i.get(x);B.addEventListener("dispose",S);const j=B.textures,W=B.isWebGLCubeRenderTarget===!0,fe=j.length>1;if(fe||(Q.__webglTexture===void 0&&(Q.__webglTexture=n.createTexture()),Q.__version=x.version,a.memory.textures++),W){L.__webglFramebuffer=[];for(let $=0;$<6;$++)if(x.mipmaps&&x.mipmaps.length>0){L.__webglFramebuffer[$]=[];for(let me=0;me<x.mipmaps.length;me++)L.__webglFramebuffer[$][me]=n.createFramebuffer()}else L.__webglFramebuffer[$]=n.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){L.__webglFramebuffer=[];for(let $=0;$<x.mipmaps.length;$++)L.__webglFramebuffer[$]=n.createFramebuffer()}else L.__webglFramebuffer=n.createFramebuffer();if(fe)for(let $=0,me=j.length;$<me;$++){const Ae=i.get(j[$]);Ae.__webglTexture===void 0&&(Ae.__webglTexture=n.createTexture(),a.memory.textures++)}if(B.samples>0&&Ee(B)===!1){L.__webglMultisampledFramebuffer=n.createFramebuffer(),L.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,L.__webglMultisampledFramebuffer);for(let $=0;$<j.length;$++){const me=j[$];L.__webglColorRenderbuffer[$]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,L.__webglColorRenderbuffer[$]);const Ae=s.convert(me.format,me.colorSpace),ie=s.convert(me.type),ce=v(me.internalFormat,Ae,ie,me.colorSpace,B.isXRRenderTarget===!0),Se=ot(B);n.renderbufferStorageMultisample(n.RENDERBUFFER,Se,ce,B.width,B.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+$,n.RENDERBUFFER,L.__webglColorRenderbuffer[$])}n.bindRenderbuffer(n.RENDERBUFFER,null),B.depthBuffer&&(L.__webglDepthRenderbuffer=n.createRenderbuffer(),Ie(L.__webglDepthRenderbuffer,B,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(W){t.bindTexture(n.TEXTURE_CUBE_MAP,Q.__webglTexture),pe(n.TEXTURE_CUBE_MAP,x);for(let $=0;$<6;$++)if(x.mipmaps&&x.mipmaps.length>0)for(let me=0;me<x.mipmaps.length;me++)de(L.__webglFramebuffer[$][me],B,x,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,me);else de(L.__webglFramebuffer[$],B,x,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,0);A(x)&&f(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(fe){for(let $=0,me=j.length;$<me;$++){const Ae=j[$],ie=i.get(Ae);let ce=n.TEXTURE_2D;(B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&(ce=B.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(ce,ie.__webglTexture),pe(ce,Ae),de(L.__webglFramebuffer,B,Ae,n.COLOR_ATTACHMENT0+$,ce,0),A(Ae)&&f(ce)}t.unbindTexture()}else{let $=n.TEXTURE_2D;if((B.isWebGL3DRenderTarget||B.isWebGLArrayRenderTarget)&&($=B.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture($,Q.__webglTexture),pe($,x),x.mipmaps&&x.mipmaps.length>0)for(let me=0;me<x.mipmaps.length;me++)de(L.__webglFramebuffer[me],B,x,n.COLOR_ATTACHMENT0,$,me);else de(L.__webglFramebuffer,B,x,n.COLOR_ATTACHMENT0,$,0);A(x)&&f($),t.unbindTexture()}B.depthBuffer&&ze(B)}function at(B){const x=B.textures;for(let L=0,Q=x.length;L<Q;L++){const j=x[L];if(A(j)){const W=E(B),fe=i.get(j).__webglTexture;t.bindTexture(W,fe),f(W),t.unbindTexture()}}}const Ne=[],Te=[];function _e(B){if(B.samples>0){if(Ee(B)===!1){const x=B.textures,L=B.width,Q=B.height;let j=n.COLOR_BUFFER_BIT;const W=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,fe=i.get(B),$=x.length>1;if($)for(let Ae=0;Ae<x.length;Ae++)t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);const me=B.texture.mipmaps;me&&me.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let Ae=0;Ae<x.length;Ae++){if(B.resolveDepthBuffer&&(B.depthBuffer&&(j|=n.DEPTH_BUFFER_BIT),B.stencilBuffer&&B.resolveStencilBuffer&&(j|=n.STENCIL_BUFFER_BIT)),$){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,fe.__webglColorRenderbuffer[Ae]);const ie=i.get(x[Ae]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,ie,0)}n.blitFramebuffer(0,0,L,Q,0,0,L,Q,j,n.NEAREST),l===!0&&(Ne.length=0,Te.length=0,Ne.push(n.COLOR_ATTACHMENT0+Ae),B.depthBuffer&&B.resolveDepthBuffer===!1&&(Ne.push(W),Te.push(W),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Te)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,Ne))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),$)for(let Ae=0;Ae<x.length;Ae++){t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.RENDERBUFFER,fe.__webglColorRenderbuffer[Ae]);const ie=i.get(x[Ae]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,fe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Ae,n.TEXTURE_2D,ie,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(B.depthBuffer&&B.resolveDepthBuffer===!1&&l){const x=B.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[x])}}}function ot(B){return Math.min(r.maxSamples,B.samples)}function Ee(B){const x=i.get(B);return B.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function ke(B){const x=a.render.frame;u.get(B)!==x&&(u.set(B,x),B.update())}function Et(B,x){const L=B.colorSpace,Q=B.format,j=B.type;return B.isCompressedTexture===!0||B.isVideoTexture===!0||L!==Qt&&L!==Rn&&(Je.getTransfer(L)===ht?(Q!==Pt||j!==We)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",L)),x}function _t(B){return typeof HTMLImageElement<"u"&&B instanceof HTMLImageElement?(c.width=B.naturalWidth||B.width,c.height=B.naturalHeight||B.height):typeof VideoFrame<"u"&&B instanceof VideoFrame?(c.width=B.displayWidth,c.height=B.displayHeight):(c.width=B.width,c.height=B.height),c}this.allocateTextureUnit=D,this.resetTextureUnits=N,this.setTexture2D=k,this.setTexture2DArray=F,this.setTexture3D=G,this.setTextureCube=H,this.rebindTextures=St,this.setupRenderTarget=U,this.updateRenderTargetMipmap=at,this.updateMultisampleRenderTarget=_e,this.setupDepthRenderbuffer=ze,this.setupFrameBufferTexture=de,this.useMultisampledRTT=Ee}function wy(n,e){function t(i,r=Rn){let s;const a=Je.getTransfer(r);if(i===We)return n.UNSIGNED_BYTE;if(i===iu)return n.UNSIGNED_SHORT_4_4_4_4;if(i===ru)return n.UNSIGNED_SHORT_5_5_5_1;if(i===Io)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===So)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===kf)return n.BYTE;if(i===Qf)return n.SHORT;if(i===ks)return n.UNSIGNED_SHORT;if(i===nu)return n.INT;if(i===Gi)return n.UNSIGNED_INT;if(i===kt)return n.FLOAT;if(i===hn)return n.HALF_FLOAT;if(i===Hf)return n.ALPHA;if(i===Hs)return n.RGB;if(i===Pt)return n.RGBA;if(i===Gs)return n.DEPTH_COMPONENT;if(i===Vs)return n.DEPTH_STENCIL;if(i===ai)return n.RED;if(i===su)return n.RED_INTEGER;if(i===Li)return n.RG;if(i===au)return n.RG_INTEGER;if(i===ou)return n.RGBA_INTEGER;if(i===Pr||i===Ni||i===Ur||i===Ls)if(a===ht)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Pr)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Ni)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Ur)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Pr)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Ni)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Ur)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Ls)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===ro||i===_c||i===Gr||i===zs)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===ro)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===_c)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Gr)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===zs)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===so||i===Ws||i===qs)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(i===so||i===Ws)return a===ht?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===qs)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===Fi||i===Ec||i===vc||i===bc||i===Nr||i===xc||i===yc||i===Mc||i===Ic||i===Sc||i===Cc||i===wc||i===Tc||i===Rc)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Fi)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ec)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===vc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===bc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Nr)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===xc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===yc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Mc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Ic)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Sc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Cc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===wc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Tc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Rc)return a===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Vr||i===Bc||i===ao)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(i===Vr)return a===ht?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Bc)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===ao)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===oo||i===lo||i===co||i===uo)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(i===oo)return s.COMPRESSED_RED_RGTC1_EXT;if(i===lo)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===co)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===uo)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Qs?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}const Ty=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ry=`
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

}`;class By{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const i=new op(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new Kn({vertexShader:Ty,fragmentShader:Ry,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Ke(new Kr(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Ly extends ji{constructor(e,t){super();const i=this;let r=null,s=1,a=null,o="local-floor",l=1,c=null,u=null,h=null,d=null,p=null,m=null;const g=typeof XRWebGLBinding<"u",A=new By,f={},E=t.getContextAttributes();let v=null,_=null;const b=[],M=[],S=new we;let C=null;const I=new Wt;I.viewport=new nt;const y=new Wt;y.viewport=new nt;const T=[I,y],N=new kE;let D=null,P=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let J=b[Y];return J===void 0&&(J=new pl,b[Y]=J),J.getTargetRaySpace()},this.getControllerGrip=function(Y){let J=b[Y];return J===void 0&&(J=new pl,b[Y]=J),J.getGripSpace()},this.getHand=function(Y){let J=b[Y];return J===void 0&&(J=new pl,b[Y]=J),J.getHandSpace()};function k(Y){const J=M.indexOf(Y.inputSource);if(J===-1)return;const de=b[J];de!==void 0&&(de.update(Y.inputSource,Y.frame,c||a),de.dispatchEvent({type:Y.type,data:Y.inputSource}))}function F(){r.removeEventListener("select",k),r.removeEventListener("selectstart",k),r.removeEventListener("selectend",k),r.removeEventListener("squeeze",k),r.removeEventListener("squeezestart",k),r.removeEventListener("squeezeend",k),r.removeEventListener("end",F),r.removeEventListener("inputsourceschange",G);for(let Y=0;Y<b.length;Y++){const J=M[Y];J!==null&&(M[Y]=null,b[Y].disconnect(J))}D=null,P=null,A.reset();for(const Y in f)delete f[Y];e.setRenderTarget(v),p=null,d=null,h=null,r=null,_=null,Ve.stop(),i.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return h===null&&g&&(h=new XRWebGLBinding(r,t)),h},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function(Y){if(r=Y,r!==null){if(v=e.getRenderTarget(),r.addEventListener("select",k),r.addEventListener("selectstart",k),r.addEventListener("selectend",k),r.addEventListener("squeeze",k),r.addEventListener("squeezestart",k),r.addEventListener("squeezeend",k),r.addEventListener("end",F),r.addEventListener("inputsourceschange",G),E.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),g&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,Ie=null,xe=null;E.depth&&(xe=E.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=E.stencil?Vs:Gs,Ie=E.stencil?Qs:Gi);const ze={colorFormat:t.RGBA8,depthFormat:xe,scaleFactor:s};h=this.getBinding(),d=h.createProjectionLayer(ze),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),_=new Vi(d.textureWidth,d.textureHeight,{format:Pt,type:We,depthTexture:new ap(d.textureWidth,d.textureHeight,Ie,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:E.stencil,colorSpace:e.outputColorSpace,samples:E.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const de={antialias:E.antialias,alpha:!0,depth:E.depth,stencil:E.stencil,framebufferScaleFactor:s};p=new XRWebGLLayer(r,t,de),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),_=new Vi(p.framebufferWidth,p.framebufferHeight,{format:Pt,type:We,colorSpace:e.outputColorSpace,stencilBuffer:E.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await r.requestReferenceSpace(o),Ve.setContext(r),Ve.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return A.getDepthTexture()};function G(Y){for(let J=0;J<Y.removed.length;J++){const de=Y.removed[J],Ie=M.indexOf(de);Ie>=0&&(M[Ie]=null,b[Ie].disconnect(de))}for(let J=0;J<Y.added.length;J++){const de=Y.added[J];let Ie=M.indexOf(de);if(Ie===-1){for(let ze=0;ze<b.length;ze++)if(ze>=M.length){M.push(de),Ie=ze;break}else if(M[ze]===null){M[ze]=de,Ie=ze;break}if(Ie===-1)break}const xe=b[Ie];xe&&xe.connect(de)}}const H=new R,ee=new R;function Z(Y,J,de){H.setFromMatrixPosition(J.matrixWorld),ee.setFromMatrixPosition(de.matrixWorld);const Ie=H.distanceTo(ee),xe=J.projectionMatrix.elements,ze=de.projectionMatrix.elements,St=xe[14]/(xe[10]-1),U=xe[14]/(xe[10]+1),at=(xe[9]+1)/xe[5],Ne=(xe[9]-1)/xe[5],Te=(xe[8]-1)/xe[0],_e=(ze[8]+1)/ze[0],ot=St*Te,Ee=St*_e,ke=Ie/(-Te+_e),Et=ke*-Te;if(J.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Et),Y.translateZ(ke),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),xe[10]===-1)Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{const _t=St+ke,B=U+ke,x=ot-Et,L=Ee+(Ie-Et),Q=at*U/B*_t,j=Ne*U/B*_t;Y.projectionMatrix.makePerspective(x,L,Q,j,_t,B),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function se(Y,J){J===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(J.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(r===null)return;let J=Y.near,de=Y.far;A.texture!==null&&(A.depthNear>0&&(J=A.depthNear),A.depthFar>0&&(de=A.depthFar)),N.near=y.near=I.near=J,N.far=y.far=I.far=de,(D!==N.near||P!==N.far)&&(r.updateRenderState({depthNear:N.near,depthFar:N.far}),D=N.near,P=N.far),N.layers.mask=Y.layers.mask|6,I.layers.mask=N.layers.mask&3,y.layers.mask=N.layers.mask&5;const Ie=Y.parent,xe=N.cameras;se(N,Ie);for(let ze=0;ze<xe.length;ze++)se(xe[ze],Ie);xe.length===2?Z(N,I,y):N.projectionMatrix.copy(I.projectionMatrix),pe(Y,N,Ie)};function pe(Y,J,de){de===null?Y.matrix.copy(J.matrixWorld):(Y.matrix.copy(de.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(J.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=zr*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return N},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return A.texture!==null},this.getDepthSensingMesh=function(){return A.getMesh(N)},this.getCameraTexture=function(Y){return f[Y]};let Ue=null;function qe(Y,J){if(u=J.getViewerPose(c||a),m=J,u!==null){const de=u.views;p!==null&&(e.setRenderTargetFramebuffer(_,p.framebuffer),e.setRenderTarget(_));let Ie=!1;de.length!==N.cameras.length&&(N.cameras.length=0,Ie=!0);for(let U=0;U<de.length;U++){const at=de[U];let Ne=null;if(p!==null)Ne=p.getViewport(at);else{const _e=h.getViewSubImage(d,at);Ne=_e.viewport,U===0&&(e.setRenderTargetTextures(_,_e.colorTexture,_e.depthStencilTexture),e.setRenderTarget(_))}let Te=T[U];Te===void 0&&(Te=new Wt,Te.layers.enable(U),Te.viewport=new nt,T[U]=Te),Te.matrix.fromArray(at.transform.matrix),Te.matrix.decompose(Te.position,Te.quaternion,Te.scale),Te.projectionMatrix.fromArray(at.projectionMatrix),Te.projectionMatrixInverse.copy(Te.projectionMatrix).invert(),Te.viewport.set(Ne.x,Ne.y,Ne.width,Ne.height),U===0&&(N.matrix.copy(Te.matrix),N.matrix.decompose(N.position,N.quaternion,N.scale)),Ie===!0&&N.cameras.push(Te)}const xe=r.enabledFeatures;if(xe&&xe.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&g){h=i.getBinding();const U=h.getDepthInformation(de[0]);U&&U.isValid&&U.texture&&A.init(U,r.renderState)}if(xe&&xe.includes("camera-access")&&g){e.state.unbindTexture(),h=i.getBinding();for(let U=0;U<de.length;U++){const at=de[U].camera;if(at){let Ne=f[at];Ne||(Ne=new op,f[at]=Ne);const Te=h.getCameraImage(at);Ne.sourceTexture=Te}}}}for(let de=0;de<b.length;de++){const Ie=M[de],xe=b[de];Ie!==null&&xe!==void 0&&xe.update(Ie,J,c||a)}Ue&&Ue(Y,J),J.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:J}),m=null}const Ve=new pp;Ve.setAnimationLoop(qe),this.setAnimationLoop=function(Y){Ue=Y},this.dispose=function(){}}}const vi=new jt,Dy=new De;function Py(n,e){function t(A,f){A.matrixAutoUpdate===!0&&A.updateMatrix(),f.value.copy(A.matrix)}function i(A,f){f.color.getRGB(A.fogColor.value,Jf(n)),f.isFog?(A.fogNear.value=f.near,A.fogFar.value=f.far):f.isFogExp2&&(A.fogDensity.value=f.density)}function r(A,f,E,v,_){f.isMeshBasicMaterial||f.isMeshLambertMaterial?s(A,f):f.isMeshToonMaterial?(s(A,f),h(A,f)):f.isMeshPhongMaterial?(s(A,f),u(A,f)):f.isMeshStandardMaterial?(s(A,f),d(A,f),f.isMeshPhysicalMaterial&&p(A,f,_)):f.isMeshMatcapMaterial?(s(A,f),m(A,f)):f.isMeshDepthMaterial?s(A,f):f.isMeshDistanceMaterial?(s(A,f),g(A,f)):f.isMeshNormalMaterial?s(A,f):f.isLineBasicMaterial?(a(A,f),f.isLineDashedMaterial&&o(A,f)):f.isPointsMaterial?l(A,f,E,v):f.isSpriteMaterial?c(A,f):f.isShadowMaterial?(A.color.value.copy(f.color),A.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function s(A,f){A.opacity.value=f.opacity,f.color&&A.diffuse.value.copy(f.color),f.emissive&&A.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(A.map.value=f.map,t(f.map,A.mapTransform)),f.alphaMap&&(A.alphaMap.value=f.alphaMap,t(f.alphaMap,A.alphaMapTransform)),f.bumpMap&&(A.bumpMap.value=f.bumpMap,t(f.bumpMap,A.bumpMapTransform),A.bumpScale.value=f.bumpScale,f.side===qt&&(A.bumpScale.value*=-1)),f.normalMap&&(A.normalMap.value=f.normalMap,t(f.normalMap,A.normalMapTransform),A.normalScale.value.copy(f.normalScale),f.side===qt&&A.normalScale.value.negate()),f.displacementMap&&(A.displacementMap.value=f.displacementMap,t(f.displacementMap,A.displacementMapTransform),A.displacementScale.value=f.displacementScale,A.displacementBias.value=f.displacementBias),f.emissiveMap&&(A.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,A.emissiveMapTransform)),f.specularMap&&(A.specularMap.value=f.specularMap,t(f.specularMap,A.specularMapTransform)),f.alphaTest>0&&(A.alphaTest.value=f.alphaTest);const E=e.get(f),v=E.envMap,_=E.envMapRotation;v&&(A.envMap.value=v,vi.copy(_),vi.x*=-1,vi.y*=-1,vi.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(vi.y*=-1,vi.z*=-1),A.envMapRotation.value.setFromMatrix4(Dy.makeRotationFromEuler(vi)),A.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,A.reflectivity.value=f.reflectivity,A.ior.value=f.ior,A.refractionRatio.value=f.refractionRatio),f.lightMap&&(A.lightMap.value=f.lightMap,A.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,A.lightMapTransform)),f.aoMap&&(A.aoMap.value=f.aoMap,A.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,A.aoMapTransform))}function a(A,f){A.diffuse.value.copy(f.color),A.opacity.value=f.opacity,f.map&&(A.map.value=f.map,t(f.map,A.mapTransform))}function o(A,f){A.dashSize.value=f.dashSize,A.totalSize.value=f.dashSize+f.gapSize,A.scale.value=f.scale}function l(A,f,E,v){A.diffuse.value.copy(f.color),A.opacity.value=f.opacity,A.size.value=f.size*E,A.scale.value=v*.5,f.map&&(A.map.value=f.map,t(f.map,A.uvTransform)),f.alphaMap&&(A.alphaMap.value=f.alphaMap,t(f.alphaMap,A.alphaMapTransform)),f.alphaTest>0&&(A.alphaTest.value=f.alphaTest)}function c(A,f){A.diffuse.value.copy(f.color),A.opacity.value=f.opacity,A.rotation.value=f.rotation,f.map&&(A.map.value=f.map,t(f.map,A.mapTransform)),f.alphaMap&&(A.alphaMap.value=f.alphaMap,t(f.alphaMap,A.alphaMapTransform)),f.alphaTest>0&&(A.alphaTest.value=f.alphaTest)}function u(A,f){A.specular.value.copy(f.specular),A.shininess.value=Math.max(f.shininess,1e-4)}function h(A,f){f.gradientMap&&(A.gradientMap.value=f.gradientMap)}function d(A,f){A.metalness.value=f.metalness,f.metalnessMap&&(A.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,A.metalnessMapTransform)),A.roughness.value=f.roughness,f.roughnessMap&&(A.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,A.roughnessMapTransform)),f.envMap&&(A.envMapIntensity.value=f.envMapIntensity)}function p(A,f,E){A.ior.value=f.ior,f.sheen>0&&(A.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),A.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(A.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,A.sheenColorMapTransform)),f.sheenRoughnessMap&&(A.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,A.sheenRoughnessMapTransform))),f.clearcoat>0&&(A.clearcoat.value=f.clearcoat,A.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(A.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,A.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(A.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,A.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(A.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,A.clearcoatNormalMapTransform),A.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===qt&&A.clearcoatNormalScale.value.negate())),f.dispersion>0&&(A.dispersion.value=f.dispersion),f.iridescence>0&&(A.iridescence.value=f.iridescence,A.iridescenceIOR.value=f.iridescenceIOR,A.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],A.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(A.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,A.iridescenceMapTransform)),f.iridescenceThicknessMap&&(A.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,A.iridescenceThicknessMapTransform))),f.transmission>0&&(A.transmission.value=f.transmission,A.transmissionSamplerMap.value=E.texture,A.transmissionSamplerSize.value.set(E.width,E.height),f.transmissionMap&&(A.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,A.transmissionMapTransform)),A.thickness.value=f.thickness,f.thicknessMap&&(A.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,A.thicknessMapTransform)),A.attenuationDistance.value=f.attenuationDistance,A.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(A.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(A.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,A.anisotropyMapTransform))),A.specularIntensity.value=f.specularIntensity,A.specularColor.value.copy(f.specularColor),f.specularColorMap&&(A.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,A.specularColorMapTransform)),f.specularIntensityMap&&(A.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,A.specularIntensityMapTransform))}function m(A,f){f.matcap&&(A.matcap.value=f.matcap)}function g(A,f){const E=e.get(f).light;A.referencePosition.value.setFromMatrixPosition(E.matrixWorld),A.nearDistance.value=E.shadow.camera.near,A.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Uy(n,e,t,i){let r={},s={},a=[];const o=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(E,v){const _=v.program;i.uniformBlockBinding(E,_)}function c(E,v){let _=r[E.id];_===void 0&&(m(E),_=u(E),r[E.id]=_,E.addEventListener("dispose",A));const b=v.program;i.updateUBOMapping(E,b);const M=e.render.frame;s[E.id]!==M&&(d(E),s[E.id]=M)}function u(E){const v=h();E.__bindingPointIndex=v;const _=n.createBuffer(),b=E.__size,M=E.usage;return n.bindBuffer(n.UNIFORM_BUFFER,_),n.bufferData(n.UNIFORM_BUFFER,b,M),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,v,_),_}function h(){for(let E=0;E<o;E++)if(a.indexOf(E)===-1)return a.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(E){const v=r[E.id],_=E.uniforms,b=E.__cache;n.bindBuffer(n.UNIFORM_BUFFER,v);for(let M=0,S=_.length;M<S;M++){const C=Array.isArray(_[M])?_[M]:[_[M]];for(let I=0,y=C.length;I<y;I++){const T=C[I];if(p(T,M,I,b)===!0){const N=T.__offset,D=Array.isArray(T.value)?T.value:[T.value];let P=0;for(let k=0;k<D.length;k++){const F=D[k],G=g(F);typeof F=="number"||typeof F=="boolean"?(T.__data[0]=F,n.bufferSubData(n.UNIFORM_BUFFER,N+P,T.__data)):F.isMatrix3?(T.__data[0]=F.elements[0],T.__data[1]=F.elements[1],T.__data[2]=F.elements[2],T.__data[3]=0,T.__data[4]=F.elements[3],T.__data[5]=F.elements[4],T.__data[6]=F.elements[5],T.__data[7]=0,T.__data[8]=F.elements[6],T.__data[9]=F.elements[7],T.__data[10]=F.elements[8],T.__data[11]=0):(F.toArray(T.__data,P),P+=G.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,N,T.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function p(E,v,_,b){const M=E.value,S=v+"_"+_;if(b[S]===void 0)return typeof M=="number"||typeof M=="boolean"?b[S]=M:b[S]=M.clone(),!0;{const C=b[S];if(typeof M=="number"||typeof M=="boolean"){if(C!==M)return b[S]=M,!0}else if(C.equals(M)===!1)return C.copy(M),!0}return!1}function m(E){const v=E.uniforms;let _=0;const b=16;for(let S=0,C=v.length;S<C;S++){const I=Array.isArray(v[S])?v[S]:[v[S]];for(let y=0,T=I.length;y<T;y++){const N=I[y],D=Array.isArray(N.value)?N.value:[N.value];for(let P=0,k=D.length;P<k;P++){const F=D[P],G=g(F),H=_%b,ee=H%G.boundary,Z=H+ee;_+=ee,Z!==0&&b-Z<G.storage&&(_+=b-Z),N.__data=new Float32Array(G.storage/Float32Array.BYTES_PER_ELEMENT),N.__offset=_,_+=G.storage}}}const M=_%b;return M>0&&(_+=b-M),E.__size=_,E.__cache={},this}function g(E){const v={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(v.boundary=4,v.storage=4):E.isVector2?(v.boundary=8,v.storage=8):E.isVector3||E.isColor?(v.boundary=16,v.storage=12):E.isVector4?(v.boundary=16,v.storage=16):E.isMatrix3?(v.boundary=48,v.storage=48):E.isMatrix4?(v.boundary=64,v.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),v}function A(E){const v=E.target;v.removeEventListener("dispose",A);const _=a.indexOf(v.__bindingPointIndex);a.splice(_,1),n.deleteBuffer(r[v.id]),delete r[v.id],delete s[v.id]}function f(){for(const E in r)n.deleteBuffer(r[E]);a=[],r={},s={}}return{bind:l,update:c,dispose:f}}class Ny{constructor(e={}){const{canvas:t=Q_(),context:i=null,depth:r=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:d=!1}=e;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=a;const m=new Uint32Array(4),g=new Int32Array(4);let A=null,f=null;const E=[],v=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=li,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const _=this;let b=!1;this._outputColorSpace=Ct;let M=0,S=0,C=null,I=-1,y=null;const T=new nt,N=new nt;let D=null;const P=new be(0);let k=0,F=t.width,G=t.height,H=1,ee=null,Z=null;const se=new nt(0,0,F,G),pe=new nt(0,0,F,G);let Ue=!1;const qe=new pu;let Ve=!1,Y=!1;const J=new De,de=new R,Ie=new nt,xe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let ze=!1;function St(){return C===null?H:1}let U=i;function at(w,V){return t.getContext(w,V)}try{const w={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${ki}`),t.addEventListener("webglcontextlost",ae,!1),t.addEventListener("webglcontextrestored",ue,!1),t.addEventListener("webglcontextcreationerror",ne,!1),U===null){const V="webgl2";if(U=at(V,w),U===null)throw at(V)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let Ne,Te,_e,ot,Ee,ke,Et,_t,B,x,L,Q,j,W,fe,$,me,Ae,ie,ce,Se,ye,le,Re;function O(){Ne=new qb(U),Ne.init(),ye=new wy(U,Ne),Te=new kb(U,Ne,e,ye),_e=new Sy(U,Ne),Te.reversedDepthBuffer&&d&&_e.buffers.depth.setReversed(!0),ot=new Yb(U),Ee=new fy,ke=new Cy(U,Ne,_e,Ee,Te,ye,ot),Et=new Hb(_),_t=new Wb(_),B=new t0(U),le=new Fb(U,B),x=new jb(U,B,ot,le),L=new Jb(U,x,B,ot),ie=new Kb(U,Te,ke),$=new Qb(Ee),Q=new dy(_,Et,_t,Ne,Te,le,$),j=new Py(_,Ee),W=new Ay,fe=new by(Ne),Ae=new Nb(_,Et,_t,_e,L,p,l),me=new My(_,L,Te),Re=new Uy(U,ot,Te,_e),ce=new Ob(U,Ne,ot),Se=new Xb(U,Ne,ot),ot.programs=Q.programs,_.capabilities=Te,_.extensions=Ne,_.properties=Ee,_.renderLists=W,_.shadowMap=me,_.state=_e,_.info=ot}O();const te=new Ly(_,U);this.xr=te,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){const w=Ne.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=Ne.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return H},this.setPixelRatio=function(w){w!==void 0&&(H=w,this.setSize(F,G,!1))},this.getSize=function(w){return w.set(F,G)},this.setSize=function(w,V,q=!0){if(te.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}F=w,G=V,t.width=Math.floor(w*H),t.height=Math.floor(V*H),q===!0&&(t.style.width=w+"px",t.style.height=V+"px"),this.setViewport(0,0,w,V)},this.getDrawingBufferSize=function(w){return w.set(F*H,G*H).floor()},this.setDrawingBufferSize=function(w,V,q){F=w,G=V,H=q,t.width=Math.floor(w*q),t.height=Math.floor(V*q),this.setViewport(0,0,w,V)},this.getCurrentViewport=function(w){return w.copy(T)},this.getViewport=function(w){return w.copy(se)},this.setViewport=function(w,V,q,X){w.isVector4?se.set(w.x,w.y,w.z,w.w):se.set(w,V,q,X),_e.viewport(T.copy(se).multiplyScalar(H).round())},this.getScissor=function(w){return w.copy(pe)},this.setScissor=function(w,V,q,X){w.isVector4?pe.set(w.x,w.y,w.z,w.w):pe.set(w,V,q,X),_e.scissor(N.copy(pe).multiplyScalar(H).round())},this.getScissorTest=function(){return Ue},this.setScissorTest=function(w){_e.setScissorTest(Ue=w)},this.setOpaqueSort=function(w){ee=w},this.setTransparentSort=function(w){Z=w},this.getClearColor=function(w){return w.copy(Ae.getClearColor())},this.setClearColor=function(){Ae.setClearColor(...arguments)},this.getClearAlpha=function(){return Ae.getClearAlpha()},this.setClearAlpha=function(){Ae.setClearAlpha(...arguments)},this.clear=function(w=!0,V=!0,q=!0){let X=0;if(w){let z=!1;if(C!==null){const re=C.texture.format;z=re===ou||re===au||re===su}if(z){const re=C.texture.type,he=re===We||re===Gi||re===ks||re===Qs||re===iu||re===ru,Me=Ae.getClearColor(),ge=Ae.getClearAlpha(),Pe=Me.r,Fe=Me.g,Ce=Me.b;he?(m[0]=Pe,m[1]=Fe,m[2]=Ce,m[3]=ge,U.clearBufferuiv(U.COLOR,0,m)):(g[0]=Pe,g[1]=Fe,g[2]=Ce,g[3]=ge,U.clearBufferiv(U.COLOR,0,g))}else X|=U.COLOR_BUFFER_BIT}V&&(X|=U.DEPTH_BUFFER_BIT),q&&(X|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),U.clear(X)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ae,!1),t.removeEventListener("webglcontextrestored",ue,!1),t.removeEventListener("webglcontextcreationerror",ne,!1),Ae.dispose(),W.dispose(),fe.dispose(),Ee.dispose(),Et.dispose(),_t.dispose(),L.dispose(),le.dispose(),Re.dispose(),Q.dispose(),te.dispose(),te.removeEventListener("sessionstart",rn),te.removeEventListener("sessionend",es),Un.stop()};function ae(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),b=!0}function ue(){console.log("THREE.WebGLRenderer: Context Restored."),b=!1;const w=ot.autoReset,V=me.enabled,q=me.autoUpdate,X=me.needsUpdate,z=me.type;O(),ot.autoReset=w,me.enabled=V,me.autoUpdate=q,me.needsUpdate=X,me.type=z}function ne(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function K(w){const V=w.target;V.removeEventListener("dispose",K),ve(V)}function ve(w){Qe(w),Ee.remove(w)}function Qe(w){const V=Ee.get(w).programs;V!==void 0&&(V.forEach(function(q){Q.releaseProgram(q)}),w.isShaderMaterial&&Q.releaseShaderCache(w))}this.renderBufferDirect=function(w,V,q,X,z,re){V===null&&(V=xe);const he=z.isMesh&&z.matrixWorld.determinant()<0,Me=Tu(w,V,q,X,z);_e.setMaterial(X,he);let ge=q.index,Pe=1;if(X.wireframe===!0){if(ge=x.getWireframeAttribute(q),ge===void 0)return;Pe=2}const Fe=q.drawRange,Ce=q.attributes.position;let Ye=Fe.start*Pe,ut=(Fe.start+Fe.count)*Pe;re!==null&&(Ye=Math.max(Ye,re.start*Pe),ut=Math.min(ut,(re.start+re.count)*Pe)),ge!==null?(Ye=Math.max(Ye,0),ut=Math.min(ut,ge.count)):Ce!=null&&(Ye=Math.max(Ye,0),ut=Math.min(ut,Ce.count));const xt=ut-Ye;if(xt<0||xt===1/0)return;le.setup(z,X,Me,q,ge);let pt,ft=ce;if(ge!==null&&(pt=B.get(ge),ft=Se,ft.setIndex(pt)),z.isMesh)X.wireframe===!0?(_e.setLineWidth(X.wireframeLinewidth*St()),ft.setMode(U.LINES)):ft.setMode(U.TRIANGLES);else if(z.isLine){let Be=X.linewidth;Be===void 0&&(Be=1),_e.setLineWidth(Be*St()),z.isLineSegments?ft.setMode(U.LINES):z.isLineLoop?ft.setMode(U.LINE_LOOP):ft.setMode(U.LINE_STRIP)}else z.isPoints?ft.setMode(U.POINTS):z.isSprite&&ft.setMode(U.TRIANGLES);if(z.isBatchedMesh)if(z._multiDrawInstances!==null)Ks("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),ft.renderMultiDrawInstances(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount,z._multiDrawInstances);else if(Ne.get("WEBGL_multi_draw"))ft.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Be=z._multiDrawStarts,vt=z._multiDrawCounts,$e=z._multiDrawCount,Jt=ge?B.get(ge).bytesPerElement:1,$i=Ee.get(X).currentProgram.getUniforms();for(let Zt=0;Zt<$e;Zt++)$i.setValue(U,"_gl_DrawID",Zt),ft.render(Be[Zt]/Jt,vt[Zt])}else if(z.isInstancedMesh)ft.renderInstances(Ye,xt,z.count);else if(q.isInstancedBufferGeometry){const Be=q._maxInstanceCount!==void 0?q._maxInstanceCount:1/0,vt=Math.min(q.instanceCount,Be);ft.renderInstances(Ye,xt,vt)}else ft.render(Ye,xt)};function it(w,V,q){w.transparent===!0&&w.side===tn&&w.forceSinglePass===!1?(w.side=qt,w.needsUpdate=!0,ci(w,V,q),w.side=Yn,w.needsUpdate=!0,ci(w,V,q),w.side=tn):ci(w,V,q)}this.compile=function(w,V,q=null){q===null&&(q=w),f=fe.get(q),f.init(V),v.push(f),q.traverseVisible(function(z){z.isLight&&z.layers.test(V.layers)&&(f.pushLight(z),z.castShadow&&f.pushShadow(z))}),w!==q&&w.traverseVisible(function(z){z.isLight&&z.layers.test(V.layers)&&(f.pushLight(z),z.castShadow&&f.pushShadow(z))}),f.setupLights();const X=new Set;return w.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const re=z.material;if(re)if(Array.isArray(re))for(let he=0;he<re.length;he++){const Me=re[he];it(Me,q,z),X.add(Me)}else it(re,q,z),X.add(re)}),f=v.pop(),X},this.compileAsync=function(w,V,q=null){const X=this.compile(w,V,q);return new Promise(z=>{function re(){if(X.forEach(function(he){Ee.get(he).currentProgram.isReady()&&X.delete(he)}),X.size===0){z(w);return}setTimeout(re,10)}Ne.get("KHR_parallel_shader_compile")!==null?re():setTimeout(re,10)})};let Ze=null;function pn(w){Ze&&Ze(w)}function rn(){Un.stop()}function es(){Un.start()}const Un=new pp;Un.setAnimationLoop(pn),typeof self<"u"&&Un.setContext(self),this.setAnimationLoop=function(w){Ze=w,te.setAnimationLoop(w),w===null?Un.stop():Un.start()},te.addEventListener("sessionstart",rn),te.addEventListener("sessionend",es),this.render=function(w,V){if(V!==void 0&&V.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(b===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),te.enabled===!0&&te.isPresenting===!0&&(te.cameraAutoUpdate===!0&&te.updateCamera(V),V=te.getCamera()),w.isScene===!0&&w.onBeforeRender(_,w,V,C),f=fe.get(w,v.length),f.init(V),v.push(f),J.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),qe.setFromProjectionMatrix(J,Bn,V.reversedDepth),Y=this.localClippingEnabled,Ve=$.init(this.clippingPlanes,Y),A=W.get(w,E.length),A.init(),E.push(A),te.enabled===!0&&te.isPresenting===!0){const re=_.xr.getDepthSensingMesh();re!==null&&ts(re,V,-1/0,_.sortObjects)}ts(w,V,0,_.sortObjects),A.finish(),_.sortObjects===!0&&A.sort(ee,Z),ze=te.enabled===!1||te.isPresenting===!1||te.hasDepthSensing()===!1,ze&&Ae.addToRenderList(A,w),this.info.render.frame++,Ve===!0&&$.beginShadows();const q=f.state.shadowsArray;me.render(q,w,V),Ve===!0&&$.endShadows(),this.info.autoReset===!0&&this.info.reset();const X=A.opaque,z=A.transmissive;if(f.setupLights(),V.isArrayCamera){const re=V.cameras;if(z.length>0)for(let he=0,Me=re.length;he<Me;he++){const ge=re[he];ta(X,z,w,ge)}ze&&Ae.render(w);for(let he=0,Me=re.length;he<Me;he++){const ge=re[he];ea(A,w,ge,ge.viewport)}}else z.length>0&&ta(X,z,w,V),ze&&Ae.render(w),ea(A,w,V);C!==null&&S===0&&(ke.updateMultisampleRenderTarget(C),ke.updateRenderTargetMipmap(C)),w.isScene===!0&&w.onAfterRender(_,w,V),le.resetDefaultState(),I=-1,y=null,v.pop(),v.length>0?(f=v[v.length-1],Ve===!0&&$.setGlobalState(_.clippingPlanes,f.state.camera)):f=null,E.pop(),E.length>0?A=E[E.length-1]:A=null};function ts(w,V,q,X){if(w.visible===!1)return;if(w.layers.test(V.layers)){if(w.isGroup)q=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(V);else if(w.isLight)f.pushLight(w),w.castShadow&&f.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||qe.intersectsSprite(w)){X&&Ie.setFromMatrixPosition(w.matrixWorld).applyMatrix4(J);const he=L.update(w),Me=w.material;Me.visible&&A.push(w,he,Me,q,Ie.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||qe.intersectsObject(w))){const he=L.update(w),Me=w.material;if(X&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Ie.copy(w.boundingSphere.center)):(he.boundingSphere===null&&he.computeBoundingSphere(),Ie.copy(he.boundingSphere.center)),Ie.applyMatrix4(w.matrixWorld).applyMatrix4(J)),Array.isArray(Me)){const ge=he.groups;for(let Pe=0,Fe=ge.length;Pe<Fe;Pe++){const Ce=ge[Pe],Ye=Me[Ce.materialIndex];Ye&&Ye.visible&&A.push(w,he,Ye,q,Ie.z,Ce)}}else Me.visible&&A.push(w,he,Me,q,Ie.z,null)}}const re=w.children;for(let he=0,Me=re.length;he<Me;he++)ts(re[he],V,q,X)}function ea(w,V,q,X){const z=w.opaque,re=w.transmissive,he=w.transparent;f.setupLightsView(q),Ve===!0&&$.setGlobalState(_.clippingPlanes,q),X&&_e.viewport(T.copy(X)),z.length>0&&Ki(z,V,q),re.length>0&&Ki(re,V,q),he.length>0&&Ki(he,V,q),_e.buffers.depth.setTest(!0),_e.buffers.depth.setMask(!0),_e.buffers.color.setMask(!0),_e.setPolygonOffset(!1)}function ta(w,V,q,X){if((q.isScene===!0?q.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[X.id]===void 0&&(f.state.transmissionRenderTarget[X.id]=new Vi(1,1,{generateMipmaps:!0,type:Ne.has("EXT_color_buffer_half_float")||Ne.has("EXT_color_buffer_float")?hn:We,minFilter:vn,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Je.workingColorSpace}));const re=f.state.transmissionRenderTarget[X.id],he=X.viewport||T;re.setSize(he.z*_.transmissionResolutionScale,he.w*_.transmissionResolutionScale);const Me=_.getRenderTarget(),ge=_.getActiveCubeFace(),Pe=_.getActiveMipmapLevel();_.setRenderTarget(re),_.getClearColor(P),k=_.getClearAlpha(),k<1&&_.setClearColor(16777215,.5),_.clear(),ze&&Ae.render(q);const Fe=_.toneMapping;_.toneMapping=li;const Ce=X.viewport;if(X.viewport!==void 0&&(X.viewport=void 0),f.setupLightsView(X),Ve===!0&&$.setGlobalState(_.clippingPlanes,X),Ki(w,q,X),ke.updateMultisampleRenderTarget(re),ke.updateRenderTargetMipmap(re),Ne.has("WEBGL_multisampled_render_to_texture")===!1){let Ye=!1;for(let ut=0,xt=V.length;ut<xt;ut++){const pt=V[ut],ft=pt.object,Be=pt.geometry,vt=pt.material,$e=pt.group;if(vt.side===tn&&ft.layers.test(X.layers)){const Jt=vt.side;vt.side=qt,vt.needsUpdate=!0,Ji(ft,q,X,Be,vt,$e),vt.side=Jt,vt.needsUpdate=!0,Ye=!0}}Ye===!0&&(ke.updateMultisampleRenderTarget(re),ke.updateRenderTargetMipmap(re))}_.setRenderTarget(Me,ge,Pe),_.setClearColor(P,k),Ce!==void 0&&(X.viewport=Ce),_.toneMapping=Fe}function Ki(w,V,q){const X=V.isScene===!0?V.overrideMaterial:null;for(let z=0,re=w.length;z<re;z++){const he=w[z],Me=he.object,ge=he.geometry,Pe=he.group;let Fe=he.material;Fe.allowOverride===!0&&X!==null&&(Fe=X),Me.layers.test(q.layers)&&Ji(Me,V,q,ge,Fe,Pe)}}function Ji(w,V,q,X,z,re){w.onBeforeRender(_,V,q,X,z,re),w.modelViewMatrix.multiplyMatrices(q.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),z.onBeforeRender(_,V,q,X,w,re),z.transparent===!0&&z.side===tn&&z.forceSinglePass===!1?(z.side=qt,z.needsUpdate=!0,_.renderBufferDirect(q,V,X,z,w,re),z.side=Yn,z.needsUpdate=!0,_.renderBufferDirect(q,V,X,z,w,re),z.side=tn):_.renderBufferDirect(q,V,X,z,w,re),w.onAfterRender(_,V,q,X,z,re)}function ci(w,V,q){V.isScene!==!0&&(V=xe);const X=Ee.get(w),z=f.state.lights,re=f.state.shadowsArray,he=z.state.version,Me=Q.getParameters(w,z.state,re,V,q),ge=Q.getProgramCacheKey(Me);let Pe=X.programs;X.environment=w.isMeshStandardMaterial?V.environment:null,X.fog=V.fog,X.envMap=(w.isMeshStandardMaterial?_t:Et).get(w.envMap||X.environment),X.envMapRotation=X.environment!==null&&w.envMap===null?V.environmentRotation:w.envMapRotation,Pe===void 0&&(w.addEventListener("dispose",K),Pe=new Map,X.programs=Pe);let Fe=Pe.get(ge);if(Fe!==void 0){if(X.currentProgram===Fe&&X.lightsStateVersion===he)return ia(w,Me),Fe}else Me.uniforms=Q.getUniforms(w),w.onBeforeCompile(Me,_),Fe=Q.acquireProgram(Me,ge),Pe.set(ge,Fe),X.uniforms=Me.uniforms;const Ce=X.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ce.clippingPlanes=$.uniform),ia(w,Me),X.needsLights=ra(w),X.lightsStateVersion=he,X.needsLights&&(Ce.ambientLightColor.value=z.state.ambient,Ce.lightProbe.value=z.state.probe,Ce.directionalLights.value=z.state.directional,Ce.directionalLightShadows.value=z.state.directionalShadow,Ce.spotLights.value=z.state.spot,Ce.spotLightShadows.value=z.state.spotShadow,Ce.rectAreaLights.value=z.state.rectArea,Ce.ltc_1.value=z.state.rectAreaLTC1,Ce.ltc_2.value=z.state.rectAreaLTC2,Ce.pointLights.value=z.state.point,Ce.pointLightShadows.value=z.state.pointShadow,Ce.hemisphereLights.value=z.state.hemi,Ce.directionalShadowMap.value=z.state.directionalShadowMap,Ce.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Ce.spotShadowMap.value=z.state.spotShadowMap,Ce.spotLightMatrix.value=z.state.spotLightMatrix,Ce.spotLightMap.value=z.state.spotLightMap,Ce.pointShadowMap.value=z.state.pointShadowMap,Ce.pointShadowMatrix.value=z.state.pointShadowMatrix),X.currentProgram=Fe,X.uniformsList=null,Fe}function na(w){if(w.uniformsList===null){const V=w.currentProgram.getUniforms();w.uniformsList=ja.seqWithValue(V.seq,w.uniforms)}return w.uniformsList}function ia(w,V){const q=Ee.get(w);q.outputColorSpace=V.outputColorSpace,q.batching=V.batching,q.batchingColor=V.batchingColor,q.instancing=V.instancing,q.instancingColor=V.instancingColor,q.instancingMorph=V.instancingMorph,q.skinning=V.skinning,q.morphTargets=V.morphTargets,q.morphNormals=V.morphNormals,q.morphColors=V.morphColors,q.morphTargetsCount=V.morphTargetsCount,q.numClippingPlanes=V.numClippingPlanes,q.numIntersection=V.numClipIntersection,q.vertexAlphas=V.vertexAlphas,q.vertexTangents=V.vertexTangents,q.toneMapping=V.toneMapping}function Tu(w,V,q,X,z){V.isScene!==!0&&(V=xe),ke.resetTextureUnits();const re=V.fog,he=X.isMeshStandardMaterial?V.environment:null,Me=C===null?_.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:Qt,ge=(X.isMeshStandardMaterial?_t:Et).get(X.envMap||he),Pe=X.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,Fe=!!q.attributes.tangent&&(!!X.normalMap||X.anisotropy>0),Ce=!!q.morphAttributes.position,Ye=!!q.morphAttributes.normal,ut=!!q.morphAttributes.color;let xt=li;X.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(xt=_.toneMapping);const pt=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,ft=pt!==void 0?pt.length:0,Be=Ee.get(X),vt=f.state.lights;if(Ve===!0&&(Y===!0||w!==y)){const Ht=w===y&&X.id===I;$.setState(X,w,Ht)}let $e=!1;X.version===Be.__version?(Be.needsLights&&Be.lightsStateVersion!==vt.state.version||Be.outputColorSpace!==Me||z.isBatchedMesh&&Be.batching===!1||!z.isBatchedMesh&&Be.batching===!0||z.isBatchedMesh&&Be.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Be.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Be.instancing===!1||!z.isInstancedMesh&&Be.instancing===!0||z.isSkinnedMesh&&Be.skinning===!1||!z.isSkinnedMesh&&Be.skinning===!0||z.isInstancedMesh&&Be.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Be.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Be.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Be.instancingMorph===!1&&z.morphTexture!==null||Be.envMap!==ge||X.fog===!0&&Be.fog!==re||Be.numClippingPlanes!==void 0&&(Be.numClippingPlanes!==$.numPlanes||Be.numIntersection!==$.numIntersection)||Be.vertexAlphas!==Pe||Be.vertexTangents!==Fe||Be.morphTargets!==Ce||Be.morphNormals!==Ye||Be.morphColors!==ut||Be.toneMapping!==xt||Be.morphTargetsCount!==ft)&&($e=!0):($e=!0,Be.__version=X.version);let Jt=Be.currentProgram;$e===!0&&(Jt=ci(X,V,z));let $i=!1,Zt=!1,ns=!1;const bt=Jt.getUniforms(),sn=Be.uniforms;if(_e.useProgram(Jt.program)&&($i=!0,Zt=!0,ns=!0),X.id!==I&&(I=X.id,Zt=!0),$i||y!==w){_e.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),bt.setValue(U,"projectionMatrix",w.projectionMatrix),bt.setValue(U,"viewMatrix",w.matrixWorldInverse);const Xt=bt.map.cameraPosition;Xt!==void 0&&Xt.setValue(U,de.setFromMatrixPosition(w.matrixWorld)),Te.logarithmicDepthBuffer&&bt.setValue(U,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(X.isMeshPhongMaterial||X.isMeshToonMaterial||X.isMeshLambertMaterial||X.isMeshBasicMaterial||X.isMeshStandardMaterial||X.isShaderMaterial)&&bt.setValue(U,"isOrthographic",w.isOrthographicCamera===!0),y!==w&&(y=w,Zt=!0,ns=!0)}if(z.isSkinnedMesh){bt.setOptional(U,z,"bindMatrix"),bt.setOptional(U,z,"bindMatrixInverse");const Ht=z.skeleton;Ht&&(Ht.boneTexture===null&&Ht.computeBoneTexture(),bt.setValue(U,"boneTexture",Ht.boneTexture,ke))}z.isBatchedMesh&&(bt.setOptional(U,z,"batchingTexture"),bt.setValue(U,"batchingTexture",z._matricesTexture,ke),bt.setOptional(U,z,"batchingIdTexture"),bt.setValue(U,"batchingIdTexture",z._indirectTexture,ke),bt.setOptional(U,z,"batchingColorTexture"),z._colorsTexture!==null&&bt.setValue(U,"batchingColorTexture",z._colorsTexture,ke));const an=q.morphAttributes;if((an.position!==void 0||an.normal!==void 0||an.color!==void 0)&&ie.update(z,q,Jt),(Zt||Be.receiveShadow!==z.receiveShadow)&&(Be.receiveShadow=z.receiveShadow,bt.setValue(U,"receiveShadow",z.receiveShadow)),X.isMeshGouraudMaterial&&X.envMap!==null&&(sn.envMap.value=ge,sn.flipEnvMap.value=ge.isCubeTexture&&ge.isRenderTargetTexture===!1?-1:1),X.isMeshStandardMaterial&&X.envMap===null&&V.environment!==null&&(sn.envMapIntensity.value=V.environmentIntensity),Zt&&(bt.setValue(U,"toneMappingExposure",_.toneMappingExposure),Be.needsLights&&ko(sn,ns),re&&X.fog===!0&&j.refreshFogUniforms(sn,re),j.refreshMaterialUniforms(sn,X,H,G,f.state.transmissionRenderTarget[w.id]),ja.upload(U,na(Be),sn,ke)),X.isShaderMaterial&&X.uniformsNeedUpdate===!0&&(ja.upload(U,na(Be),sn,ke),X.uniformsNeedUpdate=!1),X.isSpriteMaterial&&bt.setValue(U,"center",z.center),bt.setValue(U,"modelViewMatrix",z.modelViewMatrix),bt.setValue(U,"normalMatrix",z.normalMatrix),bt.setValue(U,"modelMatrix",z.matrixWorld),X.isShaderMaterial||X.isRawShaderMaterial){const Ht=X.uniformsGroups;for(let Xt=0,Go=Ht.length;Xt<Go;Xt++){const ui=Ht[Xt];Re.update(ui,Jt),Re.bind(ui,Jt)}}return Jt}function ko(w,V){w.ambientLightColor.needsUpdate=V,w.lightProbe.needsUpdate=V,w.directionalLights.needsUpdate=V,w.directionalLightShadows.needsUpdate=V,w.pointLights.needsUpdate=V,w.pointLightShadows.needsUpdate=V,w.spotLights.needsUpdate=V,w.spotLightShadows.needsUpdate=V,w.rectAreaLights.needsUpdate=V,w.hemisphereLights.needsUpdate=V}function ra(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return M},this.getActiveMipmapLevel=function(){return S},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(w,V,q){const X=Ee.get(w);X.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,X.__autoAllocateDepthBuffer===!1&&(X.__useRenderToTexture=!1),Ee.get(w.texture).__webglTexture=V,Ee.get(w.depthTexture).__webglTexture=X.__autoAllocateDepthBuffer?void 0:q,X.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,V){const q=Ee.get(w);q.__webglFramebuffer=V,q.__useDefaultFramebuffer=V===void 0};const Qo=U.createFramebuffer();this.setRenderTarget=function(w,V=0,q=0){C=w,M=V,S=q;let X=!0,z=null,re=!1,he=!1;if(w){const ge=Ee.get(w);if(ge.__useDefaultFramebuffer!==void 0)_e.bindFramebuffer(U.FRAMEBUFFER,null),X=!1;else if(ge.__webglFramebuffer===void 0)ke.setupRenderTarget(w);else if(ge.__hasExternalTextures)ke.rebindTextures(w,Ee.get(w.texture).__webglTexture,Ee.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Ce=w.depthTexture;if(ge.__boundDepthTexture!==Ce){if(Ce!==null&&Ee.has(Ce)&&(w.width!==Ce.image.width||w.height!==Ce.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");ke.setupDepthRenderbuffer(w)}}const Pe=w.texture;(Pe.isData3DTexture||Pe.isDataArrayTexture||Pe.isCompressedArrayTexture)&&(he=!0);const Fe=Ee.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Fe[V])?z=Fe[V][q]:z=Fe[V],re=!0):w.samples>0&&ke.useMultisampledRTT(w)===!1?z=Ee.get(w).__webglMultisampledFramebuffer:Array.isArray(Fe)?z=Fe[q]:z=Fe,T.copy(w.viewport),N.copy(w.scissor),D=w.scissorTest}else T.copy(se).multiplyScalar(H).floor(),N.copy(pe).multiplyScalar(H).floor(),D=Ue;if(q!==0&&(z=Qo),_e.bindFramebuffer(U.FRAMEBUFFER,z)&&X&&_e.drawBuffers(w,z),_e.viewport(T),_e.scissor(N),_e.setScissorTest(D),re){const ge=Ee.get(w.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+V,ge.__webglTexture,q)}else if(he){const ge=V;for(let Pe=0;Pe<w.textures.length;Pe++){const Fe=Ee.get(w.textures[Pe]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+Pe,Fe.__webglTexture,q,ge)}}else if(w!==null&&q!==0){const ge=Ee.get(w.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ge.__webglTexture,q)}I=-1},this.readRenderTargetPixels=function(w,V,q,X,z,re,he,Me=0){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ge=Ee.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge){_e.bindFramebuffer(U.FRAMEBUFFER,ge);try{const Pe=w.textures[Me],Fe=Pe.format,Ce=Pe.type;if(!Te.textureFormatReadable(Fe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Te.textureTypeReadable(Ce)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}V>=0&&V<=w.width-X&&q>=0&&q<=w.height-z&&(w.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+Me),U.readPixels(V,q,X,z,ye.convert(Fe),ye.convert(Ce),re))}finally{const Pe=C!==null?Ee.get(C).__webglFramebuffer:null;_e.bindFramebuffer(U.FRAMEBUFFER,Pe)}}},this.readRenderTargetPixelsAsync=async function(w,V,q,X,z,re,he,Me=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ge=Ee.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&he!==void 0&&(ge=ge[he]),ge)if(V>=0&&V<=w.width-X&&q>=0&&q<=w.height-z){_e.bindFramebuffer(U.FRAMEBUFFER,ge);const Pe=w.textures[Me],Fe=Pe.format,Ce=Pe.type;if(!Te.textureFormatReadable(Fe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Te.textureTypeReadable(Ce))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ye=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,Ye),U.bufferData(U.PIXEL_PACK_BUFFER,re.byteLength,U.STREAM_READ),w.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+Me),U.readPixels(V,q,X,z,ye.convert(Fe),ye.convert(Ce),0);const ut=C!==null?Ee.get(C).__webglFramebuffer:null;_e.bindFramebuffer(U.FRAMEBUFFER,ut);const xt=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await H_(U,xt,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,Ye),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,re),U.deleteBuffer(Ye),U.deleteSync(xt),re}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,V=null,q=0){const X=Math.pow(2,-q),z=Math.floor(w.image.width*X),re=Math.floor(w.image.height*X),he=V!==null?V.x:0,Me=V!==null?V.y:0;ke.setTexture2D(w,0),U.copyTexSubImage2D(U.TEXTURE_2D,q,0,0,he,Me,z,re),_e.unbindTexture()};const Ho=U.createFramebuffer(),Zi=U.createFramebuffer();this.copyTextureToTexture=function(w,V,q=null,X=null,z=0,re=null){re===null&&(z!==0?(Ks("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),re=z,z=0):re=0);let he,Me,ge,Pe,Fe,Ce,Ye,ut,xt;const pt=w.isCompressedTexture?w.mipmaps[re]:w.image;if(q!==null)he=q.max.x-q.min.x,Me=q.max.y-q.min.y,ge=q.isBox3?q.max.z-q.min.z:1,Pe=q.min.x,Fe=q.min.y,Ce=q.isBox3?q.min.z:0;else{const an=Math.pow(2,-z);he=Math.floor(pt.width*an),Me=Math.floor(pt.height*an),w.isDataArrayTexture?ge=pt.depth:w.isData3DTexture?ge=Math.floor(pt.depth*an):ge=1,Pe=0,Fe=0,Ce=0}X!==null?(Ye=X.x,ut=X.y,xt=X.z):(Ye=0,ut=0,xt=0);const ft=ye.convert(V.format),Be=ye.convert(V.type);let vt;V.isData3DTexture?(ke.setTexture3D(V,0),vt=U.TEXTURE_3D):V.isDataArrayTexture||V.isCompressedArrayTexture?(ke.setTexture2DArray(V,0),vt=U.TEXTURE_2D_ARRAY):(ke.setTexture2D(V,0),vt=U.TEXTURE_2D),U.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,V.flipY),U.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),U.pixelStorei(U.UNPACK_ALIGNMENT,V.unpackAlignment);const $e=U.getParameter(U.UNPACK_ROW_LENGTH),Jt=U.getParameter(U.UNPACK_IMAGE_HEIGHT),$i=U.getParameter(U.UNPACK_SKIP_PIXELS),Zt=U.getParameter(U.UNPACK_SKIP_ROWS),ns=U.getParameter(U.UNPACK_SKIP_IMAGES);U.pixelStorei(U.UNPACK_ROW_LENGTH,pt.width),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,pt.height),U.pixelStorei(U.UNPACK_SKIP_PIXELS,Pe),U.pixelStorei(U.UNPACK_SKIP_ROWS,Fe),U.pixelStorei(U.UNPACK_SKIP_IMAGES,Ce);const bt=w.isDataArrayTexture||w.isData3DTexture,sn=V.isDataArrayTexture||V.isData3DTexture;if(w.isDepthTexture){const an=Ee.get(w),Ht=Ee.get(V),Xt=Ee.get(an.__renderTarget),Go=Ee.get(Ht.__renderTarget);_e.bindFramebuffer(U.READ_FRAMEBUFFER,Xt.__webglFramebuffer),_e.bindFramebuffer(U.DRAW_FRAMEBUFFER,Go.__webglFramebuffer);for(let ui=0;ui<ge;ui++)bt&&(U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Ee.get(w).__webglTexture,z,Ce+ui),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Ee.get(V).__webglTexture,re,xt+ui)),U.blitFramebuffer(Pe,Fe,he,Me,Ye,ut,he,Me,U.DEPTH_BUFFER_BIT,U.NEAREST);_e.bindFramebuffer(U.READ_FRAMEBUFFER,null),_e.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(z!==0||w.isRenderTargetTexture||Ee.has(w)){const an=Ee.get(w),Ht=Ee.get(V);_e.bindFramebuffer(U.READ_FRAMEBUFFER,Ho),_e.bindFramebuffer(U.DRAW_FRAMEBUFFER,Zi);for(let Xt=0;Xt<ge;Xt++)bt?U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,an.__webglTexture,z,Ce+Xt):U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,an.__webglTexture,z),sn?U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,Ht.__webglTexture,re,xt+Xt):U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,Ht.__webglTexture,re),z!==0?U.blitFramebuffer(Pe,Fe,he,Me,Ye,ut,he,Me,U.COLOR_BUFFER_BIT,U.NEAREST):sn?U.copyTexSubImage3D(vt,re,Ye,ut,xt+Xt,Pe,Fe,he,Me):U.copyTexSubImage2D(vt,re,Ye,ut,Pe,Fe,he,Me);_e.bindFramebuffer(U.READ_FRAMEBUFFER,null),_e.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else sn?w.isDataTexture||w.isData3DTexture?U.texSubImage3D(vt,re,Ye,ut,xt,he,Me,ge,ft,Be,pt.data):V.isCompressedArrayTexture?U.compressedTexSubImage3D(vt,re,Ye,ut,xt,he,Me,ge,ft,pt.data):U.texSubImage3D(vt,re,Ye,ut,xt,he,Me,ge,ft,Be,pt):w.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,re,Ye,ut,he,Me,ft,Be,pt.data):w.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,re,Ye,ut,pt.width,pt.height,ft,pt.data):U.texSubImage2D(U.TEXTURE_2D,re,Ye,ut,he,Me,ft,Be,pt);U.pixelStorei(U.UNPACK_ROW_LENGTH,$e),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,Jt),U.pixelStorei(U.UNPACK_SKIP_PIXELS,$i),U.pixelStorei(U.UNPACK_SKIP_ROWS,Zt),U.pixelStorei(U.UNPACK_SKIP_IMAGES,ns),re===0&&V.generateMipmaps&&U.generateMipmap(vt),_e.unbindTexture()},this.initRenderTarget=function(w){Ee.get(w).__webglFramebuffer===void 0&&ke.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?ke.setTextureCube(w,0):w.isData3DTexture?ke.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?ke.setTexture2DArray(w,0):ke.setTexture2D(w,0),_e.unbindTexture()},this.resetState=function(){M=0,S=0,C=null,_e.reset(),le.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Bn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Je._getDrawingBufferColorSpace(e),t.unpackColorSpace=Je._getUnpackColorSpace()}}class Fy{constructor(e=4){this.pool=e,this.queue=[],this.workers=[],this.workersResolve=[],this.workerStatus=0,this.workerCreator=null}_initWorker(e){if(!this.workers[e]){const t=this.workerCreator();t.addEventListener("message",this._onMessage.bind(this,e)),this.workers[e]=t}}_getIdleWorker(){for(let e=0;e<this.pool;e++)if(!(this.workerStatus&1<<e))return e;return-1}_onMessage(e,t){const i=this.workersResolve[e];if(i&&i(t),this.queue.length){const{resolve:r,msg:s,transfer:a}=this.queue.shift();this.workersResolve[e]=r,this.workers[e].postMessage(s,a)}else this.workerStatus^=1<<e}setWorkerCreator(e){this.workerCreator=e}setWorkerLimit(e){this.pool=e}postMessage(e,t){return new Promise(i=>{const r=this._getIdleWorker();r!==-1?(this._initWorker(r),this.workerStatus|=1<<r,this.workersResolve[r]=i,this.workers[r].postMessage(e,t)):this.queue.push({resolve:i,msg:e,transfer:t})})}dispose(){this.workers.forEach(e=>e.terminate()),this.workersResolve.length=0,this.workers.length=0,this.queue.length=0,this.workerStatus=0}}const Oy=0,dd=2,ky=1,fd=2,Qy=0,Hy=1,Gy=10,Vy=0,Ep=9,vp=15,bp=16,xp=22,yp=37,Mp=43,Ip=76,Sp=83,Cp=97,wp=100,Tp=103,Rp=109,Bp=122,Lp=123,Dp=131,Pp=132,Up=133,Np=134,Fp=137,Op=138,kp=139,Qp=140,Hp=141,Gp=142,Vp=145,zp=146,Wp=148,qp=152,jp=157,Xp=158,Yp=165,Kp=166,Jp=1000054e3,Zp=1000054001,$p=1000054004,eA=1000054005,yu=1000066e3,tA=1000066004;class As{constructor(e,t,i,r){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+t,i),this._littleEndian=r,this._offset=0}_nextUint8(){const e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){const e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){const e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){const e=this._dataView.getUint32(this._offset,this._littleEndian)+4294967296*this._dataView.getUint32(this._offset+4,this._littleEndian);return this._offset+=8,e}_nextInt32(){const e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){const t=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,t}_skip(e){return this._offset+=e,this}_scan(e,t=0){const i=this._offset;let r=0;for(;this._dataView.getUint8(this._offset)!==t&&r<e;)r++,this._offset++;return r<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+i,r)}}const Vt=[171,75,84,88,32,50,48,187,13,10,26,10];function pd(n){return new TextDecoder().decode(n)}function zy(n){const e=new Uint8Array(n.buffer,n.byteOffset,Vt.length);if(e[0]!==Vt[0]||e[1]!==Vt[1]||e[2]!==Vt[2]||e[3]!==Vt[3]||e[4]!==Vt[4]||e[5]!==Vt[5]||e[6]!==Vt[6]||e[7]!==Vt[7]||e[8]!==Vt[8]||e[9]!==Vt[9]||e[10]!==Vt[10]||e[11]!==Vt[11])throw new Error("Missing KTX 2.0 identifier.");const t={vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null},i=17*Uint32Array.BYTES_PER_ELEMENT,r=new As(n,Vt.length,i,!0);t.vkFormat=r._nextUint32(),t.typeSize=r._nextUint32(),t.pixelWidth=r._nextUint32(),t.pixelHeight=r._nextUint32(),t.pixelDepth=r._nextUint32(),t.layerCount=r._nextUint32(),t.faceCount=r._nextUint32(),t.levelCount=r._nextUint32(),t.supercompressionScheme=r._nextUint32();const s=r._nextUint32(),a=r._nextUint32(),o=r._nextUint32(),l=r._nextUint32(),c=r._nextUint64(),u=r._nextUint64(),h=3*Math.max(t.levelCount,1)*8,d=new As(n,Vt.length+i,h,!0);for(let se=0,pe=Math.max(t.levelCount,1);se<pe;se++)t.levels.push({levelData:new Uint8Array(n.buffer,n.byteOffset+d._nextUint64(),d._nextUint64()),uncompressedByteLength:d._nextUint64()});const p=new As(n,s,a,!0);p._skip(4);const m=p._nextUint16(),g=p._nextUint16(),A=p._nextUint16(),f=p._nextUint16(),E={vendorId:m,descriptorType:g,versionNumber:A,colorModel:p._nextUint8(),colorPrimaries:p._nextUint8(),transferFunction:p._nextUint8(),flags:p._nextUint8(),texelBlockDimension:[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],bytesPlane:[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],samples:[]},v=(f/4-6)/4;for(let se=0;se<v;se++){const pe={bitOffset:p._nextUint16(),bitLength:p._nextUint8(),channelType:p._nextUint8(),samplePosition:[p._nextUint8(),p._nextUint8(),p._nextUint8(),p._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};64&pe.channelType?(pe.sampleLower=p._nextInt32(),pe.sampleUpper=p._nextInt32()):(pe.sampleLower=p._nextUint32(),pe.sampleUpper=p._nextUint32()),E.samples[se]=pe}t.dataFormatDescriptor.length=0,t.dataFormatDescriptor.push(E);const _=new As(n,o,l,!0);for(;_._offset<l;){const se=_._nextUint32(),pe=_._scan(se),Ue=pd(pe);if(t.keyValue[Ue]=_._nextUint8Array(se-pe.byteLength-1),Ue.match(/^ktx/i)){const qe=pd(t.keyValue[Ue]);t.keyValue[Ue]=qe.substring(0,qe.lastIndexOf("\0"))}_._skip(se%4?4-se%4:0)}if(u<=0)return t;const b=new As(n,c,u,!0),M=b._nextUint16(),S=b._nextUint16(),C=b._nextUint32(),I=b._nextUint32(),y=b._nextUint32(),T=b._nextUint32(),N=[];for(let se=0,pe=Math.max(t.levelCount,1);se<pe;se++)N.push({imageFlags:b._nextUint32(),rgbSliceByteOffset:b._nextUint32(),rgbSliceByteLength:b._nextUint32(),alphaSliceByteOffset:b._nextUint32(),alphaSliceByteLength:b._nextUint32()});const D=c+b._offset,P=D+C,k=P+I,F=k+y,G=new Uint8Array(n.buffer,n.byteOffset+D,C),H=new Uint8Array(n.buffer,n.byteOffset+P,I),ee=new Uint8Array(n.buffer,n.byteOffset+k,y),Z=new Uint8Array(n.buffer,n.byteOffset+F,T);return t.globalData={endpointCount:M,selectorCount:S,imageDescs:N,endpointsData:G,selectorsData:H,tablesData:ee,extendedData:Z},t}let Tl,zn,Oc;const Rl={env:{emscripten_notify_memory_growth:function(n){Oc=new Uint8Array(zn.exports.memory.buffer)}}};class Wy{init(){return Tl||(Tl=typeof fetch<"u"?fetch("data:application/wasm;base64,"+Ad).then(e=>e.arrayBuffer()).then(e=>WebAssembly.instantiate(e,Rl)).then(this._init):WebAssembly.instantiate(Buffer.from(Ad,"base64"),Rl).then(this._init),Tl)}_init(e){zn=e.instance,Rl.env.emscripten_notify_memory_growth(0)}decode(e,t=0){if(!zn)throw new Error("ZSTDDecoder: Await .init() before decoding.");const i=e.byteLength,r=zn.exports.malloc(i);Oc.set(e,r),t=t||Number(zn.exports.ZSTD_findDecompressedSize(r,i));const s=zn.exports.malloc(t),a=zn.exports.ZSTD_decompress(s,t,r,i),o=Oc.slice(s,s+a);return zn.exports.free(r),zn.exports.free(s),o}}const Ad="AGFzbQEAAAABpQEVYAF/AX9gAn9/AGADf39/AX9gBX9/f39/AX9gAX8AYAJ/fwF/YAR/f39/AX9gA39/fwBgBn9/f39/fwF/YAd/f39/f39/AX9gAn9/AX5gAn5+AX5gAABgBX9/f39/AGAGf39/f39/AGAIf39/f39/f38AYAl/f39/f39/f38AYAABf2AIf39/f39/f38Bf2ANf39/f39/f39/f39/fwF/YAF/AX4CJwEDZW52H2Vtc2NyaXB0ZW5fbm90aWZ5X21lbW9yeV9ncm93dGgABANpaAEFAAAFAgEFCwACAQABAgIFBQcAAwABDgsBAQcAEhMHAAUBDAQEAAANBwQCAgYCBAgDAwMDBgEACQkHBgICAAYGAgQUBwYGAwIGAAMCAQgBBwUGCgoEEQAEBAEIAwgDBQgDEA8IAAcABAUBcAECAgUEAQCAAgYJAX8BQaCgwAILB2AHBm1lbW9yeQIABm1hbGxvYwAoBGZyZWUAJgxaU1REX2lzRXJyb3IAaBlaU1REX2ZpbmREZWNvbXByZXNzZWRTaXplAFQPWlNURF9kZWNvbXByZXNzAEoGX3N0YXJ0ACQJBwEAQQELASQKussBaA8AIAAgACgCBCABajYCBAsZACAAKAIAIAAoAgRBH3F0QQAgAWtBH3F2CwgAIABBiH9LC34BBH9BAyEBIAAoAgQiA0EgTQRAIAAoAggiASAAKAIQTwRAIAAQDQ8LIAAoAgwiAiABRgRAQQFBAiADQSBJGw8LIAAgASABIAJrIANBA3YiBCABIARrIAJJIgEbIgJrIgQ2AgggACADIAJBA3RrNgIEIAAgBCgAADYCAAsgAQsUAQF/IAAgARACIQIgACABEAEgAgv3AQECfyACRQRAIABCADcCACAAQQA2AhAgAEIANwIIQbh/DwsgACABNgIMIAAgAUEEajYCECACQQRPBEAgACABIAJqIgFBfGoiAzYCCCAAIAMoAAA2AgAgAUF/ai0AACIBBEAgAEEIIAEQFGs2AgQgAg8LIABBADYCBEF/DwsgACABNgIIIAAgAS0AACIDNgIAIAJBfmoiBEEBTQRAIARBAWtFBEAgACABLQACQRB0IANyIgM2AgALIAAgAS0AAUEIdCADajYCAAsgASACakF/ai0AACIBRQRAIABBADYCBEFsDwsgAEEoIAEQFCACQQN0ams2AgQgAgsWACAAIAEpAAA3AAAgACABKQAINwAICy8BAX8gAUECdEGgHWooAgAgACgCAEEgIAEgACgCBGprQR9xdnEhAiAAIAEQASACCyEAIAFCz9bTvtLHq9lCfiAAfEIfiUKHla+vmLbem55/fgsdAQF/IAAoAgggACgCDEYEfyAAKAIEQSBGBUEACwuCBAEDfyACQYDAAE8EQCAAIAEgAhBnIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAsMACAAIAEpAAA3AAALQQECfyAAKAIIIgEgACgCEEkEQEEDDwsgACAAKAIEIgJBB3E2AgQgACABIAJBA3ZrIgE2AgggACABKAAANgIAQQALDAAgACABKAIANgAAC/cCAQJ/AkAgACABRg0AAkAgASACaiAASwRAIAAgAmoiBCABSw0BCyAAIAEgAhALDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAwRAIAAhAwwDCyAAQQNxRQRAIAAhAwwCCyAAIQMDQCACRQ0EIAMgAS0AADoAACABQQFqIQEgAkF/aiECIANBAWoiA0EDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQhBSAGQQR2IQRBICAAdCIAQQFyIQkgASgCACEPQQAhAiADIQYCQANAIAlBAkggAiAPS3JFBEAgAiEHAkAgCARAA0AgBEH//wNxQf//A0YEQCAHQRhqIQcgBiAQSQR/IAZBAmoiBigAACAFdgUgBUEQaiEFIARBEHYLIQQMAQsLA0AgBEEDcSIIQQNGBEAgBUECaiEFIARBAnYhBCAHQQNqIQcMAQsLIAcgCGoiByAPSw0EIAVBAmohBQNAIAIgB0kEQCANIAJBAXRqQQA7AQAgAkEBaiECDAELCyAGIA5LQQAgBiAFQQN1aiIHIAxLG0UEQCAHKAAAIAVBB3EiBXYhBAwCCyAEQQJ2IQQLIAYhBwsCfyALQX9qIAQgAEF/anEiBiAAQQF0QX9qIgggCWsiEUkNABogBCAIcSIEQQAgESAEIABIG2shBiALCyEIIA0gAkEBdGogBkF/aiIEOwEAIAlBASAGayAEIAZBAUgbayEJA0AgCSAASARAIABBAXUhACALQX9qIQsMAQsLAn8gByAOS0EAIAcgBSAIaiIFQQN1aiIGIAxLG0UEQCAFQQdxDAELIAUgDCIGIAdrQQN0awshBSACQQFqIQIgBEUhCCAGKAAAIAVBH3F2IQQMAQsLQWwgCUEBRyAFQSBKcg0BGiABIAJBf2o2AgAgBiAFQQdqQQN1aiADawwBC0FQCyEAIApBEGokACAACwkAQQFBBSAAGwsMACAAIAEoAAA2AAALqgMBCn8jAEHwAGsiCiQAIAJBAWohDiAAQQhqIQtBgIAEIAVBf2p0QRB1IQxBACECQQEhBkEBIAV0IglBf2oiDyEIA0AgAiAORkUEQAJAIAEgAkEBdCINai8BACIHQf//A0YEQCALIAhBA3RqIAI2AgQgCEF/aiEIQQEhBwwBCyAGQQAgDCAHQRB0QRB1ShshBgsgCiANaiAHOwEAIAJBAWohAgwBCwsgACAFNgIEIAAgBjYCACAJQQN2IAlBAXZqQQNqIQxBACEAQQAhBkEAIQIDQCAGIA5GBEADQAJAIAAgCUYNACAKIAsgAEEDdGoiASgCBCIGQQF0aiICIAIvAQAiAkEBajsBACABIAUgAhAUayIIOgADIAEgAiAIQf8BcXQgCWs7AQAgASAEIAZBAnQiAmooAgA6AAIgASACIANqKAIANgIEIABBAWohAAwBCwsFIAEgBkEBdGouAQAhDUEAIQcDQCAHIA1ORQRAIAsgAkEDdGogBjYCBANAIAIgDGogD3EiAiAISw0ACyAHQQFqIQcMAQsLIAZBAWohBgwBCwsgCkHwAGokAAsjAEIAIAEQCSAAhUKHla+vmLbem55/fkLj3MqV/M7y9YV/fAsQACAAQn43AwggACABNgIACyQBAX8gAARAIAEoAgQiAgRAIAEoAgggACACEQEADwsgABAmCwsfACAAIAEgAi8BABAINgIAIAEQBBogACACQQRqNgIEC0oBAX9BoCAoAgAiASAAaiIAQX9MBEBBiCBBMDYCAEF/DwsCQCAAPwBBEHRNDQAgABBmDQBBiCBBMDYCAEF/DwtBoCAgADYCACABC9cBAQh/Qbp/IQoCQCACKAIEIgggAigCACIJaiIOIAEgAGtLDQBBbCEKIAkgBCADKAIAIgtrSw0AIAAgCWoiBCACKAIIIgxrIQ0gACABQWBqIg8gCyAJQQAQKSADIAkgC2o2AgACQAJAIAwgBCAFa00EQCANIQUMAQsgDCAEIAZrSw0CIAcgDSAFayIAaiIBIAhqIAdNBEAgBCABIAgQDxoMAgsgBCABQQAgAGsQDyEBIAIgACAIaiIINgIEIAEgAGshBAsgBCAPIAUgCEEBECkLIA4hCgsgCgubAgEBfyMAQYABayINJAAgDSADNgJ8AkAgAkEDSwRAQX8hCQwBCwJAAkACQAJAIAJBAWsOAwADAgELIAZFBEBBuH8hCQwEC0FsIQkgBS0AACICIANLDQMgACAHIAJBAnQiAmooAgAgAiAIaigCABA7IAEgADYCAEEBIQkMAwsgASAJNgIAQQAhCQwCCyAKRQRAQWwhCQwCC0EAIQkgC0UgDEEZSHINAUEIIAR0QQhqIQBBACECA0AgAiAATw0CIAJBQGshAgwAAAsAC0FsIQkgDSANQfwAaiANQfgAaiAFIAYQFSICEAMNACANKAJ4IgMgBEsNACAAIA0gDSgCfCAHIAggAxAYIAEgADYCACACIQkLIA1BgAFqJAAgCQsLACAAIAEgAhALGgsQACAALwAAIAAtAAJBEHRyCy8AAn9BuH8gAUEISQ0AGkFyIAAoAAQiAEF3Sw0AGkG4fyAAQQhqIgAgACABSxsLCwkAIAAgATsAAAsDAAELigYBBX8gACAAKAIAIgVBfnE2AgBBACAAIAVBAXZqQYQgKAIAIgQgAEYbIQECQAJAIAAoAgQiAkUNACACKAIAIgNBAXENACACQQhqIgUgA0EBdkF4aiIDQQggA0EISxtnQR9zQQJ0QYAfaiIDKAIARgRAIAMgAigCDDYCAAsgAigCCCIDBEAgAyACKAIMNgIECyACKAIMIgMEQCADIAIoAgg2AgALIAIgAigCACAAKAIAQX5xajYCAEGEICEAAkACQCABRQ0AIAEgAjYCBCABKAIAIgNBAXENASADQQF2QXhqIgNBCCADQQhLG2dBH3NBAnRBgB9qIgMoAgAgAUEIakYEQCADIAEoAgw2AgALIAEoAggiAwRAIAMgASgCDDYCBAsgASgCDCIDBEAgAyABKAIINgIAQYQgKAIAIQQLIAIgAigCACABKAIAQX5xajYCACABIARGDQAgASABKAIAQQF2akEEaiEACyAAIAI2AgALIAIoAgBBAXZBeGoiAEEIIABBCEsbZ0Efc0ECdEGAH2oiASgCACEAIAEgBTYCACACIAA2AgwgAkEANgIIIABFDQEgACAFNgIADwsCQCABRQ0AIAEoAgAiAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAigCACABQQhqRgRAIAIgASgCDDYCAAsgASgCCCICBEAgAiABKAIMNgIECyABKAIMIgIEQCACIAEoAgg2AgBBhCAoAgAhBAsgACAAKAIAIAEoAgBBfnFqIgI2AgACQCABIARHBEAgASABKAIAQQF2aiAANgIEIAAoAgAhAgwBC0GEICAANgIACyACQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgIoAgAhASACIABBCGoiAjYCACAAIAE2AgwgAEEANgIIIAFFDQEgASACNgIADwsgBUEBdkF4aiIBQQggAUEISxtnQR9zQQJ0QYAfaiICKAIAIQEgAiAAQQhqIgI2AgAgACABNgIMIABBADYCCCABRQ0AIAEgAjYCAAsLDgAgAARAIABBeGoQJQsLgAIBA38CQCAAQQ9qQXhxQYQgKAIAKAIAQQF2ayICEB1Bf0YNAAJAQYQgKAIAIgAoAgAiAUEBcQ0AIAFBAXZBeGoiAUEIIAFBCEsbZ0Efc0ECdEGAH2oiASgCACAAQQhqRgRAIAEgACgCDDYCAAsgACgCCCIBBEAgASAAKAIMNgIECyAAKAIMIgFFDQAgASAAKAIINgIAC0EBIQEgACAAKAIAIAJBAXRqIgI2AgAgAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAygCACECIAMgAEEIaiIDNgIAIAAgAjYCDCAAQQA2AgggAkUNACACIAM2AgALIAELtwIBA38CQAJAIABBASAAGyICEDgiAA0AAkACQEGEICgCACIARQ0AIAAoAgAiA0EBcQ0AIAAgA0EBcjYCACADQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgAgAEEIakYEQCABIAAoAgw2AgALIAAoAggiAQRAIAEgACgCDDYCBAsgACgCDCIBBEAgASAAKAIINgIACyACECchAkEAIQFBhCAoAgAhACACDQEgACAAKAIAQX5xNgIAQQAPCyACQQ9qQXhxIgMQHSICQX9GDQIgAkEHakF4cSIAIAJHBEAgACACaxAdQX9GDQMLAkBBhCAoAgAiAUUEQEGAICAANgIADAELIAAgATYCBAtBhCAgADYCACAAIANBAXRBAXI2AgAMAQsgAEUNAQsgAEEIaiEBCyABC7kDAQJ/IAAgA2ohBQJAIANBB0wEQANAIAAgBU8NAiAAIAItAAA6AAAgAEEBaiEAIAJBAWohAgwAAAsACyAEQQFGBEACQCAAIAJrIgZBB00EQCAAIAItAAA6AAAgACACLQABOgABIAAgAi0AAjoAAiAAIAItAAM6AAMgAEEEaiACIAZBAnQiBkHAHmooAgBqIgIQFyACIAZB4B5qKAIAayECDAELIAAgAhAMCyACQQhqIQIgAEEIaiEACwJAAkACQAJAIAUgAU0EQCAAIANqIQEgBEEBRyAAIAJrQQ9Kcg0BA0AgACACEAwgAkEIaiECIABBCGoiACABSQ0ACwwFCyAAIAFLBEAgACEBDAQLIARBAUcgACACa0EPSnINASAAIQMgAiEEA0AgAyAEEAwgBEEIaiEEIANBCGoiAyABSQ0ACwwCCwNAIAAgAhAHIAJBEGohAiAAQRBqIgAgAUkNAAsMAwsgACEDIAIhBANAIAMgBBAHIARBEGohBCADQRBqIgMgAUkNAAsLIAIgASAAa2ohAgsDQCABIAVPDQEgASACLQAAOgAAIAFBAWohASACQQFqIQIMAAALAAsLQQECfyAAIAAoArjgASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigCACACaiAAQQZ2IgFBAnRBsB5qKAIAaiAAQSBxIgBFaiABRSAAQQV2cWoFQbh/CwsdACAAKAKQ4gEQWiAAQQA2AqDiASAAQgA3A5DiAQu1AwEFfyMAQZACayIKJABBuH8hBgJAIAVFDQAgBCwAACIIQf8BcSEHAkAgCEF/TARAIAdBgn9qQQF2IgggBU8NAkFsIQYgB0GBf2oiBUGAAk8NAiAEQQFqIQdBACEGA0AgBiAFTwRAIAUhBiAIIQcMAwUgACAGaiAHIAZBAXZqIgQtAABBBHY6AAAgACAGQQFyaiAELQAAQQ9xOgAAIAZBAmohBgwBCwAACwALIAcgBU8NASAAIARBAWogByAKEFMiBhADDQELIAYhBEEAIQYgAUEAQTQQECEJQQAhBQNAIAQgBkcEQCAAIAZqIggtAAAiAUELSwRAQWwhBgwDBSAJIAFBAnRqIgEgASgCAEEBajYCACAGQQFqIQZBASAILQAAdEEBdSAFaiEFDAILAAsLQWwhBiAFRQ0AIAUQFEEBaiIBQQxLDQAgAyABNgIAQQFBASABdCAFayIDEBQiAXQgA0cNACAAIARqIAFBAWoiADoAACAJIABBAnRqIgAgACgCAEEBajYCACAJKAIEIgBBAkkgAEEBcXINACACIARBAWo2AgAgB0EBaiEGCyAKQZACaiQAIAYLxhEBDH8jAEHwAGsiBSQAQWwhCwJAIANBCkkNACACLwAAIQogAi8AAiEJIAIvAAQhByAFQQhqIAQQDgJAIAMgByAJIApqakEGaiIMSQ0AIAUtAAohCCAFQdgAaiACQQZqIgIgChAGIgsQAw0BIAVBQGsgAiAKaiICIAkQBiILEAMNASAFQShqIAIgCWoiAiAHEAYiCxADDQEgBUEQaiACIAdqIAMgDGsQBiILEAMNASAAIAFqIg9BfWohECAEQQRqIQZBASELIAAgAUEDakECdiIDaiIMIANqIgIgA2oiDiEDIAIhBCAMIQcDQCALIAMgEElxBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgCS0AAyELIAcgBiAFQUBrIAgQAkECdGoiCS8BADsAACAFQUBrIAktAAIQASAJLQADIQogBCAGIAVBKGogCBACQQJ0aiIJLwEAOwAAIAVBKGogCS0AAhABIAktAAMhCSADIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgDS0AAyENIAAgC2oiCyAGIAVB2ABqIAgQAkECdGoiAC8BADsAACAFQdgAaiAALQACEAEgAC0AAyEAIAcgCmoiCiAGIAVBQGsgCBACQQJ0aiIHLwEAOwAAIAVBQGsgBy0AAhABIActAAMhByAEIAlqIgkgBiAFQShqIAgQAkECdGoiBC8BADsAACAFQShqIAQtAAIQASAELQADIQQgAyANaiIDIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgACALaiEAIAcgCmohByAEIAlqIQQgAyANLQADaiEDIAVB2ABqEA0gBUFAaxANciAFQShqEA1yIAVBEGoQDXJFIQsMAQsLIAQgDksgByACS3INAEFsIQsgACAMSw0BIAxBfWohCQNAQQAgACAJSSAFQdgAahAEGwRAIAAgBiAFQdgAaiAIEAJBAnRqIgovAQA7AAAgBUHYAGogCi0AAhABIAAgCi0AA2oiACAGIAVB2ABqIAgQAkECdGoiCi8BADsAACAFQdgAaiAKLQACEAEgACAKLQADaiEADAEFIAxBfmohCgNAIAVB2ABqEAQgACAKS3JFBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgACAJLQADaiEADAELCwNAIAAgCk0EQCAAIAYgBUHYAGogCBACQQJ0aiIJLwEAOwAAIAVB2ABqIAktAAIQASAAIAktAANqIQAMAQsLAkAgACAMTw0AIAAgBiAFQdgAaiAIEAIiAEECdGoiDC0AADoAACAMLQADQQFGBEAgBUHYAGogDC0AAhABDAELIAUoAlxBH0sNACAFQdgAaiAGIABBAnRqLQACEAEgBSgCXEEhSQ0AIAVBIDYCXAsgAkF9aiEMA0BBACAHIAxJIAVBQGsQBBsEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiIAIAYgBUFAayAIEAJBAnRqIgcvAQA7AAAgBUFAayAHLQACEAEgACAHLQADaiEHDAEFIAJBfmohDANAIAVBQGsQBCAHIAxLckUEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwNAIAcgDE0EQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwJAIAcgAk8NACAHIAYgBUFAayAIEAIiAEECdGoiAi0AADoAACACLQADQQFGBEAgBUFAayACLQACEAEMAQsgBSgCREEfSw0AIAVBQGsgBiAAQQJ0ai0AAhABIAUoAkRBIUkNACAFQSA2AkQLIA5BfWohAgNAQQAgBCACSSAFQShqEAQbBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2oiACAGIAVBKGogCBACQQJ0aiIELwEAOwAAIAVBKGogBC0AAhABIAAgBC0AA2ohBAwBBSAOQX5qIQIDQCAFQShqEAQgBCACS3JFBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsDQCAEIAJNBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsCQCAEIA5PDQAgBCAGIAVBKGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBKGogAi0AAhABDAELIAUoAixBH0sNACAFQShqIAYgAEECdGotAAIQASAFKAIsQSFJDQAgBUEgNgIsCwNAQQAgAyAQSSAFQRBqEAQbBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2oiACAGIAVBEGogCBACQQJ0aiICLwEAOwAAIAVBEGogAi0AAhABIAAgAi0AA2ohAwwBBSAPQX5qIQIDQCAFQRBqEAQgAyACS3JFBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsDQCADIAJNBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsCQCADIA9PDQAgAyAGIAVBEGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBEGogAi0AAhABDAELIAUoAhRBH0sNACAFQRBqIAYgAEECdGotAAIQASAFKAIUQSFJDQAgBUEgNgIUCyABQWwgBUHYAGoQCiAFQUBrEApxIAVBKGoQCnEgBUEQahAKcRshCwwJCwAACwALAAALAAsAAAsACwAACwALQWwhCwsgBUHwAGokACALC7UEAQ5/IwBBEGsiBiQAIAZBBGogABAOQVQhBQJAIARB3AtJDQAgBi0ABCEHIANB8ARqQQBB7AAQECEIIAdBDEsNACADQdwJaiIJIAggBkEIaiAGQQxqIAEgAhAxIhAQA0UEQCAGKAIMIgQgB0sNASADQdwFaiEPIANBpAVqIREgAEEEaiESIANBqAVqIQEgBCEFA0AgBSICQX9qIQUgCCACQQJ0aigCAEUNAAsgAkEBaiEOQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgASALaiAKNgIAIAVBAWohBSAKIAxqIQoMAQsLIAEgCjYCAEEAIQUgBigCCCELA0AgBSALRkUEQCABIAUgCWotAAAiDEECdGoiDSANKAIAIg1BAWo2AgAgDyANQQF0aiINIAw6AAEgDSAFOgAAIAVBAWohBQwBCwtBACEBIANBADYCqAUgBEF/cyAHaiEJQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgAyALaiABNgIAIAwgBSAJanQgAWohASAFQQFqIQUMAQsLIAcgBEEBaiIBIAJrIgRrQQFqIQgDQEEBIQUgBCAIT0UEQANAIAUgDk9FBEAgBUECdCIJIAMgBEE0bGpqIAMgCWooAgAgBHY2AgAgBUEBaiEFDAELCyAEQQFqIQQMAQsLIBIgByAPIAogESADIAIgARBkIAZBAToABSAGIAc6AAYgACAGKAIENgIACyAQIQULIAZBEGokACAFC8ENAQt/IwBB8ABrIgUkAEFsIQkCQCADQQpJDQAgAi8AACEKIAIvAAIhDCACLwAEIQYgBUEIaiAEEA4CQCADIAYgCiAMampBBmoiDUkNACAFLQAKIQcgBUHYAGogAkEGaiICIAoQBiIJEAMNASAFQUBrIAIgCmoiAiAMEAYiCRADDQEgBUEoaiACIAxqIgIgBhAGIgkQAw0BIAVBEGogAiAGaiADIA1rEAYiCRADDQEgACABaiIOQX1qIQ8gBEEEaiEGQQEhCSAAIAFBA2pBAnYiAmoiCiACaiIMIAJqIg0hAyAMIQQgCiECA0AgCSADIA9JcQRAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAACAGIAVBQGsgBxACQQF0aiIILQAAIQsgBUFAayAILQABEAEgAiALOgAAIAYgBUEoaiAHEAJBAXRqIggtAAAhCyAFQShqIAgtAAEQASAEIAs6AAAgBiAFQRBqIAcQAkEBdGoiCC0AACELIAVBEGogCC0AARABIAMgCzoAACAGIAVB2ABqIAcQAkEBdGoiCC0AACELIAVB2ABqIAgtAAEQASAAIAs6AAEgBiAFQUBrIAcQAkEBdGoiCC0AACELIAVBQGsgCC0AARABIAIgCzoAASAGIAVBKGogBxACQQF0aiIILQAAIQsgBUEoaiAILQABEAEgBCALOgABIAYgBUEQaiAHEAJBAXRqIggtAAAhCyAFQRBqIAgtAAEQASADIAs6AAEgA0ECaiEDIARBAmohBCACQQJqIQIgAEECaiEAIAkgBUHYAGoQDUVxIAVBQGsQDUVxIAVBKGoQDUVxIAVBEGoQDUVxIQkMAQsLIAQgDUsgAiAMS3INAEFsIQkgACAKSw0BIApBfWohCQNAIAVB2ABqEAQgACAJT3JFBEAgBiAFQdgAaiAHEAJBAXRqIggtAAAhCyAFQdgAaiAILQABEAEgACALOgAAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAASAAQQJqIQAMAQsLA0AgBUHYAGoQBCAAIApPckUEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCwNAIAAgCkkEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCyAMQX1qIQADQCAFQUBrEAQgAiAAT3JFBEAgBiAFQUBrIAcQAkEBdGoiCi0AACEJIAVBQGsgCi0AARABIAIgCToAACAGIAVBQGsgBxACQQF0aiIKLQAAIQkgBUFAayAKLQABEAEgAiAJOgABIAJBAmohAgwBCwsDQCAFQUBrEAQgAiAMT3JFBEAgBiAFQUBrIAcQAkEBdGoiAC0AACEKIAVBQGsgAC0AARABIAIgCjoAACACQQFqIQIMAQsLA0AgAiAMSQRAIAYgBUFAayAHEAJBAXRqIgAtAAAhCiAFQUBrIAAtAAEQASACIAo6AAAgAkEBaiECDAELCyANQX1qIQADQCAFQShqEAQgBCAAT3JFBEAgBiAFQShqIAcQAkEBdGoiAi0AACEKIAVBKGogAi0AARABIAQgCjoAACAGIAVBKGogBxACQQF0aiICLQAAIQogBUEoaiACLQABEAEgBCAKOgABIARBAmohBAwBCwsDQCAFQShqEAQgBCANT3JFBEAgBiAFQShqIAcQAkEBdGoiAC0AACECIAVBKGogAC0AARABIAQgAjoAACAEQQFqIQQMAQsLA0AgBCANSQRAIAYgBUEoaiAHEAJBAXRqIgAtAAAhAiAFQShqIAAtAAEQASAEIAI6AAAgBEEBaiEEDAELCwNAIAVBEGoQBCADIA9PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIAYgBUEQaiAHEAJBAXRqIgAtAAAhAiAFQRBqIAAtAAEQASADIAI6AAEgA0ECaiEDDAELCwNAIAVBEGoQBCADIA5PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIANBAWohAwwBCwsDQCADIA5JBEAgBiAFQRBqIAcQAkEBdGoiAC0AACECIAVBEGogAC0AARABIAMgAjoAACADQQFqIQMMAQsLIAFBbCAFQdgAahAKIAVBQGsQCnEgBUEoahAKcSAFQRBqEApxGyEJDAELQWwhCQsgBUHwAGokACAJC8oCAQR/IwBBIGsiBSQAIAUgBBAOIAUtAAIhByAFQQhqIAIgAxAGIgIQA0UEQCAEQQRqIQIgACABaiIDQX1qIQQDQCAFQQhqEAQgACAET3JFBEAgAiAFQQhqIAcQAkEBdGoiBi0AACEIIAVBCGogBi0AARABIAAgCDoAACACIAVBCGogBxACQQF0aiIGLQAAIQggBUEIaiAGLQABEAEgACAIOgABIABBAmohAAwBCwsDQCAFQQhqEAQgACADT3JFBEAgAiAFQQhqIAcQAkEBdGoiBC0AACEGIAVBCGogBC0AARABIAAgBjoAACAAQQFqIQAMAQsLA0AgACADT0UEQCACIAVBCGogBxACQQF0aiIELQAAIQYgBUEIaiAELQABEAEgACAGOgAAIABBAWohAAwBCwsgAUFsIAVBCGoQChshAgsgBUEgaiQAIAILtgMBCX8jAEEQayIGJAAgBkEANgIMIAZBADYCCEFUIQQCQAJAIANBQGsiDCADIAZBCGogBkEMaiABIAIQMSICEAMNACAGQQRqIAAQDiAGKAIMIgcgBi0ABEEBaksNASAAQQRqIQogBkEAOgAFIAYgBzoABiAAIAYoAgQ2AgAgB0EBaiEJQQEhBANAIAQgCUkEQCADIARBAnRqIgEoAgAhACABIAU2AgAgACAEQX9qdCAFaiEFIARBAWohBAwBCwsgB0EBaiEHQQAhBSAGKAIIIQkDQCAFIAlGDQEgAyAFIAxqLQAAIgRBAnRqIgBBASAEdEEBdSILIAAoAgAiAWoiADYCACAHIARrIQhBACEEAkAgC0EDTQRAA0AgBCALRg0CIAogASAEakEBdGoiACAIOgABIAAgBToAACAEQQFqIQQMAAALAAsDQCABIABPDQEgCiABQQF0aiIEIAg6AAEgBCAFOgAAIAQgCDoAAyAEIAU6AAIgBCAIOgAFIAQgBToABCAEIAg6AAcgBCAFOgAGIAFBBGohAQwAAAsACyAFQQFqIQUMAAALAAsgAiEECyAGQRBqJAAgBAutAQECfwJAQYQgKAIAIABHIAAoAgBBAXYiAyABa0F4aiICQXhxQQhHcgR/IAIFIAMQJ0UNASACQQhqC0EQSQ0AIAAgACgCACICQQFxIAAgAWpBD2pBeHEiASAAa0EBdHI2AgAgASAANgIEIAEgASgCAEEBcSAAIAJBAXZqIAFrIgJBAXRyNgIAQYQgIAEgAkH/////B3FqQQRqQYQgKAIAIABGGyABNgIAIAEQJQsLygIBBX8CQAJAAkAgAEEIIABBCEsbZ0EfcyAAaUEBR2oiAUEESSAAIAF2cg0AIAFBAnRB/B5qKAIAIgJFDQADQCACQXhqIgMoAgBBAXZBeGoiBSAATwRAIAIgBUEIIAVBCEsbZ0Efc0ECdEGAH2oiASgCAEYEQCABIAIoAgQ2AgALDAMLIARBHksNASAEQQFqIQQgAigCBCICDQALC0EAIQMgAUEgTw0BA0AgAUECdEGAH2ooAgAiAkUEQCABQR5LIQIgAUEBaiEBIAJFDQEMAwsLIAIgAkF4aiIDKAIAQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgBGBEAgASACKAIENgIACwsgAigCACIBBEAgASACKAIENgIECyACKAIEIgEEQCABIAIoAgA2AgALIAMgAygCAEEBcjYCACADIAAQNwsgAwvhCwINfwV+IwBB8ABrIgckACAHIAAoAvDhASIINgJcIAEgAmohDSAIIAAoAoDiAWohDwJAAkAgBUUEQCABIQQMAQsgACgCxOABIRAgACgCwOABIREgACgCvOABIQ4gAEEBNgKM4QFBACEIA0AgCEEDRwRAIAcgCEECdCICaiAAIAJqQazQAWooAgA2AkQgCEEBaiEIDAELC0FsIQwgB0EYaiADIAQQBhADDQEgB0EsaiAHQRhqIAAoAgAQEyAHQTRqIAdBGGogACgCCBATIAdBPGogB0EYaiAAKAIEEBMgDUFgaiESIAEhBEEAIQwDQCAHKAIwIAcoAixBA3RqKQIAIhRCEIinQf8BcSEIIAcoAkAgBygCPEEDdGopAgAiFUIQiKdB/wFxIQsgBygCOCAHKAI0QQN0aikCACIWQiCIpyEJIBVCIIghFyAUQiCIpyECAkAgFkIQiKdB/wFxIgNBAk8EQAJAIAZFIANBGUlyRQRAIAkgB0EYaiADQSAgBygCHGsiCiAKIANLGyIKEAUgAyAKayIDdGohCSAHQRhqEAQaIANFDQEgB0EYaiADEAUgCWohCQwBCyAHQRhqIAMQBSAJaiEJIAdBGGoQBBoLIAcpAkQhGCAHIAk2AkQgByAYNwNIDAELAkAgA0UEQCACBEAgBygCRCEJDAMLIAcoAkghCQwBCwJAAkAgB0EYakEBEAUgCSACRWpqIgNBA0YEQCAHKAJEQX9qIgMgA0VqIQkMAQsgA0ECdCAHaigCRCIJIAlFaiEJIANBAUYNAQsgByAHKAJINgJMCwsgByAHKAJENgJIIAcgCTYCRAsgF6chAyALBEAgB0EYaiALEAUgA2ohAwsgCCALakEUTwRAIAdBGGoQBBoLIAgEQCAHQRhqIAgQBSACaiECCyAHQRhqEAQaIAcgB0EYaiAUQhiIp0H/AXEQCCAUp0H//wNxajYCLCAHIAdBGGogFUIYiKdB/wFxEAggFadB//8DcWo2AjwgB0EYahAEGiAHIAdBGGogFkIYiKdB/wFxEAggFqdB//8DcWo2AjQgByACNgJgIAcoAlwhCiAHIAk2AmggByADNgJkAkACQAJAIAQgAiADaiILaiASSw0AIAIgCmoiEyAPSw0AIA0gBGsgC0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdBKGogACgCBBATQQAhBCAHQeAAaiEMIAdB5ABqIQoDQCAHQShqEARBAksgBCAXTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEJIAcoAkggBygCREEDdGopAgAiH0IgiKchCCAeQiCIISAgHUIgiKchAgJAIB9CEIinQf8BcSIDQQJPBEACQCAGRSADQRlJckUEQCAIIAdBKGogA0EgIAcoAixrIg0gDSADSxsiDRAFIAMgDWsiA3RqIQggB0EoahAEGiADRQ0BIAdBKGogAxAFIAhqIQgMAQsgB0EoaiADEAUgCGohCCAHQShqEAQaCyAHKQJUISEgByAINgJUIAcgITcDWAwBCwJAIANFBEAgAgRAIAcoAlQhCAwDCyAHKAJYIQgMAQsCQAJAIAdBKGpBARAFIAggAkVqaiIDQQNGBEAgBygCVEF/aiIDIANFaiEIDAELIANBAnQgB2ooAlQiCCAIRWohCCADQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAg2AlQLICCnIQMgCQRAIAdBKGogCRAFIANqIQMLIAkgC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgAmohAgsgB0EoahAEGiAHIAcoAmggAmoiCSADajYCaCAKIAwgCCAJSxsoAgAhDSAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogB0EoaiAfQhiIp0H/AXEQCCEOIAdB8ABqIARBBHRqIgsgCSANaiAIazYCDCALIAg2AgggCyADNgIEIAsgAjYCACAHIA4gH6dB//8DcWo2AkQgBEEBaiEEDAELCyAEIBdIDQEgEkFgaiEYIAdB4ABqIRogB0HkAGohGyABIQMDQCAHQShqEARBAksgBCAFTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEIIAcoAkggBygCREEDdGopAgAiH0IgiKchCSAeQiCIISAgHUIgiKchDAJAIB9CEIinQf8BcSICQQJPBEACQCAGRSACQRlJckUEQCAJIAdBKGogAkEgIAcoAixrIgogCiACSxsiChAFIAIgCmsiAnRqIQkgB0EoahAEGiACRQ0BIAdBKGogAhAFIAlqIQkMAQsgB0EoaiACEAUgCWohCSAHQShqEAQaCyAHKQJUISEgByAJNgJUIAcgITcDWAwBCwJAIAJFBEAgDARAIAcoAlQhCQwDCyAHKAJYIQkMAQsCQAJAIAdBKGpBARAFIAkgDEVqaiICQQNGBEAgBygCVEF/aiICIAJFaiEJDAELIAJBAnQgB2ooAlQiCSAJRWohCSACQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAk2AlQLICCnIRQgCARAIAdBKGogCBAFIBRqIRQLIAggC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgDGohDAsgB0EoahAEGiAHIAcoAmggDGoiGSAUajYCaCAbIBogCSAZSxsoAgAhHCAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogByAHQShqIB9CGIinQf8BcRAIIB+nQf//A3FqNgJEIAcgB0HwAGogBEEDcUEEdGoiDSkDCCIdNwPIASAHIA0pAwAiHjcDwAECQAJAAkAgBygCvAEiDiAepyICaiIWIBNLDQAgAyAHKALEASIKIAJqIgtqIBhLDQAgEiADayALQSBqTw0BCyAHIAcpA8gBNwMQIAcgBykDwAE3AwggAyASIAdBCGogB0G8AWogEyAPIBUgERAeIQsMAQsgAiADaiEIIAMgDhAHIAJBEU8EQCADQRBqIQIDQCACIA5BEGoiDhAHIAJBEGoiAiAISQ0ACwsgCCAdpyIOayECIAcgFjYCvAEgDiAIIA9rSwRAIA4gCCAVa0sEQEFsIQsMAgsgESACIA9rIgJqIhYgCmogEU0EQCAIIBYgChAPGgwCCyAIIBZBACACaxAPIQggByACIApqIgo2AsQBIAggAmshCCAPIQILIA5BEE8EQCAIIApqIQoDQCAIIAIQByACQRBqIQIgCEEQaiIIIApJDQALDAELAkAgDkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgDkECdCIKQcAeaigCAGoiAhAXIAIgCkHgHmooAgBrIQIgBygCxAEhCgwBCyAIIAIQDAsgCkEJSQ0AIAggCmohCiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAKSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAKSQ0ACwsgCxADBEAgCyEQDAQFIA0gDDYCACANIBkgHGogCWs2AgwgDSAJNgIIIA0gFDYCBCAEQQFqIQQgAyALaiEDDAILAAsLIAQgBUgNASAEIBdrIQtBACEEA0AgCyAFSARAIAcgB0HwAGogC0EDcUEEdGoiAikDCCIdNwPIASAHIAIpAwAiHjcDwAECQAJAAkAgBygCvAEiDCAepyICaiIKIBNLDQAgAyAHKALEASIJIAJqIhBqIBhLDQAgEiADayAQQSBqTw0BCyAHIAcpA8gBNwMgIAcgBykDwAE3AxggAyASIAdBGGogB0G8AWogEyAPIBUgERAeIRAMAQsgAiADaiEIIAMgDBAHIAJBEU8EQCADQRBqIQIDQCACIAxBEGoiDBAHIAJBEGoiAiAISQ0ACwsgCCAdpyIGayECIAcgCjYCvAEgBiAIIA9rSwRAIAYgCCAVa0sEQEFsIRAMAgsgESACIA9rIgJqIgwgCWogEU0EQCAIIAwgCRAPGgwCCyAIIAxBACACaxAPIQggByACIAlqIgk2AsQBIAggAmshCCAPIQILIAZBEE8EQCAIIAlqIQYDQCAIIAIQByACQRBqIQIgCEEQaiIIIAZJDQALDAELAkAgBkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgBkECdCIGQcAeaigCAGoiAhAXIAIgBkHgHmooAgBrIQIgBygCxAEhCQwBCyAIIAIQDAsgCUEJSQ0AIAggCWohBiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAGSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAGSQ0ACwsgEBADDQMgC0EBaiELIAMgEGohAwwBCwsDQCAEQQNHBEAgACAEQQJ0IgJqQazQAWogAiAHaigCVDYCACAEQQFqIQQMAQsLIAcoArwBIQgLQbp/IRAgEyAIayIAIBIgA2tLDQAgAwR/IAMgCCAAEAsgAGoFQQALIAFrIRALIAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY0AAQMyIFEAMiBg0AIANBHzYCfCADIANB/ABqIANB+ABqIAQgBCAFaiAGGyIEIAEgAmoiAiAEaxAVIgUQAw0AIAMoAnwiBkEfSw0AIAMoAngiB0EJTw0AIABBiCBqIAMgBkGAC0GADCAHEBggA0E0NgJ8IAMgA0H8AGogA0H4AGogBCAFaiIEIAIgBGsQFSIFEAMNACADKAJ8IgZBNEsNACADKAJ4IgdBCk8NACAAQZAwaiADIAZBgA1B4A4gBxAYIANBIzYCfCADIANB/ABqIANB+ABqIAQgBWoiBCACIARrEBUiBRADDQAgAygCfCIGQSNLDQAgAygCeCIHQQpPDQAgACADIAZBwBBB0BEgBxAYIAQgBWoiBEEMaiIFIAJLDQAgAiAFayEFQQAhAgNAIAJBA0cEQCAEKAAAIgZBf2ogBU8NAiAAIAJBAnRqQZzQAWogBjYCACACQQFqIQIgBEEEaiEEDAELCyAEIAFrIQgLIANBgAFqJAAgCAtGAQN/IABBCGohAyAAKAIEIQJBACEAA0AgACACdkUEQCABIAMgAEEDdGotAAJBFktqIQEgAEEBaiEADAELCyABQQggAmt0C4YDAQV/Qbh/IQcCQCADRQ0AIAItAAAiBEUEQCABQQA2AgBBAUG4fyADQQFGGw8LAn8gAkEBaiIFIARBGHRBGHUiBkF/Sg0AGiAGQX9GBEAgA0EDSA0CIAUvAABBgP4BaiEEIAJBA2oMAQsgA0ECSA0BIAItAAEgBEEIdHJBgIB+aiEEIAJBAmoLIQUgASAENgIAIAVBAWoiASACIANqIgNLDQBBbCEHIABBEGogACAFLQAAIgVBBnZBI0EJIAEgAyABa0HAEEHQEUHwEiAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBmCBqIABBCGogBUEEdkEDcUEfQQggASABIAZqIAgbIgEgAyABa0GAC0GADEGAFyAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBoDBqIABBBGogBUECdkEDcUE0QQkgASABIAZqIAgbIgEgAyABa0GADUHgDkGQGSAAKAKM4QEgACgCnOIBIAQQHyIAEAMNACAAIAFqIAJrIQcLIAcLrQMBCn8jAEGABGsiCCQAAn9BUiACQf8BSw0AGkFUIANBDEsNABogAkEBaiELIABBBGohCUGAgAQgA0F/anRBEHUhCkEAIQJBASEEQQEgA3QiB0F/aiIMIQUDQCACIAtGRQRAAkAgASACQQF0Ig1qLwEAIgZB//8DRgRAIAkgBUECdGogAjoAAiAFQX9qIQVBASEGDAELIARBACAKIAZBEHRBEHVKGyEECyAIIA1qIAY7AQAgAkEBaiECDAELCyAAIAQ7AQIgACADOwEAIAdBA3YgB0EBdmpBA2ohBkEAIQRBACECA0AgBCALRkUEQCABIARBAXRqLgEAIQpBACEAA0AgACAKTkUEQCAJIAJBAnRqIAQ6AAIDQCACIAZqIAxxIgIgBUsNAAsgAEEBaiEADAELCyAEQQFqIQQMAQsLQX8gAg0AGkEAIQIDfyACIAdGBH9BAAUgCCAJIAJBAnRqIgAtAAJBAXRqIgEgAS8BACIBQQFqOwEAIAAgAyABEBRrIgU6AAMgACABIAVB/wFxdCAHazsBACACQQFqIQIMAQsLCyEFIAhBgARqJAAgBQvjBgEIf0FsIQcCQCACQQNJDQACQAJAAkACQCABLQAAIgNBA3EiCUEBaw4DAwEAAgsgACgCiOEBDQBBYg8LIAJBBUkNAkEDIQYgASgAACEFAn8CQAJAIANBAnZBA3EiCEF+aiIEQQFNBEAgBEEBaw0BDAILIAVBDnZB/wdxIQQgBUEEdkH/B3EhAyAIRQwCCyAFQRJ2IQRBBCEGIAVBBHZB//8AcSEDQQAMAQsgBUEEdkH//w9xIgNBgIAISw0DIAEtAARBCnQgBUEWdnIhBEEFIQZBAAshBSAEIAZqIgogAksNAgJAIANBgQZJDQAgACgCnOIBRQ0AQQAhAgNAIAJBg4ABSw0BIAJBQGshAgwAAAsACwJ/IAlBA0YEQCABIAZqIQEgAEHw4gFqIQIgACgCDCEGIAUEQCACIAMgASAEIAYQXwwCCyACIAMgASAEIAYQXQwBCyAAQbjQAWohAiABIAZqIQEgAEHw4gFqIQYgAEGo0ABqIQggBQRAIAggBiADIAEgBCACEF4MAQsgCCAGIAMgASAEIAIQXAsQAw0CIAAgAzYCgOIBIABBATYCiOEBIAAgAEHw4gFqNgLw4QEgCUECRgRAIAAgAEGo0ABqNgIMCyAAIANqIgBBiOMBakIANwAAIABBgOMBakIANwAAIABB+OIBakIANwAAIABB8OIBakIANwAAIAoPCwJ/AkACQAJAIANBAnZBA3FBf2oiBEECSw0AIARBAWsOAgACAQtBASEEIANBA3YMAgtBAiEEIAEvAABBBHYMAQtBAyEEIAEQIUEEdgsiAyAEaiIFQSBqIAJLBEAgBSACSw0CIABB8OIBaiABIARqIAMQCyEBIAAgAzYCgOIBIAAgATYC8OEBIAEgA2oiAEIANwAYIABCADcAECAAQgA3AAggAEIANwAAIAUPCyAAIAM2AoDiASAAIAEgBGo2AvDhASAFDwsCfwJAAkACQCADQQJ2QQNxQX9qIgRBAksNACAEQQFrDgIAAgELQQEhByADQQN2DAILQQIhByABLwAAQQR2DAELIAJBBEkgARAhIgJBj4CAAUtyDQFBAyEHIAJBBHYLIQIgAEHw4gFqIAEgB2otAAAgAkEgahAQIQEgACACNgKA4gEgACABNgLw4QEgB0EBaiEHCyAHC0sAIABC+erQ0OfJoeThADcDICAAQgA3AxggAELP1tO+0ser2UI3AxAgAELW64Lu6v2J9eAANwMIIABCADcDACAAQShqQQBBKBAQGgviAgICfwV+IABBKGoiASAAKAJIaiECAn4gACkDACIDQiBaBEAgACkDECIEQgeJIAApAwgiBUIBiXwgACkDGCIGQgyJfCAAKQMgIgdCEol8IAUQGSAEEBkgBhAZIAcQGQwBCyAAKQMYQsXP2bLx5brqJ3wLIAN8IQMDQCABQQhqIgAgAk0EQEIAIAEpAAAQCSADhUIbiUKHla+vmLbem55/fkLj3MqV/M7y9YV/fCEDIAAhAQwBCwsCQCABQQRqIgAgAksEQCABIQAMAQsgASgAAK1Ch5Wvr5i23puef34gA4VCF4lCz9bTvtLHq9lCfkL5893xmfaZqxZ8IQMLA0AgACACSQRAIAAxAABCxc/ZsvHluuonfiADhUILiUKHla+vmLbem55/fiEDIABBAWohAAwBCwsgA0IhiCADhULP1tO+0ser2UJ+IgNCHYggA4VC+fPd8Zn2masWfiIDQiCIIAOFC+8CAgJ/BH4gACAAKQMAIAKtfDcDAAJAAkAgACgCSCIDIAJqIgRBH00EQCABRQ0BIAAgA2pBKGogASACECAgACgCSCACaiEEDAELIAEgAmohAgJ/IAMEQCAAQShqIgQgA2ogAUEgIANrECAgACAAKQMIIAQpAAAQCTcDCCAAIAApAxAgACkAMBAJNwMQIAAgACkDGCAAKQA4EAk3AxggACAAKQMgIABBQGspAAAQCTcDICAAKAJIIQMgAEEANgJIIAEgA2tBIGohAQsgAUEgaiACTQsEQCACQWBqIQMgACkDICEFIAApAxghBiAAKQMQIQcgACkDCCEIA0AgCCABKQAAEAkhCCAHIAEpAAgQCSEHIAYgASkAEBAJIQYgBSABKQAYEAkhBSABQSBqIgEgA00NAAsgACAFNwMgIAAgBjcDGCAAIAc3AxAgACAINwMICyABIAJPDQEgAEEoaiABIAIgAWsiBBAgCyAAIAQ2AkgLCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQEBogAwVBun8LCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQCxogAwVBun8LC6gCAQZ/IwBBEGsiByQAIABB2OABaikDAEKAgIAQViEIQbh/IQUCQCAEQf//B0sNACAAIAMgBBBCIgUQAyIGDQAgACgCnOIBIQkgACAHQQxqIAMgAyAFaiAGGyIKIARBACAFIAYbayIGEEAiAxADBEAgAyEFDAELIAcoAgwhBCABRQRAQbp/IQUgBEEASg0BCyAGIANrIQUgAyAKaiEDAkAgCQRAIABBADYCnOIBDAELAkACQAJAIARBBUgNACAAQdjgAWopAwBCgICACFgNAAwBCyAAQQA2ApziAQwBCyAAKAIIED8hBiAAQQA2ApziASAGQRRPDQELIAAgASACIAMgBSAEIAgQOSEFDAELIAAgASACIAMgBSAEIAgQOiEFCyAHQRBqJAAgBQtnACAAQdDgAWogASACIAAoAuzhARAuIgEQAwRAIAEPC0G4fyECAkAgAQ0AIABB7OABaigCACIBBEBBYCECIAAoApjiASABRw0BC0EAIQIgAEHw4AFqKAIARQ0AIABBkOEBahBDCyACCycBAX8QVyIERQRAQUAPCyAEIAAgASACIAMgBBBLEE8hACAEEFYgAAs/AQF/AkACQAJAIAAoAqDiAUEBaiIBQQJLDQAgAUEBaw4CAAECCyAAEDBBAA8LIABBADYCoOIBCyAAKAKU4gELvAMCB38BfiMAQRBrIgkkAEG4fyEGAkAgBCgCACIIQQVBCSAAKALs4QEiBRtJDQAgAygCACIHQQFBBSAFGyAFEC8iBRADBEAgBSEGDAELIAggBUEDakkNACAAIAcgBRBJIgYQAw0AIAEgAmohCiAAQZDhAWohCyAIIAVrIQIgBSAHaiEHIAEhBQNAIAcgAiAJECwiBhADDQEgAkF9aiICIAZJBEBBuH8hBgwCCyAJKAIAIghBAksEQEFsIQYMAgsgB0EDaiEHAn8CQAJAAkAgCEEBaw4CAgABCyAAIAUgCiAFayAHIAYQSAwCCyAFIAogBWsgByAGEEcMAQsgBSAKIAVrIActAAAgCSgCCBBGCyIIEAMEQCAIIQYMAgsgACgC8OABBEAgCyAFIAgQRQsgAiAGayECIAYgB2ohByAFIAhqIQUgCSgCBEUNAAsgACkD0OABIgxCf1IEQEFsIQYgDCAFIAFrrFINAQsgACgC8OABBEBBaiEGIAJBBEkNASALEEQhDCAHKAAAIAynRw0BIAdBBGohByACQXxqIQILIAMgBzYCACAEIAI2AgAgBSABayEGCyAJQRBqJAAgBgsuACAAECsCf0EAQQAQAw0AGiABRSACRXJFBEBBYiAAIAEgAhA9EAMNARoLQQALCzcAIAEEQCAAIAAoAsTgASABKAIEIAEoAghqRzYCnOIBCyAAECtBABADIAFFckUEQCAAIAEQWwsL0QIBB38jAEEQayIGJAAgBiAENgIIIAYgAzYCDCAFBEAgBSgCBCEKIAUoAgghCQsgASEIAkACQANAIAAoAuzhARAWIQsCQANAIAQgC0kNASADKAAAQXBxQdDUtMIBRgRAIAMgBBAiIgcQAw0EIAQgB2shBCADIAdqIQMMAQsLIAYgAzYCDCAGIAQ2AggCQCAFBEAgACAFEE5BACEHQQAQA0UNAQwFCyAAIAogCRBNIgcQAw0ECyAAIAgQUCAMQQFHQQAgACAIIAIgBkEMaiAGQQhqEEwiByIDa0EAIAMQAxtBCkdyRQRAQbh/IQcMBAsgBxADDQMgAiAHayECIAcgCGohCEEBIQwgBigCDCEDIAYoAgghBAwBCwsgBiADNgIMIAYgBDYCCEG4fyEHIAQNASAIIAFrIQcMAQsgBiADNgIMIAYgBDYCCAsgBkEQaiQAIAcLRgECfyABIAAoArjgASICRwRAIAAgAjYCxOABIAAgATYCuOABIAAoArzgASEDIAAgATYCvOABIAAgASADIAJrajYCwOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEEdCAAbiECCyAAQQh2IgEgAkEYbCIAQYwIaigCAGwgAEGICGooAgBqIgJBA3YgAmogAEGACGooAgAgAEGECGooAgAgAWxqSQs3ACAAIAMgBCAFQYAQEDMiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQMgVBuH8LC78DAQN/IwBBIGsiBSQAIAVBCGogAiADEAYiAhADRQRAIAAgAWoiB0F9aiEGIAUgBBAOIARBBGohAiAFLQACIQMDQEEAIAAgBkkgBUEIahAEGwRAIAAgAiAFQQhqIAMQAkECdGoiBC8BADsAACAFQQhqIAQtAAIQASAAIAQtAANqIgQgAiAFQQhqIAMQAkECdGoiAC8BADsAACAFQQhqIAAtAAIQASAEIAAtAANqIQAMAQUgB0F+aiEEA0AgBUEIahAEIAAgBEtyRQRAIAAgAiAFQQhqIAMQAkECdGoiBi8BADsAACAFQQhqIAYtAAIQASAAIAYtAANqIQAMAQsLA0AgACAES0UEQCAAIAIgBUEIaiADEAJBAnRqIgYvAQA7AAAgBUEIaiAGLQACEAEgACAGLQADaiEADAELCwJAIAAgB08NACAAIAIgBUEIaiADEAIiA0ECdGoiAC0AADoAACAALQADQQFGBEAgBUEIaiAALQACEAEMAQsgBSgCDEEfSw0AIAVBCGogAiADQQJ0ai0AAhABIAUoAgxBIUkNACAFQSA2AgwLIAFBbCAFQQhqEAobIQILCwsgBUEgaiQAIAILkgIBBH8jAEFAaiIJJAAgCSADQTQQCyEDAkAgBEECSA0AIAMgBEECdGooAgAhCSADQTxqIAgQIyADQQE6AD8gAyACOgA+QQAhBCADKAI8IQoDQCAEIAlGDQEgACAEQQJ0aiAKNgEAIARBAWohBAwAAAsAC0EAIQkDQCAGIAlGRQRAIAMgBSAJQQF0aiIKLQABIgtBAnRqIgwoAgAhBCADQTxqIAotAABBCHQgCGpB//8DcRAjIANBAjoAPyADIAcgC2siCiACajoAPiAEQQEgASAKa3RqIQogAygCPCELA0AgACAEQQJ0aiALNgEAIARBAWoiBCAKSQ0ACyAMIAo2AgAgCUEBaiEJDAELCyADQUBrJAALowIBCX8jAEHQAGsiCSQAIAlBEGogBUE0EAsaIAcgBmshDyAHIAFrIRADQAJAIAMgCkcEQEEBIAEgByACIApBAXRqIgYtAAEiDGsiCGsiC3QhDSAGLQAAIQ4gCUEQaiAMQQJ0aiIMKAIAIQYgCyAPTwRAIAAgBkECdGogCyAIIAUgCEE0bGogCCAQaiIIQQEgCEEBShsiCCACIAQgCEECdGooAgAiCEEBdGogAyAIayAHIA4QYyAGIA1qIQgMAgsgCUEMaiAOECMgCUEBOgAPIAkgCDoADiAGIA1qIQggCSgCDCELA0AgBiAITw0CIAAgBkECdGogCzYBACAGQQFqIQYMAAALAAsgCUHQAGokAA8LIAwgCDYCACAKQQFqIQoMAAALAAs0ACAAIAMgBCAFEDYiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQNAVBuH8LCyMAIAA/AEEQdGtB//8DakEQdkAAQX9GBEBBAA8LQQAQAEEBCzsBAX8gAgRAA0AgACABIAJBgCAgAkGAIEkbIgMQCyEAIAFBgCBqIQEgAEGAIGohACACIANrIgINAAsLCwYAIAAQAwsLqBUJAEGICAsNAQAAAAEAAAACAAAAAgBBoAgLswYBAAAAAQAAAAIAAAACAAAAJgAAAIIAAAAhBQAASgAAAGcIAAAmAAAAwAEAAIAAAABJBQAASgAAAL4IAAApAAAALAIAAIAAAABJBQAASgAAAL4IAAAvAAAAygIAAIAAAACKBQAASgAAAIQJAAA1AAAAcwMAAIAAAACdBQAASgAAAKAJAAA9AAAAgQMAAIAAAADrBQAASwAAAD4KAABEAAAAngMAAIAAAABNBgAASwAAAKoKAABLAAAAswMAAIAAAADBBgAATQAAAB8NAABNAAAAUwQAAIAAAAAjCAAAUQAAAKYPAABUAAAAmQQAAIAAAABLCQAAVwAAALESAABYAAAA2gQAAIAAAABvCQAAXQAAACMUAABUAAAARQUAAIAAAABUCgAAagAAAIwUAABqAAAArwUAAIAAAAB2CQAAfAAAAE4QAAB8AAAA0gIAAIAAAABjBwAAkQAAAJAHAACSAAAAAAAAAAEAAAABAAAABQAAAA0AAAAdAAAAPQAAAH0AAAD9AAAA/QEAAP0DAAD9BwAA/Q8AAP0fAAD9PwAA/X8AAP3/AAD9/wEA/f8DAP3/BwD9/w8A/f8fAP3/PwD9/38A/f//AP3//wH9//8D/f//B/3//w/9//8f/f//P/3//38AAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAAHwAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACUAAAAnAAAAKQAAACsAAAAvAAAAMwAAADsAAABDAAAAUwAAAGMAAACDAAAAAwEAAAMCAAADBAAAAwgAAAMQAAADIAAAA0AAAAOAAAADAAEAQeAPC1EBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAEAAAABQAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAQcQQC4sBAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABIAAAAUAAAAFgAAABgAAAAcAAAAIAAAACgAAAAwAAAAQAAAAIAAAAAAAQAAAAIAAAAEAAAACAAAABAAAAAgAAAAQAAAAIAAAAAAAQBBkBIL5gQBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAAAEAAAAEAAAACAAAAAAAAAABAAEBBgAAAAAAAAQAAAAAEAAABAAAAAAgAAAFAQAAAAAAAAUDAAAAAAAABQQAAAAAAAAFBgAAAAAAAAUHAAAAAAAABQkAAAAAAAAFCgAAAAAAAAUMAAAAAAAABg4AAAAAAAEFEAAAAAAAAQUUAAAAAAABBRYAAAAAAAIFHAAAAAAAAwUgAAAAAAAEBTAAAAAgAAYFQAAAAAAABwWAAAAAAAAIBgABAAAAAAoGAAQAAAAADAYAEAAAIAAABAAAAAAAAAAEAQAAAAAAAAUCAAAAIAAABQQAAAAAAAAFBQAAACAAAAUHAAAAAAAABQgAAAAgAAAFCgAAAAAAAAULAAAAAAAABg0AAAAgAAEFEAAAAAAAAQUSAAAAIAABBRYAAAAAAAIFGAAAACAAAwUgAAAAAAADBSgAAAAAAAYEQAAAABAABgRAAAAAIAAHBYAAAAAAAAkGAAIAAAAACwYACAAAMAAABAAAAAAQAAAEAQAAACAAAAUCAAAAIAAABQMAAAAgAAAFBQAAACAAAAUGAAAAIAAABQgAAAAgAAAFCQAAACAAAAULAAAAIAAABQwAAAAAAAAGDwAAACAAAQUSAAAAIAABBRQAAAAgAAIFGAAAACAAAgUcAAAAIAADBSgAAAAgAAQFMAAAAAAAEAYAAAEAAAAPBgCAAAAAAA4GAEAAAAAADQYAIABBgBcLhwIBAAEBBQAAAAAAAAUAAAAAAAAGBD0AAAAAAAkF/QEAAAAADwX9fwAAAAAVBf3/HwAAAAMFBQAAAAAABwR9AAAAAAAMBf0PAAAAABIF/f8DAAAAFwX9/38AAAAFBR0AAAAAAAgE/QAAAAAADgX9PwAAAAAUBf3/DwAAAAIFAQAAABAABwR9AAAAAAALBf0HAAAAABEF/f8BAAAAFgX9/z8AAAAEBQ0AAAAQAAgE/QAAAAAADQX9HwAAAAATBf3/BwAAAAEFAQAAABAABgQ9AAAAAAAKBf0DAAAAABAF/f8AAAAAHAX9//8PAAAbBf3//wcAABoF/f//AwAAGQX9//8BAAAYBf3//wBBkBkLhgQBAAEBBgAAAAAAAAYDAAAAAAAABAQAAAAgAAAFBQAAAAAAAAUGAAAAAAAABQgAAAAAAAAFCQAAAAAAAAULAAAAAAAABg0AAAAAAAAGEAAAAAAAAAYTAAAAAAAABhYAAAAAAAAGGQAAAAAAAAYcAAAAAAAABh8AAAAAAAAGIgAAAAAAAQYlAAAAAAABBikAAAAAAAIGLwAAAAAAAwY7AAAAAAAEBlMAAAAAAAcGgwAAAAAACQYDAgAAEAAABAQAAAAAAAAEBQAAACAAAAUGAAAAAAAABQcAAAAgAAAFCQAAAAAAAAUKAAAAAAAABgwAAAAAAAAGDwAAAAAAAAYSAAAAAAAABhUAAAAAAAAGGAAAAAAAAAYbAAAAAAAABh4AAAAAAAAGIQAAAAAAAQYjAAAAAAABBicAAAAAAAIGKwAAAAAAAwYzAAAAAAAEBkMAAAAAAAUGYwAAAAAACAYDAQAAIAAABAQAAAAwAAAEBAAAABAAAAQFAAAAIAAABQcAAAAgAAAFCAAAACAAAAUKAAAAIAAABQsAAAAAAAAGDgAAAAAAAAYRAAAAAAAABhQAAAAAAAAGFwAAAAAAAAYaAAAAAAAABh0AAAAAAAAGIAAAAAAAEAYDAAEAAAAPBgOAAAAAAA4GA0AAAAAADQYDIAAAAAAMBgMQAAAAAAsGAwgAAAAACgYDBABBpB0L2QEBAAAAAwAAAAcAAAAPAAAAHwAAAD8AAAB/AAAA/wAAAP8BAAD/AwAA/wcAAP8PAAD/HwAA/z8AAP9/AAD//wAA//8BAP//AwD//wcA//8PAP//HwD//z8A//9/AP///wD///8B////A////wf///8P////H////z////9/AAAAAAEAAAACAAAABAAAAAAAAAACAAAABAAAAAgAAAAAAAAAAQAAAAIAAAABAAAABAAAAAQAAAAEAAAABAAAAAgAAAAIAAAACAAAAAcAAAAIAAAACQAAAAoAAAALAEGgIAsDwBBQ",qy="display-p3",jy="display-p3-linear";({...Je.spaces[Ct]});const Bl=new WeakMap;let Ll=0,Dl;class fn extends Yi{constructor(e){super(e),this.transcoderPath="",this.transcoderBinary=null,this.transcoderPending=null,this.workerPool=new Fy,this.workerSourceURL="",this.workerConfig=null,typeof MSC_TRANSCODER<"u"&&console.warn('THREE.KTX2Loader: Please update to latest "basis_transcoder". "msc_basis_transcoder" is no longer supported in three.js r125+.')}setTranscoderPath(e){return this.transcoderPath=e,this}setWorkerLimit(e){return this.workerPool.setWorkerLimit(e),this}async detectSupportAsync(e){return this.workerConfig={astcSupported:await e.hasFeatureAsync("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:await e.hasFeatureAsync("texture-compression-etc2"),etc2Supported:await e.hasFeatureAsync("texture-compression-etc2"),dxtSupported:await e.hasFeatureAsync("texture-compression-bc"),bptcSupported:await e.hasFeatureAsync("texture-compression-bc"),pvrtcSupported:await e.hasFeatureAsync("texture-compression-pvrtc")},this}detectSupport(e){return e.isWebGPURenderer===!0?this.workerConfig={astcSupported:e.hasFeature("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:e.hasFeature("texture-compression-etc2"),etc2Supported:e.hasFeature("texture-compression-etc2"),dxtSupported:e.hasFeature("texture-compression-bc"),bptcSupported:e.hasFeature("texture-compression-bc"),pvrtcSupported:e.hasFeature("texture-compression-pvrtc")}:this.workerConfig={astcSupported:e.extensions.has("WEBGL_compressed_texture_astc"),astcHDRSupported:e.extensions.has("WEBGL_compressed_texture_astc")&&e.extensions.get("WEBGL_compressed_texture_astc").getSupportedProfiles().includes("hdr"),etc1Supported:e.extensions.has("WEBGL_compressed_texture_etc1"),etc2Supported:e.extensions.has("WEBGL_compressed_texture_etc"),dxtSupported:e.extensions.has("WEBGL_compressed_texture_s3tc"),bptcSupported:e.extensions.has("EXT_texture_compression_bptc"),pvrtcSupported:e.extensions.has("WEBGL_compressed_texture_pvrtc")||e.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")},this}init(){if(!this.transcoderPending){const e=new Ns(this.manager);e.setPath(this.transcoderPath),e.setWithCredentials(this.withCredentials);const t=e.loadAsync("basis_transcoder.js"),i=new Ns(this.manager);i.setPath(this.transcoderPath),i.setResponseType("arraybuffer"),i.setWithCredentials(this.withCredentials);const r=i.loadAsync("basis_transcoder.wasm");this.transcoderPending=Promise.all([t,r]).then(([s,a])=>{const o=fn.BasisWorker.toString(),l=["/* constants */","let _EngineFormat = "+JSON.stringify(fn.EngineFormat),"let _EngineType = "+JSON.stringify(fn.EngineType),"let _TranscoderFormat = "+JSON.stringify(fn.TranscoderFormat),"let _BasisFormat = "+JSON.stringify(fn.BasisFormat),"/* basis_transcoder.js */",s,"/* worker */",o.substring(o.indexOf("{")+1,o.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([l])),this.transcoderBinary=a,this.workerPool.setWorkerCreator(()=>{const c=new Worker(this.workerSourceURL),u=this.transcoderBinary.slice(0);return c.postMessage({type:"init",config:this.workerConfig,transcoderBinary:u},[u]),c})}),Ll>0&&console.warn("THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."),Ll++}return this.transcoderPending}load(e,t,i,r){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");const s=new Ns(this.manager);s.setPath(this.path),s.setCrossOrigin(this.crossOrigin),s.setWithCredentials(this.withCredentials),s.setResponseType("arraybuffer"),s.load(e,a=>{this.parse(a,t,r)},i,r)}parse(e,t,i){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");if(Bl.has(e))return Bl.get(e).promise.then(t).catch(i);this._createTexture(e).then(r=>t?t(r):null).catch(i)}_createTextureFrom(e,t){const{type:i,error:r,data:{faces:s,width:a,height:o,format:l,type:c,dfdFlags:u}}=e;if(i==="error")return Promise.reject(r);let h;if(t.faceCount===6)h=new EE(s,l,c);else{const d=s[0].mipmaps;h=t.layerCount>1?new _E(d,a,o,t.layerCount,l,c):new Bo(d,a,o,l,c)}return h.minFilter=s[0].mipmaps.length===1?Ut:vn,h.magFilter=Ut,h.generateMipmaps=!1,h.needsUpdate=!0,h.colorSpace=nA(t),h.premultiplyAlpha=!!(u&ky),h}async _createTexture(e,t={}){const i=zy(new Uint8Array(e)),r=i.vkFormat===yu&&i.dataFormatDescriptor[0].colorModel===167;if(!(i.vkFormat===Vy||r&&!this.workerConfig.astcHDRSupported))return Yy(i);const a=t,o=this.init().then(()=>this.workerPool.postMessage({type:"transcode",buffer:e,taskConfig:a},[e])).then(l=>this._createTextureFrom(l.data,i));return Bl.set(e,{promise:o}),o}dispose(){this.workerPool.dispose(),this.workerSourceURL&&URL.revokeObjectURL(this.workerSourceURL),Ll--}}fn.BasisFormat={ETC1S:0,UASTC:1,UASTC_HDR:2};fn.TranscoderFormat={ETC1:0,ETC2:1,BC1:2,BC3:3,BC4:4,BC5:5,BC7_M6_OPAQUE_ONLY:6,BC7_M5:7,PVRTC1_4_RGB:8,PVRTC1_4_RGBA:9,ASTC_4x4:10,ATC_RGB:11,ATC_RGBA_INTERPOLATED_ALPHA:12,RGBA32:13,RGB565:14,BGR565:15,RGBA4444:16,BC6H:22,RGB_HALF:24,RGBA_HALF:25};fn.EngineFormat={RGBAFormat:Pt,RGBA_ASTC_4x4_Format:Fi,RGB_BPTC_UNSIGNED_Format:ao,RGBA_BPTC_Format:Vr,RGBA_ETC2_EAC_Format:qs,RGBA_PVRTC_4BPPV1_Format:Gr,RGBA_S3TC_DXT5_Format:Ls,RGB_ETC1_Format:so,RGB_ETC2_Format:Ws,RGB_PVRTC_4BPPV1_Format:ro,RGBA_S3TC_DXT1_Format:Ni};fn.EngineType={UnsignedByteType:We,HalfFloatType:hn,FloatType:kt};fn.BasisWorker=function(){let n,e,t;const i=_EngineFormat,r=_EngineType,s=_TranscoderFormat,a=_BasisFormat;self.addEventListener("message",function(m){const g=m.data;switch(g.type){case"init":n=g.config,o(g.transcoderBinary);break;case"transcode":e.then(()=>{try{const{faces:A,buffers:f,width:E,height:v,hasAlpha:_,format:b,type:M,dfdFlags:S}=l(g.buffer);self.postMessage({type:"transcode",id:g.id,data:{faces:A,width:E,height:v,hasAlpha:_,format:b,type:M,dfdFlags:S}},f)}catch(A){console.error(A),self.postMessage({type:"error",id:g.id,error:A.message})}});break}});function o(m){e=new Promise(g=>{t={wasmBinary:m,onRuntimeInitialized:g},BASIS(t)}).then(()=>{t.initializeBasis(),t.KTX2File===void 0&&console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.")})}function l(m){const g=new t.KTX2File(new Uint8Array(m));function A(){g.close(),g.delete()}if(!g.isValid())throw A(),new Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");let f;if(g.isUASTC())f=a.UASTC;else if(g.isETC1S())f=a.ETC1S;else if(g.isHDR())f=a.UASTC_HDR;else throw new Error("THREE.KTX2Loader: Unknown Basis encoding");const E=g.getWidth(),v=g.getHeight(),_=g.getLayers()||1,b=g.getLevels(),M=g.getFaces(),S=g.getHasAlpha(),C=g.getDFDFlags(),{transcoderFormat:I,engineFormat:y,engineType:T}=h(f,E,v,S);if(!E||!v||!b)throw A(),new Error("THREE.KTX2Loader:	Invalid texture");if(!g.startTranscoding())throw A(),new Error("THREE.KTX2Loader: .startTranscoding failed");const N=[],D=[];for(let P=0;P<M;P++){const k=[];for(let F=0;F<b;F++){const G=[];let H,ee;for(let se=0;se<_;se++){const pe=g.getImageLevelInfo(F,se,P);P===0&&F===0&&se===0&&(pe.origWidth%4!==0||pe.origHeight%4!==0)&&console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions."),b>1?(H=pe.origWidth,ee=pe.origHeight):(H=pe.width,ee=pe.height);let Ue=new Uint8Array(g.getImageTranscodedSizeInBytes(F,se,0,I));const qe=g.transcodeImage(Ue,F,se,P,I,0,-1,-1);if(T===r.HalfFloatType&&(Ue=new Uint16Array(Ue.buffer,Ue.byteOffset,Ue.byteLength/Uint16Array.BYTES_PER_ELEMENT)),!qe)throw A(),new Error("THREE.KTX2Loader: .transcodeImage failed.");G.push(Ue)}const Z=p(G);k.push({data:Z,width:H,height:ee}),D.push(Z.buffer)}N.push({mipmaps:k,width:E,height:v,format:y,type:T})}return A(),{faces:N,buffers:D,width:E,height:v,hasAlpha:S,dfdFlags:C,format:y,type:T}}const c=[{if:"astcSupported",basisFormat:[a.UASTC],transcoderFormat:[s.ASTC_4x4,s.ASTC_4x4],engineFormat:[i.RGBA_ASTC_4x4_Format,i.RGBA_ASTC_4x4_Format],engineType:[r.UnsignedByteType],priorityETC1S:1/0,priorityUASTC:1,needsPowerOfTwo:!1},{if:"bptcSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.BC7_M5,s.BC7_M5],engineFormat:[i.RGBA_BPTC_Format,i.RGBA_BPTC_Format],engineType:[r.UnsignedByteType],priorityETC1S:3,priorityUASTC:2,needsPowerOfTwo:!1},{if:"dxtSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.BC1,s.BC3],engineFormat:[i.RGBA_S3TC_DXT1_Format,i.RGBA_S3TC_DXT5_Format],engineType:[r.UnsignedByteType],priorityETC1S:4,priorityUASTC:5,needsPowerOfTwo:!1},{if:"etc2Supported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.ETC1,s.ETC2],engineFormat:[i.RGB_ETC2_Format,i.RGBA_ETC2_EAC_Format],engineType:[r.UnsignedByteType],priorityETC1S:1,priorityUASTC:3,needsPowerOfTwo:!1},{if:"etc1Supported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.ETC1],engineFormat:[i.RGB_ETC1_Format],engineType:[r.UnsignedByteType],priorityETC1S:2,priorityUASTC:4,needsPowerOfTwo:!1},{if:"pvrtcSupported",basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.PVRTC1_4_RGB,s.PVRTC1_4_RGBA],engineFormat:[i.RGB_PVRTC_4BPPV1_Format,i.RGBA_PVRTC_4BPPV1_Format],engineType:[r.UnsignedByteType],priorityETC1S:5,priorityUASTC:6,needsPowerOfTwo:!0},{if:"bptcSupported",basisFormat:[a.UASTC_HDR],transcoderFormat:[s.BC6H],engineFormat:[i.RGB_BPTC_UNSIGNED_Format],engineType:[r.HalfFloatType],priorityHDR:1,needsPowerOfTwo:!1},{basisFormat:[a.ETC1S,a.UASTC],transcoderFormat:[s.RGBA32,s.RGBA32],engineFormat:[i.RGBAFormat,i.RGBAFormat],engineType:[r.UnsignedByteType,r.UnsignedByteType],priorityETC1S:100,priorityUASTC:100,needsPowerOfTwo:!1},{basisFormat:[a.UASTC_HDR],transcoderFormat:[s.RGBA_HALF],engineFormat:[i.RGBAFormat],engineType:[r.HalfFloatType],priorityHDR:100,needsPowerOfTwo:!1}],u={[a.ETC1S]:c.filter(m=>m.basisFormat.includes(a.ETC1S)).sort((m,g)=>m.priorityUASTC-g.priorityUASTC),[a.UASTC]:c.filter(m=>m.basisFormat.includes(a.UASTC)).sort((m,g)=>m.priorityUASTC-g.priorityUASTC),[a.UASTC_HDR]:c.filter(m=>m.basisFormat.includes(a.UASTC_HDR)).sort((m,g)=>m.priorityHDR-g.priorityHDR)};function h(m,g,A,f){const E=u[m];for(let v=0;v<E.length;v++){const _=E[v];if(_.if&&!n[_.if]||!_.basisFormat.includes(m)||f&&_.transcoderFormat.length<2||_.needsPowerOfTwo&&!(d(g)&&d(A)))continue;const b=_.transcoderFormat[f?1:0],M=_.engineFormat[f?1:0],S=_.engineType[0];return{transcoderFormat:b,engineFormat:M,engineType:S}}throw new Error("THREE.KTX2Loader: Failed to identify transcoding target.")}function d(m){return m<=2?!0:(m&m-1)===0&&m!==0}function p(m){if(m.length===1)return m[0];let g=0;for(let E=0;E<m.length;E++){const v=m[E];g+=v.byteLength}const A=new Uint8Array(g);let f=0;for(let E=0;E<m.length;E++){const v=m[E];A.set(v,f),f+=v.byteLength}return A}};const Xy=new Set([Pt,Hs,Li,ai]),Pl={[Rp]:Pt,[Tp]:Li,[wp]:ai,[Cp]:Pt,[Sp]:Li,[Ip]:ai,[Mp]:Pt,[yp]:Pt,[xp]:Li,[bp]:Li,[vp]:ai,[Ep]:ai,[Lp]:Hs,[Bp]:Hs,[qp]:qs,[Wp]:Ws,[yu]:Fi,[Xp]:Fi,[jp]:Fi,[tA]:Nr,[Kp]:Nr,[Yp]:Nr,[Np]:Ni,[Up]:Ni,[Pp]:Pr,[Dp]:Pr,[Op]:Ur,[Fp]:Ur,[Qp]:lo,[kp]:oo,[Gp]:uo,[Hp]:co,[zp]:Vr,[Vp]:Vr,[eA]:Gr,[Zp]:Gr,[$p]:zs,[Jp]:zs},xr={[Rp]:kt,[Tp]:kt,[wp]:kt,[Cp]:hn,[Sp]:hn,[Ip]:hn,[Mp]:We,[yp]:We,[xp]:We,[bp]:We,[vp]:We,[Ep]:We,[Lp]:Io,[Bp]:So,[qp]:We,[Wp]:We,[yu]:hn,[Xp]:We,[jp]:We,[tA]:hn,[Kp]:We,[Yp]:We,[Np]:We,[Up]:We,[Pp]:We,[Dp]:We,[Op]:We,[Fp]:We,[Qp]:We,[kp]:We,[Gp]:We,[Hp]:We,[zp]:We,[Vp]:We,[eA]:We,[Zp]:We,[$p]:We,[Jp]:We};async function Yy(n){const{vkFormat:e}=n;if(Pl[e]===void 0)throw new Error("THREE.KTX2Loader: Unsupported vkFormat: "+e);xr[e]===void 0&&console.warn('THREE.KTX2Loader: Missing ".type" for vkFormat: '+e);let t;n.supercompressionScheme===dd&&(Dl||(Dl=new Promise(async a=>{const o=new Wy;await o.init(),a(o)})),t=await Dl);const i=[];for(let a=0;a<n.levels.length;a++){const o=Math.max(1,n.pixelWidth>>a),l=Math.max(1,n.pixelHeight>>a),c=n.pixelDepth?Math.max(1,n.pixelDepth>>a):0,u=n.levels[a];let h;if(n.supercompressionScheme===Oy)h=u.levelData;else if(n.supercompressionScheme===dd)h=t.decode(u.levelData,u.uncompressedByteLength);else throw new Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");let d;xr[e]===kt?d=new Float32Array(h.buffer,h.byteOffset,h.byteLength/Float32Array.BYTES_PER_ELEMENT):xr[e]===hn?d=new Uint16Array(h.buffer,h.byteOffset,h.byteLength/Uint16Array.BYTES_PER_ELEMENT):xr[e]===Io||xr[e]===So?d=new Uint32Array(h.buffer,h.byteOffset,h.byteLength/Uint32Array.BYTES_PER_ELEMENT):d=h,i.push({data:d,width:o,height:l,depth:c})}const r=n.levelCount===0||i.length>1;let s;if(Xy.has(Pl[e]))s=n.pixelDepth===0?new fu(i[0].data,n.pixelWidth,n.pixelHeight):new qf(i[0].data,n.pixelWidth,n.pixelHeight,n.pixelDepth),s.minFilter=r?tu:Nt,s.magFilter=Nt,s.generateMipmaps=n.levelCount===0;else{if(n.pixelDepth>0)throw new Error("THREE.KTX2Loader: Unsupported pixelDepth.");s=new Bo(i,n.pixelWidth,n.pixelHeight),s.minFilter=r?vn:Ut,s.magFilter=Ut}return s.mipmaps=i,s.type=xr[e],s.format=Pl[e],s.colorSpace=nA(n),s.needsUpdate=!0,Promise.resolve(s)}function nA(n){const e=n.dataFormatDescriptor[0];return e.colorPrimaries===Hy?e.transferFunction===fd?Ct:Qt:e.colorPrimaries===Gy?e.transferFunction===fd?qy:jy:(e.colorPrimaries===Qy||console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${e.colorPrimaries}"`),Rn)}const Ky=""+new URL("basis_transcoder-o4Hde_L7.js",import.meta.url).href,Jy=""+new URL("basis_transcoder-VXdx5NbI.wasm",import.meta.url).href,Rt={step:1/60,walkSpeed:3.2,runSpeed:5.4,acceleration:6.4,steerRate:12,brakeRate:28,restSpeed:.06,inputDeadzone:.01,jumpSpeed:6,gravity:18,maxJumps:2,faceMinSpeed:.1,maxFrame:.1,referenceHeight:1.8},It={distance:5,lookHeight:1.2,pitch:-.28,pitchMin:-.65,pitchMax:.05,fov:58,narrowFov:72,narrowWidth:600,near:.08,lookRate:18,dragYaw:.0032,dragPitch:.0025},md={lookYawRate:2.6,lookPitchRate:1.6},Zy={settleRate:4},Fo=(n,e,t)=>Math.max(e,Math.min(t,n)),gd=(n,e)=>1-Math.exp(-n*Fo(Number.isFinite(e)?e:0,0,.1)),$y=n=>n<It.narrowWidth?It.narrowFov:It.fov;function kc(n={}){const e=n.scale&&n.scale>0?n.scale:1,t=n.yaw||0;return{yaw:t,pitch:It.pitch,targetYaw:t,targetPitch:It.pitch,scale:e,distance:It.distance*e,look:{x:0,y:It.lookHeight*e,z:0},fov:null,fovBlend:0,settling:!1}}const Mu=n=>{n.fov===null||n.settling||(n.settling=!0,n.targetPitch=Fo(n.targetPitch,It.pitchMin,It.pitchMax))};function eM(n,e,t){Mu(n),n.targetYaw-=e*It.dragYaw,n.targetPitch=Fo(n.targetPitch-t*It.dragPitch,It.pitchMin,It.pitchMax)}function tM(n,e,t=0){!e&&!t||(Mu(n),n.targetYaw+=e,n.yaw+=e,n.targetPitch=Fo(n.targetPitch+t,It.pitchMin,It.pitchMax))}function nM(n,e,t=!1){t&&Mu(n);const i=gd(It.lookRate,e);if(n.yaw+=(n.targetYaw-n.yaw)*i,n.pitch+=(n.targetPitch-n.pitch)*i,!n.settling)return;const r=gd(Zy.settleRate,e),s=It.distance*n.scale,a=It.lookHeight*n.scale;n.distance+=(s-n.distance)*r,n.look.x+=-n.look.x*r,n.look.y+=(a-n.look.y)*r,n.look.z+=-n.look.z*r,n.fovBlend+=-n.fovBlend*r,n.fovBlend<.002&&Math.abs(n.distance-s)<.002*n.scale&&Math.hypot(n.look.x,n.look.y-a,n.look.z)<.002*n.scale&&(n.distance=s,n.look={x:0,y:a,z:0},n.settling=!1,n.fov=null,n.fovBlend=0)}function iM(n,e,t=1280){const i={x:e.x+n.look.x,y:0+n.look.y,z:e.z+n.look.z},r=Math.cos(n.pitch)*n.distance,s=$y(t),a=n.fov===null?s:s+(n.fov-s)*n.fovBlend;return{position:{x:i.x+Math.sin(n.yaw)*r,y:i.y-Math.sin(n.pitch)*n.distance,z:i.z+Math.cos(n.yaw)*r},target:i,fov:a,near:It.near*n.scale}}const rM=(n,e,t)=>Math.max(e,Math.min(t,n)),Yt=(n,e=NaN)=>typeof n=="number"&&Number.isFinite(n)?n:e,ms=n=>Array.isArray(n)?{x:Yt(n[0]),y:Yt(n[1]),z:Yt(n[2])}:{x:Yt(n==null?void 0:n.x),y:Yt(n==null?void 0:n.y),z:Yt(n==null?void 0:n.z)};function sM(n){const e=n;if(!e||typeof e!="object")return null;let t;if(e.camera&&e.avatar){const s=ms(e.avatar.position),a=ms(e.camera.position),o=ms(e.camera.target),[l,c,u,h]=[0,1,2,3].map(d=>{var p;return Yt((p=e.avatar.rotation)==null?void 0:p[d],d===3?1:0)});t={cameraOffset:{x:a.x-s.x,y:a.y-s.y,z:a.z-s.z},cameraTargetOffset:{x:o.x-s.x,y:o.y-s.y,z:o.z-s.z},avatarRotation:Math.atan2(2*(h*c+l*u),1-2*(c*c+l*l)),fov:Yt(e.camera.fov)}}else t={cameraOffset:ms(e.cameraOffset),cameraTargetOffset:ms(e.cameraTargetOffset),avatarRotation:Yt(e.avatarRotation),avatarHeight:Yt(e.avatarHeight)>=.2&&e.avatarHeight<=10?e.avatarHeight:void 0,fov:Yt(e.fov)};const i={x:t.cameraOffset.x-t.cameraTargetOffset.x,y:t.cameraOffset.y-t.cameraTargetOffset.y,z:t.cameraOffset.z-t.cameraTargetOffset.z},r=Math.hypot(i.x,i.y,i.z);return!(r>.3&&r<100)||!(t.fov>5&&t.fov<150)||![t.cameraOffset,t.cameraTargetOffset].every(s=>Math.hypot(s.x,s.y,s.z)<=1e3)||!Number.isFinite(t.avatarRotation)?null:t}function aM(n,e){const t=e.avatarHeight,i=t/Rt.referenceHeight,r={x:e.at.x,y:e.at.y||0,z:e.at.z},s=sM(n),a=s?s.cameraOffset.x-s.cameraTargetOffset.x:0,o=s?s.cameraOffset.z-s.cameraTargetOffset.z:0,l=s&&Math.hypot(a,o)>1e-6?Math.atan2(a,o):(s==null?void 0:s.avatarRotation)??0,c=Yt(e.avatarFacing),u=s?Number.isFinite(c)?c-s.avatarRotation:Yt(e.facing,0)-l:0,h=s?l+u:Number.isFinite(c)?c:Yt(e.facing,0),d=kc({yaw:h,scale:i});if(!s){const b=Math.cos(It.pitch)*d.distance;return{position:{x:r.x+Math.sin(h)*b,y:r.y+d.look.y-Math.sin(It.pitch)*d.distance,z:r.z+Math.cos(h)*b},target:{x:r.x,y:r.y+d.look.y,z:r.z},fov:It.fov,avatarRotation:h,scale:i,camera:d}}const p=t/(s.avatarHeight??Rt.referenceHeight),m=s.cameraOffset.y-s.cameraTargetOffset.y,g=Math.sin(u),A=Math.cos(u),f=b=>({x:(b.x*A+b.z*g)*p,y:b.y*p,z:(b.z*A-b.x*g)*p}),E=f(s.cameraOffset),v=f(s.cameraTargetOffset),_=Math.hypot(a,m,o)*p;return d.distance=_,d.look=v,d.pitch=d.targetPitch=-Math.asin(rM(m*p/_,-1,1)),d.fov=s.fov,d.fovBlend=1,{position:{x:r.x+E.x,y:r.y+E.y,z:r.z+E.z},target:{x:r.x+v.x,y:r.y+v.y,z:r.z+v.z},fov:s.fov,avatarRotation:Math.atan2(Math.sin(s.avatarRotation+u),Math.cos(s.avatarRotation+u)),scale:i,camera:d}}const oM=.7;function lM(n,e,t){const i=t.x-n.x,r=t.z-n.z,s=Math.hypot(i,r);return s<1e-6?!0:(Math.sin(e)*i+Math.cos(e)*r)/s>=.5}function cM(){let n="none",e=0,t=!1,i=!1,r=null;return{get phase(){return n},get crouch(){return e*e*(3-2*e)},get handsEmpty(){return i},get view(){return r},stage(s,a={}){r=s,i=!0,e=s?1:0,t=!s||!!a.entered,n=e>0?t?"rising":"crouched":"standing"},enter(){n!=="none"&&(t=!0,e>0&&(n="rising"))},fillHands(){i=!1},update(s){!t||e<=0||!(s>0)||(e=Math.max(0,e-s/oM),e===0&&(n="standing"))}}}function _d(n,e,t){const i=Math.max(0,Math.min(1,n)),r=e+t,s=r*.42*i,a=Math.max(Math.abs(e-t)+1e-6,r-s),o=(u,h,d)=>Math.acos(Math.max(-1,Math.min(1,(u*u+h*h-d*d)/(2*u*h)))),l=e>0&&i>0?o(e,a,t):0,c=t>0&&i>0?o(t,a,e):0;return{drop:s,upperLeg:-l,lowerLeg:l+c,foot:-c,spine:.3*i,head:-.22*i,armDown:-1.2*i,armForward:.35*i,elbow:.5*i}}const Eo=["CHAABI","CHAABI2","CRIP","DEATH","FLOORSITTING","FLY","HIPHOP","MOONWALK","PRAYING","SEXY","SHUFFLING","SITTALKING","SITTING","TECHNO","WANNAROCK"],Xa=8;function uM(n){const e=Eo.indexOf(n.emote);if(e>=0)return Xa+e;if(n.air)return 3;if(n.wave)return 4;const t=n.speed??0;return t<.3?0:t<2.8?1:2}function hM(n,e=0){const t=typeof n=="number"&&Number.isInteger(n)?n:0;return t>=Xa&&t<Xa+Eo.length?{emote:Eo[t-Xa],speed:0}:t===3?{air:!0,speed:e}:t===4?{wave:!0,speed:0}:t===1?{speed:Math.min(2.7,Math.max(1.5,e))}:t===2?{speed:Math.max(3.4,e)}:{speed:0}}function Ed(n,e=!0){if(n.emote&&e)return{[n.emote]:1};if(n.air)return{JUMP:1};if(n.wave)return{WAVING:1};const t=n.speed??0;if(t<.3)return{IDLE:1};if(t<2.8){const r=Math.min(1,(t-.3)/1.2);return{WALK:r,IDLE:1-r}}const i=Math.min(1,(t-2.8)/1.5);return{RUN:i,WALK:1-i}}function dM(n,e){return n==="WALK"?Math.max(.6,e/1.5):n==="RUN"?Math.max(.7,e/5):1}const gs=n=>typeof n=="number"&&Number.isFinite(n)?n:0;function fM(n){if(!n||typeof n.id!="string"||!n.id)return null;const e=typeof n.name=="string"&&n.name.trim()?n.name.trim().slice(0,24):"Visitor",t=typeof n.vrm=="string"&&n.vrm.length<=2048?n.vrm:typeof n.avatarUrl=="string"&&n.avatarUrl.length<=2048?n.avatarUrl:"";return{id:n.id.slice(0,64),name:e,vrm:t,talking:n.talking===!0,fresh:n.fresh===!0,pose:{x:gs(n.x),y:gs(n.y),z:gs(n.z),h:gs(n.h),a:Math.max(0,Math.min(31,Math.round(gs(n.a))))}}}function pM(n,e,t,i=!1,r=20){const s=n[n.length-1];s&&!i&&s.x===e.x&&s.y===e.y&&s.z===e.z&&s.h===e.h&&s.a===e.a||(n.push({t,...e}),n.length>r&&n.shift())}const AM=(n,e,t)=>n+Math.atan2(Math.sin(e-n),Math.cos(e-n))*t;function mM(n,e){if(!n.length)return null;let t=n.length-1;for(;t>0&&n[t].t>e;)t--;const i=n[t],r=n[t+1];if(!r||e<=i.t)return{x:i.x,y:i.y,z:i.z,h:i.h,a:i.a,speed:0};const s=Math.max(.001,r.t-i.t),a=Math.min(1,(e-i.t)/s);return{x:i.x+(r.x-i.x)*a,y:i.y+(r.y-i.y)*a,z:i.z+(r.z-i.z)*a,h:AM(i.h,r.h,a),a:a<.5?i.a:r.a,speed:Math.hypot(r.x-i.x,r.z-i.z)/s}}const gM=.26;function _M(){let n=!1;const e=()=>{n=!0};return{watch(t){t.traverse(i=>{i.isMesh&&(i.onBeforeRender=e)})},take(){const t=n;return n=!1,t}}}const iA={mixamorigHips:"hips",mixamorigSpine:"spine",mixamorigSpine1:"chest",mixamorigSpine2:"upperChest",mixamorigNeck:"neck",mixamorigHead:"head",mixamorigLeftShoulder:"leftShoulder",mixamorigLeftArm:"leftUpperArm",mixamorigLeftForeArm:"leftLowerArm",mixamorigLeftHand:"leftHand",mixamorigRightShoulder:"rightShoulder",mixamorigRightArm:"rightUpperArm",mixamorigRightForeArm:"rightLowerArm",mixamorigRightHand:"rightHand",mixamorigLeftUpLeg:"leftUpperLeg",mixamorigLeftLeg:"leftLowerLeg",mixamorigLeftFoot:"leftFoot",mixamorigLeftToeBase:"leftToes",mixamorigRightUpLeg:"rightUpperLeg",mixamorigRightLeg:"rightLowerLeg",mixamorigRightFoot:"rightFoot",mixamorigRightToeBase:"rightToes"},EM=Object.values(iA);function vM(n){const e=n==null?void 0:n.tracks.find(t=>t.name==="mixamorigHips.position");return e&&Math.abs(e.values[1])||1}function bM(n,e,t,i){var a;const r=[],s=((a=e.meta)==null?void 0:a.metaVersion)==="0";for(const o of n.tracks){const[l,c]=o.name.split("."),u=e.humanoid.getNormalizedBoneNode(iA[l]);if(!u)continue;const h=Float32Array.from(o.values);if(c==="quaternion"){if(s)for(let d=0;d<h.length;d+=4)h[d]*=-1,h[d+2]*=-1;r.push(new Wi(`${u.uuid}.quaternion`,o.times,h))}else if(c==="position"&&l==="mixamorigHips"){for(let d=0;d<h.length;d+=3)h[d]=t.x,h[d+1]*=t.height/i,h[d+2]=t.z;r.push(new qi(`${u.uuid}.position`,o.times,h))}}return new _o(n.name,n.duration,r)}function xM(n,e){const t=new gt;t.name="stand-in";const i=n/1.75,r=(s,a,o,l=0)=>{const c=new Ke(s,new Us({color:a}));c.position.set(l*i,o*i,0),c.castShadow=!0,t.add(c)};r(new go(.24*i,.5*i,6,12),e,1.05),r(new Js(.2*i,16,12),15848118,1.58);for(const s of[-1,1])r(new go(.085*i,.5*i,4,8),2764613,.34,s*.12);return t}const yM=(n,e,t,i)=>n+(e-n)*Math.min(1,t*i),Ua=new He,MM=new jt,Na=new yn,IM=new R,SM=new R;function vd(n={}){const e=n.height??1.75,t=new gt;t.name="avatar";const i=_M(),r=A=>i.watch(A);let s=n.standIn===!1?null:xM(e,n.color??3111935);s&&(t.add(s),r(s));let a=null;const o=[];let l="",c=!1,u=0,h="";const d=(A,f)=>{f.IDLE&&A.clips.size===0&&(A.sourceHeight=vM(f.IDLE));for(const[E,v]of Object.entries(f)){if(!(v!=null&&v.tracks)||A.clips.has(E))continue;const _=A.mixer.clipAction(bM(v,A.vrm,A.ref,A.sourceHeight));_.play();const b=E==="IDLE"&&A.clips.size===0?1:0;_.setEffectiveWeight(b),A.clips.set(E,{action:_,weight:b})}},p=(A,f)=>{const E=_d(f,A.upperLeg,A.lowerLeg),v=A.vrm0?-1:1,_=(S,C,I,y,T)=>{S&&(Ua.setFromEuler(MM.set(C,I,y,"YZX")),Ua.x*=v,Ua.z*=v,S.quaternion.slerp(Ua,T))},b=Math.min(1,f*4);for(const S of["left","right"])_(A.bones[`${S}UpperLeg`],E.upperLeg,0,0,b),_(A.bones[`${S}LowerLeg`],E.lowerLeg,0,0,b),_(A.bones[`${S}Foot`],E.foot,0,0,b);const M=_d(1,A.upperLeg,A.lowerLeg);_(A.bones.spine,M.spine,0,0,f),_(A.bones.head,M.head,0,0,f),_(A.bones.leftUpperArm,0,-M.armForward,M.armDown,f),_(A.bones.rightUpperArm,0,M.armForward,-M.armDown,f),_(A.bones.leftLowerArm,0,-M.elbow,0,f),_(A.bones.rightLowerArm,0,M.elbow,0,f),A.bones.hips&&(A.bones.hips.position.x+=(A.hipsRest.x-A.bones.hips.position.x)*b,A.bones.hips.position.z+=(A.hipsRest.z-A.bones.hips.position.z)*b,A.bones.hips.position.y-=E.drop)},m=()=>{a&&(a.mixer.stopAllAction(),t.remove(a.holder),a.holder.remove(a.vrm.scene),a.vrm.proxyRoot&&t.remove(a.vrm.proxyRoot),a.vrm.dispose?a.vrm.dispose():Ul(a.vrm.scene),a=null,l="",c=!1,h="")},g={root:t,height:e,motion:{},manual:!1,get kind(){return a?"vrm":s?"stand-in":"none"},get vrm(){return(a==null?void 0:a.vrm)??null},get holder(){return(a==null?void 0:a.holder)??null},get playing(){return h},attach(A){var T,N,D;m();const f=new gt;f.name="vrm",f.add(A.scene),t.add(f),A.proxyRoot&&t.add(A.proxyRoot),t.updateMatrixWorld(!0),Na.setFromObject(A.scene);const E=Na.max.y-Na.min.y,v=Math.max(.3,Math.min(3,e/(E||e)));f.scale.setScalar(v),f.position.y=-Na.min.y*v,t.updateMatrixWorld(!0);const _={};for(const P of EM)_[P]=A.humanoid.getNormalizedBoneNode(P);const b=_.hips,M=((N=(T=A.humanoid).getRawBoneNode)==null?void 0:N.call(T,"hips"))??b,S=A.scene.worldToLocal(M.getWorldPosition(IM)),C=A.scene.getWorldScale(SM).y||1,I=P=>{var k,F,G;return(G=((F=(k=A.humanoid).getRawBoneNode)==null?void 0:F.call(k,P))??_[P])==null?void 0:G.getWorldPosition(new R)},y=(P,k)=>{const F=I(P),G=I(k);return F&&G?F.distanceTo(G)/C:0};a={vrm:A,holder:f,scale:v,bones:_,vrm0:((D=A.meta)==null?void 0:D.metaVersion)==="0",hipsRest:b.position.clone(),ref:{x:b.position.x,z:b.position.z,height:Math.abs(S.y)||b.position.y||1},upperLeg:y("leftUpperLeg","leftLowerLeg"),lowerLeg:y("leftLowerLeg","leftFoot"),mixer:new ZE(A.proxyRoot??A.scene),clips:new Map,sourceHeight:1};for(const P of o)d(a,P);s&&(t.remove(s),Ul(s),s=null),r(A.scene)},addClips(A){!A||typeof A!="object"||(o.includes(A)||o.push(A),a&&d(a,A))},hasClip(A){return a?a.clips.has(A):o.some(f=>A in f)},drive(A,f=0){var I;const E=g.motion;if(!a){if(!s)return;u+=A*(4+(E.speed??0)*2),s.position.y=((E.speed??0)>.3?Math.abs(Math.sin(u))*.05:0)-f*.42*e*.5,s.scale.y=1-f*.25,h=Object.entries(Ed(E)).sort((y,T)=>T[1]-y[1])[0][0];return}if(g.manual)return;const v=a,_=Ed(E,!!(E.emote&&v.clips.has(E.emote))),b=E.speed??0;let M=0;for(const[y,T]of v.clips)T.weight=yM(T.weight,_[y]??0,y==="JUMP"?14:9,A),T.action.setEffectiveWeight(T.weight),T.action.timeScale=dM(y,b),T.weight>M&&(M=T.weight,h=y);const S=E.emote&&v.clips.has(E.emote)?E.emote:"";S&&S!==l&&(v.clips.get(S).action.time=0),l=S;const C=!!E.air;if(C&&!c&&v.clips.has("JUMP")&&(v.clips.get("JUMP").action.time=.35),c=C,v.clips.size)v.mixer.update(A);else for(const y of Object.values(v.bones))y==null||y.quaternion.identity();v.clips.size||(I=v.bones.hips)==null||I.position.copy(v.hipsRest),f>0&&p(v,f),v.vrm.update(A)},rest(){var A;if(a){for(const f of Object.values(a.bones))f==null||f.quaternion.identity();(A=a.bones.hips)==null||A.position.copy(a.hipsRest)}},takeDrawn(){return i.take()},dispose(){var A;(A=t.parent)==null||A.remove(t),s&&Ul(s),m()}};return g}function Ul(n){n.traverse(e=>{var t,i;if(e.isMesh){(t=e.geometry)==null||t.dispose();for(const r of[].concat(e.material))(i=r==null?void 0:r.map)==null||i.dispose(),r==null||r.dispose()}})}const CM=(n,e)=>Object.assign(document.createElement("canvas"),{width:n,height:e}),_s=.2,bd='600 52px system-ui, -apple-system, "Segoe UI", sans-serif';function wM(n,e){var a;const t=e(8,8).getContext("2d");t.font=bd;const i=Math.ceil(Math.min(640,Math.max(96,t.measureText(n).width+56))),r=e(i,96),s=r.getContext("2d");return s.fillStyle="rgba(12, 14, 24, 0.72)",s.beginPath(),(a=s.roundRect)==null||a.call(s,0,8,i,80,40),s.roundRect||s.rect(0,8,i,80),s.fill(),s.font=bd,s.textAlign="center",s.textBaseline="middle",s.fillStyle="#ffffff",s.fillText(n,i/2,50,i-40),{canvas:r,aspect:i/96}}function TM(n){const e=n(96,96),t=e.getContext("2d");return t.fillStyle="#2fd67b",t.beginPath(),t.arc(48,48,40,0,Math.PI*2),t.fill(),t.fillStyle="#06220f",[[30,22],[44,40],[58,28]].forEach(([i,r])=>t.fillRect(i,48-r/2,9,r)),e}function RM(n,e={}){const t=e.canvas??CM,i=new gt;i.name="name-tag";const r=h=>{const d=new sp(h);return d.colorSpace=Ct,new du({map:d,transparent:!0,depthTest:!1,depthWrite:!1})},s=new Pc;s.renderOrder=10;const a=new Pc(r(TM(t)));a.renderOrder=11,a.visible=!1,i.add(s,a);let o="",l=!1,c=0;a.position.y=_s*1.15;const u={object:i,get name(){return o},get talking(){return l},setName(h){var g;const d=String(h||"Visitor").slice(0,24);if(d===o)return;o=d;const{canvas:p,aspect:m}=wM(d,t);(g=s.material.map)==null||g.dispose(),s.material.dispose(),s.material=r(p),s.scale.set(_s*m,_s,1)},setTalking(h){l=!!h,a.visible=l,l||(c=0)},update(h){l&&(c+=h*9,a.scale.setScalar(_s*(.95+.14*Math.sin(c))))},dispose(){var h,d;for(const p of[s,a])(h=p.material.map)==null||h.dispose(),p.material.dispose();(d=i.parent)==null||d.remove(i)}};return a.scale.setScalar(_s),u.setName(n),u}function xd(n,e){if(e===d_)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===Lc||e===Gf){let t=n.getIndex();if(t===null){const a=[],o=n.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)a.push(l);n.setIndex(a),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}const i=t.count-2,r=[];if(e===Lc)for(let a=1;a<=i;a++)r.push(t.getX(0)),r.push(t.getX(a)),r.push(t.getX(a+1));else for(let a=0;a<i;a++)a%2===0?(r.push(t.getX(a)),r.push(t.getX(a+1)),r.push(t.getX(a+2))):(r.push(t.getX(a+2)),r.push(t.getX(a+1)),r.push(t.getX(a)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=n.clone();return s.setIndex(r),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}class BM extends Yi{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new NM(t)}),this.register(function(t){return new FM(t)}),this.register(function(t){return new qM(t)}),this.register(function(t){return new jM(t)}),this.register(function(t){return new XM(t)}),this.register(function(t){return new kM(t)}),this.register(function(t){return new QM(t)}),this.register(function(t){return new HM(t)}),this.register(function(t){return new GM(t)}),this.register(function(t){return new UM(t)}),this.register(function(t){return new VM(t)}),this.register(function(t){return new OM(t)}),this.register(function(t){return new WM(t)}),this.register(function(t){return new zM(t)}),this.register(function(t){return new DM(t)}),this.register(function(t){return new YM(t)}),this.register(function(t){return new KM(t)})}load(e,t,i,r){const s=this;let a;if(this.resourcePath!=="")a=this.resourcePath;else if(this.path!==""){const c=Fs.extractUrlBase(e);a=Fs.resolveURL(c,this.path)}else a=Fs.extractUrlBase(e);this.manager.itemStart(e);const o=function(c){r?r(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new Ns(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,a,function(u){t(u),s.manager.itemEnd(e)},o)}catch(u){o(u)}},i,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,r){let s;const a={},o={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===rA){try{a[Xe.KHR_BINARY_GLTF]=new JM(e)}catch(h){r&&r(h);return}s=JSON.parse(a[Xe.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new uI(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[h.name]=h,a[h.name]=!0}if(s.extensionsUsed)for(let u=0;u<s.extensionsUsed.length;++u){const h=s.extensionsUsed[u],d=s.extensionsRequired||[];switch(h){case Xe.KHR_MATERIALS_UNLIT:a[h]=new PM;break;case Xe.KHR_DRACO_MESH_COMPRESSION:a[h]=new ZM(s,this.dracoLoader);break;case Xe.KHR_TEXTURE_TRANSFORM:a[h]=new $M;break;case Xe.KHR_MESH_QUANTIZATION:a[h]=new eI;break;default:d.indexOf(h)>=0&&o[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(a),c.setPlugins(o),c.parse(i,r)}parseAsync(e,t){const i=this;return new Promise(function(r,s){i.parse(e,t,r,s)})}}function LM(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}const Xe={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class DM{constructor(e){this.parser=e,this.name=Xe.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){const s=t[i];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){const t=this.parser,i="light:"+e;let r=t.cache.get(i);if(r)return r;const s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e];let c;const u=new be(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],Qt);const h=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new fp(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new NE(u),c.distance=h;break;case"spot":c=new PE(u),c.distance=h,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),wn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),r=Promise.resolve(c),t.cache.add(i,r),r}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,i=this.parser,s=i.json.nodes[e],o=(s.extensions&&s.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return i._getNodeRef(t.cache,o,l)})}}class PM{constructor(){this.name=Xe.KHR_MATERIALS_UNLIT}getMaterialType(){return Kt}extendParams(e,t,i){const r=[];e.color=new be(1,1,1),e.opacity=1;const s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){const a=s.baseColorFactor;e.color.setRGB(a[0],a[1],a[2],Qt),e.opacity=a[3]}s.baseColorTexture!==void 0&&r.push(i.assignTexture(e,"map",s.baseColorTexture,Ct))}return Promise.all(r)}}class UM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name].emissiveStrength;return s!==void 0&&(t.emissiveIntensity=s),Promise.resolve()}}class NM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];if(a.clearcoatFactor!==void 0&&(t.clearcoat=a.clearcoatFactor),a.clearcoatTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatMap",a.clearcoatTexture)),a.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=a.clearcoatRoughnessFactor),a.clearcoatRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"clearcoatRoughnessMap",a.clearcoatRoughnessTexture)),a.clearcoatNormalTexture!==void 0&&(s.push(i.assignTexture(t,"clearcoatNormalMap",a.clearcoatNormalTexture)),a.clearcoatNormalTexture.scale!==void 0)){const o=a.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new we(o,o)}return Promise.all(s)}}class FM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_DISPERSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.dispersion=s.dispersion!==void 0?s.dispersion:0,Promise.resolve()}}class OM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.iridescenceFactor!==void 0&&(t.iridescence=a.iridescenceFactor),a.iridescenceTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceMap",a.iridescenceTexture)),a.iridescenceIor!==void 0&&(t.iridescenceIOR=a.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),a.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=a.iridescenceThicknessMinimum),a.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=a.iridescenceThicknessMaximum),a.iridescenceThicknessTexture!==void 0&&s.push(i.assignTexture(t,"iridescenceThicknessMap",a.iridescenceThicknessTexture)),Promise.all(s)}}class kM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_SHEEN}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[];t.sheenColor=new be(0,0,0),t.sheenRoughness=0,t.sheen=1;const a=r.extensions[this.name];if(a.sheenColorFactor!==void 0){const o=a.sheenColorFactor;t.sheenColor.setRGB(o[0],o[1],o[2],Qt)}return a.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=a.sheenRoughnessFactor),a.sheenColorTexture!==void 0&&s.push(i.assignTexture(t,"sheenColorMap",a.sheenColorTexture,Ct)),a.sheenRoughnessTexture!==void 0&&s.push(i.assignTexture(t,"sheenRoughnessMap",a.sheenRoughnessTexture)),Promise.all(s)}}class QM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.transmissionFactor!==void 0&&(t.transmission=a.transmissionFactor),a.transmissionTexture!==void 0&&s.push(i.assignTexture(t,"transmissionMap",a.transmissionTexture)),Promise.all(s)}}class HM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_VOLUME}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];t.thickness=a.thicknessFactor!==void 0?a.thicknessFactor:0,a.thicknessTexture!==void 0&&s.push(i.assignTexture(t,"thicknessMap",a.thicknessTexture)),t.attenuationDistance=a.attenuationDistance||1/0;const o=a.attenuationColor||[1,1,1];return t.attenuationColor=new be().setRGB(o[0],o[1],o[2],Qt),Promise.all(s)}}class GM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_IOR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const r=this.parser.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=r.extensions[this.name];return t.ior=s.ior!==void 0?s.ior:1.5,Promise.resolve()}}class VM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_SPECULAR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];t.specularIntensity=a.specularFactor!==void 0?a.specularFactor:1,a.specularTexture!==void 0&&s.push(i.assignTexture(t,"specularIntensityMap",a.specularTexture));const o=a.specularColorFactor||[1,1,1];return t.specularColor=new be().setRGB(o[0],o[1],o[2],Qt),a.specularColorTexture!==void 0&&s.push(i.assignTexture(t,"specularColorMap",a.specularColorTexture,Ct)),Promise.all(s)}}class zM{constructor(e){this.parser=e,this.name=Xe.EXT_MATERIALS_BUMP}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return t.bumpScale=a.bumpFactor!==void 0?a.bumpFactor:1,a.bumpTexture!==void 0&&s.push(i.assignTexture(t,"bumpMap",a.bumpTexture)),Promise.all(s)}}class WM{constructor(e){this.parser=e,this.name=Xe.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:Pn}extendMaterialParams(e,t){const i=this.parser,r=i.json.materials[e];if(!r.extensions||!r.extensions[this.name])return Promise.resolve();const s=[],a=r.extensions[this.name];return a.anisotropyStrength!==void 0&&(t.anisotropy=a.anisotropyStrength),a.anisotropyRotation!==void 0&&(t.anisotropyRotation=a.anisotropyRotation),a.anisotropyTexture!==void 0&&s.push(i.assignTexture(t,"anisotropyMap",a.anisotropyTexture)),Promise.all(s)}}class qM{constructor(e){this.parser=e,this.name=Xe.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,i=t.json,r=i.textures[e];if(!r.extensions||!r.extensions[this.name])return null;const s=r.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,a)}}class jM{constructor(e){this.parser=e,this.name=Xe.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=r.images[a.source];let l=i.textureLoader;if(o.uri){const c=i.options.manager.getHandler(o.uri);c!==null&&(l=c)}return i.loadTextureImage(e,a.source,l)}}class XM{constructor(e){this.parser=e,this.name=Xe.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,i=this.parser,r=i.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;const a=s.extensions[t],o=r.images[a.source];let l=i.textureLoader;if(o.uri){const c=i.options.manager.getHandler(o.uri);c!==null&&(l=c)}return i.loadTextureImage(e,a.source,l)}}class YM{constructor(e){this.name=Xe.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){const t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){const r=i.extensions[this.name],s=this.parser.getDependency("buffer",r.buffer),a=this.parser.options.meshoptDecoder;if(!a||!a.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(o){const l=r.byteOffset||0,c=r.byteLength||0,u=r.count,h=r.byteStride,d=new Uint8Array(o,l,c);return a.decodeGltfBufferAsync?a.decodeGltfBufferAsync(u,h,d,r.mode,r.filter).then(function(p){return p.buffer}):a.ready.then(function(){const p=new ArrayBuffer(u*h);return a.decodeGltfBuffer(new Uint8Array(p),u,h,d,r.mode,r.filter),p})})}else return null}}class KM{constructor(e){this.name=Xe.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const r=t.meshes[i.mesh];for(const c of r.primitives)if(c.mode!==cn.TRIANGLES&&c.mode!==cn.TRIANGLE_STRIP&&c.mode!==cn.TRIANGLE_FAN&&c.mode!==void 0)return null;const a=i.extensions[this.name].attributes,o=[],l={};for(const c in a)o.push(this.parser.getDependency("accessor",a[c]).then(u=>(l[c]=u,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{const u=c.pop(),h=u.isGroup?u.children:[u],d=c[0].count,p=[];for(const m of h){const g=new De,A=new R,f=new He,E=new R(1,1,1),v=new fE(m.geometry,m.material,d);for(let _=0;_<d;_++)l.TRANSLATION&&A.fromBufferAttribute(l.TRANSLATION,_),l.ROTATION&&f.fromBufferAttribute(l.ROTATION,_),l.SCALE&&E.fromBufferAttribute(l.SCALE,_),v.setMatrixAt(_,g.compose(A,f,E));for(const _ in l)if(_==="_COLOR_0"){const b=l[_];v.instanceColor=new Uc(b.array,b.itemSize,b.normalized)}else _!=="TRANSLATION"&&_!=="ROTATION"&&_!=="SCALE"&&m.geometry.setAttribute(_,l[_]);ct.prototype.copy.call(v,m),this.parser.assignFinalMaterial(v),p.push(v)}return u.isGroup?(u.clear(),u.add(...p),u):p[0]}))}}const rA="glTF",Es=12,yd={JSON:1313821514,BIN:5130562};class JM{constructor(e){this.name=Xe.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,Es),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==rA)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const r=this.header.length-Es,s=new DataView(e,Es);let a=0;for(;a<r;){const o=s.getUint32(a,!0);a+=4;const l=s.getUint32(a,!0);if(a+=4,l===yd.JSON){const c=new Uint8Array(e,Es+a,o);this.content=i.decode(c)}else if(l===yd.BIN){const c=Es+a;this.body=e.slice(c,c+o)}a+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class ZM{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=Xe.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const i=this.json,r=this.dracoLoader,s=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},c={};for(const u in a){const h=Qc[u]||u.toLowerCase();o[h]=a[u]}for(const u in e.attributes){const h=Qc[u]||u.toLowerCase();if(a[u]!==void 0){const d=i.accessors[e.attributes[u]],p=Or[d.componentType];c[h]=p.name,l[h]=d.normalized===!0}}return t.getDependency("bufferView",s).then(function(u){return new Promise(function(h,d){r.decodeDracoFile(u,function(p){for(const m in p.attributes){const g=p.attributes[m],A=l[m];A!==void 0&&(g.normalized=A)}h(p)},o,c,Qt,d)})})}}class $M{constructor(){this.name=Xe.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class eI{constructor(){this.name=Xe.KHR_MESH_QUANTIZATION}}class sA extends $s{constructor(e,t,i,r){super(e,t,i,r)}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r*3+r;for(let a=0;a!==r;a++)t[a]=i[s+a];return t}interpolate_(e,t,i,r){const s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,u=r-t,h=(i-t)/u,d=h*h,p=d*h,m=e*c,g=m-c,A=-2*p+3*d,f=p-d,E=1-A,v=f-d+h;for(let _=0;_!==o;_++){const b=a[g+_+o],M=a[g+_+l]*u,S=a[m+_+o],C=a[m+_]*u;s[_]=E*b+v*M+A*S+f*C}return s}}const tI=new He;class nI extends sA{interpolate_(e,t,i,r){const s=super.interpolate_(e,t,i,r);return tI.fromArray(s).normalize().toArray(s),s}}const cn={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Or={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Md={9728:Nt,9729:Ut,9984:tu,9985:qa,9986:ws,9987:vn},Id={33071:Wn,33648:io,10497:Hi},Nl={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Qc={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},ii={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},iI={CUBICSPLINE:void 0,LINEAR:Xs,STEP:js},Fl={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function rI(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new _u({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Yn})),n.DefaultMaterial}function bi(n,e,t){for(const i in t.extensions)n[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function wn(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function sI(n,e,t){let i=!1,r=!1,s=!1;for(let c=0,u=e.length;c<u;c++){const h=e[c];if(h.POSITION!==void 0&&(i=!0),h.NORMAL!==void 0&&(r=!0),h.COLOR_0!==void 0&&(s=!0),i&&r&&s)break}if(!i&&!r&&!s)return Promise.resolve(n);const a=[],o=[],l=[];for(let c=0,u=e.length;c<u;c++){const h=e[c];if(i){const d=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):n.attributes.position;a.push(d)}if(r){const d=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):n.attributes.normal;o.push(d)}if(s){const d=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):n.attributes.color;l.push(d)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){const u=c[0],h=c[1],d=c[2];return i&&(n.morphAttributes.position=u),r&&(n.morphAttributes.normal=h),s&&(n.morphAttributes.color=d),n.morphTargetsRelative=!0,n})}function aI(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)n.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function oI(n){let e;const t=n.extensions&&n.extensions[Xe.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Ol(t.attributes):e=n.indices+":"+Ol(n.attributes)+":"+n.mode,n.targets!==void 0)for(let i=0,r=n.targets.length;i<r;i++)e+=":"+Ol(n.targets[i]);return e}function Ol(n){let e="";const t=Object.keys(n).sort();for(let i=0,r=t.length;i<r;i++)e+=t[i]+":"+n[t[i]]+";";return e}function Hc(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function lI(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":n.search(/\.ktx2($|\?)/i)>0||n.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const cI=new De;class uI{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new LM,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=-1,s=!1,a=-1;if(typeof navigator<"u"){const o=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(o)===!0;const l=o.match(/Version\/(\d+)/);r=i&&l?parseInt(l[1],10):-1,s=o.indexOf("Firefox")>-1,a=s?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&r<17||s&&a<98?this.textureLoader=new BE(this.options.manager):this.textureLoader=new OE(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Ns(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const i=this,r=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(a){return a._markDefs&&a._markDefs()}),Promise.all(this._invokeAll(function(a){return a.beforeRoot&&a.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(a){const o={scene:a[0][r.scene||0],scenes:a[0],animations:a[1],cameras:a[2],asset:r.asset,parser:i,userData:{}};return bi(s,o,r),wn(o,r),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(const l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,s=t.length;r<s;r++){const a=t[r].joints;for(let o=0,l=a.length;o<l;o++)e[a[o]].isBone=!0}for(let r=0,s=e.length;r<s;r++){const a=e[r];a.mesh!==void 0&&(this._addNodeRef(this.meshCache,a.mesh),a.skin!==void 0&&(i[a.mesh].isSkinnedMesh=!0)),a.camera!==void 0&&this._addNodeRef(this.cameraCache,a.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;const r=i.clone(),s=(a,o)=>{const l=this.associations.get(a);l!=null&&this.associations.set(o,l);for(const[c,u]of a.children.entries())s(u,o.children[c])};return s(i,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const r=e(t[i]);if(r)return r}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let r=0;r<t.length;r++){const s=e(t[r]);s&&i.push(s)}return i}getDependency(e,t){const i=e+":"+t;let r=this.cache.get(i);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":r=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!r)throw new Error("Unknown type: "+e);break}this.cache.add(i,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){const i=this,r=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(s,a){return i.getDependency(e,a)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[Xe.KHR_BINARY_GLTF].body);const r=this.options;return new Promise(function(s,a){i.load(Fs.resolveURL(t.uri,r.path),s,void 0,function(){a(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){const r=t.byteLength||0,s=t.byteOffset||0;return i.slice(s,s+r)})}loadAccessor(e){const t=this,i=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){const a=Nl[r.type],o=Or[r.componentType],l=r.normalized===!0,c=new o(r.count*a);return Promise.resolve(new tt(c,a,l))}const s=[];return r.bufferView!==void 0?s.push(this.getDependency("bufferView",r.bufferView)):s.push(null),r.sparse!==void 0&&(s.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(s).then(function(a){const o=a[0],l=Nl[r.type],c=Or[r.componentType],u=c.BYTES_PER_ELEMENT,h=u*l,d=r.byteOffset||0,p=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,m=r.normalized===!0;let g,A;if(p&&p!==h){const f=Math.floor(d/p),E="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+f+":"+r.count;let v=t.cache.get(E);v||(g=new c(o,f*p,r.count*p/u),v=new To(g,p/u),t.cache.add(E,v)),A=new zi(v,l,d%p/u,m)}else o===null?g=new c(r.count*l):g=new c(o,d,r.count*l),A=new tt(g,l,m);if(r.sparse!==void 0){const f=Nl.SCALAR,E=Or[r.sparse.indices.componentType],v=r.sparse.indices.byteOffset||0,_=r.sparse.values.byteOffset||0,b=new E(a[1],v,r.sparse.count*f),M=new c(a[2],_,r.sparse.count*l);o!==null&&(A=new tt(A.array.slice(),A.itemSize,A.normalized)),A.normalized=!1;for(let S=0,C=b.length;S<C;S++){const I=b[S];if(A.setX(I,M[S*l]),l>=2&&A.setY(I,M[S*l+1]),l>=3&&A.setZ(I,M[S*l+2]),l>=4&&A.setW(I,M[S*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}A.normalized=m}return A})}loadTexture(e){const t=this.json,i=this.options,s=t.textures[e].source,a=t.images[s];let o=this.textureLoader;if(a.uri){const l=i.manager.getHandler(a.uri);l!==null&&(o=l)}return this.loadTextureImage(e,s,o)}loadTextureImage(e,t,i){const r=this,s=this.json,a=s.textures[e],o=s.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,i).then(function(u){u.flipY=!1,u.name=a.name||o.name||"",u.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(u.name=o.uri);const d=(s.samplers||{})[a.sampler]||{};return u.magFilter=Md[d.magFilter]||Ut,u.minFilter=Md[d.minFilter]||vn,u.wrapS=Id[d.wrapS]||Hi,u.wrapT=Id[d.wrapT]||Hi,u.generateMipmaps=!u.isCompressedTexture&&u.minFilter!==Nt&&u.minFilter!==Ut,r.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const i=this,r=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const a=r.images[e],o=self.URL||self.webkitURL;let l=a.uri||"",c=!1;if(a.bufferView!==void 0)l=i.getDependency("bufferView",a.bufferView).then(function(h){c=!0;const d=new Blob([h],{type:a.mimeType});return l=o.createObjectURL(d),l});else if(a.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(l).then(function(h){return new Promise(function(d,p){let m=d;t.isImageBitmapLoader===!0&&(m=function(g){const A=new Tt(g);A.needsUpdate=!0,d(A)}),t.load(Fs.resolveURL(h,s.path),m,void 0,p)})}).then(function(h){return c===!0&&o.revokeObjectURL(l),wn(h,a),h.userData.mimeType=a.mimeType||lI(a.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),h});return this.sourceCache[e]=u,u}assignTexture(e,t,i,r){const s=this;return this.getDependency("texture",i.index).then(function(a){if(!a)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(a=a.clone(),a.channel=i.texCoord),s.extensions[Xe.KHR_TEXTURE_TRANSFORM]){const o=i.extensions!==void 0?i.extensions[Xe.KHR_TEXTURE_TRANSFORM]:void 0;if(o){const l=s.associations.get(a);a=s.extensions[Xe.KHR_TEXTURE_TRANSFORM].extendTexture(a,o),s.associations.set(a,l)}}return r!==void 0&&(a.colorSpace=r),e[t]=a,a})}assignFinalMaterial(e){const t=e.geometry;let i=e.material;const r=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){const o="PointsMaterial:"+i.uuid;let l=this.cache.get(o);l||(l=new Au,nn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(o,l)),i=l}else if(e.isLine){const o="LineBasicMaterial:"+i.uuid;let l=this.cache.get(o);l||(l=new Xi,nn.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(o,l)),i=l}if(r||s||a){let o="ClonedMaterial:"+i.uuid+":";r&&(o+="derivative-tangents:"),s&&(o+="vertex-colors:"),a&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=i.clone(),s&&(l.vertexColors=!0),a&&(l.flatShading=!0),r&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return _u}loadMaterial(e){const t=this,i=this.json,r=this.extensions,s=i.materials[e];let a;const o={},l=s.extensions||{},c=[];if(l[Xe.KHR_MATERIALS_UNLIT]){const h=r[Xe.KHR_MATERIALS_UNLIT];a=h.getMaterialType(),c.push(h.extendParams(o,s,t))}else{const h=s.pbrMetallicRoughness||{};if(o.color=new be(1,1,1),o.opacity=1,Array.isArray(h.baseColorFactor)){const d=h.baseColorFactor;o.color.setRGB(d[0],d[1],d[2],Qt),o.opacity=d[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",h.baseColorTexture,Ct)),o.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,o.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",h.metallicRoughnessTexture))),a=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,o)})))}s.doubleSided===!0&&(o.side=tn);const u=s.alphaMode||Fl.OPAQUE;if(u===Fl.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,u===Fl.MASK&&(o.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&a!==Kt&&(c.push(t.assignTexture(o,"normalMap",s.normalTexture)),o.normalScale=new we(1,1),s.normalTexture.scale!==void 0)){const h=s.normalTexture.scale;o.normalScale.set(h,h)}if(s.occlusionTexture!==void 0&&a!==Kt&&(c.push(t.assignTexture(o,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&a!==Kt){const h=s.emissiveFactor;o.emissive=new be().setRGB(h[0],h[1],h[2],Qt)}return s.emissiveTexture!==void 0&&a!==Kt&&c.push(t.assignTexture(o,"emissiveMap",s.emissiveTexture,Ct)),Promise.all(c).then(function(){const h=new a(o);return s.name&&(h.name=s.name),wn(h,s),t.associations.set(h,{materials:e}),s.extensions&&bi(r,h,s),h})}createUniqueName(e){const t=rt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,i=this.extensions,r=this.primitiveCache;function s(o){return i[Xe.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return Sd(l,o,t)})}const a=[];for(let o=0,l=e.length;o<l;o++){const c=e[o],u=oI(c),h=r[u];if(h)a.push(h.promise);else{let d;c.extensions&&c.extensions[Xe.KHR_DRACO_MESH_COMPRESSION]?d=s(c):d=Sd(new dt,c,t),r[u]={primitive:c,promise:d},a.push(d)}}return Promise.all(a)}loadMesh(e){const t=this,i=this.json,r=this.extensions,s=i.meshes[e],a=s.primitives,o=[];for(let l=0,c=a.length;l<c;l++){const u=a[l].material===void 0?rI(this.cache):this.getDependency("material",a[l].material);o.push(u)}return o.push(t.loadGeometries(a)),Promise.all(o).then(function(l){const c=l.slice(0,l.length-1),u=l[l.length-1],h=[];for(let p=0,m=u.length;p<m;p++){const g=u[p],A=a[p];let f;const E=c[p];if(A.mode===cn.TRIANGLES||A.mode===cn.TRIANGLE_STRIP||A.mode===cn.TRIANGLE_FAN||A.mode===void 0)f=s.isSkinnedMesh===!0?new np(g,E):new Ke(g,E),f.isSkinnedMesh===!0&&f.normalizeSkinWeights(),A.mode===cn.TRIANGLE_STRIP?f.geometry=xd(f.geometry,Gf):A.mode===cn.TRIANGLE_FAN&&(f.geometry=xd(f.geometry,Lc));else if(A.mode===cn.LINES)f=new Zs(g,E);else if(A.mode===cn.LINE_STRIP)f=new Ro(g,E);else if(A.mode===cn.LINE_LOOP)f=new gE(g,E);else if(A.mode===cn.POINTS)f=new rp(g,E);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+A.mode);Object.keys(f.geometry.morphAttributes).length>0&&aI(f,s),f.name=t.createUniqueName(s.name||"mesh_"+e),wn(f,s),A.extensions&&bi(r,f,A),t.assignFinalMaterial(f),h.push(f)}for(let p=0,m=h.length;p<m;p++)t.associations.set(h[p],{meshes:e,primitives:p});if(h.length===1)return s.extensions&&bi(r,h[0],s),h[0];const d=new gt;s.extensions&&bi(r,d,s),t.associations.set(d,{meshes:e});for(let p=0,m=h.length;p<m;p++)d.add(h[p]);return d})}loadCamera(e){let t;const i=this.json.cameras[e],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new Wt(Mt.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new Uo(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),wn(t,i),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],i=[];for(let r=0,s=t.joints.length;r<s;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){const s=r.pop(),a=r,o=[],l=[];for(let c=0,u=a.length;c<u;c++){const h=a[c];if(h){o.push(h);const d=new De;s!==null&&d.fromArray(s.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Yr(o,l)})}loadAnimation(e){const t=this.json,i=this,r=t.animations[e],s=r.name?r.name:"animation_"+e,a=[],o=[],l=[],c=[],u=[];for(let h=0,d=r.channels.length;h<d;h++){const p=r.channels[h],m=r.samplers[p.sampler],g=p.target,A=g.node,f=r.parameters!==void 0?r.parameters[m.input]:m.input,E=r.parameters!==void 0?r.parameters[m.output]:m.output;g.node!==void 0&&(a.push(this.getDependency("node",A)),o.push(this.getDependency("accessor",f)),l.push(this.getDependency("accessor",E)),c.push(m),u.push(g))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(h){const d=h[0],p=h[1],m=h[2],g=h[3],A=h[4],f=[];for(let v=0,_=d.length;v<_;v++){const b=d[v],M=p[v],S=m[v],C=g[v],I=A[v];if(b===void 0)continue;b.updateMatrix&&b.updateMatrix();const y=i._createAnimationTracks(b,M,S,C,I);if(y)for(let T=0;T<y.length;T++)f.push(y[T])}const E=new _o(s,void 0,f);return wn(E,r),E})}createNodeMesh(e){const t=this.json,i=this,r=t.nodes[e];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(s){const a=i._getNodeRef(i.meshCache,r.mesh,s);return r.weights!==void 0&&a.traverse(function(o){if(o.isMesh)for(let l=0,c=r.weights.length;l<c;l++)o.morphTargetInfluences[l]=r.weights[l]}),a})}loadNode(e){const t=this.json,i=this,r=t.nodes[e],s=i._loadNodeShallow(e),a=[],o=r.children||[];for(let c=0,u=o.length;c<u;c++)a.push(i.getDependency("node",o[c]));const l=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([s,Promise.all(a),l]).then(function(c){const u=c[0],h=c[1],d=c[2];d!==null&&u.traverse(function(p){p.isSkinnedMesh&&p.bind(d,cI)});for(let p=0,m=h.length;p<m;p++)u.add(h[p]);return u})}_loadNodeShallow(e){const t=this.json,i=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const s=t.nodes[e],a=s.name?r.createUniqueName(s.name):"",o=[],l=r._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),s.camera!==void 0&&o.push(r.getDependency("camera",s.camera).then(function(c){return r._getNodeRef(r.cameraCache,s.camera,c)})),r._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let u;if(s.isBone===!0?u=new ip:c.length>1?u=new gt:c.length===1?u=c[0]:u=new ct,u!==c[0])for(let h=0,d=c.length;h<d;h++)u.add(c[h]);if(s.name&&(u.userData.name=s.name,u.name=a),wn(u,s),s.extensions&&bi(i,u,s),s.matrix!==void 0){const h=new De;h.fromArray(s.matrix),u.applyMatrix4(h)}else s.translation!==void 0&&u.position.fromArray(s.translation),s.rotation!==void 0&&u.quaternion.fromArray(s.rotation),s.scale!==void 0&&u.scale.fromArray(s.scale);if(!r.associations.has(u))r.associations.set(u,{});else if(s.mesh!==void 0&&r.meshCache.refs[s.mesh]>1){const h=r.associations.get(u);r.associations.set(u,{...h})}return r.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){const t=this.extensions,i=this.json.scenes[e],r=this,s=new gt;i.name&&(s.name=r.createUniqueName(i.name)),wn(s,i),i.extensions&&bi(t,s,i);const a=i.nodes||[],o=[];for(let l=0,c=a.length;l<c;l++)o.push(r.getDependency("node",a[l]));return Promise.all(o).then(function(l){for(let u=0,h=l.length;u<h;u++)s.add(l[u]);const c=u=>{const h=new Map;for(const[d,p]of r.associations)(d instanceof nn||d instanceof Tt)&&h.set(d,p);return u.traverse(d=>{const p=r.associations.get(d);p!=null&&h.set(d,p)}),h};return r.associations=c(s),s})}_createAnimationTracks(e,t,i,r,s){const a=[],o=e.name?e.name:e.uuid,l=[];ii[s.path]===ii.weights?e.traverse(function(d){d.morphTargetInfluences&&l.push(d.name?d.name:d.uuid)}):l.push(o);let c;switch(ii[s.path]){case ii.weights:c=jr;break;case ii.rotation:c=Wi;break;case ii.translation:case ii.scale:c=qi;break;default:switch(i.itemSize){case 1:c=jr;break;case 2:case 3:default:c=qi;break}break}const u=r.interpolation!==void 0?iI[r.interpolation]:Xs,h=this._getArrayFromAccessor(i);for(let d=0,p=l.length;d<p;d++){const m=new c(l[d]+"."+ii[s.path],t.array,h,u);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(m),a.push(m)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const i=Hc(t.constructor),r=new Float32Array(t.length);for(let s=0,a=t.length;s<a;s++)r[s]=t[s]*i;t=r}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){const r=this instanceof Wi?nI:sA;return new r(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function hI(n,e,t){const i=e.attributes,r=new yn;if(i.POSITION!==void 0){const o=t.json.accessors[i.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(r.set(new R(l[0],l[1],l[2]),new R(c[0],c[1],c[2])),o.normalized){const u=Hc(Or[o.componentType]);r.min.multiplyScalar(u),r.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const s=e.targets;if(s!==void 0){const o=new R,l=new R;for(let c=0,u=s.length;c<u;c++){const h=s[c];if(h.POSITION!==void 0){const d=t.json.accessors[h.POSITION],p=d.min,m=d.max;if(p!==void 0&&m!==void 0){if(l.setX(Math.max(Math.abs(p[0]),Math.abs(m[0]))),l.setY(Math.max(Math.abs(p[1]),Math.abs(m[1]))),l.setZ(Math.max(Math.abs(p[2]),Math.abs(m[2]))),d.normalized){const g=Hc(Or[d.componentType]);l.multiplyScalar(g)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(o)}n.boundingBox=r;const a=new Dn;r.getCenter(a.center),a.radius=r.min.distanceTo(r.max)/2,n.boundingSphere=a}function Sd(n,e,t){const i=e.attributes,r=[];function s(a,o){return t.getDependency("accessor",a).then(function(l){n.setAttribute(o,l)})}for(const a in i){const o=Qc[a]||a.toLowerCase();o in n.attributes||r.push(s(i[a],o))}if(e.indices!==void 0&&!n.index){const a=t.getDependency("accessor",e.indices).then(function(o){n.setIndex(o)});r.push(a)}return Je.workingColorSpace!==Qt&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Je.workingColorSpace}" not supported.`),wn(n,e),hI(n,e,t),Promise.all(r).then(function(){return e.targets!==void 0?sI(n,e.targets,t):n})}var dI=(function(){var n="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:q:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq;w8Wqdbk;esezu8Jjjjjbcj;eb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Radz1jjjbhwcj;abad9Uc;WFbGgocjdaocjd6EhDaicefhocbhqdnindndndnaeaq9nmbaDaeaq9RaqaDfae6Egkcsfglcl4cifcd4hxalc9WGgmTmecbhPawcjdfhsaohzinaraz9Rax6mvarazaxfgo9RcK6mvczhlcbhHinalgic9WfgOawcj;cbffhldndndndndnazaOco4fRbbaHcoG4ciGPlbedibkal9cb83ibalcwf9cb83ibxikalaoRblaoRbbgOco4gAaAciSgAE86bbawcj;cbfaifglcGfaoclfaAfgARbbaOcl4ciGgCaCciSgCE86bbalcVfaAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc7faAaCfgARbbaOciGgOaOciSgOE86bbalctfaAaOfgARbbaoRbegOco4gCaCciSgCE86bbalc91faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc4faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc93faAaCfgARbbaOciGgOaOciSgOE86bbalc94faAaOfgARbbaoRbdgOco4gCaCciSgCE86bbalc95faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc96faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc97faAaCfgARbbaOciGgOaOciSgOE86bbalc98faAaOfgORbbaoRbigoco4gAaAciSgAE86bbalc99faOaAfgORbbaocl4ciGgAaAciSgAE86bbalc9:faOaAfgORbbaocd4ciGgAaAciSgAE86bbalcufaOaAfglRbbaociGgoaociSgoE86bbalaofhoxdkalaoRbwaoRbbgOcl4gAaAcsSgAE86bbawcj;cbfaifglcGfaocwfaAfgARbbaOcsGgOaOcsSgOE86bbalcVfaAaOfgORbbaoRbegAcl4gCaCcsSgCE86bbalc7faOaCfgORbbaAcsGgAaAcsSgAE86bbalctfaOaAfgORbbaoRbdgAcl4gCaCcsSgCE86bbalc91faOaCfgORbbaAcsGgAaAcsSgAE86bbalc4faOaAfgORbbaoRbigAcl4gCaCcsSgCE86bbalc93faOaCfgORbbaAcsGgAaAcsSgAE86bbalc94faOaAfgORbbaoRblgAcl4gCaCcsSgCE86bbalc95faOaCfgORbbaAcsGgAaAcsSgAE86bbalc96faOaAfgORbbaoRbvgAcl4gCaCcsSgCE86bbalc97faOaCfgORbbaAcsGgAaAcsSgAE86bbalc98faOaAfgORbbaoRbogAcl4gCaCcsSgCE86bbalc99faOaCfgORbbaAcsGgAaAcsSgAE86bbalc9:faOaAfgORbbaoRbrgocl4gAaAcsSgAE86bbalcufaOaAfglRbbaocsGgoaocsSgoE86bbalaofhoxekalao8Pbb83bbalcwfaocwf8Pbb83bbaoczfhokdnaiam9pmbaHcdfhHaiczfhlarao9RcL0mekkaiam6mvaoTmvdnakTmbawaPfRbbhHawcj;cbfhlashiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkkascefhsaohzaPcefgPad9hmbxikkcbc99arao9Radcaadca0ESEhoxlkaoaxad2fhCdnakmbadhlinaoTmlarao9Rax6mlaoaxfhoalcufglmbkaChoxekcbhmawcjdfhAinarao9Rax6miawamfRbbhHawcj;cbfhlaAhiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkaAcefhAaoaxfhoamcefgmad9hmbkaChokabaqad2fawcjdfakad2z1jjjb8Aawawcjdfakcufad2fadz1jjjb8Aakaqfhqaombkc9:hoxekc9:hokavcj;ebf8Kjjjjbaok;cseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkkkebcjwklzNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq:p9sqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:N8JlHud97euo978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Rad;8qbbcj;abad9UhlaicefhodnaeTmbadTmbalc;WFbGglcjdalcjd6EhwcbhDinawaeaD9RaDawfae6Egqcsfglc9WGgkci2hxakcethmalcl4cifcd4hPabaDad2fhsakc;ab6hzcbhHincbhOaohAdndninaraA9RaP6meavcj;cbfaOak2fhCaAaPfhocbhidnazmbarao9Rc;Gb6mbcbhlinaCalfhidndndndndnaAalco4fRbbgXciGPlbedibkaipxbbbbbbbbbbbbbbbbpklbxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklbaoczfhokdndndndndnaXcd4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklzxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklzaoczfhokdndndndndnaXcl4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklaxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklaaoczfhokdndndndndnaXco4Plbedibkaipxbbbbbbbbbbbbbbbbpkl8WxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaoclfaYpQbfaXc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaocwfaYpQbfaXc:q:yjjbfRbbfhoxekaiaopbbbpkl8Waoczfhokalc;abfhialcjefak0meaihlarao9Rc;Fb0mbkkdnaiak9pmbaici4hlinarao9RcK6miaCaifhXdndndndndnaAaico4fRbbalcoG4ciGPlbedibkaXpxbbbbbbbbbbbbbbbbpkbbxikaXaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaXaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaXaopbbbpkbbaoczfhokalcdfhlaiczfgiak6mbkkaoTmeaohAaOcefgOclSmdxbkkc9:hoxlkdnakTmbavcjdfaHfhiavaHfpbdbhYcbhXinaiavcj;cbfaXfglpblbgLcep9TaLpxeeeeeeeeeeeeeeeegQp9op9Hp9rgLalakfpblbg8Acep9Ta8AaQp9op9Hp9rg8ApmbzeHdOiAlCvXoQrLgEalamfpblbg3cep9Ta3aQp9op9Hp9rg3alaxfpblbg5cep9Ta5aQp9op9Hp9rg5pmbzeHdOiAlCvXoQrLg8EpmbezHdiOAlvCXorQLgQaQpmbedibedibedibediaYp9UgYp9AdbbaiadfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaEa8EpmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwKDYq8AkEx3m5P8Es8FgLa3a5pmwKDYq8AkEx3m5P8Es8Fg8ApmbezHdiOAlvCXorQLgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfhiaXczfgXak6mbkkaHclfgHad6mbkasavcjdfaqad2;8qbbavavcjdfaqcufad2fad;8qbbaqaDfgDae6mbkkcbc99arao9Radcaadca0ESEhokavcj;kbf8Kjjjjbaokwbz:bjjjbk::seHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:wPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiaeciGgvcitgdfcbcaad9R;8kbaiabalcitfglad;8qbbdnavTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkalaiad;8qbbkk;4wllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiaeciGgvcitgofcbcaao9R;8kbaiabalcitfgwao;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkawaiao;8qbbkk:Pddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaialciGgecdtgdVcbc;abad9R;8kbaiabavcdtfgvad;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkavaiad;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",t=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),i=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r=WebAssembly.validate(t)?o(e):o(n),s,a=WebAssembly.instantiate(r,{}).then(function(f){s=f.instance,s.exports.__wasm_call_ctors()});function o(f){for(var E=new Uint8Array(f.length),v=0;v<f.length;++v){var _=f.charCodeAt(v);E[v]=_>96?_-97:_>64?_-39:_+4}for(var b=0,v=0;v<f.length;++v)E[b++]=E[v]<60?i[E[v]]:(E[v]-60)*64+E[++v];return E.buffer.slice(0,b)}function l(f,E,v,_,b,M,S){var C=f.exports.sbrk,I=_+3&-4,y=C(I*b),T=C(M.length),N=new Uint8Array(f.exports.memory.buffer);N.set(M,T);var D=E(y,_,b,T,M.length);if(D==0&&S&&S(y,I,b),v.set(N.subarray(y,y+_*b)),C(y-C(0)),D!=0)throw new Error("Malformed buffer data: "+D)}var c={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},u={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},h=[],d=0;function p(f){var E={object:new Worker(f),pending:0,requests:{}};return E.object.onmessage=function(v){var _=v.data;E.pending-=_.count,E.requests[_.id][_.action](_.value),delete E.requests[_.id]},E}function m(f){for(var E="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(r)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+A.name+";"+l.toString()+A.toString(),v=new Blob([E],{type:"text/javascript"}),_=URL.createObjectURL(v),b=h.length;b<f;++b)h[b]=p(_);for(var b=f;b<h.length;++b)h[b].object.postMessage({});h.length=f,URL.revokeObjectURL(_)}function g(f,E,v,_,b){for(var M=h[0],S=1;S<h.length;++S)h[S].pending<M.pending&&(M=h[S]);return new Promise(function(C,I){var y=new Uint8Array(v),T=++d;M.pending+=f,M.requests[T]={resolve:C,reject:I},M.object.postMessage({id:T,count:f,size:E,source:y,mode:_,filter:b},[y.buffer])})}function A(f){var E=f.data;if(!E.id)return self.close();self.ready.then(function(v){try{var _=new Uint8Array(E.count*E.size);l(v,v.exports[E.mode],_,E.count,E.size,E.source,v.exports[E.filter]),self.postMessage({id:E.id,count:E.count,action:"resolve",value:_},[_.buffer])}catch(b){self.postMessage({id:E.id,count:E.count,action:"reject",value:b})}})}return{ready:a,supported:!0,useWorkers:function(f){m(f)},decodeVertexBuffer:function(f,E,v,_,b){l(s,s.exports.meshopt_decodeVertexBuffer,f,E,v,_,s.exports[c[b]])},decodeIndexBuffer:function(f,E,v,_){l(s,s.exports.meshopt_decodeIndexBuffer,f,E,v,_)},decodeIndexSequence:function(f,E,v,_){l(s,s.exports.meshopt_decodeIndexSequence,f,E,v,_)},decodeGltfBuffer:function(f,E,v,_,b,M){l(s,s.exports[u[b]],f,E,v,_,s.exports[c[M]])},decodeGltfBufferAsync:function(f,E,v,_,b){return h.length>0?g(f,E,v,u[_],c[b]):a.then(function(){var M=new Uint8Array(f*E);return l(s,s.exports[u[_]],M,f,E,v,s.exports[c[b]]),M})}}})();/*!
 * @pixiv/three-vrm v3.5.5
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */var Fa=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),et=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),Cd=class extends ct{constructor(n){super(),this.weight=0,this.isBinary=!1,this.overrideBlink="none",this.overrideLookAt="none",this.overrideMouth="none",this._binds=[],this.name=`VRMExpression_${n}`,this.expressionName=n,this.type="VRMExpression",this.visible=!1}get binds(){return this._binds}get overrideBlinkAmount(){return this.overrideBlink==="block"?0<this.outputWeight?1:0:this.overrideBlink==="blend"?this.outputWeight:0}get overrideLookAtAmount(){return this.overrideLookAt==="block"?0<this.outputWeight?1:0:this.overrideLookAt==="blend"?this.outputWeight:0}get overrideMouthAmount(){return this.overrideMouth==="block"?0<this.outputWeight?1:0:this.overrideMouth==="blend"?this.outputWeight:0}get outputWeight(){return this.isBinary?this.weight>.5?1:0:this.weight}addBind(n){this._binds.push(n)}deleteBind(n){const e=this._binds.indexOf(n);e>=0&&this._binds.splice(e,1)}applyWeight(n){var e;let t=this.outputWeight;t*=(e=n==null?void 0:n.multiplier)!=null?e:1,this.isBinary&&t<1&&(t=0),this._binds.forEach(i=>i.applyWeight(t))}clearAppliedWeight(){this._binds.forEach(n=>n.clearAppliedWeight())}};function aA(n,e,t){var i,r;const s=n.parser.json,a=(i=s.nodes)==null?void 0:i[e];if(a==null)return console.warn(`extractPrimitivesInternal: Attempt to use nodes[${e}] of glTF but the node doesn't exist`),null;const o=a.mesh;if(o==null)return null;const l=(r=s.meshes)==null?void 0:r[o];if(l==null)return console.warn(`extractPrimitivesInternal: Attempt to use meshes[${o}] of glTF but the mesh doesn't exist`),null;const c=l.primitives.length,u=[];return t.traverse(h=>{u.length<c&&h.isMesh&&u.push(h)}),u}function wd(n,e){return et(this,null,function*(){const t=yield n.parser.getDependency("node",e);return aA(n,e,t)})}function Td(n){return et(this,null,function*(){const e=yield n.parser.getDependencies("node"),t=new Map;return e.forEach((i,r)=>{const s=aA(n,r,i);s!=null&&t.set(r,s)}),t})}var Gc={Aa:"aa",Ih:"ih",Ou:"ou",Ee:"ee",Oh:"oh",Blink:"blink",Happy:"happy",Angry:"angry",Sad:"sad",Relaxed:"relaxed",LookUp:"lookUp",Surprised:"surprised",LookDown:"lookDown",LookLeft:"lookLeft",LookRight:"lookRight",BlinkLeft:"blinkLeft",BlinkRight:"blinkRight",Neutral:"neutral"};function oA(n){return Math.max(Math.min(n,1),0)}var Rd=class lA{constructor(){this.blinkExpressionNames=["blink","blinkLeft","blinkRight"],this.lookAtExpressionNames=["lookLeft","lookRight","lookUp","lookDown"],this.mouthExpressionNames=["aa","ee","ih","oh","ou"],this._expressions=[],this._expressionMap={}}get expressions(){return this._expressions.concat()}get expressionMap(){return Object.assign({},this._expressionMap)}get presetExpressionMap(){const e={},t=new Set(Object.values(Gc));return Object.entries(this._expressionMap).forEach(([i,r])=>{t.has(i)&&(e[i]=r)}),e}get customExpressionMap(){const e={},t=new Set(Object.values(Gc));return Object.entries(this._expressionMap).forEach(([i,r])=>{t.has(i)||(e[i]=r)}),e}copy(e){return this._expressions.concat().forEach(i=>{this.unregisterExpression(i)}),e._expressions.forEach(i=>{this.registerExpression(i)}),this.blinkExpressionNames=e.blinkExpressionNames.concat(),this.lookAtExpressionNames=e.lookAtExpressionNames.concat(),this.mouthExpressionNames=e.mouthExpressionNames.concat(),this}clone(){return new lA().copy(this)}getExpression(e){var t;return(t=this._expressionMap[e])!=null?t:null}registerExpression(e){this._expressions.push(e),this._expressionMap[e.expressionName]=e}unregisterExpression(e){const t=this._expressions.indexOf(e);t===-1&&console.warn("VRMExpressionManager: The specified expressions is not registered"),this._expressions.splice(t,1),delete this._expressionMap[e.expressionName]}getValue(e){var t;const i=this.getExpression(e);return(t=i==null?void 0:i.weight)!=null?t:null}setValue(e,t){const i=this.getExpression(e);i&&(i.weight=oA(t))}resetValues(){this._expressions.forEach(e=>{e.weight=0})}getExpressionTrackName(e){const t=this.getExpression(e);return t?`${t.name}.weight`:null}update(){const e=this._calculateWeightMultipliers();this._expressions.forEach(t=>{t.clearAppliedWeight()}),this._expressions.forEach(t=>{let i=1;const r=t.expressionName;this.blinkExpressionNames.indexOf(r)!==-1&&(i*=e.blink),this.lookAtExpressionNames.indexOf(r)!==-1&&(i*=e.lookAt),this.mouthExpressionNames.indexOf(r)!==-1&&(i*=e.mouth),t.applyWeight({multiplier:i})})}_calculateWeightMultipliers(){let e=1,t=1,i=1;return this._expressions.forEach(r=>{e-=r.overrideBlinkAmount,t-=r.overrideLookAtAmount,i-=r.overrideMouthAmount}),e=Math.max(0,e),t=Math.max(0,t),i=Math.max(0,i),{blink:e,lookAt:t,mouth:i}}},vs={Color:"color",EmissionColor:"emissionColor",ShadeColor:"shadeColor",RimColor:"rimColor",OutlineColor:"outlineColor"},fI={_Color:vs.Color,_EmissionColor:vs.EmissionColor,_ShadeColor:vs.ShadeColor,_RimColor:vs.RimColor,_OutlineColor:vs.OutlineColor},pI=new be,cA=class uA{constructor({material:e,type:t,targetValue:i,targetAlpha:r}){this.material=e,this.type=t,this.targetValue=i,this.targetAlpha=r??1;const s=this._initColorBindState(),a=this._initAlphaBindState();this._state={color:s,alpha:a}}applyWeight(e){const{color:t,alpha:i}=this._state;if(t!=null){const{propertyName:r,deltaValue:s}=t,a=this.material[r];a!=null&&a.add(pI.copy(s).multiplyScalar(e))}if(i!=null){const{propertyName:r,deltaValue:s}=i;this.material[r]!=null&&(this.material[r]+=s*e)}}clearAppliedWeight(){const{color:e,alpha:t}=this._state;if(e!=null){const{propertyName:i,initialValue:r}=e,s=this.material[i];s!=null&&s.copy(r)}if(t!=null){const{propertyName:i,initialValue:r}=t;this.material[i]!=null&&(this.material[i]=r)}}_initColorBindState(){var e,t,i;const{material:r,type:s,targetValue:a}=this,o=this._getPropertyNameMap(),l=(t=(e=o==null?void 0:o[s])==null?void 0:e[0])!=null?t:null;if(l==null)return console.warn(`Tried to add a material color bind to the material ${(i=r.name)!=null?i:"(no name)"}, the type ${s} but the material or the type is not supported.`),null;const u=r[l].clone(),h=new be(a.r-u.r,a.g-u.g,a.b-u.b);return{propertyName:l,initialValue:u,deltaValue:h}}_initAlphaBindState(){var e,t,i;const{material:r,type:s,targetAlpha:a}=this,o=this._getPropertyNameMap(),l=(t=(e=o==null?void 0:o[s])==null?void 0:e[1])!=null?t:null;if(l==null&&a!==1)return console.warn(`Tried to add a material alpha bind to the material ${(i=r.name)!=null?i:"(no name)"}, the type ${s} but the material or the type does not support alpha.`),null;if(l==null)return null;const c=r[l],u=a-c;return{propertyName:l,initialValue:c,deltaValue:u}}_getPropertyNameMap(){var e,t;return(t=(e=Object.entries(uA._propertyNameMapMap).find(([i])=>this.material[i]===!0))==null?void 0:e[1])!=null?t:null}};cA._propertyNameMapMap={isMeshStandardMaterial:{color:["color","opacity"],emissionColor:["emissive",null]},isMeshBasicMaterial:{color:["color","opacity"]},isMToonMaterial:{color:["color","opacity"],emissionColor:["emissive",null],outlineColor:["outlineColorFactor",null],matcapColor:["matcapFactor",null],rimColor:["parametricRimColorFactor",null],shadeColor:["shadeColorFactor",null]}};var Bd=cA,vo=class{constructor({primitives:n,index:e,weight:t}){this.primitives=n,this.index=e,this.weight=t}applyWeight(n){this.primitives.forEach(e=>{var t;((t=e.morphTargetInfluences)==null?void 0:t[this.index])!=null&&(e.morphTargetInfluences[this.index]+=this.weight*n)})}clearAppliedWeight(){this.primitives.forEach(n=>{var e;((e=n.morphTargetInfluences)==null?void 0:e[this.index])!=null&&(n.morphTargetInfluences[this.index]=0)})}},Ld=new we,hA=class dA{constructor({material:e,scale:t,offset:i}){var r,s;this.material=e,this.scale=t,this.offset=i;const a=(r=Object.entries(dA._propertyNamesMap).find(([o])=>e[o]===!0))==null?void 0:r[1];a==null?(console.warn(`Tried to add a texture transform bind to the material ${(s=e.name)!=null?s:"(no name)"} but the material is not supported.`),this._properties=[]):(this._properties=[],a.forEach(o=>{var l;const c=(l=e[o])==null?void 0:l.clone();if(!c)return null;e[o]=c;const u=c.offset.clone(),h=c.repeat.clone(),d=i.clone().sub(u),p=t.clone().sub(h);this._properties.push({name:o,initialOffset:u,deltaOffset:d,initialScale:h,deltaScale:p})}))}applyWeight(e){this._properties.forEach(t=>{const i=this.material[t.name];i!==void 0&&(i.offset.add(Ld.copy(t.deltaOffset).multiplyScalar(e)),i.repeat.add(Ld.copy(t.deltaScale).multiplyScalar(e)))})}clearAppliedWeight(){this._properties.forEach(e=>{const t=this.material[e.name];t!==void 0&&(t.offset.copy(e.initialOffset),t.repeat.copy(e.initialScale))})}};hA._propertyNamesMap={isMeshStandardMaterial:["map","emissiveMap","bumpMap","normalMap","displacementMap","roughnessMap","metalnessMap","alphaMap"],isMeshBasicMaterial:["map","specularMap","alphaMap"],isMToonMaterial:["map","normalMap","emissiveMap","shadeMultiplyTexture","rimMultiplyTexture","outlineWidthMultiplyTexture","uvAnimationMaskTexture"]};var Dd=hA,AI=new Set(["1.0","1.0-beta"]),fA=class pA{get name(){return"VRMExpressionLoaderPlugin"}constructor(e){this.parser=e}afterRoot(e){return et(this,null,function*(){e.userData.vrmExpressionManager=yield this._import(e)})}_import(e){return et(this,null,function*(){const t=yield this._v1Import(e);if(t)return t;const i=yield this._v0Import(e);return i||null})}_v1Import(e){return et(this,null,function*(){var t,i;const r=this.parser.json;if(!(((t=r.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const a=(i=r.extensions)==null?void 0:i.VRMC_vrm;if(!a)return null;const o=a.specVersion;if(!AI.has(o))return console.warn(`VRMExpressionLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.expressions;if(!l)return null;const c=new Set(Object.values(Gc)),u=new Map;l.preset!=null&&Object.entries(l.preset).forEach(([d,p])=>{if(p!=null){if(!c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${d}" detected. Ignoring the expression`);return}u.set(d,p)}}),l.custom!=null&&Object.entries(l.custom).forEach(([d,p])=>{if(c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${d}". Ignoring the expression`);return}u.set(d,p)});const h=new Rd;return yield Promise.all(Array.from(u.entries()).map(d=>et(this,[d],function*([p,m]){var g,A,f,E,v,_,b;const M=new Cd(p);if(e.scene.add(M),M.isBinary=(g=m.isBinary)!=null?g:!1,M.overrideBlink=(A=m.overrideBlink)!=null?A:"none",M.overrideLookAt=(f=m.overrideLookAt)!=null?f:"none",M.overrideMouth=(E=m.overrideMouth)!=null?E:"none",(v=m.morphTargetBinds)==null||v.forEach(S=>et(this,null,function*(){var C;if(S.node===void 0||S.index===void 0)return;const I=yield wd(e,S.node),y=S.index;if(!I.every(T=>Array.isArray(T.morphTargetInfluences)&&y<T.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${m.name} attempts to index morph #${y} but not found.`);return}M.addBind(new vo({primitives:I,index:y,weight:(C=S.weight)!=null?C:1}))})),m.materialColorBinds||m.textureTransformBinds){const S=[];e.scene.traverse(C=>{const I=C.material;I&&(Array.isArray(I)?S.push(...I):S.push(I))}),(_=m.materialColorBinds)==null||_.forEach(C=>et(this,null,function*(){S.filter(y=>{var T;const N=(T=this.parser.associations.get(y))==null?void 0:T.materials;return C.material===N}).forEach(y=>{M.addBind(new Bd({material:y,type:C.type,targetValue:new be().fromArray(C.targetValue),targetAlpha:C.targetValue[3]}))})})),(b=m.textureTransformBinds)==null||b.forEach(C=>et(this,null,function*(){S.filter(y=>{var T;const N=(T=this.parser.associations.get(y))==null?void 0:T.materials;return C.material===N}).forEach(y=>{var T,N;M.addBind(new Dd({material:y,offset:new we().fromArray((T=C.offset)!=null?T:[0,0]),scale:new we().fromArray((N=C.scale)!=null?N:[1,1])}))})}))}h.registerExpression(M)}))),h})}_v0Import(e){return et(this,null,function*(){var t;const i=this.parser.json,r=(t=i.extensions)==null?void 0:t.VRM;if(!r)return null;const s=r.blendShapeMaster;if(!s)return null;const a=new Rd,o=s.blendShapeGroups;if(!o)return a;const l=new Set;return yield Promise.all(o.map(c=>et(this,null,function*(){var u;const h=c.presetName,d=h!=null&&pA.v0v1PresetNameMap[h]||null,p=d??c.name;if(p==null){console.warn("VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression");return}if(l.has(p)){console.warn(`VRMExpressionLoaderPlugin: An expression preset ${h} has duplicated entries. Ignoring the expression`);return}l.add(p);const m=new Cd(p);e.scene.add(m),m.isBinary=(u=c.isBinary)!=null?u:!1,c.binds&&c.binds.forEach(A=>et(this,null,function*(){var f;if(A.mesh===void 0||A.index===void 0)return;const E=[];if((f=i.nodes)==null||f.forEach((_,b)=>{_.mesh===A.mesh&&E.push(b)}),E.length===0){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to bind a morph target to the mesh #${A.mesh} but the mesh is not found or not used in the scene. Ignoring the bind.`);return}const v=A.index;yield Promise.all(E.map(_=>et(this,null,function*(){var b;const M=yield wd(e,_);if(!M.every(S=>Array.isArray(S.morphTargetInfluences)&&v<S.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to index ${v}th morph but not found.`);return}m.addBind(new vo({primitives:M,index:v,weight:.01*((b=A.weight)!=null?b:100)}))})))}));const g=c.materialValues;g&&g.length!==0&&g.forEach(A=>{if(A.materialName===void 0||A.propertyName===void 0||A.targetValue===void 0)return;const f=[];e.scene.traverse(v=>{if(v.material){const _=v.material;Array.isArray(_)?f.push(..._.filter(b=>(b.name===A.materialName||b.name===A.materialName+" (Outline)")&&f.indexOf(b)===-1)):_.name===A.materialName&&f.indexOf(_)===-1&&f.push(_)}});const E=A.propertyName;f.forEach(v=>{if(E==="_MainTex_ST"){const b=new we(A.targetValue[0],A.targetValue[1]),M=new we(A.targetValue[2],A.targetValue[3]);M.y=1-M.y-b.y,m.addBind(new Dd({material:v,scale:b,offset:M}));return}const _=fI[E];if(_){m.addBind(new Bd({material:v,type:_,targetValue:new be().fromArray(A.targetValue),targetAlpha:A.targetValue[3]}));return}console.warn(E+" is not supported")})}),a.registerExpression(m)}))),a})}};fA.v0v1PresetNameMap={a:"aa",e:"ee",i:"ih",o:"oh",u:"ou",blink:"blink",joy:"happy",angry:"angry",sorrow:"sad",fun:"relaxed",lookup:"lookUp",lookdown:"lookDown",lookleft:"lookLeft",lookright:"lookRight",blink_l:"blinkLeft",blink_r:"blinkRight",neutral:"neutral"};var mI=fA,Iu=class Sr{constructor(e,t){this._firstPersonOnlyLayer=Sr.DEFAULT_FIRSTPERSON_ONLY_LAYER,this._thirdPersonOnlyLayer=Sr.DEFAULT_THIRDPERSON_ONLY_LAYER,this._initializedLayers=!1,this.humanoid=e,this.meshAnnotations=t}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMFirstPerson: humanoid must be same in order to copy");return this.meshAnnotations=e.meshAnnotations.map(t=>({meshes:t.meshes.concat(),type:t.type})),this}clone(){return new Sr(this.humanoid,this.meshAnnotations).copy(this)}get firstPersonOnlyLayer(){return this._firstPersonOnlyLayer}get thirdPersonOnlyLayer(){return this._thirdPersonOnlyLayer}setup({firstPersonOnlyLayer:e=Sr.DEFAULT_FIRSTPERSON_ONLY_LAYER,thirdPersonOnlyLayer:t=Sr.DEFAULT_THIRDPERSON_ONLY_LAYER}={}){this._initializedLayers||(this._firstPersonOnlyLayer=e,this._thirdPersonOnlyLayer=t,this.meshAnnotations.forEach(i=>{i.meshes.forEach(r=>{i.type==="firstPersonOnly"?(r.layers.set(this._firstPersonOnlyLayer),r.traverse(s=>s.layers.set(this._firstPersonOnlyLayer))):i.type==="thirdPersonOnly"?(r.layers.set(this._thirdPersonOnlyLayer),r.traverse(s=>s.layers.set(this._thirdPersonOnlyLayer))):i.type==="auto"&&this._createHeadlessModel(r)})}),this._initializedLayers=!0)}_excludeTriangles(e,t,i,r){let s=0;if(t!=null&&t.length>0)for(let a=0;a<e.length;a+=3){const o=e[a],l=e[a+1],c=e[a+2],u=t[o],h=i[o];if(u[0]>0&&r.includes(h[0])||u[1]>0&&r.includes(h[1])||u[2]>0&&r.includes(h[2])||u[3]>0&&r.includes(h[3]))continue;const d=t[l],p=i[l];if(d[0]>0&&r.includes(p[0])||d[1]>0&&r.includes(p[1])||d[2]>0&&r.includes(p[2])||d[3]>0&&r.includes(p[3]))continue;const m=t[c],g=i[c];m[0]>0&&r.includes(g[0])||m[1]>0&&r.includes(g[1])||m[2]>0&&r.includes(g[2])||m[3]>0&&r.includes(g[3])||(e[s++]=o,e[s++]=l,e[s++]=c)}return s}_createErasedMesh(e,t){const i=new np(e.geometry.clone(),e.material);i.name=`${e.name}(erase)`,i.frustumCulled=e.frustumCulled,i.layers.set(this._firstPersonOnlyLayer);const r=i.geometry,s=r.getAttribute("skinIndex"),a=s instanceof Qh?[]:s.array,o=[];for(let g=0;g<a.length;g+=4)o.push([a[g],a[g+1],a[g+2],a[g+3]]);const l=r.getAttribute("skinWeight"),c=l instanceof Qh?[]:l.array,u=[];for(let g=0;g<c.length;g+=4)u.push([c[g],c[g+1],c[g+2],c[g+3]]);const h=r.getIndex();if(!h)throw new Error("The geometry doesn't have an index buffer");const d=Array.from(h.array),p=this._excludeTriangles(d,u,o,t),m=[];for(let g=0;g<p;g++)m[g]=d[g];return r.setIndex(m),e.onBeforeRender&&(i.onBeforeRender=e.onBeforeRender),i.bind(new Yr(e.skeleton.bones,e.skeleton.boneInverses),new De),i}_createHeadlessModelForSkinnedMesh(e,t){const i=[];if(t.skeleton.bones.forEach((s,a)=>{this._isEraseTarget(s)&&i.push(a)}),!i.length){t.layers.enable(this._thirdPersonOnlyLayer),t.layers.enable(this._firstPersonOnlyLayer);return}t.layers.set(this._thirdPersonOnlyLayer);const r=this._createErasedMesh(t,i);e.add(r)}_createHeadlessModel(e){if(e.type==="Group")if(e.layers.set(this._thirdPersonOnlyLayer),this._isEraseTarget(e))e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer));else{const t=new gt;t.name=`_headless_${e.name}`,t.layers.set(this._firstPersonOnlyLayer),e.parent.add(t),e.children.filter(i=>i.type==="SkinnedMesh").forEach(i=>{const r=i;this._createHeadlessModelForSkinnedMesh(t,r)})}else if(e.type==="SkinnedMesh"){const t=e;this._createHeadlessModelForSkinnedMesh(e.parent,t)}else this._isEraseTarget(e)&&(e.layers.set(this._thirdPersonOnlyLayer),e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer)))}_isEraseTarget(e){return e===this.humanoid.getRawBoneNode("head")?!0:e.parent?this._isEraseTarget(e.parent):!1}};Iu.DEFAULT_FIRSTPERSON_ONLY_LAYER=9;Iu.DEFAULT_THIRDPERSON_ONLY_LAYER=10;var Pd=Iu,gI=new Set(["1.0","1.0-beta"]),_I=class{get name(){return"VRMFirstPersonLoaderPlugin"}constructor(n){this.parser=n}afterRoot(n){return et(this,null,function*(){const e=n.userData.vrmHumanoid;if(e!==null){if(e===void 0)throw new Error("VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");n.userData.vrmFirstPerson=yield this._import(n,e)}})}_import(n,e){return et(this,null,function*(){if(e==null)return null;const t=yield this._v1Import(n,e);if(t)return t;const i=yield this._v0Import(n,e);return i||null})}_v1Import(n,e){return et(this,null,function*(){var t,i;const r=this.parser.json;if(!(((t=r.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const a=(i=r.extensions)==null?void 0:i.VRMC_vrm;if(!a)return null;const o=a.specVersion;if(!gI.has(o))return console.warn(`VRMFirstPersonLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.firstPerson,c=[],u=yield Td(n);return Array.from(u.entries()).forEach(([h,d])=>{var p,m;const g=(p=l==null?void 0:l.meshAnnotations)==null?void 0:p.find(A=>A.node===h);c.push({meshes:d,type:(m=g==null?void 0:g.type)!=null?m:"auto"})}),new Pd(e,c)})}_v0Import(n,e){return et(this,null,function*(){var t;const i=this.parser.json,r=(t=i.extensions)==null?void 0:t.VRM;if(!r)return null;const s=r.firstPerson;if(!s)return null;const a=[],o=yield Td(n);return Array.from(o.entries()).forEach(([l,c])=>{const u=i.nodes[l],h=s.meshAnnotations?s.meshAnnotations.find(d=>d.mesh===u.mesh):void 0;a.push({meshes:c,type:this._convertV0FlagToV1Type(h==null?void 0:h.firstPersonFlag)})}),new Pd(e,a)})}_convertV0FlagToV1Type(n){return n==="FirstPersonOnly"?"firstPersonOnly":n==="ThirdPersonOnly"?"thirdPersonOnly":n==="Both"?"both":"auto"}},Ud=new R,Nd=new R,EI=new He,Fd=class extends gt{constructor(n){super(),this.vrmHumanoid=n,this._boneAxesMap=new Map,Object.values(n.humanBones).forEach(e=>{const t=new $E(1);t.matrixAutoUpdate=!1,t.material.depthTest=!1,t.material.depthWrite=!1,this.add(t),this._boneAxesMap.set(e,t)})}dispose(){Array.from(this._boneAxesMap.values()).forEach(n=>{n.geometry.dispose(),n.material.dispose()})}updateMatrixWorld(n){Array.from(this._boneAxesMap.entries()).forEach(([e,t])=>{e.node.updateWorldMatrix(!0,!1),e.node.matrixWorld.decompose(Ud,EI,Nd);const i=Ud.set(.1,.1,.1).divide(Nd);t.matrix.copy(e.node.matrixWorld).scale(i)}),super.updateMatrixWorld(n)}},kl=["hips","spine","chest","upperChest","neck","head","leftEye","rightEye","jaw","leftUpperLeg","leftLowerLeg","leftFoot","leftToes","rightUpperLeg","rightLowerLeg","rightFoot","rightToes","leftShoulder","leftUpperArm","leftLowerArm","leftHand","rightShoulder","rightUpperArm","rightLowerArm","rightHand","leftThumbMetacarpal","leftThumbProximal","leftThumbDistal","leftIndexProximal","leftIndexIntermediate","leftIndexDistal","leftMiddleProximal","leftMiddleIntermediate","leftMiddleDistal","leftRingProximal","leftRingIntermediate","leftRingDistal","leftLittleProximal","leftLittleIntermediate","leftLittleDistal","rightThumbMetacarpal","rightThumbProximal","rightThumbDistal","rightIndexProximal","rightIndexIntermediate","rightIndexDistal","rightMiddleProximal","rightMiddleIntermediate","rightMiddleDistal","rightRingProximal","rightRingIntermediate","rightRingDistal","rightLittleProximal","rightLittleIntermediate","rightLittleDistal"],vI={hips:null,spine:"hips",chest:"spine",upperChest:"chest",neck:"upperChest",head:"neck",leftEye:"head",rightEye:"head",jaw:"head",leftUpperLeg:"hips",leftLowerLeg:"leftUpperLeg",leftFoot:"leftLowerLeg",leftToes:"leftFoot",rightUpperLeg:"hips",rightLowerLeg:"rightUpperLeg",rightFoot:"rightLowerLeg",rightToes:"rightFoot",leftShoulder:"upperChest",leftUpperArm:"leftShoulder",leftLowerArm:"leftUpperArm",leftHand:"leftLowerArm",rightShoulder:"upperChest",rightUpperArm:"rightShoulder",rightLowerArm:"rightUpperArm",rightHand:"rightLowerArm",leftThumbMetacarpal:"leftHand",leftThumbProximal:"leftThumbMetacarpal",leftThumbDistal:"leftThumbProximal",leftIndexProximal:"leftHand",leftIndexIntermediate:"leftIndexProximal",leftIndexDistal:"leftIndexIntermediate",leftMiddleProximal:"leftHand",leftMiddleIntermediate:"leftMiddleProximal",leftMiddleDistal:"leftMiddleIntermediate",leftRingProximal:"leftHand",leftRingIntermediate:"leftRingProximal",leftRingDistal:"leftRingIntermediate",leftLittleProximal:"leftHand",leftLittleIntermediate:"leftLittleProximal",leftLittleDistal:"leftLittleIntermediate",rightThumbMetacarpal:"rightHand",rightThumbProximal:"rightThumbMetacarpal",rightThumbDistal:"rightThumbProximal",rightIndexProximal:"rightHand",rightIndexIntermediate:"rightIndexProximal",rightIndexDistal:"rightIndexIntermediate",rightMiddleProximal:"rightHand",rightMiddleIntermediate:"rightMiddleProximal",rightMiddleDistal:"rightMiddleIntermediate",rightRingProximal:"rightHand",rightRingIntermediate:"rightRingProximal",rightRingDistal:"rightRingIntermediate",rightLittleProximal:"rightHand",rightLittleIntermediate:"rightLittleProximal",rightLittleDistal:"rightLittleIntermediate"};function AA(n){return n.invert?n.invert():n.inverse(),n}var xi=new R,yi=new He,Vc=class{constructor(n){this.humanBones=n,this.restPose=this.getAbsolutePose()}getAbsolutePose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);i&&(xi.copy(i.position),yi.copy(i.quaternion),n[t]={position:xi.toArray(),rotation:yi.toArray()})}),n}getPose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);if(!i)return;xi.set(0,0,0),yi.identity();const r=this.restPose[t];r!=null&&r.position&&xi.fromArray(r.position).negate(),r!=null&&r.rotation&&AA(yi.fromArray(r.rotation)),xi.add(i.position),yi.premultiply(i.quaternion),n[t]={position:xi.toArray(),rotation:yi.toArray()}}),n}setPose(n){Object.entries(n).forEach(([e,t])=>{const i=e,r=this.getBoneNode(i);if(!r)return;const s=this.restPose[i];s&&(t!=null&&t.position&&(r.position.fromArray(t.position),s.position&&r.position.add(xi.fromArray(s.position))),t!=null&&t.rotation&&(r.quaternion.fromArray(t.rotation),s.rotation&&r.quaternion.multiply(yi.fromArray(s.rotation))))})}resetPose(){Object.entries(this.restPose).forEach(([n,e])=>{const t=this.getBoneNode(n);t&&(e!=null&&e.position&&t.position.fromArray(e.position),e!=null&&e.rotation&&t.quaternion.fromArray(e.rotation))})}getBone(n){var e;return(e=this.humanBones[n])!=null?e:void 0}getBoneNode(n){var e,t;return(t=(e=this.humanBones[n])==null?void 0:e.node)!=null?t:null}},Ql=new R,bI=new He,xI=new R,Od=class mA extends Vc{static _setupTransforms(e){const t=new ct;t.name="VRMHumanoidRig";const i={},r={},s={};kl.forEach(o=>{var l;const c=e.getBoneNode(o);if(c){const u=new R,h=new He;c.updateWorldMatrix(!0,!1),c.matrixWorld.decompose(u,h,Ql),i[o]=u,r[o]=c.quaternion.clone();const d=new He;(l=c.parent)==null||l.matrixWorld.decompose(Ql,d,Ql),s[o]=d}});const a={};return kl.forEach(o=>{var l;const c=e.getBoneNode(o);if(c){const u=i[o];let h=o,d;for(;d==null&&(h=vI[h],h!=null);)d=i[h];const p=new ct;p.name="Normalized_"+c.name,(h?(l=a[h])==null?void 0:l.node:t).add(p),p.position.copy(u),d&&p.position.sub(d),a[o]={node:p}}}),{rigBones:a,root:t,parentWorldRotations:s,boneRotations:r}}constructor(e){const{rigBones:t,root:i,parentWorldRotations:r,boneRotations:s}=mA._setupTransforms(e);super(t),this.original=e,this.root=i,this._parentWorldRotations=r,this._boneRotations=s}update(){kl.forEach(e=>{const t=this.original.getBoneNode(e);if(t!=null){const i=this.getBoneNode(e),r=this._parentWorldRotations[e],s=bI.copy(r).invert(),a=this._boneRotations[e];if(t.quaternion.copy(i.quaternion).multiply(r).premultiply(s).multiply(a),e==="hips"){const o=i.getWorldPosition(xI);t.parent.updateWorldMatrix(!0,!1);const l=t.parent.matrixWorld,c=o.applyMatrix4(l.invert());t.position.copy(c)}}})}},kd=class gA{get restPose(){return console.warn("VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead."),this.rawRestPose}get rawRestPose(){return this._rawHumanBones.restPose}get normalizedRestPose(){return this._normalizedHumanBones.restPose}get humanBones(){return this._rawHumanBones.humanBones}get rawHumanBones(){return this._rawHumanBones.humanBones}get normalizedHumanBones(){return this._normalizedHumanBones.humanBones}get normalizedHumanBonesRoot(){return this._normalizedHumanBones.root}constructor(e,t){var i;this.autoUpdateHumanBones=(i=t==null?void 0:t.autoUpdateHumanBones)!=null?i:!0,this._rawHumanBones=new Vc(e),this._normalizedHumanBones=new Od(this._rawHumanBones)}copy(e){return this.autoUpdateHumanBones=e.autoUpdateHumanBones,this._rawHumanBones=new Vc(e.humanBones),this._normalizedHumanBones=new Od(this._rawHumanBones),this}clone(){return new gA(this.humanBones,{autoUpdateHumanBones:this.autoUpdateHumanBones}).copy(this)}getAbsolutePose(){return console.warn("VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead."),this.getRawAbsolutePose()}getRawAbsolutePose(){return this._rawHumanBones.getAbsolutePose()}getNormalizedAbsolutePose(){return this._normalizedHumanBones.getAbsolutePose()}getPose(){return console.warn("VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead."),this.getRawPose()}getRawPose(){return this._rawHumanBones.getPose()}getNormalizedPose(){return this._normalizedHumanBones.getPose()}setPose(e){return console.warn("VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead."),this.setRawPose(e)}setRawPose(e){return this._rawHumanBones.setPose(e)}setNormalizedPose(e){return this._normalizedHumanBones.setPose(e)}resetPose(){return console.warn("VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead."),this.resetRawPose()}resetRawPose(){return this._rawHumanBones.resetPose()}resetNormalizedPose(){return this._normalizedHumanBones.resetPose()}getBone(e){return console.warn("VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead."),this.getRawBone(e)}getRawBone(e){return this._rawHumanBones.getBone(e)}getNormalizedBone(e){return this._normalizedHumanBones.getBone(e)}getBoneNode(e){return console.warn("VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead."),this.getRawBoneNode(e)}getRawBoneNode(e){return this._rawHumanBones.getBoneNode(e)}getNormalizedBoneNode(e){return this._normalizedHumanBones.getBoneNode(e)}update(){this.autoUpdateHumanBones&&this._normalizedHumanBones.update()}},yI={Hips:"hips",Spine:"spine",Head:"head",LeftUpperLeg:"leftUpperLeg",LeftLowerLeg:"leftLowerLeg",LeftFoot:"leftFoot",RightUpperLeg:"rightUpperLeg",RightLowerLeg:"rightLowerLeg",RightFoot:"rightFoot",LeftUpperArm:"leftUpperArm",LeftLowerArm:"leftLowerArm",LeftHand:"leftHand",RightUpperArm:"rightUpperArm",RightLowerArm:"rightLowerArm",RightHand:"rightHand"},MI=new Set(["1.0","1.0-beta"]),Qd={leftThumbProximal:"leftThumbMetacarpal",leftThumbIntermediate:"leftThumbProximal",rightThumbProximal:"rightThumbMetacarpal",rightThumbIntermediate:"rightThumbProximal"},II=class{get name(){return"VRMHumanoidLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot,this.autoUpdateHumanBones=e==null?void 0:e.autoUpdateHumanBones}afterRoot(n){return et(this,null,function*(){n.userData.vrmHumanoid=yield this._import(n)})}_import(n){return et(this,null,function*(){const e=yield this._v1Import(n);if(e)return e;const t=yield this._v0Import(n);return t||null})}_v1Import(n){return et(this,null,function*(){var e,t;const i=this.parser.json;if(!(((e=i.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const s=(t=i.extensions)==null?void 0:t.VRMC_vrm;if(!s)return null;const a=s.specVersion;if(!MI.has(a))return console.warn(`VRMHumanoidLoaderPlugin: Unknown VRMC_vrm specVersion "${a}"`),null;const o=s.humanoid;if(!o)return null;const l=o.humanBones.leftThumbIntermediate!=null||o.humanBones.rightThumbIntermediate!=null,c={};o.humanBones!=null&&(yield Promise.all(Object.entries(o.humanBones).map(h=>et(this,[h],function*([d,p]){let m=d;const g=p.node;if(l){const f=Qd[m];f!=null&&(m=f)}const A=yield this.parser.getDependency("node",g);if(A==null){console.warn(`A glTF node bound to the humanoid bone ${m} (index = ${g}) does not exist`);return}c[m]={node:A}}))));const u=new kd(this._ensureRequiredBonesExist(c),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(u.normalizedHumanBonesRoot),this.helperRoot){const h=new Fd(u);this.helperRoot.add(h),h.renderOrder=this.helperRoot.renderOrder}return u})}_v0Import(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const r=i.humanoid;if(!r)return null;const s={};r.humanBones!=null&&(yield Promise.all(r.humanBones.map(o=>et(this,null,function*(){const l=o.bone,c=o.node;if(l==null||c==null)return;if(c<0){console.warn(`A glTF node index for the humanoid bone ${l} is negative (${c}), ignoring this bone.`);return}const u=yield this.parser.getDependency("node",c);if(u==null){console.warn(`A glTF node bound to the humanoid bone ${l} (index = ${c}) does not exist`);return}const h=Qd[l],d=h??l;if(s[d]!=null){console.warn(`Multiple bone entries for ${d} detected (index = ${c}), ignoring duplicated entries.`);return}s[d]={node:u}}))));const a=new kd(this._ensureRequiredBonesExist(s),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(a.normalizedHumanBonesRoot),this.helperRoot){const o=new Fd(a);this.helperRoot.add(o),o.renderOrder=this.helperRoot.renderOrder}return a})}_ensureRequiredBonesExist(n){const e=Object.values(yI).filter(t=>n[t]==null);if(e.length>0)throw new Error(`VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${e.join(", ")}`);return n}},Hd=class extends dt{constructor(){super(),this._currentTheta=0,this._currentRadius=0,this.theta=0,this.radius=0,this._currentTheta=0,this._currentRadius=0,this._attrPos=new tt(new Float32Array(195),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(189),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentTheta!==this.theta&&(this._currentTheta=this.theta,n=!0),this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,0,0,0);for(let n=0;n<64;n++){const e=n/63*this._currentTheta;this._attrPos.setXYZ(n+1,this._currentRadius*Math.sin(e),0,this._currentRadius*Math.cos(e))}this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<63;n++)this._attrIndex.setXYZ(n*3,0,n+1,n+2);this._attrIndex.needsUpdate=!0}},SI=class extends dt{constructor(){super(),this.radius=0,this._currentRadius=0,this.tail=new R,this._currentTail=new R,this._attrPos=new tt(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),this._currentTail.equals(this.tail)||(this._currentTail.copy(this.tail),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},Oa=new He,Gd=new He,bs=new R,Vd=new R,zd=Math.sqrt(2)/2,CI=new He(0,0,-zd,zd),wI=new R(0,1,0),TI=class extends gt{constructor(n){super(),this.matrixAutoUpdate=!1,this.vrmLookAt=n;{const e=new Hd;e.radius=.5;const t=new Kt({color:65280,transparent:!0,opacity:.5,side:tn,depthTest:!1,depthWrite:!1});this._meshPitch=new Ke(e,t),this.add(this._meshPitch)}{const e=new Hd;e.radius=.5;const t=new Kt({color:16711680,transparent:!0,opacity:.5,side:tn,depthTest:!1,depthWrite:!1});this._meshYaw=new Ke(e,t),this.add(this._meshYaw)}{const e=new SI;e.radius=.1;const t=new Xi({color:16777215,depthTest:!1,depthWrite:!1});this._lineTarget=new Zs(e,t),this._lineTarget.frustumCulled=!1,this.add(this._lineTarget)}}dispose(){this._meshYaw.geometry.dispose(),this._meshYaw.material.dispose(),this._meshPitch.geometry.dispose(),this._meshPitch.material.dispose(),this._lineTarget.geometry.dispose(),this._lineTarget.material.dispose()}updateMatrixWorld(n){const e=Mt.DEG2RAD*this.vrmLookAt.yaw;this._meshYaw.geometry.theta=e,this._meshYaw.geometry.update();const t=Mt.DEG2RAD*this.vrmLookAt.pitch;this._meshPitch.geometry.theta=t,this._meshPitch.geometry.update(),this.vrmLookAt.getLookAtWorldPosition(bs),this.vrmLookAt.getLookAtWorldQuaternion(Oa),Oa.multiply(this.vrmLookAt.getFaceFrontQuaternion(Gd)),this._meshYaw.position.copy(bs),this._meshYaw.quaternion.copy(Oa),this._meshPitch.position.copy(bs),this._meshPitch.quaternion.copy(Oa),this._meshPitch.quaternion.multiply(Gd.setFromAxisAngle(wI,e)),this._meshPitch.quaternion.multiply(CI);const{target:i,autoUpdate:r}=this.vrmLookAt;i!=null&&r&&(i.getWorldPosition(Vd).sub(bs),this._lineTarget.geometry.tail.copy(Vd),this._lineTarget.geometry.update(),this._lineTarget.position.copy(bs)),super.updateMatrixWorld(n)}},RI=new R,BI=new R;function zc(n,e){return n.matrixWorld.decompose(RI,e,BI),e}function Ya(n){return[Math.atan2(-n.z,n.x),Math.atan2(n.y,Math.sqrt(n.x*n.x+n.z*n.z))]}function Wd(n){const e=Math.round(n/2/Math.PI);return n-2*Math.PI*e}var qd=new R(0,0,1),LI=new R,DI=new R,PI=new R,UI=new He,Hl=new He,jd=new He,NI=new He,Gl=new jt,_A=class EA{constructor(e,t){this.offsetFromHeadBone=new R,this.autoUpdate=!0,this.faceFront=new R(0,0,1),this.humanoid=e,this.applier=t,this._yaw=0,this._pitch=0,this._needsUpdate=!0,this._restHeadWorldQuaternion=this.getLookAtWorldQuaternion(new He)}get yaw(){return this._yaw}set yaw(e){this._yaw=e,this._needsUpdate=!0}get pitch(){return this._pitch}set pitch(e){this._pitch=e,this._needsUpdate=!0}get euler(){return console.warn("VRMLookAt: euler is deprecated. use getEuler() instead."),this.getEuler(new jt)}getEuler(e){return e.set(Mt.DEG2RAD*this._pitch,Mt.DEG2RAD*this._yaw,0,"YXZ")}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMLookAt: humanoid must be same in order to copy");return this.offsetFromHeadBone.copy(e.offsetFromHeadBone),this.applier=e.applier,this.autoUpdate=e.autoUpdate,this.target=e.target,this.faceFront.copy(e.faceFront),this}clone(){return new EA(this.humanoid,this.applier).copy(this)}reset(){this._yaw=0,this._pitch=0,this._needsUpdate=!0}getLookAtWorldPosition(e){const t=this.humanoid.getRawBoneNode("head");return e.copy(this.offsetFromHeadBone).applyMatrix4(t.matrixWorld)}getLookAtWorldQuaternion(e){const t=this.humanoid.getRawBoneNode("head");return zc(t,e)}getFaceFrontQuaternion(e){if(this.faceFront.distanceToSquared(qd)<.01)return e.copy(this._restHeadWorldQuaternion).invert();const[t,i]=Ya(this.faceFront);return Gl.set(0,.5*Math.PI+t,i,"YZX"),e.setFromEuler(Gl).premultiply(NI.copy(this._restHeadWorldQuaternion).invert())}getLookAtWorldDirection(e){return this.getLookAtWorldQuaternion(Hl),this.getFaceFrontQuaternion(jd),e.copy(qd).applyQuaternion(Hl).applyQuaternion(jd).applyEuler(this.getEuler(Gl))}lookAt(e){const t=UI.copy(this._restHeadWorldQuaternion).multiply(AA(this.getLookAtWorldQuaternion(Hl))),i=this.getLookAtWorldPosition(DI),r=PI.copy(e).sub(i).applyQuaternion(t).normalize(),[s,a]=Ya(this.faceFront),[o,l]=Ya(r),c=Wd(o-s),u=Wd(a-l);this._yaw=Mt.RAD2DEG*c,this._pitch=Mt.RAD2DEG*u,this._needsUpdate=!0}update(e){this.target!=null&&this.autoUpdate&&this.lookAt(this.target.getWorldPosition(LI)),this._needsUpdate&&(this._needsUpdate=!1,this.applier.applyYawPitch(this._yaw,this._pitch))}};_A.EULER_ORDER="YXZ";var FI=_A,OI=new R(0,0,1),In=new He,yr=new He,ln=new jt(0,0,0,"YXZ"),Ka=class{constructor(n,e,t,i,r){this.humanoid=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=r,this.faceFront=new R(0,0,1),this._restQuatLeftEye=new He,this._restQuatRightEye=new He,this._restLeftEyeParentWorldQuat=new He,this._restRightEyeParentWorldQuat=new He;const s=this.humanoid.getRawBoneNode("leftEye"),a=this.humanoid.getRawBoneNode("rightEye");s&&(this._restQuatLeftEye.copy(s.quaternion),zc(s.parent,this._restLeftEyeParentWorldQuat)),a&&(this._restQuatRightEye.copy(a.quaternion),zc(a.parent,this._restRightEyeParentWorldQuat))}applyYawPitch(n,e){const t=this.humanoid.getRawBoneNode("leftEye"),i=this.humanoid.getRawBoneNode("rightEye"),r=this.humanoid.getNormalizedBoneNode("leftEye"),s=this.humanoid.getNormalizedBoneNode("rightEye");t&&(e<0?ln.x=-Mt.DEG2RAD*this.rangeMapVerticalDown.map(-e):ln.x=Mt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?ln.y=-Mt.DEG2RAD*this.rangeMapHorizontalInner.map(-n):ln.y=Mt.DEG2RAD*this.rangeMapHorizontalOuter.map(n),In.setFromEuler(ln),this._getWorldFaceFrontQuat(yr),r.quaternion.copy(yr).multiply(In).multiply(yr.invert()),In.copy(this._restLeftEyeParentWorldQuat),t.quaternion.copy(r.quaternion).multiply(In).premultiply(In.invert()).multiply(this._restQuatLeftEye)),i&&(e<0?ln.x=-Mt.DEG2RAD*this.rangeMapVerticalDown.map(-e):ln.x=Mt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?ln.y=-Mt.DEG2RAD*this.rangeMapHorizontalOuter.map(-n):ln.y=Mt.DEG2RAD*this.rangeMapHorizontalInner.map(n),In.setFromEuler(ln),this._getWorldFaceFrontQuat(yr),s.quaternion.copy(yr).multiply(In).multiply(yr.invert()),In.copy(this._restRightEyeParentWorldQuat),i.quaternion.copy(s.quaternion).multiply(In).premultiply(In.invert()).multiply(this._restQuatRightEye))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=Mt.RAD2DEG*n.y,t=Mt.RAD2DEG*n.x;this.applyYawPitch(e,t)}_getWorldFaceFrontQuat(n){if(this.faceFront.distanceToSquared(OI)<.01)return n.identity();const[e,t]=Ya(this.faceFront);return ln.set(0,.5*Math.PI+e,t,"YZX"),n.setFromEuler(ln)}};Ka.type="bone";var Wc=class{constructor(n,e,t,i,r){this.expressions=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=r}applyYawPitch(n,e){e<0?(this.expressions.setValue("lookDown",0),this.expressions.setValue("lookUp",this.rangeMapVerticalUp.map(-e))):(this.expressions.setValue("lookUp",0),this.expressions.setValue("lookDown",this.rangeMapVerticalDown.map(e))),n<0?(this.expressions.setValue("lookLeft",0),this.expressions.setValue("lookRight",this.rangeMapHorizontalOuter.map(-n))):(this.expressions.setValue("lookRight",0),this.expressions.setValue("lookLeft",this.rangeMapHorizontalOuter.map(n)))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=Mt.RAD2DEG*n.y,t=Mt.RAD2DEG*n.x;this.applyYawPitch(e,t)}};Wc.type="expression";var Xd=class{constructor(n,e){this.inputMaxValue=n,this.outputScale=e}map(n){return this.outputScale*oA(n/this.inputMaxValue)}},kI=new Set(["1.0","1.0-beta"]),ka=.01,QI=class{get name(){return"VRMLookAtLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot}afterRoot(n){return et(this,null,function*(){const e=n.userData.vrmHumanoid;if(e===null)return;if(e===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");const t=n.userData.vrmExpressionManager;if(t!==null){if(t===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first");n.userData.vrmLookAt=yield this._import(n,e,t)}})}_import(n,e,t){return et(this,null,function*(){if(e==null||t==null)return null;const i=yield this._v1Import(n,e,t);if(i)return i;const r=yield this._v0Import(n,e,t);return r||null})}_v1Import(n,e,t){return et(this,null,function*(){var i,r,s;const a=this.parser.json;if(!(((i=a.extensionsUsed)==null?void 0:i.indexOf("VRMC_vrm"))!==-1))return null;const l=(r=a.extensions)==null?void 0:r.VRMC_vrm;if(!l)return null;const c=l.specVersion;if(!kI.has(c))return console.warn(`VRMLookAtLoaderPlugin: Unknown VRMC_vrm specVersion "${c}"`),null;const u=l.lookAt;if(!u)return null;const h=u.type==="expression"?1:10,d=this._v1ImportRangeMap(u.rangeMapHorizontalInner,h),p=this._v1ImportRangeMap(u.rangeMapHorizontalOuter,h),m=this._v1ImportRangeMap(u.rangeMapVerticalDown,h),g=this._v1ImportRangeMap(u.rangeMapVerticalUp,h);let A;u.type==="expression"?A=new Wc(t,d,p,m,g):A=new Ka(e,d,p,m,g);const f=this._importLookAt(e,A);return f.offsetFromHeadBone.fromArray((s=u.offsetFromHeadBone)!=null?s:[0,.06,0]),f})}_v1ImportRangeMap(n,e){var t,i;let r=(t=n==null?void 0:n.inputMaxValue)!=null?t:90;const s=(i=n==null?void 0:n.outputScale)!=null?i:e;return r<ka&&(console.warn("VRMLookAtLoaderPlugin: inputMaxValue of a range map is too small. Consider reviewing the range map!"),r=ka),new Xd(r,s)}_v0Import(n,e,t){return et(this,null,function*(){var i,r,s,a;const l=(i=this.parser.json.extensions)==null?void 0:i.VRM;if(!l)return null;const c=l.firstPerson;if(!c)return null;const u=c.lookAtTypeName==="BlendShape"?1:10,h=this._v0ImportDegreeMap(c.lookAtHorizontalInner,u),d=this._v0ImportDegreeMap(c.lookAtHorizontalOuter,u),p=this._v0ImportDegreeMap(c.lookAtVerticalDown,u),m=this._v0ImportDegreeMap(c.lookAtVerticalUp,u);let g;c.lookAtTypeName==="BlendShape"?g=new Wc(t,h,d,p,m):g=new Ka(e,h,d,p,m);const A=this._importLookAt(e,g);return c.firstPersonBoneOffset?A.offsetFromHeadBone.set((r=c.firstPersonBoneOffset.x)!=null?r:0,(s=c.firstPersonBoneOffset.y)!=null?s:.06,-((a=c.firstPersonBoneOffset.z)!=null?a:0)):A.offsetFromHeadBone.set(0,.06,0),A.faceFront.set(0,0,-1),g instanceof Ka&&g.faceFront.set(0,0,-1),A})}_v0ImportDegreeMap(n,e){var t,i;const r=n==null?void 0:n.curve;JSON.stringify(r)!=="[0,0,0,1,1,1,1,0]"&&console.warn("Curves of LookAtDegreeMap defined in VRM 0.0 are not supported");let s=(t=n==null?void 0:n.xRange)!=null?t:90;const a=(i=n==null?void 0:n.yRange)!=null?i:e;return s<ka&&(console.warn("VRMLookAtLoaderPlugin: xRange of a degree map is too small. Consider reviewing the degree map!"),s=ka),new Xd(s,a)}_importLookAt(n,e){const t=new FI(n,e);if(this.helperRoot){const i=new TI(t);this.helperRoot.add(i),i.renderOrder=this.helperRoot.renderOrder}return t}};function HI(n,e){return typeof n!="string"||n===""?"":(/^https?:\/\//i.test(e)&&/^\//.test(n)&&(e=e.replace(/(^https?:\/\/[^/]+).*/i,"$1")),/^(https?:)?\/\//i.test(n)||/^data:.*,.*$/i.test(n)||/^blob:.*$/i.test(n)?n:e+n)}var GI=new Set(["1.0","1.0-beta"]),VI=class{get name(){return"VRMMetaLoaderPlugin"}constructor(n,e){var t,i,r;this.parser=n,this.needThumbnailImage=(t=e==null?void 0:e.needThumbnailImage)!=null?t:!1,this.acceptLicenseUrls=(i=e==null?void 0:e.acceptLicenseUrls)!=null?i:["https://vrm.dev/licenses/1.0/"],this.acceptV0Meta=(r=e==null?void 0:e.acceptV0Meta)!=null?r:!0}afterRoot(n){return et(this,null,function*(){n.userData.vrmMeta=yield this._import(n)})}_import(n){return et(this,null,function*(){const e=yield this._v1Import(n);if(e!=null)return e;const t=yield this._v0Import(n);return t??null})}_v1Import(n){return et(this,null,function*(){var e,t,i;const r=this.parser.json;if(!(((e=r.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const a=(t=r.extensions)==null?void 0:t.VRMC_vrm;if(a==null)return null;const o=a.specVersion;if(!GI.has(o))return console.warn(`VRMMetaLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const l=a.meta;if(!l)return null;const c=l.licenseUrl;if(!new Set(this.acceptLicenseUrls).has(c))throw new Error(`VRMMetaLoaderPlugin: The license url "${c}" is not accepted`);let h;return this.needThumbnailImage&&l.thumbnailImage!=null&&(h=(i=yield this._extractGLTFImage(l.thumbnailImage))!=null?i:void 0),{metaVersion:"1",name:l.name,version:l.version,authors:l.authors,copyrightInformation:l.copyrightInformation,contactInformation:l.contactInformation,references:l.references,thirdPartyLicenses:l.thirdPartyLicenses,thumbnailImage:h,licenseUrl:l.licenseUrl,avatarPermission:l.avatarPermission,allowExcessivelyViolentUsage:l.allowExcessivelyViolentUsage,allowExcessivelySexualUsage:l.allowExcessivelySexualUsage,commercialUsage:l.commercialUsage,allowPoliticalOrReligiousUsage:l.allowPoliticalOrReligiousUsage,allowAntisocialOrHateUsage:l.allowAntisocialOrHateUsage,creditNotation:l.creditNotation,allowRedistribution:l.allowRedistribution,modification:l.modification,otherLicenseUrl:l.otherLicenseUrl}})}_v0Import(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const r=i.meta;if(!r)return null;if(!this.acceptV0Meta)throw new Error("VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false");let s;return this.needThumbnailImage&&r.texture!=null&&r.texture!==-1&&(s=yield this.parser.getDependency("texture",r.texture)),{metaVersion:"0",allowedUserName:r.allowedUserName,author:r.author,commercialUssageName:r.commercialUssageName,contactInformation:r.contactInformation,licenseName:r.licenseName,otherLicenseUrl:r.otherLicenseUrl,otherPermissionUrl:r.otherPermissionUrl,reference:r.reference,sexualUssageName:r.sexualUssageName,texture:s??void 0,title:r.title,version:r.version,violentUssageName:r.violentUssageName}})}_extractGLTFImage(n){return et(this,null,function*(){var e;const i=(e=this.parser.json.images)==null?void 0:e[n];if(i==null)return console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image doesn't exist`),null;let r=i.uri;if(i.bufferView!=null){const a=yield this.parser.getDependency("bufferView",i.bufferView),o=new Blob([a],{type:i.mimeType});r=URL.createObjectURL(o)}return r==null?(console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image couldn't load properly`),null):yield new dp().loadAsync(HI(r,this.parser.options.path)).catch(a=>(console.error(a),console.warn("VRMMetaLoaderPlugin: Failed to load a thumbnail image"),null))})}},zI=class{constructor(n){this.scene=n.scene,this.meta=n.meta,this.humanoid=n.humanoid,this.expressionManager=n.expressionManager,this.firstPerson=n.firstPerson,this.lookAt=n.lookAt}update(n){this.humanoid.update(),this.lookAt&&this.lookAt.update(n),this.expressionManager&&this.expressionManager.update()}},WI=class extends zI{constructor(n){super(n),this.materials=n.materials,this.springBoneManager=n.springBoneManager,this.nodeConstraintManager=n.nodeConstraintManager}update(n){super.update(n),this.nodeConstraintManager&&this.nodeConstraintManager.update(),this.springBoneManager&&this.springBoneManager.update(n),this.materials&&this.materials.forEach(e=>{e.update&&e.update(n)})}},qI=Object.defineProperty,Yd=Object.getOwnPropertySymbols,jI=Object.prototype.hasOwnProperty,XI=Object.prototype.propertyIsEnumerable,Kd=(n,e,t)=>e in n?qI(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,Jd=(n,e)=>{for(var t in e||(e={}))jI.call(e,t)&&Kd(n,t,e[t]);if(Yd)for(var t of Yd(e))XI.call(e,t)&&Kd(n,t,e[t]);return n},Di=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),YI={"":3e3,srgb:3001};function KI(n,e){parseInt(ki,10)>=152?n.colorSpace=e:n.encoding=YI[e]}var JI=class{get pending(){return Promise.all(this._pendings)}constructor(n,e){this._parser=n,this._materialParams=e,this._pendings=[]}assignPrimitive(n,e){e!=null&&(this._materialParams[n]=e)}assignColor(n,e,t){if(e!=null){const i=new be().fromArray(e);t&&i.convertSRGBToLinear(),this._materialParams[n]=i}}assignTexture(n,e,t){return Di(this,null,function*(){const i=Di(this,null,function*(){if(e!=null){const r=yield this._parser.assignTexture(this._materialParams,n,e);if(r==null){console.warn("GLTFMToonMaterialParamsAssignHelper: Failed to load texture. The rendering result may be wrong");return}t&&KI(r,"srgb")}});return this._pendings.push(i),i})}assignTextureByIndex(n,e,t){return Di(this,null,function*(){return this.assignTexture(n,e!=null?{index:e}:void 0,t)})}},ZI=`// #define PHONG

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

}`,$I=`// #define PHONG

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
`,eS={None:"none"},Zd={None:"none",ScreenCoordinates:"screenCoordinates"},tS={3e3:"",3001:"srgb"};function Vl(n){return parseInt(ki,10)>=152?n.colorSpace:tS[n.encoding]}var nS=class extends Kn{constructor(n={}){var e;super({vertexShader:ZI,fragmentShader:$I}),this.uvAnimationScrollXSpeedFactor=0,this.uvAnimationScrollYSpeedFactor=0,this.uvAnimationRotationSpeedFactor=0,this.fog=!0,this.normalMapType=Co,this._ignoreVertexColor=!0,this._v0CompatShade=!1,this._debugMode=eS.None,this._outlineWidthMode=Zd.None,this._isOutline=!1,n.transparentWithZWrite&&(n.depthWrite=!0),delete n.transparentWithZWrite,n.fog=!0,n.lights=!0,n.clipping=!0,this.uniforms=Zf.merge([oe.common,oe.normalmap,oe.emissivemap,oe.fog,oe.lights,{litFactor:{value:new be(1,1,1)},mapUvTransform:{value:new Le},colorAlpha:{value:1},normalMapUvTransform:{value:new Le},shadeColorFactor:{value:new be(0,0,0)},shadeMultiplyTexture:{value:null},shadeMultiplyTextureUvTransform:{value:new Le},shadingShiftFactor:{value:0},shadingShiftTexture:{value:null},shadingShiftTextureUvTransform:{value:new Le},shadingShiftTextureScale:{value:1},shadingToonyFactor:{value:.9},giEqualizationFactor:{value:.9},matcapFactor:{value:new be(1,1,1)},matcapTexture:{value:null},matcapTextureUvTransform:{value:new Le},parametricRimColorFactor:{value:new be(0,0,0)},rimMultiplyTexture:{value:null},rimMultiplyTextureUvTransform:{value:new Le},rimLightingMixFactor:{value:1},parametricRimFresnelPowerFactor:{value:5},parametricRimLiftFactor:{value:0},emissive:{value:new be(0,0,0)},emissiveIntensity:{value:1},emissiveMapUvTransform:{value:new Le},outlineWidthMultiplyTexture:{value:null},outlineWidthMultiplyTextureUvTransform:{value:new Le},outlineWidthFactor:{value:0},outlineColorFactor:{value:new be(0,0,0)},outlineLightingMixFactor:{value:1},uvAnimationMaskTexture:{value:null},uvAnimationMaskTextureUvTransform:{value:new Le},uvAnimationScrollXOffset:{value:0},uvAnimationScrollYOffset:{value:0},uvAnimationRotationPhase:{value:0}},(e=n.uniforms)!=null?e:{}]),this.setValues(n),this._uploadUniformsWorkaround(),this.customProgramCacheKey=()=>[...Object.entries(this._generateDefines()).map(([t,i])=>`${t}:${i}`),this.matcapTexture?`matcapTextureColorSpace:${Vl(this.matcapTexture)}`:"",this.shadeMultiplyTexture?`shadeMultiplyTextureColorSpace:${Vl(this.shadeMultiplyTexture)}`:"",this.rimMultiplyTexture?`rimMultiplyTextureColorSpace:${Vl(this.rimMultiplyTexture)}`:""].join(","),this.onBeforeCompile=t=>{const i=parseInt(ki,10),r=Object.entries(Jd(Jd({},this._generateDefines()),this.defines)).filter(([s,a])=>!!a).map(([s,a])=>`#define ${s} ${a}`).join(`
`)+`
`;t.vertexShader=r+t.vertexShader,t.fragmentShader=r+t.fragmentShader,i<154&&(t.fragmentShader=t.fragmentShader.replace("#include <colorspace_fragment>","#include <encodings_fragment>"))}}get color(){return this.uniforms.litFactor.value}set color(n){this.uniforms.litFactor.value=n}get map(){return this.uniforms.map.value}set map(n){this.uniforms.map.value=n}get normalMap(){return this.uniforms.normalMap.value}set normalMap(n){this.uniforms.normalMap.value=n}get normalScale(){return this.uniforms.normalScale.value}set normalScale(n){this.uniforms.normalScale.value=n}get emissive(){return this.uniforms.emissive.value}set emissive(n){this.uniforms.emissive.value=n}get emissiveIntensity(){return this.uniforms.emissiveIntensity.value}set emissiveIntensity(n){this.uniforms.emissiveIntensity.value=n}get emissiveMap(){return this.uniforms.emissiveMap.value}set emissiveMap(n){this.uniforms.emissiveMap.value=n}get shadeColorFactor(){return this.uniforms.shadeColorFactor.value}set shadeColorFactor(n){this.uniforms.shadeColorFactor.value=n}get shadeMultiplyTexture(){return this.uniforms.shadeMultiplyTexture.value}set shadeMultiplyTexture(n){this.uniforms.shadeMultiplyTexture.value=n}get shadingShiftFactor(){return this.uniforms.shadingShiftFactor.value}set shadingShiftFactor(n){this.uniforms.shadingShiftFactor.value=n}get shadingShiftTexture(){return this.uniforms.shadingShiftTexture.value}set shadingShiftTexture(n){this.uniforms.shadingShiftTexture.value=n}get shadingShiftTextureScale(){return this.uniforms.shadingShiftTextureScale.value}set shadingShiftTextureScale(n){this.uniforms.shadingShiftTextureScale.value=n}get shadingToonyFactor(){return this.uniforms.shadingToonyFactor.value}set shadingToonyFactor(n){this.uniforms.shadingToonyFactor.value=n}get giEqualizationFactor(){return this.uniforms.giEqualizationFactor.value}set giEqualizationFactor(n){this.uniforms.giEqualizationFactor.value=n}get matcapFactor(){return this.uniforms.matcapFactor.value}set matcapFactor(n){this.uniforms.matcapFactor.value=n}get matcapTexture(){return this.uniforms.matcapTexture.value}set matcapTexture(n){this.uniforms.matcapTexture.value=n}get parametricRimColorFactor(){return this.uniforms.parametricRimColorFactor.value}set parametricRimColorFactor(n){this.uniforms.parametricRimColorFactor.value=n}get rimMultiplyTexture(){return this.uniforms.rimMultiplyTexture.value}set rimMultiplyTexture(n){this.uniforms.rimMultiplyTexture.value=n}get rimLightingMixFactor(){return this.uniforms.rimLightingMixFactor.value}set rimLightingMixFactor(n){this.uniforms.rimLightingMixFactor.value=n}get parametricRimFresnelPowerFactor(){return this.uniforms.parametricRimFresnelPowerFactor.value}set parametricRimFresnelPowerFactor(n){this.uniforms.parametricRimFresnelPowerFactor.value=n}get parametricRimLiftFactor(){return this.uniforms.parametricRimLiftFactor.value}set parametricRimLiftFactor(n){this.uniforms.parametricRimLiftFactor.value=n}get outlineWidthMultiplyTexture(){return this.uniforms.outlineWidthMultiplyTexture.value}set outlineWidthMultiplyTexture(n){this.uniforms.outlineWidthMultiplyTexture.value=n}get outlineWidthFactor(){return this.uniforms.outlineWidthFactor.value}set outlineWidthFactor(n){this.uniforms.outlineWidthFactor.value=n}get outlineColorFactor(){return this.uniforms.outlineColorFactor.value}set outlineColorFactor(n){this.uniforms.outlineColorFactor.value=n}get outlineLightingMixFactor(){return this.uniforms.outlineLightingMixFactor.value}set outlineLightingMixFactor(n){this.uniforms.outlineLightingMixFactor.value=n}get uvAnimationMaskTexture(){return this.uniforms.uvAnimationMaskTexture.value}set uvAnimationMaskTexture(n){this.uniforms.uvAnimationMaskTexture.value=n}get uvAnimationScrollXOffset(){return this.uniforms.uvAnimationScrollXOffset.value}set uvAnimationScrollXOffset(n){this.uniforms.uvAnimationScrollXOffset.value=n}get uvAnimationScrollYOffset(){return this.uniforms.uvAnimationScrollYOffset.value}set uvAnimationScrollYOffset(n){this.uniforms.uvAnimationScrollYOffset.value=n}get uvAnimationRotationPhase(){return this.uniforms.uvAnimationRotationPhase.value}set uvAnimationRotationPhase(n){this.uniforms.uvAnimationRotationPhase.value=n}get ignoreVertexColor(){return this._ignoreVertexColor}set ignoreVertexColor(n){this._ignoreVertexColor=n,this.needsUpdate=!0}get v0CompatShade(){return this._v0CompatShade}set v0CompatShade(n){this._v0CompatShade=n,this.needsUpdate=!0}get debugMode(){return this._debugMode}set debugMode(n){this._debugMode=n,this.needsUpdate=!0}get outlineWidthMode(){return this._outlineWidthMode}set outlineWidthMode(n){this._outlineWidthMode=n,this.needsUpdate=!0}get isOutline(){return this._isOutline}set isOutline(n){this._isOutline=n,this.needsUpdate=!0}get isMToonMaterial(){return!0}update(n){this._uploadUniformsWorkaround(),this._updateUVAnimation(n)}copy(n){return super.copy(n),this.map=n.map,this.normalMap=n.normalMap,this.emissiveMap=n.emissiveMap,this.shadeMultiplyTexture=n.shadeMultiplyTexture,this.shadingShiftTexture=n.shadingShiftTexture,this.matcapTexture=n.matcapTexture,this.rimMultiplyTexture=n.rimMultiplyTexture,this.outlineWidthMultiplyTexture=n.outlineWidthMultiplyTexture,this.uvAnimationMaskTexture=n.uvAnimationMaskTexture,this.normalMapType=n.normalMapType,this.uvAnimationScrollXSpeedFactor=n.uvAnimationScrollXSpeedFactor,this.uvAnimationScrollYSpeedFactor=n.uvAnimationScrollYSpeedFactor,this.uvAnimationRotationSpeedFactor=n.uvAnimationRotationSpeedFactor,this.ignoreVertexColor=n.ignoreVertexColor,this.v0CompatShade=n.v0CompatShade,this.debugMode=n.debugMode,this.outlineWidthMode=n.outlineWidthMode,this.isOutline=n.isOutline,this.needsUpdate=!0,this}_updateUVAnimation(n){this.uniforms.uvAnimationScrollXOffset.value+=n*this.uvAnimationScrollXSpeedFactor,this.uniforms.uvAnimationScrollYOffset.value+=n*this.uvAnimationScrollYSpeedFactor,this.uniforms.uvAnimationRotationPhase.value+=n*this.uvAnimationRotationSpeedFactor,this.uniforms.alphaTest.value=this.alphaTest,this.uniformsNeedUpdate=!0}_uploadUniformsWorkaround(){this.uniforms.opacity.value=this.opacity,this._updateTextureMatrix(this.uniforms.map,this.uniforms.mapUvTransform),this._updateTextureMatrix(this.uniforms.normalMap,this.uniforms.normalMapUvTransform),this._updateTextureMatrix(this.uniforms.emissiveMap,this.uniforms.emissiveMapUvTransform),this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture,this.uniforms.shadeMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.shadingShiftTexture,this.uniforms.shadingShiftTextureUvTransform),this._updateTextureMatrix(this.uniforms.matcapTexture,this.uniforms.matcapTextureUvTransform),this._updateTextureMatrix(this.uniforms.rimMultiplyTexture,this.uniforms.rimMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.outlineWidthMultiplyTexture,this.uniforms.outlineWidthMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture,this.uniforms.uvAnimationMaskTextureUvTransform),this.uniformsNeedUpdate=!0}_generateDefines(){const n=parseInt(ki,10),e=this.outlineWidthMultiplyTexture!==null,t=this.map!==null||this.normalMap!==null||this.emissiveMap!==null||this.shadeMultiplyTexture!==null||this.shadingShiftTexture!==null||this.rimMultiplyTexture!==null||this.uvAnimationMaskTexture!==null;return{THREE_VRM_THREE_REVISION:n,OUTLINE:this._isOutline,MTOON_USE_UV:e||t,MTOON_UVS_VERTEX_ONLY:e&&!t,V0_COMPAT_SHADE:this._v0CompatShade,USE_SHADEMULTIPLYTEXTURE:this.shadeMultiplyTexture!==null,USE_SHADINGSHIFTTEXTURE:this.shadingShiftTexture!==null,USE_MATCAPTEXTURE:this.matcapTexture!==null,USE_RIMMULTIPLYTEXTURE:this.rimMultiplyTexture!==null,USE_OUTLINEWIDTHMULTIPLYTEXTURE:this._isOutline&&this.outlineWidthMultiplyTexture!==null,USE_UVANIMATIONMASKTEXTURE:this.uvAnimationMaskTexture!==null,IGNORE_VERTEX_COLOR:this._ignoreVertexColor===!0,DEBUG_NORMAL:this._debugMode==="normal",DEBUG_LITSHADERATE:this._debugMode==="litShadeRate",DEBUG_UV:this._debugMode==="uv",OUTLINE_WIDTH_SCREEN:this._isOutline&&this._outlineWidthMode===Zd.ScreenCoordinates}}_updateTextureMatrix(n,e){n.value&&(n.value.matrixAutoUpdate&&n.value.updateMatrix(),e.value.copy(n.value.matrix))}},iS=new Set(["1.0","1.0-beta"]),vA=class Ja{get name(){return Ja.EXTENSION_NAME}constructor(e,t={}){var i,r,s,a;this.parser=e,this.materialType=(i=t.materialType)!=null?i:nS,this.renderOrderOffset=(r=t.renderOrderOffset)!=null?r:0,this.v0CompatShade=(s=t.v0CompatShade)!=null?s:!1,this.debugMode=(a=t.debugMode)!=null?a:"none",this._mToonMaterialSet=new Set}beforeRoot(){return Di(this,null,function*(){this._removeUnlitExtensionIfMToonExists()})}afterRoot(e){return Di(this,null,function*(){e.userData.vrmMToonMaterials=Array.from(this._mToonMaterialSet)})}getMaterialType(e){return this._getMToonExtension(e)?this.materialType:null}extendMaterialParams(e,t){const i=this._getMToonExtension(e);return i?this._extendMaterialParams(i,t):null}loadMesh(e){return Di(this,null,function*(){var t;const i=this.parser,s=(t=i.json.meshes)==null?void 0:t[e];if(s==null)throw new Error(`MToonMaterialLoaderPlugin: Attempt to use meshes[${e}] of glTF but the mesh doesn't exist`);const a=s.primitives,o=yield i.loadMesh(e);if(a.length===1){const l=o,c=a[0].material;c!=null&&this._setupPrimitive(l,c)}else{const l=o;for(let c=0;c<a.length;c++){const u=l.children[c],h=a[c].material;h!=null&&this._setupPrimitive(u,h)}}return o})}_removeUnlitExtensionIfMToonExists(){const i=this.parser.json.materials;i==null||i.map((r,s)=>{var a;this._getMToonExtension(s)&&((a=r.extensions)!=null&&a.KHR_materials_unlit)&&delete r.extensions.KHR_materials_unlit})}_getMToonExtension(e){var t,i;const a=(t=this.parser.json.materials)==null?void 0:t[e];if(a==null){console.warn(`MToonMaterialLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const o=(i=a.extensions)==null?void 0:i[Ja.EXTENSION_NAME];if(o==null)return;const l=o.specVersion;if(!iS.has(l)){console.warn(`MToonMaterialLoaderPlugin: Unknown ${Ja.EXTENSION_NAME} specVersion "${l}"`);return}return o}_extendMaterialParams(e,t){return Di(this,null,function*(){var i;delete t.metalness,delete t.roughness;const r=new JI(this.parser,t);r.assignPrimitive("transparentWithZWrite",e.transparentWithZWrite),r.assignColor("shadeColorFactor",e.shadeColorFactor),r.assignTexture("shadeMultiplyTexture",e.shadeMultiplyTexture,!0),r.assignPrimitive("shadingShiftFactor",e.shadingShiftFactor),r.assignTexture("shadingShiftTexture",e.shadingShiftTexture,!0),r.assignPrimitive("shadingShiftTextureScale",(i=e.shadingShiftTexture)==null?void 0:i.scale),r.assignPrimitive("shadingToonyFactor",e.shadingToonyFactor),r.assignPrimitive("giEqualizationFactor",e.giEqualizationFactor),r.assignColor("matcapFactor",e.matcapFactor),r.assignTexture("matcapTexture",e.matcapTexture,!0),r.assignColor("parametricRimColorFactor",e.parametricRimColorFactor),r.assignTexture("rimMultiplyTexture",e.rimMultiplyTexture,!0),r.assignPrimitive("rimLightingMixFactor",e.rimLightingMixFactor),r.assignPrimitive("parametricRimFresnelPowerFactor",e.parametricRimFresnelPowerFactor),r.assignPrimitive("parametricRimLiftFactor",e.parametricRimLiftFactor),r.assignPrimitive("outlineWidthMode",e.outlineWidthMode),r.assignPrimitive("outlineWidthFactor",e.outlineWidthFactor),r.assignTexture("outlineWidthMultiplyTexture",e.outlineWidthMultiplyTexture,!1),r.assignColor("outlineColorFactor",e.outlineColorFactor),r.assignPrimitive("outlineLightingMixFactor",e.outlineLightingMixFactor),r.assignTexture("uvAnimationMaskTexture",e.uvAnimationMaskTexture,!1),r.assignPrimitive("uvAnimationScrollXSpeedFactor",e.uvAnimationScrollXSpeedFactor),r.assignPrimitive("uvAnimationScrollYSpeedFactor",e.uvAnimationScrollYSpeedFactor),r.assignPrimitive("uvAnimationRotationSpeedFactor",e.uvAnimationRotationSpeedFactor),r.assignPrimitive("v0CompatShade",this.v0CompatShade),r.assignPrimitive("debugMode",this.debugMode),yield r.pending})}_setupPrimitive(e,t){const i=this._getMToonExtension(t);if(i){const r=this._parseRenderOrder(i);e.renderOrder=r+this.renderOrderOffset,this._generateOutline(e),this._addToMaterialSet(e);return}}_shouldGenerateOutline(e){return typeof e.outlineWidthMode=="string"&&e.outlineWidthMode!=="none"&&typeof e.outlineWidthFactor=="number"&&e.outlineWidthFactor>0}_generateOutline(e){const t=e.material;if(!(t instanceof nn)||!this._shouldGenerateOutline(t))return;e.material=[t];const i=t.clone();i.name+=" (Outline)",i.isOutline=!0,i.side=qt,e.material.push(i);const r=e.geometry,s=r.index?r.index.count:r.attributes.position.count/3;r.addGroup(0,s,0),r.addGroup(0,s,1)}_addToMaterialSet(e){const t=e.material,i=new Set;Array.isArray(t)?t.forEach(r=>i.add(r)):i.add(t);for(const r of i)this._mToonMaterialSet.add(r)}_parseRenderOrder(e){var t;return(e.transparentWithZWrite?0:19)+((t=e.renderQueueOffsetNumber)!=null?t:0)}};vA.EXTENSION_NAME="VRMC_materials_mtoon";var rS=vA,sS=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),bA=class qc{get name(){return qc.EXTENSION_NAME}constructor(e){this.parser=e}extendMaterialParams(e,t){return sS(this,null,function*(){const i=this._getHDREmissiveMultiplierExtension(e);if(i==null)return;console.warn("VRMMaterialsHDREmissiveMultiplierLoaderPlugin: `VRMC_materials_hdr_emissiveMultiplier` is archived. Use `KHR_materials_emissive_strength` instead.");const r=i.emissiveMultiplier;t.emissiveIntensity=r})}_getHDREmissiveMultiplierExtension(e){var t,i;const a=(t=this.parser.json.materials)==null?void 0:t[e];if(a==null){console.warn(`VRMMaterialsHDREmissiveMultiplierLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const o=(i=a.extensions)==null?void 0:i[qc.EXTENSION_NAME];if(o!=null)return o}};bA.EXTENSION_NAME="VRMC_materials_hdr_emissiveMultiplier";var aS=bA,oS=Object.defineProperty,lS=Object.defineProperties,cS=Object.getOwnPropertyDescriptors,$d=Object.getOwnPropertySymbols,uS=Object.prototype.hasOwnProperty,hS=Object.prototype.propertyIsEnumerable,ef=(n,e,t)=>e in n?oS(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,Sn=(n,e)=>{for(var t in e||(e={}))uS.call(e,t)&&ef(n,t,e[t]);if($d)for(var t of $d(e))hS.call(e,t)&&ef(n,t,e[t]);return n},tf=(n,e)=>lS(n,cS(e)),dS=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())});function Mr(n){return Math.pow(n,2.2)}var fS=class{get name(){return"VRMMaterialsV0CompatPlugin"}constructor(n){var e;this.parser=n,this._renderQueueMapTransparent=new Map,this._renderQueueMapTransparentZWrite=new Map;const t=this.parser.json;t.extensionsUsed=(e=t.extensionsUsed)!=null?e:[],t.extensionsUsed.indexOf("KHR_texture_transform")===-1&&t.extensionsUsed.push("KHR_texture_transform")}beforeRoot(){return dS(this,null,function*(){var n;const e=this.parser.json,t=(n=e.extensions)==null?void 0:n.VRM,i=t==null?void 0:t.materialProperties;i&&(this._populateRenderQueueMap(i),i.forEach((r,s)=>{var a,o;const l=(a=e.materials)==null?void 0:a[s];if(l==null){console.warn(`VRMMaterialsV0CompatPlugin: Attempt to use materials[${s}] of glTF but the material doesn't exist`);return}if(r.shader==="VRM/MToon"){const c=this._parseV0MToonProperties(r,l);e.materials[s]=c}else if((o=r.shader)!=null&&o.startsWith("VRM/Unlit")){const c=this._parseV0UnlitProperties(r,l);e.materials[s]=c}else r.shader==="VRM_USE_GLTFSHADER"||console.warn(`VRMMaterialsV0CompatPlugin: Unknown shader: ${r.shader}`)}))})}_parseV0MToonProperties(n,e){var t,i,r,s,a,o,l,c,u,h,d,p,m,g,A,f,E,v,_,b,M,S,C,I,y,T,N,D,P,k,F,G,H,ee,Z,se,pe,Ue,qe,Ve,Y,J,de,Ie,xe,ze,St,U,at,Ne,Te,_e,ot,Ee,ke;const Et=(i=(t=n.keywordMap)==null?void 0:t._ALPHABLEND_ON)!=null?i:!1,B=((r=n.floatProperties)==null?void 0:r._ZWrite)===1&&Et,x=this._v0ParseRenderQueue(n),L=(a=(s=n.keywordMap)==null?void 0:s._ALPHATEST_ON)!=null?a:!1,Q=Et?"BLEND":L?"MASK":"OPAQUE",j=L?(l=(o=n.floatProperties)==null?void 0:o._Cutoff)!=null?l:.5:void 0,fe=((u=(c=n.floatProperties)==null?void 0:c._CullMode)!=null?u:2)===0,$=this._portTextureTransform(n),me=((d=(h=n.vectorProperties)==null?void 0:h._Color)!=null?d:[1,1,1,1]).map((q,X)=>X===3?q:Mr(q)),Ae=(p=n.textureProperties)==null?void 0:p._MainTex,ie=Ae!=null?{index:Ae,extensions:Sn({},$)}:void 0,ce=(g=(m=n.floatProperties)==null?void 0:m._BumpScale)!=null?g:1,Se=(A=n.textureProperties)==null?void 0:A._BumpMap,ye=Se!=null?{index:Se,scale:ce,extensions:Sn({},$)}:void 0,le=((E=(f=n.vectorProperties)==null?void 0:f._EmissionColor)!=null?E:[0,0,0,1]).map(Mr),Re=(v=n.textureProperties)==null?void 0:v._EmissionMap,O=Re!=null?{index:Re,extensions:Sn({},$)}:void 0,te=((b=(_=n.vectorProperties)==null?void 0:_._ShadeColor)!=null?b:[.97,.81,.86,1]).map(Mr),ae=(M=n.textureProperties)==null?void 0:M._ShadeTexture,ue=ae!=null?{index:ae,extensions:Sn({},$)}:void 0;let ne=(C=(S=n.floatProperties)==null?void 0:S._ShadeShift)!=null?C:0,K=(y=(I=n.floatProperties)==null?void 0:I._ShadeToony)!=null?y:.9;K=Mt.lerp(K,1,.5+.5*ne),ne=-ne-(1-K);const ve=(N=(T=n.floatProperties)==null?void 0:T._IndirectLightIntensity)!=null?N:.1,Qe=ve?1-ve:void 0,it=(D=n.textureProperties)==null?void 0:D._SphereAdd,Ze=it!=null?[1,1,1]:void 0,pn=it!=null?{index:it}:void 0,rn=(k=(P=n.floatProperties)==null?void 0:P._RimLightingMix)!=null?k:0,es=(F=n.textureProperties)==null?void 0:F._RimTexture,Un=es!=null?{index:es,extensions:Sn({},$)}:void 0,ts=((H=(G=n.vectorProperties)==null?void 0:G._RimColor)!=null?H:[0,0,0,1]).map(Mr),ea=(Z=(ee=n.floatProperties)==null?void 0:ee._RimFresnelPower)!=null?Z:1,ta=(pe=(se=n.floatProperties)==null?void 0:se._RimLift)!=null?pe:0,Ki=["none","worldCoordinates","screenCoordinates"][(qe=(Ue=n.floatProperties)==null?void 0:Ue._OutlineWidthMode)!=null?qe:0];let Ji=(Y=(Ve=n.floatProperties)==null?void 0:Ve._OutlineWidth)!=null?Y:0;Ji=.01*Ji;const ci=(J=n.textureProperties)==null?void 0:J._OutlineWidthTexture,na=ci!=null?{index:ci,extensions:Sn({},$)}:void 0,ia=((Ie=(de=n.vectorProperties)==null?void 0:de._OutlineColor)!=null?Ie:[0,0,0]).map(Mr),ko=((ze=(xe=n.floatProperties)==null?void 0:xe._OutlineColorMode)!=null?ze:0)===1?(U=(St=n.floatProperties)==null?void 0:St._OutlineLightingMix)!=null?U:1:0,ra=(at=n.textureProperties)==null?void 0:at._UvAnimMaskTexture,Qo=ra!=null?{index:ra,extensions:Sn({},$)}:void 0,Ho=(Te=(Ne=n.floatProperties)==null?void 0:Ne._UvAnimScrollX)!=null?Te:0;let Zi=(ot=(_e=n.floatProperties)==null?void 0:_e._UvAnimScrollY)!=null?ot:0;Zi!=null&&(Zi=-Zi);const w=(ke=(Ee=n.floatProperties)==null?void 0:Ee._UvAnimRotation)!=null?ke:0,V={specVersion:"1.0",transparentWithZWrite:B,renderQueueOffsetNumber:x,shadeColorFactor:te,shadeMultiplyTexture:ue,shadingShiftFactor:ne,shadingToonyFactor:K,giEqualizationFactor:Qe,matcapFactor:Ze,matcapTexture:pn,rimLightingMixFactor:rn,rimMultiplyTexture:Un,parametricRimColorFactor:ts,parametricRimFresnelPowerFactor:ea,parametricRimLiftFactor:ta,outlineWidthMode:Ki,outlineWidthFactor:Ji,outlineWidthMultiplyTexture:na,outlineColorFactor:ia,outlineLightingMixFactor:ko,uvAnimationMaskTexture:Qo,uvAnimationScrollXSpeedFactor:Ho,uvAnimationScrollYSpeedFactor:Zi,uvAnimationRotationSpeedFactor:w};return tf(Sn({},e),{pbrMetallicRoughness:{baseColorFactor:me,baseColorTexture:ie},normalTexture:ye,emissiveTexture:O,emissiveFactor:le,alphaMode:Q,alphaCutoff:j,doubleSided:fe,extensions:{VRMC_materials_mtoon:V}})}_parseV0UnlitProperties(n,e){var t,i,r,s,a;const o=n.shader==="VRM/UnlitTransparentZWrite",l=n.shader==="VRM/UnlitTransparent"||o,c=this._v0ParseRenderQueue(n),u=n.shader==="VRM/UnlitCutout",h=l?"BLEND":u?"MASK":"OPAQUE",d=u?(i=(t=n.floatProperties)==null?void 0:t._Cutoff)!=null?i:.5:void 0,p=this._portTextureTransform(n),m=((s=(r=n.vectorProperties)==null?void 0:r._Color)!=null?s:[1,1,1,1]).map(Mr),g=(a=n.textureProperties)==null?void 0:a._MainTex,A=g!=null?{index:g,extensions:Sn({},p)}:void 0,f={specVersion:"1.0",transparentWithZWrite:o,renderQueueOffsetNumber:c,shadeColorFactor:m,shadeMultiplyTexture:A};return tf(Sn({},e),{pbrMetallicRoughness:{baseColorFactor:m,baseColorTexture:A},alphaMode:h,alphaCutoff:d,extensions:{VRMC_materials_mtoon:f}})}_portTextureTransform(n){var e,t,i,r,s;const a=(e=n.vectorProperties)==null?void 0:e._MainTex;if(a==null)return{};const o=[(t=a==null?void 0:a[0])!=null?t:0,(i=a==null?void 0:a[1])!=null?i:0],l=[(r=a==null?void 0:a[2])!=null?r:1,(s=a==null?void 0:a[3])!=null?s:1];return o[1]=1-l[1]-o[1],{KHR_texture_transform:{offset:o,scale:l}}}_v0ParseRenderQueue(n){var e,t;const i=n.shader==="VRM/UnlitTransparentZWrite",r=((e=n.keywordMap)==null?void 0:e._ALPHABLEND_ON)!=null||n.shader==="VRM/UnlitTransparent"||i,s=((t=n.floatProperties)==null?void 0:t._ZWrite)===1||i;let a=0;if(r){const o=n.renderQueue;o!=null&&(s?a=this._renderQueueMapTransparentZWrite.get(o):a=this._renderQueueMapTransparent.get(o))}return a}_populateRenderQueueMap(n){const e=new Set,t=new Set;n.forEach(i=>{var r,s;const a=i.shader==="VRM/UnlitTransparentZWrite",o=((r=i.keywordMap)==null?void 0:r._ALPHABLEND_ON)!=null||i.shader==="VRM/UnlitTransparent"||a,l=((s=i.floatProperties)==null?void 0:s._ZWrite)===1||a;if(o){const c=i.renderQueue;c!=null&&(l?t.add(c):e.add(c))}}),e.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${e.size} render queues for Transparent materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),t.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${t.size} render queues for TransparentZWrite materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),Array.from(e).sort().forEach((i,r)=>{const s=Math.min(Math.max(r-e.size+1,-9),0);this._renderQueueMapTransparent.set(i,s)}),Array.from(t).sort().forEach((i,r)=>{const s=Math.min(Math.max(r,0),9);this._renderQueueMapTransparentZWrite.set(i,s)})}},nf=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),ri=new R,zl=class extends gt{constructor(n){super(),this._attrPosition=new tt(new Float32Array([0,0,0,0,0,0]),3),this._attrPosition.setUsage(y_);const e=new dt;e.setAttribute("position",this._attrPosition);const t=new Xi({color:16711935,depthTest:!1,depthWrite:!1});this._line=new Ro(e,t),this.add(this._line),this.constraint=n}updateMatrixWorld(n){ri.setFromMatrixPosition(this.constraint.destination.matrixWorld),this._attrPosition.setXYZ(0,ri.x,ri.y,ri.z),this.constraint.source&&ri.setFromMatrixPosition(this.constraint.source.matrixWorld),this._attrPosition.setXYZ(1,ri.x,ri.y,ri.z),this._attrPosition.needsUpdate=!0,super.updateMatrixWorld(n)}};function rf(n,e){return e.set(n.elements[12],n.elements[13],n.elements[14])}var pS=new R,AS=new R;function mS(n,e){return n.decompose(pS,e,AS),e}function bo(n){return n.invert?n.invert():n.inverse(),n}var Su=class{constructor(n,e){this.destination=n,this.source=e,this.weight=1}},gS=new R,_S=new R,ES=new R,vS=new He,bS=new He,xS=new He,yS=class extends Su{get aimAxis(){return this._aimAxis}set aimAxis(n){this._aimAxis=n,this._v3AimAxis.set(n==="PositiveX"?1:n==="NegativeX"?-1:0,n==="PositiveY"?1:n==="NegativeY"?-1:0,n==="PositiveZ"?1:n==="NegativeZ"?-1:0)}get dependencies(){const n=new Set([this.source]);return this.destination.parent&&n.add(this.destination.parent),n}constructor(n,e){super(n,e),this._aimAxis="PositiveX",this._v3AimAxis=new R(1,0,0),this._dstRestQuat=new He}setInitState(){this._dstRestQuat.copy(this.destination.quaternion)}update(){this.destination.updateWorldMatrix(!0,!1),this.source.updateWorldMatrix(!0,!1);const n=vS.identity(),e=bS.identity();this.destination.parent&&(mS(this.destination.parent.matrixWorld,n),bo(e.copy(n)));const t=gS.copy(this._v3AimAxis).applyQuaternion(this._dstRestQuat).applyQuaternion(n),i=rf(this.source.matrixWorld,_S).sub(rf(this.destination.matrixWorld,ES)).normalize(),r=xS.setFromUnitVectors(t,i).premultiply(e).multiply(n).multiply(this._dstRestQuat);this.destination.quaternion.copy(this._dstRestQuat).slerp(r,this.weight)}};function MS(n,e){const t=[n];let i=n.parent;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(r=>{e(r)})}var IS=class{constructor(){this._constraints=new Set,this._objectConstraintsMap=new Map}get constraints(){return this._constraints}addConstraint(n){this._constraints.add(n);let e=this._objectConstraintsMap.get(n.destination);e==null&&(e=new Set,this._objectConstraintsMap.set(n.destination,e)),e.add(n)}deleteConstraint(n){this._constraints.delete(n),this._objectConstraintsMap.get(n.destination).delete(n)}setInitState(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.setInitState())}update(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.update())}_processConstraint(n,e,t,i){if(t.has(n))return;if(e.has(n))throw new Error("VRMNodeConstraintManager: Circular dependency detected while updating constraints");e.add(n);const r=n.dependencies;for(const s of r)MS(s,a=>{const o=this._objectConstraintsMap.get(a);if(o)for(const l of o)this._processConstraint(l,e,t,i)});i(n),t.add(n)}},SS=new He,CS=new He,wS=class extends Su{get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._dstRestQuat=new He,this._invSrcRestQuat=new He}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),bo(this._invSrcRestQuat.copy(this.source.quaternion))}update(){const n=SS.copy(this._invSrcRestQuat).multiply(this.source.quaternion),e=CS.copy(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(e,this.weight)}},TS=new R,RS=new He,BS=new He,LS=class extends Su{get rollAxis(){return this._rollAxis}set rollAxis(n){this._rollAxis=n,this._v3RollAxis.set(n==="X"?1:0,n==="Y"?1:0,n==="Z"?1:0)}get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._rollAxis="X",this._v3RollAxis=new R(1,0,0),this._dstRestQuat=new He,this._invDstRestQuat=new He,this._invSrcRestQuatMulDstRestQuat=new He}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),bo(this._invDstRestQuat.copy(this._dstRestQuat)),bo(this._invSrcRestQuatMulDstRestQuat.copy(this.source.quaternion)).multiply(this._dstRestQuat)}update(){const n=RS.copy(this._invDstRestQuat).multiply(this.source.quaternion).multiply(this._invSrcRestQuatMulDstRestQuat),e=TS.copy(this._v3RollAxis).applyQuaternion(n),i=BS.setFromUnitVectors(e,this._v3RollAxis).premultiply(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(i,this.weight)}},DS=new Set(["1.0","1.0-beta"]),xA=class Rs{get name(){return Rs.EXTENSION_NAME}constructor(e,t){this.parser=e,this.helperRoot=t==null?void 0:t.helperRoot}afterRoot(e){return nf(this,null,function*(){e.userData.vrmNodeConstraintManager=yield this._import(e)})}_import(e){return nf(this,null,function*(){var t;const i=this.parser.json;if(!(((t=i.extensionsUsed)==null?void 0:t.indexOf(Rs.EXTENSION_NAME))!==-1))return null;const s=new IS,a=yield this.parser.getDependencies("node");return a.forEach((o,l)=>{var c;const u=i.nodes[l],h=(c=u==null?void 0:u.extensions)==null?void 0:c[Rs.EXTENSION_NAME];if(h==null)return;const d=h.specVersion;if(!DS.has(d)){console.warn(`VRMNodeConstraintLoaderPlugin: Unknown ${Rs.EXTENSION_NAME} specVersion "${d}"`);return}const p=h.constraint;if(p.roll!=null){const m=this._importRollConstraint(o,a,p.roll);s.addConstraint(m)}else if(p.aim!=null){const m=this._importAimConstraint(o,a,p.aim);s.addConstraint(m)}else if(p.rotation!=null){const m=this._importRotationConstraint(o,a,p.rotation);s.addConstraint(m)}}),e.scene.updateMatrixWorld(),s.setInitState(),s})}_importRollConstraint(e,t,i){const{source:r,rollAxis:s,weight:a}=i,o=t[r],l=new LS(e,o);if(s!=null&&(l.rollAxis=s),a!=null&&(l.weight=a),this.helperRoot){const c=new zl(l);this.helperRoot.add(c)}return l}_importAimConstraint(e,t,i){const{source:r,aimAxis:s,weight:a}=i,o=t[r],l=new yS(e,o);if(s!=null&&(l.aimAxis=s),a!=null&&(l.weight=a),this.helperRoot){const c=new zl(l);this.helperRoot.add(c)}return l}_importRotationConstraint(e,t,i){const{source:r,weight:s}=i,a=t[r],o=new wS(e,a);if(s!=null&&(o.weight=s),this.helperRoot){const l=new zl(o);this.helperRoot.add(l)}return o}};xA.EXTENSION_NAME="VRMC_node_constraint";var PS=xA,Qa=(n,e,t)=>new Promise((i,r)=>{var s=l=>{try{o(t.next(l))}catch(c){r(c)}},a=l=>{try{o(t.throw(l))}catch(c){r(c)}},o=l=>l.done?i(l.value):Promise.resolve(l.value).then(s,a);o((t=t.apply(n,e)).next())}),Cu=class{},Wl=new R,Mi=new R,yA=class extends Cu{get type(){return"capsule"}constructor(n){var e,t,i,r;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.tail=(t=n==null?void 0:n.tail)!=null?t:new R(0,0,0),this.radius=(i=n==null?void 0:n.radius)!=null?i:0,this.inside=(r=n==null?void 0:n.inside)!=null?r:!1}calculateCollision(n,e,t,i){Wl.setFromMatrixPosition(n),Mi.subVectors(this.tail,this.offset).applyMatrix4(n),Mi.sub(Wl);const r=Mi.lengthSq();i.copy(e).sub(Wl);const s=Mi.dot(i);s<=0||(r<=s||Mi.multiplyScalar(s/r),i.sub(Mi));const a=i.length(),o=this.inside?this.radius-t-a:a-t-this.radius;return o<0&&(i.multiplyScalar(1/a),this.inside&&i.negate()),o}},ql=new R,sf=new Le,MA=class extends Cu{get type(){return"plane"}constructor(n){var e,t;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.normal=(t=n==null?void 0:n.normal)!=null?t:new R(0,0,1)}calculateCollision(n,e,t,i){i.setFromMatrixPosition(n),i.negate().add(e),sf.getNormalMatrix(n),ql.copy(this.normal).applyNormalMatrix(sf).normalize();const r=i.dot(ql)-t;return i.copy(ql),r}},US=new R,IA=class extends Cu{get type(){return"sphere"}constructor(n){var e,t,i;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new R(0,0,0),this.radius=(t=n==null?void 0:n.radius)!=null?t:0,this.inside=(i=n==null?void 0:n.inside)!=null?i:!1}calculateCollision(n,e,t,i){i.subVectors(e,US.setFromMatrixPosition(n));const r=i.length(),s=this.inside?this.radius-t-r:r-t-this.radius;return s<0&&(i.multiplyScalar(1/r),this.inside&&i.negate()),s}},Cn=new R,NS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new R,this._currentTail=new R,this._shape=n,this._attrPos=new tt(new Float32Array(396),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(264),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0);const t=Cn.copy(this._shape.tail).divideScalar(this.worldScale);this._currentTail.distanceToSquared(t)>1e-10&&(this._currentTail.copy(t),n=!0),n&&this._buildPosition()}_buildPosition(){Cn.copy(this._currentTail).sub(this._currentOffset);const n=Cn.length()/this._currentRadius;for(let i=0;i<=16;i++){const r=i/16*Math.PI;this._attrPos.setXYZ(i,-Math.sin(r),-Math.cos(r),0),this._attrPos.setXYZ(17+i,n+Math.sin(r),Math.cos(r),0),this._attrPos.setXYZ(34+i,-Math.sin(r),0,-Math.cos(r)),this._attrPos.setXYZ(51+i,n+Math.sin(r),0,Math.cos(r))}for(let i=0;i<32;i++){const r=i/16*Math.PI;this._attrPos.setXYZ(68+i,0,Math.sin(r),Math.cos(r)),this._attrPos.setXYZ(100+i,n,Math.sin(r),Math.cos(r))}const e=Math.atan2(Cn.y,Math.sqrt(Cn.x*Cn.x+Cn.z*Cn.z)),t=-Math.atan2(Cn.z,Cn.x);this.rotateZ(e),this.rotateY(t),this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<34;n++){const e=(n+1)%34;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(68+n*2,34+n,34+e)}for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(136+n*2,68+n,68+e),this._attrIndex.setXY(200+n*2,100+n,100+e)}this._attrIndex.needsUpdate=!0}},FS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentOffset=new R,this._currentNormal=new R,this._shape=n,this._attrPos=new tt(new Float32Array(18),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(10),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),this._currentNormal.equals(this._shape.normal)||(this._currentNormal.copy(this._shape.normal),n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,-.5,-.5,0),this._attrPos.setXYZ(1,.5,-.5,0),this._attrPos.setXYZ(2,.5,.5,0),this._attrPos.setXYZ(3,-.5,.5,0),this._attrPos.setXYZ(4,0,0,0),this._attrPos.setXYZ(5,0,0,.25),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this.lookAt(this._currentNormal),this._attrPos.needsUpdate=!0}_buildIndex(){this._attrIndex.setXY(0,0,1),this._attrIndex.setXY(2,1,2),this._attrIndex.setXY(4,2,3),this._attrIndex.setXY(6,3,0),this._attrIndex.setXY(8,4,5),this._attrIndex.needsUpdate=!0}},OS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new R,this._shape=n,this._attrPos=new tt(new Float32Array(288),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(192),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.needsUpdate=!0}},kS=new R,jl=class extends gt{constructor(n){if(super(),this.matrixAutoUpdate=!1,this.collider=n,this.collider.shape instanceof IA)this._geometry=new OS(this.collider.shape);else if(this.collider.shape instanceof yA)this._geometry=new NS(this.collider.shape);else if(this.collider.shape instanceof MA)this._geometry=new FS(this.collider.shape);else throw new Error("VRMSpringBoneColliderHelper: Unknown collider shape type detected");const e=new Xi({color:16711935,depthTest:!1,depthWrite:!1});this._line=new Zs(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.collider.updateWorldMatrix(!0,!1),this.matrix.copy(this.collider.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=kS.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},QS=class extends dt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentTail=new R,this._springBone=n,this._attrPos=new tt(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new tt(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._springBone.settings.hitRadius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentTail.equals(this._springBone.initialLocalChildPosition)||(this._currentTail.copy(this._springBone.initialLocalChildPosition),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},HS=new R,GS=class extends gt{constructor(n){super(),this.matrixAutoUpdate=!1,this.springBone=n,this._geometry=new QS(this.springBone);const e=new Xi({color:16776960,depthTest:!1,depthWrite:!1});this._line=new Zs(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.springBone.bone.updateWorldMatrix(!0,!1),this.matrix.copy(this.springBone.bone.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=HS.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},Xl=class extends ct{constructor(n){super(),this.colliderMatrix=new De,this.shape=n}updateWorldMatrix(n,e){super.updateWorldMatrix(n,e),VS(this.colliderMatrix,this.matrixWorld,this.shape.offset)}};function VS(n,e,t){const i=e.elements;n.copy(e),t&&(n.elements[12]=i[0]*t.x+i[4]*t.y+i[8]*t.z+i[12],n.elements[13]=i[1]*t.x+i[5]*t.y+i[9]*t.z+i[13],n.elements[14]=i[2]*t.x+i[6]*t.y+i[10]*t.z+i[14])}var zS=new De;function WS(n){return n.invert?n.invert():n.getInverse(zS.copy(n)),n}var qS=class{constructor(n){this._inverseCache=new De,this._shouldUpdateInverse=!0,this.matrix=n;const e={set:(t,i,r)=>(this._shouldUpdateInverse=!0,t[i]=r,!0)};this._originalElements=n.elements,n.elements=new Proxy(n.elements,e)}get inverse(){return this._shouldUpdateInverse&&(WS(this._inverseCache.copy(this.matrix)),this._shouldUpdateInverse=!1),this._inverseCache}revert(){this.matrix.elements=this._originalElements}},Yl=new De,Ir=new R,xs=new R,ys=new R,Ms=new R,jS=new De,XS=class{constructor(n,e,t={},i=[]){this._currentTail=new R,this._prevTail=new R,this._boneAxis=new R,this._worldSpaceBoneLength=0,this._center=null,this._initialLocalMatrix=new De,this._initialLocalRotation=new He,this._initialLocalChildPosition=new R;var r,s,a,o,l,c;this.bone=n,this.bone.matrixAutoUpdate=!1,this.child=e,this.settings={hitRadius:(r=t.hitRadius)!=null?r:0,stiffness:(s=t.stiffness)!=null?s:1,gravityPower:(a=t.gravityPower)!=null?a:0,gravityDir:(l=(o=t.gravityDir)==null?void 0:o.clone())!=null?l:new R(0,-1,0),dragForce:(c=t.dragForce)!=null?c:.4},this.colliderGroups=i}get dependencies(){const n=new Set,e=this.bone.parent;e&&n.add(e);for(let t=0;t<this.colliderGroups.length;t++)for(let i=0;i<this.colliderGroups[t].colliders.length;i++)n.add(this.colliderGroups[t].colliders[i]);return n}get center(){return this._center}set center(n){var e;(e=this._center)!=null&&e.userData.inverseCacheProxy&&(this._center.userData.inverseCacheProxy.revert(),delete this._center.userData.inverseCacheProxy),this._center=n,this._center&&(this._center.userData.inverseCacheProxy||(this._center.userData.inverseCacheProxy=new qS(this._center.matrixWorld)))}get initialLocalChildPosition(){return this._initialLocalChildPosition}get _parentMatrixWorld(){return this.bone.parent?this.bone.parent.matrixWorld:Yl}setInitState(){this._initialLocalMatrix.copy(this.bone.matrix),this._initialLocalRotation.copy(this.bone.quaternion),this.child?this._initialLocalChildPosition.copy(this.child.position):this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(.07);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail),this._boneAxis.copy(this._initialLocalChildPosition).normalize()}reset(){this.bone.quaternion.copy(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail)}update(n){if(n<=0)return;this._calcWorldSpaceBoneLength();const e=xs.copy(this._boneAxis).transformDirection(this._initialLocalMatrix).transformDirection(this._parentMatrixWorld);Ms.copy(this._currentTail).add(Ir.subVectors(this._currentTail,this._prevTail).multiplyScalar(1-this.settings.dragForce)).applyMatrix4(this._getMatrixCenterToWorld()).addScaledVector(e,this.settings.stiffness*n).addScaledVector(this.settings.gravityDir,this.settings.gravityPower*n),ys.setFromMatrixPosition(this.bone.matrixWorld),Ms.sub(ys).normalize().multiplyScalar(this._worldSpaceBoneLength).add(ys),this._collision(Ms),this._prevTail.copy(this._currentTail),this._currentTail.copy(Ms).applyMatrix4(this._getMatrixWorldToCenter());const t=jS.multiplyMatrices(this._parentMatrixWorld,this._initialLocalMatrix).invert();this.bone.quaternion.setFromUnitVectors(this._boneAxis,Ir.copy(Ms).applyMatrix4(t).normalize()).premultiply(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix)}_collision(n){for(let e=0;e<this.colliderGroups.length;e++)for(let t=0;t<this.colliderGroups[e].colliders.length;t++){const i=this.colliderGroups[e].colliders[t],r=i.shape.calculateCollision(i.colliderMatrix,n,this.settings.hitRadius,Ir);if(r<0){n.addScaledVector(Ir,-r),n.sub(ys);const s=n.length();n.multiplyScalar(this._worldSpaceBoneLength/s).add(ys)}}}_calcWorldSpaceBoneLength(){Ir.setFromMatrixPosition(this.bone.matrixWorld),this.child?xs.setFromMatrixPosition(this.child.matrixWorld):(xs.copy(this._initialLocalChildPosition),xs.applyMatrix4(this.bone.matrixWorld)),this._worldSpaceBoneLength=Ir.sub(xs).length()}_getMatrixCenterToWorld(){return this._center?this._center.matrixWorld:Yl}_getMatrixWorldToCenter(){return this._center?this._center.userData.inverseCacheProxy.inverse:Yl}};function YS(n,e){const t=[];let i=n;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(r=>{e(r)})}function jc(n,e){n.children.forEach(t=>{e(t)||jc(t,e)})}function KS(n){var e;const t=new Map;for(const i of n){let r=i;do{const s=((e=t.get(r))!=null?e:0)+1;if(s===n.size)return r;t.set(r,s),r=r.parent}while(r!==null)}return null}var af=class{constructor(){this._joints=new Set,this._sortedJoints=[],this._hasWarnedCircularDependency=!1,this._ancestors=[],this._objectSpringBonesMap=new Map,this._isSortedJointsDirty=!1,this._relevantChildrenUpdated=this._relevantChildrenUpdated.bind(this)}get joints(){return this._joints}get springBones(){return console.warn("VRMSpringBoneManager: springBones is deprecated. use joints instead."),this._joints}get colliderGroups(){const n=new Set;return this._joints.forEach(e=>{e.colliderGroups.forEach(t=>{n.add(t)})}),Array.from(n)}get colliders(){const n=new Set;return this.colliderGroups.forEach(e=>{e.colliders.forEach(t=>{n.add(t)})}),Array.from(n)}addJoint(n){this._joints.add(n);let e=this._objectSpringBonesMap.get(n.bone);e==null&&(e=new Set,this._objectSpringBonesMap.set(n.bone,e)),e.add(n),this._isSortedJointsDirty=!0}addSpringBone(n){console.warn("VRMSpringBoneManager: addSpringBone() is deprecated. use addJoint() instead."),this.addJoint(n)}deleteJoint(n){this._joints.delete(n),this._objectSpringBonesMap.get(n.bone).delete(n),this._isSortedJointsDirty=!0}deleteSpringBone(n){console.warn("VRMSpringBoneManager: deleteSpringBone() is deprecated. use deleteJoint() instead."),this.deleteJoint(n)}setInitState(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.setInitState()}}reset(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.reset()}}update(n){this._sortJoints();for(let e=0;e<this._ancestors.length;e++)this._ancestors[e].updateWorldMatrix(e===0,!1);for(let e=0;e<this._sortedJoints.length;e++){const t=this._sortedJoints[e];t.bone.updateMatrix(),t.bone.updateWorldMatrix(!1,!1),t.update(n),jc(t.bone,this._relevantChildrenUpdated)}}_sortJoints(){if(!this._isSortedJointsDirty)return;const n=[],e=new Set,t=new Set,i=new Set;for(const s of this._joints)this._insertJointSort(s,e,t,n,i);this._sortedJoints=n;const r=KS(i);this._ancestors=[],r&&(this._ancestors.push(r),jc(r,s=>{var a,o;return((o=(a=this._objectSpringBonesMap.get(s))==null?void 0:a.size)!=null?o:0)>0?!0:(this._ancestors.push(s),!1)})),this._isSortedJointsDirty=!1}_insertJointSort(n,e,t,i,r){if(t.has(n))return;if(e.has(n)){this._hasWarnedCircularDependency||(console.warn("VRMSpringBoneManager: Circular dependency detected"),this._hasWarnedCircularDependency=!0);return}e.add(n);const s=n.dependencies;for(const a of s){let o=!1,l=null;YS(a,c=>{const u=this._objectSpringBonesMap.get(c);if(u)for(const h of u)o=!0,this._insertJointSort(h,e,t,i,r);else o||(l=c)}),l&&r.add(l)}i.push(n),t.add(n)}_relevantChildrenUpdated(n){var e,t;return((t=(e=this._objectSpringBonesMap.get(n))==null?void 0:e.size)!=null?t:0)>0?!0:(n.updateWorldMatrix(!1,!1),!1)}},of="VRMC_springBone_extended_collider",JS=new Set(["1.0","1.0-beta"]),ZS=new Set(["1.0"]),SA=class Cr{get name(){return Cr.EXTENSION_NAME}constructor(e,t){var i;this.parser=e,this.jointHelperRoot=t==null?void 0:t.jointHelperRoot,this.colliderHelperRoot=t==null?void 0:t.colliderHelperRoot,this.useExtendedColliders=(i=t==null?void 0:t.useExtendedColliders)!=null?i:!0}afterRoot(e){return Qa(this,null,function*(){e.userData.vrmSpringBoneManager=yield this._import(e)})}_import(e){return Qa(this,null,function*(){const t=yield this._v1Import(e);if(t!=null)return t;const i=yield this._v0Import(e);return i??null})}_v1Import(e){return Qa(this,null,function*(){var t,i,r,s,a;const o=e.parser.json;if(!(((t=o.extensionsUsed)==null?void 0:t.indexOf(Cr.EXTENSION_NAME))!==-1))return null;const c=new af,u=yield e.parser.getDependencies("node"),h=(i=o.extensions)==null?void 0:i[Cr.EXTENSION_NAME];if(!h)return null;const d=h.specVersion;if(!JS.has(d))return console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${Cr.EXTENSION_NAME} specVersion "${d}"`),null;const p=(r=h.colliders)==null?void 0:r.map((g,A)=>{var f,E,v,_,b,M,S,C,I,y,T,N,D,P,k;const F=u[g.node];if(F==null)return console.warn(`VRMSpringBoneLoaderPlugin: The collider #${A} attempted to reference a node #${g.node} but not found. Skipping the collider`),null;const G=g.shape,H=(f=g.extensions)==null?void 0:f[of];if(this.useExtendedColliders&&H!=null){const ee=H.specVersion;if(!ZS.has(ee))console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${of} specVersion "${ee}". Fallbacking to the ${Cr.EXTENSION_NAME} definition`);else{const Z=H.shape;if(Z.sphere)return this._importSphereCollider(F,{offset:new R().fromArray((E=Z.sphere.offset)!=null?E:[0,0,0]),radius:(v=Z.sphere.radius)!=null?v:0,inside:(_=Z.sphere.inside)!=null?_:!1});if(Z.capsule)return this._importCapsuleCollider(F,{offset:new R().fromArray((b=Z.capsule.offset)!=null?b:[0,0,0]),radius:(M=Z.capsule.radius)!=null?M:0,tail:new R().fromArray((S=Z.capsule.tail)!=null?S:[0,0,0]),inside:(C=Z.capsule.inside)!=null?C:!1});if(Z.plane)return this._importPlaneCollider(F,{offset:new R().fromArray((I=Z.plane.offset)!=null?I:[0,0,0]),normal:new R().fromArray((y=Z.plane.normal)!=null?y:[0,0,1])})}}if(G.sphere)return this._importSphereCollider(F,{offset:new R().fromArray((T=G.sphere.offset)!=null?T:[0,0,0]),radius:(N=G.sphere.radius)!=null?N:0,inside:!1});if(G.capsule)return this._importCapsuleCollider(F,{offset:new R().fromArray((D=G.capsule.offset)!=null?D:[0,0,0]),radius:(P=G.capsule.radius)!=null?P:0,tail:new R().fromArray((k=G.capsule.tail)!=null?k:[0,0,0]),inside:!1});console.warn(`VRMSpringBoneLoaderPlugin: The collider #${A} has no valid shape. Skipping the collider`)}),m=(s=h.colliderGroups)==null?void 0:s.map((g,A)=>{var f;return{colliders:((f=g.colliders)!=null?f:[]).map(v=>{const _=p==null?void 0:p[v];return _??(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${A} attempted to reference a collider #${v} but not found. Skipping the collider`),null)}).filter(v=>v!=null),name:g.name}});return(a=h.springs)==null||a.forEach((g,A)=>{var f;const E=g.joints,v=(f=g.colliderGroups)==null?void 0:f.map(M=>{const S=m==null?void 0:m[M];return S??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${A} attempted to reference a collider group #${M} but not found. Skipping the collider group`),null)}).filter(M=>M!=null),_=g.center!=null?u[g.center]:void 0;let b;E.forEach(M=>{if(b){const S=b.node,C=u[S],I=M.node,y=u[I],T={hitRadius:b.hitRadius,dragForce:b.dragForce,gravityPower:b.gravityPower,stiffness:b.stiffness,gravityDir:b.gravityDir!=null?new R().fromArray(b.gravityDir):void 0},N=this._importJoint(C,y,T,v);_&&(N.center=_),c.addJoint(N)}b=M})}),c.setInitState(),c})}_v0Import(e){return Qa(this,null,function*(){var t,i,r;const s=e.parser.json;if(!(((t=s.extensionsUsed)==null?void 0:t.indexOf("VRM"))!==-1))return null;const o=(i=s.extensions)==null?void 0:i.VRM,l=o==null?void 0:o.secondaryAnimation;if(!l)return null;const c=l==null?void 0:l.boneGroups;if(!c)return null;const u=new af,h=yield e.parser.getDependencies("node"),d=(r=l.colliderGroups)==null?void 0:r.map((p,m)=>{var g;const A=h[p.node];return A==null?(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${m} attempted to reference a node #${p.node} but not found. Skipping the collider group`),null):{colliders:((g=p.colliders)!=null?g:[]).map((E,v)=>{var _,b,M;const S=new R(0,0,0);return E.offset&&S.set((_=E.offset.x)!=null?_:0,(b=E.offset.y)!=null?b:0,E.offset.z?-E.offset.z:0),this._importSphereCollider(A,{offset:S,radius:(M=E.radius)!=null?M:0,inside:!1})})}});return c==null||c.forEach((p,m)=>{const g=p.bones;g&&g.forEach(A=>{var f,E,v,_;const b=h[A];if(b==null){console.warn(`VRMSpringBoneLoaderPlugin: The spring bone group #${m} attempted to reference a node #${A} but not found. Skipping the node`);return}const M=new R;p.gravityDir?M.set((f=p.gravityDir.x)!=null?f:0,(E=p.gravityDir.y)!=null?E:0,(v=p.gravityDir.z)!=null?v:0):M.set(0,-1,0);const S=p.center!=null?h[p.center]:void 0,C={hitRadius:p.hitRadius,dragForce:p.dragForce,gravityPower:p.gravityPower,stiffness:p.stiffiness,gravityDir:M},I=(_=p.colliderGroups)==null?void 0:_.map(y=>{const T=d==null?void 0:d[y];return T??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${m} attempted to reference a collider group #${y} but not found. Skipping the collider group`),null)}).filter(y=>y!=null);b.traverse(y=>{var T;const N=(T=y.children[0])!=null?T:null,D=this._importJoint(y,N,C,I);S&&(D.center=S),u.addJoint(D)})})}),e.scene.updateMatrixWorld(),u.setInitState(),u})}_importJoint(e,t,i,r){const s=new XS(e,t,i,r);if(this.jointHelperRoot){const a=new GS(s);this.jointHelperRoot.add(a),a.renderOrder=this.jointHelperRoot.renderOrder}return s}_importSphereCollider(e,t){const i=new IA(t),r=new Xl(i);if(e.add(r),this.colliderHelperRoot){const s=new jl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}_importCapsuleCollider(e,t){const i=new yA(t),r=new Xl(i);if(e.add(r),this.colliderHelperRoot){const s=new jl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}_importPlaneCollider(e,t){const i=new MA(t),r=new Xl(i);if(e.add(r),this.colliderHelperRoot){const s=new jl(r);this.colliderHelperRoot.add(s),s.renderOrder=this.colliderHelperRoot.renderOrder}return r}};SA.EXTENSION_NAME="VRMC_springBone";var $S=SA,eC=class{get name(){return"VRMLoaderPlugin"}constructor(n,e){var t,i,r,s,a,o,l,c,u,h;this.parser=n;const d=e==null?void 0:e.helperRoot,p=e==null?void 0:e.autoUpdateHumanBones;this.expressionPlugin=(t=e==null?void 0:e.expressionPlugin)!=null?t:new mI(n),this.firstPersonPlugin=(i=e==null?void 0:e.firstPersonPlugin)!=null?i:new _I(n),this.humanoidPlugin=(r=e==null?void 0:e.humanoidPlugin)!=null?r:new II(n,{helperRoot:d,autoUpdateHumanBones:p}),this.lookAtPlugin=(s=e==null?void 0:e.lookAtPlugin)!=null?s:new QI(n,{helperRoot:d}),this.metaPlugin=(a=e==null?void 0:e.metaPlugin)!=null?a:new VI(n),this.mtoonMaterialPlugin=(o=e==null?void 0:e.mtoonMaterialPlugin)!=null?o:new rS(n),this.materialsHDREmissiveMultiplierPlugin=(l=e==null?void 0:e.materialsHDREmissiveMultiplierPlugin)!=null?l:new aS(n),this.materialsV0CompatPlugin=(c=e==null?void 0:e.materialsV0CompatPlugin)!=null?c:new fS(n),this.springBonePlugin=(u=e==null?void 0:e.springBonePlugin)!=null?u:new $S(n,{colliderHelperRoot:d,jointHelperRoot:d}),this.nodeConstraintPlugin=(h=e==null?void 0:e.nodeConstraintPlugin)!=null?h:new PS(n,{helperRoot:d})}beforeRoot(){return Fa(this,null,function*(){yield this.materialsV0CompatPlugin.beforeRoot(),yield this.mtoonMaterialPlugin.beforeRoot()})}loadMesh(n){return Fa(this,null,function*(){return yield this.mtoonMaterialPlugin.loadMesh(n)})}getMaterialType(n){const e=this.mtoonMaterialPlugin.getMaterialType(n);return e??null}extendMaterialParams(n,e){return Fa(this,null,function*(){yield this.materialsHDREmissiveMultiplierPlugin.extendMaterialParams(n,e),yield this.mtoonMaterialPlugin.extendMaterialParams(n,e)})}afterRoot(n){return Fa(this,null,function*(){yield this.metaPlugin.afterRoot(n),yield this.humanoidPlugin.afterRoot(n),yield this.expressionPlugin.afterRoot(n),yield this.lookAtPlugin.afterRoot(n),yield this.firstPersonPlugin.afterRoot(n),yield this.springBonePlugin.afterRoot(n),yield this.nodeConstraintPlugin.afterRoot(n),yield this.mtoonMaterialPlugin.afterRoot(n);const e=n.userData.vrmMeta,t=n.userData.vrmHumanoid;if(e&&t){const i=new WI({scene:n.scene,expressionManager:n.userData.vrmExpressionManager,firstPerson:n.userData.vrmFirstPerson,humanoid:t,lookAt:n.userData.vrmLookAt,meta:e,materials:n.userData.vrmMToonMaterials,springBoneManager:n.userData.vrmSpringBoneManager,nodeConstraintManager:n.userData.vrmNodeConstraintManager});n.userData.vrm=i}})}};function tC(n){const e=new Set;return n.traverse(t=>{if(!t.isMesh)return;const i=t;e.add(i)}),e}function lf(n,e,t){if(e.size===1){const a=e.values().next().value;if(a.weight===1)return n[a.index]}const i=new Float32Array(n[0].count*3);let r=0;if(t)r=1;else for(const a of e)r+=a.weight;for(const a of e){const o=n[a.index],l=a.weight/r;for(let c=0;c<o.count;c++)i[c*3+0]+=o.getX(c)*l,i[c*3+1]+=o.getY(c)*l,i[c*3+2]+=o.getZ(c)*l}return new tt(i,3)}function nC(n){var e;const t=tC(n.scene),i=new Map,r=(e=n.expressionManager)==null?void 0:e.expressionMap;if(r!=null)for(const[s,a]of Object.entries(r)){const o=new Set;for(const l of a.binds)if(l instanceof vo){if(l.weight!==0)for(const c of l.primitives){let u=i.get(c);u==null&&(u=new Map,i.set(c,u));let h=u.get(s);h==null&&(h=new Set,u.set(s,h)),h.add(l)}o.add(l)}for(const l of o)a.deleteBind(l)}for(const s of t){const a=i.get(s);if(a==null)continue;const o=s.geometry.morphAttributes;s.geometry.morphAttributes={};const l=s.geometry.clone();s.geometry=l;const c=l.morphTargetsRelative,u=o.position!=null,h=o.normal!=null,d={},p={},m=[];if(u||h){u&&(d.position=[]),h&&(d.normal=[]);let g=0;for(const[A,f]of a)u&&(d.position[g]=lf(o.position,f,c)),h&&(d.normal[g]=lf(o.normal,f,c)),r==null||r[A].addBind(new vo({index:g,weight:1,primitives:[s]})),p[A]=g,m.push(0),g++}l.morphAttributes=d,s.morphTargetDictionary=p,s.morphTargetInfluences=m}}function xo(n,e,t){if(n.getComponent)return n.getComponent(e,t);{let i=n.array[e*n.itemSize+t];return n.normalized&&(i=Mt.denormalize(i,n.array)),i}}function CA(n,e,t,i){n.setComponent?n.setComponent(e,t,i):(n.normalized&&(i=Mt.normalize(i,n.array)),n.array[e*n.itemSize+t]=i)}function iC(n){var e;const t=rC(n),i=new Set;for(const h of t)i.has(h.geometry)&&(h.geometry=uC(h.geometry)),i.add(h.geometry);const r=new Map;for(const h of i){const d=h.getAttribute("skinIndex"),p=(e=r.get(d))!=null?e:new Map;r.set(d,p);const m=h.getAttribute("skinWeight"),g=sC(d,m);p.set(m,g)}const s=new Map;for(const h of t){const d=aC(h,r);s.set(h,d)}const a=[];for(const[h,d]of s){let p=!1;for(const m of a)if(oC(d,m.boneInverseMap)){p=!0,m.meshes.add(h);for(const[A,f]of d)m.boneInverseMap.set(A,f);break}p||a.push({boneInverseMap:d,meshes:new Set([h])})}const o=new Map,l=new Kl,c=new Kl,u=new Kl;for(const h of a){const{boneInverseMap:d,meshes:p}=h,m=Array.from(d.keys()),g=Array.from(d.values()),A=new Yr(m,g),f=c.getOrCreate(A);for(const E of p){const v=E.geometry.getAttribute("skinIndex"),_=l.getOrCreate(v),b=E.skeleton.bones,M=b.map(I=>u.getOrCreate(I)).join(","),S=`${_};${f};${M}`;let C=o.get(S);C==null&&(C=v.clone(),lC(C,b,m),o.set(S,C)),E.geometry.setAttribute("skinIndex",C)}for(const E of p)E.bind(A,new De)}}function rC(n){const e=new Set;return n.traverse(t=>{if(!t.isSkinnedMesh)return;const i=t;e.add(i)}),e}function sC(n,e){const t=new Set;for(let i=0;i<n.count;i++)for(let r=0;r<n.itemSize;r++){const s=xo(n,i,r);xo(e,i,r)!==0&&t.add(s)}return t}function aC(n,e){const t=new Map,i=n.skeleton,r=n.geometry,s=r.getAttribute("skinIndex"),a=r.getAttribute("skinWeight"),o=e.get(s),l=o==null?void 0:o.get(a);if(!l)throw new Error("Unreachable. attributeUsedIndexSetMap does not know the skin index attribute or the skin weight attribute.");for(const c of l)t.set(i.bones[c],i.boneInverses[c]);return t}function oC(n,e){for(const[t,i]of n.entries()){const r=e.get(t);if(r!=null&&!cC(i,r))return!1}return!0}function lC(n,e,t){const i=new Map;for(const s of e)i.set(s,i.size);const r=new Map;for(const[s,a]of t.entries()){const o=i.get(a);r.set(o,s)}for(let s=0;s<n.count;s++)for(let a=0;a<n.itemSize;a++){const o=xo(n,s,a),l=r.get(o);CA(n,s,a,l)}n.needsUpdate=!0}function cC(n,e,t){if(t=t||1e-4,n.elements.length!=e.elements.length)return!1;for(let i=0,r=n.elements.length;i<r;i++)if(Math.abs(n.elements[i]-e.elements[i])>t)return!1;return!0}var Kl=class{constructor(){this._objectIndexMap=new Map,this._index=0}get(n){return this._objectIndexMap.get(n)}getOrCreate(n){let e=this._objectIndexMap.get(n);return e==null&&(e=this._index,this._objectIndexMap.set(n,e),this._index++),e}};function uC(n){var e,t,i,r;const s=new dt;s.name=n.name,s.setIndex(n.index);for(const[a,o]of Object.entries(n.attributes))s.setAttribute(a,o);for(const[a,o]of Object.entries(n.morphAttributes)){const l=a;s.morphAttributes[l]=o.concat()}s.morphTargetsRelative=n.morphTargetsRelative,s.groups=[];for(const a of n.groups)s.addGroup(a.start,a.count,a.materialIndex);return s.boundingSphere=(t=(e=n.boundingSphere)==null?void 0:e.clone())!=null?t:null,s.boundingBox=(r=(i=n.boundingBox)==null?void 0:i.clone())!=null?r:null,s.drawRange.start=n.drawRange.start,s.drawRange.count=n.drawRange.count,s.userData=n.userData,s}function cf(n){if(Object.values(n).forEach(e=>{e!=null&&e.isTexture&&e.dispose()}),n.isShaderMaterial){const e=n.uniforms;e&&Object.values(e).forEach(t=>{const i=t.value;i!=null&&i.isTexture&&i.dispose()})}n.dispose()}function hC(n){const e=n.geometry;e&&e.dispose();const t=n.skeleton;t&&t.dispose();const i=n.material;i&&(Array.isArray(i)?i.forEach(r=>cf(r)):i&&cf(i))}function dC(n){n.traverse(hC)}function fC(n,e){var t,i;console.warn("VRMUtils.removeUnnecessaryJoints: removeUnnecessaryJoints is deprecated. Use combineSkeletons instead. combineSkeletons contributes more to the performance improvement. This function will be removed in the next major version.");const r=(t=e==null?void 0:e.experimentalSameBoneCounts)!=null?t:!1,s=[];n.traverse(l=>{l.type==="SkinnedMesh"&&s.push(l)});const a=new Map;let o=0;for(const l of s){const u=l.geometry.getAttribute("skinIndex");if(a.has(u))continue;const h=new Map,d=new Map;for(let p=0;p<u.count;p++)for(let m=0;m<u.itemSize;m++){const g=xo(u,p,m);let A=h.get(g);A==null&&(A=h.size,h.set(g,A),d.set(A,g)),CA(u,p,m,A)}u.needsUpdate=!0,a.set(u,d),o=Math.max(o,h.size)}for(const l of s){const u=l.geometry.getAttribute("skinIndex"),h=a.get(u),d=[],p=[],m=r?o:h.size;for(let A=0;A<m;A++){const f=(i=h.get(A))!=null?i:0;d.push(l.skeleton.bones[f]),p.push(l.skeleton.boneInverses[f])}const g=new Yr(d,p);l.bind(g,new De)}}function pC(n,e){const t=n.position.count,i=new Array(t);let r=0;const s=e.array;for(let a=0;a<s.length;a++){const o=s[a];i[o]||(i[o]=!0,r++)}return{isVertexUsed:i,vertexCount:t,verticesUsed:r}}function AC(n){const e=[],t=[];let i=0;for(let r=0;r<n.length;r++)if(n[r]){const s=i++;e[r]=s,t[s]=r}return{originalIndexNewIndexMap:e,newIndexOriginalIndexMap:t}}function mC(n,e){var t,i,r,s;e.name=n.name,e.morphTargetsRelative=n.morphTargetsRelative,n.groups.forEach(a=>{e.addGroup(a.start,a.count,a.materialIndex)}),e.boundingBox=(i=(t=n.boundingBox)==null?void 0:t.clone())!=null?i:null,e.boundingSphere=(s=(r=n.boundingSphere)==null?void 0:r.clone())!=null?s:null,e.setDrawRange(n.drawRange.start,n.drawRange.count),e.userData=n.userData}function gC(n,e,t){const i=e.array,r=new i.constructor(i.length);for(let s=0;s<i.length;s++){const a=i[s];r[s]=t[a]}n.setIndex(new tt(r,e.itemSize,e.normalized))}function yo(n,e,t){const i=n.constructor,r=new i(e.length*t);let s=!0;for(let a=0;a<e.length;a++){const l=e[a]*t,c=a*t;for(let u=0;u<t;u++){const h=n[l+u];r[c+u]=h,s=s&&h===0}}return[r,s]}function _C(n){var e;const t=new Map,i=[];for(const[r,s]of Object.entries(n))if(s.isInterleavedBufferAttribute){const a=s,o=a.data,l=(e=t.get(o))!=null?e:[];t.set(o,l),l.push([r,a])}else{const a=s;i.push([r,a])}return[t,i]}function EC(n,e,t){const[i,r]=_C(e);for(const[s,a]of i){const o=s.array,{stride:l}=s,[c]=yo(o,t,l),u=new To(c,l);u.setUsage(s.usage);for(const[h,d]of a){const{itemSize:p,offset:m,normalized:g}=d,A=new zi(u,p,m,g);n.setAttribute(h,A)}}for(const[s,a]of r){const o=a.array,{itemSize:l,normalized:c}=a,[u]=yo(o,t,l);n.setAttribute(s,new tt(u,l,c))}}function vC(n){var e;const t=new Map,i=[];for(const[r,s]of Object.entries(n)){const a=r;for(let o=0;o<s.length;o++){const l=s[o];if(l.isInterleavedBufferAttribute){const c=l,u=c.data,h=(e=t.get(u))!=null?e:[];t.set(u,h),h.push([a,o,c])}else{const c=l;i.push([a,o,c])}}}return[t,i]}function bC(n,e,t){var i,r;let s=!0;const[a,o]=vC(e),l={};for(const[c,u]of a){const h=c.array,{stride:d}=c,[p,m]=yo(h,t,d);s=s&&m;const g=new To(p,d);g.setUsage(c.usage);for(const[A,f,E]of u){const{itemSize:v,offset:_,normalized:b}=E,M=new zi(g,v,_,b);(i=l[A])!=null||(l[A]=[]),l[A][f]=M}}for(const[c,u,h]of o){const d=h,p=d.array,{itemSize:m,normalized:g}=d,[A,f]=yo(p,t,m);s=s&&f,(r=l[c])!=null||(l[c]=[]),l[c][u]=new tt(A,m,g)}n.morphAttributes=s?{}:l}function xC(n){const e=new Map;n.traverse(t=>{if(!t.isMesh)return;const i=t,r=i.geometry,s=r.index;if(s==null)return;const a=e.get(r);if(a!=null){i.geometry=a;return}const{isVertexUsed:o,vertexCount:l,verticesUsed:c}=pC(r.attributes,s);if(c===l)return;const{originalIndexNewIndexMap:u,newIndexOriginalIndexMap:h}=AC(o),d=new dt;mC(r,d),e.set(r,d),gC(d,s,u),EC(d,r.attributes,h),bC(d,r.morphAttributes,h),i.geometry=d}),Array.from(e.keys()).forEach(t=>{t.dispose()})}function yC(n){var e;((e=n.meta)==null?void 0:e.metaVersion)==="0"&&(n.scene.rotation.y=Math.PI)}var Ln=class{constructor(){}};Ln.combineMorphs=nC;Ln.combineSkeletons=iC;Ln.deepDispose=dC;Ln.removeUnnecessaryJoints=fC;Ln.removeUnnecessaryVertices=xC;Ln.rotateVRM0=yC;/*!
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
 */async function wA(n,e={}){var s;const t=new BM;t.setMeshoptDecoder(dI),e.ktx2&&t.setKTX2Loader(e.ktx2),t.register(a=>new eC(a));const i=await t.parseAsync(n,""),r=i.userData.vrm;if(!((s=r==null?void 0:r.humanoid)!=null&&s.getNormalizedBoneNode("hips")))throw Ln.deepDispose(i.scene),new Error("NOT_A_VRM");return Ln.removeUnnecessaryVertices(i.scene),Ln.rotateVRM0(r),r.scene.traverse(a=>{a.isMesh&&(a.castShadow=!0,a.frustumCulled=!1)}),r.dispose=()=>Ln.deepDispose(r.scene),r}const Is=new R,uf=[16736126,3111935,16761405,4177754,10517503,16747082],MC=n=>{let e=0;for(const t of n)e=e*31+t.charCodeAt(0)>>>0;return uf[e%uf.length]};function IC(n){var N;const e=n.height??1.75,t=n.now??(()=>performance.now()/1e3),i=n.load??(D=>wA(D)),r=new AbortController;(N=n.signal)==null||N.addEventListener("abort",()=>r.abort(),{once:!0});const s=n.onError??((D,P)=>console.warn(`[avatar kit] ${P}`,D)),a=vd({height:e,standIn:n.standIn}),o=new gt;o.name="other-players";const l=new Map,c=cM();let u=null,h=!1,d=!1;const p=new Map;let m=0,g=0,A=null,f=null;const E=(D,P)=>D?D().catch(k=>(s(k,P),null)):Promise.resolve(null),v=()=>A??(A=E(n.motion,"motion")),_=()=>f??(f=E(n.emotes,"emotes")),b=(D,P)=>{!n.emotes||D.hasClip(P)||!Eo.includes(P)||_().then(k=>{d||D.addClips(k)})},M=async(D,P)=>{var H;if(!n.services.avatar)throw new Error("AVATAR_SERVICE_MISSING");const[k,F]=await Promise.all([n.services.avatar(P,r.signal),v()]),G=await i(k);if(d)throw(H=G.dispose)==null||H.call(G),new Error("KIT_DISPOSED");D.attach(G),D.addClips(F),p.set(D,P)},S=async D=>{var k;const P=++m;try{if(!n.services.avatar)throw new Error("AVATAR_SERVICE_MISSING");const[F,G]=await Promise.all([n.services.avatar(D,r.signal),v()]),H=await i(F);return d||P!==m?((k=H.dispose)==null||k.call(H),!1):(a.attach(H),a.addClips(G),p.set(a,D),!0)}catch(F){return d||s(F,"visitor"),!1}};let C=0;const I=[],y=(D,P)=>{const k=()=>{if(d||l.get(D.id)!==D||D.vrm!==P||p.get(D.avatar)===P)return F();C++,M(D.avatar,P).catch(G=>s(G,`player ${D.id}`)).finally(()=>{C--,F()})},F=()=>{var G;C<(n.maxLoads??2)&&((G=I.shift())==null||G())};I.push(k),F()},T=D=>{const P=vd({height:e,color:MC(D)}),k=RM("…",{canvas:n.canvas});k.object.position.y=e+.22,P.root.add(k.object),P.root.visible=!1,o.add(P.root);const F={id:D,name:"",vrm:"",talking:!1,avatar:P,tag:k,samples:[],drawn:!1};return l.set(D,F),F};return{self:a,group:o,others:l,arrival:c,async loadSelf(){const D=n.services.identity.avatar;return D?S(D):(a.addClips(await v()),!1)},async wear(D){if(typeof D!="string"||!D)return!1;if(p.get(a)===D)return!0;const P=await S(D);return P&&g++,P},setPeers(D){if(d)return;const P=t(),k=new Set;for(const F of Array.isArray(D)?D.slice(0,32):[]){const G=fM(F);if(!G||k.has(G.id))continue;k.add(G.id);const H=l.get(G.id)??T(G.id);G.name!==H.name&&(H.name=G.name,H.tag.setName(G.name)),G.talking!==H.talking&&(H.talking=G.talking,H.tag.setTalking(G.talking)),G.vrm&&G.vrm!==H.vrm&&(H.vrm=G.vrm,y(H,G.vrm)),pM(H.samples,G.pose,P,G.fresh)}for(const F of[...l.values()])k.has(F.id)||(F.tag.dispose(),F.avatar.dispose(),l.delete(F.id))},emote(D){a.motion=D?{emote:D}:{},D&&b(a,D)},pose(D,P){return{x:D.x,y:D.y,z:D.z,h:P,a:uM(a.motion)}},update(D,P){if(d)return;u=P,c.update(D),h=a.takeDrawn(),a.drive(D,c.crouch);const k=t()-gM;for(const F of l.values()){F.drawn=F.avatar.takeDrawn();const G=mM(F.samples,k);if(!G)continue;const H=F.avatar.root;H.visible=!0,H.position.set(G.x,G.y,G.z),H.rotation.y=G.h+(n.heading??0),F.avatar.motion=hM(G.a,G.speed),F.avatar.motion.emote&&b(F.avatar,F.avatar.motion.emote),F.avatar.drive(D),F.tag.update(D)}},inspect(){let D=!1,P=!1;if(u){a.root.updateWorldMatrix(!0,!1),u.updateMatrixWorld();const F=a.root.getWorldPosition(new R);Is.copy(F).setY(F.y+e*.5*(1-c.crouch*.4)).project(u),D=h&&Math.abs(Is.x)<=1&&Math.abs(Is.y)<=1&&Is.z>-1&&Is.z<1;const G=u.getWorldPosition(new R),H=a.root.getWorldDirection(new R);P=lM(F,Math.atan2(H.x,H.z),G)}const k=[...l.values()].filter(F=>F.drawn);return{avatarSelf:a.kind,avatarSelfInFrame:D,avatarOthers:l.size,avatarOthersDrawn:k.length,avatarOthersVrm:k.filter(F=>F.avatar.kind==="vrm").length,avatarArrival:c.phase,avatarFacingCamera:P,avatarHandsEmpty:c.handsEmpty,avatarTalking:[...l.values()].filter(F=>F.talking).length,avatarEmote:a.motion.emote??"",avatarSelfChanges:g}},dispose(){var D;if(!d){d=!0,r.abort(),I.length=0;for(const P of l.values())P.tag.dispose(),P.avatar.dispose();l.clear(),(D=o.parent)==null||D.remove(o),a.dispose()}}}}const Os=Rt.step,Za=(n,e,t)=>Math.max(e,Math.min(t,n)),hf=n=>Math.atan2(Math.sin(n),Math.cos(n)),Lr=n=>Number.isFinite(n)?n:0;function df(n={}){return{x:n.x||0,y:n.y||0,z:n.z||0,rotation:n.rotation||0,vx:0,vz:0,vy:0,jumpHeld:!1,jumpCount:(n.y||0)>0?1:0,floor:!(n.y&&n.y>0),time:0}}function SC(n,e,t,i,r){r=Za(Lr(r),0,Rt.maxFrame);const s=Math.abs(e)+Math.abs(t)>Rt.inputDeadzone,a=Math.max(1,Math.hypot(e,t)),o=i?Rt.runSpeed:Rt.walkSpeed,l=Math.hypot(n.vx,n.vz),c=1-Math.exp(-(s?Rt.steerRate:Rt.brakeRate)*r);n.vx+=(e/a*o-n.vx)*c,n.vz+=(t/a*o-n.vz)*c;const u=Math.hypot(n.vx,n.vz),h=l+Rt.acceleration*r;s&&u>h&&(n.vx*=h/u,n.vz*=h/u),!s&&u<Rt.restSpeed&&(n.vx=n.vz=0)}function ff(n,e,t=Os,i=1){t=Za(Lr(t),0,Os);const r=Lr(e.yaw);SC(n,Za(Lr(e.strafe),-1,1),Za(Lr(e.forward),-1,1),!!e.running,t),!n.y&&n.vy<=0&&(n.jumpCount=0),e.jump&&!n.jumpHeld&&n.jumpCount<Rt.maxJumps&&(n.vy=Rt.jumpSpeed,n.jumpCount++),n.jumpHeld=!!e.jump,(n.y>0||n.vy>0)&&(n.vy-=Rt.gravity*t,n.y=Math.max(0,n.y+n.vy*t*i),n.y||(n.vy=0,n.jumpCount=0));const s=Math.cos(r)*n.vx+Math.sin(r)*n.vz,a=-Math.sin(r)*n.vx+Math.cos(r)*n.vz;return n.x+=s*t*i,n.z+=a*t*i,Math.hypot(s,a)>Rt.faceMinSpeed&&(n.rotation=hf(n.rotation+hf(r+Math.atan2(-n.vx,-n.vz)-n.rotation)*(1-Math.exp(-12*t)))),n.floor=n.y===0,n.time+=t,n}function CC(n={},e={}){let t=df(n),i=0,r={x:t.x,z:t.z,time:t.time};const s={get rest(){return r},get state(){return t},scale:e.scale&&e.scale>0?e.scale:1,advance(a,o){var c,u;for(i=Math.min(Rt.maxFrame,i+Math.max(0,Lr(a)));i+1e-9>=Os;)i-=Os,ff(t,o,Os,s.scale),(c=e.constrain)==null||c.call(e,t),!t.vx&&!t.vz&&(r={x:t.x,z:t.z,time:t.time});const l=ff({...t},o,i,s.scale);return(u=e.constrain)==null||u.call(e,l),l},place(a){const o=t.time;t=df({...t,...a}),t.time=o,r={x:t.x,z:t.z,time:o},i=0},speed:()=>Math.hypot(t.vx,t.vz),velocity:a=>({x:(Math.cos(a)*t.vx+Math.sin(a)*t.vz)*s.scale,z:(-Math.sin(a)*t.vx+Math.cos(a)*t.vz)*s.scale})};return s}function wC(){let n=0,e=!1,t=0;return{queue(){n=Math.min(Rt.maxJumps,n+1)},read(i){t<=1e-9&&(e?(e=!1,t=Rt.step):n&&(n--,e=!0,t=Rt.step));const r=e;return t-=Number.isFinite(i)?Math.max(0,i):0,r},clear(){n=t=0,e=!1}}}function TC(n,e){var r;const t=globalThis;if(!/[?&]check\b/.test(String(((r=t.location)==null?void 0:r.search)??"")))return;const i={begin:e,read(){const s=n();return s?{x:s.state.x,z:s.state.z,time:s.state.time,scale:s.scale,floor:s.state.floor,rest:{...s.rest}}:null}};t.__oncyberLocomotion=i}function RC(n,e,t={}){n.position.set(e.position.x,e.position.y,e.position.z),n.lookAt(e.target.x,e.target.y,e.target.z);const i=t.near===!1?n.near:e.near;(n.fov!==e.fov||n.near!==i)&&(n.fov=e.fov,n.near=i,n.updateProjectionMatrix())}const Ha=n=>Math.round(n*100)/100;function BC(n){const e=n.camera.x-n.avatar.x,t=n.camera.z-n.avatar.z;return{distance:Ha(Math.hypot(e,t)),height:Ha(n.camera.y-n.avatar.y),fov:Ha(n.fov),avatarHeight:Ha(n.avatarHeight),facingCamera:e*n.avatarForward.x+t*n.avatarForward.z>0,crouched:n.crouched,handsEmpty:n.handsEmpty}}const Xc=90,TA=9,Yc=.6,LC=1.4,_n=12,Ga=_n-.6,Pi=1.5,Xr=(()=>{const n=[];for(let e=0;e<8;e++){const t=e/8*Math.PI*2+Math.PI/8;n.push([Math.sin(t)*9.2,Math.cos(t)*9.2])}for(let e=0;e<4;e++){const t=e/4*Math.PI*2+Math.PI/4;n.push([Math.sin(t)*4.6,Math.cos(t)*4.6])}return n.map(([e,t])=>[Math.round(e*100)/100,Math.round(t*100)/100])})();function DC(n){let e=n>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function PC(n){let e=2166136261;for(const t of String(n))e=Math.imul(e^t.charCodeAt(0),16777619);return e>>>0}const UC=n=>Math.max(2,Math.min(5,2+Math.floor((n-1)/2))),si=(n,e,t,i)=>typeof n=="number"&&Number.isFinite(n)?Math.max(e,Math.min(t,n)):i;function pf({id:n,seed:e,duration:t=Xc,players:i}){return{id:String(n),seed:e>>>0,draws:0,duration:t,elapsed:0,lit:{},nextAt:0,scores:Object.fromEntries(i.map(r=>[r,0])),gone:[],missed:0,over:!1}}const $a=n=>Object.keys(n.scores).filter(e=>!n.gone.includes(e));function NC(n){const e=DC(n.seed+n.draws*7919);return n.draws++,e()}function FC(n,e){const t=[];if(n.over||!(e>0))return t;n.elapsed=Math.min(n.duration,n.elapsed+e);for(const[r,s]of Object.entries(n.lit))n.elapsed-s>=TA&&(delete n.lit[r],n.missed++,n.nextAt=Math.max(n.nextAt,n.elapsed+Yc),t.push({type:"faded",post:Number(r)}));if(n.elapsed>=n.duration)return n.over=!0,n.lit={},t.push({type:"over",post:-1}),t;const i=UC(Math.max(1,$a(n).length));for(;Object.keys(n.lit).length<i&&n.elapsed>=n.nextAt;){const r=Xr.map((a,o)=>o).filter(a=>!(a in n.lit)),s=r[Math.floor(NC(n)*r.length)];n.lit[s]=n.elapsed,n.nextAt=n.elapsed+Yc,t.push({type:"lit",post:s})}return t}function OC(n,e,t=LC){const i=Xr[e];return!!i&&Math.hypot(n[0]-i[0],n[1]-i[1])<=t}const Af=(n,e)=>Object.keys(n.lit).map(Number).filter(t=>OC(e,t));function mf(n,e,t,i){return n.over||!(e in n.scores)||n.gone.includes(e)||!(t in n.lit)||Math.abs(n.lit[t]-i)>.051?!1:(delete n.lit[t],n.scores[e]++,n.nextAt=Math.max(n.nextAt,n.elapsed+Yc),!0)}function gf(n,e){if(n.over)return!1;if(!(e in n.scores)){if(Object.keys(n.scores).length>=8)return!1;n.scores[e]=0}return n.gone=n.gone.filter(t=>t!==e),!0}function Jl(n,e){e in n.scores&&!n.gone.includes(e)&&n.gone.push(e)}const Zl=n=>Math.round(n*10);function _f(n){return[n.id,n.seed,n.draws,n.duration,Zl(n.elapsed),Zl(n.nextAt),Object.entries(n.lit).map(([e,t])=>[Number(e),Zl(t)]),Object.entries(n.scores).map(([e,t])=>[e,t,n.gone.includes(e)?1:0]),n.missed,n.over?1:0]}function kC(n,e=()=>!0){if(!Array.isArray(n)||n.length<10)return null;const[t,i,r,s,a,o,l,c,u]=n;if(typeof t!="string"||!/^[A-Za-z0-9_-]{6,64}$/.test(t)||!Array.isArray(l)||!Array.isArray(c))return null;const h=si(s,5,600,NaN);if(!Number.isFinite(h))return null;const d={id:t,seed:si(i,0,4294967295,0)>>>0,draws:Math.floor(si(r,0,1e6,0)),duration:h,elapsed:si(a,0,h*10,0)/10,nextAt:si(o,0,h*10+100,0)/10,lit:{},scores:{},gone:[],missed:Math.floor(si(u,0,1e4,0)),over:n[9]===1};for(const p of l.slice(0,Xr.length)){if(!Array.isArray(p))continue;const m=p[0];!Number.isInteger(m)||m<0||m>=Xr.length||(d.lit[m]=si(p[1],0,h*10,0)/10)}for(const p of c.slice(0,8)){if(!Array.isArray(p))continue;const m=p[0];typeof m!="string"||!m||m.length>64||e(m)&&(d.scores[m]=Math.floor(si(p[1],0,1e4,0)),p[2]===1&&d.gone.push(m))}return d}function QC(n){return Object.entries(n.scores).map(([e,t])=>({id:e,score:t,gone:n.gone.includes(e)})).sort((e,t)=>t.score-e.score||(e.id<t.id?-1:1))}function HC(n,{format:e,self:t,name:i}){if(!n.over||!(t in n.scores)||n.gone.includes(t))return null;const s=Object.keys(n.scores).sort().map(l=>({score:n.scores[l],players:[{id:l,name:i(l),kind:l===t?"self":"peer"}]}));s.length<2&&s.push({score:n.missed,players:[{id:"cpu-night",name:"The night",kind:"cpu"}]});const a=Math.max(...s.map(l=>l.score)),o=s.filter(l=>l.score===a);return{format:e,teams:s,winner:o.length===1?s.indexOf(o[0]):null}}function GC(n){n.x=Math.max(-Ga,Math.min(Ga,n.x)),n.z=Math.max(-Ga,Math.min(Ga,n.z));const e=Math.hypot(n.x,n.z);if(e<Pi){const t=e>1e-6?Pi/e:0;n.x=e>1e-6?n.x*t:0,n.z=e>1e-6?n.z*t:Pi}}function VC(n,e){let t=null,i=1/0;for(const r of Object.keys((n==null?void 0:n.lit)??{})){const s=Xr[r],a=Math.hypot(s[0]-e[0],s[1]-e[1]);a<i&&(i=a,t=s)}return!t||i<.3?{strafe:0,forward:0}:{strafe:(t[0]-e[0])/i,forward:(t[1]-e[1])/i}}const zC=3e3,WC=4e3,Ef=["duel","round"];function qC({link:n,authorityOf:e,self:t,now:i=()=>performance.now(),newId:r=()=>`lt-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`,onEvent:s=()=>{}}){let a=null,o="",l="",c="",u=0,h=!1,d=null;const p=new Set,m=[],g=C=>n.roster.members.some(I=>I.id===C),A=C=>n.roster.members.some(I=>I.id===C&&I.state==="here"),f=()=>Ef.includes(o),E=(C,I)=>n.channel.event(C,I);function v(){a&&(a.over=!0,a.lit={},s({type:"over"}))}function _(C){const I=$a(a).filter(y=>y!==C&&(y===t()||A(y)));return e(n.roster,I)||(I.includes(t())?t():"")}function b(C){if(!a||l!=="guest")return;const I=_(C);C&&Jl(a,C),I===t()?(l="authority",c=t(),gf(a,t()),s({type:"taken-over"})):I&&(c=I,u=i())}function M(C,I,y){const T=a;if(a=C,o=I,l="guest",c=y,u=i(),T&&T.id===C.id){for(const D of Object.keys(C.lit))T.lit[D]!==C.lit[D]&&s({type:"lit",post:Number(D)});const N=t();(C.scores[N]??0)>(T.scores[N]??0)&&s({type:"caught",mine:!0})}C.over&&!(T&&T.id===C.id&&T.over)&&s({type:"over"})}m.push(n.on("match",({from:C,data:I})=>{if(!g(C)||C===t()||!Array.isArray(I))return;const[y,T,N,D]=I;if(y==="s"||y==="o"){if(!Ef.includes(T))return;const P=kC(N,k=>g(k));if(!P)return;if(!a||a.over){P.over?(d==null?void 0:d.round.id)===P.id&&(d=null):d={round:P,format:T,from:C,at:i()};return}if(!f())return;if(l==="authority"){if(e(n.roster,[t(),C])===t())return;P.id!==a.id&&s({type:"merged",id:P.id}),E(["j",P.id],C),M(P,T,C);return}if(P.id!==a.id||C!==c&&A(c)&&i()-u<1e3)return;M(P,T,C);return}if(!a||l!=="authority"||T!==a.id){y==="a"&&a&&T===a.id&&C===c&&b(C);return}y==="j"?gf(a,C)&&s({type:"joined",id:C}):y==="c"?Number.isInteger(N)&&typeof D=="number"&&mf(a,C,N,D/10)&&s({type:"caught",mine:!1,id:C}):(y==="l"||y==="a")&&Jl(a,C)}),n.on("dropped",({member:C})=>S(C.id)),n.on("left",({member:C})=>S(C.id)));function S(C){(d==null?void 0:d.from)===C&&(d=null),!(!a||a.over||!f())&&(l==="authority"?Jl(a,C):C===c&&b(C))}return{get round(){return a},get format(){return o},get role(){return l},get authority(){return c},get versus(){return!!a&&!a.over&&f()},joinable(){return d&&(i()-d.at>WC||!A(d.from))&&(d=null),d},startSolo({seed:C,duration:I}){return o="solo",l="solo",c=t(),a=pf({id:r(),seed:C,duration:I,players:[t()]}),s({type:"started"}),a.id},startParty({format:C,seed:I,duration:y}){const T=this.joinable();return p.clear(),T?(d=null,a=T.round,o=T.format,l="guest",c=T.from,u=i(),E(["j",a.id],c),s({type:"started",joined:!0}),a.id):(o=C,l="authority",c=t(),a=pf({id:r(),seed:I,duration:y,players:[t()]}),s({type:"started"}),a.id)},update(C,I){if(!(!a||a.over)){if(l==="guest"){if(a.elapsed=Math.min(a.duration,a.elapsed+C),!h)for(const y of Af(a,I)){const T=`${y}:${a.lit[y]}`;p.has(T)||(p.add(T),E(["c",a.id,y,Math.round(a.lit[y]*10)],c))}i()-u>zC&&b(c)}else{for(const y of FC(a,C))y.type!=="over"&&s(y);if(!h)for(const y of Af(a,I))mf(a,t(),y,a.lit[y])&&s({type:"caught",mine:!0});f()&&(a.over?(E(["o",o,_f(a)]),n.channel.flush()):n.channel.state(["s",o,_f(a)])),a.over&&s({type:"over"})}f()&&n.channel.pump()}},leave(){a&&!a.over&&f()&&(l==="guest"?E(["l",a.id],c):(n.channel.state(null),E(["a",a.id])),n.channel.flush(),n.channel.pump()),a=null,o=l=c="",p.clear()},clear(){a=null,o=l=c="",p.clear()},away(C){if(h=C,!(!a||a.over||!f()))if(C){const I=$a(a).filter(y=>y!==t()&&A(y));l==="authority"&&I.length&&(n.channel.state(null),E(["a",a.id]),n.channel.flush(),l="guest",c=e(n.roster,I)||I[0],u=i())}else l==="guest"&&(E(["j",a.id],c),u=i())},report(){return!a||a.over?null:{format:o,players:$a(a),authority:c,role:l,progress:Math.round(a.elapsed*10),standIns:[]}},finish:v,dispose(){m.forEach(C=>C())}}}const $l=24,jC=[0,0,0,1],XC=["Hips","Spine","Head","LeftUpLeg","RightUpLeg","LeftLeg","RightLeg","LeftFoot","RightFoot","LeftArm","RightArm","LeftForeArm","RightForeArm"],vf=(n,e)=>.003*Math.sin(n+e*1.7),mt=(n,e)=>{const t=Math.sin(e/2);return[n==="x"?t:0,n==="y"?t:0,n==="z"?t:0,Math.cos(e/2)]},RA=(n,e)=>[n[3]*e[0]+n[0]*e[3]+n[1]*e[2]-n[2]*e[1],n[3]*e[1]-n[0]*e[2]+n[1]*e[3]+n[2]*e[0],n[3]*e[2]+n[0]*e[1]-n[1]*e[0]+n[2]*e[3],n[3]*e[3]-n[0]*e[0]-n[1]*e[1]-n[2]*e[2]];function Ss(n,e,t,i=0){const r=[],s={},a=[];for(let o=0;o<=$l;o++){r.push(o/$l*e);const l=o/$l*Math.PI*2;a.push(0,1-i*(.5+.5*Math.cos(l*2))+vf(l,0),0);const c=t(l);XC.forEach((u,h)=>(s[u]??(s[u]=[])).push(...RA(c[u]??jC,mt("x",vf(l,h)))))}return{name:n,duration:e,tracks:[{name:"mixamorigHips.position",times:r,values:a},...Object.entries(s).map(([o,l])=>({name:`mixamorig${o}.quaternion`,times:r,values:l.map(c=>Math.round(c*1e6)/1e6)}))]}}const Ti=(n,e,t=1.25)=>RA(mt("x",e),mt("z",n*t)),Ri=(n,e)=>mt("y",n*e);function bf({stride:n,knee:e,swing:t,bend:i,lean:r,bounce:s}){return a=>{const o=Math.sin(a),l=-o,c=u=>mt("x",e*Math.max(0,Math.cos(u+.6))+.08);return{Hips:mt("x",r*.4+Math.sin(a*2)*s),Spine:mt("x",r),LeftUpLeg:mt("x",-n*o-.05),RightUpLeg:mt("x",-n*l-.05),LeftLeg:c(a),RightLeg:c(a+Math.PI),LeftArm:Ti(-1,t*o),RightArm:Ti(1,t*l),LeftForeArm:Ri(-1,i),RightForeArm:Ri(1,i)}}}function YC(){return{IDLE:Ss("IDLE",3,n=>({Spine:mt("x",.02+Math.sin(n)*.015),Head:mt("x",-Math.sin(n)*.01),LeftArm:Ti(-1,Math.sin(n)*.02),RightArm:Ti(1,Math.sin(n)*.02),LeftForeArm:Ri(-1,.15),RightForeArm:Ri(1,.15),LeftUpLeg:mt("x",0),RightUpLeg:mt("x",0),LeftLeg:mt("x",0),RightLeg:mt("x",0),Hips:mt("x",0)})),WALK:Ss("WALK",1,bf({stride:.42,knee:.7,swing:.4,bend:.3,lean:.05,bounce:.01}),.015),RUN:Ss("RUN",.7,bf({stride:.8,knee:1.3,swing:.9,bend:1.2,lean:.2,bounce:.03}),.04),JUMP:Ss("JUMP",1,()=>({Hips:mt("x",.05),Spine:mt("x",.1),LeftUpLeg:mt("x",-.5),RightUpLeg:mt("x",-.2),LeftLeg:mt("x",.9),RightLeg:mt("x",.5),LeftArm:Ti(-1,-.3,.7),RightArm:Ti(1,-.3,.7),LeftForeArm:Ri(-1,.4),RightForeArm:Ri(1,.4)})),WAVING:Ss("WAVING",1.2,n=>({Spine:mt("x",.02),LeftArm:Ti(-1,0),RightArm:mt("z",-.9),RightForeArm:mt("z",-.6+Math.sin(n*2)*.35),LeftForeArm:Ri(-1,.15)}))}}function KC(n){const e=(n==null?void 0:n.context)??null,t=(n==null?void 0:n.output)??null;if(!e||!t){const _=()=>{};return{lit:_,caught:_,faded:_,start:_,end:_,tick:_,dispose:_}}const i=e.createGain();i.gain.value=.5,i.connect(t);const r=e.createGain();r.gain.value=.16,r.connect(t);const s=e.createBuffer(1,e.sampleRate*2,e.sampleRate),a=s.getChannelData(0);let o=1234567;for(let _=0;_<a.length;_++)o=o*1664525+1013904223>>>0,a[_]=o/4294967296*2-1;const l=e.createBufferSource();l.buffer=s,l.loop=!0;const c=e.createBiquadFilter();c.type="lowpass",c.frequency.value=420;const u=e.createOscillator();u.frequency.value=.13;const h=e.createGain();h.gain.value=160,u.connect(h).connect(c.frequency),l.connect(c).connect(r);const d=e.createOscillator();d.type="sine",d.frequency.value=73.4;const p=e.createGain();p.gain.value=.5,d.connect(p).connect(r);const m=e.createOscillator();m.type="sine",m.frequency.value=4100;const g=e.createOscillator();g.type="square",g.frequency.value=17;const A=e.createGain();A.gain.value=0;const f=e.createGain();f.gain.value=.035,g.connect(f).connect(A.gain),m.connect(A).connect(r);const E=[l,u,d,m,g];E.forEach(_=>_.start());function v(_,{at:b=0,length:M=.5,level:S=.5,type:C="sine"}={}){if(!n.audible)return;const I=e.currentTime+b,y=e.createGain();y.gain.setValueAtTime(1e-4,I),y.gain.exponentialRampToValueAtTime(S,I+.012),y.gain.exponentialRampToValueAtTime(1e-4,I+M),y.connect(i);for(const[T,N]of[[1,1],[2.76,.28]]){const D=e.createOscillator();D.type=C,D.frequency.value=_*T;const P=e.createGain();P.gain.value=N,D.connect(P).connect(y),D.start(I),D.stop(I+M+.05)}}return{lit:()=>v(1318.5,{length:.35,level:.16}),caught(){v(880,{length:.45,level:.5}),v(1318.5,{at:.09,length:.6,level:.42})},faded:()=>v(196,{length:.5,level:.22,type:"triangle"}),start(){v(392,{length:.9,level:.45}),v(587.3,{at:.18,length:.9,level:.4})},end(){[523.3,659.3,784,1046.5].forEach((_,b)=>v(_,{at:b*.14,length:.9,level:.4}))},tick:()=>v(660,{length:.12,level:.2,type:"triangle"}),dispose(){E.forEach(_=>{try{_.stop()}catch{}}),i.disconnect(),r.disconnect()}}}const JC=new be(16762219),xf=new be(2764613);function BA(n,e){const t=document.createElement("canvas");t.width=t.height=n,e(t.getContext("2d"),n);const i=new sp(t);return i.colorSpace=Ct,i}function ZC(){const n=BA(256,(e,t)=>{e.fillStyle="#1d2233",e.fillRect(0,0,t,t);let i=7;const r=()=>(i=i*16807%2147483647)%1e3/1e3,s=t/4;for(let a=0;a<4;a++)for(let o=0;o<4;o++){const l=46+Math.floor(r()*22);e.fillStyle=`rgb(${l},${l+6},${l+22})`,e.fillRect(o*s+2+(a%2?s/2:0)-(o===3&&a%2?t:0),a*s+2,s-4,s-4),a%2&&o===3&&e.fillRect(-s/2+2,a*s+2,s-4,s-4)}});return n.wrapS=n.wrapT=Hi,n.repeat.set(8,8),n}function $C(){return BA(128,(n,e)=>{const t=n.createRadialGradient(e/2,e/2,0,e/2,e/2,e/2);t.addColorStop(0,"rgba(255,226,160,1)"),t.addColorStop(.25,"rgba(255,190,96,0.55)"),t.addColorStop(1,"rgba(255,160,60,0)"),n.fillStyle=t,n.fillRect(0,0,e,e)})}function ew(){const n=new gt;n.name="courtyard";const e=[],t=P=>(e.push(P),P),i=(P,k={})=>t(new Us({color:P,...k}));n.add(new LE(9413887,2302002,1.5));const r=new fp(12570879,1.6);r.position.set(-8,14,-10),n.add(r);const s=new Ke(t(new Kr(_n*2,_n*2)),i(16777215,{map:t(ZC())}));s.rotation.x=-Math.PI/2,n.add(s);const a=new Ke(t(new Rr(90,24)),i(1054762));a.rotation.x=-Math.PI/2,a.position.y=-.02,n.add(a);const o=i(4936560),l=i(6713232),c=t(new qn(_n-1.4,2.4,.6)),u=t(new qn(_n-1.2,.25,.8)),h=t(new qn(.9,3.4,.9)),d=t(new qn(3.7,.5,.8));for(let P=0;P<4;P++){const k=new gt;k.rotation.y=P*Math.PI/2;for(const G of[-1,1]){const H=new Ke(c,o);H.position.set(G*(_n/2+.7),1.2,-_n);const ee=new Ke(u,l);ee.position.set(G*(_n/2+.7),2.52,-_n);const Z=new Ke(h,l);Z.position.set(G*1.4,1.7,-_n),k.add(H,ee,Z)}const F=new Ke(d,l);F.position.set(0,3.55,-_n),k.add(F),n.add(k)}const p=new Ke(t(new qr(Pi-.35,Pi-.25,.9,20,1,!0)),i(5923718,{side:tn}));p.position.y=.45;const m=new Ke(t(new Do(Pi-.35,.12,8,24)),l);m.rotation.x=Math.PI/2,m.position.y=.9;const g=new Ke(t(new Rr(Pi-.4,20)),t(new Kt({color:2310254})));g.rotation.x=-Math.PI/2,g.position.y=.6,n.add(p,m,g);const A=new gt,f=new Ke(t(new Rr(5,28)),t(new Kt({color:15265279,fog:!1})));f.position.set(-34,42,-78),f.lookAt(0,0,0),A.add(f);const E=[];let v=99;const _=()=>(v=v*48271%2147483647)%1e4/1e4;for(let P=0;P<260;P++){const k=_()*Math.PI*2,F=.12+_()*.85,G=95;E.push(Math.cos(k)*Math.sqrt(1-F*F)*G,F*G,Math.sin(k)*Math.sqrt(1-F*F)*G)}const b=t(new dt);b.setAttribute("position",new st(E,3)),A.add(new rp(b,t(new Au({color:14673663,size:1.6,sizeAttenuation:!1,fog:!1})))),n.add(A);const M=t(new qr(.05,.07,2.1,8)),S=t(new gu(.26,0)),C=t(new Lo(.34,.2,6)),I=t(new Rr(1.4,20)),y=i(1842988),T=t($C()),N=Xr.map(([P,k])=>{const F=new gt;F.position.set(P,0,k);const G=new Ke(M,y);G.position.y=1.05;const H=new Ke(C,y);H.position.y=2.42;const ee=t(new Kt({color:xf.clone()})),Z=new Ke(S,ee);Z.position.y=2.1;const se=t(new du({map:T,blending:no,depthWrite:!1,transparent:!0,opacity:0})),pe=new Pc(se);pe.position.y=2.1,pe.scale.setScalar(3.2);const Ue=t(new Kt({map:T,blending:no,depthWrite:!1,transparent:!0,opacity:0})),qe=new Ke(I,Ue);return qe.rotation.x=-Math.PI/2,qe.position.y=.03,F.add(G,H,Z,pe,qe),n.add(F),{lamp:Z,lampMaterial:ee,haloMaterial:se,poolMaterial:Ue,level:0}});let D=0;return{group:n,update(P,k,F){D+=P,N.forEach((G,H)=>{let ee=0;if(k&&H in k){const se=1-(F-k[H])/TA,pe=se<.35?.75+.25*Math.sin(D*22+H):1;ee=Math.max(.15,Math.min(1,.3+se))*pe}G.level+=(ee-G.level)*Math.min(1,P*10);const Z=G.level;G.lampMaterial.color.copy(xf).lerp(JC,Z),G.haloMaterial.opacity=Z*.95,G.poolMaterial.opacity=Z*.55,G.lamp.rotation.y=D*.6+H})},dispose(){e.forEach(P=>P.dispose())}}}function tw(n){const e=new gt;e.name="bearer";const t=new Us({color:14277874}),i=new Us({color:15780264}),r=new Us({color:16757844}),s=new gt,a=new Ke(new qr(.17,.36,n*.74,12),t);a.position.y=n*.37;const o=new Ke(new Do(.24,.035,6,16),r);o.rotation.x=Math.PI/2,o.position.y=n*.5;const l=new Ke(new Js(.15,14,10),i);l.position.y=n*.86;const c=new Ke(new Js(.19,14,10,0,Math.PI*2,0,Math.PI*.62),t);c.position.set(0,n*.88,-.03),c.rotation.x=-.35;const u=new Ke(new Lo(.06,.12,8),t);return u.position.set(0,n*.965,-.06),s.add(a,o,l,c,u),e.add(s),{root:e,height:n,crouch(h){s.scale.y=1-.45*h},dispose(){s.traverse(h=>{var d;return(d=h.geometry)==null?void 0:d.dispose()}),t.dispose(),i.dispose(),r.dispose()}}}const Oe={link:null,pose:null,config:{}},Gn=1.75,ec={x:-2.6,z:3.4},tc=0,nw=.4,nc=1,At=n=>document.querySelector(n),yf=n=>Math.round(n*100)/100;function iw(n){const{graphics:e,services:t,signal:i}=n,r=Oe.config,s=Oe.link,a=new Ny({canvas:e.canvas,antialias:e.pixelRatio>=1,powerPreference:"high-performance"}),o=new Eh;o.background=new be(461592),o.fog=new hu(461592,26,92);const l=new Wt(58,1,.1,220),c={w:0,h:0};let u=null,h=null,d=null,p=null,m=null,g=!1,A=null,f=kc({yaw:tc,scale:Gn/1.8});const E=new gt,v=CC({...ec,rotation:tc},{scale:Gn/1.8,constrain:GC}),_=wC(),b={screen:"boot",came:"direct",walked:0,lift:0,focus:0,options:[],autopilot:!1,inputPaused:!1,noticeUntil:0,clock:0,poseAt:0,lastSecond:-1},M={active:!1,t:0,done:null,marked:!1},S=()=>(s==null?void 0:s.roster.self)||(A==null?void 0:A.self)||"self",C=x=>{var L,Q;return x===S()?t.identity.name||"You":((L=s==null?void 0:s.roster.members.find(j=>j.id===x))==null?void 0:L.name)||((Q=d==null?void 0:d.others.get(x))==null?void 0:Q.name)||"Player"},I=(x,L=null)=>t.call("results",x,L,i).catch(Q=>(console.warn("[lantern-tag] result",(Q==null?void 0:Q.message)??Q),null)),y=qC({link:s??{roster:{self:"",host:"",members:[]},channel:{state(){},event(){},pump(){},flush(){}},on:()=>()=>{}},authorityOf:kA,self:S,onEvent(x){x.type==="lit"?p==null||p.lit():x.type==="faded"?p==null||p.faded():x.type==="caught"&&x.mine?p==null||p.caught():x.type==="joined"?F(`${C(x.id)} joined the round`):x.type==="merged"?(I("abandon"),I("begin",{match:x.id})):x.type==="over"&&D()}});function T(){const x=A?Math.max(1,Math.min(8,A.size)):1;return un.party.formats.filter(L=>L.sizes.includes(x))}function N(x,L=!1){if(M.active||!g)return;b.screen==="match"&&P(),b.screen==="results"&&y.clear();const Q=r.round||Xc,j=PC(`${(A==null?void 0:A.id)??""}${Date.now()}${Math.random()}`),W=x===un.party.solo?y.startSolo({seed:j,duration:Q}):y.startParty({format:x,seed:j,duration:Q});I("begin",{match:W}),b.autopilot=L,b.lastSecond=-1,d.arrival.enter(),k("match"),p.start()}function D(){const x=y.round;if(!x||b.screen!=="match")return;const L=HC(x,{format:y.format,self:S(),name:C});I(L?"report":"abandon",L),pe(x,L),v.place({}),k("results"),p.end()}function P(){y.leave(),I("abandon"),k("arrival")}function k(x){b.screen=x,document.body.dataset.screen=x,document.body.classList.toggle("party",x==="match"&&y.format!==un.party.solo);for(const L of["boot","title","menu","results"])At(`#${L}`).classList.toggle("show",L===x);At("#hud").classList.toggle("show",x==="arrival"||x==="match"),x==="arrival"&&(At("#hint").textContent="Walk around, then start a round"),x==="match"&&(At("#hint").textContent="Walk up to a lit lantern to catch it")}function F(x){const L=At("#notice");L.textContent=x,L.classList.add("show"),b.noticeUntil=b.clock+4}function G(x){const L=aM(x,{at:ec,facing:tc,avatarHeight:Gn});f=L.camera,v.scale=L.scale,v.place({...ec,y:0,rotation:L.avatarRotation}),_.clear(),b.lift=0,d.arrival.stage(x),d.self.motion={},k("arrival"),Y()}function H(){b.options=T(),b.focus=0;const x=y.joinable();At("#options").replaceChildren(...b.options.map((Q,j)=>{const W=document.createElement("button");W.className="oui-list__item",W.dataset.option=Q.id;const fe=document.createElement("span");fe.className="oui-list__body",fe.textContent=Q.label;const $=document.createElement("span");return $.className="oui-list__meta",$.textContent=Q.id===un.party.solo?"You against the night":x?"Join the round in progress":"Your party, the same lanterns",W.append(fe,$),W.addEventListener("click",()=>{b.focus=j,N(Q.id)}),W})),At("#menu-text").textContent=`A round lasts ${r.round||Xc} seconds. Lanterns caught is your score.`,ee(),v.place({}),k("menu")}function ee(){[...At("#options").children].forEach((x,L)=>L===b.focus?x.setAttribute("data-oui-focus",""):x.removeAttribute("data-oui-focus"))}function Z(x,L,Q,j,W){const fe=document.createElement("div");fe.className="oui-score",j&&fe.setAttribute("aria-current","true");for(const[$,me]of[["rank",x],["name",W?`${L} (left)`:L],["value",Q]]){const Ae=document.createElement("span");Ae.className=`oui-score__${$}`,Ae.textContent=String(me),fe.append(Ae)}return fe}function se(x,L){const Q=QC(x).map((j,W)=>Z(W+1,C(j.id),j.score,j.id===S(),j.gone));return L&&Q.push(Z("","The night",x.missed,!1,!1)),Q}function pe(x,L){const Q=x.scores[S()]??0,j=L&&L.winner!==null&&L.teams[L.winner].players[0].kind==="self";At("#results-title").textContent=L?j?`You won with ${Q} lantern${Q===1?"":"s"}`:L.winner===null?`A tie on ${Q}`:`You caught ${Q} lantern${Q===1?"":"s"}`:"The round is over",At("#results-board").replaceChildren(...se(x,Object.keys(x.scores).length<2))}let Ue="";function qe(){const x=y.round;if(b.screen==="match"&&x){const L=Math.max(0,Math.ceil(x.duration-x.elapsed)),Q=`${x.scores[S()]??0}|${L}|${JSON.stringify(x.scores)}|${x.gone.length}`;Q!==Ue&&(Ue=Q,At("#score-value").textContent=String(x.scores[S()]??0),At("#time-value").textContent=`${Math.floor(L/60)}:${String(L%60).padStart(2,"0")}`,y.format!==un.party.solo&&At("#board").replaceChildren(...se(x,!1))),L<=5&&L!==b.lastSecond&&L>0&&(b.lastSecond=L,p.tick())}b.noticeUntil&&b.clock>b.noticeUntil&&(b.noticeUntil=0,At("#notice").classList.remove("show"))}function Ve(){const x=Math.max(1,Math.round(e.width)),L=Math.max(1,Math.round(e.height));return x===c.w&&L===c.h?!1:(c.w=x,c.h=L,a.setPixelRatio(e.pixelRatio),a.setSize(x,L,!1),l.aspect=x/L,l.updateProjectionMatrix(),!0)}function Y(){const x=v.state;RC(l,iM(f,{x:x.x,z:x.z},c.w||1280))}function J(x){E.position.set(x.x,x.y,x.z),E.rotation.y=x.rotation+Math.PI}function de(){if(!M.active)return a.render(o,l);const x=Math.max(0,Math.min(1,M.t/nw)),L=x*x*(3-2*x);M.marked||(M.marked=!0,E.traverse(j=>j.layers.enable(nc)),o.traverse(j=>j.isLight&&j.layers.enable(nc)));const{background:Q}=o;if(a.autoClear=!0,L<1?(a.render(o,l),a.autoClear=!1,Ie.material.opacity=L,a.render(xe,ze),a.clearDepth()):a.setClearColor(0,1),o.background=null,l.layers.set(nc),a.render(o,l),l.layers.set(0),o.background=Q,a.autoClear=!0,L>=1&&M.done){const j=M.done;M.done=null,j(U())}}const Ie=new Ke(new Kr(2,2),new Kt({color:0,transparent:!0,depthTest:!1,depthWrite:!1,fog:!1}));Ie.frustumCulled=!1;const xe=new Eh;xe.add(Ie);const ze=new Uo(-1,1,1,-1,0,1);function St(){if(d.self.kind!=="vrm")return Gn;const L=new yn().setFromObject(d.self.root).max.y-E.position.y;return L>=.5&&L<=4?L:Gn}function U(){const x=new R;l.getWorldDirection(x).multiplyScalar(5).add(l.position);const L=Q=>({x:Q.x,y:Q.y,z:Q.z});return{camera:{position:L(l.position),target:L(x),fov:l.fov},avatar:{feet:{x:E.position.x,y:0,z:E.position.z},yaw:v.state.rotation,height:St()}}}function at(){return M.active?new Promise(x=>x(U())):(b.screen==="match"?(y.leave(),I("abandon")):y.clear(),k("arrival"),document.body.classList.add("leaving"),v.place({y:0}),_.clear(),b.lift=0,d.arrival.phase!=="standing"&&d.arrival.stage(null),d.self.motion={},f=kc({yaw:f.yaw,scale:v.scale}),Ve(),J(v.state),Y(),d.update(.3,l),h.crouch(0),M.active=!0,M.t=0,new Promise(x=>{M.done=x,de()}))}function Ne(x){if(b.clock+=x,Ve(),M.active)return M.t+=x,de();const{input:L,pressed:Q,deltas:j}=n,W=b.screen,fe=d.arrival.crouch>0||b.inputPaused,$=(W==="arrival"||W==="match")&&!fe;if(W==="title")Q.interact&&G(null);else if(W==="arrival")Q.interact&&!fe&&H();else if(W==="menu"){const ue=b.options.length;Q.down&&(b.focus=(b.focus+1)%ue),Q.up&&(b.focus=(b.focus+ue-1)%ue),(Q.up||Q.down)&&ee(),Q.back?k("arrival"):Q.interact&&ue&&N(b.options[b.focus].id)}else W==="results"&&Q.interact&&(y.clear(),k("arrival"));let me=0,Ae=0,ie=!1;const ce=$&&W==="match"&&b.autopilot&&y.round;if(ce){const ue=VC(y.round,[v.state.x,v.state.z]);me=ue.strafe,Ae=ue.forward,ie=!0}else $&&((j.lookX||j.lookY)&&eM(f,j.lookX*100,j.lookY*100),(L.lookX||L.lookY)&&tM(f,-L.lookX*md.lookYawRate*x,L.lookY*md.lookPitchRate*x),Q.jump&&_.queue(),me=L.right-L.left,Ae=L.down-L.up,ie=L.run>0);const Se=Math.abs(me)+Math.abs(Ae)>.05;nM(f,x,Se);const ye=ce?0:f.yaw,le={x:v.state.x,z:v.state.z},Re=v.advance(x,{strafe:me,forward:Ae,yaw:ye,running:ie,jump:$&&_.read(x)});W==="arrival"&&(b.walked+=Math.hypot(v.state.x-le.x,v.state.z-le.z)),b.lift=Re.y,J(Re);const O=v.speed();d.self.motion=Re.floor?{speed:O}:{air:!0,speed:O},b.screen==="match"&&y.update(x,[v.state.x,v.state.z]),qe(),Y(),d.update(x,l),h.root.visible=d.self.kind!=="vrm",h.crouch(d.arrival.crouch);const te=b.screen==="match"?y.round:null;u.update(x,(te==null?void 0:te.lit)??null,(te==null?void 0:te.elapsed)??0);const ae=performance.now();Oe.pose&&ae-b.poseAt>100&&(b.poseAt=ae,Oe.pose(d.pose({x:Re.x,y:Re.y,z:Re.z},Re.rotation))),de()}TC(()=>b.screen==="arrival"&&!M.active&&g?v:null,()=>{!g||M.active||b.screen==="arrival"||(b.screen==="match"&&P(),G(null))});async function Te(){const x=(L,Q)=>{n.loading.progress(L,Q),At("#boot-text").textContent=Q};x(.1,"Laying the flagstones…"),u=ew(),o.add(u.group),h=tw(Gn),d=IC({services:t,motion:async()=>YC(),load:L=>{if(!m){const Q=new hp;Q.setURLModifier(j=>j.endsWith("basis_transcoder.js")?Ky:j.endsWith("basis_transcoder.wasm")?Jy:j),m=new fn(Q).setTranscoderPath("/").setWorkerLimit(1),m.detectSupport(a)}return wA(L,{ktx2:m})},height:Gn,heading:Math.PI,standIn:!1,signal:i}),E.add(d.self.root,h.root),o.add(E,d.group),p=KC(n.audio),x(.4,"Lighting the lanterns…"),k("boot"),Ve(),J(v.state),Y(),a.compile(o,l),x(.7,"Finding your avatar…"),await Promise.race([d.loadSelf(),new Promise(L=>setTimeout(()=>L(!1),15e3))]),x(1,"Ready"),g=!0,h.root.visible=d.self.kind!=="vrm",u.update(0,null,0),de()}function _e(x){var Q;A=x.trip??null,b.came=((Q=x.arrival)==null?void 0:Q.from)==="lobby"?"lobby":"direct",At("#title-lobby").hidden=!r.embedded,At("#avatar").hidden=!Oe.changeAvatar,At("#avatar").addEventListener("click",()=>{var j;return(j=Oe.changeAvatar)==null?void 0:j.call(Oe)}),At("#title-go").addEventListener("click",()=>G(null)),At("#start").addEventListener("click",()=>{b.screen==="arrival"&&H()}),At("#menu-back").addEventListener("click",()=>k("arrival")),At("#menu-go").addEventListener("click",()=>{b.options.length&&N(b.options[b.focus].id)}),At("#leave-round").addEventListener("click",()=>{b.screen==="match"&&P()}),At("#results-done").addEventListener("click",()=>{y.clear(),k("arrival")});const L=()=>t.call("travel","lobby",null,i).catch(()=>{});for(const j of["lobby","title-lobby","results-lobby"])At(`#${j}`).addEventListener("click",L);b.came==="lobby"?G(x.arrival.view):r.autoplay?(G(null),N(un.party.solo,!0)):(G(null),k("title")),Ve(),de()}function ot(x){A=x,b.screen==="menu"&&H()}s==null||s.report(()=>({options:T().map(x=>({id:x.id,solo:x.id===un.party.solo})),phase:b.screen==="match"?"match":b.screen==="results"?"results":"menu",match:b.screen==="match"?y.report():null})),s==null||s.on("choose",x=>{T().some(L=>L.id===x)&&N(x,!0)}),s==null||s.on("arrived",({member:x,late:L})=>{L&&y.versus&&F(`${x.name} arrived: they can join this round`)}),Oe.peers=x=>d==null?void 0:d.setPeers(x),Oe.wear=x=>d==null?void 0:d.wear(x),Oe.entered=()=>d==null?void 0:d.arrival.enter(),Oe.stageDeparture=at,Oe.redraw=()=>{g&&(Ve(),Y(),de())},Oe.versus=()=>y.versus,Oe.soloMatch=()=>b.screen==="match"&&!y.versus,Oe.away=x=>y.away(x);function Ee(){return{screen:b.screen}}function ke(){}function Et(x){b.inputPaused=x,x&&v.place({})}function _t(){const x=d?d.inspect():{},L=y.round,Q=v.state,j=new R(Q.x,Gn*.5,Q.z).project(l);return{booted:g,screen:b.screen,position:[yf(Q.x),yf(Q.z)],arrival:b.screen==="arrival"&&d?BC({camera:l.position,fov:l.fov,avatar:{x:Q.x,y:0,z:Q.z},avatarForward:{x:-Math.sin(Q.rotation),z:-Math.cos(Q.rotation)},avatarHeight:Gn,crouched:d.arrival.crouch>0,handsEmpty:d.arrival.handsEmpty}):null,came:b.came,standing:d?d.arrival.crouch===0:!1,walked:b.walked>.5,partySize:A?A.size:1,options:T().map(W=>W.id).join(","),format:y.format,role:y.role,phase:L?L.over?"over":"playing":"idle",score:L?L.scores[S()]??0:0,missed:L?L.missed:0,left:L?Math.ceil(L.duration-L.elapsed):0,lanterns:L?Object.keys(L.lit).length:0,lanternsLit:L?Object.keys(L.lit).length>0:!1,players:L?Object.keys(L.scores).length:0,leaving:M.active,...x,avatarSelf:x.avatarSelf==="none"?"stand-in":x.avatarSelf,avatarSelfInFrame:x.avatarSelf==="none"?Math.abs(j.x)<=1&&Math.abs(j.y)<=1&&j.z<1:x.avatarSelfInFrame}}function B(){y.dispose(),p==null||p.dispose(),d==null||d.dispose(),h==null||h.dispose(),u==null||u.dispose(),m==null||m.dispose(),Ie.geometry.dispose(),Ie.material.dispose(),a.dispose();for(const x of["peers","entered","stageDeparture","redraw","versus","soloMatch","away"])delete Oe[x]}return{prepare:Te,enter:_e,update:Ne,suspend:Ee,restore:ke,dispose:B,inspect:_t,party:ot,inputPaused:Et}}const Oi=new URLSearchParams(location.search),ic=document.querySelector("#stage"),Cs=Oi.has("check")?Oi.get("check")||"scenario":"",rw=["avatars","party","results","locomotion","saved","process"],rc=Um(),Kc=Xm(),yt=Gm({arrival:un.arrival,party:un.party,identityTimeoutMs:1500}),LA=lg(),DA=()=>{document.body.classList.add("hud-measure");try{return cg()}finally{document.body.classList.remove("hud-measure")}},sw=hg(()=>({hud:DA()}),{insets:()=>LA.insets}),wu=mg(xn.slice(0,-1)),Jc=nm();wu.onTalking((n,e)=>Jc.setTalking(n.length>(e?1:0)));const Oo=new Set;yt.on("peers",n=>{var e;for(const t of n)for(const i of[t.vrm,t.avatarUrl])typeof i=="string"&&i&&i.length<=2048&&Oo.add(i);(e=Oe.peers)==null||e.call(Oe,n.map(t=>({...t,talking:t.talking===!0||wu.isTalking(t.id)})))});Kc.on("roster",n=>{for(const e of n.members)e.avatarUrl&&Oo.add(e.avatarUrl)});const Zc=vg();Zc.on(n=>{var e;Oo.add(n.url),kr&&(kr.avatar=n.url),(e=Oe.wear)==null||e.call(Oe,n.url)});Zc.available&&(Oe.changeAvatar=()=>Zc.ask());const PA=dm({post:(n,e)=>yt.post(n,e),stage(n){if(!Oe.stageDeparture)throw new Error("NOT_READY");return Oe.stageDeparture(n)}});let Ui=null,UA=!1;yt.on("departure",n=>{UA=!0;for(const e of Lf)Ui==null||Ui.release(e);PA.receive("departure",{reason:n})});const sc=Qm({post:(n,e)=>yt.post(n,e)}),eo=tg(n=>yt.post("result",{result:n}));yt.hello();let kr=null;async function aw(n,e,t){if(n==="results"){if(e==="begin")return eo.begin((t==null?void 0:t.match)||void 0);if(e==="report")return eo.report(t).match;if(e==="abandon")return eo.abandon(),!0}if(n==="travel"&&e==="lobby")return PA.leave(),!0;throw new Error("HOST_SERVICE_UNAVAILABLE")}async function ow(n,e){if(n!==kr.avatar&&!Oo.has(n))throw new Error("AVATAR_NOT_VOUCHED");const t=await fetch(n,{signal:e});if(!t.ok)throw new Error(`AVATAR_HTTP_${t.status}`);return t.arrayBuffer()}function lw(){const n=Number(Oi.get("party"));return{arrival:Oi.has("arrive")?{from:"lobby",view:{cameraOffset:{x:0,y:2,z:5.04},cameraTargetOffset:{x:0,y:1.05,z:0},avatarRotation:0,avatarHeight:1.7,fov:58}}:{from:"direct",view:null},trip:Number.isInteger(n)&&n>=2&&n<=8?{id:`dev-party-${n}`,room:"",size:n,self:"",arrived:[],roster:null,members:Array.from({length:n-1},(e,t)=>({id:`dev-${t+2}`,name:`Player ${t+2}`,pfp:"",avatarUrl:""}))}:null}}async function cw(){var b;const n=performance.now(),e=await yt.identity();kr={id:"visitor",name:e.name||"You",pfp:e.pfp,avatar:e.avatarUrl||""};const t=Number(Oi.get("round"));Oe.link=Kc,Oe.pose=M=>yt.pose(M),Oe.config={embedded:yt.embedded,check:Cs,autoplay:Oi.has("autoplay"),round:t>=5&&t<=600?t:0};const i={canvas:ic,width:window.innerWidth,height:window.innerHeight,pixelRatio:["party","results","locomotion"].includes(Cs)||Cs==="process"&&!Oi.has("video")?.3:Math.min(window.devicePixelRatio||1,2)},r=new JA(iw,{manifest:un.runtime,graphics:i,services:{identity:kr,asset:()=>Promise.reject(new Error("NO_ASSETS")),call:aw,avatar:ow},sendUI(){},onProgress:(M,S)=>sc.progress(M,S),audio:Jc,now:()=>performance.now()});let s=!0,a=!1,o=!1,l=performance.now();Ui=Zm(r,{mode:()=>{var M;return UA||(M=Oe.versus)!=null&&M.call(Oe)?"multiplayer":"solo"},away:M=>{var S;return(S=Oe.away)==null?void 0:S.call(Oe,M)},onChange:()=>{l=performance.now()},onError:M=>console.error("[lantern-tag]",M)});const c=Jm(Ui,{document,window}),u=km(r,{game:"lantern-tag",prefix:xn,input:un.runtime.input,paused:()=>{var M;return((M=Oe.soloMatch)==null?void 0:M.call(Oe))&&Ui.hold("input")},resumed:()=>Ui.release("input")}),h=Cm(r,un.runtime.input),d=new AbortController;let p=null;const m=(M,S)=>{try{r.delta(M,Math.max(-1,Math.min(1,S/100)))}catch{}};ic.addEventListener("pointerdown",M=>p={id:M.pointerId,x:M.clientX,y:M.clientY},{signal:d.signal}),window.addEventListener("pointermove",M=>{(p==null?void 0:p.id)===M.pointerId&&(m("lookX",M.clientX-p.x),m("lookY",M.clientY-p.y),p.x=M.clientX,p.y=M.clientY)},{signal:d.signal});for(const M of["pointerup","pointercancel"])window.addEventListener(M,()=>p=null,{signal:d.signal});ic.addEventListener("contextmenu",M=>M.preventDefault(),{signal:d.signal});const g=M=>{if(s){if(requestAnimationFrame(g),i.width=window.innerWidth,i.height=window.innerHeight,!a&&!o)try{r.tick(Math.max(0,M-l)/1e3)}catch(S){console.error("[lantern-tag]",S),rc.stageFailed("update",S)}l=M}};requestAnimationFrame(g);const A=()=>new Promise(M=>requestAnimationFrame(M)),f=Hm(sc,()=>{var M;i.width=window.innerWidth,i.height=window.innerHeight,(M=Oe.redraw)==null||M.call(Oe)},window);await rc.stage("prepare",()=>r.prepare());const E=()=>({...r.inspect(),...eo.inspect(),hud:DA()});yg(E),im(E),await Promise.race([A(),new Promise(M=>setTimeout(M,1e3))]),sc.firstFrame({width:window.innerWidth,height:window.innerHeight}),yt.ready();const v=yt.embedded?await yt.enterData():lw();await rc.stage("enter",()=>{var M;return r.enter({avatar:{id:kr.id,position:[-2.6,0,3.4],rotation:[0,1,0,0]},camera:{position:[-2.6,2,8.4],target:[-2.6,1.05,3.4],fov:((M=v.arrival.view)==null?void 0:M.fov)??58,mode:"third-person"},party:[],arrival:v.arrival,trip:v.trip})}),yt.embedded&&JSON.stringify(yt.trip)!==JSON.stringify(v.trip)&&r.party(yt.trip),yt.on("party",M=>r.party(M)),await A(),await A(),v.arrival.from==="lobby"&&!yt.revealed?(o=!0,yt.on("revealed",()=>{var M;o=!1,l=performance.now(),(M=Oe.entered)==null||M.call(Oe)})):(b=Oe.entered)==null||b.call(Oe),yt.arrivalReady(),Cs&&!rw.includes(Cs)&&om(await am({session:r,scenario:Rg,backend:"webgl2",bootMs:performance.now()-n,frame:A,pauseHostClock:M=>{a=M,l=performance.now()},act:mm(r)}));const _=()=>{s&&(s=!1,c(),f(),sw(),LA.dispose(),u.dispose(),h.dispose(),d.abort(),wu.dispose(),Kc.dispose(),Jc.dispose(),yt.dispose(),r.dispose())};yt.on("dispose",_),window.addEventListener("pagehide",_,{once:!0})}cw().catch(n=>{console.error(n),yt.fail((n==null?void 0:n.message)||"boot failed"),document.querySelector("#boot-text").textContent="Something went wrong. Please reload."});
